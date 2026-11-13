// @vitest-environment node
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { zipSync, strToU8 } from 'fflate';
import { expect, it } from 'vitest';
import { failureCatalog } from './nightly-history';

it.each(['new', 'open', 'closed'] as const)(
  'publishes a %s issue despite retired journeys in historical results',
  async (state) => {
    const directory = await mkdtemp(join(tmpdir(), 'nightly-triage-'));
    const key = `${failureCatalog[1]!.key}:${'a'.repeat(20)}`;
    const summary = JSON.stringify({ failures: [key] });
    try {
      // The fake gh uses require; pin it to CommonJS so a "type": "module"
      // package.json above TMPDIR can't make Node load it as ESM.
      await writeFile(
        join(directory, 'package.json'),
        JSON.stringify({ type: 'commonjs' }),
      );
      await writeFile(join(directory, 'nightly-summary.json'), summary);
      await writeFile(
        join(directory, 'history.zip'),
        zipSync({
          'nightly-summary.json': strToU8(
            JSON.stringify({
              failures: [key, `${'f'.repeat(20)}:not-run`],
            }),
          ),
        }),
      );
      await writeFile(
        join(directory, 'gh'),
        `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync('calls.jsonl', JSON.stringify(args) + '\\n');
if (args[0] === 'api') {
  const path = args.at(-1);
  if (path.includes('/workflows/')) process.stdout.write(JSON.stringify({ workflow_runs: [
    { id: 2, run_number: 2, status: 'in_progress' }, { id: 1, run_number: 1, status: 'completed' }
  ] }));
  else if (path.endsWith('/zip')) process.stdout.write(fs.readFileSync('history.zip'));
  else if (path.endsWith('/artifacts')) process.stdout.write(JSON.stringify({ artifacts: [{ id: 10, name: 'nightly-summary', expired: false }] }));
  else if (path.includes('/issues?')) process.stdout.write(JSON.stringify([[${state === 'new' ? '' : JSON.stringify({ number: 42, state, body: `<!-- nightly-failure:${key} -->` })}]]));
  else process.exit(2);
}
`,
        { mode: 0o700 },
      );
      const result = spawnSync(
        process.execPath,
        [
          resolve('node_modules/tsx/dist/cli.mjs'),
          resolve('e2e/nightly-triage.ts'),
          'publish',
        ],
        {
          cwd: directory,
          env: {
            ...process.env,
            PATH: `${directory}:${process.env.PATH}`,
            GITHUB_REPOSITORY: 'test/repo',
            GITHUB_RUN_ID: '2',
            GH_TOKEN: '',
          },
          encoding: 'utf8',
          timeout: 15000,
        },
      );
      expect(result.status, result.stdout + result.stderr).toBe(0);
      const calls = (await readFile(join(directory, 'calls.jsonl'), 'utf8'))
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as string[]);
      expect(
        calls
          .filter((call) => call[0] === 'issue')
          .map((call) => call.slice(0, 2)),
      ).toEqual(
        state === 'new'
          ? [['issue', 'create']]
          : state === 'closed'
            ? [
                ['issue', 'reopen'],
                ['issue', 'edit'],
              ]
            : [['issue', 'edit']],
      );
      expect(
        await readFile(join(directory, 'nightly-issue.md'), 'utf8'),
      ).toContain('Failed in 2 of the last 2 runs');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
  20000,
);

it.each([
  ['a failing gh call', 'publish', 3, 'E2E nightly triage failed (exit-3)'],
  ['an unknown mode', 'sk_test_TRIAGESECRET', 0, 'Use summarize or publish'],
] as const)(
  'reports %s with fixed text only, never gh output or arguments',
  async (_, mode, exit, expected) => {
    const directory = await mkdtemp(join(tmpdir(), 'nightly-triage-fail-'));
    try {
      await writeFile(
        join(directory, 'gh'),
        `#!/bin/sh\necho '{"token":"sk_test_TRIAGESECRET"}'\necho 'https://x.test/?token=sk_test_TRIAGESECRET' >&2\nexit ${exit}\n`,
        { mode: 0o700 },
      );
      const result = spawnSync(
        process.execPath,
        [
          resolve('node_modules/tsx/dist/cli.mjs'),
          resolve('e2e/nightly-triage.ts'),
          mode,
        ],
        {
          cwd: directory,
          env: {
            ...process.env,
            PATH: `${directory}:${process.env.PATH}`,
            GITHUB_REPOSITORY: 'sk_test_TRIAGESECRET/repo',
            GITHUB_RUN_ID: '2',
            GH_TOKEN: '',
          },
          encoding: 'utf8',
          timeout: 15000,
        },
      );
      expect(result.status).toBe(1);
      expect(result.stderr.trim()).toBe(expected);
      expect(result.stdout + result.stderr).not.toContain('TRIAGESECRET');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
  20000,
);
