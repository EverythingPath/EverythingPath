import type { Situation, SourcedSituationalNote } from '~/lib/character-sheet';
import { isOwnStateSituation } from '~/lib/character-sheet-situations';
import { describeSituation } from './modifier-labels';
import {
  describeContributionScope,
  describePrerequisite,
  type SituationGroup,
} from './stat-breakdown-groups';
import type { useSituationSelection } from './use-situation-selection';

export function describeSituationOption(
  option: string,
  findPrerequisiteName: (catalogEntryId: string) => string | null,
) {
  return `when using ${findPrerequisiteName(option) ?? 'a chosen option'}`;
}

/**
 * A Situation choice in words. An entry's own circumstance names its entry
 * ("First: in darkness"), so equally worded ones stay apart; a chosen
 * option reads by its name and never by its reference.
 */
export function describeSituationChoice(
  group: Pick<SituationGroup, 'text' | 'selection' | 'entryName'>,
  findPrerequisiteName: (catalogEntryId: string) => string | null,
) {
  const { selection } = group;
  if (typeof selection === 'string') return group.text;
  if ('option' in selection)
    return describeSituationOption(selection.option, findPrerequisiteName);
  return group.entryName ? `${group.entryName}: ${group.text}` : group.text;
}

/**
 * The picked Situations as the sheet's breakdowns read them: what to
 * resolve, in picking order, and the choices in words ("vs. spells +
 * First: in darkness").
 */
export function buildSelectedSituations({
  groups,
  selection,
  findPrerequisiteName,
}: {
  groups: readonly SituationGroup[];
  selection: Pick<
    ReturnType<typeof useSituationSelection>,
    'selections' | 'selectedKeys'
  >;
  findPrerequisiteName: (catalogEntryId: string) => string | null;
}) {
  return {
    selections: selection.selections,
    selectedKeys: selection.selectedKeys,
    text: selection.selectedKeys
      .flatMap((key) => groups.filter((group) => group.key === key))
      .map((group) => describeSituationChoice(group, findPrerequisiteName))
      .join(' + '),
  };
}

// "vs. fear" reads on its own; an entry's own words read "only when …".
function describeNoteSituation(
  situation: Situation,
  findPrerequisiteName: (catalogEntryId: string) => string | null,
) {
  if (typeof situation === 'string') return describeSituation(situation);
  if ('option' in situation)
    return `only ${describeSituationOption(situation.option, findPrerequisiteName)}`;
  return `only when ${situation.local}`;
}

type NoteCondition = Pick<
  SourcedSituationalNote,
  'condition' | 'entryName' | 'situation' | 'waiting'
>;

/**
 * When a Situational Note holds, in words: its Situation (where no heading
 * already says so), the weapon, routine or casting it is confined to, and
 * the entry it still waits on. Null for a rule that always holds.
 */
export function describeNoteCondition(
  note: NoteCondition,
  {
    findPrerequisiteName,
    findCastingClassName,
    hasSituation = true,
  }: {
    findPrerequisiteName: (catalogEntryId: string) => string | null;
    findCastingClassName: (classTag: string) => string | null;
    hasSituation?: boolean;
  },
) {
  const situation = note.situation ?? note.condition?.situation;
  // A condition's own rules hold while it does ("Blinded" on Blinded).
  const isOwnState = isOwnStateSituation(situation, note.entryName);
  const parts = [
    hasSituation && situation !== undefined && !isOwnState
      ? describeNoteSituation(situation, findPrerequisiteName)
      : null,
    describeContributionScope(note, findCastingClassName),
    note.waiting && note.condition?.whileActive
      ? describePrerequisite(note, findPrerequisiteName, findCastingClassName)
      : null,
  ].filter((part) => part !== null);
  return parts.length > 0 ? parts.join('; ') : null;
}
