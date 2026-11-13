// @vitest-environment node
import { expect, it } from 'vitest';
import type { Id } from '../../convex/_generated/dataModel';
import {
  runCatalogReleaseImpactCommand,
  type CatalogReleaseImpactCommandAdapter,
} from '../../scripts/catalog/release-impact-command';

function fixture() {
  const runId = 'candidate-run' as Id<'catalogImpactRun'>;
  const characterId = 'character-vessa' as Id<'character'>;
  let registered = false;
  let isDiscoveryComplete = false;
  let dirty = true;
  const savedEpochs: number[] = [];
  const adapter: CatalogReleaseImpactCommandAdapter = {
    async start({ writeEpoch }) {
      registered = true;
      savedEpochs.push(writeEpoch ?? 0);
      return runId;
    },
    async discover({ writeEpoch }) {
      if (!registered)
        throw new Error('Discovery requires registered tracking');
      savedEpochs.push(writeEpoch ?? 0);
      isDiscoveryComplete = true;
      return true;
    },
    async status() {
      return {
        isDiscoveryComplete,
        pendingCount: dirty ? 1 : 0,
        failedCount: 0,
        isReady: isDiscoveryComplete && !dirty,
      };
    },
    async inspectWork() {
      return {
        page: dirty ? [{ characterId }] : [],
        isDone: true,
        continueCursor: '',
      };
    },
    async evaluate() {
      return {
        revision: 1,
        inputFingerprint: 'current-input',
        result: { kind: 'unaffected' },
      };
    },
    async complete({ writeEpoch }) {
      savedEpochs.push(writeEpoch ?? 0);
      dirty = false;
      return true;
    },
    async retry() {
      return null;
    },
    async retryDiscovery() {
      return null;
    },
    async finish({ writeEpoch }) {
      savedEpochs.push(writeEpoch ?? 0);
      return true;
    },
  };
  return { adapter, runId, savedEpochs };
}

it('registers tracking before discovery and reconciles private candidate work with a fixed epoch', async () => {
  const { adapter, runId, savedEpochs } = fixture();
  expect(
    await runCatalogReleaseImpactCommand({
      releaseNumber: 7,
      adapter,
      writeEpoch: 4,
    }),
  ).toMatchObject({
    runId,
    status: {
      isDiscoveryComplete: true,
      pendingCount: 0,
      failedCount: 0,
      isReady: true,
    },
    stopped: 'ready',
    stepCount: 2,
    staleCompletionCount: 0,
  });
  expect(savedEpochs.every((epoch) => epoch === 4)).toBe(true);
});

it('reconciles an edit racing with final sealing before reporting ready', async () => {
  const { adapter } = fixture();
  const characterId = 'character-vessa' as Id<'character'>;
  let hasPendingEdit = true;
  let hasRaced = false;
  adapter.status = async () => ({
    isDiscoveryComplete: true,
    pendingCount: hasPendingEdit ? 1 : 0,
    failedCount: 0,
    isReady: !hasPendingEdit,
  });
  adapter.inspectWork = async () => ({
    page: hasPendingEdit ? [{ characterId }] : [],
    isDone: true,
    continueCursor: '',
  });
  adapter.complete = async () => {
    hasPendingEdit = false;
    return true;
  };
  adapter.finish = async () => {
    if (!hasRaced) {
      hasRaced = true;
      hasPendingEdit = true;
      return false;
    }
    return true;
  };
  expect(
    await runCatalogReleaseImpactCommand({ releaseNumber: 7, adapter }),
  ).toMatchObject({
    stopped: 'ready',
    stepCount: 3,
    status: { pendingCount: 0 },
  });
});

it('keeps refused sealing within the work budget after the final allowed completion', async () => {
  const { adapter } = fixture();
  let hasCompleted = false;
  adapter.status = async () => ({
    isDiscoveryComplete: true,
    pendingCount: hasCompleted ? 0 : 1,
    failedCount: 0,
    isReady: hasCompleted,
  });
  adapter.complete = async () => {
    hasCompleted = true;
    return true;
  };
  adapter.finish = async () => false;
  expect(
    await runCatalogReleaseImpactCommand({
      releaseNumber: 7,
      adapter,
      maxSteps: 1,
    }),
  ).toMatchObject({ stopped: 'limit', stepCount: 1 });
});

