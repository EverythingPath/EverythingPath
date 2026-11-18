// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { afterEach, expect, test, vi } from 'vitest';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import schema from './schema';
import { seedAcceptedCampaign } from './lib/acceptedCampaignFixture';
import { maxCompanionFactRefreshes } from './lib/companionRelationships';
import { initializationEdits } from '../tests/rules/initialization-edits';
import { newMilitiaSetup } from '../src/lib/canonical-setup';
import { permanentMilitiaFacts } from '../tests/militia-companion-facts';
import {
  closedCorrection,
  correctionReducer,
  planRosterSave,
  type AcceptedMilitia,
} from '../src/components/militia-corrections/correction-lifecycle';
import { applyRosterCorrection } from '../src/lib/roster-corrections';
import {
  bipedEidolon,
  linkSummonerAndEidolon,
  preparedCampaign,
} from '../tests/summoner-eidolon';

// PRD #251 decisions 15 and 16 (#246, #249): companions join the roster
// explicitly, the militia reads their ordinary permanent facts, and only an
// unresolved value the week's rules read prevents Weekly Confirmation.
const modules = import.meta.glob('./**/*.ts');
afterEach(() => vi.useRealTimers());

test('an unresolved eidolon officer blocks only the week that reads its ability, while roster membership and editing stay available', async () => {
  vi.useFakeTimers();
  const { t, owner, member, eidolonId, relationshipId, seeded, scope } =
    await fixture();
  await loseEverySource(owner, relationshipId);
  const facts = await eidolonFacts(member, scope, eidolonId);
  // Dormant progression leaves actual HD and the advanced scores unresolved.
  expect(facts).toMatchObject({
    level: 0,
    actualHitDice: null,
    unresolvedAbilities: ['strength', 'dexterity', 'constitution'],
  });
  // The Marshal adds Strength or Wisdom to Security checks, and this week's
  // missing patrol returns on a Security check.
  await enroll(owner, scope, eidolonId, 'marshal');
  // The roster row reports the eidolon's calculation readiness honestly.
  const rows = await member.query(api.character.listCampaignCharacters, {
    campaignId: scope.campaignId,
    organizationId: 'org',
  });
  expect(
    rows.find(({ character }) => character._id === eidolonId),
  ).toMatchObject({
    isOnRoster: true,
    character: {
      actualHitDice: null,
      unresolvedAbilities: ['strength', 'dexterity', 'constitution'],
    },
  });
  await prepareWeek(member, scope, seeded);
  const blocked = await owner.query(
    api.canonicalDraftPersistence.preview,
    seeded.key,
  );
  expect(blocked.status).toBe('incomplete');
  expect(blocked.requirements).toEqual([
    `team:patrol:return:officer:${eidolonId}:unresolved-strength`,
  ]);
  await expect(
    owner.mutation(api.canonicalDraftPersistence.confirm, {
      ...seeded.key,
      operation: { operationId: 'blocked', reviewed: blocked.reviewed },
    }),
  ).rejects.toThrow('Weekly Resolution is incomplete');
  // The eidolon stays on the roster and its sheet stays editable.
  await member.mutation(api.characterSheet.editBaseScores, {
    characterId: eidolonId,
    scores: { wisdom: 12 },
    operationId: 'edit-while-unresolved',
  });
  const ledger = await member.query(api.canonicalLedger.read, scope);
  expect(ledger.state.militiaSnapshot.roster.officers).toContainEqual({
    role: 'marshal',
    characterId: eidolonId,
  });
  // Restoring a source resolves the facts with that change.
  await owner.mutation(api.companionRelationships.setSourceEnabled, {
    relationshipId,
    sourceKey: 'bond',
    enabled: true,
    operationId: 'restore-bond',
  });
  const resolved = await eidolonFacts(member, scope, eidolonId);
  expect(resolved).not.toHaveProperty('unresolvedAbilities');
  expect(resolved).toMatchObject(
    permanentMilitiaFacts(
      await member.query(api.characterSheet.read, { characterId: eidolonId }),
    ),
  );
  const ready = await owner.query(
    api.canonicalDraftPersistence.preview,
    seeded.key,
  );
  expect(ready.status).toBe('ready');
  await owner.mutation(api.canonicalDraftPersistence.confirm, {
    ...seeded.key,
    operation: { operationId: 'resolved', reviewed: ready.reviewed },
  });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
});

