// @vitest-environment node
import { expect, it } from 'vitest';
import {
  bodyParagraphs,
  describeLaunchFeature,
  prdText,
} from './class-abilities-596';

// #621, MVP launch subset (#596 run A): Weapon Mastery, admitted.
const { candidate, entry } = describeLaunchFeature({
  batch: 621,
  name: 'Weapon Mastery',
  disposition: 'admitted',
});

it('states weapon mastery at 20th level in a Note and leaves its three effects outstanding', () => {
  const paragraphs = bodyParagraphs(candidate.mechanicsReview.descriptionText);
  expect(paragraphs).toEqual([prdText(candidate.prdComparison.lines[0]!.text)]);
  expect(entry.modifiers).toEqual([]);
  expect(entry.situationalNotes?.map((note) => note.text)).toEqual(paragraphs);
  expect(candidate.mechanicsReview.classFeatureReview.level).toBe(20);
  expect(
    candidate.mechanicsReview.classFeatureReview.schedule
      .filter((row) => row.value)
      .map((row) => row.level),
  ).toEqual([20]);
  expect(
    candidate.mechanicsReview.outstandingCalculations.map(
      (row) => row.calculation,
    ),
  ).toEqual([
    'Automatic confirmation of critical threats with the chosen weapon',
    'Critical damage multiplier +1 with the chosen weapon',
    'Cannot be disarmed while wielding a weapon of the chosen type',
  ]);
});
