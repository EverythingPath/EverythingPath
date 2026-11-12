import { z } from 'zod';
import type { CharacterSheetInput, SheetWarning } from './character-sheet';
import type { CompanionLinkedInputResolution } from './character-sheet-linked-inputs';
import type {
  CohortCalculationInput,
  CohortResolution,
  CohortSource,
  LeadershipResult,
} from './character-sheet-cohort-schema';
export type {
  CohortCalculationInput,
  CohortResolution,
} from './character-sheet-cohort-schema';
import { linkedInputKey } from './character-sheet-linked-input-evaluation';
import {
  leadershipCitation,
  leadershipCohortLevel,
  leadershipCohortModifiers,
  leadershipReputationKeySchema,
  leadershipReputationModifiers,
  monsterCohortCitations,
  monsterCohortKeySchema,
  monsterCohorts,
} from './catalog/representative-cohorts';

// A cohort (CRB p. 129, Leadership) is an ordinary Character with its own
// Class Levels. Its Cohort Equivalence is its level for Leadership: its
// Class Levels, plus a monster's published or explicitly entered cohort
// level. It is never its actual Hit Dice or Challenge Rating, and it changes
// no other statistic: Militia Character Facts never read it.

/** Whole cohort levels, beyond any published entry. */
export const maxCohortEquivalence = 30;
export const maxCohortCreatureLength = 64;
/**
 * A monster cohort's recorded equivalence, on the cohort's base entry. A
 * listed creature uses its published level; an unlisted creature needs an
 * explicitly entered one, and `level: null` records the creature while the
 * equivalence is still missing. No record means an ordinary cohort.
 */
export const cohortEquivalenceStateSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('published'),
    creatureKey: monsterCohortKeySchema,
  }),
  z.object({
    kind: z.literal('entered'),
    creature: z.string().trim().min(1).max(maxCohortCreatureLength),
    level: z.number().int().min(1).max(maxCohortEquivalence).nullable(),
  }),
]);
export type CohortEquivalenceState = z.infer<
  typeof cohortEquivalenceStateSchema
>;

export const maxCohortDeaths = 20;
export const maxOtherLeadershipModifier = 20;
/**
 * The Leadership modifiers recorded on a cohort's supporting source: the
 * leader's reputation from this cohort's point of view and the modifiers
 * that apply when attracting a cohort (CRB p. 129). `other` holds modifiers
 * from rules outside the CRB table.
 */
export const leadershipModifiersSchema = z.object({
  reputation: z
    .array(leadershipReputationKeySchema)
    .max(6)
    .refine((keys) => new Set(keys).size === keys.length, {
      message: 'Record each reputation once.',
    }),
  hasCompanion: z.boolean(),
  differentAlignment: z.boolean(),
  cohortDeaths: z.number().int().min(0).max(maxCohortDeaths),
  other: z
    .number()
    .int()
    .min(-maxOtherLeadershipModifier)
    .max(maxOtherLeadershipModifier),
});
export type LeadershipModifiers = z.infer<typeof leadershipModifiersSchema>;

function itemizeModifiers(modifiers: LeadershipModifiers) {
  return [
    ...modifiers.reputation.map((key) => ({
      key,
      ...leadershipReputationModifiers[key],
    })),
    ...(modifiers.hasCompanion
      ? [{ key: 'hasCompanion', ...leadershipCohortModifiers.hasCompanion }]
      : []),
    ...(modifiers.differentAlignment
      ? [
          {
            key: 'differentAlignment',
            ...leadershipCohortModifiers.differentAlignment,
          },
        ]
      : []),
    ...(modifiers.cohortDeaths
      ? [
          {
            key: 'cohortDeaths',
            label:
              modifiers.cohortDeaths === 1
                ? leadershipCohortModifiers.cohortDeaths.label
                : `Caused the death of ${modifiers.cohortDeaths} cohorts`,
            value:
              leadershipCohortModifiers.cohortDeaths.value *
              modifiers.cohortDeaths,
          },
        ]
      : []),
    ...(modifiers.other
      ? [{ key: 'other', label: 'Other modifiers', value: modifiers.other }]
      : []),
  ];
}

/**
 * CRB p. 129: the Leadership Score is the leader's level plus Charisma
 * modifier plus the recorded modifiers. A cohort is attracted at most at
 * the table's level for that score and two levels below the leader; after
 * recruitment only the second limit persists. Null modifiers are
 * unresolved; any unresolved input leaves its results null.
 */
