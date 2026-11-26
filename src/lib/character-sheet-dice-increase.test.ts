// rotation-5 part D (stats-d1 follow-ups §1; design R/rotation-5/design-
// part-d.md): a `dice` rule value may carry an optional `key`, and a kind
// `diceIncrease { key, amount }` adds dice of the keyed value's die size per
// active copy or item, named in the number's sources; apart per key. A dice
// value without a key is exactly as before. Fixtures have the imported
// shape: the Cleric's Channel Energy (Foundry pf1/kXXz1lO4i7CibHJ9, tag
// `classFeat_channelEnergy`) with its reviewed increments at 3, 5 … 19, the
// Paladin's Channel Positive Energy (pf1/tHObxrPeyhimmz9V; Foundry gives it no
// tag, so the key here is the fixture's), and the Phylactery of Positive
// Channeling (pf1-content gggElRcxQr8jWGz8: "increase the amount of damage
// dealt to undead creatures by +2d6"; PCGen cr_equip_magic_items.lst:299
// adds 2 to the Cleric's and to the Paladin's channel dice).
import { expect, test } from 'vitest';
import {
  calculateCharacterSheet,
  calculateCharacterSheetProjections,
  ruleValueSchema,
  storedRuleValuesSchema,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
  type RuleValue,
  type SheetEntry,
} from './character-sheet';
import { ruleValueOutputSchema } from './catalog/curation-output-schema';
import { importedCatalogEntrySchema } from './catalog/imported-entry-schema';
import { getConditionDefinition } from './character-sheet-conditions';
import {
  baseClass,
  baseScores,
  classLevelSheet,
} from './character-sheet-rule-value-fixture';

const channelEnergy = 'pf1/kXXz1lO4i7CibHJ9';
const increments = [3, 5, 7, 9, 11, 13, 15, 17, 19];
const clericKey = 'classFeat_channelEnergy';
const paladinKey = 'classFeat_channelPositiveEnergy';

const phylactery = (
  increases: RuleValue[] = [
    { kind: 'diceIncrease', key: clericKey, amount: 2 },
    { kind: 'diceIncrease', key: paladinKey, amount: 2 },
  ],
): CharacterSheetCatalogEntry => ({
  _id: 'phylactery',
  ruleIdentity: 'pf1-content/gggElRcxQr8jWGz8',
  name: 'Phylactery of Positive Channeling',
  modifiers: [],
  detail: { kind: 'item' },
  ruleValues: increases,
});

