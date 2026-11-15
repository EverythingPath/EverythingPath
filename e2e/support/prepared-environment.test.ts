// @vitest-environment node
import { mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import {
  planPreparation,
  preparedEnvironmentDirectory,
  preparedEnvironmentTtlMs,
  readPreparedRecord,
  writePreparedRecord,
  type ExpectedPreparation,
  type Preparation,
  type PreparedRecord,
} from './prepared-environment';

const hash = (character: string) => character.repeat(64);
const instanceName = 'ep-e2e-11111111-1111-1111-1111-111111111111';
const createdAt = Date.parse('2026-10-17T06:00:00.000Z');
const preparation: Preparation = {
  reuseFingerprint: hash('a'),
  parts: {
    sources: hash('b'),
    buildEnvironment: hash('c'),
    node: 'v24.0.0',
    pnpm: '10.0.0',
    dependencies: hash('d'),
  },
  sourceFingerprint: hash('e'),
  target: {
    resources: hash('f'),
    previewName: 'e2e-local-test-slot-0',
    clerkHost: 'testing-otter-1.clerk.accounts.dev',
    publishableKey: hash('0'),
  },
  workers: 2,
  releaseState: 'none',
  backend: {
    image: 'ghcr.io/convex/convex-backend@sha256:pinned',
    instanceName,
    url: 'http://127.0.0.1:3210',
    siteUrl: 'http://127.0.0.1:3211',
  },
  writeEpoch: 0,
  createdAt,
};
const expected: ExpectedPreparation = {
  reuseFingerprint: preparation.reuseFingerprint,
  parts: preparation.parts,
  target: preparation.target,
  workers: 2,
  releaseState: 'none',
  image: preparation.backend.image,
};
const ready: PreparedRecord = {
  schema: 1,
  state: 'ready',
  ownerToken: 'previous-owner',
  runId: 'everythingpath-e2e-previous',
  instanceName,
  preparation,
};

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'e2e-prepared-'));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

it('keeps each checkout and slot in its own directory beside the checkouts, never inside one', () => {
  const first = preparedEnvironmentDirectory({
    sourceRoot: '/home/user/repos/project/worktree-a',
    previewName: 'e2e-local-test-slot-0',
  });
  expect(first).toMatch(
    /^\/home\/user\/repos\/project\/\.ep-tmp\/e2e-prepared\/e2e-local-test-slot-0-[a-f0-9]{12}$/,
  );
  expect(
    preparedEnvironmentDirectory({
      sourceRoot: '/home/user/repos/project/worktree-b',
      previewName: 'e2e-local-test-slot-0',
    }),
  ).not.toBe(first);
  expect(
    preparedEnvironmentDirectory({
      sourceRoot: '/home/user/repos/project/worktree-a',
      previewName: 'e2e-local-test-slot-1',
    }),
  ).not.toBe(first);
});

it('writes the record privately and atomically, and reads a damaged one as unreadable', async () => {
  const directory = join(root, 'prepared');
  expect(await readPreparedRecord(directory)).toBeNull();
  await writePreparedRecord(directory, ready);
  expect(await readPreparedRecord(directory)).toEqual(ready);
  expect((await stat(directory)).mode & 0o777).toBe(0o700);
  expect((await stat(join(directory, 'record.json'))).mode & 0o777).toBe(0o600);
  // Racing writers: every reader sees one whole record, and no candidate
  // file is left behind.
  await Promise.all(
    Array.from({ length: 20 }, (_, index) =>
      writePreparedRecord(directory, { ...ready, runId: `run-${index}` }),
    ),
  );
  expect((await readPreparedRecord(directory)) as PreparedRecord).toMatchObject(
    { state: 'ready', runId: expect.stringMatching(/^run-[0-9]+$/) },
  );
  expect(await readdir(directory)).toEqual(['record.json']);
  await writeFile(join(directory, 'record.json'), '{"schema":1,');
  expect(await readPreparedRecord(directory)).toBe('unreadable');
});

const notRunning = () => Promise.resolve(false);

it('reuses a ready preparation only when everything matches', async () => {
  expect(
    await planPreparation({
      record: ready,
      expected,
      now: createdAt + 1000,
      isRunning: notRunning,
    }),
  ).toEqual({ kind: 'reuse', preparation });
  // Fewer workers than prepared still match: their capabilities are minted
  // per run.
  expect(
    await planPreparation({
      record: ready,
      expected: { ...expected, workers: 1 },
      now: createdAt + 1000,
      isRunning: notRunning,
    }),
  ).toMatchObject({ kind: 'reuse' });
});

it.each([
  ['sources', { parts: { ...expected.parts, sources: hash('1') } }],
  [
    'build environment',
    { parts: { ...expected.parts, buildEnvironment: hash('1') } },
  ],
  ['node', { parts: { ...expected.parts, node: 'v24.1.0' } }],
  ['pnpm', { parts: { ...expected.parts, pnpm: '10.1.0' } }],
  ['dependencies', { parts: { ...expected.parts, dependencies: hash('1') } }],
  ['reuse fingerprint', { reuseFingerprint: hash('1') }],
  [
    'target',
    { target: { ...expected.target, clerkHost: 'other.clerk.accounts.dev' } },
  ],
  ['target', { target: { ...expected.target, resources: hash('1') } }],
  ['workers', { workers: 3 }],
  ['backend image', { image: 'ghcr.io/convex/convex-backend@sha256:newer' }],
] as const)(
  'prepares afresh, discarding the old container, when the %s differs',
  async (reason, override) => {
    expect(
      await planPreparation({
        record: ready,
        expected: { ...expected, ...override },
        now: createdAt + 1000,
        isRunning: notRunning,
      }),
    ).toEqual({ kind: 'prepare', discard: instanceName, reason });
  },
);

it('prepares afresh once the preparation is a day old, or when its record is damaged or incomplete', async () => {
  expect(
    await planPreparation({
      record: ready,
      expected,
      now: createdAt + preparedEnvironmentTtlMs,
      isRunning: notRunning,
    }),
  ).toEqual({ kind: 'prepare', discard: instanceName, reason: 'age' });
  expect(
    await planPreparation({
      record: 'unreadable',
      expected,
      now: createdAt,
      isRunning: notRunning,
    }),
  ).toEqual({ kind: 'prepare', discard: null, reason: 'record' });
  expect(
    await planPreparation({
      record: { ...ready, preparation: null },
      expected,
      now: createdAt,
      isRunning: notRunning,
    }),
  ).toEqual({ kind: 'prepare', discard: instanceName, reason: 'incomplete' });
});

it('refuses an environment another run holds while its container runs, and discards it once stopped', async () => {
  const held: PreparedRecord = {
    ...ready,
    state: 'in-use',
    ownerToken: 'other-run',
  };
  expect(
    await planPreparation({
      record: held,
      expected,
      now: createdAt,
      isRunning: (name) => Promise.resolve(name === instanceName),
    }),
  ).toEqual({ kind: 'refuse', instanceName });
  expect(
    await planPreparation({
      record: held,
      expected,
      now: createdAt,
      isRunning: notRunning,
    }),
  ).toEqual({ kind: 'prepare', discard: instanceName, reason: 'abandoned' });
  // A run that crashed before its container existed left nothing to stop.
  expect(
    await planPreparation({
      record: { ...held, instanceName: null, preparation: null },
      expected,
      now: createdAt,
      isRunning: notRunning,
    }),
  ).toEqual({ kind: 'prepare', discard: null, reason: 'abandoned' });
});
