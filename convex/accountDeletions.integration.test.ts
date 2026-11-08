// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { refuseRepeatedPaginatedQueries } from '../tests/convex-paginated-queries';
import { preloadCalledConvexModules } from '../tests/convex-modules';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
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
  for (const name of ['http', 'clerk', 'user', 'organizationDepartures'])
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
        webhookUpdatedAt: 1,
        orgIds: [{ orgId: 'org', role: 'member', webhookUpdatedAt: 1 }],
        characterSheetDemo: true,
      });
    await ctx.db.insert('user', {
      tokenIdentifier: token('outsider'),
      orgIds: [{ orgId: 'other', role: 'member' }],
    });
    return ctx.db.insert('campaign', {
      name: 'Ironfang',
      description: '',
      organizationId: 'org',
      ownerId: token('member'),
      e2eFixture: {
        namespace: 'account-deletion',
        version: 1,
        workerKey: '0',
        caseKey: 'deletion',
        campaignKey: 'ironfang',
      },
    });
  });
  const owner = t.withIdentity({ tokenIdentifier: token('owner') });
  const member = t.withIdentity({ tokenIdentifier: token('member') });
  const outsider = t.withIdentity({ tokenIdentifier: token('outsider') });
  return { t, owner, member, outsider, campaignId };
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
type Viewer = Fixture['owner'];

const strongHeart = {
  name: 'Strong heart',
  modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 2 }],
  stacksWithItself: false,
  sources: [],
  detail: { kind: 'feat' },
} satisfies FunctionArgs<typeof api.catalogCopies.createOneOff>['definition'];

/** A one-off feat the player made on the Character's own sheet. */
async function createOneOffFeat(
  viewer: Viewer,
  characterId: Id<'character'>,
  operationId: string,
) {
  return viewer.mutation(api.catalogCopies.createOneOff, {
    characterId,
    operationId,
    definition: strongHeart,
  });
}

function readSheet(viewer: Viewer, characterId: Id<'character'>) {
  return viewer.query(api.characterSheet.read, { characterId });
}

/**
 * Vessa takes a Fighter level with a favored-class hit point although Fighter
 * isn't her favored class, and the member accepts the warnings it raises.
 */
async function acceptFavoredClassWarning(
  { owner, member }: Fixture,
  characterId: Id<'character'>,
) {
  const sheet = withSheetCatalog(await readSheet(owner, characterId));
  const level = sheet?.entries.find((entry) => entry.kind === 'classLevel');
  const fighter = sheet?.catalogEntries.find(
    (entry) => entry.name === 'Fighter',
  );
  if (!level || !fighter) throw new Error('Missing Fighter level');
  await owner.mutation(api.characterSheet.editClassLevel, {
    characterId,
    entryId: level._id,
    classEntryId: fighter._id,
    favoredClassBonus: { choice: 'hp' },
    operationId: 'fighter',
  });
  const warnings = (await readSheet(owner, characterId))?.calculated.warnings;
  const warning = warnings?.find(
    (row) =>
      row.kind === 'rules' && row.check === 'favoredClassBonusNotFavored',
  );
  if (warning?.kind !== 'rules') throw new Error('Missing warning');
  await member.mutation(api.characterSheet.acceptWarning, {
    characterId,
    check: warning.check,
    subject: warning.subject,
    fingerprint: warning.fingerprint,
    operationId: 'accept',
  });
}

/** Deliver a signed Clerk event through the real webhook route. */
async function deliver(
  t: Fixture['t'],
  type:
    | 'user.created'
    | 'user.updated'
    | 'user.deleted'
    | 'organizationMembership.created'
    | 'organizationMembership.updated'
    | 'organizationMembership.deleted',
  { userId, updatedAt = 5 }: { userId: string; updatedAt?: number },
) {
  const data = type.startsWith('user.')
    ? type === 'user.deleted'
      ? { id: userId, object: 'user', deleted: true }
      : {
          id: userId,
          first_name: 'Returned',
          last_name: 'Player',
          image_url: '',
          updated_at: updatedAt,
        }
    : {
        public_user_data: { user_id: userId },
        organization: { id: 'org' },
        role: 'org:member',
        updated_at: updatedAt,
      };
  return t.fetch('/clerk', {
    method: 'POST',
    body: JSON.stringify({ type, data }),
    headers: {
      'svix-id': `${type}:${updatedAt}`,
      'svix-timestamp': '1',
      'svix-signature': 'valid',
    },
  });
}

