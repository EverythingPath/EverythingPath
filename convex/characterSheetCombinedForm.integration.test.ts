// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { expect, test, vi } from 'vitest';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import schema from './schema';
import { seedAcceptedCampaign } from './lib/acceptedCampaignFixture';
import { calculateMilitiaCharacterFacts } from './lib/militiaCharacterFacts';
import { withSheetCatalog } from '../tests/character-sheet-catalog';

const modules = import.meta.glob('./**/*.ts');
// Each case builds a summoner of up to 20 levels and a linked eidolon; under
// a full parallel run that setup alone can exceed the local 5s default.
vi.setConfig({ testTimeout: 20_000 });
const setArchetype = api.characterSheet.setArchetypeSelected;

// Ultimate Magic pp. 80–81, Synthesist, and the official Ultimate Magic FAQ
// (August 2011). Every build uses the seeded, browse-only Summoner, Fighter
// and Synthesist definitions.

test('the summoner’s Combined Form fuses its separately built eidolon (FAQ: fighter 19/summoner 1 has BAB +20)', async () => {
  const { member, characterId, eidolonId, fighterId, addLevels } =
    await fixture(1);
  // The FAQ build: fighter 19 then summoner 1.
  await addLevels(fighterId, 19);
  const summoner = await read(member, characterId);
  expect(summoner?.calculated).toMatchObject({
    level: 20,
    derivedStatistics: { bab: { total: 19 } },
  });
  const form = await member.query(api.characterSheetCombinedForm.read, {
    characterId,
  });
  expect(form).toMatchObject({
    status: 'calculated',
    summonerLevel: 1,
    eidolon: { characterId: eidolonId, name: 'Brightwing' },
    baseAttackBonus: {
      total: 20,
      contributions: [
        { label: 'Fighter 19', value: 19, from: 'summoner' },
        { label: 'Eidolon BAB', value: 1, from: 'eidolon' },
      ],
      replaced: [{ label: 'Summoner 1', value: 0 }],
    },
    // Evolutions read the eidolon's Hit Dice, never the summoner's 20.
    evolutions: { hitDice: 1, characterHitDice: 20 },
    hitPoints: { temporary: 11 },
  });
  // The eidolon keeps its own build: a Synthesist source at the whole
  // summoner level, citing the archetype.
  expect((await read(member, eidolonId))?.calculated).toMatchObject({
    hitDice: 1,
    companionProgression: {
      status: 'active',
      contributions: [
        { kind: 'ordinary', ruleKind: 'synthesistEidolon', classLevels: 1 },
      ],
      sources: expect.arrayContaining([
        expect.objectContaining({ pages: '80–81' }),
      ]),
    },
  });
});

test('Skilled reaches the synthesist and the eidolon’s mental increases do not', async () => {
  const { member, characterId, eidolonId } = await fixture(1);
  await member.mutation(api.characterSheet.setCompanionProgression, {
    characterId: eidolonId,
    operationId: 'evolutions',
    progression: {
      ...biped,
      evolutions: [
        { key: 'skilled', choice: 'skill.per' },
        { key: 'abilityIncrease', choice: 'charisma' },
      ],
    },
  });
  const own = await read(member, characterId);
  const form = await member.query(api.characterSheetCombinedForm.read, {
    characterId,
  });
  const perception = form?.skills.find(({ skill }) => skill === 'skill.per');
  expect(perception).toMatchObject({ skilled: 8 });
  expect(perception?.total).toBe(
    (own?.calculated.breakdowns['skill.per'].total ?? Number.NaN) + 8,
  );
  expect(form?.abilities.find(({ ability }) => ability === 'charisma')).toEqual(
    {
      ability: 'charisma',
      score: own?.calculated.abilities.charisma.score,
      modifier: own?.calculated.abilities.charisma.modifier,
      from: 'summoner',
      excluded: [{ label: 'Ability Increase evolution', value: 2 }],
    },
  );
});

test('Synthesist and Master Summoner compete for the eidolon, leaving the Combined Form unresolved', async () => {
  const { owner, member, characterId, eidolonId, summonerId } =
    await fixture(7);
  const masterSummonerId = await catalogId(
    owner,
    characterId,
    'summoner-master-summoner',
  );
  await owner.mutation(setArchetype, {
    characterId,
    classEntryId: summonerId,
    catalogEntryId: masterSummonerId,
    selected: true,
    operationId: 'master-summoner',
  });
  expect(
    (await read(member, eidolonId))?.calculated.companionProgression,
  ).toMatchObject({
    status: 'unresolved',
    contributions: [
      {
        ruleKind: 'eidolon',
        classLevels: 7,
        effectiveLevel: null,
        ruleConflict: {
          disclosure: 'disclosed',
          ruleKinds: ['masterSummonerEidolon', 'synthesistEidolon'],
        },
      },
    ],
  });
  expect(
    await member.query(api.characterSheetCombinedForm.read, { characterId }),
  ).toMatchObject({
    status: 'unresolved',
    unresolved: [
      {
        reason: 'eidolonProgressionUnresolved',
        message: expect.stringContaining('Master Summoner and Synthesist'),
      },
    ],
    baseAttackBonus: { total: null },
  });
  await owner.mutation(setArchetype, {
    characterId,
    classEntryId: summonerId,
    catalogEntryId: masterSummonerId,
    selected: false,
    operationId: 'master-summoner-off',
  });
  expect(
    await member.query(api.characterSheetCombinedForm.read, { characterId }),
  ).toMatchObject({ status: 'calculated', baseAttackBonus: { total: 6 } });
});

