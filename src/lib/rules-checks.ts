import type { FoundationInput, FoundationCheck } from './rules-foundations';
import {
  officerAbility,
  unresolvedOfficerAbilities,
  type projectOfficers,
} from './rules-officers';
import type { projectTeams } from './rules-teams';
import type { Ability } from './character-sheet-abilities';
import type { projectSettlements } from './rules-settlements';
import type {
  getOrganizationCheckBonusesForMilitia,
  getAdvancementForRank,
} from './militia-progression-rules';

type CheckFacts = {
  officers: ReturnType<typeof projectOfficers>;
  teams: ReturnType<typeof projectTeams>['teams'];
  operating:
    | ReturnType<typeof projectSettlements>['settlements'][number]
    | undefined;
  base: ReturnType<typeof getOrganizationCheckBonusesForMilitia>;
  row: ReturnType<typeof getAdvancementForRank>;
};
type Modifier = { source: string; value: number };
export type CheckUsage = {
  overseerEventId: string | null;
  overseerCharacterId: string | null;
  helpful: boolean;
  bonusIds: string[];
};
type Composition = {
  modifiers: Modifier[];
  requirements: string[];
  usage: CheckUsage;
  /** A missing choice or an unresolved score: the total decides nothing. */
  isTotalUnknown: boolean;
};

// A score the check reads that the Character's sheet cannot calculate: it is
// required, and its partial total never decides an outcome, even in a preview.
function requireUnresolved(
  check: FoundationCheck,
  result: Composition,
  source: string,
  ability: Ability,
) {
  result.requirements.push(`${check.checkId}:${source}:unresolved-${ability}`);
  result.isTotalUnknown = true;
}

function activityModifiers(
  input: FoundationInput,
  check: FoundationCheck,
  facts: CheckFacts,
  result: Composition,
) {
  if (check.phase !== 'activity') return;
  const slotIndex = input.slots.findIndex(
    (x) => x.choice?.choiceId === check.choiceId,
  );
  const choice = input.slots[slotIndex]?.choice;
  if (!choice) {
    result.requirements.push(`${check.checkId}:choice`);
    result.isTotalUnknown = true;
    return;
  }
  if (facts.officers.strategistAssigned && slotIndex === facts.row?.actions)
    result.modifiers.push({ source: 'strategist', value: 2 });
  managerModifier(choice.teamId, check, facts, result);
}
function managerModifier(
  teamId: string | undefined,
  check: FoundationCheck,
  facts: CheckFacts,
  result: Composition,
) {
  const team = facts.teams.find((x) => x.teamId === teamId);
  if (teamId && !team) result.requirements.push(`${check.checkId}:team`);
  if (team?.manager?.isCharismaUnresolved)
    requireUnresolved(
      check,
      result,
      `manager:${team.manager.characterId}`,
      'charisma',
    );
  if (team?.manager)
    result.modifiers.push({
      source: `manager:${team.manager.characterId}`,
      value: team.manager.bonus,
    });
}
function overseerModifier(
  check: FoundationCheck,
  facts: CheckFacts,
  result: Composition,
) {
  const characterId =
    check.overseerCharacterId ??
    (check.eventId && result.usage.overseerEventId === check.eventId
      ? result.usage.overseerCharacterId
      : null);
  if (!characterId) return;
  const overseer = facts.officers.overseers.find(
    (x) => x.characterId === characterId,
  );
  if (!overseer || (check.phase !== 'event' && check.phase !== 'persistent'))
    result.requirements.push(`${check.checkId}:overseer-ineligible`);
  else if (!check.eventId)
    result.requirements.push(`${check.checkId}:overseer-event`);
  else if (
    result.usage.overseerEventId &&
    result.usage.overseerEventId !== check.eventId
  )
    result.requirements.push(`${check.checkId}:overseer-already-used`);
  else if (
    result.usage.overseerEventId === check.eventId &&
    result.usage.overseerCharacterId !== characterId
  )
    result.requirements.push(`${check.checkId}:overseer-conflict`);
  else {
    for (const ability of unresolvedOfficerAbilities(overseer, check.check))
      requireUnresolved(check, result, `overseer:${characterId}`, ability);
    result.modifiers.push({
      source: 'overseer-support',
      value: officerAbility(overseer, check.check),
    });
    result.usage.overseerEventId = check.eventId;
    result.usage.overseerCharacterId = characterId;
  }
}
function helpfulModifier(
  check: FoundationCheck,
  facts: CheckFacts,
  result: Composition,
) {
  if (!check.helpful) return;
  if (check.phase !== 'activity' || facts.operating?.reputation !== 'Helpful')
    result.requirements.push(`${check.checkId}:helpful-ineligible`);
  else if (result.usage.helpful)
    result.requirements.push(`${check.checkId}:helpful-already-used`);
  else {
    result.modifiers.push({ source: 'helpful', value: 2 });
    result.usage.helpful = true;
  }
}
function carriedModifiers(
  input: FoundationInput,
  check: FoundationCheck,
  result: Composition,
) {
  const teamId =
    check.teamId ??
    input.slots.find((slot) => slot.choice?.choiceId === check.choiceId)?.choice
      ?.teamId;
  for (const bonusId of new Set(check.bonusIds)) {
    const bonus = input.bonuses.find((x) => x.bonusId === bonusId);
    if (
      !bonus ||
      (bonus.check !== 'any' && bonus.check !== check.check) ||
      (bonus.teamId !== undefined && bonus.teamId !== teamId) ||
      (bonus.phase !== undefined && bonus.phase !== check.phase) ||
      bonus.availableWeek !== input.week ||
      bonus.consumedWeek !== null ||
      result.usage.bonusIds.includes(bonusId)
    )
      result.requirements.push(`${check.checkId}:bonus:${bonusId}:unavailable`);
    else {
      result.modifiers.push({ source: `bonus:${bonusId}`, value: bonus.value });
      result.usage.bonusIds.push(bonusId);
    }
  }
}
function queuedModifiers(input: FoundationInput, check: FoundationCheck) {
  const sources = new Set<string>();
  return input.queuedEffects.flatMap((queued) => {
    const source =
      queued.eventType === 'double_agent' || queued.eventType === 'low_morale'
        ? queued.eventType
        : queued.sourceId;
    if (
      queued.startsWeek > input.week ||
      queued.endsWeek < input.week ||
      queued.effect.kind !== 'check_modifier' ||
      queued.effect.check !== check.check ||
      (queued.effect.phase !== undefined &&
        queued.effect.phase !== check.phase) ||
      sources.has(source)
    )
      return [];
    sources.add(source);
    return [
      { source: `queued:${queued.sourceId}`, value: queued.effect.value },
    ];
  });
}
function checkTotal(
  check: FoundationCheck,
  modifier: number,
  requirements: string[],
  warnings: string[],
) {
  if (check.die === undefined) {
    requirements.push(`${check.checkId}:roll`);
    return null;
  }
  if (!Number.isSafeInteger(check.die)) {
    requirements.push(`${check.checkId}:invalid-roll`);
    return null;
  }
  if (check.die < 1 || check.die > 20)
    warnings.push(`${check.checkId}:roll-range`);
  return check.die + modifier;
}

