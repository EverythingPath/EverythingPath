// @vitest-environment edge-runtime
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';
import { seedAcceptedCampaign } from './lib/acceptedCampaignFixture';
import {
  maxCharacterChildRows,
  readCharacterSheetData,
} from './lib/characterSheetData';
import { calculateMilitiaCharacterFacts } from './lib/militiaCharacterFacts';
import type { CharacterSheetRacialProgression } from '../src/lib/character-sheet';

const modules = import.meta.glob('./**/*.ts');

test.each([
  { hitDice: 7, racialHitDice: 0 },
  { hitDice: 2, racialHitDice: 3 },
])(
  'militia facts keep racial HD independent of actual HD: $hitDice actual, $racialHitDice racial',
  async ({ hitDice, racialHitDice }) => {
    const { t, scope } = await fixture();
    const facts = await t.run(async (ctx) => {
      const character = await ctx.db.get('character', scope.characterId);
      if (!character) throw new Error('Missing character');
      const sheet = await readCharacterSheetData(ctx, character);
      const projected = {
        ...sheet,
        permanentCalculated: {
          ...sheet.permanentCalculated,
          hitDice,
          racialHitDice,
        },
      };
      return await calculateMilitiaCharacterFacts(ctx, character, projected);
    });
    expect(facts.level).toBe(1);
    if (racialHitDice === 0) expect(facts).not.toHaveProperty('racialHitDice');
    else expect(facts.racialHitDice).toBe(3);
  },
);

test.each([0, 3])(
  'HP and ranks saved with the form’s null progression preserve a %s-HD race definition',
  async (racialHitDice) => {
    const { t, owner, scope, catalog } = await fixture();
    if (racialHitDice > 0)
      await t.run((ctx) =>
        ctx.db.patch('catalogEntry', catalog.human, {
          detail: {
            kind: 'race',
            racialTraits: [catalog.ability],
            racialHitDice,
          },
        }),
      );
    await owner.mutation(api.characterSheet.selectRace, {
      ...scope,
      catalogEntryId: catalog.human,
      operationId: 'race',
    });
    const before = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    const race = before?.entries.find((entry) => entry.kind === 'race');
    if (!race) throw new Error('Missing race');
    const payload = {
      ...scope,
      entryId: race._id,
      racialHitDice,
      racialProgression: null,
      racialHpGained: 7,
      racialSkillRanks: { per: 1 },
      operationId: 'hp-and-ranks',
    };
    await owner.mutation(api.characterSheet.editRaceStatistics, payload);
    const saved = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    expect(
      saved?.entries.find((entry) => entry._id === race._id),
    ).toMatchObject({
      catalogEntryId: catalog.human,
      state: { racialHpGained: 7, racialSkillRanks: { per: 1 } },
    });
    expect(
      saved?.entries.find((entry) => entry._id === race._id),
    ).not.toHaveProperty('catalogOverride');
    expect(saved?.catalogEntries).toEqual(before?.catalogEntries);
    await owner.mutation(api.characterSheet.editRaceStatistics, {
      ...payload,
      operationId: 'same-hp-and-ranks',
    });
    const repeated = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    expect(repeated?.revision).toBe(saved?.revision);
    expect(repeated?.catalogEntries).toEqual(before?.catalogEntries);
  },
);

test('members save custom fixed racial HD and editable progression without inventing Class Levels', async () => {
  const { owner, member, scope, catalog } = await fixture();
  await member.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: catalog.human,
    operationId: 'race',
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const race = before?.entries.find((entry) => entry.kind === 'race');
  if (!race) throw new Error('Missing race');
  await member.mutation(api.characterSheet.editRaceStatistics, {
    ...scope,
    entryId: race._id,
    racialHitDice: 3,
    racialProgression: {
      creatureType: 'Dragon',
      hitDie: 10,
      bab: 'full',
      saves: { fort: 'good', ref: 'good', will: 'good' },
      skillRanksPerHitDie: 6,
      classSkills: ['per'],
    },
    racialHpGained: 17,
    racialSkillRanks: { per: 3 },
    operationId: 'custom',
  });
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(saved?.calculated).toMatchObject({ level: 1, hitDice: 4, hp: null });
  const savedRace = saved?.entries.find((entry) => entry._id === race._id);
  if (savedRace?.kind !== 'race') throw new Error('Missing customized race');
  expect(savedRace.catalogEntryId).not.toBe(catalog.human);
  expect(
    saved?.catalogEntries.find(
      (entry) => entry._id === savedRace.catalogEntryId,
    ),
  ).toMatchObject({
    ruleIdentity: 'test-human',
    detail: {
      racialTraits: [catalog.ability],
      racialHitDice: 3,
      racialProgression: {
        creatureType: 'Dragon',
        hitDie: 10,
        classSkills: ['per'],
      },
    },
  });
  expect(
    saved?.catalogEntries.find((entry) => entry._id === catalog.human)?.detail,
  ).toEqual({ kind: 'race', racialTraits: [catalog.ability] });
  expect(saved?.entries.filter((entry) => entry.kind === 'classLevel')).toEqual(
    before?.entries.filter((entry) => entry.kind === 'classLevel'),
  );
  expect(saved?.entries.find((entry) => entry._id === race._id)).toMatchObject({
    state: { racialHpGained: 17, racialSkillRanks: { per: 3 } },
  });
});

test('reselecting a customized race keeps its statistics copy until the player discards it, preserving recorded state', async () => {
  const { owner, scope, catalog } = await fixture();
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: catalog.human,
    operationId: 'race',
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const race = before?.entries.find((entry) => entry.kind === 'race');
  if (!race) throw new Error('Missing race');
  for (const racialHitDice of [1, 2, 3]) {
    await owner.mutation(api.characterSheet.editRaceStatistics, {
      ...scope,
      entryId: race._id,
      racialHitDice,
      racialHpGained: 7,
      racialSkillRanks: { per: 1 },
      operationId: `custom-${racialHitDice}`,
    });
    const customized = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    expect(customized?.catalogEntries).toHaveLength(
      (before?.catalogEntries.length ?? 0) + 1,
    );
    await owner.mutation(api.characterSheet.selectRace, {
      ...scope,
      catalogEntryId: catalog.human,
      operationId: `original-${racialHitDice}`,
    });
    const reselected = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    expect(reselected?.catalogEntries).toEqual(customized?.catalogEntries);
    expect(reselected?.entries.find((entry) => entry._id === race._id)).toEqual(
      customized?.entries.find((entry) => entry._id === race._id),
    );
    await owner.mutation(api.characterSheet.discardRaceStatistics, {
      ...scope,
      entryId: race._id,
      operationId: `discard-${racialHitDice}`,
    });
    const restored = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    expect(restored?.catalogEntries).toEqual(before?.catalogEntries);
    expect(
      restored?.entries.find((entry) => entry._id === race._id),
    ).toMatchObject({
      catalogEntryId: catalog.human,
      state: { racialHpGained: 7, racialSkillRanks: { per: 1 } },
    });
  }
});

