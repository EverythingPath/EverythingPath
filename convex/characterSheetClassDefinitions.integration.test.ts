// @vitest-environment edge-runtime
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { convexTest } from 'convex-test';
import { beforeAll, expect, test } from 'vitest';
import { refuseRepeatedPaginatedQueries } from '../tests/convex-paginated-queries';
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import schema from './schema';
import { listCatalogReferences } from '../src/lib/catalog-copy-references';
import { formatGrantKeyId } from '../src/lib/character-sheet-grants';

// #583: an explicit switch changes the one definition every level of a class
// uses. Classes are the seeded CRB definitions published as global content;
// every copy is one the app's own Detach, Customize and definition editor make.
const modules = import.meta.glob('./**/*.ts');
beforeAll(() => refuseRepeatedPaginatedQueries(schema, modules));

async function fixture() {
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
        characterSheetDemo: true,
      });
    return ctx.db.insert('campaign', {
      name: 'Class definitions',
      description: '',
      organizationId: 'org',
      ownerId: 'owner',
      e2eFixture: {
        namespace: 'class-definitions',
        version: 1,
        workerKey: '0',
        caseKey: 'class-definitions',
        campaignKey: 'class-definitions',
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
  async function read(as = owner) {
    const sheet = withSheetCatalog(
      await as.query(api.characterSheet.read, scope),
    );
    if (!sheet) throw new Error('Missing sheet');
    return sheet;
  }
  return { t, owner, member, outsider, campaignId, characterId, scope, read };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;

/**
 * Publishes a Character's seeded class, with every definition it references,
 * as the global catalog would hold it: same rows, global scope.
 */
async function publishSeededClass(
  { t, characterId }: Pick<Fixture, 't' | 'characterId'>,
  identity: string,
) {
  return t.run(async (ctx) => {
    const [seed] = await ctx.db
      .query('catalogEntry')
      .withIndex('by_characterId_and_ruleIdentity', (q) =>
        q.eq('characterId', characterId).eq('ruleIdentity', identity),
      )
      .take(1);
    if (!seed) throw new Error(`Missing seeded ${identity}`);
    const pending: string[] = [seed._id];
    const published = new Set<string>();
    while (pending.length > 0) {
      const id = ctx.db.normalizeId('catalogEntry', pending.pop() ?? '');
      if (!id || published.has(id)) continue;
      published.add(id);
      const row = await ctx.db.get('catalogEntry', id);
      if (row?.characterId !== characterId) continue;
      await ctx.db.patch('catalogEntry', id, {
        scope: 'global',
        characterId: undefined,
        browseOnly: undefined,
      });
      pending.push(
        ...listCatalogReferences(row).map((reference) => reference.id),
      );
    }
    return seed._id;
  });
}

function classLevels(sheet: Awaited<ReturnType<Fixture['read']>>) {
  return sheet.entries
    .filter((entry) => entry.kind === 'classLevel')
    .sort((left, right) => left.state.position - right.state.position);
}

const grantId = (classLevel: number, entry: string) =>
  formatGrantKeyId({ source: 'fighter', classLevel, entry });

test('an explicit switch to another copy keeps every level and its state while Grants and dormancy follow the chosen definition', async () => {
  const context = await fixture();
  const { owner, member, scope, read } = context;
  const fighter = await publishSeededClass(context, 'fighter');
  const initial = await read();
  const named = (identity: string) => {
    const definition = initial.catalogEntries.find(
      (row) => row.ruleIdentity === identity,
    );
    if (!definition) throw new Error(`Missing ${identity}`);
    return definition._id;
  };
  const [first] = classLevels(initial);
  if (!first) throw new Error('Missing Class Level');
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: first._id,
    classEntryId: fighter,
    hpGained: 10,
    skillRanks: { 'skill.clm': 1 },
    favoredClassBonus: { choice: 'hp' },
    operationId: 'level-1',
  });
  const second = await member.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    classEntryId: fighter,
    operationId: 'level-2',
  });
  // CRB p. 56: a d10 allows at most 10; 12 is recorded and accepted.
  await member.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: second,
    hpGained: 12,
    skillRanks: { 'skill.swm': 1 },
    operationId: 'level-2-state',
  });
  await owner.mutation(api.characterSheet.editCreationSettings, {
    ...scope,
    settings: {},
    favoredClassIds: [fighter],
    operationId: 'favored',
  });
  await member.mutation(api.characterSheet.editGrantState, {
    ...scope,
    grantKey: { source: 'fighter', classLevel: 2, entry: 'fighter-bravery-2' },
    state: { notes: 'Never retreats' },
    operationId: 'bravery',
  });
  await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: named('longsword'),
    operationId: 'longsword',
  });
  // CRB p. 136: Weapon Focus (longsword), once from the 1st-level bonus feat
  // and once as the general feat. Same-Source stacking counts it once.
  const bonusFocus = await member.mutation(
    api.characterSheet.fillSelectionSlot,
    {
      ...scope,
      slotId: `feat:${grantId(1, 'fighter-bonus-feat-1')}:0`,
      position: 0,
      catalogEntryId: named('weapon-focus'),
      choice: 'longsword',
      operationId: 'bonus-focus',
    },
  );
  const generalFocus = await member.mutation(
    api.characterSheet.fillSelectionSlot,
    {
      ...scope,
      slotId: 'feat:general',
      position: 0,
      catalogEntryId: named('weapon-focus'),
      choice: 'longsword',
      gainedAtClassLevel: second,
      operationId: 'general-focus',
    },
  );
  const recorded = await read();
  for (const check of ['hpGainedAboveMaximum', 'featDuplicate']) {
    const warning = recorded.calculated.warnings.find(
      (row) => row.kind === 'rules' && row.check === check,
    );
    if (!warning) throw new Error(`Missing ${check} warning`);
    await owner.mutation(api.characterSheet.acceptWarning, {
      ...scope,
      check: warning.check,
      subject: warning.subject,
      fingerprint: warning.fingerprint,
      operationId: `accept-${check}`,
    });
  }
  const before = await read();
  const attack = (sheet: Awaited<ReturnType<typeof read>>) =>
    sheet.calculated.attackRoutines[0]?.single[0]?.attackBonus.total;
  // Fighter 2 BAB +2 and one Weapon Focus +1.
  expect(attack(before)).toBe(3);
  expect(before.acceptedWarnings).toHaveLength(2);
  const totals = (sheet: Awaited<ReturnType<typeof read>>) => ({
    attack: attack(sheet),
    bab: sheet.calculated.derivedStatistics.bab.total,
    fortitude: sheet.calculated.derivedStatistics.fortitude.total,
    hp: sheet.calculated.hp,
    prerequisites: sheet.calculated.prerequisites,
    skills: sheet.calculated.skills,
    accepted: sheet.acceptedWarnings.map(({ check, subject, fingerprint }) => ({
      check,
      subject,
      fingerprint,
    })),
  });

  // Detach makes this Character's own copy and repoints the class to it.
  const copy = await owner.mutation(api.catalogCopies.detach, {
    ...scope,
    target: { kind: 'entry', entryId: first._id },
    operationId: 'detach',
  });
  // Homebrew to global: the switch restores the exact earlier sheet rows.
  await member.mutation(api.characterSheet.switchClassVersion, {
    ...scope,
    entryId: second,
    classEntryId: fighter,
    operationId: 'to-global',
  });
  const restored = await read();
  expect(restored.entries).toEqual(before.entries);
  expect(totals(restored)).toEqual(totals(before));

  // Global to a Catalog Copy: every link follows; nothing else changes.
  await owner.mutation(api.characterSheet.switchClassVersion, {
    ...scope,
    entryId: first._id,
    classEntryId: copy,
    operationId: 'to-copy',
  });
  const copied = await read();
  expect(copied.entries).toEqual(
    before.entries.map((entry) =>
      entry.kind === 'classLevel'
        ? { ...entry, state: { ...entry.state, classEntryId: copy } }
        : entry.kind === 'base'
          ? { ...entry, state: { ...entry.state, favoredClassIds: [copy] } }
          : entry,
    ),
  );
  expect(totals(copied)).toEqual(totals(before));

  // The player's homebrew Fighter: d12, without the 1st-level bonus feat and
  // the 2nd-level Bravery, saved through the definition editor while unused.
  await owner.mutation(api.characterSheet.switchClassVersion, {
    ...scope,
    entryId: first._id,
    classEntryId: fighter,
    operationId: 'back-to-global',
  });
  const copyDefinition = copied.catalogEntries.find((row) => row._id === copy);
  if (
    copyDefinition?.detail.kind !== 'class' ||
    !('featuresByLevel' in copyDefinition.detail)
  )
    throw new Error('Missing copy');
  await owner.mutation(api.catalogCopies.editDefinition, {
    ...scope,
    catalogEntryId: copy,
    detail: {
      ...copyDefinition.detail,
      hitDie: 12,
      featuresByLevel: copyDefinition.detail.featuresByLevel.filter(
        (row) =>
          !['fighter-bonus-feat-1', 'fighter-bravery-2'].includes(
            copied.catalogEntries.find(
              (feature) => feature._id === row.catalogEntryId,
            )?.ruleIdentity ?? '',
          ),
      ),
    },
    operationId: 'homebrew',
  });
  expect((await read()).entries).toEqual(before.entries);
  await member.mutation(api.characterSheet.switchClassVersion, {
    ...scope,
    entryId: second,
    classEntryId: copy,
    operationId: 'to-homebrew',
  });
  const homebrew = await read();
  // Every row stays, with its own state: dormant entries are kept.
  expect(homebrew.entries).toEqual(copied.entries);
  expect(
    homebrew.calculated.resolvedEntries.find(
      (row) => row.entry._id === grantId(2, 'fighter-bravery-2'),
    ),
  ).toMatchObject({
    dormant: true,
    counting: false,
    entry: { notes: 'Never retreats' },
  });
  expect(
    homebrew.calculated.resolvedEntries.find(
      (row) => row.storedEntryId === bonusFocus,
    ),
  ).toMatchObject({ dormant: true, counting: false });
  expect(
    homebrew.calculated.resolvedEntries.find(
      (row) => row.storedEntryId === generalFocus,
    ),
  ).toMatchObject({ dormant: false, counting: true });
  expect(attack(homebrew)).toBe(3);
  // 12 HP no longer exceeds a d12: that acceptance goes with its changed
  // facts. The duplicate only stopped counting with its dormant Selection,
  // so its acceptance stays (owner, #583).
  expect(homebrew.acceptedWarnings.map((row) => row.check)).toEqual([
    'featDuplicate',
  ]);
  expect(
    homebrew.calculated.warnings.filter(
      (row) =>
        row.check === 'hpGainedAboveMaximum' || row.check === 'featDuplicate',
    ),
  ).toEqual([]);

  await owner.mutation(api.characterSheet.switchClassVersion, {
    ...scope,
    entryId: first._id,
    classEntryId: fighter,
    operationId: 'restore-global',
  });
  const returned = await read();
  expect(returned.entries).toEqual(before.entries);
  expect(
    returned.calculated.resolvedEntries.find(
      (row) => row.entry._id === grantId(2, 'fighter-bravery-2'),
    ),
  ).toMatchObject({ dormant: false, counting: true });
  expect(
    returned.calculated.resolvedEntries.find(
      (row) => row.storedEntryId === bonusFocus,
    ),
  ).toMatchObject({ dormant: false, counting: true });
  expect(attack(returned)).toBe(3);
  // The duplicate returns with the same facts and is still accepted; the HP
  // warning's acceptance went with its changed facts, so it is open again.
  expect(
    returned.calculated.warnings
      .filter((row) => row.kind === 'rules')
      .map((row) => [
        row.check,
        returned.acceptedWarnings.some(
          (accepted) =>
            accepted.check === row.check &&
            accepted.subject === row.subject &&
            accepted.fingerprint === row.fingerprint,
        ),
      ]),
  ).toEqual(
    expect.arrayContaining([
      ['featDuplicate', true],
      ['hpGainedAboveMaximum', false],
    ]),
  );
}, 60_000);

