// @vitest-environment edge-runtime
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import {
  activationArgs,
  prepare,
  reconcile,
  releaseFixture,
} from '../tests/catalog-release-fixture';
import type { convexTest } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import type { CatalogReleaseCommandAdapter } from '../scripts/catalog/release-command';
import type { CatalogReleaseImpactCommandAdapter } from '../scripts/catalog/release-impact-command';
import type { CatalogReleaseStatus } from '../src/lib/catalog/release-validators';
import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import { refuseRepeatedPaginatedQueries } from '../tests/convex-paginated-queries';
import schema from './schema';
afterEach(() => vi.useRealTimers());
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { isObject, type ReleaseRow } from '../src/lib/catalog/release-schema';
import { catalogRuntimeCompatibility } from '../src/lib/catalog/runtime-compatibility';
import { retainedPriorCalculationIdentity } from '../src/lib/catalog/calculation-identities';
import { reviewedCastingTablesSchema } from '../src/lib/character-sheet-casting-tables';

const writeBatch = makeFunctionReference<
  'mutation',
  { releaseNumber: number; batchIndex: number; rows: unknown },
  CatalogReleaseStatus
>('catalogRelease:writeBatch');
const modules = import.meta.glob('./**/*.ts');
beforeAll(() => refuseRepeatedPaginatedQueries(schema, modules));

const fixture = () => releaseFixture(modules);

test('activation is idempotent after a lost response and leaves gameplay and authority open', async () => {
  const { t, owner, scope } = await fixture();
  const artifact = await prepare(t);
  const runId = await reconcile(t, scope.characterId);
  const args = activationArgs(runId);
  await t.mutation(internal.catalogReleaseActivation.activate, args);
  const selected = await t.query(internal.catalogReleaseActivation.status, {});
  expect(selected).toMatchObject({
    releaseNumber: 1,
    impactRunId: runId,
    activationId: 'activate-1',
    artifactFingerprint: artifact.manifest.artifactFingerprint,
  });
  expect(
    await t.mutation(internal.catalogReleaseActivation.activate, args),
  ).toEqual(selected);
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 16 },
    operationId: 'after-activation',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.calculated.abilities.strength.score,
  ).toBe(16);
  expect(
    await t.query(internal.initialMigration.status, { now: Date.now() }),
  ).toMatchObject({ authority: 'legacy', closed: false });
  await expect(
    t.query(internal.catalogReleaseImpact.evaluate, {
      runId,
      characterId: scope.characterId,
    }),
  ).rejects.toThrow();
});

test('an accepted edit after finish refuses activation until its current revision is reconciled', async () => {
  const { t, owner, scope } = await fixture();
  await prepare(t);
  const runId = await reconcile(t, scope.characterId);
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 18 },
    operationId: 'after-ready',
  });
  expect(
    await t.query(internal.catalogReleaseImpact.status, { runId }),
  ).toMatchObject({ isReady: false, pendingCount: 1 });
  await expect(
    t.mutation(
      internal.catalogReleaseActivation.activate,
      activationArgs(runId),
    ),
  ).rejects.toThrow('pending-work');
  expect(
    await t.query(internal.catalogReleaseActivation.status, {}),
  ).toBeNull();
  const evaluation = await t.query(internal.catalogReleaseImpact.evaluate, {
    runId,
    characterId: scope.characterId,
  });
  expect(
    await t.mutation(internal.catalogReleaseImpact.complete, {
      runId,
      characterId: scope.characterId,
      evaluation,
    }),
  ).toBe(true);
  expect(
    await t.mutation(internal.catalogReleaseImpact.finish, { runId }),
  ).toBe(true);
  await t.mutation(
    internal.catalogReleaseActivation.activate,
    activationArgs(runId),
  );
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.calculated.abilities.strength.score,
  ).toBe(18);
});

async function prepareAcceptedWeek(
  member: ReturnType<ReturnType<typeof convexTest>['withIdentity']>,
  key: {
    campaignId: Id<'campaign'>;
    militiaId: Id<'militia'>;
    draftId: string;
  },
  characterId: Id<'character'>,
) {
  const { initializationEdits } =
    await import('../tests/rules/initialization-edits');
  for (const [baseRevision, edit] of initializationEdits(
    'patrol',
    characterId,
  ).entries())
    await member.mutation(api.canonicalDraftPersistence.edit, {
      campaignId: key.campaignId,
      militiaId: key.militiaId,
      operation: {
        draftId: key.draftId,
        operationId: `ready-${baseRevision}`,
        baseRevision,
        edit,
      },
    });
  const preview = await member.query(
    api.canonicalDraftPersistence.preview,
    key,
  );
  expect(preview.status).toBe('ready');
  return preview;
}

test('archive and restore after activation each advance the ledger and cannot revive an earlier review', async () => {
  const { t, owner, scope, campaignId } = await fixture();
  const { seedAcceptedCampaign } =
    await import('./lib/acceptedCampaignFixture');
  const accepted = await owner.run((ctx) =>
    seedAcceptedCampaign(ctx, campaignId),
  );
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 12 },
    operationId: 'enroll-source',
  });
  await prepare(t);
  const runId = await reconcile(t, scope.characterId);
  await t.mutation(
    internal.catalogReleaseActivation.activate,
    activationArgs(runId),
  );
  const reviewed = await prepareAcceptedWeek(
    owner,
    accepted.key,
    accepted.characterId,
  );
  const ledgerScope = { campaignId, militiaId: accepted.key.militiaId };
  const before = await owner.query(api.canonicalLedger.read, ledgerScope);
  await owner.mutation(api.characterSheet.archive, {
    ...scope,
    isActive: false,
    operationId: 'archive-after-publication',
  });
  const archived = await owner.query(api.canonicalLedger.read, ledgerScope);
  expect(archived.revision).toBe(before.revision + 1);
  expect(
    archived.state.militiaSnapshot.characters.find(
      (row) => row.characterId === scope.characterId,
    )?.isActive,
  ).toBe(false);
  await expect(
    owner.mutation(api.canonicalDraftPersistence.confirm, {
      ...accepted.key,
      operation: {
        operationId: 'stale-archived-review',
        reviewed: reviewed.reviewed,
      },
    }),
  ).rejects.toThrow('Reviewed weekly source changed');
  await owner.mutation(api.characterSheet.archive, {
    ...scope,
    isActive: true,
    operationId: 'restore-after-publication',
  });
  const restored = await owner.query(api.canonicalLedger.read, ledgerScope);
  expect(restored.revision).toBe(archived.revision + 1);
  expect(restored.state.militiaSnapshot.characters).toEqual(
    before.state.militiaSnapshot.characters,
  );
  expect(
    restored.state.militiaSnapshot.characters.find(
      (row) => row.characterId === scope.characterId,
    )?.isActive,
  ).toBe(true);
  await expect(
    owner.mutation(api.canonicalDraftPersistence.confirm, {
      ...accepted.key,
      operation: {
        operationId: 'stale-restored-review',
        reviewed: reviewed.reviewed,
      },
    }),
  ).rejects.toThrow('Reviewed weekly source changed');
});

