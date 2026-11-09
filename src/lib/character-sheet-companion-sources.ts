import { z } from 'zod';
import {
  broodCapacity,
  broodSizePlaces,
  companionAllocatedComponentsSchema,
  companionComponentKeys,
  companionComponentPoolSchema,
  companionComponentRuleKinds,
  companionComponentsSchema,
  companionGroupPurchaseSchema,
  getCompanionComponentRule,
  isCompanionComponentRuleKind,
  mapComponents,
  overBudgetComponents,
  resolveComponentBudget,
  resolveGroupPurchases,
  sumComponents,
  type CompanionAllocatedComponents,
  type CompanionComponentRuleKind,
  type CompanionComponents,
  type CompanionGroupPurchaseKey,
} from './character-sheet-companion-components';
import {
  creatureSizes,
  type CreatureSize,
} from './character-sheet-creature-sizes';
import { skillDefinitions } from './character-sheet-skill-definitions';
import { linkedInputKey } from './character-sheet-linked-input-evaluation';
import type {
  CompanionLinkedInput,
  CompanionLinkedInputResolution,
} from './character-sheet-linked-inputs';
import {
  companionSourceRuleKindSchema,
  representativeCompanionRules,
  type CompanionSourceRuleKind,
  type ProgressionReductionStep,
} from './catalog/representative-companion-rules';

// The Companion Progression seam shared by every progression kind: recorded
// skill-rank choices, the supporting sources and their contributions.
export const companionSkillRanksSchema = z
  .record(z.string(), z.number().int().nonnegative())
  .superRefine((ranks, context) => {
    if (Object.keys(ranks).length > 256)
      context.addIssue({
        code: 'custom',
        message: 'Record at most 256 skill ranks.',
      });
    const seen = new Set<string>();
    for (const key of Object.keys(ranks)) {
      const canonical = key.startsWith('skill.') ? key : `skill.${key}`;
      if (!skillDefinitions.some((skill) => skill.key === canonical))
        context.addIssue({
          code: 'custom',
          path: [key],
          message: 'Choose a known skill.',
        });
      if (seen.has(canonical))
        context.addIssue({
          code: 'custom',
          path: [key],
          message: 'Record each skill only once.',
        });
      seen.add(canonical);
    }
  })
  .transform((ranks) =>
    Object.fromEntries(
      Object.entries(ranks).map(([key, value]) => [
        key.startsWith('skill.') ? key : `skill.${key}`,
        value,
      ]),
    ),
  );

// Sources dividing one effective-level budget among several companions
// before each lookup (#410), and sources raising one companion's level.
export const companionAllocationRuleKinds = [
  'beastMasterCompanion',
  'packLordCompanion',
  'packmasterCompanion',
] as const;
export const companionIncreaseRuleKinds = ['boonCompanion'] as const;
export const animalProgressionRuleKinds = [
  'animalCompanion',
  'druidCompanion',
  'rangerCompanion',
  'cavalierMount',
  ...companionAllocationRuleKinds,
  ...companionIncreaseRuleKinds,
] as const;
export type CompanionAllocationRuleKind =
  (typeof companionAllocationRuleKinds)[number];
export type CompanionIncreaseRuleKind =
  (typeof companionIncreaseRuleKinds)[number];
export type CompanionPooledRuleKind =
  | CompanionAllocationRuleKind
  | CompanionIncreaseRuleKind
  | CompanionComponentRuleKind;
export function isCompanionAllocationRuleKind(
  value: unknown,
): value is CompanionAllocationRuleKind {
  return companionAllocationRuleKinds.some((kind) => kind === value);
}
export function isCompanionIncreaseRuleKind(
  value: unknown,
): value is CompanionIncreaseRuleKind {
  return companionIncreaseRuleKinds.some((kind) => kind === value);
}
export function isCompanionPooledRuleKind(
  value: unknown,
): value is CompanionPooledRuleKind {
  return (
    isCompanionAllocationRuleKind(value) ||
    isCompanionIncreaseRuleKind(value) ||
    isCompanionComponentRuleKind(value)
  );
}
export function getCompanionAllocationRule(
  ruleKind: CompanionAllocationRuleKind,
) {
  const rule = representativeCompanionRules[ruleKind].allocation;
  if (!rule) throw new Error(`Missing allocation rule for ${ruleKind}`);
  return rule;
}
export function getCompanionIncreaseRule(ruleKind: CompanionIncreaseRuleKind) {
  const rule = representativeCompanionRules[ruleKind].increase;
  if (!rule) throw new Error(`Missing increase rule for ${ruleKind}`);
  return rule;
}
/** Allocated levels are whole effective levels within the 1–20 tables. */
export const maxCompanionAllocatedLevels = 20;
/** One companion's recorded share of a divided effective-level budget. */
export const companionAllocatedLevelsSchema = z
  .number()
  .int()
  .min(0)
  .max(maxCompanionAllocatedLevels);
