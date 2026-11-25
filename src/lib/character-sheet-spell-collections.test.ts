import { expect, test } from 'vitest';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  characterSheetWarningSchema,
  type CharacterSheetInput,
  type SheetEntry,
} from './character-sheet';
import { findReviewedClassCasting } from './character-sheet-casting-tables';

function sheet(classes: string[]): CharacterSheetInput {
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
      ...classes.map(
        (name, position): SheetEntry => ({
          _id: `${name}-level`,
          kind: 'classLevel',
          active: true,
          state: {
            kind: 'classLevel',
            classEntryId: name,
            position: position + 1,
            hpGained: 6,
          },
        }),
      ),
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: abilityKeys.map((ability) => ({
          target: abilityTargets[ability],
          bonusType: 'base',
          value: 18,
        })),
      },
      ...classes.map((name) => ({
        _id: name,
        name,
        ruleIdentity: `class:${name}`,
        modifiers: [],
        detail: {
          kind: 'class' as const,
          classKind: 'base' as const,
          hitDie: 6,
          bab: 'half' as const,
          saves: { fort: 'poor', ref: 'poor', will: 'good' } as const,
          skillRanksPerLevel: 2,
          casting: findReviewedClassCasting(name),
        },
      })),
    ],
  };
}

function record(
  input: CharacterSheetInput,
  id: string,
  castingClassId: string,
  levels: Record<string, number>,
  level: number,
) {
  input.entries = [
    ...input.entries,
    {
      _id: `${id}-row`,
      kind: 'spell',
      active: true,
      catalogEntryId: id,
      state: { kind: 'spell', castingClassId, level },
    },
  ];
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: id,
      name: id,
      ruleIdentity: `spell:${id}`,
      modifiers: [],
      detail: { kind: 'spell', levels },
    },
  ];
}

test('each casting exposes its own recording model and per-level allowances', () => {
  const input = sheet(['sorcerer', 'wizard', 'alchemist', 'witch', 'cleric']);
  record(input, 'magic-missile', 'sorcerer', { sorcerer: 1, wizard: 1 }, 1);
  record(input, 'shield', 'wizard', { sorcerer: 1, wizard: 1 }, 1);
  const result = calculateCharacterSheet(input);
  expect(
    result.spellCollections.collections.map((collection) => ({
      classEntryId: collection.classEntryId,
      heading: collection.heading,
      readOnly: collection.readOnly,
      spells: collection.spells.map((spell) => spell.name),
      firstLevel: collection.levels.find((level) => level.spellLevel === 1),
    })),
  ).toEqual([
    {
      classEntryId: 'sorcerer',
      heading: 'Spells known',
      readOnly: false,
      spells: ['magic-missile'],
      firstLevel: { spellLevel: 1, count: 1, allowance: 2 },
    },
    {
      classEntryId: 'wizard',
      heading: 'Spellbook',
      readOnly: false,
      spells: ['shield'],
      firstLevel: { spellLevel: 1, count: 1, allowance: null },
    },
    {
      classEntryId: 'alchemist',
      heading: 'Formula book',
      readOnly: false,
      spells: [],
      firstLevel: { spellLevel: 1, count: 0, allowance: null },
    },
    {
      classEntryId: 'witch',
      heading: 'Familiar',
      readOnly: false,
      spells: [],
      firstLevel: { spellLevel: 1, count: 0, allowance: null },
    },
    {
      classEntryId: 'cleric',
      heading: null,
      readOnly: true,
      spells: [],
      firstLevel: { spellLevel: 1, count: 0, allowance: null },
    },
  ]);
  expect(result.spellCollections.spellsWithoutSpellcasting).toEqual([]);
});

