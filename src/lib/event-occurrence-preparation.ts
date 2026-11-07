import type { EventPositionGroup } from './rules-event-selection';
import {
  actionChoiceEvents,
  type StagedActionChoice,
} from './weekly-draft-facts';
import type { WeeklyDraft, WeeklyDraftEdit } from './weekly-draft-contract';

type Event = WeeklyDraft['event']['occurrences'][number];
export type CandidateChoice = Extract<
  StagedActionChoice,
  { actionId: 'guarantee_event' | 'manipulate_events' }
>;
/** An Activity choice that owns an event candidate set, even before it holds any. */
export function isCandidateChoice(
  choice: StagedActionChoice | null | undefined,
): choice is CandidateChoice {
  return (
    choice?.actionId === 'guarantee_event' ||
    choice?.actionId === 'manipulate_events'
  );
}
type Slot = WeeklyDraft['activity']['slots'][number];

// Event preparation fills the occurrence positions the rules ask for with
// blank occurrences, through the existing tree and candidate edits. It only
// ever adds: recorded occurrences, their order and identities stay untouched,
// and surplus legacy positions are reported rather than trimmed.

/**
 * A stable identity for the `ordinal`th position of a group, scoped to the
 * open draft. A child extends its parent with `/`, never `:`, so no child
 * identity starts with its parent's `id:` requirement and check prefix.
 */
export function eventOccurrenceIdentity(
  draftId: string,
  group:
    | { kind: 'rolled' }
    | { kind: 'automatic'; sourceId: string }
    | { kind: 'candidates'; choiceId: string }
    | { kind: 'roll_twice' | 'replacement'; parentEventId: string },
  ordinal: number,
) {
  switch (group.kind) {
    case 'rolled':
      return `${draftId}:rolled:${ordinal}`;
    case 'automatic':
      return `${draftId}:automatic:${group.sourceId}:${ordinal}`;
    case 'candidates':
      return `${draftId}:candidate:${group.choiceId}:${ordinal}`;
    case 'roll_twice':
      return `${group.parentEventId}/twice/${ordinal}`;
    case 'replacement':
      return `${group.parentEventId}/replacement/${ordinal}`;
  }
}

export function eventPositionKey(group: EventPositionGroup) {
  switch (group.kind) {
    case 'rolled':
      return 'rolled';
    case 'automatic':
      return `automatic:${group.sourceId}`;
    case 'candidates':
      return `candidates:${group.choiceId}`;
    case 'roll_twice':
    case 'replacement':
      return `${group.kind}:${group.parentEventId}`;
  }
}

/** Each group once, in trace order; a later trace of the same group is the same requirement. */
export function uniquePositions(groups: readonly EventPositionGroup[]) {
  return [
    ...new Map(
      groups.map((group) => [eventPositionKey(group), group]),
    ).values(),
  ];
}

