import { expect, test } from 'vitest';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  calculateCharacterSheetProjections,
  type CharacterSheetInput,
} from './character-sheet';
import type { AnimalCompanionProgressionState } from './character-sheet-companion-progression';
import {
  resolveCompanionLinkedInput,
  readCompanionLinkedInput,
} from './character-sheet-linked-inputs';

function companion(): CharacterSheetInput & {
  companionProgression: AnimalCompanionProgressionState;
} {
  return {
    characterKind: 'npc',
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
        modifiers: abilityKeys.map((ability) => ({
          target: abilityTargets[ability],
          bonusType: 'base',
          value: {
            strength: 13,
            dexterity: 15,
            constitution: 15,
            intelligence: 2,
            wisdom: 12,
            charisma: 6,
          }[ability],
        })),
      },
    ],
    companionProgression: {
      species: 'wolf',
      hpGained: 27,
      skillRanks: { per: 6 },
      abilityIncreases: ['strength'],
      advancementChoice: 'species',
      keep: false,
    },
  };
}
function options(druid: number, ranger?: number) {
  return {
    companionProgressionSources: [
      {
        sourceKey: 'nature-bond',
        ruleKind: 'druidCompanion' as const,
        counting: true,
      },
      ...(ranger === undefined
        ? []
        : [
            {
              sourceKey: 'hunters-bond',
              ruleKind: 'rangerCompanion' as const,
              counting: true,
            },
          ]),
    ],
    companionLinkedInputs: [
      resolveCompanionLinkedInput({
        input: { kind: 'classLevels', classRuleIdentity: 'druid' },
        candidates: [
          { sourceKey: 'nature-bond', kind: 'available', value: druid },
        ],
      }),
      ...(ranger === undefined
        ? []
        : [
            resolveCompanionLinkedInput({
              input: { kind: 'classLevels', classRuleIdentity: 'ranger' },
              candidates: [
                {
                  sourceKey: 'hunters-bond',
                  kind: 'available' as const,
                  value: ranger,
                },
              ],
            }),
          ]),
    ],
  };
}

test('an unspecified granting class stays unresolved until a progression interpretation or fallback is recorded', () => {
  const input = companion();
  const context = {
    ...options(7, 3),
    companionProgressionSources: [
      {
        sourceKey: 'nature-bond',
        ruleKind: 'animalCompanion' as const,
        counting: true,
      },
    ],
  };
  expect(
    calculateCharacterSheet(input, context).companionProgression,
  ).toMatchObject({
    status: 'unresolved',
    effectiveLevel: null,
    hitDice: null,
  });
  context.companionLinkedInputs = [
    resolveCompanionLinkedInput({
      input: { kind: 'classLevels', classRuleIdentity: 'druid' },
      candidates: [
        {
          sourceKey: 'nature-bond',
          kind: 'unavailable',
          reason: 'missingInput',
        },
      ],
      fallback: 4,
    }),
  ];
  expect(
    calculateCharacterSheet(input, context).companionProgression,
  ).toMatchObject({
    status: 'active',
    effectiveLevel: 4,
    hitDice: 4,
    contributions: [{ resolution: 'fallback', fallbackState: 'applied' }],
  });
});

// CRB Table 3–8 Animal Companion Base Statistics: effective druid level 7.
test('combined druid and ranger sources advance one wolf without inventing Class Levels', () => {
  const result = calculateCharacterSheet(companion(), options(3, 7));
  expect(result).toMatchObject({
    level: 0,
    racialHitDice: 0,
    hitDice: 6,
    hp: 51,
    abilities: {
      strength: { score: 24 },
      dexterity: { score: 15 },
      constitution: { score: 19 },
    },
    companionProgression: {
      status: 'active',
      effectiveLevel: 7,
      hitDice: 6,
      size: 'large',
      advancement: { level: 7, applied: true },
      budgets: { generalFeats: 3, skillRanks: 6, abilityIncreases: 1 },
    },
    budgets: {
      kind: 'animalCompanion',
      generalFeats: 3,
      skillRanks: 6,
      skillRankCap: 6,
    },
    selectionRules: { budgets: { generalFeats: 3 } },
    derivedStatistics: {
      bab: { total: 4 },
      fortitude: { total: 9 },
      reflex: { total: 7 },
      will: { total: 3 },
    },
  });
  expect(
    result.skills.find((skill) => skill.key === 'skill.per'),
  ).toMatchObject({ ranks: 6, classSkill: true });
});