test('unrelated unresolved values confirm, frozen records keep them, and only changed facts stale another player’s review', async () => {
  vi.useFakeTimers();
  const {
    t,
    owner,
    member,
    eidolonId,
    summonerId,
    relationshipId,
    seeded,
    scope,
  } = await fixture();
  await loseEverySource(owner, relationshipId);
  // A Spymaster's Dexterity is read only by Secrecy checks; this week makes none.
  await enroll(owner, scope, eidolonId, 'spymaster');
  await prepareWeek(member, scope, seeded);
  const reviewed = await member.query(
    api.canonicalDraftPersistence.preview,
    seeded.key,
  );
  expect(reviewed.status).toBe('ready');
  // The other player's unrelated summoner edit changes no facts.
  await owner.mutation(api.characterSheet.createPersonalAdjustment, {
    characterId: summonerId,
    name: 'Summoner’s focus',
    modifiers: [{ target: 'attack.melee', bonusType: 'untyped', value: 1 }],
    operationId: 'unrelated',
  });
  expect(
    (await member.query(api.canonicalDraftPersistence.preview, seeded.key))
      .reviewed,
  ).toEqual(reviewed.reviewed);
  const { record } = await member.mutation(
    api.canonicalDraftPersistence.confirm,
    {
      ...seeded.key,
      operation: {
        operationId: 'unrelated-confirm',
        reviewed: reviewed.reviewed,
      },
    },
  );
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(
    record.sourceMilitiaSnapshot.characters.find(
      (row) => row.characterId === eidolonId,
    ),
  ).toMatchObject({
    actualHitDice: null,
    unresolvedAbilities: ['strength', 'dexterity', 'constitution'],
  });
  const history = { campaignId: scope.campaignId, week: 9 };
  const frozen = await member.query(api.canonicalHistory.read, history);
  // Restoring the source refreshes the live facts and leaves history alone.
  await owner.mutation(api.companionRelationships.setSourceEnabled, {
    relationshipId,
    sourceKey: 'eidolon',
    enabled: true,
    operationId: 'restore-feature',
  });
  expect(await eidolonFacts(member, scope, eidolonId)).toMatchObject({
    actualHitDice: 6,
  });
  expect(await owner.query(api.canonicalHistory.read, history)).toEqual(frozen);
});

test('a companion’s facts never pick up a Temporary Effect that reaches it through its summoner', async () => {
  const { owner, member, eidolonId, summonerId, relationshipId, scope } =
    await fixture();
  const before = await member.query(api.canonicalLedger.read, scope);
  const entryId = await owner.mutation(api.characterSheet.createSheetEntry, {
    characterId: summonerId,
    name: 'Bull’s strength and bear’s endurance',
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: false,
      defaultCasterLevel: 8,
    },
    modifiers: [
      { target: 'ability.str', bonusType: 'enhancement', value: 4 },
      { target: 'ability.con', bonusType: 'enhancement', value: 4 },
    ],
    operationId: 'temporary-summoner-effects',
  });
  // Neither the summoner's nor the eidolon's facts change: no review restarts.
  expect(await member.query(api.canonicalLedger.read, scope)).toEqual(before);
  // A short Spell Effect as the only supporting source counts for the
  // current sheet, never for the ordinary permanent one.
  await owner.mutation(api.companionRelationships.addSource, {
    relationshipId,
    source: {
      key: 'spell-bond',
      label: 'Temporary bond',
      sheetEntryId: entryId,
      enabled: true,
    },
    operationId: 'temporary-source',
  });
  await loseEverySource(owner, relationshipId);
  const sheet = await member.query(api.characterSheet.read, {
    characterId: eidolonId,
  });
  expect(sheet?.calculated.hitDice).toBe(6);
  expect(sheet?.permanentCalculated.hitDice).toBeNull();
  expect(await eidolonFacts(member, scope, eidolonId)).toMatchObject({
    ...permanentMilitiaFacts(sheet),
    unresolvedAbilities: ['strength', 'dexterity', 'constitution'],
  });
});

