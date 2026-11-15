// @vitest-environment node
import { expect, it } from 'vitest';
import {
  describeIncrementParent,
  expectIncrementParentFacts,
  LEVELS,
  scheduleValues,
  WAVE_F1_REVIEWED_ON,
} from './class-abilities-596';

// #610, MVP launch subset (#631 wave F1): Bomb, admitted with its nine
// increments once its linked Point-Blank Shot and Weapon Focus are (Vital
// Strike was already admitted).
const bomb = describeIncrementParent({
  batch: 610,
  key: 'pf1/7gHiZBNHjwefbBLI',
  name: 'Bomb',
  books: ['PZO1115'],
  classes: ['pf1/JcaqlAawhf14q1lq'],
  prdExact: true,
  reviewedOn: WAVE_F1_REVIEWED_ON,
});

it('adds no Bomb Note, requires the feats’ book and PZO1131 for its action, and adds 1d6 at every odd level', () => {
  expectIncrementParentFacts({ ...bomb, notes: 'none' });
  expect(bomb.candidate.requiredNotices).toEqual([
    'PZO1110',
    'PZO1115',
    'PZO1131',
  ]);
  expect(bomb.closure.map((row) => row.name).sort()).toEqual([
    'Point-Blank Shot',
    'Vital Strike',
    'Weapon Focus',
  ]);
  expect(scheduleValues(bomb.candidate)).toEqual(
    LEVELS.map((level) => Math.ceil(level / 2)),
  );
});
