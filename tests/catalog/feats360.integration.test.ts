/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { withSheetCatalog } from '../character-sheet-catalog';
import { reviewedFeatDefinition } from '../fixtures/feats-360/sheet';
import { reviewedFeatDefinition as admittedFeatDefinition } from '../fixtures/feats-359/sheet';
import { review } from '../fixtures/feats-360/data';
import { calculateCharacterSheetPreview } from '../../src/components/character-sheet/calculate-character-sheet-preview';

const modules = import.meta.glob('../../convex/**/*.ts');

test('isolated held-body selections preview the reviewed numbers and enforce shared campaign access', async () => {
  const t = convexTest(schema, modules);
  const { campaignId, otherCampaignId } = await t.run(async (ctx) => {
    for (const [user, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const) {
      await ctx.db.insert('user', {
        tokenIdentifier: `feat360|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    }
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed feats #360',
      description: '',
      organizationId: 'org',
      ownerId: 'feat360|owner',
      e2eFixture: {
        namespace: 'feats-360',
        version: 1,
        workerKey: '0',
        caseKey: 'reviewed',
        campaignKey: 'reviewed',
      },
    });
    const otherCampaignId = await ctx.db.insert('campaign', {
      name: 'Other isolated campaign',
      description: '',
      organizationId: 'org',
      ownerId: 'feat360|owner',
    });
    return { campaignId, otherCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'feat360|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'feat360|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'feat360|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed feat preview',
    kind: 'pc',
    operationId: 'create-feats-360',
  });
  const scope = { organizationId: 'org', campaignId, characterId };
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
  const fleet = reviewedFeatDefinition('Sure and Fleet');
  const jungle = reviewedFeatDefinition('Jungle Survivalist');
  const champion = reviewedFeatDefinition('Champion of Righteousness');
  for (const definition of [fleet, jungle, champion])
    expect(
      review.candidates.find(
        (row) => row.externalKey === definition.ruleIdentity,
      )?.disposition,
    ).toBe('held');
  // Character-scoped fixtures exercise held bodies without a global release.
  const { fleetId, copyId, jungleId, championId, admittedId, foreignId } =
    await t.run(async (ctx) => ({
      fleetId: await ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ...fleet,
        stacksWithItself: false,
      }),
      copyId: await ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ...fleet,
        name: 'Sure and Fleet Catalog Copy',
        stacksWithItself: false,
      }),
      jungleId: await ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ...jungle,
        stacksWithItself: false,
      }),
      championId: await ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ...champion,
        stacksWithItself: false,
      }),
      admittedId: await ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ...admittedFeatDefinition('Skill Focus (Profession)'),
        stacksWithItself: false,
      }),
      foreignId: await ctx.db.insert('catalogEntry', {
        scope: 'campaign',
        campaignId: otherCampaignId,
        ...fleet,
        stacksWithItself: false,
      }),
    }));
  const selectedId = await member.mutation(
    api.characterSheet.fillSelectionSlot,
    {
      ...scope,
      slotId: 'feat:general',
      position: 0,
      catalogEntryId: fleetId,
      operationId: 'select-fleet',
    },
  );
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!saved) throw new Error('Missing saved sheet');
  expect(saved.calculated.breakdowns['skill.acr'].total).toBe(2);
  expect(saved.calculated.breakdowns['skill.clm'].total).toBe(2);
  expect(saved.calculated.breakdowns['skill.swm'].total).toBe(0);
  expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
    saved.calculated.derivedStatistics,
  );
  expect(
    (await member.query(api.catalogCopies.list, scope)).find(
      (row) => row._id === fleetId,
    ),
  ).toMatchObject(fleet);
  // A second copy of the same Rule Identity does not stack with the first.
  const secondId = await member.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: copyId,
    operationId: 'select-copy',
  });
  const doubled = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!doubled) throw new Error('Missing copied selection');
  expect(doubled.calculated.breakdowns['skill.acr'].total).toBe(2);
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: secondId,
    active: false,
    operationId: 'disable-copy',
  });
  // Staged replacement equals the saved replacement: Jungle Survivalist.
  const current = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!current) throw new Error('Missing current sheet');
  const staged = calculateCharacterSheetPreview(current, {
    entries: current.entries.map((row) =>
      row._id === selectedId ? { ...row, catalogEntryId: jungleId } : row,
    ),
  });
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectedId,
    catalogEntryId: jungleId,
    operationId: 'replace-with-jungle',
  });
  const survivalist = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!survivalist) throw new Error('Missing Jungle Survivalist selection');
  expect(staged.derivedStatistics).toEqual(
    survivalist.calculated.derivedStatistics,
  );
  expect(survivalist.calculated.breakdowns['save.fort'].total).toBe(0);
  expect(survivalist.calculated.breakdowns['skill.acr'].total).toBe(0);
  // The shared poison Situation applies the held body's save bonus.
  expect(
    calculateCharacterSheetPreview(survivalist, {}, { situations: ['poison'] })
      .breakdowns['save.fort'].total,
  ).toBe(2);
  const trees = jungle.modifiers[3]?.condition?.situation;
  if (typeof trees !== 'object' || !('local' in trees))
    throw new Error('Missing Jungle Survivalist tree Situation');
  expect(
    calculateCharacterSheetPreview(
      survivalist,
      {},
      { situations: [{ ...trees, sheetEntryId: selectedId }] },
    ).breakdowns['skill.clm'].total,
  ).toBe(2);
  expect(
    calculateCharacterSheetPreview(
      survivalist,
      {},
      { situations: [{ ...trees, sheetEntryId: 'other-holder' }] },
    ).breakdowns['skill.clm'].total,
  ).toBe(0);
  // Exclusive alternatives keep the stronger Champion of Righteousness bonus.
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectedId,
    catalogEntryId: championId,
    operationId: 'replace-with-champion',
  });
  const righteous = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!righteous)
    throw new Error('Missing Champion of Righteousness selection');
  const either = champion.modifiers[0]?.condition?.situation;
  const both = champion.modifiers[1]?.condition?.situation;
  if (
    typeof either !== 'object' ||
    !('local' in either) ||
    typeof both !== 'object' ||
    !('local' in both)
  )
    throw new Error('Missing Champion of Righteousness Situations');
  expect(righteous.calculated.breakdowns['damage.melee'].total).toBe(0);
  expect(
    calculateCharacterSheetPreview(
      righteous,
      {},
      {
        situations: [
          { ...either, sheetEntryId: selectedId },
          { ...both, sheetEntryId: selectedId },
        ],
      },
    ).breakdowns['damage.melee'].total,
  ).toBe(4);
  // Existing #359 admission remains a separate control, outside #360 inventory.
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectedId,
    catalogEntryId: admittedId,
    operationId: 'existing-admission-control',
  });
  const admitted = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!admitted) throw new Error('Missing prior admitted control');
  // #724: its +3 applies with no ranks and nothing selected.
  expect(admitted.calculated.breakdowns['skill.pro'].applied).toContainEqual(
    expect.objectContaining({ sheetEntryId: selectedId, value: 3 }),
  );
  await expect(
    member.mutation(api.characterSheet.editSelection, {
      ...scope,
      entryId: selectedId,
      catalogEntryId: foreignId,
      operationId: 'foreign-entry',
    }),
  ).rejects.toThrow();
  await expect(
    member.query(api.characterSheet.read, {
      ...scope,
      campaignId: otherCampaignId,
    }),
  ).rejects.toThrow();
  for (const actor of [t, outsider]) {
    await expect(actor.query(api.characterSheet.read, scope)).rejects.toThrow();
    await expect(actor.query(api.catalogCopies.list, scope)).rejects.toThrow();
    await expect(
      actor.mutation(api.characterSheet.editSelection, {
        ...scope,
        entryId: selectedId,
        active: false,
        operationId: 'denied-edit',
      }),
    ).rejects.toThrow();
  }
  expect(
    (await owner.query(api.characterSheet.read, scope))?.entries.find(
      (row) => row._id === selectedId,
    ),
  ).toMatchObject({ active: true, catalogEntryId: admittedId });
  expect(await t.query(api.catalogRelease.legalInputs, {})).toBeNull();
});
