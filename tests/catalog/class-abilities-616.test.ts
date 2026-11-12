// @vitest-environment node
import { expect, it } from 'vitest';
import {
  describeIncrementParent,
  expectIncrementParentFacts,
  LEVELS,
  scheduleValues,
} from './class-abilities-596';

// #616, MVP launch subset (#631 wave A): Hex, admitted with its ten
// witch-hex-N increments. Its record imports no sources; the assessment cites
// the Advanced Player's Guide.
const { candidate, entry } = describeIncrementParent({
  batch: 616,
  key: 'pf1/GBkIhC1Bpp2MAD4e',
  name: 'Hex',
  books: ['PZO1115'],
  classes: ['pf1/RC4D4WFT5kRKkdqp'],
  prdExact: true,
});

it('adds no Note, since Extra Hex (#331) reaches the body, and grants one hex at 1st and every even level', () => {
  expectIncrementParentFacts({ batch: 616, candidate, entry, notes: 'none' });
  expect(entry.sources).toEqual([]);
  expect(candidate.requiredNotices).toEqual(['PZO1115']);
  expect(scheduleValues(candidate)).toEqual(
    LEVELS.map((level) => 1 + Math.floor(level / 2)),
  );
});
