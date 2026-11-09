// The trusted lifecycle drivers, the organization departure return (#706), the
// account deletion (#708) and the campaign and organization deletions (#710),
// share this orchestration. Each runs one bounded step per transaction as a
// nested mutation under the Write Gate, records a failed step on its
// Character and sets a repeatedly failing Character aside so the others go
// on. A deletion's stages without a Character, such as clearing a deleted
// campaign's live data, run through `driveLifecycleStage` on the same terms.
import { ConvexError } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import type { ReadCtx } from '../types';
import { readCompanionGraph } from './companionRelationshipGraph';
import { readCharacterSheetDataWithBudget } from './characterSheetData';
import { createCharacterMoveReadBudget } from './characterMoveGroup';
import { readWriteGate } from './writeGate';

/** Failed steps after which a Character is set aside so the others go on. */
const setAsideAfterFailures = 3;

/**
 * How long a trusted return waits after a membership removal before it starts
 * (#708). Access is revoked at once; if the account's deletion arrives within
 * this time, deletion policy keeps its campaign Characters in the campaign.
 */
export const departureGraceMs = 5 * 60_000;

const maintenanceRetryMs = 60_000;

// Sheet authority, and a Character set aside after repeated failures, retry
// on this slower schedule.
export const slowRetryMs = 60 * 60_000;

/**
 * Trusted returns start at the group's associated Character, even when an
 * older Companion is first in the campaign's index. Voluntary Companion
 * moves never call this helper. The graph supplies live eligibility, so
 * support loss, replacement and different-owner links stop the ascent.
 */
export async function readLifecycleReturnRoot(
  ctx: ReadCtx,
  character: Doc<'character'>,
  roots?: Map<Id<'character'>, Doc<'character'>>,
) {
  const cached = roots?.get(character._id);
  if (cached) return cached;
  const metrics = await ctx.meta.getTransactionMetrics();
  const resourceLimits = {
    maximumTotalBytesRead: Math.min(
      4 * 1024 * 1024,
      metrics.bytesRead.remaining - 1024 * 1024,
    ),
    maximumReferences: Math.min(4096, metrics.documentsRead.remaining - 1024),
    maximumDocumentsRead: Math.min(
      4096,
      metrics.documentsRead.remaining - 1024,
    ),
  };
  if (
    resourceLimits.maximumTotalBytesRead <= 0 ||
    resourceLimits.maximumReferences <= 0
  )
    throw new ConvexError(
      'This Companion group is too large to check at once. Try again.',
    );
  const readBudget = createCharacterMoveReadBudget(resourceLimits);
  const graph = await readCompanionGraph(ctx, character._id, [], {
    readBudget,
    readSheet: (endpoint) =>
      readCharacterSheetDataWithBudget(
        ctx,
        endpoint,
        [],
        { resourceLimits, includeAcceptedWarnings: false },
        readBudget,
      ),
  });
  function findRoot(start: Doc<'character'>) {
    let root = start;
    const visited = new Set([root._id]);
    while (true) {
      const link = graph.active.get(root._id);
      const associated =
        link && graph.characters.get(link.associatedCharacterId);
      if (
        !associated?.sheetMode ||
        !root.ownerId ||
        associated.ownerId !== root.ownerId ||
        associated.campaignId !== root.campaignId
      )
        return root;
      if (visited.has(associated._id))
        throw new ConvexError('Companion relationships contain a cycle');
      visited.add(associated._id);
      root = associated;
    }
  }
  if (roots)
    for (const endpoint of graph.characters.values())
      if (endpoint) roots.set(endpoint._id, findRoot(endpoint));
  return findRoot(character);
}

/**
 * Discovery must not strand the whole lifecycle on a malformed graph. It
 * selects that Character for the nested step, where root resolution repeats
 * under rollback and the driver records its failure and slower retry.
 */
export async function readLifecycleReturnCandidate(
  ctx: ReadCtx,
  character: Doc<'character'>,
  roots: Map<Id<'character'>, Doc<'character'>>,
) {
  try {
    return await readLifecycleReturnRoot(ctx, character, roots);
  } catch (error) {
    if (!(error instanceof ConvexError)) throw error;
    return character;
  }
}

