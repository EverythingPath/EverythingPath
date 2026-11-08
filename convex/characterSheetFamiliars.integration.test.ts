// @vitest-environment edge-runtime
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { convexTest, type TestConvex } from 'convex-test';
import { makeFunctionReference } from 'convex/server';
import { expect, test } from 'vitest';
import { preloadCalledConvexModules } from '../tests/convex-modules';
import { api } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import schema from './schema';
import {
  readCharacterSheetData,
  readCharacterSheetDataWithBudget,
} from './lib/characterSheetData';
import { loadPreparedCharacterSheet } from './lib/preparedCharacterSheet';
import { calculateMilitiaCharacterFacts } from './lib/militiaCharacterFacts';
import { jsonBytes } from '../src/lib/json-bytes';
import { createWeeklyDraft } from '../src/lib/weekly-draft';
import { weeklyDraftDataSchema } from '../src/lib/weekly-draft-contract';
import { militiaSnapshotSchema } from '../src/lib/canonical-weekly-source';
import { getEffectiveHitDice } from '../src/lib/canonical-roster';
import { COMPUTED_HIT_DICE_RULESET_VERSION } from '../src/lib/ruleset-versions';

const modules = import.meta.glob('./**/*.ts');
preloadCalledConvexModules({ modules, testFile: import.meta.url });
const selectBaseCreature = makeFunctionReference<
  'mutation',
  {
    characterId: Id<'character'>;
    relationshipId: Id<'companionRelationship'>;
    baseCreatureKey: string | null;
    operationId: string;
  }
>('characterSheetFamiliars:selectBaseCreature');

async function seedMilitia(
  t: Awaited<ReturnType<typeof fixture>>['t'],
  campaignId: Id<'campaign'>,
) {
  return await t.run(async (ctx) => {
    const militiaId = await ctx.db.insert('militia', {
      campaignId,
      name: 'Familiar militia',
    });
    await ctx.db.insert('canonicalMilitiaState', {
      campaignId,
      militiaId,
      revision: 0,
      snapshot: militiaSnapshotSchema.parse({
        rank: 1,
        training: 0,
        treasuryCopper: 100,
        notoriety: 0,
        focus: 'Loyalty',
        roster: { people: [], teams: [], officers: [] },
        characters: [],
        settlements: [],
        bonuses: [],
      }),
    });
    const draft = weeklyDraftDataSchema.parse(
      createWeeklyDraft({
        draftId: 'familiar-week',
        week: 1,
        slotIds: ['left', 'right'],
        context: {
          firstMilitiaWeek: true,
          startDay: 0,
          uneventfulCarry: false,
          carriedEvents: [],
          queuedEffects: [],
          orders: [],
          lastBuyoffWeek: null,
        },
      }),
    );
    await ctx.db.insert('canonicalWeeklyDraft', {
      campaignId,
      militiaId,
      draftId: draft.draftId,
      status: 'open',
      draft,
      initialDraft: draft,
      revision: 0,
    });
    return militiaId;
  });
}

async function firstClassLevel(
  t: TestConvex<typeof schema>,
  characterId: Id<'character'>,
) {
  return await t.run((ctx) =>
    ctx.db
      .query('characterSheetEntry')
      .withIndex('by_characterId_and_kind_and_active', (q) =>
        q
          .eq('characterId', characterId)
          .eq('kind', 'classLevel')
          .eq('active', true),
      )
      .first(),
  );
}

