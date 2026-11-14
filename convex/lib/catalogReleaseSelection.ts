import { ConvexError } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import type { ReadCtx } from '../types';
import {
  isComparisonBaseCurrent,
  readActiveCatalogRelease,
} from '../catalogRelease';
import {
  evaluateCatalogActivationReadiness,
  type CatalogScopeQualification,
} from '../../src/lib/catalog/activation-readiness';
import { catalogRuntimeCompatibility } from '../../src/lib/catalog/runtime-compatibility';
import { isSupportedCatalogCalculation } from '../../src/lib/catalog/calculation-dispatch';
import {
  isObject,
  releaseReportCategories,
  releaseLegalKeys,
} from '../../src/lib/catalog/release-schema';

/**
 * The one readiness and selection rule a Catalog Release is selected by, shared
 * by the catalog release path (`catalogReleaseActivation:activate`) and the
 * initial sheet activation (`initialMigration:activate`). Neither function
 * decides who may select: each caller checks its own authority first.
 */
export type CatalogReleaseSelection = {
  releaseNumber: number;
  runId: Id<'catalogImpactRun'>;
  activationId: string;
  schemaIdentity: string;
  calculationIdentity: string;
  isFixtureOnly: boolean;
};

/**
 * The release's scope qualification from its `content:scope` summary row
 * (`{ binding, qualification }`, as a scoped build stages it). A release built
 * without a scope, or whose row lacks the scope version or status, is
 * unreported, which production activation treats as not qualified.
 */
async function readScopeQualification(
  ctx: ReadCtx,
  releaseId: Id<'catalogRelease'>,
): Promise<CatalogScopeQualification> {
  const row = await ctx.db
    .query('catalogReleaseRow')
    .withIndex('by_releaseId_and_kind_and_key', (q) =>
      q
        .eq('releaseId', releaseId)
        .eq('kind', 'report')
        .eq('key', 'content:scope'),
    )
    .unique();
  const payload: unknown = row?.payload;
  if (!isObject(payload)) return { kind: 'unreported' };
  const { binding, qualification } = payload;
  if (!isObject(binding) || !isObject(qualification))
    return { kind: 'unreported' };
  const { version } = binding;
  const { status } = qualification;
  if (typeof version !== 'string' || typeof status !== 'string')
    return { kind: 'unreported' };
  return { kind: 'reported', version, status };
}

/**
 * Refuses, naming every unmet reason, unless the release is the newest
 * prepared one on the current base with a sealed current impact run, no dirty
 * or failed work, every identity allocated, its legal and report categories,
 * a supported calculation and, for a production selection, a QUALIFIED scope.
 * Reads a fixed set of indexed single rows, never Characters.
 */
export async function requireReleaseActivationReadiness(
  ctx: ReadCtx,
  args: Omit<CatalogReleaseSelection, 'activationId'>,
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
    activation: args.isFixtureOnly
      ? { kind: 'fixture' }
      : {
          kind: 'production',
          scope: await readScopeQualification(ctx, release._id),
        },
  });
  if (!readiness.isReady)
    throw new ConvexError(
      `Catalog activation is not ready: ${readiness.reasons.join(', ')}`,
    );

  return release;
}

/** Selects a ready release and retires its impact registration. */
export async function selectRelease(
  ctx: MutationCtx,
  args: Omit<CatalogReleaseSelection, 'releaseNumber'> & {
    release: Doc<'catalogRelease'>;
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
