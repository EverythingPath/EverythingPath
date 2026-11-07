import { expect, test } from 'vitest';
import {
  abilityKeys,
  abilityTargets,
  type CharacterSheetInput,
  type CharacterSheetCatalogEntry,
  type SheetEntry,
} from './character-sheet';
import { representativeClassCatalog } from '../../tests/fixtures/catalog/representative-class-progressions';
import { findRacialProgression } from './character-sheet-creature-types';
import {
  readCompanionLinkedInput,
  resolveCompanionLinkedInput,
  type CompanionLinkedInput,
  type CompanionLinkedInputCandidate,
  evaluateCompanionLinkedInputPrerequisite,
} from './character-sheet-linked-inputs';

function masterSheet(): CharacterSheetInput & {
  entries: SheetEntry[];
  catalogEntries: CharacterSheetCatalogEntry[];
} {
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
      ...['fighter', 'fighter', 'wizard', 'wizard'].map(
        (classEntryId, index): SheetEntry => ({
          _id: `level-${index}`,
          kind: 'classLevel',
          active: true,
          state: {
            kind: 'classLevel',
            classEntryId,
            position: index + 1,
            hpGained: index < 2 ? 8 : 4,
            skillRanks: { per: 1 },
          },
        }),
      ),
      {
        _id: 'bonuses-row',
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
        _id: 'bonuses',
        ruleIdentity: 'bonuses',
        modifiers: [
          { target: 'bab', bonusType: 'untyped', value: 7 },
          { target: 'save.fort', bonusType: 'resistance', value: 5 },
          { target: 'skill.per', bonusType: 'competence', value: 9 },
        ],
      },
    ],
  };
}

test('an inaccessible named input is unresolved rather than a stale or zero value', () => {
  const input = { kind: 'characterLevel' } as const;
  const value = readCompanionLinkedInput({ input, sheet: null });
  expect(value).toEqual({ kind: 'unavailable', reason: 'inaccessible' });
  expect(
    resolveCompanionLinkedInput({
      input,
      candidates: [{ sourceKey: 'master', ...value }],
    }),
  ).toMatchObject({
    status: 'unavailable',
    resolution: 'unresolved',
    value: null,
    fallbackState: 'none',
  });
});

test('compatible additions survive conflict resolution and partial source loss', () => {
  const input: CompanionLinkedInput = {
    kind: 'classLevels',
    classRuleIdentity: 'wizard',
  };
  const candidates: CompanionLinkedInputCandidate[] = [
    { sourceKey: 'witch', kind: 'available', value: 3 },
    { sourceKey: 'arcane', kind: 'available', value: 5 },
    { sourceKey: 'compatible', kind: 'available', value: 2, role: 'addition' },
  ];
  expect(
    resolveCompanionLinkedInput({
      input,
      candidates,
      interpretation: { sourceKey: 'arcane' },
    }),
  ).toMatchObject({
    value: 7,
    resolution: 'interpretation',
    contributions: [
      { sourceKey: 'witch', value: 3 },
      { sourceKey: 'arcane', value: 5 },
      { sourceKey: 'compatible', value: 2 },
    ],
  });
  const retained = resolveCompanionLinkedInput({
    input,
    candidates: candidates.filter(({ sourceKey }) => sourceKey !== 'arcane'),
  });
  expect(retained).toMatchObject({
    status: 'available',
    value: 5,
    contributions: [
      { sourceKey: 'witch', value: 3 },
      { sourceKey: 'compatible', value: 2 },
    ],
  });
});

test('missing required inputs leave surviving contributions visible without claiming a partial total', () => {
  expect(
    resolveCompanionLinkedInput({
      input: { kind: 'characterLevel' },
      candidates: [
        { sourceKey: 'available', kind: 'available', value: 5 },
        {
          sourceKey: 'missing',
          kind: 'unavailable',
          reason: 'missingInput',
          role: 'addition',
        },
      ],
    }),
  ).toMatchObject({
    status: 'unavailable',
    value: null,
    prerequisiteStatus: 'unresolved',
    contributions: [{ sourceKey: 'available', value: 5 }],
  });
});