function catalog({
  keyed = true,
  increases,
}: { keyed?: boolean; increases?: RuleValue[] } = {}) {
  const entries: CharacterSheetCatalogEntry[] = [
    baseScores(),
    baseClass('cleric', 'Cleric', [
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
      ruleValues: [
        {
          kind: 'dice',
          die: 6,
          amount: { rows: {} },
          ...(keyed ? { key: clericKey } : {}),
        },
      ],
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
    baseClass('paladin', 'Paladin', [
      { classLevel: 4, catalogEntryId: 'paladin-channel' },
    ]),
    {
      _id: 'paladin-channel',
      ruleIdentity: 'pf1/tHObxrPeyhimmz9V',
      name: 'Channel Positive Energy',
      modifiers: [],
      detail: { kind: 'classFeature' },
      ruleValues: [
        {
          kind: 'dice',
          die: 6,
          amount: { formula: 'ceil(@classLevel.paladin / 2)' },
          ...(keyed ? { key: paladinKey } : {}),
        },
      ],
    },
    phylactery(increases),
  ];
  return entries;
}

const held = (id = 'phylactery-row', active = true): SheetEntry =>
  ({
    _id: id,
    kind: 'item',
    active,
    catalogEntryId: 'phylactery',
    state: { kind: 'item' },
  }) as SheetEntry;

function sheet(
  levels: readonly ('cleric' | 'paladin')[],
  extra: SheetEntry[] = [],
  catalogEntries = catalog(),
): CharacterSheetInput {
  return classLevelSheet(levels, extra, catalogEntries);
}

const clerics = (count: number) =>
  Array.from({ length: count }, () => 'cleric' as const);
const paladins = (count: number) =>
  Array.from({ length: count }, () => 'paladin' as const);

const dice = (input: CharacterSheetInput) =>
  calculateCharacterSheet(input).featureNumbers.map(
    ({ count, die }) => `${count}d${die}`,
  );

test('a Cleric 8 holding the Phylactery channels 4d6 + 2d6 = 6d6, and the breakdown names it', () => {
  expect(dice(sheet(clerics(8)))).toEqual(['4d6']);
  const result = calculateCharacterSheet(sheet(clerics(8), [held()]));
  expect(result.featureNumbers).toEqual([
    expect.objectContaining({ kind: 'dice', count: 6, die: 6 }),
  ]);
  const sources = result.featureNumbers[0]?.sources.map(({ name }) => name);
  // The entry and its three active increments, then the item.
  expect(sources).toEqual([
    'Channel Energy',
    'Channel Energy 2d6',
    'Channel Energy 3d6',
    'Channel Energy 4d6',
    'Phylactery of Positive Channeling',
  ]);
  expect(result.featureNumbers[0]?.sources.at(-1)?.entryId).toBe(
    'phylactery-row',
  );
});

test('an item switched off adds nothing; each active copy adds once', () => {
  expect(dice(sheet(clerics(8), [held('off', false)]))).toEqual(['4d6']);
  expect(dice(sheet(clerics(8), [held('one'), held('two')]))).toEqual(['8d6']);
});

test('a dice value without a key is exactly as before: no increase reaches it', () => {
  const unkeyed = catalog({ keyed: false });
  const without = calculateCharacterSheet(sheet(clerics(8), [], unkeyed));
  const withItem = calculateCharacterSheet(
    sheet(clerics(8), [held()], unkeyed),
  );
  expect(withItem.featureNumbers).toEqual(without.featureNumbers);
  expect(withItem.warnings).toEqual(without.warnings);
});

test('increases stay apart per key: a Cleric 5 / Paladin 4', () => {
  const levels = [...clerics(5), ...paladins(4)];
  expect(dice(sheet(levels))).toEqual(['3d6', '2d6']);
  // The Phylactery's two increases (PCGen: one per class's dice).
  expect(dice(sheet(levels, [held()]))).toEqual(['5d6', '4d6']);
  // An increase of the Cleric's key alone.
  expect(
    dice(
      sheet(
        levels,
        [held()],
        catalog({
          increases: [{ kind: 'diceIncrease', key: clericKey, amount: 2 }],
        }),
      ),
    ),
  ).toEqual(['5d6', '2d6']);
});

test('an increase with no keyed value of its key gives nothing and no warning', () => {
  const result = calculateCharacterSheet(sheet([], [held()]));
  expect(result.featureNumbers).toEqual([]);
  expect(
    result.warnings.filter(({ subject }) => subject.startsWith('phylactery')),
  ).toEqual([]);
});

test('an increase by formula and by rows evaluates as a dice value does', () => {
  const levels = clerics(8);
  expect(
    dice(
      sheet(
        levels,
        [held()],
        catalog({
          increases: [
            {
              kind: 'diceIncrease',
              key: clericKey,
              amount: { formula: '1 + 1' },
            },
          ],
        }),
      ),
    ),
  ).toEqual(['6d6']);
  // `rows` counts the item's own rows: the item itself.
  expect(
    dice(
      sheet(
        levels,
        [held()],
        catalog({
          increases: [
            { kind: 'diceIncrease', key: clericKey, amount: { rows: {} } },
          ],
        }),
      ),
    ),
  ).toEqual(['5d6']);
});

test('both projections give the increase: an item is not a Temporary Effect', () => {
  const projections = calculateCharacterSheetProjections(
    sheet(clerics(8), [held()]),
  );
  for (const projection of [projections.current, projections.permanent])
    expect(projection.featureNumbers.map(({ count }) => count)).toEqual([6]);
});

test.each<[string, unknown, boolean]>([
  ['a keyed dice value', { kind: 'dice', die: 6, amount: 1, key: 'k' }, true],
  ['a dice value without a key', { kind: 'dice', die: 6, amount: 1 }, true],
  ['an increase', { kind: 'diceIncrease', key: 'k', amount: 2 }, true],
  [
    'an increase by formula',
    { kind: 'diceIncrease', key: 'k', amount: { formula: '2' } },
    true,
  ],
  ['an empty dice key', { kind: 'dice', die: 6, amount: 1, key: '' }, false],
  [
    'a dice key over 64 characters',
    { kind: 'dice', die: 6, amount: 1, key: 'k'.repeat(65) },
    false,
  ],
  ['an increase without a key', { kind: 'diceIncrease', amount: 2 }, false],
  [
    'an empty increase key',
    { kind: 'diceIncrease', key: '', amount: 2 },
    false,
  ],
  [
    'an increase key over 64 characters',
    { kind: 'diceIncrease', key: 'k'.repeat(65), amount: 2 },
    false,
  ],
  [
    'a negative increase',
    { kind: 'diceIncrease', key: 'k', amount: -2 },
    false,
  ],
  [
    'a fractional increase',
    { kind: 'diceIncrease', key: 'k', amount: 1.5 },
    false,
  ],
  [
    'an over-long formula',
    { kind: 'diceIncrease', key: 'k', amount: { formula: '1'.repeat(4097) } },
    false,
  ],
  [
    'an increase with its own die',
    { kind: 'diceIncrease', key: 'k', amount: 2, die: 8 },
    false,
  ],
  [
    'an increase with a condition',
    {
      kind: 'diceIncrease',
      key: 'k',
      amount: 1,
      condition: { situation: { local: 'no removable condition' } },
    },
    false,
  ],
])('the rule value schema takes %s: %j', (_, ruleValue, accepted) => {
  expect(ruleValueSchema.safeParse(ruleValue).success).toBe(accepted);
  expect(
    importedCatalogEntrySchema.shape.ruleValues.safeParse([ruleValue]).success,
  ).toBe(accepted);
  // A rule-value record's output (curation kind `ruleValue`).
  expect(
    ruleValueOutputSchema.safeParse({ kind: 'ruleValue', ruleValue }).success,
  ).toBe(accepted);
});

test('an entry stored before keys reads as before: parsing adds no key', () => {
  const stored = [{ kind: 'dice', die: 6, amount: { rows: {} } }];
  expect(storedRuleValuesSchema.parse(stored)).toEqual(stored);
  expect(Object.keys(storedRuleValuesSchema.parse(stored)[0] ?? {})).toEqual([
    'kind',
    'die',
    'amount',
  ]);
});

test('a dice increase is a discriminated variant', () => {
  const legal: RuleValue[] = [
    { kind: 'dice', die: 6, amount: 1, key: 'k' },
    { kind: 'diceIncrease', key: 'k', amount: { rows: {} } },
  ];
  // @ts-expect-error an increase names its key
  const noKey: RuleValue = { kind: 'diceIncrease', amount: 1 };
  const ownDie: RuleValue = {
    kind: 'diceIncrease',
    key: 'k',
    amount: 1,
    // @ts-expect-error an increase takes its keyed value's die
    die: 6,
  };
  expect([legal, noKey, ownDie]).toHaveLength(3);
});

// fix r1 (finding 2): an increase adds per active copy of its entry and
// raises another entry's dice, so one entry's rule values carry no two
// increases of one key and name none of their own dice's keys. Refused at
// every write; the stored schema is what each write parses.
const repeated: RuleValue[] = [
  { kind: 'diceIncrease', key: clericKey, amount: 2 },
  { kind: 'diceIncrease', key: clericKey, amount: 2 },
];
const ownDice: RuleValue[] = [
  { kind: 'dice', die: 6, amount: 3, key: clericKey },
  { kind: 'diceIncrease', key: clericKey, amount: 2 },
];
test.each<[string, RuleValue[], string]>([
  // The reviewers' inputs: a duplicated output, an increase beside its dice.
  [
    'two increases of one key',
    repeated,
    `An entry increases the dice of ${clericKey} once; this one repeats it.`,
  ],
  [
    'an increase to its own entry’s dice',
    ownDice,
    `A dice increase raises another entry’s dice; ${clericKey} is this entry’s own.`,
  ],
  // Two more of the same shape.
  [
    'two increases of one key with other amounts',
    [
      { kind: 'diceIncrease', key: paladinKey, amount: 2 },
      { kind: 'diceIncrease', key: clericKey, amount: 1 },
      { kind: 'diceIncrease', key: paladinKey, amount: { formula: '1' } },
    ],
    `An entry increases the dice of ${paladinKey} once; this one repeats it.`,
  ],
  [
    'an increase listed before its own entry’s rows-counted dice',
    [
      { kind: 'diceIncrease', key: clericKey, amount: { formula: '2' } },
      { kind: 'dice', die: 6, amount: { rows: {} }, key: clericKey },
    ],
    `A dice increase raises another entry’s dice; ${clericKey} is this entry’s own.`,
  ],
])('one entry’s rule values with %s are refused', (_, ruleValues, reason) => {
  const parsed = storedRuleValuesSchema.safeParse(ruleValues);
  expect(parsed.success).toBe(false);
  expect(parsed.error?.issues.map(({ message }) => message)).toEqual([reason]);
  // Release staging, discovery and candidate reads.
  expect(
    importedCatalogEntrySchema.shape.ruleValues.safeParse(ruleValues).success,
  ).toBe(false);
});

test('increases of two keys on one entry, the same key in another kind, and unkeyed dice repeated are stored', () => {
  for (const ruleValues of [
    // The Phylactery's two increases (PCGen: one per class's dice).
    phylactery().ruleValues ?? [],
    [
      { kind: 'dailyMaximumIncrease', key: clericKey, amount: 2 },
      { kind: 'diceIncrease', key: clericKey, amount: 2 },
    ],
    [
      { kind: 'dice', die: 6, amount: 1 },
      { kind: 'dice', die: 6, amount: 1 },
    ],
  ] satisfies (readonly RuleValue[])[])
    expect(storedRuleValuesSchema.safeParse(ruleValues).success).toBe(true);
});

test('a dice increase on another entry of the same key still adds: the Phylactery beside Channel Energy', () => {
  expect(dice(sheet(clerics(8), [held()]))).toEqual(['6d6']);
});

// fix r1 (finding 3): an increase is evaluated only once a keyed dice value
// of its key is on the sheet, and only while its entry counts. One with no
// matching value warns nothing; a suppressed one is never evaluated; one
// whose amount does not resolve warns on its own line and leaves the dice
// as they would be without it. Fixtures add the sheet's Grappled and Pinned
// Conditions (Pinned replaces Grappled) and a focus item.
const condition = (
  conditionKey: 'grappled' | 'pinned',
  ruleValues?: RuleValue[],
): CharacterSheetCatalogEntry => ({
  _id: conditionKey,
  ruleIdentity: getConditionDefinition(conditionKey).ruleIdentity,
  name: conditionKey === 'grappled' ? 'Grappled' : 'Pinned',
  modifiers: [],
  detail: { kind: 'condition', conditionKey },
  ...(ruleValues ? { ruleValues } : {}),
});
const focus = (
  amount: RuleValue['amount'],
  key = clericKey,
): CharacterSheetCatalogEntry => ({
  _id: 'focus',
  ruleIdentity: 'fixture/channeling-focus',
  name: 'Channeling focus',
  modifiers: [],
  detail: { kind: 'item' },
  ruleValues: [{ kind: 'diceIncrease', key, amount }],
});
const affected = (conditionKey: 'grappled' | 'pinned'): SheetEntry =>
  ({
    _id: `${conditionKey}-row`,
    kind: 'condition',
    active: true,
    catalogEntryId: conditionKey,
    state: { kind: 'condition' },
  }) as SheetEntry;
const focusRow = {
  _id: 'focus-row',
  kind: 'item',
  active: true,
  catalogEntryId: 'focus',
  state: { kind: 'item' },
} as SheetEntry;
const numbers = (input: CharacterSheetInput) => {
  const result = calculateCharacterSheet(input);
  return {
    dice: result.featureNumbers.map(({ count, die, sources }) => ({
      count,
      die,
      sources: sources.map(({ name }) => name),
    })),
    ruleValueWarnings: result.warnings
      .filter(({ subject }) => subject.includes(':ruleValue:'))
      .map(({ subject, check }) => `${subject} ${check}`),
  };
};
const clericChannel = [
  'Channel Energy',
  'Channel Energy 2d6',
  'Channel Energy 3d6',
  'Channel Energy 4d6',
];

test.each<[string, CharacterSheetEntries]>([
  // The reviewers' input: a focus by caster level, no channel on the sheet.
  ['no dice at all', { levels: [], amount: { formula: '@casterLevel' } }],
  // Two more of the same shape.
  [
    'a typo in its formula, only unkeyed dice on the sheet',
    { levels: clerics(8), amount: { formula: '@unknown' }, keyed: false },
  ],
  [
    'another key than the sheet’s keyed dice',
    { levels: clerics(8), amount: { formula: '@unknown' }, key: paladinKey },
  ],
])(
  'an increase with no matching keyed dice gives nothing and warns nothing: %s',
  (_, { levels, amount, keyed = true, key }) => {
    const entries = [
      ...catalog({ keyed }).filter(({ _id }) => _id !== 'phylactery'),
      focus(amount, key),
    ];
    const without = numbers(sheet(levels, [], entries));
    expect(numbers(sheet(levels, [focusRow], entries))).toEqual(without);
    expect(without.ruleValueWarnings).toEqual([]);
  },
);
type CharacterSheetEntries = {
  levels: readonly ('cleric' | 'paladin')[];
  amount: RuleValue['amount'];
  keyed?: boolean;
  key?: string;
};

test('a suppressed increase is never evaluated: the reviewers’ Grappled under Pinned leaves 4d6 and warns nothing', () => {
  const entries = [
    ...catalog(),
    condition('grappled', [
      {
        kind: 'diceIncrease',
        key: clericKey,
        amount: { formula: '@casterLevel' },
      },
    ]),
    condition('pinned'),
  ];
  expect(
    numbers(
      sheet(clerics(8), [affected('grappled'), affected('pinned')], entries),
    ),
  ).toEqual({
    dice: [{ count: 4, die: 6, sources: clericChannel }],
    ruleValueWarnings: [],
  });
});

test('an increase whose amount does not resolve warns on its own line and leaves the dice as without it', () => {
  const entries = [...catalog(), focus({ formula: '@unknown' })];
  expect(numbers(sheet(clerics(8), [focusRow], entries))).toEqual({
    dice: [{ count: 4, die: 6, sources: clericChannel }],
    ruleValueWarnings: ['focus-row:ruleValue:0 unsupportedFormula'],
  });
  // Beside an increase that resolves: that one still adds.
  expect(numbers(sheet(clerics(8), [focusRow, held()], entries))).toEqual({
    dice: [
      {
        count: 6,
        die: 6,
        sources: [...clericChannel, 'Phylactery of Positive Channeling'],
      },
    ],
    ruleValueWarnings: ['focus-row:ruleValue:0 unsupportedFormula'],
  });
});

test('an increase on a suppressed base: the replaced Condition’s dice give no number, and the unresolved focus warns nothing', () => {
  const entries = [
    ...catalog(),
    condition('grappled', [
      { kind: 'dice', die: 6, amount: 2, key: 'grappleDice' },
    ]),
    condition('pinned'),
    focus({ formula: '@unknown' }, 'grappleDice'),
  ];
  expect(
    numbers(
      sheet([], [affected('grappled'), affected('pinned'), focusRow], entries),
    ),
  ).toEqual({ dice: [], ruleValueWarnings: [] });
  // Grappled alone counts: the focus is evaluated and warns.
  expect(numbers(sheet([], [affected('grappled'), focusRow], entries))).toEqual(
    {
      dice: [{ count: 2, die: 6, sources: ['Grappled'] }],
      ruleValueWarnings: ['focus-row:ruleValue:0 unsupportedFormula'],
    },
  );
});

test('two increases from two entries, one suppressed: only the counting one adds and is named', () => {
  const entries = [
    ...catalog(),
    condition('grappled', [
      { kind: 'diceIncrease', key: clericKey, amount: 1 },
    ]),
    condition('pinned'),
  ];
  expect(
    numbers(
      sheet(
        clerics(8),
        [held(), affected('grappled'), affected('pinned')],
        entries,
      ),
    ),
  ).toEqual({
    dice: [
      {
        count: 6,
        die: 6,
        sources: [...clericChannel, 'Phylactery of Positive Channeling'],
      },
    ],
    ruleValueWarnings: [],
  });
});

// fix r1 (finding 4): the number lists each increase that added, with its
// count, for the row's breakdown; an unresolved one is not listed.
test('the dice list each increase that added, with its count', () => {
  const entries = [...catalog(), focus({ formula: '@unknown' })];
  const [number] = calculateCharacterSheet(
    sheet(clerics(8), [held('one'), held('two'), focusRow], entries),
  ).featureNumbers;
  expect(number).toMatchObject({
    count: 8,
    increases: [
      { entryId: 'one', name: 'Phylactery of Positive Channeling', count: 2 },
      { entryId: 'two', name: 'Phylactery of Positive Channeling', count: 2 },
    ],
  });
  expect(
    calculateCharacterSheet(sheet(clerics(8))).featureNumbers[0],
  ).not.toHaveProperty('increases');
});

// fix r2 (finding 1): suppression is decided before a keyed die's formula is
// evaluated, so a suppressed keyed die evaluates nothing and is no match: an
// increase of its key is never evaluated and warns nothing.
test.each<[string, RuleValue['amount'], RuleValue['amount']]>([
  // The reviewers' input: a typo in Grappled's keyed dice under Pinned.
  ['a typo in both formulas', { formula: '@unknwon' }, { formula: '@unknown' }],
  // Two more of the same shape.
  ['a die by caster level', { formula: '@casterLevel' }, 1],
  ['a malformed formula', { formula: '2 +' }, { formula: '@casterLevel' }],
])(
  'a suppressed keyed die with %s evaluates nothing and matches no increase',
  (_, baseAmount, focusAmount) => {
    const entries = [
      ...catalog(),
      condition('grappled', [
        { kind: 'dice', die: 6, amount: baseAmount, key: 'grappleDice' },
      ]),
      condition('pinned'),
      focus(focusAmount, 'grappleDice'),
    ];
    expect(
      numbers(
        sheet(
          [],
          [affected('grappled'), affected('pinned'), focusRow],
          entries,
        ),
      ),
    ).toEqual({ dice: [], ruleValueWarnings: [] });
  },
);

// fix r2 (finding 2): while the base dice do not resolve, the row shows the
// base as unresolved with its own warning and no increase as applied: the
// breakdown lists an increase only once it adds (`increases`, present once
// any adds), and none adds to dice with no count.
const grappleDice = (amount: RuleValue['amount']) =>
  condition('grappled', [{ kind: 'dice', die: 6, amount, key: 'grappleDice' }]);
const unresolvedGrappleDice = {
  count: null,
  die: 6,
  sources: ['Grappled'],
};
test.each<[string, CharacterSheetCatalogEntry[], SheetEntry[]]>([
  // The reviewers' input: an unresolved die beside a resolved focus.
  ['a resolved focus', [focus(2, 'grappleDice')], [focusRow]],
  // Two more of the same shape.
  [
    'two resolved increases from two entries',
    [
      focus(2, 'grappleDice'),
      phylactery([{ kind: 'diceIncrease', key: 'grappleDice', amount: 1 }]),
    ],
    [focusRow, held()],
  ],
  [
    'a focus by formula',
    [focus({ formula: '1 + 1' }, 'grappleDice')],
    [focusRow],
  ],
])(
  'an unresolved die shows no increase as applied: %s',
  (_, increasing, rows) => {
    const entries = [
      baseScores(),
      grappleDice({ formula: '@unknown' }),
      ...increasing,
    ];
    const result = calculateCharacterSheet(
      sheet([], [affected('grappled'), ...rows], entries),
    );
    expect(result.featureNumbers).toEqual([
      {
        kind: 'dice',
        entryId: 'grappled-row',
        ruleValueIndex: 0,
        count: null,
        die: 6,
        sources: [{ entryId: 'grappled-row', name: 'Grappled' }],
      },
    ]);
    expect(
      numbers(sheet([], [affected('grappled'), ...rows], entries)),
    ).toEqual({
      dice: [unresolvedGrappleDice],
      ruleValueWarnings: ['grappled-row:ruleValue:0 unsupportedFormula'],
    });
  },
);
