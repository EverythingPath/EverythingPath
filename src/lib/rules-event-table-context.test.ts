import { expect, test } from 'vitest';
import { projectActivity } from './rules-activity';
import {
  eventSelectionFixture,
  occurrence,
} from '../../tests/rules/event-selection-fixture';
import type { RawRoll } from './weekly-draft-facts';
import {
  projectEventSelection,
  eventTypeForTableRoll,
} from './rules-event-selection';
import { roll } from '../../tests/rules/upkeep-fixture';

test('candidate type uses the current raw roll and exact source modifier rules', () => {
  const raw = roll(100, 58);
  raw.modifiers = [
    { sourceId: 'custom', value: -10, reason: 'Old entry' },
    { sourceId: 'custom', value: 4, reason: 'Replacement entry' },
    { sourceId: 'settlement', value: 50, reason: 'Chance only' },
    { sourceId: 'reputation', value: -50, reason: 'Chance only' },
  ];
  expect(eventTypeForTableRoll(raw)).toBe('cache_discovered');
  expect(raw).toMatchObject({ diceTotal: 58, diceCount: 1 });
  expect(raw.modifiers).toHaveLength(4);
});

test('missing and incomplete percentile input has no guessed type', () => {
  for (const raw of [undefined, null, roll(20, 20), roll(100, 25, 25)]) {
    expect(eventTypeForTableRoll(raw)).toBeNull();
  }
});

test.each([
  [0, 'week_of_serenity'],
  [200, 'week_of_pain'],
  [50, 'roll_twice'],
  [60, 'turncoat'],
] as const)(
  'table value %s preserves engine type, range warning and stored-type contradiction',
  (value, expected) => {
    const { draft, snapshot } = eventSelectionFixture();
    const raw = roll(100, value);
    const total: RawRoll = {
      diceTotal: value,
      diceCount: 1,
      sides: 100,
      provenance: raw.provenance,
      modifiers: [],
    };
    for (const tableRoll of [raw, total]) {
      draft.event.occurrences = [
        { ...occurrence('candidate', value), eventType: 'theft', tableRoll },
      ];
      const selected = projectEventSelection(
        draft,
        projectActivity(draft, snapshot),
      );
      expect(eventTypeForTableRoll(tableRoll)).toBe(expected);
      expect(selected.tree).toEqual([
        { ...draft.event.occurrences[0], eventType: expected },
      ]);
      expect(selected.warnings).toContain('candidate:calculated-event');
      expect(selected.warnings.includes('candidate:table:roll-range')).toBe(
        value === 0 || value === 200,
      );
      expect(selected.requirements).toEqual(
        value === 50 ? ['candidate:roll_twice:2'] : [],
      );
      expect(selected.ready).toBe(value !== 50);
      expect(draft.event.occurrences[0]?.eventType).toBe('theft');
    }
  },
);

test('engine uses current raw modifiers rather than recorded type and retains missing-roll readiness', () => {
  const { draft, snapshot } = eventSelectionFixture();
  const tableRoll = roll(100, 58);
  tableRoll.modifiers = [
    { sourceId: 'adjustment', value: 10, reason: 'Old' },
    { sourceId: 'adjustment', value: 4, reason: 'Current' },
    { sourceId: 'settlement', value: 50, reason: 'Chance' },
  ];
  draft.event.occurrences = [
    { ...occurrence('candidate', 58), eventType: 'theft', tableRoll },
  ];
  const project = () =>
    projectEventSelection(draft, projectActivity(draft, snapshot));
  expect(project().tree[0]?.eventType).toBe('cache_discovered');
  tableRoll.modifiers[1]!.value = -10;
  expect(project().tree[0]?.eventType).toBe('all_is_calm');
  delete draft.event.occurrences[0]!.tableRoll;
  expect(project()).toMatchObject({
    ready: false,
    tree: [],
    requirements: ['candidate:table:1d100'],
  });
});
