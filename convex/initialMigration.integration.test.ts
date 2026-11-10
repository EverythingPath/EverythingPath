// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { afterEach, expect, test, vi } from 'vitest';
import { api, internal } from './_generated/api';
import schema from './schema';
import { initializationEdits } from '../tests/rules/initialization-edits';
afterEach(() => vi.useRealTimers());
import { seedAcceptedCampaign } from './lib/acceptedCampaignFixture';

const modules = import.meta.glob('./**/*.ts');
const start = {
  operationId: 'first',
  expectedEpoch: 0,
  frontendBuild: 'build-258',
  catalogManifest: 'catalog-1',
  maintenanceBudgetMs: 60000,
};

test('closure preserves accepted edits and complete reads while rejecting subsequent writes; abort requires reload', async () => {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ tokenIdentifier: 'test|gm' });
  const { key } = await owner.run((ctx) => seedAcceptedCampaign(ctx));
  const command = {
    campaignId: key.campaignId,
    organizationId: 'org',
    description: 'Saved before maintenance',
  };
  await owner.mutation(api.campaign.updateCampaignDescription, command);
  const before = await owner.query(api.canonicalDraftPersistence.workspace, {
    campaignId: key.campaignId,
  });
  const run = await t.mutation(internal.initialMigration.start, start);
  expect(await t.query(api.cutover.status, {})).toBe('paused');
  expect(await t.query(api.initialMigration.clientStatus, {})).toEqual({
    status: 'maintenance',
    epoch: 1,
  });
  await expect(
    owner.mutation(api.campaign.updateCampaignDescription, {
      ...command,
      description: 'Late edit',
    }),
  ).rejects.toThrow('MAINTENANCE');
  expect(
    await owner.query(api.canonicalDraftPersistence.workspace, {
      campaignId: key.campaignId,
    }),
  ).toEqual(before);
  await t.mutation(internal.initialMigration.abortBeforeActivation, {
    runId: run.runId,
    epoch: run.epoch,
  });
  expect(await t.query(api.initialMigration.clientStatus, {})).toEqual({
    status: 'ready',
    epoch: 2,
  });
  expect(await t.query(api.cutover.status, {})).toBe('canonical');
  await expect(
    owner.mutation(api.campaign.updateCampaignDescription, command),
  ).rejects.toThrow('RELOAD_REQUIRED');
  await owner.mutation(api.campaign.updateCampaignDescription, {
    ...command,
    writeEpoch: 2,
  });
});

test('maintenance gates membership, fixture and import writers before they can change migration inputs', async () => {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ tokenIdentifier: 'test|gm' });
  await owner.run((ctx) => seedAcceptedCampaign(ctx));
  const before = await owner.query(api.user.getMe, {});
  await t.mutation(internal.initialMigration.start, start);
  await expect(
    t.mutation(internal.user.addOrgIdToUser, {
      tokenIdentifier: 'test|gm',
      orgId: 'new-org',
      role: 'member',
    }),
  ).rejects.toThrow('MAINTENANCE');
  await expect(
    owner.mutation(api.canonicalPersistenceFixtures.acceptedCampaign, {
      scope: {
        namespace: 'test',
        version: 1,
        workerKey: 'worker',
        caseKey: 'canonicalPersistence',
        session: 'session',
        token: 'token',
      },
    }),
  ).rejects.toThrow('MAINTENANCE');
  expect(await owner.query(api.user.getMe, {})).toEqual(before);
});

