// rotation-2 R1 (PRD #251; ORCH research stats-design.md "Channel dice"): a
// rule value of kind `dice` gives a class feature's dice as the count of its
// active rows, or by a formula. The fixtures have the imported shape: the
// Cleric's Channel Energy (Foundry pf1/kXXz1lO4i7CibHJ9) with its reviewed
// increments at cleric levels 3, 5 … 19, each naming it as its parentFeature
// (scripts/catalog/pcgen/schedules-channel-bloodline.ts), and the
// Ecclesitheurge's replacement of the increase gained at 3rd level (PRD
// advancedClassGuide/classOptions/cleric.html:359).
import { expect, test } from 'vitest';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  calculateCharacterSheetProjections,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
  type RuleValue,
  type SheetEntry,
} from './character-sheet';
import { importedCatalogEntrySchema } from './catalog/imported-entry-schema';

const channelEnergy = 'pf1/kXXz1lO4i7CibHJ9';
const increments = [3, 5, 7, 9, 11, 13, 15, 17, 19];

function classEntry(
  id: string,
  featuresByLevel: { classLevel: number; catalogEntryId: string }[],
): CharacterSheetCatalogEntry {
  return {
    _id: id,
    ruleIdentity: id,
    name: id === 'cleric' ? 'Cleric' : 'Paladin',
    modifiers: [],
    detail: {
      kind: 'class',
      classKind: 'base',
      tag: id,
      hitDie: id === 'cleric' ? 8 : 10,
      bab: id === 'cleric' ? 'threeQuarters' : 'full',
      saves: { fort: 'good', ref: 'poor', will: 'good' },
      skillRanksPerLevel: 2,
      featuresByLevel,
    },
  };
}

const catalog: CharacterSheetCatalogEntry[] = [
  {
    _id: 'base',
    ruleIdentity: 'base',
    modifiers: abilityKeys.map((key) => ({
      target: abilityTargets[key],
      bonusType: 'base',
      value: 10,
    })),
  },
  classEntry('cleric', [
    { classLevel: 1, catalogEntryId: 'channel-energy' },
    ...increments.map((classLevel) => ({
      classLevel,
      catalogEntryId: `channel-energy-${classLevel}`,
    })),
  ]),
  {
    _id: 'channel-energy',
    ruleIdentity: channelEnergy,
    name: 'Channel Energy',
    modifiers: [],
    detail: { kind: 'classFeature' },
    ruleValues: [{ kind: 'dice', die: 6, amount: { rows: {} } }],
  },
  ...increments.map(
    (classLevel): CharacterSheetCatalogEntry => ({
      _id: `channel-energy-${classLevel}`,
      ruleIdentity: `everythingpath/cleric-channel-energy-${classLevel}`,
      name: `Channel Energy ${Math.ceil(classLevel / 2)}d6`,
      modifiers: [],
      detail: {
        kind: 'classFeature',
        parentFeature: channelEnergy,
        part: `${classLevel}:${channelEnergy}`,
      },
    }),
  ),
  {
    _id: 'ecclesitheurge',
    ruleIdentity: 'everythingpath/cleric-ecclesitheurge',
    name: 'Ecclesitheurge',
    modifiers: [],
    detail: {
      kind: 'archetype',
      classEntryIds: ['cleric'],
      replaces: [
        { classLevel: 3, catalogEntryId: 'channel-energy-3', scope: 'part' },
      ],
      adds: [],
      featureChanges: [
        {
          featureIdentity: channelEnergy,
          scope: 'part',
          part: `3:${channelEnergy}`,
        },
      ],
    },
  },
  classEntry('paladin', [{ classLevel: 4, catalogEntryId: 'paladin-channel' }]),
  {
    _id: 'paladin-channel',
    ruleIdentity: 'pf1/paladinChannelPositiveEnergy',
    name: 'Channel Positive Energy',
    modifiers: [],
    detail: { kind: 'classFeature' },
    // PRD paladin.html:414: "A paladin uses her level as her effective
    // cleric level when channeling positive energy", and a cleric channels
    // "1d6 … plus 1d6 … for every two cleric levels beyond 1st" (PRD
    // cleric.html:391), so ceil(level / 2) dice: 2d6 at paladin 4.
    ruleValues: [
      {
        kind: 'dice',
        die: 6,
        amount: { formula: 'ceil(@classLevel.paladin / 2)' },
      },
    ],
  },
];

