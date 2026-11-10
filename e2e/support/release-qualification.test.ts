// @vitest-environment node
import { existsSync } from 'node:fs';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { releaseQualification } from '../fixtures/release';
import { catalogRuntimeCompatibility } from '../../src/lib/catalog/runtime-compatibility';
import { CommandEvidenceFailure, CommandFailure, type Run } from './process';
import { HarnessFailure } from './diagnostics';
import {
  describeBrowserOutcome,
  formatReleaseComment,
  qualifyRelease,
  readReleaseEvidence,
  summarizeReleaseEvidence,
  type ReleaseQualificationDependencies,
} from './release-qualification';
import { failureReport } from './setup-failure';
import { safeDiagnostic } from './artifacts';
import { releaseJourney, suites } from './matrix';
import { deploymentFixture, fixtureCredentials, resources } from './test-data';

const previewKey = 'preview:test-team:test-project|preview-secret';
const adminKey = 'quiet-otter-123|admin-secret';
const fingerprint = 'a'.repeat(64);
const runId = 'k57abcd1234efgh5678catalogimpactrun';
const { calculation, schema } = catalogRuntimeCompatibility;

let root: string;
let run: Run;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'release-qualification-'));
  run = {
    suite: suites.release,
    preparation: 'fresh',
    workers: 1,
    resources,
    fixture: deploymentFixture,
    workspace: join(root, 'workspace'),
    sourceRoot: root,
    privateDirectory: join(root, 'tmp', 'private'),
    artifactDirectory: join(root, 'artifacts'),
    envFile: join(root, 'tmp', 'private', 'convex.env'),
    baseURL: 'http://127.0.0.1:4321',
  };
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const keyPath = () => join(run.privateDirectory, 'release-admin.key');
const activation = {
  releaseNumber: 1,
  artifactFingerprint: fingerprint,
  impactRunId: runId,
  activationId: releaseQualification.activationId,
  schemaIdentity: schema,
  calculationIdentity: calculation,
  isFixtureOnly: true,
};
const reconciled = (stopped: string, isReady = stopped === 'ready') => ({
  runId,
  status: {
    isDiscoveryComplete: true,
    isReady,
    pendingCount: isReady ? 0 : 1,
    failedCount: 0,
    missingIdentityCount: 0,
    identityCoverageComplete: true,
  },
  stepCount: 9,
  staleCompletionCount: 0,
  stopped,
});
const work = [
  {
    character: 'E2E catalog-release-character',
    state: 'unaffected',
    reasons: [],
    hasFactsChanged: null,
  },
  {
    character: releaseQualification.reconciledCharacter,
    state: 'ready',
    reasons: [
      'k57abcd1234efgh5678catalogentry',
      `key:${releaseQualification.feat.externalKey}`,
    ],
    hasFactsChanged: false,
  },
];

type Call = {
  stage: string;
  args: string[];
  env: Record<string, string | undefined>;
  keyMode: number | null;
};
// The operator's answers by command; `reconcile` answers in turn.
function stubs({
  reconcile = [reconciled('ready')],
  active = activation,
  releaseWork = work,
  exchange,
}: {
  reconcile?: unknown[];
  active?: unknown;
  releaseWork?: unknown[];
  exchange?: ReleaseQualificationDependencies['authorizePreview'];
} = {}) {
  const calls: Call[] = [];
  const fixtureCalls: [string, Record<string, unknown>][] = [];
  const answers: Record<string, () => unknown> = {
    build: () => ({
      manifest: { releaseNumber: 1, artifactFingerprint: fingerprint },
    }),
    prepare: () => ({
      releaseNumber: 1,
      state: 'prepared',
      batchCount: 67,
      stagedRows: 120,
    }),
    reconcile: () => reconcile.shift(),
    activate: () => activation,
    active: () => active,
  };
  const overrides: Partial<ReleaseQualificationDependencies> = {
    loadRun: () => Promise.resolve(run),
    fixtureCall: (_run, operation, args) => {
      fixtureCalls.push([operation, args]);
      return Promise.resolve(
        operation === 'inspectCase'
          ? { characterIds: ['k1', 'k2'], releaseWork }
          : operation === 'resetCase'
            ? { campaignId: 'k0', campaignKey: 'catalog-release-campaign' }
            : null,
      );
    },
    readWriteEpoch: () => Promise.resolve(0),
    materializeReleaseSources: (directory) =>
      Promise.resolve({
        systemPath: join(directory, 'pf1'),
        contentPath: join(directory, 'pf1-content'),
      }),
    readInstalledConvexVersion: () => Promise.resolve('1.45.0'),
    authorizePreview:
      exchange ??
      (() =>
        Promise.resolve({
          deploymentName: 'quiet-otter-123',
          deploymentUrl: deploymentFixture.convexUrl,
          adminKey,
        })),
    command: async (stage, args, options) => {
      const path = keyPath();
      calls.push({
        stage,
        args,
        env: options.env ?? {},
        keyMode: existsSync(path) ? (await stat(path)).mode & 0o777 : null,
      });
      if (stage === 'catalog pin') return `${calculation}\n`;
      const answer = answers[args[2] ?? '']?.();
      return JSON.stringify(answer);
    },
    environment: () => ({
      PATH: '/usr/bin',
      HOME: root,
      TMPDIR: root,
      E2E_RUN_FILE: join(run.privateDirectory, 'run.json'),
      E2E_RUN_TOKEN: 'run-token',
      CONVEX_DEPLOY_KEY: previewKey,
      CLERK_SECRET_KEY: 'sk_test_secret',
      NODE_ENV: 'production',
    }),
  };
  return { overrides, calls, fixtureCalls };
}

