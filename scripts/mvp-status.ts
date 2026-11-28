import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  launchVerificationStaleness,
  launchVerificationSchema,
  type VerifiedLaunchRow,
} from './catalog/launch-verification.ts';

/**
 * `pnpm -s mvp:status`: launch progress per class and race, read from the
 * committed launch inventory and its committed verification projection
 * (`campaign-mvp-v1.verification.json`), applied when it is current: its
 * verified observations override the frozen ones. Read-only. A required row
 * counts under every root with a semantic path to it; the total line counts
 * each required row once. A row is met when the inventory inspection reports
 * no launch failure for it other than an outstanding mechanism (root decision
 * D5, 2026-11-26), and each count says how many of its met rows have one.
 * "admitted" counts the rows whose admission the projection verifies: a
 * catalog row when the gate admitted it, a resource row when the scoped build
 * emits it from bytes equal to its bound source; "held" the rows with an
 * inventory hold. A stale or
 * missing projection counts 0 rows, and the status says why. Which books
 * lack a reviewed notice is `pnpm catalog:notice-coverage`'s answer, not this
 * status's.
 */
export type MvpStatusInput = {
  roots: readonly { key: string; name: string; kind: string }[];
  rows: readonly {
    key: string;
    requirement: 'required' | 'optional';
    holds: readonly { reason: string; owner: { issue: number } }[];
  }[];
  failures: readonly { key: string; code: string }[];
  incoming: Readonly<Record<string, readonly { keys: readonly string[] }[]>>;
  /** The rows whose admission the current projection verifies. */
  admitted: ReadonlySet<string>;
  /** The projection's applied rows, or why it applies none. */
  verification: { rows: number; stale: readonly string[] };
};

type Row = MvpStatusInput['rows'][number];

const groups: readonly { title: string; kinds: readonly string[] }[] = [
  { title: 'Classes', kinds: ['class'] },
  { title: 'Races', kinds: ['race'] },
];

const legend =
  'Admitted: the rows whose admission the committed verification projection verifies: a catalog row when the gate admitted it, a resource row when the scoped build emits it from bytes equal to its bound source; a stale projection admits none. Held: rows with an inventory hold, counted by the issue that owns the hold. Books without a reviewed notice: pnpm -s catalog:notice-coverage.';
const metLegend =
  "Met: a required row has no launch failure other than an outstanding mechanism. The inventory is frozen requirements; a content row's observations verify only from the committed verification projection of one current build: the gate admitted it and the scoped build emits a valid entry for it. It also has no hold and no inherited before-reliance failure. A row whose only failures are outstanding mechanisms counts as met: its entry ships labelled unverified and still counts, and each count says how many such rows it holds. A mechanism is no longer outstanding when reused, proven by the mechanism proof registry or permitted prose. Permitted prose is Magical Lineage's recorded metamagic or a PRD-named category identified from a reviewed case, never from a name (owner decision 2026-11-03): identified mystery, patron and spirit cases (D10), unparsed prerequisite clauses (D12) and the #229/#237 attack feats. Archetype proficiency changes (D7) only keep their own recorded issue from disqualifying a proof. Met is not verified, released or approved. A stale projection counts 0 rows.";

/** The failure an outstanding mechanism raises (`inspectLaunchInventory`). */
const outstandingMechanism = 'implementation';

/**
 * Each failing row's state: `unmet` when it has a failure other than an
 * outstanding mechanism, else `mechanism` (met, with one outstanding).
 */
function failureStates(failures: MvpStatusInput['failures']) {
  const states = new Map<string, 'unmet' | 'mechanism'>();
  for (const { key, code } of failures)
    if (code !== outstandingMechanism) states.set(key, 'unmet');
    else if (!states.has(key)) states.set(key, 'mechanism');
  return states;
}

type FailureStates = ReturnType<typeof failureStates>;

