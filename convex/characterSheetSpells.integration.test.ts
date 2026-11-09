// @vitest-environment edge-runtime
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { convexTest } from 'convex-test';
import { afterEach, expect, test, vi } from 'vitest';
import { api, internal } from './_generated/api';
import schema from './schema';
import { deleteSpellCatalogIndex } from './lib/spellCatalog';
import { maxCharacterChildRows } from './lib/characterSheetData';

const modules = import.meta.glob('./**/*.ts');

test('reimporting a recorded Spell replaces its entry Notes and clears Notes removed upstream', async () => {
  const { owner, scope, wizard } = await fixture();
  const spell = importedSpell('note-reimport', 'Annotated Spell', {
    wizard: 0,
  });
  const [catalogEntryId] = await owner.mutation(
    internal.characterSheetSpells.installPreparedCatalog,
    {
      ...scope,
      spells: [
        {
          ...spell,
          situationalNotes: [{ text: 'Only affects willing targets.' }],
        },
      ],
      operationId: 'import-note',
    },
  );
  if (!catalogEntryId) throw new Error('Missing imported Spell');
  await owner.mutation(api.characterSheetSpells.record, {
    ...scope,
    catalogEntryId,
    castingClassId: wizard._id,
    operationId: 'record-note-spell',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.calculated.entryNotes,
  ).toEqual([
    expect.objectContaining({ text: 'Only affects willing targets.' }),
  ]);
  await owner.mutation(internal.characterSheetSpells.installPreparedCatalog, {
    ...scope,
    spells: [spell],
    operationId: 'reimport-without-note',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.calculated.entryNotes,
  ).toEqual([]);
});

test('the Spell installer atomically refuses Note references that have not been materialized', async () => {
  const { owner, scope, wizard } = await fixture();
  await expect(
    owner.mutation(internal.characterSheetSpells.installPreparedCatalog, {
      ...scope,
      operationId: 'unmapped-note-reference',
      spells: [
        importedSpell('would-be-inserted', 'Atomic Note Spell', { wizard: 0 }),
        {
          ...importedSpell('unmapped-reference', 'Referenced Note Spell', {
            wizard: 0,
          }),
          situationalNotes: [
            {
              text: 'Only while active.',
              condition: { whileActive: wizard._id },
            },
          ],
        },
      ],
    }),
  ).rejects.toThrow('Imported Spell Note catalog references are not supported');
  const result = await owner.query(api.characterSheetSpells.browse, {
    ...scope,
    castingClassId: wizard._id,
    search: 'Atomic Note Spell',
    paginationOpts: { cursor: null, numItems: 25 },
  });
  expect(result.page).toEqual([]);
});

afterEach(() => vi.useRealTimers());

async function fixture({
  withPreparedCatalog = false,
  indexOnlyWizard = false,
} = {}) {
  const t = convexTest(schema, modules);
  const campaignId = await t.run(async (ctx) => {
    for (const person of ['owner', 'member', 'outsider'])
      await ctx.db.insert('user', {
        tokenIdentifier: person,
        orgIds: [
          { orgId: person === 'outsider' ? 'other' : 'org', role: 'member' },
        ],
      });
    return ctx.db.insert('campaign', {
      name: 'Spell collections',
      description: '',
      organizationId: 'org',
      ownerId: 'owner',
      e2eFixture: {
        namespace: 'spells',
        version: 1,
        workerKey: '0',
        caseKey: 'spells',
        campaignKey: 'spells',
      },
    });
  });
  const owner = t.withIdentity({ tokenIdentifier: 'owner' });
  const member = t.withIdentity({ tokenIdentifier: 'member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Vessa',
    kind: 'pc',
    operationId: 'create',
  });
  if (!withPreparedCatalog)
    await t.run(async (ctx) => {
      const seeded = await ctx.db
        .query('catalogEntry')
        .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
        .take(maxCharacterChildRows + 1);
      if (seeded.length > maxCharacterChildRows)
        throw new Error('Prepared fixture exceeds its catalog row limit');
      if (indexOnlyWizard)
        for (const definition of seeded)
          if (
            definition.name !== 'Wizard' &&
            definition.detail.kind === 'class' &&
            'casting' in definition.detail
          ) {
            const { casting: _casting, ...detail } = definition.detail;
            await ctx.db.patch('catalogEntry', definition._id, { detail });
          }
      for (const definition of seeded.filter((row) => row.importedSpell)) {
        await deleteSpellCatalogIndex(ctx, definition._id);
        await ctx.db.delete('catalogEntry', definition._id);
      }
    });
  const scope = { organizationId: 'org', campaignId, characterId };
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const wizard = sheet?.catalogEntries.find((row) => row.name === 'Wizard');
  const cleric = sheet?.catalogEntries.find((row) => row.name === 'Cleric');
  const classLevel = sheet?.entries.find((row) => row.kind === 'classLevel');
  if (!wizard || !cleric || !classLevel) throw new Error('Missing classes');
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: classLevel._id,
    classEntryId: wizard._id,
    operationId: 'wizard',
  });
  const spellId = await t.run(async (ctx) => {
    const existing = await ctx.db
      .query('catalogEntry')
      .withIndex('by_characterId_and_ruleIdentity', (q) =>
        q
          .eq('characterId', characterId)
          .eq('ruleIdentity', 'pf1/s9amdo5398alb5p0'),
      )
      .unique();
    if (existing) return existing._id;
    return ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: 'Haste',
      ruleIdentity: 'pf1/s9amdo5398alb5p0',
      stacksWithItself: false,
      modifiers: [],
      sources: [],
      detail: {
        kind: 'spell',
        levels: { wizard: 3, bard: 3, summoner: 2 },
        school: 'transmutation',
        description: 'Move and act more quickly.',
      },
    });
  });
  return {
    t,
    owner,
    member,
    outsider,
    scope,
    wizard,
    cleric,
    classLevel,
    spellId,
  };
}

