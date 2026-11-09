import { expect, test } from 'vitest';
import {
  formatGrantKeyId,
  hasGrantAncestor,
  parseGrantKeyId,
  resolveCharacterSheetGrants,
} from './character-sheet-grants';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  calculateCharacterSheetProjections,
  type CharacterSheetInput,
  type SheetEntry,
} from './character-sheet';
import { representativeRaceCatalog } from '../../convex/lib/representativeRaceCatalog';

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
      level('fighter', 1),
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
        _id: 'fighter',
        ruleIdentity: 'class/fighter',
        name: 'Fighter',
        modifiers: [],
        detail: {
          kind: 'class',
          classKind: 'base',
          hitDie: 10,
          bab: 'full',
          saves: { fort: 'good', ref: 'poor', will: 'poor' },
          skillRanksPerLevel: 2,
          featuresByLevel: [{ classLevel: 1, catalogEntryId: 'training' }],
        },
      },
      {
        _id: 'training',
        ruleIdentity: 'feature/training',
        name: 'Training',
        modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 2 }],
        detail: { kind: 'classFeature' },
      },
    ],
  };
}

function level(classEntryId: string, position: number): SheetEntry {
  return {
    _id: `level-${position}`,
    kind: 'classLevel',
    active: true,
    state: { kind: 'classLevel', classEntryId, position, hpGained: 5 },
  };
}

test('reads nested Grant Keys and warning subjects without losing colon-containing identities', () => {
  const source = formatGrantKeyId({
    source: 'class:戦士',
    classLevel: 2,
    entry: 'feature:training',
  });
  const id = formatGrantKeyId({ source, entry: 'feature:bonus' });
  expect(parseGrantKeyId(id)).toEqual({ source, entry: 'feature:bonus' });
  expect(parseGrantKeyId(`${id}:prerequisite`)).toEqual({
    source,
    entry: 'feature:bonus',
  });
  expect(parseGrantKeyId(source)).toEqual({
    source: 'class:戦士',
    classLevel: 2,
    entry: 'feature:training',
  });
  expect(hasGrantAncestor(`${id}:prerequisite`, 'class:戦士')).toBe(true);
  expect(hasGrantAncestor(id, 'other-class')).toBe(false);
});

test.each([
  'feature:training',
  'grant:999999999999999999999:source::1:x',
  'grant:100:short::1:x',
  'grant:3:abc:x:1:y',
  'grant:3:abc::999999999999999999999:y',
  'grant:3:abc::3:xy',
  'grant:3:abc::1:xy',
])('rejects malformed Grant Key %s when reading ancestors', (id) => {
  expect(parseGrantKeyId(id)).toBeNull();
  expect(hasGrantAncestor(id, 'abc')).toBe(false);
});

test('complete Grant Keys reject warning suffixes, empty identities and unsafe Class Levels', () => {
  const id = formatGrantKeyId({
    source: 'source',
    classLevel: 1,
    entry: 'entry',
  });
  expect(parseGrantKeyId(id, { requireComplete: true })).toEqual({
    source: 'source',
    classLevel: 1,
    entry: 'entry',
  });
  for (const malformed of [
    `${id}:warning`,
    'grant:0:::1:x',
    'grant:1:x::0:',
    'grant:1:x:999999999999999999999:1:y',
  ]) {
    expect(parseGrantKeyId(malformed, { requireComplete: true })).toBeNull();
    expect(parseGrantKeyId(malformed)).not.toBeNull();
  }
});

test.each([
  ['fighter', 'unchained'],
  ['unchained', 'fighter'],
])(
  'a class prompt remains available across selected class family members in %s then %s order',
  (first, second) => {
    const input = sheet();
    const fighter = input.catalogEntries.find(
      (entry) => entry._id === 'fighter',
    );
    if (
      !fighter ||
      fighter.detail?.kind !== 'class' ||
      !('featuresByLevel' in fighter.detail)
    )
      throw new Error('Missing fighter');
    fighter.detail.picksByLevel = [
      { classLevel: 2, list: 'Talents', count: 1 },
    ];
    input.catalogEntries = [
      ...input.catalogEntries,
      {
        ...fighter,
        _id: 'unchained',
        ruleIdentity: 'class/fighter-uc',
        detail: {
          ...fighter.detail,
          counterpartOf: 'fighter',
          picksByLevel: [],
        },
      },
    ];
    input.entries = [
      level(first, 1),
      level(second, 2),
      {
        _id: 'prompt-pick',
        kind: 'classFeature',
        catalogEntryId: 'training',
        active: true,
        selectionSource: {
          kind: 'classPrompt',
          source: 'class/fighter',
          classLevel: 2,
          list: 'Talents',
        },
        state: { kind: 'classFeature', choice: 'saved' },
      },
    ];
    expect(
      resolveCharacterSheetGrants(input).entries.find(
        ({ entry }) => entry._id === 'prompt-pick',
      ),
    ).toMatchObject({ dormant: false, counting: true });
  },
);

test('Class Levels derive features without storing Grants and use durable source and feature identities', () => {
  const input = sheet();
  const result = calculateCharacterSheet(input);
  expect(result.abilities.strength.score).toBe(12);
  expect(
    result.resolvedEntries.find(({ origin }) => origin === 'grant'),
  ).toMatchObject({
    origin: 'grant',
    recorded: false,
    dormant: false,
    counting: true,
    entry: {
      kind: 'classFeature',
      grantKey: {
        source: 'class/fighter',
        classLevel: 1,
        entry: 'feature/training',
      },
    },
  });
  expect(input.entries).toHaveLength(2);
});

