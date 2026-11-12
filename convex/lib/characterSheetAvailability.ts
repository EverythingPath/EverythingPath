import { ConvexError } from 'convex/values';
import type { QueryCtx } from '../_generated/server';
import {
  areCharacterSheetsAvailable,
  type CharacterAuthority,
  type CharacterSheetSubject,
} from '../../src/lib/character-sheet-availability';
import { readWriteGate } from './writeGate';

const authorityByTransaction = new WeakMap<
  object,
  Promise<CharacterAuthority>
>();

/**
 * A missing control row means legacy authority, as in the Write Gate. One
 * function reads it once: gates run per Character, and a capped group move
 * must stay within Convex's index-range limit. Only the initial migration's
 * own commands write the control row, and they never ask this.
 */
export function readCharacterAuthority(
  ctx: Pick<QueryCtx, 'db'>,
): Promise<CharacterAuthority> {
  const cached = authorityByTransaction.get(ctx.db);
  if (cached) return cached;
  const authority = readWriteGate(ctx).then(
    (control) => control?.authority ?? 'legacy',
  );
  authorityByTransaction.set(ctx.db, authority);
  return authority;
}

/**
 * Reads the authority once and returns the decision for any subject, for
 * gates that decide for several Characters or campaigns in one function.
 */
export async function readCharacterSheetAvailability(
  ctx: Pick<QueryCtx, 'db'>,
) {
  const authority = await readCharacterAuthority(ctx);
  return (subject: CharacterSheetSubject) =>
    areCharacterSheetsAvailable(authority, subject);
}

export async function isCharacterSheetAvailable(
  ctx: Pick<QueryCtx, 'db'>,
  subject: CharacterSheetSubject,
) {
  return (await readCharacterSheetAvailability(ctx))(subject);
}

/** Refuses with the gate's own message where the builder is closed. */
export async function requireCharacterSheetAvailable(
  ctx: Pick<QueryCtx, 'db'>,
  subject: CharacterSheetSubject,
  message: string,
) {
  if (!(await isCharacterSheetAvailable(ctx, subject)))
    throw new ConvexError(message);
}

export const campaignSheetsUnavailable =
  "Character sheets aren't available for this campaign yet.";
