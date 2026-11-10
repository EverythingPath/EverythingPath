// @vitest-environment node
import { expect, it } from 'vitest';
import {
  describeIncrementParent,
  describeLaunchFeature,
  expectIncrementParentFacts,
  LEVELS,
  scheduleValues,
  WAVE_A_REVIEWER,
  WAVE_D_REVIEWED_ON,
} from './class-abilities-596';

// #615, MVP launch subset (#615 wave D): Sorcerer Bloodline, admitted with
// its four increments, and Mercy, held with its five.
const bloodline = describeIncrementParent({
  batch: 615,
  key: 'pf1/F5mCXQR9VZfKfpTH',
  name: 'Sorcerer Bloodline',
  books: ['PZO1110'],
  classes: ['pf1/AoWSbnuTSGIxmv61'],
  prdExact: true,
  reviewedOn: WAVE_D_REVIEWED_ON,
});
const mercy = describeLaunchFeature({
  batch: 615,
  key: 'pf1/Er8h3fZ2edJEviTv',
  name: 'Mercy',
  disposition: 'held',
  reviewer: WAVE_A_REVIEWER,
  reviewedOn: WAVE_D_REVIEWED_ON,
  books: ['PZO1110', 'PZO9475'],
  classes: ['pf1/ohptcds1d5oG6Bjh'],
});

it('adds no Sorcerer Bloodline Note and gives bloodline powers at 1st, 3rd, 9th, 15th and 20th', () => {
  expectIncrementParentFacts({ ...bloodline, notes: 'none' });
  expect(scheduleValues(bloodline.candidate)).toEqual(
    LEVELS.map(
      (level) => [1, 3, 9, 15, 20].filter((step) => level >= step).length,
    ),
  );
});

it('holds Mercy, unresolved, for its untraced 12th-level mercies, and its five increments with it', () => {
  expectIncrementParentFacts({ ...mercy, notes: 'none' });
  const hold = 'class-abilities-615-whole-content-Er8h3fZ2edJEviTv';
  expect(mercy.candidate).toMatchObject({
    assessmentStatus: 'unresolved',
    holdIds: [hold],
    noticeHoldIds: [],
    requiredNotices: ['PZO1110', 'PZO9475'],
  });
  expect(mercy.candidate.missingEvidence?.[hold]).toMatchObject({
    book: null,
    items: ['Amputated', 'Ensorcelled', 'Petrified'],
  });
  // The appended Healer's Handbook mercies are PCGen's rows word for word.
  expect(
    mercy.candidate.additionalComparisonLeads.map((row) => [
      row.book,
      row.line,
    ]),
  ).toEqual([48, 49, 50, 51, 52, 53, 54, 55].map((line) => ['PZO9475', line]));
  for (const name of ['Amputated', 'Ensorcelled', 'Petrified'])
    expect(mercy.candidate.mechanicsReview.descriptionText).toMatch(
      new RegExp(`<em>${name}: ?</em>`),
    );
  expect(mercy.increments).toHaveLength(5);
  expect(scheduleValues(mercy.candidate)).toEqual(
    LEVELS.map((level) => Math.min(Math.floor(level / 3), 6)),
  );
});
