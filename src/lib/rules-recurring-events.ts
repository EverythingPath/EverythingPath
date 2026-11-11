import { RULE_ROLL_SPECS } from './rules-roll-spec';
import type { EventOutcomeProjection } from './rules-event-outcomes';
import type { EventDispatch } from './rules-event-selection';
import type { WeeklyDraft } from './weekly-draft-contract';
import {
  eventCheck,
  eventDie,
  eventMitigationAttempted,
  eventOfficerCheckExtras,
} from './rules-event-checks';
/** Theft mitigation: the Loyalty DC that keeps 90% of the treasury. */
export const THEFT_LOYALTY_DC = 20;
/** Rivalry Twice: the officer's Bluff, Diplomacy or Intimidate DC. */
export const RIVALRY_OFFICER_DC = 20;
type Persistent = WeeklyDraft['context']['carriedEvents'][number];
type Queue = WeeklyDraft['context']['queuedEffects'][number];
export type RecurringEventChange =
  | { kind: 'event_persistent'; eventId: string; event: Persistent }
  | { kind: 'event_end'; eventId: string; endedEventId: string }
  | {
      kind: 'event_treasury';
      eventId: string;
      before: number;
      after: number;
      retainedPercent: number;
    }
  | { kind: 'event_activity_bonus'; eventId: string; value: number };

type RecurringEventContext = {
  draft: WeeklyDraft;
  result: EventOutcomeProjection;
  event: EventDispatch['event'];
  firstEventId: string;
  twice: boolean;
};

export function resolveRecurringEvent(
  draft: WeeklyDraft,
  result: EventOutcomeProjection,
  dispatch: EventDispatch,
) {
  const context: RecurringEventContext = {
    draft,
    result,
    event: dispatch.event,
    firstEventId: dispatch.firstEventId,
    twice: dispatch.mode === 'twice',
  };
  switch (dispatch.event.eventType) {
    case 'calm_before_the_storm':
      return resolveCalmBeforeTheStorm(context);
    case 'double_agent':
    case 'low_morale':
      return resolveCheckPenaltyEvent(context);
    case 'hidden_agenda':
      return resolveHiddenAgenda(context);
    case 'high_morale':
      return resolveHighMorale(context);
    case 'rivalry':
      return resolveRivalry(context);
    case 'theft':
      return resolveTheft(context);
    case 'week_of_pain':
    case 'week_of_serenity':
      return resolveWeekModifierEvent(context);
    default:
      return false;
  }
}

function requireRecurringInput(context: RecurringEventContext, key: string) {
  const { result, event } = context;
  result.requirements.push(`${event.eventId}:${key}`);
}

function queueRecurringEffect(
  context: RecurringEventContext,
  effect: Queue['effect'],
  startsWeek = context.draft.week + 1,
  endsWeek = context.draft.week + 1,
  suffix = '',
) {
  const { result, event, firstEventId } = context;

  const queued: Queue = {
    eventType: event.eventType,
    effectId: `event:${firstEventId}:${effect.kind}${suffix}`,
    sourceId: firstEventId,
    startsWeek,
    endsWeek,
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
    eventId: firstEventId,
    effect: queued,
  });
}

function dropRecurringQueues(context: RecurringEventContext) {
  const { result, firstEventId } = context;

  result.queuedEffects = result.queuedEffects.filter(
    (effect) => effect.sourceId !== firstEventId,
  );
  result.plan = result.plan.filter(
    (change) =>
      change.kind !== 'event_queue' || change.effect.sourceId !== firstEventId,
  );
}

function persistRecurringEvent(
  context: RecurringEventContext,
  targets: Persistent['targets'] = [],
) {
  const { draft, result, event, firstEventId } = context;

  dropRecurringQueues(context);
  const existing = result.persistentEvents.find(
    (entry) => entry.eventId === firstEventId,
  );
  const persistent: Persistent = {
    eventId: firstEventId,
    // Safe cast: only the `resolveRecurringEvent` cases, each matching a
    // concrete `eventType`, reach this function.
    eventType: event.eventType!,
    startedWeek: draft.week,
    order:
      existing?.order ??
      Math.max(-1, ...result.persistentEvents.map((entry) => entry.order)) + 1,
    targets,
    sourceEventIds: [...new Set([firstEventId, event.eventId])],
  };
  result.persistentEvents = result.persistentEvents.filter(
    (entry) => entry.eventId !== firstEventId,
  );
  result.persistentEvents.push(persistent);
  result.plan = result.plan.filter(
    (change) =>
      change.kind !== 'event_persistent' ||
      change.event.eventId !== firstEventId,
  );
  result.plan.push({
    kind: 'event_persistent',
    eventId: firstEventId,
    event: persistent,
  });
}

