// rotation-6 part J (design ORCH/research/rotation-6-design.md §3 (f)): a
// per-day maximum may carry `joins: true`. While an unsuppressed maximum of
// its key and unit that does not join is on the sheet, it adds its amount to
// that one like an increase, named in its sources, and has no maximum of its
// own; otherwise it is an ordinary maximum, and of several that join with
// nothing to join, the first is the one the others join. The floor applies to
// the joined sum. Fixtures have the imported shape and are test fixtures
// only: Foundry rage (`4 + @abilities.con.mod + 2 * (level - 1)` rounds) and
// Rage (Cleric) (rage-cleric.HJMvo9iDrDwjLAgM: "These rounds of rage stack
// with any rounds of rage you might have from levels of barbarian", the
// cleric level in rounds), with an Extra-Rage-like increase of 6.
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
import { getConditionDefinition } from './character-sheet-conditions';
import {
  baseClass,
  baseScores,
  classLevelSheet,
} from './character-sheet-rule-value-fixture';

const rage = 'classFeat_rage';

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

const joining = ({
  _id,
  name,
  amount,
  unit = 'rounds',
}: {
  _id: string;
  name: string;
  amount: RuleValue['amount'];
  unit?: 'rounds' | 'uses';
}) =>
  entry({
    _id,
    name,
    ruleValues: [
      { kind: 'dailyMaximum', key: rage, unit, amount, joins: true },
    ],
  });

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

function catalog(
  extra: CharacterSheetCatalogEntry[] = [],
  rageFormula = '4 + @ability.con.mod + 2 * (@classLevel.barbarian - 1)',
) {
  return [
    baseScores({ constitution: 14 }),
    baseClass('barbarian', 'Barbarian', [
      { classLevel: 1, catalogEntryId: 'rage' },
    ]),
    baseClass('cleric', 'Cleric', [
      { classLevel: 1, catalogEntryId: 'rage-cleric' },
    ]),
    entry({
      _id: 'rage',
      name: 'Rage',
      ruleValues: [
        {
          kind: 'dailyMaximum',
          key: rage,
          unit: 'rounds',
          amount: { formula: rageFormula },
        },
      ],
      ruleIdentity: 'pf1/rage',
      detail: { kind: 'classFeature' },
    }),
    entry({
      _id: 'rage-cleric',
      name: 'Rage (Cleric)',
      ruleValues: [
        {
          kind: 'dailyMaximum',
          key: rage,
          unit: 'rounds',
          amount: { formula: '@classLevel.cleric' },
          joins: true,
        },
      ],
      ruleIdentity: 'pf1/HJMvo9iDrDwjLAgM',
      detail: { kind: 'classFeature' },
    }),
    entry({
      _id: 'extra-rage',
      name: 'Extra Rage',
      ruleValues: [{ kind: 'dailyMaximumIncrease', key: rage, amount: 6 }],
      detail: { kind: 'feat', repeatable: 'yes' },
    }),
    ...extra,
  ];
}

const row = (
  _id: string,
  catalogEntryId: string,
  kind: 'item' | 'feat' | 'condition' = 'item',
): SheetEntry =>
  ({
    _id,
    kind,
    active: true,
    catalogEntryId,
    state: { kind },
  }) as SheetEntry;

const levels = (counts: { barbarian?: number; cleric?: number }) => [
  ...Array.from({ length: counts.barbarian ?? 0 }, () => 'barbarian'),
  ...Array.from({ length: counts.cleric ?? 0 }, () => 'cleric'),
];

function maxima(input: CharacterSheetInput) {
  const result = calculateCharacterSheet(input);
  return result.dailyMaxima.map(({ entryId, unit, value, sources, floor }) => ({
    entryId,
    unit,
    value,
    sources: sources.map(({ name }) => name),
    ...(floor ? { floor } : {}),
  }));
}

test('a Barbarian 8 / Cleric 8 with Constitution 14 rages 4 + 2 + 14 + 8 = 28 rounds on the Barbarian’s row, and Rage (Cleric) has no maximum of its own', () => {
  const input = classLevelSheet(
    levels({ barbarian: 8, cleric: 8 }),
    [],
    catalog(),
  );
  // The maximum is the Barbarian's Rage's: its sources begin with it.
  expect(maxima(input)).toEqual([
    {
      entryId: expect.any(String),
      unit: 'rounds',
      value: 28,
      sources: ['Rage', 'Rage (Cleric)'],
    },
  ]);
});

