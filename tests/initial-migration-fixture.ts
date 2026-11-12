import { convexTest } from 'convex-test';
import { vi } from 'vitest';
import { internal } from '../convex/_generated/api';
import type { Id } from '../convex/_generated/dataModel';
import type { MutationCtx } from '../convex/_generated/server';
import schema from '../convex/schema';
import { seedAcceptedCampaign } from '../convex/lib/acceptedCampaignFixture';
import {
  discover,
  prepare,
  scopeSummary,
  type ReleaseTest,
} from './catalog-release-fixture';
import type { ReleaseRow } from '../src/lib/catalog/release-schema';
import { catalogRuntimeCompatibility } from '../src/lib/catalog/runtime-compatibility';

export const frontendBuild = 'build-413';

/**
 * A deployment holding legacy data whose Catalog Release was prepared and
 * reconciled while open (design A steps 3 to 5), then closed by `start` with
 * the release's fingerprint, its candidates captured and validated by the
 * backfill driver (steps 6 and 7). `args` are the matching `activate`
 * arguments. Uses fake timers; the caller restores real ones.
 */
export async function closedAndBackfilled(
  modules: Record<string, () => Promise<unknown>>,
  {
    rows = [scopeSummary('QUALIFIED')],
    catalogManifest,
    maintenanceBudgetMs = 60000,
    drive = true,
    beforeStart,
    whileOpen,
    transactionLimits = false,
  }: {
    rows?: ReleaseRow[];
    catalogManifest?: string;
    maintenanceBudgetMs?: number;
    drive?: boolean;
    beforeStart?: (
      ctx: MutationCtx,
      campaignId: Id<'campaign'>,
    ) => Promise<unknown>;
    /** Runs as the campaign's member after seeding, while the gate is open. */
    whileOpen?: (open: {
      t: ReleaseTest;
      member: ReturnType<ReleaseTest['withIdentity']>;
      seeded: Awaited<ReturnType<typeof seedAcceptedCampaign>>;
    }) => Promise<unknown>;
    /** convex-test's: `true` enforces Convex's transaction limits. */
    transactionLimits?: boolean;
  } = {},
) {
  vi.useFakeTimers();
  const t = convexTest({ schema, modules, transactionLimits });
  const member = t.withIdentity({ tokenIdentifier: 'test|player' });
  const seeded = await member.run((ctx) => seedAcceptedCampaign(ctx));
  if (beforeStart)
    await t.run((ctx) => beforeStart(ctx, seeded.key.campaignId));
  if (whileOpen) await whileOpen({ t, member, seeded });
  const artifact = await prepare(t, rows);
  const impactRunId = await discover(t);
  await t.mutation(internal.catalogReleaseImpact.finish, {
    runId: impactRunId,
  });
  const gate = await t.mutation(internal.initialMigration.start, {
    operationId: 'activation-test',
    expectedEpoch: 0,
    frontendBuild,
    catalogManifest: catalogManifest ?? artifact.manifest.artifactFingerprint,
    maintenanceBudgetMs,
  });
  const receipt = { ...gate, captureId: 'capture' };
  await t.mutation(internal.initialCharacterBackfill.start, receipt);
  if (drive) {
    await t.mutation(internal.initialCharacterBackfill.startDriver, {
      ...receipt,
      driverId: 'driver',
      validationId: 'validation',
      expectedValidationId: null,
      expectedDriverGeneration: 0,
    });
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  }
  const args = {
    ...receipt,
    activationId: 'activate-initial',
    releaseNumber: 1,
    impactRunId,
    schemaIdentity: catalogRuntimeCompatibility.schema,
    calculationIdentity: catalogRuntimeCompatibility.calculation,
    observedFrontendBuild: frontendBuild,
    isFixtureOnly: false,
  };
  return { t, member, seeded, artifact, receipt, args };
}
