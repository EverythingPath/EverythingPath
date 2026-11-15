import { RULE_ROLL_SPECS } from './rules-roll-spec';
import { isRefugeActive } from './rules-settlements';
import type { EventDispatch } from './rules-event-selection';
import type { EventOutcomeProjection } from './rules-event-outcomes';
import type { UpkeepSnapshot } from './rules-upkeep';
import type { WeeklyDraft } from './weekly-draft-contract';
import type { TrackedCharacter } from './rules-character-state';
import {
  eventCheck,
  eventDie,
  eventMitigationAttempted,
  eventOfficerCheckExtras,
} from './rules-event-checks';
type Event = EventDispatch['event'];
/** Sickness Twice: the team is lost unless the militia makes this Loyalty DC. */
export const SICKNESS_TWICE_LOYALTY_DC = 20;
/** Raid mitigation: the Security DC each hidden person's check must reach. */
export const RAID_SECURITY_DC = 20;
/** A hidden person's capture chance (percent) without and with mitigation. */
export const RAID_CAPTURE_CHANCE = { unmitigated: 100, mitigated: 50 } as const;
/** Turncoat Twice: the officer's Diplomacy DC that keeps the team. */
export function turncoatDiplomacyDc(rank: number) {
  return 10 + rank;
}
/** Invasion: the GM's random encounter is at CR `APL + 1`. */
export function invasionChallengeRating(averagePartyLevel: number) {
  return averagePartyLevel + 1;
}
/** Cache Discovered mitigation: the Secrecy DC that retrieves the cache. */
export function cacheSecrecyDc(rank: number) {
  return 10 + rank;
}
/** A cache Cache Discovered can find: hidden, or planned for retrieval. */
export function isDiscoverableCache(cache: { status: string }) {
  return cache.status === 'hidden' || cache.status === 'returning';
}
type Cache = NonNullable<UpkeepSnapshot['economy']>['caches'][number];
type Queue = WeeklyDraft['context']['queuedEffects'][number];
export type ThreatEventChange =
  | { kind: 'event_cache'; eventId: string; before: Cache; after: Cache }
  | {
      kind: 'event_item_location';
      eventId: string;
      itemId: string;
      before: string;
      after: 'held' | 'lost';
    }
  | {
      kind: 'event_team_status';
      eventId: string;
      teamId: string;
      before: string;
      after: 'disabled' | 'missing' | 'active';
    }
  | { kind: 'event_team_loss'; eventId: string; teamId: string }
  | {
      kind: 'event_refuge';
      eventId: string;
      settlementId: string;
      before: number | null;
      after: null;
    }
  | {
      kind: 'event_person';
      eventId: string;
      before: TrackedCharacter;
      after: TrackedCharacter;
    }
  | {
      kind: 'event_capture';
      eventId: string;
      characterId: string;
      chance: number;
      roll: number | null;
      captured: boolean;
    }
  | {
      kind: 'event_encounter';
      eventId: string;
      averagePartyLevel: number;
      challengeRating: number;
      acknowledgement: WeeklyDraft['acknowledgements'][number];
    }
  | {
      kind: 'event_officer_check';
      eventId: string;
      characterId: string;
      skill: 'diplomacy' | 'bluff' | 'intimidate';
      total: number;
      dc: number;
      succeeded: boolean;
    };

type ThreatEventContext = {
  draft: WeeklyDraft;
  result: EventOutcomeProjection;
  event: EventDispatch['event'];
  firstEventId: string;
  twice: boolean;
  state: EventOutcomeProjection['outcome'];
};

export function resolveThreatEvent(
  draft: WeeklyDraft,
  result: EventOutcomeProjection,
  dispatch: EventDispatch,
) {
  const context: ThreatEventContext = {
    draft,
    result,
    event: dispatch.event,
    firstEventId: dispatch.firstEventId,
    twice: dispatch.mode === 'twice',
    state: result.outcome,
  };
  switch (dispatch.event.eventType) {
    case 'cache_discovered':
      return resolveCacheDiscovered(context);
    case 'invasion':
      return resolveInvasion(context);
    case 'missing_in_action':
      return resolveMissingInAction(context);
    case 'sickness':
      return resolveSickness(context);
    case 'turncoat':
      return resolveTurncoat(context);
    case 'raid':
      return resolveRaid(context);
    default:
      return false;
  }
}