test('resolved entries describe Grants and Selections without repeating base scores, Class Levels or ability changes', () => {
  const input = sheet();
  input.entries = [
    ...input.entries,
    {
      _id: 'damage',
      kind: 'abilityDamage',
      active: true,
      state: { kind: 'abilityDamage', ability: 'strength', points: 2 },
    },
    {
      _id: 'drain',
      kind: 'abilityDrain',
      active: true,
      state: { kind: 'abilityDrain', ability: 'strength', points: 1 },
    },
    {
      _id: 'selected-feature',
      kind: 'classFeature',
      active: true,
      catalogEntryId: 'training',
      state: { kind: 'classFeature' },
    },
  ];
  const result = calculateCharacterSheet(input);
  expect(result.resolvedEntries.map(({ entry }) => entry.kind)).toEqual([
    'classFeature',
    'classFeature',
  ]);
  expect(result.level).toBe(1);
  expect(result.abilities.strength.score).toBe(11);
});

test('a kept replaced Grant names the replacing Archetype in its warning', () => {
  const input = sheet();
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'weapon-master',
      ruleIdentity: 'archetype/weapon-master',
      name: 'Weapon Master',
      modifiers: [],
      detail: {
        kind: 'archetype',
        classEntryIds: ['fighter'],
        replaces: [{ classLevel: 1, catalogEntryId: 'training' }],
        adds: [],
      },
    },
  ];
  input.entries = [
    ...input.entries,
    {
      _id: 'archetype',
      kind: 'archetype',
      active: true,
      catalogEntryId: 'weapon-master',
      state: { kind: 'archetype' },
    },
    {
      _id: 'saved-training',
      kind: 'classFeature',
      active: true,
      kept: true,
      catalogEntryId: 'training',
      grantKey: {
        source: 'class/fighter',
        classLevel: 1,
        entry: 'feature/training',
      },
      state: { kind: 'classFeature' },
    },
  ];
  expect(resolveCharacterSheetGrants(input).warnings).toContainEqual(
    expect.objectContaining({
      check: 'keptDormant',
      message: 'Training: kept, although Weapon Master replaces it.',
    }),
  );
});

test('automatic dormant Grants remain available for warning preservation without appearing as saved state', () => {
  const input = sheet();
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'parent',
      ruleIdentity: 'parent',
      modifiers: [],
      grants: [{ catalogEntryId: 'training' }],
      detail: { kind: 'manual' },
    },
  ];
  input.entries = [
    {
      _id: 'parent-row',
      kind: 'manual',
      active: false,
      catalogEntryId: 'parent',
      state: { kind: 'manual' },
    },
  ];
  const result = resolveCharacterSheetGrants(input);
  expect(result.entries).toHaveLength(1);
  expect(
    result.allEntries.find(({ origin }) => origin === 'grant'),
  ).toMatchObject({ dormant: true, counting: false, recorded: false });
});

test('a trait slot does not entitle a dependent feat', () => {
  const input = sheet();
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'trait-source',
      ruleIdentity: 'trait-source',
      modifiers: [],
      grantsSlots: [{ kind: 'trait', count: 1 }],
      detail: { kind: 'manual' },
    },
  ];
  input.entries = [
    {
      _id: 'trait-source-row',
      kind: 'manual',
      active: true,
      catalogEntryId: 'trait-source',
      state: { kind: 'manual' },
    },
    {
      _id: 'feat-pick',
      kind: 'feat',
      active: true,
      catalogEntryId: 'training',
      selectionSource: {
        kind: 'slot',
        grantedBy: { kind: 'entry', entryId: 'trait-source-row' },
      },
      state: { kind: 'feat' },
    },
  ];
  expect(
    resolveCharacterSheetGrants(input).entries.find(
      ({ entry }) => entry._id === 'feat-pick',
    ),
  ).toMatchObject({ dormant: true, counting: false });
});

test('a legacy Selection without a slot index follows only slot zero when another feat slot survives', () => {
  const input = sheet();
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'parent',
      ruleIdentity: 'parent',
      modifiers: [],
      grantsSlots: [
        { kind: 'feat', count: 1 },
        { kind: 'feat', count: 1 },
      ],
      detail: { kind: 'manual' },
    },
    {
      _id: 'pick',
      ruleIdentity: 'feat/pick',
      modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 3 }],
      detail: { kind: 'feat' },
    },
  ];
  input.entries = [
    ...input.entries,
    {
      _id: 'parent-row',
      kind: 'manual',
      active: true,
      catalogEntryId: 'parent',
      state: { kind: 'manual' },
    },
    {
      _id: 'pick-row',
      kind: 'feat',
      active: true,
      catalogEntryId: 'pick',
      state: { kind: 'feat' },
      selectionSource: {
        kind: 'slot',
        grantedBy: { kind: 'entry', entryId: 'parent-row' },
      },
    },
  ];
  expect(
    resolveCharacterSheetGrants(input).entries.find(
      ({ entry }) => entry._id === 'pick-row',
    ),
  ).toMatchObject({ counting: true, dormant: false });
  expect(calculateCharacterSheet(input).abilities.strength.score).toBe(15);
  input.catalogEntries = input.catalogEntries.map((row) =>
    row._id === 'parent'
      ? {
          ...row,
          grantsSlots: [
            { kind: 'trait', count: 1 },
            { kind: 'feat', count: 1 },
          ],
        }
      : row,
  );
  expect(
    resolveCharacterSheetGrants(input).entries.find(
      ({ entry }) => entry._id === 'pick-row',
    ),
  ).toMatchObject({ counting: false, dormant: true });
  expect(calculateCharacterSheet(input).abilities.strength.score).toBe(12);
});

