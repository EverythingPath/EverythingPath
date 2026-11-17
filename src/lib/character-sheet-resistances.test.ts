// rotation-2 R2 (PRD #251; ORCH research stats-design.md "Damage reduction",
// "Spell resistance"): rule values of kinds `damageReduction` (a value and a
// bypass) and `spellResistance`. Every line is listed; the statistic is the
// highest value per bypass (root's default, 2026-11-17: never a sum), and the
// highest spell resistance. A line under a Situation is conditional until the
// Situation is selected. Fixtures have the imported shape: the Barbarian's
// Damage Reduction at 7th with its reviewed increments at 10th, 13th, 16th
// and 19th (scripts/catalog/pcgen/schedules-rage-performance.ts), and the Mad
// Dog's own damage reduction from 10th (PCGen anar_abilities_class.lst:85).
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

const barbarianDr = 'pf1/barbarianDamageReduction';
const increments = [10, 13, 16, 19];

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
  {
    _id: 'barbarian',
    ruleIdentity: 'barbarian',
    name: 'Barbarian',
    modifiers: [],
    detail: {
      kind: 'class',
      classKind: 'base',
      tag: 'barbarian',
      hitDie: 12,
      bab: 'full',
      saves: { fort: 'good', ref: 'poor', will: 'poor' },
      skillRanksPerLevel: 4,
      featuresByLevel: [
        { classLevel: 7, catalogEntryId: 'damage-reduction' },
        ...increments.map((classLevel) => ({
          classLevel,
          catalogEntryId: `damage-reduction-${classLevel}`,
        })),
      ],
    },
  },
  {
    _id: 'damage-reduction',
    ruleIdentity: barbarianDr,
    name: 'Damage Reduction',
    modifiers: [],
    detail: { kind: 'classFeature' },
    ruleValues: [
      { kind: 'damageReduction', amount: { rows: {} }, bypass: '-' },
    ],
  },
  ...increments.map(
    (classLevel): CharacterSheetCatalogEntry => ({
      _id: `damage-reduction-${classLevel}`,
      ruleIdentity: `everythingpath/barbarian-damage-reduction-${classLevel}`,
      name: `Damage Reduction ${classLevel}`,
      modifiers: [],
      detail: {
        kind: 'classFeature',
        parentFeature: barbarianDr,
        part: `${classLevel}:${barbarianDr}`,
      },
    }),
  ),
  {
    _id: 'mad-dog',
    ruleIdentity: 'everythingpath/barbarian-mad-dog',
    name: 'Mad Dog',
    modifiers: [],
    detail: {
      kind: 'archetype',
      classEntryIds: ['barbarian'],
      replaces: [],
      adds: [{ classLevel: 10, catalogEntryId: 'mad-dog-dr' }],
    },
  },
  {
    _id: 'mad-dog-dr',
    ruleIdentity: 'everythingpath/barbarian-mad-dog-damage-reduction',
    name: 'Damage Reduction (Mad Dog)',
    modifiers: [],
    detail: { kind: 'classFeature' },
    ruleValues: [
      {
        kind: 'damageReduction',
        amount: { formula: 'floor((@classLevel.barbarian - 7) / 3)' },
        bypass: '-',
      },
    ],
  },
  {
    // CRB p. 350: stoneskin, DR 10/adamantine, a Spell Effect.
    _id: 'stoneskin',
    ruleIdentity: 'pf1/stoneskin',
    name: 'Stoneskin',
    modifiers: [],
    detail: { kind: 'spellEffect' },
    ruleValues: [{ kind: 'damageReduction', amount: 10, bypass: 'adamantine' }],
  },
  {
    // ARG p. 108: drow spell resistance equal to 6 + their class levels.
    _id: 'drow',
    ruleIdentity: 'pf1/drow',
    name: 'Drow',
    modifiers: [],
    detail: { kind: 'race', racialTraits: [] },
    ruleValues: [
      { kind: 'spellResistance', amount: { formula: '6 + @level' } },
    ],
  },
  {
    // CRB p. 520: mantle of spell resistance, SR 21.
    _id: 'mantle',
    ruleIdentity: 'pf1/mantleOfSpellResistance',
    name: 'Mantle of Spell Resistance',
    modifiers: [],
    detail: { kind: 'item' },
    ruleValues: [{ kind: 'spellResistance', amount: 21 }],
  },
  {
    // CRB p. 516: robe of the archmagi, SR 18 for an arcane spellcaster of
    // the robe's alignment; a local Situation, as fg-1b's part B proposed.
    _id: 'robe',
    ruleIdentity: 'pf1/robeOfTheArchmagiWhite',
    name: 'Robe of the Archmagi (White)',
    modifiers: [],
    detail: { kind: 'item' },
    ruleValues: [
      {
        kind: 'spellResistance',
        amount: 18,
        condition: {
          situation: { local: 'worn by a good arcane spellcaster' },
        },
      },
    ],
  },
];

