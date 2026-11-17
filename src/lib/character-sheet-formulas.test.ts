import { expect, test } from 'vitest';
import { representativeClassCatalog } from '../../tests/fixtures/catalog/representative-class-progressions';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  type CharacterSheetInput,
  type SheetEntry,
  type Modifier,
} from './character-sheet';

function build(modifiers: Modifier[]): CharacterSheetInput {
  return {
    characterKind: 'pc' as const,
    entries: [
      {
        _id: 'base-row',
        kind: 'base',
        active: true,
        catalogEntryId: 'base',
        state: { kind: 'base' },
      },
      {
        _id: 'adjustment-row',
        kind: 'manual',
        active: true,
        catalogEntryId: 'adjustment',
        state: { kind: 'manual' },
      },
      {
        _id: 'level-row',
        kind: 'classLevel',
        active: true,
        state: {
          kind: 'classLevel',
          classEntryId: null,
          position: 1,
          hpGained: 8,
        },
      },
    ] satisfies SheetEntry[],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: abilityKeys.map((ability) => ({
          target: abilityTargets[ability],
          bonusType: 'base' as const,
          value: ability === 'strength' ? 16 : 10,
        })),
      },
      { _id: 'adjustment', ruleIdentity: 'adjustment', modifiers },
    ],
  };
}

test('formulas read earlier resolved stages and join numeric stacking', () => {
  // #251 §8 / #230 closed grammar; CRB ability modifier and BAB arithmetic.
  const result = calculateCharacterSheet(
    build([
      { target: 'bab', bonusType: 'untyped', value: 2 },
      {
        target: 'attack',
        bonusType: 'enhancement',
        value: { formula: 'max(1, @bab + @ability.str.mod)' },
      },
      { target: 'attack.melee', bonusType: 'enhancement', value: 4 },
    ]),
  );
  expect(result.breakdowns['attack.melee'].total).toBe(5);
  expect(result.breakdowns['attack.ranged'].total).toBe(5);
  expect(result.breakdowns['attack.melee'].suppressed[0]?.value).toBe(4);
});

test.each([
  ['@bab-1', 1],
  ['floor(-5 / 2) + ceil(5 / 2)', 0],
  ['min(8, max(2, 3 * 2)) + 1', 7],
  ['-(@level + 2) * 3', -9],
])(
  'closed arithmetic evaluates %s without executing source',
  (formula, total) => {
    const result = calculateCharacterSheet(
      build([
        { target: 'bab', bonusType: 'untyped', value: 2 },
        { target: 'damage.melee', bonusType: 'untyped', value: { formula } },
      ]),
    );
    expect(result.breakdowns['damage.melee'].total).toBe(total);
  },
);

test('rounding formula contributions preserves recorded fractional numeric adjustments', () => {
  // Formula grammar produces integer contributions; numeric overrides stay exact.
  const result = calculateCharacterSheet(
    build([
      {
        target: 'damage',
        bonusType: 'untyped',
        value: { formula: '@level / 2' },
      },
      { target: 'init', bonusType: 'untyped', value: 0.5 },
    ]),
  );
  expect(result.breakdowns['damage.melee'].total).toBe(0);
  expect(result.breakdowns.init.total).toBe(0.5);
});

test.each([
  [1, 2],
  [5, 2],
  [6, 3],
  [12, 4],
  [18, 5],
  [24, 5],
])(
  'Shield of Faith at caster level %i contributes +%i deflection',
  (casterLevel, bonus) => {
    // CRB, Shield of Faith; CRB spell description in the removed legacy spell dataset.
    const input = build([]);
    const result = calculateCharacterSheet({
      ...input,
      entries: [
        ...input.entries,
        {
          _id: 'shield-row',
          kind: 'spellEffect',
          active: true,
          catalogEntryId: 'shield',
          state: { kind: 'spellEffect', casterLevel },
        },
      ],
      catalogEntries: [
        ...input.catalogEntries,
        {
          _id: 'shield',
          ruleIdentity: 'shield',
          name: 'Shield of faith',
          detail: { kind: 'spellEffect', lastsOverOneDay: false },
          modifiers: [
            {
              target: 'ac',
              bonusType: 'deflection',
              value: { formula: 'min(5, 2 + floor(@casterLevel / 6))' },
            },
          ],
        },
      ],
    });
    expect(result.breakdowns['ac.other'].total).toBe(bonus);
  },
);