const allocationPoolSchema = z.object({
  allocated: z.number(),
  companions: z.number(),
  /** Distinct supporting Selections; an increase covers one companion each. */
  selections: z.number(),
});
// Sources whose rule reduces the class level they read before the one
// table lookup (#420), such as Master Summoner's Lesser Eidolon.
export const companionReducedRuleKinds = ['masterSummonerEidolon'] as const;
export type CompanionReducedRuleKind =
  (typeof companionReducedRuleKinds)[number];
export function isCompanionReducedRuleKind(
  value: unknown,
): value is CompanionReducedRuleKind {
  return companionReducedRuleKinds.some((kind) => kind === value);
}
export function getCompanionReductionRule(ruleKind: CompanionReducedRuleKind) {
  const rule = representativeCompanionRules[ruleKind].reduction;
  if (!rule) throw new Error(`Missing reduction rule for ${ruleKind}`);
  return rule;
}
const reductionStepSchema = z.object({
  kind: z.enum(['divide', 'minimum']),
  /** The divisor or the minimum. */
  operand: z.number(),
  result: z.number(),
});
export type ProgressionReductionResult = z.infer<typeof reductionStepSchema>;
/**
 * Applies a reduced progression's steps in order to the class level a
 * source reads, recording each result. The minimum belongs to a held class
 * level: a level below 1 stays as it is, so no levels give no progression.
 */
export function reduceProgressionLevel(
  classLevels: number,
  steps: readonly ProgressionReductionStep[],
) {
  if (classLevels < 1) return { effectiveLevel: classLevels, steps: [] };
  const results: ProgressionReductionResult[] = [];
  let level = classLevels;
  for (const step of steps) {
    level =
      step.kind === 'divide'
        ? Math.floor(level / step.divisor)
        : Math.max(step.value, level);
    results.push({
      kind: step.kind,
      operand: step.kind === 'divide' ? step.divisor : step.value,
      result: level,
    });
  }
  return { effectiveLevel: level, steps: results };
}
// Sources whose companion fuses with the associated Character (#421), such
// as the Synthesist's Fused Eidolon: an ordinary contribution of the whole
// class level, from a rule that replaces the class's ordinary companion.
export const companionFusedRuleKinds = ['synthesistEidolon'] as const;
export type CompanionFusedRuleKind = (typeof companionFusedRuleKinds)[number];
export function isCompanionFusedRuleKind(
  value: unknown,
): value is CompanionFusedRuleKind {
  return companionFusedRuleKinds.some((kind) => kind === value);
}
export function getCompanionFusionRule(ruleKind: CompanionFusedRuleKind) {
  const rule = representativeCompanionRules[ruleKind].fusion;
  if (!rule) throw new Error(`Missing fusion rule for ${ruleKind}`);
  return rule;
}
/** The published citations of a companion source's rule. */
export function citationsFor(ruleKind: CompanionSourceRuleKind) {
  return representativeCompanionRules[ruleKind].sources;
}
/** The curated name of a rule that changes a companion's progression. */
export function companionProgressionRuleLabel(
  ruleKind: CompanionSourceRuleKind,
) {
  const rule = representativeCompanionRules[ruleKind];
  return (
    rule.reduction?.label ??
    rule.fusion?.label ??
    rule.componentAllocation?.label ??
    rule.allocation?.label ??
    rule.increase?.label ??
    null
  );
}

/**
 * The rules competing for a counting source with no published precedence
 * (#420), once each.
 */
export function conflictingRuleKinds(
  contributions: readonly Pick<
    CompanionContribution,
    'counting' | 'ruleConflict'
  >[],
) {
  return [
    ...new Set(
      contributions.flatMap(({ counting, ruleConflict }) =>
        counting && ruleConflict?.disclosure === 'disclosed'
          ? ruleConflict.ruleKinds
          : [],
      ),
    ),
  ];
}
/**
 * Whether rules compete for a counting source, including a conflict whose
 * rules are undisclosed to this reader.
 */
