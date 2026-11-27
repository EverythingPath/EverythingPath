// @vitest-environment node
import { spawn } from 'node:child_process';
import type * as childProcess from 'node:child_process';
import { EventEmitter } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { describeHarnessFailure } from '../e2e/support/diagnostics';
import { startLocalBackend } from '../scripts/local-convex/backend';
import { failure } from './local-convex-backend-support';

// This file's one test is the only code that runs in its module registry
// (Vitest isolates each test file), so no later test exists for a startup
// that outlives it to resume into. Nothing here spawns a real process: an
// unset `spawn` returns nothing, and `runDocker` fails on it.
vi.mock('node:child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof childProcess>()),
  spawn: vi.fn(),
}));

/** One in-process `docker` call: its arguments and fake-clock times. */
type DockerCall = { args: string[]; spawnedAt: number } & (
  | { kind: 'running' }
  | { kind: 'exited'; endedAt: number; exitCode: number }
  | { kind: 'killed'; endedAt: number; signal: NodeJS.Signals | number }
);
type DaemonResult = { output: string; exitCode: number };

/** The value after `name` in a command's arguments. */
function readFlag(args: string[], name: string) {
  const value = args[args.indexOf(name) + 1];
  if (!args.includes(name) || value === undefined || value.startsWith('-'))
    throw new Error(`docker ${args[0]} has no value for ${name}`);
  return value;
}

/**
 * Docker whose create client fails after the daemon created the container
 * (`createLosesClient` in the fake Docker script of
 * local-convex-backend.test.ts), in-process on the fake clock. Each call ends
 * after its `durations` milliseconds unless killed first; a killed call
 * changes nothing, so the container survives it. Of the child-process events
 * `runDocker` uses, the child emits stdout `data` and `close` and honours
 * `kill`; it never emits `error`.
 */
function createInProcessDocker(durations: Readonly<Record<string, number>>) {
  const calls: DockerCall[] = [];
  let container: { name: string; label: string } | null = null;
  const succeed = (output = ''): DaemonResult => ({ output, exitCode: 0 });
  const daemon: Record<string, (args: string[]) => DaemonResult> = {
    version: () => succeed('27.0.0'),
    image: () => succeed('sha256:image'),
    ps: () => succeed(container ? 'container-id' : ''),
    create: (args) => {
      const [, label = ''] = readFlag(args, '--label').split('=');
      container = { name: readFlag(args, '--name'), label };
      // The daemon created it; the client reports a failure.
      return { output: '', exitCode: 1 };
    },
    inspect: () =>
      container ? succeed(container.label) : { output: '', exitCode: 1 },
    rm: () => {
      container = null;
      return succeed();
    },
  };
  const unknownCommand: DaemonResult = { output: '', exitCode: 3 };
  const spawnDocker = (_command: string, args: readonly string[]) => {
    const base = { args: [...args], spawnedAt: Date.now() };
    const command = base.args[0] ?? '';
    const index = calls.push({ ...base, kind: 'running' }) - 1;
    const child = new EventEmitter();
    const stdout = new EventEmitter();
    // A real child reports `close` on a later turn, after its output.
    const close = (
      code: number | null,
      signal: NodeJS.Signals | number | null,
    ) => process.nextTick(() => child.emit('close', code, signal));
    const timer = setTimeout(() => {
      const { output, exitCode } =
        daemon[command]?.(base.args) ?? unknownCommand;
      if (output) stdout.emit('data', output);
      calls[index] = { ...base, kind: 'exited', endedAt: Date.now(), exitCode };
      close(exitCode, null);
    }, durations[command] ?? 0);
    Object.assign(stdout, { setEncoding: () => stdout });
    Object.assign(child, {
      stdout,
      kill: (signal: NodeJS.Signals | number = 'SIGTERM') => {
        if (calls[index]?.kind !== 'running') return false;
        clearTimeout(timer);
        calls[index] = { ...base, kind: 'killed', endedAt: Date.now(), signal };
        close(null, signal);
        return true;
      },
    });
    // Safe cast: runDocker reads only `kill`, `stdout` and the `error` and
    // `close` events.
    return child as unknown as childProcess.ChildProcess;
  };
  return { calls, spawnDocker, survivor: () => container?.name };
}

