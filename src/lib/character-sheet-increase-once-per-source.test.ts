// rotation-6 part S (design ORCH/research/rotation-6-design.md §3 (a), with
// root's change of 2026-11-20: opt-in, not the default): an increase that
// carries `oncePerSource: true` counts once per Source. Among the active
// increases of one kind and key that carry it and share a Source (the entry's
// `sourceKey`, else its rule identity, as stacking uses), only the largest
// adds; an increase without it adds per copy, exactly as before. Fixtures
// have the imported shape and are test fixtures only: Foundry
// lay-on-hands.WhE4j0Jc82npdMCP (`floor(@classLevel.paladin / 2) +
// @ability.cha.mod` uses), pf1-content Bracelet_of_Mercy_Oc7OD2tstGYyEvec
// (+1 use while worn), Extra Lay On Hands (+2 per copy), Bardic Performance
// with Extra Performance (+6 rounds per copy), and the Phylactery of
// Positive Channeling's +2d6. No committed record carries the field.
import { expect, test } from 'vitest';
import {
  calculateCharacterSheet,
  ruleValueSchema,
  storedRuleValuesSchema,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
  type RuleValue,
  type SheetEntry,
} from './character-sheet';
import { ruleValueOutputSchema } from './catalog/curation-output-schema';
import { importedCatalogEntrySchema } from './catalog/imported-entry-schema';
import {
  baseClass,
  baseScores,
  classLevelSheet,
} from './character-sheet-rule-value-fixture';

const layOnHands = 'classFeat_layOnHands';
const performance = 'classFeat_bardicPerformance';
const channel = 'classFeat_channelEnergy';

const entry = ({
  _id,
  name,
  ruleValues,
  ...fields
}: {
  _id: string;
  name: string;
  ruleValues: readonly RuleValue[];
} & Partial<CharacterSheetCatalogEntry>): CharacterSheetCatalogEntry => ({
  _id,
  ruleIdentity: `fixture/${_id}`,
  name,
  modifiers: [],
  detail: { kind: 'item' },
  ruleValues,
  ...fields,
});

const bracelet = (
  fields: Partial<CharacterSheetCatalogEntry> = {},
  amount: RuleValue['amount'] = 1,
) =>
  entry({
    _id: 'bracelet',
    name: 'Bracelet of Mercy',
    ruleValues: [
      {
        kind: 'dailyMaximumIncrease',
        key: layOnHands,
        amount,
        oncePerSource: true,
      },
    ],
    ruleIdentity: 'pf1-content/Oc7OD2tstGYyEvec',
    ...fields,
  });

function catalog(extra: CharacterSheetCatalogEntry[] = []) {
  return [
    baseScores(),
    baseClass('paladin', 'Paladin', [
      { classLevel: 2, catalogEntryId: 'lay-on-hands' },
    ]),
    baseClass('bard', 'Bard', [
      { classLevel: 1, catalogEntryId: 'bardic-performance' },
    ]),
    baseClass('cleric', 'Cleric', [
      { classLevel: 1, catalogEntryId: 'channel-energy' },
    ]),
    entry({
      _id: 'lay-on-hands',
      name: 'Lay on Hands',
      ruleValues: [
        {
          kind: 'dailyMaximum',
          key: layOnHands,
          unit: 'uses',
          amount: {
            formula: 'floor(@classLevel.paladin / 2) + @ability.cha.mod',
          },
        },
      ],
      ruleIdentity: 'pf1/WhE4j0Jc82npdMCP',
      detail: { kind: 'classFeature' },
    }),
    entry({
      _id: 'bardic-performance',
      name: 'Bardic Performance',
      ruleValues: [
        {
          kind: 'dailyMaximum',
          key: performance,
          unit: 'rounds',
          amount: {
            formula: '4 + @ability.cha.mod + 2 * (@classLevel.bard - 1)',
          },
        },
      ],
      detail: { kind: 'classFeature' },
    }),
    entry({
      _id: 'channel-energy',
      name: 'Channel Energy',
      ruleValues: [{ kind: 'dice', die: 6, amount: 1, key: channel }],
      ruleIdentity: 'pf1/kXXz1lO4i7CibHJ9',
      detail: { kind: 'classFeature' },
    }),
    entry({
      _id: 'extra-lay-on-hands',
      name: 'Extra Lay On Hands',
      ruleValues: [
        { kind: 'dailyMaximumIncrease', key: layOnHands, amount: 2 },
      ],
      detail: { kind: 'feat', repeatable: 'yes' },
    }),
    entry({
      _id: 'extra-performance',
      name: 'Extra Performance',
      ruleValues: [
        { kind: 'dailyMaximumIncrease', key: performance, amount: 6 },
      ],
      detail: { kind: 'feat', repeatable: 'yes' },
    }),
    entry({
      _id: 'phylactery',
      name: 'Phylactery of Positive Channeling',
      ruleValues: [
        { kind: 'diceIncrease', key: channel, amount: 2, oncePerSource: true },
      ],
    }),
    bracelet(),
    ...extra,
  ];
}

