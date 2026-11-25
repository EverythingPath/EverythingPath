import type { Id } from '../_generated/dataModel';
import { internal } from '../_generated/api';
import type { MutationCtx } from '../_generated/server';
import type { ReadCtx } from '../types';

/**
 * The operation a deleted account's Character changes are recorded under:
 * neither the deleted owner, who didn't make them, nor a member.
 */
export function accountDeletionOperation(deletionId: Id<'accountDeletion'>) {
  return `system:accountDeletion:${deletionId}`;
}

/** The deletion of the account with this token, once it is known. */
export function readAccountDeletion(ctx: ReadCtx, tokenIdentifier: string) {
  return ctx.db
    .query('accountDeletion')
    .withIndex('by_tokenIdentifier', (q) =>
      q.eq('tokenIdentifier', tokenIdentifier),
    )
    .unique();
}

export function readAccountDeletionFailure(
  ctx: ReadCtx,
  deletionId: Id<'accountDeletion'>,
  characterId: Id<'character'>,
) {
  return ctx.db
    .query('accountDeletionCharacter')
    .withIndex('by_deletionId_and_characterId', (q) =>
      q.eq('deletionId', deletionId).eq('characterId', characterId),
    )
    .unique();
}

/**
 * Record a known account deletion and start its Character work (PRD 14). The
 * caller has already removed the account, which revokes its access at once.
 * A repeated deletion changes nothing.
 */
export async function startAccountDeletion(
  ctx: MutationCtx,
  tokenIdentifier: string,
) {
  if (await readAccountDeletion(ctx, tokenIdentifier)) return;
  const deletionId = await ctx.db.insert('accountDeletion', {
    tokenIdentifier,
    state: 'deleting',
  });
  await ctx.scheduler.runAfter(0, internal.accountDeletions.drive, {
    deletionId,
  });
}
