// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { afterEach, expect, test, vi } from 'vitest';
import { api, internal } from './_generated/api';
import { representativeSpellEffectSpellCatalog } from './lib/representativeSpellEffectCatalog';
import schema from './schema';
import { seedAcceptedCampaign } from './lib/acceptedCampaignFixture';
import { initializeCharacterSheet } from './lib/characterSheet';
import { initializationEdits } from '../tests/rules/initialization-edits';
import { loadPreparedCharacterSheet } from './lib/preparedCharacterSheet';
import {
  readCharacterSheetData,
  maxCharacterChildRows,
} from './lib/characterSheetData';
import { deleteSpellCatalogIndex } from './lib/spellCatalog';
afterEach(() => vi.useRealTimers());
const modules = import.meta.glob('./**/*.ts');

async function fixture() {
  const t = convexTest(schema, modules);
  const campaignId = await t.run(async (ctx) => {
    for (const [person, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const) {
      await ctx.db.insert('user', {
        tokenIdentifier: `test|${person}`,
        orgIds: [{ orgId, role: 'member' }],
      });
    }
    return ctx.db.insert('campaign', {
      name: 'Sheet fixture',
      description: '',
      organizationId: 'org',
      ownerId: 'test|owner',
      e2eFixture: {
        namespace: 'sheet',
        version: 1,
        workerKey: '0',
        caseKey: 'sheet',
        campaignKey: 'sheet',
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
  const scope = { organizationId: 'org', characterId };
  return { t, owner, member, outsider, campaignId, characterId, scope };
}

async function boundedReadFixture() {
  const result = await fixture();
  await result.t.run(async (ctx) => {
    const definitions = await ctx.db
      .query('catalogEntry')
      .withIndex('by_characterId', (q) =>
        q.eq('characterId', result.characterId),
      )
      .take(maxCharacterChildRows + 1);
    if (definitions.length > maxCharacterChildRows)
      throw new Error('Fixture exceeds its catalog row limit');
    for (const definition of definitions) {
      if (definition.detail.kind === 'base') continue;
      if (definition.importedSpell)
        await deleteSpellCatalogIndex(ctx, definition._id);
      await ctx.db.delete('catalogEntry', definition._id);
    }
  });
  return result;
}

test('bounded sheet reads share one byte budget across entries and catalog definitions', async () => {
  const { t, characterId } = await boundedReadFixture();
  await t.run(async (ctx) => {
    const definition = await ctx.db
      .query('catalogEntry')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
      .first();
    if (!definition) throw new Error('Missing base scores');
    await ctx.db.patch('catalogEntry', definition._id, {
      name: 'x'.repeat(400 * 1024),
    });
    const entries = await ctx.db
      .query('characterSheetEntry')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
      .take(2);
    const level = entries.find((entry) => entry.kind === 'classLevel');
    if (level?.kind !== 'classLevel') throw new Error('Missing Class Level');
    await ctx.db.patch('characterSheetEntry', level._id, {
      state: { ...level.state, proficiencyChoice: 'x'.repeat(400 * 1024) },
    });
  });
  await expect(
    t.run(async (ctx) => {
      const character = await ctx.db.get('character', characterId);
      if (!character) throw new Error('Missing Character');
      return readCharacterSheetData(ctx, character, {
        resourceLimits: {
          maximumTotalBytesRead: 768 * 1024,
          maximumReferences: 1024,
        },
      });
    }),
  ).rejects.toThrow('read resource limit');
  expect(
    await t.run(async (ctx) => {
      const character = await ctx.db.get('character', characterId);
      if (!character) throw new Error('Missing Character');
      const sheet = await readCharacterSheetData(ctx, character, {
        resourceLimits: {
          maximumTotalBytesRead: 900 * 1024,
          maximumReferences: 1024,
        },
      });
      return sheet.entries.length;
    }),
  ).toBe(2);
});

test('bounded sheet reads include accepted warnings unless separately excluded', async () => {
  const { t, characterId } = await boundedReadFixture();
  await t.run(async (ctx) => {
    const definition = await ctx.db
      .query('catalogEntry')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
      .first();
    if (!definition) throw new Error('Missing base scores');
    await ctx.db.patch('catalogEntry', definition._id, {
      name: 'x'.repeat(400 * 1024),
    });
    await ctx.db.insert('acceptedWarning', {
      characterId,
      check: 'retained-check',
      subject: 'sheet',
      fingerprint: 'x'.repeat(400 * 1024),
      acceptedBy: 'test|owner',
      acceptedAt: 1,
    });
  });
  async function read(
    maximumTotalBytesRead: number,
    includeAcceptedWarnings = true,
  ) {
    return t.run(async (ctx) => {
      const character = await ctx.db.get('character', characterId);
      if (!character) throw new Error('Missing Character');
      const sheet = await readCharacterSheetData(ctx, character, {
        resourceLimits: { maximumTotalBytesRead, maximumReferences: 1024 },
        includeAcceptedWarnings,
      });
      return sheet.acceptedWarnings.length;
    });
  }
  await expect(read(768 * 1024)).rejects.toThrow('read resource limit');
  expect(await read(900 * 1024)).toBe(1);
  expect(await read(768 * 1024, false)).toBe(0);
});

test('bounded sheet reads count dependency documents in the same budget before scope validation', async () => {
  const { t, owner, campaignId, characterId } = await boundedReadFixture();
  const otherCharacterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Other',
    kind: 'pc',
    operationId: 'other',
  });
  await t.run(async (ctx) => {
    const definition = await ctx.db
      .query('catalogEntry')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
      .first();
    if (!definition) throw new Error('Missing base scores');
    await ctx.db.patch('catalogEntry', definition._id, {
      name: 'x'.repeat(400 * 1024),
    });
    const foreign = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId: otherCharacterId,
      name: 'x'.repeat(400 * 1024),
      ruleIdentity: 'foreign-class',
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: { kind: 'manual' },
    });
    const entries = await ctx.db
      .query('characterSheetEntry')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
      .take(2);
    const level = entries.find((entry) => entry.kind === 'classLevel');
    if (level?.kind !== 'classLevel') throw new Error('Missing Class Level');
    await ctx.db.patch('characterSheetEntry', level._id, {
      state: { ...level.state, classEntryId: foreign },
    });
  });
  async function read(maximumTotalBytesRead: number) {
    return t.run(async (ctx) => {
      const character = await ctx.db.get('character', characterId);
      if (!character) throw new Error('Missing Character');
      await readCharacterSheetData(ctx, character, {
        resourceLimits: { maximumTotalBytesRead, maximumReferences: 1024 },
      });
    });
  }
  await expect(read(768 * 1024)).rejects.toThrow('read resource limit');
  await expect(read(900 * 1024)).rejects.toThrow('Class does not belong');
});

test('bounded dependency reads count preferred campaign copies and exclude unrelated shared and browse-only rows', async () => {
  const { t, characterId, campaignId } = await boundedReadFixture();
  const { globalId, preferredId } = await t.run(async (ctx) => {
    const base = await ctx.db
      .query('catalogEntry')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
      .first();
    if (!base) throw new Error('Missing base scores');
    await ctx.db.patch('catalogEntry', base._id, {
      name: 'x'.repeat(400 * 1024),
    });
    const definition = {
      name: 'Dependency',
      ruleIdentity: 'bounded-shared',
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: { kind: 'manual' as const },
    };
    const globalId = await ctx.db.insert('catalogEntry', {
      ...definition,
      scope: 'global',
    });
    const preferredId = await ctx.db.insert('catalogEntry', {
      ...definition,
      scope: 'campaign',
      campaignId,
      copiedFrom: globalId,
      campaignPreference: true,
      name: 'x'.repeat(400 * 1024),
    });
    await ctx.db.insert('catalogEntry', {
      ...definition,
      scope: 'character',
      characterId,
      ruleIdentity: 'future-grant',
      grantsSlots: [{ kind: 'feat', count: 1, feats: [globalId] }],
    });
    await ctx.db.insert('catalogEntry', {
      ...definition,
      scope: 'global',
      ruleIdentity: 'unrelated-global',
      name: 'x'.repeat(900 * 1024),
    });
    await ctx.db.insert('catalogEntry', {
      ...definition,
      scope: 'character',
      characterId,
      browseOnly: true,
      ruleIdentity: 'unused-browse',
      name: 'x'.repeat(900 * 1024),
    });
    return { globalId, preferredId };
  });
  async function read(maximumTotalBytesRead: number, maximumReferences = 2) {
    return t.run(async (ctx) => {
      const character = await ctx.db.get('character', characterId);
      if (!character) throw new Error('Missing Character');
      const sheet = await readCharacterSheetData(ctx, character, [], {
        resourceLimits: { maximumTotalBytesRead, maximumReferences },
      });
      return sheet.catalogEntries;
    });
  }
  await expect(read(768 * 1024)).rejects.toThrow('read resource limit');
  await expect(read(900 * 1024, 1)).rejects.toThrow('reference resource limit');
  const loaded = await read(900 * 1024);
  expect(loaded.map(({ _id }) => _id)).toEqual(
    expect.arrayContaining([globalId, preferredId]),
  );
  expect(loaded.length).toBeGreaterThan(2);
  expect(
    loaded.some(
      (row) => row.ruleIdentity === 'unrelated-global' || row.browseOnly,
    ),
  ).toBe(false);
});

test('a prepared sheet reads only the seeds it refers to while its pickers offer every seed', async () => {
  const { t, owner, scope, characterId } = await fixture();
  const { stored, spellIds } = await t.run(async (ctx) => {
    const rows = await ctx.db
      .query('catalogEntry')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
      .take(maxCharacterChildRows);
    return {
      stored: rows,
      spellIds: rows.filter((row) => row.importedSpell).map((row) => row._id),
    };
  });
  const seeds = stored.filter((row) => row.detail.kind !== 'base');
  expect(seeds.length).toBeGreaterThan(250);
  expect(seeds.every((row) => row.browseOnly)).toBe(true);
  async function readStored() {
    return t.run(async (ctx) => {
      const character = await ctx.db.get('character', characterId);
      if (!character) throw new Error('Missing Character');
      return readCharacterSheetData(ctx, character, {
        resourceLimits: {
          maximumTotalBytesRead: 8 * 1024 * 1024,
          maximumReferences: 64,
        },
      });
    });
  }
  expect(
    (await readStored()).catalogEntries.map((row) => row.detail.kind),
  ).toEqual(['base']);
  // Pickers offer the same seeds a sheet carried before they were browse-only,
  // except Spells named only by a Spell Effect's rule identity: the Spell
  // browser offers Spells, and the read loads them once an effect needs one.
  const effectSpells = new Set(
    representativeSpellEffectSpellCatalog.map(
      (definition) => definition.ruleIdentity,
    ),
  );
  const offered = (
    await owner.query(api.characterSheet.read, scope)
  )?.catalogView?.definitions
    .filter((row) => row.scope === 'character')
    .map((row) => row._id)
    .sort();
  const expected = seeds
    .filter(
      (row) =>
        !spellIds.includes(row._id) && !effectSpells.has(row.ruleIdentity),
    )
    .map((row) => row._id)
    .sort();
  expect(offered).toEqual(expected);
  expect(
    (await owner.query(api.catalogCopies.list, scope))
      .filter((row) => row.scope === 'character' && !row.importedSpell)
      .map((row) => row._id)
      .sort(),
  ).toEqual(expected);
  const fighter = seeds.find((row) => row.ruleIdentity === 'fighter');
  const dodge = seeds.find((row) => row.ruleIdentity === 'dodge');
  if (!fighter || !dodge) throw new Error('Missing seeds');
  await owner.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    classEntryId: fighter._id,
    operationId: 'fighter',
  });
  await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: dodge._id,
    operationId: 'dodge',
  });
  const loaded = (await readStored()).catalogEntries;
  expect(loaded.map((row) => row.ruleIdentity)).toEqual(
    expect.arrayContaining(['fighter', 'dodge', 'fighter-bonus-feat-1']),
  );
  expect(
    loaded
      .filter((row) => row.detail.kind === 'class')
      .map((row) => row.ruleIdentity),
  ).toEqual(['fighter']);
  expect(loaded.length).toBeLessThan(64);
  // Loading referenced seeds never makes them part of the sheet's own rows.
  expect(
    await t.run(async (ctx) =>
      ctx.db
        .query('catalogEntry')
        .withIndex('by_characterId_and_browseOnly', (q) =>
          q.eq('characterId', characterId).eq('browseOnly', undefined),
        )
        .take(8),
    ),
  ).toHaveLength(1);
});