async function deleteAccount(t: Fixture['t'], userId = 'owner') {
  expect((await deliver(t, 'user.deleted', { userId })).status).toBe(200);
}

/** Run only the background work already due: one bounded step. */
async function runDueWork(t: Fixture['t']) {
  vi.runOnlyPendingTimers();
  await t.finishInProgressScheduledFunctions();
}

async function finishBackgroundWork(t: Fixture['t']) {
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
}

async function readUser(t: Fixture['t'], userId: string) {
  return t.run((ctx) =>
    ctx.db
      .query('user')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', token(userId)),
      )
      .unique(),
  );
}

async function readUserId(t: Fixture['t'], userId: string) {
  const user = await readUser(t, userId);
  if (!user) throw new Error(`Missing user ${userId}`);
  return user._id;
}

async function readDeletion(t: Fixture['t']) {
  return t.run((ctx) => ctx.db.query('accountDeletion').first());
}

async function readMoveStates(t: Fixture['t'], characterId: Id<'character'>) {
  const moves = await t.run((ctx) =>
    ctx.db
      .query('characterMove')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
      .take(10),
  );
  return moves.map(({ state, cancelReason }) => ({ state, cancelReason }));
}

/** Every stored row the deleted Character kept, read as an invariant. */
async function readCharacterRows(
  t: Fixture['t'],
  characterId: Id<'character'>,
) {
  return t.run(async (ctx) => ({
    character: await ctx.db.get('character', characterId),
    entries: await ctx.db
      .query('characterSheetEntry')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
      .take(100),
    definitions: await ctx.db
      .query('catalogEntry')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
      .take(1),
    acceptedWarnings: await ctx.db
      .query('acceptedWarning')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
      .take(10),
    relationships: [
      ...(await ctx.db
        .query('companionRelationship')
        .withIndex('by_associatedCharacterId', (q) =>
          q.eq('associatedCharacterId', characterId),
        )
        .take(10)),
      ...(await ctx.db
        .query('companionRelationship')
        .withIndex('by_companionCharacterId', (q) =>
          q.eq('companionCharacterId', characterId),
        )
        .take(10)),
    ],
  }));
}

/** The sheet as a remaining member reads it, without its owner. */
function withoutOwner(
  sheet: Awaited<ReturnType<typeof readSheet>> | undefined,
) {
  if (!sheet) throw new Error('Sheet missing');
  const {
    owner: _owner,
    character: {
      ownerId: _ownerId,
      ownerLastOperationId: _ownerOperation,
      ...character
    },
    ...rest
  } = withSheetCatalog(sheet);
  return { ...rest, character };
}

