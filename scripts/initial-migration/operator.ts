import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { ConvexError } from 'convex/values';
import { z } from 'zod';
import {
  DEVELOPMENT_FRONTEND_BUILD,
  frontendBuildIdentitySchema,
} from '../../src/lib/client-compatibility.ts';
import { createRemoteAdapter } from '../catalog/release-operator.ts';

/**
 * `pnpm initial-migration <step>`: the operator's steps of the initial switch
 * to sheet authority, in the order of `docs/initial-character-migration-write-gate.md`
 * (#413 F6c; design A). Every step reads `initialMigration:status` first and
 * derives its run and epoch from it, so rerunning a command after a lost
 * response resumes: the server returns the recorded result of a step that
 * already committed. A step out of order is sent anyway and refused by the
 * server, whose reason the command prints; only a step that needs a run when
 * there is none refuses here.
 */
export const operatorSteps = [
  'status',
  'start',
  'backfill',
  'activate',
  'publish',
  'smoke',
  'reopen',
  'close-for-repair',
  'abort',
] as const;
type Step = (typeof operatorSteps)[number];

export const initialMigrationUsage = `Usage: pnpm initial-migration <step> --deployment-name NAME --deployment-url URL --target-kind KIND --admin-key-file PATH [--production]
  status
  start --operation-id ID --number N --build-identity URL|PATH --budget-minutes M
  backfill --capture-id ID --driver-id ID --validation-id ID [--wait-seconds S]
  activate --capture-id ID --activation-id ID --number N --impact-run-id ID --schema ID --calculation ID --build-identity URL|PATH [--fixture-only]
  publish [--wait-seconds S]
  smoke --smoke-id ID
  reopen --build-identity URL|PATH
  close-for-repair
  abort
Production needs --production with --target-kind production, a commit build identity and no --fixture-only.
`;

type Query =
  | 'initialMigration:status'
  | 'initialCharacterBackfill:status'
  | 'catalogRelease:inspect';
type Mutation =
  | 'initialMigration:start'
  | 'initialCharacterBackfill:startDriver'
  | 'initialMigration:activate'
  | 'initialMigration:publish'
  | 'initialMigration:smoke'
  | 'initialMigration:reopen'
  | 'initialMigration:closeForRepair'
  | 'initialMigration:abortBeforeActivation';
export type InitialMigrationAdapter = {
  query(name: Query, args: Record<string, unknown>): Promise<unknown>;
  mutation(name: Mutation, args: Record<string, unknown>): Promise<unknown>;
};
export type OperatorEnvironment = {
  /** The deployment; without it, the flags name a remote one. */
  adapter?: InitialMigrationAdapter;
  /** Reads the published site's `build-identity.json`. */
  readBuildIdentity?: (source: string) => Promise<unknown>;
  now?: () => number;
  /** Waits between status polls (tests run scheduled functions here). */
  pause?: (ms: number) => Promise<void>;
};
export type OperatorReport = {
  step: Step;
  /** The deployment the command addressed, printed first. */
  target: string;
  did: string;
  next: string;
  details: unknown;
};

const runFields = {
  runId: z.string(),
  epoch: z.number(),
  operationId: z.string(),
};
/** A record the run's stage does not have yet. */
const absent = z.undefined().optional();
const smokeSchema = z.looseObject({
  outcome: z.enum(['passed', 'failed']),
  epoch: z.number(),
});
/** What activation records, which every later stage keeps. */
const activatedFields = {
  ...runFields,
  activation: z.looseObject({ activationId: z.string() }),
  publication: z.looseObject({
    nextPage: z.number(),
    published: z.number(),
    isDone: z.boolean(),
  }),
};
const beforeActivation = {
  ...runFields,
  activation: absent,
  publication: absent,
  smoke: absent,
};
/**
 * A run as `initialMigration:status` reports it, by stage: each stage carries
 * exactly its records (`convex/initialMigration.ts`, `status`), so a run whose
 * records disagree with its stage does not parse.
 */
