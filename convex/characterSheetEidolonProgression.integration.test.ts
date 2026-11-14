// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';
import { seedAcceptedCampaign } from './lib/acceptedCampaignFixture';
import { permanentMilitiaFacts } from '../tests/militia-companion-facts';
import {
  bipedEidolon as biped,
  linkSummonerAndEidolon,
  preparedCampaign,
} from '../tests/summoner-eidolon';

const modules = import.meta.glob('./**/*.ts');
const setProgression = api.characterSheet.setCompanionProgression;

// APG Table 2–9 at summoner level 8: HD 6, BAB +6, Skills 24, Feats 3,
// Armor +6, Str/Dex +3, Evolution Pool 11, Max. Attacks 4.
test('an eidolon reads summoner levels from its source and keeps the pool on that source', async () => {
  const { member, companionId } = await fixture();
  await member.mutation(setProgression, {
    characterId: companionId,
    operationId: 'eidolon',
    progression: biped,
  });
  const sheet = await member.query(api.characterSheet.read, {
    characterId: companionId,
  });
  expect(sheet?.calculated).toMatchObject({
    level: 0,
    classLevels: [],
    hitDice: 6,
    // 30 recorded + Con +1 per HD.
    hp: 36,
    // Str 16 + table 3 + level-5 increase 1 + Ability Increase evolution 2.
    abilities: { strength: { score: 22 }, dexterity: { score: 15 } },
    derivedStatistics: { bab: { total: 6 } },
    budgets: { kind: 'eidolon', skillRanks: 24, generalFeats: 3 },
    companionProgression: {
      kind: 'eidolon',
      status: 'active',
      effectiveLevel: 8,
      hitDice: 6,
      evolutionPool: {
        total: 11,
        spent: 11,
        remaining: 0,
        sources: [
          {
            sourceKey: 'eidolon',
            ruleKind: 'eidolon',
            classRuleIdentity: 'summoner',
            points: 11,
          },
        ],
      },
      budgets: { maxAttacks: 4 },
    },
  });
  expect(sheet).toMatchObject({
    companionCalculationInputs: {
      companionProgressionSources: expect.arrayContaining([
        expect.objectContaining({
          sourceKey: 'eidolon',
          ruleKind: 'eidolon',
          counting: true,
        }),
      ]),
      companionLinkedInputs: [
        expect.objectContaining({
          input: { kind: 'classLevels', classRuleIdentity: 'summoner' },
          value: 8,
        }),
      ],
    },
  });
});

test('a summoner level drop shrinks HD and the pool, keeps every evolution and restores them with the level', async () => {
  const { owner, member, companionId, characterId } = await fixture();
  await member.mutation(setProgression, {
    characterId: companionId,
    operationId: 'eidolon',
    progression: biped,
  });
  const master = await owner.query(api.characterSheet.read, { characterId });
  const levels = (master?.entries ?? [])
    .flatMap((entry) => (entry.kind === 'classLevel' ? [entry] : []))
    .sort((a, b) => a.state.position - b.state.position);
  for (const level of levels.slice(5).reverse())
    await owner.mutation(api.characterSheet.deleteClassLevel, {
      characterId,
      entryId: level._id,
      operationId: `drop-${level._id}`,
    });
  const reduced = await member.query(api.characterSheet.read, {
    characterId: companionId,
  });
  expect(reduced?.calculated).toMatchObject({
    hitDice: 4,
    companionProgression: {
      effectiveLevel: 5,
      evolutionPool: { total: 8, spent: 11, remaining: -3 },
    },
  });
  expect(reduced?.calculated.warnings).toContainEqual(
    expect.objectContaining({ check: 'eidolonEvolutionPoolBudget' }),
  );
  expect(
    reduced?.entries.find((entry) => entry.kind === 'base')?.state
      .companionProgression,
  ).toEqual(biped);
  const summoner = master?.catalogEntries.find(
    (entry) => entry.ruleIdentity === 'summoner',
  );
  if (!summoner) throw new Error('Missing summoner');
  for (let position = 6; position <= 8; position++)
    await owner.mutation(api.characterSheet.addClassLevel, {
      characterId,
      classEntryId: summoner._id,
      operationId: `restore-${position}`,
    });
  const restored = await member.query(api.characterSheet.read, {
    characterId: companionId,
  });
  expect(restored?.calculated).toMatchObject({
    hitDice: 6,
    companionProgression: {
      effectiveLevel: 8,
      evolutionPool: { total: 11, remaining: 0 },
    },
  });
  expect(restored?.calculated.warnings).not.toContainEqual(
    expect.objectContaining({ check: 'eidolonEvolutionPoolBudget' }),
  );
});

