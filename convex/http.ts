import { httpRouter } from 'convex/server';
import { findMigrationWriteRejection } from '../src/lib/migration-write-rejection';

import { internal } from './_generated/api';
import { httpAction } from './_generated/server';

const http = httpRouter();

/** The token identifier Convex auth gives a Clerk user. */
function tokenFor(clerkUserId: string) {
  return `https://${process.env.CLERK_HOSTNAME}|${clerkUserId}`;
}

http.route({
  path: '/clerk',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const payloadString = await request.text();
    const headerPayload = request.headers;

    try {
      const result = await ctx.runAction(internal.clerk.fulfill, {
        payload: payloadString,
        headers: {
          'svix-id': headerPayload.get('svix-id'),
          'svix-timestamp': headerPayload.get('svix-timestamp'),
          'svix-signature': headerPayload.get('svix-signature'),
        },
      });

      switch (result.type) {
        case 'user.created':
          await ctx.runMutation(internal.user.createUser, {
            webhookUpdatedAt: result.data.updated_at,
            tokenIdentifier: tokenFor(result.data.id),
            name: `${result.data.first_name ?? ''} ${
              result.data.last_name ?? ''
            }`,
            image: result.data.image_url,
          });
          break;
        case 'user.updated':
          await ctx.runMutation(internal.user.updateUser, {
            webhookUpdatedAt: result.data.updated_at,
            tokenIdentifier: tokenFor(result.data.id),
            name: `${result.data.first_name ?? ''} ${
              result.data.last_name ?? ''
            }`,
            image: result.data.image_url,
          });
          break;
        case 'user.deleted':
          // A deletion carries no update time: it is final, and it takes
          // precedence over every later or reordered event for the account.
          if (!result.data.id) throw new Error('Deleted user ID missing');
          await ctx.runMutation(internal.user.deleteUser, {
            tokenIdentifier: tokenFor(result.data.id),
          });
          break;
        case 'organizationMembership.created':
          await ctx.runMutation(internal.user.addOrgIdToUser, {
            webhookUpdatedAt: result.data.updated_at,
            tokenIdentifier: tokenFor(result.data.public_user_data.user_id),
            orgId: result.data.organization.id,
            role: result.data.role === 'org:admin' ? 'admin' : 'member',
          });
          break;
        case 'organizationMembership.updated':
          await ctx.runMutation(internal.user.updateRoleInOrgForUser, {
            webhookUpdatedAt: result.data.updated_at,
            tokenIdentifier: tokenFor(result.data.public_user_data.user_id),
            orgId: result.data.organization.id,
            role: result.data.role === 'org:admin' ? 'admin' : 'member',
          });
          break;
        case 'organization.deleted':
          // A deletion carries no update time: it is final, and it takes
          // precedence over every later or reordered membership event.
          if (!result.data.id)
            throw new Error('Deleted organization ID missing');
          await ctx.runMutation(
            internal.organizationDeletions.recordProviderDeletion,
            { organizationId: result.data.id },
          );
          break;
        case 'organizationMembership.deleted':
          await ctx.runMutation(internal.user.removeOrgIdFromUser, {
            webhookUpdatedAt: result.data.updated_at,
            tokenIdentifier: tokenFor(result.data.public_user_data.user_id),
            orgId: result.data.organization.id,
          });
          break;
      }

      return new Response(null, {
        status: 200,
      });
    } catch (error) {
      const rejection = findMigrationWriteRejection(error);
      return new Response('Webhook Error', {
        status:
          rejection === 'maintenance' || rejection === 'reload_required'
            ? 503
            : 400,
      });
    }
  }),
});

export default http;
