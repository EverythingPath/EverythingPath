/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { reviewedFeatDefinition } from '../tests/fixtures/feats-344/sheet';
import { review } from '../tests/fixtures/feats-344/data';
import { calculateCharacterSheetPreview } from '../src/components/character-sheet/calculate-character-sheet-preview';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

test('isolated held feat bodies preserve saved choices, exact scopes and shared campaign access', async () => {
  const t = convexTest(schema, modules);
  const { campaignId, wrongCampaignId } = await t.run(async (ctx) => {
    for (const [user, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `feat344|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed feats #344',
      description: '',
      organizationId: 'org',
      ownerId: 'feat344|owner',
      e2eFixture: {
        namespace: 'feats-344',
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
      ownerId: 'feat344|owner',
    });
    return { campaignId, wrongCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'feat344|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'feat344|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'feat344|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed feat preview',
    kind: 'pc',
    operationId: 'create-feats-344',
  });
  const scope = { organizationId: 'org', campaignId, characterId };
  const disguise = reviewedFeatDefinition('Pass For Human');
  const volley = reviewedFeatDefinition('Opening Volley');
  for (const definition of [disguise, volley])
    expect(
      review.candidates.find(
        (row) => row.externalKey === definition.ruleIdentity,
      )?.disposition,
    ).toBe('held');
  // Test-only Character definitions demonstrate mechanics without admitting held content.
  const { disguiseId, volleyId } = await t.run(async (ctx) => ({
    disguiseId: await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      ...disguise,
      stacksWithItself: false,
    }),
    volleyId: await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      ...volley,
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
  const entryId = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'feat:general',
    position: 0,
    catalogEntryId: disguiseId,
    operationId: 'select-disguise',
  });
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!saved) throw new Error('Missing saved sheet');
  expect(saved.calculated.breakdowns['skill.dis'].total).toBe(0);
  expect(saved.permanentCalculated.breakdowns['skill.dis'].total).toBe(0);
  expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
    saved.calculated.derivedStatistics,
  );
  const local = disguise.modifiers[0]?.condition?.situation;
  if (typeof local !== 'object' || !('local' in local))
    throw new Error('Missing human-disguise Situation');
  expect(
    calculateCharacterSheetPreview(
      saved,
      {},
      { situations: [{ ...local, sheetEntryId: entryId }] },
    ).breakdowns['skill.dis'].total,
  ).toBe(10);
  expect(
    calculateCharacterSheetPreview(
      saved,
      {},
      { situations: [{ ...local, sheetEntryId: 'other' }] },
    ).breakdowns['skill.dis'].total,
  ).toBe(0);
  expect(
    (await member.query(api.catalogCopies.list, scope)).find(
      (row) => row._id === disguiseId,
    ),
  ).toMatchObject(disguise);
  const staged = calculateCharacterSheetPreview(saved, {
    entries: saved.entries.map((row) =>
      row._id === entryId ? { ...row, catalogEntryId: volleyId } : row,
    ),
  });
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId,
    catalogEntryId: volleyId,
    operationId: 'replace-with-volley',
  });
  const next = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!next) throw new Error('Missing volley sheet');
  expect(staged.derivedStatistics).toEqual(next.calculated.derivedStatistics);
  const timing = volley.modifiers[0]?.condition?.situation;
  if (typeof timing !== 'object' || !('local' in timing))
    throw new Error('Missing volley timing');
  expect(
    calculateCharacterSheetPreview(
      next,
      {},
      { situations: [{ ...timing, sheetEntryId: entryId }] },
    ).breakdowns['attack.melee'].total,
  ).toBe(4);
  expect(next.calculated.breakdowns['attack.melee'].total).toBe(0);
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId,
    active: false,
    operationId: 'deactivate-volley',
  });
  const inactive = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!inactive) throw new Error('Missing inactive sheet');
  expect(
    calculateCharacterSheetPreview(
      inactive,
      {},
      { situations: [{ ...timing, sheetEntryId: entryId }] },
    ).breakdowns['attack.melee'].total,
  ).toBe(0);
  const foreignId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId: wrongCampaignId,
      ...volley,
      stacksWithItself: false,
    }),
  );
  await expect(
    member.mutation(api.characterSheet.editSelection, {
      ...scope,
      entryId,
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
        entryId,
        active: true,
        operationId: 'denied-edit',
      }),
    ).rejects.toThrow();
  }
  expect(
    (await owner.query(api.characterSheet.read, scope))?.entries.find(
      (row) => row._id === entryId,
    ),
  ).toMatchObject({ active: false, catalogEntryId: volleyId });
});