// CRB p. 310: Magic Missile, a 1st-level sorcerer/wizard evocation.
const magicMissile = {
  externalKey: 'pf1/magic-missile',
  upstreamKey: 'magic-missile',
  pack: 'spells',
  name: 'Magic Missile',
  detail: {
    kind: 'spell' as const,
    levels: { sorcerer: 1, wizard: 1 },
    grantedLevels: {},
    school: 'evo',
    subschools: [],
    descriptors: ['force'],
  },
  description: 'Magic Missile description',
  sources: [{ book: 'PZO1110', pages: '310' }],
  modifiers: [],
  unsupported: [],
};

test('switching a casting class to its copy keeps casting-advance, favored-class and recorded Spell links, its Spell browser and prerequisite results', async () => {
  const context = await fixture();
  const { owner, member, scope, read } = context;
  const wizard = await publishSeededClass(context, 'wizard');
  const initial = await read();
  const seeded = (identity: string) => {
    const definition = initial.catalogEntries.find(
      (row) => row.ruleIdentity === identity,
    );
    if (!definition) throw new Error(`Missing ${identity}`);
    return definition._id;
  };
  const [first] = classLevels(initial);
  if (!first) throw new Error('Missing Class Level');
  // Wizard 3, cleric 3, then Mystic Theurge 1 (CRB pp. 387–388).
  const classes = [
    wizard,
    wizard,
    wizard,
    seeded('cleric'),
    seeded('cleric'),
    seeded('cleric'),
    seeded('mystic-theurge'),
  ];
  const ids: Id<'characterSheetEntry'>[] = [first._id];
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: first._id,
    classEntryId: wizard,
    hpGained: 6,
    skillRanks: { 'skill.kar': 1 },
    operationId: 'level-1',
  });
  for (const [index, classEntryId] of classes.slice(1).entries())
    ids.push(
      await owner.mutation(api.characterSheet.addClassLevel, {
        ...scope,
        classEntryId,
        operationId: `level-${index + 2}`,
      }),
    );
  const theurge = ids.at(-1);
  if (!theurge) throw new Error('Missing Mystic Theurge');
  await member.mutation(api.characterSheet.assignCastingAdvance, {
    ...scope,
    entryId: theurge,
    index: 0,
    classEntryId: wizard,
    operationId: 'arcane-advance',
  });
  await owner.mutation(api.characterSheet.editCreationSettings, {
    ...scope,
    settings: {},
    favoredClassIds: [wizard],
    operationId: 'favored',
  });
  const [spell] = await owner.mutation(
    internal.characterSheetSpells.installPreparedCatalog,
    { ...scope, operationId: 'spells', spells: [magicMissile] },
  );
  if (!spell) throw new Error('Missing Magic Missile');
  const recordedSpell = await member.mutation(api.characterSheetSpells.record, {
    ...scope,
    castingClassId: wizard,
    catalogEntryId: spell,
    operationId: 'record',
  });
  async function browse(castingClassId: Id<'catalogEntry'>) {
    return (
      await owner.query(api.characterSheetSpells.browse, {
        ...scope,
        castingClassId,
        includeOtherLists: false,
        paginationOpts: { cursor: null, numItems: 50 },
      })
    ).page.map(({ name, spellLevel, onList, recorded }) => ({
      name,
      spellLevel,
      onList,
      recorded,
    }));
  }
  const before = await read();
  const browsed = await browse(wizard);
  expect(browsed).toContainEqual(
    expect.objectContaining({ name: 'Magic Missile', spellLevel: 1 }),
  );
  const casting = (sheet: Awaited<ReturnType<typeof read>>) =>
    sheet.calculated.spellcastings.map((row) => ({
      classTag: row.classTag,
      castingLevel: row.castingLevel,
      casterLevel: row.casterLevel?.total,
      spells: sheet.calculated.spellCollections.collections
        .find((collection) => collection.classEntryId === row.classEntryId)
        ?.spells.map((recorded) => recorded.entryId),
    }));
  expect(casting(before)).toContainEqual({
    classTag: 'wizard',
    castingLevel: 4,
    casterLevel: 4,
    spells: [recordedSpell],
  });

  const copy = await owner.mutation(api.catalogCopies.detach, {
    ...scope,
    target: { kind: 'entry', entryId: first._id },
    operationId: 'detach',
  });
  await member.mutation(api.characterSheet.switchClassVersion, {
    ...scope,
    entryId: ids[1] ?? first._id,
    classEntryId: wizard,
    operationId: 'to-global',
  });
  const restored = await read();
  expect(restored.entries).toEqual(before.entries);
  expect(await browse(wizard)).toEqual(browsed);

  await owner.mutation(api.characterSheet.switchClassVersion, {
    ...scope,
    entryId: first._id,
    classEntryId: copy,
    operationId: 'to-copy',
  });
  const copied = await read();
  const relinked = (id: string) => (id === wizard ? copy : id);
  expect(copied.entries).toEqual(
    before.entries.map((entry) => {
      if (entry.kind === 'classLevel')
        return {
          ...entry,
          state: {
            ...entry.state,
            classEntryId: entry.state.classEntryId
              ? relinked(entry.state.classEntryId)
              : null,
            ...(entry.state.castingAdvances
              ? {
                  castingAdvances: entry.state.castingAdvances.map((advance) =>
                    advance?.classEntryId
                      ? { classEntryId: relinked(advance.classEntryId) }
                      : advance,
                  ),
                }
              : {}),
          },
        };
      if (entry.kind === 'base')
        return { ...entry, state: { ...entry.state, favoredClassIds: [copy] } };
      if (entry.kind === 'spell')
        return { ...entry, state: { ...entry.state, castingClassId: copy } };
      return entry;
    }),
  );
  expect(casting(copied)).toEqual(casting(before));
  expect(copied.calculated.prerequisites).toEqual(
    before.calculated.prerequisites,
  );
  expect(copied.calculated.spellCollections.spellsWithoutSpellcasting).toEqual(
    [],
  );
  expect(await browse(copy)).toEqual(browsed);
  // No browser row stays filed under the class's earlier definition.
  expect(
    await context.t.run((ctx) =>
      ctx.db
        .query('spellCatalogIndex')
        .withIndex('by_characterId_and_castingClassId_and_name', (q) =>
          q.eq('characterId', context.characterId).eq('castingClassId', wizard),
        )
        .take(1),
    ),
  ).toEqual([]);
}, 60_000);

