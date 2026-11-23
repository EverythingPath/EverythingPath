// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';
const modules = import.meta.glob('./**/*.ts');

async function fixture() {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await ctx.db.insert('user', {
      tokenIdentifier: 'test|member',
      orgIds: [{ orgId: 'org', role: 'member' }],
    });
    await ctx.db.insert('user', {
      tokenIdentifier: 'test|outsider',
      orgIds: [{ orgId: 'other', role: 'admin' }],
    });
  });
  const campaignId = await t.run((ctx) =>
    ctx.db.insert('campaign', {
      name: 'Ironfang Invasion',
      ownerId: 'test|gm',
      organizationId: 'org',
      description: 'Book 2, Thursday group.',
      inGameDate: '2026-03-22',
    }),
  );
  return {
    t,
    campaignId,
    member: t.withIdentity({ tokenIdentifier: 'test|member' }),
    outsider: t.withIdentity({ tokenIdentifier: 'test|outsider' }),
  };
}

async function pause(t: Awaited<ReturnType<typeof fixture>>['t']) {
  await t.run((ctx) =>
    ctx.db.insert('campaignCutover', {
      key: 'weekly-draft',
      status: 'paused',
      operationId: 'pause',
      oldRelease: 'old',
      newRelease: 'canonical',
      campaignIds: [],
      pausedAt: 0,
    }),
  );
}

test('createCampaign returns the inserted campaign id, even for a duplicate name', async () => {
  const { member } = await fixture();
  const args = {
    name: 'Second Table',
    description: 'Line one\nLine two',
    organizationId: 'org',
  };
  const first = await member.mutation(api.campaign.createCampaign, args);
  const second = await member.mutation(api.campaign.createCampaign, args);
  expect(first).not.toEqual(second);
  const list = await member.query(api.campaign.getCampaigns, {
    organizationId: 'org',
  });
  expect(list.state).toBe('ready');
  const created = list.state === 'ready' ? list.campaigns : [];
  expect(created.find((c) => c._id === first)).toMatchObject({
    name: 'Second Table',
    description: 'Line one\nLine two',
    organizationId: 'org',
    ownerId: 'test|member',
  });
  expect(created.find((c) => c._id === second)?.name).toBe('Second Table');
  expect(created.find((c) => c._id === first)?.inGameDate).toBeUndefined();
});

test('createCampaign writes only for a signed-in member of the organization and not during maintenance', async () => {
  const { t, member, outsider } = await fixture();
  const args = { name: 'Blocked', description: '', organizationId: 'org' };
  await expect(t.mutation(api.campaign.createCampaign, args)).rejects.toThrow(
    'You do not have access to this org',
  );
  await expect(
    outsider.mutation(api.campaign.createCampaign, args),
  ).rejects.toThrow('You do not have access to this org');
  await pause(t);
  await expect(
    member.mutation(api.campaign.createCampaign, args),
  ).rejects.toThrow(
    'Editing is paused for maintenance. Saved information remains available.',
  );
  const list = await member.query(api.campaign.getCampaigns, {
    organizationId: 'org',
  });
  expect(list.state === 'ready' && list.campaigns.map((c) => c.name)).toEqual([
    'Ironfang Invasion',
  ]);
});

test('updateCampaignDescription patches only the description and returns the updated campaign', async () => {
  const { t, member, campaignId } = await fixture();
  const before = await t.run((ctx) => ctx.db.get('campaign', campaignId));
  const updated = await member.mutation(
    api.campaign.updateCampaignDescription,
    {
      campaignId,
      organizationId: 'org',
      description: 'The refugees regroup.\n\nPhaendar holds.',
    },
  );
  expect(updated).toEqual({
    ...before,
    description: 'The refugees regroup.\n\nPhaendar holds.',
  });
  const cleared = await member.mutation(
    api.campaign.updateCampaignDescription,
    { campaignId, organizationId: 'org', description: '' },
  );
  expect(cleared).toEqual({ ...before, description: '' });
});

test('updateCampaignDescription rejects signed-out, outsider, mismatched, deleted and paused writes without changing the campaign', async () => {
  const { t, member, outsider, campaignId } = await fixture();
  const foreignId = await t.run((ctx) =>
    ctx.db.insert('campaign', {
      name: 'Foreign',
      ownerId: 'test|outsider',
      organizationId: 'other',
      description: 'Foreign notes',
    }),
  );
  const deletedId = await t.run(async (ctx) => {
    const id = await ctx.db.insert('campaign', {
      name: 'Deleted',
      ownerId: 'test|gm',
      organizationId: 'org',
      description: '',
    });
    await ctx.db.delete('campaign', id);
    return id;
  });
  const write = (campaign = campaignId, organizationId = 'org') => ({
    campaignId: campaign,
    organizationId,
    description: 'Overwritten',
  });
  await expect(
    t.mutation(api.campaign.updateCampaignDescription, write()),
  ).rejects.toThrow('You do not have access to this org');
  await expect(
    outsider.mutation(api.campaign.updateCampaignDescription, write()),
  ).rejects.toThrow('You do not have access to this org');
  // The outsider's own organization cannot reach another organization's campaign.
  await expect(
    outsider.mutation(
      api.campaign.updateCampaignDescription,
      write(campaignId, 'other'),
    ),
  ).rejects.toThrow('No campaign exists for this organization');
  // A member cannot reach a foreign campaign through their own organization.
  await expect(
    member.mutation(
      api.campaign.updateCampaignDescription,
      write(foreignId, 'org'),
    ),
  ).rejects.toThrow('No campaign exists for this organization');
  await expect(
    member.mutation(api.campaign.updateCampaignDescription, write(deletedId)),
  ).rejects.toThrow('No campaign exists for this organization');
  await pause(t);
  await expect(
    member.mutation(api.campaign.updateCampaignDescription, write()),
  ).rejects.toThrow(
    'Editing is paused for maintenance. Saved information remains available.',
  );
  const [own, foreign] = await t.run(async (ctx) => [
    await ctx.db.get('campaign', campaignId),
    await ctx.db.get('campaign', foreignId),
  ]);
  expect(own?.description).toBe('Book 2, Thursday group.');
  expect(foreign?.description).toBe('Foreign notes');
});

test('updateCampaignInGameDate keeps its optional date-only contract and leaves the description alone', async () => {
  const { t, member, campaignId } = await fixture();
  const set = await member.mutation(api.campaign.updateCampaignInGameDate, {
    campaignId,
    organizationId: 'org',
    inGameDate: '2026-02-28',
  });
  expect(set).toMatchObject({
    inGameDate: '2026-02-28',
    description: 'Book 2, Thursday group.',
  });
  const cleared = await member.mutation(api.campaign.updateCampaignInGameDate, {
    campaignId,
    organizationId: 'org',
  });
  expect(cleared?.inGameDate).toBeUndefined();
  expect(cleared?.description).toBe('Book 2, Thursday group.');
  await expect(
    t.mutation(api.campaign.updateCampaignInGameDate, {
      campaignId,
      organizationId: 'org',
      inGameDate: '2026-01-01',
    }),
  ).rejects.toThrow('You do not have access to this org');
});
