// @vitest-environment edge-runtime
import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import { convexTest } from 'convex-test';
import type { Infer } from 'convex/values';
import { refuseRepeatedPaginatedQueries } from '../tests/convex-paginated-queries';
import { preloadCalledConvexModules } from '../tests/convex-modules';
import {
  closedAndBackfilled,
  frontendBuild,
} from '../tests/initial-migration-fixture';
import {
  deliver,
  finishBackgroundWork,
  token,
} from '../tests/container-deletion';
import type { ReleaseTest } from '../tests/catalog-release-fixture';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';
import { syncOrganizationMemberships } from './organizationMembership';
import schema from './schema';
import type { lifecycleCatchUpValidator } from './schema';

// #413 F7b: the catch-up sweep `reopen` schedules. Departures and account
// deletions that completed under legacy authority left their Characters in
// the campaign as `legacyRetained`; after a real activation the sweep finds
// them by state: a departed owner gets their Character back, a deleted
// owner's becomes ownerless, and an owner with neither a user row nor a
// deletion is only counted.

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

afterEach(() => vi.useRealTimers());

const modules = import.meta.glob('./**/*.ts');
beforeAll(() => refuseRepeatedPaginatedQueries(schema, modules));
preloadCalledConvexModules({ modules, testFile: import.meta.url });
// Provider deliveries and the drivers they start reach these modules too.
beforeAll(async () => {
  for (const name of [
    'http',
    'clerk',
    'user',
    'organizationDepartures',
    'accountDeletions',
    'characterMoves',
  ])
    await modules[`./${name}.ts`]?.();
}, 30_000);

// The accepted campaign's organization (`seedAcceptedCampaign`).
const organizationId = 'org';

async function addMember(ctx: MutationCtx, name: string) {
  const orgIds = [
    { orgId: organizationId, role: 'member' as const, webhookUpdatedAt: 1 },
  ];
  const userId = await ctx.db.insert('user', {
    tokenIdentifier: token(name),
    name: `${name} player`,
    webhookUpdatedAt: 1,
    orgIds,
  });
  await syncOrganizationMemberships(ctx, userId, orgIds);
}

/** A flat legacy Character in the campaign, as production holds them. */
function addCharacter(
  ctx: MutationCtx,
  {
    campaignId,
    owner,
    name,
    description = '',
  }: {
    campaignId: Id<'campaign'>;
    owner: string;
    name: string;
    description?: string;
  },
) {
  return ctx.db.insert('character', {
    campaignId,
    name,
    ownerId: token(owner),
    kind: 'pc',
    isActive: true,
    level: 3,
    description,
    strength: 10,
    dexterity: 11,
    constitution: 12,
    intelligence: 13,
    wisdom: 14,
    charisma: 15,
  });
}

function membershipEvent(
  type: 'organizationMembership.created' | 'organizationMembership.deleted',
  userId: string,
  updatedAt: number,
) {
  return { type, userId, orgId: organizationId, updatedAt };
}

/**
 * An ordinary campaign under legacy authority, open: Dee is removed and Eli's
 * account deleted, and both complete with their Characters `legacyRetained`.
 * Kit is removed and rejoins after that departure completed. Gus owns two
 * Characters but has no user row and no deletion (a lost `user.created`).
 * The accepted campaign's officer is owned by `gm`, which has no user row
 * either. Then a real activate, publish, smoke and reopen.
 *
 * Owners sort as `gm`, Dee, Eli, Gus, Gus, Kit in the owner index, so the
 * sweep's pages of one Character split Gus's two.
 */
