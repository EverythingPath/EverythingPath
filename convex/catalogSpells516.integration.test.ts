/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { spellFixture } from '../tests/fixtures/spells-516/sheet';
import { calculateCharacterSheetPreview } from '../src/components/character-sheet/calculate-character-sheet-preview';
import { api, internal } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

test('an isolated held Bull’s Strength records its real metadata without granting its running effect', async () => {
  const t = convexTest(schema, modules);
  const campaignId = await t.run(async (ctx) => {
    for (const [name, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `spell516|${name}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    return ctx.db.insert('campaign', {
      name: 'Isolated held Spells #516',
      description: '',
      organizationId: 'org',
      ownerId: 'spell516|owner',
      e2eFixture: {
        namespace: 'spells-516',
        version: 1,
        workerKey: '0',
        caseKey: 'held',
        campaignKey: 'held',
      },
    });
  });
  const owner = t.withIdentity({ tokenIdentifier: 'spell516|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'spell516|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'spell516|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Source-backed Spell collection preview',
    kind: 'pc',
    operationId: 'create-spells-516',
  });
  const scope = { organizationId: 'org', campaignId, characterId };
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const level = initial?.entries.find((entry) => entry.kind === 'classLevel');
  const wizard = initial?.catalogEntries.find(
    (entry) => entry.name === 'Wizard' && entry.detail.kind === 'class',
  );
  if (!level || !wizard) throw new Error('Missing isolated Wizard baseline');
  await member.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: wizard._id,
    operationId: 'wizard-baseline',
  });
  await member.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { strength: 10, intelligence: 14 },
    operationId: 'base-scores',
  });
  // This internal fixture writer installs only into convex-test's Character
  // catalog. It does not assert legal admission or publish a Catalog Release.
  const [spellId] = await owner.mutation(
    internal.characterSheetSpells.installPreparedCatalog,
    {
      ...scope,
      spells: [spellFixture("Bull's Strength")],
      operationId: 'isolated-spell-catalog',
    },
  );
  if (!spellId) throw new Error('Missing installed Spell fixture');
  const filters = { ...scope, castingClassId: wizard._id };
  const page = await member.query(api.characterSheetSpells.browse, {
    ...filters,
    spellLevel: 2,
    paginationOpts: { cursor: null, numItems: 25 },
  });
  expect(page.page).toContainEqual(
    expect.objectContaining({
      catalogEntryId: spellId,
      name: "Bull's Strength",
      spellLevel: 2,
      school: 'trs',
    }),
  );
  const spellEntryId = await member.mutation(api.characterSheetSpells.record, {
    ...filters,
    catalogEntryId: spellId,
    operationId: 'record-bulls-strength',
  });
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!saved) throw new Error('Missing isolated saved sheet');
  expect(
    saved.entries.find((entry) => entry._id === spellEntryId),
  ).toMatchObject({
    kind: 'spell',
    state: { kind: 'spell', castingClassId: wizard._id, level: 2 },
  });
  expect(
    saved.catalogEntries.find((entry) => entry._id === spellId),
  ).toMatchObject({
    ruleIdentity: 'pf1/05i5rxwim12hwktu',
    sources: [{ book: 'PZO1110', pages: '251' }],
    modifiers: [],
    detail: { kind: 'spell', levels: { wizard: 2, cleric: 2 }, school: 'trs' },
  });
  const collection = saved.calculated.spellCollections.collections.find(
    (row) => row.classEntryId === wizard._id,
  );
  expect(collection).toMatchObject({ heading: 'Spellbook' });
  expect(JSON.stringify(collection)).toContain(spellEntryId);
  expect(saved.calculated.abilities.strength.score).toBe(10);
  expect(saved.permanentCalculated.abilities.strength.score).toBe(10);
  expect(calculateCharacterSheetPreview(saved).abilities).toEqual(
    saved.calculated.abilities,
  );
  expect(
    (await member.query(api.characterSheet.read, scope))?.calculated.abilities,
  ).toEqual(saved.calculated.abilities);
  // A separate player-authored effect is a public-writer fixture, never an
  // imported or admitted Spell Effect. Its +4 is CRB p.251 / pinned prose.
  const effectId = await member.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: 'Isolated running Bull’s Strength',
    modifiers: [{ target: 'ability.str', bonusType: 'enhancement', value: 4 }],
    detail: {
      kind: 'spellEffect',
      spellKey: 'pf1/05i5rxwim12hwktu',
      defaultCasterLevel: 3,
      lastsOverOneDay: false,
    },
    operationId: 'separate-running-effect',
  });
  const running = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!running) throw new Error('Missing running-effect preview');
  expect(running.calculated.abilities.strength.score).toBe(14);
  expect(running.permanentCalculated.abilities.strength.score).toBe(10);
  expect(calculateCharacterSheetPreview(running).abilities).toEqual(
    running.calculated.abilities,
  );
  await member.mutation(api.characterSheet.editSheetEntry, {
    ...scope,
    entryId: effectId,
    active: false,
    operationId: 'stop-running-effect',
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.calculated.abilities
      .strength.score,
  ).toBe(10);
  await expect(
    outsider.query(api.characterSheet.read, scope),
  ).rejects.toThrow();
  await expect(
    outsider.query(api.characterSheetSpells.browse, {
      ...filters,
      paginationOpts: { cursor: null, numItems: 25 },
    }),
  ).rejects.toThrow();
  await expect(
    outsider.mutation(api.characterSheetSpells.remove, {
      ...scope,
      entryId: spellEntryId,
      operationId: 'outsider-refused',
    }),
  ).rejects.toThrow();
  expect(
    (await owner.query(api.characterSheet.read, scope))?.entries.some(
      (entry) => entry._id === spellEntryId,
    ),
  ).toBe(true);
});
