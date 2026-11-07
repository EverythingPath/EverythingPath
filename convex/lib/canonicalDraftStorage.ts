import { writeDraftTargets } from './canonicalDraftTargets';
import { editWeeklyDraft } from '../../src/lib/weekly-draft';
import { canonicalResolutionRecordSchema } from '../../src/lib/canonical-resolution-record';
import { ConvexError, compareValues } from 'convex/values';
import type { z } from 'zod';
import type { Doc } from '../_generated/dataModel';
import type { CanonicalResolutionRecord } from '../../src/lib/canonical-resolution-record';
import type { MutationCtx } from '../_generated/server';
import type { ReadCtx } from '../types';
import { isOrganizationDeleted } from './organizationDeletion';
import {
  weeklyDraftSchema,
  weeklyDraftDataSchema,
} from '../../src/lib/weekly-draft-contract';
import {
  openDraftArgsSchema,
  scopeSchema,
  draftKeySchema,
  operationSchema,
  saveDraftRevisionArgsSchema,
  appendRecordArgsSchema,
} from './canonicalStorageValidators';

type Scope = z.infer<typeof scopeSchema>;
type CanonicalDraft = z.infer<typeof weeklyDraftSchema>;

export async function requireOrganizationMembership(
  ctx: ReadCtx,
  organizationId: string,
  errorMessage = 'Campaign access required',
) {
  const identity = await ctx.auth.getUserIdentity();
  const user =
    identity &&
    (await ctx.db
      .query('user')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', identity.tokenIdentifier),
      )
      .unique());
  if (
    !user?.orgIds.some((org) => org.orgId === organizationId) ||
    (await isOrganizationDeleted(ctx, organizationId))
  )
    throw new ConvexError(errorMessage);
}

// Deliberately unregistered: no live endpoint or application caller until cutover.
export async function requireScope(ctx: ReadCtx, input: Scope) {
  const scope = scopeSchema.parse({
    campaignId: input.campaignId,
    militiaId: input.militiaId,
  });
  const campaign = await ctx.db.get('campaign', scope.campaignId);
  const militia = await ctx.db.get('militia', scope.militiaId);
  if (!campaign || militia?.campaignId !== campaign._id)
    throw new ConvexError('Invalid campaign/militia reference');
  await requireOrganizationMembership(ctx, campaign.organizationId);
  return scope;
}

export async function openDraft(
  ctx: MutationCtx,
  input: Omit<z.infer<typeof openDraftArgsSchema>, 'draft'> & {
    draft: z.infer<typeof weeklyDraftSchema>;
  },
) {
  const { draft, ...scope } = openDraftArgsSchema.parse(input);
  await requireScope(ctx, scope);
  const existing = await ctx.db
    .query('canonicalWeeklyDraft')
    .withIndex('by_draftId', (q) => q.eq('draftId', draft.draftId))
    .unique();
  if (existing) {
    if (
      existing.campaignId === scope.campaignId &&
      existing.militiaId === scope.militiaId &&
      existing.status === 'open' &&
      compareValues(weeklyDraftDataSchema.parse(existing.draft), draft) === 0
    )
      return;
    throw new ConvexError('Draft identity already used');
  }
  const historical = await ctx.db
    .query('canonicalResolutionRecord')
    .withIndex('by_sourceDraftId', (q) =>
      q.eq('record.source.draftId', draft.draftId),
    )
    .first();
  if (historical) throw new ConvexError('Draft identity already used');
  const open = await findOpen(ctx, scope.campaignId);
  if (open) throw new ConvexError('Campaign already has an open draft');
  if (await findEffectiveRecord(ctx, scope.campaignId, draft.week))
    throw new ConvexError('Week already has a Resolution Record');
  if (draft.revision !== 0)
    throw new ConvexError('Initial draft revision must be zero');
  await ctx.db.insert('canonicalWeeklyDraft', {
    ...scope,
    draftId: draft.draftId,
    status: 'open',
    draft,
    initialDraft: draft,
    revision: draft.revision,
  });
}

async function findOpen(ctx: ReadCtx, campaignId: Scope['campaignId']) {
  return await ctx.db
    .query('canonicalWeeklyDraft')
    .withIndex('by_campaignId_and_status', (q) =>
      q.eq('campaignId', campaignId).eq('status', 'open'),
    )
    .unique();
}

