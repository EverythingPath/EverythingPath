import {
  highMoraleEndingCount,
  RIVALRY_OFFICER_DC,
} from '~/lib/rules-recurring-events';
import {
  uneventfulCarryBlockers,
  type EventDispatch,
  type UneventfulCarryBlocker,
} from '~/lib/rules-event-selection';
import { invasionChallengeRating } from '~/lib/rules-threat-events';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import {
  codes,
  eventRank,
  whatHappened,
  type EventPanelContext,
  type EventPanelItem,
} from './event-panel-context';
import { eventChange } from './event-messages';
import { cacheName, itemName, teamName } from './event-target-choice';
import { eventName } from './event-tree-facts';
import { orderCarriedEvents, ordinal } from './persistent-sections';
import { formatGold, plural } from './week-frame/reference-copy';
import type {
  EventEndingChoice,
  EventOutcomeFamily,
  EventPanel,
  EventRetainedField,
  EventRetainedTarget,
} from './types';

type Item = EventPanelItem;
type Change = Item['changes'][number];
type Carried = WeeklyDraft['context']['carriedEvents'][number];
type Occurrence = Item['occurrence'];
type Target = NonNullable<Occurrence['targets']>[number];
type OutcomePanel = Extract<EventPanel, { family: 'outcome' }>;
type Check = 'loyalty' | 'secrecy' | 'security';

// Upkeep's signed wording. Facts stay free of component modules: the
// Resolution Preview's browser bundle includes them without React.
const signed = (value: number) =>
  value < 0 ? `−${Math.abs(value)}` : `+${value}`;

const OUTCOME_FAMILIES: readonly EventOutcomeFamily[] = [
  'all_is_calm',
  'calm_before_the_storm',
  'high_morale',
  'invasion',
  'night_ops',
  'war_games',
  'week_of_pain',
  'week_of_serenity',
];

export function isOutcomeFamily(
  type: string | null,
): type is EventOutcomeFamily {
  const families: readonly (string | null)[] = OUTCOME_FAMILIES;
  return families.includes(type);
}

const carryReasons: Record<UneventfulCarryBlocker, string> = {
  first_week: 'the militia’s first week never counts',
  forced_calm: 'a calm forced by last week’s All Is Calm never counts',
  automatic_events: 'automatic events happen this week',
  several_events: 'more than one event happens this week',
  other_event: 'an event other than All Is Calm happens this week',
};

/**
 * Whether this week builds next week's uneventful chance bonus, and why not.
 * The engine's `nextUneventfulCarry` is null until every Event roll and
 * choice is in; the reasons come from the same rule the engine applies.
 */
export function uneventfulCarryText(
  context: Pick<EventPanelContext, 'draft' | 'projection'>,
  rank: number,
) {
  const projection = context.projection;
  const carry = projection?.nextUneventfulCarry ?? null;
  if (carry === null)
    return 'Whether this week counts as uneventful is settled once every roll and decision is in.';
  if (carry) return `Uneventful: next week’s event chance rises by ${rank}.`;
  const reasons = uneventfulCarryBlockers({
    firstMilitiaWeek: context.draft.context.firstMilitiaWeek,
    forcedCalm: projection?.forcedCalm ?? false,
    hasAutomaticEvents:
      projection?.positions.some((group) => group.kind === 'automatic') ??
      false,
    selected: projection?.selected ?? [],
  });
  return reasons.length
    ? `Not an uneventful week: ${reasons.map((reason) => carryReasons[reason]).join('; ')}.`
    : 'Not an uneventful week: no chance bonus next week.';
}

// "Next week (week 41)": when a queued effect or benefit applies. An effect
// lasting from this week to the next reads "This week and next (weeks 40–41)".
function weekPhrase(draft: WeeklyDraft, week: number, until = week) {
  if (until > week)
    return week === draft.week && until === draft.week + 1
      ? `This week and next (weeks ${week}–${until})`
      : `Weeks ${week}–${until}`;
  if (week === draft.week + 1) return `Next week (week ${week})`;
  if (week === draft.week) return `This week (week ${week})`;
  return `Week ${week}`;
}

