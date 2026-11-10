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
 * committed launch inventory and the curation admission records
 * (`scripts/catalog/legal/*.json`). Read-only. A required row counts under
 * every root with a semantic path to it; the total line counts each required
 * row once. A row is met when the inventory inspection reports no launch
 * failure for it, with the committed verification projection
 * (`campaign-mvp-v1.verification.json`) applied when it is current: its
 * verified observations override the frozen ones. A stale or missing
 * projection counts 0 rows, and the status says why. A notice is missing when
 * a required `notice/<code>` row the root reaches is not verified: the
 * inventory reads that row's state from the notice's current readiness (holds in force after the clearances, and a
 * reviewed Registry identity or confirmation). A content row keeps only the
 * notice holds the clearances don't name; a cleared hold stays in its legal
 * record as evidence.
 */
export type MvpStatusInput = {
  roots: readonly { key: string; name: string; kind: string }[];
  rows: readonly {
    key: string;
    requirement: 'required' | 'optional';
    holds: readonly { reason: string; owner: { issue: number } }[];
    noticeEvidence: { state: string };
  }[];
  failures: readonly { key: string }[];
  incoming: Readonly<Record<string, readonly { keys: readonly string[] }[]>>;
  admissions: ReadonlyMap<string, { disposition?: string }>;
  /** The projection's applied rows, or why it applies none. */
  verification: { rows: number; stale: readonly string[] };
};

type Row = MvpStatusInput['rows'][number];

const groups: readonly { title: string; kinds: readonly string[] }[] = [
  { title: 'Classes', kinds: ['class'] },
  { title: 'Races', kinds: ['race'] },
];

const legend =
  'Held reasons: "notice chain" counts notice holds still in force (the inventory drops a hold the notice clearances name); a required notice that is not verified counts under "missing notices".';
const metLegend =
  "Met: a row has no launch failure. The inventory is frozen requirements; a content row's observations verify only from the committed verification projection of one current build (the gate admitted it, the scoped build emits a valid entry, it has no hold, its notices are verified), and a mechanism counts only when reused, proven by the mechanism proof registry or permitted prose. Permitted prose is Magical Lineage's recorded metamagic or a PRD-named category identified from a reviewed case, never from a name (owner decision 2026-11-03): identified mystery, patron and spirit cases (D10), unparsed prerequisite clauses (D12) and the #229/#237 attack feats. Archetype proficiency changes (D7) only keep their own recorded issue from disqualifying a proof. A stale projection counts 0 rows.";

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

/** Legal-record hold ids name their kind; free-text holds count by owner. */
function holdReason({ reason, owner }: Row['holds'][number]) {
  if (/-notice-[^\s]+-complete-chain$/.test(reason)) return 'notice chain';
  if (/^[a-z0-9-]+-whole-content-/i.test(reason)) return 'whole content';
  if (/^[a-z0-9-]+-broken-reference-/i.test(reason)) return 'broken reference';
  if (/^[a-z0-9-]+$/i.test(reason)) return 'recorded hold';
  return `#${owner.issue}`;
}

function missingNotice({ key, noticeEvidence }: Row) {
  return key.startsWith('notice/') && noticeEvidence.state !== 'verified'
    ? key.slice('notice/'.length)
    : undefined;
}

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
    failing,
    admissions,
  }: Pick<MvpStatusInput, 'admissions'> & { failing: ReadonlySet<string> },
) {
  const disposition = (row: Row) => admissions.get(row.key)?.disposition ?? '';
  const reasons = new Map<string, number>();
  const missing = new Set<string>();
  let held = 0;
  for (const row of rows) {
    const notice = missingNotice(row);
    if (notice) missing.add(notice);
    if (row.holds.length === 0) continue;
    held += 1;
    for (const reason of new Set(row.holds.map(holdReason)))
      reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
  }
  const met = rows.filter(({ key }) => !failing.has(key)).length;
  const admitted = rows.filter((row) =>
    /(?:^|\/)admitted$/.test(disposition(row)),
  ).length;
  const omitted = rows.filter((row) =>
    /omitted|excluded/.test(disposition(row)),
  ).length;
  const codes = [...missing].sort();
  return [
    `  ${name}: ${rows.length} required`,
    `${met} met`,
    `${admitted} admitted`,
    `${held} held${held ? ` (${countText(reasons)})` : ''}`,
    `${omitted} omitted`,
    `missing notices ${codes.length}${codes.length ? `: ${codes.join(' ')}` : ''}`,
  ].join(', ');
}

export function mvpStatusLines(input: MvpStatusInput) {
  const failing = new Set(input.failures.map(({ key }) => key));
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
          { failing, admissions: input.admissions },
        ),
      );
  }
  const met = required.filter(({ key }) => !failing.has(key)).length;
  lines.push(`${met} of ${required.length} launch requirements met`);
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
 * `mvp:status` over this checkout, with `document` as the committed
 * verification projection (undefined when missing): the projection reader
 * (`statusVerification`), then the inventory inspection it feeds.
 */
export async function mvpStatus(document: unknown) {
  const [
    { parseLaunchInventory },
    { inspectLaunchInventory, launchScopeIdentity },
    legal,
    { launchMechanismProofs },
    { launchProseCases },
    { mechanismProofsSha256, repositoryFileSha256 },
    { currentCalculationIdentity },
    { launchVerificationPackages },
  ] = await Promise.all([
    import('./catalog/launch-inventory-document.ts'),
    import('./catalog/launch-inventory.ts'),
    import('./catalog/launch-inventory-sources.ts'),
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
  const report = inspectLaunchInventory(manifest, {
    verification: verification.rows,
  });
  const lines = mvpStatusLines({
    roots: manifest.roots,
    rows: manifest.rows,
    failures: report.launchFailures,
    incoming: report.incoming,
    admissions: await legal.readLaunchLegalInventories('.'),
    verification: {
      rows: verification.rows.length,
      stale: verification.stale,
    },
  });
  return { manifest, verification, report, lines };
}

async function main() {
  const { report, lines } = await mvpStatus(
    await readOptionalJson(
      'scripts/catalog/scopes/campaign-mvp-v1.verification.json',
    ),
  );
  process.stdout.write(
    `Launch status of ${report.scopeVersion} (${report.identity}); a row reached from several roots counts under each.\n${lines.join('\n')}\n`,
  );
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
)
  await main();
