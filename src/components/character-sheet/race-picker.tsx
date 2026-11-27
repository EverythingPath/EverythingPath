'use client';
import type { Id } from '@convex/_generated/dataModel';
import { useId } from 'react';
import { useMaintenanceReasonId } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import { cn } from '~/lib/utils';
import type { RaceOptionView } from './character-sheet-races-view-model';
import { RowCatalogDefinition } from './row-catalog-definition';
import { fieldLabel, SaveFeedback } from './sheet-parts';
import type { useCharacterSheet } from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;
type RacialFacts = NonNullable<Controller['sheet']>['calculated']['racial'];

// The empty choice is a card like the others: a radio cannot carry null.
const noRace = 'none';

// A playing-card choice (approved prototype): lifts on hover unless motion is
// reduced, marks itself when checked, and shows its facts under its name.
const raceCard =
  'flex-col items-start justify-start gap-0.5 px-2.5 py-1.5 text-left transition-[transform,box-shadow] motion-safe:hover:-translate-y-px motion-safe:hover:shadow-sm';

function describeRace(option: RaceOptionView) {
  return [option.size, ...option.creatureTypes]
    .filter((fact) => fact !== null && fact !== '')
    .join(' · ');
}

/** The fixed facts the selected race states, read-only: size, type, subtypes. */
function RaceFacts({ racial }: { racial: RacialFacts }) {
  if (!racial.raceEntryId) return null;
  const subtypes = racial.creatureSubtypes.length
    ? ` (${racial.creatureSubtypes.join(', ')})`
    : '';
  const types = racial.creatureTypes.length
    ? `${racial.creatureTypes.join(', ')}${subtypes}`
    : null;
  const facts = [racial.size, types]
    .filter((fact) => fact !== null)
    .join(' · ');
  if (!facts) return null;
  return (
    <p className="text-muted-foreground text-xs">
      <span className="sr-only">Size and type: </span>
      {facts}
    </p>
  );
}

/**
 * The race, chosen among playing cards (approved prototype's Race field):
 * one card per race in the catalog and a neutral "No race" card, so the
 * choice can be cleared. Nothing marks an unchosen race as missing. The
 * cards wait on their own save and acknowledge it beneath them.
 */
export function RacePicker({
  options,
  selectedRaceId,
  racial,
  actions,
}: {
  options: RaceOptionView[];
  selectedRaceId: Id<'catalogEntry'> | null;
  racial: RacialFacts;
  actions: Controller['races'];
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useMaintenanceReasonId(maintenance);
  const labelId = useId();
  const status = actions.statusFor('race');
  const isDisabled = status.kind === 'saving' || maintenance.readOnly;
  return (
    <div className="flex flex-col gap-1">
      <p id={labelId} className={fieldLabel}>
        Race
      </p>
      {options.length === 0 ? (
        <p className="text-muted-foreground text-sm">No races available.</p>
      ) : (
        <RadioGroup
          aria-labelledby={labelId}
          aria-describedby={reasonId}
          name="race"
          value={selectedRaceId ?? noRace}
          disabled={isDisabled}
          className="grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
          onValueChange={(value) => {
            if (
              isDisabled ||
              options.some(
                (option) =>
                  option.catalogEntryId === value &&
                  option.unavailableReason !== null,
              )
            )
              return;
            void actions.selectRace(
              // Safe cast: every option value other than noRace is a catalog
              // entry id.
              value === noRace ? null : (value as Id<'catalogEntry'>),
            );
          }}
        >
          <RadioGroupItem
            value={noRace}
            className={cn(raceCard, 'text-muted-foreground')}
          >
            No race
          </RadioGroupItem>
          {options.map((option) => (
            <RadioGroupItem
              key={option.catalogEntryId}
              value={option.catalogEntryId}
              disabled={isDisabled || option.unavailableReason !== null}
              className={cn(
                raceCard,
                option.unavailableReason !== null &&
                  'cursor-not-allowed opacity-60',
              )}
            >
              <span className="font-sans text-base [overflow-wrap:anywhere]">
                {option.name}
              </span>
              <span className="text-muted-foreground text-xs">
                {option.unavailableReason ?? (describeRace(option) || ' ')}
              </span>
            </RadioGroupItem>
          ))}
        </RadioGroup>
      )}
      <RaceFacts racial={racial} />
      {racial.raceEntryId ? (
        <RowCatalogDefinition rowId={racial.raceEntryId} />
      ) : null}
      <SaveFeedback
        status={status}
        savedText="Race saved."
        savingText="Saving race…"
      />
    </div>
  );
}