export function hasConflictingRules(
  contributions: readonly Pick<
    CompanionContribution,
    'counting' | 'ruleConflict'
  >[],
) {
  return contributions.some(
    (item) => item.counting && item.ruleConflict !== undefined,
  );
}
/** The curated names of the rules competing for a counting source. */
export function conflictingRuleLabels(
  contributions: readonly Pick<
    CompanionContribution,
    'counting' | 'ruleConflict'
  >[],
) {
  return conflictingRuleKinds(contributions).map(
    (ruleKind) => companionProgressionRuleLabel(ruleKind) ?? ruleKind,
  );
}

// Summoner levels by class version: original levels support the original
// (APG) eidolon and Unchained levels the Unchained eidolon (#418). Each
// eidolon counts only the rule kinds of its own version. Broodmaster (UM
// p. 78), Master Summoner (UM p. 80) and Synthesist (UM pp. 80–81) are
// original-summoner Archetypes, dividing the eidolon's components, reducing
// its level and fusing it with the summoner respectively.
export const eidolonProgressionRuleKinds = [
  'eidolon',
  'unchainedEidolon',
  ...companionComponentRuleKinds,
  ...companionReducedRuleKinds,
  ...companionFusedRuleKinds,
] as const;
/**
 * Rules competing for one source with no published precedence (#420). They
 * name the associated Character's Archetypes, so a reader without access to
 * it learns only that rules compete (PRD §15).
 */
export const companionRuleConflictSchema = z.discriminatedUnion('disclosure', [
  z.object({
    disclosure: z.literal('disclosed'),
    ruleKinds: z.array(companionSourceRuleKindSchema).min(1).max(8),
  }),
  z.object({ disclosure: z.literal('undisclosed') }),
]);
export type CompanionRuleConflict = z.infer<typeof companionRuleConflictSchema>;
export const companionProgressionSourceSchema = z.object({
  sourceKey: z.string(),
  ruleKind: z.enum([
    ...animalProgressionRuleKinds,
    ...eidolonProgressionRuleKinds,
  ]),
  counting: z.boolean(),
  associatedSize: z.enum(creatureSizes).optional(),
  /** This companion's recorded share of a divided effective-level budget. */
  allocatedLevels: companionAllocatedLevelsSchema.optional(),
  /** Totals across the associated Character's counting companions for this rule kind. */
  pool: allocationPoolSchema.optional(),
  /** This companion's recorded shares of a divided component budget (#419). */
  allocatedComponents: companionAllocatedComponentsSchema.optional(),
  /** Sibling component totals and group purchases, with associated access. */
  componentPool: companionComponentPoolSchema.optional(),
  /**
   * Without associated access, the one group-purchase fact this companion's
   * own points need: the brood's purchases pay its recorded large evolution
   * (UM p. 78). Set only for a companion that records it.
   */
  isLargePaidByGroup: z.literal(true).optional(),
  /**
   * Archetypes written for the original summoner on the Unchained summoner
   * this source reads, never assumed to apply to an Unchained eidolon.
   */
  unsupportedArchetypes: z.array(z.string()).max(32).optional(),
  /**
   * Rules that each claim to change this source's progression with no
   * published precedence, such as Broodmaster and Master Summoner on one
   * summoner. The source then supplies no level until one rule remains.
   * Absent without a conflict.
   */
  ruleConflict: companionRuleConflictSchema.optional(),
});
export type CompanionProgressionSource = z.infer<
  typeof companionProgressionSourceSchema
>;
export type CompanionProgressionRuleKind =
  CompanionProgressionSource['ruleKind'];
export function isCompanionProgressionRuleKind(
  value: unknown,
): value is CompanionProgressionRuleKind {
  return companionProgressionSourceSchema.shape.ruleKind.safeParse(value)
    .success;
}

const contributionBaseSchema = z.object({
  sourceKey: z.string(),
  ruleKind: companionProgressionSourceSchema.shape.ruleKind,
  classLevels: z.number().nullable(),
  effectiveLevel: z.number().nullable(),
  classRuleIdentity: z.string(),
  counting: z.boolean(),
  associatedSize: companionProgressionSourceSchema.shape.associatedSize,
  resolution: z.enum([
    'calculated',
    'interpretation',
    'precedence',
    'fallback',
    'unresolved',
  ]),
  fallbackState: z.enum(['none', 'applied', 'suspended']),
  ruleConflict: companionProgressionSourceSchema.shape.ruleConflict,
});
/** Sibling totals, disclosed only with access to the associated Character. */
const contributionPoolSchema = allocationPoolSchema.nullable();
/**
 * An ordinary contribution reads its class family's level; an allocation
 * contributes its recorded share of a divided budget; an increase adds
 * levels to a companion another source supports.
 */