// #250's reading of Fused Eidolon: the eidolon's physical scores replace the
// summoner's entirely, item and racial bonuses included, and its size
// replaces the summoner's size adjustments.
test('a Small, belted summoner’s Combined Form takes the eidolon’s scores and size alone', async () => {
  const { t, member, characterId } = await fixture(4);
  await t.run(async (ctx) => {
    const gnome = await ctx.db.insert('catalogEntry', {
      characterId,
      scope: 'character',
      name: 'Gnome',
      ruleIdentity: 'test-gnome',
      sources: [{ book: 'Pathfinder RPG Core Rulebook', pages: '23' }],
      modifiers: [
        { target: 'ability.str', bonusType: 'racial', value: -2 },
        { target: 'skill.ste', bonusType: 'size', value: 4 },
      ],
      stacksWithItself: false,
      detail: { kind: 'race', racialTraits: [], size: 'small' },
    });
    const belt = await ctx.db.insert('catalogEntry', {
      characterId,
      scope: 'character',
      name: 'Belt of giant strength +4',
      ruleIdentity: 'test-belt-of-giant-strength',
      sources: [{ book: 'Pathfinder RPG Core Rulebook', pages: '458' }],
      modifiers: [
        { target: 'ability.str', bonusType: 'enhancement', value: 4 },
      ],
      stacksWithItself: false,
      detail: { kind: 'item', consumable: false },
    });
    const race = (
      await ctx.db
        .query('characterSheetEntry')
        .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
        .collect()
    ).find((entry) => entry.kind === 'race');
    if (race)
      await ctx.db.patch('characterSheetEntry', race._id, {
        catalogEntryId: gnome,
      });
    else
      await ctx.db.insert('characterSheetEntry', {
        characterId,
        kind: 'race',
        active: true,
        catalogEntryId: gnome,
        state: { kind: 'race' },
      });
    await ctx.db.insert('characterSheetEntry', {
      characterId,
      kind: 'item',
      active: true,
      catalogEntryId: belt,
      state: { kind: 'item' },
    });
  });
  const own = (await read(member, characterId))?.calculated;
  // 10 − 2 racial + 4 enhancement; Small: +1 size AC and +4 Stealth.
  expect(own?.abilities.strength.score).toBe(12);
  expect(own?.derivedStatistics.ac.applied).toContainEqual(
    expect.objectContaining({ entryName: 'Size', value: 1 }),
  );
  const form = await member.query(api.characterSheetCombinedForm.read, {
    characterId,
  });
  expect(form).toMatchObject({
    status: 'calculated',
    size: 'medium',
    advisories: [],
    // BAB +3 and the eidolon's Str 17 (+3), with no Small special size −1.
    combatManeuverBonus: 6,
  });
  // Biped 16/12/13 with the level-4 Str/Dex bonus +1.
  expect(form?.abilities.slice(0, 3)).toMatchObject([
    { ability: 'strength', score: 17, from: 'eidolon' },
    { ability: 'dexterity', score: 13, from: 'eidolon' },
    { ability: 'constitution', score: 13, from: 'eidolon' },
  ]);
  expect(
    form?.armorClass.contributions.some(({ label }) => label === 'Size'),
  ).toBe(false);
  // Stealth has no ranks: the gnome's +4 size bonus is gone, leaving Dex.
  expect(own?.breakdowns['skill.ste'].total).toBe(
    (own?.abilities.dexterity.modifier ?? Number.NaN) + 4,
  );
  expect(form?.skills.find(({ skill }) => skill === 'skill.ste')?.total).toBe(
    1,
  );
});