test('scheduled draft cleanup defers while maintenance is closed and completes after abort without a new epoch', async () => {
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  const member = t.withIdentity({ tokenIdentifier: 'test|player' });
  const { key, characterId } = await member.run((ctx) =>
    seedAcceptedCampaign(ctx),
  );
  const first = await t.mutation(internal.initialMigration.start, start);
  await t.mutation(internal.initialMigration.abortBeforeActivation, first);
  for (const [baseRevision, edit] of initializationEdits(
    'patrol',
    characterId,
  ).entries()) {
    await member.mutation(api.canonicalDraftPersistence.edit, {
      campaignId: key.campaignId,
      militiaId: key.militiaId,
      writeEpoch: 2,
      operation: {
        draftId: key.draftId,
        operationId: `edit-${baseRevision}`,
        baseRevision,
        edit,
      },
    });
  }
  const preview = await member.query(
    api.canonicalDraftPersistence.preview,
    key,
  );
  await member.mutation(api.canonicalDraftPersistence.confirm, {
    ...key,
    writeEpoch: 2,
    operation: { operationId: 'confirm', reviewed: preview.reviewed },
  });
  const jobs = await t.run((ctx) =>
    ctx.db.system.query('_scheduled_functions').collect(),
  );
  expect(jobs[0]?.args).toEqual([
    { draftId: key.draftId, afterRevision: 0, writeEpoch: 2 },
  ]);
  const second = await t.mutation(internal.initialMigration.start, {
    ...start,
    operationId: 'second',
    expectedEpoch: 2,
  });
  const before = await member.query(api.canonicalDraftPersistence.workspace, {
    campaignId: key.campaignId,
  });
  const cleanupState = () =>
    t.run(async (ctx) => ({
      operations: await ctx.db.query('canonicalDraftOperation').collect(),
      targets: await ctx.db.query('canonicalDraftTarget').collect(),
      scheduled: await ctx.db.system.query('_scheduled_functions').collect(),
    }));
  const cleanupBefore = await cleanupState();
  vi.runOnlyPendingTimers();
  await t.finishInProgressScheduledFunctions();
  const deferred = await cleanupState();
  expect(deferred.operations).toEqual(cleanupBefore.operations);
  expect(deferred.targets).toEqual(cleanupBefore.targets);
  expect(deferred.scheduled.map((job) => job.state.kind)).toEqual([
    'success',
    'pending',
  ]);
  expect(deferred.scheduled[1]?.scheduledTime).toBeGreaterThan(Date.now());
  expect(deferred.scheduled[1]?.args).toEqual(jobs[0]?.args);
  await t.mutation(internal.initialMigration.abortBeforeActivation, second);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const retired = await cleanupState();
  expect(retired.targets).toEqual([]);
  expect(retired.operations.length).toBeGreaterThan(0);
  expect(
    retired.operations.map(({ acceptedDraft: _, ...receipt }) => receipt),
  ).toEqual(
    cleanupBefore.operations.map(({ acceptedDraft: _, ...receipt }) => receipt),
  );
  expect(
    retired.operations.every(
      (operation) => operation.acceptedDraft === undefined,
    ),
  ).toBe(true);
  expect(retired.scheduled.every((job) => job.state.kind === 'success')).toBe(
    true,
  );
  expect(
    await member.query(api.canonicalDraftPersistence.workspace, {
      campaignId: key.campaignId,
    }),
  ).toEqual(before);
});

test('membership webhooks retry after maintenance and preserve newer provider state on redelivery', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(10000);
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ tokenIdentifier: 'test|gm' });
  await owner.run((ctx) => seedAcceptedCampaign(ctx));
  const run = await t.mutation(internal.initialMigration.start, start);
  const delivery = {
    tokenIdentifier: 'test|gm',
    orgId: 'delayed-org',
    role: 'member' as const,
    writeEpoch: 0,
    webhookUpdatedAt: 15000,
  };
  await expect(
    t.mutation(internal.user.addOrgIdToUser, delivery),
  ).rejects.toThrow('MAINTENANCE');
  vi.setSystemTime(20000);
  await t.mutation(internal.initialMigration.abortBeforeActivation, run);
  await t.mutation(internal.user.addOrgIdToUser, delivery);
  await t.mutation(internal.user.addOrgIdToUser, delivery);
  expect(
    (await owner.query(api.user.getMe, {}))?.orgIds.filter(
      (org) => org.orgId === 'delayed-org',
    ),
  ).toEqual([
    expect.objectContaining({ orgId: 'delayed-org', role: 'member' }),
  ]);
  await t.mutation(internal.user.updateRoleInOrgForUser, {
    ...delivery,
    role: 'admin',
    webhookUpdatedAt: 18000,
  });
  await t.mutation(internal.user.addOrgIdToUser, delivery);
  expect(
    (await owner.query(api.user.getMe, {}))?.orgIds.filter(
      (org) => org.orgId === 'delayed-org',
    ),
  ).toEqual([expect.objectContaining({ orgId: 'delayed-org', role: 'admin' })]);
});

