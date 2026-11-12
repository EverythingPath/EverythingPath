import { ConvexError, v, type Infer } from 'convex/values';
import {
  internalMutation,
  internalQuery,
  query,
  type MutationCtx,
} from './_generated/server';
import type { Doc } from './_generated/dataModel';
import { readWriteGate } from './lib/writeGate';
import { readCutover } from './lib/campaignRuntime';
import {
  abortInitialMigrationRun,
  backfillReceipt,
  evaluateBackfillCompletion,
  findBackfillRunProblem,
} from './lib/initialCharacterBackfill';
import {
  requireReleaseActivationReadiness,
  selectRelease,
} from './lib/catalogReleaseSelection';
import { requireCatalogFixtureIsolation } from './lib/catalogFixturePolicy';
import {
  initialMigrationActivationValidator,
  initialMigrationPublicationValidator,
} from './schema';
import { catalogReleaseLimits } from '../src/lib/catalog/release-limits';

const runReceipt = v.object({
  runId: v.id('initialMigrationRun'),
  epoch: v.number(),
});
const runStatusFields = {
  ...runReceipt.fields,
  operationId: v.string(),
  frontendBuild: v.string(),
  catalogManifest: v.string(),
  startedAt: v.number(),
  deadline: v.number(),
};

export const clientStatus = query({
  args: {},
  returns: v.object({
    status: v.union(
      v.literal('ready'),
      v.literal('maintenance'),
      v.literal('reload_required'),
    ),
    epoch: v.number(),
  }),
  handler: async (ctx) => {
    const control = await readWriteGate(ctx);
    const paused = (await readCutover(ctx))?.status === 'paused';
    return {
      status:
        control?.closed || paused
          ? ('maintenance' as const)
          : control?.authority === 'sheet'
            ? ('reload_required' as const)
            : ('ready' as const),
      epoch: control?.epoch ?? 0,
    };
  },
});

export const start = internalMutation({
  args: {
    operationId: v.string(),
    expectedEpoch: v.number(),
    frontendBuild: v.string(),
    catalogManifest: v.string(),
    maintenanceBudgetMs: v.number(),
  },
  returns: runReceipt,
  handler: async (ctx, args) => {
    const control = await readWriteGate(ctx);
    const existing = await ctx.db
      .query('initialMigrationRun')
      .withIndex('by_operationId', (q) => q.eq('operationId', args.operationId))
      .unique();
    if (existing) {
      if (
        existing.state === 'maintenance' &&
        control?.closed &&
        control.runId === existing._id &&
        existing.epoch === control.epoch &&
        args.expectedEpoch === existing.epoch - 1 &&
        args.frontendBuild === existing.frontendBuild &&
        args.catalogManifest === existing.catalogManifest &&
        args.maintenanceBudgetMs === existing.deadline - existing.startedAt
      )
        return { runId: existing._id, epoch: existing.epoch };
      throw new ConvexError(
        'Migration operation already used; inspect status before starting another run.',
      );
    }
    if (
      control?.closed ||
      control?.authority === 'sheet' ||
      args.expectedEpoch !== (control?.epoch ?? 0)
    )
      throw new ConvexError(
        'Migration state changed; inspect status before starting.',
      );
    if (
      !args.operationId.trim() ||
      !args.frontendBuild.trim() ||
      !args.catalogManifest.trim() ||
      !Number.isSafeInteger(args.maintenanceBudgetMs) ||
      args.maintenanceBudgetMs <= 0
    )
      throw new ConvexError(
        'Supply operation, frontend and catalog identities and a positive maintenance budget.',
      );
    const epoch = (control?.epoch ?? 0) + 1;
    const startedAt = Date.now();
    const runId = await ctx.db.insert('initialMigrationRun', {
      operationId: args.operationId,
      epoch,
      state: 'maintenance',
      frontendBuild: args.frontendBuild,
      catalogManifest: args.catalogManifest,
      startedAt,
      deadline: startedAt + args.maintenanceBudgetMs,
    });
    if (control)
      await ctx.db.patch('initialMigrationControl', control._id, {
        closed: true,
        epoch,
        runId,
      });
    else
      await ctx.db.insert('initialMigrationControl', {
        key: 'character-sheet',
        closed: true,
        authority: 'legacy',
        epoch,
        runId,
      });
    return { runId, epoch };
  },
});