export function calculateLeadership({
  characterLevel,
  charismaModifier,
  modifiers,
}: {
  characterLevel: number | null;
  charismaModifier: number | null;
  modifiers: LeadershipModifiers | null;
}): LeadershipResult {
  const rows = modifiers ? itemizeModifiers(modifiers) : [];
  const modifierTotal = modifiers
    ? rows.reduce((sum, row) => sum + row.value, 0)
    : null;
  const score =
    characterLevel === null ||
    charismaModifier === null ||
    modifierTotal === null
      ? null
      : characterLevel + charismaModifier + modifierTotal;
  const scoreLevel = score === null ? null : leadershipCohortLevel(score);
  const leaderLevelLimit =
    characterLevel === null ? null : Math.max(0, characterLevel - 2);
  return {
    modifiers: rows,
    modifierTotal,
    score,
    scoreLevel,
    leaderLevelLimit,
    maximumLevel:
      scoreLevel === null || leaderLevelLimit === null
        ? null
        : Math.min(scoreLevel, leaderLevelLimit),
  };
}

/** No recorded Leadership modifiers: the base score applies. */
export const noLeadershipModifiers: LeadershipModifiers = {
  reputation: [],
  hasCompanion: false,
  differentAlignment: false,
  cohortDeaths: 0,
  other: 0,
};
/**
 * The counting sources' recorded modifiers: none recorded means none
 * apply; differing records are a conflict, resolved by no source order.
 */
function countingModifiers(sources: readonly CohortSource[]) {
  const recorded = sources.flatMap((source) =>
    source.counting
      ? [source.leadershipModifiers ?? noLeadershipModifiers]
      : [],
  );
  const [first = noLeadershipModifiers] = recorded;
  const key = JSON.stringify(normalizeModifiers(first));
  const conflict = recorded.some(
    (modifiers) => JSON.stringify(normalizeModifiers(modifiers)) !== key,
  );
  return { modifiers: conflict ? null : first, conflict };
}
function normalizeModifiers(modifiers: LeadershipModifiers) {
  return { ...modifiers, reputation: [...modifiers.reputation].sort() };
}

function leaderInput(
  linkedInputs: readonly CompanionLinkedInputResolution[],
  input: CompanionLinkedInputResolution['input'],
) {
  const key = linkedInputKey(input);
  const matching = linkedInputs.filter(
    (resolution) => linkedInputKey(resolution.input) === key,
  );
  const [resolution] = matching;
  // Duplicate declarations stay unresolved, so list order never chooses.
  if (!resolution || matching.length !== 1)
    return {
      value: null,
      resolution: 'unresolved' as const,
      fallbackState: 'none' as const,
    };
  return {
    value: resolution.value,
    resolution: resolution.resolution,
    fallbackState: resolution.fallbackState,
  };
}

function resolveEquivalence(
  input: CharacterSheetInput,
  {
    classLevels,
    racialHitDice,
  }: { classLevels: number; racialHitDice: number },
): CohortResolution['equivalence'] {
  const state = input.cohortEquivalence;
  if (state?.kind === 'published') {
    const creature = monsterCohorts[state.creatureKey];
    return {
      basis: 'published',
      creatureKey: state.creatureKey,
      creature: creature.name,
      creatureLevel: creature.level,
      classLevels,
      value: creature.level + classLevels,
      missing: false,
      citation: monsterCohortCitations[creature.book],
    };
  }
  if (state?.kind === 'entered')
    return {
      basis: 'entered',
      creatureKey: null,
      creature: state.creature,
      creatureLevel: state.level,
      classLevels,
      value: state.level === null ? null : state.level + classLevels,
      missing: state.level === null,
      citation: null,
    };
  // A creature with Racial Hit Dice is not an ordinary cohort, and its Hit
  // Dice are never its equivalence.
  return {
    basis: 'classLevels',
    creatureKey: null,
    creature: null,
    creatureLevel: null,
    classLevels,
    value: racialHitDice > 0 ? null : classLevels,
    missing: racialHitDice > 0,
    citation: null,
  };
}

/**
 * A cohort's equivalence and, while a cohort relationship supports it, the
 * level its leader allows. Null for a Character that is neither linked as a
 * cohort nor records an equivalence.
 */
