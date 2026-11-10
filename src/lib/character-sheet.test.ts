import { expect, test } from 'vitest';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  calculatePointBuy,
} from './character-sheet';

test('point-buy cost reads base Modifiers directly, without resolved ability totals', () => {
  const input = warningSheet({ scores: [18, 14, 10, 10, 10, 10] });
  expect(
    calculatePointBuy({
      baseModifiers: input.catalogEntries.flatMap((entry) => entry.modifiers),
      abilityMethod: { kind: 'pointBuy', budget: 15 },
    }),
  ).toEqual({ spent: 22 });
});

test('base Modifiers supply all scores and round odd negative modifiers down', () => {
  const result = calculateCharacterSheet({
    characterKind: 'pc',
    entries: [
      {
        _id: 'base-row',
        kind: 'base',
        active: true,
        catalogEntryId: 'base',
        state: { kind: 'base' },
      },
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: [
          { target: 'ability.str', bonusType: 'base', value: 7 },
          { target: 'ability.dex', bonusType: 'base', value: 10 },
          { target: 'ability.con', bonusType: 'base', value: 14 },
          { target: 'ability.int', bonusType: 'base', value: 15 },
          { target: 'ability.wis', bonusType: 'base', value: 18 },
          { target: 'ability.cha', bonusType: 'base', value: 21 },
        ],
      },
    ],
  });
  expect(result).toMatchObject({
    abilities: {
      strength: { score: 7, modifier: -2 },
      dexterity: { score: 10, modifier: 0 },
      constitution: { score: 14, modifier: 2 },
      intelligence: { score: 15, modifier: 2 },
      wisdom: { score: 18, modifier: 4 },
      charisma: { score: 21, modifier: 5 },
    },
    level: 0,
    hitDice: 0,
    hp: 0,
  });
});

test.each([
  { hp: [8, 5], constitution: 14, total: 17 },
  { hp: [0, 1], constitution: 7, total: -3 },
  { hp: [8, null], constitution: 14, total: null },
  { hp: [0], constitution: 10, total: 0 },
])(
  'Class Levels derive level, Hit Dice and recorded HP: $hp / Con $constitution',
  ({ hp, constitution, total }) => {
    const result = calculateCharacterSheet({
      characterKind: 'pc',
      entries: [
        {
          _id: 'base-row',
          kind: 'base',
          active: true,
          catalogEntryId: 'base',
          state: { kind: 'base' },
        },
        ...hp.map((hpGained, index) => ({
          _id: `level-${index}`,
          kind: 'classLevel' as const,
          active: true as const,
          state: {
            kind: 'classLevel' as const,
            classEntryId: null,
            position: index + 1,
            hpGained,
          },
        })),
      ],
      catalogEntries: [
        {
          _id: 'base',
          ruleIdentity: 'base',
          modifiers: [
            { target: 'ability.str', bonusType: 'base', value: 10 },
            { target: 'ability.dex', bonusType: 'base', value: 10 },
            { target: 'ability.con', bonusType: 'base', value: constitution },
            { target: 'ability.int', bonusType: 'base', value: 10 },
            { target: 'ability.wis', bonusType: 'base', value: 10 },
            { target: 'ability.cha', bonusType: 'base', value: 10 },
          ],
        },
      ],
    });
    expect(result).toMatchObject({
      level: hp.length,
      hitDice: hp.length,
      hp: total,
    });
  },
);

