// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { beforeAll, afterEach, beforeEach, expect, test, vi } from 'vitest';
import { refuseRepeatedPaginatedQueries } from '../tests/convex-paginated-queries';
import schema from './schema';
import { api, internal } from './_generated/api';
import {
  deploymentFixture,
  fixtureCredentials,
} from '../e2e/support/test-data';
import type { FixtureScope } from '../e2e/fixtures/catalog';
import type { DraftOperation } from '../src/lib/weekly-draft-persistence-contract';

const initialize = internal.canonicalPersistenceFixtures.initialize;
const observe = api.canonicalDraftPersistence.observe;
const edit = api.canonicalDraftPersistence.edit;
const modules = import.meta.glob('./**/*.ts');
beforeAll(() => refuseRepeatedPaginatedQueries(schema, modules));
const fixtureScope: FixtureScope = {
  namespace: deploymentFixture.namespace,
  version: 1,
  workerKey: 'worker-0',
  caseKey: 'canonicalPersistence',
  ...fixtureCredentials,
};
beforeEach(() => {
  vi.stubEnv('E2E_ENABLED', 'true');
  vi.stubEnv('E2E_FIXTURE_CONFIG', JSON.stringify(deploymentFixture));
  vi.stubEnv('CONVEX_CLOUD_URL', deploymentFixture.convexUrl);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.e2eFixtures.seedIdentityProjection, fixtureScope);
  await t.mutation(internal.e2eFixtures.resetCase, { ...fixtureScope, now: 1 });
  const key = await t.mutation(initialize, {
    scope: fixtureScope,
    draftId: 'canonical-contract',
  });
  const user = await t.run((ctx) => ctx.db.query('user').first());
  if (!user) throw Error('Missing fixture identity');
  const member = t.withIdentity({ tokenIdentifier: user.tokenIdentifier });
  const operation = (
    baseRevision: number,
    operationId: string,
    intent: DraftOperation['edit'],
  ): DraftOperation => ({
    draftId: key.draftId,
    operationId,
    baseRevision,
    edit: intent,
  });
  const send = (request: DraftOperation) =>
    member.mutation(edit, {
      campaignId: key.campaignId,
      militiaId: key.militiaId,
      operation: request,
    });
  return { t, key, member, operation, send };
}

test('[rules.P79.provenance] actual mutation derives stale field intent from stored provenance and commits atomically', async () => {
  const { t, key, member, operation, send } = await setup();
  const choice = { choiceId: 'a', actionId: 'earn_gold' as const };
  await send(operation(0, 'stage', { kind: 'stage', slotId: 'left', choice }));
  await send(
    operation(1, 'cost', {
      kind: 'detail',
      slotId: 'left',
      choiceId: 'a',
      choice: { ...choice, costCopper: 10 },
    }),
  );
  await send(
    operation(1, 'roll', {
      kind: 'detail',
      slotId: 'left',
      choiceId: 'a',
      choice: {
        ...choice,
        rolls: {
          check: {
            diceTotal: 12,
            diceCount: 1,
            sides: 20,
            provenance: { kind: 'table' },
            modifiers: [],
          },
        },
      },
    }),
  );
  const accepted = await member.query(observe, key);
  expect(accepted.revision).toBe(3);
  expect(accepted.draft?.activity.slots[0]?.choice).toMatchObject({
    costCopper: 10,
    rolls: { check: { diceTotal: 12, diceCount: 1 } },
  });
  await expect(
    send(
      operation(1, 'stale', {
        kind: 'replace',
        slotId: 'left',
        choiceId: 'a',
        choice: { choiceId: 'b', actionId: 'earn_gold' },
      }),
    ),
  ).rejects.toThrow('Target changed');
  await expect(
    send(
      operation(99, 'future', { kind: 'clear', slotId: 'left', choiceId: 'a' }),
    ),
  ).rejects.toThrow('Unknown base revision');
  await expect(
    Reflect.apply(member.mutation, member, [
      edit,
      {
        campaignId: key.campaignId,
        militiaId: key.militiaId,
        operation: {
          ...operation(1, 'forged', {
            kind: 'clear',
            slotId: 'left',
            choiceId: 'a',
          }),
          targets: [],
        },
      },
    ]),
  ).rejects.toThrow();
  expect(await member.query(observe, key)).toEqual(accepted);
  expect(
    await t.run((ctx) => ctx.db.query('canonicalDraftOperation').collect()),
  ).toHaveLength(3);
});

