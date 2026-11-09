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
// Each case builds a summoner and two linked eidolons; under a full parallel
// run that setup alone can exceed the local 5s default.
vi.setConfig({ testTimeout: 20_000 });
const setAllocation = api.companionRelationships.setSourceAllocation;
const setGroupPurchases = api.companionRelationships.setGroupPurchases;
const listPools = api.companionRelationships.listAllocationPools;

// Ultimate Magic p. 78, Broodmaster: the published 2nd-level example.
const first = {
  hitDice: 1,
  skillRanks: 4,
  feats: 1,
  armorBonus: 1,
  strengthBonus: 1,
  dexterityBonus: 0,
  evolutionPoints: 2,
  maxAttacks: 2,
};
const second = {
  hitDice: 1,
  skillRanks: 4,
  feats: 0,
  armorBonus: 1,
  strengthBonus: 0,
  dexterityBonus: 1,
  evolutionPoints: 2,
  maxAttacks: 1,
};

test('a Broodmaster divides one summoner level’s components between its eidolons', async () => {
  const { owner, member, eidolons, characterId, campaignId } = await fixture();
  const seeded = await owner.run((ctx) =>
    seedAcceptedCampaign(ctx, campaignId),
  );
  const [one, two] = eidolons;
  const before = await read(member, one.companionId);
  expect(before?.calculated.companionProgression).toMatchObject({
    status: 'unresolved',
    contributions: [
      {
        kind: 'component',
        ruleKind: 'broodmasterEidolon',
        classLevels: 2,
        components: { allocated: null, pool: { companions: 2 } },
      },
    ],
  });
  expect(before?.calculated.warnings).toContainEqual(
    expect.objectContaining({ check: 'companionComponentMissing' }),
  );
  await member.mutation(setAllocation, {
    relationshipId: one.relationshipId,
    sourceKey: 'brood',
    components: first,
    operationId: 'first-share',
  });
  await owner.mutation(setAllocation, {
    relationshipId: two.relationshipId,
    sourceKey: 'brood',
    components: second,
    operationId: 'second-share',
  });
  const firstSheet = await read(member, one.companionId);
  expect(firstSheet?.calculated).toMatchObject({
    level: 0,
    classLevels: [],
    hitDice: 1,
    derivedStatistics: { bab: { total: 2 } },
    budgets: { generalFeats: 1, skillRanks: 4 },
    companionProgression: {
      status: 'active',
      effectiveLevel: 2,
      hitDice: 1,
      evolutionPool: { total: 2 },
      budgets: { maxAttacks: 2 },
    },
  });
  expect(firstSheet?.companionCalculationInputs).toMatchObject({
    companionProgressionSources: [
      {
        sourceKey: 'brood',
        ruleKind: 'broodmasterEidolon',
        counting: true,
        allocatedComponents: first,
        componentPool: {
          companions: 2,
          groupPurchases: [],
          allocated: {
            hitDice: 2,
            skillRanks: 8,
            feats: 1,
            evolutionPoints: 4,
            maxAttacks: 3,
          },
        },
      },
    ],
  });
  const secondSheet = await read(member, two.companionId);
  expect(secondSheet?.calculated).toMatchObject({
    hitDice: 1,
    derivedStatistics: { bab: { total: 2 } },
    budgets: { generalFeats: 0 },
  });
  for (const sheet of [firstSheet, secondSheet])
    expect(
      sheet?.calculated.warnings.filter(
        ({ check }) =>
          check.startsWith('companionComponent') || check.startsWith('brood'),
      ),
    ).toEqual([]);
  expect(await owner.query(listPools, { characterId })).toEqual([
    expect.objectContaining({
      kind: 'component',
      ruleKind: 'broodmasterEidolon',
      label: 'Broodmaster',
      classLevels: 2,
      budget: expect.objectContaining({ hitDice: 2, evolutionPoints: 4 }),
      overBudget: false,
      groupPurchases: [],
      capacity: { allowed: 2, used: 2 },
      members: [
        expect.objectContaining({
          relationshipId: one.relationshipId,
          components: first,
          counting: true,
          companion: { characterId: one.companionId, name: 'Brute' },
          lastOperationId: 'first-share',
        }),
        expect.objectContaining({
          relationshipId: two.relationshipId,
          components: second,
          companion: { characterId: two.companionId, name: 'Skitter' },
        }),
      ],
    }),
  ]);
  // Militia Character Facts read the allocated, actual Hit Dice.
  const ledger = await owner.query(api.canonicalLedger.read, {
    campaignId,
    militiaId: seeded.key.militiaId,
  });
  expect(ledger.state.militiaSnapshot.characters).toContainEqual(
    expect.objectContaining({
      characterId: one.companionId,
      level: 0,
      actualHitDice: 1,
    }),
  );
});

