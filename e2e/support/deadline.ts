import { HarnessFailure } from './diagnostics';
import { isTrustedGitHubRun, type Environment } from './preflight';

/** CI's budget and the local default (#198); `--budget-minutes` changes it locally. */
export const defaultBudgetMinutes = 17.5;
const minimumBudgetMinutes = 5;
const maximumBudgetMinutes = 120;

/**
 * Time kept after the browsers are told to stop: Playwright's interrupted
 * tests, fixture teardown, its application server's 10 s graceful shutdown and
 * the final report. Run 1 of #729 lost its report because the hard deadline
 * arrived with none of this left.
 */
export const browserStopReserveMs = 60_000;

/**
 * Time kept before an outer supervisor's deadline (CI's workflow interrupts
 * the runner there and kills it 5 s later): terminating what still runs at
 * the run's deadline, reaping every run process and finalizing the
 * checkpoint, all before that interrupt.
 */
export const outerDeadlineReserveMs = 30_000;

/**
 * The run's only clock. The runner computes it once, before any setup, and
 * stores it in the run file; Playwright's `globalTimeout` and the application
 * server's lifetime derive from the stored values, never from their own start.
 * - `deadline`: the hard stop; whatever still runs is terminated. It is the
 *   budget from `startedAt` or, under an outer supervisor, that supervisor's
 *   deadline less `outerDeadlineReserveMs`.
 * - `browserStopAt`: Playwright is interrupted (SIGINT) and its global timeout
 *   ends here, leaving `browserStopReserveMs` for reporting and shutdown.
 */
export function computeRunDeadline({
  startedAt,
  budgetMinutes = defaultBudgetMinutes,
  outerDeadlineAt,
}: {
  startedAt: number;
  budgetMinutes?: number;
  outerDeadlineAt?: number;
}) {
  const deadline =
    outerDeadlineAt === undefined
      ? startedAt + Math.round(budgetMinutes * 60_000)
      : outerDeadlineAt - outerDeadlineReserveMs;
  return { deadline, browserStopAt: deadline - browserStopReserveMs };
}

/** Milliseconds left until an absolute time; a passed time fails the run. */
export function getRemainingMs({ until, now }: { until: number; now: number }) {
  const remainingMs = until - now;
  if (remainingMs <= 0) throw new HarnessFailure({ kind: 'deadline' });
  return remainingMs;
}

/**
 * The runner's time options: `--budget-minutes` (plain decimal minutes, 5 to
 * 120) or, in trusted GitHub CI only, `--outer-deadline-epoch` (the workflow's
 * absolute deadline in whole epoch seconds), never both. Outside CI an outer
 * deadline would bypass the local budget's bounds.
 */
export function parseTimeOptions({
  budgetMinutes,
  outerDeadlineEpoch,
  environment = process.env,
}: {
  budgetMinutes?: string;
  outerDeadlineEpoch?: string;
  environment?: Environment;
}) {
  if (budgetMinutes !== undefined && outerDeadlineEpoch !== undefined)
    throw new HarnessFailure({ kind: 'time-options' });
  if (outerDeadlineEpoch !== undefined) {
    if (!isTrustedGitHubRun(environment))
      throw new HarnessFailure({ kind: 'outer-deadline-ci' });
    if (!/^[1-9][0-9]{8,10}$/.test(outerDeadlineEpoch))
      throw new HarnessFailure({ kind: 'outer-deadline' });
    return { outerDeadlineAt: Number(outerDeadlineEpoch) * 1000 };
  }
  if (budgetMinutes === undefined)
    return { budgetMinutes: defaultBudgetMinutes };
  const minutes = /^[0-9]+(?:\.[0-9]+)?$/.test(budgetMinutes)
    ? Number(budgetMinutes)
    : NaN;
  if (!(minutes >= minimumBudgetMinutes && minutes <= maximumBudgetMinutes))
    throw new HarnessFailure({ kind: 'budget-range' });
  return { budgetMinutes: minutes };
}

/**
 * Playwright's global timeout and the application server's lifetime, from the
 * times the runner stored (never from their own start). At least 1 ms: a
 * global timeout of 0 would mean no limit.
 */
export function readRunClock({
  run,
  now = Date.now(),
}: {
  run: { deadline?: number; browserStopAt?: number };
  now?: number;
}) {
  if (run.deadline === undefined || run.browserStopAt === undefined)
    throw new HarnessFailure({ kind: 'run-file-missing' });
  return {
    globalTimeoutMs: Math.max(1, run.browserStopAt - now),
    serverLifetimeMs: Math.max(1, run.deadline - now),
  };
}
