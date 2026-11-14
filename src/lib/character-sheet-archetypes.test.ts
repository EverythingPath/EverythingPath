import { representativeArchetypeCatalog } from '../../convex/lib/representativeArchetypeCatalog';
import {
  representativeClassCatalog,
  representativeClassFeatureSchedules,
} from '../../convex/lib/representativeClassCatalog';
import { expect, test } from 'vitest';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  calculateCharacterSheetProjections,
  type CharacterSheetInput,
} from './character-sheet';
import { resolveCharacterSheetArchetypes } from './character-sheet-archetypes';

function sheet(): CharacterSheetInput {
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
        _id: 'level-1',
        active: true,
        kind: 'classLevel',
        state: {
          kind: 'classLevel',
          classEntryId: 'rogue',
          position: 1,
          hpGained: 8,
          skillRanks: { 'skill.sur': 1 },
        },
      },
      {
        _id: 'scout-row',
        active: true,
        kind: 'archetype',
        catalogEntryId: 'scout',
        state: { kind: 'archetype' },
      },
    ],
    catalogEntries: [
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
        _id: 'rogue',
        ruleIdentity: 'rogue',
        modifiers: [],
        detail: {
          kind: 'class',
          classKind: 'base',
          hitDie: 8,
          bab: 'threeQuarters',
          saves: { fort: 'poor', ref: 'good', will: 'poor' },
          skillRanksPerLevel: 8,
          classSkills: ['skill.blf'],
          featuresByLevel: [{ classLevel: 1, catalogEntryId: 'trapfinding' }],
        },
      },
      {
        _id: 'trapfinding',
        ruleIdentity: 'rogue.trapfinding',
        name: 'Trapfinding',
        modifiers: [],
        detail: { kind: 'classFeature' },
      },
      {
        _id: 'scout',
        ruleIdentity: 'rogue.scout',
        name: 'Scout',
        modifiers: [],
        detail: {
          kind: 'archetype',
          classEntryIds: ['rogue'],
          replaces: [],
          adds: [],
          classSkillsAdded: ['skill.sur'],
          classSkillsRemoved: ['skill.blf'],
        },
      },
    ],
  };
}

// Synthetic skill alteration exercises the structured class-skill contract of PRD #251 Decision 7.
test('an active archetype changes class skills across its Rogue levels and deactivation restores them', () => {
  const input = sheet();
  expect(
    resolveCharacterSheetArchetypes(input).classes[0]?.classSkills,
  ).toEqual(['skill.sur']);
  expect(
    calculateCharacterSheet(input).skills.find(
      (skill) => skill.key === 'skill.sur',
    )?.classSkill,
  ).toBe(true);
  input.entries = input.entries.map((entry) =>
    entry.kind === 'archetype' && entry._id === 'scout-row'
      ? { ...entry, active: false }
      : entry,
  );
  expect(
    resolveCharacterSheetArchetypes(input).classes[0]?.classSkills,
  ).toEqual(['skill.blf']);
});

// PRD Decisions 5/7: racial rank progression survives Archetype class changes,
// and both budgets use permanent Intelligence rather than temporary effects.
test('racial Hit Dice compose with archetype ranks and class skills in both projections', () => {
  const input = sheet();
  input.catalogEntries = input.catalogEntries.map((entry) => {
    if (entry._id === 'scout' && entry.detail?.kind === 'archetype')
      return { ...entry, detail: { ...entry.detail, skillRanksPerLevel: 6 } };
    if (entry._id === 'base')
      return {
        ...entry,
        modifiers: entry.modifiers.map((modifier) =>
          modifier.target === 'ability.int'
            ? { ...modifier, value: 14 }
            : modifier,
        ),
      };
    return entry;
  });
  input.entries = [
    ...input.entries.map((entry) =>
      entry.kind === 'classLevel'
        ? {
            ...entry,
            state: {
              ...entry.state,
              favoredClassBonus: { choice: 'skill' as const },
              skillRanks: { blf: 1, sur: 1 },
            },
          }
        : entry,
    ),
    {
      _id: 'temporary-row',
      kind: 'condition',
      active: true,
      catalogEntryId: 'temporary',
      state: { kind: 'condition' },
    },
    {
      _id: 'race-row',
      kind: 'race',
      active: true,
      catalogEntryId: 'race',
      state: {
        kind: 'race',
        racialHpGained: 12,
        racialSkillRanks: { blf: 3 },
      },
    },
  ];
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'temporary',
      ruleIdentity: 'temporary',
      detail: { kind: 'condition' },
      modifiers: [
        { target: 'ability.int', bonusType: 'enhancement', value: 4 },
      ],
    },
    {
      _id: 'race',
      ruleIdentity: 'custom-race',
      modifiers: [],
      detail: {
        kind: 'race',
        racialTraits: [],
        racialHitDice: 3,
        racialProgression: {
          creatureType: 'humanoid',
          hitDie: 8,
          bab: 'threeQuarters',
          saves: { fort: 'poor', ref: 'good', will: 'poor' },
          skillRanksPerHitDie: 2,
          classSkills: ['skill.blf'],
        },
      },
    },
  ];
  const projections = calculateCharacterSheetProjections(input);
  expect(projections.current.abilities.intelligence.modifier).toBe(4);
  expect(projections.permanent.abilities.intelligence.modifier).toBe(2);
  for (const result of [projections.current, projections.permanent]) {
    expect(result.budgets).toMatchObject({
      intelligenceModifier: 2,
      racialSkillRanks: 12,
      skillRanks: 21,
      skillRankCap: 4,
      generalFeats: 2,
    });
    expect(result.classLevels[0]).toMatchObject({
      skillRankBudget: 9,
      skillRankCap: 4,
      cumulativeSkillRanks: [
        { skill: 'skill.blf', ranks: 4 },
        { skill: 'skill.sur', ranks: 1 },
      ],
      exceededSkillRankCaps: [],
    });
    expect(
      result.skills.find((skill) => skill.key === 'skill.blf'),
    ).toMatchObject({
      ranks: 4,
      classSkill: true,
    });
    expect(
      result.skills.find((skill) => skill.key === 'skill.sur'),
    ).toMatchObject({
      ranks: 1,
      classSkill: true,
    });
  }
  input.entries = input.entries.map((entry) =>
    entry.kind === 'archetype' ? { ...entry, active: false } : entry,
  );
  const inactive = calculateCharacterSheet(input);
  expect(inactive.budgets).toMatchObject({
    racialSkillRanks: 12,
    skillRanks: 23,
  });
  expect(
    inactive.skills.find((skill) => skill.key === 'skill.sur')?.classSkill,
  ).toBe(false);
  expect(
    inactive.skills.find((skill) => skill.key === 'skill.blf')?.classSkill,
  ).toBe(true);
});