// CRB Table 3–8: source loss leaves Druid 3 (3 HD), not the old combined 7.
test('partial source loss keeps choices and removes only the lost contribution', () => {
  const input = companion();
  const mixed = options(3, 7);
  mixed.companionProgressionSources[1]!.counting = false;
  const result = calculateCharacterSheet(input, mixed);
  expect(result).toMatchObject({
    hitDice: 3,
    hp: 33,
    companionProgression: {
      effectiveLevel: 3,
      hitDice: 3,
      status: 'active',
      advancement: { applied: false },
      contributions: [
        { sourceKey: 'nature-bond', effectiveLevel: 3, counting: true },
        { sourceKey: 'hunters-bond', effectiveLevel: null, counting: false },
      ],
    },
  });
  expect(result.warnings.map((warning) => warning.check)).toEqual(
    expect.arrayContaining([
      'companionSkillRankBudget',
      'companionSkillRankCap',
      'companionAbilityIncreaseBudget',
    ]),
  );
  expect(result.skills.find((skill) => skill.key === 'skill.per')?.ranks).toBe(
    6,
  );
  expect(input.companionProgression?.abilityIncreases).toEqual(['strength']);
});

test('unavailable linked levels leave actual HD, HP and dependent BAB prerequisites unresolved', () => {
  const input = companion();
  input.entries = [
    ...input.entries,
    {
      _id: 'feat-row',
      kind: 'feat',
      active: true,
      catalogEntryId: 'feat',
      state: { kind: 'feat' },
    },
  ];
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'feat',
      ruleIdentity: 'feat',
      name: 'Power Attack',
      modifiers: [],
      prerequisites: [{ kind: 'bab', bab: 1 }],
    },
  ];
  const context = options(7);
  context.companionLinkedInputs = [
    resolveCompanionLinkedInput({
      input: { kind: 'classLevels', classRuleIdentity: 'druid' },
      candidates: [
        {
          sourceKey: 'nature-bond',
          kind: 'unavailable',
          reason: 'inaccessible',
        },
      ],
    }),
  ];
  const result = calculateCharacterSheet(input, context);
  expect(
    result.selectionRules.slots.some((slot) => slot.id === 'feat:general'),
  ).toBe(false);
  expect(
    result.warnings.some((warning) => warning.check === 'featSlotBudget'),
  ).toBe(false);
  expect(result).toMatchObject({
    hitDice: null,
    hp: null,
    companionProgression: {
      status: 'unresolved',
      hitDice: null,
      effectiveLevel: null,
      budgets: { generalFeats: null, skillRanks: null },
    },
  });
  expect(result.prerequisites).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        entryId: 'feat-row',
        met: null,
        view: 'current',
      }),
    ]),
  );
});

test('unavailable animal advancement marks the main sheet and racial feat budget targets unresolved', () => {
  const result = calculateCharacterSheet(companion(), {
    companionProgressionSources: options(7).companionProgressionSources,
  });
  expect(result).toMatchObject({
    affectedStatisticTargets: expect.arrayContaining([
      'hitDice',
      'ability.str',
      'ability.dex',
      'ability.con',
      'derived.bab',
      'derived.fortitude',
      'derived.reflex',
      'derived.will',
      'featBudget',
    ]),
    selectionRules: { budgets: { generalFeats: null } },
  });
});

// Published CRB Table 3–8 literal checkpoints; no ordinary class advancement.
test.each([
  [1, 2, 1, 3, 0, 1, 0],
  [4, 4, 3, 4, 1, 2, 1],
  [7, 6, 4, 5, 2, 3, 1],
  [10, 9, 6, 6, 3, 5, 2],
  [15, 12, 9, 8, 4, 6, 3],
  [20, 16, 12, 10, 5, 8, 4],
])(
  'effective level %s uses published HD, BAB, base saves and budgets',
  (level, hd, bab, good, poor, feats, increases) => {
    const result = calculateCharacterSheet(companion(), options(level));
    expect(result).toMatchObject({
      level: 0,
      hitDice: hd,
      companionProgression: {
        effectiveLevel: level,
        budgets: {
          generalFeats: feats,
          skillRanks: hd,
          abilityIncreases: increases,
        },
      },
    });
    expect(result.breakdowns.bab.total).toBe(bab);
    expect(result.breakdowns['save.fort'].total).toBe(good);
    expect(result.breakdowns['save.ref'].total).toBe(good);
    expect(result.breakdowns['save.will'].total).toBe(poor);
  },
);