export const companionContributionSchema = z.discriminatedUnion('kind', [
  contributionBaseSchema.extend({ kind: z.literal('ordinary') }),
  contributionBaseSchema.extend({
    kind: z.literal('allocation'),
    ruleKind: z.enum(companionAllocationRuleKinds),
    allocation: z.object({
      levels: z.number().nullable(),
      budget: z.number().nullable(),
      pool: contributionPoolSchema,
    }),
  }),
  contributionBaseSchema.extend({
    kind: z.literal('increase'),
    ruleKind: z.enum(companionIncreaseRuleKinds),
    increase: z.object({
      amount: z.number(),
      characterLevel: z.number().nullable(),
      pool: contributionPoolSchema,
    }),
  }),
  // The whole table row is looked up; this companion's divided components
  // replace its per-HD outputs, and `budget` is the whole brood's.
  contributionBaseSchema.extend({
    kind: z.literal('component'),
    ruleKind: z.enum(companionComponentRuleKinds),
    components: z.object({
      allocated: companionAllocatedComponentsSchema.nullable(),
      budget: companionComponentsSchema.nullable(),
      pool: companionComponentPoolSchema.nullable(),
      isLargePaidByGroup:
        companionProgressionSourceSchema.shape.isLargePaidByGroup,
    }),
  }),
  // The class level is reduced before the lookup (#420): `classLevels` is
  // the actual level read, `effectiveLevel` the last step's result.
  contributionBaseSchema.extend({
    kind: z.literal('reduced'),
    ruleKind: z.enum(companionReducedRuleKinds),
    reduction: z.object({ steps: z.array(reductionStepSchema) }),
  }),
]);
export type CompanionContribution = z.infer<typeof companionContributionSchema>;

function sourceFamilies(
  source: CompanionProgressionSource,
  linkedInputs: readonly CompanionLinkedInputResolution[],
): string[] {
  switch (source.ruleKind) {
    case 'druidCompanion':
      return ['druid'];
    case 'rangerCompanion':
      return ['ranger'];
    case 'cavalierMount':
      return ['cavalier'];
    case 'eidolon':
    case 'unchainedEidolon':
      return ['summoner'];
    case 'broodmasterEidolon':
      return [getCompanionComponentRule(source.ruleKind).classRuleIdentity];
    case 'masterSummonerEidolon':
      return [getCompanionReductionRule(source.ruleKind).classRuleIdentity];
    case 'synthesistEidolon':
      return [getCompanionFusionRule(source.ruleKind).classRuleIdentity];
    case 'beastMasterCompanion':
    case 'packLordCompanion':
    case 'packmasterCompanion':
      return [getCompanionAllocationRule(source.ruleKind).classRuleIdentity];
    case 'boonCompanion':
      return ['boonCompanion'];
    case 'animalCompanion': {
      const explicit = linkedInputs.flatMap((input) =>
        input.input.kind === 'classLevels' &&
        ['druid', 'ranger'].includes(input.input.classRuleIdentity) &&
        (input.resolution === 'fallback' ||
          (input.resolution === 'interpretation' &&
            input.candidates.some(
              (candidate) => candidate.sourceKey === source.sourceKey,
            )))
          ? [input.input.classRuleIdentity]
          : [],
      );
      return explicit.length ? explicit : ['unspecified'];
    }
  }
}

function familyInput(family: string): CompanionLinkedInput {
  return family === 'boonCompanion'
    ? { kind: 'characterLevel' }
    : { kind: 'classLevels', classRuleIdentity: family };
}

/**
 * Each applicable source's contribution. A class family counts once however
 * many sources name it; non-counting sources stay addressable with no level.
 * A counting allocation source replaces the ordinary contribution of its
 * class family whatever the source order; it contributes its recorded share.
 */
