import { activityReviewRequirement } from './weekly-draft-review';
import { activityRollSpec } from './rules-roll-spec';
import {
  actionChoiceRolls,
  type ActivityRollField,
} from './weekly-draft-facts';
import { normalizeRawRoll } from './raw-roll';
import { recruitedTeamId } from './weekly-draft-identities';
import {
  resolveEventAction,
  finishCovertAction,
  type EventActionChange,
} from './rules-event-actions';
import { resolveCharacterChoice } from './rules-character-actions';
import type { CharacterActionChange } from './rules-character-state';
import { projectTreasuryIncome } from './rules-treasury';
import {
  resolveSettlementChoice,
  type SettlementChange,
} from './rules-settlement-actions';
import { actionRestrictions } from './rules-action-eligibility';
import { isTeamUnavailableThisActivity } from './rules-action-teams';
import {
  resolveEconomyChoice,
  prepareEconomy,
  receiveEconomyOrders,
} from './rules-economy';
import type { EconomyChange } from './rules-economy-state';
import { getTeamCost, isUpgradePathAllowed } from './rules-teams';
import teams from './militia-team-table';
import type { OrganizationCheck } from './rules-officers';
import type { WeeklyDraft } from './weekly-draft-contract';
import type { StagedActionChoice } from './weekly-draft-facts';
import type { UpkeepSnapshot } from './rules-upkeep';
import {
  projectRulesFoundations,
  type FoundationInput,
} from './rules-foundations';
import {
  getAdvancementForRank,
  getMinimumTreasuryForRank,
} from './militia-progression-rules';
import { projectOfficers } from './rules-officers';
import { countManagedTeams, getTeamManagerLimit } from './team-manager-rules';
import type { CheckUsage } from './rules-checks';

type Choice = StagedActionChoice;
export type ActivityChange =
  | EventActionChange
  | CharacterActionChange
  | EconomyChange
  | SettlementChange
  | { kind: 'end_persistent_event'; choiceId: string; eventId: string }
  | { kind: 'consume_bonus'; bonusId: string; week: number }
  | {
      kind: 'officers';
      choiceId: string;
      before: UpkeepSnapshot['roster']['officers'];
      after: UpkeepSnapshot['roster']['officers'];
    }
  | {
      kind: 'upgrade_team';
      choiceId: string;
      teamId: string;
      before: string;
      after: string;
    }
  | {
      kind: 'recruit_team';
      choiceId: string;
      team: UpkeepSnapshot['roster']['teams'][number];
    }
  | { kind: 'remove_team'; choiceId: string; teamId: string }
  | {
      kind: 'notoriety' | 'training' | 'treasuryCopper';
      choiceId: string;
      before: number;
      after: number;
    };