test('publication targets changed campaign reviews and retains live corrections, saved choices, overrides and frozen history', async () => {
  vi.useFakeTimers();
  const { t, owner, scope, campaignId } = await fixture();
  const { seedAcceptedCampaign } =
    await import('./lib/acceptedCampaignFixture');
  const accepted = await owner.run((ctx) =>
    seedAcceptedCampaign(ctx, campaignId),
  );
  const other = await owner.run((ctx) => seedAcceptedCampaign(ctx));
  const globalId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'Officer resolve',
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
  await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: globalId,
    operationId: 'resolve',
  });
  const finishedPreview = await prepareAcceptedWeek(
    owner,
    accepted.key,
    accepted.characterId,
  );
  const finished = await owner.mutation(api.canonicalDraftPersistence.confirm, {
    ...accepted.key,
    operation: {
      operationId: 'finished-before-publication',
      reviewed: finishedPreview.reviewed,
    },
  });
  const liveKey = { ...accepted.key, draftId: finished.successor.draftId };
  const ledgerScope = { campaignId, militiaId: accepted.key.militiaId };
  const before = await owner.query(api.canonicalLedger.read, ledgerScope);
  await owner.mutation(api.canonicalLedger.save, {
    ...ledgerScope,
    expectedRevision: before.revision,
    reason: 'Enroll officer with table Hit Dice',
    snapshot: {
      ...before.state.militiaSnapshot,
      roster: {
        ...before.state.militiaSnapshot.roster,
        people: [
          ...before.state.militiaSnapshot.roster.people,
          { characterId: scope.characterId, kind: 'pc', hitDice: 22 },
        ],
      },
    },
  });
  const { roll } = await import('../tests/rules/upkeep-fixture');
  await owner.mutation(api.canonicalDraftPersistence.edit, {
    campaignId,
    militiaId: accepted.key.militiaId,
    operation: {
      draftId: liveKey.draftId,
      operationId: 'saved-roll',
      baseRevision: 0,
      edit: { kind: 'upkeep_roll', field: 'check', roll: roll(20, 17) },
    },
  });
  await owner.mutation(api.canonicalDraftPersistence.edit, {
    campaignId,
    militiaId: accepted.key.militiaId,
    operation: {
      draftId: liveKey.draftId,
      operationId: 'saved-training',
      baseRevision: 1,
      edit: { kind: 'upkeep_roll', field: 'training', roll: roll(6, 1) },
    },
  });
  await owner.mutation(api.canonicalDraftPersistence.edit, {
    campaignId,
    militiaId: accepted.key.militiaId,
    operation: {
      draftId: liveKey.draftId,
      operationId: 'saved-event',
      baseRevision: 2,
      edit: { kind: 'event_chance', roll: roll(100, 100) },
    },
  });
  const draftBefore = await owner.query(
    api.canonicalDraftPersistence.observe,
    liveKey,
  );
  const historyBefore = await owner.query(api.canonicalHistory.read, {
    campaignId,
    week: finished.record.source.week,
  });
  await t.run(async (ctx) => {
    const campaign = await ctx.db.get('campaign', other.key.campaignId);
    if (campaign)
      await ctx.db.patch('campaign', campaign._id, {
        e2eFixture: {
          namespace: 'activation',
          version: 1,
          workerKey: 'other',
          caseKey: 'other',
          campaignKey: 'other',
        },
      });
  });
  const otherPreview = await prepareAcceptedWeek(
    owner,
    other.key,
    other.characterId,
  );
  await prepare(t, [
    {
      kind: 'definition',
      key: 'pf1/Resolve',
      payload: {
        externalKey: 'pf1/Resolve',
        upstreamKey: 'pf1/Resolve',
        pack: 'feats',
        name: 'Officer resolve',
        detail: {
          kind: 'feat',
          featTypes: ['general'],
          repeatable: 'unreviewed',
        },
        description: '',
        sources: [],
        modifiers: [{ target: 'ability.cha', bonusType: 'untyped', value: 5 }],
        unsupported: [],
      },
    },
  ]);
  const runId = await reconcile(t, scope.characterId);
  const staged = await owner.query(api.canonicalLedger.read, ledgerScope);
  expect(
    staged.state.militiaSnapshot.characters.find(
      (row) => row.characterId === scope.characterId,
    )?.charisma,
  ).toBe(11);
  await owner.mutation(api.canonicalLedger.save, {
    ...ledgerScope,
    expectedRevision: staged.revision,
    reason: 'Treasure found while catalog is preparing',
    snapshot: {
      ...staged.state.militiaSnapshot,
      treasuryCopper: staged.state.militiaSnapshot.treasuryCopper + 321,
    },
  });
  const reviewed = await owner.query(
    api.canonicalDraftPersistence.preview,
    liveKey,
  );
  expect(reviewed.status).toBe('ready');
  const beforeActivation = await owner.query(
    api.canonicalLedger.read,
    ledgerScope,
  );
  await t.mutation(
    internal.catalogReleaseActivation.activate,
    activationArgs(runId),
  );
  const after = await owner.query(api.canonicalLedger.read, ledgerScope);
  expect(after.revision).toBe(beforeActivation.revision + 1);
  expect(
    after.state.militiaSnapshot.characters.find(
      (row) => row.characterId === scope.characterId,
    )?.charisma,
  ).toBe(15);
  expect(after.state.militiaSnapshot.treasuryCopper).toBe(
    beforeActivation.state.militiaSnapshot.treasuryCopper,
  );
  expect(after.state.militiaSnapshot.roster).toEqual(
    beforeActivation.state.militiaSnapshot.roster,
  );
  expect(
    await owner.query(api.canonicalDraftPersistence.observe, liveKey),
  ).toEqual(draftBefore);
  expect(
    await owner.query(api.canonicalHistory.read, {
      campaignId,
      week: finished.record.source.week,
    }),
  ).toEqual(historyBefore);
  await expect(
    owner.mutation(api.canonicalDraftPersistence.confirm, {
      ...liveKey,
      operation: {
        operationId: 'stale-catalog-review',
        reviewed: reviewed.reviewed,
      },
    }),
  ).rejects.toThrow('Reviewed weekly source changed');
  const otherAfter = await owner.query(
    api.canonicalDraftPersistence.preview,
    other.key,
  );
  expect(otherAfter.reviewed).toEqual(otherPreview.reviewed);
  await expect(
    owner.mutation(api.canonicalDraftPersistence.confirm, {
      ...other.key,
      operation: {
        operationId: 'unchanged-review',
        reviewed: otherPreview.reviewed,
      },
    }),
  ).resolves.toMatchObject({
    record: { rulesetVersion: otherPreview.reviewed.rulesetVersion },
  });
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(sheet?.catalogView).toMatchObject({
    releaseNumber: 1,
    calculationIdentity: catalogRuntimeCompatibility.calculation,
  });
  expect(sheet?.calculated.abilities.charisma.score).toBe(15);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
});

