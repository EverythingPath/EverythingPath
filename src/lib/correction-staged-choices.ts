import type { UpkeepSnapshot } from './rules-upkeep';
import type { WeeklyDraft } from './weekly-draft-contract';
import { actionChoiceEvents } from './weekly-draft-facts';
import {
  draftReferenceIssues,
  type DraftReferenceIssue,
  type ReferenceKind,
} from './weekly-draft-references';

// Which choices of the open week refer to identities a militia source lacks,
// located by the choice a player repairs: an Activity slot by position, an
// Upkeep decision, an Event occurrence, a Persistent decision or a Table
// Adjustment. Carried context (carried events, queued effects, orders and
// operated settlements) is read-only here: a correction may not break it.

export type StagedChoicePhase =
  | 'upkeep'
  | 'activity'
  | 'event'
  | 'persistent'
  | 'summary';

export type ChoiceLocation =
  | { kind: 'upkeepTeam'; teamId: string }
  | { kind: 'nearestSettlement' }
  | {
      kind: 'activitySlot';
      slotId: string;
      /** 1-based position on the Activity board. */
      position: number;
      actionId: string;
    }
  | { kind: 'operatingSettlement' }
  | { kind: 'consumables' }
  | { kind: 'event'; eventId: string; eventType: string | null }
  | { kind: 'persistentDecision'; eventId: string; eventType: string | null }
  | { kind: 'tableAdjustment'; adjustmentId: string }
  | { kind: 'carriedEvent'; eventId: string; eventType: string | null }
  | { kind: 'queuedEffect'; effectId: string }
  | { kind: 'order'; orderId: string }
  | { kind: 'operatedSettlements' };

/** An identity a choice refers to that the source lacks. */
export type MissingReference = { kind: ReferenceKind; id: string };

export type StagedReference = {
  /** Stable identity of the choice, for keys and comparisons. */
  key: string;
  location: ChoiceLocation;
  /** The phase that repairs it; null for read-only carried context. */
  phase: StagedChoicePhase | null;
  missing: MissingReference[];
};

const phaseOf: Record<ChoiceLocation['kind'], StagedChoicePhase | null> = {
  upkeepTeam: 'upkeep',
  nearestSettlement: 'upkeep',
  activitySlot: 'activity',
  operatingSettlement: 'activity',
  consumables: 'activity',
  event: 'event',
  persistentDecision: 'persistent',
  tableAdjustment: 'summary',
  carriedEvent: null,
  queuedEffect: null,
  order: null,
  operatedSettlements: null,
};

/** The phase that repairs a choice; null for read-only carried context. */
export function choicePhase(location: ChoiceLocation): StagedChoicePhase | null {
  return phaseOf[location.kind];
}

function locationKey(location: ChoiceLocation) {
  switch (location.kind) {
    case 'upkeepTeam':
      return `upkeepTeam:${location.teamId}`;
    case 'activitySlot':
      return `activitySlot:${location.slotId}`;
    case 'event':
    case 'persistentDecision':
    case 'carriedEvent':
      return `${location.kind}:${location.eventId}`;
    case 'tableAdjustment':
      return `tableAdjustment:${location.adjustmentId}`;
    case 'queuedEffect':
      return `queuedEffect:${location.effectId}`;
    case 'order':
      return `order:${location.orderId}`;
    default:
      return location.kind;
  }
}

// Where each event is repaired: carried events are read-only, rolled
// occurrences belong to Event and events an Activity action produced to
// that slot.
function eventLocations(draft: WeeklyDraft, slots: readonly SlotOwner[]) {
  const events = new Map<string, ChoiceLocation>();
  for (const { eventId, eventType } of draft.context.carriedEvents)
    events.set(eventId, { kind: 'carriedEvent', eventId, eventType });
  for (const { eventId, eventType } of draft.event.occurrences)
    events.set(eventId, {
      kind: 'event',
      eventId,
      eventType: eventType ?? null,
    });
  for (const { choice, location } of slots)
    for (const event of actionChoiceEvents(choice))
      events.set(event.eventId, location);
  return events;
}

type SlotOwner = {
  choice: NonNullable<WeeklyDraft['activity']['slots'][number]['choice']>;
  location: ChoiceLocation;
};
type Owner = [prefix: string, location: ChoiceLocation];