test('Catalog Copies retain stored rows while each casting shows and counts one chosen Spell', () => {
  const input = sheet(['sorcerer', 'wizard']);
  record(input, 'magic-missile', 'sorcerer', { sorcerer: 1, wizard: 1 }, 1);
  record(input, 'copied-magic-missile', 'sorcerer', { sorcerer: 1, wizard: 1 }, 1);
  record(input, 'shield', 'sorcerer', { sorcerer: 1, wizard: 1 }, 1);
  record(input, 'wizard-magic-missile', 'wizard', { sorcerer: 1, wizard: 1 }, 1);
  input.catalogEntries = input.catalogEntries.map((entry) =>
    entry._id.endsWith('magic-missile')
      ? { ...entry, ruleIdentity: 'spell:magic-missile' }
      : entry,
  );

  const result = calculateCharacterSheet(input);
  const [known, book] = result.spellCollections.collections;
  expect(known?.spells.map((spell) => spell.entryId)).toEqual([
    'copied-magic-missile-row',
    'shield-row',
  ]);
  expect(known?.levels).toContainEqual({
    spellLevel: 1,
    count: 2,
    allowance: 2,
  });
  expect(book?.levels).toContainEqual({
    spellLevel: 1,
    count: 1,
    allowance: null,
  });
  expect(result.warnings.filter((warning) => warning.check === 'spellCount')).toEqual([]);
  expect(input.entries.filter((entry) => entry.kind === 'spell')).toHaveLength(4);
});

test('a familiar collection follows the effective casting facts rather than the class tag', () => {
  const input = sheet(['witch']);
  input.catalogEntries = input.catalogEntries.map((entry) =>
    entry.detail?.kind === 'class' &&
    'casting' in entry.detail &&
    entry.detail.casting
      ? {
          ...entry,
          detail: {
            ...entry.detail,
            casting: { ...entry.detail.casting, classTag: 'custom-familiar' },
          },
        }
      : entry,
  );
  expect(
    calculateCharacterSheet(input).spellCollections.collections[0]?.heading,
  ).toBe('Familiar');
});

test('known counts, uncastable levels and off-list choices emit inline advisory warnings', () => {
  const input = sheet(['sorcerer']);
  record(input, 'magic-missile', 'sorcerer', { sorcerer: 1 }, 1);
  record(input, 'shield', 'sorcerer', { sorcerer: 1 }, 1);
  record(input, 'cure-light-wounds', 'sorcerer', { cleric: 1 }, 1);
  record(input, 'fireball', 'sorcerer', { sorcerer: 3 }, 3);
  const result = calculateCharacterSheet(input);
  const warnings = result.warnings.filter((warning) =>
    warning.check.startsWith('spell'),
  );
  expect(
    warnings.map((warning) => ({
      check: warning.check,
      kind: warning.kind,
      target: warning.target,
    })),
  ).toEqual([
    {
      check: 'spellOffList',
      kind: 'rules',
      target: { kind: 'entry', entryId: 'cure-light-wounds-row' },
    },
    {
      check: 'spellLevel',
      kind: 'rules',
      target: { kind: 'entry', entryId: 'fireball-row' },
    },
    {
      check: 'spellCount',
      kind: 'rules',
      target: { kind: 'spellcasting', classEntryId: 'sorcerer', spellLevel: 1 },
    },
  ]);
  expect(result.spellCollections.collections[0]?.levels).toContainEqual({
    spellLevel: 1,
    count: 3,
    allowance: 2,
  });
  expect(
    result.spellCollections.collections[0]?.spells.find(
      (spell) => spell.name === 'cure-light-wounds',
    ),
  ).toMatchObject({
    explicitLevel: 1,
    spellLevel: 1,
    offList: true,
  });
});

