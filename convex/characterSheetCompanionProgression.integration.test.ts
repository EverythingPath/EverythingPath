// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import type { Doc } from './_generated/dataModel';
import schema from './schema';
import { calculateMilitiaCharacterFacts } from './lib/militiaCharacterFacts';
import { loadPreparedCharacterSheet } from './lib/preparedCharacterSheet';
import {
  readCharacterSheetData,
  readCharacterSheetDataWithBudget,
} from './lib/characterSheetData';
import { seedAcceptedCampaign } from './lib/acceptedCampaignFixture';
import { jsonBytes } from '../src/lib/json-bytes';
import { permanentMilitiaFacts } from '../tests/militia-companion-facts';

const modules = import.meta.glob('./**/*.ts');
const setProgression = api.characterSheet.setCompanionProgression;

test('the companion sheet combines druid and ranger sources without inventing Class Levels', async () => {
  const { member, companionId, relationshipId } = await fixture();
  await member.mutation(setProgression, {
    characterId: companionId,
    operationId: 'wolf',
    progression: wolf,
  });
  const sheet = await member.query(api.characterSheet.read, {
    characterId: companionId,
  });
  expect(sheet?.calculated).toMatchObject({
    level: 0,
    hitDice: 6,
    racialHitDice: 0,
    ownProgression: {
      totalBases: { bab: 4, saves: { fort: 5, ref: 5, will: 2 } },
    },
    companionProgression: {
      status: 'active',
      species: 'wolf',
      effectiveLevel: 7,
      hitDice: 6,
      budgets: { skillRanks: 6, generalFeats: 3, abilityIncreases: 1 },
      contributions: expect.arrayContaining([
        expect.objectContaining({
          sourceKey: 'nature-bond',
          classLevels: 5,
          effectiveLevel: 5,
        }),
        expect.objectContaining({
          sourceKey: 'hunters-bond',
          classLevels: 5,
          effectiveLevel: 2,
        }),
      ]),
    },
    // CRB wolf advancement: Con 15 + 4 = 19, six HD add 24 HP.
    hp: 45,
  });
  expect(sheet).toMatchObject({
    companionCalculationInputs: {
      companionProgressionSources: expect.arrayContaining([
        {
          sourceKey: 'nature-bond',
          ruleKind: 'druidCompanion',
          counting: true,
          associatedSize: 'medium',
        },
      ]),
      companionLinkedInputs: expect.arrayContaining([
        expect.objectContaining({
          input: { kind: 'classLevels', classRuleIdentity: 'druid' },
          value: 5,
        }),
      ]),
    },
  });
  expect(sheet?.calculated.classLevels).toEqual([]);
  expect(sheet?.permanentCalculated.hitDice).toBe(6);
  expect(sheet?.calculated.abilities.strength.score).toBe(24);
  expect(
    await member.query(api.characterSheetLinkedInputs.list, {
      characterId: companionId,
      relationshipId,
    }),
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        input: { kind: 'classLevels', classRuleIdentity: 'druid' },
        value: 5,
      }),
      expect.objectContaining({
        input: { kind: 'classLevels', classRuleIdentity: 'ranger' },
        value: 5,
      }),
    ]),
  );
});

test('partial source loss removes only its contribution and retains companion choices for restoration', async () => {
  const { member, owner, companionId, relationshipId } = await fixture();
  await member.mutation(setProgression, {
    characterId: companionId,
    operationId: 'wolf',
    progression: wolf,
  });
  await owner.mutation(api.companionRelationships.setSourceEnabled, {
    relationshipId,
    sourceKey: 'nature-bond',
    enabled: false,
    operationId: 'lose-druid',
  });
  const reduced = await member.query(api.characterSheet.read, {
    characterId: companionId,
  });
  expect(reduced?.calculated.companionProgression).toMatchObject({
    status: 'active',
    effectiveLevel: 2,
    hitDice: 3,
    contributions: expect.arrayContaining([
      expect.objectContaining({ sourceKey: 'nature-bond', counting: false }),
      expect.objectContaining({
        sourceKey: 'hunters-bond',
        effectiveLevel: 2,
        counting: true,
      }),
    ]),
  });
  expect(
    reduced?.entries.find((entry) => entry.kind === 'base')?.state
      .companionProgression,
  ).toEqual(wolf);
  await member.mutation(setProgression, {
    characterId: companionId,
    operationId: 'keep-choices',
    progression: { ...wolf, keep: true },
  });
  await owner.mutation(api.companionRelationships.setSourceEnabled, {
    relationshipId,
    sourceKey: 'hunters-bond',
    enabled: false,
    operationId: 'lose-ranger',
  });
  const lost = await member.query(api.characterSheet.read, {
    characterId: companionId,
  });
  expect(lost?.calculated.companionProgression).toMatchObject({
    status: 'dormant',
    retained: true,
    budgets: { skillRanks: null, generalFeats: null, abilityIncreases: null },
  });
  expect(lost?.calculated.warnings).not.toEqual(
    expect.arrayContaining([
      expect.objectContaining({ check: 'companionSkillRankBudget' }),
    ]),
  );
  expect(
    lost?.entries.find((entry) => entry.kind === 'base')?.state
      .companionProgression,
  ).toEqual({ ...wolf, keep: true });
  await owner.mutation(api.companionRelationships.setSourceEnabled, {
    relationshipId,
    sourceKey: 'nature-bond',
    enabled: true,
    operationId: 'restore-druid',
  });
  await owner.mutation(api.companionRelationships.setSourceEnabled, {
    relationshipId,
    sourceKey: 'hunters-bond',
    enabled: true,
    operationId: 'restore-ranger',
  });
  expect(
    (await member.query(api.characterSheet.read, { characterId: companionId }))
      ?.calculated,
  ).toMatchObject({ hitDice: 6, hp: 45 });
});