function sheet({
  barbarian = 0,
  extra = [],
}: {
  barbarian?: number;
  extra?: SheetEntry[];
}): CharacterSheetInput {
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
      ...Array.from(
        { length: barbarian },
        (_, index): SheetEntry => ({
          _id: `level-${index + 1}`,
          kind: 'classLevel',
          active: true,
          state: {
            kind: 'classLevel',
            classEntryId: 'barbarian',
            position: index + 1,
            hpGained: 12,
          },
        }),
      ),
      ...extra,
    ],
    catalogEntries: catalog,
  };
}

const madDog: SheetEntry = {
  _id: 'mad-dog-row',
  kind: 'archetype',
  active: true,
  catalogEntryId: 'mad-dog',
  state: { kind: 'archetype' },
};
const stoneskin: SheetEntry = {
  _id: 'stoneskin-row',
  kind: 'spellEffect',
  active: true,
  catalogEntryId: 'stoneskin',
  state: { kind: 'spellEffect', casterLevel: 7 },
};
const drow: SheetEntry = {
  _id: 'drow-row',
  kind: 'race',
  active: true,
  catalogEntryId: 'drow',
  state: { kind: 'race' },
};
const item = (catalogEntryId: string, active = true): SheetEntry => ({
  _id: `${catalogEntryId}-row`,
  kind: 'item',
  active,
  catalogEntryId,
  state: { kind: 'item' },
});

function reduction(result: ReturnType<typeof calculateCharacterSheet>) {
  const { values, lines, conditional } = result.damageReduction;
  return {
    values: values.map(({ value, bypass }) => `${value}/${bypass}`),
    lines: lines.map(
      ({ name, value, bypass, applies }) =>
        `${name} ${value}/${bypass}${applies ? ' (applies)' : ''}`,
    ),
    conditional,
  };
}

// CRB Table 3–3 (Barbarian): DR 1/— at 7th, +1 at 10th, 13th, 16th and 19th.
test.each([
  [6, []],
  [7, ['1/-']],
  [8, ['1/-']],
  [10, ['2/-']],
  [13, ['3/-']],
  [19, ['5/-']],
])('a Barbarian %i has damage reduction %j', (level, values) => {
  expect(
    reduction(calculateCharacterSheet(sheet({ barbarian: level }))).values,
  ).toEqual(values);
});

test('a Barbarian 10 Mad Dog lists both lines and takes the highest per bypass: 2/-, not 3/-', () => {
  expect(
    reduction(
      calculateCharacterSheet(sheet({ barbarian: 10, extra: [madDog] })),
    ),
  ).toEqual({
    values: ['2/-'],
    lines: ['Damage Reduction 2/- (applies)', 'Damage Reduction (Mad Dog) 1/-'],
    conditional: [],
  });
});

test('each bypass keeps its own highest; a Temporary Effect leaves the permanent projection', () => {
  const { current, permanent } = calculateCharacterSheetProjections(
    sheet({ barbarian: 10, extra: [stoneskin] }),
  );
  expect(reduction(current).values).toEqual(['10/adamantine', '2/-']);
  expect(reduction(current).lines).toEqual([
    'Stoneskin 10/adamantine (applies)',
    'Damage Reduction 2/- (applies)',
  ]);
  expect(reduction(permanent).values).toEqual(['2/-']);
});

