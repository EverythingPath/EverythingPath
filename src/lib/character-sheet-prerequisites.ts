import { characterSheetClassFamily } from './character-sheet-grants';
import { classFamilyLevels } from './character-sheet-class-levels';
import { orderedSelectionIdsAtLevel } from './character-sheet-selection';
import {
  proficiencyKey,
  type ManualProficiency,
  type ProficiencyGrant,
} from './character-sheet-proficiencies';
import type { CharacterSheetInput, SheetWarning } from './character-sheet';
import {
  buildRecordedPrerequisiteSources,
  definitionFor,
  ignoresPrerequisites,
  recordedPrefix,
} from './character-sheet-proficiency-prerequisites';

export type {
  PrerequisiteAtom,
  Prerequisite,
} from './character-sheet-prerequisite-schema';
import type { Prerequisite } from './character-sheet-prerequisite-schema';
export { prerequisiteLabel } from './character-sheet-prerequisite-evaluation';
export type { PrerequisiteFacts } from './character-sheet-prerequisite-evaluation';
import {
  buildClassFeatureAssociations,
  evaluatePrerequisite,
  prerequisiteLabel,
  resolvedPrerequisiteProficiency,
  type PrerequisiteFacts,
} from './character-sheet-prerequisite-evaluation';
export type PrerequisiteCheck = {
  entryId: string;
  view: 'current' | 'recorded';
  clauseIndex: number;
  clause: Prerequisite;
  met: boolean | null;
};

type Clause = {
  clause: Prerequisite;
  legacy: boolean;
  legacyIndex: number | undefined;
};
function clausesFor(
  definition: CharacterSheetInput['catalogEntries'][number],
): Clause[] {
  const legacyClauses = definition.proficiencyPrerequisites ?? [];
  const keyFor = (proficiency: ProficiencyGrant) =>
    'choice' in proficiency ? 'choice' : proficiencyKey(proficiency);
  return [
    ...(definition.prerequisites ?? [])
      .filter(
        (clause) =>
          !('proficiency' in clause) ||
          !legacyClauses.some(
            (legacy) =>
              keyFor(legacy.proficiency) === keyFor(clause.proficiency),
          ),
      )
      .map((clause) => ({ clause, legacy: false, legacyIndex: undefined })),
    ...legacyClauses.map((clause, legacyIndex) => ({
      clause: { proficiency: clause.proficiency } satisfies Prerequisite,
      legacy: true,
      legacyIndex,
    })),
  ];
}

function fingerprintClause(clause: Prerequisite): unknown {
  if ('anyOf' in clause) return { anyOf: clause.anyOf.map(fingerprintClause) };
  const fields = { ...clause };
  delete fields.kind;
  return fields;
}

function prerequisiteWarning({
  clause,
  legacy,
  legacyIndex,
  entry,
  view,
  clauseIndex,
  facts,
  position,
  name,
  catalogEntries,
}: Clause & {
  entry: CharacterSheetInput['entries'][number];
  view: PrerequisiteCheck['view'];
  clauseIndex: number;
  facts: unknown;
  position:
    | NonNullable<ReturnType<typeof recordedPrefix>>['position']
    | undefined;
  name: string | undefined;
  catalogEntries: CharacterSheetInput['catalogEntries'];
}): SheetWarning {
  const proficiency =
    'proficiency' in clause
      ? resolvedPrerequisiteProficiency(clause.proficiency, entry)
      : undefined;
  const fingerprint =
    legacy && 'proficiency' in clause && proficiency
      ? [
          'choice' in clause.proficiency
            ? { choice: true }
            : proficiencyKey(clause.proficiency),
          proficiencyKey(proficiency),
          facts,
          undefined,
        ]
      : [fingerprintClause(clause), facts, undefined];
  return {
    kind: 'rules',
    check: legacy
      ? 'proficiencyPrerequisite'
      : view === 'current'
        ? 'prerequisites.current'
        : 'prerequisites.recordedLevel',
    target: { kind: 'entry', entryId: entry._id },
    subject: legacy
      ? `${entry._id}:${view}:${legacyIndex}`
      : `${entry._id}:${clauseIndex}`,
    fingerprint: JSON.stringify(fingerprint),
    message: `${name ?? 'Entry'}: ${prerequisiteLabel(clause, catalogEntries)} not met ${view === 'current' ? 'now.' : `at level ${position?.classLevel} as recorded.`}`,
  };
}