const runSchema = z.discriminatedUnion('state', [
  z.looseObject({ ...beforeActivation, state: z.literal('maintenance') }),
  z.looseObject({ ...beforeActivation, state: z.literal('aborted') }),
  z.looseObject({
    ...activatedFields,
    state: z.literal('activated'),
    smoke: smokeSchema.nullable(),
  }),
  z.looseObject({
    ...activatedFields,
    state: z.literal('reopened'),
    smoke: smokeSchema.extend({ outcome: z.literal('passed') }),
  }),
  z.looseObject({
    ...activatedFields,
    state: z.literal('repairing'),
    smoke: smokeSchema.nullable(),
  }),
]);
const statusSchema = z.looseObject({
  epoch: z.number(),
  closed: z.boolean(),
  authority: z.enum(['legacy', 'sheet']),
  budgetExceeded: z.boolean(),
  run: runSchema.nullable(),
});
/** `initialMigration:status` as the command reads it. */
export type InitialMigrationStatus = z.infer<typeof statusSchema>;
type Status = InitialMigrationStatus;
type Run = z.infer<typeof runSchema>;
const backfillSchema = z.looseObject({
  isActivationReady: z.boolean(),
  progress: z
    .looseObject({
      driverGeneration: z.number(),
      validationId: z.string().nullable(),
      driver: z
        .looseObject({ id: z.string(), isRunning: z.boolean() })
        .nullable(),
    })
    .nullable(),
});

function parseOperatorArguments(args: string[]) {
  const text = { type: 'string' } as const;
  return parseArgs({
    args,
    strict: true,
    allowPositionals: true,
    options: {
      'deployment-name': text,
      'deployment-url': text,
      'target-kind': text,
      'admin-key-file': text,
      production: { type: 'boolean' },
      'fixture-only': { type: 'boolean' },
      'operation-id': text,
      number: text,
      'build-identity': text,
      'budget-minutes': text,
      'capture-id': text,
      'driver-id': text,
      'validation-id': text,
      'wait-seconds': text,
      'activation-id': text,
      'impact-run-id': text,
      schema: text,
      calculation: text,
      'smoke-id': text,
      help: { type: 'boolean' },
    },
  });
}
type Values = ReturnType<typeof parseOperatorArguments>['values'];

function required(values: Values, name: keyof Values): string {
  const value = values[name];
  if (typeof value !== 'string' || !value.trim())
    throw new Error(`--${name} is required.`);
  return value;
}
function positive(values: Values, name: keyof Values, fallback?: number) {
  if (values[name] === undefined && fallback !== undefined) return fallback;
  const value = required(values, name);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)))
    throw new Error(`--${name} must be a nonnegative integer.`);
  return Number(value);
}

/** Design F: production only with `--production`, and the flag only there. */
function isProduction(values: Values) {
  const production = values['target-kind'] === 'production';
  if (production !== (values.production === true))
    throw new Error(
      production
        ? 'A production deployment needs --production.'
        : '--production applies only to --target-kind production.',
    );
  if (production && values['fixture-only'])
    throw new Error('Production cannot be switched fixture-only.');
  return production;
}

async function defaultReadBuildIdentity(source: string): Promise<unknown> {
  if (!/^https?:\/\//.test(source)) {
    const parsed: unknown = JSON.parse(await readFile(source, 'utf8'));
    return parsed;
  }
  const response = await fetch(source, { redirect: 'error' });
  if (!response.ok)
    throw new Error(`Build identity unavailable (${response.status}).`);
  const body: unknown = await response.json();
  return body;
}

async function remoteAdapter(values: Values): Promise<InitialMigrationAdapter> {
  const { invoke } = await createRemoteAdapter({
    deploymentName: required(values, 'deployment-name'),
    deploymentUrl: required(values, 'deployment-url'),
    adminKeyFile: required(values, 'admin-key-file'),
    targetKind: required(values, 'target-kind'),
  });
  const call = (name: string, args: unknown) => {
    const [module, endpoint] = name.split(':');
    return invoke(module ?? '', endpoint ?? '', args);
  };
  return { query: call, mutation: call };
}

