// @vitest-environment node
import { expect, it } from 'vitest';
import { z } from 'zod';
import {
  catalogModifierTargets,
  modifierConditionSchema,
  personalBonusTypes,
  resolveSheet,
} from '../../src/lib/character-sheet';
import {
  describeIncrementParent,
  describeLaunchFeature,
  expectIncrementParentFacts,
  LEVELS,
  prdText,
  scheduleValues,
  WAVE_D_REVIEWED_ON,
} from './class-abilities-596';

// #636, MVP launch subset (#596 run A): Bravery, admitted with its Note.
const { candidate, entry } = describeLaunchFeature({
  batch: 636,
  name: 'Bravery',
  disposition: 'admitted',
});

const modifierSchema = z.strictObject({
  target: z.enum(catalogModifierTargets).exclude(['ability.$choice']),
  bonusType: z.enum(personalBonusTypes),
  value: z.union([z.number(), z.strictObject({ formula: z.string() })]),
  condition: modifierConditionSchema.optional(),
});
const bravery = entry.modifiers.map((raw) => ({
  ...modifierSchema.parse(raw),
  sheetEntryId: entry.externalKey,
  catalogEntryId: entry.externalKey,
  source: entry.externalKey,
  entryName: entry.name,
  builtIn: false,
}));

it('curates the Will context note as one Modifier on the shared fear Situation, per the reviewed schedule', () => {
  const [description, note] = candidate.mechanicsReview.curationRecords;
  // The description is covered by the note record; it adds nothing itself.
  expect(description?.outputs).toEqual([]);
  expect(note).toMatchObject({
    kind: 'note',
    target: 'will',
    text: '+[[floor((@class.level + 2) / 4)]] vs fear effects',
    textSha256:
      '9a041362ac6d0436a9b74fc9fc3906b251c72d1a0823697736b6ae66e4fdb239',
    outputs: [
      {
        kind: 'modifier',
        target: 'save.will',
        bonusType: 'untyped',
        value: { formula: 'floor((@classLevel.fighter + 2) / 4)' },
        condition: { situation: 'fear' },
      },
    ],
  });
  expect(entry.modifiers).toEqual([
    {
      target: 'save.will',
      bonusType: 'untyped',
      value: { formula: 'floor((@classLevel.fighter + 2) / 4)' },
      condition: { situation: 'fear' },
    },
  ]);
  expect(entry.situationalNotes ?? []).toEqual([]);
  // The raw context note no longer lacks a record.
  expect(entry.unsupported.map((row) => row.field)).toEqual(['gameContent']);
  // PRD table: bravery +1 at 2nd, +2 at 6th ... +5 at 18th.
  const values = candidate.mechanicsReview.classFeatureReview.schedule;
  expect(
    values.filter(
      (row, index) => row.value !== (values[index - 1]?.value ?? 0),
    ),
  ).toEqual([
    { level: 2, value: 1 },
    { level: 6, value: 2 },
    { level: 10, value: 3 },
    { level: 14, value: 4 },
    { level: 18, value: 5 },
  ]);
  expect(candidate.mechanicsReview.outstandingCalculations).toEqual([]);
  expect(prdText(candidate.prdComparison.lines[0]!.text)).toBe(
    'Starting at 2nd level, a fighter gains a +1 bonus on Will saves against fear. This bonus increases by +1 for every four levels beyond 2nd.',
  );
  expect(candidate.comparison.literalRow).toContain(
    'BONUS:VAR|Bravery|(BraveryLVL+2)/4',
  );
});

it('gives the reviewed Will bonus against fear at every Fighter level through the public resolver, outside totals', () => {
  for (const { level, value } of candidate.mechanicsReview.classFeatureReview
    .schedule) {
    const options = { classLevels: { fighter: level } };
    const plain = resolveSheet(bravery, options)['save.will'];
    expect(plain.total, `level ${level}`).toBe(0);
    expect(
      plain.conditional.map((row) => row.value),
      `level ${level}`,
    ).toEqual([value]);
    expect(
      resolveSheet(bravery, { ...options, situations: ['fear'] })['save.will']
        .total,
      `level ${level}`,
    ).toBe(value);
    expect(value).toBe(level < 2 ? 0 : Math.floor((level + 2) / 4));
  }
  // Another class's levels add nothing.
  expect(
    resolveSheet(bravery, {
      classLevels: { barbarian: 20 },
      situations: ['fear'],
    })['save.will'].total,
  ).toBe(0);
});

// #615 wave D adds Inspire Courage and Bonus Feats (MAG), admitted with
// their three and two increments.
const courage = describeIncrementParent({
  batch: 636,
  key: 'pf1/h56K6HEBOItImPPL',
  name: 'Inspire Courage',
  books: ['PZO1110'],
  classes: ['pf1/6GjOjO6r3R06fLwE'],
  prdExact: false,
  reviewedOn: WAVE_D_REVIEWED_ON,
});
const magusFeats = describeIncrementParent({
  batch: 636,
  key: 'pf1/gzBR0qkMdu0KkLV0',
  name: 'Bonus Feats (MAG)',
  books: ['PZO1117'],
  classes: ['pf1/xZLcyrEKYZoJPS2k'],
  prdExact: true,
  reviewedOn: WAVE_D_REVIEWED_ON,
});

it('adds no Inspire Courage Note and raises the bonus from +1 at 1st by 1 at 5th and every six levels', () => {
  expectIncrementParentFacts({ ...courage, notes: 'none' });
  expect(scheduleValues(courage.candidate)).toEqual(
    LEVELS.map((level) => 1 + Math.floor((level + 1) / 6)),
  );
});

it('adds no Bonus Feats (MAG) Note, leaves its bonusFeats change unmapped, and gives a feat at 5th, 11th and 17th', () => {
  expectIncrementParentFacts({
    ...magusFeats,
    notes: 'none',
    unmappedTargets: ['bonusFeats'],
  });
  expect(magusFeats.entry.sources).toEqual([]);
  expect(scheduleValues(magusFeats.candidate)).toEqual(
    LEVELS.map((level) => Math.floor((level + 1) / 6)),
  );
});
