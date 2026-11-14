// @vitest-environment node
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
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
import type { LocalBackend } from '../scripts/local-convex/backend';
import {
  developmentDependencies,
  type DeployedStage,
  type DevelopmentDependencies,
  type RunService,
} from '../scripts/local-convex/development';
import {
  assertTrialInstance,
  describeTrialExit,
  discardOwnerTrial,
  parseTrialArguments,
  prepareOwnerTrial,
  runOwnerTrial,
  TrialRefusal,
  trialInstance,
  type TrialDependencies,
} from '../scripts/local-convex/owner-trial';

const calculation = `sha256:${'a'.repeat(64)}`;
let root: string;
let output: string[];
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'owner-trial-'));
  output = [];
  vi.spyOn(process.stdout, 'write').mockImplementation((text) => {
    output.push(String(text));
    return true;
  });
});
afterEach(async () => {
  vi.restoreAllMocks();
  await rm(root, { recursive: true, force: true });
});

it('derives a trial-only instance beside pnpm dev’s, in its own ignored directory', () => {
  expect(trialInstance('/repo')).toMatchObject({
    name: 'ep-dev-4a5243998b93',
    directory: '/repo/.local-convex/owner-trial',
  });
  // pnpm dev's instance for the same checkout.
  expect(() =>
    assertTrialInstance('/repo', {
      name: 'ep-dev-816fc349d3fa',
      directory: '/repo/.local-convex/owner-trial',
      description: '',
    }),
  ).toThrow("The trial instance must not be pnpm dev's instance");
  expect(() =>
    assertTrialInstance('/repo', {
      name: 'ep-dev-4a5243998b93',
      directory: '/repo/.local-convex',
      description: '',
    }),
  ).toThrow("The trial instance must not be pnpm dev's instance");
  expect(() =>
    assertTrialInstance('/repo', {
      name: 'happy-otter-123',
      directory: '/repo/.local-convex/owner-trial',
      description: '',
    }),
  ).toThrow('Invalid local Convex instance name');
});

it('takes no deployment flags: only --discard', () => {
  expect(parseTrialArguments([])).toEqual({ discard: false });
  expect(parseTrialArguments(['--discard'])).toEqual({ discard: true });
  for (const args of [
    ['--deployment-name', 'happy-otter-123'],
    ['--deployment-url', 'https://happy-otter-123.convex.cloud'],
    ['--target-kind', 'production'],
    ['--production'],
    ['--admin-key-file', 'key'],
    ['discard'],
  ])
    expect(() => parseTrialArguments(args)).toThrow(TrialRefusal);
});

/** A scope report and the artifact it binds, as a scoped build writes them. */
const scopeReport = (fingerprint?: string) => ({
  binding: {},
  qualification: {
    status: 'FAILED',
    counts: {},
    exceptions: [],
    findings: [],
    characters: [
      {
        id: '1',
        served: false,
        unreleased: 0,
        failing: [
          { cause: 'held', key: 'pf1/a', name: 'A' },
          { cause: 'held', key: 'pf1/b', name: 'B' },
          { cause: 'race-open', name: 'race not written' },
        ],
      },
      { id: '3', served: true, unreleased: 0, failing: [] },
    ],
  },
  release: fingerprint ? { artifactFingerprint: fingerprint } : { refused: '' },
  rows: [],
});
const artifact = (fingerprint: string, calculationIdentity = calculation) => ({
  manifest: {
    artifactFingerprint: fingerprint,
    compatibility: {
      schema: 'character-sheet-v1',
      calculation: calculationIdentity,
    },
  },
  batches: [],
});

type Build = { artifact?: unknown; report?: unknown; exitCode: number };
const trialBackend = (directory: string): LocalBackend => ({
  name: trialInstance(root).name,
  url: 'http://127.0.0.1:3210',
  siteUrl: 'http://127.0.0.1:3211',
  adminKeyFile: join(directory, 'local-admin.key'),
  envFile: join(directory, 'convex.env'),
  stop: vi.fn(async () => undefined),
});