test('a switched investigator keeps its Archetypes, saved casting choice and accepted conflict warning', async () => {
  const context = await fixture();
  const { owner, member, scope, read } = context;
  const investigator = await publishSeededClass(context, 'investigator');
  const initial = await read();
  const named = (name: string) => {
    const definition = initial.catalogEntries.find((row) => row.name === name);
    if (!definition) throw new Error(`Missing ${name}`);
    return definition._id;
  };
  const [first] = classLevels(initial);
  if (!first) throw new Error('Missing Class Level');
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { intelligence: 16 },
    operationId: 'scores',
  });
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: first._id,
    classEntryId: investigator,
    operationId: 'level-1',
  });
  for (let level = 2; level <= 7; level++)
    await member.mutation(api.characterSheet.addClassLevel, {
      ...scope,
      classEntryId: investigator,
      operationId: `level-${level}`,
    });
  // ACG and OA: Questioner and Psychic Detective both replace the list (#422).
  for (const name of ['Questioner', 'Psychic Detective'])
    await member.mutation(api.characterSheet.setArchetypeSelected, {
      ...scope,
      classEntryId: investigator,
      catalogEntryId: named(name),
      selected: true,
      operationId: `select-${name}`,
    });
  const pending = await read();
  const questioner = pending.entries.find(
    (row) =>
      row.kind === 'archetype' && row.catalogEntryId === named('Questioner'),
  );
  const conflict = pending.calculated.warnings.find(
    (warning) => warning.subject === 'investigator:casting:spellList',
  );
  if (!questioner || !conflict) throw new Error('Missing casting conflict');
  await member.mutation(api.characterSheet.chooseArchetypeCasting, {
    ...scope,
    entryId: questioner._id,
    property: 'spellList',
    operationId: 'choose-questioner',
  });
  await owner.mutation(api.characterSheet.acceptWarning, {
    ...scope,
    check: conflict.check,
    subject: conflict.subject,
    fingerprint: conflict.fingerprint,
    operationId: 'accept',
  });
  const before = await read();
  const castingOf = (sheet: Awaited<ReturnType<typeof read>>) => {
    const [casting] = sheet.calculated.spellcastings;
    if (!casting) throw new Error('Missing Spellcasting');
    return casting;
  };
  expect(castingOf(before).spellList.classTag).toBe('bard');

  const copy = await owner.mutation(api.catalogCopies.detach, {
    ...scope,
    target: { kind: 'entry', entryId: first._id },
    operationId: 'detach',
  });
  await member.mutation(api.characterSheet.switchClassVersion, {
    ...scope,
    entryId: first._id,
    classEntryId: investigator,
    operationId: 'to-global',
  });
  expect((await read()).entries).toEqual(before.entries);
  await owner.mutation(api.characterSheet.switchClassVersion, {
    ...scope,
    entryId: first._id,
    classEntryId: copy,
    operationId: 'to-copy',
  });
  const copied = await read();
  // Archetype Selections keep their rows, saved casting choice and binding.
  expect(copied.entries.filter((row) => row.kind === 'archetype')).toEqual(
    before.entries
      .filter((row) => row.kind === 'archetype')
      .map((row) =>
        row.kind === 'archetype' && row.state.classEntryId
          ? { ...row, state: { ...row.state, classEntryId: copy } }
          : row,
      ),
  );
  // The same Spellcasting, now named by the copy.
  expect(
    JSON.parse(
      JSON.stringify(castingOf(copied)).replaceAll(copy, investigator),
    ),
  ).toEqual(castingOf(before));
  expect(copied.calculated.spellcastings[0]?.classEntryId).toBe(copy);
  expect(copied.acceptedWarnings).toEqual(before.acceptedWarnings);
  expect(
    copied.calculated.warnings.find(
      (warning) => warning.subject === 'investigator:casting:spellList',
    )?.fingerprint,
  ).toBe(conflict.fingerprint);
}, 60_000);

