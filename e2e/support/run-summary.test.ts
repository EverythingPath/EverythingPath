// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { finalizeRunEvidence } from './run-summary';

let root: string;
let run: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'e2e-run-summary-'));
  run = join(root, 'e2e-local-test-slot-0', 'everythingpath-e2e-test');
  await mkdir(run, { recursive: true });
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const planned = ['first', 'second', 'third'].map((title, index) => ({
  id: String(index),
  project: 'chromium-tablet',
  file: 'x.spec.ts',
  title,
}));
const checkpoint = {
  errors: 0,
  planned,
  started: [
    { id: '0', retry: 0 },
    { id: '1', retry: 0 },
  ],
  evidence: [{ testId: '0', retry: 0, status: 'failed' }],
};
const save = (file: string, value: unknown) =>
  writeFile(join(run, file), JSON.stringify(value));

it('prints Playwright result for a finished run', async () => {
  await save('report.json', {
    status: 'failed',
    tests: [
      {
        project: 'chromium-tablet',
        title: 'first',
        results: [{ status: 'passed', retry: 0 }],
      },
      {
        project: 'chromium-tablet',
        title: 'second',
        results: [{ status: 'timedOut', retry: 0 }],
      },
    ],
  });
  await save('progress.json', { ...checkpoint, status: 'finished' });
  expect(await finalizeRunEvidence({ directory: root, exitCode: 1 })).toBe(
    'e2e: failed: 1 journeys passed, 1 failed: chromium-tablet: second',
  );
});

it('finalizes a checkpoint left running and lists what ran', async () => {
  await save('progress.json', { ...checkpoint, status: 'running' });
  expect(await finalizeRunEvidence({ directory: root, exitCode: 143 })).toBe(
    'e2e: interrupted (exit 143, no Playwright report): 1 completed (0 passed, 1 failed: chromium-tablet: first [failed]), 1 interrupted: chromium-tablet: second, 1 not started: chromium-tablet: third',
  );
  expect(
    JSON.parse(await readFile(join(run, 'progress.json'), 'utf8')),
  ).toMatchObject({
    status: 'interrupted',
    interrupted: [{ title: 'second' }],
    unstarted: [{ title: 'third' }],
  });
});

it('prefers the lists of an interrupted run over its partial report', async () => {
  await save('report.json', { status: 'failed', tests: [] });
  await save('progress.json', { ...checkpoint, status: 'interrupted' });
  expect(await finalizeRunEvidence({ directory: root, exitCode: 1 })).toBe(
    'e2e: interrupted (exit 1): 1 completed (0 passed, 1 failed: chromium-tablet: first [failed]), 1 interrupted: chromium-tablet: second, 1 not started: chromium-tablet: third',
  );
});

it('says when neither a report nor a checkpoint exists', async () => {
  expect(
    await finalizeRunEvidence({
      directory: join(root, 'missing'),
      exitCode: 1,
    }),
  ).toBe('e2e: exit 1, no Playwright report or progress checkpoint produced');
});

it('reads a report beside a checkpoint without a test plan (older runs)', async () => {
  await save('report.json', { status: 'passed', tests: [] });
  await save('progress.json', { status: 'running', errors: 0, evidence: [] });
  expect(await finalizeRunEvidence({ directory: root, exitCode: 0 })).toBe(
    'e2e: passed: 0 journeys passed, 0 failed',
  );
});

it('states the scope a finished run was evaluated against', async () => {
  await save('report.json', {
    status: 'passed',
    suite: { kind: 'routine', mandatory: true, live: false, groups: ['sheet'] },
    tests: [
      {
        project: 'mandatory',
        title: 'first',
        results: [{ status: 'passed', retry: 0 }],
      },
    ],
  });
  await save('progress.json', { ...checkpoint, status: 'finished' });
  expect(await finalizeRunEvidence({ directory: root, exitCode: 0 })).toBe(
    'e2e: passed: 1 journeys passed, 0 failed; scope: mandatory + focused (sheet), 11 required results',
  );
});

it('states the scope of an interrupted run from its checkpoint', async () => {
  await save('progress.json', {
    ...checkpoint,
    status: 'running',
    suite: { kind: 'nightly' },
  });
  expect(await finalizeRunEvidence({ directory: root, exitCode: 130 })).toBe(
    'e2e: interrupted (exit 130, no Playwright report): 1 completed (0 passed, 1 failed: chromium-tablet: first [failed]), 1 interrupted: chromium-tablet: second, 1 not started: chromium-tablet: third; scope: nightly (mandatory + every focused group + live + compatibility), 64 required results',
  );
});

it('names no scope it cannot rebuild from the closed suite names', async () => {
  await save('report.json', {
    status: 'passed',
    suite: { kind: 'journeys', titles: ['token=abcdef0123456789abcdef'] },
    tests: [],
  });
  expect(await finalizeRunEvidence({ directory: root, exitCode: 0 })).toBe(
    'e2e: passed: 0 journeys passed, 0 failed',
  );
});

// #754: a reused preparation's evidence can never pass for a qualification.
it('marks a reused preparation as diagnostic in the summary line, finished or interrupted', async () => {
  await save('report.json', {
    status: 'passed',
    preparation: 'reused',
    tests: [
      {
        project: 'chromium-tablet',
        title: 'first',
        results: [{ status: 'passed', retry: 0 }],
      },
    ],
  });
  await save('progress.json', {
    ...checkpoint,
    status: 'finished',
    preparation: 'reused',
  });
  expect(await finalizeRunEvidence({ directory: root, exitCode: 5 })).toBe(
    'e2e: passed: 1 journeys passed, 0 failed; preparation: reused (diagnostic, not qualifying)',
  );
  await rm(join(run, 'report.json'));
  await save('progress.json', {
    ...checkpoint,
    status: 'running',
    preparation: 'reused',
  });
  expect(await finalizeRunEvidence({ directory: root, exitCode: 130 })).toMatch(
    /; preparation: reused \(diagnostic, not qualifying\)$/,
  );
});