/** The trial's own dependencies, each call recorded in `events`. */
function trialHarness({
  build = {
    artifact: artifact('F'),
    report: scopeReport('F'),
    exitCode: 1,
  } as Build,
  reconcile = ['ready'],
  events = [] as string[],
} = {}) {
  const releaseCalls: string[][] = [];
  const reconciled = [...reconcile];
  const use: TrialDependencies = {
    development: developmentDependencies,
    readCalculation: vi.fn(async () => {
      events.push('pin');
      return `${calculation}\n`;
    }),
    checkouts: () => ({
      system: '/sources/pf1',
      content: '/sources/pf1-content',
      pcgen: '/cache/pcgen',
    }),
    releaseOperator: vi.fn(async (args: string[]) => {
      events.push(args[0] ?? '');
      releaseCalls.push(args);
      if (args[0] === 'allocate') return { stopped: 'complete' };
      if (args[0] === 'reconcile')
        return { runId: 'impact-run', stopped: reconciled.shift() };
      return {};
    }),
    cutover: vi.fn(async ({ release, buildIdentity }) => {
      events.push('cutover');
      const prepared = await release.prepare(0);
      await buildIdentity();
      events.push(`activate ${prepared.impactRunId}`);
      return 'reopened' as const;
    }),
    docker: vi.fn(),
  };
  const runs: { args: string[]; env: NodeJS.ProcessEnv }[] = [];
  const run: RunService = async ({ args, env }) => {
    runs.push({ args, env });
    events.push(args.includes('build') ? 'build' : args.join(' '));
    if (!args.includes('build')) return 0;
    const path = args[args.indexOf('--artifact') + 1] ?? '';
    await mkdir(join(path, '..'), { recursive: true });
    if (build.artifact) await writeFile(path, JSON.stringify(build.artifact));
    if (build.report)
      await writeFile(
        path.replace(/\.json$/, '.scope.json'),
        JSON.stringify(build.report),
      );
    return build.exitCode;
  };
  return { use, run, runs, releaseCalls, events };
}

const stageFor = (run: RunService, backend?: Partial<LocalBackend>) => {
  const directory = trialInstance(root).directory;
  return {
    backend: { ...trialBackend(directory), ...backend },
    directory,
    environment: {
      ...process.env,
      CONVEX_DEPLOY_KEY: 'prod:happy-otter-123|secret',
    },
    run,
  } satisfies DeployedStage;
};

it('accepts the party build’s artifact when the scope is FAILED, prints the characters by number, and prepares, allocates and reconciles it on the trial instance', async () => {
  const trial = trialHarness();
  const stage = stageFor(trial.run);
  await mkdir(stage.directory, { recursive: true });
  await prepareOwnerTrial({ root, stage, use: trial.use });
  expect(trial.events).toEqual([
    'cutover',
    'pin',
    'build',
    'prepare',
    'allocate',
    'reconcile',
    'exec node --import tsx scripts/write-build-identity.ts',
    'activate impact-run',
  ]);
  const build = trial.runs[0]?.args ?? [];
  expect(build.slice(0, 3)).toEqual(['-s', 'catalog:release', 'build']);
  expect(build).toEqual(
    expect.arrayContaining(['--scope', 'campaign-party-v1', '--pcgen']),
  );
  expect(build[build.indexOf('--calculation') + 1]).toBe(calculation);
  expect(build).not.toContain('--allow-unverified-checkouts');
  for (const { env } of trial.runs) {
    expect(env.CONVEX_DEPLOY_KEY).toBe('');
    expect(env).not.toHaveProperty('COMMIT_REF');
  }
  for (const args of trial.releaseCalls) {
    expect(args).not.toContain('--production');
    expect(args[args.indexOf('--target-kind') + 1]).toBe('local');
    expect(args[args.indexOf('--deployment-name') + 1]).toBe(
      trialInstance(root).name,
    );
    expect(args[args.indexOf('--deployment-url') + 1]).toBe(
      'http://127.0.0.1:3210',
    );
  }
  const characters = [
    'Party scope FAILED; the trial uses the artifact it wrote.',
    'Character 1: partial (2 held for review, 1 race not decided)',
    'Character 3: complete',
  ].join('\n');
  expect(output.join('')).toContain(characters);
  expect(await readFile(join(stage.directory, 'characters.txt'), 'utf8')).toBe(
    `${characters}\n`,
  );
  expect(
    JSON.parse(
      await readFile(join(stage.directory, 'trial-release.json'), 'utf8'),
    ),
  ).toEqual({
    releaseNumber: 1,
    impactRunId: 'impact-run',
    schema: 'character-sheet-v1',
    calculation,
  });
});

