import { ConvexError, v, type Infer } from 'convex/values';
import { internal } from './_generated/api';
import type { Doc } from './_generated/dataModel';
import {
  internalMutation,
  internalQuery,
  query,
  type MutationCtx,
} from './_generated/server';
import { organizationDeletionStateValidator } from './schema';
import { campaignMutation } from './lib/campaignRuntime';
import {
  countDeletionBlockers,
  deleteEmptyCampaign,
  hasSetAsideReturns,
  readCampaignCharactersWithin,
  maxCampaignCharacters,
  readCampaignDeletion,
  requireNoDeletionBlockers,
  startCampaignDeletion,
} from './lib/campaignDeletion';
import {
  driveLifecycleStage,
  type LifecycleStageWork,
} from './lib/lifecycleDriver';
import {
  isOrganizationDeleted,
  readOrganizationDeletion,
} from './lib/organizationDeletion';
import { gatedWebhookMutation, generalInternalMutation } from './lib/writeGate';
import type { ReadCtx } from './types';
import { hasAccessToOrg, revokeDeletedOrganizationMembership } from './user';

const driverArgs = {
  deletionId: v.id('organizationDeletion'),
  round: v.number(),
};
type DriveArgs = {
  deletionId: Doc<'organizationDeletion'>['_id'];
  round: number;
};
const stepResultValidator = v.union(
  v.literal('pending'),
  v.literal('done'),
  v.object({ waitMs: v.number() }),
);
type StepResult = Infer<typeof stepResultValidator>;

// Campaigns one organization may hold before its deletion refuses to go on.
const maxOrganizationCampaigns = 256;
// Memberships removed, and campaigns started or read, in one step.
const membershipBatch = 8;
const campaignBatch = 8;
// How often an organization deletion looks again for unfinished returns.
const returnPollMs = 60_000;

const statusValidator = v.object({
  state: organizationDeletionStateValidator,
  /** Campaigns not yet deleted. */
  campaignsRemaining: v.number(),
  /** Campaigns whose deletion waits for Characters to be assigned. */
  blockedCampaigns: v.number(),
});
type Status = Infer<typeof statusValidator>;

async function readCampaigns(ctx: ReadCtx, organizationId: string) {
  const campaigns = await ctx.db
    .query('campaign')
    .withIndex('by_organization', (q) => q.eq('organizationId', organizationId))
    .take(maxOrganizationCampaigns + 1);
  if (campaigns.length > maxOrganizationCampaigns)
    throw new ConvexError('Too many campaigns to delete');
  return campaigns;
}

/**
 * Characters that keep the organization's campaigns from being deleted,
 * counted within a read budget of one campaign's Character limit. Beyond it
 * the request goes on unchecked: each campaign deletion still refuses to
 * delete while a Character needs an owner, and pauses the organization's
 * deletion as `blocked`.
 */
async function countOrganizationBlockers(
  ctx: ReadCtx,
  campaigns: Doc<'campaign'>[],
) {
  const blockers = { ownerless: 0, unreturnable: 0 };
  let budget = maxCampaignCharacters;
  for (const campaign of campaigns) {
    const rows = await readCampaignCharactersWithin(ctx, campaign._id, budget);
    if (!rows) break;
    budget -= rows.length;
    const counts = countDeletionBlockers(rows);
    blockers.ownerless += counts.ownerless;
    blockers.unreturnable += counts.unreturnable;
  }
  return blockers;
}

/**
 * Record an organization deletion's next round, replacing any earlier one,
 * and start its driver.
 */
async function writeOrganizationDeletion(
  ctx: MutationCtx,
  organizationId: string,
  existing: Doc<'organizationDeletion'> | null,
  fields: Pick<
    Doc<'organizationDeletion'>,
    'state' | 'requestedBy' | 'deletedAt'
  >,
) {
  const round = (existing?.round ?? 0) + 1;
  const deletion = { organizationId, round, ...fields };
  if (existing)
    await ctx.db.replace('organizationDeletion', existing._id, deletion);
  const deletionId =
    existing?._id ?? (await ctx.db.insert('organizationDeletion', deletion));
  await ctx.scheduler.runAfter(0, internal.organizationDeletions.drive, {
    deletionId,
    round,
  });
  return deletionId;
}