async function reopenedAfterLegacyLifecycles() {
  const ids = {} as Record<
    'dee' | 'eli' | 'gus1' | 'gus2' | 'kit',
    Id<'character'>
  >;
  const { t, receipt, args, seeded } = await closedAndBackfilled(modules, {
    async whileOpen({ t, seeded }) {
      const { campaignId } = seeded.key;
      await t.run(async (ctx) => {
        for (const name of ['dee', 'eli', 'kit']) await addMember(ctx, name);
        ids.dee = await addCharacter(ctx, {
          campaignId,
          owner: 'dee',
          name: 'Dee hero',
        });
        ids.eli = await addCharacter(ctx, {
          campaignId,
          owner: 'eli',
          name: 'Eli hero',
        });
        ids.gus1 = await addCharacter(ctx, {
          campaignId,
          owner: 'gus',
          name: 'Gus hero',
        });
        ids.gus2 = await addCharacter(ctx, {
          campaignId,
          owner: 'gus',
          name: 'Gus sidekick',
        });
        ids.kit = await addCharacter(ctx, {
          campaignId,
          owner: 'kit',
          name: 'Kit hero',
        });
      });
      await deliver(
        t,
        membershipEvent('organizationMembership.deleted', 'dee', 2),
      );
      await deliver(t, { type: 'user.deleted', userId: 'eli' });
      await deliver(
        t,
        membershipEvent('organizationMembership.deleted', 'kit', 2),
      );
      await finishBackgroundWork(t);
      await deliver(
        t,
        membershipEvent('organizationMembership.created', 'kit', 3),
      );
    },
  });
  const legacy = await readLifecycles(t);
  return {
    t,
    run: await activateAndReopen({ t, receipt, args }),
    campaignId: seeded.key.campaignId,
    officerId: seeded.characterId,
    ids,
    legacy,
  };
}

/** A real activate, publish, smoke and reopen; the sweep's page 0 waits. */
async function activateAndReopen({
  t,
  receipt,
  args,
}: Pick<
  Awaited<ReturnType<typeof closedAndBackfilled>>,
  't' | 'receipt' | 'args'
>) {
  const run = { runId: receipt.runId, epoch: receipt.epoch };
  await t.mutation(internal.initialMigration.activate, args);
  await t.mutation(internal.initialMigration.publish, {
    ...run,
    activationId: args.activationId,
    page: 0,
  });
  await finishBackgroundWork(t);
  await t.mutation(internal.initialMigration.smoke, { ...run, smokeId: 's' });
  const { epoch } = await t.mutation(internal.initialMigration.reopen, {
    ...run,
    observedFrontendBuild: frontendBuild,
  });
  return { ...run, epoch };
}

function readLifecycles(t: ReleaseTest) {
  return t.run(async (ctx) => ({
    departures: await ctx.db.query('organizationDeparture').take(10),
    deletions: await ctx.db.query('accountDeletion').take(10),
  }));
}

function readCharacters(t: ReleaseTest) {
  return t.run((ctx) => ctx.db.query('character').take(20));
}

function readCatchUp(t: ReleaseTest) {
  return t
    .query(internal.initialMigration.status, { now: 0 })
    .then(({ catchUp }) => catchUp);
}

function readPendingWork(t: ReleaseTest) {
  return t.run(async (ctx) =>
    (await ctx.db.system.query('_scheduled_functions').take(100)).filter(
      ({ state }) => state.kind === 'pending',
    ),
  );
}

