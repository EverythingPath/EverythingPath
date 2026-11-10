// @vitest-environment node
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { browserStopReserveMs, outerDeadlineReserveMs } from './deadline';
import { HarnessFailure } from './diagnostics';
import { CommandFailure, runSchema, type Run } from './process';
import { runE2E, type RunnerDependencies } from './runner';
import { failureReport, slotLockPath } from './setup-failure';
import { deploymentFixture, resources } from './test-data';
import { releaseQualification } from '../fixtures/release';
import { requiredTests, suites } from './matrix';

let root: string;
let written: string[];
const listenersBefore = process.listenerCount('SIGINT');
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'e2e-runner-lifecycle-'));
  written = [];
  vi.spyOn(process.stdout, 'write').mockImplementation((text) => {
    written.push(String(text));
    return true;
  });
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  delete process.env.E2E_RUN_FILE;
  await rm(root, { recursive: true, force: true });
});

const startedAt = Date.parse('2026-10-15T06:20:32.650Z');
type Call = {
  stage: string;
  processToken?: string;
  runToken?: string;
  /** The clock's latest reading when the command started. */
  readAt: number;
  timeoutMs?: number;
  interruptAfterMs?: number;
};
type Browsers = (options: {
  run: Run;
  env: NodeJS.ProcessEnv;
}) => Promise<string>;

// A clock that moves `clockStepMs` every time anything reads it, so a value
// derived from a later reading cannot pass for one derived from the start.
async function runWith({
  argv,
  clockStepMs = 10_000,
  browsers = () => Promise.resolve(''),
  overrides = {},
}: {
  argv: string[];
  clockStepMs?: number;
  browsers?: Browsers;
  overrides?: Partial<RunnerDependencies>;
}) {
  let now = startedAt;
  let last = startedAt;
  const calls: Call[] = [];
  let saved: Run | undefined;
  const stubs: Partial<RunnerDependencies> = {
    now: () => {
      last = now;
      now += clockStepMs;
      return last;
    },
    cwd: () => root,
    loadTargets: () =>
      Promise.resolve({
        resources,
        publishableKey: 'pk_test_probe',
        secretKey: 'sk_test_probe',
        previewKey: 'preview:test-team:test-project|probe',
      }),
    cohortWorkers: () => 1,
    verifyClerkCohorts: () => Promise.resolve(),
    // Never Docker: local tests replace the backend with fakes.
    checkLocalBackendHost: () => Promise.resolve(),
    createTemporaryDirectory: async () => {
      const directory = join(root, 'tmp');
      await mkdir(directory, { recursive: true });
      return directory;
    },
    sourceFingerprint: () => 'fingerprint',
    copyBuildWorkspace: () => Promise.resolve(),
    savePrivate: (path, content) => {
      if (path.endsWith('run.json'))
        saved = runSchema.parse(JSON.parse(String(content)));
      return Promise.resolve();
    },
    availablePort: () => Promise.resolve(4321),
    command: (stage, _args, options) => {
      calls.push({
        stage,
        readAt: last,
        processToken: options.env?.E2E_PROCESS_TOKEN,
        runToken: options.env?.E2E_RUN_TOKEN,
        timeoutMs: options.timeoutMs,
        interruptAfterMs: options.interruptAfterMs,
      });
      return stage.endsWith('browser journeys')
        ? browsers({ run: saved!, env: options.env ?? process.env })
        : Promise.resolve('');
    },
    checkGeneratedBindings: () => Promise.resolve(),
    loadRun: () => Promise.resolve({ ...saved!, fixture: deploymentFixture }),
    ...overrides,
  };
  const error = await runE2E(argv, stubs).catch((caught: unknown) => caught);
  return { calls, run: saved, error };
}

const argv = ['--resources', '/probe/resources.json'];

const localName = 'ep-e2e-11111111-1111-1111-1111-111111111111';
const fakeBackend = (
  directory: string,
  stop: () => Promise<void> = async () => undefined,
) => ({
  name: localName,
  url: 'http://127.0.0.1:3210',
  siteUrl: 'http://127.0.0.1:3211',
  envFile: join(directory, 'convex.env'),
  adminKeyFile: join(directory, 'local-admin.key'),
  stop,
});
const slotLockExists = () =>
  existsSync(
    slotLockPath(join(root, 'e2e', '.private'), resources.previewName),
  );