it('qualifies a local release without exchanging a Cloud preview key', async () => {
  const name = 'ep-e2e-11111111-1111-1111-1111-111111111111';
  const url = 'http://127.0.0.1:3210';
  const localKey = join(run.privateDirectory, 'local-admin.key');
  await mkdir(run.privateDirectory, { recursive: true });
  await writeFile(localKey, 'local-admin-secret', { mode: 0o600 });
  run.backend = 'local';
  run.localDeployment = { name, url, adminKeyFile: localKey };
  run.fixture = { ...deploymentFixture, convexUrl: url, localInstance: name };
  const exchange = vi.fn(async () => {
    throw new Error('Cloud must not be contacted');
  });
  const { overrides, calls } = stubs({ exchange });
  const evidence = await qualifyRelease(overrides);
  expect(exchange).not.toHaveBeenCalled();
  for (const call of calls.filter(({ args }) =>
    args.includes('--target-kind'),
  )) {
    expect(call.args).toContain('local');
    expect(call.args).toContain(url);
    expect(call.keyMode).toBe(0o600);
    expect(Object.keys(call.env).some((key) => key.startsWith('CONVEX_'))).toBe(
      false,
    );
  }
  expect(existsSync(keyPath())).toBe(false);
  expect(formatReleaseComment(evidence)).toContain('local instance admin key');
  expect(formatReleaseComment(evidence)).not.toContain('preview-key exchange');
});