test('hidden associated Characters leave progression unresolved and saved fallbacks restore it without disclosing sources', async () => {
  const {
    t,
    member,
    owner,
    outsider,
    characterId,
    companionId,
    campaignId,
    relationshipId,
  } = await fixture();
  const seeded = await owner.run((ctx) =>
    seedAcceptedCampaign(ctx, campaignId),
  );
  await member.mutation(setProgression, {
    characterId: companionId,
    operationId: 'wolf',
    progression: wolf,
  });
  await t.run((ctx) =>
    ctx.db.patch('character', characterId, {
      campaignId: undefined,
      sheetDemo: true,
    }),
  );
  const hidden = await member.query(api.characterSheet.read, {
    characterId: companionId,
  });
  expect(hidden?.calculated).toMatchObject({
    hitDice: null,
    companionProgression: { status: 'unresolved', effectiveLevel: null },
  });
  const summary = JSON.stringify([
    hidden?.calculated.companionProgression,
    hidden?.companionCalculationInputs,
  ]);
  expect(summary).not.toContain('lastOperationId');
  expect(summary).not.toContain('updatedBy');
  expect(summary).not.toContain('revision');
  expect(summary).not.toContain('nature-bond');
  expect(summary).not.toContain('hunters-bond');
  expect(summary).not.toContain('Ada');
  await expect(
    outsider.query(api.characterSheet.read, { characterId: companionId }),
  ).rejects.toThrow();
  await expect(
    outsider.mutation(setProgression, {
      characterId: companionId,
      operationId: 'unauthorized',
      progression: wolf,
    }),
  ).rejects.toThrow();
  for (const classRuleIdentity of ['druid', 'ranger']) {
    await member.mutation(api.characterSheetLinkedInputs.saveFallback, {
      characterId: companionId,
      relationshipId,
      input: { kind: 'classLevels', classRuleIdentity },
      value: 5,
      operationId: `fallback-${classRuleIdentity}`,
    });
    if (classRuleIdentity === 'druid') {
      const unresolved = await member.query(api.canonicalLedger.read, {
        campaignId,
        militiaId: seeded.key.militiaId,
      });
      expect(unresolved.state.militiaSnapshot.characters).toContainEqual(
        expect.objectContaining({
          characterId: companionId,
          actualHitDice: null,
        }),
      );
    }
  }
  const fallback = await member.query(api.characterSheet.read, {
    characterId: companionId,
  });
  expect(fallback?.calculated).toMatchObject({
    hitDice: 6,
    hp: 45,
    companionProgression: {
      status: 'active',
      effectiveLevel: 7,
      contributions: expect.arrayContaining([
        expect.objectContaining({
          sourceKey: 'rule:druidCompanion',
          resolution: 'fallback',
          fallbackState: 'applied',
        }),
        expect.objectContaining({
          sourceKey: 'rule:rangerCompanion',
          resolution: 'fallback',
          fallbackState: 'applied',
        }),
      ]),
    },
  });
  const resolved = await member.query(api.canonicalLedger.read, {
    campaignId,
    militiaId: seeded.key.militiaId,
  });
  const facts = resolved.state.militiaSnapshot.characters.find(
    (character) => character.characterId === companionId,
  );
  expect(facts).toMatchObject({ actualHitDice: 6 });
  expect(facts).not.toHaveProperty('unresolvedAbilities');
  await t.run((ctx) =>
    ctx.db.patch('character', characterId, {
      campaignId,
      sheetDemo: undefined,
    }),
  );
  const restored = await owner.query(api.characterSheet.read, {
    characterId: companionId,
  });
  expect(restored?.calculated.companionProgression?.contributions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        sourceKey: 'nature-bond',
        resolution: 'calculated',
        fallbackState: 'suspended',
      }),
      expect.objectContaining({
        sourceKey: 'hunters-bond',
        resolution: 'calculated',
        fallbackState: 'suspended',
      }),
    ]),
  );
});

