import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { rejectRetiredWorkflow } from './lib/retiredWorkflow';

// Preserve old function names so queued requests receive an explicit rejection.
export const getWeekBoardState = query({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});

export const getWeekBoardReferenceData = query({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});

export const getWeekBoardTrackedState = query({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});

export const getWeekBoardLiveState = query({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});

export const listResolutionRecords = query({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});

export const saveWeekBoardState = mutation({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});

export const commitCurrentPhase = mutation({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});

export const goToPreviousWeek = mutation({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});

export const buyOffPersistentEvent = mutation({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});

export const applyTreasuryTransaction = mutation({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});

export const rankUpMilitia = mutation({
  args: v.any(),
  returns: v.null(),
  handler: rejectRetiredWorkflow,
});