test('account deletion revokes access at once, keeps campaign Characters ownerless with every definition and state for the remaining members, and deletes private ones', async () => {
  const context = await fixture();
  const { t, owner, member, campaignId, characterId } = context;
  // Vessa carries her own homebrew, campaign homebrew, an accepted warning
  // and a Companion.
  const ownFeat = await createOneOffFeat(owner, characterId, 'own-feat');
  const campaignFeat = await createOneOffFeat(
    owner,
    characterId,
    'campaign-feat',
  );
  const saved = await t.run((ctx) =>
    ctx.db.get('characterSheetEntry', campaignFeat),
  );
  if (!saved || !('catalogEntryId' in saved)) throw new Error('Feat missing');
  await owner.mutation(api.catalogCopies.saveToCatalog, {
    characterId,
    catalogEntryId: saved.catalogEntryId,
    operationId: 'save-feat',
  });
  await acceptFavoredClassWarning(context, characterId);
  const wolf = await owner.mutation(api.companionRelationships.create, {
    associatedCharacterId: characterId,
    kind: 'animalCompanion',
    name: 'Grey',
    sources: [{ key: 'bond', label: 'Bond', enabled: true }],
    operationId: 'wolf',
  });
  // Ash is private, with her own homebrew and a private Companion.
  const ashId = await owner.mutation(api.characterSheet.create, {
    name: 'Ash',
    kind: 'pc',
    operationId: 'create-ash',
  });
  await createOneOffFeat(owner, ashId, 'ash-feat');
  const cat = await owner.mutation(api.companionRelationships.create, {
    associatedCharacterId: ashId,
    kind: 'animalCompanion',
    name: 'Soot',
    sources: [{ key: 'bond', label: 'Bond', enabled: true }],
    operationId: 'cat',
  });
  const before = await readSheet(member, characterId);
  const storedBefore = await readCharacterRows(t, characterId);
  expect(storedBefore.acceptedWarnings).toHaveLength(1);
  expect(storedBefore.relationships).toHaveLength(1);

  await deleteAccount(t);

  // Before any background work runs, the deleted account has no access.
  expect(await readUser(t, 'owner')).toBeNull();
  for (const id of [characterId, ashId, cat.companionCharacterId])
    await expect(readSheet(owner, id)).rejects.toThrow('Character not found');
  expect(await owner.query(api.character.listOwned, {})).toEqual([]);
  await expect(
    owner.query(api.character.listCampaignCharacters, {
      campaignId,
      organizationId: 'org',
    }),
  ).resolves.toEqual([]);

  await finishBackgroundWork(t);

  // Vessa and her Companion stay in the campaign, ownerless and unchanged.
  expect(withoutOwner(await readSheet(member, characterId))).toEqual(
    withoutOwner(before),
  );
  const storedAfter = await readCharacterRows(t, characterId);
  expect(storedAfter.character?.ownerId).toBeUndefined();
  expect({ ...storedAfter, character: null }).toEqual({
    ...storedBefore,
    character: null,
  });
  expect(
    await member.query(api.character.listCampaignCharacters, {
      campaignId,
      organizationId: 'org',
    }),
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        character: expect.objectContaining({ _id: characterId }),
        owner: null,
        ownerName: null,
        ownerDeparted: false,
      }),
      expect.objectContaining({
        character: expect.objectContaining({ _id: wolf.companionCharacterId }),
        owner: null,
      }),
    ]),
  );
  const sheet = withSheetCatalog(await readSheet(member, characterId));
  expect(sheet?.entries.map((entry) => entry._id)).toEqual(
    expect.arrayContaining([ownFeat, campaignFeat]),
  );
  // The remaining member edits Vessa.
  await member.mutation(api.characterSheet.editBaseScores, {
    characterId,
    operationId: 'member-edit',
    scores: { strength: 16 },
  });
  // Her two Strong heart feats still add to the new base score.
  expect(
    (await readSheet(member, characterId))?.calculated.abilities.strength.score,
  ).toBe(20);

  // Ash, her Companion and their own definitions are deleted. As with any
  // private deletion (#260), their link stays only as interrupted history.
  for (const id of [ashId, cat.companionCharacterId])
    expect(await readCharacterRows(t, id)).toEqual({
      character: null,
      entries: [],
      definitions: [],
      acceptedWarnings: [],
      relationships: [
        expect.objectContaining({
          _id: cat.relationshipId,
          status: 'interrupted',
        }),
      ],
    });
  expect(await readDeletion(t)).toMatchObject({ state: 'completed' });
});

