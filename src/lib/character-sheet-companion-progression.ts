import { z } from 'zod';
import {
  animalCompanionClassSkills,
  animalCompanionSources,
  animalCompanionTable,
  animalCompanionSpeciesSchema,
  alternativeAnimalCompanionAdvancement,
  cavalierMountProficiencies,
  representativeAnimalCompanions,
} from './catalog/representative-animal-companions';
import { representativeCompanionRules } from './catalog/representative-companion-rules';
import {
  abilityKeys,
  abilityTargets,
  companionUnresolvedAbilities,
} from './character-sheet-abilities';
import { creatureSizes } from './character-sheet-creature-sizes';
import {
  animalProgressionRuleKinds,
  combinedEffectiveLevel,
  companionContributionSchema,
  companionProgressionSourceSchema,
  companionSkillRanksSchema,
  isCompanionProgressionRuleKind,
  progressionContributions,
  type CompanionContribution,
  type CompanionProgressionSource,
} from './character-sheet-companion-sources';
import {
  eidolonProgressionResolutionSchema,
  eidolonProgressionStateSchema,
  eidolonProgressionSummary,
  isEidolonState,
  resolveEidolonProgression,
} from './character-sheet-eidolon-progression';
import type { CompanionLinkedInputResolution } from './character-sheet-linked-inputs';
import type {
  CharacterSheetInput,
  InputSourcedModifier,
} from './character-sheet';

export const animalCompanionProgressionStateSchema = z.object({
  species: animalCompanionSpeciesSchema,
  hpGained: z.number().finite().nullable(),
  skillRanks: companionSkillRanksSchema,
  abilityIncreases: z.array(z.enum(abilityKeys)),
  advancementChoice: z.enum(['species', 'abilityScores']),
  keep: z.boolean(),
});
export type AnimalCompanionProgressionState = z.infer<
  typeof animalCompanionProgressionStateSchema
>;
/** A Companion's recorded progression choices, by progression kind. */
export const companionProgressionStateSchema = z.union([
  eidolonProgressionStateSchema,
  animalCompanionProgressionStateSchema,
]);
export type CompanionProgressionState = z.infer<
  typeof companionProgressionStateSchema
>;
export {
  companionProgressionSourceSchema,
  isCompanionProgressionRuleKind,
  type CompanionProgressionSource,
};
export const animalCompanionProgressionResolutionSchema = z.object({
  kind: z.literal('animal'),
  status: z.enum(['active', 'dormant', 'unresolved']),
  species: animalCompanionSpeciesSchema,
  effectiveLevel: z.number().nullable(),
  hitDice: z.number().nullable(),
  size: z.enum(creatureSizes),
  advancement: z.object({
    level: z.number(),
    applied: z.boolean(),
    choice: z.enum(['species', 'abilityScores']),
  }),
  contributions: z.array(companionContributionSchema),
  budgets: z.object({
    generalFeats: z.number().nullable(),
    skillRanks: z.number().nullable(),
    abilityIncreases: z.number().nullable(),
  }),
  bonusTricks: z.number().nullable(),
  features: z.array(z.string()),
  sources: z.array(
    z.object({ book: z.string(), pages: z.string(), url: z.string() }),
  ),
  restrictions: z.array(z.string()),
  unresolvedStatistics: z.array(z.string()),
  retained: z.boolean(),
});
export type AnimalCompanionProgressionResolution = z.infer<
  typeof animalCompanionProgressionResolutionSchema
>;
export const companionProgressionResolutionSchema = z.discriminatedUnion(
  'kind',
  [
    animalCompanionProgressionResolutionSchema,
    eidolonProgressionResolutionSchema,
  ],
);
export type CompanionProgressionResolution = z.infer<
  typeof companionProgressionResolutionSchema
>;

type CompanionTableRow = (typeof animalCompanionTable)[number];

/**
 * One progression calculation per recorded kind. Each kind reads only its own
 * supporting sources, so an animal source never advances an eidolon.
 */
export function resolveCompanionProgression({
  state,
  sources = [],
  linkedInputs = [],
  entries = [],
  catalogEntries = [],
}: {
  state?: CompanionProgressionState;
  sources?: readonly CompanionProgressionSource[];
  linkedInputs?: readonly CompanionLinkedInputResolution[];
  entries?: CharacterSheetInput['entries'];
  catalogEntries?: CharacterSheetInput['catalogEntries'];
}) {
  if (!state) return null;
  if (isEidolonState(state))
    return resolveEidolonProgression({
      state,
      sources,
      linkedInputs,
      entries,
      catalogEntries,
    });
  return resolveAnimalProgression({ state, sources, linkedInputs });
}

