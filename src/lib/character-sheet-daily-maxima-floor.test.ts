// rotation-5 part F (root, 2026-11-18; stats-d3 follow-ups §3): a per-day
// maximum's total, its amount plus every increase of its key, is floored at
// 0: a negative count is not a number of uses (no rules text is claimed for
// it). The amount itself may be negative inside the sum, so a floored
// record plus an increase no longer overstates; a record's own stated
// minimum (`max(1, …)` in its formula) keeps working. Fixtures have the
// imported shape: Foundry channel-energy.kXXz1lO4i7CibHJ9 (`3 +
// @abilities.cha.mod` uses), lay-on-hands.WhE4j0Jc82npdMCP,
// feats/extra-channel.pgRX4VpFemwv9R0E (reviewed: +2 per copy).
import { expect, test } from 'vitest';
import {
  calculateCharacterSheet,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
  type SheetEntry,
} from './character-sheet';
import {
  baseClass,
  baseScores,
  classLevelSheet,
} from './character-sheet-rule-value-fixture';

function catalog(
  charisma: number,
  channelFormula = '3 + @ability.cha.mod',
): CharacterSheetCatalogEntry[] {
  return [
    baseScores({ charisma }),
    baseClass('cleric', 'Cleric', [
      { classLevel: 1, catalogEntryId: 'channel-energy' },
    ]),
    baseClass('paladin', 'Paladin', [
      { classLevel: 2, catalogEntryId: 'lay-on-hands' },
    ]),
    {
      _id: 'channel-energy',
      ruleIdentity: 'pf1/kXXz1lO4i7CibHJ9',
      name: 'Channel Energy',
      modifiers: [],
      detail: { kind: 'classFeature' },
      ruleValues: [
        {
          kind: 'dailyMaximum',
          key: 'classFeat_channelEnergy',
          unit: 'uses',
          amount: { formula: channelFormula },
        },
      ],
    },
    {
      _id: 'lay-on-hands',
      ruleIdentity: 'pf1/WhE4j0Jc82npdMCP',
      name: 'Lay on Hands',
      modifiers: [],
      detail: { kind: 'classFeature' },
      ruleValues: [
        {
          kind: 'dailyMaximum',
          key: 'classFeat_layOnHands',
          unit: 'uses',
          amount: {
            formula: 'floor(@classLevel.paladin / 2) + @ability.cha.mod',
          },
        },
      ],
    },
    {
      _id: 'extra-channel',
      ruleIdentity: 'pf1/pgRX4VpFemwv9R0E',
      name: 'Extra Channel',
      modifiers: [],
      detail: { kind: 'feat', repeatable: 'yes' },
      ruleValues: [
        {
          kind: 'dailyMaximumIncrease',
          key: 'classFeat_channelEnergy',
          amount: 2,
        },
      ],
    },
  ];
}

function sheet(
  classes: readonly string[],
  {
    charisma,
    feats = 0,
    channelFormula,
  }: {
    charisma: number;
    feats?: number;
    channelFormula?: string;
  },
): CharacterSheetInput {
  return classLevelSheet(
    classes,
    Array.from(
      { length: feats },
      (_, index): SheetEntry => ({
        _id: `extra-${index + 1}`,
        kind: 'feat',
        active: true,
        catalogEntryId: 'extra-channel',
        state: { kind: 'feat' },
      }),
    ),
    catalog(charisma, channelFormula),
  );
}

const maxima = (input: CharacterSheetInput) =>
  calculateCharacterSheet(input).dailyMaxima.map(
    ({ key, value, floor, sources }) => ({
      key,
      value,
      floor,
      sources: sources.map(({ name }) => name),
    }),
  );

test('a Cleric 1 with Charisma 1 and Extra Channel channels 3 − 5 + 2 = 0 times: the amount is negative inside the sum', () => {
  expect(maxima(sheet(['cleric'], { charisma: 1, feats: 1 }))).toEqual([
    {
      key: 'classFeat_channelEnergy',
      value: 0,
      floor: undefined,
      sources: ['Channel Energy', 'Extra Channel'],
    },
  ]);
});

test('the same Cleric without the feat channels 0 times, not −2: the total is floored, shown as its own line', () => {
  expect(maxima(sheet(['cleric'], { charisma: 1 }))).toEqual([
    {
      key: 'classFeat_channelEnergy',
      value: 0,
      floor: { sum: -2 },
      sources: ['Channel Energy'],
    },
  ]);
});

test('a positive total is unchanged and has no floor line', () => {
  expect(maxima(sheet(['cleric'], { charisma: 14, feats: 2 }))).toEqual([
    {
      key: 'classFeat_channelEnergy',
      value: 9,
      floor: undefined,
      sources: ['Channel Energy', 'Extra Channel', 'Extra Channel'],
    },
  ]);
});

test('a formula’s own minimum keeps working, and an increase adds after it', () => {
  // A record stating "minimum 1": max(1, 3 − 5) + 2 = 3.
  expect(
    maxima(
      sheet(['cleric'], {
        charisma: 1,
        feats: 1,
        channelFormula: 'max(1, 3 + @ability.cha.mod)',
      }),
    ),
  ).toEqual([
    {
      key: 'classFeat_channelEnergy',
      value: 3,
      floor: undefined,
      sources: ['Channel Energy', 'Extra Channel'],
    },
  ]);
});

test('two keys are floored apart: a Cleric 1 / Paladin 4 with Charisma 3 and Extra Channel', () => {
  // Channel: 3 − 4 + 2 = 1; lay on hands: 2 − 4 = −2, floored at 0.
  const result = maxima(
    sheet(['cleric', 'paladin', 'paladin', 'paladin', 'paladin'], {
      charisma: 3,
      feats: 1,
    }),
  );
  expect(result).toEqual([
    {
      key: 'classFeat_channelEnergy',
      value: 1,
      floor: undefined,
      sources: ['Channel Energy', 'Extra Channel'],
    },
    {
      key: 'classFeat_layOnHands',
      value: 0,
      floor: { sum: -2 },
      sources: ['Lay on Hands'],
    },
  ]);
});

test('an unresolved maximum has no number and no floor line', () => {
  expect(
    maxima(sheet(['cleric'], { charisma: 1, channelFormula: '3 + @unknown' })),
  ).toEqual([
    {
      key: 'classFeat_channelEnergy',
      value: null,
      floor: undefined,
      sources: ['Channel Energy'],
    },
  ]);
});
