import { ConvexError } from 'convex/values';

export function rejectRetiredWorkflow(): never {
  throw new ConvexError('Open the current militia week to make this change.');
}
