/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { heldFeatDefinition } from '../tests/fixtures/feats-334/sheet';
import review from '../scripts/catalog/legal/feats-334.json';
import { calculateCharacterSheetPreview } from '../src/components/character-sheet/calculate-character-sheet-preview';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

test('isolated held-feat bodies survive shared saved edits and agree with the application catalog preview', async () => {
  const t = convexTest(schema, modules);
  const { campaignId, wrongCampaignId } = await t.run(async (ctx) => {
    for (const [name, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `feat334|${name}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated held feats #334',
      description: '',
      organizationId: 'org',
      ownerId: 'feat334|owner',
      e2eFixture: {
        namespace: 'feats-334',
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
      ownerId: 'feat334|owner',
    });
    return { campaignId, wrongCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'feat334|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'feat334|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'feat334|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Held-content mechanics preview',
    kind: 'pc',
    operationId: 'create-feats-334',
  });
  const scope = { organizationId: 'org', campaignId, characterId };
  const storm = heldFeatDefinition('Storm-Lashed');
  const additional = heldFeatDefinition('Additional Traits');
  for (const definition of [storm, additional])
    expect(
      review.candidates.find(
        (row) => row.externalKey === definition.ruleIdentity,
      ),
    ).toMatchObject({ disposition: 'held', assessmentStatus: 'unresolved' });

  // Direct materialization is restricted to convex-test's empty database and
  // one Character. These bodies never become admitted global definitions.
  const [stormId, additionalId] = await t.run(async (ctx) => {
    const ids = [];
    for (const definition of [storm, additional])
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
  if (!stormId || !additionalId) throw new Error('Missing held fixture IDs');
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const level = initial?.entries.find((entry) => entry.kind === 'classLevel');
  const fighter = initial?.catalogEntries.find(
    (entry) => entry.detail?.kind === 'class' && entry.name === 'Fighter',
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
      constitution: 14,
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
      catalogEntryId: stormId,
      operationId: 'choose-isolated-held-storm',
    },
  );
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!saved) throw new Error('Missing isolated saved sheet');
  expect(saved.catalogEntries.find((row) => row._id === stormId)).toMatchObject(
    storm,
  );
  for (const projection of [saved.calculated, saved.permanentCalculated]) {
    expect(projection.derivedStatistics.fortitude.total).toBe(4);
    expect(projection.derivedStatistics.reflex.total).toBe(0);
    expect(projection.derivedStatistics.will.total).toBe(0);
  }
  expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
    saved.calculated.derivedStatistics,
  );
  const situation = storm.modifiers.find((row) => row.target === 'saves')
    ?.condition?.situation;
  if (typeof situation !== 'object' || !('local' in situation))
    throw new Error('Missing local electricity Situation');
  const options = {
    situations: [{ ...situation, sheetEntryId: selectionId }],
  };
  const conditional = calculateCharacterSheetPreview(saved, {}, options);
  expect(conditional.derivedStatistics.fortitude.total).toBe(6);
  expect(conditional.derivedStatistics.reflex.total).toBe(2);
  expect(conditional.derivedStatistics.will.total).toBe(2);
  expect(
    (await member.query(api.catalogCopies.list, scope)).find(
      (row) => row._id === stormId,
    ),
  ).toMatchObject(storm);
  expect(
    (await member.query(api.characterSheet.read, scope))?.calculated
      .derivedStatistics.fortitude.total,
  ).toBe(4);
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectionId,
    active: false,
    operationId: 'switch-off-held-storm',
  });
  const inactive = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!inactive) throw new Error('Missing inactive saved sheet');
  expect(
    calculateCharacterSheetPreview(inactive, {}, options).derivedStatistics
      .fortitude.total,
  ).toBe(4);

  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectionId,
    catalogEntryId: additionalId,
    active: true,
    operationId: 'choose-isolated-additional-traits',
  });
  const traits = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!traits) throw new Error('Missing Additional Traits saved sheet');
  for (const projection of [traits.calculated, traits.permanentCalculated])
    expect(projection.selectionRules.slots).toContainEqual(
      expect.objectContaining({
        kind: 'trait',
        count: 2,
        grantedBy: { kind: 'entry', entryId: selectionId },
      }),
    );
  expect(calculateCharacterSheetPreview(traits).selectionRules).toEqual(
    traits.calculated.selectionRules,
  );
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectionId,
    active: false,
    operationId: 'switch-off-additional-traits',
  });
  expect(
    (
      await owner.query(api.characterSheet.read, scope)
    )?.calculated.selectionRules.slots.filter(
      (slot) => slot.kind === 'trait' && slot.grantedBy,
    ),
  ).toEqual([]);

  await expect(
    member.query(api.characterSheet.read, {
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
  ).toMatchObject({ active: false, catalogEntryId: additionalId });
});