async function fixture() {
  const t = convexTest(schema, modules);
  const campaignId = await t.run(async (ctx) => {
    for (const person of ['owner', 'member', 'outsider'])
      await ctx.db.insert('user', {
        tokenIdentifier: person,
        characterSheetDemo: true,
        orgIds: person === 'outsider' ? [] : [{ orgId: 'org', role: 'member' }],
      });
    return ctx.db.insert('campaign', {
      name: 'Familiars',
      description: '',
      organizationId: 'org',
      ownerId: 'owner',
      e2eFixture: {
        namespace: 'familiars',
        version: 1,
        workerKey: '0',
        caseKey: 'familiar',
        campaignKey: 'familiar',
      },
    });
  });
  const owner = t.withIdentity({ tokenIdentifier: 'owner' });
  const member = t.withIdentity({ tokenIdentifier: 'member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Witch',
    kind: 'pc',
    operationId: 'witch',
  });
  const companionId = await member.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Cat',
    kind: 'npc',
    operationId: 'cat',
  });
  await member.mutation(api.characterSheet.editBaseScores, {
    characterId: companionId,
    scores: {
      strength: 3,
      dexterity: 15,
      constitution: 8,
      intelligence: 2,
      wisdom: 12,
      charisma: 7,
    },
    operationId: 'record-creature-scores',
  });
  // Setup looks up ids directly; each public sheet read is a full calculation.
  const companionLevel = await firstClassLevel(t, companionId);
  if (!companionLevel) throw new Error('Companion fixture missing');
  await member.mutation(api.characterSheet.deleteClassLevel, {
    characterId: companionId,
    entryId: companionLevel._id,
    operationId: 'creature-only',
  });
  const { wizard, witch } = await t.run(async (ctx) => {
    const preparedClass = (ruleIdentity: string) =>
      ctx.db
        .query('catalogEntry')
        .withIndex('by_characterId_and_ruleIdentity', (q) =>
          q.eq('characterId', characterId).eq('ruleIdentity', ruleIdentity),
        )
        .unique();
    return {
      wizard: await preparedClass('wizard'),
      witch: await preparedClass('witch'),
    };
  });
  const level = await firstClassLevel(t, characterId);
  if (!wizard || !witch || !level) throw new Error('Wizard fixture missing');
  await owner.mutation(api.characterSheet.editClassLevel, {
    characterId,
    entryId: level._id,
    classEntryId: wizard._id,
    hpGained: 6,
    skillRanks: { per: 1 },
    operationId: 'wizard1',
  });
  const second = await owner.mutation(api.characterSheet.addClassLevel, {
    characterId,
    classEntryId: wizard._id,
    operationId: 'wizard2',
  });
  await owner.mutation(api.characterSheet.editClassLevel, {
    characterId,
    entryId: second,
    hpGained: 4,
    skillRanks: { per: 1 },
    operationId: 'hp2',
  });
  const relationshipId = await owner.mutation(api.companionRelationships.link, {
    associatedCharacterId: characterId,
    companionCharacterId: companionId,
    kind: 'familiar',
    sources: [
      {
        key: 'wizard',
        label: 'Arcane bond',
        enabled: true,
        sheetEntryId: level._id,
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
    wizard,
    witch,
    level,
  };
}

test('familiar natural attacks use the higher Dexterity modifier in both projections', async () => {
  // CRB familiar attacks: Wizard 2 BAB +1, cat Dexterity +2 and Tiny size +2.
  const { member, companionId, relationshipId } = await fixture();
  await member.mutation(selectBaseCreature, {
    characterId: companionId,
    relationshipId,
    baseCreatureKey: 'cat',
    operationId: 'choose-attacking-cat',
  });
  const bite = await member.mutation(api.characterSheet.createSheetEntry, {
    characterId: companionId,
    name: 'Bite',
    modifiers: [],
    detail: {
      kind: 'item',
      consumable: false,
      weapon: {
        baseType: 'bite',
        proficiency: 'always',
        naturalAttack: { type: 'bite' },
      },
    },
    operationId: 'cat-bite',
  });
  const routineId = await member.mutation(
    api.characterSheet.createAttackRoutine,
    {
      characterId: companionId,
      weaponEntryId: bite,
      operationId: 'cat-natural-routine',
    },
  );
  const sheet = withSheetCatalog(
    await member.query(api.characterSheet.read, {
      characterId: companionId,
    }),
  );
  for (const projection of [sheet?.calculated, sheet?.permanentCalculated])
    expect(
      projection?.attackRoutines.find(
        (routine) => routine.entryId === routineId,
      )?.single[0],
    ).toMatchObject({
      attackKind: 'natural',
      attackBonus: { total: 5 },
      damageBonus: { total: -4 },
    });
});

test('familiar sheet uses linked maximum HP in each projection, excluding temporary HP', async () => {
  // CRB familiar Hit Points: half the master maximum, rounded down. Two wizard
  // levels with 6 + 4 HP yield 5; temporary Con +4 raises the current result to 7.
  const { owner, member, characterId, companionId, relationshipId } =
    await fixture();
  await member.mutation(selectBaseCreature, {
    characterId: companionId,
    relationshipId,
    baseCreatureKey: 'cat',
    operationId: 'choose-cat',
  });
  await owner.mutation(api.characterSheet.createSheetEntry, {
    characterId,
    name: 'Temporary Constitution',
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: false,
      defaultCasterLevel: 3,
    },
    modifiers: [{ target: 'ability.con', bonusType: 'enhancement', value: 4 }],
    operationId: 'temporary-con',
  });
  const sheet = withSheetCatalog(
    await member.query(api.characterSheet.read, {
      characterId: companionId,
    }),
  );
  expect(sheet?.calculated.hp).toBe(7);
  expect(sheet?.permanentCalculated.hp).toBe(5);
});

test('witch collection remains unchanged through independently owned familiar replacement and restoration', async () => {
  const {
    t,
    owner,
    member,
    characterId,
    companionId,
    relationshipId,
    witch,
    level,
  } = await fixture();
  await owner.mutation(api.characterSheet.editClassLevel, {
    characterId,
    entryId: level._id,
    classEntryId: witch._id,
    operationId: 'witch-class',
  });
  const spellId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: 'Retained witch spell',
      ruleIdentity: 'witch-retained-spell',
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: { kind: 'spell', levels: { witch: 1 }, school: 'divination' },
    }),
  );
  const spellEntryId = await owner.mutation(api.characterSheetSpells.record, {
    characterId,
    castingClassId: witch._id,
    catalogEntryId: spellId,
    operationId: 'record-witch-spell',
  });
  await member.mutation(selectBaseCreature, {
    characterId: companionId,
    relationshipId,
    baseCreatureKey: 'cat',
    operationId: 'old-cat',
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, { characterId }),
  );
  const replacement = await member.mutation(api.companionRelationships.create, {
    associatedCharacterId: characterId,
    kind: 'familiar',
    name: 'Raven',
    sources: [
      {
        key: 'replacement',
        label: 'Witch familiar',
        enabled: true,
        sheetEntryId: level._id,
      },
    ],
    operationId: 'raven',
  });
  await member.mutation(selectBaseCreature, {
    characterId: replacement.companionCharacterId,
    relationshipId: replacement.relationshipId,
    baseCreatureKey: 'raven',
    operationId: 'new-raven',
  });
  await member.mutation(api.companionRelationships.interrupt, {
    relationshipId: replacement.relationshipId,
    operationId: 'prepare-replacement',
  });
  const replacedId = await member.mutation(api.companionRelationships.replace, {
    relationshipId,
    companionCharacterId: replacement.companionCharacterId,
    operationId: 'replace-cat',
  });
  let cat;
  for (const action of [
    () =>
      member.mutation(api.companionRelationships.interrupt, {
        relationshipId: replacedId,
        operationId: 'interrupt-new',
      }),
    () =>
      owner.mutation(api.companionRelationships.restore, {
        relationshipId,
        operationId: 'restore-cat',
      }),
  ]) {
    await action();
    const after = withSheetCatalog(
      await member.query(api.characterSheet.read, { characterId }),
    );
    expect(after?.calculated.spellCollections).toEqual(
      before?.calculated.spellCollections,
    );
    expect(after?.entries.filter((row) => row.kind === 'spell')).toEqual(
      before?.entries.filter((row) => row.kind === 'spell'),
    );
    expect(
      after?.entries.find((row) => row._id === spellEntryId),
    ).toBeDefined();
    cat = withSheetCatalog(
      await member.query(api.characterSheet.read, {
        characterId: companionId,
      }),
    );
    expect(cat?.calculated.hitDice).toBe(1);
    expect(cat?.character.familiarBaseCreatureKey).toBe('cat');
  }
  // The restored cat read above is the final cat state; reading again repeats it.
  const raven = withSheetCatalog(
    await member.query(api.characterSheet.read, {
      characterId: replacement.companionCharacterId,
    }),
  );
  expect(cat?.calculated.familiar?.baseCreature?.key).toBe('cat');
  expect(raven?.character.familiarBaseCreatureKey).toBe('raven');
  expect(cat?.character.ownerId).toBe('member');
  expect(cat?.entries.filter((row) => row.kind === 'spell')).toEqual([]);
  expect(raven?.entries.filter((row) => row.kind === 'spell')).toEqual([]);
});

