// @vitest-environment node
import { expect, it } from 'vitest';
import {
  describeIncrementParent,
  expectIncrementParentFacts,
  LEVELS,
  scheduleValues,
  WAVE_D_REVIEWED_ON,
} from './class-abilities-596';

// #604, MVP launch subset (#615 wave D): Style Strikes (UC), admitted with
// its four increments.
const strikes = describeIncrementParent({
  batch: 604,
  key: 'pf1/0eJ9MA8iVuOG8VJi',
  name: 'Style Strikes (UC)',
  books: ['PZO1131'],
  classes: ['pf1/5mQIOIw4hDhlREPo'],
  prdExact: false,
  reviewedOn: WAVE_D_REVIEWED_ON,
});

it('adds no Style Strikes Note and learns a strike at 5th and every 4 levels, two a round from 15th', () => {
  expectIncrementParentFacts({ ...strikes, notes: 'none' });
  expect(strikes.entry.sources).toEqual([]);
  expect(strikes.candidate.requiredNotices).toEqual(['PZO1131']);
  expect(scheduleValues(strikes.candidate)).toEqual(
    LEVELS.map(
      (level) => [5, 9, 13, 17].filter((step) => level >= step).length,
    ),
  );
  expect(
    Object.fromEntries(
      strikes.increments.map((row) => [row.externalKey, row.name]),
    ),
  ).toEqual({
    'everythingpath/unchained-monk-style-strike-9': 'Style Strike (UC)',
    'everythingpath/unchained-monk-style-strike-13': 'Style Strike (UC)',
    'everythingpath/unchained-monk-style-strike-15':
      'Style Strike (2/round) (UC)',
    'everythingpath/unchained-monk-style-strike-17': 'Style Strike (UC)',
  });
});
