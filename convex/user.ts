import { ConvexError, v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import {
  type MutationCtx,
  type QueryCtx,
  internalQuery,
  query,
} from './_generated/server';
import { gatedWebhookMutation } from './lib/writeGate';
import { roles } from './schema';
import { syncOrganizationMemberships } from './organizationMembership';
import {
  readOrganizationDeparture,
  startOrganizationDeparture,
} from './lib/organizationDeparture';
import {
  readAccountDeletion,
  startAccountDeletion,
} from './lib/accountDeletion';
import { isOrganizationDeleted } from './lib/organizationDeletion';

export async function getUserByTokenIdentifier(
  ctx: QueryCtx | MutationCtx,
  tokenIdentifier: string,
) {
  return await ctx.db
    .query('user')
    .withIndex('by_tokenIdentifier', (q) =>
      q.eq('tokenIdentifier', tokenIdentifier),
    )
    .first();
}

export async function getUser(
  ctx: QueryCtx | MutationCtx,
  tokenIdentifier: string,
) {
  const user = await getUserByTokenIdentifier(ctx, tokenIdentifier);

  if (!user) {
    throw new ConvexError('expected user to be defined');
  }

  return user;
}

/**
 * Whether a delivery's provider time is newer than the stored one. A removal
 * carries the membership's last update time, which can equal the stored time
 * of the membership it removes, so it also applies at equal time.
 */
function isNewerWebhook(
  updatedAt?: number,
  storedUpdatedAt?: number,
  { orEqual = false } = {},
) {
  if (
    updatedAt !== undefined &&
    (!Number.isSafeInteger(updatedAt) || updatedAt < 0)
  )
    throw new ConvexError(
      'Identity update timestamp must be a nonnegative integer.',
    );
  if (storedUpdatedAt === undefined) return true;
  if (updatedAt === undefined) return false;
  return orEqual ? updatedAt >= storedUpdatedAt : updatedAt > storedUpdatedAt;
}

const profileArgs = {
  tokenIdentifier: v.string(),
  name: v.string(),
  image: v.string(),
  webhookUpdatedAt: v.optional(v.number()),
};

/**
 * The account a provider membership event is for. A known deleted account
 * takes precedence over every later or reordered event, which changes
 * nothing (#708). An account the app hasn't seen yet is refused, so the
 * provider retries the event once its creation has arrived.
 */
async function readMembershipAccount(
  ctx: MutationCtx,
  tokenIdentifier: string,
) {
  if (await readAccountDeletion(ctx, tokenIdentifier)) return null;
  return getUser(ctx, tokenIdentifier);
}

async function upsertProfile(
  ctx: MutationCtx,
  args: {
    tokenIdentifier: string;
    name: string;
    image: string;
    webhookUpdatedAt?: number;
  },
) {
  // Provider user IDs are never reused, so a deleted account stays deleted.
  if (await readAccountDeletion(ctx, args.tokenIdentifier)) return null;
  const user = await getUserByTokenIdentifier(ctx, args.tokenIdentifier);
  if (!isNewerWebhook(args.webhookUpdatedAt, user?.webhookUpdatedAt))
    return null;
  if (user) {
    await ctx.db.patch('user', user._id, args);
    await syncOrganizationMemberships(ctx, user._id, user.orgIds);
  } else await ctx.db.insert('user', { ...args, orgIds: [] });
  return null;
}

export const createUser = gatedWebhookMutation({
  args: profileArgs,
  returns: v.null(),
  handler: upsertProfile,
});

export const updateUser = gatedWebhookMutation({
  args: profileArgs,
  returns: v.null(),
  handler: upsertProfile,
});

const membershipArgs = {
  tokenIdentifier: v.string(),
  orgId: v.string(),
  role: roles,
  webhookUpdatedAt: v.optional(v.number()),
};

async function upsertMembership(
  ctx: MutationCtx,
  args: {
    tokenIdentifier: string;
    orgId: string;
    role: 'admin' | 'member';
    webhookUpdatedAt?: number;
  },
) {
  // A deleted organization stays deleted (#710).
  if (await isOrganizationDeleted(ctx, args.orgId)) return null;
  const user = await readMembershipAccount(ctx, args.tokenIdentifier);
  if (!user) return null;
  const existing = user.orgIds.find((org) => org.orgId === args.orgId);
  if (!isNewerWebhook(args.webhookUpdatedAt, existing?.webhookUpdatedAt))
    return null;
  // A delayed event from before a removal cannot restore access (#706).
  const departure = await readOrganizationDeparture(ctx, user._id, args.orgId);
  if (
    departure &&
    !isNewerWebhook(args.webhookUpdatedAt, departure.webhookUpdatedAt)
  )
    return null;
  const membership = {
    orgId: args.orgId,
    role: args.role,
    ...(args.webhookUpdatedAt === undefined
      ? {}
      : { webhookUpdatedAt: args.webhookUpdatedAt }),
  };
  const orgIds = existing
    ? user.orgIds.map((org) => (org.orgId === args.orgId ? membership : org))
    : [...user.orgIds, membership];
  await ctx.db.patch('user', user._id, { orgIds });
  await syncOrganizationMemberships(ctx, user._id, orgIds);
  return null;
}

export const addOrgIdToUser = gatedWebhookMutation({
  args: membershipArgs,
  returns: v.null(),
  handler: upsertMembership,
});

export const updateRoleInOrgForUser = gatedWebhookMutation({
  args: membershipArgs,
  returns: v.null(),
  handler: upsertMembership,
});

/**
 * Revoke one organization's access at once and start the trusted return of the
 * departed owner's Characters (#706). Repeated or out-of-date deliveries
 * change nothing. The signed provider event and the isolated browser fixture
 * both remove a membership through this.
 */
export async function removeOrganizationMembership(
  ctx: MutationCtx,
  args: {
    tokenIdentifier: string;
    orgId: string;
    webhookUpdatedAt?: number;
    /** Only the isolated browser fixture shortens the grace before returns. */
    graceMs?: number;
  },
) {
  // The organization's deletion already removed this membership (#710).
  if (await isOrganizationDeleted(ctx, args.orgId)) return;
  const user = await readMembershipAccount(ctx, args.tokenIdentifier);
  if (!user) return;
  const existing = user.orgIds.find((org) => org.orgId === args.orgId);
  const departure = await readOrganizationDeparture(ctx, user._id, args.orgId);
  if (
    existing
      ? !isNewerWebhook(args.webhookUpdatedAt, existing.webhookUpdatedAt, {
          orEqual: true,
        })
      : !isNewerWebhook(args.webhookUpdatedAt, departure?.webhookUpdatedAt)
  )
    return;
  await revokeMembership(ctx, user, args);
}

/**
 * Remove the user's membership, if they still have it, and start the trusted
 * return of their Characters in the organization's campaigns (#706).
 */
async function revokeMembership(
  ctx: MutationCtx,
  user: Doc<'user'>,
  args: { orgId: string; webhookUpdatedAt?: number; graceMs?: number },
) {
  if (user.orgIds.some((org) => org.orgId === args.orgId)) {
    const orgIds = user.orgIds.filter((org) => org.orgId !== args.orgId);
    await ctx.db.patch('user', user._id, { orgIds });
    await syncOrganizationMemberships(ctx, user._id, orgIds);
  }
  await startOrganizationDeparture(ctx, {
    userId: user._id,
    organizationId: args.orgId,
    webhookUpdatedAt: args.webhookUpdatedAt,
    graceMs: args.graceMs,
  });
}

/**
 * #710: remove a member of an organization the provider has deleted. Their
 * access already ended with the deletion; this removes the membership itself
 * and starts the ordinary trusted return of their Characters, so surviving
 * owners get them back through #706.
 */
export async function revokeDeletedOrganizationMembership(
  ctx: MutationCtx,
  membership: Doc<'organizationMembership'>,
) {
  const user = await ctx.db.get('user', membership.userId);
  // A directory row without the membership is stale: remove only the row.
  if (!user?.orgIds.some((org) => org.orgId === membership.organizationId)) {
    await ctx.db.delete('organizationMembership', membership._id);
    return;
  }
  await revokeMembership(ctx, user, { orgId: membership.organizationId });
}

export const removeOrgIdFromUser = gatedWebhookMutation({
  args: {
    tokenIdentifier: v.string(),
    orgId: v.string(),
    webhookUpdatedAt: v.optional(v.number()),
  },
  returns: v.null(),
  async handler(ctx, args) {
    await removeOrganizationMembership(ctx, args);
    return null;
  },
});

/**
 * Delete an account at once (#708): its memberships and the account itself
 * go in one transaction, so every read and write refuses it from then on,
 * and the deletion is remembered so that no later provider event restores
 * it. A trusted background job then keeps its campaign Characters, ownerless,
 * for the remaining members and deletes its private ones. A membership
 * return already under way stops, because its account no longer exists.
 */
export async function deleteAccount(ctx: MutationCtx, tokenIdentifier: string) {
  if (await readAccountDeletion(ctx, tokenIdentifier)) return;
  const user = await getUserByTokenIdentifier(ctx, tokenIdentifier);
  if (user) {
    await syncOrganizationMemberships(ctx, user._id, []);
    await ctx.db.delete('user', user._id);
  }
  await startAccountDeletion(ctx, tokenIdentifier);
}

export const deleteUser = gatedWebhookMutation({
  args: { tokenIdentifier: v.string() },
  returns: v.null(),
  async handler(ctx, args) {
    await deleteAccount(ctx, args.tokenIdentifier);
    return null;
  },
});

const identityPageSize = 100;

/**
 * Every account's token identifier and organization IDs, in pages after
 * `after`. Local development's identity sync (scripts/local-convex/
 * identities.ts) reconciles Clerk against this, so a grant whose sync failed
 * part-way is still revoked once Clerk drops it. Internal: admin key only.
 */
export const listIdentityProjection = internalQuery({
  args: { after: v.optional(v.string()) },
  returns: v.object({
    users: v.array(
      v.object({ tokenIdentifier: v.string(), orgIds: v.array(v.string()) }),
    ),
    next: v.union(v.string(), v.null()),
  }),
  async handler(ctx, { after }) {
    const users = await ctx.db
      .query('user')
      .withIndex('by_tokenIdentifier', (q) =>
        after === undefined ? q : q.gt('tokenIdentifier', after),
      )
      .take(identityPageSize);
    return {
      users: users.map((user) => ({
        tokenIdentifier: user.tokenIdentifier,
        orgIds: user.orgIds.map((org) => org.orgId),
      })),
      next:
        users.length === identityPageSize
          ? (users.at(-1)?.tokenIdentifier ?? null)
          : null,
    };
  },
});

export const getUserProfile = query({
  args: { userId: v.id('user') },
  async handler(ctx, args) {
    const user = await ctx.db.get('user', args.userId);

    return {
      name: user?.name,
      image: user?.image,
    };
  },
});

export const getMe = query({
  args: {},
  async handler(ctx) {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      return null;
    }

    const user = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier);

    return user ?? null;
  },
});

export const getOrgAccessStatus = query({
  args: {
    organizationId: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      return { state: 'unauthenticated' as const };
    }

    if (!args.organizationId) {
      return { state: 'no_org_selected' as const };
    }

    const user = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier);

    if (!user) {
      return { state: 'no_access' as const };
    }

    const orgMembership = user.orgIds.find(
      (item) => item.orgId === args.organizationId,
    );
    const hasAccess =
      Boolean(orgMembership) &&
      !(await isOrganizationDeleted(ctx, args.organizationId));

    if (!hasAccess) {
      return { state: 'no_access' as const };
    }

    return { state: 'ready' as const, role: orgMembership?.role };
  },
});

export async function hasAccessToOrg(
  ctx: QueryCtx | MutationCtx,
  orgId: string,
) {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    return null;
  }

  const user = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier);

  if (!user) {
    return null;
  }

  const hasAccess = user.orgIds.some((item) => item.orgId === orgId);

  if (!hasAccess || (await isOrganizationDeleted(ctx, orgId))) {
    return null;
  }

  return { user };
}