test('Larger Brood is bought once for the brood and paid before the pool is divided', async () => {
  const { owner, member, eidolons, characterId } = await fixture(8);
  const [one, two] = eidolons;
  for (const [eidolon, evolutionPoints] of [
    [one, 4],
    [two, 4],
  ] as const)
    await member.mutation(setAllocation, {
      relationshipId: eidolon.relationshipId,
      sourceKey: 'brood',
      components: { ...first, hitDice: 3, evolutionPoints },
      operationId: `share-${evolutionPoints}-${eidolon.companionId}`,
    });
  await member.mutation(setGroupPurchases, {
    characterId,
    ruleKind: 'broodmasterEidolon',
    purchases: ['large'],
    operationId: 'larger-brood',
  });
  const summoner = await owner.query(api.characterSheet.read, { characterId });
  expect(summoner).toMatchObject({
    lastOperationId: 'larger-brood',
  });
  expect(
    summoner?.entries.find((entry) => entry.kind === 'base')?.state,
  ).toMatchObject({
    companionGroupPurchases: [
      { ruleKind: 'broodmasterEidolon', purchases: ['large'] },
    ],
  });
  const [pool] = await owner.query(listPools, { characterId });
  // APG Table 2–9 at 8th level: 11 points; the large evolution takes 4.
  expect(pool).toMatchObject({
    kind: 'component',
    budget: { hitDice: 6, evolutionPoints: 7 },
    allocated: { hitDice: 6, evolutionPoints: 8 },
    overBudget: true,
    overBudgetComponents: ['evolutionPoints'],
    groupPurchases: [{ key: 'large', cost: 4, issues: [] }],
    capacity: { allowed: 4, used: 2 },
  });
  const over = await read(member, one.companionId);
  expect(over?.calculated.companionProgression).toMatchObject({
    evolutionPool: { total: 4 },
    brood: {
      budget: { evolutionPoints: 7 },
      groupPurchases: [{ key: 'large' }],
      largestSize: 'medium',
    },
  });
  expect(over?.calculated.warnings).toContainEqual(
    expect.objectContaining({ check: 'companionComponentBudget' }),
  );
  await owner.mutation(setGroupPurchases, {
    characterId,
    ruleKind: 'broodmasterEidolon',
    purchases: [],
    operationId: 'no-larger-brood',
  });
  const cleared = await read(member, one.companionId);
  expect(cleared?.calculated.companionProgression).toMatchObject({
    evolutionPool: { total: 4 },
    brood: { budget: { evolutionPoints: 11 }, groupPurchases: [] },
  });
  expect(cleared?.calculated.warnings.map(({ check }) => check)).not.toContain(
    'companionComponentBudget',
  );
});

