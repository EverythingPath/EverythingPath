import { randomUUID } from 'node:crypto';
import { link, readdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { CaseKey } from '../fixtures/catalog';
import { isolationDiagnostic, writeConflictDiagnostic } from './artifacts';
import { HarnessFailure } from './diagnostics';
import { processStopSignal, wait } from './cancellation';
import { CommandFailure, savePrivate } from './process';

// Parallel workers may claim the same key at once. The owner is written to a
// private temporary file and linked into place: link refuses an existing
// name atomically, so exactly one test wins and no reader sees a partial file.
export async function claimCaseKey(
  privateDirectory: string,
  workerKey: string,
  caseKey: string,
  testId: string,
) {
  const path = join(
    privateDirectory,
    'case-owners',
    `${workerKey}-${caseKey}.json`,
  );
  const candidate = `${path}.${randomUUID()}.claim`;
  await savePrivate(candidate, testId);
  try {
    await link(candidate, path);
    return;
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST'))
      throw error;
  } finally {
    await rm(candidate, { force: true });
  }
  // A retry of the owning test reclaims its key.
  if ((await readFile(path, 'utf8')) !== testId)
    throw new Error(
      'Each browser test must declare a distinct fixture case key',
    );
}

// Cleanup runs only after a successful reset and receives what it returned,
// so it can name the campaign the case owns (#754).
export async function caseAttempt<T>(
  reset: () => Promise<T>,
  use: (fixture: T) => Promise<void>,
  cleanup: (fixture: T) => Promise<void>,
  onCleanupError: (error: unknown) => void | Promise<void>,
) {
  const fixture = await reset();
  try {
    await use(fixture);
  } finally {
    await cleanup(fixture).catch(onCleanupError);
  }
}

// A cleanup that still failed after `attempts` tries; `cause` is the last
// failure.
export class CleanupFailure extends Error {
  constructor(
    readonly cause: unknown,
    readonly attempts: number,
  ) {
    super('E2E case cleanup failed', { cause });
    this.name = 'CleanupFailure';
  }
}

const cleanupAttempts = 3;

// Only a write conflict is repeated: Convex reports one when another
// transaction kept changing what the mutation read, and the same mutation can
// succeed once that work is done (docs.convex.dev/error, "Write conflicts").
// The command must have exited on its own, so a timeout or Ctrl+C (which stop
// it) is never repeated. Every other rejection fails the same way again.
function isTransientCleanupFailure(error: unknown) {
  return (
    error instanceof CommandFailure &&
    error.code === undefined &&
    error.exitCode !== null &&
    error.diagnostics.includes(writeConflictDiagnostic)
  );
}

/**
 * Runs a case's cleanup up to three times.
 *
 * Composed bound (#754), per case cleanup: these 3 attempts, plus the one
 * cleanup `writeFixture` (process.ts) sends with the new epoch after the
 * server rejected a stale one, which ends the sequence; so at most 4
 * `cleanupCase` executions reach Convex. Each of them may be spawned up to 3
 * times, because a spawn the kernel refused is retried twice, so at most 12
 * `cleanupCase` processes start. `fixture-retries.test.ts` drives that worst
 * case. A cleanup can lose its write
 * conflicts to a job the journey scheduled just before it ended (the draft
 * retirement after a Confirmation); `cleanupCase` is one transaction that
 * deletes whatever is left of the case, so repeating it is safe. A retry
 * starts only before `stopAt`, when the browsers must stop, and never after
 * the run is cancelled (`signal`, by default this process's SIGINT/SIGTERM),
 * which also ends the wait at once.
 */
export async function retryCleanup({
  cleanup,
  stopAt,
  signal,
  now = Date.now,
  sleep = wait,
  delayMs = 500,
}: {
  cleanup: () => Promise<void>;
  stopAt: number;
  signal?: AbortSignal;
  now?: () => number;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  /** The first wait; each later one is this times the attempt. */
  delayMs?: number;
}) {
  const stop = signal ? undefined : processStopSignal();
  const cancelled = signal ?? stop?.signal;
  try {
    for (let attempt = 1; ; attempt++) {
      try {
        return await cleanup();
      } catch (error) {
        const waitMs = delayMs * attempt;
        const mayRetry = () => !cancelled?.aborted && now() < stopAt;
        if (
          attempt === cleanupAttempts ||
          !isTransientCleanupFailure(error) ||
          !mayRetry() ||
          now() + waitMs >= stopAt
        )
          throw new CleanupFailure(error, attempt);
        await sleep(waitMs, cancelled);
        if (!mayRetry()) throw new CleanupFailure(error, attempt);
      }
    }
  } finally {
    stop?.release();
  }
}

// The cases a finally failed cleanup left in a cohort, one empty file each,
// so a Playwright worker restarted after a failure still knows them.
const leftoverDirectory = (privateDirectory: string, workerKey: string) =>
  join(privateDirectory, 'leftover-cases', workerKey);

/** The case reset again, which removed whatever it had left behind. */
export async function clearLeftoverCase({
  privateDirectory,
  workerKey,
  caseKey,
}: {
  privateDirectory: string;
  workerKey: string;
  caseKey: CaseKey;
}) {
  await rm(join(leftoverDirectory(privateDirectory, workerKey), caseKey), {
    force: true,
  });
}

// A Write Gate epoch change fails the attempt clearly, whether or not its
// cleanup then completed (process.ts). Any other cleanup failure only warns:
// the next reset's isolation canary catches the case it left behind, and
// `describeResetFailure` names it.
export async function handleCleanupFailure({
  error,
  scope,
  warn,
  privateDirectory,
}: {
  error: unknown;
  scope: { workerKey: string; caseKey: CaseKey };
  warn: (line: string) => void;
  /** Where the run records the case left behind, when given. */
  privateDirectory?: string;
}) {
  const cause = error instanceof CleanupFailure ? error.cause : error;
  const epochChange =
    cause instanceof HarnessFailure && cause.diagnostic.kind === 'write-epoch'
      ? cause.diagnostic
      : undefined;
  if (epochChange?.outcome !== 'cleaned' && privateDirectory)
    await savePrivate(
      join(leftoverDirectory(privateDirectory, scope.workerKey), scope.caseKey),
      '',
    );
  if (epochChange) throw cause;
  const attempts = error instanceof CleanupFailure ? error.attempts : 1;
  warn(
    `E2E case cleanup failed for ${scope.caseKey} in ${scope.workerKey} after ${attempts} ${attempts === 1 ? 'attempt' : 'attempts'}; other tests in ${scope.workerKey} fail the isolation check until the case is reset.\n`,
  );
}

/**
 * A reset the cohort's isolation canary refused while a case a failed cleanup
 * left behind is still there: reported as blocked by that case, so a cascade
 * reads as one cause. Any other failure is returned as it was.
 */
export async function describeResetFailure({
  error,
  privateDirectory,
  workerKey,
}: {
  error: unknown;
  privateDirectory: string;
  workerKey: string;
}) {
  if (
    !(error instanceof CommandFailure) ||
    !error.diagnostics.includes(isolationDiagnostic)
  )
    return error;
  const leftovers = await readdir(
    leftoverDirectory(privateDirectory, workerKey),
  ).catch(() => []);
  if (leftovers.length === 0) return error;
  return new Error(
    `${error.stage}: blocked by leftover case ${leftovers.sort().join(', ')} in ${workerKey}, whose cleanup failed earlier in this run`,
    { cause: error },
  );
}
