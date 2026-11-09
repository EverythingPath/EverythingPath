// @vitest-environment node
import { expect, it } from 'vitest';
import {
  describeIncrementParent,
  expectIncrementParentFacts,
  LEVELS,
  scheduleValues,
} from './class-abilities-596';

// #649, MVP launch subset (#605 wave C): Bloodline Feat (BLO) and Slayer's
// Advance, admitted with their four and one increments.
const feat = describeIncrementParent({
  batch: 649,
  key: 'pf1/xxD5AbgfJ5OuzVld',
  name: 'Bloodline Feat (BLO)',
  books: ['PZO1129'],
  classes: ['pf1/E27lMw9YNOAjS009'],
  prdExact: true,
});
const advance = describeIncrementParent({
  batch: 649,
  key: 'pf1/yotHT522pQoKDhID',
  name: "Slayer's Advance",
  books: ['PZO1129'],
  classes: ['pf1/cOY76lMUkupH534m'],
  prdExact: false,
});

it('adds no Bloodline Feat Note, leaves its bonusFeats change unmapped, and adds a feat at 6th and every 3 levels', () => {
  expectIncrementParentFacts({
    ...feat,
    notes: 'none',
    unmappedTargets: ['bonusFeats'],
  });
  expect(scheduleValues(feat.candidate)).toEqual(
    LEVELS.map((level) => Math.max(0, Math.floor(level / 3) - 1)),
  );
  // PCGen has no grant row: the Bloodline Tracker adds the feats.
  expect(feat.candidate.comparison.literalRow).toMatch(
    /^CATEGORY=Internal\|Bloodrager ~ Bloodline Tracker\.MOD\t/,
  );
});

it("adds no Slayer's Advance Note, requires PZO1131 for its action, and is used once a day at 13th and twice at 17th", () => {
  expectIncrementParentFacts({ ...advance, notes: 'none' });
  expect(advance.candidate.requiredNotices).toEqual(['PZO1129', 'PZO1131']);
  expect(scheduleValues(advance.candidate)).toEqual(
    LEVELS.map((level) => (level < 13 ? 0 : level < 17 ? 1 : 2)),
  );
  // The body's second sentence is PCGen's DESC word for word.
  expect(advance.candidate.comparison.literalRow).toContain(
    'He may use Stealth as part of this movement, but takes a -10 penalty to his check for doing so.',
  );
});