test('published precedence can remove a dependency on an unavailable losing alternative', () => {
  expect(
    resolveCompanionLinkedInput({
      input: { kind: 'characterLevel' },
      precedence: ['witch', 'arcane'],
      candidates: [
        { sourceKey: 'witch', kind: 'available', value: 5 },
        { sourceKey: 'arcane', kind: 'unavailable', reason: 'missingInput' },
      ],
    }),
  ).toMatchObject({ resolution: 'precedence', value: 5 });
});

test('agreeing surviving alternatives calculate when the preferred source is lost', () => {
  expect(
    resolveCompanionLinkedInput({
      input: { kind: 'familiarProgressionLevels' },
      precedence: ['witch'],
      candidates: [
        { sourceKey: 'wizard', kind: 'available', value: 3 },
        { sourceKey: 'other-wizard', kind: 'available', value: 3 },
      ],
    }),
  ).toMatchObject({
    status: 'available',
    resolution: 'calculated',
    value: 3,
    interpretation: null,
  });
});

test('conflicting survivors need an interpretation when the preferred source is lost', () => {
  const remaining = {
    input: { kind: 'characterLevel' },
    precedence: ['witch', 'wizard', 'sorcerer'],
    candidates: [
      { sourceKey: 'wizard', kind: 'available', value: 3 },
      { sourceKey: 'sorcerer', kind: 'available', value: 4 },
    ],
  } as const;
  expect(resolveCompanionLinkedInput(remaining)).toMatchObject({
    status: 'conflicting',
    resolution: 'unresolved',
    value: null,
  });
  expect(
    resolveCompanionLinkedInput({
      ...remaining,
      interpretation: { sourceKey: 'sorcerer' },
    }),
  ).toMatchObject({ resolution: 'interpretation', value: 4 });
});

test('an unavailable preferred source uses the saved interpretation without choosing another source implicitly', () => {
  expect(
    resolveCompanionLinkedInput({
      input: { kind: 'characterLevel' },
      precedence: ['witch', 'arcane'],
      interpretation: { sourceKey: 'arcane' },
      candidates: [
        { sourceKey: 'witch', kind: 'unavailable', reason: 'missingInput' },
        { sourceKey: 'arcane', kind: 'available', value: 5 },
      ],
    }),
  ).toMatchObject({ resolution: 'interpretation', value: 5 });
});

test.each([
  [{ kind: 'characterLevel' }, 4],
  [{ kind: 'actualHitDice' }, 4],
  [{ kind: 'classLevels', classRuleIdentity: 'wizard' }, 2],
  [{ kind: 'baseAttackBonus' }, 3],
  [{ kind: 'baseSave', save: 'fort' }, 3],
  [{ kind: 'baseSave', save: 'will' }, 3],
  [{ kind: 'skillRanks', skill: 'skill.per' }, 4],
  [{ kind: 'maximumHp' }, 32],
] satisfies [CompanionLinkedInput, number][])(
  'reads the named component %j without borrowing unrelated bonuses',
  (input, expected) => {
    // CRB fighter 2 / wizard 2: BAB 2 + 1; Fort 3 + 0; Will 0 + 3.
    // Four recorded ranks; recorded HP 24 + four Con modifiers of 2.
    const value = readCompanionLinkedInput({ input, sheet: masterSheet() });
    expect(value).toEqual({ kind: 'available', value: expected });
    expect(
      resolveCompanionLinkedInput({
        input,
        candidates: [{ sourceKey: 'master', ...value }],
      }),
    ).toMatchObject({
      status: 'available',
      resolution: 'calculated',
      value: expected,
      prerequisiteStatus: 'resolved',
      contributions: [{ sourceKey: 'master', value: expected }],
    });
  },
);

