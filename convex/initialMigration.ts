import { ConvexError, v } from 'convex/values';
import { internalMutation, internalQuery, query } from './_generated/server';
import { readWriteGate } from './lib/writeGate';
import { readCutover } from './lib/campaignRuntime';
import { abortInitialMigrationRun } from './lib/initialCharacterBackfill';

const runReceipt = v.object({
  runId: v.id('initialMigrationRun'),
  epoch: v.number(),
});

export const clientStatus = query({
  args: {},
  returns: v.object({
    status: v.union(
      v.literal('ready'),
      v.literal('maintenance'),
      v.literal('reload_required'),
    ),
    epoch: v.number(),
  }),
  handler: async (ctx) => {
    const control = await readWriteGate(ctx);
    const paused = (await readCutover(ctx))?.status === 'paused';
    return {
      status:
        control?.closed || paused
          ? ('maintenance' as const)
          : control?.authority === 'sheet'
            ? ('reload_required' as const)
            : ('ready' as const),
      epoch: control?.epoch ?? 0,
    };
  },
});

export const start = internalMutation({
  args: {
    operationId: v.string(),
    expectedEpoch: v.number(),
    frontendBuild: v.string(),
    catalogManifest: v.string(),
    maintenanceBudgetMs: v.number(),
  },
  returns: runReceipt,
  handler: async (ctx, args) => {
    const control = await readWriteGate(ctx);
    const existing = await ctx.db
      .query('initialMigrationRun')
      .withIndex('by_operationId', (q) => q.eq('operationId', args.operationId))
      .unique();
    if (existing) {
      if (
        existing.state === 'maintenance' &&
        control?.closed &&
        control.runId === existing._id &&
        existing.epoch === control.epoch &&
        args.expectedEpoch === existing.epoch - 1 &&
        args.frontendBuild === existing.frontendBuild &&
        args.catalogManifest === existing.catalogManifest &&
        args.maintenanceBudgetMs === existing.deadline - existing.startedAt
      )
        return { runId: existing._id, epoch: existing.epoch };
      throw new ConvexError(
        'Migration operation already used; inspect status before starting another run.',
      );
    }
    if (
      control?.closed ||
      control?.authority === 'sheet' ||
      args.expectedEpoch !== (control?.epoch ?? 0)
    )
      throw new ConvexError(
        'Migration state changed; inspect status before starting.',
      );
    if (
      !args.operationId.trim() ||
      !args.frontendBuild.trim() ||
      !args.catalogManifest.trim() ||
      !Number.isSafeInteger(args.maintenanceBudgetMs) ||
      args.maintenanceBudgetMs <= 0
    )
      throw new ConvexError(
        'Supply operation, frontend and catalog identities and a positive maintenance budget.',
      );
    const epoch = (control?.epoch ?? 0) + 1;
    const startedAt = Date.now();
    const runId = await ctx.db.insert('initialMigrationRun', {
      operationId: args.operationId,
      epoch,
      state: 'maintenance',
      frontendBuild: args.frontendBuild,
      catalogManifest: args.catalogManifest,
      startedAt,
      deadline: startedAt + args.maintenanceBudgetMs,
    });
    if (control)
      await ctx.db.patch('initialMigrationControl', control._id, {
        closed: true,
        epoch,
        runId,
      });
    else
      await ctx.db.insert('initialMigrationControl', {
        key: 'character-sheet',
        closed: true,
        authority: 'legacy',
        epoch,
        runId,
      });
    return { runId, epoch };
  },
});

export const status = internalQuery({
  args: { now: v.number() },
  returns: v.object({
    epoch: v.number(),
    closed: v.boolean(),
    budgetExceeded: v.boolean(),
    authority: v.union(v.literal('legacy'), v.literal('sheet')),
    run: v.union(
      v.null(),
      v.object({
        ...runReceipt.fields,
        operationId: v.string(),
        state: v.union(
          v.literal('maintenance'),
          v.literal('aborted'),
          v.literal('activated'),
        ),
        frontendBuild: v.string(),
        catalogManifest: v.string(),
        startedAt: v.number(),
        deadline: v.number(),
        abortedAt: v.optional(v.number()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const control = await readWriteGate(ctx);
    const run = control
      ? await ctx.db.get('initialMigrationRun', control.runId)
      : null;
    return {
      epoch: control?.epoch ?? 0,
      closed: control?.closed ?? false,
      budgetExceeded: Boolean(
        control?.closed &&
        run?.state === 'maintenance' &&
        args.now >= run.deadline,
      ),
      authority: control?.authority ?? ('legacy' as const),
      run: run
        ? {
            runId: run._id,
            epoch: run.epoch,
            operationId: run.operationId,
            state: run.state,
            frontendBuild: run.frontendBuild,
            catalogManifest: run.catalogManifest,
            startedAt: run.startedAt,
            deadline: run.deadline,
            ...(run.abortedAt === undefined
              ? {}
              : { abortedAt: run.abortedAt }),
          }
        : null,
    };
  },
});

export const abortBeforeActivation = internalMutation({
  args: runReceipt,
  returns: v.object({ epoch: v.number() }),
  handler: abortInitialMigrationRun,
});
