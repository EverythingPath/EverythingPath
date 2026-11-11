'use client';
import type { Id } from '@convex/_generated/dataModel';
import { useId } from 'react';
import {
  MaintenanceReason,
  useMaintenanceReasonId,
} from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { CompanionAllocationPool } from './companion-allocation-pool';
import type { CompanionAllocationsController } from './companion-props';
import { RemoteNotice } from './sheet-parts';
import { useFocusAfterEditorCloses } from './use-focus-after-editor-closes';

type CharacterCompanionAllocationsProps = {
  controller: CompanionAllocationsController;
  /** The viewed associated Character; a different one starts afresh. */
  characterId: Id<'character'>;
  /** Replaces the maintenance notice's own words beside disabled edits. */
  maintenanceMessage?: string;
};

/**
 * The viewed associated Character's divided budgets (#410), beneath its
 * relationships: one block per Beast Master, Pack Lord or Packmaster budget
 * with each companion's share edited in place, and a Boon Companion limit
 * read the same way without an editor. Nothing renders while the budgets
 * load or when this Character owns none.
 */
export function CharacterCompanionAllocations({
  characterId,
  ...props
}: CharacterCompanionAllocationsProps) {
  return <AllocationsSection key={characterId} {...props} />;
}

function AllocationsSection({
  controller,
  maintenanceMessage,
}: Omit<CharacterCompanionAllocationsProps, 'characterId'>) {
  const maintenance = useInitialMigrationMaintenance();
  const sharedReasonId = useMaintenanceReasonId(maintenance);
  const ownReasonId = useId();
  const reasonId = maintenance.readOnly
    ? (sharedReasonId ?? ownReasonId)
    : undefined;
  // One editor at a time: a share of levels or an eidolon's components.
  const focus = useFocusAfterEditorCloses(
    controller.editor?.key ?? controller.componentEditor?.key ?? null,
    'h3',
  );
  const pools = controller.pools ?? [];
  if (pools.length === 0) return null;
  return (
    <div
      ref={focus.wrapper}
      className="border-foreground/10 mt-3 flex flex-col gap-3 border-t pt-3"
    >
      <RemoteNotice
        isShown={controller.hasRemoteChange}
        message="Companion allocations updated by another player. Your edits are kept."
        subject="companion allocations"
        onDismiss={controller.dismissRemoteChange}
      />
      {pools.map((pool) => (
        <CompanionAllocationPool
          key={pool.key}
          pool={pool}
          controller={controller}
          reasonId={reasonId}
          rememberOpener={focus.rememberOpener}
        />
      ))}
      {sharedReasonId ? null : (
        <MaintenanceReason
          id={ownReasonId}
          notice={{
            ...maintenance,
            message: maintenanceMessage ?? maintenance.message,
          }}
          className="text-xs"
        />
      )}
    </div>
  );
}