// Ordered occurrences reserve one-use benefits, including while dice are missing.
// Usage can be carried across calls when an intervening action changes the roster.
export function projectChecks(input: FoundationInput, facts: CheckFacts) {
  const requirements: string[] = [];
  const warnings: string[] = [];
  const usage: CheckUsage = {
    overseerEventId: input.checkUsage?.overseerEventId ?? null,
    overseerCharacterId: input.checkUsage?.overseerCharacterId ?? null,
    helpful: input.checkUsage?.helpful ?? false,
    bonusIds: [...(input.checkUsage?.bonusIds ?? [])],
  };
  const checks = input.checks.map((check) => {
    const result: Composition = {
      requirements: [],
      usage,
      isTotalUnknown: false,
      modifiers: [
        { source: 'rank-focus', value: facts.base[check.check] },
        { source: 'officers', value: facts.officers.bonuses[check.check] },
      ],
    };
    activityModifiers(input, check, facts, result);
    if (check.phase !== 'activity')
      managerModifier(check.teamId, check, facts, result);
    if (result.requirements.length === 0) {
      overseerModifier(check, facts, result);
      helpfulModifier(check, facts, result);
      carriedModifiers(input, check, result);
    }
    // The officers' bonus reads their abilities; an unresolved one is
    // required before this check, and so this week, can be confirmed.
    for (const { characterId, ability } of facts.officers.unresolvedBonuses[
      check.check
    ])
      requireUnresolved(check, result, `officer:${characterId}`, ability);
    result.modifiers.push(...queuedModifiers(input, check));
    const modifier = result.modifiers.reduce((sum, x) => sum + x.value, 0);
    const total = checkTotal(check, modifier, result.requirements, warnings);
    requirements.push(...result.requirements);
    return {
      checkId: check.checkId,
      modifiers: result.modifiers,
      modifier,
      total: result.isTotalUnknown ? null : total,
    };
  });
  return { checks, requirements, warnings, usage };
}