test('losing one supporting source keeps the eidolon advancing and losing both retains choices', async () => {
  const { owner, member, companionId, relationshipId } = await fixture();
  await member.mutation(setProgression, {
    characterId: companionId,
    operationId: 'eidolon',
    progression: biped,
  });
  await owner.mutation(api.companionRelationships.setSourceEnabled, {
    relationshipId,
    sourceKey: 'eidolon',
    enabled: false,
    operationId: 'lose-feature',
  });
  const partial = await member.query(api.characterSheet.read, {
    characterId: companionId,
  });
  expect(partial?.calculated.companionProgression).toMatchObject({
    status: 'active',
    effectiveLevel: 8,
    evolutionPool: {
      total: 11,
      sources: [expect.objectContaining({ sourceKey: 'bond', points: 11 })],
    },
  });
  await owner.mutation(api.companionRelationships.setSourceEnabled, {
    relationshipId,
    sourceKey: 'bond',
    enabled: false,
    operationId: 'lose-bond',
  });
  const lost = await member.query(api.characterSheet.read, {
    characterId: companionId,
  });
  expect(lost?.calculated).toMatchObject({
    hitDice: null,
    companionProgression: {
      status: 'dormant',
      evolutionPool: { total: null },
    },
  });
  expect(
    lost?.entries.find((entry) => entry.kind === 'base')?.state
      .companionProgression,
  ).toEqual(biped);
  await owner.mutation(api.companionRelationships.setSourceEnabled, {
    relationshipId,
    sourceKey: 'eidolon',
    enabled: true,
    operationId: 'restore-feature',
  });
  expect(
    (await member.query(api.characterSheet.read, { characterId: companionId }))
      ?.calculated.companionProgression,
  ).toMatchObject({ status: 'active', evolutionPool: { total: 11 } });
});

test('militia facts read the eidolon’s actual HD and permanent scores without Temporary Effects', async () => {
  const { owner, member, companionId, campaignId } = await fixture();
  const seeded = await owner.run((ctx) =>
    seedAcceptedCampaign(ctx, campaignId),
  );
  await member.mutation(setProgression, {
    characterId: companionId,
    operationId: 'eidolon',
    progression: biped,
  });
  await member.mutation(api.characterSheet.createSheetEntry, {
    characterId: companionId,
    name: 'Bull’s strength',
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: false,
      defaultCasterLevel: 3,
    },
    modifiers: [{ target: 'ability.str', bonusType: 'enhancement', value: 4 }],
    operationId: 'temporary-strength',
  });
  const sheet = await member.query(api.characterSheet.read, {
    characterId: companionId,
  });
  expect(sheet?.calculated.abilities.strength.score).toBe(26);
  expect(sheet?.permanentCalculated).toMatchObject({
    hitDice: 6,
    abilities: { strength: { score: 22 } },
    companionProgression: { evolutionPool: { total: 11 } },
  });
  const ledger = await owner.query(api.canonicalLedger.read, {
    campaignId,
    militiaId: seeded.key.militiaId,
  });
  expect(ledger.state.militiaSnapshot.characters).toContainEqual(
    expect.objectContaining({
      characterId: companionId,
      level: 0,
      actualHitDice: 6,
      strength: 22,
    }),
  );
});