function requireThreatInput(context: ThreatEventContext, key: string) {
  const { result, event } = context;
  result.requirements.push(`${event.eventId}:${key}`);
}

function recordThreatAcknowledgement(context: ThreatEventContext) {
  const { draft, result, event } = context;

  const acknowledgement = draft.acknowledgements.find(
    (entry) =>
      entry.subjectId === `event:${event.eventId}` && entry.outcome.trim(),
  );
  if (!acknowledgement) requireThreatInput(context, 'acknowledgement');
  else
    result.plan.push({
      kind: 'event_acknowledgement',
      eventId: event.eventId,
      acknowledgement,
    });
  return acknowledgement;
}

function acceptThreatException(context: ThreatEventContext, ruleId: string) {
  const { draft, result, event } = context;

  result.warnings.push(`${event.eventId}:${ruleId}`);
  const accepted = draft.rulesExceptions.some(
    (entry) =>
      entry.subjectId === event.eventId &&
      entry.ruleId === ruleId &&
      entry.reason.trim(),
  );
  if (!accepted) requireThreatInput(context, `${ruleId}:exception`);
  return accepted;
}

function findThreatTeam(context: ThreatEventContext) {
  const { event, state } = context;

  const targets =
    event.targets?.filter((target) => target.kind === 'team') ?? [];
  const team =
    targets.length === 1
      ? state.roster.teams.find(
          // Safe cast: the `targets.length === 1` branch proves the threatened
          // team target.
          (team) => team.teamId === targets[0]!.teamId,
        )
      : undefined;
  if (!team)
    requireThreatInput(
      context,
      state.roster.teams.length ? 'team' : 'replacement:1',
    );
  return team;
}

function setThreatTeamStatus(
  context: ThreatEventContext,
  team: UpkeepSnapshot['roster']['teams'][number],
  after: 'disabled' | 'missing' | 'active',
) {
  const { result, event } = context;

  const before = team.status;
  team.status = after;
  result.plan.push({
    kind: 'event_team_status',
    eventId: event.eventId,
    teamId: team.teamId,
    before,
    after,
  });
}

function loseThreatTeam(context: ThreatEventContext, teamId: string) {
  const { result, event, state } = context;

  state.roster.teams = state.roster.teams.filter(
    (team) => team.teamId !== teamId,
  );
  state.bonuses = state.bonuses.filter((bonus) => bonus.teamId !== teamId);
  result.queuedEffects = result.queuedEffects.filter(
    (effect) => !('teamId' in effect.effect) || effect.effect.teamId !== teamId,
  );
  result.plan.push({
    kind: 'event_team_loss',
    eventId: event.eventId,
    teamId,
  });
}

function queueThreatEffect(
  context: ThreatEventContext,
  effect: Queue['effect'],
  sourceId: string,
) {
  const { draft, result, event } = context;

  const queued: Queue = {
    effectId: `event:${sourceId}:${effect.kind}`,
    sourceId,
    startsWeek: draft.week + 1,
    endsWeek: draft.week + 1,
    effect,
  };
  result.queuedEffects = result.queuedEffects.filter(
    (entry) => entry.effectId !== queued.effectId,
  );
  result.queuedEffects.push(queued);
  result.plan = result.plan.filter(
    (change) =>
      change.kind !== 'event_queue' ||
      change.effect.effectId !== queued.effectId,
  );
  result.plan.push({
    kind: 'event_queue',
    eventId: event.eventId,
    effect: queued,
  });
}