test('list changes retain explicit levels and lost or read-only castings retain orphaned spells', () => {
  const input = sheet(['wizard']);
  record(input, 'shield', 'wizard', { wizard: 1 }, 1);
  expect(
    calculateCharacterSheet(input).spellCollections.collections[0]?.spells[0],
  ).toMatchObject({
    spellLevel: 1,
    explicitLevel: 1,
    offList: false,
  });
  input.catalogEntries = input.catalogEntries.map((definition) =>
    definition._id === 'shield'
      ? { ...definition, detail: { kind: 'spell', levels: { sorcerer: 1 } } }
      : definition,
  );
  const offList = calculateCharacterSheet(input);
  expect(offList.spellCollections.collections[0]?.spells[0]).toMatchObject({
    spellLevel: 1,
    explicitLevel: 1,
    offList: true,
  });
  input.catalogEntries = input.catalogEntries.map((definition) =>
    definition._id === 'wizard' &&
    definition.detail?.kind === 'class' &&
    'casting' in definition.detail &&
    definition.detail.casting
      ? {
          ...definition,
          detail: {
            ...definition.detail,
            casting: { ...definition.detail.casting, record: 'none' },
          },
        }
      : definition,
  );
  const readOnly = calculateCharacterSheet(input);
  expect(readOnly.spellCollections.collections[0]?.spells).toEqual([]);
  expect(readOnly.spellCollections.spellsWithoutSpellcasting).toEqual([
    expect.objectContaining({
      entryId: 'shield-row',
      spellLevel: 1,
      classEntryId: 'wizard',
      castingClassName: 'wizard',
    }),
  ]);
  expect(readOnly.warnings).toContainEqual(
    expect.objectContaining({
      check: 'spellOrphaned',
      target: { kind: 'entry', entryId: 'shield-row' },
    }),
  );
  input.entries = input.entries.filter((entry) => entry.kind !== 'classLevel');
  const withoutClass = calculateCharacterSheet(input);
  expect(withoutClass.spellCollections.collections).toEqual([]);
  expect(withoutClass.spellCollections.spellsWithoutSpellcasting).toEqual(
    readOnly.spellCollections.spellsWithoutSpellcasting.map((spell) => ({
      ...spell,
      offList: false,
    })),
  );
  expect(withoutClass.warnings).toContainEqual(
    expect.objectContaining({ check: 'spellOrphaned', subject: 'shield-row' }),
  );
});

test('spell definitions grant no Modifiers and derived Grants never consume recorded allowances', () => {
  const input = sheet(['sorcerer']);
  record(input, 'magic-missile', 'sorcerer', { sorcerer: 1 }, 1);
  input.catalogEntries = input.catalogEntries.map((definition) =>
    definition._id === 'magic-missile'
      ? {
          ...definition,
          modifiers: [
            { target: 'ability.str', bonusType: 'untyped', value: 100 },
          ],
        }
      : definition,
  );
  input.entries = [
    ...input.entries,
    {
      _id: 'feature-row',
      kind: 'classFeature',
      active: true,
      catalogEntryId: 'feature',
      state: { kind: 'classFeature' },
    },
  ];
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'feature',
      ruleIdentity: 'feature',
      modifiers: [],
      detail: { kind: 'classFeature' },
      grants: [{ catalogEntryId: 'magic-missile' }],
    },
  ];
  const result = calculateCharacterSheet(input);
  expect(result.abilities.strength.score).toBe(18);
  expect(result.resolvedEntries).toContainEqual(
    expect.objectContaining({
      origin: 'grant',
      entry: expect.objectContaining({
        kind: 'spell',
        catalogEntryId: 'magic-missile',
      }),
    }),
  );
  expect(result.spellCollections.collections[0]?.levels).toContainEqual({
    spellLevel: 1,
    count: 1,
    allowance: 2,
  });
  expect(result.spellCollections.spellsWithoutSpellcasting).toEqual([]);
});

test('spell warning fingerprints survive unrelated edits and change with the relevant facts', () => {
  const input = sheet(['sorcerer']);
  record(input, 'a', 'sorcerer', { sorcerer: 1 }, 1);
  record(input, 'b', 'sorcerer', { sorcerer: 1 }, 1);
  record(input, 'off-list', 'sorcerer', { cleric: 3 }, 3);
  const spellWarnings = (value: CharacterSheetInput) =>
    calculateCharacterSheet(value).warnings.filter((warning) =>
      warning.check.startsWith('spell'),
    );
  const before = spellWarnings(input);
  input.catalogEntries = input.catalogEntries.map((definition) => ({
    ...definition,
    name: `renamed ${definition._id}`,
  }));
  input.entries = [...input.entries].reverse();
  expect(
    spellWarnings(input).map((warning) => [warning.check, warning.fingerprint]),
  ).toEqual(before.map((warning) => [warning.check, warning.fingerprint]));
  input.entries = input.entries.map((entry) =>
    entry.kind === 'spell' && entry.catalogEntryId === 'off-list'
      ? { ...entry, state: { ...entry.state, level: 4 } }
      : entry,
  );
  const changed = spellWarnings(input);
  for (const check of ['spellLevel', 'spellOffList']) {
    expect(
      changed.find((warning) => warning.check === check)?.fingerprint,
    ).not.toBe(before.find((warning) => warning.check === check)?.fingerprint);
  }
  for (const warning of changed)
    expect(characterSheetWarningSchema.safeParse(warning).success).toBe(true);
});

