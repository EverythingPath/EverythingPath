import type { FunctionArgs, FunctionReturnType } from 'convex/server';
import type { internal } from '../../convex/_generated/api';
import { catalogReleaseLimits } from '../../src/lib/catalog/release-limits.ts';

type ImpactFunctions = typeof internal.catalogReleaseImpact;
export type CatalogReleaseImpactCommandAdapter = {
  [Name in
    | 'start'
    | 'discover'
    | 'evaluate'
    | 'complete'
    | 'finish'
    | 'status'
    | 'retry'
    | 'retryDiscovery']: (
    args: FunctionArgs<ImpactFunctions[Name]>,
  ) => Promise<FunctionReturnType<ImpactFunctions[Name]>>;
} & {
  inspectWork(args: FunctionArgs<ImpactFunctions['inspectWork']>): Promise<{
    page: Pick<
      FunctionReturnType<ImpactFunctions['inspectWork']>['page'][number],
      'characterId'
    >[];
    isDone: boolean;
    continueCursor: string;
  }>;
};

export const DEFAULT_IMPACT_MAX_STEPS = 100;
const MAX_WORK_PAGE_ROWS = catalogReleaseLimits.characterBatchRows;
const MAX_WORK_PAGE_BYTES = 512000;
type ImpactStatus = Awaited<
  ReturnType<CatalogReleaseImpactCommandAdapter['status']>
>;
type ImpactCommandSession = {
  runId: FunctionArgs<ImpactFunctions['status']>['runId'];
  adapter: CatalogReleaseImpactCommandAdapter;
  writeEpoch: number;
  maxSteps: number;
  status: ImpactStatus;
  stepCount: number;
  staleCompletionCount: number;
  isSealed: boolean;
};

function workPagination(cursor: string | null) {
  return {
    cursor,
    numItems: MAX_WORK_PAGE_ROWS,
    maximumRowsRead: MAX_WORK_PAGE_ROWS,
    maximumBytesRead: MAX_WORK_PAGE_BYTES,
  };
}

async function refreshStatus(session: ImpactCommandSession) {
  session.status = await session.adapter.status({ runId: session.runId });
}

async function retryFailedWork(session: ImpactCommandSession) {
  if (session.status.discoveryError) {
    await session.adapter.retryDiscovery({
      runId: session.runId,
      writeEpoch: session.writeEpoch,
    });
    session.stepCount++;
    await refreshStatus(session);
    if (session.status.discoveryError) return;
  }
  let cursor: string | null = null;
  while (
    session.status.failedCount > 0 &&
    session.stepCount < session.maxSteps
  ) {
    const work = await session.adapter.inspectWork({
      runId: session.runId,
      state: 'failed',
      paginationOpts: workPagination(cursor),
    });
    if (work.page.length === 0) session.stepCount++;
    for (const { characterId } of work.page) {
      if (session.stepCount >= session.maxSteps) break;
      await session.adapter.retry({
        runId: session.runId,
        characterId,
        writeEpoch: session.writeEpoch,
      });
      session.stepCount++;
    }
    cursor = work.isDone ? null : work.continueCursor;
    await refreshStatus(session);
  }
}

async function discoverDependencies(session: ImpactCommandSession) {
  while (
    !session.status.isDiscoveryComplete &&
    !session.status.discoveryError &&
    session.stepCount < session.maxSteps
  ) {
    await session.adapter.discover({
      runId: session.runId,
      writeEpoch: session.writeEpoch,
    });
    session.stepCount++;
    await refreshStatus(session);
  }
}

async function reconcileDirtyWork(session: ImpactCommandSession) {
  let cursor: string | null = null;
  while (
    session.status.isDiscoveryComplete &&
    !session.status.discoveryError &&
    session.status.pendingCount > 0 &&
    session.stepCount < session.maxSteps
  ) {
    const work = await session.adapter.inspectWork({
      runId: session.runId,
      state: 'dirty',
      paginationOpts: workPagination(cursor),
    });
    if (work.page.length === 0) session.stepCount++;
    for (const { characterId } of work.page) {
      if (session.stepCount >= session.maxSteps) break;
      const evaluation = await session.adapter.evaluate({
        runId: session.runId,
        characterId,
      });
      const isCompleted = await session.adapter.complete({
        runId: session.runId,
        characterId,
        evaluation,
        writeEpoch: session.writeEpoch,
      });
      if (!isCompleted) session.staleCompletionCount++;
      session.stepCount++;
    }
    cursor = work.isDone ? null : work.continueCursor;
    await refreshStatus(session);
  }
}

function stoppedReason(
  session: ImpactCommandSession,
): 'ready' | 'failed' | 'limit' | 'pending' {
  if (session.status.discoveryError) return 'failed';
  if (session.status.isReady && session.isSealed) return 'ready';
  if (
    (!session.status.isDiscoveryComplete ||
      session.status.pendingCount > 0 ||
      (session.status.isReady && !session.isSealed)) &&
    session.stepCount >= session.maxSteps
  )
    return 'limit';
  if (session.status.failedCount > 0) return 'failed';
  return 'pending';
}

async function reconcileAndSeal(session: ImpactCommandSession) {
  while (true) {
    await reconcileDirtyWork(session);
    if (!session.status.isReady) return;
    session.isSealed = await session.adapter.finish({
      runId: session.runId,
      writeEpoch: session.writeEpoch,
    });
    if (!session.isSealed && session.stepCount < session.maxSteps)
      session.stepCount++;
    await refreshStatus(session);
    if (session.isSealed || session.stepCount >= session.maxSteps) return;
  }
}

export async function runCatalogReleaseImpactCommand({
  releaseNumber,
  adapter,
  writeEpoch = 0,
  maxSteps = DEFAULT_IMPACT_MAX_STEPS,
  retryFailed = false,
}: {
  releaseNumber: number;
  adapter: CatalogReleaseImpactCommandAdapter;
  writeEpoch?: number;
  maxSteps?: number;
  retryFailed?: boolean;
}) {
  if (!Number.isSafeInteger(releaseNumber) || releaseNumber < 1)
    throw new Error('Invalid Catalog Release number.');
  if (!Number.isSafeInteger(writeEpoch) || writeEpoch < 0)
    throw new Error('Invalid release write epoch.');
  if (!Number.isSafeInteger(maxSteps) || maxSteps < 1)
    throw new Error('Reconciliation work budget must be a positive integer.');
  const runId = await adapter.start({ releaseNumber, writeEpoch });
  const session: ImpactCommandSession = {
    runId,
    adapter,
    writeEpoch,
    maxSteps,
    status: await adapter.status({ runId }),
    stepCount: 0,
    staleCompletionCount: 0,
    isSealed: false,
  };
  if (retryFailed) await retryFailedWork(session);
  await discoverDependencies(session);
  await reconcileAndSeal(session);
  return {
    runId,
    status: session.status,
    stepCount: session.stepCount,
    staleCompletionCount: session.staleCompletionCount,
    stopped: stoppedReason(session),
  };
}
