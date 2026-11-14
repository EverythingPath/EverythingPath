// Test-only entry point: runs the real runner and its real error path in a
// child process with one injected failure, so tests read the actual stdout
// and stderr. Usage: runner-probe.ts <scenario> <root> [prefix index].
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  command,
  CommandEvidenceFailure,
  CommandFailure,
  savePrivate,
  type Run,
} from '../process';
import { HarnessFailure } from '../diagnostics';
import { runAndReport, type RunnerDependencies } from '../runner';
import { slotLockPath, type SetupStage } from '../setup-failure';
import { resources } from '../test-data';
import { trustedPrefixes } from './trusted-prefixes';

export const probeSecret = 'sk_test_PROBESECRET';
const [scenario = '', root = '', prefixArgument = '0'] = process.argv.slice(2);
const privateRoot = join(root, 'e2e', '.private');
const lockPath = slotLockPath(privateRoot, resources.previewName);

const prefix = trustedPrefixes[Number(prefixArgument)];
// A message that starts exactly with the trusted prefix.
if (prefix === undefined) throw new Error('unknown prefix index');
function hostile() {
  const error = new Error(
    `${prefix} https://x.test/?token=${probeSecret} \u001b[2J${root}`,
    { cause: new Error(probeSecret) },
  );
  error.name = probeSecret;
  error.stack = probeSecret;
  return error;
}

const targets = {
  resources,
  publishableKey: 'pk_test_probe',
  secretKey: probeSecret,
  previewKey: `preview:test-team:test-project|${probeSecret}`,
};
const passing: Partial<RunnerDependencies> = {
  cwd: () => root,
  loadTargets: () => Promise.resolve(targets),
  cohortWorkers: () => 1,
  verifyClerkCohorts: () => Promise.resolve(),
  sourceFingerprint: () => 'fingerprint',
  copyBuildWorkspace: () => Promise.resolve(),
  availablePort: () => Promise.resolve(4321),
  command: () => Promise.resolve(''),
  checkGeneratedBindings: () => Promise.resolve(),
  loadRun: () =>
    Promise.resolve({
      fixture: { convexUrl: 'https://probe.convex.cloud' },
    } as unknown as Run),
};
const createDirectory = (path: string, mode?: number) =>
  mkdir(path, { recursive: true, mode });

const failAt: Record<
  Exclude<SetupStage, 'arguments'>,
  () => Partial<RunnerDependencies>
> = {
  resources: () => ({ loadTargets: () => Promise.reject(hostile()) }),
  workers: () => ({
    cohortWorkers: () => {
      throw hostile();
    },
  }),
  'clerk-verification': () => ({
    verifyClerkCohorts: () => Promise.reject(hostile()),
  }),
  // `--backend local` only (below).
  'local-backend': () => ({
    checkLocalBackendHost: () => Promise.reject(hostile()),
  }),
  'source-root': () => ({
    cwd: () => {
      throw hostile();
    },
  }),
  'private-directory': () => ({
    createDirectory: (path, mode) =>
      path === privateRoot
        ? Promise.reject(hostile())
        : createDirectory(path, mode),
  }),
  'slot-lock': () => ({ acquireSlotLock: () => Promise.reject(hostile()) }),
  'temporary-directory': () => ({
    createTemporaryDirectory: () => Promise.reject(hostile()),
  }),
  'prepared-environment': () => ({
    pathExists: (path) => {
      if (path.includes('e2e-prepared')) throw hostile();
      return existsSync(path);
    },
  }),
  'source-snapshot': () => ({
    copyBuildWorkspace: () => Promise.reject(hostile()),
  }),
  environment: () => ({
    savePrivate: (path, content) =>
      path.endsWith('convex.env')
        ? Promise.reject(hostile())
        : savePrivate(path, content),
  }),
  port: () => ({ availablePort: () => Promise.reject(hostile()) }),
  'run-file': () => ({
    savePrivate: (path, content) =>
      path.endsWith('run.json')
        ? Promise.reject(hostile())
        : savePrivate(path, content),
  }),
  evidence: () => ({
    command: (stage) =>
      Promise.reject(new CommandEvidenceFailure(stage, hostile())),
  }),
  deployment: () => ({
    command: () =>
      Promise.reject(new CommandFailure(`deploy ${probeSecret}`, 1)),
  }),
  'generated-bindings': () => ({
    checkGeneratedBindings: () => Promise.reject(hostile()),
  }),
  'preview-binding': () => ({ loadRun: () => Promise.reject(hostile()) }),
  'artifact-directory': () => ({
    createDirectory: (path, mode) =>
      path.includes('e2e-artifacts')
        ? Promise.reject(hostile())
        : createDirectory(path, mode),
  }),
  // The release suite's stages (`--suite release`).
  'release-qualification': () => ({
    command: (stage) =>
      stage === 'catalog release qualification'
        ? Promise.reject(hostile())
        : Promise.resolve(''),
  }),
  'release-admin-key': () => {
    // Fails before the browsers only; the cleanup's removal then succeeds.
    let calls = 0;
    return {
      removeAdminKeyFile: () =>
        calls++ === 0 ? Promise.reject(hostile()) : Promise.resolve(),
    };
  },
  'release-evidence': () => ({
    readReleaseEvidence: () => Promise.reject(hostile()),
  }),
};
const releaseStages: readonly SetupStage[] = [
  'release-qualification',
  'release-admin-key',
  'release-evidence',
];

async function writeOwner(owner: string) {
  await mkdir(lockPath, { recursive: true });
  await writeFile(
    join(lockPath, 'owner.json'),
    JSON.stringify({ owner, createdAt: '2026-09-30T05:40:40.453Z' }),
  );
}