test('a carried homebrew class continues through new levels after arrival until an explicit switch moves it to the destination copy', async () => {
  const context = await fixture();
  const { t, owner, member, characterId, scope, read } = context;
  const destination = await t.run((ctx) =>
    ctx.db.insert('campaign', {
      name: 'Destination',
      description: '',
      organizationId: 'org',
      ownerId: 'owner',
      e2eFixture: {
        namespace: 'class-definitions',
        version: 1,
        workerKey: '0',
        caseKey: 'destination',
        campaignKey: 'destination',
      },
    }),
  );
  const fighter = await publishSeededClass(context, 'fighter');
  const [first] = classLevels(await read());
  if (!first) throw new Error('Missing Class Level');
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: first._id,
    classEntryId: fighter,
    hpGained: 10,
    operationId: 'level-1',
  });
  const second = await owner.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    classEntryId: fighter,
    operationId: 'level-2',
  });
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: second,
    hpGained: 7,
    skillRanks: { 'skill.clm': 1 },
    operationId: 'level-2-state',
  });
  await member.mutation(api.characterSheet.editGrantState, {
    ...scope,
    grantKey: { source: 'fighter', classLevel: 2, entry: 'fighter-bravery-2' },
    state: { notes: 'Never retreats' },
    operationId: 'bravery',
  });
  // The source campaign's own Fighter, which the move carries as homebrew.
  const sourceCopy = await owner.mutation(
    api.catalogCopies.customizeForCampaign,
    { ...scope, catalogEntryId: fighter, operationId: 'customize-source' },
  );
  let progress = await owner.mutation(api.characterMoves.start, {
    characterId,
    destinationCampaignId: destination,
    operationId: 'move',
  });
  for (let i = 0; i < 150 && progress.state !== 'completed'; i++)
    progress = await owner.mutation(api.characterMoves.resume, {
      characterId,
      operationId: 'move',
    });
  expect(progress.state).toBe('completed');
  const moved = { organizationId: 'org', characterId };
  const arrived = withSheetCatalog(
    await owner.query(api.characterSheet.read, moved),
  );
  const carried = arrived?.catalogEntries.find(
    (row) => row.copiedFrom === sourceCopy,
  );
  expect(carried).toMatchObject({
    scope: 'character',
    characterId,
    ruleIdentity: 'fighter',
  });
  if (!arrived || !carried) throw new Error('Missing carried Fighter');
  // The destination customizes the same global Fighter for its own pickers.
  const destinationCopy = await owner.mutation(
    api.catalogCopies.customizeForCampaign,
    { ...moved, catalogEntryId: fighter, operationId: 'customize-destination' },
  );
  // A picker still offering the global Fighter, and one offering the
  // destination's copy, both continue the carried definition.
  const third = await member.mutation(api.characterSheet.addClassLevel, {
    ...moved,
    classEntryId: fighter,
    operationId: 'level-3',
  });
  const fourth = await member.mutation(api.characterSheet.addClassLevel, {
    ...moved,
    operationId: 'level-4',
  });
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...moved,
    entryId: fourth,
    classEntryId: destinationCopy,
    hpGained: 6,
    operationId: 'level-4-class',
  });
  const continued = withSheetCatalog(
    await owner.query(api.characterSheet.read, moved),
  );
  if (!continued) throw new Error('Missing sheet');
  expect(
    classLevels(continued).map((row) => [row._id, row.state.classEntryId]),
  ).toEqual([
    [first._id, carried._id],
    [second, carried._id],
    [third, carried._id],
    [fourth, carried._id],
  ]);

  // Carried homebrew to the destination's copy, explicitly.
  await member.mutation(api.characterSheet.switchClassVersion, {
    ...moved,
    entryId: third,
    classEntryId: destinationCopy,
    operationId: 'to-destination',
  });
  const switched = withSheetCatalog(
    await owner.query(api.characterSheet.read, moved),
  );
  if (!switched) throw new Error('Missing sheet');
  expect(switched.entries).toEqual(
    continued.entries.map((entry) =>
      entry.kind === 'classLevel'
        ? {
            ...entry,
            state: { ...entry.state, classEntryId: destinationCopy },
          }
        : entry,
    ),
  );
  expect(
    switched.calculated.resolvedEntries.find(
      (row) => row.entry._id === grantId(2, 'fighter-bravery-2'),
    ),
  ).toMatchObject({
    dormant: false,
    counting: true,
    entry: { notes: 'Never retreats' },
  });
  // The carried definition stays the Character's own, so it can be chosen
  // back; nothing is rebuilt either way.
  expect(
    switched.catalogEntries.find((row) => row._id === carried._id),
  ).toMatchObject({ scope: 'character', characterId });
  await owner.mutation(api.characterSheet.switchClassVersion, {
    ...moved,
    entryId: first._id,
    classEntryId: carried._id,
    operationId: 'to-carried',
  });
  expect(
    withSheetCatalog(await owner.query(api.characterSheet.read, moved))
      ?.entries,
  ).toEqual(continued.entries);
}, 120_000);

