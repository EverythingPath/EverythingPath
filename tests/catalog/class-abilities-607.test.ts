// @vitest-environment node
import { expect, it } from 'vitest';
import {
  describeIncrementParent,
  expectIncrementParentFacts,
  LEVELS,
  scheduleValues,
} from './class-abilities-596';

// #607, MVP launch subset (#631 wave A): AC Bonus (MNK), admitted with its
// ten monk and unchained monk increments (attributionFrom). #607 S1
// (monk-ac-607, 2026-11-14) re-reviewed its description record: two reviewed
// change replacements compute the bonus on AC and CMD, always on, and the
// record's Note gives the loss conditions; the assessment is re-bound for
// content only, so it keeps wave A's review. rotation-1 gives both Modifiers
// the `unarmored` condition and rewrites the Note to say what the sheet now
// checks; the curation review of rotation-1 (2026-11-15) reviewed the record
// and both rows, and they carry its reviewer and date.
const NOTE =
  'He loses these bonuses when he is immobilized or helpless, when he wears any armor, when he carries a shield, or when he carries a medium or heavy load. The sheet removes them by itself while an armor or shield item is active, or while he is Helpless, Paralyzed, Unconscious, Petrified or Pinned. It does not track load: switch this row off while he carries a medium or heavy load, or is immobilized some other way.';
const FORMULA =
  'max(0, @ability.wis.mod) + floor(max(@classLevel.monk, @classLevel.monkUnchained) / 4)';
const { candidate, entry } = describeIncrementParent({
  batch: 607,
  key: 'pf1/4zVndIJ8NMWWzl1T',
  name: 'AC Bonus (MNK)',
  books: ['PZO1110', 'PZO1131'],
  classes: ['pf1/W8dxwZ1CZiwLKsqr', 'pf1/5mQIOIw4hDhlREPo'],
  prdExact: true,
  recordReview: {
    reviewedBy: 'Sol (AI review) for the owner',
    reviewedOn: '2026-11-15',
  },
});

it('computes the bonus on AC and CMD, lost when not unarmored, says when to switch it off, and adds +1 every four levels', () => {
  const paragraphs = expectIncrementParentFacts({
    batch: 607,
    candidate,
    entry,
    notes: [NOTE],
    modifiers: [
      {
        target: 'ac',
        bonusType: 'untyped',
        value: { formula: FORMULA },
        condition: { unarmored: true },
      },
      {
        target: 'cmd',
        bonusType: 'untyped',
        value: { formula: FORMULA },
        condition: { unarmored: true },
      },
    ],
  });
  // The Note's first sentence is the rulebook's (PRD monk.html:384).
  expect(paragraphs[1]).toContain(NOTE.split(' The sheet')[0]);
  expect(scheduleValues(candidate)).toEqual(
    LEVELS.map((level) => Math.floor(level / 4)),
  );
});
