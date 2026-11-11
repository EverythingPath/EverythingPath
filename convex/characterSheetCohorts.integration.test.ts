// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { expect, test, vi } from 'vitest';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import schema from './schema';
import { seedAcceptedCampaign } from './lib/acceptedCampaignFixture';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { noLeadershipModifiers } from '../src/lib/character-sheet-cohort';

const modules = import.meta.glob('./**/*.ts');
// Each case builds a nine-level leader and a five-level cohort.
vi.setConfig({ testTimeout: 15_000 });
const setAllocation = api.companionRelationships.setSourceAllocation;
const setEquivalence = api.characterSheet.setCohortEquivalence;

// CRB p. 129, Leadership: the base score is the leader's level plus
// Charisma modifier; a cohort is recruited at most at the table's level for
// the score, and stays two or more levels below the leader.
test('a linked ordinary cohort calculates the level its leader allows and keeps its own owner', async () => {
  const { owner, member, leaderId, cohortId, relationshipId } = await fixture();
  const sheet = await read(owner, cohortId);
  expect(sheet?.character.ownerId).toBe('test|member');
  expect(sheet?.calculated).toMatchObject({
    level: 5,
    hitDice: 5,
    cohort: {
      status: 'active',
      equivalence: { basis: 'classLevels', classLevels: 5, value: 5 },
      // Leader 9 with Cha 14: score 11 gives 7th; 9 − 2 also allows 7th.
      leadership: {
        characterLevel: { value: 9, resolution: 'calculated' },
        charismaModifier: { value: 2, resolution: 'calculated' },
        score: 11,
        scoreLevel: 7,
        leaderLevelLimit: 7,
        maximumLevel: 7,
      },
      overLevel: false,
    },
  });
  expect(sheet?.companionCalculationInputs).toEqual({
    kind: 'cohort',
    cohort: {
      sources: [{ sourceKey: 'leadership', counting: true }],
      linkedInputs: [
        expect.objectContaining({
          input: { kind: 'characterLevel' },
          value: 9,
        }),
        expect.objectContaining({
          input: { kind: 'abilityModifier', ability: 'charisma' },
          value: 2,
        }),
      ],
    },
  });
  // The leader's inputs never become the cohort's own statistics.
  expect(sheet?.calculated.abilities.charisma.score).toBe(10);
  expect(
    await member.query(api.companionRelationships.list, {
      characterId: cohortId,
    }),
  ).toMatchObject([
    {
      relationshipId,
      kind: 'cohort',
      role: 'associated',
      endpoint: { characterId: leaderId, name: 'Ysolde' },
      linkedInputs: [
        { input: { kind: 'characterLevel' } },
        { input: { kind: 'abilityModifier', ability: 'charisma' } },
      ],
    },
  ]);
  // The leader's own sheet has no cohort result.
  expect((await read(owner, leaderId))?.calculated.cohort).toBeNull();
});

