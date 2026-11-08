// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test, vi } from 'vitest';
import { api, internal } from './_generated/api';
import schema from './schema';

// The provider's signature verifier is the external boundary; exercise the real
// HTTP route, action and mutations beneath it without provider credentials.
vi.mock('svix', () => ({
  Webhook: class {
    verify(payload: string, headers: Record<string, string>) {
      if (headers['svix-signature'] !== 'valid')
        throw new Error('Invalid signature');
      return JSON.parse(payload);
    }
  },
}));

const modules = import.meta.glob('./**/*.ts');

test.each(['organizationMembership.created', 'organizationMembership.updated'])(
  'signed %s events for unknown users receive a permanent error',
  async (type) => {
    const t = convexTest(schema, modules);
    const response = await t.fetch('/clerk', {
      method: 'POST',
      body: JSON.stringify({
        type,
        data: {
          public_user_data: { user_id: 'unknown-user' },
          organization: { id: 'org' },
          role: 'org:member',
          updated_at: 1,
        },
      }),
      headers: {
        'svix-id': 'delivery',
        'svix-timestamp': '1',
        'svix-signature': 'valid',
      },
    });
    expect(response.status).toBe(400);
  },
);

test.each([
  [
    'invalid timestamp',
    { id: 'user', image_url: 'avatar.png', updated_at: -1 },
  ],
  ['invalid payload', { id: 'user', updated_at: 1 }],
])(
  'signed user events with an %s receive a permanent error',
  async (_, data) => {
    const t = convexTest(schema, modules);
    const response = await t.fetch('/clerk', {
      method: 'POST',
      body: JSON.stringify({ type: 'user.created', data }),
      headers: {
        'svix-id': 'delivery',
        'svix-timestamp': '1',
        'svix-signature': 'valid',
      },
    });
    expect(response.status).toBe(400);
  },
);

test('signed identity webhooks continue after authority switches to sheets', async () => {
  const t = convexTest(schema, modules);
  const run = await t.mutation(internal.initialMigration.start, {
    operationId: 'http-reload',
    expectedEpoch: 0,
    frontendBuild: 'build',
    catalogManifest: 'catalog',
    maintenanceBudgetMs: 60000,
  });
  await t.mutation(internal.initialMigration.abortBeforeActivation, run);
  // Activation is owned by a later ticket; install its authority state.
  await t.run(async (ctx) => {
    const control = await ctx.db.query('initialMigrationControl').first();
    if (!control) throw new Error('Write Gate missing');
    await ctx.db.patch('initialMigrationControl', control._id, {
      authority: 'sheet',
    });
  });
  const response = await t.fetch('/clerk', {
    method: 'POST',
    body: JSON.stringify({
      type: 'user.created',
      data: { id: 'user', image_url: 'avatar.png', updated_at: 1 },
    }),
    headers: {
      'svix-id': 'delivery',
      'svix-timestamp': '1',
      'svix-signature': 'valid',
    },
  });
  expect(response.status).toBe(200);
});

test('signed webhooks receive retryable maintenance responses and succeed when redelivered after reopening', async () => {
  const t = convexTest(schema, modules);
  const body = JSON.stringify({
    type: 'user.created',
    data: {
      id: 'webhook-user',
      first_name: 'Provider',
      last_name: 'User',
      image_url: 'avatar.png',
      updated_at: 1,
    },
  });
  const deliver = (signature: string) =>
    t.fetch('/clerk', {
      method: 'POST',
      body,
      headers: {
        'svix-id': 'delivery',
        'svix-timestamp': '1',
        'svix-signature': signature,
      },
    });
  const run = await t.mutation(internal.initialMigration.start, {
    operationId: 'http',
    expectedEpoch: 0,
    frontendBuild: 'build',
    catalogManifest: 'catalog',
    maintenanceBudgetMs: 60000,
  });
  expect((await deliver('invalid')).status).toBe(400);
  expect((await deliver('valid')).status).toBe(503);
  await t.mutation(internal.initialMigration.abortBeforeActivation, run);
  expect((await deliver('valid')).status).toBe(200);
  expect((await deliver('valid')).status).toBe(200);
  const users = await t.run((ctx) => ctx.db.query('user').take(2));
  expect(users).toHaveLength(1);
  const user = users[0];
  if (!user) throw new Error('Webhook user missing');
  expect(
    await t
      .withIdentity({ tokenIdentifier: user.tokenIdentifier })
      .query(api.user.getMe, {}),
  ).toMatchObject({ name: 'Provider User' });
});