test('removing a granting Class Level refreshes companion BAB prerequisites', async () => {
  const { t, owner, member, characterId, companionId } = await fixture();
  await member.mutation(setProgression, {
    characterId: companionId,
    operationId: 'wolf',
    progression: wolf,
  });
  const featId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      characterId: companionId,
      scope: 'character',
      ruleIdentity: 'trained-companion-feat',
      name: 'Trained companion feat',
      detail: { kind: 'feat' },
      prerequisites: [{ bab: 4 }],
      sources: [],
      modifiers: [],
      stacksWithItself: false,
    }),
  );
  await member.mutation(api.characterSheet.selectEntry, {
    characterId: companionId,
    catalogEntryId: featId,
    operationId: 'select-feat',
  });
  const selected = await member.query(api.characterSheet.read, {
    characterId: companionId,
  });
  expect(selected?.calculated.prerequisites).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        clause: { bab: 4 },
        view: 'current',
        met: true,
      }),
    ]),
  );
  const master = await owner.query(api.characterSheet.read, { characterId });
  const druidLevel = master?.entries.find(
    (entry) => entry.kind === 'classLevel',
  );
  if (!druidLevel) throw new Error('Missing source level');
  await owner.mutation(api.characterSheet.deleteClassLevel, {
    characterId,
    entryId: druidLevel._id,
    operationId: 'source-level-lost',
  });
  const changed = await member.query(api.characterSheet.read, {
    characterId: companionId,
  });
  expect(changed?.calculated.prerequisites).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        clause: { bab: 4 },
        view: 'current',
        met: false,
      }),
    ]),
  );
});

test('transitive linked maximum HP and militia facts use the companion permanent projection', async () => {
  const { owner, member, companionId, campaignId, relationshipId } =
    await fixture();
  const seeded = await owner.run((ctx) =>
    seedAcceptedCampaign(ctx, campaignId),
  );
  await member.mutation(setProgression, {
    characterId: companionId,
    operationId: 'wolf',
    progression: wolf,
  });
  await member.mutation(api.characterSheet.createSheetEntry, {
    characterId: companionId,
    name: 'Temporary Constitution',
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: false,
      defaultCasterLevel: 1,
    },
    modifiers: [{ target: 'ability.con', bonusType: 'enhancement', value: 4 }],
    operationId: 'temporary-constitution',
  });
  const familiarId = await member.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Cub',
    kind: 'npc',
    operationId: 'cub',
  });
  const downstream = await member.mutation(api.companionRelationships.link, {
    associatedCharacterId: companionId,
    companionCharacterId: familiarId,
    kind: 'familiar',
    sources: [{ key: 'bond', label: 'Bond', enabled: true }],
    operationId: 'downstream-link',
  });
  const scope = {
    characterId: familiarId,
    relationshipId: downstream,
    input: { kind: 'maximumHp' as const },
  };
  expect(
    await member.query(api.characterSheetLinkedInputs.read, scope),
  ).toMatchObject({ value: 57 });
  expect(
    await member.query(api.characterSheetLinkedInputs.read, {
      ...scope,
      projection: 'permanent',
    }),
  ).toMatchObject({ value: 45 });
  for (const projection of ['current', 'permanent'] as const)
    expect(
      await member.query(api.characterSheetLinkedInputs.read, {
        ...scope,
        input: { kind: 'skillRanks', skill: 'skill.per' },
        projection,
      }),
    ).toMatchObject({ status: 'available', value: 3 });
  const ledger = await owner.query(api.canonicalLedger.read, {
    campaignId,
    militiaId: seeded.key.militiaId,
  });
  expect(ledger.state.militiaSnapshot.characters).toContainEqual(
    expect.objectContaining({
      characterId: companionId,
      level: 0,
      actualHitDice: 6,
      constitution: 19,
    }),
  );
  await owner.mutation(api.companionRelationships.setSourceEnabled, {
    relationshipId,
    sourceKey: 'nature-bond',
    enabled: false,
    operationId: 'lose-source',
  });
  const surviving = await member.query(api.characterSheet.read, {
    characterId: companionId,
  });
  expect(surviving?.permanentCalculated).toMatchObject({
    hitDice: 3,
    abilities: { constitution: { score: 15 } },
  });
  await member.mutation(setProgression, {
    characterId: companionId,
    operationId: 'publish-surviving-choices',
    progression: { ...wolf, keep: true },
  });
  const reduced = await owner.query(api.canonicalLedger.read, {
    campaignId,
    militiaId: seeded.key.militiaId,
  });
  expect(reduced.state.militiaSnapshot.characters).toContainEqual(
    expect.objectContaining({
      characterId: companionId,
      level: 0,
      actualHitDice: 3,
      constitution: 15,
    }),
  );
});

