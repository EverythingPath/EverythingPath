import { expect, expectTypeOf, test } from 'vitest';
import {
  resolveSheet,
  calculateCharacterSheet,
  abilityKeys,
  abilityTargets,
  type CharacterSheetInput,
  type LeafTarget,
  type Modifier,
  type ResolvedStatistic,
} from './character-sheet';
import {
  parseCharacterSheetBreakdowns,
  findCharacterSheetStatistic,
  spellcastingBreakdownTarget,
} from './character-sheet-breakdowns';
import { representativeClassCatalog } from '../../tests/fixtures/catalog/representative-class-progressions';
import {
  representativeAdditionalClassFeatures,
  representativeClassCatalog as seededClassCatalog,
  representativeClassFeatureSchedules,
} from '../../convex/lib/representativeClassCatalog';

function castingInput(modifiers: Modifier[]): CharacterSheetInput {
  return {
    characterKind: 'pc',
    entries: [
      {
        _id: 'base-row',
        active: true,
        kind: 'base',
        catalogEntryId: 'base',
        state: { kind: 'base' },
      },
      ...['wizard', 'wizard', 'wizard', 'cleric'].map(
        (classEntryId, index) => ({
          _id: `level-${index}`,
          active: true as const,
          kind: 'classLevel' as const,
          state: {
            kind: 'classLevel' as const,
            position: index + 1,
            classEntryId,
            hpGained: 6,
          },
        }),
      ),
      {
        _id: 'adjustment-row',
        active: true,
        kind: 'manual',
        catalogEntryId: 'adjustment',
        state: { kind: 'manual' },
      },
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: abilityKeys.map((ability) => ({
          target: abilityTargets[ability],
          bonusType: 'base' as const,
          value: ability === 'intelligence' ? 18 : 10,
        })),
      },
      ...representativeClassCatalog,
      { _id: 'adjustment', ruleIdentity: 'adjustment', modifiers },
    ],
  };
}

test('wire breakdowns parse into a complete map of typed leaf targets', () => {
  const breakdowns = resolveSheet(
    [
      {
        target: 'ability.str',
        bonusType: 'enhancement',
        value: 2,
        sheetEntryId: 'belt',
        entryName: 'Belt of giant strength',
        source: 'belt-rule',
        builtIn: false,
      },
      {
        target: 'ability.str',
        bonusType: 'enhancement',
        value: 4,
        sheetEntryId: 'strength-spell',
        entryName: 'Strength spell',
        source: 'strength-spell-rule',
        builtIn: false,
        condition: { whileActive: 'strength-spell-rule' },
        stacksWithinEntry: true,
        stacksWithItself: true,
      },
      {
        target: 'ability.str',
        bonusType: 'circumstance',
        value: 2,
        sheetEntryId: 'training',
        entryName: 'Special training',
        source: 'training-rule',
        builtIn: true,
        condition: { situation: { local: 'lifting' } },
      },
    ],
    { activeCatalogEntryIds: ['strength-spell-rule'] },
  );
  const parsed = parseCharacterSheetBreakdowns(breakdowns);
  expect(parsed).toEqual(breakdowns);
  expect(parsed['ability.str'].applied[0]?.sheetEntryId).toBe('strength-spell');
  expect(parsed['ability.str'].suppressed[0]).toMatchObject({
    sheetEntryId: 'belt',
    suppressedBy: 'strength-spell',
    reason: expect.any(String),
  });
  expect(parsed['ability.str'].conditional[0]?.sheetEntryId).toBe('training');
  expectTypeOf(parsed).toEqualTypeOf<Record<LeafTarget, ResolvedStatistic>>();
});

test('wire breakdowns refuse unknown targets', () => {
  expect(() =>
    parseCharacterSheetBreakdowns({
      ...resolveSheet([]),
      'ability.invalid': {
        total: 0,
        applied: [],
        suppressed: [],
        conditional: [],
      },
    }),
  ).toThrow();
});

test('wire breakdowns refuse missing targets instead of inventing totals', () => {
  const { hp: _hp, ...missing } = resolveSheet([]);
  expect(() => parseCharacterSheetBreakdowns(missing)).toThrow();
});

test('wire breakdowns refuse malformed statistic values', () => {
  expect(() =>
    parseCharacterSheetBreakdowns({
      ...resolveSheet([]),
      hp: { total: 'unknown', applied: [], suppressed: [], conditional: [] },
    }),
  ).toThrow();
});

