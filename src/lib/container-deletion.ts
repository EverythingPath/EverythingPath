import { ConvexError } from 'convex/values';
import { classifyWriteFailure } from './write-outcome';

/** Characters that keep a campaign or organization deletion from going on. */
export type DeletionBlockers = { ownerless: number; unreturnable: number };

/**
 * A deletion request's outcome as its controls show it (#710). `blocked`
 * carries the counts the server refused with: Characters that need an owner
 * first, and legacy Characters that can't be returned yet.
 */
export type DeletionRequestStatus =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | ({ kind: 'blocked'; message: string } & DeletionBlockers)
  | { kind: 'rejected'; message: string | null }
  | { kind: 'unknown' };

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/** The blocked refusal's counts, when the server refused for that reason. */
function readBlockedRefusal(error: unknown) {
  if (!(error instanceof ConvexError)) return null;
  const data: unknown = error.data;
  if (
    typeof data !== 'object' ||
    data === null ||
    !('code' in data) ||
    data.code !== 'DELETION_BLOCKED' ||
    !('message' in data) ||
    typeof data.message !== 'string' ||
    !('ownerless' in data) ||
    !isCount(data.ownerless) ||
    !('unreturnable' in data) ||
    !isCount(data.unreturnable)
  )
    return null;
  return {
    kind: 'blocked' as const,
    message: data.message,
    ownerless: data.ownerless,
    unreturnable: data.unreturnable,
  };
}

/**
 * How a failed deletion request reads: blocked with its counts, another
 * definite refusal, or an outcome the caller must check before retrying.
 */
export function classifyDeletionFailure(
  error: unknown,
): Exclude<DeletionRequestStatus, { kind: 'idle' | 'pending' }> {
  const blocked = readBlockedRefusal(error);
  if (blocked) return blocked;
  const failure = classifyWriteFailure(error);
  return failure.kind === 'rejected'
    ? { kind: 'rejected', message: failure.message }
    : { kind: 'unknown' };
}

/**
 * Why a deletion can't go on yet, one phrase per kind of Character, worded
 * once for every place that shows it: "2 Characters need an owner" and
 * "1 Character can't go back to its owner yet". Null for a kind with none.
 */
export function deletionBlockerReasons({
  ownerless,
  unreturnable,
}: DeletionBlockers) {
  return {
    ownerless:
      ownerless === 0
        ? null
        : ownerless === 1
          ? '1 Character needs an owner'
          : `${ownerless} Characters need an owner`,
    unreturnable:
      unreturnable === 0
        ? null
        : unreturnable === 1
          ? "1 Character can't go back to its owner yet"
          : `${unreturnable} Characters can't go back to their owners yet`,
  };
}