const row = (
  _id: string,
  catalogEntryId: string,
  kind: 'item' | 'feat' = 'item',
): SheetEntry =>
  ({
    _id,
    kind,
    active: true,
    catalogEntryId,
    state: { kind },
  }) as SheetEntry;

const levels = (className: string, count: number) =>
  Array.from({ length: count }, () => className);

function sheet(
  classes: readonly string[],
  rows: SheetEntry[],
  extra: CharacterSheetCatalogEntry[] = [],
): CharacterSheetInput {
  return classLevelSheet(classes, rows, catalog(extra));
}

const maxima = (input: CharacterSheetInput) =>
  calculateCharacterSheet(input).dailyMaxima.map(({ key, value, sources }) => ({
    key,
    value,
    sources: sources.map(({ name }) => name),
  }));

test('two Bracelets of Mercy give one increase: a Paladin 4 lays on hands 2 + 1 = 3 times, not 4', () => {
  expect(
    maxima(
      sheet(levels('paladin', 4), [
        row('bracelet-1', 'bracelet'),
        row('bracelet-2', 'bracelet'),
      ]),
    ),
  ).toEqual([
    {
      key: layOnHands,
      value: 3,
      sources: ['Lay on Hands', 'Bracelet of Mercy'],
    },
  ]);
});

test('one Bracelet of Mercy adds its 1 as before', () => {
  expect(
    maxima(sheet(levels('paladin', 4), [row('bracelet-1', 'bracelet')])),
  ).toEqual([
    {
      key: layOnHands,
      value: 3,
      sources: ['Lay on Hands', 'Bracelet of Mercy'],
    },
  ]);
});

test('two copies of an Extra-Performance-like feat without the field add twice, exactly as before: a Bard 3 performs 8 + 12 = 20 rounds', () => {
  expect(
    maxima(
      sheet(levels('bard', 3), [
        row('feat-1', 'extra-performance', 'feat'),
        row('feat-2', 'extra-performance', 'feat'),
      ]),
    ),
  ).toEqual([
    {
      key: performance,
      value: 20,
      sources: ['Bardic Performance', 'Extra Performance', 'Extra Performance'],
    },
  ]);
});

test('mixed: two Bracelets count once beside two Extra Lay On Hands copies that each add: 2 + 1 + 2 + 2 = 7', () => {
  expect(
    maxima(
      sheet(levels('paladin', 4), [
        row('bracelet-1', 'bracelet'),
        row('feat-1', 'extra-lay-on-hands', 'feat'),
        row('bracelet-2', 'bracelet'),
        row('feat-2', 'extra-lay-on-hands', 'feat'),
      ]),
    ),
  ).toEqual([
    {
      key: layOnHands,
      value: 7,
      sources: [
        'Lay on Hands',
        'Bracelet of Mercy',
        'Extra Lay On Hands',
        'Extra Lay On Hands',
      ],
    },
  ]);
});

