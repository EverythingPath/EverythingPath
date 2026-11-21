// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api, internal } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

async function fixture() {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    for (const name of ['Ada', 'Bryn', 'Cora'])
      await ctx.db.insert('user', {
        tokenIdentifier: `test|${name}`,
        name,
        orgIds: [{ orgId: 'org', role: 'member' }],
      });
  });
  const member = t.withIdentity({ tokenIdentifier: 'test|Ada' });
  const campaignId = await member.mutation(api.campaign.createCampaign, {
    name: 'Campaign',
    description: '',
    organizationId: 'org',
  });
  await t.run((ctx) =>
    ctx.db.patch('campaign', campaignId, {
      e2eFixture: {
        namespace: 'membership',
        version: 1,
        workerKey: '0',
        caseKey: 'membership',
        campaignKey: 'membership',
      },
    }),
  );
  const directoryArgs = {
    campaignId,
    paginationOpts: { cursor: null, numItems: 10 },
  };
  return { t, member, directoryArgs };
}

test('bounded backfill projects existing memberships, resumes by cursor and is safe to repeat', async () => {
  const { t, member, directoryArgs } = await fixture();
  expect(
    (await member.query(api.character.listOwnerCandidates, directoryArgs)).page,
  ).toEqual([]);
  const first = await t.mutation(internal.organizationMembership.backfill, {
    cursor: null,
  });
  expect(first.isDone).toBe(false);
  expect(
    (await member.query(api.character.listOwnerCandidates, directoryArgs)).page,
  ).toMatchObject([{ name: 'Ada', isMine: true }]);
  const second = await t.mutation(internal.organizationMembership.backfill, {
    cursor: first.continueCursor,
  });
  expect(second.isDone).toBe(false);
  const third = await t.mutation(internal.organizationMembership.backfill, {
    cursor: second.continueCursor,
  });
  let receipt = third;
  for (let batch = 0; !receipt.isDone && batch < 4; batch++)
    receipt = await t.mutation(internal.organizationMembership.backfill, {
      cursor: receipt.continueCursor,
    });
  expect(receipt.isDone).toBe(true);
  const before = await member.query(
    api.character.listOwnerCandidates,
    directoryArgs,
  );
  expect(before.page.map((candidate) => candidate.name)).toEqual([
    'Ada',
    'Bryn',
    'Cora',
  ]);
  await t.mutation(internal.organizationMembership.backfill, { cursor: null });
  expect(
    await member.query(api.character.listOwnerCandidates, directoryArgs),
  ).toEqual(before);
});

test('backfill cannot cross maintenance or reuse an earlier write epoch', async () => {
  const { t, member, directoryArgs } = await fixture();
  const run = await t.mutation(internal.initialMigration.start, {
    operationId: 'membership-backfill',
    expectedEpoch: 0,
    frontendBuild: 'test',
    catalogManifest: 'test',
    maintenanceBudgetMs: 60000,
  });
  await expect(
    t.mutation(internal.organizationMembership.backfill, { cursor: null }),
  ).rejects.toThrow('MAINTENANCE');
  expect(
    (await member.query(api.character.listOwnerCandidates, directoryArgs)).page,
  ).toEqual([]);
  await t.mutation(internal.initialMigration.abortBeforeActivation, run);
  await expect(
    t.mutation(internal.organizationMembership.backfill, { cursor: null }),
  ).rejects.toThrow('RELOAD_REQUIRED');
  await t.mutation(internal.organizationMembership.backfill, {
    cursor: null,
    writeEpoch: 2,
  });
  expect(
    (await member.query(api.character.listOwnerCandidates, directoryArgs)).page,
  ).toMatchObject([{ name: 'Ada' }]);
});

test('ordered membership and profile webhooks update both representations once and reject writes during maintenance', async () => {
  const { t, member, directoryArgs } = await fixture();
  const delivery = {
    tokenIdentifier: 'test|Bryn',
    orgId: 'org',
    role: 'member' as const,
    webhookUpdatedAt: 20,
  };
  await t.mutation(internal.user.addOrgIdToUser, delivery);
  await t.mutation(internal.user.addOrgIdToUser, delivery);
  await t.mutation(internal.user.updateRoleInOrgForUser, {
    ...delivery,
    role: 'admin',
    webhookUpdatedAt: 30,
  });
  await t.mutation(internal.user.addOrgIdToUser, delivery);
  const bryn = t.withIdentity({ tokenIdentifier: 'test|Bryn' });
  expect((await bryn.query(api.user.getMe, {}))?.orgIds).toEqual([
    { orgId: 'org', role: 'admin', webhookUpdatedAt: 30 },
  ]);
  expect(
    (await member.query(api.character.listOwnerCandidates, directoryArgs)).page,
  ).toMatchObject([{ name: 'Bryn' }]);
  await t.mutation(internal.user.updateUser, {
    tokenIdentifier: 'test|Ada',
    name: ' Ada updated ',
    image: '',
    webhookUpdatedAt: 40,
  });
  await t.mutation(internal.user.updateUser, {
    tokenIdentifier: 'test|Ada',
    name: 'Old',
    image: '',
    webhookUpdatedAt: 35,
  });
  expect(
    (await member.query(api.character.listOwnerCandidates, directoryArgs)).page,
  ).toMatchObject([
    { name: 'Ada updated', isMine: true },
    { name: 'Bryn', isMine: false },
  ]);
  const before = await member.query(
    api.character.listOwnerCandidates,
    directoryArgs,
  );
  await t.mutation(internal.initialMigration.start, {
    operationId: 'membership-freeze',
    expectedEpoch: 0,
    frontendBuild: 'test',
    catalogManifest: 'test',
    maintenanceBudgetMs: 60000,
  });
  await expect(
    t.mutation(internal.user.addOrgIdToUser, {
      tokenIdentifier: 'test|Cora',
      orgId: 'org',
      role: 'member',
      webhookUpdatedAt: 50,
    }),
  ).rejects.toThrow('MAINTENANCE');
  await expect(
    t.mutation(internal.user.updateUser, {
      tokenIdentifier: 'test|Ada',
      name: 'Blocked',
      image: '',
      webhookUpdatedAt: 50,
    }),
  ).rejects.toThrow('MAINTENANCE');
  expect(
    await member.query(api.character.listOwnerCandidates, directoryArgs),
  ).toEqual(before);
  expect((await member.query(api.user.getMe, {}))?.name).toBe(' Ada updated ');
});