test('missing or ambiguous base Catalog Entries remain unresolved instead of inventing scores', () => {
  const entries = [
    {
      _id: 'base-row',
      kind: 'base' as const,
      active: true as const,
      catalogEntryId: 'base',
      state: { kind: 'base' as const },
    },
  ];
  expect(() =>
    calculateCharacterSheet({
      characterKind: 'pc',
      entries: [],
      catalogEntries: [],
    }),
  ).toThrow('one base-scores entry');
  expect(() =>
    calculateCharacterSheet({
      characterKind: 'pc',
      entries: [...entries, ...entries],
      catalogEntries: [],
    }),
  ).toThrow('one base-scores entry');
  expect(() =>
    calculateCharacterSheet({
      characterKind: 'pc',
      entries,
      catalogEntries: [],
    }),
  ).toThrow('Base scores are unavailable');
  const modifiers = [
    { target: 'ability.str' as const, bonusType: 'base' as const, value: 10 },
    { target: 'ability.dex' as const, bonusType: 'base' as const, value: 10 },
    { target: 'ability.con' as const, bonusType: 'base' as const, value: 10 },
    { target: 'ability.int' as const, bonusType: 'base' as const, value: 10 },
    { target: 'ability.wis' as const, bonusType: 'base' as const, value: 10 },
    { target: 'ability.cha' as const, bonusType: 'base' as const, value: 10 },
  ];
  for (const invalid of [
    modifiers.slice(1),
    modifiers.map((modifier) => ({
      ...modifier,
      target: 'ability.str' as const,
    })),
    modifiers.map((modifier) => ({ ...modifier, value: NaN })),
  ]) {
    expect(() =>
      calculateCharacterSheet({
        characterKind: 'pc',
        entries,
        catalogEntries: [
          { _id: 'base', ruleIdentity: 'base', modifiers: invalid },
        ],
      }),
    ).toThrow('six finite Modifiers');
  }
});

function warningSheet({
  scores = [10, 10, 10, 10, 10, 10],
  abilityMethod = { kind: 'pointBuy', budget: 15 },
  hpGained = null,
}: {
  scores?: number[];
  abilityMethod?:
    | { kind: 'pointBuy'; budget: number }
    | { kind: 'rolled'; budget?: number };
  hpGained?: number | null;
} = {}) {
  return {
    characterKind: 'pc' as const,
    entries: [
      {
        _id: 'base-row',
        kind: 'base' as const,
        active: true as const,
        catalogEntryId: 'base',
        state: { kind: 'base' as const, abilityMethod },
      },
      {
        _id: 'level-row',
        kind: 'classLevel' as const,
        active: true as const,
        state: {
          kind: 'classLevel' as const,
          classEntryId: null,
          position: 1,
          hpGained,
        },
      },
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: abilityKeys.map((ability, index) => ({
          target: abilityTargets[ability],
          bonusType: 'base' as const,
          value: scores[index] ?? 10,
        })),
      },
    ],
  };
}

test('new sheets distinguish missing decisions, unresolved HP and advisory point-buy rules', () => {
  const result = calculateCharacterSheet(
    warningSheet({ scores: [18, 18, 10, 10, 10, 10] }),
  );
  expect(result.creationSettings).toEqual({
    abilityMethod: { kind: 'pointBuy', budget: 15 },
    traitCount: 2,
    campaignTraitRequired: false,
  });
  expect(result.pointBuy).toEqual({ spent: 34 });
  expect(result.warnings).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: 'incomplete',
        check: 'class',
        subject: 'level-row',
        target: { kind: 'classLevel', entryId: 'level-row', field: 'class' },
      }),
      expect.objectContaining({
        kind: 'incomplete',
        check: 'hpGainedMissing',
        subject: 'level-row',
        target: { kind: 'classLevel', entryId: 'level-row', field: 'hpGained' },
      }),
      expect.objectContaining({
        kind: 'unresolved',
        check: 'totalHpUnresolved',
        subject: 'sheet',
        target: { kind: 'hitPoints' },
      }),
      expect.objectContaining({
        kind: 'rules',
        check: 'pointBuy',
        subject: 'base-row',
        target: { kind: 'pointBuy' },
      }),
    ]),
  );
  expect(result.hp).toBeNull();
});

