// @vitest-environment node
import { expect, it } from 'vitest';
import {
  describeIncrementParent,
  expectIncrementParentFacts,
  LEVELS,
  scheduleValues,
} from './class-abilities-596';

// #632, MVP launch subset (#605 wave C): Revelation and Order, admitted with
// their five and three increments.
const revelation = describeIncrementParent({
  batch: 632,
  key: 'pf1/adu4NROFqgwv70sw',
  name: 'Revelation',
  books: ['PZO1115'],
  classes: ['pf1/5S0u8yFcP861wgd1'],
  prdExact: true,
});
const order = describeIncrementParent({
  batch: 632,
  key: 'pf1/c3MSLdplxdRZrSxL',
  name: 'Order',
  books: ['PZO1115'],
  classes: ['pf1/u1ed3H9xtYQXTP5v'],
  prdExact: true,
});

it('adds no Revelation Note, since Extra Revelation (#331) reaches it, and gives a revelation at 1st, 3rd and every four levels', () => {
  expectIncrementParentFacts({ ...revelation, notes: 'none' });
  expect(revelation.entry.sources).toEqual([]);
  expect(scheduleValues(revelation.candidate)).toEqual(
    LEVELS.map((level) => (level < 3 ? 1 : 2 + Math.floor((level - 3) / 4))),
  );
  // PCGen has no grant row: Oracle's Mystery counts the revelations.
  expect(revelation.candidate.comparison.literalRow).toMatch(
    /^Oracle's Mystery\t/,
  );
});

it('adds no Order Note and gives order abilities at 2nd, 8th and 15th', () => {
  expectIncrementParentFacts({ ...order, notes: 'none' });
  expect(order.entry.sources).toEqual([]);
  expect(scheduleValues(order.candidate)).toEqual(
    LEVELS.map((level) => [2, 8, 15].filter((step) => level >= step).length),
  );
});
