// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { preloadCalledConvexModules } from '../tests/convex-modules';
import { api } from './_generated/api';
import schema from './schema';
import { withSheetCatalog } from '../tests/character-sheet-catalog';

const modules = import.meta.glob('./**/*.ts');
preloadCalledConvexModules({ modules, testFile: import.meta.url });
const setProgression = api.characterSheet.setCompanionProgression;

// Pathfinder Unchained, Eidolon Base Statistics at summoner level 8: HD 6,
// BAB +6, good +5, poor +2, Feats 3, Armor +6, Str/Dex +3, Evolution Pool 6.
test('an Unchained summoner’s angel advances on the Unchained table with its subtype evolutions', async () => {
  const { member, companionId } = await fixture();
  await member.mutation(setProgression, {
    characterId: companionId,
    operationId: 'angel',
    progression: angel,
  });
  const sheet = await member.query(api.characterSheet.read, {
    characterId: companionId,
  });
  expect(sheet?.calculated).toMatchObject({
    level: 0,
    hitDice: 6,
    // 30 recorded + Con +1 per HD.
    hp: 36,
    // Str 16 + table 3 + level-5 increase 1 + Ability Increase evolution 2.
    abilities: { strength: { score: 22 } },
    derivedStatistics: { bab: { total: 6 } },
    companionProgression: {
      kind: 'eidolon',
      version: 'unchained',
      versionMismatch: false,
      status: 'active',
      effectiveLevel: 8,
      subtype: { key: 'angel', name: 'Angel' },
      evolutionPool: {
        total: 6,
        spent: 6,
        remaining: 0,
        sources: [
          {
            sourceKey: 'eidolon',
            ruleKind: 'unchainedEidolon',
            classRuleIdentity: 'summoner',
            points: 6,
          },
        ],
      },
    },
  });
  const progression = sheet?.calculated.companionProgression;
  if (progression?.kind !== 'eidolon') throw new Error('Missing eidolon');
  expect(
    progression.evolutions
      .filter(({ origin }) => origin === 'subtype')
      .map(({ key, choice, level }) => [key, choice, level]),
  ).toEqual([
    ['resistance', 'acid', 1],
    ['resistance', 'cold', 1],
    ['flight', 'wings', 8],
  ]);
  expect(sheet).toMatchObject({
    companionCalculationInputs: {
      companionProgressionSources: [
        expect.objectContaining({
          sourceKey: 'eidolon',
          ruleKind: 'unchainedEidolon',
          counting: true,
        }),
      ],
    },
  });
});

test('a demon at summoner levels 4, 8 and 12 gains its pool points, subtype choice and damage reduction', async () => {
  const { owner, member, companionId, characterId, unchainedSummonerId } =
    await fixture();
  await member.mutation(setProgression, {
    characterId: companionId,
    operationId: 'demon',
    progression: demon,
  });
  const read = async () => {
    const sheet = await member.query(api.characterSheet.read, {
      characterId: companionId,
    });
    const progression = sheet?.calculated.companionProgression;
    if (progression?.kind !== 'eidolon') throw new Error('Missing eidolon');
    return { sheet, progression };
  };
  expect((await read()).progression).toMatchObject({
    effectiveLevel: 8,
    evolutionPool: {
      total: 7,
      bonuses: [{ label: 'Demon subtype (8th level)', points: 1 }],
    },
  });
  for (let position = 9; position <= 12; position++)
    await owner.mutation(api.characterSheet.addClassLevel, {
      characterId,
      classEntryId: unchainedSummonerId,
      operationId: `level-${position}`,
    });
  const twelfth = await read();
  expect(twelfth.progression).toMatchObject({
    effectiveLevel: 12,
    hitDice: 9,
    // Pool 9 plus the demon's point.
    evolutionPool: { total: 10 },
    subtype: { missingChoices: ['demon-abilityIncrease-12'] },
  });
  expect(twelfth.progression.features).toContain('DR 5/good');
  expect(twelfth.sheet?.calculated.warnings).toContainEqual(
    expect.objectContaining({ check: 'eidolonSubtypeChoiceMissing' }),
  );
  await member.mutation(setProgression, {
    characterId: companionId,
    operationId: 'demon-choice',
    progression: {
      ...demon,
      subtypeChoices: [
        { key: 'demon-abilityIncrease-12', choice: 'dexterity' },
      ],
    },
  });
  // Recorded Dex 12 + table 5 + demon Ability Increase 2.
  expect((await read()).sheet?.calculated.abilities.dexterity.score).toBe(19);
  const master = await owner.query(api.characterSheet.read, { characterId });
  const levels = (master?.entries ?? [])
    .flatMap((entry) => (entry.kind === 'classLevel' ? [entry] : []))
    .sort((a, b) => a.state.position - b.state.position);
  for (const level of levels.slice(4).reverse())
    await owner.mutation(api.characterSheet.deleteClassLevel, {
      characterId,
      entryId: level._id,
      operationId: `drop-${level._id}`,
    });
  const fourth = await read();
  expect(fourth.progression).toMatchObject({
    effectiveLevel: 4,
    hitDice: 3,
    evolutionPool: { total: 3, bonuses: [] },
  });
  // The 12th-level choice stays recorded while it does not apply.
  expect(
    fourth.sheet?.entries.find((entry) => entry.kind === 'base')?.state
      .companionProgression,
  ).toMatchObject({
    subtypeChoices: [{ key: 'demon-abilityIncrease-12', choice: 'dexterity' }],
  });
  expect(fourth.sheet?.calculated.abilities.dexterity.score).toBe(13);
});

