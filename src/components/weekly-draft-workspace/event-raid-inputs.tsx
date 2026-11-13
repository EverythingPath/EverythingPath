'use client';
import type { EventFamilyInputsProps } from './event-family-inputs';
import { EventNote } from './event-note';
import { EventRaidPerson } from './event-raid-person';
import { EventRetainedInputs } from './event-retained-inputs';

// Raid: the raided settlement, then each person hidden there with their own
// Attempt it / Let it happen, Security check and capture roll. `subject` is
// the block label, which names the controls for assistive technology.
export function EventRaidInputs({
  panel,
  id,
  disabled,
  edits,
  showRefusal,
  targetCards,
  subject,
}: EventFamilyInputsProps<'raid'> & { subject: string }) {
  return (
    <>
      {targetCards('settlement', panel.settlement)}
      {panel.noPeople !== null && (
        <p className="text-muted-foreground min-w-0 text-sm [overflow-wrap:anywhere]">
          {panel.noPeople}
        </p>
      )}
      {panel.people.map((person) => (
        <EventRaidPerson
          key={person.characterId}
          person={person}
          id={id}
          disabled={disabled}
          edits={edits}
          showRefusal={showRefusal}
        />
      ))}
      {panel.retainedPeople.map((entry) => (
        <EventNote
          key={entry.index}
          action="Remove"
          actionLabel={`Remove recorded check for ${entry.label}`}
          disabled={disabled}
          onAction={() => showRefusal(edits.removeTargetCheck(id, entry.index))}
        >
          {entry.label}: {entry.reason}
        </EventNote>
      ))}
      <EventRetainedInputs
        retained={panel.retained}
        subject={subject}
        disabled={disabled}
        onClear={(field) =>
          showRefusal(edits.clearRetained(id, field, panel.keep))
        }
      />
    </>
  );
}