test('an increase without the field shares no group with one that carries it, even of the same Source', () => {
  // A homebrew copy of the Bracelet (its rule identity kept) without the
  // field adds per copy; the two that carry it still count once.
  const plain = {
    ...bracelet({ _id: 'plain-bracelet', name: 'Plain bracelet' }),
    ruleValues: [
      { kind: 'dailyMaximumIncrease', key: layOnHands, amount: 1 },
    ] satisfies RuleValue[],
  };
  expect(
    maxima(
      sheet(
        levels('paladin', 4),
        [
          row('bracelet-1', 'bracelet'),
          row('bracelet-2', 'bracelet'),
          row('plain-1', 'plain-bracelet'),
        ],
        [plain],
      ),
    ),
  ).toEqual([
    {
      key: layOnHands,
      value: 4,
      sources: ['Lay on Hands', 'Bracelet of Mercy', 'Plain bracelet'],
    },
  ]);
});

test('a Catalog Copy keeps its original’s Source, and the larger of the two counts whichever comes first', () => {
  // A Character's copy of the Bracelet edited to give 3: same rule identity.
  const copy = bracelet({ _id: 'bracelet-copy', name: 'My bracelet' }, 3);
  for (const order of [
    ['bracelet', 'bracelet-copy'],
    ['bracelet-copy', 'bracelet'],
  ])
    expect(
      maxima(
        sheet(
          levels('paladin', 4),
          order.map((id, index) => row(`row-${index}`, id)),
          [copy],
        ),
      ),
    ).toEqual([
      { key: layOnHands, value: 5, sources: ['Lay on Hands', 'My bracelet'] },
    ]);
});

test('two entries sharing a sourceKey count once; two of different Sources each add', () => {
  const shared = bracelet({
    _id: 'other-bracelet',
    name: 'Other bracelet',
    ruleIdentity: 'fixture/other-bracelet',
    sourceKey: 'mercy',
  });
  const sourced = bracelet({ sourceKey: 'mercy' });
  expect(
    maxima(
      sheet(
        levels('paladin', 4),
        [row('a', 'bracelet'), row('b', 'other-bracelet')],
        [shared, sourced],
      ),
    ),
  ).toEqual([
    {
      key: layOnHands,
      value: 3,
      sources: ['Lay on Hands', 'Bracelet of Mercy'],
    },
  ]);
  expect(
    maxima(
      sheet(
        levels('paladin', 4),
        [row('a', 'bracelet'), row('b', 'other-bracelet')],
        [shared],
      ),
    ),
  ).toEqual([
    {
      key: layOnHands,
      value: 4,
      sources: ['Lay on Hands', 'Bracelet of Mercy', 'Other bracelet'],
    },
  ]);
});

test('an item switched off is not counting, so the other copy adds', () => {
  const off = { ...row('bracelet-1', 'bracelet'), active: false } as SheetEntry;
  expect(
    maxima(sheet(levels('paladin', 4), [off, row('bracelet-2', 'bracelet')])),
  ).toEqual([
    {
      key: layOnHands,
      value: 3,
      sources: ['Lay on Hands', 'Bracelet of Mercy'],
    },
  ]);
});

test('two Phylacteries carrying the field add +2d6 once to a Cleric’s keyed channel dice', () => {
  const result = calculateCharacterSheet(
    sheet(
      ['cleric'],
      [row('phylactery-1', 'phylactery'), row('phylactery-2', 'phylactery')],
    ),
  );
  expect(
    result.featureNumbers.map(({ count, die, sources }) => ({
      dice: `${count}d${die}`,
      sources: sources.map(({ name }) => name),
    })),
  ).toEqual([
    {
      dice: '3d6',
      sources: ['Channel Energy', 'Phylactery of Positive Channeling'],
    },
  ]);
});

