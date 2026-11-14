'use client';
import { useRef, useState } from 'react';
import { useMaintenanceReasonId } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { InlineDeleteQuestion } from './inline-delete-question';
import type { ProficiencyRowView } from './proficiency-rows';
import { action, chip, SaveFeedback } from './sheet-parts';
import type { useCharacterSheet } from './use-character-sheet';
import { proficiencyLabel } from './use-character-sheet-equipment';

type Proficiencies = ReturnType<typeof useCharacterSheet>['proficiencies'];

const originChips = {
  grant: null,
  added: 'Manual addition',
  removed: 'Manual removal',
} as const;

// The row's one control: a grant can be removed by hand, a manual addition
// cleared (both asked first), a manual removal restored directly.
function RowControl({
  row,
  label,
  proficiencies,
}: {
  row: ProficiencyRowView;
  label: string;
  proficiencies: Proficiencies;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useMaintenanceReasonId(maintenance);
  const [isAsking, setIsAsking] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const isSaving = proficiencies.statusFor(row.statusKey).kind === 'saving';
  const isDisabled = isSaving || maintenance.readOnly;
  if (row.isRemoved) return null;
  if (row.origin === 'removed')
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={action}
        aria-describedby={reasonId}
        disabled={isDisabled}
        onClick={() =>
          void proficiencies.saveManualWithStatus(row.proficiency, 'none')
        }
      >
        Restore <span className="sr-only">proficiency {label}</span>
      </Button>
    );
  const isAddition = row.origin === 'added';
  const close = () => {
    setIsAsking(false);
    trigger.current?.focus();
  };
  return (
    <>
      <Button
        ref={trigger}
        type="button"
        size="sm"
        variant="ghost"
        className={cn(action, 'text-muted-foreground')}
        aria-pressed={isAsking}
        onClick={() => setIsAsking(!isAsking)}
      >
        {isAddition ? 'Clear' : 'Remove'}{' '}
        <span className="sr-only">
          {isAddition ? `manual change ${label}` : `proficiency ${label}`}
        </span>
      </Button>
      {isAsking ? (
        <InlineDeleteQuestion
          question={
            isAddition
              ? `Clear the manual addition of ${label}?`
              : `Remove ${label}? Its source stays on the sheet.`
          }
          subject={label}
          deleteLabel="Remove"
          isBusy={isSaving}
          className="order-last w-full"
          onDelete={() => {
            const disposition = isAddition ? 'none' : 'removed';
            void proficiencies
              .saveManualWithStatus(row.proficiency, disposition)
              .then((isSaved) => {
                if (isSaved) setIsAsking(false);
              });
          }}
          onKeep={close}
        />
      ) : null}
    </>
  );
}

/**
 * One Proficiency: what it covers with its source ("Heavy armor · Fighter")
 * or its manual origin, a grant removed by hand struck through, and its
 * one control with that control's own save beside it.
 */
export function ProficiencyRow({
  row,
  proficiencies,
}: {
  row: ProficiencyRowView;
  proficiencies: Proficiencies;
}) {
  const label = proficiencyLabel(row.proficiency);
  const originChip = originChips[row.origin];
  const isFamiliarity =
    'baseType' in row.proficiency && row.proficiency.asMartial === true;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
      <div className="min-w-0 flex-1 basis-48">
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
          <span
            className={cn(
              '[overflow-wrap:anywhere]',
              row.isRemoved && 'text-muted-foreground line-through',
            )}
          >
            {row.source ? `${label} · ${row.source}` : label}
          </span>
          {originChip ? (
            <span
              className={cn(
                chip,
                row.origin === 'removed' ? 'text-amber-300' : 'text-sky-300',
              )}
            >
              {originChip}
            </span>
          ) : null}
        </p>
        {row.isRemoved ? (
          <p className="text-muted-foreground text-xs">Removed by hand.</p>
        ) : null}
        {isFamiliarity ? (
          <p className="text-muted-foreground text-xs">
            Counts only with Martial weapons.
          </p>
        ) : null}
      </div>
      <RowControl row={row} label={label} proficiencies={proficiencies} />
      {row.isRemoved ? null : (
        <SaveFeedback
          status={proficiencies.statusFor(row.statusKey)}
          savedText="Saved"
          savingText="Saving…"
          shouldHideWhenIdle
        />
      )}
    </div>
  );
}
