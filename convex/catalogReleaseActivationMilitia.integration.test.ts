// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import { beforeAll, afterEach, expect, test, vi } from 'vitest';
import { refuseRepeatedPaginatedQueries } from '../tests/convex-paginated-queries';
import { preloadCalledConvexModules } from '../tests/convex-modules';
import { api, internal } from './_generated/api';
import schema from './schema';
import type { Id } from './_generated/dataModel';
import type { CatalogReleaseStatus } from '../src/lib/catalog/release-validators';
import { buildCatalogRelease } from '../scripts/catalog/release';
import type { ReleaseRow } from '../src/lib/catalog/release-schema';
import { catalogRuntimeCompatibility } from '../src/lib/catalog/runtime-compatibility';
import { retainedPriorCalculationIdentity } from '../src/lib/catalog/calculation-identities';
import resourcesData from '../src/lib/catalog/data/resources.json';
import section15Registry from '../src/lib/catalog/data/section15-registry.json';
import { buildLegalPageData } from '../src/lib/catalog/legal-page-data';
import { legalResourcesSchema } from '../src/lib/catalog/legal-types';
import { seedAcceptedCampaign } from './lib/acceptedCampaignFixture';
import { initializeCharacterSheet } from './lib/characterSheet';
import { initializationEdits } from '../tests/rules/initialization-edits';
afterEach(() => vi.useRealTimers());
const modules = import.meta.glob('./**/*.ts');
beforeAll(() => refuseRepeatedPaginatedQueries(schema, modules));
preloadCalledConvexModules({ modules, testFile: import.meta.url });
const writeBatch = makeFunctionReference<
  'mutation',
  { releaseNumber: number; batchIndex: number; rows: unknown },
  CatalogReleaseStatus