// Gnoll is the pinned Foundry race record ITHs6VCRdSQUsoen: a Medium humanoid
// with the gnoll subtype, citing Bestiary p. 155, imported with no racial Hit
// Dice. The count and progression below are the player's custom statistics,
// fixture choices rather than values from that record.
const gnollProgression = {
  creatureType: 'Humanoid',
  hitDie: 8,
  bab: 'threeQuarters',
  saves: { fort: 'good', ref: 'poor', will: 'poor' },
  skillRanksPerHitDie: 2,
  classSkills: ['clm', 'per', 'sur'],
} satisfies CharacterSheetRacialProgression;
async function createCustomizedGnollFixture() {
  const { t, owner, scope } = await fixture();
  const gnoll = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'Gnoll',
      ruleIdentity: 'gnoll',
      sourceKey: 'pf1/ITHs6VCRdSQUsoen',
      stacksWithItself: false,
      modifiers: [],
      sources: [{ book: 'Pathfinder RPG Bestiary', pages: '155' }],
      detail: {
        kind: 'race',
        racialHitDice: 0,
        size: 'medium',
        creatureTypes: ['humanoid'],
        creatureSubtypes: ['gnoll'],
        racialTraits: [],
      },
    }),
  );
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: gnoll,
    operationId: 'gnoll',
  });
  const selected = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const race = selected?.entries.find((entry) => entry.kind === 'race');
  const human = selected?.catalogEntries.find(
    (entry) => entry.ruleIdentity === 'human',
  );
  if (!race || !human) throw new Error('Missing race or seeded Human');
  await owner.mutation(api.characterSheet.editRaceStatistics, {
    ...scope,
    entryId: race._id,
    racialHitDice: 2,
    racialProgression: gnollProgression,
    racialHpGained: 9,
    operationId: 'gnoll-statistics',
  });
  const customized = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const customizedRace = customized?.entries.find(
    (entry) => entry._id === race._id,
  );
  if (customizedRace?.kind !== 'race' || !customized)
    throw new Error('Missing customized race');
  return {
    t,
    owner,
    scope,
    gnoll,
    human: human._id,
    raceId: race._id,
    copyId: customizedRace.catalogEntryId,
    customized,
  };
}

test('switching away from a race with custom racial Hit Dice and back restores its statistics without piling up copies', async () => {
  const { owner, scope, gnoll, human, raceId, copyId, customized } =
    await createCustomizedGnollFixture();
  expect(copyId).not.toBe(gnoll);
  expect(customized.calculated.hitDice).toBe(3);
  const statisticsCopies = (sheet: typeof customized | null | undefined) =>
    sheet?.catalogEntries.flatMap((entry) =>
      entry.racialStatisticsCopy ? [entry._id] : [],
    );
  expect(statisticsCopies(customized)).toEqual([copyId]);
  for (const round of [1, 2, 3]) {
    await owner.mutation(api.characterSheet.selectRace, {
      ...scope,
      catalogEntryId: human,
      operationId: `human-${round}`,
    });
    const away = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    expect(away?.calculated.hitDice).toBe(1);
    await owner.mutation(api.characterSheet.selectRace, {
      ...scope,
      catalogEntryId: gnoll,
      operationId: `gnoll-${round}`,
    });
    const back = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    expect(back?.entries.find((entry) => entry._id === raceId)).toMatchObject({
      active: true,
      catalogEntryId: copyId,
      catalogOverride: true,
      state: { racialHpGained: 9 },
    });
    expect(
      back?.catalogEntries.find((entry) => entry._id === copyId),
    ).toMatchObject({
      racialStatisticsCopy: true,
      copiedFrom: gnoll,
      detail: { racialHitDice: 2, racialProgression: gnollProgression },
    });
    expect(back?.calculated.hitDice).toBe(3);
    // Two Hit Dice: the CRB cleric table's 2nd-level row (p. 40) gives BAB +1,
    // good Fortitude +3 and poor Reflex +0; the fixture applies that same poor
    // progression to Will, so Will is +0 too.
    for (const [target, value] of [
      ['bab', 1],
      ['save.fort', 3],
      ['save.ref', 0],
      ['save.will', 0],
    ] as const)
      expect(back?.calculated.breakdowns[target].applied).toContainEqual(
        expect.objectContaining({ source: 'builtin:racial', value }),
      );
    expect(
      back?.calculated.skills
        .filter((skill) => skill.classSkill)
        .map((skill) => skill.key),
    ).toEqual(['skill.clm', 'skill.per', 'skill.sur']);
    expect(statisticsCopies(back)).toEqual([copyId]);
  }
});

test('discarding custom racial statistics returns the race to its original definition and deletes the unused copy', async () => {
  const { owner, scope, gnoll, raceId, copyId } =
    await createCustomizedGnollFixture();
  await owner.mutation(api.characterSheet.discardRaceStatistics, {
    ...scope,
    entryId: raceId,
    operationId: 'discard',
  });
  const discarded = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const race = discarded?.entries.find((entry) => entry._id === raceId);
  expect(race).toMatchObject({
    active: true,
    catalogEntryId: gnoll,
    state: { racialHpGained: 9 },
  });
  expect(race).not.toHaveProperty('catalogOverride');
  expect(
    discarded?.catalogEntries.some(
      (entry) => entry._id === copyId || entry.racialStatisticsCopy,
    ),
  ).toBe(false);
  expect(discarded?.calculated.hitDice).toBe(1);
  await owner.mutation(api.characterSheet.discardRaceStatistics, {
    ...scope,
    entryId: raceId,
    operationId: 'discard-again',
  });
  const repeated = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(repeated?.revision).toBe(discarded?.revision);
});

test('discarding statistics whose original race was deleted falls back to the campaign’s version of that race', async () => {
  const { t, owner, scope, gnoll, raceId, copyId } =
    await createCustomizedGnollFixture();
  const campaignGnoll = await owner.mutation(
    api.catalogCopies.customizeForCampaign,
    { ...scope, catalogEntryId: gnoll, operationId: 'campaign-gnoll' },
  );
  await t.run((ctx) => ctx.db.delete('catalogEntry', gnoll));
  await owner.mutation(api.characterSheet.discardRaceStatistics, {
    ...scope,
    entryId: raceId,
    operationId: 'discard',
  });
  const discarded = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    discarded?.entries.find((entry) => entry._id === raceId),
  ).toMatchObject({
    active: true,
    catalogEntryId: campaignGnoll,
    state: { racialHpGained: 9 },
  });
  expect(discarded?.catalogEntries.some((entry) => entry._id === copyId)).toBe(
    false,
  );
  expect(discarded?.calculated.hitDice).toBe(1);
});