// A convex CLI stand-in: it breaks stages.log, prints a secret, exits 3.
async function brokenLogCommand(): Promise<Partial<RunnerDependencies>> {
  const cli = join(root, 'cli');
  const packageDirectory = join(cli, 'node_modules', 'convex');
  await mkdir(packageDirectory, { recursive: true });
  await writeFile(
    join(packageDirectory, 'package.json'),
    JSON.stringify({ name: 'convex', bin: 'fixture.cjs' }),
  );
  await writeFile(
    join(packageDirectory, 'fixture.cjs'),
    `const fs = require('node:fs'); const path = require('node:path');
const run = JSON.parse(fs.readFileSync(process.env.E2E_RUN_FILE, 'utf8'));
const log = path.join(run.artifactDirectory, 'stages.log');
fs.rmSync(log, { force: true }); fs.mkdirSync(log);
process.stderr.write(${JSON.stringify(`Error: ${probeSecret}\n`)});
process.exit(3);`,
  );
  return {
    command: (stage, _args, options) =>
      command(stage, ['exec', 'convex', 'run', 'probe'], {
        ...options,
        cwd: cli,
      }),
  };
}

async function generatedBindings(
  sourceName: string,
  workspaceName: string,
): Promise<Partial<RunnerDependencies>> {
  const { checkGeneratedBindings } = await import('../workspace');
  return {
    copyBuildWorkspace: async (sourceRoot, workspace) => {
      for (const [directory, name, content] of [
        [sourceRoot, sourceName, 'source'],
        [workspace, workspaceName, `generated ${probeSecret}`],
      ] as const) {
        await mkdir(join(directory, 'convex', '_generated'), {
          recursive: true,
        });
        await writeFile(join(directory, 'convex', '_generated', name), content);
      }
    },
    checkGeneratedBindings,
  };
}

const hostileFile = `evil\u001b[2J\r${probeSecret}\n.ts`;
const argv = ['--resources', '/probe/resources.json', '--suite', 'nightly'];
let overrides: Partial<RunnerDependencies> = {};
let args = argv;
if (scenario.startsWith('stage:')) {
  const stage = scenario.slice('stage:'.length) as SetupStage;
  if (stage === 'arguments') args = ['--nope', probeSecret];
  else overrides = failAt[stage]();
  if (stage === 'local-backend') args = [...argv, '--backend', 'local'];
  if (releaseStages.includes(stage)) {
    args = ['--resources', '/probe/resources.json', '--suite', 'release'];
    // A release run refuses a temporary directory under /tmp, where the OS
    // default would put it; e2e-branch.sh gives it .ep-tmp/e2e-* instead.
    const allowed = resolve('node_modules', '.cache');
    overrides = {
      createTemporaryDirectory: async () => {
        await mkdir(allowed, { recursive: true });
        return mkdtemp(join(allowed, 'e2e-runner-probe-'));
      },
      ...overrides,
    };
  }
} else if (scenario === 'usage') args = [];
else if (scenario === 'diagnostic')
  overrides = {
    loadTargets: () =>
      Promise.reject(
        new HarnessFailure({
          kind: 'preflight',
          reason: 'Clerk secret key must be a test key',
        }),
      ),
  };
else if (scenario === 'locked') await writeOwner(randomUUID());
else if (scenario === 'crashed-lock') {
  // A crash after the owner record's temporary write, before its rename.
  await mkdir(lockPath, { recursive: true });
  await writeFile(join(lockPath, 'owner.json.tmp-crashed'), '{"owner":"1');
} else if (scenario === 'malformed-lock') {
  // A crash in the middle of writing owner.json itself.
  await mkdir(lockPath, { recursive: true });
  await writeFile(join(lockPath, 'owner.json'), '{"owner":"1');
} else if (scenario === 'post-setup')
  overrides = {
    command: (stage) =>
      stage.includes('browser journeys')
        ? Promise.reject(hostile())
        : Promise.resolve(''),
  };
else if (scenario === 'cleanup')
  overrides = {
    ...failAt.port(),
    // Reported as failed, but the directory still goes: a probe leaves
    // nothing in TMPDIR.
    removeDirectory: async (path) => {
      await rm(path, { recursive: true, force: true });
      throw hostile();
    },
  };
else if (scenario === 'replaced-lock')
  overrides = {
    command: async () => {
      await rm(lockPath, { recursive: true });
      await writeOwner('00000000-0000-4000-8000-000000000000');
      throw new CommandFailure('preview deployment and web build', 1);
    },
  };
else if (scenario === 'released-lock') overrides = {};
else if (scenario === 'git-fingerprint')
  overrides = { sourceFingerprint: undefined };
else if (scenario === 'git-copy') overrides = { copyBuildWorkspace: undefined };
else if (scenario === 'generated-list')
  overrides = await generatedBindings('api.d.ts', hostileFile);
else if (scenario === 'generated-file')
  overrides = await generatedBindings(hostileFile, hostileFile);
else if (scenario === 'log-failure') overrides = await brokenLogCommand();
else throw new Error('unknown probe scenario');

// `undefined` overrides restore the real dependency.
const merged = Object.fromEntries(
  Object.entries({ ...passing, ...overrides }).filter(
    ([, value]) => value !== undefined,
  ),
) as Partial<RunnerDependencies>;
process.exitCode = await runAndReport(args, merged);
// Lets the test read the lock state the runner left behind.
await readFile(join(lockPath, 'owner.json'), 'utf8').then(
  (owner) => process.stdout.write(`PROBE-LOCK ${owner}\n`),
  () => process.stdout.write('PROBE-LOCK none\n'),
);
