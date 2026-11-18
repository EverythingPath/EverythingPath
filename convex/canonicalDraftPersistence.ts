import { readSelectedCanonicalMilitiaState } from './lib/selectedCanonicalMilitiaState';
import { z } from 'zod';
import { workspaceSourceSchema } from '../src/lib/weekly-workspace-source';
import { requireScope } from './lib/canonicalDraftStorage';
import { internal } from './_generated/api';
import { campaignMutation } from './lib/campaignRuntime';
import { readWriteGate } from './lib/writeGate';
import {
  acceptedWeeklyPreviewSchema,
  confirmationOperationSchema,
  confirmationReceiptSchema,
} from '../src/lib/weekly-confirmation-contract';
import { previewDraft, confirmDraft } from './lib/canonicalConfirmation';
import { zodOutputToConvex } from 'convex-helpers/server/zod4';
import { paginationOptsValidator } from 'convex/server';
import { internalMutation, query } from './_generated/server';
import {
  draftKeySchema,
  canonicalRecordValidator,
} from './lib/canonicalStorageValidators';
import {
  draftObservationSchema,
  draftOperationSchema,
  draftReceiptSchema,
  draftTargetPaginationValidator,
} from '../src/lib/weekly-draft-persistence-contract';
import {
  observeDraft,
  persistDraftOperation,
} from './lib/canonicalDraftPersistenceAuthority';
import { ConvexError, v } from 'convex/values';

export const observe = query({
  args: zodOutputToConvex(draftKeySchema),
  returns: zodOutputToConvex(draftObservationSchema),
  handler: async (ctx, args) => {
    return await observeDraft(ctx, args);
  },
});
const editArgs = draftKeySchema
  .omit({ draftId: true })
  .extend({ operation: draftOperationSchema });
export const edit = campaignMutation({
  args: zodOutputToConvex(editArgs),
  returns: zodOutputToConvex(draftReceiptSchema),
  handler: async (ctx, args) => {
    return await persistDraftOperation(
      ctx,
      {
        campaignId: args.campaignId,
        militiaId: args.militiaId,
        draftId: args.operation.draftId,
      },
      args.operation,
    );
  },
});

export const targets = query({
  args: {
    ...zodOutputToConvex(
      draftKeySchema.extend({
        afterRevision: z.number().int().nonnegative(),
        observedRevision: z.number().int().nonnegative(),
        observedStatus: z.enum(['open', 'closed']),
      }),
    ).fields,
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    restart: v.boolean(),
    observation: zodOutputToConvex(draftObservationSchema),
    pagination: v.union(v.null(), draftTargetPaginationValidator),
  }),
  handler: async (ctx, args) => {
    const observation = await observeDraft(ctx, args);
    if (observation.revision < args.observedRevision)
      throw new ConvexError('Unknown observed revision');
    if (
      observation.revision !== args.observedRevision ||
      observation.status !== args.observedStatus
    )
      return {
        observation,
        pagination: null,
        restart: true,
      };
    const result = await ctx.db
      .query('canonicalDraftTarget')
      .withIndex('by_draftId_and_revision', (q) =>
        q.eq('draftId', args.draftId).gt('revision', args.afterRevision),
      )
      .paginate(args.paginationOpts);
    return {
      restart: false,
      observation,
      pagination: {
        ...result,
        page: result.page.map((row) => ({
          target: row.target,
          revision: row.revision,
        })),
      },
    };
  },
});

export const preview = query({
  args: zodOutputToConvex(draftKeySchema),
  returns: zodOutputToConvex(acceptedWeeklyPreviewSchema),
  handler: async (ctx, args) => {
    return await previewDraft(ctx, args);
  },
});
export const confirm = campaignMutation({
  args: zodOutputToConvex(
    draftKeySchema.extend({ operation: confirmationOperationSchema }),
  ),
  returns: v.object({
    ...zodOutputToConvex(confirmationReceiptSchema.omit({ record: true }))
      .fields,
    record: canonicalRecordValidator,
  }),
  handler: async (ctx, args) => {
    const receipt = await confirmDraft(ctx, args, args.operation);
    await ctx.scheduler.runAfter(
      0,
      internal.canonicalDraftPersistence.retireClosedDraft,
      { draftId: args.draftId, afterRevision: 0, writeEpoch: ctx.writeEpoch },
    );
    return receipt;
  },
});