it.each(['deployment failure', 'interrupted startup'])(
  'removes the disposable local backend after %s without supplying a Cloud key',
  async (failure) => {
    const stop = vi.fn(async () => undefined);
    const deploy = vi.fn<RunnerDependencies['command']>(
      async (_stage, args, options) => {
        expect(args).toContain('--yes');
        expect(args).not.toContain('--preview-create');
        expect(options.env?.CONVEX_DEPLOY_KEY).toBeUndefined();
        throw new Error('deployment failed');
      },
    );
    const { run, error } = await runWith({
      argv: [...argv, '--backend', 'local'],
      overrides: {
        startLocalBackend: async ({ directory }) => {
          if (failure === 'interrupted startup') process.emit('SIGINT');
          return fakeBackend(directory, stop);
        },
        command: deploy,
      },
    });
    expect(error).toBeDefined();
    expect(stop).toHaveBeenCalledOnce();
    expect(existsSync(join(root, 'tmp'))).toBe(false);
    expect(slotLockExists()).toBe(false);
    if (failure === 'deployment failure') {
      expect(deploy).toHaveBeenCalledOnce();
      expect(run?.backend).toBe('local');
    } else {
      expect(deploy).not.toHaveBeenCalled();
      expect(failureReport(error)).toEqual([
        'Local Convex setup was interrupted; any container it created was removed, and any it started was stopped',
        'E2E setup failed: environment (terminated)',
      ]);
    }
  },
);

it('starts the local backend within the browser stop point and cancels it on SIGINT', async () => {
  let observed: { deadline?: number; aborted?: boolean } = {};
  const { run, error } = await runWith({
    argv: [...argv, '--backend', 'local', '--budget-minutes', '40'],
    overrides: {
      startLocalBackend: ({ deadline, signal }) => {
        observed = { deadline, aborted: signal?.aborted };
        // Startup rejects promptly once its signal aborts, as Docker does.
        return new Promise((_, reject) => {
          signal?.addEventListener('abort', () => {
            observed.aborted = signal.aborted;
            reject(
              new HarnessFailure({
                kind: 'local-backend',
                reason: 'interrupted',
              }),
            );
          });
          process.emit('SIGTERM');
        });
      },
    },
  });
  expect(run).toBeUndefined();
  const deadline = startedAt + 40 * 60_000;
  expect(observed).toEqual({
    deadline: deadline - browserStopReserveMs,
    aborted: true,
  });
  expect(failureReport(error)).toEqual([
    'Local Convex setup was interrupted; any container it created was removed, and any it started was stopped',
    'E2E setup failed: environment (terminated)',
  ]);
  expect(written).toContain('E2E stopping: cleaning up, please wait.\n');
  expect(slotLockExists()).toBe(false);
});

it('reports slow local startup that reaches the deadline as a timeout', async () => {
  const { error } = await runWith({
    argv: [...argv, '--backend', 'local'],
    overrides: {
      startLocalBackend: () =>
        Promise.reject(
          new HarnessFailure({ kind: 'local-backend', reason: 'timeout' }),
        ),
    },
  });
  expect(failureReport(error)).toEqual([
    'Local Convex setup ran out of time before the run deadline',
    'E2E setup failed: environment (timeout)',
  ]);
});

