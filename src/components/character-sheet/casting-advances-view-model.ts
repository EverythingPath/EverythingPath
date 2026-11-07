import type { CastingAdvanceKind } from '~/lib/character-sheet-casting-tables';
import { buildSheetWarningViews } from './character-sheet-warning-view-model';
import type {
  CharacterSheetSnapshot,
  SheetWarningView,
} from './use-character-sheet';

type AdvanceSnapshot = Pick<
  CharacterSheetSnapshot,
  'calculated' | 'catalogEntries' | 'acceptedWarnings'
>;

export type CastingAdvanceOption = {
  classEntryId: string;
  name: string;
  /** Present before the Prestige Class and of the advance's kind. */
  eligible: boolean;
};

export type CastingAdvanceChoice = {
  entryId: string;
  index: number;
  kind: CastingAdvanceKind;
  label: string;
  prestigeName: string;
  value: string | null;
  prefilled: boolean;
  missing: boolean;
  options: CastingAdvanceOption[];
  warnings: SheetWarningView[];
};

const kindLabels: Record<CastingAdvanceKind, string> = {
  any: 'Spellcasting advance',
  arcane: 'Arcane advance',
  divine: 'Divine advance',
};

/**
 * The advance choices of one Prestige Class Level. Only classes the Character
 * had before entry are offered; a recorded ineligible class stays visible.
 */
export function buildCastingAdvanceChoices(
  snapshot: AdvanceSnapshot,
  entryId: string,
): CastingAdvanceChoice[] {
  const findClassName = (classEntryId: string) =>
    snapshot.catalogEntries.find((entry) => entry._id === classEntryId)?.name ??
    'Unavailable class';
  return snapshot.calculated.castingAdvances
    .filter((advance) => advance.entryId === entryId)
    .map((advance) => {
      const subject = `${advance.entryId}:castingAdvances:${advance.index}`;
      const options: CastingAdvanceOption[] = advance.eligibleClassEntryIds.map(
        (classEntryId) => ({
          classEntryId,
          name: findClassName(classEntryId),
          eligible: true,
        }),
      );
      if (
        advance.targetClassEntryId &&
        !advance.eligibleClassEntryIds.includes(advance.targetClassEntryId)
      )
        options.push({
          classEntryId: advance.targetClassEntryId,
          name: findClassName(advance.targetClassEntryId),
          eligible: false,
        });
      return {
        entryId: advance.entryId,
        index: advance.index,
        kind: advance.kind,
        label: kindLabels[advance.kind],
        prestigeName: advance.prestigeName,
        value: advance.targetClassEntryId,
        prefilled: advance.prefilled,
        missing: advance.targetClassEntryId === null,
        options,
        warnings: buildSheetWarningViews(
          snapshot.calculated.warnings.filter(
            (warning) => warning.subject === subject,
          ),
          snapshot.acceptedWarnings,
        ),
      };
    });
}