test('ranger level and source edits refresh the animal companion’s militia facts with the change', async () => {
  const {
    owner,
    member,
    companionId,
    characterId,
    campaignId,
    relationshipId,
  } = await fixture();
  const seeded = await owner.run((ctx) =>
    seedAcceptedCampaign(ctx, campaignId),
  );
  const scope = { campaignId, militiaId: seeded.key.militiaId };
  await member.mutation(setProgression, {
    characterId: companionId,
    operationId: 'wolf',
    progression: wolf,
  });
  const companionFacts = async () =>
    (
      await member.query(api.canonicalLedger.read, scope)
    ).state.militiaSnapshot.characters.find(
      (row) => row.characterId === companionId,
    );
  expect(await companionFacts()).toMatchObject({ actualHitDice: 6 });
  const before = await member.query(api.canonicalLedger.read, scope);
  const master = await owner.query(api.characterSheet.read, { characterId });
  const ranger = master?.catalogEntries.find(
    (entry) => entry.ruleIdentity === 'ranger',
  );
  if (!ranger) throw new Error('Missing ranger');
  // Ranger 5 → 7 raises the ranger's effective level from 2 to 4 (CRB p. 66).
  for (const position of [11, 12])
    await owner.mutation(api.characterSheet.addClassLevel, {
      characterId,
      classEntryId: ranger._id,
      operationId: `ranger-${position}`,
    });
  const raised = await member.query(api.characterSheet.read, {
    characterId: companionId,
  });
  expect(raised?.permanentCalculated.companionProgression).toMatchObject({
    effectiveLevel: 9,
  });
  expect(await companionFacts()).toMatchObject(permanentMilitiaFacts(raised));
  expect((await companionFacts())?.actualHitDice).toBeGreaterThan(6);
  const progressed = await member.query(api.canonicalLedger.read, scope);
  expect(progressed.revision).toBeGreaterThan(before.revision);
  await owner.mutation(api.characterSheet.createPersonalAdjustment, {
    characterId,
    name: 'Favored terrain note',
    modifiers: [{ target: 'attack.melee', bonusType: 'untyped', value: 1 }],
    operationId: 'unrelated-ranger-edit',
  });
  expect(await member.query(api.canonicalLedger.read, scope)).toEqual(
    progressed,
  );
  await owner.mutation(api.companionRelationships.setSourceEnabled, {
    relationshipId,
    sourceKey: 'nature-bond',
    enabled: false,
    operationId: 'lose-druid-source',
  });
  const reduced = await member.query(api.characterSheet.read, {
    characterId: companionId,
  });
  expect(await companionFacts()).toMatchObject(permanentMilitiaFacts(reduced));
  expect((await member.query(api.canonicalLedger.read, scope)).revision).toBe(
    progressed.revision + 1,
  );
});

test('campaign Character lists return an animal companion’s actual Hit Dice from its Militia Character Facts', async () => {
  const { owner, member, companionId, campaignId } = await fixture();
  await owner.run((ctx) => seedAcceptedCampaign(ctx, campaignId));
  await member.mutation(setProgression, {
    characterId: companionId,
    operationId: 'wolf',
    progression: wolf,
  });
  const scope = { campaignId, organizationId: 'org' };
  const listed = await member.query(
    api.character.listCampaignCharacters,
    scope,
  );
  expect(
    listed.find(({ character }) => character._id === companionId)?.character,
  ).toMatchObject({ level: 0, actualHitDice: 6 });
  expect(
    (await member.query(api.character.listByCampaign, scope)).find(
      (character) => character._id === companionId,
    ),
  ).toMatchObject({ level: 0, actualHitDice: 6 });
});

