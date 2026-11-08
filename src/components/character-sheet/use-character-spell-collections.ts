'use client';

import type {
  SpellsPageController,
  Spellcasting,
} from './character-spells-page-types';
import type { SheetWarningView } from './use-character-sheet';
import type { useCharacterSpellBrowser } from './use-character-spell-browser';

export function useCharacterSpellCollections({
  controller,
  selected,
  browserRows,
}: {
  controller: SpellsPageController;
  selected: Spellcasting | null;
  browserRows: ReturnType<
    typeof useCharacterSpellBrowser
  >['browser']['results'];
}) {
  const { sheet, spells: writes } = controller;
  const collection =
    sheet?.calculated.spellCollections.collections.find(
      (item) => item.classEntryId === selected?.classEntryId,
    ) ?? null;
  function warningsForEntry(entryId: string): SheetWarningView[] {
    return (
      sheet?.warnings.filter(
        (warning) =>
          warning.target.kind === 'entry' && warning.target.entryId === entryId,
      ) ?? []
    );
  }
  function recordedRow(
    spell: NonNullable<typeof collection>['spells'][number],
  ) {
    return {
      ...spell,
      warnings: warningsForEntry(spell.entryId),
      status: writes.statusForEntry(spell.entryId),
    };
  }
  return {
    collection,
    browserRows: browserRows.map((row) => {
      const stored = collection?.spells.find(
        (spell) => spell.catalogEntryId === row.catalogEntryId,
      );
      return {
        ...row,
        entryId: stored?.entryId ?? null,
        explicitLevel: stored?.explicitLevel ?? null,
        warnings: stored ? warningsForEntry(stored.entryId) : [],
        status: writes.statusForSpell(
          selected?.classEntryId ?? '',
          row.catalogEntryId,
        ),
      };
    }),
    recordedSpells: (collection?.spells ?? []).map(recordedRow),
    spellsWithoutSpellcasting: (
      sheet?.calculated.spellCollections.spellsWithoutSpellcasting ?? []
    ).map(recordedRow),
    warningsForLevel: (spellLevel: number) =>
      sheet?.warnings.filter(
        (warning) =>
          warning.target.kind === 'spellcasting' &&
          warning.target.classEntryId === selected?.classEntryId &&
          warning.target.spellLevel === spellLevel,
      ) ?? [],
  };
}