test('sheet edits and new Characters after publication remain current before Militia Setup exists', async () => {
  const { t, owner, campaignId, scope } = await fixture();
  await prepare(t);
  const runId = await reconcile(t, scope.characterId);
  await t.mutation(
    internal.catalogReleaseActivation.activate,
    activationArgs(runId),
  );
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 18 },
    operationId: 'before-setup',
  });
  const newCharacterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'New officer',
    kind: 'pc',
    operationId: 'new-after-publication',
  });
  const options = await owner.query(api.canonicalSetup.options, { campaignId });
  expect(
    options?.characters.find((row) => row.characterId === scope.characterId)
      ?.strength,
  ).toBe(18);
  expect(
    options?.characters.find((row) => row.characterId === newCharacterId)
      ?.strength,
  ).toBe(10);
  const { newMilitiaSetup } = await import('../src/lib/canonical-setup');
  const setup = newMilitiaSetup('Security');
  if (!options) throw new Error('Missing Setup options');
  setup.state.militiaSnapshot.characters = options.characters.map(
    ({ name: _name, ...facts }) => facts,
  );
  const key = await owner.mutation(api.canonicalSetup.initialize, {
    campaignId,
    initializationId: 'after-publication',
    setup,
  });
  const ledger = await owner.query(api.canonicalLedger.read, {
    campaignId,
    militiaId: key.militiaId,
  });
  expect(
    ledger.state.militiaSnapshot.characters.find(
      (row) => row.characterId === scope.characterId,
    )?.strength,
  ).toBe(18);
  expect(
    ledger.state.militiaSnapshot.characters.find(
      (row) => row.characterId === newCharacterId,
    )?.strength,
  ).toBe(10);
});

test('the real operator commands reconcile prepared data and inspect a lost activation response before retry', async () => {
  const { runCatalogReleaseOperator } =
    await import('../scripts/catalog/release-operator');
  const { runCatalogReleaseCommand } =
    await import('../scripts/catalog/release-command');
  const { t, scope } = await fixture();
  const artifact = await prepare(t);
  const releaseAdapter = {
    begin: (args: Parameters<CatalogReleaseCommandAdapter['begin']>[0]) =>
      t.mutation(internal.catalogRelease.begin, args),
    writeBatch: (args: {
      releaseNumber: number;
      batchIndex: number;
      rows: unknown;
      writeEpoch: number;
    }) => t.mutation(writeBatch, args),
    finalize: (args: { releaseNumber: number; writeEpoch: number }) =>
      t.mutation(internal.catalogRelease.finalize, args),
    inspect: (args: { releaseNumber: number }) =>
      t.query(internal.catalogRelease.inspect, args),
  };
  expect(
    await runCatalogReleaseCommand({
      command: { kind: 'prepare', artifact },
      adapter: releaseAdapter,
    }),
  ).toMatchObject({ state: 'prepared' });
  const impactAdapter = {
    start: (args: { releaseNumber: number }) =>
      t.mutation(internal.catalogReleaseImpact.start, args),
    discover: (args: { runId: Id<'catalogImpactRun'> }) =>
      t.mutation(internal.catalogReleaseImpact.discover, args),
    evaluate: (args: {
      runId: Id<'catalogImpactRun'>;
      characterId: Id<'character'>;
    }) => t.query(internal.catalogReleaseImpact.evaluate, args),
    complete: (
      args: Parameters<CatalogReleaseImpactCommandAdapter['complete']>[0],
    ) => t.mutation(internal.catalogReleaseImpact.complete, args),
    finish: (args: { runId: Id<'catalogImpactRun'> }) =>
      t.mutation(internal.catalogReleaseImpact.finish, args),
    status: (args: { runId: Id<'catalogImpactRun'> }) =>
      t.query(internal.catalogReleaseImpact.status, args),
    retry: (args: {
      runId: Id<'catalogImpactRun'>;
      characterId: Id<'character'>;
    }) => t.mutation(internal.catalogReleaseImpact.retry, args),
    retryDiscovery: (args: { runId: Id<'catalogImpactRun'> }) =>
      t.mutation(internal.catalogReleaseImpact.retryDiscovery, args),
    inspectWork: (args: {
      runId: Id<'catalogImpactRun'>;
      state: 'dirty' | 'failed';
      paginationOpts: {
        numItems: number;
        cursor: string | null;
        maximumRowsRead: number;
        maximumBytesRead: number;
      };
    }) => t.query(internal.catalogReleaseImpact.inspectWork, args),
  };
  await runCatalogReleaseOperator({
    args: ['reconcile', '--number', '1', '--max-steps', '100'],
    impactAdapter,
  });
  const runId = await t.run(
    async (ctx) =>
      (
        await ctx.db
          .query('catalogImpactRun')
          .withIndex('by_releaseId')
          .order('desc')
          .first()
      )?._id,
  );
  if (!runId) throw new Error('Missing reconciled run');
  let loseResponse = true;
  const activationAdapter = {
    activate: async (args: {
      releaseNumber: number;
      runId: string;
      activationId: string;
      schemaIdentity: string;
      calculationIdentity: string;
      isFixtureOnly: boolean;
      writeEpoch: number;
    }) => {
      expect(args.runId).toBe(runId);
      const result = await t.mutation(
        internal.catalogReleaseActivation.activate,
        { ...args, runId },
      );
      if (loseResponse) {
        loseResponse = false;
        throw new Error('lost response');
      }
      return result;
    },
    status: () => t.query(internal.catalogReleaseActivation.status, {}),
  };
  const args = [
    'activate',
    '--number',
    '1',
    '--run-id',
    runId,
    '--operation-id',
    'command-activation',
    '--schema',
    catalogRuntimeCompatibility.schema,
    '--calculation',
    catalogRuntimeCompatibility.calculation,
    '--fixture-only',
    '--target-kind',
    'preview',
  ];
  await expect(
    runCatalogReleaseOperator({ args, activationAdapter }),
  ).rejects.toThrow('lost response');
  const selected = await runCatalogReleaseOperator({
    args: ['active'],
    activationAdapter,
  });
  expect(selected).toMatchObject({
    releaseNumber: 1,
    impactRunId: runId,
    activationId: 'command-activation',
  });
  expect(await runCatalogReleaseOperator({ args, activationAdapter })).toEqual(
    selected,
  );
  expect(
    (
      await t.query(internal.catalogReleaseImpact.inspectWork, {
        runId,
        state: 'unaffected',
        paginationOpts: {
          cursor: null,
          numItems: 1,
          maximumRowsRead: 1,
          maximumBytesRead: 512000,
        },
      })
    ).page[0],
  ).toMatchObject({ characterId: scope.characterId });
});