// UM p. 78, Larger Brood: the huge evolution "allows him to have two Large
// eidolons".
test('the brood’s huge purchase pays for each eidolon’s Large size, which still counts its places', async () => {
  const { owner, member, eidolons, characterId } = await fixture(13);
  for (const eidolon of eidolons) {
    await member.mutation(setAllocation, {
      relationshipId: eidolon.relationshipId,
      sourceKey: 'brood',
      components: { ...first, hitDice: 5, evolutionPoints: 2 },
      operationId: `share-${eidolon.companionId}`,
    });
    await member.mutation(api.characterSheet.setCompanionProgression, {
      characterId: eidolon.companionId,
      operationId: `large-${eidolon.companionId}`,
      progression: {
        ...smallBiped,
        size: 'medium',
        evolutions: [{ key: 'large' }],
      },
    });
  }
  await member.mutation(setGroupPurchases, {
    characterId,
    ruleKind: 'broodmasterEidolon',
    purchases: ['large', 'huge'],
    operationId: 'largest-brood',
  });
  const [pool] = await owner.query(listPools, { characterId });
  // Two Large eidolons fill the huge purchase's eight Small places.
  expect(pool).toMatchObject({
    kind: 'component',
    capacity: { allowed: 8, used: 8 },
  });
  const [one] = eidolons;
  const paid = await read(member, one.companionId);
  expect(paid?.calculated.companionProgression).toMatchObject({
    size: 'large',
    evolutionPool: { total: 2, spent: 0, remaining: 2 },
    evolutions: expect.arrayContaining([
      expect.objectContaining({ key: 'large', cost: 0, paidByGroup: true }),
    ]),
    brood: { largestSize: 'large' },
  });
  // Biped Str 16, +1 allocated, +8 from the Large size.
  expect(paid?.calculated.abilities.strength.score).toBe(25);
  expect(paid?.calculated.warnings.map(({ check }) => check)).not.toContain(
    'broodEidolonSize',
  );

  await owner.mutation(setGroupPurchases, {
    characterId,
    ruleKind: 'broodmasterEidolon',
    purchases: ['large'],
    operationId: 'larger-brood',
  });
  const [smaller] = await owner.query(listPools, { characterId });
  expect(smaller).toMatchObject({ capacity: { allowed: 4, used: 8 } });
  const unpaid = await read(member, one.companionId);
  expect(unpaid?.calculated.companionProgression).toMatchObject({
    size: 'large',
    evolutionPool: { total: 2, spent: 4, remaining: -2 },
    evolutions: expect.arrayContaining([
      expect.objectContaining({ key: 'large', cost: 4, paidByGroup: false }),
    ]),
    brood: { largestSize: 'medium' },
  });
  expect(unpaid?.calculated.warnings.map(({ check }) => check)).toEqual(
    expect.arrayContaining(['broodEidolonSize', 'eidolonEvolutionPoolBudget']),
  );
});

test('a shrinking summoner level and a lost Broodmaster source keep every recorded share', async () => {
  const { owner, member, eidolons, characterId, summonerLevels } =
    await fixture();
  const [one, two] = eidolons;
  for (const [eidolon, components] of [
    [one, first],
    [two, second],
  ] as const)
    await member.mutation(setAllocation, {
      relationshipId: eidolon.relationshipId,
      sourceKey: 'brood',
      components,
      operationId: `share-${eidolon.companionId}`,
    });
  const [, secondLevel] = summonerLevels;
  if (!secondLevel) throw new Error('Missing second summoner level');
  await owner.mutation(api.characterSheet.deleteClassLevel, {
    characterId,
    entryId: secondLevel,
    operationId: 'drop-second',
  });
  const reduced = await read(member, one.companionId);
  expect(reduced?.calculated).toMatchObject({
    hitDice: 1,
    derivedStatistics: { bab: { total: 1 } },
    companionProgression: {
      contributions: [
        {
          classLevels: 1,
          components: {
            allocated: first,
            budget: { hitDice: 1, evolutionPoints: 3 },
          },
        },
      ],
    },
  });
  expect(reduced?.calculated.warnings).toContainEqual(
    expect.objectContaining({ check: 'companionComponentBudget' }),
  );
  await owner.mutation(api.companionRelationships.setSourceEnabled, {
    relationshipId: one.relationshipId,
    sourceKey: 'brood',
    enabled: false,
    operationId: 'lose-brood',
  });
  expect(
    (await read(member, one.companionId))?.calculated.companionProgression,
  ).toMatchObject({
    status: 'dormant',
    contributions: [{ counting: false, components: { allocated: first } }],
  });
  const [pool] = await owner.query(listPools, { characterId });
  expect(pool).toMatchObject({
    allocated: { hitDice: 1 },
    members: [
      expect.objectContaining({ components: first, counting: false }),
      expect.objectContaining({ components: second, counting: true }),
    ],
  });
  await owner.mutation(api.companionRelationships.setSourceEnabled, {
    relationshipId: one.relationshipId,
    sourceKey: 'brood',
    enabled: true,
    operationId: 'restore-brood',
  });
  expect(
    (await read(member, one.companionId))?.calculated.companionProgression,
  ).toMatchObject({ status: 'active', brood: { components: first } });
});

