import type { SheetWarningView } from './use-character-sheet';

export type ClassLevelField = Extract<
  SheetWarningView['target'],
  { kind: 'classLevel' }
>['field'];

/** The row's warnings about one of its fields, in calculation order. */
export function listFieldWarnings(
  warnings: SheetWarningView[],
  field: ClassLevelField,
) {
  return warnings.filter(
    (warning) =>
      warning.target.kind === 'classLevel' && warning.target.field === field,
  );
}

/** Whether the sheet still needs this choice: the field wears the blue outline. */
export function isChoiceMissing(
  warnings: SheetWarningView[],
  field: ClassLevelField,
) {
  return listFieldWarnings(warnings, field).some(
    (warning) => warning.kind === 'incomplete',
  );
}