test('a Cleric 8 alone has Rage (Cleric) as an ordinary maximum: 8 rounds', () => {
  expect(maxima(classLevelSheet(levels({ cleric: 8 }), [], catalog()))).toEqual(
    [
      {
        entryId: expect.any(String),
        unit: 'rounds',
        value: 8,
        sources: ['Rage (Cleric)'],
      },
    ],
  );
});

test('with an increase on the key it adds once to the joined total, and once to a joining maximum alone', () => {
  const feat = row('feat-1', 'extra-rage', 'feat');
  expect(
    maxima(
      classLevelSheet(levels({ barbarian: 8, cleric: 8 }), [feat], catalog()),
    ).map(({ value, sources }) => ({ value, sources })),
  ).toEqual([{ value: 34, sources: ['Rage', 'Rage (Cleric)', 'Extra Rage'] }]);
  expect(
    maxima(classLevelSheet(levels({ cleric: 8 }), [feat], catalog())).map(
      ({ value, sources }) => ({ value, sources }),
    ),
  ).toEqual([{ value: 14, sources: ['Rage (Cleric)', 'Extra Rage'] }]);
});

test('two joining maxima with nothing to join: the first is the maximum and the second joins it', () => {
  expect(
    maxima(
      classLevelSheet(
        [],
        [row('charm-a-row', 'charm-a'), row('charm-b-row', 'charm-b')],
        catalog([
          joining({ _id: 'charm-a', name: 'Rage charm A', amount: 3 }),
          joining({ _id: 'charm-b', name: 'Rage charm B', amount: 2 }),
        ]),
      ),
    ),
  ).toEqual([
    {
      entryId: 'charm-a-row',
      unit: 'rounds',
      value: 5,
      sources: ['Rage charm A', 'Rage charm B'],
    },
  ]);
});

test('a joining maximum whose host is suppressed is an ordinary maximum', () => {
  // A homebrew maximum on the Grappled Condition, which Pinned replaces.
  const entries = catalog([
    condition('grappled', [
      { kind: 'dailyMaximum', key: rage, unit: 'rounds', amount: 10 },
    ]),
    condition('pinned'),
  ]);
  const grappled = row('grappled-row', 'grappled', 'condition');
  const pinned = row('pinned-row', 'pinned', 'condition');
  expect(
    maxima(classLevelSheet(levels({ cleric: 8 }), [grappled], entries)),
  ).toEqual([
    {
      entryId: 'grappled-row',
      unit: 'rounds',
      value: 18,
      sources: ['Grappled', 'Rage (Cleric)'],
    },
  ]);
  expect(
    maxima(
      classLevelSheet(levels({ cleric: 8 }), [grappled, pinned], entries),
    ).map(({ value, sources }) => ({ value, sources })),
  ).toEqual([{ value: 8, sources: ['Rage (Cleric)'] }]);
});

test('the floor applies to the joined sum', () => {
  // A host formula of −10 for the fixture: −10 + 2 = −8, shown 0.
  expect(
    maxima(
      classLevelSheet(
        levels({ barbarian: 1, cleric: 2 }),
        [],
        catalog([], '-10'),
      ),
    ).map(({ value, floor }) => ({ value, floor })),
  ).toEqual([{ value: 0, floor: { sum: -8 } }]);
});

test('an unresolved joining maximum leaves the joined maximum unresolved', () => {
  expect(
    maxima(
      classLevelSheet(
        levels({ barbarian: 1 }),
        [row('charm-row', 'charm')],
        catalog([
          joining({
            _id: 'charm',
            name: 'Rage charm',
            amount: { formula: '@unknown' },
          }),
        ]),
      ),
    ).map(({ value, sources }) => ({ value, sources })),
  ).toEqual([{ value: null, sources: ['Rage', 'Rage charm'] }]);
});

test('a joining maximum joins only a maximum of its own unit: beside a host of another unit it keeps its own', () => {
  expect(
    maxima(
      classLevelSheet(
        levels({ barbarian: 1 }),
        [row('charm-row', 'charm')],
        catalog([
          joining({
            _id: 'charm',
            name: 'Rage charm',
            amount: 2,
            unit: 'uses',
          }),
        ]),
      ),
    ).map(({ unit, value, sources }) => ({ unit, value, sources })),
  ).toEqual([
    // In sheet order: the item's row comes before the granted Rage.
    { unit: 'uses', value: 2, sources: ['Rage charm'] },
    { unit: 'rounds', value: 6, sources: ['Rage'] },
  ]);
});