it('deletes the local credentials and reports a failed backend stop on its own', async () => {
  const { error } = await runWith({
    argv: [...argv, '--backend', 'local'],
    overrides: {
      startLocalBackend: async ({ directory }) => {
        await mkdir(directory, { recursive: true });
        await writeFile(join(directory, 'local-admin.key'), 'admin key');
        await writeFile(join(directory, 'convex.env'), 'admin key');
        return fakeBackend(directory, () =>
          Promise.reject(
            new HarnessFailure({
              kind: 'local-backend',
              reason: 'stop',
              name: localName,
            }),
          ),
        );
      },
    },
  });
  expect(existsSync(join(root, 'tmp'))).toBe(false);
  expect(slotLockExists()).toBe(false);
  // The browsers' missing report stays the primary failure.
  expect(failureReport(error)).toEqual([
    'E2E mandatory results are incomplete or unsuccessful',
    'E2E cleanup also failed: local-backend (unknown)',
    `The local Convex container could not be stopped or removed; check \`docker ps -a --filter label=dev.everythingpath.local-convex\` ("Local Convex on this machine" in e2e/README.md). Remove it with \`docker rm -f -v ${localName}\`.`,
  ]);
});

it.each([
  ['passes', undefined],
  ['fails', 'docker-unavailable'],
] as const)(
  'checks Docker and the pinned image in the local preflight and %s',
  async (_outcome, reason) => {
    const check = vi.fn<RunnerDependencies['checkLocalBackendHost']>(() =>
      reason
        ? Promise.reject(new HarnessFailure({ kind: 'local-backend', reason }))
        : Promise.resolve(),
    );
    const start = vi.fn<RunnerDependencies['startLocalBackend']>();
    const { error, calls } = await runWith({
      argv: [...argv, '--backend', 'local', '--preflight'],
      overrides: { checkLocalBackendHost: check, startLocalBackend: start },
    });
    expect(check).toHaveBeenCalledOnce();
    expect(start).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
    if (reason)
      expect(failureReport(error)).toEqual([
        'Docker is not reachable; start the Docker daemon and retry',
        'E2E setup failed: local-backend (unknown)',
      ]);
    else
      expect(written).toContain(
        'E2E preflight, local Docker backend check and read-only Clerk verification passed.\n',
      );
  },
);

it.each([[[]], [['--preflight']]])(
  'cancels the local Docker check on SIGINT and reports it as terminated (%j)',
  async (extra) => {
    let isAborted = false;
    const start = vi.fn<RunnerDependencies['startLocalBackend']>();
    const { error, calls } = await runWith({
      argv: [...argv, '--backend', 'local', ...extra],
      overrides: {
        startLocalBackend: start,
        // The Docker client is killed when the signal aborts.
        checkLocalBackendHost: ({ signal } = {}) =>
          new Promise((_, reject) => {
            signal?.addEventListener('abort', () => {
              isAborted = true;
              reject(
                new HarnessFailure({
                  kind: 'local-backend',
                  reason: 'interrupted',
                }),
              );
            });
            process.emit('SIGINT');
          }),
      },
    });
    expect(isAborted).toBe(true);
    expect(start).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
    expect(failureReport(error)).toEqual([
      'Local Convex setup was interrupted; any container it created was removed, and any it started was stopped',
      'E2E setup failed: local-backend (terminated)',
    ]);
    expect(process.listenerCount('SIGINT')).toBe(listenersBefore);
  },
);

it('never checks Docker in Cloud preview mode', async () => {
  const check = vi.fn<RunnerDependencies['checkLocalBackendHost']>();
  await runWith({
    argv: [...argv, '--preflight'],
    overrides: { checkLocalBackendHost: check },
  });
  expect(check).not.toHaveBeenCalled();
});

it('computes the deadline once, at the start, and passes it down', async () => {
  const { run, calls } = await runWith({
    argv: [...argv, '--budget-minutes', '40'],
  });
  const deadline = startedAt + 40 * 60_000;
  expect(run).toMatchObject({
    deadline,
    browserStopAt: deadline - browserStopReserveMs,
  });
  // Every timer counts down to a stored time from the moment it is set:
  // setup must end by the browser stop point; the browsers are interrupted at
  // it and terminated at the hard deadline.
  const [deployment, browsers] = calls;
  expect(deployment).toMatchObject({
    stage: 'preview deployment and web build',
    interruptAfterMs: undefined,
  });
  expect(deployment!.readAt).toBeGreaterThan(startedAt);
  expect(deployment!.readAt + deployment!.timeoutMs!).toBe(run!.browserStopAt);
  expect(browsers!.stage).toBe('E2E mandatory browser journeys');
  expect(browsers!.readAt).toBeGreaterThan(deployment!.readAt);
  expect(browsers!.readAt + browsers!.timeoutMs!).toBe(deadline);
  expect(browsers!.readAt + browsers!.interruptAfterMs!).toBe(
    run!.browserStopAt,
  );
});

