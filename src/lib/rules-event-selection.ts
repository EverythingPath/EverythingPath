import type { RawRoll } from './weekly-draft-facts';
import type { EventType } from './militia-domain';
import { RULE_ROLL_SPECS } from './rules-roll-spec';
import { normalizeRawRoll } from './raw-roll';
import { operatedSettlementIds } from './rules-event-context';
import { isDiscoverableCache } from './rules-threat-events';
import { projectSettlements } from './rules-settlements';
import type { ActivityProjection } from './rules-activity';
import type { WeeklyDraft } from './weekly-draft-contract';
import type { EventActionChange } from './rules-event-actions';
import { eventTypeForPercentile } from './militia-event-table';

type Event = WeeklyDraft['event']['occurrences'][number];
type Guarantee = Extract<EventActionChange, { kind: 'event_guarantee' }>;
export type EventDispatch = {
  event: Event;
  mode: 'base' | 'twice' | 'no_additional_effect';
  firstEventId: string;
};
export function dispatchEvent(
  event: Event,
  preceding: EventDispatch[],
): EventDispatch {
  const first = preceding.find(
    (prior) => prior.event.eventType === event.eventType,
  );
  const independent = ['invasion', 'raid', 'turn_around', 'war_games'].includes(
    event.eventType ?? '',
  );
  return {
    event,
    firstEventId: first?.firstEventId ?? event.eventId,
    mode:
      !first || independent
        ? 'base'
        : event.eventType === 'week_of_pain' ||
            event.eventType === 'week_of_serenity'
          ? 'no_additional_effect'
          : 'twice',
  };
}
/**
 * A group of occurrence positions the rules ask for, with the saved
 * occurrences that fill it in their saved order. Recording a group never
 * changes selection: it is the trace that preparation and presentation read.
 * A `reroll` replacement group belongs to a Roll Twice that is rerolled in
 * its own die instead of adding events: one after the phase's one expansion,
 * or any on an automatic event or an Activity candidate. It holds no events:
 * the table enters a new die on the Roll Twice itself.
 */
export type EventPositionGroup =
  | { kind: 'rolled'; count: number; eventIds: string[] }
  | { kind: 'automatic'; sourceId: string; count: number; eventIds: string[] }
  | { kind: 'candidates'; choiceId: string; count: number; eventIds: string[] }
  | {
      kind: 'roll_twice' | 'replacement';
      parentEventId: string;
      count: number;
      eventIds: string[];
      reroll: boolean;
    };
export type EventChanceBreakdown = {
  notoriety: number;
  carry: number;
  queued: { effectId: string; sourceId: string; value: number }[];
};
export type EventSelectionProjection = {
  ready: boolean;
  requirements: string[];
  warnings: string[];
  chance: number;
  carryModifier: number;
  nextUneventfulCarry: boolean | null;
  guaranteed: boolean;
  guarantees: Guarantee[];
  tree: Event[];
  selected: Event[];
  dispatch: EventDispatch[];
  /** The operating settlement's reputation modifier on the chance roll; null while that settlement's reputation is unknown. */
  chanceModifier: number | null;
  chanceBreakdown: EventChanceBreakdown;
  /** The chance roll's comparison, once both roll and adjustment are known and a roll applies. */
  chanceResult: 'event' | 'quiet' | null;
  /** A queued All Is Calm suppresses the chance roll and Activity candidates this week. */
  forcedCalm: boolean;
  positions: EventPositionGroup[];
};

