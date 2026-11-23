import { convexTest } from 'convex-test';
import { expect, vi } from 'vitest';
import type { FunctionArgs } from 'convex/server';
import { api } from '../convex/_generated/api';
import type { Id } from '../convex/_generated/dataModel';
import schema from '../convex/schema';
import { acceptedCampaignSetup } from './rules/accepted-campaign';
import { initializationEdits } from './rules/initialization-edits';

/**
 * Shared seams for the campaign and organization deletion tests (#710): a
 * prepared campaign shared by an owner and a member, signed provider events
 * through the real webhook route, and the background work they start.
 */

/** The token the webhook derives for a Clerk user ID. */
export function token(userId: string) {
  return `https://${process.env.CLERK_HOSTNAME}|${userId}`;
}

type Modules = Record<string, () => Promise<unknown>>;

/** A prepared campaign's fixture identity. */
export function fixtureCampaign(campaignKey: string) {
  return {
    namespace: 'container-deletion',
    version: 1,
    workerKey: '0',
    caseKey: 'deletion',
    campaignKey,
  };
}

/**
 * The owner and the member, an admin, share the organization `org` and its
 * prepared campaign Ironfang. The outsider belongs only to `other`.
 */
export async function campaignFixture(modules: Modules) {
  const t = convexTest(schema, modules);
  const campaignId = await t.run(async (ctx) => {
    for (const [name, role] of [
      ['owner', 'member'],
      ['member', 'admin'],
    ] as const) {
      const userId = await ctx.db.insert('user', {
        tokenIdentifier: token(name),
        name: `${name} player`,
        webhookUpdatedAt: 1,
        orgIds: [{ orgId: 'org', role, webhookUpdatedAt: 1 }],
        characterSheetDemo: true,
      });
      await ctx.db.insert('organizationMembership', {
        userId,
        organizationId: 'org',
      });
    }
    const outsiderId = await ctx.db.insert('user', {
      tokenIdentifier: token('outsider'),
      name: 'outsider player',
      orgIds: [{ orgId: 'other', role: 'admin' }],
    });
    await ctx.db.insert('organizationMembership', {
      userId: outsiderId,
      organizationId: 'other',
    });
    return ctx.db.insert('campaign', {
      name: 'Ironfang',
      description: '',
      organizationId: 'org',
      ownerId: token('member'),
      e2eFixture: fixtureCampaign('ironfang'),
    });
  });
  const owner = t.withIdentity({ tokenIdentifier: token('owner') });
  const member = t.withIdentity({ tokenIdentifier: token('member') });
  const outsider = t.withIdentity({ tokenIdentifier: token('outsider') });
  return { t, owner, member, outsider, campaignId };
}

export type CampaignFixture = Awaited<ReturnType<typeof campaignFixture>>;
export type Viewer = CampaignFixture['owner'];
type Tester = CampaignFixture['t'];

/** A Full Character the viewer creates in the campaign. */
export function createCharacter(
  viewer: Viewer,
  campaignId: Id<'campaign'>,
  name: string,
) {
  return viewer.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name,
    kind: 'pc',
    operationId: `create-${name}`,
  });
}

export function readSheet(viewer: Viewer, characterId: Id<'character'>) {
  return viewer.query(api.characterSheet.read, { characterId });
}

/** The read's outcome: `readable`, or the refusal's message. */
export function outcome(read: Promise<unknown>) {
  return read.then(
    () => 'readable',
    (error: Error) => error.message,
  );
}

const strongHeart = {
  name: 'Strong heart',
  modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 2 }],
  stacksWithItself: false,
  sources: [],
  detail: { kind: 'feat' },
} satisfies FunctionArgs<typeof api.catalogCopies.createOneOff>['definition'];

/** A one-off feat the viewer made and saved to the campaign catalog. */
export async function saveCampaignFeat(
  t: Tester,
  viewer: Viewer,
  characterId: Id<'character'>,
) {
  const entryId = await viewer.mutation(api.catalogCopies.createOneOff, {
    characterId,
    operationId: 'create-feat',
    definition: strongHeart,
  });
  const entry = await t.run((ctx) =>
    ctx.db.get('characterSheetEntry', entryId),
  );
  if (!entry || !('catalogEntryId' in entry)) throw new Error('Feat missing');
  await viewer.mutation(api.catalogCopies.saveToCatalog, {
    characterId,
    catalogEntryId: entry.catalogEntryId,
    operationId: 'save-feat',
  });
  return { entryId, campaignFeatId: entry.catalogEntryId };
}

