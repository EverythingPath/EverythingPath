import type { useCharacterSheet } from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;

export type SelectionsView = NonNullable<Controller['sheet']>['selections'];
export type SelectionSlotView = SelectionsView['slots'][number];
export type SelectionRowView = SelectionsView['rows'][number];
export type SelectionCandidateView = SelectionsView['candidates'][number];
export type SelectionLevelView = SelectionsView['levels'][number];
export type SelectionControls = Controller['selections'];
export type SelectionPreview = NonNullable<
  ReturnType<SelectionControls['preview']>
>;
export type WarningController = Controller['warnings'];

/** The add control's name for a slot: a drawback, a trait or a feat. */
export function describeSlotNoun(slot: Pick<SelectionSlotView, 'id' | 'kind'>) {
  if (slot.id === 'trait:drawback') return 'drawback';
  return slot.kind;
}

/** The level a row records, when that Class Level still exists. */
export function findRecordedLevel(
  levels: readonly SelectionLevelView[],
  entryId: string | null,
) {
  return entryId === null
    ? undefined
    : levels.find((level) => level.entryId === entryId);
}
