import { persistentEventFixture } from './persistent-event-fixture';
import { occurrence } from './event-selection-fixture';
import { roll } from './upkeep-fixture';
import type { WeeklyDraft } from '../../src/lib/weekly-draft-contract';

type Event = WeeklyDraft['event']['occurrences'][number];

export const childEvent = (
  eventId: string,
  value: number,
  kind: 'roll_twice' | 'replacement',
  parentEventId: string,
) => occurrence(eventId, value, { kind, parentEventId });

/** A complete week whose only event source is one Guarantee Event choice. */
export function guaranteedWeek(candidates: Event[], selectedEventId: string) {
  const input = persistentEventFixture('low_morale');
  input.snapshot.training = 15;
  input.draft.activity.slots = [
    {
      slotId: 'one',
      choice: {
        choiceId: 'guarantee',
        actionId: 'guarantee_event',
        rolls: { notoriety: roll(6, 3) },
        candidates,
        selectedEventId,
        acknowledgements: [
          {
            acknowledgementId: 'receipt',
            subjectId: 'guarantee_event:guarantee',
            outcome: 'Chosen at the table.',
          },
        ],
      },
    },
  ];
  return { revision: input.draft, militiaSnapshot: input.snapshot };
}