export const status = internalQuery({
  args: { now: v.number() },
  returns: v.object({
    epoch: v.number(),
    closed: v.boolean(),
    budgetExceeded: v.boolean(),
    authority: v.union(v.literal('legacy'), v.literal('sheet')),
    run: v.union(
      v.null(),
      v.object({ ...runStatusFields, state: v.literal('maintenance') }),
      v.object({
        ...runStatusFields,
        state: v.literal('aborted'),
        abortedAt: v.number(),
      }),
      v.object({
        ...runStatusFields,
        state: v.literal('activated'),
        activation: initialMigrationActivationValidator,
        publication: initialMigrationPublicationValidator,
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const control = await readWriteGate(ctx);
    const run = control
      ? await ctx.db.get('initialMigrationRun', control.runId)
      : null;
    return {
      epoch: control?.epoch ?? 0,
      closed: control?.closed ?? false,
      budgetExceeded: Boolean(
        control?.closed &&
        run?.state === 'maintenance' &&
        args.now >= run.deadline,
      ),
      authority: control?.authority ?? ('legacy' as const),
      run: run ? runStatus(run) : null,
    };
  },
});

/** A run as `status` reports it: its stage and that stage's records. */
function runStatus(run: Doc<'initialMigrationRun'>) {
  const fields = {
    runId: run._id,
    epoch: run.epoch,
    operationId: run.operationId,
    frontendBuild: run.frontendBuild,
    catalogManifest: run.catalogManifest,
    startedAt: run.startedAt,
    deadline: run.deadline,
  };
  switch (run.state) {
    case 'maintenance':
      return { ...fields, state: run.state };
    case 'aborted':
      return { ...fields, state: run.state, abortedAt: run.abortedAt };
    case 'activated':
      return {
        ...fields,
        state: run.state,
        activation: run.activation,
        publication: run.publication,
      };
  }
}

export const abortBeforeActivation = internalMutation({
  args: runReceipt,
  returns: v.object({ epoch: v.number() }),
  handler: abortInitialMigrationRun,
});

const activationArgs = v.object({
  ...backfillReceipt.fields,
  activationId: v.string(),
  releaseNumber: v.number(),
  impactRunId: v.id('catalogImpactRun'),
  schemaIdentity: v.string(),
  calculationIdentity: v.string(),
  observedFrontendBuild: v.string(),
  isFixtureOnly: v.boolean(),
});
type ActivationArgs = Infer<typeof activationArgs>;
type Activation = Infer<typeof initialMigrationActivationValidator>;
type ActivatedRun = Extract<Doc<'initialMigrationRun'>, { state: 'activated' }>;

function refuseActivation(reason: string): never {
  throw new ConvexError(`Activation refused: ${reason}.`);
}

function isSameActivation(activation: Activation, args: ActivationArgs) {
  return (
    activation.activationId === args.activationId &&
    activation.captureId === args.captureId &&
    activation.releaseNumber === args.releaseNumber &&
    activation.impactRunId === args.impactRunId &&
    activation.schemaIdentity === args.schemaIdentity &&
    activation.calculationIdentity === args.calculationIdentity &&
    activation.observedFrontendBuild === args.observedFrontendBuild &&
    activation.isFixtureOnly === args.isFixtureOnly
  );
}

function activationResult({
  run,
  activation,
  publication,
  closed,
}: {
  run: Pick<Doc<'initialMigrationRun'>, '_id' | 'epoch'>;
  activation: Activation;
  publication: Infer<typeof initialMigrationPublicationValidator>;
  closed: boolean;
}) {
  return {
    runId: run._id,
    epoch: run.epoch,
    activation,
    authority: 'sheet' as const,
    closed,
    pendingPublication: !publication.isDone,
  };
}

/** The recorded result for an exact repeat; any other repeat refuses. */
function repeatActivation(
  control: Doc<'initialMigrationControl'> | null,
  run: ActivatedRun,
  args: ActivationArgs,
) {
  const { activation, publication } = run;
  if (
    control?.runId !== run._id ||
    control.authority !== 'sheet' ||
    run.epoch !== args.epoch ||
    !isSameActivation(activation, args)
  )
    throw new ConvexError(
      'Migration run already activated with other arguments; inspect initialMigration:status.',
    );
  return activationResult({
    run,
    activation,
    publication,
    closed: control.closed,
  });
}

/**
 * Design C preconditions 1 and 2: the closed legacy gate on the current run
 * and epoch, a certified backfill receipt, and the deadline not yet reached.
 */
async function requireActivatableRun(ctx: MutationCtx, args: ActivationArgs) {
  const found = await findBackfillRunProblem(ctx, args);
  const control = await readWriteGate(ctx);
  const { run } = found;
  if (found.problem || !run || !control)
    refuseActivation(found.problem ?? 'the migration run is missing');
  if (!evaluateBackfillCompletion(found, args).isActivationReady)
    refuseActivation(
      'the candidate backfill has not certified this capture; drive it until status reports isActivationReady',
    );
  if (Date.now() >= run.deadline)
    refuseActivation(
      'the maintenance deadline has passed; abort and start a new run',
    );
  return { run, control };
}

/**
 * Design C preconditions 3 to 5: a ready release (F3's readiness; fixture
 * isolation for a fixture selection), the artifact the run recorded at
 * `start`, and the frontend build it recorded.
 */
async function requireActivatableRelease(
  ctx: MutationCtx,
  run: Doc<'initialMigrationRun'>,
  args: ActivationArgs,
) {
  const release = await requireReleaseActivationReadiness(ctx, {
    releaseNumber: args.releaseNumber,
    runId: args.impactRunId,
    schemaIdentity: args.schemaIdentity,
    calculationIdentity: args.calculationIdentity,
    isFixtureOnly: args.isFixtureOnly,
  });
  // Production relies on the QUALIFIED scope the readiness required.
  if (args.isFixtureOnly) await requireCatalogFixtureIsolation(ctx);
  if (release.manifest.artifactFingerprint !== run.catalogManifest)
    refuseActivation(
      `Catalog Release ${release.releaseNumber} is not the catalog manifest this run recorded`,
    );
  if (args.observedFrontendBuild !== run.frontendBuild)
    refuseActivation(
      'the observed frontend build is not the one this run recorded',
    );
  return release;
}

/**
 * Switches the deployment to sheet authority and selects the run's Catalog
 * Release in one transaction (#413 F6a; design C). It runs only while the gate
 * is closed under legacy authority on the current run, before the deadline,
 * with a certified backfill receipt, a ready release whose artifact the run
 * recorded and the frontend build the run recorded. The gate stays closed and
 * the epoch unchanged: publication and reopening are later steps. A repeat with
 * the same arguments returns the recorded activation; any other refuses.
 * Reads a fixed set of control, run and release rows, never Characters.
 */
export const activate = internalMutation({
  args: activationArgs,
  returns: v.object({
    ...runReceipt.fields,
    activation: initialMigrationActivationValidator,
    authority: v.literal('sheet'),
    closed: v.boolean(),
    pendingPublication: v.boolean(),
  }),
  handler: async (ctx, args) => {
    if (
      !args.activationId.trim() ||
      args.activationId.length > catalogReleaseLimits.activationIdentityLength
    )
      refuseActivation('supply a bounded activation identity');
    const recorded = await ctx.db.get('initialMigrationRun', args.runId);
    if (recorded?.state === 'activated')
      return repeatActivation(await readWriteGate(ctx), recorded, args);
    const { run, control } = await requireActivatableRun(ctx, args);
    const release = await requireActivatableRelease(ctx, run, args);
    await selectRelease(ctx, {
      release,
      runId: args.impactRunId,
      activationId: args.activationId,
      schemaIdentity: args.schemaIdentity,
      calculationIdentity: args.calculationIdentity,
      isFixtureOnly: args.isFixtureOnly,
    });
    const activation = {
      activationId: args.activationId,
      captureId: args.captureId,
      releaseNumber: release.releaseNumber,
      impactRunId: args.impactRunId,
      artifactFingerprint: release.manifest.artifactFingerprint,
      schemaIdentity: args.schemaIdentity,
      calculationIdentity: args.calculationIdentity,
      observedFrontendBuild: args.observedFrontendBuild,
      isFixtureOnly: args.isFixtureOnly,
      activatedAt: Date.now(),
    };
    const publication = { cursor: null, published: 0, isDone: false };
    // Backfill workers fence on legacy authority, so they stop here. The epoch
    // stays: only reopening (F6b) advances it.
    await ctx.db.patch('initialMigrationControl', control._id, {
      authority: 'sheet',
    });
    await ctx.db.patch('initialMigrationRun', run._id, {
      state: 'activated',
      activation,
      publication,
    });
    return activationResult({
      run,
      activation,
      publication,
      closed: control.closed,
    });
  },
});
