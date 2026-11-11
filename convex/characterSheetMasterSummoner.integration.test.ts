// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { expect, test, vi } from 'vitest';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import schema from './schema';
import { seedAcceptedCampaign } from './lib/acceptedCampaignFixture';
import { withSheetCatalog } from '../tests/character-sheet-catalog';

const modules = import.meta.glob('./**/*.ts');
// Each case builds a summoner of up to 20 levels and a linked eidolon; under
// a full parallel run that setup alone can exceed the local 5s default.
vi.setConfig({ testTimeout: 20_000 });
const setArchetype = api.characterSheet.setArchetypeSelected;

// Ultimate Magic p. 80, Master Summoner, Lesser Eidolon: "A master
// summoner's class level is halved (minimum 1) for the purposes of
// determining his eidolon's abilities, Hit Dice, evolution pool, and so on."
// Every build uses the seeded, browse-only Summoner and Master Summoner.

test('a master summoner’s eidolon reads the halved summoner level at 1st, 7th and 20th level', async () => {
  const { owner, member, campaignId, characterId, eidolonId, levelUp } =
    await fixture(1);
  const seeded = await owner.run((ctx) =>
    seedAcceptedCampaign(ctx, campaignId),
  );
  // Level 1 → level 1 row (the minimum): HD 1, BAB +1, Evolution Pool 3.
  expect((await read(member, eidolonId))?.calculated).toMatchObject({
    level: 0,
    classLevels: [],
    hitDice: 1,
    derivedStatistics: { bab: { total: 1 } },
    companionProgression: {
      status: 'active',
      effectiveLevel: 1,
      evolutionPool: { total: 3 },
      contributions: [
        {
          kind: 'reduced',
          ruleKind: 'masterSummonerEidolon',
          classLevels: 1,
          effectiveLevel: 1,
          reduction: {
            steps: [
              { kind: 'divide', operand: 2, result: 0 },
              { kind: 'minimum', operand: 1, result: 1 },
            ],
          },
        },
      ],
    },
  });
  await levelUp(7);
  // Level 7 → level 3 row: HD 3, BAB +3, Feats 2, Evolution Pool 5, rather
  // than the ordinary 6 HD and 10 points.
  const seventh = await read(member, eidolonId);
  expect(seventh?.calculated).toMatchObject({
    hitDice: 3,
    // 10 recorded + Con +1 per HD.
    hp: 13,
    derivedStatistics: { bab: { total: 3 }, fortitude: { total: 4 } },
    budgets: { generalFeats: 2, skillRanks: 12, skillRankCap: 3 },
    companionProgression: {
      effectiveLevel: 3,
      evolutionPool: { total: 5 },
      contributions: [{ classLevels: 7, effectiveLevel: 3 }],
      sources: expect.arrayContaining([
        expect.objectContaining({
          book: 'Pathfinder RPG Ultimate Magic',
          pages: '80',
        }),
      ]),
    },
  });
  expect(seventh?.companionCalculationInputs).toMatchObject({
    companionProgressionSources: [
      { ruleKind: 'masterSummonerEidolon', counting: true },
    ],
  });
  // The summoner keeps its actual Class Levels; only the eidolon's row is
  // reduced.
  expect((await read(owner, characterId))?.calculated).toMatchObject({
    level: 7,
    hitDice: 7,
  });
  // Militia Character Facts read the eidolon's actual, reduced Hit Dice,
  // published with the eidolon's own write as in the other companion tests.
  await member.mutation(api.characterSheet.setCompanionProgression, {
    characterId: eidolonId,
    operationId: 'publish-seventh',
    progression: { ...biped, hpGained: 12 },
  });
  const ledger = await owner.query(api.canonicalLedger.read, {
    campaignId,
    militiaId: seeded.key.militiaId,
  });
  expect(ledger.state.militiaSnapshot.characters).toContainEqual(
    expect.objectContaining({
      characterId: eidolonId,
      level: 0,
      actualHitDice: 3,
    }),
  );
  await levelUp(20);
  // Level 20 → level 10 row: HD 8, BAB +8, Evolution Pool 14.
  expect((await read(member, eidolonId))?.calculated).toMatchObject({
    hitDice: 8,
    derivedStatistics: { bab: { total: 8 } },
    companionProgression: {
      effectiveLevel: 10,
      evolutionPool: { total: 14 },
      budgets: { abilityIncreases: 2, maxAttacks: 5 },
    },
  });
});

