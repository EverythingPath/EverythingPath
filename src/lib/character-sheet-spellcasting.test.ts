import { expect, test } from 'vitest';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheetProjections,
  calculateCharacterSheet,
  type CharacterSheetClassDetail,
  type CharacterSheetInput,
  type Modifier,
} from './character-sheet';
import {
  findReviewedClassCasting,
  reviewedCastingTablesSchema,
} from './character-sheet-casting-tables';
import { evaluateCastingPrerequisite } from './character-sheet-spellcasting';
import reviewedCastingTables from '../../scripts/catalog/reviewed-casting-tables.json';
import {
  calculateCharacterSheetForRelease,
  calculateCharacterSheetProjectionsForRelease,
} from './catalog/calculation-dispatch';
import {
  retainedPriorCalculationIdentity,
  supersededCalculationIdentities,
} from './catalog/calculation-identities';
import { catalogRuntimeCompatibility } from './catalog/runtime-compatibility';

function build(
  classes: [string, number][],
  modifiers: Modifier[] = [],
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
      {
        _id: 'adjustment-row',
        kind: 'manual',
        active: true,
        catalogEntryId: 'adjustment',
        state: { kind: 'manual' },
      },
      ...classes.flatMap(([name, count], index) =>
        Array.from({ length: count }, (_, level) => ({
          _id: `${name}-${level}`,
          kind: 'classLevel' as const,
          active: true as const,
          state: {
            kind: 'classLevel' as const,
            classEntryId: name,
            position:
              classes.slice(0, index).reduce((sum, [, n]) => sum + n, 0) +
              level +
              1,
            hpGained: 6,
          },
        })),
      ),
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: abilityKeys.map((ability) => ({
          target: abilityTargets[ability],
          bonusType: 'base' as const,
          value:
            ability === 'intelligence' ? 18 : ability === 'wisdom' ? 16 : 10,
        })),
      },
      { _id: 'adjustment', ruleIdentity: 'adjustment', modifiers },
      ...classes.map(([name]) => ({
        _id: name,
        name,
        ruleIdentity: `class:${name}`,
        modifiers: [],
        detail: {
          kind: 'class',
          classKind: 'base',
          hitDie: 6,
          bab: 'half',
          saves: { fort: 'poor', ref: 'poor', will: 'good' },
          skillRanksPerLevel: 2,
          casting: findReviewedClassCasting(name),
        } as CharacterSheetClassDetail,
      })),
    ],
  };
}

test('a school scoped Situational Note creates its casting breakdown without changing a DC or leaking into other classes', () => {
  const input = build([
    ['wizard', 3],
    ['cleric', 1],
  ]);
  input.catalogEntries.find(
    (row) => row._id === 'adjustment',
  )!.situationalNotes = [
    {
      target: 'spellDC',
      situation: 'fear',
      text: 'Targets reroll successful saves.',
      condition: { castingClass: 'wizard', school: 'enchantment' },
    },
  ];
  const result = calculateCharacterSheet(input);
  const wizard = result.spellcastings.find((row) => row.classTag === 'wizard')!;
  const cleric = result.spellcastings.find((row) => row.classTag === 'cleric')!;
  const enchantment = wizard.slots[0]?.schoolDCs.find(
    (row) => row.school === 'enchantment',
  );
  expect(enchantment?.breakdown.total).toBe(14);
  expect(enchantment?.breakdown.notes?.[0]?.text).toBe(
    'Targets reroll successful saves.',
  );
  expect(wizard.slots[0]?.dc.notes ?? []).toEqual([]);
  expect(cleric.slots[0]?.schoolDCs).toEqual([]);
});

test('an unchosen school Note never creates a pseudo-school breakdown', () => {
  const input = build([['wizard', 3]]);
  input.catalogEntries.find(
    (row) => row._id === 'adjustment',
  )!.situationalNotes = [
    {
      target: 'spellDC',
      text: 'Reroll saves.',
      condition: { school: '$choice' },
    },
  ];
  expect(
    calculateCharacterSheet(input).spellcastings[0]?.slots[0]?.schoolDCs,
  ).toEqual([]);
});