test('a prerequisite naming a browse-only seed resolves it by rule identity', async () => {
  const { t, owner, scope, characterId } = await fixture();
  const featId = await t.run(async (ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: 'Needs Dodge',
      ruleIdentity: 'needs-dodge',
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: { kind: 'feat' },
      prerequisites: [{ kind: 'feat', feat: 'dodge' }],
    }),
  );
  await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: featId,
    operationId: 'needs-dodge',
  });
  const sheet = await owner.query(api.characterSheet.read, scope);
  expect(sheet?.catalogEntries.map((row) => row.ruleIdentity)).toContain(
    'dodge',
  );
  expect(
    sheet?.calculated.warnings.find((warning) =>
      warning.message.startsWith('Needs Dodge:'),
    )?.message,
  ).toBe('Needs Dodge: Dodge not met now.');
});

test('saving a browse-only seed to the campaign makes it ordinary campaign content', async () => {
  const { t, owner, scope, characterId, campaignId } = await fixture();
  const dodge = await t.run(async (ctx) =>
    (
      await ctx.db
        .query('catalogEntry')
        .withIndex('by_characterId_and_ruleIdentity', (q) =>
          q.eq('characterId', characterId).eq('ruleIdentity', 'dodge'),
        )
        .take(2)
    ).at(0),
  );
  if (!dodge) throw new Error('Missing Dodge');
  await owner.mutation(api.catalogCopies.saveToCatalog, {
    ...scope,
    catalogEntryId: dodge._id,
    operationId: 'save-dodge',
  });
  const saved = await t.run((ctx) => ctx.db.get('catalogEntry', dodge._id));
  expect(saved).toMatchObject({ scope: 'campaign', campaignId });
  expect(saved?.browseOnly).toBeUndefined();
  expect(saved?.characterId).toBeUndefined();
  expect(
    (await owner.query(api.catalogCopies.list, scope)).filter(
      (row) => row._id === dodge._id,
    ),
  ).toMatchObject([{ scope: 'campaign' }]);
});

test('a standard Racial Trait of a browse-only race is refused as a Selection', async () => {
  const { t, owner, scope, characterId } = await fixture();
  const { seeded, unlinked } = await t.run(async (ctx) => {
    const seeded = (
      await ctx.db
        .query('catalogEntry')
        .withIndex('by_characterId_and_ruleIdentity', (q) =>
          q.eq('characterId', characterId).eq('ruleIdentity', 'dwarf-greed'),
        )
        .take(2)
    ).at(0);
    // A trait that does not name the browse-only race listing it.
    const unlinked = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: 'Unlinked trait',
      ruleIdentity: 'unlinked-trait',
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: { kind: 'racialTrait', raceEntryIds: [], replaces: [] },
    });
    await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      browseOnly: true,
      name: 'Browse-only race',
      ruleIdentity: 'browse-only-race',
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: { kind: 'race', racialTraits: [unlinked] },
    });
    return { seeded, unlinked };
  });
  if (!seeded) throw new Error('Missing seeded trait');
  for (const catalogEntryId of [seeded._id, unlinked])
    await expect(
      owner.mutation(api.characterSheet.selectEntry, {
        ...scope,
        catalogEntryId,
        operationId: 'standard',
      }),
    ).rejects.toThrow('Standard Racial Traits are granted by their race');
});

test('bounded attack source reads share catalog budgets before rejecting a foreign weapon', async () => {
  const { t, owner, campaignId, characterId } = await boundedReadFixture();
  const otherCharacterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Other',
    kind: 'pc',
    operationId: 'other',
  });
  await t.run(async (ctx) => {
    const base = await ctx.db
      .query('catalogEntry')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
      .first();
    if (!base) throw new Error('Missing base scores');
    await ctx.db.patch('catalogEntry', base._id, {
      name: 'x'.repeat(400 * 1024),
    });
    const foreignId = await ctx.db.insert('characterSheetEntry', {
      characterId: otherCharacterId,
      kind: 'classLevel',
      active: true,
      state: {
        kind: 'classLevel',
        classEntryId: null,
        position: 2,
        hpGained: null,
        proficiencyChoice: 'x'.repeat(400 * 1024),
      },
    });
    await ctx.db.insert('characterSheetEntry', {
      characterId,
      kind: 'attackRoutine',
      active: true,
      state: {
        kind: 'attackRoutine',
        name: 'Foreign source',
        weaponEntryId: foreignId,
        hands: 'one',
        mode: 'melee',
      },
    });
  });
  async function read(maximumTotalBytesRead: number, maximumReferences = 1) {
    return t.run(async (ctx) => {
      const character = await ctx.db.get('character', characterId);
      if (!character) throw new Error('Missing Character');
      await readCharacterSheetData(ctx, character, {
        resourceLimits: { maximumTotalBytesRead, maximumReferences },
      });
    });
  }
  await expect(read(768 * 1024)).rejects.toThrow('read resource limit');
  await expect(read(900 * 1024, 0)).rejects.toThrow('reference resource limit');
  await expect(read(900 * 1024)).rejects.toThrow('Weapon does not belong');
});

test('bounded prepared loading preserves the live fixture eligibility rule', async () => {
  const { t, characterId, campaignId } = await boundedReadFixture();
  await t.run((ctx) =>
    ctx.db.patch('campaign', campaignId, { e2eFixture: undefined }),
  );
  expect(
    await t.run(async (ctx) => {
      const character = await ctx.db.get('character', characterId);
      if (!character) throw new Error('Missing Character');
      return loadPreparedCharacterSheet(ctx, character, undefined, {
        resourceLimits: {
          maximumTotalBytesRead: 1,
          maximumReferences: 1024,
        },
      });
    }),
  ).toBeNull();
});

test('bounded prepared loading counts a campaign it fetches in the sheet budget', async () => {
  const { t, characterId, campaignId } = await boundedReadFixture();
  await t.run(async (ctx) => {
    await ctx.db.patch('campaign', campaignId, {
      description: 'x'.repeat(400 * 1024),
    });
    const definition = await ctx.db
      .query('catalogEntry')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
      .first();
    if (!definition) throw new Error('Missing base scores');
    await ctx.db.patch('catalogEntry', definition._id, {
      name: 'x'.repeat(400 * 1024),
    });
  });
  async function read(maximumTotalBytesRead: number) {
    return t.run(async (ctx) => {
      const character = await ctx.db.get('character', characterId);
      if (!character) throw new Error('Missing Character');
      const sheet = await loadPreparedCharacterSheet(
        ctx,
        character,
        undefined,
        {
          resourceLimits: { maximumTotalBytesRead, maximumReferences: 1024 },
        },
      );
      return sheet?.entries.length;
    });
  }
  await expect(read(768 * 1024)).rejects.toThrow('read resource limit');
  expect(await read(900 * 1024)).toBe(2);
});

test('campaign members read a new Character with permanent base scores and one empty Unspecified Class Level', async () => {
  const { member, scope, characterId } = await fixture();
  const sheet = await member.query(api.characterSheet.read, scope);
  expect(sheet).toMatchObject({
    character: {
      _id: characterId,
      name: 'Vessa',
      ownerId: 'test|owner',
      sheetMode: 'full',
    },
    calculated: {
      level: 1,
      hitDice: 1,
      hp: null,
      abilities: { strength: { score: 10, modifier: 0 } },
    },
    revision: 1,
    lastOperationId: 'create',
    updatedBy: 'test|owner',
  });
  expect(sheet?.entries).toHaveLength(2);
  expect(sheet?.entries.find((row) => row.kind === 'base')).toMatchObject({
    active: true,
    state: {
      kind: 'base',
    },
  });
  expect(sheet?.entries.find((row) => row.kind === 'classLevel')).toMatchObject(
    {
      state: {
        kind: 'classLevel',
        classEntryId: null,
        position: 1,
        hpGained: null,
      },
    },
  );
});

test('sheet reads expose resolver rows only in the current calculation', async () => {
  const { member, scope } = await fixture();
  const sheet = await member.query(api.characterSheet.read, scope);
  expect(sheet?.calculated.resolvedEntries).toEqual([]);
  expect(sheet?.permanentCalculated).not.toHaveProperty('resolvedEntries');
  expect(sheet?.permanentCalculated.level).toBe(1);
});

test('saving unchanged base scores preserves the sheet revision and last editor', async () => {
  const { owner, member, scope } = await fixture();
  const before = await owner.query(api.characterSheet.read, scope);
  for (const scores of [{}, { strength: 10, constitution: 10 }]) {
    await member.mutation(api.characterSheet.editBaseScores, {
      ...scope,
      scores,
      operationId: 'unchanged',
    });
    expect(await owner.query(api.characterSheet.read, scope)).toEqual(before);
  }
});

test.each([null, 0, 8])(
  'saving unchanged Class Level HP (%s) preserves the sheet revision and last editor',
  async (hpGained) => {
    const { owner, member, scope } = await fixture();
    const initial = await owner.query(api.characterSheet.read, scope);
    const row = initial?.entries.find((entry) => entry.kind === 'classLevel');
    if (!row) throw new Error('Missing level');
    if (hpGained !== null)
      await owner.mutation(api.characterSheet.editClassLevel, {
        ...scope,
        entryId: row._id,
        hpGained,
        operationId: 'record-hp',
      });
    const before = await owner.query(api.characterSheet.read, scope);
    await member.mutation(api.characterSheet.editClassLevel, {
      ...scope,
      entryId: row._id,
      hpGained,
      operationId: 'unchanged',
    });
    expect(await owner.query(api.characterSheet.read, scope)).toEqual(before);
  },
);

test('sheet reads reject a malformed route Character identifier', async () => {
  const { owner } = await fixture();
  await expect(
    owner.query(api.characterSheet.read, {
      organizationId: 'org',
      characterId: 'not-a-character-id',
    }),
  ).rejects.toThrow('Character not found');
});

