'use client';
import { useState } from 'react';
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import { EventSabotagePanel } from './event-sabotage-panel';
import type { EventSabotageFacts } from './event-sabotage-facts';
import { OverseerSupportControl } from './overseer-support-control';
import { sabotageEdits } from './sabotage-edits';
import type { EventView } from './types';
import type { useEventEdits } from './use-event-edits';

// Sabotage on one exact event. The quiet button only opens the reaction
// here; nothing is recorded (and nothing asks for input) until a first
// choice is made. Every input then goes through the occurrence edit; the
// last refused edit's message stays until one is accepted.
export function EventSabotage({
  facts,
  eventLabel,
  view,
  edit,
  edits,
  disabled,
}: {
  facts: EventSabotageFacts;
  eventLabel: string;
  view: EventView;
  edit: (edit: WeeklyDraftEdit) => unknown;
  edits: ReturnType<typeof useEventEdits>;
  disabled: boolean;
}) {
  const [opened, setOpened] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const actions = sabotageEdits({
    view,
    edit,
    saveOccurrence: edits.saveOccurrence,
    facts,
  });
  return (
    <EventSabotagePanel
      facts={facts}
      eventLabel={eventLabel}
      open={opened || facts.recorded}
      disabled={disabled}
      error={error}
      onStart={() => setOpened(true)}
      onCancel={() => {
        if (!facts.recorded) {
          setOpened(false);
          setError(null);
          return;
        }
        void actions.cancel().then((message) => {
          setError(message);
          if (!message) setOpened(false);
        });
      }}
      onTeam={(teamId) => setError(actions.patch({ teamId }))}
      onClearTeam={() => setError(actions.patch({ teamId: null }))}
      onCheck={(check) => setError(actions.patch({ check }))}
      onCheckRoll={(checkRoll) => setError(actions.patch({ checkRoll }))}
      onNotorietyRoll={(notorietyRoll) =>
        setError(actions.patch({ notorietyRoll }))
      }
      onSaveNote={(text) => {
        const message = actions.saveNote(text);
        if (!message) setError(null);
        return message;
      }}
      onClearNote={() => setError(actions.clearNote())}
      support={
        facts.checkRow && facts.check ? (
          <OverseerSupportControl
            eventId={facts.eventId}
            check={facts.check}
            subject={facts.checkRow.label}
            breakdown={facts.checkRow.breakdown}
          />
        ) : null
      }
    />
  );
}