function sheet({
  levels,
  archetype = false,
  catalogEntries = catalog,
}: {
  levels: readonly ('cleric' | 'paladin')[];
  archetype?: boolean;
  catalogEntries?: CharacterSheetCatalogEntry[];
}): CharacterSheetInput {
  const entries: SheetEntry[] = [
    {
      _id: 'base-row',
      kind: 'base',
      active: true,
      catalogEntryId: 'base',
      state: { kind: 'base' },
    },
    ...levels.map(
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
    ),
    ...(archetype
      ? [
          {
            _id: 'archetype-row',
            kind: 'archetype' as const,
            active: true,
            catalogEntryId: 'ecclesitheurge',
            state: { kind: 'archetype' as const },
          },
        ]
      : []),
  ];
  return { characterKind: 'pc', entries, catalogEntries };
}

const clerics = (count: number) =>
  Array.from({ length: count }, () => 'cleric' as const);

function channelRowId(result: ReturnType<typeof calculateCharacterSheet>) {
  return result.resolvedEntries.find(
    ({ entry }) =>
      'catalogEntryId' in entry && entry.catalogEntryId === 'channel-energy',
  )?.entry._id;
}

// CRB Table 3–5 (Cleric): channel energy 1d6 at 1st, +1d6 every two levels.
test.each([
  [1, 1],
  [2, 1],
  [3, 2],
  [5, 3],
  [8, 4],
  [20, 10],
])('a Cleric %i channels %id6, one die per active row', (level, count) => {
  const result = calculateCharacterSheet(sheet({ levels: clerics(level) }));
  expect(result.featureNumbers).toEqual([
    expect.objectContaining({
      kind: 'dice',
      entryId: channelRowId(result),
      ruleValueIndex: 0,
      count,
      die: 6,
    }),
  ]);
  expect(result.featureNumbers[0]?.sources).toHaveLength(count);
});

// PRD advancedClassGuide/classOptions/cleric.html:359: Bonded Holy Symbol
// "replaces the increase to channel energy gained at 3rd level".
test('an Ecclesitheurge Cleric 5 loses exactly the replaced 3rd-level die: 2d6', () => {
  const plain = calculateCharacterSheet(sheet({ levels: clerics(5) }));
  const archetype = calculateCharacterSheet(
    sheet({ levels: clerics(5), archetype: true }),
  );
  expect(plain.featureNumbers.map(({ count }) => count)).toEqual([3]);
  expect(archetype.featureNumbers.map(({ count }) => count)).toEqual([2]);
  const sourceNames = archetype.featureNumbers[0]?.sources.map(
    ({ name }) => name,
  );
  expect(sourceNames).toEqual(['Channel Energy', 'Channel Energy 3d6']);
  // The replaced row is still listed, dormant, and gives no die.
  expect(
    archetype.resolvedEntries.find(
      ({ entry }) =>
        'catalogEntryId' in entry &&
        entry.catalogEntryId === 'channel-energy-3',
    ),
  ).toMatchObject({ dormant: true, counting: false });
});

test('a switched-off increment row gives no die', () => {
  const input = sheet({ levels: clerics(5) });
  const first = calculateCharacterSheet(input);
  const row = first.resolvedEntries.find(
    ({ entry }) =>
      'catalogEntryId' in entry && entry.catalogEntryId === 'channel-energy-5',
  );
  if (!row || !('grantKey' in row.entry) || !row.entry.grantKey)
    throw new Error('Missing 5th-level row');
  input.entries = [
    ...input.entries,
    { ...row.entry, _id: 'stored-channel-5', active: false },
  ];
  expect(
    calculateCharacterSheet(input).featureNumbers.map(({ count }) => count),
  ).toEqual([2]);
});

test('two channel classes keep their dice apart: Cleric 5 / Paladin 4 is 3d6 and 2d6', () => {
  const result = calculateCharacterSheet(
    sheet({
      levels: [...clerics(5), 'paladin', 'paladin', 'paladin', 'paladin'],
    }),
  );
  expect(
    result.featureNumbers.map(({ count, die, sources }) => ({
      count,
      die,
      from: sources[0]?.name,
    })),
  ).toEqual([
    { count: 3, die: 6, from: 'Channel Energy' },
    { count: 2, die: 6, from: 'Channel Positive Energy' },
  ]);
});

