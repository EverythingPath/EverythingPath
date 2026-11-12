// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { refuseRepeatedPaginatedQueries } from '../tests/convex-paginated-queries';
import { preloadCalledConvexModules } from '../tests/convex-modules';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { acceptedCampaignSetup } from '../tests/rules/accepted-campaign';
import { initializationEdits } from '../tests/rules/initialization-edits';
import { api, internal } from './_generated/api';
import { departureGraceMs } from './lib/lifecycleDriver';
import type { FunctionArgs } from 'convex/server';
import type { Id } from './_generated/dataModel';
import schema from './schema';

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
// Provider deliveries reach these modules through the HTTP route.
beforeAll(async () => {
  for (const name of ['http', 'clerk', 'user'])
    await modules[`./${name}.ts`]?.();
}, 30_000);

/** The token the webhook derives for a Clerk user ID. */
function token(userId: string) {
  return `https://${process.env.CLERK_HOSTNAME}|${userId}`;
}

/** Owner and member share one prepared campaign; no Characters yet. */
async function campaignFixture() {
  const t = convexTest(schema, modules);
  const campaignId = await t.run(async (ctx) => {
    for (const name of ['owner', 'member'])
      await ctx.db.insert('user', {
        tokenIdentifier: token(name),
        name: `${name} player`,
        orgIds: [
          { orgId: 'org', role: 'member', webhookUpdatedAt: 1 },
          { orgId: 'other', role: 'member', webhookUpdatedAt: 1 },
        ],
        characterSheetDemo: true,
      });
    return ctx.db.insert('campaign', {
      name: 'Ironfang',
      description: '',
      organizationId: 'org',
      ownerId: token('member'),
      e2eFixture: {
        namespace: 'organization-departure',
        version: 1,
        workerKey: '0',
        caseKey: 'departure',
        campaignKey: 'ironfang',
      },
    });
  });
  const owner = t.withIdentity({ tokenIdentifier: token('owner') });
  const member = t.withIdentity({ tokenIdentifier: token('member') });
  return { t, owner, member, campaignId };
}

/** The owner's Vessa is in the shared campaign. */
async function fixture() {
  const context = await campaignFixture();
  const characterId = await context.owner.mutation(api.characterSheet.create, {
    campaignId: context.campaignId,
    organizationId: 'org',
    name: 'Vessa',
    kind: 'pc',
    operationId: 'create',
  });
  return { ...context, characterId };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;

const strongHeart = {
  name: 'Strong heart',
  modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 2 }],
  stacksWithItself: false,
  sources: [],
  detail: { kind: 'feat' },
} satisfies FunctionArgs<typeof api.catalogCopies.createOneOff>['definition'];

/** A one-off feat the owner made and saved to the campaign catalog. */
async function saveCampaignFeat({ t, owner, characterId }: Fixture) {
  const entryId = await owner.mutation(api.catalogCopies.createOneOff, {
    characterId,
    operationId: 'create-feat',
    definition: strongHeart,
  });
  const entry = await t.run((ctx) =>
    ctx.db.get('characterSheetEntry', entryId),
  );
  if (!entry || !('catalogEntryId' in entry)) throw new Error('Feat missing');
  await owner.mutation(api.catalogCopies.saveToCatalog, {
    characterId,
    catalogEntryId: entry.catalogEntryId,
    operationId: 'save-feat',
  });
  return { entryId, campaignFeatId: entry.catalogEntryId };
}

/** The member sets up the militia with Vessa on its roster and officers. */
async function setUpMilitia({ member, campaignId, characterId }: Fixture) {
  const setup = acceptedCampaignSetup(characterId);
  const options = await member.query(api.canonicalSetup.options, {
    campaignId,
  });
  const person = options?.characters.find(
    (entry) => entry.characterId === characterId,
  );
  if (!person) throw new Error('Missing reviewed militia Character');
  const { name: _name, ...facts } = person;
  setup.state.militiaSnapshot.characters = [facts];
  return member.mutation(api.canonicalSetup.initialize, {
    campaignId,
    initializationId: 'finished-week',
    setup,
  });
}

