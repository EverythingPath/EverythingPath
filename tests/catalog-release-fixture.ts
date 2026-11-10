import { convexTest, type TestConvex } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import { expect } from 'vitest';
import { api, internal } from '../convex/_generated/api';
import type { Id } from '../convex/_generated/dataModel';
import schema from '../convex/schema';
import { buildCatalogRelease } from '../scripts/catalog/release';
import type { CatalogReleaseImpactCommandAdapter } from '../scripts/catalog/release-impact-command';
import resourcesData from '../src/lib/catalog/data/resources.json';
import { buildLegalPageData } from '../src/lib/catalog/legal-page-data';
import { legalResourcesSchema } from '../src/lib/catalog/legal-types';
import type { ReleaseRow } from '../src/lib/catalog/release-schema';
import type { CatalogReleaseStatus } from '../src/lib/catalog/release-validators';
import { catalogRuntimeCompatibility } from '../src/lib/catalog/runtime-compatibility';

/**
 * Shared Catalog Release integration fixture: an isolated fixture campaign,
 * its owner, an outsider, and private preparation, discovery and activation
 * helpers over the internal operator functions.
 */
export type ReleaseTest = TestConvex<typeof schema>;

const writeBatch = makeFunctionReference<
  'mutation',
  { releaseNumber: number; batchIndex: number; rows: unknown },
  CatalogReleaseStatus
>('catalogRelease:writeBatch');

export async function releaseFixture(
  modules: Record<string, () => Promise<unknown>>,
) {
  const t = convexTest(schema, modules);
  const campaignId = await t.run(async (ctx) => {
    await ctx.db.insert('user', {
      tokenIdentifier: 'test|owner',
      orgIds: [{ orgId: 'org', role: 'member' }],
    });
    await ctx.db.insert('user', {
      tokenIdentifier: 'test|outsider',
      orgIds: [{ orgId: 'elsewhere', role: 'member' }],
    });
    return ctx.db.insert('campaign', {
      name: 'Activation fixture',
      description: '',
      organizationId: 'org',
      ownerId: 'test|owner',
      e2eFixture: {
        namespace: 'activation',
        version: 1,
        workerKey: '0',
        caseKey: 'activation',
        campaignKey: 'activation',
      },
    });
  });
  const owner = t.withIdentity({ tokenIdentifier: 'test|owner' });
  const outsider = t.withIdentity({ tokenIdentifier: 'test|outsider' });
  const create = (name: string) =>
    owner.mutation(api.characterSheet.create, {
      organizationId: 'org',
      campaignId,
      name,
      kind: 'pc',
      operationId: `create-${name}`,
    });
  const characterId = await create('Vessa');
  return {
    t,
    owner,
    outsider,
    campaignId,
    create,
    scope: { organizationId: 'org', characterId },
  };
}

/** Prepares a numbered release with passing reports and the committed legal data. */
export async function prepare(
  t: ReleaseTest,
  rows: ReleaseRow[] = [],
  releaseNumber = 1,
  baseRelease: Parameters<typeof buildCatalogRelease>[0]['baseRelease'] = null,
  calculationIdentity: string = catalogRuntimeCompatibility.calculation,
) {
  const notices = buildLegalPageData({
    registry: {},
    resources: legalResourcesSchema.parse(resourcesData),
    requiredNotices: [],
    permanentNoticeSuperset: [],
  }).permanentNoticeSuperset;
  const artifact = await buildCatalogRelease({
    releaseNumber,
    baseRelease,
    compatibility: {
      ...catalogRuntimeCompatibility,
      calculation: calculationIdentity,
    },
    inputs: {
      upstream: {},
      remaps: {},
      curation: {},
      localData: {},
      parsers: {},
      sanitizers: {},
      ruleResources: {},
      legal: {},
      attribution: {},
    },
    rows: [
      ...rows,
      ...['content', 'resources', 'holds', 'retirement', 'curation'].map(
        (key) => ({
          kind: 'report' as const,
          key,
          payload: { gatePassed: true, coverageComplete: true, passed: true },
        }),
      ),
      { kind: 'legal', key: 'requiredNotices', payload: [] },
      { kind: 'legal', key: 'permanentNoticeSuperset', payload: notices },
      { kind: 'legal', key: 'registry', payload: {} },
      { kind: 'legal', key: 'resources', payload: resourcesData },
    ],
  });
  await t.mutation(internal.catalogRelease.begin, {
    manifest: artifact.manifest,
  });
  for (const [batchIndex, batch] of artifact.batches.entries())
    await t.mutation(writeBatch, { releaseNumber, batchIndex, rows: batch });
  await t.mutation(internal.catalogRelease.finalize, { releaseNumber });
  return artifact;
}

/** Starts an impact run and completes its discovery. */
export async function discover(t: ReleaseTest, releaseNumber = 1) {
  const runId = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber,
  });
  for (let step = 0; step < 100; step++)
    if (await t.mutation(internal.catalogReleaseImpact.discover, { runId }))
      break;
  return runId;
}

/** Reconciles one Character and seals the run. */
export async function reconcile(
  t: ReleaseTest,
  characterId: Id<'character'>,
  releaseNumber = 1,
) {
  const runId = await discover(t, releaseNumber);
  const evaluation = await t.query(internal.catalogReleaseImpact.evaluate, {
    runId,
    characterId,
  });
  expect(
    await t.mutation(internal.catalogReleaseImpact.complete, {
      runId,
      characterId,
      evaluation,
    }),
  ).toBe(true);
  expect(
    await t.mutation(internal.catalogReleaseImpact.finish, { runId }),
  ).toBe(true);
  return runId;
}

export function activationArgs(
  runId: Id<'catalogImpactRun'>,
  releaseNumber = 1,
) {
  return {
    releaseNumber,
    runId,
    activationId: `activate-${releaseNumber}`,
    schemaIdentity: catalogRuntimeCompatibility.schema,
    calculationIdentity: catalogRuntimeCompatibility.calculation,
    isFixtureOnly: true,
  };
}

/** The impact operator command's adapter over the registered private functions. */
export function impactAdapter(
  t: ReleaseTest,
): CatalogReleaseImpactCommandAdapter {
  return {
    start: (args) => t.mutation(internal.catalogReleaseImpact.start, args),
    discover: (args) =>
      t.mutation(internal.catalogReleaseImpact.discover, args),
    evaluate: (args) => t.query(internal.catalogReleaseImpact.evaluate, args),
    complete: (args) =>
      t.mutation(internal.catalogReleaseImpact.complete, args),
    status: (args) => t.query(internal.catalogReleaseImpact.status, args),
    inspectWork: (args) =>
      t.query(internal.catalogReleaseImpact.inspectWork, args),
    retry: (args) => t.mutation(internal.catalogReleaseImpact.retry, args),
    retryDiscovery: (args) =>
      t.mutation(internal.catalogReleaseImpact.retryDiscovery, args),
    finish: (args) => t.mutation(internal.catalogReleaseImpact.finish, args),
  };
}