// APG p. 134 Scout's Charge replaces Uncanny Dodge at 4; Skirmisher replaces Improved Uncanny Dodge at 8.
test('replacements apply by identity at their class levels while choices and notes survive turning the source off', () => {
  const input = sheet();
  input.entries = [
    ...input.entries,
    ...Array.from({ length: 7 }, (_, i) => ({
      _id: `level-${i + 2}`,
      kind: 'classLevel' as const,
      active: true as const,
      state: {
        kind: 'classLevel' as const,
        classEntryId: 'rogue',
        position: i + 2,
        hpGained: 4,
      },
    })),
  ];
  const rogue = input.catalogEntries.find((entry) => entry._id === 'rogue');
  const scout = input.catalogEntries.find((entry) => entry._id === 'scout');
  if (
    rogue?.detail?.kind !== 'class' ||
    !('featuresByLevel' in rogue.detail) ||
    scout?.detail?.kind !== 'archetype'
  )
    throw new Error('Missing fixture');
  rogue.detail.featuresByLevel = [
    { classLevel: 4, catalogEntryId: 'uncanny' },
    { classLevel: 8, catalogEntryId: 'improved' },
  ];
  scout.detail.replaces = [
    { classLevel: 4, catalogEntryId: 'uncanny' },
    { classLevel: 8, catalogEntryId: 'improved' },
  ];
  scout.detail.adds = [
    { classLevel: 4, catalogEntryId: 'charge' },
    { classLevel: 8, catalogEntryId: 'skirmisher' },
  ];
  input.catalogEntries = [
    ...input.catalogEntries,
    ...['uncanny', 'improved', 'charge', 'skirmisher'].map((id) => ({
      _id: id,
      ruleIdentity: `rogue.${id}`,
      name: id,
      modifiers: [],
      detail: { kind: 'classFeature' as const },
    })),
  ];
  input.entries = [
    ...input.entries,
    {
      _id: 'recorded-charge',
      kind: 'classFeature',
      active: true,
      catalogEntryId: 'charge',
      grantKey: { source: 'rogue.scout', classLevel: 4, entry: 'rogue.charge' },
      notes: 'Use shortbow',
      state: { kind: 'classFeature', choice: 'saved' },
    },
  ];
  const current = calculateCharacterSheet(input);
  expect(
    current.resolvedEntries.find(
      (row) =>
        'catalogEntryId' in row.entry && row.entry.catalogEntryId === 'uncanny',
    ),
  ).toMatchObject({ dormant: true, counting: false });
  input.entries = input.entries.map((entry) =>
    entry.kind === 'archetype' && entry._id === 'scout-row'
      ? { ...entry, active: false }
      : entry,
  );
  const inactive = calculateCharacterSheet(input);
  expect(
    inactive.resolvedEntries.find(
      (row) =>
        'catalogEntryId' in row.entry && row.entry.catalogEntryId === 'uncanny',
    ),
  ).toMatchObject({ dormant: false, counting: true });
  expect(
    inactive.resolvedEntries.find(
      (row) => row.storedEntryId === 'recorded-charge',
    ),
  ).toMatchObject({
    dormant: true,
    counting: false,
    entry: { notes: 'Use shortbow', state: { choice: 'saved' } },
  });
});

// APG archetype rules / admitted FAQ (#238): independent increments coexist; a whole-feature change conflicts with any increment, including future ones.
test.each([
  ['part', false],
  ['whole', true],
] as const)(
  'a %s alteration distinguishes independent parts and retains both selections',
  (scope, conflicts) => {
    const input = sheet();
    const rogue = input.catalogEntries.find((entry) => entry._id === 'rogue');
    const scout = input.catalogEntries.find((entry) => entry._id === 'scout');
    if (
      rogue?.detail?.kind !== 'class' ||
      !('featuresByLevel' in rogue.detail) ||
      scout?.detail?.kind !== 'archetype'
    )
      throw new Error('Missing fixture');
    rogue.detail.featuresByLevel = [
      { classLevel: 1, catalogEntryId: 'training-1' },
      { classLevel: 8, catalogEntryId: 'training-2' },
    ];
    scout.detail.replaces = [
      { classLevel: 1, catalogEntryId: 'training-1', scope },
    ];
    input.catalogEntries = [
      ...input.catalogEntries,
      {
        _id: 'training-1',
        ruleIdentity: 'training-1',
        modifiers: [],
        detail: { kind: 'classFeature', parentFeature: 'training', part: '1' },
      },
      {
        _id: 'training-2',
        ruleIdentity: 'training-2',
        modifiers: [],
        detail: { kind: 'classFeature', parentFeature: 'training', part: '2' },
      },
      {
        _id: 'second',
        ruleIdentity: 'second',
        modifiers: [],
        detail: {
          kind: 'archetype',
          classEntryIds: ['rogue'],
          replaces: [{ classLevel: 8, catalogEntryId: 'training-2' }],
          adds: [],
        },
      },
    ];
    input.entries = [
      ...input.entries,
      {
        _id: 'second-row',
        kind: 'archetype',
        active: true,
        catalogEntryId: 'second',
        state: { kind: 'archetype' },
      },
    ];
    const result = calculateCharacterSheet(input);
    expect(
      result.warnings.some((warning) => warning.check === 'archetypeConflict'),
    ).toBe(conflicts);
    expect(result.archetypes.classes[0]?.archetypes).toHaveLength(2);
    if (scope === 'whole') {
      input.entries = [
        ...input.entries,
        ...Array.from({ length: 7 }, (_, i) => ({
          _id: `level-${i + 2}`,
          kind: 'classLevel' as const,
          active: true as const,
          state: {
            kind: 'classLevel' as const,
            classEntryId: 'rogue',
            position: i + 2,
            hpGained: 4,
          },
        })),
      ];
      input.entries = input.entries.map((entry) =>
        entry.kind === 'archetype' && entry._id === 'second-row'
          ? { ...entry, active: false }
          : entry,
      );
      expect(
        calculateCharacterSheet(input).resolvedEntries.find(
          (row) =>
            'catalogEntryId' in row.entry &&
            row.entry.catalogEntryId === 'training-2',
        ),
      ).toMatchObject({ dormant: true, counting: false });
    }
  },
);

