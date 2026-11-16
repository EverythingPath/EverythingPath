'use client';
import { Check, SquarePen } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { useMaintenanceReasonId } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { oppositionSchoolChecks } from '~/lib/character-sheet-spellcasting-features';
import { RowCatalogDefinition } from './row-catalog-definition';
import type { GrantEntryView } from './character-sheet-grants-view-model';
import { listEquipmentWarnings } from './equipment-statistics';
import { BreakdownNotes } from './breakdown-notes';
import { EntryStateEditor } from './entry-state-editor';
import { InlineDeleteQuestion } from './inline-delete-question';
import { SelectionChecks } from './selection-checks';
import { entryFocusAttribute } from './sheet-catalog-context';
import { action, chip, SaveFeedback } from './sheet-parts';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;
type Actions = Controller['grants'];
type WarningProps = {
  warnings: SheetWarningView[];
  warningController: Controller['warnings'];
};
type OpenPanel = 'editor' | 'discard' | null;
/** Structured controls a block adds under a row's details, by row. */
export type RenderRowExtra = (row: GrantEntryView) => ReactNode;

const mutedChip = cn(chip, 'text-muted-foreground');

// A specialist's opposition schools are warned about where they are chosen:
// the editor under the Arcane School row and on the Spells page.
const oppositionChecks = new Set<string>(oppositionSchoolChecks);

/** The warnings aimed at this entry or at one of its Modifiers. */
export function listGrantEntryWarnings({
  warnings,
  rowId,
  isGear = false,
}: {
  warnings: SheetWarningView[];
  rowId: string;
  isGear?: boolean;
}) {
  const shownInEquipment = new Set(
    listEquipmentWarnings(isGear ? warnings : [], rowId),
  );
  return warnings.filter(
    (warning) =>
      (warning.target.kind === 'entry' || warning.target.kind === 'modifier') &&
      warning.target.entryId === rowId &&
      !shownInEquipment.has(warning) &&
      !oppositionChecks.has(warning.check),
  );
}

/** Kept, Off, Not counting now, Not tied to a level: the row's state in words. */
function StateChips({ row }: { row: GrantEntryView }) {
  return (
    <>
      {row.kept && row.dormant ? <span className={chip}>Kept</span> : null}
      {row.active ? null : <span className={mutedChip}>Off</span>}
      {row.status === 'dormant' ? (
        <span className={mutedChip}>Not counting now</span>
      ) : null}
      {row.unplaced ? (
        <span className={cn(chip, 'text-sky-300')}>Not tied to a level</span>
      ) : null}
    </>
  );
}

/** Where the entry comes from and what the table recorded on it. */
function RowDetails({ row }: { row: GrantEntryView }) {
  const recorded = [
    row.choice
      ? `${row.selection?.choiceLabel ?? 'Choice'}: ${row.choice}`
      : null,
    row.notes || null,
  ].filter((text) => text !== null);
  return (
    <>
      {row.sourceLabel ? (
        <p className="text-muted-foreground text-xs [overflow-wrap:anywhere]">
          {row.sourceLabel}
        </p>
      ) : null}
      {row.reason ? (
        <p className="text-muted-foreground text-xs [overflow-wrap:anywhere]">
          {row.reason}
        </p>
      ) : null}
      {recorded.length > 0 ? (
        <p className="text-xs [overflow-wrap:anywhere]">
          {recorded.join(' · ')}
        </p>
      ) : null}
    </>
  );
}

/**
 * One Grant or dormant Selection (approved variant B's list rows): its on/off
 * switch, name, source and state in words, its prerequisites now and at its
 * recorded level, a stored Selection's order within that level, then Keep or
 * Unkeep, Edit and Discard as the entry allows. Dormant rows are muted but their controls
 * stay readable. Replaced entries sit once beneath the row that replaced
 * them. A row's writes wait on its own save; other rows stay usable.
 */