test('shared Spell copies remain recordable without counting the original twice', async () => {
  const { t, owner, member, scope, wizard } = await fixture();
  const sharedSpellId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'Shared Spell',
      ruleIdentity: 'shared-spell',
      stacksWithItself: false,
      modifiers: [],
      sources: [],
      detail: { kind: 'spell', levels: { wizard: 1 }, school: 'evocation' },
    }),
  );
  const entryId = await owner.mutation(api.characterSheetSpells.record, {
    ...scope,
    castingClassId: wizard._id,
    catalogEntryId: sharedSpellId,
    operationId: 'shared-spell',
  });
  const campaignCopyId = await member.mutation(
    api.catalogCopies.customizeForCampaign,
    {
      ...scope,
      catalogEntryId: sharedSpellId,
      operationId: 'customize-spell',
    },
  );
  await member.mutation(api.catalogCopies.editDefinition, {
    ...scope,
    catalogEntryId: campaignCopyId,
    name: 'Campaign Spell',
    detail: { kind: 'spell', levels: { wizard: 2 }, school: 'illusion' },
    operationId: 'edit-campaign-spell',
  });
  const detachedId = await owner.mutation(api.catalogCopies.detach, {
    ...scope,
    target: { kind: 'entry', entryId },
    operationId: 'detach-spell',
  });
  expect(
    await member.mutation(api.characterSheetSpells.record, {
      ...scope,
      castingClassId: wizard._id,
      catalogEntryId: sharedSpellId,
      operationId: 'record-origin-again',
    }),
  ).toBe(entryId);
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(sheet?.entries.filter((row) => row.kind === 'spell')).toMatchObject([
    { _id: entryId, catalogEntryId: detachedId },
  ]);
  expect(
    sheet?.calculated.spellCollections.collections[0]?.levels.filter(
      (row) => row.count > 0,
    ),
  ).toEqual([{ spellLevel: 2, count: 1, allowance: null }]);
  const browser = await owner.query(api.characterSheetSpells.browse, {
    ...scope,
    castingClassId: wizard._id,
    search: 'Campaign',
    paginationOpts: { cursor: null, numItems: 10 },
  });
  expect(browser.page).toMatchObject([
    {
      catalogEntryId: detachedId,
      name: 'Campaign Spell',
      spellLevel: 2,
      school: 'illusion',
      recorded: true,
    },
  ]);
  expect(browser.page).toHaveLength(1);
  await owner.mutation(api.characterSheetSpells.remove, {
    ...scope,
    entryId,
    operationId: 'remove-copy',
  });
  expect(
    (
      await owner.query(api.characterSheetSpells.browse, {
        ...scope,
        castingClassId: wizard._id,
        search: 'Campaign',
        paginationOpts: { cursor: null, numItems: 10 },
      })
    ).page[0]?.recorded,
  ).toBe(false);
});

test('new isolated prepared Characters can browse and record the imported #253 Spells without a manual catalog install', async () => {
  const { owner, scope, wizard } = await fixture({ withPreparedCatalog: true });
  const page = await owner.query(api.characterSheetSpells.browse, {
    ...scope,
    castingClassId: wizard._id,
    paginationOpts: { numItems: 25, cursor: null },
  });
  expect(page.page.map((spell) => [spell.name, spell.ruleIdentity])).toEqual([
    ['Breeze', 'pf1/hw79kc0v9smvb6mj'],
    ['Haste', 'pf1/s9amdo5398alb5p0'],
  ]);
  const haste = page.page.find((spell) => spell.name === 'Haste');
  if (!haste) throw new Error('Missing prepared Haste');
  expect(haste.description).toContain(
    'The transmuted creatures move and act more quickly than normal.',
  );
  expect(haste.description).not.toMatch(/<[^>]*>/);
  await owner.mutation(api.characterSheetSpells.record, {
    ...scope,
    castingClassId: wizard._id,
    catalogEntryId: haste.catalogEntryId,
    operationId: 'prepared-haste',
  });
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    sheet?.calculated.spellCollections.collections[0]?.spells,
  ).toMatchObject([{ name: 'Haste', spellLevel: 3 }]);
  expect(
    sheet?.calculated.spellCollections.collections[0]?.spells[0]?.description,
  ).toBe(haste.description);
});

test('prepared imported Spell descriptions are readable in both browsing and recorded collections', async () => {
  const { owner, scope, wizard } = await fixture({ withPreparedCatalog: true });
  const page = await owner.query(api.characterSheetSpells.browse, {
    ...scope,
    castingClassId: wizard._id,
    search: 'Breeze',
    paginationOpts: { numItems: 25, cursor: null },
  });
  const breeze = page.page[0];
  if (!breeze) throw new Error('Missing Breeze');
  expect(breeze.description).toContain('You create a light wind');
  expect(breeze.description).not.toMatch(/<[^>]*>/);
  await owner.mutation(api.characterSheetSpells.record, {
    ...scope,
    castingClassId: wizard._id,
    catalogEntryId: breeze.catalogEntryId,
    operationId: 'readable-description',
  });
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    sheet?.calculated.spellCollections.collections[0]?.spells[0]?.description,
  ).toBe(breeze.description);
  await owner.mutation(internal.characterSheetSpells.installPreparedCatalog, {
    ...scope,
    operationId: 'description-entities',
    spells: [
      {
        ...importedSpell('readable', 'Readable Spell', { wizard: 0 }),
        description:
          '<p>First &amp; foremost.</p><p>A &lt;small&gt; test&#160;<i>quoted</i>.</p>',
      },
    ],
  });
  const readable = await owner.query(api.characterSheetSpells.browse, {
    ...scope,
    castingClassId: wizard._id,
    search: 'Readable',
    paginationOpts: { numItems: 25, cursor: null },
  });
  expect(readable.page[0]?.description).toBe(
    'First & foremost.\nA <small> test quoted.',
  );
});

test('members record a Spell separately for a casting class and remove it without changing spell effects', async () => {
  const { owner, member, scope, wizard, spellId } = await fixture();
  const entryId = await member.mutation(api.characterSheetSpells.record, {
    ...scope,
    castingClassId: wizard._id,
    catalogEntryId: spellId,
    operationId: 'haste',
  });
  let sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(sheet?.entries.find((row) => row._id === entryId)).toMatchObject({
    kind: 'spell',
    state: { castingClassId: wizard._id, level: 3 },
  });
  expect(sheet?.calculated.derivedStatistics.ac.total).toBe(10);
  await member.mutation(api.characterSheetSpells.remove, {
    ...scope,
    entryId,
    operationId: 'remove',
  });
  sheet = withSheetCatalog(await owner.query(api.characterSheet.read, scope));
  expect(sheet?.entries.some((row) => row._id === entryId)).toBe(false);
  expect(sheet?.catalogEntries.some((row) => row._id === spellId)).toBe(true);
});

const pageOptions = {
  numItems: 2,
  cursor: null,
  maximumRowsRead: 100,
  maximumBytesRead: 100_000,
};

