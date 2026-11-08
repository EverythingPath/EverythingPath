import { expect, test } from 'vitest';
import {
  readCompanionLinkedInput,
  resolveCompanionLinkedInput,
} from './character-sheet-linked-inputs';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  calculateCharacterSheetProjections,
  type SheetEntry,
  type CharacterSheetInput,
} from './character-sheet';
import { skillDefinitions } from './character-sheet-skills';
import {
  representativeFamiliars,
  type FamiliarBaseCreatureKey,
} from './catalog/representative-familiars';
import { representativeClassCatalog } from '../../tests/fixtures/catalog/representative-class-progressions';

function linkedInputs() {
  return [
    { input: { kind: 'familiarProgressionLevels' } as const, value: 5 },
    { input: { kind: 'characterLevel' } as const, value: 7 },
    { input: { kind: 'actualHitDice' } as const, value: 11 },
    { input: { kind: 'maximumHp' } as const, value: 43 },
    { input: { kind: 'baseAttackBonus' } as const, value: 4 },
    { input: { kind: 'baseSave', save: 'fort' } as const, value: 3 },
    { input: { kind: 'baseSave', save: 'ref' } as const, value: 0 },
    { input: { kind: 'baseSave', save: 'will' } as const, value: 6 },
    ...skillDefinitions.map(({ key }) => ({
      input: { kind: 'skillRanks', skill: key } as const,
      value: key === 'skill.per' ? 4 : 0,
    })),
  ].map(({ input, value }) =>
    resolveCompanionLinkedInput({
      input,
      candidates: [{ sourceKey: 'master', kind: 'available', value }],
    }),
  );
}

function familiarSheet(): CharacterSheetInput {
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
            strength: 3,
            dexterity: 15,
            constitution: 10,
            intelligence: 2,
            wisdom: 12,
            charisma: 7,
          }[ability],
        })),
      },
    ],
  };
}

test.each([
  {
    key: 'cat',
    con: 8,
    cha: 7,
    ranks: { 'skill.clm': 0, 'skill.per': 1, 'skill.ste': 0 },
    totals: { 'skill.clm': 6, 'skill.per': 5, 'skill.ste': 14 },
  },
  {
    key: 'raven',
    con: 8,
    cha: 7,
    ranks: { 'skill.fly': 0, 'skill.per': 1 },
    totals: { 'skill.fly': 6, 'skill.per': 6 },
  },
  {
    key: 'toad',
    con: 6,
    cha: 4,
    ranks: { 'skill.per': 0, 'skill.ste': 1 },
    totals: { 'skill.per': 5, 'skill.ste': 21 },
  },
])(
  'curates $key creature ranks separately from printed skill bonuses (Bestiary 131–133)',
  ({ key, con, cha, ranks, totals }) => {
    const creature = Object.values(representativeFamiliars).find(
      (item) => item.key === key,
    );
    if (!creature) throw new Error('Creature missing');
    const sheet = familiarSheet();
    const input = {
      ...sheet,
      catalogEntries: sheet.catalogEntries.map((definition) => ({
        ...definition,
        modifiers: abilityKeys.map((ability) => ({
          target: abilityTargets[ability],
          bonusType: 'base' as const,
          value: creature.abilityScores[ability],
        })),
      })),
    };
    const creatureKey: FamiliarBaseCreatureKey = creature.key;
    const result = calculateCharacterSheet(input, {
      familiar: {
        baseCreatureKey: creatureKey,
        linkedInputs: linkedInputs().map((row) =>
          row.input.kind === 'skillRanks' ? { ...row, value: 0 } : row,
        ),
      },
    });
    expect(result.abilities.constitution.score).toBe(con);
    expect(result.abilities.charisma.score).toBe(cha);
    for (const [skill, expected] of Object.entries(ranks))
      expect(result.skills.find((item) => item.key === skill)?.ranks).toBe(
        expected,
      );
    for (const [skill, expected] of Object.entries(totals))
      expect(
        result.skills.find((item) => item.key === skill) &&
          result.breakdowns[skill as keyof typeof result.breakdowns].total,
      ).toBe(expected);
  },
);

// APG Witch's Familiar plus CRB familiar rules; #248's witch2/wizard3/fighter2.
test('the familiar sheet uses master bases and its own abilities, with actual HD separate from effective HD', () => {
  const result = calculateCharacterSheet(familiarSheet(), {
    familiar: { baseCreatureKey: 'cat', linkedInputs: linkedInputs() },
  });
  expect(result).toMatchObject({
    level: 0,
    hitDice: 1,
    hp: 21,
    familiar: {
      actualHitDice: 1,
      effectiveHitDice: 7,
      progression: { level: 5 },
    },
    abilities: { intelligence: { score: 8 } },
    derivedStatistics: {
      bab: { total: 4 },
      fortitude: { total: 3 },
      reflex: { total: 4 },
      will: { total: 7 },
      ac: { total: 17 },
    },
  });
  expect(result.skills.find(({ key }) => key === 'skill.per')).toMatchObject({
    ranks: 4,
    classSkill: true,
  });
  expect(result.breakdowns['skill.per'].total).toBe(8);
});

