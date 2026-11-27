'use client';

import { api } from '@convex/_generated/api';
import type { FunctionArgs } from 'convex/server';
import { useMutation } from 'convex/react';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { createCharacterSheetOperationId } from '~/lib/character-sheet-operations';
import type { CharacterScope } from './character-scope';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import { useEntryWriteStatus } from './use-character-sheet-entries';
import {
  buildCompanionProgressionView,
  companionSpeciesChoices,
  type CompanionProgressionView,
} from './character-companion-progression-view-model';
import {
  buildEidolonProgressionView,
  eidolonBaseFormChoices,
  eidolonEvolutionCatalog,
  eidolonEvolutionCatalogFor,
  eidolonVersionChoices,
  newEidolonProgression,
  unchainedEidolonSubtypeChoices,
  type EidolonProgressionView,
} from './character-eidolon-progression-view-model';

export type CompanionProgressionInput = FunctionArgs<
  typeof api.characterSheet.setCompanionProgression
>['progression'];

export function useCharacterCompanionProgression(
  scope: CharacterScope,
  snapshot: CharacterSheetSnapshot | null | undefined,
) {
  const setProgression = useMutation(
    api.characterSheet.setCompanionProgression,
  );
  const maintenance = useInitialMigrationMaintenance();
  const summary: CompanionProgressionView | null = snapshot
    ? buildCompanionProgressionView(snapshot)
    : null;
  const eidolon: EidolonProgressionView | null = snapshot
    ? buildEidolonProgressionView(snapshot)
    : null;
  const state = useEntryWriteStatus({
    signature: snapshot
      ? JSON.stringify(summary ?? eidolon, (key, value: unknown) =>
          key === 'accepted' ? undefined : value,
        )
      : null,
    operationId: snapshot?.lastOperationId,
    scopeKey: `${scope.characterId}/${snapshot?.campaign?.campaignId ?? ''}`,
    subject: 'Companion Progression',
  });
  const isDisabled = !snapshot || maintenance.readOnly;
  return {
    summary,
    speciesChoices: companionSpeciesChoices,
    /** The eidolon's progression (#409); null for other Companions. */
    eidolon,
    eidolonBaseForms: eidolonBaseFormChoices,
    evolutionCatalog: eidolonEvolutionCatalog,
    /** The evolution list of the recorded version (#418). */
    evolutionCatalogFor: eidolonEvolutionCatalogFor,
    eidolonVersions: eidolonVersionChoices,
    unchainedSubtypes: unchainedEidolonSubtypeChoices,
    /** A first eidolon record for a base form and version, to pass to `save`. */
    newEidolon: newEidolonProgression,
    status: state.status,
    isLoading: snapshot === undefined,
    isDisabled,
    isReadOnly: maintenance.readOnly,
    hasRemoteChange: state.hasRemoteChange,
    dismissRemoteChange: state.dismissRemoteChange,
    save: (progression: CompanionProgressionInput) => {
      if (isDisabled || !snapshot) return Promise.resolve(false);
      return state.write(() =>
        setProgression({
          ...scope,
          characterId: snapshot.character._id,
          operationId: createCharacterSheetOperationId(),
          progression,
        }),
      );
    },
  };
}
