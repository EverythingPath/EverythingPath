import {
  resolveRecurringEvent,
  type RecurringEventChange,
} from './rules-recurring-events';
import { projectActivity } from './rules-activity';
import {
  resolveThreatEvent,
  finishEventTeamReturns,
  isDiscoverableCache,
  type ThreatEventChange,
} from './rules-threat-events';
import { operatedSettlementIds } from './rules-event-context';
import {
  projectEventShaping,
  type EventShapingProjection,
} from './rules-event-shaping';
import {
  projectEventSelection,
  dispatchEvent,
  type EventDispatch,
} from './rules-event-selection';
import type { EventBenefits } from './rules-event-benefits';
import type { UpkeepSnapshot } from './rules-upkeep';
import type { WeeklyDraft } from './weekly-draft-contract';

type Event = EventDispatch['event'];
type Receipt = WeeklyDraft['acknowledgements'][number];
type Queue = WeeklyDraft['context']['queuedEffects'][number];
type Bonus = UpkeepSnapshot['bonuses'][number];
export type EventOutcomeChange =
  | ThreatEventChange
  | RecurringEventChange
  | { kind: 'event_queue'; eventId: string; effect: Queue }
  | {
      kind: 'event_skill_benefit';
      eventId: string;
      benefit: EventBenefits['skills'][number];
    }
  | {
      kind: 'event_market_benefit';
      eventId: string;
      benefit: EventBenefits['markets'][number];
    }
  | {
      kind: 'event_item';
      eventId: string;
      item: NonNullable<UpkeepSnapshot['economy']>['items'][number];
      acknowledgement: Receipt;
    }
  | {
      kind: 'event_identification';
      eventId: string;
      itemId: string;
      acknowledgement: Receipt;
    }
  | { kind: 'event_acknowledgement'; eventId: string; acknowledgement: Receipt }
  | {
      kind: 'event_team_recovery';
      eventId: string;
      teamId: string;
      before: 'disabled';
      after: 'active';
    }
  | { kind: 'event_check_bonus'; eventId: string; bonus: Bonus }
  | { kind: 'event_training'; eventId: string; before: number; after: number };
export type EventOutcomeProjection = EventShapingProjection & {
  plan: EventOutcomeChange[];
  queuedEffects: Queue[];
  persistentEvents: WeeklyDraft['context']['carriedEvents'][number][];
  endedEventIds: string[];
};

