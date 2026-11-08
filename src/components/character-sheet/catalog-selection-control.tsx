'use client';
import { Plus } from 'lucide-react';
import { useId, useState } from 'react';
import { useMaintenanceReasonId } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import { isCatalogSheetEntry } from '~/lib/character-sheet-entries';
import { CatalogChoiceForm } from './catalog-choice-form';
import type { CatalogDefinition, SheetCatalog } from './sheet-catalog-context';
import { action, SaveFeedback } from './sheet-parts';

/**
 * Add to sheet for a selectable catalog definition, as it is: no copy is
 * made. A feat, trait or other choice-bearing kind first asks for its
 * recorded choice; Spell Effects, conditions, items and Spells add at once.
 * Saving and the result stay beside the action; a refusal keeps the choice
 * for a retry, and the new row takes focus once the live read shows it.
 */
export function CatalogSelectionControl({
  definition,
  catalog,
}: {
  definition: CatalogDefinition;
  catalog: SheetCatalog;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useMaintenanceReasonId(maintenance);
  const panelId = useId();
  const [isChoosing, setIsChoosing] = useState(false);
  if (!catalog.capabilitiesFor(definition._id).canSelect) return null;
  const status = catalog.statusFor(catalog.selectionKey(definition._id));
  const isDisabled =
    !catalog.available || maintenance.readOnly || status.kind === 'saving';
  const hasChoice = !isCatalogSheetEntry({ kind: definition.detail.kind });
  const select = (choice?: string) =>
    catalog.select({
      catalogEntryId: definition._id,
      ...(choice ? { choice } : {}),
    });
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
      <Button
        type="button"
        size="sm"
        variant={isChoosing ? 'secondary' : 'outline'}
        className={action}
        aria-expanded={hasChoice ? isChoosing : undefined}
        aria-controls={hasChoice ? panelId : undefined}
        aria-describedby={reasonId}
        disabled={isDisabled}
        onClick={() => {
          if (hasChoice) setIsChoosing(!isChoosing);
          else void select();
        }}
      >
        <Plus aria-hidden className="size-4" />
        Add to sheet <span className="sr-only">{definition.name}</span>
      </Button>
      <SaveFeedback
        status={status}
        savedText="Saved"
        savingText="Saving…"
        shouldHideWhenIdle
      />
      {hasChoice ? (
        <div id={panelId} className="w-full">
          {isChoosing ? (
            <CatalogChoiceForm
              name={definition.name}
              isDisabled={isDisabled}
              onSubmit={(choice) =>
                void select(choice).then((isAdded) => {
                  if (isAdded) setIsChoosing(false);
                })
              }
              onCancel={() => setIsChoosing(false)}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