test('companion advancement replaces baseline racial contributions and preserves real Class Levels', () => {
  const input = companion();
  input.racialHitDice = {
    count: 2,
    hpGained: 99,
    progression: {
      bab: 'threeQuarters',
      saves: { fort: 'good', ref: 'good', will: 'poor' },
      skillRanksPerHitDie: 2,
    },
  };
  input.entries = [
    ...input.entries,
    {
      _id: 'fighter-row',
      kind: 'classLevel',
      active: true,
      state: {
        kind: 'classLevel',
        position: 1,
        classEntryId: 'fighter',
        hpGained: 8,
      },
    },
  ];
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'fighter',
      ruleIdentity: 'fighter',
      modifiers: [],
      detail: {
        kind: 'class',
        classKind: 'base',
        hitDie: 10,
        bab: 'full',
        saves: { fort: 'good', ref: 'poor', will: 'poor' },
        skillRanksPerLevel: 2,
        classSkills: [],
      },
    },
  ];
  const result = calculateCharacterSheet(input, options(7));
  expect(result).toMatchObject({
    level: 1,
    racialHitDice: 2,
    hitDice: 7,
    hp: 63,
    classLevels: [{ classLevel: 1, hitDice: 7, skillRankCap: 7 }],
    companionProgression: { hitDice: 6 },
    budgets: { generalFeats: 4 },
    derivedStatistics: { bab: { total: 5 } },
  });
  expect(input.racialHitDice.count).toBe(2);
});

test('species advancement alternative keeps the wolf Medium and adds Dexterity and Constitution', () => {
  const input = companion();
  input.companionProgression.advancementChoice = 'abilityScores';
  const result = calculateCharacterSheet(input, options(7));
  expect(result).toMatchObject({
    abilities: {
      strength: { score: 16 },
      dexterity: { score: 19 },
      constitution: { score: 17 },
    },
    companionProgression: {
      size: 'medium',
      advancement: { applied: true, choice: 'abilityScores' },
    },
    hp: 45,
  });
});

test('allowed Survival ranks receive no animal class-skill bonus while Perception does', () => {
  const input = companion();
  input.companionProgression.skillRanks = { sur: 1, per: 1 };
  const result = calculateCharacterSheet(input, options(3));
  expect(
    result.skills.find((skill) => skill.key === 'skill.sur'),
  ).toMatchObject({ ranks: 1, classSkill: false });
  expect(
    result.skills.find((skill) => skill.key === 'skill.per'),
  ).toMatchObject({ ranks: 1, classSkill: true });
  expect(result.breakdowns['skill.sur'].total).toBe(2);
  expect(result.breakdowns['skill.per'].total).toBe(5);
});

// CRB Animal Skills uses table ranks plus Intelligence bonus (not class 2+Int).
// #249/#302: permanent Intelligence applies retroactively in both projections.
test('animal rank budgets use permanent Intelligence and HP uses each projection’s own Constitution', () => {
  const input = companion();
  input.catalogEntries = input.catalogEntries.map((entry) => ({
    ...entry,
    modifiers: entry.modifiers.map((modifier) =>
      modifier.target === 'ability.int' ? { ...modifier, value: 12 } : modifier,
    ),
  }));
  input.entries = [
    ...input.entries,
    {
      _id: 'effect-row',
      kind: 'spellEffect',
      active: true,
      catalogEntryId: 'effect',
      state: { kind: 'spellEffect', casterLevel: 1 },
    },
  ];
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'effect',
      ruleIdentity: 'effect',
      modifiers: [
        { target: 'ability.int', bonusType: 'enhancement', value: 8 },
        { target: 'ability.con', bonusType: 'enhancement', value: 4 },
      ],
      detail: { kind: 'spellEffect' },
    },
  ];
  const result = calculateCharacterSheetProjections(input, options(7));
  expect(result.current).toMatchObject({
    hp: 63,
    abilities: { intelligence: { score: 20 } },
    companionProgression: { budgets: { skillRanks: 12 } },
    budgets: { skillRanks: 12 },
  });
  expect(result.permanent).toMatchObject({
    hp: 51,
    abilities: { intelligence: { score: 12 } },
    companionProgression: { budgets: { skillRanks: 12 } },
    budgets: { skillRanks: 12 },
  });
});

test('a source’s Druid levels supply progression without satisfying the companion’s own class prerequisite', () => {
  const input = companion();
  input.entries = [
    ...input.entries,
    {
      _id: 'feat-row',
      kind: 'feat',
      active: true,
      catalogEntryId: 'feat',
      state: { kind: 'feat' },
    },
  ];
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'feat',
      ruleIdentity: 'feat',
      name: 'Source distinction',
      modifiers: [],
      prerequisites: [{ kind: 'classLevel', classLevel: 'druid', min: 1 }],
    },
  ];
  const result = calculateCharacterSheet(input, options(5));
  expect(result.level).toBe(0);
  expect(result.prerequisites).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        entryId: 'feat-row',
        met: false,
        view: 'current',
      }),
    ]),
  );
});