it('seeds the case, builds once, then prepares, reconciles, activates and checks the release with only the key file', async () => {
  const { overrides, calls, fixtureCalls } = stubs();
  const evidence = await qualifyRelease(overrides);

  // The case first, on the first cohort, before any release command.
  expect(fixtureCalls.map(([operation]) => operation)).toEqual([
    'seedIdentityProjection',
    'resetCase',
    'inspectCase',
  ]);
  expect(fixtureCalls[1]?.[1]).toMatchObject({
    caseKey: 'catalogRelease',
    workerKey: 'worker-0',
    ...fixtureCredentials,
  });
  expect(fixtureCalls[2]?.[1]).toMatchObject({ releaseRunId: runId });
  expect(calls.map(({ stage }) => stage)).toEqual([
    'catalog pin',
    'catalog release build',
    'catalog release prepare',
    'catalog release reconcile',
    'catalog release activate',
    'catalog release active',
  ]);
  const [, build, prepare, reconcile, activate, active] = calls;
  // The artifact is built in the run's temporary directory, never /tmp.
  const releaseDirectory = join(root, 'tmp', 'release');
  expect(build?.args).toEqual([
    '-s',
    'catalog:release',
    'build',
    '--number',
    '1',
    '--schema',
    schema,
    '--calculation',
    calculation,
    '--system',
    join(releaseDirectory, 'sources', 'pf1'),
    '--content',
    join(releaseDirectory, 'sources', 'pf1-content'),
    '--artifact',
    join(releaseDirectory, 'artifact', 'release.json'),
    '--allow-unverified-checkouts',
  ]);
  const target = [
    '--deployment-name',
    'quiet-otter-123',
    '--deployment-url',
    deploymentFixture.convexUrl,
    '--target-kind',
    'preview',
    '--admin-key-file',
    keyPath(),
  ];
  expect(prepare?.args.slice(2)).toEqual([
    'prepare',
    '--artifact',
    join(releaseDirectory, 'artifact', 'release.json'),
    '--write-epoch',
    '0',
    ...target,
  ]);
  expect(reconcile?.args.slice(2)).toEqual([
    'reconcile',
    '--number',
    '1',
    '--write-epoch',
    '0',
    '--max-steps',
    '100',
    ...target,
  ]);
  expect(activate?.args.slice(2)).toEqual([
    'activate',
    '--number',
    '1',
    '--run-id',
    runId,
    '--operation-id',
    'e2e-release-qualification-1',
    '--schema',
    schema,
    '--calculation',
    calculation,
    '--fixture-only',
    '--write-epoch',
    '0',
    ...target,
  ]);
  expect(active?.args.slice(2)).toEqual(['active', ...target]);
  // The key exists, mode 600, only while the operator needs it.
  expect(calls.map(({ keyMode }) => keyMode)).toEqual([
    null,
    null,
    0o600,
    0o600,
    0o600,
    0o600,
  ]);
  expect(existsSync(keyPath())).toBe(false);
  // No operator environment holds a credential; no argument holds the key.
  for (const call of calls) {
    expect(Object.keys(call.env).sort()).toEqual([
      'E2E_RUN_FILE',
      'E2E_RUN_TOKEN',
      'HOME',
      'NODE_ENV',
      'PATH',
      'TMPDIR',
    ]);
    expect(JSON.stringify(call)).not.toContain('admin-secret');
    expect(JSON.stringify(call)).not.toContain('preview-secret');
  }

  expect(evidence).toMatchObject({
    artifact: {
      releaseNumber: 1,
      artifactFingerprint: fingerprint,
      batchCount: 67,
    },
    reconciliation: {
      runId,
      invocations: 1,
      isReady: true,
      pendingCount: 0,
      failedCount: 0,
      stepCount: 9,
      work,
    },
    active: activation,
  });
  expect(await readReleaseEvidence(run.artifactDirectory)).toEqual(evidence);
  const comment = await readFile(
    join(run.artifactDirectory, 'release-qualification.md'),
    'utf8',
  );
  expect(comment).toBe(formatReleaseComment(evidence));
  for (const text of [
    `Run \`${runId}\`: ready after 1 invocation,`,
    `artifact fingerprint \`${fingerprint}\``,
    '| E2E catalog-release-reconciled | ready | Catalog Entry `k57abcd1234efgh5678catalogentry`, `key:pf1-content/xgRstzkd1nDznrjH` |',
    // The browsers run after this; the runner adds their result.
    '**Result.** Pending: the runner records the browser journeys’ outcome after they run.',
    'Skill Focus (Acrobatics) (`pf1-content/xgRstzkd1nDznrjH`): +3 on Acrobatics checks below 10 ranks',
  ])
    expect(comment).toContain(text);
  expect(summarizeReleaseEvidence(evidence)).toBe(
    `E2E release qualification: Catalog Release 1 (artifact ${fingerprint}) prepared, reconciled to readiness in run ${runId} (0 pending, 0 failed, 9 steps) and active fixture-only with calculation ${calculation}.\n`,
  );
  for (const text of [comment, JSON.stringify(evidence)]) {
    expect(text).not.toContain('admin-secret');
    expect(text).not.toContain('preview-secret');
  }
});

