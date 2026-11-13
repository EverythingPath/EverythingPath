import { requireCatalogActivationAuthority } from './lib/catalogFixturePolicy';
import { catalogReleaseLimits } from '../src/lib/catalog/release-limits';
import { ConvexError, v } from 'convex/values';
import { internalQuery } from './_generated/server';
import type { ReadCtx } from './types';
import { generalInternalMutation } from './lib/writeGate';
import { readSelectedCatalogBoundary } from './lib/catalogReleaseBoundary';
import {
  requireReleaseActivationReadiness,
  selectRelease,
} from './lib/catalogReleaseSelection';

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
