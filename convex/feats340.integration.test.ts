/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { reviewedFeatDefinition } from '../tests/fixtures/feats-340/sheet';
import review from '../scripts/catalog/legal/feats-340.json';
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
        tokenIdentifier: `feat340|${name}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed feats #340',
      description: '',
      organizationId: 'org',
      ownerId: 'feat340|owner',
      e2eFixture: {
        namespace: 'feats-340',
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
      ownerId: 'feat340|owner',
    });
    return { campaignId, wrongCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'feat340|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'feat340|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'feat340|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed mechanics preview',
    kind: 'pc',
    operationId: 'create-feats-340',
  });
  const scope = { organizationId: 'org', campaignId, characterId };
  const focus = reviewedFeatDefinition('Skill Focus (Knowledge [Local])');
  const horse = reviewedFeatDefinition('Horse Whisperer');
  expect(
    review.candidates.find((row) => row.externalKey === focus.ruleIdentity),
  ).toMatchObject({
    disposition: 'admitted',
    assessmentStatus: 'confirmed',
  });
  expect(
    review.candidates.find((row) => row.externalKey === horse.ruleIdentity),
  ).toMatchObject({ disposition: 'held', assessmentStatus: 'unresolved' });
  // Test-only character definitions keep real reviewed mechanics and identity.
  // They never publish global content or lift an Attribution Assessment.
  const [focusId, horseId] = await t.run(async (ctx) => {
    const ids = [];
    for (const definition of [focus, horse])
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
  if (!focusId || !horseId) throw new Error('Missing isolated fixture IDs');
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
    operationId: 'focus-scores',
  });
  const selectionId = await member.mutation(
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
  for (const projection of [saved.calculated, saved.permanentCalculated]) {
    expect(projection.derivedStatistics.will.total).toBe(2);
    // #724: no Knowledge (local) ranks, so Skill Focus adds +3 with nothing selected.
    expect(projection.breakdowns['skill.klo'].total).toBe(3);
  }
  expect(focus.modifiers).toEqual([
    {
      target: 'skill.klo',
      bonusType: 'untyped',
      value: { formula: '3 + 3 * min(1, floor(@skillRanks.klo / 10))' },
    },
  ]);
  expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
    saved.calculated.derivedStatistics,
  );
  expect(
    calculateCharacterSheetPreview(saved).breakdowns['skill.klo'].total,
  ).toBe(3);
  expect(
    (await member.query(api.catalogCopies.list, scope)).find(
      (row) => row._id === focusId,
    ),
  ).toMatchObject(focus);
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectionId,
    active: false,
    operationId: 'deactivate-focus',
  });
  const inactive = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!inactive) throw new Error('Missing inactive sheet');
  expect(inactive.calculated.breakdowns['skill.klo'].total).toBe(0);
  expect(
    calculateCharacterSheetPreview(inactive).breakdowns['skill.klo'].total,
  ).toBe(0);
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectionId,
    catalogEntryId: horseId,
    active: true,
    operationId: 'replace-with-horse',
  });
  const horseSaved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!horseSaved) throw new Error('Missing Horse Whisperer sheet');
  expect(calculateCharacterSheetPreview(horseSaved).derivedStatistics).toEqual(
    horseSaved.calculated.derivedStatistics,
  );
  const horseSituation = horse.modifiers.find(
    (row) => row.target === 'skill.han',
  )?.condition?.situation;
  if (typeof horseSituation !== 'object' || !('local' in horseSituation))
    throw new Error('Missing horse-handling Situation');
  const scopedHorse = { ...horseSituation, sheetEntryId: selectionId };
  expect(horseSaved.calculated.breakdowns['skill.han'].total).toBe(0);
  expect(
    calculateCharacterSheetPreview(
      horseSaved,
      {},
      { situations: [scopedHorse] },
    ).breakdowns['skill.han'].total,
  ).toBe(2);
  expect(
    calculateCharacterSheetPreview(horseSaved, {}, { situations: ['charging'] })
      .breakdowns['skill.han'].total,
  ).toBe(0);
  expect(
    calculateCharacterSheetPreview(
      horseSaved,
      {},
      {
        situations: [{ ...scopedHorse, sheetEntryId: 'another-selection' }],
      },
    ).breakdowns['skill.han'].total,
  ).toBe(0);
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectionId,
    active: false,
    operationId: 'deactivate-horse',
  });
  const horseInactive = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!horseInactive) throw new Error('Missing inactive Horse Whisperer sheet');
  expect(
    calculateCharacterSheetPreview(
      horseInactive,
      {},
      { situations: [scopedHorse] },
    ).breakdowns['skill.han'].total,
  ).toBe(0);
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
  ).toMatchObject({ active: false, catalogEntryId: horseId });
});