>('catalogRelease:writeBatch');
async function fixture() {
  const t = convexTest(schema, modules);
  const campaignId = await t.run(async (ctx) => {
    await ctx.db.insert('user', {
      tokenIdentifier: 'test|owner',
      orgIds: [{ orgId: 'org', role: 'member' }],
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
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Vessa',
    kind: 'pc',
    operationId: 'create',
  });
  return {
    t,
    owner,
    campaignId,
    scope: { organizationId: 'org', characterId },
  };
}

async function prepare(
  t: ReturnType<typeof convexTest>,
  rows: ReleaseRow[] = [],
  releaseNumber = 1,
  baseRelease: Parameters<typeof buildCatalogRelease>[0]['baseRelease'] = null,
  calculationIdentity: string = catalogRuntimeCompatibility.calculation,
  requiredNotices: string[] = [],
) {
  const registry = requiredNotices.length ? section15Registry : {};
  const notices = buildLegalPageData({
    registry,
    resources: legalResourcesSchema.parse(resourcesData),
    requiredNotices,
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
      ...[
        'requiredNotices',
        'permanentNoticeSuperset',
        'registry',
        'resources',
      ].map((key) => ({
        kind: 'legal' as const,
        key,
        payload:
          key === 'resources'
            ? resourcesData
            : key === 'registry'
              ? registry
              : key === 'permanentNoticeSuperset'
                ? notices
                : requiredNotices,
      })),
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

async function reconcile(
  t: ReturnType<typeof convexTest>,
  characterIds: Id<'character'>[],
  releaseNumber = 1,
) {
  const runId = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber,
  });
  for (let step = 0; step < 100; step++) {
    if (await t.mutation(internal.catalogReleaseImpact.discover, { runId }))
      break;
  }
  for (const characterId of characterIds) {
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
  }
  expect(
    await t.mutation(internal.catalogReleaseImpact.finish, { runId }),
  ).toBe(true);
  return runId;
}

function activationArgs(runId: Id<'catalogImpactRun'>, releaseNumber = 1) {
  return {
    releaseNumber,
    runId,
    activationId: `activate-${releaseNumber}`,
    schemaIdentity: catalogRuntimeCompatibility.schema,
    calculationIdentity: catalogRuntimeCompatibility.calculation,
    isFixtureOnly: true,
  };
}

test.each(['during preparation', 'after activation'] as const)(
  'Character departure %s retains selected militia facts and advances the review once',
  async (timing) => {
    vi.useFakeTimers();
    const { t, owner, scope, campaignId } = await fixture();
    const accepted = await owner.run((ctx) =>
      seedAcceptedCampaign(ctx, campaignId),
    );
    await t.run(async (ctx) => {
      await ctx.db.patch('user', (await ctx.db.query('user').first())!._id, {
        characterSheetDemo: true,
      });
      await ctx.db.patch('character', accepted.characterId, {
        ownerId: 'test|owner',
      });
      await initializeCharacterSheet(ctx, {
        characterId: accepted.characterId,
        operationId: 'officer-sheet',
        updatedBy: 'test|owner',
        level: 12,
        scores: {
          strength: 10,
          dexterity: 11,
          constitution: 12,
          intelligence: 13,
          wisdom: 14,
          charisma: 15,
        },
      });
    });
    const globalId = await t.run((ctx) =>
      ctx.db.insert('catalogEntry', {
        scope: 'global',
        name: 'Resolve',
        ruleIdentity: 'pf1/Resolve',
        sources: [],
        stacksWithItself: false,
        detail: {
          kind: 'feat',
          featTypes: ['general'],
          repeatable: 'unreviewed',
        },
        modifiers: [{ target: 'ability.cha', bonusType: 'untyped', value: 1 }],
      }),
    );
    for (const characterId of [scope.characterId, accepted.characterId])
      await owner.mutation(api.characterSheet.selectEntry, {
        characterId,
        catalogEntryId: globalId,
        operationId: `resolve-${characterId}`,
      });
    await prepare(t, [
      {
        kind: 'definition',
        key: 'pf1/Resolve',
        payload: {
          externalKey: 'pf1/Resolve',
          upstreamKey: 'pf1/Resolve',
          pack: 'feats',
          name: 'Resolve',
          detail: {
            kind: 'feat',
            featTypes: ['general'],
            repeatable: 'unreviewed',
          },
          description: '',
          sources: [],
          unsupported: [],
          modifiers: [
            { target: 'ability.cha', bonusType: 'untyped', value: 5 },
          ],
        },
      },
    ]);
    const runId = await reconcile(t, [scope.characterId, accepted.characterId]);
    const command = { characterId: scope.characterId, operationId: 'leave' };
    if (timing === 'after activation')
      await t.mutation(
        internal.catalogReleaseActivation.activate,
        activationArgs(runId),
      );
    let move = await owner.mutation(api.characterMoves.start, command);
    for (let step = 0; step < 100 && move.state === 'preparing'; step++)
      move = await owner.mutation(api.characterMoves.resume, command);
    expect(move.state).toBe('ready');
    if (timing === 'during preparation')
      await t.mutation(
        internal.catalogReleaseActivation.activate,
        activationArgs(runId),
      );
    const ledgerScope = { campaignId, militiaId: accepted.key.militiaId };
    const selected = await owner.query(api.canonicalLedger.read, ledgerScope);
    expect(
      selected.state.militiaSnapshot.characters.find(
        (row) => row.characterId === accepted.characterId,
      )?.charisma,
    ).toBe(20);
    for (let step = 0; step < 100 && move.state !== 'completed'; step++)
      move = await owner.mutation(api.characterMoves.resume, command);
    expect(move.state).toBe('completed');
    const departed = await owner.query(api.canonicalLedger.read, ledgerScope);
    expect(departed.revision).toBe(selected.revision + 1);
    expect(departed.state.militiaSnapshot.characters).toEqual(
      selected.state.militiaSnapshot.characters.filter(
        (row) => row.characterId !== scope.characterId,
      ),
    );
    expect(
      (
        await owner.query(api.characterSheet.read, {
          characterId: scope.characterId,
        })
      )?.campaign,
    ).toBeNull();
    const departureAudit = await t.run(async (ctx) => {
      const source = await ctx.db
        .query('canonicalMilitiaState')
        .withIndex('by_militiaId', (q) =>
          q.eq('militiaId', accepted.key.militiaId),
        )
        .unique();
      const corrections = await ctx.db
        .query('canonicalSourceCorrection')
        .withIndex('by_militiaId', (q) =>
          q.eq('militiaId', accepted.key.militiaId),
        )
        .collect();
      return {
        source,
        correction: corrections.find((row) =>
          row.reason.startsWith('Automatic Character departure:'),
        ),
      };
    });
    expect(departureAudit.correction).toMatchObject({
      expectedRevision: selected.revision,
      revision: departed.revision,
    });
    expect(departureAudit.source?.snapshot.characters).toEqual(
      departed.state.militiaSnapshot.characters,
    );

    const correctedRevision = await owner.mutation(api.canonicalLedger.save, {
      ...ledgerScope,
      expectedRevision: departed.revision,
      snapshot: { ...departed.state.militiaSnapshot, treasuryCopper: 98765 },
      reason: 'Treasury corrected after departure',
    });
    expect(correctedRevision).toBe(departed.revision + 1);
    const corrected = await owner.query(api.canonicalLedger.read, ledgerScope);
    expect(corrected.state.militiaSnapshot.characters).toEqual(
      departed.state.militiaSnapshot.characters,
    );
    expect(corrected.state.militiaSnapshot.treasuryCopper).toBe(98765);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  },
);

test('a resolver-only release with equal militia facts preserves the reviewed week and Ruleset Version', async () => {
  vi.useFakeTimers();
  const { t, owner, scope, campaignId } = await fixture();
  const accepted = await owner.run((ctx) =>
    seedAcceptedCampaign(ctx, campaignId),
  );
  const priorIdentity = retainedPriorCalculationIdentity;
  const oldArtifact = await prepare(t, [], 1, null, priorIdentity);
  const oldRun = await reconcile(t, [scope.characterId]);
  await t.mutation(internal.catalogReleaseActivation.activate, {
    ...activationArgs(oldRun),
    calculationIdentity: priorIdentity,
  });
  for (const [baseRevision, edit] of initializationEdits(
    'patrol',
    accepted.characterId,
  ).entries())
    await owner.mutation(api.canonicalDraftPersistence.edit, {
      campaignId,
      militiaId: accepted.key.militiaId,
      operation: {
        draftId: accepted.key.draftId,
        operationId: `ready-${baseRevision}`,
        baseRevision,
        edit,
      },
    });
  const reviewed = await owner.query(
    api.canonicalDraftPersistence.preview,
    accepted.key,
  );
  expect(reviewed.status).toBe('ready');
  const ledgerScope = { campaignId, militiaId: accepted.key.militiaId };
  const before = await owner.query(api.canonicalLedger.read, ledgerScope);
  const draft = await owner.query(
    api.canonicalDraftPersistence.observe,
    accepted.key,
  );
  await prepare(t, [], 2, {
    releaseNumber: 1,
    artifactFingerprint: oldArtifact.manifest.artifactFingerprint,
  });
  const nextRun = await reconcile(t, [scope.characterId], 2);
  await t.mutation(
    internal.catalogReleaseActivation.activate,
    activationArgs(nextRun, 2),
  );
  expect(await owner.query(api.canonicalLedger.read, ledgerScope)).toEqual(
    before,
  );
  expect(
    await owner.query(api.canonicalDraftPersistence.observe, accepted.key),
  ).toEqual(draft);
  const current = await owner.query(
    api.canonicalDraftPersistence.preview,
    accepted.key,
  );
  expect(current.reviewed).toEqual(reviewed.reviewed);
  expect(current.reviewed.rulesetVersion).toBe(
    reviewed.reviewed.rulesetVersion,
  );
  const receipt = await owner.mutation(api.canonicalDraftPersistence.confirm, {
    ...accepted.key,
    operation: {
      operationId: 'same-reviewed-week',
      reviewed: reviewed.reviewed,
    },
  });
  expect(receipt.record.rulesetVersion).toBe(reviewed.reviewed.rulesetVersion);
  expect(receipt.record.sourceMilitiaSnapshot).toEqual(
    before.state.militiaSnapshot,
  );
  const historyArgs = { campaignId, week: receipt.record.source.week };
  const frozen = await owner.query(api.canonicalHistory.read, historyArgs);
  const confirmed = await owner.query(api.canonicalLedger.read, ledgerScope);
  await owner.mutation(api.canonicalLedger.save, {
    ...ledgerScope,
    expectedRevision: confirmed.revision,
    snapshot: { ...confirmed.state.militiaSnapshot, treasuryCopper: 4242 },
    reason: 'Current-week correction preserves frozen history',
  });
  expect(await owner.query(api.canonicalHistory.read, historyArgs)).toEqual(
    frozen,
  );
  await t.finishAllScheduledFunctions(vi.runAllTimers);
});

// #411: a release that only adds a required notice (the reviewed CRB Section
// 15 entry) calculates nothing and leaves militia reviews valid.
test('a notice-only release keeps fact generations and the reviewed week while publishing the notice', async () => {
  vi.useFakeTimers();
  const { t, owner, scope, campaignId } = await fixture();
  const accepted = await owner.run((ctx) =>
    seedAcceptedCampaign(ctx, campaignId),
  );
  const firstArtifact = await prepare(t);
  const firstRun = await reconcile(t, [scope.characterId]);
  await t.mutation(
    internal.catalogReleaseActivation.activate,
    activationArgs(firstRun),
  );
  for (const [baseRevision, edit] of initializationEdits(
    'patrol',
    accepted.characterId,
  ).entries())
    await owner.mutation(api.canonicalDraftPersistence.edit, {
      campaignId,
      militiaId: accepted.key.militiaId,
      operation: {
        draftId: accepted.key.draftId,
        operationId: `ready-${baseRevision}`,
        baseRevision,
        edit,
      },
    });
  const reviewed = await owner.query(
    api.canonicalDraftPersistence.preview,
    accepted.key,
  );
  expect(reviewed.status).toBe('ready');
  const ledgerScope = { campaignId, militiaId: accepted.key.militiaId };
  const before = await owner.query(api.canonicalLedger.read, ledgerScope);
  const generationBefore = await t.run(
    async (ctx) =>
      (
        await ctx.db
          .query('catalogCampaignFacts')
          .withIndex('by_runId_and_campaignId', (q) =>
            q.eq('runId', firstRun).eq('campaignId', campaignId),
          )
          .unique()
      )?.generation,
  );
  expect(generationBefore).toEqual(expect.any(Number));
  await prepare(
    t,
    [],
    2,
    {
      releaseNumber: 1,
      artifactFingerprint: firstArtifact.manifest.artifactFingerprint,
    },
    catalogRuntimeCompatibility.calculation,
    ['CRB'],
  );
  const noticeRun = await reconcile(t, [scope.characterId], 2);
  const work = await t.run((ctx) =>
    ctx.db
      .query('catalogImpactWork')
      .withIndex('by_runId_and_characterId', (q) =>
        q.eq('runId', noticeRun).eq('characterId', scope.characterId),
      )
      .unique(),
  );
  expect(work).toMatchObject({ state: 'unaffected' });
  await t.mutation(
    internal.catalogReleaseActivation.activate,
    activationArgs(noticeRun, 2),
  );
  expect(
    await t.run(
      async (ctx) =>
        (
          await ctx.db
            .query('catalogCampaignFacts')
            .withIndex('by_runId_and_campaignId', (q) =>
              q.eq('runId', noticeRun).eq('campaignId', campaignId),
            )
            .unique()
        )?.generation,
    ),
  ).toBe(generationBefore);
  expect(await owner.query(api.canonicalLedger.read, ledgerScope)).toEqual(
    before,
  );
  const legal = await t.query(api.catalogRelease.legalInputs, {});
  expect(legal?.requiredNotices).toEqual(['CRB']);
  expect(legal?.permanentNoticeSuperset).toContainEqual(
    expect.objectContaining({ id: 'registry:CRB' }),
  );
  const receipt = await owner.mutation(api.canonicalDraftPersistence.confirm, {
    ...accepted.key,
    operation: {
      operationId: 'notice-only-reviewed-week',
      reviewed: reviewed.reviewed,
    },
  });
  expect(receipt.record.rulesetVersion).toBe(reviewed.reviewed.rulesetVersion);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
});
