// @vitest-environment node
import { Webhook } from 'svix';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  readIdentityProjection,
  syncLocalIdentities,
} from '../scripts/local-convex/identities';

const clerk = vi.hoisted(() => ({
  users: { getUserList: vi.fn(), getOrganizationMembershipList: vi.fn() },
}));
vi.mock('@clerk/nextjs/server', () => ({ createClerkClient: () => clerk }));
const secret = `whsec_${Buffer.alloc(32, 1).toString('base64')}`;
const clerkHost = 'fixture.clerk.accounts.dev';
const token = (userId: string) => `https://${clerkHost}|${userId}`;

// Clerk's development instance: users and their organization IDs.
let clerkUsers: Record<string, string[]>;
beforeEach(() => {
  clerkUsers = { user_present: ['org_current'] };
  clerk.users.getUserList.mockImplementation(async () => ({
    data: Object.keys(clerkUsers).map((id) => ({
      id,
      firstName: 'Test',
      lastName: 'User',
      imageUrl: '',
      updatedAt: 1000,
    })),
    totalCount: Object.keys(clerkUsers).length,
  }));
  clerk.users.getOrganizationMembershipList.mockImplementation(
    async ({ userId }: { userId: string }) => ({
      data: (clerkUsers[userId] ?? []).map((id) => ({
        organization: { id },
        role: 'org:member',
        updatedAt: 1000,
      })),
      totalCount: (clerkUsers[userId] ?? []).length,
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const eventSchema = z.object({
  type: z.string(),
  data: z.object({
    id: z.string().optional(),
    public_user_data: z.object({ user_id: z.string() }).optional(),
    organization: z.object({ id: z.string() }).optional(),
  }),
});
type Event = z.infer<typeof eventSchema>;

/**
 * The local backend: it applies each verified webhook to its projection, as
 * convex/http.ts does, and fails the requests `failing` picks.
 */
function localBackend(
  projection: Record<string, string[]> = {},
  failing: (event: Event) => boolean = () => false,
) {
  const events: Event[] = [];
  vi.stubGlobal('fetch', (url: string, options: RequestInit) => {
    expect(url).toBe('http://127.0.0.1:3211/clerk');
    const headers = Object.fromEntries(new Headers(options.headers).entries());
    if (typeof options.body !== 'string') throw new Error('Expected JSON body');
    const event = eventSchema.parse(
      new Webhook(secret).verify(options.body, headers),
    );
    events.push(event);
    if (failing(event))
      return Promise.resolve(new Response(null, { status: 500 }));
    const userId = event.data.public_user_data?.user_id ?? event.data.id ?? '';
    const orgId = event.data.organization?.id ?? '';
    const key = token(userId);
    if (event.type === 'user.updated') projection[key] ??= [];
    if (event.type === 'user.deleted') delete projection[key];
    if (event.type === 'organizationMembership.updated')
      projection[key] = [...new Set([...(projection[key] ?? []), orgId])];
    if (event.type === 'organizationMembership.deleted')
      projection[key] = (projection[key] ?? []).filter((id) => id !== orgId);
    return Promise.resolve(new Response(null, { status: 200 }));
  });
  const sync = (siteUrl = 'http://127.0.0.1:3211', secretKey = 'sk_test_x') =>
    syncLocalIdentities({
      siteUrl,
      secretKey,
      clerkHost,
      webhookSecret: secret,
      readProjection: async () =>
        Object.entries(projection).map(([tokenIdentifier, orgIds]) => ({
          tokenIdentifier,
          orgIds,
        })),
    });
  return { projection, events, sync };
}

it('replays signed identities and removes what the backend holds but Clerk no longer has', async () => {
  const backend = localBackend({
    [token('user_present')]: ['org_old'],
    [token('user_removed')]: ['org_old'],
    // Another issuer's account is not this Clerk instance's to remove.
    'https://other.clerk.accounts.dev|user_other': ['org_old'],
  });
  await expect(backend.sync()).resolves.toBe(1);
  expect(backend.events.map(({ type, data }) => [type, data])).toEqual([
    ['user.updated', expect.objectContaining({ id: 'user_present' })],
    [
      'organizationMembership.updated',
      expect.objectContaining({ organization: { id: 'org_current' } }),
    ],
    [
      'organizationMembership.deleted',
      expect.objectContaining({ organization: { id: 'org_old' } }),
    ],
    ['user.deleted', { id: 'user_removed' }],
  ]);
  expect(backend.projection).toEqual({
    [token('user_present')]: ['org_current'],
    'https://other.clerk.accounts.dev|user_other': ['org_old'],
  });
});

it('revokes a grant from a sync that failed part-way once Clerk revokes it', async () => {
  clerkUsers = { user_present: ['org_first', 'org_second'] };
  let isFailing = true;
  const backend = localBackend(
    {},
    (event) => isFailing && event.data.organization?.id === 'org_second',
  );
  // The first grant succeeds, then a later request fails.
  await expect(backend.sync()).rejects.toThrow('synchronization failed');
  expect(backend.projection).toEqual({
    [token('user_present')]: ['org_first'],
  });
  // Clerk revokes the first membership before the retry.
  clerkUsers = { user_present: ['org_second'] };
  isFailing = false;
  await expect(backend.sync()).resolves.toBe(1);
  expect(backend.projection).toEqual({
    [token('user_present')]: ['org_second'],
  });
});

it('revokes stale grants with no local record of earlier syncs', async () => {
  // A surviving volume after the checkout's local state was deleted.
  const backend = localBackend({
    [token('user_present')]: ['org_current', 'org_revoked'],
    [token('user_gone')]: ['org_current'],
  });
  await backend.sync();
  expect(backend.projection).toEqual({
    [token('user_present')]: ['org_current'],
  });
});

it('refuses remote backends and production Clerk before any provider request', async () => {
  const backend = localBackend();
  await expect(backend.sync('https://other.convex.site')).rejects.toThrow(
    'development Clerk and local Convex',
  );
  await expect(
    backend.sync('http://127.0.0.1:3211', 'sk_live_fixture'),
  ).rejects.toThrow('development Clerk and local Convex');
  expect(backend.events).toEqual([]);
  expect(clerk.users.getUserList).not.toHaveBeenCalled();
});

it('reads the backend projection page by page', async () => {
  const pages = [
    { users: [{ tokenIdentifier: 'a', orgIds: ['org'] }], next: 'a' },
    { users: [{ tokenIdentifier: 'b', orgIds: [] }], next: null },
  ];
  const query = vi.fn(async () => JSON.stringify(pages.shift()));
  await expect(readIdentityProjection(query)).resolves.toEqual([
    { tokenIdentifier: 'a', orgIds: ['org'] },
    { tokenIdentifier: 'b', orgIds: [] },
  ]);
  expect(query.mock.calls).toEqual([[{}], [{ after: 'a' }]]);
});