test('competing activation requests select once and reject a different operation identity', async () => {
  const { t, scope } = await fixture();
  await prepare(t);
  const runId = await reconcile(t, scope.characterId);
  const requests = await Promise.allSettled([
    t.mutation(
      internal.catalogReleaseActivation.activate,
      activationArgs(runId),
    ),
    t.mutation(internal.catalogReleaseActivation.activate, {
      ...activationArgs(runId),
      activationId: 'competing-activation',
    }),
  ]);
  expect(
    requests.filter((result) => result.status === 'fulfilled'),
  ).toHaveLength(1);
  expect(
    requests.filter((result) => result.status === 'rejected'),
  ).toHaveLength(1);
  expect(
    await t.query(internal.catalogReleaseActivation.status, {}),
  ).toMatchObject({ releaseNumber: 1, impactRunId: runId });
});

test('deploying the compatible resolver retains earlier calculation until matching resources and identity activate', async () => {
  const { t, owner, scope } = await fixture();
  const castingTables = (
    await import('../scripts/catalog/reviewed-casting-tables.json')
  ).default;
  const priorIdentity = retainedPriorCalculationIdentity;
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const wizard = sheet?.catalogEntries.find(
    (row) => row.detail.kind === 'class' && row.ruleIdentity === 'wizard',
  );
  const level = sheet?.entries.find((row) => row.kind === 'classLevel');
  if (!wizard || !level) throw new Error('Missing wizard fixture');
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: wizard._id,
    hpGained: 5,
    operationId: 'wizard',
  });
  const tables = structuredClone(castingTables);
  const firstRow = tables.tables['prepared-full'].rows[0];
  if (!firstRow) throw new Error('Missing casting table');
  firstRow.spellsPerDay[1] = 7;
  const expectedTables = reviewedCastingTablesSchema.parse(tables);
  const resource = {
    kind: 'resource' as const,
    key: 'builtin:casting-tables',
    payload: { definitions: tables },
  };
  const oldArtifact = await prepare(t, [resource], 1, null, priorIdentity);
  const oldRun = await reconcile(t, scope.characterId);
  await t.mutation(internal.catalogReleaseActivation.activate, {
    ...activationArgs(oldRun),
    calculationIdentity: priorIdentity,
  });
  const oldView = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(oldView?.catalogView?.calculationIdentity).toBe(priorIdentity);
  expect(oldView?.catalogView?.resources.castingTables).toEqual(expectedTables);
  expect(
    oldView?.calculated.spellcastings[0]?.slots.find(
      (slot) => slot.spellLevel === 1,
    )?.base,
  ).toBe(7);
  await prepare(t, [resource], 2, {
    releaseNumber: 1,
    artifactFingerprint: oldArtifact.manifest.artifactFingerprint,
  });
  const nextRun = await reconcile(t, scope.characterId, 2);
  const stagedView = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(stagedView?.calculated).toEqual(oldView?.calculated);
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 17 },
    operationId: 'edit-before-resolver-activation',
  });
  await expect(
    t.mutation(
      internal.catalogReleaseActivation.activate,
      activationArgs(nextRun, 2),
    ),
  ).rejects.toThrow('pending-work');
  const evaluation = await t.query(internal.catalogReleaseImpact.evaluate, {
    runId: nextRun,
    characterId: scope.characterId,
  });
  expect(evaluation.result).toMatchObject({
    kind: 'ready',
    hasFactsChanged: false,
    reasons: expect.arrayContaining(['calculation']),
  });
  expect(
    await t.mutation(internal.catalogReleaseImpact.complete, {
      runId: nextRun,
      characterId: scope.characterId,
      evaluation,
    }),
  ).toBe(true);
  expect(
    await t.mutation(internal.catalogReleaseImpact.finish, { runId: nextRun }),
  ).toBe(true);
  await t.mutation(
    internal.catalogReleaseActivation.activate,
    activationArgs(nextRun, 2),
  );
  const newView = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(newView?.catalogView?.calculationIdentity).toBe(
    catalogRuntimeCompatibility.calculation,
  );
  expect(newView?.catalogView?.resources.castingTables).toEqual(expectedTables);
  expect(
    newView?.calculated.spellcastings[0]?.slots.find(
      (slot) => slot.spellLevel === 1,
    )?.base,
  ).toBe(7);
  expect(newView?.permanentCalculated.abilities.strength.score).toBe(17);
  await expect(
    t.query(internal.catalogReleaseImpact.evaluate, {
      runId: oldRun,
      characterId: scope.characterId,
    }),
  ).rejects.toThrow();
});

