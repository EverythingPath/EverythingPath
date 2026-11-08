import { expect, test } from 'vitest';
import {
  calculateCharacterSheet,
  type CharacterSheetInput,
} from './character-sheet';
import { equipmentSheet } from './character-sheet-equipment-fixture';
import { type ManualProficiency } from './character-sheet-proficiencies';

function weaponResult(
  input: CharacterSheetInput,
  weapon: {
    baseType: string;
    proficiency: 'martial' | 'exotic' | 'always';
    groups?: readonly string[];
  },
) {
  return calculateCharacterSheet(
    {
      ...input,
      entries: [
        ...input.entries,
        {
          _id: 'weapon-row',
          kind: 'item',
          active: true,
          catalogEntryId: 'weapon',
          state: { kind: 'item' },
        },
      ],
      catalogEntries: [
        ...input.catalogEntries,
        {
          _id: 'weapon',
          name: weapon.baseType,
          ruleIdentity: 'weapon',
          modifiers: [],
          detail: { kind: 'item', weapon },
        },
      ],
    },
    { weaponUses: [{ entryId: 'weapon-row', hands: 'two' }] },
  ).weaponProficiencies[0];
}
const longsword = {
  baseType: 'Longsword',
  proficiency: 'martial',
  groups: ['heavy blades'],
} as const;
test.each([
  { added: [{ category: 'martial' }], removed: [], met: true },
  {
    added: [{ baseType: ' longsword ' }],
    removed: [{ category: 'martial' }],
    met: false,
  },
  {
    added: [{ category: 'martial' }],
    removed: [{ baseType: 'longsword' }],
    met: false,
  },
  {
    added: [{ group: 'Heavy Blades' }],
    removed: [{ baseType: 'longsword' }],
    met: false,
  },
  {
    added: [{ baseType: 'longsword' }],
    removed: [{ group: 'heavy blades' }],
    met: false,
  },
] satisfies {
  added: ManualProficiency[];
  removed: ManualProficiency[];
  met: boolean;
}[])(
  'removals defeat every covering grant: $added / $removed',
  ({ added, removed, met }) => {
    const input = equipmentSheet();
    const base = input.entries[0];
    if (base.kind !== 'base') throw new Error('Missing base');
    const result = weaponResult(
      {
        ...input,
        entries: [
          {
            ...base,
            state: { kind: 'base', proficiencies: { added, removed } },
          },
        ],
      },
      longsword,
    );
    expect(result).toMatchObject({
      proficient: met,
      attackPenalty: met ? 0 : -4,
    });
  },
);

test('racial familiarity needs martial training; always weapons survive removals', () => {
  const input = equipmentSheet();
  const base = input.entries[0];
  if (base.kind !== 'base') throw new Error('Missing base');
  const character: CharacterSheetInput = {
    ...input,
    entries: [
      {
        ...base,
        state: {
          kind: 'base',
          proficiencies: {
            added: [{ baseType: 'dwarven urgrosh', asMartial: true }],
            removed: [{ baseType: 'claw' }],
          },
        },
      },
    ],
  };
  const urgrosh = {
    baseType: 'dwarven urgrosh',
    proficiency: 'exotic',
  } as const;
  expect(weaponResult(character, urgrosh)).toMatchObject({
    proficient: false,
    attackPenalty: -4,
  });
  const trained: CharacterSheetInput = {
    ...character,
    catalogEntries: character.catalogEntries.map((row) =>
      row._id === 'base'
        ? { ...row, proficiencies: [{ category: 'martial' }] }
        : row,
    ),
  };
  expect(weaponResult(trained, urgrosh)).toMatchObject({
    proficient: true,
    attackPenalty: 0,
  });
  expect(
    weaponResult(trained, { baseType: 'claw', proficiency: 'always' }),
  ).toMatchObject({ proficient: true, attackPenalty: 0 });
});