export function progressionContributions({
  sources = [],
  linkedInputs = [],
  ruleKinds,
}: {
  sources?: readonly CompanionProgressionSource[];
  linkedInputs?: readonly CompanionLinkedInputResolution[];
  ruleKinds: readonly CompanionProgressionRuleKind[];
}): CompanionContribution[] {
  const applicable = sources.filter((source) =>
    ruleKinds.includes(source.ruleKind),
  );
  const claimFamily = createFamilyClaims(applicable);
  const contributions = applicable.flatMap((source) =>
    sourceFamilies(source, linkedInputs)
      .filter((family) => claimFamily(source, family))
      .map((family) =>
        buildContribution({
          source,
          family,
          resolution: findFamilyResolution(family, linkedInputs),
        }),
      ),
  );
  return applyLevelIncreases(contributions);
}

/**
 * The class family a dividing or reducing source replaces, if its rule
 * changes how that family's level counts.
 */
function replacedFamily(ruleKind: CompanionProgressionRuleKind) {
  if (isCompanionAllocationRuleKind(ruleKind))
    return getCompanionAllocationRule(ruleKind).classRuleIdentity;
  if (isCompanionComponentRuleKind(ruleKind))
    return getCompanionComponentRule(ruleKind).classRuleIdentity;
  if (isCompanionReducedRuleKind(ruleKind))
    return getCompanionReductionRule(ruleKind).classRuleIdentity;
  return null;
}

/**
 * Claims a class family for a source, in source order: a counting family
 * counts once, and never ordinarily beside a counting division or
 * reduction of it.
 */
function createFamilyClaims(applicable: readonly CompanionProgressionSource[]) {
  const replaced = new Set(
    applicable.flatMap((source) => {
      const family = source.counting ? replacedFamily(source.ruleKind) : null;
      return family ? [family] : [];
    }),
  );
  const claimed = new Set<string>();
  return (source: CompanionProgressionSource, family: string) => {
    if (!source.counting) return true;
    const isReplacing = replacedFamily(source.ruleKind) !== null;
    if (!isReplacing && replaced.has(family)) return false;
    if (claimed.has(family)) return false;
    claimed.add(family);
    return true;
  };
}

function findFamilyResolution(
  family: string,
  linkedInputs: readonly CompanionLinkedInputResolution[],
) {
  const key = linkedInputKey(familyInput(family));
  const inputs = linkedInputs.filter(
    (resolution) => linkedInputKey(resolution.input) === key,
  );
  return inputs.length === 1 ? inputs[0] : undefined;
}

function buildContribution({
  source,
  family,
  resolution,
}: {
  source: CompanionProgressionSource;
  family: string;
  resolution: CompanionLinkedInputResolution | undefined;
}): CompanionContribution {
  const {
    allocatedLevels,
    pool,
    allocatedComponents,
    componentPool,
    isLargePaidByGroup,
    unsupportedArchetypes: _unsupportedArchetypes,
    ruleConflict,
    ...identity
  } = source;
  const base = {
    ...identity,
    classRuleIdentity: family,
    resolution: resolution?.resolution ?? 'unresolved',
    fallbackState: resolution?.fallbackState ?? 'none',
    ...(ruleConflict ? { ruleConflict } : {}),
  } as const;
  const value = source.counting ? (resolution?.value ?? null) : null;
  // Competing rules without precedence: the level read stays visible, but
  // no rule's calculation is chosen for it. The competing rules all replace
  // the original eidolon, so the contribution is one whatever kind it names.
  if (ruleConflict)
    return {
      ...base,
      kind: 'ordinary',
      ruleKind: 'eidolon',
      classLevels: value,
      effectiveLevel: null,
    };
  if (isCompanionIncreaseRuleKind(source.ruleKind))
    return {
      ...base,
      kind: 'increase',
      ruleKind: source.ruleKind,
      classLevels: null,
      effectiveLevel: null,
      increase: {
        amount: getCompanionIncreaseRule(source.ruleKind).amount,
        characterLevel: value,
        pool: pool ?? null,
      },
    };
  if (isCompanionComponentRuleKind(source.ruleKind))
    return {
      ...base,
      kind: 'component',
      ruleKind: source.ruleKind,
      classLevels: value,
      // The whole row: the summoner level is not divided.
      effectiveLevel: value,
      components: {
        allocated: allocatedComponents ?? null,
        budget: componentPool
          ? resolveComponentBudget({
              ruleKind: source.ruleKind,
              level: value,
              purchases: componentPool.groupPurchases,
            })
          : null,
        pool: componentPool ?? null,
        ...(isLargePaidByGroup ? { isLargePaidByGroup } : {}),
      },
    };
  if (isCompanionReducedRuleKind(source.ruleKind)) {
    const reduced =
      value === null
        ? null
        : reduceProgressionLevel(
            value,
            getCompanionReductionRule(source.ruleKind).steps,
          );
    return {
      ...base,
      kind: 'reduced',
      ruleKind: source.ruleKind,
      classLevels: value,
      effectiveLevel: reduced?.effectiveLevel ?? null,
      reduction: { steps: reduced?.steps ?? [] },
    };
  }
  if (isCompanionAllocationRuleKind(source.ruleKind))
    return {
      ...base,
      kind: 'allocation',
      ruleKind: source.ruleKind,
      classLevels: value,
      effectiveLevel: value === null ? null : (allocatedLevels ?? null),
      allocation: {
        levels: allocatedLevels ?? null,
        budget:
          value === null
            ? null
            : getCompanionAllocationRule(source.ruleKind).budget(value),
        pool: pool ?? null,
      },
    };
  return {
    ...base,
    kind: 'ordinary',
    classLevels: value,
    effectiveLevel: ordinaryEffectiveLevel(family, value),
  };
}