// Closure immediately removes editable authority. Retire historical base payloads
// and target tombstones in bounded transactions while retaining edit dedup receipts.
export const retireClosedDraft = internalMutation({
  args: {
    draftId: v.string(),
    afterRevision: v.number(),
    writeEpoch: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Accepted retirement is idempotent across epochs and Character authority.
    // Preserve the job during maintenance without changing its draft data.
    if ((await readWriteGate(ctx))?.closed) {
      await ctx.scheduler.runAfter(
        60_000,
        internal.canonicalDraftPersistence.retireClosedDraft,
        args,
      );
      return null;
    }
    const row = await ctx.db
      .query('canonicalWeeklyDraft')
      .withIndex('by_draftId', (q) => q.eq('draftId', args.draftId))
      .unique();
    if (row?.status !== 'closed') return null;
    const operations = await ctx.db
      .query('canonicalDraftOperation')
      .withIndex('by_draftId_and_acceptedRevision', (q) =>
        q
          .eq('draftId', args.draftId)
          .gt('acceptedRevision', args.afterRevision),
      )
      .take(4);
    for (const operation of operations)
      await ctx.db.patch('canonicalDraftOperation', operation._id, {
        acceptedDraft: undefined,
      });
    const sourceReviews = await ctx.db
      .query('canonicalDraftSourceReview')
      .withIndex('by_draftId_and_revision', (q) =>
        q.eq('draftId', args.draftId),
      )
      .take(4);
    for (const review of sourceReviews)
      await ctx.db.delete('canonicalDraftSourceReview', review._id);
    const targets = await ctx.db
      .query('canonicalDraftTarget')
      .withIndex('by_draftId_and_target', (q) => q.eq('draftId', args.draftId))
      .take(32);
    for (const target of targets)
      await ctx.db.delete('canonicalDraftTarget', target._id);
    if (
      operations.length === 4 ||
      sourceReviews.length === 4 ||
      targets.length === 32
    )
      await ctx.scheduler.runAfter(
        0,
        internal.canonicalDraftPersistence.retireClosedDraft,
        {
          draftId: args.draftId,
          afterRevision:
            operations[operations.length - 1]?.acceptedRevision ??
            args.afterRevision,
        },
      );
    return null;
  },
});

export const workspace = query({
  args: { campaignId: v.id('campaign') },
  returns: v.union(v.null(), zodOutputToConvex(workspaceSourceSchema)),
  handler: async (ctx, args) => {
    const militia = await ctx.db
      .query('militia')
      .withIndex('by_campaign', (q) => q.eq('campaignId', args.campaignId))
      .unique();
    if (!militia) return null;
    const scope = { campaignId: args.campaignId, militiaId: militia._id };
    await requireScope(ctx, scope);
    const draft = await ctx.db
      .query('canonicalWeeklyDraft')
      .withIndex('by_campaignId_and_status', (q) =>
        q.eq('campaignId', args.campaignId).eq('status', 'open'),
      )
      .unique();
    const source = await readSelectedCanonicalMilitiaState(ctx, militia._id);
    if (
      !draft?.draft ||
      !source ||
      draft.militiaId !== militia._id ||
      source.campaignId !== args.campaignId
    )
      return null;
    const people = await Promise.all(
      source.snapshot.roster.people.map(async (person) => {
        const id = ctx.db.normalizeId('character', person.characterId);
        const character = id ? await ctx.db.get('character', id) : null;
        return {
          characterId: person.characterId,
          name:
            character?.campaignId === args.campaignId ? character.name : null,
        };
      }),
    );
    const initialization = await ctx.db
      .query('canonicalCampaignInitialization')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', militia._id))
      .unique();
    return workspaceSourceSchema.parse({
      setupNotes: initialization?.setupNotes,
      key: { ...scope, draftId: draft.draftId },
      week: draft.draft.week,
      sourceRevision: source.revision,
      snapshot: source.snapshot,
      people,
    });
  },
});