test('the field is an increase’s alone: every other kind, and any value but true, is refused by the rule value, stored, imported and curation output schemas', () => {
  const refused: unknown[] = [
    {
      kind: 'dailyMaximumIncrease',
      key: layOnHands,
      amount: 1,
      oncePerSource: false,
    },
    { kind: 'diceIncrease', key: channel, amount: 1, oncePerSource: 'yes' },
    {
      kind: 'dailyMaximum',
      key: layOnHands,
      unit: 'uses',
      amount: 1,
      oncePerSource: true,
    },
    { kind: 'dice', die: 6, amount: 1, oncePerSource: true },
    { kind: 'damageReduction', amount: 1, bypass: '-', oncePerSource: true },
    { kind: 'spellResistance', amount: 1, oncePerSource: true },
  ];
  for (const ruleValue of refused) {
    expect(ruleValueSchema.safeParse(ruleValue).success).toBe(false);
    expect(storedRuleValuesSchema.safeParse([ruleValue]).success).toBe(false);
    expect(
      importedCatalogEntrySchema.shape.ruleValues.safeParse([ruleValue])
        .success,
    ).toBe(false);
    expect(
      ruleValueOutputSchema.safeParse({ kind: 'ruleValue', ruleValue }).success,
    ).toBe(false);
  }
  for (const ruleValue of [
    {
      kind: 'dailyMaximumIncrease',
      key: layOnHands,
      amount: 1,
      oncePerSource: true,
    },
    { kind: 'diceIncrease', key: channel, amount: 2, oncePerSource: true },
  ]) {
    expect(storedRuleValuesSchema.safeParse([ruleValue]).success).toBe(true);
    expect(
      ruleValueOutputSchema.safeParse({ kind: 'ruleValue', ruleValue }).success,
    ).toBe(true);
  }
});

// Fix r1 (both reviews, finding 2): an unresolved copy is not compared, and
// with a resolved copy of its Source beside it, that one adds and the
// unresolved one is not counted (its formula still warns). This replaces
// rotation-6's expectation that the maximum read unresolved, which was
// wrong: only the largest resolved one adds.
const brokenBracelet = (formula = '1 + @unknown') =>
  bracelet({ _id: 'broken-bracelet', name: 'Broken bracelet' }, { formula });

function readLayOnHands(
  rows: SheetEntry[],
  extra: CharacterSheetCatalogEntry[],
) {
  const result = calculateCharacterSheet(
    sheet(levels('paladin', 4), rows, extra),
  );
  return {
    maxima: result.dailyMaxima.map(({ value, sources, notCounted }) => ({
      value,
      sources: sources.map(({ name }) => name),
      ...(notCounted ? { notCounted } : {}),
    })),
    formulaWarnings: result.warnings
      .filter(({ subject }) => subject.includes(':ruleValue:'))
      .map(({ subject }) => subject),
  };
}

const notCountedBroken = (counted: string) => ({
  entryId: 'b',
  name: 'Broken bracelet',
  reason: 'sameSource',
  counted: { entryId: counted, name: 'Bracelet of Mercy' },
});

test('an unresolved copy beside a resolved one of its Source is not counted: a Paladin 4 lays on hands 2 + 1 = 3 times, and the copy warns', () => {
  expect(
    readLayOnHands(
      [row('a', 'bracelet'), row('b', 'broken-bracelet')],
      [brokenBracelet()],
    ),
  ).toEqual({
    maxima: [
      {
        value: 3,
        sources: ['Lay on Hands', 'Bracelet of Mercy'],
        notCounted: [notCountedBroken('a')],
      },
    ],
    formulaWarnings: ['b:ruleValue:0'],
  });
});

test('an unresolved copy first in sheet order is not counted either: 3', () => {
  expect(
    readLayOnHands(
      [row('b', 'broken-bracelet'), row('a', 'bracelet')],
      [brokenBracelet()],
    ),
  ).toEqual({
    maxima: [
      {
        value: 3,
        sources: ['Lay on Hands', 'Bracelet of Mercy'],
        notCounted: [notCountedBroken('a')],
      },
    ],
    formulaWarnings: ['b:ruleValue:0'],
  });
});

