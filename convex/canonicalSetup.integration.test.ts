// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { beforeAll, afterEach, beforeEach, expect, test, vi } from 'vitest';
import { refuseRepeatedPaginatedQueries } from '../tests/convex-paginated-queries';
import schema from './schema';
import { api, internal } from './_generated/api';
import {
  deploymentFixture,
  fixtureCredentials,
} from '../e2e/support/test-data';
import { newMilitiaSetup } from '../src/lib/canonical-setup';
const modules = import.meta.glob('./**/*.ts');
beforeAll(() => refuseRepeatedPaginatedQueries(schema, modules));
const scope = {
  namespace: deploymentFixture.namespace,
  version: 1,
  workerKey: 'worker-0',
  caseKey: 'canonicalPersistence' as const,
  ...fixtureCredentials,
};
beforeEach(() => {
  vi.stubEnv('E2E_ENABLED', 'true');
  vi.stubEnv('E2E_FIXTURE_CONFIG', JSON.stringify(deploymentFixture));
  vi.stubEnv('CONVEX_CLOUD_URL', deploymentFixture.convexUrl);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.e2eFixtures.seedIdentityProjection, scope);
  const result = await t.mutation(internal.e2eFixtures.resetCase, {
    ...scope,
    now: 1,
  });
  const gm = t.withIdentity({
    tokenIdentifier: `https://${deploymentFixture.clerkHost}|user_gm`,
  });
  return { t, gm, campaignId: result.campaignId };
}
test('[setup.lifecycle] initialization is retryable and enters ordinary shared editing without advancing the week', async () => {
  const { gm, campaignId } = await setup();
  const args = {
    campaignId,
    initializationId: 'new-setup',
    setup: newMilitiaSetup('Secrecy'),
  };
  const key = await gm.mutation(api.canonicalSetup.initialize, args);
  expect(await gm.mutation(api.canonicalSetup.initialize, args)).toEqual(key);
  const workspace = await gm.query(api.canonicalDraftPersistence.workspace, {
    campaignId,
  });
  expect(workspace?.snapshot).toMatchObject({
    rank: 1,
    treasuryCopper: 1000,
    focus: 'Secrecy',
  });
  await gm.mutation(api.canonicalDraftPersistence.edit, {
    campaignId,
    militiaId: key.militiaId,
    operation: {
      draftId: key.draftId,
      operationId: 'first-edit',
      baseRevision: 0,
      edit: { kind: 'add_slot', slotId: 'first' },
    },
  });
  expect(await gm.mutation(api.canonicalSetup.initialize, args)).toEqual(key);
  expect(
    await gm.query(api.canonicalDraftPersistence.observe, key),
  ).toMatchObject({
    revision: 1,
    draft: {
      week: 1,
      context: { firstMilitiaWeek: true },
      activity: { slots: [{ slotId: 'first', choice: null }] },
    },
  });
});

test('[setup.retry-source] a changed source retried under an accepted identity is refused without replacing the setup or advancing the week', async () => {
  const { gm, campaignId } = await setup();
  const accepted = {
    campaignId,
    initializationId: 'resumed-setup',
    setup: newMilitiaSetup('Security'),
  };
  const key = await gm.mutation(api.canonicalSetup.initialize, accepted);
  const changed = newMilitiaSetup('Secrecy');
  changed.state.militiaSnapshot.rank = 3;
  await expect(
    gm.mutation(api.canonicalSetup.initialize, {
      ...accepted,
      setup: changed,
    }),
  ).rejects.toThrow('Militia setup is already complete');
  // The unacknowledged original, resent, is still recognised as accepted.
  expect(await gm.mutation(api.canonicalSetup.initialize, accepted)).toEqual(
    key,
  );
  const workspace = await gm.query(api.canonicalDraftPersistence.workspace, {
    campaignId,
  });
  expect(workspace).toMatchObject({
    key,
    week: 1,
    snapshot: { rank: 1, focus: 'Security' },
  });
  expect(
    await gm.query(api.canonicalDraftPersistence.observe, key),
  ).toMatchObject({ status: 'open', revision: 0, draft: { week: 1 } });
});

