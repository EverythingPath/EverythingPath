import { expect, test } from 'vitest';
import { calculateBonusSpells } from './character-sheet-permanent-statistics';
import { representativeClassCatalog } from '../../tests/fixtures/catalog/representative-class-progressions';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  calculateCharacterSheetProjections,
  type CharacterSheetInput,
  type SheetEntry,
} from './character-sheet';

function sheet(
  entries: SheetEntry[] = [],
  catalogEntries: CharacterSheetInput['catalogEntries'] = [],
) {
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
      ...entries,
    ] satisfies SheetEntry[],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: abilityKeys.map((ability) => ({
          target: abilityTargets[ability],
          bonusType: 'base' as const,
          value: 15,
        })),
      },
      ...catalogEntries,
    ],
  };
}

test('ability damage sums points before rounding the modifier penalty and drain lowers the score in both projections', () => {
  // CRB ability damage/drain: https://legacy.aonprd.com/coreRulebook/glossary.html#ability-score-damage-penalty-and-drain
  const input = sheet([
    {
      _id: 'damage-1',
      kind: 'abilityDamage',
      active: true,
      state: { kind: 'abilityDamage', ability: 'constitution', points: 1 },
    },
    {
      _id: 'damage-2',
      kind: 'abilityDamage',
      active: true,
      state: { kind: 'abilityDamage', ability: 'constitution', points: 1 },
    },
    {
      _id: 'drain-1',
      kind: 'abilityDrain',
      active: true,
      state: { kind: 'abilityDrain', ability: 'constitution', points: 2 },
    },
    {
      _id: 'inactive',
      kind: 'abilityDrain',
      active: false,
      state: { kind: 'abilityDrain', ability: 'constitution', points: 10 },
    },
  ]);
  const { current, permanent } = calculateCharacterSheetProjections(input);
  expect(current.abilities.constitution).toEqual({ score: 13, modifier: 0 });
  expect(permanent.abilities.constitution).toEqual({ score: 13, modifier: 1 });
  expect(current.hp).toBe(8);
  expect(permanent.hp).toBe(9);
  expect(current.abilityModifierBreakdowns.constitution.applied).toContainEqual(
    expect.objectContaining({
      entryName: 'Ability damage (2 points)',
      value: -1,
      builtIn: true,
    }),
  );
  expect(
    current.breakdowns['ability.con'].applied.map((modifier) => modifier.value),
  ).toEqual([15, -2]);
});

test.each([
  ['spellEffect', { kind: 'spellEffect', lastsOverOneDay: false }, false],
  ['spellEffect', { kind: 'spellEffect', lastsOverOneDay: true }, true],
  ['condition', { kind: 'condition' }, false],
  ['item', { kind: 'item', consumable: true }, false],
  ['item', { kind: 'item', consumable: false }, true],
  ['spell', { kind: 'spell' }, true],
] as const)(
  'classifies %s exactly for ordinary permanent scores: %j',
  (kind, detail, permanent) => {
    // #251 §8 and the data model Temporary Effects table.
    function effectEntry(): SheetEntry {
      switch (kind) {
        case 'spellEffect':
          return {
            _id: 'effect-row',
            kind,
            active: true,
            catalogEntryId: 'effect',
            state: { kind, casterLevel: 6 },
          };
        case 'condition':
          return {
            _id: 'effect-row',
            kind,
            active: true,
            catalogEntryId: 'effect',
            state: { kind },
          };
        case 'item':
          return {
            _id: 'effect-row',
            kind,
            active: true,
            catalogEntryId: 'effect',
            state: { kind },
          };
        case 'spell':
          return {
            _id: 'effect-row',
            kind,
            active: true,
            catalogEntryId: 'effect',
            state: { kind },
          };
      }
    }
    const effect = effectEntry();
    const input = sheet(
      [effect],
      [
        {
          _id: 'effect',
          ruleIdentity: 'effect',
          detail,
          modifiers: [
            { target: 'ability.int', bonusType: 'enhancement', value: 4 },
          ],
        },
      ],
    );
    const projections = calculateCharacterSheetProjections(input);
    // Recorded Spells never grant Modifiers, even if a malformed definition contains one.
    expect(projections.current.abilities.intelligence.score).toBe(
      kind === 'spell' ? 15 : 19,
    );
    expect(projections.permanent.abilities.intelligence.score).toBe(
      permanent && kind !== 'spell' ? 19 : 15,
    );
  },
);