test('a formula that cannot be evaluated gives no number and warns', () => {
  const entries = catalog.map((entry) =>
    entry._id === 'paladin-channel'
      ? {
          ...entry,
          ruleValues: [
            {
              kind: 'dice' as const,
              die: 6,
              amount: { formula: '@unknown.variable' },
            },
          ],
        }
      : entry,
  );
  const result = calculateCharacterSheet(
    sheet({
      levels: ['paladin', 'paladin', 'paladin', 'paladin'],
      catalogEntries: entries,
    }),
  );
  const rowId = result.featureNumbers[0]?.entryId;
  expect(result.featureNumbers).toEqual([
    expect.objectContaining({ count: null, die: 6 }),
  ]);
  expect(result.warnings).toContainEqual(
    expect.objectContaining({
      check: 'unsupportedFormula',
      subject: `${rowId}:ruleValue:0`,
      target: { kind: 'entry', entryId: rowId },
    }),
  );
});

test('both projections give the dice, and an entry without rule values gives none', () => {
  const { current, permanent } = calculateCharacterSheetProjections(
    sheet({ levels: clerics(3) }),
  );
  expect(current.featureNumbers.map(({ count }) => count)).toEqual([2]);
  expect(permanent.featureNumbers.map(({ count }) => count)).toEqual([2]);
  const withoutRuleValues = catalog.map(
    ({ ruleValues: _ruleValues, ...entry }) => entry,
  );
  const plain = calculateCharacterSheet(
    sheet({ levels: clerics(3), catalogEntries: withoutRuleValues }),
  );
  expect(plain.featureNumbers).toEqual([]);
});

const imported = {
  externalKey: channelEnergy,
  upstreamKey: channelEnergy,
  pack: 'class-abilities',
  name: 'Channel Energy',
  detail: { kind: 'classFeature' },
  description: '',
  sources: [],
  modifiers: [],
  unsupported: [],
};

test('an imported entry keeps its rule values, and one without them parses as before', () => {
  const ruleValues = [
    { kind: 'dice', die: 6, amount: { rows: {} } },
    {
      kind: 'dice',
      die: 6,
      amount: { formula: 'ceil(@classLevel.paladin / 2)' },
    },
    { kind: 'dice', die: 8, amount: 2 },
  ];
  expect(
    importedCatalogEntrySchema.parse({ ...imported, ruleValues }).ruleValues,
  ).toEqual(ruleValues);
  expect(importedCatalogEntrySchema.parse(imported)).not.toHaveProperty(
    'ruleValues',
  );
});

test.each([
  ['an empty list', []],
  ['an unknown kind', [{ kind: 'speed', amount: 30 }]],
  ['a die below d2', [{ kind: 'dice', die: 1, amount: 1 }]],
  ['a negative amount', [{ kind: 'dice', die: 6, amount: -1 }]],
  ['a fraction', [{ kind: 'dice', die: 6, amount: 1.5 }]],
  [
    'rows and a formula at once',
    [{ kind: 'dice', die: 6, amount: { rows: {}, formula: '1' } }],
  ],
  ['rows of zero', [{ kind: 'dice', die: 6, amount: { rows: { per: 0 } } }]],
  ['an unknown field', [{ kind: 'dice', die: 6, amount: 1, label: 'x' }]],
])('the rule value schema refuses %s', (_, ruleValues) => {
  expect(
    importedCatalogEntrySchema.safeParse({ ...imported, ruleValues }).success,
  ).toBe(false);
});

test('a rule value is a discriminated variant: an illegal shape does not type-check', () => {
  const legal: RuleValue[] = [
    { kind: 'dice', die: 6, amount: { rows: { per: 1 } } },
  ];
  // @ts-expect-error a dice rule value names its die
  const noDie: RuleValue = { kind: 'dice', amount: 1 };
  // @ts-expect-error no kind beyond the closed list
  const unknown: RuleValue = { kind: 'speed', amount: 30 };
  // @ts-expect-error an amount is a number, rows or a formula
  const text: RuleValue = { kind: 'dice', die: 6, amount: '1d6' };
  expect([legal, noDie, unknown, text]).toHaveLength(4);
});