// Headroom a driver keeps to record a failed step and schedule its retry.
const driverReserve = {
  bytesRead: 64 * 1024,
  bytesWritten: 64 * 1024,
  databaseQueries: 16,
  documentsRead: 16,
  documentsWritten: 4,
  functionsScheduled: 2,
  scheduledFunctionArgsBytes: 4 * 1024,
};

function describeFailure(error: unknown) {
  if (error instanceof ConvexError)
    return (
      typeof error.data === 'string' ? error.data : JSON.stringify(error.data)
    ).slice(0, 500);
  if (error instanceof Error) return error.message.slice(0, 500);
  return String(error).slice(0, 500);
}

/**
 * Whether a step may run now. Maintenance holds it briefly. Sheet authority
 * refuses every legacy Character writer, so it holds the work on the slow
 * schedule without counting a failure against any Character.
 */
async function readStepGate(ctx: MutationCtx) {
  const control = await readWriteGate(ctx);
  if (control?.closed)
    return { kind: 'held' as const, retryMs: maintenanceRetryMs };
  if (control?.authority === 'sheet')
    return { kind: 'held' as const, retryMs: slowRetryMs };
  return { kind: 'open' as const, writeEpoch: control?.epoch ?? 0 };
}

/** The driver's remaining budget, less what it keeps to record a failure. */
async function stepTransactionLimits(ctx: MutationCtx) {
  const metrics = await ctx.meta.getTransactionMetrics();
  const headroom = (metric: keyof typeof driverReserve) =>
    Math.max(0, metrics[metric].remaining - driverReserve[metric]);
  return {
    bytesRead: headroom('bytesRead'),
    bytesWritten: headroom('bytesWritten'),
    databaseQueries: headroom('databaseQueries'),
    documentsRead: headroom('documentsRead'),
    documentsWritten: headroom('documentsWritten'),
    functionsScheduled: headroom('functionsScheduled'),
    scheduledFunctionArgsBytes: headroom('scheduledFunctionArgsBytes'),
  };
}

export type StepTransactionLimits = Awaited<
  ReturnType<typeof stepTransactionLimits>
>;

/** A Character's recorded failed steps, counted up to the set-aside limit. */
export type LifecycleFailure = {
  failures: number;
  setAside: boolean;
  lastFailure: string;
};

/** A driver run: the main pass, or with `characterId` one set-aside retry. */
type DriveArgs = { characterId?: Id<'character'> };

/** What one lifecycle supplies to the shared driver. */
export type LifecycleWork<Args extends DriveArgs, Failure> = {
  /** Whether the main pass still has work to do. */
  isPassCurrent: boolean;
  /**
   * The main pass's next Character, skipping those set aside. With none
   * left it records the lifecycle's completion and returns null.
   */
  nextCharacterOrComplete: () => Promise<Id<'character'> | null>;
  /**
   * One bounded step for the Character as a nested transaction, `done` once
   * it needs nothing more.
   */
  runStep: (
    characterId: Id<'character'>,
    writeEpoch: number,
    transactionLimits: StepTransactionLimits,
  ) => Promise<'done' | 'pending'>;
  readFailure: (characterId: Id<'character'>) => Promise<Failure | null>;
  writeFailure: (
    characterId: Id<'character'>,
    failure: LifecycleFailure,
    existing: Failure | null,
  ) => Promise<void>;
  clearFailure: (existing: Failure) => Promise<void>;
  schedule: (args: Args, delayMs?: number) => Promise<unknown>;
};

/** Whether this run still has work: the main pass, or its Character's retry. */
async function isDriveCurrent<Args extends DriveArgs, Failure>(
  args: Args,
  work: LifecycleWork<Args, Failure>,
) {
  return args.characterId
    ? Boolean(await work.readFailure(args.characterId))
    : work.isPassCurrent;
}

/**
 * Schedule what follows a failed step. A Character still under the limit is
 * retried soon with backoff. Once set aside, its own slower retry starts and
 * the main pass continues with the other Characters.
 */