it('keeps the 17.5-minute budget without the option', async () => {
  const { run } = await runWith({ argv });
  expect(run!.deadline).toBe(startedAt + 1_050_000);
  expect(run!.browserStopAt).toBe(startedAt + 990_000);
});

it('refuses a budget outside 5 to 120 minutes before any setup', async () => {
  const { error, calls } = await runWith({
    argv: [...argv, '--budget-minutes', '4'],
  });
  expect(failureReport(error)).toEqual([
    'E2E budget must be between 5 and 120 minutes',
    'E2E setup failed: arguments (validation)',
  ]);
  expect(calls).toEqual([]);
});

it('never starts the browsers once their stop point has passed', async () => {
  // Two minutes a reading: the four minutes before the stop point are gone by
  // the time the browsers would start.
  const { error, calls } = await runWith({
    argv: [...argv, '--budget-minutes', '5'],
    clockStepMs: 120_000,
  });
  expect(calls.map(({ stage }) => stage)).toEqual([
    'preview deployment and web build',
  ]);
  expect(failureReport(error)).toEqual([
    'E2E execution exceeded its time budget',
  ]);
});

it('finalizes a checkpoint the browsers left running, after they have exited', async () => {
  const { error, run } = await runWith({
    argv,
    browsers: async ({ run: { artifactDirectory } }) => {
      // Killed at the hard deadline: one test passed, one was cut off, one
      // never started, and Playwright never wrote its report.
      await writeFile(
        join(artifactDirectory, 'progress.json'),
        JSON.stringify({
          status: 'running',
          errors: 0,
          planned: ['a', 'b', 'c'].map((id) => ({
            id,
            project: 'chromium-tablet',
            file: 'x.spec.ts',
            title: `journey ${id}`,
          })),
          started: [
            { id: 'a', retry: 0 },
            { id: 'b', retry: 0 },
          ],
          evidence: [{ testId: 'a', retry: 0, status: 'passed' }],
        }),
      );
      throw new CommandFailure('E2E mandatory browser journeys', null);
    },
  });
  expect(failureReport(error)).toEqual([
    'E2E mandatory browser journeys: process failed (terminated)',
  ]);
  expect(
    JSON.parse(
      await readFile(join(run!.artifactDirectory, 'progress.json'), 'utf8'),
    ),
  ).toMatchObject({
    status: 'interrupted',
    completed: [{ title: 'journey a', status: 'passed' }],
    interrupted: [{ title: 'journey b' }],
    unstarted: [{ title: 'journey c' }],
  });
  expect(written).toContain(
    'E2E mandatory browser journeys interrupted: 1 completed, 1 interrupted, 1 not started.\n',
  );
});

it('marks every command with its run token and the wrapper marker', async () => {
  vi.stubEnv('E2E_PROCESS_TOKEN', '0123abcd');
  try {
    const { calls } = await runWith({
      argv,
      overrides: { createRunToken: () => 'run-token' },
    });
    expect(calls.map(({ processToken }) => processToken)).toEqual([
      '0123abcd',
      '0123abcd',
    ]);
    expect(calls.map(({ runToken }) => runToken)).toEqual([
      'run-token',
      'run-token',
    ]);
  } finally {
    vi.unstubAllEnvs();
  }
});