async function readStatus(
  ctx: ReadCtx,
  deletion: Doc<'organizationDeletion'>,
): Promise<Status> {
  return {
    state: deletion.state,
    campaignsRemaining: (await readCampaigns(ctx, deletion.organizationId))
      .length,
    blockedCampaigns: deletion.blockedCampaigns ?? 0,
  };
}

/**
 * Ask to delete the organization (PRD 14). Only an admin can, because only an
 * admin can then delete it with the provider. Every campaign is deleted
 * first, each returning its Characters to their surviving owners; the
 * request is refused while any Character needs an owner. Once every campaign
 * is deleted the deletion is `ready` and the admin deletes the organization
 * with the provider, whose event completes it. Only organizations whose
 * campaigns are all prepared can be deleted this way until activation (#413).
 * A repeated request returns the deletion under way.
 */
export const request = campaignMutation({
  args: { organizationId: v.string() },
  returns: statusValidator,
  async handler(ctx, args): Promise<Status> {
    const access = await hasAccessToOrg(ctx, args.organizationId);
    if (!access) throw new ConvexError('You do not have access to this org');
    const membership = access.user.orgIds.find(
      (org) => org.orgId === args.organizationId,
    );
    if (membership?.role !== 'admin')
      throw new ConvexError('Only an organization admin can delete it');
    const existing = await readOrganizationDeletion(ctx, args.organizationId);
    if (existing && existing.state !== 'blocked')
      return readStatus(ctx, existing);
    const campaigns = await readCampaigns(ctx, args.organizationId);
    if (campaigns.some((campaign) => !campaign.e2eFixture))
      throw new ConvexError(
        "Deleting isn't available for this organization yet.",
      );
    requireNoDeletionBlockers(await countOrganizationBlockers(ctx, campaigns));
    const deletionId = await writeOrganizationDeletion(
      ctx,
      args.organizationId,
      existing,
      { state: 'preparing', requestedBy: access.user.tokenIdentifier },
    );
    // Campaign deletions blocked before start again now that none is blocked.
    for (const campaign of campaigns)
      if ((await readCampaignDeletion(ctx, campaign._id))?.state === 'blocked')
        await startCampaignDeletion(ctx, campaign, {
          requestedBy: access.user.tokenIdentifier,
          organizationDeletionId: deletionId,
        });
    const started = await ctx.db.get('organizationDeletion', deletionId);
    if (!started) throw new ConvexError('Organization deletion unavailable');
    return readStatus(ctx, started);
  },
});

/**
 * The organization's app-requested deletion as its current members see it,
 * or null when there is none or the viewer has no access. Once the provider
 * has deleted the organization nobody has access, so nothing is revealed.
 */
export const status = query({
  args: { organizationId: v.string() },
  returns: v.union(statusValidator, v.null()),
  async handler(ctx, args) {
    if (!(await hasAccessToOrg(ctx, args.organizationId))) return null;
    const deletion = await readOrganizationDeletion(ctx, args.organizationId);
    return deletion && readStatus(ctx, deletion);
  },
});

/**
 * Record the provider's deletion of an organization (#710). Every member's
 * access ends in this transaction, because access checks refuse a deleted
 * organization, and the deletion is final: provider organization IDs are
 * never reused, so a repeated or reordered event changes nothing. The driver
 * then removes each membership, which returns surviving owners' Characters
 * through the ordinary departure (#706), and keeps the rest for operator
 * recovery.
 */
export const recordProviderDeletion = gatedWebhookMutation({
  args: { organizationId: v.string() },
  returns: v.null(),
  async handler(ctx, args) {
    const existing = await readOrganizationDeletion(ctx, args.organizationId);
    if (existing?.deletedAt !== undefined) return null;
    await writeOrganizationDeletion(ctx, args.organizationId, existing, {
      state: 'revoking',
      requestedBy: existing?.requestedBy,
      deletedAt: Date.now(),
    });
    return null;
  },
});