test('permanent filtering rebuilds while-active conditions and ability-formula inputs', () => {
  const input = sheet(
    [
      {
        _id: 'condition-row',
        kind: 'condition',
        active: true,
        catalogEntryId: 'condition',
        state: { kind: 'condition' },
      },
      {
        _id: 'manual-row',
        kind: 'manual',
        active: true,
        catalogEntryId: 'manual',
        state: { kind: 'manual' },
      },
    ],
    [
      {
        _id: 'condition',
        ruleIdentity: 'condition',
        detail: { kind: 'condition' },
        modifiers: [
          { target: 'ability.str', bonusType: 'enhancement', value: 4 },
        ],
      },
      {
        _id: 'manual',
        ruleIdentity: 'manual',
        modifiers: [
          {
            target: 'damage',
            bonusType: 'untyped',
            value: { formula: '@ability.str.mod' },
          },
          {
            target: 'save.fort',
            bonusType: 'untyped',
            value: 3,
            condition: { whileActive: 'condition' },
          },
        ],
      },
    ],
  );
  const { current, permanent } = calculateCharacterSheetProjections(input);
  expect(current.breakdowns['damage.melee'].total).toBe(4);
  expect(permanent.breakdowns['damage.melee'].total).toBe(2);
  expect(current.breakdowns['save.fort'].total).toBe(3);
  expect(permanent.breakdowns['save.fort'].total).toBe(0);
  expect(calculateCharacterSheet(input, { permanentOnly: true })).toEqual(
    permanent,
  );
});

test('the same expression uses its own stage and projection in damage and HP contributions', () => {
  // #251 §8: damage and HP use current ability modifiers; ordinary permanent
  // contributions exclude the condition. Same-stage reads still contribute nothing.
  const input = sheet(
    [
      {
        _id: 'condition-row',
        kind: 'condition',
        active: true,
        catalogEntryId: 'condition',
        state: { kind: 'condition' },
      },
      {
        _id: 'adjustment-row',
        kind: 'manual',
        active: true,
        catalogEntryId: 'adjustment',
        state: { kind: 'manual' },
      },
    ],
    [
      {
        _id: 'condition',
        ruleIdentity: 'condition',
        detail: { kind: 'condition' },
        modifiers: [
          { target: 'ability.str', bonusType: 'enhancement', value: 4 },
        ],
      },
      {
        _id: 'adjustment',
        ruleIdentity: 'adjustment',
        modifiers: [
          {
            target: 'ability.dex',
            bonusType: 'untyped',
            value: { formula: '@ability.str.mod' },
          },
          {
            target: 'damage',
            bonusType: 'untyped',
            value: { formula: '@ability.str.mod' },
          },
          {
            target: 'hp',
            bonusType: 'untyped',
            value: { formula: '@ability.str.mod' },
          },
          {
            target: 'saves',
            bonusType: 'untyped',
            value: { formula: 'floor(1, 2)' },
            condition: { situation: 'against fear' },
          },
        ],
      },
    ],
  );
  const { current, permanent } = calculateCharacterSheetProjections(input);
  expect(current.breakdowns['damage.melee'].total).toBe(4);
  expect(permanent.breakdowns['damage.melee'].total).toBe(2);
  expect(current.hp).toBe(14);
  expect(permanent.hp).toBe(12);
  for (const result of [current, permanent]) {
    expect(result.abilities.dexterity.score).toBe(15);
    expect(
      result.warnings.filter((warning) => warning.target.kind === 'modifier'),
    ).toEqual([
      expect.objectContaining({
        check: 'formulaDependency',
        subject: 'adjustment-row:0',
      }),
      expect.objectContaining({
        check: 'unsupportedFormula',
        subject: 'adjustment-row:3',
      }),
    ]);
  }
});

