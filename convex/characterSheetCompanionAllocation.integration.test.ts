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
// Each case builds a ten-level Beast Master and two linked wolves; under a
// full parallel run that setup alone can exceed the local 5s default.
vi.setConfig({ testTimeout: 15_000 });
const setAllocation = api.companionRelationships.setSourceAllocation;
const listPools = api.companionRelationships.listAllocationPools;

// APG p. 124 Beast Master, CRB Table 3–8: a ranger 7 Beast Master has four
// effective druid levels to divide; 4 levels give 4 HD, 2 levels give 3 HD.
test('a Beast Master divides its effective druid levels before each companion’s lookup', async () => {
  const { owner, member, wolves, characterId } = await fixture();
  const [first, second] = wolves;
  const before = await member.query(api.characterSheet.read, {
    characterId: first.companionId,
  });
  expect(before?.calculated.companionProgression).toMatchObject({
    status: 'unresolved',
    contributions: [
      {
        sourceKey: 'beast-master',
        ruleKind: 'beastMasterCompanion',
        classLevels: 7,
        allocation: { levels: null, budget: 4, pool: { allocated: 0 } },
      },
    ],
  });
  expect(before?.calculated.warnings).toContainEqual(
    expect.objectContaining({ check: 'companionAllocationMissing' }),
  );
  await member.mutation(setAllocation, {
    relationshipId: first.relationshipId,
    sourceKey: 'beast-master',
    levels: 4,
    operationId: 'first-four',
  });
  await owner.mutation(setAllocation, {
    relationshipId: second.relationshipId,
    sourceKey: 'beast-master',
    levels: 2,
    operationId: 'second-two',
  });
  const over = await read(member, first.companionId);
  expect(over?.calculated).toMatchObject({
    level: 0,
    classLevels: [],
    hitDice: 4,
    companionProgression: {
      status: 'active',
      effectiveLevel: 4,
      contributions: [
        {
          kind: 'allocation',
          allocation: {
            levels: 4,
            budget: 4,
            pool: { allocated: 6, companions: 2, selections: 1 },
          },
        },
      ],
    },
  });
  expect(over?.calculated.warnings).toContainEqual(
    expect.objectContaining({ check: 'companionAllocationBudget' }),
  );
  expect(over?.companionCalculationInputs).toMatchObject({
    companionProgressionSources: [
      {
        sourceKey: 'beast-master',
        ruleKind: 'beastMasterCompanion',
        counting: true,
        allocatedLevels: 4,
        pool: { allocated: 6, companions: 2, selections: 1 },
      },
    ],
  });
  expect(await owner.query(listPools, { characterId })).toEqual([
    expect.objectContaining({
      ruleKind: 'beastMasterCompanion',
      label: 'Beast Master',
      kind: 'allocation',
      classLevels: 7,
      budget: 4,
      allocated: 6,
      remaining: -2,
      overBudget: true,
      members: [
        expect.objectContaining({
          relationshipId: first.relationshipId,
          levels: 4,
          counting: true,
          companion: { characterId: first.companionId, name: 'Fang' },
        }),
        expect.objectContaining({
          relationshipId: second.relationshipId,
          levels: 2,
          counting: true,
          companion: { characterId: second.companionId, name: 'Claw' },
        }),
      ],
    }),
  ]);
  await member.mutation(setAllocation, {
    relationshipId: first.relationshipId,
    sourceKey: 'beast-master',
    levels: 2,
    operationId: 'first-two',
  });
  for (const wolf of wolves) {
    const sheet = await read(member, wolf.companionId);
    expect(sheet?.calculated).toMatchObject({
      hitDice: 3,
      companionProgression: { effectiveLevel: 2 },
    });
    expect(
      sheet?.calculated.warnings.filter(({ check }) =>
        check.startsWith('companionAllocation'),
      ),
    ).toEqual([]);
  }
});