test('Leadership modifiers recorded on the leader’s source persist across devices and over-level warns without trimming', async () => {
  const { owner, member, cohortId, relationshipId, fighterId } =
    await fixture();
  await owner.mutation(setAllocation, {
    relationshipId,
    sourceKey: 'leadership',
    leadership: {
      ...noLeadershipModifiers,
      reputation: ['cruelty'],
      hasCompanion: true,
    },
    operationId: 'owner-device',
  });
  const rows = await member.query(api.companionRelationships.list, {
    characterId: cohortId,
  });
  expect(rows[0]).toMatchObject({
    lastOperationId: 'owner-device',
    sources: [
      expect.objectContaining({
        key: 'leadership',
        ruleKind: 'cohort',
        leadershipModifiers: expect.objectContaining({
          reputation: ['cruelty'],
          hasCompanion: true,
        }),
      }),
    ],
  });
  // 9 + 2 − 2 − 2 = 7: the table allows 5th, the cohort's level.
  const reduced = await read(member, cohortId);
  expect(reduced?.calculated.cohort).toMatchObject({
    leadership: { modifierTotal: -4, score: 7, maximumLevel: 5 },
    overLevel: false,
  });
  const addLevel = (position: number) =>
    member.mutation(api.characterSheet.addClassLevel, {
      characterId: cohortId,
      classEntryId: fighterId,
      operationId: `cohort-${position}`,
    });
  // After recruitment the table is information only: a cohort advanced to
  // 7th, above the 5th its score would attract now, does not warn.
  await addLevel(6);
  await addLevel(7);
  const advanced = await read(member, cohortId);
  expect(advanced?.calculated.cohort).toMatchObject({
    equivalence: { value: 7 },
    leadership: { scoreLevel: 5, leaderLevelLimit: 7 },
    overLevel: false,
  });
  expect(advanced?.calculated.warnings).not.toContainEqual(
    expect.objectContaining({ check: 'cohortOverLevel' }),
  );
  // Class Levels are never trimmed, even past the leader's level limit.
  await addLevel(8);
  const over = await read(member, cohortId);
  expect(over?.calculated).toMatchObject({
    level: 8,
    cohort: { equivalence: { value: 8 }, overLevel: true },
  });
  expect(over?.calculated.warnings).toContainEqual(
    expect.objectContaining({ check: 'cohortOverLevel', kind: 'rules' }),
  );
  // The latest device wins and is attributed; clearing restores the base.
  await member.mutation(setAllocation, {
    relationshipId,
    sourceKey: 'leadership',
    leadership: null,
    operationId: 'member-device',
  });
  const cleared = await read(owner, cohortId);
  expect(cleared?.calculated.cohort?.leadership).toMatchObject({
    modifiers: [],
    score: 11,
    maximumLevel: 7,
  });
  expect(
    (
      await owner.query(api.companionRelationships.list, {
        characterId: cohortId,
      })
    )[0],
  ).toMatchObject({ lastOperationId: 'member-device' });
});

test('the cohort’s own sheet records a published or entered equivalence, never its Hit Dice', async () => {
  const { member, owner, cohortId, campaignId } = await fixture();
  const seeded = await owner.run((ctx) =>
    seedAcceptedCampaign(ctx, campaignId),
  );
  const facts = async () =>
    (
      await owner.query(api.canonicalLedger.read, {
        campaignId,
        militiaId: seeded.key.militiaId,
      })
    ).state.militiaSnapshot.characters.find(
      (character) => character.characterId === cohortId,
    );
  await member.mutation(setEquivalence, {
    characterId: cohortId,
    equivalence: { kind: 'published', creatureKey: 'pegasus' },
    operationId: 'pegasus',
  });
  const pegasus = await read(owner, cohortId);
  // Bestiary Monster Cohorts: pegasus 6, plus five Class Levels.
  expect(pegasus?.calculated).toMatchObject({
    level: 5,
    hitDice: 5,
    cohort: {
      equivalence: {
        basis: 'published',
        creature: 'Pegasus',
        creatureLevel: 6,
        classLevels: 5,
        value: 11,
      },
      overLevel: true,
    },
  });
  expect(pegasus?.lastOperationId).toBe('pegasus');
  // Militia Character Facts never read Cohort Equivalence: the cohort's
  // level and Hit Dice stay its five Class Levels.
  const recorded = await facts();
  expect(recorded).toMatchObject({ characterId: cohortId, level: 5 });
  expect(recorded).not.toHaveProperty('actualHitDice');
  await member.mutation(setEquivalence, {
    characterId: cohortId,
    equivalence: { kind: 'entered', creature: ' Hippogriff ', level: null },
    operationId: 'hippogriff',
  });
  const missing = await read(owner, cohortId);
  expect(missing?.calculated.cohort).toMatchObject({
    equivalence: {
      basis: 'entered',
      creature: 'Hippogriff',
      value: null,
      missing: true,
    },
    overLevel: false,
  });
  expect(missing?.calculated.warnings).toContainEqual(
    expect.objectContaining({
      check: 'cohortEquivalenceMissing',
      kind: 'unresolved',
    }),
  );
  await member.mutation(setEquivalence, {
    characterId: cohortId,
    equivalence: { kind: 'entered', creature: 'Hippogriff', level: 1 },
    operationId: 'hippogriff-level',
  });
  expect(
    (await read(owner, cohortId))?.calculated.cohort?.equivalence,
  ).toMatchObject({ creatureLevel: 1, value: 6 });
  await member.mutation(setEquivalence, {
    characterId: cohortId,
    equivalence: null,
    operationId: 'ordinary',
  });
  expect(
    (await read(owner, cohortId))?.calculated.cohort?.equivalence,
  ).toMatchObject({ basis: 'classLevels', value: 5 });
  expect(await facts()).toEqual(recorded);
});