test('unsupported prepared Spell browser coverage fails before activation and keeps the old view', async () => {
  const { t, owner, scope } = await fixture();
  const oldArtifact = await prepare(t);
  const oldRun = await reconcile(t, scope.characterId);
  await t.mutation(
    internal.catalogReleaseActivation.activate,
    activationArgs(oldRun),
  );
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const spellRows: ReleaseRow[] = Array.from({ length: 257 }, (_, index) => ({
    kind: 'definition',
    key: `pf1/Overflow${index}`,
    payload: {
      externalKey: `pf1/Overflow${index}`,
      upstreamKey: `pf1/Overflow${index}`,
      pack: 'spells',
      name: `Overflow ${index}`,
      detail: {
        kind: 'spell',
        levels: { wizard: 1 },
        grantedLevels: {},
        school: 'evocation',
        subschools: [],
        descriptors: [],
      },
      description: '',
      sources: [],
      modifiers: [],
      unsupported: [],
    },
  }));
  await prepare(t, spellRows, 2, {
    releaseNumber: 1,
    artifactFingerprint: oldArtifact.manifest.artifactFingerprint,
  });
  const runId = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber: 2,
  });
  for (let step = 0; step < 300; step++)
    if (await t.mutation(internal.catalogReleaseImpact.discover, { runId }))
      break;
  expect(
    await t.query(internal.catalogReleaseImpact.status, { runId }),
  ).toMatchObject({
    isReady: false,
    discoveryError: expect.stringContaining('256 entries'),
  });
  expect(
    await t.mutation(internal.catalogReleaseImpact.finish, { runId }),
  ).toBe(false);
  await expect(
    t.mutation(
      internal.catalogReleaseActivation.activate,
      activationArgs(runId, 2),
    ),
  ).rejects.toThrow('discovery-failed');
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope)),
  ).toEqual(before);
  expect(
    await t.query(internal.catalogReleaseActivation.status, {}),
  ).toMatchObject({ releaseNumber: 1, impactRunId: oldRun });
});

test('an admitted definition without a prepared stable identity cannot be silently activated', async () => {
  const { t, owner, scope } = await fixture();
  const oldArtifact = await prepare(t);
  const oldRun = await reconcile(t, scope.characterId);
  await t.mutation(
    internal.catalogReleaseActivation.activate,
    activationArgs(oldRun),
  );
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  await prepare(
    t,
    [
      {
        kind: 'definition',
        key: 'pf1/Uninstalled',
        payload: {
          externalKey: 'pf1/Uninstalled',
          upstreamKey: 'pf1/Uninstalled',
          pack: 'feats',
          name: 'Uninstalled feat',
          detail: { kind: 'feat', featTypes: [], repeatable: 'unreviewed' },
          description: '',
          sources: [],
          modifiers: [],
          unsupported: [],
        },
      },
    ],
    2,
    {
      releaseNumber: 1,
      artifactFingerprint: oldArtifact.manifest.artifactFingerprint,
    },
  );
  const runId = await reconcile(t, scope.characterId, 2);
  expect(
    await t.query(internal.catalogReleaseImpact.status, { runId }),
  ).toMatchObject({ identityCoverageComplete: true, missingIdentityCount: 1 });
  await expect(
    t.mutation(
      internal.catalogReleaseActivation.activate,
      activationArgs(runId, 2),
    ),
  ).rejects.toThrow('gates-incomplete');
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope)),
  ).toEqual(before);
  expect(
    await t.query(internal.catalogReleaseActivation.status, {}),
  ).toMatchObject({ releaseNumber: 1, impactRunId: oldRun });
});

test('retired definitions preserve existing uses but cannot create or select new Catalog Copies', async () => {
  const { t, owner, scope, campaignId } = await fixture();
  const payload = {
    externalKey: 'pf1/Held',
    upstreamKey: 'pf1/Held',
    pack: 'feats',
    name: 'Held feat',
    detail: { kind: 'feat', featTypes: [], repeatable: 'unreviewed' },
    description: '',
    sources: [],
    modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 2 }],
    unsupported: [],
  };
  const globalId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'Held feat',
      ruleIdentity: 'pf1/Held',
      detail: { kind: 'feat' },
      sources: [],
      modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 2 }],
      stacksWithItself: false,
    }),
  );
  const entryId = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: globalId,
    operationId: 'existing-held-use',
  });
  const priorCopy = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId,
      name: 'Earlier held copy',
      ruleIdentity: 'pf1/Held',
      copiedFrom: globalId,
      detail: { kind: 'feat' },
      sources: [],
      modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 2 }],
      stacksWithItself: false,
    }),
  );
  await prepare(t, [
    {
      kind: 'report',
      key: 'retirement:pf1/Held',
      payload: { status: 'held', lastUsableDefinition: payload },
    },
  ]);
  const runId = await reconcile(t, scope.characterId);
  await t.mutation(
    internal.catalogReleaseActivation.activate,
    activationArgs(runId),
  );
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.calculated.abilities.strength.score,
  ).toBe(12);
  expect(
    (await owner.query(api.catalogCopies.list, scope)).some(
      (row) => row.ruleIdentity === 'pf1/Held',
    ),
  ).toBe(false);
  await expect(
    owner.mutation(api.catalogCopies.customizeForCampaign, {
      ...scope,
      catalogEntryId: globalId,
      operationId: 'copy-held',
    }),
  ).rejects.toThrow('kept for existing Characters');
  await expect(
    owner.mutation(api.catalogCopies.detach, {
      ...scope,
      target: { kind: 'entry', entryId },
      operationId: 'detach-held',
    }),
  ).rejects.toThrow('kept for existing Characters');
  await expect(
    owner.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: priorCopy,
      operationId: 'choose-held-copy',
    }),
  ).rejects.toThrow('retired');
});