test('a shrinking budget keeps every allocation with a warning and restoration clears it', async () => {
  const { owner, member, wolves, characterId, rangerLevels } = await fixture();
  for (const wolf of wolves)
    await member.mutation(setAllocation, {
      relationshipId: wolf.relationshipId,
      sourceKey: 'beast-master',
      levels: 2,
      operationId: `two-${wolf.companionId}`,
    });
  for (const level of rangerLevels.slice(4).reverse())
    await owner.mutation(api.characterSheet.deleteClassLevel, {
      characterId,
      entryId: level,
      operationId: `drop-${level}`,
    });
  const reduced = await read(member, wolves[0].companionId);
  expect(reduced?.calculated).toMatchObject({
    hitDice: 3,
    companionProgression: {
      effectiveLevel: 2,
      contributions: [
        {
          classLevels: 4,
          allocation: { levels: 2, budget: 1, pool: { allocated: 4 } },
        },
      ],
    },
  });
  expect(reduced?.calculated.warnings).toContainEqual(
    expect.objectContaining({ check: 'companionAllocationBudget' }),
  );
  expect(await owner.query(listPools, { characterId })).toMatchObject([
    { budget: 1, allocated: 4, overBudget: true },
  ]);
  const ranger = (
    await owner.query(api.characterSheet.read, { characterId })
  )?.catalogEntries.find((entry) => entry.ruleIdentity === 'ranger');
  if (!ranger) throw new Error('Missing ranger');
  // Ranger 12 with Strong Bond: the budget becomes the full ranger level.
  for (let position = 5; position <= 12; position++)
    await owner.mutation(api.characterSheet.addClassLevel, {
      characterId,
      classEntryId: ranger._id,
      operationId: `ranger-${position}`,
    });
  const restored = await read(member, wolves[0].companionId);
  expect(restored?.calculated.companionProgression).toMatchObject({
    effectiveLevel: 2,
    contributions: [
      { classLevels: 12, allocation: { budget: 12, pool: { allocated: 4 } } },
    ],
  });
  expect(
    restored?.calculated.warnings.filter(({ check }) =>
      check.startsWith('companionAllocation'),
    ),
  ).toEqual([]);
});

test('losing one source removes only its support and restoration brings the retained allocation back', async () => {
  const { owner, member, wolves, druidLevel, characterId } = await fixture();
  const [first, second] = wolves;
  await owner.mutation(api.companionRelationships.addSource, {
    relationshipId: first.relationshipId,
    source: {
      key: 'nature-bond',
      label: 'Nature bond',
      sheetEntryId: druidLevel,
      enabled: true,
    },
    operationId: 'add-druid',
  });
  for (const [wolf, levels] of [
    [first, 3],
    [second, 1],
  ] as const)
    await member.mutation(setAllocation, {
      relationshipId: wolf.relationshipId,
      sourceKey: 'beast-master',
      levels,
      operationId: `allocate-${levels}`,
    });
  // CRB p. 51: Druid 3 stacks onto the Beast Master share: 3 + 3 = 6.
  expect(
    (await read(member, first.companionId))?.calculated.companionProgression,
  ).toMatchObject({
    effectiveLevel: 6,
    contributions: [
      { sourceKey: 'beast-master', effectiveLevel: 3 },
      { sourceKey: 'nature-bond', classLevels: 3, effectiveLevel: 3 },
    ],
  });
  await owner.mutation(api.companionRelationships.setSourceEnabled, {
    relationshipId: first.relationshipId,
    sourceKey: 'beast-master',
    enabled: false,
    operationId: 'lose-beast-master',
  });
  expect(
    (await read(member, first.companionId))?.calculated.companionProgression,
  ).toMatchObject({
    status: 'active',
    effectiveLevel: 3,
    contributions: [
      {
        sourceKey: 'beast-master',
        counting: false,
        effectiveLevel: null,
        allocation: { levels: 3 },
      },
      { sourceKey: 'nature-bond', effectiveLevel: 3 },
    ],
  });
  expect(
    (await read(member, second.companionId))?.calculated.companionProgression
      ?.contributions[0],
  ).toMatchObject({
    allocation: { levels: 1, pool: { allocated: 1, companions: 1 } },
  });
  await owner.mutation(api.companionRelationships.interrupt, {
    relationshipId: second.relationshipId,
    operationId: 'interrupt-second',
  });
  const pools = await owner.query(listPools, { characterId });
  expect(pools[0]).toMatchObject({
    allocated: 0,
    members: [
      expect.objectContaining({ levels: 3, counting: false }),
      expect.objectContaining({ levels: 1, counting: false }),
    ],
  });
  await owner.mutation(api.companionRelationships.restore, {
    relationshipId: second.relationshipId,
    operationId: 'restore-second',
  });
  await owner.mutation(api.companionRelationships.setSourceEnabled, {
    relationshipId: first.relationshipId,
    sourceKey: 'beast-master',
    enabled: true,
    operationId: 'restore-beast-master',
  });
  expect(
    (await read(member, first.companionId))?.calculated.companionProgression,
  ).toMatchObject({
    effectiveLevel: 6,
    contributions: [
      { allocation: { levels: 3, pool: { allocated: 4, companions: 2 } } },
      { sourceKey: 'nature-bond' },
    ],
  });
});

