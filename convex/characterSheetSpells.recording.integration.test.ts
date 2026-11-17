// @vitest-environment edge-runtime
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { convexTest } from 'convex-test';
import { afterEach, expect, test, vi } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');
afterEach(() => vi.useRealTimers());

async function demoCharacter() {
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  await t.run((ctx) =>
    ctx.db.insert('user', {
      tokenIdentifier: 'owner',
      orgIds: [],
      characterSheetDemo: true,
    }),
  );
  const owner = t.withIdentity({ tokenIdentifier: 'owner' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    name: 'Prepared caster',
    kind: 'pc',
    operationId: 'create-caster',
  });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  return { t, owner, scope: { characterId } };
}

test('a prepared demo Character can browse and record imported Spells without installing a test catalog', async () => {
  const { owner, scope } = await demoCharacter();
  const sheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const wizard = sheet?.catalogEntries.find((entry) => entry.name === 'Wizard');
  const classLevel = sheet?.entries.find(
    (entry) => entry.kind === 'classLevel',
  );
  if (!wizard || !classLevel) throw new Error('Missing representative Wizard');
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: classLevel._id,
    classEntryId: wizard._id,
    operationId: 'wizard',
  });
  const browser = await owner.query(api.characterSheetSpells.browse, {
    ...scope,
    castingClassId: wizard._id,
    spellLevel: 3,
    search: 'Haste',
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(browser.page.map((spell) => spell.name)).toContain('Haste');
  const spell = browser.page.find((spell) => spell.name === 'Haste');
  if (!spell) throw new Error('Missing imported Haste');
  const entryId = await owner.mutation(api.characterSheetSpells.record, {
    ...scope,
    castingClassId: wizard._id,
    catalogEntryId: spell.catalogEntryId,
    operationId: 'record-haste',
  });
  const recorded = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(
    recorded?.entries.find((entry) => entry._id === entryId),
  ).toMatchObject({
    kind: 'spell',
    state: { castingClassId: wizard._id, level: 3 },
  });
  expect(recorded?.calculated.spellCollections.collections).toMatchObject([
    { heading: 'Spellbook', spells: [{ name: 'Haste', spellLevel: 3 }] },
  ]);
  expect(recorded?.calculated.derivedStatistics.ac.total).toBe(10);
});

test.each([
  {
    className: 'Sorcerer',
    record: 'known',
    heading: 'Spells known',
    offList: false,
  },
  {
    className: 'Alchemist',
    record: 'book',
    heading: 'Formula book',
    offList: false,
  },
  { className: 'Witch', record: 'book', heading: 'Familiar', offList: true },
])(
  'a representative $className records its $heading through the public sheet interface',
  async ({ className, record, heading, offList }) => {
    const { owner, scope } = await demoCharacter();
    const sheet = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    const castingClass = sheet?.catalogEntries.find(
      (entry) => entry.name === className,
    );
    const classLevel = sheet?.entries.find(
      (entry) => entry.kind === 'classLevel',
    );
    if (!castingClass || !classLevel)
      throw new Error(`Missing representative ${className}`);
    await owner.mutation(api.characterSheet.editClassLevel, {
      ...scope,
      entryId: classLevel._id,
      classEntryId: castingClass._id,
      operationId: className,
    });
    const browser = await owner.query(api.characterSheetSpells.browse, {
      ...scope,
      castingClassId: castingClass._id,
      spellLevel: 3,
      search: 'Haste',
      includeOtherLists: offList,
      paginationOpts: { numItems: 10, cursor: null },
    });
    const spell = browser.page.find((spell) => spell.name === 'Haste');
    if (!spell) throw new Error(`Missing imported Haste for ${className}`);
    const entryId = await owner.mutation(api.characterSheetSpells.record, {
      ...scope,
      castingClassId: castingClass._id,
      catalogEntryId: spell.catalogEntryId,
      ...(offList ? { level: 3 } : {}),
      operationId: 'record-collection',
    });
    const recorded = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    expect(recorded?.calculated.spellCollections.collections).toMatchObject([
      {
        classEntryId: castingClass._id,
        record,
        heading,
        spells: [
          {
            entryId,
            classEntryId: castingClass._id,
            name: 'Haste',
            spellLevel: 3,
            offList,
          },
        ],
      },
    ]);
  },
);
