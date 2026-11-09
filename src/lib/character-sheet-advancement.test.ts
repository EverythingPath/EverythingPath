import { expect, test } from 'vitest';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  calculateCharacterSheetProjections,
  type SheetEntry,
  type AbilityScores,
  type CharacterSheetCatalogEntry,
} from './character-sheet';
import {
  representativeClassCatalog,
  representativeClassSchedules,
} from '../../tests/fixtures/catalog/representative-class-progressions';

function sheetInput({
  levels,
  scores = {},
  catalog = [],
  favoredClassIds,
}: {
  levels: Extract<SheetEntry, { kind: 'classLevel' }>[];
  scores?: Partial<AbilityScores>;
  catalog?: CharacterSheetCatalogEntry[];
  favoredClassIds?: string[];
}) {
  return {
    characterKind: 'pc' as const,
    entries: [
      {
        _id: 'base-row',
        kind: 'base',
        active: true,
        catalogEntryId: 'base',
        state: { kind: 'base', favoredClassIds },
      },
      ...levels,
    ] satisfies SheetEntry[],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: abilityKeys.map((ability) => ({
          target: abilityTargets[ability],
          bonusType: 'base' as const,
          value: scores[ability] ?? 10,
        })),
      },
      ...representativeClassCatalog,
      ...catalog,
    ],
  };
}
function level(
  position: number,
  classEntryId: string | null,
  choices: Partial<Extract<SheetEntry, { kind: 'classLevel' }>['state']> = {},
): Extract<SheetEntry, { kind: 'classLevel' }> {
  return {
    _id: `level-${position}`,
    kind: 'classLevel',
    active: true,
    state: {
      kind: 'classLevel',
      position,
      classEntryId,
      hpGained: 5,
      ...choices,
    },
  };
}

test.each([
  {
    id: 'fighter',
    bab: representativeClassSchedules.fullBab,
    fort: representativeClassSchedules.goodSave,
    ref: representativeClassSchedules.poorSave,
    will: representativeClassSchedules.poorSave,
  },
  {
    id: 'wizard',
    bab: representativeClassSchedules.halfBab,
    fort: representativeClassSchedules.poorSave,
    ref: representativeClassSchedules.poorSave,
    will: representativeClassSchedules.goodSave,
  },
  {
    id: 'rogue',
    bab: representativeClassSchedules.threeQuartersBab,
    fort: representativeClassSchedules.poorSave,
    ref: representativeClassSchedules.goodSave,
    will: representativeClassSchedules.poorSave,
  },
  {
    id: 'cleric',
    bab: representativeClassSchedules.threeQuartersBab,
    fort: representativeClassSchedules.goodSave,
    ref: representativeClassSchedules.poorSave,
    will: representativeClassSchedules.goodSave,
  },
])(
  '$id agrees with its representative class table through level 20',
  ({ id, bab, fort, ref, will }) => {
    for (let count = 1; count <= 20; count += 1) {
      const result = calculateCharacterSheet(
        sheetInput({
          levels: Array.from({ length: count }, (_, index) =>
            level(index + 1, id),
          ),
        }),
      );
      expect(result.derivedStatistics, `level ${count}`).toMatchObject({
        bab: { total: bab[count - 1] },
        fortitude: { total: fort[count - 1] },
        reflex: { total: ref[count - 1] },
        will: { total: will[count - 1] },
      });
      expect(result.breakdowns.bab.applied).toHaveLength(1);
    }
  },
);

test('row ability increases resolve before HP, saves and the other dependent statistics', () => {
  const result = calculateCharacterSheet(
    sheetInput({
      levels: [
        level(4, 'fighter', {
          abilityIncrease: 'constitution',
          favoredClassBonus: { choice: 'hp' },
        }),
        level(2, 'fighter'),
        level(1, 'fighter'),
        level(3, 'fighter'),
      ],
      scores: { constitution: 13, strength: 16, dexterity: 14, wisdom: 12 },
      favoredClassIds: ['fighter'],
    }),
  );
  expect(result).toMatchObject({
    hp: 29,
    abilities: { constitution: { score: 14, modifier: 2 } },
    derivedStatistics: {
      bab: { total: 4 },
      fortitude: { total: 6 },
      reflex: { total: 3 },
      will: { total: 2 },
      initiative: { total: 2 },
      cmb: { total: 7 },
      cmd: { total: 19 },
    },
  });
  expect(result.breakdowns['ability.con'].applied).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        sheetEntryId: 'level-4',
        value: 1,
        builtIn: true,
      }),
    ]),
  );
});