const checkNames: Record<Check, string> = {
  loyalty: 'Loyalty',
  secrecy: 'Secrecy',
  security: 'Security',
};
// Safe cast: checkNames is keyed by exactly the Check values.
const ALL_CHECKS = Object.keys(checkNames) as Check[];
const skillNames: Record<string, string> = {
  stealth: 'Stealth',
  knowledge_local: 'Knowledge (local)',
  bluff: 'Bluff',
  diplomacy: 'Diplomacy',
  intimidate: 'Intimidate',
};
const bonusTypeNames: Record<string, string> = {
  circumstance: 'circumstance',
  morale: 'morale',
  untyped: '',
};
const multiplied = (value: number) =>
  value === 2 ? 'doubled' : `multiplied by ${value}`;

const actionNames: Record<string, string> = { secure_cache: 'Secure Cache' };

// One queued effect other than a check modifier, as an outcome line.
function queuedLine(
  change: Extract<Change, { kind: 'event_queue' }>,
  context: EventPanelContext,
) {
  const draft = context.draft;
  const effect = change.effect.effect;
  const when = weekPhrase(
    draft,
    change.effect.startsWeek,
    change.effect.endsWeek,
  );
  switch (effect.kind) {
    case 'block_action':
      return `${when}: ${actionNames[effect.actionId] ?? 'This action'} cannot be used in Activity.`;
    case 'team_unavailable':
      return `${when}: ${teamOr(context, effect.teamId)} cannot act in Activity.`;
    case 'all_is_calm':
      return `${when} is calm: no event-chance roll and no rolled event, and it does not count as uneventful.`;
    case 'automatic_events':
      return `${when}: ${plural(effect.count, 'automatic event')} before the normal Event roll.`;
    case 'upkeep_loss_multiplier':
      return `${when}: Upkeep training loss is ${multiplied(effect.value)}.`;
    case 'activity_training_multiplier':
      return `${when}: Activity training gain is ${multiplied(effect.value)}.`;
    default:
      return eventChange(change);
  }
}

// Queued check modifiers of one span of weeks and value, read as one line.
type CheckGroup = {
  kind: 'checks';
  week: number;
  until: number;
  value: number;
  checks: Check[];
};

function checkGroupLine(group: CheckGroup, draft: WeeklyDraft) {
  const names = ALL_CHECKS.every((check) => group.checks.includes(check))
    ? 'all organization checks'
    : `${group.checks.map((check) => checkNames[check]).join(', ')} checks`;
  return `${weekPhrase(draft, group.week, group.until)}: ${names} ${signed(group.value)}.`;
}

const teamOr = (context: EventPanelContext, teamId: string) =>
  teamName(context, teamId) ?? 'A team no longer on the roster';

// What a carried event does each week while it lasts.
function persistentEffect(event: Carried, context: EventPanelContext) {
  switch (event.eventType) {
    case 'low_morale':
      return 'Loyalty checks −2 every week while it lasts.';
    case 'double_agent':
      return 'Secrecy checks −2 and no Secure Cache in Activity every week while it lasts.';
    case 'theft':
      return 'Half of all incoming treasury gains are lost every week until a successful Reduce Danger.';
    case 'rivalry': {
      const teams = event.targets.flatMap((target) =>
        target.kind === 'team' ? [teamOr(context, target.teamId)] : [],
      );
      return `${teams.length ? teams.join(' and ') : 'The two teams'} cannot act in Activity until an officer succeeds at DC ${RIVALRY_OFFICER_DC} Bluff, Diplomacy or Intimidate.`;
    }
    default:
      return null;
  }
}

// "Theft becomes persistent from week 14 (1st that week). Half of …"
function persistentLine(event: Carried, context: EventPanelContext) {
  const effect = persistentEffect(event, context);
  return `${eventName(event.eventType) ?? 'The event'} becomes persistent from week ${event.startedWeek} (${ordinal(event.order + 1)} that week).${effect ? ` ${effect}` : ''}`;
}

