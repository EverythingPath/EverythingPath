import { ConvexError, v } from 'convex/values';
import { migrationWriteMessages } from '../../src/lib/migration-write-messages';
import { customMutation } from 'convex-helpers/server/customFunctions';
import {
  mutation,
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from '../_generated/server';

export async function readWriteGate(ctx: Pick<QueryCtx, 'db'>) {
  return await ctx.db
    .query('initialMigrationControl')
    .withIndex('by_key', (q) => q.eq('key', 'character-sheet'))
    .unique();
}

async function requireOpenWriteGate(ctx: Pick<QueryCtx, 'db'>) {
  const control = await readWriteGate(ctx);
  if (control?.closed)
    throw new ConvexError({
      code: 'MAINTENANCE',
      message: migrationWriteMessages.maintenance,
    });
  return control;
}

export async function requireWrites(
  ctx: Pick<QueryCtx, 'db'>,
  writeEpoch?: number,
  writerClass: 'legacyCharacter' | 'general' = 'legacyCharacter',
) {
  const control = await requireOpenWriteGate(ctx);
  const epoch = control?.epoch ?? 0;
  if (
    (writerClass === 'legacyCharacter' && control?.authority === 'sheet') ||
    (writeEpoch ?? 0) !== epoch
  ) {
    throw new ConvexError({
      code: 'RELOAD_REQUIRED',
      message: migrationWriteMessages.reload_required,
    });
  }
  return epoch;
}

export const writeGate = {
  args: { writeEpoch: v.optional(v.number()) },
  input: async (ctx: MutationCtx, args: { writeEpoch?: number }) => ({
    ctx: { writeEpoch: await requireWrites(ctx, args.writeEpoch) },
    args: {},
  }),
};

export const generalWriteGate = {
  args: writeGate.args,
  input: async (ctx: MutationCtx, args: { writeEpoch?: number }) => ({
    ctx: { writeEpoch: await requireWrites(ctx, args.writeEpoch, 'general') },
    args: {},
  }),
};

// The indexed control read participates in every writing transaction, including
// the absent-row case. Convex OCC serializes it against closure and reopening.
export const gatedMutation = customMutation(mutation, writeGate);
export const gatedInternalMutation = customMutation(
  internalMutation,
  writeGate,
);
export const generalInternalMutation = customMutation(
  internalMutation,
  generalWriteGate,
);

// Provider deliveries recheck their own record timestamps after maintenance;
// they are not browser commands and do not inherit a page's write epoch.
export const gatedWebhookMutation = customMutation(internalMutation, {
  args: { writeEpoch: v.optional(v.number()) },
  input: async (ctx: MutationCtx) => {
    await requireOpenWriteGate(ctx);
    return { ctx: {}, args: {} };
  },
});
