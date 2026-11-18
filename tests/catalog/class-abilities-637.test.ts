// @vitest-environment node
import { expect, it } from 'vitest';
import {
  bodyParagraphs,
  describeIncrementParent,
  describeLaunchFeature,
  expectIncrementParentFacts,
  LEVELS,
  prdText,
  scheduleValues,
} from './class-abilities-596';

// #637, MVP launch subset (#596 run A): Armor Training (Heavy Armor), admitted.
const { candidate, entry } = describeLaunchFeature({
  batch: 637,
  name: 'Armor Training (Heavy Armor)',
  disposition: 'admitted',
});

it('states heavy-armor speed from 7th level in a Note and leaves it outstanding', () => {
  const [sentence] = bodyParagraphs(candidate.mechanicsReview.descriptionText);
  expect(sentence).toBe(
    'At 7th level, a fighter can move at his normal speed while wearing heavy armor.',
  );
  expect(prdText(candidate.prdComparison.lines[0]!.text)).toMatch(
    new RegExp(`${sentence}$`),
  );
  expect(entry.modifiers).toEqual([]);
  expect(entry.situationalNotes?.map((note) => note.text)).toEqual([sentence]);
  expect(candidate.mechanicsReview.classFeatureReview.level).toBe(7);
  expect(
    candidate.mechanicsReview.classFeatureReview.schedule
      .filter((row) => row.value)
      .map((row) => row.level),
  ).toEqual([7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  expect(candidate.mechanicsReview.outstandingCalculations).toEqual([
    expect.objectContaining({ owner: '#716' }),
  ]);
  expect(candidate.comparison.literalRow).toContain(
    'UNENCUMBEREDMOVE:HeavyArmor',
  );
});

// #617 wave B adds Rogue Talents, admitted with its nine rogue and nine
// unchained rogue increments.
const talents = describeIncrementParent({
  batch: 637,
  key: 'pf1/iBTrvPtn3jczInbn',
  name: 'Rogue Talents',
  books: ['PZO1110', 'PZO1131'],
  classes: ['pf1/24b0LaabeAlUx5gN', 'pf1/5tsZI6zk29yX1ckA'],
  prdExact: false,
});

it('requires Ultimate Combat for the ninja-trick sentence and gives a talent at every even level to both rogues', () => {
  expectIncrementParentFacts({ ...talents, notes: 'none' });
  expect(talents.candidate.requiredNotices).toEqual([
    'PZO1110',
    'PZO1118',
    'PZO1131',
  ]);
  expect(scheduleValues(talents.candidate)).toEqual(
    LEVELS.map((level) => Math.floor(level / 2)),
  );
  expect(talents.increments).toHaveLength(18);
});