test('a hidden summoner leaks no brood totals and stays unresolved until a fallback supplies its level', async () => {
  const { t, owner, member, eidolons, characterId, campaignId } =
    await fixture(8);
  const [one] = eidolons;
  await member.mutation(setAllocation, {
    relationshipId: one.relationshipId,
    sourceKey: 'brood',
    components: first,
    operationId: 'first-share',
  });
  await member.mutation(setGroupPurchases, {
    characterId,
    ruleKind: 'broodmasterEidolon',
    purchases: ['large'],
    operationId: 'larger-brood',
  });
  await t.run((ctx) =>
    ctx.db.patch('character', characterId, {
      campaignId: undefined,
      sheetDemo: true,
    }),
  );
  const hidden = await read(member, one.companionId);
  expect(hidden?.calculated).toMatchObject({
    hitDice: null,
    companionProgression: {
      status: 'unresolved',
      brood: { components: first, budget: null, groupPurchases: null },
      contributions: [
        {
          sourceKey: 'rule:broodmasterEidolon',
          components: { allocated: first, budget: null, pool: null },
        },
      ],
    },
  });
  const disclosed = JSON.stringify(hidden);
  expect(disclosed).not.toContain('componentPool');
  expect(disclosed).not.toContain('"large"');
  expect(disclosed).not.toContain('Vess');
  await expect(member.query(listPools, { characterId })).rejects.toThrow();
  await expect(
    member.mutation(setGroupPurchases, {
      characterId,
      ruleKind: 'broodmasterEidolon',
      purchases: [],
      operationId: 'hidden-clear',
    }),
  ).rejects.toThrow();
  await member.mutation(api.characterSheetLinkedInputs.saveFallback, {
    characterId: one.companionId,
    relationshipId: one.relationshipId,
    input: { kind: 'classLevels', classRuleIdentity: 'summoner' },
    value: 8,
    operationId: 'fallback-summoner',
  });
  // APG Table 2–9 at 8th level: the whole row's BAB +6.
  expect((await read(member, one.companionId))?.calculated).toMatchObject({
    hitDice: 1,
    derivedStatistics: { bab: { total: 6 } },
    companionProgression: {
      status: 'active',
      brood: { components: first, budget: null, groupPurchases: null },
    },
  });
  await t.run((ctx) =>
    ctx.db.patch('character', characterId, {
      campaignId,
      sheetDemo: undefined,
    }),
  );
  expect(
    (await read(owner, one.companionId))?.calculated.companionProgression,
  ).toMatchObject({
    brood: {
      budget: { evolutionPoints: 7 },
      groupPurchases: [{ key: 'large' }],
    },
  });
});

