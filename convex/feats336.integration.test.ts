/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { heldFeatDefinition } from '../tests/fixtures/feats-336/sheet';
import review from '../scripts/catalog/legal/feats-336.json';
import { calculateCharacterSheetPreview } from '../src/components/character-sheet/calculate-character-sheet-preview';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

test('isolated held feat mechanics survive shared saved edits and match the catalog preview with scoped access', async () => {
  const t = convexTest(schema, modules);
  const { campaignId, wrongCampaignId } = await t.run(async (ctx) => {
    for (const [name, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `feat336|${name}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated held feats #336',
      description: '',
      organizationId: 'org',
      ownerId: 'feat336|owner',
      e2eFixture: {
        namespace: 'feats-336',
        version: 1,
        workerKey: '0',
        caseKey: 'held',
        campaignKey: 'held',
      },
    });
    const wrongCampaignId = await ctx.db.insert('campaign', {
      name: 'Other isolated campaign',
      description: '',
      organizationId: 'org',
      ownerId: 'feat336|owner',
    });
    return { campaignId, wrongCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'feat336|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'feat336|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'feat336|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Held-content mechanics preview',
    kind: 'pc',
    operationId: 'create-feats-336',
  });
  const scope = { organizationId: 'org', campaignId, characterId };
  const seaLegs = heldFeatDefinition('Sea Legs');
  const reachDefense = heldFeatDefinition('Reach Defense');
  for (const definition of [seaLegs, reachDefense])
    expect(
      review.candidates.find(
        (row) => row.externalKey === definition.ruleIdentity,
      ),
    ).toMatchObject({ disposition: 'held', assessmentStatus: 'unresolved' });

  // Only convex-test's empty database receives these Character-scoped bodies.
  // Their held assessments remain unchanged; no Catalog Release is created.
  const [seaLegsId, reachDefenseId] = await t.run(async (ctx) => {
    const ids = [];
    for (const definition of [seaLegs, reachDefense])
      ids.push(
        await ctx.db.insert('catalogEntry', {
          scope: 'character',
          characterId,
          ...definition,
          stacksWithItself: false,
        }),
      );
    return ids;
  });
  if (!seaLegsId || !reachDefenseId)
    throw new Error('Missing held fixture IDs');
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const level = initial?.entries.find((row) => row.kind === 'classLevel');
  const fighter = initial?.catalogEntries.find(
    (row) => row.detail?.kind === 'class' && row.name === 'Fighter',
  );
  if (!level || !fighter) throw new Error('Missing baseline Fighter');
  await member.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: fighter._id,
    hpGained: 10,
    operationId: 'fighter-baseline',
  });
  await member.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    operationId: 'scores-baseline',
  });
  const selectionId = await member.mutation(
    api.characterSheet.fillSelectionSlot,
    {
      ...scope,
      slotId: 'feat:general',
      position: 0,
      catalogEntryId: seaLegsId,
      operationId: 'select-held-sea-legs',
    },
  );
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!saved) throw new Error('Missing saved Sea Legs sheet');
  expect(
    saved.catalogEntries.find((row) => row._id === seaLegsId),
  ).toMatchObject(seaLegs);
  for (const projection of [saved.calculated, saved.permanentCalculated])
    for (const target of ['skill.acr', 'skill.clm', 'skill.swm'] as const)
      expect(projection.breakdowns[target].total).toBe(2);
  expect(calculateCharacterSheetPreview(saved).skills).toEqual(
    saved.calculated.skills,
  );
  expect(
    (await member.query(api.catalogCopies.list, scope)).find(
      (row) => row._id === seaLegsId,
    ),
  ).toMatchObject(seaLegs);
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectionId,
    active: false,
    operationId: 'deactivate-sea-legs',
  });
  const inactive = await owner.query(api.characterSheet.read, scope);
  for (const target of ['skill.acr', 'skill.clm', 'skill.swm'] as const)
    expect(inactive?.calculated.breakdowns[target].total).toBe(0);

  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectionId,
    catalogEntryId: reachDefenseId,
    active: true,
    operationId: 'replace-with-reach-defense',
  });
  const reachSaved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!reachSaved) throw new Error('Missing Reach Defense sheet');
  for (const projection of [
    reachSaved.calculated,
    reachSaved.permanentCalculated,
  ])
    expect(projection.derivedStatistics.ac.total).toBe(10);
  expect(calculateCharacterSheetPreview(reachSaved).derivedStatistics).toEqual(
    reachSaved.calculated.derivedStatistics,
  );
  const situation = reachDefense.modifiers.find((row) => row.target === 'ac')
    ?.condition?.situation;
  if (typeof situation !== 'object' || !('local' in situation))
    throw new Error('Missing nonadjacent attack-of-opportunity Situation');
  const options = { situations: [{ ...situation, sheetEntryId: selectionId }] };
  const preview = calculateCharacterSheetPreview(reachSaved, {}, options);
  expect(preview.derivedStatistics.ac.total).toBe(12);
  expect(preview.derivedStatistics.touchAc.total).toBe(12);
  expect(preview.derivedStatistics.flatFootedAc.total).toBe(10);
  expect(
    calculateCharacterSheetPreview(
      reachSaved,
      {},
      {
        situations: [{ ...situation, sheetEntryId: 'another-entry' }],
      },
    ).derivedStatistics.ac.total,
  ).toBe(10);
  expect(
    (await member.query(api.characterSheet.read, scope))?.calculated
      .derivedStatistics.ac.total,
  ).toBe(10);
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectionId,
    active: false,
    operationId: 'deactivate-reach-defense',
  });
  const reachInactive = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!reachInactive) throw new Error('Missing inactive Reach Defense sheet');
  expect(
    calculateCharacterSheetPreview(reachInactive, {}, options).derivedStatistics
      .ac.total,
  ).toBe(10);

  const otherCharacterId = await member.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Other isolated Character',
    kind: 'pc',
    operationId: 'create-other-character',
  });
  const otherScope = { ...scope, characterId: otherCharacterId };
  expect(
    (await member.query(api.catalogCopies.list, otherScope)).some(
      (row) => row._id === seaLegsId || row._id === reachDefenseId,
    ),
  ).toBe(false);
  await expect(
    member.mutation(api.characterSheet.fillSelectionSlot, {
      ...otherScope,
      slotId: 'feat:general',
      position: 0,
      catalogEntryId: reachDefenseId,
      operationId: 'other-character-definition-refused',
    }),
  ).rejects.toThrow();

  await expect(
    member.query(api.characterSheet.read, {
      ...scope,
      campaignId: wrongCampaignId,
    }),
  ).rejects.toThrow();
  await expect(
    member.query(api.catalogCopies.list, {
      ...scope,
      campaignId: wrongCampaignId,
    }),
  ).rejects.toThrow();
  await expect(
    member.mutation(api.characterSheet.editSelection, {
      ...scope,
      campaignId: wrongCampaignId,
      entryId: selectionId,
      active: true,
      operationId: 'wrong-campaign-refused',
    }),
  ).rejects.toThrow();
  await expect(t.query(api.characterSheet.read, scope)).rejects.toThrow();
  await expect(
    outsider.query(api.characterSheet.read, scope),
  ).rejects.toThrow();
  await expect(outsider.query(api.catalogCopies.list, scope)).rejects.toThrow();
  await expect(
    outsider.mutation(api.characterSheet.editSelection, {
      ...scope,
      entryId: selectionId,
      active: true,
      operationId: 'outsider-refused',
    }),
  ).rejects.toThrow();
  expect(
    (await owner.query(api.characterSheet.read, scope))?.entries.find(
      (row) => row._id === selectionId,
    ),
  ).toMatchObject({ active: false, catalogEntryId: reachDefenseId });
});