test('fixed racial Hit Dice contribute one progression and HP source, with a single first-HD feat', () => {
  const input = sheetInput({
    levels: [level(1, 'fighter'), level(2, null)],
    scores: { constitution: 14, intelligence: 14 },
  });
  const result = calculateCharacterSheet({
    ...input,
    racialHitDice: {
      count: 3,
      hpGained: 12,
      progression: {
        bab: 'threeQuarters',
        saves: { fort: 'good', ref: 'poor', will: 'poor' },
        skillRanksPerHitDie: 2,
      },
    },
  });
  expect(result).toMatchObject({
    level: 2,
    hitDice: 5,
    hp: 32,
    budgets: {
      generalFeats: 3,
      racialSkillRanks: 12,
      skillRanks: null,
      skillRankCap: 5,
    },
    derivedStatistics: {
      bab: { total: 3 },
      fortitude: { total: 7 },
      reflex: { total: 1 },
      will: { total: 1 },
    },
  });
  expect(result.classLevels).toMatchObject([
    {
      entryId: 'level-1',
      hitDice: 4,
      abilityIncreaseDue: true,
      skillRankCap: 4,
    },
    {
      entryId: 'level-2',
      hitDice: 5,
      abilityIncreaseDue: false,
      skillRankBudget: null,
    },
  ]);
});

test('skill budgets use current Intelligence retroactively, and rank caps check every recorded position', () => {
  const result = calculateCharacterSheet(
    sheetInput({
      levels: [
        level(4, 'fighter', { abilityIncrease: 'intelligence' }),
        level(2, 'fighter'),
        level(1, 'fighter', {
          skillRanks: { 'skill.per': 2 },
          favoredClassBonus: { choice: 'skill' },
        }),
        level(3, 'fighter', { skillRanks: { 'skill.per': 1 } }),
      ],
      scores: { intelligence: 13 },
      favoredClassIds: ['fighter'],
    }),
  );
  expect(result.budgets).toMatchObject({
    generalFeats: 2,
    skillRanks: 17,
    skillRankCap: 4,
  });
  expect(
    result.classLevels.map((row) => [
      row.position,
      row.classLevel,
      row.skillRankBudget,
      row.exceededSkillRankCaps,
    ]),
  ).toEqual([
    [1, 1, 5, [{ skill: 'skill.per', ranks: 2 }]],
    [2, 2, 4, []],
    [3, 3, 4, []],
    [4, 4, 4, []],
  ]);
  expect(result.warnings).toContainEqual(
    expect.objectContaining({
      kind: 'rules',
      check: 'skillRankCap',
      subject: 'level-1',
      target: { kind: 'classLevel', entryId: 'level-1', field: 'skillRanks' },
    }),
  );
});

test('off-milestone ability and nonfavored HP choices keep counting with advisory warnings', () => {
  const result = calculateCharacterSheet(
    sheetInput({
      levels: [
        level(1, 'wizard', {
          abilityIncrease: 'constitution',
          favoredClassBonus: { choice: 'hp' },
        }),
      ],
      scores: { constitution: 13 },
      favoredClassIds: ['fighter'],
    }),
  );
  expect(result.hp).toBe(8);
  expect(result.warnings).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        check: 'abilityIncreaseMilestone',
        kind: 'rules',
        subject: 'level-1',
      }),
      expect.objectContaining({
        check: 'favoredClassBonusNotFavored',
        kind: 'rules',
        subject: 'level-1',
      }),
    ]),
  );
});