test('malformed live resources cannot activate when there are no prepared Characters to evaluate', async () => {
  const { t, scope } = await fixture();
  await t.run((ctx) => ctx.db.delete('character', scope.characterId));
  await prepare(t, [
    {
      kind: 'resource',
      key: 'builtin:casting-tables',
      payload: { definitions: { tables: {} } },
    },
  ]);
  const runId = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber: 1,
  });
  for (let step = 0; step < 100; step++)
    if (await t.mutation(internal.catalogReleaseImpact.discover, { runId }))
      break;
  expect(
    await t.query(internal.catalogReleaseImpact.status, { runId }),
  ).toMatchObject({
    isReady: false,
    discoveryError: expect.stringContaining('resources'),
  });
  expect(
    await t.mutation(internal.catalogReleaseImpact.finish, { runId }),
  ).toBe(false);
  await expect(
    t.mutation(
      internal.catalogReleaseActivation.activate,
      activationArgs(runId),
    ),
  ).rejects.toThrow('discovery-failed');
  expect(
    await t.query(internal.catalogReleaseActivation.status, {}),
  ).toBeNull();
});

test.each(['malformed-global', 'wrong-kind-private'])(
  'invalid retained bodies cannot activate without prepared Characters: %s',
  async (caseKey) => {
    const { t, scope } = await fixture();
    await t.run(async (ctx) => {
      await ctx.db.delete('character', scope.characterId);
      await ctx.db.insert(
        'catalogEntry',
        caseKey === 'malformed-global'
          ? {
              scope: 'global',
              name: 'Held class',
              ruleIdentity: 'pf1/BadRetained',
              detail: { kind: 'feat' },
              sources: [],
              modifiers: [],
              stacksWithItself: false,
            }
          : {
              scope: 'character',
              characterId: scope.characterId,
              importedSpell: true,
              name: 'Held Spell',
              ruleIdentity: 'pf1/BadRetained',
              detail: { kind: 'spell', description: '', levels: { wizard: 1 } },
              sources: [],
              modifiers: [],
              stacksWithItself: false,
            },
      );
    });
    await prepare(t, [
      {
        kind: 'report',
        key: 'retirement:pf1/BadRetained',
        payload: {
          status: 'held',
          lastUsableDefinition:
            caseKey === 'malformed-global'
              ? { externalKey: 'pf1/BadRetained', detail: { kind: 'class' } }
              : {
                  externalKey: 'pf1/BadRetained',
                  upstreamKey: 'pf1/BadRetained',
                  pack: 'feats',
                  name: 'Wrong kind',
                  detail: {
                    kind: 'feat',
                    featTypes: [],
                    repeatable: 'unreviewed',
                  },
                  description: '',
                  sources: [],
                  modifiers: [],
                  unsupported: [],
                },
        },
      },
    ]);
    const runId = await t.mutation(internal.catalogReleaseImpact.start, {
      releaseNumber: 1,
    });
    for (let step = 0; step < 100; step++)
      if (await t.mutation(internal.catalogReleaseImpact.discover, { runId }))
        break;
    expect(
      await t.query(internal.catalogReleaseImpact.status, { runId }),
    ).toMatchObject({
      isReady: false,
      discoveryError: expect.stringContaining('Retained'),
    });
    expect(
      await t.mutation(internal.catalogReleaseImpact.finish, { runId }),
    ).toBe(false);
    await expect(
      t.mutation(
        internal.catalogReleaseActivation.activate,
        activationArgs(runId),
      ),
    ).rejects.toThrow('discovery-failed');
    expect(
      await t.query(internal.catalogReleaseActivation.status, {}),
    ).toBeNull();
  },
);

test('held Spell copies retain recorded use but leave the offered browser and summaries', async () => {
  const { t, owner, scope } = await fixture();
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const wizard = initial?.catalogEntries.find((row) => row.name === 'Wizard');
  const level = initial?.entries.find((row) => row.kind === 'classLevel');
  if (!wizard || !level) throw new Error('Missing Wizard');
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: wizard._id,
    operationId: 'wizard',
  });
  const globalId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'Held Spell Unique',
      ruleIdentity: 'pf1/HeldSpell',
      detail: {
        kind: 'spell',
        levels: { wizard: 1 },
        school: 'evocation',
        description: 'Keep existing use.',
      },
      sources: [],
      modifiers: [],
      stacksWithItself: false,
    }),
  );
  const copyId = await owner.mutation(api.catalogCopies.customizeForCampaign, {
    ...scope,
    catalogEntryId: globalId,
    operationId: 'spell-copy',
  });
  const entryId = await owner.mutation(api.characterSheetSpells.record, {
    ...scope,
    castingClassId: wizard._id,
    catalogEntryId: copyId,
    operationId: 'record-copy',
  });
  await t.run(async (ctx) => {
    const rows = await ctx.db
      .query('spellCatalogIndex')
      .withIndex('by_characterId_and_catalogEntryId', (q) =>
        q.eq('characterId', scope.characterId).eq('catalogEntryId', copyId),
      )
      .take(65);
    for (const row of rows)
      await ctx.db.patch('spellCatalogIndex', row._id, {
        ruleIdentity: undefined,
      });
  });
  const browseArgs = {
    ...scope,
    castingClassId: wizard._id,
    search: 'Held Spell Unique',
    paginationOpts: { cursor: null, numItems: 25 },
  };
  expect(
    (await owner.query(api.characterSheetSpells.browse, browseArgs)).page,
  ).toHaveLength(1);
  await prepare(t, [
    {
      kind: 'report',
      key: 'retirement:pf1/HeldSpell',
      payload: {
        status: 'held',
        lastUsableDefinition: {
          externalKey: 'pf1/HeldSpell',
          upstreamKey: 'pf1/HeldSpell',
          pack: 'spells',
          name: 'Held Spell Unique',
          detail: {
            kind: 'spell',
            levels: { wizard: 1 },
            grantedLevels: {},
            school: 'evocation',
            subschools: [],
            descriptors: [],
          },
          description: 'Keep existing use.',
          sources: [],
          modifiers: [],
          unsupported: [],
        },
      },
    },
  ]);
  const runId = await reconcile(t, scope.characterId);
  await t.mutation(
    internal.catalogReleaseActivation.activate,
    activationArgs(runId),
  );
  const first = await owner.query(api.characterSheetSpells.browse, browseArgs);
  const second = first.isDone
    ? first
    : await owner.query(api.characterSheetSpells.browse, {
        ...browseArgs,
        paginationOpts: { cursor: first.continueCursor, numItems: 25 },
      });
  expect([...first.page, ...(first.isDone ? [] : second.page)]).toHaveLength(0);
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.entries,
  ).toContainEqual(
    expect.objectContaining({ _id: entryId, catalogEntryId: copyId }),
  );
  expect(
    (
      await owner.query(api.characterSheetSpells.browserInfo, {
        ...scope,
        castingClassId: wizard._id,
      })
    ).schools,
  ).not.toContain('evocation');
  expect(
    await owner.mutation(api.characterSheetSpells.record, {
      ...scope,
      castingClassId: wizard._id,
      catalogEntryId: copyId,
      operationId: 'keep-held-use',
    }),
  ).toBe(entryId);
  await owner.mutation(api.characterSheetSpells.remove, {
    ...scope,
    entryId,
    operationId: 'remove-held-use',
  });
  await expect(
    owner.mutation(api.characterSheetSpells.record, {
      ...scope,
      castingClassId: wizard._id,
      catalogEntryId: copyId,
      operationId: 'new-held-copy-use',
    }),
  ).rejects.toThrow('not available');
});