/** A step's context: the deployment, its status and the step's flags. */
type Context = {
  step: Step;
  values: Values;
  adapter: InitialMigrationAdapter;
  status: Status;
  now: () => number;
  pause: (ms: number) => Promise<void>;
  buildIdentity: () => Promise<string>;
};

/** A refusal's text: a Write Gate refusal carries `{code, message}`. */
function refusalReason(data: unknown) {
  if (typeof data === 'string') return data;
  const parsed = z
    .looseObject({ code: z.string(), message: z.string() })
    .safeParse(data);
  return parsed.success
    ? `${parsed.data.code}: ${parsed.data.message}`
    : JSON.stringify(data);
}

/** Calls the deployment; a refusal carries the server's reason. */
async function answered<T>(step: Step, call: () => Promise<T>) {
  try {
    return await call();
  } catch (error) {
    if (error instanceof ConvexError)
      throw new Error(
        `${step} refused by the deployment: ${refusalReason(error.data)} Inspect with \`pnpm initial-migration status\`.`,
      );
    throw new Error(
      `${step}: no answer from the deployment (${error instanceof Error ? error.message : String(error)}). The step may have committed; rerun the same command to resume.`,
    );
  }
}
type Caller = Pick<Context, 'step' | 'adapter'>;
const ask = (context: Caller, name: Query, args: Record<string, unknown>) =>
  answered(context.step, () => context.adapter.query(name, args));
const send = (context: Caller, name: Mutation, args: Record<string, unknown>) =>
  answered(context.step, () => context.adapter.mutation(name, args));

async function readStatus(context: Caller & Pick<Context, 'now'>) {
  return statusSchema.parse(
    await ask(context, 'initialMigration:status', { now: context.now() }),
  );
}

function requireRun(context: Context): Run {
  if (!context.status.run)
    throw new Error(
      `${context.step} refused: no Migration Run has started; run \`pnpm initial-migration start\` first.`,
    );
  return context.status.run;
}

/** The step the status calls for, as the operator types it. */
export function nextStep(status: Status): string {
  const { run } = status;
  if (!run || run.state === 'aborted') return 'start';
  if (run.state === 'maintenance')
    return status.budgetExceeded
      ? 'abort (the maintenance budget is spent)'
      : 'backfill, then activate once it reports ready';
  if (run.state === 'reopened')
    return 'none: open under sheet authority; close-for-repair to repair';
  return closedSheetStep(run, status.epoch);
}

/** After activation or a repair closure: publish, smoke, then reopen. */
function closedSheetStep(
  run: Extract<Run, { state: 'activated' | 'repairing' }>,
  epoch: number,
) {
  if (run.state === 'activated' && !run.publication.isDone) return 'publish';
  const { smoke } = run;
  return smoke?.outcome === 'passed' && smoke.epoch === epoch
    ? 'reopen'
    : 'smoke';
}

/** Polls `done` up to `--wait-seconds`, pausing a second between reads. */
async function waitFor<T>(
  context: Context,
  read: () => Promise<T>,
  done: (value: T) => boolean,
) {
  const until =
    context.now() + positive(context.values, 'wait-seconds', 0) * 1000;
  let value = await read();
  while (!done(value) && context.now() < until) {
    await context.pause(1000);
    value = await read();
  }
  return value;
}

