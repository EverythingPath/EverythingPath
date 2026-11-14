import { z } from 'zod';
import {
  eidolonAbilityIncreaseLevels,
  eidolonBaseFormKeys,
  eidolonBaseForms,
  eidolonBaseStatistics,
  eidolonChoiceOptionLabel,
  eidolonChoiceOptions,
  eidolonClassSkills,
  eidolonEvolutionKeySchema,
  eidolonEvolutions,
  eidolonFeatures,
  eidolonSizeEvolutions,
  eidolonSources,
  saveNames,
  smallEidolonAdjustments,
  type EidolonBaseFormKey,
  type EidolonBaseStatisticsRow,
  type EidolonEvolutionKey,
} from './catalog/representative-eidolons';
import {
  unchainedEidolonBaseStatistics,
  unchainedEidolonEvolutions,
  unchainedEidolonSizeEvolutions,
  unchainedEidolonSources,
  unchainedEidolonSubtypeKeys,
  unchainedEidolonSubtypes,
  unchainedSubtypeBaseForms,
  unchainedSubtypeChoiceKeys,
  unchainedSubtypeChoiceOptions,
  type UnchainedEidolonSubtypeKey,
  type UnchainedEvolutionDefinition,
  type UnchainedSubtypeChoiceKey,
} from './catalog/representative-unchained-eidolons';
import {
  abilityKeys,
  abilityTargets,
  companionUnresolvedAbilities,
} from './character-sheet-abilities';
import {
  naturalAttackRoles,
  naturalAttackTypes,
  type NaturalAttackType,
} from './character-sheet-attack-types';
import {
  citationsFor,
  combinedEffectiveLevel,
  companionContributionSchema,
  companionProgressionSourceSchema,
  companionSkillRanksSchema,
  eidolonProgressionRuleKinds,
  getCompanionFusionRule,
  getCompanionReductionRule,
  isCompanionFusedRuleKind,
  progressionContributions,
  type CompanionContribution,
  type CompanionProgressionSource,
} from './character-sheet-companion-sources';
import {
  companionAllocatedComponentsSchema,
  companionComponentKeys,
  companionComponentPoolSchema,
  companionComponentsSchema,
  companionGroupPurchaseSchema,
  completeComponents,
  largestBroodSize,
  overBudgetComponents,
  resolveGroupPurchases,
  type CompanionComponents,
} from './character-sheet-companion-components';
import {
  creatureSizes,
  type CreatureSize,
} from './character-sheet-creature-sizes';
import { skillDefinitions } from './character-sheet-skill-definitions';
import type { ManualProficiency } from './character-sheet-proficiency-schema';
import type { CompanionLinkedInputResolution } from './character-sheet-linked-inputs';
import type {
  CharacterSheetInput,
  InputSourcedModifier,
  ModifierTarget,
} from './character-sheet';
import { scaleAttackDice } from './character-sheet-natural-attacks';
import { listAlternatives, ordinal } from './character-sheet-spell-labels';

const skillKeys = skillDefinitions.map(({ key }) => key);
const canonicalSkill = (key: string) =>
  key.startsWith('skill.') ? key : `skill.${key}`;

export const eidolonEvolutionSelectionSchema = z.object({
  key: eidolonEvolutionKeySchema,
  choice: z.string().trim().min(1).max(64).optional(),
  upgrades: z.number().int().min(1).max(20).optional(),
});
export type EidolonEvolutionSelection = z.infer<
  typeof eidolonEvolutionSelectionSchema
>;

// The APG list offers every choice and upgrade the Unchained list does, so it
// decides structural validity for both versions.
function choiceOptions(
  key: EidolonEvolutionKey,
  definitions: Record<
    EidolonEvolutionKey,
    UnchainedEvolutionDefinition
  > = eidolonEvolutions,
): readonly string[] | null {
  const kind = definitions[key].choice;
  if (!kind) return null;
  return kind === 'skill'
    ? skillKeys
    : eidolonChoiceOptions[kind].map((option) => option.value);
}

/** “1 point”, “2 points”: one evolution point count for every message. */
export function pointCount(count: number) {
  return `${count} ${count === 1 ? 'point' : 'points'}`;
}

export const eidolonVersions = ['original', 'unchained'] as const;
export type EidolonVersion = (typeof eidolonVersions)[number];
export const unchainedSubtypeChoiceSchema = z.object({
  key: z.enum(unchainedSubtypeChoiceKeys),
  choice: z.string().trim().min(1).max(64),
});

/**
 * The eidolon's recorded choices. Base form, evolutions, ranks and ability
 * increases stay on the Companion; the evolution pool belongs to the summoner.
 * `version` picks the original (APG, the default) or Unchained rules; the
 * Unchained subtype and its choices stay recorded under either version.
 * Unknown evolutions, choices and upgrades are structural errors in both
 * versions; every rules mismatch is an advisory warning.
 */
export const eidolonProgressionStateSchema = z
  .object({
    kind: z.literal('eidolon'),
    version: z.enum(eidolonVersions).optional(),
    subtype: z.enum(unchainedEidolonSubtypeKeys).optional(),
    subtypeChoices: z.array(unchainedSubtypeChoiceSchema).max(16).optional(),
    baseForm: z.enum(eidolonBaseFormKeys),
    size: z.enum(['medium', 'small']),
    hpGained: z.number().finite().nullable(),
    skillRanks: companionSkillRanksSchema,
    abilityIncreases: z.array(z.enum(abilityKeys)).max(20),
    classSkills: z
      .array(z.string())
      .max(36)
      .transform((skills) => skills.map(canonicalSkill)),
    armorBonusAsArmor: z.number().int().nonnegative().max(99),
    evolutions: z.array(eidolonEvolutionSelectionSchema).max(64),
    keep: z.boolean(),
  })
  .superRefine((state, context) => {
    (state.subtypeChoices ?? []).forEach(({ key, choice }, index) => {
      if (
        !unchainedSubtypeChoiceOptions[key].options.some(
          (option) => option.value === choice,
        )
      )
        context.addIssue({
          code: 'custom',
          path: ['subtypeChoices', index, 'choice'],
          message: 'Choose an option this subtype offers.',
        });
      if (state.subtypeChoices?.findIndex((item) => item.key === key) !== index)
        context.addIssue({
          code: 'custom',
          path: ['subtypeChoices', index, 'key'],
          message: 'Record each subtype choice once.',
        });
    });
    state.classSkills.forEach((skill, index) => {
      if (!skillKeys.some((key) => key === skill))
        context.addIssue({
          code: 'custom',
          path: ['classSkills', index],
          message: 'Choose a known skill.',
        });
      if (state.classSkills.indexOf(skill) !== index)
        context.addIssue({
          code: 'custom',
          path: ['classSkills', index],
          message: 'Choose each class skill once.',
        });
    });
    state.evolutions.forEach((selection, index) => {
      const definition = eidolonEvolutions[selection.key];
      const options = choiceOptions(selection.key);
      if (
        selection.choice !== undefined &&
        !options?.includes(
          definition.choice === 'skill'
            ? canonicalSkill(selection.choice)
            : selection.choice,
        )
      )
        context.addIssue({
          code: 'custom',
          path: ['evolutions', index, 'choice'],
          message: `Choose an option this evolution offers.`,
        });
      if (
        selection.upgrades !== undefined &&
        (!definition.upgrade || selection.upgrades > definition.upgrade.max)
      )
        context.addIssue({
          code: 'custom',
          path: ['evolutions', index, 'upgrades'],
          message: 'Choose an upgrade this evolution offers.',
        });
    });
  });