test('[rules.P79.authority] refused references, outsider access, and mismatched campaign or militia cannot mutate draft or dedup rows', async () => {
  const { t, key, member, operation, send } = await setup();
  const request = operation(0, 'foreign', {
    kind: 'stage',
    slotId: 'left',
    choice: {
      choiceId: 'a',
      actionId: 'rescue_character',
      characterId: 'foreign-character',
    },
  });
  await expect(send(request)).rejects.toThrow('Invalid draft entity reference');
  await expect(t.query(observe, key)).rejects.toThrow('Campaign access');
  const outsider = t.withIdentity({ tokenIdentifier: 'outsider' });
  await expect(
    outsider.mutation(edit, {
      campaignId: key.campaignId,
      militiaId: key.militiaId,
      operation: request,
    }),
  ).rejects.toThrow('Campaign access');
  const foreignCampaign = await t.run((ctx) =>
    ctx.db.insert('campaign', {
      name: 'Other',
      ownerId: 'other',
      organizationId: 'foreign',
      description: '',
    }),
  );
  await expect(
    member.query(observe, { ...key, campaignId: foreignCampaign }),
  ).rejects.toThrow();
  expect((await member.query(observe, key)).revision).toBe(0);
  expect(
    await t.run((ctx) => ctx.db.query('canonicalDraftOperation').collect()),
  ).toHaveLength(0);
  // The failed operation did not reserve its identity or write half a transaction.
  expect(
    (
      await send({
        ...request,
        edit: {
          kind: 'stage',
          slotId: 'left',
          choice: { choiceId: 'a', actionId: 'rescue_character' },
        },
      })
    ).acceptedRevision,
  ).toBe(1);
});

test('ordinary canonical writes do not depend on fixture binding and guarded cleanup removes all snapshots', async () => {
  const { t, key, member, operation, send } = await setup();
  await send(
    operation(0, 'one', {
      kind: 'stage',
      slotId: 'left',
      choice: { choiceId: 'a', actionId: 'earn_gold' },
    }),
  );
  vi.stubEnv('E2E_ENABLED', 'false');
  expect(await member.query(observe, key)).not.toBeNull();
  await expect(
    send(operation(1, 'two', { kind: 'clear', slotId: 'left', choiceId: 'a' })),
  ).resolves.toMatchObject({ acceptedRevision: 2 });
  vi.stubEnv('E2E_ENABLED', 'true');
  await t.mutation(internal.e2eFixtures.cleanupCase, fixtureScope);
  await t.run(async (ctx) => {
    expect(await ctx.db.query('canonicalWeeklyDraft').collect()).toHaveLength(
      0,
    );
    expect(
      await ctx.db.query('canonicalDraftOperation').collect(),
    ).toHaveLength(0);
    expect(await ctx.db.query('canonicalMilitiaState').collect()).toHaveLength(
      0,
    );
  });
});

test('all supplied entity references are campaign scoped even in partial decisions and adjustments', async () => {
  const { member, key, send, operation } = await setup();
  const invalid: DraftOperation['edit'][] = [
    {
      kind: 'table_adjustments',
      adjustments: [
        {
          kind: 'team_status',
          adjustmentId: 'foreign',
          teamId: 'foreign',
          status: 'missing',
          reason: 'test',
        },
      ],
    },
    {
      kind: 'stage',
      slotId: 'left',
      choice: {
        choiceId: 'cache',
        actionId: 'secure_cache',
        mode: 'retrieve',
        cacheId: 'foreign',
      },
    },
    {
      kind: 'stage',
      slotId: 'left',
      choice: {
        choiceId: 'rescue',
        actionId: 'rescue_character',
        destination: { kind: 'refuge', settlementId: 'foreign' },
      },
    },
    {
      kind: 'event_tree',
      occurrences: [
        {
          eventId: 'event',
          origin: { kind: 'rolled' },
          eventType: 'theft',
          overseerCharacterId: 'foreign',
        },
      ],
    },
  ];
  for (const [index, intent] of invalid.entries())
    await expect(
      send(operation(0, `invalid-${index}`, intent)),
    ).rejects.toThrow('Invalid draft entity reference');
  expect((await member.query(observe, key)).revision).toBe(0);
});

