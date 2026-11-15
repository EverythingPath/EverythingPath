import { readFile, realpath, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { pcgenPin } from './catalog/inventory.ts';
import { launchInventoryPaths } from './catalog/launch-inventory-pins.ts';
import { pcgenDataPath, verifyInputs } from './catalog/operator.ts';
import { readPartyBuilds } from './catalog/party/party-builds.ts';
import {
  buildPartyScope,
  decodePartyScope,
  partyScopeBytes,
  partyScopeDrift,
  partyCatalogEntry,
  partyScopePath,
} from './catalog/party/party-scope.ts';
import { partyStatus, partyStatusLines } from './catalog/party/party-status.ts';

const usage = `Usage: pnpm -s catalog:party-scope --write | --check | --status --preview DIR [--json]
--write regenerates ${partyScopePath} from scripts/catalog/party/party-builds.json and the full catalog import (with the chosen PCGen owners) at the pinned checkouts; --check regenerates it and fails when the committed file differs.
--status reads a catalog:preview output directory (run with --pcgen) and prints the party's launch status per character; --json prints it as JSON.
`;

const { values } = parseArgs({
  options: {
    write: { type: 'boolean' },
    check: { type: 'boolean' },
    status: { type: 'boolean' },
    preview: { type: 'string' },
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
if (!values.status && (values.preview !== undefined || values.json))
  throw new Error('--preview and --json go with --status.');

async function readOptional(path: string) {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
      return undefined;
    throw error;
  }
}

/** The full catalog import at the pins, as `catalog:preview --pcgen` imports it. */
async function importPinnedCatalog() {
  const [{ importCatalog }] = await Promise.all([
    import('./catalog/import.ts'),
  ]);
  const paths = launchInventoryPaths();
  const system = await realpath(paths.pf1);
  const content = await realpath(paths['pf1-content']);
  const pcgen = await realpath(
    resolve(paths.pcgen, ...pcgenPin.directory.split('/').map(() => '..')),
  );
  const verified = await verifyInputs({
    system,
    content,
    pcgen,
    allowUnverified: false,
  });
  if (verified.status !== 'verified')
    throw new Error('The party scope needs the pinned checkouts.');
  const read = async (name: string): Promise<unknown> =>
    JSON.parse(
      await readFile(new URL(`./catalog/${name}`, import.meta.url), 'utf8'),
    );
  const artifact = await importCatalog({
    systemPath: system,
    contentPath: content,
    remaps: await read('reviewed-remaps.json'),
    curation: await read('reviewed-curation.json'),
    pcgen: { path: pcgenDataPath(pcgen) },
  });
  return {
    entries: [...artifact.catalog.entries, ...artifact.catalog.resources],
    upstream: verified.repositories,
  };
}

async function generate() {
  const { bytes, builds } = await readPartyBuilds();
  const scope = buildPartyScope({
    builds,
    buildsBytes: bytes,
    catalog: await importPinnedCatalog(),
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

const previewCatalogSchema = z.object({
  entries: z.array(partyCatalogEntry),
  resources: z.array(partyCatalogEntry).optional(),
  remaps: z
    .array(z.object({ from: z.string(), to: z.string(), applied: z.boolean() }))
    .optional(),
  inputVerification: z
    .object({
      repositories: z
        .array(z.object({ repository: z.string(), commit: z.string() }))
        .optional(),
    })
    .optional(),
});
const gateRow = z.object({ externalKey: z.string(), reason: z.string() });
const previewAdmissionSchema = z.object({
  admitted: z.array(
    z.object({
      externalKey: z.string(),
      unverified: z
        .array(z.enum(['no curation record', 'unresolved curation mechanics']))
        .optional(),
    }),
  ),
  held: z.array(gateRow),
  dependentOmissions: z.array(gateRow),
  failures: z.array(gateRow),
});

/** A `catalog:preview` directory's catalog and gate. */
async function readPreview(path: string) {
  const directory = await realpath(path);
  const catalog = previewCatalogSchema.parse(
    JSON.parse(await readFile(join(directory, 'catalog.json'), 'utf8')),
  );
  const gate = previewAdmissionSchema.parse(
    JSON.parse(await readFile(join(directory, 'admission.json'), 'utf8')),
  );
  return {
    entries: [...catalog.entries, ...(catalog.resources ?? [])],
    remaps: (catalog.remaps ?? []).filter(({ applied }) => applied),
    upstream: catalog.inputVerification?.repositories ?? [],
    gate,
  };
}

/** The scope the preview's catalog gives; refuses a preview the committed scope isn't of. */
function previewScope({
  builds,
  bytes,
  committed,
  preview,
}: {
  builds: Awaited<ReturnType<typeof readPartyBuilds>>['builds'];
  bytes: string;
  committed: string;
  preview: Awaited<ReturnType<typeof readPreview>>;
}) {
  let current;
  try {
    current = buildPartyScope({
      builds,
      buildsBytes: bytes,
      catalog: preview,
    });
  } catch (error) {
    throw new Error(
      `The preview can't give the party's status: ${error instanceof Error ? error.message : String(error)} A preview for the party runs catalog:preview with --pcgen.`,
    );
  }
  const drift = partyScopeDrift({ committed, regenerated: current });
  if (drift.length)
    throw new Error(
      `The committed party scope is not this preview's (${drift.join('; ')}): run pnpm -s catalog:party-scope --write, or use a preview of this checkout with --pcgen.`,
    );
  return current;
}

/** The label each admitted scope row would carry in a release built from this checkout. */
async function releaseLabels(
  scope: ReturnType<typeof decodePartyScope>,
  preview: Awaited<ReturnType<typeof readPreview>>,
) {
  const [{ readCommittedReleaseVerification }, { labelDefinitions }] =
    await Promise.all([
      import('./catalog/release-verification-committed.ts'),
      import('./catalog/release-verification.ts'),
    ]);
  const verification = await readCommittedReleaseVerification();
  const inScope = new Set(scope.rows.map(({ key }) => key));
  const admitted = preview.gate.admitted.filter(({ externalKey }) =>
    inScope.has(externalKey),
  );
  const byKey = new Map(
    preview.entries.map((entry) => [entry.externalKey, entry]),
  );
  const labels = labelDefinitions({
    entries: admitted.flatMap(
      ({ externalKey }) => byKey.get(externalKey) ?? [],
    ),
    remaps: preview.remaps,
    verification,
    curationGaps: new Map(
      admitted.flatMap(({ externalKey, unverified }) =>
        unverified ? [[externalKey, unverified] as const] : [],
      ),
    ),
  });
  const source =
    verification.kind === 'current'
      ? 'the committed verification projection, current'
      : verification.kind === 'stale'
        ? `none verified: the committed verification projection is stale (${verification.reasons.join('; ')})`
        : 'none verified: no committed verification projection';
  return {
    labels: new Map([...labels].map(([key, { state }]) => [key, state])),
    source,
  };
}

async function status(previewPath: string) {
  const { bytes, builds } = await readPartyBuilds();
  const committed = await readOptional(partyScopePath);
  if (committed === undefined)
    throw new Error(
      `No ${partyScopePath}: run pnpm -s catalog:party-scope --write.`,
    );
  const scope = decodePartyScope(JSON.parse(committed));
  const preview = await readPreview(previewPath);
  const { binding } = previewScope({ builds, bytes, committed, preview });
  const { labels, source } = await releaseLabels(scope, preview);
  const report = partyStatus({ builds, scope, gate: preview.gate, labels });
  if (values.json) {
    process.stdout.write(
      `${JSON.stringify({ ...report, upstream: binding.catalog.upstream, labels: source }, null, 2)}\n`,
    );
    return;
  }
  process.stdout.write(
    [
      `Party status of ${scope.scopeVersion}, the launch measure (owner, 2026-11-10): the admission gate of the preview at the pins ${binding.catalog.upstream.map(({ repository, commit }) => `${repository} ${commit.slice(0, 8)}`).join(', ')}; labels from ${source}.`,
      'Needed: the scope rows a character reaches from its builds keys, plus its unmatched entries and open race. Omitted: dependent omission. A character is ready when every row it needs is admitted.',
      ...partyStatusLines(report),
      '',
    ].join('\n'),
  );
}

if (values.status) {
  if (!values.preview) throw new Error('--status needs --preview DIR.');
  await status(values.preview);
} else await generate();