test('identity-free workers and owners without associated access publish the same trusted companion facts', async () => {
  const { t, member, companionId, characterId, campaignId } = await fixture();
  const seeded = await member.run((ctx) =>
    seedAcceptedCampaign(ctx, campaignId),
  );
  await member.mutation(setProgression, {
    characterId: companionId,
    operationId: 'trusted-wolf',
    progression: wolf,
  });
  const workerFacts = await t.run(async (ctx) => {
    const character = await ctx.db.get('character', companionId);
    if (!character) throw new Error('Missing companion');
    return calculateMilitiaCharacterFacts(ctx, character);
  });
  expect(workerFacts).toMatchObject({
    actualHitDice: 6,
    strength: 24,
    constitution: 19,
  });
  let ledger = await member.query(api.canonicalLedger.read, {
    campaignId,
    militiaId: seeded.key.militiaId,
  });
  expect(
    ledger.state.militiaSnapshot.characters.find(
      ({ characterId }) => characterId === companionId,
    ),
  ).toEqual(workerFacts);
  await t.run((ctx) =>
    ctx.db.patch('character', characterId, {
      campaignId: undefined,
      sheetDemo: true,
    }),
  );
  await expect(
    member.query(api.characterSheet.read, { characterId }),
  ).rejects.toThrow();
  await member.mutation(api.characterSheet.editBaseScores, {
    characterId: companionId,
    scores: { strength: 17 },
    operationId: 'owner-without-associated-access',
  });
  const trusted = await t.run(async (ctx) => {
    const character = await ctx.db.get('character', companionId);
    if (!character) throw new Error('Missing companion');
    return calculateMilitiaCharacterFacts(ctx, character, undefined, {
      trustedLinkedInputs: true,
    });
  });
  ledger = await member.query(api.canonicalLedger.read, {
    campaignId,
    militiaId: seeded.key.militiaId,
  });
  expect(
    ledger.state.militiaSnapshot.characters.find(
      ({ characterId }) => characterId === companionId,
    ),
  ).toEqual(trusted);
  // The master left the campaign, so progression and its scores are
  // unresolved for every reader alike (#423).
  expect(trusted).toMatchObject({
    actualHitDice: null,
    unresolvedAbilities: ['strength', 'dexterity', 'constitution'],
  });
});

/** Bytes one standalone sheet read charges against a resource budget. */
async function sheetReadBytes(
  ctx: Parameters<typeof readCharacterSheetData>[0],
  character: Doc<'character'>,
) {
  let bytes = 0;
  await readCharacterSheetDataWithBudget(
    ctx,
    character,
    [],
    {
      trustedLinkedInputs: true,
      resourceLimits: {
        maximumTotalBytesRead: Infinity,
        maximumReferences: Infinity,
      },
    },
    {
      accountRead: (value) => {
        bytes += jsonBytes(value);
      },
      accountReference: () => undefined,
    },
  );
  return bytes;
}

test('prepared animal reads charge the associated sheet against the same resource budget', async () => {
  const { t, member, companionId, characterId } = await fixture();
  await member.mutation(setProgression, {
    characterId: companionId,
    operationId: 'budget-wolf',
    progression: wolf,
  });
  await t.run(async (ctx) => {
    const master = await ctx.db.get('character', characterId);
    const companion = await ctx.db.get('character', companionId);
    if (!master || !companion) throw new Error('Missing endpoints');
    // Either endpoint's sheet fits alone; charging both to one budget cannot.
    const sharedBytes =
      (await sheetReadBytes(ctx, master)) +
      (await sheetReadBytes(ctx, companion));
    const options = {
      trustedLinkedInputs: true,
      resourceLimits: {
        maximumTotalBytesRead: sharedBytes - 1,
        maximumReferences: 1024,
      },
    };
    await readCharacterSheetData(ctx, master, options);
    await readCharacterSheetData(ctx, companion, options);
    await expect(
      loadPreparedCharacterSheet(ctx, companion, undefined, options),
    ).rejects.toThrow('read resource limit');
  });
});

test('companion writes reject unknown skill keys and duplicate aliases and store one canonical key', async () => {
  const { member, companionId } = await fixture();
  const scope = { characterId: companionId, operationId: 'skill-integrity' };
  const before = await member.query(api.characterSheet.read, {
    characterId: companionId,
  });
  const invalidSkills: Record<string, number>[] = [
    { imaginary: 1 },
    { acr: 1, 'skill.acr': 2 },
  ];
  for (const skillRanks of invalidSkills)
    await expect(
      member.mutation(setProgression, {
        ...scope,
        progression: { ...wolf, skillRanks },
      }),
    ).rejects.toThrow('valid companion choices');
  expect(
    (await member.query(api.characterSheet.read, { characterId: companionId }))
      ?.revision,
  ).toBe(before?.revision);
  await member.mutation(setProgression, {
    ...scope,
    progression: { ...wolf, skillRanks: { per: 3 } },
  });
  const saved = await member.query(api.characterSheet.read, {
    characterId: companionId,
  });
  expect(
    saved?.entries.find((entry) => entry.kind === 'base')?.state
      .companionProgression?.skillRanks,
  ).toEqual({ 'skill.per': 3 });
});

