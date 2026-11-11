// @vitest-environment node
import { expect, it } from 'vitest';
import {
  describeIncrementParent,
  expectIncrementParentFacts,
  LEVELS,
  scheduleValues,
} from './class-abilities-596';

// #624, MVP launch subset (#617 wave B): Damage Reduction (Barbarian,
// Unchained Barbarian and Bloodrager) and Bloodline Spells (Bloodrager), each
// admitted with its schedule increments.
const reduction = describeIncrementParent({
  batch: 624,
  key: 'pf1/RENIeTVjWB7Mq6Mw',
  name: 'Damage Reduction',
  books: ['PZO1110', 'PZO1129', 'PZO1131'],
  classes: [
    'pf1/g3pq7xWWdUVYw6ai',
    'pf1/W3EjUgYLJ1D9qDKw',
    'pf1/E27lMw9YNOAjS009',
  ],
  prdExact: false,
});
const spells = describeIncrementParent({
  batch: 624,
  key: 'pf1/RJ66UHdnwJ7VuWFo',
  name: 'Bloodline Spells (BLO)',
  books: ['PZO1129'],
  classes: ['pf1/E27lMw9YNOAjS009'],
  prdExact: false,
});

it('adds no Damage Reduction Note and raises DR 1/— at 7th by 1 every three levels, for all three classes', () => {
  expectIncrementParentFacts({ ...reduction, notes: 'none' });
  expect(scheduleValues(reduction.candidate)).toEqual(
    LEVELS.map((level) => (level < 7 ? 0 : 1 + Math.floor((level - 7) / 3))),
  );
  expect(reduction.increments).toHaveLength(12);
});

it('adds no Bloodline Spells Note and gives a bloodline spell at 7th, 10th, 13th and 16th', () => {
  expectIncrementParentFacts({ ...spells, notes: 'none' });
  expect(scheduleValues(spells.candidate)).toEqual(
    LEVELS.map((level) =>
      level < 7 ? 0 : Math.min(1 + Math.floor((level - 7) / 3), 4),
    ),
  );
});