it.each([
  { case: 'no artifact', build: { report: scopeReport(), exitCode: 1 } },
  {
    case: 'an artifact the report does not bind',
    build: { artifact: artifact('F'), report: scopeReport('G'), exitCode: 1 },
  },
  { case: 'no report', build: { artifact: artifact('F'), exitCode: 1 } },
])(
  'refuses a build that leaves $case, and prepares nothing',
  async ({ build }) => {
    const trial = trialHarness({ build });
    const stage = stageFor(trial.run);
    await expect(
      prepareOwnerTrial({ root, stage, use: trial.use }),
    ).rejects.toThrow('The party build wrote no artifact (exit 1)');
    expect(trial.releaseCalls).toEqual([]);
  },
);

it('reuses an artifact an earlier run accepted, and refuses one built for another calculation', async () => {
  const trial = trialHarness();
  const stage = stageFor(trial.run);
  const release = join(stage.directory, 'release');
  await mkdir(release, { recursive: true });
  await writeFile(
    join(release, 'release-1.scope.json'),
    JSON.stringify(scopeReport('F')),
  );
  await writeFile(
    join(release, 'release-1.json'),
    JSON.stringify(artifact('F')),
  );
  await prepareOwnerTrial({ root, stage, use: trial.use });
  expect(trial.events).not.toContain('build');
  await writeFile(
    join(release, 'release-1.json'),
    JSON.stringify(artifact('F', `sha256:${'b'.repeat(64)}`)),
  );
  await expect(
    prepareOwnerTrial({ root, stage, use: trialHarness().use }),
  ).rejects.toThrow('pnpm dev:trial --discard');
});

it('reconciles again after its step budget, and refuses a reconciliation that fails', async () => {
  const resumed = trialHarness({ reconcile: ['limit', 'ready'] });
  await prepareOwnerTrial({
    root,
    stage: stageFor(resumed.run),
    use: resumed.use,
  });
  expect(resumed.events.filter((event) => event === 'reconcile')).toHaveLength(
    2,
  );
  const failed = trialHarness({ reconcile: ['failed'] });
  await expect(
    prepareOwnerTrial({ root, stage: stageFor(failed.run), use: failed.use }),
  ).rejects.toThrow('Reconciliation stopped: failed.');
});

it.each([
  { case: "pnpm dev's backend", backend: { name: 'ep-dev-0123456789ab' } },
  {
    case: 'a backend off loopback',
    backend: { url: 'https://happy-otter-123.convex.cloud' },
  },
])('refuses $case before any step', async ({ backend }) => {
  const trial = trialHarness();
  await expect(
    prepareOwnerTrial({
      root,
      stage: stageFor(trial.run, backend),
      use: trial.use,
    }),
  ).rejects.toThrow('The trial runs only against its own local instance.');
  expect(trial.events).toEqual([]);
});

it('on an instance already open under sheet authority, builds nothing and prints the recorded characters', async () => {
  const trial = trialHarness();
  trial.use.cutover = vi.fn(async () => 'already-open' as const);
  const stage = stageFor(trial.run);
  await mkdir(stage.directory, { recursive: true });
  await writeFile(
    join(stage.directory, 'characters.txt'),
    'Character 3: complete\n',
  );
  await prepareOwnerTrial({ root, stage, use: trial.use });
  expect(trial.events).toEqual([]);
  expect(output.join('')).toContain(
    'The trial instance is already open under sheet authority.\nCharacter 3: complete\n',
  );
});

