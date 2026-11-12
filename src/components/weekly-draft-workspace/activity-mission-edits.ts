import { z } from 'zod';
import { commonFieldEdits, type ChangeField } from './activity-action-edits';
import type { MissionChoice } from './activity-mission-actions';

// Named field edits for the information, mission and event-influence detail
// editors. Each builds the next value of one choice field and hands it to
// `change`, which validates the complete choice and stages it as one detail
// edit. `undefined` omits a field (the existing clear); nothing else on the
// choice is touched, so a value the current mode does not use stays until it
// is cleared or replaced. Event candidates are never written here: Event
// prepares, rolls and chooses them through its own occurrence edits.

type TextField = 'subject' | 'instruction' | 'location';
type BooleanField = 'occupied';

export function missionFieldEdits(
  choice: MissionChoice,
  change: ChangeField,
  newId: () => string = () => crypto.randomUUID(),
) {
  const acknowledgements = choice.acknowledgements ?? [];
  return {
    ...commonFieldEdits(choice, change),
    // Saved text, trimmed; blank text clears the field.
    setText(field: TextField, text: string) {
      return change(field, text.trim() || undefined);
    },
    // A yes/no answer, or null to clear it.
    setBoolean(field: BooleanField, value: boolean | null) {
      return change(field, value ?? undefined);
    },
    /**
     * Records what happened for `subjectId`, replacing the recorded note in
     * place. A new note gets its identity once, in this edit.
     */
    saveAcknowledgement(subjectId: string, outcome: string) {
      const existing = acknowledgements.find(
        (entry) => entry.subjectId === subjectId,
      );
      const note = {
        acknowledgementId: existing?.acknowledgementId ?? newId(),
        subjectId,
        outcome: outcome.trim(),
      };
      return change(
        'acknowledgements',
        existing
          ? acknowledgements.map((entry) => (entry === existing ? note : entry))
          : [...acknowledgements, note],
      );
    },
    // Removes the note for `subjectId`; other notes stay.
    clearAcknowledgement(subjectId: string) {
      const kept = acknowledgements.filter(
        (entry) => entry.subjectId !== subjectId,
      );
      return change('acknowledgements', kept.length ? kept : undefined);
    },
  };
}
export type MissionFieldEdits = ReturnType<typeof missionFieldEdits>;

// A saved note: blank is required-empty, never saved as an empty note.
export const missionNoteFormSchema = z.object({
  text: z.string().trim().min(1, 'Describe what happened.'),
});