test('members edit independent scores and Class Levels, carry HP through moves, and may remove every level', async () => {
  const { owner, member, scope } = await fixture();
  const initial = await owner.query(api.characterSheet.read, scope);
  const first = initial?.entries.find((entry) => entry.kind === 'classLevel');
  expect(first).toBeDefined();
  if (!first) throw new Error('Missing first level');
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { constitution: 14 },
    operationId: 'con',
  });
  await member.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 19 },
    operationId: 'str',
  });
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: first._id,
    hpGained: 8,
    operationId: 'hp1',
  });
  const second = await member.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    operationId: 'add',
  });
  await member.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: second,
    hpGained: 5,
    operationId: 'hp2',
  });
  await owner.mutation(api.characterSheet.moveClassLevel, {
    ...scope,
    entryId: second,
    position: 1,
    operationId: 'move',
  });
  const moved = await member.query(api.characterSheet.read, scope);
  expect(
    moved?.entries
      .filter((entry) => entry.kind === 'classLevel')
      .map((entry) => [entry._id, entry.state.position, entry.state.hpGained]),
  ).toEqual([
    [second, 1, 5],
    [first._id, 2, 8],
  ]);
  expect(moved).toMatchObject({
    calculated: {
      level: 2,
      hp: 17,
      abilities: { strength: { score: 19 }, constitution: { score: 14 } },
    },
    revision: 7,
    lastOperationId: 'move',
  });
  for (const entryId of [second, first._id])
    await member.mutation(api.characterSheet.deleteClassLevel, {
      ...scope,
      entryId,
      operationId: `delete-${entryId}`,
    });
  const zero = await owner.query(api.characterSheet.read, scope);
  expect(zero?.entries).toHaveLength(1);
  expect(zero?.calculated).toMatchObject({ level: 0, hitDice: 0, hp: 0 });
  expect(zero?.entries[0]?._id).toBe(initial?.entries[0]?._id);
});

test('outsiders, signed-out callers and legacy substring identities cannot read or write sheets', async () => {
  const { t, owner, outsider, scope, campaignId } = await fixture();
  await t.run((ctx) =>
    ctx.db.insert('user', { tokenIdentifier: 'test|org-fallback', orgIds: [] }),
  );
  const fallback = t.withIdentity({ tokenIdentifier: 'test|org-fallback' });
  const before = await owner.query(api.characterSheet.read, scope);
  const row = before?.entries.find((entry) => entry.kind === 'classLevel');
  if (!row) throw new Error('Missing level');
  for (const caller of [t, outsider, fallback]) {
    await expect(
      caller.query(api.characterSheet.read, scope),
    ).rejects.toThrow();
    await expect(
      caller.mutation(api.characterSheet.create, {
        organizationId: 'org',
        campaignId,
        name: 'Denied',
        kind: 'pc',
        operationId: 'attack',
      }),
    ).rejects.toThrow();
    await expect(
      caller.mutation(api.characterSheet.editBaseScores, {
        ...scope,
        scores: { strength: 99 },
        operationId: 'attack',
      }),
    ).rejects.toThrow();
    await expect(
      caller.mutation(api.characterSheet.addClassLevel, {
        ...scope,
        operationId: 'attack',
      }),
    ).rejects.toThrow();
    await expect(
      caller.mutation(api.characterSheet.editClassLevel, {
        ...scope,
        entryId: row._id,
        hpGained: 99,
        operationId: 'attack',
      }),
    ).rejects.toThrow();
    await expect(
      caller.mutation(api.characterSheet.moveClassLevel, {
        ...scope,
        entryId: row._id,
        position: 1,
        operationId: 'attack',
      }),
    ).rejects.toThrow();
    await expect(
      caller.mutation(api.characterSheet.deleteClassLevel, {
        ...scope,
        entryId: row._id,
        operationId: 'attack',
      }),
    ).rejects.toThrow();
  }
  await expect(
    outsider.query(api.characterSheet.read, {
      ...scope,
      organizationId: 'other',
    }),
  ).rejects.toThrow('No campaign exists');
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(before);
});

test('Class Level commands reject a base entry and another Character’s row without changing either sheet', async () => {
  const { owner, member, scope, campaignId } = await fixture();
  const otherId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Other',
    kind: 'npc',
    operationId: 'other',
  });
  const otherScope = { ...scope, characterId: otherId };
  const before = await owner.query(api.characterSheet.read, scope);
  const other = await owner.query(api.characterSheet.read, otherScope);
  const base = before?.entries.find((entry) => entry.kind === 'base');
  const foreign = other?.entries.find((entry) => entry.kind === 'classLevel');
  if (!base || !foreign) throw new Error('Missing rows');
  for (const entryId of [base._id, foreign._id]) {
    await expect(
      member.mutation(api.characterSheet.editClassLevel, {
        ...scope,
        entryId,
        hpGained: 12,
        operationId: 'attack',
      }),
    ).rejects.toThrow('Class Level does not belong');
    await expect(
      member.mutation(api.characterSheet.moveClassLevel, {
        ...scope,
        entryId,
        position: 1,
        operationId: 'attack',
      }),
    ).rejects.toThrow('Class Level does not belong');
    await expect(
      member.mutation(api.characterSheet.deleteClassLevel, {
        ...scope,
        entryId,
        operationId: 'attack',
      }),
    ).rejects.toThrow('Class Level does not belong');
  }
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(before);
  expect(await owner.query(api.characterSheet.read, otherScope)).toEqual(other);
});

test('a forged Catalog Entry reference from another Character in an accessible campaign is rejected on reads and writes', async () => {
  const { t, owner, scope } = await fixture();
  const otherCampaignId = await owner.mutation(api.campaign.createCampaign, {
    organizationId: 'org',
    name: 'Other',
    description: '',
  });
  await t.run(async (ctx) => {
    const character = await ctx.db.get('character', scope.characterId);
    if (!character?.campaignId) throw new Error('Missing campaign Character');
    const first = await ctx.db.get('campaign', character.campaignId);
    await ctx.db.patch('campaign', otherCampaignId, {
      e2eFixture: first?.e2eFixture,
    });
  });
  const otherId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId: otherCampaignId,
    name: 'Other',
    kind: 'npc',
    operationId: 'other',
  });
  const before = await owner.query(api.characterSheet.read, scope);
  const otherScope = { ...scope, characterId: otherId };
  const other = await owner.query(api.characterSheet.read, otherScope);
  const base = before?.entries.find((entry) => entry.kind === 'base');
  const otherBase = other?.entries.find((entry) => entry.kind === 'base');
  if (!base || !otherBase) throw new Error('Missing base');
  await t.run((ctx) =>
    ctx.db.patch('characterSheetEntry', base._id, {
      catalogEntryId: otherBase.catalogEntryId,
    }),
  );
  await expect(owner.query(api.characterSheet.read, scope)).rejects.toThrow(
    'Base scores do not belong',
  );
  await expect(
    owner.mutation(api.characterSheet.editBaseScores, {
      ...scope,
      scores: { strength: 99 },
      operationId: 'attack',
    }),
  ).rejects.toThrow('Base scores do not belong');
  await expect(
    owner.mutation(api.characterSheet.addClassLevel, {
      ...scope,
      operationId: 'attack',
    }),
  ).rejects.toThrow('Base scores do not belong');
  expect(await owner.query(api.characterSheet.read, otherScope)).toEqual(other);
});

test('prepared writes stay gated on ordinary campaigns and respect the campaign maintenance pause', async () => {
  const { t, owner, scope, campaignId } = await fixture();
  const before = await owner.query(api.characterSheet.read, scope);
  const row = before?.entries.find((entry) => entry.kind === 'classLevel');
  if (!row) throw new Error('Missing row');
  const commands = [
    () =>
      owner.mutation(api.characterSheet.create, {
        organizationId: 'org',
        campaignId,
        name: 'Denied',
        kind: 'pc',
        operationId: 'blocked',
      }),
    () =>
      owner.mutation(api.characterSheet.editBaseScores, {
        ...scope,
        scores: { strength: 15 },
        operationId: 'blocked',
      }),
    () =>
      owner.mutation(api.characterSheet.addClassLevel, {
        ...scope,
        operationId: 'blocked',
      }),
    () =>
      owner.mutation(api.characterSheet.editClassLevel, {
        ...scope,
        entryId: row._id,
        hpGained: 8,
        operationId: 'blocked',
      }),
    () =>
      owner.mutation(api.characterSheet.moveClassLevel, {
        ...scope,
        entryId: row._id,
        position: 1,
        operationId: 'blocked',
      }),
    () =>
      owner.mutation(api.characterSheet.deleteClassLevel, {
        ...scope,
        entryId: row._id,
        operationId: 'blocked',
      }),
  ];
  await t.run((ctx) =>
    ctx.db.patch('campaign', campaignId, { e2eFixture: undefined }),
  );
  for (const command of commands)
    await expect(command()).rejects.toThrow(
      "Character sheets aren't available for this campaign yet.",
    );
  expect(await owner.query(api.characterSheet.read, scope)).toEqual({
    ...before,
    campaign: { ...before?.campaign, ownershipAvailable: false },
  });
  await t.run((ctx) =>
    ctx.db.insert('campaignCutover', {
      key: 'weekly-draft',
      status: 'paused',
      operationId: 'pause',
      oldRelease: 'old',
      newRelease: 'new',
      campaignIds: [],
      pausedAt: 0,
    }),
  );
  for (const command of commands)
    await expect(command()).rejects.toThrow('paused for maintenance');
  expect(await owner.query(api.characterSheet.read, scope)).toEqual({
    ...before,
    campaign: { ...before?.campaign, ownershipAvailable: false },
  });
});

test('HP can be cleared, out-of-rules whole scores persist, and malformed numbers or positions are rejected', async () => {
  const { owner, scope } = await fixture();
  const sheet = await owner.query(api.characterSheet.read, scope);
  const row = sheet?.entries.find((entry) => entry.kind === 'classLevel');
  if (!row) throw new Error('Missing row');
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: row._id,
    hpGained: 0,
    operationId: 'zero',
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.calculated.hp,
  ).toBe(0);
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: row._id,
    hpGained: null,
    operationId: 'clear',
  });
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: -4, wisdom: 99 },
    operationId: 'override',
  });
  const before = await owner.query(api.characterSheet.read, scope);
  expect(before?.calculated).toMatchObject({
    hp: null,
    abilities: { strength: { score: -4 }, wisdom: { score: 99 } },
  });
  for (const value of [NaN, Infinity, -Infinity]) {
    await expect(
      owner.mutation(api.characterSheet.editBaseScores, {
        ...scope,
        scores: { strength: value },
        operationId: 'invalid',
      }),
    ).rejects.toThrow('finite');
    await expect(
      owner.mutation(api.characterSheet.editClassLevel, {
        ...scope,
        entryId: row._id,
        hpGained: value,
        operationId: 'invalid',
      }),
    ).rejects.toThrow('finite');
  }
  for (const position of [0, 2, 0.5, NaN])
    await expect(
      owner.mutation(api.characterSheet.moveClassLevel, {
        ...scope,
        entryId: row._id,
        position,
        operationId: 'invalid',
      }),
    ).rejects.toThrow('valid Class Level position');
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(before);
});