test.each([
  { scores: [7, 8, 9, 10, 11, 12], spent: -4, warning: false },
  {
    scores: [13, 14, 15, 16, 17, 18],
    spent: 55,
    warning: true,
  },
  { scores: [14, 14, 14, 10, 10, 10], spent: 15, warning: false },
  {
    scores: [19, 10, 10, 10, 10, 10],
    spent: null,
    warning: true,
  },
  {
    scores: [10.5, 10, 10, 10, 10, 10],
    spent: null,
    warning: true,
  },
])(
  'point-buy costs preserve scores and warn only about invalid or over-budget scores: $scores',
  ({ scores, spent, warning }) => {
    const result = calculateCharacterSheet(warningSheet({ scores }));
    expect(result.pointBuy).toEqual({ spent });
    expect(result.warnings.some((item) => item.check === 'pointBuy')).toBe(
      warning,
    );
    expect(result.abilities.strength.score).toBe(scores[0]);
    const rolled = calculateCharacterSheet(
      warningSheet({ scores, abilityMethod: { kind: 'rolled' } }),
    );
    expect(rolled.pointBuy).toBeNull();
    expect(rolled.warnings.some((item) => item.check === 'pointBuy')).toBe(
      false,
    );
  },
);

test('semantic fingerprints include relevant scores and budget but not catalog storage identity or unrelated HP', () => {
  const input = warningSheet({ scores: [18, 17, 10, 10, 10, 10] });
  const warning = (value: typeof input) =>
    calculateCharacterSheet(value).warnings.find(
      (item) => item.check === 'pointBuy',
    );
  const original = warning(input);
  expect(original).toBeDefined();
  expect(
    warning(warningSheet({ scores: [17, 18, 10, 10, 10, 10] }))?.fingerprint,
  ).not.toBe(original?.fingerprint);
  expect(
    warning(
      warningSheet({
        scores: [18, 17, 10, 10, 10, 10],
        abilityMethod: { kind: 'pointBuy', budget: 20 },
      }),
    )?.fingerprint,
  ).not.toBe(original?.fingerprint);
  expect(
    warning(warningSheet({ scores: [18, 17, 10, 10, 10, 10], hpGained: 8 })),
  ).toEqual(original);
  expect(
    warning({
      ...input,
      entries: input.entries.map((entry) =>
        entry.kind === 'base'
          ? { ...entry, catalogEntryId: 'remapped' }
          : entry,
      ),
      catalogEntries: input.catalogEntries.map((entry) => ({
        ...entry,
        _id: 'remapped',
      })),
    }),
  ).toEqual(original);
});

test('recorded HP below one and a PC without levels warn without changing totals or inventing a hit die', () => {
  const input = warningSheet({ hpGained: 0 });
  const result = calculateCharacterSheet(input);
  expect(result.hp).toBe(0);
  expect(result.warnings).toContainEqual(
    expect.objectContaining({
      kind: 'rules',
      check: 'hpGainedBelowMinimum',
      subject: 'level-row',
      target: { kind: 'classLevel', entryId: 'level-row', field: 'hpGained' },
    }),
  );
  expect(
    calculateCharacterSheet(warningSheet({ hpGained: 99 })).warnings.some(
      (item) => item.check === 'hpGainedBelowMinimum',
    ),
  ).toBe(false);
  const zero = {
    ...input,
    entries: input.entries.filter((entry) => entry.kind === 'base'),
  };
  expect(calculateCharacterSheet(zero).warnings).toContainEqual(
    expect.objectContaining({
      kind: 'rules',
      check: 'levelZero',
      subject: 'sheet',
      target: { kind: 'classLevels' },
    }),
  );
  expect(
    calculateCharacterSheet({ ...zero, characterKind: 'npc' }).warnings.some(
      (item) => item.check === 'levelZero',
    ),
  ).toBe(false);
});

