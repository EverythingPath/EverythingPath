import type { convexTest } from 'convex-test';
import { api } from '../convex/_generated/api';
import type { Id } from '../convex/_generated/dataModel';

// A summoner 8 and a Biped eidolon owned by two players, shared by the
// Convex suites that calculate or publish the eidolon (APG pp. 54–60).

type ConvexTest = ReturnType<typeof convexTest>;
type Client = ReturnType<ConvexTest['withIdentity']>;

/** An APG Biped build spending the 11 points of a summoner 8's pool. */
export const bipedEidolon = {
  kind: 'eidolon' as const,
  baseForm: 'biped' as const,
  size: 'medium' as const,
  hpGained: 30,
  skillRanks: { 'skill.per': 6 },
  abilityIncreases: ['strength' as const],
  classSkills: ['skill.acr'],
  armorBonusAsArmor: 0,
  // 1 + 2 + 2 + 2 + 2 + 1 + 1 = 11 points.
  evolutions: [
    { key: 'bite' as const },
    { key: 'abilityIncrease' as const, choice: 'strength' },
    { key: 'limbs' as const, choice: 'arms' },
    { key: 'flight' as const, choice: 'wings' },
    { key: 'gore' as const },
    { key: 'skilled' as const, choice: 'skill.per' },
    { key: 'improvedNaturalArmor' as const },
  ],
  keep: false,
};

/** Two organization members and an isolated prepared campaign. */
export async function preparedCampaign(t: ConvexTest, namespace: string) {
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
        namespace,
        version: 1,
        workerKey: '0',
        caseKey: namespace,
        campaignKey: namespace,
      },
    }),
  );
  return { owner, member, campaignId };
}

/**
 * The owner's summoner 8, with a character-scoped Summoner class, linked to
 * the member's classless eidolon with APG Biped base scores. The link has
 * two sources: the first summoner level (`eidolon`) and a plain `bond`.
 */
export async function linkSummonerAndEidolon({
  t,
  owner,
  member,
  campaignId,
}: {
  t: ConvexTest;
  owner: Client;
  member: Client;
  campaignId: Id<'campaign'>;
}) {
  const summonerId = await owner.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Sela',
    kind: 'pc',
    operationId: 'sela',
  });
  const summonerClassId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      characterId: summonerId,
      scope: 'character',
      name: 'Summoner',
      ruleIdentity: 'summoner',
      sources: [
        { book: 'Pathfinder RPG Advanced Player’s Guide', pages: '54' },
      ],
      modifiers: [],
      stacksWithItself: false,
      detail: {
        kind: 'class',
        classKind: 'base',
        hitDie: 8,
        bab: 'threeQuarters',
        saves: { fort: 'poor', ref: 'poor', will: 'good' },
        skillRanksPerLevel: 2,
        classSkills: [],
        featuresByLevel: [],
        picksByLevel: [],
      },
    }),
  );
  const master = await owner.query(api.characterSheet.read, {
    characterId: summonerId,
  });
  const initialLevel = master?.entries.find(
    (entry) => entry.kind === 'classLevel',
  );
  if (!initialLevel) throw new Error('Missing summoner');
  await owner.mutation(api.characterSheet.editClassLevel, {
    characterId: summonerId,
    entryId: initialLevel._id,
    classEntryId: summonerClassId,
    hpGained: 8,
    operationId: 'summoner-one',
  });
  for (let position = 2; position <= 8; position++)
    await owner.mutation(api.characterSheet.addClassLevel, {
      characterId: summonerId,
      classEntryId: summonerClassId,
      operationId: `level-${position}`,
    });
  const eidolonId = await member.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Ixa',
    kind: 'npc',
    operationId: 'ixa',
  });
  const eidolon = await member.query(api.characterSheet.read, {
    characterId: eidolonId,
  });
  const unwantedLevel = eidolon?.entries.find(
    (entry) => entry.kind === 'classLevel',
  );
  if (!unwantedLevel) throw new Error('Missing initial companion level');
  await member.mutation(api.characterSheet.deleteClassLevel, {
    characterId: eidolonId,
    entryId: unwantedLevel._id,
    operationId: 'non-class-companion',
  });
  // APG Biped base form scores.
  await member.mutation(api.characterSheet.editBaseScores, {
    characterId: eidolonId,
    scores: {
      strength: 16,
      dexterity: 12,
      constitution: 13,
      intelligence: 7,
      wisdom: 10,
      charisma: 11,
    },
    operationId: 'biped-scores',
  });
  const relationshipId = await owner.mutation(api.companionRelationships.link, {
    associatedCharacterId: summonerId,
    companionCharacterId: eidolonId,
    kind: 'eidolon',
    sources: [
      {
        key: 'eidolon',
        label: 'Eidolon',
        sheetEntryId: initialLevel._id,
        enabled: true,
      },
      { key: 'bond', label: 'Bond', enabled: true },
    ],
    operationId: 'link',
  });
  return { summonerId, summonerClassId, eidolonId, relationshipId };
}