// UM p. 78, Larger Brood: the huge purchase lets the brood be two Large
// eidolons, paid "before he assigns evolution points to his individual
// eidolons". A reader without access to the summoner still gets the
// eidolon's correct points, but never the brood's purchases or totals.
test('a hidden summoner’s huge purchase still pays a brood eidolon’s large evolution without disclosing the brood', async () => {
  const { t, owner, member, eidolons, characterId, campaignId } =
    await fixture(13);
  const [one, two] = eidolons;
  for (const eidolon of eidolons)
    await member.mutation(setAllocation, {
      relationshipId: eidolon.relationshipId,
      sourceKey: 'brood',
      components: { ...first, hitDice: 5, evolutionPoints: 2 },
      operationId: `share-${eidolon.companionId}`,
    });
  await member.mutation(api.characterSheet.setCompanionProgression, {
    characterId: one.companionId,
    operationId: 'large',
    progression: {
      ...smallBiped,
      size: 'medium',
      evolutions: [{ key: 'large' }],
    },
  });
  await member.mutation(setGroupPurchases, {
    characterId,
    ruleKind: 'broodmasterEidolon',
    purchases: ['large', 'huge'],
    operationId: 'largest-brood',
  });
  await t.run((ctx) =>
    ctx.db.patch('character', characterId, {
      campaignId: undefined,
      sheetDemo: true,
    }),
  );
  await member.mutation(api.characterSheetLinkedInputs.saveFallback, {
    characterId: one.companionId,
    relationshipId: one.relationshipId,
    input: { kind: 'classLevels', classRuleIdentity: 'summoner' },
    value: 13,
    operationId: 'fallback-summoner',
  });
  const disclosure = (sheet: Awaited<ReturnType<typeof read>>): string =>
    JSON.stringify([
      sheet?.calculated,
      sheet?.permanentCalculated,
      sheet?.companionCalculationInputs,
    ]);
  const hidden = await read(member, one.companionId);
  expect(hidden?.calculated.companionProgression).toMatchObject({
    status: 'active',
    size: 'large',
    evolutionPool: { total: 2, spent: 0, remaining: 2 },
    evolutions: expect.arrayContaining([
      expect.objectContaining({ key: 'large', cost: 0, paidByGroup: true }),
    ]),
    brood: {
      budget: null,
      pool: null,
      groupPurchases: null,
      largestSize: null,
    },
    contributions: [
      {
        sourceKey: 'rule:broodmasterEidolon',
        components: { budget: null, pool: null },
      },
    ],
  });
  for (const secret of ['"huge"', 'componentPool', 'Vess', 'capacity'])
    expect(disclosure(hidden)).not.toContain(secret);
  // An eidolon without the large evolution learns nothing of the purchases.
  expect(disclosure(await read(member, two.companionId))).not.toContain(
    'isLargePaidByGroup',
  );

  // Without the huge purchase the large evolution costs its own 4 points.
  await owner.mutation(setGroupPurchases, {
    characterId,
    ruleKind: 'broodmasterEidolon',
    purchases: ['large'],
    operationId: 'larger-brood',
  });
  const unpaid = await read(member, one.companionId);
  expect(unpaid?.calculated.companionProgression).toMatchObject({
    evolutionPool: { total: 2, spent: 4, remaining: -2 },
    evolutions: expect.arrayContaining([
      expect.objectContaining({ key: 'large', cost: 4, paidByGroup: false }),
    ]),
    brood: { groupPurchases: null, largestSize: null },
  });
  expect(disclosure(unpaid)).not.toContain('isLargePaidByGroup');

  // With access the reader sees the brood's purchases themselves.
  await t.run((ctx) =>
    ctx.db.patch('character', characterId, {
      campaignId,
      sheetDemo: undefined,
    }),
  );
  await owner.mutation(setGroupPurchases, {
    characterId,
    ruleKind: 'broodmasterEidolon',
    purchases: ['large', 'huge'],
    operationId: 'largest-again',
  });
  const visible = await read(member, one.companionId);
  expect(visible?.calculated.companionProgression).toMatchObject({
    evolutionPool: { total: 2, spent: 0, remaining: 2 },
    evolutions: expect.arrayContaining([
      expect.objectContaining({ key: 'large', cost: 0, paidByGroup: true }),
    ]),
    brood: {
      groupPurchases: [{ key: 'large' }, { key: 'huge' }],
      largestSize: 'large',
    },
  });
});

test('component and group purchase writes require associated access and well-formed values', async () => {
  const { t, owner, member, outsider, eidolons, characterId, archetypeId } =
    await fixture();
  const [one] = eidolons;
  const scope = {
    relationshipId: one.relationshipId,
    sourceKey: 'brood',
    operationId: 'write',
  };
  const purchases = {
    characterId,
    ruleKind: 'broodmasterEidolon' as const,
    operationId: 'buy',
  };
  await expect(
    outsider.mutation(setAllocation, { ...scope, components: first }),
  ).rejects.toThrow();
  await expect(
    outsider.mutation(setGroupPurchases, { ...purchases, purchases: [] }),
  ).rejects.toThrow();
  await expect(outsider.query(listPools, { characterId })).rejects.toThrow();
  for (const hitDice of [-1, 1.5, 100])
    await expect(
      member.mutation(setAllocation, {
        ...scope,
        components: { ...first, hitDice },
      }),
    ).rejects.toThrow('whole numbers from 0 to 99');
  await expect(
    member.mutation(setAllocation, { ...scope, levels: 2, components: first }),
  ).rejects.toThrow('either');
  await expect(
    member.mutation(setAllocation, { ...scope, levels: 2 }),
  ).rejects.toThrow('divides effective levels');
  await expect(
    member.mutation(setGroupPurchases, {
      ...purchases,
      purchases: ['large', 'large'],
    }),
  ).rejects.toThrow('once');
  await owner.mutation(api.characterSheet.setArchetypeSelected, {
    characterId,
    classEntryId: (await summonerClass(owner, characterId))._id,
    catalogEntryId: archetypeId,
    selected: false,
    operationId: 'drop-broodmaster',
  });
  await expect(
    member.mutation(setAllocation, { ...scope, components: first }),
  ).rejects.toThrow('divides components');
  // Clearing is always allowed, as for effective levels.
  await member.mutation(setAllocation, {
    ...scope,
    components: null,
    operationId: 'clear',
  });
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
  await expect(
    member.mutation(setGroupPurchases, { ...purchases, purchases: ['large'] }),
  ).rejects.toThrow('MAINTENANCE');
  await expect(
    member.mutation(setAllocation, { ...scope, components: null }),
  ).rejects.toThrow('MAINTENANCE');
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationControl', controlId, { closed: false }),
  );
  await expect(
    member.mutation(setGroupPurchases, { ...purchases, purchases: ['large'] }),
  ).rejects.toThrow('RELOAD_REQUIRED');
  const summoner = await owner.query(api.characterSheet.read, { characterId });
  expect(
    summoner?.entries.find((entry) => entry.kind === 'base')?.state,
  ).not.toHaveProperty('companionGroupPurchases');
  const rows = await owner.query(api.companionRelationships.list, {
    characterId: one.companionId,
  });
  expect(rows[0]?.sources[0]).not.toHaveProperty('allocatedComponents');
});

