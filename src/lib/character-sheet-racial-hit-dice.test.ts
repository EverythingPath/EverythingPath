import { expect, test } from 'vitest';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  type CharacterSheetInput,
  type SheetEntry,
} from './character-sheet';
import {
  creatureTypeProgressionSeeds,
  findRacialProgression,
} from './character-sheet-creature-types';

function racialSheet(creatureType: string, count: number): CharacterSheetInput {
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
        _id: 'race-row',
        kind: 'race',
        active: true,
        catalogEntryId: 'race',
        state: {
          kind: 'race',
          racialHpGained: 7,
          racialSkillRanks: { per: 1 },
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
        _id: 'race',
        ruleIdentity: 'custom-race',
        modifiers: [],
        detail: {
          kind: 'race',
          racialTraits: [],
          racialHitDice: count,
          racialProgression: findRacialProgression(creatureType),
        },
      },
    ],
  };
}

// Bestiary type features, imported by #253; #222 permits editing every default.
test('all thirteen imported creature types supply editable race progression without Class Levels', () => {
  expect(creatureTypeProgressionSeeds).toHaveLength(13);
  const result = calculateCharacterSheet(racialSheet('dragon', 3));
  expect(result).toMatchObject({
    level: 0,
    racialHitDice: 3,
    hitDice: 3,
    hp: 7,
    budgets: { generalFeats: 2, racialSkillRanks: 18, skillRankCap: 3 },
    derivedStatistics: {
      bab: { total: 3 },
      fortitude: { total: 3 },
      reflex: { total: 3 },
      will: { total: 3 },
    },
  });
  expect(
    result.skills.find((skill) => skill.key === 'skill.per'),
  ).toMatchObject({
    ranks: 1,
    classSkill: true,
  });
  const changed = findRacialProgression('dragon')!;
  changed.saves.fort = 'poor';
  expect(findRacialProgression('dragon')?.saves.fort).toBe('good');
  expect(findRacialProgression('unlisted homebrew')).toBeUndefined();
});

// CRB/#215: 1st HD and each later odd HD, never an extra feat for the first.
test.each([
  [0, 0],
  [1, 1],
  [2, 1],
  [3, 2],
  [4, 2],
  [5, 3],
  [20, 10],
])(
  '%s fixed racial HD permit %s ordinary feats while extra choices remain advisory',
  (count, budget) => {
    const input = racialSheet('animal', count);
    const feats = Array.from({ length: budget + 1 }, (_, index) => ({
      _id: `feat-${index}`,
      kind: 'feat' as const,
      active: true,
      catalogEntryId: 'feat',
      state: { kind: 'feat' as const },
    }));
    input.entries = [...input.entries, ...feats];
    input.catalogEntries = [
      ...input.catalogEntries,
      {
        _id: 'feat',
        ruleIdentity: 'feat',
        modifiers: [],
        detail: { kind: 'feat' },
      },
    ];
    const result = calculateCharacterSheet(input);
    expect(result.budgets.generalFeats).toBe(budget);
    expect(result.selectionRules.budgets.generalFeats).toBe(budget);
    expect(
      result.selectionRules.slots.find((slot) => slot.id === 'feat:general'),
    ).toMatchObject({ count: budget, used: budget + 1, remaining: -1 });
    expect(
      result.warnings.filter(
        (warning) =>
          warning.check === 'featSlotBudget' &&
          warning.subject === 'feat:general',
      ),
    ).toHaveLength(1);
    expect(
      result.resolvedEntries.filter(
        (row) => row.entry.kind === 'feat' && row.counting,
      ),
    ).toHaveLength(budget + 1);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        check: 'featSlotBudget',
        subject: 'feat:general',
        kind: 'rules',
        target: { kind: 'entry', entryId: 'base-row' },
      }),
    );
    input.entries = input.entries.filter(
      (entry) => entry._id !== `feat-${budget}`,
    );
    expect(
      calculateCharacterSheet(input).warnings.some(
        (warning) =>
          warning.check === 'featSlotBudget' &&
          warning.subject === 'feat:general' &&
          warning.kind === 'rules',
      ),
    ).toBe(false);
  },
);

// #220's Bestiary type table: three racial HD, before ability modifiers.
test.each([
  ['aberration', 2, 1, 1, 3, 12],
  ['animal', 2, 3, 3, 1, 6],
  ['construct', 3, 1, 1, 1, 6],
  ['dragon', 3, 3, 3, 3, 18],
  ['fey', 1, 1, 3, 3, 18],
  ['humanoid', 2, 1, 3, 1, 6],
  ['magicalBeast', 3, 3, 3, 1, 6],
  ['monstrousHumanoid', 3, 1, 3, 3, 12],
  ['ooze', 2, 1, 1, 1, 6],
  ['outsider', 3, 1, 3, 3, 18],
  ['plant', 2, 3, 1, 1, 6],
  ['undead', 2, 1, 1, 3, 12],
  ['vermin', 2, 3, 1, 1, 6],
] as const)(
  '%s racial HD follow their own BAB, save and rank progression',
  (creatureType, bab, fort, ref, will, ranks) => {
    expect(calculateCharacterSheet(racialSheet(creatureType, 3))).toMatchObject(
      {
        level: 0,
        hitDice: 3,
        hp: 7,
        budgets: { racialSkillRanks: ranks },
        derivedStatistics: {
          bab: { total: bab },
          fortitude: { total: fort },
          reflex: { total: ref },
          will: { total: will },
        },
      },
    );
  },
);

