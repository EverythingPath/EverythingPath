// @vitest-environment edge-runtime
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

// Every Archetype is a published representative seed; see
// docs/catalog-import/archetypes.md for its book, page and casting text.
async function fixture(className: string, levels: number) {
  const t = convexTest(schema, modules);
  const campaignId = await t.run(async (ctx) => {
    for (const [person, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: person,
        orgIds: [{ orgId, role: 'member' }],
      });
    return ctx.db.insert('campaign', {
      name: 'Archetype casting',
      description: '',
      organizationId: 'org',
      ownerId: 'owner',
      e2eFixture: {
        namespace: 'archetype-casting',
        version: 1,
        workerKey: '0',
        caseKey: 'archetype-casting',
        campaignKey: 'archetype-casting',
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
  const scope = { organizationId: 'org', campaignId, characterId };
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const level = initial?.entries.find((entry) => entry.kind === 'classLevel');
  const named = (name: string) => {
    const definition = initial?.catalogEntries.find(
      (entry) => entry.name === name,
    );
    if (!definition) throw new Error(`Missing ${name}`);
    return definition._id;
  };
  if (!level) throw new Error('Missing Class Level');
  const classId = named(className);
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { intelligence: 16, charisma: 16 },
    operationId: 'scores',
  });
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: classId,
    operationId: 'level-1',
  });
  for (let index = 2; index <= levels; index++)
    await member.mutation(api.characterSheet.addClassLevel, {
      ...scope,
      classEntryId: classId,
      operationId: `level-${index}`,
    });
  // CRB p. 264: Daylight is a 3rd-level bard spell. CRB p. 277: Entangle is
  // a 1st-level ranger spell on no bard or psychic list.
  const [daylight, entangle] = await owner.mutation(
    internal.characterSheetSpells.installPreparedCatalog,
    {
      ...scope,
      operationId: 'spells',
      spells: [
        importedSpell(
          'daylight',
          'Daylight',
          {
            bard: 3,
            cleric: 3,
            druid: 3,
            paladin: 3,
            sorcerer: 3,
            wizard: 3,
          },
          'evo',
          '264',
        ),
        importedSpell(
          'entangle',
          'Entangle',
          { druid: 1, ranger: 1 },
          'con',
          '277',
        ),
      ],
    },
  );
  if (!daylight || !entangle) throw new Error('Missing Spells');
  async function select(name: string, selected = true) {
    await member.mutation(api.characterSheet.setArchetypeSelected, {
      ...scope,
      classEntryId: classId,
      catalogEntryId: named(name),
      selected,
      operationId: `select-${name}-${selected}`,
    });
  }
  async function read() {
    const sheet = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    if (!sheet) throw new Error('Missing sheet');
    return sheet;
  }
  async function castingOf() {
    const casting = (await read()).calculated.spellcastings[0];
    if (!casting) throw new Error('Missing Spellcasting');
    return casting;
  }
  async function selectionOf(name: string) {
    const selection = (await read()).entries.find(
      (entry) =>
        entry.kind === 'archetype' && entry.catalogEntryId === named(name),
    );
    if (!selection) throw new Error('Missing selection');
    return selection._id;
  }
  async function browse(includeOtherLists = false) {
    return (
      await owner.query(api.characterSheetSpells.browse, {
        ...scope,
        castingClassId: classId,
        includeOtherLists,
        paginationOpts: { cursor: null, numItems: 50 },
      })
    ).page.map(({ name, spellLevel, onList }) => [name, spellLevel, onList]);
  }
  return {
    t,
    owner,
    member,
    outsider,
    scope,
    classId,
    named,
    daylight,
    entangle,
    select,
    read,
    castingOf,
    selectionOf,
    browse,
  };
}

function importedSpell(
  key: string,
  name: string,
  levels: Record<string, number>,
  school: string,
  pages: string,
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
    sources: [{ book: 'PZO1110', pages }],
    modifiers: [],
    unsupported: [],
  };
}

test('Seducer and Ley Line Guardian combine on a witch in either order while their shared hexes warn', async () => {
  const { select, read, castingOf } = await fixture('Witch', 5);
  await select('Ley Line Guardian');
  await select('Seducer');
  const witch = await castingOf();
  expect(witch).toMatchObject({
    ability: 'charisma',
    type: 'spontaneous',
    record: 'known',
    unresolved: [],
  });
  // Sorcerer 5 table; Charisma 16 adds one 1st- and one 2nd-level spell.
  expect(witch.slots.map((slot) => [slot.base, slot.bonus])).toEqual([
    [null, 0],
    [6, 1],
    [4, 1],
  ]);
  expect(
    witch.castingProperties.map(({ key, status, sources }) => [
      key,
      status,
      sources.map((source) => source.name),
    ]),
  ).toEqual([
    ['table', 'changed', ['Ley Line Guardian']],
    ['recording', 'changed', ['Ley Line Guardian']],
    ['ability', 'changed', ['Seducer']],
  ]);
  expect(
    (await read()).calculated.warnings.filter(
      (warning) => warning.check === 'archetypeConflict',
    ),
  ).toHaveLength(2);
}, 30_000);

