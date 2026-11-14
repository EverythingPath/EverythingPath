'use client';
import { useId } from 'react';
import {
  MaintenanceReason,
  MaintenanceReasonScope,
} from '~/components/campaign-shell/maintenance-reason';
import { useBreakpoint } from '~/components/use-breakpoint';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';
import { cn } from '~/lib/utils';
import { EquipmentPartSection } from './equipment-part-section';
import type { CatalogDefinition } from './sheet-catalog-context';
import { action } from './sheet-parts';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;
type Equipment = Controller['equipment'];
type Row = Equipment['rows'][number];

const hint = 'text-muted-foreground text-xs';

/**
 * One Gear item's own state (#306, #408), in the routine panel's form: a
 * panel on the right from 768px, a bottom sheet below. One section per
 * part (the armor or shield, and a shield's bash), equipped or not, each
 * with its enhancement, masterwork, material and Item Abilities saved at
 * once, field by field, and its construction warnings beneath. A specific
 * magic item names the Base Item it is built on and states its own material
 * as a fact. Closing discards nothing. Keyed by the Gear row.
 */
export function EquipmentEditor({
  row,
  equipment,
  catalogEntries = [],
  operationId,
  warnings,
  warningController,
  onClose,
  restoreFocus,
}: {
  row: Row;
  equipment: Equipment;
  /** The definitions the Item Ability picker offers from, and Base Items. */
  catalogEntries?: readonly CatalogDefinition[];
  /** The sheet's last operation, to tell this player's echo from others' edits. */
  operationId?: string | null;
  warnings: SheetWarningView[];
  warningController: Controller['warnings'];
  onClose: () => void;
  /** Where focus goes once the panel has closed. */
  restoreFocus?: () => void;
}) {
  const isWide = useBreakpoint('wide');
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useId();
  const isReadOnly = maintenance.readOnly;
  const describedBy = isReadOnly ? reasonId : undefined;
  const item = row.itemParts;
  const baseItem = item?.baseItemId
    ? catalogEntries.find((entry) => entry._id === item.baseItemId)
    : undefined;
  const materialNote = row.calculated?.materialNote ?? null;

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side={isWide ? 'right' : 'bottom'}
        aria-describedby={undefined}
        onCloseAutoFocus={(event) => {
          if (!restoreFocus) return;
          event.preventDefault();
          restoreFocus();
        }}
        className={cn(
          'gap-0',
          isWide
            ? 'w-full sm:max-w-md'
            : 'max-h-[85vh] pb-[env(safe-area-inset-bottom)]',
        )}
      >
        <SheetHeader className="pr-12">
          <SheetTitle className="font-sans text-xl font-normal">
            {row.name}
          </SheetTitle>
          {baseItem ? <p className={hint}>Based on {baseItem.name}</p> : null}
          {materialNote ? <p className={hint}>{materialNote}</p> : null}
        </SheetHeader>
        <MaintenanceReasonScope id={reasonId}>
          <form
            noValidate
            aria-label={`Edit ${row.name}`}
            className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4"
            onSubmit={(event) => event.preventDefault()}
          >
            {item?.parts.map((part) => (
              <EquipmentPartSection
                key={part.part}
                entryId={row.entryId}
                part={part}
                bakedMaterial={item.bakedMaterial}
                equipment={equipment}
                catalogEntries={catalogEntries}
                operationId={operationId}
                isReadOnly={isReadOnly}
                describedBy={describedBy}
                warnings={warnings}
                warningController={warningController}
              />
            ))}
            <MaintenanceReason
              id={reasonId}
              notice={maintenance}
              className="text-xs"
            />
            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                className={cn(action, 'rounded-none font-sans')}
                onClick={onClose}
              >
                Done
              </Button>
            </div>
          </form>
        </MaintenanceReasonScope>
      </SheetContent>
    </Sheet>
  );
}
