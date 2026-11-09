import { z } from 'zod';
import { compareValues } from 'convex/values';
import { militiaSnapshotSchema } from './canonical-weekly-source';
import {
  weeklyDraftDataSchema,
  weekStartFactsSchema,
} from './weekly-draft-contract';
import {
  identitySchema as id,
  integerSchema as int,
  acknowledgementSchema,
  rulesExceptionSchema,
  tableAdjustmentSchema,
} from './weekly-draft-facts';

// Canonical Weekly Resolution stores typed complete plans in artifact format
// 2. The payload stays loose JSON so records confirmed under an earlier
// Ruleset Version stay readable when plan entry shapes change (C7). The
// source snapshot lets history render against the reviewed facts rather than
// today's militia.
export const resolutionPayloadSchema = z.record(
  z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/),
  z.json(),
);
export const resolutionArtifactSchema = z.strictObject({
  formatVersion: z.literal(2),
  data: resolutionPayloadSchema,
});
export const canonicalResolutionRecordSchema = z
  .strictObject({
    recordId: id,
    source: weeklyDraftDataSchema,
    sourceMilitiaSnapshot: militiaSnapshotSchema,
    provenance: z.enum([
      'confirmation',
      'historical_reconstruction',
      'historical_correction',
    ]),
    rulesetVersion: int.min(1),
    baselinePlan: resolutionArtifactSchema,
    finalPlan: resolutionArtifactSchema,
    adjudication: z.strictObject({
      acknowledgements: z.array(acknowledgementSchema),
      rulesExceptions: z.array(rulesExceptionSchema),
      tableAdjustments: z.array(tableAdjustmentSchema),
    }),
    warnings: z.array(
      z.strictObject({
        code: id,
        message: z.string().min(1),
        ruleSource: id.optional(),
      }),
    ),
    finalOutcome: resolutionArtifactSchema,
    successorContext: weekStartFactsSchema,
    supersedesRecordId: id.nullable(),
  })
  .superRefine((record, ctx) => {
    for (const field of [
      'acknowledgements',
      'rulesExceptions',
      'tableAdjustments',
    ] as const) {
      if (compareValues(record.adjudication[field], record.source[field]) !== 0)
        ctx.addIssue({
          code: 'custom',
          message: `Adjudication ${field} must match source`,
        });
    }
    if (
      (record.provenance === 'historical_correction') !==
      (record.supersedesRecordId !== null)
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Only a correction supersedes a record',
      });
  });
export type CanonicalResolutionRecord = z.infer<
  typeof canonicalResolutionRecordSchema
>;