test('dependent saves can read BAB after the class-base stage', () => {
  const result = calculateCharacterSheet(
    build([
      { target: 'bab', bonusType: 'untyped', value: 2 },
      {
        target: 'save.fort',
        bonusType: 'untyped',
        value: { formula: '@bab + @hitDice' },
      },
    ]),
  );
  expect(result.breakdowns['save.fort'].total).toBe(3);
});

test.each([
  ['@level / 2', 0],
  ['-5 / 2', -3],
  ['ceil(5 / 2)', 3],
  ['5 / 2 * 2', 5],
])(
  'formula contributions round down once after evaluating %s',
  (formula, total) => {
    // CRB p. 11, Rounding: round a fractional result down, including negatives.
    const result = calculateCharacterSheet(
      build([{ target: 'damage', bonusType: 'untyped', value: { formula } }]),
    );
    expect(result.breakdowns['damage.melee'].total).toBe(total);
  },
);

test('formula class and casting keys read own entries and reject inherited properties', () => {
  // Data model Formulas: a complete suffix is a key, never a property lookup.
  for (const formula of ['@classLevel.constructor', '@casterLevel.toString']) {
    const result = calculateCharacterSheet(
      build([{ target: 'damage', bonusType: 'untyped', value: { formula } }]),
      { classLevels: {}, casterLevels: {} },
    );
    expect(result.breakdowns['damage.melee'].total).toBe(0);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        check: 'unsupportedFormula',
        message: `This Modifier contributes nothing. ${formula} is not a supported variable.`,
      }),
    );
  }
  const ownKeyInput = build([
    {
      target: 'damage',
      bonusType: 'untyped',
      value: {
        formula:
          '@classLevel.constructor + @casterLevel.toString + @classLevel.absent + @casterLevel.absent',
      },
    },
  ]);
  const ownKeys = calculateCharacterSheet(
    {
      ...ownKeyInput,
      entries: [
        ...ownKeyInput.entries,
        ...[1, 2].map((position) => ({
          _id: `own-class-${position}`,
          kind: 'classLevel' as const,
          active: true as const,
          state: {
            kind: 'classLevel' as const,
            classEntryId: 'own-class',
            position: position + 1,
            hpGained: 5,
          },
        })),
      ],
      catalogEntries: [
        ...ownKeyInput.catalogEntries,
        {
          ...representativeClassCatalog.find(
            (entry) => entry._id === 'fighter',
          )!,
          _id: 'own-class',
          ruleIdentity: 'constructor',
        },
      ],
    },
    { casterLevels: { toString: 3 } },
  );
  expect(ownKeys.breakdowns['damage.melee'].total).toBe(5);
  expect(
    ownKeys.warnings.filter(
      (warning) => warning.check === 'unsupportedFormula',
    ),
  ).toEqual([]);
});