test('target tombstones live in indexed children and page reads restart before applying a stale cursor', async () => {
  const { t, key, member, send, operation } = await setup();
  let revision = 0;
  for (let index = 0; index < 20; index++) {
    await send(
      operation(revision++, `add-${index}`, {
        kind: 'acknowledge',
        acknowledgement: {
          acknowledgementId: `ack-${index}`,
          subjectId: 'table',
          outcome: 'Agreed',
        },
      }),
    );
    await send(
      operation(revision++, `clear-${index}`, {
        kind: 'clear_acknowledgement',
        acknowledgementId: `ack-${index}`,
      }),
    );
  }
  await t.run(async (ctx) => {
    const draft = await ctx.db
      .query('canonicalWeeklyDraft')
      .withIndex('by_draftId', (q) => q.eq('draftId', key.draftId))
      .unique();
    expect(draft).not.toHaveProperty('targetRevisions');
    const target = await ctx.db
      .query('canonicalDraftTarget')
      .withIndex('by_draftId_and_target', (q) =>
        q
          .eq('draftId', key.draftId)
          .eq('target', JSON.stringify(['acknowledgement', 'ack-0'])),
      )
      .unique();
    expect(target?.revision).toBe(2);
  });
  const request = {
    ...key,
    afterRevision: 0,
    observedRevision: 40,
    observedStatus: 'open' as const,
    paginationOpts: { numItems: 16, cursor: null },
  };
  const page = await member.query(
    api.canonicalDraftPersistence.targets,
    request,
  );
  expect(page.restart).toBe(false);
  expect(page.pagination?.page).toHaveLength(16);
  expect(page.pagination?.isDone).toBe(false);
  const limited = await member.query(api.canonicalDraftPersistence.targets, {
    ...request,
    paginationOpts: {
      numItems: 100,
      cursor: null,
      maximumRowsRead: 2,
      maximumBytesRead: 100000,
      id: 7,
    },
  });
  expect(limited.pagination?.page).toHaveLength(2);
  expect(limited.pagination?.pageStatus).toBe('SplitRequired');
  expect(limited.pagination?.splitCursor).toEqual(expect.any(String));
  const byteLimited = await member.query(
    api.canonicalDraftPersistence.targets,
    {
      ...request,
      paginationOpts: { numItems: 100, cursor: null, maximumBytesRead: 1 },
    },
  );
  expect(byteLimited.pagination?.page).toHaveLength(1);
  expect(byteLimited.pagination?.pageStatus).toBe('SplitRequired');
  const bounded = await member.query(api.canonicalDraftPersistence.targets, {
    ...request,
    paginationOpts: {
      numItems: 100,
      cursor: null,
      endCursor: page.pagination!.continueCursor,
    },
  });
  expect(bounded.pagination?.page).toEqual(page.pagination?.page);
  await send(operation(40, 'latest', { kind: 'event_chance', roll: null }));
  const stale = await member.query(api.canonicalDraftPersistence.targets, {
    ...request,
    paginationOpts: {
      ...request.paginationOpts,
      cursor: page.pagination!.continueCursor,
    },
  });
  expect(stale).toMatchObject({
    restart: true,
    pagination: null,
    observation: { revision: 41 },
  });
  await expect(
    send(
      operation(0, 'stale-ack', {
        kind: 'acknowledge',
        acknowledgement: {
          acknowledgementId: 'ack-0',
          subjectId: 'table',
          outcome: 'Old client',
        },
      }),
    ),
  ).rejects.toThrow('Target changed');
  expect((await member.query(observe, key)).revision).toBe(41);
  await t.mutation(internal.e2eFixtures.cleanupCase, fixtureScope);
  expect(
    await t.run((ctx) => ctx.db.query('canonicalDraftTarget').collect()),
  ).toHaveLength(0);
});

test('[rules.P80.atomic] reviewed Confirmation atomically advances once and rejects a competing attempt', async () => {
  vi.useFakeTimers();
  const { t, key, member, send, operation } = await setup();
  await send(
    operation(0, 'roll', {
      kind: 'event_chance',
      roll: {
        diceTotal: 100,
        diceCount: 1,
        sides: 100,
        provenance: { kind: 'table' },
        modifiers: [],
      },
    }),
  );
  const preview = await member.query(
    api.canonicalDraftPersistence.preview,
    key,
  );
  const args = {
    ...key,
    operation: { operationId: 'confirm-one', reviewed: preview.reviewed },
  };
  const results = await Promise.allSettled([
    member.mutation(api.canonicalDraftPersistence.confirm, args),
    member.mutation(api.canonicalDraftPersistence.confirm, {
      ...args,
      operation: { ...args.operation, operationId: 'confirm-two' },
    }),
  ]);
  expect(
    results.filter((result) => result.status === 'fulfilled'),
  ).toHaveLength(1);
  const state = await t.run(async (ctx) => ({
    records: await ctx.db.query('canonicalResolutionRecord').take(3),
    drafts: await ctx.db.query('canonicalWeeklyDraft').take(3),
    source: await ctx.db.query('canonicalMilitiaState').unique(),
  }));
  expect(state.records).toHaveLength(1);
  expect(state.drafts.filter((draft) => draft.status === 'open')).toHaveLength(
    1,
  );
  expect(
    state.drafts.find((draft) => draft.draftId === key.draftId),
  ).toMatchObject({ status: 'closed', draft: null });
  expect(state.source).toMatchObject({
    revision: 1,
    snapshot: { treasuryCopper: 100, training: 0 },
  });
  expect(await member.query(observe, key)).toMatchObject({
    status: 'closed',
    draft: null,
  });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(
    await t.run((ctx) => ctx.db.query('canonicalDraftTarget').take(1)),
  ).toEqual([]);
});

