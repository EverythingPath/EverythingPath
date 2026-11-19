// rotation-5 fix r2: the dice increase truth table, one test per cell. The
// base die is a keyed dice value on Fatigued (Exhausted replaces it, so a
// suppressed base); the increase is on Grappled (Pinned replaces it). Each
// cell names what the base's row shows and which rows warn; the expected
// values are the table's (R/rotation-5/dice-increase-table.md), written out,
// not computed. A rule value warning targets its entry, so it shows on that
// entry's row: `fatigued-row` (the base) or `grappled-row` (the increase).
import { expect, test } from 'vitest';
import {
  calculateCharacterSheet,
  storedRuleValuesSchema,
  type CharacterSheetCatalogEntry,
  type RuleValue,
  type SheetEntry,
} from './character-sheet';
import { importedCatalogEntrySchema } from './catalog/imported-entry-schema';
import { featureNumberChips } from '../components/character-sheet/feature-number-chips';
import { getConditionDefinition } from './character-sheet-conditions';
import {
  baseScores,
  classLevelSheet,
} from './character-sheet-rule-value-fixture';

const key = 'fixtureDice';
const unknown = { formula: '@unknown' };

type Base = 'resolved' | 'unresolved' | 'suppressed' | 'absent';
type Increase =
  | 'resolved'
  | 'unresolved'
  | 'suppressed'
  | 'unmatched'
  | 'duplicate'
  | 'self-targeted';
type ConditionKey = 'fatigued' | 'exhausted' | 'grappled' | 'pinned';

const condition = (
  conditionKey: ConditionKey,
  ruleValues: RuleValue[] = [],
): CharacterSheetCatalogEntry => ({
  _id: conditionKey,
  ruleIdentity: getConditionDefinition(conditionKey).ruleIdentity,
  name: conditionKey[0]!.toUpperCase() + conditionKey.slice(1),
  modifiers: [],
  detail: { kind: 'condition', conditionKey },
  ruleValues,
});
const row = (conditionKey: ConditionKey): SheetEntry =>
  ({
    _id: `${conditionKey}-row`,
    kind: 'condition',
    active: true,
    catalogEntryId: conditionKey,
    state: { kind: 'condition' },
  }) as SheetEntry;

/** The base's keyed die (a formula that fails where it must not evaluate). */
const baseDie = (base: Base): RuleValue => ({
  kind: 'dice',
  die: 6,
  amount: base === 'resolved' ? 2 : unknown,
  key,
});
/** The increasing entry's rule values. */
const increaseValues = (increase: Increase): RuleValue[] => {
  switch (increase) {
    case 'resolved':
      return [{ kind: 'diceIncrease', key, amount: 1 }];
    case 'unresolved':
    case 'suppressed':
      return [{ kind: 'diceIncrease', key, amount: unknown }];
    case 'unmatched':
      return [{ kind: 'diceIncrease', key: 'otherDice', amount: unknown }];
    case 'duplicate':
      return [
        { kind: 'diceIncrease', key, amount: 1 },
        { kind: 'diceIncrease', key, amount: 1 },
      ];
    case 'self-targeted':
      return [
        { kind: 'dice', die: 6, amount: 1, key },
        { kind: 'diceIncrease', key, amount: 1 },
      ];
  }
};

function calculate(base: Base, increase: Increase) {
  const entries = [
    baseScores(),
    condition('fatigued', [baseDie(base)]),
    condition('exhausted'),
    condition('grappled', increaseValues(increase)),
    condition('pinned'),
  ];
  const rows = [
    ...(base === 'absent' ? [] : [row('fatigued')]),
    ...(base === 'suppressed' ? [row('exhausted')] : []),
    row('grappled'),
    ...(increase === 'suppressed' ? [row('pinned')] : []),
  ];
  const result = calculateCharacterSheet(classLevelSheet([], rows, entries));
  return {
    // The row's chips as the renderer formats them, joined.
    shows: result.featureNumbers.map((number) => {
      const { dice, increases } = featureNumberChips(number);
      return [dice, ...increases.map(({ text }) => text)].join(' | ');
    }),
    sources: result.featureNumbers.map(({ sources }) =>
      sources.map(({ name }) => name),
    ),
    warns: result.warnings
      .filter(({ subject }) => subject.includes(':ruleValue:'))
      .map(({ subject }) => subject),
  };
}