function resistance(result: ReturnType<typeof calculateCharacterSheet>) {
  const { value, lines, conditional } = result.spellResistanceStatistic;
  return {
    value,
    lines: lines.map(
      ({ name, value, applies }) =>
        `${name} ${value}${applies ? ' (applies)' : ''}`,
    ),
    conditional: conditional.map(({ name, value, situation }) => ({
      name,
      value,
      situation,
    })),
  };
}

test('spell resistance from a race and an item takes the highest, never a sum', () => {
  const levels = 5;
  const result = calculateCharacterSheet({
    ...sheet({ barbarian: levels, extra: [drow, item('mantle')] }),
  });
  expect(resistance(result)).toEqual({
    value: 21,
    lines: ['Drow 11', 'Mantle of Spell Resistance 21 (applies)'],
    conditional: [],
  });
  const carried = calculateCharacterSheet(
    sheet({ barbarian: levels, extra: [drow, item('mantle', false)] }),
  );
  expect(resistance(carried)).toEqual({
    value: 11,
    lines: ['Drow 11 (applies)'],
    conditional: [],
  });
});

test('a conditional line is listed with its Situation and counts once the Situation is selected', () => {
  const input = sheet({ barbarian: 5, extra: [drow, item('robe')] });
  const situation = { local: 'worn by a good arcane spellcaster' };
  expect(resistance(calculateCharacterSheet(input))).toEqual({
    value: 11,
    lines: ['Drow 11 (applies)'],
    conditional: [
      { name: 'Robe of the Archmagi (White)', value: 18, situation },
    ],
  });
  const selected = calculateCharacterSheet(input, {
    situations: [{ ...situation, sheetEntryId: 'robe-row' }],
  });
  expect(resistance(selected)).toEqual({
    value: 18,
    lines: ['Drow 11', 'Robe of the Archmagi (White) 18 (applies)'],
    conditional: [],
  });
});

test('no rule values give no damage reduction and no spell resistance', () => {
  const result = calculateCharacterSheet(sheet({ barbarian: 3 }));
  expect(result.damageReduction).toEqual({
    values: [],
    lines: [],
    conditional: [],
  });
  expect(result.spellResistanceStatistic).toEqual({
    value: null,
    lines: [],
    conditional: [],
  });
  expect(result.featureNumbers).toEqual([]);
});

test('an unresolved formula lists its line with no value; it never wins', () => {
  const entries = catalog.map((entry) =>
    entry._id === 'drow'
      ? {
          ...entry,
          ruleValues: [
            {
              kind: 'spellResistance' as const,
              amount: { formula: '@unknown' },
            },
          ],
        }
      : entry,
  );
  const result = calculateCharacterSheet({
    ...sheet({ extra: [drow, item('mantle')] }),
    catalogEntries: entries,
  });
  expect(resistance(result)).toEqual({
    value: 21,
    lines: ['Drow null', 'Mantle of Spell Resistance 21 (applies)'],
    conditional: [],
  });
  expect(result.warnings).toContainEqual(
    expect.objectContaining({
      check: 'unsupportedFormula',
      subject: 'drow-row:ruleValue:0',
    }),
  );
});

// fix r1: CRB p. 347, the spell spell resistance gives SR 12 + caster level.
// Its rule value reads the Spell Effect's recorded caster level, as a
// Modifier of that effect does; a class feature's rule value has no caster
// level to read, as before.
const spellResistanceSpell: CharacterSheetCatalogEntry = {
  _id: 'spell-resistance',
  ruleIdentity: 'pf1/spellResistance',
  name: 'Spell Resistance',
  modifiers: [],
  detail: { kind: 'spellEffect' },
  ruleValues: [
    { kind: 'spellResistance', amount: { formula: '12 + @casterLevel' } },
  ],
};
const casterLevelFeature: CharacterSheetCatalogEntry = {
  _id: 'caster-level-feature',
  ruleIdentity: 'fixture/caster-level-feature',
  name: 'Caster-level feature',
  modifiers: [],
  detail: { kind: 'classFeature' },
  ruleValues: [
    { kind: 'spellResistance', amount: { formula: '12 + @casterLevel' } },
  ],
};