// CRB Rogue p. 68: a second class granting Uncanny Dodge calls for Improved Uncanny Dodge; PRD Decision 8 requires an advisory prompt.
test('duplicate source-defined upgrades prompt without automatically replacing the original grants', () => {
  const input = sheet();
  const rogue = input.catalogEntries.find((entry) => entry._id === 'rogue');
  if (rogue?.detail?.kind !== 'class' || !('featuresByLevel' in rogue.detail))
    throw new Error('Missing fixture');
  input.entries = [
    ...input.entries,
    {
      _id: 'level-2',
      kind: 'classLevel',
      active: true,
      state: {
        kind: 'classLevel',
        classEntryId: 'barbarian',
        position: 2,
        hpGained: 12,
      },
    },
  ];
  rogue.detail.featuresByLevel = [{ classLevel: 1, catalogEntryId: 'uncanny' }];
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      ...rogue,
      _id: 'barbarian',
      name: 'Barbarian',
      ruleIdentity: 'barbarian',
    },
    {
      _id: 'uncanny',
      name: 'Uncanny Dodge',
      ruleIdentity: 'uncanny-dodge',
      modifiers: [],
      detail: { kind: 'classFeature', duplicateUpgrade: 'improved' },
    },
    {
      _id: 'improved',
      name: 'Improved Uncanny Dodge',
      ruleIdentity: 'improved-uncanny-dodge',
      modifiers: [],
      detail: { kind: 'classFeature' },
    },
  ];
  const result = calculateCharacterSheet(input);
  expect(
    result.warnings.find(
      (warning) => warning.check === 'archetypeFeatureUpgrade',
    )?.message,
  ).toContain('Improved Uncanny Dodge');
  expect(
    result.resolvedEntries.filter(
      (row) =>
        'catalogEntryId' in row.entry &&
        row.entry.catalogEntryId === 'uncanny' &&
        row.counting,
    ),
  ).toHaveLength(2);
  expect(
    result.resolvedEntries.some(
      (row) =>
        'catalogEntryId' in row.entry &&
        row.entry.catalogEntryId === 'improved',
    ),
  ).toBe(false);
});

// Grant lifecycle Decision 6: Keep does not turn an explicitly inactive source on.
test('an inactive kept archetype gives no additions, replacements, skills, budgets or conflicts', () => {
  const input = sheet();
  input.entries = input.entries.map((entry) =>
    entry.kind === 'archetype' && entry._id === 'scout-row'
      ? { ...entry, active: false, kept: true }
      : entry,
  );
  expect(
    calculateCharacterSheet(input).archetypes.classes[0]?.classSkills,
  ).toEqual(['skill.blf']);
});

// #262 warning contract and #238 compatibility: each disputed part can be accepted independently.
test('multiple conflicts and unmatched rows have distinct durable warning subjects', () => {
  const input = sheet();
  const first = input.catalogEntries.find((entry) => entry._id === 'scout');
  if (first?.detail?.kind !== 'archetype') throw new Error('Missing fixture');
  first.detail.replaces = [
    { classLevel: 4, catalogEntryId: 'missing-4' },
    { classLevel: 8, catalogEntryId: 'missing-8' },
  ];
  first.detail.featureChanges = [
    { featureIdentity: 'choices', scope: 'part', part: 'one' },
    { featureIdentity: 'choices', scope: 'part', part: 'two' },
  ];
  input.catalogEntries = [
    ...input.catalogEntries,
    { ...first, _id: 'second', ruleIdentity: 'second' },
  ];
  input.entries = [
    ...input.entries,
    {
      _id: 'second-row',
      kind: 'archetype',
      active: true,
      catalogEntryId: 'second',
      state: { kind: 'archetype' },
    },
  ];
  const warnings = calculateCharacterSheet(input).warnings.filter(
    (warning) =>
      warning.check === 'archetypeConflict' ||
      warning.check === 'archetypeReplacementUnmatched',
  );
  expect(warnings).toHaveLength(8);
  expect(new Set(warnings.map((warning) => warning.subject)).size).toBe(8);
  expect(
    warnings
      .filter((warning) => warning.check === 'archetypeConflict')
      .map((warning) => warning.fingerprint),
  ).toContain(
    JSON.stringify(['rogue', ['rogue.scout', 'second'], 'choices', 'one']),
  );
});