test('discarding statistics whose original race was deleted, with no other version of it, leaves the race unset', async () => {
  const { t, owner, scope, gnoll, raceId, copyId } =
    await createCustomizedGnollFixture();
  await t.run((ctx) => ctx.db.delete('catalogEntry', gnoll));
  await owner.mutation(api.characterSheet.discardRaceStatistics, {
    ...scope,
    entryId: raceId,
    operationId: 'discard',
  });
  const discarded = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(discarded?.entries.some((entry) => entry.kind === 'race')).toBe(false);
  expect(discarded?.catalogEntries.some((entry) => entry._id === copyId)).toBe(
    false,
  );
  expect(discarded?.calculated.hitDice).toBe(1);
});

test('a kept statistics copy counts toward the Character row cap, and editing it in place still works at the cap', async () => {
  const { t, owner, scope, gnoll, human, raceId, copyId } =
    await createCustomizedGnollFixture();
  await t.run(async (ctx) => {
    const local = await ctx.db
      .query('catalogEntry')
      .withIndex('by_characterId_and_browseOnly', (q) =>
        q.eq('characterId', scope.characterId).eq('browseOnly', undefined),
      )
      .take(maxCharacterChildRows);
    for (let index = local.length; index < maxCharacterChildRows; index++)
      await ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId: scope.characterId,
        name: `Unused local ${index}`,
        ruleIdentity: `unused-local-${index}`,
        stacksWithItself: false,
        modifiers: [],
        sources: [],
        detail: { kind: 'feat' },
      });
  });
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: human,
    operationId: 'human',
  });
  const away = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const humanRow = away?.entries.find(
    (entry) => entry.kind === 'race' && entry.active,
  );
  if (!humanRow) throw new Error('Missing Human');
  await expect(
    owner.mutation(api.characterSheet.editRaceStatistics, {
      ...scope,
      entryId: humanRow._id,
      racialHitDice: 1,
      operationId: 'human-statistics',
    }),
  ).rejects.toThrow('Character sheet is too large');
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: gnoll,
    operationId: 'gnoll-again',
  });
  await owner.mutation(api.characterSheet.editRaceStatistics, {
    ...scope,
    entryId: raceId,
    racialHitDice: 3,
    operationId: 'gnoll-at-cap',
  });
  const atCap = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(atCap?.entries.find((entry) => entry._id === raceId)).toMatchObject({
    catalogEntryId: copyId,
  });
  expect(
    atCap?.catalogEntries.flatMap((entry) =>
      entry.racialStatisticsCopy ? [entry.detail] : [],
    ),
  ).toEqual([expect.objectContaining({ racialHitDice: 3 })]);
});

test('racial statistics edit a Character’s own homebrew race in place, while campaign homebrew still gets a statistics copy', async () => {
  const { owner, scope } = await fixture();
  // The race a player makes with the sheet's "New one-off" form.
  const entryId = await owner.mutation(api.catalogCopies.createOneOff, {
    ...scope,
    definition: {
      name: 'Hyena-kin',
      modifiers: [],
      stacksWithItself: false,
      sources: [],
      detail: { kind: 'race', racialTraits: [] },
    },
    operationId: 'homebrew-race',
  });
  const created = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const row = created?.entries.find((entry) => entry._id === entryId);
  if (row?.kind !== 'race') throw new Error('Missing homebrew race');
  const homebrewId = row.catalogEntryId;
  await owner.mutation(api.characterSheet.editRaceStatistics, {
    ...scope,
    entryId,
    racialHitDice: 2,
    racialProgression: gnollProgression,
    operationId: 'homebrew-statistics',
  });
  const edited = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(edited?.entries.find((entry) => entry._id === entryId)).toMatchObject({
    catalogEntryId: homebrewId,
  });
  expect(
    edited?.catalogEntries.find((entry) => entry._id === homebrewId),
  ).toMatchObject({
    scope: 'character',
    detail: { racialHitDice: 2, racialProgression: gnollProgression },
  });
  expect(
    edited?.catalogEntries.some((entry) => entry.racialStatisticsCopy),
  ).toBe(false);
  expect(edited?.catalogEntries).toHaveLength(
    created?.catalogEntries.length ?? 0,
  );
  await owner.mutation(api.catalogCopies.saveToCatalog, {
    ...scope,
    catalogEntryId: homebrewId,
    operationId: 'campaign-homebrew',
  });
  await owner.mutation(api.characterSheet.editRaceStatistics, {
    ...scope,
    entryId,
    racialHitDice: 3,
    operationId: 'campaign-homebrew-statistics',
  });
  const copied = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const copiedRow = copied?.entries.find((entry) => entry._id === entryId);
  if (copiedRow?.kind !== 'race') throw new Error('Missing race');
  expect(copiedRow.catalogEntryId).not.toBe(homebrewId);
  expect(
    copied?.catalogEntries.find(
      (entry) => entry._id === copiedRow.catalogEntryId,
    ),
  ).toMatchObject({
    scope: 'character',
    racialStatisticsCopy: true,
    copiedFrom: homebrewId,
    detail: { racialHitDice: 3 },
  });
  const picker = await owner.query(api.catalogCopies.list, scope);
  expect(picker.find((entry) => entry._id === homebrewId)).toMatchObject({
    scope: 'campaign',
    detail: { racialHitDice: 2 },
  });
});

test('prepared racial HD refresh current militia facts while character level stays separate', async () => {
  const { t, owner, scope, catalog } = await fixture();
  const seeded = await owner.run((ctx) =>
    seedAcceptedCampaign(ctx, scope.campaignId),
  );
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: catalog.human,
    operationId: 'race',
  });
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const race = initial?.entries.find((entry) => entry.kind === 'race');
  if (!race) throw new Error('Missing race');
  await owner.mutation(api.characterSheet.editRaceStatistics, {
    ...scope,
    entryId: race._id,
    racialHitDice: 3,
    operationId: 'hd',
  });
  const ledger = await owner.query(api.canonicalLedger.read, {
    campaignId: scope.campaignId,
    militiaId: seeded.key.militiaId,
  });
  expect(ledger.state.militiaSnapshot.characters).toContainEqual(
    expect.objectContaining({
      characterId: scope.characterId,
      level: 1,
      racialHitDice: 3,
    }),
  );
  await t.run((ctx) =>
    ctx.db.patch('campaign', scope.campaignId, { e2eFixture: undefined }),
  );
  await owner.mutation(api.character.updateCharacter, {
    organizationId: 'org',
    characterId: scope.characterId,
    patch: { level: 7 },
    operationId: 'production-legacy',
  });
  const production = await owner.query(api.canonicalLedger.read, {
    campaignId: scope.campaignId,
    militiaId: seeded.key.militiaId,
  });
  const facts = production.state.militiaSnapshot.characters.find(
    (character) => character.characterId === scope.characterId,
  );
  expect(facts?.level).toBe(7);
  expect(facts).not.toHaveProperty('racialHitDice');
});

