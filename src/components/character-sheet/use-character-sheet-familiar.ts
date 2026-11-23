'use client';

import { api } from '@convex/_generated/api';
import { useMutation } from 'convex/react';
import { useRef } from 'react';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { createCharacterSheetOperationId } from '~/lib/character-sheet-operations';
import {
  familiarBaseCreatureKeySchema,
  type FamiliarBaseCreatureKey,
} from '~/lib/catalog/representative-familiars';
import { buildCharacterSheetFamiliarView } from './character-sheet-familiar-view-model';
import type { CharacterScope } from './character-scope';
import type { CompanionRelationshipView } from './character-companions-view-model';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import { useEntryWriteStatus } from './use-character-sheet-entries';

export function useCharacterSheetFamiliar(
  scope: CharacterScope,
  snapshot: CharacterSheetSnapshot | null | undefined,
  relationships: CompanionRelationshipView[] | undefined,
) {
  const selectBaseCreature = useMutation(
    api.characterSheetFamiliars.selectBaseCreature,
  );
  const maintenance = useInitialMigrationMaintenance();
  const familiarRelationships = relationships?.filter(
    (row) => row.kind === 'familiar' && row.role === 'associated',
  );
  const relationship =
    familiarRelationships?.find(
      (row) => row.relationshipId === snapshot?.familiarRelationshipId,
    ) ?? null;
  const isAvailable = Boolean(snapshot && relationship);
  const isDisabled = !isAvailable || maintenance.readOnly;
  const disabled = useRef(isDisabled);
  disabled.current = isDisabled;
  const state = useEntryWriteStatus({
    subject: 'Base creature',
    scopeKey: JSON.stringify([
      scope,
      snapshot?.character._id,
      relationship?.relationshipId,
    ]),
    signature: snapshot
      ? JSON.stringify({
          baseCreatureKey: snapshot.character.familiarBaseCreatureKey,
          familiar: snapshot.calculated.familiar,
          permanentFamiliar: snapshot.permanentCalculated.familiar,
        })
      : null,
    operationId: snapshot?.lastOperationId,
  });

  return {
    relationship,
    view:
      snapshot && relationship
        ? buildCharacterSheetFamiliarView({
            baseCreatureKey: snapshot.character.familiarBaseCreatureKey,
            current: snapshot.calculated.familiar,
            permanent: snapshot.permanentCalculated.familiar,
          })
        : null,
    isAvailable,
    isLoading: Boolean(snapshot) && relationships === undefined,
    isDisabled,
    isReadOnly: maintenance.readOnly,
    status: state.status,
    hasRemoteChange: state.hasRemoteChange,
    dismissRemoteChange: state.dismissRemoteChange,
    selectBaseCreature: (baseCreatureKey: FamiliarBaseCreatureKey | null) => {
      if (disabled.current || !state.isCurrent() || !snapshot || !relationship)
        return Promise.resolve(false);
      if (
        baseCreatureKey !== null &&
        !familiarBaseCreatureKeySchema.safeParse(baseCreatureKey).success
      )
        return Promise.resolve(false);
      return state.write(() =>
        selectBaseCreature({
          characterId: snapshot.character._id,
          relationshipId: relationship.relationshipId,
          baseCreatureKey,
          operationId: createCharacterSheetOperationId(),
        }),
      );
    },
  };
}