type OutcomeContext = {
  draft: WeeklyDraft;
  result: EventOutcomeProjection;
  state: UpkeepSnapshot;
  operatedIds: string[];
  pcs: string[];
};
function requireEventInput(
  { result }: OutcomeContext,
  event: Event,
  key: string,
) {
  result.requirements.push(`${event.eventId}:${key}`);
}
function recordEventAcknowledgement(context: OutcomeContext, event: Event) {
  const { draft, result } = context;
  const value = draft.acknowledgements.find(
    (entry) =>
      entry.subjectId === `event:${event.eventId}` && entry.outcome.trim(),
  );
  if (!value) requireEventInput(context, event, 'acknowledgement');
  else
    result.plan.push({
      kind: 'event_acknowledgement',
      eventId: event.eventId,
      acknowledgement: value,
    });
  return value;
}
function queueEventEffect(
  context: OutcomeContext,
  event: Event,
  effect: Queue['effect'],
  sourceId = event.eventId,
) {
  const { draft, result } = context;
  const value: Queue = {
    effectId: `event:${sourceId}:${effect.kind}`,
    sourceId,
    startsWeek: draft.week + 1,
    endsWeek: draft.week + 1,
    effect,
  };
  if (result.queuedEffects.some((entry) => entry.effectId === value.effectId))
    return;
  result.queuedEffects.push(value);
  result.plan.push({
    kind: 'event_queue',
    eventId: event.eventId,
    effect: value,
  });
}
function validateEventSettlement(
  context: OutcomeContext,
  event: Event,
  settlementId: string | null,
) {
  const { draft, result, state, operatedIds } = context;
  if (
    !settlementId ||
    !state.settlements.some((town) => town.settlementId === settlementId)
  ) {
    requireEventInput(context, event, 'settlement');
    return;
  }
  if (!operatedIds.includes(settlementId)) {
    result.warnings.push(`${event.eventId}:event-settlement`);
    if (
      !draft.rulesExceptions.some(
        (entry) =>
          entry.subjectId === event.eventId &&
          entry.ruleId === 'event-settlement' &&
          entry.reason.trim(),
      )
    )
      requireEventInput(context, event, 'event-settlement:exception');
  }
}
function grantSkillBenefit(
  context: OutcomeContext,
  event: Event,
  firstEventId: string,
  twice: boolean,
) {
  const { draft, result, state, pcs } = context;
  const type = event.eventType;
  const festival = type === 'festival';
  const target =
    event.targets?.filter((target) => target.kind === 'settlement') ?? [];
  // Safe cast: `projectEventOutcomes` defaults `eventBenefits` before any
  // event resolves, and no skill-benefit handler unsets it.
  const benefits = state.eventBenefits!;
  const existing = benefits.skills.find(
    (benefit) => benefit.benefitId === `event:${firstEventId}:skill`,
  );
  let settlementId: string | null = null;
  if (festival) {
    settlementId = twice
      ? (existing?.settlementId ?? null)
      : target.length === 1
        ? // Safe cast: `target.length === 1` proves the sole settlement target.
          target[0]!.settlementId
        : null;
    validateEventSettlement(context, event, settlementId);
    if (twice && target.some((town) => town.settlementId !== settlementId))
      requireEventInput(context, event, 'same-settlement');
  }
  const benefit: EventBenefits['skills'][number] = {
    benefitId: `event:${firstEventId}:skill`,
    sourceEventIds: [...(existing?.sourceEventIds ?? []), event.eventId],
    characterIds: pcs,
    skills: festival
      ? ['bluff', 'diplomacy', 'intimidate']
      : type === 'night_ops'
        ? ['stealth']
        : ['knowledge_local'],
    bonusType: festival
      ? 'morale'
      : type === 'night_ops'
        ? 'circumstance'
        : 'untyped',
    value: twice ? 5 : 2,
    settlementId,
    afterDark: type === 'night_ops',
    startsWeek: draft.week + (festival ? 1 : 0),
    endsWeek: draft.week + (festival ? 1 : 0),
  };
  if (existing) Object.assign(existing, benefit);
  else benefits.skills.push(benefit);
  // Publish the effective benefit once; an enhancement replaces the earlier plan entry.
  result.plan = result.plan.filter(
    (change) =>
      change.kind !== 'event_skill_benefit' ||
      change.benefit.benefitId !== benefit.benefitId,
  );
  result.plan.push({
    kind: 'event_skill_benefit',
    eventId: firstEventId,
    benefit: structuredClone(benefit),
  });
}
function identifyEventItem(context: OutcomeContext, dispatch: EventDispatch) {
  const { result, state } = context;
  const { event, firstEventId, mode } = dispatch;
  const twice = mode === 'twice';
  const acknowledgement = recordEventAcknowledgement(context, event);
  grantSkillBenefit(context, event, firstEventId, twice);
  if (twice) return;
  const targets =
    event.targets?.filter((target) => target.kind === 'item') ?? [];
  const item =
    targets.length === 1
      ? state.economy?.items.find(
          // Safe cast: the `targets.length === 1` branch proves the sole item
          // target.
          (item) => item.itemId === targets[0]!.itemId,
        )
      : undefined;
  if (!item) requireEventInput(context, event, 'item');
  else if (acknowledgement) {
    item.identified = true;
    result.plan.push({
      kind: 'event_identification',
      eventId: event.eventId,
      itemId: item.itemId,
      acknowledgement,
    });
  }
}
/** Found Fire: the reward is a non-poison alchemical item worth 100 gp or less. */
export function isPermittedAlchemicalReward(
  reward: Pick<
    NonNullable<Event['rewards']>[number],
    'alchemical' | 'poison' | 'valueCopper'
  >,
) {
  return reward.alchemical && !reward.poison && reward.valueCopper <= 10000;
}
function grantAlchemicalReward(
  context: OutcomeContext,
  event: Event,
  item: NonNullable<Event['rewards']>[number],
  acknowledgement: Receipt | undefined,
) {
  const { draft, result, state, pcs } = context;
  if (!pcs.includes(item.characterId)) {
    requireEventInput(context, event, `reward:${item.characterId}:recipient`);
    return;
  }
  if (!isPermittedAlchemicalReward(item)) {
    result.warnings.push(`${event.eventId}:alchemical-reward`);
    if (
      !draft.rulesExceptions.some(
        (entry) =>
          entry.subjectId === item.itemId &&
          entry.ruleId === 'alchemical-reward' &&
          entry.reason.trim(),
      )
    ) {
      requireEventInput(context, event, `reward:${item.itemId}:exception`);
      return;
    }
  }
  state.economy ??= { items: [], caches: [], markets: [], orders: [] };
  if (state.economy.items.some((existing) => existing.itemId === item.itemId)) {
    requireEventInput(context, event, `reward:${item.itemId}:duplicate`);
    return;
  }
  if (!acknowledgement) return;
  const received = {
    itemId: item.itemId,
    ownerCharacterId: item.characterId,
    name: item.name,
    valueCopper: item.valueCopper,
    weight: item.weight,
    location: 'held' as const,
  };
  state.economy.items.push(received);
  result.plan.push({
    kind: 'event_item',
    eventId: event.eventId,
    item: received,
    acknowledgement,
  });
}
function grantAlchemicalRewards(
  context: OutcomeContext,
  dispatch: EventDispatch,
) {
  const { pcs } = context;
  const { event, firstEventId } = dispatch;
  const acknowledgement = recordEventAcknowledgement(context, event);
  const rewards = event.rewards ?? [];
  for (const pc of pcs)
    if (rewards.filter((item) => item.characterId === pc).length !== 1)
      requireEventInput(context, event, `reward:${pc}`);
  for (const item of rewards)
    grantAlchemicalReward(context, event, item, acknowledgement);
  queueEventEffect(
    context,
    event,
    { kind: 'check_modifier', check: 'security', value: 2 },
    firstEventId,
  );
}
function grantMarketBenefit(context: OutcomeContext, dispatch: EventDispatch) {
  const { draft, result, state, operatedIds } = context;
  const { event, firstEventId, mode } = dispatch;
  const twice = mode === 'twice';
  recordEventAcknowledgement(context, event);
  const targets =
    event.targets?.filter((target) => target.kind === 'settlement') ?? [];
  const settlementIds = twice
    ? operatedIds
    : targets.length === 1
      ? // Safe cast: `targets.length === 1` proves the sole market settlement.
        [targets[0]!.settlementId]
      : [];
  if (!settlementIds.length) requireEventInput(context, event, 'settlement');
  for (const settlementId of settlementIds)
    validateEventSettlement(context, event, settlementId);
  // Safe cast: `projectEventOutcomes` defaults `eventBenefits` before the
  // first event resolves, so Market Day always finds its market list.
  const benefits = state.eventBenefits!;
  const existing = benefits.markets.find(
    (benefit) => benefit.benefitId === `event:${firstEventId}:market`,
  );
  const benefit: EventBenefits['markets'][number] = {
    benefitId: `event:${firstEventId}:market`,
    sourceEventIds: [...(existing?.sourceEventIds ?? []), event.eventId],
    settlementIds,
    discountPercent: 5,
    startsWeek: draft.week,
    endsWeek: draft.week,
  };
  if (existing) Object.assign(existing, benefit);
  else benefits.markets.push(benefit);
  result.plan = result.plan.filter(
    (change) =>
      change.kind !== 'event_market_benefit' ||
      change.benefit.benefitId !== benefit.benefitId,
  );
  result.plan.push({
    kind: 'event_market_benefit',
    eventId: firstEventId,
    benefit: structuredClone(benefit),
  });
}
function recoverDisabledTeams({ state, result }: OutcomeContext, event: Event) {
  const disabled = state.roster.teams.filter(
    (team) => team.status === 'disabled',
  );
  if (disabled.length) {
    for (const team of disabled) {
      team.status = 'active';
      result.plan.push({
        kind: 'event_team_recovery',
        eventId: event.eventId,
        teamId: team.teamId,
        before: 'disabled',
        after: 'active',
      });
    }
    return true;
  }
  return false;
}
function recoverTeamsOrGrantBonus(
  context: OutcomeContext,
  dispatch: EventDispatch,
) {
  const { draft, result, state } = context;
  const { event } = dispatch;
  if (recoverDisabledTeams(context, event)) return;
  const targets =
    event.targets?.filter((target) => target.kind === 'team') ?? [];
  const team =
    targets.length === 1
      ? state.roster.teams.find(
          // Safe cast: the `targets.length === 1` branch proves the sole team
          // target.
          (team) => team.teamId === targets[0]!.teamId,
        )
      : undefined;
  if (!team) {
    requireEventInput(context, event, 'team');
    return;
  }
  const bonus: Bonus = {
    bonusId: `event:${event.eventId}:team-check`,
    source: event.eventId,
    check: 'any',
    value: 2,
    teamId: team.teamId,
    phase: 'activity',
    availableWeek: draft.week + 1,
    consumedWeek: null,
  };
  state.bonuses.push(bonus);
  result.plan.push({
    kind: 'event_check_bonus',
    eventId: event.eventId,
    bonus,
  });
}
function grantTraining(context: OutcomeContext, dispatch: EventDispatch) {
  const { result, state } = context;
  const { event } = dispatch;
  const before = state.training;
  state.training += state.rank;
  result.plan.push({
    kind: 'event_training',
    eventId: event.eventId,
    before,
    after: state.training,
  });
}
function resolveBenefitEvent(context: OutcomeContext, dispatch: EventDispatch) {
  const { event, firstEventId, mode } = dispatch;
  const twice = mode === 'twice';
  switch (event.eventType) {
    case 'all_is_calm':
      if (twice)
        queueEventEffect(context, event, { kind: 'all_is_calm' }, firstEventId);
      break;
    case 'broke_the_code':
      identifyEventItem(context, dispatch);
      break;
    case 'festival':
    case 'night_ops':
      recordEventAcknowledgement(context, event);
      grantSkillBenefit(context, event, firstEventId, twice);
      break;
    case 'found_fire':
      grantAlchemicalRewards(context, dispatch);
      break;
    case 'market_day':
      grantMarketBenefit(context, dispatch);
      break;
    case 'turn_around':
      recoverTeamsOrGrantBonus(context, dispatch);
      break;
    case 'war_games':
      grantTraining(context, dispatch);
      break;
    default:
      requireEventInput(context, event, 'outcome');
  }
}