/** The member confirms week 9 with Vessa on the roster. */
async function finishMilitiaWeek(context: Fixture) {
  const { member, characterId } = context;
  const key = await setUpMilitia(context);
  for (const [baseRevision, edit] of initializationEdits(
    'patrol',
    characterId,
  ).entries())
    await member.mutation(api.canonicalDraftPersistence.edit, {
      campaignId: key.campaignId,
      militiaId: key.militiaId,
      operation: {
        draftId: key.draftId,
        operationId: `edit-${baseRevision}`,
        baseRevision,
        edit,
      },
    });
  const preview = await member.query(
    api.canonicalDraftPersistence.preview,
    key,
  );
  expect(preview.status).toBe('ready');
  await member.mutation(api.canonicalDraftPersistence.confirm, {
    ...key,
    operation: { operationId: 'confirm', reviewed: preview.reviewed },
  });
  return key;
}

/** Deliver a signed Clerk membership event through the real webhook route. */
async function deliver(
  t: Fixture['t'],
  type:
    | 'organizationMembership.created'
    | 'organizationMembership.updated'
    | 'organizationMembership.deleted',
  {
    userId,
    orgId,
    updatedAt,
  }: { userId: string; orgId: string; updatedAt: number },
) {
  const response = await t.fetch('/clerk', {
    method: 'POST',
    body: JSON.stringify({
      type,
      data: {
        public_user_data: { user_id: userId },
        organization: { id: orgId },
        role: 'org:member',
        updated_at: updatedAt,
      },
    }),
    headers: {
      'svix-id': `${type}:${updatedAt}`,
      'svix-timestamp': '1',
      'svix-signature': 'valid',
    },
  });
  expect(response.status).toBe(200);
}

/** Run only the background work already due: one bounded step. */
async function runDueWork(t: Fixture['t']) {
  vi.runOnlyPendingTimers();
  await t.finishInProgressScheduledFunctions();
}

async function finishBackgroundWork(t: Fixture['t']) {
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
}

/** The state of the Character's latest move, read as an invariant. */
async function readReturnState(t: Fixture['t'], characterId: Id<'character'>) {
  const move = await t.run((ctx) =>
    ctx.db
      .query('characterMove')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
      .order('desc')
      .first(),
  );
  return move?.state;
}

function readSheet(viewer: Fixture['owner'], characterId: Id<'character'>) {
  return viewer.query(api.characterSheet.read, { characterId });
}

test('losing organization membership revokes access at once and returns the surviving owner’s Character to no campaign', async () => {
  const { t, owner, member, campaignId, characterId } = await fixture();
  const campaignArgs = { campaignId, organizationId: 'org' };

  await deliver(t, 'organizationMembership.deleted', {
    userId: 'owner',
    orgId: 'org',
    updatedAt: 2,
  });

  // Before any background work runs, the departed owner has lost access while
  // the remaining member keeps working with the Character in the campaign.
  await expect(readSheet(owner, characterId)).rejects.toThrow(
    'Character not found',
  );
  expect(await owner.query(api.character.listOwned, {})).toEqual([
    { kind: 'noCampaign', characters: [] },
  ]);
  expect((await readSheet(member, characterId))?.campaign).toMatchObject({
    campaignId,
  });

  await finishBackgroundWork(t);

  const returned = await readSheet(owner, characterId);
  expect(returned?.campaign).toBeNull();
  expect(returned?.character).toMatchObject({
    name: 'Vessa',
    sheetMode: 'full',
  });
  // The departed owner didn't make this change; the trusted return did.
  expect(returned?.updatedBy).toBe('system:organizationDeparture');
  expect(await owner.query(api.character.listOwned, {})).toMatchObject([
    { kind: 'noCampaign', characters: [{ _id: characterId }] },
  ]);
  await expect(readSheet(member, characterId)).rejects.toThrow(
    'Character not found',
  );
  expect(
    await member.query(api.character.listCampaignCharacters, campaignArgs),
  ).toEqual([]);
});