test('user webhook upserts preserve membership and the newest provider profile across duplicate and reordered deliveries', async () => {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ tokenIdentifier: 'test|new' });
  const profile = {
    tokenIdentifier: 'test|new',
    name: 'Newer name',
    image: 'new.png',
    webhookUpdatedAt: 30,
  };
  await t.mutation(internal.user.updateUser, profile);
  await t.mutation(internal.user.addOrgIdToUser, {
    tokenIdentifier: profile.tokenIdentifier,
    orgId: 'org',
    role: 'member',
    webhookUpdatedAt: 40,
  });
  await t.mutation(internal.user.createUser, profile);
  await t.mutation(internal.user.createUser, {
    ...profile,
    name: 'Older name',
    image: 'old.png',
    webhookUpdatedAt: 20,
  });
  expect(await owner.query(api.user.getMe, {})).toMatchObject({
    name: 'Newer name',
    image: 'new.png',
    orgIds: [expect.objectContaining({ orgId: 'org', role: 'member' })],
  });
  await t.mutation(internal.user.updateUser, {
    ...profile,
    name: 'Latest name',
    webhookUpdatedAt: 50,
  });
  expect(await owner.query(api.user.getMe, {})).toMatchObject({
    name: 'Latest name',
  });
});

test.each(['write-first', 'close-first'] as const)(
  'gate closure serializes %s with in-flight commands',
  async (order) => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ tokenIdentifier: 'test|gm' });
    const { key } = await owner.run((ctx) => seedAcceptedCampaign(ctx));
    const write = () =>
      owner.mutation(api.campaign.updateCampaignDescription, {
        campaignId: key.campaignId,
        organizationId: 'org',
        description: 'Racing edit',
        writeEpoch: 0,
      });
    const close = () => t.mutation(internal.initialMigration.start, start);
    // convex-test serializes transactions. Exercise both admitted orderings; the
    // shared indexed gate read is the deployment OCC dependency, not a test lock.
    const results = await Promise.allSettled(
      order === 'write-first' ? [write(), close()] : [close(), write()],
    );
    const writeResult = results[order === 'write-first' ? 0 : 1];
    expect(writeResult?.status).toBe(
      order === 'write-first' ? 'fulfilled' : 'rejected',
    );
    const result = await owner.query(api.campaign.getCampaigns, {
      organizationId: 'org',
    });
    expect(result.state).toBe('ready');
    if (result.state !== 'ready') throw new Error('Missing campaign');
    expect(
      result.campaigns.find((campaign) => campaign._id === key.campaignId)
        ?.description,
    ).toBe(order === 'write-first' ? 'Racing edit' : '');
  },
);

test('operator status shows an exceeded maintenance budget until the window is reopened', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(10000);
  const t = convexTest(schema, modules);
  expect(
    await t.query(internal.initialMigration.status, { now: 10000 }),
  ).toMatchObject({ budgetExceeded: false });
  const run = await t.mutation(internal.initialMigration.start, start);
  expect(
    await t.query(internal.initialMigration.status, { now: 69999 }),
  ).toMatchObject({ budgetExceeded: false });
  expect(
    await t.query(internal.initialMigration.status, { now: 70000 }),
  ).toMatchObject({ budgetExceeded: true, closed: true });
  await t.mutation(internal.initialMigration.abortBeforeActivation, run);
  expect(
    await t.query(internal.initialMigration.status, { now: 80000 }),
  ).toMatchObject({ budgetExceeded: false, closed: false });
});

