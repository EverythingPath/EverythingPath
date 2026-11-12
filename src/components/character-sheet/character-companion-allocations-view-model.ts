import type { FunctionReturnType } from 'convex/server';
import type { api } from '@convex/_generated/api';
import { classLabels } from '~/lib/catalog/representative-companion-rules';
import {
  getCompanionReductionRule,
  type CompanionContribution,
  type ProgressionReductionResult,
} from '~/lib/character-sheet-companion-sources';
import {
  companionComponentKeys,
  companionComponentLabels,
  companionGroupPurchaseKeys,
  completeComponents,
  getCompanionComponentRule,
  type CompanionAllocatedComponents,
  type CompanionComponents,
} from '~/lib/character-sheet-companion-components';
import {
  characterSheetPath,
  type CharacterSheetOrigin,
} from '~/lib/campaign-routes';

/** One budget as the server lists it, with each companion's endpoint. */
export type CompanionAllocationPoolRow = FunctionReturnType<
  typeof api.companionRelationships.listAllocationPools
>[number];
type MemberRow = CompanionAllocationPoolRow['members'][number];
type AllocationPoolRow = Extract<
  CompanionAllocationPoolRow,
  { kind: 'allocation' }
>;
type IncreasePoolRow = Extract<
  CompanionAllocationPoolRow,
  { kind: 'increase' }
>;
type ComponentPoolRow = Extract<
  CompanionAllocationPoolRow,
  { kind: 'component' }
>;

