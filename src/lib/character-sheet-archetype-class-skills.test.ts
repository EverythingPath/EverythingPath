import { describe, expect, test } from 'vitest';
import type {
  CharacterSheetCatalogEntry,
  CharacterSheetInput,
  SheetEntry,
} from './character-sheet';
import { resolveCharacterSheetArchetypes } from './character-sheet-archetypes';

// rotation-3 (root decision 2026-11-17, option d): two archetypes of one class
// that both change the class skills may not be combined (APG p.72, the
// stacking rule the archetype docs apply). The class-skill list is a class
// feature like any other for that rule, so the sheet warns the Character who
// takes both, as it does for any other shared class feature, and the computed
// list stays base − removed + added.

type ArchetypeDetail = Extract<
  NonNullable<CharacterSheetCatalogEntry['detail']>,
  { kind: 'archetype' }
>;

function baseClass(id: string, classSkills: string[]) {
  return {
    _id: id,
    ruleIdentity: id,
    name: id === 'rogue' ? 'Rogue' : 'Fighter',
    modifiers: [],
    detail: {
      kind: 'class' as const,
      classKind: 'base' as const,
      hitDie: 8,
      bab: 'threeQuarters' as const,
      saves: { fort: 'poor', ref: 'good', will: 'poor' } as const,
      skillRanksPerLevel: 8,
      classSkills,
      featuresByLevel: [{ classLevel: 1, catalogEntryId: `${id}.feature` }],
    },
  } satisfies CharacterSheetCatalogEntry;
}

function archetype(
  id: string,
  name: string,
  detail: Partial<ArchetypeDetail> & { classEntryIds: string[] },
): CharacterSheetCatalogEntry {
  return {
    _id: id,
    ruleIdentity: `archetype.${id}`,
    name,
    modifiers: [],
    detail: { kind: 'archetype', replaces: [], adds: [], ...detail },
  };
}

const catalogEntries: CharacterSheetCatalogEntry[] = [
  baseClass('rogue', ['skill.blf', 'skill.dip']),
  baseClass('fighter', ['skill.clm', 'skill.swm']),
  ...['rogue', 'fighter'].map((id) => ({
    _id: `${id}.feature`,
    ruleIdentity: `${id}.feature`,
    name: id === 'rogue' ? 'Trapfinding' : 'Bravery',
    modifiers: [],
    detail: { kind: 'classFeature' as const },
  })),
  archetype('scout', 'Scout', {
    classEntryIds: ['rogue'],
    classSkillsAdded: ['skill.sur'],
    classSkillsRemoved: ['skill.blf'],
  }),
  archetype('sniper', 'Sniper', {
    classEntryIds: ['rogue'],
    classSkillsAdded: ['skill.per'],
  }),
  archetype('scholar', 'Scholar', {
    classEntryIds: ['rogue'],
    // Changes the class skills in a way the catalog keeps as prose.
    changesClassSkills: true,
  }),
  archetype('trapper', 'Trapper', {
    classEntryIds: ['rogue'],
    replaces: [{ classLevel: 1, catalogEntryId: 'rogue.feature' }],
  }),
  archetype('burglar', 'Burglar', {
    classEntryIds: ['rogue'],
    replaces: [{ classLevel: 1, catalogEntryId: 'rogue.feature' }],
  }),
  archetype('archer', 'Archer', {
    classEntryIds: ['fighter'],
    classSkillsRemoved: ['skill.swm'],
  }),
  archetype('guard', 'Guard', {
    classEntryIds: ['fighter'],
    // Only removes a class skill, and carries no changesClassSkills flag.
    classSkillsRemoved: ['skill.clm'],
  }),
];

function input(...selected: string[]): CharacterSheetInput {
  const level = (id: string, classEntryId: string, position: number) =>
    ({
      _id: id,
      active: true,
      kind: 'classLevel',
      state: {
        kind: 'classLevel',
        classEntryId,
        position,
        hpGained: 8,
        skillRanks: {},
      },
    }) satisfies SheetEntry;
  return {
    characterKind: 'pc',
    entries: [
      level('rogue-1', 'rogue', 1),
      level('fighter-1', 'fighter', 2),
      ...selected.map(
        (id): SheetEntry => ({
          _id: `${id}-row`,
          active: true,
          kind: 'archetype',
          catalogEntryId: id,
          state: { kind: 'archetype' },
        }),
      ),
    ],
    catalogEntries,
  };
}

const conflictWarnings = (...selected: string[]) =>
  resolveCharacterSheetArchetypes(input(...selected)).warnings.filter(
    ({ check }) => check === 'archetypeConflict',
  );