export type EidolonProgressionState = z.infer<
  typeof eidolonProgressionStateSchema
>;

export function isEidolonState<T extends object>(
  state: T,
): state is Extract<T, { kind: 'eidolon' }> {
  return 'kind' in state && state.kind === 'eidolon';
}

const nullableNumber = z.number().nullable();
export const eidolonEvolutionOrigins = [
  'baseForm',
  'subtype',
  'chosen',
] as const;
export const eidolonProgressionResolutionSchema = z.object({
  kind: z.literal('eidolon'),
  version: z.enum(eidolonVersions),
  /** Supporting summoner levels count only for their own version's eidolon. */
  versionMismatch: z.boolean(),
  status: z.enum(['active', 'dormant', 'unresolved']),
  baseForm: z.enum(eidolonBaseFormKeys),
  /** The counting Unchained subtype; null for an original eidolon. */
  subtype: z
    .object({
      key: z.enum(unchainedEidolonSubtypeKeys),
      name: z.string(),
      alignment: z.string(),
      element: z.string().nullable(),
      baseForms: z.array(z.enum(eidolonBaseFormKeys)),
      missingChoices: z.array(z.enum(unchainedSubtypeChoiceKeys)),
    })
    .nullable(),
  /** Recorded subtype state that does not count under the current rules. */
  dormantChoices: z.array(
    z.object({
      kind: z.enum(['subtype', 'subtypeChoice']),
      key: z.string(),
      label: z.string(),
      choice: z.string().nullable(),
      reason: z.enum(['version', 'subtype']),
    }),
  ),
  /** Original-summoner Archetypes never assumed to apply to this eidolon. */
  unsupportedArchetypes: z.array(z.string()),
  /** The summoner level that keys Table 2–9. */
  effectiveLevel: nullableNumber,
  hitDice: nullableNumber,
  size: z.enum(creatureSizes),
  contributions: z.array(companionContributionSchema),
  budgets: z.object({
    generalFeats: nullableNumber,
    skillRanks: nullableNumber,
    abilityIncreases: nullableNumber,
    maxAttacks: nullableNumber,
  }),
  /** The supporting sources' pool; the Companion records only its spending. */
  evolutionPool: z.object({
    total: nullableNumber,
    spent: z.number(),
    remaining: nullableNumber,
    /** Points the Unchained subtype adds, included in the total. */
    bonuses: z.array(z.object({ label: z.string(), points: z.number() })),
    sources: z.array(
      z.object({
        sourceKey: z.string(),
        ruleKind: companionProgressionSourceSchema.shape.ruleKind,
        classRuleIdentity: z.string(),
        points: z.number(),
      }),
    ),
  }),
  evolutions: z.array(
    z.object({
      key: eidolonEvolutionKeySchema,
      name: z.string(),
      choice: z.string().nullable(),
      upgrades: z.number(),
      cost: z.number(),
      /**
       * A brood eidolon's large evolution, paid once for the brood by the
       * huge group purchase rather than from its own points (UM p. 78).
       */
      paidByGroup: z.boolean(),
      free: z.boolean(),
      /** A base form or subtype evolution is fixed: it cannot be removed. */
      origin: z.enum(eidolonEvolutionOrigins),
      /** The summoner level a subtype evolution arrives at. */
      level: nullableNumber,
      /** The subtype choice this subtype evolution asks for, if any. */
      choiceKey: z.enum(unchainedSubtypeChoiceKeys).nullable(),
      missingChoice: z.boolean(),
      /** Recorded parts these rules do not offer: kept, but not counting. */
      dormant: z.array(z.enum(['choice', 'upgrades'])),
      issues: z.array(z.string()),
    }),
  ),
  naturalAttacks: z.array(
    z.object({
      type: z.enum(naturalAttackTypes),
      name: z.string(),
      count: z.number(),
      role: z.enum(naturalAttackRoles),
      dice: z.string().nullable(),
      evolutions: z.array(
        z.object({ key: eidolonEvolutionKeySchema, free: z.boolean() }),
      ),
      recorded: z.number(),
    }),
  ),
  attackCount: z.number(),
  multiattack: z.boolean(),
  armor: z.object({
    total: nullableNumber,
    armor: nullableNumber,
    natural: nullableNumber,
  }),
  /** Null while a brood divides it into Strength and Dexterity shares. */
  strengthDexterityBonus: nullableNumber,
  /**
   * A Broodmaster eidolon's divided components (UM p. 78): its own recorded
   * shares replace the table's per-HD outputs; BAB and saves stay whole.
   * Budget, pool and group purchases need access to the summoner.
   */
  brood: z
    .object({
      components: companionAllocatedComponentsSchema.nullable(),
      missing: z.array(z.enum(companionComponentKeys)),
      budget: companionComponentsSchema.nullable(),
      pool: companionComponentPoolSchema.nullable(),
      overBudgetComponents: z.array(z.enum(companionComponentKeys)),
      groupPurchases: z.array(companionGroupPurchaseSchema).nullable(),
      /** The largest eidolon the brood's group purchases allow. */
      largestSize: z.enum(creatureSizes).nullable(),
    })
    .nullable(),
  classSkills: z.array(z.string()),
  features: z.array(z.string()),
  sources: z.array(
    z.object({ book: z.string(), pages: z.string(), url: z.string() }),
  ),
  restrictions: z.array(z.string()),
  unresolvedStatistics: z.array(z.string()),
  retained: z.boolean(),
});
export type EidolonProgressionResolution = z.infer<
  typeof eidolonProgressionResolutionSchema
>;

type Origin = (typeof eidolonEvolutionOrigins)[number];
type Occurrence = EidolonEvolutionSelection & {
  free: boolean;
  origin: Origin;
  level?: number;
  choiceKey?: UnchainedSubtypeChoiceKey;
};
type Definitions = Record<EidolonEvolutionKey, UnchainedEvolutionDefinition>;
type SizeEvolutions = typeof eidolonSizeEvolutions;

/** Each version's table, evolution list, size rules and citations. */
const versionRules: Record<
  EidolonVersion,
  {
    /** The supporting rule kinds of this version's summoner levels. */
    ruleKinds: readonly CompanionProgressionSource['ruleKind'][];
    table: readonly EidolonBaseStatisticsRow[];
    definitions: Definitions;
    sizes: SizeEvolutions;
    sources: EidolonProgressionResolution['sources'];
    label: string;
  }