test('[setup.import] current values, identities, carry and orders remain intact on entry', async () => {
  const { gm, campaignId } = await setup();
  const input = newMilitiaSetup('Security');
  input.mode = 'existing';
  input.phase = 'event';
  input.notes = 'Narrative reward; training has fallen since rank-up.';
  const options = await gm.query(api.canonicalSetup.options, { campaignId });
  const character = options?.characters[0];
  if (!character) throw new Error('Missing fixture character');
  const { name: _name, ...facts } = character;
  input.state.week = 9;
  input.state.militiaSnapshot = {
    ...input.state.militiaSnapshot,
    rank: 5,
    training: 2,
    treasuryCopper: -100,
    notoriety: 120,
    characters: [facts],
    roster: {
      people: [{ characterId: character.characterId, kind: 'pc', hitDice: 7 }],
      officers: [
        { role: 'commandant', characterId: character.characterId },
        { role: 'strategist', characterId: character.characterId },
      ],
      teams: (['active', 'disabled', 'missing'] as const).map((status, i) => ({
        teamId: `team-${i}`,
        name: `Team ${i}`,
        teamType: 'defenders',
        status,
        rewardCapExempt: false,
        managerCharacterId: character.characterId,
        notes: 'Keep this condition',
      })),
    },
    settlements: [
      {
        settlementId: 'home',
        name: 'Home',
        reputation: 'Helpful',
        secured: true,
        occupied: false,
        temporaryReputationShift: 1,
        refugeActivatedWeek: 8,
        refugeActiveUntilWeek: 10,
      },
    ],
    economy: {
      items: [
        {
          itemId: 'sword',
          name: 'Sword',
          valueCopper: 1000,
          weight: 2,
          location: 'order',
        },
      ],
      caches: [],
      markets: [],
      orders: [
        {
          orderId: 'delivery',
          itemId: 'sword',
          settlementId: 'home',
          source: 'special_order',
          mode: 'purchase',
          orderedWeek: 8,
          orderedDay: 50,
          dueDay: 59,
          dueActivityWeek: null,
          priceCopper: 1000,
          deliveryDays: 9,
          enchantmentValueCopper: 0,
          receipt: null,
        },
      ],
    },
  };
  input.state.context = {
    firstMilitiaWeek: false,
    startDay: 56,
    uneventfulCarry: true,
    lastBuyoffWeek: 7,
    orders: [],
    carriedEvents: [
      {
        eventId: 'rivalry',
        eventType: 'rivalry',
        startedWeek: 4,
        order: 3,
        targets: [
          { kind: 'team', teamId: 'team-0' },
          { kind: 'team', teamId: 'team-1' },
        ],
      },
    ],
    queuedEffects: [
      {
        effectId: 'later',
        sourceId: 'table',
        startsWeek: 10,
        endsWeek: 10,
        effect: { kind: 'team_return', teamId: 'team-2', status: 'disabled' },
      },
    ],
  };
  input.state.militiaSnapshot.characterActions = {
    people: [
      {
        characterId: character.characterId,
        status: 'captured',
        location: { kind: 'elsewhere', location: 'Enemy camp' },
        directRescueRequired: true,
        capture: { source: 'raid', week: 8 },
      },
    ],
  };
  input.state.militiaSnapshot.bonuses = [
    {
      bonusId: 'scoped',
      source: 'Mission',
      teamId: 'team-0',
      phase: 'activity',
      check: 'security',
      value: 2,
      availableWeek: 9,
      consumedWeek: null,
    },
  ];
  const home = input.state.militiaSnapshot.settlements.find(
    (town) => town.settlementId === 'home',
  );
  if (!home) throw new Error('Missing home settlement');
  home.reduceDangerReputationShift = 1;
  home.reduceDangerUntilWeek = 10;
  input.state.militiaSnapshot.eventBenefits = {
    skills: [
      {
        benefitId: 'skill',
        sourceEventIds: ['old-event'],
        characterIds: [character.characterId],
        skills: ['diplomacy'],
        bonusType: 'morale',
        value: 2,
        settlementId: 'home',
        afterDark: true,
        startsWeek: 8,
        endsWeek: 9,
      },
    ],
    markets: [
      {
        benefitId: 'discount',
        sourceEventIds: ['market-day'],
        settlementIds: ['home'],
        discountPercent: 5,
        startsWeek: 8,
        endsWeek: 9,
      },
    ],
  };
  const key = await gm.mutation(api.canonicalSetup.initialize, {
    campaignId,
    initializationId: 'existing',
    setup: input,
  });
  const source = await gm.query(api.canonicalDraftPersistence.workspace, {
    campaignId,
  });
  expect(source?.snapshot).toEqual(input.state.militiaSnapshot);
  expect(
    await gm.query(api.canonicalDraftPersistence.observe, key),
  ).toMatchObject({
    revision: 0,
    draft: {
      week: 9,
      context: { ...input.state.context, persistentPhaseEligible: true },
      activity: { slots: [] },
    },
  });
});