function ordinaryEffectiveLevel(family: string, classLevels: number | null) {
  if (classLevels === null) return null;
  // Hunter's bond: the effective druid level is the ranger level − 3.
  if (family === 'ranger') return Math.max(0, classLevels - 3);
  return classLevels;
}

// An increase never supports a companion alone and stops at character level.
function applyLevelIncreases(contributions: CompanionContribution[]) {
  const supporting = contributions.filter(
    (item) => item.counting && item.kind !== 'increase',
  );
  const supported = combinedEffectiveLevel(supporting);
  return contributions.map((item) => {
    if (item.kind !== 'increase' || !item.counting) return item;
    return {
      ...item,
      effectiveLevel: increasedLevels({
        ...item.increase,
        hasSupport: supporting.length > 0,
        supported,
      }),
    };
  });
}

function increasedLevels({
  amount,
  characterLevel,
  hasSupport,
  supported,
}: {
  amount: number;
  characterLevel: number | null;
  hasSupport: boolean;
  supported: number | null;
}) {
  if (!hasSupport) return 0;
  if (supported === null || characterLevel === null) return null;
  return Math.min(amount, Math.max(0, characterLevel - supported));
}

/** The combined effective level, or null while any counting input is missing. */
export function combinedEffectiveLevel(
  counting: readonly CompanionContribution[],
) {
  return counting.some((item) => item.effectiveLevel === null)
    ? null
    : counting.reduce((sum, item) => sum + (item.effectiveLevel ?? 0), 0);
}

type ShareSource = {
  key: string;
  ruleKind?: CompanionSourceRuleKind;
  counting: boolean;
  allocatedLevels?: number;
  allocatedComponents?: CompanionAllocatedComponents;
  /** The Selection or Grant behind the source; one increase per Selection. */
  selectionId: string;
};
type ShareMember = {
  relationshipId: string;
  sourceKey: string;
  levels: number | null;
  /** Recorded component shares, for a component budget. */
  components?: CompanionAllocatedComponents | null;
  counting: boolean;
};
export type CompanionAllocationShare = {
  allocated: number;
  companions: number;
  /** Distinct Selections behind the counting companions' sources. */
  selections: number;
  /** Counting component totals, for a component budget. */
  components?: CompanionComponents;
  members: ShareMember[];
};

/**
 * The associated Character's divided budgets across its companions: one
 * source per rule kind and relationship, counting only active relationships
 * whose source still counts. Inactive shares stay listed with their record.
 */
export function summarizeCompanionAllocationShares(
  relationships: readonly {
    relationshipId: string;
    active: boolean;
    sources: readonly ShareSource[];
  }[],
) {
  const members = new Map<
    CompanionPooledRuleKind,
    (ShareMember & { selectionId: string })[]
  >();
  for (const relationship of relationships)
    for (const [ruleKind, source] of findPooledSources(relationship.sources))
      members.set(ruleKind, [
        ...(members.get(ruleKind) ?? []),
        {
          relationshipId: relationship.relationshipId,
          sourceKey: source.key,
          levels: isCompanionAllocationRuleKind(ruleKind)
            ? (source.allocatedLevels ?? null)
            : null,
          ...(isCompanionComponentRuleKind(ruleKind)
            ? { components: source.allocatedComponents ?? null }
            : {}),
          counting: relationship.active && source.counting,
          selectionId: source.selectionId,
        },
      ]);
  return new Map(
    [...members].map(([ruleKind, list]) => [
      ruleKind,
      summarizeShare(ruleKind, list),
    ]),
  );
}