> = {
  original: {
    // Broodmaster (UM p. 78), Master Summoner (UM p. 80) and Synthesist
    // (UM pp. 80–81) are original-summoner Archetypes.
    ruleKinds: [
      'eidolon',
      'broodmasterEidolon',
      'masterSummonerEidolon',
      'synthesistEidolon',
    ],
    table: eidolonBaseStatistics,
    definitions: eidolonEvolutions,
    sizes: eidolonSizeEvolutions,
    sources: eidolonSources,
    label: 'original',
  },
  unchained: {
    ruleKinds: ['unchainedEidolon'],
    table: unchainedEidolonBaseStatistics,
    definitions: unchainedEidolonEvolutions,
    sizes: unchainedEidolonSizeEvolutions,
    sources: unchainedEidolonSources,
    label: 'Unchained',
  },
};
/** The supporting rule kinds whose summoner levels advance this version. */
export function eidolonVersionRuleKinds(version: EidolonVersion) {
  return versionRules[version].ruleKinds;
}
export function eidolonVersionOf(state: EidolonProgressionState) {
  return state.version ?? 'original';
}
const sizeOrder = [...creatureSizes];
const formNames = (forms: readonly EidolonBaseFormKey[]) =>
  forms.map((form) => eidolonBaseForms[form].name).join(' or ');

function chosenSize(
  state: EidolonProgressionState,
  chosen: readonly Occurrence[],
): CreatureSize {
  const large = chosen.find((selection) => selection.key === 'large');
  if (!large) return state.size;
  return (large.upgrades ?? 0) > 0 ? 'huge' : 'large';
}

/**
 * The size the eidolon's recorded choices give it, as the resolver sizes it:
 * its large evolution, upgraded to Huge, or its recorded size.
 */
export function eidolonSize(state: EidolonProgressionState): CreatureSize {
  const { definitions } = versionRules[eidolonVersionOf(state)];
  return chosenSize(state, chosenEvolutions(state, definitions).chosen);
}

function evolutionCost({
  selection,
  size,
  definitions,
  paidByGroup = false,
}: {
  selection: Occurrence;
  size: CreatureSize;
  definitions: Definitions;
  /** The evolution's own cost was paid from a brood's pool before division. */
  paidByGroup?: boolean;
}) {
  if (selection.free) return 0;
  const definition = definitions[selection.key];
  const doubled =
    selection.key === 'abilityIncrease' &&
    (size === 'large' || size === 'huge') &&
    (selection.choice === 'strength' || selection.choice === 'constitution');
  const base = doubled ? 4 : definition.cost;
  return (
    (paidByGroup ? 0 : base) +
    (selection.choice ? (definition.choiceCosts?.[selection.choice] ?? 0) : 0) +
    (selection.upgrades ?? 0) * (definition.upgrade?.cost ?? 0)
  );
}

type IssueContext = {
  selection: Occurrence;
  /** The chosen evolutions recorded before this one. */
  earlier: readonly Occurrence[];
  all: readonly Occurrence[];
  state: EidolonProgressionState;
  size: CreatureSize;
  level: number | null;
  definitions: Definitions;
  subtype: UnchainedEidolonSubtypeKey | null;
  /** The damage reduction the subtype grants at this level, if any. */
  subtypeDamageReduction: boolean;
};
type IssueRule = (context: IssueContext) => string[];

const definitionOf = ({ selection, definitions }: IssueContext) =>
  definitions[selection.key];
const times = (count: number) => `${count} ${count === 1 ? 'time' : 'times'}`;
const has = (
  all: readonly Occurrence[],
  key: EidolonEvolutionKey,
  choice?: string,
) =>
  all.some(
    (item) =>
      item.key === key && (choice === undefined || item.choice === choice),
  );

const minimumLevelIssues: IssueRule = (context) => {
  const { minimumLevel } = definitionOf(context);
  return context.level !== null && minimumLevel && context.level < minimumLevel
    ? [`Requires summoner level ${minimumLevel}.`]
    : [];
};

const upgradeLevelIssues: IssueRule = (context) => {
  const { upgrade } = definitionOf(context);
  return context.level !== null &&
    context.selection.upgrades &&
    upgrade?.minimumLevel &&
    context.level < upgrade.minimumLevel
    ? [`${upgrade.label} requires summoner level ${upgrade.minimumLevel}.`]
    : [];
};

const baseFormIssues: IssueRule = (context) => {
  const { baseForms } = definitionOf(context);
  return baseForms && !baseForms.includes(context.state.baseForm)
    ? [`Only for the ${formNames(baseForms)} base form.`]
    : [];
};

const subtypeIssues: IssueRule = (context) => {
  const { subtypes } = definitionOf(context);
  return subtypes && !(context.subtype && subtypes.includes(context.subtype))
    ? [
        `Only for the ${listAlternatives(subtypes.map((subtype) => unchainedEidolonSubtypes[subtype].name.toLowerCase()))} subtype.`,
      ]
    : [];
};

const evolutionLabel = (
  definitions: Definitions,
  { key, choice }: { key: EidolonEvolutionKey; choice?: string },
) => {
  const name = definitions[key].name.toLowerCase();
  const label = choice && eidolonChoiceOptionLabel(key, choice);
  return label ? `${name} with ${label.toLowerCase()}` : name;
};

const requirementIssues: IssueRule = (context) => {
  const definition = definitionOf(context);
  const missing = (definition.requires ?? [])
    .filter(({ key, choice }) => !has(context.all, key, choice))
    .map(
      (reference) =>
        `Requires ${evolutionLabel(context.definitions, reference)}.`,
    );
  const any = definition.requiresAny ?? [];
  if (
    any.length &&
    !any.some(({ key, choice }) => has(context.all, key, choice))
  )
    missing.push(
      `Requires the ${any.map((reference) => evolutionLabel(context.definitions, reference)).join(' or ')} evolution.`,
    );
  if (
    definition.requiresSubtypeDamageReduction &&
    !context.subtypeDamageReduction
  )
    missing.push('Requires damage reduction from the eidolon’s subtype.');
  return missing;
};

const pullReachIssues: IssueRule = ({ selection, all, state, size }) =>
  selection.key === 'pull' &&
  !has(all, 'reach') &&
  !(size === 'huge' || (size === 'large' && state.baseForm === 'biped'))
    ? ['Requires reach of 10 ft. or more.']
    : [];

const largeSizeIssues: IssueRule = ({ selection, state }) =>
  selection.key === 'large' && state.size !== 'medium'
    ? ['Requires a Medium eidolon.']
    : [];

