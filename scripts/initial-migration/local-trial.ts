import { z } from 'zod';
import {
  initialMigrationStatusSchema,
  runInitialMigrationOperator,
  type InitialMigrationStatus,
} from './operator.ts';

/**
 * The owner's local trial (`pnpm dev:trial`, `scripts/local-convex/trial.ts`)
 * runs the operator's own steps through this entry, beside the operator, so
 * the launch scan (`tests/initial-migration-writers.test.ts`) still finds no
 * other launcher. The target is always a local instance: `--target-kind
 * local` is fixed here, `--production` never passed, and every call still
 * goes through the operator's guards (name pattern, loopback URL, the
 * instance-name check and the key rule).
 */
export type LocalTrialTarget = {
  name: string;
  url: string;
  adminKeyFile: string;
};
/** The prepared and reconciled Catalog Release activation selects. */
export type LocalTrialRelease = {
  releaseNumber: number;
  impactRunId: string;
  schema: string;
  calculation: string;
};
type Operator = (args: string[]) => Promise<unknown>;

const reportSchema = z.looseObject({ did: z.string(), details: z.unknown() });
const backfillSchema = z.looseObject({ isActivationReady: z.boolean() });
const smokeSchema = z.looseObject({ outcome: z.enum(['passed', 'failed']) });
type Run = NonNullable<InitialMigrationStatus['run']>;

/** The step the status calls for, by the run's stage. */
type TrialStep =
  | { kind: 'open' }
  | { kind: 'start' }
  | { kind: 'abort' }
  | { kind: 'backfill'; run: Run }
  | { kind: 'publish' | 'smoke' | 'reopen'; run: Run };

function trialStep(status: InitialMigrationStatus): TrialStep {
  const { run } = status;
  if (!run || run.state === 'aborted') return { kind: 'start' };
  if (run.state === 'maintenance')
    return status.budgetExceeded
      ? { kind: 'abort' }
      : { kind: 'backfill', run };
  if (run.state === 'reopened') return { kind: 'open' };
  return sheetStep(run, status.epoch);
}

/** After activation or a repair closure: publish, smoke, then reopen. */
function sheetStep(
  run: Extract<Run, { state: 'activated' | 'repairing' }>,
  epoch: number,
): TrialStep {
  if (run.state === 'activated' && !run.publication.isDone)
    return { kind: 'publish', run };
  return run.smoke?.outcome === 'passed' && run.smoke.epoch === epoch
    ? { kind: 'reopen', run }
    : { kind: 'smoke', run };
}

/** Each step a status read can call for, once, with room for a slow backfill. */
const maxSteps = 24;
const restart =
  'Start again with `pnpm dev:trial --discard`, then `pnpm dev:trial`.';

type Session = {
  call: (step: string, flags?: string[]) => Promise<unknown>;
  identityFile: () => Promise<string>;
  prepare: (writeEpoch: number) => Promise<LocalTrialRelease>;
  prepared: () => Promise<LocalTrialRelease>;
};

async function start(session: Session, status: InitialMigrationStatus) {
  const release = await session.prepare(status.epoch);
  await session.call('start', [
    '--operation-id',
    `trial-${status.epoch + 1}`,
    '--number',
    String(release.releaseNumber),
    '--build-identity',
    await session.identityFile(),
    '--budget-minutes',
    '240',
  ]);
}

/** Backfills the run's capture, then activates fixture-only once it is ready. */
async function backfillAndActivate(session: Session, run: Run) {
  const id = run.operationId;
  const backfill = backfillSchema.parse(
    await session.call('backfill', [
      '--capture-id',
      `${id}-capture`,
      '--driver-id',
      `${id}-driver`,
      '--validation-id',
      `${id}-validation`,
      '--wait-seconds',
      '600',
    ]),
  );
  const release = await session.prepared();
  if (!backfill.isActivationReady) return;
  await session.call('activate', [
    '--capture-id',
    `${id}-capture`,
    '--activation-id',
    `${id}-activation`,
    '--number',
    String(release.releaseNumber),
    '--impact-run-id',
    release.impactRunId,
    '--schema',
    release.schema,
    '--calculation',
    release.calculation,
    '--build-identity',
    await session.identityFile(),
    '--fixture-only',
  ]);
}

async function smoke(session: Session, run: Run, epoch: number) {
  const result = smokeSchema.parse(
    await session.call('smoke', [
      '--smoke-id',
      `${run.operationId}-smoke-${epoch}`,
    ]),
  );
  if (result.outcome === 'failed')
    throw new Error(
      `The smoke check failed; the trial instance stays closed. ${restart}`,
    );
}

async function takeStep(
  session: Session,
  step: Exclude<TrialStep, { kind: 'open' }>,
  status: InitialMigrationStatus,
) {
  if (step.kind === 'start') return start(session, status);
  if (step.kind === 'backfill') return backfillAndActivate(session, step.run);
  if (step.kind === 'smoke') return smoke(session, step.run, status.epoch);
  const flags = {
    abort: [],
    publish: ['--wait-seconds', '600'],
    reopen: ['--build-identity', await session.identityFile()],
  }[step.kind];
  await session.call(step.kind, flags);
}

/**
 * Reads `initialMigration:status` and takes the step it calls for until the
 * deployment is open under sheet authority: start (after preparing the
 * release at the status epoch), backfill, fixture-only activate, publish,
 * smoke and reopen. A rerun resumes from whatever stage the status reports;
 * a run past its maintenance budget is aborted and started again. Returns
 * `already-open` when no step was needed.
 */
export async function runLocalTrialCutover({
  target,
  buildIdentity,
  release,
  operator = (args) => runInitialMigrationOperator({ args }),
  log,
}: {
  target: LocalTrialTarget;
  /** Writes the development build identity and returns its file. */
  buildIdentity: () => Promise<string>;
  release: {
    /** Builds, prepares, allocates and reconciles at this write epoch. */
    prepare: (writeEpoch: number) => Promise<LocalTrialRelease>;
    /** The release an earlier invocation prepared, if it recorded one. */
    saved: () => Promise<LocalTrialRelease | undefined>;
  };
  operator?: Operator;
  log: (line: string) => void;
}): Promise<'already-open' | 'reopened'> {
  const targetArgs = [
    '--deployment-name',
    target.name,
    '--deployment-url',
    target.url,
    '--target-kind',
    'local',
    '--admin-key-file',
    target.adminKeyFile,
  ];
  let identity: string | undefined;
  let prepared: LocalTrialRelease | undefined;
  const session: Session = {
    call: async (step, flags = []) => {
      const report = reportSchema.parse(
        await operator([step, ...targetArgs, ...flags]),
      );
      if (step !== 'status') log(`${step}: ${report.did}`);
      return report.details;
    },
    identityFile: async () => (identity ??= await buildIdentity()),
    prepare: async (writeEpoch) =>
      (prepared = await release.prepare(writeEpoch)),
    prepared: async () => {
      prepared ??= await release.saved();
      if (!prepared)
        throw new Error(
          `This trial instance has a Migration Run but no recorded release. ${restart}`,
        );
      return prepared;
    },
  };
  for (let count = 0; count < maxSteps; count++) {
    const status = initialMigrationStatusSchema.parse(
      await session.call('status'),
    );
    const step = trialStep(status);
    if (step.kind === 'open') return count === 0 ? 'already-open' : 'reopened';
    await takeStep(session, step, status);
  }
  throw new Error(
    `The trial instance was not open after ${maxSteps} steps; rerun \`pnpm dev:trial\` to resume.`,
  );
}
