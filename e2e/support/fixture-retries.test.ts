// @vitest-environment node
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { retryCleanup } from './case-attempt';
import { describeDiagnostic, HarnessFailure } from './diagnostics';
import {
  canonicalPersistenceFixtureCall,
  CommandFailure,
  fixtureCall,
  fixtureRetry,
  isolateCases,
  processSpawning,
  readWriteEpoch,
  runSchema,
  type Run,
} from './process';
import { resources } from './test-data';

// #754's narrow fixture retries. A fake installed Convex CLI stands in for
// the deployment: it logs every function it runs to `calls` (an execution
// that reached Convex), keeps the Write Gate epoch in `epoch`, and fails as
// `modes` says:
// - `transport <fn>`: the CLI's fetch failed ("fetch failed"), after which a
//   mutation may or may not have committed;
// - `commit-then-transport <fn>`: the write commits (`commits`), then the
//   response is lost;
// - `conflict <fn>`: Convex's write-conflict error;
// - `validation <fn>`: an argument validation error alongside a connection
//   failure line;
// - `move-epoch-on <n> <fn>`: on the fn's nth execution the epoch moves
//   first, so that execution's stale write is rejected.
// Each mode applies `count` times if given as `<mode>*<count>`.
const fakeCli = `const fs = require('node:fs');
const [, name, serialized] = process.argv.slice(2);
const args = JSON.parse(serialized);
fs.appendFileSync('calls', name + '\\n');
const executions = fs.readFileSync('calls', 'utf8').split('\\n').filter((line) => line === name).length;
let epoch = Number(fs.readFileSync('epoch', 'utf8'));
const modes = fs.existsSync('modes') ? fs.readFileSync('modes', 'utf8').split('\\n').filter(Boolean) : [];
function take(mode) {
  const index = modes.findIndex((line) => line.split('*')[0] === mode + ' ' + name);
  if (index < 0) return false;
  const [, count = '1'] = modes[index].split('*');
  if (Number(count) <= 1) modes.splice(index, 1); else modes[index] = mode + ' ' + name + '*' + (Number(count) - 1);
  fs.writeFileSync('modes', modes.join('\\n'));
  return true;
}
const moveOn = modes.find((line) => line.startsWith('move-epoch-on ') && line.endsWith(' ' + name));
if (moveOn && Number(moveOn.split(' ')[1]) === executions) { epoch += 1; fs.writeFileSync('epoch', String(epoch)); }
// A stalled backend: the call never answers (CommonJS allows this return).
if (take('hang')) { setInterval(() => {}, 1000); return; }
if (take('transport')) { console.error('TypeError: fetch failed'); process.exit(1); }
if (take('commit-then-transport')) { fs.appendFileSync('commits', name + '\\n'); console.error('TypeError: fetch failed'); process.exit(1); }
if (take('conflict')) { console.error('Documents read from or written to the table changed while this mutation was being run'); process.exit(1); }
if (take('validation')) { console.error('ArgumentValidationError: bad'); console.error('TypeError: fetch failed'); process.exit(1); }
if (name === 'initialMigration:clientStatus') {
  process.stdout.write(JSON.stringify({ epoch }));
} else {
  const isRead = ['e2eFixtures:inspectCase', 'e2eFixtures:inspectMoves'].includes(name);
  if (!isRead && args.writeEpoch !== epoch) { console.error('RELOAD_REQUIRED'); process.exit(2); }
  if (!isRead) fs.appendFileSync('commits', name + '\\n');
  if (!/:(seedIdentityProjection|cleanupCase|loseMembership|close)$/.test(name)) process.stdout.write(JSON.stringify(args));
}`;