test('Tiny CMB uses Dexterity and special size; armor caps AC Dexterity without capping CMD', () => {
  const result = calculateCharacterSheet(
    sheetInput({
      levels: [level(1, 'fighter')],
      scores: { strength: 16, dexterity: 18 },
    }),
    { size: 'tiny', armorMaxDexterityBonus: 1 },
  );
  expect(result.derivedStatistics).toMatchObject({
    cmb: { total: 3 },
    cmd: { total: 16 },
    flatFootedCmd: { total: 12 },
    ac: { total: 13 },
    touchAc: { total: 13 },
    flatFootedAc: { total: 12 },
    initiative: { total: 4 },
  });
  expect(result.derivedStatistics.cmb.applied).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ entryName: 'Dexterity', value: 4 }),
      expect.objectContaining({ entryName: 'Size', value: -2 }),
    ]),
  );
});

test('a favored original class covers its Unchained version without merging their base progressions', () => {
  const result = calculateCharacterSheet(
    sheetInput({
      levels: [
        level(1, 'rogue'),
        level(2, 'rogue-unchained', { favoredClassBonus: { choice: 'hp' } }),
      ],
      favoredClassIds: ['rogue'],
      catalog: [
        {
          _id: 'rogue-unchained',
          name: 'Rogue (Unchained)',
          ruleIdentity: 'rogue-unchained',
          modifiers: [],
          detail: {
            kind: 'class',
            classKind: 'base',
            counterpartOf: 'rogue',
            hitDie: 8,
            bab: 'threeQuarters',
            saves: { fort: 'poor', ref: 'good', will: 'poor' },
            skillRanksPerLevel: 8,
          },
        },
      ],
    }),
  );
  expect(result).toMatchObject({
    hp: 11,
    derivedStatistics: { bab: { total: 0 }, reflex: { total: 4 } },
  });
  expect(result.classLevels.map((row) => row.classLevel)).toEqual([1, 1]);
  expect(
    result.warnings.filter(
      (warning) => warning.check === 'favoredClassBonusNotFavored',
    ),
  ).toEqual([]);
  expect(result.warnings).toContainEqual(
    expect.objectContaining({
      kind: 'rules',
      check: 'classVersions',
      target: { kind: 'classLevels' },
    }),
  );
});

test('a Modifier requiring an active class follows Class Level class changes', () => {
  const adjustment = {
    _id: 'adjustment',
    ruleIdentity: 'adjustment',
    modifiers: [
      {
        target: 'init',
        bonusType: 'untyped',
        value: 4,
        condition: { whileActive: 'fighter' },
      },
    ],
  } satisfies CharacterSheetCatalogEntry;
  function initiative(classEntryId: string | null) {
    const input = sheetInput({
      levels: [level(1, classEntryId)],
      catalog: [adjustment],
    });
    return calculateCharacterSheet({
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
    }).derivedStatistics.initiative;
  }
  expect(initiative('fighter')).toMatchObject({ total: 4, conditional: [] });
  expect(initiative('wizard')).toMatchObject({
    total: 0,
    conditional: [expect.objectContaining({ value: 4 })],
  });
  expect(initiative(null)).toMatchObject({
    total: 0,
    conditional: [expect.objectContaining({ value: 4 })],
  });
});

test('favored-class warning fingerprints follow entitlement, without unrelated favorites or alternate prose', () => {
  function fingerprint(favoredClassIds: string[], note: string) {
    return calculateCharacterSheet(
      sheetInput({
        levels: [
          level(1, 'wizard', { favoredClassBonus: { choice: 'alt', note } }),
        ],
        favoredClassIds,
      }),
    ).warnings.find(
      (warning) => warning.check === 'favoredClassBonusNotFavored',
    )?.fingerprint;
  }
  expect(fingerprint(['fighter'], 'first note')).toBeDefined();
  expect(fingerprint(['fighter', 'rogue'], 'edited note')).toBe(
    fingerprint(['fighter'], 'first note'),
  );
  expect(fingerprint(['wizard'], 'first note')).toBeUndefined();
});