// Synthetic rank overrides exercise PRD Decision 7; competing values must remain explicit rather than pick by edit order.
test('archetype rank overrides update both projections and competing overrides leave budgets unresolved', () => {
  const input = sheet();
  const first = input.catalogEntries.find((entry) => entry._id === 'scout');
  if (first?.detail?.kind !== 'archetype') throw new Error('Missing fixture');
  first.detail.skillRanksPerLevel = 6;
  const projections = calculateCharacterSheetProjections(input);
  expect(projections.current.classLevels[0]?.skillRankBudget).toBe(6);
  expect(projections.permanent.classLevels[0]?.skillRankBudget).toBe(6);
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      ...first,
      _id: 'second',
      ruleIdentity: 'second',
      detail: { ...first.detail, skillRanksPerLevel: 4 },
    },
  ];
  input.entries = [
    ...input.entries,
    {
      _id: 'second-row',
      kind: 'archetype',
      active: true,
      catalogEntryId: 'second',
      state: { kind: 'archetype' },
    },
  ];
  const result = calculateCharacterSheet(input);
  expect(result.classLevels[0]?.skillRankBudget).toBeNull();
  expect(
    result.warnings.some(
      (warning) => warning.check === 'archetypeSkillRanksConflict',
    ),
  ).toBe(true);
});

// Pathfinder Unchained chapter 1 and #226: original Rogue replacements match by feature name and class level, preserving identity through Catalog Copies.
test.each([
  ['rogue', true],
  ['monk', false],
] as const)(
  'renamed %s Catalog Copies keep counterpart eligibility and unmatched features are never guessed',
  (family, compatible) => {
    const input = sheet();
    const original = input.catalogEntries.find(
      (entry) => entry._id === 'rogue',
    );
    const archetype = input.catalogEntries.find(
      (entry) => entry._id === 'scout',
    );
    if (
      original?.detail?.kind !== 'class' ||
      !('featuresByLevel' in original.detail) ||
      archetype?.detail?.kind !== 'archetype'
    )
      throw new Error('Missing fixture');
    original.ruleIdentity = family;
    original.name = 'Campaign class';
    archetype.detail.replaces = [
      { classLevel: 1, catalogEntryId: 'trapfinding' },
    ];
    input.catalogEntries = [
      ...input.catalogEntries,
      {
        _id: 'uc-feature',
        ruleIdentity: 'uc-trapfinding',
        name: 'Trapfinding (UC)',
        modifiers: [],
        detail: { kind: 'classFeature' },
      },
      {
        ...original,
        _id: 'uc-copy',
        ruleIdentity: `${family}-uc`,
        name: 'Campaign replacement',
        detail: {
          ...original.detail,
          counterpartOf: 'rogue',
          featuresByLevel: [{ classLevel: 1, catalogEntryId: 'uc-feature' }],
        },
      },
    ];
    input.entries = input.entries.map((entry) =>
      entry.kind === 'classLevel'
        ? { ...entry, state: { ...entry.state, classEntryId: 'uc-copy' } }
        : entry,
    );
    const result = calculateCharacterSheet(input);
    expect(
      result.resolvedEntries.find(
        (row) =>
          'catalogEntryId' in row.entry &&
          row.entry.catalogEntryId === 'uc-feature',
      )?.dormant,
    ).toBe(compatible);
    expect(
      result.warnings.some(
        (warning) => warning.check === 'archetypeUnchainedMonk',
      ),
    ).toBe(!compatible);
  },
);

test('ordinary classes never match same-named replacement features with different identities', () => {
  const input = sheet();
  const archetype = input.catalogEntries.find((entry) => entry._id === 'scout');
  if (archetype?.detail?.kind !== 'archetype')
    throw new Error('Missing fixture');
  archetype.detail.replaces = [{ classLevel: 1, catalogEntryId: 'impostor' }];
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'impostor',
      ruleIdentity: 'other-feature',
      name: 'Trapfinding',
      modifiers: [],
      detail: { kind: 'classFeature' },
    },
  ];
  const result = calculateCharacterSheet(input);
  expect(
    result.resolvedEntries.find(
      (row) =>
        'catalogEntryId' in row.entry &&
        row.entry.catalogEntryId === 'trapfinding',
    )?.counting,
  ).toBe(true);
  expect(
    result.warnings.some(
      (warning) => warning.check === 'archetypeReplacementUnmatched',
    ),
  ).toBe(true);
});

function representativeSheet(
  classIdentity: string,
  archetype: string,
  levels: number,
): CharacterSheetInput {
  const fixture = sheet();
  return {
    characterKind: 'pc',
    entries: [
      ...fixture.entries.filter((entry) => entry.kind === 'base'),
      ...Array.from({ length: levels }, (_, index) => ({
        _id: `level-${index + 1}`,
        kind: 'classLevel' as const,
        active: true as const,
        state: {
          kind: 'classLevel' as const,
          classEntryId: classIdentity,
          position: index + 1,
          hpGained: 8,
        },
      })),
      {
        _id: 'archetype-row',
        kind: 'archetype',
        catalogEntryId: archetype,
        active: true,
        state: { kind: 'archetype' },
      },
    ],
    catalogEntries: [
      ...fixture.catalogEntries.filter((entry) => entry._id === 'base'),
      ...representativeClassCatalog.map((entry) => ({
        ...entry,
        _id: entry.ruleIdentity,
        detail: {
          ...entry.detail,
          featuresByLevel:
            representativeClassFeatureSchedules[entry.ruleIdentity] ?? [],
        },
      })),
      ...representativeArchetypeCatalog,
    ],
  };
}