// One change as an outcome line, or null when it has none of its own.
function changeLine(
  change: Change,
  context: EventPanelContext,
  carriedName: (eventId: string) => string,
) {
  const draft = context.draft;
  switch (change.kind) {
    case 'event_acknowledgement':
      return null;
    case 'event_training':
      return `Training ${signed(change.after - change.before)}: ${change.before} → ${change.after}.`;
    case 'event_end':
      return `${carriedName(change.endedEventId)} ends now.`;
    case 'event_encounter':
      return `The GM runs a combat encounter at CR ${change.challengeRating} (Average Party Level ${change.averagePartyLevel} + 1).`;
    case 'event_skill_benefit': {
      const { benefit } = change;
      const skills = benefit.skills
        .map((skill) => skillNames[skill] ?? 'a skill')
        .join(', ');
      const type = bonusTypeNames[benefit.bonusType] ?? '';
      const town = benefit.settlementId
        ? ` in ${context.settlementName(benefit.settlementId) ?? 'the chosen town'}`
        : '';
      return `${weekPhrase(draft, benefit.startsWeek)}: PCs gain ${signed(benefit.value)}${type ? ` ${type}` : ''} on ${skills}${benefit.afterDark ? ' after dark' : ''}${town}.`;
    }
    case 'event_market_benefit': {
      const { benefit } = change;
      const towns = benefit.settlementIds.map(
        (settlementId) =>
          context.settlementName(settlementId) ?? 'a town no longer recorded',
      );
      return `${weekPhrase(draft, benefit.startsWeek, benefit.endsWeek)}: items and services bought in ${towns.length ? towns.join(', ') : 'no town'} cost an extra ${benefit.discountPercent}% less.`;
    }
    case 'event_activity_bonus':
      return `This week’s Activity checks gain ${signed(change.value)}.`;
    case 'event_identification':
      return `${itemName(context, change.itemId) ?? 'The item'} is identified.`;
    case 'event_item':
      return `${context.personName(change.item.ownerCharacterId ?? '') ?? 'A PC'} receives ${change.item.name} (${formatGold(change.item.valueCopper)}, ${change.item.weight} lb).`;
    case 'event_cache':
      return `${cacheName(change.after)}: ${change.after.status === 'retrieved' ? 'retrieved by the PCs' : 'discovered and lost'}.`;
    case 'event_item_location':
      return `${itemName(context, change.itemId) ?? 'An item'}: ${change.after === 'held' ? 'back in the PCs’ hands' : 'lost with the cache'}.`;
    case 'event_queue':
      return queuedLine(change, context);
    case 'event_persistent':
      return persistentLine(change.event, context);
    case 'event_treasury':
      return `Treasury ${change.retainedPercent === 50 ? 'halved' : `loses ${100 - change.retainedPercent}%`}: ${formatGold(change.before)} → ${formatGold(change.after)}.`;
    case 'event_officer_check':
      return `${context.personName(change.characterId) ?? 'The officer'}’s ${skillNames[change.skill] ?? 'skill'} check: ${change.total} against DC ${change.dc}, ${change.succeeded ? 'success' : 'failure'}.`;
    case 'event_team_loss':
      return `${teamOr(context, change.teamId)} defects and is lost.`;
    default:
      return eventChange(change);
  }
}

/**
 * The occurrence's own changes as outcome lines, in the order the rules made
 * them. Queued check modifiers of one week and value read as one line, and
 * all three organization checks as "all organization checks".
 */
export function outcomeLines(
  changes: readonly Change[],
  context: EventPanelContext,
  carriedName: (eventId: string) => string,
): string[] {
  const entries: (string | CheckGroup)[] = [];
  for (const change of changes) {
    if (
      change.kind === 'event_queue' &&
      change.effect.effect.kind === 'check_modifier'
    ) {
      const { startsWeek: week, endsWeek: until } = change.effect;
      const { check, value } = change.effect.effect;
      const group = entries.find(
        (entry): entry is CheckGroup =>
          typeof entry !== 'string' &&
          entry.week === week &&
          entry.until === until &&
          entry.value === value,
      );
      if (group) group.checks.push(check);
      else
        entries.push({ kind: 'checks', week, until, value, checks: [check] });
      continue;
    }
    const line = changeLine(change, context, carriedName);
    if (line) entries.push(line);
  }
  return entries.map((entry) =>
    typeof entry === 'string' ? entry : checkGroupLine(entry, context.draft),
  );
}

// Where this occurrence sits in the week's resolution order.
type Resolution = {
  dispatch: EventDispatch[];
  // Resolution index of an event; unresolved events sort last.
  position: (eventId: string) => number;
  own: number;
  // The first occurrence of this type when this one is its Twice or a
  // no-additional-effect duplicate.
  firstOf: string | null;
};

