// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { getHeapStatistics } from 'node:v8';
import { expect, it } from 'vitest';

// The package `test` script gives the Vitest parent a 4,096 MB old space on
// its own command line, and each worker, with every CLI a test spawns, 3,072 MB
// through NODE_OPTIONS (#744; docs/catalog-import/curation.md).
function heapLimit(args: string[], env: NodeJS.ProcessEnv) {
  return Number(
    execFileSync(
      process.execPath,
      [...args, '-p', 'require("node:v8").getHeapStatistics().heap_size_limit'],
      { env, encoding: 'utf8' },
    ),
  );
}
const workerLimit = heapLimit(['--max-old-space-size=3072'], {
  ...process.env,
  NODE_OPTIONS: '',
});

it('runs each worker with the 3,072 MB heap the test script sets', () => {
  expect(getHeapStatistics().heap_size_limit).toBe(workerLimit);
});

it('gives a CLI the worker spawns the same 3,072 MB heap', () => {
  expect(heapLimit([], process.env)).toBe(workerLimit);
});

it('keeps the watch script the run script without `run`', async () => {
  const { scripts } = JSON.parse(await readFile('package.json', 'utf8')) as {
    scripts: Record<string, string>;
  };
  expect(scripts.test).toBe(`${scripts['test:watch']} run`);
});
