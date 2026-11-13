import type { PersistentView } from './types';

// A Persistent table ending held by this device's Confirm guard belongs to
// the decision it was typed against. Its registration carries that decision
// as its `basis`; once the event no longer offers the decision (it is ended
// in Activity or Event, is no longer carried, or another player saved a
// different decision) the store drops the form and its kept input.

type Event = PersistentView['events'][number];

const prefix = 'ending:';

/** The guard identity of one carried event's ending form. */
export const endingFormId = (eventId: string) => `${prefix}${eventId}`;

/** The saved decision an ending form was typed against. */
export const endingFormBasis = (decision: Event['decision']) =>
  JSON.stringify(decision ?? null);

/**
 * Whether a held local form is an ending whose decision no longer applies
 * in this Persistent view. Forms of any other kind are never stale here.
 */
export function isStaleEndingForm(
  id: string,
  basis: string | undefined,
  view: PersistentView,
) {
  if (!id.startsWith(prefix)) return false;
  const event = view.events.find(
    (entry) => entry.eventId === id.slice(prefix.length),
  );
  return event?.endedBy !== null || basis !== endingFormBasis(event.decision);
}
