// @vitest-environment node
import { createServer, type Server } from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  runLocalTrialCutover,
  type LocalTrialRelease,
} from '../scripts/initial-migration/local-trial';
import type { InitialMigrationStatus } from '../scripts/initial-migration/operator';

const target = {
  name: 'ep-dev-0123456789ab',
  url: 'http://127.0.0.1:3210',
  adminKeyFile: '/trial/local-admin.key',
};
const release: LocalTrialRelease = {
  releaseNumber: 1,
  impactRunId: 'impact-1',
  schema: 'character-sheet-v1',
  calculation: 'sha256:calc',
};
type Run = NonNullable<InitialMigrationStatus['run']>;

const open: InitialMigrationStatus = {
  epoch: 0,
  closed: false,
  authority: 'legacy',
  budgetExceeded: false,
  run: null,
  catchUp: null,
};
const runFields = { runId: 'run-1', epoch: 1, operationId: 'trial-1' };
const activated = (
  publication: boolean,
  smoke: Extract<Run, { state: 'activated' }>['smoke'],
): InitialMigrationStatus => ({
  epoch: 1,
  closed: true,
  authority: 'sheet',
  budgetExceeded: false,
  catchUp: null,
  run: {
    ...runFields,
    state: 'activated',
    activation: { activationId: 'trial-1-activation' },
    publication: { nextPage: 1, published: 0, isDone: publication },
    smoke,
  },
});

type Flag = (name: string) => string;
type Transition = (
  status: InitialMigrationStatus,
  flag: Flag,
) => { status?: InitialMigrationStatus; details?: unknown };
/** A run's next stage, its other records kept. */
const advance = (
  status: InitialMigrationStatus,
  run: Record<string, unknown>,
  change: Partial<InitialMigrationStatus> = {},
) =>
  ({
    ...status,
    ...change,
    run: { ...status.run, ...run },
  }) as InitialMigrationStatus;

/** Each step as `convex/initialMigration.ts` takes it, on a passing deployment. */
const transitions: Record<string, Transition> = {
  start: (status, flag) => ({
    status: {
      ...status,
      epoch: status.epoch + 1,
      closed: true,
      run: {
        runId: `run-${status.epoch + 1}`,
        epoch: status.epoch + 1,
        operationId: flag('--operation-id'),
        state: 'maintenance',
      },
    },
  }),
  abort: (status) => ({
    status: advance(
      status,
      { state: 'aborted' },
      { epoch: status.epoch + 1, closed: false, budgetExceeded: false },
    ),
  }),
  backfill: () => ({ details: { isActivationReady: true } }),
  activate: (status, flag) => ({
    status: advance(
      status,
      {
        state: 'activated',
        activation: { activationId: flag('--activation-id') },
        publication: { nextPage: 0, published: 0, isDone: false },
        smoke: null,
      },
      { authority: 'sheet' },
    ),
  }),
  publish: (status) => ({
    status: advance(status, {
      publication: { nextPage: 1, published: 0, isDone: true },
    }),
  }),
  smoke: (status) => ({
    status: advance(status, {
      smoke: { outcome: 'passed', epoch: status.epoch },
    }),
    details: { outcome: 'passed' },
  }),
  reopen: (status) => ({
    status: advance(
      status,
      { state: 'reopened' },
      { epoch: status.epoch + 1, closed: false },
    ),
  }),
};

/**
 * A deployment the steps move through as `convex/initialMigration.ts` does:
 * each command reads the status, a step advances it.
 */
function deployment(initial: InitialMigrationStatus, smoke = 'passed') {
  let status = structuredClone(initial);
  const calls: string[][] = [];
  const operator = vi.fn(async (args: string[]) => {
    calls.push(args);
    const [step = ''] = args;
    const flag: Flag = (name) => args[args.indexOf(name) + 1] ?? '';
    const failed = step === 'smoke' && smoke !== 'passed';
    const outcome = failed
      ? { details: { outcome: 'failed' } }
      : (transitions[step]?.(status, flag) ?? {});
    status = outcome.status ?? status;
    return {
      step,
      target: 'local',
      did: `did ${step}`,
      next: '',
      details: step === 'status' ? structuredClone(status) : outcome.details,
    };
  });
  return { operator, calls, status: () => status };
}