it('reports failure when the final allowed evaluation fails and no work remains pending', async () => {
  const { adapter } = fixture();
  let hasFailed = false;
  adapter.status = async () => ({
    isDiscoveryComplete: true,
    pendingCount: hasFailed ? 0 : 1,
    failedCount: hasFailed ? 1 : 0,
    isReady: false,
  });
  adapter.complete = async () => {
    hasFailed = true;
    return true;
  };
  expect(
    await runCatalogReleaseImpactCommand({
      releaseNumber: 7,
      adapter,
      maxSteps: 1,
    }),
  ).toMatchObject({ stopped: 'failed', stepCount: 1 });
});

it('stops at its work budget and resumes the same run without repeating completed discovery', async () => {
  const { adapter, runId } = fixture();
  expect(
    await runCatalogReleaseImpactCommand({
      releaseNumber: 7,
      adapter,
      maxSteps: 1,
    }),
  ).toMatchObject({
    runId,
    stopped: 'limit',
    stepCount: 1,
    status: { isDiscoveryComplete: true, pendingCount: 1, isReady: false },
  });
  expect(
    await runCatalogReleaseImpactCommand({
      releaseNumber: 7,
      adapter,
      maxSteps: 1,
    }),
  ).toMatchObject({
    runId,
    stopped: 'ready',
    stepCount: 1,
    status: { pendingCount: 0, isReady: true },
  });
});

it('keeps stale completions pending and evaluates the newer revision before reporting ready', async () => {
  const { adapter } = fixture();
  const complete = adapter.complete;
  const evaluate = adapter.evaluate;
  let edited = false;
  adapter.evaluate = async (args) => ({
    ...(await evaluate(args)),
    revision: edited ? 2 : 1,
  });
  adapter.complete = async (args) => {
    if (!edited) {
      edited = true;
      return false;
    }
    if (args.evaluation.revision !== 2) return false;
    return complete(args);
  };
  expect(
    await runCatalogReleaseImpactCommand({ releaseNumber: 7, adapter }),
  ).toMatchObject({
    status: { pendingCount: 0, isReady: true },
    staleCompletionCount: 1,
    stepCount: 3,
    stopped: 'ready',
  });
});

it('advances past stale work to reconcile later pages within its budget', async () => {
  const { adapter } = fixture();
  const staleId = 'stale-character' as Id<'character'>;
  const laterId = 'later-character' as Id<'character'>;
  let isLaterReady = false;
  adapter.status = async () => ({
    isDiscoveryComplete: true,
    pendingCount: isLaterReady ? 1 : 2,
    failedCount: 0,
    isReady: false,
  });
  adapter.inspectWork = async ({ paginationOpts }) =>
    paginationOpts.cursor === 'after-stale'
      ? { page: [{ characterId: laterId }], isDone: true, continueCursor: '' }
      : {
          page: [{ characterId: staleId }],
          isDone: false,
          continueCursor: 'after-stale',
        };
  adapter.complete = async ({ characterId }) => {
    if (characterId === staleId) return false;
    isLaterReady = true;
    return true;
  };
  expect(
    await runCatalogReleaseImpactCommand({
      releaseNumber: 7,
      adapter,
      maxSteps: 2,
    }),
  ).toMatchObject({
    stopped: 'limit',
    stepCount: 2,
    staleCompletionCount: 1,
    status: { pendingCount: 1 },
  });
});

