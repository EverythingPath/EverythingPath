// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';
import { seedAcceptedCampaign } from './lib/acceptedCampaignFixture';
import {
  closedCorrection,
  correctionReducer,
  correctionView,
  planRosterSave,
  planSectionSave,
  type AcceptedMilitia,
} from '../src/components/militia-corrections/correction-lifecycle';
import {
  sectionValue,
  type MilitiaSectionKey,
  type SectionValue,
} from '../src/lib/militia-correction-sections';
import {
  applyOfficerCorrection,
  applyRosterCorrection,
  assignOfficer,
} from '../src/lib/roster-corrections';
const modules = import.meta.glob('./**/*.ts');

async function fixture() {
  const t = convexTest(schema, modules);
  const player = t.withIdentity({ tokenIdentifier: 'test|player' });
  const gm = t.withIdentity({ tokenIdentifier: 'test|gm' });
  const seeded = await player.run((ctx) => seedAcceptedCampaign(ctx));
  const scope = {
    campaignId: seeded.key.campaignId,
    militiaId: seeded.key.militiaId,
  };
  return { t, player, gm, scope, ...seeded };
}

type Client = Awaited<ReturnType<typeof fixture>>['player'];
type Scope = Awaited<ReturnType<typeof fixture>>['scope'];

// One device's section correction, driven through the client lifecycle
// against the real ledger query and mutation.
async function openCorrection(
  client: Client,
  scope: Scope,
  draftId: string,
  section: MilitiaSectionKey,
) {
  const read = async (): Promise<AcceptedMilitia> => ({
    ...(await client.query(api.canonicalLedger.read, scope)),
    draftId,
  });
  const opened = await read();
  const correction = correctionReducer(closedCorrection, {
    type: 'open',
    target: { kind: 'section', section },
    accepted: opened,
  });
  return { opened, correction, read };
}

async function saveSection<K extends MilitiaSectionKey>(
  client: Client,
  scope: Scope,
  state: Awaited<ReturnType<typeof openCorrection>>,
  accepted: AcceptedMilitia,
  section: K,
  yours: SectionValue<K>,
  reason: string,
) {
  const plan = planSectionSave(state.correction, accepted, section, yours);
  if (plan.kind !== 'send') return plan;
  await client.mutation(api.canonicalLedger.save, {
    ...scope,
    expectedRevision: plan.attempt.expectedRevision,
    snapshot: plan.snapshot,
    reason,
  });
  return plan;
}

test('two players correcting different sections keep both corrections through a revision race', async () => {
  const { t, player, gm, scope, key, characterId } = await fixture();
  const values = await openCorrection(player, scope, key.draftId, 'values');
  const teams = await openCorrection(gm, scope, key.draftId, 'teams');

  const valuesYours = {
    ...sectionValue('values', values.opened.state.militiaSnapshot),
    treasuryCopper: 50000,
  };
  await saveSection(
    player,
    scope,
    values,
    values.opened,
    'values',
    valuesYours,
    'Found a purse',
  );

  // The GM's device has not observed that save yet: its Save goes out
  // against the revision it knows, and the server refuses it.
  const teamsYours = sectionValue(
    'teams',
    teams.opened.state.militiaSnapshot,
  ).map((team) => ({ ...team, status: 'active' as const, notes: 'Returned' }));
  await expect(
    saveSection(
      gm,
      scope,
      teams,
      teams.opened,
      'teams',
      teamsYours,
      'Patrol came back',
    ),
  ).rejects.toThrow('Militia changed');

  // Refreshed: Teams was not changed elsewhere, so the same correction is
  // merged onto the newest militia and saved against its revision.
  const refreshed = await teams.read();
  const rejected = correctionReducer(
    correctionReducer(teams.correction, {
      type: 'submit',
      attempt: { expectedRevision: teams.opened.revision, candidate: 'x' },
    }),
    {
      type: 'rejected',
      attempt: { expectedRevision: teams.opened.revision, candidate: 'x' },
      message: 'Militia changed',
    },
  );
  expect(correctionView(rejected, refreshed)).toMatchObject({
    kind: 'editing',
    notice: 'retry',
  });
  const plan = await saveSection(
    gm,
    scope,
    { ...teams, correction: rejected },
    refreshed,
    'teams',
    teamsYours,
    'Patrol came back',
  );
  expect(plan.kind).toBe('send');

  const final = await player.query(api.canonicalLedger.read, scope);
  expect(final.revision).toBe(values.opened.revision + 2);
  expect(final.state.militiaSnapshot.treasuryCopper).toBe(50000);
  expect(final.state.militiaSnapshot.roster.teams[0]).toMatchObject({
    status: 'active',
    notes: 'Returned',
    managerCharacterId: characterId,
  });
  expect(final.state.militiaSnapshot.roster.officers).toEqual(
    values.opened.state.militiaSnapshot.roster.officers,
  );
  expect(final.state.militiaSnapshot.economy).toEqual(
    values.opened.state.militiaSnapshot.economy,
  );
  expect(final.state.context).toEqual(values.opened.state.context);
  const reasons = await t.run((ctx) =>
    ctx.db
      .query('canonicalSourceCorrection')
      .collect()
      .then((rows) => rows.map((row) => row.reason)),
  );
  expect(reasons).toEqual(['Found a purse', 'Patrol came back']);
});

