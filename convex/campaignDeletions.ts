import { ConvexError, v, type Infer } from 'convex/values';
import {
  paginationOptsValidator,
  paginationResultValidator,
} from 'convex/server';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { internalMutation, query, type MutationCtx } from './_generated/server';
import { advanceCampaignDeletionReturn } from './characterMoves';
import {
  campaignDeletionStateValidator,
  deletionBlockersValidator,
} from './schema';
import { campaignMutation } from './lib/campaignRuntime';
import {
  countDeletionBlockers,
  deleteEmptyCampaign,
  maxCampaignCharacters,
  notifyOrganizationDeletion,
  readCampaignCharacters,
  readCampaignDeletion,
  readCampaignDeletionFailure,
  requireNoDeletionBlockers,
  startCampaignDeletion,
} from './lib/campaignDeletion';
import { requireCharacterCampaignAccess } from './lib/characterAccess';
import { requireFixtureCampaign } from './lib/characterSheet';
import {
  driveLifecycle,
  readLifecycleReturnCandidate,
  readLifecycleReturnRoot,
  driveLifecycleStage,
  slowRetryMs,
  type LifecycleStageWork,
  type LifecycleWork,
} from './lib/lifecycleDriver';
import { gatedInternalMutation } from './lib/writeGate';
import type { ReadCtx } from './types';
import { getUserByTokenIdentifier, hasAccessToOrg } from './user';

// Deleted campaigns one page of `list` may hold.
const maxListPage = 100;

const driverArgs = {
  deletionId: v.id('campaignDeletion'),
  round: v.number(),
};
type DriveArgs = {
  deletionId: Id<'campaignDeletion'>;
  round: number;
  characterId?: Id<'character'>;
};
const stepResultValidator = v.object({
  state: v.union(v.literal('returning'), v.literal('done')),
});
type StepResult = Infer<typeof stepResultValidator>;

const statusValidator = v.object({
  campaignId: v.id('campaign'),
  campaignName: v.string(),
  state: campaignDeletionStateValidator,
  /** Characters still in the campaign while their returns go on. */
  remaining: v.number(),
  /** Characters whose return keeps failing; they are retried later. */
  setAside: v.number(),
  blockers: v.union(deletionBlockersValidator, v.null()),
  deletedAt: v.union(v.number(), v.null()),
  /** Whether the campaign kept finished weeks to read. */
  hasHistory: v.boolean(),
});
type Status = Infer<typeof statusValidator>;

async function hasHistory(ctx: ReadCtx, campaignId: Id<'campaign'>) {
  return Boolean(
    await ctx.db
      .query('canonicalResolutionRecord')
      .withIndex('by_campaignId_and_week_and_sequence', (q) =>
        q.eq('campaignId', campaignId),
      )
      .first(),
  );
}

async function readStatus(
  ctx: ReadCtx,
  deletion: Doc<'campaignDeletion'>,
): Promise<Status> {
  const isGone = deletion.state === 'purging' || deletion.state === 'deleted';
  const [characters, setAside] = isGone
    ? [[], []]
    : await Promise.all([
        ctx.db
          .query('character')
          .withIndex('by_campaignId', (q) =>
            q.eq('campaignId', deletion.campaignId),
          )
          .take(maxCampaignCharacters),
        ctx.db
          .query('campaignDeletionCharacter')
          .withIndex('by_deletionId_and_setAside', (q) =>
            q.eq('deletionId', deletion._id).eq('setAside', true),
          )
          .take(maxCampaignCharacters),
      ]);
  return {
    campaignId: deletion.campaignId,
    campaignName: deletion.campaignName,
    state: deletion.state,
    remaining: characters.length,
    setAside: setAside.length,
    blockers: deletion.blockers ?? null,
    deletedAt: deletion.deletedAt ?? null,
    hasHistory: isGone && (await hasHistory(ctx, deletion.campaignId)),
  };
}

/**
 * Ask to delete a campaign (PRD 14). Any member can. Every Character with a
 * surviving owner first returns to them, outside any campaign; the request is
 * refused while a Character needs an owner, so members assign it first. The
 * campaign is then deleted, and its finished weeks stay readable to the
 * organization's current members. Only prepared campaigns can be deleted:
 * production campaigns keep legacy authority until activation (#413). A
 * repeated request returns the deletion under way.
 */