test('beside a larger resolved copy and a smaller one, an unresolved copy is not counted: 2 + 3 = 5', () => {
  const larger = bracelet({ _id: 'larger', name: 'Larger bracelet' }, 3);
  expect(
    readLayOnHands(
      [row('a', 'bracelet'), row('b', 'broken-bracelet'), row('c', 'larger')],
      [brokenBracelet(), larger],
    ).maxima,
  ).toEqual([
    {
      value: 5,
      sources: ['Lay on Hands', 'Larger bracelet'],
      notCounted: [
        {
          entryId: 'a',
          name: 'Bracelet of Mercy',
          reason: 'sameSource',
          counted: { entryId: 'c', name: 'Larger bracelet' },
        },
        {
          entryId: 'b',
          name: 'Broken bracelet',
          reason: 'sameSource',
          counted: { entryId: 'c', name: 'Larger bracelet' },
        },
      ],
    },
  ]);
});

test('with every copy of a Source unresolved, the first counts, so the maximum is unresolved, and the others are not counted', () => {
  // One of them adds and none has a number, so the total has none either.
  const other = bracelet(
    { _id: 'other-broken', name: 'Other broken bracelet' },
    { formula: '2 + @unknown' },
  );
  expect(
    readLayOnHands(
      [row('b', 'broken-bracelet'), row('c', 'other-broken')],
      [brokenBracelet(), other],
    ),
  ).toEqual({
    maxima: [
      {
        value: null,
        sources: ['Lay on Hands', 'Broken bracelet'],
        notCounted: [
          {
            entryId: 'c',
            name: 'Other broken bracelet',
            reason: 'sameSource',
            counted: { entryId: 'b', name: 'Broken bracelet' },
          },
        ],
      },
    ],
    formulaWarnings: ['b:ruleValue:0', 'c:ruleValue:0'],
  });
});

test('an unresolved increase without the field still leaves the maximum unresolved, as before', () => {
  const broken = entry({
    _id: 'broken-feat',
    name: 'Broken feat',
    ruleValues: [
      {
        kind: 'dailyMaximumIncrease',
        key: layOnHands,
        amount: { formula: '1 + @unknown' },
      },
    ],
    detail: { kind: 'feat', repeatable: 'yes' },
  });
  expect(
    readLayOnHands(
      [row('a', 'bracelet'), row('b', 'broken-feat', 'feat')],
      [broken],
    ),
  ).toEqual({
    maxima: [
      {
        value: null,
        sources: ['Lay on Hands', 'Bracelet of Mercy', 'Broken feat'],
      },
    ],
    formulaWarnings: ['b:ruleValue:0'],
  });
});

test('an unresolved Phylactery copy adds nothing and the resolved one adds, as an unresolved dice increase does', () => {
  const broken = entry({
    _id: 'broken-phylactery',
    name: 'Broken phylactery',
    ruleValues: [
      {
        kind: 'diceIncrease',
        key: channel,
        amount: { formula: '2 + @unknown' },
        oncePerSource: true,
      },
    ],
    ruleIdentity: 'fixture/phylactery',
  });
  const result = calculateCharacterSheet(
    sheet(
      ['cleric'],
      [row('a', 'broken-phylactery'), row('b', 'phylactery')],
      [broken],
    ),
  );
  expect(result.featureNumbers.map(({ count }) => count)).toEqual([3]);
  expect(
    result.warnings
      .filter(({ subject }) => subject.includes(':ruleValue:'))
      .map(({ subject }) => subject),
  ).toEqual(['a:ruleValue:0']);
});