// Boon Companion (Ultimate Wilderness p. 217): +4 for one companion, to at
// most the character level (ranger 7 + druid 3 = 10).
test('Boon Companion raises one companion and warns when one selection supports several', async () => {
  const { owner, member, wolves, boonFeat, characterId } = await fixture();
  const [first, second] = wolves;
  for (const wolf of wolves)
    await member.mutation(setAllocation, {
      relationshipId: wolf.relationshipId,
      sourceKey: 'beast-master',
      levels: 2,
      operationId: `two-${wolf.companionId}`,
    });
  await owner.mutation(api.companionRelationships.addSource, {
    relationshipId: first.relationshipId,
    source: {
      key: 'boon',
      label: 'Boon Companion',
      sheetEntryId: boonFeat,
      enabled: true,
    },
    operationId: 'boon-first',
  });
  const boosted = await read(member, first.companionId);
  expect(boosted?.calculated.companionProgression).toMatchObject({
    effectiveLevel: 6,
    contributions: [
      { sourceKey: 'beast-master', effectiveLevel: 2 },
      {
        sourceKey: 'boon',
        ruleKind: 'boonCompanion',
        effectiveLevel: 4,
        increase: {
          amount: 4,
          characterLevel: 10,
          pool: { companions: 1, selections: 1 },
        },
      },
    ],
  });
  await owner.mutation(api.companionRelationships.addSource, {
    relationshipId: second.relationshipId,
    source: {
      key: 'boon',
      label: 'Boon Companion',
      sheetEntryId: boonFeat,
      enabled: true,
    },
    operationId: 'boon-second',
  });
  const shared = await read(member, first.companionId);
  expect(shared?.calculated.companionProgression?.effectiveLevel).toBe(6);
  expect(shared?.calculated.warnings).toContainEqual(
    expect.objectContaining({
      check: 'companionAllocationBudget',
      message: expect.stringContaining('Boon Companion'),
    }),
  );
  expect(await owner.query(listPools, { characterId })).toMatchObject([
    { kind: 'allocation' },
    { kind: 'increase', budget: 1, allocated: 2, overBudget: true },
  ]);
});

// Ultimate Wilderness p. 217: taken again, Boon Companion applies to a
// different companion, so two selections on two companions are legal.
test('two Boon Companion selections each raise a different companion without a warning', async () => {
  const { owner, member, wolves, boonFeat, boonCatalogEntryId, characterId } =
    await fixture();
  const secondFeat = await owner.mutation(api.characterSheet.selectEntry, {
    characterId,
    catalogEntryId: boonCatalogEntryId,
    operationId: 'boon-again',
  });
  for (const [index, wolf] of wolves.entries()) {
    await member.mutation(setAllocation, {
      relationshipId: wolf.relationshipId,
      sourceKey: 'beast-master',
      levels: 2,
      operationId: `two-${index}`,
    });
    await owner.mutation(api.companionRelationships.addSource, {
      relationshipId: wolf.relationshipId,
      source: {
        key: 'boon',
        label: 'Boon Companion',
        sheetEntryId: index === 0 ? boonFeat : secondFeat,
        enabled: true,
      },
      operationId: `boon-${index}`,
    });
  }
  for (const wolf of wolves) {
    const sheet = await read(member, wolf.companionId);
    expect(sheet?.calculated.companionProgression).toMatchObject({
      effectiveLevel: 6,
      contributions: [
        { sourceKey: 'beast-master', effectiveLevel: 2 },
        {
          sourceKey: 'boon',
          effectiveLevel: 4,
          increase: { pool: { companions: 2, selections: 2 } },
        },
      ],
    });
    expect(
      sheet?.calculated.warnings.filter(({ check }) =>
        check.startsWith('companionAlloc'),
      ),
    ).toEqual([]);
  }
  expect(await owner.query(listPools, { characterId })).toMatchObject([
    { kind: 'allocation', budget: 4, allocated: 4, overBudget: false },
    { kind: 'increase', budget: 2, allocated: 2, overBudget: false },
  ]);
});

