/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { withSheetCatalog } from '../character-sheet-catalog';
import { reviewedFeatDefinition } from '../fixtures/feats-346/sheet';
import { review } from '../fixtures/feats-346/data';
import { calculateCharacterSheetPreview } from '../../src/components/character-sheet/calculate-character-sheet-preview';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';

const modules = import.meta.glob('../../convex/**/*.ts');

test('isolated saved Heal Skill Focus matches catalog preview and enforces shared campaign access', async () => {
  const name = 'Skill Focus (Heal)';
  const target = 'skill.hea';
  const t = convexTest(schema, modules);
  const { campaignId, wrongCampaignId } = await t.run(async (ctx) => {
    for (const [user, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `feat346|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed feats #346',
      description: '',
      organizationId: 'org',
      ownerId: 'feat346|owner',
      e2eFixture: {
        namespace: 'feats-346',
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
      ownerId: 'feat346|owner',
    });
    return { campaignId, wrongCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'feat346|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'feat346|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'feat346|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed feat preview',
    kind: 'pc',
    operationId: 'create-feats-346',
  });
  const scope = { organizationId: 'org', campaignId, characterId };
  const focus = reviewedFeatDefinition(name);
  const moontouched = reviewedFeatDefinition('Moontouched');
  expect(
    review.candidates.find((row) => row.externalKey === focus.ruleIdentity)
      ?.disposition,
  ).toBe('admitted');
  expect(
    review.candidates.find(
      (row) => row.externalKey === moontouched.ruleIdentity,
    )?.disposition,
  ).toBe('held');
  // Real reviewed bodies in test-only Character definitions. Held Moontouched
  // stays held globally; this never constructs or publishes a Catalog Release.
  const { focusId, moontouchedId } = await t.run(async (ctx) => ({
    focusId: await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      ...focus,
      stacksWithItself: false,
    }),
    moontouchedId: await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      ...moontouched,
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
  // #724: no ranks and the skill's ability at 10, so Skill Focus adds +3
  // with nothing selected.
  expect(saved.calculated.breakdowns[target].total).toBe(3);
  expect(saved.permanentCalculated.breakdowns[target].total).toBe(3);
  expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
    saved.calculated.derivedStatistics,
  );
  expect(focus.modifiers).toEqual([
    {
      target,
      bonusType: 'untyped',
      value: {
        formula: `3 + 3 * min(1, floor(@skillRanks.${target.slice('skill.'.length)} / 10))`,
      },
    },
  ]);
  expect(calculateCharacterSheetPreview(saved).breakdowns[target].total).toBe(
    3,
  );
  expect(
    (await member.query(api.catalogCopies.list, scope)).find(
      (row) => row._id === focusId,
    ),
  ).toMatchObject(focus);
  const staged = calculateCharacterSheetPreview(saved, {
    entries: saved.entries.map((row) =>
      row._id === selectedId ? { ...row, catalogEntryId: moontouchedId } : row,
    ),
  });
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectedId,
    catalogEntryId: moontouchedId,
    operationId: 'replace-with-disguise',
  });
  const moontouchedSaved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!moontouchedSaved) throw new Error('Missing Moontouched sheet');
  expect(staged.derivedStatistics).toEqual(
    moontouchedSaved.calculated.derivedStatistics,
  );
  const moonVisibility = moontouched.modifiers[0]?.condition?.situation;
  if (typeof moonVisibility !== 'object' || !('local' in moonVisibility))
    throw new Error('Missing moon-visibility Situation');
  expect(moontouchedSaved.calculated.breakdowns['save.fort'].total).toBe(0);
  expect(
    calculateCharacterSheetPreview(
      moontouchedSaved,
      {},
      { situations: [{ ...moonVisibility, sheetEntryId: selectedId }] },
    ).breakdowns['save.fort'].total,
  ).toBe(2);
  expect(
    calculateCharacterSheetPreview(
      moontouchedSaved,
      {},
      {
        situations: [{ ...moonVisibility, sheetEntryId: 'other' }],
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
      { situations: [{ ...moonVisibility, sheetEntryId: selectedId }] },
    ).breakdowns['save.fort'].total,
  ).toBe(0);
  const foreignId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId: wrongCampaignId,
      ...moontouched,
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
  ).toMatchObject({ active: false, catalogEntryId: moontouchedId });
});