test('[rules.P80.rollback] final successor write failure rolls back all changes; bounded closure cleanup retains only dedup authority', async () => {
  vi.useFakeTimers();
  const { t, key, member, send, operation } = await setup();
  for (let i = 0; i < 36; i++)
    await send(
      operation(i, `empty-ack-${i}`, {
        kind: 'clear_acknowledgement',
        acknowledgementId: `unused-${i}`,
      }),
    );
  await send(
    operation(36, 'chance', {
      kind: 'event_chance',
      roll: {
        diceTotal: 100,
        diceCount: 1,
        sides: 100,
        provenance: { kind: 'table' },
        modifiers: [],
      },
    }),
  );
  const review = await member.query(api.canonicalDraftPersistence.preview, key);
  await t.mutation(internal.canonicalPersistenceFixtures.blockSuccessor, {
    ...key,
    scope: fixtureScope,
    operationId: 'collision',
  });
  const before = await t.mutation(
    internal.canonicalPersistenceFixtures.inspect,
    { ...key, scope: fixtureScope },
  );
  await expect(
    member.mutation(api.canonicalDraftPersistence.confirm, {
      ...key,
      operation: { operationId: 'collision', reviewed: review.reviewed },
    }),
  ).rejects.toThrow('Draft identity already used');
  expect(
    await t.mutation(internal.canonicalPersistenceFixtures.inspect, {
      ...key,
      scope: fixtureScope,
    }),
  ).toEqual(before);
  const receipt = await member.mutation(api.canonicalDraftPersistence.confirm, {
    ...key,
    operation: {
      operationId: 'explicit-new-attempt',
      reviewed: review.reviewed,
    },
  });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const retained = await t.run(async (ctx) => ({
    operations: await ctx.db.query('canonicalDraftOperation').take(100),
    targets: await ctx.db.query('canonicalDraftTarget').take(1),
    source: await ctx.db
      .query('canonicalWeeklyDraft')
      .withIndex('by_draftId', (q) => q.eq('draftId', key.draftId))
      .unique(),
  }));
  expect(retained.operations).toHaveLength(37);
  expect(
    retained.operations.every((row) => row.acceptedDraft === undefined),
  ).toBe(true);
  expect(retained.targets).toEqual([]);
  expect(retained.source?.initialDraft).toBeUndefined();
  expect(retained.source?.draft).toBeNull();
  expect(
    await send(
      operation(36, 'chance', {
        kind: 'event_chance',
        roll: {
          diceTotal: 100,
          diceCount: 1,
          sides: 100,
          provenance: { kind: 'table' },
          modifiers: [],
        },
      }),
    ),
  ).toMatchObject({ acceptedRevision: 37, observation: { status: 'closed' } });
  expect(
    await member.mutation(api.canonicalDraftPersistence.confirm, {
      ...key,
      operation: {
        operationId: 'explicit-new-attempt',
        reviewed: review.reviewed,
      },
    }),
  ).toEqual(receipt);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
});

test('[rules.P80.authority] ready Confirmation requires campaign authority and rejects corrupted source references without writes', async () => {
  const { t, key, member, send, operation } = await setup();
  await send(
    operation(0, 'chance', {
      kind: 'event_chance',
      roll: {
        diceTotal: 100,
        diceCount: 1,
        sides: 100,
        provenance: { kind: 'table' },
        modifiers: [],
      },
    }),
  );
  const review = await member.query(api.canonicalDraftPersistence.preview, key);
  const args = {
    ...key,
    operation: { operationId: 'refused', reviewed: review.reviewed },
  };
  await expect(
    t.mutation(api.canonicalDraftPersistence.confirm, args),
  ).rejects.toThrow('Campaign access required');
  await expect(
    t
      .withIdentity({ tokenIdentifier: 'outsider' })
      .mutation(api.canonicalDraftPersistence.confirm, args),
  ).rejects.toThrow('Campaign access required');
  await t.mutation(internal.canonicalPersistenceFixtures.changeSource, {
    ...key,
    scope: fixtureScope,
    change: 'invalid_reference',
  });
  const before = await t.run(async (ctx) => ({
    source: await ctx.db.query('canonicalMilitiaState').unique(),
    draft: await ctx.db.query('canonicalWeeklyDraft').unique(),
  }));
  await expect(
    member.mutation(api.canonicalDraftPersistence.confirm, args),
  ).rejects.toThrow();
  await expect(
    member.query(api.canonicalDraftPersistence.preview, key),
  ).rejects.toThrow();
  expect(
    await t.run(async (ctx) => ({
      source: await ctx.db.query('canonicalMilitiaState').unique(),
      draft: await ctx.db.query('canonicalWeeklyDraft').unique(),
    })),
  ).toEqual(before);
  expect(
    await t.run((ctx) => ctx.db.query('canonicalResolutionRecord').take(1)),
  ).toEqual([]);
});

