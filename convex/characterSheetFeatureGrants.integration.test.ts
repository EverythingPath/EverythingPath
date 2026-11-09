// @vitest-environment edge-runtime
import { expect, test } from 'vitest';
import { prepare, releaseFixture } from '../tests/catalog-release-fixture';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import {
  canonicalReleaseJson,
  parseReleaseJson,
} from '../src/lib/catalog/release-schema';
import { candidateDefinition } from './lib/catalogCandidateDefinition';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';

const modules = import.meta.glob('./**/*.ts');

// The class-feature level-grant family's public proof
// (`scripts/catalog/launch-mechanism-proofs.ts`, `class-feature-level-grants`):
// an imported class's `featuresByLevel` names a feature and its reviewed
// schedule increments by stable key, a Catalog Release resolves each key to
// its Catalog Entry, and the sheet grants each as a Grant of that class at
// exactly its class level. The bodies are a synthetic fixture shaped as
// imported: a class listing a parent at 2nd level and two increments at 6th
// and 10th (each with the parent and part the importer gives it,
// `incrementEntries`), a second class listing none of them, and two
// Archetypes, one replacing the parent whole and one replacing the 6th-level
// part. Every read and write the test makes is public.
const classKey = 'pf1/featureGrantsProofClass';
const otherClassKey = 'pf1/featureGrantsProofOtherClass';
const parentKey = 'pf1/featureGrantsProofParent';
const sixthKey = 'everythingpath/feature-grants-proof-parent-6';
const tenthKey = 'everythingpath/feature-grants-proof-parent-10';
const wholeKey = 'pf1/featureGrantsProofWhole';
const partKey = 'pf1/featureGrantsProofPart';
const levelOf = { [parentKey]: 2, [sixthKey]: 6, [tenthKey]: 10 } as const;
const featureKeys = [parentKey, sixthKey, tenthKey] as const;

type Body = {
  externalKey: string;
  name: string;
  pack: string;
  detail: Record<string, unknown>;
};
function body({ externalKey, name, pack, detail }: Body) {
  return {
    externalKey,
    upstreamKey: externalKey,
    pack,
    name,
    detail,
    description: `<p>${name} body.</p>`,
    sources: [{ book: 'PZO1110', pages: '9' }],
    modifiers: [],
    unsupported: [],
  };
}
const classBody = (
  externalKey: string,
  name: string,
  features: readonly string[],
) =>
  body({
    externalKey,
    name,
    pack: 'classes',
    detail: {
      kind: 'class',
      hitDie: 10,
      bab: 'full',
      saves: { fort: 'good', ref: 'poor', will: 'poor' },
      classSkills: [],
      tag: name.toLowerCase().replaceAll(' ', ''),
      classKind: 'base',
      skillRanksPerLevel: 2,
      featuresByLevel: features.map((externalKey) => ({
        classLevel: levelOf[externalKey as keyof typeof levelOf],
        externalKey,
      })),
      picksByLevel: [],
    },
  });
const increment = (externalKey: string, name: string, classLevel: number) =>
  body({
    externalKey,
    name,
    pack: 'everythingpath-schedules',
    detail: {
      kind: 'classFeature',
      parentFeature: parentKey,
      part: `${classLevel}:${parentKey}`,
    },
  });
const archetype = (
  externalKey: string,
  name: string,
  replaces: { classLevel: number; externalKey: string; scope: string },
) =>
  body({
    externalKey,
    name,
    pack: 'archetypes',
    detail: {
      kind: 'archetype',
      classKeys: [classKey],
      replaces: [replaces],
      adds: [],
    },
  });
const bodies = [
  body({
    externalKey: parentKey,
    name: 'Proof Feature',
    pack: 'class-abilities',
    detail: { kind: 'classFeature' },
  }),
  increment(sixthKey, 'Proof Feature 2', 6),
  increment(tenthKey, 'Proof Feature 3', 10),
  classBody(classKey, 'Proof Class', featureKeys),
  classBody(otherClassKey, 'Other Proof Class', []),
  archetype(wholeKey, 'Proof Whole Archetype', {
    classLevel: 2,
    externalKey: parentKey,
    scope: 'whole',
  }),
  archetype(partKey, 'Proof Part Archetype', {
    classLevel: 6,
    externalKey: sixthKey,
    scope: 'part',
  }),
];