function resolveAnimalProgression({
  state,
  sources,
  linkedInputs,
}: {
  state: AnimalCompanionProgressionState;
  sources: readonly CompanionProgressionSource[];
  linkedInputs: readonly CompanionLinkedInputResolution[];
}) {
  const species = representativeAnimalCompanions[state.species];
  const contributions = progressionContributions({
    sources,
    linkedInputs,
    ruleKinds: animalProgressionRuleKinds,
  });
  const counting = contributions.filter((source) => source.counting);
  const effectiveLevel = combinedEffectiveLevel(counting);
  const row =
    effectiveLevel !== null &&
    Number.isInteger(effectiveLevel) &&
    effectiveLevel > 0
      ? animalCompanionTable[effectiveLevel - 1]
      : undefined;
  const status =
    counting.length === 0 || effectiveLevel === 0
      ? 'dormant'
      : row
        ? 'active'
        : 'unresolved';
  const applied =
    row !== undefined &&
    effectiveLevel !== null &&
    effectiveLevel >= species.advancement.level;
  const result = baseProgressionResolution({
    state,
    contributions,
    counting,
    effectiveLevel,
    row,
    status,
    applied,
  });
  const hasMountSource = contributions.some(
    (source) => source.counting && source.ruleKind === 'cavalierMount',
  );
  const hasOtherSource = contributions.some(
    (source) => source.counting && source.ruleKind !== 'cavalierMount',
  );
  const features = [
    ...result.features.filter(
      (feature) =>
        hasOtherSource || !hasMountSource || feature !== 'Share spells',
    ),
    ...(state.species === 'horse' &&
    applied &&
    state.advancementChoice === 'species'
      ? ['Combat trained']
      : []),
    ...(hasMountSource && row
      ? ['Combat trained', 'Light Armor Proficiency']
      : []),
  ];
  const restrictions = [
    ...(contributions.some(
      (source) =>
        source.counting &&
        source.classRuleIdentity === 'ranger' &&
        source.kind !== 'allocation',
    )
      ? [
          'Hunter’s bond requires Ranger level 4; the companion shares favored enemy and favored terrain bonuses while the ranger is present.',
        ]
      : []),
    ...(hasMountSource
      ? [
          'A Medium cavalier normally chooses a horse or camel; a Small cavalier chooses a pony or wolf. A mount has no share spells and counts as combat trained with Light Armor Proficiency.',
        ]
      : []),
    ...new Set(
      contributions.flatMap((source) => {
        if (!source.counting) return [];
        const rule = representativeCompanionRules[source.ruleKind];
        const restriction =
          rule.allocation?.restriction ?? rule.increase?.restriction;
        return restriction ? [restriction] : [];
      }),
    ),
  ];
  return {
    ...result,
    features: [...new Set(features)],
    restrictions,
    modifiers: progressionModifiers({ state, row, applied }),
    proficiencies:
      hasMountSource && row
        ? cavalierMountProficiencies.map((proficiency) => ({
            proficiency,
            entryId: 'builtin:companion:mount',
            name: 'Cavalier mount',
          }))
        : [],
    classSkills: animalCompanionClassSkills,
    multiattack: false,
    state,
  };
}

