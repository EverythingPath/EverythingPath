import type { ChildProcess } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';

/** SIGTERM to SIGKILL, for every process the harness stops. */
export const killGraceMs = 5000;
const pollMs = 50;

const isPosix = process.platform !== 'win32';
const pause = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

/** Signals the process group `pid` leads (the process alone on Windows). */
export function signalGroup({
  child,
  signal,
}: {
  child: ChildProcess;
  signal: NodeJS.Signals;
}) {
  try {
    if (child.pid && isPosix) process.kill(-child.pid, signal);
    else child.kill(signal);
  } catch {
    /* The group is already empty. */
  }
}

function isGroupAlive(pid: number) {
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    // EPERM: a member exists that we may not signal.
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/**
 * Polls until every pid `findAlive` returns has exited. Whatever is left is
 * sent SIGTERM (`terminate`), and SIGKILL `killGraceMs` later (`kill`); the
 * survivors after another grace are returned.
 */
async function stopUntilGone<T>({
  findAlive,
  terminate,
  kill,
}: {
  findAlive: () => Promise<T[]>;
  terminate: (alive: T[]) => void;
  kill: (alive: T[]) => void;
}) {
  let alive = await findAlive();
  if (alive.length === 0) return alive;
  terminate(alive);
  for (const [step, escalate] of [
    ['kill', kill],
    ['give up', () => undefined],
  ] as const) {
    const until = Date.now() + killGraceMs;
    while (alive.length > 0 && Date.now() < until) {
      await pause(pollMs);
      alive = await findAlive();
    }
    if (alive.length === 0 || step === 'give up') return alive;
    escalate(alive);
  }
  return alive;
}

/**
 * How a supervised command ended. `isStopped`: the harness interrupted or
 * terminated it. `isGroupEmpty`: false if part of its group survived SIGKILL.
 */
export type GroupOutcome =
  | { kind: 'spawn-failed'; code: string }
  | {
      kind: 'exited';
      exitCode: number | null;
      isStopped: boolean;
      isGroupEmpty: boolean;
    };

/**
 * Supervises a child spawned `detached`, so it leads its own process group:
 * - at `interruptAfterMs` the group gets SIGINT, as from Ctrl+C;
 * - at `timeoutMs` it gets SIGTERM, then SIGKILL after `killGraceMs`;
 * - our own SIGINT or SIGTERM, or `signal` aborting, interrupts an
 *   interruptible command and terminates it `signalGraceMs` later (never
 *   after `timeoutMs`); any other command is terminated at once.
 * Without `timeoutMs` it runs until it exits or is stopped (a long-lived
 * service, such as local development's watchers).
 * When the child exits (not when its pipes close, which a descendant holding
 * them can delay), whatever is left of its group is stopped and awaited; then
 * its output streams are drained.
 */
export function superviseGroup({
  child,
  timeoutMs,
  interruptAfterMs,
  signalGraceMs,
  signal,
}: {
  child: ChildProcess;
  timeoutMs?: number;
  interruptAfterMs?: number;
  signalGraceMs: number;
  signal?: AbortSignal;
}): Promise<GroupOutcome> {
  let isStopped = false;
  let isTerminating = false;
  let hasInterrupted = false;
  let forceKill: ReturnType<typeof setTimeout> | undefined;
  const terminate = () => {
    isStopped = true;
    if (isTerminating) return;
    isTerminating = true;
    forceKill = setTimeout(
      () => signalGroup({ child, signal: 'SIGKILL' }),
      killGraceMs,
    );
    signalGroup({ child, signal: 'SIGTERM' });
  };
  const interrupt = () => {
    isStopped = true;
    if (hasInterrupted || isTerminating) return;
    hasInterrupted = true;
    signalGroup({ child, signal: 'SIGINT' });
  };
  const terminateAt =
    timeoutMs === undefined ? Infinity : Date.now() + timeoutMs;
  let timeout =
    timeoutMs === undefined ? undefined : setTimeout(terminate, timeoutMs);
  const interruption =
    interruptAfterMs === undefined
      ? undefined
      : setTimeout(interrupt, interruptAfterMs);
  const stop = () => {
    if (interruptAfterMs === undefined) return terminate();
    interrupt();
    clearTimeout(timeout);
    timeout = setTimeout(
      terminate,
      Math.min(signalGraceMs, terminateAt - Date.now()),
    );
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  signal?.addEventListener('abort', stop, { once: true });
  const release = () => {
    clearTimeout(timeout);
    clearTimeout(interruption);
    clearTimeout(forceKill);
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    signal?.removeEventListener('abort', stop);
  };
  if (signal?.aborted) stop();

  const closed = new Promise<void>((done) => child.once('close', () => done()));
  return new Promise<GroupOutcome>((resolve) => {
    child.once('error', (error: NodeJS.ErrnoException) => {
      release();
      resolve({ kind: 'spawn-failed', code: error.code ?? 'unknown' });
    });
    child.once('exit', (exitCode) => {
      clearTimeout(timeout);
      clearTimeout(interruption);
      const wasStopped = isStopped;
      void reapExitedGroup({ child, terminate, closed }).then(
        (isGroupEmpty) => {
          release();
          resolve({
            kind: 'exited',
            exitCode,
            isStopped: wasStopped,
            isGroupEmpty,
          });
        },
      );
    });
  });
}

/**
 * After the group leader exited: stops and awaits the rest of its group, then
 * waits for its pipes to close. A holder outside the group cannot keep them
 * open past one grace period.
 */
async function reapExitedGroup({
  child,
  terminate,
  closed,
}: {
  child: ChildProcess;
  terminate: () => void;
  closed: Promise<void>;
}) {
  const pid = child.pid;
  const survivors =
    pid && isPosix
      ? await stopUntilGone({
          findAlive: () => Promise.resolve(isGroupAlive(pid) ? [pid] : []),
          terminate,
          // `terminate` already armed SIGKILL; repeat it in case it fired early.
          kill: () => signalGroup({ child, signal: 'SIGKILL' }),
        })
      : [];
  let graceTimer: ReturnType<typeof setTimeout> | undefined;
  const isClosed = await Promise.race([
    closed.then(() => true),
    new Promise<boolean>((done) => {
      graceTimer = setTimeout(() => done(false), killGraceMs);
    }),
  ]);
  clearTimeout(graceTimer);
  if (!isClosed)
    for (const stream of [child.stdout, child.stderr]) stream?.destroy();
  return survivors.length === 0;
}

/** The variable that marks every process a run starts (runner.ts). */
export const runTokenVariable = 'E2E_RUN_TOKEN';

/** Live processes whose environment carries `token` (Linux `/proc`). */
async function findRunProcesses(token: string) {
  const marker = `${runTokenVariable}=${token}`;
  const entries = await readdir('/proc').catch(() => []);
  const found: number[] = [];
  for (const entry of entries) {
    if (!/^[0-9]+$/.test(entry)) continue;
    const environment = await readFile(`/proc/${entry}/environ`, 'utf8').catch(
      () => '',
    );
    if (environment.split('\0').includes(marker)) found.push(Number(entry));
  }
  return found;
}

function signalEach({
  pids,
  signal,
}: {
  pids: number[];
  signal: NodeJS.Signals;
}) {
  for (const pid of pids)
    try {
      process.kill(pid, signal);
    } catch {
      /* Already gone. */
    }
}

/**
 * Stops and awaits every process the run started, in whatever process group
 * it runs (Playwright's browsers, its application server and that server's
 * own group included). Returns the pids that survived SIGKILL.
 */
export function reapRunProcesses({ token }: { token: string }) {
  return stopUntilGone({
    findAlive: () => findRunProcesses(token),
    terminate: (pids) => signalEach({ pids, signal: 'SIGTERM' }),
    kill: (pids) => signalEach({ pids, signal: 'SIGKILL' }),
  });
}
