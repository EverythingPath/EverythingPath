import { v, type Infer } from 'convex/values';

// #413 F1: what one batch of `catalogIdentityAllocation:allocate` reports,
// shared by the Convex function and the operator's response check.

const storedIdentityValidator = v.object({
  catalogEntryId: v.id('catalogEntry'),
  kind: v.string(),
});

/**
 * Why a definition got no identity. Each names both sides: the release
 * body's key (and kind or reference) and what the deployment holds.
 */
export const identityConflictValidator = v.union(
  // The key already names a stored identity of another kind.
  v.object({
    kind: v.literal('identityKind'),
    key: v.string(),
    releaseKind: v.string(),
    stored: storedIdentityValidator,
  }),
  // A reference resolves to an identity of a kind the adapter refuses.
  v.object({
    kind: v.literal('referenceKind'),
    key: v.string(),
    reference: v.string(),
    expectedKind: v.string(),
    found: v.union(
      v.object({
        source: v.literal('stored'),
        catalogEntryId: v.id('catalogEntry'),
        kind: v.string(),
      }),
      v.object({ source: v.literal('release'), kind: v.string() }),
    ),
  }),
  // A reference is neither stored nor a definition of this release.
  v.object({
    kind: v.literal('unresolvedReference'),
    key: v.string(),
    reference: v.string(),
  }),
  // No stored identity shape exists for the body, or it doesn't parse.
  v.object({
    kind: v.literal('unsupported'),
    key: v.string(),
    reason: v.string(),
  }),
);
export type IdentityConflict = Infer<typeof identityConflictValidator>;

export const allocationBatchValidator = v.object({
  allocatedCount: v.number(),
  existingCount: v.number(),
  conflicts: v.array(identityConflictValidator),
  continueCursor: v.string(),
  isDone: v.boolean(),
});
export type AllocationBatch = Infer<typeof allocationBatchValidator>;