test('Questioner against Psychic Detective waits per property, stays editable and ignores accepted warnings', async () => {
  const {
    owner,
    member,
    scope,
    classId,
    entangle,
    named,
    select,
    read,
    castingOf,
    selectionOf,
  } = await fixture('Investigator', 7);
  await select('Questioner');
  await select('Psychic Detective');
  // The seeded Daylight keeps Psychic Detective's own 3rd level (OA p. 120);
  // Entangle is on neither list and needs an explicit level.
  for (const [catalogEntryId, level] of [
    [named('Daylight'), undefined],
    [entangle, 1],
  ] as const)
    await member.mutation(api.characterSheetSpells.record, {
      ...scope,
      castingClassId: classId,
      catalogEntryId,
      level,
      operationId: `record-${catalogEntryId}`,
    });
  const pending = await read();
  const casting = await castingOf();
  expect(casting.spellList.classTag).toBeNull();
  expect(casting.spellKind).toBeNull();
  expect(casting.unresolved).toEqual(['spellKind', 'spellList']);
  expect(casting.casterLevel?.total).toBe(7);
  expect(
    pending.calculated.spellCollections.collections[0]?.spells.map(
      ({ name, spellLevel }) => [name, spellLevel],
    ),
  ).toEqual([
    ['Entangle', 1],
    ['Daylight', 3],
  ]);
  const conflict = pending.calculated.warnings.find(
    (warning) => warning.subject === 'investigator:casting:spellList',
  );
  const missing = pending.calculated.warnings.find(
    (warning) => warning.subject === 'investigator:castingChoice:spellList',
  );
  if (!conflict || !missing) throw new Error('Missing casting warnings');
  // Accepting the advisory warning supplies no calculation choice.
  await owner.mutation(api.characterSheet.acceptWarning, {
    ...scope,
    check: conflict.check,
    subject: conflict.subject,
    fingerprint: conflict.fingerprint,
    operationId: 'accept',
  });
  await expect(
    owner.mutation(api.characterSheet.acceptWarning, {
      ...scope,
      check: missing.check,
      subject: missing.subject,
      fingerprint: missing.fingerprint,
      operationId: 'accept-missing',
    }),
  ).rejects.toThrow();
  expect((await castingOf()).spellList.classTag).toBeNull();
  const level = pending.entries.find((entry) => entry.kind === 'classLevel');
  await member.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level!._id,
    hpGained: 5,
    operationId: 'hp',
  });
  const questioner = await selectionOf('Questioner');
  const detective = await selectionOf('Psychic Detective');
  await member.mutation(api.characterSheet.chooseArchetypeCasting, {
    ...scope,
    entryId: questioner,
    property: 'spellList',
    operationId: 'choose-questioner',
  });
  const chosen = await read();
  expect((await castingOf()).spellList.classTag).toBe('bard');
  expect((await castingOf()).unresolved).toEqual(['spellKind']);
  expect(chosen.acceptedWarnings).toHaveLength(1);
  expect(
    chosen.entries.find((entry) => entry._id === questioner),
  ).toMatchObject({ state: { castingChoices: ['spellList'] } });
  await owner.mutation(api.characterSheet.chooseArchetypeCasting, {
    ...scope,
    entryId: detective,
    property: 'spellList',
    operationId: 'choose-detective',
  });
  const moved = await read();
  expect((await castingOf()).spellList.classTag).toBe('psychic');
  expect(
    moved.entries.find((entry) => entry._id === questioner)?.state,
  ).not.toHaveProperty('castingChoices');
}, 30_000);

