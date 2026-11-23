'use client';
import type { Id } from '@convex/_generated/dataModel';
import { useId } from 'react';
import {
  MaintenanceReason,
  useMaintenanceReasonId,
} from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { CohortBlock } from './cohort-block';
import { CohortLeadershipBlock } from './cohort-leadership-block';
import type { CohortController } from './companion-props';
import type { useCharacterSheet } from './use-character-sheet';

type CharacterCohortProps = {
  controller: CohortController;
  warningController: ReturnType<typeof useCharacterSheet>['warnings'];
  /** The viewed sheet; a different one starts afresh. */
  characterId: Id<'character'>;
  /** Replaces the maintenance notice's own words beside disabled edits. */
  maintenanceMessage?: string;
};

/**
 * Cohorts under Leadership (#417), in the Companions section: on a cohort's
 * own sheet its Cohort Equivalence and the level its leader allows; on a
 * leader's sheet the Leadership modifiers of each cohort it supports. The
 * two parts are independent, and a sheet that is neither shows nothing.
 */
export function CharacterCohort({
  characterId,
  ...props
}: CharacterCohortProps) {
  return <CohortSection key={characterId} {...props} />;
}

function CohortSection({
  controller,
  warningController,
  maintenanceMessage,
}: Omit<CharacterCohortProps, 'characterId'>) {
  const maintenance = useInitialMigrationMaintenance();
  const sharedReasonId = useMaintenanceReasonId(maintenance);
  const ownReasonId = useId();
  const reasonId = controller.isReadOnly
    ? (sharedReasonId ?? ownReasonId)
    : undefined;
  const { view, leadershipSources } = controller;
  if (!view && leadershipSources.length === 0) return null;
  return (
    <>
      {view ? (
        <CohortBlock
          view={view}
          controller={controller}
          warningController={warningController}
          reasonId={reasonId}
        />
      ) : null}
      {leadershipSources.length > 0 ? (
        <CohortLeadershipBlock controller={controller} reasonId={reasonId} />
      ) : null}
      {sharedReasonId ? null : (
        <MaintenanceReason
          id={ownReasonId}
          notice={{
            ...maintenance,
            message: maintenanceMessage ?? maintenance.message,
          }}
          className="mt-2 text-xs"
        />
      )}
    </>
  );
}
