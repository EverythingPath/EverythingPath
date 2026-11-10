// @vitest-environment edge-runtime
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { preloadCalledConvexModules } from '../tests/convex-modules';
import { convexTest, type TestConvex } from 'convex-test';
import { beforeAll, afterEach, expect, test, vi } from 'vitest';
import { refuseRepeatedPaginatedQueries } from '../tests/convex-paginated-queries';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');
beforeAll(() => refuseRepeatedPaginatedQueries(schema, modules));
preloadCalledConvexModules({ modules, testFile: import.meta.url });
const instances: ReturnType<typeof convexTest>[] = [];
afterEach(async () => {
  for (const instance of instances)
    await instance.finishAllScheduledFunctions(vi.runAllTimers);
  instances.length = 0;
  vi.useRealTimers();
});

// Dispel magic (CRB p. 272), its class levels from the pinned Foundry source
// (packs/spells/dispel-magic.gmgwyjfpeuuc4t4o.yaml).
const dispelMagicIdentity = 'pf1/gmgwyjfpeuuc4t4o';
const dispelMagicLevels = {
  antipaladin: 3,
  arcanist: 3,
  bard: 3,
  cleric: 3,
  druid: 4,
  hunter: 4,
  inquisitor: 3,
  magus: 3,
  medium: 3,
  mesmerist: 3,
  occultist: 3,
  oracle: 3,
  paladin: 3,
  psychic: 3,
  shaman: 3,
  skald: 3,
  sorcerer: 3,
  spiritualist: 3,
  summoner: 3,
  summonerUnchained: 3,
  warpriest: 3,
  witch: 3,
  wizard: 3,
};

// Haste (CRB p. 294), one of the prepared sheet's imported Spells.
const hasteIdentity = 'pf1/s9amdo5398alb5p0';

type SpellIndexConvex = TestConvex<typeof schema>;
type Owner = ReturnType<SpellIndexConvex['withIdentity']>;

async function createCampaigns(t: SpellIndexConvex) {
  const [source, destination] = await t.run(async (ctx) => {
    await ctx.db.insert('user', {
      tokenIdentifier: 'owner',
      orgIds: [{ orgId: 'org', role: 'member' }],
      characterSheetDemo: true,
    });
    const ids: Id<'campaign'>[] = [];
    for (const name of ['Source', 'Destination'])
      ids.push(
        await ctx.db.insert('campaign', {
          name,
          description: '',
          organizationId: 'org',
          ownerId: 'owner',
          e2eFixture: {
            namespace: 'spell-index',
            version: 1,
            workerKey: '0',
            caseKey: name,
            campaignKey: name,
          },
        }),
      );
    return ids;
  });
  if (!source || !destination) throw new Error('Missing campaigns');
  return { source, destination };
}

/**
 * The global Dispel magic and Dispel Focus ("Prerequisites: Ability to cast
 * dispel magic", pf1-content Dispel_Focus_POguLp8c7EdbOjhQ). Global content
 * has no player writer, so it is inserted directly.
 */
async function insertDispelContent(t: SpellIndexConvex) {
  return await t.run(async (ctx) => ({
    dispelMagic: await ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'Dispel magic',
      ruleIdentity: dispelMagicIdentity,
      stacksWithItself: false,
      sources: [{ book: 'PZO1110', pages: '272' }],
      modifiers: [],
      detail: {
        kind: 'spell',
        levels: dispelMagicLevels,
        school: 'abj',
        description: 'Cancel one magical spell or effect.',
      },
    }),
    dispelFocus: await ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'Dispel Focus',
      ruleIdentity: 'pf1-content/POguLp8c7EdbOjhQ',
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      prerequisites: [{ castsSpell: dispelMagicIdentity }],
      detail: { kind: 'feat' },
    }),
  }));
}

