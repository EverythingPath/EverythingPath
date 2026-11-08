import { z } from 'zod';
import { prerequisiteSchema } from '../../src/lib/character-sheet-prerequisite-schema.ts';

/**
 * Permitted prose by category (owner decision 2026-11-03, "Yes, by
 * category"). A row's outstanding mechanism counts as permitted prose when
 * recorded evidence places it in one of PRD #251's named prose categories.
 * Identification reads recorded fields only, never a name, tag or
 * description: a reviewed prose case bound to the row's mechanism and source
 * bytes. D7's recorded archetype reason is no mechanism prose; it only keeps
 * its own issue from disqualifying a proof. An unparsed
 * prerequisite case also needs the parser to record every clause as
 * unparsed, since the parser also leaves clauses of kinds D12 says are parsed
 * (caster level, proficiency, a class feature) unchecked, and prose must not
 * hide such a gap. Prose satisfies only the mechanism condition; admission,
 * structure, content and notice evidence still apply, and a held or
 * unadmitted row is never projected.
 */
/**
 * The categories that make an outstanding mechanism permitted prose, each
 * identified only by a reviewed prose case (`launchProseCaseSchema`), since
 * no importer field records them:
 * - `mystery-patron-spirit` (Decision 10, #218/#233: explicitly identified
 *   prose-only mystery, patron and spirit cases remain text until curated);
 * - `unparsed-prerequisite` (Decision 12: unmodeled or unparsed clauses show
 *   readable prose, which does not hide a missing modeled calculation), while
 *   the scoped entry also records every clause of the row's one
 *   Prerequisites paragraph as unparsed (`unchecked`);
 * - `attack-feat-text` (Out of Scope, #229/#237: the attack feats and
 *   abilities explicitly left as text).
 *
 * These are the only categories a verification projection may name, so the
 * committed-projection reader checks each one it names against a current
 * case. Beside them, the only other prose is Magical Lineage's, recorded by
 * the inventory itself (`magicalLineageProse`).
 */
export const launchProseCategoryIds = [
  'mystery-patron-spirit',
  'unparsed-prerequisite',
  'attack-feat-text',
] as const;
export type LaunchProseCategory = (typeof launchProseCategoryIds)[number];

/**
 * The inventory's own recorded prose (`launch-inventory-build.ts`): Magical
 * Lineage's manual metamagic adjustment, the owner's approval in #769. It
 * stays alongside the categories, as the only `permitted prose` disposition
 * the frozen inventory may record.
 */
export const magicalLineageProse = {
  key: 'pf1-content/kDx6ZGhbIteoi7lG',
  mechanism: 'Metamagic adjustment',
} as const;

/** The archetype mapper's recorded reason (`pcgen/archetypes.ts`). */
export const archetypeProficiencyProseReason =
  'Archetype proficiency changes stay prose (#716 plan §4).';
/** The inventory's mechanism for a source Prerequisites paragraph. */
export const sourcePrerequisitesMechanism = 'Source prerequisites';

/**
 * A reviewed prose case: a decision naming a case (#218's mystery, patron and
 * spirit spells; #229's and #237's text feats; a prerequisite clause outside
 * D12's parsed kinds) bound to the exact row, mechanism and source bytes it
 * was reviewed against. A changed source drops the case. Only the categories
 * no importer field records take cases.
 */
export const launchProseCaseSchema = z.strictObject({
  category: z.enum(launchProseCategoryIds),
  key: z.string().min(1),
  mechanism: z.string().min(1),
  /** The row's bound source bytes (`sources[].rawSha256`). */
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  /** Where the decision names this case. */
  decision: z.string().min(1),
});
export type LaunchProseCase = z.infer<typeof launchProseCaseSchema>;

/** The reviewed cases, refused whole when any case is malformed. */
export function parseLaunchProseCases(
  value: unknown,
): readonly LaunchProseCase[] {
  return z.array(launchProseCaseSchema).parse(value);
}

/**
 * No case is reviewed yet. No importer field identifies a mystery, patron or
 * spirit case, a #229/#237 text feat or an unmodeled prerequisite clause, and
 * a case needs a review naming its row.
 */
export const launchProseCases = parseLaunchProseCases([]);

type ProseRow = {
  key: string;
  kind: string;
  mechanisms: readonly { name: string; status: string; disposition: string }[];
  sources: readonly { rawSha256: string }[];
};
type Issue = { field: string; reason?: string };

/**
 * PRD #251 Decision 7 (archetype proficiency changes remain prose with manual
 * proficiency edits): an archetype's `proficiencies` unsupported issue with
 * the archetype mapper's recorded reason. D7 is issue-only, never mechanism
 * prose: the issue names no mechanism, so it only keeps itself from
 * disqualifying a proof, and no projection can name it.
 */
export function isArchetypeProficiencyProse(
  row: Pick<ProseRow, 'kind'>,
  issue: Issue,
) {
  return (
    row.kind === 'archetype' &&
    issue.field === 'proficiencies' &&
    issue.reason === archetypeProficiencyProseReason
  );
}

const prerequisitesSchema = z.object({
  prerequisites: z.array(prerequisiteSchema).nonempty(),
});

/** The scoped entry records prerequisites, and every clause is unparsed. */
function everyClauseUnparsed(entry: unknown, issues: readonly Issue[]) {
  const parsed = prerequisitesSchema.safeParse(entry);
  return (
    parsed.success &&
    parsed.data.prerequisites.every(
      (clause) => !('anyOf' in clause) && 'unchecked' in clause,
    ) &&
    !issues.some(
      ({ field }) =>
        field === 'prerequisites' || field.startsWith('prerequisites.'),
    )
  );
}

/**
 * Each outstanding mechanism of the row that a category's recorded evidence
 * makes permitted prose. `entry` is the row's scoped build entry and `issues`
 * its `unsupported` issues. Recorded prose (Magical Lineage) is not
 * outstanding and stays the inventory's.
 */
export function proseMechanisms(
  row: ProseRow,
  {
    entry,
    issues,
    cases,
  }: {
    entry: unknown;
    issues: readonly Issue[];
    cases: readonly LaunchProseCase[];
  },
): { mechanism: string; category: LaunchProseCategory }[] {
  const outstanding = row.mechanisms.filter(
    ({ status, disposition }) =>
      status === 'outstanding' && disposition !== 'permitted prose',
  );
  const prose = new Map<string, LaunchProseCategory>();
  // D12: the row's one Prerequisites paragraph, which the parser records as
  // wholly unparsed. A parsed clause stays a modeled calculation.
  const unparsedPrerequisites =
    outstanding.filter(({ name }) => name === sourcePrerequisitesMechanism)
      .length === 1 && everyClauseUnparsed(entry, issues);
  for (const reviewed of cases)
    if (
      reviewed.key === row.key &&
      outstanding.some(({ name }) => name === reviewed.mechanism) &&
      row.sources.some(
        ({ rawSha256 }) => rawSha256 === reviewed.sourceSha256,
      ) &&
      (reviewed.category !== 'unparsed-prerequisite' ||
        (reviewed.mechanism === sourcePrerequisitesMechanism &&
          unparsedPrerequisites))
    )
      prose.set(reviewed.mechanism, reviewed.category);
  return [...prose]
    .map(([mechanism, category]) => ({ mechanism, category }))
    .sort((a, b) =>
      a.mechanism < b.mechanism ? -1 : a.mechanism > b.mechanism ? 1 : 0,
    );
}