test('a saved fallback applies during interruption, suspends on restoration and reapplies without overwriting edits', () => {
  const input: CompanionLinkedInput = { kind: 'maximumHp' };
  const saved = { input, fallback: 19 };
  const interrupted = resolveCompanionLinkedInput({ ...saved, candidates: [] });
  expect(interrupted).toMatchObject({
    status: 'unavailable',
    resolution: 'fallback',
    value: 19,
    fallback: 19,
    fallbackState: 'applied',
    prerequisiteStatus: 'resolved',
  });
  const restored = resolveCompanionLinkedInput({
    ...saved,
    candidates: [{ sourceKey: 'master', kind: 'available', value: 32 }],
  });
  expect(restored).toMatchObject({
    status: 'available',
    resolution: 'calculated',
    value: 32,
    fallback: 19,
    fallbackState: 'suspended',
  });
  expect(
    resolveCompanionLinkedInput({ ...saved, fallback: 21, candidates: [] }),
  ).toMatchObject({ value: 21, fallback: 21, fallbackState: 'applied' });
});

test.each([
  [{}, 'conflicting', 'unresolved', null],
  [{ fallback: 11 }, 'conflicting', 'fallback', 11],
  [
    { interpretation: { sourceKey: 'arcane' } },
    'conflicting',
    'interpretation',
    5,
  ],
  [{ precedence: ['witch', 'arcane'] }, 'conflicting', 'precedence', 3],
  [
    {
      interpretation: { sourceKey: 'arcane' },
      precedence: ['witch', 'arcane'],
    },
    'conflicting',
    'precedence',
    3,
  ],
  [
    { interpretation: { sourceKey: 'lost' } },
    'conflicting',
    'unresolved',
    null,
  ],
] as const)(
  'conflicting calculations use only published precedence or an explicit saved answer: %j',
  (saved, status, resolution, value) => {
    const input: CompanionLinkedInput = {
      kind: 'classLevels',
      classRuleIdentity: 'wizard',
    };
    const candidates = [
      { sourceKey: 'witch', kind: 'available', value: 3 },
      { sourceKey: 'arcane', kind: 'available', value: 5 },
    ] as const;
    for (const ordered of [candidates, [...candidates].reverse()]) {
      expect(
        resolveCompanionLinkedInput({ input, candidates: ordered, ...saved }),
      ).toMatchObject({ status, resolution, value });
    }
  },
);

test('equal compatible inputs calculate once and suspend a retained interpretation and fallback', () => {
  expect(
    resolveCompanionLinkedInput({
      input: { kind: 'characterLevel' },
      fallback: 10,
      interpretation: { sourceKey: 'lost' },
      candidates: [
        { sourceKey: 'arcane', kind: 'available', value: 4 },
        { sourceKey: 'witch', kind: 'available', value: 4 },
      ],
    }),
  ).toMatchObject({
    status: 'available',
    resolution: 'calculated',
    value: 4,
    fallbackState: 'suspended',
    interpretation: { sourceKey: 'lost' },
    contributions: [
      { sourceKey: 'arcane', value: 4 },
      { sourceKey: 'witch', value: 4 },
    ],
  });
});

test.each([
  [undefined, 'unresolved'],
  [0, 'unmet'],
  [7, 'met'],
] as const)(
  'prerequisites consume unresolved and fallback values without treating interruption as failure: %s',
  (fallback, expected) => {
    const resolution = resolveCompanionLinkedInput({
      input: { kind: 'baseAttackBonus' },
      candidates: [],
      fallback,
    });
    expect(
      evaluateCompanionLinkedInputPrerequisite({
        resolution,
        evaluate: (value) => (value >= 1 ? 'met' : 'unmet'),
      }),
    ).toBe(expected);
  },
);

test('maximum HP follows the chosen projection through linked Temporary Effects', () => {
  const sheet = masterSheet();
  sheet.entries.push({
    _id: 'temporary-con',
    kind: 'spellEffect',
    active: true,
    catalogEntryId: 'temporary-con',
    state: { kind: 'spellEffect', casterLevel: 3 },
  });
  sheet.catalogEntries.push({
    _id: 'temporary-con',
    ruleIdentity: 'temporary-con',
    detail: { kind: 'spellEffect', lastsOverOneDay: false },
    modifiers: [{ target: 'ability.con', bonusType: 'enhancement', value: 4 }],
  });
  expect(
    readCompanionLinkedInput({
      input: { kind: 'maximumHp' },
      sheet,
      projection: 'current',
    }),
  ).toEqual({ kind: 'available', value: 40 });
  expect(
    readCompanionLinkedInput({
      input: { kind: 'maximumHp' },
      sheet,
      projection: 'permanent',
    }),
  ).toEqual({ kind: 'available', value: 32 });
});