test('browser defaults and levels follow recording and removing off-list Spells', async () => {
  const { owner, scope, wizard } = await fixture();
  const [lightId, , healingId] = await owner.mutation(
    internal.characterSheetSpells.installPreparedCatalog,
    {
      ...scope,
      operationId: 'metadata-catalog',
      spells: [
        importedSpell('light', 'Light', { wizard: 0 }, 'evo'),
        importedSpell('armor', 'Mage Armor', { wizard: 1 }, 'con'),
        importedSpell('healing', 'Healing', { cleric: 2 }, 'con'),
      ],
    },
  );
  if (!lightId || !healingId) throw new Error('Missing imported Spells');
  const filters = { ...scope, castingClassId: wizard._id };
  expect(
    await owner.query(api.characterSheetSpells.browserInfo, filters),
  ).toEqual({
    levels: [0, 1],
    schools: ['con', 'evo'],
    defaultLevel: 0,
  });
  await owner.mutation(api.characterSheetSpells.record, {
    ...filters,
    catalogEntryId: lightId,
    operationId: 'record-light',
  });
  expect(
    await owner.query(api.characterSheetSpells.browserInfo, {
      ...filters,
      includeOtherLists: true,
    }),
  ).toEqual({
    levels: [0, 1, 2],
    schools: ['con', 'evo'],
    defaultLevel: 1,
  });
  const entryId = await owner.mutation(api.characterSheetSpells.record, {
    ...filters,
    catalogEntryId: healingId,
    level: 4,
    operationId: 'record-healing',
  });
  expect(
    await owner.query(api.characterSheetSpells.browserInfo, filters),
  ).toMatchObject({ levels: [0, 1, 4], defaultLevel: 1 });
  await owner.mutation(api.characterSheetSpells.remove, {
    ...scope,
    entryId,
    operationId: 'remove-healing',
  });
  expect(
    await owner.query(api.characterSheetSpells.browserInfo, filters),
  ).toEqual({
    levels: [0, 1],
    schools: ['con', 'evo'],
    defaultLevel: 1,
  });
});

test('recording and both browser queries use the same missing-sheet error', async () => {
  const { t, owner, scope, wizard, spellId } = await fixture();
  await t.run((ctx) =>
    ctx.db.patch('character', scope.characterId, { sheetMode: undefined }),
  );
  const filters = { ...scope, castingClassId: wizard._id };
  await expect(
    owner.query(api.characterSheetSpells.browserInfo, filters),
  ).rejects.toThrow('Character has no sheet');
  await expect(
    owner.query(api.characterSheetSpells.browse, {
      ...filters,
      paginationOpts: pageOptions,
    }),
  ).rejects.toThrow('Character has no sheet');
  await expect(
    owner.mutation(api.characterSheetSpells.record, {
      ...filters,
      catalogEntryId: spellId,
      operationId: 'missing-sheet',
    }),
  ).rejects.toThrow('Character has no sheet');
});

test('Granted Spells never count as player-recorded Spells in the browser', async () => {
  const { t, owner, scope, wizard, spellId } = await fixture();
  await owner.mutation(internal.characterSheetSpells.installPreparedCatalog, {
    ...scope,
    operationId: 'grant-catalog',
    spells: [importedSpell('s9amdo5398alb5p0', 'Haste', { wizard: 3 })],
  });
  const grantEntryId = await t.run(async (ctx) => {
    await ctx.db.patch('catalogEntry', spellId, { browseOnly: undefined });
    return ctx.db.insert('characterSheetEntry', {
      characterId: scope.characterId,
      kind: 'spell',
      active: true,
      catalogEntryId: spellId,
      grantKey: { source: 'class-feature', entry: 'haste' },
      state: { kind: 'spell', castingClassId: wizard._id, level: 3 },
    });
  });
  const filters = { ...scope, castingClassId: wizard._id };
  expect(
    (
      await owner.query(api.characterSheetSpells.browse, {
        ...filters,
        paginationOpts: pageOptions,
      })
    ).page,
  ).toMatchObject([{ catalogEntryId: spellId, recorded: false }]);
  const entryId = await owner.mutation(api.characterSheetSpells.record, {
    ...filters,
    catalogEntryId: spellId,
    operationId: 'record-granted-spell',
  });
  expect(
    (
      await owner.query(api.characterSheetSpells.browse, {
        ...filters,
        paginationOpts: pageOptions,
      })
    ).page,
  ).toMatchObject([{ catalogEntryId: spellId, recorded: true }]);
  await owner.mutation(api.characterSheetSpells.remove, {
    ...scope,
    entryId,
    operationId: 'remove-recorded-grant',
  });
  expect(
    (
      await owner.query(api.characterSheetSpells.browse, {
        ...filters,
        paginationOpts: pageOptions,
      })
    ).page,
  ).toMatchObject([{ catalogEntryId: spellId, recorded: false }]);
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    )?.entries.some((entry) => entry._id === grantEntryId),
  ).toBe(true);
});
function importedSpell(
  key: string,
  name: string,
  levels: Record<string, number>,
  school = 'evo',
) {
  return {
    externalKey: `pf1/${key}`,
    upstreamKey: key,
    pack: 'spells',
    name,
    detail: {
      kind: 'spell' as const,
      levels,
      grantedLevels: {},
      school,
      subschools: [],
      descriptors: [],
    },
    description: `${name} description`,
    sources: [{ book: 'PZO1110', pages: '1' }],
    modifiers: [],
    unsupported: [],
  };
}

