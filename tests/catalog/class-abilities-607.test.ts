// @vitest-environment node
import { expect, it } from 'vitest';
import {
  describeIncrementParent,
  expectIncrementParentFacts,
  LEVELS,
  REVIEWER,
  scheduleValues,
} from './class-abilities-596';

// #607, MVP launch subset (#631 wave A): AC Bonus (MNK), admitted with its
// ten monk and unchained monk increments (attributionFrom). #607 S1
// (monk-ac-607, 2026-11-14) re-reviewed its description record: two reviewed
// change replacements compute the bonus on AC and CMD, always on, and the
// record's Note gives the loss conditions; the assessment is re-bound for
// content only, so it keeps wave A's review.
const NOTE =
  'He loses these bonuses when he is immobilized or helpless, when he wears any armor, when he carries a shield, or when he carries a medium or heavy load. The sheet does not check this: switch this row off while any of these applies.';
const FORMULA =
  'max(0, @ability.wis.mod) + floor(max(@classLevel.monk, @classLevel.monkUnchained) / 4)';
const { candidate, entry } = describeIncrementParent({
  batch: 607,
  key: 'pf1/4zVndIJ8NMWWzl1T',
  name: 'AC Bonus (MNK)',
  books: ['PZO1110', 'PZO1131'],
  classes: ['pf1/W8dxwZ1CZiwLKsqr', 'pf1/5mQIOIw4hDhlREPo'],
  prdExact: true,
  recordReview: { reviewedBy: REVIEWER, reviewedOn: '2026-11-14' },
});

it('computes the bonus on AC and CMD, says when to switch it off, and adds +1 every four levels', () => {
  const paragraphs = expectIncrementParentFacts({
    batch: 607,
    candidate,
    entry,
    notes: [NOTE],
    modifiers: [
      { target: 'ac', bonusType: 'untyped', value: { formula: FORMULA } },
      { target: 'cmd', bonusType: 'untyped', value: { formula: FORMULA } },
    ],
  });
  // The Note's first sentence is the rulebook's (PRD monk.html:384).
  expect(paragraphs[1]).toContain(NOTE.split(' The sheet')[0]);
  expect(scheduleValues(candidate)).toEqual(
    LEVELS.map((level) => Math.floor(level / 4)),
  );
});