test('losing a summoner level or the Archetype keeps every choice, and restoring it restores the same results', async () => {
  const {
    owner,
    member,
    characterId,
    eidolonId,
    summonerId,
    masterSummonerId,
    levelIds,
    levelUp,
  } = await fixture(8);
  await member.mutation(api.characterSheet.setCompanionProgression, {
    characterId: eidolonId,
    operationId: 'evolutions',
    progression: {
      ...biped,
      // 4 + 1 + 1 points; the large evolution needs summoner level 8.
      evolutions: [{ key: 'large' }, { key: 'bite' }, { key: 'reach' }],
    },
  });
  const before = (await read(member, eidolonId))?.calculated;
  // Level 8 → level 4 row: HD 3, Evolution Pool 7.
  expect(before).toMatchObject({
    hitDice: 3,
    companionProgression: {
      effectiveLevel: 4,
      evolutionPool: { total: 7, spent: 6 },
    },
  });
  expect(
    before?.companionProgression?.kind === 'eidolon' &&
      before.companionProgression.evolutions.find(({ key }) => key === 'large')
        ?.issues,
  ).toEqual(['Requires summoner level 8.']);
  const last = levelIds.at(-1);
  if (!last) throw new Error('Missing last summoner level');
  await owner.mutation(api.characterSheet.deleteClassLevel, {
    characterId,
    entryId: last,
    operationId: 'lose-level',
  });
  // Level 7 → level 3 row: HD 3, Evolution Pool 5, over by one point.
  const reduced = (await read(member, eidolonId))?.calculated;
  expect(reduced).toMatchObject({
    hitDice: 3,
    companionProgression: {
      effectiveLevel: 3,
      evolutionPool: { total: 5, spent: 6, remaining: -1 },
      contributions: [{ classLevels: 7, effectiveLevel: 3 }],
    },
  });
  expect(reduced?.warnings).toContainEqual(
    expect.objectContaining({ check: 'eidolonEvolutionPoolBudget' }),
  );
  await levelUp(8);
  expect(
    (await read(member, eidolonId))?.calculated.companionProgression,
  ).toEqual(before?.companionProgression);
  const select = (selected: boolean) =>
    owner.mutation(setArchetype, {
      characterId,
      classEntryId: summonerId,
      catalogEntryId: masterSummonerId,
      selected,
      operationId: `master-summoner-${selected}`,
    });
  await select(false);
  // An ordinary 8th-level summoner: the whole level 8 row, HD 6, 11 points.
  expect((await read(member, eidolonId))?.calculated).toMatchObject({
    hitDice: 6,
    companionProgression: {
      effectiveLevel: 8,
      evolutionPool: { total: 11, spent: 6 },
      contributions: [{ kind: 'ordinary', ruleKind: 'eidolon' }],
    },
  });
  await select(true);
  expect(
    (await read(member, eidolonId))?.calculated.companionProgression,
  ).toEqual(before?.companionProgression);
});