/** “1 level”, “2 levels”: a count with its noun, pluralised. */
export function formatCount(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/**
 * One budget owned by the associated Character: where the budget comes
 * from, how much each companion holds and whether it is over budget. The
 * server calculates every number; this only words them.
 */
export function buildCompanionAllocationPoolView({
  pool,
  origin,
}: {
  pool: CompanionAllocationPoolRow;
  origin?: CharacterSheetOrigin;
}) {
  if (pool.kind === 'allocation') return buildAllocationPoolView(pool, origin);
  if (pool.kind === 'component') return buildComponentPoolView(pool, origin);
  return buildIncreasePoolView(pool, origin);
}
export type CompanionAllocationPoolView = ReturnType<
  typeof buildCompanionAllocationPoolView
>;
export type CompanionAllocationMemberView =
  CompanionAllocationPoolView['members'][number];

function describePool(pool: CompanionAllocationPoolRow) {
  return {
    key: pool.ruleKind,
    ruleKind: pool.ruleKind,
    label: pool.label,
    restriction: pool.restriction,
    citations: pool.sources.map(({ book, pages }) => `${book}, p. ${pages}`),
    overBudget: pool.overBudget,
  };
}

function describeMember(member: MemberRow, origin?: CharacterSheetOrigin) {
  return {
    relationshipId: member.relationshipId,
    sourceKey: member.sourceKey,
    counting: member.counting,
    companion: member.companion,
    lastOperationId: member.lastOperationId,
    key: `${member.relationshipId}/${member.sourceKey}`,
    name: member.companion?.name ?? 'Character unavailable',
    href: member.companion
      ? characterSheetPath(member.companion.characterId, origin)
      : null,
    stateLabel: member.counting
      ? null
      : 'Not counting while its support or relationship is inactive; its allocation is kept.',
  };
}

function buildAllocationPoolView(
  pool: AllocationPoolRow,
  origin?: CharacterSheetOrigin,
) {
  const classLabel =
    classLabels[pool.classRuleIdentity] ?? pool.classRuleIdentity;
  return {
    ...describePool(pool),
    kind: 'allocation' as const,
    budgetSourceLabel:
      pool.classLevels === null
        ? `${classLabel} level unavailable`
        : `${classLabel} ${pool.classLevels}`,
    budgetLabel:
      pool.budget === null
        ? 'Unresolved'
        : formatCount(pool.budget, 'effective level'),
    allocatedLabel: `${pool.allocated} allocated`,
    remainingLabel: describeRemaining(pool.remaining),
    warning: pool.overBudget
      ? `Allocations total ${formatCount(pool.allocated, 'effective level')}, above the ${pool.label} budget of ${pool.budget}. Every recorded allocation is kept; change one yourself if needed.`
      : null,
    /** A prefill for an unallocated share: the budget left over, if any. */
    suggestedLevels:
      pool.remaining !== null && pool.remaining > 0 ? pool.remaining : null,
    members: pool.members.map((member) => ({
      ...describeMember(member, origin),
      kind: 'allocation' as const,
      levels: member.levels,
      levelsLabel:
        member.levels === null
          ? 'Not allocated'
          : formatCount(member.levels, 'level'),
    })),
  };
}

function describeRemaining(remaining: number | null) {
  if (remaining === null) return null;
  if (remaining < 0) return `${-remaining} over budget`;
  return `${remaining} unallocated`;
}

function buildIncreasePoolView(
  pool: IncreasePoolRow,
  origin?: CharacterSheetOrigin,
) {
  return {
    ...describePool(pool),
    kind: 'increase' as const,
    budgetSourceLabel: formatCount(pool.budget, 'selection'),
    budgetLabel: 'One companion each',
    allocatedLabel: `Supports ${formatCount(pool.allocated, 'companion')}`,
    remainingLabel: null,
    warning: pool.overBudget
      ? `${pool.label} applies to one companion per selection but supports ${pool.allocated} on ${formatCount(pool.budget, 'selection')}. Each keeps the benefit until you remove a source.`
      : null,
    members: pool.members.map((member) => ({
      ...describeMember(member, origin),
      kind: 'increase' as const,
    })),
  };
}

/** “1 Hit Die, 4 skill ranks, …”: recorded component shares in words. */
export function describeComponents(
  components: CompanionAllocatedComponents | null,
) {
  if (!components) return 'Not allocated';
  const recorded = companionComponentKeys.flatMap((key) => {
    const value = components[key];
    return value === undefined
      ? []
      : [`${companionComponentLabels[key]} ${value}`];
  });
  return recorded.length ? recorded.join(', ') : 'Not allocated';
}

/**
 * One divided component budget (#419), such as a Broodmaster's brood: each
 * component's whole budget and allocated total, the group purchases paid
 * before division, the brood's size places and each eidolon's recorded
 * shares. The server calculates every number; this only words them.
 */
function buildComponentPoolView(
  pool: ComponentPoolRow,
  origin?: CharacterSheetOrigin,
) {
  const classLabel =
    classLabels[pool.classRuleIdentity] ?? pool.classRuleIdentity;
  const rule = getCompanionComponentRule(pool.ruleKind);
  const over = pool.overBudgetComponents.map(
    (key) => companionComponentLabels[key],
  );
  const overCapacity =
    pool.capacity.used !== null && pool.capacity.used > pool.capacity.allowed;
  const component = (key: keyof CompanionComponents) => ({
    key,
    label: companionComponentLabels[key],
    budget: pool.budget?.[key] ?? null,
    allocated: pool.allocated[key],
    remaining: pool.remaining?.[key] ?? null,
    overBudget: pool.overBudgetComponents.includes(key),
  });
  return {
    ...describePool(pool),
    kind: 'component' as const,
    /** Narrowed to the component rule kinds, for the group purchase writer. */
    ruleKind: pool.ruleKind,
    budgetSourceLabel:
      pool.classLevels === null
        ? `${classLabel} level unavailable`
        : `${classLabel} ${pool.classLevels}`,
    budgetLabel:
      pool.budget === null
        ? 'Unresolved'
        : `${pool.budget.hitDice} Hit ${pool.budget.hitDice === 1 ? 'Die' : 'Dice'} to divide`,
    allocatedLabel: `${pool.allocated.hitDice} allocated`,
    remainingLabel: describeRemaining(pool.remaining?.hitDice ?? null),
    warning:
      [
        over.length
          ? `Allocations exceed the ${pool.label} budget for ${over.join(', ')}. Every recorded allocation is kept; change one yourself if needed.`
          : null,
        overCapacity
          ? `The brood fills ${pool.capacity.used} of its ${pool.capacity.allowed} Small-eidolon places; two eidolons of one size count as one of the next size up.`
          : null,
      ]
        .filter(Boolean)
        .join(' ') || null,
    components: companionComponentKeys.map(component),
    /** Each group purchase the rule offers, with its recorded state. */
    groupPurchases: companionGroupPurchaseKeys.flatMap((key) => {
      const definition = rule.groupPurchases[key];
      if (!definition) return [];
      const recorded = pool.groupPurchases.find((item) => item.key === key);
      return [
        {
          key,
          label: definition.label,
          cost: definition.cost,
          minimumLevel: definition.minimumLevel,
          purchased: Boolean(recorded),
          issues: recorded?.issues ?? [],
        },
      ];
    }),
    capacity: { ...pool.capacity, overCapacity },
    members: pool.members.map((member) => ({
      ...describeMember(member, origin),
      kind: 'component' as const,
      components: member.components,
      missing: completeComponents(member.components ?? undefined).missing,
      componentsLabel: describeComponents(member.components),
    })),
  };
}

/** The family a contribution reads its level from, in player-facing words. */
export function contributionFamilyLabel(
  contribution: Pick<CompanionContribution, 'kind' | 'classRuleIdentity'>,
) {
  if (contribution.kind === 'increase') return 'Character level';
  return (
    classLabels[contribution.classRuleIdentity] ??
    contribution.classRuleIdentity
  );
}

/** The companion sheet's reading of its share of a divided budget. */
export function describeCompanionAllocation(
  contribution: CompanionContribution,
) {
  if (contribution.kind === 'allocation')
    return describeAllocationShare(contribution.allocation);
  if (contribution.kind === 'increase')
    return describeIncrease(contribution.increase);
  if (contribution.kind === 'component')
    return describeComponentShare(contribution.components);
  if (contribution.kind === 'reduced') return describeReduction(contribution);
  return null;
}

type ReducedContribution = Extract<CompanionContribution, { kind: 'reduced' }>;
/**
 * One reduction step's wording (#420): the operation, and whether it rounds
 * down. The trail's label and the description's phrase both derive from it.
 */
function reductionStepWording(step: ProgressionReductionResult) {
  if (step.kind === 'minimum')
    return { operation: `at least ${step.operand}`, isRoundedDown: false };
  return {
    operation: step.operand === 2 ? 'halved' : `divided by ${step.operand}`,
    isRoundedDown: true,
  };
}
/** One reduction step as the operation trail names it. */
export function reductionStepLabel(step: ProgressionReductionResult) {
  const { operation, isRoundedDown } = reductionStepWording(step);
  const label = `${operation.charAt(0).toUpperCase()}${operation.slice(1)}`;
  return isRoundedDown ? `${label}, rounded down` : label;
}
function reductionStepPhrase(step: ProgressionReductionResult) {
  const { operation, isRoundedDown } = reductionStepWording(step);
  return isRoundedDown
    ? `${operation} and rounded down to ${step.result}`
    : operation;
}

/**
 * A reduced progression's operation trail: the actual class level, each
 * step in order and the level the table is read at.
 */
function describeReduction({
  ruleKind,
  classLevels,
  effectiveLevel,
  reduction,
}: ReducedContribution) {
  const rule = getCompanionReductionRule(ruleKind);
  const family = classLabels[rule.classRuleIdentity] ?? rule.classRuleIdentity;
  if (classLevels === null || effectiveLevel === null)
    return `The ${family.toLowerCase()} level is unresolved; ${rule.featureLabel} reduces it before the ${rule.tableLabel} is read.`;
  if (!reduction.steps.length)
    return `${family} level ${classLevels}: no ${rule.tableLabel} level to read.`;
  return `${family} level ${classLevels}, ${reduction.steps.map(reductionStepPhrase).join(', ')}: the ${rule.tableLabel} is read at level ${effectiveLevel}.`;
}

function describeComponentShare({
  allocated,
  budget,
  pool,
}: Extract<CompanionContribution, { kind: 'component' }>['components']) {
  const share = `${describeComponents(allocated)} allocated here`;
  if (!budget || !pool) return `${share}; the brood’s budget is unresolved.`;
  return `${share}, from a brood of ${formatCount(pool.companions, 'eidolon')}.`;
}

function describeAllocationShare({
  levels,
  budget,
  pool,
}: Extract<CompanionContribution, { kind: 'allocation' }>['allocation']) {
  const share = describeShareLevels(levels, budget);
  if (!pool) return `${share}.`;
  return `${share}; ${pool.allocated} allocated across ${formatCount(pool.companions, 'companion')}.`;
}

function describeShareLevels(levels: number | null, budget: number | null) {
  if (levels === null) return 'No effective levels allocated here';
  if (budget === null)
    return `${formatCount(levels, 'effective level')} allocated here; the budget is unresolved`;
  return `${levels} of ${formatCount(budget, 'effective level')} allocated here`;
}

function describeIncrease({
  amount,
  characterLevel,
}: Extract<CompanionContribution, { kind: 'increase' }>['increase']) {
  if (characterLevel === null)
    return `Up to ${amount} more effective levels; the character level is unresolved.`;
  return `Up to ${amount} more effective levels, to at most character level ${characterLevel}.`;
}
