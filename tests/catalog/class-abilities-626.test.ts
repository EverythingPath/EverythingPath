// @vitest-environment node
import { expect, it } from 'vitest';
import {
  describeIncrementParent,
  expectIncrementParentFacts,
  LEVELS,
  scheduleValues,
  WAVE_D_REVIEWED_ON,
} from './class-abilities-596';

// #626, MVP launch subset (#615 wave D): Favored Terrain and Flurry of Blows
// (UC), admitted with their three and one increments.
const terrain = describeIncrementParent({
  batch: 626,
  key: 'pf1/U2YBSx1s8cT8iDq1',
  name: 'Favored Terrain',
  books: ['PZO1110'],
  classes: ['pf1/w3wjj6s3N69BsMc3'],
  prdExact: false,
  reviewedOn: WAVE_D_REVIEWED_ON,
});
const flurry = describeIncrementParent({
  batch: 626,
  key: 'pf1/TaBxJdJQp5SFDPyn',
  name: 'Flurry of Blows (UC)',
  books: ['PZO1131'],
  classes: ['pf1/5mQIOIw4hDhlREPo'],
  prdExact: true,
  reviewedOn: WAVE_D_REVIEWED_ON,
});

it('adds no Favored Terrain Note and adds a terrain at 3rd and every five levels', () => {
  expectIncrementParentFacts({ ...terrain, notes: 'none' });
  expect(scheduleValues(terrain.candidate)).toEqual(
    LEVELS.map((level) => (level < 3 ? 0 : 1 + Math.floor((level - 3) / 5))),
  );
});

it('requires the Core Rulebook for the haste attacks Flurry of Blows (UC) stacks with, and adds its bonus attack at 11th', () => {
  expectIncrementParentFacts({ ...flurry, notes: 'none' });
  expect(flurry.candidate.requiredNotices).toEqual(['PZO1110', 'PZO1131']);
  expect(flurry.candidate.mechanicsReview.descriptionText).toContain(
    'stacks with the bonus attacks from haste and other similar effects',
  );
  expect(flurry.candidate.inheritedRuleNotices.map((row) => row.book)).toEqual([
    'PZO1110',
    'PZO1131',
  ]);
  expect(scheduleValues(flurry.candidate)).toEqual(
    LEVELS.map((level) => (level < 11 ? 1 : 2)),
  );
});
