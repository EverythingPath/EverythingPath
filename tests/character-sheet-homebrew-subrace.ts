import type { CharacterSheetCatalogEntry } from '../src/lib/character-sheet';

// Player-authored definitions for testing independent subrace selections. These
// use the createOneOff definition fields, carry no published source claim, and
// are never part of the representative seed or an imported Catalog Release.
export const homebrewElfSubrace: CharacterSheetCatalogEntry[] = [
  {
    _id: 'homebrew-elf-ability',
    ruleIdentity: 'homebrew-elf-ability',
    name: 'Homebrew Elf Heritage',
    modifiers: [
      { target: 'ability.dex', bonusType: 'racial', value: 2 },
      { target: 'ability.cha', bonusType: 'racial', value: 2 },
      { target: 'ability.con', bonusType: 'racial', value: -2 },
    ],
    detail: {
      kind: 'racialTrait',
      raceEntryIds: ['elf'],
      replaces: ['elf-ability'],
      subrace: 'Homebrew Elf Heritage',
    },
  },
  {
    _id: 'homebrew-elf-vision',
    ruleIdentity: 'homebrew-elf-vision',
    name: 'Homebrew Heritage Vision',
    modifiers: [],
    detail: {
      kind: 'racialTrait',
      raceEntryIds: ['elf'],
      replaces: ['elf-low-light'],
      subrace: 'Homebrew Elf Heritage',
    },
  },
];
