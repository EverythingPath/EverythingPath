/**
 * The bridge's CLI runs in this process, for tests that prove a rule's
 * variations: a bridge call costs a node start under tsx (about 0.7 s in CI),
 * and each rule keeps a test that runs the real bridge. A call here runs the
 * bridge's own exported main (scripts/catalog/t3-review-bridge.ts) on the
 * payload code mode quoted, and gives its exit code and both streams as the
 * CLI would: its result as a JSON line on stdout, or its message on stderr and
 * exit 1; t3-bridge-in-process.test.ts checks that a call gives the same exit
 * code, stdout and stderr both ways. What only a real
 * process has stays with the real-bridge tests: the launcher, the shell's
 * quoting, the process's own TMPDIR, umask and file-size limit.
 */
import { main } from '../../scripts/catalog/t3-review-bridge';

/** The command code mode sends for a bridge call, before its quoted payload. */
export const bridgeCommand =
  'node scripts/catalog/start-without-tsx-cache.mjs scripts/catalog/t3-review-bridge.ts ';
const quote = (value: string) => "'" + value.replace(/'/g, "'\\''") + "'";
/** The payload of a bridge command as code mode quotes it, else undefined. */
export function bridgePayload(cmd: string) {
  if (!cmd.startsWith(bridgeCommand)) return undefined;
  const quoted = cmd.slice(bridgeCommand.length);
  if (!/^'.*'$/s.test(quoted)) return undefined;
  const payload = quoted.slice(1, -1).replace(/'\\''/g, "'");
  return quote(payload) === quoted ? payload : undefined;
}
/** Calls run one at a time: each sets TMPDIR for its own duration. */
let queue: Promise<unknown> = Promise.resolve();
/** A bridge CLI run: its exit code and both output streams. */
export type BridgeRun = { code: number; stdout: string; stderr: string };
/**
 * Runs one bridge call (`payload`, the bridge's argument) here, as the bridge
 * would with TMPDIR at `tmp`: its exit code and what it writes to each stream
 * (its result as a JSON line on stdout, or its message on stderr and exit 1).
 */
export function runBridgeMain(payload: string, tmp: string) {
  const call = queue.then(async (): Promise<BridgeRun> => {
    const saved = process.env.TMPDIR;
    process.env.TMPDIR = tmp;
    try {
      // main reads its argument before its first await, so argv is restored
      // before anything else in this process can see it.
      const argv = process.argv;
      process.argv = [argv[0] ?? 'node', 't3-review-bridge.ts', payload];
      const pending = main();
      process.argv = argv;
      const value: unknown = await pending;
      return {
        code: 0,
        stdout: value === undefined ? '' : `${JSON.stringify(value)}\n`,
        stderr: '',
      };
    } catch (error) {
      return {
        code: 1,
        stdout: '',
        stderr: `${error instanceof Error ? error.message : String(error)}\n`,
      };
    } finally {
      if (saved === undefined) delete process.env.TMPDIR;
      else process.env.TMPDIR = saved;
    }
  });
  queue = call.catch(() => undefined);
  return call;
}
/**
 * One bridge call here, as the synthetic exec_command reports a real one: its
 * exit code, with stdout on success and stderr on failure.
 */
export async function runBridgeInProcess(payload: string, tmp: string) {
  const { code, stdout, stderr } = await runBridgeMain(payload, tmp);
  return { exit_code: code, output: code === 0 ? stdout : stderr };
}