test.each([
  { intelligence: 15, levelBudgets: [4, 11], racialBudget: 3, total: 18 },
  { intelligence: 5, levelBudgets: [1, 6], racialBudget: 1, total: 8 },
])(
  'ordinary skill budgets use permanent Intelligence $intelligence retroactively and floor before favored ranks',
  ({ intelligence, levelBudgets, racialBudget, total }) => {
    // CRB Skills: ranks per class level + Int, minimum 1, then favored ranks;
    // racial Hit Dice contribute their own rank budget.
    const input = sheet(
      [
        {
          _id: 'rogue-level',
          kind: 'classLevel',
          active: true,
          state: {
            kind: 'classLevel',
            classEntryId: 'rogue',
            position: 2,
            hpGained: 5,
            favoredClassBonus: { choice: 'skill' },
          },
        },
        {
          _id: 'condition',
          kind: 'condition',
          active: true,
          catalogEntryId: 'condition',
          state: { kind: 'condition' },
        },
      ],
      [
        ...representativeClassCatalog,
        {
          _id: 'condition',
          ruleIdentity: 'condition',
          detail: { kind: 'condition' },
          modifiers: [
            { target: 'ability.int', bonusType: 'enhancement', value: 8 },
          ],
        },
      ],
    );
    const { current, permanent } = calculateCharacterSheetProjections({
      ...input,
      entries: input.entries.map((entry) =>
        entry._id === 'level-row' && entry.kind === 'classLevel'
          ? { ...entry, state: { ...entry.state, classEntryId: 'fighter' } }
          : entry,
      ),
      catalogEntries: input.catalogEntries.map((catalog) =>
        catalog._id === 'base'
          ? {
              ...catalog,
              modifiers: catalog.modifiers.map((modifier) =>
                modifier.target === 'ability.int'
                  ? { ...modifier, value: intelligence }
                  : modifier,
              ),
            }
          : catalog,
      ),
      racialHitDice: {
        count: 1,
        hpGained: 5,
        progression: {
          bab: 'half',
          saves: { fort: 'poor', ref: 'poor', will: 'poor' },
          skillRanksPerHitDie: 1,
        },
      },
    });
    expect(current.abilities.intelligence.modifier).not.toBe(
      permanent.abilities.intelligence.modifier,
    );
    expect(current.classLevels.map((level) => level.skillRankBudget)).toEqual(
      levelBudgets,
    );
    expect(current.budgets).toMatchObject({
      kind: 'ordinary',
      racialSkillRanks: racialBudget,
      skillRanks: total,
    });
    expect(current.budgets).toEqual(permanent.budgets);
  },
);

test('bonus spells select current replacement modifiers, then use permanent scores and only castable positive-level entries', () => {
  // CRB Table 1–3 and #238: temporary winning ability changes do not turn into permanent bonus spells.
  const input = sheet(
    [
      {
        _id: 'effect',
        kind: 'condition',
        active: true,
        catalogEntryId: 'effect',
        state: { kind: 'condition' },
      },
    ],
    [
      {
        _id: 'effect',
        ruleIdentity: 'effect',
        detail: { kind: 'condition' },
        modifiers: [
          { target: 'ability.int', bonusType: 'enhancement', value: 8 },
        ],
      },
    ],
  );
  const projections = calculateCharacterSheetProjections(input);
  expect(
    calculateBonusSpells(projections, {
      baseAbility: 'wisdom',
      replacementAbilities: ['charisma', 'intelligence'],
      spellsPerDay: [3, 2, 0, null],
    }),
  ).toEqual({ ability: 'intelligence', bonusSpells: [0, 1, 1, 0] });
  expect(
    calculateBonusSpells(calculateCharacterSheetProjections(sheet()), {
      baseAbility: 'wisdom',
      replacementAbilities: ['intelligence', 'charisma'],
      spellsPerDay: [3, 2, 0, null],
    }).ability,
  ).toBe('charisma');
});

