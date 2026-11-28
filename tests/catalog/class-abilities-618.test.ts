// @vitest-environment node
import { expect, it } from 'vitest';
import {
  describeIncrementParent,
  expectIncrementParentFacts,
  LEVELS,
  scheduleValues,
  WAVE_F1_REVIEWED_ON,
} from './class-abilities-596';

// #618, MVP launch subset (#631 wave F1): Flurry of Blows, admitted with its
// two increments once its linked Two-Weapon Fighting feats are.
const flurry = describeIncrementParent({
  batch: 618,
  key: 'pf1/JKJoHy5NveXGaZqv',
  name: 'Flurry of Blows',
  books: ['PZO1110'],
  classes: ['pf1/W8dxwZ1CZiwLKsqr'],
  prdExact: false,
  reviewedOn: WAVE_F1_REVIEWED_ON,
});

it('adds no Flurry of Blows Note and gains an attack at 8th and 15th', () => {
  expectIncrementParentFacts({ ...flurry, notes: 'none' });
  expect(flurry.closure.map((row) => row.name).sort()).toEqual([
    'Greater Two-Weapon Fighting',
    'Improved Two-Weapon Fighting',
    'Two-Weapon Fighting',
  ]);
  expect(scheduleValues(flurry.candidate)).toEqual(
    LEVELS.map((level) => 1 + Number(level >= 8) + Number(level >= 15)),
  );
});