function baseProgressionResolution({
  state,
  contributions,
  counting,
  effectiveLevel,
  row,
  status,
  applied,
}: {
  state: AnimalCompanionProgressionState;
  contributions: CompanionContribution[];
  counting: CompanionContribution[];
  effectiveLevel: number | null;
  row: CompanionTableRow | undefined;
  status: AnimalCompanionProgressionResolution['status'];
  applied: boolean;
}): AnimalCompanionProgressionResolution {
  const species = representativeAnimalCompanions[state.species];
  return {
    kind: 'animal',
    status,
    species: state.species,
    effectiveLevel: counting.length ? effectiveLevel : null,
    hitDice: row?.hitDice ?? null,
    size:
      applied && state.advancementChoice === 'species'
        ? species.advancement.size
        : species.size,
    advancement: {
      level: species.advancement.level,
      applied,
      choice: state.advancementChoice,
    },
    contributions,
    budgets: {
      generalFeats: row ? Math.ceil(row.hitDice / 2) : null,
      skillRanks: null,
      abilityIncreases:
        row && effectiveLevel !== null
          ? [4, 9, 14, 20].filter((level) => level <= effectiveLevel).length
          : null,
    },
    bonusTricks: row?.bonusTricks ?? null,
    features:
      row && effectiveLevel !== null
        ? [
            'Link',
            'Share spells',
            ...(effectiveLevel >= 3 ? ['Evasion'] : []),
            ...(effectiveLevel >= 6 ? ['Devotion'] : []),
            ...(effectiveLevel >= 9 ? ['Multiattack'] : []),
            ...(effectiveLevel >= 15 ? ['Improved evasion'] : []),
          ]
        : [],
    sources: animalCompanionSources,
    restrictions: [],
    retained: state.keep,
    unresolvedStatistics:
      status === 'active'
        ? state.hpGained === null
          ? ['maximumHp']
          : []
        : [
            'actualHitDice',
            'baseAttackBonus',
            'maximumHp',
            ...companionUnresolvedAbilities.map(
              (ability) => abilityTargets[ability],
            ),
            'ac.natural',
            'save.fort',
            'save.ref',
            'save.will',
          ],
  };
}

function progressionModifiers({
  state,
  row,
  applied,
}: {
  state: AnimalCompanionProgressionState;
  row: CompanionTableRow | undefined;
  applied: boolean;
}): InputSourcedModifier[] {
  const species = representativeAnimalCompanions[state.species];
  const modifiers: InputSourcedModifier[] = [];
  const add = (
    target: InputSourcedModifier['target'],
    value: number,
    name: string,
    bonusType: InputSourcedModifier['bonusType'] = 'untyped',
  ) =>
    modifiers.push({
      target,
      value,
      bonusType,
      sheetEntryId: `builtin:companion:${state.species}:${modifiers.length}`,
      entryName: name,
      source: `companion:${state.species}:${modifiers.length}`,
      builtIn: true,
    });
  if (row) {
    add('bab', row.bab, 'Animal Companion BAB');
    add('save.fort', row.goodSave, 'Animal Companion Fortitude');
    add('save.ref', row.goodSave, 'Animal Companion Reflex');
    add('save.will', row.poorSave, 'Animal Companion Will');
    add('ability.str', row.strengthDexterity, 'Animal Companion Strength');
    add('ability.dex', row.strengthDexterity, 'Animal Companion Dexterity');
    add(
      'ac.natural',
      species.naturalArmor +
        row.naturalArmor +
        (applied && state.advancementChoice === 'species'
          ? species.advancement.naturalArmor
          : 0),
      'Animal Companion natural armor',
      'naturalArmor',
    );
    if (state.hpGained !== null)
      add('hp', state.hpGained, 'Animal Companion hit points');
    if (applied) {
      if (state.advancementChoice === 'abilityScores') {
        add(
          'ability.dex',
          alternativeAnimalCompanionAdvancement.dexterity,
          'Alternative species advancement',
        );
        add(
          'ability.con',
          alternativeAnimalCompanionAdvancement.constitution,
          'Alternative species advancement',
        );
      } else {
        add(
          'ability.str',
          species.advancement.scores.strength,
          'Species advancement',
        );
        add(
          'ability.dex',
          species.advancement.scores.dexterity,
          'Species advancement',
        );
        add(
          'ability.con',
          species.advancement.scores.constitution,
          'Species advancement',
        );
      }
    }
  }
  if (row || state.keep)
    for (const ability of state.abilityIncreases)
      add(abilityTargets[ability], 1, 'Companion ability increase');
  return modifiers;
}

export function companionProgressionSummary(
  progression: ReturnType<typeof resolveCompanionProgression>,
  skillRanks: number | null,
): CompanionProgressionResolution | null {
  if (!progression) return null;
  if (progression.kind === 'eidolon')
    return eidolonProgressionSummary(progression, skillRanks);
  const {
    modifiers: _modifiers,
    classSkills: _classSkills,
    state: _state,
    proficiencies: _proficiencies,
    multiattack: _multiattack,
    ...summary
  } = progression;
  return {
    ...summary,
    budgets: {
      ...summary.budgets,
      skillRanks: summary.status === 'active' ? skillRanks : null,
    },
  };
}

export { companionProgressionWarnings } from './character-sheet-companion-warnings';