export function resolveCohort({
  input,
  cohort,
  classLevels,
  racialHitDice,
}: {
  input: CharacterSheetInput;
  cohort: CohortCalculationInput | undefined;
  classLevels: number;
  racialHitDice: number;
}): CohortResolution | null {
  if (!cohort && !input.cohortEquivalence) return null;
  const equivalence = resolveEquivalence(input, { classLevels, racialHitDice });
  const sources = [
    leadershipCitation,
    ...(equivalence.citation ? [equivalence.citation] : []),
  ];
  const status = !cohort
    ? 'unlinked'
    : cohort.sources.some((source) => source.counting)
      ? 'active'
      : 'dormant';
  if (!cohort || status !== 'active')
    return { status, equivalence, leadership: null, overLevel: false, sources };
  const characterLevel = leaderInput(cohort.linkedInputs, {
    kind: 'characterLevel',
  });
  const charismaModifier = leaderInput(cohort.linkedInputs, {
    kind: 'abilityModifier',
    ability: 'charisma',
  });
  // Undisclosed modifiers leave the score unresolved rather than wrong.
  const areModifiersUndisclosed = cohort.areModifiersUndisclosed === true;
  const { modifiers, conflict } = areModifiersUndisclosed
    ? { modifiers: null, conflict: false }
    : countingModifiers(cohort.sources);
  const leadership = calculateLeadership({
    characterLevel: characterLevel.value,
    charismaModifier: charismaModifier.value,
    modifiers,
  });
  return {
    status,
    equivalence,
    leadership: {
      ...leadership,
      characterLevel,
      charismaModifier,
      conflict,
      areModifiersUndisclosed,
    },
    // CRB p. 129 consults the table only when a cohort is attracted; after
    // recruitment only "two or more levels lower than yourself" persists.
    overLevel:
      equivalence.value !== null &&
      leadership.leaderLevelLimit !== null &&
      equivalence.value > leadership.leaderLevelLimit,
    sources,
  };
}

export function cohortWarnings(
  input: CharacterSheetInput,
  cohort: CohortResolution | null,
): SheetWarning[] {
  const entry = input.entries.find((item) => item.kind === 'base');
  if (!cohort || !entry) return [];
  const warn = (
    kind: SheetWarning['kind'],
    check: SheetWarning['check'],
    message: string,
    facts: unknown,
  ): SheetWarning => ({
    kind,
    check,
    subject: 'cohort',
    target: { kind: 'entry', entryId: entry._id },
    message,
    fingerprint: JSON.stringify(facts),
  });
  const warnings: SheetWarning[] = [];
  const { equivalence, leadership } = cohort;
  if (equivalence.missing)
    warnings.push(
      warn(
        'unresolved',
        'cohortEquivalenceMissing',
        equivalence.creature
          ? `Enter the Cohort Equivalence for ${equivalence.creature}. An unlisted creature needs an explicit equivalence; its Hit Dice and Challenge Rating are never used.`
          : 'This cohort has Racial Hit Dice. Choose a published monster cohort or enter its Cohort Equivalence; its Hit Dice are never used.',
        [equivalence.basis, equivalence.creature, equivalence.classLevels],
      ),
    );
  // The leader's inputs and a conflict are what a reader can resolve;
  // undisclosed modifiers leave only the informational score unresolved.
  if (
    leadership &&
    (leadership.characterLevel.value === null ||
      leadership.charismaModifier.value === null ||
      leadership.conflict)
  )
    warnings.push(
      warn(
        'unresolved',
        'cohortLeadershipUnresolved',
        leadership.conflict
          ? 'The cohort’s supporting sources record different Leadership modifiers, so its leader’s Leadership Score is unresolved.'
          : 'The level this cohort’s leader allows and the leader’s Leadership Score need the leader’s character level and Charisma modifier. Save fallbacks while they are unavailable.',
        [
          leadership.characterLevel.value,
          leadership.charismaModifier.value,
          leadership.conflict,
        ],
      ),
    );
  if (leadership && cohort.overLevel)
    warnings.push(
      warn(
        'rules',
        'cohortOverLevel',
        `Cohort Equivalence ${equivalence.value} is above what its leader allows: a cohort stays two or more levels below its leader, so ${leadership.leaderLevelLimit}. Its Class Levels are kept.`,
        [equivalence.value, leadership.leaderLevelLimit],
      ),
    );
  return warnings;
}
