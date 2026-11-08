import { ConvexError, v } from 'convex/values';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { internalMutation, type MutationCtx } from './_generated/server';
import { fenceUnfinishedMove } from './characterMoves';
import {
  accountDeletionOperation,
  readAccountDeletionFailure,
} from './lib/accountDeletion';
import { deleteCharacterSheet } from './lib/characterSheet';
import { driveLifecycle, type LifecycleWork } from './lib/lifecycleDriver';
import { gatedInternalMutation } from './lib/writeGate';

type DriveArgs = {
  deletionId: Id<'accountDeletion'>;
  characterId?: Id<'character'>;
};

// Characters one owner may hold before the deletion refuses to go on.
const maxOwnedCharacters = 4096;

/**
 * Whether members can assign the Character's owner, so it stays ownerless
 * for them: any Character in a prepared campaign, flat or sheet, as
 * `character.reassignOwner` allows. This is deliberately wider than a
 * departure's `isReturnableSheet`: a departure must move the Character, which
 * needs a prepared sheet, while a deleted account can't keep owning anything.
 * A production campaign keeps legacy authority, and its Characters their
 * stored owner, until activation (#413).
 */
function isOwnerAssignable(campaign: Doc<'campaign'> | null) {
  return Boolean(campaign?.e2eFixture);
}

/**
 * The next of the deleted owner's Characters the main pass should handle,
 * skipping those set aside. Handled Characters leave the owner's index, as
 * ownerless or deleted, so only legacy and set-aside ones are read again.
 * With none left, it completes the deletion.
 */
async function nextCharacterOrComplete(
  ctx: MutationCtx,
  deletion: Doc<'accountDeletion'>,
) {
  const campaigns = new Map<Id<'campaign'>, Doc<'campaign'> | null>();
  let legacyRetained = 0;
  let read = 0;
  for await (const character of ctx.db
    .query('character')
    .withIndex('by_ownerId_and_campaignId', (q) =>
      q.eq('ownerId', deletion.tokenIdentifier),
    )) {
    if (++read > maxOwnedCharacters)
      throw new ConvexError('Too many Characters to handle');
    const campaignId = character.campaignId;
    if (campaignId) {
      if (!campaigns.has(campaignId))
        campaigns.set(campaignId, await ctx.db.get('campaign', campaignId));
      if (!isOwnerAssignable(campaigns.get(campaignId) ?? null)) {
        legacyRetained += 1;
        continue;
      }
    }
    const failure = await readAccountDeletionFailure(
      ctx,
      deletion._id,
      character._id,
    );
    if (!failure?.setAside) return character._id;
  }
  await ctx.db.patch('accountDeletion', deletion._id, {
    state: 'completed',
    ...(legacyRetained ? { legacyRetained } : {}),
  });
  return null;
}

/** An account deletion's Character work, in the shared driver's terms. */
function deletionWork(
  ctx: MutationCtx,
  deletion: Doc<'accountDeletion'>,
): LifecycleWork<DriveArgs, Doc<'accountDeletionCharacter'>> {
  return {
    isPassCurrent: deletion.state === 'deleting',
    nextCharacterOrComplete: () => nextCharacterOrComplete(ctx, deletion),
    async runStep(characterId, writeEpoch, transactionLimits) {
      await ctx.runMutation(
        internal.accountDeletions.step,
        { deletionId: deletion._id, characterId, writeEpoch },
        { transactionLimits },
      );
      return 'done';
    },
    readFailure: (characterId) =>
      readAccountDeletionFailure(ctx, deletion._id, characterId),
    async writeFailure(characterId, failure, existing) {
      const record = { deletionId: deletion._id, characterId, ...failure };
      if (existing)
        await ctx.db.replace('accountDeletionCharacter', existing._id, record);
      else await ctx.db.insert('accountDeletionCharacter', record);
    },
    clearFailure: (existing) =>
      ctx.db.delete('accountDeletionCharacter', existing._id),
    schedule: (args, delayMs = 0) =>
      ctx.scheduler.runAfter(delayMs, internal.accountDeletions.drive, args),
  };
}

/**
 * Drives one account deletion's Character work, one Character per
 * transaction (#708). The main pass handles the deleted owner's Characters one
 * at a time; with a `characterId` it is the slower retry of one Character set
 * aside after repeated failed steps. Each step runs as a nested transaction
 * under the legacy Character Write Gate with the current epoch and rechecks
 * the Character's owner, so it is never a stale command. A failed step rolls
 * back alone and is recorded on its Character.
 */
export const drive = internalMutation({
  args: {
    deletionId: v.id('accountDeletion'),
    characterId: v.optional(v.id('character')),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const deletion = await ctx.db.get('accountDeletion', args.deletionId);
    if (deletion) await driveLifecycle(ctx, args, deletionWork(ctx, deletion));
    return null;
  },
});

/**
 * One deleted owner's Character (PRD 14). In a prepared campaign it stays,
 * ownerless and editable by the remaining members, until one of them takes
 * or assigns it; its sheet, definitions and state stay as they are. Outside a
 * campaign it is deleted with its own definitions. A Character whose owner has
 * since changed, or that is already gone, needs nothing.
 */
export const step = gatedInternalMutation({
  args: {
    deletionId: v.id('accountDeletion'),
    characterId: v.id('character'),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const [deletion, character] = await Promise.all([
      ctx.db.get('accountDeletion', args.deletionId),
      ctx.db.get('character', args.characterId),
    ]);
    if (!deletion || character?.ownerId !== deletion.tokenIdentifier)
      return null;
    const operationId = accountDeletionOperation(deletion._id);
    if (!character.campaignId) {
      await deleteCharacterSheet(ctx, character._id, operationId);
      return null;
    }
    const campaign = await ctx.db.get('campaign', character.campaignId);
    if (!isOwnerAssignable(campaign)) return null;
    await ctx.db.patch('character', character._id, {
      ownerId: undefined,
      ownerLastOperationId: operationId,
    });
    await fenceUnfinishedMove(ctx, character._id);
    return null;
  },
});
