import type { AdmissionRow, assessCatalogAdmission } from './admission.ts';

type Gate = ReturnType<typeof assessCatalogAdmission>;
type NonEmpty<T> = readonly [T, ...T[]];

/**
 * Whether every book a row comes from has a reviewed notice in the register,
 * as the admission gate decided it on the register alone (no Attribution
 * Assessment, no evidence: `register-admission.ts`). The gate reads each of
 * the row's books (its declared ones, its attribution owner's, or its scripted
 * match's) as the notices it requires (`requiredNotices`) and lists those
 * without a reviewed record (`missingNotices`); this only reads its rows.
 *
 * - `covered`: at least one notice, every one reviewed;
 * - `uncovered`: a book whose notice is missing or unreviewed (`missing`, by
 *   the code the gate requires, which is the book's own code unless the
 *   book reads as its PCGen block or a Registry key);
 * - `no-book`: the row names no book, and no scripted match gives it one;
 * - `not-decided`: the gate failed the entry before deciding on its books
 *   (a broken reference, a duplicate, an entry absent from the inventory).
 */
export type NoticeCoverage =
  | { kind: 'covered'; notices: NonEmpty<string> }
  | { kind: 'uncovered'; notices: readonly string[]; missing: NonEmpty<string> }
  | { kind: 'no-book' }
  | { kind: 'not-decided' };

function coverageOf(row: AdmissionRow): NoticeCoverage {
  const [firstMissing, ...missing] = row.missingNotices;
  if (firstMissing !== undefined)
    return {
      kind: 'uncovered',
      notices: row.requiredNotices,
      missing: [firstMissing, ...missing],
    };
  const [first, ...rest] = row.requiredNotices;
  return first === undefined
    ? { kind: 'no-book' }
    : { kind: 'covered', notices: [first, ...rest] };
}

/**
 * Each entry's coverage, by key, from a gate run on the register only. An
 * entry the gate admitted, held or omitted as a dependent has its row's
 * coverage; one it only failed is `not-decided`.
 */
export function noticeCoverage(
  registerOnlyGate: Pick<
    Gate,
    'admitted' | 'held' | 'dependentOmissions' | 'failures'
  >,
): ReadonlyMap<string, NoticeCoverage> {
  const coverage = new Map<string, NoticeCoverage>();
  for (const row of [
    ...registerOnlyGate.admitted,
    ...registerOnlyGate.held,
    ...registerOnlyGate.dependentOmissions,
  ])
    coverage.set(row.externalKey, coverageOf(row));
  for (const { externalKey } of registerOnlyGate.failures)
    if (!coverage.has(externalKey))
      coverage.set(externalKey, { kind: 'not-decided' });
  return coverage;
}

/**
 * The admitted rows of a release's gate (`admitted`) that come from a book
 * the register-only decision (`coverage`) finds without a reviewed notice,
 * each with those books: a release refuses every one (`release.ts`,
 * `buildLegalRows`). Empty when none does. A row the register-only gate names
 * no book for, or did not decide on its books, has no book to check; on the
 * register alone the gate admits neither.
 */
export function uncoveredAdmissions({
  admitted,
  coverage,
}: {
  admitted: readonly Pick<AdmissionRow, 'externalKey'>[];
  coverage: ReadonlyMap<string, NoticeCoverage>;
}) {
  return admitted.flatMap(({ externalKey }) => {
    const found = coverage.get(externalKey);
    return found?.kind === 'uncovered'
      ? [`${externalKey} (no reviewed notice: ${found.missing.join(', ')})`]
      : [];
  });
}