/** Each pooled rule kind's source, preferring one that counts. */
function findPooledSources(sources: readonly ShareSource[]) {
  const kinds = new Set(
    sources.flatMap(({ ruleKind }) =>
      isCompanionPooledRuleKind(ruleKind) ? [ruleKind] : [],
    ),
  );
  return [...kinds].flatMap((ruleKind) => {
    const candidates = sources.filter((source) => source.ruleKind === ruleKind);
    const source =
      candidates.find((candidate) => candidate.counting) ?? candidates[0];
    return source ? [[ruleKind, source] as const] : [];
  });
}

function summarizeShare(
  ruleKind: CompanionPooledRuleKind,
  members: readonly (ShareMember & { selectionId: string })[],
): CompanionAllocationShare {
  const counting = members.filter((member) => member.counting);
  return {
    allocated: isCompanionAllocationRuleKind(ruleKind)
      ? counting.reduce((sum, member) => sum + (member.levels ?? 0), 0)
      : counting.length,
    companions: counting.length,
    selections: new Set(counting.map((member) => member.selectionId)).size,
    ...(isCompanionComponentRuleKind(ruleKind)
      ? {
          components: sumComponents(
            counting.map((member) => member.components ?? {}),
          ),
        }
      : {}),
    members: members.map(({ selectionId: _selectionId, ...member }) => member),
  };
}

const citationSchema = z.object({
  book: z.string(),
  pages: z.string(),
  url: z.string(),
});
const poolMemberSchema = z.object({
  relationshipId: z.string(),
  sourceKey: z.string(),
  levels: z.number().nullable(),
  counting: z.boolean(),
});
const poolBaseSchema = z.object({
  label: z.string(),
  allocated: z.number(),
  overBudget: z.boolean(),
  restriction: z.string(),
  sources: z.array(citationSchema),
});
/**
 * A budget the associated Character owns: effective levels divided among
 * its companions, or an increase limited to one companion per Selection.
 */
export const companionAllocationPoolSchema = z.discriminatedUnion('kind', [
  poolBaseSchema.extend({
    kind: z.literal('allocation'),
    ruleKind: z.enum(companionAllocationRuleKinds),
    classRuleIdentity: z.string(),
    classLevels: z.number().nullable(),
    budget: z.number().nullable(),
    remaining: z.number().nullable(),
    members: z.array(poolMemberSchema),
  }),
  poolBaseSchema.extend({
    kind: z.literal('increase'),
    ruleKind: z.enum(companionIncreaseRuleKinds),
    /** Companions allowed: one per distinct supporting Selection. */
    budget: z.number(),
    members: z.array(poolMemberSchema.omit({ levels: true })),
  }),
  // One undivided row whose components are divided (#419).
  poolBaseSchema.omit({ allocated: true }).extend({
    kind: z.literal('component'),
    ruleKind: z.enum(companionComponentRuleKinds),
    classRuleIdentity: z.string(),
    classLevels: z.number().nullable(),
    /** The whole brood's components, after its group purchases. */
    budget: companionComponentsSchema.nullable(),
    allocated: companionComponentsSchema,
    remaining: companionComponentsSchema.nullable(),
    overBudgetComponents: z.array(z.enum(companionComponentKeys)),
    groupPurchases: z.array(companionGroupPurchaseSchema),
    /** Brood places counted in Small eidolons; null without the sizes. */
    capacity: z.object({ allowed: z.number(), used: z.number().nullable() }),
    members: z.array(
      poolMemberSchema.omit({ levels: true }).extend({
        components: companionAllocatedComponentsSchema.nullable(),
      }),
    ),
  }),
]);
export type CompanionAllocationPool = z.infer<
  typeof companionAllocationPoolSchema
>;