/** A Fighter 2 on the published Fighter, with its own detached copy unused. */
async function fighterWithCopy(context: Fixture) {
  const { owner, scope, read } = context;
  const fighter = await publishSeededClass(context, 'fighter');
  const [first] = classLevels(await read());
  if (!first) throw new Error('Missing Class Level');
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: first._id,
    classEntryId: fighter,
    hpGained: 10,
    operationId: 'level-1',
  });
  const second = await owner.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    classEntryId: fighter,
    operationId: 'level-2',
  });
  const copy = await owner.mutation(api.catalogCopies.detach, {
    ...scope,
    target: { kind: 'entry', entryId: first._id },
    operationId: 'detach',
  });
  await owner.mutation(api.characterSheet.switchClassVersion, {
    ...scope,
    entryId: first._id,
    classEntryId: fighter,
    operationId: 'to-global',
  });
  return { fighter, copy, first: first._id, second };
}

test('a switch without access, or to a definition the Character cannot use, is refused alike and changes nothing', async () => {
  const context = await fixture();
  const { t, owner, member, outsider, campaignId, scope, read } = context;
  const { fighter, first } = await fighterWithCopy(context);
  // Another Character's private copy, and another campaign's own Fighter.
  const otherCharacter = await member.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Other',
    kind: 'pc',
    operationId: 'other',
  });
  const other = {
    organizationId: 'org',
    campaignId,
    characterId: otherCharacter,
  };
  const otherLevel = withSheetCatalog(
    await member.query(api.characterSheet.read, other),
  )?.entries.find((row) => row.kind === 'classLevel');
  if (!otherLevel) throw new Error('Missing Class Level');
  await member.mutation(api.characterSheet.editClassLevel, {
    ...other,
    entryId: otherLevel._id,
    classEntryId: fighter,
    operationId: 'other-fighter',
  });
  const privateCopy = await member.mutation(api.catalogCopies.detach, {
    ...other,
    target: { kind: 'entry', entryId: otherLevel._id },
    operationId: 'other-detach',
  });
  const elsewhere = await t.run((ctx) =>
    ctx.db.insert('campaign', {
      name: 'Elsewhere',
      description: '',
      organizationId: 'org',
      ownerId: 'owner',
      e2eFixture: {
        namespace: 'class-definitions',
        version: 1,
        workerKey: '0',
        caseKey: 'elsewhere',
        campaignKey: 'elsewhere',
      },
    }),
  );
  const elsewhereCharacter = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId: elsewhere,
    name: 'Elsewhere',
    kind: 'pc',
    operationId: 'elsewhere',
  });
  const elsewhereCopy = await owner.mutation(
    api.catalogCopies.customizeForCampaign,
    {
      organizationId: 'org',
      campaignId: elsewhere,
      characterId: elsewhereCharacter,
      catalogEntryId: fighter,
      operationId: 'customize-elsewhere',
    },
  );
  const deleted = await t.run(async (ctx) => {
    const definition = await ctx.db.get('catalogEntry', fighter);
    if (!definition) throw new Error('Missing Fighter');
    const { _id, _creationTime, ...body } = definition;
    const id = await ctx.db.insert('catalogEntry', body);
    await ctx.db.delete('catalogEntry', id);
    return id;
  });
  const before = await read();
  const args = {
    ...scope,
    entryId: first,
    classEntryId: privateCopy,
    operationId: 'refused',
  };
  await expect(
    t.mutation(api.characterSheet.switchClassVersion, args),
  ).rejects.toThrow('You do not have access');
  await expect(
    outsider.mutation(api.characterSheet.switchClassVersion, args),
  ).rejects.toThrow();
  await expect(
    outsider.query(api.characterSheet.read, scope),
  ).rejects.toThrow();
  // A private copy, another campaign's copy and a deleted definition are
  // refused with the same message, so nothing about them is revealed.
  for (const classEntryId of [privateCopy, elsewhereCopy, deleted])
    await expect(
      owner.mutation(api.characterSheet.switchClassVersion, {
        ...args,
        classEntryId,
      }),
    ).rejects.toThrow(/^.*Class does not belong to this Character$/);
  await expect(
    owner.mutation(api.characterSheet.switchClassVersion, {
      ...args,
      classEntryId: before.catalogEntries.find(
        (row) => row.ruleIdentity === 'wizard',
      )!._id,
    }),
  ).rejects.toThrow('original or Unchained version');
  expect(await read()).toEqual(before);
}, 60_000);