function checkThreatMitigation(
  context: ThreatEventContext,
  target: NonNullable<Event['targets']>[number],
  check: 'security' | 'secrecy',
  dc: number,
) {
  const { draft, result, event } = context;

  const input = event.targetChecks?.find((input) =>
    target.kind === 'cache'
      ? input.target.kind === 'cache' && input.target.cacheId === target.cacheId
      : target.kind === 'character' &&
        input.target.kind === 'character' &&
        input.target.characterId === target.characterId,
  );
  const attempted = eventMitigationAttempted(
    input?.mitigation,
    input?.rolls?.check,
  );
  if (!attempted) return false;
  const targetId =
    'cacheId' in target
      ? target.cacheId
      : 'characterId' in target
        ? target.characterId
        : event.eventId;
  const total = eventCheck(
    draft,
    result,
    event,
    check,
    input?.rolls?.check,
    `${event.eventId}:${targetId}:mitigation`,
  );
  return total === null ? null : total >= dc;
}

function resolveCacheDiscovered(context: ThreatEventContext) {
  const { event, twice, state } = context;

  const eligible = state.economy?.caches.filter(isDiscoverableCache) ?? [];
  // The actual Twice clause explicitly says no additional effect with no caches.
  if (!eligible.length) {
    if (!twice) requireThreatInput(context, 'replacement:1');
    return true;
  }
  const targets =
    event.targets?.filter((target) => target.kind === 'cache') ?? [];
  const caches = twice
    ? eligible
    : targets.length === 1
      ? eligible.filter(
          // Safe cast: the `targets.length === 1` branch proves the sole cache
          // target.
          (cache) => cache.cacheId === targets[0]!.cacheId,
        )
      : [];
  if (!caches.length) {
    requireThreatInput(context, 'cache');
    return true;
  }
  for (const input of event.targetChecks ?? [])
    if (
      input.target.kind !== 'cache' ||
      !caches.some(
        (cache) =>
          input.target.kind === 'cache' &&
          cache.cacheId === input.target.cacheId,
      )
    )
      requireThreatInput(context, 'mitigation-target');
  for (const cache of caches) resolveDiscoveredCache(context, cache);
  return true;
}

function resolveInvasion(context: ThreatEventContext) {
  const { result, event } = context;

  const acknowledgement = recordThreatAcknowledgement(context);
  if (event.averagePartyLevel === undefined)
    requireThreatInput(context, 'average-party-level');
  else if (acknowledgement)
    result.plan.push({
      kind: 'event_encounter',
      eventId: event.eventId,
      averagePartyLevel: event.averagePartyLevel,
      challengeRating: invasionChallengeRating(event.averagePartyLevel),
      acknowledgement,
    });
  return true;
}

function resolveMissingInAction(context: ThreatEventContext) {
  const { result, firstEventId, twice } = context;

  const team = findThreatTeam(context);
  const acknowledgement = recordThreatAcknowledgement(context);
  if (!team || !acknowledgement) return true;
  if (
    !result.teamUse.usedTeamIds.includes(team.teamId) &&
    !acceptThreatException(context, 'team-operated')
  )
    return true;
  if (twice) {
    const original = result.plan.find(
      (change) =>
        change.kind === 'event_team_status' && change.eventId === firstEventId,
    );
    if (
      original?.kind !== 'event_team_status' ||
      original.teamId !== team.teamId
    ) {
      requireThreatInput(context, 'same-team');
      return true;
    }
  }
  setThreatTeamStatus(context, team, 'missing');
  const sourceId = `${firstEventId}:${team.teamId}`;
  queueThreatEffect(
    context,
    { kind: 'team_unavailable', teamId: team.teamId },
    sourceId,
  );
  queueThreatEffect(
    context,
    {
      kind: 'team_return',
      teamId: team.teamId,
      status: twice ? 'disabled' : 'active',
    },
    sourceId,
  );
  return true;
}

function resolveSickness(context: ThreatEventContext) {
  const { draft, result, event, firstEventId, twice } = context;

  const team = findThreatTeam(context);
  const acknowledgement = recordThreatAcknowledgement(context);
  if (!team || !acknowledgement) return true;
  if (!twice) {
    setThreatTeamStatus(context, team, 'disabled');
    return true;
  }
  const original = result.plan.find(
    (change) =>
      change.kind === 'event_team_status' && change.eventId === firstEventId,
  );
  if (
    original?.kind !== 'event_team_status' ||
    original.teamId !== team.teamId
  ) {
    requireThreatInput(context, 'same-team');
    return true;
  }
  const total = eventCheck(
    draft,
    result,
    event,
    'loyalty',
    event.rolls?.check,
    `${event.eventId}:sickness`,
  );
  if (total !== null && total < SICKNESS_TWICE_LOYALTY_DC)
    loseThreatTeam(context, team.teamId);
  return true;
}

