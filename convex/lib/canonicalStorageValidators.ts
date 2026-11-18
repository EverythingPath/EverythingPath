import { canonicalResolutionRecordSchema } from '../../src/lib/canonical-resolution-record';
import { zodOutputToConvex, zid } from 'convex-helpers/server/zod4';
import { z } from 'zod';
import type { Validator } from 'convex/values';
import {
  weeklyDraftDataSchema as weeklyDraftSchema,
  weeklyDraftEditSchema,
} from '../../src/lib/weekly-draft-contract';

export const scopeSchema = z.strictObject({
  campaignId: zid('campaign'),
  militiaId: zid('militia'),
});
export const openDraftArgsSchema = scopeSchema.extend({
  draft: weeklyDraftSchema,
});
export const targetRevisionSchema = z.strictObject({
  target: z.string().min(1),
  revision: z.number().int().nonnegative(),
});
export const draftStorageSchema = scopeSchema.extend({
  draftId: weeklyDraftSchema.shape.draftId,
  status: z.enum(['open', 'closed']),
  // Closed rows are identity tombstones; the immutable record owns their source.
  draft: weeklyDraftSchema.nullable(),
  revision: z.number().int().nonnegative(),
  initialDraft: weeklyDraftSchema.optional(),
  confirmation: z
    .strictObject({
      operationId: z.string(),
      sourceRevision: z.number().int().nonnegative(),
    })
    .optional(),
});
export const draftStorageValidator = zodOutputToConvex(draftStorageSchema);

export const draftKeySchema = scopeSchema.extend({
  draftId: weeklyDraftSchema.shape.draftId,
});
export const draftSourceReviewStorageValidator = zodOutputToConvex(
  draftKeySchema.extend({
    revision: z.number().int().positive(),
    acceptedDraft: weeklyDraftSchema,
  }),
);

export const operationSchema = z.strictObject({
  operationId: z.string().trim().min(1),
  baseRevision: z.number().int().nonnegative(),
  edit: weeklyDraftEditSchema,
});
export const saveDraftRevisionArgsSchema = draftKeySchema.extend({
  ...operationSchema.shape,
  expectedRevision: z.number().int().nonnegative(),
  draft: weeklyDraftSchema,
  targets: z
    .array(targetRevisionSchema.shape.target)
    .min(1)
    .refine((values) => new Set(values).size === values.length),
});
export const operationStorageValidator = zodOutputToConvex(
  draftKeySchema.extend({
    ...operationSchema.shape,
    acceptedRevision: z.number().int().positive(),
    acceptedDraft: weeklyDraftSchema.optional(),
  }),
);

export const appendRecordArgsSchema = scopeSchema.extend({
  record: canonicalResolutionRecordSchema,
});
const recordStorageSchema = scopeSchema.extend({
  recordId: canonicalResolutionRecordSchema.shape.recordId,
  week: weeklyDraftSchema.shape.week,
  sequence: z.number().int().nonnegative(),
  record: canonicalResolutionRecordSchema,
});
// Index only the envelope and source draft identity. Avoid expanding recursive
// JSON payload field paths in Convex's generated data model.
const recordStorageConvex: unknown = zodOutputToConvex(recordStorageSchema);
// Safe cast: zodOutputToConvex mirrors recordStorageSchema; the cast only
// narrows the index field paths to the envelope.
export const recordStorageValidator = recordStorageConvex as Validator<
  z.infer<typeof recordStorageSchema>,
  'required',
  | 'campaignId'
  | 'militiaId'
  | 'recordId'
  | 'week'
  | 'sequence'
  | 'record.source.draftId'
>;

const canonicalRecordConvex: unknown = zodOutputToConvex(
  canonicalResolutionRecordSchema,
);
// Safe cast: zodOutputToConvex mirrors the record schema; the cast keeps Convex
// from expanding its recursive JSON field paths.
export const canonicalRecordValidator = canonicalRecordConvex as Validator<
  z.infer<typeof canonicalResolutionRecordSchema>,
  'required',
  string
>;
