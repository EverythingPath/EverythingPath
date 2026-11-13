import { ConvexError, v, type Infer } from 'convex/values';
import {
  internalMutation,
  internalQuery,
  query,
  type MutationCtx,
} from './_generated/server';
import type { Doc } from './_generated/dataModel';
import { internal } from './_generated/api';
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
  initialMigrationPassedSmokeValidator,
  initialMigrationPublicationValidator,
  initialMigrationSmokeValidator,
} from './schema';
import {
  findSmokeProblems,
  publishPage,
  refusePublication,
  type SheetRun,
} from './lib/initialMigrationPublication';
import { catalogReleaseLimits } from '../src/lib/catalog/release-limits';
import { COMPUTED_HIT_DICE_RULESET_VERSION } from '../src/lib/ruleset-versions';
import {
  DEVELOPMENT_FRONTEND_BUILD,
  SHEET_CLIENT_CONTRACT,
} from '../src/lib/client-compatibility';
import { weeklyRulesetVersion } from './lib/weeklyRulesetVersion';

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

const clientStatusValidator = v.union(
  v.object({
    status: v.literal('ready'),
    epoch: v.number(),
    authority: v.union(v.literal('legacy'), v.literal('sheet')),
    rulesetVersion: v.number(),
  }),
  v.object({ status: v.literal('maintenance'), epoch: v.number() }),
  v.object({
    status: v.literal('reload_required'),
    epoch: v.number(),
    reason: v.literal('client_contract'),
  }),
);

/**
 * What a browser may do (#413 F6c; design E). A closed gate or a paused
 * weekly cutover gives `maintenance`. Under legacy authority every client is
 * `ready`, as before F6c. Under sheet authority, open only after `reopen`, a
 * tab is `ready` only with the `clientContract` this backend was compiled
 * with (`SHEET_CLIENT_CONTRACT`); a bundle from before F6c sends none and gets
 * `reload_required`. `ready` names the authority and the Ruleset Version
 * Weekly Resolution uses, for client previews. Tabs compare the epoch
 * themselves: one first loaded at another epoch reloads.
 */