function addWizardLevels(input: CharacterSheetInput, count: number) {
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'wizard',
      ruleIdentity: 'wizard',
      modifiers: [],
      detail: {
        kind: 'class',
        classKind: 'base',
        hitDie: 6,
        bab: 'half',
        saves: { fort: 'poor', ref: 'poor', will: 'good' },
        skillRanksPerLevel: 2,
        classSkills: ['per'],
      },
    },
  ];
  input.entries = [
    ...input.entries,
    ...Array.from(
      { length: count },
      (_, index): Extract<SheetEntry, { kind: 'classLevel' }> => ({
        _id: `level-${index + 1}`,
        kind: 'classLevel' as const,
        active: true,
        state: {
          kind: 'classLevel' as const,
          classEntryId: 'wizard',
          position: index + 1,
          hpGained: 4,
          skillRanks: index === 0 ? { per: 1 } : {},
        },
      }),
    ),
  ];
}

test('racial and class skill ranks sum with one class-skill bonus, and both good saves add their own +2', () => {
  const input = racialSheet('aberration', 3);
  addWizardLevels(input, 1);
  const result = calculateCharacterSheet(input);
  expect(result).toMatchObject({
    level: 1,
    hitDice: 4,
    hp: 11,
    budgets: { generalFeats: 2, skillRankCap: 4 },
    derivedStatistics: { bab: { total: 2 }, will: { total: 5 } },
  });
  expect(result.skills.find((skill) => skill.key === 'skill.per')?.ranks).toBe(
    2,
  );
  expect(result.breakdowns['skill.per'].total).toBe(5);
  expect(
    result.breakdowns['skill.per'].applied.filter(
      (source) => source.entryName === 'Class skill',
    ),
  ).toHaveLength(1);
  expect(
    result.warnings.some(
      (warning) => warning.check === 'firstLevelHpNotMaximum',
    ),
  ).toBe(false);
});

test('an inactive race contributes neither HD, ranks, progression nor racial class skills', () => {
  const input = racialSheet('dragon', 3);
  input.entries = input.entries.map((entry) =>
    entry.kind === 'race' ? { ...entry, active: false } : entry,
  );
  const result = calculateCharacterSheet(input);
  expect(result).toMatchObject({
    level: 0,
    racialHitDice: 0,
    hitDice: 0,
    hp: 0,
    budgets: { generalFeats: 0, racialSkillRanks: 0 },
  });
  expect(
    result.skills.find((skill) => skill.key === 'skill.per'),
  ).toMatchObject({ ranks: 0, classSkill: false });
});

test('zero racial HD preserve recorded ranks and HP without contributing or warning', () => {
  const input = racialSheet('dragon', 0);
  input.entries = input.entries.map((entry) =>
    entry.kind === 'race'
      ? { ...entry, state: { ...entry.state, racialSkillRanks: { per: 3 } } }
      : entry,
  );
  addWizardLevels(input, 1);
  const result = calculateCharacterSheet(input);
  expect(
    result.skills.find((skill) => skill.key === 'skill.per'),
  ).toMatchObject({ ranks: 1 });
  expect(
    result.warnings.filter((warning) =>
      ['racialSkillRankCap', 'racialSkillRankBudget', 'skillRankCap'].includes(
        warning.check,
      ),
    ),
  ).toEqual([]);
  input.catalogEntries = input.catalogEntries.map((entry) =>
    entry.detail?.kind === 'race'
      ? { ...entry, detail: { ...entry.detail, racialHitDice: 3 } }
      : entry,
  );
  const restored = calculateCharacterSheet(input);
  expect(
    restored.skills.find((skill) => skill.key === 'skill.per'),
  ).toMatchObject({ ranks: 4 });
  expect(restored.hp).toBe(11);
});