function resolveTurncoat(context: ThreatEventContext) {
  const { result, event, firstEventId, twice, state } = context;

  if (!twice) return applyTurncoatTrainingLoss(context);
  const team = findThreatTeam(context);
  const acknowledgement = recordThreatAcknowledgement(context);
  if (!team || !acknowledgement) return true;
  const input = event.officerCheck;
  if (!input) {
    requireThreatInput(context, 'officer-check');
    return true;
  }
  if (
    !state.characters.some(
      (character) => character.characterId === input.characterId,
    )
  ) {
    requireThreatInput(context, 'officer');
    return true;
  }
  if (
    !state.roster.officers.some(
      (officer) => officer.characterId === input.characterId,
    ) &&
    !acceptThreatException(context, 'officer')
  )
    return true;
  if (
    input.skill !== 'diplomacy' &&
    !acceptThreatException(context, 'officer-skill')
  )
    return true;
  const raw = eventDie(
    result,
    input.roll,
    `${event.eventId}:diplomacy`,
    RULE_ROLL_SPECS.check,
  );
  if (input.skillBonus === undefined)
    requireThreatInput(context, 'skill-bonus');
  if (raw === null || input.skillBonus === undefined) return true;
  const total =
    raw +
    input.skillBonus +
    eventOfficerCheckExtras(input.roll).reduce(
      (sum, extra) => sum + extra.value,
      0,
    );
  const dc = turncoatDiplomacyDc(state.rank);
  const succeeded = total >= dc;
  result.plan.push({
    kind: 'event_officer_check',
    eventId: event.eventId,
    characterId: input.characterId,
    skill: input.skill,
    total,
    dc,
    succeeded,
  });
  if (succeeded)
    queueThreatEffect(
      context,
      { kind: 'team_unavailable', teamId: team.teamId, phase: 'activity' },
      `${firstEventId}:${team.teamId}`,
    );
  else loseThreatTeam(context, team.teamId);
  return true;
}

function resolveRaid(context: ThreatEventContext) {
  const { draft, result, event, state } = context;

  const targets =
    event.targets?.filter((target) => target.kind === 'settlement') ?? [];
  const town =
    targets.length === 1
      ? state.settlements.find(
          // Safe cast: the `targets.length === 1` branch proves the raided
          // settlement target.
          (town) => town.settlementId === targets[0]!.settlementId,
        )
      : undefined;
  if (!town) {
    requireThreatInput(context, 'settlement');
    return true;
  }
  const active = isRefugeActive(town, draft.week);
  if (!active && !acceptThreatException(context, 'event-eligibility'))
    return true;
  if (!recordThreatAcknowledgement(context)) return true;
  if (!state.characterActions) {
    requireThreatInput(context, 'tracked-people');
    return true;
  }
  const people = state.characterActions.people.filter(
    (person) =>
      person.status === 'hidden' &&
      person.location.kind === 'refuge' &&
      person.location.settlementId === town.settlementId,
  );
  for (const input of event.targetChecks ?? [])
    if (
      input.target.kind !== 'character' ||
      !people.some(
        (person) =>
          input.target.kind === 'character' &&
          person.characterId === input.target.characterId,
      )
    )
      requireThreatInput(context, 'mitigation-target');
  const before = town.refugeActiveUntilWeek;
  town.refugeActivatedWeek = null;
  town.refugeActiveUntilWeek = null;
  result.plan.push({
    kind: 'event_refuge',
    eventId: event.eventId,
    settlementId: town.settlementId,
    before,
    after: null,
  });
  for (const person of people) resolveRaidCapture(context, person);
  return true;
}