export const clientStatus = query({
  args: { clientContract: v.optional(v.number()) },
  returns: clientStatusValidator,
  handler: async (ctx, args): Promise<Infer<typeof clientStatusValidator>> => {
    const control = await readWriteGate(ctx);
    const paused = (await readCutover(ctx))?.status === 'paused';
    const epoch = control?.epoch ?? 0;
    if (control?.closed || paused) return { status: 'maintenance', epoch };
    if (control?.authority !== 'sheet')
      return {
        status: 'ready',
        epoch,
        authority: 'legacy',
        rulesetVersion: weeklyRulesetVersion(control, null),
      };
    if (args.clientContract !== SHEET_CLIENT_CONTRACT)
      return { status: 'reload_required', epoch, reason: 'client_contract' };
    return {
      status: 'ready',
      epoch,
      authority: 'sheet',
      rulesetVersion: weeklyRulesetVersion(
        control,
        await ctx.db.get('initialMigrationRun', control.runId),
      ),
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
        smoke: v.union(v.null(), initialMigrationSmokeValidator),
      }),
      v.object({
        ...runStatusFields,
        state: v.literal('reopened'),
        activation: initialMigrationActivationValidator,
        publication: initialMigrationPublicationValidator,
        smoke: initialMigrationPassedSmokeValidator,
        reopenedAt: v.number(),
      }),
      v.object({
        ...runStatusFields,
        state: v.literal('repairing'),
        activation: initialMigrationActivationValidator,
        publication: initialMigrationPublicationValidator,
        smoke: v.union(v.null(), initialMigrationSmokeValidator),
        reopenedAt: v.number(),
        closedForRepairAt: v.number(),
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
        smoke: run.smoke,
      };
    case 'reopened':
      return {
        ...fields,
        state: run.state,
        activation: run.activation,
        publication: run.publication,
        smoke: run.smoke,
        reopenedAt: run.reopenedAt,
      };
    case 'repairing':
      return {
        ...fields,
        state: run.state,
        activation: run.activation,
        publication: run.publication,
        smoke: run.smoke,
        reopenedAt: run.reopenedAt,
        closedForRepairAt: run.closedForRepairAt,
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
type ActivatedRun = SheetRun;

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
 * `start`, and the frontend build it recorded, a commit's unless fixture-only.
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
  // A development build's identity matches any other development build.
  if (!args.isFixtureOnly && run.frontendBuild === DEVELOPMENT_FRONTEND_BUILD)
    refuseActivation(
      'a development frontend build has no commit identity; only a fixture-only activation accepts it',
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
    if (
      recorded?.state === 'activated' ||
      recorded?.state === 'reopened' ||
      recorded?.state === 'repairing'
    )
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
    const activation: Activation = {
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
      // Weekly Resolution switches with authority (#413 f6b2).
      rulesetVersion: COMPUTED_HIT_DICE_RULESET_VERSION,
    };
    const publication = {
      cursor: null,
      nextPage: 0,
      published: 0,
      isDone: false,
    };
    // Backfill workers fence on legacy authority, so they stop here. The epoch
    // stays: only reopening (F6b) advances it.
    await ctx.db.patch('initialMigrationControl', control._id, {
      authority: 'sheet',
    });
    await ctx.db.patch('initialMigrationRun', run._id, {
      state: 'activated',
      activation,
      publication,
      smoke: null,
    });
    return activationResult({
      run,
      activation,
      publication,
      closed: control.closed,
    });
  },
});

type SheetStage = SheetRun['state'];

/**
 * The run and control row an operator step after activation acts on: the
 * current run under sheet authority at the expected Write Epoch, in one of
 * the stages the step names, with the gate closed or open as it needs.
 * Anything else, an open legacy deployment included, refuses by `refuse`.
 */
async function requireSheetRun<Stage extends SheetStage>(
  ctx: MutationCtx,
  args: { runId: Doc<'initialMigrationRun'>['_id']; epoch: number },
  expected: {
    closed: boolean;
    stages: readonly Stage[];
    refuse: (reason: string) => never;
  },
) {
  // A never-returning call narrows only through an explicitly typed name.
  const { closed, stages } = expected;
  const control = await readWriteGate(ctx);
  const run = await ctx.db.get('initialMigrationRun', args.runId);
  if (control?.authority !== 'sheet')
    expected.refuse('the deployment is not under sheet authority');
  if (control.runId !== args.runId || !run)
    expected.refuse('the run is not the current Migration Run');
  if (control.epoch !== args.epoch)
    expected.refuse('the Write Epoch changed; inspect initialMigration:status');
  if (control.closed !== closed)
    expected.refuse(closed ? 'the gate is open' : 'the gate is closed');
  if (!isInStage(run, stages)) expected.refuse(`the run is ${run.state}`);
  return { control, run };
}

function isInStage<Stage extends SheetStage>(
  run: Doc<'initialMigrationRun'>,
  stages: readonly Stage[],
): run is Extract<SheetRun, { state: Stage }> {
  return stages.some((stage) => stage === run.state);
}

const sheetRunArgs = runReceipt.fields;

/**
 * The epoch a gate step already produced, for a repeat after a lost response:
 * the run is in the stage the step leaves and the gate one epoch later, in
 * the state the step leaves it. Otherwise null.
 */
async function repeatedStep(
  ctx: MutationCtx,
  args: { runId: Doc<'initialMigrationRun'>['_id']; epoch: number },
  leaves: { state: 'reopened' | 'repairing'; closed: boolean },
) {
  const control = await readWriteGate(ctx);
  const run = await ctx.db.get('initialMigrationRun', args.runId);
  const isRepeat =
    run?.state === leaves.state &&
    control?.runId === run._id &&
    control.authority === 'sheet' &&
    control.closed === leaves.closed &&
    control.epoch === args.epoch + 1;
  return isRepeat ? { epoch: control.epoch } : null;
}

/**
 * Publishes the activated run's candidates as live sheets while the gate stays
 * closed (#413 F6b; design C). Each call publishes the page the run expects
 * and schedules the next until every candidate is published. A page already
 * published (a lost response, a duplicate continuation) returns the recorded
 * progress and schedules nothing; a page ahead of it refuses. To resume after
 * an interrupted chain, pass `initialMigration:status`'s `publication.nextPage`.
 */
export const publish = internalMutation({
  args: { ...sheetRunArgs, activationId: v.string(), page: v.number() },
  returns: initialMigrationPublicationValidator,
  handler: async (ctx, args) => {
    const { run } = await requireSheetRun(ctx, args, {
      closed: true,
      stages: ['activated'],
      refuse: refusePublication,
    });
    if (run.activation.activationId !== args.activationId)
      refusePublication("the activation identity is not the run's");
    const { publication } = run;
    if (!Number.isSafeInteger(args.page) || args.page > publication.nextPage)
      refusePublication(
        'the page sequence changed; inspect initialMigration:status',
      );
    if (publication.isDone || args.page < publication.nextPage)
      return publication;
    const next = await publishPage(ctx, run);
    await ctx.db.patch('initialMigrationRun', run._id, { publication: next });
    if (!next.isDone)
      await ctx.scheduler.runAfter(0, internal.initialMigration.publish, {
        ...args,
        page: next.nextPage,
      });
    return next;
  },
});

function refuseSmoke(reason: string): never {
  throw new ConvexError(`Smoke check refused: ${reason}.`);
}

/**
 * The read-only check of an activated, published deployment while it is
 * closed (#413 F6b; root decision 4). It writes only its result on the run,
 * which reopening requires to have passed at the current Write Epoch. A check
 * that finds problems records them and leaves the deployment closed under
 * sheet authority; rerun it after deploying a fix.
 */
export const smoke = internalMutation({
  args: { ...sheetRunArgs, smokeId: v.string() },
  returns: initialMigrationSmokeValidator,
  handler: async (ctx, args) => {
    if (!args.smokeId.trim() || args.smokeId.length > 64)
      refuseSmoke('supply a bounded smoke identity');
    const { control, run } = await requireSheetRun(ctx, args, {
      closed: true,
      stages: ['activated', 'repairing'],
      refuse: refuseSmoke,
    });
    if (!run.publication.isDone)
      refuseSmoke('publish every candidate before the smoke check');
    const problems = await findSmokeProblems(ctx, run);
    const fields = {
      smokeId: args.smokeId,
      epoch: control.epoch,
      checkedAt: Date.now(),
    };
    const smoke = problems.length
      ? { ...fields, outcome: 'failed' as const, problems }
      : { ...fields, outcome: 'passed' as const };
    await ctx.db.patch('initialMigrationRun', run._id, { smoke });
    return smoke;
  },
});

function refuseReopen(reason: string): never {
  throw new ConvexError(`Reopen refused: ${reason}.`);
}

/**
 * Opens the gate under sheet authority (#413 F6b): the run's candidates are
 * all published, a smoke check passed at this Write Epoch and the observed
 * frontend build is the run's. It advances the epoch, so every earlier tab
 * reloads; a fresh tab with the current client contract is `ready`. A
 * repeat after a lost response returns the epoch it opened; a delayed one
 * after a later closure refuses.
 */
export const reopen = internalMutation({
  args: { ...sheetRunArgs, observedFrontendBuild: v.string() },
  returns: v.object({ epoch: v.number() }),
  handler: async (ctx, args) => {
    const repeat = await repeatedStep(ctx, args, {
      state: 'reopened',
      closed: false,
    });
    if (repeat) return repeat;
    const { control: current, run } = await requireSheetRun(ctx, args, {
      closed: true,
      stages: ['activated', 'repairing'],
      refuse: refuseReopen,
    });
    const smoke = requireReopenable(run, args);
    const epoch = args.epoch + 1;
    await ctx.db.patch('initialMigrationControl', current._id, {
      closed: false,
      epoch,
    });
    await ctx.db.replace('initialMigrationRun', run._id, {
      ...withoutStage(run),
      state: 'reopened',
      activation: run.activation,
      publication: run.publication,
      smoke,
      reopenedAt: Date.now(),
    });
    return { epoch };
  },
});

/** Reopening's own preconditions; returns the passed smoke check. */
function requireReopenable(
  run: Extract<SheetRun, { state: 'activated' | 'repairing' }>,
  args: { epoch: number; observedFrontendBuild: string },
) {
  if (!run.publication.isDone)
    refuseReopen('publish every candidate before reopening');
  const { smoke } = run;
  if (smoke?.outcome !== 'passed' || smoke.epoch !== args.epoch)
    refuseReopen('run a passing smoke check at this Write Epoch first');
  if (args.observedFrontendBuild !== run.frontendBuild)
    refuseReopen(
      'the observed frontend build is not the one this run recorded',
    );
  return smoke;
}

function refuseRepairClosure(reason: string): never {
  throw new ConvexError(`Repair closure refused: ${reason}.`);
}

/**
 * Closes a reopened deployment again for a forward repair, keeping sheet
 * authority and every edit made since reopening (#413 F6b; design D9). It
 * advances the epoch and clears the smoke result, so reopening needs a new
 * passing check. A repeat after a lost response returns the epoch it closed.
 */
export const closeForRepair = internalMutation({
  args: sheetRunArgs,
  returns: v.object({ epoch: v.number() }),
  handler: async (ctx, args) => {
    const repeat = await repeatedStep(ctx, args, {
      state: 'repairing',
      closed: true,
    });
    if (repeat) return repeat;
    const { control: current, run } = await requireSheetRun(ctx, args, {
      closed: false,
      stages: ['reopened'],
      refuse: refuseRepairClosure,
    });
    const epoch = args.epoch + 1;
    await ctx.db.patch('initialMigrationControl', current._id, {
      closed: true,
      epoch,
    });
    await ctx.db.replace('initialMigrationRun', run._id, {
      ...withoutStage(run),
      state: 'repairing',
      activation: run.activation,
      publication: run.publication,
      smoke: null,
      reopenedAt: run.reopenedAt,
      closedForRepairAt: Date.now(),
    });
    return { epoch };
  },
});

/** A run's fields that every stage shares, to replace it with another stage. */
function withoutStage(run: SheetRun) {
  return {
    operationId: run.operationId,
    epoch: run.epoch,
    frontendBuild: run.frontendBuild,
    catalogManifest: run.catalogManifest,
    startedAt: run.startedAt,
    deadline: run.deadline,
    ...(run.backfill ? { backfill: run.backfill } : {}),
  };
}