test('familiar owners edit retained species and fallbacks without gaining access to a private master', async () => {
  const {
    t,
    owner,
    member,
    outsider,
    campaignId,
    characterId,
    companionId,
    relationshipId,
  } = await fixture();
  await t.run((ctx) =>
    ctx.db.patch('character', characterId, {
      campaignId: undefined,
      sheetDemo: true,
    }),
  );
  await member.mutation(selectBaseCreature, {
    characterId: companionId,
    relationshipId,
    baseCreatureKey: 'toad',
    operationId: 'hidden-master-toad',
  });
  const before = withSheetCatalog(
    await member.query(api.characterSheet.read, {
      characterId: companionId,
    }),
  );
  expect(before?.calculated.familiar?.maximumHp).toBeNull();
  expect(before?.calculated.hp).toBeNull();
  expect(JSON.stringify(before?.calculated.familiar)).not.toContain(
    'Arcane bond',
  );
  expect(JSON.stringify(before?.calculated.familiar)).not.toContain('Witch');
  await expect(
    member.query(api.characterSheet.read, { characterId }),
  ).rejects.toThrow();
  await expect(
    outsider.mutation(selectBaseCreature, {
      characterId: companionId,
      relationshipId,
      baseCreatureKey: 'cat',
      operationId: 'outsider',
    }),
  ).rejects.toThrow();
  await expect(
    owner.mutation(selectBaseCreature, {
      characterId,
      relationshipId,
      baseCreatureKey: 'cat',
      operationId: 'wrong-endpoint',
    }),
  ).rejects.toThrow('does not belong');
  await expect(
    member.mutation(selectBaseCreature, {
      characterId: companionId,
      relationshipId,
      baseCreatureKey: 'dragon',
      operationId: 'unlisted',
    }),
  ).rejects.toThrow();
  await member.mutation(api.characterSheetLinkedInputs.saveFallback, {
    characterId: companionId,
    relationshipId,
    input: { kind: 'maximumHp' },
    value: 13,
    operationId: 'fallback',
  });
  const fallback = withSheetCatalog(
    await member.query(api.characterSheet.read, {
      characterId: companionId,
    }),
  );
  expect(fallback?.calculated.hp).toBe(6);
  await t.run((ctx) =>
    ctx.db.patch('character', characterId, {
      campaignId,
      sheetDemo: undefined,
    }),
  );
  const restored = withSheetCatalog(
    await member.query(api.characterSheet.read, {
      characterId: companionId,
    }),
  );
  expect(restored?.calculated.hp).toBe(5);
  expect(
    restored?.calculated.familiar?.linkedInputs.find(
      (row) => row.input.kind === 'maximumHp',
    ),
  ).toMatchObject({ fallback: 13, fallbackState: 'suspended' });
});