type Shown = { shows: string[]; sources: string[][]; warns: string[] };
const none: Shown = { shows: [], sources: [], warns: [] };
const refusals = {
  duplicate: `An entry increases the dice of ${key} once; this one repeats it.`,
  'self-targeted': `A dice increase raises another entry’s dice; ${key} is this entry’s own.`,
};

// The truth table: base die x increase -> what the base's row shows, its
// sources, and the rule value warnings (by the row they show on), or the
// write's refusal.
const table: [Base, Increase, Shown | { refused: string }][] = [
  [
    'resolved',
    'resolved',
    {
      shows: ['3d6 | +1d6 from Grappled'],
      sources: [['Fatigued', 'Grappled']],
      warns: [],
    },
  ],
  [
    'resolved',
    'unresolved',
    {
      shows: ['2d6'],
      sources: [['Fatigued']],
      warns: ['grappled-row:ruleValue:0'],
    },
  ],
  [
    'resolved',
    'suppressed',
    { shows: ['2d6'], sources: [['Fatigued']], warns: [] },
  ],
  [
    'resolved',
    'unmatched',
    { shows: ['2d6'], sources: [['Fatigued']], warns: [] },
  ],
  ['resolved', 'duplicate', { refused: refusals.duplicate }],
  ['resolved', 'self-targeted', { refused: refusals['self-targeted'] }],
  [
    'unresolved',
    'resolved',
    {
      shows: ['Unresolved d6'],
      sources: [['Fatigued']],
      warns: ['fatigued-row:ruleValue:0'],
    },
  ],
  [
    'unresolved',
    'unresolved',
    {
      shows: ['Unresolved d6'],
      sources: [['Fatigued']],
      warns: ['fatigued-row:ruleValue:0', 'grappled-row:ruleValue:0'],
    },
  ],
  [
    'unresolved',
    'suppressed',
    {
      shows: ['Unresolved d6'],
      sources: [['Fatigued']],
      warns: ['fatigued-row:ruleValue:0'],
    },
  ],
  [
    'unresolved',
    'unmatched',
    {
      shows: ['Unresolved d6'],
      sources: [['Fatigued']],
      warns: ['fatigued-row:ruleValue:0'],
    },
  ],
  ['unresolved', 'duplicate', { refused: refusals.duplicate }],
  ['unresolved', 'self-targeted', { refused: refusals['self-targeted'] }],
  ['suppressed', 'resolved', none],
  ['suppressed', 'unresolved', none],
  ['suppressed', 'suppressed', none],
  ['suppressed', 'unmatched', none],
  ['suppressed', 'duplicate', { refused: refusals.duplicate }],
  ['suppressed', 'self-targeted', { refused: refusals['self-targeted'] }],
  ['absent', 'resolved', none],
  ['absent', 'unresolved', none],
  ['absent', 'suppressed', none],
  ['absent', 'unmatched', none],
  ['absent', 'duplicate', { refused: refusals.duplicate }],
  ['absent', 'self-targeted', { refused: refusals['self-targeted'] }],
];

test('the table has every cell once', () => {
  expect(
    new Set(table.map(([base, increase]) => `${base}:${increase}`)).size,
  ).toBe(24);
});

test.each(table)(
  'base die %s, increase %s',
  (base, increase, expected) => {
    if ('refused' in expected) {
      // Refused at write whatever the base: every write parses the stored
      // schema (or, for a one-off, the same check), so it never reaches a sheet.
      const parsed = storedRuleValuesSchema.safeParse(increaseValues(increase));
      expect(parsed.error?.issues.map(({ message }) => message)).toEqual([
        expected.refused,
      ]);
      expect(
        importedCatalogEntrySchema.shape.ruleValues.safeParse(
          increaseValues(increase),
        ).success,
      ).toBe(false);
      // The base alone is a valid entry.
      expect(storedRuleValuesSchema.safeParse([baseDie(base)]).success).toBe(
        true,
      );
      return;
    }
    expect(calculate(base, increase)).toEqual(expected);
  },
);
