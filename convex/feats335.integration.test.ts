/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { heldFeatDefinition } from '../tests/fixtures/feats-335/sheet';
import review from '../scripts/catalog/legal/feats-335.json';
import { calculateCharacterSheetPreview } from '../src/components/character-sheet/calculate-character-sheet-preview';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

test('isolated reviewed feat bodies agree with saved-sheet and catalog preview while enforcing organization and campaign access', async () => {
  const t = convexTest(schema, modules);
  const { campaignId, wrongCampaignId } = await t.run(async (ctx) => {
    for (const [name, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `feat335|${name}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed feats #335',
      description: '',
      organizationId: 'org',
      ownerId: 'feat335|owner',
      e2eFixture: {
        namespace: 'feats-335',
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
      ownerId: 'feat335|owner',
    });
    return { campaignId, wrongCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'feat335|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'feat335|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'feat335|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed mechanics preview',
    kind: 'pc',
    operationId: 'create-feats-335',
  });
  const scope = { organizationId: 'org', campaignId, characterId };
  const steadfast = heldFeatDefinition('Steadfast Personality');
  const skillFocus = heldFeatDefinition('Skill Focus (Stealth)');
  expect(
    review.candidates.find((row) => row.externalKey === steadfast.ruleIdentity),
  ).toMatchObject({ disposition: 'held', assessmentStatus: 'unresolved' });
  expect(
    review.candidates.find(
      (row) => row.externalKey === skillFocus.ruleIdentity,
    ),
  ).toMatchObject({
    disposition: 'supported/admitted',
    assessmentStatus: 'confirmed',
  });
  // Test-only materialization retains reviewed rule identity and mechanics.
  // It never publishes a global definition or lifts a held assessment.
  const [steadfastId, skillId] = await t.run(async (ctx) => {
    const ids = [];
    for (const definition of [steadfast, skillFocus])
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
  if (!steadfastId || !skillId) throw new Error('Missing isolated fixture IDs');
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
      charisma: 18,
    },
    operationId: 'steadfast-scores',
  });
  const selectionId = await member.mutation(
    api.characterSheet.fillSelectionSlot,
    {
      ...scope,
      slotId: 'feat:general',
      position: 0,
      catalogEntryId: steadfastId,
      operationId: 'select-steadfast',
    },
  );
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!saved) throw new Error('Missing saved sheet');
  for (const projection of [saved.calculated, saved.permanentCalculated])
    expect(projection.derivedStatistics.will.total).toBe(2);
  expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
    saved.calculated.derivedStatistics,
  );
  expect(
    calculateCharacterSheetPreview(saved, {}, { situations: ['mindAffecting'] })
      .derivedStatistics.will.total,
  ).toBe(4);
  expect(
    (await member.query(api.catalogCopies.list, scope)).find(
      (row) => row._id === steadfastId,
    ),
  ).toMatchObject(steadfast);
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectionId,
    active: false,
    operationId: 'deactivate-steadfast',
  });
  const inactive = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!inactive) throw new Error('Missing inactive sheet');
  expect(
    calculateCharacterSheetPreview(
      inactive,
      {},
      { situations: ['mindAffecting'] },
    ).derivedStatistics.will.total,
  ).toBe(2);
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectionId,
    catalogEntryId: skillId,
    active: true,
    operationId: 'replace-with-skill-focus',
  });
  const skillSaved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!skillSaved) throw new Error('Missing Skill Focus sheet');
  expect(calculateCharacterSheetPreview(skillSaved).skills).toEqual(
    skillSaved.calculated.skills,
  );
  // #724: the closed formula grammar reads skill ranks, so Skill Focus
  // applies its +3 (no Stealth ranks, Dexterity 10) with nothing selected.
  expect(skillFocus.modifiers).toEqual([
    {
      target: 'skill.ste',
      bonusType: 'untyped',
      value: { formula: '3 + 3 * min(1, floor(@skillRanks.ste / 10))' },
    },
  ]);
  expect(skillSaved.calculated.breakdowns['skill.ste'].total).toBe(3);
  expect(
    calculateCharacterSheetPreview(skillSaved).breakdowns['skill.ste'].total,
  ).toBe(3);
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectionId,
    active: false,
    operationId: 'deactivate-skill-focus',
  });
  const skillInactive = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!skillInactive) throw new Error('Missing inactive Skill Focus sheet');
  expect(skillInactive.calculated.breakdowns['skill.ste'].total).toBe(0);
  expect(
    calculateCharacterSheetPreview(skillInactive).breakdowns['skill.ste'].total,
  ).toBe(0);
  expect(
    (await member.query(api.characterSheet.read, scope))?.calculated.breakdowns[
      'skill.ste'
    ].total,
  ).toBe(0);
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
  ).toMatchObject({ active: false, catalogEntryId: skillId });
});