test('finish retries after activation return success after a lost response', async () => {
  const { t, scope } = await fixture();
  await prepare(t);
  const runId = await reconcile(t, scope.characterId);
  await t.mutation(
    internal.catalogReleaseActivation.activate,
    activationArgs(runId),
  );
  expect(
    await t.mutation(internal.catalogReleaseImpact.finish, { runId }),
  ).toBe(true);
});

test.each([
  'ordinary campaign',
  'private Character',
  'no fixture flag',
] as const)('legacy authority refuses activation with %s', async (unsafe) => {
  const { t, scope } = await fixture();
  await prepare(t);
  const runId = await reconcile(t, scope.characterId);
  await t.run(async (ctx) => {
    if (unsafe === 'ordinary campaign')
      await ctx.db.insert('campaign', {
        name: 'Real campaign',
        description: '',
        organizationId: 'org',
        ownerId: 'test|owner',
      });
    if (unsafe === 'private Character')
      await ctx.db.insert('character', {
        name: 'Real private Character',
        description: '',
        kind: 'pc',
        isActive: true,
        ownerId: 'test|owner',
        level: 1,
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      });
  });
  await expect(
    t.mutation(internal.catalogReleaseActivation.activate, {
      ...activationArgs(runId),
      isFixtureOnly: unsafe !== 'no fixture flag',
    }),
  ).rejects.toThrow(
    unsafe === 'no fixture flag'
      ? 'fixture-only mode'
      : 'isolated fixture deployment',
  );
  expect(
    await t.query(internal.catalogReleaseActivation.status, {}),
  ).toBeNull();
});

test('selected fixture reads fail closed if ordinary data is introduced outside admission writers', async () => {
  const { t, owner, scope } = await fixture();
  await prepare(t);
  const runId = await reconcile(t, scope.characterId);
  await t.mutation(
    internal.catalogReleaseActivation.activate,
    activationArgs(runId),
  );
  await t.run((ctx) =>
    ctx.db.insert('campaign', {
      name: 'Real campaign',
      description: '',
      organizationId: 'org',
      ownerId: 'test|owner',
    }),
  );
  await expect(owner.query(api.characterSheet.read, scope)).rejects.toThrow(
    'isolated fixture deployment',
  );
});

test('a release with thousands of unchanged Spells activates when only one Spell changes', async () => {
  const { t, scope } = await fixture();
  const rows: ReleaseRow[] = Array.from({ length: 2000 }, (_, index) => ({
    kind: 'definition',
    key: `pf1/Scale${index}`,
    payload: {
      externalKey: `pf1/Scale${index}`,
      upstreamKey: `pf1/Scale${index}`,
      pack: 'spells',
      name: `Scale ${index}`,
      detail: {
        kind: 'spell',
        levels: { wizard: 1 },
        grantedLevels: {},
        school: 'evocation',
        subschools: [],
        descriptors: [],
      },
      description: '',
      sources: [],
      modifiers: [],
      unsupported: [],
    },
  }));
  await t.run(async (ctx) => {
    for (const row of rows)
      await ctx.db.insert('catalogEntry', {
        scope: 'global',
        stacksWithItself: false,
        ruleIdentity: row.key,
        name: row.key,
        description: '',
        sources: [],
        modifiers: [],
        detail: {
          kind: 'spell',
          levels: { wizard: 1 },
          school: 'evocation',
          description: '',
        },
      });
  });
  const artifact = await prepare(t, rows);
  await t.run(async (ctx) => {
    const release = await ctx.db
      .query('catalogRelease')
      .withIndex('by_releaseNumber', (q) => q.eq('releaseNumber', 1))
      .unique();
    if (!release) throw new Error('Missing base release');
    await ctx.db.insert('catalogReleaseControl', {
      key: 'global',
      releaseId: release._id,
      releaseNumber: 1,
      schemaIdentity: catalogRuntimeCompatibility.schema,
      calculationIdentity: catalogRuntimeCompatibility.calculation,
    });
  });
  const changed = rows.map((row) =>
    row.key === 'pf1/Scale0' && isObject(row.payload)
      ? { ...row, payload: { ...row.payload, name: 'Changed Scale' } }
      : row,
  );
  await prepare(t, changed, 2, {
    releaseNumber: 1,
    artifactFingerprint: artifact.manifest.artifactFingerprint,
  });
  const runId = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber: 2,
  });
  for (let step = 0; step < 1400; step++)
    if (await t.mutation(internal.catalogReleaseImpact.discover, { runId }))
      break;
  const evaluation = await t.query(internal.catalogReleaseImpact.evaluate, {
    runId,
    characterId: scope.characterId,
  });
  expect(
    await t.mutation(internal.catalogReleaseImpact.complete, {
      runId,
      characterId: scope.characterId,
      evaluation,
    }),
  ).toBe(true);
  expect(
    await t.mutation(internal.catalogReleaseImpact.finish, { runId }),
  ).toBe(true);
  expect(
    await t.mutation(
      internal.catalogReleaseActivation.activate,
      activationArgs(runId, 2),
    ),
  ).toMatchObject({ releaseNumber: 2 });
}, 180_000);