/** An organization deletion's stages, in the shared driver's terms. */
function deletionWork(
  ctx: MutationCtx,
  deletion: Doc<'organizationDeletion'>,
): LifecycleStageWork<DriveArgs> {
  return {
    isCurrent:
      deletion.state === 'preparing' ||
      deletion.state === 'revoking' ||
      deletion.state === 'awaitingReturns' ||
      deletion.state === 'purging',
    async runStep(writeEpoch, transactionLimits) {
      const result: StepResult = await ctx.runMutation(
        internal.organizationDeletions.step,
        { deletionId: deletion._id, round: deletion.round, writeEpoch },
        { transactionLimits },
      );
      return result;
    },
    writeFailure: (lastFailure) =>
      ctx.db.patch('organizationDeletion', deletion._id, { lastFailure }),
    schedule: (args, delayMs = 0) =>
      ctx.scheduler.runAfter(
        delayMs,
        internal.organizationDeletions.drive,
        args,
      ),
  };
}

/**
 * Drives one organization deletion (#710), one bounded step per transaction.
 * An app request deletes every campaign through its campaign deletion and
 * becomes `ready` for the provider deletion. After the provider deletion it
 * removes every membership, waits for the resulting returns, then deletes
 * each prepared campaign left without Characters and keeps the others intact
 * as inaccessible operator recovery data.
 */
export const drive = internalMutation({
  args: driverArgs,
  returns: v.null(),
  async handler(ctx, args) {
    const deletion = await ctx.db.get('organizationDeletion', args.deletionId);
    // A run from an earlier round has nothing left to do.
    if (deletion?.round !== args.round) return null;
    await driveLifecycleStage(ctx, args, deletionWork(ctx, deletion));
    return null;
  },
});

/** Start each campaign's deletion, then wait for them to finish or block. */
async function prepare(
  ctx: MutationCtx,
  deletion: Doc<'organizationDeletion'>,
): Promise<StepResult> {
  const campaigns = await readCampaigns(ctx, deletion.organizationId);
  let started = 0;
  let blocked = 0;
  let returning = 0;
  for (const campaign of campaigns) {
    const campaignDeletion = await readCampaignDeletion(ctx, campaign._id);
    if (campaignDeletion) {
      // A campaign deletion members asked for earlier reports here too.
      if (campaignDeletion.organizationDeletionId !== deletion._id)
        await ctx.db.patch('campaignDeletion', campaignDeletion._id, {
          organizationDeletionId: deletion._id,
        });
      if (campaignDeletion.state === 'blocked') blocked += 1;
      else returning += 1;
    } else {
      if (started === campaignBatch) return 'pending';
      await startCampaignDeletion(ctx, campaign, {
        requestedBy: deletion.requestedBy,
        organizationDeletionId: deletion._id,
      });
      started += 1;
      returning += 1;
    }
  }
  if (!campaigns.length)
    await ctx.db.patch('organizationDeletion', deletion._id, {
      state: 'ready',
      blockedCampaigns: undefined,
    });
  else if (blocked && !returning)
    await ctx.db.patch('organizationDeletion', deletion._id, {
      state: 'blocked',
      blockedCampaigns: blocked,
    });
  // Each campaign deletion lets this one look again once it finishes or blocks.
  return 'done';
}

/** Remove a batch of the deleted organization's memberships. */
async function revoke(
  ctx: MutationCtx,
  deletion: Doc<'organizationDeletion'>,
): Promise<StepResult> {
  const memberships = await ctx.db
    .query('organizationMembership')
    .withIndex('by_organizationId_and_userId', (q) =>
      q.eq('organizationId', deletion.organizationId),
    )
    .take(membershipBatch);
  for (const membership of memberships)
    await revokeDeletedOrganizationMembership(ctx, membership);
  if (memberships.length < membershipBatch)
    await ctx.db.patch('organizationDeletion', deletion._id, {
      state: 'awaitingReturns',
    });
  return 'pending';
}

/** Wait until no departure from the organization is still returning. */
async function awaitReturns(
  ctx: MutationCtx,
  deletion: Doc<'organizationDeletion'>,
): Promise<StepResult> {
  const returning = await ctx.db
    .query('organizationDeparture')
    .withIndex('by_organizationId_and_state', (q) =>
      q.eq('organizationId', deletion.organizationId).eq('state', 'returning'),
    )
    .first();
  if (returning) return { waitMs: returnPollMs };
  await ctx.db.patch('organizationDeletion', deletion._id, {
    state: 'purging',
    cursor: null,
  });
  return 'pending';
}