test.each([
  ['ability.str', '@ability.str.mod', 'formulaDependency'],
  ['ability.str', '@hitDice', 'formulaDependency'],
  ['bab', '@bab + 1', 'formulaDependency'],
  ['casterLevel', '@casterLevel.wizard', 'formulaDependency'],
  ['ability.str', '@casterLevel.arcane', 'formulaDependency'],
  ['attack', 'globalThis.process.exit()', 'unsupportedFormula'],
  ['attack', '@resources.rage', 'unsupportedFormula'],
  ['attack', '1 / 0', 'unsupportedFormula'],
  ['attack', 'floor(1, 2)', 'unsupportedFormula'],
  ['attack', 'min(1)', 'unsupportedFormula'],
  ['attack', '1.5', 'unsupportedFormula'],
  ['attack', '('.repeat(65) + '1' + ')'.repeat(65), 'unsupportedFormula'],
  ['attack', '1+'.repeat(260) + '1', 'unsupportedFormula'],
] as const)(
  'retains %s formula %s as a warning with no contribution',
  (target, formula, check) => {
    const input = build([{ target, bonusType: 'untyped', value: { formula } }]);
    const result = calculateCharacterSheet(input);
    expect(
      result.warnings.filter((warning) => warning.check === check),
    ).toEqual([
      expect.objectContaining({
        kind: 'rules',
        subject: 'adjustment-row:0',
        target: {
          kind: 'modifier',
          entryId: 'adjustment-row',
          modifierIndex: 0,
        },
        message: expect.stringContaining('contributes nothing'),
      }),
    ]);
    expect(input.catalogEntries[1]?.modifiers[0]?.value).toEqual({ formula });
    expect(result.breakdowns['attack.melee'].total).toBe(0);
  },
);

test('caster formulas distinguish recorded effects, casting bases and resolved named casting inputs', () => {
  // #251 §8, data model Formulas; Magical Knack is capped at HD.
  const input = build([
    {
      target: 'casterLevel',
      bonusType: 'trait',
      value: { formula: 'min(2, @hitDice - @casterLevel)' },
    },
    {
      target: 'damage',
      bonusType: 'untyped',
      value: {
        formula:
          '@casterLevel.wizard + @casterLevel.arcane + @casterLevel.absent',
      },
    },
    {
      target: 'init',
      bonusType: 'untyped',
      value: { formula: '@classLevel.campaign.wizard + @classLevel.absent' },
    },
  ]);
  const classInput = {
    ...input,
    entries: input.entries.map((entry) =>
      entry.kind === 'classLevel'
        ? {
            ...entry,
            state: { ...entry.state, classEntryId: 'campaign-class' },
          }
        : entry,
    ),
    catalogEntries: [
      ...input.catalogEntries,
      {
        ...representativeClassCatalog.find((entry) => entry._id === 'wizard')!,
        _id: 'campaign-class',
        ruleIdentity: 'campaign.wizard',
      },
    ],
  };
  const result = calculateCharacterSheet(classInput, {
    preModifierCasterLevel: 0,
    casterLevels: { wizard: 3 },
    arcaneCasterLevel: 4,
  });
  expect(result.breakdowns.casterLevel.total).toBe(1);
  expect(result.breakdowns['damage.melee'].total).toBe(7);
  expect(result.breakdowns.init.total).toBe(1);
  const effectInput: CharacterSheetInput = {
    ...input,
    entries: [
      ...input.entries,
      {
        _id: 'effect-row',
        kind: 'spellEffect' as const,
        active: true,
        catalogEntryId: 'effect',
        state: { kind: 'spellEffect' as const, casterLevel: 12 },
      },
    ],
    catalogEntries: [
      ...input.catalogEntries,
      {
        _id: 'effect',
        ruleIdentity: 'effect',
        detail: { kind: 'spellEffect', lastsOverOneDay: false },
        modifiers: [
          {
            target: 'ability.str' as const,
            bonusType: 'enhancement' as const,
            value: { formula: 'floor(@casterLevel / 6)' },
          },
        ],
      },
    ],
  };
  expect(calculateCharacterSheet(effectInput).abilities.strength.score).toBe(
    18,
  );
  expect(
    calculateCharacterSheet(effectInput, { permanentOnly: true }).abilities
      .strength.score,
  ).toBe(16);
  expect(
    calculateCharacterSheet(
      build([
        {
          target: 'damage',
          bonusType: 'untyped',
          value: { formula: '@casterLevel' },
        },
      ]),
    ).warnings,
  ).toContainEqual(expect.objectContaining({ check: 'unsupportedFormula' }));
});
