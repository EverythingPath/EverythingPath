// @vitest-environment node
import { expect, it } from 'vitest';
import {
  bodyParagraphs,
  describeLaunchFeature,
  prdText,
} from './class-abilities-596';

// #608, MVP launch subset (#596 run A): Armor Training, admitted.
const { candidate, entry } = describeLaunchFeature({
  batch: 608,
  name: 'Armor Training',
  disposition: 'admitted',
});

it('states the rule in Notes and leaves the armor check penalty, maximum Dexterity and speed outstanding', () => {
  const paragraphs = bodyParagraphs(candidate.mechanicsReview.descriptionText);
  expect(entry.modifiers).toEqual([]);
  expect(entry.situationalNotes?.map((note) => note.text)).toEqual(paragraphs);
  // Foundry's two changes stay unmapped: no Modifier target exists for them.
  expect(
    entry.unsupported
      .filter((row) => row.field === 'changes')
      .map((row) => (row.value as { target: string }).target),
  ).toEqual(['acpA', 'mDexA']);
  expect(
    candidate.mechanicsReview.outstandingCalculations.map((row) => row.owner),
  ).toEqual(['#716', '#716', '#716']);
  // The body equals the PRD's Armor Training paragraph and the medium-armor
  // sentence; the heavy-armor sentence is Armor Training (Heavy Armor).
  const [first, second] = candidate.prdComparison.lines.map((row) =>
    prdText(row.text),
  );
  expect(paragraphs[0]).toBe(first);
  expect(second).toBe(
    `${paragraphs[1]} At 7th level, a fighter can move at his normal speed while wearing heavy armor.`,
  );
});

it('validates the armor training tiers through level 20 against the PRD table and the imported formulas', () => {
  const schedule = candidate.mechanicsReview.classFeatureReview.schedule;
  expect(schedule.map((row) => row.value)).toEqual([
    0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4,
  ]);
  // Foundry: clamp(floor((@class.level + 1) / 4), 0, 4) from 3rd level.
  for (const { level, value } of schedule)
    expect(value).toBe(
      level < 3 ? 0 : Math.min(Math.max(Math.floor((level + 1) / 4), 0), 4),
    );
  expect(candidate.comparison.literalRow).toContain(
    'BONUS:VAR|ArmorTraining|min((ArmorTrainingLVL+1)/4,4)',
  );
});
