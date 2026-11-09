import { createWeeklyDraft } from './weekly-draft';
import {
  projectWeeklyDraft,
  resolveReviewedWeeklyDraft,
  prepareCanonicalResolutionRecord,
} from './canonical-weekly-resolution';
import {
  acceptedWeeklyPreviewSchema,
  type ConfirmationOperation,
} from './weekly-confirmation-contract';
import {
  weeklyDraftDataSchema,
  type WeeklyDraft,
} from './weekly-draft-contract';
import type { UpkeepSnapshot } from './rules-upkeep';

export function acceptedWeeklyPreview(
  draft: WeeklyDraft,
  snapshot: UpkeepSnapshot,
  sourceRevision: number,
) {
  const preview = projectWeeklyDraft({
    revision: draft,
    militiaSnapshot: snapshot,
  });
  return acceptedWeeklyPreviewSchema.parse({
    origin: 'accepted',
    reviewed: {
      draftId: draft.draftId,
      revision: draft.revision,
      sourceRevision,
      sourceKey: preview.sourceKey,
      rulesetVersion: preview.rulesetVersion,
    },
    status: preview.status,
    requirements: preview.requirements,
    warnings: preview.warnings,
    baseline: preview.baseline,
    outcome: preview.outcome,
  });
}
export function prepareWeeklyConfirmation(
  draft: WeeklyDraft,
  snapshot: UpkeepSnapshot,
  sourceRevision: number,
  operation: ConfirmationOperation,
) {
  const result = resolveReviewedWeeklyDraft(
    { revision: draft, militiaSnapshot: snapshot },
    operation.reviewed.sourceKey,
  );
  if (
    operation.reviewed.draftId !== draft.draftId ||
    operation.reviewed.revision !== draft.revision ||
    operation.reviewed.sourceRevision !== sourceRevision ||
    operation.reviewed.rulesetVersion !== result.rulesetVersion
  )
    throw new Error('Reviewed weekly source changed');
  const record = prepareCanonicalResolutionRecord(
    result,
    operation.operationId,
  );
  const after = result.finalPlan.after;
  const successor = createWeeklyDraft({
    draftId: `next:${operation.operationId}`,
    week: after.week,
    context: after.context,
    slotIds: draft.activity.slots.map((slot) => slot.slotId),
  });
  return { record, successor: weeklyDraftDataSchema.parse(successor), after };
}