test('operator retries are idempotent, aborted runs cannot restart and a new run captures intervening edits', async () => {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ tokenIdentifier: 'test|gm' });
  const { key } = await owner.run((ctx) => seedAcceptedCampaign(ctx));
  const first = await t.mutation(internal.initialMigration.start, start);
  expect(await t.mutation(internal.initialMigration.start, start)).toEqual(
    first,
  );
  expect(
    await t.query(internal.initialMigration.status, { now: Date.now() }),
  ).toMatchObject({
    epoch: 1,
    closed: true,
    authority: 'legacy',
    run: {
      ...first,
      state: 'maintenance',
      frontendBuild: 'build-258',
      catalogManifest: 'catalog-1',
    },
  });
  await expect(
    t.mutation(internal.initialMigration.start, {
      ...start,
      catalogManifest: 'different',
    }),
  ).rejects.toThrow('already used');
  await t.mutation(internal.initialMigration.abortBeforeActivation, first);
  expect(
    await t.mutation(internal.initialMigration.abortBeforeActivation, first),
  ).toEqual({ epoch: 2 });
  await expect(
    t.mutation(internal.initialMigration.start, start),
  ).rejects.toThrow('already used');
  await expect(
    t.mutation(internal.initialMigration.start, {
      ...start,
      operationId: 'delayed',
    }),
  ).rejects.toThrow('state changed');
  await owner.mutation(api.campaign.updateCampaignDescription, {
    campaignId: key.campaignId,
    organizationId: 'org',
    description: 'Edited after abort',
    writeEpoch: 2,
  });
  const second = await t.mutation(internal.initialMigration.start, {
    ...start,
    operationId: 'fresh',
    expectedEpoch: 2,
  });
  expect(second.epoch).toBe(3);
  expect(second.runId).not.toBe(first.runId);
  await expect(
    t.mutation(internal.initialMigration.abortBeforeActivation, first),
  ).rejects.toThrow('no longer current');
  const campaigns = await owner.query(api.campaign.getCampaigns, {
    organizationId: 'org',
  });
  expect(campaigns).toMatchObject({
    campaigns: [expect.objectContaining({ description: 'Edited after abort' })],
  });
});

test('abort refuses activated authority and client commands require reload after activation', async () => {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ tokenIdentifier: 'test|gm' });
  const { key } = await owner.run((ctx) => seedAcceptedCampaign(ctx));
  const run = await t.mutation(internal.initialMigration.start, start);
  // Activation is a later ticket. Seed its authoritative state to verify this
  // pre-activation control cannot reopen legacy writes once authority changes.
  await t.run(async (ctx) => {
    const control = await ctx.db.query('initialMigrationControl').unique();
    await ctx.db.patch('initialMigrationControl', control!._id, {
      authority: 'sheet',
      closed: false,
    });
    await ctx.db.patch('initialMigrationRun', run.runId, {
      state: 'activated',
    });
  });
  await expect(
    t.mutation(internal.initialMigration.abortBeforeActivation, run),
  ).rejects.toThrow('has activated');
  await expect(
    owner.mutation(api.campaign.updateCampaignDescription, {
      campaignId: key.campaignId,
      organizationId: 'org',
      description: 'Delayed legacy command',
      writeEpoch: 0,
    }),
  ).rejects.toThrow('RELOAD_REQUIRED');
  expect(await t.query(api.initialMigration.clientStatus, {})).toEqual({
    status: 'reload_required',
    epoch: 1,
  });
});

test('Character edits committed before closure remain readable and later Character changes leave the complete legacy state untouched', async () => {
  const t = convexTest(schema, modules);
  const member = t.withIdentity({ tokenIdentifier: 'test|player' });
  const { key, characterId } = await member.run((ctx) =>
    seedAcceptedCampaign(ctx),
  );
  await member.mutation(api.character.updateCharacter, {
    organizationId: 'org',
    characterId,
    patch: { name: 'Saved character', charisma: 18 },
  });
  const args = {
    campaignId: key.campaignId,
    organizationId: 'org',
    includeInactive: true,
  };
  const characters = await member.query(api.character.listByCampaign, args);
  const workspace = await member.query(
    api.canonicalDraftPersistence.workspace,
    { campaignId: key.campaignId },
  );
  expect(characters).toEqual([
    expect.objectContaining({
      _id: characterId,
      name: 'Saved character',
      charisma: 18,
    }),
  ]);
  await t.mutation(internal.initialMigration.start, start);
  await expect(
    member.mutation(api.character.updateCharacter, {
      organizationId: 'org',
      characterId,
      patch: { name: 'Rejected edit', charisma: 20 },
    }),
  ).rejects.toThrow('MAINTENANCE');
  await expect(
    member.mutation(api.character.archiveCharacter, {
      organizationId: 'org',
      characterId,
      isActive: false,
    }),
  ).rejects.toThrow('MAINTENANCE');
  expect(await member.query(api.character.listByCampaign, args)).toEqual(
    characters,
  );
  expect(
    await member.query(api.canonicalDraftPersistence.workspace, {
      campaignId: key.campaignId,
    }),
  ).toEqual(workspace);
});