export async function readOpenDraft(ctx: ReadCtx, input: Scope) {
  const scope = await requireScope(ctx, input);
  const row = await findOpen(ctx, scope.campaignId);
  if (!row) return null;
  if (row.militiaId !== scope.militiaId)
    throw new ConvexError('Invalid draft militia reference');
  return weeklyDraftSchema.parse(row.draft);
}

async function requireDraft(
  ctx: ReadCtx,
  input: z.infer<typeof draftKeySchema>,
) {
  const key = draftKeySchema.parse({
    campaignId: input.campaignId,
    militiaId: input.militiaId,
    draftId: input.draftId,
  });
  await requireScope(ctx, key);
  const row = await ctx.db
    .query('canonicalWeeklyDraft')
    .withIndex('by_draftId', (q) => q.eq('draftId', key.draftId))
    .unique();
  if (row?.campaignId !== key.campaignId || row.militiaId !== key.militiaId)
    throw new ConvexError('Invalid draft reference');
  return row;
}

export async function readDraftMetadata(
  ctx: ReadCtx,
  input: z.infer<typeof draftKeySchema>,
) {
  const row = await requireDraft(ctx, input);
  return {
    status: row.status,
    revision: row.revision,
  };
}

// Compare-and-save primitive for a later target-aware adapter. The adapter owns
// stale arbitration and target derivation; this transaction owns atomic storage.
export async function saveDraftRevision(
  ctx: MutationCtx,
  input: Omit<z.infer<typeof saveDraftRevisionArgsSchema>, 'draft'> & {
    draft: CanonicalDraft;
  },
) {
  const args = saveDraftRevisionArgsSchema.parse(input);
  const row = await requireDraft(ctx, args);
  const operation = await ctx.db
    .query('canonicalDraftOperation')
    .withIndex('by_draftId_and_operationId', (q) =>
      q.eq('draftId', args.draftId).eq('operationId', args.operationId),
    )
    .unique();
  if (operation) {
    if (
      compareValues(
        operationSchema.parse({
          operationId: operation.operationId,
          baseRevision: operation.baseRevision,
          edit: operation.edit,
        }),
        operationSchema.parse({
          operationId: args.operationId,
          baseRevision: args.baseRevision,
          edit: args.edit,
        }),
      ) !== 0
    )
      throw new ConvexError('Operation identity already used');
    return { revision: operation.acceptedRevision };
  }
  if (row.status !== 'open') throw new ConvexError('Draft is closed');
  if (row.revision !== args.expectedRevision)
    throw new ConvexError('Draft revision changed');
  if (
    args.baseRevision > row.revision ||
    args.draft.revision !== row.revision + 1
  )
    throw new ConvexError('Invalid next revision');
  const previous = weeklyDraftDataSchema.parse(row.draft);
  if (
    args.draft.draftId !== row.draftId ||
    args.draft.week !== previous.week ||
    compareValues(args.draft.context, previous.context) !== 0
  )
    throw new ConvexError('Draft identity and week context are immutable');
  const edited = editWeeklyDraft(previous, args.edit);
  if (
    !edited.ok ||
    compareValues(weeklyDraftDataSchema.parse(edited.draft), args.draft) !== 0
  )
    throw new ConvexError('Next draft must match the semantic edit');
  await ctx.db.patch('canonicalWeeklyDraft', row._id, {
    draft: args.draft,
    revision: args.draft.revision,
  });
  await writeDraftTargets(ctx, args, args.targets, args.draft.revision);
  await ctx.db.insert('canonicalDraftOperation', {
    campaignId: row.campaignId,
    militiaId: row.militiaId,
    draftId: row.draftId,
    operationId: args.operationId,
    baseRevision: args.baseRevision,
    edit: args.edit,
    acceptedRevision: args.draft.revision,
  });
  return { revision: args.draft.revision };
}

async function findEffectiveRecord(
  ctx: ReadCtx,
  campaignId: Scope['campaignId'],
  week: number,
) {
  return await ctx.db
    .query('canonicalResolutionRecord')
    .withIndex('by_campaignId_and_week_and_sequence', (q) =>
      q.eq('campaignId', campaignId).eq('week', week),
    )
    .order('desc')
    .first();
}

export async function readEffectiveRecord(
  ctx: ReadCtx,
  input: Scope & { week: number },
) {
  const scope = await requireScope(ctx, input);
  const week = weeklyDraftSchema.shape.week.parse(input.week);
  const row = await findEffectiveRecord(ctx, scope.campaignId, week);
  if (!row) return null;
  if (row.militiaId !== scope.militiaId)
    throw new ConvexError('Invalid record militia reference');
  return canonicalResolutionRecordSchema.parse(row.record);
}

