// @vitest-environment edge-runtime
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

// The spell class-list mechanism family's public proof
// (`scripts/catalog/launch-mechanism-proofs.ts`): a Spell whose only recorded
// mechanism is class-list membership, through each collection path a class
// list can use (`classListCollectionPath`): book, known, familiar and formula
// recording, and whole-list browsing, which records nothing. Their levels are
// a synthetic fixture: one Spell on five lists at different levels, and one
// on the four lists that cast at level 0, with no granted (domain, bloodline
// or other non-class) levels.
function classListSpell(
  key: string,
  name: string,
  levels: Record<string, number>,
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
      school: 'enc',
      subschools: [],
      descriptors: [],
    },
    description: `A Spell on ${Object.keys(levels).length} class lists.`,
    sources: [{ book: 'PZO1110', pages: '1' }],
    modifiers: [],
    unsupported: [],
  };
}
const spells = [
  classListSpell('class-list-proof', 'Class List Proof', {
    wizard: 2,
    sorcerer: 3,
    witch: 1,
    alchemist: 1,
    cleric: 1,
  }),
  classListSpell('class-list-cantrip-proof', 'Class List Cantrip Proof', {
    wizard: 0,
    sorcerer: 0,
    witch: 0,
    cleric: 0,
  }),
];
const classNames = {
  wizard: 'Wizard',
  sorcerer: 'Sorcerer',
  witch: 'Witch',
  alchemist: 'Alchemist',
  cleric: 'Cleric',
} as const;
type CastingClass = keyof typeof classNames;

/**
 * A Wizard 3 / Sorcerer 6 / Witch 1 / Alchemist 1 / Cleric 1 (castable 2nd,
 * 3rd and 1st-level spells, each but the Alchemist's also at level 0) with
 * Int 14, Wis 14 and Cha 16, and both Spells in its Character catalog.
 */
async function fixture() {
  const t = convexTest(schema, modules);
  const campaignId = await t.run(async (ctx) => {
    for (const person of ['owner', 'member'])
      await ctx.db.insert('user', {
        tokenIdentifier: person,
        orgIds: [{ orgId: 'org', role: 'member' }],
      });
    return ctx.db.insert('campaign', {
      name: 'Spell class lists',
      description: '',
      organizationId: 'org',
      ownerId: 'owner',
      e2eFixture: {
        namespace: 'spell-class-list',
        version: 1,
        workerKey: '0',
        caseKey: 'class-list',
        campaignKey: 'class-list',
      },
    });
  });
  const owner = t.withIdentity({ tokenIdentifier: 'owner' });
  const member = t.withIdentity({ tokenIdentifier: 'member' });
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
  const classId = (name: string) => {
    const found = initial?.catalogEntries.find(
      (entry) => entry.name === name && entry.detail.kind === 'class',
    );
    if (!found) throw new Error(`Missing ${name}`);
    return found._id;
  };
  if (!level) throw new Error('Missing initial Class Level');
  const classes = Object.fromEntries(
    Object.entries(classNames).map(([tag, name]) => [tag, classId(name)]),
  ) as Record<CastingClass, Id<'catalogEntry'>>;
  await member.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: classes.wizard,
    operationId: 'wizard-1',
  });
  for (const [name, count] of [
    ['wizard', 2],
    ['sorcerer', 6],
    ['witch', 1],
    ['alchemist', 1],
    ['cleric', 1],
  ] as const)
    for (let index = 0; index < count; index += 1)
      await member.mutation(api.characterSheet.addClassLevel, {
        ...scope,
        classEntryId: classes[name],
        operationId: `${name}-${index}`,
      });
  await member.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { intelligence: 14, wisdom: 14, charisma: 16 },
    operationId: 'casting-scores',
  });
  // This internal fixture writer installs only into convex-test's Character
  // catalog; every read and write the test makes is public.
  const [spellId, cantripId] = await owner.mutation(
    internal.characterSheetSpells.installPreparedCatalog,
    { ...scope, spells, operationId: 'class-list-catalog' },
  );
  if (!spellId || !cantripId) throw new Error('Missing installed Spell');
  return { owner, member, scope, classes, spellId, cantripId };
}

// Each casting: the Spell (the level-0 one or the other), its list level, a
// level it does not list the Spell at, its collection heading (none for a
// whole-list caster) and that level's DC (10 + level + ability modifier).
const castings = [
  { name: 'wizard', listLevel: 2, otherLevel: 3, heading: 'Spellbook', dc: 14 },
  {
    name: 'sorcerer',
    listLevel: 3,
    otherLevel: 2,
    heading: 'Spells known',
    dc: 16,
  },
  { name: 'witch', listLevel: 1, otherLevel: 2, heading: 'Familiar', dc: 13 },
  {
    name: 'alchemist',
    listLevel: 1,
    otherLevel: 2,
    heading: 'Formula book',
    dc: 13,
  },
  { name: 'cleric', listLevel: 1, otherLevel: 2, heading: null, dc: 13 },
  { name: 'wizard', listLevel: 0, otherLevel: 1, heading: 'Spellbook', dc: 12 },
  {
    name: 'sorcerer',
    listLevel: 0,
    otherLevel: 1,
    heading: 'Spells known',
    dc: 13,
  },
  { name: 'witch', listLevel: 0, otherLevel: 1, heading: 'Familiar', dc: 12 },
  { name: 'cleric', listLevel: 0, otherLevel: 2, heading: null, dc: 12 },
] as const satisfies readonly {
  name: CastingClass;
  listLevel: number;
  otherLevel: number;
  heading: string | null;
  dc: number;
}[];

