// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

type Harness = Awaited<ReturnType<typeof seedMadDogBarbarian>>;
type Member = ReturnType<ReturnType<typeof convexTest>['withIdentity']>;

// Character 4c: a companion sheet without the Class Level a new sheet starts with.
async function createClasslessCompanion(
  member: Member,
  campaignId: Id<'campaign'>,
) {
  const companionId = await member.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Character 4c',
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
  return companionId;
}

// A Barbarian 8 (and Druid levels when asked) with Mad Dog seeded but not
// selected, and a classless companion sheet. The catalog rows aren't
// admitted yet, so the class and the archetype are seeded under the keys an
// import gives them: the Foundry barbarian and E1's frozen #716 identity.
async function seedMadDogBarbarian({ druidLevels }: { druidLevels: number }) {
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
    name: 'Character 4',
    kind: 'pc',
    operationId: 'mad-dog',
  });
  const classDetail = (hitDie: number, bab: 'full' | 'threeQuarters') => ({
    kind: 'class' as const,
    classKind: 'base' as const,
    hitDie,
    bab,
    saves: { fort: 'good', ref: 'poor', will: 'poor' } as const,
    skillRanksPerLevel: 4,
    classSkills: [],
    featuresByLevel: [],
    picksByLevel: [],
  });
  const { barbarian, druid, madDog } = await t.run(async (ctx) => {
    const barbarian = await ctx.db.insert('catalogEntry', {
      characterId,
      scope: 'character',
      name: 'Barbarian',
      ruleIdentity: 'pf1/g3pq7xWWdUVYw6ai',
      sources: [{ book: 'Pathfinder RPG Core Rulebook', pages: '31–34' }],
      modifiers: [],
      stacksWithItself: false,
      detail: classDetail(12, 'full'),
    });
    const druid = await ctx.db.insert('catalogEntry', {
      characterId,
      scope: 'character',
      name: 'Druid',
      ruleIdentity: 'pf1/7eZQP0MzeO2svmVF',
      sources: [{ book: 'Pathfinder RPG Core Rulebook', pages: '48–53' }],
      modifiers: [],
      stacksWithItself: false,
      detail: classDetail(8, 'threeQuarters'),
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
    return { barbarian, druid, madDog };
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
  for (let level = 1; level <= druidLevels; level++)
    await owner.mutation(api.characterSheet.addClassLevel, {
      characterId,
      classEntryId: druid,
      operationId: `druid-${level}`,
    });
  const levels = (
    await owner.query(api.characterSheet.read, { characterId })
  )?.entries.flatMap((entry) =>
    entry.kind === 'classLevel' ? [entry] : [],
  );
  const firstBarbarian = levels?.find((entry) => entry.state.position === 1);
  const firstDruid = levels?.find((entry) => entry.state.classEntryId === druid);
  if (!firstBarbarian) throw new Error('Missing first level');
  const selectMadDog = (selected: boolean) =>
    owner.mutation(api.characterSheet.setArchetypeSelected, {
      characterId,
      classEntryId: barbarian,
      catalogEntryId: madDog,
      selected,
      operationId: `mad-dog-${selected}`,
    });
  const companionId = await createClasslessCompanion(member, campaignId);
  const link = async () => {
    await owner.mutation(api.companionRelationships.link, {
      associatedCharacterId: characterId,
      companionCharacterId: companionId,
      kind: 'animalCompanion',
      sources: [
        {
          key: 'war-beast',
          label: 'War Beast',
          sheetEntryId: firstBarbarian._id,
          enabled: true,
        },
        ...(firstDruid
          ? [
              {
                key: 'nature-bond',
                label: 'Nature bond',
                sheetEntryId: firstDruid._id,
                enabled: true,
              },
            ]
          : []),
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
  };
  const progression = async () =>
    (await member.query(api.characterSheet.read, { characterId: companionId }))
      ?.calculated.companionProgression;
  return { selectMadDog, link, progression };
}

const warBeast = {
  sourceKey: 'war-beast',
  ruleKind: 'madDogCompanion',
  classRuleIdentity: 'barbarian',
  counting: true,
  classLevels: 8,
  effectiveLevel: 8,
};
const natureBond = {
  sourceKey: 'nature-bond',
  ruleKind: 'druidCompanion',
  classRuleIdentity: 'druid',
  counting: true,
  classLevels: 3,
  effectiveLevel: 3,
};
// Druid 3 alone: 3 HD (CRB Table 3–8), whatever the barbarian Class Level
// source did before; it no longer counts.
async function expectDruidOnly(progression: Harness['progression']) {
  const result = await progression();
  expect(result).toMatchObject({
    status: 'active',
    effectiveLevel: 3,
    hitDice: 3,
  });
  expect(
    result?.contributions.filter((contribution) => contribution.counting),
  ).toEqual([expect.objectContaining(natureBond)]);
}

// #716 E3, party character 4: a Barbarian 8 with the Mad Dog archetype (Animal
// Archive p. 9) has a war beast at effective druid level 8, the barbarian
// level with no offset (PCGen anar_abilities_class.lst:81), so 7 HD (CRB
// Table 3–8).
test('a Mad Dog barbarian 8’s war beast advances at effective druid level 8, and none without the archetype', async () => {
  const { selectMadDog, link, progression } = await seedMadDogBarbarian({
    druidLevels: 0,
  });
  await selectMadDog(true);
  await link();
  expect(await progression()).toMatchObject({
    status: 'active',
    effectiveLevel: 8,
    hitDice: 7,
    contributions: [warBeast],
  });
  // Without the archetype the barbarian Class Level supports no companion:
  // nothing counts, and nothing fails.
  await selectMadDog(false);
  const without = await progression();
  expect(without).toMatchObject({
    status: 'dormant',
    effectiveLevel: null,
    hitDice: null,
  });
  expect(
    without?.contributions.filter((contribution) => contribution.counting),
  ).toEqual([]);
});

// Losing an entitlement removes only that source's contribution
// (docs/character-sheet/companions.md): the Class Level source stops counting
// as a removed Selection or Grant does, and the druid's nature bond stays.
test('deselecting Mad Dog leaves a barbarian 8 / druid 3’s nature bond at effective level 3', async () => {
  const { selectMadDog, link, progression } = await seedMadDogBarbarian({
    druidLevels: 3,
  });
  await selectMadDog(true);
  await link();
  expect(await progression()).toMatchObject({
    status: 'active',
    effectiveLevel: 11,
    hitDice: 9,
  });
  await selectMadDog(false);
  await expectDruidOnly(progression);
});

test('a barbarian 8 / druid 3 linked before gaining Mad Dog counts the druid levels, then both', async () => {
  const { selectMadDog, link, progression } = await seedMadDogBarbarian({
    druidLevels: 3,
  });
  await link();
  await expectDruidOnly(progression);
  await selectMadDog(true);
  const result = await progression();
  expect(result).toMatchObject({
    status: 'active',
    effectiveLevel: 11,
    hitDice: 9,
  });
  expect(
    result?.contributions.filter((contribution) => contribution.counting),
  ).toEqual([
    expect.objectContaining(warBeast),
    expect.objectContaining(natureBond),
  ]);
});
