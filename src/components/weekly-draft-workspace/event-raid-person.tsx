'use client';
import { RULE_ROLL_SPECS } from '~/lib/rules-roll-spec';
import { EventCheckRow } from './event-check-row';
import type { EventEditResult, EventEdits } from './event-family-inputs';
import { EventMitigationChoice } from './event-mitigation-choice';
import { EventNote } from './event-note';
import { OverseerSupportControl } from './overseer-support-control';
import { RollTotalField } from './roll-total-field';
import type { EventRaidPerson as EventRaidPersonFacts } from './types';

// One person hidden in the raided refuge: their own Attempt it / Let it
// happen, Security check and capture roll.
export function EventRaidPerson({
  person,
  id,
  disabled,
  edits,
  showRefusal,
}: {
  person: EventRaidPersonFacts;
  id: string;
  disabled: boolean;
  edits: EventEdits;
  showRefusal: (result: EventEditResult) => void;
}) {
  const target = {
    kind: 'character' as const,
    characterId: person.characterId,
  };
  const patch = (change: Parameters<EventEdits['setTargetCheck']>[2]) =>
    showRefusal(edits.setTargetCheck(id, target, change));
  const attempted = person.mitigation === 'attempted';
  const capture = person.capture;
  return (
    <section
      role="group"
      aria-label={person.name}
      className="min-w-0 space-y-3 rounded-md border p-3"
    >
      <h5 className="min-w-0 font-semibold [overflow-wrap:anywhere]">
        {person.name}
      </h5>
      <EventMitigationChoice
        subject={person.name}
        value={person.mitigation}
        explicit={person.explicit}
        attemptDescription={`Security DC ${person.check.dc} to halve the capture chance.`}
        letDescription="No check; capture is certain."
        disabled={disabled}
        onChange={(mitigation) => patch({ mitigation })}
      />
      {attempted ? (
        <EventCheckRow
          facts={person.check}
          recorded={person.checkRoll}
          disabled={disabled}
          onRoll={(check) => patch({ check })}
          // The shared toggle owns a selection recorded on this person too.
          support={
            <OverseerSupportControl
              eventId={id}
              check="security"
              subject={person.check.label}
              breakdown={person.check.breakdown}
            />
          }
        />
      ) : (
        <>
          {person.checkRoll && (
            <EventNote
              advisory={false}
              action={`Clear unused check roll for ${person.name}`}
              disabled={disabled}
              onAction={() => patch({ check: null })}
            >
              A Security check roll stays on record, unused.
            </EventNote>
          )}
        </>
      )}
      {(capture.applies || capture.recorded) && (
        <div className="min-w-0 space-y-1">
          <RollTotalField
            label={`Capture roll for ${person.name}`}
            spec={RULE_ROLL_SPECS.percentile}
            recorded={capture.recorded}
            required={capture.required}
            disabled={disabled}
            onRoll={(loss) => patch({ loss })}
          />
          {capture.applies ? (
            capture.chance !== null && (
              <p className="text-muted-foreground text-sm">
                Captured on {capture.chance} or less.
              </p>
            )
          ) : (
            <p className="text-muted-foreground text-sm">
              Not needed: this roll is kept on record, unused.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
