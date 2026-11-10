import { ConvexError } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import { internal } from '../_generated/api';
import type { MutationCtx } from '../_generated/server';
import type { ReadCtx } from '../types';
import { getUserByTokenIdentifier } from '../user';

/**
 * Who a campaign deletion's returns are attributed to: neither the owner, who
 * didn't make them, nor the member who asked for the deletion.
 */
export const campaignDeletionActor = 'system:campaignDeletion';

// Characters one campaign may hold before its deletion refuses to go on, as
// for the campaign's Character lists.
export const maxCampaignCharacters = 4096;

export function readCampaignDeletion(ctx: ReadCtx, campaignId: Id<'campaign'>) {
  return ctx.db
    .query('campaignDeletion')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
    .unique();
}

/** Whether a Character's return in the deletion keeps failing. */
export async function hasSetAsideReturns(
  ctx: ReadCtx,
  deletionId: Id<'campaignDeletion'>,
) {
  return Boolean(
    await ctx.db
      .query('campaignDeletionCharacter')
      .withIndex('by_deletionId_and_setAside', (q) =>
        q.eq('deletionId', deletionId).eq('setAside', true),
      )
      .first(),
  );
}

export function readCampaignDeletionFailure(
  ctx: ReadCtx,
  deletionId: Id<'campaignDeletion'>,
  characterId: Id<'character'>,
) {
  return ctx.db
    .query('campaignDeletionCharacter')
    .withIndex('by_deletionId_and_characterId', (q) =>
      q.eq('deletionId', deletionId).eq('characterId', characterId),
    )
    .unique();
}

/**
 * Whether a campaign deletion can return the Character: a prepared sheet,
 * because only those move through the #703 machinery, as for a departure's
 * `isReturnableSheet`. Deletion is only offered for prepared campaigns.
 */
function isReturnableSheet(character: Doc<'character'>) {
  return Boolean(character.sheetMode);
}

/**
 * How a campaign deletion treats one Character. `ownerless` and
 * `unreturnable` Characters block it: one with no surviving owner must be
 * assigned first, and a legacy flat Character can't be returned.
 */
export type CampaignCharacterDisposition =
  | { kind: 'returnable'; owner: Doc<'user'> }
  | { kind: 'ownerless' }
  | { kind: 'unreturnable' };

/**
 * Every Character in the campaign with how its deletion treats it. A
 * Character whose owner's account is gone counts as ownerless at once, before
 * account-deletion work removes its owner (#708).
 */
export async function readCampaignCharacters(
  ctx: ReadCtx,
  campaignId: Id<'campaign'>,
) {
  const rows = await readCampaignCharactersWithin(
    ctx,
    campaignId,
    maxCampaignCharacters,
  );
  if (!rows) throw new ConvexError('Too many Characters to return');
  return rows;
}

/**
 * The campaign's Characters with their dispositions, or null when it holds
 * more than `limit`, so a caller with a read budget can stop.
 */
export async function readCampaignCharactersWithin(
  ctx: ReadCtx,
  campaignId: Id<'campaign'>,
  limit: number,
) {
  const characters = await ctx.db
    .query('character')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
    .take(limit + 1);
  if (characters.length > limit) return null;
  const owners = new Map<string, Doc<'user'> | null>();
  const rows: {
    character: Doc<'character'>;
    disposition: CampaignCharacterDisposition;
  }[] = [];
  for (const character of characters) {
    const ownerId = character.ownerId;
    if (ownerId && !owners.has(ownerId))
      owners.set(ownerId, await getUserByTokenIdentifier(ctx, ownerId));
    const owner = ownerId ? owners.get(ownerId) : null;
    rows.push({
      character,
      disposition: !owner
        ? { kind: 'ownerless' }
        : isReturnableSheet(character)
          ? { kind: 'returnable', owner }
          : { kind: 'unreturnable' },
    });
  }
  return rows;
}

/** How many Characters keep the campaign's deletion from going on. */
export function countDeletionBlockers(
  rows: NonNullable<Awaited<ReturnType<typeof readCampaignCharactersWithin>>>,
) {
  return {
    ownerless: rows.filter((row) => row.disposition.kind === 'ownerless')
      .length,
    unreturnable: rows.filter((row) => row.disposition.kind === 'unreturnable')
      .length,
  };
}