function endRecurringEvent(context: RecurringEventContext, eventId: string) {
  const { result, event } = context;

  result.persistentEvents = result.persistentEvents.filter(
    (entry) => entry.eventId !== eventId,
  );
  result.endedEventIds.push(eventId);
  result.queuedEffects = result.queuedEffects.filter(
    (effect) => effect.sourceId !== eventId,
  );
  result.plan.push({
    kind: 'event_end',
    eventId: event.eventId,
    endedEventId: eventId,
  });
}

function resolveCalmBeforeTheStorm(context: RecurringEventContext) {
  const { twice } = context;
  queueRecurringEffect(context, {
    kind: 'automatic_events',
    count: twice ? 2 : 1,
  });
  return true;
}

function resolveCheckPenaltyEvent(context: RecurringEventContext) {
  const { draft, event, twice } = context;

  if (twice) persistRecurringEvent(context);
  else {
    queueRecurringEffect(
      context,
      {
        kind: 'check_modifier',
        check: event.eventType === 'double_agent' ? 'secrecy' : 'loyalty',
        value: -2,
      },
      draft.week,
    );
    if (event.eventType === 'double_agent')
      queueRecurringEffect(context, {
        kind: 'block_action',
        actionId: 'secure_cache',
      });
  }
  return true;
}

function resolveHiddenAgenda(context: RecurringEventContext) {
  const { result, firstEventId, twice } = context;

  result.plan = result.plan.filter(
    (change) =>
      change.kind !== 'event_activity_bonus' || change.eventId !== firstEventId,
  );
  result.plan.push({
    kind: 'event_activity_bonus',
    eventId: firstEventId,
    value: twice ? 5 : 2,
  });
  return true;
}

/**
 * How many carried events one High Morale ends: one, or what is left of two
 * for its Twice after the earlier occurrence's endings, and never more than
 * are current when it resolves.
 */
export function highMoraleEndingCount({
  twice,
  endedEarlier,
  current,
}: {
  twice: boolean;
  endedEarlier: number;
  current: number;
}) {
  return Math.min((twice ? 2 : 1) - endedEarlier, current);
}

function resolveHighMorale(context: RecurringEventContext) {
  const { result, event, firstEventId, twice } = context;

  const earlier = result.plan.filter(
    (change) =>
      change.kind === 'event_end' &&
      [firstEventId, event.eventId].includes(change.eventId),
  );
  const count = highMoraleEndingCount({
    twice,
    endedEarlier: earlier.length,
    current: result.persistentEvents.length,
  });
  const targets = event.targets?.filter((target) => target.kind === 'event');
  const ordered = [...result.persistentEvents].sort(
    (a, b) =>
      a.startedWeek - b.startedWeek ||
      a.order - b.order ||
      a.eventId.localeCompare(b.eventId),
  );
  const ids = targets
    ? targets
        .map((target) => target.eventId)
        .filter(
          (id) =>
            !earlier.some(
              (change) =>
                change.kind === 'event_end' && change.endedEventId === id,
            ),
        )
    : ordered.slice(0, count).map((entry) => entry.eventId);
  if (
    ids.length !== count ||
    new Set(ids).size !== ids.length ||
    ids.some(
      (id) => !result.persistentEvents.some((entry) => entry.eventId === id),
    )
  )
    requireRecurringInput(context, 'persistent-targets');
  else for (const id of ids) endRecurringEvent(context, id);
  queueRecurringEffect(context, {
    kind: 'check_modifier',
    check: 'loyalty',
    value: twice ? 5 : 2,
  });
  return true;
}

