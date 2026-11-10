// @vitest-environment edge-runtime
import { expect, test } from 'vitest';
import { releaseFixture } from '../tests/catalog-release-fixture';
import {
  installReleasedBodies,
  readSavedSheet,
} from '../tests/released-catalog-entries';
import {
  bodies,
  classKey,
  everyLevelClassKey,
  everyLevelParentKey,
  everyLevelRows,
  featureKeys,
  levelOf,
  otherClassKey,
  parentKey,
  partKey,
  readThrough,
  sharedClassKey,
  sixthKey,
  tenthKey,
  wholeKey,
} from '../tests/feature-grants-proof';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';

const modules = import.meta.glob('./**/*.ts');

// The class-feature level-grant family's public proof
// (`scripts/catalog/launch-mechanism-proofs.ts`, `class-feature-level-grants`):
// an imported class's `featuresByLevel` names a feature and its reviewed
// schedule increments by stable key, a Catalog Release resolves each key to
// its Catalog Entry, and the sheet grants each as a Grant of that class at
// exactly its class level. The bodies are a synthetic fixture shaped as
// imported (`tests/feature-grants-proof.ts`, which the registry binds): a
// class listing a parent at 2nd level and two increments at 6th and 10th, a
// second class listing none of them, two Archetypes, one replacing the parent
// whole and one replacing the 6th-level part, and a class listing a parent at
// 1st with an increment at every later level to 20th, which another class
// lists at 1st too. Each class is read at every class level to its
// `readThrough`. Every read and write the test makes is public.
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
type Sheet = Awaited<ReturnType<typeof readSavedSheet>>;
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
  await installReleasedBodies(t, bodies, id);

  /** A Character with a first Class Level of the class, and its sheet. */
  async function character(name: string, classEntryKey: string) {
    const characterId =
      name === 'Vessa' ? scope.characterId : await create(name);
    const own = { organizationId: 'org', characterId };
    const read = (viewer: Viewer = member) => readSavedSheet(viewer, own);
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
    /** Adds a Class Level of this class, or of another one. */
    const addLevel = (levelClassKey = classEntryKey) =>
      member.mutation(api.characterSheet.addClassLevel, {
        ...own,
        classEntryId: id(levelClassKey),
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
  for (let level = 1; level <= (readThrough[classKey] ?? 0); level += 1) {
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
  for (let level = 2; level <= (readThrough[otherClassKey] ?? 0); level += 1)
    await ilsa.addLevel();
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

test('a feature listed at 1st with an increment at every later level is a Grant of its class at each class level to 20th, and a second listing class grants it as its own', async () => {
  const { id, character } = await fixture();
  const rowKeys = everyLevelRows.map(({ key }) => key);
  /** The every-level rows that count, each with its Grant Key. */
  const counting = (sheet: Sheet) =>
    sheet.calculated.resolvedEntries.flatMap(({ entry, counting, origin }) => {
      if (entry.kind !== 'classFeature' || !counting || origin !== 'grant')
        return [];
      const { catalogEntryId } = entry;
      return 'grantKey' in entry &&
        entry.grantKey &&
        rowKeys.some((key) => id(key) === catalogEntryId)
        ? [entry.grantKey]
        : [];
    });
  const lena = await character('Lena', everyLevelClassKey);
  for (
    let level = 1;
    level <= (readThrough[everyLevelClassKey] ?? 0);
    level += 1
  ) {
    if (level > 1) await lena.addLevel();
    expect(counting(await lena.read()), `level ${level}`).toEqual(
      everyLevelRows
        .filter(({ classLevel }) => classLevel <= level)
        .map(({ classLevel, key }) => ({
          source: everyLevelClassKey,
          classLevel,
          entry: key,
        })),
    );
  }

  // A Shared 1 / Every Level 1 has the parent once through each class, each
  // a Grant of its own class at its 1st level.
  const mara = await character('Mara', sharedClassKey);
  await mara.addLevel(everyLevelClassKey);
  expect(
    counting(await mara.read()).sort((left, right) =>
      left.source.localeCompare(right.source),
    ),
  ).toEqual(
    [
      { source: everyLevelClassKey, classLevel: 1, entry: everyLevelParentKey },
      { source: sharedClassKey, classLevel: 1, entry: everyLevelParentKey },
    ].sort((left, right) => left.source.localeCompare(right.source)),
  );
});