function cutover(
  initial: InitialMigrationStatus,
  { hasSaved = true, smoke = 'passed' } = {},
) {
  const server = deployment(initial, smoke);
  const prepare = vi.fn(async (writeEpoch: number) => ({
    ...release,
    impactRunId: `impact-at-${writeEpoch}`,
  }));
  const buildIdentity = vi.fn(async () => '/trial/build-identity.json');
  const result = runLocalTrialCutover({
    target,
    buildIdentity,
    release: { prepare, saved: async () => (hasSaved ? release : undefined) },
    operator: server.operator,
    log: () => undefined,
  });
  const steps = () =>
    server.calls.map(([step]) => step).filter((step) => step !== 'status');
  return { ...server, prepare, buildIdentity, result, steps };
}

it('cuts an empty legacy deployment over: prepares the release, then start, backfill, fixture-only activate, publish, smoke and reopen, all against the local target', async () => {
  const trial = cutover(open);
  await expect(trial.result).resolves.toBe('reopened');
  expect(trial.prepare).toHaveBeenCalledExactlyOnceWith(0);
  expect(trial.steps()).toEqual([
    'start',
    'backfill',
    'activate',
    'publish',
    'smoke',
    'reopen',
  ]);
  for (const args of trial.calls) {
    expect(args).not.toContain('--production');
    expect(args.slice(1, 9)).toEqual([
      '--deployment-name',
      target.name,
      '--deployment-url',
      target.url,
      '--target-kind',
      'local',
      '--admin-key-file',
      target.adminKeyFile,
    ]);
  }
  const activate = trial.calls.find(([step]) => step === 'activate') ?? [];
  expect(activate.slice(9)).toEqual([
    '--capture-id',
    'trial-1-capture',
    '--activation-id',
    'trial-1-activation',
    '--number',
    '1',
    '--impact-run-id',
    'impact-at-0',
    '--schema',
    'character-sheet-v1',
    '--calculation',
    'sha256:calc',
    '--build-identity',
    '/trial/build-identity.json',
    '--fixture-only',
  ]);
  expect(trial.status()).toMatchObject({
    authority: 'sheet',
    closed: false,
    run: { state: 'reopened', operationId: 'trial-1' },
  });
});

it.each([
  {
    state: 'maintenance',
    status: {
      ...open,
      epoch: 1,
      closed: true,
      run: { ...runFields, state: 'maintenance' },
    } satisfies InitialMigrationStatus,
    steps: ['backfill', 'activate', 'publish', 'smoke', 'reopen'],
  },
  {
    state: 'maintenance past its budget',
    status: {
      ...open,
      epoch: 1,
      closed: true,
      budgetExceeded: true,
      run: { ...runFields, state: 'maintenance' },
    } satisfies InitialMigrationStatus,
    prepared: 2,
    steps: [
      'abort',
      'start',
      'backfill',
      'activate',
      'publish',
      'smoke',
      'reopen',
    ],
  },
  {
    state: 'aborted',
    status: {
      ...open,
      epoch: 2,
      run: { ...runFields, state: 'aborted' },
    } satisfies InitialMigrationStatus,
    prepared: 2,
    steps: ['start', 'backfill', 'activate', 'publish', 'smoke', 'reopen'],
  },
  {
    state: 'activated, publishing',
    status: activated(false, null),
    steps: ['publish', 'smoke', 'reopen'],
  },
  {
    state: 'activated and published',
    status: activated(true, null),
    steps: ['smoke', 'reopen'],
  },
  {
    state: 'activated, smoke passed',
    status: activated(true, { outcome: 'passed', epoch: 1 }),
    steps: ['reopen'],
  },
  {
    state: 'repairing',
    status: {
      ...activated(true, null),
      epoch: 3,
      run: {
        ...runFields,
        state: 'repairing',
        activation: { activationId: 'trial-1-activation' },
        publication: { nextPage: 1, published: 0, isDone: true },
        smoke: { outcome: 'passed', epoch: 1 },
      },
    } satisfies InitialMigrationStatus,
    steps: ['smoke', 'reopen'],
  },
])(
  'resumes from $state with the steps that remain',
  async ({ status, steps, prepared }) => {
    const trial = cutover(status);
    await expect(trial.result).resolves.toBe('reopened');
    expect(trial.steps()).toEqual(steps);
    if (prepared === undefined) expect(trial.prepare).not.toHaveBeenCalled();
    else expect(trial.prepare).toHaveBeenCalledExactlyOnceWith(prepared);
  },
);