/** A prepared Cleric 5, who casts 3rd-level spells (CRB Table 3-6). */
async function createCleric({
  owner,
  campaignId,
}: {
  owner: Owner;
  campaignId: Id<'campaign'>;
}) {
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Vessa',
    kind: 'pc',
    operationId: 'create',
  });
  const scope = { organizationId: 'org', campaignId, characterId };
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const classId = (name: string) => {
    const row = initial?.catalogEntries.find(
      (entry) => entry.name === name && entry.detail.kind === 'class',
    );
    if (!row) throw new Error(`Missing ${name}`);
    return row._id;
  };
  const classes = {
    cleric: classId('Cleric'),
    wizard: classId('Wizard'),
    witch: classId('Witch'),
  };
  const level = initial?.entries.find((entry) => entry.kind === 'classLevel');
  if (!level) throw new Error('Missing Class Level');
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: classes.cleric,
    operationId: 'cleric-1',
  });
  for (let position = 2; position <= 5; position++)
    await owner.mutation(api.characterSheet.addClassLevel, {
      ...scope,
      classEntryId: classes.cleric,
      operationId: `cleric-${position}`,
    });
  return { characterId, scope, classes };
}

/** Reads name only the Character, so they follow it across a move. */
function sheetReads({
  owner,
  characterId,
  feat,
}: {
  owner: Owner;
  characterId: Id<'character'>;
  feat: Id<'characterSheetEntry'>;
}) {
  return {
    dispelFocusMet: async () => {
      const sheet = withSheetCatalog(
        await owner.query(api.characterSheet.read, { characterId }),
      );
      if (!sheet) throw new Error('Missing sheet');
      return sheet.calculated.prerequisites
        .filter((check) => check.entryId === feat && check.view === 'current')
        .map((check) => check.met);
    },
    browse: async ({
      castingClassId,
      search = '',
    }: {
      castingClassId: Id<'catalogEntry'>;
      search?: string;
    }) => {
      const result = await owner.query(api.characterSheetSpells.browse, {
        characterId,
        castingClassId,
        search,
        includeOtherLists: true,
        paginationOpts: { cursor: null, numItems: 20 },
      });
      return result.page.map(
        ({ catalogEntryId, name, spellLevel, recorded }) => ({
          catalogEntryId,
          name,
          spellLevel,
          recorded,
        }),
      );
    },
  };
}

function sheetWrites({
  owner,
  scope,
  destinationCampaignId,
  wizard,
  dispelMagic,
}: {
  owner: Owner;
  scope: {
    organizationId: string;
    campaignId: Id<'campaign'>;
    characterId: Id<'character'>;
  };
  destinationCampaignId: Id<'campaign'>;
  wizard: Id<'catalogEntry'>;
  dispelMagic: Id<'catalogEntry'>;
}) {
  async function addLevel({
    classEntryId,
    operationId,
  }: {
    classEntryId: Id<'catalogEntry'>;
    operationId: string;
  }) {
    await owner.mutation(api.characterSheet.addClassLevel, {
      ...scope,
      classEntryId,
      operationId,
    });
  }
  return {
    addLevel,
    /** Record the global Spell for a Wizard and remove it: its rows stay. */
    indexDispelMagic: async () => {
      await addLevel({ classEntryId: wizard, operationId: 'wizard-level' });
      const entryId = await owner.mutation(api.characterSheetSpells.record, {
        ...scope,
        castingClassId: wizard,
        catalogEntryId: dispelMagic,
        operationId: 'record-dispel',
      });
      await owner.mutation(api.characterSheetSpells.remove, {
        ...scope,
        entryId,
        operationId: 'remove-dispel',
      });
    },
    move: async (operationId: string) => {
      const { characterId } = scope;
      let result = await owner.mutation(api.characterMoves.start, {
        characterId,
        operationId,
        destinationCampaignId,
      });
      for (let count = 0; count < 24 && result.state !== 'completed'; count++)
        result = await owner.mutation(api.characterMoves.resume, {
          characterId,
          operationId,
        });
      expect(result.state).toBe('completed');
    },
  };
}

/**
 * Stored data as it may be from before #728, written directly, and global
 * content, which has no player writer.
 */
