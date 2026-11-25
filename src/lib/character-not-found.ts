import { ConvexError } from 'convex/values';

/**
 * The refusal for a Character the reader can't open, shared by the backend
 * and the client. A Character that never existed, one deleted, and one
 * returned to its owner's private Characters all read this way, so nothing
 * about the Character or its owner is told.
 */
export const characterNotFound = 'Character not found';

/** Whether a read failed with the shared Character refusal. */
export function isCharacterNotFound(error: unknown) {
  if (error instanceof ConvexError) return error.data === characterNotFound;
  return error instanceof Error && error.message === characterNotFound;
}