test('the trusted return preserves campaign homebrew as the Character’s own copy and leaves the campaign catalog intact', async () => {
  const context = await fixture();
  const { t, owner, member, campaignId, characterId } = context;
  const { entryId, campaignFeatId } = await saveCampaignFeat(context);
  const before = withSheetCatalog(await readSheet(owner, characterId));

  await deliver(t, 'organizationMembership.deleted', {
    userId: 'owner',
    orgId: 'org',
    updatedAt: 2,
  });
  await finishBackgroundWork(t);

  const after = withSheetCatalog(await readSheet(owner, characterId));
  const feat = after?.entries.find((entry) => entry._id === entryId);
  if (!feat || !('catalogEntryId' in feat)) throw new Error('Feat missing');
  expect(feat.catalogEntryId).not.toBe(campaignFeatId);
  expect(
    after?.catalogEntries.find((entry) => entry._id === feat.catalogEntryId),
  ).toMatchObject({
    scope: 'character',
    characterId,
    name: 'Strong heart',
    copiedFrom: campaignFeatId,
  });
  expect(after?.calculated.abilities.strength).toEqual(
    before?.calculated.abilities.strength,
  );
  // Remaining members keep the campaign's own definition.
  const memberCharacterId = await member.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Rook',
    kind: 'pc',
    operationId: 'create-rook',
  });
  expect(
    await member.query(api.catalogCopies.list, {
      characterId: memberCharacterId,
    }),
  ).toContainEqual(
    expect.objectContaining({
      _id: campaignFeatId,
      scope: 'campaign',
      campaignId,
    }),
  );
});

test('the return removes the Character’s militia roster, officer and team-manager assignments', async () => {
  const context = await fixture();
  const { t, member, characterId } = context;
  const key = await setUpMilitia(context);
  const ledger = { campaignId: key.campaignId, militiaId: key.militiaId };
  expect(
    (await member.query(api.canonicalLedger.read, ledger)).state.militiaSnapshot
      .roster.people,
  ).toContainEqual(expect.objectContaining({ characterId }));

  await deliver(t, 'organizationMembership.deleted', {
    userId: 'owner',
    orgId: 'org',
    updatedAt: 2,
  });
  await finishBackgroundWork(t);

  const { militiaSnapshot } = (
    await member.query(api.canonicalLedger.read, ledger)
  ).state;
  expect(militiaSnapshot.characters).toEqual([]);
  expect(militiaSnapshot.roster.people).toEqual([]);
  expect(militiaSnapshot.roster.officers).toEqual([]);
  expect(
    militiaSnapshot.roster.teams.every(
      (team) => team.managerCharacterId === null,
    ),
  ).toBe(true);
});

test('a returned Militia-only Character comes back Full', async () => {
  const context = await campaignFixture();
  const { t, owner, member, campaignId } = context;
  const rookId = await member.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Rook',
    kind: 'pc',
    operationId: 'create-rook',
  });
  await setUpMilitia({ ...context, characterId: rookId });
  const scoutId = await owner.mutation(api.character.createCharacter, {
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
  expect((await readSheet(owner, scoutId))?.character.sheetMode).toBe(
    'militiaOnly',
  );

  await deliver(t, 'organizationMembership.deleted', {
    userId: 'owner',
    orgId: 'org',
    updatedAt: 2,
  });
  await finishBackgroundWork(t);

  const scout = await readSheet(owner, scoutId);
  expect(scout?.campaign).toBeNull();
  expect(scout?.character).toMatchObject({ name: 'Scout', sheetMode: 'full' });
  expect((await readSheet(member, rookId))?.campaign).toMatchObject({
    campaignId,
  });
});

