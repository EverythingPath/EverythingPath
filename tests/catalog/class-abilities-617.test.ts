// @vitest-environment node
import { expect, it } from 'vitest';
import {
  describeIncrementParent,
  expectIncrementParentFacts,
  LEVELS,
  scheduleValues,
} from './class-abilities-596';

// #617, MVP launch subset (#617 wave B): Rage Powers, Magus Arcana and
// Versatile Performance, each admitted with its schedule increments.
const ragePowers = describeIncrementParent({
  batch: 617,
  key: 'pf1/HdzsFdoGauXFjU2S',
  name: 'Rage Powers',
  books: ['PZO1110'],
  classes: ['pf1/g3pq7xWWdUVYw6ai'],
  prdExact: false,
});
const arcana = describeIncrementParent({
  batch: 617,
  key: 'pf1/HJ2vLLDYkihPxFkD',
  name: 'Magus Arcana',
  books: ['PZO1117'],
  classes: ['pf1/xZLcyrEKYZoJPS2k'],
  prdExact: true,
});
const performance = describeIncrementParent({
  batch: 617,
  key: 'pf1/HAqAsb5H56C6cZm3',
  name: 'Versatile Performance',
  books: ['PZO1110'],
  classes: ['pf1/6GjOjO6r3R06fLwE'],
  prdExact: false,
});

it('requires the totem books Rage Powers names and gives a rage power at every even level', () => {
  expectIncrementParentFacts({ ...ragePowers, notes: 'none' });
  // The totem paragraph: APG totems, and the Ultimate Combat dragon totem.
  expect(ragePowers.candidate.requiredNotices).toEqual([
    'PZO1110',
    'PZO1115',
    'PZO1118',
  ]);
  expect(ragePowers.candidate.mechanicsReview.descriptionText).toContain(
    'dragon totem',
  );
  expect(scheduleValues(ragePowers.candidate)).toEqual(
    LEVELS.map((level) => Math.floor(level / 2)),
  );
});

it('adds no Magus Arcana Note and gives an arcana every three levels', () => {
  expectIncrementParentFacts({ ...arcana, notes: 'none' });
  expect(arcana.entry.sources).toEqual([]);
  expect(scheduleValues(arcana.candidate)).toEqual(
    LEVELS.map((level) => Math.floor(level / 3)),
  );
});

it('adds no Versatile Performance Note and gives a Perform type at 2nd and every four levels after', () => {
  expectIncrementParentFacts({ ...performance, notes: 'none' });
  expect(scheduleValues(performance.candidate)).toEqual(
    LEVELS.map((level) => (level < 2 ? 0 : 1 + Math.floor((level - 2) / 4))),
  );
});
