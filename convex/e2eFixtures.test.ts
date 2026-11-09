/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { humanDualTalentCatalog } from '../e2e/fixtures/human-dual-talent';
import { magicalLineage } from '../e2e/fixtures/magical-lineage';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { convexTest, type TestConvex } from 'convex-test';
import {
  beforeAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { refuseRepeatedPaginatedQueries } from '../tests/convex-paginated-queries';
import { api, internal } from './_generated/api';
import schema from './schema';
import type { Id } from './_generated/dataModel';
import {
  deploymentFixture,
  fixtureCredentials,
} from '../e2e/support/test-data';
import { canonicalCaseKeys, type FixtureScope } from '../e2e/fixtures/catalog';
import { confirmationInspectionSchema } from '../src/lib/weekly-confirmation-contract';
import { weeklyDraftSchema } from '../src/lib/weekly-draft-contract';
import { projectUpkeep } from '../src/lib/rules-upkeep';
import { representativeArchetypeCatalog } from './lib/representativeArchetypeCatalog';
import { representativeClassCatalog } from './lib/representativeClassCatalog';
import { representativeRaceCatalog } from './lib/representativeRaceCatalog';
import { representativeSelectionCatalog } from './lib/representativeSelectionCatalog';
import { representativeSpellCatalog } from './lib/representativeSpellCatalog';
import { representativeGrantedSpellCatalog } from './lib/representativeSpellcastingCatalog';
import { representativeWeaponCatalog } from './lib/representativeWeaponCatalog';
import {
  representativeSpellEffectCatalog,
  representativeSpellEffectSpellCatalog,
} from './lib/representativeSpellEffectCatalog';
import {
  representativeEquipmentCatalog,
  representativeItemAbilityCatalog,
  representativeMagicItemCatalog,
  representativeWondrousItemCatalog,
} from './lib/representativeItemCatalog';

const modules = import.meta.glob('./**/*.ts');
beforeAll(() => refuseRepeatedPaginatedQueries(schema, modules));
const fixtureTests: TestConvex<typeof schema>[] = [];
function fixtureTest({ transactionLimits = false } = {}) {
  const t = convexTest({ schema, modules, transactionLimits });
  fixtureTests.push(t);
  return t;
}
// Mirrors initializeCharacterSheet: Base scores plus each representative
// catalog, where races already seeded as selections are reused, and the
// Spells casting features grant. Prepared sheets also import the
// representative Spells and the Spells Spell Effects name, which the sheet
// read omits until something needs them.
const selectionRuleIdentities = new Set(
  representativeSelectionCatalog.map((definition) => definition.ruleIdentity),
);
const seededSheetCatalogRows =
  1 +
  representativeSelectionCatalog.length +
  representativeClassCatalog.length +
  representativeArchetypeCatalog.length +
  representativeWeaponCatalog.length +
  representativeEquipmentCatalog.length +
  representativeWondrousItemCatalog.length +
  representativeItemAbilityCatalog.length +
  representativeMagicItemCatalog.length +
  representativeGrantedSpellCatalog.length +
  representativeSpellEffectCatalog.length +
  representativeRaceCatalog.filter(
    (definition) => !selectionRuleIdentities.has(definition.ruleIdentity),
  ).length;
const seededCatalogRows =
  seededSheetCatalogRows +
  representativeSpellCatalog.length +
  representativeSpellEffectSpellCatalog.length;
const scope: FixtureScope = {
  namespace: deploymentFixture.namespace,
  version: 1,
  workerKey: 'worker-0',
  caseKey: 'smoke',
  ...fixtureCredentials,
};
const isolation: FixtureScope = {
  ...scope,
  caseKey: 'isolation',
};
const characterLedger: FixtureScope = {
  ...scope,
  caseKey: 'characterLedger',
};
const characterSheet: FixtureScope = {
  ...scope,
  caseKey: 'characterSheet',
};
const privateCharacter: FixtureScope = {
  ...scope,
  caseKey: 'privateCharacter',
};
const characterNavigation: FixtureScope = {
  ...scope,
  caseKey: 'characterNavigation',
};
const membershipLoss: FixtureScope = {
  ...scope,
  caseKey: 'membershipLoss',
};
const accountDeletion: FixtureScope = {
  ...scope,
  caseKey: 'accountDeletion',
};
const characterMove: FixtureScope = {
  ...scope,
  caseKey: 'characterMove',
};

describe('internal fixture boundary', () => {
  beforeEach(() => {
    // Run scheduled work outside its scheduling mutation's async context.
    vi.useFakeTimers();
    vi.stubEnv('E2E_ENABLED', 'true');
    vi.stubEnv('E2E_FIXTURE_CONFIG', JSON.stringify(deploymentFixture));
    vi.stubEnv('CONVEX_CLOUD_URL', deploymentFixture.convexUrl);
  });
  afterEach(async () => {
    try {
      for (const t of fixtureTests.splice(0)) {
        await t.finishAllScheduledFunctions(vi.runAllTimers);
        const jobs = await t.run((ctx) =>
          ctx.db.system.query('_scheduled_functions').collect(),
        );
        expect(
          jobs.filter(
            (job) =>
              job.state.kind !== 'success' && job.state.kind !== 'canceled',
          ),
        ).toEqual([]);
      }
    } finally {
      vi.unstubAllEnvs();
      vi.useRealTimers();
    }
  });
  it('finishes scheduled catalog cleanup successfully before the fixture test ends', async () => {
    const t = fixtureTest();
    await t.mutation(
      internal.e2eFixtures.seedIdentityProjection,
      characterSheet,
    );
    await t.mutation(internal.e2eFixtures.resetCase, {
      ...characterSheet,
      now: 0,
    });
    await t.mutation(internal.e2eFixtures.cleanupCase, characterSheet);
    expect(
      await t.run((ctx) => ctx.db.query('catalogEntry').collect()),
    ).not.toEqual([]);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const jobs = await t.run((ctx) =>
      ctx.db.system.query('_scheduled_functions').collect(),
    );
    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs.map((job) => job.state.kind)).toEqual(
      jobs.map(() => 'success'),
    );
    expect(
      await t.run((ctx) => ctx.db.query('catalogEntry').collect()),
    ).toEqual([]);
  });
  it('prepares an opt-in familiar demo and removes the linked graph on cleanup', async () => {
    const t = fixtureTest();
    await t.mutation(
      internal.e2eFixtures.seedIdentityProjection,
      characterSheet,
    );
    const { campaignId } = await t.mutation(internal.e2eFixtures.resetCase, {
      ...characterSheet,
      now: 0,
      familiarDemo: true,
    });
    const owner = t.withIdentity({
      tokenIdentifier: `https://${deploymentFixture.clerkHost}|user_gm`,
    });
    const characters = await owner.query(api.character.listByCampaign, {
      organizationId: 'org_members',
      campaignId,
    });
    const familiar = characters.find((row) => row.name === 'E2E familiar-cat');
    expect(familiar).toBeDefined();
    if (!familiar) throw new Error('Missing demo familiar');
    const sheet = withSheetCatalog(
      await owner.query(api.characterSheet.read, {
        organizationId: 'org_members',
        characterId: familiar._id,
      }),
    );
    expect(sheet).toMatchObject({
      character: { familiarBaseCreatureKey: 'cat' },
      calculated: {
        familiar: { actualHitDice: 1, maximumHp: 3, progression: { level: 1 } },
      },
    });
    expect(
      await owner.query(api.companionRelationships.list, {
        characterId: familiar._id,
      }),
    ).toEqual([
      expect.objectContaining({
        kind: 'familiar',
        role: 'associated',
        status: 'active',
      }),
    ]);
    await t.mutation(internal.e2eFixtures.cleanupCase, characterSheet);
    expect(
      await owner.query(api.character.listByCampaign, {
        organizationId: 'org_members',
        campaignId,
      }),
    ).toEqual([]);
    expect(
      await t.run(async (ctx) => ({
        relationships: await ctx.db.query('companionRelationship').collect(),
        linkedInputs: await ctx.db.query('characterLinkedInput').collect(),
      })),
    ).toEqual({ relationships: [], linkedInputs: [] });
  });
  it('refuses familiar demo requests outside prepared sheet cases and the preview capability gate', async () => {
    const t = fixtureTest();
    await expect(
      t.mutation(internal.e2eFixtures.resetCase, {
        ...scope,
        now: 0,
        familiarDemo: true,
      }),
    ).rejects.toThrow('Familiar demonstration requires a prepared sheet case');
    vi.stubEnv('E2E_ENABLED', 'false');
    await expect(
      t.mutation(internal.e2eFixtures.resetCase, {
        ...characterSheet,
        now: 0,
        familiarDemo: true,
      }),
    ).rejects.toThrow();
    expect(await t.run((ctx) => ctx.db.query('campaign').collect())).toEqual(
      [],
    );
  });
  it('reset and cleanup remove campaign homebrew created by Save and Customize while retaining unrelated catalogs', async () => {
    vi.useFakeTimers();
    const t = fixtureTest();
    await t.mutation(
      internal.e2eFixtures.seedIdentityProjection,
      characterSheet,
    );
    const owner = t.withIdentity({
      tokenIdentifier: `https://${deploymentFixture.clerkHost}|user_gm`,
    });
    const originalId = await t.run((ctx) =>
      ctx.db.insert('catalogEntry', {
        scope: 'global',
        name: 'Global blessing',
        ruleIdentity: 'fixture:global-blessing',
        modifiers: [],
        stacksWithItself: false,
        sources: [],
        detail: { kind: 'feat' },
      }),
    );
    async function createCampaignCopies() {
      const { campaignId } = await t.mutation(internal.e2eFixtures.resetCase, {
        ...characterSheet,
        now: 0,
      });
      const inspection = await t.query(
        internal.e2eFixtures.inspectCase,
        characterSheet,
      );
      const characterId = inspection.characterIds?.[0];
      if (!characterId) throw new Error('Missing fixture Character');
      const command = {
        characterId,
        campaignId,
        organizationId: 'org_members',
      };
      const entryId = await owner.mutation(api.catalogCopies.createOneOff, {
        ...command,
        operationId: 'create-homebrew',
        definition: {
          name: 'Saved blessing',
          modifiers: [],
          stacksWithItself: false,
          sources: [],
          detail: { kind: 'feat' },
        },
      });
      const sheet = withSheetCatalog(
        await owner.query(api.characterSheet.read, command),
      );
      const entry = sheet?.entries.find((row) => row._id === entryId);
      if (!entry || !('catalogEntryId' in entry))
        throw new Error('Missing one-off');
      await owner.mutation(api.catalogCopies.saveToCatalog, {
        ...command,
        catalogEntryId: entry.catalogEntryId,
        operationId: 'save-homebrew',
      });
      await owner.mutation(api.catalogCopies.customizeForCampaign, {
        ...command,
        catalogEntryId: originalId,
        operationId: 'customize',
      });
      expect(
        (await owner.query(api.catalogCopies.list, command)).filter(
          (row) => row.scope === 'campaign',
        ),
      ).toHaveLength(2);
      return campaignId;
    }
    const firstCampaignId = await createCampaignCopies();
    await createCampaignCopies();
    // Storage invariant: unreachable catalog rows must not survive the public reset.
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('catalogEntry')
          .withIndex('by_campaignId_and_scope', (q) =>
            q.eq('campaignId', firstCampaignId).eq('scope', 'campaign'),
          )
          .collect(),
      ),
    ).toEqual([]);
    await t.mutation(internal.e2eFixtures.cleanupCase, characterSheet);
    // Browse-only seeds of deleted sheets are removed in scheduled batches.
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(
      await t.run((ctx) => ctx.db.query('catalogEntry').collect()),
    ).toMatchObject([
      { _id: originalId, scope: 'global', name: 'Global blessing' },
    ]);
  });
  it("lets only the two move journeys inspect their moves, with their cohort's capability and their own campaign", async () => {
    const t = fixtureTest();
    await t.mutation(
      internal.e2eFixtures.seedIdentityProjection,
      characterMove,
    );
    const { campaignId } = await t.mutation(internal.e2eFixtures.resetCase, {
      ...characterMove,
      isolatedWith: ['characterMove'],
      now: 1_700_000_000_000,
    });
    for (const request of [
      { ...characterMove, token: 'W'.repeat(43) },
      { ...characterMove, workerKey: 'worker-1' },
      {
        ...characterMove,
        caseKey: 'membershipLoss' as const,
        expectedCampaignId: campaignId,
      },
    ])
      await expect(
        t.query(internal.e2eFixtures.inspectMoves, request),
      ).rejects.toThrow();
    await expect(
      t.query(internal.e2eFixtures.inspectMoves, characterSheet),
    ).rejects.toThrow('Only the move journeys inspect moves');
    expect(
      await t.query(internal.e2eFixtures.inspectMoves, characterMove),
    ).toMatchObject({
      characters: [{ name: 'E2E character-move-character', move: null }],
      departure: null,
    });
  });
  it('removes the membership-loss player from the organization through the provider path, and reset restores the membership and removes what came back', async () => {
    vi.useFakeTimers();
    // A deployment enforces Convex's transaction limits; convex-test only
    // when asked.
    const t = fixtureTest({ transactionLimits: true });
    await t.mutation(
      internal.e2eFixtures.seedIdentityProjection,
      membershipLoss,
    );
    const player = t.withIdentity({
      tokenIdentifier: `https://${deploymentFixture.clerkHost}|user_player`,
    });
    const gm = t.withIdentity({
      tokenIdentifier: `https://${deploymentFixture.clerkHost}|user_gm`,
    });
    await expect(
      t.mutation(internal.e2eFixtures.loseMembership, {
        ...characterNavigation,
        now: 1,
      }),
    ).rejects.toThrow('Only the membership-loss journey');
    const reset = () =>
      t.mutation(internal.e2eFixtures.resetCase, {
        ...membershipLoss,
        isolatedWith: ['membershipLoss'],
        now: 1_700_000_000_000,
      });
    const { campaignId } = await reset();
    const [owned] = await gm.query(api.character.listCampaignCharacters, {
      campaignId,
      organizationId: 'org_members',
    });
    expect(owned).toMatchObject({
      character: { sheetMode: 'full' },
      owner: { name: 'E2E player' },
      ownerDeparted: false,
    });
    if (!owned) throw new Error('Missing seeded Character');
    const characterId = owned.character._id;

    await t.mutation(internal.e2eFixtures.loseMembership, {
      ...membershipLoss,
      now: 1_700_000_000_000,
    });
    await expect(
      player.query(api.characterSheet.read, { characterId }),
    ).rejects.toThrow('Character not found');
    // A failed journey records the server's view of the return, its failure
    // text whole for the harness to sanitize before bounding it.
    const lastFailure = `{"code":"RELOAD_REQUIRED","message":"${'step failed '.repeat(50)}"}`;
    // The server sanitizes failure text before it bounds it, too.
    const secretFailure =
      'Error: player@example.com eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1In0.c2ln {"token":"opaque';
    const departure = await t.run(async (ctx) => {
      const departure = await ctx.db.query('organizationDeparture').first();
      if (!departure) throw new Error('Missing departure');
      await ctx.db.insert('organizationDepartureCharacter', {
        departureId: departure._id,
        userId: departure.userId,
        organizationId: departure.organizationId,
        characterId,
        failures: 1,
        setAside: false,
        lastFailure,
      });
      const familiarId = await ctx.db.insert('character', {
        ownerId: 'fixture-other-owner',
        name: 'E2E other',
        description: '',
        kind: 'npc',
        isActive: true,
        level: 0,
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      });
      await ctx.db.insert('organizationDepartureCharacter', {
        departureId: departure._id,
        userId: departure.userId,
        organizationId: departure.organizationId,
        characterId: familiarId,
        failures: 3,
        setAside: true,
        lastFailure: secretFailure,
      });
      return departure;
    });
    expect(
      await t.query(internal.e2eFixtures.inspectMoves, membershipLoss),
    ).toEqual({
      writeGate: {
        present: false,
        closed: false,
        authority: 'legacy',
        epoch: 0,
      },
      characters: [
        {
          name: 'E2E membership-loss-character',
          inCampaign: true,
          move: null,
        },
      ],
      departure: {
        state: 'returning',
        round: 1,
        failures: expect.arrayContaining([
          {
            characterName: 'E2E membership-loss-character',
            failures: 1,
            setAside: false,
            lastFailure,
          },
          {
            characterName: 'another Character',
            failures: 3,
            setAside: true,
            lastFailure: 'Error: [redacted-email] [redacted-jwt] {[redacted]',
          },
        ]),
        nextDrive: expect.any(Number),
        lastDrive: null,
      },
    });
    await t.run(async (ctx) => {
      const other = await ctx.db
        .query('organizationDepartureCharacter')
        .withIndex('by_userId_and_setAside', (q) =>
          q.eq('userId', departure.userId).eq('setAside', true),
        )
        .unique();
      if (!other) throw new Error('Missing set-aside failure');
      await ctx.db.delete('organizationDepartureCharacter', other._id);
      await ctx.db.delete('character', other.characterId);
    });
    // The journey's return starts at once, without the provider grace.
    vi.advanceTimersByTime(1000);
    await t.finishInProgressScheduledFunctions();
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('characterMove')
          .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
          .first(),
      ),
    ).toMatchObject({ state: 'preparing' });
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(await player.query(api.character.listOwned, {})).toMatchObject([
      { kind: 'noCampaign', characters: [{ _id: characterId }] },
    ]);
    expect(
      await t.query(internal.e2eFixtures.inspectMoves, membershipLoss),
    ).toMatchObject({
      characters: [
        {
          name: 'E2E membership-loss-character',
          inCampaign: false,
          move: {
            state: 'completed',
            phase: 'done',
            origin: 'organizationDeparture',
          },
        },
      ],
      departure: {
        state: 'completed',
        outcome: 'returned',
        failures: [],
        nextDrive: null,
        lastDrive: { state: 'success' },
      },
    });
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('organizationDepartureCharacter')
          .withIndex('by_departureId_and_characterId', (q) =>
            q.eq('departureId', departure._id),
          )
          .collect(),
      ),
    ).toEqual([]);

    await reset();
    await expect(
      player.query(api.characterSheet.read, { characterId }),
    ).rejects.toThrow('Character not found');
    expect(
      await player.query(api.organizationDepartures.listReturning, {}),
    ).toEqual([]);
    expect(
      await player.query(api.user.getOrgAccessStatus, {
        organizationId: 'org_members',
      }),
    ).toMatchObject({ state: 'ready' });
    await t.mutation(internal.e2eFixtures.cleanupCase, membershipLoss);
  });
  it("deletes only the account-deletion journey's departing member through the provider path, leaving its Character ownerless for the cohort, and reset restores both", async () => {
    vi.useFakeTimers();
    const t = fixtureTest();
    await t.mutation(
      internal.e2eFixtures.seedIdentityProjection,
      accountDeletion,
    );
    const gm = t.withIdentity({
      tokenIdentifier: `https://${deploymentFixture.clerkHost}|user_gm`,
    });
    const player = t.withIdentity({
      tokenIdentifier: `https://${deploymentFixture.clerkHost}|user_player`,
    });
    await expect(
      t.mutation(internal.e2eFixtures.deleteAccount, membershipLoss),
    ).rejects.toThrow('Only the account-deletion journey');
    await expect(
      t.mutation(internal.e2eFixtures.deleteAccount, accountDeletion),
    ).rejects.toThrow('Reset the account-deletion case first');
    const reset = () =>
      t.mutation(internal.e2eFixtures.resetCase, {
        ...accountDeletion,
        isolatedWith: ['accountDeletion'],
        now: 1_700_000_000_000,
      });
    const list = (campaignId: Id<'campaign'>) =>
      player.query(api.character.listCampaignCharacters, {
        campaignId,
        organizationId: 'org_members',
      });
    const { campaignId } = await reset();
    expect(
      await t.query(internal.e2eFixtures.inspectCase, accountDeletion),
    ).toMatchObject({ campaignCount: 1, militia: null, identityCount: 3 });
    const [seeded] = await list(campaignId);
    expect(seeded).toMatchObject({
      character: {
        name: 'E2E account-deletion-character',
        sheetMode: 'full',
        ownershipAvailable: true,
      },
      owner: { name: 'E2E departing member', isMine: false },
      ownerDeparted: false,
    });
    if (!seeded) throw new Error('Missing seeded Character');
    const characterId = seeded.character._id;

    await t.mutation(internal.e2eFixtures.deleteAccount, accountDeletion);
    await t.mutation(internal.e2eFixtures.deleteAccount, accountDeletion);
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(await list(campaignId)).toMatchObject([
      {
        character: { _id: characterId, ownershipAvailable: true },
        owner: null,
        ownerDeparted: false,
      },
    ]);
    // The cohort's own accounts and memberships are untouched.
    for (const member of [gm, player])
      expect(
        await member.query(api.user.getOrgAccessStatus, {
          organizationId: 'org_members',
        }),
      ).toMatchObject({ state: 'ready' });
    const me = await gm.query(api.user.getMe, {});
    if (!me) throw new Error('Missing GM account');
    await gm.mutation(api.character.reassignOwner, {
      characterId,
      campaignId,
      organizationId: 'org_members',
      ownerUserId: me._id,
      operationId: 'take-ownership',
    });
    expect(await list(campaignId)).toMatchObject([
      { owner: { name: 'E2E gm' } },
    ]);

    const again = await reset();
    expect(await list(again.campaignId)).toMatchObject([
      { owner: { name: 'E2E departing member' } },
    ]);
    // A repeat after reset deletes the restored account again.
    await t.mutation(internal.e2eFixtures.deleteAccount, accountDeletion);
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(await list(again.campaignId)).toMatchObject([{ owner: null }]);
    await t.mutation(internal.e2eFixtures.cleanupCase, accountDeletion);
    expect(
      await t.run(async (ctx) => ({
        departing: (await ctx.db.query('user').collect()).filter((user) =>
          user.tokenIdentifier.includes('e2e-departing-account'),
        ),
        deletions: await ctx.db.query('accountDeletion').collect(),
        failures: await ctx.db.query('accountDeletionCharacter').collect(),
        campaigns: await ctx.db.query('campaign').collect(),
      })),
    ).toEqual({ departing: [], deletions: [], failures: [], campaigns: [] });
  });
  it("prepares the move journey's Character and familiar as one group that leaves for No campaign and joins back, and cleans the private sheets", async () => {
    vi.useFakeTimers();
    // A deployment enforces Convex's transaction limits; convex-test only
    // when asked.
    const t = fixtureTest({ transactionLimits: true });
    await t.mutation(
      internal.e2eFixtures.seedIdentityProjection,
      characterMove,
    );
    const owner = t.withIdentity({
      tokenIdentifier: `https://${deploymentFixture.clerkHost}|user_gm`,
    });
    const { campaignId } = await t.mutation(internal.e2eFixtures.resetCase, {
      ...characterMove,
      isolatedWith: ['characterMove'],
      now: 1_700_000_000_000,
      familiarDemo: true,
    });
    expect(
      await t.query(internal.e2eFixtures.inspectCase, characterMove),
    ).toMatchObject({
      militia: null,
      characters: ['E2E character-move-character', 'E2E familiar-cat'],
    });
    const listed = await owner.query(api.character.listCampaignCharacters, {
      campaignId,
      organizationId: 'org_members',
    });
    const master = listed.find(
      (row) => row.character.name === 'E2E character-move-character',
    )?.character._id;
    const familiar = listed.find(
      (row) => row.character.name === 'E2E familiar-cat',
    )?.character._id;
    if (!master || !familiar) throw new Error('Missing seeded group');
    expect(
      await owner.query(api.characterMoves.preview, { characterId: master }),
    ).toMatchObject({
      moving: [
        { characterId: master, name: 'E2E character-move-character' },
        { characterId: familiar, name: 'E2E familiar-cat' },
      ],
      staying: [],
    });
    expect(
      await owner.query(api.characterMoves.preview, { characterId: familiar }),
    ).toMatchObject({
      moving: [{ characterId: familiar }],
      staying: [{ characterId: master, reason: 'associated' }],
    });
    async function move({
      operationId,
      destinationCampaignId,
    }: {
      operationId: string;
      destinationCampaignId?: Id<'campaign'>;
    }) {
      let progress = await owner.mutation(api.characterMoves.start, {
        characterId: master!,
        operationId,
        ...(destinationCampaignId ? { destinationCampaignId } : {}),
      });
      // The whole group's preparation is reported from the start.
      expect(progress).toMatchObject({ groupSize: 2 });
      expect(progress.state).not.toBe('completed');
      // The sheet's move control follows these reads, so its progress panel
      // shows the started move.
      expect(
        await owner.query(api.characterMoves.status, { characterId: master! }),
      ).toMatchObject({ operationId, state: progress.state, groupSize: 2 });
      await owner.query(api.characterMoves.destinations, {
        characterId: master!,
      });
      await owner.query(api.characterMoves.preview, { characterId: master! });
      const inspection = await t.query(
        internal.e2eFixtures.inspectMoves,
        characterMove,
      );
      expect(inspection.departure).toBeNull();
      expect(inspection.characters).toHaveLength(2);
      // The group's root move; its members' moves start as it prepares them.
      expect(
        inspection.characters.find(
          ({ name }) => name === 'E2E character-move-character',
        )?.move,
      ).toMatchObject({
        state: progress.state,
        origin: 'owner',
        groupSize: 2,
        isGroupMember: false,
      });
      let resumes = 0;
      for (; resumes < 120 && progress.state !== 'completed'; resumes++)
        progress = await owner.mutation(api.characterMoves.resume, {
          characterId: master!,
          operationId,
        });
      expect(progress).toMatchObject({ state: 'completed', groupSize: 2 });
      return resumes;
    }
    // The browser journey clicks Continue move once per resume.
    // The browser journey clicks Continue move once per resume: about 30
    // for the seeded pair's browse-only definitions.
    expect(await move({ operationId: 'leave' })).toBeLessThanOrEqual(40);
    expect(await owner.query(api.character.listOwned, {})).toMatchObject([
      {
        kind: 'noCampaign',
        characters: expect.arrayContaining([
          expect.objectContaining({ _id: master }),
          expect.objectContaining({ _id: familiar }),
        ]),
      },
    ]);
    const destinations = await owner.query(api.characterMoves.destinations, {
      characterId: master,
    });
    expect(destinations.destinations).toMatchObject([
      { campaignId, campaignName: 'E2E character-move-campaign' },
    ]);
    expect(
      await move({ operationId: 'join', destinationCampaignId: campaignId }),
    ).toBeLessThanOrEqual(40);
    expect(
      (
        await owner.query(api.character.listCampaignCharacters, {
          campaignId,
          organizationId: 'org_members',
        })
      ).map((row) => row.character._id),
    ).toEqual(expect.arrayContaining([master, familiar]));
    expect(
      await owner.query(api.companionRelationships.list, {
        characterId: familiar,
      }),
    ).toMatchObject([{ status: 'active' }]);
    await move({ operationId: 'leave-again' });
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    await t.mutation(internal.e2eFixtures.cleanupCase, characterMove);
    expect(await owner.query(api.character.listOwned, {})).toEqual([
      { kind: 'noCampaign', characters: [] },
    ]);
  });
  it.each([
    'sheetSelections',
    'sheetClasses',
    'animalCompanion',
    'characterAttacks',
  ] as const)(
    'prepares the %s journey with one Full sheet in a campaign without a militia',
    async (caseKey) => {
      const t = fixtureTest();
      const sheetCase: FixtureScope = { ...scope, caseKey };
      await t.mutation(internal.e2eFixtures.seedIdentityProjection, sheetCase);
      const owner = t.withIdentity({
        tokenIdentifier: `https://${deploymentFixture.clerkHost}|user_gm`,
      });
      const { campaignId } = await t.mutation(internal.e2eFixtures.resetCase, {
        ...sheetCase,
        isolatedWith: [caseKey],
        now: 1_700_000_000_000,
      });
      const inspection = await t.query(
        internal.e2eFixtures.inspectCase,
        sheetCase,
      );
      expect(inspection).toMatchObject({ campaignCount: 1, militia: null });
      expect(inspection.characterIds).toHaveLength(1);
      expect(
        await owner.query(api.character.listCampaignCharacters, {
          campaignId,
          organizationId: 'org_members',
        }),
      ).toMatchObject([
        {
          character: { sheetMode: 'full', kind: 'pc' },
          owner: { name: 'E2E gm', isMine: true },
        },
      ]);
      if (caseKey === 'sheetSelections') {
        const characterId = inspection.characterIds?.[0];
        if (!characterId)
          throw new Error('Missing selection fixture Character');
        const sheet = withSheetCatalog(
          await owner.query(api.characterSheet.read, {
            characterId: characterId,
            campaignId,
            organizationId: 'org_members',
          }),
        );
        expect(
          sheet?.catalogEntries.filter(
            (entry) => entry.ruleIdentity === magicalLineage.ruleIdentity,
          ),
        ).toMatchObject([
          {
            scope: 'character',
            characterId: characterId,
            description: magicalLineage.description,
          },
        ]);
        const byKey = new Map(
          sheet?.catalogEntries.map((entry) => [entry.ruleIdentity, entry]),
        );
        function getFixtureId(key: string) {
          const entry = byKey.get(key);
          if (!entry) throw new Error('Missing stored Human fixture');
          return entry._id;
        }
        for (const definition of humanDualTalentCatalog) {
          const detail = definition.detail;
          if (detail?.kind !== 'race' && detail?.kind !== 'racialTrait')
            throw new Error('Unexpected Human fixture kind');
          expect(byKey.get(definition.ruleIdentity)).toMatchObject({
            scope: 'character',
            characterId,
            name: definition.name,
            sources: definition.sources,
            modifiers: definition.modifiers,
            detail:
              detail.kind === 'race'
                ? {
                    ...detail,
                    racialTraits: detail.racialTraits.map(getFixtureId),
                  }
                : {
                    ...detail,
                    raceEntryIds: detail.raceEntryIds.map(getFixtureId),
                    replaces: detail.replaces.map(getFixtureId),
                  },
          });
        }
        expect(
          sheet?.catalogEntries.filter((entry) => entry.name === 'Human'),
        ).toHaveLength(1);
      }
      if (caseKey !== 'sheetSelections') {
        const catalog = await t.run((ctx) =>
          ctx.db
            .query('catalogEntry')
            .withIndex('by_scope_and_ruleIdentity', (q) =>
              q
                .eq('scope', 'character')
                .eq('ruleIdentity', 'pf1-content/SRBfqkzIldwETAHB'),
            )
            .collect(),
        );
        expect(catalog).toEqual([]);
      }
      await t.mutation(internal.e2eFixtures.cleanupCase, sheetCase);
      for (const definition of humanDualTalentCatalog)
        for (const catalogScope of ['global', 'character'] as const)
          expect(
            await t.run((ctx) =>
              ctx.db
                .query('catalogEntry')
                .withIndex('by_scope_and_ruleIdentity', (q) =>
                  q
                    .eq('scope', catalogScope)
                    .eq('ruleIdentity', definition.ruleIdentity),
                )
                .collect(),
            ),
          ).toEqual([]);
      for (const catalogScope of ['global', 'character'] as const)
        expect(
          await t.run((ctx) =>
            ctx.db
              .query('catalogEntry')
              .withIndex('by_scope_and_ruleIdentity', (q) =>
                q
                  .eq('scope', catalogScope)
                  .eq('ruleIdentity', magicalLineage.ruleIdentity),
              )
              .collect(),
          ),
        ).toEqual([]);
      expect(await t.run((ctx) => ctx.db.query('campaign').collect())).toEqual(
        [],
      );
    },
  );
  it('starts the legal journey with only a campaign', async () => {
    const t = fixtureTest();
    const legalNotices: FixtureScope = {
      ...scope,
      caseKey: 'legalNotices',
    };
    await t.mutation(internal.e2eFixtures.seedIdentityProjection, legalNotices);
    await t.mutation(internal.e2eFixtures.resetCase, {
      ...legalNotices,
      isolatedWith: ['legalNotices'],
      now: 1_700_000_000_000,
    });
    expect(
      await t.query(internal.e2eFixtures.inspectCase, legalNotices),
    ).toMatchObject({ campaignCount: 1, militia: null, characters: [] });
    await t.mutation(internal.e2eFixtures.cleanupCase, legalNotices);
  });
  it('prepares navigation with a Full Character and no militia, and cleans campaign and private sheets on retry', async () => {
    const t = fixtureTest();
    await t.mutation(
      internal.e2eFixtures.seedIdentityProjection,
      characterNavigation,
    );
    const owner = t.withIdentity({
      tokenIdentifier: `https://${deploymentFixture.clerkHost}|user_gm`,
    });
    const seeded = await t.mutation(internal.e2eFixtures.resetCase, {
      ...characterNavigation,
      isolatedWith: ['characterNavigation'],
      now: 1_700_000_000_000,
    });
    const inspection = await t.query(
      internal.e2eFixtures.inspectCase,
      characterNavigation,
    );
    expect(inspection).toMatchObject({ campaignCount: 1, militia: null });
    const campaignCharacters = await owner.query(
      api.character.listCampaignCharacters,
      {
        campaignId: seeded.campaignId,
        organizationId: 'org_members',
      },
    );
    expect(campaignCharacters).toMatchObject([
      {
        character: {
          sheetMode: 'full',
          name: 'E2E character-navigation-character',
        },
        isOnRoster: false,
      },
    ]);
    const privateId = await owner.mutation(api.characterSheet.create, {
      name: 'Navigation private Character',
      kind: 'pc',
      operationId: 'private',
    });
    const campaignId = await owner.mutation(api.characterSheet.create, {
      name: 'Navigation campaign Character',
      kind: 'pc',
      operationId: 'campaign',
      campaignId: seeded.campaignId,
      organizationId: 'org_members',
    });
    expect(await owner.query(api.character.listOwned, {})).toHaveLength(2);
    await t.mutation(internal.e2eFixtures.resetCase, {
      ...characterNavigation,
      isolatedWith: ['characterNavigation'],
      now: 1_700_000_000_000,
    });
    for (const characterId of [privateId, campaignId])
      await expect(
        owner.query(api.characterSheet.read, { characterId }),
      ).rejects.toThrow('Character not found');
    await t.mutation(internal.e2eFixtures.cleanupCase, characterNavigation);
    await t.mutation(internal.e2eFixtures.cleanupCase, characterNavigation);
    expect(await owner.query(api.character.listOwned, {})).toEqual([
      { kind: 'noCampaign', characters: [] },
    ]);
    await expect(
      owner.mutation(api.characterSheet.create, {
        name: 'After cleanup',
        kind: 'pc',
        operationId: 'refused',
      }),
    ).rejects.toThrow("Private character sheets aren't available");
  });
  it('projects declared identities and restores deterministic state before retry', async () => {
    const t = fixtureTest();
    await t.mutation(internal.e2eFixtures.seedIdentityProjection, scope);
    await t.mutation(internal.e2eFixtures.seedIdentityProjection, scope);
    const first = await t.mutation(internal.e2eFixtures.resetCase, {
      ...scope,
      now: 1_700_000_000_000,
    });
    const member = t.withIdentity({
      tokenIdentifier: `https://${deploymentFixture.clerkHost}|user_player`,
    });
    const directoryArgs = {
      campaignId: first.campaignId,
      organizationId: 'org_members',
      paginationOpts: { cursor: null, numItems: 10 },
    };
    expect(
      (await member.query(api.character.listOwnerCandidates, directoryArgs))
        .page,
    ).toHaveLength(2);
    await t.mutation(internal.user.addOrgIdToUser, {
      tokenIdentifier: `https://${deploymentFixture.clerkHost}|user_outsider`,
      orgId: 'org_members',
      role: 'member',
    });
    expect(
      (await member.query(api.character.listOwnerCandidates, directoryArgs))
        .page,
    ).toHaveLength(3);
    await t.mutation(internal.e2eFixtures.seedIdentityProjection, scope);
    expect(
      (await member.query(api.character.listOwnerCandidates, directoryArgs))
        .page,
    ).toHaveLength(2);
    await t.run(async (ctx) => {
      const militia = await ctx.db
        .query('militia')
        .withIndex('by_campaign', (q) => q.eq('campaignId', first.campaignId))
        .unique();
      const source = await ctx.db
        .query('canonicalMilitiaState')
        .withIndex('by_militiaId', (q) => q.eq('militiaId', militia!._id))
        .unique();
      await ctx.db.patch('canonicalMilitiaState', source!._id, {
        snapshot: { ...source!.snapshot, treasuryCopper: 99900 },
      });
    });
    await t.mutation(internal.e2eFixtures.resetCase, {
      ...scope,
      now: 1_700_000_000_000,
    });
    expect(await t.query(internal.e2eFixtures.inspectCase, scope)).toEqual({
      campaignKey: 'harness-campaign',
      campaignCount: 1,
      identityCount: 3,
      characters: ['E2E harness-officer'],
      militia: {
        treasury: 100,
        training: 0,
        week: 1,
        phase: 'upkeep',
        stagedActions: [null, null, null],
      },
    });
  });
  it('starts the character-ledger journey with militia but no character records', async () => {
    const t = fixtureTest();
    await t.mutation(internal.e2eFixtures.resetCase, {
      ...characterLedger,
      now: 1_700_000_000_000,
    });
    expect(
      await t.query(internal.e2eFixtures.inspectCase, characterLedger),
    ).toMatchObject({
      campaignKey: 'character-ledger-campaign',
      campaignCount: 1,
      characters: [],
      militia: { week: 1, phase: 'upkeep' },
    });
  });
  it('seeds a shared Character Sheet fixture with no access for outsiders', async () => {
    const t = fixtureTest();
    await t.mutation(
      internal.e2eFixtures.seedIdentityProjection,
      characterSheet,
    );
    const { campaignId } = await t.mutation(internal.e2eFixtures.resetCase, {
      ...characterSheet,
      now: 0,
      isolatedWith: ['characterSheet'],
    });
    const owner = t.withIdentity({
      tokenIdentifier: `https://${deploymentFixture.clerkHost}|user_gm`,
    });
    const member = t.withIdentity({
      tokenIdentifier: `https://${deploymentFixture.clerkHost}|user_player`,
    });
    const outsider = t.withIdentity({
      tokenIdentifier: `https://${deploymentFixture.clerkHost}|user_outsider`,
    });
    const args = { campaignId, organizationId: 'org_members' };
    const characters = await owner.query(api.character.listByCampaign, args);
    expect(characters).toMatchObject([
      {
        name: 'E2E character-sheet-character',
        kind: 'pc',
        level: 1,
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      },
    ]);
    expect(await member.query(api.character.listByCampaign, args)).toEqual(
      characters.map((character) => ({
        ...character,
        owner: character.owner ? { ...character.owner, isMine: false } : null,
      })),
    );
    expect(await outsider.query(api.character.listByCampaign, args)).toEqual(
      [],
    );
    const character = characters[0];
    if (!character) throw new Error('Missing fixture Character');
    const sheetArgs = {
      organizationId: args.organizationId,
      characterId: character._id,
    };
    const sheet = withSheetCatalog(
      await owner.query(api.characterSheet.read, sheetArgs),
    );
    expect(sheet).toMatchObject({
      character: { _id: sheetArgs.characterId, sheetMode: 'full' },
      calculated: {
        level: 1,
        hitDice: 1,
        hp: null,
        abilities: {
          strength: { score: 10, modifier: 0 },
          dexterity: { score: 10, modifier: 0 },
          constitution: { score: 10, modifier: 0 },
          intelligence: { score: 10, modifier: 0 },
          wisdom: { score: 10, modifier: 0 },
          charisma: { score: 10, modifier: 0 },
        },
      },
    });
    expect(sheet?.entries).toHaveLength(2);
    expect(sheet?.entries.find((entry) => entry.kind === 'base')).toMatchObject(
      {
        active: true,
        state: { kind: 'base' },
      },
    );
    expect(
      sheet?.entries.find((entry) => entry.kind === 'classLevel'),
    ).toMatchObject({
      active: true,
      state: {
        kind: 'classLevel',
        classEntryId: null,
        position: 1,
        hpGained: null,
      },
    });
    expect(sheet?.catalogEntries).toHaveLength(seededSheetCatalogRows);
    // Imported Spells stay out of sheet reads; casting features' Spells load.
    expect(
      sheet?.catalogEntries
        .filter((entry) => entry.detail.kind === 'spell')
        .map((entry) => entry.ruleIdentity)
        .sort(),
    ).toEqual(
      representativeGrantedSpellCatalog
        .map((definition) => definition.ruleIdentity)
        .sort(),
    );
    expect(
      sheet?.catalogEntries.filter((entry) => entry.detail.kind === 'base'),
    ).toEqual([sheet?.baseScoresEntry]);
    expect(
      sheet?.catalogEntries
        .filter((entry) => entry.detail.kind === 'item' && entry.detail.weapon)
        .map((entry) => entry.name)
        .sort(),
    ).toEqual(
      [
        ...representativeWeaponCatalog.filter(
          (definition) => 'weapon' in definition.detail,
        ),
        // Shields bash with their own weapon statistics.
        ...representativeEquipmentCatalog.filter(
          (definition) => definition.detail.weapon,
        ),
      ]
        .map((definition) => definition.name)
        .sort(),
    );
    expect(
      sheet?.catalogEntries
        .filter((entry) => entry.detail.kind === 'class')
        .map((entry) => ({
          name: entry.name,
          ruleIdentity: entry.ruleIdentity,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    ).toEqual([
      { name: 'Alchemist', ruleIdentity: 'alchemist' },
      { name: 'Barbarian', ruleIdentity: 'barbarian' },
      { name: 'Barbarian (Unchained)', ruleIdentity: 'unchained-barbarian' },
      { name: 'Cleric', ruleIdentity: 'cleric' },
      { name: 'Druid', ruleIdentity: 'druid' },
      { name: 'Duelist', ruleIdentity: 'duelist' },
      { name: 'Fighter', ruleIdentity: 'fighter' },
      { name: 'Hunter', ruleIdentity: 'hunter' },
      { name: 'Investigator', ruleIdentity: 'investigator' },
      { name: 'Magus', ruleIdentity: 'magus' },
      { name: 'Monk', ruleIdentity: 'monk' },
      { name: 'Monk (Unchained)', ruleIdentity: 'unchained-monk' },
      { name: 'Mystic Theurge', ruleIdentity: 'mystic-theurge' },
      { name: 'Ranger', ruleIdentity: 'ranger' },
      { name: 'Rogue', ruleIdentity: 'rogue' },
      { name: 'Rogue (Unchained)', ruleIdentity: 'unchained-rogue' },
      { name: 'Shadowdancer', ruleIdentity: 'shadowdancer' },
      { name: 'Sorcerer', ruleIdentity: 'sorcerer' },
      { name: 'Summoner', ruleIdentity: 'summoner' },
      { name: 'Summoner (Unchained)', ruleIdentity: 'unchained-summoner' },
      { name: 'Witch', ruleIdentity: 'witch' },
      { name: 'Wizard', ruleIdentity: 'wizard' },
    ]);
    expect(
      sheet?.catalogEntries
        .filter((entry) => entry.detail.kind === 'race')
        .map((entry) => ({
          name: entry.name,
          ruleIdentity: entry.ruleIdentity,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    ).toEqual([
      { name: 'Dwarf', ruleIdentity: 'dwarf' },
      { name: 'Elf', ruleIdentity: 'elf' },
      { name: 'Half-Elf', ruleIdentity: 'half-elf' },
      { name: 'Half-Orc', ruleIdentity: 'half-orc' },
      { name: 'Human', ruleIdentity: 'human' },
    ]);
    expect(
      sheet?.catalogEntries
        .filter((entry) => entry.detail.kind === 'racialTrait')
        .map((entry) => entry.ruleIdentity)
        .sort(),
    ).toEqual([
      'dwarf-craftsman',
      'dwarf-familiarity',
      'dwarf-greed',
      'elf-familiarity',
      'elf-keen-senses',
      'elf-low-light',
      'half-elf-ability',
      'half-elf-adaptability',
      'half-elf-ancestral-arms',
      'half-elf-blood',
      'half-elf-multitalented',
      'half-orc-ability',
      'half-orc-blood',
      'human-ability',
      'human-bonus-feat',
      'human-heart-of-streets',
      'human-skilled',
      'local/race-ability-scores/pf1/NgIhxRI0axrf3fcO',
      'local/race-ability-scores/pf1/nEltI9y37rKJTeWo',
    ]);
    expect(
      sheet?.catalogEntries
        .filter((entry) => entry.detail.kind === 'feat')
        .map((entry) => ({
          name: entry.name,
          ruleIdentity: entry.ruleIdentity,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    ).toEqual(
      [
        ...representativeSelectionCatalog,
        ...representativeRaceCatalog
          .filter(
            (definition) =>
              !selectionRuleIdentities.has(definition.ruleIdentity),
          )
          .map((definition) => ({
            ...definition,
            name: definition.name ?? definition._id,
          })),
      ]
        .filter((definition) => definition.detail?.kind === 'feat')
        .map(({ name, ruleIdentity }) => ({ name, ruleIdentity }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
    for (const entry of sheet?.catalogEntries ?? []) {
      expect(entry).toMatchObject({
        scope: 'character',
        characterId: character._id,
      });
    }
    expect(sheet?.baseScoresEntry.modifiers).toHaveLength(6);
    expect(
      withSheetCatalog(await member.query(api.characterSheet.read, sheetArgs)),
    ).toEqual({
      ...sheet,
      owner: sheet?.owner ? { ...sheet.owner, isMine: false } : null,
    });
    await expect(
      outsider.query(api.characterSheet.read, sheetArgs),
    ).rejects.toThrow();
  });
  it('resets and cleans fixture sheets without leaving catalogEntries or changing another case', async () => {
    vi.useFakeTimers();
    const t = fixtureTest();
    await t.mutation(
      internal.e2eFixtures.seedIdentityProjection,
      characterSheet,
    );
    await t.mutation(internal.e2eFixtures.resetCase, { ...isolation, now: 0 });
    const comparison = await t.query(
      internal.e2eFixtures.inspectCase,
      isolation,
    );
    const first = await t.mutation(internal.e2eFixtures.resetCase, {
      ...characterSheet,
      now: 0,
    });
    const owner = t.withIdentity({
      tokenIdentifier: `https://${deploymentFixture.clerkHost}|user_gm`,
    });
    const createdId = await owner.mutation(api.characterSheet.create, {
      organizationId: 'org_members',
      campaignId: first.campaignId,
      name: 'Created during play',
      kind: 'pc',
      operationId: 'create-during-play',
    });
    expect(
      withSheetCatalog(
        await owner.query(api.characterSheet.read, {
          organizationId: 'org_members',
          characterId: createdId,
        }),
      ),
    ).toMatchObject({ character: { name: 'Created during play' } });
    const createdScope = {
      organizationId: 'org_members',
      characterId: createdId,
    };
    await owner.mutation(api.characterSheet.editBaseScores, {
      ...createdScope,
      scores: { strength: 18 },
      operationId: 'scores',
    });
    const created = withSheetCatalog(
      await owner.query(api.characterSheet.read, createdScope),
    );
    const warning = created?.calculated.warnings.find(
      (item) => item.check === 'pointBuy',
    );
    if (!warning) throw new Error('Missing point-buy warning');
    await owner.mutation(api.characterSheet.acceptWarning, {
      ...createdScope,
      operationId: 'accept',
      check: warning.check,
      subject: warning.subject,
      fingerprint: warning.fingerprint,
    });
    expect(
      withSheetCatalog(await owner.query(api.characterSheet.read, createdScope))
        ?.acceptedWarnings,
    ).toHaveLength(1);
    const second = await t.mutation(internal.e2eFixtures.resetCase, {
      ...characterSheet,
      now: 0,
    });
    expect(
      await owner.query(api.character.listByCampaign, {
        organizationId: 'org_members',
        campaignId: first.campaignId,
      }),
    ).toEqual([]);
    const reset = await owner.query(api.character.listByCampaign, {
      organizationId: 'org_members',
      campaignId: second.campaignId,
    });
    expect(reset).toHaveLength(1);
    const character = reset[0];
    if (!character) throw new Error('Missing reset Character');
    expect(
      await t.query(internal.e2eFixtures.inspectCase, characterSheet),
    ).toMatchObject({
      characterIds: [character._id],
    });
    const sheet = withSheetCatalog(
      await owner.query(api.characterSheet.read, {
        organizationId: 'org_members',
        characterId: character._id,
      }),
    );
    expect(sheet?.entries).toHaveLength(2);
    expect(sheet?.calculated).toMatchObject({ level: 1, hp: null });
    expect(sheet?.catalogEntries).toHaveLength(seededSheetCatalogRows);
    // Imported Spells stay out of sheet reads; casting features' Spells load.
    expect(
      sheet?.catalogEntries
        .filter((entry) => entry.detail.kind === 'spell')
        .map((entry) => entry.ruleIdentity)
        .sort(),
    ).toEqual(
      representativeGrantedSpellCatalog
        .map((definition) => definition.ruleIdentity)
        .sort(),
    );
    for (const entry of sheet?.catalogEntries ?? []) {
      expect(entry).toMatchObject({
        scope: 'character',
        characterId: character._id,
      });
    }
    // Storage invariant: reset removes unreachable rows, including new sheets
    // created through the application after the original seed. Browse-only
    // seeds of deleted sheets leave in scheduled batches.
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(
      await t.run(async (ctx) => ({
        entries: (await ctx.db.query('characterSheetEntry').collect()).length,
        catalogEntries: (await ctx.db.query('catalogEntry').collect()).length,
        acceptedWarnings: (await ctx.db.query('acceptedWarning').collect())
          .length,
      })),
    ).toEqual({
      entries: 2,
      catalogEntries: seededCatalogRows,
      acceptedWarnings: 0,
    });
    await t.mutation(internal.e2eFixtures.cleanupCase, characterSheet);
    await t.mutation(internal.e2eFixtures.cleanupCase, characterSheet);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(
      await owner.query(api.character.listByCampaign, {
        organizationId: 'org_members',
        campaignId: second.campaignId,
      }),
    ).toEqual([]);
    expect(
      await t.run(async (ctx) => ({
        entries: (await ctx.db.query('characterSheetEntry').collect()).length,
        catalogEntries: (await ctx.db.query('catalogEntry').collect()).length,
        acceptedWarnings: (await ctx.db.query('acceptedWarning').collect())
          .length,
      })),
    ).toEqual({ entries: 0, catalogEntries: 0, acceptedWarnings: 0 });
    expect(await t.query(internal.e2eFixtures.inspectCase, isolation)).toEqual(
      comparison,
    );
  });
  it('grants private sheets only while the private-character case is reset and removes them on reset and cleanup', async () => {
    const t = fixtureTest();
    await t.mutation(
      internal.e2eFixtures.seedIdentityProjection,
      privateCharacter,
    );
    const owner = t.withIdentity({
      tokenIdentifier: `https://${deploymentFixture.clerkHost}|user_gm`,
    });
    const createPrivate = (name: string) =>
      owner.mutation(api.characterSheet.create, {
        name,
        kind: 'pc',
        operationId: name,
      });
    async function createAcceptedPrivate(name: string) {
      const characterId = await createPrivate(name);
      await owner.mutation(api.characterSheet.editBaseScores, {
        characterId,
        operationId: 'scores',
        scores: { strength: 18 },
      });
      const sheet = withSheetCatalog(
        await owner.query(api.characterSheet.read, {
          characterId,
        }),
      );
      const warning = sheet?.calculated.warnings.find(
        (warning) => warning.check === 'pointBuy',
      );
      if (!warning) throw new Error('Missing point-buy warning');
      await owner.mutation(api.characterSheet.acceptWarning, {
        characterId,
        operationId: 'accept',
        check: warning.check,
        subject: warning.subject,
        fingerprint: warning.fingerprint,
      });
      expect(
        withSheetCatalog(
          await owner.query(api.characterSheet.read, { characterId }),
        )?.acceptedWarnings,
      ).toHaveLength(1);
      return characterId;
    }
    const unavailable =
      "Private character sheets aren't available for your account yet.";
    // The Character Sheet case shares the cohort's identities but not the grant.
    await t.mutation(internal.e2eFixtures.resetCase, {
      ...characterSheet,
      now: 0,
    });
    await expect(createPrivate('Sheet case')).rejects.toThrow(unavailable);
    await t.mutation(internal.e2eFixtures.cleanupCase, characterSheet);
    await t.mutation(internal.e2eFixtures.resetCase, {
      ...privateCharacter,
      now: 0,
    });
    const privateId = await createAcceptedPrivate('Private demo');
    expect(
      withSheetCatalog(
        await owner.query(api.characterSheet.read, { characterId: privateId }),
      ),
    ).toMatchObject({ character: { name: 'Private demo' } });
    await t.mutation(internal.e2eFixtures.resetCase, {
      ...privateCharacter,
      now: 0,
    });
    await expect(
      owner.query(api.characterSheet.read, { characterId: privateId }),
    ).rejects.toThrow('Character not found');
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('acceptedWarning')
          .withIndex('by_characterId', (q) => q.eq('characterId', privateId))
          .take(1),
      ),
    ).toEqual([]);
    const leftover = await createAcceptedPrivate('Left by a failed attempt');
    await t.mutation(internal.e2eFixtures.cleanupCase, privateCharacter);
    await expect(
      owner.query(api.characterSheet.read, { characterId: leftover }),
    ).rejects.toThrow('Character not found');
    await expect(createPrivate('After cleanup')).rejects.toThrow(unavailable);
    expect(
      await t.run(async (ctx) => ({
        characters: (await ctx.db.query('character').collect()).length,
        entries: (await ctx.db.query('characterSheetEntry').collect()).length,
        acceptedWarnings: (await ctx.db.query('acceptedWarning').collect())
          .length,
      })),
    ).toEqual({ characters: 0, entries: 0, acceptedWarnings: 0 });
  });
  it('resets an isolated realtime Action Slot board', async () => {
    const t = fixtureTest();
    const realtime = {
      ...scope,
      caseKey: 'realtimeActionSlot' as const,
    };
    await t.mutation(internal.e2eFixtures.resetCase, {
      ...scope,
      now: 1_700_000_000_000,
    });
    await t.mutation(internal.e2eFixtures.resetCase, {
      ...realtime,
      now: 1_700_000_000_000,
    });
    expect(
      await t.query(internal.e2eFixtures.inspectCase, realtime),
    ).toMatchObject({
      campaignKey: 'realtime-action-slot-campaign',
      campaignCount: 1,
      militia: {
        week: 1,
        phase: 'upkeep',
        training: 0,
        treasury: 100,
        stagedActions: [null, null, null],
      },
    });
    await t.mutation(internal.e2eFixtures.cleanupCase, realtime);
    expect(
      await t.query(internal.e2eFixtures.inspectCase, scope),
    ).toMatchObject({ campaignCount: 1 });
  });
  it.each([
    ['disabled', { E2E_ENABLED: 'false' }, {}],
    ['missing deployment binding', { CONVEX_CLOUD_URL: '' }, {}],
    [
      'production with copied E2E flags',
      { CONVEX_CLOUD_URL: 'https://production.convex.cloud' },
      {},
    ],
    ['production explicitly targeted', { CONVEX_DEPLOYMENT: 'prod:main' }, {}],
    ['unknown namespace', {}, { namespace: 'e2e-local-other-slot-0' }],
    ['unknown version', {}, { version: 2 }],
    ['other worker', {}, { workerKey: 'worker-1' }],
    ['wrong capability', {}, { token: 'W'.repeat(43) }],
    [
      'earlier session',
      {},
      { session: '00000000-0000-4000-8000-000000000000' },
    ],
  ])(
    'refuses every operation for %s',
    async (_label, environment, override) => {
      const t = fixtureTest();
      for (const [key, value] of Object.entries(environment))
        vi.stubEnv(key, value);
      const request = { ...scope, ...override };
      await expect(
        t.query(internal.e2eFixtures.inspectCase, request),
      ).rejects.toThrow();
      for (const fn of [
        internal.e2eFixtures.seedIdentityProjection,
        internal.e2eFixtures.cleanupCase,
      ])
        await expect(t.mutation(fn, request)).rejects.toThrow();
      await expect(
        t.mutation(internal.e2eFixtures.resetCase, { ...request, now: 0 }),
      ).rejects.toThrow();
      expect(
        await t.run(async (ctx) => await ctx.db.query('campaign').collect()),
      ).toEqual([]);
    },
  );
  // #754: a cohort capability authorizes every case of its cohort, so the
  // harness names the campaign its reset returned and the server refuses an
  // operation whose case does not own it.
  it("refuses an operation aimed at another case's campaign in the same cohort", async () => {
    const t = fixtureTest();
    const smoke = await t.mutation(internal.e2eFixtures.resetCase, {
      ...scope,
      now: 0,
    });
    await t.mutation(internal.e2eFixtures.resetCase, { ...isolation, now: 0 });
    const mistaken = { ...isolation, expectedCampaignId: smoke.campaignId };
    await expect(
      t.query(internal.e2eFixtures.inspectCase, mistaken),
    ).rejects.toThrow('E2E fixture case mismatch');
    await expect(
      t.mutation(internal.e2eFixtures.cleanupCase, mistaken),
    ).rejects.toThrow('E2E fixture case mismatch');
    for (const owned of [scope, isolation])
      expect(
        await t.query(internal.e2eFixtures.inspectCase, owned),
      ).toMatchObject({ campaignCount: 1 });
    // Its own campaign, or one a later reset in the journey replaced, passes.
    await t.query(internal.e2eFixtures.inspectCase, {
      ...scope,
      expectedCampaignId: smoke.campaignId,
    });
    const replaced = await t.mutation(internal.e2eFixtures.resetCase, {
      ...scope,
      now: 0,
    });
    expect(replaced.campaignId).not.toBe(smoke.campaignId);
    await t.mutation(internal.e2eFixtures.cleanupCase, {
      ...scope,
      expectedCampaignId: smoke.campaignId,
    });
    expect(
      await t.query(internal.e2eFixtures.inspectCase, scope),
    ).toMatchObject({ campaignCount: 0 });
  });
  it('cleans only its owned graph, including application-created children', async () => {
    const t = fixtureTest();
    const first = await t.mutation(internal.e2eFixtures.resetCase, {
      ...scope,
      now: 0,
    });
    await t.mutation(internal.e2eFixtures.resetCase, { ...isolation, now: 0 });
    const before = await t.query(internal.e2eFixtures.inspectCase, isolation);
    await t.run(async (ctx) => {
      await ctx.db.insert('character', {
        campaignId: first.campaignId,
        ownerId: 'synthetic',
        name: 'Created during play',
        description: '',
        kind: 'pc',
        isActive: true,
        level: 1,
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      });
      await ctx.db.insert('campaign', {
        name: 'Unowned campaign',
        ownerId: 'unowned',
        organizationId: 'org_members',
        description: '',
      });
    });
    await t.mutation(internal.e2eFixtures.cleanupCase, scope);
    await t.mutation(internal.e2eFixtures.cleanupCase, scope);
    expect(
      await t.query(internal.e2eFixtures.inspectCase, scope),
    ).toMatchObject({ campaignCount: 0, characters: [], militia: null });
    expect(await t.query(internal.e2eFixtures.inspectCase, isolation)).toEqual(
      before,
    );
    expect(
      await t.run(async (ctx) =>
        (await ctx.db.query('campaign').collect()).map((row) => row.name),
      ),
    ).toContain('Unowned campaign');
    expect(
      await t.run(async (ctx) =>
        (await ctx.db.query('character').collect()).map((row) => row.name),
      ),
    ).toEqual(['E2E isolation-officer']);
  });
  it('does not overwrite an identity outside the owned projection', async () => {
    const t = fixtureTest();
    await t.run(
      async (ctx) =>
        await ctx.db.insert('user', {
          tokenIdentifier: `https://${deploymentFixture.clerkHost}|user_gm`,
          name: 'Unowned user',
          orgIds: [],
        }),
    );
    await expect(
      t.mutation(internal.e2eFixtures.seedIdentityProjection, scope),
    ).rejects.toThrow('not owned');
  });
  it('rejects cross-worker access even when both workers have valid owned cases', async () => {
    const second = {
      ...deploymentFixture.workers[0],
      key: 'worker-1',
      organizationId: 'org_second',
      outsiderOrganizationId: 'org_secondoutsider',
      capability: 'S'.repeat(43),
    };
    vi.stubEnv(
      'E2E_FIXTURE_CONFIG',
      JSON.stringify({
        ...deploymentFixture,
        workers: [...deploymentFixture.workers, second],
      }),
    );
    const t = fixtureTest();
    const secondScope = {
      ...scope,
      workerKey: second.key,
      token: second.capability,
    };
    await t.mutation(internal.e2eFixtures.resetCase, { ...scope, now: 0 });
    await t.mutation(internal.e2eFixtures.resetCase, {
      ...secondScope,
      now: 0,
    });
    const before = await t.query(internal.e2eFixtures.inspectCase, secondScope);
    await expect(
      t.mutation(internal.e2eFixtures.cleanupCase, {
        ...scope,
        workerKey: second.key,
      }),
    ).rejects.toThrow();
    await expect(
      t.query(internal.e2eFixtures.inspectCase, {
        ...scope,
        workerKey: second.key,
      }),
    ).rejects.toThrow();
    await t.mutation(internal.e2eFixtures.cleanupCase, scope);
    expect(
      await t.query(internal.e2eFixtures.inspectCase, secondScope),
    ).toEqual(before);
  });
  it('rolls back cleanup when a graph exceeds the bounded cleanup contract', async () => {
    const t = fixtureTest();
    const { campaignId } = await t.mutation(internal.e2eFixtures.resetCase, {
      ...scope,
      now: 0,
    });
    await t.run(async (ctx) => {
      const militia = await ctx.db
        .query('militia')
        .withIndex('by_campaign', (q) => q.eq('campaignId', campaignId))
        .unique();
      for (let index = 0; index < 101; index++)
        await ctx.db.insert('canonicalSourceCorrection', {
          campaignId,
          militiaId: militia!._id,
          expectedRevision: index,
          revision: index + 1,
          reason: 'Fixture',
          actor: 'fixture',
          createdAt: 0,
        });
    });
    await expect(
      t.mutation(internal.e2eFixtures.cleanupCase, scope),
    ).rejects.toThrow('exceeds cleanup limit');
    expect(
      await t.query(internal.e2eFixtures.inspectCase, scope),
    ).toMatchObject({ campaignCount: 1, militia: { treasury: 100 } });
  });

  describe('isolation canary', () => {
    const existing: FixtureScope = {
      ...scope,
      caseKey: 'existingMilitia',
    };
    const campaignNames = (t: ReturnType<typeof convexTest>) =>
      t.run(async (ctx) =>
        (await ctx.db.query('campaign').collect()).map((row) => row.name),
      );

    it('accepts the owned and comparison campaigns of the running test', async () => {
      const t = fixtureTest();
      await t.mutation(internal.e2eFixtures.resetCase, {
        ...existing,
        now: 0,
        isolatedWith: ['existingMilitia', 'isolation'],
      });
      await t.mutation(internal.e2eFixtures.resetCase, {
        ...isolation,
        now: 0,
        isolatedWith: ['existingMilitia', 'isolation'],
      });
      expect(await campaignNames(t)).toHaveLength(2);
    });

    it.each([
      [
        'another case of the same cohort',
        async (t: ReturnType<typeof convexTest>) => {
          await t.mutation(internal.e2eFixtures.resetCase, {
            ...characterLedger,
            now: 0,
          });
        },
      ],
      [
        'an unowned campaign in the member organization',
        async (t: ReturnType<typeof convexTest>) => {
          await t.run(async (ctx) => {
            await ctx.db.insert('campaign', {
              name: 'Unowned campaign',
              ownerId: 'unowned',
              organizationId: 'org_members',
              description: '',
            });
          });
        },
      ],
      [
        'a campaign in the outsider organization',
        async (t: ReturnType<typeof convexTest>) => {
          await t.run(async (ctx) => {
            await ctx.db.insert('campaign', {
              name: 'Outsider campaign',
              ownerId: 'outsider',
              organizationId: 'org_outsiders',
              description: '',
            });
          });
        },
      ],
    ])('fails the reset and rolls it back with %s', async (_label, leak) => {
      const t = fixtureTest();
      await leak(t);
      const before = await campaignNames(t);
      await expect(
        t.mutation(internal.e2eFixtures.resetCase, {
          ...scope,
          now: 0,
          isolatedWith: ['smoke'],
        }),
      ).rejects.toThrow('E2E isolation canary');
      expect(await campaignNames(t)).toEqual(before);
    });

    it('fails a contract reset through resetAndInitialize', async () => {
      const t = fixtureTest();
      await t.mutation(internal.e2eFixtures.resetCase, { ...scope, now: 0 });
      await expect(
        t.mutation(internal.canonicalPersistenceFixtures.resetAndInitialize, {
          scope: {
            ...scope,
            caseKey: 'canonicalPersistence',
          },
          draftId: 'draft',
          now: 0,
          isolatedWith: ['canonicalPersistence', 'isolation'],
        }),
      ).rejects.toThrow('E2E isolation canary');
    });

    it('requires the reset case in the checked set', async () => {
      const t = fixtureTest();
      await expect(
        t.mutation(internal.e2eFixtures.resetCase, {
          ...scope,
          now: 0,
          isolatedWith: ['isolation'],
        }),
      ).rejects.toThrow('must include the reset case');
    });
  });

  it.each(canonicalCaseKeys)(
    'starts canonical case %s with a bare militia for its canonical fixture',
    async (caseKey) => {
      const t = fixtureTest();
      const owned: FixtureScope = {
        ...scope,
        caseKey,
      };
      await t.mutation(internal.e2eFixtures.resetCase, {
        ...owned,
        now: 0,
        isolatedWith: [caseKey],
      });
      expect(
        await t.query(internal.e2eFixtures.inspectCase, owned),
      ).toMatchObject({
        campaignKey: 'canonical-persistence-campaign',
        campaignCount: 1,
        militia: null,
      });
      await t.mutation(internal.canonicalPersistenceFixtures.initializeUpkeep, {
        scope: owned,
        draftId: `draft-${caseKey}`,
      });
      expect(
        await t.query(internal.e2eFixtures.inspectCase, owned),
      ).toMatchObject({ militia: { week: 4, treasury: 50 } });
    },
  );

  // The recovery Activity journey (#198) opens on the week the recovery
  // journey reaches through Upkeep, so its seed must leave nothing to enter.
  it('seeds the adjusted Scouts recovery as a complete Upkeep', async () => {
    const t = fixtureTest();
    const caseKey = 'workspaceRecoveryActivity';
    const owned: FixtureScope = {
      ...scope,
      caseKey,
    };
    await t.mutation(internal.e2eFixtures.resetCase, {
      ...owned,
      now: 0,
      isolatedWith: [caseKey],
    });
    await expect(
      t.mutation(internal.canonicalPersistenceFixtures.initializeUpkeep, {
        scope: owned,
        draftId: 'draft-without-choices',
        adjustedRecovery: true,
      }),
    ).rejects.toThrow('An adjusted recovery needs the Scouts choice');
    const key = await t.mutation(
      internal.canonicalPersistenceFixtures.initializeUpkeep,
      {
        scope: owned,
        draftId: 'draft-adjusted-recovery',
        choices: true,
        adjustedRecovery: true,
      },
    );
    const inspected = confirmationInspectionSchema.parse(
      await t.mutation(internal.canonicalPersistenceFixtures.inspect, {
        ...key,
        scope: owned,
      }),
    );
    const draft = weeklyDraftSchema.parse(inspected.source.draft);
    // Nothing left to enter: both rolls are complete for their rule
    // specifications (a successful check's training roll is 1d6).
    expect(projectUpkeep(draft, inspected.snapshot).requirements).toEqual([]);
    expect(draft.upkeep.teamDecisions).toEqual([
      { teamId: 'upkeep-scouts', decision: 'recover', costCopper: 2000 },
    ]);
    expect(draft.tableAdjustments).toEqual([
      expect.objectContaining({
        adjustmentId: 'upkeep-recovery:upkeep-scouts',
        field: 'treasuryCopper',
        value: 500,
        reason: 'Local healer donated supplies',
      }),
    ]);
    expect(Object.values(draft.upkeep.rolls)).toEqual([
      expect.objectContaining({ diceTotal: 10, diceCount: 1, sides: 20 }),
      expect.objectContaining({ diceTotal: 3, diceCount: 1, sides: 6 }),
    ]);
  });
});