/**
 * Delete a page of the organization's prepared campaigns that hold no
 * Characters. A campaign that still holds Characters, ownerless ones or
 * ones whose return keeps failing, is kept intact with its catalog and
 * militia data as inaccessible operator recovery data. A production campaign
 * keeps legacy authority until activation (#413), and a campaign whose own
 * deletion is under way finishes it.
 */
async function purgeCampaigns(
  ctx: MutationCtx,
  deletion: Doc<'organizationDeletion'>,
): Promise<StepResult> {
  const page = await ctx.db
    .query('campaign')
    .withIndex('by_organization', (q) =>
      q.eq('organizationId', deletion.organizationId),
    )
    .paginate({ cursor: deletion.cursor ?? null, numItems: campaignBatch });
  let recoveryRetained = deletion.recoveryRetained ?? 0;
  let legacyRetained = deletion.legacyRetained ?? 0;
  for (const campaign of page.page) {
    const campaignDeletion = await readCampaignDeletion(ctx, campaign._id);
    if (campaignDeletion) {
      // Its own deletion goes on; it keeps Characters for recovery while it
      // waits for owners or for returns that keep failing.
      if (
        campaignDeletion.state === 'blocked' ||
        (await hasSetAsideReturns(ctx, campaignDeletion._id))
      )
        recoveryRetained += 1;
      continue;
    }
    if (!campaign.e2eFixture) {
      legacyRetained += 1;
      continue;
    }
    const hasCharacters = await ctx.db
      .query('character')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign._id))
      .first();
    if (hasCharacters) {
      recoveryRetained += 1;
      continue;
    }
    const deletionId = await ctx.db.insert('campaignDeletion', {
      campaignId: campaign._id,
      organizationId: campaign.organizationId,
      campaignName: campaign.name,
      e2eFixture: campaign.e2eFixture,
      organizationDeletionId: deletion._id,
      round: 1,
      state: 'returning',
    });
    await deleteEmptyCampaign(ctx, { _id: deletionId, round: 1 }, campaign);
  }
  await ctx.db.patch('organizationDeletion', deletion._id, {
    ...(page.isDone ? { state: 'completed', cursor: undefined } : {}),
    ...(page.isDone ? {} : { cursor: page.continueCursor }),
    ...(recoveryRetained ? { recoveryRetained } : {}),
    ...(legacyRetained ? { legacyRetained } : {}),
  });
  return page.isDone ? 'done' : 'pending';
}

/**
 * One bounded step of an organization deletion. It rechecks the deletion's
 * round and state, then advances its current stage.
 */
export const step = generalInternalMutation({
  args: driverArgs,
  returns: stepResultValidator,
  async handler(ctx, args): Promise<StepResult> {
    const deletion = await ctx.db.get('organizationDeletion', args.deletionId);
    if (deletion?.round !== args.round) return 'done';
    switch (deletion.state) {
      case 'preparing':
        return prepare(ctx, deletion);
      case 'revoking':
        return revoke(ctx, deletion);
      case 'awaitingReturns':
        return awaitReturns(ctx, deletion);
      case 'purging':
        return purgeCampaigns(ctx, deletion);
      default:
        return 'done';
    }
  },
});

/**
 * Operator recovery (#710): the Characters a deleted organization's campaigns
 * still hold, ownerless or set aside, with the campaign kept around them.
 * Internal only: no user, former member included, can reach them.
 */
export const listRecovery = internalQuery({
  args: { organizationId: v.string() },
  returns: v.array(
    v.object({
      campaignId: v.id('campaign'),
      campaignName: v.string(),
      characters: v.array(
        v.object({
          characterId: v.id('character'),
          name: v.string(),
          ownerId: v.union(v.string(), v.null()),
        }),
      ),
    }),
  ),
  async handler(ctx, args) {
    if (!(await isOrganizationDeleted(ctx, args.organizationId))) return [];
    const recovery = [];
    for (const campaign of await readCampaigns(ctx, args.organizationId)) {
      const characters = await ctx.db
        .query('character')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign._id))
        .take(4096);
      if (characters.length)
        recovery.push({
          campaignId: campaign._id,
          campaignName: campaign.name,
          characters: characters.map((character) => ({
            characterId: character._id,
            name: character.name,
            ownerId: character.ownerId ?? null,
          })),
        });
    }
    return recovery;
  },
});