async function start(context: Context) {
  const { values, status } = context;
  const operationId = required(values, 'operation-id');
  const frontendBuild = await context.buildIdentity();
  const releaseNumber = positive(values, 'number');
  const release = z
    .looseObject({
      manifest: z.looseObject({ artifactFingerprint: z.string() }),
    })
    .parse(await ask(context, 'catalogRelease:inspect', { releaseNumber }));
  const repeat =
    status.run?.operationId === operationId &&
    status.run.state === 'maintenance';
  const receipt = await send(context, 'initialMigration:start', {
    operationId,
    // A repeat names the epoch it started from, as its first call did.
    expectedEpoch: repeat ? status.epoch - 1 : status.epoch,
    frontendBuild,
    catalogManifest: release.manifest.artifactFingerprint,
    maintenanceBudgetMs: positive(values, 'budget-minutes') * 60_000,
  });
  return {
    did: `Closed the Write Gate for run ${operationId} with frontend build ${frontendBuild} and Catalog Release ${releaseNumber}.`,
    details: receipt,
  };
}

async function backfill(context: Context) {
  const run = requireRun(context);
  const { values } = context;
  const receipt = {
    runId: run.runId,
    epoch: run.epoch,
    captureId: required(values, 'capture-id'),
  };
  const read = async () =>
    backfillSchema.parse(
      await ask(context, 'initialCharacterBackfill:status', {
        ...receipt,
        now: context.now(),
      }),
    );
  const before = await read();
  if (!before.isActivationReady) {
    const progress = before.progress;
    // The same driver identity returns its state, so a repeat starts nothing.
    await send(context, 'initialCharacterBackfill:startDriver', {
      ...receipt,
      driverId: required(values, 'driver-id'),
      validationId: required(values, 'validation-id'),
      expectedValidationId: progress?.validationId ?? null,
      expectedDriverGeneration: progress?.driverGeneration ?? 0,
    });
  }
  const after = await waitFor(
    context,
    read,
    (value) => value.isActivationReady,
  );
  return {
    did: after.isActivationReady
      ? 'The candidate backfill certified this capture.'
      : 'The candidate backfill driver is running.',
    next: after.isActivationReady ? 'activate' : 'backfill (rerun to watch it)',
    details: after,
  };
}

async function activate(context: Context) {
  const run = requireRun(context);
  const { values } = context;
  // Without it the server requires a QUALIFIED scope (design F).
  const isFixtureOnly = values['fixture-only'] === true;
  const result = await send(context, 'initialMigration:activate', {
    runId: run.runId,
    epoch: run.epoch,
    captureId: required(values, 'capture-id'),
    activationId: required(values, 'activation-id'),
    releaseNumber: positive(values, 'number'),
    impactRunId: required(values, 'impact-run-id'),
    schemaIdentity: required(values, 'schema'),
    calculationIdentity: required(values, 'calculation'),
    observedFrontendBuild: await context.buildIdentity(),
    isFixtureOnly,
  });
  return {
    did: 'Switched to sheet authority; the gate stays closed.',
    details: result,
  };
}

async function publish(context: Context) {
  const run = requireRun(context);
  // Before activation there is no publication; the server says why it refuses.
  const { activation, publication } =
    run.state === 'maintenance' || run.state === 'aborted'
      ? {
          activation: { activationId: '' },
          publication: { nextPage: 0, published: 0, isDone: false },
        }
      : run;
  if (!publication.isDone)
    await send(context, 'initialMigration:publish', {
      runId: run.runId,
      epoch: context.status.epoch,
      activationId: activation.activationId,
      page: publication.nextPage,
    });
  const after = await waitFor(
    context,
    () => readStatus(context),
    (status) => status.run?.publication?.isDone === true,
  );
  const progress = after.run?.publication ?? publication;
  return progress.isDone
    ? {
        did: `Published ${progress.published} candidate sheets.`,
        next: 'smoke',
        details: progress,
      }
    : {
        did: `Publishing: ${progress.published} candidate sheets so far.`,
        next: 'publish (rerun to resume or watch)',
        details: progress,
      };
}

async function smoke(context: Context) {
  const run = requireRun(context);
  const result = z.looseObject({ outcome: z.enum(['passed', 'failed']) }).parse(
    await send(context, 'initialMigration:smoke', {
      runId: run.runId,
      epoch: context.status.epoch,
      smokeId: required(context.values, 'smoke-id'),
    }),
  );
  return result.outcome === 'passed'
    ? { did: 'The smoke check passed.', next: 'reopen', details: result }
    : {
        did: 'The smoke check failed; the deployment stays closed under sheet authority.',
        next: 'deploy a fix, then smoke again',
        details: result,
      };
}