function resolution(item: Item, context: EventPanelContext): Resolution {
  const id = item.occurrence.eventId;
  const dispatch = context.projection?.dispatch ?? [];
  const position = (eventId: string) => {
    const index = dispatch.findIndex(
      (entry) => entry.event.eventId === eventId,
    );
    return index < 0 ? Number.POSITIVE_INFINITY : index;
  };
  const first = dispatch.find(
    (entry) => entry.event.eventId === id,
  )?.firstEventId;
  return {
    dispatch,
    position,
    own: position(id),
    firstOf:
      item.mode !== 'base' && item.mode !== null && first && first !== id
        ? first
        : null,
  };
}

// How a Twice or duplicate relates to its first occurrence, which carries the
// combined effect the engine records for most families.
function twiceNotes(
  item: Item,
  eventType: EventOutcomeFamily,
  context: EventPanelContext,
  { dispatch, firstOf }: Resolution,
) {
  const id = item.occurrence.eventId;
  const notes: string[] = [];
  if (firstOf) {
    const label = context.eventLabel(firstOf);
    notes.push(
      item.mode === 'no_additional_effect'
        ? `No additional effect: ${label} already applies this.`
        : eventType === 'all_is_calm'
          ? `Twice with ${label}: next week is calm too.`
          : eventType === 'high_morale'
            ? `Twice with ${label}: this one ends its own carried events; the combined Loyalty bonus is listed under ${label}.`
            : `Twice with ${label}: the combined effect is listed under ${label}.`,
    );
  }
  const twins = dispatch.filter(
    (entry) =>
      entry.firstEventId === id &&
      entry.event.eventId !== id &&
      entry.mode === 'twice',
  );
  if (twins.length)
    notes.push(
      `Includes the Twice from ${twins.map((entry) => context.eventLabel(entry.event.eventId)).join(', ')}.`,
    );
  return notes;
}

// War Games and Invasion never combine: each occurrence counts on its own.
function independenceNote(
  item: Item,
  eventType: EventOutcomeFamily,
  context: EventPanelContext,
  { dispatch, position, own }: Resolution,
) {
  if (
    item.mode !== 'base' ||
    (eventType !== 'war_games' && eventType !== 'invasion')
  )
    return [];
  const earlier = dispatch.find(
    (entry) =>
      entry.event.eventType === eventType &&
      entry.event.eventId !== item.occurrence.eventId &&
      position(entry.event.eventId) < own,
  );
  if (!earlier) return [];
  const label = context.eventLabel(earlier.event.eventId);
  return [
    eventType === 'war_games'
      ? `Independent of ${label}: each War Games adds its own training.`
      : `Independent of ${label}: each Invasion is its own encounter.`,
  ];
}

// All Is Calm's own line. Beside another event (a Roll Twice pair or an
// automatic event) the week is not quiet, so the calm simply has no effect.
function calmOutcome(context: EventPanelContext) {
  return context.projection?.selected.some(
    (event) => event.eventType !== 'all_is_calm',
  )
    ? 'No effect: another event happens this week.'
    : 'No event this week.';
}

// What happened: required where the engine asks (Invasion, Night Ops),
// offered on War Games and High Morale. The calm events and the Weeks record
// no account; one recorded earlier stays editable and clearable.
const accountHints: Partial<Record<EventOutcomeFamily, string>> = {
  invasion: 'How the encounter went at the table.',
  night_ops: 'What the night’s operations achieved.',
  war_games: 'The table’s outcome, in a sentence.',
  high_morale: 'The table’s outcome, in a sentence.',
};

function account(
  item: Item,
  eventType: EventOutcomeFamily,
  context: EventPanelContext,
) {
  const hint = accountHints[eventType];
  const isRecorded = context.draft.acknowledgements.some(
    (entry) => entry.subjectId === `event:${item.occurrence.eventId}`,
  );
  return hint || isRecorded || codes(item).has('acknowledgement')
    ? whatHappened(item, context, hint ?? 'The table’s outcome, in a sentence.')
    : null;
}

/**
 * The calm, morale, narrative and training events: All Is Calm, Calm before
 * the Storm, High Morale, Invasion, Night Ops, War Games, Week of Pain and
 * Week of Serenity. Their outcome lines come from the engine's own changes;
 * High Morale's endings and Invasion's party level are their only inputs
 * besides What happened, which is required exactly where the engine asks.
 */