test('an isolated prepared sheet refreshes current militia facts while frozen history stays unchanged', async () => {
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ tokenIdentifier: 'test|gm' });
  const member = t.withIdentity({ tokenIdentifier: 'test|player' });
  const seeded = await owner.run((ctx) => seedAcceptedCampaign(ctx));
  const scope = { organizationId: 'org', characterId: seeded.characterId };
  expect(await owner.query(api.characterSheet.read, scope)).toBeNull();
  const { campaignId, militiaId } = seeded.key;
  for (const [baseRevision, edit] of initializationEdits(
    'patrol',
    seeded.characterId,
  ).entries()) {
    await member.mutation(api.canonicalDraftPersistence.edit, {
      campaignId,
      militiaId,
      operation: {
        draftId: seeded.key.draftId,
        operationId: `edit-${baseRevision}`,
        baseRevision,
        edit,
      },
    });
  }
  const preview = await member.query(
    api.canonicalDraftPersistence.preview,
    seeded.key,
  );
  expect(preview.status).toBe('ready');
  await member.mutation(api.canonicalDraftPersistence.confirm, {
    ...seeded.key,
    operation: { operationId: 'confirm', reviewed: preview.reviewed },
  });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const historyArgs = { campaignId, week: 9 };
  const history = await member.query(api.canonicalHistory.read, historyArgs);
  expect(history).not.toBeNull();
  const ledger = await member.query(api.canonicalLedger.read, {
    campaignId,
    militiaId,
  });
  await t.run(async (ctx) => {
    await ctx.db.patch('campaign', campaignId, {
      e2eFixture: {
        namespace: 'sheet',
        version: 1,
        workerKey: '0',
        caseKey: 'legacy',
        campaignKey: 'legacy',
      },
    });
    await initializeCharacterSheet(ctx, {
      characterId: seeded.characterId,
      operationId: 'prepare',
      updatedBy: 'test|gm',
    });
  });
  await member.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 30, charisma: 35 },
    operationId: 'sheet-only',
  });
  const sheet = await owner.query(api.characterSheet.read, scope);
  const level = sheet?.entries.find((entry) => entry.kind === 'classLevel');
  if (!level) throw new Error('Missing level');
  await member.mutation(api.characterSheet.deleteClassLevel, {
    ...scope,
    entryId: level._id,
    operationId: 'zero',
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.calculated,
  ).toMatchObject({
    level: 0,
    abilities: { strength: { score: 30 }, charisma: { score: 35 } },
  });
  const after = await member.query(api.character.listByCampaign, {
    campaignId,
    organizationId: 'org',
  });
  expect(after).toMatchObject([
    { _id: seeded.characterId, level: 0, strength: 30, charisma: 35 },
  ]);
  const current = await member.query(api.canonicalLedger.read, {
    campaignId,
    militiaId,
  });
  expect(current.revision).toBe(ledger.revision + 3);
  expect(current.state.militiaSnapshot.characters).toMatchObject([
    { characterId: seeded.characterId, level: 0, strength: 30, charisma: 35 },
  ]);
  expect(current.state.militiaSnapshot.roster).toEqual(
    ledger.state.militiaSnapshot.roster,
  );
  expect(await owner.query(api.canonicalHistory.read, historyArgs)).toEqual(
    history,
  );
  const beforeArchive = await owner.query(api.characterSheet.read, scope);
  await member.mutation(api.characterSheet.archive, {
    ...scope,
    isActive: false,
    operationId: 'archive',
  });
  const archived = await owner.query(api.characterSheet.read, scope);
  expect(archived?.character.isActive).toBe(false);
  expect(archived?.calculated).toMatchObject({
    level: 0,
    abilities: { strength: { score: 30 }, charisma: { score: 35 } },
  });
  const archivedLedger = await member.query(api.canonicalLedger.read, {
    campaignId,
    militiaId,
  });
  expect(archivedLedger.state.militiaSnapshot.roster).toEqual(
    ledger.state.militiaSnapshot.roster,
  );
  expect(archived?.entries).toEqual(beforeArchive?.entries);
  expect(archived?.catalogEntries).toEqual(beforeArchive?.catalogEntries);
  expect(archivedLedger.state.militiaSnapshot.characters).toEqual(
    current.state.militiaSnapshot.characters.map((character) =>
      character.characterId === seeded.characterId
        ? { ...character, isActive: false }
        : character,
    ),
  );
  await owner.mutation(api.characterSheet.archive, {
    ...scope,
    isActive: true,
    operationId: 'restore',
  });
  const restored = await member.query(api.canonicalLedger.read, {
    campaignId,
    militiaId,
  });
  expect(restored.state.militiaSnapshot).toEqual(current.state.militiaSnapshot);

  expect(await owner.query(api.canonicalHistory.read, historyArgs)).toEqual(
    history,
  );
});

test('creation settings default on new sheets and members save configurable budgets and trait choices', async () => {
  const { owner, member, scope } = await fixture();
  const initial = await owner.query(api.characterSheet.read, scope);
  expect(
    initial?.entries.find((entry) => entry.kind === 'base')?.state,
  ).toMatchObject({
    abilityMethod: { kind: 'pointBuy', budget: 15 },
    traitCount: 2,
    campaignTraitRequired: false,
  });
  await member.mutation(api.characterSheet.editCreationSettings, {
    ...scope,
    operationId: 'settings',
    settings: {
      abilityMethod: { kind: 'pointBuy', budget: 22 },
      traitCount: 3,
      campaignTraitRequired: true,
    },
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.calculated
      .creationSettings,
  ).toEqual({
    abilityMethod: { kind: 'pointBuy', budget: 22 },
    traitCount: 3,
    campaignTraitRequired: true,
  });
  await owner.mutation(api.characterSheet.editCreationSettings, {
    ...scope,
    operationId: 'rolled',
    settings: { abilityMethod: { kind: 'rolled' } },
  });
  const saved = await member.query(api.characterSheet.read, scope);
  expect(saved?.calculated.creationSettings).toEqual({
    abilityMethod: { kind: 'rolled' },
    traitCount: 3,
    campaignTraitRequired: true,
  });
  expect(saved?.calculated.pointBuy).toBeNull();
  await owner.mutation(api.characterSheet.editCreationSettings, {
    ...scope,
    operationId: 'unchanged',
    settings: { abilityMethod: { kind: 'rolled' } },
  });
  expect(await owner.query(api.characterSheet.read, scope)).toEqual({
    ...saved,
    owner: saved?.owner ? { ...saved.owner, isMine: true } : null,
  });
});

test('members accept and reopen an intended rules warning without changing calculation or missing decisions', async () => {
  const { owner, member, scope } = await fixture();
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    operationId: 'over-budget',
    scores: { strength: 18 },
  });
  const before = await owner.query(api.characterSheet.read, scope);
  const warning = before?.calculated.warnings.find(
    (item) => item.check === 'pointBuy',
  );
  if (!warning) throw new Error('Missing point-buy warning');
  const key = {
    check: warning.check,
    subject: warning.subject,
    fingerprint: warning.fingerprint,
  };
  await member.mutation(api.characterSheet.acceptWarning, {
    ...scope,
    ...key,
    operationId: 'accept',
  });
  const accepted = await owner.query(api.characterSheet.read, scope);
  expect(accepted?.calculated).toEqual(before?.calculated);
  expect(accepted?.calculated.hp).toBeNull();
  expect(accepted?.acceptedWarnings).toEqual([
    expect.objectContaining({
      ...key,
      characterId: scope.characterId,
      acceptedBy: 'test|member',
      acceptedAt: expect.any(Number),
    }),
  ]);
  await owner.mutation(api.characterSheet.acceptWarning, {
    ...scope,
    ...key,
    operationId: 'duplicate',
  });
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(accepted);
  await owner.mutation(api.characterSheet.reopenWarning, {
    ...scope,
    operationId: 'reopen',
    check: key.check,
    subject: key.subject,
  });
  const reopened = await member.query(api.characterSheet.read, scope);
  expect(reopened?.acceptedWarnings).toEqual([]);
  expect(reopened?.calculated).toEqual(before?.calculated);
});

test('related facts reopen acceptance permanently while unrelated edits preserve it and stale accept commands fail', async () => {
  const { owner, member, scope } = await fixture();
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    operationId: 'scores',
    scores: { strength: 18, dexterity: 17 },
  });
  const first = await owner.query(api.characterSheet.read, scope);
  const warning = first?.calculated.warnings.find(
    (item) => item.check === 'pointBuy',
  );
  const level = first?.entries.find((item) => item.kind === 'classLevel');
  if (!warning || !level) throw new Error('Missing warning or level');
  const key = {
    check: warning.check,
    subject: warning.subject,
    fingerprint: warning.fingerprint,
  };
  await member.mutation(api.characterSheet.acceptWarning, {
    ...scope,
    ...key,
    operationId: 'accept',
  });
  const acceptance = (await owner.query(api.characterSheet.read, scope))
    ?.acceptedWarnings;
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    hpGained: 8,
    operationId: 'hp',
  });
  await owner.mutation(api.characterSheet.editCreationSettings, {
    ...scope,
    settings: { traitCount: 3 },
    operationId: 'traits',
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.acceptedWarnings,
  ).toEqual(acceptance);
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    operationId: 'same-cost',
    scores: { strength: 17, dexterity: 18 },
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.acceptedWarnings,
  ).toEqual([]);
  await expect(
    member.mutation(api.characterSheet.acceptWarning, {
      ...scope,
      ...key,
      operationId: 'stale',
    }),
  ).rejects.toThrow('current rules warning');
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    operationId: 'back',
    scores: { strength: 18, dexterity: 17 },
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.acceptedWarnings,
  ).toEqual([]);
  await member.mutation(api.characterSheet.acceptWarning, {
    ...scope,
    ...key,
    operationId: 'accept-again',
  });
  await owner.mutation(api.characterSheet.editCreationSettings, {
    ...scope,
    operationId: 'budget',
    settings: { abilityMethod: { kind: 'pointBuy', budget: 20 } },
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.acceptedWarnings,
  ).toEqual([]);
});

test('deleting a warning’s Class Level deletes its acceptance without touching another accepted warning', async () => {
  const { owner, scope } = await fixture();
  const first = await owner.query(api.characterSheet.read, scope);
  const level = first?.entries.find((item) => item.kind === 'classLevel');
  if (!level) throw new Error('Missing level');
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    hpGained: 0,
    operationId: 'hp',
  });
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 18 },
    operationId: 'scores',
  });
  const before = await owner.query(api.characterSheet.read, scope);
  for (const warning of before?.calculated.warnings.filter(
    (item) => item.kind === 'rules',
  ) ?? [])
    await owner.mutation(api.characterSheet.acceptWarning, {
      ...scope,
      operationId: warning.check,
      check: warning.check,
      subject: warning.subject,
      fingerprint: warning.fingerprint,
    });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.acceptedWarnings,
  ).toHaveLength(2);
  await owner.mutation(api.characterSheet.deleteClassLevel, {
    ...scope,
    entryId: level._id,
    operationId: 'delete',
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.acceptedWarnings,
  ).toEqual([expect.objectContaining({ check: 'pointBuy' })]);
});

test('acceptance refuses missing inputs, unresolved calculations, stale facts and another Character’s subjects', async () => {
  const { owner, scope, campaignId } = await fixture();
  const initial = await owner.query(api.characterSheet.read, scope);
  for (const warning of initial?.calculated.warnings ?? [])
    await expect(
      owner.mutation(api.characterSheet.acceptWarning, {
        ...scope,
        operationId: 'missing',
        check: warning.check,
        subject: warning.subject,
        fingerprint: warning.fingerprint,
      }),
    ).rejects.toThrow('current rules warning');
  const otherId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Other',
    kind: 'pc',
    operationId: 'other',
  });
  const otherScope = { ...scope, characterId: otherId };
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...otherScope,
    scores: { strength: 18 },
    operationId: 'other-scores',
  });
  const other = await owner.query(api.characterSheet.read, otherScope);
  const warning = other?.calculated.warnings.find(
    (item) => item.check === 'pointBuy',
  );
  if (!warning) throw new Error('Missing warning');
  await expect(
    owner.mutation(api.characterSheet.acceptWarning, {
      ...scope,
      operationId: 'foreign',
      check: warning.check,
      subject: warning.subject,
      fingerprint: warning.fingerprint,
    }),
  ).rejects.toThrow('current rules warning');
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(initial);
  expect(await owner.query(api.characterSheet.read, otherScope)).toEqual(other);
});

