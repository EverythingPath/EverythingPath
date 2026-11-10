'use client';
import { X } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { findFamilyName } from './class-level-row';
import { ClassSwitchPreview } from './class-switch-preview';
import { focusInlineWarning } from './inline-warning';
import { useRevealEntryRow } from './reveal-entry-row';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;
type Classes = Controller['classes'];
type ReadySheet = NonNullable<Controller['sheet']>;
type SwitchResult = NonNullable<Classes['definitionSwitchResult']>;

/** The new definition by name and where it lives, as the chooser named it. */
function resultVersionName(classes: Classes, result: SwitchResult) {
  const choice = classes
    .rulesChoicesFor(result.entryId)
    .find((candidate) => candidate.classEntryId === result.classEntryId);
  if (choice) return choice.label;
  return (
    classes.choices.find(
      (candidate) => candidate.classEntryId === result.classEntryId,
    )?.name ?? 'another version'
  );
}

/**
 * This device's saved class version switch (#583), once under the Class
 * Levels heading: which version the class now uses, what changed, what
 * stopped counting and what became of accepted warnings. Each dormant
 * entry leads to its row under "Not counting now"; each reopened warning
 * leads to its Accept. Dismiss, or any later change, removes it.
 */
export function ClassDefinitionSwitchNotice({
  result,
  rows,
  classes,
  warnings,
  onDismiss,
}: {
  result: SwitchResult;
  rows: ReadySheet['levels'];
  classes: Classes;
  warnings: readonly SheetWarningView[];
  onDismiss: () => void;
}) {
  const revealEntryRow = useRevealEntryRow();
  const row = rows.find((level) => level._id === result.entryId);
  if (!row) return null;
  const fallbackName =
    classes.choices.find(
      (choice) => choice.classEntryId === row.state.classEntryId,
    )?.name ?? 'The class';
  const className = findFamilyName(classes, row, fallbackName);
  return (
    <div
      role="status"
      className="flex w-full min-w-0 flex-col gap-2 border border-sky-400/40 p-2 text-xs"
    >
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sky-300">
        <span>
          {className} now uses {resultVersionName(classes, result)}.
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-1.5 text-xs md:h-6"
          onClick={onDismiss}
        >
          <X aria-hidden className="size-3.5" />
          Dismiss <span className="sr-only">class version result</span>
        </Button>
      </p>
      <ClassSwitchPreview
        description={result}
        className={className}
        warnings={warnings}
        showKept={false}
        onRevealEntry={(change) => revealEntryRow(change.id)}
        onRevealWarning={(key) => void focusInlineWarning(key)}
      />
    </div>
  );
}
