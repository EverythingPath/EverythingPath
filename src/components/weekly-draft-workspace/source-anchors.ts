// DOM ids of phase items, so a link from another phase (a Persistent source
// ending, or a Required decision in Review & confirm) can bring one into view.
export function activitySlotAnchor(slotId: string) {
  return `activity-slot-${slotId}`;
}
export function eventOccurrenceAnchor(eventId: string) {
  return `event-occurrence-${eventId}`;
}
export function persistentEventAnchor(eventId: string) {
  return `persistent-event-${eventId}`;
}
/** Upkeep's numbered rules steps, in their on-screen order. */
export type UpkeepStep =
  | 'teams'
  | 'attrition'
  | 'notoriety'
  | 'shortage'
  | 'rank'
  | 'transfers';
export function upkeepStepAnchor(step: UpkeepStep) {
  return `upkeep-step-${step}`;
}
/**
 * A local form a Required decision's Go to form focuses: a Review & confirm
 * Table Adjustment or exception reason, or a Persistent table ending.
 */
export const localFormElementId = (id: string) => `review-form-${id}`;
/** The phase editor itself: the fallback when no item can be named. */
export const weekEditorAnchor = 'week-phase-editor';

/**
 * What takes focus for an anchor: a focusable anchor itself; a form wrapper
 * passes it to its first invalid field, else its first enabled control.
 */
export function focusTargetWithin(anchor: HTMLElement): HTMLElement {
  if (anchor.hasAttribute('tabindex')) return anchor;
  return (
    anchor.querySelector<HTMLElement>('[aria-invalid="true"]') ??
    anchor.querySelector<HTMLElement>(
      'input:not(:disabled), textarea:not(:disabled), select:not(:disabled), button:not(:disabled)',
    ) ??
    anchor
  );
}