test('any remaining member can claim an ownerless Character or assign it, and only its new owner can then move it', async () => {
  const { t, owner, member, outsider, campaignId, characterId } =
    await fixture();
  await t.run(async (ctx) => {
    const thirdId = await ctx.db.insert('user', {
      tokenIdentifier: token('third'),
      name: 'third player',
      orgIds: [{ orgId: 'org', role: 'member' }],
    });
    // The member directory lists every current member.
    for (const user of await ctx.db.query('user').take(10))
      if (user.orgIds.some((org) => org.orgId === 'org'))
        await ctx.db.insert('organizationMembership', {
          userId: user._id,
          organizationId: 'org',
        });
    return thirdId;
  });
  const third = t.withIdentity({ tokenIdentifier: token('third') });
  const ownerUserId = await readUserId(t, 'owner');
  await deleteAccount(t);
  await finishBackgroundWork(t);

  // Nobody can move an ownerless Character.
  await expect(
    member.mutation(api.characterMoves.start, {
      characterId,
      operationId: 'leave',
    }),
  ).rejects.toThrow('Only the current owner can leave or move a Character');
  // The deleted account can't be chosen, and an outsider learns nothing.
  await expect(
    member.mutation(api.character.reassignOwner, {
      characterId,
      campaignId,
      ownerUserId,
      operationId: 'give-back',
    }),
  ).rejects.toThrow('Choose a current campaign member');
  const memberUserId = await readUserId(t, 'member');
  await expect(
    outsider.mutation(api.character.reassignOwner, {
      characterId,
      campaignId,
      ownerUserId: memberUserId,
      operationId: 'outsider-claim',
    }),
  ).rejects.toThrow('You do not have access to this org');
  await expect(readSheet(outsider, characterId)).rejects.toThrow(
    'Character not found',
  );
  await expect(readSheet(owner, characterId)).rejects.toThrow(
    'Character not found',
  );

  const candidates = await member.query(api.character.listOwnerCandidates, {
    campaignId,
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(candidates.page.map((candidate) => candidate.name).sort()).toEqual([
    'member player',
    'third player',
  ]);
  await third.mutation(api.character.reassignOwner, {
    characterId,
    campaignId,
    ownerUserId: memberUserId,
    operationId: 'assign-member',
  });
  expect((await readSheet(member, characterId))?.owner).toMatchObject({
    name: 'member player',
    isMine: true,
  });
  const leave = { characterId, operationId: 'member-leaves' };
  let progress = await member.mutation(api.characterMoves.start, leave);
  for (let step = 0; step < 100 && progress.state !== 'completed'; step++)
    progress = await member.mutation(api.characterMoves.resume, leave);
  expect(progress.state).toBe('completed');
  expect((await readSheet(member, characterId))?.campaign).toBeNull();
});

test('deletion before removal: late membership and profile events are acknowledged and restore nothing', async () => {
  const { t, owner, member, campaignId, characterId } = await fixture();
  await deleteAccount(t);
  await finishBackgroundWork(t);

  for (const type of [
    'organizationMembership.deleted',
    'organizationMembership.created',
    'organizationMembership.updated',
    'user.created',
    'user.updated',
  ] as const)
    for (const updatedAt of [1, 9])
      expect(
        (await deliver(t, type, { userId: 'owner', updatedAt })).status,
      ).toBe(200);
  await deleteAccount(t);
  await finishBackgroundWork(t);

  expect(await readUser(t, 'owner')).toBeNull();
  expect(
    await t.run((ctx) => ctx.db.query('organizationDeparture').first()),
  ).toBeNull();
  await expect(readSheet(owner, characterId)).rejects.toThrow(
    'Character not found',
  );
  const sheet = await readSheet(member, characterId);
  expect(sheet?.campaign).toMatchObject({ campaignId });
  expect(sheet?.owner).toBeNull();
  expect(
    await t.run((ctx) => ctx.db.query('accountDeletion').take(10)),
  ).toHaveLength(1);
});

test('a deletion within the grace after a removal wins: no return starts and the campaign Character stays ownerless', async () => {
  const { t, owner, member, campaignId, characterId } = await fixture();
  await deliver(t, 'organizationMembership.deleted', {
    userId: 'owner',
    updatedAt: 2,
  });
  await expect(readSheet(owner, characterId)).rejects.toThrow(
    'Character not found',
  );
  vi.advanceTimersByTime(departureGraceMs - 1000);
  await t.finishInProgressScheduledFunctions();

  await deleteAccount(t);
  await finishBackgroundWork(t);

  expect(await readMoveStates(t, characterId)).toEqual([]);
  const sheet = await readSheet(member, characterId);
  expect(sheet?.campaign).toMatchObject({ campaignId });
  expect(sheet?.owner).toBeNull();
  expect(
    await t.run((ctx) => ctx.db.query('organizationDeparture').first()),
  ).toMatchObject({ state: 'completed', outcome: 'accountDeleted' });
});

test('removal after the grace, then deletion: an in-flight return stops, a Character it already returned is deleted and the rest stay ownerless in the campaign', async () => {
  const { t, owner, member, campaignId, characterId } = await fixture();
  const kelId = await owner.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Kel',
    kind: 'pc',
    operationId: 'create-kel',
  });
  await deliver(t, 'organizationMembership.deleted', {
    userId: 'owner',
    updatedAt: 2,
  });
  // No deletion arrives within the grace, so the departure returns Vessa and
  // starts on Kel.
  vi.advanceTimersByTime(departureGraceMs);
  for (let step = 0; step < 100; step++) {
    const states = await readMoveStates(t, kelId);
    if (states.some((move) => move.state === 'preparing')) break;
    await runDueWork(t);
  }
  expect(await readMoveStates(t, characterId)).toEqual([
    { state: 'completed' },
  ]);
  expect(await readMoveStates(t, kelId)).toEqual([{ state: 'preparing' }]);

  await deleteAccount(t);
  await finishBackgroundWork(t);

  // Vessa had already gone private, so she follows private deletion.
  expect((await readCharacterRows(t, characterId)).character).toBeNull();
  // Kel's return was stale once the account was deleted.
  const kel = await readSheet(member, kelId);
  expect(kel?.campaign).toMatchObject({ campaignId });
  expect(kel?.owner).toBeNull();
  expect(await readMoveStates(t, kelId)).toEqual([
    { state: 'cancelled', cancelReason: 'ownershipChanged' },
  ]);
  expect(
    await t.run((ctx) => ctx.db.query('organizationDeparture').first()),
  ).toMatchObject({ state: 'completed', outcome: 'accountDeleted' });
});