test('a Spellcasting breakdown previews a Situation for its class and school without using aggregate leaf totals', () => {
  const input: CharacterSheetInput = {
    characterKind: 'pc',
    entries: [
      {
        _id: 'base-row',
        active: true,
        kind: 'base',
        catalogEntryId: 'base',
        state: { kind: 'base' },
      },
      {
        _id: 'wizard-level',
        active: true,
        kind: 'classLevel',
        state: {
          kind: 'classLevel',
          position: 1,
          classEntryId: 'wizard',
          hpGained: 6,
        },
      },
      {
        _id: 'cleric-level',
        active: true,
        kind: 'classLevel',
        state: {
          kind: 'classLevel',
          position: 2,
          classEntryId: 'cleric',
          hpGained: 8,
        },
      },
      {
        _id: 'focus-row',
        active: true,
        kind: 'manual',
        catalogEntryId: 'focus',
        state: { kind: 'manual' },
      },
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: abilityKeys.map((ability) => ({
          target: abilityTargets[ability],
          bonusType: 'base' as const,
          value: 10,
        })),
      },
      ...representativeClassCatalog,
      {
        _id: 'focus',
        ruleIdentity: 'focus',
        modifiers: [
          {
            target: 'spellDC',
            bonusType: 'circumstance',
            value: 2,
            condition: {
              castingClass: 'wizard',
              school: 'evocation',
              situation: { local: 'beside the altar' },
            },
          },
        ],
      },
    ],
  };
  const target = {
    kind: 'spellcasting' as const,
    classEntryId: 'wizard',
    statistic: {
      kind: 'dc' as const,
      spellLevel: 1,
      school: 'evocation',
    },
  };
  const ordinary = calculateCharacterSheet(input);
  const preview = calculateCharacterSheet(input, {
    situations: [{ local: 'beside the altar', sheetEntryId: 'focus-row' }],
  });
  // Intelligence/Wisdom 10: baseline 1st-level DC is 10 + 1.
  expect(findCharacterSheetStatistic(ordinary, target)?.total).toBe(11);
  expect(findCharacterSheetStatistic(preview, target)?.total).toBe(13);
  expect(
    findCharacterSheetStatistic(
      preview,
      spellcastingBreakdownTarget('cleric', { kind: 'dc', spellLevel: 1 }),
    )?.total,
  ).toBe(11);
  expect(findCharacterSheetStatistic(preview, 'spellDC')?.total).toBe(0);
  expect(
    findCharacterSheetStatistic(preview, { kind: 'derived', statistic: 'ac' })
      ?.total,
  ).toBe(10);
  expect(
    findCharacterSheetStatistic(
      preview,
      spellcastingBreakdownTarget('missing', { kind: 'concentration' }),
    ),
  ).toBeNull();
});

test('an unresolved school DC has no numeric lookup while ready schools, generic DCs and other classes retain theirs', () => {
  const input = castingInput([
    {
      target: 'spellDC',
      bonusType: 'untyped',
      value: { formula: '@missing' },
      condition: { castingClass: 'wizard', school: 'evocation' },
    },
    {
      target: 'spellDC',
      bonusType: 'untyped',
      value: 1,
      condition: {
        castingClass: 'wizard',
        school: 'evocation',
        situation: { local: 'in bright light' },
      },
    },
    {
      target: 'spellDC',
      bonusType: 'untyped',
      value: 2,
      condition: { castingClass: 'wizard', school: 'conjuration' },
    },
  ]);
  const ordinary = calculateCharacterSheet(input);
  const preview = calculateCharacterSheet(input, {
    situations: [{ local: 'in bright light', sheetEntryId: 'adjustment-row' }],
  });
  const evocation = spellcastingBreakdownTarget('wizard', {
    kind: 'dc',
    spellLevel: 1,
    school: 'evocation',
  });
  expect(findCharacterSheetStatistic(ordinary, evocation)).toBeNull();
  expect(findCharacterSheetStatistic(preview, evocation)).toBeNull();
  for (const [classEntryId, school, total] of [
    ['wizard', undefined, 15],
    ['wizard', 'conjuration', 17],
    ['wizard', 'illusion', 15],
    ['cleric', undefined, 11],
  ] as const) {
    expect(
      findCharacterSheetStatistic(
        preview,
        spellcastingBreakdownTarget(classEntryId, {
          kind: 'dc',
          spellLevel: 1,
          school,
        }),
      )?.total,
    ).toBe(total);
  }
});

test('a caster-level failure in a selected Situation hides only its unresolved numbers and dependencies', () => {
  const situation = { local: 'in bright light' };
  const input = castingInput([
    {
      target: 'casterLevel',
      bonusType: 'untyped',
      value: { formula: '@missing' },
      condition: { castingClass: 'wizard', situation },
    },
    {
      target: 'casterLevel',
      bonusType: 'untyped',
      value: 1,
      condition: { castingClass: 'wizard', situation },
    },
    {
      target: 'spellDC',
      bonusType: 'untyped',
      value: { formula: '@casterLevel.wizard' },
      condition: { castingClass: 'wizard', situation },
    },
  ]);
  const ordinary = calculateCharacterSheet(input);
  const preview = calculateCharacterSheet(input, {
    situations: [{ ...situation, sheetEntryId: 'adjustment-row' }],
  });
  for (const [statistic, total] of [
    [{ kind: 'casterLevel' }, 3],
    [{ kind: 'concentration' }, 7],
    [{ kind: 'dc', spellLevel: 1 }, 15],
    [{ kind: 'dc', spellLevel: 1, school: 'illusion' }, 15],
  ] as const) {
    const target = spellcastingBreakdownTarget('wizard', statistic);
    expect(findCharacterSheetStatistic(ordinary, target)?.total).toBe(total);
    expect(findCharacterSheetStatistic(preview, target)).toBeNull();
  }
  expect(
    findCharacterSheetStatistic(
      preview,
      spellcastingBreakdownTarget('cleric', { kind: 'casterLevel' }),
    )?.total,
  ).toBe(1);
  expect(
    findCharacterSheetStatistic(
      preview,
      spellcastingBreakdownTarget('cleric', { kind: 'dc', spellLevel: 1 }),
    )?.total,
  ).toBe(11);
});