test('players browse class levels, paginate whole lists, search across levels and filter schools without legacy rows', async () => {
  const { owner, member, scope, wizard } = await fixture();
  await owner.mutation(internal.characterSheetSpells.installPreparedCatalog, {
    ...scope,
    operationId: 'catalog',
    spells: [
      importedSpell('light', 'Light', { wizard: 0 }),
      importedSpell('magicmissile', 'Magic Missile', { wizard: 1 }),
      importedSpell('magearmor', 'Mage Armor', { wizard: 1 }, 'con'),
      importedSpell('highmagic', 'Greater Magic Weapon', { wizard: 3 }),
      importedSpell('cure', 'Cure Light Wounds', { cleric: 1 }, 'con'),
    ],
  });
  const filters = { ...scope, castingClassId: wizard._id };
  const first = await member.query(api.characterSheetSpells.browse, {
    ...filters,
    paginationOpts: pageOptions,
  });
  expect(first.page.map((row) => row.name)).toEqual([
    'Greater Magic Weapon',
    'Light',
  ]);
  expect(first.isDone).toBe(false);
  const second = await member.query(api.characterSheetSpells.browse, {
    ...filters,
    paginationOpts: { ...pageOptions, cursor: first.continueCursor },
  });
  expect(second.page.map((row) => row.name)).toEqual([
    'Mage Armor',
    'Magic Missile',
  ]);
  expect(second.isDone).toBe(true);
  const level = await owner.query(api.characterSheetSpells.browse, {
    ...filters,
    spellLevel: 1,
    paginationOpts: pageOptions,
  });
  expect(level.page.map((row) => row.name)).toEqual([
    'Mage Armor',
    'Magic Missile',
  ]);
  const search = await owner.query(api.characterSheetSpells.browse, {
    ...filters,
    spellLevel: 0,
    search: 'magic',
    paginationOpts: pageOptions,
  });
  expect(new Set(search.page.map((row) => row.name))).toEqual(
    new Set(['Magic Missile', 'Greater Magic Weapon']),
  );
  const school = await owner.query(api.characterSheetSpells.browse, {
    ...filters,
    school: 'con',
    includeOtherLists: true,
    spellLevel: 1,
    paginationOpts: pageOptions,
  });
  expect(
    school.page.map((row) => [row.name, row.onList, row.spellLevel]),
  ).toEqual([
    ['Cure Light Wounds', false, 1],
    ['Mage Armor', true, 1],
  ]);
  expect(
    await owner.query(api.characterSheetSpells.browserInfo, filters),
  ).toEqual({ levels: [0, 1, 3], schools: ['con', 'evo'], defaultLevel: 0 });
  const sheet = withSheetCatalog(
    await member.query(api.characterSheet.read, scope),
  );
  expect(
    sheet?.catalogEntries.some((row) => row.name === 'Magic Missile'),
  ).toBe(false);
});

test('off-list explicit levels survive list and class loss, edits reopen warnings and removal prunes acceptance', async () => {
  const { owner, member, scope, wizard, cleric, classLevel } = await fixture();
  const [spellId] = await owner.mutation(
    internal.characterSheetSpells.installPreparedCatalog,
    {
      ...scope,
      operationId: 'catalog',
      spells: [
        importedSpell('cure', 'Cure Light Wounds', { cleric: 1 }, 'con'),
      ],
    },
  );
  if (!spellId) throw new Error('Missing imported Spell');
  await expect(
    member.mutation(api.characterSheetSpells.record, {
      ...scope,
      castingClassId: wizard._id,
      catalogEntryId: spellId,
      operationId: 'missing-level',
    }),
  ).rejects.toThrow('explicit level');
  const entryId = await member.mutation(api.characterSheetSpells.record, {
    ...scope,
    castingClassId: wizard._id,
    catalogEntryId: spellId,
    level: 4,
    operationId: 'off-list',
  });
  let sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const warning = sheet?.calculated.warnings.find(
    (row) => row.check === 'spellLevel',
  );
  if (!warning) throw new Error('Missing spell level warning');
  await member.mutation(api.characterSheet.acceptWarning, {
    ...scope,
    check: warning.check,
    subject: warning.subject,
    fingerprint: warning.fingerprint,
    operationId: 'accept',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.acceptedWarnings,
  ).toHaveLength(1);
  expect(
    (
      await owner.query(api.characterSheetSpells.browse, {
        ...scope,
        castingClassId: wizard._id,
        spellLevel: 4,
        paginationOpts: pageOptions,
      })
    ).page,
  ).toMatchObject([
    { name: 'Cure Light Wounds', onList: false, spellLevel: 4, recorded: true },
  ]);
  expect(
    await member.mutation(api.characterSheetSpells.record, {
      ...scope,
      castingClassId: wizard._id,
      catalogEntryId: spellId,
      level: 5,
      operationId: 'edit-level',
    }),
  ).toBe(entryId);
  sheet = withSheetCatalog(await owner.query(api.characterSheet.read, scope));
  expect(sheet?.acceptedWarnings).toHaveLength(0);
  await member.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: classLevel._id,
    classEntryId: cleric._id,
    operationId: 'lose-wizard',
  });
  sheet = withSheetCatalog(await owner.query(api.characterSheet.read, scope));
  expect(
    sheet?.calculated.spellCollections.spellsWithoutSpellcasting,
  ).toMatchObject([{ entryId, spellLevel: 5 }]);
  await expect(
    member.mutation(api.characterSheetSpells.record, {
      ...scope,
      castingClassId: cleric._id,
      catalogEntryId: spellId,
      operationId: 'whole-list',
    }),
  ).rejects.toThrow('whole list');
  const orphaned = sheet?.calculated.warnings.find(
    (row) => row.check === 'spellOrphaned',
  );
  if (!orphaned) throw new Error('Missing orphan warning');
  await owner.mutation(api.characterSheet.acceptWarning, {
    ...scope,
    check: orphaned.check,
    subject: orphaned.subject,
    fingerprint: orphaned.fingerprint,
    operationId: 'accept-orphan',
  });
  await member.mutation(api.characterSheetSpells.remove, {
    ...scope,
    entryId,
    operationId: 'remove-orphan',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.acceptedWarnings,
  ).toHaveLength(0);
});