// CRB Fighter table p.56; APG Archer p.104 and Scout p.134: literal source schedules, including later increments and capstones.
test.each([
  [
    'fighter',
    'fighter-archer',
    3,
    ['fighter-bravery-2', 'fighter-armor-training-3'],
    ['fighter-archer-hawkeye-2', 'fighter-archer-trick-shot-3'],
  ],
  [
    'fighter',
    'fighter-archer',
    20,
    ['fighter-armor-mastery', 'fighter-weapon-mastery'],
    [
      'fighter-archer-volley',
      'fighter-archer-ranged-defense',
      'fighter-archer-weapon-mastery',
    ],
  ],
  [
    'rogue',
    'rogue-scout',
    8,
    ['rogue-uncanny-dodge', 'rogue-improved-uncanny-dodge'],
    ['rogue-scout-charge', 'rogue-scout-skirmisher'],
  ],
])(
  'representative %s %s at level %s replaces and adds every attained source row',
  (classIdentity, archetype, levels, originals, additions) => {
    const result = calculateCharacterSheet(
      representativeSheet(classIdentity, archetype, levels),
    );
    for (const id of originals)
      expect(
        result.resolvedEntries.find(
          (row) =>
            'catalogEntryId' in row.entry && row.entry.catalogEntryId === id,
        ),
      ).toMatchObject({ dormant: true, counting: false });
    for (const id of additions)
      expect(
        result.resolvedEntries.find(
          (row) =>
            'catalogEntryId' in row.entry && row.entry.catalogEntryId === id,
        ),
      ).toMatchObject({ dormant: false, counting: true });
    expect(
      result.warnings.some(
        (warning) => warning.check === 'archetypeReplacementUnmatched',
      ),
    ).toBe(false);
  },
);

// Admitted FAQ #238: altering a whole bonus-feat list conflicts with a part, but alteration metadata does not remove unrelated grants.
test('whole choice alterations warn about future parts without suppressing untouched grants', () => {
  const input = sheet();
  const first = input.catalogEntries.find((entry) => entry._id === 'scout');
  if (first?.detail?.kind !== 'archetype') throw new Error('Missing fixture');
  first.detail.featureChanges = [
    { featureIdentity: 'talents', scope: 'whole' },
  ];
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'second',
      ruleIdentity: 'second',
      name: 'Other archetype',
      modifiers: [],
      detail: {
        kind: 'archetype',
        classEntryIds: ['rogue'],
        replaces: [],
        adds: [],
        featureChanges: [
          { featureIdentity: 'talents', scope: 'part', part: '20' },
        ],
      },
    },
  ];
  input.entries = [
    ...input.entries,
    {
      _id: 'second-row',
      kind: 'archetype',
      active: true,
      catalogEntryId: 'second',
      state: { kind: 'archetype' },
    },
  ];
  const result = calculateCharacterSheet(input);
  expect(
    result.warnings.some((warning) => warning.check === 'archetypeConflict'),
  ).toBe(true);
  expect(
    result.resolvedEntries.find(
      (row) =>
        'catalogEntryId' in row.entry &&
        row.entry.catalogEntryId === 'trapfinding',
    ),
  ).toMatchObject({ dormant: false, counting: true });
  const reversed = calculateCharacterSheet({
    ...input,
    entries: [...input.entries].reverse(),
  });
  expect(reversed.archetypes.conflicts).toEqual(result.archetypes.conflicts);
  expect(
    reversed.warnings.filter(
      (warning) => warning.check === 'archetypeConflict',
    ),
  ).toEqual(
    result.warnings.filter((warning) => warning.check === 'archetypeConflict'),
  );
});

test('legacy class stubs remain calculable without inventing archetype progressions', () => {
  const input = sheet();
  input.catalogEntries = input.catalogEntries.map((entry) =>
    entry._id === 'rogue' ? { ...entry, detail: { kind: 'class' } } : entry,
  );
  expect(calculateCharacterSheet(input).archetypes.classes).toEqual([]);
});

// CRB tables pp.56/68 and APG pp.104/134: source feature/increment counts at level20, excluding proficiency prose.
test.each([
  ['fighter', 'fighter-archer', 15, 20, 11],
  ['rogue', 'rogue-scout', 2, 2, 30],
])(
  'complete %s schedules preserve all unchanged rows through 20',
  (classIdentity, archetype, replaced, added, unchanged) => {
    const result = calculateCharacterSheet(
      representativeSheet(classIdentity, archetype, 20),
    );
    const features = result.resolvedEntries.filter(
      (row) => row.entry.kind === 'classFeature' && row.entry.grantKey,
    );
    expect(
      features.filter(
        (row) =>
          'grantKey' in row.entry &&
          row.entry.grantKey?.source === classIdentity &&
          row.dormant,
      ),
    ).toHaveLength(replaced);
    expect(
      features.filter(
        (row) =>
          'grantKey' in row.entry &&
          row.entry.grantKey?.source === archetype &&
          row.counting,
      ),
    ).toHaveLength(added);
    expect(
      features.filter(
        (row) =>
          'grantKey' in row.entry &&
          row.entry.grantKey?.source === classIdentity &&
          row.counting,
      ),
    ).toHaveLength(unchanged);
  },
);

// APG Scout p.134 + Pathfinder Unchained ch.1: whole-feature replacements map the original feature to the counterpart by name and exact level first.
test('Scout whole replacements suppress distinct Unchained Rogue features while retaining durable original Grant keys', () => {
  const input = representativeSheet('rogue', 'rogue-scout', 8);
  const original = input.catalogEntries.find((entry) => entry._id === 'rogue');
  if (
    original?.detail?.kind !== 'class' ||
    !('featuresByLevel' in original.detail)
  )
    throw new Error('Missing Rogue');
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'uc-uncanny',
      ruleIdentity: 'opaque-uc-uncanny',
      name: 'Uncanny Dodge (UC)',
      modifiers: [],
      detail: { kind: 'classFeature', parentFeature: 'uc-uncanny' },
    },
    {
      _id: 'uc-improved',
      ruleIdentity: 'opaque-uc-improved',
      name: 'Improved Uncanny Dodge (UC)',
      modifiers: [],
      detail: { kind: 'classFeature', parentFeature: 'uc-improved' },
    },
    {
      ...original,
      _id: 'uc-rogue',
      ruleIdentity: 'rogue-uc',
      name: 'Campaign Rogue',
      detail: {
        ...original.detail,
        counterpartOf: 'rogue',
        featuresByLevel: [
          { classLevel: 4, catalogEntryId: 'uc-uncanny' },
          { classLevel: 8, catalogEntryId: 'uc-improved' },
        ],
      },
    },
  ];
  input.entries = input.entries.map((entry) =>
    entry.kind === 'classLevel'
      ? { ...entry, state: { ...entry.state, classEntryId: 'uc-rogue' } }
      : entry,
  );
  const result = calculateCharacterSheet(input);
  expect(
    result.warnings.filter(
      (warning) => warning.check === 'archetypeReplacementUnmatched',
    ),
  ).toEqual([]);
  for (const id of ['uc-uncanny', 'uc-improved'])
    expect(
      result.resolvedEntries.find(
        (row) =>
          'catalogEntryId' in row.entry && row.entry.catalogEntryId === id,
      ),
    ).toMatchObject({ dormant: true, counting: false });
});