test('Skirmisher against Dandy is a whole-package choice that preserves recorded Spells', async () => {
  const {
    member,
    scope,
    classId,
    daylight,
    select,
    read,
    castingOf,
    selectionOf,
  } = await fixture('Ranger', 8);
  await select('Dandy');
  await member.mutation(api.characterSheetSpells.record, {
    ...scope,
    castingClassId: classId,
    catalogEntryId: daylight,
    operationId: 'record',
  });
  expect(
    (await read()).calculated.spellCollections.collections[0]?.spells,
  ).toEqual([expect.objectContaining({ name: 'Daylight', spellLevel: 3 })]);
  await select('Skirmisher');
  const pending = await castingOf();
  expect(pending).toMatchObject({
    ability: null,
    casterLevel: null,
    slots: [],
  });
  expect(pending.unresolved).toContain('presence');
  expect(
    (await read()).calculated.spellCollections.spellsWithoutSpellcasting,
  ).toEqual([]);
  await member.mutation(api.characterSheet.chooseArchetypeCasting, {
    ...scope,
    entryId: await selectionOf('Skirmisher'),
    property: 'presence',
    operationId: 'remove',
  });
  const removed = await read();
  expect(removed.calculated.spellcastings).toEqual([]);
  expect(removed.calculated.spellCollections.spellsWithoutSpellcasting).toEqual(
    [expect.objectContaining({ name: 'Daylight' })],
  );
  await member.mutation(api.characterSheet.chooseArchetypeCasting, {
    ...scope,
    entryId: await selectionOf('Dandy'),
    property: 'presence',
    operationId: 'retain',
  });
  expect(await castingOf()).toMatchObject({
    ability: 'charisma',
    record: 'known',
  });
  expect(
    (await read()).calculated.spellCollections.collections[0]?.spells,
  ).toHaveLength(1);
}, 30_000);

test('the Spells page browses a Dandy ranger’s effective bard list', async () => {
  const { select, browse } = await fixture('Ranger', 8);
  expect(await browse()).toEqual([['Entangle', 1, true]]);
  await select('Dandy');
  // The prepared Haste Spell is also a 3rd-level bard spell.
  expect(await browse()).toEqual([
    ['Daylight', 3, true],
    ['Haste', 3, true],
  ]);
  expect(await browse(true)).toContainEqual(['Entangle', 1, false]);
  await select('Dandy', false);
  expect(await browse()).toEqual([['Entangle', 1, true]]);
}, 30_000);

test('the casting choice writer refuses outsiders, foreign and invalid choices and every legacy Character write gate', async () => {
  const { t, owner, outsider, scope, select, read, selectionOf } =
    await fixture('Investigator', 3);
  await select('Questioner');
  await select('Psychic Detective');
  const entryId = await selectionOf('Questioner');
  const before = await read();
  const level = before.entries.find((entry) => entry.kind === 'classLevel');
  if (!level) throw new Error('Missing Class Level');
  function choose(
    caller: typeof owner,
    overrides: { property?: string; writeEpoch?: number } = {},
    target: Id<'characterSheetEntry'> = entryId,
  ) {
    return caller.mutation(api.characterSheet.chooseArchetypeCasting, {
      ...scope,
      entryId: target,
      property: overrides.property ?? 'spellList',
      operationId: 'choose',
      writeEpoch: overrides.writeEpoch,
    });
  }
  await expect(
    outsider.query(api.characterSheet.read, scope),
  ).rejects.toThrow();
  for (const caller of [t, outsider])
    await expect(choose(caller)).rejects.toThrow();
  // Neither changes the casting ability: a restated Intelligence is no change.
  await expect(choose(owner, { property: 'ability' })).rejects.toThrow(
    'no conflicting change',
  );
  await expect(choose(owner, { property: '' })).rejects.toThrow(
    'Choose a casting property',
  );
  await expect(choose(owner, {}, level._id)).rejects.toThrow(
    'Archetype does not belong',
  );
  const otherCharacterId = await owner.mutation(api.characterSheet.create, {
    organizationId: scope.organizationId,
    campaignId: scope.campaignId,
    name: 'Other Character',
    kind: 'pc',
    operationId: 'other',
  });
  const foreign = await t.run(async (ctx) => {
    const [row] = await ctx.db
      .query('characterSheetEntry')
      .withIndex('by_characterId', (q) => q.eq('characterId', otherCharacterId))
      .take(1);
    if (!row) throw new Error('Missing foreign entry');
    return row._id;
  });
  await expect(choose(owner, {}, foreign)).rejects.toThrow(
    'Archetype does not belong',
  );
  expect(await read()).toEqual(before);
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
  await expect(choose(owner)).rejects.toThrow('MAINTENANCE');
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationControl', controlId, { closed: false }),
  );
  await expect(choose(owner)).rejects.toThrow('RELOAD_REQUIRED');
  await t.run((ctx) =>
    ctx.db.patch('initialMigrationControl', controlId, { authority: 'sheet' }),
  );
  await expect(choose(owner, { writeEpoch: 1 })).rejects.toThrow(
    'RELOAD_REQUIRED',
  );
  expect(await read()).toEqual(before);
}, 30_000);