it('resumes reconciliation that stopped at its step limit, and fails one that is not ready', async () => {
  const resumed = stubs({
    reconcile: [
      {
        ...reconciled('limit', false),
        stepCount: 100,
        staleCompletionCount: 2,
      },
      { ...reconciled('ready'), stepCount: 9, staleCompletionCount: 1 },
    ],
  });
  // Each invocation reports only its own work; the evidence counts both.
  await expect(qualifyRelease(resumed.overrides)).resolves.toMatchObject({
    reconciliation: {
      invocations: 2,
      stepCount: 109,
      staleCompletionCount: 3,
    },
  });
  for (const stopped of ['failed', 'pending']) {
    const failing = stubs({ reconcile: [reconciled(stopped, false)] });
    const error = await qualifyRelease(failing.overrides).catch(
      (e: unknown) => e,
    );
    expect(failureReport(error)).toEqual([
      'catalog release reconcile: not ready',
    ]);
    expect(failing.calls.map(({ stage }) => stage)).not.toContain(
      'catalog release activate',
    );
    expect(existsSync(keyPath())).toBe(false);
  }
});

it('fails when the active release is not the reconciled artifact, and still deletes the key', async () => {
  for (const active of [
    { ...activation, artifactFingerprint: 'b'.repeat(64) },
    { ...activation, impactRunId: 'k57other' },
    { ...activation, releaseNumber: 2 },
  ]) {
    const { overrides } = stubs({ active });
    const error = await qualifyRelease(overrides).catch((e: unknown) => e);
    expect(failureReport(error)).toEqual(['catalog release active: mismatch']);
    expect(existsSync(keyPath())).toBe(false);
  }
  const { overrides } = stubs({ active: null });
  await expect(qualifyRelease(overrides)).rejects.toThrow();
  expect(existsSync(keyPath())).toBe(false);
});

it('fails closed when the exchange fails: no key file and no remote command', async () => {
  const { overrides, calls } = stubs({
    exchange: () => Promise.reject(new Error(`exchange failed ${previewKey}`)),
  });
  await expect(qualifyRelease(overrides)).rejects.toThrow();
  expect(calls.map(({ stage }) => stage)).toEqual([
    'catalog pin',
    'catalog release build',
  ]);
  expect(existsSync(keyPath())).toBe(false);
});

it('passes a regional bound preview URL to the operator as it is', async () => {
  const regional = 'https://quiet-otter-123.eu-west-1.convex.cloud';
  const { overrides, calls } = stubs({
    exchange: () =>
      Promise.resolve({
        deploymentName: 'quiet-otter-123',
        deploymentUrl: regional,
        adminKey,
      }),
  });
  await qualifyRelease(overrides);
  const operated = calls.filter(({ stage }) =>
    ['prepare', 'reconcile', 'activate', 'active'].some(
      (step) => stage === `catalog release ${step}`,
    ),
  );
  expect(operated).toHaveLength(4);
  for (const { args } of operated)
    expect(args.slice(-8, -4)).toEqual([
      '--deployment-name',
      'quiet-otter-123',
      '--deployment-url',
      regional,
    ]);
  expect(existsSync(keyPath())).toBe(false);
});

it('fails unless the seeded Character holding the feat was reconciled for it', async () => {
  for (const releaseWork of [
    [],
    [{ ...work[1], state: 'failed' }],
    [{ ...work[1], reasons: ['calculation'] }],
  ]) {
    const { overrides } = stubs({ releaseWork });
    const error = await qualifyRelease(overrides).catch((e: unknown) => e);
    expect(failureReport(error)).toEqual([
      'Catalog Release qualification failed: the seeded Character holding the admitted feat was not reconciled',
      'catalog release evidence: harness error',
    ]);
  }
});

it('runs only in a release-mode run, on a pinned calculator', async () => {
  for (const suite of [suites.mandatory, suites.nightly]) {
    run = { ...run, suite };
    const { overrides, calls, fixtureCalls } = stubs();
    const error = await qualifyRelease(overrides).catch((e: unknown) => e);
    expect(failureReport(error)).toEqual([
      'Catalog Release qualification failed: it runs only in a release-mode run on a bound preview',
      'catalog release initialization: harness error',
    ]);
    expect([...calls, ...fixtureCalls]).toEqual([]);
  }
  run = { ...run, suite: suites.release };
  const { overrides, calls } = stubs();
  const { command } = overrides;
  if (!command) throw new Error('Missing command stub');
  const error = await qualifyRelease({
    ...overrides,
    command: (stage, args, options) =>
      stage === 'catalog pin'
        ? Promise.resolve(`sha256:${'0'.repeat(64)}\n`)
        : command(stage, args, options),
  }).catch((e: unknown) => e);
  expect(failureReport(error)).toEqual([
    'Catalog Release qualification failed: the calculation identity is not the pinned one',
    'catalog release pin: harness error',
  ]);
  expect(calls).toEqual([]);
});

