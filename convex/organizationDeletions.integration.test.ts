// @vitest-environment edge-runtime
import { afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { refuseRepeatedPaginatedQueries } from '../tests/convex-paginated-queries';
import schema from './schema';
import { preloadCalledConvexModules } from '../tests/convex-modules';
import {
  campaignFixture,
  createCharacter,
  deliver,
  finishBackgroundWork,
  finishMilitiaWeek,
  fixtureCampaign,
  listDeletedCampaigns,
  outcome,
  readMoveStates,
  readSheet,
  runUntil,
  setBaseScoresHolder,
  takeOwnership,
  token,
  type CampaignFixture,
  type Viewer,
} from '../tests/container-deletion';
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';

// The provider's signature verifier is the external boundary; the real HTTP
// route, action and mutations run beneath it without provider credentials.
vi.mock('svix', () => ({
  Webhook: class {
    verify(payload: string, headers: Record<string, string>) {
      if (headers['svix-signature'] !== 'valid')
        throw new Error('Invalid signature');
      return JSON.parse(payload);
    }
  },
}));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const modules = import.meta.glob('./**/*.ts');
beforeAll(() => refuseRepeatedPaginatedQueries(schema, modules));
preloadCalledConvexModules({ modules, testFile: import.meta.url });
// Provider deliveries and helper calls reach these modules too.
beforeAll(async () => {
  for (const name of [
    'http',
    'clerk',
    'user',
    'organizationDepartures',
    'accountDeletions',
    'campaignDeletions',
    'canonicalSetup',
    'canonicalDraftPersistence',
    'characterSheet',
    'character',
    'characterMoves',
    'catalogCopies',
  ])
    await modules[`./${name}.ts`]?.();
}, 30_000);

/** The owner's Vessa and the member's Rook share the campaign. */
async function fixture() {
  const context = await campaignFixture(modules);
  const vessaId = await createCharacter(
    context.owner,
    context.campaignId,
    'Vessa',
  );
  const rookId = await createCharacter(
    context.member,
    context.campaignId,
    'Rook',
  );
  return { ...context, vessaId, rookId };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;

/** Orrin, whose owner's account was deleted, needs an owner in the campaign. */
async function addOwnerlessCharacter({ t, campaignId }: CampaignFixture) {
  await t.run(async (ctx) => {
    const userId = await ctx.db.insert('user', {
      tokenIdentifier: token('gone'),
      name: 'gone player',
      orgIds: [{ orgId: 'org', role: 'member', webhookUpdatedAt: 1 }],
      characterSheetDemo: true,
    });
    await ctx.db.insert('organizationMembership', {
      userId,
      organizationId: 'org',
    });
  });
  const gone = t.withIdentity({ tokenIdentifier: token('gone') });
  const orrinId = await createCharacter(gone, campaignId, 'Orrin');
  await deliver(t, { type: 'user.deleted', userId: 'gone' });
  await finishBackgroundWork(t);
  return orrinId;
}

function readOrganizationDeletion(t: Fixture['t']) {
  return t.run((ctx) => ctx.db.query('organizationDeletion').first());
}

function listRecovery(t: Fixture['t']) {
  return t.query(internal.organizationDeletions.listRecovery, {
    organizationId: 'org',
  });
}

/** Whether the viewer can still reach anything in the organization. */
async function readAccess(viewer: Viewer, campaignId: Id<'campaign'>) {
  return {
    status: await viewer.query(api.user.getOrgAccessStatus, {
      organizationId: 'org',
    }),
    campaigns: await viewer.query(api.campaign.getCampaigns, {
      organizationId: 'org',
    }),
    history: await outcome(
      viewer.query(api.canonicalHistory.list, { campaignId }),
    ),
    deletions: await listDeletedCampaigns(viewer),
    organizationDeletion: await viewer.query(api.organizationDeletions.status, {
      organizationId: 'org',
    }),
  };
}

const noAccess = {
  status: { state: 'no_access' },
  campaigns: { state: 'no_access' },
  history: 'Campaign access required',
  deletions: [],
  organizationDeletion: null,
};

test('a provider organization deletion revokes every member’s access at once, returns surviving owners’ Characters and keeps ownerless ones as inaccessible recovery data', async () => {
  const context = await fixture();
  const { t, owner, member, outsider, campaignId, vessaId, rookId } = context;
  const orrinId = await addOwnerlessCharacter(context);

  await deliver(t, { type: 'organization.deleted', orgId: 'org' });

  // Before any background work runs, nobody can reach the organization.
  for (const viewer of [owner, member, outsider])
    expect(await readAccess(viewer, campaignId)).toEqual(noAccess);
  for (const characterId of [vessaId, rookId, orrinId])
    expect(await outcome(readSheet(member, characterId))).toBe(
      'Character not found',
    );

  await finishBackgroundWork(t);

  // Surviving owners have their Characters back, outside any campaign.
  for (const [viewer, characterId] of [
    [owner, vessaId],
    [member, rookId],
  ] as const) {
    const sheet = await readSheet(viewer, characterId);
    expect(sheet?.campaign).toBeNull();
    expect(sheet?.updatedBy).toBe('system:organizationDeparture');
  }
  // The ownerless Character is kept, with its sheet, for the operator only.
  for (const viewer of [owner, member, outsider])
    expect(await outcome(readSheet(viewer, orrinId))).toBe(
      'Character not found',
    );
  for (const viewer of [owner, member])
    expect(await viewer.query(api.character.listOwned, {})).toMatchObject([
      { kind: 'noCampaign', characters: [expect.anything()] },
    ]);
  expect(await listRecovery(t)).toEqual([
    {
      campaignId,
      campaignName: 'Ironfang',
      characters: [{ characterId: orrinId, name: 'Orrin', ownerId: null }],
    },
  ]);
  const retained = await t.run(async (ctx) => ({
    campaign: await ctx.db.get('campaign', campaignId),
    character: await ctx.db.get('character', orrinId),
    entries: await ctx.db
      .query('characterSheetEntry')
      .withIndex('by_characterId', (q) => q.eq('characterId', orrinId))
      .take(10),
    definitions: await ctx.db
      .query('catalogEntry')
      .withIndex('by_characterId', (q) => q.eq('characterId', orrinId))
      .take(10),
  }));
  expect(retained.campaign).toMatchObject({ name: 'Ironfang' });
  expect(retained.character).toMatchObject({ campaignId, name: 'Orrin' });
  expect(retained.character?.ownerId).toBeUndefined();
  expect(retained.entries.length).toBeGreaterThan(0);
  expect(retained.definitions.length).toBeGreaterThan(0);
  // Former membership grants nothing.
  for (const viewer of [owner, member])
    expect(await readAccess(viewer, campaignId)).toEqual(noAccess);
  expect(await readOrganizationDeletion(t)).toMatchObject({
    state: 'completed',
    recoveryRetained: 1,
  });
  const memberships = await t.run(async (ctx) => ({
    directory: await ctx.db
      .query('organizationMembership')
      .withIndex('by_organizationId_and_userId', (q) =>
        q.eq('organizationId', 'org'),
      )
      .take(10),
    users: (await ctx.db.query('user').take(10)).flatMap((user) =>
      user.orgIds.map((org) => org.orgId),
    ),
  }));
  expect(memberships).toEqual({ directory: [], users: ['other'] });
});

test('repeated and reordered provider events after an organization deletion restore nothing and return each Character once', async () => {
  const { t, owner, member, campaignId, vessaId, rookId } = await fixture();
  await finishMilitiaWeek(member, campaignId, rookId);
  await deliver(t, { type: 'organization.deleted', orgId: 'org' });
  await deliver(t, { type: 'organization.deleted', orgId: 'org' });
  // Membership events from before and after the deletion arrive late.
  for (const updatedAt of [1, 9])
    for (const type of [
      'organizationMembership.created',
      'organizationMembership.updated',
      'organizationMembership.deleted',
    ] as const)
      await deliver(t, { type, userId: 'owner', orgId: 'org', updatedAt });
  // Even an account the app hasn't seen gets nothing, so the provider stops.
  await deliver(t, {
    type: 'organizationMembership.created',
    userId: 'stranger',
    orgId: 'org',
    updatedAt: 3,
  });
  for (const viewer of [owner, member])
    expect(await readAccess(viewer, campaignId)).toEqual(noAccess);

  await finishBackgroundWork(t);
  await deliver(t, { type: 'organization.deleted', orgId: 'org' });
  await deliver(t, {
    type: 'organizationMembership.created',
    userId: 'member',
    orgId: 'org',
    updatedAt: 10,
  });
  await finishBackgroundWork(t);

  for (const characterId of [vessaId, rookId])
    expect(await readMoveStates(t, characterId)).toEqual(['completed']);
  expect((await readSheet(owner, vessaId))?.campaign).toBeNull();
  for (const viewer of [owner, member])
    expect(await readAccess(viewer, campaignId)).toEqual(noAccess);
  const departures = await t.run((ctx) =>
    ctx.db.query('organizationDeparture').take(10),
  );
  expect(
    departures.map(({ round, state, outcome }) => ({ round, state, outcome })),
  ).toEqual([
    { round: 1, state: 'completed', outcome: 'returned' },
    { round: 1, state: 'completed', outcome: 'returned' },
  ]);
  // With no Characters left, the campaign is deleted; its history is kept
  // but nobody can read it.
  expect(await listRecovery(t)).toEqual([]);
  const kept = await t.run(async (ctx) => ({
    campaign: await ctx.db.get('campaign', campaignId),
    deletion: await ctx.db
      .query('campaignDeletion')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
      .unique(),
    records: await ctx.db
      .query('canonicalResolutionRecord')
      .withIndex('by_campaignId_and_week_and_sequence', (q) =>
        q.eq('campaignId', campaignId),
      )
      .take(10),
  }));
  expect(kept.campaign).toBeNull();
  expect(kept.deletion).toMatchObject({ state: 'deleted' });
  expect(kept.records.length).toBeGreaterThan(0);
  expect(await readOrganizationDeletion(t)).toMatchObject({
    state: 'completed',
    round: 1,
  });
});

test('an organization deleted during a membership return returns the departed owner’s Character once', async () => {
  const { t, owner, member, campaignId, vessaId, rookId } = await fixture();
  await deliver(t, {
    type: 'organizationMembership.deleted',
    userId: 'owner',
    orgId: 'org',
    updatedAt: 2,
  });
  await runUntil(t, async () =>
    (await readMoveStates(t, vessaId)).includes('preparing'),
  );
  await deliver(t, { type: 'organization.deleted', orgId: 'org' });
  await finishBackgroundWork(t);

  expect(await readMoveStates(t, vessaId)).toEqual(['completed']);
  expect((await readSheet(owner, vessaId))?.campaign).toBeNull();
  expect((await readSheet(member, rookId))?.campaign).toBeNull();
  expect(
    await owner.query(api.organizationDepartures.listReturning, {}),
  ).toEqual([]);
  expect(await listRecovery(t)).toEqual([]);
  expect(await readAccess(member, campaignId)).toEqual(noAccess);
});

test.each(['before', 'after'] as const)(
  'an account deleted %s the organization’s deletion keeps its campaign Character ownerless as inaccessible recovery data',
  async (accountOrder) => {
    const { t, owner, member, campaignId, vessaId, rookId } = await fixture();
    const deleteAccount = () =>
      deliver(t, { type: 'user.deleted', userId: 'owner' });
    if (accountOrder === 'before') await deleteAccount();
    await deliver(t, { type: 'organization.deleted', orgId: 'org' });
    if (accountOrder === 'after') await deleteAccount();
    await finishBackgroundWork(t);

    expect((await readSheet(member, rookId))?.campaign).toBeNull();
    for (const viewer of [owner, member])
      expect(await outcome(readSheet(viewer, vessaId))).toBe(
        'Character not found',
      );
    expect(await listRecovery(t)).toEqual([
      {
        campaignId,
        campaignName: 'Ironfang',
        characters: [{ characterId: vessaId, name: 'Vessa', ownerId: null }],
      },
    ]);
    expect(await readMoveStates(t, vessaId)).toEqual([]);
    expect(
      await t.run((ctx) => ctx.db.query('accountDeletion').first()),
    ).toMatchObject({ state: 'completed' });
  },
);

test('an organization deleted during an app campaign deletion lets it finish, returning each Character once', async () => {
  const { t, owner, member, campaignId, vessaId, rookId } = await fixture();
  await member.mutation(api.campaignDeletions.request, { campaignId });
  await runUntil(t, async () =>
    (await readMoveStates(t, vessaId)).includes('preparing'),
  );
  await deliver(t, { type: 'organization.deleted', orgId: 'org' });
  await finishBackgroundWork(t);

  for (const characterId of [vessaId, rookId])
    expect(await readMoveStates(t, characterId)).toEqual(['completed']);
  expect((await readSheet(owner, vessaId))?.campaign).toBeNull();
  expect((await readSheet(member, rookId))?.campaign).toBeNull();
  expect(await readAccess(member, campaignId)).toEqual(noAccess);
  expect(
    await t.run((ctx) => ctx.db.query('campaignDeletion').first()),
  ).toMatchObject({ state: 'deleted' });
  expect(await listRecovery(t)).toEqual([]);
});

test('a campaign kept because a Character’s return keeps failing counts as recovery data, and its owner can’t reach it', async () => {
  const { t, owner, member, campaignId, vessaId, rookId } = await fixture();
  await setBaseScoresHolder(t, vessaId, rookId);
  await member.mutation(api.campaignDeletions.request, { campaignId });
  await runUntil(
    t,
    async () =>
      (await member.query(api.campaignDeletions.status, { campaignId }))
        ?.setAside === 1,
  );
  await deliver(t, { type: 'organization.deleted', orgId: 'org' });
  await runUntil(
    t,
    async () => (await readOrganizationDeletion(t))?.state === 'completed',
  );

  expect(await readOrganizationDeletion(t)).toMatchObject({
    recoveryRetained: 1,
  });
  expect((await readSheet(member, rookId))?.campaign).toBeNull();
  expect(await outcome(readSheet(owner, vessaId))).toBe('Character not found');
  expect(await listRecovery(t)).toEqual([
    {
      campaignId,
      campaignName: 'Ironfang',
      characters: [
        { characterId: vessaId, name: 'Vessa', ownerId: token('owner') },
      ],
    },
  ]);
});

test('an admin deletes the organization in the app: every campaign returns its Characters and is deleted first, then the provider deletion completes it', async () => {
  const { t, owner, member, outsider, campaignId, vessaId, rookId } =
    await fixture();
  const emberwoodId = await t.run((ctx) =>
    ctx.db.insert('campaign', {
      name: 'Emberwood',
      description: '',
      organizationId: 'org',
      ownerId: token('owner'),
      e2eFixture: fixtureCampaign('emberwood'),
    }),
  );
  const keldId = await createCharacter(owner, emberwoodId, 'Keld');
  const request = (viewer: Viewer) =>
    viewer.mutation(api.organizationDeletions.request, {
      organizationId: 'org',
    });
  await expect(request(owner)).rejects.toThrow(
    'Only an organization admin can delete it',
  );
  await expect(request(outsider)).rejects.toThrow(
    'You do not have access to this org',
  );
  await expect(request(t)).rejects.toThrow(
    'You do not have access to this org',
  );
  expect(await readOrganizationDeletion(t)).toBeNull();

  expect(await request(member)).toEqual({
    state: 'preparing',
    campaignsRemaining: 2,
    blockedCampaigns: 0,
  });
  for (const viewer of [outsider, t])
    expect(
      await viewer.query(api.organizationDeletions.status, {
        organizationId: 'org',
      }),
    ).toBeNull();
  await expect(
    member.mutation(api.campaign.createCampaign, {
      name: 'Late',
      description: '',
      organizationId: 'org',
    }),
  ).rejects.toThrow('This organization is being deleted');
  await finishBackgroundWork(t);

  // Ready for the admin to delete the organization with the provider.
  expect(
    await owner.query(api.organizationDeletions.status, {
      organizationId: 'org',
    }),
  ).toEqual({ state: 'ready', campaignsRemaining: 0, blockedCampaigns: 0 });
  for (const [viewer, characterId] of [
    [owner, vessaId],
    [owner, keldId],
    [member, rookId],
  ] as const) {
    const sheet = await readSheet(viewer, characterId);
    expect(sheet?.campaign).toBeNull();
    expect(sheet?.updatedBy).toBe('system:campaignDeletion');
  }
  expect(await listDeletedCampaigns(member)).toMatchObject([
    { campaignId, state: 'deleted' },
    { campaignId: emberwoodId, state: 'deleted' },
  ]);

  await deliver(t, { type: 'organization.deleted', orgId: 'org' });
  await finishBackgroundWork(t);

  expect(await readOrganizationDeletion(t)).toMatchObject({
    state: 'completed',
  });
  expect(await listRecovery(t)).toEqual([]);
  expect(await readAccess(member, campaignId)).toEqual(noAccess);
  expect((await readSheet(owner, keldId))?.campaign).toBeNull();
});

test('an app organization deletion is refused while a Character needs an owner, and one that loses its owner meanwhile blocks it until assigned', async () => {
  const { t, owner, member, campaignId, vessaId } = await fixture();
  const request = () =>
    member.mutation(api.organizationDeletions.request, {
      organizationId: 'org',
    });
  const productionId = await t.run((ctx) =>
    ctx.db.insert('campaign', {
      name: 'Live table',
      description: '',
      organizationId: 'org',
      ownerId: token('member'),
    }),
  );
  await expect(request()).rejects.toThrow(
    "Deleting isn't available for this organization yet.",
  );
  await t.run((ctx) => ctx.db.delete('campaign', productionId));

  await request();
  await deliver(t, { type: 'user.deleted', userId: 'owner' });
  await finishBackgroundWork(t);

  expect(
    await member.query(api.organizationDeletions.status, {
      organizationId: 'org',
    }),
  ).toEqual({ state: 'blocked', campaignsRemaining: 1, blockedCampaigns: 1 });
  expect(
    await member.query(api.campaignDeletions.status, { campaignId }),
  ).toMatchObject({ state: 'blocked', blockers: { ownerless: 1 } });
  await expect(request()).rejects.toThrow('1 Character needs an owner.');
  // A blocked deletion is paused, so the organization stays usable.
  await member.mutation(api.campaign.createCampaign, {
    name: 'Meanwhile',
    description: '',
    organizationId: 'org',
  });

  await takeOwnership(t, member, 'member', campaignId, vessaId);
  await expect(request()).rejects.toThrow(
    "Deleting isn't available for this organization yet.",
  );
  const meanwhile = await t.run((ctx) =>
    ctx.db
      .query('campaign')
      .withIndex('by_organization', (q) => q.eq('organizationId', 'org'))
      .filter((q) => q.eq(q.field('name'), 'Meanwhile'))
      .unique(),
  );
  await t.run((ctx) => ctx.db.delete('campaign', meanwhile!._id));
  expect(await request()).toMatchObject({ state: 'preparing' });
  await finishBackgroundWork(t);

  expect(
    await member.query(api.organizationDeletions.status, {
      organizationId: 'org',
    }),
  ).toEqual({ state: 'ready', campaignsRemaining: 0, blockedCampaigns: 0 });
  expect((await readSheet(member, vessaId))?.campaign).toBeNull();
  expect(await outcome(readSheet(owner, vessaId))).toBe('Character not found');
});