test('complete familiar current/permanent builds read class bases and recorded ranks, with temporary Constitution in current maximum HP', () => {
  const master: CharacterSheetInput = {
    characterKind: 'pc',
    entries: [
      {
        _id: 'base',
        kind: 'base',
        active: true,
        catalogEntryId: 'base',
        state: { kind: 'base' },
      },
      ...[
        'witch',
        'witch',
        'wizard',
        'wizard',
        'wizard',
        'fighter',
        'fighter',
      ].map(
        (classEntryId, index): SheetEntry => ({
          _id: `class-${index}`,
          kind: 'classLevel',
          active: true,
          state: {
            kind: 'classLevel',
            classEntryId,
            position: index + 1,
            hpGained: 5,
            skillRanks: { per: 1 },
          },
        }),
      ),
      {
        _id: 'temporary-con',
        kind: 'spellEffect',
        active: true,
        catalogEntryId: 'temporary-con',
        state: { kind: 'spellEffect', casterLevel: 7 },
      },
      {
        _id: 'bonuses',
        kind: 'manual',
        active: true,
        catalogEntryId: 'bonuses',
        state: { kind: 'manual' },
      },
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: abilityKeys.map((ability) => ({
          target: abilityTargets[ability],
          bonusType: 'base',
          value: 14,
        })),
      },
      ...representativeClassCatalog,
      {
        _id: 'temporary-con',
        ruleIdentity: 'temporary-con',
        detail: { kind: 'spellEffect' },
        modifiers: [
          { target: 'ability.con', bonusType: 'enhancement', value: 4 },
        ],
      },
      {
        _id: 'bonuses',
        ruleIdentity: 'bonuses',
        modifiers: [
          { target: 'bab', bonusType: 'untyped', value: 9 },
          { target: 'save.will', bonusType: 'resistance', value: 8 },
          { target: 'skill.per', bonusType: 'competence', value: 9 },
          { target: 'hp', bonusType: 'untyped', value: 2 },
        ],
      },
    ],
  };
  function inputs(projection: 'current' | 'permanent') {
    return linkedInputs().map(({ input }) =>
      resolveCompanionLinkedInput({
        input,
        candidates: [
          {
            sourceKey: 'master',
            ...readCompanionLinkedInput({
              input,
              sheet: master,
              projection,
              contributingClassRuleIdentities: ['witch', 'wizard', 'wizard'],
            }),
          },
        ],
      }),
    );
  }
  const result = calculateCharacterSheetProjections(familiarSheet(), {
    projectionInputs: {
      current: {
        familiar: { baseCreatureKey: 'cat', linkedInputs: inputs('current') },
      },
      permanent: {
        familiar: { baseCreatureKey: 'cat', linkedInputs: inputs('permanent') },
      },
    },
  });
  expect(result.current).toMatchObject({
    hp: 32,
    familiar: { progression: { level: 5 }, effectiveHitDice: 7 },
    derivedStatistics: { bab: { total: 4 }, will: { total: 7 } },
  });
  expect(result.permanent.hp).toBe(25);
  expect(
    result.current.skills.find(({ key }) => key === 'skill.per')?.ranks,
  ).toBe(7);
  expect(result.current.breakdowns['skill.per'].total).toBe(11);
});

test('missing creature data and interrupted master inputs stay unresolved without deleting recorded class choices', () => {
  const own = familiarSheet();
  const sheet: CharacterSheetInput = {
    ...own,
    catalogEntries: [...own.catalogEntries, ...representativeClassCatalog],
    entries: [
      ...own.entries,
      {
        _id: 'own-level',
        kind: 'classLevel',
        active: true,
        state: {
          kind: 'classLevel',
          classEntryId: 'fighter',
          position: 1,
          hpGained: 9,
          skillRanks: { per: 2 },
        },
      },
    ],
  };
  const interrupted = linkedInputs().map(({ input }) =>
    resolveCompanionLinkedInput({
      input,
      candidates: [
        { sourceKey: 'master', kind: 'unavailable', reason: 'interrupted' },
      ],
    }),
  );
  const unknownCreature = calculateCharacterSheet(sheet, {
    familiar: { baseCreatureKey: null, linkedInputs: interrupted },
  });
  expect(unknownCreature.familiar).toMatchObject({
    actualHitDice: null,
    effectiveHitDice: null,
    maximumHp: null,
    baseAttackBonus: null,
    progression: null,
    baseSaves: { fort: null, ref: null, will: null },
  });
  expect(unknownCreature.hp).toBeNull();
  expect(unknownCreature.classLevels).toMatchObject([{ entryId: 'own-level' }]);
  expect(unknownCreature.familiar?.unresolvedTargets).toEqual(
    expect.arrayContaining([
      'hitDice',
      'ability.int',
      'ac.natural',
      'bab',
      'save.fort',
      'skill.per',
    ]),
  );
  const retained = calculateCharacterSheet(sheet, {
    familiar: { baseCreatureKey: 'cat', linkedInputs: interrupted },
  });
  expect(retained.hitDice).toBe(2);
  expect(retained.skills.find(({ key }) => key === 'skill.per')?.ranks).toBe(3);
  expect(retained.familiar?.skillRanks['skill.per']).toBeNull();
});

