import type { EventPositionGroup } from '~/lib/rules-event-selection';
import type { EventView } from './types';

type TopologyContext = {
  positions: readonly EventPositionGroup[];
  events: { eventId: string; sabotageId: string | null; label: string }[];
  candidateLabel: (choiceId: string) => string | null;
  sourceLabel: (sourceId: string) => string;
  settlementName: string | null;
  preparationFailed: boolean;
  warning: boolean;
  // Wording an event's own controls give a code (`tail` follows its id).
  detail?: (eventId: string, tail: string, warning: boolean) => string | null;
};

/**
 * Wording for a candidate set's own codes (both candidates, the choice of
 * one), or null for any other code or a choice no longer staged.
 */
export function candidateSetMessage(
  code: string,
  context: Pick<
    TopologyContext,
    'positions' | 'candidateLabel' | 'preparationFailed'
  >,
): string | null {
  for (const suffix of ['candidates:2', 'selected-event'] as const) {
    if (!code.endsWith(`:${suffix}`)) continue;
    const choiceId = code.slice(0, -suffix.length - 1);
    const label = context.candidateLabel(choiceId);
    if (!label) continue;
    if (suffix === 'selected-event')
      return `${label}: choose which event happens.`;
    return context.positions.some(
      (group) =>
        group.kind === 'candidates' &&
        group.choiceId === choiceId &&
        group.eventIds.length > group.count,
    )
      ? `${label}: more than two candidates are recorded. Clear the extra one to remove it.`
      : `${label}: both event candidates ${context.preparationFailed ? 'could not be prepared. Use Retry in Event.' : 'are being prepared.'}`;
  }
  return null;
}