test('browse and writes enforce Character scope, organization membership and every legacy Write Gate state', async () => {
  const { t, owner, member, outsider, scope, wizard, spellId } =
    await fixture();
  const entryId = await member.mutation(api.characterSheetSpells.record, {
    ...scope,
    castingClassId: wizard._id,
    catalogEntryId: spellId,
    operationId: 'record',
  });
  const browse = {
    ...scope,
    castingClassId: wizard._id,
    paginationOpts: { numItems: 25, cursor: null },
  };
  for (const caller of [t, outsider]) {
    await expect(
      caller.query(api.characterSheetSpells.browse, browse),
    ).rejects.toThrow();
    await expect(
      caller.mutation(api.characterSheetSpells.record, {
        ...scope,
        castingClassId: wizard._id,
        catalogEntryId: spellId,
        operationId: 'denied',
      }),
    ).rejects.toThrow();
    await expect(
      caller.mutation(api.characterSheetSpells.remove, {
        ...scope,
        entryId,
        operationId: 'denied',
      }),
    ).rejects.toThrow();
  }
  await expect(
    owner.query(api.characterSheetSpells.browse, {
      ...browse,
      organizationId: 'other',
    }),
  ).rejects.toThrow();
  const foreign = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId: scope.campaignId,
    name: 'Other caster',
    kind: 'pc',
    operationId: 'foreign',
  });
  await expect(
    owner.mutation(api.characterSheetSpells.record, {
      ...scope,
      characterId: foreign,
      castingClassId: wizard._id,
      catalogEntryId: spellId,
      operationId: 'foreign',
    }),
  ).rejects.toThrow();
  await expect(
    owner.mutation(api.characterSheetSpells.remove, {
      ...scope,
      characterId: foreign,
      entryId,
      operationId: 'foreign',
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
      deadline: 60_000,
    });
    return ctx.db.insert('initialMigrationControl', {
      key: 'character-sheet',
      epoch: 1,
      closed: true,
      authority: 'legacy',
      runId,
    });
  });
  const commands = () => [
    owner.mutation(api.characterSheetSpells.record, {
      ...scope,
      castingClassId: wizard._id,
      catalogEntryId: spellId,
      operationId: 'gate',
    }),
    owner.mutation(api.characterSheetSpells.remove, {
      ...scope,
      entryId,
      operationId: 'gate',
    }),
    owner.mutation(internal.characterSheetSpells.installPreparedCatalog, {
      ...scope,
      spells: [importedSpell('light', 'Light', { wizard: 0 })],
      operationId: 'gate',
    }),
  ];
  for (const pending of commands())
    await expect(pending).rejects.toThrow('MAINTENANCE');
  await expect(
    owner.query(api.characterSheetSpells.browse, browse),
  ).resolves.toMatchObject({ page: [{ name: 'Haste' }] });
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationControl', controlId, { closed: false }),
  );
  for (const pending of commands())
    await expect(pending).rejects.toThrow('RELOAD_REQUIRED');
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationControl', controlId, {
      epoch: 0,
      authority: 'sheet',
    }),
  );
  for (const pending of commands())
    await expect(pending).rejects.toThrow('RELOAD_REQUIRED');
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    )?.entries.some((row) => row._id === entryId),
  ).toBe(true);
});

test('a 4105-Spell prepared catalog keeps metadata bounded and descriptions out of sheet reads', async () => {
  const { t, owner, scope, wizard } = await fixture({ indexOnlyWizard: true });
  // Exceed the sheet-row limit; descriptions exceed one transaction if ordinary
  // sheet reads ever load the entire browse catalog.
  const spells = Array.from({ length: 4105 }, (_, index) => ({
    ...importedSpell(
      `scale${index}`,
      `Spell ${String(index).padStart(4, '0')}`,
      { wizard: index % 10 },
      index % 2 ? 'evo' : 'con',
    ),
    description: 'A spell description. '.repeat(400),
  }));
  for (let offset = 0; offset < spells.length; offset += 64)
    await owner.mutation(internal.characterSheetSpells.installPreparedCatalog, {
      ...scope,
      spells: spells.slice(offset, offset + 64),
      operationId: `batch-${offset}`,
    });
  await t.run((ctx) =>
    ctx.db.patch('catalogEntry', wizard._id, {
      scope: 'global',
      characterId: undefined,
    }),
  );
  const copiedWizardId = await owner.mutation(
    api.catalogCopies.customizeForCampaign,
    { ...scope, catalogEntryId: wizard._id, operationId: 'copy-large-catalog' },
  );
  const filters = { ...scope, castingClassId: copiedWizardId };
  const first = await owner.query(api.characterSheetSpells.browse, {
    ...filters,
    paginationOpts: { numItems: 25, cursor: null },
  });
  expect(first.page).toHaveLength(25);
  expect(first.page[0]?.name).toBe('Spell 0000');
  expect(first.isDone).toBe(false);
  const next = await owner.query(api.characterSheetSpells.browse, {
    ...filters,
    paginationOpts: { numItems: 25, cursor: first.continueCursor },
  });
  expect(next.page[0]?.name).toBe('Spell 0025');
  const metadata = await owner.query(
    api.characterSheetSpells.browserInfo,
    filters,
  );
  expect(metadata.levels).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  expect(metadata.defaultLevel).toBe(0);
  expect(
    (await owner.query(api.catalogCopies.list, scope)).some(
      (row) => row.importedSpell,
    ),
  ).toBe(false);
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const definitionCount = before?.catalogEntries.length ?? 0;
  const chosen = first.page[0];
  if (!chosen) throw new Error('Missing spell');
  const entryId = await owner.mutation(api.characterSheetSpells.record, {
    ...scope,
    castingClassId: copiedWizardId,
    catalogEntryId: chosen.catalogEntryId,
    operationId: 'record-scale',
  });
  const after = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(after?.catalogEntries).toHaveLength(definitionCount + 1);
  expect(
    after?.calculated.spellCollections.collections[0]?.spells,
  ).toMatchObject([{ name: 'Spell 0000' }]);
  await owner.mutation(api.characterSheetSpells.remove, {
    ...scope,
    entryId,
    operationId: 'remove-scale',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.catalogEntries,
  ).toHaveLength(definitionCount);
  const retained = await owner.query(api.characterSheetSpells.browse, {
    ...filters,
    paginationOpts: { numItems: 1, cursor: null },
  });
  expect(retained.page).toMatchObject([
    { catalogEntryId: chosen.catalogEntryId, recorded: false },
  ]);
  const restoredId = await owner.mutation(api.characterSheetSpells.record, {
    ...scope,
    castingClassId: copiedWizardId,
    catalogEntryId: chosen.catalogEntryId,
    operationId: 'restore-scale',
  });
  await owner.mutation(api.characterSheet.removeSheetEntry, {
    ...scope,
    entryId: restoredId,
    operationId: 'generic-remove-scale',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.catalogEntries,
  ).toHaveLength(definitionCount);
  // An isolated private-sheet fixture exercises the ordinary deletion seam.
  await t.run(async (ctx) => {
    await ctx.db.patch('catalogEntry', copiedWizardId, {
      scope: 'character',
      characterId: scope.characterId,
      campaignId: undefined,
    });
    await ctx.db.patch('character', scope.characterId, {
      campaignId: undefined,
      sheetDemo: true,
    });
  });
  await expect(
    owner.mutation(internal.characterSheetSpells.cleanupCatalog, {
      characterId: scope.characterId,
    }),
  ).rejects.toThrow('Remove the Character');
  vi.useFakeTimers();
  await owner.mutation(api.characterSheet.deletePrivate, {
    characterId: scope.characterId,
    operationId: 'delete-large-catalog',
  });
  await expect(
    owner.query(api.characterSheet.read, { characterId: scope.characterId }),
  ).rejects.toThrow('Character not found');
  await t.run(async (ctx) => {
    const runId = await ctx.db.insert('initialMigrationRun', {
      operationId: 'maintenance-after-deletion',
      epoch: 1,
      state: 'maintenance',
      frontendBuild: 'build',
      catalogManifest: 'catalog',
      startedAt: 0,
      deadline: 60_000,
    });
    await ctx.db.insert('initialMigrationControl', {
      key: 'character-sheet',
      epoch: 1,
      closed: true,
      authority: 'legacy',
      runId,
    });
  });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  // Authorized deletion has completed every bounded housekeeping continuation.
  expect(
    await t.run(async (ctx) => ({
      definitions: await ctx.db
        .query('catalogEntry')
        .withIndex('by_characterId', (q) =>
          q.eq('characterId', scope.characterId),
        )
        .take(1),
      indexes: await ctx.db
        .query('spellCatalogIndex')
        .withIndex('by_characterId_and_castingClassId_and_name', (q) =>
          q.eq('characterId', scope.characterId),
        )
        .take(1),
      summaries: await ctx.db
        .query('spellCatalogSummary')
        .withIndex(
          'by_characterId_and_castingClassId_and_kind_and_value',
          (q) => q.eq('characterId', scope.characterId),
        )
        .take(1),
    })),
  ).toEqual({ definitions: [], indexes: [], summaries: [] });
}, 190_000);

test('catalog edits and reimports preserve identity and explicit levels while updating list and school browsing', async () => {
  const { owner, member, scope, wizard } = await fixture();
  const [catalogEntryId] = await owner.mutation(
    internal.characterSheetSpells.installPreparedCatalog,
    {
      ...scope,
      operationId: 'initial',
      spells: [importedSpell('edited', 'Old Spell', { wizard: 1 }, 'evo')],
    },
  );
  if (!catalogEntryId) throw new Error('Missing imported Spell');
  const entryId = await member.mutation(api.characterSheetSpells.record, {
    ...scope,
    castingClassId: wizard._id,
    catalogEntryId: catalogEntryId,
    operationId: 'record',
  });
  await member.mutation(api.characterSheet.editSheetEntry, {
    ...scope,
    entryId,
    name: 'Edited Spell',
    detail: {
      kind: 'spell',
      levels: { cleric: 4 },
      school: 'con',
      description: 'Changed.',
    },
    operationId: 'edit-catalog',
  });
  let page = await owner.query(api.characterSheetSpells.browse, {
    ...scope,
    castingClassId: wizard._id,
    spellLevel: 1,
    school: 'con',
    paginationOpts: pageOptions,
  });
  expect(page.page).toMatchObject([
    {
      catalogEntryId,
      name: 'Edited Spell',
      spellLevel: 1,
      onList: false,
      recorded: true,
    },
  ]);
  const updatedIds = await owner.mutation(
    internal.characterSheetSpells.installPreparedCatalog,
    {
      ...scope,
      operationId: 'reimport',
      spells: [importedSpell('edited', 'Restored Spell', { wizard: 2 }, 'evo')],
    },
  );
  expect(updatedIds).toEqual([catalogEntryId]);
  page = await owner.query(api.characterSheetSpells.browse, {
    ...scope,
    castingClassId: wizard._id,
    spellLevel: 2,
    paginationOpts: pageOptions,
  });
  expect(page.page).toMatchObject([
    {
      catalogEntryId,
      name: 'Restored Spell',
      spellLevel: 2,
      onList: true,
      recorded: true,
    },
  ]);
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    )?.entries.find((row) => row._id === entryId)?.state,
  ).toMatchObject({ level: 1 });
  await member.mutation(api.characterSheet.removeSheetEntry, {
    ...scope,
    entryId,
    operationId: 'generic-remove',
  });
  expect(
    (
      await owner.query(api.characterSheetSpells.browse, {
        ...scope,
        castingClassId: wizard._id,
        includeOtherLists: true,
        paginationOpts: pageOptions,
      })
    ).page,
  ).toMatchObject([
    { catalogEntryId, name: 'Restored Spell', recorded: false },
  ]);
});