test('a deactivated Shielded Meld Grant supplies nothing to the Combined Form', async () => {
  const { owner, member, characterId } = await fixture(4);
  const read = () =>
    member.query(api.characterSheetCombinedForm.read, { characterId });
  expect(await read()).toMatchObject({
    features: [{ name: 'Shielded Meld' }],
  });
  const withMeld = await read();
  await owner.mutation(api.characterSheet.editGrantState, {
    characterId,
    grantKey: {
      source: 'summoner-synthesist',
      classLevel: 4,
      entry: 'summoner-synthesist-shielded-meld',
    },
    state: { active: false },
    operationId: 'meld-off',
  });
  const form = await read();
  expect(form).toMatchObject({ status: 'calculated', features: [] });
  expect(form?.armorClass.total).toBe(
    (withMeld?.armorClass.total ?? Number.NaN) - 2,
  );
  expect(
    form?.armorClass.contributions.some(
      ({ label }) => label === 'Shielded Meld',
    ),
  ).toBe(false);
});

test('a summoner without an active Synthesist has no Combined Form', async () => {
  const { owner, member, characterId, summonerId, synthesistId } =
    await fixture(4);
  await owner.mutation(setArchetype, {
    characterId,
    classEntryId: summonerId,
    catalogEntryId: synthesistId,
    selected: false,
    operationId: 'synthesist-off',
  });
  expect(
    await member.query(api.characterSheetCombinedForm.read, { characterId }),
  ).toBeNull();
});

test('viewing the Combined Form changes no stored state, Militia Character Facts, roster or officers', async () => {
  const { t, owner, member, campaignId, characterId, eidolonId } =
    await fixture(4);
  const seeded = await owner.run((ctx) =>
    seedAcceptedCampaign(ctx, campaignId),
  );
  const observe = async () => ({
    // Every stored row, so nothing the read could write escapes comparison.
    tables: await t.run(async (ctx) => {
      const rows: Record<string, unknown[]> = {};
      for (const table of Object.keys(schema.tables).sort())
        rows[table] = await ctx.db
          .query(table as keyof typeof schema.tables)
          .collect();
      return JSON.stringify(rows);
    }),
    facts: await t.run(async (ctx) => {
      const facts = [];
      for (const id of [characterId, eidolonId]) {
        const character = await ctx.db.get('character', id);
        if (!character) throw new Error('Missing Character');
        facts.push(await calculateMilitiaCharacterFacts(ctx, character));
      }
      return JSON.stringify(facts);
    }),
    ledger: JSON.stringify(
      await owner.query(api.canonicalLedger.read, {
        campaignId,
        militiaId: seeded.key.militiaId,
      }),
    ),
  });
  const before = await observe();
  for (const viewer of [owner, member])
    expect(
      await viewer.query(api.characterSheetCombinedForm.read, { characterId }),
    ).toMatchObject({ status: 'calculated' });
  const after = await observe();
  expect(after).toEqual(before);
  // The summoner's ordinary sheet and Militia Character Facts keep its own
  // scores.
  const own = await read(member, characterId);
  expect(own?.calculated.abilities.strength.score).toBe(10);
  expect(JSON.parse(after.facts)[0]).toMatchObject({ strength: 10 });
});

test('campaign Character lists return an eidolon’s actual Hit Dice from its Militia Character Facts', async () => {
  const { owner, member, campaignId, eidolonId } = await fixture(4);
  await owner.run((ctx) => seedAcceptedCampaign(ctx, campaignId));
  const scope = { campaignId, organizationId: 'org' };
  const listed = await member.query(
    api.character.listCampaignCharacters,
    scope,
  );
  expect(
    listed.find(({ character }) => character._id === eidolonId)?.character,
  ).toMatchObject({ level: 0, actualHitDice: 3 });
  expect(
    (await member.query(api.character.listByCampaign, scope)).find(
      (character) => character._id === eidolonId,
    ),
  ).toMatchObject({ level: 0, actualHitDice: 3 });
});

test('a hidden eidolon discloses nothing and leaves the Combined Form unresolved; outsiders read nothing', async () => {
  const { t, owner, characterId, eidolonId } = await fixture(4);
  // The eidolon becomes another player's private Character: the
  // relationship is interrupted and the summoner's owner cannot open it.
  await t.run((ctx) =>
    ctx.db.patch('character', eidolonId, {
      campaignId: undefined,
      sheetDemo: true,
    }),
  );
  const form = await owner.query(api.characterSheetCombinedForm.read, {
    characterId,
  });
  expect(form).toMatchObject({
    status: 'unresolved',
    eidolon: null,
    unresolved: [{ reason: 'eidolonUnavailable' }],
    abilities: expect.arrayContaining([
      expect.objectContaining({ ability: 'strength', score: null }),
    ]),
  });
  expect(JSON.stringify(form)).not.toContain('Brightwing');
  expect(JSON.stringify(form)).not.toContain(eidolonId);
  const outsider = t.withIdentity({ tokenIdentifier: 'test|outsider' });
  await t.run((ctx) =>
    ctx.db.insert('user', {
      tokenIdentifier: 'test|outsider',
      orgIds: [{ orgId: 'elsewhere', role: 'member' }],
      characterSheetDemo: true,
    }),
  );
  const refused = await outsider
    .query(api.characterSheetCombinedForm.read, { characterId })
    .then(
      () => null,
      (error: unknown) => String(error),
    );
  expect(refused).not.toBeNull();
  expect(refused).not.toContain('Calder');
  expect(refused).not.toContain('Brightwing');
});

