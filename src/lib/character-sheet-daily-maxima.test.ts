// rotation-4 R4 (owner 2026-11-17, PRD #251; ORCH research stats-design.md
// "Per-day maxima"): the sheet shows how many times per day a limited
// ability can be used, the maximum only: no tally, no uses remaining, no
// reset. A rule value `dailyMaximum { key, unit, amount }` (key: the Foundry
// tag, from `uses.maxFormula` with `per: day`) and `dailyMaximumIncrease
// { key, amount }` (Extra Channel); maxima stay apart per key; each copy of
// an increase adds. Ability modifiers in a maximum's formula are the
// permanent ones, so rage's own Constitution bonus adds no rounds. Fixtures
// have the imported shape: Foundry rage.WSqWT9ZIshtC5vlV (`4 +
// @abilities.con.mod + (2 * (@class.level - 1))` rounds), channel-energy
// .kXXz1lO4i7CibHJ9 (`3 + @abilities.cha.mod` uses), lay-on-hands
// .WhE4j0Jc82npdMCP, feats/extra-channel.pgRX4VpFemwv9R0E (reviewed: no
// Foundry changes).
import { expect, test } from 'vitest';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  calculateCharacterSheetProjections,
  ruleValueSchema,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
  type RuleValue,
  type SheetEntry,
} from './character-sheet';
import { importedCatalogEntrySchema } from './catalog/imported-entry-schema';

const classEntry = (
  id: string,
  name: string,
  featuresByLevel: { classLevel: number; catalogEntryId: string }[],
): CharacterSheetCatalogEntry => ({
  _id: id,
  ruleIdentity: id,
  name,
  modifiers: [],
  detail: {
    kind: 'class',
    classKind: 'base',
    tag: id,
    hitDie: 10,
    bab: 'full',
    saves: { fort: 'good', ref: 'poor', will: 'good' },
    skillRanksPerLevel: 2,
    featuresByLevel,
  },
});

const scores: Partial<Record<(typeof abilityKeys)[number], number>> = {
  constitution: 14,
  charisma: 14,
};