// Pinned pf1 classes source identities (classes/rogue.24b0LaabeAlUx5gN.yaml and monk.W8dxwZ1CZiwLKsqr.yaml) survive Catalog Copy renames.
test.each([
  ['pf1/24b0LaabeAlUx5gN', true],
  ['pf1/W8dxwZ1CZiwLKsqr', false],
] as const)(
  'opaque original class %s preserves Unchained archetype eligibility by canonical identity',
  (originalIdentity, compatible) => {
    const input = sheet();
    const original = input.catalogEntries.find(
      (entry) => entry._id === 'rogue',
    );
    const archetype = input.catalogEntries.find(
      (entry) => entry._id === 'scout',
    );
    if (
      original?.detail?.kind !== 'class' ||
      !('featuresByLevel' in original.detail) ||
      archetype?.detail?.kind !== 'archetype'
    )
      throw new Error('Missing fixture');
    original.ruleIdentity = originalIdentity;
    original.name = 'Campaign class';
    archetype.detail.replaces = [
      { classLevel: 1, catalogEntryId: 'trapfinding', scope: 'whole' },
    ];
    input.catalogEntries = [
      ...input.catalogEntries,
      {
        _id: 'uc-feature',
        ruleIdentity: 'opaque-uc-feature',
        name: 'Trapfinding (UC)',
        modifiers: [],
        detail: { kind: 'classFeature' },
      },
      {
        ...original,
        _id: 'uc-copy',
        ruleIdentity: 'pf1/opaque-counterpart',
        detail: {
          ...original.detail,
          counterpartOf: 'rogue',
          featuresByLevel: [{ classLevel: 1, catalogEntryId: 'uc-feature' }],
        },
      },
    ];
    input.entries = input.entries.map((entry) =>
      entry.kind === 'classLevel'
        ? { ...entry, state: { ...entry.state, classEntryId: 'uc-copy' } }
        : entry,
    );
    const result = calculateCharacterSheet(input);
    expect(
      result.resolvedEntries.find(
        (row) =>
          'catalogEntryId' in row.entry &&
          row.entry.catalogEntryId === 'uc-feature',
      )?.dormant,
    ).toBe(compatible);
    expect(
      result.warnings.some(
        (warning) => warning.check === 'archetypeUnchainedMonk',
      ),
    ).toBe(!compatible);
  },
);

// Pathfinder Unchained ch.1 / #238: original and UC-native archetypes touching the same mapped feature conflict under one durable semantic identity.
test('original and Unchained-native alterations share feature conflict identities', () => {
  const input = representativeSheet('rogue', 'rogue-scout', 8);
  const original = input.catalogEntries.find((entry) => entry._id === 'rogue');
  if (
    original?.detail?.kind !== 'class' ||
    !('featuresByLevel' in original.detail)
  )
    throw new Error('Missing Rogue');
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'uc-uncanny',
      ruleIdentity: 'uc-uncanny-dodge',
      name: 'Uncanny Dodge (UC)',
      modifiers: [],
      detail: { kind: 'classFeature', parentFeature: 'uc-uncanny' },
    },
    {
      ...original,
      _id: 'uc-rogue',
      ruleIdentity: 'rogue-uc',
      detail: {
        ...original.detail,
        counterpartOf: 'rogue',
        featuresByLevel: [{ classLevel: 4, catalogEntryId: 'uc-uncanny' }],
      },
    },
    {
      _id: 'uc-native',
      ruleIdentity: 'uc-native',
      name: 'Native archetype',
      modifiers: [],
      detail: {
        kind: 'archetype',
        classEntryIds: ['uc-rogue'],
        replaces: [
          { classLevel: 4, catalogEntryId: 'uc-uncanny', scope: 'whole' },
        ],
        adds: [],
      },
    },
  ];
  input.entries = [
    ...input.entries.map((entry) =>
      entry.kind === 'classLevel'
        ? { ...entry, state: { ...entry.state, classEntryId: 'uc-rogue' } }
        : entry,
    ),
    {
      _id: 'native-row',
      kind: 'archetype',
      catalogEntryId: 'uc-native',
      active: true,
      state: { kind: 'archetype' },
    },
  ];
  const result = calculateCharacterSheet(input);
  expect(result.archetypes.conflicts).toContainEqual({
    classIdentity: 'rogue',
    featureIdentity: 'uncanny-dodge',
    part: null,
    entryIds: ['archetype-row', 'native-row'],
  });
  const native = input.catalogEntries.find(
    (entry) => entry._id === 'uc-native',
  );
  if (native?.detail?.kind !== 'archetype')
    throw new Error('Missing native archetype');
  native.detail.replaces = [];
  native.detail.featureChanges = [
    { featureIdentity: 'uc-uncanny', scope: 'whole' },
  ];
  expect(calculateCharacterSheet(input).archetypes.conflicts).toEqual(
    result.archetypes.conflicts,
  );
});