// Wording for one Event requirement or warning that names its event, source
// or Activity choice, so This phase and each block identify what is open.
// Returns null for codes Event does not own.
export function eventTopologyMessage(
  code: string,
  context: TopologyContext,
): string | null {
  const preparing = context.preparationFailed
    ? 'could not be prepared. Use Retry in Event.'
    : 'is being prepared.';
  const overfull = (match: (group: EventPositionGroup) => boolean) =>
    context.positions.some(
      (group) => match(group) && group.eventIds.length > group.count,
    );
  if (code === 'event:chance:1d100')
    return 'Event chance: enter the chance roll (d100).';
  if (code === 'event:chance:roll-range')
    return 'Event chance: the roll is outside 1–100. The recorded value is kept for the table.';
  if (code === 'event:hidden-agenda-cycle')
    return 'Hidden Agenda: the recalculated Activity keeps changing whether the event happens. Review the Activity checks with the table.';
  if (code === 'event:operating-settlement')
    return `Event chance: record ${context.settlementName ?? 'the operating settlement'}’s reputation, or choose another operating settlement in Activity.`;
  if (code === 'event:root:1')
    return overfull((group) => group.kind === 'rolled')
      ? 'The event: more than one rolled event is recorded. Clear the extra one to remove it.'
      : `The event: the rolled event ${preparing}`;
  const automatic = /^(.*):automatic-events:(\d+)$/.exec(code);
  if (automatic) {
    // Safe cast: the automatic regex's (.*) group always takes part in a match.
    const label = context.sourceLabel(automatic[1]!);
    return overfull(
      (group) => group.kind === 'automatic' && group.sourceId === automatic[1],
    )
      ? `Automatic events from ${label}: more are recorded than the rules ask for. Clear the extra one to remove it.`
      : `Automatic events from ${label}: the ${automatic[2] === '1' ? 'event' : `${automatic[2]} events`} ${preparing}`;
  }
  const candidates = candidateSetMessage(code, context);
  if (candidates) return candidates;
  // The longest matching identity owns the code: an event or its Sabotage.
  const owner = context.events
    .flatMap((event) =>
      [event.eventId, event.sabotageId].flatMap((id) =>
        id && code.startsWith(`${id}:`) ? [{ id, event }] : [],
      ),
    )
    .sort((a, b) => b.id.length - a.id.length)[0];
  if (!owner) return null;
  const tail = code.slice(owner.id.length + 1);
  const prefix = `${owner.event.label}: `;
  if (owner.id === owner.event.sabotageId)
    return `${prefix}${sabotageMessage(tail, context.warning)}`;
  if (tail === 'table:1d100') return `${prefix}enter the table roll (d100).`;
  if (tail === 'roll_twice:2')
    return overfull(
      (group) =>
        group.kind === 'roll_twice' && group.parentEventId === owner.id,
    )
      ? `${prefix}more than two Roll Twice events are recorded. Clear the extra one to remove it.`
      : `${prefix}its two Roll Twice events ${preparing.replace('is ', 'are ')}`;
  if (tail === 'replacement:1') {
    const group = context.positions.find(
      (entry) =>
        entry.kind === 'replacement' && entry.parentEventId === owner.id,
    );
    if (group && 'reroll' in group && group.reroll)
      return `${prefix}Roll Twice again: reroll and enter the new die.`;
    return overfull(
      (entry) =>
        entry.kind === 'replacement' && entry.parentEventId === owner.id,
    )
      ? `${prefix}more than one replacement is recorded. Clear the extra one to remove it.`
      : `${prefix}its replacement event ${preparing}`;
  }
  if (tail === 'automatic-event-source')
    return `${prefix}no automatic event is due from its source this week. Clear it to remove it.`;
  if (tail === 'event-eligibility')
    return `${prefix}cannot normally occur now. Roll its replacement, or keep it with a reasoned Rules Exception.`;
  const detail = context.detail?.(owner.id, tail, context.warning);
  if (detail) return `${prefix}${detail}`;
  const text = context.warning ? eventWarning(code) : eventRequirement(code);
  return `${prefix}${text}`;
}
export function eventRequirement(value: string) {
  const dice = /(?:^|:)([\w-]+):(\d+)d(\d+)$/.exec(value);
  if (dice) {
    const labels: Record<string, string> = {
      table: 'Event table roll',
      chance: 'Event chance roll',
      check: 'Check',
      loss: 'Loss roll',
      notoriety: 'Notoriety roll',
      capture: 'Capture roll',
      mitigation: 'Target mitigation check',
      sickness: 'Sickness check',
      theft: 'Theft check',
      rivalry: 'Rivalry officer check',
      diplomacy: 'Diplomacy officer check',
    };
    // Safe cast: the dice regex's ([\w-]+) group is not optional, so it is set
    // whenever exec matches.
    return `${labels[dice[1]!] ?? 'Required roll'}: enter ${dice[2]}d${dice[3]}.`;
  }
  const messages: [string, string][] = [
    [
      'review',
      'A character left the campaign. Review this event’s choices before continuing.',
    ],
    [
      'overseer-already-used',
      'Overseer support is already used on another event this week. Move it here or remove it.',
    ],
    [
      'overseer-conflict',
      'Different Overseers are recorded for this event. Turn support off and on again to keep one.',
    ],
    [
      'overseer-ineligible',
      'The recorded Overseer no longer holds the role. Remove the support.',
    ],
    ['roll_twice', 'Roll Twice needs two independent child events.'],
    ['replacement', 'A replacement event roll is required.'],
    ['acknowledgement', 'Record the table’s outcome acknowledgement.'],
    ['automatic-events', 'Add the required automatic event occurrences.'],
    ['automatic-event-source', 'Select an available automatic event source.'],
    ['event:root:1', 'Add one rolled event.'],
    ['average-party-level', 'Enter the average party level.'],
    ['skill-bonus', 'Enter the officer’s skill bonus.'],
    ['officer-check', 'Supply an officer check.'],
    ['exception', 'Record a reasoned exception or revise the selection.'],
    ['same-team', 'Choose the same team as the first occurrence.'],
    ['same-settlement', 'Choose the same settlement as the first occurrence.'],
    ['mitigation-target', 'Choose a target for mitigation.'],
    [
      'persistent-targets',
      'Choose the persistent events affected by this outcome.',
    ],
    ['tracked-people', 'Choose the affected tracked characters.'],
    ['recipient', 'Choose an active player character as the reward recipient.'],
    ['duplicate', 'Each reward needs its own item identity.'],
    ['reward', 'Record the required character rewards.'],
    ['selected-event', 'Select an Activity event candidate.'],
    ['candidates', 'Complete both Activity event candidates.'],
    ['settlement', 'Choose the affected settlement.'],
    ['team', 'Choose the affected team or teams.'],
    ['officer', 'Choose the officer for this check.'],
    ['cache', 'Choose the affected cache and review its contents.'],
    ['item', 'Choose the affected item.'],
    ['outcome', 'Record the event outcome.'],
    ['check-type', 'Choose the reactive action’s check.'],
  ];
  return (
    messages.find(([key]) => value.includes(key))?.[1] ??
    'An earlier phase or event decision needs attention.'
  );
}
export function eventWarning(value: string) {
  if (value.endsWith('roll-range'))
    return 'The roll is outside its usual range. The recorded value is retained for the table.';
  if (value.endsWith('calculated-event'))
    return 'The event type follows the modified table roll.';
  if (value.includes('alchemical-reward'))
    return 'The reward differs from the permitted alchemical item. Record an exception or revise it.';
  if (value.endsWith('event-eligibility'))
    return 'This event cannot normally occur in the current militia state. Supply a replacement or a reasoned exception.';
  return 'Review this event’s target, officer or team eligibility with the table.';
}
export function eventChange(
  change: EventView['occurrences'][number]['changes'][number],
) {
  if (
    'before' in change &&
    'after' in change &&
    (typeof change.before === 'string' || typeof change.before === 'number') &&
    (typeof change.after === 'string' || typeof change.after === 'number')
  ) {
    const labels: Record<string, string> = {
      event_treasury: 'Treasury (copper)',
      event_training: 'Training',
      event_team_status: 'Team condition',
      event_team_recovery: 'Team condition',
      event_reputation: 'Settlement reputation',
    };
    return `${labels[change.kind] ?? 'Outcome'}: ${String(change.before)} → ${String(change.after)}`;
  }
  const labels: Record<string, string> = {
    event_queue: 'An effect carries into future weeks.',
    event_persistent: 'A persistent event carries forward.',
    event_end: 'A persistent event ends.',
    event_item: 'A character receives the recorded item.',
    event_identification: 'The recorded item is identified.',
    event_acknowledgement: 'The table outcome is recorded.',
    event_activity_bonus: 'The event changes the Activity allowance.',
    event_capture: 'Character capture is resolved.',
    event_loss: 'The event records a loss.',
    event_check_bonus: 'The event grants a check bonus.',
    event_skill_benefit: 'The event grants a skill benefit.',
    event_market_benefit: 'The event grants market access.',
  };
  return (
    labels[change.kind] ?? 'The event outcome is included in the week preview.'
  );
}

// Sabotage wording for one code of an event's reaction (`tail` follows the
// reaction's identity).
export function sabotageMessage(tail: string, warning = false) {
  if (tail === 'team') return 'Sabotage: choose the Saboteurs team.';
  if (tail === 'check-type')
    return 'Sabotage: choose the check (Loyalty, Secrecy or Security).';
  if (tail === 'check:1d20') return 'Sabotage: enter the check roll (d20).';
  if (tail === 'notoriety:1d6')
    return 'Sabotage: enter the notoriety roll (d6).';
  if (tail === 'acknowledgement') return 'Sabotage: record what happened.';
  if (tail === 'no-event')
    return 'Sabotage: a calm week has no event to negate. Cancel it.';
  if (tail.endsWith(':roll-range'))
    return 'Sabotage: the roll is outside its usual range. The recorded value is kept for the table.';
  if (tail.endsWith(':exception'))
    return 'Sabotage: record a Rules Exception reason for this team, or choose another team.';
  return warning
    ? 'Sabotage: this team cannot normally sabotage now.'
    : `Sabotage: ${eventRequirement(tail)}`;
}