test('rank caps check cumulative racial and class ranks against HD at every Class Level', () => {
  const input = racialSheet('dragon', 3);
  input.entries = input.entries.map((entry) =>
    entry.kind === 'race'
      ? { ...entry, state: { ...entry.state, racialSkillRanks: { per: 3 } } }
      : entry,
  );
  addWizardLevels(input, 3);
  input.entries = input.entries.map((entry) =>
    entry.kind === 'classLevel' && entry.state.position === 2
      ? { ...entry, state: { ...entry.state, skillRanks: { per: 2 } } }
      : entry,
  );
  const result = calculateCharacterSheet(input);
  expect(
    result.classLevels.map((level) => [
      level.skillRankCap,
      level.cumulativeSkillRanks,
    ]),
  ).toEqual([
    [4, [{ skill: 'skill.per', ranks: 4 }]],
    [5, [{ skill: 'skill.per', ranks: 6 }]],
    [6, [{ skill: 'skill.per', ranks: 6 }]],
  ]);
  expect(
    result.warnings
      .filter((warning) => warning.check === 'skillRankCap')
      .map((warning) => warning.subject),
  ).toEqual(['level-2']);
});

test('racial rank warnings name the skill rather than its internal key', () => {
  const input = racialSheet('dragon', 1);
  input.entries = input.entries.map((entry) =>
    entry.kind === 'race'
      ? { ...entry, state: { ...entry.state, racialSkillRanks: { acr: 2 } } }
      : entry,
  );
  expect(
    calculateCharacterSheet(input).warnings.find(
      (warning) => warning.check === 'racialSkillRankCap',
    )?.message,
  ).toBe('Racial Acrobatics ranks exceed 1 racial Hit Dice.');
});

// #222 accepts either the Class Level position or total HD at 4/8/12/16/20.
test.each([
  { count: 3, levels: 5, increases: [4], missing: false },
  { count: 3, levels: 5, increases: [1, 5], missing: false },
  { count: 3, levels: 5, increases: [1], missing: true },
  { count: 3, levels: 5, increases: [], missing: true },
  { count: 3, levels: 4, increases: [1], missing: false },
  { count: 3, levels: 4, increases: [4], missing: false },
  { count: 0, levels: 8, increases: [4, 8], missing: false },
  { count: 0, levels: 8, increases: [4], missing: true },
  { count: 5, levels: 2, increases: [], missing: false },
])(
  'ability warnings accept a complete milestone reading: $count racial HD, $levels Class Levels, $increases',
  ({ count, levels, increases, missing }) => {
    const input = racialSheet('animal', count);
    addWizardLevels(input, levels);
    input.entries = input.entries.map((entry) =>
      entry.kind === 'classLevel' && increases.includes(entry.state.position)
        ? { ...entry, state: { ...entry.state, abilityIncrease: 'strength' } }
        : entry,
    );
    expect(
      calculateCharacterSheet(input).warnings.some(
        (warning) => warning.check === 'abilityIncreaseMissing',
      ),
    ).toBe(missing);
  },
);

test('ability-increase warnings accept either milestone reading while racial HD never add an increase field', () => {
  const input = racialSheet('animal', 3);
  addWizardLevels(input, 4);
  input.entries = input.entries.map((entry) =>
    entry.kind === 'classLevel' && [1, 2, 4].includes(entry.state.position)
      ? { ...entry, state: { ...entry.state, abilityIncrease: 'strength' } }
      : entry,
  );
  const result = calculateCharacterSheet(input);
  expect(
    result.warnings
      .filter((warning) => warning.check === 'abilityIncreaseMilestone')
      .map((warning) => warning.subject),
  ).toEqual(['level-2']);
  expect(
    result.warnings.some(
      (warning) => warning.check === 'abilityIncreaseMissing',
    ),
  ).toBe(false);
  expect(result.abilities.strength.score).toBe(13);
});

test('granted feats and feats chosen in named bonus slots do not consume the ordinary HD feat budget', () => {
  const input = racialSheet('animal', 1);
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'source',
      ruleIdentity: 'source',
      modifiers: [],
      grants: [{ catalogEntryId: 'feat' }],
      grantsSlots: [{ kind: 'feat', count: 1 }],
    },
    {
      _id: 'feat',
      ruleIdentity: 'feat',
      modifiers: [],
      detail: { kind: 'feat' },
    },
  ];
  input.entries = [
    ...input.entries,
    {
      _id: 'source-row',
      kind: 'manual',
      active: true,
      catalogEntryId: 'source',
      state: { kind: 'manual' },
    },
    {
      _id: 'ordinary',
      kind: 'feat',
      active: true,
      catalogEntryId: 'feat',
      state: { kind: 'feat' },
    },
    {
      _id: 'bonus',
      kind: 'feat',
      active: true,
      catalogEntryId: 'feat',
      state: { kind: 'feat' },
      selectionSource: {
        kind: 'slot',
        grantedBy: { kind: 'entry', entryId: 'source-row' },
      },
    },
  ];
  const result = calculateCharacterSheet(input);
  expect(
    result.resolvedEntries.filter(
      (row) => row.entry.kind === 'feat' && row.counting,
    ),
  ).toHaveLength(3);
  expect(
    result.warnings.some(
      (warning) =>
        warning.check === 'featSlotBudget' &&
        warning.subject === 'feat:general' &&
        warning.kind === 'rules',
    ),
  ).toBe(false);
});