const classStub = {
  kind: 'class' as const,
  classKind: 'base' as const,
  hitDie: 6,
  bab: 'half' as const,
  saves: {
    fort: 'poor' as const,
    ref: 'poor' as const,
    will: 'good' as const,
  },
  skillRanksPerLevel: 2,
  classSkills: [],
  featuresByLevel: [],
  picksByLevel: [],
};

type Viewer = Awaited<ReturnType<typeof releaseFixture>>['owner'];
/** One public saved-sheet read with its catalog. */
async function readSheet(
  viewer: Viewer,
  scope: { organizationId: string; characterId: Id<'character'> },
) {
  const sheet = withSheetCatalog(
    await viewer.query(api.characterSheet.read, scope),
  );
  if (!sheet) throw new Error('Missing saved sheet');
  return sheet;
}
type Sheet = Awaited<ReturnType<typeof readSheet>>;
type Resolved = Sheet['calculated']['resolvedEntries'][number];

/**
 * The bodies through a prepared Catalog Release and the app's candidate
 * conversion, as `characterSheetGrantedSpells.integration.test.ts` installs
 * them: stored identity stubs, then each replaced by its release candidate.
 */
async function fixture() {
  const { t, owner, outsider, scope, create } = await releaseFixture(modules);
  await t.run((ctx) =>
    ctx.db.insert('user', {
      tokenIdentifier: 'test|member',
      orgIds: [{ orgId: 'org', role: 'member' }],
    }),
  );
  const member = t.withIdentity({ tokenIdentifier: 'test|member' });
  const ids = new Map<string, Id<'catalogEntry'>>();
  const id = (key: string) => {
    const found = ids.get(key);
    if (!found) throw new Error(`Missing ${key}`);
    return found;
  };
  await t.run(async (ctx) => {
    for (const { externalKey, name, detail } of bodies) {
      const identity = {
        scope: 'global' as const,
        name,
        ruleIdentity: externalKey,
        modifiers: [],
        sources: [],
        stacksWithItself: false,
      };
      if (detail.kind === 'archetype') continue;
      ids.set(
        externalKey,
        detail.kind === 'class'
          ? await ctx.db.insert('catalogEntry', {
              ...identity,
              detail: classStub,
            })
          : await ctx.db.insert('catalogEntry', {
              ...identity,
              detail: { kind: 'classFeature' },
            }),
      );
    }
    for (const { externalKey, name } of bodies.filter(
      ({ detail }) => detail.kind === 'archetype',
    ))
      ids.set(
        externalKey,
        await ctx.db.insert('catalogEntry', {
          scope: 'global',
          name,
          ruleIdentity: externalKey,
          modifiers: [],
          sources: [],
          stacksWithItself: false,
          detail: {
            kind: 'archetype',
            classEntryIds: [id(classKey)],
            replaces: [],
            adds: [],
          },
        }),
      );
  });
  await prepare(
    t,
    bodies.map((entry) => ({
      kind: 'definition',
      key: entry.externalKey,
      payload: parseReleaseJson(JSON.parse(canonicalReleaseJson(entry))),
    })),
  );
  await t.run(async (ctx) => {
    const release = await ctx.db
      .query('catalogRelease')
      .withIndex('by_releaseNumber', (q) => q.eq('releaseNumber', 1))
      .unique();
    if (!release) throw new Error('Missing release');
    for (const { externalKey } of bodies) {
      const stored = await ctx.db.get('catalogEntry', id(externalKey));
      if (!stored) throw new Error('Missing stored identity');
      const { _id, _creationTime, ...definition } = await candidateDefinition(
        ctx,
        release,
        stored,
      );
      await ctx.db.replace('catalogEntry', _id, definition);
    }
  });

  /** A Character with a first Class Level of the class, and its sheet. */
  async function character(name: string, classEntryKey: string) {
    const characterId =
      name === 'Vessa' ? scope.characterId : await create(name);
    const own = { organizationId: 'org', characterId };
    const read = (viewer: Viewer = member) => readSheet(viewer, own);
    const initial = await read(owner);
    const level = initial.entries.find((entry) => entry.kind === 'classLevel');
    if (!level) throw new Error('Missing first Class Level');
    const classEntryId = id(classEntryKey);
    await member.mutation(api.characterSheet.editClassLevel, {
      ...own,
      entryId: level._id,
      classEntryId,
      operationId: 'first-level',
    });
    let count = 1;
    const addLevel = () =>
      member.mutation(api.characterSheet.addClassLevel, {
        ...own,
        classEntryId,
        operationId: `level-${(count += 1)}`,
      });
    return { scope: own, read, addLevel, classEntryId };
  }
  return { t, owner, member, outsider, id, character };
}