test('the sweep returns the departed owner’s Character, makes the deleted owner’s ownerless, leaves a rejoined member’s alone and only counts owners nobody knows', async () => {
  const { t, campaignId, officerId, ids, legacy, run } =
    await reopenedAfterLegacyLifecycles();
  expect(legacy.departures).toMatchObject([
    { state: 'completed', outcome: 'returned', legacyRetained: 1, round: 1 },
    { state: 'completed', outcome: 'returned', legacyRetained: 1, round: 1 },
  ]);
  expect(legacy.deletions).toMatchObject([
    { tokenIdentifier: token('eli'), state: 'completed', legacyRetained: 1 },
  ]);
  const before = await readCharacters(t);

  await finishBackgroundWork(t);

  const after = new Map(
    (await readCharacters(t)).map((character) => [character._id, character]),
  );
  expect(after.get(ids.dee)).toMatchObject({ ownerId: token('dee') });
  expect(after.get(ids.dee)?.campaignId).toBeUndefined();
  expect(after.get(ids.eli)).toMatchObject({ campaignId });
  expect(after.get(ids.eli)?.ownerId).toBeUndefined();
  // A rejoined member, an owner with no user row and no deletion, and the
  // officer's owner `gm` (likewise unknown) keep their Characters as they were.
  for (const id of [ids.kit, ids.gus1, ids.gus2, officerId])
    expect(after.get(id)).toEqual(before.find(({ _id }) => _id === id));

  const { departures, deletions } = await readLifecycles(t);
  // Dee's departure ran a second round, keeping the removal's provider time
  // as its fence; Kit's, completed before the rejoin, is as it was.
  const [deeDeparture, kitDeparture] = departures;
  expect(deeDeparture).toMatchObject({
    _id: legacy.departures[0]?._id,
    state: 'completed',
    outcome: 'returned',
    round: 2,
    webhookUpdatedAt: 2,
  });
  expect(deeDeparture?.legacyRetained).toBeUndefined();
  expect(kitDeparture).toEqual(legacy.departures[1]);
  expect(deletions).toMatchObject([{ state: 'completed' }]);
  expect(deletions[0]?.legacyRetained).toBeUndefined();

  expect(await readCatchUp(t)).toMatchObject({
    state: 'completed',
    epoch: run.epoch,
    pages: 6,
    counts: {
      characters: 6,
      departuresStarted: 1,
      deletionsResumed: 1,
      unknownOwners: 2,
    },
  });
  expect(await readPendingWork(t)).toEqual([]);
});

test('duplicate sweep drivers and a rerun change nothing', async () => {
  const { t, run } = await reopenedAfterLegacyLifecycles();
  // A duplicate of the page `reopen` scheduled, before either runs.
  const first = await t.mutation(internal.lifecycleCatchUp.sweep, {
    writeEpoch: run.epoch,
    page: 0,
  });
  expect(first).toMatchObject({ state: 'sweeping', nextPage: 1 });
  await expect(
    t.mutation(internal.lifecycleCatchUp.sweep, {
      writeEpoch: run.epoch,
      page: 0,
    }),
  ).resolves.toEqual(first);
  await finishBackgroundWork(t);
  const lifecycles = await readLifecycles(t);
  expect(lifecycles.departures.map(({ round }) => round).sort()).toEqual([
    1, 2,
  ]);
  const characters = await readCharacters(t);
  const completed = await readCatchUp(t);
  expect(completed).toMatchObject({
    state: 'completed',
    counts: { departuresStarted: 1, deletionsResumed: 1 },
  });

  for (const page of [0, 1])
    await expect(
      t.mutation(internal.lifecycleCatchUp.sweep, {
        writeEpoch: run.epoch,
        page,
      }),
    ).resolves.toEqual(completed);
  expect(await readPendingWork(t)).toEqual([]);
  await finishBackgroundWork(t);
  expect(await readLifecycles(t)).toEqual(lifecycles);
  expect(await readCharacters(t)).toEqual(characters);
});

test('a second sweep after closing for repair and reopening changes nothing, and the sweep is refused while closed', async () => {
  const { t, run } = await reopenedAfterLegacyLifecycles();
  await finishBackgroundWork(t);
  const lifecycles = await readLifecycles(t);
  const characters = await readCharacters(t);

  const { epoch: closed } = await t.mutation(
    internal.initialMigration.closeForRepair,
    run,
  );
  for (const writeEpoch of [run.epoch, closed])
    await expect(
      t.mutation(internal.lifecycleCatchUp.sweep, { writeEpoch, page: 0 }),
    ).rejects.toThrow('MAINTENANCE');
  await t.mutation(internal.initialMigration.smoke, {
    ...run,
    epoch: closed,
    smokeId: 'repair',
  });
  const { epoch: reopened } = await t.mutation(
    internal.initialMigration.reopen,
    { ...run, epoch: closed, observedFrontendBuild: frontendBuild },
  );
  await finishBackgroundWork(t);

  expect(await readLifecycles(t)).toEqual(lifecycles);
  expect(await readCharacters(t)).toEqual(characters);
  expect(await readCatchUp(t)).toMatchObject({
    state: 'completed',
    epoch: reopened,
    counts: {
      // The returned and the ownerless Characters are no longer found.
      characters: 4,
      departuresStarted: 0,
      deletionsResumed: 0,
      unknownOwners: 2,
    },
  });
  // A page of the earlier sweep is stale at the reopened epoch.
  await expect(
    t.mutation(internal.lifecycleCatchUp.sweep, {
      writeEpoch: run.epoch,
      page: 0,
    }),
  ).rejects.toThrow('RELOAD_REQUIRED');
});