test('unlinking or losing Leadership keeps the cohort sheet and its choices', async () => {
  const { owner, member, leaderId, cohortId, relationshipId, leadershipId } =
    await fixture();
  await member.mutation(setEquivalence, {
    characterId: cohortId,
    equivalence: { kind: 'published', creatureKey: 'worg' },
    operationId: 'worg',
  });
  await owner.mutation(setAllocation, {
    relationshipId,
    sourceKey: 'leadership',
    leadership: { ...noLeadershipModifiers, reputation: ['greatRenown'] },
    operationId: 'renown',
  });
  await owner.mutation(api.companionRelationships.interrupt, {
    relationshipId,
    operationId: 'unlink',
  });
  // An interrupted link keeps its support: the leader's values are
  // unavailable, so the allowed level is unresolved until restoration.
  const unlinked = await read(member, cohortId);
  expect(unlinked?.calculated).toMatchObject({
    level: 5,
    cohort: {
      status: 'active',
      equivalence: { basis: 'published', value: 10 },
      leadership: {
        characterLevel: { value: null, resolution: 'unresolved' },
        maximumLevel: null,
      },
      overLevel: false,
    },
  });
  await owner.mutation(api.companionRelationships.restore, {
    relationshipId,
    operationId: 'relink',
  });
  expect(
    (await read(member, cohortId))?.calculated.cohort?.leadership,
  ).toMatchObject({ modifierTotal: 2, score: 13, maximumLevel: 7 });
  // Losing the Leadership feat removes the support, not the cohort.
  await owner.mutation(api.characterSheet.editSelection, {
    characterId: leaderId,
    entryId: leadershipId,
    active: false,
    operationId: 'lose-leadership',
  });
  const lost = await read(member, cohortId);
  expect(lost?.calculated).toMatchObject({
    level: 5,
    cohort: { status: 'dormant', equivalence: { value: 10 } },
  });
  expect(
    (
      await member.query(api.companionRelationships.list, {
        characterId: cohortId,
      })
    )[0],
  ).toMatchObject({
    interruption: 'support',
    sources: [
      expect.objectContaining({
        available: false,
        leadershipModifiers: expect.objectContaining({
          reputation: ['greatRenown'],
        }),
      }),
    ],
  });
  await owner.mutation(api.characterSheet.editSelection, {
    characterId: leaderId,
    entryId: leadershipId,
    active: true,
    operationId: 'regain-leadership',
  });
  expect((await read(member, cohortId))?.calculated.cohort).toMatchObject({
    status: 'active',
    leadership: { score: 13 },
  });
});

