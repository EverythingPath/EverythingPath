'use client';
import { SquarePen } from 'lucide-react';
import { useRef, useState } from 'react';
import { useMaintenanceReasonId } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { EquipmentEditor } from './equipment-editor';
import {
  describeArmorCategory,
  describeNonproficiency,
  listEquipmentFacts,
  listEquipmentWarnings,
} from './equipment-statistics';
import { InlineWarnings } from './inline-warning';
import { RowCatalogDefinition } from './row-catalog-definition';
import type { CatalogDefinition } from './sheet-catalog-context';
import { action, chip, SaveFeedback } from './sheet-parts';
import {
  SpellEffectTargetChips,
  type SpellEffectView,
} from './spell-effect-target-chips';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;
type Equipment = Controller['equipment'];
type Row = Equipment['rows'][number];

const mutedChip = cn(chip, 'text-muted-foreground');

/**
 * One armor or shield (approved variant B's gear rows): its name and
 * category, Equip or Unequip, and Edit, which opens its panel. While it
 * counts, its figures are the resolver's, with a penalty for wearing it
 * without the Proficiency stated as a number, and adamantine's damage
 * reduction as words. Off and dormant items stay listed with their recorded
 * figures. The row's own save reads beside it; other rows stay usable.
 */
export function EquipmentRow({
  row,
  equipment,
  catalogEntries,
  operationId,
  spellEffects = [],
  warnings,
  warningController,
}: {
  row: Row;
  equipment: Equipment;
  catalogEntries?: readonly CatalogDefinition[];
  operationId?: string | null;
  /** The sheet's Spell Effects; the row shows the ones targeting this item. */
  spellEffects?: readonly SpellEffectView[];
  /** The sheet's warnings; the row shows the ones about this item. */
  warnings: SheetWarningView[];
  warningController: Controller['warnings'];
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useMaintenanceReasonId(maintenance);
  const [isEditing, setIsEditing] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const status = equipment.statusFor(row.entryId);
  const isSaving = status.kind === 'saving';
  const isMuted = !row.active || !row.counting;
  const nonproficiency = describeNonproficiency(row.calculated);
  const materialNote = row.calculated?.materialNote ?? null;

  return (
    <div className="py-2">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1 basis-48">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h3
              className={cn(
                'font-sans text-base [overflow-wrap:anywhere]',
                isMuted && 'text-muted-foreground',
              )}
            >
              {row.name}
            </h3>
            <span className={cn(chip, isMuted && 'text-muted-foreground')}>
              {describeArmorCategory({
                slot: row.armor.slot,
                category: row.armor.category,
              })}
            </span>
            {row.active ? null : (
              <span className={mutedChip}>Not equipped</span>
            )}
            {row.dormant && !row.counting ? (
              <span className={mutedChip}>Not counting now</span>
            ) : null}
          </div>
          <p className="text-muted-foreground font-mono text-xs [overflow-wrap:anywhere]">
            {listEquipmentFacts(row).join(' · ')}
          </p>
          <SpellEffectTargetChips
            spellEffects={spellEffects}
            entryId={row.entryId}
            part="primary"
            className="mt-1"
          />
          {materialNote ? (
            <p className="text-muted-foreground text-xs">{materialNote}</p>
          ) : null}
          {row.dormant && !row.counting ? (
            <p className="text-muted-foreground text-xs">
              Its source no longer counts, so its figures stay out of the sheet
              until it does.
            </p>
          ) : null}
          {nonproficiency ? <p className="text-xs">{nonproficiency}</p> : null}
          <InlineWarnings
            warnings={listEquipmentWarnings(warnings, row.entryId)}
            controller={warningController}
            className="mt-1"
          />
          <RowCatalogDefinition rowId={row.entryId} />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={cn(action, 'min-w-24')}
            aria-describedby={reasonId}
            disabled={isSaving || maintenance.readOnly}
            onClick={() =>
              void equipment.saveActiveWithStatus(row.entryId, !row.active)
            }
          >
            {row.active ? 'Unequip' : 'Equip'}{' '}
            <span className="sr-only">{row.name}</span>
          </Button>
          <Button
            ref={editButton}
            type="button"
            variant={isEditing ? 'secondary' : 'ghost'}
            size="icon"
            className="size-11 md:size-8"
            aria-pressed={isEditing}
            onClick={() => setIsEditing(!isEditing)}
          >
            <SquarePen aria-hidden className="size-4" />
            <span className="sr-only">Edit {row.name}</span>
          </Button>
        </div>
        <SaveFeedback
          status={status}
          savedText="Saved"
          savingText="Saving…"
          shouldHideWhenIdle
        />
      </div>
      {isEditing ? (
        <EquipmentEditor
          key={row.entryId}
          row={row}
          equipment={equipment}
          catalogEntries={catalogEntries}
          operationId={operationId}
          warnings={warnings}
          warningController={warningController}
          onClose={() => setIsEditing(false)}
          restoreFocus={() => editButton.current?.focus()}
        />
      ) : null}
    </div>
  );
}