test('switching the summoner’s version leaves the eidolon unresolved until its own version matches, and restores it unchanged', async () => {
  const {
    owner,
    member,
    companionId,
    characterId,
    summonerId,
    unchainedSummonerId,
    levelId,
  } = await fixture();
  await member.mutation(setProgression, {
    characterId: companionId,
    operationId: 'angel',
    progression: angel,
  });
  const read = () =>
    member.query(api.characterSheet.read, { characterId: companionId });
  const initial = (await read())?.calculated.companionProgression;
  await owner.mutation(api.characterSheet.switchClassVersion, {
    characterId,
    entryId: levelId,
    classEntryId: summonerId,
    operationId: 'to-original',
  });
  const mixed = await read();
  expect(mixed?.calculated).toMatchObject({
    hitDice: null,
    companionProgression: {
      version: 'unchained',
      versionMismatch: true,
      status: 'unresolved',
      evolutionPool: { total: null, spent: 6 },
      contributions: [
        expect.objectContaining({
          sourceKey: 'eidolon',
          ruleKind: 'eidolon',
          classLevels: 8,
          counting: false,
        }),
      ],
    },
  });
  expect(mixed?.calculated.warnings).toContainEqual(
    expect.objectContaining({ check: 'eidolonVersionMismatch' }),
  );
  expect(
    mixed?.entries.find((entry) => entry.kind === 'base')?.state
      .companionProgression,
  ).toEqual(angel);
  // Converting the eidolon keeps the Unchained subtype without counting it.
  await member.mutation(setProgression, {
    characterId: companionId,
    operationId: 'to-original-eidolon',
    progression: { ...angel, version: 'original' },
  });
  expect((await read())?.calculated.companionProgression).toMatchObject({
    version: 'original',
    status: 'active',
    subtype: null,
    // APG Table 2–9 pool at 8th level.
    evolutionPool: { total: 11 },
    dormantChoices: [
      expect.objectContaining({ kind: 'subtype', key: 'angel' }),
    ],
  });
  await member.mutation(setProgression, {
    characterId: companionId,
    operationId: 'back-to-unchained-eidolon',
    progression: angel,
  });
  await owner.mutation(api.characterSheet.switchClassVersion, {
    characterId,
    entryId: levelId,
    classEntryId: unchainedSummonerId,
    operationId: 'to-unchained',
  });
  expect((await read())?.calculated.companionProgression).toEqual(initial);
});