test('a hidden leader leaks nothing, not even its Leadership modifiers, and leaves the allowed level unresolved until saved fallbacks supply it', async () => {
  const {
    t,
    owner,
    member,
    outsider,
    leaderId,
    leadershipId,
    cohortId,
    relationshipId,
    campaignId,
  } = await fixture();
  await owner.mutation(setAllocation, {
    relationshipId,
    sourceKey: 'leadership',
    leadership: {
      ...noLeadershipModifiers,
      reputation: ['fairnessAndGenerosity'],
    },
    operationId: 'fair',
  });
  await t.run((ctx) =>
    ctx.db.patch('character', leaderId, {
      campaignId: undefined,
      sheetDemo: true,
    }),
  );
  const hidden = await read(member, cohortId);
  expect(hidden?.calculated.cohort).toMatchObject({
    status: 'active',
    equivalence: { value: 5 },
    leadership: {
      characterLevel: { value: null, resolution: 'unresolved' },
      charismaModifier: { value: null, resolution: 'unresolved' },
      modifiers: [],
      modifierTotal: null,
      areModifiersUndisclosed: true,
      score: null,
      maximumLevel: null,
    },
  });
  expect(hidden?.calculated.warnings).toContainEqual(
    expect.objectContaining({ check: 'cohortLeadershipUnresolved' }),
  );
  // PRD §15: the leader's Leadership modifiers are its details, recorded
  // with write access to the leader, so neither rows nor labels leave.
  expect(hidden?.companionCalculationInputs).toEqual({
    kind: 'cohort',
    cohort: {
      sources: [{ sourceKey: 'rule:cohort', counting: true }],
      linkedInputs: expect.any(Array),
      areModifiersUndisclosed: true,
    },
  });
  const disclosed = JSON.stringify(hidden);
  for (const secret of [
    'Ysolde',
    leaderId,
    leadershipId,
    'fairnessAndGenerosity',
    'Fairness and generosity',
  ])
    expect(disclosed).not.toContain(secret);
  expect(
    await member.query(api.companionRelationships.list, {
      characterId: cohortId,
    }),
  ).toMatchObject([{ endpoint: null, sources: [] }]);
  for (const [input, value] of [
    [{ kind: 'characterLevel' as const }, 9],
    [{ kind: 'abilityModifier' as const, ability: 'charisma' as const }, 2],
  ] as const)
    await member.mutation(api.characterSheetLinkedInputs.saveFallback, {
      characterId: cohortId,
      relationshipId,
      input,
      value,
      operationId: `fallback-${input.kind}`,
    });
  // The fallbacks supply the leader's level limit, which persists after
  // recruitment; the score needs the undisclosed modifiers, so it and the
  // table level stay unresolved without warning.
  const supplied = (await read(member, cohortId))?.calculated;
  expect(supplied?.cohort).toMatchObject({
    leadership: {
      characterLevel: { value: 9, resolution: 'fallback' },
      charismaModifier: { value: 2, resolution: 'fallback' },
      modifiers: [],
      modifierTotal: null,
      areModifiersUndisclosed: true,
      score: null,
      scoreLevel: null,
      leaderLevelLimit: 7,
      maximumLevel: null,
    },
    overLevel: false,
  });
  expect(supplied?.warnings).not.toContainEqual(
    expect.objectContaining({ check: 'cohortLeadershipUnresolved' }),
  );
  expect(JSON.stringify(supplied)).not.toContain('Fairness and generosity');
  await t.run((ctx) =>
    ctx.db.patch('character', leaderId, {
      campaignId,
      sheetDemo: undefined,
    }),
  );
  // With access again, the cohort's reader sees the modifier rows.
  expect(
    (await read(member, cohortId))?.calculated.cohort?.leadership,
  ).toMatchObject({
    characterLevel: { resolution: 'calculated', fallbackState: 'suspended' },
    modifiers: [
      { key: 'fairnessAndGenerosity', label: 'Fairness and generosity' },
    ],
    modifierTotal: 1,
    areModifiersUndisclosed: false,
    score: 12,
  });
  // Outsiders read and write nothing.
  await expect(read(outsider, cohortId)).rejects.toThrow();
  await expect(
    outsider.mutation(setEquivalence, {
      characterId: cohortId,
      equivalence: { kind: 'published', creatureKey: 'worg' },
      operationId: 'outsider',
    }),
  ).rejects.toThrow();
  await expect(
    outsider.mutation(setAllocation, {
      relationshipId,
      sourceKey: 'leadership',
      leadership: noLeadershipModifiers,
      operationId: 'outsider',
    }),
  ).rejects.toThrow();
});