// CRB p. 129: a Leadership Score reads the leader's Charisma modifier.
test('an ability modifier follows the chosen projection through linked Temporary Effects', () => {
  const sheet = masterSheet();
  sheet.entries.push({
    _id: 'eagle-splendor',
    kind: 'spellEffect',
    active: true,
    catalogEntryId: 'eagle-splendor',
    state: { kind: 'spellEffect', casterLevel: 3 },
  });
  sheet.catalogEntries.push({
    _id: 'eagle-splendor',
    ruleIdentity: 'eagle-splendor',
    detail: { kind: 'spellEffect', lastsOverOneDay: false },
    modifiers: [{ target: 'ability.cha', bonusType: 'enhancement', value: 4 }],
  });
  const input = { kind: 'abilityModifier', ability: 'charisma' } as const;
  expect(
    readCompanionLinkedInput({ input, sheet, projection: 'current' }),
  ).toEqual({ kind: 'available', value: 4 });
  expect(
    readCompanionLinkedInput({ input, sheet, projection: 'permanent' }),
  ).toEqual({ kind: 'available', value: 2 });
  expect(
    readCompanionLinkedInput({ input, sheet: null, projection: 'current' }),
  ).toEqual({ kind: 'unavailable', reason: 'inaccessible' });
});

test.each([
  [{ kind: 'baseAttackBonus' }, 'missingInput'],
  [{ kind: 'baseSave', save: 'fort' }, 'missingInput'],
  [{ kind: 'maximumHp' }, 'missingInput'],
] satisfies [CompanionLinkedInput, string][])(
  'missing class or HP choices keep the named value unresolved: %j',
  (input, reason) => {
    const sheet = masterSheet();
    sheet.entries = sheet.entries.map((entry) =>
      entry.kind === 'classLevel'
        ? {
            ...entry,
            state: { ...entry.state, classEntryId: null, hpGained: null },
          }
        : entry,
    );
    expect(readCompanionLinkedInput({ input, sheet })).toEqual({
      kind: 'unavailable',
      reason,
    });
  },
);

test('linked reads preserve the existing dormant Grant and Keep semantics on partial source loss', () => {
  const sheet = masterSheet();
  const choice = {
    _id: 'retained',
    kind: 'classFeature',
    active: true,
    catalogEntryId: 'feature',
    grantKey: { source: 'lost-source', entry: 'feature' },
    state: { kind: 'classFeature', choice: 'saved' },
  } satisfies SheetEntry;
  sheet.entries.push(choice);
  sheet.catalogEntries.push({
    _id: 'feature',
    ruleIdentity: 'feature',
    detail: { kind: 'classFeature' },
    modifiers: [{ target: 'hp', bonusType: 'untyped', value: 5 }],
  });
  expect(
    readCompanionLinkedInput({ input: { kind: 'maximumHp' }, sheet }),
  ).toEqual({ kind: 'available', value: 32 });
  sheet.entries = sheet.entries.map((entry) =>
    entry._id === 'retained' ? { ...choice, kept: true } : entry,
  );
  expect(
    readCompanionLinkedInput({ input: { kind: 'maximumHp' }, sheet }),
  ).toEqual({ kind: 'available', value: 37 });
  expect(sheet.entries.find(({ _id }) => _id === 'retained')).toMatchObject({
    state: { choice: 'saved' },
    kept: true,
  });
});