test('Wizard 3 / Cleric 1 keeps class levels, slots and casting ability separate', () => {
  // CRB class tables: Wizard 3 has 4/2/1, Cleric 1 has 3/1 before domain slots.
  const { current } = calculateCharacterSheetProjections(
    build([
      ['wizard', 3],
      ['cleric', 1],
    ]),
  );
  expect(
    current.spellcastings.map((casting) => ({
      classTag: casting.classTag,
      castingLevel: casting.castingLevel,
      casterLevel: casting.casterLevel?.total,
      concentration: casting.concentration?.total,
      slots: casting.slots.map((slot) => slot.total),
    })),
  ).toEqual([
    {
      classTag: 'wizard',
      castingLevel: 3,
      casterLevel: 3,
      concentration: 7,
      slots: [4, 3, 2],
    },
    {
      classTag: 'cleric',
      castingLevel: 1,
      casterLevel: 1,
      concentration: 4,
      slots: [3, 2],
    },
  ]);
});

test('candidate casting tables change allowances without changing default sheet calculations', () => {
  const input = build([['wizard', 3]]);
  const tables = structuredClone(reviewedCastingTables);
  tables.tables['prepared-full'].rows[2]!.spellsPerDay[1] = 7;
  const candidateInput = {
    ...input,
    resources: { castingTables: reviewedCastingTablesSchema.parse(tables) },
  };
  const candidate = calculateCharacterSheet(candidateInput);
  expect(candidate.spellcastings[0]?.slots[1]).toMatchObject({
    spellLevel: 1,
    base: 7,
    bonus: 1,
    total: 8,
  });
  const projections = calculateCharacterSheetProjections(candidateInput);
  for (const projection of [projections.current, projections.permanent]) {
    expect(projection.spellcastings[0]?.slots[1]).toMatchObject({
      base: 7,
      total: 8,
    });
  }
  expect(
    calculateCharacterSheet(input).spellcastings[0]?.slots[1],
  ).toMatchObject({
    spellLevel: 1,
    base: 2,
    bonus: 1,
    total: 3,
  });
});

test('the retained prior and current calculation identities both use candidate resources', async () => {
  const [{ createHash }, { readFile }] = await Promise.all([
    import('node:crypto'),
    import('node:fs/promises'),
  ]);
  const defaultBytes = await readFile(
    'scripts/catalog/reviewed-casting-tables.json',
  );
  expect(
    createHash('sha256').update(defaultBytes).digest('hex'),
    'Bundled casting tables changed: retain the prior calculation defaults before changing this expectation.',
  ).toBe('09bba130ca658ee49a6bd36a4d66d626beeaa8a146246ac0b1c4737c03566266');
  const tables = structuredClone(reviewedCastingTables);
  const wizardLevelThree = tables.tables['prepared-full'].rows[2];
  if (!wizardLevelThree) throw new Error('Missing reviewed Wizard 3 table row');
  wizardLevelThree.spellsPerDay[1] = 7;
  const input = {
    ...build([['wizard', 3]]),
    resources: { castingTables: reviewedCastingTablesSchema.parse(tables) },
  };
  const prior = retainedPriorCalculationIdentity;
  for (const identity of [prior, catalogRuntimeCompatibility.calculation]) {
    expect(
      calculateCharacterSheetForRelease(identity, input).spellcastings[0]
        ?.slots[1],
    ).toMatchObject({ base: 7, total: 8 });
    const projections = calculateCharacterSheetProjectionsForRelease(
      identity,
      input,
    );
    for (const projection of [projections.current, projections.permanent])
      expect(projection.spellcastings[0]?.slots[1]).toMatchObject({
        base: 7,
        total: 8,
      });
  }
  expect(
    calculateCharacterSheetForRelease(prior, build([['wizard', 3]]))
      .spellcastings[0]?.slots[1],
  ).toMatchObject({ base: 2, total: 3 });
});

test('release calculation dispatch refuses identities without a retained implementation', () => {
  const input = build([['wizard', 3]]);
  for (const identity of [
    '',
    'future',
    ...supersededCalculationIdentities,
    `${catalogRuntimeCompatibility.calculation}:other`,
  ]) {
    expect(() => calculateCharacterSheetForRelease(identity, input)).toThrow(
      'Unavailable Catalog Release calculation behavior',
    );
    expect(() =>
      calculateCharacterSheetProjectionsForRelease(identity, input),
    ).toThrow('Unavailable Catalog Release calculation behavior');
  }
});

