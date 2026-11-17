// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { featFixtureDefinition } from '../tests/fixtures/feats-330/sheet';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

test('an isolated admitted Lightning Reflexes definition survives shared saved-sheet edits and public reads', async () => {
  const t = convexTest(schema, modules);
  const campaignId = await t.run(async (ctx) => {
    for (const [name, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `test|${name}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    return ctx.db.insert('campaign', {
      name: 'Isolated feats #330',
      description: '',
      organizationId: 'org',
      ownerId: 'test|owner',
      e2eFixture: {
        namespace: 'feats-330',
        version: 1,
        workerKey: '0',
        caseKey: 'curation',
        campaignKey: 'curation',
      },
    });
  });
  const owner = t.withIdentity({ tokenIdentifier: 'test|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'test|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'test|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reflex curation fixture',
    kind: 'pc',
    operationId: 'create-feats-330',
  });
  const scope = { organizationId: 'org', campaignId, characterId };
  // Fixture-only materialization preserves the imported identity and numbers.
  // The narrower runtime body omits repeatable:unreviewed; no inferred 'no' or
  // permanent release metadata is supplied by this adapter.
  const definition = featFixtureDefinition('Lightning Reflexes');
  const featId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      ...definition,
      stacksWithItself: false,
    }),
  );
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const level = initial?.entries.find((entry) => entry.kind === 'classLevel');
  const fighter = initial?.catalogEntries.find(
    (entry) => entry.detail?.kind === 'class' && entry.name === 'Fighter',
  );
  if (!level || !fighter)
    throw new Error('Missing isolated baseline Class Level');
  await member.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: fighter._id,
    hpGained: 10,
    operationId: 'fighter-baseline',
  });
  await member.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: { dexterity: 14 },
    operationId: 'dex-14',
  });
  const before = await owner.query(api.characterSheet.read, scope);
  expect(before?.calculated.derivedStatistics.reflex.total).toBe(2); // Fighter 1 +0, Dex +2.
  const selectionId = await member.mutation(
    api.characterSheet.fillSelectionSlot,
    {
      ...scope,
      slotId: 'feat:general',
      position: 0,
      catalogEntryId: featId,
      operationId: 'choose-reviewed-reflexes',
    },
  );
  const selected = await owner.query(api.characterSheet.read, scope);
  expect(
    selected?.entries.find((entry) => entry._id === selectionId),
  ).toMatchObject({ active: true, kind: 'feat', catalogEntryId: featId });
  for (const projection of [
    selected?.calculated,
    selected?.permanentCalculated,
  ]) {
    expect(projection?.derivedStatistics.reflex.total).toBe(4);
    expect(projection?.derivedStatistics.reflex.applied).toContainEqual(
      expect.objectContaining({
        sheetEntryId: selectionId,
        source: 'pf1/0bZf3SDkvVOe2ujH',
        value: 2,
      }),
    );
  }
  const observed = await member.query(api.characterSheet.read, scope);
  expect(observed?.calculated.derivedStatistics.reflex.total).toBe(4);
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectionId,
    active: false,
    operationId: 'switch-off-reviewed-reflexes',
  });
  const inactive = await owner.query(api.characterSheet.read, scope);
  expect(inactive?.calculated.derivedStatistics.reflex.total).toBe(2);
  expect(inactive?.permanentCalculated.derivedStatistics.reflex.total).toBe(2);
  expect(
    inactive?.entries.find((entry) => entry._id === selectionId),
  ).toMatchObject({ active: false, catalogEntryId: featId });
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectionId,
    active: true,
    operationId: 'restore-reviewed-reflexes',
  });
  expect(
    (await owner.query(api.characterSheet.read, scope))?.calculated
      .derivedStatistics.reflex.total,
  ).toBe(4);
  await expect(
    outsider.query(api.characterSheet.read, scope),
  ).rejects.toThrow();
  await expect(
    outsider.mutation(api.characterSheet.editSelection, {
      ...scope,
      entryId: selectionId,
      active: false,
      operationId: 'outsider-refused',
    }),
  ).rejects.toThrow();
  expect(
    (await owner.query(api.characterSheet.read, scope))?.calculated
      .derivedStatistics.reflex.total,
  ).toBe(4);
});
