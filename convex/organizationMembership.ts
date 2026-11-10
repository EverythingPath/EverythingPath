import { ConvexError, v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';
import { generalInternalMutation } from './lib/writeGate';

export async function syncOrganizationMemberships(
  ctx: MutationCtx,
  userId: Id<'user'>,
  orgIds: Doc<'user'>['orgIds'],
) {
  const memberships = await ctx.db
    .query('organizationMembership')
    .withIndex('by_userId_and_organizationId', (q) => q.eq('userId', userId))
    .take(8193);
  if (memberships.length > 8192)
    throw new ConvexError('Too many organization memberships to update');
  const organizations = new Set(orgIds.map((membership) => membership.orgId));
  const retained = new Set<string>();
  for (const membership of memberships) {
    if (
      !organizations.has(membership.organizationId) ||
      retained.has(membership.organizationId)
    )
      await ctx.db.delete('organizationMembership', membership._id);
    else retained.add(membership.organizationId);
  }
  for (const organizationId of organizations)
    if (!retained.has(organizationId))
      await ctx.db.insert('organizationMembership', { userId, organizationId });
}

// One account per transaction bounds the legacy inventory without a user-table
// scan in any player-facing query. Re-running from null is safe.
export const backfill = generalInternalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.object({ isDone: v.boolean(), continueCursor: v.string() }),
  async handler(ctx, args) {
    const page = await ctx.db
      .query('user')
      .withIndex('by_tokenIdentifier')
      .paginate({ cursor: args.cursor, numItems: 1, maximumRowsRead: 1 });
    for (const user of page.page)
      await syncOrganizationMemberships(ctx, user._id, user.orgIds);
    return { isDone: page.isDone, continueCursor: page.continueCursor };
  },
});
