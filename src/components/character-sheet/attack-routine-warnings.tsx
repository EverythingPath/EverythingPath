'use client';
import type { SheetWarning } from '~/lib/character-sheet';
import { listAttackRoutineWarnings } from './attack-routine-view-model';
import { AttackWarningParagraph } from './attack-warning-paragraph';
import { InlineWarnings } from './inline-warning';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;

/**
 * A routine's own advisories beside the field they are about, with the
 * sheet's Accept when the editor has the sheet's warnings; plain amber
 * paragraphs otherwise. Nothing when there are none.
 */
export function AttackRoutineWarnings({
  warnings,
  sheetWarnings,
  controller,
  className,
}: {
  warnings: readonly SheetWarning[];
  /** The sheet's warnings and Accept, when the editor has them. */
  sheetWarnings?: SheetWarningView[];
  controller?: Controller['warnings'];
  className?: string;
}) {
  if (warnings.length === 0) return null;
  if (controller)
    return (
      <InlineWarnings
        warnings={listAttackRoutineWarnings(sheetWarnings ?? [], { warnings })}
        controller={controller}
        className={className}
      />
    );
  return (
    <div className={className}>
      {warnings.map((warning) => (
        <AttackWarningParagraph
          key={`${warning.check}:${warning.subject}`}
          warning={warning}
        />
      ))}
    </div>
  );
}