test('concurrent class edits, new levels and competing switches leave one definition and every level’s state', async () => {
  const context = await fixture();
  const { owner, member, scope, read } = context;
  const { fighter, copy, first, second } = await fighterWithCopy(context);
  await Promise.all([
    owner.mutation(api.characterSheet.switchClassVersion, {
      ...scope,
      entryId: first,
      classEntryId: copy,
      operationId: 'switch',
    }),
    member.mutation(api.characterSheet.editClassLevel, {
      ...scope,
      entryId: second,
      hpGained: 9,
      skillRanks: { 'skill.swm': 1 },
      operationId: 'edit',
    }),
  ]);
  const edited = await read();
  expect(
    classLevels(edited).map((row) => [
      row._id,
      row.state.classEntryId,
      row.state.hpGained,
    ]),
  ).toEqual([
    [first, copy, 10],
    [second, copy, 9],
  ]);
  // A level added from a picker that still shows the old definition, while
  // another player switches back, ends on the class's one definition.
  const [third] = await Promise.all([
    member.mutation(api.characterSheet.addClassLevel, {
      ...scope,
      classEntryId: copy,
      operationId: 'stale-add',
    }),
    owner.mutation(api.characterSheet.switchClassVersion, {
      ...scope,
      entryId: second,
      classEntryId: fighter,
      operationId: 'switch-back',
    }),
  ]);
  const added = await read();
  expect(
    classLevels(added).map((row) => [row._id, row.state.classEntryId]),
  ).toEqual([
    [first, fighter],
    [second, fighter],
    [third, fighter],
  ]);
  // Two players choosing different copies at once: the later write wins for
  // the whole class, and no level loses its own state.
  await Promise.all([
    owner.mutation(api.characterSheet.switchClassVersion, {
      ...scope,
      entryId: first,
      classEntryId: copy,
      operationId: 'owner-choice',
    }),
    member.mutation(api.characterSheet.switchClassVersion, {
      ...scope,
      entryId: third,
      classEntryId: fighter,
      operationId: 'member-choice',
    }),
  ]);
  const competing = await read();
  const chosen = new Set(
    classLevels(competing).map((row) => row.state.classEntryId),
  );
  expect(chosen.size).toBe(1);
  expect(
    classLevels(competing).map((row) => [row._id, row.state.hpGained]),
  ).toEqual([
    [first, 10],
    [second, 9],
    [third, null],
  ]);
  expect(competing.lastOperationId).toBe(
    chosen.has(copy) ? 'owner-choice' : 'member-choice',
  );
}, 60_000);