test('selected release rows consume the same sheet read budget as copied definitions', async () => {
  const { t, scope } = await fixture();
  const read = (limit: number) =>
    t.run(async (ctx) => {
      const character = await ctx.db.get('character', scope.characterId);
      if (!character) throw new Error('Missing Character');
      const { readCharacterSheetData } =
        await import('./lib/characterSheetData');
      return readCharacterSheetData(ctx, character, {
        resourceLimits: {
          maximumTotalBytesRead: limit,
          maximumReferences: 100,
        },
      });
    });
  // Measure the empty sheet's bytes so the limits follow the seeded catalogs.
  let below = 0;
  let baselineBytes = 1 << 20;
  while (baselineBytes - below > 1) {
    const limit = Math.floor((below + baselineBytes) / 2);
    const fits = await read(limit).then(
      () => true,
      () => false,
    );
    if (fits) baselineBytes = limit;
    else below = limit;
  }
  const payload = {
    externalKey: 'pf1/Large',
    upstreamKey: 'pf1/Large',
    pack: 'feats',
    name: 'Large feat',
    description: 'x'.repeat(96_000),
    sources: [],
    modifiers: [],
    unsupported: [],
    detail: { kind: 'feat', featTypes: ['general'], repeatable: 'unreviewed' },
  };
  const catalogEntryId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'global',
      stacksWithItself: false,
      ruleIdentity: 'pf1/Large',
      name: 'Large feat',
      sources: [],
      modifiers: [],
      detail: { kind: 'feat' },
    }),
  );
  await t.run((ctx) =>
    ctx.db.insert('characterSheetEntry', {
      characterId: scope.characterId,
      catalogEntryId,
      kind: 'feat',
      active: true,
      state: { kind: 'feat' },
    }),
  );
  await prepare(t, [{ kind: 'definition', key: 'pf1/Large', payload }]);
  const runId = await reconcile(t, scope.characterId);
  await t.mutation(
    internal.catalogReleaseActivation.activate,
    activationArgs(runId),
  );
  await expect(read(baselineBytes + 80_000)).rejects.toThrow(
    'read resource limit',
  );
  expect(
    (await read(baselineBytes + 200_000)).catalogEntries.some(
      (row) => row._id === catalogEntryId,
    ),
  ).toBe(true);
});

test('retained metadata rejects mismatched identity before adapting the definition kind', async () => {
  const { t, scope } = await fixture();
  await t.run(async (ctx) => {
    await ctx.db.delete('character', scope.characterId);
    await ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'Held feat',
      ruleIdentity: 'pf1/Identity',
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: { kind: 'feat' },
    });
  });
  await prepare(t, [
    {
      kind: 'report',
      key: 'retirement:pf1/Identity',
      payload: {
        status: 'held',
        lastUsableDefinition: {
          externalKey: 'pf1/Wrong',
          upstreamKey: 'pf1/Wrong',
          pack: 'spells',
          name: 'Wrong Spell',
          description: '',
          sources: [],
          modifiers: [],
          unsupported: [],
          detail: {
            kind: 'spell',
            levels: { wizard: 1 },
            grantedLevels: {},
            school: 'evocation',
            subschools: [],
            descriptors: [],
          },
        },
      },
    },
  ]);
  const runId = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber: 1,
  });
  for (let step = 0; step < 100; step++)
    if (await t.mutation(internal.catalogReleaseImpact.discover, { runId }))
      break;
  expect(
    await t.query(internal.catalogReleaseImpact.status, { runId }),
  ).toMatchObject({
    isReady: false,
    discoveryError: expect.stringContaining(
      'identity does not match its report',
    ),
  });
});

test('the first release activates thousands of unchanged private imported Spells', async () => {
  const { t, scope } = await fixture();
  const rows: ReleaseRow[] = Array.from({ length: 2000 }, (_, index) => ({
    kind: 'definition',
    key: `pf1/PrivateScale${index}`,
    payload: {
      externalKey: `pf1/PrivateScale${index}`,
      upstreamKey: `pf1/PrivateScale${index}`,
      pack: 'spells',
      name: `Private Scale ${index}`,
      detail: {
        kind: 'spell',
        levels: { wizard: 1 },
        grantedLevels: {},
        school: 'evocation',
        subschools: [],
        descriptors: [],
      },
      description: '',
      sources: [],
      modifiers: [],
      unsupported: [],
    },
  }));
  await t.run(async (ctx) => {
    for (const [index, row] of rows.entries())
      await ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId: scope.characterId,
        importedSpell: true,
        browseOnly: true,
        ruleIdentity: row.key,
        name: `Private Scale ${index}`,
        description: '',
        stacksWithItself: false,
        sources: [],
        modifiers: [],
        detail: {
          kind: 'spell',
          levels: { wizard: 1 },
          school: 'evocation',
          description: '',
        },
      });
  });
  await prepare(t, rows);
  const runId = await t.mutation(internal.catalogReleaseImpact.start, {
    releaseNumber: 1,
  });
  for (let step = 0; step < 800; step++)
    if (await t.mutation(internal.catalogReleaseImpact.discover, { runId }))
      break;
  const evaluation = await t.query(internal.catalogReleaseImpact.evaluate, {
    runId,
    characterId: scope.characterId,
  });
  expect(
    await t.mutation(internal.catalogReleaseImpact.complete, {
      runId,
      characterId: scope.characterId,
      evaluation,
    }),
  ).toBe(true);
  expect(
    await t.mutation(internal.catalogReleaseImpact.finish, { runId }),
  ).toBe(true);
  expect(
    await t.mutation(
      internal.catalogReleaseActivation.activate,
      activationArgs(runId),
    ),
  ).toMatchObject({ releaseNumber: 1 });
}, 180_000);
