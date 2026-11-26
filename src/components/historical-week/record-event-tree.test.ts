import { describe, expect, test } from 'vitest';
import type { EventPositionGroup } from '~/lib/rules-event-selection';
import { createWeeklyDraft } from '~/lib/weekly-draft';
import { weeklyDraftDataSchema } from '~/lib/weekly-draft-contract';
import type { RawRoll } from '~/lib/weekly-draft-facts';
import { eventOccurrenceLabels } from '../weekly-draft-workspace/event-tree-facts';
import { recordedEventTree } from './record-event-tree';

const roll: RawRoll = {
  sides: 100,
  diceTotal: 50,
  diceCount: 1,
  provenance: { kind: 'table' },
  modifiers: [],
};

// Automatic, rolled (with nested Roll Twice children) and candidate trees in
// one recorded week, so both numbering orders can be compared.
function week() {
  const draft = weeklyDraftDataSchema.parse(
    createWeeklyDraft({
      draftId: 'draft',
      week: 7,
      slotIds: ['slot-1', 'slot-2'],
      context: {
        firstMilitiaWeek: false,
        startDay: 42,
        uneventfulCarry: false,
        carriedEvents: [],
        queuedEffects: [
          {
            effectId: 'queued',
            sourceId: 'omen',
            startsWeek: 7,
            endsWeek: 7,
            effect: { kind: 'automatic_events', count: 1 },
          },
        ],
        orders: [],
        lastBuyoffWeek: null,
      },
    }),
  );
  draft.event.occurrences = [
    { eventId: 'auto', origin: { kind: 'automatic', sourceId: 'omen' } },
    { eventId: 'rolled', origin: { kind: 'rolled' }, tableRoll: roll },
    {
      eventId: 'twice-a',
      origin: { kind: 'roll_twice', parentEventId: 'rolled' },
    },
    {
      eventId: 'twice-b',
      origin: { kind: 'roll_twice', parentEventId: 'rolled' },
    },
    {
      eventId: 'nested',
      origin: { kind: 'replacement', parentEventId: 'twice-b' },
    },
  ];
  draft.activity.slots[1]!.choice = {
    choiceId: 'guarantee',
    actionId: 'guarantee_event',
    candidates: [
      { eventId: 'first', origin: { kind: 'rolled' } },
      { eventId: 'second', origin: { kind: 'rolled' } },
      {
        eventId: 'second-replacement',
        origin: { kind: 'replacement', parentEventId: 'second' },
      },
    ],
    selectedEventId: 'second',
  };
  return draft;
}

const automatic: EventPositionGroup = {
  kind: 'automatic',
  sourceId: 'omen',
  count: 1,
  eventIds: ['auto'],
};
function labelsByRecord(guaranteed: string[]) {
  const draft = week();
  return new Map(
    recordedEventTree(draft, new Set(guaranteed)).map((entry) => [
      entry.occurrence.eventId,
      entry.label,
    ]),
  );
}

describe('[rules.HIST-05.event-labels] frozen event labels', () => {
  test('a rolled week labels its recorded tree exactly as the Event phase does', () => {
    const live = eventOccurrenceLabels(week(), [
      automatic,
      { kind: 'rolled', count: 1, eventIds: ['rolled'] },
    ]);
    const recorded = labelsByRecord([]);
    expect(recorded).toEqual(live);
    expect(Object.fromEntries(recorded)).toEqual({
      auto: 'Event 1',
      rolled: 'Event 2',
      'twice-a': 'Event 2.1',
      'twice-b': 'Event 2.2',
      nested: 'Event 2.2.1',
      first: 'Event 3A',
      second: 'Event 3B',
      'second-replacement': 'Event 3B.1',
    });
  });

  test('a guaranteed week numbers its candidates before the unused rolled tree, as the Event phase does', () => {
    const live = eventOccurrenceLabels(week(), [
      automatic,
      {
        kind: 'candidates',
        choiceId: 'guarantee',
        count: 2,
        eventIds: ['first', 'second'],
      },
    ]);
    const recorded = labelsByRecord(['guarantee']);
    expect(recorded).toEqual(live);
    expect(recorded.get('first')).toBe('Event 2A');
    expect(recorded.get('second-replacement')).toBe('Event 2B.1');
    expect(recorded.get('nested')).toBe('Event 3.2.1');
  });

  test('resolution order lists each root before its nested events, candidates last', () => {
    const order = recordedEventTree(week(), new Set()).map(
      (entry) => entry.occurrence.eventId,
    );
    expect(order).toEqual([
      'auto',
      'rolled',
      'twice-a',
      'twice-b',
      'nested',
      'first',
      'second',
      'second-replacement',
    ]);
    expect(
      recordedEventTree(week(), new Set()).find(
        (entry) => entry.occurrence.eventId === 'first',
      )?.owner?.choiceId,
    ).toBe('guarantee');
  });
});