test.each(['inactive race', 'replacement', 'catalog dependency', 'condition'])(
  'discarding racial statistics retains copies still used by a %s',
  async (reference) => {
    const { t, owner, scope, catalog } = await fixture();
    await owner.mutation(api.characterSheet.selectRace, {
      ...scope,
      catalogEntryId: catalog.human,
      operationId: 'race',
    });
    const initial = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    const race = initial?.entries.find((entry) => entry.kind === 'race');
    if (!race) throw new Error('Missing race');
    await owner.mutation(api.characterSheet.editRaceStatistics, {
      ...scope,
      entryId: race._id,
      racialHitDice: 2,
      operationId: 'custom',
    });
    const customized = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    const copiedRace = customized?.entries.find(
      (entry) => entry._id === race._id,
    );
    if (copiedRace?.kind !== 'race') throw new Error('Missing customized race');
    const copyId = copiedRace.catalogEntryId;
    await t.run(async (ctx) => {
      if (reference === 'inactive race')
        await ctx.db.insert('characterSheetEntry', {
          characterId: scope.characterId,
          kind: 'race',
          active: false,
          catalogEntryId: copyId,
          state: { kind: 'race' },
        });
      if (reference === 'replacement')
        await ctx.db.insert('characterSheetEntry', {
          characterId: scope.characterId,
          kind: 'racialTrait',
          active: false,
          catalogEntryId: catalog.alternate,
          state: { kind: 'racialTrait', replaces: [copyId] },
        });
      if (reference === 'catalog dependency')
        await ctx.db.patch('catalogEntry', catalog.alternate, {
          detail: {
            kind: 'racialTrait',
            raceEntryIds: [catalog.human, copyId],
            replaces: [catalog.ability],
          },
        });
      if (reference === 'condition')
        await ctx.db.patch('catalogEntry', catalog.alternate, {
          modifiers: [
            {
              target: 'ability.str',
              value: 2,
              bonusType: 'racial',
              condition: { whileActive: copyId },
            },
          ],
        });
    });
    await owner.mutation(api.characterSheet.discardRaceStatistics, {
      ...scope,
      entryId: race._id,
      operationId: 'discard',
    });
    const restored = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    expect(
      restored?.catalogEntries.find((entry) => entry._id === copyId),
    ).toMatchObject({
      racialStatisticsCopy: true,
      detail: { racialHitDice: 2 },
    });
    expect(
      restored?.entries.find((entry) => entry._id === race._id),
    ).toMatchObject({
      catalogEntryId: catalog.human,
    });
  },
);

test.each<{ ranks: Record<string, number>; message: string }>([
  { ranks: { Perception: 2 }, message: 'Choose a valid skill' },
  { ranks: { 'skill.unknown': 1 }, message: 'Choose a valid skill' },
  { ranks: { per: 1, 'skill.per': 2 }, message: 'Choose each skill once' },
])(
  'racial ranks reject unknown or repeated skills ($ranks)',
  async ({ ranks, message }) => {
    const { owner, scope, catalog } = await fixture();
    await owner.mutation(api.characterSheet.selectRace, {
      ...scope,
      catalogEntryId: catalog.human,
      operationId: 'race',
    });
    const before = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    const race = before?.entries.find((entry) => entry.kind === 'race');
    if (!race) throw new Error('Missing race');
    await expect(
      owner.mutation(api.characterSheet.editRaceStatistics, {
        ...scope,
        entryId: race._id,
        racialSkillRanks: ranks,
        operationId: 'invalid-ranks',
      }),
    ).rejects.toThrow(message);
    const after = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    expect(after?.entries).toEqual(before?.entries);
    expect(after?.catalogEntries).toEqual(before?.catalogEntries);
    expect(after?.revision).toBe(before?.revision);
  },
);

test.each([
  {
    classSkills: Array.from({ length: 257 }, () => 'per'),
    message: 'Choose at most 256 class skills',
  },
  { classSkills: [' '], message: 'Choose a named class skill' },
])(
  'racial progression validates class-skill count and names separately ($message)',
  async ({ classSkills, message }) => {
    const { owner, scope, catalog } = await fixture();
    await owner.mutation(api.characterSheet.selectRace, {
      ...scope,
      catalogEntryId: catalog.human,
      operationId: 'race',
    });
    const before = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    const race = before?.entries.find((entry) => entry.kind === 'race');
    if (!race) throw new Error('Missing race');
    await expect(
      owner.mutation(api.characterSheet.editRaceStatistics, {
        ...scope,
        entryId: race._id,
        racialProgression: {
          creatureType: 'Dragon',
          hitDie: 12,
          bab: 'full',
          saves: { fort: 'good', ref: 'good', will: 'good' },
          skillRanksPerHitDie: 6,
          classSkills,
        },
        operationId: 'invalid-class-skills',
      }),
    ).rejects.toThrow(message);
    const after = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    expect(after?.catalogEntries).toEqual(before?.catalogEntries);
    expect(after?.revision).toBe(before?.revision);
  },
);

test('racial progression edits preserve the custom copy and prune warnings while zero HD and missing progression remain valid', async () => {
  const { owner, scope, catalog } = await fixture();
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: catalog.human,
    operationId: 'race',
  });
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const race = initial?.entries.find((entry) => entry.kind === 'race');
  if (!race) throw new Error('Missing race');
  await owner.mutation(api.characterSheet.editRaceStatistics, {
    ...scope,
    entryId: race._id,
    racialHitDice: 1,
    racialSkillRanks: { per: 2 },
    operationId: 'over-cap',
  });
  const overCap = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const warning = overCap?.calculated.warnings.find(
    (warning) => warning.check === 'racialSkillRankCap',
  );
  const customized = overCap?.entries.find((entry) => entry._id === race._id);
  if (!warning || customized?.kind !== 'race')
    throw new Error('Missing warning or race');
  expect(overCap?.calculated.warnings).toContainEqual(
    expect.objectContaining({
      check: 'racialProgressionMissing',
      kind: 'unresolved',
    }),
  );
  expect(customized.state.racialHpGained).toBeUndefined();
  await owner.mutation(api.characterSheet.acceptWarning, {
    ...scope,
    check: warning.check,
    subject: warning.subject,
    fingerprint: warning.fingerprint,
    operationId: 'accept',
  });
  await owner.mutation(api.characterSheet.editRaceStatistics, {
    ...scope,
    entryId: race._id,
    racialHitDice: 2,
    racialProgression: {
      creatureType: 'Custom',
      hitDie: 7,
      bab: 'half',
      saves: { fort: 'poor', ref: 'good', will: 'poor' },
      skillRanksPerHitDie: 9,
      classSkills: ['per'],
    },
    operationId: 'custom-progression',
  });
  const resolved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    resolved?.entries.find((entry) => entry._id === race._id),
  ).toMatchObject({ catalogEntryId: customized.catalogEntryId });
  expect(resolved?.acceptedWarnings).not.toContainEqual(
    expect.objectContaining({ check: 'racialSkillRankCap' }),
  );
  await owner.mutation(api.characterSheet.editRaceStatistics, {
    ...scope,
    entryId: race._id,
    racialHitDice: 0,
    racialProgression: null,
    operationId: 'zero',
  });
  const zero = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(zero?.calculated).toMatchObject({ level: 1, hitDice: 1 });
  expect(
    zero?.catalogEntries.find(
      (entry) => entry._id === customized.catalogEntryId,
    )?.detail,
  ).not.toHaveProperty('racialProgression');
  expect(zero?.entries.find((entry) => entry._id === race._id)).toMatchObject({
    state: { racialSkillRanks: { per: 2 } },
  });
});