test('allocation edits persist across devices, attribute the latest change and refresh militia facts', async () => {
  const { owner, member, wolves, campaignId, characterId } = await fixture();
  const seeded = await owner.run((ctx) =>
    seedAcceptedCampaign(ctx, campaignId),
  );
  const [first] = wolves;
  await member.mutation(setAllocation, {
    relationshipId: first.relationshipId,
    sourceKey: 'beast-master',
    levels: 4,
    operationId: 'member-device',
  });
  const seenByOwner = await owner.query(api.companionRelationships.list, {
    characterId,
  });
  expect(
    seenByOwner.find((row) => row.relationshipId === first.relationshipId),
  ).toMatchObject({
    lastOperationId: 'member-device',
    sources: [
      expect.objectContaining({ key: 'beast-master', allocatedLevels: 4 }),
    ],
  });
  // Two devices edit without seeing each other: the later write wins and is
  // attributed; nothing is merged or trimmed.
  await owner.mutation(setAllocation, {
    relationshipId: first.relationshipId,
    sourceKey: 'beast-master',
    levels: 3,
    operationId: 'owner-device',
  });
  await member.mutation(setAllocation, {
    relationshipId: first.relationshipId,
    sourceKey: 'beast-master',
    levels: 1,
    operationId: 'member-again',
  });
  const latest = await owner.query(api.companionRelationships.list, {
    characterId: first.companionId,
  });
  expect(latest[0]).toMatchObject({
    lastOperationId: 'member-again',
    sources: [expect.objectContaining({ allocatedLevels: 1 })],
  });
  // CRB Table 3–8: effective level 1 gives 2 HD.
  const ledger = await owner.query(api.canonicalLedger.read, {
    campaignId,
    militiaId: seeded.key.militiaId,
  });
  expect(ledger.state.militiaSnapshot.characters).toContainEqual(
    expect.objectContaining({
      characterId: first.companionId,
      level: 0,
      actualHitDice: 2,
    }),
  );
  await member.mutation(setAllocation, {
    relationshipId: first.relationshipId,
    sourceKey: 'beast-master',
    levels: null,
    operationId: 'clear',
  });
  expect(
    (await read(member, first.companionId))?.calculated.companionProgression,
  ).toMatchObject({ status: 'unresolved', effectiveLevel: null });
});

test('hidden Beast Masters keep allocations unresolved until a saved fallback supplies the ranger level', async () => {
  const { t, owner, member, wolves, characterId, campaignId } = await fixture();
  const [first, second] = wolves;
  for (const wolf of wolves)
    await member.mutation(setAllocation, {
      relationshipId: wolf.relationshipId,
      sourceKey: 'beast-master',
      levels: 2,
      operationId: `two-${wolf.companionId}`,
    });
  await t.run((ctx) =>
    ctx.db.patch('character', characterId, {
      campaignId: undefined,
      sheetDemo: true,
    }),
  );
  const hidden = await read(member, first.companionId);
  expect(hidden?.calculated).toMatchObject({
    hitDice: null,
    companionProgression: {
      status: 'unresolved',
      contributions: [
        {
          sourceKey: 'rule:beastMasterCompanion',
          allocation: { levels: 2, budget: null, pool: null },
        },
      ],
    },
  });
  expect(JSON.stringify(hidden?.companionCalculationInputs)).not.toContain(
    'pool',
  );
  await expect(member.query(listPools, { characterId })).rejects.toThrow();
  await member.mutation(api.characterSheetLinkedInputs.saveFallback, {
    characterId: first.companionId,
    relationshipId: first.relationshipId,
    input: { kind: 'classLevels', classRuleIdentity: 'ranger' },
    value: 7,
    operationId: 'fallback-ranger',
  });
  expect((await read(member, first.companionId))?.calculated).toMatchObject({
    hitDice: 3,
    companionProgression: {
      status: 'active',
      effectiveLevel: 2,
      contributions: [
        {
          resolution: 'fallback',
          fallbackState: 'applied',
          allocation: { levels: 2, budget: 4 },
        },
      ],
    },
  });
  expect(
    (await read(member, second.companionId))?.calculated.hitDice,
  ).toBeNull();
  await t.run((ctx) =>
    ctx.db.patch('character', characterId, {
      campaignId,
      sheetDemo: undefined,
    }),
  );
  expect(
    (await read(owner, first.companionId))?.calculated.companionProgression,
  ).toMatchObject({
    contributions: [
      {
        sourceKey: 'beast-master',
        resolution: 'calculated',
        fallbackState: 'suspended',
        allocation: { levels: 2, budget: 4, pool: { allocated: 4 } },
      },
    ],
  });
});