test('removing one casting collection clears its off-list browsing while another collection retains the same Spell', async () => {
  const { t, owner, member, scope, wizard } = await fixture();
  const secondWizardId = await t.run(async (ctx) => {
    const { _id: _id, _creationTime: _creationTime, ...definition } = wizard;
    if (
      definition.detail.kind !== 'class' ||
      !('casting' in definition.detail) ||
      !definition.detail.casting
    )
      throw new Error('Missing casting definition');
    return ctx.db.insert('catalogEntry', {
      ...definition,
      modifiers: [],
      name: 'Second book',
      ruleIdentity: 'class/second-book',
      detail: {
        ...definition.detail,
        casting: { ...definition.detail.casting, classTag: 'magus' },
      },
    });
  });
  await owner.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    classEntryId: secondWizardId,
    operationId: 'second-book',
  });
  const [catalogEntryId] = await owner.mutation(
    internal.characterSheetSpells.installPreparedCatalog,
    {
      ...scope,
      operationId: 'catalog',
      spells: [importedSpell('cure', 'Cure Light Wounds', { cleric: 1 })],
    },
  );
  if (!catalogEntryId) throw new Error('Missing imported Spell');
  const firstId = await member.mutation(api.characterSheetSpells.record, {
    ...scope,
    castingClassId: wizard._id,
    catalogEntryId: catalogEntryId,
    level: 2,
    operationId: 'first',
  });
  await member.mutation(api.characterSheetSpells.record, {
    ...scope,
    castingClassId: secondWizardId,
    catalogEntryId: catalogEntryId,
    level: 3,
    operationId: 'second',
  });
  await member.mutation(api.characterSheet.removeSheetEntry, {
    ...scope,
    entryId: firstId,
    operationId: 'remove-first',
  });
  expect(
    (
      await owner.query(api.characterSheetSpells.browse, {
        ...scope,
        castingClassId: wizard._id,
        paginationOpts: pageOptions,
      })
    ).page,
  ).toEqual([]);
  expect(
    (
      await owner.query(api.characterSheetSpells.browse, {
        ...scope,
        castingClassId: secondWizardId,
        paginationOpts: pageOptions,
      })
    ).page,
  ).toMatchObject([
    { name: 'Cure Light Wounds', spellLevel: 3, recorded: true },
  ]);
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    )?.catalogEntries.some((row) => row._id === catalogEntryId),
  ).toBe(true);
});