test('a summoner level change stales a review taken before it, since the eidolon’s facts change with it', async () => {
  const { owner, member, eidolonId, summonerId, seeded, scope } =
    await fixture();
  await enroll(owner, scope, eidolonId, 'spymaster');
  await prepareWeek(member, scope, seeded);
  const reviewed = await member.query(
    api.canonicalDraftPersistence.preview,
    seeded.key,
  );
  expect(reviewed.status).toBe('ready');
  const summoner = await owner.query(api.characterSheet.read, {
    characterId: summonerId,
  });
  const last = summoner?.entries
    .flatMap((entry) => (entry.kind === 'classLevel' ? [entry] : []))
    .sort((a, b) => b.state.position - a.state.position)[0];
  if (!last) throw new Error('Missing summoner level');
  await owner.mutation(api.characterSheet.deleteClassLevel, {
    characterId: summonerId,
    entryId: last._id,
    operationId: 'summoner-level-loss',
  });
  await expect(
    member.mutation(api.canonicalDraftPersistence.confirm, {
      ...seeded.key,
      operation: { operationId: 'stale', reviewed: reviewed.reviewed },
    }),
  ).rejects.toThrow('Reviewed weekly source changed');
  expect(await eidolonFacts(member, scope, eidolonId)).toMatchObject(
    permanentMilitiaFacts(
      await member.query(api.characterSheet.read, { characterId: eidolonId }),
    ),
  );
});

test('Setup offers and checks the same unresolved companion facts as the live projection', async () => {
  const { t, owner, member, eidolonId, relationshipId, campaignId } =
    await baseFixture();
  await t.run((ctx) =>
    ctx.db.insert('militia', { campaignId, name: 'Companion militia' }),
  );
  await loseEverySource(owner, relationshipId);
  const options = await member.query(api.canonicalSetup.options, {
    campaignId,
  });
  const offered = options?.characters.find(
    (row) => row.characterId === eidolonId,
  );
  expect(offered).toMatchObject({
    actualHitDice: null,
    unresolvedAbilities: ['strength', 'dexterity', 'constitution'],
  });
  const setup = newMilitiaSetup('Security');
  setup.state.militiaSnapshot.characters = (options?.characters ?? []).map(
    ({ name: _name, ...facts }) => facts,
  );
  setup.state.militiaSnapshot.roster.people = [
    { characterId: eidolonId, kind: 'npc', hitDice: null },
  ];
  // Restoring a source changes the facts Setup reviewed.
  await owner.mutation(api.companionRelationships.setSourceEnabled, {
    relationshipId,
    sourceKey: 'bond',
    enabled: true,
    operationId: 'restore-before-setup',
  });
  await expect(
    owner.mutation(api.canonicalSetup.initialize, {
      campaignId,
      initializationId: 'stale-setup',
      setup,
    }),
  ).rejects.toThrow('Character facts changed');
  const current = await member.query(api.canonicalSetup.options, {
    campaignId,
  });
  setup.state.militiaSnapshot.characters = (current?.characters ?? []).map(
    ({ name: _name, ...facts }) => facts,
  );
  const key = await owner.mutation(api.canonicalSetup.initialize, {
    campaignId,
    initializationId: 'current-setup',
    setup,
  });
  const live = await member.query(api.canonicalLedger.read, {
    campaignId,
    militiaId: key.militiaId,
  });
  expect(live.state.militiaSnapshot.characters).toEqual(
    setup.state.militiaSnapshot.characters,
  );
});

