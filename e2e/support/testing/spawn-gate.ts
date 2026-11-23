// Test-only: holds each spawn made through `processSpawning` until its child
// is ready. `command()` starts its timers (`timeoutMs`, `interruptAfterMs`)
// as soon as spawn returns, so a test of what a timer does to a ready child
// would otherwise race the child's start-up, which a loaded runner can
// stretch past a short timer (flaky-tests-1 fix r2). Held here, each timer
// runs from the child's readiness instead, whatever its start-up took.
import type { ChildProcess, SpawnOptions } from 'node:child_process';
import {
  closeSync,
  mkdtempSync,
  openSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { vi } from 'vitest';
import { processSpawning } from '../process';

/**
 * Until the spy is restored, each spawn returns only once `isReady(cwd)`
 * holds, or after `deadlineMs`. The returned list gets one entry per spawn:
 * its child, `ready` or `not ready` and when it returned (`performance.now()`,
 * from which its timers run), for the test to assert: a child that never got
 * ready fails the test by name rather than letting its timer run unchecked.
 *
 * A child that reads its input first (a fixture call's arguments on stdin)
 * gets ready only after that input, which `command()` writes once spawn has
 * returned. With `input` (the command's own), such a child reads it from a
 * file instead of the pipe, so it can get ready while held; `command()` then
 * has no stdin to write.
 */
export function holdSpawnsUntilReady(
  isReady: (cwd: string) => boolean,
  { deadlineMs = 30_000, input }: { deadlineMs?: number; input?: string } = {},
) {
  const real = processSpawning.spawn;
  const spawns: {
    child: ChildProcess;
    outcome: 'ready' | 'not ready';
    returnedAt: number;
  }[] = [];
  // Atomics.wait sleeps this thread without spinning, while the child runs.
  const nap = new Int32Array(new SharedArrayBuffer(4));
  vi.spyOn(processSpawning, 'spawn').mockImplementation(((
    file: string,
    args: readonly string[],
    options: SpawnOptions & { cwd: string },
  ) => {
    const stdio = Array.isArray(options.stdio) ? options.stdio : undefined;
    let child: ChildProcess;
    if (input !== undefined && stdio?.[0] === 'pipe') {
      const directory = mkdtempSync(join(tmpdir(), 'e2e-spawn-input-'));
      writeFileSync(join(directory, 'input'), input);
      const stdin = openSync(join(directory, 'input'), 'r');
      try {
        child = real(file, args, {
          ...options,
          stdio: [stdin, ...stdio.slice(1)],
        });
      } finally {
        // The child holds its own copy of the descriptor.
        closeSync(stdin);
        rmSync(directory, { recursive: true, force: true });
      }
    } else child = real(file, args, options);
    const until = Date.now() + deadlineMs;
    while (!isReady(options.cwd) && Date.now() < until)
      Atomics.wait(nap, 0, 0, 20);
    spawns.push({
      child,
      outcome: isReady(options.cwd) ? 'ready' : 'not ready',
      returnedAt: performance.now(),
    });
    return child;
  }) as typeof processSpawning.spawn);
  return spawns;
}