test('a cavalier mount uses the named class source once and grants mount proficiency', async () => {
  const { t, owner, member, characterId, companionId } = await fixture();
  const master = await owner.query(api.characterSheet.read, { characterId });
  const druid = master?.catalogEntries.find(
    ({ ruleIdentity }) => ruleIdentity === 'druid',
  );
  if (!master || druid?.detail.kind !== 'class')
    throw new Error('Missing class definition');
  if (!('classKind' in druid.detail))
    throw new Error('Missing class progression');
  const classDetail = druid.detail;
  const cavalierId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      characterId,
      scope: 'character',
      name: 'Cavalier',
      ruleIdentity: 'cavalier',
      sources: [],
      modifiers: [],
      stacksWithItself: false,
      detail: { ...classDetail, hitDie: 10, bab: 'full' },
    }),
  );
  await t.run(async (ctx) => {
    for (const entry of master.entries)
      if (entry.kind === 'classLevel')
        await ctx.db.patch('characterSheetEntry', entry._id, {
          state: { ...entry.state, classEntryId: cavalierId },
        });
  });
  await member.mutation(api.characterSheet.editBaseScores, {
    characterId: companionId,
    scores: {
      strength: 16,
      dexterity: 13,
      constitution: 15,
      intelligence: 2,
      wisdom: 12,
      charisma: 6,
    },
    operationId: 'horse-scores',
  });
  await member.mutation(setProgression, {
    characterId: companionId,
    operationId: 'cavalier-horse',
    progression: { ...wolf, species: 'horse' },
  });
  const mount = await member.query(api.characterSheet.read, {
    characterId: companionId,
  });
  expect(mount?.calculated.companionProgression).toMatchObject({
    effectiveLevel: 10,
    hitDice: 9,
    features: expect.arrayContaining(['Light Armor Proficiency']),
  });
  expect(mount?.calculated.proficiencies.grants).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ proficiency: { category: 'light' } }),
    ]),
  );
}, 15000);

test('an unknown granting class stays unresolved until an explicit animal progression fallback is saved', async () => {
  const { t, owner, member, characterId, companionId, relationshipId } =
    await fixture();
  const master = await owner.query(api.characterSheet.read, { characterId });
  const druid = master?.catalogEntries.find(
    ({ ruleIdentity }) => ruleIdentity === 'druid',
  );
  const level = master?.entries.find(({ kind }) => kind === 'classLevel');
  if (!druid || !level || druid.detail.kind !== 'class')
    throw new Error('Missing source fixture');
  const classDetail = druid.detail;
  const unknownClassId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      characterId,
      scope: 'character',
      name: 'Unknown companion class',
      ruleIdentity: 'unknown-companion-class',
      sources: [],
      modifiers: [],
      stacksWithItself: false,
      detail: classDetail,
    }),
  );
  await owner.mutation(api.characterSheet.editClassLevel, {
    characterId,
    entryId: level._id,
    classEntryId: unknownClassId,
    operationId: 'unknown-granting-class',
  });
  await owner.mutation(api.companionRelationships.interrupt, {
    relationshipId,
    operationId: 'retain-old-bond',
  });
  const unknownRelationship = await owner.mutation(
    api.companionRelationships.link,
    {
      associatedCharacterId: characterId,
      companionCharacterId: companionId,
      kind: 'animalCompanion',
      sources: [
        {
          key: 'unknown-bond',
          label: 'Unknown bond',
          sheetEntryId: level._id,
          enabled: true,
        },
      ],
      operationId: 'unknown-bond',
    },
  );
  await member.mutation(setProgression, {
    characterId: companionId,
    operationId: 'unknown-wolf',
    progression: wolf,
  });
  expect(
    (await member.query(api.characterSheet.read, { characterId: companionId }))
      ?.calculated.companionProgression,
  ).toMatchObject({ status: 'unresolved', effectiveLevel: null });
  await member.mutation(api.characterSheetLinkedInputs.saveFallback, {
    characterId: companionId,
    relationshipId: unknownRelationship,
    input: { kind: 'classLevels', classRuleIdentity: 'druid' },
    value: 4,
    operationId: 'explicit-druid-fallback',
  });
  const resolved = await member.query(api.characterSheet.read, {
    characterId: companionId,
  });
  expect(resolved?.calculated.companionProgression).toMatchObject({
    status: 'active',
    effectiveLevel: 4,
    hitDice: 4,
    contributions: [
      expect.objectContaining({
        classRuleIdentity: 'druid',
        resolution: 'fallback',
        fallbackState: 'applied',
      }),
    ],
  });
}, 15000);

test('permanent companion restrictions can be accepted through the sheet controller contract', async () => {
  const { member, companionId } = await fixture();
  await member.mutation(setProgression, {
    characterId: companionId,
    operationId: 'restricted-skill',
    progression: { ...wolf, skillRanks: { 'skill.spl': 1 } },
  });
  await member.mutation(api.characterSheet.createSheetEntry, {
    characterId: companionId,
    name: 'Temporary Intelligence',
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: false,
      defaultCasterLevel: 1,
    },
    modifiers: [{ target: 'ability.int', bonusType: 'enhancement', value: 14 }],
    operationId: 'temporary-intelligence',
  });
  const sheet = await member.query(api.characterSheet.read, {
    characterId: companionId,
  });
  const warning = sheet?.permanentCalculated.warnings.find(
    ({ check }) => check === 'companionSourceRestriction',
  );
  if (!warning) throw new Error('Missing permanent budget warning');
  expect(
    sheet?.calculated.warnings.some(({ check }) => check === warning.check),
  ).toBe(false);
  await member.mutation(api.characterSheet.acceptWarning, {
    characterId: companionId,
    check: warning.check,
    subject: warning.subject,
    fingerprint: warning.fingerprint,
    operationId: 'accept-permanent-restriction',
  });
  const accepted = await member.query(api.characterSheet.read, {
    characterId: companionId,
  });
  expect(accepted?.acceptedWarnings).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        check: warning.check,
        subject: warning.subject,
        fingerprint: warning.fingerprint,
      }),
    ]),
  );
});

