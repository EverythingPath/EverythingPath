/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { reviewedFeatDefinition } from '../tests/fixtures/feats-341/sheet';
import review from '../scripts/catalog/legal/feats-341.json';
import { calculateCharacterSheetPreview } from '../src/components/character-sheet/calculate-character-sheet-preview';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

test('isolated reviewed mechanics agree with saved-sheet/catalog previews and preserve scope authorization', async () => {
  const t = convexTest(schema, modules);
  const { campaignId, wrongCampaignId } = await t.run(async (ctx) => {
    for (const [name, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `feat341|${name}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed feats #341',
      description: '',
      organizationId: 'org',
      ownerId: 'feat341|owner',
      e2eFixture: {
        namespace: 'feats-341',
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
      ownerId: 'feat341|owner',
    });
    return { campaignId, wrongCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'feat341|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'feat341|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'feat341|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed mechanics preview',
    kind: 'pc',
    operationId: 'create-feats-341',
  });
  const scope = { organizationId: 'org', campaignId, characterId };
  const stealth = reviewedFeatDefinition('Stealthy (Mythic)');
  const crane = reviewedFeatDefinition('Crane Style');
  for (const definition of [stealth, crane])
    expect(
      review.candidates.find(
        (row) => row.externalKey === definition.ruleIdentity,
      ),
    ).toMatchObject({ disposition: 'held', assessmentStatus: 'unresolved' });
  // Character-scoped in-memory definitions demonstrate the real reviewed bodies.
  // No global admission or Catalog Release is fabricated for held attribution.
  const [stealthId, craneId] = await t.run(async (ctx) => {
    const ids = [];
    for (const definition of [stealth, crane])
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
  if (!stealthId || !craneId) throw new Error('Missing isolated fixture IDs');
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
    operationId: 'baseline-scores',
  });
  const selectionId = await member.mutation(
    api.characterSheet.fillSelectionSlot,
    {
      ...scope,
      slotId: 'feat:general',
      position: 0,
      catalogEntryId: stealthId,
      operationId: 'select-stealth',
    },
  );
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!saved) throw new Error('Missing saved sheet');
  for (const projection of [saved.calculated, saved.permanentCalculated]) {
    expect(projection.derivedStatistics.will.total).toBe(2);
    expect(projection.breakdowns['skill.esc'].total).toBe(2);
    expect(projection.breakdowns['skill.ste'].total).toBe(2);
  }
  expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
    saved.calculated.derivedStatistics,
  );
  expect(
    calculateCharacterSheetPreview(saved).breakdowns['skill.ste'].total,
  ).toBe(2);
  expect(
    (await member.query(api.catalogCopies.list, scope)).find(
      (row) => row._id === stealthId,
    ),
  ).toMatchObject(stealth);
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectionId,
    active: false,
    operationId: 'deactivate-stealth',
  });
  const inactive = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!inactive) throw new Error('Missing inactive sheet');
  expect(inactive.calculated.breakdowns['skill.ste'].total).toBe(0);
  expect(
    calculateCharacterSheetPreview(inactive).breakdowns['skill.ste'].total,
  ).toBe(0);
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectionId,
    catalogEntryId: craneId,
    active: true,
    operationId: 'replace-with-crane',
  });
  const craneSaved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!craneSaved) throw new Error('Missing Crane Style sheet');
  const situation = crane.modifiers.find((row) => row.target === 'ac.other')
    ?.condition?.situation;
  if (typeof situation !== 'object' || !('local' in situation))
    throw new Error('Missing Crane Style Situation');
  const scoped = { ...situation, sheetEntryId: selectionId };
  expect(craneSaved.calculated.breakdowns['ac.other'].total).toBe(0);
  expect(
    calculateCharacterSheetPreview(craneSaved, {}, { situations: [scoped] })
      .breakdowns['ac.other'].total,
  ).toBe(1);
  expect(
    calculateCharacterSheetPreview(
      craneSaved,
      {},
      { situations: ['fighting-defensively'] },
    ).breakdowns['ac.other'].total,
  ).toBe(0);
  expect(
    calculateCharacterSheetPreview(
      craneSaved,
      {},
      {
        situations: [{ ...scoped, sheetEntryId: 'other-selection' }],
      },
    ).breakdowns['ac.other'].total,
  ).toBe(0);
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectionId,
    active: false,
    operationId: 'deactivate-crane',
  });
  const craneInactive = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!craneInactive) throw new Error('Missing inactive Crane Style sheet');
  expect(
    calculateCharacterSheetPreview(craneInactive, {}, { situations: [scoped] })
      .breakdowns['ac.other'].total,
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
  ).toMatchObject({ active: false, catalogEntryId: craneId });
});