const repeatIssues: IssueRule = (context) => {
  const { repeat } = definitionOf(context);
  const { selection, earlier } = context;
  const same = earlier.filter((item) => item.key === selection.key);
  if (!repeat && same.length) return ['Selected more than once.'];
  return repeat === 'distinctChoice' &&
    selection.choice !== undefined &&
    same.some((item) => item.choice === selection.choice)
    ? ['Already applies to this choice.']
    : [];
};

const limitedByIssues: IssueRule = (context) => {
  const { limitedBy } = definitionOf(context);
  const { selection, earlier, all } = context;
  if (!limitedBy || selection.choice === 'replacesBaseClaws') return [];
  const sameKey = (item: Occurrence) =>
    item.key === selection.key && item.choice !== 'replacesBaseClaws';
  const count =
    all.filter((item) => item.free && sameKey(item)).length +
    [...earlier, selection].filter(sameKey).length;
  const available = all.filter(
    (item) =>
      item.key === limitedBy.key &&
      (limitedBy.choice === undefined || item.choice === limitedBy.choice),
  ).length;
  return count > available
    ? [
        `Needs another ${limitedBy.choice ? `pair of ${limitedBy.choice}` : context.definitions[limitedBy.key].name.toLowerCase()}.`,
      ]
    : [];
};

const clawReplacementIssues: IssueRule = ({ selection, earlier, all }) => {
  if (selection.choice !== 'replacesBaseClaws') return [];
  if (!all.some((item) => item.free && item.key === 'claws'))
    return ['Only replaces a base form’s claws.'];
  return earlier.some((item) => item.choice === 'replacesBaseClaws')
    ? ['The base form’s claws are already replaced.']
    : [];
};

const naturalArmorLimitIssues: IssueRule = ({ selection, earlier, level }) => {
  if (level === null || selection.key !== 'improvedNaturalArmor') return [];
  const allowed = Math.floor(level / 5);
  return earlier.filter((item) => item.key === 'improvedNaturalArmor').length >=
    allowed
    ? [`Allowed ${times(allowed)} at summoner level ${level}.`]
    : [];
};

// APG: “only be applied once to an individual ability score, plus 1
// additional time for every 6 levels the summoner possesses.”
const abilityIncreaseLimitIssues: IssueRule = ({
  selection,
  earlier,
  level,
}) => {
  if (
    level === null ||
    selection.key !== 'abilityIncrease' ||
    selection.choice === undefined
  )
    return [];
  const allowed = 1 + Math.floor(level / 6);
  return earlier.filter(
    (item) =>
      item.key === 'abilityIncrease' && item.choice === selection.choice,
  ).length >= allowed
    ? [
        `Applies to one score at most ${times(allowed)} at summoner level ${level}.`,
      ]
    : [];
};

const issueRules: readonly IssueRule[] = [
  minimumLevelIssues,
  upgradeLevelIssues,
  baseFormIssues,
  subtypeIssues,
  requirementIssues,
  pullReachIssues,
  largeSizeIssues,
  repeatIssues,
  limitedByIssues,
  clawReplacementIssues,
  naturalArmorLimitIssues,
  abilityIncreaseLimitIssues,
];

function evolutionIssues(context: IssueContext) {
  return issueRules.flatMap((rule) => rule(context));
}

function stepUp(size: CreatureSize): CreatureSize {
  return (
    sizeOrder[Math.min(sizeOrder.length - 1, sizeOrder.indexOf(size) + 1)] ??
    size
  );
}

function naturalAttacks({
  all,
  size,
  entries,
  catalogEntries,
  definitions,
}: {
  all: readonly Occurrence[];
  size: CreatureSize;
  entries: CharacterSheetInput['entries'];
  catalogEntries: CharacterSheetInput['catalogEntries'];
  definitions: Definitions;
}) {
  const replaced = all.some(
    (item) => !item.free && item.choice === 'replacesBaseClaws',
  );
  const attacks = new Map<
    NaturalAttackType,
    EidolonProgressionResolution['naturalAttacks'][number]
  >();
  let extraCount = 0;
  for (const item of all) {
    const definition = definitions[item.key];
    extraCount += definition.attackCount ?? 0;
    const attack = definition.attack;
    if (!attack) continue;
    if (item.free && item.key === 'claws' && replaced) continue;
    const existing = attacks.get(attack.type);
    // A further bite gives 1½ Strength instead of another bite.
    if (item.key === 'bite' && existing) continue;
    if (existing) {
      existing.count += attack.count;
      existing.evolutions.push({ key: item.key, free: item.free });
    } else
      attacks.set(attack.type, {
        type: attack.type,
        name: definition.name,
        count: attack.count,
        role: attack.role,
        dice: attack.dice[size] ?? null,
        evolutions: [{ key: item.key, free: item.free }],
        recorded: 0,
      });
  }
  for (const item of all) {
    if (item.key !== 'improvedDamage' || !item.choice) continue;
    const attack = [...attacks.values()].find(
      ({ type }) => type === item.choice,
    );
    if (attack?.dice)
      attack.dice = scaleAttackDice(attack.dice, size, stepUp(size)) ?? null;
  }
  for (const entry of entries) {
    if (entry.kind !== 'item' || !entry.active || !('catalogEntryId' in entry))
      continue;
    const detail = catalogEntries.find(
      (catalog) => catalog._id === entry.catalogEntryId,
    )?.detail;
    const type =
      detail?.kind === 'item' ? detail.weapon?.naturalAttack?.type : undefined;
    const attack = type ? attacks.get(type) : undefined;
    if (attack) attack.recorded += 1;
  }
  const list = [...attacks.values()];
  return {
    list,
    count: list.reduce((sum, attack) => sum + attack.count, 0) + extraCount,
  };
}

/**
 * Splits each version's supporting sources: the eidolon's own version counts,
 * the other stays listed without counting. Pathfinder Unchained has a
 * Character use one version of a class exclusively, and the Unchained
 * summoner's eidolon is the Unchained eidolon (p. 25), so neither eidolon
 * advances from the other version's summoner levels.
 */
function versionContributions({
  version,
  sources,
  linkedInputs,
}: {
  version: EidolonVersion;
  sources: readonly CompanionProgressionSource[];
  linkedInputs: readonly CompanionLinkedInputResolution[];
}) {
  const own = versionRules[version].ruleKinds;
  const others = eidolonProgressionRuleKinds.filter(
    (kind) => !own.includes(kind),
  );
  const counted = progressionContributions({
    sources,
    linkedInputs,
    ruleKinds: own,
  });
  const mismatched = progressionContributions({
    sources,
    linkedInputs,
    ruleKinds: others,
  });
  return {
    contributions: [
      ...counted,
      ...mismatched.map(
        (item): CompanionContribution => ({
          ...item,
          counting: false,
          effectiveLevel: null,
        }),
      ),
    ],
    counting: counted.filter((item) => item.counting),
    versionMismatch:
      !counted.some((item) => item.counting) &&
      mismatched.some((item) => item.counting),
  };
}