test('a same-section change elsewhere is a conflict and a character edit is never overwritten', async () => {
  const { player, gm, scope, key, characterId } = await fixture();
  const mine = await openCorrection(player, scope, key.draftId, 'values');
  const theirs = await openCorrection(gm, scope, key.draftId, 'values');
  await saveSection(
    gm,
    scope,
    theirs,
    theirs.opened,
    'values',
    {
      ...sectionValue('values', theirs.opened.state.militiaSnapshot),
      notoriety: 30,
    },
    'Recount notoriety',
  );
  await player.mutation(api.character.updateCharacter, {
    organizationId: 'org',
    characterId,
    patch: { charisma: 20 },
  });
  const latest = await mine.read();
  const yours = {
    ...sectionValue('values', mine.opened.state.militiaSnapshot),
    treasuryCopper: 50000,
  };
  expect(planSectionSave(mine.correction, latest, 'values', yours)).toEqual({
    kind: 'conflict',
  });

  // Starting again from their values keeps both their notoriety and the
  // character edit made meanwhile.
  const restarted = correctionReducer(mine.correction, {
    type: 'restart',
    accepted: latest,
  });
  const plan = await saveSection(
    player,
    scope,
    { ...mine, correction: restarted },
    latest,
    'values',
    {
      ...sectionValue('values', latest.state.militiaSnapshot),
      treasuryCopper: 50000,
    },
    'Found a purse',
  );
  expect(plan.kind).toBe('send');
  const final = await player.query(api.canonicalLedger.read, scope);
  expect(final.state.militiaSnapshot).toMatchObject({
    notoriety: 30,
    treasuryCopper: 50000,
  });
  expect(final.state.militiaSnapshot.characters[0]?.charisma).toBe(20);
});

test('a corrected section is still refused when it removes what carried effects need, and outsiders cannot correct', async () => {
  const { t, player, scope, key } = await fixture();
  const teams = await openCorrection(player, scope, key.draftId, 'teams');
  await expect(
    saveSection(
      player,
      scope,
      teams,
      teams.opened,
      'teams',
      [],
      'Remove the patrol',
    ),
  ).rejects.toThrow('Keep entities referenced by carried events');
  const outsider = t.withIdentity({ tokenIdentifier: 'outsider' });
  const values = await openCorrection(player, scope, key.draftId, 'values');
  await expect(
    saveSection(
      outsider,
      scope,
      values,
      values.opened,
      'values',
      {
        ...sectionValue('values', values.opened.state.militiaSnapshot),
        rank: 9,
      },
      'Not a member',
    ),
  ).rejects.toThrow();
  expect((await player.query(api.canonicalLedger.read, scope)).revision).toBe(
    values.opened.revision,
  );
});

