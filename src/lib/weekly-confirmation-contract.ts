import { z } from 'zod';
import { identitySchema, integerSchema } from './weekly-draft-facts';
import { canonicalWeekStateSchema } from './canonical-weekly-source';
import { canonicalResolutionRecordSchema } from './canonical-resolution-record';
import { weeklyDraftDataSchema } from './weekly-draft-contract';
import { draftObservationSchema } from './weekly-draft-persistence-contract';

export const reviewedConfirmationSchema = z.strictObject({
  draftId: identitySchema,
  revision: integerSchema,
  sourceRevision: integerSchema,
  sourceKey: z.string().min(1),
  rulesetVersion: integerSchema,
});
export const acceptedWeeklyPreviewSchema = z.strictObject({
  origin: z.literal('accepted'),
  reviewed: reviewedConfirmationSchema,
  status: z.enum(['ready', 'incomplete']),
  requirements: z.array(z.string()),
  warnings: z.array(z.string()),
  baseline: canonicalWeekStateSchema.nullable(),
  outcome: canonicalWeekStateSchema.nullable(),
});
export type AcceptedWeeklyPreview = z.infer<typeof acceptedWeeklyPreviewSchema>;
export const confirmationOperationSchema = z.strictObject({
  operationId: identitySchema,
  reviewed: reviewedConfirmationSchema,
});
export type ConfirmationOperation = z.infer<typeof confirmationOperationSchema>;
export const confirmationReceiptSchema = z.strictObject({
  operationId: identitySchema,
  observation: draftObservationSchema,
  record: canonicalResolutionRecordSchema,
  successor: weeklyDraftDataSchema,
});
export type ConfirmationReceipt = z.infer<typeof confirmationReceiptSchema>;
export type ConfirmationTransport = {
  preview(this: void): Promise<AcceptedWeeklyPreview>;
  confirm(
    this: void,
    operation: ConfirmationOperation,
  ): Promise<ConfirmationReceipt>;
};

// Owned fixture and deterministic-authority inspection for the shared adapter
// contract. Production confirmation returns its record and successor directly.
export const confirmationInspectionSchema = z.strictObject({
  sourceRevision: integerSchema,
  snapshot: canonicalWeekStateSchema.shape.militiaSnapshot,
  source: draftObservationSchema,
  openDrafts: z.array(weeklyDraftDataSchema),
  records: z.array(canonicalResolutionRecordSchema),
});
export type ConfirmationInspection = z.infer<
  typeof confirmationInspectionSchema
>;