test('a genuine private departure completed after the grace and followed by deletion deletes the returned Character with its copied homebrew', async () => {
  const { t, owner, member, campaignId, characterId } = await fixture();
  const featEntry = await createOneOffFeat(owner, characterId, 'feat');
  const saved = await t.run((ctx) =>
    ctx.db.get('characterSheetEntry', featEntry),
  );
  if (!saved || !('catalogEntryId' in saved)) throw new Error('Feat missing');
  await owner.mutation(api.catalogCopies.saveToCatalog, {
    characterId,
    catalogEntryId: saved.catalogEntryId,
    operationId: 'save-feat',
  });
  await deliver(t, 'organizationMembership.deleted', {
    userId: 'owner',
    updatedAt: 2,
  });
  // No deletion arrives within the grace, so the return completes.
  vi.advanceTimersByTime(departureGraceMs);
  await finishBackgroundWork(t);
  expect((await readSheet(owner, characterId))?.campaign).toBeNull();

  await deleteAccount(t);
  await finishBackgroundWork(t);

  expect(await readCharacterRows(t, characterId)).toEqual({
    character: null,
    entries: [],
    definitions: [],
    acceptedWarnings: [],
    relationships: [],
  });
  // The campaign keeps its own definition.
  const rookId = await member.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Rook',
    kind: 'pc',
    operationId: 'create-rook',
  });
  expect(
    await member.query(api.catalogCopies.list, { characterId: rookId }),
  ).toContainEqual(
    expect.objectContaining({ _id: saved.catalogEntryId, scope: 'campaign' }),
  );
});

test('a stale deletion job cannot undo a reassignment, and duplicate drivers complete the deletion once', async () => {
  const { t, owner, member, campaignId, characterId } = await fixture();
  const ashId = await owner.mutation(api.characterSheet.create, {
    name: 'Ash',
    kind: 'pc',
    operationId: 'create-ash',
  });
  await deleteAccount(t);
  const deletion = await readDeletion(t);
  if (!deletion) throw new Error('Deletion missing');
  await Promise.all(
    [0, 1].map(() =>
      t.mutation(internal.accountDeletions.drive, {
        deletionId: deletion._id,
      }),
    ),
  );
  await finishBackgroundWork(t);
  const memberUserId = await readUserId(t, 'member');
  await member.mutation(api.character.reassignOwner, {
    characterId,
    campaignId,
    ownerUserId: memberUserId,
    operationId: 'claim',
  });

  // Stale drivers and steps for both Characters change nothing.
  await t.mutation(internal.accountDeletions.drive, {
    deletionId: deletion._id,
  });
  for (const id of [characterId, ashId])
    await t.mutation(internal.accountDeletions.step, {
      deletionId: deletion._id,
      characterId: id,
    });
  await finishBackgroundWork(t);

  expect((await readSheet(member, characterId))?.owner).toMatchObject({
    isMine: true,
  });
  expect((await readCharacterRows(t, ashId)).character).toBeNull();
  expect(await readDeletion(t)).toMatchObject({ state: 'completed' });
});

