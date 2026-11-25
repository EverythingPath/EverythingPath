import { randomUUID } from 'node:crypto';
import { Webhook } from 'svix';
import { createClerkClient } from '@clerk/nextjs/server';
import { z } from 'zod';
import { isLocalConvexUrl } from '../../src/lib/local-convex-url';

const projectionPageSchema = z.object({
  users: z.array(
    z.object({ tokenIdentifier: z.string(), orgIds: z.array(z.string()) }),
  ),
  next: z.string().nullable(),
});
export type ProjectedIdentity = z.infer<
  typeof projectionPageSchema
>['users'][number];

/**
 * What the local backend holds now (`user:listIdentityProjection`), read
 * page by page through `query`, which runs it with the admin key.
 */
export async function readIdentityProjection(
  query: (args: { after?: string }) => Promise<string>,
) {
  const users: ProjectedIdentity[] = [];
  let after: string | undefined;
  for (;;) {
    const page = projectionPageSchema.parse(
      JSON.parse(await query(after === undefined ? {} : { after })),
    );
    users.push(...page.users);
    if (page.next === null) return users;
    if (page.next === after)
      throw new Error('Local identity pagination made no progress');
    after = page.next;
  }
}

/**
 * Read the development Clerk instance and replay signed events only locally.
 * Removals are computed against what the backend holds (`readProjection`),
 * never against a saved snapshot: a grant from a sync that failed part-way,
 * or from a lost snapshot, is revoked once Clerk no longer has it.
 */
export async function syncLocalIdentities({
  secretKey,
  webhookSecret,
  siteUrl,
  clerkHost,
  readProjection,
}: {
  secretKey: string;
  webhookSecret: string;
  siteUrl: string;
  clerkHost: string;
  readProjection: () => Promise<ProjectedIdentity[]>;
}) {
  if (!secretKey.startsWith('sk_test_') || !isLocalConvexUrl(siteUrl))
    throw new Error(
      'Identity sync requires development Clerk and local Convex',
    );
  const clerk = createClerkClient({ secretKey });
  const signer = new Webhook(webhookSecret);
  // convex/http.ts derives each token identifier from this issuer.
  const issuer = `https://${clerkHost}|`;
  const held = new Map<string, string[]>();
  for (const user of await readProjection())
    if (user.tokenIdentifier.startsWith(issuer))
      held.set(user.tokenIdentifier.slice(issuer.length), user.orgIds);
  const send = async (type: string, data: Record<string, unknown>) => {
    const payload = JSON.stringify({ type, data });
    const id = randomUUID();
    const timestamp = new Date();
    const response = await fetch(`${siteUrl}/clerk`, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
      headers: {
        'Content-Type': 'application/json',
        'svix-id': id,
        'svix-timestamp': String(Math.floor(timestamp.getTime() / 1000)),
        'svix-signature': signer.sign(id, timestamp, payload),
      },
      body: payload,
    });
    if (!response.ok)
      throw new Error('Local Clerk identity synchronization failed');
  };
  const current = new Set<string>();
  for (let offset = 0; ; offset += 100) {
    const users = await clerk.users.getUserList({ limit: 100, offset });
    for (const user of users.data) {
      current.add(user.id);
      await send('user.updated', {
        id: user.id,
        first_name: user.firstName,
        last_name: user.lastName,
        image_url: user.imageUrl,
        updated_at: user.updatedAt,
      });
      const organizations: string[] = [];
      for (let memberOffset = 0; ; memberOffset += 100) {
        const memberships = await clerk.users.getOrganizationMembershipList({
          userId: user.id,
          limit: 100,
          offset: memberOffset,
        });
        for (const membership of memberships.data) {
          organizations.push(membership.organization.id);
          await send('organizationMembership.updated', {
            public_user_data: { user_id: user.id },
            organization: { id: membership.organization.id },
            role: membership.role,
            updated_at: membership.updatedAt,
          });
        }
        if (memberOffset + memberships.data.length >= memberships.totalCount)
          break;
        if (!memberships.data.length)
          throw new Error('Clerk membership pagination made no progress');
      }
      for (const organization of held.get(user.id) ?? []) {
        if (!organizations.includes(organization))
          await send('organizationMembership.deleted', {
            public_user_data: { user_id: user.id },
            organization: { id: organization },
            updated_at: Date.now(),
          });
      }
    }
    if (offset + users.data.length >= users.totalCount) break;
    if (!users.data.length)
      throw new Error('Clerk user pagination made no progress');
  }
  for (const userId of held.keys()) {
    if (!current.has(userId)) await send('user.deleted', { id: userId });
  }
  return current.size;
}