/** Each divided budget with its provenance, for the budget owner's sheet. */
export function resolveCompanionAllocationPools({
  shares,
  classLevels,
  groupPurchases = {},
  sizes,
}: {
  shares: ReadonlyMap<CompanionPooledRuleKind, CompanionAllocationShare>;
  classLevels: Readonly<Record<string, number | null | undefined>>;
  /** Group purchases recorded on the budget owner's sheet, by budget. */
  groupPurchases?: Readonly<
    Partial<
      Record<CompanionComponentRuleKind, readonly CompanionGroupPurchaseKey[]>
    >
  >;
  /** Each member companion's calculated size, by relationship. */
  sizes?: Readonly<Record<string, CreatureSize | undefined>>;
}): CompanionAllocationPool[] {
  return [
    ...companionAllocationRuleKinds.flatMap((ruleKind) => {
      const share = shares.get(ruleKind);
      return share
        ? [resolveAllocationPool({ ruleKind, share, classLevels })]
        : [];
    }),
    ...companionIncreaseRuleKinds.flatMap((ruleKind) => {
      const share = shares.get(ruleKind);
      return share ? [resolveIncreasePool({ ruleKind, share })] : [];
    }),
    ...companionComponentRuleKinds.flatMap((ruleKind) => {
      const share = shares.get(ruleKind);
      return share
        ? [
            resolveComponentPool({
              ruleKind,
              share,
              classLevels,
              purchases: groupPurchases[ruleKind] ?? [],
              sizes,
            }),
          ]
        : [];
    }),
  ];
}

function resolveComponentPool({
  ruleKind,
  share,
  classLevels,
  purchases,
  sizes,
}: {
  ruleKind: CompanionComponentRuleKind;
  share: CompanionAllocationShare;
  classLevels: Readonly<Record<string, number | null | undefined>>;
  purchases: readonly CompanionGroupPurchaseKey[];
  sizes: Readonly<Record<string, CreatureSize | undefined>> | undefined;
}): CompanionAllocationPool {
  const rule = getCompanionComponentRule(ruleKind);
  const level = classLevels[rule.classRuleIdentity] ?? null;
  const budget = resolveComponentBudget({ ruleKind, level, purchases });
  const allocated = share.components ?? sumComponents([]);
  const over = overBudgetComponents(allocated, budget);
  const counting = share.members.filter((member) => member.counting);
  const memberSizes = counting.map((member) => sizes?.[member.relationshipId]);
  return {
    kind: 'component',
    ruleKind,
    label: rule.label,
    classRuleIdentity: rule.classRuleIdentity,
    classLevels: level,
    budget,
    allocated,
    remaining: budget
      ? mapComponents((key) => budget[key] - allocated[key])
      : null,
    overBudget: over.length > 0,
    overBudgetComponents: over,
    groupPurchases: resolveGroupPurchases({ ruleKind, purchases, level }),
    capacity: {
      allowed: broodCapacity(purchases),
      used: memberSizes.every((size) => size !== undefined)
        ? memberSizes.reduce((sum, size) => sum + broodSizePlaces(size), 0)
        : null,
    },
    restriction: rule.restriction,
    members: share.members.map(
      ({ levels: _levels, components, ...member }) => ({
        ...member,
        components: components ?? null,
      }),
    ),
    sources: citationsFor(ruleKind),
  };
}

function resolveAllocationPool({
  ruleKind,
  share,
  classLevels,
}: {
  ruleKind: CompanionAllocationRuleKind;
  share: CompanionAllocationShare;
  classLevels: Readonly<Record<string, number | null | undefined>>;
}): CompanionAllocationPool {
  const rule = getCompanionAllocationRule(ruleKind);
  const levels = classLevels[rule.classRuleIdentity] ?? null;
  const budget = levels === null ? null : rule.budget(levels);
  return {
    kind: 'allocation',
    ruleKind,
    label: rule.label,
    classRuleIdentity: rule.classRuleIdentity,
    classLevels: levels,
    budget,
    allocated: share.allocated,
    remaining: budget === null ? null : budget - share.allocated,
    overBudget: budget !== null && share.allocated > budget,
    restriction: rule.restriction,
    members: share.members,
    sources: citationsFor(ruleKind),
  };
}

function resolveIncreasePool({
  ruleKind,
  share,
}: {
  ruleKind: CompanionIncreaseRuleKind;
  share: CompanionAllocationShare;
}): CompanionAllocationPool {
  const rule = getCompanionIncreaseRule(ruleKind);
  return {
    kind: 'increase',
    ruleKind,
    label: rule.label,
    budget: share.selections,
    allocated: share.allocated,
    overBudget: share.allocated > share.selections,
    restriction: rule.restriction,
    members: share.members.map(({ levels: _levels, ...member }) => member),
    sources: citationsFor(ruleKind),
  };
}
