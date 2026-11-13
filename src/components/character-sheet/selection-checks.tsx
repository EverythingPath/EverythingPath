'use client';
import type { CharacterSheetSelectionRow } from './character-sheet-selections-view-model';
import { InlineWarnings } from './inline-warning';
import {
  listUngroupedWarnings,
  PrerequisiteGroups,
} from './prerequisite-groups';
import { SelectionOrderControls } from './selection-order-controls';
import { useSelectionOrder } from './selection-order-context';
import type { WarningController } from './selection-view-types';
import type { SheetWarningView } from './use-character-sheet';

/**
 * A Selection's rules under a row of another block (class features, racial
 * traits, Archetypes, personal adjustments, sheet entries): its prerequisites
 * now and at its recorded level, the row's other warnings once, then its
 * order within that level. A row without a Selection lists its warnings as
 * before. Dormant rows that count for nothing pass `showsGroups` off: they
 * raise no checks, though their recorded order stays editable.
 */
export function SelectionChecks({
  selection,
  warnings,
  warningController,
  showsGroups = true,
  className,
}: {
  selection: CharacterSheetSelectionRow | undefined;
  /** Every warning the row shows; prerequisite ones move into their group. */
  warnings: SheetWarningView[];
  warningController: WarningController;
  showsGroups?: boolean;
  className?: string;
}) {
  const order = useSelectionOrder();
  return (
    <>
      {selection && showsGroups ? (
        <PrerequisiteGroups
          groups={selection}
          warningController={warningController}
          className="mt-1"
        />
      ) : null}
      <InlineWarnings
        warnings={listUngroupedWarnings(warnings, selection)}
        controller={warningController}
        className={className}
      />
      {selection && order ? (
        <SelectionOrderControls
          row={selection}
          levels={order.view.levels}
          controls={order.controls}
          className="mt-1"
        />
      ) : null}
    </>
  );
}