test('a failed concentration modifier has no numeric lookup without hiding a ready caster level or DC', () => {
  const calculated = calculateCharacterSheet(
    castingInput([
      {
        target: 'concentration',
        bonusType: 'untyped',
        value: { formula: '@missing' },
        condition: { castingClass: 'wizard' },
      },
    ]),
  );
  expect(
    findCharacterSheetStatistic(
      calculated,
      spellcastingBreakdownTarget('wizard', { kind: 'concentration' }),
    ),
  ).toBeNull();
  expect(
    findCharacterSheetStatistic(
      calculated,
      spellcastingBreakdownTarget('wizard', { kind: 'casterLevel' }),
    )?.total,
  ).toBe(3);
  expect(
    findCharacterSheetStatistic(
      calculated,
      spellcastingBreakdownTarget('wizard', { kind: 'dc', spellLevel: 1 }),
    )?.total,
  ).toBe(15);
});

test('wire breakdowns retain scoped exclusions and targeted Situational Notes', () => {
  const breakdowns = resolveSheet(
    [
      {
        target: 'save.will',
        value: 3,
        bonusType: 'morale',
        sheetEntryId: 'other-school',
        entryName: 'School bonus',
        source: 'school',
        builtIn: false,
        condition: { school: 'evocation' },
      },
    ],
    {
      situationalNotes: [
        {
          target: 'save.will',
          situation: 'fear',
          text: 'Reroll once.',
          sheetEntryId: 'fearless',
          entryName: 'Fearless',
          source: 'fearless',
          builtIn: false,
        },
      ],
    },
  );
  const parsed = parseCharacterSheetBreakdowns(breakdowns);
  expect(parsed['save.will'].excluded?.map((row) => row.entryName)).toEqual([
    'School bonus',
  ]);
  expect(parsed['save.will'].notes?.map((note) => note.text)).toEqual([
    'Reroll once.',
  ]);
});

// The NPC Codex Cruel Devotee (monk 5) flurries from a base attack bonus of
// +5, the monk level (CRB p. 57; FAQ naz); the routine owns that statistic.
test('a flurry base attack target resolves its own routine’s flurry statistic', () => {
  const monk = seededClassCatalog.find(
    (definition) => definition.ruleIdentity === 'monk',
  );
  if (!monk) throw new Error('Missing seeded monk');
  const input: CharacterSheetInput = {
    characterKind: 'pc',
    entries: [
      {
        _id: 'base-row',
        active: true,
        kind: 'base',
        catalogEntryId: 'base',
        state: { kind: 'base' },
      },
      ...Array.from({ length: 5 }, (_, index) => ({
        _id: `level-${index + 1}`,
        active: true as const,
        kind: 'classLevel' as const,
        state: {
          kind: 'classLevel' as const,
          position: index + 1,
          classEntryId: 'monk',
          hpGained: 8,
        },
      })),
      {
        _id: 'fists',
        active: true,
        kind: 'attackRoutine',
        state: {
          kind: 'attackRoutine',
          name: 'Fists',
          weaponEntryId: 'unarmed',
          hands: 'one',
          mode: 'melee',
          options: ['monk-flurry'],
        },
      },
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: abilityKeys.map((ability) => ({
          target: abilityTargets[ability],
          bonusType: 'base' as const,
          value: 10,
        })),
      },
      {
        ...monk,
        _id: 'monk',
        detail: {
          ...monk.detail,
          featuresByLevel: representativeClassFeatureSchedules.monk ?? [],
        },
      },
      ...representativeAdditionalClassFeatures,
    ],
  };
  const calculated = calculateCharacterSheet(input);
  const statistic = findCharacterSheetStatistic(calculated, {
    kind: 'flurryBaseAttack',
    entryId: 'fists',
  });
  expect(statistic).toBe(calculated.attackRoutines[0]?.flurry?.baseAttackBonus);
  expect(statistic?.total).toBe(5);
  expect(
    findCharacterSheetStatistic(calculated, {
      kind: 'flurryBaseAttack',
      entryId: 'missing',
    }),
  ).toBeNull();
});