test('the return keeps the finished week, and its historical link opens no private sheet', async () => {
  const context = await fixture();
  const { t, member, campaignId, characterId } = context;
  await finishMilitiaWeek(context);
  const historyArgs = { campaignId, week: 9 };
  const history = await member.query(api.canonicalHistory.read, historyArgs);
  const listing = await member.query(api.canonicalHistory.list, {
    campaignId,
  });
  expect(JSON.stringify(history)).toContain(characterId);

  await deliver(t, 'organizationMembership.deleted', {
    userId: 'owner',
    orgId: 'org',
    updatedAt: 2,
  });
  await finishBackgroundWork(t);

  expect(await member.query(api.canonicalHistory.read, historyArgs)).toEqual(
    history,
  );
  expect(await member.query(api.canonicalHistory.list, { campaignId })).toEqual(
    listing,
  );
  // A Character named in history opens exactly like one that never existed.
  const deleted = await t.run(async (ctx) => {
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
  const failure = (read: Promise<unknown>) =>
    read.then(
      () => 'readable',
      (error: Error) => error.message,
    );
  const missing = await failure(readSheet(member, deleted));
  expect(await failure(readSheet(member, characterId))).toBe(missing);
  expect(
    await failure(member.query(api.characterMoves.status, { characterId })),
  ).toBe(missing);
});

test('a remaining member keeps editing during the return and their edit arrives with the Character while the departed owner cannot write', async () => {
  const { t, owner, member, campaignId, characterId } = await fixture();
  await deliver(t, 'organizationMembership.deleted', {
    userId: 'owner',
    orgId: 'org',
    updatedAt: 2,
  });
  expect(
    await member.query(api.character.listCampaignCharacters, {
      campaignId,
      organizationId: 'org',
    }),
  ).toMatchObject([
    {
      character: { _id: characterId },
      owner: { name: 'owner player' },
      ownerDeparted: true,
    },
  ]);
  const scores = { strength: 16 };
  await expect(
    owner.mutation(api.characterSheet.editBaseScores, {
      characterId,
      operationId: 'owner-edit',
      scores,
    }),
  ).rejects.toThrow('Character not found');

  await runDueWork(t);
  expect(await readReturnState(t, characterId)).toBe('preparing');
  await member.mutation(api.characterSheet.editBaseScores, {
    characterId,
    operationId: 'member-edit',
    scores,
  });
  await finishBackgroundWork(t);

  const returned = await readSheet(owner, characterId);
  expect(returned?.campaign).toBeNull();
  expect(returned?.calculated.abilities.strength.score).toBe(16);
});

test('a member who takes ownership during the return keeps the Character in the campaign', async () => {
  const { t, owner, member, campaignId, characterId } = await fixture();
  const memberId = await t.run(async (ctx) => {
    const user = await ctx.db
      .query('user')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', token('member')),
      )
      .unique();
    return user!._id;
  });
  await deliver(t, 'organizationMembership.deleted', {
    userId: 'owner',
    orgId: 'org',
    updatedAt: 2,
  });
  await runDueWork(t);
  expect(await readReturnState(t, characterId)).toBe('preparing');
  // The departed owner is no longer a member, so cannot be chosen.
  await expect(
    member.mutation(api.character.reassignOwner, {
      characterId,
      campaignId,
      ownerUserId: await t.run(async (ctx) => {
        const user = await ctx.db
          .query('user')
          .withIndex('by_tokenIdentifier', (q) =>
            q.eq('tokenIdentifier', token('owner')),
          )
          .unique();
        return user!._id;
      }),
      operationId: 'give-back',
    }),
  ).rejects.toThrow('Choose a current campaign member');
  await member.mutation(api.character.reassignOwner, {
    characterId,
    campaignId,
    ownerUserId: memberId,
    operationId: 'take-ownership',
  });
  await finishBackgroundWork(t);

  expect((await readSheet(member, characterId))?.campaign).toMatchObject({
    campaignId,
  });
  expect(
    await member.query(api.characterMoves.status, { characterId }),
  ).toMatchObject({
    state: 'cancelled',
    cancelReason: 'ownershipChanged',
    origin: 'organizationDeparture',
  });
  expect(await owner.query(api.character.listOwned, {})).toEqual([
    { kind: 'noCampaign', characters: [] },
  ]);
  expect(
    await owner.query(api.organizationDepartures.listReturning, {}),
  ).toEqual([]);
});

test('rejoining during the return stops it: Characters already returned stay private and the rest stay in the campaign', async () => {
  const { t, owner, member, campaignId, characterId } = await fixture();
  const secondId = await owner.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Kel',
    kind: 'pc',
    operationId: 'create-second',
  });
  await deliver(t, 'organizationMembership.deleted', {
    userId: 'owner',
    orgId: 'org',
    updatedAt: 2,
  });
  expect(
    await owner.query(api.organizationDepartures.listReturning, {}),
  ).toEqual([{ organizationId: 'org', setAside: 0 }]);
  for (let step = 0; step < 100; step++) {
    if ((await readReturnState(t, characterId)) === 'completed') break;
    await runDueWork(t);
  }
  expect(await readReturnState(t, characterId)).toBe('completed');
  await deliver(t, 'organizationMembership.created', {
    userId: 'owner',
    orgId: 'org',
    updatedAt: 3,
  });
  await finishBackgroundWork(t);

  expect((await readSheet(owner, characterId))?.campaign).toBeNull();
  expect((await readSheet(owner, secondId))?.campaign).toMatchObject({
    campaignId,
  });
  expect((await readSheet(member, secondId))?.campaign).toMatchObject({
    campaignId,
  });
  expect(
    await owner.query(api.organizationDepartures.listReturning, {}),
  ).toEqual([]);
});