function storedData({
  t,
  characterId,
}: {
  t: SpellIndexConvex;
  characterId: Id<'character'>;
}) {
  return {
    /**
     * A Spell's rows, on one casting list or on all of them, still name a
     * definition that has since been deleted.
     */
    pointRowsAtDeletedDefinition: async ({
      ruleIdentity,
      castingClassId,
    }: {
      ruleIdentity: string;
      castingClassId?: Id<'catalogEntry'>;
    }) => {
      await t.run(async (ctx) => {
        const gone = await ctx.db.insert('catalogEntry', {
          scope: 'character',
          characterId,
          name: 'Deleted copy',
          ruleIdentity,
          stacksWithItself: false,
          sources: [],
          modifiers: [],
          detail: { kind: 'spell', levels: {}, school: '' },
        });
        await ctx.db.delete('catalogEntry', gone);
        const rows = await ctx.db
          .query('spellCatalogIndex')
          .withIndex('by_characterId_and_ruleIdentity', (q) =>
            q.eq('characterId', characterId).eq('ruleIdentity', ruleIdentity),
          )
          .take(64);
        const stale = rows.filter(
          (row) => !castingClassId || row.castingClassId === castingClassId,
        );
        if (!stale.length) throw new Error('Missing index row');
        for (const row of stale)
          await ctx.db.patch('spellCatalogIndex', row._id, {
            catalogEntryId: gone,
          });
      });
    },
    /** Rows written before rows carried their Spell's rule identity. */
    forgetRuleIdentities: async () => {
      await t.run(async (ctx) => {
        const rows = await ctx.db
          .query('spellCatalogIndex')
          .withIndex('by_characterId_and_ruleIdentity', (q) =>
            q.eq('characterId', characterId),
          )
          .take(256);
        for (const row of rows)
          await ctx.db.patch('spellCatalogIndex', row._id, {
            ruleIdentity: undefined,
            levels: undefined,
          });
      });
    },
    /** A class that arrived before #728 has no rows. */
    dropClassRows: async (castingClassId: Id<'catalogEntry'>) => {
      await t.run(async (ctx) => {
        const rows = await ctx.db
          .query('spellCatalogIndex')
          .withIndex('by_characterId_and_castingClassId_and_name', (q) =>
            q
              .eq('characterId', characterId)
              .eq('castingClassId', castingClassId),
          )
          .take(64);
        for (const row of rows)
          await ctx.db.delete('spellCatalogIndex', row._id);
        const summaries = await ctx.db
          .query('spellCatalogSummary')
          .withIndex(
            'by_characterId_and_castingClassId_and_kind_and_value',
            (q) =>
              q
                .eq('characterId', characterId)
                .eq('castingClassId', castingClassId),
          )
          .take(64);
        for (const row of summaries)
          await ctx.db.delete('spellCatalogSummary', row._id);
      });
    },
    /**
     * The Sorcerer (CRB pp. 70-73) reaching the Character from the global
     * catalog, rather than as the class seeded with the prepared sheet.
     */
    publishSorcerer: async () => {
      return await t.run(async (ctx) => {
        const seeded = await ctx.db
          .query('catalogEntry')
          .withIndex('by_characterId_and_ruleIdentity', (q) =>
            q.eq('characterId', characterId).eq('ruleIdentity', 'sorcerer'),
          )
          .unique();
        if (!seeded) throw new Error('Missing seeded Sorcerer');
        const {
          _id,
          _creationTime,
          characterId: _owner,
          browseOnly: _browseOnly,
          ...body
        } = seeded;
        return ctx.db.insert('catalogEntry', { ...body, scope: 'global' });
      });
    },
  };
}

/** A prepared Cleric 5 with Dispel Focus, and the global Dispel magic. */
async function fixture() {
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  instances.push(t);
  const campaigns = await createCampaigns(t);
  const owner = t.withIdentity({ tokenIdentifier: 'owner' });
  const { characterId, scope, classes } = await createCleric({
    owner,
    campaignId: campaigns.source,
  });
  const { dispelMagic, dispelFocus } = await insertDispelContent(t);
  const feat = await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: dispelFocus,
    operationId: 'dispel-focus',
  });
  return {
    t,
    owner,
    scope,
    dispelMagic,
    ...classes,
    ...sheetReads({ owner, characterId, feat }),
    ...sheetWrites({
      owner,
      scope,
      destinationCampaignId: campaigns.destination,
      wizard: classes.wizard,
      dispelMagic,
    }),
    ...storedData({ t, characterId }),
  };
}

const dispelMagicRow = {
  name: 'Dispel magic',
  spellLevel: 3,
  recorded: false,
};

