'use client';
import { useId } from 'react';
import {
  MaintenanceReason,
  MaintenanceReasonScope,
} from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { CompanionRelationshipSummary } from './companion-relationship-summary';
import { FamiliarCreatureChoice } from './familiar-creature-choice';
import { FamiliarStatistic } from './familiar-statistic';
import { Block, chip, fieldLabel, RemoteNotice } from './sheet-parts';
import type { useCharacterSheet } from './use-character-sheet';

type CharacterSheetFamiliarProps = {
  controller: ReturnType<typeof useCharacterSheet>['familiar'];
  /** Replaces the maintenance notice's own words beside disabled edits. */
  maintenanceMessage?: string;
};

const note = 'text-muted-foreground text-xs [overflow-wrap:anywhere]';

/**
 * The Familiar section of a familiar's own sheet (#326): the Character it
 * is associated with, its own base creature as cards, and the familiar rule
 * values calculated from both, with Unresolved wherever a value is missing.
 * History keeps the creature and its choices; an inaccessible master reads
 * only as unavailable. The master's sheet keeps its Companions section
 * instead, and the borrowed values stay listed there. Nothing renders for a
 * sheet that is not a familiar.
 */
export function CharacterSheetFamiliar({
  controller,
  maintenanceMessage,
}: CharacterSheetFamiliarProps) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useId();
  if (controller.isLoading)
    return (
      <Block title="Familiar">
        <p role="status" className="text-muted-foreground text-sm">
          Loading familiar…
        </p>
      </Block>
    );
  const { relationship, view } = controller;
  if (!controller.isAvailable || !relationship || !view) return null;
  return (
    <MaintenanceReasonScope id={reasonId}>
      <Block title="Familiar">
        <div className="flex flex-col gap-3">
          <RemoteNotice
            isShown={controller.hasRemoteChange}
            message="Familiar updated by another player."
            subject="familiar"
            onDismiss={controller.dismissRemoteChange}
          />
          <div className="flex min-w-0 flex-col gap-0.5">
            <CompanionRelationshipSummary row={relationship} />
            {relationship.explanation ? (
              <p className={note}>{relationship.explanation}</p>
            ) : null}
          </div>
          <FamiliarCreatureChoice controller={controller} view={view} />
          {view.unresolvedMessage ? (
            <p className="text-xs [overflow-wrap:anywhere] text-amber-300">
              {view.unresolvedMessage}
            </p>
          ) : null}
          <ul
            aria-label="Familiar statistics"
            className="grid grid-cols-2 gap-1.5 md:grid-cols-3 lg:grid-cols-5"
          >
            {view.statistics.map((statistic) => (
              <FamiliarStatistic key={statistic.key} statistic={statistic} />
            ))}
          </ul>
          {view.specialAbilities.length > 0 ? (
            <div className="flex flex-col gap-1">
              <span className={fieldLabel}>Special abilities</span>
              <ul
                aria-label="Special abilities"
                className="flex flex-wrap gap-1"
              >
                {view.specialAbilities.map((ability) => (
                  <li key={ability} className={chip}>
                    {ability}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <MaintenanceReason
            id={reasonId}
            notice={{
              ...maintenance,
              message: maintenanceMessage ?? maintenance.message,
            }}
            className="text-xs"
          />
        </div>
      </Block>
    </MaintenanceReasonScope>
  );
}
