import type { Doc, Id } from './_generated/dataModel';
import { requireCatalogActivationAuthority } from './lib/catalogFixturePolicy';
import { catalogReleaseLimits } from '../src/lib/catalog/release-limits';
import { ConvexError, v, type Infer } from 'convex/values';
import { internalQuery, type MutationCtx } from './_generated/server';
import type { ReadCtx } from './types';
import { generalInternalMutation } from './lib/writeGate';
import {
  isComparisonBaseCurrent,
  readActiveCatalogRelease,
} from './catalogRelease';
import { evaluateCatalogActivationReadiness } from '../src/lib/catalog/activation-readiness';
import { catalogRuntimeCompatibility } from '../src/lib/catalog/runtime-compatibility';
import { isSupportedCatalogCalculation } from '../src/lib/catalog/calculation-dispatch';
import {
  releaseReportCategories,
  releaseLegalKeys,
} from '../src/lib/catalog/release-schema';
import { readSelectedCatalogBoundary } from './lib/catalogReleaseBoundary';

const activationStatusValidator = v.object({
  releaseNumber: v.number(),
  artifactFingerprint: v.string(),
  impactRunId: v.id('catalogImpactRun'),
  activationId: v.string(),
  schemaIdentity: v.string(),
  calculationIdentity: v.string(),
  isFixtureOnly: v.boolean(),
});

async function activeStatus(ctx: ReadCtx) {
  const { control, release } = await readSelectedCatalogBoundary(ctx);
  if (!control?.impactRunId || !control.activationId || !release) return null;
  return {
    releaseNumber: control.releaseNumber,
    artifactFingerprint: release.manifest.artifactFingerprint,
    impactRunId: control.impactRunId,
    activationId: control.activationId,
    schemaIdentity: control.schemaIdentity,
    calculationIdentity: control.calculationIdentity,
    isFixtureOnly: control.isFixtureOnly ?? false,
  };
}

export const status = internalQuery({
  args: {},
  returns: v.union(v.null(), activationStatusValidator),
  handler: activeStatus,
});

const activationArguments = v.object({
  releaseNumber: v.number(),
  runId: v.id('catalogImpactRun'),
  activationId: v.string(),
  schemaIdentity: v.string(),
  calculationIdentity: v.string(),
  isFixtureOnly: v.boolean(),
});
type ActivationArguments = Infer<typeof activationArguments>;

export const activate = generalInternalMutation({
  args: activationArguments,
  returns: activationStatusValidator,
  handler: async (ctx, args) => {
    if (
      !args.activationId.trim() ||
      args.activationId.length > catalogReleaseLimits.activationIdentityLength
    )
      throw new ConvexError(
        'Catalog activation requires a bounded operation identity',
      );
    await requireCatalogActivationAuthority(ctx, args.isFixtureOnly);
    const selected = await activeStatus(ctx);
    if (selected?.releaseNumber === args.releaseNumber) {
      if (
        selected.impactRunId !== args.runId ||
        selected.activationId !== args.activationId ||
        selected.schemaIdentity !== args.schemaIdentity ||
        selected.calculationIdentity !== args.calculationIdentity ||
        selected.isFixtureOnly !== args.isFixtureOnly
      )
        throw new ConvexError(
          'Catalog activation identity is already bound to a different selection',
        );
      return selected;
    }
    const release = await requireReleaseActivationReadiness(ctx, args);
    await selectRelease(ctx, {
      release,
      runId: args.runId,
      activationId: args.activationId,
      schemaIdentity: args.schemaIdentity,
      calculationIdentity: args.calculationIdentity,
      isFixtureOnly: args.isFixtureOnly,
    });
    const result = await activeStatus(ctx);
    if (!result)
      throw new ConvexError('Catalog activation selection is incomplete');
    return result;
  },
});

async function requireReleaseActivationReadiness(
  ctx: ReadCtx,
  args: ActivationArguments,
) {
  const release = await ctx.db
    .query('catalogRelease')
    .withIndex('by_releaseNumber', (q) =>
      q.eq('releaseNumber', args.releaseNumber),
    )
    .unique();
  if (!release) throw new ConvexError('Catalog Release does not exist');
  const run = await ctx.db.get('catalogImpactRun', args.runId);
  const newest = await ctx.db
    .query('catalogRelease')
    .withIndex('by_releaseNumber')
    .order('desc')
    .first();
  const latestRun = await ctx.db
    .query('catalogImpactRun')
    .withIndex('by_releaseId', (q) => q.eq('releaseId', release._id))
    .order('desc')
    .first();
  const pending = run
    ? await ctx.db
        .query('catalogImpactWork')
        .withIndex('by_runId_and_state', (q) =>
          q.eq('runId', run._id).eq('state', 'dirty'),
        )
        .first()
    : null;
  const failed = run
    ? await ctx.db
        .query('catalogImpactWork')
        .withIndex('by_runId_and_state', (q) =>
          q.eq('runId', run._id).eq('state', 'failed'),
        )
        .first()
    : null;
  const readiness = evaluateCatalogActivationReadiness({
    isPrepared: release.state === 'prepared',
    isBaseCurrent: await isComparisonBaseCurrent(ctx, release.manifest),
    isCandidateCurrent: newest?._id === release._id,
    isRunCurrent:
      run?.releaseId === release._id &&
      latestRun?._id === run?._id &&
      run?.lifecycle === 'ready' &&
      run.baseReleaseNumber === release.baseReleaseNumber,
    isDiscoveryComplete: run?.isDiscoveryComplete ?? false,
    hasDiscoveryFailed: Boolean(run?.discoveryError),
    hasDirtyWork: Boolean(pending),
    hasFailedWork: Boolean(failed),
    hasPassedGates:
      run?.resourceCoverageComplete === true &&
      run.identityCoverageComplete === true &&
      (run.missingIdentityCount ?? 0) === 0 &&
      release.nextBatchIndex === release.batchCount &&
      releaseReportCategories.every((key) =>
        release.reportCategories.includes(key),
      ) &&
      releaseLegalKeys.every((key) => release.legalKeys.includes(key)),
    isCompatible:
      args.schemaIdentity === release.manifest.compatibility.schema &&
      args.schemaIdentity === catalogRuntimeCompatibility.schema &&
      args.calculationIdentity === release.manifest.compatibility.calculation &&
      isSupportedCatalogCalculation(args.calculationIdentity),
  });
  if (!readiness.isReady)
    throw new ConvexError(
      `Catalog activation is not ready: ${readiness.reasons.join(', ')}`,
    );

  return release;
}

async function selectRelease(
  ctx: MutationCtx,
  args: {
    release: Doc<'catalogRelease'>;
    runId: Id<'catalogImpactRun'>;
    activationId: string;
    schemaIdentity: string;
    calculationIdentity: string;
    isFixtureOnly: boolean;
  },
) {
  const { release } = args;
  const control = await readActiveCatalogRelease(ctx);
  const fields = {
    key: 'global' as const,
    releaseNumber: release.releaseNumber,
    releaseId: release._id,
    impactRunId: args.runId,
    activationId: args.activationId,
    schemaIdentity: args.schemaIdentity,
    calculationIdentity: args.calculationIdentity,
    isFixtureOnly: args.isFixtureOnly,
  };
  if (control) await ctx.db.patch('catalogReleaseControl', control._id, fields);
  else await ctx.db.insert('catalogReleaseControl', fields);
  const registration = await ctx.db
    .query('catalogImpactControl')
    .withIndex('by_key', (q) => q.eq('key', 'global'))
    .unique();
  if (registration?.runId === args.runId)
    await ctx.db.delete('catalogImpactControl', registration._id);
}