async function fixture() {
  const t = convexTest(schema, modules);
  const campaignId = await t.run(async (ctx) => {
    for (const [name, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `test|${name}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    return ctx.db.insert('campaign', {
      name: 'Races',
      description: '',
      organizationId: 'org',
      ownerId: 'test|owner',
      e2eFixture: {
        namespace: 'races',
        version: 1,
        workerKey: '0',
        caseKey: 'races',
        campaignKey: 'races',
      },
    });
  });
  const owner = t.withIdentity({ tokenIdentifier: 'test|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'test|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'test|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Vessa',
    kind: 'pc',
    operationId: 'create',
  });
  const scope = { organizationId: 'org', campaignId, characterId };
  const catalog = await t.run(async (ctx) => {
    const human = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: 'Test Human',
      ruleIdentity: 'test-human',
      stacksWithItself: false,
      modifiers: [],
      sources: [],
      detail: { kind: 'race', racialTraits: [] },
    });
    const ability = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: 'Test ability',
      ruleIdentity: 'test-ability',
      stacksWithItself: false,
      modifiers: [{ target: 'ability.$choice', bonusType: 'racial', value: 2 }],
      sources: [],
      detail: { kind: 'racialTrait', raceEntryIds: [human], replaces: [] },
    });
    await ctx.db.patch('catalogEntry', human, {
      detail: { kind: 'race', racialTraits: [ability] },
    });
    const elf = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: 'Test Elf',
      ruleIdentity: 'test-elf',
      stacksWithItself: false,
      modifiers: [],
      sources: [],
      detail: { kind: 'race', racialTraits: [] },
    });
    const alternate = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: 'Test alternate',
      ruleIdentity: 'test-alternate',
      stacksWithItself: false,
      modifiers: [],
      sources: [],
      detail: {
        kind: 'racialTrait',
        raceEntryIds: [human],
        replaces: [ability],
      },
    });
    return { human, ability, elf, alternate };
  });
  return { t, owner, member, outsider, scope, catalog };
}

test.each([true, false])(
  'standard Bonus Feat and its Catalog Copy cannot be selected or deselected (%s)',
  async (selected) => {
    const { t, owner, scope, catalog } = await fixture();
    const bonusFeat = await t.run(async (ctx) => {
      const id = await ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId: scope.characterId,
        name: 'Bonus Feat',
        ruleIdentity: 'test-bonus-feat',
        stacksWithItself: false,
        modifiers: [],
        sources: [],
        grantsSlots: [{ kind: 'feat', count: 1 }],
        detail: {
          kind: 'racialTrait',
          raceEntryIds: [catalog.human],
          replaces: [],
        },
      });
      await ctx.db.patch('catalogEntry', catalog.human, {
        detail: { kind: 'race', racialTraits: [catalog.ability, id] },
      });
      const copy = await ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId: scope.characterId,
        name: 'Copied Bonus Feat',
        ruleIdentity: 'test-bonus-feat',
        stacksWithItself: false,
        modifiers: [],
        sources: [],
        grantsSlots: [{ kind: 'feat', count: 1 }],
        detail: {
          kind: 'racialTrait',
          raceEntryIds: [catalog.human],
          replaces: [],
        },
      });
      return { id, copy };
    });
    await owner.mutation(api.characterSheet.selectRace, {
      ...scope,
      catalogEntryId: catalog.human,
      operationId: 'human',
    });
    for (const catalogEntryId of [bonusFeat.id, bonusFeat.copy]) {
      await expect(
        owner.mutation(api.characterSheet.setRacialTraitSelected, {
          ...scope,
          catalogEntryId,
          selected,
          operationId: 'standard',
        }),
      ).rejects.toThrow('Standard Racial Traits are granted by their race');
      await expect(
        owner.mutation(api.characterSheet.selectEntry, {
          ...scope,
          catalogEntryId,
          operationId: 'generic-standard',
        }),
      ).rejects.toThrow('Standard Racial Traits are granted by their race');
    }
    const sheet = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    const counting = sheet!.calculated.resolvedEntries.filter(
      (row) =>
        row.counting &&
        row.entry.kind === 'racialTrait' &&
        (row.entry.catalogEntryId === bonusFeat.id ||
          row.entry.catalogEntryId === bonusFeat.copy),
    );
    expect(counting).toHaveLength(1);
    expect(
      counting[0]?.entry.kind === 'racialTrait'
        ? counting[0].entry.grantKey
        : undefined,
    ).toEqual({
      source: 'test-human',
      entry: 'test-bonus-feat',
    });
    expect(
      sheet!.entries.filter(
        (entry) => entry.kind === 'racialTrait' && !entry.grantKey,
      ),
    ).toHaveLength(0);
  },
);

test('editing an alternate Selection cannot replace it with a standard Racial Trait', async () => {
  const { owner, scope, catalog } = await fixture();
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: catalog.human,
    operationId: 'human',
  });
  const entryId = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: catalog.alternate,
    operationId: 'alternate',
  });
  await expect(
    owner.mutation(api.characterSheet.editSelection, {
      ...scope,
      entryId,
      catalogEntryId: catalog.ability,
      operationId: 'replace-with-standard',
    }),
  ).rejects.toThrow('Standard Racial Traits are granted by their race');
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(sheet?.entries.find((entry) => entry._id === entryId)).toMatchObject({
    catalogEntryId: catalog.alternate,
    state: { kind: 'racialTrait' },
  });
});

test('personal adjustments cannot target a racial ability score choice', async () => {
  const { owner, scope } = await fixture();
  await expect(
    owner.mutation(api.characterSheet.createPersonalAdjustment, {
      ...scope,
      name: 'Invalid choice',
      modifiers: [
        {
          // @ts-expect-error Catalog-only choices are not manual Modifier targets.
          target: 'ability.$choice',
          bonusType: 'racial',
          value: 2,
        },
      ],
      operationId: 'personal-choice',
    }),
  ).rejects.toThrow();
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(sheet?.entries.some((entry) => entry.kind === 'manual')).toBe(false);
});

test('members select one race without adding to base scores and restore its chosen Grant after a race round trip', async () => {
  const { owner, member, scope, catalog } = await fixture();
  await member.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: catalog.human,
    operationId: 'human',
  });
  const human = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(human?.calculated.abilities.strength.score).toBe(10);
  await member.mutation(api.characterSheet.chooseRacialAbilityScore, {
    ...scope,
    target: { grantKey: { source: 'test-human', entry: 'test-ability' } },
    ability: 'strength',
    operationId: 'choice',
  });
  const chosen = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(chosen?.calculated.abilities.strength.score).toBe(12);
  expect(
    chosen?.baseScoresEntry.modifiers.find(
      (modifier) => modifier.target === 'ability.str',
    )?.value,
  ).toBe(10);
  const recorded = chosen?.entries.find(
    (entry) => entry.kind === 'racialTrait',
  );
  await member.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: catalog.elf,
    operationId: 'elf',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.calculated.abilities.strength.score,
  ).toBe(10);
  await member.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: catalog.human,
    operationId: 'human-again',
  });
  const restored = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(restored?.calculated.abilities.strength.score).toBe(12);
  expect(
    restored?.entries.find((entry) => entry._id === recorded?._id),
  ).toMatchObject({ state: { choice: 'strength' } });
  expect(
    restored?.entries.filter((entry) => entry.kind === 'race' && entry.active),
  ).toHaveLength(1);
});

test('changing or clearing a selected racial ability preserves its recorded choice order and Class Level', async () => {
  const { t, owner, scope, catalog } = await fixture();
  await t.run((ctx) =>
    ctx.db.patch('catalogEntry', catalog.alternate, {
      modifiers: [{ target: 'ability.$choice', bonusType: 'racial', value: 2 }],
    }),
  );
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: catalog.human,
    operationId: 'human',
  });
  const classLevelId = await owner.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    operationId: 'level',
  });
  const entryId = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: catalog.alternate,
    choice: 'strength',
    gainedAtClassLevel: classLevelId,
    choiceOrder: 0,
    operationId: 'alternate',
  });
  for (const ability of ['dexterity', null] as const) {
    await owner.mutation(api.characterSheet.chooseRacialAbilityScore, {
      ...scope,
      target: { entryId },
      ability,
      operationId: ability ?? 'clear',
    });
    const sheet = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    expect(sheet?.entries.find((entry) => entry._id === entryId)).toMatchObject(
      {
        kind: 'racialTrait',
        choiceOrder: 0,
        gainedAtClassLevel: classLevelId,
        state: { kind: 'racialTrait', choice: ability },
      },
    );
  }
});

test('switching an alternate off restores the same ability choice and reselecting retains the alternate row', async () => {
  const { owner, scope, catalog } = await fixture();
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: catalog.human,
    operationId: 'human',
  });
  await owner.mutation(api.characterSheet.chooseRacialAbilityScore, {
    ...scope,
    target: { grantKey: { source: 'test-human', entry: 'test-ability' } },
    ability: 'dexterity',
    operationId: 'choice',
  });
  await owner.mutation(api.characterSheet.setRacialTraitSelected, {
    ...scope,
    catalogEntryId: catalog.alternate,
    selected: true,
    operationId: 'alternate',
  });
  const replaced = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const alternate = replaced?.entries.find(
    (entry) => entry.kind === 'racialTrait' && !entry.grantKey,
  );
  expect(replaced?.calculated.abilities.dexterity.score).toBe(10);
  await owner.mutation(api.characterSheet.setRacialTraitSelected, {
    ...scope,
    catalogEntryId: catalog.alternate,
    selected: false,
    operationId: 'off',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.calculated.abilities.dexterity.score,
  ).toBe(12);
  await owner.mutation(api.characterSheet.setRacialTraitSelected, {
    ...scope,
    catalogEntryId: catalog.alternate,
    selected: true,
    operationId: 'on',
  });
  const restored = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    restored?.entries.find((entry) => entry._id === alternate?._id)?.active,
  ).toBe(true);
  await owner.mutation(api.characterSheet.setRacialTraitSelected, {
    ...scope,
    catalogEntryId: catalog.alternate,
    selected: false,
    operationId: 'off-again',
  });
  await owner.mutation(api.characterSheet.chooseRacialAbilityScore, {
    ...scope,
    target: { grantKey: { source: 'test-human', entry: 'test-ability' } },
    ability: null,
    operationId: 'clear',
  });
  const cleared = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(cleared?.calculated.abilities.dexterity.score).toBe(10);
  expect(
    cleared?.calculated.warnings.some(
      (warning) =>
        warning.kind === 'incomplete' &&
        warning.subject.includes('test-ability'),
    ),
  ).toBe(true);
});

test('unresolved replacements use explicit local targets and every change prunes stale duplicate acceptance', async () => {
  const { t, owner, scope, catalog } = await fixture();
  const unresolved = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId: scope.characterId,
      name: 'Unresolved heritage',
      ruleIdentity: 'unresolved-heritage',
      stacksWithItself: false,
      modifiers: [],
      sources: [],
      detail: {
        kind: 'racialTrait',
        raceEntryIds: [catalog.human],
        replaces: [],
        unresolvedReplacements: ['ability score trait'],
      },
    }),
  );
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: catalog.human,
    operationId: 'human',
  });
  await owner.mutation(api.characterSheet.setRacialTraitSelected, {
    ...scope,
    catalogEntryId: catalog.alternate,
    selected: true,
    operationId: 'first-alternate',
  });
  await owner.mutation(api.characterSheet.setRacialTraitSelected, {
    ...scope,
    catalogEntryId: unresolved,
    selected: true,
    operationId: 'unresolved',
  });
  const pending = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const selection = pending?.entries.find(
    (entry) =>
      entry.kind === 'racialTrait' && entry.catalogEntryId === unresolved,
  );
  if (!selection) throw new Error('Missing alternate');
  expect(
    pending?.calculated.warnings.some(
      (warning) => warning.check === 'racialReplacementUnresolved',
    ),
  ).toBe(true);
  await owner.mutation(api.characterSheet.setRacialTraitReplacements, {
    ...scope,
    entryId: selection._id,
    replaces: [catalog.ability],
    operationId: 'manual',
  });
  const duplicate = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const warning = duplicate?.calculated.warnings.find(
    (warning) => warning.check === 'racialReplacementDuplicate',
  );
  if (!warning) throw new Error('Missing duplicate warning');
  expect(
    duplicate?.calculated.warnings.some(
      (warning) => warning.check === 'racialReplacementUnresolved',
    ),
  ).toBe(false);
  await owner.mutation(api.characterSheet.acceptWarning, {
    ...scope,
    check: warning.check,
    subject: warning.subject,
    fingerprint: warning.fingerprint,
    operationId: 'accept',
  });
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: catalog.elf,
    operationId: 'dormant',
  });
  const dormant = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    dormant?.calculated.warnings.some(
      (current) => current.check === 'racialReplacementDuplicate',
    ),
  ).toBe(false);
  expect(
    dormant?.acceptedWarnings.some(
      (accepted) => accepted.check === 'racialReplacementDuplicate',
    ),
  ).toBe(true);
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: catalog.human,
    operationId: 'restore-source',
  });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    )?.acceptedWarnings.some(
      (accepted) => accepted.check === 'racialReplacementDuplicate',
    ),
  ).toBe(true);
  await owner.mutation(api.characterSheet.setRacialTraitReplacements, {
    ...scope,
    entryId: selection._id,
    replaces: [],
    operationId: 'none',
  });
  const resolved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    resolved?.acceptedWarnings.some(
      (accepted) => accepted.check === 'racialReplacementDuplicate',
    ),
  ).toBe(false);
  await owner.mutation(api.characterSheet.setRacialTraitReplacements, {
    ...scope,
    entryId: selection._id,
    replaces: [catalog.ability],
    operationId: 'duplicate-again',
  });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    )?.acceptedWarnings.some(
      (accepted) => accepted.check === 'racialReplacementDuplicate',
    ),
  ).toBe(false);
});

test('all race writers enforce membership, Character-scoped references, and migration controls', async () => {
  const { t, owner, outsider, scope, catalog } = await fixture();
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: catalog.human,
    operationId: 'human',
  });
  await owner.mutation(api.characterSheet.setRacialTraitSelected, {
    ...scope,
    catalogEntryId: catalog.alternate,
    selected: true,
    operationId: 'alternate',
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const race = before?.entries.find((entry) => entry.kind === 'race');
  const alternate = before?.entries.find(
    (entry) => entry.kind === 'racialTrait' && !entry.grantKey,
  );
  if (!race || !alternate) throw new Error('Missing fixture entries');
  const raceId = race._id;
  const alternateId = alternate._id;
  function commands(caller: typeof owner, writeEpoch?: number) {
    const common = { ...scope, operationId: 'blocked', writeEpoch };
    return [
      () =>
        caller.mutation(api.characterSheet.selectRace, {
          ...common,
          catalogEntryId: catalog.elf,
        }),
      () =>
        caller.mutation(api.characterSheet.chooseRacialAbilityScore, {
          ...common,
          target: { grantKey: { source: 'test-human', entry: 'test-ability' } },
          ability: 'strength',
        }),
      () =>
        caller.mutation(api.characterSheet.setRacialTraitSelected, {
          ...common,
          catalogEntryId: catalog.alternate,
          selected: false,
        }),
      () =>
        caller.mutation(api.characterSheet.setRacialTraitReplacements, {
          ...common,
          entryId: alternateId,
          replaces: [],
        }),
      () =>
        caller.mutation(api.characterSheet.editRaceStatistics, {
          ...common,
          entryId: raceId,
          racialHpGained: 8,
          racialHitDice: 2,
          racialProgression: {
            creatureType: 'Custom type',
            hitDie: 8,
            bab: 'half',
            saves: { fort: 'poor', ref: 'poor', will: 'good' },
            skillRanksPerHitDie: 2,
            classSkills: [],
          },
        }),
      () =>
        caller.mutation(api.characterSheet.discardRaceStatistics, {
          ...common,
          entryId: raceId,
        }),
    ];
  }
  for (const command of commands(outsider))
    await expect(command()).rejects.toThrow();
  await expect(t.query(api.characterSheet.read, scope)).rejects.toThrow();
  const otherCharacterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId: scope.campaignId,
    name: 'Other',
    kind: 'pc',
    operationId: 'other',
  });
  await expect(
    owner.mutation(api.characterSheet.selectRace, {
      ...scope,
      characterId: otherCharacterId,
      catalogEntryId: catalog.human,
      operationId: 'foreign-race',
    }),
  ).rejects.toThrow('does not belong');
  await expect(
    owner.mutation(api.characterSheet.editRaceStatistics, {
      ...scope,
      characterId: otherCharacterId,
      entryId: raceId,
      racialHitDice: 2,
      operationId: 'foreign-racial-hd',
    }),
  ).rejects.toThrow('does not belong');
  await expect(
    owner.mutation(api.characterSheet.discardRaceStatistics, {
      ...scope,
      characterId: otherCharacterId,
      entryId: raceId,
      operationId: 'foreign-discard',
    }),
  ).rejects.toThrow('does not belong');
  await expect(
    owner.mutation(api.characterSheet.setRacialTraitSelected, {
      ...scope,
      characterId: otherCharacterId,
      catalogEntryId: catalog.alternate,
      selected: true,
      operationId: 'foreign-trait',
    }),
  ).rejects.toThrow('does not belong');
  await expect(
    owner.mutation(api.characterSheet.setRacialTraitReplacements, {
      ...scope,
      characterId: otherCharacterId,
      entryId: alternateId,
      replaces: [],
      operationId: 'foreign-row',
    }),
  ).rejects.toThrow('does not belong');
  const otherCampaignId = await t.run((ctx) =>
    ctx.db.insert('campaign', {
      name: 'Other campaign',
      description: '',
      organizationId: 'org',
      ownerId: 'test|owner',
      e2eFixture: {
        namespace: 'races',
        version: 1,
        workerKey: '0',
        caseKey: 'other',
        campaignKey: 'other',
      },
    }),
  );
  const crossCampaignCharacterId = await owner.mutation(
    api.characterSheet.create,
    {
      organizationId: 'org',
      campaignId: otherCampaignId,
      name: 'Cross campaign',
      kind: 'pc',
      operationId: 'cross',
    },
  );
  await expect(
    owner.mutation(api.characterSheet.selectRace, {
      ...scope,
      characterId: crossCampaignCharacterId,
      catalogEntryId: catalog.human,
      operationId: 'cross-reference',
    }),
  ).rejects.toThrow();
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
  for (const command of commands(owner))
    await expect(command()).rejects.toThrow('MAINTENANCE');
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationControl', controlId, { closed: false }),
  );
  for (const command of commands(owner))
    await expect(command()).rejects.toThrow('RELOAD_REQUIRED');
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationControl', controlId, { authority: 'sheet' }),
  );
  for (const command of commands(owner, 1))
    await expect(command()).rejects.toThrow('RELOAD_REQUIRED');
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope)),
  ).toEqual(before);
});

test('private race choices belong to the owner and generic writers cannot bypass race or ability controls', async () => {
  const { owner, member, scope, catalog } = await fixture();
  const privateId = await owner.mutation(api.characterSheet.create, {
    name: 'Private',
    kind: 'pc',
    operationId: 'private',
  });
  await expect(
    member.query(api.characterSheet.read, { characterId: privateId }),
  ).rejects.toThrow();
  await expect(
    member.mutation(api.characterSheet.selectRace, {
      characterId: privateId,
      catalogEntryId: catalog.human,
      operationId: 'steal',
    }),
  ).rejects.toThrow();
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: catalog.human,
    operationId: 'human',
  });
  await expect(
    owner.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: catalog.elf,
      operationId: 'duplicate-race',
    }),
  ).rejects.toThrow('race picker');
  await expect(
    owner.mutation(api.characterSheet.editGrantState, {
      ...scope,
      grantKey: { source: 'test-human', entry: 'test-ability' },
      state: { choice: 'luck' },
      operationId: 'invalid-choice',
    }),
  ).rejects.toThrow('valid ability');
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: null,
    operationId: 'clear',
  });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    )?.entries.filter((entry) => entry.kind === 'race' && entry.active),
  ).toHaveLength(0);
});

test('racial Hit Dice keep level separate, never prefill HP, and persist racial rank allocation through race changes', async () => {
  const { t, owner, scope, catalog } = await fixture();
  await t.run((ctx) =>
    ctx.db.patch('catalogEntry', catalog.human, {
      detail: {
        kind: 'race',
        racialTraits: [catalog.ability],
        size: 'medium',
        creatureTypes: ['humanoid'],
        racialHitDice: 2,
        racialProgression: {
          creatureType: 'humanoid',
          hitDie: 8,
          bab: 'full',
          saves: { fort: 'good', ref: 'poor', will: 'poor' },
          skillRanksPerHitDie: 2,
          classSkills: ['acr'],
        },
      },
    }),
  );
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: catalog.human,
    operationId: 'human',
  });
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const race = initial?.entries.find((entry) => entry.kind === 'race');
  const classLevel = initial?.entries.find(
    (entry) => entry.kind === 'classLevel',
  );
  if (race?.kind !== 'race' || !classLevel) throw new Error('Missing entries');
  expect(race.state.racialHpGained).toBeUndefined();
  expect(initial?.calculated).toMatchObject({
    level: 1,
    hitDice: 3,
    hp: null,
    budgets: { racialSkillRanks: 4 },
    racial: { size: 'medium', creatureTypes: ['humanoid'] },
  });
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: classLevel._id,
    hpGained: 8,
    operationId: 'class-hp',
  });
  await owner.mutation(api.characterSheet.editRaceStatistics, {
    ...scope,
    entryId: race._id,
    racialHpGained: 12,
    racialSkillRanks: { acr: 3 },
    operationId: 'race-stats',
  });
  const recorded = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(recorded?.calculated.hp).toBe(20);
  expect(recorded?.calculated.warnings).toContainEqual(
    expect.objectContaining({
      check: 'racialSkillRankCap',
      subject: `${race._id}:skill.acr`,
      kind: 'rules',
    }),
  );
  expect(recorded?.calculated.classLevels[0]?.exceededSkillRankCaps).toEqual(
    [],
  );
  expect(
    recorded?.calculated.classLevels[0]?.cumulativeSkillRanks,
  ).toContainEqual({ skill: 'skill.acr', ranks: 3 });
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: catalog.elf,
    operationId: 'elf',
  });
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: catalog.human,
    operationId: 'human-again',
  });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    )?.entries.find((entry) => entry._id === race._id),
  ).toMatchObject({
    state: { racialHpGained: 12, racialSkillRanks: { acr: 3 } },
  });
  await expect(
    owner.mutation(api.characterSheet.editRaceStatistics, {
      ...scope,
      entryId: race._id,
      racialSkillRanks: { acr: -1 },
      operationId: 'invalid',
    }),
  ).rejects.toThrow('whole number');
});

test('representative private race content exposes trait facts and one-of race equivalence choices on any entry', async () => {
  const { t, owner, member } = await fixture();
  const characterId = await owner.mutation(api.characterSheet.create, {
    name: 'Private half-elf',
    kind: 'pc',
    operationId: 'private',
  });
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  const halfElf = initial?.catalogEntries.find(
    (entry) => entry.ruleIdentity === 'half-elf',
  );
  if (!halfElf) throw new Error('Representative race not seeded');
  await owner.mutation(api.characterSheet.selectRace, {
    characterId,
    catalogEntryId: halfElf._id,
    operationId: 'half-elf',
  });
  const selected = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  expect(selected?.calculated.racial).toMatchObject({
    countsAsRaces: ['elf', 'half-elf', 'human'],
    favoredClassCount: 2,
  });
  expect(selected?.calculated.abilities.strength.score).toBe(10);
  await expect(
    member.query(api.characterSheet.read, { characterId }),
  ).rejects.toThrow();
  const heritage = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: 'Chosen blood',
      ruleIdentity: 'chosen-blood',
      modifiers: [],
      stacksWithItself: false,
      sources: [],
      countsAsRaces: { oneOf: ['orc', 'dragon'] },
      detail: { kind: 'feat' },
    }),
  );
  const entryId = await owner.mutation(api.characterSheet.selectEntry, {
    characterId,
    catalogEntryId: heritage,
    operationId: 'heritage',
  });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId }),
    )?.calculated.racial.countsAsRaces,
  ).not.toContain('orc');
  await owner.mutation(api.characterSheet.editSelection, {
    characterId,
    entryId,
    choice: 'orc',
    operationId: 'orc',
  });
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, { characterId }),
    )?.calculated.racial.countsAsRaces,
  ).toContain('orc');
  await expect(
    owner.mutation(api.characterSheet.editSelection, {
      characterId,
      entryId,
      choice: 'elf',
      operationId: 'unavailable',
    }),
  ).rejects.toThrow('available races');
});

test('customizing a selected race preserves its source row, racial HP and recorded ability choice', async () => {
  const { t, owner, scope, catalog } = await fixture();
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: catalog.human,
    operationId: 'human',
  });
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const race = initial?.entries.find((entry) => entry.kind === 'race');
  const definition = initial?.catalogEntries.find(
    (entry) => entry._id === catalog.human,
  );
  if (!race || !definition) throw new Error('Missing race');
  await owner.mutation(api.characterSheet.editRaceStatistics, {
    ...scope,
    entryId: race._id,
    racialHpGained: 7,
    operationId: 'hp',
  });
  await owner.mutation(api.characterSheet.chooseRacialAbilityScore, {
    ...scope,
    target: { grantKey: { source: 'test-human', entry: 'test-ability' } },
    ability: 'strength',
    operationId: 'str',
  });
  const copyId = await t.run((ctx) => {
    const {
      _id: _discardId,
      _creationTime: _discardTime,
      ...copy
    } = definition;
    return ctx.db.insert('catalogEntry', { ...copy, name: 'Human customized' });
  });
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: copyId,
    operationId: 'customize',
  });
  const copied = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(copied?.entries.find((entry) => entry._id === race._id)).toMatchObject(
    { active: true, catalogEntryId: copyId, state: { racialHpGained: 7 } },
  );
  expect(copied?.calculated.abilities.strength.score).toBe(12);
  expect(copied?.entries.filter((entry) => entry.kind === 'race')).toHaveLength(
    1,
  );
});
