/**
 * Preloaded into a real bridge process by a test (`TSX_DISABLE_CACHE=1 node
 * --import tsx --import <this file>` before the bridge's launcher): before the process's first file write, link or
 * rename whose destination's base name matches the pattern `$EP_T3_PAUSE_AT`
 * (a write by path, or an open for writing whose bytes go through its
 * descriptor), it creates `$EP_T3_PAUSE.paused` and waits until
 * `$EP_T3_PAUSE.go` exists, so another attempt can run at exactly that point.
 * With `$EP_T3_PAUSE_AFTER_WRITE` set, it pauses instead right after the
 * file's bytes were written (by path, or through the opened descriptor),
 * before whatever the process does next. With `$EP_T3_EXIT_AFTER_PAUSE` set,
 * the process exits right after that operation completes (for an open, after
 * its bytes were written), as a process that died there would. The wait is
 * bounded: a test that fails without releasing the pause does not leave this
 * process waiting (and the test's own cleanup kills it first).
 */
import { existsSync, writeFileSync } from 'node:fs';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { basename } from 'node:path';

const pause = process.env.EP_T3_PAUSE;
const at = process.env.EP_T3_PAUSE_AT;
if (pause !== undefined && at !== undefined) {
  const pattern = new RegExp(at);
  const afterWrite = process.env.EP_T3_PAUSE_AFTER_WRITE !== undefined;
  const exitAfter = process.env.EP_T3_EXIT_AFTER_PAUSE !== undefined;
  const promises = fs.promises;
  let paused = false;
  const matches = (destination: unknown) =>
    !paused && pattern.test(basename(String(destination)));
  const hold = async () => {
    paused = true;
    writeFileSync(`${pause}.paused`, '');
    const deadline = Date.now() + 30000;
    while (!existsSync(`${pause}.go`)) {
      if (Date.now() > deadline) {
        process.stderr.write('Pause was never released.\n');
        process.exit(70);
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  };
  /** Runs `operation` on a matching destination at the pause point asked for. */
  const around = async <T>(
    destination: unknown,
    operation: () => Promise<T>,
  ) => {
    if (!matches(destination)) return operation();
    if (!afterWrite) await hold();
    const value = await operation();
    if (afterWrite) await hold();
    if (exitAfter) process.exit(75);
    return value;
  };
  const writeFile = promises.writeFile;
  const link = promises.link;
  const rename = promises.rename;
  const open = promises.open;
  promises.writeFile = async (...args: Parameters<typeof writeFile>) =>
    around(args[0], () => writeFile(...args));
  promises.link = async (...args: Parameters<typeof link>) =>
    around(args[1], () => link(...args));
  promises.rename = async (...args: Parameters<typeof rename>) =>
    around(args[1], () => rename(...args));
  promises.open = async (...args: Parameters<typeof open>) => {
    const [path, flags] = args;
    const writing = typeof flags === 'string' && /[wa+]/.test(flags);
    if (!writing || !matches(path)) return open(...args);
    // Before the open (the create), or after the bytes go through it.
    if (!afterWrite) await hold();
    else paused = true;
    const handle = await open(...args);
    const write = handle.writeFile.bind(handle);
    handle.writeFile = async (...data: Parameters<typeof write>) => {
      await write(...data);
      if (afterWrite) await hold();
      if (exitAfter) process.exit(75);
    };
    return handle;
  };
  syncBuiltinESMExports();
}