function needsEventReplacement(
  { draft, state }: OutcomeContext,
  { event, mode }: EventDispatch,
) {
  const twice = mode === 'twice';
  const exhausted =
    (event.eventType === 'raid' &&
      !state.settlements.some(
        (town) =>
          town.refugeActivatedWeek !== null &&
          town.refugeActiveUntilWeek !== null &&
          town.refugeActivatedWeek <= draft.week &&
          town.refugeActiveUntilWeek >= draft.week,
      )) ||
    (['sickness', 'turn_around', 'missing_in_action'].includes(
      event.eventType ?? '',
    ) &&
      state.roster.teams.length === 0) ||
    (event.eventType === 'cache_discovered' &&
      !twice &&
      !state.economy?.caches.some(isDiscoverableCache));
  return (
    exhausted &&
    !draft.rulesExceptions.some(
      (entry) =>
        entry.subjectId === event.eventId &&
        entry.ruleId === 'event-eligibility' &&
        entry.reason.trim(),
    )
  );
}
function isAutomaticOccurrence(allOccurrences: Event[], id: string): boolean {
  const source = allOccurrences.find((entry) => entry.eventId === id);
  return (
    source?.origin.kind === 'automatic' ||
    Boolean(
      source &&
      'parentEventId' in source.origin &&
      isAutomaticOccurrence(allOccurrences, source.origin.parentEventId),
    )
  );
}