test('settings and warning commands require membership and honor fixture, maintenance and Write Gate controls', async () => {
  const { t, owner, outsider, scope, campaignId } = await fixture();
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 18 },
    operationId: 'scores',
  });
  const sheet = await owner.query(api.characterSheet.read, scope);
  const warning = sheet?.calculated.warnings.find(
    (item) => item.check === 'pointBuy',
  );
  if (!warning) throw new Error('Missing warning');
  const key = {
    check: warning.check,
    subject: warning.subject,
    fingerprint: warning.fingerprint,
  };
  function commands(caller: typeof owner) {
    return [
      () =>
        caller.mutation(api.characterSheet.editCreationSettings, {
          ...scope,
          operationId: 'settings',
          settings: { traitCount: 3 },
        }),
      () =>
        caller.mutation(api.characterSheet.acceptWarning, {
          ...scope,
          ...key,
          operationId: 'accept',
        }),
      () =>
        caller.mutation(api.characterSheet.reopenWarning, {
          ...scope,
          check: key.check,
          subject: key.subject,
          operationId: 'reopen',
        }),
    ];
  }
  for (const caller of [t, outsider])
    for (const command of commands(caller))
      await expect(command()).rejects.toThrow();
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(sheet);
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
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(sheet);
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationControl', controlId, { closed: false }),
  );
  for (const command of commands(owner))
    await expect(command()).rejects.toThrow('RELOAD_REQUIRED');
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(sheet);
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationControl', controlId, {
      epoch: 0,
      authority: 'sheet',
    }),
  );
  for (const command of commands(owner))
    await expect(command()).rejects.toThrow('RELOAD_REQUIRED');
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(sheet);
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationControl', controlId, { authority: 'legacy' }),
  );
  await t.run((ctx) =>
    ctx.db.patch('campaign', campaignId, { e2eFixture: undefined }),
  );
  for (const command of commands(owner))
    await expect(command()).rejects.toThrow(
      "Character sheets aren't available for this campaign yet.",
    );
  await t.run((ctx) =>
    ctx.db.insert('campaignCutover', {
      key: 'weekly-draft',
      status: 'paused',
      operationId: 'pause',
      oldRelease: 'old',
      newRelease: 'new',
      campaignIds: [],
      pausedAt: 0,
    }),
  );
  for (const command of commands(owner))
    await expect(command()).rejects.toThrow('paused for maintenance');
  expect(await owner.query(api.characterSheet.read, scope)).toEqual({
    ...sheet,
    campaign: { ...sheet?.campaign, ownershipAvailable: false },
  });
});

test('creation settings block non-finite values but preserve unusual whole-number choices, with rolled fallback for older sheets', async () => {
  const { t, owner, scope } = await fixture();
  for (const value of [NaN, Infinity, -Infinity]) {
    await expect(
      owner.mutation(api.characterSheet.editCreationSettings, {
        ...scope,
        operationId: 'invalid',
        settings: { abilityMethod: { kind: 'pointBuy', budget: value } },
      }),
    ).rejects.toThrow('finite');
    await expect(
      owner.mutation(api.characterSheet.editCreationSettings, {
        ...scope,
        operationId: 'invalid',
        settings: { traitCount: value },
      }),
    ).rejects.toThrow('finite');
  }
  await owner.mutation(api.characterSheet.editCreationSettings, {
    ...scope,
    operationId: 'unusual',
    settings: {
      abilityMethod: { kind: 'pointBuy', budget: 40 },
      traitCount: 0,
    },
  });
  const saved = await owner.query(api.characterSheet.read, scope);
  expect(saved?.calculated.creationSettings).toMatchObject({
    abilityMethod: { kind: 'pointBuy', budget: 40 },
    traitCount: 0,
  });
  await owner.mutation(api.characterSheet.editCreationSettings, {
    ...scope,
    operationId: 'same',
    settings: {
      abilityMethod: { kind: 'pointBuy', budget: 40 },
      traitCount: 0,
    },
  });
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(saved);
  const base = saved?.entries.find((entry) => entry.kind === 'base');
  if (!base) throw new Error('Missing base');
  await t.run((ctx) =>
    ctx.db.patch('characterSheetEntry', base._id, { state: { kind: 'base' } }),
  );
  expect(
    (await owner.query(api.characterSheet.read, scope))?.calculated
      .creationSettings,
  ).toEqual({
    abilityMethod: { kind: 'rolled' },
    traitCount: 2,
    campaignTraitRequired: false,
  });
});

test.each([-1, 2.5])(
  'creation settings reject negative or fractional counts and budgets (%s) without changing the sheet',
  async (value) => {
    const { owner, scope } = await fixture();
    const before = await owner.query(api.characterSheet.read, scope);
    for (const kind of ['pointBuy', 'rolled'] as const)
      await expect(
        owner.mutation(api.characterSheet.editCreationSettings, {
          ...scope,
          operationId: 'invalid-budget',
          settings: { abilityMethod: { kind, budget: value } },
        }),
      ).rejects.toThrow('Point-buy budget must be a whole number of 0 or more');
    await expect(
      owner.mutation(api.characterSheet.editCreationSettings, {
        ...scope,
        operationId: 'invalid-count',
        settings: { traitCount: value },
      }),
    ).rejects.toThrow('Trait count must be a whole number of 0 or more');
    expect(await owner.query(api.characterSheet.read, scope)).toEqual(before);
    await owner.mutation(api.characterSheet.editCreationSettings, {
      ...scope,
      operationId: 'zero',
      settings: {
        abilityMethod: { kind: 'pointBuy', budget: 0 },
        traitCount: 0,
      },
    });
    expect(
      (await owner.query(api.characterSheet.read, scope))?.calculated
        .creationSettings,
    ).toEqual({
      abilityMethod: { kind: 'pointBuy', budget: 0 },
      traitCount: 0,
      campaignTraitRequired: false,
    });
  },
);

test('changing a prepared Character’s kind reopens level-zero acceptance without resurrecting it on return', async () => {
  const { owner, scope } = await fixture();
  const initial = await owner.query(api.characterSheet.read, scope);
  const level = initial?.entries.find((item) => item.kind === 'classLevel');
  if (!level) throw new Error('Missing level');
  await owner.mutation(api.characterSheet.deleteClassLevel, {
    ...scope,
    entryId: level._id,
    operationId: 'zero',
  });
  const zero = await owner.query(api.characterSheet.read, scope);
  const warning = zero?.calculated.warnings.find(
    (item) => item.check === 'levelZero',
  );
  if (!warning) throw new Error('Missing warning');
  await owner.mutation(api.characterSheet.acceptWarning, {
    ...scope,
    check: warning.check,
    subject: warning.subject,
    fingerprint: warning.fingerprint,
    operationId: 'accept',
  });
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 18 },
    operationId: 'scores',
  });
  const overBudget = await owner.query(api.characterSheet.read, scope);
  const pointBuy = overBudget?.calculated.warnings.find(
    (item) => item.check === 'pointBuy',
  );
  if (!pointBuy) throw new Error('Missing point-buy warning');
  await owner.mutation(api.characterSheet.acceptWarning, {
    ...scope,
    operationId: 'point-buy',
    check: pointBuy.check,
    subject: pointBuy.subject,
    fingerprint: pointBuy.fingerprint,
  });
  const accepted = await owner.query(api.characterSheet.read, scope);
  const pointBuyAcceptance = accepted?.acceptedWarnings.filter(
    (item) => item.check === 'pointBuy',
  );
  await owner.mutation(api.character.updateCharacter, {
    ...scope,
    patch: { kind: 'pc' },
  });
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(accepted);
  await owner.mutation(api.character.updateCharacter, {
    ...scope,
    patch: { name: 'New name', description: 'Notes' },
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.acceptedWarnings,
  ).toEqual(accepted?.acceptedWarnings);
  await owner.mutation(api.character.updateCharacter, {
    ...scope,
    patch: { kind: 'npc' },
    operationId: 'caller-kind-operation',
  });
  const npc = await owner.query(api.characterSheet.read, scope);
  expect(npc?.lastOperationId).toBe('caller-kind-operation');
  expect(npc?.acceptedWarnings).toEqual(pointBuyAcceptance);
  expect(npc?.revision).toBe((accepted?.revision ?? 0) + 1);
  await owner.mutation(api.character.updateCharacter, {
    ...scope,
    patch: { kind: 'pc' },
  });
  const restored = await owner.query(api.characterSheet.read, scope);
  expect(restored?.acceptedWarnings).toEqual(pointBuyAcceptance);
  expect(restored?.calculated.warnings).toContainEqual(warning);
});

test('rolled settings retain a saved point-buy budget across queries and reject nonfinite retained budgets', async () => {
  const { owner, member, scope } = await fixture();
  await owner.mutation(api.characterSheet.editCreationSettings, {
    ...scope,
    operationId: 'rolled-with-budget',
    settings: { abilityMethod: { kind: 'rolled', budget: 27 } },
  });
  const rolled = await member.query(api.characterSheet.read, scope);
  expect(rolled?.calculated.creationSettings.abilityMethod).toEqual({
    kind: 'rolled',
    budget: 27,
  });
  expect(rolled?.calculated.pointBuy).toBeNull();
  await member.mutation(api.characterSheet.editCreationSettings, {
    ...scope,
    operationId: 'point-buy-again',
    settings: {
      abilityMethod: {
        kind: 'pointBuy',
        budget: rolled!.calculated.creationSettings.abilityMethod.budget!,
      },
    },
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.calculated
      .creationSettings.abilityMethod,
  ).toEqual({ kind: 'pointBuy', budget: 27 });
  for (const budget of [NaN, Infinity, -Infinity]) {
    await expect(
      owner.mutation(api.characterSheet.editCreationSettings, {
        ...scope,
        operationId: 'invalid-budget',
        settings: { abilityMethod: { kind: 'rolled', budget } },
      }),
    ).rejects.toThrow('finite');
  }
});

test('members add a personal adjustment as a Character-scoped Catalog Entry and see it on the shared sheet', async () => {
  const { owner, member, scope } = await fixture();
  const entryId = await member.mutation(
    api.characterSheet.createPersonalAdjustment,
    {
      ...scope,
      name: '  Training reward  ',
      modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 2 }],
      operationId: 'adjustment',
    },
  );
  const sheet = await owner.query(api.characterSheet.read, scope);
  const entry = sheet?.entries.find((row) => row._id === entryId);
  expect(entry).toMatchObject({
    kind: 'manual',
    active: true,
    state: { kind: 'manual' },
  });
  if (entry?.kind !== 'manual') throw new Error('Missing adjustment');
  expect(
    sheet?.catalogEntries.find((row) => row._id === entry.catalogEntryId),
  ).toMatchObject({
    characterId: scope.characterId,
    scope: 'character',
    name: 'Training reward',
    ruleIdentity: expect.any(String),
    stacksWithItself: false,
    detail: { kind: 'manual' },
    modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 2 }],
  });
  expect(sheet).toMatchObject({
    revision: 2,
    lastOperationId: 'adjustment',
    updatedBy: 'test|member',
    calculated: { abilities: { strength: { score: 12, modifier: 1 } } },
  });
  expect(sheet?.calculated.breakdowns['ability.str']?.applied).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        entryName: 'Base scores',
        builtIn: true,
        value: 10,
      }),
      expect.objectContaining({ entryName: 'Training reward', value: 2 }),
    ]),
  );
});