// #238/#226 admitted compatibility: counterpart names map feature parents and independent parts, including explicit choice/list alterations.
test.each([
  ['part', 4, true],
  ['part', 8, false],
  ['whole', 8, true],
] as const)(
  'counterpart %s alteration against native part %s preserves precise conflicts',
  (scope, nativeLevel, conflicts) => {
    const input = sheet();
    const original = input.catalogEntries.find(
      (entry) => entry._id === 'rogue',
    );
    const archetype = input.catalogEntries.find(
      (entry) => entry._id === 'scout',
    );
    if (
      original?.detail?.kind !== 'class' ||
      !('featuresByLevel' in original.detail) ||
      archetype?.detail?.kind !== 'archetype'
    )
      throw new Error('Missing fixture');
    original.detail.featuresByLevel = [
      { classLevel: 4, catalogEntryId: 'training-4' },
      { classLevel: 8, catalogEntryId: 'training-8' },
    ];
    archetype.detail.replaces = [
      { classLevel: 4, catalogEntryId: 'training-4', scope },
    ];
    input.catalogEntries = [
      ...input.catalogEntries,
      ...[4, 8].flatMap((classLevel) => [
        {
          _id: `training-${classLevel}`,
          ruleIdentity: `training-${classLevel}`,
          name: `Training ${classLevel}`,
          modifiers: [],
          detail: {
            kind: 'classFeature' as const,
            parentFeature: 'training',
            part: String(classLevel),
          },
        },
        {
          _id: `uc-training-${classLevel}`,
          ruleIdentity: `uc-training-${classLevel}`,
          name: `Training ${classLevel} (UC)`,
          modifiers: [],
          detail: {
            kind: 'classFeature' as const,
            parentFeature: 'uc-training',
          },
        },
      ]),
      {
        ...original,
        _id: 'uc-rogue',
        ruleIdentity: 'rogue-uc',
        detail: {
          ...original.detail,
          counterpartOf: 'rogue',
          featuresByLevel: [
            { classLevel: 4, catalogEntryId: 'uc-training-4' },
            { classLevel: 8, catalogEntryId: 'uc-training-8' },
          ],
        },
      },
      {
        _id: 'native',
        ruleIdentity: 'native',
        modifiers: [],
        detail: {
          kind: 'archetype',
          classEntryIds: ['uc-rogue'],
          replaces: [],
          adds: [],
          featureChanges: [
            {
              featureIdentity: 'uc-training',
              scope: 'part',
              part: `${nativeLevel}:uc-training-${nativeLevel}`,
            },
          ],
        },
      },
    ];
    input.entries = [
      ...input.entries.map((entry) =>
        entry.kind === 'classLevel'
          ? { ...entry, state: { ...entry.state, classEntryId: 'uc-rogue' } }
          : entry,
      ),
      {
        _id: 'native-row',
        kind: 'archetype',
        catalogEntryId: 'native',
        active: true,
        state: { kind: 'archetype' },
      },
    ];
    expect(
      calculateCharacterSheet(input).warnings.some(
        (warning) => warning.check === 'archetypeConflict',
      ),
    ).toBe(conflicts);
  },
);

// APG Archer p.104 and CRB Fighter table p.56: each feature-level row appears exactly once.
test('Archer replacements contain the exact fifteen original Fighter rows without duplicates', () => {
  const result = resolveCharacterSheetArchetypes(
    representativeSheet('fighter', 'fighter-archer', 20),
  );
  expect(result.classes[0]?.archetypes[0]?.replacements).toEqual([
    { classLevel: 2, catalogEntryId: 'fighter-bravery-2', scope: 'whole' },
    { classLevel: 6, catalogEntryId: 'fighter-bravery-6', scope: 'whole' },
    { classLevel: 10, catalogEntryId: 'fighter-bravery-10', scope: 'whole' },
    { classLevel: 14, catalogEntryId: 'fighter-bravery-14', scope: 'whole' },
    { classLevel: 18, catalogEntryId: 'fighter-bravery-18', scope: 'whole' },
    {
      classLevel: 3,
      catalogEntryId: 'fighter-armor-training-3',
      scope: 'whole',
    },
    {
      classLevel: 7,
      catalogEntryId: 'fighter-armor-training-7',
      scope: 'whole',
    },
    {
      classLevel: 11,
      catalogEntryId: 'fighter-armor-training-11',
      scope: 'whole',
    },
    {
      classLevel: 15,
      catalogEntryId: 'fighter-armor-training-15',
      scope: 'whole',
    },
    {
      classLevel: 5,
      catalogEntryId: 'fighter-weapon-training-5',
      scope: 'part',
    },
    {
      classLevel: 9,
      catalogEntryId: 'fighter-weapon-training-9',
      scope: 'part',
    },
    {
      classLevel: 13,
      catalogEntryId: 'fighter-weapon-training-13',
      scope: 'part',
    },
    {
      classLevel: 17,
      catalogEntryId: 'fighter-weapon-training-17',
      scope: 'part',
    },
    { classLevel: 19, catalogEntryId: 'fighter-armor-mastery', scope: 'whole' },
    {
      classLevel: 20,
      catalogEntryId: 'fighter-weapon-mastery',
      scope: 'whole',
    },
  ]);
});