test('delayed and repeated membership events neither restore access nor repeat the return', async () => {
  const { t, owner, characterId } = await fixture();
  const removal = { userId: 'owner', orgId: 'org', updatedAt: 2 };
  await deliver(t, 'organizationMembership.deleted', removal);
  await deliver(t, 'organizationMembership.deleted', removal);
  // Events from before the removal arrive late.
  for (const type of [
    'organizationMembership.created',
    'organizationMembership.updated',
  ] as const)
    for (const updatedAt of [1, 2])
      await deliver(t, type, { userId: 'owner', orgId: 'org', updatedAt });
  await expect(readSheet(owner, characterId)).rejects.toThrow(
    'Character not found',
  );
  await finishBackgroundWork(t);
  await deliver(t, 'organizationMembership.deleted', removal);
  await finishBackgroundWork(t);
  expect((await readSheet(owner, characterId))?.campaign).toBeNull();
  const moves = await t.run((ctx) =>
    ctx.db
      .query('characterMove')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
      .take(10),
  );
  expect(moves.map((move) => move.state)).toEqual(['completed']);
});

test('a stale removal cannot undo a later valid move into the campaign', async () => {
  const { t, owner, campaignId } = await campaignFixture();
  const characterId = await owner.mutation(api.characterSheet.create, {
    name: 'Ash',
    kind: 'pc',
    operationId: 'create-private',
  });
  const removal = { userId: 'owner', orgId: 'org', updatedAt: 2 };
  await deliver(t, 'organizationMembership.deleted', removal);
  await finishBackgroundWork(t);
  // The owner rejoins and moves the private Character into the campaign.
  await deliver(t, 'organizationMembership.created', {
    userId: 'owner',
    orgId: 'org',
    updatedAt: 3,
  });
  const join = { characterId, operationId: 'join' };
  let progress = await owner.mutation(api.characterMoves.start, {
    ...join,
    destinationCampaignId: campaignId,
  });
  for (let step = 0; step < 100 && progress.state !== 'completed'; step++)
    progress = await owner.mutation(api.characterMoves.resume, join);
  expect(progress.state).toBe('completed');

  await deliver(t, 'organizationMembership.deleted', removal);
  await finishBackgroundWork(t);
  expect((await readSheet(owner, characterId))?.campaign).toMatchObject({
    campaignId,
  });
});

test('a removal after rejoining starts a new return for the Characters the owner then has', async () => {
  const { t, owner, campaignId } = await campaignFixture();
  const removal = { userId: 'owner', orgId: 'org', updatedAt: 2 };
  await deliver(t, 'organizationMembership.deleted', removal);
  await finishBackgroundWork(t);
  await deliver(t, 'organizationMembership.created', {
    userId: 'owner',
    orgId: 'org',
    updatedAt: 3,
  });
  const characterId = await owner.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Kel',
    kind: 'pc',
    operationId: 'create-after-rejoin',
  });
  await deliver(t, 'organizationMembership.deleted', {
    ...removal,
    updatedAt: 4,
  });
  await finishBackgroundWork(t);
  expect((await readSheet(owner, characterId))?.campaign).toBeNull();
});

async function readDeparture(t: Fixture['t']) {
  return t.run((ctx) => ctx.db.query('organizationDeparture').first());
}

/** Per-Character failure records, read as an invariant. */
async function readFailures(t: Fixture['t']) {
  const rows = await t.run((ctx) =>
    ctx.db.query('organizationDepartureCharacter').take(10),
  );
  return rows.map(({ characterId, failures, setAside }) => ({
    characterId,
    failures,
    setAside,
  }));
}