/**
 * Waits until `startup` settles, moving time only while it waits on the fake
 * clock: each turn lets real file and socket work finish, then runs the next
 * fake timer, so real time cannot change the outcome. It never returns while
 * `startup` is pending: a failing turn is kept and rethrown once it settles,
 * and only the test's own timeout bounds the wait.
 */
async function settleOnFakeClock<T>(startup: Promise<T>) {
  let isSettled = false;
  const markSettled = () => {
    isSettled = true;
  };
  void startup.then(markSettled, markSettled);
  const failures: unknown[] = [];
  while (!isSettled) {
    await new Promise((resolve) => setImmediate(resolve));
    await vi
      .advanceTimersToNextTimerAsync()
      .catch((error: unknown) => failures.push(error));
  }
  if (failures.length > 0) throw failures[0];
  return startup;
}

/**
 * One startup whose rollback call `outlasting` runs past the 2,000 ms
 * reserve while the calls before it take 900 ms each: that call must be
 * killed when the deadline set as the rollback began passes, which only one
 * deadline shared by all three calls produces.
 */
async function rollBackPastTheDeadline({
  directory,
  outlasting,
  durations,
}: {
  directory: string;
  outlasting: string;
  durations: Readonly<Record<string, number>>;
}) {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  const docker = createInProcessDocker(durations);
  vi.mocked(spawn).mockImplementation(docker.spawnDocker);
  const startup = failure(
    startLocalBackend({ directory, cleanupReserveMs: 2_000 }),
  );
  try {
    const error = await settleOnFakeClock(startup);
    const rollbackCommands = ['ps', 'inspect', 'rm'];
    const rollback = rollbackCommands.slice(
      0,
      rollbackCommands.indexOf(outlasting) + 1,
    );
    expect(
      docker.calls.map(({ args }) => args[0]),
      `${outlasting} outlasting: the calls`,
    ).toEqual(['version', 'image', 'ps', 'create', ...rollback]);
    const rollbackCalls = docker.calls.slice(4);
    const began = rollbackCalls[0]?.spawnedAt ?? Number.NaN;
    expect(
      rollbackCalls,
      `${outlasting} outlasting: the rollback's calls on the fake clock`,
    ).toMatchObject(
      rollback.map((_, step) =>
        step < rollback.length - 1
          ? {
              kind: 'exited',
              exitCode: 0,
              spawnedAt: began + 900 * step,
              endedAt: began + 900 * (step + 1),
            }
          : {
              kind: 'killed',
              signal: 'SIGKILL',
              spawnedAt: began + 900 * step,
              endedAt: began + 2_000,
            },
      ),
    );
    // The container this startup created survives, and the failure names
    // its removal.
    const survivor = docker.survivor();
    expect(survivor).toMatch(/^ep-e2e-[a-f0-9-]{36}$/);
    expect(error.also).toEqual({
      kind: 'local-backend',
      reason: 'stop-after-failure',
      name: survivor,
    });
    expect(error.message).toBe('A Docker command for local Convex failed');
    expect(describeHarnessFailure(error).join('\n')).toContain(
      `\`docker rm -f -v ${survivor}\``,
    );
    // Nothing the fake holds outlives the case.
    expect(docker.calls.filter(({ kind }) => kind === 'running')).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    // Restored only once startup has settled, even after a failed
    // assertion or turn, so the next case starts with nothing pending.
    await settleOnFakeClock(startup).catch(() => undefined);
    vi.mocked(spawn).mockReset();
    vi.useRealTimers();
  }
}

it('shares one cleanup deadline across the rollback’s ps, inspect and removal', async () => {
  const root = await mkdtemp(join(tmpdir(), 'local-convex-cleanup-'));
  try {
    // Each case settles before the next begins.
    for (const [outlasting, durations] of [
      ['ps', { ps: 5_000 }],
      ['inspect', { ps: 900, inspect: 5_000 }],
      ['rm', { ps: 900, inspect: 900, rm: 5_000 }],
    ] as const)
      await rollBackPastTheDeadline({
        directory: join(root, outlasting),
        outlasting,
        durations,
      });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 15_000);
