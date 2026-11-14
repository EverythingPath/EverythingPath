import { spawn } from 'node:child_process';
import {
  HarnessFailure,
  type LocalBackendReason,
} from '../../e2e/support/diagnostics';

/**
 * Kept free before a caller's deadline for removing what startup created.
 * Rollback and cleanup share one deadline this far ahead, however many
 * Docker calls they make.
 */
export const localBackendCleanupReserveMs = 30_000;
const dockerCapMs = 120_000;

/**
 * An absolute deadline (epoch ms) and a cancellation signal, both optional.
 * `cleanupReserveMs` is a test seam; it defaults to the 30-second reserve.
 */
export type StartupBudget = {
  deadline?: number;
  signal?: AbortSignal;
  cleanupReserveMs?: number;
};

export function localBackendFailure({
  reason,
  name,
}: {
  reason: LocalBackendReason;
  name?: string;
}) {
  return new HarnessFailure({
    kind: 'local-backend',
    reason,
    ...(name ? { name } : {}),
  });
}

export const readLocalBackendReason = (error: unknown) =>
  error instanceof HarnessFailure && error.diagnostic.kind === 'local-backend'
    ? error.diagnostic.reason
    : undefined;

export const getCleanupReserveMs = (budget: StartupBudget) =>
  budget.cleanupReserveMs ?? localBackendCleanupReserveMs;

/** Time a startup step may take: its cap, or less near the deadline. */
export function getStartupAllowanceMs({
  budget,
  capMs,
}: {
  budget: StartupBudget;
  capMs: number;
}) {
  if (budget.signal?.aborted)
    throw localBackendFailure({ reason: 'interrupted' });
  if (budget.deadline === undefined) return capMs;
  const leftMs = budget.deadline - Date.now() - getCleanupReserveMs(budget);
  if (leftMs <= 0) throw localBackendFailure({ reason: 'timeout' });
  return Math.min(capMs, leftMs);
}

/**
 * One Docker client call. It is killed at `timeoutMs` (`timeout`) or when
 * `signal` aborts (`interrupted`); any other failure is `docker`.
 */
export function runDocker({
  args,
  timeoutMs,
  signal,
}: {
  args: string[];
  timeoutMs: number;
  signal?: AbortSignal;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted)
      return reject(localBackendFailure({ reason: 'interrupted' }));
    const child = spawn('docker', args, {
      // The caller handles Ctrl+C and waits for Docker to report whether the
      // daemon created the container before removing it.
      detached: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    // Docker errors can contain container environment and admin credentials.
    let reason: LocalBackendReason = 'docker';
    let stdout = '';
    let isKilled = false;
    const kill = (why: LocalBackendReason) => {
      if (isKilled) return;
      isKilled = true;
      reason = why;
      child.kill('SIGKILL');
    };
    const timer = setTimeout(() => kill('timeout'), timeoutMs);
    const abort = () => kill('interrupted');
    signal?.addEventListener('abort', abort, { once: true });
    const release = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    };
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
      if (stdout.length > 1024 * 1024) kill('docker');
    });
    child.once('error', () => {
      release();
      reject(localBackendFailure({ reason: 'docker' }));
    });
    child.once('close', (code) => {
      release();
      if (code === 0 && !isKilled) resolve(stdout.trim());
      else reject(localBackendFailure({ reason }));
    });
  });
}

/** A startup Docker call, within the budget's time and cancellation. */
export const runStartupDocker = ({
  budget,
  args,
  capMs = dockerCapMs,
}: {
  budget: StartupBudget;
  args: string[];
  capMs?: number;
}) =>
  runDocker({
    args,
    timeoutMs: getStartupAllowanceMs({ budget, capMs }),
    signal: budget.signal,
  });

/** The one absolute deadline a rollback or cleanup shares across its calls. */
export const createCleanupDeadline = (budget: StartupBudget = {}) =>
  Date.now() + getCleanupReserveMs(budget);

/** A cleanup Docker call: never canceled, ending by `cleanupDeadline`. */
export function runCleanupDocker({
  args,
  cleanupDeadline,
}: {
  args: string[];
  cleanupDeadline: number;
}) {
  const leftMs = cleanupDeadline - Date.now();
  if (leftMs <= 0)
    return Promise.reject(localBackendFailure({ reason: 'timeout' }));
  return runDocker({ args, timeoutMs: Math.min(dockerCapMs, leftMs) });
}

/** Rethrows a plain Docker failure as `reason`; time and cancellation stay. */
export async function relabelDockerFailure<T>({
  step,
  reason,
  name,
}: {
  step: Promise<T>;
  reason: LocalBackendReason;
  name?: string;
}): Promise<T> {
  try {
    return await step;
  } catch (error) {
    throw readLocalBackendReason(error) === 'docker'
      ? localBackendFailure({ reason, name })
      : error;
  }
}