export function finishEventTeamReturns(
  draft: WeeklyDraft,
  result: EventOutcomeProjection,
) {
  for (const queued of draft.context.queuedEffects) {
    if (
      queued.effect.kind !== 'team_return' ||
      queued.startsWeek > draft.week ||
      queued.endsWeek < draft.week
    )
      continue;
    const team = result.outcome.roster.teams.find(
      (team) =>
        queued.effect.kind === 'team_return' &&
        team.teamId === queued.effect.teamId,
    );
    if (team?.status !== 'missing') continue;
    if (
      result.queuedEffects.some(
        (effect) =>
          effect.effect.kind === 'team_return' &&
          effect.effect.teamId === team.teamId &&
          effect.startsWeek > draft.week,
      )
    )
      continue;
    const before = team.status;
    team.status = queued.effect.status;
    result.plan.push({
      kind: 'event_team_status',
      eventId: queued.sourceId,
      teamId: team.teamId,
      before,
      after: team.status,
    });
  }
}

function resolveDiscoveredCache(context: ThreatEventContext, cache: Cache) {
  const { result, state, event } = context;

  const recovered = checkThreatMitigation(
    context,
    { kind: 'cache', cacheId: cache.cacheId },
    'secrecy',
    cacheSecrecyDc(state.rank),
  );
  if (recovered === null) return;
  // Safe cast: discovered caches come from `state.economy.caches`, so the
  // economy exists whenever a cache reaches this function.
  const economy = state.economy!;
  if (
    cache.itemIds.some(
      (itemId) => !economy.items.some((item) => item.itemId === itemId),
    )
  ) {
    requireThreatInput(context, `cache:${cache.cacheId}:items`);
    return;
  }
  const before = structuredClone(cache);
  cache.status = recovered ? 'retrieved' : 'lost';
  cache.returnActivityWeek = null;
  result.plan.push({
    kind: 'event_cache',
    eventId: event.eventId,
    before,
    after: structuredClone(cache),
  });
  for (const itemId of cache.itemIds) {
    const item = economy.items.find((item) => item.itemId === itemId);
    if (!item) {
      requireThreatInput(context, `cache:${cache.cacheId}:item:${itemId}`);
      continue;
    }
    const before = item.location;
    item.location = recovered ? 'held' : 'lost';
    result.plan.push({
      kind: 'event_item_location',
      eventId: event.eventId,
      itemId,
      before,
      after: item.location,
    });
  }
}

function resolveRaidCapture(
  context: ThreatEventContext,
  person: TrackedCharacter,
) {
  const { draft, result, event } = context;

  const target = {
    kind: 'character' as const,
    characterId: person.characterId,
  };
  const mitigated = checkThreatMitigation(
    context,
    target,
    'security',
    RAID_SECURITY_DC,
  );
  if (mitigated === null) return;
  const chance = mitigated
    ? RAID_CAPTURE_CHANCE.mitigated
    : RAID_CAPTURE_CHANCE.unmitigated;
  const input = event.targetChecks?.find(
    (input) =>
      input.target.kind === 'character' &&
      input.target.characterId === person.characterId,
  );
  const captureRoll = mitigated
    ? eventDie(
        result,
        input?.rolls?.loss,
        `${event.eventId}:${person.characterId}:capture`,
        RULE_ROLL_SPECS.percentile,
      )
    : null;
  if (mitigated && captureRoll === null) return;
  const captured = captureRoll === null || captureRoll <= chance;
  result.plan.push({
    kind: 'event_capture',
    eventId: event.eventId,
    characterId: person.characterId,
    chance,
    roll: captureRoll,
    captured,
  });
  if (captured) {
    const before = structuredClone(person);
    person.status = 'captured';
    person.capture = { source: 'raid', week: draft.week };
    person.directRescueRequired = false;
    result.plan.push({
      kind: 'event_person',
      eventId: event.eventId,
      before,
      after: structuredClone(person),
    });
  }
}

function applyTurncoatTrainingLoss(context: ThreatEventContext) {
  const { result, state, event } = context;

  const loss = eventDie(
    result,
    event.rolls?.loss,
    `${event.eventId}:loss`,
    RULE_ROLL_SPECS.singleD6,
  );
  if (loss !== null) {
    const before = state.training;
    state.training = Math.max(0, state.training - loss - state.rank);
    result.plan.push({
      kind: 'event_training',
      eventId: event.eventId,
      before,
      after: state.training,
    });
  }
  return true;
}