test('deleting an earlier Class Level makes only the highest class-local Grant dormant and a fresh level restores its exact state once', () => {
  const input = sheet();
  const fighter = input.catalogEntries.find((entry) => entry._id === 'fighter');
  if (
    !fighter ||
    fighter.detail?.kind !== 'class' ||
    !('featuresByLevel' in fighter.detail)
  )
    throw new Error('Missing fighter');
  fighter.detail.featuresByLevel = [
    { classLevel: 2, catalogEntryId: 'training' },
  ];
  const saved: SheetEntry = {
    _id: 'saved-training',
    kind: 'classFeature',
    active: true,
    catalogEntryId: 'training',
    grantKey: {
      source: 'class/fighter',
      classLevel: 2,
      entry: 'feature/training',
    },
    notes: 'Chosen at the table',
    state: { kind: 'classFeature', choice: 'swords' },
  };
  input.entries = [...input.entries, level('fighter', 2), saved];
  expect(calculateCharacterSheet(input).abilities.strength.score).toBe(12);
  input.entries = input.entries.filter((entry) => entry._id !== 'level-1');
  const dormant = calculateCharacterSheet(input);
  expect(dormant.abilities.strength.score).toBe(10);
  expect(
    dormant.resolvedEntries.find(({ origin }) => origin === 'grant'),
  ).toMatchObject({
    recorded: true,
    storedEntryId: 'saved-training',
    dormant: true,
    counting: false,
    entry: { state: { choice: 'swords' }, notes: 'Chosen at the table' },
  });
  input.entries = [
    ...input.entries,
    { ...level('fighter', 1), _id: 'fresh-level' },
  ];
  const restored = calculateCharacterSheet(input);
  expect(restored.abilities.strength.score).toBe(12);
  expect(
    restored.resolvedEntries.filter(({ origin }) => origin === 'grant'),
  ).toHaveLength(1);
  expect(
    restored.resolvedEntries.find(({ origin }) => origin === 'grant')?.entry
      .state,
  ).toEqual(saved.state);
});

test('an alternate Racial Trait with no replacements and its Grants go dormant after a race swap and return unchanged', () => {
  const input = sheet();
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'human',
      ruleIdentity: 'race/human',
      modifiers: [],
      detail: { kind: 'race', racialTraits: [] },
    },
    {
      _id: 'elf',
      ruleIdentity: 'race/elf',
      modifiers: [],
      detail: { kind: 'race', racialTraits: [] },
    },
    {
      _id: 'alternate',
      ruleIdentity: 'racial/alternate',
      modifiers: [{ target: 'ability.dex', bonusType: 'racial', value: 2 }],
      detail: { kind: 'racialTrait', raceEntryIds: ['human'], replaces: [] },
      grants: [{ catalogEntryId: 'training' }],
    },
  ];
  input.entries = [
    input.entries[0],
    {
      _id: 'race',
      kind: 'race',
      catalogEntryId: 'human',
      active: true,
      state: { kind: 'race' },
    },
    {
      _id: 'alternate-row',
      kind: 'racialTrait',
      catalogEntryId: 'alternate',
      active: true,
      notes: 'Saved alternate',
      state: { kind: 'racialTrait', choice: 'strength' },
    },
  ].filter((entry): entry is SheetEntry => entry !== undefined);
  const original = calculateCharacterSheet(input);
  expect(original.abilities.dexterity.score).toBe(12);
  expect(original.abilities.strength.score).toBe(12);
  input.entries = input.entries.map((entry) =>
    entry.kind === 'race' ? { ...entry, catalogEntryId: 'elf' } : entry,
  );
  const swapped = calculateCharacterSheet(input);
  expect(swapped.abilities.dexterity.score).toBe(10);
  expect(swapped.abilities.strength.score).toBe(10);
  expect(
    swapped.resolvedEntries.find((row) => row.entry._id === 'alternate-row'),
  ).toMatchObject({
    dormant: true,
    counting: false,
    entry: {
      notes: 'Saved alternate',
      state: { choice: 'strength' },
    },
  });
  input.entries = input.entries.map((entry) =>
    entry.kind === 'race' ? { ...entry, catalogEntryId: 'human' } : entry,
  );
  expect(calculateCharacterSheet(input)).toEqual(original);
});

test('alternate Racial Traits mute replaced Grants, retain choices, and Keep counts without overriding an explicit off state', () => {
  const input = sheet();
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'human',
      ruleIdentity: 'race/human',
      modifiers: [],
      detail: { kind: 'race', racialTraits: ['ability'] },
    },
    {
      _id: 'ability',
      ruleIdentity: 'racial/ability',
      name: 'Ability bonus',
      modifiers: [{ target: 'ability.str', bonusType: 'racial', value: 2 }],
      detail: { kind: 'racialTrait', raceEntryIds: ['human'], replaces: [] },
    },
    {
      _id: 'alternate',
      ruleIdentity: 'racial/alternate',
      name: 'Alternate',
      modifiers: [],
      detail: {
        kind: 'racialTrait',
        raceEntryIds: ['human'],
        replaces: ['ability'],
      },
    },
  ];
  input.entries = [
    input.entries[0],
    {
      _id: 'race',
      kind: 'race',
      catalogEntryId: 'human',
      active: true,
      state: { kind: 'race' },
    },
    {
      _id: 'alternate-row',
      kind: 'racialTrait',
      catalogEntryId: 'alternate',
      active: true,
      state: { kind: 'racialTrait' },
    },
    {
      _id: 'ability-state',
      kind: 'racialTrait',
      catalogEntryId: 'ability',
      active: true,
      grantKey: { source: 'race/human', entry: 'racial/ability' },
      state: { kind: 'racialTrait', choice: 'strength' },
    },
  ].filter((entry): entry is SheetEntry => entry !== undefined);
  const replaced = calculateCharacterSheet(input);
  expect(replaced.abilities.strength.score).toBe(10);
  expect(
    replaced.resolvedEntries.find(({ origin }) => origin === 'grant'),
  ).toMatchObject({
    dormant: true,
    counting: false,
    reason: { kind: 'replaced', byEntryIds: ['alternate-row'] },
    entry: { state: { choice: 'strength' } },
  });
  input.entries = input.entries.map((entry) =>
    'grantKey' in entry && entry.grantKey ? { ...entry, kept: true } : entry,
  );
  const kept = calculateCharacterSheet(input);
  expect(kept.abilities.strength.score).toBe(12);
  expect(kept.warnings).toContainEqual(
    expect.objectContaining({
      check: 'keptDormant',
      target: {
        kind: 'entry',
        entryId: 'grant:10:race/human::14:racial/ability',
      },
    }),
  );
  input.entries = input.entries.map((entry) =>
    entry.kind === 'racialTrait' && entry.grantKey
      ? { ...entry, active: false }
      : entry,
  );
  expect(calculateCharacterSheet(input).abilities.strength.score).toBe(10);
  input.entries = input.entries.map((entry) =>
    entry.kind === 'racialTrait' && entry._id === 'alternate-row'
      ? { ...entry, active: false }
      : 'grantKey' in entry && entry.grantKey
        ? { ...entry, active: true }
        : entry,
  );
  expect(
    calculateCharacterSheet(input).resolvedEntries.find(
      ({ origin }) => origin === 'grant',
    ),
  ).toMatchObject({ dormant: false, counting: true });
  expect(
    calculateCharacterSheet(input).warnings.some(
      (warning) => warning.check === 'keptDormant',
    ),
  ).toBe(false);
});