test('multiclass BAB is floored separately and each class supplies its good-save base', () => {
  const sheet = calculateCharacterSheet({
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
        _id: 'wizard-row',
        kind: 'classLevel',
        active: true,
        state: {
          kind: 'classLevel',
          classEntryId: 'wizard',
          position: 2,
          hpGained: 6,
        },
      },
      {
        _id: 'rogue-row',
        kind: 'classLevel',
        active: true,
        state: {
          kind: 'classLevel',
          classEntryId: 'rogue',
          position: 1,
          hpGained: 8,
        },
      },
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: abilityKeys.map((ability) => ({
          target: abilityTargets[ability],
          bonusType: 'base',
          value: 10,
        })),
      },
      {
        _id: 'wizard',
        name: 'Wizard',
        ruleIdentity: 'wizard',
        modifiers: [],
        detail: {
          kind: 'class',
          classKind: 'base',
          hitDie: 6,
          bab: 'half',
          saves: { fort: 'poor', ref: 'poor', will: 'good' },
          skillRanksPerLevel: 2,
        },
      },
      {
        _id: 'rogue',
        name: 'Rogue',
        ruleIdentity: 'rogue',
        modifiers: [],
        detail: {
          kind: 'class',
          classKind: 'base',
          hitDie: 8,
          bab: 'threeQuarters',
          saves: { fort: 'poor', ref: 'good', will: 'poor' },
          skillRanksPerLevel: 8,
        },
      },
    ],
  });
  expect(sheet.derivedStatistics).toMatchObject({
    bab: { total: 0 },
    fortitude: { total: 0 },
    reflex: { total: 2 },
    will: { total: 2 },
  });
});

// #298 staged variables read actual advancement, including racial HD (#222).
test('formula advancement variables use sorted class counts and separate Hit Dice from character level', () => {
  const input = sheetInput({
    levels: [
      level(3, 'fighter'),
      level(1, 'fighter'),
      level(2, 'wizard'),
      level(4, null),
    ],
    catalog: [
      {
        _id: 'formula',
        ruleIdentity: 'formula',
        modifiers: [
          {
            target: 'init',
            bonusType: 'untyped',
            value: {
              formula:
                '@hitDice * 100 + @level * 10 + @classLevel.fighter + @classLevel.wizard',
            },
          },
        ],
      },
    ],
  });
  const result = calculateCharacterSheet(
    {
      ...input,
      entries: [
        ...input.entries,
        {
          _id: 'formula-row',
          kind: 'manual',
          active: true,
          catalogEntryId: 'formula',
          state: { kind: 'manual' },
        },
      ],
      racialHitDice: {
        count: 3,
        hpGained: 12,
        progression: {
          bab: 'threeQuarters',
          saves: { fort: 'good', ref: 'poor', will: 'poor' },
          skillRanksPerHitDie: 2,
        },
      },
    },
    { classLevels: { fighter: 99, wizard: 99 }, level: 99, hitDice: 99 },
  );
  expect(result).toMatchObject({ level: 4, hitDice: 7, hp: 32 });
  expect(result.derivedStatistics.initiative.total).toBe(743);
  expect(
    result.warnings.filter((warning) => warning.check === 'unsupportedFormula'),
  ).toEqual([]);
});

// CRB class descriptions: roll the class hit die; first-level PCs maximize it.
test('above-die hit points remain in totals with a warning on the HP field', () => {
  const result = calculateCharacterSheet(
    sheetInput({ levels: [level(1, 'fighter', { hpGained: 11 })] }),
  );
  expect(result.hp).toBe(11);
  expect(result.warnings).toContainEqual(
    expect.objectContaining({
      check: 'hpGainedAboveMaximum',
      kind: 'rules',
      target: { kind: 'classLevel', entryId: 'level-1', field: 'hpGained' },
    }),
  );
});