// Where an occurrence lives: the Event tree, or one Activity choice's candidates.
type TreeOwner = { slotId: string; choiceId: string } | null;
function ownerOf(draft: WeeklyDraft, eventId: string): TreeOwner | undefined {
  if (draft.event.occurrences.some((event) => event.eventId === eventId))
    return null;
  const slot = draft.activity.slots.find((entry) =>
    actionChoiceEvents(entry.choice).some((event) => event.eventId === eventId),
  );
  return slot?.choice
    ? { slotId: slot.slotId, choiceId: slot.choice.choiceId }
    : undefined;
}
function slotForChoice(draft: WeeklyDraft, choiceId: string) {
  return draft.activity.slots.find(
    (slot) => slot.choice?.choiceId === choiceId,
  );
}
function usedIdentities(draft: WeeklyDraft) {
  return new Set(
    [
      ...draft.context.carriedEvents,
      ...draft.event.occurrences,
      ...draft.activity.slots.flatMap((slot) =>
        actionChoiceEvents(slot.choice),
      ),
    ].map((event) => event.eventId),
  );
}
function unique(base: string, used: Set<string>) {
  let id = base;
  for (let suffix = 2; used.has(id); suffix++) id = `${base}~${suffix}`;
  used.add(id);
  return id;
}
function originFor(group: EventPositionGroup): Event['origin'] {
  switch (group.kind) {
    case 'rolled':
    case 'candidates':
      return { kind: 'rolled' };
    case 'automatic':
      return { kind: 'automatic', sourceId: group.sourceId };
    case 'roll_twice':
    case 'replacement':
      return { kind: group.kind, parentEventId: group.parentEventId };
  }
}
// A new child goes after its parent's last saved descendant, so parents keep
// preceding children and siblings stay in order.
function insert(tree: Event[], event: Event) {
  const parentId =
    'parentEventId' in event.origin ? event.origin.parentEventId : null;
  if (parentId === null) return [...tree, event];
  const family = new Set([parentId]);
  let last = tree.findIndex((entry) => entry.eventId === parentId);
  for (let index = last + 1; index < tree.length; index++) {
    // Safe cast: the loop bound `index < tree.length` keeps `index` in range.
    const entry = tree[index]!;
    if (
      'parentEventId' in entry.origin &&
      family.has(entry.origin.parentEventId)
    ) {
      family.add(entry.eventId);
      last = index;
    }
  }
  return [...tree.slice(0, last + 1), event, ...tree.slice(last + 1)];
}

export type EventTopologyPlan = {
  /** Fill-only edits adding every missing blank position; empty when none is missing. */
  edits: WeeklyDraftEdit[];
  /** Identities of the positions the edits add, in order. */
  added: string[];
  /** The draft's occurrence trees with the added positions in place. */
  trees: {
    event: Event[];
    candidates: { slotId: string; choiceId: string; events: Event[] }[];
  };
  /** Groups holding more recorded occurrences than the rules ask for. */
  surplus: EventPositionGroup[];
};

export function planEventTopology(
  draft: WeeklyDraft,
  positions: readonly EventPositionGroup[],
): EventTopologyPlan {
  const used = usedIdentities(draft);
  let event = structuredClone(draft.event.occurrences);
  const candidates = new Map<
    string,
    EventTopologyPlan['trees']['candidates'][number]
  >();
  for (const slot of draft.activity.slots)
    if (isCandidateChoice(slot.choice))
      candidates.set(slot.choice.choiceId, {
        slotId: slot.slotId,
        choiceId: slot.choice.choiceId,
        events: structuredClone(slot.choice.candidates ?? []),
      });
  const changed = new Set<string | null>();
  const added: string[] = [];
  const surplus: EventPositionGroup[] = [];
  for (const group of uniquePositions(positions)) {
    if (group.eventIds.length > group.count) surplus.push(group);
    // A repeated Roll Twice is rerolled in its own die, never replaced.
    if (
      group.eventIds.length >= group.count ||
      ('reroll' in group && group.reroll)
    )
      continue;
    const owner =
      group.kind === 'candidates'
        ? (() => {
            const slot = slotForChoice(draft, group.choiceId);
            return slot
              ? { slotId: slot.slotId, choiceId: group.choiceId }
              : undefined;
          })()
        : group.kind === 'rolled' || group.kind === 'automatic'
          ? null
          : ownerOf(draft, group.parentEventId);
    if (owner === undefined) continue;
    for (
      let ordinal = group.eventIds.length + 1;
      ordinal <= group.count;
      ordinal++
    ) {
      const blank: Event = {
        eventId: unique(
          eventOccurrenceIdentity(draft.draftId, group, ordinal),
          used,
        ),
        origin: originFor(group),
      };
      added.push(blank.eventId);
      if (owner === null) event = insert(event, blank);
      else {
        // Safe cast: a non-null owner names a slot's guarantee or manipulation
        // choice (only those carry candidates), and `candidates` holds every
        // such choice of the draft's slots.
        const tree = candidates.get(owner.choiceId)!;
        tree.events = insert(tree.events, blank);
      }
      changed.add(owner?.choiceId ?? null);
    }
  }
  const edits: WeeklyDraftEdit[] = [];
  if (changed.has(null)) edits.push({ kind: 'event_tree', occurrences: event });
  for (const slot of draft.activity.slots) {
    const choice = slot.choice;
    if (!isCandidateChoice(choice) || !changed.has(choice.choiceId)) continue;
    edits.push({
      kind: 'detail',
      slotId: slot.slotId,
      choiceId: choice.choiceId,
      choice: {
        ...choice,
        // Safe cast: `candidates` holds every candidate choice of these same
        // slots, and `isCandidateChoice` passed above.
        candidates: candidates.get(choice.choiceId)!.events,
      },
    });
  }
  return {
    edits,
    added,
    trees: { event, candidates: [...candidates.values()] },
    surplus,
  };
}