test('cohort writers refuse malformed choices, misplaced modifiers, maintenance and obsolete epochs', async () => {
  const { t, owner, member, cohortId, relationshipId, leaderId } =
    await fixture();
  for (const equivalence of [
    { kind: 'entered' as const, creature: 'Hippogriff', level: 0 },
    { kind: 'entered' as const, creature: 'Hippogriff', level: 1.5 },
    { kind: 'entered' as const, creature: 'Hippogriff', level: 31 },
    { kind: 'entered' as const, creature: '  ', level: 4 },
    { kind: 'entered' as const, creature: 'x'.repeat(65), level: 4 },
  ])
    await expect(
      member.mutation(setEquivalence, {
        characterId: cohortId,
        equivalence,
        operationId: 'malformed',
      }),
    ).rejects.toThrow('Cohort Equivalence');
  for (const leadership of [
    { ...noLeadershipModifiers, cohortDeaths: -1 },
    { ...noLeadershipModifiers, cohortDeaths: 1.5 },
    { ...noLeadershipModifiers, other: 21 },
    {
      ...noLeadershipModifiers,
      reputation: ['cruelty' as const, 'cruelty' as const],
    },
  ])
    await expect(
      owner.mutation(setAllocation, {
        relationshipId,
        sourceKey: 'leadership',
        leadership,
        operationId: 'malformed',
      }),
    ).rejects.toThrow('Leadership modifiers');
  await expect(
    owner.mutation(setAllocation, {
      relationshipId,
      sourceKey: 'leadership',
      leadership: noLeadershipModifiers,
      levels: 2,
      operationId: 'both',
    }),
  ).rejects.toThrow('Record either');
  const familiar = await owner.mutation(api.companionRelationships.create, {
    associatedCharacterId: leaderId,
    kind: 'familiar',
    name: 'Cat',
    sources: [{ key: 'bond', label: 'Arcane bond', enabled: true }],
    operationId: 'familiar',
  });
  await expect(
    owner.mutation(setAllocation, {
      relationshipId: familiar.relationshipId,
      sourceKey: 'bond',
      leadership: noLeadershipModifiers,
      operationId: 'misplaced',
    }),
  ).rejects.toThrow('supports a cohort');
  const controlId = await t.run(async (ctx) => {
    const runId = await ctx.db.insert('initialMigrationRun', {
      operationId: 'migration',
      epoch: 1,
      state: 'maintenance',
      frontendBuild: 'build',
      catalogManifest: 'catalog',
      startedAt: 0,
      deadline: 60000,
    });
    return ctx.db.insert('initialMigrationControl', {
      key: 'character-sheet',
      epoch: 1,
      closed: true,
      authority: 'legacy',
      runId,
    });
  });
  const writes = [
    () =>
      member.mutation(setEquivalence, {
        characterId: cohortId,
        equivalence: { kind: 'published', creatureKey: 'worg' },
        operationId: 'gated',
      }),
    () =>
      owner.mutation(setAllocation, {
        relationshipId,
        sourceKey: 'leadership',
        leadership: noLeadershipModifiers,
        operationId: 'gated',
      }),
  ];
  for (const write of writes)
    await expect(write()).rejects.toThrow('MAINTENANCE');
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationControl', controlId, { closed: false }),
  );
  for (const write of writes)
    await expect(write()).rejects.toThrow('RELOAD_REQUIRED');
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationControl', controlId, {
      epoch: 0,
      authority: 'sheet',
    }),
  );
  for (const write of writes) await expect(write()).rejects.toThrow();
  const sheet = await read(owner, cohortId);
  expect(sheet?.calculated.cohort?.equivalence.basis).toBe('classLevels');
  const rows = await owner.query(api.companionRelationships.list, {
    characterId: cohortId,
  });
  expect(rows[0]?.sources[0]).not.toHaveProperty('leadershipModifiers');
});