test('Broodmaster and Master Summoner on one summoner stay an unresolved conflict that keeps every share', async () => {
  const {
    t,
    owner,
    member,
    campaignId,
    characterId,
    eidolonId,
    relationshipId,
    summonerId,
    masterSummonerId,
    broodmasterId,
  } = await fixture(7);
  const selectArchetype = (catalogEntryId: Id<'catalogEntry'>, on: boolean) =>
    owner.mutation(setArchetype, {
      characterId,
      classEntryId: summonerId,
      catalogEntryId,
      selected: on,
      operationId: `${catalogEntryId}-${on}`,
    });
  // A Broodmaster eidolon with its recorded share first.
  await selectArchetype(masterSummonerId, false);
  await selectArchetype(broodmasterId, true);
  await member.mutation(api.companionRelationships.setSourceAllocation, {
    relationshipId,
    sourceKey: 'eidolon',
    components: share,
    operationId: 'share',
  });
  expect(
    (await read(member, eidolonId))?.calculated.companionProgression,
  ).toMatchObject({
    status: 'active',
    hitDice: 3,
    contributions: [{ kind: 'component', ruleKind: 'broodmasterEidolon' }],
  });
  await selectArchetype(masterSummonerId, true);
  const conflicted = (await read(member, eidolonId))?.calculated;
  expect(conflicted).toMatchObject({
    hitDice: null,
    companionProgression: {
      status: 'unresolved',
      effectiveLevel: null,
      brood: null,
      contributions: [
        {
          kind: 'ordinary',
          ruleKind: 'eidolon',
          classLevels: 7,
          effectiveLevel: null,
          ruleConflict: {
            disclosure: 'disclosed',
            ruleKinds: ['broodmasterEidolon', 'masterSummonerEidolon'],
          },
        },
      ],
    },
  });
  expect(conflicted?.warnings).toContainEqual(
    expect.objectContaining({
      check: 'companionProgressionRuleConflict',
      message: expect.stringContaining('Broodmaster and Master Summoner'),
    }),
  );
  // No rule wins: a component share cannot be written meanwhile, and the
  // recorded one is kept.
  await expect(
    member.mutation(api.companionRelationships.setSourceAllocation, {
      relationshipId,
      sourceKey: 'eidolon',
      components: share,
      operationId: 'conflicting-share',
    }),
  ).rejects.toThrow('divides components');
  const rows = await owner.query(api.companionRelationships.list, {
    characterId: eidolonId,
  });
  expect(rows[0]?.sources[0]).toMatchObject({
    ruleKind: 'eidolon',
    ruleConflicts: ['broodmasterEidolon', 'masterSummonerEidolon'],
    allocatedComponents: share,
  });
  // A source write stores the conflict with the declaration, so a reader
  // without access to the summoner still sees that rules conflict, but not
  // which: the competing Archetypes are the summoner's details (PRD §15).
  await owner.mutation(api.companionRelationships.setSourceEnabled, {
    relationshipId,
    sourceKey: 'eidolon',
    enabled: true,
    operationId: 'refresh-declaration',
  });
  await t.run((ctx) =>
    ctx.db.patch('character', characterId, {
      campaignId: undefined,
      sheetDemo: true,
    }),
  );
  const hiddenSheet = await read(member, eidolonId);
  const hidden = hiddenSheet?.calculated;
  expect(hidden).toMatchObject({
    companionProgression: {
      status: 'unresolved',
      effectiveLevel: null,
      contributions: [
        {
          sourceKey: 'rule:eidolon',
          ruleKind: 'eidolon',
          effectiveLevel: null,
          ruleConflict: { disclosure: 'undisclosed' },
        },
      ],
    },
  });
  expect(hidden?.warnings).toContainEqual(
    expect.objectContaining({
      check: 'companionProgressionRuleConflict',
      kind: 'unresolved',
    }),
  );
  // The eidolon's own browse-only catalog lists every seeded Archetype; the
  // calculation and its inputs name none of the summoner's.
  const disclosed = JSON.stringify([
    hidden,
    hiddenSheet?.permanentCalculated,
    hiddenSheet?.companionCalculationInputs,
  ]);
  for (const secret of [
    'Calder',
    'broodmasterEidolon',
    'masterSummonerEidolon',
    'Broodmaster',
    'Master Summoner',
  ])
    expect(disclosed).not.toContain(secret);
  // A saved summoner level never resolves the conflicting source.
  await member.mutation(api.characterSheetLinkedInputs.saveFallback, {
    characterId: eidolonId,
    relationshipId,
    input: { kind: 'classLevels', classRuleIdentity: 'summoner' },
    value: 7,
    operationId: 'fallback-summoner',
  });
  expect(
    (await read(member, eidolonId))?.calculated.companionProgression,
  ).toMatchObject({
    status: 'unresolved',
    effectiveLevel: null,
    contributions: [
      { classLevels: 7, ruleConflict: { disclosure: 'undisclosed' } },
    ],
  });
  await t.run((ctx) =>
    ctx.db.patch('character', characterId, {
      campaignId,
      sheetDemo: undefined,
    }),
  );
  // Restored access discloses the competing rules again.
  const restored = (await read(member, eidolonId))?.calculated;
  expect(restored?.companionProgression?.contributions).toMatchObject([
    {
      ruleConflict: {
        disclosure: 'disclosed',
        ruleKinds: ['broodmasterEidolon', 'masterSummonerEidolon'],
      },
    },
  ]);
  expect(restored?.warnings).toContainEqual(
    expect.objectContaining({
      check: 'companionProgressionRuleConflict',
      message: expect.stringContaining('Broodmaster and Master Summoner'),
    }),
  );
  // Turning one Archetype off resolves the conflict; the other's results and
  // the recorded share return.
  await selectArchetype(masterSummonerId, false);
  expect(
    (await read(member, eidolonId))?.calculated.companionProgression,
  ).toMatchObject({
    status: 'active',
    brood: { components: share },
  });
  await selectArchetype(masterSummonerId, true);
  await selectArchetype(broodmasterId, false);
  expect((await read(member, eidolonId))?.calculated).toMatchObject({
    hitDice: 3,
    companionProgression: {
      status: 'active',
      effectiveLevel: 3,
      brood: null,
      contributions: [{ kind: 'reduced', classLevels: 7 }],
    },
  });
});