test('[rules.P81.gateway] isolated Workspace source is authenticated, observes external facts and follows the empty successor', async () => {
  vi.useFakeTimers();
  const { t } = await setup();
  await t.mutation(internal.e2eFixtures.resetCase, { ...fixtureScope, now: 2 });
  const key = await t.mutation(
    internal.canonicalPersistenceFixtures.initializeUpkeep,
    { scope: fixtureScope, draftId: 'upkeep-view' },
  );
  const user = await t.run((ctx) => ctx.db.query('user').first());
  if (!user) throw new Error('Missing fixture member');
  const member = t.withIdentity({ tokenIdentifier: user.tokenIdentifier });
  await expect(
    t.query(api.canonicalDraftPersistence.workspace, {
      campaignId: key.campaignId,
    }),
  ).rejects.toThrow('Campaign access required');
  const source = await member.query(api.canonicalDraftPersistence.workspace, {
    campaignId: key.campaignId,
  });
  expect(source).toMatchObject({
    key,
    sourceRevision: 0,
    snapshot: { rank: 2, training: 14, treasuryCopper: 5000 },
  });
  expect(source?.week).toEqual(expect.any(Number));
  expect(source?.people[0]?.name).toBeTruthy();
  for (const [revision, edit] of [
    {
      kind: 'upkeep_roll' as const,
      field: 'check' as const,
      roll: {
        diceTotal: 10,
        diceCount: 1,
        sides: 20,
        provenance: { kind: 'table' as const },
        modifiers: [],
      },
    },
    {
      kind: 'upkeep_roll' as const,
      field: 'training' as const,
      roll: {
        diceTotal: 3,
        diceCount: 1,
        sides: 6,
        provenance: { kind: 'table' as const },
        modifiers: [],
      },
    },
  ].entries())
    await member.mutation(api.canonicalDraftPersistence.edit, {
      campaignId: key.campaignId,
      militiaId: key.militiaId,
      operation: {
        draftId: key.draftId,
        operationId: `upkeep-${revision}`,
        baseRevision: revision,
        edit,
      },
    });
  const review = await member.query(api.canonicalDraftPersistence.preview, key);
  expect(review.status).toBe('ready');
  await member.mutation(api.canonicalDraftPersistence.confirm, {
    ...key,
    operation: { operationId: 'workspace-next', reviewed: review.reviewed },
  });
  const successor = await member.query(
    api.canonicalDraftPersistence.workspace,
    { campaignId: key.campaignId },
  );
  expect(successor).toMatchObject({
    sourceRevision: 1,
    key: { draftId: 'next:workspace-next' },
    snapshot: { training: 11, treasuryCopper: 5000 },
    week: source!.week + 1,
  });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  vi.stubEnv('E2E_ENABLED', 'false');
  expect(
    await member.query(api.canonicalDraftPersistence.workspace, {
      campaignId: key.campaignId,
    }),
  ).toMatchObject({ key: { draftId: 'next:workspace-next' } });
});

test('[rules.P81.recovery-transaction] recovery and its reasoned adjustment commit together and reject stale direct adjustments without partial writes', async () => {
  const { t } = await setup();
  await t.mutation(internal.e2eFixtures.resetCase, { ...fixtureScope, now: 2 });
  const key = await t.mutation(
    internal.canonicalPersistenceFixtures.initializeUpkeep,
    { scope: fixtureScope, draftId: 'recovery', choices: true },
  );
  const user = await t.run((ctx) => ctx.db.query('user').first());
  if (!user) throw new Error('Missing member');
  const member = t.withIdentity({ tokenIdentifier: user.tokenIdentifier });
  const send = (
    baseRevision: number,
    operationId: string,
    intent: DraftOperation['edit'],
  ) =>
    member.mutation(edit, {
      campaignId: key.campaignId,
      militiaId: key.militiaId,
      operation: {
        draftId: key.draftId,
        baseRevision,
        operationId,
        edit: intent,
      },
    });
  const source = await member.query(api.canonicalDraftPersistence.workspace, {
    campaignId: key.campaignId,
  });
  expect(source?.snapshot.settlements.map((item) => item.name)).toEqual([
    'Phaendar',
    'Misthome',
  ]);
  await send(0, 'recover', {
    kind: 'upkeep_team',
    teamId: 'upkeep-scouts',
    decision: {
      teamId: 'upkeep-scouts',
      decision: 'recover',
      costCopper: 2000,
    },
    recoveryAdjustment: { deltaCopper: 500, reason: 'Local healers discount' },
  });
  const accepted = await member.query(observe, key);
  expect(accepted.draft?.upkeep.teamDecisions[0]?.decision).toBe('recover');
  expect(accepted.draft?.tableAdjustments).toEqual([
    {
      kind: 'militia_value',
      adjustmentId: 'upkeep-recovery:upkeep-scouts',
      field: 'treasuryCopper',
      operation: 'add',
      value: 500,
      reason: 'Local healers discount',
    },
  ]);
  await expect(
    send(0, 'stale-adjustment', { kind: 'table_adjustments', adjustments: [] }),
  ).rejects.toThrow('Target changed');
  expect(await member.query(observe, key)).toEqual(accepted);
  await send(1, 'adjudicate', { kind: 'table_adjustments', adjustments: [] });
  const adjudicated = await member.query(observe, key);
  await expect(
    send(1, 'stale-leave', {
      kind: 'upkeep_team',
      teamId: 'upkeep-scouts',
      decision: { teamId: 'upkeep-scouts', decision: 'leave' },
    }),
  ).rejects.toThrow('Target changed');
  expect(await member.query(observe, key)).toEqual(adjudicated);
});