export type ActivityProjection = {
  ready: boolean;
  actionResults: { choiceId: string; succeeded: boolean | null }[];
  slots: (WeeklyDraft['activity']['slots'][number] & {
    // An occupied slot beyond the allowance; empty slots are never over it.
    overAllowance: boolean;
    strategistBonus: boolean;
    // The action allowance at this slot's position in the ordered fold, after
    // every earlier choice (including officer changes) has been applied.
    allowance: number;
    // The position lies beyond that allowance, whether or not it is occupied.
    beyondAllowance: boolean;
    // False while this position's allowance can still change: the rank has no
    // table row, an officer lacks character facts, or an earlier officer
    // change within the allowance is not yet applied.
    allowanceKnown: boolean;
  })[];
  // The allowance after every slot, which is what a newly added slot receives.
  allowance: {
    rank: number;
    rankActions: number | null;
    strategistAssigned: boolean;
    actions: number;
    known: boolean;
  };
  outcome: UpkeepSnapshot;
  endedEventIds: string[];
  plan: ActivityChange[];
  requirements: string[];
  warnings: string[];
  // Activity checks also name their organization check and DC for display.
  checks: (ReturnType<typeof projectRulesFoundations>['checks'][number] & {
    organizationCheck?: OrganizationCheck;
    dc?: number;
  })[];
  checkUsage: CheckUsage;
  teamUse: { usedTeamIds: string[]; upgradedTeamIds: string[] };
};
function dice(
  result: ActivityProjection,
  choice: Choice,
  key: ActivityRollField,
) {
  const spec = activityRollSpec(choice.actionId, key);
  if (!spec)
    throw new Error(`No roll specification for ${choice.actionId}:${key}`);
  const { count, sides } = spec;
  const normalized = normalizeRawRoll(actionChoiceRolls(choice)[key], spec);
  if (normalized.status !== 'complete') {
    result.requirements.push(`${choice.choiceId}:${key}:${count}d${sides}`);
    return null;
  }
  if (normalized.rangeWarning)
    result.warnings.push(`${choice.choiceId}:${key}:roll-range`);
  return normalized.diceTotal;
}
function check(
  draft: WeeklyDraft,
  result: ActivityProjection,
  choice: Choice,
  organizationCheck: OrganizationCheck = 'loyalty',
  dc?: number,
) {
  const raw = actionChoiceRolls(choice).check;
  const die = dice(result, choice, 'check');
  const facts = projectRulesFoundations({
    ...foundationInput(draft, result),
    checks: [
      {
        checkId: choice.choiceId,
        phase: 'activity',
        check: organizationCheck,
        choiceId: choice.choiceId,
        die: die ?? undefined,
        helpful: raw?.modifiers.some(
          (modifier) => modifier.sourceId === 'helpful',
        ),
        bonusIds: [
          ...(choice.consumableIds ?? []),
          ...(raw?.modifiers.flatMap((modifier) =>
            modifier.sourceId.startsWith('bonus:')
              ? [modifier.sourceId.slice(6)]
              : [],
          ) ?? []),
        ],
      },
    ],
  });
  // Safe cast: `projectChecks` maps each requested check to one projected
  // check, and exactly one check is requested above.
  const projected = facts.checks[0]!;
  const sources = new Set([
    'rank-focus',
    'gather-tier',
    'knowledge-rank',
    'officers',
    'strategist',
    'helpful',
    'overseer-support',
    ...result.outcome.roster.teams.flatMap((team) =>
      team.managerCharacterId ? [team.managerCharacterId] : [],
    ),
    ...projected.modifiers.map((modifier) => modifier.source),
    ...result.outcome.roster.people.map((person) => person.characterId),
    ...draft.context.carriedEvents.map((event) => event.eventId),
    ...draft.context.queuedEffects.flatMap((effect) => [
      effect.effectId,
      effect.sourceId,
    ]),
  ]);
  for (const modifier of raw?.modifiers ?? []) {
    if (
      sources.has(modifier.sourceId) ||
      /^(bonus|queued|officer|manager|covert):/.test(modifier.sourceId)
    )
      continue;
    sources.add(modifier.sourceId);
    projected.modifiers.push({
      source: modifier.sourceId,
      value: modifier.value,
    });
    projected.modifier += modifier.value;
    if (projected.total !== null) projected.total += modifier.value;
  }
  const covert = result.plan.find(
    (effect) =>
      effect.kind === 'covert_augmentation' &&
      effect.targetChoiceId === choice.choiceId,
  );
  if (covert?.kind === 'covert_augmentation') {
    projected.modifiers.push({
      source: `covert:${covert.choiceId}`,
      value: covert.bonus,
    });
    projected.modifier += covert.bonus;
    if (projected.total !== null) projected.total += covert.bonus;
  }
  const actionModifier =
    choice.actionId === 'gather_information'
      ? {
          source: 'gather-tier',
          value:
            2 *
            (teams.find(
              (entry) =>
                entry.id ===
                result.outcome.roster.teams.find(
                  (team) => team.teamId === choice.teamId,
                )?.teamType,
            )?.tier ?? 0),
        }
      : choice.actionId === 'knowledge_check'
        ? { source: 'knowledge-rank', value: result.outcome.rank }
        : null;
  if (actionModifier) {
    projected.modifiers.push(actionModifier);
    projected.modifier += actionModifier.value;
    if (projected.total !== null) projected.total += actionModifier.value;
  }
  result.checks.push(
    ...facts.checks.map((entry) => ({
      ...entry,
      organizationCheck,
      ...(dc === undefined ? {} : { dc }),
    })),
  );
  result.checkUsage = facts.checkUsage;
  result.requirements.push(
    ...facts.requirements.filter(
      (key) =>
        key === 'rank' ||
        key === 'focus' ||
        key.startsWith('officer:') ||
        key.startsWith('manager:') ||
        key.startsWith(`${choice.choiceId}:`),
    ),
  );
  result.warnings.push(
    ...facts.warnings.filter(
      (key) =>
        key.startsWith(`${choice.choiceId}:`) ||
        key.startsWith('officer:') ||
        key.startsWith('manager:'),
    ),
  );
  // Safe cast: the Activity loop pushes this choice's action result before
  // `resolveChoice` reaches `check`.
  const resolution = result.actionResults.find(
    (entry) => entry.choiceId === choice.choiceId,
  )!;
  resolution.succeeded =
    projected.total === null ? null : dc === undefined || projected.total >= dc;
  return projected.total;
}
function value(
  result: ActivityProjection,
  choice: Choice,
  kind: 'notoriety' | 'training' | 'treasuryCopper',
  delta: number,
) {
  const before = result.outcome[kind];
  const after =
    kind === 'treasuryCopper'
      ? before + delta
      : kind === 'notoriety'
        ? Math.max(0, Math.min(100, before + delta))
        : Math.max(0, before + delta);
  result.outcome[kind] = after;
  result.plan.push({ kind, choiceId: choice.choiceId, before, after });
}
function income(
  draft: WeeklyDraft,
  result: ActivityProjection,
  choice: Choice,
  grossCopper: number,
) {
  const { retainedCopper } = projectTreasuryIncome(
    grossCopper,
    draft.context.carriedEvents,
    result.endedEventIds,
    draft.week,
  );
  value(result, choice, 'treasuryCopper', retainedCopper);
}
function dismiss(
  draft: WeeklyDraft,
  result: ActivityProjection,
  choice: Extract<Choice, { actionId: 'dismiss_team' }>,
) {
  const team = result.outcome.roster.teams.find(
    (team) => team.teamId === choice.targetTeamId,
  );
  if (!team) {
    result.requirements.push(`${choice.choiceId}:target-team`);
    return;
  }
  const total = check(draft, result, choice, 'loyalty', 10);
  if (total === null) return;
  if (total < 10) {
    const gain = dice(result, choice, 'notoriety');
    if (gain === null) return;
    value(result, choice, 'notoriety', gain);
  }
  result.outcome.roster.teams = result.outcome.roster.teams.filter(
    (entry) => entry.teamId !== team.teamId,
  );
  result.plan.push({
    kind: 'remove_team',
    choiceId: choice.choiceId,
    teamId: team.teamId,
  });
}
function exception(
  draft: WeeklyDraft,
  result: ActivityProjection,
  choice: Choice,
  ruleId: string,
) {
  result.warnings.push(`${choice.choiceId}:${ruleId}`);
  if (
    !draft.rulesExceptions.some(
      (entry) =>
        entry.subjectId === choice.choiceId &&
        entry.ruleId === ruleId &&
        entry.reason.trim(),
    )
  ) {
    result.requirements.push(`${choice.choiceId}:${ruleId}:exception`);
    return false;
  }
  return true;
}
function spend(
  draft: WeeklyDraft,
  result: ActivityProjection,
  choice: Choice,
  cost: number,
) {
  if (choice.costCopper !== undefined && choice.costCopper !== cost)
    result.warnings.push(`${choice.choiceId}:calculated-cost`);
  if (
    result.outcome.treasuryCopper < cost &&
    !exception(draft, result, choice, 'treasury')
  )
    return false;
  value(result, choice, 'treasuryCopper', -cost);
  return true;
}
// Whether the choice's recorded check die reads a natural 1. The Activity
// details show a roll the rules use only on a natural 1 by this same reading.
export function isNaturalOneCheck(choice: StagedActionChoice) {
  const spec = activityRollSpec(choice.actionId, 'check');
  return (
    spec !== null &&
    normalizeRawRoll(actionChoiceRolls(choice).check, spec).naturalValue === 1
  );
}
function naturalOne(result: ActivityProjection, choice: Choice) {
  if (!isNaturalOneCheck(choice)) return;
  const gain = dice(result, choice, 'notoriety');
  if (gain !== null) value(result, choice, 'notoriety', gain);
}
function drill(draft: WeeklyDraft, result: ActivityProjection, choice: Choice) {
  if (
    !spend(
      draft,
      result,
      choice,
      getMinimumTreasuryForRank(result.outcome.rank) * 100,
    )
  )
    return;
  const total = check(
    draft,
    result,
    choice,
    'loyalty',
    10 + result.outcome.rank,
  );
  naturalOne(result, choice);
  if (total === null || total < 10 + result.outcome.rank) return;
  const gain = dice(result, choice, 'training');
  const officers = projectOfficers(
    result.outcome.roster,
    result.outcome.characters,
    result.outcome.focus,
  );
  result.requirements.push(...officers.requirements);
  // A commandant's unresolved Hit Dice is part of this Drill's training gain.
  for (const characterId of officers.unresolvedCommandants)
    result.requirements.push(
      `${choice.choiceId}:commandant:${characterId}:unresolved-hit-dice`,
    );
  const multiplier = Math.max(
    1,
    ...draft.context.queuedEffects.flatMap((effect) =>
      effect.startsWeek <= draft.week &&
      effect.endsWeek >= draft.week &&
      effect.effect.kind === 'activity_training_multiplier'
        ? [effect.effect.value]
        : [],
    ),
  );
  if (gain !== null)
    value(
      result,
      choice,
      'training',
      (gain + officers.commandantTrainingBonus) * multiplier,
    );
}
const recruitmentChecks: Record<string, OrganizationCheck | undefined> = {
  Loyalty: 'loyalty',
  Secrecy: 'secrecy',
  Security: 'security',
};
// The recruitment check and DC the team table gives a team type, or null when
// the type has no recruitment rules (recruiting it needs a Rules Exception and
// a table-chosen check).
export function teamRecruitmentCheck(
  teamType: string | undefined,
): { check: OrganizationCheck; dc: number } | null {
  const recruitment = teams.find((team) => team.id === teamType)?.recruitment;
  const check = recruitment ? recruitmentChecks[recruitment.check] : undefined;
  return recruitment && check ? { check, dc: recruitment.dc } : null;
}
function recruit(
  draft: WeeklyDraft,
  result: ActivityProjection,
  choice: Extract<Choice, { actionId: 'recruit_team' }>,
) {
  const definition = teams.find((team) => team.id === choice.teamType);
  if (!definition) {
    result.requirements.push(`${choice.choiceId}:team-type`);
    return;
  }
  if (
    !definition.recruitment &&
    !exception(draft, result, choice, 'recruit-tier')
  )
    return;
  const recruitment = definition.recruitment
    ? teamRecruitmentCheck(definition.id)
    : choice.recruitmentCheck;
  if (!recruitment?.check) {
    result.requirements.push(`${choice.choiceId}:recruitment-check`);
    return;
  }
  const total = check(draft, result, choice, recruitment.check, recruitment.dc);
  naturalOne(result, choice);
  if (total === null || total < recruitment.dc) return;
  const team = {
    teamId: recruitedTeamId(choice.choiceId),
    // Safe cast: `definition` was found by matching `choice.teamType`, so the
    // team type is set.
    teamType: choice.teamType!,
    name: definition.name,
    status: 'active' as const,
    managerCharacterId: null,
    rewardCapExempt: false,
    notes: '',
  };
  if (
    result.outcome.roster.teams.some((entry) => entry.teamId === team.teamId)
  ) {
    result.requirements.push(`${choice.choiceId}:duplicate-team`);
    return;
  }
  result.outcome.roster.teams.push(team);
  result.plan.push({
    kind: 'recruit_team',
    choiceId: choice.choiceId,
    team: { ...team },
  });
}
// Recruitment may precede dismissal: only teams left after executable Activity
// choices consume the final allowance. Incomplete or skipped removals cannot help.
function validateRecruitmentCapacity(
  draft: WeeklyDraft,
  result: ActivityProjection,
) {
  const countedIds = new Set(
    result.outcome.roster.teams
      .filter((team) => !team.rewardCapExempt)
      .map((team) => team.teamId),
  );
  const recruits = result.plan.filter(
    (change): change is Extract<ActivityChange, { kind: 'recruit_team' }> =>
      change.kind === 'recruit_team' && countedIds.has(change.team.teamId),
  );
  const capacity = activityFoundations(draft, result).capacity.teams;
  let count = countedIds.size - recruits.length;
  for (const recruitment of recruits) {
    count++;
    if (count <= capacity) continue;
    const choice = draft.activity.slots.find(
      (slot) => slot.choice?.choiceId === recruitment.choiceId,
    )?.choice;
    if (choice) exception(draft, result, choice, 'team-capacity');
  }
}