/** Run due background work, one step at a time, until `done` holds. */
async function runUntil(t: Fixture['t'], done: () => Promise<boolean>) {
  for (let step = 0; step < 200 && !(await done()); step++) await runDueWork(t);
  expect(await done()).toBe(true);
}

test('the return waits through maintenance and sheet authority without counting failures, then completes once even when its driver runs twice', async () => {
  const context = await fixture();
  const { t, owner, member, campaignId, characterId } = context;
  const { entryId } = await saveCampaignFeat(context);
  await deliver(t, 'organizationMembership.deleted', {
    userId: 'owner',
    orgId: 'org',
    updatedAt: 2,
  });
  const run = await t.mutation(internal.initialMigration.start, {
    operationId: 'departure-maintenance',
    expectedEpoch: 0,
    frontendBuild: 'build',
    catalogManifest: 'catalog',
    maintenanceBudgetMs: 60000,
  });
  for (let step = 0; step < 3; step++) await runDueWork(t);
  await expect(readSheet(owner, characterId)).rejects.toThrow(
    'Character not found',
  );
  expect((await readSheet(member, characterId))?.campaign).toMatchObject({
    campaignId,
  });
  expect(await readReturnState(t, characterId)).toBeUndefined();

  // After reopening, sheet authority holds the return without counting it
  // against the Character.
  await t.mutation(internal.initialMigration.abortBeforeActivation, run);
  const setAuthority = (authority: 'legacy' | 'sheet') =>
    t.run(async (ctx) => {
      const control = await ctx.db.query('initialMigrationControl').first();
      if (!control) throw new Error('Write Gate missing');
      await ctx.db.patch('initialMigrationControl', control._id, {
        authority,
      });
    });
  await setAuthority('sheet');
  for (let step = 0; step < 2; step++) await runDueWork(t);
  expect(await readDeparture(t)).toMatchObject({ state: 'returning' });
  expect(await readReturnState(t, characterId)).toBeUndefined();
  expect(await readFailures(t)).toEqual([]);
  expect((await readSheet(member, characterId))?.campaign).toMatchObject({
    campaignId,
  });
  await setAuthority('legacy');

  // A duplicate driver races the scheduled one.
  const departure = await readDeparture(t);
  if (!departure) throw new Error('Departure missing');
  await Promise.all(
    [0, 1].map(() =>
      t.mutation(internal.organizationDepartures.drive, {
        departureId: departure._id,
        round: departure.round,
      }),
    ),
  );
  await finishBackgroundWork(t);

  const returned = withSheetCatalog(await readSheet(owner, characterId));
  expect(returned?.campaign).toBeNull();
  const feat = returned?.entries.find((entry) => entry._id === entryId);
  expect(
    returned?.catalogEntries.filter(
      (entry) => entry.name === 'Strong heart' && entry.scope === 'character',
    ),
  ).toEqual([
    expect.objectContaining({
      _id: feat && 'catalogEntryId' in feat ? feat.catalogEntryId : undefined,
    }),
  ]);
  const moves = await t.run((ctx) =>
    ctx.db
      .query('characterMove')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
      .take(10),
  );
  expect(moves.map((move) => move.state)).toEqual(['completed']);
  expect(await readDeparture(t)).toMatchObject({
    state: 'completed',
    outcome: 'returned',
  });
});

test('only the departed user learns that Characters are returning, and the departed owner cannot inspect them meanwhile', async () => {
  const { t, owner, member, characterId } = await fixture();
  await t.run((ctx) =>
    ctx.db.insert('user', {
      tokenIdentifier: token('outsider'),
      orgIds: [{ orgId: 'other', role: 'member' }],
    }),
  );
  const outsider = t.withIdentity({ tokenIdentifier: token('outsider') });
  await deliver(t, 'organizationMembership.deleted', {
    userId: 'owner',
    orgId: 'org',
    updatedAt: 2,
  });
  expect(
    await owner.query(api.organizationDepartures.listReturning, {}),
  ).toEqual([{ organizationId: 'org', setAside: 0 }]);
  for (const viewer of [member, outsider, t])
    expect(
      await viewer.query(api.organizationDepartures.listReturning, {}),
    ).toEqual([]);
  for (const viewer of [owner, outsider]) {
    await expect(
      viewer.query(api.characterMoves.status, { characterId }),
    ).rejects.toThrow('Character not found');
    await expect(
      viewer.query(api.characterMoves.destinations, { characterId }),
    ).rejects.toThrow('Character not found');
  }
  await finishBackgroundWork(t);
  expect(
    await owner.query(api.characterMoves.status, { characterId }),
  ).toMatchObject({
    state: 'completed',
    origin: 'organizationDeparture',
  });
  await expect(
    outsider.query(api.characterSheet.read, { characterId }),
  ).rejects.toThrow('Character not found');
});