// The draft's reference owners by the path prefix their references use (see
// `draftReferenceRequirements`), in matching order. Owners are matched by
// their full identity, so an identity containing ':' still locates.
function ownerPrefixes(draft: WeeklyDraft): Owner[] {
  const slots = draft.activity.slots.flatMap((slot, index): SlotOwner[] =>
    slot.choice
      ? [
          {
            choice: slot.choice,
            location: {
              kind: 'activitySlot',
              slotId: slot.slotId,
              position: index + 1,
              actionId: slot.choice.actionId,
            },
          },
        ]
      : [],
  );
  const events = eventLocations(draft, slots);
  const typeOf = (eventId: string) => {
    const event = events.get(eventId);
    return event && 'eventType' in event ? event.eventType : null;
  };
  return [
    ['activity:consumable:', { kind: 'consumables' }],
    ['context:operated-settlement:', { kind: 'operatedSettlements' }],
    ...draft.context.orders.map(
      ({ orderId }): Owner => [`order:${orderId}:`, { kind: 'order', orderId }],
    ),
    ...draft.context.queuedEffects.map(
      ({ effectId }): Owner => [
        `queue:${effectId}:`,
        { kind: 'queuedEffect', effectId },
      ],
    ),
    ...draft.tableAdjustments.map(
      ({ adjustmentId }): Owner => [
        `adjustment:${adjustmentId}:`,
        { kind: 'tableAdjustment', adjustmentId },
      ],
    ),
    ...draft.persistent.decisions.map(
      ({ eventId }): Owner => [
        `decision:${eventId}:`,
        { kind: 'persistentDecision', eventId, eventType: typeOf(eventId) },
      ],
    ),
    // An event's own references, then the persistent decision nested in it.
    ...['event', 'decision'].flatMap((owner) =>
      [...events].map(
        ([eventId, location]): Owner => [`${owner}:${eventId}:`, location],
      ),
    ),
    ...slots.map(
      ({ choice, location }): Owner => [`${choice.choiceId}:`, location],
    ),
  ];
}

// Locates a reference path at the choice that repairs it.
function referenceLocator(draft: WeeklyDraft) {
  const exact = new Map<string, ChoiceLocation>([
    ['upkeep:nearest-settlement', { kind: 'nearestSettlement' }],
    ['activity:operating-settlement', { kind: 'operatingSettlement' }],
    ...draft.upkeep.teamDecisions.map(
      ({ teamId }): Owner => [`team:${teamId}`, { kind: 'upkeepTeam', teamId }],
    ),
  ]);
  const prefixes = ownerPrefixes(draft);
  return (path: string): ChoiceLocation | null =>
    exact.get(path) ??
    prefixes.find(([prefix]) => path.startsWith(prefix))?.[1] ??
    null;
}

// Groups the issues by the choice that repairs them, in week order.
function groupByChoice(
  draft: WeeklyDraft,
  issues: readonly DraftReferenceIssue[],
): StagedReference[] {
  const locate = referenceLocator(draft);
  const grouped = new Map<string, StagedReference>();
  for (const issue of issues) {
    const location = locate(issue.path);
    if (!location) continue;
    const key = locationKey(location);
    const entry = grouped.get(key) ?? {
      key,
      location,
      phase: phaseOf[location.kind],
      missing: [],
    };
    if (
      !entry.missing.some(
        (item) => item.kind === issue.kind && item.id === issue.id,
      )
    )
      entry.missing.push({ kind: issue.kind, id: issue.id });
    grouped.set(key, entry);
  }
  // Week order: phase by phase, Activity slots by position.
  const rank = (reference: StagedReference) =>
    reference.phase === null
      ? phaseOrder.length
      : phaseOrder.indexOf(reference.phase);
  const position = ({ location }: StagedReference) =>
    location.kind === 'activitySlot' ? location.position : 0;
  return [...grouped.values()].sort(
    (a, b) => rank(a) - rank(b) || position(a) - position(b),
  );
}
const phaseOrder: StagedChoicePhase[] = [
  'upkeep',
  'activity',
  'event',
  'persistent',
  'summary',
];

/**
 * The open week's choices that refer to identities `source` lacks. The
 * source is passed as both sides of `draftReferenceIssues`, so an identity a
 * correction removed is missing even if an earlier source still had it.
 */
export function stagedReferences(
  draft: WeeklyDraft,
  source: UpkeepSnapshot,
): StagedReference[] {
  return groupByChoice(draft, draftReferenceIssues(draft, source, source));
}

const sameMissing = (left: MissingReference, right: MissingReference) =>
  left.kind === right.kind && left.id === right.id;

export type CorrectionImpact = {
  /** Staged choices the correction newly leaves without their subject. */
  added: StagedReference[];
  /** Staged choices already missing a subject before the correction. */
  existing: StagedReference[];
  /** Carried context the correction breaks: it cannot be saved. */
  carried: StagedReference[];
};

/**
 * What a correction from `current` to `candidate` does to the open week:
 * the choices it newly breaks, naming only the identities it removes, apart
 * from choices that were already broken.
 */
export function correctionImpact(
  draft: WeeklyDraft,
  current: UpkeepSnapshot,
  candidate: UpkeepSnapshot,
): CorrectionImpact {
  const before = stagedReferences(draft, current);
  const after = stagedReferences(draft, candidate);
  const added: StagedReference[] = [];
  const carried: StagedReference[] = [];
  for (const reference of after) {
    const previous = before.find((item) => item.key === reference.key);
    const missing = reference.missing.filter(
      (item) => !previous?.missing.some((old) => sameMissing(old, item)),
    );
    if (missing.length === 0) continue;
    (reference.phase ? added : carried).push({ ...reference, missing });
  }
  return {
    added,
    existing: before.filter((reference) => reference.phase !== null),
    carried,
  };
}