/** How many rows are met, and how many of those have an outstanding mechanism. */
function metCounts(rows: readonly Row[], states: FailureStates) {
  const met = rows.filter(({ key }) => states.get(key) !== 'unmet');
  const mechanism = met.filter(({ key }) => states.has(key)).length;
  return {
    met: met.length,
    mechanism: `(${mechanism} with an outstanding mechanism)`,
  };
}

function verificationLine({ rows, stale }: MvpStatusInput['verification']) {
  return stale.length
    ? `${metLegend} Verification stale (${stale.join('; ')}): it counts 0 rows; regenerate it with \`pnpm -s catalog:launch-inventory --verify --write\`.`
    : `${metLegend} Verification: ${rows} rows current.`;
}

/**
 * The committed projection's rows when it is current, else none and why. A
 * missing projection is stale, and so is one this checkout's schema refuses
 * (such as one written before a binding was added).
 */
export async function statusVerification(
  document: unknown,
  current: Parameters<typeof launchVerificationStaleness>[1],
): Promise<{ rows: VerifiedLaunchRow[]; stale: string[] }> {
  if (document === undefined)
    return { rows: [], stale: ['no committed verification projection'] };
  const parsed = launchVerificationSchema.safeParse(document);
  if (!parsed.success)
    return {
      rows: [],
      stale: ['the committed verification projection is malformed'],
    };
  const projection = parsed.data;
  const stale = await launchVerificationStaleness(projection, current);
  return stale.length ? { rows: [], stale } : { rows: projection.rows, stale };
}

/** The projection rows whose `admission` it verifies, by key. */
export const admittedKeys = (
  rows: readonly Pick<VerifiedLaunchRow, 'key' | 'verified'>[],
) =>
  new Set(
    rows
      .filter(({ verified }) => verified.includes('admission'))
      .map(({ key }) => key),
  );

/** A hold counts by the issue that owns it. */
const holdReason = ({ owner }: Row['holds'][number]) => `#${owner.issue}`;

function countText(counts: ReadonlyMap<string, number>) {
  return [...counts]
    .sort(([a, x], [b, y]) => y - x || (a < b ? -1 : a > b ? 1 : 0))
    .map(([reason, count]) => `${reason} ${count}`)
    .join(', ');
}

function rootLine(
  name: string,
  rows: readonly Row[],
  {
    states,
    admitted: admittedSet,
  }: Pick<MvpStatusInput, 'admitted'> & { states: FailureStates },
) {
  const reasons = new Map<string, number>();
  let held = 0;
  for (const row of rows) {
    if (row.holds.length === 0) continue;
    held += 1;
    for (const reason of new Set(row.holds.map(holdReason)))
      reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
  }
  const admitted = rows.filter(({ key }) => admittedSet.has(key)).length;
  const met = metCounts(rows, states);
  return [
    `  ${name}: ${rows.length} required`,
    `${met.met} met ${met.mechanism}`,
    `${admitted} admitted`,
    `${held} held${held ? ` (${countText(reasons)})` : ''}`,
  ].join(', ');
}

export function mvpStatusLines(input: MvpStatusInput) {
  const states = failureStates(input.failures);
  const required = input.rows.filter(
    ({ requirement }) => requirement === 'required',
  );
  const reached = (root: string) =>
    required.filter(
      ({ key }) =>
        key === root ||
        (input.incoming[key] ?? []).some(({ keys }) => keys[0] === root),
    );
  const byName = [...input.roots].sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );
  const grouped = groups.flatMap(({ kinds }) => kinds);
  const sections = [
    ...groups,
    {
      title: 'Other roots',
      kinds: input.roots
        .map(({ kind }) => kind)
        .filter((kind) => !grouped.includes(kind)),
    },
  ];
  const lines = [legend, verificationLine(input.verification)];
  for (const { title, kinds } of sections) {
    const roots = byName.filter(({ kind }) => kinds.includes(kind));
    if (roots.length === 0) continue;
    lines.push(title);
    for (const root of roots)
      lines.push(
        rootLine(
          title === 'Other roots' ? `${root.name} (${root.kind})` : root.name,
          reached(root.key),
          { states, admitted: input.admitted },
        ),
      );
  }
  const { met, mechanism } = metCounts(required, states);
  lines.push(
    `${met} of ${required.length} launch requirements met ${mechanism}`,
  );
  return lines;
}

