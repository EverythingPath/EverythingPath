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

/**
 * Whether a backfill receipt still certifies its run's candidates. The receipt
 * is valid while its run is current and any completion marker matches it, the
 * run's validation sweep, the runtime compatibility and the run's catalog
 * manifest; it is activation-ready once that marker records a complete,
 * error-free sweep and, when `now` is given, the run's deadline has not
 * passed. `initialCharacterBackfill:status` and `initialMigration:activate`
 * both decide by it.
 */
export function evaluateBackfillCompletion(
  { run, problem }: Awaited<ReturnType<typeof findBackfillRunProblem>>,
  receipt: BackfillReceipt,
  now?: number,
) {
  if (problem !== null)
    return { isReceiptValid: false, isActivationReady: false };
  const progress = run?.backfill;
  const marker = progress?.completion;
  if (!run || !progress || !marker)
    return { isReceiptValid: true, isActivationReady: false };
  // A marker that names another receipt, sweep, compatibility or manifest
  // voids the receipt rather than certifying it.
  const isReceiptValid = [
    marker.runId === receipt.runId,
    marker.epoch === receipt.epoch,
    marker.captureId === receipt.captureId,
    marker.validationId === progress.validationId,
    progress.stage === 'complete',
    progress.errors === 0,
    progress.isInventoryDone,
    progress.validationPhase === 'done',
    marker.schemaIdentity === catalogRuntimeCompatibility.schema,
    marker.calculationIdentity === catalogRuntimeCompatibility.calculation,
    marker.catalogManifest === run.catalogManifest,
  ].every(Boolean);
  return {
    isReceiptValid,
    isActivationReady:
      isReceiptValid && (now === undefined || now < run.deadline),
  };
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