test('the seeded Leadership feat is browse-only representative content', async () => {
  const { owner, leaderId } = await fixture();
  const leadership = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId: leaderId }),
  )?.catalogEntries.find((entry) => entry.ruleIdentity === 'leadership');
  expect(leadership).toMatchObject({
    name: 'Leadership',
    browseOnly: true,
    prerequisites: [{ characterLevel: 7 }],
    sources: [{ book: 'Pathfinder RPG Core Rulebook', pages: '129' }],
  });
});

type Client = ReturnType<ReturnType<typeof convexTest>['withIdentity']>;
function read(client: Client, characterId: Id<'character'>) {
  return client.query(api.characterSheet.read, { characterId });
}

async function fixture() {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    for (const tokenIdentifier of [
      'test|owner',
      'test|member',
      'test|outsider',
    ])
      await ctx.db.insert('user', {
        tokenIdentifier,
        orgIds:
          tokenIdentifier === 'test|outsider'
            ? []
            : [{ orgId: 'org', role: 'member' }],
        characterSheetDemo: true,
      });
  });
  const owner = t.withIdentity({ tokenIdentifier: 'test|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'test|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'test|outsider' });
  const campaignId = await owner.mutation(api.campaign.createCampaign, {
    name: 'Ironfang',
    description: '',
    organizationId: 'org',
  });
  await t.run((ctx) =>
    ctx.db.patch('campaign', campaignId, {
      e2eFixture: {
        namespace: 'cohorts',
        version: 1,
        workerKey: '0',
        caseKey: 'cohorts',
        campaignKey: 'cohorts',
      },
    }),
  );
  async function fighterSheet(client: Client, name: string, levels: number) {
    const characterId = await client.mutation(api.characterSheet.create, {
      campaignId,
      organizationId: 'org',
      name,
      kind: 'pc',
      operationId: name,
    });
    const created = withSheetCatalog(
      await client.query(api.characterSheet.read, { characterId }),
    );
    const fighter = created?.catalogEntries.find(
      (entry) => entry.ruleIdentity === 'fighter',
    );
    const initial = created?.entries.find(
      (entry) => entry.kind === 'classLevel',
    );
    if (!fighter || !initial) throw new Error('Missing seeded fighter');
    await client.mutation(api.characterSheet.editClassLevel, {
      characterId,
      entryId: initial._id,
      classEntryId: fighter._id,
      hpGained: 10,
      operationId: `${name}-1`,
    });
    for (let position = 2; position <= levels; position++)
      await client.mutation(api.characterSheet.addClassLevel, {
        characterId,
        classEntryId: fighter._id,
        operationId: `${name}-${position}`,
      });
    return { characterId, fighterId: fighter._id, created };
  }
  const leader = await fighterSheet(owner, 'Ysolde', 9);
  const leaderId = leader.characterId;
  await owner.mutation(api.characterSheet.editBaseScores, {
    characterId: leaderId,
    scores: {
      strength: 14,
      dexterity: 12,
      constitution: 12,
      intelligence: 10,
      wisdom: 10,
      charisma: 14,
    },
    operationId: 'leader-scores',
  });
  const leadershipDefinition = leader.created?.catalogEntries.find(
    (entry) => entry.ruleIdentity === 'leadership',
  );
  if (!leadershipDefinition) throw new Error('Missing seeded Leadership');
  const leadershipId = await owner.mutation(api.characterSheet.selectEntry, {
    characterId: leaderId,
    catalogEntryId: leadershipDefinition._id,
    operationId: 'leadership-feat',
  });
  const cohort = await fighterSheet(member, 'Bryn', 5);
  const cohortId = cohort.characterId;
  const relationshipId = await member.mutation(
    api.companionRelationships.link,
    {
      associatedCharacterId: leaderId,
      companionCharacterId: cohortId,
      kind: 'cohort',
      sources: [
        {
          key: 'leadership',
          label: 'Leadership',
          sheetEntryId: leadershipId,
          enabled: true,
        },
      ],
      operationId: 'link-cohort',
    },
  );
  return {
    t,
    owner,
    member,
    outsider,
    campaignId,
    leaderId,
    leadershipId,
    cohortId,
    relationshipId,
    fighterId: cohort.fighterId,
  };
}