it('records the browser journeys’ actual outcome in the comment, and counts invocations in words', async () => {
  const { overrides } = stubs({
    reconcile: [reconciled('limit', false), reconciled('ready')],
  });
  const evidence = await qualifyRelease(overrides);
  expect(formatReleaseComment(evidence)).toContain(
    'ready after 2 invocations,',
  );
  const test = (
    title: string,
    results: { status: string; retry: number }[],
  ) => ({
    file: 'x.spec.ts',
    project: 'p',
    title,
    results,
  });
  const passed = { status: 'passed', retry: 0 };
  expect(
    describeBrowserOutcome({
      status: 'passed',
      tests: [test('a', [passed]), test('b', [passed])],
    }),
  ).toBe(
    '**Result.** Both browser journeys passed on the first attempt (no retries): Acrobatics went from +0 to +3 on both sessions.',
  );
  for (const report of [
    null,
    {
      status: 'failed',
      tests: [test('a', [passed]), test('b', [{ status: 'failed', retry: 0 }])],
    },
    {
      status: 'passed',
      tests: [
        test('a', [passed]),
        test('b', [
          { status: 'failed', retry: 0 },
          { status: 'passed', retry: 1 },
        ]),
      ],
    },
  ])
    expect(describeBrowserOutcome(report)).toBe(
      '**Result.** The browser journeys did not all pass on their first attempt; see report.json in the safe evidence.',
    );
  expect(
    formatReleaseComment(evidence, describeBrowserOutcome(null)),
  ).toContain('did not all pass on their first attempt');
});

// #753: an operator step's failure is diagnosed from the step and its exit
// status, never from what it printed.
it.each(['build', 'prepare', 'reconcile', 'activate', 'active'])(
  'a failing %s step gives its fixed diagnostic, by exit status or signal',
  async (step) => {
    for (const [exitCode, text] of [
      [3, 'refused or failed (exit 3)'],
      [null, 'terminated'],
    ] as const) {
      // As in a run, the step's own `command` created the evidence directory.
      await mkdir(run.artifactDirectory, { recursive: true });
      const { overrides } = stubs();
      const { command } = overrides;
      if (!command) throw new Error('Missing command stub');
      const error = await qualifyRelease({
        ...overrides,
        command: (stage, args, options) =>
          stage === `catalog release ${step}`
            ? Promise.reject(new CommandFailure(stage, exitCode))
            : command(stage, args, options),
      }).catch((e: unknown) => e);
      const line = `catalog release ${step}: ${text}`;
      expect(failureReport(error)).toEqual([line]);
      expect(
        await readFile(join(run.artifactDirectory, 'diagnostics.log'), 'utf8'),
      ).toContain(`${line}\n`);
      expect(existsSync(keyPath())).toBe(false);
      await rm(run.artifactDirectory, { recursive: true, force: true });
    }
  },
);

it('a passing run, and the journey’s own title, give no operator diagnostic', async () => {
  const { overrides } = stubs();
  await qualifyRelease(overrides);
  expect(existsSync(join(run.artifactDirectory, 'diagnostics.log'))).toBe(
    false,
  );
  expect(
    safeDiagnostic(
      `passed: release-qualification: ${releaseJourney[1]} (attempt 1, worker-0)`,
    ),
  ).toBeNull();
});

// Whatever ends a step, including its output, records one fixed line.
async function failStep(
  step: string,
  failure: (stage: string) => Promise<string>,
) {
  await mkdir(run.artifactDirectory, { recursive: true });
  const { overrides } = stubs();
  const { command } = overrides;
  if (!command) throw new Error('Missing command stub');
  const error = await qualifyRelease({
    ...overrides,
    command: (stage, args, options) =>
      stage === `catalog release ${step}`
        ? failure(stage)
        : command(stage, args, options),
  }).catch((e: unknown) => e);
  const log = await readFile(
    join(run.artifactDirectory, 'diagnostics.log'),
    'utf8',
  );
  await rm(run.artifactDirectory, { recursive: true, force: true });
  expect(existsSync(keyPath())).toBe(false);
  return { report: failureReport(error), log };
}

