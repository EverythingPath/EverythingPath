import { ConvexError, v, type Infer } from 'convex/values';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import type { Doc } from '../_generated/dataModel';
import { readWriteGate } from './writeGate';
import { catalogRuntimeCompatibility } from '../../src/lib/catalog/runtime-compatibility';

export const backfillReceipt = v.object({
  runId: v.id('initialMigrationRun'),
  epoch: v.number(),
  captureId: v.string(),
});
export type BackfillReceipt = Infer<typeof backfillReceipt>;
type RunOptions = { requireCapture?: boolean };

export async function findBackfillRunProblem(
  ctx: Pick<QueryCtx, 'db'>,
  receipt: BackfillReceipt,
  { requireCapture = true }: RunOptions = {},
): Promise<{ run: Doc<'initialMigrationRun'> | null; problem: string | null }> {
  const control = await readWriteGate(ctx);
  const run = await ctx.db.get('initialMigrationRun', receipt.runId);
  if (
    !control?.closed ||
    control.authority !== 'legacy' ||
    control.runId !== receipt.runId ||
    control.epoch !== receipt.epoch ||
    run?.epoch !== receipt.epoch ||
    run.state !== 'maintenance'
  )
    return {
      run,
      problem:
        'Backfill requires the current closed legacy Write Gate and epoch',
    };
  if (requireCapture && run.backfill?.captureId !== receipt.captureId)
    return { run, problem: 'Backfill input capture is no longer current' };
  if (
    requireCapture &&
    (run.backfill?.schemaIdentity !== catalogRuntimeCompatibility.schema ||
      run.backfill?.calculationIdentity !==
        catalogRuntimeCompatibility.calculation ||
      run.backfill?.catalogManifest !== run.catalogManifest ||
      run.backfill?.frontendBuild !== run.frontendBuild)
  )
    return {
      run,
      problem:
        'Backfill compatibility changed; abort and capture current inputs again',
    };
  return { run, problem: null };
}

export async function requireClosedBackfillRun(
  ctx: Pick<QueryCtx, 'db'>,
  receipt: BackfillReceipt,
  options: RunOptions = {},
) {
  const { run, problem } = await findBackfillRunProblem(ctx, receipt, options);
  if (problem || !run)
    throw new ConvexError(problem ?? 'Migration Run is missing');
  return run;
}

export async function requireCapturedBackfillRun(
  ctx: Pick<QueryCtx, 'db'>,
  receipt: BackfillReceipt,
) {
  const run = await requireClosedBackfillRun(ctx, receipt);
  if (!run.backfill) throw new ConvexError('Backfill input capture is missing');
  return { run, state: run.backfill };
}

// Both operator interfaces use this helper in their own transaction.
export async function abortInitialMigrationRun(
  ctx: MutationCtx,
  receipt: Pick<BackfillReceipt, 'runId' | 'epoch'>,
) {
  const control = await readWriteGate(ctx);
  const run = await ctx.db.get('initialMigrationRun', receipt.runId);
  if (
    !control ||
    control.runId !== run?._id ||
    run.epoch !== receipt.epoch ||
    control.authority !== 'legacy'
  )
    throw new ConvexError(
      'Migration run is no longer current or has activated. Inspect status.',
    );
  if (
    run.state === 'aborted' &&
    !control.closed &&
    control.epoch === receipt.epoch + 1
  )
    return { epoch: control.epoch };
  if (
    !control.closed ||
    control.epoch !== receipt.epoch ||
    run.state !== 'maintenance'
  )
    throw new ConvexError(
      'Migration run is no longer current or has activated. Inspect status.',
    );
  const epoch = control.epoch + 1;
  await ctx.db.patch('initialMigrationControl', control._id, {
    epoch,
    closed: false,
  });
  await ctx.db.patch('initialMigrationRun', run._id, {
    state: 'aborted',
    abortedAt: Date.now(),
  });
  return { epoch };
}