it('ends its run before CI interrupts it, from the CI deadline', async () => {
  // CI's job started 06:19:43; its workflow interrupts the runner at 06:37:13.
  const outerDeadlineAt = Date.parse('2026-10-15T06:37:13.000Z');
  for (const [name, value] of Object.entries({
    CI: 'true',
    GITHUB_ACTIONS: 'true',
    GITHUB_EVENT_NAME: 'schedule',
    GITHUB_ACTOR: 'AndreasUnunger',
    GITHUB_SHA: 'a'.repeat(40),
    E2E_REVIEWED_SHA: 'a'.repeat(40),
  }))
    vi.stubEnv(name, value);
  const { run, calls } = await runWith({
    argv: [...argv, '--outer-deadline-epoch', String(outerDeadlineAt / 1000)],
  });
  expect(run).toMatchObject({
    deadline: outerDeadlineAt - outerDeadlineReserveMs,
    browserStopAt:
      outerDeadlineAt - outerDeadlineReserveMs - browserStopReserveMs,
  });
  const browsers = calls[1]!;
  expect(browsers.readAt + browsers.timeoutMs!).toBe(run!.deadline);
  expect(written).toContain(
    'E2E budget: from 2026-10-15T06:20:32.650Z until the outer deadline; browsers stop at 2026-10-15T06:35:43.000Z, hard deadline 2026-10-15T06:36:43.000Z.\n',
  );
});

it('refuses a budget together with an outer deadline', async () => {
  const { error, calls } = await runWith({
    argv: [
      ...argv,
      '--budget-minutes',
      '40',
      '--outer-deadline-epoch',
      '1792045590',
    ],
  });
  expect(failureReport(error)).toEqual([
    'Use --budget-minutes or --outer-deadline-epoch, not both',
    'E2E setup failed: arguments (validation)',
  ]);
  expect(calls).toEqual([]);
});

it.skipIf(process.platform !== 'linux')(
  'stops and awaits every run process, in any process group, before it finalizes and deletes',
  async () => {
    const pidFile = join(root, 'server.pid');
    const { error, run } = await runWith({
      argv,
      browsers: async ({ run: { artifactDirectory }, env }) => {
        // Playwright was killed and left the application server's own
        // group running; when stopped, the server writes a stale checkpoint.
        const progress = join(artifactDirectory, 'progress.json');
        spawn(
          process.execPath,
          [
            '-e',
            `const fs = require('node:fs');
const [pidFile, progress] = process.argv.slice(1);
process.on('SIGTERM', () => {
  fs.writeFileSync(progress, JSON.stringify({ status: 'running', errors: 0, planned: [], started: [], evidence: [] }));
  process.exit(0);
});
fs.writeFileSync(pidFile, String(process.pid));
setInterval(() => {}, 1000);`,
            pidFile,
            progress,
          ],
          { env, detached: true, stdio: 'ignore' },
        ).unref();
        await expect.poll(() => existsSync(pidFile)).toBe(true);
        throw new CommandFailure('E2E mandatory browser journeys', null);
      },
    });
    expect(failureReport(error)).toEqual([
      'E2E mandatory browser journeys: process failed (terminated)',
    ]);
    const pid = Number(await readFile(pidFile, 'utf8'));
    expect(() => process.kill(pid, 0)).toThrow();
    // The stale write came first; finalization replaced it.
    expect(
      JSON.parse(
        await readFile(join(run!.artifactDirectory, 'progress.json'), 'utf8'),
      ),
    ).toMatchObject({ status: 'interrupted' });
    expect(existsSync(join(root, 'tmp'))).toBe(false);
  },
  20_000,
);

it('keeps the workspace, slot lock and checkpoint when a run process survives', async () => {
  const { error, run } = await runWith({
    argv,
    overrides: { reapRunProcesses: () => Promise.resolve([4242]) },
  });
  expect(failureReport(error)).toEqual([
    'E2E mandatory results are incomplete or unsuccessful',
    'E2E cleanup also failed: processes (validation)',
    'E2E child processes survived SIGKILL',
  ]);
  expect(existsSync(join(root, 'tmp'))).toBe(true);
  expect(
    existsSync(
      slotLockPath(join(root, 'e2e', '.private'), resources.previewName),
    ),
  ).toBe(true);
  expect(existsSync(join(run!.artifactDirectory, 'progress.json'))).toBe(false);
});

