import { internalQuery } from './_generated/server';
import { TableAggregate } from '@convex-dev/aggregate';
import { components } from './_generated/api';
import type { DataModel } from './_generated/dataModel';

export const aggregate = new TableAggregate<{
  Key: null;
  DataModel: DataModel;
  TableName: 'spell';
}>(components.aggregate, {
  sortKey: (_) => null,
});

// Legacy spell table: internal only. It sits outside the notice system and
// has no client caller, so none of its functions is public.
export const get = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('spell').collect();
  },
});

export const getCount = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await aggregate.count(ctx);
  },
});