export const request = campaignMutation({
  args: {
    campaignId: v.id('campaign'),
    organizationId: v.optional(v.string()),
  },
  returns: statusValidator,
  async handler(ctx, args): Promise<Status> {
    const existing = await readCampaignDeletion(ctx, args.campaignId);
    // A lost reply's retry after the campaign is gone gets its deletion.
    if (
      existing &&
      (existing.state === 'purging' || existing.state === 'deleted') &&
      (!args.organizationId ||
        args.organizationId === existing.organizationId) &&
      (await hasAccessToOrg(ctx, existing.organizationId))
    )
      return readStatus(ctx, existing);
    const { campaign, access } = await requireCharacterCampaignAccess(
      ctx,
      args,
    );
    requireFixtureCampaign(
      campaign,
      "Deleting isn't available for this campaign yet.",
    );
    if (!existing || existing.state === 'blocked')
      requireNoDeletionBlockers(
        countDeletionBlockers(await readCampaignCharacters(ctx, campaign._id)),
      );
    const deletionId = await startCampaignDeletion(ctx, campaign, {
      requestedBy: access.user.tokenIdentifier,
    });
    const deletion = await ctx.db.get('campaignDeletion', deletionId);
    if (!deletion) throw new ConvexError('Campaign deletion unavailable');
    return readStatus(ctx, deletion);
  },
});

/**
 * A campaign's deletion as its organization's current members see it, or
 * null when there is none or the viewer has no access, so nothing is
 * revealed to anyone else.
 */
export const status = query({
  args: { campaignId: v.id('campaign') },
  returns: v.union(statusValidator, v.null()),
  async handler(ctx, args) {
    const deletion = await readCampaignDeletion(ctx, args.campaignId);
    if (!deletion || !(await hasAccessToOrg(ctx, deletion.organizationId)))
      return null;
    return readStatus(ctx, deletion);
  },
});

/**
 * The organization's deleted campaigns, a page at a time, for its current
 * members, so their history stays reachable. A campaign still returning its
 * Characters stays in the live campaign list instead; an empty page answers
 * anyone without access.
 */