test('replacing a companion carries its allocation to the replacement and stops counting the former one', async () => {
  const { owner, member, wolves, characterId, campaignId } = await fixture();
  const [first] = wolves;
  await member.mutation(setAllocation, {
    relationshipId: first.relationshipId,
    sourceKey: 'beast-master',
    levels: 3,
    operationId: 'three',
  });
  const replacementId = await member.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Ash',
    kind: 'npc',
    operationId: 'ash',
  });
  const replacementRelationshipId = await owner.mutation(
    api.companionRelationships.replace,
    {
      relationshipId: first.relationshipId,
      companionCharacterId: replacementId,
      operationId: 'replace',
    },
  );
  const pool = (await owner.query(listPools, { characterId }))[0];
  expect(pool).toMatchObject({ allocated: 3 });
  expect(pool?.members).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        relationshipId: first.relationshipId,
        levels: 3,
        counting: false,
      }),
      expect.objectContaining({
        relationshipId: replacementRelationshipId,
        levels: 3,
        counting: true,
      }),
    ]),
  );
});

test('allocation writes require associated access, valid levels and a dividing source', async () => {
  const { t, owner, member, outsider, wolves, characterId, druidLevel } =
    await fixture();
  const [first] = wolves;
  const scope = {
    relationshipId: first.relationshipId,
    sourceKey: 'beast-master',
    operationId: 'write',
  };
  await expect(
    outsider.mutation(setAllocation, { ...scope, levels: 2 }),
  ).rejects.toThrow();
  await expect(outsider.query(listPools, { characterId })).rejects.toThrow();
  for (const levels of [-1, 1.5, 21])
    await expect(
      member.mutation(setAllocation, { ...scope, levels }),
    ).rejects.toThrow('whole number of effective levels from 0 to 20');
  await expect(
    member.mutation(setAllocation, {
      ...scope,
      sourceKey: 'missing',
      levels: 2,
    }),
  ).rejects.toThrow('Supporting source not found');
  await owner.mutation(api.companionRelationships.addSource, {
    relationshipId: first.relationshipId,
    source: {
      key: 'nature-bond',
      label: 'Nature bond',
      sheetEntryId: druidLevel,
      enabled: true,
    },
    operationId: 'add-druid',
  });
  await expect(
    member.mutation(setAllocation, {
      ...scope,
      sourceKey: 'nature-bond',
      levels: 2,
    }),
  ).rejects.toThrow('divides effective levels');
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
    member.mutation(setAllocation, { ...scope, levels: 2 }),
  ).rejects.toThrow('MAINTENANCE');
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationControl', controlId, { closed: false }),
  );
  await expect(
    member.mutation(setAllocation, { ...scope, levels: 2 }),
  ).rejects.toThrow('RELOAD_REQUIRED');
  const rows = await owner.query(api.companionRelationships.list, {
    characterId: first.companionId,
  });
  expect(rows[0]?.sources[0]).not.toHaveProperty('allocatedLevels');
});

