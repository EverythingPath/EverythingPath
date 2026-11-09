import { readSelectedCanonicalMilitiaState } from './selectedCanonicalMilitiaState';
import { ConvexError } from 'convex/values';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import type { z } from 'zod';
import type { draftKeySchema } from './canonicalStorageValidators';
import {
  requireDraft,
  observeDraft,
} from './canonicalDraftPersistenceAuthority';
import {
  openDraft,
  appendResolutionRecord,
  readResolutionRecord,
} from './canonicalDraftStorage';
import { weeklyDraftDataSchema } from '../../src/lib/weekly-draft-contract';
import {
  militiaSnapshotSchema,
  weeklySourceKey,
} from '../../src/lib/canonical-weekly-source';
import {
  acceptedWeeklyPreview,
  prepareWeeklyConfirmation,
} from '../../src/lib/weekly-confirmation';
import {
  confirmationOperationSchema,
  confirmationReceiptSchema,
  type ConfirmationOperation,
} from '../../src/lib/weekly-confirmation-contract';
import { createWeeklyDraft } from '../../src/lib/weekly-draft';

type Key = z.infer<typeof draftKeySchema>;
async function sourceState(ctx: QueryCtx | MutationCtx, key: Key) {
  const state = await readSelectedCanonicalMilitiaState(ctx, key.militiaId);
  if (state?.campaignId !== key.campaignId)
    throw new ConvexError('Canonical source unavailable');
  return state;
}
export async function previewDraft(ctx: QueryCtx | MutationCtx, key: Key) {
  const row = await requireDraft(ctx, key);
  if (row.status !== 'open') throw new ConvexError('Draft is closed');
  const state = await sourceState(ctx, key);
  return acceptedWeeklyPreview(
    weeklyDraftDataSchema.parse(row.draft),
    militiaSnapshotSchema.parse(state.snapshot),
    state.revision,
  );
}
export async function confirmDraft(
  ctx: MutationCtx,
  key: Key,
  input: ConfirmationOperation,
) {
  const operation = confirmationOperationSchema.parse(input);
  const row = await requireDraft(ctx, key);
  if (operation.reviewed.draftId !== key.draftId)
    throw new ConvexError('Invalid draft reference');
  if (row.confirmation?.operationId === operation.operationId) {
    const record = await readResolutionRecord(ctx, {
      ...key,
      recordId: operation.operationId,
    });
    if (
      !record ||
      operation.reviewed.sourceRevision !== row.confirmation.sourceRevision ||
      operation.reviewed.revision !== record.source.revision ||
      operation.reviewed.rulesetVersion !== record.rulesetVersion ||
      operation.reviewed.sourceKey !==
        weeklySourceKey({
          revision: record.source,
          militiaSnapshot: record.sourceMilitiaSnapshot,
        })
    )
      throw new ConvexError('Operation identity already used');
    return confirmationReceiptSchema.parse({
      operationId: operation.operationId,
      observation: await observeDraft(ctx, key),
      record,
      successor: createWeeklyDraft({
        draftId: `next:${operation.operationId}`,
        week: record.source.week + 1,
        context: record.successorContext,
        slotIds: record.source.activity.slots.map((slot) => slot.slotId),
      }),
    });
  }
  if (row.status !== 'open') throw new ConvexError('Draft is closed');
  const state = await sourceState(ctx, key);
  let prepared;
  try {
    prepared = prepareWeeklyConfirmation(
      weeklyDraftDataSchema.parse(row.draft),
      militiaSnapshotSchema.parse(state.snapshot),
      state.revision,
      operation,
    );
  } catch (error) {
    throw new ConvexError(
      error instanceof Error ? error.message : 'Confirmation rejected',
    );
  }
  await ctx.db.patch('canonicalMilitiaState', state._id, {
    revision: state.storedRevision + 1,
    snapshot: prepared.after.militiaSnapshot,
  });
  await appendResolutionRecord(ctx, {
    campaignId: key.campaignId,
    militiaId: key.militiaId,
    record: prepared.record,
  });
  await ctx.db.patch('canonicalWeeklyDraft', row._id, {
    confirmation: {
      operationId: operation.operationId,
      sourceRevision: state.revision,
    },
  });
  await openDraft(ctx, {
    campaignId: key.campaignId,
    militiaId: key.militiaId,
    draft: prepared.successor,
  });
  return confirmationReceiptSchema.parse({
    operationId: operation.operationId,
    observation: await observeDraft(ctx, key),
    record: prepared.record,
    successor: prepared.successor,
  });
}