test('[setup.authority] outsiders cannot initialize; ordinary campaign members can', async () => {
  const { gm, t, campaignId } = await setup();
  const args = {
    campaignId,
    initializationId: 'refused',
    setup: newMilitiaSetup('Loyalty'),
  };
  for (const user of ['user_outsider']) {
    const caller = t.withIdentity({
      tokenIdentifier: `https://${deploymentFixture.clerkHost}|${user}`,
    });
    await expect(
      caller.mutation(api.canonicalSetup.initialize, args),
    ).rejects.toThrow('Campaign access required');
  }
  await expect(t.mutation(api.canonicalSetup.initialize, args)).rejects.toThrow(
    'Campaign access required',
  );
  expect(
    await gm.query(api.canonicalDraftPersistence.workspace, { campaignId }),
  ).toBeNull();
  vi.stubEnv('E2E_ENABLED', 'false');
  await expect(
    gm.mutation(api.canonicalSetup.initialize, args),
  ).resolves.toMatchObject({ campaignId });
});

test('[setup.confirmation] an ordinary player initializes, edits and confirms a first-use mid-campaign week once', async () => {
  vi.useFakeTimers();
  const { t, gm, campaignId } = await setup();
  const member = t.withIdentity({
    tokenIdentifier: `https://${deploymentFixture.clerkHost}|user_player`,
  });
  const input = newMilitiaSetup('Loyalty');
  input.state.week = 12;
  input.state.context.startDay = 77;
  const key = await member.mutation(api.canonicalSetup.initialize, {
    campaignId,
    initializationId: 'mid-first-use',
    setup: input,
  });
  await member.mutation(api.canonicalDraftPersistence.edit, {
    campaignId,
    militiaId: key.militiaId,
    operation: {
      draftId: key.draftId,
      operationId: 'no-event',
      baseRevision: 0,
      edit: {
        kind: 'event_chance',
        roll: {
          diceTotal: 100,
          diceCount: 1,
          sides: 100,
          provenance: { kind: 'table' },
          modifiers: [],
        },
      },
    },
  });
  const preview = await gm.query(api.canonicalDraftPersistence.preview, key);
  expect(preview.status).toBe('ready');
  const receipt = await member.mutation(api.canonicalDraftPersistence.confirm, {
    ...key,
    operation: { operationId: 'confirm', reviewed: preview.reviewed },
  });
  expect(receipt.successor).toMatchObject({
    week: 13,
    revision: 0,
    context: { firstMilitiaWeek: false, startDay: 84 },
  });
  const source = await member.query(api.canonicalDraftPersistence.workspace, {
    campaignId,
  });
  expect(source?.snapshot.treasuryCopper).toBe(1000);
  expect(source?.key.draftId).toBe(receipt.successor.draftId);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
});