test('removing a recorded imported Spell preserves definitions needed by future Grants', async () => {
  const { t, owner, scope, wizard } = await fixture();
  const [catalogEntryId] = await owner.mutation(
    internal.characterSheetSpells.installPreparedCatalog,
    {
      ...scope,
      operationId: 'catalog',
      spells: [importedSpell('grant', 'Granted later', { wizard: 1 })],
    },
  );
  if (!catalogEntryId) throw new Error('Missing imported Spell');
  const entryId = await owner.mutation(api.characterSheetSpells.record, {
    ...scope,
    castingClassId: wizard._id,
    catalogEntryId,
    operationId: 'record',
  });
  await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId: scope.characterId,
      name: 'Future granting feature',
      ruleIdentity: 'feature/future-spell',
      sources: [],
      stacksWithItself: false,
      detail: { kind: 'classFeature' },
      modifiers: [],
      grants: [{ catalogEntryId }],
    }),
  );
  await owner.mutation(api.characterSheetSpells.remove, {
    ...scope,
    entryId,
    operationId: 'remove',
  });
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(sheet?.catalogEntries.some((row) => row._id === catalogEntryId)).toBe(
    true,
  );
  expect(sheet?.calculated.spellCollections.collections[0]?.spells).toEqual([]);
});

test('copying a casting class preserves its recorded Spells and indexed unrecorded list', async () => {
  const { t, owner, scope, wizard, classLevel } = await fixture({
    withPreparedCatalog: true,
  });
  await t.run((ctx) =>
    ctx.db.patch('catalogEntry', wizard._id, {
      scope: 'global',
      characterId: undefined,
    }),
  );
  const filters = {
    ...scope,
    castingClassId: wizard._id,
    paginationOpts: { cursor: null, numItems: 10 },
  };
  const initial = await owner.query(api.characterSheetSpells.browse, filters);
  const breeze = initial.page.find((row) => row.name === 'Breeze');
  if (!breeze) throw new Error('Missing Breeze');
  const entryId = await owner.mutation(api.characterSheetSpells.record, {
    ...scope,
    castingClassId: wizard._id,
    catalogEntryId: breeze.catalogEntryId,
    operationId: 'record-before-copy',
  });
  const campaignCopyId = await owner.mutation(
    api.catalogCopies.customizeForCampaign,
    { ...scope, catalogEntryId: wizard._id, operationId: 'copy-casting' },
  );
  expect(
    (
      await owner.query(api.characterSheetSpells.browse, {
        ...filters,
        castingClassId: campaignCopyId,
      })
    ).page,
  ).toMatchObject([
    { name: 'Breeze', recorded: true },
    { name: 'Haste', recorded: false },
  ]);
  const detachedId = await owner.mutation(api.catalogCopies.detach, {
    ...scope,
    target: { kind: 'entry', entryId: classLevel._id },
    operationId: 'detach-casting',
  });
  expect(
    (
      await owner.query(api.characterSheetSpells.browserInfo, {
        ...scope,
        castingClassId: detachedId,
      })
    ).levels,
  ).toEqual([0, 3]);
  expect(
    (
      await owner.query(api.characterSheetSpells.browse, {
        ...filters,
        castingClassId: detachedId,
      })
    ).page,
  ).toMatchObject([
    { name: 'Breeze', recorded: true },
    { name: 'Haste', recorded: false },
  ]);
  expect(
    withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    )?.entries.find((row) => row._id === entryId)?.state,
  ).toMatchObject({ castingClassId: detachedId });
  const detached = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  )?.catalogEntries.find((row) => row._id === detachedId);
  if (
    detached?.detail.kind !== 'class' ||
    !('casting' in detached.detail) ||
    !detached.detail.casting
  )
    throw new Error('Missing detached casting');
  await owner.mutation(api.catalogCopies.editDefinition, {
    ...scope,
    catalogEntryId: detachedId,
    detail: {
      ...detached.detail,
      casting: { ...detached.detail.casting, classTag: 'cleric' },
    },
    operationId: 'change-casting-list',
  });
  expect(
    (
      await owner.query(api.characterSheetSpells.browse, {
        ...filters,
        castingClassId: detachedId,
      })
    ).page,
  ).toMatchObject([
    { name: 'Breeze', recorded: true, onList: false, spellLevel: 0 },
  ]);
  expect(
    (
      await owner.query(api.characterSheetSpells.browse, {
        ...filters,
        castingClassId: detachedId,
      })
    ).page,
  ).toHaveLength(1);
  expect(
    (
      await owner.query(api.characterSheetSpells.browserInfo, {
        ...scope,
        castingClassId: detachedId,
      })
    ).levels,
  ).toEqual([0]);
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: classLevel._id,
    classEntryId: null,
    operationId: 'lose-casting',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.calculated.spellCollections.spellsWithoutSpellcasting,
  ).toMatchObject([
    { entryId, castingClassName: 'Wizard', classEntryId: detachedId },
  ]);
});

test('reimporting a Spell preserves a detached copy and keeps one row for its rule identity', async () => {
  const { t, owner, scope, wizard } = await fixture({
    withPreparedCatalog: true,
  });
  const browser = await owner.query(api.characterSheetSpells.browse, {
    ...scope,
    castingClassId: wizard._id,
    search: 'Haste',
    paginationOpts: { cursor: null, numItems: 10 },
  });
  const originalId = browser.page[0]?.catalogEntryId;
  if (!originalId) throw new Error('Missing Haste');
  await t.run((ctx) =>
    ctx.db.patch('catalogEntry', originalId, {
      scope: 'global',
      characterId: undefined,
    }),
  );
  const entryId = await owner.mutation(api.characterSheetSpells.record, {
    ...scope,
    castingClassId: wizard._id,
    catalogEntryId: originalId,
    operationId: 'record-origin',
  });
  const detachedId = await owner.mutation(api.catalogCopies.detach, {
    ...scope,
    target: { kind: 'entry', entryId },
    operationId: 'detach-origin',
  });
  await owner.mutation(api.catalogCopies.editDefinition, {
    ...scope,
    catalogEntryId: detachedId,
    name: 'Personal Haste',
    operationId: 'edit-copy',
  });
  const [installedId] = await owner.mutation(
    internal.characterSheetSpells.installPreparedCatalog,
    {
      ...scope,
      spells: [importedSpell('s9amdo5398alb5p0', 'Fresh Haste', { wizard: 3 })],
      operationId: 'reimport-origin',
    },
  );
  expect(installedId).not.toBe(detachedId);
  expect(
    (
      await owner.query(api.characterSheetSpells.browse, {
        ...scope,
        castingClassId: wizard._id,
        search: 'Haste',
        paginationOpts: { cursor: null, numItems: 10 },
      })
    ).page,
  ).toMatchObject([
    { catalogEntryId: detachedId, name: 'Personal Haste', recorded: true },
  ]);
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, scope))
      ?.calculated.spellCollections.collections[0]?.spells,
  ).toHaveLength(1);
});

