/**
 * Starts a TypeScript entry point under tsx with tsx's disk cache off:
 * `node scripts/catalog/start-without-tsx-cache.mjs <entry.ts> [args...]`.
 * tsx picks its cache as it loads and writes it while it compiles the entry,
 * before any entry code runs, under the system temporary directory (TMPDIR),
 * which can be a round's directory; so the switch is set here, in plain
 * JavaScript, before tsx loads. This is the documented way to start the
 * bridge and the record step's round commands (--capture-t3, --bind-t3,
 * --complete-t3, --t3-run, --verify), and the one this repository's callers
 * use. Nothing requires it: started any other way they run as before, tsx's
 * cache included; each checks TMPDIR itself (requireTemporaryDirectoryOutside
 * in t3-review-evidence.ts), but only once tsx has loaded it.
 */
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** This launcher's path from the repository root, as the help names it. */
export const launcher = 'scripts/catalog/start-without-tsx-cache.mjs';

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const entry = process.argv[2];
  if (!entry) throw new Error(`Usage: node ${launcher} <entry.ts> [args...]`);
  process.env.TSX_DISABLE_CACHE = '1';
  // No top-level await: the record step imports this module (for its path),
  // which must have finished evaluating by then.
  void import('tsx/esm/api')
    .then(({ register }) => {
      register();
      // The entry runs as if node had started it: its path, then its arguments.
      process.argv.splice(1, 2, resolve(entry));
      return import(pathToFileURL(resolve(entry)).href);
    })
    .catch((error) => {
      process.stderr.write(
        `${error instanceof Error ? error.message : String(error)}\n`,
      );
      process.exitCode = 1;
    });
}