const classSkillsOf = (classEntryId: string, ...selected: string[]) =>
  resolveCharacterSheetArchetypes(input(...selected)).classes.find(
    (result) => result.classEntryId === classEntryId,
  )?.classSkills;

describe('two archetypes of one class that both change the class skills', () => {
  test('warn as an overlap on the class skills, naming both, and keep both selected', () => {
    const result = resolveCharacterSheetArchetypes(input('scout', 'sniper'));
    expect(
      result.warnings.filter(({ check }) => check === 'archetypeConflict'),
    ).toEqual([
      expect.objectContaining({
        kind: 'rules',
        target: { kind: 'entry', entryId: 'scout-row' },
        message:
          'Scout and Sniper both alter the same class feature. Both remain selected.',
      }),
    ]);
    expect(result.conflicts).toEqual([
      {
        featureIdentity: 'classSkills',
        part: null,
        entryIds: ['scout-row', 'sniper-row'],
        classIdentity: 'rogue',
      },
    ]);
    expect(
      result.classes
        .find(({ classEntryId }) => classEntryId === 'rogue')
        ?.archetypes.map(({ entryId, active }) => [entryId, active]),
    ).toEqual([
      ['scout-row', true],
      ['sniper-row', true],
    ]);
  });

  test('warn when one records its change only as changing the class skills', () => {
    expect(conflictWarnings('scout', 'scholar')).toEqual([
      expect.objectContaining({
        message:
          'Scholar and Scout both alter the same class feature. Both remain selected.',
      }),
    ]);
  });

  test('warn when both only remove class skills', () => {
    const result = resolveCharacterSheetArchetypes(input('archer', 'guard'));
    expect(
      result.warnings.filter(({ check }) => check === 'archetypeConflict'),
    ).toEqual([
      expect.objectContaining({
        kind: 'rules',
        message:
          'Archer and Guard both alter the same class feature. Both remain selected.',
      }),
    ]);
    expect(result.conflicts).toEqual([
      {
        featureIdentity: 'classSkills',
        part: null,
        entryIds: ['archer-row', 'guard-row'],
        classIdentity: 'fighter',
      },
    ]);
    expect(classSkillsOf('fighter', 'archer', 'guard')).toEqual([]);
  });

  test('a single archetype that changes the class skills does not warn', () => {
    expect(conflictWarnings('scout')).toEqual([]);
    expect(conflictWarnings('scout', 'trapper')).toEqual([]);
  });

  test('two archetypes that replace the same other feature warn as before, and only for it', () => {
    const result = resolveCharacterSheetArchetypes(input('trapper', 'burglar'));
    expect(result.conflicts).toEqual([
      {
        featureIdentity: 'rogue.feature',
        part: '1:rogue.feature',
        entryIds: ['burglar-row', 'trapper-row'],
        classIdentity: 'rogue',
      },
    ]);
  });

  test('archetypes of different classes that each change their class skills do not warn', () => {
    expect(conflictWarnings('scout', 'archer')).toEqual([]);
  });

  test('an inactive archetype does not warn', () => {
    const sheet = input('scout', 'sniper');
    sheet.entries = sheet.entries.map((entry) =>
      entry.kind === 'archetype' && entry._id === 'sniper-row'
        ? { ...entry, active: false }
        : entry,
    );
    expect(
      resolveCharacterSheetArchetypes(sheet).warnings.filter(
        ({ check }) => check === 'archetypeConflict',
      ),
    ).toEqual([]);
  });

  test('the computed class skills stay base − removed + added in every case', () => {
    expect(classSkillsOf('rogue')).toEqual(['skill.blf', 'skill.dip']);
    expect(classSkillsOf('rogue', 'scout')).toEqual(['skill.dip', 'skill.sur']);
    expect(classSkillsOf('rogue', 'scout', 'sniper')).toEqual([
      'skill.dip',
      'skill.sur',
      'skill.per',
    ]);
    expect(classSkillsOf('rogue', 'scout', 'scholar')).toEqual([
      'skill.dip',
      'skill.sur',
    ]);
    expect(classSkillsOf('rogue', 'scholar')).toEqual([
      'skill.blf',
      'skill.dip',
    ]);
    expect(classSkillsOf('fighter', 'scout', 'archer')).toEqual(['skill.clm']);
  });

  test('the published changes of each archetype are unchanged', () => {
    const result = resolveCharacterSheetArchetypes(input('scout', 'sniper'));
    expect(
      result.classes
        .find(({ classEntryId }) => classEntryId === 'rogue')
        ?.archetypes.map(({ changes }) => changes),
    ).toEqual([[], []]);
  });
});