type Subtype = (typeof unchainedEidolonSubtypes)[UnchainedEidolonSubtypeKey];
type DamageReduction = Subtype['damageReduction'][number];
function recordedSubtypeChoice(
  state: EidolonProgressionState,
  key: UnchainedSubtypeChoiceKey,
) {
  return state.subtypeChoices?.find((item) => item.key === key)?.choice;
}
const atLevel = (
  level: number,
  item: { level: number; until?: number; element?: string },
  element: string | undefined,
) =>
  item.level <= level &&
  (item.until === undefined || level < item.until) &&
  (item.element === undefined || item.element === element);

/** The subtype's evolutions gained by this summoner level, for free. */
function subtypeEvolutions({
  state,
  subtype,
  element,
  level,
}: {
  state: EidolonProgressionState;
  subtype: Subtype;
  element: string | undefined;
  level: number | null;
}): Occurrence[] {
  if (level === null) return [];
  return subtype.evolutions
    .filter((item) => atLevel(level, item, element))
    .flatMap((item) => {
      const choice = item.choiceKey
        ? recordedSubtypeChoice(state, item.choiceKey)
        : item.choice;
      const occurrence: Occurrence = {
        key: item.key,
        ...(choice === undefined ? {} : { choice }),
        ...(item.upgrades ? { upgrades: item.upgrades } : {}),
        free: true,
        origin: 'subtype',
        level: item.level,
        ...(item.choiceKey ? { choiceKey: item.choiceKey } : {}),
      };
      return Array.from({ length: item.count ?? 1 }, () => occurrence);
    });
}

/** A recorded choice or upgrade that these rules do not offer. */
function dormantParts(
  selection: EidolonEvolutionSelection,
  definitions: Definitions,
) {
  const definition = definitions[selection.key];
  const options = choiceOptions(selection.key, definitions);
  const parts: ('choice' | 'upgrades')[] = [];
  if (
    selection.choice !== undefined &&
    !options?.includes(
      definition.choice === 'skill'
        ? canonicalSkill(selection.choice)
        : selection.choice,
    )
  )
    parts.push('choice');
  if (
    selection.upgrades !== undefined &&
    (!definition.upgrade || selection.upgrades > definition.upgrade.max)
  )
    parts.push('upgrades');
  return parts;
}

function subtypeChoiceLabel(key: UnchainedSubtypeChoiceKey, choice: string) {
  const { subtype, label, options } = unchainedSubtypeChoiceOptions[key];
  return {
    label: `${unchainedEidolonSubtypes[subtype].name}: ${label}`,
    choice: options.find((option) => option.value === choice)?.label ?? choice,
  };
}

/** Recorded Unchained subtype state that does not count under these rules. */
function dormantSubtypeChoices(
  state: EidolonProgressionState,
  version: EidolonVersion,
): EidolonProgressionResolution['dormantChoices'] {
  const recorded = state.subtypeChoices ?? [];
  const reason: EidolonProgressionResolution['dormantChoices'][number]['reason'] =
    version === 'original' ? 'version' : 'subtype';
  const dormantRecorded = recorded.filter(
    ({ key }) =>
      reason === 'version' ||
      unchainedSubtypeChoiceOptions[key].subtype !== state.subtype,
  );
  return [
    ...(reason === 'version' && state.subtype
      ? [
          {
            kind: 'subtype' as const,
            key: state.subtype,
            label: unchainedEidolonSubtypes[state.subtype].name,
            choice: null,
            reason,
          },
        ]
      : []),
    ...dormantRecorded.map(({ key, choice }) => ({
      kind: 'subtypeChoice' as const,
      key,
      ...subtypeChoiceLabel(key, choice),
      reason,
    })),
  ];
}

/** The counting Unchained subtype with what it grants at this level. */
type CountingSubtype = {
  key: UnchainedEidolonSubtypeKey;
  definition: Subtype;
  element: string | undefined;
  fixed: Occurrence[];
  damageReduction: DamageReduction | undefined;
};
function countingSubtype({
  state,
  version,
  level,
}: {
  state: EidolonProgressionState;
  version: EidolonVersion;
  level: number | null;
}): CountingSubtype | null {
  if (version !== 'unchained' || !state.subtype) return null;
  const key = state.subtype;
  const definition = unchainedEidolonSubtypes[key];
  const element =
    key === 'elemental'
      ? recordedSubtypeChoice(state, 'elemental-element')
      : undefined;
  return {
    key,
    definition,
    element,
    fixed: subtypeEvolutions({ state, subtype: definition, element, level }),
    damageReduction:
      level === null
        ? undefined
        : definition.damageReduction
            .filter((item) => atLevel(level, item, element))
            .at(-1),
  };
}

function subtypeSummary(
  state: EidolonProgressionState,
  subtype: CountingSubtype | null,
): EidolonProgressionResolution['subtype'] {
  if (!subtype) return null;
  return {
    key: subtype.key,
    name: subtype.definition.name,
    alignment: subtype.definition.alignment,
    element: subtype.element ?? null,
    baseForms: unchainedSubtypeBaseForms(subtype.key),
    missingChoices: missingSubtypeChoices(state, subtype),
  };
}

/** The subtype's choices the summoner has yet to record at this level. */
function missingSubtypeChoices(
  state: EidolonProgressionState,
  { key, element, fixed }: CountingSubtype,
) {
  return [
    ...(key === 'elemental' && element === undefined
      ? (['elemental-element'] as const)
      : []),
    ...new Set(
      fixed.flatMap((item) =>
        item.choiceKey && item.choice === undefined ? [item.choiceKey] : [],
      ),
    ),
  ].filter(
    (choiceKey) => recordedSubtypeChoice(state, choiceKey) === undefined,
  );
}

function progressionStatus({
  counting,
  versionMismatch,
  effectiveLevel,
  row,
}: {
  counting: readonly CompanionContribution[];
  versionMismatch: boolean;
  effectiveLevel: number | null;
  row: EidolonBaseStatisticsRow | undefined;
}): EidolonProgressionResolution['status'] {
  if (counting.length === 0 && versionMismatch) return 'unresolved';
  if (counting.length === 0 || effectiveLevel === 0) return 'dormant';
  if (!row) return 'unresolved';
  return 'active';
}

function tableRow(
  table: readonly EidolonBaseStatisticsRow[],
  effectiveLevel: number | null,
) {
  if (
    effectiveLevel === null ||
    !Number.isInteger(effectiveLevel) ||
    effectiveLevel <= 0
  )
    return undefined;
  return table[effectiveLevel - 1];
}

function isMissingChoice(selection: Occurrence, definitions: Definitions) {
  if (selection.origin === 'subtype')
    return selection.choiceKey !== undefined && selection.choice === undefined;
  return (
    !selection.free &&
    definitions[selection.key].choice !== undefined &&
    selection.choice === undefined
  );
}

