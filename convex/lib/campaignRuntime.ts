import { ConvexError } from 'convex/values';
import { customMutation } from 'convex-helpers/server/customFunctions';
import {
  mutation,
  type MutationCtx,
  type QueryCtx,
} from '../_generated/server';
import { generalWriteGate, writeGate } from './writeGate';
import { migrationWriteMessages } from '../../src/lib/migration-write-messages';

export async function readCutover(ctx: Pick<QueryCtx, 'db'>) {
  return await ctx.db
    .query('campaignCutover')
    .withIndex('by_key', (q) => q.eq('key', 'weekly-draft'))
    .unique();
}

export async function requireCampaignWrites(ctx: Pick<QueryCtx, 'db'>) {
  const control = await readCutover(ctx);
  if (control?.status === 'paused')
    throw new ConvexError({
      code: 'MAINTENANCE',
      message: migrationWriteMessages.maintenance,
    });
}

const writable = {
  ...generalWriteGate,
  input: async (ctx: MutationCtx, args: { writeEpoch?: number }) => {
    const input = await generalWriteGate.input(ctx, args);
    await requireCampaignWrites(ctx);
    return input;
  },
};

// Keep both maintenance checks in one customization so the write epoch stays
// part of the inferred function arguments and handler context.
export const campaignMutation = customMutation(mutation, writable);

export const legacyCharacterMutation = customMutation(mutation, {
  ...writeGate,
  input: async (ctx: MutationCtx, args: { writeEpoch?: number }) => {
    const input = await writeGate.input(ctx, args);
    await requireCampaignWrites(ctx);
    return input;
  },
});