test('linked formula inputs use the corresponding projection through every calculation', () => {
  // #251 §8 / Temporary Effects: linked inputs carry ordinary permanent values transitively.
  const source = calculateCharacterSheetProjections(
    sheet(
      [
        {
          _id: 'short-spell',
          kind: 'spellEffect',
          active: true,
          catalogEntryId: 'short-spell',
          state: { kind: 'spellEffect', casterLevel: 6 },
        },
        {
          _id: 'source-casting',
          kind: 'manual',
          active: true,
          catalogEntryId: 'source-casting',
          state: { kind: 'manual' },
        },
      ],
      [
        {
          _id: 'short-spell',
          ruleIdentity: 'short-spell',
          detail: { kind: 'spellEffect', lastsOverOneDay: false },
          modifiers: [
            { target: 'ability.int', bonusType: 'enhancement', value: 4 },
          ],
        },
        {
          _id: 'source-casting',
          ruleIdentity: 'source-casting',
          modifiers: [
            {
              target: 'casterLevel',
              bonusType: 'untyped',
              value: { formula: '@ability.int.mod' },
            },
          ],
        },
      ],
    ),
  );
  const dependent = sheet(
    [
      {
        _id: 'dependent',
        kind: 'manual',
        active: true,
        catalogEntryId: 'dependent',
        state: { kind: 'manual' },
      },
    ],
    [
      {
        _id: 'dependent',
        ruleIdentity: 'dependent',
        modifiers: [
          {
            target: 'damage',
            bonusType: 'untyped',
            value: { formula: '@casterLevel.associated' },
          },
        ],
      },
    ],
  );
  const result = calculateCharacterSheetProjections(dependent, {
    projectionInputs: {
      current: {
        casterLevels: {
          associated: source.current.breakdowns.casterLevel.total,
        },
      },
      permanent: {
        casterLevels: {
          associated: source.permanent.breakdowns.casterLevel.total,
        },
      },
    },
  });
  expect(result.current.breakdowns['damage.melee'].total).toBe(4);
  expect(result.permanent.breakdowns['damage.melee'].total).toBe(2);
});

test('Situation previews keep permanent casting slots and skill budgets while current ability effects apply', () => {
  const input = sheet(
    [
      {
        _id: 'condition-row',
        kind: 'condition',
        active: true,
        catalogEntryId: 'condition',
        state: { kind: 'condition' },
      },
      {
        _id: 'adjustment-row',
        kind: 'manual',
        active: true,
        catalogEntryId: 'adjustment',
        state: { kind: 'manual' },
      },
      {
        _id: 'drain-row',
        kind: 'abilityDrain',
        active: true,
        state: { kind: 'abilityDrain', ability: 'intelligence', points: 1 },
      },
      {
        _id: 'damage-row',
        kind: 'abilityDamage',
        active: true,
        state: { kind: 'abilityDamage', ability: 'intelligence', points: 2 },
      },
    ],
    [
      ...representativeClassCatalog,
      {
        _id: 'condition',
        ruleIdentity: 'condition',
        detail: { kind: 'condition' },
        modifiers: [{ target: 'ability.int', bonusType: 'untyped', value: 8 }],
      },
      {
        _id: 'adjustment',
        ruleIdentity: 'adjustment',
        modifiers: [
          {
            target: 'ability.int',
            bonusType: 'untyped',
            value: 2,
            condition: { whileActive: 'condition' },
          },
          {
            target: 'spellDC',
            bonusType: 'untyped',
            value: 1,
            condition: { situation: 'focused' },
          },
        ],
      },
    ],
  );
  input.entries = input.entries.map((entry) =>
    entry.kind === 'classLevel'
      ? { ...entry, state: { ...entry.state, classEntryId: 'wizard' } }
      : entry,
  );
  const options = { situations: ['focused'] };
  const result = calculateCharacterSheet(input, options);
  // Permanent Int 14 supplies one bonus slot and four ranks; current Int 24
  // with two points of damage supplies a +6 modifier for DC and concentration.
  expect(result.abilities.intelligence).toEqual({ score: 24, modifier: 6 });
  expect(result.spellcastings[0]?.slots[1]).toMatchObject({
    bonus: 1,
    total: 2,
    dc: { total: 18 },
  });
  expect(result.spellcastings[0]?.concentration?.total).toBe(7);
  expect(result.budgets.skillRanks).toBe(4);
  expect(result).toEqual(
    calculateCharacterSheetProjections(input, options).current,
  );
});