export function resolveCharacterSheetPrerequisites(
  recordedInput: CharacterSheetInput,
  effectiveInput: CharacterSheetInput,
  currentFacts: PrerequisiteFacts,
  reconstruct: (input: CharacterSheetInput) => PrerequisiteFacts,
) {
  const classFeatureAssociations = buildClassFeatureAssociations(
    effectiveInput.catalogEntries,
  );
  const checks: PrerequisiteCheck[] = [];
  const proficiencyChecks: {
    entryId: string;
    view: 'current' | 'recorded';
    proficiency: ManualProficiency;
    met: boolean;
  }[] = [];
  const warnings: SheetWarning[] = [];
  const sources = buildRecordedPrerequisiteSources({
    input: recordedInput,
    effectiveInput,
  });
  const levelOrders = new Map(
    recordedInput.entries
      .filter((entry) => entry.kind === 'classLevel' && entry.active)
      .map((entry) => [
        entry._id,
        orderedSelectionIdsAtLevel(recordedInput.entries, entry._id),
      ]),
  );
  for (const entry of effectiveInput.entries) {
    if (!entry.active || ignoresPrerequisites(entry, effectiveInput)) continue;
    const definition = definitionFor(entry, effectiveInput);
    if (!definition) continue;
    const clauses = clausesFor(definition);
    if (!clauses.length) continue;
    if (entry.kind === 'classLevel') {
      if (
        definition.detail?.kind !== 'class' ||
        !('classKind' in definition.detail)
      )
        continue;
      const family = characterSheetClassFamily(
        definition,
        effectiveInput.catalogEntries,
      );
      if (
        classFamilyLevels(effectiveInput, family).some(
          (level) => level.state.position < entry.state.position,
        )
      )
        continue;
    }
    const prefix = recordedPrefix({
      entry,
      input: recordedInput,
      effectiveInput,
      sources,
      levelOrders,
    });
    const recordedFacts = prefix ? reconstruct(prefix.input) : undefined;
    for (const [
      clauseIndex,
      { clause, legacy, legacyIndex },
    ] of clauses.entries()) {
      for (const view of ['current', 'recorded'] as const) {
        if (view === 'recorded' && !recordedFacts) continue;
        if (
          entry.kind === 'classLevel' &&
          definition.detail?.kind === 'class' &&
          'classKind' in definition.detail &&
          definition.detail.classKind !== 'prestige' &&
          (view === 'recorded' || !('alignment' in clause))
        )
          continue;
        const evaluation = evaluatePrerequisite(clause, {
          facts:
            view === 'recorded' && recordedFacts ? recordedFacts : currentFacts,
          input: view === 'recorded' && prefix ? prefix.input : effectiveInput,
          entry,
          classFeatureAssociations,
        });
        checks.push({
          entryId: entry._id,
          view,
          clauseIndex,
          clause,
          met: evaluation.met,
        });
        if (legacy && 'proficiency' in clause && evaluation.met !== null) {
          const proficiency = resolvedPrerequisiteProficiency(
            clause.proficiency,
            entry,
          );
          if (proficiency)
            proficiencyChecks.push({
              entryId: entry._id,
              view,
              proficiency,
              met: evaluation.met,
            });
        }
        if (evaluation.met === false)
          warnings.push(
            prerequisiteWarning({
              clause,
              legacy,
              legacyIndex,
              entry,
              view,
              clauseIndex,
              facts: evaluation.facts,
              position: prefix?.position,
              name: definition.name,
              catalogEntries: effectiveInput.catalogEntries,
            }),
          );
      }
    }
  }
  return { checks, proficiencyChecks, warnings };
}