test('deletion waits through maintenance and sheet authority while access stays revoked', async () => {
  const { t, owner, member, characterId } = await fixture();
  const run = await t.mutation(internal.initialMigration.start, {
    operationId: 'deletion-maintenance',
    expectedEpoch: 0,
    frontendBuild: 'build',
    catalogManifest: 'catalog',
    maintenanceBudgetMs: 60000,
  });
  // The provider retries a delivery refused during maintenance.
  expect((await deliver(t, 'user.deleted', { userId: 'owner' })).status).toBe(
    503,
  );
  await t.mutation(internal.initialMigration.abortBeforeActivation, run);
  await deleteAccount(t);
  await expect(readSheet(owner, characterId)).rejects.toThrow(
    'Character not found',
  );
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
  expect(await readDeletion(t)).toMatchObject({ state: 'deleting' });
  expect((await readCharacterRows(t, characterId)).character?.ownerId).toBe(
    token('owner'),
  );
  await setAuthority('legacy');
  await finishBackgroundWork(t);
  expect((await readSheet(member, characterId))?.owner).toBeNull();
  expect(await readDeletion(t)).toMatchObject({ state: 'completed' });
});

test('a production campaign keeps the deleted owner’s legacy Character under legacy authority for the remaining members', async () => {
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
  await deleteAccount(t);
  await finishBackgroundWork(t);
  const production = { campaignId: productionId, organizationId: 'org' };
  expect(
    await member.query(api.character.listCampaignCharacters, production),
  ).toMatchObject([
    { character: { _id: legacyId }, owner: null, ownerDeparted: false },
  ]);
  expect((await readCharacterRows(t, legacyId)).character?.ownerId).toBe(
    token('owner'),
  );
  expect(await readDeletion(t)).toMatchObject({
    state: 'completed',
    legacyRetained: 1,
  });
});

/** Per-Character failure records, read as an invariant. */
async function readFailures(t: Fixture['t']) {
  const rows = await t.run((ctx) =>
    ctx.db.query('accountDeletionCharacter').take(10),
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

test('a Character that keeps failing to delete is set aside while the deletion goes on, and is deleted once it can be', async () => {
  const { t, owner, member, characterId } = await fixture();
  const [ashId, boId] = [
    await owner.mutation(api.characterSheet.create, {
      name: 'Ash',
      kind: 'pc',
      operationId: 'create-ash',
    }),
    await owner.mutation(api.characterSheet.create, {
      name: 'Bo',
      kind: 'pc',
      operationId: 'create-bo',
    }),
  ];
  // Ash's sheet holds more rows than one deletion removes.
  const extraRows = await t.run(async (ctx) => {
    const [entry] = await ctx.db
      .query('characterSheetEntry')
      .withIndex('by_characterId', (q) => q.eq('characterId', ashId))
      .take(1);
    if (!entry) throw new Error('Ash has no rows');
    const { _id, _creationTime, ...row } = entry;
    const ids = [];
    for (let index = 0; index < 4096; index++)
      ids.push(await ctx.db.insert('characterSheetEntry', row));
    return ids;
  });
  await deleteAccount(t);

  await runUntil(t, async () => (await readDeletion(t))?.state === 'completed');
  expect((await readCharacterRows(t, boId)).character).toBeNull();
  expect((await readSheet(member, characterId))?.owner).toBeNull();
  expect(await readFailures(t)).toEqual([
    { characterId: ashId, failures: 3, setAside: true },
  ]);
  // A slower retry keeps failing without growing the count.
  await runDueWork(t);
  expect(await readFailures(t)).toEqual([
    { characterId: ashId, failures: 3, setAside: true },
  ]);

  await t.run(async (ctx) => {
    for (const id of extraRows) await ctx.db.delete('characterSheetEntry', id);
  });
  await runUntil(t, async () => (await readFailures(t)).length === 0);
  expect((await readCharacterRows(t, ashId)).character).toBeNull();
});

test('signed deliveries for an unknown user are refused for the provider to retry, while a known deletion is acknowledged', async () => {
  const { t } = await campaignFixture();
  expect(
    (
      await deliver(t, 'organizationMembership.deleted', {
        userId: 'unknown-user',
      })
    ).status,
  ).toBe(400);
  // A deletion for an account the app never saw is still remembered, so a
  // late creation cannot bring it back.
  await deleteAccount(t, 'unknown-user');
  expect(
    (await deliver(t, 'user.created', { userId: 'unknown-user' })).status,
  ).toBe(200);
  expect(
    (
      await deliver(t, 'organizationMembership.deleted', {
        userId: 'unknown-user',
      })
    ).status,
  ).toBe(200);
  expect(await readUser(t, 'unknown-user')).toBeNull();
  await finishBackgroundWork(t);
  expect(await readDeletion(t)).toMatchObject({ state: 'completed' });
});