test('a source supplied by a turned-off Broodmaster Selection joins no rule conflict', async () => {
  const { owner, member, campaignId, characterId, summonerId, broodmasterId } =
    await fixture(7);
  await owner.mutation(setArchetype, {
    characterId,
    classEntryId: summonerId,
    catalogEntryId: broodmasterId,
    selected: true,
    operationId: 'broodmaster-on',
  });
  const summoner = await read(owner, characterId);
  const selection = summoner?.entries.find(
    (entry) =>
      entry.kind === 'archetype' &&
      summoner.catalogEntries.find(
        (catalog) => catalog._id === entry.catalogEntryId,
      )?.ruleIdentity === 'summoner-broodmaster',
  );
  if (!selection) throw new Error('Missing Broodmaster Selection');
  const companionId = await classlessEidolon(member, campaignId, 'Moth');
  await owner.mutation(api.companionRelationships.link, {
    associatedCharacterId: characterId,
    companionCharacterId: companionId,
    kind: 'eidolon',
    sources: [
      {
        key: 'brood',
        label: 'Brood',
        sheetEntryId: selection._id,
        enabled: true,
      },
    ],
    operationId: 'link-moth',
  });
  const sourceRules = async () =>
    (
      await owner.query(api.companionRelationships.list, {
        characterId: companionId,
      })
    )[0]?.sources[0];
  // While both Archetypes are active, the Selection's source competes.
  expect(await sourceRules()).toMatchObject({
    ruleKind: 'eidolon',
    ruleConflicts: ['broodmasterEidolon', 'masterSummonerEidolon'],
  });
  await owner.mutation(setArchetype, {
    characterId,
    classEntryId: summonerId,
    catalogEntryId: broodmasterId,
    selected: false,
    operationId: 'broodmaster-off',
  });
  // Turned off, it is a dormant Broodmaster source with no conflict.
  const dormant = await sourceRules();
  expect(dormant).toMatchObject({ ruleKind: 'broodmasterEidolon' });
  expect(dormant).not.toHaveProperty('ruleConflicts');
});

