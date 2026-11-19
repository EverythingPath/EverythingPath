import { v } from 'convex/values';
import type { Doc } from '../_generated/dataModel';
import type { ReadCtx } from '../types';
import { getUserByTokenIdentifier } from '../user';

export const characterOwnerValidator = v.object({
  userId: v.id('user'),
  name: v.string(),
  isMine: v.boolean(),
});

export function projectOwner(user: Doc<'user'>, actor?: string) {
  const trimmedName = user.name?.trim() ?? '';
  return {
    userId: user._id,
    name: trimmedName.length > 0 ? trimmedName : 'Unnamed member',
    isMine: user.tokenIdentifier === actor,
  };
}

async function readOwnerUsers(ctx: ReadCtx, characters: Doc<'character'>[]) {
  const ownerIds = new Set(
    characters.flatMap((character) =>
      character.ownerId ? [character.ownerId] : [],
    ),
  );
  return new Map(
    await Promise.all(
      [...ownerIds].map(
        async (ownerId) =>
          [ownerId, await getUserByTokenIdentifier(ctx, ownerId)] as const,
      ),
    ),
  );
}

async function readActor(ctx: ReadCtx, actor?: string) {
  return actor ?? (await ctx.auth.getUserIdentity())?.tokenIdentifier;
}

export async function readCharacterOwners(
  ctx: ReadCtx,
  characters: Doc<'character'>[],
  actor?: string,
) {
  const identity = await readActor(ctx, actor);
  const users = await readOwnerUsers(ctx, characters);
  return new Map(
    [...users].map(([ownerId, user]) => [
      ownerId,
      user ? projectOwner(user, identity) : null,
    ]),
  );
}

/**
 * Each owner's projection, and whether their account survives without
 * membership of the campaign's organization (#706).
 */
export async function readCampaignCharacterOwners(
  ctx: ReadCtx,
  characters: Doc<'character'>[],
  organizationId: string,
) {
  const identity = await readActor(ctx);
  const users = await readOwnerUsers(ctx, characters);
  return new Map(
    [...users].map(([ownerId, user]) => [
      ownerId,
      {
        owner: user ? projectOwner(user, identity) : null,
        departed: Boolean(
          user && !user.orgIds.some((org) => org.orgId === organizationId),
        ),
      },
    ]),
  );
}