/**
 * A gate step a lost response may already have taken: the run is in the
 * stage it leaves, so the repeat names the epoch it started from.
 */
function gateStepEpoch(
  context: Context,
  leaves: Run['state'],
  closed: boolean,
) {
  const { status } = context;
  return status.run?.state === leaves && status.closed === closed
    ? status.epoch - 1
    : status.epoch;
}

async function reopen(context: Context) {
  const run = requireRun(context);
  const result = await send(context, 'initialMigration:reopen', {
    runId: run.runId,
    epoch: gateStepEpoch(context, 'reopened', false),
    observedFrontendBuild: await context.buildIdentity(),
  });
  return {
    did: 'Opened the gate under sheet authority; earlier tabs reload, fresh ones can write.',
    details: result,
  };
}

async function closeForRepair(context: Context) {
  const run = requireRun(context);
  const result = await send(context, 'initialMigration:closeForRepair', {
    runId: run.runId,
    epoch: gateStepEpoch(context, 'repairing', true),
  });
  return {
    did: 'Closed the gate for a repair; sheet authority and every edit stay.',
    details: result,
  };
}

async function abort(context: Context) {
  const run = requireRun(context);
  const result = await send(context, 'initialMigration:abortBeforeActivation', {
    runId: run.runId,
    epoch: run.epoch,
  });
  return {
    did: 'Aborted the run before activation and reopened under legacy authority.',
    details: result,
  };
}

const steps: Record<
  Exclude<Step, 'status'>,
  (
    context: Context,
  ) => Promise<{ did: string; details: unknown; next?: string }>
> = {
  start,
  backfill,
  activate,
  publish,
  smoke,
  reopen,
  'close-for-repair': closeForRepair,
  abort,
};

/** The deployment a command addresses, as its first output line names it. */
function describeTarget(values: Values, environment: OperatorEnvironment) {
  return environment.adapter
    ? 'the injected adapter'
    : `${values['target-kind']} deployment ${values['deployment-name']} at ${values['deployment-url']}`;
}

export async function runInitialMigrationOperator({
  args,
  ...environment
}: { args: string[] } & OperatorEnvironment): Promise<
  OperatorReport | { usage: string }
> {
  const { values, positionals } = parseOperatorArguments(args);
  if (values.help) return { usage: initialMigrationUsage };
  const step = operatorSteps.find((name) => name === positionals[0]);
  if (positionals.length !== 1 || !step) throw new Error(initialMigrationUsage);
  const production = isProduction(values);
  const readBuildIdentity =
    environment.readBuildIdentity ?? defaultReadBuildIdentity;
  const buildIdentity = async () => {
    const { frontendBuild } = frontendBuildIdentitySchema.parse(
      await readBuildIdentity(required(values, 'build-identity')),
    );
    if (production && frontendBuild === DEVELOPMENT_FRONTEND_BUILD)
      throw new Error(
        `${step} refused: a development frontend build cannot switch production; publish a commit build first.`,
      );
    return frontendBuild;
  };
  const adapter = environment.adapter ?? (await remoteAdapter(values));
  const target = describeTarget(values, environment);
  const now = environment.now ?? Date.now;
  const base = { step, adapter, now };
  const context: Context = {
    ...base,
    values,
    status: await readStatus(base),
    pause:
      environment.pause ??
      ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
    buildIdentity,
  };
  if (step === 'status')
    return {
      step,
      target,
      did: 'Read initialMigration:status.',
      next: nextStep(context.status),
      details: context.status,
    };
  const outcome = await steps[step](context);
  return {
    step,
    target,
    did: outcome.did,
    next: outcome.next ?? nextStep(await readStatus(context)),
    details: outcome.details,
  };
}