// The largest rows the schema allows, near Convex's 1 MiB document limit.
const largeText = 'x'.repeat(900_000);
// The longest failure the drivers record: 500 UTF-16 units of 3 UTF-8 bytes.
const driverFailure = '€'.repeat(500);

/**
 * A completed departure of a non-member with failure rows of the given texts,
 * on ownerless Characters the sweep never reads, stored `perRun` rows per
 * transaction because convex-test enforces the limits here too.
 */
async function addCompletedDeparture(
  t: ReleaseTest,
  {
    userId,
    failures,
    perRun,
  }: { userId: Id<'user'>; failures: readonly string[]; perRun: number },
) {
  const departureId = await t.run((ctx) =>
    ctx.db.insert('organizationDeparture', {
      userId,
      organizationId,
      webhookUpdatedAt: 2,
      round: 1,
      state: 'completed',
      outcome: 'returned',
      legacyRetained: 1,
    }),
  );
  for (let start = 0; start < failures.length; start += perRun)
    await t.run(async (ctx) => {
      for (const lastFailure of failures.slice(start, start + perRun)) {
        const characterId = await ctx.db.insert('character', {
          name: 'Placeholder',
          kind: 'pc',
          isActive: true,
          level: 1,
          description: '',
          strength: 10,
          dexterity: 10,
          constitution: 10,
          intelligence: 10,
          wisdom: 10,
          charisma: 10,
        });
        await ctx.db.insert('organizationDepartureCharacter', {
          departureId,
          userId,
          organizationId,
          characterId,
          failures: 3,
          lastFailure,
          setAside: true,
        });
      }
    });
  return departureId;
}

/** How many failure rows of a departure with small rows remain. */
function countDepartureFailures(
  t: ReleaseTest,
  departureId: Id<'organizationDeparture'>,
) {
  return t.run(
    async (ctx) =>
      (
        await ctx.db
          .query('organizationDepartureCharacter')
          .withIndex('by_departureId_and_characterId', (q) =>
            q.eq('departureId', departureId),
          )
          .take(2_000)
      ).length,
  );
}

