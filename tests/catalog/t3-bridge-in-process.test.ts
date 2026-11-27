// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import {
  cleanUp,
  fixture,
  repoRoot,
  scratch,
  slow,
  snapshot,
} from './t3-review-harness';
import {
  bridgeCommand,
  bridgePayload,
  runBridgeMain,
  type BridgeRun,
} from './t3-bridge-in-process';

/**
 * The in-process harness (t3-bridge-in-process.ts) against the real bridge:
 * the same bridge call, as code mode sends it, gives the same exit code,
 * stdout and stderr in a real process (the exit status and both streams as
 * the shell gives them, not through the synthetic exec_command, which reports
 * one stream) and in this process, for steps that succeed (prepare, a bind
 * step) and each way the bridge's main declines (its TMPDIR check, arguments
 * its schema refuses, an input over its byte bound).
 */
vi.setConfig({ testTimeout: slow });
afterEach(cleanUp);
const quote = (value: string) => "'" + value.replace(/'/g, "'\\''") + "'";
/** A bridge command as code mode sends it, run by the shell in a real process. */
async function runReal(cmd: string, tmp: string): Promise<BridgeRun> {
  const { execFile } = await import('node:child_process');
  return new Promise((resolve) => {
    execFile(
      'bash',
      ['-c', cmd],
      { cwd: repoRoot, env: { ...process.env, TMPDIR: tmp } },
      (error, stdout, stderr) =>
        resolve({
          code: error === null ? 0 : Number(error.code),
          stdout,
          stderr,
        }),
    );
  });
}
it('gives the same exit code, stdout and stderr for a bridge call in a real process and in this process', async () => {
  const { dir } = await fixture();
  const { syntheticTools, syntheticStatus } =
    await import('./t3-code-mode-fixture');
  const tmp = await scratch('t3-transport-');
  const caller = await (
    await syntheticTools({ dir })
  ).tools.mcp__t3_code__t3_thread_configure({});
  const calls = [
    { name: 'prepare', exit: 0, payload: { action: 'prepare', caller, dir } },
    {
      name: 'next, a bind step',
      exit: 0,
      payload: {
        action: 'next',
        response: { structuredContent: syntheticStatus() },
        observations: [],
        dir,
      },
    },
    {
      name: 'TMPDIR at the round',
      exit: 1,
      payload: { action: 'prepare', caller, dir },
      tmp: dir,
    },
    { name: 'an unknown action', exit: 1, payload: { action: 'unknown', dir } },
    {
      name: 'an input over 60,000 bytes',
      exit: 1,
      payload: { action: 'prepare', caller: 'c'.repeat(60000), dir },
    },
  ];
  const before = await snapshot(dir);
  for (const call of calls) {
    const cmd = bridgeCommand + quote(JSON.stringify(call.payload));
    const payload = bridgePayload(cmd);
    expect(payload, call.name).toBe(JSON.stringify(call.payload));
    const real = await runReal(cmd, call.tmp ?? tmp);
    const here = await runBridgeMain(payload ?? '', call.tmp ?? tmp);
    expect(real.code, call.name).toBe(call.exit);
    // The stream a call writes to is not empty, the other is.
    expect(call.exit === 0 ? real.stdout : real.stderr, call.name).not.toBe('');
    expect(call.exit === 0 ? real.stderr : real.stdout, call.name).toBe('');
    expect(here, call.name).toEqual(real);
  }
  expect(await snapshot(dir)).toEqual(before);
});