test('cavalier mount grants light armor proficiency and preserves share spells from a second druid source', () => {
  const input = companion();
  input.companionProgression.species = 'horse';
  input.entries = [
    ...input.entries,
    {
      _id: 'feat-row',
      kind: 'feat',
      active: true,
      catalogEntryId: 'feat',
      state: { kind: 'feat' },
    },
  ];
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'feat',
      ruleIdentity: 'feat',
      name: 'Armor feat',
      modifiers: [],
      prerequisites: [
        { kind: 'proficiency', proficiency: { category: 'light' } },
      ],
    },
  ];
  const result = calculateCharacterSheet(input, {
    companionProgressionSources: [
      { sourceKey: 'mount', ruleKind: 'cavalierMount', counting: true },
      { sourceKey: 'nature-bond', ruleKind: 'druidCompanion', counting: true },
    ],
    companionLinkedInputs: [
      resolveCompanionLinkedInput({
        input: { kind: 'classLevels', classRuleIdentity: 'cavalier' },
        candidates: [{ sourceKey: 'mount', kind: 'available', value: 1 }],
      }),
      ...options(3).companionLinkedInputs,
    ],
  });
  expect(result.companionProgression).toMatchObject({
    effectiveLevel: 4,
    hitDice: 4,
    features: expect.arrayContaining([
      'Combat trained',
      'Light Armor Proficiency',
      'Share spells',
    ]),
  });
  expect(result.proficiencies.grants).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ proficiency: { category: 'light' } }),
    ]),
  );
  expect(result.prerequisites).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        entryId: 'feat-row',
        met: true,
        view: 'current',
      }),
    ]),
  );
});

test('full source loss makes progression dormant and retains choices for restoration or Keep', () => {
  const input = companion();
  const context = options(7);
  context.companionProgressionSources[0]!.counting = false;
  const dormant = calculateCharacterSheet(input, context);
  expect(dormant).toMatchObject({
    hitDice: null,
    hp: null,
    level: 0,
    abilities: { strength: { score: 13 } },
    companionProgression: {
      status: 'dormant',
      hitDice: null,
      effectiveLevel: null,
      budgets: { skillRanks: null, generalFeats: null, abilityIncreases: null },
      retained: false,
    },
  });
  input.companionProgression.keep = true;
  const kept = calculateCharacterSheet(input, context);
  expect(kept).toMatchObject({
    hitDice: null,
    hp: null,
    abilities: { strength: { score: 14 } },
    companionProgression: { status: 'dormant', retained: true },
  });
  context.companionProgressionSources[0]!.counting = true;
  const restored = calculateCharacterSheet(input, context);
  expect(restored).toMatchObject({
    hitDice: 6,
    hp: 51,
    abilities: { strength: { score: 24 } },
    companionProgression: { status: 'active', effectiveLevel: 7 },
  });
  expect(input.companionProgression.skillRanks).toEqual({ per: 6 });
});

test('a saved class-level fallback restores advancement and suspends when the source returns', () => {
  const input = companion();
  const context = options(7);
  context.companionLinkedInputs = [
    resolveCompanionLinkedInput({
      input: { kind: 'classLevels', classRuleIdentity: 'druid' },
      candidates: [
        {
          sourceKey: 'nature-bond',
          kind: 'unavailable',
          reason: 'inaccessible',
        },
      ],
      fallback: 4,
    }),
  ];
  const fallback = calculateCharacterSheet(input, context);
  expect(fallback).toMatchObject({
    hitDice: 4,
    companionProgression: {
      effectiveLevel: 4,
      contributions: [{ resolution: 'fallback', fallbackState: 'applied' }],
    },
  });
  context.companionLinkedInputs = [
    resolveCompanionLinkedInput({
      input: { kind: 'classLevels', classRuleIdentity: 'druid' },
      candidates: [{ sourceKey: 'nature-bond', kind: 'available', value: 7 }],
      fallback: 4,
    }),
  ];
  const restored = calculateCharacterSheet(input, context);
  expect(restored).toMatchObject({
    hitDice: 6,
    companionProgression: {
      effectiveLevel: 7,
      contributions: [{ resolution: 'calculated', fallbackState: 'suspended' }],
    },
  });
});