function isEmpty(event: Event) {
  return Object.keys(event).every(
    (key) => key === 'eventId' || key === 'origin',
  );
}
function descendants(tree: Event[], eventId: string) {
  const family = new Set([eventId]);
  for (const entry of tree)
    if (
      'parentEventId' in entry.origin &&
      family.has(entry.origin.parentEventId)
    )
      family.add(entry.eventId);
  return family;
}
function referenced(draft: WeeklyDraft, ids: Set<string>) {
  return (
    draft.acknowledgements.some(
      (entry) =>
        ids.has(entry.subjectId) ||
        ids.has(entry.subjectId.replace(/^event:/, '')),
    ) || draft.rulesExceptions.some((entry) => ids.has(entry.subjectId))
  );
}

/**
 * Whether an occurrence is a position the rules do not ask for: part of an
 * over-full group, or an automatic event whose source is not due.
 */
export function isSurplusEventOccurrence(
  draft: WeeklyDraft,
  positions: readonly EventPositionGroup[],
  eventId: string,
) {
  const groups = uniquePositions(positions);
  if (
    groups.some(
      (group) =>
        group.eventIds.length > group.count && group.eventIds.includes(eventId),
    )
  )
    return true;
  const event = draft.event.occurrences.find(
    (entry) => entry.eventId === eventId,
  );
  return (
    event?.origin.kind === 'automatic' &&
    !groups.some(
      (group) =>
        group.kind === 'automatic' &&
        event.origin.kind === 'automatic' &&
        group.sourceId === event.origin.sourceId,
    )
  );
}

/**
 * The existing tree or candidate edit that removes a now-empty surplus
 * occurrence, or null. Required positions, occurrences with recorded facts,
 * descendants or references elsewhere in the draft are never removed.
 */
export function removableEventOccurrence(
  draft: WeeklyDraft,
  positions: readonly EventPositionGroup[],
  eventId: string,
): WeeklyDraftEdit | null {
  if (!isSurplusEventOccurrence(draft, positions, eventId)) return null;
  const owner = ownerOf(draft, eventId);
  if (owner === undefined) return null;
  const slot: Slot | undefined = owner
    ? slotForChoice(draft, owner.choiceId)
    : undefined;
  const tree = owner
    ? actionChoiceEvents(slot?.choice ?? null)
    : draft.event.occurrences;
  const family = descendants(tree, eventId);
  if (
    tree.some((entry) => family.has(entry.eventId) && !isEmpty(entry)) ||
    referenced(draft, family)
  )
    return null;
  const remaining = tree.filter((entry) => !family.has(entry.eventId));
  if (!owner) return { kind: 'event_tree', occurrences: remaining };
  const choice = slot?.choice;
  // A surplus candidate is never the chosen one: choosing it keeps it.
  if (
    !isCandidateChoice(choice) ||
    (choice.selectedEventId !== undefined && family.has(choice.selectedEventId))
  )
    return null;
  return {
    kind: 'detail',
    slotId: owner.slotId,
    choiceId: owner.choiceId,
    choice: { ...choice, candidates: remaining },
  };
}
