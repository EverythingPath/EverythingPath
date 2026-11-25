// @vitest-environment node
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { localBackendImage } from '../../scripts/local-convex/backend';
import { requiredTests } from './matrix';
import {
  preparedEnvironmentDirectory,
  readPreparedRecord,
  type PreparedRecord,
} from './prepared-environment';
import { runSchema, type Run } from './process';
import {
  diagnosticExitCode,
  runAndReport,
  runE2E,
  type RunnerDependencies,
} from './runner';
import { failureReport, slotLockPath } from './setup-failure';
import { deploymentFixture, resources } from './test-data';

// #754: `--reuse` keeps a prepared local environment between diagnostic
// runs. Docker, Convex and Playwright are fakes here; the record, the
// directories and the cleanup order are real.

let parent: string;
let root: string;
let written: string[];
// Containers are numbered across the runs of one test.
let containers = 0;
beforeEach(async () => {
  containers = 0;
  // Test runners often set CI, which refuses --reuse.
  vi.stubEnv('CI', '');
  parent = await mkdtemp(join(tmpdir(), 'e2e-runner-reuse-'));
  root = join(parent, 'checkout');
  await mkdir(root);
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
  await rm(parent, { recursive: true, force: true });
});

const preparedDirectory = () =>
  preparedEnvironmentDirectory({
    sourceRoot: root,
    previewName: resources.previewName,
  });
const instance = (n: number) =>
  `ep-e2e-${String(n).repeat(8)}-1111-1111-1111-111111111111`;
const fingerprintParts = (sources = 'b') => ({
  reuseFingerprint: (sources === 'b' ? 'a' : 'f').repeat(64),
  parts: {
    sources: sources.repeat(64),
    buildEnvironment: 'c'.repeat(64),
    node: 'v24.0.0',
    pnpm: '10.0.0',
    dependencies: 'd'.repeat(64),
  },
});

/** One run's fakes and what they saw. */
function fakes({
  sources = 'b',
  epoch = 0,
  epochAtCleanup = epoch,
  running = new Set<string>(),
  browsersPass = true,
  overrides = {},
}: {
  sources?: string;
  epoch?: number;
  epochAtCleanup?: number;
  running?: Set<string>;
  browsersPass?: boolean;
  overrides?: Partial<RunnerDependencies>;
} = {}) {
  const events: string[] = [];
  let saved: Run | undefined;
  let created = 0;
  let epochReads = 0;
  const stubs: Partial<RunnerDependencies> = {
    cwd: () => root,
    loadTargets: () =>
      Promise.resolve({
        resources,
        publishableKey: 'pk_test_probe',
        secretKey: 'sk_test_probe',
        previewKey: '',
      }),
    cohortWorkers: () => 1,
    verifyClerkCohorts: () => Promise.resolve(),
    checkLocalBackendHost: () => Promise.resolve(),
    createTemporaryDirectory: async () => {
      const directory = join(parent, `run-${Date.now()}-${created++}`);
      await mkdir(join(directory, 'private'), { recursive: true });
      return directory;
    },
    sourceFingerprint: () => 'full-fingerprint',
    copyBuildWorkspace: async (_source, workspace) => {
      events.push('copy workspace');
      await mkdir(workspace, { recursive: true });
    },
    refreshSpecFiles: async () => {
      events.push('refresh specs');
    },
    reuseFingerprint: () => fingerprintParts(sources),
    readToolchain: () => ({ node: 'v24.0.0', pnpm: '10.0.0' }),
    savePrivate: (path, content) => {
      if (path.endsWith('run.json'))
        saved = runSchema.parse(JSON.parse(String(content)));
      return Promise.resolve();
    },
    availablePort: () => Promise.resolve(4321),
    startLocalBackend: async ({ directory, reuseName }) => {
      const name = reuseName ?? instance(containers++);
      events.push(reuseName ? `resume ${name}` : `create ${name}`);
      return {
        name,
        url: 'http://127.0.0.1:3210',
        siteUrl: 'http://127.0.0.1:3211',
        envFile: join(directory, 'convex.env'),
        adminKeyFile: join(directory, 'local-admin.key'),
        stop: async ({ keep = false } = {}) => {
          events.push(keep ? `keep ${name}` : `remove ${name}`);
        },
      };
    },
    readWriteEpoch: async () => {
      epochReads++;
      // Before the browsers: the deployment's epoch; at cleanup: whatever
      // the run left it at.
      return saved && events.some((event) => event.endsWith('browser journeys'))
        ? epochAtCleanup
        : epoch;
    },
    isLocalBackendRunning: async (name) => running.has(name),
    discardLocalBackend: async (name) => {
      events.push(`discard ${name}`);
    },
    isWorkspaceFreeOfSecrets: async () => true,
    command: async (stage, args, options) => {
      events.push(stage);
      if (stage === 'fixture binding')
        expect(args).toEqual([
          'exec',
          'tsx',
          'e2e/bind-preview.ts',
          '--bind-only',
        ]);
      if (stage.endsWith('browser journeys')) {
        const run = saved!;
        expect(options.env?.E2E_RUN_FILE).toBeDefined();
        await mkdir(run.artifactDirectory, { recursive: true });
        await writeFile(
          join(run.artifactDirectory, 'report.json'),
          JSON.stringify({
            status: browsersPass ? 'passed' : 'failed',
            errors: 0,
            tests: requiredTests(run.suite).map(([file, project, title]) => ({
              file,
              project,
              title,
              expectedStatus: 'passed',
              tags: [],
              annotations: [],
              results: [
                { status: browsersPass ? 'passed' : 'failed', retry: 0 },
              ],
            })),
          }),
        );
      }
      return '';
    },
    checkGeneratedBindings: () => Promise.resolve(),
    loadRun: () => Promise.resolve({ ...saved!, fixture: deploymentFixture }),
    ...overrides,
  };
  return {
    stubs,
    events,
    run: () => saved,
    epochReads: () => epochReads,
  };
}

