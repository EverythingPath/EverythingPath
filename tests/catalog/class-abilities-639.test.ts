// @vitest-environment node
import { expect, it } from 'vitest';
import {
  describeIncrementParent,
  expectIncrementParentFacts,
  LEVELS,
  scheduleValues,
} from './class-abilities-596';

// #639, MVP launch subset (#631 wave A): Channel Energy, admitted with its
// nine cleric-channel-energy-N increments. Its actions' Unchained action
// costs require Pathfinder Unchained besides the Core Rulebook.
const { candidate, entry } = describeIncrementParent({
  batch: 639,
  key: 'pf1/kXXz1lO4i7CibHJ9',
  name: 'Channel Energy',
  books: ['PZO1110'],
  classes: ['pf1/SjFqQceVeVBzBwgn'],
  prdExact: false,
});

it('adds no Note, since other closures reach the body, requires PZO1131 and rolls ceil(level / 2) d6', () => {
  expectIncrementParentFacts({ batch: 639, candidate, entry, notes: 'none' });
  expect(candidate.requiredNotices).toEqual(['PZO1110', 'PZO1131']);
  expect(JSON.stringify(candidate.sourceFields.actions)).toContain(
    '"unchained":{"cost":2,"type":"action"}',
  );
  expect(scheduleValues(candidate)).toEqual(
    LEVELS.map((level) => Math.ceil(level / 2)),
  );
});