test('character conditions and carried benefits corrected on two devices keep each other and the character records; an officer correction opened before them keeps them too', async () => {
  const { t, player, gm, scope, key, characterId } = await fixture();
  const conditions = await openCorrection(
    player,
    scope,
    key.draftId,
    'characterConditions',
  );
  const benefits = await openCorrection(
    gm,
    scope,
    key.draftId,
    'carriedBenefits',
  );
  const officers = correctionReducer(closedCorrection, {
    type: 'open',
    target: { kind: 'officers' },
    accepted: conditions.opened,
  });

  const carried = {
    skills: [
      {
        benefitId: 'festival-benefit',
        sourceEventIds: ['festival'],
        characterIds: [characterId],
        skills: ['diplomacy' as const],
        bonusType: 'morale' as const,
        value: 2,
        settlementId: 'town',
        afterDark: true,
        startsWeek: 9,
        endsWeek: 10,
      },
    ],
    markets: [
      {
        benefitId: 'market-benefit',
        sourceEventIds: ['market'],
        settlementIds: ['town'],
        discountPercent: 5 as const,
        startsWeek: 9,
        endsWeek: 9,
      },
    ],
  };
  await saveSection(
    gm,
    scope,
    benefits,
    benefits.opened,
    'carriedBenefits',
    carried,
    'Festival rewards',
  );
  await player.mutation(api.character.updateCharacter, {
    organizationId: 'org',
    characterId,
    patch: { charisma: 20 },
  });

  const hidden = [
    {
      characterId,
      status: 'hidden' as const,
      location: { kind: 'refuge' as const, settlementId: 'town' },
      directRescueRequired: true,
      capture: { source: 'raid' as const, week: 8 },
      rescuedWeek: 9,
    },
  ];
  // Sent against the revision this device opened from: refused.
  await expect(
    saveSection(
      player,
      scope,
      conditions,
      conditions.opened,
      'characterConditions',
      hidden,
      'Hid in town',
    ),
  ).rejects.toThrow('Militia changed');
  // Refreshed, Character conditions merge onto the newest militia.
  const refreshed = await conditions.read();
  expect(
    (
      await saveSection(
        player,
        scope,
        conditions,
        refreshed,
        'characterConditions',
        hidden,
        'Hid in town',
      )
    ).kind,
  ).toBe('send');

  const final = await player.query(api.canonicalLedger.read, scope);
  const snapshot = final.state.militiaSnapshot;
  expect(snapshot.characterActions).toEqual({ people: hidden });
  expect(snapshot.eventBenefits).toEqual(carried);
  expect(snapshot.characters[0]?.charisma).toBe(20);
  expect(snapshot.roster).toEqual(
    conditions.opened.state.militiaSnapshot.roster,
  );
  expect(snapshot.economy).toEqual(
    conditions.opened.state.militiaSnapshot.economy,
  );
  expect(final.state.context).toEqual(conditions.opened.state.context);

  // Characters & officers' officer correction opened before both: only the
  // assignments are replaced on the newest militia, so neither correction,
  // nor the new Charisma, is undone.
  const plan = planRosterSave(
    officers,
    {
      ...(await player.query(api.canonicalLedger.read, scope)),
      draftId: key.draftId,
    },
    (latest) =>
      applyOfficerCorrection(
        latest,
        assignOfficer(latest.roster.officers, 'overseer', characterId),
      ),
  );
  if (plan.kind !== 'send') throw new Error(`expected send, got ${plan.kind}`);
  expect(plan.attempt.expectedRevision).toBe(final.revision);
  await player.mutation(api.canonicalLedger.save, {
    ...scope,
    expectedRevision: plan.attempt.expectedRevision,
    snapshot: plan.snapshot,
    reason: 'Ada oversees the camp',
  });
  const corrected = (await player.query(api.canonicalLedger.read, scope)).state
    .militiaSnapshot;
  expect(corrected.characterActions).toEqual({ people: hidden });
  expect(corrected.eventBenefits).toEqual(carried);
  expect(corrected.characters[0]?.charisma).toBe(20);
  expect(corrected.roster.officers).toContainEqual({
    role: 'overseer',
    characterId,
  });
  const reasons = await t.run((ctx) =>
    ctx.db
      .query('canonicalSourceCorrection')
      .collect()
      .then((rows) => rows.map((row) => row.reason)),
  );
  expect(reasons).toEqual([
    'Festival rewards',
    'Hid in town',
    'Ada oversees the camp',
  ]);
});

test('a roster correction clears the removed person’s roles and managers in one save, and an officer correction opened before it conflicts', async () => {
  const { t, player, gm, scope, key, characterId } = await fixture();
  const read = async (client: Client): Promise<AcceptedMilitia> => ({
    ...(await client.query(api.canonicalLedger.read, scope)),
    draftId: key.draftId,
  });
  const opened = await read(gm);
  const officers = correctionReducer(closedCorrection, {
    type: 'open',
    target: { kind: 'officers' },
    accepted: opened,
  });
  const roster = correctionReducer(closedCorrection, {
    type: 'open',
    target: { kind: 'roster' },
    accepted: opened,
  });
  const before = opened.state.militiaSnapshot;
  expect(before.roster.officers.length).toBeGreaterThan(0);
  expect(before.roster.teams.length).toBeGreaterThan(0);

  const plan = planRosterSave(roster, await read(player), (latest) =>
    applyRosterCorrection(latest, [], [{ characterId, kind: 'pc' }]),
  );
  if (plan.kind !== 'send') throw new Error(`expected send, got ${plan.kind}`);
  await player.mutation(api.canonicalLedger.save, {
    ...scope,
    expectedRevision: plan.attempt.expectedRevision,
    snapshot: plan.snapshot,
    reason: 'Character left',
  });
  const after = (await read(player)).state.militiaSnapshot;
  expect(after.roster.people).toEqual([]);
  expect(after.roster.officers).toEqual([]);
  expect(after.roster.teams).toEqual(
    before.roster.teams.map((team) => ({ ...team, managerCharacterId: null })),
  );
  // The record and its rules facts remain.
  expect(after.characters).toEqual(before.characters);

  // The GM's officer correction captured the old roster: it conflicts.
  const latest = await read(gm);
  expect(
    planRosterSave(officers, latest, (value) =>
      applyOfficerCorrection(value, before.roster.officers),
    ),
  ).toEqual({ kind: 'conflict' });
  expect(correctionView(officers, latest)).toEqual({
    kind: 'editing',
    notice: null,
    message: null,
  });
  const reasons = await t.run((ctx) =>
    ctx.db
      .query('canonicalSourceCorrection')
      .collect()
      .then((rows) => rows.map((row) => row.reason)),
  );
  expect(reasons).toEqual(['Character left']);
});