async function readOptionalJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
      return undefined;
    throw error;
  }
}

async function sha256Of(path: string) {
  try {
    return createHash('sha256')
      .update(await readFile(path))
      .digest('hex');
  } catch {
    return undefined;
  }
}

/**
 * The committed launch inventory and its verification projection's status
 * over this checkout, with `document` as the committed projection (undefined
 * when missing): its rows when current, else none and why
 * (`statusVerification`). `mvp:status` and a release's labels read it.
 */
export async function committedVerification(document: unknown) {
  const [
    { parseLaunchInventory },
    { launchScopeIdentity },
    { launchMechanismProofs },
    { launchProseCases },
    { mechanismProofsSha256, repositoryFileSha256 },
    { currentCalculationIdentity },
    { launchVerificationPackages },
  ] = await Promise.all([
    import('./catalog/launch-inventory-document.ts'),
    import('./catalog/launch-inventory.ts'),
    import('./catalog/launch-mechanism-proofs.ts'),
    import('./catalog/launch-prose-categories.ts'),
    import('./catalog/launch-verification.ts'),
    import('../src/lib/catalog/calculation-identities.ts'),
    import('./catalog/package-resolution.ts'),
  ]);
  const manifest = parseLaunchInventory(
    JSON.parse(
      await readFile('scripts/catalog/scopes/campaign-mvp-v1.json', 'utf8'),
    ),
  );
  const verification = await statusVerification(document, {
    scopeVersion: manifest.scopeVersion,
    launchScopeIdentity: launchScopeIdentity(manifest),
    calculationIdentity: currentCalculationIdentity,
    proofsSha256: mechanismProofsSha256(launchMechanismProofs),
    proofs: {
      registry: launchMechanismProofs,
      sha256Of: (path) => repositoryFileSha256('.', path),
    },
    proseCases: launchProseCases,
    sha256Of,
    packages: launchVerificationPackages,
  });
  return { manifest, verification };
}

/** The committed verification projection, undefined when missing. */
export function readCommittedProjection() {
  return readOptionalJson(
    'scripts/catalog/scopes/campaign-mvp-v1.verification.json',
  );
}

/**
 * `mvp:status` over this checkout, with `document` as the committed
 * verification projection (undefined when missing): the projection reader
 * (`committedVerification`), then the inventory inspection it feeds.
 */
export async function mvpStatus(document: unknown) {
  const [{ manifest, verification }, { inspectLaunchInventory }] =
    await Promise.all([
      committedVerification(document),
      import('./catalog/launch-inventory.ts'),
    ]);
  const report = inspectLaunchInventory(manifest, {
    verification: verification.rows,
  });
  const admitted = admittedKeys(verification.rows);
  const lines = mvpStatusLines({
    roots: manifest.roots,
    rows: manifest.rows,
    failures: report.launchFailures,
    incoming: report.incoming,
    admitted,
    verification: {
      rows: verification.rows.length,
      stale: verification.stale,
    },
  });
  return { manifest, verification, report, admitted, lines };
}

async function main() {
  const { report, lines } = await mvpStatus(await readCommittedProjection());
  process.stdout.write(
    `Launch content is measured by the party's status, not by this inventory (owner, 2026-11-10): pnpm -s catalog:party-scope --status.\nLaunch status of ${report.scopeVersion} (${report.identity}); a row reached from several roots counts under each.\n${lines.join('\n')}\n`,
  );
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
)
  await main();
