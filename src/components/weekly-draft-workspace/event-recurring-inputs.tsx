'use client';
import { useState } from 'react';
import { EventCheckRow } from './event-check-row';
import type { EventFamilyInputsProps } from './event-family-inputs';
import { EventMitigationChoice } from './event-mitigation-choice';
import { EventNote } from './event-note';
import { EventOfficerCheck } from './event-officer-check';
import { EventRetainedInputs } from './event-retained-inputs';
import { EventTeamPairCards } from './event-team-pair-cards';
import { OverseerSupportControl } from './overseer-support-control';
import { RollTotalField } from './roll-total-field';

// Rivalry, Turncoat, Theft, Double Agent and Low Morale: the rival teams or
// defecting team, Turncoat's training loss, Theft's Loyalty check and the
// officer checks of Rivalry Twice and Turncoat Twice. Each part renders
// only where its facts exist. `subject` is the block label, which names the
// controls for assistive technology.
export function EventRecurringInputs({
  panel,
  id,
  disabled,
  edits,
  showRefusal,
  targetCards,
  subject,
}: EventFamilyInputsProps<'recurring'> & { subject: string }) {
  // Rivalry's Attempt it reveals the officer check before anything is
  // stored; the choice itself is read from the stored check.
  const [attempting, setAttempting] = useState(false);
  const { mitigation, officer } = panel;
  const theft = panel.eventType === 'theft';
  const officerShown =
    officer !== null &&
    (mitigation === null || mitigation.value === 'attempted' || attempting);
  return (
    <>
      {panel.teams && (
        <EventTeamPairCards
          pair={panel.teams}
          subject={subject}
          disabled={disabled}
          onChange={(ids) => showRefusal(edits.setTargets(id, 'team', ids))}
        />
      )}
      {panel.team && targetCards('team', panel.team, subject)}
      {panel.lossRoll && (
        // The die beside what the rules add to it, like the check rows;
        // stacked on a phone.
        <div className="grid min-w-0 items-start gap-x-6 gap-y-1 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
          <RollTotalField
            label={panel.lossRoll.label}
            spec={panel.lossRoll.spec}
            recorded={panel.lossRoll.recorded}
            required={panel.lossRoll.required}
            disabled={disabled}
            onRoll={(roll) => showRefusal(edits.setLossRoll(id, roll))}
          />
          <p className="text-muted-foreground min-w-0 text-sm [overflow-wrap:anywhere] sm:pt-6">
            {panel.lossRoll.legend}
          </p>
        </div>
      )}
      {mitigation && (
        <EventMitigationChoice
          subject={subject}
          value={attempting ? 'attempted' : mitigation.value}
          explicit={mitigation.explicit || attempting}
          attemptDescription={mitigation.attemptDescription}
          letDescription={mitigation.letDescription}
          disabled={disabled}
          onChange={(value) => {
            if (theft) {
              showRefusal(edits.setMitigation(id, value));
              return;
            }
            // Rivalry: the officer check is the attempt. Letting it happen
            // clears a recorded check; attempting only shows the check.
            setAttempting(value === 'attempted');
            if (value === 'unattempted' && officer?.characterId)
              showRefusal(edits.clearRetained(id, 'officerCheck'));
          }}
        />
      )}
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
              subject={`${subject} ${panel.check.label}`}
              breakdown={panel.check.breakdown}
            />
          }
        />
      )}
      {panel.unusedCheckRoll && (
        <EventNote
          advisory={false}
          action="Clear unused check roll"
          actionLabel={`Clear unused check roll for ${subject}`}
          disabled={disabled}
          onAction={() => showRefusal(edits.setCheckRoll(id, null))}
        >
          A Loyalty check roll stays on record, unused.
        </EventNote>
      )}
      {officerShown && (
        <EventOfficerCheck
          facts={officer}
          subject={subject}
          disabled={disabled}
          // The check shows its own refusal; an accepted edit clears one
          // another input left on the panel.
          onPatch={(patch) => {
            const result = edits.patchOfficerCheck(id, patch);
            if (!result) showRefusal(result);
            return result;
          }}
          onClear={
            panel.eventType === 'turncoat'
              ? () => showRefusal(edits.clearRetained(id, 'officerCheck'))
              : undefined
          }
        />
      )}
      {panel.sameWeek && (
        <EventNote
          advisory={!panel.sameWeek.used}
          action="Clear"
          actionLabel={`Clear the persistent decision from ${subject}`}
          disabled={disabled}
          onAction={() =>
            showRefusal(edits.clearRetained(id, 'persistentDecision'))
          }
        >
          {panel.sameWeek.used
            ? `Persistent decision for this week: ${panel.sameWeek.value}. Persistent resolves it once this event is persistent.`
            : `Persistent decision recorded: ${panel.sameWeek.value}. This event is not persistent this week, so Persistent does not use it.`}
        </EventNote>
      )}
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