/** The recorded evolutions, with the dormant parts they keep. */
function chosenEvolutions(
  state: EidolonProgressionState,
  definitions: Definitions,
) {
  const recorded = state.evolutions.map((selection) => ({
    selection,
    dormant: dormantParts(selection, definitions),
  }));
  // Dormant parts stay recorded but supply no cost, requirement or effect.
  const chosen: Occurrence[] = recorded.map(({ selection, dormant }) => ({
    key: selection.key,
    ...(selection.choice !== undefined && !dormant.includes('choice')
      ? { choice: selection.choice }
      : {}),
    ...(selection.upgrades !== undefined && !dormant.includes('upgrades')
      ? { upgrades: selection.upgrades }
      : {}),
    free: false,
    origin: 'chosen',
  }));
  return { recorded, chosen };
}

/**
 * Every evolution the eidolon has: the base form's (or the subtype's version
 * of it), the subtype's fixed ones, then the chosen ones with their cost,
 * missing choice, dormant parts and requirement issues.
 */
function buildEvolutions({
  state,
  definitions,
  subtype,
  level,
  row,
  isLargePaidByGroup,
}: {
  state: EidolonProgressionState;
  definitions: Definitions;
  subtype: CountingSubtype | null;
  level: number | null;
  row: EidolonBaseStatisticsRow | undefined;
  /** A brood's huge purchase allows Large eidolons (UM p. 78). */
  isLargePaidByGroup: boolean;
}) {
  const { recorded, chosen } = chosenEvolutions(state, definitions);
  // The brood pays for one large evolution; a repeat pays its own way.
  const paidLarge = isLargePaidByGroup
    ? chosen.find((selection) => selection.key === 'large')
    : undefined;
  const baseFormEvolutions =
    subtype?.definition.baseForms[state.baseForm] ??
    eidolonBaseForms[state.baseForm].freeEvolutions;
  const all: Occurrence[] = [
    ...baseFormEvolutions.map(
      (selection): Occurrence => ({
        ...selection,
        free: true,
        origin: 'baseForm',
      }),
    ),
    ...(subtype?.fixed ?? []),
    ...chosen,
  ];
  const countsEvolutions = row !== undefined || state.keep;
  // Costs and requirements follow the recorded choices even while they do
  // not count; the calculated size follows only counting evolutions.
  const size = chosenSize(state, chosen);
  const rows = all.map((selection) => {
    const definition = definitions[selection.key];
    const index = chosen.indexOf(selection);
    const original = index >= 0 ? recorded[index] : undefined;
    const choice = original?.selection.choice ?? selection.choice;
    const paidByGroup = selection === paidLarge;
    return {
      key: selection.key,
      name: definition.name,
      choice: choice ?? null,
      upgrades: original?.selection.upgrades ?? selection.upgrades ?? 0,
      cost: evolutionCost({ selection, size, definitions, paidByGroup }),
      paidByGroup,
      free: selection.free,
      origin: selection.origin,
      level: selection.level ?? null,
      choiceKey: selection.choiceKey ?? null,
      missingChoice: isMissingChoice(selection, definitions),
      dormant: original?.dormant ?? [],
      issues: selection.free
        ? []
        : evolutionIssues({
            selection,
            earlier: chosen.slice(0, index),
            all,
            state,
            size,
            level,
            definitions,
            subtype: subtype?.key ?? null,
            subtypeDamageReduction: subtype?.damageReduction !== undefined,
          }),
    };
  });
  return {
    chosen,
    all,
    rows,
    countsEvolutions,
    size: countsEvolutions ? size : state.size,
    // Base form and subtype evolutions apply with the table; chosen ones
    // also while Kept.
    effective: [
      ...(row ? all.filter((item) => item.free) : []),
      ...(countsEvolutions ? chosen : []),
    ],
  };
}

/** The table's pool plus the subtype's points, against the evolutions' cost. */
function evolutionPool({
  points,
  level,
  subtype,
  counting,
  spent,
}: {
  /** The table's pool, or a brood eidolon's allocated points. */
  points: number | null;
  level: number | null;
  subtype: CountingSubtype | null;
  counting: readonly CompanionContribution[];
  spent: number;
}): EidolonProgressionResolution['evolutionPool'] {
  const bonuses =
    subtype && level !== null
      ? subtype.definition.poolBonuses
          .filter((bonus) => bonus.level <= level)
          .map((bonus) => ({
            label: `${subtype.definition.name} subtype (${ordinal(bonus.level)} level)`,
            points: bonus.points,
          }))
      : [];
  const total =
    points === null
      ? null
      : points + bonuses.reduce((sum, bonus) => sum + bonus.points, 0);
  return {
    total,
    spent,
    remaining: total === null ? null : total - spent,
    bonuses,
    sources:
      points === null
        ? []
        : counting.map((source, index) => ({
            sourceKey: source.sourceKey,
            ruleKind: source.ruleKind,
            classRuleIdentity: source.classRuleIdentity,
            // One table lookup; additional pool sources (such as the
            // Extra Evolution feat) would add their own points here.
            points: index === 0 ? points : 0,
          })),
  };
}

function eidolonFeatureNames({
  level,
  multiattack,
  subtype,
  hasDamageReductionEvolution,
}: {
  level: number | null;
  multiattack: boolean;
  subtype: CountingSubtype | null;
  hasDamageReductionEvolution: boolean;
}) {
  if (level === null) return [];
  const damageReduction = subtype?.damageReduction;
  return [
    ...eidolonFeatures
      .filter(
        (feature) => feature.level <= level && feature.name !== 'Multiattack',
      )
      .map((feature) => feature.name)
      .filter((name) => !(name === 'Evasion' && level >= 14)),
    ...(level >= 9
      ? [
          multiattack
            ? 'Multiattack'
            : 'Extra natural attack at −5 (fewer than 3 natural attacks)',
        ]
      : []),
    ...(subtype?.definition.features ?? [])
      .filter((feature) => atLevel(level, feature, subtype?.element))
      .map((feature) => feature.text),
    ...(damageReduction
      ? [
          `DR ${damageReduction.amount + (hasDamageReductionEvolution ? 5 : 0)}/${damageReduction.bypass}`,
        ]
      : []),
  ];
}

function eidolonRestrictions(subtype: CountingSubtype | null) {
  return [
    'Eidolons cannot wear armor; magic item slots are shared with the summoner.',
    ...(subtype
      ? [
          `${subtype.definition.name} eidolons are ${subtype.definition.alignment.toLowerCase()}; the subtype is chosen when the eidolon is first summoned (Pathfinder Unchained p. 25) and cannot be changed (Pathfinder Unchained, Eidolon Subtypes).`,
        ]
      : []),
  ];
}

function unresolvedStatistics(
  status: EidolonProgressionResolution['status'],
  state: EidolonProgressionState,
) {
  if (status === 'active') return state.hpGained === null ? ['maximumHp'] : [];
  return [
    'actualHitDice',
    'baseAttackBonus',
    'maximumHp',
    ...companionUnresolvedAbilities.map((ability) => abilityTargets[ability]),
    'ac.natural',
    'save.fort',
    'save.ref',
    'save.will',
  ];
}