export function outcomePanel(
  item: Item,
  eventType: EventOutcomeFamily,
  context: EventPanelContext,
): OutcomePanel {
  const { has } = codes(item);
  const id = item.occurrence.eventId;
  const order = resolution(item, context);
  const carriedName = carriedNames(context);
  const isCalm =
    eventType === 'all_is_calm' || eventType === 'calm_before_the_storm';
  const rank = eventRank(context);
  const lines = outcomeLines(item.changes, context, carriedName);
  const level = item.occurrence.averagePartyLevel ?? null;
  return {
    family: 'outcome',
    eventType,
    endings:
      eventType === 'high_morale'
        ? endingChoice(item, context, order, carriedName)
        : null,
    partyLevel:
      eventType === 'invasion'
        ? {
            value: level,
            required: has('average-party-level'),
            challengeRating:
              level === null ? null : invasionChallengeRating(level),
          }
        : null,
    notes: [
      ...twiceNotes(item, eventType, context, order),
      ...independenceNote(item, eventType, context, order),
      ...(isCalm ? [uneventfulCarryText(context, rank)] : []),
    ],
    whatHappened: account(item, eventType, context),
    outcomes:
      eventType === 'all_is_calm' && item.mode === 'base'
        ? [calmOutcome(context), ...lines]
        : lines,
    partial: item.requirements.some((code) => code.startsWith(`${id}:`)),
    retained: retainedFields(
      item.occurrence,
      {
        targets: eventType === 'high_morale' ? ['event'] : [],
        rolls: [],
        fields: eventType === 'invasion' ? ['averagePartyLevel'] : [],
      },
      context,
      carriedName,
    ),
  };
}

// Carried events by identity, including ones this week makes persistent:
// "Theft (since week 9)".
export function carriedNames(context: EventPanelContext) {
  const created = (context.projection?.plan ?? []).flatMap((change) =>
    change.kind === 'event_persistent' ? [change] : [],
  );
  return (eventId: string) => {
    const carried = context.draft.context.carriedEvents.find(
      (event) => event.eventId === eventId,
    );
    if (carried)
      return `${eventName(carried.eventType)} (since week ${carried.startedWeek})`;
    const made = created.find((change) => change.event.eventId === eventId);
    if (made)
      return `${eventName(made.event.eventType)} (from ${context.eventLabel(made.eventId)})`;
    return 'A carried event no longer recorded';
  };
}

// The carried events still current when this High Morale resolves: those
// carried in, less any Activity or an earlier event ended, plus any an
// earlier event this week made persistent, oldest first. `source` names the
// event that made one persistent this week.
function currentCarriedEvents(
  item: Item,
  context: EventPanelContext,
  { position, own }: Resolution,
) {
  const id = item.occurrence.eventId;
  const plan = context.projection?.plan ?? [];
  const activityEnded = new Set(context.activity?.endedEventIds ?? []);
  const endedEarlier = new Set(
    plan.flatMap((change) =>
      change.kind === 'event_end' &&
      change.eventId !== id &&
      position(change.eventId) < own
        ? [change.endedEventId]
        : [],
    ),
  );
  const created = plan.flatMap((change) =>
    change.kind === 'event_persistent' &&
    Math.max(
      ...(change.event.sourceEventIds ?? [change.eventId]).map(position),
    ) < own
      ? [{ event: change.event, source: change.eventId }]
      : [],
  );
  const current: { event: Carried; source: string | null }[] = [
    ...context.draft.context.carriedEvents
      .filter((event) => !activityEnded.has(event.eventId))
      .map((event) => ({ event, source: null })),
    ...created,
  ].filter(({ event }) => !endedEarlier.has(event.eventId));
  return orderCarriedEvents(current.map(({ event }) => event)).map(
    // Safe cast: orderCarriedEvents only sorts a copy of current's events, so
    // each one has its entry.
    (event) => current.find((entry) => entry.event === event)!,
  );
}

function endingHint({
  current,
  count,
  nominal,
  isChosen,
}: {
  current: number;
  count: number;
  nominal: number;
  isChosen: boolean;
}) {
  if (!current)
    return 'No carried persistent event is left to end. The Loyalty bonus still applies.';
  if (count < nominal)
    return `Only ${plural(count, 'carried event')} ${count === 1 ? 'is' : 'are'} left to end, not ${nominal}. The Loyalty bonus still applies.`;
  if (isChosen) return null;
  return count === 1
    ? 'The oldest carried event ends unless you choose another.'
    : `The ${count} oldest carried events end unless you choose others.`;
}

