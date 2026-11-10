import { expect, test } from 'vitest';
import { projectTreasuryIncome } from './rules-treasury';
import type { WeeklyDraft } from './weekly-draft-contract';

test('[rules.economy.theft-ending] income returns to full only after all carried Theft occurrences end; nonpositive changes are untouched', () => {
  const events: WeeklyDraft['context']['carriedEvents'] = [
    {
      eventId: 'first',
      eventType: 'theft',
      startedWeek: 1,
      order: 0,
      targets: [],
    },
    {
      eventId: 'second',
      eventType: 'theft',
      startedWeek: 2,
      order: 1,
      targets: [],
    },
  ];
  expect(projectTreasuryIncome(55, events)).toEqual({
    grossCopper: 55,
    retainedCopper: 28,
    theftEventIds: ['first', 'second'],
  });
  expect(projectTreasuryIncome(55, events, ['first'])).toEqual({
    grossCopper: 55,
    retainedCopper: 28,
    theftEventIds: ['second'],
  });
  expect(projectTreasuryIncome(55, events, ['first', 'second'])).toEqual({
    grossCopper: 55,
    retainedCopper: 55,
    theftEventIds: [],
  });
  expect(projectTreasuryIncome(0, events).retainedCopper).toBe(0);
  expect(projectTreasuryIncome(-55, events).retainedCopper).toBe(-55);
});