test('current Intelligence changes DC and concentration while permanent Intelligence supplies bonus slots', () => {
  const input = build(
    [
      ['wizard', 3],
      ['cleric', 1],
    ],
    [
      {
        target: 'spellDC',
        bonusType: 'untyped',
        value: 1,
        condition: { castingClass: 'wizard', school: 'evocation' },
      },
      {
        target: 'spellDC',
        bonusType: 'untyped',
        value: 2,
        condition: { castingClass: 'cleric' },
      },
    ],
  );
  input.entries = [
    ...input.entries,
    {
      _id: 'fox-row',
      kind: 'spellEffect',
      active: true,
      catalogEntryId: 'fox',
      state: { kind: 'spellEffect', casterLevel: 3 },
    },
  ];
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'fox',
      ruleIdentity: 'fox',
      detail: { kind: 'spellEffect' },
      modifiers: [
        { target: 'ability.int', bonusType: 'enhancement', value: 4 },
      ],
    },
  ];
  const { current, permanent } = calculateCharacterSheetProjections(input);
  const wizard = current.spellcastings[0]!;
  expect(wizard.slots[1]).toMatchObject({
    bonus: 1,
    total: 3,
    dc: { total: 17 },
    schoolDCs: [{ school: 'evocation', breakdown: { total: 18 } }],
  });
  expect(wizard.concentration?.total).toBe(9);
  expect(permanent.spellcastings[0]?.slots[1]?.dc.total).toBe(15);
  expect(current.spellcastings[1]?.slots[1]?.dc.total).toBe(16);
  expect(current.breakdowns.spellDC.total).toBe(0);
});

test('Magical Knack and Spell Focus follow their recorded class and school choices', () => {
  // Ultimate Campaign Magical Knack: +2 CL, capped at total Hit Dice; CRB Spell Focus: +1 school DC.
  const input = build([
    ['wizard', 1],
    ['cleric', 3],
  ]);
  input.entries = [
    ...input.entries,
    {
      _id: 'knack-row',
      kind: 'trait',
      active: true,
      catalogEntryId: 'knack',
      state: { kind: 'trait', choice: 'wizard' },
    },
    {
      _id: 'focus-row',
      kind: 'feat',
      active: true,
      catalogEntryId: 'focus',
      state: { kind: 'feat', choice: 'evocation' },
    },
  ];
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'knack',
      ruleIdentity: 'knack',
      detail: { kind: 'trait' },
      modifiers: [
        {
          target: 'casterLevel',
          bonusType: 'trait',
          value: { formula: 'min(2, @hitDice - @casterLevel)' },
          condition: { castingClass: '$choice' },
        },
      ],
    },
    {
      _id: 'focus',
      ruleIdentity: 'focus',
      detail: { kind: 'feat' },
      modifiers: [
        {
          target: 'spellDC',
          bonusType: 'untyped',
          value: 1,
          condition: { school: '$choice' },
        },
      ],
    },
  ];
  const { current } = calculateCharacterSheetProjections(input);
  expect(
    current.spellcastings.map((casting) => casting.casterLevel?.total),
  ).toEqual([3, 3]);
  expect(current.spellcastings[0]?.slots[1]?.schoolDCs[0]).toMatchObject({
    school: 'evocation',
    breakdown: { total: 16 },
  });
});

test('Class Levels referencing retained class copies produce one Spellcasting', () => {
  const input = build([
    ['wizard', 1],
    ['copy', 1],
  ]);
  const wizard = input.catalogEntries.find((entry) => entry._id === 'wizard')!;
  input.catalogEntries = input.catalogEntries.map((entry) =>
    entry._id === 'copy'
      ? { ...entry, ruleIdentity: wizard.ruleIdentity, detail: wizard.detail }
      : entry,
  );
  const { current } = calculateCharacterSheetProjections(input);
  expect(
    current.spellcastings.map((casting) => ({
      classTag: casting.classTag,
      castingLevel: casting.castingLevel,
      casterLevel: casting.casterLevel?.total,
    })),
  ).toEqual([{ classTag: 'wizard', castingLevel: 2, casterLevel: 2 }]);
});