test('an original summoner Archetype on the Unchained summoner is reported, not applied, for its eidolon', async () => {
  const {
    t,
    owner,
    member,
    companionId,
    characterId,
    summonerId,
    unchainedSummonerId,
  } = await fixture();
  await member.mutation(setProgression, {
    characterId: companionId,
    operationId: 'angel',
    progression: angel,
  });
  const archetypeId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      characterId,
      scope: 'character',
      name: 'Evolutionist',
      ruleIdentity: 'summoner-evolutionist',
      sources: [{ book: 'Pathfinder RPG Ultimate Magic', pages: '80' }],
      modifiers: [],
      stacksWithItself: false,
      detail: {
        kind: 'archetype',
        classEntryIds: [summonerId],
        replaces: [],
        adds: [],
      },
    }),
  );
  const select = (selected: boolean) =>
    owner.mutation(api.characterSheet.setArchetypeSelected, {
      characterId,
      classEntryId: unchainedSummonerId,
      catalogEntryId: archetypeId,
      selected,
      operationId: `evolutionist-${selected}`,
    });
  await select(true);
  const reported = await member.query(api.characterSheet.read, {
    characterId: companionId,
  });
  expect(reported?.calculated.companionProgression).toMatchObject({
    status: 'active',
    unsupportedArchetypes: ['Evolutionist'],
  });
  expect(reported?.calculated.warnings).toContainEqual(
    expect.objectContaining({ check: 'eidolonUnchainedArchetype' }),
  );
  await select(false);
  expect(
    (await member.query(api.characterSheet.read, { characterId: companionId }))
      ?.calculated.companionProgression,
  ).toMatchObject({ unsupportedArchetypes: [] });
  // Without access to the summoner, its Archetypes stay undisclosed.
  await select(true);
  await t.run((ctx) =>
    ctx.db.patch('character', characterId, {
      campaignId: undefined,
      sheetDemo: true,
    }),
  );
  const inaccessible = await member.query(api.characterSheet.read, {
    characterId: companionId,
  });
  expect(inaccessible?.calculated.companionProgression).toMatchObject({
    unsupportedArchetypes: [],
  });
  expect(inaccessible?.calculated.warnings).not.toContainEqual(
    expect.objectContaining({ check: 'eidolonUnchainedArchetype' }),
  );
  expect(JSON.stringify(inaccessible)).not.toContain('Evolutionist');
  expect(JSON.stringify(inaccessible)).not.toContain('Sela');
});

test('a record without a version on an Unchained eidolon relationship is saved as an Unchained eidolon', async () => {
  const { member, companionId } = await fixture();
  const { version: _version, ...unversioned } = angel;
  await member.mutation(setProgression, {
    characterId: companionId,
    operationId: 'unversioned',
    progression: unversioned,
  });
  const sheet = await member.query(api.characterSheet.read, {
    characterId: companionId,
  });
  expect(
    sheet?.entries.find((entry) => entry.kind === 'base')?.state
      .companionProgression,
  ).toEqual(angel);
  expect(sheet?.calculated.companionProgression).toMatchObject({
    version: 'unchained',
    status: 'active',
    subtype: { key: 'angel' },
  });
});

test('a source on the summoner’s eidolon Grant follows the version of the Class Level that grants it', async () => {
  const {
    owner,
    member,
    companionId,
    characterId,
    relationshipId,
    summonerId,
    unchainedSummonerId,
    levelId,
  } = await fixture();
  const master = await owner.query(api.characterSheet.read, { characterId });
  const grant = master?.calculated.resolvedEntries.find(
    ({ entry }) =>
      'grantKey' in entry && entry.grantKey?.entry === 'summoner-eidolon',
  )?.entry;
  if (!grant || !('grantKey' in grant) || !grant.grantKey)
    throw new Error('Missing eidolon Grant');
  await owner.mutation(api.companionRelationships.addSource, {
    relationshipId,
    source: {
      key: 'grant',
      label: 'Eidolon',
      grantKey: grant.grantKey,
      enabled: true,
    },
    operationId: 'grant-source',
  });
  await owner.mutation(api.companionRelationships.setSourceEnabled, {
    relationshipId,
    sourceKey: 'eidolon',
    enabled: false,
    operationId: 'class-level-off',
  });
  await member.mutation(setProgression, {
    characterId: companionId,
    operationId: 'angel',
    progression: angel,
  });
  const read = async () =>
    (await member.query(api.characterSheet.read, { characterId: companionId }))
      ?.calculated.companionProgression;
  expect(await read()).toMatchObject({
    status: 'active',
    evolutionPool: {
      sources: [
        expect.objectContaining({
          sourceKey: 'grant',
          ruleKind: 'unchainedEidolon',
        }),
      ],
    },
  });
  await owner.mutation(api.characterSheet.switchClassVersion, {
    characterId,
    entryId: levelId,
    classEntryId: summonerId,
    operationId: 'to-original',
  });
  const mismatched = {
    status: 'unresolved',
    versionMismatch: true,
    contributions: expect.arrayContaining([
      expect.objectContaining({ sourceKey: 'grant', ruleKind: 'eidolon' }),
    ]),
  };
  expect(await read()).toMatchObject(mismatched);
  // A later Unchained level does not change the version of the level that
  // granted the eidolon, despite the mixed-version warning.
  await owner.mutation(api.characterSheet.addClassLevel, {
    characterId,
    classEntryId: unchainedSummonerId,
    operationId: 'mixed',
  });
  expect(await read()).toMatchObject(mismatched);
});