type SelectionContext = {
  draft: WeeklyDraft;
  activity: Pick<
    ActivityProjection,
    'requirements' | 'warnings' | 'plan' | 'outcome' | 'teamUse'
  >;
  result: EventSelectionProjection;
  expanded: boolean;
};
function readEventDie(
  { result }: SelectionContext,
  raw: Event['tableRoll'],
  id: string,
) {
  const normalized = normalizeRawRoll(raw, RULE_ROLL_SPECS.percentile);
  if (normalized.status !== 'complete') {
    result.requirements.push(
      `${id}:${RULE_ROLL_SPECS.percentile.count}d${RULE_ROLL_SPECS.percentile.sides}`,
    );
    return null;
  }
  if (normalized.rangeWarning) result.warnings.push(`${id}:roll-range`);
  return normalized.diceTotal;
}
export type EventTableArithmetic = {
  /** The raw dice total, or null while the roll is missing or incomplete. */
  raw: number | null;
  /** Each recorded extra modifier and why the rules ignore it, if they do. */
  modifiers: {
    sourceId: string;
    value: number;
    reason: string;
    ignored: 'settlement' | 'repeated' | null;
  }[];
  /** Raw plus applied modifiers, bounded to the table's 1–100. */
  total: number | null;
};
// Settlement reputation modifies the chance roll only, and one value counts
// per modifier source (the last one recorded).
export function eventTableArithmetic(
  roll: RawRoll | null | undefined,
): EventTableArithmetic {
  const normalized = normalizeRawRoll(roll, RULE_ROLL_SPECS.percentile);
  const recorded = roll?.modifiers ?? [];
  const last = new Map(recorded.map((entry, index) => [entry.sourceId, index]));
  const modifiers = recorded.map((entry, index) => ({
    ...entry,
    ignored:
      entry.sourceId === 'settlement' || entry.sourceId === 'reputation'
        ? ('settlement' as const)
        : last.get(entry.sourceId) === index
          ? null
          : ('repeated' as const),
  }));
  if (normalized.status !== 'complete')
    return { raw: null, modifiers, total: null };
  const applied = modifiers.reduce(
    (sum, entry) => sum + (entry.ignored ? 0 : entry.value),
    0,
  );
  return {
    raw: normalized.diceTotal,
    modifiers,
    total: Math.max(1, Math.min(100, normalized.diceTotal + applied)),
  };
}
export function eventTypeForTableRoll(
  roll: RawRoll | null | undefined,
): EventType | null {
  const { total } = eventTableArithmetic(roll);
  return total === null ? null : eventTypeForPercentile(total);
}

// The operating settlement's reputation never touches the table roll; it
// modifies the chance roll (see selectChanceEvent).
function resolveTableRoll(context: SelectionContext, event: Event) {
  const { result } = context;
  readEventDie(context, event.tableRoll, `${event.eventId}:table`);
  const eventType = eventTypeForTableRoll(event.tableRoll);
  if (eventType === null) return null;
  if (event.eventType && event.eventType !== eventType)
    result.warnings.push(`${event.eventId}:calculated-event`);
  const resolved = { ...structuredClone(event), eventType };
  result.tree.push(resolved);
  return resolved;
}
function canEventOccur({ draft, activity }: SelectionContext, event: Event) {
  const state = activity.outcome;
  switch (event.eventType) {
    case 'cache_discovered':
      return state.economy?.caches.some(isDiscoverableCache) ?? false;
    case 'raid':
      return state.settlements.some(
        (town) =>
          town.refugeActivatedWeek !== null &&
          town.refugeActiveUntilWeek !== null &&
          town.refugeActivatedWeek <= draft.week &&
          town.refugeActiveUntilWeek >= draft.week,
      );
    case 'market_day':
      return true;
    case 'festival':
      return (
        operatedSettlementIds(draft, activity).length > 0 ||
        draft.rulesExceptions.some(
          (entry) =>
            entry.subjectId === event.eventId &&
            entry.ruleId === 'event-settlement' &&
            entry.reason.trim(),
        )
      );
    case 'sickness':
    case 'turn_around':
      return state.roster.teams.length > 0;
    case 'rivalry':
      return state.roster.teams.length >= 2;
    case 'missing_in_action':
      return state.roster.teams.some((team) =>
        activity.teamUse.usedTeamIds.includes(team.teamId),
      );
    default:
      return true;
  }
}
// Only the chance-rolled tree can expand a Roll Twice. Automatic events and,
// since the candidate reroll Ruleset Version (#191), every event in an
// Activity candidate set reroll it in place.
function selectOccurrence(
  context: SelectionContext,
  event: Event,
  tree: Event[],
  inPlace = false,
) {
  const { draft, result } = context;
  const resolved = resolveTableRoll(context, event);
  if (!resolved) return;
  const possible = canEventOccur(context, resolved);
  const exception = draft.rulesExceptions.some(
    (entry) =>
      entry.subjectId === event.eventId &&
      entry.ruleId === 'event-eligibility' &&
      entry.reason.trim(),
  );
  if (!possible) result.warnings.push(`${event.eventId}:event-eligibility`);
  if (resolved.eventType !== 'roll_twice' && (possible || exception)) {
    result.selected.push(resolved);
    return;
  }
  const expands =
    resolved.eventType === 'roll_twice' && !inPlace && !context.expanded;
  if (resolved.eventType === 'roll_twice' && !expands) {
    requireReroll(context, event.eventId);
    return;
  }
  const kind = expands ? 'roll_twice' : 'replacement';
  const count = expands ? 2 : 1;
  if (expands) context.expanded = true;
  const children = tree.filter(
    (entry) =>
      entry.origin.kind === kind &&
      'parentEventId' in entry.origin &&
      entry.origin.parentEventId === event.eventId,
  );
  result.positions.push({
    kind,
    parentEventId: event.eventId,
    count,
    eventIds: children.map((child) => child.eventId),
    reroll: false,
  });
  if (children.length !== count) {
    result.requirements.push(`${event.eventId}:${kind}:${count}`);
    return;
  }
  for (const child of children) selectOccurrence(context, child, tree, inPlace);
}