test('summoner level changes refresh the eidolon’s militia facts for every player in the same mutation', async () => {
  const { owner, member, companionId, characterId, campaignId } =
    await fixture();
  const seeded = await owner.run((ctx) =>
    seedAcceptedCampaign(ctx, campaignId),
  );
  const scope = { campaignId, militiaId: seeded.key.militiaId };
  await member.mutation(setProgression, {
    characterId: companionId,
    operationId: 'eidolon',
    progression: biped,
  });
  const eidolonFacts = async (reader: typeof owner) =>
    (
      await reader.query(api.canonicalLedger.read, scope)
    ).state.militiaSnapshot.characters.find(
      (row) => row.characterId === companionId,
    );
  expect(await eidolonFacts(member)).toMatchObject({ actualHitDice: 6 });
  const master = await owner.query(api.characterSheet.read, { characterId });
  const levels = (master?.entries ?? [])
    .flatMap((entry) => (entry.kind === 'classLevel' ? [entry] : []))
    .sort((a, b) => a.state.position - b.state.position);
  for (const level of levels.slice(5).reverse())
    await owner.mutation(api.characterSheet.deleteClassLevel, {
      characterId,
      entryId: level._id,
      operationId: `drop-${level._id}`,
    });
  const reduced = await member.query(api.characterSheet.read, {
    characterId: companionId,
  });
  expect(reduced?.permanentCalculated.hitDice).toBe(4);
  // The other player sees the summoner's change without the eidolon saving.
  expect(await eidolonFacts(member)).toMatchObject(
    permanentMilitiaFacts(reduced),
  );
  expect(await eidolonFacts(owner)).toEqual(await eidolonFacts(member));
});

test('eidolon writes reject unknown evolution choices and an Unchained eidolon does not advance from original summoner levels', async () => {
  const { owner, member, companionId, characterId, campaignId } =
    await fixture();
  const before = await member.query(api.characterSheet.read, {
    characterId: companionId,
  });
  for (const evolutions of [
    [{ key: 'skilled' as const, choice: 'juggling' }],
    [{ key: 'bite' as const, upgrades: 1 }],
  ])
    await expect(
      member.mutation(setProgression, {
        characterId: companionId,
        operationId: 'invalid',
        progression: { ...biped, evolutions },
      }),
    ).rejects.toThrow('valid companion choices');
  expect(
    (await member.query(api.characterSheet.read, { characterId: companionId }))
      ?.revision,
  ).toBe(before?.revision);
  const unchainedId = await member.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Second eidolon',
    kind: 'npc',
    operationId: 'second',
  });
  await owner.mutation(api.companionRelationships.link, {
    associatedCharacterId: characterId,
    companionCharacterId: unchainedId,
    kind: 'unchainedEidolon',
    sources: [{ key: 'bond', label: 'Bond', enabled: true }],
    operationId: 'link-unchained',
  });
  await member.mutation(setProgression, {
    characterId: unchainedId,
    operationId: 'unchained',
    progression: { ...biped, version: 'unchained', subtype: 'angel' },
  });
  const unchained = await member.query(api.characterSheet.read, {
    characterId: unchainedId,
  });
  // The recorded support reads the original summoner levels on the sheet.
  expect(unchained?.calculated.companionProgression).toMatchObject({
    kind: 'eidolon',
    version: 'unchained',
    versionMismatch: true,
    status: 'unresolved',
    contributions: [
      expect.objectContaining({
        sourceKey: 'bond',
        ruleKind: 'eidolon',
        counting: false,
      }),
    ],
  });
});

async function fixture() {
  const t = convexTest(schema, modules);
  const { owner, member, campaignId } = await preparedCampaign(
    t,
    'eidolon-progression',
  );
  const {
    summonerId: characterId,
    eidolonId: companionId,
    relationshipId,
  } = await linkSummonerAndEidolon({ t, owner, member, campaignId });
  return {
    t,
    owner,
    member,
    campaignId,
    characterId,
    companionId,
    relationshipId,
  };
}
