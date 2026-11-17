import { readSelectedCanonicalMilitiaState } from './selectedCanonicalMilitiaState';
import {
  requireUnchangedStoredTargets,
  writeDraftTargets,
} from './canonicalDraftTargets';
import { ConvexError, compareValues } from 'convex/values';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import { requireScope } from './canonicalDraftStorage';
import { type draftKeySchema } from './canonicalStorageValidators';
import {
  draftOperationSchema,
  draftObservationSchema,
  type DraftOperation,
} from '../../src/lib/weekly-draft-persistence-contract';
import { weeklyDraftDataSchema } from '../../src/lib/weekly-draft-contract';
import { acceptDraftOperation } from '../../src/lib/weekly-draft-consistency';
import { militiaSnapshotSchema } from '../../src/lib/canonical-weekly-source';
import { draftReferenceRequirements } from '../../src/lib/weekly-draft-references';
import type { z } from 'zod';

type Key = z.infer<typeof draftKeySchema>;
export async function requireDraft(ctx: QueryCtx | MutationCtx, key: Key) {
  await requireScope(ctx, key);
  const row = await ctx.db
    .query('canonicalWeeklyDraft')
    .withIndex('by_draftId', (q) => q.eq('draftId', key.draftId))
    .unique();
  if (row?.campaignId !== key.campaignId || row.militiaId !== key.militiaId)
    throw new ConvexError('Invalid draft reference');
  return row;
}
export async function observeDraft(ctx: QueryCtx | MutationCtx, key: Key) {
  const row = await requireDraft(ctx, key);
  return draftObservationSchema.parse({
    draftId: row.draftId,
    revision: row.revision,
    status: row.status,
    draft: row.draft,
    targetRevisions: [],
  });
}
export async function persistDraftOperation(
  ctx: MutationCtx,
  key: Key,
  input: DraftOperation,
) {
  const operation = draftOperationSchema.parse(input);
  if (operation.draftId !== key.draftId)
    throw new ConvexError('Invalid draft reference');
  const row = await requireDraft(ctx, key);
  const previous = await ctx.db
    .query('canonicalDraftOperation')
    .withIndex('by_draftId_and_operationId', (q) =>
      q.eq('draftId', key.draftId).eq('operationId', operation.operationId),
    )
    .unique();
  if (previous) {
    const stored = draftOperationSchema.parse({
      draftId: previous.draftId,
      operationId: previous.operationId,
      baseRevision: previous.baseRevision,
      edit: previous.edit,
    });
    if (compareValues(stored, operation) !== 0)
      throw new ConvexError('Operation identity already used');
    return {
      operationId: operation.operationId,
      acceptedRevision: previous.acceptedRevision,
      observation: await observeDraft(ctx, key),
    };
  }
  if (row.status !== 'open') throw new ConvexError('Draft is closed');
  const baseRow =
    operation.baseRevision === 0
      ? null
      : await ctx.db
          .query('canonicalDraftOperation')
          .withIndex('by_draftId_and_acceptedRevision', (q) =>
            q
              .eq('draftId', key.draftId)
              .eq('acceptedRevision', operation.baseRevision),
          )
          .unique();
  const sourceReview =
    operation.baseRevision !== 0 && !baseRow
      ? await ctx.db
          .query('canonicalDraftSourceReview')
          .withIndex('by_draftId_and_revision', (q) =>
            q.eq('draftId', key.draftId).eq('revision', operation.baseRevision),
          )
          .unique()
      : null;
  const base =
    operation.baseRevision === 0
      ? row.initialDraft
      : (baseRow?.acceptedDraft ??
        (sourceReview?.campaignId === key.campaignId &&
        sourceReview.militiaId === key.militiaId
          ? sourceReview.acceptedDraft
          : undefined));
  if (!base) throw new ConvexError('Unknown base revision');
  const state = await readSelectedCanonicalMilitiaState(ctx, key.militiaId);
  if (state?.campaignId !== key.campaignId)
    throw new ConvexError('Canonical source unavailable');
  const source = militiaSnapshotSchema.parse(state.snapshot);
  let accepted;
  try {
    accepted = acceptDraftOperation(
      weeklyDraftDataSchema.parse(row.draft),
      weeklyDraftDataSchema.parse(base),
      [],
      operation,
      source,
    );
  } catch (error) {
    throw new ConvexError(
      error instanceof Error ? error.message : 'Invalid edit',
    );
  }
  await requireUnchangedStoredTargets(
    ctx,
    key,
    accepted.targets,
    operation.baseRevision,
  );
  // Departure keeps obsolete choices pending explicit review. An unrelated edit
  // may preserve an unchanged flagged choice; reviewed or changed inputs must
  // satisfy the current source's references before their flag can be cleared.
  const before = weeklyDraftDataSchema.parse(row.draft);
  const referenceDraft = weeklyDraftDataSchema.parse(accepted.draft);
  for (const slot of referenceDraft.activity.slots) {
    if (!slot.choice?.reviewRequired) continue;
    const retained = before.activity.slots.find(
      (previous) => previous.choice?.choiceId === slot.choice?.choiceId,
    )?.choice;
    if (retained?.reviewRequired && compareValues(retained, slot.choice) === 0)
      slot.choice = null;
  }
  if (draftReferenceRequirements(referenceDraft, source, source).length)
    throw new ConvexError('Invalid draft entity reference');
  await ctx.db.patch('canonicalWeeklyDraft', row._id, {
    draft: weeklyDraftDataSchema.parse(accepted.draft),
    revision: accepted.draft.revision,
  });
  await writeDraftTargets(ctx, key, accepted.targets, accepted.draft.revision);
  await ctx.db.insert('canonicalDraftOperation', {
    ...key,
    operationId: operation.operationId,
    baseRevision: operation.baseRevision,
    edit: operation.edit,
    acceptedRevision: accepted.draft.revision,
    acceptedDraft: weeklyDraftDataSchema.parse(accepted.draft),
  });
  return {
    operationId: operation.operationId,
    acceptedRevision: accepted.draft.revision,
    observation: await observeDraft(ctx, key),
  };
}