const journey = [
  '--resources',
  '/probe/resources.json',
  '--backend',
  'local',
  '--journey',
  'character-attacks.spec.ts',
];
const reuse = [...journey, '--reuse'];
const lockReleased = () =>
  !existsSync(
    slotLockPath(join(root, 'e2e', '.private'), resources.previewName),
  );

it.each([
  ['the default mandatory suite', ['--backend', 'local']],
  [
    'mandatory with focused groups',
    [
      '--backend',
      'local',
      '--suite',
      'mandatory',
      '--suite',
      'focused',
      '--group',
      'sheet',
    ],
  ],
  ['live integration', ['--backend', 'local', '--suite', 'live']],
  ['the whole nightly suite', ['--backend', 'local', '--suite', 'nightly']],
  ['release qualification', ['--backend', 'local', '--suite', 'release']],
  [
    'the preflight (the land queue)',
    [
      '--backend',
      'local',
      '--preflight',
      '--journey',
      'character-attacks.spec.ts',
    ],
  ],
  [
    'a Cloud preview',
    ['--backend', 'preview', '--journey', 'character-attacks.spec.ts'],
  ],
])('refuses --reuse for %s before any setup', async (_label, extra) => {
  const { stubs, events } = fakes();
  const error = await runE2E(
    ['--resources', '/probe/resources.json', ...extra, '--reuse'],
    stubs,
  ).catch((caught: unknown) => caught);
  expect(failureReport(error)).toEqual([
    '--reuse needs --backend local and a diagnostic selection: --journey, --suite nightly --journey, or --suite focused --group ... alone. Qualifying runs (mandatory, live, nightly, release, --preflight, CI, an outer deadline) always prepare afresh',
    'E2E setup failed: arguments (validation)',
  ]);
  expect(events).toEqual([]);
});

it.each([
  [
    'in CI',
    (): void => {
      vi.stubEnv('CI', 'true');
    },
    [],
  ],
  // Outside CI an outer deadline is refused anyway; in trusted CI, --reuse is.
  [
    'with an outer deadline',
    (): void => undefined,
    ['--outer-deadline-epoch', '1999999999'],
  ],
] as const)(
  'refuses --reuse %s before any setup',
  async (_label, prepare, extra) => {
    prepare();
    const { stubs, events } = fakes();
    const error = await runE2E([...reuse, ...extra], stubs).catch(
      (caught: unknown) => caught,
    );
    expect(failureReport(error).at(-1)).toBe(
      'E2E setup failed: arguments (validation)',
    );
    expect(events).toEqual([]);
  },
);

it.each([
  ['a journey', []],
  ['a nightly journey diagnosis', ['--suite', 'nightly']],
])('accepts --reuse for %s', async (_label, extra) => {
  const { stubs } = fakes();
  // Nothing to reuse yet: it prepares afresh, which is fresh evidence.
  expect(await runE2E([...reuse, ...extra], stubs)).toBe('qualifying');
});