test('the unresolved Phylactery copy is listed as not counted on the dice the resolved one raises', () => {
  const broken = entry({
    _id: 'broken-phylactery',
    name: 'Broken phylactery',
    ruleValues: [
      {
        kind: 'diceIncrease',
        key: channel,
        amount: { formula: '2 + @unknown' },
        oncePerSource: true,
      },
    ],
    ruleIdentity: 'fixture/phylactery',
  });
  expect(
    calculateCharacterSheet(
      sheet(
        ['cleric'],
        [row('a', 'broken-phylactery'), row('b', 'phylactery')],
        [broken],
      ),
    ).featureNumbers.map(({ count, notCounted }) => ({ count, notCounted })),
  ).toEqual([
    {
      count: 3,
      notCounted: [
        {
          entryId: 'a',
          name: 'Broken phylactery',
          reason: 'sameSource',
          counted: { entryId: 'b', name: 'Phylactery of Positive Channeling' },
        },
      ],
    },
  ]);
});

// Fix r2 (both reviews, finding 4): with every copy of a Source unresolved
// the two kinds differ. A per-day maximum's counted copy has no number, so
// the maximum has none (above); an unresolved once-per-Source group adds no
// dice; a resolved base still receives the other increases that count under
// the usual rules (once per Source where marked; fix r4, below), and each
// copy warns on its own line. rotation-6 fix r7: the first copy is the
// selected one, which adds nothing either, and the second's line points to
// it.
test('with every Phylactery copy unresolved the group adds no dice, so the base alone gives 1d6, each copy warns, and the second is listed as not counted, pointing to the first, the selected copy', () => {
  const broken = (id: string, name: string) =>
    entry({
      _id: id,
      name,
      ruleValues: [
        {
          kind: 'diceIncrease',
          key: channel,
          amount: { formula: '2 + @unknown' },
          oncePerSource: true,
        },
      ],
      ruleIdentity: 'fixture/phylactery',
    });
  const result = calculateCharacterSheet(
    sheet(
      ['cleric'],
      [row('a', 'broken-a'), row('b', 'broken-b')],
      [
        broken('broken-a', 'Broken phylactery'),
        broken('broken-b', 'Other broken phylactery'),
      ],
    ),
  );
  expect(
    result.featureNumbers.map(({ count, die, sources, notCounted }) => ({
      dice: `${count}d${die}`,
      sources: sources.map(({ name }) => name),
      notCounted,
    })),
  ).toEqual([
    {
      dice: '1d6',
      sources: ['Channel Energy'],
      notCounted: [
        {
          entryId: 'b',
          name: 'Other broken phylactery',
          reason: 'sameSource',
          counted: { entryId: 'a', name: 'Broken phylactery' },
        },
      ],
    },
  ]);
  expect(
    result.warnings
      .filter(({ subject }) => subject.includes(':ruleValue:'))
      .map(({ subject }) => subject),
  ).toEqual(['a:ruleValue:0', 'b:ruleValue:0']);
});

// rotation-6 fix r4 (Spec r4 finding 2, the reviewer's probe first): an
// unresolved group leaves the other dice increases of its key counted.
test('an unresolved once-per-Source group adds no dice while an independent resolved increase still counts: 1d6 + 2d6 = 3d6', () => {
  const broken = entry({
    _id: 'broken',
    name: 'Broken source',
    ruleValues: [
      {
        kind: 'diceIncrease',
        key: channel,
        amount: { formula: '2 + @unknown' },
        oncePerSource: true,
      },
    ],
  });
  const independent = entry({
    _id: 'independent',
    name: 'Independent source',
    ruleValues: [{ kind: 'diceIncrease', key: channel, amount: 2 }],
  });
  const result = calculateCharacterSheet(
    sheet(
      ['cleric'],
      [row('a', 'broken'), row('b', 'broken'), row('c', 'independent')],
      [broken, independent],
    ),
  );
  expect(
    result.featureNumbers.map(({ count, die, sources }) => ({
      dice: `${count}d${die}`,
      sources: sources.map(({ name }) => name),
    })),
  ).toEqual([
    { dice: '3d6', sources: ['Channel Energy', 'Independent source'] },
  ]);
  expect(
    result.warnings
      .filter(({ subject }) => subject.includes(':ruleValue:'))
      .map(({ subject }) => subject),
  ).toEqual(['a:ruleValue:0', 'b:ruleValue:0']);
});