test('seeded representative Broodmaster content divides components on an isolated prepared sheet', async () => {
  const { owner, member, campaignId } = await fixture();
  const summonerId = await owner.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Seeded summoner',
    kind: 'pc',
    operationId: 'seeded-summoner',
  });
  const seeded = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId: summonerId }),
  );
  const definition = (ruleIdentity: string) => {
    const found = seeded?.catalogEntries.find(
      (entry) => entry.ruleIdentity === ruleIdentity,
    );
    if (!found) throw new Error(`Missing seeded ${ruleIdentity}`);
    return found;
  };
  const archetype = definition('summoner-broodmaster');
  expect(archetype.browseOnly).toBe(true);
  const summoner = definition('summoner');
  const initial = seeded?.entries.find((entry) => entry.kind === 'classLevel');
  if (!initial) throw new Error('Missing seeded level');
  await owner.mutation(api.characterSheet.editClassLevel, {
    characterId: summonerId,
    entryId: initial._id,
    classEntryId: summoner._id,
    hpGained: 8,
    operationId: 'seeded-one',
  });
  await owner.mutation(api.characterSheet.addClassLevel, {
    characterId: summonerId,
    classEntryId: summoner._id,
    operationId: 'seeded-two',
  });
  await owner.mutation(api.characterSheet.setArchetypeSelected, {
    characterId: summonerId,
    classEntryId: summoner._id,
    catalogEntryId: archetype._id,
    selected: true,
    operationId: 'seeded-broodmaster',
  });
  const applied = await owner.query(api.characterSheet.read, {
    characterId: summonerId,
  });
  const grant = applied?.calculated.resolvedEntries.find(
    ({ entry }) =>
      'grantKey' in entry &&
      entry.grantKey?.source === 'summoner-broodmaster' &&
      applied.catalogEntries.find(
        (catalog) =>
          'catalogEntryId' in entry && catalog._id === entry.catalogEntryId,
      )?.ruleIdentity === 'summoner-broodmaster-eidolon-brood',
  )?.entry;
  const grantKey = grant && 'grantKey' in grant ? grant.grantKey : undefined;
  if (!grantKey) throw new Error('Missing Eidolon Brood Grant');
  const companionId = await classlessEidolon(member, campaignId, 'Seeded');
  const relationshipId = await owner.mutation(api.companionRelationships.link, {
    associatedCharacterId: summonerId,
    companionCharacterId: companionId,
    kind: 'eidolon',
    sources: [
      { key: 'brood', label: 'Eidolon Brood', grantKey, enabled: true },
    ],
    operationId: 'seeded-link',
  });
  await member.mutation(api.characterSheet.setCompanionProgression, {
    characterId: companionId,
    operationId: 'seeded-progression',
    progression: smallBiped,
  });
  await owner.mutation(setAllocation, {
    relationshipId,
    sourceKey: 'brood',
    components: first,
    operationId: 'seeded-allocation',
  });
  expect((await read(member, companionId))?.calculated).toMatchObject({
    hitDice: 1,
    derivedStatistics: { bab: { total: 2 } },
    companionProgression: {
      contributions: [{ ruleKind: 'broodmasterEidolon', kind: 'component' }],
    },
  });
  expect(
    await owner.query(listPools, { characterId: summonerId }),
  ).toMatchObject([
    {
      ruleKind: 'broodmasterEidolon',
      sources: expect.arrayContaining([
        expect.objectContaining({ pages: '78' }),
      ]),
      members: [{ companion: { name: 'Seeded' } }],
    },
  ]);
});