function selectEventReplacements(
  { draft, result, state }: OutcomeContext,
  event: Event,
  allOccurrences: Event[],
) {
  const expanded = result.tree.some(
    (parent) =>
      parent.eventType === 'roll_twice' &&
      result.tree.some(
        (child) =>
          child.origin.kind === 'roll_twice' &&
          child.origin.parentEventId === parent.eventId,
      ),
  );
  const replacement = projectEventSelection(
    draft,
    {
      requirements: [],
      warnings: [],
      plan: [],
      outcome: state,
      teamUse: result.teamUse,
    },
    {
      parentEventId: event.eventId,
      tree: allOccurrences,
      inPlace:
        isAutomaticOccurrence(allOccurrences, event.eventId) ||
        result.guarantees.some((guarantee) =>
          guarantee.candidates.some(
            (candidate) => candidate.eventId === event.eventId,
          ),
        ),
      expanded,
    },
  );
  result.requirements.push(...replacement.requirements);
  result.warnings.push(...replacement.warnings);
  result.tree.push(...replacement.tree);
  result.positions.push(...replacement.positions);
  const replacements = replacement.selected.map((event) =>
    dispatchEvent(event, []),
  );
  return replacements;
}
function applyEventReaction(
  { draft, result, state }: OutcomeContext,
  dispatch: EventDispatch,
) {
  const { event } = dispatch;
  const liveDraft = {
    ...draft,
    context: {
      ...draft.context,
      carriedEvents: result.persistentEvents,
      queuedEffects: result.queuedEffects,
    },
  };
  const reactive = projectEventShaping(
    liveDraft,
    {
      requirements: [],
      warnings: [],
      plan: [],
      outcome: state,
      teamUse: result.teamUse,
      checkUsage: result.checkUsage,
    },
    {
      ...result,
      requirements: [],
      warnings: [],
      selected: [event],
      dispatch: [dispatch],
    },
  );
  Object.assign(state, reactive.outcome);
  result.checkUsage = reactive.checkUsage;
  result.teamUse = reactive.teamUse;
  result.requirements.push(...reactive.requirements);
  result.warnings.push(...reactive.warnings);
  result.checks.push(...reactive.checks);
  result.sabotage.push(...reactive.sabotage);
  result.negatedEventIds.push(...reactive.negatedEventIds);
}
function resolveEventsInOrder(context: OutcomeContext) {
  const { draft, result } = context;
  const allOccurrences = [
    ...draft.event.occurrences,
    ...result.guarantees.flatMap((guarantee) => guarantee.candidates),
  ];
  const pending = [...result.dispatch];
  const applied: EventDispatch[] = [];
  for (let index = 0; index < pending.length; index++) {
    const dispatch = dispatchEvent(
      // Safe cast: the loop bound `index < pending.length` keeps `index` in
      // range while `pending` grows.
      pending[index]!.event,
      applied.filter(
        (prior) => !result.negatedEventIds.includes(prior.event.eventId),
      ),
    );
    const { event, mode } = dispatch;
    if (
      result.negatedEventIds.includes(event.eventId) ||
      mode === 'no_additional_effect'
    ) {
      applied.push(dispatch);
      continue;
    }
    if (needsEventReplacement(context, dispatch)) {
      const replacements = selectEventReplacements(
        context,
        event,
        allOccurrences,
      );
      pending.splice(index + 1, 0, ...replacements);
      continue;
    }
    applyEventReaction(context, dispatch);
    applied.push(dispatch);
    result.dispatch = applied;
    if (result.negatedEventIds.includes(event.eventId)) continue;
    if (resolveRecurringEvent(draft, result, dispatch)) continue;
    if (resolveThreatEvent(draft, result, dispatch)) continue;
    resolveBenefitEvent(context, dispatch);
  }
  result.dispatch = applied;
  result.selected = applied.map((dispatch) => dispatch.event);
}
/** The source of Hidden Agenda's recalculated Activity check modifiers. */
export const HIDDEN_AGENDA_SOURCE = 'hidden-agenda';
function withHiddenAgendaBonus(draft: WeeklyDraft, bonus: number): WeeklyDraft {
  const queued = bonus
    ? (['loyalty', 'secrecy', 'security'] as const).map((check) => ({
        effectId: `${HIDDEN_AGENDA_SOURCE}:${check}`,
        sourceId: HIDDEN_AGENDA_SOURCE,
        startsWeek: draft.week,
        endsWeek: draft.week,
        effect: {
          kind: 'check_modifier' as const,
          check,
          phase: 'activity' as const,
          value: bonus,
        },
      }))
    : [];
  return {
    ...draft,
    context: {
      ...draft.context,
      queuedEffects: [...draft.context.queuedEffects, ...queued],
    },
  };
}