const directories: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  isolateCases([]);
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function deployment({
  modes = [],
  browserStopAt,
}: { modes?: string[]; browserStopAt?: number } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'e2e-fixture-retries-'));
  directories.push(directory);
  const packageDirectory = join(directory, 'node_modules', 'convex');
  await mkdir(packageDirectory, { recursive: true });
  await writeFile(
    join(packageDirectory, 'package.json'),
    JSON.stringify({ name: 'convex', bin: 'fixture.cjs' }),
  );
  await writeFile(join(packageDirectory, 'fixture.cjs'), fakeCli);
  await writeFile(join(directory, 'epoch'), '0');
  await writeFile(join(directory, 'modes'), modes.join('\n'));
  const run: Run = runSchema.parse({
    resources,
    workspace: directory,
    sourceRoot: directory,
    privateDirectory: directory,
    artifactDirectory: join(directory, 'artifacts'),
    envFile: join(directory, `convex-${directories.length}.env`),
    baseURL: 'http://127.0.0.1:49123',
    ...(browserStopAt === undefined ? {} : { browserStopAt }),
  });
  await writeFile(run.envFile, '');
  // Evidence: `command()` and the retries log to the run's artifacts.
  const runFile = join(directory, 'run.json');
  await writeFile(runFile, JSON.stringify(run));
  vi.stubEnv('E2E_RUN_FILE', runFile);
  const lines = (file: string) =>
    readFile(join(directory, file), 'utf8')
      .catch(() => '')
      .then((text) => text.split('\n').filter(Boolean));
  return {
    run,
    calls: () => lines('calls'),
    commits: () => lines('commits'),
  };
}

// Waits are recorded, not slept, so the bounds are checked without delay.
function recordWaits() {
  const waits: number[] = [];
  vi.spyOn(fixtureRetry, 'sleep').mockImplementation(async (ms: number) => {
    waits.push(ms);
  });
  return waits;
}

/**
 * Fails the next `count` spawns of fixture `functionName` the way the kernel
 * refuses a process (`EAGAIN`): the child never starts, so nothing is sent.
 */
function failSpawns(functionName: string, count: number, code = 'EAGAIN') {
  const real = processSpawning.spawn;
  let remaining = count;
  const spawns: string[] = [];
  vi.spyOn(processSpawning, 'spawn').mockImplementation(((
    file: string,
    args: readonly string[],
    options: object,
  ) => {
    const isTarget = args.includes(functionName);
    if (isTarget) spawns.push(functionName);
    if (!isTarget || remaining <= 0) return real(file, args, options);
    remaining--;
    const child: ChildProcess = spawn(
      join(tmpdir(), 'e2e-no-such-executable'),
      [],
      options,
    );
    child.once('error', (error: NodeJS.ErrnoException) => {
      error.code = code;
    });
    return child;
  }) as typeof processSpawning.spawn);
  return spawns;
}

it('retries a read after a transport failure, at most twice, with jittered waits', async () => {
  const target = await deployment({
    modes: ['transport e2eFixtures:inspectCase*2'],
  });
  const waits = recordWaits();
  expect(
    await fixtureCall(target.run, 'inspectCase', { caseKey: 'smoke' }),
  ).toEqual({ caseKey: 'smoke' });
  expect(await target.calls()).toEqual(
    Array(3).fill('e2eFixtures:inspectCase'),
  );
  expect(waits).toHaveLength(2);
  expect(waits[0]).toBeGreaterThanOrEqual(500);
  expect(waits[0]).toBeLessThanOrEqual(1000);
  expect(waits[1]).toBeGreaterThanOrEqual(1500);
  expect(waits[1]).toBeLessThanOrEqual(3000);
  expect(
    await readFile(join(target.run.artifactDirectory, 'stages.log'), 'utf8'),
  ).toContain('fixture inspectCase: retry 2 (read transport)');
});

it('gives up on a read after two retries, and never retries a refused one', async () => {
  const target = await deployment({
    modes: [
      'transport e2eFixtures:inspectMoves*3',
      'validation e2eFixtures:inspectCase',
    ],
  });
  recordWaits();
  await expect(
    fixtureCall(target.run, 'inspectMoves', { caseKey: 'characterMove' }),
  ).rejects.toBeInstanceOf(CommandFailure);
  await expect(
    fixtureCall(target.run, 'inspectCase', { caseKey: 'smoke' }),
  ).rejects.toBeInstanceOf(CommandFailure);
  expect(await target.calls()).toEqual([
    ...Array(3).fill('e2eFixtures:inspectMoves'),
    'e2eFixtures:inspectCase',
  ]);
});

it('retries the write epoch read, which is a query', async () => {
  const target = await deployment({
    modes: ['transport initialMigration:clientStatus'],
  });
  recordWaits();
  expect(await readWriteEpoch(target.run)).toBe(0);
  expect(await target.calls()).toEqual(
    Array(2).fill('initialMigration:clientStatus'),
  );
});