test('a hidden summoner leaves the eidolon unresolved until a saved summoner level fallback is halved', async () => {
  const {
    t,
    owner,
    member,
    campaignId,
    characterId,
    eidolonId,
    relationshipId,
  } = await fixture(9);
  await t.run((ctx) =>
    ctx.db.patch('character', characterId, {
      campaignId: undefined,
      sheetDemo: true,
    }),
  );
  const hidden = await read(member, eidolonId);
  expect(hidden?.calculated).toMatchObject({
    hitDice: null,
    companionProgression: {
      status: 'unresolved',
      effectiveLevel: null,
      contributions: [
        {
          kind: 'reduced',
          sourceKey: 'rule:masterSummonerEidolon',
          classLevels: null,
          reduction: { steps: [] },
        },
      ],
    },
  });
  expect(JSON.stringify(hidden)).not.toContain('Calder');
  // The fallback replaces the unavailable input, the summoner level; the
  // reduction still applies after it.
  await member.mutation(api.characterSheetLinkedInputs.saveFallback, {
    characterId: eidolonId,
    relationshipId,
    input: { kind: 'classLevels', classRuleIdentity: 'summoner' },
    value: 9,
    operationId: 'fallback-summoner',
  });
  expect((await read(member, eidolonId))?.calculated).toMatchObject({
    hitDice: 3,
    companionProgression: {
      status: 'active',
      effectiveLevel: 4,
      contributions: [
        {
          classLevels: 9,
          effectiveLevel: 4,
          resolution: 'fallback',
          fallbackState: 'applied',
        },
      ],
    },
  });
  await t.run((ctx) =>
    ctx.db.patch('character', characterId, {
      campaignId,
      sheetDemo: undefined,
    }),
  );
  expect(
    (await read(owner, eidolonId))?.calculated.companionProgression,
  ).toMatchObject({
    effectiveLevel: 4,
    contributions: [
      {
        sourceKey: 'eidolon',
        classLevels: 9,
        resolution: 'calculated',
        fallbackState: 'suspended',
      },
    ],
  });
});

test('the seeded Lesser Eidolon Grant supports a reduced eidolon, shown on both sheets', async () => {
  const { owner, member, campaignId, characterId } = await fixture(6);
  const summoner = await read(owner, characterId);
  const grant = summoner?.calculated.resolvedEntries.find(
    ({ entry }) =>
      'grantKey' in entry &&
      entry.grantKey?.source === 'summoner-master-summoner' &&
      summoner.catalogEntries.find(
        (catalog) =>
          'catalogEntryId' in entry && catalog._id === entry.catalogEntryId,
      )?.ruleIdentity === 'summoner-master-summoner-lesser-eidolon',
  )?.entry;
  const grantKey = grant && 'grantKey' in grant ? grant.grantKey : undefined;
  if (!grantKey) throw new Error('Missing Lesser Eidolon Grant');
  const companionId = await classlessEidolon(member, campaignId, 'Wisp');
  await owner.mutation(api.companionRelationships.link, {
    associatedCharacterId: characterId,
    companionCharacterId: companionId,
    kind: 'eidolon',
    sources: [
      { key: 'lesser', label: 'Lesser Eidolon', grantKey, enabled: true },
    ],
    operationId: 'link-wisp',
  });
  await member.mutation(api.characterSheet.setCompanionProgression, {
    characterId: companionId,
    operationId: 'wisp',
    progression: biped,
  });
  expect((await read(member, companionId))?.calculated).toMatchObject({
    hitDice: 3,
    companionProgression: {
      effectiveLevel: 3,
      contributions: [
        { kind: 'reduced', ruleKind: 'masterSummonerEidolon', classLevels: 6 },
      ],
    },
  });
  const rows = await owner.query(api.companionRelationships.list, {
    characterId,
  });
  expect(rows).toContainEqual(
    expect.objectContaining({
      role: 'companion',
      sources: [expect.objectContaining({ ruleKind: 'masterSummonerEidolon' })],
    }),
  );
});

