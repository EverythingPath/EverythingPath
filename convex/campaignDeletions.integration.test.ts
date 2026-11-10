// @vitest-environment edge-runtime
import { afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { refuseRepeatedPaginatedQueries } from '../tests/convex-paginated-queries';
import schema from './schema';
import { preloadCalledConvexModules } from '../tests/convex-modules';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import {
  campaignFixture,
  createCharacter,
  deliver,
  finishBackgroundWork,
  finishMilitiaWeek,
  outcome,
  readMoveStates,
  readSheet,
  runDueWork,
  runUntil,
  saveCampaignFeat,
  setBaseScoresHolder,
  takeOwnership,
  fixtureCampaign,
  listDeletedCampaigns,
  token,
  type CampaignFixture,
} from '../tests/container-deletion';
import { catalogRuntimeCompatibility } from '../src/lib/catalog/runtime-compatibility';
import { requireCatalogCharacterAdmission } from './lib/catalogFixturePolicy';
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
    'canonicalSetup',
    'canonicalDraftPersistence',
    'characterSheet',
    'character',
    'characterMoves',
    'catalogCopies',
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

function requestDeletion(
  viewer: CampaignFixture['member'],
  campaignId: Id<'campaign'>,
) {
  return viewer.mutation(api.campaignDeletions.request, {
    campaignId,
    organizationId: 'org',
  });
}

function readDeletion(
  viewer: CampaignFixture['member'],
  campaignId: Id<'campaign'>,
) {
  return viewer.query(api.campaignDeletions.status, { campaignId });
}

test('deleting a campaign returns every surviving owner’s Characters to them first, then deletes the campaign', async () => {
  const { t, owner, member, campaignId, vessaId, rookId } = await fixture();
  await member.mutation(api.character.archiveCharacter, {
    organizationId: 'org',
    characterId: rookId,
    isActive: false,
  });

  expect(await requestDeletion(member, campaignId)).toMatchObject({
    campaignName: 'Ironfang',
    state: 'returning',
    remaining: 2,
    blockers: null,
  });
  // Both sessions follow the same deletion while Characters return; the
  // campaign isn't listed as deleted yet.
  expect(await readDeletion(owner, campaignId)).toMatchObject({
    state: 'returning',
  });
  expect(await listDeletedCampaigns(owner)).toEqual([]);
  await runUntil(
    t,
    async () => (await readDeletion(member, campaignId))?.remaining === 1,
  );
  expect(await readDeletion(owner, campaignId)).toMatchObject({
    state: 'returning',
    remaining: 1,
  });

  await finishBackgroundWork(t);

  for (const [viewer, characterId] of [
    [owner, vessaId],
    [member, rookId],
  ] as const) {
    const sheet = await readSheet(viewer, characterId);
    expect(sheet?.campaign).toBeNull();
    expect(sheet?.updatedBy).toBe('system:campaignDeletion');
  }
  // Archived Characters come back archived; each is private to its owner.
  expect((await readSheet(member, rookId))?.character.isActive).toBe(false);
  expect(await outcome(readSheet(member, vessaId))).toBe('Character not found');
  expect(await outcome(readSheet(owner, rookId))).toBe('Character not found');
  expect(
    await owner.query(api.characterMoves.status, { characterId: vessaId }),
  ).toMatchObject({ state: 'completed', origin: 'campaignDeletion' });

  expect(
    await member.query(api.campaign.getCampaigns, { organizationId: 'org' }),
  ).toEqual({ state: 'ready', campaigns: [] });
  expect(
    await member.query(api.campaign.listNavigationContexts, {
      organizationId: 'org',
    }),
  ).toEqual([]);
  const deleted = {
    campaignId,
    campaignName: 'Ironfang',
    state: 'deleted',
    remaining: 0,
    setAside: 0,
    blockers: null,
    deletedAt: expect.any(Number),
    hasHistory: false,
  };
  expect(await readDeletion(owner, campaignId)).toEqual(deleted);
  expect(await listDeletedCampaigns(member)).toEqual([deleted]);
  // Every campaign write now refuses the campaign.
  await expect(createCharacter(member, campaignId, 'Late')).rejects.toThrow(
    'No campaign exists for this organization',
  );
  // A repeated request, as after a lost reply, reports the same deletion.
  expect(await requestDeletion(member, campaignId)).toEqual(deleted);
});

test('the return keeps campaign homebrew as each Character’s own copy, and the deletion clears the campaign’s live data but keeps its finished weeks', async () => {
  const context = await fixture();
  const { t, owner, member, campaignId, vessaId } = context;
  const { entryId, campaignFeatId } = await saveCampaignFeat(t, owner, vessaId);
  const before = withSheetCatalog(await readSheet(owner, vessaId));
  const key = await finishMilitiaWeek(member, campaignId, vessaId);
  const historyArgs = { campaignId, week: 9 };
  const history = await member.query(api.canonicalHistory.read, historyArgs);
  const listing = await member.query(api.canonicalHistory.list, {
    campaignId,
  });
  const ledger = await member.query(api.canonicalLedger.read, {
    campaignId: key.campaignId,
    militiaId: key.militiaId,
  });

  await requestDeletion(member, campaignId);
  await finishBackgroundWork(t);

  const after = withSheetCatalog(await readSheet(owner, vessaId));
  const feat = after?.entries.find((entry) => entry._id === entryId);
  if (!feat || !('catalogEntryId' in feat)) throw new Error('Feat missing');
  expect(
    after?.catalogEntries.find((entry) => entry._id === feat.catalogEntryId),
  ).toMatchObject({
    scope: 'character',
    characterId: vessaId,
    name: 'Strong heart',
    copiedFrom: campaignFeatId,
  });
  expect(after?.calculated.abilities.strength).toEqual(
    before?.calculated.abilities.strength,
  );

  // Members of the surviving organization still read the finished weeks.
  expect(await member.query(api.canonicalHistory.read, historyArgs)).toEqual(
    history,
  );
  expect(await owner.query(api.canonicalHistory.list, { campaignId })).toEqual(
    listing,
  );
  expect(
    await member.query(api.canonicalHistory.read, {
      campaignId,
      week: 9,
      recordId: history?.effectiveRecordId,
    }),
  ).toEqual(history);
  expect(await readDeletion(member, campaignId)).toMatchObject({
    state: 'deleted',
    hasHistory: true,
  });
  // The history is read-only: the militia and campaign take no more writes.
  const scope = { campaignId: key.campaignId, militiaId: key.militiaId };
  await expect(member.query(api.canonicalLedger.read, scope)).rejects.toThrow(
    'Invalid campaign/militia reference',
  );
  await expect(
    member.mutation(api.canonicalLedger.save, {
      ...scope,
      expectedRevision: ledger.revision,
      snapshot: ledger.state.militiaSnapshot,
      reason: 'Late correction',
    }),
  ).rejects.toThrow('Invalid campaign/militia reference');
  await expect(
    member.mutation(api.campaign.updateCampaignDescription, {
      campaignId,
      organizationId: 'org',
      description: 'Late',
    }),
  ).rejects.toThrow('No campaign exists for this organization');
  expect(
    await member.query(api.canonicalDraftPersistence.workspace, {
      campaignId,
    }),
  ).toBeNull();

  // Only the history is kept: the live data is gone.
  const kept = await t.run(async (ctx) => ({
    militia: await ctx.db.get('militia', key.militiaId),
    drafts: await ctx.db
      .query('canonicalWeeklyDraft')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', key.militiaId))
      .take(10),
    state: await ctx.db
      .query('canonicalMilitiaState')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', key.militiaId))
      .take(10),
    homebrew: await ctx.db
      .query('catalogEntry')
      .withIndex('by_campaignId_and_scope', (q) =>
        q.eq('campaignId', campaignId).eq('scope', 'campaign'),
      )
      .take(10),
    records: await ctx.db
      .query('canonicalResolutionRecord')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', key.militiaId))
      .take(10),
  }));
  expect(kept).toMatchObject({
    militia: null,
    drafts: [],
    state: [],
    homebrew: [],
  });
  expect(kept.records.length).toBeGreaterThan(0);
});

test('a deleted campaign’s history stays closed to outsiders and opens no private sheet through its Character links', async () => {
  const { t, owner, member, outsider, campaignId, vessaId } = await fixture();
  await finishMilitiaWeek(member, campaignId, vessaId);
  const history = await member.query(api.canonicalHistory.read, {
    campaignId,
    week: 9,
  });
  expect(JSON.stringify(history)).toContain(vessaId);
  await requestDeletion(member, campaignId);
  await finishBackgroundWork(t);

  // A deleted campaign without history, and one that never existed, read
  // exactly the same to anyone outside the organization.
  const emberwoodId = await t.run((ctx) =>
    ctx.db.insert('campaign', {
      name: 'Emberwood',
      description: '',
      organizationId: 'org',
      ownerId: token('member'),
      e2eFixture: fixtureCampaign('emberwood'),
    }),
  );
  await requestDeletion(member, emberwoodId);
  const neverCampaignId = await t.run(async (ctx) => {
    const id = await ctx.db.insert('campaign', {
      name: 'Never',
      description: '',
      organizationId: 'org',
      ownerId: token('member'),
    });
    await ctx.db.delete('campaign', id);
    return id;
  });
  await finishBackgroundWork(t);
  for (const read of [
    outsider.query(api.canonicalHistory.read, { campaignId, week: 9 }),
    outsider.query(api.canonicalHistory.list, { campaignId }),
    t.query(api.canonicalHistory.list, { campaignId }),
    outsider.query(api.canonicalHistory.list, { campaignId: emberwoodId }),
    outsider.query(api.canonicalHistory.list, {
      campaignId: neverCampaignId,
    }),
  ])
    expect(await outcome(read)).toBe('Campaign access required');
  // A member learns only that the deleted campaign kept no history.
  expect(
    await outcome(
      member.query(api.canonicalHistory.list, { campaignId: emberwoodId }),
    ),
  ).toBe('Campaign militia unavailable');
  for (const viewer of [outsider, t]) {
    expect(await readDeletion(viewer, campaignId)).toBeNull();
    expect(await listDeletedCampaigns(viewer)).toEqual([]);
  }
  // A Character named in the history opens exactly like one that never
  // existed, for everyone but its owner.
  const neverExisted = await t.run(async (ctx) => {
    const id = await ctx.db.insert('character', {
      name: 'Gone',
      description: '',
      kind: 'pc',
      level: 1,
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
      isActive: true,
    });
    await ctx.db.delete('character', id);
    return id;
  });
  const missing = await outcome(readSheet(member, neverExisted));
  for (const viewer of [member, outsider])
    expect(await outcome(readSheet(viewer, vessaId))).toBe(missing);
  expect(await outcome(readSheet(owner, vessaId))).toBe('readable');
});

test('deletion is refused while a Character needs an owner, and goes on once a member takes ownership', async () => {
  const { t, owner, member, campaignId, vessaId, rookId } = await fixture();
  await deliver(t, { type: 'user.deleted', userId: 'owner' });

  // The deleted account's Character needs an owner even before account
  // deletion work has run.
  await expect(requestDeletion(member, campaignId)).rejects.toThrow(
    '1 Character needs an owner.',
  );
  await finishBackgroundWork(t);
  const refusal = await requestDeletion(member, campaignId).catch(
    (error: { data: unknown }) => error.data,
  );
  expect(refusal).toEqual({
    code: 'DELETION_BLOCKED',
    message: '1 Character needs an owner.',
    ownerless: 1,
    unreturnable: 0,
  });
  expect(await readDeletion(member, campaignId)).toBeNull();
  expect((await readSheet(member, rookId))?.campaign).toMatchObject({
    campaignId,
  });

  await takeOwnership(t, member, 'member', campaignId, vessaId);
  await requestDeletion(member, campaignId);
  await finishBackgroundWork(t);

  for (const characterId of [vessaId, rookId])
    expect((await readSheet(member, characterId))?.campaign).toBeNull();
  expect(await outcome(readSheet(owner, vessaId))).toBe('Character not found');
  expect(await readDeletion(member, campaignId)).toMatchObject({
    state: 'deleted',
  });
});

test('a Character that loses its owner during the returns blocks the deletion until a member assigns it, and a new request finishes it', async () => {
  const { t, owner, member, campaignId, vessaId, rookId } = await fixture();
  await requestDeletion(member, campaignId);
  await deliver(t, { type: 'user.deleted', userId: 'owner' });
  await finishBackgroundWork(t);

  expect(await readDeletion(member, campaignId)).toMatchObject({
    state: 'blocked',
    remaining: 1,
    blockers: { ownerless: 1, unreturnable: 0 },
  });
  // Rook went back to the member; ownerless Vessa stays in the campaign.
  expect((await readSheet(member, rookId))?.campaign).toBeNull();
  expect((await readSheet(member, vessaId))?.campaign).toMatchObject({
    campaignId,
  });
  expect(
    await member.query(api.campaign.getCampaigns, { organizationId: 'org' }),
  ).toMatchObject({ campaigns: [{ _id: campaignId }] });
  await expect(requestDeletion(member, campaignId)).rejects.toThrow(
    '1 Character needs an owner.',
  );

  await takeOwnership(t, member, 'member', campaignId, vessaId);
  expect(await requestDeletion(member, campaignId)).toMatchObject({
    state: 'returning',
    blockers: null,
  });
  await finishBackgroundWork(t);

  expect((await readSheet(member, vessaId))?.campaign).toBeNull();
  expect(await outcome(readSheet(owner, vessaId))).toBe('Character not found');
  expect(await readDeletion(member, campaignId)).toMatchObject({
    state: 'deleted',
  });
});

test('a member who takes ownership during the returns gets the Character back instead, so the stale return cannot undo it', async () => {
  const { t, owner, member, campaignId, vessaId } = await fixture();
  await requestDeletion(member, campaignId);
  await runUntil(t, async () =>
    (await readMoveStates(t, vessaId)).includes('preparing'),
  );
  await takeOwnership(t, member, 'member', campaignId, vessaId);
  await finishBackgroundWork(t);

  const returned = await readSheet(member, vessaId);
  expect(returned?.campaign).toBeNull();
  expect(returned?.owner).toMatchObject({ isMine: true });
  expect(await outcome(readSheet(owner, vessaId))).toBe('Character not found');
  expect(await readMoveStates(t, vessaId)).toEqual(['cancelled', 'completed']);
});

test('only members can delete a prepared campaign, and every refusal leaves it as it was', async () => {
  const { t, owner, member, outsider, campaignId, vessaId } = await fixture();
  await expect(requestDeletion(outsider, campaignId)).rejects.toThrow(
    'You do not have access to this org',
  );
  await expect(
    t.mutation(api.campaignDeletions.request, { campaignId }),
  ).rejects.toThrow('You do not have access to this org');
  await expect(
    outsider.mutation(api.campaignDeletions.request, {
      campaignId,
      organizationId: 'other',
    }),
  ).rejects.toThrow('No campaign exists for this organization');

  // A production campaign keeps legacy authority until activation (#413).
  const productionId = await t.run((ctx) =>
    ctx.db.insert('campaign', {
      name: 'Live table',
      description: '',
      organizationId: 'org',
      ownerId: 'member',
    }),
  );
  await expect(requestDeletion(member, productionId)).rejects.toThrow(
    "Deleting isn't available for this campaign yet.",
  );

  // A flat legacy Character can't move through the return machinery.
  const flatId = await owner.mutation(api.character.createCharacter, {
    organizationId: 'org',
    character: {
      campaignId,
      name: 'Scout',
      description: '',
      kind: 'npc',
      level: 2,
      strength: 12,
      dexterity: 14,
      constitution: 10,
      intelligence: 10,
      wisdom: 13,
      charisma: 8,
    },
  });
  await expect(requestDeletion(owner, campaignId)).rejects.toThrow(
    "1 Character can't be returned to its owner yet.",
  );

  await finishBackgroundWork(t);
  for (const viewer of [owner, member])
    expect(await readDeletion(viewer, campaignId)).toBeNull();
  expect(
    await member.query(api.character.listCampaignCharacters, {
      campaignId,
      organizationId: 'org',
    }),
  ).toHaveLength(3);
  expect((await readSheet(owner, vessaId))?.campaign).toMatchObject({
    campaignId,
  });
  expect(flatId).toBeDefined();
});

test('repeated requests and a duplicate driver return each Character once, and the deletion waits through maintenance and sheet authority', async () => {
  const { t, owner, member, campaignId, vessaId, rookId } = await fixture();
  const run = await t.mutation(internal.initialMigration.start, {
    operationId: 'deletion-maintenance',
    expectedEpoch: 0,
    frontendBuild: 'build',
    catalogManifest: 'catalog',
    maintenanceBudgetMs: 60000,
  });
  // Maintenance refuses the request itself.
  await expect(requestDeletion(member, campaignId)).rejects.toThrow();
  await t.mutation(internal.initialMigration.abortBeforeActivation, run);
  const writeEpoch = await t.run(
    async (ctx) =>
      (await ctx.db.query('initialMigrationControl').first())?.epoch,
  );
  const request = () =>
    member.mutation(api.campaignDeletions.request, {
      campaignId,
      organizationId: 'org',
      writeEpoch,
    });
  await request();
  await request();
  const setAuthority = (authority: 'legacy' | 'sheet') =>
    t.run(async (ctx) => {
      const control = await ctx.db.query('initialMigrationControl').first();
      if (!control) throw new Error('Write Gate missing');
      await ctx.db.patch('initialMigrationControl', control._id, {
        authority,
      });
    });
  await setAuthority('sheet');
  for (let step = 0; step < 3; step++) await runDueWork(t);
  expect(await readDeletion(member, campaignId)).toMatchObject({
    state: 'returning',
    remaining: 2,
    setAside: 0,
  });
  await setAuthority('legacy');

  const deletion = await t.run((ctx) =>
    ctx.db.query('campaignDeletion').first(),
  );
  if (!deletion) throw new Error('Deletion missing');
  await Promise.all(
    [0, 1].map(() =>
      t.mutation(internal.campaignDeletions.drive, {
        deletionId: deletion._id,
        round: deletion.round,
      }),
    ),
  );
  await finishBackgroundWork(t);

  for (const characterId of [vessaId, rookId])
    expect(await readMoveStates(t, characterId)).toEqual(['completed']);
  expect((await readSheet(owner, vessaId))?.campaign).toBeNull();
  expect(await readDeletion(member, campaignId)).toMatchObject({
    state: 'deleted',
  });
});

test('a deletion during a membership return returns the departed owner’s Character once', async () => {
  const { t, owner, member, campaignId, vessaId, rookId } = await fixture();
  await deliver(t, {
    type: 'organizationMembership.deleted',
    userId: 'owner',
    orgId: 'org',
    updatedAt: 2,
  });
  // The departure's grace passes and its return gets under way.
  await runUntil(t, async () =>
    (await readMoveStates(t, vessaId)).includes('preparing'),
  );
  // The departed owner can no longer see or ask for anything here.
  await expect(requestDeletion(owner, campaignId)).rejects.toThrow(
    'You do not have access to this org',
  );
  expect(await readDeletion(owner, campaignId)).toBeNull();
  await requestDeletion(member, campaignId);
  await finishBackgroundWork(t);

  expect(await readMoveStates(t, vessaId)).toEqual(['completed']);
  expect((await readSheet(owner, vessaId))?.campaign).toBeNull();
  expect((await readSheet(member, rookId))?.campaign).toBeNull();
  expect(
    await owner.query(api.organizationDepartures.listReturning, {}),
  ).toEqual([]);
  expect(await readDeletion(member, campaignId)).toMatchObject({
    state: 'deleted',
  });
});

test('a Character whose return keeps failing is set aside and the deletion waits for it, finishing once it returns', async () => {
  const { t, owner, member, campaignId, vessaId, rookId } = await fixture();
  // Vessa's base scores no longer belong to her, so her sheet can't be read.
  await setBaseScoresHolder(t, vessaId, rookId);
  await requestDeletion(member, campaignId);
  await runUntil(
    t,
    async () => (await readDeletion(member, campaignId))?.setAside === 1,
  );
  await runUntil(t, async () =>
    (await readMoveStates(t, rookId)).includes('completed'),
  );
  expect(await readDeletion(owner, campaignId)).toMatchObject({
    state: 'returning',
    remaining: 1,
    setAside: 1,
  });

  await setBaseScoresHolder(t, vessaId, vessaId);
  await finishBackgroundWork(t);
  expect((await readSheet(owner, vessaId))?.campaign).toBeNull();
  expect(await readDeletion(member, campaignId)).toMatchObject({
    state: 'deleted',
    setAside: 0,
  });
});

test('a returned Character keeps its fixture catalog isolation after its campaign is deleted', async () => {
  const { t, owner, member, campaignId, vessaId } = await fixture();
  await requestDeletion(member, campaignId);
  await finishBackgroundWork(t);
  const returned = await readSheet(owner, vessaId);
  expect(returned?.character.catalogFixtureCampaignId).toBe(campaignId);
  // Under a fixture-only Catalog Release, only Characters from fixture
  // campaigns are admitted; Vessa still names her deleted fixture campaign.
  const admission = await t.run(async (ctx) => {
    await ctx.db.insert('catalogReleaseControl', {
      key: 'global',
      releaseNumber: 1,
      schemaIdentity: catalogRuntimeCompatibility.schema,
      calculationIdentity: catalogRuntimeCompatibility.calculation,
      isFixtureOnly: true,
    });
    return requireCatalogCharacterAdmission(ctx, {
      catalogFixtureCampaignId: campaignId,
    }).then(
      () => 'admitted',
      (error: Error) => error.message,
    );
  });
  expect(admission).toBe('admitted');
});
