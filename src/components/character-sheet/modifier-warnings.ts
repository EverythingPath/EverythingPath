import type { SheetWarningView } from './use-character-sheet';

/** The formula warnings aimed at one entry's Modifiers, in calculation order. */
export function listEntryModifierWarnings(
  warnings: SheetWarningView[],
  entryId: string,
) {
  return warnings.filter(
    (warning) =>
      warning.target.kind === 'modifier' && warning.target.entryId === entryId,
  );
}

/** Of an entry's Modifier warnings, those about the Modifier at `index`. */
export function listModifierWarnings(
  warnings: SheetWarningView[],
  index: number,
) {
  return warnings.filter(
    (warning) =>
      warning.target.kind === 'modifier' &&
      warning.target.modifierIndex === index,
  );
}