type Client = ReturnType<ReturnType<typeof convexTest>['withIdentity']>;
function read(client: Client, characterId: Id<'character'>) {
  return client.query(api.characterSheet.read, { characterId });
}

async function summonerClass(client: Client, characterId: Id<'character'>) {
  const sheet = await read(client, characterId);
  const found = sheet?.catalogEntries.find(
    (entry) => entry.ruleIdentity === 'summoner' && entry.scope === 'character',
  );
  if (!found) throw new Error('Missing summoner');
  return found;
}

const smallBiped = {
  kind: 'eidolon' as const,
  baseForm: 'biped' as const,
  size: 'small' as const,
  hpGained: 6,
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

async function fixture(summonerLevel = 2) {
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
        namespace: 'broodmaster',
        version: 1,
        workerKey: '0',
        caseKey: 'broodmaster',
        campaignKey: 'broodmaster',
      },
    }),
  );
  const characterId = await owner.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Vess',
    kind: 'pc',
    operationId: 'vess',
  });
  const archetypeId = await t.run(async (ctx) => {
    const summoner = await ctx.db.insert('catalogEntry', {
      characterId,
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
    });
    return ctx.db.insert('catalogEntry', {
      characterId,
      scope: 'character',
      name: 'Broodmaster',
      ruleIdentity: 'summoner-broodmaster',
      sources: [{ book: 'Pathfinder RPG Ultimate Magic', pages: '78' }],
      modifiers: [],
      stacksWithItself: false,
      detail: {
        kind: 'archetype',
        classEntryIds: [summoner],
        replaces: [],
        adds: [],
      },
    });
  });
  const summoner = await summonerClass(owner, characterId);
  const master = await read(owner, characterId);
  const initialLevel = master?.entries.find(
    (entry) => entry.kind === 'classLevel',
  );
  if (!initialLevel) throw new Error('Missing initial level');
  await owner.mutation(api.characterSheet.editClassLevel, {
    characterId,
    entryId: initialLevel._id,
    classEntryId: summoner._id,
    hpGained: 8,
    operationId: 'summoner-one',
  });
  for (let position = 2; position <= summonerLevel; position++)
    await owner.mutation(api.characterSheet.addClassLevel, {
      characterId,
      classEntryId: summoner._id,
      operationId: `level-${position}`,
    });
  await owner.mutation(api.characterSheet.setArchetypeSelected, {
    characterId,
    classEntryId: summoner._id,
    catalogEntryId: archetypeId,
    selected: true,
    operationId: 'broodmaster',
  });
  const completed = await read(owner, characterId);
  const summonerLevels = (completed?.entries ?? [])
    .flatMap((entry) => (entry.kind === 'classLevel' ? [entry] : []))
    .sort((a, b) => a.state.position - b.state.position)
    .map((level) => level._id);
  const eidolons = [];
  for (const name of ['Brute', 'Skitter']) {
    const companionId = await classlessEidolon(member, campaignId, name);
    const relationshipId = await owner.mutation(
      api.companionRelationships.link,
      {
        associatedCharacterId: characterId,
        companionCharacterId: companionId,
        kind: 'eidolon',
        sources: [
          {
            key: 'brood',
            label: 'Eidolon Brood',
            sheetEntryId: initialLevel._id,
            enabled: true,
          },
        ],
        operationId: `link-${name}`,
      },
    );
    await member.mutation(api.characterSheet.setCompanionProgression, {
      characterId: companionId,
      operationId: `eidolon-${name}`,
      progression: smallBiped,
    });
    eidolons.push({ companionId, relationshipId });
  }
  const [one, two] = eidolons;
  if (!one || !two) throw new Error('Missing eidolons');
  return {
    t,
    owner,
    member,
    outsider,
    campaignId,
    characterId,
    archetypeId,
    summonerLevels,
    eidolons: [one, two] as const,
  };
}