test('unknown subtype choices are refused without a write', async () => {
  const { member, companionId } = await fixture();
  const before = await member.query(api.characterSheet.read, {
    characterId: companionId,
  });
  await expect(
    member.mutation(setProgression, {
      characterId: companionId,
      operationId: 'invalid',
      progression: {
        ...angel,
        subtypeChoices: [{ key: 'protean-grab-1', choice: 'gore' }],
      },
    }),
  ).rejects.toThrow('valid companion choices');
  expect(
    (await member.query(api.characterSheet.read, { characterId: companionId }))
      ?.revision,
  ).toBe(before?.revision);
});

const angel = {
  kind: 'eidolon' as const,
  version: 'unchained' as const,
  subtype: 'angel' as const,
  subtypeChoices: [],
  baseForm: 'biped' as const,
  size: 'medium' as const,
  hpGained: 30,
  skillRanks: { 'skill.per': 6 },
  abilityIncreases: ['strength' as const],
  classSkills: ['skill.acr'],
  armorBonusAsArmor: 0,
  // 1 + 2 + 1 + 2 = 6 points.
  evolutions: [
    { key: 'improvedNaturalArmor' as const },
    { key: 'abilityIncrease' as const, choice: 'strength' },
    { key: 'skilled' as const, choice: 'skill.per' },
    { key: 'limbs' as const, choice: 'arms' },
  ],
  keep: false,
};
const demon = {
  ...angel,
  subtype: 'demon' as const,
  baseForm: 'quadruped' as const,
  abilityIncreases: [],
  evolutions: [{ key: 'bite' as const }, { key: 'pounce' as const }],
};

async function fixture() {
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
        namespace: 'unchained-eidolon',
        version: 1,
        workerKey: '0',
        caseKey: 'unchained-eidolon',
        campaignKey: 'unchained-eidolon',
      },
    }),
  );
  const characterId = await owner.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Sela',
    kind: 'pc',
    operationId: 'sela',
  });
  const master = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  const summonerId = master?.catalogEntries.find(
    (entry) => entry.ruleIdentity === 'summoner',
  )?._id;
  const unchainedSummonerId = master?.catalogEntries.find(
    (entry) => entry.ruleIdentity === 'unchained-summoner',
  )?._id;
  const initialLevel = master?.entries.find(
    (entry) => entry.kind === 'classLevel',
  );
  if (!summonerId || !unchainedSummonerId || !initialLevel)
    throw new Error('Missing summoner');
  await owner.mutation(api.characterSheet.editClassLevel, {
    characterId,
    entryId: initialLevel._id,
    classEntryId: unchainedSummonerId,
    hpGained: 8,
    operationId: 'summoner-one',
  });
  for (let position = 2; position <= 8; position++)
    await owner.mutation(api.characterSheet.addClassLevel, {
      characterId,
      classEntryId: unchainedSummonerId,
      operationId: `level-${position}`,
    });
  const companionId = await member.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Ixa',
    kind: 'npc',
    operationId: 'ixa',
  });
  const companion = await member.query(api.characterSheet.read, {
    characterId: companionId,
  });
  const unwantedLevel = companion?.entries.find(
    (entry) => entry.kind === 'classLevel',
  );
  if (!unwantedLevel) throw new Error('Missing initial companion level');
  await member.mutation(api.characterSheet.deleteClassLevel, {
    characterId: companionId,
    entryId: unwantedLevel._id,
    operationId: 'non-class-companion',
  });
  // Unchained Biped base form scores.
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
    operationId: 'biped-scores',
  });
  const relationshipId = await owner.mutation(api.companionRelationships.link, {
    associatedCharacterId: characterId,
    companionCharacterId: companionId,
    kind: 'unchainedEidolon',
    sources: [
      {
        key: 'eidolon',
        label: 'Eidolon',
        sheetEntryId: initialLevel._id,
        enabled: true,
      },
    ],
    operationId: 'link',
  });
  return {
    t,
    owner,
    member,
    campaignId,
    characterId,
    companionId,
    relationshipId,
    summonerId,
    unchainedSummonerId,
    levelId: initialLevel._id,
  };
}