test('typed casting clauses distinguish supported casting from unresolved inputs', () => {
  const input = build([
    ['wizard', 3],
    ['cleric', 1],
  ]);
  const { current } = calculateCharacterSheetProjections(input);
  expect(
    evaluateCastingPrerequisite(
      { kind: 'casterLevel', casterLevel: 3 },
      current,
    ),
  ).toBe('met');
  expect(
    evaluateCastingPrerequisite(
      { kind: 'canCast', canCast: { spellLevel: 2, kind: 'divine' } },
      current,
    ),
  ).toBe('unmet');
  expect(
    evaluateCastingPrerequisite(
      { kind: 'castsSpell', castsSpell: 'spell:magic-missile' },
      current,
    ),
  ).toBe('unresolved');
  const undecided = calculateCharacterSheetProjections({
    ...input,
    entries: input.entries.map((entry) =>
      entry.kind === 'classLevel'
        ? { ...entry, state: { ...entry.state, classEntryId: null } }
        : entry,
    ),
  }).current;
  expect(
    evaluateCastingPrerequisite(
      { kind: 'canCast', canCast: { spellLevel: 1 } },
      undecided,
    ),
  ).toBe('unresolved');
  expect(
    evaluateCastingPrerequisite(
      { kind: 'casterLevel', casterLevel: 4 },
      {
        ...current,
        spellcastings: current.spellcastings.map((casting) => ({
          ...casting,
          unresolved: ['casterLevel'],
        })),
      },
    ),
  ).toBe('unresolved');
});

test('an unsupported caster-level formula leaves its class eligibility unresolved without tainting other classes', () => {
  const { current } = calculateCharacterSheetProjections(
    build(
      [
        ['wizard', 3],
        ['cleric', 1],
      ],
      [
        {
          target: 'casterLevel',
          bonusType: 'untyped',
          value: { formula: '@missing' },
          condition: { castingClass: 'wizard' },
        },
      ],
    ),
  );
  expect(current.spellcastings[0]?.unresolved).toContain('casterLevel');
  expect(
    evaluateCastingPrerequisite(
      { kind: 'canCast', canCast: { spellLevel: 2, kind: 'arcane' } },
      current,
    ),
  ).toBe('met');
  expect(current.spellcastings[1]?.unresolved).toEqual([]);
  expect(
    evaluateCastingPrerequisite(
      { kind: 'casterLevel', casterLevel: 4 },
      current,
    ),
  ).toBe('unresolved');
  expect(
    evaluateCastingPrerequisite(
      {
        kind: 'anyOf',
        anyOf: [
          { kind: 'casterLevel', casterLevel: 4 },
          { kind: 'canCast', canCast: { spellLevel: 1, kind: 'divine' } },
        ],
      },
      current,
    ),
  ).toBe('met');
  expect(
    current.warnings.filter(
      (warning) => warning.check === 'unsupportedFormula',
    ),
  ).toHaveLength(1);
});

test('school-specific situational modifiers remain discoverable before that Situation applies', () => {
  const { current } = calculateCharacterSheetProjections(
    build(
      [['wizard', 1]],
      [
        {
          target: 'spellDC',
          bonusType: 'untyped',
          value: 2,
          condition: { school: 'evocation', situation: 'in bright light' },
        },
      ],
    ),
  );
  expect(current.spellcastings[0]?.slots[1]?.schoolDCs[0]).toMatchObject({
    school: 'evocation',
    breakdown: {
      total: 15,
      conditional: [
        { condition: { school: 'evocation', situation: 'in bright light' } },
      ],
    },
  });
});

test('school DC breakdowns retain suppressed school contributions when the total stays equal', () => {
  const { current } = calculateCharacterSheetProjections(
    build(
      [['wizard', 1]],
      [
        { target: 'spellDC', bonusType: 'enhancement', value: 2 },
        {
          target: 'spellDC',
          bonusType: 'enhancement',
          value: 1,
          condition: { school: 'evocation' },
        },
      ],
    ),
  );
  expect(current.spellcastings[0]?.slots[1]?.schoolDCs[0]).toMatchObject({
    school: 'evocation',
    breakdown: {
      total: 17,
      suppressed: [{ value: 1, condition: { school: 'evocation' } }],
    },
  });
});