// A valid qualification record (release-qualification.ts) for the runner's
// console summary; the qualification process itself is stubbed.
const releaseEvidence = {
  previewName: resources.previewName,
  feat: {
    externalKey: releaseQualification.feat.externalKey,
    name: releaseQualification.feat.name,
    effect: '+3',
  },
  artifact: {
    releaseNumber: 1,
    artifactFingerprint: 'a'.repeat(64),
    batchCount: 67,
    stagedRows: 120,
  },
  reconciliation: {
    runId: 'k57run',
    invocations: 1,
    isReady: true as const,
    isDiscoveryComplete: true as const,
    pendingCount: 0 as const,
    failedCount: 0 as const,
    missingIdentityCount: 0 as const,
    stepCount: 9,
    staleCompletionCount: 0,
    work: [],
  },
  active: {
    releaseNumber: 1,
    artifactFingerprint: 'a'.repeat(64),
    impactRunId: 'k57run',
    activationId: 'e2e-release-qualification-1',
    schemaIdentity: 'character-sheet-v1',
    calculationIdentity: `sha256:${'b'.repeat(64)}`,
    isFixtureOnly: true as const,
  },
};

// A release run refuses a temporary directory under /tmp, where os.tmpdir()
// puts `root` when TMPDIR is unset; these runs get one outside it, as
// e2e-branch.sh's .ep-tmp/e2e-* TMPDIR is.
const releaseTemporaryRoot = join(
  process.cwd(),
  'node_modules',
  '.cache',
  'e2e-runner-lifecycle',
);
afterEach(async () => {
  await rm(releaseTemporaryRoot, { recursive: true, force: true });
});

function releaseRun(overrides: Partial<RunnerDependencies> = {}) {
  const events: string[] = [];
  let temporary = '';
  let savedRun: Run | undefined;
  const environments = new Map<string, Record<string, string | undefined>>();
  const requestedWorkers: (number | undefined)[] = [];
  const result = runWith({
    argv: [...argv, '--suite', 'release', '--workers', '3'],
    overrides: {
      cohortWorkers: (_resources, requested) => {
        requestedWorkers.push(requested);
        return 1;
      },
      command: (stage, _args, options) => {
        events.push(stage);
        environments.set(stage, options.env ?? {});
        return Promise.resolve('');
      },
      removeAdminKeyFile: (path) => {
        events.push(`remove ${path}`);
        return Promise.resolve();
      },
      readReleaseEvidence: () => Promise.resolve(releaseEvidence),
      savePrivate: (path, content) => {
        if (path.endsWith('run.json'))
          savedRun = runSchema.parse(JSON.parse(String(content)));
        if (path.endsWith('release-qualification.md'))
          events.push(`comment ${String(content).split('\n').at(-2) ?? ''}`);
        return Promise.resolve();
      },
      createTemporaryDirectory: async () => {
        await mkdir(releaseTemporaryRoot, { recursive: true });
        temporary = await mkdtemp(join(releaseTemporaryRoot, 'run-'));
        return temporary;
      },
      ...overrides,
    },
  });
  const keyFile = () => join(temporary, 'private', 'release-admin.key');
  return {
    result,
    events,
    environments,
    requestedWorkers,
    keyFile,
    temporary: () => temporary,
    run: () => savedRun,
  };
}

it('runs the release suite: its qualification, then the key file gone, then one browser worker', async () => {
  const release = releaseRun();
  const { result, events, environments, requestedWorkers } = release;
  const { error } = await result;
  const run = release.run();
  const keyFile = release.keyFile();
  expect(keyFile.startsWith(`${releaseTemporaryRoot}/`)).toBe(true);
  expect(events).toEqual([
    'preview deployment and web build',
    'catalog release qualification',
    `remove ${keyFile}`,
    'E2E release browser journeys',
    // The comment gets the browsers' actual outcome: here no report.
    'comment **Result.** The browser journeys did not all pass on their first attempt; see report.json in the safe evidence.',
    // Cleanup removes it again, whatever happened.
    `remove ${keyFile}`,
  ]);
  // Its results are checked against the release suite's required tests.
  expect(failureReport(error)).toEqual([
    'E2E release results are incomplete or unsuccessful',
  ]);
  expect(run).toMatchObject({ suite: suites.release, workers: 1 });
  expect(requestedWorkers).toEqual([1]);
  // The qualification gets the deploy key and no Clerk key; nothing names
  // the key file, and the browsers never see it either.
  const qualification = environments.get('catalog release qualification');
  expect(qualification).toMatchObject({
    CONVEX_DEPLOY_KEY: 'preview:test-team:test-project|probe',
  });
  expect(Object.keys(qualification ?? {}).join()).not.toContain('CLERK');
  for (const environment of environments.values())
    expect(JSON.stringify(environment)).not.toContain('release-admin.key');
  expect(JSON.stringify(run)).not.toContain('release-admin.key');
  expect(written.join('')).toContain(
    `E2E release qualification: Catalog Release 1 (artifact ${'a'.repeat(64)}) prepared, reconciled to readiness in run k57run`,
  );
});

