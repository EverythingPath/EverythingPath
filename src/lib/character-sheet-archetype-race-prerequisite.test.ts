import { describe, expect, test } from 'vitest';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
  type SheetEntry,
} from './character-sheet';

// archetype-race-eligibility (#716, PRD #251): an imported archetype carries
// its PCGen race restriction as a `race` clause in its `prerequisites`
// (Exarch: `PREFACT:1,TEMPLATES,IsDwarf=true`, arg_abilities_class.lst). The
// sheet's existing prerequisite check reads it on the selected archetype, as
// it reads a feat's: a Character who does not count as the race is warned,
// and counting as it (the race itself, or Racial Heritage's chosen race)
// qualifies. Nothing is refused and no new warning kind is added.

const dwarf = 'pf1/nEltI9y37rKJTeWo';
const human = 'pf1/e6IaBxKgMxy1yKlr';

const catalogEntries: CharacterSheetCatalogEntry[] = [
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
    _id: 'human',
    name: 'Human',
    ruleIdentity: human,
    modifiers: [],
    detail: { kind: 'race', racialTraits: [] },
  },
  {
    _id: 'dwarf',
    name: 'Dwarf',
    ruleIdentity: dwarf,
    modifiers: [],
    detail: { kind: 'race', racialTraits: [] },
  },
  {
    _id: 'inquisitor',
    name: 'Inquisitor',
    ruleIdentity: 'inquisitor',
    modifiers: [],
    detail: {
      kind: 'class',
      classKind: 'base',
      hitDie: 8,
      bab: 'threeQuarters',
      saves: { fort: 'good', ref: 'poor', will: 'good' },
      skillRanksPerLevel: 6,
      classSkills: [],
      featuresByLevel: [],
    },
  },
  {
    _id: 'exarch',
    name: 'Exarch',
    ruleIdentity: 'everythingpath/inquisitor-exarch',
    modifiers: [],
    detail: {
      kind: 'archetype',
      classEntryIds: ['inquisitor'],
      replaces: [],
      adds: [],
    },
    prerequisites: [{ kind: 'race', race: [dwarf] }],
  },
  {
    _id: 'racial-heritage',
    name: 'Racial Heritage',
    ruleIdentity: 'pf1-content/1LULpgVNjQWqUGUk',
    modifiers: [],
    countsAsRaces: { oneOf: [dwarf] },
    detail: { kind: 'feat' },
  },
];

function sheet(
  race: 'human' | 'dwarf',
  heritage?: string,
): CharacterSheetInput {
  const entries: SheetEntry[] = [
    {
      _id: 'base-row',
      kind: 'base',
      active: true,
      catalogEntryId: 'base',
      state: { kind: 'base', abilityMethod: { kind: 'pointBuy', budget: 0 } },
    },
    {
      _id: 'race-row',
      kind: 'race',
      active: true,
      catalogEntryId: race,
      state: { kind: 'race' },
    },
    {
      _id: 'level-1',
      kind: 'classLevel',
      active: true,
      state: {
        kind: 'classLevel',
        classEntryId: 'inquisitor',
        position: 1,
        hpGained: 8,
        skillRanks: {},
      },
    },
    {
      _id: 'exarch-row',
      kind: 'archetype',
      active: true,
      catalogEntryId: 'exarch',
      state: { kind: 'archetype' },
    },
    ...(heritage
      ? [
          {
            _id: 'heritage-row',
            kind: 'feat',
            active: true,
            catalogEntryId: 'racial-heritage',
            state: { kind: 'feat', choice: heritage },
          } satisfies SheetEntry,
        ]
      : []),
  ];
  return { characterKind: 'pc', entries, catalogEntries };
}

const archetypeChecks = (input: CharacterSheetInput) => {
  const result = calculateCharacterSheet(input);
  return {
    checks: result.prerequisites
      .filter(({ entryId }) => entryId === 'exarch-row')
      .map(({ view, met }) => [view, met]),
    warnings: result.warnings
      .filter(
        ({ target }) =>
          target.kind === 'entry' && target.entryId === 'exarch-row',
      )
      .filter(({ check }) => check.startsWith('prerequisites.'))
      .map(({ check, message }) => [check, message]),
  };
};

describe("an archetype's race prerequisite", () => {
  test('warns a Human who takes a dwarf archetype', () => {
    expect(archetypeChecks(sheet('human'))).toEqual({
      checks: [['current', false]],
      warnings: [['prerequisites.current', 'Exarch: Dwarf not met now.']],
    });
  });

  test('does not warn a Dwarf', () => {
    expect(archetypeChecks(sheet('dwarf'))).toEqual({
      checks: [['current', true]],
      warnings: [],
    });
  });

  test('does not warn a Human with Racial Heritage (Dwarf)', () => {
    expect(archetypeChecks(sheet('human', dwarf))).toEqual({
      checks: [['current', true]],
      warnings: [],
    });
  });
});