// A Roll Twice rerolled in its own die waits for its new table roll.
function requireReroll(context: SelectionContext, eventId: string) {
  context.result.positions.push({
    kind: 'replacement',
    parentEventId: eventId,
    count: 1,
    eventIds: [],
    reroll: true,
  });
  context.result.requirements.push(`${eventId}:replacement:1`);
}

function selectReplacement(
  context: SelectionContext,
  replacement: NonNullable<Parameters<typeof projectEventSelection>[2]>,
) {
  const { result } = context;
  const children = replacement.tree.filter(
    (event) =>
      event.origin.kind === 'replacement' &&
      event.origin.parentEventId === replacement.parentEventId,
  );
  result.positions.push({
    kind: 'replacement',
    parentEventId: replacement.parentEventId,
    count: 1,
    eventIds: children.map((child) => child.eventId),
    reroll: false,
  });
  if (children.length !== 1)
    result.requirements.push(`${replacement.parentEventId}:replacement:1`);
  else
    selectOccurrence(
      context,
      // Safe cast: this branch runs only when `children.length` is exactly 1.
      children[0]!,
      replacement.tree,
      replacement.inPlace,
    );
}
function selectAutomaticEvents(context: SelectionContext) {
  const { draft, result } = context;
  const automaticSources = draft.context.queuedEffects.filter(
    (effect) =>
      effect.startsWeek <= draft.week &&
      draft.week <= effect.endsWeek &&
      effect.effect.kind === 'automatic_events',
  );
  const automaticRoots = draft.event.occurrences.filter(
    (event) => event.origin.kind === 'automatic',
  );
  for (const event of automaticRoots)
    if (
      !automaticSources.some(
        (effect) =>
          event.origin.kind === 'automatic' &&
          effect.sourceId === event.origin.sourceId,
      )
    )
      result.requirements.push(`${event.eventId}:automatic-event-source`);
  const automaticSeen = new Set<string>();
  for (const effect of automaticSources) {
    if (automaticSeen.has(effect.sourceId)) continue;
    automaticSeen.add(effect.sourceId);
    const roots = automaticRoots.filter(
      (event) =>
        event.origin.kind === 'automatic' &&
        event.origin.sourceId === effect.sourceId,
    );
    if (effect.effect.kind === 'automatic_events')
      result.positions.push({
        kind: 'automatic',
        sourceId: effect.sourceId,
        count: effect.effect.count,
        eventIds: roots.map((root) => root.eventId),
      });
    if (
      effect.effect.kind === 'automatic_events' &&
      roots.length !== effect.effect.count
    )
      result.requirements.push(
        `${effect.sourceId}:automatic-events:${effect.effect.count}`,
      );
    else
      for (const root of roots)
        selectOccurrence(context, root, draft.event.occurrences, true);
  }
  return automaticSources;
}
// Both candidates need a usable result, chosen or not: one that cannot occur
// needs its replacement, and a Roll Twice is rerolled in its own die.
function validateCandidate(
  context: SelectionContext,
  guarantee: Guarantee,
  event: Event,
) {
  const { draft, result } = context;
  const resolved = resolveTableRoll(context, event);
  if (!resolved) return;
  if (resolved.eventType === 'roll_twice') {
    requireReroll(context, event.eventId);
    return;
  }
  if (canEventOccur(context, resolved)) return;
  result.warnings.push(`${event.eventId}:event-eligibility`);
  if (
    draft.rulesExceptions.some(
      (entry) =>
        entry.subjectId === event.eventId &&
        entry.ruleId === 'event-eligibility' &&
        entry.reason.trim(),
    )
  )
    return;
  const replacements = guarantee.candidates.filter(
    (entry) =>
      entry.origin.kind === 'replacement' &&
      entry.origin.parentEventId === event.eventId,
  );
  result.positions.push({
    kind: 'replacement',
    parentEventId: event.eventId,
    count: 1,
    eventIds: replacements.map((entry) => entry.eventId),
    reroll: false,
  });
  if (replacements.length !== 1)
    result.requirements.push(`${event.eventId}:replacement:1`);
  // Safe cast: the `replacements.length !== 1` branch above leaves exactly one
  // replacement here.
  else validateCandidate(context, guarantee, replacements[0]!);
}