test('members edit and deactivate adjustments without changing their rule identity, then remove them', async () => {
  const { owner, member, scope } = await fixture();
  const entryId = await owner.mutation(
    api.characterSheet.createPersonalAdjustment,
    {
      ...scope,
      name: 'Reward',
      modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 2 }],
      operationId: 'add',
    },
  );
  const before = await owner.query(api.characterSheet.read, scope);
  const catalog = before?.catalogEntries.find(
    (entry) => entry.detail.kind === 'manual',
  );
  if (!catalog) throw new Error('Missing adjustment');
  await member.mutation(api.characterSheet.editPersonalAdjustment, {
    ...scope,
    entryId,
    name: 'Revised reward',
    modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 3 }],
    active: false,
    operationId: 'edit',
  });
  const edited = await owner.query(api.characterSheet.read, scope);
  expect(
    edited?.catalogEntries.find((entry) => entry._id === catalog._id),
  ).toMatchObject({
    name: 'Revised reward',
    ruleIdentity: catalog.ruleIdentity,
    modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 3 }],
  });
  expect(edited?.entries.find((entry) => entry._id === entryId)?.active).toBe(
    false,
  );
  expect(edited?.calculated.abilities.strength.score).toBe(10);
  expect(edited).toMatchObject({
    revision: 3,
    lastOperationId: 'edit',
    updatedBy: 'test|member',
  });
  await member.mutation(api.characterSheet.removePersonalAdjustment, {
    ...scope,
    entryId,
    operationId: 'remove',
  });
  const removed = await owner.query(api.characterSheet.read, scope);
  expect(removed?.entries).toHaveLength(2);
  expect(removed?.catalogEntries).toEqual(
    before?.catalogEntries.filter((entry) => entry._id !== catalog._id),
  );
  expect(removed).toMatchObject({ revision: 4, lastOperationId: 'remove' });
});

test('personal adjustment conditions cannot reference another Character’s Catalog Entry', async () => {
  const { owner, member, scope, campaignId } = await fixture();
  const otherId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Other',
    kind: 'npc',
    operationId: 'other',
  });
  const other = await owner.query(api.characterSheet.read, {
    ...scope,
    characterId: otherId,
  });
  if (!other) throw new Error('Missing other sheet');
  const before = await owner.query(api.characterSheet.read, scope);
  for (const condition of [
    { whileActive: other.baseScoresEntry._id },
    { situation: { option: other.baseScoresEntry._id } },
  ]) {
    await expect(
      member.mutation(api.characterSheet.createPersonalAdjustment, {
        ...scope,
        name: 'Borrowed',
        modifiers: [
          { target: 'ability.str', bonusType: 'untyped', value: 2, condition },
        ],
        operationId: 'forged',
      }),
    ).rejects.toThrow('Modifier reference does not belong to this Character');
  }
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(before);
});

test('unchanged personal adjustments preserve the last edit and durable source identity survives later edits', async () => {
  const { t, owner, member, scope } = await fixture();
  const fields = {
    name: 'Haste effect',
    modifiers: [
      { target: 'ability.dex' as const, bonusType: 'dodge' as const, value: 1 },
    ],
  };
  const entryId = await owner.mutation(
    api.characterSheet.createPersonalAdjustment,
    { ...scope, ...fields, operationId: 'add' },
  );
  const created = await owner.query(api.characterSheet.read, scope);
  const catalog = created?.catalogEntries.find(
    (entry) => entry.detail.kind === 'manual',
  );
  if (!catalog) throw new Error('Missing adjustment');
  // A curated copy already has the original rule's durable identity and shared Source.
  await t.run((ctx) =>
    ctx.db.patch('catalogEntry', catalog._id, {
      ruleIdentity: 'spell:haste',
      sourceKey: 'haste',
    }),
  );
  const before = await owner.query(api.characterSheet.read, scope);
  await member.mutation(api.characterSheet.editPersonalAdjustment, {
    ...scope,
    entryId,
    ...fields,
    active: true,
    operationId: 'no-change',
  });
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(before);
  await member.mutation(api.characterSheet.editPersonalAdjustment, {
    ...scope,
    entryId,
    ...fields,
    name: 'Edited haste effect',
    operationId: 'edit',
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.catalogEntries.find(
      (entry) => entry._id === catalog._id,
    ),
  ).toMatchObject({
    ruleIdentity: 'spell:haste',
    sourceKey: 'haste',
    name: 'Edited haste effect',
  });
});

test('personal adjustment writers reject signed-out callers, outsiders, and cross-Character rows', async () => {
  const { t, owner, member, outsider, scope, campaignId } = await fixture();
  const fields = {
    name: 'Reward',
    modifiers: [
      {
        target: 'ability.str' as const,
        bonusType: 'untyped' as const,
        value: 2,
      },
    ],
  };
  const entryId = await owner.mutation(
    api.characterSheet.createPersonalAdjustment,
    { ...scope, ...fields, operationId: 'add' },
  );
  const before = await owner.query(api.characterSheet.read, scope);
  for (const caller of [t, outsider]) {
    await expect(
      caller.mutation(api.characterSheet.createPersonalAdjustment, {
        ...scope,
        ...fields,
        operationId: 'denied',
      }),
    ).rejects.toThrow();
    await expect(
      caller.mutation(api.characterSheet.editPersonalAdjustment, {
        ...scope,
        entryId,
        ...fields,
        operationId: 'denied',
      }),
    ).rejects.toThrow();
    await expect(
      caller.mutation(api.characterSheet.removePersonalAdjustment, {
        ...scope,
        entryId,
        operationId: 'denied',
      }),
    ).rejects.toThrow();
  }
  const otherId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Other',
    kind: 'npc',
    operationId: 'other',
  });
  const otherScope = { ...scope, characterId: otherId };
  const other = await owner.query(api.characterSheet.read, otherScope);
  if (!other) throw new Error('Missing other sheet');
  const [otherEntry] = other.entries;
  if (!otherEntry) throw new Error('Missing other Character entry');
  for (const foreignId of [entryId, otherEntry._id]) {
    await expect(
      member.mutation(api.characterSheet.editPersonalAdjustment, {
        ...otherScope,
        entryId: foreignId,
        ...fields,
        operationId: 'denied',
      }),
    ).rejects.toThrow('Personal adjustment does not belong');
    await expect(
      member.mutation(api.characterSheet.removePersonalAdjustment, {
        ...otherScope,
        entryId: foreignId,
        operationId: 'denied',
      }),
    ).rejects.toThrow('Personal adjustment does not belong');
  }
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(before);
  expect(await owner.query(api.characterSheet.read, otherScope)).toEqual(other);
});

test('every personal adjustment writer obeys maintenance, reopening epochs, and the fixture gate', async () => {
  const { t, owner, scope, campaignId } = await fixture();
  const fields = {
    name: 'Reward',
    modifiers: [
      {
        target: 'ability.str' as const,
        bonusType: 'untyped' as const,
        value: 2,
      },
    ],
  };
  const entryId = await owner.mutation(
    api.characterSheet.createPersonalAdjustment,
    { ...scope, ...fields, operationId: 'add' },
  );
  const before = await owner.query(api.characterSheet.read, scope);
  const commands = (writeEpoch?: number) => [
    () =>
      owner.mutation(api.characterSheet.createPersonalAdjustment, {
        ...scope,
        ...fields,
        operationId: 'blocked',
        writeEpoch,
      }),
    () =>
      owner.mutation(api.characterSheet.editPersonalAdjustment, {
        ...scope,
        entryId,
        ...fields,
        name: 'Changed',
        operationId: 'blocked',
        writeEpoch,
      }),
    () =>
      owner.mutation(api.characterSheet.removePersonalAdjustment, {
        ...scope,
        entryId,
        operationId: 'blocked',
        writeEpoch,
      }),
  ];
  const run = await t.mutation(internal.initialMigration.start, {
    operationId: 'close',
    expectedEpoch: 0,
    frontendBuild: '263',
    catalogManifest: 'catalog',
    maintenanceBudgetMs: 60000,
  });
  for (const command of commands())
    await expect(command()).rejects.toThrow('MAINTENANCE');
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(before);
  await t.mutation(internal.initialMigration.abortBeforeActivation, run);
  for (const command of commands())
    await expect(command()).rejects.toThrow('RELOAD_REQUIRED');
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(before);
  await owner.mutation(api.characterSheet.editPersonalAdjustment, {
    ...scope,
    entryId,
    ...fields,
    name: 'After reload',
    operationId: 'reloaded',
    writeEpoch: 2,
  });
  const reopened = await owner.query(api.characterSheet.read, scope);
  expect(reopened?.lastOperationId).toBe('reloaded');
  await t.run((ctx) =>
    ctx.db.patch('campaign', campaignId, { e2eFixture: undefined }),
  );
  for (const command of commands(2))
    await expect(command()).rejects.toThrow(
      "Character sheets aren't available for this campaign yet.",
    );
  expect(await owner.query(api.characterSheet.read, scope)).toEqual({
    ...reopened,
    campaign: { ...reopened?.campaign, ownershipAvailable: false },
  });
});

test('personal adjustments reject malformed values, excessive Modifiers and curated exceptions without changing the sheet', async () => {
  const { owner, scope } = await fixture();
  const modifier = {
    target: 'ability.str' as const,
    bonusType: 'untyped' as const,
    value: 2,
  };
  const fields = { name: 'Reward', modifiers: [modifier] };
  const entryId = await owner.mutation(
    api.characterSheet.createPersonalAdjustment,
    { ...scope, ...fields, operationId: 'add' },
  );
  const before = await owner.query(api.characterSheet.read, scope);
  for (const invalid of [
    { ...fields, name: ' ' },
    ...[NaN, Infinity, -Infinity].map((value) => ({
      ...fields,
      modifiers: [{ ...modifier, value }],
    })),
    {
      ...fields,
      modifiers: Array.from({ length: 257 }, () => modifier),
    },
    {
      ...fields,
      modifiers: [{ ...modifier, stacksWithinEntry: true }],
    },
  ]) {
    await expect(
      owner.mutation(api.characterSheet.createPersonalAdjustment, {
        ...scope,
        ...invalid,
        operationId: 'invalid',
      }),
    ).rejects.toThrow();
    await expect(
      owner.mutation(api.characterSheet.editPersonalAdjustment, {
        ...scope,
        entryId,
        ...invalid,
        operationId: 'invalid',
      }),
    ).rejects.toThrow();
  }
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(before);
});