test('nested familiars read calculated master HP and preserve permanent filtering across every link', async () => {
  const { owner, member, characterId, companionId, relationshipId } =
    await fixture();
  await member.mutation(selectBaseCreature, {
    characterId: companionId,
    relationshipId,
    baseCreatureKey: 'cat',
    operationId: 'chain-cat',
  });
  const nested = await member.mutation(api.companionRelationships.create, {
    associatedCharacterId: companionId,
    kind: 'familiar',
    name: 'Nested toad',
    sources: [{ key: 'table-bond', label: 'Table bond', enabled: true }],
    operationId: 'nested',
  });
  await member.mutation(selectBaseCreature, {
    characterId: nested.companionCharacterId,
    relationshipId: nested.relationshipId,
    baseCreatureKey: 'toad',
    operationId: 'chain-toad',
  });
  await owner.mutation(api.characterSheet.createSheetEntry, {
    characterId,
    name: 'Temporary Constitution',
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: false,
      defaultCasterLevel: 3,
    },
    modifiers: [{ target: 'ability.con', bonusType: 'enhancement', value: 4 }],
    operationId: 'chain-con',
  });
  const sheet = withSheetCatalog(
    await member.query(api.characterSheet.read, {
      characterId: nested.companionCharacterId,
    }),
  );
  expect(sheet?.calculated.hp).toBe(3);
  expect(sheet?.permanentCalculated.hp).toBe(2);
  const scope = {
    characterId: nested.companionCharacterId,
    relationshipId: nested.relationshipId,
    input: { kind: 'maximumHp' } as const,
  };
  expect(
    await member.query(api.characterSheetLinkedInputs.read, scope),
  ).toMatchObject({ value: 7 });
  expect(
    await member.query(api.characterSheetLinkedInputs.read, {
      ...scope,
      projection: 'permanent',
    }),
  ).toMatchObject({ value: 5 });
});

test('familiar borrowed BAB, base saves and recorded ranks exclude unrelated master modifiers', async () => {
  const { owner, member, characterId, companionId, relationshipId } =
    await fixture();
  await member.mutation(selectBaseCreature, {
    characterId: companionId,
    relationshipId,
    baseCreatureKey: 'cat',
    operationId: 'numeric-cat',
  });
  await owner.mutation(api.characterSheet.createPersonalAdjustment, {
    characterId,
    name: 'Master only bonuses',
    modifiers: [
      { target: 'bab', bonusType: 'untyped', value: 9 },
      { target: 'saves', bonusType: 'untyped', value: 9 },
      { target: 'skill.per', bonusType: 'untyped', value: 20 },
    ],
    operationId: 'master-modifiers',
  });
  const sheet = withSheetCatalog(
    await member.query(api.characterSheet.read, {
      characterId: companionId,
    }),
  );
  expect(sheet?.calculated).toMatchObject({
    hitDice: 1,
    level: 0,
    familiar: {
      actualHitDice: 1,
      effectiveHitDice: 2,
      baseAttackBonus: 1,
      baseSaves: { fort: 2, ref: 2, will: 3 },
      skillRanks: { 'skill.per': 2 },
    },
    derivedStatistics: {
      bab: { total: 1 },
      fortitude: { total: 1 },
      reflex: { total: 4 },
      will: { total: 4 },
    },
  });
  expect(
    sheet?.calculated.skills.find((row) => row.key === 'skill.per')?.ranks,
  ).toBe(2);
});

test('an unspecified familiar progression stays unresolved until the player records a fallback', async () => {
  const { owner, member, companionId, relationshipId } = await fixture();
  await owner.mutation(api.companionRelationships.setSourceEnabled, {
    relationshipId,
    sourceKey: 'wizard',
    enabled: false,
    operationId: 'disable-wizard',
  });
  await owner.mutation(api.companionRelationships.addSource, {
    relationshipId,
    source: {
      key: 'table-rule',
      label: 'Unspecified familiar rule',
      enabled: true,
    },
    operationId: 'manual-source',
  });
  await member.mutation(selectBaseCreature, {
    characterId: companionId,
    relationshipId,
    baseCreatureKey: 'cat',
    operationId: 'manual-cat',
  });
  const before = withSheetCatalog(
    await member.query(api.characterSheet.read, {
      characterId: companionId,
    }),
  );
  expect(before?.calculated.familiar?.progression).toBeNull();
  await member.mutation(api.characterSheetLinkedInputs.saveFallback, {
    characterId: companionId,
    relationshipId,
    input: { kind: 'familiarProgressionLevels' },
    value: 5,
    operationId: 'progression-fallback',
  });
  const after = withSheetCatalog(
    await member.query(api.characterSheet.read, {
      characterId: companionId,
    }),
  );
  expect(after?.calculated.familiar?.progression).toMatchObject({
    level: 5,
    intelligence: 8,
    naturalArmor: 3,
  });
  expect(
    after?.calculated.familiar?.linkedInputs.find(
      (row) => row.input.kind === 'familiarProgressionLevels',
    ),
  ).toMatchObject({ fallback: 5, fallbackState: 'applied' });
});