test('seeded representative Beast Master content divides levels on an isolated prepared sheet', async () => {
  const { owner, member, campaignId } = await fixture();
  const rangerId = await owner.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Seeded ranger',
    kind: 'pc',
    operationId: 'seeded-ranger',
  });
  const seeded = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId: rangerId }),
  );
  const definition = (ruleIdentity: string) => {
    const found = seeded?.catalogEntries.find(
      (entry) => entry.ruleIdentity === ruleIdentity,
    );
    if (!found) throw new Error(`Missing seeded ${ruleIdentity}`);
    return found;
  };
  for (const ruleIdentity of [
    'druid',
    'hunter',
    'druid-pack-lord',
    'hunter-packmaster',
  ])
    expect(definition(ruleIdentity).browseOnly).toBe(true);
  const ranger = definition('ranger');
  const initial = seeded?.entries.find((entry) => entry.kind === 'classLevel');
  if (!initial) throw new Error('Missing level');
  await owner.mutation(api.characterSheet.editClassLevel, {
    characterId: rangerId,
    entryId: initial._id,
    classEntryId: ranger._id,
    hpGained: 10,
    operationId: 'seeded-one',
  });
  for (let position = 2; position <= 7; position++)
    await owner.mutation(api.characterSheet.addClassLevel, {
      characterId: rangerId,
      classEntryId: ranger._id,
      operationId: `seeded-${position}`,
    });
  await owner.mutation(api.characterSheet.setArchetypeSelected, {
    characterId: rangerId,
    classEntryId: ranger._id,
    catalogEntryId: definition('ranger-beast-master')._id,
    selected: true,
    operationId: 'seeded-beast-master',
  });
  const applied = await owner.query(api.characterSheet.read, {
    characterId: rangerId,
  });
  const grant = applied?.calculated.resolvedEntries.find(
    ({ entry }) =>
      'grantKey' in entry &&
      entry.grantKey?.source === 'ranger-beast-master' &&
      applied.catalogEntries.find(
        (catalog) =>
          'catalogEntryId' in entry && catalog._id === entry.catalogEntryId,
      )?.ruleIdentity === 'ranger-beast-master-animal-companion',
  )?.entry;
  const grantKey = grant && 'grantKey' in grant ? grant.grantKey : undefined;
  if (!grantKey) throw new Error('Missing Beast Master companion Grant');
  const companionId = await member.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Seeded wolf',
    kind: 'npc',
    operationId: 'seeded-wolf',
  });
  const relationshipId = await owner.mutation(api.companionRelationships.link, {
    associatedCharacterId: rangerId,
    companionCharacterId: companionId,
    kind: 'animalCompanion',
    sources: [
      { key: 'companion', label: 'Animal Companion', grantKey, enabled: true },
    ],
    operationId: 'seeded-link',
  });
  await member.mutation(api.characterSheet.setCompanionProgression, {
    characterId: companionId,
    operationId: 'seeded-progression',
    progression: wolfChoices,
  });
  await owner.mutation(setAllocation, {
    relationshipId,
    sourceKey: 'companion',
    levels: 4,
    operationId: 'seeded-allocation',
  });
  expect(
    (await read(member, companionId))?.calculated.companionProgression,
  ).toMatchObject({
    effectiveLevel: 4,
    hitDice: 4,
    contributions: [
      {
        ruleKind: 'beastMasterCompanion',
        allocation: { levels: 4, budget: 4, pool: { allocated: 4 } },
      },
    ],
  });
  expect(await owner.query(listPools, { characterId: rangerId })).toMatchObject(
    [
      {
        ruleKind: 'beastMasterCompanion',
        sources: [{ pages: '124' }],
        members: [{ companion: { name: 'Seeded wolf' } }],
      },
    ],
  );
});

type Client = ReturnType<ReturnType<typeof convexTest>['withIdentity']>;
function read(client: Client, characterId: Id<'character'>) {
  return client.query(api.characterSheet.read, { characterId });
}