test.each([
  { weapon: '$self' as const },
  { weaponSelection: 'longsword' },
  { option: true as const },
])(
  'personal adjustment commands reject unsupported scope %j without changing the sheet',
  async (condition) => {
    const { owner, scope } = await fixture();
    const fields = {
      name: 'Reward',
      modifiers: [
        {
          target: 'save.will' as const,
          bonusType: 'untyped' as const,
          value: 2,
        },
      ],
    };
    const entryId = await owner.mutation(
      api.characterSheet.createPersonalAdjustment,
      {
        ...scope,
        ...fields,
        operationId: 'add',
      },
    );
    const before = await owner.query(api.characterSheet.read, scope);
    const invalid = {
      ...fields,
      modifiers: fields.modifiers.map((modifier) => ({
        ...modifier,
        condition,
      })),
    };
    await expect(
      owner.mutation(api.characterSheet.createPersonalAdjustment, {
        ...scope,
        ...invalid,
        operationId: 'invalid-add',
      }),
    ).rejects.toThrow('Modifier condition is invalid');
    await expect(
      owner.mutation(api.characterSheet.editPersonalAdjustment, {
        ...scope,
        entryId,
        ...invalid,
        operationId: 'invalid-edit',
      }),
    ).rejects.toThrow('Modifier condition is invalid');
    expect(await owner.query(api.characterSheet.read, scope)).toEqual(before);
  },
);

test('personal adjustment commands reject base bonuses without changing authoritative base scores', async () => {
  const { owner, member, scope } = await fixture();
  const entryId = await owner.mutation(
    api.characterSheet.createPersonalAdjustment,
    {
      ...scope,
      name: 'Reward',
      modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 2 }],
      operationId: 'reward',
    },
  );
  const before = await owner.query(api.characterSheet.read, scope);
  const fields = {
    name: 'Forged base',
    modifiers: [
      { target: 'ability.str' as const, bonusType: 'base' as const, value: 18 },
    ],
    operationId: 'forged-base',
  };
  await expect(
    member.mutation(api.characterSheet.createPersonalAdjustment, {
      ...scope,
      ...fields,
    }),
  ).rejects.toThrow('Base scores cannot be personal adjustments');
  await expect(
    member.mutation(api.characterSheet.editPersonalAdjustment, {
      ...scope,
      entryId,
      ...fields,
    }),
  ).rejects.toThrow('Base scores cannot be personal adjustments');
  expect(await owner.query(api.characterSheet.read, scope)).toEqual(before);
});

test('personal adjustment changes preserve accepted base-score warnings and their point-buy facts', async () => {
  const { owner, member, scope } = await fixture();
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 18 },
    operationId: 'base',
  });
  const initial = await owner.query(api.characterSheet.read, scope);
  const warning = initial?.calculated.warnings.find(
    (item) => item.check === 'pointBuy',
  );
  if (!warning) throw new Error('Missing point-buy warning');
  await owner.mutation(api.characterSheet.acceptWarning, {
    ...scope,
    check: warning.check,
    subject: warning.subject,
    fingerprint: warning.fingerprint,
    operationId: 'accept',
  });
  const accepted = await member.query(api.characterSheet.read, scope);
  async function expectWarningAndBaseScores(strength: number) {
    const sheet = await member.query(api.characterSheet.read, scope);
    expect(sheet?.acceptedWarnings).toEqual(accepted?.acceptedWarnings);
    expect(sheet?.calculated.pointBuy).toEqual({ spent: 17 });
    expect(sheet?.calculated.warnings).toContainEqual(warning);
    expect(sheet?.baseScoresEntry.modifiers).toContainEqual({
      target: 'ability.str',
      bonusType: 'base',
      value: 18,
    });
    expect(sheet?.calculated.abilities.strength.score).toBe(strength);
  }
  const entryId = await member.mutation(
    api.characterSheet.createPersonalAdjustment,
    {
      ...scope,
      name: 'Reward',
      modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 2 }],
      operationId: 'adjustment',
    },
  );
  await expectWarningAndBaseScores(20);
  await owner.mutation(api.characterSheet.editPersonalAdjustment, {
    ...scope,
    entryId,
    modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 4 }],
    operationId: 'edit',
  });
  await expectWarningAndBaseScores(22);
  await owner.mutation(api.characterSheet.editPersonalAdjustment, {
    ...scope,
    entryId,
    active: false,
    operationId: 'toggle',
  });
  await expectWarningAndBaseScores(18);
  await owner.mutation(api.characterSheet.removePersonalAdjustment, {
    ...scope,
    entryId,
    operationId: 'remove',
  });
  await expectWarningAndBaseScores(18);
});

test('Class Level additions, moves and deletions retain personal adjustments and their contributions', async () => {
  const { owner, member, scope } = await fixture();
  const initial = await owner.query(api.characterSheet.read, scope);
  const first = initial?.entries.find((row) => row.kind === 'classLevel');
  if (!first) throw new Error('Missing Class Level');
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: first._id,
    hpGained: 8,
    operationId: 'hp',
  });
  const adjustmentId = await owner.mutation(
    api.characterSheet.createPersonalAdjustment,
    {
      ...scope,
      name: 'Hardiness',
      modifiers: [{ target: 'ability.con', bonusType: 'untyped', value: 2 }],
      operationId: 'hardiness',
    },
  );
  async function expectAdjustment(hp: number | null) {
    const sheet = await member.query(api.characterSheet.read, scope);
    expect(
      sheet?.entries.find((row) => row._id === adjustmentId),
    ).toMatchObject({
      kind: 'manual',
      active: true,
    });
    expect(sheet?.calculated.abilities.constitution.score).toBe(12);
    expect(sheet?.calculated.hp).toBe(hp);
  }
  await expectAdjustment(9);
  const secondId = await member.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    operationId: 'add-level',
  });
  await expectAdjustment(null);
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: secondId,
    hpGained: 6,
    operationId: 'second-hp',
  });
  await expectAdjustment(16);
  await member.mutation(api.characterSheet.moveClassLevel, {
    ...scope,
    entryId: secondId,
    position: 1,
    operationId: 'move',
  });
  await expectAdjustment(16);
  await member.mutation(api.characterSheet.deleteClassLevel, {
    ...scope,
    entryId: first._id,
    operationId: 'delete',
  });
  await expectAdjustment(7);
});

test('private personal adjustments remain owner-only across create, edit, toggle and removal', async () => {
  const { t, owner, member, outsider } = await fixture();
  await t.run(async (ctx) => {
    const user = await ctx.db
      .query('user')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', 'test|owner'),
      )
      .unique();
    if (!user) throw new Error('Missing owner');
    await ctx.db.patch('user', user._id, { characterSheetDemo: true });
  });
  const characterId = await owner.mutation(api.characterSheet.create, {
    name: 'Private Vessa',
    kind: 'pc',
    operationId: 'private',
  });
  const entryId = await owner.mutation(
    api.characterSheet.createPersonalAdjustment,
    {
      characterId,
      name: 'Reward',
      modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 2 }],
      operationId: 'reward',
    },
  );
  const before = await owner.query(api.characterSheet.read, { characterId });
  for (const caller of [t, member, outsider]) {
    await expect(
      caller.mutation(api.characterSheet.createPersonalAdjustment, {
        characterId,
        name: 'Intrusion',
        modifiers: [],
        operationId: 'intrusion',
      }),
    ).rejects.toThrow();
    await expect(
      caller.mutation(api.characterSheet.editPersonalAdjustment, {
        characterId,
        entryId,
        active: false,
        operationId: 'intrusion',
      }),
    ).rejects.toThrow();
    await expect(
      caller.mutation(api.characterSheet.removePersonalAdjustment, {
        characterId,
        entryId,
        operationId: 'intrusion',
      }),
    ).rejects.toThrow();
  }
  expect(await owner.query(api.characterSheet.read, { characterId })).toEqual(
    before,
  );
  await owner.mutation(api.characterSheet.editPersonalAdjustment, {
    characterId,
    entryId,
    name: 'Private reward',
    modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 4 }],
    operationId: 'edit',
  });
  expect(
    (await owner.query(api.characterSheet.read, { characterId }))?.calculated
      .abilities.strength.score,
  ).toBe(14);
  await owner.mutation(api.characterSheet.editPersonalAdjustment, {
    characterId,
    entryId,
    active: false,
    operationId: 'toggle',
  });
  expect(
    (await owner.query(api.characterSheet.read, { characterId }))?.calculated
      .abilities.strength.score,
  ).toBe(10);
  await owner.mutation(api.characterSheet.removePersonalAdjustment, {
    characterId,
    entryId,
    operationId: 'remove',
  });
  expect(
    (await owner.query(api.characterSheet.read, { characterId }))?.entries.some(
      (row) => row.kind === 'manual',
    ),
  ).toBe(false);
});

test.each(['create', 'edit', 'toggle', 'remove'] as const)(
  '%s personal adjustment prunes stale acceptance while preserving unrelated accepted warnings',
  async (command) => {
    const { t, owner, member, scope } = await fixture();
    const initial = await owner.query(api.characterSheet.read, scope);
    const level = initial?.entries.find((row) => row.kind === 'classLevel');
    if (!level) throw new Error('Missing level');
    await owner.mutation(api.characterSheet.editClassLevel, {
      ...scope,
      entryId: level._id,
      hpGained: 0,
      operationId: 'hp',
    });
    await owner.mutation(api.characterSheet.editBaseScores, {
      ...scope,
      scores: { strength: 18 },
      operationId: 'base',
    });
    const entryId = await owner.mutation(
      api.characterSheet.createPersonalAdjustment,
      { ...scope, name: 'Reward', modifiers: [], operationId: 'reward' },
    );
    const before = await owner.query(api.characterSheet.read, scope);
    for (const warning of before?.calculated.warnings ?? []) {
      if (warning.kind !== 'rules') continue;
      await owner.mutation(api.characterSheet.acceptWarning, {
        ...scope,
        check: warning.check,
        subject: warning.subject,
        fingerprint: warning.fingerprint,
        operationId: `accept-${warning.check}`,
      });
    }
    const accepted = await owner.query(api.characterSheet.read, scope);
    const pointBuy = accepted?.acceptedWarnings.find(
      (row) => row.check === 'pointBuy',
    );
    if (!pointBuy) throw new Error('Missing accepted warning');
    // Model an obsolete acceptance retained by an older writer.
    await t.run((ctx) =>
      ctx.db.patch('acceptedWarning', pointBuy._id, {
        fingerprint: 'obsolete-facts',
      }),
    );
    if (command === 'create')
      await member.mutation(api.characterSheet.createPersonalAdjustment, {
        ...scope,
        name: 'Another reward',
        modifiers: [],
        operationId: command,
      });
    else if (command === 'remove')
      await member.mutation(api.characterSheet.removePersonalAdjustment, {
        ...scope,
        entryId,
        operationId: command,
      });
    else
      await member.mutation(api.characterSheet.editPersonalAdjustment, {
        ...scope,
        entryId,
        ...(command === 'toggle' ? { active: false } : { name: 'New reward' }),
        operationId: command,
      });
    const saved = await owner.query(api.characterSheet.read, scope);
    expect(saved?.acceptedWarnings).toEqual(
      accepted?.acceptedWarnings.filter((row) => row.check !== 'pointBuy'),
    );
    expect(saved?.calculated.warnings).toEqual(before?.calculated.warnings);
  },
);