test('a production campaign keeps the departed owner’s legacy Character under legacy authority while access stays revoked', async () => {
  const { t, owner, member } = await fixture();
  const productionId = await t.run((ctx) =>
    ctx.db.insert('campaign', {
      name: 'Live table',
      description: '',
      organizationId: 'org',
      ownerId: token('member'),
    }),
  );
  const legacyId = await owner.mutation(api.character.createCharacter, {
    organizationId: 'org',
    character: {
      campaignId: productionId,
      name: 'Old guard',
      description: '',
      kind: 'pc',
      level: 3,
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
  });
  await deliver(t, 'organizationMembership.deleted', {
    userId: 'owner',
    orgId: 'org',
    updatedAt: 2,
  });
  await finishBackgroundWork(t);
  const production = { campaignId: productionId, organizationId: 'org' };
  expect(
    await member.query(api.character.listCampaignCharacters, production),
  ).toMatchObject([{ character: { _id: legacyId }, ownerDeparted: true }]);
  expect(
    await owner.query(api.character.listCampaignCharacters, production),
  ).toEqual([]);
  expect(await readDeparture(t)).toMatchObject({
    state: 'completed',
    outcome: 'returned',
    legacyRetained: 1,
  });
});

/** Let the grace after a removal almost pass, running whatever falls due. */
async function waitWithinGrace(t: Fixture['t']) {
  vi.advanceTimersByTime(departureGraceMs - 1000);
  await t.finishInProgressScheduledFunctions();
}

test('an account deleted within the grace after a removal is left to account-deletion policy: no return starts and its campaign Character stays for the remaining members', async () => {
  const { t, member, campaignId, characterId } = await fixture();
  await deliver(t, 'organizationMembership.deleted', {
    userId: 'owner',
    orgId: 'org',
    updatedAt: 2,
  });
  await waitWithinGrace(t);
  expect(await readReturnState(t, characterId)).toBeUndefined();
  const deletion = await t.fetch('/clerk', {
    method: 'POST',
    body: JSON.stringify({
      type: 'user.deleted',
      data: { id: 'owner', object: 'user', deleted: true },
    }),
    headers: {
      'svix-id': 'user.deleted',
      'svix-timestamp': '1',
      'svix-signature': 'valid',
    },
  });
  expect(deletion.status).toBe(200);
  await finishBackgroundWork(t);
  const sheet = await readSheet(member, characterId);
  expect(sheet?.campaign).toMatchObject({ campaignId });
  expect(sheet?.owner).toBeNull();
  expect(await readReturnState(t, characterId)).toBeUndefined();
  expect(await readDeparture(t)).toMatchObject({
    state: 'completed',
    outcome: 'accountDeleted',
  });
});

test('rejoining within the grace after a removal moves nothing', async () => {
  const { t, owner, campaignId, characterId } = await fixture();
  await deliver(t, 'organizationMembership.deleted', {
    userId: 'owner',
    orgId: 'org',
    updatedAt: 2,
  });
  await waitWithinGrace(t);
  await deliver(t, 'organizationMembership.created', {
    userId: 'owner',
    orgId: 'org',
    updatedAt: 3,
  });
  await finishBackgroundWork(t);
  expect((await readSheet(owner, characterId))?.campaign).toMatchObject({
    campaignId,
  });
  expect(await readReturnState(t, characterId)).toBeUndefined();
  expect(await readDeparture(t)).toMatchObject({
    state: 'completed',
    outcome: 'membershipRestored',
  });
});

test('a signed membership removal for a user the app has not seen is refused so the provider retries it', async () => {
  const t = convexTest(schema, modules);
  const response = await t.fetch('/clerk', {
    method: 'POST',
    body: JSON.stringify({
      type: 'organizationMembership.deleted',
      data: {
        public_user_data: { user_id: 'unknown-user' },
        organization: { id: 'org' },
        role: 'org:member',
        updated_at: 1,
      },
    }),
    headers: {
      'svix-id': 'delivery',
      'svix-timestamp': '1',
      'svix-signature': 'valid',
    },
  });
  expect(response.status).toBe(400);
});

test('an owner without private sheet access still gets the returned Character back to edit', async () => {
  const { t, owner, characterId } = await fixture();
  await t.run(async (ctx) => {
    const user = await ctx.db
      .query('user')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', token('owner')),
      )
      .unique();
    await ctx.db.patch('user', user!._id, { characterSheetDemo: undefined });
  });
  await deliver(t, 'organizationMembership.deleted', {
    userId: 'owner',
    orgId: 'org',
    updatedAt: 2,
  });
  await finishBackgroundWork(t);
  expect((await readSheet(owner, characterId))?.campaign).toBeNull();
  await owner.mutation(api.characterSheet.editBaseScores, {
    characterId,
    operationId: 'private-edit',
    scores: { strength: 14 },
  });
  expect(
    (await readSheet(owner, characterId))?.calculated.abilities.strength.score,
  ).toBe(14);
});

