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
import { weeklyDraftDataSchema } from './weekly-draft-contract';

/** The draft, its source militia and the version the deployment uses. */
type WeeklySource = Parameters<typeof projectWeeklyDraft>[0];

export function acceptedWeeklyPreview(
  source: WeeklySource,
  sourceRevision: number,
) {
  const draft = source.revision;
  const preview = projectWeeklyDraft(source);
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
  source: WeeklySource,
  sourceRevision: number,
  operation: ConfirmationOperation,
) {
  const draft = source.revision;
  const result = resolveReviewedWeeklyDraft(
    source,
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