it('removes the key file at cleanup when the qualification fails, and starts no browser', async () => {
  const release = releaseRun({
    command: (stage) =>
      stage === 'catalog release qualification'
        ? Promise.reject(new CommandFailure(stage, 1))
        : Promise.resolve(''),
  });
  const { result, events } = release;
  const { error } = await result;
  expect(failureReport(error)).toEqual([
    'E2E setup failed: release-qualification (exit-1)',
  ]);
  expect(events).toEqual([`remove ${release.keyFile()}`]);
  expect(existsSync(release.temporary())).toBe(false);
});

const usage =
  'Usage: pnpm test:e2e --resources /absolute/resources.json [--secrets /absolute/test-secrets.env] [--backend preview|local] [--preflight] [--suite mandatory|focused|live|nightly|release ... [--group G ...] | [--suite nightly] --journey TITLE|FILE ...] [--workers N] [--budget-minutes M | --outer-deadline-epoch S] [--reuse | --discard-prepared]';

it.each([
  [['--suite', 'release', '--suite', 'nightly']],
  [['--suite', 'release', '--group', 'sheet']],
  [['--suite', 'nightly', '--suite', 'mandatory']],
  [['--suite', 'routine']],
  [['--suite', 'focused']],
  [['--group', 'sheet']],
  [['--suite', 'focused', '--group', 'finished-weeks']],
  [['--suite', 'mandatory', '--journey', 'access.spec.ts']],
  [['--journey', 'canonical-cutover.spec.ts']],
])('refuses %j before any setup', async (extra) => {
  const { error, calls } = await runWith({ argv: [...argv, ...extra] });
  expect(failureReport(error)).toEqual([
    usage,
    'E2E setup failed: arguments (validation)',
  ]);
  expect(calls).toEqual([]);
});

it('runs the selected suites, prints their exact scope and checks the results against it', async () => {
  const { run, calls, error } = await runWith({
    argv: [
      ...argv,
      '--suite',
      'mandatory',
      '--suite',
      'focused',
      '--group',
      'sheet',
      '--group',
      'legal',
      '--suite',
      'live',
    ],
  });
  expect(run?.suite).toEqual({
    kind: 'routine',
    mandatory: true,
    live: true,
    groups: ['legal', 'sheet'],
  });
  expect(written).toContain(
    'E2E scope: mandatory + focused (legal, sheet) + live; 16 required results.\n',
  );
  expect(calls.map(({ stage }) => stage)).toContain(
    'E2E mandatory + focused (legal, sheet) + live browser journeys',
  );
  // No report here, so the selection's results are missing.
  expect(failureReport(error)).toEqual([
    'E2E mandatory + focused (legal, sheet) + live results are incomplete or unsuccessful',
  ]);
  expect(written.join('')).toContain(
    'E2E mandatory + focused (legal, sheet) + live browser results: failed or missing.',
  );
});

