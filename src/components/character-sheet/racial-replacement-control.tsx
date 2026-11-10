'use client';
import type {
  CharacterSheetRacesView,
  RacialTraitOptionView,
} from './character-sheet-races-view-model';
import { RacialReplacementSummary } from './racial-replacement-summary';
import { RacialReplacementsEditor } from './racial-replacements-editor';
import type { useCharacterSheet } from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;

function needsReplacementsEditor(option: RacialTraitOptionView) {
  return (
    option.selected &&
    (option.unresolvedReplacements.length > 0 || option.hasManualReplacements)
  );
}

/**
 * A selected alternate names what it replaces; one whose definition only
 * names its replacements, or that was set by hand, is edited here instead.
 */
export function RacialReplacementControl({
  option,
  isRowActive,
  standardOptions,
  actions,
}: {
  option: RacialTraitOptionView | undefined;
  isRowActive: boolean;
  standardOptions: CharacterSheetRacesView['standardOptions'];
  actions: Controller['races'];
}) {
  if (!option) return null;
  if (option.entryId && needsReplacementsEditor(option))
    return (
      <RacialReplacementsEditor
        key={option.entryId}
        option={option}
        entryId={option.entryId}
        standardOptions={standardOptions}
        actions={actions}
      />
    );
  if (!isRowActive) return null;
  return <RacialReplacementSummary option={option} />;
}