test('species writes honor maintenance, authority, fixture and account gates without changing the sheet', async () => {
  const { t, member, campaignId, companionId, relationshipId } =
    await fixture();
  const command = {
    characterId: companionId,
    relationshipId,
    baseCreatureKey: 'cat',
    operationId: 'gated-choice',
  };
  const before = withSheetCatalog(
    await member.query(api.characterSheet.read, {
      characterId: companionId,
    }),
  );
  const controlId = await t.run(async (ctx) => {
    const runId = await ctx.db.insert('initialMigrationRun', {
      operationId: 'familiar-gate',
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
  await expect(member.mutation(selectBaseCreature, command)).rejects.toThrow(
    'MAINTENANCE',
  );
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationControl', controlId, { closed: false }),
  );
  await expect(member.mutation(selectBaseCreature, command)).rejects.toThrow(
    'RELOAD_REQUIRED',
  );
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationControl', controlId, {
      epoch: 0,
      authority: 'sheet',
    }),
  );
  await expect(member.mutation(selectBaseCreature, command)).rejects.toThrow(
    'RELOAD_REQUIRED',
  );
  expect(
    withSheetCatalog(
      await member.query(api.characterSheet.read, { characterId: companionId }),
    ),
  ).toEqual(before);
  await t.run(async (ctx) => {
    await ctx.db.patch('initialMigrationControl', controlId, {
      authority: 'legacy',
    });
    await ctx.db.patch('campaign', campaignId, { e2eFixture: undefined });
  });
  await expect(member.mutation(selectBaseCreature, command)).rejects.toThrow(
    "Character sheets aren't available",
  );
});

test('campaign Character reads expose permanent familiar ability and actual-HD facts', async () => {
  const { member, campaignId, companionId, relationshipId } = await fixture();
  await member.mutation(selectBaseCreature, {
    characterId: companionId,
    relationshipId,
    baseCreatureKey: 'cat',
    operationId: 'militia-cat',
  });
  await member.mutation(api.characterSheet.createSheetEntry, {
    characterId: companionId,
    name: 'Temporary Strength',
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: false,
      defaultCasterLevel: 3,
    },
    modifiers: [{ target: 'ability.str', bonusType: 'enhancement', value: 4 }],
    operationId: 'militia-temporary',
  });
  const sheet = withSheetCatalog(
    await member.query(api.characterSheet.read, {
      characterId: companionId,
    }),
  );
  expect(sheet?.calculated.abilities.strength.score).toBe(7);
  const characters = await member.query(api.character.listByCampaign, {
    campaignId,
    organizationId: 'org',
  });
  expect(characters.find((row) => row._id === companionId)).toMatchObject({
    strength: 3,
    intelligence: 6,
    racialHitDice: 1,
  });
});

test('militia facts give a familiar its actual Hit Dice, never its master’s effective Hit Dice', async () => {
  const {
    t,
    owner,
    member,
    campaignId,
    characterId,
    companionId,
    relationshipId,
    wizard,
  } = await fixture();
  const militiaId = await seedMilitia(t, campaignId);
  await member.mutation(selectBaseCreature, {
    characterId: companionId,
    relationshipId,
    baseCreatureKey: 'cat',
    operationId: 'actual-hd-cat',
  });
  for (const position of [3, 4])
    await owner.mutation(api.characterSheet.addClassLevel, {
      characterId,
      classEntryId: wizard._id,
      operationId: `actual-hd-wizard-${position}`,
    });
  const sheet = withSheetCatalog(
    await member.query(api.characterSheet.read, { characterId: companionId }),
  );
  expect(sheet?.permanentCalculated.familiar).toMatchObject({
    actualHitDice: 1,
    effectiveHitDice: 4,
  });
  const facts = (
    await member.query(api.canonicalLedger.read, { campaignId, militiaId })
  ).state.militiaSnapshot.characters.find(
    (row) => row.characterId === companionId,
  );
  if (!facts) throw new Error('Missing familiar facts');
  expect(facts).toMatchObject({ level: 0, racialHitDice: 1 });
  expect(
    getEffectiveHitDice(
      { hitDice: null },
      facts,
      COMPUTED_HIT_DICE_RULESET_VERSION,
    ),
  ).toBe(1);
});

test('a familiar master lends its own Class Level bases rather than inherited familiar bases', async () => {
  const { owner, member, companionId, relationshipId } = await fixture();
  await member.mutation(selectBaseCreature, {
    characterId: companionId,
    relationshipId,
    baseCreatureKey: 'cat',
    operationId: 'class-cat',
  });
  const cat = withSheetCatalog(
    await member.query(api.characterSheet.read, {
      characterId: companionId,
    }),
  );
  const wizard = cat?.catalogEntries.find(
    (row) => row.ruleIdentity === 'wizard',
  );
  if (!wizard) throw new Error('Companion Wizard missing');
  for (let level = 1; level <= 2; level++)
    await owner.mutation(api.characterSheet.addClassLevel, {
      characterId: companionId,
      classEntryId: wizard._id,
      operationId: `cat-wizard-${level}`,
    });
  const nested = await member.mutation(api.companionRelationships.create, {
    associatedCharacterId: companionId,
    kind: 'familiar',
    name: 'Class-linked toad',
    sources: [{ key: 'nested-bond', label: 'Nested bond', enabled: true }],
    operationId: 'nested-class',
  });
  await member.mutation(selectBaseCreature, {
    characterId: nested.companionCharacterId,
    relationshipId: nested.relationshipId,
    baseCreatureKey: 'toad',
    operationId: 'nested-class-toad',
  });
  const sheet = withSheetCatalog(
    await member.query(api.characterSheet.read, {
      characterId: nested.companionCharacterId,
    }),
  );
  expect(sheet?.calculated.familiar).toMatchObject({
    baseAttackBonus: 1,
    baseSaves: { fort: 2, ref: 2, will: 3 },
  });
});

