import { eventActionFixture } from './event-action-fixture';
import { roll } from './upkeep-fixture';
import type { WeeklyDraft } from '../../src/lib/weekly-draft-contract';

export function eventSelectionFixture() {
  const { draft, snapshot } = eventActionFixture();
  draft.activity.slots = [{ slotId: 'one', choice: null }];
  draft.event.chanceRoll = roll(100, 1);
  snapshot.roster.teams.push({
    ...snapshot.roster.teams[0]!,
    teamId: 'second-team',
    managerCharacterId: null,
  });
  snapshot.economy = {
    items: [],
    orders: [],
    markets: [],
    caches: [
      {
        cacheId: 'cache',
        cacheClass: 'minor',
        location: 'Bridge',
        secure: false,
        extradimensional: false,
        itemIds: [],
        status: 'hidden',
        returnActivityWeek: null,
      },
    ],
  };
  return { draft, snapshot };
}
export function occurrence(
  eventId: string,
  value: number,
  origin: WeeklyDraft['event']['occurrences'][number]['origin'] = {
    kind: 'rolled',
  },
): WeeklyDraft['event']['occurrences'][number] {
  return { eventId, origin, tableRoll: roll(100, value) };
}
export function pair(value: number) {
  return [
    occurrence('root', 50),
    occurrence('first', value, { kind: 'roll_twice', parentEventId: 'root' }),
    occurrence('second', value, { kind: 'roll_twice', parentEventId: 'root' }),
  ];
}