/** Original-summoner Archetypes on the counting Unchained sources. */
function unsupportedArchetypes(
  version: EidolonVersion,
  sources: readonly CompanionProgressionSource[],
) {
  if (version !== 'unchained') return [];
  const { ruleKinds } = versionRules[version];
  return [
    ...new Set(
      sources.flatMap((source) =>
        source.counting && ruleKinds.includes(source.ruleKind)
          ? (source.unsupportedArchetypes ?? [])
          : [],
      ),
    ),
  ];
}

/**
 * The counting reduced progressions (#420) and fused eidolons (#421) with
 * their citations: a reduction is already in each contribution's effective
 * level, and a fused eidolon progresses at the whole level.
 */
function countingProgressionRules(counting: readonly CompanionContribution[]) {
  const ruleKinds = new Set(
    counting.flatMap((item) =>
      item.kind === 'reduced'
        ? [item.ruleKind]
        : isCompanionFusedRuleKind(item.ruleKind)
          ? [item.ruleKind]
          : [],
    ),
  );
  return [...ruleKinds].map((ruleKind) => ({
    restriction: isCompanionFusedRuleKind(ruleKind)
      ? getCompanionFusionRule(ruleKind).restriction
      : getCompanionReductionRule(ruleKind).restriction,
    sources: citationsFor(ruleKind),
  }));
}

type BroodContribution = Extract<CompanionContribution, { kind: 'component' }>;
/**
 * The row values the eidolon's own statistics read: the whole row, or a
 * brood eidolon's recorded shares in place of the divided columns.
 */
type TableStatistics = {
  hitDice: number;
  feats: number;
  armorBonus: number;
  strength: number;
  dexterity: number;
  evolutionPool: number;
  maxAttacks: number;
  /** An explicitly divided rank budget; null uses 6 + Int per HD. */
  skillRanks: number | null;
};
function tableStatistics(
  row: EidolonBaseStatisticsRow | undefined,
  divided: CompanionComponents | null,
): TableStatistics | null {
  if (!row) return null;
  if (divided)
    return {
      hitDice: divided.hitDice,
      feats: divided.feats,
      armorBonus: divided.armorBonus,
      strength: divided.strengthBonus,
      dexterity: divided.dexterityBonus,
      evolutionPool: divided.evolutionPoints,
      maxAttacks: divided.maxAttacks,
      skillRanks: divided.skillRanks,
    };
  return {
    hitDice: row.hitDice,
    feats: row.feats,
    armorBonus: row.armorBonus,
    strength: row.strengthDexterity,
    dexterity: row.strengthDexterity,
    evolutionPool: row.evolutionPool,
    maxAttacks: row.maxAttacks,
    skillRanks: null,
  };
}

/** A counting Broodmaster source's divided components (UM p. 78). */
function resolveBrood(contribution: BroodContribution, level: number | null) {
  const { allocated, budget, pool } = contribution.components;
  const { components, missing } = completeComponents(allocated ?? undefined);
  const resolution: NonNullable<EidolonProgressionResolution['brood']> = {
    components: allocated,
    missing,
    budget,
    pool,
    overBudgetComponents: pool
      ? overBudgetComponents(pool.allocated, budget)
      : [],
    groupPurchases: pool
      ? resolveGroupPurchases({
          ruleKind: contribution.ruleKind,
          purchases: pool.groupPurchases,
          level,
        })
      : null,
    largestSize: pool ? largestBroodSize(pool.groupPurchases) : null,
  };
  return { components, resolution };
}

export function resolveEidolonProgression({
  state,
  sources,
  linkedInputs,
  entries,
  catalogEntries,
}: {
  state: EidolonProgressionState;
  sources: readonly CompanionProgressionSource[];
  linkedInputs: readonly CompanionLinkedInputResolution[];
  entries: CharacterSheetInput['entries'];
  catalogEntries: CharacterSheetInput['catalogEntries'];
}) {
  const version = eidolonVersionOf(state);
  const rules = versionRules[version];
  const { definitions } = rules;
  const form = eidolonBaseForms[state.baseForm];
  const { contributions, counting, versionMismatch } = versionContributions({
    version,
    sources,
    linkedInputs,
  });
  const effectiveLevel = combinedEffectiveLevel(counting);
  const progressionRules = countingProgressionRules(counting);
  const broodSource = counting.find(
    (item): item is BroodContribution => item.kind === 'component',
  );
  const brood = broodSource ? resolveBrood(broodSource, effectiveLevel) : null;
  // A brood eidolon calculates only from its complete recorded shares.
  const row =
    brood && !brood.components
      ? undefined
      : tableRow(rules.table, effectiveLevel);
  const statistics = tableStatistics(row, brood?.components ?? null);
  const status = progressionStatus({
    counting,
    versionMismatch,
    effectiveLevel,
    row,
  });
  const level = row ? effectiveLevel : null;
  const subtype = countingSubtype({ state, version, level });
  const evolutions = buildEvolutions({
    state,
    definitions,
    subtype,
    level,
    row,
    // Without access to the summoner the pool is undisclosed, and the read
    // passes only whether the brood pays this eidolon's large evolution.
    isLargePaidByGroup: brood
      ? brood.resolution.largestSize === 'large' ||
        broodSource?.components.isLargePaidByGroup === true
      : false,
  });
  const { all, chosen, countsEvolutions, effective, size } = evolutions;
  const attacks = naturalAttacks({
    all,
    size,
    entries,
    catalogEntries,
    definitions,
  });
  const multiattack =
    row !== undefined && level !== null && level >= 9 && attacks.count >= 3;
  const armorPortion = statistics
    ? Math.min(state.armorBonusAsArmor, statistics.armorBonus)
    : null;
  const classSkills = [
    ...eidolonClassSkills,
    ...state.classSkills,
    ...(all.some((item) => item.key === 'flight') ? ['fly'] : []),
  ];
  const resolution: EidolonProgressionResolution = {
    kind: 'eidolon',
    version,
    versionMismatch,
    status,
    baseForm: state.baseForm,
    subtype: subtypeSummary(state, subtype),
    dormantChoices: dormantSubtypeChoices(state, version),
    unsupportedArchetypes: unsupportedArchetypes(version, sources),
    effectiveLevel: counting.length ? effectiveLevel : null,
    hitDice: statistics?.hitDice ?? null,
    size,
    contributions,
    budgets: {
      generalFeats: statistics?.feats ?? null,
      skillRanks: null,
      abilityIncreases:
        row && level !== null
          ? eidolonAbilityIncreaseLevels.filter((at) => at <= level).length
          : null,
      maxAttacks: statistics?.maxAttacks ?? null,
    },
    evolutionPool: evolutionPool({
      points: statistics?.evolutionPool ?? null,
      level,
      subtype,
      counting,
      spent: evolutions.rows.reduce((sum, item) => sum + item.cost, 0),
    }),
    evolutions: evolutions.rows,
    naturalAttacks: countsEvolutions ? attacks.list : [],
    attackCount: countsEvolutions ? attacks.count : 0,
    multiattack,
    armor: {
      total: statistics?.armorBonus ?? null,
      armor: armorPortion,
      natural:
        statistics && armorPortion !== null
          ? form.naturalArmor +
            statistics.armorBonus -
            armorPortion +
            naturalArmorFromEvolutions(effective, rules.sizes)
          : null,
    },
    strengthDexterityBonus: brood ? null : (row?.strengthDexterity ?? null),
    brood: brood?.resolution ?? null,
    classSkills: classSkills.map(canonicalSkill),
    features: eidolonFeatureNames({
      level,
      multiattack,
      subtype,
      hasDamageReductionEvolution:
        countsEvolutions && has(chosen, 'damageReduction'),
    }),
    sources: [
      ...rules.sources,
      ...progressionRules.flatMap((rule) => rule.sources),
    ],
    restrictions: [
      ...eidolonRestrictions(subtype),
      ...progressionRules.map((rule) => rule.restriction),
    ],
    unresolvedStatistics: unresolvedStatistics(status, state),
    retained: state.keep,
  };
  return {
    ...resolution,
    /** Explicit budgets taking precedence over ordinary per-HD formulas. */
    explicitBudgets: brood?.components
      ? {
          skillRanks: brood.components.skillRanks,
          generalFeats: brood.components.feats,
        }
      : null,
    modifiers: eidolonModifiers({
      state,
      row,
      statistics,
      effective,
      sizes: rules.sizes,
      definitions,
      armorPortion,
    }),
    proficiencies: weaponTrainingProficiencies(effective),
    state,
  };
}