it('a deployment already open under sheet authority needs no step and no release', async () => {
  const trial = cutover({
    ...open,
    epoch: 2,
    authority: 'sheet',
    run: {
      ...runFields,
      state: 'reopened',
      activation: { activationId: 'trial-1-activation' },
      publication: { nextPage: 1, published: 0, isDone: true },
      smoke: { outcome: 'passed', epoch: 1 },
    },
  });
  await expect(trial.result).resolves.toBe('already-open');
  expect(trial.steps()).toEqual([]);
  expect(trial.prepare).not.toHaveBeenCalled();
  expect(trial.buildIdentity).not.toHaveBeenCalled();
});

it('refuses to resume a run whose release this trial did not record, and names the discard', async () => {
  const trial = cutover(
    {
      ...open,
      epoch: 1,
      closed: true,
      run: { ...runFields, state: 'maintenance' },
    },
    { hasSaved: false },
  );
  await expect(trial.result).rejects.toThrow('pnpm dev:trial --discard');
  expect(trial.steps()).toEqual(['backfill']);
});

it('stops on a failed smoke check instead of repeating it', async () => {
  const trial = cutover(activated(true, null), { smoke: 'failed' });
  await expect(trial.result).rejects.toThrow('smoke check failed');
  expect(trial.steps()).toEqual(['smoke']);
});

let directory: string;
let server: Server | undefined;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'local-trial-'));
});
afterEach(async () => {
  await new Promise((resolve) => (server ? server.close(resolve) : resolve(0)));
  server = undefined;
  await rm(directory, { recursive: true, force: true });
});

/** The real operator: every guard of `createRemoteAdapter` runs. */
const guarded = (overrides: Partial<typeof target>) =>
  runLocalTrialCutover({
    target: { ...target, ...overrides },
    buildIdentity: async () => '',
    release: { prepare: async () => release, saved: async () => release },
    log: () => undefined,
  });

it('the operator itself refuses a target that is not a local instance', async () => {
  await expect(
    guarded({ url: 'https://happy-otter-123.convex.cloud' }),
  ).rejects.toThrow(
    'Deployment URL must match the explicitly named deployment.',
  );
  await expect(guarded({ name: 'happy-otter-123' })).rejects.toThrow(
    'Deployment URL must match the explicitly named deployment.',
  );
});

it('the operator itself checks the instance name and the key before sending it', async () => {
  server = createServer((_, response) => response.end('ep-dev-ffffffffffff'));
  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const url = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
  await expect(guarded({ url })).rejects.toThrow(
    'Local Convex instance does not match the explicitly named deployment.',
  );
  const keyFile = join(directory, 'local-admin.key');
  await writeFile(keyFile, 'prod:happy-otter-123|secret');
  await expect(
    guarded({ url, name: 'ep-dev-ffffffffffff', adminKeyFile: keyFile }),
  ).rejects.toThrow(
    'The admin key is for production deployment happy-otter-123',
  );
});