test('nested Grants and dependent Selections count only while their granting entry counts, and restore without duplicates', () => {
  const input = sheet();
  input.catalogEntries = input.catalogEntries.map((entry) =>
    entry._id === 'training'
      ? {
          ...entry,
          grants: [{ catalogEntryId: 'nested' }],
          grantsSlots: [{ kind: 'feat', featTypes: ['combat'], count: 1 }],
          detail: {
            kind: 'classFeature',
            picksByLevel: [{ classLevel: 1, list: 'talents', count: 1 }],
          },
        }
      : entry,
  );
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'nested',
      ruleIdentity: 'feature/nested',
      modifiers: [{ target: 'ability.dex', bonusType: 'untyped', value: 3 }],
      detail: { kind: 'classFeature' },
    },
    {
      _id: 'pick',
      ruleIdentity: 'pick',
      modifiers: [{ target: 'ability.con', bonusType: 'untyped', value: 2 }],
      detail: { kind: 'feat' },
    },
  ];
  const key = {
    source: 'class/fighter',
    classLevel: 1,
    entry: 'feature/training',
  };
  input.entries = [
    ...input.entries,
    {
      _id: 'bonus-feat',
      kind: 'feat',
      active: true,
      catalogEntryId: 'pick',
      selectionSource: {
        kind: 'slot',
        grantedBy: { kind: 'grant', grantKey: key },
      },
      state: { kind: 'feat' },
    },
    {
      _id: 'talent',
      kind: 'feat',
      active: true,
      catalogEntryId: 'pick',
      selectionSource: {
        kind: 'prompt',
        source: { kind: 'grant', grantKey: key },
        list: 'talents',
        classLevel: 1,
      },
      state: { kind: 'feat' },
    },
    {
      _id: 'general-feat',
      kind: 'feat',
      active: true,
      catalogEntryId: 'pick',
      gainedAtClassLevel: 'level-1',
      state: { kind: 'feat', slot: 'general' },
    },
  ];
  const live = calculateCharacterSheet(input);
  expect(live.abilities.dexterity.score).toBe(13);
  expect(
    live.resolvedEntries.filter(({ origin }) => origin === 'grant'),
  ).toHaveLength(2);
  input.entries = [
    ...input.entries,
    {
      _id: 'off-training',
      kind: 'classFeature',
      catalogEntryId: 'training',
      grantKey: key,
      active: false,
      state: { kind: 'classFeature' },
    },
  ];
  const off = calculateCharacterSheet(input);
  expect(off.abilities.dexterity.score).toBe(10);
  expect(
    off.resolvedEntries.find(({ entry }) => entry._id === 'bonus-feat'),
  ).toMatchObject({ dormant: true, counting: false });
  expect(
    off.resolvedEntries.find(({ entry }) => entry._id === 'talent'),
  ).toMatchObject({ dormant: true, counting: false });
  input.entries = input.entries.filter((entry) => entry._id !== 'level-1');
  expect(
    calculateCharacterSheet(input).resolvedEntries.find(
      ({ entry }) => entry._id === 'general-feat',
    ),
  ).toMatchObject({ dormant: false, counting: true });
  input.entries = [
    ...input.entries.filter((entry) => entry._id !== 'off-training'),
    level('fighter', 1),
  ];
  const restored = calculateCharacterSheet(input);
  expect(restored.abilities.dexterity.score).toBe(13);
  expect(
    restored.resolvedEntries.filter(({ origin }) => origin === 'grant'),
  ).toHaveLength(2);
  expect(
    restored.resolvedEntries.find(({ entry }) => entry._id === 'talent'),
  ).toMatchObject({ dormant: false, counting: true });
});