export async function readResolutionRecord(
  ctx: ReadCtx,
  input: Scope & { recordId: string },
) {
  return (await readResolutionRecordEntry(ctx, input))?.record ?? null;
}

// The stored document's creation time is query envelope metadata only; it is
// never written into, or backfilled onto, the immutable record itself.
export async function readResolutionRecordEntry(
  ctx: ReadCtx,
  input: Scope & { recordId: string },
) {
  const scope = await requireScope(ctx, input);
  return readScopedResolutionRecordEntry(ctx, scope, input.recordId);
}

/**
 * One Resolution Record within a scope the caller has already authorized,
 * including a deleted campaign's retained history (#710).
 */
export async function readScopedResolutionRecordEntry(
  ctx: ReadCtx,
  scope: Scope,
  input: string,
) {
  const recordId = canonicalResolutionRecordSchema.shape.recordId.parse(input);
  const row = await ctx.db
    .query('canonicalResolutionRecord')
    .withIndex('by_recordId', (q) => q.eq('recordId', recordId))
    .unique();
  if (!row) return null;
  if (row.campaignId !== scope.campaignId || row.militiaId !== scope.militiaId)
    throw new ConvexError('Invalid record reference');
  return {
    record: canonicalResolutionRecordSchema.parse(row.record),
    createdAt: row._creationTime,
  };
}

// Append-only storage, not Weekly Confirmation or a History Rewrite endpoint.
// Later orchestration applies the verified plan and creates a successor in this
// same caller transaction. This primitive never writes legacy campaign state.
export async function appendResolutionRecord(
  ctx: MutationCtx,
  input: z.infer<typeof appendRecordArgsSchema>,
) {
  const { record, ...scope } = appendRecordArgsSchema.parse(input);
  await requireScope(ctx, scope);
  const duplicate = await ctx.db
    .query('canonicalResolutionRecord')
    .withIndex('by_recordId', (q) => q.eq('recordId', record.recordId))
    .unique();
  if (duplicate) throw new ConvexError('Record identity already used');
  const effective = await findEffectiveRecord(
    ctx,
    scope.campaignId,
    record.source.week,
  );
  if (
    record.supersedesRecordId !== (effective?.recordId ?? null) ||
    (effective && effective.militiaId !== scope.militiaId)
  )
    throw new ConvexError(
      'Correction must supersede the effective record for this campaign and week',
    );
  if (record.provenance === 'confirmation') {
    await closeRecordedDraft(ctx, scope, record);
  } else {
    await validateHistoricalSource(ctx, scope, record, effective);
  }
  await ctx.db.insert('canonicalResolutionRecord', {
    ...scope,
    recordId: record.recordId,
    week: record.source.week,
    sequence: (effective?.sequence ?? -1) + 1,
    record,
  });
}

async function closeRecordedDraft(
  ctx: MutationCtx,
  scope: Scope,
  record: CanonicalResolutionRecord,
) {
  const row = await requireDraft(ctx, {
    ...scope,
    draftId: record.source.draftId,
  });
  if (row.status !== 'open') throw new ConvexError('Draft is closed');
  if (
    compareValues(weeklyDraftDataSchema.parse(row.draft), record.source) !== 0
  )
    throw new ConvexError(
      'Record source must match the exact stored draft revision',
    );
  await ctx.db.patch('canonicalWeeklyDraft', row._id, {
    status: 'closed',
    draft: null,
    initialDraft: undefined,
  });
}

async function validateHistoricalSource(
  ctx: ReadCtx,
  scope: Scope,
  record: CanonicalResolutionRecord,
  effective: Doc<'canonicalResolutionRecord'> | null,
) {
  if (record.provenance === 'historical_reconstruction') {
    const allocated = await ctx.db
      .query('canonicalWeeklyDraft')
      .withIndex('by_draftId', (q) => q.eq('draftId', record.source.draftId))
      .unique();
    const historical = await ctx.db
      .query('canonicalResolutionRecord')
      .withIndex('by_sourceDraftId', (q) =>
        q.eq('record.source.draftId', record.source.draftId),
      )
      .first();
    if (allocated || historical)
      throw new ConvexError('Historical draft identity already used');
  }
  const open = await findOpen(ctx, scope.campaignId);
  if (open?.draft?.week === record.source.week)
    throw new ConvexError('Cannot rewrite an open week');
  if (effective && effective.record.source.draftId !== record.source.draftId)
    throw new ConvexError(
      'Correction must retain the historical draft identity',
    );
}