// High Morale's ending cards. Without a recorded choice the rules end the
// oldest; the Twice occurrence ends what is left of two.
function endingChoice(
  item: Item,
  context: EventPanelContext,
  order: Resolution,
  carriedName: (eventId: string) => string,
): EventEndingChoice {
  const current = currentCarriedEvents(item, context, order);
  const firstOf = order.firstOf;
  const isTwice = item.mode === 'twice' && firstOf !== null;
  // Only the first occurrence's endings precede this one in the plan.
  const endedEarlier = isTwice
    ? (context.projection?.plan ?? []).filter(
        (change) => change.kind === 'event_end' && change.eventId === firstOf,
      ).length
    : 0;
  const nominal = highMoraleEndingCount({
    twice: isTwice,
    endedEarlier,
    current: Number.POSITIVE_INFINITY,
  });
  const count = Math.max(
    0,
    highMoraleEndingCount({
      twice: isTwice,
      endedEarlier,
      current: current.length,
    }),
  );
  const recorded =
    item.occurrence.targets?.flatMap((target) =>
      target.kind === 'event' ? [target.eventId] : [],
    ) ?? [];
  const isChosen = recorded.length > 0;
  const available = new Set(current.map(({ event }) => event.eventId));
  const retained: EventRetainedTarget[] = recorded
    .filter((eventId) => !available.has(eventId))
    .map((eventId) => ({
      value: eventId,
      label: carriedName(eventId),
      reason: 'It is no longer current when this event resolves. Clear it.',
    }));
  return {
    label:
      count > 1 ? 'Persistent events that end' : 'Persistent event that ends',
    hint: endingHint({ current: current.length, count, nominal, isChosen }),
    required: codes(item).has('persistent-targets'),
    count,
    chosen: isChosen,
    selected: isChosen
      ? recorded.filter((eventId) => available.has(eventId))
      : item.changes.flatMap((change) =>
          change.kind === 'event_end' ? [change.endedEventId] : [],
        ),
    choices: current.map(({ event, source }) => ({
      value: event.eventId,
      label: eventName(event.eventType) ?? 'A carried event',
      description: source
        ? `Persistent from ${context.eventLabel(source)}`
        : `Since week ${event.startedWeek} · ${ordinal(event.order + 1)} that week`,
    })),
    retained,
  };
}

const decisionNames = {
  unattempted: 'Let it happen',
  mitigate: 'Check',
  buyoff: 'Buyoff',
  end: 'Ending',
} as const;
const rollNames: Record<string, string> = {
  check: 'check',
  loss: 'loss',
  notoriety: 'notoriety',
};

function targetName(
  target: Target,
  context: EventPanelContext,
  carriedName: (eventId: string) => string,
) {
  switch (target.kind) {
    case 'team':
      return (
        context.teams.find((team) => team.teamId === target.teamId)?.name ??
        'A team'
      );
    case 'settlement':
      return context.settlementName(target.settlementId) ?? 'A settlement';
    case 'character':
      return context.personName(target.characterId) ?? 'A character';
    case 'event': {
      const label = context.eventLabel(target.eventId);
      // A current-week event has its block label; otherwise a carried one.
      return label === 'Event' ? carriedName(target.eventId) : label;
    }
    case 'item':
      return 'An item';
    case 'cache':
      return 'A cache';
  }
}

const personOr = (context: EventPanelContext, characterId: string) =>
  context.personName(characterId) ?? 'An unnamed character';

