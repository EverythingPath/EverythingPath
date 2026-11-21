'use client';
import type { GrantEntryView } from './character-sheet-grants-view-model';
import type {
  CharacterSheetRacesView,
  RacialChoiceRowView,
  RacialTraitOptionView,
} from './character-sheet-races-view-model';
import { RaceEquivalenceChoice } from './race-equivalence-choice';
import { RacialAbilityScoreChoice } from './racial-ability-score-choice';
import { RacialReplacementControl } from './racial-replacement-control';
import type { useCharacterSheet } from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;

/** The structured choices of one racial row: its +2, its race, its replacements. */
export function RacialRowChoices({
  row,
  choice,
  option,
  standardOptions,
  raceNames,
  actions,
}: {
  row: GrantEntryView;
  choice: RacialChoiceRowView | undefined;
  option: RacialTraitOptionView | undefined;
  standardOptions: CharacterSheetRacesView['standardOptions'];
  raceNames: Record<string, string>;
  actions: Controller['races'];
}) {
  return (
    <>
      {choice?.abilityScoreChoice ? (
        <RacialAbilityScoreChoice row={choice} actions={actions} />
      ) : null}
      {choice && choice.raceChoices.length > 0 ? (
        <RaceEquivalenceChoice
          row={choice}
          raceNames={raceNames}
          actions={actions}
        />
      ) : null}
      <RacialReplacementControl
        option={option}
        isRowActive={row.active}
        standardOptions={standardOptions}
        actions={actions}
      />
    </>
  );
}
