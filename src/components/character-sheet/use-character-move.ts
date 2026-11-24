'use client';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { useConvex, useMutation } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { useRef, useState } from 'react';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import {
  classifyWriteFailure,
  refusalReason,
  type WriteFailure,
} from '~/lib/write-outcome';
import { migrationWriteMessages } from '~/lib/migration-write-messages';
import type { CharacterScope } from './character-scope';
import type { SaveStatus } from './save-status';

export type CharacterMoveProgress = NonNullable<
  FunctionReturnType<typeof api.characterMoves.status>
>;

type CharacterMoveOperatorStatus = {
  characterId: Id<'character'>;
  operationId: string;
  action: 'start' | 'resume' | 'cancel';
  failure: WriteFailure;
  error: unknown;
};

type MoveAttempt = {
  previousOperationId?: string;
  operationId: string;
  destinationCampaignId?: Id<'campaign'>;
  progress: CharacterMoveProgress | null;
};

export function useCharacterMove(scope: CharacterScope<Id<'character'>>) {
  const start = useMutation(api.characterMoves.start);
  const resume = useMutation(api.characterMoves.resume);
  const cancel = useMutation(api.characterMoves.cancel);
  const convex = useConvex();
  const maintenance = useInitialMigrationMaintenance();
  const capabilities = useQuery({
    ...convexQuery(api.characterMoves.destinations, {
      characterId: scope.characterId,
    }),
    throwOnError: false,
  });
  const isAvailable =
    !capabilities.error &&
    capabilities.data?.available === true &&
    capabilities.data.isOwner;
  const currentCampaignId = capabilities.data?.currentCampaignId;
  const destinations = capabilities.data?.destinations ?? [];
  const preview = useQuery({
    ...convexQuery(
      api.characterMoves.preview,
      isAvailable ? { characterId: scope.characterId } : 'skip',
    ),
    throwOnError: false,
  });
  const currentScope = useRef({
    characterId: scope.characterId,
    generation: 0,
  });
  if (currentScope.current.characterId !== scope.characterId)
    currentScope.current = {
      characterId: scope.characterId,
      generation: currentScope.current.generation + 1,
    };
  const scopeKey = `${scope.characterId}/${currentScope.current.generation}`;
  const [pickerScope, setPickerScope] = useState<string | null>(null);
  const [local, setLocal] = useState<{
    scopeKey: string;
    status: SaveStatus;
    attempt: MoveAttempt | null;
    needsInspection: boolean;
    operatorStatus: CharacterMoveOperatorStatus | null;
  }>({
    scopeKey,
    status: { kind: 'idle' },
    operatorStatus: null,
    attempt: null,
    needsInspection: false,
  });
  const localState = local.scopeKey === scopeKey ? local : null;
  const move = useQuery({
    ...convexQuery(
      api.characterMoves.status,
      isAvailable
        ? {
            characterId: scope.characterId,
          }
        : 'skip',
    ),
    throwOnError: false,
  });
  const readError =
    capabilities.error ?? (isAvailable ? (move.error ?? preview.error) : null);
  const canReadMove = isAvailable && !readError;
  const progress = canReadMove
    ? latestProgress(localState?.attempt, move.data)
    : null;
  // An unfinished move this device saw, and the one a newer move from another
  // device replaced, whose result is read once that newer move is adopted.
  const [watch, setWatch] = useState<{
    scopeKey: string;
    operationId: string | null;
    replacedOperationId: string | null;
  }>({ scopeKey, operationId: null, replacedOperationId: null });
  const currentWatch =
    watch.scopeKey === scopeKey
      ? watch
      : { scopeKey, operationId: null, replacedOperationId: null };
  const unfinishedId =
    progress && progress.state !== 'completed' && progress.state !== 'cancelled'
      ? progress.operationId
      : null;
  if (unfinishedId && unfinishedId !== currentWatch.operationId)
    setWatch({
      scopeKey,
      operationId: unfinishedId,
      replacedOperationId:
        currentWatch.operationId ?? currentWatch.replacedOperationId,
    });
  else if (
    !unfinishedId &&
    progress?.operationId === currentWatch.operationId &&
    currentWatch.operationId !== null
  )
    // Seen to its end here, so a later move replaced nothing.
    setWatch({ ...currentWatch, operationId: null });
  const replaced = useQuery({
    ...convexQuery(
      api.characterMoves.status,
      isAvailable && currentWatch.replacedOperationId
        ? {
            characterId: scope.characterId,
            operationId: currentWatch.replacedOperationId,
          }
        : 'skip',
    ),
    throwOnError: false,
  });
  const replacedData = replaced.data ?? null;
  const replacedMove =
    canReadMove && replacedData?.cancelReason === 'replaced'
      ? replacedData
      : null;
  const needsInspection =
    localState?.needsInspection === true &&
    progress?.state !== 'completed' &&
    progress?.state !== 'cancelled';
  const isBusy = localState?.status.kind === 'saving';
  const busyScopes = useRef(new Set<string>());
  const isDisabled =
    !isAvailable ||
    move.data === undefined ||
    preview.data === undefined ||
    maintenance.readOnly ||
    Boolean(readError) ||
    isBusy;
  const hasPendingMove =
    progress !== null &&
    progress.state !== 'completed' &&
    progress.state !== 'cancelled';
  const canReviewMove = !isDisabled && !hasPendingMove && !needsInspection;
  const canStart = canReviewMove && !preview.data?.refusal;
  const canResume = !isDisabled && (hasPendingMove || needsInspection);

  const isCurrent = () =>
    `${currentScope.current.characterId}/${currentScope.current.generation}` ===
    scopeKey;

  function acknowledge(attempt: MoveAttempt, progress: CharacterMoveProgress) {
    setLocal({
      scopeKey,
      status: { kind: 'saved' },
      operatorStatus: null,
      attempt: { ...attempt, progress },
      needsInspection: false,
    });
    setPickerScope(null);
  }

  async function inspectAttempt(attempt: MoveAttempt) {
    const inspected = await convex.query(api.characterMoves.status, {
      characterId: scope.characterId,
      operationId: attempt.operationId,
    });
    if (!isCurrent()) return { kind: 'stale' } as const;
    if (inspected?.state === 'completed' || inspected?.state === 'cancelled') {
      acknowledge(attempt, inspected);
      return { kind: 'acknowledged' } as const;
    }
    if (inspected) return { kind: 'write', action: 'resume' } as const;
    if (attempt.progress === null)
      return { kind: 'write', action: 'start' } as const;
    throw new Error('Move progress could not be found.');
  }

  async function saveAttempt(
    attempt: MoveAttempt,
    action: 'start' | 'resume' | 'cancel',
  ) {
    const args = {
      characterId: scope.characterId,
      operationId: attempt.operationId,
    };
    switch (action) {
      case 'start':
        return start({
          ...args,
          ...(attempt.destinationCampaignId
            ? { destinationCampaignId: attempt.destinationCampaignId }
            : {}),
        });
      case 'cancel':
        return cancel(args);
      case 'resume':
        return resume(args);
    }
  }

  async function write(
    attempt: MoveAttempt,
    requestedAction: 'start' | 'resume' | 'cancel',
  ) {
    if (isDisabled || busyScopes.current.has(scopeKey)) return false;
    busyScopes.current.add(scopeKey);
    // This device acted, so an earlier replacement is no longer news.
    setWatch({ ...currentWatch, replacedOperationId: null });
    setLocal({
      scopeKey,
      status: { kind: 'saving' },
      operatorStatus: null,
      attempt,
      needsInspection,
    });
    let action = requestedAction;
    try {
      if (needsInspection && requestedAction !== 'cancel') {
        const inspection = await inspectAttempt(attempt);
        if (inspection.kind === 'stale') return false;
        if (inspection.kind === 'acknowledged') return true;
        action = inspection.action;
      }
      const result = await saveAttempt(attempt, action);
      if (!isCurrent()) return false;
      acknowledge(attempt, result);
      return true;
    } catch (error) {
      if (!isCurrent()) return false;
      const failure = classifyWriteFailure(error);
      setLocal({
        scopeKey,
        operatorStatus: {
          characterId: scope.characterId,
          operationId: attempt.operationId,
          action,
          failure,
          error,
        },
        status: {
          kind: 'error',
          message:
            failure.kind === 'rejected'
              ? moveRefusalMessage(failure.message)
              : 'The move may have been saved. Check its progress before trying again.',
        },
        attempt:
          failure.kind === 'rejected' && action === 'start' ? null : attempt,
        needsInspection: failure.kind === 'unknown',
      });
      return false;
    } finally {
      busyScopes.current.delete(scopeKey);
    }
  }

  function startMove(destinationCampaignId?: Id<'campaign'>) {
    if (!canStart) return Promise.resolve(false);
    if (
      destinationCampaignId
        ? !capabilities.data?.destinations.some(
            (destination) =>
              destination.campaignId === destinationCampaignId &&
              destinationCampaignId !== capabilities.data?.currentCampaignId,
          )
        : !capabilities.data?.currentCampaignId
    )
      return Promise.resolve(false);
    return write(
      {
        operationId: crypto.randomUUID(),
        previousOperationId: move.data?.operationId,
        destinationCampaignId,
        progress: null,
      },
      'start',
    );
  }

  function resumeMove() {
    if (!canResume) return Promise.resolve(false);
    if (needsInspection && localState?.attempt)
      return write(localState.attempt, 'resume');
    if (!progress) return Promise.resolve(false);
    return write(
      localState?.attempt?.operationId === progress.operationId
        ? localState.attempt
        : { operationId: progress.operationId, progress },
      'resume',
    );
  }

  function cancelMove() {
    if (
      isDisabled ||
      !progress ||
      progress.state === 'completed' ||
      progress.state === 'cancelled'
    )
      return Promise.resolve(false);
    return write({ operationId: progress.operationId, progress }, 'cancel');
  }

  const pendingDestinationCampaignId =
    needsInspection ||
    localState?.attempt?.operationId === progress?.operationId
      ? (localState?.attempt?.destinationCampaignId ??
        progress?.destinationCampaignId)
      : progress?.destinationCampaignId;
  const status: SaveStatus =
    progress?.state === 'completed' &&
    !isBusy &&
    (localState?.status.kind !== 'error' ||
      localState.attempt?.operationId === progress.operationId)
      ? { kind: 'saved' }
      : (localState?.status ?? { kind: 'idle' });
  const readableState = canReadMove
    ? {
        currentCampaignId,
        groupPreview: preview.data ?? null,
        currentCampaignHasMilitia:
          capabilities.data?.currentCampaignHasMilitia === true,
        departureRoles: capabilities.data?.departureRoles ?? [],
        pendingDestinationCampaignId,
        isPickerOpen: pickerScope === scopeKey,
        destinations: destinations.filter(
          (destination) => destination.campaignId !== currentCampaignId,
        ),
        status,
        operatorStatus: localState?.operatorStatus ?? null,
      }
    : {
        currentCampaignId: undefined,
        groupPreview: null,
        currentCampaignHasMilitia: false,
        departureRoles: [],
        pendingDestinationCampaignId: undefined,
        isPickerOpen: false,
        destinations: [],
        status: { kind: 'idle' as const },
        operatorStatus: null,
      };

  return {
    ...readableState,
    isAvailable,
    isLoading:
      !readError &&
      (capabilities.data === undefined ||
        (isAvailable &&
          (move.data === undefined || preview.data === undefined))),
    isDisabled,
    isBusy,
    canReviewMove,
    canStart,
    canResume,
    canCancel: !isDisabled && hasPendingMove,
    canLeave: canStart && Boolean(capabilities.data?.currentCampaignId),
    setIsPickerOpen: (open: boolean) =>
      setPickerScope(open && canReviewMove ? scopeKey : null),
    needsInspection,
    readError: readError
      ? 'Campaign choices or move progress could not be loaded. Try again.'
      : null,
    retryRead: async () => {
      await Promise.allSettled([
        capabilities.refetch(),
        move.refetch(),
        preview.refetch(),
      ]);
    },
    progress,
    /** This device's move that a newer move from elsewhere replaced. */
    replacedMove,
    startMove,
    resumeMove,
    cancelMove,
  };
}