it.each([
  ['prepare', 'not json {'],
  ['build', 'null'],
  ['reconcile', JSON.stringify({ runId: 'k57', stopped: 'ready' })],
  ['active', JSON.stringify({ ...activation, isFixtureOnly: false })],
])(
  'an exit-0 %s step whose output is malformed or invalid is diagnosed as invalid output',
  async (step, output) => {
    const line = `catalog release ${step}: invalid output`;
    expect(await failStep(step, () => Promise.resolve(output))).toEqual({
      report: [line],
      log: `${line}\n`,
    });
  },
);

it('a step the harness itself fails on is diagnosed as a harness error, keeping a fixed harness failure', async () => {
  const line = (step: string) => `catalog release ${step}: harness error`;
  expect(
    await failStep('reconcile', (stage) =>
      Promise.reject(new CommandEvidenceFailure(stage, new Error('disk'))),
    ),
  ).toEqual({ report: [line('reconcile')], log: `${line('reconcile')}\n` });
  expect(
    await failStep('prepare', (stage) =>
      Promise.reject(new CommandFailure(stage, null, 'ENOENT')),
    ),
  ).toEqual({ report: [line('prepare')], log: `${line('prepare')}\n` });
  // The harness's own fixed failure stays the one reported.
  expect(
    await failStep('activate', () =>
      Promise.reject(new HarnessFailure({ kind: 'process-group' })),
    ),
  ).toEqual({
    report: ['E2E child processes survived SIGKILL', line('activate')],
    log: `${line('activate')}\n`,
  });
});

it('the reported failure carries the step diagnostic even when diagnostics.log cannot be written', async () => {
  const { overrides } = stubs({
    reconcile: [reconciled('failed', false)],
  });
  const { command } = overrides;
  if (!command) throw new Error('Missing command stub');
  for (const [failure, report] of [
    [
      (_stage: string) =>
        Promise.reject(new HarnessFailure({ kind: 'process-group' })),
      [
        'E2E child processes survived SIGKILL',
        'catalog release prepare: harness error',
      ],
    ],
    [
      (stage: string) => Promise.reject(new CommandFailure(stage, 2)),
      ['catalog release prepare: refused or failed (exit 2)'],
    ],
  ] as const) {
    const error = await qualifyRelease({
      ...overrides,
      appendDiagnostic: () => Promise.reject(new Error('read-only')),
      command: (stage, args, options) =>
        stage === 'catalog release prepare'
          ? failure(stage)
          : command(stage, args, options),
    }).catch((e: unknown) => e);
    expect(failureReport(error)).toEqual(report);
  }
  // A schema-valid but wrong result, the same way.
  const error = await qualifyRelease({
    ...overrides,
    appendDiagnostic: () => Promise.reject(new Error('read-only')),
  }).catch((e: unknown) => e);
  expect(failureReport(error)).toEqual([
    'catalog release reconcile: not ready',
  ]);
});

it('a build of another release number is a build mismatch', async () => {
  const { overrides } = stubs();
  const { command } = overrides;
  if (!command) throw new Error('Missing command stub');
  await mkdir(run.artifactDirectory, { recursive: true });
  const error = await qualifyRelease({
    ...overrides,
    command: (stage, args, options) =>
      stage === 'catalog release build'
        ? Promise.resolve(
            JSON.stringify({
              manifest: { releaseNumber: 2, artifactFingerprint: fingerprint },
            }),
          )
        : command(stage, args, options),
  }).catch((e: unknown) => e);
  expect(failureReport(error)).toEqual(['catalog release build: mismatch']);
  expect(
    await readFile(join(run.artifactDirectory, 'diagnostics.log'), 'utf8'),
  ).toBe('catalog release build: mismatch\n');
});

// #753: one outer boundary names the phase of anything no step diagnosed.
it.each([
  ['case', { fixtureCall: () => Promise.reject(new Error('reset')) }],
  [
    'source',
    { materializeReleaseSources: () => Promise.reject(new Error('copy')) },
  ],
  ['epoch', { readWriteEpoch: () => Promise.reject(new Error('epoch')) }],
  [
    'credential',
    { authorizePreview: () => Promise.reject(new Error('exchange')) },
  ],
] as const)(
  'a failure in the %s phase is recorded as its harness error',
  async (phase, injected) => {
    await mkdir(run.artifactDirectory, { recursive: true });
    const { overrides } = stubs();
    const error = await qualifyRelease({ ...overrides, ...injected }).catch(
      (e: unknown) => e,
    );
    const line = `catalog release ${phase}: harness error`;
    expect(failureReport(error)).toEqual([line]);
    expect(
      await readFile(join(run.artifactDirectory, 'diagnostics.log'), 'utf8'),
    ).toBe(`${line}\n`);
    expect(existsSync(keyPath())).toBe(false);
  },
);