test('legacy unassociated records and missing off-list levels stay visible with actionable warnings', () => {
  const input = sheet(['wizard']);
  record(input, 'unknown-level', 'wizard', { cleric: 1 }, 1);
  input.entries = input.entries.map((entry) =>
    entry.kind === 'spell'
      ? { ...entry, state: { ...entry.state, level: null } }
      : entry,
  );
  const unknown = calculateCharacterSheet(input);
  expect(
    unknown.spellCollections.collections[0]?.spells[0]?.spellLevel,
  ).toBeNull();
  expect(unknown.warnings).toContainEqual(
    expect.objectContaining({
      check: 'spellLevel',
      kind: 'incomplete',
      target: { kind: 'entry', entryId: 'unknown-level-row' },
    }),
  );
  input.entries = input.entries.map((entry) =>
    entry.kind === 'spell' ? { ...entry, state: { kind: 'spell' } } : entry,
  );
  const unassociated = calculateCharacterSheet(input);
  expect(unassociated.spellCollections.spellsWithoutSpellcasting).toEqual([
    expect.objectContaining({
      entryId: 'unknown-level-row',
      classEntryId: null,
      spellLevel: null,
    }),
  ]);
  expect(unassociated.warnings).toContainEqual(
    expect.objectContaining({ check: 'spellOrphaned' }),
  );
});

test('count acceptance keeps its subject and fingerprint when a casting class ID is remapped without changing rule identity', () => {
  const input = sheet(['sorcerer']);
  for (const id of ['a', 'b', 'c'])
    record(input, id, 'sorcerer', { sorcerer: 1 }, 1);
  input.catalogEntries = input.catalogEntries.map((entry) =>
    entry._id === 'sorcerer' ? { ...entry, _id: 'source-sorcerer' } : entry,
  );
  input.entries = input.entries.map((entry) => {
    if (entry.kind === 'classLevel')
      return {
        ...entry,
        state: { ...entry.state, classEntryId: 'source-sorcerer' },
      };
    if (entry.kind === 'spell')
      return {
        ...entry,
        state: { ...entry.state, castingClassId: 'source-sorcerer' },
      };
    return entry;
  });
  const before = calculateCharacterSheet(input).warnings.find(
    (warning) => warning.check === 'spellCount',
  );
  expect(before).toBeDefined();
  input.catalogEntries = input.catalogEntries.map((entry) =>
    entry._id === 'source-sorcerer'
      ? { ...entry, _id: 'remapped-sorcerer' }
      : entry,
  );
  input.entries = input.entries.map((entry) => {
    if (entry.kind === 'classLevel')
      return {
        ...entry,
        state: { ...entry.state, classEntryId: 'remapped-sorcerer' },
      };
    if (entry.kind === 'spell')
      return {
        ...entry,
        state: { ...entry.state, castingClassId: 'remapped-sorcerer' },
      };
    return entry;
  });
  const after = calculateCharacterSheet(input).warnings.find(
    (warning) => warning.check === 'spellCount',
  );
  expect(after).toMatchObject({
    subject: before?.subject,
    fingerprint: before?.fingerprint,
    target: {
      kind: 'spellcasting',
      classEntryId: 'remapped-sorcerer',
      spellLevel: 1,
    },
  });
});