test('simultaneous companion restrictions share one acceptance and reopen together', async () => {
  const { t, member, companionId } = await fixture();
  await member.mutation(setProgression, {
    characterId: companionId,
    operationId: 'two-restrictions',
    progression: { ...wolf, skillRanks: { 'skill.spl': 1 } },
  });
  const featId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      characterId: companionId,
      scope: 'character',
      name: 'Scribe Scroll',
      ruleIdentity: 'test:scribe-scroll',
      sources: [],
      modifiers: [],
      stacksWithItself: false,
      detail: { kind: 'feat' },
    }),
  );
  await member.mutation(api.characterSheet.selectEntry, {
    characterId: companionId,
    catalogEntryId: featId,
    operationId: 'record-unrestricted-feat',
  });
  const sheet = await member.query(api.characterSheet.read, {
    characterId: companionId,
  });
  const restrictions = sheet?.calculated.warnings.filter(
    ({ check }) => check === 'companionSourceRestriction',
  );
  expect(restrictions).toHaveLength(1);
  const warning = restrictions?.[0];
  if (!warning) throw new Error('Missing restrictions');
  expect(warning.message).toContain('Animal Skills list');
  expect(warning.message).toContain('Animal Feats list');
  await member.mutation(api.characterSheet.acceptWarning, {
    characterId: companionId,
    check: warning.check,
    subject: warning.subject,
    fingerprint: warning.fingerprint,
    operationId: 'accept-both',
  });
  const accepted = await member.query(api.characterSheet.read, {
    characterId: companionId,
  });
  expect(
    accepted?.acceptedWarnings.filter(({ check }) => check === warning.check),
  ).toEqual([
    expect.objectContaining({
      subject: warning.subject,
      fingerprint: warning.fingerprint,
    }),
  ]);
  await member.mutation(api.characterSheet.reopenWarning, {
    characterId: companionId,
    check: warning.check,
    subject: warning.subject,
    operationId: 'reopen-both',
  });
  const reopened = await member.query(api.characterSheet.read, {
    characterId: companionId,
  });
  expect(
    reopened?.acceptedWarnings.some(({ check }) => check === warning.check),
  ).toBe(false);
  expect(
    reopened?.calculated.warnings.filter(
      ({ check }) => check === warning.check,
    ),
  ).toHaveLength(1);
});

test('an animal relationship without a species does not show baseline statistics as progression', async () => {
  const { member, companionId } = await fixture();
  const sheet = await member.query(api.characterSheet.read, {
    characterId: companionId,
  });
  expect(sheet?.calculated.hitDice).toBeNull();
  expect(sheet?.calculated.selectionRules.budgets.generalFeats).toBeNull();
  expect(sheet?.calculated.affectedStatisticTargets).toEqual(
    expect.arrayContaining([
      'hitDice',
      'bab',
      'save.fort',
      'save.ref',
      'save.will',
      'ability.str',
      'ability.dex',
      'ability.con',
      'featBudget',
    ]),
  );
});

test('choosing a species preserves ability scores recorded before progression', async () => {
  const { member, companionId } = await fixture();
  await member.mutation(api.characterSheet.editBaseScores, {
    characterId: companionId,
    scores: { strength: 17 },
    operationId: 'existing-strength',
  });
  await member.mutation(setProgression, {
    characterId: companionId,
    operationId: 'first-species',
    progression: wolf,
  });
  const sheet = await member.query(api.characterSheet.read, {
    characterId: companionId,
  });
  expect(
    sheet?.baseScoresEntry.modifiers.find(
      ({ target }) => target === 'ability.str',
    )?.value,
  ).toBe(17);
  expect(sheet?.calculated.abilities.strength.score).toBe(28);
});