const catalog: CharacterSheetCatalogEntry[] = [
  {
    _id: 'base',
    ruleIdentity: 'base',
    modifiers: abilityKeys.map((key) => ({
      target: abilityTargets[key],
      bonusType: 'base',
      value: scores[key] ?? 10,
    })),
  },
  classEntry('barbarian', 'Barbarian', [
    { classLevel: 1, catalogEntryId: 'rage' },
  ]),
  {
    _id: 'rage',
    ruleIdentity: 'pf1/WSqWT9ZIshtC5vlV',
    name: 'Rage',
    modifiers: [],
    detail: { kind: 'classFeature' },
    ruleValues: [
      {
        kind: 'dailyMaximum',
        key: 'classFeat_rage',
        unit: 'rounds',
        amount: {
          formula: '4 + @ability.con.mod + (2 * (@classLevel.barbarian - 1))',
        },
      },
    ],
  },
  {
    // The rage itself while it lasts: +4 morale to Strength and
    // Constitution (CRB barbarian.html), a Temporary Effect.
    _id: 'raging',
    ruleIdentity: 'everythingpath/raging',
    name: 'Raging',
    modifiers: [
      { target: 'ability.str', bonusType: 'morale', value: 4 },
      { target: 'ability.con', bonusType: 'morale', value: 4 },
    ],
    detail: { kind: 'spellEffect' },
  },
  classEntry('cleric', 'Cleric', [
    { classLevel: 1, catalogEntryId: 'channel-energy' },
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
        amount: { formula: '3 + @ability.cha.mod' },
      },
    ],
  },
  classEntry('paladin', 'Paladin', [
    { classLevel: 2, catalogEntryId: 'lay-on-hands' },
  ]),
  {
    // CRB paladin.html: "a number of times per day equal to 1/2 her
    // paladin level plus her Charisma modifier".
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
    // APG: Extra Channel, "You can channel energy two additional times per
    // day"; it can be taken multiple times.
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

const levelRows = (classes: readonly string[]) =>
  classes.map(
    (classEntryId, index): SheetEntry => ({
      _id: `level-${index + 1}`,
      kind: 'classLevel',
      active: true,
      state: {
        kind: 'classLevel',
        classEntryId,
        position: index + 1,
        hpGained: 6,
      },
    }),
  );
const feat = (id: string): SheetEntry => ({
  _id: id,
  kind: 'feat',
  active: true,
  catalogEntryId: 'extra-channel',
  state: { kind: 'feat' },
});
const raging: SheetEntry = {
  _id: 'raging-row',
  kind: 'spellEffect',
  active: true,
  catalogEntryId: 'raging',
  state: { kind: 'spellEffect', casterLevel: 1 },
};

function sheet(
  classes: readonly string[],
  extra: SheetEntry[] = [],
  catalogEntries = catalog,
): CharacterSheetInput {
  return {
    characterKind: 'pc',
    entries: [
      {
        _id: 'base-row',
        kind: 'base',
        active: true,
        catalogEntryId: 'base',
        state: { kind: 'base' },
      },
      ...levelRows(classes),
      ...extra,
    ],
    catalogEntries,
  };
}

const repeat = (id: string, count: number) =>
  Array.from({ length: count }, () => id);

function maxima(result: ReturnType<typeof calculateCharacterSheet>) {
  return result.dailyMaxima.map(
    ({ key, value, unit }) => `${key} ${value} ${unit}`,
  );
}

// CRB Table 3–1: rage for 4 + Con modifier rounds at 1st, +2 rounds per
// level after 1st. Con 14 is +2.
test.each([
  [1, 6],
  [4, 12],
  [10, 24],
])('a Barbarian %i with Con 14 rages %i rounds per day', (level, rounds) => {
  expect(
    maxima(calculateCharacterSheet(sheet(repeat('barbarian', level)))),
  ).toEqual([`classFeat_rage ${rounds} rounds`]);
});

test('rage’s own Constitution bonus adds no rounds: the maximum reads permanent ability modifiers', () => {
  const input = sheet(repeat('barbarian', 4), [raging]);
  const current = calculateCharacterSheet(input);
  // The rage raises current Constitution to 18 (+4) …
  expect(current.abilities.constitution.modifier).toBe(4);
  // … but the maximum stays 4 + 2 + 6.
  expect(maxima(current)).toEqual(['classFeat_rage 12 rounds']);
  const projections = calculateCharacterSheetProjections(input);
  expect(maxima(projections.current)).toEqual(['classFeat_rage 12 rounds']);
  expect(maxima(projections.permanent)).toEqual(['classFeat_rage 12 rounds']);
});

test('a Cleric with Cha 14 channels 3 + 2 = 5 times per day; each copy of Extra Channel adds 2', () => {
  expect(maxima(calculateCharacterSheet(sheet(['cleric'])))).toEqual([
    'classFeat_channelEnergy 5 uses',
  ]);
  expect(
    maxima(calculateCharacterSheet(sheet(['cleric'], [feat('extra-1')]))),
  ).toEqual(['classFeat_channelEnergy 7 uses']);
  const twice = calculateCharacterSheet(
    sheet(['cleric'], [feat('extra-1'), feat('extra-2')]),
  );
  expect(maxima(twice)).toEqual(['classFeat_channelEnergy 9 uses']);
  const channel = twice.dailyMaxima[0];
  expect(channel?.sources.map(({ name }) => name)).toEqual([
    'Channel Energy',
    'Extra Channel',
    'Extra Channel',
  ]);
});

test('two classes’ maxima stay apart per key: a Cleric 5 / Paladin 4 with Extra Channel', () => {
  const result = calculateCharacterSheet(
    sheet([...repeat('cleric', 5), ...repeat('paladin', 4)], [feat('extra-1')]),
  );
  expect(maxima(result)).toEqual([
    'classFeat_channelEnergy 7 uses',
    'classFeat_layOnHands 4 uses',
  ]);
});

test('an increase with no maximum of its key gives no number', () => {
  expect(
    maxima(calculateCharacterSheet(sheet(['barbarian'], [feat('extra-1')]))),
  ).toEqual(['classFeat_rage 6 rounds']);
});

test('a formula that cannot be resolved gives no number and warns', () => {
  const entries = catalog.map((entry) =>
    entry._id === 'channel-energy'
      ? {
          ...entry,
          ruleValues: [
            {
              kind: 'dailyMaximum' as const,
              key: 'classFeat_channelEnergy',
              unit: 'uses' as const,
              amount: { formula: '3 + @unknown' },
            },
          ],
        }
      : entry,
  );
  const result = calculateCharacterSheet(
    sheet(['cleric'], [feat('extra-1')], entries),
  );
  const channel = result.dailyMaxima[0];
  expect(channel).toMatchObject({
    key: 'classFeat_channelEnergy',
    value: null,
  });
  expect(result.warnings).toContainEqual(
    expect.objectContaining({
      check: 'unsupportedFormula',
      subject: `${channel?.entryId}:ruleValue:0`,
    }),
  );
});

test('an unresolved increase leaves its maximum with no number and warns', () => {
  const entries = catalog.map((entry) =>
    entry._id === 'extra-channel'
      ? {
          ...entry,
          ruleValues: [
            {
              kind: 'dailyMaximumIncrease' as const,
              key: 'classFeat_channelEnergy',
              amount: { formula: '@unknown' },
            },
          ],
        }
      : entry,
  );
  const result = calculateCharacterSheet(
    sheet(['cleric'], [feat('extra-1')], entries),
  );
  expect(maxima(result)).toEqual(['classFeat_channelEnergy null uses']);
  expect(result.warnings).toContainEqual(
    expect.objectContaining({
      check: 'unsupportedFormula',
      subject: 'extra-1:ruleValue:0',
    }),
  );
});

test('no maximum gives none, and per-day maxima are not feature numbers', () => {
  expect(calculateCharacterSheet(sheet([])).dailyMaxima).toEqual([]);
  expect(calculateCharacterSheet(sheet(['barbarian'])).featureNumbers).toEqual(
    [],
  );
});

test.each<[string, unknown, boolean]>([
  [
    'a maximum',
    { kind: 'dailyMaximum', key: 'classFeat_rage', unit: 'rounds', amount: 4 },
    true,
  ],
  ['an increase', { kind: 'dailyMaximumIncrease', key: 'k', amount: 2 }, true],
  [
    'an empty key',
    { kind: 'dailyMaximum', key: '', unit: 'uses', amount: 1 },
    false,
  ],
  [
    'a key over 64 characters',
    { kind: 'dailyMaximumIncrease', key: 'k'.repeat(65), amount: 1 },
    false,
  ],
  [
    'an unknown unit',
    { kind: 'dailyMaximum', key: 'k', unit: 'minutes', amount: 1 },
    false,
  ],
  [
    'a negative amount',
    { kind: 'dailyMaximumIncrease', key: 'k', amount: -1 },
    false,
  ],
  [
    'a fractional amount',
    { kind: 'dailyMaximum', key: 'k', unit: 'uses', amount: 1.5 },
    false,
  ],
  [
    'an over-long formula',
    {
      kind: 'dailyMaximum',
      key: 'k',
      unit: 'uses',
      amount: { formula: '1'.repeat(4097) },
    },
    false,
  ],
  [
    'a tally field',
    { kind: 'dailyMaximum', key: 'k', unit: 'uses', amount: 1, used: 0 },
    false,
  ],
  [
    'an increase with a unit',
    { kind: 'dailyMaximumIncrease', key: 'k', unit: 'uses', amount: 1 },
    false,
  ],
])('the rule value schema takes %s: %j', (_, ruleValue, accepted) => {
  expect(ruleValueSchema.safeParse(ruleValue).success).toBe(accepted);
  expect(
    importedCatalogEntrySchema.shape.ruleValues.safeParse([ruleValue]).success,
  ).toBe(accepted);
});

test('a maximum and an increase are discriminated variants', () => {
  const legal: RuleValue[] = [
    { kind: 'dailyMaximum', key: 'k', unit: 'points', amount: { rows: {} } },
    { kind: 'dailyMaximumIncrease', key: 'k', amount: 1 },
  ];
  // @ts-expect-error a maximum names its unit
  const noUnit: RuleValue = { kind: 'dailyMaximum', key: 'k', amount: 1 };
  // @ts-expect-error an increase names its key
  const noKey: RuleValue = { kind: 'dailyMaximumIncrease', amount: 1 };
  expect([legal, noUnit, noKey]).toHaveLength(3);
});