test('class choice uses first level and empty choices grant nothing without a warning', () => {
  const input = equipmentSheet();
  const levels: CharacterSheetInput = {
    ...input,
    entries: [
      input.entries[0],
      {
        _id: 'first',
        kind: 'classLevel',
        active: true,
        state: {
          kind: 'classLevel',
          classEntryId: 'cleric',
          position: 1,
          hpGained: 8,
        },
      },
      {
        _id: 'later',
        kind: 'classLevel',
        active: true,
        state: {
          kind: 'classLevel',
          classEntryId: 'cleric',
          position: 2,
          hpGained: 4,
          proficiencyChoice: 'longsword',
        },
      },
    ],
    catalogEntries: [
      ...input.catalogEntries,
      {
        _id: 'cleric',
        name: 'Cleric',
        ruleIdentity: 'cleric',
        modifiers: [],
        detail: { kind: 'class' },
        proficiencies: [{ category: 'simple' }, { choice: true }],
      },
    ],
  };
  const result = calculateCharacterSheet(levels);
  expect(result.proficiencies.missingChoices).toEqual([
    { entryId: 'first', name: 'Cleric', kind: 'classLevel' },
  ]);
  expect(result.proficiencies.grants).toHaveLength(1);
  expect(
    result.warnings.some((warning) =>
      warning.message.includes('proficiency choice'),
    ),
  ).toBe(false);
});

test('derived racial grants follow dormancy and restore choices', () => {
  const input = equipmentSheet();
  const race: CharacterSheetInput = {
    ...input,
    entries: [
      input.entries[0],
      {
        _id: 'race',
        kind: 'race',
        active: true,
        catalogEntryId: 'dwarf',
        state: { kind: 'race' },
      },
    ],
    catalogEntries: [
      ...input.catalogEntries,
      {
        _id: 'dwarf',
        name: 'Dwarf',
        ruleIdentity: 'dwarf',
        modifiers: [],
        detail: { kind: 'race', racialTraits: ['familiarity'] },
      },
      {
        _id: 'familiarity',
        name: 'Weapon familiarity',
        ruleIdentity: 'familiarity',
        modifiers: [],
        detail: { kind: 'racialTrait', raceEntryIds: ['dwarf'], replaces: [] },
        proficiencies: [{ baseType: 'battleaxe' }],
      },
    ],
  };
  expect(
    calculateCharacterSheet(race).proficiencies.grants[0]?.proficiency,
  ).toEqual({ baseType: 'battleaxe' });
  expect(
    calculateCharacterSheet({
      ...race,
      entries: race.entries.map((row) =>
        row.kind === 'race' ? { ...row, active: false } : row,
      ),
    }).proficiencies.grants,
  ).toEqual([]);
  expect(calculateCharacterSheet(race).proficiencies.grants).toHaveLength(1);
});

test('copying a class preserves the first Class Level proficiency choice', () => {
  const input = equipmentSheet();
  const result = calculateCharacterSheet({
    ...input,
    entries: [
      input.entries[0],
      {
        _id: 'first',
        kind: 'classLevel',
        active: true,
        state: {
          kind: 'classLevel',
          classEntryId: 'original',
          position: 1,
          hpGained: 8,
          proficiencyChoice: 'mace',
        },
      },
      {
        _id: 'second',
        kind: 'classLevel',
        active: true,
        state: {
          kind: 'classLevel',
          classEntryId: 'copy',
          position: 2,
          hpGained: 4,
          proficiencyChoice: 'longsword',
        },
      },
    ],
    catalogEntries: [
      ...input.catalogEntries,
      {
        _id: 'original',
        name: 'Cleric',
        ruleIdentity: 'cleric',
        modifiers: [],
        detail: { kind: 'class' },
        proficiencies: [{ choice: true }],
      },
      {
        _id: 'copy',
        name: 'Cleric copy',
        ruleIdentity: 'cleric',
        modifiers: [],
        detail: { kind: 'class' },
        proficiencies: [{ choice: true }],
      },
    ],
  });
  expect(result.proficiencies.grants.map((row) => row.proficiency)).toEqual([
    { baseType: 'mace' },
  ]);
});