test('recorded familiar creature HD and baseline skills remain independent of a granting relationship', () => {
  const sheet: CharacterSheetInput = {
    ...familiarSheet(),
    familiarBaseCreatureKey: 'cat',
  };
  const result = calculateCharacterSheet(sheet);
  expect(result).toMatchObject({ level: 0, hitDice: 1, familiar: null, hp: 4 });
  expect(result.skills.find(({ key }) => key === 'skill.per')?.ranks).toBe(1);
  expect(result.breakdowns['skill.ste'].total).toBe(14);
});

test.each([0, 21])(
  'a progression level outside the curated table (%i) does not invent a progression row',
  (value) => {
    const inputs = linkedInputs().map((row) =>
      row.input.kind === 'familiarProgressionLevels' ? { ...row, value } : row,
    );
    const result = calculateCharacterSheet(familiarSheet(), {
      familiar: { baseCreatureKey: 'cat', linkedInputs: inputs },
    });
    expect(result.familiar?.progression).toBeNull();
    expect(result.familiar?.unresolvedTargets).toContain('ability.int');
  },
);

test('a familiar master supplies its actual class BAB and saves to its own familiar instead of inherited bases', () => {
  const ordinary = familiarSheet();
  const master: CharacterSheetInput = {
    ...ordinary,
    familiarBaseCreatureKey: 'cat',
    catalogEntries: [...ordinary.catalogEntries, ...representativeClassCatalog],
    entries: [
      ...ordinary.entries,
      ...[1, 2].map(
        (position): SheetEntry => ({
          _id: `wizard-${position}`,
          kind: 'classLevel',
          active: true,
          state: {
            kind: 'classLevel',
            classEntryId: 'wizard',
            position,
            hpGained: 4,
          },
        }),
      ),
    ],
  };
  const calculated = calculateCharacterSheet(master, {
    familiar: { baseCreatureKey: 'cat', linkedInputs: linkedInputs() },
  });
  expect(calculated.derivedStatistics.bab.total).toBe(4);
  expect(
    readCompanionLinkedInput({
      input: { kind: 'baseAttackBonus' },
      sheet: master,
      calculated,
    }),
  ).toEqual({ kind: 'available', value: 1 });
  expect(
    readCompanionLinkedInput({
      input: { kind: 'baseSave', save: 'will' },
      sheet: master,
      calculated,
    }),
  ).toEqual({ kind: 'available', value: 3 });
  expect(
    readCompanionLinkedInput({
      input: { kind: 'skillRanks', skill: 'skill.per' },
      sheet: master,
      calculated,
    }),
  ).toEqual({ kind: 'available', value: 1 });
});

// CRB pp. 82–83, Familiar Ability Descriptions and Familiar table.
test.each([
  [1, 'Empathic link', null],
  [3, 'Deliver touch spells', null],
  [5, 'Speak with master', null],
  [7, 'Speak with animals of its kind', null],
  [11, 'Spell resistance', 16],
  [12, 'Spell resistance', 17],
  [13, 'Scry on familiar', 18],
] as const)(
  'level %i grants %s with spell resistance %s',
  (level, ability, spellResistance) => {
    const result = calculateCharacterSheet(familiarSheet(), {
      familiar: {
        baseCreatureKey: 'cat',
        linkedInputs: linkedInputs().map((row) =>
          row.input.kind === 'familiarProgressionLevels'
            ? { ...row, value: level }
            : row,
        ),
      },
    });
    expect(result.familiar?.progression?.specialAbilities).toContain(ability);
    expect(result.familiar?.progression?.spellResistance).toBe(spellResistance);
  },
);