test('[rules.P84.fixture] isolated Persistent preparation projects independent carried events and current buyoff cost', async () => {
  const { t } = await setup();
  await t.mutation(internal.e2eFixtures.resetCase, { ...fixtureScope, now: 2 });
  const key = await t.mutation(
    internal.canonicalPersistenceFixtures.initializeUpkeep,
    { scope: fixtureScope, draftId: 'persistent-view', persistent: true },
  );
  const user = await t.run((ctx) => ctx.db.query('user').first());
  if (!user) throw new Error('Missing fixture member');
  const member = t.withIdentity({ tokenIdentifier: user.tokenIdentifier });
  const source = await member.query(api.canonicalDraftPersistence.workspace, {
    campaignId: key.campaignId,
  });
  expect(source?.snapshot.treasuryCopper).toBe(50000);
  const observed = await member.query(observe, key);
  expect(
    observed.draft?.context.carriedEvents.map((event) => event.eventType),
  ).toEqual(['theft', 'theft', 'rivalry']);
  const review = await member.query(api.canonicalDraftPersistence.preview, key);
  expect(review.status).toBe('ready');
  await member.mutation(edit, {
    campaignId: key.campaignId,
    militiaId: key.militiaId,
    operation: {
      draftId: key.draftId,
      baseRevision: 0,
      operationId: 'buyoff',
      edit: {
        kind: 'persistent_decision',
        decision: { kind: 'buyoff', eventId: 'theft-old' },
      },
    },
  });
  const staged = await member.query(api.canonicalDraftPersistence.preview, key);
  expect(staged.outcome?.militiaSnapshot.treasuryCopper).toBe(
    (review.outcome?.militiaSnapshot.treasuryCopper ?? 0) - 4000,
  );
  expect(staged.outcome?.context.lastBuyoffWeek).toBe(4);
});

test('combined contract setup starts a fresh case and rolls back an invalid initialization', async () => {
  const { t, key } = await setup();
  const reset = internal.canonicalPersistenceFixtures.resetAndInitialize;
  const args = { scope: fixtureScope, draftId: 'next-case', now: 2 };
  const next = await t.mutation(reset, args);
  expect(next.campaignId).not.toBe(key.campaignId);
  const inspection = await t.mutation(
    internal.canonicalPersistenceFixtures.inspect,
    {
      ...next,
      scope: fixtureScope,
    },
  );
  expect(inspection.records).toHaveLength(0);
  expect(inspection.openDrafts).toHaveLength(1);
  await expect(t.mutation(reset, { ...args, draftId: '' })).rejects.toThrow();
  expect(
    await t.mutation(internal.canonicalPersistenceFixtures.inspect, {
      ...next,
      scope: fixtureScope,
    }),
  ).toEqual(inspection);
  await expect(
    t.mutation(reset, {
      ...args,
      scope: { ...fixtureScope, token: 'invalid' },
    }),
  ).rejects.toThrow();
  expect(
    await t.mutation(internal.canonicalPersistenceFixtures.inspect, {
      ...next,
      scope: fixtureScope,
    }),
  ).toEqual(inspection);
});