test('a switch lands on exactly the chosen version, even the global one the campaign’s preference stands in for', async () => {
  const context = await fixture();
  const { owner, member, scope, read } = context;
  const { fighter, copy, first, second } = await fighterWithCopy(context);
  // The campaign's Customize copy becomes its preference and takes the class.
  const campaignCopy = await owner.mutation(
    api.catalogCopies.customizeForCampaign,
    { ...scope, catalogEntryId: fighter, operationId: 'customize' },
  );
  const levelsOn = async () =>
    classLevels(await read()).map((row) => row.state.classEntryId);
  expect(await levelsOn()).toEqual([campaignCopy, campaignCopy]);
  await member.mutation(api.characterSheet.switchClassVersion, {
    ...scope,
    entryId: second,
    classEntryId: fighter,
    operationId: 'to-global',
  });
  expect(await levelsOn()).toEqual([fighter, fighter]);
  await owner.mutation(api.characterSheet.switchClassVersion, {
    ...scope,
    entryId: first,
    classEntryId: copy,
    operationId: 'to-own-copy',
  });
  expect(await levelsOn()).toEqual([copy, copy]);
  // Choosing what is already in use saves nothing and reports no change.
  const before = await read();
  await owner.mutation(api.characterSheet.switchClassVersion, {
    ...scope,
    entryId: first,
    classEntryId: copy,
    operationId: 'same',
  });
  expect((await read()).revision).toBe(before.revision);
}, 60_000);

test('the row picker never switches the class: another copy of a level’s own class continues its definition', async () => {
  const context = await fixture();
  const { owner, scope, read } = context;
  const { fighter, copy, first, second } = await fighterWithCopy(context);
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: second,
    classEntryId: copy,
    hpGained: 8,
    operationId: 'row-copy',
  });
  expect(
    classLevels(await read()).map((row) => [
      row._id,
      row.state.classEntryId,
      row.state.hpGained,
    ]),
  ).toEqual(
    [
      [first, fighter],
      [second, fighter],
    ].map(([id, classEntryId], index) => [id, classEntryId, index ? 8 : 10]),
  );
}, 60_000);
