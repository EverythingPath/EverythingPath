'use client';

import { api } from '@convex/_generated/api';
import type { FunctionArgs } from 'convex/server';
import { useMutation } from 'convex/react';
import { useMemo } from 'react';
import { createCharacterSheetOperationId } from '~/lib/character-sheet-operations';
import type { CharacterScope } from './character-scope';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import type {
  GrantEntryTarget,
  GrantEntryView,
} from './character-sheet-grants-view-model';
import { useEntryWriteStatus } from './use-character-sheet-entries';
import type { CatalogDetachTarget } from './use-character-sheet-catalog';

export type GrantStateInput = FunctionArgs<
  typeof api.characterSheet.editGrantState
>['state'];

/** Row controls own their acknowledgements; the live read owns each entry's state. */
export function useCharacterSheetGrants(
  scope: CharacterScope,
  snapshot: CharacterSheetSnapshot | null | undefined,
) {
  const setDormantEntryKept = useMutation(
    api.characterSheet.setDormantEntryKept,
  );
  const discardDormantEntry = useMutation(
    api.characterSheet.discardDormantEntry,
  );
  const editGrantState = useMutation(api.characterSheet.editGrantState);
  const editSelection = useMutation(api.characterSheet.editSelection);
  const signature = useMemo(() => {
    if (!snapshot) return null;
    const entries = snapshot.entries
      .filter((entry) => entry.kind !== 'base')
      .map((entry) =>
        entry.kind === 'classLevel'
          ? {
              _id: entry._id,
              active: entry.active,
              classEntryId: entry.state.classEntryId,
              position: entry.state.position,
            }
          : entry,
      );
    const resolvedEntries = snapshot.calculated.resolvedEntries.filter(
      ({ entry }) => entry.kind !== 'base' && entry.kind !== 'classLevel',
    );
    const catalogIds = new Set<string>();
    const sourceIdentities = new Set<string>();
    for (const entry of snapshot.entries) {
      if (entry.kind === 'base') continue;
      if ('catalogEntryId' in entry) catalogIds.add(entry.catalogEntryId);
      if (entry.kind === 'classLevel' && entry.state.classEntryId)
        catalogIds.add(entry.state.classEntryId);
    }
    for (const { entry } of resolvedEntries) {
      if ('catalogEntryId' in entry) catalogIds.add(entry.catalogEntryId);
      if ('grantKey' in entry && entry.grantKey)
        sourceIdentities.add(entry.grantKey.source);
    }
    return JSON.stringify({
      entries,
      resolvedEntries,
      catalog: snapshot.catalogEntries.filter(
        (entry) =>
          catalogIds.has(entry._id) || sourceIdentities.has(entry.ruleIdentity),
      ),
    });
  }, [snapshot]);
  const writeState = useEntryWriteStatus({
    signature,
    operationId: snapshot?.lastOperationId,
    subject: 'Character Sheet Entry',
  });

  function createWriteOperation() {
    if (!snapshot) throw new Error('Character sheet is not available.');
    return {
      ...scope,
      characterId: snapshot.character._id,
      operationId: createCharacterSheetOperationId(),
    };
  }

  function target(reference: GrantEntryTarget) {
    if ('grantKey' in reference) return reference;
    const stored = snapshot?.entries.find(
      (entry) => entry._id === reference.entryId,
    );
    if (!stored) throw new Error('This entry is no longer available.');
    return { entryId: stored._id };
  }

  function write(row: GrantEntryView, action: () => Promise<unknown>) {
    return writeState.write(action, { key: row.rowId, subject: row.name });
  }

  return {
    getCatalogDetachTarget: (
      reference: GrantEntryTarget,
    ): CatalogDetachTarget | undefined => {
      if ('grantKey' in reference)
        return { kind: 'grant', grantKey: reference.grantKey };
      const stored = snapshot?.entries.find(
        (entry) => entry._id === reference.entryId,
      );
      return stored ? { kind: 'entry', entryId: stored._id } : undefined;
    },
    statusFor: writeState.statusFor,
    hasRemoteChange: writeState.hasRemoteChange,
    dismissRemoteChange: writeState.dismissRemoteChange,
    setKept: (row: GrantEntryView, kept: boolean) =>
      write(row, () =>
        setDormantEntryKept({
          ...createWriteOperation(),
          target: target(row.target),
          kept,
        }),
      ),
    discard: (row: GrantEntryView) =>
      write(row, () =>
        discardDormantEntry({
          ...createWriteOperation(),
          target: target(row.target),
        }),
      ),
    edit: (row: GrantEntryView, state: GrantStateInput) =>
      write(row, () => {
        const reference = target(row.target);
        return 'grantKey' in reference
          ? editGrantState({
              ...createWriteOperation(),
              grantKey: reference.grantKey,
              state,
            })
          : editSelection({
              ...createWriteOperation(),
              entryId: reference.entryId,
              ...state,
            });
      }),
  };
}