/** The active player characters: each chooses a Found Fire reward. */
export function eventRewardRecipients(
  state: Pick<UpkeepSnapshot, 'roster' | 'characters'>,
) {
  return state.roster.people
    .filter(
      (person) =>
        person.kind === 'pc' &&
        state.characters.some(
          (character) =>
            character.characterId === person.characterId && character.isActive,
        ),
    )
    .map((person) => person.characterId);
}

// Each handler observes the preceding event's projected outcome. Selection and
// Sabotage retain all original occurrences, including suppressed duplicate effects.
export function projectEventOutcomes(
  draft: WeeklyDraft,
  shaping: EventShapingProjection,
): EventOutcomeProjection {
  const result: EventOutcomeProjection = {
    ...structuredClone(shaping),
    plan: [],
    persistentEvents: structuredClone([...draft.context.carriedEvents]),
    endedEventIds: [],
    queuedEffects: structuredClone([...draft.context.queuedEffects]),
  };
  const state = result.outcome;
  const operatedIds = operatedSettlementIds(draft, {
    outcome: state,
    teamUse: result.teamUse,
  });
  state.eventBenefits ??= { skills: [], markets: [] };
  const pcs = eventRewardRecipients(state);
  const context = { draft, result, state, operatedIds, pcs };
  resolveEventsInOrder(context);
  finishEventTeamReturns(draft, result);
  result.requirements = [...new Set(result.requirements)];
  result.warnings = [...new Set(result.warnings)];
  result.ready = result.requirements.length === 0;
  return result;
}
export function projectActivityAndEvents(
  draft: WeeklyDraft,
  snapshot: UpkeepSnapshot,
) {
  let bonus = 0;
  const seen = new Set<number>();
  for (;;) {
    seen.add(bonus);
    const prepared = withHiddenAgendaBonus(draft, bonus);
    const activity = projectActivity(prepared, snapshot);
    const eventDraft: WeeklyDraft = {
      ...prepared,
      context: {
        ...prepared.context,
        carriedEvents: prepared.context.carriedEvents.filter(
          (event) => !activity.endedEventIds.includes(event.eventId),
        ),
      },
    };
    const shaped = projectEventShaping(eventDraft, activity, undefined, true);
    const event = projectEventOutcomes(eventDraft, shaped);
    event.endedEventIds = [
      ...new Set([...activity.endedEventIds, ...event.endedEventIds]),
    ];
    event.queuedEffects = event.queuedEffects.filter(
      (effect) => effect.sourceId !== HIDDEN_AGENDA_SOURCE,
    );
    const next = Math.max(
      0,
      ...event.plan.flatMap((change) =>
        change.kind === 'event_activity_bonus' ? [change.value] : [],
      ),
    );
    if (next === bonus) return { activity, event };
    if (seen.has(next)) {
      event.requirements.push('event:hidden-agenda-cycle');
      event.ready = false;
      return { activity, event };
    }
    bonus = next;
  }
}