test('an Unchained summoner’s eidolon reports Master Summoner without halving its level', async () => {
  const { owner, member, campaignId } = await fixture(1);
  const characterId = await owner.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Sela',
    kind: 'pc',
    operationId: 'sela',
  });
  const sheet = withSheetCatalog(await read(owner, characterId));
  const definition = (ruleIdentity: string) => {
    const found = sheet?.catalogEntries.find(
      (entry) => entry.ruleIdentity === ruleIdentity,
    );
    if (!found) throw new Error(`Missing seeded ${ruleIdentity}`);
    return found._id;
  };
  const unchainedSummonerId = definition('unchained-summoner');
  const initial = sheet?.entries.find((entry) => entry.kind === 'classLevel');
  if (!initial) throw new Error('Missing initial level');
  await owner.mutation(api.characterSheet.editClassLevel, {
    characterId,
    entryId: initial._id,
    classEntryId: unchainedSummonerId,
    hpGained: 8,
    operationId: 'unchained-one',
  });
  for (let position = 2; position <= 7; position++)
    await owner.mutation(api.characterSheet.addClassLevel, {
      characterId,
      classEntryId: unchainedSummonerId,
      operationId: `unchained-${position}`,
    });
  await owner.mutation(setArchetype, {
    characterId,
    classEntryId: unchainedSummonerId,
    catalogEntryId: definition('summoner-master-summoner'),
    selected: true,
    operationId: 'unchained-master-summoner',
  });
  const companionId = await classlessEidolon(member, campaignId, 'Ixa');
  await owner.mutation(api.companionRelationships.link, {
    associatedCharacterId: characterId,
    companionCharacterId: companionId,
    kind: 'unchainedEidolon',
    sources: [
      {
        key: 'eidolon',
        label: 'Eidolon',
        sheetEntryId: initial._id,
        enabled: true,
      },
    ],
    operationId: 'link-ixa',
  });
  await member.mutation(api.characterSheet.setCompanionProgression, {
    characterId: companionId,
    operationId: 'ixa',
    progression: { ...biped, version: 'unchained', subtype: 'angel' },
  });
  const read7 = (await read(member, companionId))?.calculated;
  // Unchained Eidolon Base Statistics at 7th level: HD 6.
  expect(read7).toMatchObject({
    hitDice: 6,
    companionProgression: {
      status: 'active',
      effectiveLevel: 7,
      unsupportedArchetypes: ['Master Summoner'],
      contributions: [{ kind: 'ordinary', ruleKind: 'unchainedEidolon' }],
    },
  });
  expect(read7?.warnings).toContainEqual(
    expect.objectContaining({ check: 'eidolonUnchainedArchetype' }),
  );
});

type Client = ReturnType<ReturnType<typeof convexTest>['withIdentity']>;
function read(client: Client, characterId: Id<'character'>) {
  return client.query(api.characterSheet.read, { characterId });
}

const biped = {
  kind: 'eidolon' as const,
  baseForm: 'biped' as const,
  size: 'medium' as const,
  hpGained: 10,
  skillRanks: {},
  abilityIncreases: [],
  classSkills: [],
  armorBonusAsArmor: 0,
  evolutions: [],
  keep: false,
};
// A Broodmaster share of the 7th-level brood.
const share = {
  hitDice: 3,
  skillRanks: 12,
  feats: 1,
  armorBonus: 3,
  strengthBonus: 1,
  dexterityBonus: 2,
  evolutionPoints: 5,
  maxAttacks: 2,
};

async function classlessEidolon(
  member: Client,
  campaignId: Id<'campaign'>,
  name: string,
) {
  const companionId = await member.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name,
    kind: 'npc',
    operationId: name,
  });
  const companion = await read(member, companionId);
  const unwanted = companion?.entries.find(
    (entry) => entry.kind === 'classLevel',
  );
  if (!unwanted) throw new Error('Missing companion level');
  await member.mutation(api.characterSheet.deleteClassLevel, {
    characterId: companionId,
    entryId: unwanted._id,
    operationId: `classless-${name}`,
  });
  // APG Biped base form scores.
  await member.mutation(api.characterSheet.editBaseScores, {
    characterId: companionId,
    scores: {
      strength: 16,
      dexterity: 12,
      constitution: 13,
      intelligence: 7,
      wisdom: 10,
      charisma: 11,
    },
    operationId: `scores-${name}`,
  });
  return companionId;
}