test('[setup.references] foreign character references fail atomically and never allocate a draft', async () => {
  const { gm, campaignId } = await setup();
  const input = newMilitiaSetup('Security');
  input.state.militiaSnapshot.characters = [
    {
      characterId: 'foreign',
      level: 1,
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
      isActive: true,
    },
  ];
  await expect(
    gm.mutation(api.canonicalSetup.initialize, {
      campaignId,
      initializationId: 'invalid',
      setup: input,
    }),
  ).rejects.toThrow('belonging');
  expect(
    await gm.query(api.canonicalDraftPersistence.workspace, { campaignId }),
  ).toBeNull();
  const options = await gm.query(api.canonicalSetup.options, { campaignId });
  expect(options?.started).toBe(false);
});

test('[setup.race] competing setup requests leave exactly the accepted source available for play', async () => {
  const { gm, t, campaignId } = await setup();
  const player = t.withIdentity({
    tokenIdentifier: `https://${deploymentFixture.clerkHost}|user_player`,
  });
  const results = await Promise.allSettled([
    gm.mutation(api.canonicalSetup.initialize, {
      campaignId,
      initializationId: 'first-table',
      setup: newMilitiaSetup('Security'),
    }),
    player.mutation(api.canonicalSetup.initialize, {
      campaignId,
      initializationId: 'second-table',
      setup: newMilitiaSetup('Secrecy'),
    }),
  ]);
  expect(
    results.filter((result) => result.status === 'fulfilled'),
  ).toHaveLength(1);
  expect(results.filter((result) => result.status === 'rejected')).toHaveLength(
    1,
  );
  const winner = results.find((result) => result.status === 'fulfilled');
  if (!winner) throw new Error('Missing accepted setup');
  const source = await player.query(api.canonicalDraftPersistence.workspace, {
    campaignId,
  });
  expect(source?.key).toEqual(winner.value);
  expect(source?.snapshot.focus).toBe(
    results[0]?.status === 'fulfilled' ? 'Security' : 'Secrecy',
  );
  const state = await gm.query(
    api.canonicalDraftPersistence.observe,
    winner.value,
  );
  expect(state).toMatchObject({
    status: 'open',
    revision: 0,
    draft: { week: 1 },
  });
});

test('[setup.new-campaign] a campaign without a militia enters the same lifecycle', async () => {
  const { gm, t, campaignId } = await setup();
  await t.run(async (ctx) => {
    const carrier = await ctx.db
      .query('militia')
      .withIndex('by_campaign', (q) => q.eq('campaignId', campaignId))
      .unique();
    if (!carrier) throw new Error('Missing fixture militia');
    await ctx.db.delete('militia', carrier._id);
  });
  const key = await gm.mutation(api.canonicalSetup.initialize, {
    campaignId,
    initializationId: 'fresh-campaign',
    setup: newMilitiaSetup('Loyalty'),
  });
  const source = await gm.query(api.canonicalDraftPersistence.workspace, {
    campaignId,
  });
  expect(source?.key).toEqual(key);
  expect(source?.snapshot).toMatchObject({
    rank: 1,
    training: 0,
    treasuryCopper: 1000,
    focus: 'Loyalty',
  });
});

test('[rules.U01.setup-server] an existing militia cannot retain the new-militia Upkeep skip', async () => {
  const { gm, campaignId } = await setup();
  const input = newMilitiaSetup('Loyalty');
  input.mode = 'existing';
  input.state.week = 12;
  const key = await gm.mutation(api.canonicalSetup.initialize, {
    campaignId,
    initializationId: 'resumed',
    setup: input,
  });
  expect(
    await gm.query(api.canonicalDraftPersistence.observe, key),
  ).toMatchObject({
    draft: { week: 12, context: { firstMilitiaWeek: false } },
  });
  const preview = await gm.query(api.canonicalDraftPersistence.preview, key);
  expect(preview.status).toBe('incomplete');
});