test('personal Constitution adjustment changes HP and explains built-in Class Level contributions', () => {
  // CRB Constitution: https://legacy.aonprd.com/coreRulebook/gettingStarted.html#constitution
  const result = calculateCharacterSheet({
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
        _id: 'belt-row',
        kind: 'manual',
        active: true,
        catalogEntryId: 'belt',
        state: { kind: 'manual' },
      },
      {
        _id: 'level-1',
        kind: 'classLevel',
        active: true,
        state: {
          kind: 'classLevel',
          classEntryId: null,
          position: 1,
          hpGained: 8,
        },
      },
      {
        _id: 'level-2',
        kind: 'classLevel',
        active: true,
        state: {
          kind: 'classLevel',
          classEntryId: null,
          position: 2,
          hpGained: 5,
        },
      },
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: [
          { target: 'ability.str', bonusType: 'base', value: 10 },
          { target: 'ability.dex', bonusType: 'base', value: 10 },
          { target: 'ability.con', bonusType: 'base', value: 10 },
          { target: 'ability.int', bonusType: 'base', value: 10 },
          { target: 'ability.wis', bonusType: 'base', value: 10 },
          { target: 'ability.cha', bonusType: 'base', value: 10 },
        ],
      },
      {
        _id: 'belt',
        name: 'Belt of mighty constitution',
        ruleIdentity: 'belt',
        modifiers: [
          { target: 'ability.con', bonusType: 'enhancement', value: 4 },
        ],
      },
    ],
  });
  expect(result.abilities.constitution).toEqual({ score: 14, modifier: 2 });
  expect(result.hp).toBe(17);
  expect(result.breakdowns.hp.total).toBe(17);
  expect(
    result.breakdowns.hp.applied
      .filter((item) => item.builtIn)
      .map((item) => item.value),
  ).toEqual([8, 5, 4]);
  expect(
    result.breakdowns['ability.con'].applied.map((item) => item.entryName),
  ).toEqual(['Base scores', 'Belt of mighty constitution']);
});

test('a personal Strength adjustment changes the total without changing base point buy', () => {
  // #251 §2: six base Modifiers remain the recorded base scores; CRB Table 1–1.
  const input = warningSheet({ scores: [14, 14, 14, 10, 10, 10], hpGained: 8 });
  const original = calculateCharacterSheet(input);
  const adjusted = calculateCharacterSheet({
    ...input,
    entries: [
      ...input.entries,
      {
        _id: 'adjustment-row',
        kind: 'manual',
        active: true,
        catalogEntryId: 'adjustment',
        state: { kind: 'manual' },
      },
    ],
    catalogEntries: [
      ...input.catalogEntries,
      {
        _id: 'adjustment',
        ruleIdentity: 'adjustment',
        modifiers: [
          { target: 'ability.str', bonusType: 'enhancement', value: 2 },
        ],
      },
    ],
  });
  expect(original.pointBuy).toEqual({ spent: 15 });
  expect(adjusted.pointBuy).toEqual({ spent: 15 });
  expect(adjusted.abilities.strength.score).toBe(16);
  expect(adjusted.warnings).toEqual(original.warnings);
});

test('minimal calculations retain only the PC level-zero advisory and Full calculations expose missing choices', () => {
  const input = warningSheet({ scores: [18, 18, 10, 10, 10, 10] });
  expect(
    calculateCharacterSheet({ ...input, sheetMode: 'militiaOnly' }).warnings,
  ).toEqual([]);
  const entries = input.entries.filter((entry) => entry.kind === 'base');
  expect(
    calculateCharacterSheet({ ...input, entries, sheetMode: 'militiaOnly' })
      .warnings,
  ).toEqual([
    expect.objectContaining({
      check: 'levelZero',
      kind: 'rules',
      target: { kind: 'classLevels' },
    }),
  ]);
  expect(
    calculateCharacterSheet({
      ...input,
      entries,
      characterKind: 'npc',
      sheetMode: 'militiaOnly',
    }).warnings,
  ).toEqual([]);
  expect(
    calculateCharacterSheet({ ...input, sheetMode: 'full' }).warnings,
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ check: 'class' }),
      expect.objectContaining({ check: 'pointBuy' }),
    ]),
  );
});