test('joins is a maximum’s alone, and only true, refused otherwise by the rule value, stored, imported and curation output schemas', () => {
  const refused: unknown[] = [
    {
      kind: 'dailyMaximum',
      key: rage,
      unit: 'rounds',
      amount: 1,
      joins: false,
    },
    { kind: 'dailyMaximumIncrease', key: rage, amount: 1, joins: true },
    { kind: 'dice', die: 6, amount: 1, joins: true },
    { kind: 'diceIncrease', key: rage, amount: 1, joins: true },
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
  const ruleValue = {
    kind: 'dailyMaximum',
    key: rage,
    unit: 'rounds',
    amount: { formula: '@classLevel.cleric' },
    joins: true,
  };
  expect(storedRuleValuesSchema.safeParse([ruleValue]).success).toBe(true);
  expect(
    ruleValueOutputSchema.safeParse({ kind: 'ruleValue', ruleValue }).success,
  ).toBe(true);
});

// Fix r1 (both reviews, finding 1): a suppressed entry's per-day values are
// decided suppressed before their formulas are evaluated, as rotation-5 fix
// r2 did for keyed dice, so they take no part: none hosts, joins, adds, is
// listed as not counted or warns. Each fixture puts a homebrew rule value
// with an unsupported formula (for the choice, also one that resolves) on
// the Grappled Condition, which Pinned replaces.
function suppressedGrappled(ruleValues: RuleValue[]) {
  const result = calculateCharacterSheet(
    classLevelSheet(
      levels({ cleric: 8 }),
      [
        row('grappled-row', 'grappled', 'condition'),
        row('pinned-row', 'pinned', 'condition'),
      ],
      catalog([condition('grappled', ruleValues), condition('pinned')]),
    ),
  );
  return {
    maxima: result.dailyMaxima.map(
      ({ entryId, value, sources, notCounted }) => ({
        entryId,
        value,
        sources: sources.map(({ name }) => name),
        ...(notCounted ? { notCounted } : {}),
      }),
    ),
    warnings: result.warnings
      .filter(({ subject }) => subject.startsWith('grappled-row'))
      .map(({ check }) => check),
  };
}

const ownRage = {
  entryId: expect.any(String),
  value: 8,
  sources: ['Rage (Cleric)'],
};

test('a suppressed maximum whose formula does not resolve hosts nothing: Rage (Cleric) stays an ordinary 8 rounds', () => {
  expect(
    suppressedGrappled([
      {
        kind: 'dailyMaximum',
        key: rage,
        unit: 'rounds',
        amount: { formula: '@unknown' },
      },
    ]),
  ).toEqual({ maxima: [ownRage], warnings: [] });
});

test('a suppressed increase whose formula does not resolve adds nothing and leaves the maximum resolved', () => {
  expect(
    suppressedGrappled([
      {
        kind: 'dailyMaximumIncrease',
        key: rage,
        amount: { formula: '@unknown' },
      },
    ]),
  ).toEqual({ maxima: [ownRage], warnings: [] });
});

// An increase for a choice on an entry the condition suppresses: suppression
// is decided first, so it is neither listed nor warns, whether or not its
// entry could record the choice (fix r3: an entry that cannot is never
// counted anyway).
test('a suppressed increase for a choice is not listed as not counted and warns nothing, its formula resolving or not', () => {
  for (const amount of [{ formula: '@unknown' }, 2])
    expect(
      suppressedGrappled([
        { kind: 'dailyMaximumIncrease', key: rage, amount, choice: ['Rage'] },
      ]),
    ).toEqual({ maxima: [ownRage], warnings: [] });
});

test('a suppressed joining maximum whose formula does not resolve joins nothing', () => {
  expect(
    suppressedGrappled([
      {
        kind: 'dailyMaximum',
        key: rage,
        unit: 'rounds',
        amount: { formula: '@unknown' },
        joins: true,
      },
    ]),
  ).toEqual({ maxima: [ownRage], warnings: [] });
});
