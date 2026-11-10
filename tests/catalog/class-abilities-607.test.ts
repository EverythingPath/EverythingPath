// @vitest-environment node
import { expect, it } from 'vitest';
import {
  describeIncrementParent,
  expectIncrementParentFacts,
  LEVELS,
  scheduleValues,
} from './class-abilities-596';

// #607, MVP launch subset (#631 wave A): AC Bonus (MNK), admitted with its
// ten monk and unchained monk increments (attributionFrom).
const { candidate, entry } = describeIncrementParent({
  batch: 607,
  key: 'pf1/4zVndIJ8NMWWzl1T',
  name: 'AC Bonus (MNK)',
  books: ['PZO1110', 'PZO1131'],
  classes: ['pf1/W8dxwZ1CZiwLKsqr', 'pf1/5mQIOIw4hDhlREPo'],
  prdExact: true,
});

it('adds no Note, leaves the AC and CMD changes unmapped and adds +1 every four levels', () => {
  expectIncrementParentFacts({
    batch: 607,
    candidate,
    entry,
    notes: 'none',
    unmappedTargets: ['ac', 'cmd'],
  });
  expect(scheduleValues(candidate)).toEqual(
    LEVELS.map((level) => Math.floor(level / 4)),
  );
});