/** The resolved rows of the proof's feature and increments, by stable key. */
function featureRows(sheet: Sheet, id: (key: string) => string) {
  return Object.fromEntries(
    featureKeys.flatMap((key) => {
      const row = sheet.calculated.resolvedEntries.find(
        ({ entry }) =>
          entry.kind === 'classFeature' && entry.catalogEntryId === id(key),
      );
      return row ? [[key, row] as const] : [];
    }),
  ) as Partial<Record<(typeof featureKeys)[number], Resolved>>;
}
/** The proof's features that count, each with its Grant Key. */
function countingGrants(sheet: Sheet, id: (key: string) => string) {
  return Object.entries(featureRows(sheet, id)).flatMap(([key, row]) =>
    row.counting && row.origin === 'grant' && 'grantKey' in row.entry
      ? [{ key, grantKey: row.entry.grantKey }]
      : [],
  );
}
const grantKey = (key: (typeof featureKeys)[number]) => ({
  source: classKey,
  classLevel: levelOf[key],
  entry: key,
});

test('a released class feature and its increments become Grants of the class that lists them, at exactly their class levels', async () => {
  const { t, id, character, owner, outsider } = await fixture();
  // The release resolved the class's keys to the released entries.
  const stored = await t.run((ctx) => ctx.db.get('catalogEntry', id(classKey)));
  expect(
    stored?.detail.kind === 'class' && 'featuresByLevel' in stored.detail
      ? stored.detail.featuresByLevel
      : undefined,
  ).toEqual([
    { classLevel: 2, catalogEntryId: id(parentKey) },
    { classLevel: 6, catalogEntryId: id(sixthKey) },
    { classLevel: 10, catalogEntryId: id(tenthKey) },
  ]);

  const vessa = await character('Vessa', classKey);
  for (let level = 1; level <= 12; level += 1) {
    if (level > 1) await vessa.addLevel();
    const expected = featureKeys
      .filter((key) => levelOf[key] <= level)
      .map((key) => ({ key, grantKey: grantKey(key) }));
    expect(countingGrants(await vessa.read(), id), `level ${level}`).toEqual(
      expected,
    );
  }
  // The Grant carries the released name, description and Sources.
  const sheet = await vessa.read(owner);
  expect(
    sheet.catalogEntries.find((entry) => entry._id === id(parentKey)),
  ).toMatchObject({
    name: 'Proof Feature',
    description: '<p>Proof Feature body.</p>',
    sources: [{ book: 'PZO1110', pages: '9' }],
    detail: { kind: 'classFeature' },
  });
  expect(
    sheet.catalogEntries.find((entry) => entry._id === id(sixthKey))?.detail,
  ).toEqual({
    kind: 'classFeature',
    parentFeature: parentKey,
    part: `6:${parentKey}`,
  });

  // A class that doesn't list them never grants them.
  const ilsa = await character('Ilsa', otherClassKey);
  for (let level = 2; level <= 12; level += 1) await ilsa.addLevel();
  expect(featureRows(await ilsa.read(), id)).toEqual({});
  await expect(
    outsider.query(api.characterSheet.read, vessa.scope),
  ).rejects.toThrow('You do not have access to this org');
});

