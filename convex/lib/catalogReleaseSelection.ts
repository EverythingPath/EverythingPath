import { ConvexError } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import type { ReadCtx } from '../types';
import {
  isComparisonBaseCurrent,
  readActiveCatalogRelease,
} from '../catalogRelease';
import { isCatalogFixtureIsolated } from './catalogFixturePolicy';
import {
  evaluateCatalogActivationReadiness,
  type CatalogActivationReadiness,
  type CatalogScopeQualification,
} from '../../src/lib/catalog/activation-readiness';
import { catalogRuntimeCompatibility } from '../../src/lib/catalog/runtime-compatibility';
import { isInCalculationWindow } from '../../src/lib/catalog/calculation-dispatch';
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
 * Which scope rule applies, from stored state, never from the flag alone: the
 * fixture flag skips the scope only on a deployment holding no ordinary
 * campaign and no private Character, under either authority, so a rehearsal
 * that keeps its flag on a deployment with real data needs a QUALIFIED scope.
 */
async function readActivationKind(
  ctx: ReadCtx,
  releaseId: Id<'catalogRelease'>,
  isFixtureOnly: boolean,
): Promise<CatalogActivationReadiness['activation']> {
  if (isFixtureOnly && (await isCatalogFixtureIsolated(ctx)))
    return { kind: 'fixture' };
  const scope = await readScopeQualification(ctx, releaseId);
  return isFixtureOnly
    ? { kind: 'fixture-beside-ordinary-data', scope }
    : { kind: 'production', scope };
}

/**
 * A release the readiness rule passed, with the selection it was checked for.
 * Only `requireReleaseActivationReadiness` makes one (the class is not
 * exported and its private field refuses any other object), and
 * `selectRelease` takes nothing else, so no caller selects a release without
 * the scope check.
 */
class ReadyCatalogRelease {
  readonly #release: Doc<'catalogRelease'>;
  readonly #selection: Omit<CatalogReleaseSelection, 'activationId'>;
  constructor(
    release: Doc<'catalogRelease'>,
    selection: Omit<CatalogReleaseSelection, 'activationId'>,
  ) {
    this.#release = release;
    this.#selection = selection;
  }
  get release() {
    return this.#release;
  }
  get selection() {
    return this.#selection;
  }
}

/**
 * Refuses, naming every unmet reason, unless the release is the newest
 * prepared one on the current base with a sealed current impact run, no dirty
 * or failed work, every identity allocated, its legal and report categories,
 * a supported calculation and, unless it is a fixture selection on a
 * deployment holding only fixture data, a QUALIFIED scope. Reads a fixed set
 * of indexed single rows, at most one Character.
 * A release whose own staged evidence names a not-established rule-value
 * record is ready only for that same fixture selection on fixture-isolated
 * data, whatever the authority and its scope report (stats-d1 fix r3).
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
      isInCalculationWindow(args.calculationIdentity),
    activation: await readActivationKind(ctx, release._id, args.isFixtureOnly),
    ...(release.notEstablishedRuleValues && {
      notEstablishedRuleValues: release.notEstablishedRuleValues,
    }),
  });
  if (!readiness.isReady)
    throw new ConvexError(
      `Catalog activation is not ready: ${readiness.reasons.join(', ')}`,
    );

  return new ReadyCatalogRelease(release, args);
}

/**
 * Selects a release the readiness rule passed, exactly as it was checked, and
 * retires its impact registration. The only writer of the selection.
 */
export async function selectRelease(
  ctx: MutationCtx,
  ready: ReadyCatalogRelease,
  activationId: string,
) {
  const { release, selection } = ready;
  const control = await readActiveCatalogRelease(ctx);
  const fields = {
    key: 'global' as const,
    releaseNumber: release.releaseNumber,
    releaseId: release._id,
    impactRunId: selection.runId,
    activationId,
    schemaIdentity: selection.schemaIdentity,
    calculationIdentity: selection.calculationIdentity,
    isFixtureOnly: selection.isFixtureOnly,
  };
  if (control) await ctx.db.patch('catalogReleaseControl', control._id, fields);
  else await ctx.db.insert('catalogReleaseControl', fields);
  const registration = await ctx.db
    .query('catalogImpactControl')
    .withIndex('by_key', (q) => q.eq('key', 'global'))
    .unique();
  if (registration?.runId === selection.runId)
    await ctx.db.delete('catalogImpactControl', registration._id);
}
