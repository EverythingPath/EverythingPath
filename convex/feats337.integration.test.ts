/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { heldFeatDefinition } from '../tests/fixtures/feats-337/sheet';
import review from '../scripts/catalog/legal/feats-337.json';
import { calculateCharacterSheetPreview } from '../src/components/character-sheet/calculate-character-sheet-preview';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

test('isolated reviewed feat bodies agree with saved-sheet and catalog previews and enforce organization and campaign access', async () => {
  const t = convexTest(schema, modules);
  const { campaignId, wrongCampaignId } = await t.run(async (ctx) => {
    for (const [name, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `feat337|${name}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed feats #337',
      description: '',
      organizationId: 'org',
      ownerId: 'feat337|owner',
      e2eFixture: {
        namespace: 'feats-337',
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
      ownerId: 'feat337|owner',
    });
    return { campaignId, wrongCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'feat337|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'feat337|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'feat337|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed mechanics preview',
    kind: 'pc',
    operationId: 'create-feats-337',
  });
  const scope = { organizationId: 'org', campaignId, characterId };
  const scarred = heldFeatDefinition('Scarred Legion');
  const snake = heldFeatDefinition('Snake Sidewind');
  for (const definition of [scarred, snake])
    expect(
      review.candidates.find(
        (row) => row.externalKey === definition.ruleIdentity,
      ),
    ).toMatchObject({
      disposition: 'held',
      assessmentStatus: 'unresolved',
    });
  // Test-only character definitions keep real reviewed mechanics and identity.
  // They never publish global content or lift either Attribution Assessment.
  const [scarredId, snakeId] = await t.run(async (ctx) => {
    const ids = [];
    for (const definition of [scarred, snake])
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
  if (!scarredId || !snakeId) throw new Error('Missing isolated fixture IDs');
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
      wisdom: 14,
      charisma: 10,
    },
    operationId: 'scarred-scores',
  });
  const selectionId = await member.mutation(
    api.characterSheet.fillSelectionSlot,
    {
      ...scope,
      slotId: 'feat:general',
      position: 0,
      catalogEntryId: scarredId,
      operationId: 'select-scarred',
    },
  );
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!saved) throw new Error('Missing saved sheet');
  for (const projection of [saved.calculated, saved.permanentCalculated]) {
    expect(projection.derivedStatistics.will.total).toBe(2);
    expect(projection.breakdowns['skill.int'].total).toBe(2);
  }
  const adjacent = scarred.modifiers.find((row) => row.target === 'save.will')
    ?.condition?.situation;
  if (typeof adjacent !== 'object' || !('local' in adjacent))
    throw new Error('Missing adjacent ally Situation');
  expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
    saved.calculated.derivedStatistics,
  );
  expect(
    calculateCharacterSheetPreview(
      saved,
      {},
      { situations: [{ ...adjacent, sheetEntryId: selectionId }] },
    ).derivedStatistics.will.total,
  ).toBe(4);
  expect(
    calculateCharacterSheetPreview(saved, {}, { situations: ['charging'] })
      .derivedStatistics.will.total,
  ).toBe(2);
  expect(
    (await member.query(api.catalogCopies.list, scope)).find(
      (row) => row._id === scarredId,
    ),
  ).toMatchObject(scarred);
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectionId,
    active: false,
    operationId: 'deactivate-scarred',
  });
  const inactive = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!inactive) throw new Error('Missing inactive sheet');
  expect(inactive.calculated.breakdowns['skill.int'].total).toBe(0);
  expect(
    calculateCharacterSheetPreview(
      inactive,
      {},
      { situations: [{ ...adjacent, sheetEntryId: selectionId }] },
    ).derivedStatistics.will.total,
  ).toBe(2);
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectionId,
    catalogEntryId: snakeId,
    active: true,
    operationId: 'replace-with-snake',
  });
  const snakeSaved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!snakeSaved) throw new Error('Missing Snake Sidewind sheet');
  expect(calculateCharacterSheetPreview(snakeSaved).derivedStatistics).toEqual(
    snakeSaved.calculated.derivedStatistics,
  );
  const ordinaryCmd = snakeSaved.calculated.derivedStatistics.cmd.total;
  const defensiveTrip = snake.modifiers.find((row) => row.target === 'cmd')
    ?.condition?.situation;
  if (typeof defensiveTrip !== 'object' || !('local' in defensiveTrip))
    throw new Error('Missing defensive trip Situation');
  const tripSituation = { ...defensiveTrip, sheetEntryId: selectionId };
  expect(
    calculateCharacterSheetPreview(
      snakeSaved,
      {},
      { situations: [tripSituation] },
    ).derivedStatistics.cmd.total,
  ).toBe(ordinaryCmd + 4);
  expect(
    calculateCharacterSheetPreview(snakeSaved, {}, { situations: ['bullRush'] })
      .derivedStatistics.cmd.total,
  ).toBe(ordinaryCmd);
  expect(
    calculateCharacterSheetPreview(snakeSaved, {}, { situations: ['trip'] })
      .derivedStatistics.cmd.total,
  ).toBe(ordinaryCmd);
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectionId,
    active: false,
    operationId: 'deactivate-snake',
  });
  const snakeInactive = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!snakeInactive) throw new Error('Missing inactive Snake Sidewind sheet');
  expect(
    calculateCharacterSheetPreview(
      snakeInactive,
      {},
      { situations: [tripSituation] },
    ).derivedStatistics.cmd.total,
  ).toBe(ordinaryCmd);
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
      operationId: 'wrong-campaign',
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
      operationId: 'outsider',
    }),
  ).rejects.toThrow();
  expect(
    (await owner.query(api.characterSheet.read, scope))?.entries.find(
      (row) => row._id === selectionId,
    ),
  ).toMatchObject({ active: false, catalogEntryId: snakeId });
});
