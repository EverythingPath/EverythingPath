// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { internal } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

test('lists every account with its organization IDs, page by page', async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    for (let index = 0; index < 101; index++)
      await ctx.db.insert('user', {
        tokenIdentifier: `https://clerk.test|user_${String(index).padStart(3, '0')}`,
        orgIds:
          index === 0
            ? [
                { orgId: 'org_a', role: 'admin' },
                { orgId: 'org_b', role: 'member' },
              ]
            : [],
      });
  });
  const first = await t.query(internal.user.listIdentityProjection, {});
  expect(first.users).toHaveLength(100);
  expect(first.users[0]).toEqual({
    tokenIdentifier: 'https://clerk.test|user_000',
    orgIds: ['org_a', 'org_b'],
  });
  expect(first.next).toBe('https://clerk.test|user_099');
  const second = await t.query(internal.user.listIdentityProjection, {
    after: first.next ?? undefined,
  });
  expect(second).toEqual({
    users: [{ tokenIdentifier: 'https://clerk.test|user_100', orgIds: [] }],
    next: null,
  });
});