test('a spell-index row whose definition is gone never fails the sheet read, and castsSpell reads the remaining rows', async () => {
  const {
    t,
    dispelMagic,
    cleric,
    indexDispelMagic,
    pointRowsAtDeletedDefinition,
    dispelFocusMet,
    browse,
  } = await fixture();
  await indexDispelMagic();
  // The Cleric's whole-list row is what makes the global Spell reachable.
  expect(await browse({ castingClassId: cleric, search: 'Dispel' })).toEqual([
    { ...dispelMagicRow, catalogEntryId: dispelMagic },
  ]);
  expect(await dispelFocusMet()).toEqual([true]);
  const druid = await t.run(async (ctx) => {
    const row = await ctx.db
      .query('catalogEntry')
      .withIndex('by_ruleIdentity', (q) => q.eq('ruleIdentity', 'druid'))
      .first();
    if (!row) throw new Error('Missing Druid');
    return row._id;
  });
  await pointRowsAtDeletedDefinition({
    ruleIdentity: dispelMagicIdentity,
    castingClassId: druid,
  });
  expect(await dispelFocusMet()).toEqual([true]);
  // With every row stale the read still succeeds, and the Spell is unknown.
  await t.run(async (ctx) => ctx.db.delete('catalogEntry', dispelMagic));
  expect(await dispelFocusMet()).toEqual([null]);
});

test('the Add Spells page skips a stored row whose definition is gone and shows the others', async () => {
  const {
    dispelMagic,
    cleric,
    indexDispelMagic,
    pointRowsAtDeletedDefinition,
    browse,
  } = await fixture();
  await indexDispelMagic();
  await pointRowsAtDeletedDefinition({
    ruleIdentity: hasteIdentity,
    castingClassId: cleric,
  });
  // Breeze is off the cleric list, filed at its lowest level.
  expect(
    (await browse({ castingClassId: cleric })).map(({ name }) => name),
  ).toEqual(['Breeze', 'Dispel magic']);
  expect(await browse({ castingClassId: cleric, search: 'Dispel' })).toEqual([
    { ...dispelMagicRow, catalogEntryId: dispelMagic },
  ]);
});

test('deleting a Character-only Spell repairs its rows from the definition it was copied from, keeping castsSpell met', async () => {
  const {
    owner,
    scope,
    dispelMagic,
    cleric,
    wizard,
    indexDispelMagic,
    browse,
    dispelFocusMet,
  } = await fixture();
  await indexDispelMagic();
  const unrecorded = { ...dispelMagicRow, catalogEntryId: dispelMagic };
  const recordedId = await owner.mutation(api.characterSheetSpells.record, {
    ...scope,
    castingClassId: wizard,
    catalogEntryId: dispelMagic,
    operationId: 'record-again',
  });
  const personalId = await owner.mutation(api.catalogCopies.detach, {
    ...scope,
    target: { kind: 'entry', entryId: recordedId },
    operationId: 'personal-copy',
  });
  expect(await browse({ castingClassId: wizard, search: 'Dispel' })).toEqual([
    { ...unrecorded, catalogEntryId: personalId, recorded: true },
  ]);
  // Removing the Selection deletes the Character's own copy behind it.
  await owner.mutation(api.characterSheet.removeSheetEntry, {
    ...scope,
    entryId: recordedId,
    operationId: 'remove-personal-copy',
  });
  expect(await browse({ castingClassId: cleric, search: 'Dispel' })).toEqual([
    unrecorded,
  ]);
  expect(await browse({ castingClassId: wizard, search: 'Dispel' })).toEqual([
    unrecorded,
  ]);
  expect(await dispelFocusMet()).toEqual([true]);
});