test('only a PC without racial HD warns when its first Class Level HP differs from the hit die maximum', () => {
  const input = sheetInput({
    levels: [level(2, 'wizard'), level(1, 'fighter', { hpGained: 5 })],
  });
  const result = calculateCharacterSheet(input);
  expect(
    result.warnings.filter(
      (warning) => warning.check === 'firstLevelHpNotMaximum',
    ),
  ).toEqual([
    expect.objectContaining({
      target: { kind: 'classLevel', entryId: 'level-1', field: 'hpGained' },
    }),
  ]);
  for (const other of [
    { ...input, characterKind: 'npc' as const },
    {
      ...input,
      racialHitDice: {
        count: 1,
        hpGained: 4,
        progression: {
          bab: 'full' as const,
          saves: {
            fort: 'poor' as const,
            ref: 'poor' as const,
            will: 'poor' as const,
          },
          skillRanksPerHitDie: 2,
        },
      },
    },
    sheetInput({ levels: [level(1, 'fighter', { hpGained: 10 })] }),
    sheetInput({ levels: [level(1, 'fighter', { hpGained: null })] }),
  ])
    expect(
      calculateCharacterSheet(other).warnings.some(
        (warning) => warning.check === 'firstLevelHpNotMaximum',
      ),
    ).toBe(false);
});

// Data model Favored class: one normally, two when an active trait grants it.
test('more favored classes than the entitlement warns without discarding their bonuses', () => {
  const input = sheetInput({
    levels: [level(1, 'fighter', { favoredClassBonus: { choice: 'hp' } })],
    favoredClassIds: ['fighter', 'wizard'],
  });
  const result = calculateCharacterSheet(input);
  expect(result.hp).toBe(6);
  expect(result.warnings).toContainEqual(
    expect.objectContaining({
      check: 'favoredClassCount',
      kind: 'rules',
      target: { kind: 'favoredClasses' },
    }),
  );
  expect(
    calculateCharacterSheet({ ...input, favoredClassCount: 2 }).warnings.some(
      (warning) => warning.check === 'favoredClassCount',
    ),
  ).toBe(false);
});

test('a prestige favored class warns on the selection even without a Class Level in that class', () => {
  const fighter = representativeClassCatalog.find(
    (entry) => entry._id === 'fighter',
  )!;
  const input = sheetInput({
    levels: [],
    favoredClassIds: ['prestige'],
    catalog: [
      {
        ...fighter,
        _id: 'prestige',
        ruleIdentity: 'prestige',
        detail: { ...fighter.detail, classKind: 'prestige' },
      },
    ],
  });
  expect(calculateCharacterSheet(input).warnings).toContainEqual(
    expect.objectContaining({
      check: 'favoredClassPrestige',
      kind: 'rules',
      subject: 'class:prestige',
      target: { kind: 'favoredClasses' },
    }),
  );
});

// Data model Skills: permanent Intelligence retroactively determines rank budgets.
test('skill budgets exclude temporary Intelligence and ability damage while retaining ability drain', () => {
  const input = sheetInput({
    levels: [level(1, 'fighter')],
    scores: { intelligence: 14 },
    catalog: [
      {
        _id: 'int-spell',
        ruleIdentity: 'int-spell',
        detail: { kind: 'spellEffect', lastsOverOneDay: false },
        modifiers: [
          { target: 'ability.int', bonusType: 'enhancement', value: 4 },
        ],
      },
    ],
  });
  const affected = {
    ...input,
    entries: [
      ...input.entries,
      {
        _id: 'spell',
        kind: 'spellEffect' as const,
        active: true,
        catalogEntryId: 'int-spell',
        state: { kind: 'spellEffect' as const, casterLevel: 3 },
      },
      {
        _id: 'damage',
        kind: 'abilityDamage' as const,
        active: true,
        state: {
          kind: 'abilityDamage' as const,
          ability: 'intelligence' as const,
          points: 2,
        },
      },
      {
        _id: 'drain',
        kind: 'abilityDrain' as const,
        active: true,
        state: {
          kind: 'abilityDrain' as const,
          ability: 'intelligence' as const,
          points: 2,
        },
      },
    ],
  };
  const result = calculateCharacterSheet(affected);
  expect(result.abilities.intelligence).toEqual({ score: 16, modifier: 2 });
  expect(result.classLevels[0]?.skillRankBudget).toBe(3);
  expect(result.budgets.skillRanks).toBe(3);
  const paired = calculateCharacterSheetProjections(affected);
  expect(paired.current.budgets).toEqual(paired.permanent.budgets);
});