/** Refuse a deletion while any Character keeps it from going on. */
export function requireNoDeletionBlockers(blockers: {
  ownerless: number;
  unreturnable: number;
}) {
  if (blockers.ownerless === 0 && blockers.unreturnable === 0) return;
  const parts = [];
  if (blockers.ownerless)
    parts.push(
      blockers.ownerless === 1
        ? '1 Character needs an owner'
        : `${blockers.ownerless} Characters need an owner`,
    );
  if (blockers.unreturnable)
    parts.push(
      blockers.unreturnable === 1
        ? "1 Character can't be returned to its owner yet"
        : `${blockers.unreturnable} Characters can't be returned to their owners yet`,
    );
  throw new ConvexError({
    code: 'DELETION_BLOCKED',
    message: `${parts.join(' and ')}.`,
    ...blockers,
  });
}

/**
 * Start, or after a block restart, a campaign's deletion (#710): a new round
 * of trusted returns, after which the driver deletes the campaign. A deletion
 * already under way, or done, changes nothing.
 */
export async function startCampaignDeletion(
  ctx: MutationCtx,
  campaign: Doc<'campaign'>,
  {
    requestedBy,
    organizationDeletionId,
  }: {
    requestedBy?: string;
    organizationDeletionId?: Id<'organizationDeletion'>;
  },
) {
  const existing = await readCampaignDeletion(ctx, campaign._id);
  if (existing && existing.state !== 'blocked') return existing._id;
  const round = (existing?.round ?? 0) + 1;
  const deletion = {
    campaignId: campaign._id,
    organizationId: campaign.organizationId,
    campaignName: campaign.name,
    e2eFixture: campaign.e2eFixture,
    organizationDeletionId:
      organizationDeletionId ?? existing?.organizationDeletionId,
    requestedBy,
    round,
    state: 'returning' as const,
  };
  const deletionId = existing?._id;
  if (deletionId) {
    await ctx.db.replace('campaignDeletion', deletionId, deletion);
    // A new round starts every Character afresh.
    const failures = await ctx.db
      .query('campaignDeletionCharacter')
      .withIndex('by_deletionId_and_characterId', (q) =>
        q.eq('deletionId', deletionId),
      )
      .take(1024);
    for (const failure of failures)
      await ctx.db.delete('campaignDeletionCharacter', failure._id);
  }
  const id = deletionId ?? (await ctx.db.insert('campaignDeletion', deletion));
  await ctx.scheduler.runAfter(0, internal.campaignDeletions.drive, {
    deletionId: id,
    round,
  });
  return id;
}

/**
 * Delete the campaign once it holds no Characters (#710). The campaign row
 * goes at once, so every campaign read and write refuses it from then on, and
 * the deletion keeps what read-only access to its history needs. The driver
 * then clears the campaign's live militia and catalog data in bounded steps.
 */
export async function deleteEmptyCampaign(
  ctx: MutationCtx,
  deletion: Pick<Doc<'campaignDeletion'>, '_id' | 'round'>,
  campaign: Doc<'campaign'>,
) {
  if (
    await ctx.db
      .query('character')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign._id))
      .first()
  )
    throw new ConvexError('The campaign still has Characters');
  const militia = await ctx.db
    .query('militia')
    .withIndex('by_campaign', (q) => q.eq('campaignId', campaign._id))
    .unique();
  await ctx.db.delete('campaign', campaign._id);
  await ctx.db.patch('campaignDeletion', deletion._id, {
    state: 'purging',
    militiaId: militia?._id,
    purgeStage: 0,
    blockers: undefined,
    deletedAt: Date.now(),
  });
  await ctx.scheduler.runAfter(0, internal.campaignDeletions.drive, {
    deletionId: deletion._id,
    round: deletion.round,
  });
}

/**
 * Let an app-requested organization deletion re-evaluate once one of its
 * campaigns is deleted or blocked.
 */
export async function notifyOrganizationDeletion(
  ctx: MutationCtx,
  deletion: Pick<Doc<'campaignDeletion'>, 'organizationDeletionId'>,
) {
  const organizationDeletion =
    deletion.organizationDeletionId &&
    (await ctx.db.get('organizationDeletion', deletion.organizationDeletionId));
  if (organizationDeletion?.state === 'preparing')
    await ctx.scheduler.runAfter(0, internal.organizationDeletions.drive, {
      deletionId: organizationDeletion._id,
      round: organizationDeletion.round,
    });
}
