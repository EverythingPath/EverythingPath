'use client';
import { EventCheckRow } from './event-check-row';
import type { EventFamilyInputsProps } from './event-family-inputs';
import { EventNote } from './event-note';
import { OverseerSupportControl } from './overseer-support-control';

// Missing in Action, Sickness and Turn Around: a team, and Sickness Twice's
// mandatory Loyalty save. Team events never offer Attempt it / Let it happen.
export function EventTeamInputs({
  panel,
  id,
  disabled,
  edits,
  showRefusal,
  targetCards,
}: EventFamilyInputsProps<'team'>) {
  return (
    <>
      {panel.team && targetCards('team', panel.team)}
      {panel.check && (
        <EventCheckRow
          facts={panel.check}
          recorded={panel.checkRoll}
          disabled={disabled}
          onRoll={(roll) => showRefusal(edits.setCheckRoll(id, roll))}
          support={
            <OverseerSupportControl
              eventId={id}
              check="loyalty"
              subject={panel.check.label}
              breakdown={panel.check.breakdown}
            />
          }
        />
      )}
      {panel.retainedCheck && (
        <EventNote
          action="Clear unused check roll"
          disabled={disabled}
          onAction={() => showRefusal(edits.setCheckRoll(id, null))}
        >
          A check roll is recorded here, but this event does not use it.
        </EventNote>
      )}
    </>
  );
}