test('recorded racial ranks remain named ranks alongside Class Level allocations', () => {
  const sheet = masterSheet();
  sheet.entries.push({
    _id: 'race-row',
    kind: 'race',
    active: true,
    catalogEntryId: 'race',
    state: { kind: 'race', racialSkillRanks: { per: 2 } },
  });
  sheet.catalogEntries.push({
    _id: 'race',
    ruleIdentity: 'race',
    modifiers: [],
    detail: {
      kind: 'race',
      size: 'medium',
      racialHitDice: 2,
      racialTraits: [],
    },
  });
  expect(
    readCompanionLinkedInput({
      input: { kind: 'skillRanks', skill: 'skill.per' },
      sheet,
    }),
  ).toEqual({ kind: 'available', value: 6 });
  sheet.entries = sheet.entries.filter((entry) => entry.kind !== 'classLevel');
  expect(
    readCompanionLinkedInput({
      input: { kind: 'skillRanks', skill: 'skill.per' },
      sheet,
    }),
  ).toEqual({ kind: 'available', value: 2 });
});

test('Actual Hit Dice includes racial HD while named Class Levels, class BAB and base saves stay distinct', () => {
  const sheet = masterSheet();
  sheet.entries.push({
    _id: 'race-row',
    kind: 'race',
    active: true,
    catalogEntryId: 'race',
    state: { kind: 'race', racialHpGained: 10 },
  });
  sheet.catalogEntries.push({
    _id: 'race',
    ruleIdentity: 'race',
    modifiers: [],
    detail: {
      kind: 'race',
      racialHitDice: 3,
      racialTraits: [],
      racialProgression: findRacialProgression('dragon'),
    },
  });
  expect(
    readCompanionLinkedInput({ input: { kind: 'actualHitDice' }, sheet }),
  ).toEqual({ kind: 'available', value: 7 });
  expect(
    readCompanionLinkedInput({ input: { kind: 'characterLevel' }, sheet }),
  ).toEqual({ kind: 'available', value: 4 });
  expect(
    readCompanionLinkedInput({ input: { kind: 'baseAttackBonus' }, sheet }),
  ).toEqual({ kind: 'available', value: 3 });
  expect(
    readCompanionLinkedInput({
      input: { kind: 'baseSave', save: 'fort' },
      sheet,
    }),
  ).toEqual({ kind: 'available', value: 3 });
  sheet.entries = sheet.entries.map((entry) =>
    entry.kind === 'race' ? { ...entry, active: false } : entry,
  );
  expect(
    readCompanionLinkedInput({ input: { kind: 'actualHitDice' }, sheet }),
  ).toEqual({ kind: 'available', value: 4 });
});

test.each(['hp', 'ability.con', 'ability.str'] as const)(
  'unresolved formulas affect only required maximum-HP inputs: %s',
  (target) => {
    const sheet = masterSheet();
    sheet.catalogEntries.push({
      _id: 'formula',
      ruleIdentity: 'formula',
      modifiers: [
        { target, bonusType: 'untyped', value: { formula: '@unsupported' } },
      ],
    });
    sheet.entries.push({
      _id: 'formula-row',
      kind: 'manual',
      active: true,
      catalogEntryId: 'formula',
      state: { kind: 'manual' },
    });
    expect(
      readCompanionLinkedInput({ input: { kind: 'maximumHp' }, sheet }),
    ).toEqual(
      target === 'ability.str'
        ? { kind: 'available', value: 32 }
        : { kind: 'unavailable', reason: 'missingInput' },
    );
  },
);

test('a Militia-only presentation does not hide unresolved linked calculation inputs', () => {
  const sheet = masterSheet();
  sheet.sheetMode = 'militiaOnly';
  sheet.catalogEntries.push({
    _id: 'missing-hp',
    ruleIdentity: 'missing-hp',
    modifiers: [
      {
        target: 'hp',
        bonusType: 'untyped',
        value: { formula: '@unsupported' },
      },
    ],
  });
  sheet.entries.push({
    _id: 'missing-hp-row',
    kind: 'manual',
    active: true,
    catalogEntryId: 'missing-hp',
    state: { kind: 'manual' },
  });
  expect(
    readCompanionLinkedInput({ input: { kind: 'maximumHp' }, sheet }),
  ).toEqual({ kind: 'unavailable', reason: 'missingInput' });
});
