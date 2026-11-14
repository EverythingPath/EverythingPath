/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { withSheetCatalog } from '../character-sheet-catalog';
import { reviewedFeatDefinition } from '../fixtures/feats-356/sheet';
import { reviewedFeatDefinition as admittedFeatDefinition } from '../fixtures/feats-355/sheet';
import { review } from '../fixtures/feats-356/data';
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
        tokenIdentifier: `feat356|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    }
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed feats #356',
      description: '',
      organizationId: 'org',
      ownerId: 'feat356|owner',
      e2eFixture: {
        namespace: 'feats-356',
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
      ownerId: 'feat356|owner',
    });
    return { campaignId, otherCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'feat356|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'feat356|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'feat356|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed feat preview',
    kind: 'pc',
    operationId: 'create-feats-356',
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
  const shield = reviewedFeatDefinition('Cornugon Shield');
  const studied = reviewedFeatDefinition('Studied Expertise');
  expect(
    review.candidates.find((row) => row.externalKey === shield.ruleIdentity)
      ?.disposition,
  ).toBe('held');
  // Character-scoped fixtures exercise held bodies without a global release.
  const { shieldId, studiedId, copyId, admittedId, foreignId } = await t.run(
    async (ctx) => ({
      shieldId: await ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ...shield,
        stacksWithItself: false,
      }),
      studiedId: await ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ...studied,
        stacksWithItself: false,
      }),
      copyId: await ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ...shield,
        name: 'Cornugon Catalog Copy',
        stacksWithItself: false,
      }),
      admittedId: await ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ...admittedFeatDefinition('Skill Focus (Climb)'),
        stacksWithItself: false,
      }),
      foreignId: await ctx.db.insert('catalogEntry', {
        scope: 'campaign',
        campaignId: otherCampaignId,
        ...shield,
        stacksWithItself: false,
      }),
    }),
  );
  const selectedId = await member.mutation(
    api.characterSheet.fillSelectionSlot,
    {
      ...scope,
      slotId: 'feat:general',
      position: 0,
      catalogEntryId: shieldId,
      operationId: 'select-shield',
    },
  );
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!saved) throw new Error('Missing saved sheet');
  expect(saved.calculated.breakdowns['ac.other'].total).toBe(0);
  expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
    saved.calculated.derivedStatistics,
  );
  const plain = shield.modifiers[0]?.condition?.situation;
  const defensive = shield.modifiers[1]?.condition?.situation;
  if (
    typeof plain !== 'object' ||
    !('local' in plain) ||
    typeof defensive !== 'object' ||
    !('local' in defensive)
  )
    throw new Error('Missing shield Situations');
  expect(
    calculateCharacterSheetPreview(
      saved,
      {},
      { situations: [{ ...plain, sheetEntryId: selectedId }] },
    ).breakdowns['ac.other'].total,
  ).toBe(1);
  expect(
    calculateCharacterSheetPreview(
      saved,
      {},
      { situations: [{ ...defensive, sheetEntryId: selectedId }] },
    ).breakdowns['ac.other'].total,
  ).toBe(2);
  expect(
    calculateCharacterSheetPreview(
      saved,
      {},
      { situations: [{ ...defensive, sheetEntryId: 'other-holder' }] },
    ).breakdowns['ac.other'].total,
  ).toBe(0);
  expect(
    (await member.query(api.catalogCopies.list, scope)).find(
      (row) => row._id === shieldId,
    ),
  ).toMatchObject(shield);
  const secondId = await member.mutation(api.characterSheet.selectEntry, {
    ...scope,
    catalogEntryId: copyId,
    operationId: 'select-copy',
  });
  const doubled = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!doubled) throw new Error('Missing copied selection');
  const options = {
    situations: [
      { ...plain, sheetEntryId: selectedId },
      { ...defensive, sheetEntryId: secondId },
    ],
  };
  expect(
    calculateCharacterSheetPreview(doubled, {}, options).breakdowns['ac.other']
      .total,
  ).toBe(2);
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: secondId,
    active: false,
    operationId: 'disable-copy',
  });
  const disabledCopy = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!disabledCopy) throw new Error('Missing disabled copy');
  expect(
    calculateCharacterSheetPreview(disabledCopy, {}, options).breakdowns[
      'ac.other'
    ].total,
  ).toBe(1);
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectedId,
    active: false,
    operationId: 'disable-original',
  });
  const inactive = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!inactive) throw new Error('Missing inactive original');
  expect(
    calculateCharacterSheetPreview(inactive, {}, options).breakdowns['ac.other']
      .total,
  ).toBe(0);
  const staged = calculateCharacterSheetPreview(saved, {
    entries: saved.entries.map((row) =>
      row._id === selectedId ? { ...row, catalogEntryId: studiedId } : row,
    ),
  });
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectedId,
    catalogEntryId: studiedId,
    active: true,
    operationId: 'replace-with-studied',
  });
  const recipient = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!recipient) throw new Error('Missing recipient-rule selection');
  expect(staged.derivedStatistics).toEqual(
    recipient.calculated.derivedStatistics,
  );
  expect(recipient.calculated.breakdowns['attack.melee'].total).toBe(0);
  expect(recipient.calculated.breakdowns['attack.ranged'].total).toBe(0);
  expect(
    (await member.query(api.catalogCopies.list, scope)).find(
      (row) => row._id === studiedId,
    ),
  ).toMatchObject(studied);
  // Existing #355 admission remains a separate control, outside #356 inventory.
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
  expect(admitted.calculated.breakdowns['skill.clm'].applied).toContainEqual(
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