test.each([
  ['paladin', 3, null, [], false],
  ['paladin', 4, 1, [1], false],
  ['bloodrager', 4, 4, [1], false],
  ['sorcerer', 1, 1, [0, 1], true],
  ['arcanist', 1, 1, [0, 1], true],
  ['adept', 1, 1, [0, 1], false],
  ['medium', 1, 1, [0], true],
  ['occultist', 1, 1, [0, 1], true],
] as const)(
  '%s %i uses its class offset and preserves supported zero-level casting',
  (classTag, level, casterLevel, castableSpellLevels, cantrips) => {
    // Reviewed CRB/APG/ACG/Occult Adventures class tables; see reviewed-casting-tables.json provenance.
    const casting = calculateCharacterSheetProjections(
      build([[classTag, level]]),
    ).current.spellcastings[0]!;
    expect({
      casterLevel: casting.casterLevel?.total ?? null,
      castableSpellLevels: casting.castableSpellLevels,
      cantrips: casting.cantrips,
    }).toEqual({ casterLevel, castableSpellLevels, cantrips });
    if (classTag === 'paladin' && level === 4)
      expect(casting.slots[0]).toMatchObject({
        spellLevel: 1,
        base: 0,
        total: 0,
      });
    if (classTag === 'sorcerer')
      expect(casting.slots[0]).toMatchObject({
        spellLevel: 0,
        base: null,
        bonus: 0,
        known: 4,
      });
    if (classTag === 'arcanist')
      expect(casting.slots[1]).toMatchObject({
        spellLevel: 1,
        base: 2,
        bonus: 1,
        total: 3,
        prepared: 2,
      });
    if (classTag === 'adept')
      expect(casting.slots[0]).toMatchObject({
        spellLevel: 0,
        base: 3,
        bonus: 0,
        total: 3,
      });
  },
);

test('caster levels continue after table level 20 while slot allowances stop at row 20', () => {
  const casting = calculateCharacterSheetProjections(build([['wizard', 25]]))
    .current.spellcastings[0]!;
  expect(casting).toMatchObject({
    castingLevel: 25,
    tableLevel: 20,
    casterLevel: { total: 25 },
  });
  expect(casting.slots[9]).toMatchObject({
    spellLevel: 9,
    base: 4,
    bonus: 0,
    total: 4,
    dc: { total: 23 },
  });
});

test('downstream named caster formulas read each projection after caster-level modifiers', () => {
  const input = build(
    [['wizard', 3]],
    [
      {
        target: 'damage.melee',
        bonusType: 'untyped',
        value: { formula: '@casterLevel.wizard + @casterLevel.arcane' },
      },
    ],
  );
  input.entries = [
    ...input.entries,
    {
      _id: 'caster-boost-row',
      kind: 'spellEffect',
      active: true,
      catalogEntryId: 'caster-boost',
      state: { kind: 'spellEffect', casterLevel: 3 },
    },
  ];
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'caster-boost',
      ruleIdentity: 'caster-boost',
      detail: { kind: 'spellEffect' },
      modifiers: [{ target: 'casterLevel', bonusType: 'untyped', value: 2 }],
    },
  ];
  const { current, permanent } = calculateCharacterSheetProjections(input);
  expect(current.breakdowns['damage.melee'].total).toBe(10);
  expect(permanent.breakdowns['damage.melee'].total).toBe(6);
});