async function fixture(summonerLevel: number) {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    for (const tokenIdentifier of ['test|owner', 'test|member'])
      await ctx.db.insert('user', {
        tokenIdentifier,
        orgIds: [{ orgId: 'org', role: 'member' }],
        characterSheetDemo: true,
      });
  });
  const owner = t.withIdentity({ tokenIdentifier: 'test|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'test|member' });
  const campaignId = await owner.mutation(api.campaign.createCampaign, {
    name: 'Ironfang',
    description: '',
    organizationId: 'org',
  });
  await t.run((ctx) =>
    ctx.db.patch('campaign', campaignId, {
      e2eFixture: {
        namespace: 'master-summoner',
        version: 1,
        workerKey: '0',
        caseKey: 'master-summoner',
        campaignKey: 'master-summoner',
      },
    }),
  );
  const characterId = await owner.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Calder',
    kind: 'pc',
    operationId: 'calder',
  });
  const seeded = withSheetCatalog(await read(owner, characterId));
  const definition = (ruleIdentity: string) => {
    const found = seeded?.catalogEntries.find(
      (entry) => entry.ruleIdentity === ruleIdentity,
    );
    if (!found) throw new Error(`Missing seeded ${ruleIdentity}`);
    return found;
  };
  const masterSummoner = definition('summoner-master-summoner');
  expect(masterSummoner.browseOnly).toBe(true);
  const summonerId = definition('summoner')._id;
  const masterSummonerId = masterSummoner._id;
  const broodmasterId = definition('summoner-broodmaster')._id;
  const initial = seeded?.entries.find((entry) => entry.kind === 'classLevel');
  if (!initial) throw new Error('Missing initial level');
  await owner.mutation(api.characterSheet.editClassLevel, {
    characterId,
    entryId: initial._id,
    classEntryId: summonerId,
    hpGained: 8,
    operationId: 'summoner-one',
  });
  /**
   * Seeds summoner levels up to `to` in one write, then adds the last with
   * `addClassLevel` so the sheet records the change. Returns the summoner
   * Class Levels in level order.
   */
  const levelUp = async (to: number) => {
    const seeded = await t.run(async (ctx) => {
      const levels = (
        await ctx.db
          .query('characterSheetEntry')
          .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
          .collect()
      ).flatMap((entry) => (entry.kind === 'classLevel' ? [entry] : []));
      const ids = levels
        .sort((a, b) => a.state.position - b.state.position)
        .map(({ _id }) => _id);
      for (let position = ids.length + 1; position < to; position++)
        ids.push(
          await ctx.db.insert('characterSheetEntry', {
            characterId,
            kind: 'classLevel',
            active: true,
            state: {
              kind: 'classLevel',
              classEntryId: summonerId,
              position,
              hpGained: null,
            },
          }),
        );
      return ids;
    });
    if (seeded.length >= to) return seeded;
    const last = await owner.mutation(api.characterSheet.addClassLevel, {
      characterId,
      classEntryId: summonerId,
      operationId: `level-${to}`,
    });
    return [...seeded, last];
  };
  const levelIds = await levelUp(summonerLevel);
  await owner.mutation(setArchetype, {
    characterId,
    classEntryId: summonerId,
    catalogEntryId: masterSummonerId,
    selected: true,
    operationId: 'master-summoner',
  });
  const eidolonId = await classlessEidolon(member, campaignId, 'Brightwing');
  const relationshipId = await owner.mutation(api.companionRelationships.link, {
    associatedCharacterId: characterId,
    companionCharacterId: eidolonId,
    kind: 'eidolon',
    sources: [
      {
        key: 'eidolon',
        label: 'Eidolon',
        sheetEntryId: initial._id,
        enabled: true,
      },
    ],
    operationId: 'link',
  });
  await member.mutation(api.characterSheet.setCompanionProgression, {
    characterId: eidolonId,
    operationId: 'brightwing',
    progression: biped,
  });
  return {
    t,
    owner,
    member,
    campaignId,
    characterId,
    eidolonId,
    relationshipId,
    summonerId,
    masterSummonerId,
    broodmasterId,
    levelIds,
    levelUp,
  };
}