function largeOf(effective: readonly Occurrence[], sizes: SizeEvolutions) {
  const large = effective.find((item) => item.key === 'large');
  return large ? sizes[(large.upgrades ?? 0) > 0 ? 'huge' : 'large'] : null;
}

function naturalArmorFromEvolutions(
  effective: readonly Occurrence[],
  sizes: SizeEvolutions,
) {
  return (
    effective.filter((item) => item.key === 'improvedNaturalArmor').length * 2 +
    (largeOf(effective, sizes)?.naturalArmor ?? 0)
  );
}

function weaponTrainingProficiencies(effective: readonly Occurrence[]) {
  const training = effective.filter((item) => item.key === 'weaponTraining');
  if (!training.length) return [];
  const categories: ManualProficiency[] = [
    { category: 'simple' },
    ...(training.some((item) => (item.upgrades ?? 0) > 0)
      ? [{ category: 'martial' as const }]
      : []),
  ];
  return categories.map((proficiency) => ({
    proficiency,
    entryId: 'builtin:eidolon:weapon-training',
    name: 'Weapon Training evolution',
  }));
}

function eidolonModifiers({
  state,
  row,
  statistics,
  effective,
  sizes,
  definitions,
  armorPortion,
}: {
  state: EidolonProgressionState;
  row: EidolonBaseStatisticsRow | undefined;
  statistics: TableStatistics | null;
  effective: readonly Occurrence[];
  sizes: SizeEvolutions;
  definitions: Definitions;
  armorPortion: number | null;
}): InputSourcedModifier[] {
  const form = eidolonBaseForms[state.baseForm];
  const modifiers: InputSourcedModifier[] = [];
  const add = (
    target: ModifierTarget,
    value: number,
    name: string,
    bonusType: InputSourcedModifier['bonusType'] = 'untyped',
  ) =>
    modifiers.push({
      target,
      value,
      bonusType,
      sheetEntryId: `builtin:eidolon:${state.baseForm}:${modifiers.length}`,
      entryName: name,
      source: `eidolon:${state.baseForm}:${modifiers.length}`,
      builtIn: true,
    });
  if (row && statistics) {
    // BAB and saves always read the whole row, even for a brood (UM p. 78).
    add('bab', row.bab, 'Eidolon BAB');
    for (const save of ['fort', 'ref', 'will'] as const)
      add(
        `save.${save}`,
        form.goodSaves.includes(save) ? row.goodSave : row.badSave,
        `Eidolon ${saveNames[save]}`,
      );
    add('ability.str', statistics.strength, 'Eidolon Str/Dex bonus');
    add('ability.dex', statistics.dexterity, 'Eidolon Str/Dex bonus');
    if (armorPortion)
      add('ac.armor', armorPortion, 'Eidolon armor bonus', 'armor');
    add(
      'ac.natural',
      form.naturalArmor + statistics.armorBonus - (armorPortion ?? 0),
      `${form.name} natural armor`,
      'naturalArmor',
    );
    if (state.size === 'small')
      sizeAdjustments(smallEidolonAdjustments, 'Small eidolon', add);
    if (state.hpGained !== null)
      add('hp', state.hpGained, 'Eidolon hit points');
  }
  if (row || state.keep)
    for (const ability of state.abilityIncreases)
      add(abilityTargets[ability], 1, 'Eidolon ability score increase');
  evolutionModifiers(effective, sizes, definitions, add);
  return modifiers;
}

type Add = (
  target: ModifierTarget,
  value: number,
  name: string,
  bonusType?: InputSourcedModifier['bonusType'],
) => void;
function evolutionModifiers(
  effective: readonly Occurrence[],
  sizes: SizeEvolutions,
  definitions: Definitions,
  add: Add,
) {
  for (const item of effective) {
    const name = `${definitions[item.key].name} evolution`;
    const ability = abilityKeys.find((key) => key === item.choice);
    if (item.key === 'abilityIncrease' && ability)
      add(abilityTargets[ability], 2, name);
    if (item.key === 'improvedNaturalArmor') add('ac.natural', 2, name);
    const skill = skillDefinitions.find(
      ({ key }) => item.choice && key === canonicalSkill(item.choice),
    );
    if (item.key === 'skilled' && skill) add(skill.key, 8, name, 'racial');
  }
  const size = largeOf(effective, sizes);
  if (!size) return;
  const name = size.size === 'huge' ? 'Huge evolution' : 'Large evolution';
  sizeAdjustments(size, name, add);
  add('ac.natural', size.naturalArmor, name);
}

function sizeAdjustments(
  adjustment: typeof smallEidolonAdjustments,
  name: string,
  add: Add,
) {
  for (const { ability, value } of adjustment.scores)
    add(abilityTargets[ability], value, name);
  for (const { skill, value } of adjustment.skills)
    add(skill, value, name, 'size');
}

export function eidolonProgressionSummary(
  progression: ReturnType<typeof resolveEidolonProgression>,
  skillRanks: number | null,
): EidolonProgressionResolution {
  const {
    modifiers: _modifiers,
    proficiencies: _proficiencies,
    state: _state,
    explicitBudgets: _explicitBudgets,
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
