'use client';
import type { Id } from '@convex/_generated/dataModel';
import { api } from '@convex/_generated/api';
import { useQuery } from 'convex/react';
import { useId } from 'react';
import {
  MaintenanceReason,
  MaintenanceReasonScope,
  useMaintenanceReasonId,
} from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import {
  linkedInputKey,
  type LinkedInputProjection,
} from '~/lib/character-sheet-linked-inputs';
import {
  CharacterLinkedInputRow,
  type LinkedInputDescriptor,
} from './character-linked-input-row';

type CharacterLinkedInputsProps = {
  /** The viewed sheet: the associated Character or the Companion. */
  characterId: Id<'character'>;
  relationshipId: Id<'companionRelationship'>;
  inputs: readonly LinkedInputDescriptor[];
  projection?: LinkedInputProjection;
  isAvailable: boolean;
  /** Replaces the maintenance notice's own words beside disabled edits. */
  maintenanceMessage?: string;
};

/**
 * The named values a Companion Relationship borrows (#317) share one
 * subscription. Rows point at their section's maintenance reason; on its
 * own the list states it once at its foot.
 */
export function CharacterLinkedInputs({
  characterId,
  relationshipId,
  inputs,
  projection,
  isAvailable,
  maintenanceMessage,
}: CharacterLinkedInputsProps) {
  const maintenance = useInitialMigrationMaintenance();
  const sharedReasonId = useMaintenanceReasonId(maintenance);
  const ownReasonId = useId();
  const snapshots = useQuery(
    api.characterSheetLinkedInputs.list,
    isAvailable && inputs.length > 0
      ? { characterId, relationshipId, ...(projection ? { projection } : {}) }
      : 'skip',
  );
  const snapshotsByInput = new Map(
    snapshots?.map((snapshot) => [linkedInputKey(snapshot.input), snapshot]),
  );
  if (!isAvailable || inputs.length === 0) return null;
  return (
    <MaintenanceReasonScope id={sharedReasonId ?? ownReasonId}>
      <ul
        aria-label="Linked values"
        className="border-foreground/10 divide-foreground/10 mt-2 divide-y border-t"
      >
        {inputs.map((descriptor) => (
          <li key={linkedInputKey(descriptor.input)}>
            <CharacterLinkedInputRow
              descriptor={descriptor}
              characterId={characterId}
              relationshipId={relationshipId}
              projection={projection}
              snapshot={snapshotsByInput.get(linkedInputKey(descriptor.input))}
            />
          </li>
        ))}
      </ul>
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
    </MaintenanceReasonScope>
  );
}