test('ID-based list remapping keeps off-list and count warning acceptance facts', () => {
  const input = sheet(['sorcerer']);
  record(input, 'a', 'sorcerer', { sorcerer: 1 }, 1);
  record(input, 'b', 'sorcerer', { sorcerer: 1 }, 1);
  record(input, 'off-list', 'sorcerer', { cleric: 1 }, 1);
  const warnings = (value: CharacterSheetInput) =>
    calculateCharacterSheet(value)
      .warnings.filter((warning) =>
        ['spellOffList', 'spellCount'].includes(warning.check),
      )
      .map(({ check, subject, fingerprint }) => ({
        check,
        subject,
        fingerprint,
      }));
  const before = warnings(input);
  expect(before.map((warning) => warning.check)).toEqual([
    'spellOffList',
    'spellCount',
  ]);
  input.catalogEntries = input.catalogEntries.map((entry) => {
    if (
      entry.detail?.kind === 'class' &&
      'casting' in entry.detail &&
      entry.detail.casting
    )
      return {
        ...entry,
        _id: 'carried-sorcerer',
        detail: {
          ...entry.detail,
          casting: { ...entry.detail.casting, classTag: 'carried-sorcerer' },
        },
      };
    if (
      entry.detail?.kind === 'spell' &&
      entry.detail.levels?.sorcerer !== undefined
    )
      return {
        ...entry,
        detail: { ...entry.detail, levels: { 'carried-sorcerer': 1 } },
      };
    return entry;
  });
  input.entries = input.entries.map((entry) => {
    if (entry.kind === 'classLevel')
      return {
        ...entry,
        state: { ...entry.state, classEntryId: 'carried-sorcerer' },
      };
    if (entry.kind === 'spell')
      return {
        ...entry,
        state: { ...entry.state, castingClassId: 'carried-sorcerer' },
      };
    return entry;
  });
  expect(warnings(input)).toEqual(before);
});

test('a too-high Spell acceptance survives added lower castable levels, but reopens when the highest castable level changes', () => {
  const input = sheet(['wizard']);
  const classLevel = input.entries.find((entry) => entry.kind === 'classLevel');
  if (classLevel?.kind !== 'classLevel')
    throw new Error('Wizard level is unavailable');
  input.entries = [
    input.entries[0]!,
    ...Array.from({ length: 5 }, (_, index) => ({
      ...classLevel,
      _id: `wizard-${index}`,
      state: { ...classLevel.state, position: index + 1 },
    })),
  ];
  record(input, 'high-spell', 'wizard', { wizard: 6 }, 6);
  input.catalogEntries = input.catalogEntries.map((entry) =>
    entry.detail?.kind === 'class' &&
    'casting' in entry.detail &&
    entry.detail.casting
      ? {
          ...entry,
          detail: {
            ...entry.detail,
            casting: { ...entry.detail.casting, cantrips: false },
          },
        }
      : entry,
  );
  const before = calculateCharacterSheet(input);
  expect(before.spellcastings[0]?.castableSpellLevels).toEqual([1, 2, 3]);
  const warning = before.warnings.find((item) => item.check === 'spellLevel');
  expect(warning).toBeDefined();
  input.catalogEntries = input.catalogEntries.map((entry) =>
    entry.detail?.kind === 'class' &&
    'casting' in entry.detail &&
    entry.detail.casting
      ? {
          ...entry,
          detail: {
            ...entry.detail,
            casting: { ...entry.detail.casting, cantrips: true },
          },
        }
      : entry,
  );
  const withCantrips = calculateCharacterSheet(input);
  expect(withCantrips.spellcastings[0]?.castableSpellLevels).toEqual([
    0, 1, 2, 3,
  ]);
  expect(
    withCantrips.warnings.find((item) => item.check === 'spellLevel')
      ?.fingerprint,
  ).toBe(warning?.fingerprint);
  input.entries = [
    ...input.entries,
    ...[6, 7].map((position) => ({
      ...classLevel,
      _id: `wizard-${position}`,
      state: { ...classLevel.state, position },
    })),
  ];
  const advanced = calculateCharacterSheet(input);
  expect(advanced.spellcastings[0]?.castableSpellLevels).toEqual([
    0, 1, 2, 3, 4,
  ]);
  expect(
    advanced.warnings.find((item) => item.check === 'spellLevel')?.fingerprint,
  ).not.toBe(warning?.fingerprint);
});
