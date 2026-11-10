import type { Id } from '@convex/_generated/dataModel';

export type CharacterOwner = {
  userId: Id<'user'>;
  name: string;
  isMine: boolean;
};

/**
 * Nobody owns the Character, so any member may take or assign it (#708):
 * where members can assign owners and its owner reads as none. A departed
 * owner (#706) still owns theirs.
 */
export function needsOwner({
  owner,
  ownershipAvailable,
}: {
  owner: CharacterOwner | null | undefined;
  ownershipAvailable: boolean;
}) {
  return owner === null && ownershipAvailable;
}

type OwnerObservation = {
  scopeKey: string;
  userId: Id<'user'> | null | undefined;
  operationId?: string;
};

export type ExpectedOwnerOperation = {
  scopeKey: string;
  userId: Id<'user'>;
};

export function detectRemoteOwnerChange({
  previous,
  owner,
  expectedOperations,
}: {
  previous: OwnerObservation;
  owner: OwnerObservation;
  expectedOperations: ReadonlyMap<string, ExpectedOwnerOperation>;
}) {
  const isChanged =
    previous.scopeKey !== owner.scopeKey ||
    previous.userId !== owner.userId ||
    previous.operationId !== owner.operationId;
  const expected = owner.operationId
    ? expectedOperations.get(owner.operationId)
    : undefined;
  const isOwnOperation =
    expected?.scopeKey === owner.scopeKey && expected.userId === owner.userId;
  return {
    isChanged,
    acknowledgedOperationIds:
      isOwnOperation && owner.operationId ? [owner.operationId] : [],
    hasRemoteChange:
      previous.scopeKey === owner.scopeKey &&
      previous.userId !== undefined &&
      owner.userId !== undefined &&
      previous.userId !== owner.userId &&
      !isOwnOperation,
  };
}
