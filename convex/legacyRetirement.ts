import { v } from 'convex/values';
import { internalMutation } from './_generated/server';
import { rejectRetiredWorkflow } from './lib/retiredWorkflow';

// Cleanup completed before schema narrowing. Old operator commands cannot run again.
export const batch = internalMutation({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});
