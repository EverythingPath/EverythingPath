import type { ReactNode } from 'react';
import type { EventPanel, EventTargetChoice } from './types';
import type { useEventEdits } from './use-event-edits';

export type EventEdits = ReturnType<typeof useEventEdits>;
// Every edit answers with a message when the draft refuses it.
export type EventEditResult = string | null | undefined;

// What the family inputs share: their panel facts, the Event edits, and the
// panel's way to show a refused edit and draw target cards.
export type EventFamilyInputsProps<Family extends EventPanel['family']> = {
  panel: Extract<EventPanel, { family: Family }>;
  id: string;
  disabled: boolean;
  edits: EventEdits;
  showRefusal: (result: EventEditResult) => void;
  // `subject` names the cards by event block (see EventTargetCards).
  targetCards: (
    kind: 'team' | 'settlement' | 'item' | 'cache',
    choice: EventTargetChoice,
    subject?: string,
  ) => ReactNode;
};