/** The member sets up the militia with the Character on its roster. */
export async function setUpMilitia(
  member: Viewer,
  campaignId: Id<'campaign'>,
  characterId: Id<'character'>,
) {
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

/** The member confirms week 9 with the Character on the roster. */
export async function finishMilitiaWeek(
  member: Viewer,
  campaignId: Id<'campaign'>,
  characterId: Id<'character'>,
) {
  const key = await setUpMilitia(member, campaignId, characterId);
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

type ProviderEvent =
  | { type: 'user.deleted'; userId: string }
  | { type: 'organization.deleted'; orgId: string }
  | {
      type:
        | 'organizationMembership.created'
        | 'organizationMembership.updated'
        | 'organizationMembership.deleted';
      userId: string;
      orgId: string;
      updatedAt: number;
    };

/** Deliver a signed Clerk event through the real webhook route. */
export async function deliver(t: Tester, event: ProviderEvent) {
  const data =
    event.type === 'user.deleted'
      ? { id: event.userId, object: 'user', deleted: true }
      : event.type === 'organization.deleted'
        ? { id: event.orgId, object: 'organization', deleted: true }
        : {
            public_user_data: { user_id: event.userId },
            organization: { id: event.orgId },
            role: 'org:member',
            updated_at: event.updatedAt,
          };
  const response = await t.fetch('/clerk', {
    method: 'POST',
    body: JSON.stringify({ type: event.type, data }),
    headers: {
      'svix-id': `${event.type}:${JSON.stringify(data)}`,
      'svix-timestamp': '1',
      'svix-signature': 'valid',
    },
  });
  expect(response.status).toBe(200);
}

/** Run only the background work already due: one bounded step. */
export async function runDueWork(t: Tester) {
  vi.runOnlyPendingTimers();
  await t.finishInProgressScheduledFunctions();
}

export async function finishBackgroundWork(t: Tester) {
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
}

/** Run due background work, one step at a time, until `done` holds. */
export async function runUntil(t: Tester, done: () => Promise<boolean>) {
  for (let step = 0; step < 200 && !(await done()); step++) await runDueWork(t);
  expect(await done()).toBe(true);
}

/** The states of the Character's moves, oldest first, as an invariant. */
export async function readMoveStates(t: Tester, characterId: Id<'character'>) {
  const moves = await t.run((ctx) =>
    ctx.db
      .query('characterMove')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
      .take(10),
  );
  return moves.map(({ state }) => state);
}

export async function readUserId(t: Tester, userId: string) {
  const user = await t.run((ctx) =>
    ctx.db
      .query('user')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', token(userId)),
      )
      .unique(),
  );
  if (!user) throw new Error(`Missing user ${userId}`);
  return user._id;
}

/** The member takes ownership of the Character. */
export async function takeOwnership(
  t: Tester,
  viewer: Viewer,
  viewerName: string,
  campaignId: Id<'campaign'>,
  characterId: Id<'character'>,
) {
  await viewer.mutation(api.character.reassignOwner, {
    characterId,
    campaignId,
    ownerUserId: await readUserId(t, viewerName),
    operationId: `take-${characterId}`,
  });
}

/**
 * Hand the Character's base scores to another Character, so its own sheet
 * can't be read and every return of it fails; handing them back mends it.
 */
export function setBaseScoresHolder(
  t: Tester,
  characterId: Id<'character'>,
  holderId: Id<'character'>,
) {
  return t.run(async (ctx) => {
    const base = await ctx.db
      .query('catalogEntry')
      .withIndex('by_ruleIdentity', (q) =>
        q.eq('ruleIdentity', `base:${characterId}`),
      )
      .unique();
    if (!base) throw new Error('Base scores missing');
    await ctx.db.patch('catalogEntry', base._id, { characterId: holderId });
  });
}

/** The organization's deleted campaigns, as the viewer's first page shows them. */
export async function listDeletedCampaigns(viewer: Viewer) {
  const { page } = await viewer.query(api.campaignDeletions.list, {
    organizationId: 'org',
    paginationOpts: { numItems: 25, cursor: null },
  });
  return page;
}
