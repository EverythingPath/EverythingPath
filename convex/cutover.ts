import { v } from 'convex/values';
import { internalMutation, internalQuery, query } from './_generated/server';
import { readCutover } from './lib/campaignRuntime';
import { readWriteGate } from './lib/writeGate';
import { rejectRetiredWorkflow } from './lib/retiredWorkflow';

export const status = query({
  args: {},
  returns: v.union(v.literal('paused'), v.literal('canonical')),
  handler: async (ctx) => {
    const gate = await readWriteGate(ctx);
    const cutover = await readCutover(ctx);
    return gate?.closed || cutover?.status === 'paused'
      ? 'paused'
      : 'canonical';
  },
});

// Retained names reject stale operational clients as well as stale browsers.
export const inventory = internalQuery({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});
export const preflight = internalQuery({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});
export const verify = internalQuery({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});
export const prepare = internalMutation({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});
export const recordBackup = internalMutation({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});
export const initialize = internalMutation({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});
export const activate = internalMutation({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});
export const resumeLegacy = internalMutation({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});
export const pause = internalMutation({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});