test('Archetype replacements affect only their class and level, and turning an Archetype off restores base features and dormants its selections', () => {
  const input = sheet();
  const fighter = input.catalogEntries.find((entry) => entry._id === 'fighter');
  if (!fighter) throw new Error('Missing fighter');
  input.catalogEntries = [
    ...input.catalogEntries,
    { ...fighter, _id: 'rogue', ruleIdentity: 'class/rogue', name: 'Rogue' },
    {
      _id: 'weapon-master',
      ruleIdentity: 'archetype/weapon-master',
      name: 'Weapon Master',
      modifiers: [],
      detail: {
        kind: 'archetype',
        classEntryIds: ['fighter'],
        replaces: [{ classLevel: 1, catalogEntryId: 'training' }],
        adds: [{ classLevel: 1, catalogEntryId: 'expertise' }],
      },
    },
    {
      _id: 'expertise',
      ruleIdentity: 'feature/expertise',
      modifiers: [{ target: 'ability.dex', bonusType: 'untyped', value: 4 }],
      grantsSlots: [{ kind: 'feat', featTypes: ['combat'], count: 1 }],
      detail: { kind: 'classFeature' },
    },
  ];
  input.entries = [
    ...input.entries,
    level('rogue', 2),
    {
      _id: 'archetype',
      kind: 'archetype',
      active: true,
      catalogEntryId: 'weapon-master',
      state: { kind: 'archetype' },
    },
    {
      _id: 'bonus',
      kind: 'feat',
      active: true,
      catalogEntryId: 'training',
      selectionSource: {
        kind: 'slot',
        grantedBy: {
          kind: 'grant',
          grantKey: {
            source: 'archetype/weapon-master',
            classLevel: 1,
            entry: 'feature/expertise',
          },
        },
      },
      state: { kind: 'feat' },
    },
  ];
  const replaced = calculateCharacterSheet(input);
  expect(replaced.abilities.dexterity.score).toBe(14);
  expect(
    replaced.resolvedEntries.find(
      ({ entry }) =>
        'grantKey' in entry && entry.grantKey?.source === 'class/fighter',
    ),
  ).toMatchObject({
    dormant: true,
    reason: { kind: 'replaced', byEntryIds: ['archetype'] },
  });
  expect(
    replaced.resolvedEntries.find(
      ({ entry }) =>
        'grantKey' in entry && entry.grantKey?.source === 'class/rogue',
    ),
  ).toMatchObject({ dormant: false, counting: true });
  input.entries = input.entries.map((entry) =>
    entry.kind === 'archetype' ? { ...entry, active: false } : entry,
  );
  const off = calculateCharacterSheet(input);
  expect(off.abilities.dexterity.score).toBe(10);
  expect(
    off.resolvedEntries.find(({ entry }) => entry._id === 'bonus'),
  ).toMatchObject({ dormant: true, counting: false });
  expect(
    off.resolvedEntries.find(
      ({ entry }) =>
        'grantKey' in entry && entry.grantKey?.source === 'class/fighter',
    ),
  ).toMatchObject({ dormant: false, counting: true });
  input.entries = input.entries.filter(
    (entry) =>
      entry.kind !== 'classLevel' || entry.state.classEntryId !== 'fighter',
  );
  expect(
    calculateCharacterSheet(input).resolvedEntries.find(
      ({ entry }) => entry._id === 'archetype',
    ),
  ).toMatchObject({ dormant: true, counting: false });
});

test('Catalog Copies keep Grant identity and recorded choices while duplicate granting classes retain separate state and same-Source stacking', () => {
  const input = sheet();
  const fighter = input.catalogEntries.find((entry) => entry._id === 'fighter');
  const training = input.catalogEntries.find(
    (entry) => entry._id === 'training',
  );
  if (!fighter || !training) throw new Error('Missing definitions');
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      ...fighter,
      _id: 'fighter-copy',
      detail: {
        kind: 'class',
        classKind: 'base',
        hitDie: 10,
        bab: 'full',
        saves: { fort: 'good', ref: 'poor', will: 'poor' },
        skillRanksPerLevel: 2,
        featuresByLevel: [{ classLevel: 1, catalogEntryId: 'training-copy' }],
      },
    },
    { ...training, _id: 'training-copy' },
    { ...fighter, _id: 'rogue', ruleIdentity: 'class/rogue' },
  ];
  input.entries = [
    input.entries[0],
    level('fighter-copy', 1),
    level('rogue', 2),
    {
      _id: 'fighter-state',
      kind: 'classFeature',
      active: true,
      catalogEntryId: 'training-copy',
      grantKey: {
        source: 'class/fighter',
        classLevel: 1,
        entry: 'feature/training',
      },
      state: { kind: 'classFeature', choice: 'swords' },
    },
    {
      _id: 'rogue-state',
      kind: 'classFeature',
      active: true,
      catalogEntryId: 'training',
      grantKey: {
        source: 'class/rogue',
        classLevel: 1,
        entry: 'feature/training',
      },
      state: { kind: 'classFeature', choice: 'daggers' },
    },
    {
      _id: 'selected-training',
      kind: 'classFeature',
      active: true,
      catalogEntryId: 'training',
      state: { kind: 'classFeature' },
    },
  ].filter((entry): entry is SheetEntry => entry !== undefined);
  const live = calculateCharacterSheet(input);
  expect(live.abilities.strength.score).toBe(12);
  expect(
    live.resolvedEntries.filter(({ origin }) => origin === 'grant'),
  ).toHaveLength(2);
  expect(
    live.resolvedEntries.find(({ entry }) => entry._id === 'selected-training')
      ?.origin,
  ).toBe('selection');
  input.entries = input.entries.filter((entry) => entry._id !== 'level-1');
  const removed = calculateCharacterSheet(input);
  expect(removed.abilities.strength.score).toBe(12);
  expect(
    removed.resolvedEntries.find(
      ({ storedEntryId }) => storedEntryId === 'rogue-state',
    ),
  ).toMatchObject({
    dormant: false,
    counting: true,
    entry: { state: { choice: 'daggers' } },
  });
  expect(
    removed.resolvedEntries.find(
      ({ storedEntryId }) => storedEntryId === 'fighter-state',
    ),
  ).toMatchObject({ dormant: true, entry: { state: { choice: 'swords' } } });
});