it('accepts --reuse for focused groups alone', async () => {
  const { stubs } = fakes();
  expect(
    await runE2E(
      [
        '--resources',
        '/probe/resources.json',
        '--backend',
        'local',
        '--suite',
        'focused',
        '--group',
        'sheet',
        '--reuse',
      ],
      stubs,
    ),
  ).toBe('qualifying');
});

it('prepares, keeps and then reuses an environment; a reused pass is diagnostic, exit 5, and says so', async () => {
  const first = fakes();
  // A fresh preparation is fresh evidence; only a reused one is diagnostic.
  expect(await runE2E(reuse, first.stubs)).toBe('qualifying');
  // The first --reuse run had nothing to reuse: it deployed and built, and
  // kept the stopped container.
  expect(first.events).toEqual(
    expect.arrayContaining([
      'copy workspace',
      `create ${instance(0)}`,
      'preview deployment and web build',
      `keep ${instance(0)}`,
    ]),
  );
  expect(first.run()?.workspace).toBe(join(preparedDirectory(), 'workspace'));
  const record = (await readPreparedRecord(
    preparedDirectory(),
  )) as PreparedRecord;
  expect(record).toMatchObject({
    state: 'ready',
    instanceName: instance(0),
    preparation: {
      reuseFingerprint: 'a'.repeat(64),
      sourceFingerprint: 'full-fingerprint',
      workers: 1,
      releaseState: 'none',
      backend: { image: localBackendImage, url: 'http://127.0.0.1:3210' },
      writeEpoch: 0,
    },
  });

  const second = fakes();
  expect(await runAndReport(reuse, second.stubs)).toBe(diagnosticExitCode);
  expect(second.events).toEqual([
    `resume ${instance(0)}`,
    'refresh specs',
    'fixture binding',
    'E2E journeys browser journeys',
    `keep ${instance(0)}`,
  ]);
  expect(second.run()?.preparation).toBe('reused');
  expect(written.join('')).toContain(
    'E2E prepared environment: reused (diagnostic, not qualifying).\n',
  );
  expect(written.join('')).toMatch(
    /browser results: passed \(reused preparation; diagnostic, not qualifying\)/,
  );
  expect(written.join('')).toContain(
    'passed on a reused preparation: diagnostic only, not qualifying (exit 5).',
  );
  expect(
    (await readPreparedRecord(preparedDirectory())) as PreparedRecord,
  ).toMatchObject({
    state: 'ready',
    preparation: { createdAt: record.preparation!.createdAt },
  });
  expect(lockReleased()).toBe(true);
});

it('prepares afresh, removing the old container, when the sources changed', async () => {
  await runE2E(reuse, fakes().stubs);
  const changed = fakes({ sources: 'e' });
  await runE2E(reuse, changed.stubs);
  expect(changed.events).toEqual(
    expect.arrayContaining([
      `discard ${instance(0)}`,
      'copy workspace',
      'preview deployment and web build',
    ]),
  );
  expect(changed.events).not.toContain(`resume ${instance(0)}`);
  expect(written.join('')).toContain(
    'E2E prepared environment: preparing afresh (sources changed).\n',
  );
});

it('prepares afresh when the resumed deployment’s write epoch moved', async () => {
  await runE2E(reuse, fakes().stubs);
  const moved = fakes({ epoch: 1 });
  await runE2E(reuse, moved.stubs);
  expect(moved.events.slice(0, 3)).toEqual([
    `resume ${instance(0)}`,
    `remove ${instance(0)}`,
    `discard ${instance(0)}`,
  ]);
  expect(moved.events).toContain('preview deployment and web build');
});

it('refuses an environment another run holds while its container runs, and discards one whose run crashed', async () => {
  await runE2E(reuse, fakes().stubs);
  const record = (await readPreparedRecord(
    preparedDirectory(),
  )) as PreparedRecord;
  await writeFile(
    join(preparedDirectory(), 'record.json'),
    JSON.stringify({ ...record, state: 'in-use', ownerToken: 'other-run' }),
  );
  const held = fakes({ running: new Set([instance(0)]) });
  const error = await runE2E(reuse, held.stubs).catch(
    (caught: unknown) => caught,
  );
  expect(failureReport(error)).toEqual([
    'The prepared E2E environment belongs to another run whose container is still running. Check `docker ps` and `pgrep -af e2e/run`; if no run uses it, rerun with --discard-prepared',
    'E2E setup failed: prepared-environment (validation)',
  ]);
  expect(held.events).toEqual([]);
  expect(
    (await readPreparedRecord(preparedDirectory())) as PreparedRecord,
  ).toMatchObject({
    state: 'in-use',
    ownerToken: 'other-run',
  });
  expect(lockReleased()).toBe(true);

  const crashed = fakes();
  await runE2E(reuse, crashed.stubs);
  expect(crashed.events[0]).toBe(`discard ${instance(0)}`);
});