test('deleting a Character-only Spell keeps the rows another definition of that Spell still uses', async () => {
  const {
    owner,
    scope,
    dispelMagic,
    cleric,
    wizard,
    witch,
    addLevel,
    browse,
    dispelFocusMet,
  } = await fixture();
  await addLevel({ classEntryId: wizard, operationId: 'wizard-level' });
  await addLevel({ classEntryId: witch, operationId: 'witch-level' });
  const record = (castingClassId: Id<'catalogEntry'>, operationId: string) =>
    owner.mutation(api.characterSheetSpells.record, {
      ...scope,
      castingClassId,
      catalogEntryId: dispelMagic,
      operationId,
    });
  const wizardEntry = await record(wizard, 'wizard-dispel');
  await record(witch, 'witch-dispel');
  await owner.mutation(api.catalogCopies.detach, {
    ...scope,
    target: { kind: 'entry', entryId: wizardEntry },
    operationId: 'personal-copy',
  });
  const recorded = {
    ...dispelMagicRow,
    catalogEntryId: dispelMagic,
    recorded: true,
  };
  const dispelRows = (castingClassId: Id<'catalogEntry'>) =>
    browse({ castingClassId, search: 'Dispel' });
  expect(await dispelRows(witch)).toEqual([recorded]);
  await owner.mutation(api.characterSheet.removeSheetEntry, {
    ...scope,
    entryId: wizardEntry,
    operationId: 'remove-personal-copy',
  });
  expect(await dispelRows(witch)).toEqual([recorded]);
  expect(await dispelRows(wizard)).toEqual([{ ...recorded, recorded: false }]);
  expect(await dispelRows(cleric)).toEqual([{ ...recorded, recorded: false }]);
  expect(await dispelFocusMet()).toEqual([true]);
});

// Breeze and Haste, the prepared sheet's imported Spells (sorcerer 0 and 3).
const sorcererRows = [
  { name: 'Breeze', spellLevel: 0, recorded: false },
  { name: 'Haste', spellLevel: 3, recorded: false },
];
const withoutIds = (rows: readonly { catalogEntryId: string }[]) =>
  rows.map(({ catalogEntryId: _id, ...row }) => row);

test('a casting class added later gets browse rows for the Spells already seeded on the Character', async () => {
  const { addLevel, publishSorcerer, browse } = await fixture();
  const sorcerer = await publishSorcerer();
  await addLevel({ classEntryId: sorcerer, operationId: 'sorcerer-level' });
  expect(withoutIds(await browse({ castingClassId: sorcerer }))).toEqual(
    sorcererRows,
  );
});

test("a casting class added later never copies a stale row; the Spell's rows are repaired instead", async () => {
  const { addLevel, publishSorcerer, pointRowsAtDeletedDefinition, browse } =
    await fixture();
  await pointRowsAtDeletedDefinition({ ruleIdentity: hasteIdentity });
  const sorcerer = await publishSorcerer();
  await addLevel({ classEntryId: sorcerer, operationId: 'sorcerer-level' });
  expect(withoutIds(await browse({ castingClassId: sorcerer }))).toEqual(
    sorcererRows,
  );
});

test('a casting class added later gets browse rows from rows stored without a rule identity', async () => {
  const { addLevel, publishSorcerer, forgetRuleIdentities, browse } =
    await fixture();
  await forgetRuleIdentities();
  const sorcerer = await publishSorcerer();
  await addLevel({ classEntryId: sorcerer, operationId: 'sorcerer-level' });
  expect(withoutIds(await browse({ castingClassId: sorcerer }))).toEqual(
    sorcererRows,
  );
});

test('a prepared move repairs a stale spell-index row as a deletion repairs it in place', async () => {
  const {
    dispelMagic,
    witch,
    addLevel,
    indexDispelMagic,
    pointRowsAtDeletedDefinition,
    browse,
    dispelFocusMet,
    move,
  } = await fixture();
  await indexDispelMagic();
  await addLevel({ classEntryId: witch, operationId: 'witch-level' });
  await pointRowsAtDeletedDefinition({
    ruleIdentity: dispelMagicIdentity,
    castingClassId: witch,
  });
  await move('stale-row');
  expect(await browse({ castingClassId: witch, search: 'Dispel' })).toEqual([
    { ...dispelMagicRow, catalogEntryId: dispelMagic },
  ]);
  expect(await dispelFocusMet()).toEqual([true]);
});

test('a prepared move gives a casting class without browse rows the rows adding it in place gives', async () => {
  const { addLevel, publishSorcerer, dropClassRows, browse, move } =
    await fixture();
  const sorcerer = await publishSorcerer();
  await addLevel({ classEntryId: sorcerer, operationId: 'sorcerer-level' });
  await dropClassRows(sorcerer);
  expect(await browse({ castingClassId: sorcerer })).toEqual([]);
  await move('class-without-rows');
  // The move also indexes the global Spell Dispel Focus names.
  expect(withoutIds(await browse({ castingClassId: sorcerer }))).toEqual(
    expect.arrayContaining(sorcererRows),
  );
});