test('switching between an original class and its Unchained counterpart matches names ignoring UC and dormants unmatched features', () => {
  const input = sheet();
  const fighter = input.catalogEntries.find((entry) => entry._id === 'fighter');
  if (
    !fighter ||
    fighter.detail?.kind !== 'class' ||
    !('featuresByLevel' in fighter.detail)
  )
    throw new Error('Missing class');
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      ...fighter,
      _id: 'unchained',
      ruleIdentity: 'class/fighter-uc',
      detail: {
        ...fighter.detail,
        counterpartOf: 'fighter',
        featuresByLevel: [{ classLevel: 1, catalogEntryId: 'training-uc' }],
      },
    },
    {
      _id: 'training-uc',
      ruleIdentity: 'feature/training-uc',
      name: 'Training (UC)',
      modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 3 }],
      detail: { kind: 'classFeature' },
    },
    {
      _id: 'old-feature',
      ruleIdentity: 'feature/old',
      name: 'Old feature',
      modifiers: [{ target: 'ability.dex', bonusType: 'untyped', value: 4 }],
      detail: { kind: 'classFeature' },
    },
  ];
  fighter.detail.featuresByLevel = [
    ...(fighter.detail.featuresByLevel ?? []),
    { classLevel: 1, catalogEntryId: 'old-feature' },
  ];
  input.entries = [
    input.entries[0],
    level('unchained', 1),
    {
      _id: 'original-choice',
      kind: 'classFeature',
      active: true,
      catalogEntryId: 'training',
      grantKey: {
        source: 'class/fighter',
        classLevel: 1,
        entry: 'feature/training',
      },
      state: { kind: 'classFeature', choice: 'swords' },
    },
    {
      _id: 'old-choice',
      kind: 'classFeature',
      active: true,
      catalogEntryId: 'old-feature',
      grantKey: {
        source: 'class/fighter',
        classLevel: 1,
        entry: 'feature/old',
      },
      state: { kind: 'classFeature', choice: 'remembered' },
    },
  ].filter((entry): entry is SheetEntry => entry !== undefined);
  const switched = calculateCharacterSheet(input);
  expect(
    switched.resolvedEntries.find(
      ({ storedEntryId }) => storedEntryId === 'original-choice',
    ),
  ).toMatchObject({
    dormant: false,
    counting: true,
    entry: { state: { choice: 'swords' } },
  });
  expect(
    switched.resolvedEntries.find(
      ({ storedEntryId }) => storedEntryId === 'old-choice',
    ),
  ).toMatchObject({ dormant: true, counting: false });
  expect(
    switched.resolvedEntries.filter(
      ({ origin, dormant }) => origin === 'grant' && !dormant,
    ),
  ).toHaveLength(1);
  input.entries = input.entries.map((entry) =>
    entry.kind === 'classLevel'
      ? { ...entry, state: { ...entry.state, classEntryId: 'fighter' } }
      : entry,
  );
  expect(
    calculateCharacterSheet(input).resolvedEntries.filter(
      ({ origin, dormant }) => origin === 'grant' && !dormant,
    ),
  ).toHaveLength(2);
});

test('dormant Grants retain relevant formula warning facts without contributing or surfacing the warning until restored', () => {
  const input = sheet();
  input.catalogEntries = input.catalogEntries.map((entry) =>
    entry._id === 'training'
      ? {
          ...entry,
          modifiers: [
            {
              target: 'ability.str',
              bonusType: 'untyped',
              value: { formula: '@unsupported' },
            },
          ],
        }
      : entry,
  );
  input.entries = [
    ...input.entries,
    {
      _id: 'saved-training',
      kind: 'classFeature',
      active: true,
      catalogEntryId: 'training',
      grantKey: {
        source: 'class/fighter',
        classLevel: 1,
        entry: 'feature/training',
      },
      state: { kind: 'classFeature', choice: 'saved' },
    },
  ];
  const live = calculateCharacterSheet(input);
  const accepted = live.warnings.find(
    (warning) => warning.check === 'unsupportedFormula',
  );
  expect(accepted).toBeDefined();
  input.entries = input.entries.filter((entry) => entry.kind !== 'classLevel');
  const dormant = calculateCharacterSheet(input);
  expect(
    dormant.warnings.some((warning) => warning.check === 'unsupportedFormula'),
  ).toBe(false);
  expect(dormant.warningsForAcceptance).toContainEqual(accepted);
  expect(dormant.abilities.strength.score).toBe(10);
  input.catalogEntries = input.catalogEntries.map((entry) =>
    entry._id === 'training'
      ? {
          ...entry,
          modifiers: [
            {
              target: 'ability.str',
              bonusType: 'untyped',
              value: { formula: '@different' },
            },
          ],
        }
      : entry,
  );
  expect(
    calculateCharacterSheet(input).warningsForAcceptance,
  ).not.toContainEqual(accepted);
});

test('duplicate parent Grants keep distinct nested Grant state and source removal never transfers that state to the other parent', () => {
  const input = sheet();
  const fighter = input.catalogEntries.find((entry) => entry._id === 'fighter');
  if (!fighter) throw new Error('Missing fighter');
  input.catalogEntries = input.catalogEntries.map((entry) =>
    entry._id === 'training'
      ? { ...entry, grants: [{ catalogEntryId: 'nested' }] }
      : entry,
  );
  input.catalogEntries = [
    ...input.catalogEntries,
    { ...fighter, _id: 'rogue', ruleIdentity: 'class/rogue' },
    {
      _id: 'nested',
      ruleIdentity: 'feature/nested',
      modifiers: [{ target: 'ability.dex', bonusType: 'untyped', value: 3 }],
      grants: [{ catalogEntryId: 'training' }],
      detail: { kind: 'classFeature' },
    },
  ];
  input.entries = [
    ...input.entries,
    level('rogue', 2),
    {
      _id: 'fighter-nested',
      kind: 'classFeature',
      active: false,
      catalogEntryId: 'nested',
      grantKey: {
        source: 'grant:13:class/fighter:1:16:feature/training',
        classLevel: 1,
        entry: 'feature/nested',
      },
      state: { kind: 'classFeature', choice: 'fighter choice' },
    },
    {
      _id: 'rogue-nested',
      kind: 'classFeature',
      active: true,
      catalogEntryId: 'nested',
      grantKey: {
        source: 'grant:11:class/rogue:1:16:feature/training',
        classLevel: 1,
        entry: 'feature/nested',
      },
      state: { kind: 'classFeature', choice: 'rogue choice' },
    },
  ];
  const live = calculateCharacterSheet(input);
  expect(
    live.resolvedEntries.filter(({ origin }) => origin === 'grant'),
  ).toHaveLength(4);
  expect(
    live.resolvedEntries.find(
      ({ storedEntryId }) => storedEntryId === 'fighter-nested',
    ),
  ).toMatchObject({ dormant: false, counting: false });
  expect(
    live.resolvedEntries.find(
      ({ storedEntryId }) => storedEntryId === 'rogue-nested',
    ),
  ).toMatchObject({ dormant: false, counting: true });
  input.entries = input.entries.filter((entry) => entry._id !== 'level-2');
  const removed = calculateCharacterSheet(input);
  expect(removed.abilities.dexterity.score).toBe(10);
  expect(
    removed.resolvedEntries.find(
      ({ storedEntryId }) => storedEntryId === 'rogue-nested',
    ),
  ).toMatchObject({
    dormant: true,
    entry: { state: { choice: 'rogue choice' } },
  });
});

