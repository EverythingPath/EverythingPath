'use client';
import { useMaintenanceReasonId } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Checkbox } from '~/components/ui/checkbox';
import { cn } from '~/lib/utils';
import { ArchetypeApplication } from './archetype-application';
import {
  describeSources,
  isAppliedOption,
  type ArchetypeClassView,
  type ArchetypeGrantProps,
  type ArchetypeOptionView,
  type ArchetypesController,
  type FeatureNames,
} from './character-sheet-archetypes-view-model';
import { chip, SaveFeedback } from './sheet-parts';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;

// A playing-card choice: lifts on hover unless motion is reduced, marks
// itself when checked, and states its sources under its name.
const optionCard =
  'border-foreground/40 has-checked:border-primary has-focus-visible:ring-ring/50 flex min-h-11 cursor-pointer items-start gap-2 border px-2.5 py-1.5 text-sm transition-[transform,box-shadow] has-checked:shadow-xs has-focus-visible:ring-[3px] has-disabled:cursor-not-allowed has-disabled:opacity-50 motion-safe:hover:-translate-y-px motion-safe:hover:shadow-sm md:min-h-8';

/**
 * One Archetype for one class as a card. Checking it applies the Archetype
 * to every level of the class; unchecking deactivates it and keeps its
 * Selection. The card that carries the Selection opens into what it
 * changes. The card's save is acknowledged at its foot.
 */
export function ArchetypeCard({
  group,
  option,
  featureNames,
  grantProps,
  actions,
  warnings,
  warningController,
}: {
  group: ArchetypeClassView;
  option: ArchetypeOptionView;
  featureNames: FeatureNames;
  grantProps: ArchetypeGrantProps;
  actions: ArchetypesController;
  warnings: SheetWarningView[];
  warningController: Controller['warnings'];
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useMaintenanceReasonId(maintenance);
  const name = option.definition.name;
  const status = actions.statusFor(option.definition._id);
  const isDisabled =
    status.kind === 'saving' ||
    maintenance.readOnly ||
    option.unavailableReason !== null;
  const isApplied = isAppliedOption(option);
  const isRetained = isApplied && !option.selection.active;
  const sources = describeSources(option);
  return (
    <li
      aria-label={name}
      className={cn(
        'flex flex-col gap-1',
        isApplied && 'sm:col-span-2 lg:col-span-3',
      )}
    >
      <div
        className={cn(
          'flex flex-col gap-2',
          isApplied && 'border-foreground/20 border p-2',
        )}
      >
        <label
          className={cn(optionCard, isRetained && 'text-muted-foreground')}
        >
          <Checkbox
            className="mt-0.5"
            checked={option.selected}
            disabled={isDisabled}
            aria-label={`${name} for ${group.name}`}
            aria-describedby={reasonId}
            onCheckedChange={(isChecked) => {
              if (isDisabled) return;
              void actions.setSelected({
                classEntryId: group.classEntryId,
                catalogEntryId: option.definition._id,
                selected: isChecked,
              });
            }}
          />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="font-sans text-base [overflow-wrap:anywhere]">
                {name}
              </span>
              {isRetained ? (
                <span className={cn(chip, 'text-muted-foreground')}>
                  Not counting now
                </span>
              ) : null}
            </span>
            {option.unavailableReason ? (
              <span className="text-muted-foreground text-xs [overflow-wrap:anywhere]">
                {option.unavailableReason}
              </span>
            ) : null}
            {sources ? (
              <span className="text-muted-foreground text-xs [overflow-wrap:anywhere]">
                {sources}
              </span>
            ) : null}
          </span>
        </label>
        {isApplied ? (
          <ArchetypeApplication
            group={group}
            option={option}
            selection={option.selection}
            featureNames={featureNames}
            replacedRows={
              grantProps.grantRows.get(option.selection._id)?.replaced ?? []
            }
            rowProps={grantProps.rowProps}
            actions={actions}
            warnings={warnings}
            warningController={warningController}
          />
        ) : null}
      </div>
      <SaveFeedback
        status={status}
        savedText={
          option.selected ? `${name} selected.` : `${name} deactivated.`
        }
        savingText="Saving…"
        shouldHideWhenIdle
      />
    </li>
  );
}
