// @vitest-environment edge-runtime
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { convexTest } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import { afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { z } from 'zod';
import { refuseRepeatedPaginatedQueries } from '../tests/convex-paginated-queries';
import { preloadCalledConvexModules } from '../tests/convex-modules';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { impactAdapter } from '../tests/catalog-release-fixture';
import {
  deploymentFixture,
  fixtureCredentials,
} from '../e2e/support/test-data';
import type { FixtureScope } from '../e2e/fixtures/catalog';
import { releaseQualification } from '../e2e/fixtures/release';
import {
  materializeReleaseSources,
  releaseBuildArguments,
} from '../e2e/support/release-artifact';
import { runCatalogReleaseOperator } from '../scripts/catalog/release-operator';
import type { CatalogReleaseActivationCommandAdapter } from '../scripts/catalog/release-activation-command';
import { catalogRuntimeCompatibility } from '../src/lib/catalog/runtime-compatibility';
import type { ReleaseRow } from '../src/lib/catalog/release-schema';
import type { CatalogReleaseStatus } from '../src/lib/catalog/release-validators';
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import schema from './schema';

// The server side of the release-qualification suite (#753), against
// convex-test instead of the E2E preview: the suite's own fixture case, its
// bounded artifact built by the documented command, and the operator's
// prepare, reconcile, activate and active commands over the same internal
// functions. The browser journey then repeats the last part on the preview.

const modules = import.meta.glob('./**/*.ts');
beforeAll(() => refuseRepeatedPaginatedQueries(schema, modules));
preloadCalledConvexModules({ modules, testFile: import.meta.url });

const scope: FixtureScope = {
  namespace: deploymentFixture.namespace,
  version: 1,
  workerKey: 'worker-0',
  caseKey: 'catalogRelease',
  ...fixtureCredentials,
};
const gm = `https://${deploymentFixture.clerkHost}|user_gm`;
const organizationId = 'org_members';
const { feat } = releaseQualification;

let directory: string;
beforeEach(async () => {
  vi.stubEnv('E2E_ENABLED', 'true');
  vi.stubEnv('E2E_FIXTURE_CONFIG', JSON.stringify(deploymentFixture));
  vi.stubEnv('CONVEX_CLOUD_URL', deploymentFixture.convexUrl);
  directory = await mkdtemp(join(tmpdir(), 'release-qualification-'));
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});

const beginBoundary = makeFunctionReference<
  'mutation',
  { manifest: unknown; writeEpoch?: number },
  CatalogReleaseStatus
>('catalogRelease:begin');
const writeBatchBoundary = makeFunctionReference<
  'mutation',
  { releaseNumber: number; batchIndex: number; rows: ReleaseRow[] },
  CatalogReleaseStatus
>('catalogRelease:writeBatch');

const inspected = z.object({
  characterIds: z.tuple([z.string(), z.string()]),
  releaseWork: z
    .array(
      z.object({
        character: z.string(),
        state: z.string().nullable(),
        reasons: z.array(z.string()),
        hasFactsChanged: z.boolean().nullable(),
      }),
    )
    .optional(),
});

async function build() {
  const sources = await materializeReleaseSources(join(directory, 'sources'));
  const artifactPath = join(directory, 'artifact', 'release.json');
  const built = z
    .object({ manifest: z.object({ artifactFingerprint: z.string() }) })
    .parse(
      await runCatalogReleaseOperator({
        args: releaseBuildArguments({
          ...sources,
          artifactPath,
          ...catalogRuntimeCompatibility,
        }),
      }),
    );
  return { artifactPath, fingerprint: built.manifest.artifactFingerprint };
}

test('the qualification release prepares, reconciles a seeded Character that holds its feat, activates fixture-only, and a fixture Character then takes the feat for +3 Acrobatics', async () => {
  const t = convexTest(schema, modules);
  await t.mutation(internal.e2eFixtures.seedIdentityProjection, scope);
  await t.mutation(internal.e2eFixtures.resetCase, { ...scope, now: 0 });
  // A global feat the release neither admits nor retires (Dodge, CRB p. 122,
  // as a bodiless stand-in like the admitted feat's).
  const outsideKey = 'pf1/outside-the-release-dodge';
  await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'Dodge',
      ruleIdentity: outsideKey,
      sources: [],
      modifiers: [],
      stacksWithItself: false,
      detail: { kind: 'feat' },
    }),
  );
  // Under legacy authority with no active release, the read offers every
  // global it finds, as the class picker always has.
  const offeredKeys = async () => {
    const { characterIds } = inspected
      .pick({ characterIds: true })
      .parse(await t.query(internal.e2eFixtures.inspectCase, scope));
    const sheet = await t
      .withIdentity({ tokenIdentifier: gm })
      .query(api.characterSheet.read, {
        organizationId,
        characterId: characterIds[0] as Id<'character'>,
      });
    return (sheet?.catalogView?.definitions ?? []).map(
      (row) => row.ruleIdentity,
    );
  };
  expect(await offeredKeys()).toEqual(
    expect.arrayContaining([outsideKey, feat.externalKey]),
  );

  const { artifactPath, fingerprint } = await build();
  // A second build of the same inputs gives the same artifact.
  await rm(join(directory, 'sources'), { recursive: true });
  await expect(build()).resolves.toEqual({ artifactPath, fingerprint });

  const prepared = await runCatalogReleaseOperator({
    args: ['prepare', '--artifact', artifactPath],
    adapter: {
      begin: (args) => t.mutation(beginBoundary, args),
      writeBatch: (args) => t.mutation(writeBatchBoundary, args),
      finalize: (args) => t.mutation(internal.catalogRelease.finalize, args),
      inspect: (args) => t.query(internal.catalogRelease.inspect, args),
    },
  });
  expect(prepared).toMatchObject({ releaseNumber: 1, state: 'prepared' });

  const reconciled = z
    .object({
      runId: z.string(),
      status: z.object({
        isReady: z.literal(true),
        pendingCount: z.literal(0),
        failedCount: z.literal(0),
        missingIdentityCount: z.literal(0),
        identityCoverageComplete: z.literal(true),
      }),
      stopped: z.literal('ready'),
    })
    .parse(
      await runCatalogReleaseOperator({
        args: ['reconcile', '--number', '1'],
        impactAdapter: impactAdapter(t),
      }),
    );
  const runId = reconciled.runId as Id<'catalogImpactRun'>;
  const { releaseWork } = inspected.parse(
    await t.query(internal.e2eFixtures.inspectCase, {
      ...scope,
      releaseRunId: runId,
    }),
  );
  // The Character holding the feat was evaluated because the release changes
  // that feat; the journey's Character holds nothing the release changes.
  expect(releaseWork).toEqual([
    {
      character: 'E2E catalog-release-character',
      state: 'unaffected',
      reasons: [],
      hasFactsChanged: null,
    },
    {
      character: releaseQualification.reconciledCharacter,
      state: 'ready',
      reasons: expect.arrayContaining([`key:${feat.externalKey}`]),
      // Acrobatics is no Militia Character Fact.
      hasFactsChanged: false,
    },
  ]);

  const activationAdapter: CatalogReleaseActivationCommandAdapter = {
    activate: (
      args: Parameters<CatalogReleaseActivationCommandAdapter['activate']>[0],
    ) =>
      t.mutation(internal.catalogReleaseActivation.activate, {
        ...args,
        runId: args.runId as Id<'catalogImpactRun'>,
      }),
    status: () => t.query(internal.catalogReleaseActivation.status, {}),
  };
  const activation = await runCatalogReleaseOperator({
    args: [
      'activate',
      '--number',
      '1',
      '--run-id',
      runId,
      '--operation-id',
      releaseQualification.activationId,
      '--schema',
      catalogRuntimeCompatibility.schema,
      '--calculation',
      catalogRuntimeCompatibility.calculation,
      '--fixture-only',
      '--target-kind',
      'preview',
    ],
    activationAdapter,
  });
  const active = await runCatalogReleaseOperator({
    args: ['active'],
    activationAdapter,
  });
  expect(active).toEqual(activation);
  expect(active).toMatchObject({
    releaseNumber: 1,
    artifactFingerprint: fingerprint,
    impactRunId: runId,
    isFixtureOnly: true,
  });

  // The journey resets its case under the active release, as every browser
  // attempt does, then takes the feat from the picker's definitions.
  const { campaignId } = await t.mutation(internal.e2eFixtures.resetCase, {
    ...scope,
    now: 0,
  });
  const {
    characterIds: [journeyId, reconciledId],
  } = inspected.parse(await t.query(internal.e2eFixtures.inspectCase, scope));
  const owner = t.withIdentity({ tokenIdentifier: gm });
  const read = async (characterId: string) => {
    const sheet = withSheetCatalog(
      await owner.query(api.characterSheet.read, {
        organizationId,
        characterId: characterId as Id<'character'>,
      }),
    );
    if (!sheet) throw new Error('Missing sheet');
    return sheet;
  };
  const acrobatics = async (characterId: string) =>
    (await read(characterId)).calculated.breakdowns[feat.skill.target]?.total;
  expect(await acrobatics(reconciledId)).toBe(feat.bonus);
  // The +3 is the release body's (#724's rank formula): the global stand-in
  // itself carries no Modifier.
  expect(
    await t.run((ctx) =>
      ctx.db
        .query('catalogEntry')
        .withIndex('by_scope_and_ruleIdentity', (q) =>
          q.eq('scope', 'global').eq('ruleIdentity', feat.externalKey),
        )
        .unique(),
    ),
  ).toMatchObject({ modifiers: [] });

  const sheet = await read(journeyId);
  expect(sheet.catalogView?.releaseNumber).toBe(1);
  const offered = sheet.catalogView?.definitions.find(
    (row) => row.ruleIdentity === feat.externalKey,
  );
  expect(offered).toMatchObject({ name: feat.name, scope: 'global' });
  if (!offered) throw new Error('The admitted feat is not offered');
  // Under the active release only what it admits (or retires, marked) is
  // offered: the global outside it is not.
  const keys = await offeredKeys();
  expect(keys).toContain(feat.externalKey);
  expect(keys).not.toContain(outsideKey);
  const level = sheet.entries.find((row) => row.kind === 'classLevel');
  const fighter = sheet.catalogEntries.find(
    (row) => row.detail?.kind === 'class' && row.name === 'Fighter',
  );
  if (!level || !fighter) throw new Error('Missing baseline Fighter');
  const characterScope = {
    organizationId,
    campaignId,
    characterId: journeyId as Id<'character'>,
  };
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...characterScope,
    entryId: level._id,
    classEntryId: fighter._id,
    hpGained: 10,
    operationId: 'release-fighter',
  });
  expect(await acrobatics(journeyId)).toBe(0);
  await owner.mutation(api.characterSheet.fillSelectionSlot, {
    ...characterScope,
    slotId: 'feat:general',
    position: 0,
    catalogEntryId: offered._id,
    operationId: 'release-feat',
  });
  expect(await acrobatics(journeyId)).toBe(feat.bonus);
}, 120_000);
