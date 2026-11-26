'use client';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react';
import { useRef, useState } from 'react';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import {
  detectRemoteOwnerChange,
  needsOwner,
  type CharacterOwner,
  type ExpectedOwnerOperation,
} from '~/lib/character-ownership';
import { classifyWriteFailure, refusalReason } from '~/lib/write-outcome';
import type { CharacterScope } from './character-scope';
import type { SaveStatus } from './save-status';

export function useCharacterOwnership(
  scope: CharacterScope<Id<'character'>>,
  owner: CharacterOwner | null | undefined,
  ownerLastOperationId?: string,
  ownershipAvailable = false,
) {
  const { campaignId, organizationId } = scope;
  const isAvailable = Boolean(campaignId && ownershipAvailable);
  const queryScope = campaignId
    ? { characterId: scope.characterId, campaignId, organizationId }
    : null;
  const maintenance = useInitialMigrationMaintenance();
  const reassign = useMutation(api.character.reassignOwner);
  const identityKey = `${organizationId ?? ''}/${campaignId ?? ''}/${scope.characterId}`;
  const currentScope = useRef({ identityKey, generation: 0 });
  if (currentScope.current.identityKey !== identityKey)
    currentScope.current = {
      identityKey,
      generation: currentScope.current.generation + 1,
    };
  const scopeKey = `${identityKey}/${currentScope.current.generation}`;
  const [pickerState, setPickerState] = useState<{
    scopeKey: string;
    selectedUserId: string | null;
  } | null>(null);
  const isPickerOpen = isAvailable && pickerState?.scopeKey === scopeKey;
  const selectedUserId = isPickerOpen ? pickerState.selectedUserId : null;
  const candidates = usePaginatedQuery(
    api.character.listOwnerCandidates,
    isPickerOpen && campaignId ? { campaignId, organizationId } : 'skip',
    { initialNumItems: 25 },
  );
  const [saveState, setSaveState] = useState<{
    scopeKey: string;
    status: SaveStatus;
  }>({
    scopeKey,
    status: { kind: 'idle' },
  });
  const status: SaveStatus =
    saveState.scopeKey === scopeKey ? saveState.status : { kind: 'idle' };
  const pendingAssignments = useRef(new Map<string, string>());
  const expectedOperations = useRef(new Map<string, ExpectedOwnerOperation>());
  const [remoteScopeKey, setRemoteScopeKey] = useState<string | null>(null);
  const observation = {
    scopeKey: identityKey,
    userId: owner === undefined ? undefined : (owner?.userId ?? null),
    operationId: ownerLastOperationId,
  };
  const [previousOwner, setPreviousOwner] = useState(observation);
  const ownerChange = detectRemoteOwnerChange({
    previous: previousOwner,
    owner: observation,
    expectedOperations: expectedOperations.current,
  });
  if (ownerChange.isChanged) {
    setPreviousOwner(observation);
    for (const operationId of ownerChange.acknowledgedOperationIds)
      expectedOperations.current.delete(operationId);
    if (ownerChange.hasRemoteChange) setRemoteScopeKey(scopeKey);
    // The viewer's own assignment supersedes an earlier remote notice, whose
    // text follows the current owner and would credit it to another player.
    else if (ownerChange.acknowledgedOperationIds.length)
      setRemoteScopeKey(null);
  }
  const isDisabled =
    !isAvailable ||
    owner === undefined ||
    maintenance.readOnly ||
    status.kind === 'saving';
  const isOwnerNeeded = needsOwner({ owner, ownershipAvailable: isAvailable });
  // The viewer's own account is read only for the one-click Take ownership.
  // The Characters pages already read it, and Convex shares one subscription
  // per query and arguments, so an id-only query would add one, not save one.
  const me = useQuery(api.user.getMe, isOwnerNeeded ? {} : 'skip');

  async function assignOwner(ownerUserId: Id<'user'>) {
    if (!queryScope || isDisabled || pendingAssignments.current.has(scopeKey))
      return false;
    const operationId = crypto.randomUUID();
    pendingAssignments.current.set(scopeKey, operationId);
    expectedOperations.current.set(operationId, {
      scopeKey: identityKey,
      userId: ownerUserId,
    });
    if (expectedOperations.current.size > 100) {
      const oldestOperationId = expectedOperations.current.keys().next().value;
      if (oldestOperationId)
        expectedOperations.current.delete(oldestOperationId);
    }
    setSaveState({ scopeKey, status: { kind: 'saving' } });
    const isCurrentScope = () =>
      `${currentScope.current.identityKey}/${currentScope.current.generation}` ===
      scopeKey;
    try {
      await reassign({ ...queryScope, ownerUserId, operationId });
      if (!isCurrentScope()) return true;
      setSaveState({ scopeKey, status: { kind: 'saved' } });
      setPickerState(null);
      return true;
    } catch (error) {
      const failure = classifyWriteFailure(error);
      if (failure.kind === 'rejected')
        expectedOperations.current.delete(operationId);
      if (!isCurrentScope()) return false;
      setSaveState({
        scopeKey,
        status: {
          kind: 'error',
          message:
            failure.kind === 'rejected'
              ? `Owner wasn't changed${refusalReason(failure.message)} Try again.`
              : 'Owner may have changed. Check the current owner before trying again.',
        },
      });
      return false;
    } finally {
      // A parent read can render after the reply; retain own-operation provenance
      // until that projection acknowledges it, including an uncertain outcome.
      if (pendingAssignments.current.get(scopeKey) === operationId)
        pendingAssignments.current.delete(scopeKey);
    }
  }

  return {
    isAvailable,
    owner,
    isMine: owner?.isMine === true,
    ownerLabel:
      owner === undefined
        ? 'Loading owner…'
        : (owner?.name ?? 'Needs an owner'),
    isPickerOpen,
    setIsPickerOpen: (isOpen: boolean) =>
      setPickerState(isOpen ? { scopeKey, selectedUserId: null } : null),
    selectedUserId,
    selectOwner: (selectedUserId: string) =>
      setPickerState({ scopeKey, selectedUserId }),
    candidates: candidates.results,
    candidatesStatus: candidates.status,
    loadMore: () => {
      if (isAvailable && isPickerOpen && candidates.status === 'CanLoadMore')
        candidates.loadMore(25);
    },
    isDisabled,
    status,
    assignOwner,
    needsOwner: isOwnerNeeded,
    /** Take ownership also waits for the viewer's own account. */
    isTakeOwnershipDisabled: isDisabled || !me,
    takeOwnership: () =>
      me ? assignOwner(me._id) : Promise.resolve(false as const),
    hasRemoteChange: remoteScopeKey === scopeKey,
    dismissRemoteChange: () => setRemoteScopeKey(null),
  };
}