test('master progression and source edits publish affected familiar militia facts in the same transaction', async () => {
  const {
    t,
    owner,
    member,
    campaignId,
    characterId,
    companionId,
    relationshipId,
    wizard,
  } = await fixture();
  const militiaId = await seedMilitia(t, campaignId);
  const scope = { campaignId, militiaId };
  await member.mutation(selectBaseCreature, {
    characterId: companionId,
    relationshipId,
    baseCreatureKey: 'cat',
    operationId: 'canonical-cat',
  });
  const before = await member.query(api.canonicalLedger.read, scope);
  expect(
    before.state.militiaSnapshot.characters.find(
      (row) => row.characterId === companionId,
    )?.intelligence,
  ).toBe(6);
  await owner.mutation(api.characterSheet.addClassLevel, {
    characterId,
    classEntryId: wizard._id,
    operationId: 'master-wizard3',
  });
  const progressed = await member.query(api.canonicalLedger.read, scope);
  expect(
    progressed.state.militiaSnapshot.characters.find(
      (row) => row.characterId === companionId,
    )?.intelligence,
  ).toBe(7);
  await owner.mutation(api.characterSheet.createPersonalAdjustment, {
    characterId,
    name: 'No militia fact change',
    modifiers: [{ target: 'attack.melee', bonusType: 'untyped', value: 1 }],
    operationId: 'unrelated-attack',
  });
  expect((await member.query(api.canonicalLedger.read, scope)).revision).toBe(
    progressed.revision,
  );
  await owner.mutation(api.companionRelationships.setSourceEnabled, {
    relationshipId,
    sourceKey: 'wizard',
    enabled: false,
    operationId: 'canonical-disable',
  });
  expect(
    (
      await member.query(api.canonicalLedger.read, scope)
    ).state.militiaSnapshot.characters.find(
      (row) => row.characterId === companionId,
    )?.intelligence,
  ).toBe(2);
  await owner.mutation(api.companionRelationships.setSourceEnabled, {
    relationshipId,
    sourceKey: 'wizard',
    enabled: true,
    operationId: 'canonical-enable',
  });
  expect(
    (
      await member.query(api.canonicalLedger.read, scope)
    ).state.militiaSnapshot.characters.find(
      (row) => row.characterId === companionId,
    )?.intelligence,
  ).toBe(7);
});

test('a private master edit refreshes former-campaign familiar facts without granting campaign access', async () => {
  const {
    t,
    owner,
    member,
    campaignId,
    characterId,
    companionId,
    relationshipId,
  } = await fixture();
  const militiaId = await seedMilitia(t, campaignId);
  await member.mutation(selectBaseCreature, {
    characterId: companionId,
    relationshipId,
    baseCreatureKey: 'cat',
    operationId: 'departure-cat',
  });
  await t.run(async (ctx) => {
    await ctx.db.patch('character', characterId, {
      campaignId: undefined,
      sheetDemo: true,
    });
    const user = await ctx.db
      .query('user')
      .withIndex('by_tokenIdentifier', (q) => q.eq('tokenIdentifier', 'owner'))
      .unique();
    if (!user) throw new Error('Owner fixture missing');
    await ctx.db.patch('user', user._id, { orgIds: [] });
  });
  await owner.mutation(api.characterSheet.editBaseScores, {
    characterId,
    scores: { strength: 11 },
    operationId: 'private-master-edit',
  });
  const ledger = await member.query(api.canonicalLedger.read, {
    campaignId,
    militiaId,
  });
  expect(
    ledger.state.militiaSnapshot.characters.find(
      (row) => row.characterId === companionId,
    ),
  ).toMatchObject({ intelligence: 2, racialHitDice: 1 });
  expect(
    await member.query(api.companionRelationships.list, {
      characterId: companionId,
    }),
  ).toMatchObject([{ endpoint: null, sources: [] }]);
  await expect(
    owner.query(api.canonicalLedger.read, { campaignId, militiaId }),
  ).rejects.toThrow();
  await expect(
    member.query(api.characterSheet.read, { characterId }),
  ).rejects.toThrow();
});