test('a Grant’s saved state survives reload, other members’ reads and dormancy, and returns with the same Grant Key', async () => {
  const { id, character, member, owner, outsider } = await fixture();
  const vessa = await character('Vessa', classKey);
  await vessa.addLevel();
  const parent = grantKey(parentKey);
  await member.mutation(api.characterSheet.editGrantState, {
    ...vessa.scope,
    grantKey: parent,
    state: { active: false, choice: 'Chosen at use', notes: 'Table note' },
    operationId: 'grant-state',
  });
  const saved = {
    origin: 'grant',
    recorded: true,
    dormant: false,
    counting: false,
    entry: {
      grantKey: parent,
      active: false,
      notes: 'Table note',
      state: { choice: 'Chosen at use' },
    },
  };
  // Reload, and another member's read, see the same saved state.
  expect(featureRows(await vessa.read(), id)[parentKey]).toMatchObject(saved);
  const ownerRow = featureRows(await vessa.read(owner), id)[parentKey];
  expect(ownerRow).toMatchObject(saved);
  const grantId = ownerRow?.entry._id;

  // Deleting a Class Level leaves the class at 1st: the Grant goes dormant
  // with its state kept.
  const levels = (await vessa.read()).entries.filter(
    (entry) => entry.kind === 'classLevel',
  );
  const second = levels[1];
  if (!second) throw new Error('Missing second Class Level');
  await member.mutation(api.characterSheet.deleteClassLevel, {
    ...vessa.scope,
    entryId: second._id,
    operationId: 'delete-level',
  });
  expect(featureRows(await vessa.read(owner), id)[parentKey]).toMatchObject({
    ...saved,
    dormant: true,
    reason: { kind: 'sourceMissing' },
    entry: { ...saved.entry, _id: grantId },
  });

  // Regaining the level brings back the same Grant with its state.
  await vessa.addLevel();
  expect(featureRows(await vessa.read(owner), id)[parentKey]).toMatchObject({
    ...saved,
    entry: { ...saved.entry, _id: grantId },
  });
  await member.mutation(api.characterSheet.editGrantState, {
    ...vessa.scope,
    grantKey: parent,
    state: { active: true },
    operationId: 'grant-on',
  });
  expect(featureRows(await vessa.read(), id)[parentKey]).toMatchObject({
    counting: true,
    entry: { _id: grantId, active: true, notes: 'Table note' },
  });
  await expect(
    outsider.mutation(api.characterSheet.editGrantState, {
      ...vessa.scope,
      grantKey: parent,
      state: { notes: 'Intruder' },
      operationId: 'outsider-state',
    }),
  ).rejects.toThrow('You do not have access to this org');
});

test('an Archetype replacing the feature whole replaces its increments; a part replacement replaces only that level', async () => {
  const { id, character, member } = await fixture();
  const vessa = await character('Vessa', classKey);
  for (let level = 2; level <= 10; level += 1) await vessa.addLevel();
  const select = (key: string, selected: boolean) =>
    member.mutation(api.characterSheet.setArchetypeSelected, {
      ...vessa.scope,
      classEntryId: vessa.classEntryId,
      catalogEntryId: id(key),
      selected,
      operationId: `${key}-${String(selected)}`,
    });
  /** Each feature's counting flag and dormancy reason. */
  const states = async () =>
    Object.fromEntries(
      Object.entries(featureRows(await vessa.read(), id)).map(([key, row]) => [
        key,
        { counting: row.counting, reason: row.reason?.kind ?? null },
      ]),
    );
  const counting = { counting: true, reason: null };
  const replaced = { counting: false, reason: 'replaced' };

  await select(wholeKey, true);
  expect(await states()).toEqual({
    [parentKey]: replaced,
    [sixthKey]: replaced,
    [tenthKey]: replaced,
  });
  await select(wholeKey, false);
  expect(await states()).toEqual({
    [parentKey]: counting,
    [sixthKey]: counting,
    [tenthKey]: counting,
  });
  await select(partKey, true);
  expect(await states()).toEqual({
    [parentKey]: counting,
    [sixthKey]: replaced,
    [tenthKey]: counting,
  });
});