function latestProgress(
  attempt: MoveAttempt | null | undefined,
  remote: CharacterMoveProgress | null | undefined,
): CharacterMoveProgress | null {
  if (!attempt) return remote ?? null;
  const local = attempt.progress;
  if (remote?.operationId !== attempt.operationId) {
    if (remote && remote.operationId !== attempt.previousOperationId)
      return remote;
    return local;
  }
  if (!local) return remote;
  // Waiting reflects current destination access, so the server's view wins
  // unless this device has since seen the move end.
  const hasLocalEnded =
    local.state === 'completed' || local.state === 'cancelled';
  if (
    local.state === 'waiting' ||
    (remote.state === 'waiting' && !hasLocalEnded)
  )
    return remote;
  if (remote.generation !== local.generation)
    return remote.generation > local.generation ? remote : local;
  const order = {
    preparing: 0,
    ready: 1,
    waiting: 1,
    completed: 2,
    cancelled: 2,
  };
  return order[remote.state] > order[local.state] ||
    (remote.state === local.state && remote.prepared >= local.prepared)
    ? remote
    : local;
}

function moveRefusalMessage(message: string | null) {
  if (message && /limit|too many|too large/i.test(message))
    return 'This Character is too large to move right now.';
  if (message && Object.values(migrationWriteMessages).includes(message))
    return message;
  const safeReasons = new Set([
    'Destination access is required',
    'Destination unavailable',
    'Choose a different campaign',
    'Destination campaign not found',
    'Campaign not found',
    'Only the current owner can move this Character',
    'Only the current owner can resume this move',
  ]);
  if (message && safeReasons.has(message))
    return `Move wasn't saved${refusalReason(message)} Try again.`;
  return 'The move could not be saved. Try again.';
}
