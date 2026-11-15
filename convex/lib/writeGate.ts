import { ConvexError, v } from 'convex/values';
import { migrationWriteMessages } from '../../src/lib/migration-write-messages';
import { customMutation } from 'convex-helpers/server/customFunctions';
import {
  mutation,
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from '../_generated/server';
import type { Doc } from '../_generated/dataModel';

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

type WriteGateControl = Pick<
  Doc<'initialMigrationControl'>,
  'closed' | 'epoch' | 'authority'
>;

/**
 * The classes the shared gate decides for. Each refuses while the gate is
 * closed and refuses a stale Write Epoch. Under sheet authority the legacy
 * Character class also refuses: it writes the flat Characters a migration
 * starts from. The sheet Character class writes Character Sheets and their
 * Characters under either authority; the general class never writes them.
 */
export type GatedWriterClass = 'legacyCharacter' | 'sheetCharacter' | 'general';

export type WriteDecision =
  | {
      kind: 'allowed';
      epoch: number;
      authority: WriteGateControl['authority'];
    }
  | { kind: 'refused'; code: 'MAINTENANCE' | 'RELOAD_REQUIRED' };

export function decideWrite(
  control: WriteGateControl | null,
  writerClass: GatedWriterClass,
  writeEpoch?: number,
): WriteDecision {
  // A missing control row means legacy authority, open, epoch 0.
  const { closed, epoch, authority } = control ?? {
    closed: false,
    epoch: 0,
    authority: 'legacy' as const,
  };
  if (closed) return { kind: 'refused', code: 'MAINTENANCE' };
  const stale = (writeEpoch ?? 0) !== epoch;
  const fenced = writerClass === 'legacyCharacter' && authority === 'sheet';
  if (stale || fenced) return { kind: 'refused', code: 'RELOAD_REQUIRED' };
  return { kind: 'allowed', epoch, authority };
}

const refusalMessages = {
  MAINTENANCE: migrationWriteMessages.maintenance,
  RELOAD_REQUIRED: migrationWriteMessages.reload_required,
} as const;

export async function requireWrites(
  ctx: Pick<QueryCtx, 'db'>,
  writeEpoch: number | undefined,
  writerClass: GatedWriterClass,
) {
  const decision = decideWrite(await readWriteGate(ctx), writerClass, writeEpoch);
  if (decision.kind === 'refused')
    throw new ConvexError({
      code: decision.code,
      message: refusalMessages[decision.code],
    });
  return decision;
}

export const writeGate = {
  args: { writeEpoch: v.optional(v.number()) },
  input: async (ctx: MutationCtx, args: { writeEpoch?: number }) => {
    const { epoch } = await requireWrites(
      ctx,
      args.writeEpoch,
      'legacyCharacter',
    );
    return { ctx: { writeEpoch: epoch }, args: {} };
  },
};

// A sheet writer learns the authority it runs under, so it can leave the flat
// statistic columns alone once sheets hold the statistics.
export const sheetCharacterWriteGate = {
  args: writeGate.args,
  input: async (ctx: MutationCtx, args: { writeEpoch?: number }) => {
    const { epoch, authority } = await requireWrites(
      ctx,
      args.writeEpoch,
      'sheetCharacter',
    );
    return {
      ctx: { writeEpoch: epoch, characterAuthority: authority },
      args: {},
    };
  },
};

export const generalWriteGate = {
  args: writeGate.args,
  input: async (ctx: MutationCtx, args: { writeEpoch?: number }) => {
    const { epoch } = await requireWrites(ctx, args.writeEpoch, 'general');
    return { ctx: { writeEpoch: epoch }, args: {} };
  },
};

// The indexed control read participates in every writing transaction, including
// the absent-row case. Convex OCC serializes it against closure and reopening.
export const gatedMutation = customMutation(mutation, writeGate);
export const gatedInternalMutation = customMutation(
  internalMutation,
  writeGate,
);
export const sheetCharacterInternalMutation = customMutation(
  internalMutation,
  sheetCharacterWriteGate,
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