export const list = query({
  args: { organizationId: v.string(), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(statusValidator),
  async handler(ctx, args) {
    const { numItems } = args.paginationOpts;
    if (
      !Number.isSafeInteger(numItems) ||
      numItems < 1 ||
      numItems > maxListPage
    )
      throw new ConvexError(`Choose a page size from 1 to ${maxListPage}`);
    if (!(await hasAccessToOrg(ctx, args.organizationId)))
      return { page: [], isDone: true, continueCursor: '' };
    // `deleted` and `purging` sort together, between `blocked` and
    // `returning`, so one index range holds the deleted campaigns.
    const page = await ctx.db
      .query('campaignDeletion')
      .withIndex('by_organizationId_and_state', (q) =>
        q
          .eq('organizationId', args.organizationId)
          .gte('state', 'deleted')
          .lte('state', 'purging'),
      )
      .paginate(args.paginationOpts);
    return {
      ...page,
      page: await Promise.all(
        page.page.map((deletion) => readStatus(ctx, deletion)),
      ),
    };
  },
});

/**
 * The next Character the main pass should return, skipping those set aside.
 * With none left, it either blocks the deletion until members assign owners,
 * waits for set-aside Characters, or deletes the now empty campaign.
 */
async function nextReturnOrFinish(
  ctx: MutationCtx,
  deletion: Doc<'campaignDeletion'>,
) {
  const campaign = await ctx.db.get('campaign', deletion.campaignId);
  if (!campaign) throw new ConvexError('Campaign unavailable');
  const rows = await readCampaignCharacters(ctx, campaign._id);
  let setAside = 0;
  const roots = new Map<Id<'character'>, Doc<'character'>>();
  for (const { character, disposition } of rows) {
    if (disposition.kind !== 'returnable') continue;
    const root = await readLifecycleReturnCandidate(ctx, character, roots);
    const failure = await readCampaignDeletionFailure(
      ctx,
      deletion._id,
      root._id,
    );
    if (!failure?.setAside) return root._id;
    setAside += 1;
  }
  const blockers = countDeletionBlockers(rows);
  if (blockers.ownerless || blockers.unreturnable) {
    await ctx.db.patch('campaignDeletion', deletion._id, {
      state: 'blocked',
      blockers,
    });
    await notifyOrganizationDeletion(ctx, deletion);
    return null;
  }
  // Set-aside Characters retry on their own; the pass looks again later.
  if (setAside) {
    await ctx.scheduler.runAfter(
      slowRetryMs,
      internal.campaignDeletions.drive,
      {
        deletionId: deletion._id,
        round: deletion.round,
      },
    );
    return null;
  }
  await deleteEmptyCampaign(ctx, deletion, campaign);
  await notifyOrganizationDeletion(ctx, deletion);
  return null;
}

/** A campaign deletion's trusted returns, in the shared driver's terms. */
function returnWork(
  ctx: MutationCtx,
  deletion: Doc<'campaignDeletion'>,
): LifecycleWork<DriveArgs, Doc<'campaignDeletionCharacter'>> {
  return {
    isPassCurrent: deletion.state === 'returning',
    nextCharacterOrComplete: () => nextReturnOrFinish(ctx, deletion),
    async runStep(characterId, writeEpoch, transactionLimits) {
      const result: StepResult = await ctx.runMutation(
        internal.campaignDeletions.step,
        {
          deletionId: deletion._id,
          round: deletion.round,
          characterId,
          writeEpoch,
        },
        { transactionLimits },
      );
      return result.state === 'done' ? 'done' : 'pending';
    },
    readFailure: (characterId) =>
      readCampaignDeletionFailure(ctx, deletion._id, characterId),
    async writeFailure(characterId, failure, existing) {
      const record = { deletionId: deletion._id, characterId, ...failure };
      if (existing)
        await ctx.db.replace('campaignDeletionCharacter', existing._id, record);
      else await ctx.db.insert('campaignDeletionCharacter', record);
    },
    clearFailure: (existing) =>
      ctx.db.delete('campaignDeletionCharacter', existing._id),
    schedule: (args, delayMs = 0) =>
      ctx.scheduler.runAfter(delayMs, internal.campaignDeletions.drive, args),
  };
}

/** A deleted campaign's live data clearance, in the shared driver's terms. */
function purgeWork(
  ctx: MutationCtx,
  deletion: Doc<'campaignDeletion'>,
): LifecycleStageWork<DriveArgs> {
  return {
    isCurrent: deletion.state === 'purging',
    async runStep(writeEpoch, transactionLimits) {
      const state: 'purging' | 'deleted' = await ctx.runMutation(
        internal.campaignDeletions.purge,
        { deletionId: deletion._id, round: deletion.round, writeEpoch },
        { transactionLimits },
      );
      return state === 'deleted' ? 'done' : 'pending';
    },
    writeFailure: (lastFailure) =>
      ctx.db.patch('campaignDeletion', deletion._id, { lastFailure }),
    schedule: (args, delayMs = 0) =>
      ctx.scheduler.runAfter(delayMs, internal.campaignDeletions.drive, args),
  };
}

/**
 * Drives one campaign deletion (#710), one bounded step per transaction. The
 * main pass returns each Character with a surviving owner to them through
 * the #703 move machinery; with a `characterId` it is the slower retry of one
 * Character set aside after repeated failed steps. Once the campaign holds no
 * Characters it is deleted, and the driver clears its live data. Each step
 * runs as a nested transaction under the Write Gate with the current epoch
 * and rechecks the deletion, the Character and its owner, so it is never a
 * stale command.
 */
export const drive = internalMutation({
  args: { ...driverArgs, characterId: v.optional(v.id('character')) },
  returns: v.null(),
  async handler(ctx, args) {
    const deletion = await ctx.db.get('campaignDeletion', args.deletionId);
    // A run from an earlier round has nothing left to do.
    if (deletion?.round !== args.round) return null;
    if (deletion.state === 'purging' && !args.characterId)
      await driveLifecycleStage(ctx, args, purgeWork(ctx, deletion));
    else await driveLifecycle(ctx, args, returnWork(ctx, deletion));
    return null;
  },
});

/**
 * One bounded unit of a Character's return before its campaign is deleted: a
 * discovery page, staging batch or publication. It rechecks that the
 * deletion is returning, that the Character is still in the campaign and
 * that its current owner's account survives, and reports `done` once the
 * Character needs nothing more. The return goes to whoever owns the
 * Character now, so a stale job cannot undo a reassignment.
 */
export const step = gatedInternalMutation({
  args: { ...driverArgs, characterId: v.id('character') },
  returns: stepResultValidator,
  async handler(ctx, args): Promise<StepResult> {
    const [deletion, character] = await Promise.all([
      ctx.db.get('campaignDeletion', args.deletionId),
      ctx.db.get('character', args.characterId),
    ]);
    if (
      deletion?.round !== args.round ||
      deletion.state !== 'returning' ||
      character?.campaignId !== deletion.campaignId ||
      !character.ownerId ||
      !character.sheetMode
    )
      return { state: 'done' };
    const [campaign, owner] = await Promise.all([
      ctx.db.get('campaign', deletion.campaignId),
      getUserByTokenIdentifier(ctx, character.ownerId),
    ]);
    if (!campaign || !owner) return { state: 'done' };
    const root = await readLifecycleReturnRoot(ctx, character);
    const progress = await advanceCampaignDeletionReturn(
      ctx,
      { character: root, campaign, user: owner },
      { id: deletion._id, round: deletion.round },
    );
    return { state: progress.state === 'completed' ? 'done' : 'returning' };
  },
});

// Rows each purge step deletes from one table; catalog definitions are larger.
const purgeBatch = 64;
const catalogPurgeBatch = 16;

/**
 * The deleted campaign's live data, cleared in this order: its open and
 * retired weekly drafts with their operations, targets and reviews, its source
 * corrections, setup and militia state, its campaign homebrew and spell
 * membership, and finally the militia itself. Resolution Records are its
 * history and are kept.
 */
const purgeStages = [
  { table: 'canonicalWeeklyDraft', index: 'by_militiaId' },
  { table: 'canonicalDraftOperation', index: 'by_militiaId' },
  { table: 'canonicalDraftTarget', index: 'by_militiaId' },
  { table: 'canonicalDraftSourceReview', index: 'by_militiaId' },
  { table: 'canonicalSourceCorrection', index: 'by_militiaId' },
  { table: 'canonicalCampaignInitialization', index: 'by_militiaId' },
  { table: 'canonicalMilitiaState', index: 'by_militiaId' },
  { table: 'catalogEntry', index: 'by_campaignId_and_scope' },
  { table: 'campaignSpellMembership', index: 'by_campaignId' },
  { table: 'militia', index: 'by_campaign' },
] as const;

/** The stage's next batch of rows to delete, and the batch size. */
async function readPurgeBatch(
  ctx: MutationCtx,
  stage: (typeof purgeStages)[number],
  { campaignId, militiaId }: Doc<'campaignDeletion'>,
) {
  switch (stage.index) {
    case 'by_militiaId':
      return {
        size: purgeBatch,
        rows: militiaId
          ? await ctx.db
              .query(stage.table)
              .withIndex(stage.index, (q) => q.eq('militiaId', militiaId))
              .take(purgeBatch)
          : [],
      };
    case 'by_campaignId_and_scope':
      return {
        size: catalogPurgeBatch,
        rows: await ctx.db
          .query(stage.table)
          .withIndex(stage.index, (q) =>
            q.eq('campaignId', campaignId).eq('scope', 'campaign'),
          )
          .take(catalogPurgeBatch),
      };
    // Each index is its own case, so it narrows to its own table.
    case 'by_campaignId':
      return {
        size: purgeBatch,
        rows: await ctx.db
          .query(stage.table)
          .withIndex(stage.index, (q) => q.eq('campaignId', campaignId))
          .take(purgeBatch),
      };
    case 'by_campaign':
      return {
        size: purgeBatch,
        rows: await ctx.db
          .query(stage.table)
          .withIndex(stage.index, (q) => q.eq('campaignId', campaignId))
          .take(purgeBatch),
      };
  }
}

/** Delete one batch of the stage; true once its table has nothing left. */
async function purgeStage(
  ctx: MutationCtx,
  stage: (typeof purgeStages)[number],
  deletion: Doc<'campaignDeletion'>,
) {
  const { rows, size } = await readPurgeBatch(ctx, stage, deletion);
  for (const row of rows) await ctx.db.delete(stage.table, row._id);
  return rows.length < size;
}

/**
 * One bounded step clearing a deleted campaign's live data. It runs under
 * the legacy Character Write Gate because campaign homebrew is Character
 * catalog data. Once every stage is clear the deletion is complete.
 */
export const purge = gatedInternalMutation({
  args: driverArgs,
  returns: v.union(v.literal('purging'), v.literal('deleted')),
  async handler(ctx, args) {
    const deletion = await ctx.db.get('campaignDeletion', args.deletionId);
    if (deletion?.round !== args.round || deletion.state !== 'purging')
      return 'deleted';
    const current = deletion.purgeStage ?? 0;
    const stage = purgeStages[current];
    const next =
      stage && (await purgeStage(ctx, stage, deletion)) ? current + 1 : current;
    if (next < purgeStages.length) {
      await ctx.db.patch('campaignDeletion', deletion._id, {
        purgeStage: next,
        lastFailure: undefined,
      });
      return 'purging';
    }
    await ctx.db.patch('campaignDeletion', deletion._id, {
      state: 'deleted',
      purgeStage: undefined,
      lastFailure: undefined,
    });
    return 'deleted';
  },
});
