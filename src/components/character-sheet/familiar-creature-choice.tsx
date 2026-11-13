'use client';
import { useId } from 'react';
import { useMaintenanceReasonId } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import type { CreatureSize } from '~/lib/character-sheet';
import { action, chip, fieldLabel, SaveFeedback } from './sheet-parts';
import type { useCharacterSheet } from './use-character-sheet';

type FamiliarController = ReturnType<typeof useCharacterSheet>['familiar'];
type FamiliarView = NonNullable<FamiliarController['view']>;

// A playing card (the product's card choices): lifts on hover unless motion
// is reduced, settles with a solid edge when chosen.
const card =
  'bg-card border-foreground/25 hover:border-primary/60 h-auto min-h-16 w-full min-w-0 touch-manipulation flex-col items-start justify-start gap-0.5 rounded-none border-2 px-2.5 py-1.5 text-left font-normal whitespace-normal shadow-xs transition-transform motion-safe:hover:-translate-y-0.5 motion-safe:focus-visible:-translate-y-0.5 aria-pressed:border-primary aria-pressed:bg-primary/10';

const sizeLabels: Record<CreatureSize, string> = {
  fine: 'Fine',
  diminutive: 'Diminutive',
  tiny: 'Tiny',
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  huge: 'Huge',
  gargantuan: 'Gargantuan',
  colossal: 'Colossal',
};

/**
 * The familiar's own base creature (#326): the representative creatures as
 * cards, one pressed when chosen, with the save acknowledged beside them. A
 * card press or a clear saves at once; a refused save leaves the read's
 * choice in place, and the same card retries it. A key the catalog no
 * longer has stays saved and reads as unavailable until another is chosen.
 */
export function FamiliarCreatureChoice({
  controller,
  view,
}: {
  controller: FamiliarController;
  view: FamiliarView;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useMaintenanceReasonId(maintenance);
  const labelId = useId();
  const coverageId = useId();
  const isDisabled =
    controller.isDisabled || controller.status.kind === 'saving';
  const hasSavedChoice =
    view.baseCreatureKey !== null || view.isBaseCreatureUnavailable;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span id={labelId} className={fieldLabel}>
          Base creature
        </span>
        <span
          className={cn(
            'font-sans text-base [overflow-wrap:anywhere]',
            view.baseCreatureKey === null && 'text-muted-foreground',
          )}
        >
          {view.baseCreatureLabel}
        </span>
      </div>
      <p id={coverageId} className="text-muted-foreground text-xs">
        {view.coverageDescription}
      </p>
      <div
        role="group"
        aria-labelledby={labelId}
        aria-describedby={coverageId}
        className="grid grid-cols-1 gap-1.5 sm:grid-cols-3"
      >
        {view.choices.map((choice) => (
          <Button
            key={choice.key}
            type="button"
            variant="outline"
            aria-pressed={choice.selected}
            aria-label={`${choice.label} base creature`}
            aria-describedby={reasonId}
            disabled={isDisabled}
            onClick={() => void controller.selectBaseCreature(choice.key)}
            className={card}
          >
            <span className="flex w-full flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
              <span className="min-w-0 font-sans text-base leading-tight [overflow-wrap:anywhere]">
                {choice.label}
              </span>
              {choice.selected ? <span className={chip}>Chosen</span> : null}
            </span>
            <span className="text-muted-foreground font-mono text-xs">
              {sizeLabels[choice.size] ?? choice.size}
            </span>
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {hasSavedChoice ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={cn(action, 'text-muted-foreground')}
            aria-describedby={reasonId}
            disabled={isDisabled}
            onClick={() => void controller.selectBaseCreature(null)}
          >
            Clear base creature
          </Button>
        ) : null}
        <SaveFeedback
          status={controller.status}
          savedText="Saved"
          savingText="Saving…"
          shouldHideWhenIdle
        />
      </div>
      {view.baseCreatureMessage ? (
        <p className="text-xs [overflow-wrap:anywhere] text-sky-300">
          {view.baseCreatureMessage}
        </p>
      ) : null}
    </div>
  );
}