it('starts a new pass when concurrent completion empties the last page but earlier work is dirty', async () => {
  const { adapter } = fixture();
  const characterId = 'redirtied-character' as Id<'character'>;
  let isReady = false;
  let hasEvaluated = false;
  adapter.status = async () => ({
    isDiscoveryComplete: true,
    pendingCount: isReady ? 0 : 1,
    failedCount: 0,
    isReady: isReady,
  });
  adapter.inspectWork = async ({ paginationOpts }) =>
    paginationOpts.cursor === 'after-character'
      ? { page: [], isDone: true, continueCursor: '' }
      : {
          page: [{ characterId }],
          isDone: false,
          continueCursor: 'after-character',
        };
  adapter.complete = async () => {
    if (!hasEvaluated) {
      hasEvaluated = true;
      return false;
    }
    isReady = true;
    return true;
  };
  expect(
    await runCatalogReleaseImpactCommand({
      releaseNumber: 7,
      adapter,
      maxSteps: 3,
    }),
  ).toMatchObject({ stopped: 'ready', stepCount: 3, staleCompletionCount: 1 });
});

it('reports failed work and retries it only when explicitly requested', async () => {
  const { adapter, runId } = fixture();
  const characterId = 'failed-vessa' as Id<'character'>;
  let state: 'failed' | 'dirty' | 'ready' = 'failed';
  adapter.status = async () => ({
    isDiscoveryComplete: true,
    pendingCount: state === 'dirty' ? 1 : 0,
    failedCount: state === 'failed' ? 1 : 0,
    isReady: state === 'ready',
  });
  adapter.inspectWork = async (args) => ({
    page: args.state === state ? [{ characterId }] : [],
    isDone: true,
    continueCursor: '',
  });
  adapter.retry = async () => {
    state = 'dirty';
    return null;
  };
  adapter.complete = async () => {
    state = 'ready';
    return true;
  };
  expect(
    await runCatalogReleaseImpactCommand({ releaseNumber: 7, adapter }),
  ).toMatchObject({
    runId,
    stopped: 'failed',
    status: { pendingCount: 0, failedCount: 1, isReady: false },
  });
  expect(
    await runCatalogReleaseImpactCommand({
      releaseNumber: 7,
      adapter,
      retryFailed: true,
    }),
  ).toMatchObject({
    runId,
    stopped: 'ready',
    stepCount: 2,
    status: { pendingCount: 0, failedCount: 0, isReady: true },
  });
});

it('resumes after a lost completion response without recalculating work the server already completed', async () => {
  const { adapter, runId } = fixture();
  const complete = adapter.complete;
  adapter.complete = async (args) => {
    await complete(args);
    throw new Error('Lost completion response');
  };
  await expect(
    runCatalogReleaseImpactCommand({ releaseNumber: 7, adapter }),
  ).rejects.toThrow('Lost completion response');
  expect(
    await runCatalogReleaseImpactCommand({ releaseNumber: 7, adapter }),
  ).toMatchObject({
    runId,
    stopped: 'ready',
    stepCount: 0,
    status: { pendingCount: 0, isReady: true },
  });
});

it('reports discovery failures and restarts discovery only on an explicit retry', async () => {
  const { adapter } = fixture();
  let discoveryError: string | undefined =
    'Resource inventory exceeds representative limit';
  const status = adapter.status;
  adapter.status = async (args) => ({
    ...(await status(args)),
    ...(discoveryError ? { discoveryError } : {}),
  });
  const discover = adapter.discover;
  adapter.discover = async (args) => {
    if (discoveryError) return false;
    return discover(args);
  };
  adapter.retryDiscovery = async () => {
    discoveryError = undefined;
    return null;
  };
  expect(
    await runCatalogReleaseImpactCommand({ releaseNumber: 7, adapter }),
  ).toMatchObject({
    stopped: 'failed',
    status: {
      isDiscoveryComplete: false,
      discoveryError: 'Resource inventory exceeds representative limit',
      isReady: false,
    },
  });
  expect(
    await runCatalogReleaseImpactCommand({
      releaseNumber: 7,
      adapter,
      retryFailed: true,
    }),
  ).toMatchObject({
    stopped: 'ready',
    stepCount: 3,
    status: { isReady: true },
  });
});
