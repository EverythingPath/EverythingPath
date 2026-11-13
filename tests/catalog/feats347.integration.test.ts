/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { withSheetCatalog } from '../character-sheet-catalog';
import { reviewedFeatDefinition } from '../fixtures/feats-347/sheet';
import { review } from '../fixtures/feats-347/data';
import { calculateCharacterSheetPreview } from '../../src/components/character-sheet/calculate-character-sheet-preview';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';

const modules = import.meta.glob('../../convex/**/*.ts');

test('isolated saved held-body previews match the resolver and enforce campaign access', async () => {
  const name = 'Free Spirit';
  const target = 'save.will';
  const t = convexTest(schema, modules);
  const { campaignId, wrongCampaignId } = await t.run(async (ctx) => {
    for (const [user, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `feat347|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed feats #347',
      description: '',
      organizationId: 'org',
      ownerId: 'feat347|owner',
      e2eFixture: {
        namespace: 'feats-347',
        version: 1,
        workerKey: '0',
        caseKey: 'reviewed',
        campaignKey: 'reviewed',
      },
    });
    const wrongCampaignId = await ctx.db.insert('campaign', {
      name: 'Other isolated campaign',
      description: '',
      organizationId: 'org',
      ownerId: 'feat347|owner',
    });
    return { campaignId, wrongCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'feat347|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'feat347|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'feat347|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed feat preview',
    kind: 'pc',
    operationId: 'create-feats-347',
  });
  const scope = { organizationId: 'org', campaignId, characterId };
  const focus = reviewedFeatDefinition(name);
  const enemyCult = reviewedFeatDefinition('Enemy Cult');
  expect(
    review.candidates.find((row) => row.externalKey === focus.ruleIdentity)
      ?.disposition,
  ).toBe('held');
  expect(
    review.candidates.find((row) => row.externalKey === enemyCult.ruleIdentity)
      ?.disposition,
  ).toBe('held');
  // Both reviewed bodies remain held globally. Character-scoped isolated fixtures
  // exercise the public preview without constructing or publishing a Catalog Release.
  const { focusId, enemyCultId } = await t.run(async (ctx) => ({
    focusId: await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      ...focus,
      stacksWithItself: false,
    }),
    enemyCultId: await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      ...enemyCult,
      stacksWithItself: false,
    }),
  }));
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
    operationId: 'base-scores',
  });
  const selectedId = await member.mutation(
    api.characterSheet.fillSelectionSlot,
    {
      ...scope,
      slotId: 'feat:general',
      position: 0,
      catalogEntryId: focusId,
      operationId: 'select-focus',
    },
  );
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!saved) throw new Error('Missing saved sheet');
  expect(saved.calculated.breakdowns[target].total).toBe(0);
  expect(saved.permanentCalculated.breakdowns[target].total).toBe(0);
  expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
    saved.calculated.derivedStatistics,
  );
  expect(
    calculateCharacterSheetPreview(saved, {}, { situations: ['mindAffecting'] })
      .breakdowns[target].total,
  ).toBe(2);
  expect(
    (await member.query(api.catalogCopies.list, scope)).find(
      (row) => row._id === focusId,
    ),
  ).toMatchObject(focus);
  const staged = calculateCharacterSheetPreview(saved, {
    entries: saved.entries.map((row) =>
      row._id === selectedId ? { ...row, catalogEntryId: enemyCultId } : row,
    ),
  });
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectedId,
    catalogEntryId: enemyCultId,
    operationId: 'replace-with-disguise',
  });
  const enemyCultSaved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!enemyCultSaved) throw new Error('Missing Enemy Cult sheet');
  expect(staged.derivedStatistics).toEqual(
    enemyCultSaved.calculated.derivedStatistics,
  );
  const completion = enemyCult.modifiers[0]?.condition?.situation;
  if (typeof completion !== 'object' || !('local' in completion))
    throw new Error('Missing Story completion Situation');
  expect(enemyCultSaved.calculated.breakdowns['save.fort'].total).toBe(0);
  expect(
    calculateCharacterSheetPreview(
      enemyCultSaved,
      {},
      { situations: [{ ...completion, sheetEntryId: selectedId }] },
    ).breakdowns['save.fort'].total,
  ).toBe(2);
  expect(
    calculateCharacterSheetPreview(
      enemyCultSaved,
      {},
      {
        situations: [{ ...completion, sheetEntryId: 'other' }],
      },
    ).breakdowns['save.fort'].total,
  ).toBe(0);
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectedId,
    active: false,
    operationId: 'deactivate-disguise',
  });
  const inactive = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!inactive) throw new Error('Missing inactive sheet');
  expect(
    calculateCharacterSheetPreview(
      inactive,
      {},
      { situations: [{ ...completion, sheetEntryId: selectedId }] },
    ).breakdowns['save.fort'].total,
  ).toBe(0);
  const foreignId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId: wrongCampaignId,
      ...enemyCult,
      stacksWithItself: false,
    }),
  );
  await expect(
    member.mutation(api.characterSheet.editSelection, {
      ...scope,
      entryId: selectedId,
      catalogEntryId: foreignId,
      active: true,
      operationId: 'foreign-definition',
    }),
  ).rejects.toThrow();
  await expect(
    member.query(api.characterSheet.read, {
      ...scope,
      campaignId: wrongCampaignId,
    }),
  ).rejects.toThrow();
  for (const actor of [t, outsider]) {
    await expect(actor.query(api.characterSheet.read, scope)).rejects.toThrow();
    await expect(actor.query(api.catalogCopies.list, scope)).rejects.toThrow();
    await expect(
      actor.mutation(api.characterSheet.editSelection, {
        ...scope,
        entryId: selectedId,
        active: true,
        operationId: 'denied-edit',
      }),
    ).rejects.toThrow();
  }
  expect(
    (await owner.query(api.characterSheet.read, scope))?.entries.find(
      (row) => row._id === selectedId,
    ),
  ).toMatchObject({ active: false, catalogEntryId: enemyCultId });
});