it('keeps ownership until its private files are gone, and discards the environment when they cannot be deleted', async () => {
  const order: string[] = [];
  const failing = fakes({
    overrides: {
      removeDirectory: async (path) => {
        if (path.includes(`${parent}/run-`)) {
          order.push('remove private files (fails)');
          throw Object.assign(new Error('busy'), { code: 'EBUSY' });
        }
        if (path === preparedDirectory())
          order.push('remove prepared environment');
        await rm(path, { recursive: true, force: true });
      },
      releaseSlotLock: async () => {
        order.push(
          `release slot lock (record ${existsSync(preparedDirectory()) ? 'present' : 'gone'})`,
        );
      },
    },
  });
  const error = await runE2E(reuse, failing.stubs).catch(
    (caught: unknown) => caught,
  );
  expect(failureReport(error)).toEqual([
    'E2E cleanup failed: temporary-directory (EBUSY)',
  ]);
  // Never published as ready: discarded, container and all, before the lock
  // was released.
  expect(failing.events).toContain(`keep ${instance(0)}`);
  expect(failing.events.at(-1)).toBe(`discard ${instance(0)}`);
  expect(order).toEqual([
    'remove private files (fails)',
    'remove prepared environment',
    'release slot lock (record gone)',
  ]);
});

it('does not keep an environment after an interruption, a moved epoch or a secret in the build', async () => {
  for (const [label, options] of [
    ['moved epoch', { epochAtCleanup: 1 }],
    [
      'secret in the build',
      { overrides: { isWorkspaceFreeOfSecrets: async () => false } },
    ],
  ] as const) {
    const run = fakes(options);
    await runE2E(reuse, run.stubs).catch(() => undefined);
    expect(
      run.events.filter((event) => /^(?:keep|remove) /.test(event)),
      label,
    ).toEqual([expect.stringMatching(/^remove /)]);
    expect(existsSync(preparedDirectory()), label).toBe(false);
  }
  const interrupted = fakes({
    overrides: {
      command: async (stage) => {
        if (stage.endsWith('browser journeys')) process.emit('SIGINT');
        return '';
      },
    },
  });
  await runE2E(reuse, interrupted.stubs).catch(() => undefined);
  expect(
    interrupted.events.filter((event) => /^(?:keep|remove) /.test(event)),
  ).toEqual([expect.stringMatching(/^remove /)]);
  expect(existsSync(preparedDirectory())).toBe(false);
});

it('keeps the environment after a failed journey whose cleanups passed: that is the diagnosis', async () => {
  const failed = fakes({ browsersPass: false });
  const error = await runE2E(reuse, failed.stubs).catch(
    (caught: unknown) => caught,
  );
  expect(failureReport(error)).toEqual([
    'E2E journeys results are incomplete or unsuccessful',
  ]);
  expect(failed.events).toContain(`keep ${instance(0)}`);
  expect(
    ((await readPreparedRecord(preparedDirectory())) as PreparedRecord).state,
  ).toBe('ready');
});

it('a run without --reuse discards a kept environment and keeps nothing', async () => {
  await runE2E(reuse, fakes().stubs);
  const plain = fakes();
  expect(await runE2E(journey, plain.stubs)).toBe('qualifying');
  expect(plain.events[0]).toBe(`discard ${instance(0)}`);
  expect(plain.events).toContain(`remove ${instance(1)}`);
  expect(existsSync(preparedDirectory())).toBe(false);
  expect(plain.run()?.preparation).toBe('fresh');
});