test('archived Characters return and stay archived', async () => {
  const { t, owner, member, characterId } = await fixture();
  await member.mutation(api.characterSheet.archive, {
    characterId,
    operationId: 'archive',
    isActive: false,
  });
  await deliver(t, 'organizationMembership.deleted', {
    userId: 'owner',
    orgId: 'org',
    updatedAt: 2,
  });
  await finishBackgroundWork(t);
  const returned = await readSheet(owner, characterId);
  expect(returned?.campaign).toBeNull();
  expect(returned?.character.isActive).toBe(false);
});

test('a Character that keeps failing to return is set aside while the owner’s others return, and it returns once it can', async () => {
  const { t, owner, campaignId, characterId } = await fixture();
  const kelId = await owner.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Kel',
    kind: 'pc',
    operationId: 'create-kel',
  });
  // Vessa's base scores no longer belong to her, so her sheet can't be read.
  const setBaseOwner = (ownerId: Id<'character'>) =>
    t.run(async (ctx) => {
      const base = await ctx.db
        .query('catalogEntry')
        .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
        .filter((q) => q.eq(q.field('ruleIdentity'), `base:${characterId}`))
        .unique();
      const moved =
        base ??
        (await ctx.db
          .query('catalogEntry')
          .withIndex('by_characterId', (q) => q.eq('characterId', kelId))
          .filter((q) => q.eq(q.field('ruleIdentity'), `base:${characterId}`))
          .unique());
      await ctx.db.patch('catalogEntry', moved!._id, { characterId: ownerId });
    });
  await setBaseOwner(kelId);
  await deliver(t, 'organizationMembership.deleted', {
    userId: 'owner',
    orgId: 'org',
    updatedAt: 2,
  });

  await runUntil(
    t,
    async () => (await readDeparture(t))?.state === 'completed',
  );
  expect((await readSheet(owner, kelId))?.campaign).toBeNull();
  expect(await readFailures(t)).toEqual([
    { characterId, failures: 3, setAside: true },
  ]);
  expect(
    await owner.query(api.organizationDepartures.listReturning, {}),
  ).toEqual([{ organizationId: 'org', setAside: 1 }]);
  // Slower retries keep failing without growing the count.
  for (let step = 0; step < 3; step++) await runDueWork(t);
  expect(await readFailures(t)).toEqual([
    { characterId, failures: 3, setAside: true },
  ]);

  await setBaseOwner(characterId);
  await runUntil(t, async () => (await readFailures(t)).length === 0);
  expect((await readSheet(owner, characterId))?.campaign).toBeNull();
  expect(
    await owner.query(api.organizationDepartures.listReturning, {}),
  ).toEqual([]);
});