test('temporary granting sources exclude all descendants from permanent statistics, skill budgets, and whileActive conditions', () => {
  const input = sheet();
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'condition',
      ruleIdentity: 'condition',
      grants: [{ catalogEntryId: 'intelligence' }],
      modifiers: [],
      detail: { kind: 'condition' },
    },
    {
      _id: 'intelligence',
      ruleIdentity: 'feature/intelligence',
      modifiers: [{ target: 'ability.int', bonusType: 'untyped', value: 4 }],
      detail: { kind: 'classFeature' },
    },
    {
      _id: 'dependent',
      ruleIdentity: 'dependent',
      modifiers: [
        {
          target: 'ability.str',
          bonusType: 'untyped',
          value: 5,
          condition: { whileActive: 'intelligence' },
        },
      ],
      detail: { kind: 'manual' },
    },
  ];
  input.entries = [
    ...input.entries,
    {
      _id: 'temporary',
      kind: 'condition',
      catalogEntryId: 'condition',
      active: true,
      state: { kind: 'condition' },
    },
    {
      _id: 'dependent-row',
      kind: 'manual',
      catalogEntryId: 'dependent',
      active: true,
      state: { kind: 'manual' },
    },
  ];
  const projections = calculateCharacterSheetProjections(input);
  expect(projections.current.abilities.intelligence.score).toBe(14);
  expect(projections.current.abilities.strength.score).toBe(17);
  expect(projections.permanent.abilities.intelligence.score).toBe(10);
  expect(projections.permanent.abilities.strength.score).toBe(12);
  expect(projections.current.classLevels[0]?.skillRankBudget).toBe(2);
});

test('class prompt Selections follow class-local entitlement through early row deletion, loss, counterpart switches and restoration', () => {
  const input = sheet();
  const fighter = input.catalogEntries.find((entry) => entry._id === 'fighter');
  if (
    !fighter ||
    fighter.detail?.kind !== 'class' ||
    !('featuresByLevel' in fighter.detail)
  )
    throw new Error('Missing class');
  fighter.detail.picksByLevel = [{ classLevel: 2, list: 'Talents', count: 1 }];
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      ...fighter,
      _id: 'unchained',
      ruleIdentity: 'class/fighter-uc',
      detail: {
        ...fighter.detail,
        counterpartOf: 'fighter',
        picksByLevel: [{ classLevel: 2, list: 'Talents (UC)', count: 1 }],
      },
    },
  ];
  input.entries = [
    ...input.entries,
    level('fighter', 2),
    level('fighter', 3),
    {
      _id: 'prompt-pick',
      kind: 'classFeature',
      catalogEntryId: 'training',
      active: true,
      selectionSource: {
        kind: 'classPrompt',
        source: 'class/fighter',
        classLevel: 2,
        list: 'Talents',
      },
      state: { kind: 'classFeature', choice: 'saved choice' },
    },
  ];
  input.entries = input.entries.filter((entry) => entry._id !== 'level-1');
  expect(
    calculateCharacterSheet(input).resolvedEntries.find(
      ({ entry }) => entry._id === 'prompt-pick',
    ),
  ).toMatchObject({ dormant: false, counting: true });
  input.entries = input.entries.map((entry) =>
    entry.kind === 'classLevel'
      ? { ...entry, state: { ...entry.state, classEntryId: 'unchained' } }
      : entry,
  );
  expect(
    calculateCharacterSheet(input).resolvedEntries.find(
      ({ entry }) => entry._id === 'prompt-pick',
    ),
  ).toMatchObject({ dormant: false, counting: true });
  input.entries = input.entries.filter((entry) => entry._id !== 'level-2');
  expect(
    calculateCharacterSheet(input).resolvedEntries.find(
      ({ entry }) => entry._id === 'prompt-pick',
    ),
  ).toMatchObject({ dormant: true, counting: false });
  input.entries = [
    ...input.entries,
    { ...level('unchained', 1), _id: 'new-level' },
  ];
  expect(
    calculateCharacterSheet(input).resolvedEntries.find(
      ({ entry }) => entry._id === 'prompt-pick',
    ),
  ).toMatchObject({
    dormant: false,
    counting: true,
    entry: { state: { choice: 'saved choice' } },
  });
});

test('deep acyclic Grant chains retain distinct bounded identities, including delimiter-containing rule identities', () => {
  const input = sheet();
  const fighter = input.catalogEntries.find((entry) => entry._id === 'fighter');
  if (
    !fighter ||
    fighter.detail?.kind !== 'class' ||
    !('featuresByLevel' in fighter.detail)
  )
    throw new Error('Missing class');
  input.catalogEntries = input.catalogEntries.map((entry) =>
    entry._id === 'training'
      ? { ...entry, grants: [{ catalogEntryId: 'chain-0' }] }
      : entry,
  );
  input.catalogEntries = [
    ...input.catalogEntries,
    ...Array.from({ length: 22 }, (_, index) => ({
      _id: `chain-${index}`,
      ruleIdentity: `chain/${index}`,
      modifiers: [],
      detail: { kind: 'classFeature' as const },
      ...(index < 21
        ? { grants: [{ catalogEntryId: `chain-${index + 1}` }] }
        : {}),
    })),
    {
      ...fighter,
      _id: 'class-a',
      ruleIdentity: 'a:1:b',
      detail: {
        ...fighter.detail,
        featuresByLevel: [{ classLevel: 1, catalogEntryId: 'feature-a' }],
      },
    },
    {
      ...fighter,
      _id: 'class-b',
      ruleIdentity: 'a',
      detail: {
        ...fighter.detail,
        featuresByLevel: [{ classLevel: 1, catalogEntryId: 'feature-b' }],
      },
    },
    {
      _id: 'feature-a',
      ruleIdentity: 'c',
      modifiers: [],
      detail: { kind: 'classFeature' },
    },
    {
      _id: 'feature-b',
      ruleIdentity: 'b:1:c',
      modifiers: [],
      detail: { kind: 'classFeature' },
    },
  ];
  input.entries = [...input.entries, level('class-a', 2), level('class-b', 3)];
  const grants = calculateCharacterSheet(input).resolvedEntries.filter(
    ({ origin }) => origin === 'grant',
  );
  expect(grants).toHaveLength(25);
  expect(new Set(grants.map(({ entry }) => entry._id)).size).toBe(25);
  expect(grants.every(({ entry }) => entry._id.length < 2000)).toBe(true);
  expect(grants.every(({ counting }) => counting)).toBe(true);
});