test('stored same-rule copies and shared haste effects do not inflate sheet totals', async () => {
  const { t, owner, scope } = await fixture();
  for (const [name, target, bonusType, ruleIdentity, sourceKey] of [
    ['Original reward', 'ability.str', 'untyped', 'reward:one', undefined],
    ['Edited copy', 'ability.str', 'untyped', 'reward:one', undefined],
    ['Haste', 'ability.dex', 'dodge', 'spell:haste', 'haste'],
    ['Boots of speed', 'ability.dex', 'dodge', 'item:boots-of-speed', 'haste'],
  ] as const) {
    const entryId = await owner.mutation(
      api.characterSheet.createPersonalAdjustment,
      {
        ...scope,
        name,
        modifiers: [{ target, bonusType, value: 2 }],
        operationId: name,
      },
    );
    const sheet = await owner.query(api.characterSheet.read, scope);
    const entry = sheet?.entries.find((row) => row._id === entryId);
    if (entry?.kind !== 'manual') throw new Error('Missing adjustment');
    await t.run((ctx) =>
      ctx.db.patch('catalogEntry', entry.catalogEntryId, {
        ruleIdentity,
        sourceKey,
      }),
    );
  }
  const sheet = await owner.query(api.characterSheet.read, scope);
  expect(sheet?.calculated.abilities).toMatchObject({
    strength: { score: 12 },
    dexterity: { score: 12 },
  });
  expect(sheet?.calculated.breakdowns['ability.str']?.suppressed).toEqual([
    expect.objectContaining({ source: 'reward:one', value: 2 }),
  ]);
  expect(sheet?.calculated.breakdowns['ability.dex']?.suppressed).toEqual([
    expect.objectContaining({ source: 'haste', value: 2 }),
  ]);
});

test('toggling a personal adjustment preserves the latest name and Modifiers edited by another member', async () => {
  const { owner, member, scope } = await fixture();
  const entryId = await owner.mutation(
    api.characterSheet.createPersonalAdjustment,
    {
      ...scope,
      name: 'Reward',
      modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 2 }],
      operationId: 'create',
    },
  );
  await member.mutation(api.characterSheet.editPersonalAdjustment, {
    ...scope,
    entryId,
    name: 'Improved reward',
    modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 4 }],
    operationId: 'edit',
  });
  await owner.mutation(api.characterSheet.editPersonalAdjustment, {
    ...scope,
    entryId,
    active: false,
    operationId: 'toggle',
  });
  const sheet = await member.query(api.characterSheet.read, scope);
  expect(
    sheet?.catalogEntries.find((entry) => entry.detail.kind === 'manual'),
  ).toMatchObject({
    name: 'Improved reward',
    modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 4 }],
  });
  expect(sheet?.entries.find((entry) => entry._id === entryId)?.active).toBe(
    false,
  );
});

test('sheet reads preserve conditional adjustments and apply only conditions that currently hold', async () => {
  const { owner, scope } = await fixture();
  const before = await owner.query(api.characterSheet.read, scope);
  if (!before) throw new Error('Missing sheet');
  await owner.mutation(api.characterSheet.createPersonalAdjustment, {
    ...scope,
    name: 'Training',
    operationId: 'conditions',
    modifiers: [
      {
        target: 'ability.str',
        bonusType: 'untyped',
        value: 2,
        condition: { whileActive: before.baseScoresEntry._id },
      },
      {
        target: 'ability.str',
        bonusType: 'untyped',
        value: 4,
        condition: { situation: { local: 'At home' } },
      },
    ],
  });
  const sheet = await owner.query(api.characterSheet.read, scope);
  expect(sheet?.calculated.abilities.strength.score).toBe(12);
  expect(sheet?.calculated.breakdowns['ability.str']?.conditional).toEqual([
    expect.objectContaining({
      entryName: 'Training',
      value: 4,
      condition: { situation: { local: 'At home' } },
    }),
  ]);
});

test('ownership reassignment preserves personal adjustments on the authorized Character sheet', async () => {
  const { t, owner, member, outsider, scope, campaignId } = await fixture();
  const entryId = await owner.mutation(
    api.characterSheet.createPersonalAdjustment,
    {
      ...scope,
      name: 'Reward',
      modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 2 }],
      operationId: 'reward',
    },
  );
  const recipient = await t.run((ctx) =>
    ctx.db
      .query('user')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', 'test|member'),
      )
      .unique(),
  );
  if (!recipient) throw new Error('Missing campaign member');
  await member.mutation(api.character.reassignOwner, {
    ...scope,
    campaignId,
    ownerUserId: recipient._id,
    operationId: 'reassign',
  });
  const sheet = await member.query(api.characterSheet.read, {
    characterId: scope.characterId,
  });
  expect(sheet).toMatchObject({
    character: { ownerId: 'test|member' },
    owner: { userId: recipient._id, isMine: true },
    campaign: { campaignId, organizationId: 'org' },
    calculated: { abilities: { strength: { score: 12, modifier: 1 } } },
    lastOperationId: 'reassign',
  });
  expect(sheet?.entries.find((entry) => entry._id === entryId)).toMatchObject({
    kind: 'manual',
    active: true,
  });
  expect(await owner.query(api.characterSheet.read, scope)).toMatchObject({
    owner: { userId: recipient._id, isMine: false },
    calculated: { abilities: { strength: { score: 12, modifier: 1 } } },
  });
  await expect(
    outsider.query(api.characterSheet.read, { characterId: scope.characterId }),
  ).rejects.toThrow('Character not found');
});

test('missing personal adjustment definitions reject sheet reads and writes', async () => {
  const { t, owner, scope } = await fixture();
  const entryId = await owner.mutation(
    api.characterSheet.createPersonalAdjustment,
    {
      ...scope,
      name: 'Reward',
      modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 2 }],
      operationId: 'reward',
    },
  );
  await t.run(async (ctx) => {
    const entry = await ctx.db.get('characterSheetEntry', entryId);
    if (entry?.kind !== 'manual') throw new Error('Missing adjustment');
    await ctx.db.delete('catalogEntry', entry.catalogEntryId);
  });
  await expect(owner.query(api.characterSheet.read, scope)).rejects.toThrow(
    'Personal adjustment does not belong',
  );
  await expect(
    owner.mutation(api.characterSheet.editPersonalAdjustment, {
      ...scope,
      entryId,
      name: 'Edited',
      operationId: 'edit',
    }),
  ).rejects.toThrow('Personal adjustment does not belong');
});

test('forged personal adjustment Catalog Entry references fail reads and writes without exposing or changing another Character', async () => {
  const { t, owner, scope, campaignId } = await fixture();
  const otherId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Other',
    kind: 'npc',
    operationId: 'other',
  });
  const otherScope = { ...scope, characterId: otherId };
  const fields = {
    name: 'Reward',
    modifiers: [
      {
        target: 'ability.str' as const,
        bonusType: 'untyped' as const,
        value: 2,
      },
    ],
  };
  const entryId = await owner.mutation(
    api.characterSheet.createPersonalAdjustment,
    { ...scope, ...fields, operationId: 'add' },
  );
  const otherEntryId = await owner.mutation(
    api.characterSheet.createPersonalAdjustment,
    { ...otherScope, ...fields, operationId: 'add' },
  );
  const other = await owner.query(api.characterSheet.read, otherScope);
  const foreign = other?.entries.find((entry) => entry._id === otherEntryId);
  if (foreign?.kind !== 'manual') throw new Error('Missing adjustment');
  await t.run((ctx) =>
    ctx.db.patch('characterSheetEntry', entryId, {
      catalogEntryId: foreign.catalogEntryId,
    }),
  );
  await expect(owner.query(api.characterSheet.read, scope)).rejects.toThrow(
    'Personal adjustment does not belong',
  );
  await expect(
    owner.mutation(api.characterSheet.editPersonalAdjustment, {
      ...scope,
      entryId,
      name: 'Forged',
      operationId: 'forged',
    }),
  ).rejects.toThrow('Personal adjustment does not belong');
  await expect(
    owner.mutation(api.characterSheet.removePersonalAdjustment, {
      ...scope,
      entryId,
      operationId: 'forged',
    }),
  ).rejects.toThrow('Personal adjustment does not belong');
  expect(await owner.query(api.characterSheet.read, otherScope)).toEqual(other);
});

test.each(['whileActive', 'option'] as const)(
  'members can edit a saved %s condition after its referenced adjustment is removed',
  async (referenceKind) => {
    const { owner, member, scope, campaignId } = await fixture();
    const triggerId = await owner.mutation(
      api.characterSheet.createPersonalAdjustment,
      { ...scope, name: 'Trigger', modifiers: [], operationId: 'trigger' },
    );
    const withTrigger = await owner.query(api.characterSheet.read, scope);
    const trigger = withTrigger?.entries.find(
      (entry) => entry._id === triggerId,
    );
    if (trigger?.kind !== 'manual') throw new Error('Missing trigger');
    const condition =
      referenceKind === 'whileActive'
        ? { whileActive: trigger.catalogEntryId }
        : { situation: { option: trigger.catalogEntryId } };
    const modifiers = [
      {
        target: 'ability.str' as const,
        bonusType: 'untyped' as const,
        value: 2,
        condition,
      },
    ];
    const entryId = await owner.mutation(
      api.characterSheet.createPersonalAdjustment,
      {
        ...scope,
        name: 'Conditional reward',
        modifiers,
        operationId: 'reward',
      },
    );
    await member.mutation(api.characterSheet.removePersonalAdjustment, {
      ...scope,
      entryId: triggerId,
      operationId: 'remove-trigger',
    });
    await member.mutation(api.characterSheet.editPersonalAdjustment, {
      ...scope,
      entryId,
      active: false,
      operationId: 'disable-reward',
    });
    const disabled = await owner.query(api.characterSheet.read, scope);
    expect(
      disabled?.entries.find((entry) => entry._id === entryId)?.active,
    ).toBe(false);
    await member.mutation(api.characterSheet.editPersonalAdjustment, {
      ...scope,
      entryId,
      name: 'Revised conditional reward',
      active: true,
      modifiers: modifiers.map((modifier) => ({ ...modifier, value: 4 })),
      operationId: 'revise-reward',
    });
    const revised = await owner.query(api.characterSheet.read, scope);
    expect(revised?.calculated.abilities.strength.score).toBe(10);
    expect(revised?.calculated.breakdowns['ability.str']?.conditional).toEqual([
      expect.objectContaining({
        entryName: 'Revised conditional reward',
        value: 4,
        condition,
      }),
    ]);

    const otherId = await owner.mutation(api.characterSheet.create, {
      organizationId: 'org',
      campaignId,
      name: 'Other',
      kind: 'npc',
      operationId: 'other',
    });
    const other = await owner.query(api.characterSheet.read, {
      ...scope,
      characterId: otherId,
    });
    if (!other) throw new Error('Missing other sheet');
    const foreignCondition =
      referenceKind === 'whileActive'
        ? { whileActive: other.baseScoresEntry._id }
        : { situation: { option: other.baseScoresEntry._id } };
    await expect(
      member.mutation(api.characterSheet.editPersonalAdjustment, {
        ...scope,
        entryId,
        modifiers: modifiers.map((modifier) => ({
          ...modifier,
          condition: foreignCondition,
        })),
        operationId: 'foreign-reference',
      }),
    ).rejects.toThrow('Modifier reference does not belong to this Character');
    await expect(
      member.mutation(api.characterSheet.createPersonalAdjustment, {
        ...scope,
        name: 'New missing reference',
        modifiers,
        operationId: 'missing-reference',
      }),
    ).rejects.toThrow('Modifier reference does not belong to this Character');
    expect(await owner.query(api.characterSheet.read, scope)).toEqual(revised);
  },
);