function upgradeEligible(
  draft: WeeklyDraft,
  result: ActivityProjection,
  choice: Choice,
  team: UpkeepSnapshot['roster']['teams'][number],
  toTeamType: string,
) {
  const departures: [boolean, string][] = [
    [
      result.teamUse.upgradedTeamIds.includes(team.teamId),
      'team-upgrade-limit',
    ],
    [result.teamUse.usedTeamIds.includes(team.teamId), 'team-action-limit'],
    [team.status !== 'active', 'team-condition'],
    [!isUpgradePathAllowed(team.teamType, toTeamType), 'upgrade-tree'],
  ];
  for (const [violated, ruleId] of departures) {
    if (violated && !exception(draft, result, choice, ruleId)) return false;
  }
  return true;
}
function upgrade(
  draft: WeeklyDraft,
  result: ActivityProjection,
  choice: Extract<Choice, { actionId: 'upgrade_team' }>,
) {
  const team = result.outcome.roster.teams.find(
    (team) => team.teamId === choice.targetTeamId,
  );
  if (!team) {
    result.requirements.push(`${choice.choiceId}:target-team`);
    return;
  }
  if (!choice.toTeamType) {
    result.requirements.push(`${choice.choiceId}:upgrade-type`);
    return;
  }
  if (!upgradeEligible(draft, result, choice, team, choice.toTeamType)) return;
  if (!spend(draft, result, choice, getTeamCost(choice.toTeamType) * 100))
    return;
  result.plan.push({
    kind: 'upgrade_team',
    choiceId: choice.choiceId,
    teamId: team.teamId,
    before: team.teamType,
    after: choice.toTeamType,
  });
  team.teamType = choice.toTeamType;
  result.teamUse.upgradedTeamIds.push(team.teamId);
}
function changeOfficer(
  draft: WeeklyDraft,
  result: ActivityProjection,
  choice: Extract<Choice, { actionId: 'change_officer_role' }>,
) {
  const person = result.outcome.roster.people.find(
    (person) => person.characterId === choice.characterId,
  );
  const character =
    person &&
    result.outcome.characters.find(
      (character) => character.characterId === person.characterId,
    );
  if (!person || !character) {
    result.requirements.push(`${choice.choiceId}:character`);
    return;
  }
  if (!choice.fromRole && !choice.toRole) {
    result.requirements.push(`${choice.choiceId}:officer-role`);
    return;
  }
  if (person.kind !== 'pc' && !exception(draft, result, choice, 'officer-pc'))
    return;
  const before = result.outcome.roster.officers;
  if (
    choice.fromRole &&
    !before.some(
      (officer) =>
        officer.characterId === person.characterId &&
        officer.role === choice.fromRole,
    )
  ) {
    result.requirements.push(`${choice.choiceId}:from-role`);
    return;
  }
  const after = before.filter(
    (officer) =>
      !(
        officer.characterId === person.characterId &&
        officer.role === choice.fromRole
      ),
  );
  if (choice.toRole) {
    if (
      after.some(
        (officer) =>
          officer.characterId === person.characterId &&
          officer.role === choice.toRole,
      )
    ) {
      result.requirements.push(`${choice.choiceId}:duplicate-role`);
      return;
    }
    if (
      after.some((officer) => officer.characterId === person.characterId) &&
      !exception(draft, result, choice, 'officer-role-limit')
    )
      return;
    after.push({ characterId: person.characterId, role: choice.toRole });
  }
  if (
    exceedsLoweredManagerLimit(result, person, character.charisma, after) &&
    !exception(draft, result, choice, 'manager-limit')
  )
    return;
  result.outcome.roster.officers = after;
  result.plan.push({
    kind: 'officers',
    choiceId: choice.choiceId,
    before: structuredClone(before),
    after: structuredClone(after),
  });
}
// Leaving an NPC's last role lowers their manager limit; going over it is a
// departure the table records, never a silent unassignment.
function exceedsLoweredManagerLimit(
  result: ActivityProjection,
  person: UpkeepSnapshot['roster']['people'][number],
  charisma: number,
  officersAfter: UpkeepSnapshot['roster']['officers'],
) {
  const { roster } = result.outcome;
  const getLimit = (officers: UpkeepSnapshot['roster']['officers']) =>
    getTeamManagerLimit({ officers, person, charisma });
  const limitAfter = getLimit(officersAfter);
  return (
    limitAfter < getLimit(roster.officers) &&
    countManagedTeams(roster.teams, person.characterId) > limitAfter
  );
}
export function activityCheckEffects(
  draft: WeeklyDraft,
): FoundationInput['queuedEffects'] {
  let queued = [...draft.context.queuedEffects];
  for (const [eventType, check] of [
    ['low_morale', 'loyalty'],
    ['double_agent', 'secrecy'],
  ] as const) {
    const carried = draft.context.carriedEvents.filter(
      (event) => event.eventType === eventType,
    );
    const sources = new Set(carried.map((event) => event.eventId));
    // Twice makes these events persistent; it does not stack their penalty.
    // Replace queued copies by source, leaving unrelated effects untouched.
    queued = queued.filter(
      (effect) =>
        !(
          (sources.has(effect.sourceId) ||
            (carried.length > 0 && effect.eventType === eventType)) &&
          effect.effect.kind === 'check_modifier' &&
          effect.effect.check === check
        ),
    );
    const event = carried[0];
    if (event)
      queued.push({
        eventType,
        effectId: `persistent:${event.eventId}`,
        sourceId: event.eventId,
        startsWeek: draft.week,
        endsWeek: draft.week,
        effect: { kind: 'check_modifier', check, value: -2 },
      });
  }
  return queued;
}
function foundationInput(
  draft: WeeklyDraft,
  result: ActivityProjection,
): FoundationInput {
  return {
    ...result.outcome,
    week: draft.week,
    slots: draft.activity.slots,
    checks: [],
    operatingSettlementId: draft.activity.operatingSettlementId ?? null,
    queuedEffects: activityCheckEffects(draft),
    activity: result.teamUse,
    checkUsage: result.checkUsage,
  };
}
export function activityFoundations(
  draft: WeeklyDraft,
  result: ActivityProjection,
) {
  return projectRulesFoundations(foundationInput(draft, result));
}
function lieLow(
  draft: WeeklyDraft,
  result: ActivityProjection,
  choice: Choice,
) {
  if (
    draft.activity.slots.filter((slot) => slot.choice).length > 1 &&
    !exception(draft, result, choice, 'lie-low-exclusivity')
  )
    return;
  value(result, choice, 'notoriety', -result.outcome.roster.teams.length);
}
function assignedTeam(
  draft: WeeklyDraft,
  result: ActivityProjection,
  choice: Choice,
) {
  if (!choice.teamId) return true;
  const team = result.outcome.roster.teams.find(
    (team) => team.teamId === choice.teamId,
  );
  if (!team) {
    result.requirements.push(`${choice.choiceId}:team`);
    return false;
  }
  let eligible = true;
  if (isTeamUnavailableThisActivity(draft, team.teamId))
    eligible = exception(draft, result, choice, 'team-unavailable') && eligible;
  if (team.status !== 'active')
    eligible = exception(draft, result, choice, 'team-condition') && eligible;
  if (
    result.teamUse.usedTeamIds.includes(team.teamId) ||
    result.teamUse.upgradedTeamIds.includes(team.teamId)
  )
    eligible =
      exception(draft, result, choice, 'team-action-limit') && eligible;
  if (eligible) result.teamUse.usedTeamIds.push(team.teamId);
  return eligible;
}
function resolveChoice(
  draft: WeeklyDraft,
  result: ActivityProjection,
  choice: Choice,
) {
  if (
    resolveEventAction(draft, result, choice, {
      dice,
      check,
      value,
      exception,
      spend,
      naturalOne,
      income,
    })
  )
    return;
  if (
    resolveEconomyChoice(draft, result, choice, {
      dice,
      check,
      value,
      exception,
      spend,
      naturalOne,
      income,
    })
  )
    return;
  if (
    resolveSettlementChoice(draft, result, choice, {
      dice,
      check,
      value,
      exception,
      spend,
    })
  )
    return;
  if (
    resolveCharacterChoice(draft, result, choice, {
      dice,
      check,
      value,
      exception,
      spend,
      naturalOne,
      income,
    })
  )
    return;
  switch (choice.actionId) {
    case 'change_officer_role':
      return changeOfficer(draft, result, choice);
    case 'dismiss_team':
      return dismiss(draft, result, choice);
    case 'drill_militia':
      return drill(draft, result, choice);
    case 'recruit_team':
      return recruit(draft, result, choice);
    case 'upgrade_team':
      return upgrade(draft, result, choice);
    case 'lie_low':
      return lieLow(draft, result, choice);
    default:
      result.requirements.push(`${choice.choiceId}:unresolved-action`);
  }
}
function isAllowanceKnown(facts: ReturnType<typeof activityFoundations>) {
  return !facts.requirements.some(
    (requirement) =>
      requirement === 'rank' || requirement.startsWith('officer:'),
  );
}
function drillEligible(
  draft: WeeklyDraft,
  result: ActivityProjection,
  choice: Choice,
  earlierDrills: number,
) {
  let eligible = true;
  if (earlierDrills > 0)
    eligible = exception(draft, result, choice, 'drill-limit');
  const cap = activityFoundations(draft, result).progression.highestPcLevel;
  if (cap === null) {
    result.requirements.push(`${choice.choiceId}:highest-level-pc`);
    return false;
  }
  if (result.outcome.rank >= Math.min(cap, 20))
    eligible = exception(draft, result, choice, 'maximum-rank') && eligible;
  return eligible;
}
function consumeBonuses(draft: WeeklyDraft, result: ActivityProjection) {
  for (const bonusId of result.checkUsage.bonusIds) {
    // Safe cast: `projectChecks` records a bonus in `checkUsage.bonusIds`
    // only after finding it in `result.outcome.bonuses`.
    const bonus = result.outcome.bonuses.find(
      (bonus) => bonus.bonusId === bonusId,
    )!;
    bonus.consumedWeek = draft.week;
    result.plan.push({ kind: 'consume_bonus', bonusId, week: draft.week });
  }
}
function requireConsumableTargets(
  draft: WeeklyDraft,
  result: ActivityProjection,
) {
  for (const bonusId of draft.activity.consumableIds)
    if (!result.checkUsage.bonusIds.includes(bonusId))
      result.requirements.push(`activity:consumable:${bonusId}:check`);
  for (const { choice } of draft.activity.slots) {
    if (!choice) continue;
    const check = result.checks.find(
      (check) => check.checkId === choice.choiceId,
    );
    for (const bonusId of choice.consumableIds ?? [])
      if (
        !check?.modifiers.some(
          (modifier) => modifier.source === `bonus:${bonusId}`,
        )
      )
        result.requirements.push(
          `${choice.choiceId}:consumable:${bonusId}:check`,
        );
  }
}
export function projectActivity(
  draft: WeeklyDraft,
  snapshot: UpkeepSnapshot,
): ActivityProjection {
  const result: ActivityProjection = {
    ready: false,
    actionResults: [],
    slots: [],
    outcome: structuredClone(snapshot),
    endedEventIds: [],
    plan: [],
    requirements: [],
    warnings: [],
    checks: [],
    checkUsage: {
      bonusIds: [],
      helpful: false,
      overseerEventId: null,
      overseerCharacterId: null,
    },
    teamUse: { usedTeamIds: [], upgradedTeamIds: [] },
    allowance: {
      rank: snapshot.rank,
      rankActions: null,
      strategistAssigned: false,
      actions: 0,
      known: false,
    },
  };
  prepareEconomy(draft, result);
  let drills = 0;
  // An officer change within the allowance that is not applied (missing
  // facts, a pending exception) could still add or remove the Strategist's
  // action, so every later position's allowance stays unknown.
  let officersSettled = true;
  let officerChange: string | null = null;
  const settleOfficerChange = () => {
    if (
      officerChange &&
      !result.plan.some(
        (change) =>
          change.kind === 'officers' && change.choiceId === officerChange,
      )
    )
      officersSettled = false;
    officerChange = null;
  };
  for (const [index, slot] of draft.activity.slots.entries()) {
    settleOfficerChange();
    const choice = slot.choice;
    const facts = activityFoundations(draft, result);
    const beyondAllowance = index >= facts.capacity.actions;
    const overAllowance = beyondAllowance && choice !== null;
    result.slots.push({
      ...structuredClone(slot),
      overAllowance,
      strategistBonus:
        facts.officers.strategistAssigned &&
        index === facts.capacity.actions - 1,
      allowance: facts.capacity.actions,
      beyondAllowance,
      allowanceKnown: officersSettled && isAllowanceKnown(facts),
    });
    if (!choice) continue;
    if (choice.reviewRequired) {
      result.requirements.push(activityReviewRequirement(choice.choiceId));
      continue;
    }
    if (choice.actionId === 'change_officer_role' && !overAllowance)
      officerChange = choice.choiceId;
    let eligible = true;
    if (overAllowance) {
      result.requirements.push(`${choice.choiceId}:action-capacity`);
      result.warnings.push(`${choice.choiceId}:action-capacity`);
      continue;
    }
    if (choice.actionId === 'drill_militia')
      eligible = drillEligible(draft, result, choice, drills++) && eligible;
    for (const rule of actionRestrictions(draft, choice))
      eligible = exception(draft, result, choice, rule) && eligible;
    if (!eligible) continue;
    if (!assignedTeam(draft, result, choice)) continue;
    result.actionResults.push({ choiceId: choice.choiceId, succeeded: null });
    const planStart = result.plan.length;
    const requirementStart = result.requirements.length;
    resolveChoice(draft, result, choice);
    finishCovertAction(result, choice, planStart, requirementStart);
  }
  settleOfficerChange();
  const final = activityFoundations(draft, result);
  result.allowance = {
    rank: result.outcome.rank,
    rankActions: getAdvancementForRank(result.outcome.rank)?.actions ?? null,
    strategistAssigned: final.officers.strategistAssigned,
    actions: final.capacity.actions,
    known: officersSettled && isAllowanceKnown(final),
  };
  validateRecruitmentCapacity(draft, result);
  receiveEconomyOrders(draft, result);
  consumeBonuses(draft, result);
  requireConsumableTargets(draft, result);
  result.requirements = [...new Set(result.requirements)];
  result.warnings = [...new Set(result.warnings)];
  result.ready = result.requirements.length === 0;
  return result;
}