test('failed caster level propagates only to concentration and formulas that read it', () => {
  const current = calculateCharacterSheet(
    build(
      [
        ['wizard', 3],
        ['cleric', 1],
      ],
      [
        {
          target: 'casterLevel',
          bonusType: 'untyped',
          value: { formula: '@missing' },
          condition: { castingClass: 'wizard' },
        },
        {
          target: 'spellDC',
          bonusType: 'untyped',
          value: { formula: '@casterLevel.wizard' },
          condition: { castingClass: 'wizard' },
        },
        {
          target: 'spellDC',
          bonusType: 'untyped',
          value: 1,
          condition: { castingClass: 'wizard', school: 'evocation' },
        },
        {
          target: 'spellDC',
          bonusType: 'untyped',
          value: 1,
          condition: { castingClass: 'cleric', school: 'conjuration' },
        },
        {
          target: 'damage.melee',
          bonusType: 'untyped',
          value: { formula: '@casterLevel.arcane' },
        },
      ],
    ),
  );
  const [wizard, cleric] = current.spellcastings;
  expect(wizard?.unresolved).toEqual([
    'casterLevel',
    'spellDC',
    'concentration',
  ]);
  expect(wizard?.concentration).toBeNull();
  expect(wizard?.slots[1]).toMatchObject({
    dc: { total: 15 },
    dcUnresolved: true,
    schoolDCs: [
      { school: 'evocation', breakdown: { total: 16 }, unresolved: true },
    ],
  });
  expect(cleric?.unresolved).toEqual([]);
  expect(cleric?.concentration?.total).toBe(4);
  expect(cleric?.slots[1]).toMatchObject({
    dcUnresolved: false,
    schoolDCs: [
      { school: 'conjuration', breakdown: { total: 15 }, unresolved: false },
    ],
  });
  expect(current.breakdowns['damage.melee'].total).toBe(0);
  expect(
    current.warnings.some(
      (warning) =>
        warning.target.kind === 'modifier' &&
        warning.target.modifierIndex === 4,
    ),
  ).toBe(true);
});

test('a failed wizard caster level leaves ordinary DCs and cleric caster formulas resolved', () => {
  const current = calculateCharacterSheet(
    build(
      [
        ['wizard', 3],
        ['cleric', 1],
      ],
      [
        {
          target: 'casterLevel',
          bonusType: 'untyped',
          value: { formula: '@missing' },
          condition: { castingClass: 'wizard' },
        },
        {
          target: 'spellDC',
          bonusType: 'untyped',
          value: { formula: '@casterLevel.cleric' },
          condition: { castingClass: 'cleric' },
        },
      ],
    ),
  );
  expect(current.spellcastings[0]?.unresolved).toEqual([
    'casterLevel',
    'concentration',
  ]);
  expect(current.spellcastings[0]?.slots[1]?.dc.total).toBe(15);
  expect(current.spellcastings[1]?.unresolved).toEqual([]);
  expect(current.spellcastings[1]?.slots[1]?.dc.total).toBe(15);
});

test('a failed school DC formula leaves ordinary DCs, concentration and other classes resolved', () => {
  const current = calculateCharacterSheet(
    build(
      [
        ['wizard', 3],
        ['cleric', 1],
      ],
      [
        {
          target: 'spellDC',
          bonusType: 'untyped',
          value: { formula: '@missing' },
          condition: { castingClass: 'wizard', school: 'evocation' },
        },
      ],
    ),
  );
  const [wizard, cleric] = current.spellcastings;
  expect(wizard?.unresolved).toEqual(['spellDC']);
  expect(wizard?.concentration?.total).toBe(7);
  expect(wizard?.slots[1]).toMatchObject({
    dc: { total: 15 },
    dcUnresolved: false,
    schoolDCs: [
      { school: 'evocation', breakdown: { total: 15 }, unresolved: true },
    ],
  });
  expect(cleric?.unresolved).toEqual([]);
  expect(cleric?.concentration?.total).toBe(4);
  expect(cleric?.slots[1]).toMatchObject({
    dc: { total: 14 },
    dcUnresolved: false,
    schoolDCs: [],
  });
});

test('caster formula failure in one class does not mark a successful class incomplete', () => {
  const current = calculateCharacterSheet(
    build(
      [
        ['wizard', 3],
        ['cleric', 1],
      ],
      [
        {
          target: 'casterLevel',
          bonusType: 'untyped',
          value: { formula: '2 / (@casterLevel - 1)' },
        },
      ],
    ),
  );
  expect(current.spellcastings[0]?.unresolved).toEqual([]);
  expect(current.spellcastings[0]?.casterLevel?.total).toBe(4);
  expect(current.spellcastings[0]?.concentration?.total).toBe(8);
  expect(current.spellcastings[1]?.unresolved).toEqual([
    'casterLevel',
    'concentration',
  ]);
  expect(current.spellcastings[1]?.concentration).toBeNull();
});
