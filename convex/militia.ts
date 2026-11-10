import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { rejectRetiredWorkflow } from './lib/retiredWorkflow';

// Preserve old function names so queued requests receive an explicit rejection.
export const getMilitia = query({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});

export const getMilitiaStateSetup = query({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});

export const assignTeamManager = mutation({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});

export const listSettlements = query({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});

export const listMarketplaces = query({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});

export const upsertMarketplaceState = mutation({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});

export const deleteMarketplaceState = mutation({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});

export const upsertCacheState = mutation({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});

export const deleteCacheState = mutation({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});

export const upsertOrderState = mutation({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});

export const deleteOrderState = mutation({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});

export const upsertTrackedPersonState = mutation({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});

export const deleteTrackedPersonState = mutation({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});

export const upsertEventState = mutation({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});

export const deleteEventState = mutation({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});

export const createMilitia = mutation({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});

export const updateMilitiaCoreState = mutation({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});

export const upsertWeekContextState = mutation({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});

export const upsertMilitiaTeamState = mutation({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});

export const upsertSettlementState = mutation({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});

export const deleteSettlementState = mutation({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});

export const assignOfficerRole = mutation({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});
