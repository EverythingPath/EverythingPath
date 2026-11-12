// @vitest-environment node
import { expect, it } from 'vitest';
import {
  describeIncrementParent,
  expectIncrementParentFacts,
  LEVELS,
  scheduleValues,
} from './class-abilities-596';

// #609, MVP launch subset (#605 wave C): Teamwork Feat and Ki Pool (UC),
// admitted with their five and three increments.
const teamwork = describeIncrementParent({
  batch: 609,
  key: 'pf1/717fyDCcfLtD345B',
  name: 'Teamwork Feat',
  books: ['PZO1115'],
  classes: ['pf1/Fv3FbmXptuDRiL5y'],
  prdExact: true,
});
const kiPool = describeIncrementParent({
  batch: 609,
  key: 'pf1/7BfYNNkYjjBevun8',
  name: 'Ki Pool (UC)',
  books: ['PZO1131'],
  classes: ['pf1/5mQIOIw4hDhlREPo'],
  prdExact: true,
});

it('adds no Teamwork Feat Note, leaves its bonusFeats change unmapped, and adds a feat every three levels', () => {
  expectIncrementParentFacts({
    ...teamwork,
    notes: 'none',
    unmappedTargets: ['bonusFeats'],
  });
  expect(teamwork.entry.sources).toEqual([]);
  expect(scheduleValues(teamwork.candidate)).toEqual(
    LEVELS.map((level) => Math.floor(level / 3)),
  );
});

it('adds no Ki Pool (UC) Note, requires PZO1110 for the haste it names, and adds ki strike steps at 3rd, 7th, 10th and 16th', () => {
  expectIncrementParentFacts({ ...kiPool, notes: 'none' });
  // The bonus attack stacks with haste's (Core Rulebook spell, p. 293).
  expect(kiPool.candidate.requiredNotices).toEqual(['PZO1110', 'PZO1131']);
  expect(kiPool.candidate.inheritedRuleNotices.map((row) => row.book)).toEqual([
    'PZO1110',
    'PZO1131',
  ]);
  expect(kiPool.candidate.mechanicsReview.descriptionText).toContain(
    'as well as those from haste and similar effects',
  );
  expect(scheduleValues(kiPool.candidate)).toEqual(
    LEVELS.map((level) =>
      level < 3 ? 0 : [3, 7, 10, 16].filter((step) => level >= step).length,
    ),
  );
});
