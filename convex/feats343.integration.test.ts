/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { reviewedFeatDefinition } from '../tests/fixtures/feats-343/sheet';
import review from '../scripts/catalog/legal/feats-343.json';
import { calculateCharacterSheetPreview } from '../src/components/character-sheet/calculate-character-sheet-preview';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

test('isolated saved nobility Skill Focus matches catalog preview and enforces shared campaign access', async () => {
  const name = 'Skill Focus (Knowledge [Nobility])';
  const target = 'skill.kno';
  const t = convexTest(schema, modules);
  const { campaignId, wrongCampaignId } = await t.run(async (ctx) => {
    for (const [user, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `feat343|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed feats #343',
      description: '',
      organizationId: 'org',
      ownerId: 'feat343|owner',
      e2eFixture: {
        namespace: 'feats-343',
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
      ownerId: 'feat343|owner',
    });
    return { campaignId, wrongCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'feat343|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'feat343|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'feat343|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed feat preview',
    kind: 'pc',
    operationId: 'create-feats-343',
  });
  const scope = { organizationId: 'org', campaignId, characterId };
  const focus = reviewedFeatDefinition(name);
  const harrow = reviewedFeatDefinition('Harrowed');
  expect(
    review.candidates.find((row) => row.externalKey === focus.ruleIdentity)
      ?.disposition,
  ).toBe('admitted');
  expect(
    review.candidates.find((row) => row.externalKey === harrow.ruleIdentity)
      ?.disposition,
  ).toBe('held');
  // Real reviewed bodies in test-only Character definitions. Held Harrowed
  // stays held globally; this never constructs or publishes a Catalog Release.
  const { focusId, harrowId } = await t.run(async (ctx) => ({
    focusId: await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      ...focus,
      stacksWithItself: false,
    }),
    harrowId: await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      ...harrow,
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
      row._id === selectedId ? { ...row, catalogEntryId: harrowId } : row,
    ),
  });
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectedId,
    catalogEntryId: harrowId,
    operationId: 'replace-with-harrow',
  });
  const harrowSaved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!harrowSaved) throw new Error('Missing Harrowed sheet');
  expect(staged.derivedStatistics).toEqual(
    harrowSaved.calculated.derivedStatistics,
  );
  const ordinary = harrowSaved.calculated.derivedStatistics.will.total;
  expect(
    calculateCharacterSheetPreview(
      harrowSaved,
      {},
      { situations: ['enchantment'] },
    ).derivedStatistics.will.total,
  ).toBe(ordinary + 1);
  expect(
    calculateCharacterSheetPreview(harrowSaved, {}, { situations: ['fear'] })
      .derivedStatistics.will.total,
  ).toBe(ordinary);
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectedId,
    active: false,
    operationId: 'deactivate-harrow',
  });
  const inactive = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!inactive) throw new Error('Missing inactive sheet');
  expect(
    calculateCharacterSheetPreview(
      inactive,
      {},
      { situations: ['enchantment'] },
    ).derivedStatistics.will.total,
  ).toBe(ordinary);
  const foreignId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId: wrongCampaignId,
      ...harrow,
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
  ).toMatchObject({ active: false, catalogEntryId: harrowId });
});