test('a change refuses to leave stale facts when more Companions depend on it than one change can refresh', async () => {
  const { t, owner, summonerId, campaignId } = await baseFixture();
  await t.run(async (ctx) => {
    for (let index = 0; index < maxCompanionFactRefreshes; index++) {
      const companionId = await ctx.db.insert('character', {
        campaignId,
        name: `Companion ${index}`,
        ownerId: 'test|owner',
        kind: 'npc',
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
      await ctx.db.insert('companionRelationship', {
        associatedCharacterId: summonerId,
        companionCharacterId: companionId,
        kind: 'cohort',
        sources: [{ key: 'bond', label: 'Bond', enabled: true }],
        status: 'active',
        manuallyInterrupted: false,
        activatedAt: index,
        lastOperationId: `seed-${index}`,
      });
    }
  });
  const edit = (operationId: string) =>
    owner.mutation(api.characterSheet.editBaseScores, {
      characterId: summonerId,
      scores: { wisdom: 14 },
      operationId,
    });
  await expect(edit('too-many')).rejects.toThrow(
    'This Companion group is too large to change at once',
  );
  const sheet = await owner.query(api.characterSheet.read, {
    characterId: summonerId,
  });
  expect(sheet?.permanentCalculated.abilities.wisdom.score).toBe(10);
});

test('replaced Companions are retained history that never limits an edit', async () => {
  const { t, owner, member, summonerId, eidolonId, campaignId } =
    await baseFixture();
  // More former Companions than one change could refresh: each was replaced
  // and keeps its relationship as history.
  await t.run(async (ctx) => {
    for (let index = 0; index <= maxCompanionFactRefreshes; index++) {
      const companionId = await ctx.db.insert('character', {
        campaignId,
        name: `Former companion ${index}`,
        ownerId: 'test|owner',
        kind: 'npc',
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
      await ctx.db.insert('companionRelationship', {
        associatedCharacterId: summonerId,
        companionCharacterId: companionId,
        kind: 'eidolon',
        sources: [{ key: 'bond', label: 'Bond', enabled: true }],
        status: 'replaced',
        manuallyInterrupted: false,
        activatedAt: index,
        lastOperationId: `former-${index}`,
      });
    }
  });
  const summoner = await owner.query(api.characterSheet.read, {
    characterId: summonerId,
  });
  // Summoner 8 → 6 lowers the eidolon from 6 HD to 5 (APG Table 2–9).
  const levels = (summoner?.entries ?? [])
    .flatMap((entry) => (entry.kind === 'classLevel' ? [entry] : []))
    .sort((a, b) => b.state.position - a.state.position)
    .slice(0, 2);
  for (const level of levels)
    await owner.mutation(api.characterSheet.deleteClassLevel, {
      characterId: summonerId,
      entryId: level._id,
      operationId: `edit-with-history-${level.state.position}`,
    });
  // The current eidolon still refreshes with the change.
  const eidolon = await member.query(api.characterSheet.read, {
    characterId: eidolonId,
  });
  expect(eidolon?.permanentCalculated.hitDice).toBe(5);
  const [facts] = await t.run((ctx) =>
    ctx.db
      .query('catalogCharacterFacts')
      .withIndex('by_characterId', (q) => q.eq('characterId', eidolonId))
      .collect(),
  );
  expect(facts?.facts).toMatchObject(permanentMilitiaFacts(eidolon));
});

test('a roster correction adds an unresolved Companion with the live projection’s facts', async () => {
  const { t, owner, member, eidolonId, relationshipId, seeded, scope } =
    await fixture();
  await loseEverySource(owner, relationshipId);
  const read = async (): Promise<AcceptedMilitia> => ({
    ...(await member.query(api.canonicalLedger.read, scope)),
    draftId: seeded.key.draftId,
  });
  const roster = correctionReducer(closedCorrection, {
    type: 'open',
    target: { kind: 'roster' },
    accepted: await read(),
  });
  const plan = planRosterSave(roster, await read(), (latest) =>
    applyRosterCorrection(
      latest,
      [
        ...latest.roster.people.map(({ characterId, hitDice }) => ({
          characterId,
          hitDice,
        })),
        { characterId: eidolonId, hitDice: null },
      ],
      [{ characterId: eidolonId, kind: 'npc' }],
    ),
  );
  if (plan.kind !== 'send') throw new Error(`expected send, got ${plan.kind}`);
  await member.mutation(api.canonicalLedger.save, {
    ...scope,
    expectedRevision: plan.attempt.expectedRevision,
    snapshot: plan.snapshot,
    reason: 'Ixa joins the militia',
  });
  const live = await t.run((ctx) =>
    ctx.db
      .query('catalogCharacterFacts')
      .withIndex('by_characterId', (q) => q.eq('characterId', eidolonId))
      .unique(),
  );
  expect(live?.facts).toMatchObject({
    actualHitDice: null,
    unresolvedAbilities: ['strength', 'dexterity', 'constitution'],
  });
  const ledger = await member.query(api.canonicalLedger.read, scope);
  expect(ledger.state.militiaSnapshot.roster.people).toContainEqual({
    characterId: eidolonId,
    kind: 'npc',
    hitDice: null,
  });
  expect(await eidolonFacts(member, scope, eidolonId)).toEqual(live?.facts);
  // The stored ledger keeps the same facts the projection reads.
  const stored = await t.run((ctx) =>
    ctx.db
      .query('canonicalMilitiaState')
      .withIndex('by_militiaId', (q) => q.eq('militiaId', scope.militiaId))
      .unique(),
  );
  expect(
    stored?.snapshot.characters.find((row) => row.characterId === eidolonId),
  ).toEqual(live?.facts);
});

test('a local definition edit refreshes the downstream eidolon’s facts in the same mutation', async () => {
  const {
    t,
    owner,
    member,
    summonerId,
    summonerClassId,
    eidolonId,
    relationshipId,
    scope,
  } = await fixture();
  // A homebrew Summoner whose Eidolon class feature supports the link.
  const summonerClass = await t.run(async (ctx) => {
    const featureId = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId: summonerId,
      name: 'Eidolon',
      ruleIdentity: 'summoner-eidolon',
      stacksWithItself: false,
      sources: [],
      detail: { kind: 'classFeature' },
      modifiers: [],
    });
    const row = await ctx.db.get('catalogEntry', summonerClassId);
    if (row?.detail.kind !== 'class' || !('featuresByLevel' in row.detail))
      throw new Error('Missing Summoner class');
    const detail = {
      ...row.detail,
      featuresByLevel: [{ classLevel: 1, catalogEntryId: featureId }],
    };
    await ctx.db.patch('catalogEntry', summonerClassId, { detail });
    return { ...row, detail };
  });
  await owner.mutation(api.companionRelationships.addSource, {
    relationshipId,
    source: {
      key: 'feature',
      label: 'Eidolon feature',
      grantKey: {
        source: 'summoner',
        classLevel: 1,
        entry: 'summoner-eidolon',
      },
      enabled: true,
    },
    operationId: 'feature-source',
  });
  await loseEverySource(owner, relationshipId);
  expect(await eidolonFacts(member, scope, eidolonId)).toMatchObject({
    actualHitDice: 6,
  });
  const before = await member.query(api.canonicalLedger.read, scope);
  // The table's Summoner no longer grants the Eidolon feature.
  await owner.mutation(api.catalogCopies.editDefinition, {
    characterId: summonerId,
    catalogEntryId: summonerClassId,
    detail: { ...summonerClass.detail, featuresByLevel: [] },
    operationId: 'homebrew-summoner',
  });
  const eidolon = await member.query(api.characterSheet.read, {
    characterId: eidolonId,
  });
  expect(eidolon?.permanentCalculated.hitDice).toBeNull();
  expect(await eidolonFacts(member, scope, eidolonId)).toMatchObject({
    ...permanentMilitiaFacts(eidolon),
    unresolvedAbilities: ['strength', 'dexterity', 'constitution'],
  });
  expect((await member.query(api.canonicalLedger.read, scope)).revision).toBe(
    before.revision + 1,
  );
});

type Reader = ReturnType<ReturnType<typeof convexTest>['withIdentity']>;
type Scope = { campaignId: Id<'campaign'>; militiaId: Id<'militia'> };

async function eidolonFacts(
  reader: Reader,
  scope: Scope,
  eidolonId: Id<'character'>,
) {
  return (
    await reader.query(api.canonicalLedger.read, scope)
  ).state.militiaSnapshot.characters.find(
    (row) => row.characterId === eidolonId,
  );
}

async function loseEverySource(
  owner: Reader,
  relationshipId: Id<'companionRelationship'>,
) {
  for (const sourceKey of ['eidolon', 'bond'])
    await owner.mutation(api.companionRelationships.setSourceEnabled, {
      relationshipId,
      sourceKey,
      enabled: false,
      operationId: `lose-${sourceKey}`,
    });
}

async function enroll(
  owner: Reader,
  scope: Scope,
  eidolonId: Id<'character'>,
  role: 'marshal' | 'spymaster',
) {
  const current = await owner.query(api.canonicalLedger.read, scope);
  const snapshot = current.state.militiaSnapshot;
  await owner.mutation(api.canonicalLedger.save, {
    ...scope,
    expectedRevision: current.revision,
    reason: 'Enroll the eidolon',
    snapshot: {
      ...snapshot,
      roster: {
        ...snapshot.roster,
        people: [
          ...snapshot.roster.people,
          { characterId: eidolonId, kind: 'npc', hitDice: null },
        ],
        officers: [
          ...snapshot.roster.officers,
          { role, characterId: eidolonId },
        ],
      },
    },
  });
}

async function prepareWeek(
  member: Reader,
  scope: Scope,
  seeded: Awaited<ReturnType<typeof seedAcceptedCampaign>>,
) {
  const edits = initializationEdits('patrol', seeded.characterId);
  for (const [baseRevision, edit] of edits.entries())
    await member.mutation(api.canonicalDraftPersistence.edit, {
      ...scope,
      operation: {
        draftId: seeded.key.draftId,
        operationId: `week-edit-${baseRevision}`,
        baseRevision,
        edit,
      },
    });
}

// A summoner 8 and an eidolon, owned by two players, in an isolated prepared
// campaign with an accepted mid-campaign militia week open.
async function fixture() {
  const base = await baseFixture({ acceptedWeek: true });
  const { seeded } = base;
  if (!seeded) throw new Error('Missing accepted week');
  return {
    ...base,
    seeded,
    scope: { campaignId: base.campaignId, militiaId: seeded.key.militiaId },
  };
}

async function baseFixture({ acceptedWeek = false } = {}) {
  const t = convexTest(schema, modules);
  const { owner, member, campaignId } = await preparedCampaign(
    t,
    'companion-readiness',
  );
  // Sheets created after Setup publish their facts to the live militia.
  const seeded = acceptedWeek
    ? await owner.run((ctx) => seedAcceptedCampaign(ctx, campaignId))
    : null;
  const { summonerId, summonerClassId, eidolonId, relationshipId } =
    await linkSummonerAndEidolon({ t, owner, member, campaignId });
  await member.mutation(api.characterSheet.setCompanionProgression, {
    characterId: eidolonId,
    operationId: 'eidolon',
    progression: bipedEidolon,
  });
  return {
    t,
    owner,
    member,
    campaignId,
    summonerId,
    summonerClassId,
    eidolonId,
    relationshipId,
    seeded,
  };
}