async function scheduleAfterFailure<Args extends DriveArgs, Failure>(
  args: Args,
  work: LifecycleWork<Args, Failure>,
  characterId: Id<'character'>,
  failure: LifecycleFailure,
) {
  if (args.characterId) return work.schedule(args, slowRetryMs);
  if (!failure.setAside)
    return work.schedule(args, 1000 * 2 ** failure.failures);
  await work.schedule({ ...args, characterId }, slowRetryMs);
  await work.schedule(args);
}

/** Record a failed step on its Character and schedule what follows it. */
async function recordFailure<
  Args extends DriveArgs,
  Failure extends { failures: number },
>(
  args: Args,
  work: LifecycleWork<Args, Failure>,
  characterId: Id<'character'>,
  error: unknown,
) {
  const existing = await work.readFailure(characterId);
  const failures = Math.min(
    setAsideAfterFailures,
    (existing?.failures ?? 0) + 1,
  );
  const failure = {
    failures,
    setAside: failures >= setAsideAfterFailures,
    lastFailure: describeFailure(error),
  };
  await work.writeFailure(characterId, failure, existing);
  await scheduleAfterFailure(args, work, characterId, failure);
}

/**
 * Run one driver step: hold under maintenance or sheet authority, choose the
 * Character, run its step as a nested transaction and schedule what follows.
 * A failed step rolls back alone and is recorded on its Character, so a
 * change to backoff or the set-aside rule applies to every lifecycle.
 */
export async function driveLifecycle<
  Args extends DriveArgs,
  Failure extends { failures: number },
>(ctx: MutationCtx, args: Args, work: LifecycleWork<Args, Failure>) {
  if (!(await isDriveCurrent(args, work))) return;
  const gate = await readStepGate(ctx);
  if (gate.kind === 'held') {
    await work.schedule(args, gate.retryMs);
    return;
  }
  const characterId =
    args.characterId ?? (await work.nextCharacterOrComplete());
  if (!characterId) return;
  try {
    const state = await work.runStep(
      characterId,
      gate.writeEpoch,
      await stepTransactionLimits(ctx),
    );
    if (state === 'done') {
      // A Character needing nothing more no longer carries its failures.
      const failure = await work.readFailure(characterId);
      if (failure) await work.clearFailure(failure);
      if (args.characterId) return;
    }
    await work.schedule(args);
  } catch (error) {
    await recordFailure(args, work, characterId, error);
  }
}

/** What one lifecycle stage without a Character supplies to the driver. */
export type LifecycleStageWork<Args> = {
  /** Whether the stage still has work to do. */
  isCurrent: boolean;
  /**
   * One bounded step as a nested transaction: `pending` to run the next step
   * now, `waitMs` to run it later, `done` once nothing more is needed. The
   * step itself records the lifecycle's next state.
   */
  runStep: (
    writeEpoch: number,
    transactionLimits: StepTransactionLimits,
  ) => Promise<'done' | 'pending' | { waitMs: number }>;
  /** Record the latest failed step, kept until a later step succeeds. */
  writeFailure: (lastFailure: string) => Promise<void>;
  schedule: (args: Args, delayMs?: number) => Promise<unknown>;
};

/**
 * Run one step of a lifecycle stage that has no Character: hold under
 * maintenance or sheet authority, run the step as a nested transaction and
 * schedule what follows. A failed step rolls back alone, is recorded and is
 * retried on the slow schedule, so the stage never ends half done.
 */
export async function driveLifecycleStage<Args>(
  ctx: MutationCtx,
  args: Args,
  work: LifecycleStageWork<Args>,
) {
  if (!work.isCurrent) return;
  const gate = await readStepGate(ctx);
  if (gate.kind === 'held') {
    await work.schedule(args, gate.retryMs);
    return;
  }
  try {
    const state = await work.runStep(
      gate.writeEpoch,
      await stepTransactionLimits(ctx),
    );
    if (state === 'pending') await work.schedule(args);
    else if (state !== 'done') await work.schedule(args, state.waitMs);
  } catch (error) {
    await work.writeFailure(describeFailure(error));
    await work.schedule(args, slowRetryMs);
  }
}