test('separate casting collections retain different chosen copies of one Spell identity', async () => {
  const { t, owner, scope, wizard } = await fixture();
  const secondWizardId = await t.run(async (ctx) => {
    const { _id, _creationTime, ...definition } = wizard;
    if (definition.detail.kind !== 'class') throw new Error('Missing Wizard');
    return ctx.db.insert('catalogEntry', {
      ...definition,
      modifiers: [],
      ruleIdentity: 'second-wizard',
      name: 'Second Wizard',
    });
  });
  await owner.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    classEntryId: secondWizardId,
    operationId: 'second-casting',
  });
  const originalId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'Shared Spell',
      ruleIdentity: 'two-castings',
      modifiers: [],
      sources: [],
      stacksWithItself: false,
      detail: { kind: 'spell', levels: { wizard: 1 } },
    }),
  );
  const firstId = await owner.mutation(api.characterSheetSpells.record, {
    ...scope,
    castingClassId: wizard._id,
    catalogEntryId: originalId,
    operationId: 'first-casting-spell',
  });
  const secondId = await owner.mutation(api.characterSheetSpells.record, {
    ...scope,
    castingClassId: secondWizardId,
    catalogEntryId: originalId,
    operationId: 'second-casting-spell',
  });
  const detachedId = await owner.mutation(api.catalogCopies.detach, {
    ...scope,
    target: { kind: 'entry', entryId: firstId },
    operationId: 'first-personal-copy',
  });
  await owner.mutation(api.catalogCopies.editDefinition, {
    ...scope,
    catalogEntryId: detachedId,
    name: 'Personal Spell',
    detail: { kind: 'spell', levels: { wizard: 2 } },
    operationId: 'personal-copy-level',
  });
  expect(
    await owner.mutation(api.characterSheetSpells.record, {
      ...scope,
      castingClassId: secondWizardId,
      catalogEntryId: originalId,
      operationId: 'second-again',
    }),
  ).toBe(secondId);
  const filters = { ...scope, paginationOpts: { cursor: null, numItems: 10 } };
  expect(
    (
      await owner.query(api.characterSheetSpells.browse, {
        ...filters,
        castingClassId: wizard._id,
      })
    ).page,
  ).toMatchObject([
    {
      catalogEntryId: detachedId,
      name: 'Personal Spell',
      spellLevel: 2,
      recorded: true,
    },
  ]);
  expect(
    (
      await owner.query(api.characterSheetSpells.browse, {
        ...filters,
        castingClassId: secondWizardId,
      })
    ).page,
  ).toMatchObject([
    {
      catalogEntryId: originalId,
      name: 'Shared Spell',
      spellLevel: 1,
      recorded: true,
    },
  ]);
});

test('deleting a Character removes its shared Spell indexes and preserves another caster', async () => {
  const { t, owner, scope, wizard } = await fixture();
  const secondId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId: scope.campaignId,
    name: 'Other caster',
    kind: 'pc',
    operationId: 'create-second',
  });
  const secondScope = { ...scope, characterId: secondId };
  const second = withSheetCatalog(
    await owner.query(api.characterSheet.read, secondScope),
  );
  const secondWizard = second?.catalogEntries.find(
    (row) => row.name === 'Wizard',
  );
  const classLevel = second?.entries.find((row) => row.kind === 'classLevel');
  if (!secondWizard || !classLevel) throw new Error('Missing second Wizard');
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...secondScope,
    entryId: classLevel._id,
    classEntryId: secondWizard._id,
    operationId: 'second-wizard',
  });
  const spellId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'global',
      name: 'Shared Spell',
      ruleIdentity: 'shared-cleanup',
      modifiers: [],
      sources: [],
      stacksWithItself: false,
      detail: { kind: 'spell', levels: { wizard: 1 } },
    }),
  );
  for (const [characterScope, casting] of [
    [scope, wizard],
    [secondScope, secondWizard],
  ] as const)
    await owner.mutation(api.characterSheetSpells.record, {
      ...characterScope,
      castingClassId: casting._id,
      catalogEntryId: spellId,
      operationId: `record-${casting._id}`,
    });
  await t.run((ctx) =>
    ctx.db.patch('character', scope.characterId, {
      campaignId: undefined,
      sheetDemo: true,
    }),
  );
  await owner.mutation(api.characterSheet.deletePrivate, {
    characterId: scope.characterId,
    operationId: 'delete-shared-caster',
  });
  await expect(
    owner.query(api.characterSheet.read, { characterId: scope.characterId }),
  ).rejects.toThrow('Character not found');
  expect(
    (
      await owner.query(api.characterSheetSpells.browse, {
        ...secondScope,
        castingClassId: secondWizard._id,
        search: 'Shared Spell',
        paginationOpts: { cursor: null, numItems: 10 },
      })
    ).page,
  ).toMatchObject([
    { catalogEntryId: spellId, name: 'Shared Spell', recorded: true },
  ]);
  expect(
    (
      await owner.query(api.characterSheetSpells.browserInfo, {
        ...secondScope,
        castingClassId: secondWizard._id,
      })
    ).levels,
  ).toContain(1);
  // Storage invariant: a removed Character must leave no unreachable browser state.
  expect(
    await t.run((ctx) =>
      ctx.db
        .query('spellCatalogIndex')
        .withIndex('by_characterId_and_ruleIdentity', (q) =>
          q.eq('characterId', scope.characterId),
        )
        .take(1),
    ),
  ).toEqual([]);
  expect(
    await t.run((ctx) =>
      ctx.db
        .query('spellCatalogSummary')
        .withIndex(
          'by_characterId_and_castingClassId_and_kind_and_value',
          (q) => q.eq('characterId', scope.characterId),
        )
        .take(1),
    ),
  ).toEqual([]);
});