test('a dwarf fighter is proficient with a dwarven waraxe in one hand through familiarity', () => {
  const input = equipmentSheet();
  const result = calculateCharacterSheet(
    {
      ...input,
      entries: [
        input.entries[0],
        {
          _id: 'fighter-level',
          kind: 'classLevel',
          active: true,
          state: {
            kind: 'classLevel',
            classEntryId: 'fighter',
            position: 1,
            hpGained: 10,
          },
        },
        {
          _id: 'dwarf-row',
          kind: 'race',
          active: true,
          catalogEntryId: 'dwarf',
          state: { kind: 'race' },
        },
        {
          _id: 'waraxe-row',
          kind: 'item',
          active: true,
          catalogEntryId: 'waraxe',
          state: { kind: 'item' },
        },
      ],
      catalogEntries: [
        ...input.catalogEntries,
        {
          _id: 'fighter',
          ruleIdentity: 'fighter',
          modifiers: [],
          detail: { kind: 'class' },
          proficiencies: [{ category: 'martial' }],
        },
        {
          _id: 'dwarf',
          ruleIdentity: 'dwarf',
          modifiers: [],
          detail: { kind: 'race', racialTraits: ['familiarity'] },
        },
        {
          _id: 'familiarity',
          ruleIdentity: 'familiarity',
          modifiers: [],
          detail: {
            kind: 'racialTrait',
            raceEntryIds: ['dwarf'],
            replaces: [],
          },
          proficiencies: [{ baseType: 'dwarven waraxe', asMartial: true }],
        },
        {
          _id: 'waraxe',
          ruleIdentity: 'waraxe',
          modifiers: [],
          detail: {
            kind: 'item',
            weapon: { baseType: 'dwarven waraxe', proficiency: 'exotic' },
          },
        },
      ],
    },
    { weaponUses: [{ entryId: 'waraxe-row', hands: 'one' }] },
  );
  expect(result.weaponProficiencies[0]).toMatchObject({
    proficient: true,
    attackPenalty: 0,
  });
  expect(
    result.warnings.filter((warning) => warning.check === 'oneHandedExotic'),
  ).toEqual([]);
});

test('martial training meets a bastard sword proficiency prerequisite through two-handed use', () => {
  const input = equipmentSheet();
  const result = calculateCharacterSheet({
    ...input,
    entries: [
      input.entries[0],
      {
        _id: 'feat-row',
        kind: 'feat',
        active: true,
        catalogEntryId: 'feat',
        state: { kind: 'feat' },
      },
    ],
    catalogEntries: [
      ...input.catalogEntries.map((row) =>
        row._id === 'base'
          ? { ...row, proficiencies: [{ category: 'martial' as const }] }
          : row,
      ),
      {
        _id: 'sword',
        ruleIdentity: 'sword',
        modifiers: [],
        detail: {
          kind: 'item',
          weapon: { baseType: 'bastard sword', proficiency: 'exotic' },
        },
      },
      {
        _id: 'feat',
        ruleIdentity: 'feat',
        modifiers: [],
        detail: { kind: 'feat' },
        proficiencyPrerequisites: [
          { kind: 'proficiency', proficiency: { baseType: 'bastard sword' } },
        ],
      },
    ],
  });
  expect(result.proficiencyPrerequisites).toContainEqual(
    expect.objectContaining({
      entryId: 'feat-row',
      view: 'current',
      met: true,
    }),
  );
});

test('proficiency prerequisites match weapon definitions with surrounding spaces', () => {
  const input = equipmentSheet();
  const result = calculateCharacterSheet({
    ...input,
    entries: [
      input.entries[0],
      {
        _id: 'feat-row',
        kind: 'feat',
        active: true,
        catalogEntryId: 'feat',
        state: { kind: 'feat' },
      },
    ],
    catalogEntries: [
      ...input.catalogEntries.map((row) =>
        row._id === 'base'
          ? { ...row, proficiencies: [{ category: 'martial' as const }] }
          : row,
      ),
      {
        _id: 'sword',
        ruleIdentity: 'sword',
        modifiers: [],
        detail: {
          kind: 'item',
          weapon: { baseType: ' Longsword ', proficiency: 'martial' },
        },
      },
      {
        _id: 'feat',
        ruleIdentity: 'feat',
        modifiers: [],
        detail: { kind: 'feat' },
        proficiencyPrerequisites: [
          { kind: 'proficiency', proficiency: { baseType: ' longsword  ' } },
        ],
      },
    ],
  });
  expect(result.proficiencyPrerequisites).toContainEqual(
    expect.objectContaining({ entryId: 'feat-row', met: true }),
  );
});