it.each([
  [[], suites.mandatory, 'E2E scope: mandatory; 7 required results.\n'],
  [
    ['--suite', 'nightly'],
    suites.nightly,
    'E2E scope: nightly (mandatory + every focused group + live + compatibility); 64 required results.\n',
  ],
  [
    ['--journey', 'legal-notices.spec.ts'],
    {
      kind: 'journeys',
      titles: [
        'anyone reads the legal notices of the committed Registry, from the app footer or signed out, at every width',
      ],
    },
    'E2E scope: journey (anyone reads the legal notices of the committed Registry, from the app footer or signed out, at every width); 2 required results.\n',
  ],
  [
    ['--suite', 'nightly', '--journey', 'character-sheet.spec.ts'],
    {
      kind: 'nightly',
      titles: [
        'two players edit one living sheet; failures stay local and rows keep their identity',
      ],
    },
    'E2E scope: nightly journey (two players edit one living sheet; failures stay local and rows keep their identity); 3 required results.\n',
  ],
] as const)('selects %j', async (extra, suite, scope) => {
  const { run } = await runWith({ argv: [...argv, ...extra] });
  expect(run?.suite).toEqual(suite);
  expect(written).toContain(scope);
});

it.each([
  [
    ['--suite', 'focused', '--group', 'sheet'],
    { kind: 'routine', mandatory: false, live: false, groups: ['sheet'] },
    'focused (sheet)',
    'focused (sheet)',
  ],
  [
    ['--journey', 'legal-notices.spec.ts'],
    {
      kind: 'journeys',
      titles: [
        'anyone reads the legal notices of the committed Registry, from the app footer or signed out, at every width',
      ],
    },
    'journey (anyone reads the legal notices of the committed Registry, from the app footer or signed out, at every width)',
    'journeys',
  ],
] as const)(
  'selects %j on the local backend, with the same scope, results and checkpoint as Cloud',
  async (extra, suite, scope, label) => {
    const { run, calls, error } = await runWith({
      argv: [...argv, '--backend', 'local', ...extra],
      overrides: {
        startLocalBackend: ({ directory }) =>
          Promise.resolve(fakeBackend(directory)),
      },
      browsers: async ({ run: { artifactDirectory } }) => {
        await writeFile(
          join(artifactDirectory, 'progress.json'),
          JSON.stringify({
            status: 'running',
            errors: 0,
            planned: ['a', 'b'].map((id) => ({
              id,
              project: 'chromium-tablet',
              file: 'x.spec.ts',
              title: `journey ${id}`,
            })),
            started: [{ id: 'a', retry: 0 }],
            evidence: [{ testId: 'a', retry: 0, status: 'passed' }],
          }),
        );
        return '';
      },
    });
    expect(run).toMatchObject({ backend: 'local', suite });
    expect(written).toContain(
      `E2E scope: ${scope}; ${requiredTests(run!.suite).length} required results.\n`,
    );
    expect(calls.map(({ stage }) => stage)).toContain(
      `E2E ${label} browser journeys`,
    );
    expect(written).toContain(
      `E2E ${label} browser journeys interrupted: 1 completed, 0 interrupted, 1 not started.\n`,
    );
    // No report, so the selection's results are missing.
    expect(failureReport(error)).toEqual([
      `E2E ${label} results are incomplete or unsuccessful`,
    ]);
  },
);

it('keeps a release run’s key file out of /tmp: its temporary directory must be under the wrapper’s TMPDIR', async () => {
  const { result, events } = releaseRun({
    createTemporaryDirectory: () =>
      Promise.resolve('/tmp/everythingpath-e2e-probe'),
  });
  const { error } = await result;
  expect(failureReport(error)).toEqual([
    'E2E release runs keep the preview admin key under TMPDIR, never /tmp; run them through scripts/orchestration/e2e-branch.sh',
    'E2E setup failed: temporary-directory (validation)',
  ]);
  expect(events.filter((event) => !event.startsWith('remove '))).toEqual([]);
});

it('creates the run’s temporary directory under TMPDIR, as the wrapper sets it', async () => {
  const parent = join(root, '.ep-tmp', 'e2e-branch-probe');
  await mkdir(parent, { recursive: true });
  vi.stubEnv('TMPDIR', parent);
  const { runnerDependencies } = await import('./runner');
  const created = await runnerDependencies.createTemporaryDirectory();
  expect(created.startsWith(`${parent}/everythingpath-e2e-`)).toBe(true);
});