test('companion choices preserve edited base scores and reject invalid data and closed writer gates', async () => {
  const { t, member, companionId } = await fixture();
  const scope = {
    characterId: companionId,
    operationId: 'choices',
    progression: wolf,
  };
  await member.mutation(setProgression, scope);
  await member.mutation(api.characterSheet.editBaseScores, {
    characterId: companionId,
    scores: { strength: 17 },
    operationId: 'custom-strength',
  });
  await member.mutation(setProgression, {
    ...scope,
    progression: { ...wolf, hpGained: 22 },
  });
  const saved = await member.query(api.characterSheet.read, {
    characterId: companionId,
  });
  expect(saved?.calculated.abilities.strength.score).toBe(28);
  await expect(
    member.mutation(setProgression, {
      ...scope,
      progression: { ...wolf, skillRanks: { perception: -1 } },
    }),
  ).rejects.toThrow('valid companion choices');
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
  await expect(member.mutation(setProgression, scope)).rejects.toThrow(
    'MAINTENANCE',
  );
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationControl', controlId, { closed: false }),
  );
  await expect(member.mutation(setProgression, scope)).rejects.toThrow(
    'RELOAD_REQUIRED',
  );
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationControl', controlId, { authority: 'sheet' }),
  );
  await expect(
    member.mutation(setProgression, { ...scope, writeEpoch: 1 }),
  ).rejects.toThrow('RELOAD_REQUIRED');
  expect(
    (await member.query(api.characterSheet.read, { characterId: companionId }))
      ?.revision,
  ).toBe(saved?.revision);
});

const wolf = {
  species: 'wolf' as const,
  hpGained: 21,
  skillRanks: { 'skill.per': 3 },
  abilityIncreases: ['strength' as const],
  advancementChoice: 'species' as const,
  keep: false,
};

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
        namespace: 'animal-progression',
        version: 1,
        workerKey: '0',
        caseKey: 'animal-progression',
        campaignKey: 'animal-progression',
      },
    }),
  );
  const characterId = await owner.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Ada',
    kind: 'pc',
    operationId: 'ada',
  });
  await t.run(async (ctx) => {
    for (const ruleIdentity of ['druid', 'ranger'])
      await ctx.db.insert('catalogEntry', {
        characterId,
        scope: 'character',
        name: ruleIdentity,
        ruleIdentity,
        sources: [
          {
            book: 'Pathfinder RPG Core Rulebook',
            pages: ruleIdentity === 'druid' ? '51–54' : '64–67',
          },
        ],
        modifiers: [],
        stacksWithItself: false,
        detail: {
          kind: 'class',
          classKind: 'base',
          hitDie: 8,
          bab: 'threeQuarters',
          saves: { fort: 'good', ref: 'poor', will: 'good' },
          skillRanksPerLevel: 2,
          classSkills: [],
          featuresByLevel: [],
          picksByLevel: [],
        },
      });
  });
  const master = await owner.query(api.characterSheet.read, { characterId });
  if (!master) throw new Error('Missing master');
  const druid = master.catalogEntries.find(
    (entry) => entry.ruleIdentity === 'druid',
  );
  const ranger = master.catalogEntries.find(
    (entry) => entry.ruleIdentity === 'ranger',
  );
  const initialLevel = master.entries.find(
    (entry) => entry.kind === 'classLevel',
  );
  if (!druid || !ranger || !initialLevel)
    throw new Error('Missing representative classes');
  await owner.mutation(api.characterSheet.editClassLevel, {
    characterId,
    entryId: initialLevel._id,
    classEntryId: druid._id,
    hpGained: 8,
    operationId: 'druid-one',
  });
  for (let position = 2; position <= 10; position++)
    await owner.mutation(api.characterSheet.addClassLevel, {
      characterId,
      classEntryId: position <= 5 ? druid._id : ranger._id,
      operationId: `level-${position}`,
    });
  const completedMaster = await owner.query(api.characterSheet.read, {
    characterId,
  });
  if (!completedMaster) throw new Error('Missing completed master');
  const levels = completedMaster.entries.filter(
    (entry) => entry.kind === 'classLevel',
  );
  const natureLevel = levels.at(0);
  const hunterLevel = levels.at(5);
  if (!natureLevel || !hunterLevel)
    throw new Error('Missing granting Class Levels');
  const companionId = await member.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Bryn',
    kind: 'npc',
    operationId: 'bryn',
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
  await member.mutation(api.characterSheet.editBaseScores, {
    characterId: companionId,
    scores: {
      strength: 13,
      dexterity: 15,
      constitution: 15,
      intelligence: 2,
      wisdom: 12,
      charisma: 6,
    },
    operationId: 'record-wolf-scores',
  });
  const relationshipId = await owner.mutation(api.companionRelationships.link, {
    associatedCharacterId: characterId,
    companionCharacterId: companionId,
    kind: 'animalCompanion',
    sources: [
      {
        key: 'nature-bond',
        label: 'Nature bond',
        sheetEntryId: natureLevel._id,
        enabled: true,
      },
      {
        key: 'hunters-bond',
        label: 'Hunter’s bond',
        sheetEntryId: hunterLevel._id,
        enabled: true,
      },
    ],
    operationId: 'link',
  });
  return {
    t,
    owner,
    member,
    outsider,
    campaignId,
    characterId,
    companionId,
    relationshipId,
  };
}