// Each field an outcome event never uses: its label and recorded value, or
// null when nothing is recorded.
const RETAINED: {
  field: Exclude<
    EventRetainedField['field'],
    'targets' | 'averagePartyLevel' | 'rolls'
  >;
  label: string;
  value: (occurrence: Occurrence, context: EventPanelContext) => string | null;
}[] = [
  {
    field: 'mitigation',
    label: 'Mitigation',
    value: ({ mitigation }) =>
      mitigation === undefined
        ? null
        : mitigation === 'attempted'
          ? 'Attempt it'
          : 'Let it happen',
  },
  {
    field: 'officerCheck',
    label: 'Officer check',
    value: ({ officerCheck }, context) =>
      officerCheck ? personOr(context, officerCheck.characterId) : null,
  },
  {
    field: 'targetChecks',
    label: 'Target checks',
    value: ({ targetChecks }) =>
      targetChecks?.length ? plural(targetChecks.length, 'check') : null,
  },
  {
    field: 'rewards',
    label: 'Rewards',
    value: ({ rewards }) =>
      rewards?.length ? rewards.map((reward) => reward.name).join(', ') : null,
  },
  {
    field: 'persistent',
    label: 'Persistent flag',
    value: ({ persistent }) =>
      persistent === undefined
        ? null
        : persistent
          ? 'Persistent'
          : 'Not persistent',
  },
  {
    field: 'persistentDecision',
    label: 'Persistent decision',
    value: ({ persistentDecision }) =>
      persistentDecision ? decisionNames[persistentDecision.kind] : null,
  },
  {
    field: 'overseerCharacterId',
    label: 'Overseer support',
    value: ({ overseerCharacterId }, context) =>
      overseerCharacterId ? personOr(context, overseerCharacterId) : null,
  },
];

/** What an event family reads from its occurrence; the rest is retained. */
export type EventFieldUse = {
  // Target kinds the event reads (High Morale's ended `event` targets).
  targets: readonly Target['kind'][];
  // Named rolls the event reads (Theft's `check`, Turncoat's `loss`).
  rolls: readonly string[];
  // Other occurrence fields the event reads.
  fields: readonly EventRetainedField['field'][];
};

// Recorded inputs the event does not use, listed so each can be cleared.
export function retainedFields(
  occurrence: Occurrence,
  uses: EventFieldUse,
  context: EventPanelContext,
  carriedName: (eventId: string) => string,
): EventRetainedField[] {
  const unusedTargets = (occurrence.targets ?? []).filter(
    (target) => !uses.targets.includes(target.kind),
  );
  const unusedRolls = Object.keys(occurrence.rolls ?? {}).filter(
    (name) => !uses.rolls.includes(name),
  );
  return [
    ...(unusedTargets.length
      ? [
          {
            field: 'targets' as const,
            label: 'Targets',
            value: unusedTargets
              .map((target) => targetName(target, context, carriedName))
              .join(', '),
          },
        ]
      : []),
    ...(!uses.fields.includes('averagePartyLevel') &&
    occurrence.averagePartyLevel !== undefined
      ? [
          {
            field: 'averagePartyLevel' as const,
            label: 'Average Party Level',
            value: String(occurrence.averagePartyLevel),
          },
        ]
      : []),
    ...(unusedRolls.length
      ? [
          {
            field: 'rolls' as const,
            label: 'Rolls',
            value: unusedRolls
              .map((name) => `${rollNames[name] ?? 'other'} roll`)
              .join(', '),
          },
        ]
      : []),
    ...RETAINED.flatMap(({ field, label, value }) => {
      if (uses.fields.includes(field)) return [];
      const recorded = value(occurrence, context);
      return recorded === null ? [] : [{ field, label, value: recorded }];
    }),
  ];
}

/**
 * Event-identified wording for a code of a calm, morale, narrative or
 * training event; null leaves it to the general wording.
 */
export function outcomePanelMessage(
  panel: OutcomePanel,
  tail: string,
): string | null {
  if (tail === 'average-party-level') return 'enter the Average Party Level.';
  if (tail === 'persistent-targets' && panel.endings) {
    const { count } = panel.endings;
    if (count === 0)
      return 'no carried event is left to end. Clear the recorded choice.';
    return count === 1
      ? 'choose the carried event that ends.'
      : `choose the ${count} carried events that end.`;
  }
  return null;
}

/**
 * The ended carried events to record after pressing one card: it replaces
 * the choice when one event ends, and toggles within the recorded choice
 * when more end, dropping the earliest pick beyond the count. Starting from
 * the rules' default, a press starts a fresh choice.
 */
export function pressEnding(endings: EventEndingChoice, value: string) {
  if (endings.count <= 1) return [value];
  const recorded = endings.chosen ? endings.selected : [];
  if (recorded.includes(value))
    return recorded.filter((entry) => entry !== value);
  return [...recorded, value].slice(-endings.count);
}

/** The recorded ending choice without one entry, kept or no longer current. */
export function endingsWithout(endings: EventEndingChoice, value: string) {
  return [
    ...(endings.chosen ? endings.selected : []),
    ...endings.retained.map((entry) => entry.value),
  ].filter((entry) => entry !== value);
}