it('pnpm dev:trial starts its own backend, deploys, prepares and cuts over, then syncs identities and serves, with CONVEX_* blanked', async () => {
  const events: string[] = [];
  const trial = trialHarness({ events });
  const envs: NodeJS.ProcessEnv[] = [];
  const stop = vi.fn(async () => undefined);
  trial.use.development = {
    startLocalBackend: vi.fn<DevelopmentDependencies['startLocalBackend']>(
      async ({ directory, developmentName }) => {
        events.push(`backend ${developmentName} ${directory}`);
        return { ...trialBackend(directory), stop };
      },
    ),
    syncLocalIdentities: vi.fn(async () => {
      events.push('sync');
      return 1;
    }),
    runFunction: vi.fn(),
    spawnPnpm: ({ args, options }) => {
      events.push(args.slice(0, 4).join(' '));
      envs.push(options.env ?? process.env);
      // The web server ends the serve; the build exits 1 like a FAILED scope.
      const exit = args[0] === 'dev:web' ? 1 : 0;
      const script =
        args.join(' ') ===
        `exec convex dev --env-file ${join(trialInstance(root).directory, 'convex.env')}`
          ? 'process.on("SIGTERM", () => process.exit(143)); setInterval(() => {}, 1000);'
          : `process.exit(${exit})`;
      if (args.includes('build')) {
        const path = args[args.indexOf('--artifact') + 1] ?? '';
        mkdirSync(join(path, '..'), { recursive: true });
        writeFileSync(path, JSON.stringify(artifact('F')));
        writeFileSync(
          path.replace(/\.json$/, '.scope.json'),
          JSON.stringify(scopeReport('F')),
        );
      }
      return spawn(process.execPath, ['-e', script], {
        ...options,
        cwd: root,
        stdio: 'ignore',
      });
    },
  };
  await expect(
    runOwnerTrial({
      root,
      environment: { ...process.env, CONVEX_DEPLOYMENT: 'dev:happy-otter-123' },
      secretKey: 'sk_test_fixture',
      clerkHost: 'fixture.clerk.accounts.dev',
      signal: new AbortController().signal,
      use: trial.use,
    }),
  ).rejects.toThrow('dev:web failed (1)');
  const { name, directory } = trialInstance(root);
  expect(events).toEqual([
    `backend ${name} ${directory}`,
    'exec convex env set',
    'exec convex dev --once',
    'cutover',
    'pin',
    '-s catalog:release build --number',
    'prepare',
    'allocate',
    'reconcile',
    'exec node --import tsx',
    'activate impact-run',
    'sync',
    'exec convex dev --env-file',
    'dev:web',
  ]);
  for (const env of envs) expect(env.CONVEX_DEPLOYMENT).toBe('');
  expect(stop).toHaveBeenCalledOnce();
  expect(
    JSON.parse(await readFile(join(directory, 'convex.json'), 'utf8')),
  ).toEqual({ functions: '../../convex/' });
});

it('pnpm dev:trial --discard removes only the trial container, its volume and directory', async () => {
  const { name, directory } = trialInstance(root);
  for (const other of [
    'ep-dev-0123456789ab',
    'ep-e2e-11111111-1111-1111-1111-111111111111',
  ]) {
    const docker = vi.fn();
    await expect(
      discardOwnerTrial({ root, name: other, use: { docker } }),
    ).rejects.toThrow(`Only the trial instance (${name}) is discarded.`);
    expect(docker).not.toHaveBeenCalled();
  }
  await mkdir(directory, { recursive: true });
  const calls: string[][] = [];
  const docker = vi.fn(async (args: string[]) => {
    calls.push(args);
    return args[0] === 'ps' ? 'container-1' : args[0] === 'inspect' ? name : '';
  });
  await discardOwnerTrial({ root, name, use: { docker } });
  expect(calls).toEqual([
    ['ps', '-aq', '--filter', `name=^/${name}$`],
    [
      'inspect',
      '--format',
      '{{index .Config.Labels "dev.everythingpath.local-convex"}}',
      'container-1',
    ],
    ['rm', '--force', 'container-1'],
    ['volume', 'rm', '--force', `${name}-data`],
  ]);
  await expect(stat(directory)).rejects.toThrow('ENOENT');
});

it('discard leaves a container of the trial’s name that is not the trial’s', async () => {
  const { name } = trialInstance(root);
  const docker = vi.fn(async (args: string[]) =>
    args[0] === 'ps' ? 'container-1' : 'someone-else',
  );
  await expect(
    discardOwnerTrial({ root, name, use: { docker } }),
  ).rejects.toMatchObject({ diagnostic: { reason: 'ownership' } });
  expect(docker).toHaveBeenCalledTimes(2);
});

it('prints the trial’s own refusal, and only fixed text for any other failure', () => {
  expect(
    describeTrialExit({
      error: new TrialRefusal('The party build wrote no artifact (exit 1).'),
      isStopped: false,
    }),
  ).toEqual({
    lines: ['The party build wrote no artifact (exit 1).'],
    exitCode: 1,
  });
  expect(
    describeTrialExit({
      error: new Error('sk_test_SECRET in a provider payload'),
      isStopped: false,
    }).lines.join('\n'),
  ).not.toContain('SECRET');
});
