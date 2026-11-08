import type { useCharacterSheet } from './use-character-sheet';

export type SpellsPageController = Pick<
  ReturnType<typeof useCharacterSheet>,
  'sheet' | 'spells' | 'warnings' | 'spellcastingChoices'
>;
export type SpellsPageSheet = SpellsPageController['sheet'];
export type Spellcasting =
  NonNullable<SpellsPageSheet>['calculated']['spellcastings'][number];