function resolveRivalry(context: RecurringEventContext) {
  const { draft, result, event, firstEventId, twice } = context;

  const targets =
    event.targets?.filter((target) => target.kind === 'team') ?? [];
  const acknowledgement = draft.acknowledgements.find(
    (entry) =>
      entry.subjectId === `event:${event.eventId}` && entry.outcome.trim(),
  );
  if (!acknowledgement) requireRecurringInput(context, 'acknowledgement');
  else
    result.plan.push({
      kind: 'event_acknowledgement',
      eventId: event.eventId,
      acknowledgement,
    });
  if (
    targets.length !== 2 ||
    new Set(targets.map((target) => target.teamId)).size !== 2 ||
    targets.some(
      (target) =>
        !result.outcome.roster.teams.some(
          (team) => team.teamId === target.teamId,
        ),
    )
  ) {
    requireRecurringInput(context, 'teams');
    return true;
  }
  if (twice) {
    const base =
      result.dispatch
        .find((entry) => entry.event.eventId === firstEventId)
        ?.event.targets?.filter((target) => target.kind === 'team') ?? [];
    if (
      base.length !== 2 ||
      base.some(
        (target) => !targets.some((other) => other.teamId === target.teamId),
      )
    ) {
      requireRecurringInput(context, 'same-teams');
      return true;
    }
    persistRecurringEvent(context, targets);
  } else
    for (const target of targets)
      queueRecurringEffect(
        context,
        {
          kind: 'team_unavailable',
          teamId: target.teamId,
          phase: 'activity',
        },
        draft.week + 1,
        draft.week + 1,
        `:${target.teamId}`,
      );
  if (twice && event.officerCheck)
    return resolveRivalryOfficerCheck(context, event.officerCheck);
  return true;
}

function resolveTheft(context: RecurringEventContext) {
  const { draft, result, event, twice } = context;

  if (twice) {
    persistRecurringEvent(context);
    return true;
  }
  const attempted = eventMitigationAttempted(
    event.mitigation,
    event.rolls?.check,
  );
  const total = attempted
    ? eventCheck(
        draft,
        result,
        event,
        'loyalty',
        event.rolls?.check,
        `${event.eventId}:theft`,
      )
    : null;
  if (attempted && total === null) return true;
  const retainedPercent = total !== null && total >= THEFT_LOYALTY_DC ? 90 : 50;
  const before = result.outcome.treasuryCopper;
  result.outcome.treasuryCopper = Math.round((before * retainedPercent) / 100);
  result.plan.push({
    kind: 'event_treasury',
    eventId: event.eventId,
    before,
    after: result.outcome.treasuryCopper,
    retainedPercent,
  });
  return true;
}

function resolveWeekModifierEvent(context: RecurringEventContext) {
  const { draft, event } = context;

  for (const check of ['loyalty', 'secrecy', 'security'] as const)
    queueRecurringEffect(
      context,
      {
        kind: 'check_modifier',
        check,
        value: event.eventType === 'week_of_pain' ? -1 : 5,
      },
      draft.week + 1,
      draft.week + 1,
      `:${check}`,
    );
  queueRecurringEffect(
    context,
    event.eventType === 'week_of_pain'
      ? { kind: 'upkeep_loss_multiplier', value: 2 }
      : { kind: 'activity_training_multiplier', value: 2 },
  );
  return true;
}

function resolveRivalryOfficerCheck(
  context: RecurringEventContext,
  input: NonNullable<EventDispatch['event']['officerCheck']>,
) {
  const { result, event, firstEventId } = context;

  if (
    !result.outcome.characters.some(
      (character) => character.characterId === input.characterId,
    ) ||
    !result.outcome.roster.officers.some(
      (officer) => officer.characterId === input.characterId,
    )
  ) {
    requireRecurringInput(context, 'officer');
    return true;
  }
  const raw = eventDie(
    result,
    input.roll,
    `${event.eventId}:rivalry`,
    RULE_ROLL_SPECS.check,
  );
  if (input.skillBonus === undefined)
    requireRecurringInput(context, 'skill-bonus');
  if (raw === null || input.skillBonus === undefined) return true;
  const total =
    raw +
    input.skillBonus +
    eventOfficerCheckExtras(input.roll).reduce(
      (sum, extra) => sum + extra.value,
      0,
    );
  result.plan.push({
    kind: 'event_officer_check',
    eventId: event.eventId,
    characterId: input.characterId,
    skill: input.skill,
    total,
    dc: RIVALRY_OFFICER_DC,
    succeeded: total >= RIVALRY_OFFICER_DC,
  });
  if (total >= RIVALRY_OFFICER_DC) {
    dropRecurringQueues(context);
    if (result.persistentEvents.some((entry) => entry.eventId === firstEventId))
      endRecurringEvent(context, firstEventId);
  }
  return true;
}
