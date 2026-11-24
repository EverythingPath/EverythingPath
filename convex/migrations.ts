import { internalMutation, mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { rejectRetiredWorkflow } from './lib/retiredWorkflow';

// Preserve old function names so queued requests receive an explicit rejection.
export const getLegacySchemaMigrationStatus = query({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});

export const startLegacySchemaMigration = mutation({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});

export const runLegacySchemaMigrationBatch = internalMutation({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});