test('an unresolved once-per-Source group beside a resolved group of another Source: 1d6 + 2d6 = 3d6, the resolved group counting once', () => {
  const broken = entry({
    _id: 'broken',
    name: 'Broken source',
    ruleValues: [
      {
        kind: 'diceIncrease',
        key: channel,
        amount: { formula: '@unknown' },
        oncePerSource: true,
      },
    ],
  });
  const result = calculateCharacterSheet(
    sheet(
      ['cleric'],
      [
        row('a', 'broken'),
        row('b', 'broken'),
        row('c', 'phylactery'),
        row('d', 'phylactery'),
      ],
      [broken],
    ),
  );
  expect(
    result.featureNumbers.map(({ count, die, notCounted }) => ({
      dice: `${count}d${die}`,
      notCounted: notCounted?.map(({ entryId }) => entryId),
    })),
  ).toEqual([{ dice: '3d6', notCounted: ['b', 'd'] }]);
});

// rotation-6 part N: the increases that do not add are listed on the
// maximum or dice they would raise, each with its reason.
test('the second Bracelet is listed as not counted on the maximum, naming the one that counts', () => {
  const result = calculateCharacterSheet(
    sheet(levels('paladin', 4), [
      row('bracelet-1', 'bracelet'),
      row('bracelet-2', 'bracelet'),
    ]),
  );
  expect(result.dailyMaxima.map(({ notCounted }) => notCounted)).toEqual([
    [
      {
        entryId: 'bracelet-2',
        name: 'Bracelet of Mercy',
        reason: 'sameSource',
        counted: { entryId: 'bracelet-1', name: 'Bracelet of Mercy' },
      },
    ],
  ]);
});

test('with every increase counted, a maximum and dice have no not-counted list', () => {
  const result = calculateCharacterSheet(
    sheet(levels('paladin', 4), [
      row('bracelet-1', 'bracelet'),
      row('feat-1', 'extra-lay-on-hands', 'feat'),
    ]),
  );
  expect(result.dailyMaxima.map(({ notCounted }) => notCounted)).toEqual([
    undefined,
  ]);
  expect(
    calculateCharacterSheet(
      sheet(['cleric'], [row('p', 'phylactery')]),
    ).featureNumbers.map(({ notCounted }) => notCounted),
  ).toEqual([undefined]);
});

test('the second Phylactery is listed on the dice, resolved or not', () => {
  const line = {
    entryId: 'phylactery-2',
    name: 'Phylactery of Positive Channeling',
    reason: 'sameSource',
    counted: {
      entryId: 'phylactery-1',
      name: 'Phylactery of Positive Channeling',
    },
  };
  const rows = [
    row('phylactery-1', 'phylactery'),
    row('phylactery-2', 'phylactery'),
  ];
  expect(
    calculateCharacterSheet(sheet(['cleric'], rows)).featureNumbers.map(
      ({ count, notCounted }) => ({ count, notCounted }),
    ),
  ).toEqual([{ count: 3, notCounted: [line] }]);
  const unresolved = entry({
    _id: 'channel-energy',
    name: 'Channel Energy',
    ruleValues: [
      { kind: 'dice', die: 6, amount: { formula: '@unknown' }, key: channel },
    ],
    ruleIdentity: 'pf1/kXXz1lO4i7CibHJ9',
    detail: { kind: 'classFeature' },
  });
  expect(
    calculateCharacterSheet(
      classLevelSheet(['cleric'], rows, [
        ...catalog().filter(({ _id }) => _id !== 'channel-energy'),
        unresolved,
      ]),
    ).featureNumbers.map(({ count, notCounted }) => ({ count, notCounted })),
  ).toEqual([{ count: null, notCounted: [line] }]);
});
