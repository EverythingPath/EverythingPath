import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { readPartyBuilds } from './catalog/party/party-builds.ts';
import { pinnedCatalogCheckouts } from './catalog/party/pinned-catalog-checkouts.ts';
import {
  buildPartyScope,
  decodePartyScope,
  partyScopeBytes,
  partyScopeDrift,
  partyScopePath,
} from './catalog/party/party-scope.ts';
import { partyStatus, partyStatusLines } from './catalog/party/party-status.ts';

const usage = `Usage: pnpm -s catalog:party-scope --write | --check | --status [--json]
--write regenerates ${partyScopePath} from scripts/catalog/party/party-builds.json and the full catalog import (with the chosen PCGen owners) at the pinned checkouts; --check regenerates it and fails when the committed file differs.
--status imports the whole catalog at the pinned checkouts, runs the admission gate on it as catalog:preview --pcgen does (about five minutes), and prints the party's launch status per character; --json prints it as JSON.
`;

const { values } = parseArgs({
  options: {
    write: { type: 'boolean' },
    check: { type: 'boolean' },
    status: { type: 'boolean' },
    json: { type: 'boolean' },
    help: { type: 'boolean' },
  },
  strict: true,
});
const modes = [values.write, values.check, values.status].filter(Boolean);
if (values.help || modes.length !== 1) {
  process.stdout.write(usage);
  process.exit(values.help ? 0 : 64);
}
if (!values.status && values.json)
  throw new Error('--json goes with --status.');

async function readOptional(path: string) {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
      return undefined;
    throw error;
  }
}

/**
 * The full catalog import at the pins, as `catalog:preview --pcgen` imports
 * it: the shared pinned import (`pinned-import.ts`), the #227 matcher's too,
 * so over verified checkouts the whole corpus.
 */
async function importPartyCatalog() {
  const { importPinnedCatalog } = await import('./catalog/pinned-import.ts');
  const { artifact, upstream } = await importPinnedCatalog({
    checkouts: await pinnedCatalogCheckouts(),
  });
  return {
    artifact,
    /** What the party scope reads: every entry and resource, and the upstream commits. */
    catalog: {
      entries: [...artifact.catalog.entries, ...artifact.catalog.resources],
      upstream,
    },
  };
}

async function generate() {
  const { bytes, builds } = await readPartyBuilds();
  const scope = buildPartyScope({
    builds,
    buildsBytes: bytes,
    catalog: (await importPartyCatalog()).catalog,
  });
  const written = partyScopeBytes(scope);
  if (values.write) await writeFile(partyScopePath, written);
  else {
    const drift = partyScopeDrift({
      committed: await readOptional(partyScopePath),
      regenerated: scope,
    });
    if (drift.length)
      throw new Error(
        `The party scope is stale (${drift.join('; ')}): run pnpm -s catalog:party-scope --write.`,
      );
  }
  process.stdout.write(
    `${JSON.stringify({ version: scope.scopeVersion, characters: scope.characters.length, roots: scope.roots.length, rows: scope.rows.length, edges: scope.edges.length, bytes: Buffer.byteLength(written) }, null, 2)}\n`,
  );
}

/** The committed verification projection, refused unless current: the status's labels are read from it. */
async function currentVerification() {
  const { readCommittedReleaseVerification } =
    await import('./catalog/release-verification-committed.ts');
  const verification = await readCommittedReleaseVerification();
  if (verification.kind !== 'current')
    throw new Error(
      `The committed verification projection is stale (${verification.kind === 'stale' ? verification.reasons.join('; ') : 'no committed verification projection'}), so the labels it gives are not this checkout's and no status is printed: restore the stale input (a pinned list the store lacks: git checkout -- tests/fixtures/pinned) or regenerate (pnpm -s catalog:launch-inventory --verify --write), then run the status again.`,
    );
  return verification;
}

/**
 * The gate's result for the whole catalog as it is now: the full import at
 * the pins, as `catalog:preview --pcgen` imports it, and the gate a build
 * runs on it with the committed notice register (root, 2026-11-20: the
 * status counts no admission saved by an earlier run).
 */