function selectGuaranteedEvents(context: SelectionContext) {
  const { result } = context;
  for (const guarantee of result.guarantees) {
    const roots = guarantee.candidates.filter(
      (event) => event.origin.kind === 'rolled',
    );
    result.positions.push({
      kind: 'candidates',
      choiceId: guarantee.choiceId,
      count: 2,
      eventIds: roots.map((root) => root.eventId),
    });
    if (roots.length !== 2)
      result.requirements.push(`${guarantee.choiceId}:candidates:2`);
    // Both independent percentile rolls are required even for the rejected option.
    for (const root of roots) validateCandidate(context, guarantee, root);
    const chosen = roots.find(
      (root) => root.eventId === guarantee.selectedEventId,
    );
    if (!chosen)
      result.requirements.push(`${guarantee.choiceId}:selected-event`);
    else if (roots.length === 2)
      selectOccurrence(context, chosen, guarantee.candidates, true);
  }
}
function selectChanceEvent(context: SelectionContext) {
  const { draft, result } = context;
  const chanceRoll = readEventDie(
    context,
    draft.event.chanceRoll,
    'event:chance',
  );
  // Friendly subtracts 5 from, and Unfriendly adds 5 to, the percentile roll
  // that decides whether an event occurs (Table 6-2).
  if (result.chanceModifier === null)
    result.requirements.push('event:operating-settlement');
  // The accepted E01 audit baseline explicitly uses a strict comparison.
  result.chanceResult =
    chanceRoll === null || result.chanceModifier === null
      ? null
      : chanceRoll + result.chanceModifier < result.chance
        ? 'event'
        : 'quiet';
  if (result.chanceResult === 'event') {
    const roots = draft.event.occurrences.filter(
      (event) => event.origin.kind === 'rolled',
    );
    result.positions.push({
      kind: 'rolled',
      count: 1,
      eventIds: roots.map((root) => root.eventId),
    });
    if (roots.length !== 1) result.requirements.push('event:root:1');
    // Safe cast: the `roots.length !== 1` branch above leaves exactly one
    // rolled root here.
    else selectOccurrence(context, roots[0]!, draft.event.occurrences);
  }
}
function eventChanceBreakdown(
  draft: WeeklyDraft,
  outcome: ActivityProjection['outcome'],
  carryModifier: number,
): EventChanceBreakdown {
  return {
    notoriety: outcome.notoriety,
    carry: carryModifier,
    queued: draft.context.queuedEffects.flatMap((effect) =>
      effect.startsWeek <= draft.week &&
      draft.week <= effect.endsWeek &&
      effect.effect.kind === 'event_chance'
        ? [
            {
              effectId: effect.effectId,
              sourceId: effect.sourceId,
              value: effect.effect.value,
            },
          ]
        : [],
    ),
  };
}
function calculateEventChance({
  notoriety,
  carry,
  queued,
}: EventChanceBreakdown) {
  return Math.max(
    10,
    Math.min(
      95,
      notoriety + carry + queued.reduce((sum, entry) => sum + entry.value, 0),
    ),
  );
}
function isForcedCalm(draft: WeeklyDraft) {
  return draft.context.queuedEffects.some(
    (effect) =>
      effect.startsWeek <= draft.week &&
      draft.week <= effect.endsWeek &&
      effect.effect.kind === 'all_is_calm',
  );
}