test('a Spell Effect’s spell resistance formula reads its recorded caster level: 12 + 9 is 21', () => {
  const result = calculateCharacterSheet({
    ...sheet({
      extra: [
        {
          _id: 'spell-resistance-row',
          kind: 'spellEffect',
          active: true,
          catalogEntryId: 'spell-resistance',
          state: { kind: 'spellEffect', casterLevel: 9 },
        },
      ],
    }),
    catalogEntries: [...catalog, spellResistanceSpell],
  });
  expect(resistance(result)).toEqual({
    value: 21,
    lines: ['Spell Resistance 21 (applies)'],
    conditional: [],
  });
  expect(
    result.warnings.filter(({ subject }) => subject.includes(':ruleValue:')),
  ).toEqual([]);
});

test('a class feature’s rule value has no caster level to read: it warns and gives no number', () => {
  const result = calculateCharacterSheet({
    ...sheet({
      extra: [
        {
          _id: 'caster-level-feature-row',
          kind: 'classFeature',
          active: true,
          catalogEntryId: 'caster-level-feature',
          state: { kind: 'classFeature' },
        },
      ],
    }),
    catalogEntries: [...catalog, casterLevelFeature],
  });
  expect(resistance(result).value).toBeNull();
  expect(result.warnings).toContainEqual(
    expect.objectContaining({
      check: 'unsupportedFormula',
      subject: 'caster-level-feature-row:ruleValue:0',
    }),
  );
});

const imported = {
  externalKey: 'pf1/barbarianDamageReduction',
  upstreamKey: 'pf1/barbarianDamageReduction',
  pack: 'class-abilities',
  name: 'Damage Reduction',
  detail: { kind: 'classFeature' },
  description: '',
  sources: [],
  modifiers: [],
  unsupported: [],
};

test.each([
  [
    'damage reduction with its bypass',
    [{ kind: 'damageReduction', amount: { rows: {} }, bypass: '-' }],
    true,
  ],
  [
    'conditional spell resistance',
    [
      {
        kind: 'spellResistance',
        amount: 18,
        condition: { situation: { local: 'worn by an arcane spellcaster' } },
      },
    ],
    true,
  ],
  [
    'damage reduction without a bypass',
    [{ kind: 'damageReduction', amount: 5 }],
    false,
  ],
  [
    'an empty bypass',
    [{ kind: 'damageReduction', amount: 5, bypass: '' }],
    false,
  ],
  [
    'an option Situation',
    [
      {
        kind: 'spellResistance',
        amount: 5,
        condition: { situation: { option: 'x' } },
      },
    ],
    false,
  ],
  [
    'a condition other than a Situation',
    [{ kind: 'spellResistance', amount: 5, condition: { whileActive: 'x' } }],
    false,
  ],
])('the imported entry schema takes %s: %j', (_, ruleValues, accepted) => {
  expect(
    importedCatalogEntrySchema.safeParse({ ...imported, ruleValues }).success,
  ).toBe(accepted);
});

test('damage reduction and spell resistance are discriminated variants', () => {
  const legal: RuleValue[] = [
    { kind: 'damageReduction', amount: 5, bypass: 'magic' },
    { kind: 'spellResistance', amount: { formula: '6 + @level' } },
  ];
  // @ts-expect-error damage reduction names its bypass
  const noBypass: RuleValue = { kind: 'damageReduction', amount: 5 };
  const bypassed: RuleValue = {
    kind: 'spellResistance',
    amount: 5,
    // @ts-expect-error spell resistance has no bypass
    bypass: '-',
  };
  expect([legal, noBypass, bypassed]).toHaveLength(3);
});
