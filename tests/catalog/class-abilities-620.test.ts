// @vitest-environment node
import { expect, it } from 'vitest';
import {
  describeIncrementParent,
  expectIncrementParentFacts,
  scheduleValues,
} from './class-abilities-596';

// #620, MVP launch subset (#631 wave A): Slow Fall, admitted with its eight
// monk-slow-fall-N increments.
const { candidate, entry } = describeIncrementParent({
  batch: 620,
  key: 'pf1/M4bXVPXouXroIt90',
  name: 'Slow Fall',
  books: ['PZO1110'],
  classes: ['pf1/W8dxwZ1CZiwLKsqr'],
  prdExact: true,
});

it('adds no Note and slows a fall by 20 ft. at 4th up to any distance at 20th', () => {
  expectIncrementParentFacts({ batch: 620, candidate, entry, notes: 'none' });
  expect(scheduleValues(candidate)).toEqual([
    0,
    0,
    0,
    20,
    20,
    30,
    30,
    40,
    40,
    50,
    50,
    60,
    60,
    70,
    70,
    80,
    80,
    90,
    90,
    true,
  ]);
});