export function GrantEntryRow({
  row,
  actions,
  warnings,
  warningController,
  registerRow,
  renderExtra,
  equipmentRowIds,
}: WarningProps & {
  row: GrantEntryView;
  actions: Actions;
  registerRow?: (rowId: string, element: HTMLDivElement | null) => void;
  renderExtra?: RenderRowExtra;
  /** Armor and shields, equipped in the Equipment block instead of here. */
  equipmentRowIds?: ReadonlySet<string>;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useMaintenanceReasonId(maintenance);
  const [open, setOpen] = useState<OpenPanel>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const discardButton = useRef<HTMLButtonElement>(null);
  const status = actions.statusFor(row.rowId);
  const isSaving = status.kind === 'saving';
  const isDisabled = isSaving || maintenance.readOnly;
  const isMuted = row.dormant && !row.counting;
  const isGear = equipmentRowIds?.has(row.rowId) === true;

  function closePanel() {
    const trigger = open === 'editor' ? editButton : discardButton;
    setOpen(null);
    (trigger.current ?? editButton.current)?.focus();
  }

  return (
    <div className="py-2" ref={(element) => registerRow?.(row.rowId, element)}>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
        {isGear ? (
          <span aria-hidden className="size-11 shrink-0 md:size-7" />
        ) : (
          <button
            type="button"
            role="switch"
            {...{ [entryFocusAttribute]: row.rowId }}
            aria-checked={row.active}
            aria-label={`${row.name}: ${row.active ? 'on' : 'off'}`}
            aria-describedby={reasonId}
            disabled={isDisabled}
            onClick={() => void actions.edit(row, { active: !row.active })}
            className={cn(
              'mt-0.5 inline-flex size-11 shrink-0 items-center justify-center border md:size-7',
              row.active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-foreground/40 hover:border-foreground text-transparent',
              'disabled:opacity-50',
            )}
          >
            <Check aria-hidden className="size-4" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h3
              className={cn(
                'font-sans text-base [overflow-wrap:anywhere]',
                isMuted && 'text-muted-foreground',
              )}
            >
              {row.name}
            </h3>
            <StateChips row={row} />
          </div>
          <RowDetails row={row} />
          <BreakdownNotes entryId={row.rowId} />
          {renderExtra?.(row)}
          {isGear ? (
            <p className="text-muted-foreground text-xs">
              Equipped and enhanced in Equipment.
            </p>
          ) : null}
          <SelectionChecks
            selection={row.selection}
            warnings={listGrantEntryWarnings({
              warnings,
              rowId: row.rowId,
              isGear,
            })}
            warningController={warningController}
            showsGroups={!isMuted}
            className="mt-1"
          />
          <RowCatalogDefinition
            rowId={row.rowId}
            target={actions.getCatalogDetachTarget(row.target)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {row.canKeep ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={action}
              aria-describedby={reasonId}
              disabled={isDisabled}
              onClick={() => void actions.setKept(row, !row.kept)}
            >
              {row.kept ? 'Unkeep' : 'Keep'}{' '}
              <span className="sr-only">{row.name}</span>
            </Button>
          ) : null}
          <Button
            ref={editButton}
            type="button"
            variant={open === 'editor' ? 'secondary' : 'ghost'}
            size="icon"
            className="size-11 md:size-8"
            aria-pressed={open === 'editor'}
            onClick={() => setOpen(open === 'editor' ? null : 'editor')}
          >
            <SquarePen aria-hidden className="size-4" />
            <span className="sr-only">Edit {row.name}</span>
          </Button>
          {row.canDiscard ? (
            <Button
              ref={discardButton}
              type="button"
              size="sm"
              variant="ghost"
              className={cn(action, 'text-muted-foreground')}
              aria-pressed={open === 'discard'}
              onClick={() => setOpen(open === 'discard' ? null : 'discard')}
            >
              Discard <span className="sr-only">{row.name}</span>
            </Button>
          ) : null}
        </div>
        <SaveFeedback
          status={status}
          savedText="Saved"
          savingText="Saving…"
          shouldHideWhenIdle
        />
      </div>
      {open === 'editor' ? (
        <EntryStateEditor
          subject={row.name}
          choiceLabel={row.selection?.choiceLabel}
          choice={row.choice}
          notes={row.notes}
          canEditChoice={row.canEditChoice}
          isSaving={isSaving}
          onSave={(state, changed) => {
            if (!changed.choice && !changed.notes) return Promise.resolve(true);
            return actions.edit(row, {
              ...(changed.choice ? { choice: state.choice } : {}),
              ...(changed.notes ? { notes: state.notes } : {}),
            });
          }}
          onClose={closePanel}
        />
      ) : null}
      {open === 'discard' ? (
        <InlineDeleteQuestion
          question={`Discard ${row.name}'s saved state?`}
          details="Its choices and notes will be lost."
          subject={row.name}
          deleteLabel="Discard saved state"
          keepLabel="Cancel"
          isBusy={isSaving}
          className="mt-2"
          onDelete={() => {
            void actions.discard(row).then((isDiscarded) => {
              if (isDiscarded) closePanel();
            });
          }}
          onKeep={closePanel}
        />
      ) : null}
      {row.replaced.length > 0 ? (
        <ul className="border-foreground/10 mt-1 ml-3 border-l-2 pl-3">
          {row.replaced.map((replaced) => (
            <li key={replaced.rowId} aria-label={replaced.name}>
              <GrantEntryRow
                row={replaced}
                actions={actions}
                warnings={warnings}
                warningController={warningController}
                registerRow={registerRow}
                renderExtra={renderExtra}
                equipmentRowIds={equipmentRowIds}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