function createSelectionContext(
  draft: WeeklyDraft,
  activity: SelectionContext['activity'],
  expanded: boolean,
): SelectionContext {
  const carryModifier = draft.context.uneventfulCarry
    ? activity.outcome.rank
    : 0;
  const chanceBreakdown = eventChanceBreakdown(
    draft,
    activity.outcome,
    carryModifier,
  );
  const result: EventSelectionProjection = {
    ready: false,
    requirements: [...activity.requirements],
    warnings: [...activity.warnings],
    chance: calculateEventChance(chanceBreakdown),
    carryModifier,
    nextUneventfulCarry: null,
    guaranteed: false,
    guarantees: activity.plan.filter(
      (effect): effect is Guarantee => effect.kind === 'event_guarantee',
    ),
    tree: [],
    selected: [],
    dispatch: [],
    chanceModifier: 0,
    chanceBreakdown,
    chanceResult: null,
    forcedCalm: isForcedCalm(draft),
    positions: [],
  };
  result.guaranteed = result.guarantees.length > 0;

  result.chanceModifier = draft.activity.operatingSettlementId
    ? (projectSettlements(
        activity.outcome.settlements,
        draft.week,
      ).settlements.find(
        (town) => town.settlementId === draft.activity.operatingSettlementId,
      )?.eventChanceModifier ?? null)
    : 0;
  return {
    draft,
    activity,
    result,
    expanded,
  };
}
function finalizeEventSelection(result: EventSelectionProjection) {
  for (const event of result.selected)
    result.dispatch.push(dispatchEvent(event, result.dispatch));
  result.tree = [
    ...new Map(result.tree.map((event) => [event.eventId, event])).values(),
  ];
  result.requirements = [...new Set(result.requirements)];
  result.warnings = [...new Set(result.warnings)];
  result.ready = result.requirements.length === 0;
}

// Selection keeps occurrence identities and raw facts; effect resolvers consume
// dispatch in order. A Twice clause never collapses the recorded source events.
export function projectEventSelection(
  draft: WeeklyDraft,
  activity: Pick<
    ActivityProjection,
    'requirements' | 'warnings' | 'plan' | 'outcome' | 'teamUse'
  >,
  replacement?: {
    parentEventId: string;
    tree: Event[];
    /** An automatic event's or an Activity candidate's tree rerolls a Roll Twice in place. */
    inPlace: boolean;
    expanded: boolean;
  },
): EventSelectionProjection {
  const context = createSelectionContext(
    draft,
    activity,
    replacement?.expanded ?? false,
  );
  const { result } = context;
  if (replacement) {
    selectReplacement(context, replacement);
    result.requirements = [...new Set(result.requirements)];
    result.warnings = [...new Set(result.warnings)];
    result.ready = result.requirements.length === 0;
    return result;
  }
  const automaticSources = selectAutomaticEvents(context);
  const forcedCalm = result.forcedCalm;
  if (!forcedCalm) {
    selectGuaranteedEvents(context);
    if (!result.guaranteed) selectChanceEvent(context);
  }
  finalizeEventSelection(result);
  if (result.ready)
    result.nextUneventfulCarry =
      uneventfulCarryBlockers({
        firstMilitiaWeek: draft.context.firstMilitiaWeek,
        forcedCalm,
        hasAutomaticEvents: automaticSources.length > 0,
        selected: result.selected,
      }).length === 0;
  return result;
}

/** Why a week does not build the uneventful chance carry. */
export type UneventfulCarryBlocker =
  | 'first_week'
  | 'forced_calm'
  | 'automatic_events'
  | 'several_events'
  | 'other_event';

/**
 * The reasons a week is not uneventful for next week's chance carry; none
 * means it counts. Only a week with no event or a single All Is Calm builds
 * the carry, and never the first week, a forced calm or a week with
 * automatic events.
 */
export function uneventfulCarryBlockers({
  firstMilitiaWeek,
  forcedCalm,
  hasAutomaticEvents,
  selected,
}: {
  firstMilitiaWeek: boolean;
  forcedCalm: boolean;
  hasAutomaticEvents: boolean;
  selected: readonly Pick<Event, 'eventType'>[];
}): UneventfulCarryBlocker[] {
  return [
    ...(firstMilitiaWeek ? (['first_week'] as const) : []),
    ...(forcedCalm ? (['forced_calm'] as const) : []),
    ...(hasAutomaticEvents ? (['automatic_events'] as const) : []),
    ...(selected.length >= 2 ? (['several_events'] as const) : []),
    ...(selected.some((event) => event.eventType !== 'all_is_calm')
      ? (['other_event'] as const)
      : []),
  ];
}