test('a classless Animal Companion lends recorded skill ranks instead of zero or its finished skill total', () => {
  const sheet = companion();
  const calculated = calculateCharacterSheet(sheet, options(7));
  expect(
    readCompanionLinkedInput({
      input: { kind: 'skillRanks', skill: 'skill.per' },
      sheet,
      calculated,
    }),
  ).toEqual({ kind: 'available', value: 6 });
});

test('a companion master lends its replaced progression bases and retained ranks through named animal inputs', () => {
  const sheet = companion();
  sheet.racialHitDice = {
    count: 2,
    hpGained: 99,
    progression: {
      bab: 'full',
      saves: { fort: 'poor', ref: 'poor', will: 'good' },
      skillRanksPerHitDie: 2,
    },
  };
  const calculated = calculateCharacterSheet(sheet, options(7));
  const read = (
    input: Parameters<typeof readCompanionLinkedInput>[0]['input'],
  ) =>
    readCompanionLinkedInput({
      input,
      sheet,
      calculated,
      companionKind: 'animalCompanion',
    });
  expect(read({ kind: 'baseAttackBonus' })).toEqual({
    kind: 'available',
    value: 4,
  });
  expect(read({ kind: 'baseSave', save: 'fort' })).toEqual({
    kind: 'available',
    value: 5,
  });
  expect(read({ kind: 'baseSave', save: 'will' })).toEqual({
    kind: 'available',
    value: 2,
  });
  expect(read({ kind: 'skillRanks', skill: 'skill.per' })).toEqual({
    kind: 'available',
    value: 6,
  });
  const interrupted = calculateCharacterSheet(sheet, {
    companionProgressionSources: options(7).companionProgressionSources,
  });
  expect(
    readCompanionLinkedInput({
      input: { kind: 'baseAttackBonus' },
      sheet,
      calculated: interrupted,
      companionKind: 'animalCompanion',
    }),
  ).toEqual({ kind: 'unavailable', reason: 'missingInput' });
});

test('the companion’s recorded rank choices satisfy its own feat prerequisites', () => {
  const input = companion();
  input.entries = [
    ...input.entries,
    {
      _id: 'feat-row',
      kind: 'feat',
      active: true,
      catalogEntryId: 'feat',
      state: { kind: 'feat' },
    },
  ];
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'feat',
      ruleIdentity: 'feat',
      name: 'Skill Focus',
      modifiers: [],
      prerequisites: [{ kind: 'skillRanks', skillRanks: 'skill.per', min: 6 }],
    },
  ];
  expect(calculateCharacterSheet(input, options(7)).prerequisites).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        entryId: 'feat-row',
        met: true,
        view: 'current',
      }),
    ]),
  );
});

// CRB Horse starting statistics and 4th-level species advancement block.
test('a horse gains its separate fourth-level Strength and Constitution advancement', () => {
  const input = companion();
  input.companionProgression.species = 'horse';
  input.catalogEntries = [
    {
      _id: 'base',
      ruleIdentity: 'base',
      modifiers: abilityKeys.map((ability) => ({
        target: abilityTargets[ability],
        bonusType: 'base',
        value: {
          strength: 16,
          dexterity: 13,
          constitution: 15,
          intelligence: 2,
          wisdom: 12,
          charisma: 6,
        }[ability],
      })),
    },
  ];
  const result = calculateCharacterSheet(input, options(4));
  expect(result).toMatchObject({
    hitDice: 4,
    hp: 39,
    abilities: {
      strength: { score: 20 },
      dexterity: { score: 14 },
      constitution: { score: 17 },
    },
    companionProgression: {
      species: 'horse',
      size: 'large',
      advancement: { level: 4, applied: true },
      features: expect.arrayContaining(['Combat trained']),
    },
  });
  expect(result.breakdowns['ac.natural'].total).toBe(6);
});

test('an animal relationship without recorded species leaves progression statistics unresolved', () => {
  const { companionProgression: _recorded, ...input } = companion();
  const calculated = calculateCharacterSheet(input, options(7));
  expect(calculated.hitDice).toBeNull();
  expect(calculated.selectionRules.budgets.generalFeats).toBeNull();
  expect(calculated.affectedStatisticTargets).toEqual(
    expect.arrayContaining([
      'hitDice',
      'bab',
      'save.fort',
      'save.ref',
      'save.will',
      'ability.str',
      'ability.dex',
      'ability.con',
      'featBudget',
    ]),
  );
  expect(calculateCharacterSheet(input).hitDice).toBe(0);
});