it('pin and evidence failures are recorded as their phase, keeping a fixed reason', async () => {
  const { overrides } = stubs();
  const { command, fixtureCall } = overrides;
  if (!command || !fixtureCall) throw new Error('Missing stubs');
  const cases = [
    [
      {
        command: (stage: string, args: string[], options: never) =>
          stage === 'catalog pin'
            ? Promise.reject(new CommandFailure(stage, 1))
            : command(stage, args, options),
      },
      ['catalog release pin: harness error'],
    ],
    [
      {
        command: (stage: string, args: string[], options: never) =>
          stage === 'catalog pin'
            ? Promise.resolve(`sha256:${'0'.repeat(64)}\n`)
            : command(stage, args, options),
      },
      [
        'Catalog Release qualification failed: the calculation identity is not the pinned one',
        'catalog release pin: harness error',
      ],
    ],
    [
      {
        fixtureCall: (
          ...args: Parameters<typeof fixtureCall>
        ): Promise<unknown> =>
          args[1] === 'inspectCase'
            ? Promise.reject(new Error('inspect'))
            : fixtureCall(...args),
      },
      ['catalog release evidence: harness error'],
    ],
    [
      { savePrivate: () => Promise.reject(new Error('disk full')) },
      ['catalog release evidence: harness error'],
    ],
  ] as const;
  for (const [injected, report] of cases) {
    const fresh = stubs().overrides;
    const error = await qualifyRelease({
      ...fresh,
      ...(injected as Partial<ReleaseQualificationDependencies>),
    }).catch((e: unknown) => e);
    expect(failureReport(error)).toEqual(report);
  }
});

it('a key cleanup failure never replaces an earlier failure, and is the failure when there is none', async () => {
  const { overrides } = stubs();
  const { command } = overrides;
  if (!command) throw new Error('Missing command stub');
  const leftover = () =>
    Promise.reject(new HarnessFailure({ kind: 'admin-key-leftover' }));
  const earlier = await qualifyRelease({
    ...overrides,
    removeAdminKeyFile: leftover,
    command: (stage, args, options) =>
      stage === 'catalog release prepare'
        ? Promise.reject(new CommandFailure(stage, 2))
        : command(stage, args, options),
  }).catch((e: unknown) => e);
  expect(failureReport(earlier)).toEqual([
    'catalog release prepare: refused or failed (exit 2)',
    'catalog release key cleanup: harness error',
  ]);
  // The stubbed cleanup left the first run's key file; a real run's runner
  // removes it at cleanup.
  await rm(keyPath(), { force: true });
  const alone = await qualifyRelease({
    ...stubs().overrides,
    removeAdminKeyFile: leftover,
  }).catch((e: unknown) => e);
  expect(failureReport(alone)).toEqual([
    'E2E preview admin key file could not be removed; delete the run directory by hand before anything else',
    'catalog release key cleanup: harness error',
  ]);
});

it('an unreadable or malformed run file is an initialization failure, named on the thrown failure', async () => {
  const unreadable = Object.assign(new Error('no run file'), {
    code: 'ENOENT',
  });
  for (const loadRun of [
    () => Promise.reject(unreadable),
    () => Promise.reject(new SyntaxError('Unexpected token')),
    () => Promise.reject(new z.ZodError([])),
  ]) {
    const { overrides, calls, fixtureCalls } = stubs();
    const error = await qualifyRelease({ ...overrides, loadRun }).catch(
      (e: unknown) => e,
    );
    expect(failureReport(error)).toEqual([
      'catalog release initialization: harness error',
    ]);
    expect([...calls, ...fixtureCalls]).toEqual([]);
    // No run, so no evidence directory to write to.
    expect(existsSync(run.artifactDirectory)).toBe(false);
  }
});
