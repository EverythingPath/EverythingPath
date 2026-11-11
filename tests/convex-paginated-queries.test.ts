// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { beforeAll, expect, test } from 'vitest';
import schema from '../convex/schema';
import {
  refuseRepeatedPaginatedQueries,
  repeatedPaginatedQueryRefusal,
} from './convex-paginated-queries';

const modules = import.meta.glob('../convex/**/*.ts');
beforeAll(() => refuseRepeatedPaginatedQueries(schema, modules));
const firstPage = { cursor: null, numItems: 1 };

test('a second paginated query in one transaction is refused, as on a deployment', async () => {
  const t = convexTest(schema, modules);
  await expect(
    t.run(async (ctx) => {
      await ctx.db.query('user').paginate(firstPage);
      await ctx.db
        .query('campaign')
        .withIndex('by_organization', (q) => q.eq('organizationId', 'org'))
        .paginate(firstPage);
    }),
  ).rejects.toThrow(repeatedPaginatedQueryRefusal);
});

test('one paginated query per transaction, beside other queries, is allowed', async () => {
  const t = convexTest(schema, modules);
  for (let i = 0; i < 2; i++)
    await t.run(async (ctx) => {
      await ctx.db.query('campaign').take(1);
      await ctx.db.query('user').paginate(firstPage);
      await ctx.db.query('campaign').collect();
    });
});