test.each([
  [1, 1, 6],
  [2, 1, 6],
  [3, 2, 7],
  [4, 2, 7],
  [5, 3, 8],
  [6, 3, 8],
  [7, 4, 9],
  [8, 4, 9],
  [9, 5, 10],
  [10, 5, 10],
  [11, 6, 11],
  [12, 6, 11],
  [13, 7, 12],
  [14, 7, 12],
  [15, 8, 13],
  [16, 8, 13],
  [17, 9, 14],
  [18, 9, 14],
  [19, 10, 15],
  [20, 10, 15],
])(
  'familiar progression at level %i gives armor %i and Intelligence %i',
  (level, naturalArmor, intelligence) => {
    const result = calculateCharacterSheet(familiarSheet(), {
      familiar: {
        baseCreatureKey: 'cat',
        linkedInputs: [
          resolveCompanionLinkedInput({
            input: { kind: 'familiarProgressionLevels' },
            candidates: [
              { sourceKey: 'arcane-bond', kind: 'available', value: level },
            ],
          }),
        ],
      },
    });
    expect(result.familiar?.progression).toMatchObject({
      level,
      naturalArmor,
      intelligence,
    });
    expect(result.abilities.intelligence.score).toBe(intelligence);
    expect(result.breakdowns['ac.natural'].total).toBe(naturalArmor);
  },
);

test('a non-familiar borrows progression bases without adding familiar baseline ranks', () => {
  const sheet: CharacterSheetInput = {
    ...familiarSheet(),
    familiarBaseCreatureKey: 'cat',
    racialHitDice: {
      count: 4,
      hpGained: 16,
      progression: {
        bab: 'full',
        saves: { fort: 'good', ref: 'poor', will: 'poor' },
        skillRanksPerHitDie: 2,
        classSkills: ['skill.per'],
      },
    },
  };
  const calculated = calculateCharacterSheet(sheet);
  expect(
    readCompanionLinkedInput({
      input: { kind: 'baseAttackBonus' },
      sheet,
      calculated,
      companionKind: 'animalCompanion',
    }),
  ).toEqual({ kind: 'available', value: 4 });
  expect(
    readCompanionLinkedInput({
      input: { kind: 'baseSave', save: 'fort' },
      sheet,
      calculated,
      companionKind: 'animalCompanion',
    }),
  ).toEqual({ kind: 'available', value: 4 });
  expect(
    readCompanionLinkedInput({
      input: { kind: 'skillRanks', skill: 'skill.per' },
      sheet,
      calculated,
      companionKind: 'animalCompanion',
    }),
  ).toEqual({ kind: 'available', value: 0 });
});

test('unresolved familiar facts name the finished statistics that need their inputs', () => {
  const result = calculateCharacterSheet(familiarSheet(), {
    familiar: {
      baseCreatureKey: 'cat',
      linkedInputs: linkedInputs().filter(
        ({ input }) => input.kind !== 'familiarProgressionLevels',
      ),
    },
  });
  expect(result.familiar?.isBaseCreatureUnavailable).toBe(false);
  expect(result.familiar?.affectedStatisticTargets).toEqual(
    expect.arrayContaining([
      'ability.int',
      'derived.ac',
      'derived.flatFootedAc',
      'skill.kar',
      'skill.spl',
    ]),
  );
  expect(result.familiar?.affectedStatisticTargets).not.toContain(
    'derived.touchAc',
  );
  expect(result.familiar?.affectedStatisticTargets).not.toContain('skill.per');
  const missing = calculateCharacterSheet(familiarSheet(), {
    familiar: { baseCreatureKey: null, linkedInputs: linkedInputs() },
  });
  expect(missing.familiar?.isBaseCreatureUnavailable).toBe(true);
  expect(missing.familiar?.affectedStatisticTargets).toContain(
    'attackRoutine.attackBonus',
  );
});

test('creature racial and size skill bonuses use their stacking types', () => {
  const sheet = familiarSheet();
  const result = calculateCharacterSheet({
    ...sheet,
    familiarBaseCreatureKey: 'cat',
    entries: [
      ...sheet.entries,
      {
        _id: 'skill-adjustments',
        kind: 'manual',
        active: true,
        catalogEntryId: 'skill-adjustments',
        state: { kind: 'manual' },
      },
    ],
    catalogEntries: [
      ...sheet.catalogEntries,
      {
        _id: 'skill-adjustments',
        ruleIdentity: 'skill-adjustments',
        modifiers: [
          { target: 'skill.clm', bonusType: 'racial', value: 6 },
          { target: 'skill.ste', bonusType: 'size', value: 10 },
        ],
      },
    ],
  });
  expect(result.breakdowns['skill.clm'].total).toBe(12);
  expect(result.breakdowns['skill.ste'].total).toBe(16);
  expect(result.breakdowns['skill.clm'].applied).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ bonusType: 'racial', value: 4 }),
    ]),
  );
  expect(result.breakdowns['skill.ste'].suppressed).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ bonusType: 'size', value: 8 }),
    ]),
  );
});