test('retained links to a deleted familiar do not block master edits or surviving familiar fact refreshes', async () => {
  const {
    t,
    owner,
    member,
    campaignId,
    characterId,
    companionId,
    relationshipId,
    wizard,
    level,
  } = await fixture();
  const militiaId = await seedMilitia(t, campaignId);
  await member.mutation(selectBaseCreature, {
    characterId: companionId,
    relationshipId,
    baseCreatureKey: 'cat',
    operationId: 'old-deleted-cat',
  });
  const surviving = await member.mutation(api.companionRelationships.create, {
    associatedCharacterId: characterId,
    kind: 'familiar',
    name: 'Surviving raven',
    sources: [
      {
        key: 'surviving-bond',
        label: 'Arcane bond',
        enabled: true,
        sheetEntryId: level._id,
      },
    ],
    operationId: 'surviving-raven',
  });
  await member.mutation(selectBaseCreature, {
    characterId: surviving.companionCharacterId,
    relationshipId: surviving.relationshipId,
    baseCreatureKey: 'raven',
    operationId: 'surviving-raven-species',
  });
  await t.run((ctx) =>
    ctx.db.patch('character', companionId, {
      campaignId: undefined,
      sheetDemo: true,
    }),
  );
  await member.mutation(api.characterSheet.deletePrivate, {
    characterId: companionId,
    operationId: 'delete-old-cat',
  });
  await owner.mutation(api.characterSheet.addClassLevel, {
    characterId,
    classEntryId: wizard._id,
    operationId: 'progress-after-deletion',
  });
  const ledger = await member.query(api.canonicalLedger.read, {
    campaignId,
    militiaId,
  });
  expect(
    ledger.state.militiaSnapshot.characters.find(
      (row) => row.characterId === surviving.companionCharacterId,
    )?.intelligence,
  ).toBe(7);
  expect(
    await owner.query(api.companionRelationships.list, { characterId }),
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ relationshipId, endpoint: null }),
    ]),
  );
});

test('a former familiar retains its creature ranks as a master under another active companion kind', async () => {
  const { owner, member, campaignId, companionId, relationshipId } =
    await fixture();
  await member.mutation(selectBaseCreature, {
    characterId: companionId,
    relationshipId,
    baseCreatureKey: 'cat',
    operationId: 'retained-rank-cat',
  });
  await owner.mutation(api.companionRelationships.interrupt, {
    relationshipId,
    operationId: 'interrupt-rank-cat',
  });
  const cohortMasterId = await owner.mutation(api.characterSheet.create, {
    campaignId,
    organizationId: 'org',
    name: 'Cohort master',
    kind: 'pc',
    operationId: 'cohort-master',
  });
  await owner.mutation(api.companionRelationships.link, {
    associatedCharacterId: cohortMasterId,
    companionCharacterId: companionId,
    kind: 'cohort',
    sources: [{ key: 'leadership', label: 'Leadership', enabled: true }],
    operationId: 'cat-cohort',
  });
  const nested = await member.mutation(api.companionRelationships.create, {
    associatedCharacterId: companionId,
    kind: 'familiar',
    name: 'Retained-rank toad',
    sources: [{ key: 'retained-bond', label: 'Retained bond', enabled: true }],
    operationId: 'retained-rank-toad',
  });
  await member.mutation(selectBaseCreature, {
    characterId: nested.companionCharacterId,
    relationshipId: nested.relationshipId,
    baseCreatureKey: 'toad',
    operationId: 'retained-toad-species',
  });
  expect(
    withSheetCatalog(
      await member.query(api.characterSheet.read, { characterId: companionId }),
    )?.calculated.familiar,
  ).toBeNull();
  expect(
    await member.query(api.characterSheetLinkedInputs.read, {
      characterId: nested.companionCharacterId,
      relationshipId: nested.relationshipId,
      input: { kind: 'skillRanks', skill: 'skill.per' },
    }),
  ).toMatchObject({ value: 1 });
});

test('species selection preserves an existing Character’s recorded scores and later edits', async () => {
  const { member, companionId, relationshipId } = await fixture();
  await member.mutation(api.characterSheet.editBaseScores, {
    characterId: companionId,
    scores: { strength: 17, dexterity: 13 },
    operationId: 'record-scores',
  });
  for (const baseCreatureKey of ['cat', 'raven'] as const) {
    await member.mutation(selectBaseCreature, {
      characterId: companionId,
      relationshipId,
      baseCreatureKey,
      operationId: `species-${baseCreatureKey}`,
    });
    const sheet = withSheetCatalog(
      await member.query(api.characterSheet.read, {
        characterId: companionId,
      }),
    );
    expect(sheet?.calculated.abilities.strength.score).toBe(17);
    expect(sheet?.calculated.abilities.dexterity.score).toBe(13);
  }
});

test('public familiar reads refuse unauthenticated viewers', async () => {
  const { t, companionId, relationshipId } = await fixture();
  await expect(
    t.query(api.characterSheet.read, { characterId: companionId }),
  ).rejects.toThrow();
  await expect(
    t.query(api.characterSheetLinkedInputs.list, {
      characterId: companionId,
      relationshipId,
    }),
  ).rejects.toThrow();
});

test('Character lists reuse published familiar facts without reading the master sheet', async () => {
  const { t, member, campaignId, characterId, companionId, relationshipId } =
    await fixture();
  await member.mutation(selectBaseCreature, {
    characterId: companionId,
    relationshipId,
    baseCreatureKey: 'cat',
    operationId: 'list-cat',
  });
  await t.run(async (ctx) => {
    const masterBase = await ctx.db
      .query('characterSheetEntry')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
      .first();
    if (masterBase?.kind !== 'base') throw new Error('Master base missing');
    await ctx.db.delete('catalogEntry', masterBase.catalogEntryId);
    await ctx.db.patch('character', characterId, { isActive: false });
  });
  const listed = await member.query(api.character.listByCampaign, {
    campaignId,
    organizationId: 'org',
  });
  expect(listed.find((row) => row._id === companionId)).toMatchObject({
    intelligence: 6,
    racialHitDice: 1,
  });
});