test('the sweep stays inside every Convex transaction limit for the largest rows the schema allows, continuing a departure’s failure deletes on later pages', async () => {
  const fixture = await closedAndBackfilled(modules, {
    transactionLimits: true,
  });
  const { t } = fixture;
  const run = await activateAndReopen(fixture);
  const { campaignId, ann, bo } = await t.run(async (ctx) => {
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Large campaign',
      ownerId: token('gm'),
      organizationId,
      description: largeText,
    });
    // Ann and Bo were removed; Dan's account deletion completed.
    const [ann, bo] = await Promise.all(
      ['ann', 'bo'].map((name) =>
        ctx.db.insert('user', {
          tokenIdentifier: token(name),
          name: largeText,
          webhookUpdatedAt: 2,
          orgIds: [],
        }),
      ),
    );
    if (!ann || !bo) throw new Error('No users');
    await ctx.db.insert('accountDeletion', {
      tokenIdentifier: token('dan'),
      state: 'completed',
      legacyRetained: 1,
    });
    return { campaignId, ann, bo };
  });
  await t.run(async (ctx) => {
    for (const owner of ['ann', 'bo', 'dan'])
      await addCharacter(ctx, {
        campaignId,
        owner,
        name: `${owner} hero`,
        description: largeText,
      });
  });
  // Ann's departure failed more Characters than one page deletes; Bo's
  // failures are each as large as a row may be.
  const annDeparture = await addCompletedDeparture(t, {
    userId: ann,
    failures: Array.from({ length: 1_100 }, () => driverFailure),
    perRun: 1_100,
  });
  const boDeparture = await addCompletedDeparture(t, {
    userId: bo,
    failures: Array.from({ length: 24 }, () => largeText),
    perRun: 8,
  });

  // Every page runs under the enforced limits; a page over any of them
  // throws. The drivers the sweep starts are left scheduled.
  const annRemaining = new Set<number>();
  let status = await readCatchUp(t);
  for (let page = 0; status?.state !== 'completed' && page < 100; page++) {
    status = await t.mutation(internal.lifecycleCatchUp.sweep, {
      writeEpoch: run.epoch,
      page,
    });
    annRemaining.add(await countDepartureFailures(t, annDeparture));
  }

  // One page deletes at most 1,024 of Ann's failures and starts her round
  // only on the page that deletes the last.
  expect([...annRemaining]).toEqual([1_100, 76, 0]);
  const failuresLeft = await t.run((ctx) =>
    ctx.db.query('organizationDepartureCharacter').take(1),
  );
  expect(failuresLeft).toEqual([]);
  const departures = await t.run((ctx) =>
    Promise.all(
      [annDeparture, boDeparture].map((id) =>
        ctx.db.get('organizationDeparture', id),
      ),
    ),
  );
  expect(departures).toMatchObject([
    { state: 'returning', round: 2, webhookUpdatedAt: 2 },
    { state: 'returning', round: 2, webhookUpdatedAt: 2 },
  ]);
  expect(
    await t.run((ctx) => ctx.db.query('accountDeletion').take(2)),
  ).toMatchObject([{ tokenIdentifier: token('dan'), state: 'deleting' }]);
  // Ann, Bo, Dan and the accepted campaign's officer, owned by `gm`. Ann's
  // failures take two pages and Bo's 24 large ones six, about four a page.
  expect(status).toMatchObject({
    state: 'completed',
    pages: 10,
    counts: {
      characters: 4,
      departuresStarted: 2,
      deletionsResumed: 1,
      unknownOwners: 1,
    },
  });
}, 120_000);

test('the sweep is refused under legacy authority and changes nothing there', async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await addMember(ctx, 'dee');
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Campaign',
      ownerId: token('dee'),
      organizationId: 'elsewhere',
      description: '',
    });
    await addCharacter(ctx, { campaignId, owner: 'dee', name: 'Dee hero' });
  });
  await expect(
    t.mutation(internal.lifecycleCatchUp.sweep, { writeEpoch: 0, page: 0 }),
  ).rejects.toThrow(
    'Catch-up sweep refused: the deployment is not under sheet authority.',
  );
  expect(await readLifecycles(t)).toEqual({ departures: [], deletions: [] });
  expect(await readCatchUp(t)).toBeNull();
});

test('a stored sweep is sweeping or completed, each with only its own fields', () => {
  type CatchUp = Infer<typeof lifecycleCatchUpValidator>;
  const shared = {
    epoch: 2,
    startedAt: 1,
    counts: {
      characters: 0,
      departuresStarted: 0,
      deletionsResumed: 0,
      unknownOwners: 0,
    },
  };
  const legal: CatchUp[] = [
    {
      ...shared,
      state: 'sweeping',
      nextPage: 1,
      cursor: 'c',
      lastUnknownOwner: null,
    },
    { ...shared, state: 'completed', pages: 1, completedAt: 2 },
  ];
  const illegal: CatchUp[] = [
    // @ts-expect-error a sweeping run names the page it expects next
    { ...shared, state: 'sweeping', cursor: null, lastUnknownOwner: null },
    // @ts-expect-error a completed run has no page left to read
    { ...shared, state: 'completed', pages: 1, completedAt: 2, nextPage: 1 },
    // @ts-expect-error a completed run says how many pages it read
    { ...shared, state: 'completed', completedAt: 2 },
  ];
  expect([...legal, ...illegal]).toHaveLength(5);
});
