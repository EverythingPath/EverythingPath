import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import {
  findStaleSuppressions,
  readSuppressedFiles,
} from './lib/eslint-suppressions.ts';

// Fails when eslint-suppressions.json names a file that neither lint:eslint
// invocation reads (see findStaleSuppressions). Drop such an entry by hand.
const root = fileURLToPath(new URL('../', import.meta.url));
const stale = await findStaleSuppressions(
  new ESLint({ cwd: root }),
  root,
  readSuppressedFiles(`${root}eslint-suppressions.json`),
);
if (stale.length) {
  process.stderr.write(
    `eslint-suppressions.json has entries for files lint does not read; remove them:\n${stale
      .map(({ file, reason }) => `  ${file} (${reason})\n`)
      .join('')}`,
  );
  process.exitCode = 1;
}