test.each([
  { remainingLevels: 5, restored: false, highestDormant: false },
  { remainingLevels: 4, restored: false, highestDormant: true },
  { remainingLevels: 3, restored: false, highestDormant: true },
  { remainingLevels: 4, restored: true, highestDormant: false },
])(
  'five-level class lifecycle keeps lower Grants intact ($remainingLevels levels, restored $restored)',
  ({ remainingLevels, restored, highestDormant }) => {
    const input = sheet();
    const fighter = input.catalogEntries.find(
      (entry) => entry._id === 'fighter',
    );
    if (
      !fighter ||
      fighter.detail?.kind !== 'class' ||
      !('featuresByLevel' in fighter.detail)
    )
      throw new Error('Missing fighter');
    fighter.detail.featuresByLevel = Array.from({ length: 5 }, (_, index) => ({
      classLevel: index + 1,
      catalogEntryId: 'training',
    }));
    input.entries = [
      input.entries[0],
      ...Array.from({ length: 5 }, (_, index) =>
        level('fighter', index + 1),
      ).slice(5 - remainingLevels),
      {
        _id: 'fighter-five',
        kind: 'classFeature',
        active: true,
        catalogEntryId: 'training',
        grantKey: {
          source: 'class/fighter',
          classLevel: 5,
          entry: 'feature/training',
        },
        state: { kind: 'classFeature', choice: 'preserved' },
      },
      ...(restored ? [{ ...level('fighter', 1), _id: 'restored-row' }] : []),
    ].filter((entry): entry is SheetEntry => entry !== undefined);
    const grants = calculateCharacterSheet(input).resolvedEntries.filter(
      ({ origin }) => origin === 'grant',
    );
    expect(grants.filter(({ counting }) => counting)).toHaveLength(
      remainingLevels + Number(restored),
    );
    expect(
      grants.find(
        ({ entry }) => 'grantKey' in entry && entry.grantKey?.classLevel === 5,
      ),
    ).toMatchObject({
      storedEntryId: 'fighter-five',
      dormant: highestDormant,
      entry: { state: { choice: 'preserved' } },
    });
    expect(
      grants
        .filter(
          ({ entry }) =>
            (('grantKey' in entry ? entry.grantKey?.classLevel : undefined) ??
              0) <= remainingLevels,
        )
        .every(({ dormant }) => !dormant),
    ).toBe(true);
  },
);

// #411: CRB p. 22 elf; a Catalog Release retires Keen Senses after an
// attribution hold. A Character that already had the Grant keeps it.
test('a retired Grant target keeps existing Grants and blocks new ones, even when kept', () => {
  const elf = representativeRaceCatalog.filter(
    (entry) =>
      entry._id === 'elf' ||
      (entry.detail?.kind === 'racialTrait' &&
        entry.detail.raceEntryIds.includes('elf')),
  );
  const keenSensesId = formatGrantKeyId({
    source: 'elf',
    entry: 'elf-keen-senses',
  });
  const base = sheet();
  const input = (
    retainedGrantIds: string[],
    entries: SheetEntry[] = [],
  ): CharacterSheetInput => ({
    ...base,
    entries: [
      ...base.entries.filter((entry) => entry.kind === 'base'),
      {
        _id: 'race-row',
        kind: 'race',
        active: true,
        catalogEntryId: 'elf',
        state: { kind: 'race' },
      },
      ...entries,
    ],
    catalogEntries: [
      ...base.catalogEntries.filter((entry) => entry._id === 'base'),
      ...elf,
    ],
    retired: {
      ruleIdentities: ['elf-keen-senses'],
      retainedGrantIds,
    },
  });
  const perception = (sheetInput: CharacterSheetInput) =>
    calculateCharacterSheet(sheetInput).breakdowns['skill.per'].total;
  const keenSenses = (sheetInput: CharacterSheetInput) =>
    calculateCharacterSheet(sheetInput).resolvedEntries.find(
      ({ entry }) => entry._id === keenSensesId,
    );

  expect(perception(input([keenSensesId]))).toBe(2);
  expect(keenSenses(input([keenSensesId]))).toMatchObject({
    dormant: false,
    counting: true,
  });
  expect(perception(input([]))).toBe(0);
  expect(calculateCharacterSheet(input([])).abilities.dexterity.score).toBe(12);
  const kept = input(
    [],
    [
      {
        _id: 'keen-senses-state',
        kind: 'racialTrait',
        active: true,
        kept: true,
        notes: 'Recorded before the release',
        catalogEntryId: 'elf-keen-senses',
        grantKey: { source: 'elf', entry: 'elf-keen-senses' },
        state: { kind: 'racialTrait' },
      },
    ],
  );
  expect(keenSenses(kept)).toMatchObject({
    dormant: true,
    counting: false,
    reason: { kind: 'retired' },
    entry: { notes: 'Recorded before the release', kept: true },
  });
  expect(perception(kept)).toBe(0);
  expect(
    calculateCharacterSheet(kept).warnings.some(
      ({ check }) => check === 'keptDormant',
    ),
  ).toBe(false);
});