it('--discard-prepared removes the kept environment under the slot lock', async () => {
  await runE2E(reuse, fakes().stubs);
  const discard = fakes();
  expect(
    await runE2E(
      [
        '--resources',
        '/probe/resources.json',
        '--backend',
        'local',
        '--discard-prepared',
      ],
      discard.stubs,
    ),
  ).toBe('qualifying');
  expect(discard.events).toEqual([`discard ${instance(0)}`]);
  expect(existsSync(preparedDirectory())).toBe(false);
  expect(lockReleased()).toBe(true);
  expect(written.join('')).toContain('E2E prepared environment discarded.\n');
});

// #754 review P2: an application edit while the kept backend resumes must
// not let the run test the kept, older build.
it('prepares afresh when the sources change while the kept backend resumes', async () => {
  await runE2E(reuse, fakes().stubs);
  let sources = 'b';
  const edited = fakes({
    overrides: {
      reuseFingerprint: () => fingerprintParts(sources),
    },
  });
  const resume = edited.stubs.startLocalBackend!;
  edited.stubs.startLocalBackend = async (options) => {
    if (options.reuseName) sources = 'e';
    return await resume(options);
  };
  await runE2E(reuse, edited.stubs);
  expect(edited.events.slice(0, 3)).toEqual([
    `resume ${instance(0)}`,
    `remove ${instance(0)}`,
    `discard ${instance(0)}`,
  ]);
  expect(edited.events).toContain('preview deployment and web build');
  expect(written.join('')).toContain(
    'E2E prepared environment: preparing afresh (sources changed).\n',
  );
  expect(
    ((await readPreparedRecord(preparedDirectory())) as PreparedRecord)
      .preparation?.reuseFingerprint,
  ).toBe(fingerprintParts('e').reuseFingerprint);
});

it('fails the snapshot when the sources change after the reuse was accepted', async () => {
  await runE2E(reuse, fakes().stubs);
  let sources = 'b';
  const edited = fakes({
    overrides: {
      reuseFingerprint: () => fingerprintParts(sources),
      refreshSpecFiles: async () => {
        sources = 'e';
      },
    },
  });
  const error = await runE2E(reuse, edited.stubs).catch(
    (caught: unknown) => caught,
  );
  expect(failureReport(error)).toEqual([
    'E2E source changed while preparing the test workspace',
    'E2E setup failed: source-snapshot (validation)',
  ]);
  expect(edited.events).not.toContain(`keep ${instance(0)}`);
  expect(existsSync(preparedDirectory())).toBe(false);
});

// #754 review S1: verification reads are bounded by the run's clock, and an
// environment whose verification cannot finish in time is not kept.
it('bounds every verification read by the run clock, and discards on a stalled one', async () => {
  await runE2E(reuse, fakes().stubs);
  const bounds: { phase: string; until: number | undefined; run: Run }[] = [];
  const stalled = fakes({
    overrides: {
      readWriteEpoch: async (run, options) => {
        bounds.push({ phase: 'resume', until: options?.until, run });
        // As a bounded read does once its time is up.
        throw new Error('timed out');
      },
    },
  });
  await runE2E(reuse, stalled.stubs).catch(() => undefined);
  expect(stalled.events.slice(0, 3)).toEqual([
    `resume ${instance(0)}`,
    `remove ${instance(0)}`,
    `discard ${instance(0)}`,
  ]);
  // The fresh preparation's own read stalls too, so nothing is kept.
  expect(stalled.events).not.toContain(`keep ${instance(1)}`);
  expect(existsSync(preparedDirectory())).toBe(false);
  for (const { until, run } of bounds) {
    expect(until).toBeDefined();
    expect(run.browserStopAt).toBeDefined();
    expect(until!).toBeLessThanOrEqual(run.deadline!);
  }

  let isAfterBrowsers = false;
  const cleanupReads: (number | undefined)[] = [];
  const atCleanup = fakes({
    overrides: {
      readWriteEpoch: async (_run, options) => {
        if (!isAfterBrowsers) return 0;
        cleanupReads.push(options?.until);
        throw new Error('timed out');
      },
    },
  });
  const command = atCleanup.stubs.command!;
  atCleanup.stubs.command = async (stage, args, options) => {
    const output = await command(stage, args, options);
    if (stage.endsWith('browser journeys')) isAfterBrowsers = true;
    return output;
  };
  await runE2E(reuse, atCleanup.stubs).catch(() => undefined);
  expect(cleanupReads).toHaveLength(1);
  expect(cleanupReads[0]).toBeDefined();
  expect(atCleanup.events.some((event) => event.startsWith('keep '))).toBe(
    false,
  );
  expect(existsSync(preparedDirectory())).toBe(false);
});
