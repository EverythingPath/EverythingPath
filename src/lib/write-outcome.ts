import { migrationWriteMessages } from './migration-write-messages';
import { findMigrationWriteRejection } from './migration-write-rejection';
import { ConvexError } from 'convex/values';

export type WriteFailure =
  | { kind: 'rejected'; message: string | null }
  | { kind: 'unknown' };

// Only a ConvexError is a definite server refusal (authorization, a missing
// campaign, maintenance), and the transaction did not commit. Anything else
// (a closed connection, an unexpected failure) may or may not have been
// applied, so the caller must not claim it failed or replay it blindly.
export function classifyWriteFailure(error: unknown): WriteFailure {
  const rejection = findMigrationWriteRejection(error);
  if (rejection)
    return { kind: 'rejected', message: migrationWriteMessages[rejection] };
  if (error instanceof ConvexError)
    return {
      kind: 'rejected',
      message: typeof error.data === 'string' ? error.data : null,
    };
  return { kind: 'unknown' };
}

/** ": <server message>." or ".", so a refusal reads as one sentence. */
export function refusalReason(message: string | null) {
  if (!message) return '.';
  return /[.!?]$/.test(message) ? `: ${message}` : `: ${message}.`;
}