it('committed-but-response-lost: a mutation is never retried after it started', async () => {
  const target = await deployment({
    modes: ['commit-then-transport e2eFixtures:resetCase'],
  });
  recordWaits();
  await expect(
    fixtureCall(target.run, 'resetCase', { caseKey: 'smoke' }),
  ).rejects.toBeInstanceOf(CommandFailure);
  expect(await target.commits()).toEqual(['e2eFixtures:resetCase']);
  expect(
    (await target.calls()).filter((call) => call === 'e2eFixtures:resetCase'),
  ).toHaveLength(1);
});

it('duplicate delivery: every mutation that reached the CLI runs exactly once whatever its failure', async () => {
  const writes = [
    ['fixture', 'seedIdentityProjection'],
    ['fixture', 'resetCase'],
    ['fixture', 'cleanupCase'],
    ['fixture', 'loseMembership'],
    ['fixture', 'deleteAccount'],
    ['canonical', 'initialize'],
    ['canonical', 'resetAndInitialize'],
    ['canonical', 'initializeUpkeep'],
    ['canonical', 'installAcceptanceSource'],
    ['canonical', 'close'],
    ['canonical', 'changeSource'],
    ['canonical', 'blockSuccessor'],
    ['canonical', 'appendHistory'],
    // A mutation that only reads: Convex does not enforce that, so it is
    // treated as a write.
    ['canonical', 'inspect'],
  ] as const;
  for (const failure of ['transport', 'commit-then-transport']) {
    const target = await deployment({
      modes: writes.map(
        ([module, name]) =>
          `${failure} ${module === 'fixture' ? 'e2eFixtures' : 'canonicalPersistenceFixtures'}:${name}`,
      ),
    });
    recordWaits();
    for (const [module, name] of writes)
      await expect(
        module === 'fixture'
          ? fixtureCall(target.run, name, { caseKey: 'smoke' })
          : canonicalPersistenceFixtureCall(target.run, name, {
              scope: { caseKey: 'canonicalPersistence' },
            }),
      ).rejects.toThrow();
    const executed = (await target.calls()).filter(
      (call) => call !== 'initialMigration:clientStatus',
    );
    expect(executed).toHaveLength(writes.length);
    expect(new Set(executed).size).toBe(writes.length);
  }
});

it('retries a write only when its process never started, and not on a missing executable', async () => {
  const target = await deployment();
  recordWaits();
  await fixtureCall(target.run, 'seedIdentityProjection', {});
  const spawns = failSpawns('e2eFixtures:resetCase', 2);
  expect(
    await fixtureCall(target.run, 'resetCase', { caseKey: 'smoke' }),
  ).toMatchObject({ caseKey: 'smoke' });
  expect(spawns).toHaveLength(3);
  expect(await target.commits()).toEqual([
    'e2eFixtures:seedIdentityProjection',
    'e2eFixtures:resetCase',
  ]);
  vi.restoreAllMocks();
  recordWaits();
  const missing = failSpawns('e2eFixtures:resetCase', 1, 'ENOENT');
  await expect(
    fixtureCall(target.run, 'resetCase', { caseKey: 'smoke' }),
  ).rejects.toMatchObject({ code: 'ENOENT' });
  expect(missing).toHaveLength(1);
});

it('a stale epoch after a spawn retry fails the write once, with no further attempt', async () => {
  const target = await deployment({
    modes: ['move-epoch-on 1 e2eFixtures:resetCase'],
  });
  recordWaits();
  await readWriteEpoch(target.run);
  await fixtureCall(target.run, 'seedIdentityProjection', {});
  const spawns = failSpawns('e2eFixtures:resetCase', 1);
  const error = await fixtureCall(target.run, 'resetCase', {
    caseKey: 'smoke',
  }).catch((failure: unknown) => failure);
  expect(error).toBeInstanceOf(HarnessFailure);
  expect(describeDiagnostic((error as HarnessFailure).diagnostic)).toContain(
    'fixture write epoch changed',
  );
  expect(spawns).toHaveLength(2);
  expect(
    (await target.calls()).filter((call) => call === 'e2eFixtures:resetCase'),
  ).toHaveLength(1);
  expect(await target.commits()).toEqual([
    'e2eFixtures:seedIdentityProjection',
  ]);
});

