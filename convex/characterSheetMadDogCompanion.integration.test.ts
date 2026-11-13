// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

// #716 E3, party character 4: a Barbarian 8 with the Mad Dog archetype (Animal
// Archive p. 9) has a war beast at effective druid level 8, the barbarian
// level with no offset (PCGen anar_abilities_class.lst:81), so 7 HD (CRB
// Table 3–8). The catalog rows aren't admitted yet, so the class and the
// archetype are seeded under the keys an import gives them: the Foundry
// barbarian and E1's frozen #716 identity.
test('a Mad Dog barbarian 8’s war beast advances at effective druid level 8, and none without the archetype', async () => {
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
        namespace: 'mad-dog-companion',
        version: 1,
        workerKey: '0',
        caseKey: 'mad-dog-companion',
        campaignKey: 'mad-dog-companion',
      },
    }),
  );
  const characterId = await owner.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Mad Dog',
    kind: 'pc',
    operationId: 'mad-dog',
  });
  const { barbarian, madDog } = await t.run(async (ctx) => {
    const barbarian = await ctx.db.insert('catalogEntry', {
      characterId,
      scope: 'character',
      name: 'Barbarian',
      ruleIdentity: 'pf1/g3pq7xWWdUVYw6ai',
      sources: [{ book: 'Pathfinder RPG Core Rulebook', pages: '31–34' }],
      modifiers: [],
      stacksWithItself: false,
      detail: {
        kind: 'class',
        classKind: 'base',
        hitDie: 12,
        bab: 'full',
        saves: { fort: 'good', ref: 'poor', will: 'poor' },
        skillRanksPerLevel: 4,
        classSkills: [],
        featuresByLevel: [],
        picksByLevel: [],
      },
    });
    const madDog = await ctx.db.insert('catalogEntry', {
      characterId,
      scope: 'character',
      name: 'Mad Dog',
      ruleIdentity: 'everythingpath/barbarian-mad-dog',
      sources: [
        { book: 'Pathfinder Player Companion: Animal Archive', pages: '9' },
      ],
      modifiers: [],
      stacksWithItself: false,
      detail: {
        kind: 'archetype',
        classEntryIds: [barbarian],
        replaces: [],
        adds: [],
      },
    });
    return { barbarian, madDog };
  });
  const initial = (
    await owner.query(api.characterSheet.read, { characterId })
  )?.entries.find((entry) => entry.kind === 'classLevel');
  if (!initial) throw new Error('Missing initial level');
  await owner.mutation(api.characterSheet.editClassLevel, {
    characterId,
    entryId: initial._id,
    classEntryId: barbarian,
    hpGained: 12,
    operationId: 'barbarian-1',
  });
  for (let position = 2; position <= 8; position++)
    await owner.mutation(api.characterSheet.addClassLevel, {
      characterId,
      classEntryId: barbarian,
      operationId: `barbarian-${position}`,
    });
  const selectMadDog = (selected: boolean) =>
    owner.mutation(api.characterSheet.setArchetypeSelected, {
      characterId,
      classEntryId: barbarian,
      catalogEntryId: madDog,
      selected,
      operationId: `mad-dog-${selected}`,
    });
  await selectMadDog(true);
  const firstLevel = (
    await owner.query(api.characterSheet.read, { characterId })
  )?.entries.find(
    (entry) => entry.kind === 'classLevel' && entry.state.position === 1,
  );
  if (!firstLevel) throw new Error('Missing first level');
  const companionId = await member.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Tyrannosaurus',
    kind: 'npc',
    operationId: 'war-beast',
  });
  const unwanted = (
    await member.query(api.characterSheet.read, { characterId: companionId })
  )?.entries.find((entry) => entry.kind === 'classLevel');
  if (!unwanted) throw new Error('Missing companion level');
  await member.mutation(api.characterSheet.deleteClassLevel, {
    characterId: companionId,
    entryId: unwanted._id,
    operationId: 'classless',
  });
  await owner.mutation(api.companionRelationships.link, {
    associatedCharacterId: characterId,
    companionCharacterId: companionId,
    kind: 'animalCompanion',
    sources: [
      {
        key: 'war-beast',
        label: 'War Beast',
        sheetEntryId: firstLevel._id,
        enabled: true,
      },
    ],
    operationId: 'link',
  });
  await member.mutation(api.characterSheet.setCompanionProgression, {
    characterId: companionId,
    operationId: 'progression',
    progression: {
      species: 'wolf',
      hpGained: 10,
      skillRanks: {},
      abilityIncreases: [],
      advancementChoice: 'species',
      keep: false,
    },
  });
  const progression = async () =>
    (await member.query(api.characterSheet.read, { characterId: companionId }))
      ?.calculated.companionProgression;
  expect(await progression()).toMatchObject({
    status: 'active',
    effectiveLevel: 8,
    hitDice: 7,
    contributions: [
      {
        sourceKey: 'war-beast',
        ruleKind: 'madDogCompanion',
        classRuleIdentity: 'barbarian',
        classLevels: 8,
        effectiveLevel: 8,
      },
    ],
  });
  // Without the archetype the barbarian level supports no companion.
  await selectMadDog(false);
  const without = await progression();
  expect(without).toMatchObject({ effectiveLevel: null, hitDice: null });
  expect(without?.contributions).not.toContainEqual(
    expect.objectContaining({ classRuleIdentity: 'barbarian' }),
  );
});