async function currentAdmission() {
  const [{ assessCatalogAdmission }, { readCommittedRegisterAdmission }] =
    await Promise.all([
      import('./catalog/admission.ts'),
      import('./catalog/register-admission.ts'),
    ]);
  const { artifact, catalog } = await importPartyCatalog();
  const gate = assessCatalogAdmission({
    artifact,
    ...(await readCommittedRegisterAdmission()),
  });
  return {
    catalog,
    remaps: artifact.catalog.remaps.filter(({ applied }) => applied),
    gate,
  };
}

/** The scope the import gives; refuses an import the committed scope isn't of. */
function currentScope({
  builds,
  bytes,
  committed,
  catalog,
}: {
  builds: Awaited<ReturnType<typeof readPartyBuilds>>['builds'];
  bytes: string;
  committed: string;
  catalog: Awaited<ReturnType<typeof currentAdmission>>['catalog'];
}) {
  const current = buildPartyScope({ builds, buildsBytes: bytes, catalog });
  const drift = partyScopeDrift({ committed, regenerated: current });
  if (drift.length)
    throw new Error(
      `The committed party scope is not this checkout's (${drift.join('; ')}): run pnpm -s catalog:party-scope --write.`,
    );
  return current;
}

/** The label each admitted scope row would carry in a release built from this checkout. */
async function releaseLabels(
  scope: ReturnType<typeof decodePartyScope>,
  admission: Awaited<ReturnType<typeof currentAdmission>>,
  verification: Awaited<ReturnType<typeof currentVerification>>,
) {
  const { labelDefinitions } =
    await import('./catalog/release-verification.ts');
  const inScope = new Set(scope.rows.map(({ key }) => key));
  const admitted = admission.gate.admitted.filter(({ externalKey }) =>
    inScope.has(externalKey),
  );
  const byKey = new Map(
    admission.catalog.entries.map((entry) => [entry.externalKey, entry]),
  );
  const labels = labelDefinitions({
    entries: admitted.flatMap(
      ({ externalKey }) => byKey.get(externalKey) ?? [],
    ),
    remaps: admission.remaps,
    verification,
    curationGaps: new Map(
      admitted.flatMap(({ externalKey, unverified }) =>
        unverified ? [[externalKey, unverified] as const] : [],
      ),
    ),
  });
  return {
    labels: new Map([...labels].map(([key, { state }]) => [key, state])),
    source: 'the committed verification projection, current',
  };
}

async function status() {
  const { bytes, builds } = await readPartyBuilds();
  const committed = await readOptional(partyScopePath);
  if (committed === undefined)
    throw new Error(
      `No ${partyScopePath}: run pnpm -s catalog:party-scope --write.`,
    );
  const scope = decodePartyScope(JSON.parse(committed));
  const verification = await currentVerification();
  process.stderr.write(
    'Importing the whole catalog at the pinned checkouts and running the admission gate on it, as catalog:preview --pcgen does (about five minutes).\n',
  );
  const admission = await currentAdmission();
  const { binding } = currentScope({
    builds,
    bytes,
    committed,
    catalog: admission.catalog,
  });
  const { labels, source } = await releaseLabels(
    scope,
    admission,
    verification,
  );
  const report = partyStatus({ builds, scope, gate: admission.gate, labels });
  if (values.json) {
    process.stdout.write(
      `${JSON.stringify({ ...report, upstream: binding.catalog.upstream, labels: source }, null, 2)}\n`,
    );
    return;
  }
  process.stdout.write(
    [
      `Party status of ${scope.scopeVersion}, the launch measure (owner, 2026-11-10): the admission gate, run now on the whole import at the pins ${binding.catalog.upstream.map(({ repository, commit }) => `${repository} ${commit.slice(0, 8)}`).join(', ')}; labels from ${source}.`,
      'Needed: the scope rows a character reaches from its builds keys, plus its unmatched entries and open race. Omitted: dependent omission. A character is ready when every row it needs is admitted.',
      ...partyStatusLines(report),
      '',
    ].join('\n'),
  );
}

if (values.status) await status();
else await generate();