it('starts no retry once the run is cancelled or the browsers must stop', async () => {
  const cancelled = await deployment({
    modes: ['transport e2eFixtures:inspectCase*3'],
  });
  const waits: number[] = [];
  vi.spyOn(fixtureRetry, 'sleep').mockImplementation(async (ms: number) => {
    waits.push(ms);
    // Ctrl+C while waiting.
    process.emit('SIGINT');
  });
  const sigint = () => undefined;
  process.on('SIGINT', sigint);
  try {
    await expect(
      fixtureCall(cancelled.run, 'inspectCase', { caseKey: 'smoke' }),
    ).rejects.toBeInstanceOf(CommandFailure);
  } finally {
    process.removeListener('SIGINT', sigint);
  }
  expect(waits).toHaveLength(1);
  expect(await cancelled.calls()).toHaveLength(1);

  vi.restoreAllMocks();
  const late = await deployment({
    modes: ['transport e2eFixtures:inspectCase*3'],
    // A wait of at least 0.5 s would cross the stop point.
    browserStopAt: Date.now() + 400,
  });
  const lateWaits = recordWaits();
  await expect(
    fixtureCall(late.run, 'inspectCase', { caseKey: 'smoke' }),
  ).rejects.toBeInstanceOf(CommandFailure);
  expect(lateWaits).toEqual([]);
  expect(await late.calls()).toHaveLength(1);
});

// The composed worst case of one case's cleanup (#754): retryCleanup's three
// attempts, writeFixture's one cleanup after an epoch change, and two spawn
// retries per call. At most 4 `cleanupCase` executions reach Convex and at
// most 12 `cleanupCase` processes are spawned.
it('bounds a cleanup at 4 executions and 12 spawns, however its failures compose', async () => {
  const target = await deployment({
    modes: [
      // Two write conflicts, which retryCleanup repeats; then the third
      // execution finds the epoch moved, and writeFixture cleans up once
      // more with the new epoch.
      'conflict e2eFixtures:cleanupCase*2',
      'move-epoch-on 3 e2eFixtures:cleanupCase',
    ],
  });
  recordWaits();
  await readWriteEpoch(target.run);
  // Every cleanup spawn fails twice before one starts.
  const real = processSpawning.spawn;
  const spawns: number[] = [];
  vi.spyOn(processSpawning, 'spawn').mockImplementation(((
    file: string,
    args: readonly string[],
    options: object,
  ) => {
    if (!args.includes('e2eFixtures:cleanupCase'))
      return real(file, args, options);
    spawns.push(spawns.length + 1);
    if (spawns.length % 3 === 0) return real(file, args, options);
    const child: ChildProcess = spawn(
      join(tmpdir(), 'e2e-no-such-executable'),
      [],
      options,
    );
    child.once('error', (error: NodeJS.ErrnoException) => {
      error.code = 'EAGAIN';
    });
    return child;
  }) as typeof processSpawning.spawn);
  const error = await retryCleanup({
    cleanup: async () => {
      await fixtureCall(target.run, 'cleanupCase', { caseKey: 'smoke' });
    },
    stopAt: Number.POSITIVE_INFINITY,
    sleep: async () => undefined,
  }).catch((failure: unknown) => failure);
  const executions = (await target.calls()).filter(
    (call) => call === 'e2eFixtures:cleanupCase',
  );
  // Two conflicts, the stale execution and the cleanup with the new epoch,
  // which succeeds here; the attempt still fails for the epoch change.
  expect(executions).toHaveLength(4);
  expect(spawns).toHaveLength(12);
  expect(error).toBeDefined();
  expect(await target.commits()).toEqual(['e2eFixtures:cleanupCase']);
});

// #754 review S1: an epoch read that verifies a prepared environment is
// bounded by the run's clock, so a stalled backend cannot hold setup or
// cleanup past it.
it('ends a bounded epoch read when its time is up, and starts none past it', async () => {
  const target = await deployment({
    modes: ['hang initialMigration:clientStatus'],
  });
  recordWaits();
  const started = Date.now();
  await expect(
    readWriteEpoch(target.run, { until: Date.now() + 500 }),
  ).rejects.toBeInstanceOf(CommandFailure);
  expect(Date.now() - started).toBeLessThan(8_000);
  expect(await target.calls()).toEqual(['initialMigration:clientStatus']);
  await expect(
    readWriteEpoch(target.run, { until: Date.now() - 1 }),
  ).rejects.toThrow();
  expect(await target.calls()).toHaveLength(1);
}, 15_000);
