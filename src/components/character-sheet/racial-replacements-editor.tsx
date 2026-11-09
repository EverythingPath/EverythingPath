'use client';
import type { Id } from '@convex/_generated/dataModel';
import { useId, useState } from 'react';
import { useMaintenanceReasonId } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import { Checkbox } from '~/components/ui/checkbox';
import { cn } from '~/lib/utils';
import type {
  CharacterSheetRacesView,
  RacialTraitOptionView,
} from './character-sheet-races-view-model';
import { action, SaveFeedback } from './sheet-parts';
import type { useCharacterSheet } from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;

const standardCard =
  'border-foreground/40 has-checked:border-primary has-checked:text-primary has-focus-visible:ring-ring/50 flex min-h-11 cursor-pointer items-center gap-2 border px-2.5 font-mono text-sm has-checked:shadow-xs has-focus-visible:ring-[3px] has-disabled:cursor-not-allowed has-disabled:opacity-50 md:min-h-8';

/**
 * The replaced standards of an alternate whose definition only names them
 * (approved prototype's choice list): the catalog's names stay as the
 * context, the sheet's standards are the cards, Save sends exactly the
 * checked ones (none is a deliberate choice), and Reset returns to the
 * definition. Errors from the save stay beside these controls.
 */
export function RacialReplacementsEditor({
  option,
  entryId,
  standardOptions,
  actions,
}: {
  option: RacialTraitOptionView;
  entryId: Id<'characterSheetEntry'>;
  standardOptions: CharacterSheetRacesView['standardOptions'];
  actions: Controller['races'];
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useMaintenanceReasonId(maintenance);
  const headingId = useId();
  // A save from anywhere, or a reset to the definition, replaces unsaved
  // picks while focus stays where it is.
  const savedReplacements = `${option.hasManualReplacements}:${option.replacementIds.join(',')}`;
  const [chosenFrom, setChosenFrom] = useState(savedReplacements);
  const [chosen, setChosen] = useState(
    () => new Set<string>(option.replacementIds),
  );
  if (chosenFrom !== savedReplacements) {
    setChosenFrom(savedReplacements);
    setChosen(new Set(option.replacementIds));
  }
  const status = actions.statusFor(entryId);
  const isSaving = status.kind === 'saving';
  const isDisabled = isSaving || maintenance.readOnly;

  function toggle(catalogEntryId: string, isChecked: boolean) {
    setChosen((current) => {
      const next = new Set(current);
      if (isChecked) next.add(catalogEntryId);
      else next.delete(catalogEntryId);
      return next;
    });
  }

  return (
    <div
      role="group"
      aria-labelledby={headingId}
      className="border-foreground/20 mt-1 flex flex-col gap-1.5 border p-2"
    >
      <p
        id={headingId}
        className="text-xs [overflow-wrap:anywhere] text-sky-300"
      >
        Choose replaced traits
        {option.unresolvedReplacements.length > 0
          ? `: ${option.unresolvedReplacements.join(', ')}`
          : null}
      </p>
      {standardOptions.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          This race has no standard traits to replace.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {standardOptions.map((standard) => (
            <label key={standard.catalogEntryId} className={standardCard}>
              <Checkbox
                checked={chosen.has(standard.catalogEntryId)}
                disabled={isDisabled}
                aria-label={`${option.name} replaces ${standard.name}`}
                onCheckedChange={(isChecked) =>
                  toggle(standard.catalogEntryId, isChecked)
                }
              />
              {standard.name}
            </label>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={action}
          aria-describedby={reasonId}
          disabled={isDisabled}
          onClick={() => {
            if (isDisabled) return;
            void actions.setReplacements(
              entryId,
              standardOptions
                .map((standard) => standard.catalogEntryId)
                .filter((id) => chosen.has(id)),
            );
          }}
        >
          {isSaving ? 'Saving…' : 'Save replaced traits'}
          <span className="sr-only"> for {option.name}</span>
        </Button>
        {option.hasManualReplacements ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={cn(action, 'text-muted-foreground')}
            aria-describedby={reasonId}
            disabled={isDisabled}
            onClick={() => {
              if (isDisabled) return;
              void actions.setReplacements(entryId, null);
            }}
          >
            Reset to definition
            <span className="sr-only"> for {option.name}</span>
          </Button>
        ) : null}
        <SaveFeedback status={status} savedText="Replaced traits saved." />
      </div>
    </div>
  );
}
