import { draftReviewRequirement } from '~/lib/weekly-draft-review';
import type { CanonicalResolutionPreview } from '~/lib/canonical-weekly-resolution';
import type { PersistentChange } from '~/lib/rules-persistent-events';
import type { WeeklyDraft, WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import { activityLabel } from './activity-labels';
import { eventName, eventOccurrenceLabels } from './event-tree-facts';
import { activitySlotAnchor, eventOccurrenceAnchor } from './source-anchors';
import { formatGold } from './week-frame/reference-copy';
import type { Phase, PersistentView } from './types';

// Pure derivations behind the Persistent sections: stable carried-event
// order, the buyoff overview, which Activity or Event result already ends an
// event, each section's projected result and the semantic edits its cards
// send. Everything reads the shared Resolution Preview; nothing decides.

type Carried = WeeklyDraft['context']['carriedEvents'][number];
type Decision = WeeklyDraft['persistent']['decisions'][number];
type Phases = NonNullable<CanonicalResolutionPreview['phases']>;
type Event = PersistentView['events'][number];
export type PersistentCard = 'unattempted' | 'mitigate' | 'buyoff' | 'end';

export function orderCarriedEvents(events: readonly Carried[]) {
  return [...events].sort(
    (a, b) =>
      a.startedWeek - b.startedWeek ||
      a.order - b.order ||
      a.eventId.localeCompare(b.eventId),
  );
}

export function ordinal(value: number) {
  const tens = value % 100;
  const suffixes: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' };
  const suffix =
    tens >= 11 && tens <= 13 ? 'th' : (suffixes[value % 10] ?? 'th');
  return `${value}${suffix}`;
}

// An Activity or Event result that actually ended a carried event this
// week, named from its plan provenance. A card, roll or source that did not
// resolve an ending leaves no plan entry and so hides nothing.
export function sourceEndings(draft: WeeklyDraft, phases: Phases | null) {
  const endings = new Map<string, NonNullable<Event['endedBy']>>();
  if (!phases) return endings;
  for (const change of phases.activity.plan) {
    if (change.kind !== 'end_persistent_event' || endings.has(change.eventId))
      continue;
    const index = draft.activity.slots.findIndex(
      (slot) => slot.choice?.choiceId === change.choiceId,
    );
    const slot = draft.activity.slots[index];
    const action = slot?.choice ? activityLabel(slot.choice.actionId) : null;
    endings.set(change.eventId, {
      label: slot
        ? `${action} in Activity slot ${index + 1}`
        : 'an Activity action',
      link: {
        phase: 'activity',
        anchor: slot ? activitySlotAnchor(slot.slotId) : null,
      },
    });
  }
  // Current-week occurrences go by the Event phase's own labels ("Event 2A").
  const labels = eventOccurrenceLabels(draft, phases.event.positions);
  for (const change of phases.event.plan) {
    if (change.kind !== 'event_end' || endings.has(change.endedEventId))
      continue;
    const label = labels.get(change.eventId);
    const type = phases.event.tree.find(
      (entry) => entry.eventId === change.eventId,
    )?.eventType;
    const name = eventName(type) ?? 'An event';
    endings.set(change.endedEventId, {
      label: label ? `${name} in ${label}` : `${name} in Event`,
      link: {
        phase: 'event',
        anchor: label ? eventOccurrenceAnchor(change.eventId) : null,
      },
    });
  }
  return endings;
}

// The phases before Persistent whose open requirements the Persistent
// projection inherited, in week order. Requirements that name a carried
// event (or Persistent itself) stay with their section.
export function earlierPhases(
  requirements: readonly string[],
  ownIds: readonly string[],
  phases: Phases | null,
): Phase[] {
  const order = ['upkeep', 'activity', 'event'] as const;
  if (!phases) return [...order];
  const found = new Set<Phase>(
    order.filter((phase) => phases[phase].requirements.length),
  );
  // Anything else, such as a same-week event's nested decision, is Event's.
  if (
    requirements.some(
      (key) =>
        !isOwnRequirement(key, ownIds) &&
        !order.some((phase) => phases[phase].requirements.includes(key)),
    )
  )
    found.add('event');
  return order.filter((phase) => found.has(phase));
}

export function isOwnRequirement(key: string, ownIds: readonly string[]) {
  return (
    key.startsWith('persistent:') ||
    ownIds.some((id) => key.startsWith(`${id}:`))
  );
}

export const earlierPhasesKey = (phases: readonly Phase[]) =>
  `persistent:earlier-phases:${phases.join('+')}`;

export function buyoffAvailability(
  week: number,
  lastBuyoffWeek: number | null,
) {
  if (lastBuyoffWeek === null) return 'First buyoff available now';
  if (week >= lastBuyoffWeek + 4) return 'Buyoff available now';
  return `Buyoff waits until week ${lastBuyoffWeek + 4}`;
}

const leaveNotes: Partial<Record<Carried['eventType'], string>> = {
  theft:
    'Half of all incoming treasury gains are lost each week until a Reduce Danger action succeeds.',
  rivalry: 'The two rival teams cannot act in the Activity phase.',
  low_morale: 'Loyalty checks suffer −2.',
  double_agent: 'Secrecy checks suffer −2 and Secure Cache is unavailable.',
};
export function leaveNote(type: Carried['eventType']) {
  return leaveNotes[type] ?? 'The event continues into next week.';
}

// Only Theft and Rivalry have a rules check; other types get no card.
export function checkChoice(type: Carried['eventType']) {
  if (type === 'theft')
    return {
      label: 'Loyalty check (this week only)',
      note: 'A Loyalty check against DC 20 keeps 90% of this week’s gains instead. It lasts one week and must be repeated; the event stays.',
    };
  if (type === 'rivalry')
    return {
      label: 'Officer check to end it',
      note: 'An officer ends the Rivalry for good with a Diplomacy, Bluff or Intimidate check against DC 20.',
    };
  return null;
}

type Result = Event['result'];
function findChange<K extends PersistentChange['kind']>(
  changes: readonly PersistentChange[],
  kind: K,
) {
  return changes.find(
    (change): change is Extract<PersistentChange, { kind: K }> =>
      change.kind === kind,
  );
}

// An ending the Persistent decision itself staged, if any.
function stagedEnding(
  changes: readonly PersistentChange[],
  costPending: boolean,
): Result | null {
  const ended = findChange(changes, 'persistent_ended');
  if (!ended) return null;
  if (ended.reason === 'officer')
    return { tone: 'ends', text: 'Ends · officer check succeeded' };
  if (ended.reason === 'recorded')
    return { tone: 'ends', text: 'Ends · recorded at the table' };
  const buyoff = findChange(changes, 'persistent_buyoff');
  return {
    tone: 'ends',
    text:
      costPending || !buyoff
        ? 'Ends · buyoff cost waits for earlier phases'
        : `Ends · buyoff ${formatGold(buyoff.costCopper)}`,
  };
}

const decisionSubjects: Record<PersistentCard, string> = {
  buyoff: 'Buyoff',
  end: 'Ending',
  mitigate: 'Check',
  unattempted: 'Decision',
};

// What still holds the chosen decision back, if anything.
function unmetDecision(decision: Decision | null, rules: string[]) {
  const attention = (text: string): Result => ({ tone: 'attention', text });
  if (rules.includes('teams')) return attention('Needs two rival teams');
  if (decision?.kind === 'buyoff' && rules.includes('rank'))
    return attention('Buyoff cost needs the militia rank');
  if (decision?.kind === 'end' && rules.includes('ending-acknowledgement'))
    return attention('Ending needs how it ended');
  if (decision?.kind === 'mitigate' && rules.includes('no-mitigation-rule'))
    return attention('This event has no check to attempt');
  if (!rules.some((rule) => rule.endsWith(':exception'))) return null;
  const subject = decisionSubjects[decision?.kind ?? 'unattempted'];
  return attention(`${subject} needs a Rules Exception`);
}

// A check attempt that leaves the event in place this week.
// A successful Theft check keeps 90% only once no other Theft still takes
// half of this week's gains.
function checkResult(
  eventType: Carried['eventType'],
  changes: readonly PersistentChange[],
  otherThefts: readonly string[],
): Result {
  const mitigation = findChange(changes, 'persistent_mitigation');
  if (mitigation && !mitigation.succeeded)
    return { tone: 'stays', text: 'Stays · Loyalty check failed' };
  if (mitigation && otherThefts.length)
    return {
      tone: 'stays',
      text: 'Stays · check succeeded · another Theft still halves gains',
    };
  if (mitigation)
    return { tone: 'stays', text: 'Stays · keeps 90% of this week’s gains' };
  if (findChange(changes, 'persistent_officer_check'))
    return { tone: 'stays', text: 'Stays · officer check failed' };
  return {
    tone: 'stays',
    text:
      eventType === 'rivalry'
        ? 'Stays · officer check pending'
        : 'Stays · Loyalty check pending',
  };
}

// The section header's forecast. Only an actual staged ending reads "Ends";
// a chosen card without its inputs, or an unmet exception, never does.
export function projectedResult({
  event,
  decision,
  endedBy,
  changes,
  requirements,
  costPending,
  otherThefts = [],
}: {
  event: Pick<Carried, 'eventId' | 'eventType'>;
  decision: Decision | null;
  endedBy: Event['endedBy'];
  changes: readonly PersistentChange[];
  requirements: readonly string[];
  costPending: boolean;
  // Other Theft events still taking half of this week's gains.
  otherThefts?: readonly string[];
}): Result {
  if (endedBy) return { tone: 'ends', text: `Ends · ${endedBy.label}` };
  const rules = requirements.map((key) => key.slice(event.eventId.length + 1));
  const result =
    stagedEnding(changes, costPending) ?? unmetDecision(decision, rules);
  if (result) return result;
  if (decision?.kind === 'mitigate')
    return checkResult(event.eventType, changes, otherThefts);
  return {
    tone: 'stays',
    text:
      event.eventType === 'theft'
        ? 'Stays · half of incoming gains lost'
        : 'Stays',
  };
}

// A card sends its decision only when it changes the decision kind; tapping
// the saved card again keeps every stored field. Ended at the table is local
// until a nonempty outcome can be saved.
export function decisionEdit(
  event: Pick<Event, 'eventId' | 'decision'> & {
    requirements?: readonly string[];
  },
  card: PersistentCard,
): WeeklyDraftEdit | null {
  const saved = event.decision?.kind ?? 'unattempted';
  if (card === 'end') return null;
  if (card === saved) {
    const isReviewRequired = event.requirements?.includes(
      draftReviewRequirement({ kind: 'persistent', eventId: event.eventId }),
    );
    if (!isReviewRequired) return null;
    return {
      kind: 'persistent_decision',
      decision: structuredClone(
        event.decision ?? { kind: 'unattempted', eventId: event.eventId },
      ),
    };
  }
  return {
    kind: 'persistent_decision',
    decision: { kind: card, eventId: event.eventId },
  };
}

export function endingEdit(
  event: Pick<Event, 'eventId' | 'decision'>,
  outcome: string,
  newId: () => string = () => crypto.randomUUID(),
): WeeklyDraftEdit {
  return {
    kind: 'persistent_decision',
    decision: {
      kind: 'end',
      eventId: event.eventId,
      acknowledgement: {
        acknowledgementId:
          event.decision?.kind === 'end'
            ? event.decision.acknowledgement.acknowledgementId
            : newId(),
        subjectId: event.eventId,
        outcome: outcome.trim(),
      },
    },
  };
}

// The persistent-ending Rules Exception an ending's reason is written to:
// the event's existing one when present, so its identity is kept.
export function endingExceptionEdit(
  event: Pick<Event, 'eventId' | 'exceptions'>,
  reason: string,
): WeeklyDraftEdit {
  const existing = event.exceptions.find(
    (entry) => entry.ruleId === 'persistent-ending',
  );
  return {
    kind: 'rules_exception',
    exception: {
      exceptionId:
        existing?.exceptionId ??
        `persistent:${event.eventId}:persistent-ending`,
      subjectId: event.eventId,
      ruleId: 'persistent-ending',
      reason: reason.trim(),
    },
  };
}

// Whether the current decision relies on this exception: the preview either
// asks for it or has accepted it. A kept exception the decision no longer
// needs stays listed so it can be removed deliberately.
export function exceptionInUse(
  event: Pick<Event, 'eventId' | 'requirements' | 'warnings'>,
  ruleId: string,
) {
  const key = `${event.eventId}:${ruleId}`;
  return (
    event.warnings.includes(key) ||
    event.requirements.includes(`${key}:exception`)
  );
}

// An ending that still needs its reason asks for both at once.
export function endingNeedsReason(event: Pick<Event, 'exceptions'>) {
  return !event.exceptions.some(
    (entry) => entry.ruleId === 'persistent-ending' && entry.reason.trim(),
  );
}