test('public nested roll validation rejects malformed totals atomically without relaxing campaign authority', async () => {
  const { t, key, member, operation } = await setup();
  const total = {
    diceTotal: 0,
    diceCount: 1,
    sides: 20,
    provenance: { kind: 'generated' as const, sourceId: 'dice-service' },
    modifiers: [{ sourceId: 'weather', value: -1, reason: 'Rain' }],
  };
  const before = await member.query(observe, key);
  const malformed = [
    { ...total, dice: [0] },
    { sides: 20, provenance: total.provenance, modifiers: [], diceTotal: 0 },
    { sides: 20, provenance: total.provenance, modifiers: [], diceCount: 1 },
    { ...total, diceTotal: -1 },
    { ...total, diceTotal: 0.5 },
    { ...total, diceTotal: Number.MAX_SAFE_INTEGER + 1 },
    { ...total, diceTotal: Number.NaN },
    { ...total, diceTotal: Infinity },
    { ...total, diceCount: 0 },
    { ...total, diceCount: -1 },
    { ...total, diceCount: 1.5 },
    { ...total, diceCount: Number.MAX_SAFE_INTEGER + 1 },
    { ...total, diceCount: Infinity },
    { ...total, provenance: { ...total.provenance, extra: true } },
    { ...total, modifiers: [{ ...total.modifiers[0], extra: true }] },
    { ...total, extra: true },
  ];
  for (const [index, roll] of malformed.entries()) {
    await expect(
      Reflect.apply(member.mutation, member, [
        edit,
        {
          campaignId: key.campaignId,
          militiaId: key.militiaId,
          operation: {
            draftId: key.draftId,
            operationId: `bad-total-${index}`,
            baseRevision: 0,
            edit: {
              kind: 'event_tree',
              occurrences: [
                {
                  eventId: 'nested',
                  origin: { kind: 'rolled' },
                  eventType: 'theft',
                  sabotage: { choiceId: 'defend', rolls: { check: roll } },
                },
              ],
            },
          },
        },
      ]),
    ).rejects.toThrow();
    expect(await member.query(observe, key)).toEqual(before);
  }
  const valid = operation(0, 'zero-total', {
    kind: 'upkeep_roll',
    field: 'check',
    roll: total,
  });
  const args = {
    campaignId: key.campaignId,
    militiaId: key.militiaId,
    operation: valid,
  };
  await expect(t.mutation(edit, args)).rejects.toThrow('Campaign access');
  await expect(
    t.withIdentity({ tokenIdentifier: 'outsider' }).mutation(edit, args),
  ).rejects.toThrow('Campaign access');
  expect(
    await t.run((ctx) => ctx.db.query('canonicalDraftOperation').take(1)),
  ).toEqual([]);
  await member.mutation(edit, args);
  expect((await member.query(observe, key)).draft?.upkeep.rolls.check).toEqual(
    total,
  );
  await expect(
    member.mutation(edit, {
      ...args,
      operation: operation(1, 'foreign-total', {
        kind: 'stage',
        slotId: 'left',
        choice: {
          choiceId: 'foreign',
          actionId: 'rescue_character',
          characterId: 'foreign-character',
          rolls: { check: total },
        },
      }),
    }),
  ).rejects.toThrow('Invalid draft entity reference');
  expect((await member.query(observe, key)).revision).toBe(1);
});

test('public edits reject unsupported roll fields across action and nested contexts without accepting a revision', async () => {
  const { key, member } = await setup();
  const before = await member.query(observe, key);
  const roll = {
    diceTotal: 7,
    diceCount: 2,
    sides: 6,
    provenance: { kind: 'table' },
    modifiers: [],
  };
  const occurrence = { eventId: 'nested', origin: { kind: 'rolled' } };
  const unsupported = [
    ...['earn_gold', 'special'].map((actionId) => ({
      kind: 'stage',
      slotId: 'left',
      choice: {
        choiceId: 'unsupported',
        actionId,
        rolls: { [actionId === 'earn_gold' ? 'reward' : 'check']: roll },
      },
    })),
    {
      kind: 'upkeep',
      inputs: { ...before.draft!.upkeep, rolls: { reward: roll } },
    },
    {
      kind: 'event_tree',
      occurrences: [{ ...occurrence, rolls: { duration: roll } }],
    },
    {
      kind: 'event_tree',
      occurrences: [
        {
          ...occurrence,
          targetChecks: [
            {
              target: { kind: 'event', eventId: 'nested' },
              rolls: { training: roll },
            },
          ],
        },
      ],
    },
    {
      kind: 'event_tree',
      occurrences: [
        {
          ...occurrence,
          sabotage: { choiceId: 'sabotage', rolls: { delivery: roll } },
        },
      ],
    },
    {
      kind: 'event_tree',
      occurrences: [
        {
          ...occurrence,
          persistent: true,
          persistentDecision: {
            eventId: 'nested',
            kind: 'mitigate',
            rolls: { loss: roll },
          },
        },
      ],
    },
    {
      kind: 'stage',
      slotId: 'left',
      choice: {
        actionId: 'guarantee_event',
        choiceId: 'candidate',
        candidates: [{ ...occurrence, rolls: { reward: roll } }],
      },
    },
  ];
  for (const [index, intent] of unsupported.entries()) {
    await expect(
      Reflect.apply(member.mutation, member, [
        edit,
        {
          campaignId: key.campaignId,
          militiaId: key.militiaId,
          operation: {
            draftId: key.draftId,
            operationId: `unsupported-${index}`,
            baseRevision: 0,
            edit: intent,
          },
        },
      ]),
    ).rejects.toThrow(/rolls/);
    expect(await member.query(observe, key)).toEqual(before);
  }
});