const wolfChoices = {
  species: 'wolf' as const,
  hpGained: 10,
  skillRanks: {},
  abilityIncreases: [],
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
        namespace: 'companion-allocation',
        version: 1,
        workerKey: '0',
        caseKey: 'companion-allocation',
        campaignKey: 'companion-allocation',
      },
    }),
  );
  const characterId = await owner.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Rhea',
    kind: 'pc',
    operationId: 'rhea',
  });
  const catalog = await t.run(async (ctx) => {
    const insertClass = (ruleIdentity: 'ranger' | 'druid') =>
      ctx.db.insert('catalogEntry', {
        characterId,
        scope: 'character',
        name: ruleIdentity === 'ranger' ? 'Ranger' : 'Druid',
        ruleIdentity,
        sources: [
          {
            book: 'Pathfinder RPG Core Rulebook',
            pages: ruleIdentity === 'ranger' ? '64–67' : '48–53',
          },
        ],
        modifiers: [],
        stacksWithItself: false,
        detail: {
          kind: 'class',
          classKind: 'base',
          hitDie: ruleIdentity === 'ranger' ? 10 : 8,
          bab: ruleIdentity === 'ranger' ? 'full' : 'threeQuarters',
          saves: { fort: 'good', ref: 'good', will: 'poor' },
          skillRanksPerLevel: 6,
          classSkills: [],
          featuresByLevel: [],
          picksByLevel: [],
        },
      });
    const ranger = await insertClass('ranger');
    const druid = await insertClass('druid');
    const archetype = await ctx.db.insert('catalogEntry', {
      characterId,
      scope: 'character',
      name: 'Beast Master',
      ruleIdentity: 'ranger-beast-master',
      sources: [
        { book: 'Pathfinder RPG Advanced Player’s Guide', pages: '124' },
      ],
      modifiers: [],
      stacksWithItself: false,
      detail: {
        kind: 'archetype',
        classEntryIds: [ranger],
        replaces: [],
        adds: [],
      },
    });
    const boon = await ctx.db.insert('catalogEntry', {
      characterId,
      scope: 'character',
      name: 'Boon Companion',
      ruleIdentity: 'boon-companion',
      sources: [{ book: 'Pathfinder RPG Ultimate Wilderness', pages: '217' }],
      modifiers: [],
      stacksWithItself: false,
      detail: { kind: 'feat' },
    });
    return { ranger, druid, archetype, boon };
  });
  const master = await owner.query(api.characterSheet.read, { characterId });
  const initialLevel = master?.entries.find(
    (entry) => entry.kind === 'classLevel',
  );
  if (!initialLevel) throw new Error('Missing initial level');
  await owner.mutation(api.characterSheet.editClassLevel, {
    characterId,
    entryId: initialLevel._id,
    classEntryId: catalog.ranger,
    hpGained: 10,
    operationId: 'ranger-one',
  });
  for (let position = 2; position <= 10; position++)
    await owner.mutation(api.characterSheet.addClassLevel, {
      characterId,
      classEntryId: position <= 7 ? catalog.ranger : catalog.druid,
      operationId: `level-${position}`,
    });
  await owner.mutation(api.characterSheet.setArchetypeSelected, {
    characterId,
    classEntryId: catalog.ranger,
    catalogEntryId: catalog.archetype,
    selected: true,
    operationId: 'beast-master',
  });
  const boonFeat = await owner.mutation(api.characterSheet.selectEntry, {
    characterId,
    catalogEntryId: catalog.boon,
    operationId: 'boon',
  });
  const completed = await owner.query(api.characterSheet.read, { characterId });
  const levels = (completed?.entries ?? [])
    .flatMap((entry) => (entry.kind === 'classLevel' ? [entry] : []))
    .sort((a, b) => a.state.position - b.state.position);
  const rangerLevels = levels.slice(0, 7).map((level) => level._id);
  const druidLevel = levels[7]?._id;
  if (!druidLevel) throw new Error('Missing druid level');
  const wolves = [];
  for (const name of ['Fang', 'Claw']) {
    const companionId = await member.mutation(api.characterSheet.create, {
      campaignId,
      organizationId: 'org',
      name,
      kind: 'npc',
      operationId: name,
    });
    const companion = await member.query(api.characterSheet.read, {
      characterId: companionId,
    });
    const unwanted = companion?.entries.find(
      (entry) => entry.kind === 'classLevel',
    );
    if (!unwanted) throw new Error('Missing companion level');
    await member.mutation(api.characterSheet.deleteClassLevel, {
      characterId: companionId,
      entryId: unwanted._id,
      operationId: `classless-${name}`,
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
      operationId: `scores-${name}`,
    });
    const relationshipId = await owner.mutation(
      api.companionRelationships.link,
      {
        associatedCharacterId: characterId,
        companionCharacterId: companionId,
        kind: 'animalCompanion',
        sources: [
          {
            key: 'beast-master',
            label: 'Beast Master',
            sheetEntryId: rangerLevels[0],
            enabled: true,
          },
        ],
        operationId: `link-${name}`,
      },
    );
    await member.mutation(api.characterSheet.setCompanionProgression, {
      characterId: companionId,
      operationId: `wolf-${name}`,
      progression: wolfChoices,
    });
    wolves.push({ companionId, relationshipId });
  }
  const [first, second] = wolves;
  if (!first || !second) throw new Error('Missing wolves');
  return {
    t,
    owner,
    member,
    outsider,
    campaignId,
    characterId,
    rangerLevels,
    druidLevel,
    boonFeat,
    boonCatalogEntryId: catalog.boon,
    wolves: [first, second] as const,
  };
}