test('new familiar species seeds once and preserves scores edited before the first choice', async () => {
  const { member, characterId } = await fixture();
  for (const edited of [false, true]) {
    const created = await member.mutation(api.companionRelationships.create, {
      associatedCharacterId: characterId,
      kind: 'familiar',
      name: 'New creature',
      sources: [{ key: 'new-bond', label: 'New bond', enabled: true }],
      operationId: `create-${edited}`,
    });
    if (edited)
      await member.mutation(api.characterSheet.editBaseScores, {
        characterId: created.companionCharacterId,
        scores: { strength: 10 },
        operationId: 'keep-default-score',
      });
    await member.mutation(selectBaseCreature, {
      characterId: created.companionCharacterId,
      relationshipId: created.relationshipId,
      baseCreatureKey: 'cat',
      operationId: `seed-${edited}`,
    });
    const initial = withSheetCatalog(
      await member.query(api.characterSheet.read, {
        characterId: created.companionCharacterId,
      }),
    );
    expect(initial?.calculated.abilities.strength.score).toBe(edited ? 10 : 3);
    await member.mutation(selectBaseCreature, {
      characterId: created.companionCharacterId,
      relationshipId: created.relationshipId,
      baseCreatureKey: 'raven',
      operationId: `retain-${edited}`,
    });
    const changed = withSheetCatalog(
      await member.query(api.characterSheet.read, {
        characterId: created.companionCharacterId,
      }),
    );
    expect(changed?.calculated.abilities.strength.score).toBe(edited ? 10 : 3);
  }
});

test('a familiar owner without master access publishes the same permanent facts as trusted computation', async () => {
  const {
    t,
    owner,
    member,
    campaignId,
    characterId,
    companionId,
    relationshipId,
  } = await fixture();
  const militiaId = await seedMilitia(t, campaignId);
  await member.mutation(selectBaseCreature, {
    characterId: companionId,
    relationshipId,
    baseCreatureKey: 'cat',
    operationId: 'trusted-cat',
  });
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
    operationId: 'owner-without-master',
  });
  const trusted = await t.run(async (ctx) => {
    const character = await ctx.db.get('character', companionId);
    if (!character) throw new Error('Missing familiar');
    return calculateMilitiaCharacterFacts(ctx, character, undefined, {
      trustedLinkedInputs: true,
    });
  });
  const ledger = await member.query(api.canonicalLedger.read, {
    campaignId,
    militiaId,
  });
  expect(
    ledger.state.militiaSnapshot.characters.find(
      (row) => row.characterId === companionId,
    ),
  ).toEqual(trusted);
  expect(trusted).toMatchObject({
    strength: 17,
    intelligence: 2,
    racialHitDice: 1,
  });
  await owner.mutation(api.characterSheet.editBaseScores, {
    characterId,
    scores: { strength: 12 },
    operationId: 'trusted-refresh',
  });
  const refreshed = await member.query(api.canonicalLedger.read, {
    campaignId,
    militiaId,
  });
  expect(
    refreshed.state.militiaSnapshot.characters.find(
      (row) => row.characterId === companionId,
    ),
  ).toEqual(trusted);
});

test('the sheet exposes the latest retained familiar relationship selected by the server', async () => {
  const { member, characterId, companionId, relationshipId } = await fixture();
  await member.mutation(api.companionRelationships.interrupt, {
    relationshipId,
    operationId: 'older-link',
  });
  const newer = await member.mutation(api.companionRelationships.link, {
    associatedCharacterId: characterId,
    companionCharacterId: companionId,
    kind: 'familiar',
    sources: [{ key: 'newer-bond', label: 'Newer bond', enabled: true }],
    operationId: 'newer-link',
  });
  await member.mutation(api.companionRelationships.interrupt, {
    relationshipId: newer,
    operationId: 'retained-newer',
  });
  const sheet = withSheetCatalog(
    await member.query(api.characterSheet.read, {
      characterId: companionId,
    }),
  );
  expect(sheet?.familiarRelationshipId).toBe(newer);
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

test('prepared familiar reads charge both endpoint sheets against one shared budget', async () => {
  const { t, member, characterId, companionId, relationshipId } =
    await fixture();
  await member.mutation(selectBaseCreature, {
    characterId: companionId,
    relationshipId,
    baseCreatureKey: 'cat',
    operationId: 'budget-cat',
  });
  expect(
    withSheetCatalog(
      await member.query(api.characterSheet.read, { characterId: companionId }),
    )?.calculated.hp,
  ).toBe(5);
  await t.run(async (ctx) => {
    const master = await ctx.db.get('character', characterId);
    const familiar = await ctx.db.get('character', companionId);
    if (!master || !familiar) throw new Error('Missing budget endpoints');
    // Either endpoint's sheet fits alone; charging both to one budget cannot.
    const sharedBytes =
      (await sheetReadBytes(ctx, master)) +
      (await sheetReadBytes(ctx, familiar));
    const options = {
      trustedLinkedInputs: true,
      resourceLimits: {
        maximumTotalBytesRead: sharedBytes - 1,
        maximumReferences: 1024,
      },
    };
    await readCharacterSheetData(ctx, master, options);
    await readCharacterSheetData(ctx, familiar, options);
    await expect(
      loadPreparedCharacterSheet(ctx, familiar, undefined, options),
    ).rejects.toThrow('read resource limit');
  });
});