test('[rules.ACT-19.server] remove_slot checks the latest draft and current source allowance, replays by identity and refuses other scopes', async () => {
  const { t, key, member, operation, send } = await setup();
  const removal = operation(0, 'remove-extra', {
    kind: 'remove_slot',
    slotId: 'extra',
  });
  // Outsiders, anonymous callers and mismatched campaigns never reach the
  // allowance check and leave no operation receipt behind.
  const outsider = t.withIdentity({ tokenIdentifier: 'outsider' });
  await expect(
    outsider.mutation(edit, {
      campaignId: key.campaignId,
      militiaId: key.militiaId,
      operation: removal,
    }),
  ).rejects.toThrow('Campaign access');
  await expect(
    t.mutation(edit, {
      campaignId: key.campaignId,
      militiaId: key.militiaId,
      operation: removal,
    }),
  ).rejects.toThrow('Campaign access');
  const foreignCampaign = await t.run((ctx) =>
    ctx.db.insert('campaign', {
      name: 'Other',
      ownerId: 'other',
      organizationId: 'foreign',
      description: '',
    }),
  );
  await expect(
    member.mutation(edit, {
      campaignId: foreignCampaign,
      militiaId: key.militiaId,
      operation: removal,
    }),
  ).rejects.toThrow();
  expect((await member.query(observe, key)).revision).toBe(0);
  // Rank 1 allows one action; the first militia week has no Upkeep.
  await expect(
    send(operation(0, 'remove-left', { kind: 'remove_slot', slotId: 'left' })),
  ).rejects.toThrow('Slot is within the action allowance');
  await expect(
    send(operation(0, 'remove-none', { kind: 'remove_slot', slotId: 'none' })),
  ).rejects.toThrow('unknown_slot');
  // A correction raising the rank after the request's base widens the
  // allowance; the server judges the removal against the current source.
  await t.run(async (ctx) => {
    const state = await ctx.db.query('canonicalMilitiaState').unique();
    await ctx.db.patch('canonicalMilitiaState', state!._id, {
      snapshot: { ...state!.snapshot, rank: 2 },
    });
  });
  await expect(
    send(
      operation(0, 'remove-right', { kind: 'remove_slot', slotId: 'right' }),
    ),
  ).rejects.toThrow('Slot is within the action allowance');
  expect(await send(removal)).toMatchObject({ acceptedRevision: 1 });
  expect(await send(removal)).toMatchObject({ acceptedRevision: 1 });
  await expect(
    send(
      operation(0, 'remove-again', { kind: 'remove_slot', slotId: 'extra' }),
    ),
  ).rejects.toThrow();
  const observed = await member.query(observe, key);
  expect(observed.revision).toBe(1);
  expect(observed.draft?.activity.slots.map((slot) => slot.slotId)).toEqual([
    'left',
    'right',
  ]);
  expect(
    await t.run((ctx) => ctx.db.query('canonicalDraftOperation').collect()),
  ).toHaveLength(1);
  await t.mutation(internal.canonicalPersistenceFixtures.close, {
    ...key,
    scope: fixtureScope,
  });
  await expect(
    send(operation(1, 'closed', { kind: 'remove_slot', slotId: 'right' })),
  ).rejects.toThrow('Draft is closed');
});

// #164's two-device Sickness step: each device saves the whole occurrence it
// observed, changing a different field. The occurrence is one conflict target
// (#143 §5), so whichever save lands second on the same base is refused and
// can never write the other device's accepted field back.
test('stale whole-occurrence saves of different fields are refused in either order', async () => {
  const { key, member, send, operation } = await setup();
  const percentile = (value: number) => ({
    diceTotal: value,
    diceCount: 1,
    sides: 100,
    provenance: { kind: 'table' as const },
    modifiers: [],
  });
  const checkRoll = {
    diceTotal: 5,
    diceCount: 1,
    sides: 20,
    provenance: { kind: 'table' as const },
    modifiers: [],
  };
  const event = { eventId: 'sickness', origin: { kind: 'rolled' as const } };
  type Occurrence = Extract<
    DraftOperation['edit'],
    { kind: 'event_occurrence' }
  >['occurrence'];
  const sendOccurrence = (
    base: number,
    id: string,
    fields: Omit<Occurrence, 'eventId' | 'origin'>,
  ) =>
    send(
      operation(base, id, {
        kind: 'event_occurrence',
        occurrence: { ...event, ...fields },
      }),
    );
  await send(
    operation(0, 'tree', { kind: 'event_tree', occurrences: [event] }),
  );
  await sendOccurrence(1, 'observed', {
    tableRoll: percentile(90),
    rolls: { check: checkRoll },
  });
  // Both devices observed revision 2. The player's clear lands first.
  await sendOccurrence(2, 'player-clear', { tableRoll: percentile(90) });
  await expect(
    sendOccurrence(2, 'gm-roll', {
      tableRoll: percentile(45),
      rolls: { check: checkRoll },
    }),
  ).rejects.toThrow('Target changed');
  expect((await member.query(observe, key)).draft?.event.occurrences).toEqual([
    { ...event, tableRoll: percentile(90) },
  ]);
  // Both observed revision 3. The table roll lands first this time.
  await sendOccurrence(3, 'gm-retry', { tableRoll: percentile(45) });
  await expect(
    sendOccurrence(3, 'player-stale', {
      tableRoll: percentile(90),
      rolls: { check: checkRoll },
    }),
  ).rejects.toThrow('Target changed');
  const accepted = await member.query(observe, key);
  expect(accepted.revision).toBe(4);
  expect(accepted.draft?.event.occurrences).toEqual([
    { ...event, tableRoll: percentile(45) },
  ]);
});
