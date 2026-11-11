// @vitest-environment node
import { expect, it } from 'vitest';
import {
  describeIncrementParent,
  expectIncrementParentFacts,
  LEVELS,
  scheduleValues,
  WAVE_D_REVIEWED_ON,
} from './class-abilities-596';

// #640, MVP launch subset (#615 wave D): Lore Master, admitted with its two
// increments.
const lore = describeIncrementParent({
  batch: 640,
  key: 'pf1/msQWK7TW7mufzf8l',
  name: 'Lore Master',
  books: ['PZO1110'],
  classes: ['pf1/6GjOjO6r3R06fLwE'],
  prdExact: true,
  reviewedOn: WAVE_D_REVIEWED_ON,
});

it('adds no Lore Master Note, requires PZO1131 for its action, and adds a daily use at 11th and 17th', () => {
  expectIncrementParentFacts({ ...lore, notes: 'none' });
  expect(lore.candidate.requiredNotices).toEqual(['PZO1110', 'PZO1131']);
  expect(scheduleValues(lore.candidate)).toEqual(
    LEVELS.map((level) => (level < 5 ? 0 : Math.floor((level + 1) / 6))),
  );
});