// #226 mixed original/Unchained levels share one durable class family and one Selection.
test('mixed class versions replace every version row once and emit each semantic conflict once', () => {
  const input = representativeSheet('rogue', 'rogue-scout', 8);
  const original = input.catalogEntries.find((entry) => entry._id === 'rogue');
  const scout = input.catalogEntries.find(
    (entry) => entry._id === 'rogue-scout',
  );
  if (original?.detail?.kind !== 'class' || scout?.detail?.kind !== 'archetype')
    throw new Error('Missing representative fixtures');
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      ...original,
      _id: 'uc-rogue',
      ruleIdentity: 'rogue-uc',
      detail: { ...original.detail, counterpartOf: 'rogue' },
    },
    { ...scout, _id: 'other-scout', ruleIdentity: 'other-scout' },
  ];
  input.entries = [
    ...input.entries.map((entry) =>
      entry.kind === 'classLevel' && entry.state.position > 4
        ? { ...entry, state: { ...entry.state, classEntryId: 'uc-rogue' } }
        : entry,
    ),
    {
      _id: 'other-row',
      kind: 'archetype',
      catalogEntryId: 'other-scout',
      active: true,
      state: { kind: 'archetype' },
    },
  ];
  const result = calculateCharacterSheet(input);
  for (const id of ['rogue-uncanny-dodge', 'rogue-improved-uncanny-dodge']) {
    const row = result.resolvedEntries.find(
      (row) => 'catalogEntryId' in row.entry && row.entry.catalogEntryId === id,
    );
    expect(row?.reason).toEqual({
      kind: 'replaced',
      byEntryIds: ['archetype-row', 'other-row'],
    });
  }
  expect(
    result.warnings.filter((warning) => warning.check === 'archetypeConflict'),
  ).toHaveLength(2);
});

// Unchained chapter 1 excludes original Monk archetypes from automatic application.
test.each(['original-first', 'unchained-first'])(
  'an original Monk archetype retains its additions with mixed versions in %s order',
  (order) => {
    const input = sheet();
    const original = input.catalogEntries.find(
      (entry) => entry._id === 'rogue',
    );
    const archetype = input.catalogEntries.find(
      (entry) => entry._id === 'scout',
    );
    if (
      original?.detail?.kind !== 'class' ||
      archetype?.detail?.kind !== 'archetype'
    )
      throw new Error('Missing fixture');
    original.ruleIdentity = 'monk';
    original.name = 'Monk';
    archetype.detail.adds = [{ classLevel: 1, catalogEntryId: 'extra' }];
    input.catalogEntries = [
      ...input.catalogEntries,
      {
        ...original,
        _id: 'uc-monk',
        ruleIdentity: 'monk-uc',
        name: 'Monk (Unchained)',
        detail: { ...original.detail, counterpartOf: 'rogue' },
      },
      {
        _id: 'extra',
        ruleIdentity: 'monk.extra',
        modifiers: [{ target: 'init', bonusType: 'untyped', value: 2 }],
        detail: { kind: 'classFeature' },
      },
    ];
    const level = input.entries.find((entry) => entry.kind === 'classLevel');
    if (!level) throw new Error('Missing level');
    input.entries = [
      ...input.entries.filter((entry) => entry.kind !== 'classLevel'),
      {
        ...level,
        state: {
          ...level.state,
          classEntryId: order === 'original-first' ? 'rogue' : 'uc-monk',
        },
      },
      {
        ...level,
        _id: 'level-2',
        state: {
          ...level.state,
          position: 2,
          classEntryId: order === 'original-first' ? 'uc-monk' : 'rogue',
        },
      },
    ];
    const result = calculateCharacterSheet(input);
    expect(
      result.resolvedEntries.filter(
        (row) =>
          'catalogEntryId' in row.entry &&
          row.entry.catalogEntryId === 'extra' &&
          row.counting,
      ),
    ).toHaveLength(1);
    expect(result.derivedStatistics.initiative.total).toBe(2);
  },
);

test('an original Monk archetype is dormant on Unchained-only levels and contributes no modifiers or nested grants', () => {
  const input = sheet();
  const original = input.catalogEntries.find((entry) => entry._id === 'rogue');
  const archetype = input.catalogEntries.find((entry) => entry._id === 'scout');
  if (
    original?.detail?.kind !== 'class' ||
    archetype?.detail?.kind !== 'archetype'
  )
    throw new Error('Missing fixture');
  original.ruleIdentity = 'monk';
  archetype.modifiers = [{ target: 'init', bonusType: 'untyped', value: 3 }];
  archetype.grants = [{ catalogEntryId: 'nested' }];
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      ...original,
      _id: 'uc-monk',
      ruleIdentity: 'monk-uc',
      detail: { ...original.detail, counterpartOf: 'rogue' },
    },
    {
      _id: 'nested',
      ruleIdentity: 'nested',
      modifiers: [{ target: 'init', bonusType: 'untyped', value: 4 }],
      detail: { kind: 'classFeature' },
    },
  ];
  input.entries = input.entries.map((entry) =>
    entry.kind === 'classLevel'
      ? { ...entry, state: { ...entry.state, classEntryId: 'uc-monk' } }
      : entry,
  );
  const result = calculateCharacterSheet(input);
  expect(
    result.resolvedEntries.find((row) => row.entry._id === 'scout-row'),
  ).toMatchObject({ dormant: true, counting: false });
  expect(
    result.resolvedEntries.some(
      (row) =>
        'catalogEntryId' in row.entry &&
        row.entry.catalogEntryId === 'nested' &&
        row.counting,
    ),
  ).toBe(false);
  expect(result.derivedStatistics.initiative.total).toBe(0);
});

// Accepted Warnings identify the meaning of a replacement rather than an omitted default.
test('unmatched replacement warnings preserve acceptance when omitted scope becomes explicit part', () => {
  const input = sheet();
  const archetype = input.catalogEntries.find((entry) => entry._id === 'scout');
  if (archetype?.detail?.kind !== 'archetype')
    throw new Error('Missing fixture');
  archetype.detail.replaces = [
    { classLevel: 2, catalogEntryId: 'trapfinding' },
  ];
  const warning = calculateCharacterSheet(input).warnings.find(
    (warning) => warning.check === 'archetypeReplacementUnmatched',
  );
  if (!warning) throw new Error('Missing unmatched replacement warning');
  archetype.detail.replaces = [
    { classLevel: 2, catalogEntryId: 'trapfinding', scope: 'part' },
  ];
  expect(
    calculateCharacterSheet(input).warnings.find(
      (warning) => warning.check === 'archetypeReplacementUnmatched',
    ),
  ).toMatchObject({
    subject: warning.subject,
    fingerprint: warning.fingerprint,
  });
});
