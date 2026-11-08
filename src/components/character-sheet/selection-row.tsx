'use client';
import { Check, SquarePen, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useMaintenanceReasonId } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { BreakdownNotes } from './breakdown-notes';
import { ChoiceSelect } from './choice-select';
import { InlineWarnings } from './inline-warning';
import { PrerequisiteGroups } from './prerequisite-groups';
import { PrerequisiteProse } from './prerequisite-status';
import { RowCatalogDefinition } from './row-catalog-definition';
import { entryFocusAttribute } from './sheet-catalog-context';
import { SelectionDescription } from './selection-description';
import { SelectionGuidance } from './selection-guidance';
import { SelectionChoiceGuidance } from './selection-choice-guidance';
import { SelectionOrderControls } from './selection-order-controls';
import { SelectionRowEditor } from './selection-row-editor';
import { action, chip, SaveFeedback } from './sheet-parts';
import {
  findRecordedLevel,
  type SelectionControls,
  type SelectionLevelView,
  type SelectionRowView,
  type WarningController,
} from './selection-view-types';

type StoredRow = SelectionRowView & {
  entryId: NonNullable<SelectionRowView['entryId']>;
};

const mutedChip = cn(chip, 'text-muted-foreground');

/**
 * One saved feat or trait in its slot (approved variant B's feat rows). The
 * first line holds its on/off switch, name and state, the level gained for a
 * feat, and Remove; the description sits below it, then the choice and
 * notes, guidance, its untargeted Situational Notes, and the prerequisites
 * now and at the recorded level, each group with its own warnings and Accept. Its order among the level's
 * Selections, Edit and Replace follow on their own line. Replace reopens the
 * slot's picker; Remove clears the slot. The row waits only on its own save.
 */
export function SelectionRow({
  row,
  levels,
  controls,
  warningController,
  onReplace,
  onRemoved,
}: {
  row: StoredRow;
  levels: SelectionLevelView[];
  controls: SelectionControls;
  warningController: WarningController;
  /** Reopens the slot's picker; a row outside a slot has none. */
  onReplace?: (opener: HTMLElement) => void;
  onRemoved?: () => void;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useMaintenanceReasonId(maintenance);
  const [isEditing, setIsEditing] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const entryStatus = controls.statusForEntry(row.entryId);
  const status =
    entryStatus.kind === 'idle' && row.slot
      ? controls.statusForSlot(row.slot.id, row.slot.position)
      : entryStatus;
  const isSaving = entryStatus.kind === 'saving';
  const isDisabled = isSaving || maintenance.readOnly;
  const level = findRecordedLevel(levels, row.gainedAtClassLevel);
  const isUnplaced = row.gainedAtClassLevel !== null && !level;
  const recorded = [
    row.choice ? `${row.choiceLabel}: ${row.choice}` : null,
    row.notes || null,
  ].filter((text) => text !== null);

  function closeEditor() {
    setIsEditing(false);
    editButton.current?.focus();
  }

  return (
    <li aria-label={row.name} className="py-2">
      <div className="flex items-start gap-x-3">
        <button
          type="button"
          role="switch"
          {...{ [entryFocusAttribute]: row.rowId }}
          aria-checked={row.active}
          aria-label={`${row.name}: ${row.active ? 'on' : 'off'}`}
          aria-describedby={reasonId}
          disabled={isDisabled}
          onClick={() =>
            void controls.edit(row.entryId, { active: !row.active })
          }
          className={cn(
            'inline-flex size-11 shrink-0 items-center justify-center border md:mt-0.5 md:size-7',
            row.active
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-foreground/40 hover:border-foreground text-transparent',
            'disabled:opacity-50',
          )}
        >
          <Check aria-hidden className="size-4" />
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {/* Name left, level gained and Remove right; the name wraps. */}
          <div className="flex items-start gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1 md:py-0.5">
              <h4
                className={cn(
                  'font-sans text-base leading-tight [overflow-wrap:anywhere]',
                  !row.active && 'text-muted-foreground',
                )}
              >
                {row.name}
              </h4>
              {row.active ? null : <span className={mutedChip}>Off</span>}
              {isUnplaced ? (
                <span className={cn(chip, 'text-sky-300')}>
                  Not tied to a level
                </span>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {row.kind === 'feat' ? (
                <ChoiceSelect
                  label="Level gained"
                  value={level?.entryId ?? ''}
                  emptyLabel="No level"
                  options={levels.map((option) => ({
                    value: option.entryId,
                    label: option.label,
                  }))}
                  disabled={isDisabled}
                  className="h-11 w-28 text-xs md:h-8 md:w-32"
                  onValueChange={(value) =>
                    void controls.edit(row.entryId, {
                      gainedAtClassLevel:
                        findRecordedLevel(levels, value || null)?.entryId ??
                        null,
                    })
                  }
                />
              ) : null}
              {row.canRemove ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive size-11 md:size-8"
                  aria-describedby={reasonId}
                  disabled={isDisabled}
                  onClick={() => {
                    void controls.remove(row.entryId).then((isRemoved) => {
                      if (isRemoved) onRemoved?.();
                    });
                  }}
                >
                  <X aria-hidden className="size-4" />
                  <span className="sr-only">Remove {row.name}</span>
                </Button>
              ) : null}
            </div>
          </div>
          <RowCatalogDefinition rowId={row.rowId} />
          <SelectionDescription text={row.description} />
          {recorded.length > 0 ? (
            <p className="text-xs [overflow-wrap:anywhere]">
              {recorded.join(' · ')}
            </p>
          ) : null}
          <SelectionChoiceGuidance row={row} />
          <SelectionGuidance text={row.guidanceText} />
          <BreakdownNotes entryId={row.entryId} />
          <PrerequisiteProse text={row.prerequisiteText} />
          <PrerequisiteGroups
            groups={row}
            warningController={warningController}
          />
          <InlineWarnings
            warnings={row.otherWarnings}
            controller={warningController}
            isNamedByMessage
          />
          <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
            <SelectionOrderControls
              row={row}
              levels={levels}
              controls={controls}
              showsFeedback={false}
              className="mr-1"
            />
            <Button
              ref={editButton}
              type="button"
              variant={isEditing ? 'secondary' : 'ghost'}
              size="sm"
              className={cn(action, 'px-2 text-xs')}
              aria-pressed={isEditing}
              onClick={() => setIsEditing(!isEditing)}
            >
              <SquarePen aria-hidden className="size-3.5" />
              Edit <span className="sr-only">{row.name}</span>
            </Button>
            {onReplace ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={cn(action, 'px-2 text-xs')}
                aria-describedby={reasonId}
                disabled={isDisabled}
                onClick={(event) => onReplace(event.currentTarget)}
              >
                Replace <span className="sr-only">{row.name}</span>
              </Button>
            ) : null}
            <SaveFeedback
              status={status}
              savedText="Saved"
              savingText="Saving…"
              shouldHideWhenIdle
            />
          </div>
        </div>
      </div>
      {isEditing ? (
        <SelectionRowEditor
          row={row}
          controls={controls}
          onClose={closeEditor}
        />
      ) : null}
    </li>
  );
}