test('an eidolon calculation failure surfaces instead of reading as an unavailable eidolon', async () => {
  const { t, member, characterId, eidolonId } = await fixture(4);
  // A stored fractional score the eidolon's own calculation rejects.
  await t.run(async (ctx) => {
    const base = (
      await ctx.db
        .query('characterSheetEntry')
        .withIndex('by_characterId', (q) => q.eq('characterId', eidolonId))
        .collect()
    ).find((entry) => entry.kind === 'base');
    if (base?.kind !== 'base' || !base.catalogEntryId)
      throw new Error('Missing eidolon scores');
    const scores = await ctx.db.get('catalogEntry', base.catalogEntryId);
    if (!scores) throw new Error('Missing eidolon scores');
    await ctx.db.patch('catalogEntry', scores._id, {
      modifiers: scores.modifiers.map((modifier) =>
        modifier.target === 'ability.str'
          ? { ...modifier, value: 16.5 }
          : modifier,
      ),
    });
  });
  await expect(
    member.query(api.characterSheetCombinedForm.read, { characterId }),
  ).rejects.toThrow(/whole/i);
});

test('a Synthesist on Unchained summoner levels has no assumed Combined Form', async () => {
  const { owner, member, characterId, initialLevelId } = await fixture(4);
  await owner.mutation(api.characterSheet.switchClassVersion, {
    characterId,
    entryId: initialLevelId,
    classEntryId: await catalogId(owner, characterId, 'unchained-summoner'),
    operationId: 'unchained',
  });
  expect(
    await member.query(api.characterSheetCombinedForm.read, { characterId }),
  ).toMatchObject({
    status: 'unresolved',
    unresolved: [{ reason: 'unchainedSummoner' }],
    baseAttackBonus: { total: null },
  });
});

type Client = ReturnType<ReturnType<typeof convexTest>['withIdentity']>;
async function read(client: Client, characterId: Id<'character'>) {
  return client.query(api.characterSheet.read, { characterId });
}
async function catalogId(
  client: Client,
  characterId: Id<'character'>,
  ruleIdentity: string,
) {
  const found = withSheetCatalog(
    await read(client, characterId),
  )?.catalogEntries.find((entry) => entry.ruleIdentity === ruleIdentity);
  if (!found) throw new Error(`Missing seeded ${ruleIdentity}`);
  return found._id;
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
        namespace: 'synthesist',
        version: 1,
        workerKey: '0',
        caseKey: 'synthesist',
        campaignKey: 'synthesist',
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
  const summonerId = await catalogId(owner, characterId, 'summoner');
  const fighterId = await catalogId(owner, characterId, 'fighter');
  const synthesistId = await catalogId(
    owner,
    characterId,
    'summoner-synthesist',
  );
  const initial = (await read(owner, characterId))?.entries.find(
    (entry) => entry.kind === 'classLevel',
  );
  if (!initial) throw new Error('Missing initial level');
  await owner.mutation(api.characterSheet.editClassLevel, {
    characterId,
    entryId: initial._id,
    classEntryId: summonerId,
    hpGained: 8,
    operationId: 'summoner-one',
  });
  /**
   * Seeds `count` more Class Levels of a class in one write, then adds the
   * last with `addClassLevel` so the sheet records the change.
   */
  const addLevels = async (classEntryId: Id<'catalogEntry'>, count: number) => {
    await t.run(async (ctx) => {
      const levels = (
        await ctx.db
          .query('characterSheetEntry')
          .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
          .collect()
      ).filter((entry) => entry.kind === 'classLevel');
      for (let index = 0; index < count - 1; index++)
        await ctx.db.insert('characterSheetEntry', {
          characterId,
          kind: 'classLevel',
          active: true,
          state: {
            kind: 'classLevel',
            classEntryId,
            position: levels.length + index + 1,
            hpGained: 8,
          },
        });
    });
    await owner.mutation(api.characterSheet.addClassLevel, {
      characterId,
      classEntryId,
      operationId: `levels-${classEntryId}-${count}`,
    });
  };
  if (summonerLevel > 1) await addLevels(summonerId, summonerLevel - 1);
  await owner.mutation(setArchetype, {
    characterId,
    classEntryId: summonerId,
    catalogEntryId: synthesistId,
    selected: true,
    operationId: 'synthesist',
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
    fighterId,
    synthesistId,
    initialLevelId: initial._id,
    addLevels,
  };
}