type Fixture = Awaited<ReturnType<typeof fixture>>;
type Casting = (typeof castings)[number];

async function readSaved({ owner, scope }: Fixture) {
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!saved) throw new Error('Missing saved sheet');
  return saved;
}

/**
 * The Spellcasting browses the Spell at its own list's level only, then
 * records it; a whole-list caster's record is refused, since its browsing is
 * read-only.
 */
async function browseAndRecord(
  { member, scope, classes, spellId, cantripId }: Fixture,
  { name, listLevel, otherLevel, heading }: Casting,
) {
  const catalogEntryId = listLevel ? spellId : cantripId;
  const browse = (spellLevel: number) =>
    member.query(api.characterSheetSpells.browse, {
      ...scope,
      castingClassId: classes[name],
      spellLevel,
      paginationOpts: { cursor: null, numItems: 25 },
    });
  expect((await browse(listLevel)).page).toContainEqual(
    expect.objectContaining({
      catalogEntryId,
      spellLevel: listLevel,
      onList: true,
      recorded: false,
    }),
  );
  const other = await browse(otherLevel);
  expect(other.page.map((row) => row.catalogEntryId)).not.toContain(
    catalogEntryId,
  );
  const write = member.mutation(api.characterSheetSpells.record, {
    ...scope,
    castingClassId: classes[name],
    catalogEntryId,
    operationId: `record-${name}-${listLevel}`,
  });
  if (heading !== null) return write;
  await expect(write).rejects.toThrow(
    'This Spellcasting browses its whole list without recording Spells',
  );
  return undefined;
}

/**
 * The saved sheet: the list level's DC, and the record with its casting class
 * and list level, counted at that level in its book, known, familiar or
 * formula collection; a whole-list caster has no collection to record into.
 */
function expectSavedCasting({
  saved,
  classes,
  casting: { name, listLevel, heading, dc },
  entryId,
}: {
  saved: Awaited<ReturnType<typeof readSaved>>;
  classes: Fixture['classes'];
  casting: Casting;
  entryId: Id<'characterSheetEntry'> | undefined;
}) {
  const ofClass = ({ classEntryId }: { classEntryId: string }) =>
    classEntryId === classes[name];
  const atLevel = ({ spellLevel }: { spellLevel: number }) =>
    spellLevel === listLevel;
  const casting = saved.calculated.spellcastings.find(ofClass);
  expect(casting?.slots.find(atLevel)?.dc.total).toBe(dc);
  const collection =
    saved.calculated.spellCollections.collections.find(ofClass);
  if (heading === null) {
    expect(collection).toMatchObject({
      heading: null,
      readOnly: true,
      spells: [],
    });
    return;
  }
  expect(saved.entries.find((entry) => entry._id === entryId)).toMatchObject({
    kind: 'spell',
    state: { castingClassId: classes[name], level: listLevel },
  });
  expect(collection).toMatchObject({ heading, readOnly: false });
  expect(collection?.spells).toContainEqual(
    expect.objectContaining({ entryId, spellLevel: listLevel, offList: false }),
  );
  expect(collection?.levels.find(atLevel)).toMatchObject({ count: 1 });
}

test('a Spell learned from its class lists records the class, its list level and that level’s casting per Spellcasting, and a whole-list caster only browses it', async () => {
  const loaded = await fixture();
  const recorded: (Id<'characterSheetEntry'> | undefined)[] = [];
  for (const casting of castings)
    recorded.push(await browseAndRecord(loaded, casting));
  const saved = await readSaved(loaded);
  castings.forEach((casting, index) =>
    expectSavedCasting({
      saved,
      classes: loaded.classes,
      casting,
      entryId: recorded[index],
    }),
  );
  // A 6th-level Sorcerer knows one 3rd-level Spell: the allowance it counts against.
  expect(
    saved.calculated.spellCollections.collections
      .find((row) => row.classEntryId === loaded.classes.sorcerer)
      ?.levels.find((row) => row.spellLevel === 3),
  ).toMatchObject({ allowance: 1 });
  expect(saved.calculated.spellCollections.spellsWithoutSpellcasting).toEqual(
    [],
  );
  expect(
    (await loaded.member.query(api.characterSheet.read, loaded.scope))
      ?.calculated.spellCollections,
  ).toEqual(saved.calculated.spellCollections);
});
