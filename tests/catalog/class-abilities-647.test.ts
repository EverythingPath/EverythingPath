// @vitest-environment node
import { expect, it } from 'vitest';
import {
  describeIncrementParent,
  expectIncrementParentFacts,
  LEVELS,
  scheduleValues,
  WAVE_D_REVIEWED_ON,
} from './class-abilities-596';

// #647, MVP launch subset (#615 wave D): Bonus Feat (CAV), admitted with its
// two increments.
const feats = describeIncrementParent({
  batch: 647,
  key: 'pf1/vfu0FW2XYF7cBUQp',
  name: 'Bonus Feat (CAV)',
  books: ['PZO1115'],
  classes: ['pf1/u1ed3H9xtYQXTP5v'],
  prdExact: true,
  reviewedOn: WAVE_D_REVIEWED_ON,
});

it('adds no Bonus Feat (CAV) Note, leaves its bonusFeats change unmapped, and gives a combat feat at 6th, 12th and 18th', () => {
  expectIncrementParentFacts({
    ...feats,
    notes: 'none',
    unmappedTargets: ['bonusFeats'],
  });
  expect(feats.entry.sources).toEqual([]);
  expect(scheduleValues(feats.candidate)).toEqual(
    LEVELS.map((level) => Math.floor(level / 6)),
  );
});
