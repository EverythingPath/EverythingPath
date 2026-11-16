'use client';
import { useState } from 'react';
import type { EventEditResult, EventEdits } from './event-family-inputs';
import { EventOutcomeInputs } from './event-outcome-inputs';
import { EventRaidInputs } from './event-raid-inputs';
import { EventRecurringInputs } from './event-recurring-inputs';
import { EventResourceInputs } from './event-resource-inputs';
import { EventTargetCards } from './event-target-cards';
import { EventTeamInputs } from './event-team-inputs';
import { EventWhatHappenedLine } from './event-what-happened';
import type { EventBlock, EventPanel, EventTargetChoice } from './types';

// The family-specific controls of one event position: its targets, checks
// and mitigation, then the outcome lines and the table's own account. Every
// input renders the panel's facts and hands the edit to the Event edits; the
// last refused edit's message stays visible until an edit is accepted.
export function EventFamilyPanel({
  block,
  panel,
  disabled,
  edits,
  openActivitySlot,
}: {
  block: EventBlock;
  panel: EventPanel;
  disabled: boolean;
  edits: EventEdits;
  // Opens Activity at a choice (or at its top for null), where Hidden
  // Agenda's recalculated choices and the operated towns are edited.
  openActivitySlot?: (slotId: string | null) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  function showRefusal(result: EventEditResult) {
    setError(result ?? null);
  }
  const id = block.eventId;
  function targetCards(
    kind: 'team' | 'settlement' | 'item' | 'cache',
    choice: EventTargetChoice,
    subject?: string,
  ) {
    const set = (ids: readonly string[]) =>
      showRefusal(edits.setTargets(id, kind, ids));
    return (
      <EventTargetCards
        choice={choice}
        subject={subject}
        disabled={disabled}
        onSelect={(value) => set([value])}
        onClear={() => set([])}
        onClearRetained={(value) =>
          set(
            [
              choice.selected,
              ...choice.retained.map((entry) => entry.value),
            ].filter((kept): kept is string => Boolean(kept) && kept !== value),
          )
        }
      />
    );
  }
  // Outcome, recurring and resource panels carry rules notes and may be
  // partial.
  const detail =
    panel.family === 'outcome' ||
    panel.family === 'recurring' ||
    panel.family === 'resource'
      ? panel
      : null;
  return (
    <div className="min-w-0 space-y-4">
      {panel.family === 'outcome' ? (
        <EventOutcomeInputs
          panel={panel}
          id={id}
          disabled={disabled}
          edits={edits}
          showRefusal={showRefusal}
          subject={block.label}
        />
      ) : panel.family === 'team' ? (
        <EventTeamInputs
          panel={panel}
          id={id}
          disabled={disabled}
          edits={edits}
          showRefusal={showRefusal}
          targetCards={targetCards}
        />
      ) : panel.family === 'resource' ? (
        <EventResourceInputs
          panel={panel}
          id={id}
          disabled={disabled}
          edits={edits}
          showRefusal={showRefusal}
          targetCards={targetCards}
          subject={block.label}
          openActivitySlot={openActivitySlot}
        />
      ) : panel.family === 'recurring' ? (
        <EventRecurringInputs
          panel={panel}
          id={id}
          disabled={disabled}
          edits={edits}
          showRefusal={showRefusal}
          targetCards={targetCards}
          subject={block.label}
        />
      ) : (
        <EventRaidInputs
          panel={panel}
          id={id}
          disabled={disabled}
          edits={edits}
          showRefusal={showRefusal}
          targetCards={targetCards}
          subject={block.label}
        />
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {detail?.partial && (
        <p className="text-muted-foreground min-w-0 text-xs [overflow-wrap:anywhere]">
          So far. More follows once the inputs above are in.
        </p>
      )}
      {panel.outcomes.length > 0 && (
        <ul aria-label={`${block.label} outcomes`} className="space-y-1">
          {panel.outcomes.map((line) => (
            <li
              key={line}
              className="flex min-w-0 gap-2 text-sm [overflow-wrap:anywhere]"
            >
              <span aria-hidden className="text-muted-foreground shrink-0">
                ›
              </span>
              <span className="min-w-0">{line}</span>
            </li>
          ))}
        </ul>
      )}
      {detail?.notes.map((note) => (
        <p
          key={note}
          className="text-muted-foreground min-w-0 text-sm [overflow-wrap:anywhere]"
        >
          {note}
        </p>
      ))}
      {panel.whatHappened && (
        <EventWhatHappenedLine
          facts={panel.whatHappened}
          disabled={disabled}
          // The line shows its own refusal at the field; only success clears
          // a message another input left here.
          onSave={(text) => {
            const result = edits.saveWhatHappened(id, text);
            if (!result) setError(null);
            return result;
          }}
          onClear={() => {
            edits.clearWhatHappened(id);
            setError(null);
          }}
        />
      )}
    </div>
  );
}
