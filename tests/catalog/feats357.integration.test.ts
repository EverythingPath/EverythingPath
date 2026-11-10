/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { withSheetCatalog } from '../character-sheet-catalog';
import { reviewedFeatDefinition } from '../fixtures/feats-357/sheet';
import { reviewedFeatDefinition as admittedFeatDefinition } from '../fixtures/feats-355/sheet';
import { review } from '../fixtures/feats-357/data';
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
        tokenIdentifier: `feat357|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    }
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed feats #357',
      description: '',
      organizationId: 'org',
      ownerId: 'feat357|owner',
      e2eFixture: {
        namespace: 'feats-357',
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
      ownerId: 'feat357|owner',
    });
    return { campaignId, otherCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'feat357|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'feat357|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'feat357|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed feat preview',
    kind: 'pc',
    operationId: 'create-feats-357',
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
  const swamper = reviewedFeatDefinition('Swamper');
  const shielded = reviewedFeatDefinition('Shielded Caster');
  const abjuration = reviewedFeatDefinition('Esoteric Abjuration');
  for (const definition of [swamper, shielded, abjuration])
    expect(
      review.candidates.find(
        (row) => row.externalKey === definition.ruleIdentity,
      )?.disposition,
    ).toBe('held');
  // Character-scoped fixtures exercise held bodies without a global release.
  const { swamperId, shieldedId, copyId, abjurationId, admittedId, foreignId } =
    await t.run(async (ctx) => ({
      swamperId: await ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ...swamper,
        stacksWithItself: false,
      }),
      shieldedId: await ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ...shielded,
        stacksWithItself: false,
      }),
      copyId: await ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ...swamper,
        name: 'Swamper Catalog Copy',
        stacksWithItself: false,
      }),
      abjurationId: await ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ...abjuration,
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
        ...swamper,
        stacksWithItself: false,
      }),
    }));
  const selectedId = await member.mutation(
    api.characterSheet.fillSelectionSlot,
    {
      ...scope,
      slotId: 'feat:general',
      position: 0,
      catalogEntryId: swamperId,
      operationId: 'select-swamper',
    },
  );
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!saved) throw new Error('Missing saved sheet');
  expect(saved.calculated.breakdowns['skill.clm'].total).toBe(2);
  expect(saved.calculated.breakdowns['skill.swm'].total).toBe(2);
  expect(saved.calculated.breakdowns['skill.acr'].total).toBe(0);
  expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
    saved.calculated.derivedStatistics,
  );
  const balance = swamper.modifiers[2]?.condition?.situation;
  if (typeof balance !== 'object' || !('local' in balance))
    throw new Error('Missing Swamper balance Situation');
  expect(
    calculateCharacterSheetPreview(
      saved,
      {},
      { situations: [{ ...balance, sheetEntryId: selectedId }] },
    ).breakdowns['skill.acr'].total,
  ).toBe(2);
  expect(
    calculateCharacterSheetPreview(
      saved,
      {},
      { situations: [{ ...balance, sheetEntryId: 'other-holder' }] },
    ).breakdowns['skill.acr'].total,
  ).toBe(0);
  expect(
    (await member.query(api.catalogCopies.list, scope)).find(
      (row) => row._id === swamperId,
    ),
  ).toMatchObject(swamper);
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
  expect(doubled.calculated.breakdowns['skill.clm'].total).toBe(2);
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: secondId,
    active: false,
    operationId: 'disable-copy',
  });
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
  expect(inactive.calculated.breakdowns['skill.clm'].total).toBe(0);
  // Staged replacement equals the saved replacement: Shielded Caster.
  const staged = calculateCharacterSheetPreview(inactive, {
    entries: inactive.entries.map((row) =>
      row._id === selectedId
        ? { ...row, catalogEntryId: shieldedId, active: true }
        : row,
    ),
  });
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectedId,
    catalogEntryId: shieldedId,
    active: true,
    operationId: 'replace-with-shielded',
  });
  const caster = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!caster) throw new Error('Missing Shielded Caster selection');
  expect(staged.derivedStatistics).toEqual(caster.calculated.derivedStatistics);
  expect(caster.calculated.breakdowns.concentration.total).toBe(0);
  const adjacent = shielded.modifiers[0]?.condition?.situation;
  const heavy = shielded.modifiers[2]?.condition?.situation;
  if (
    typeof adjacent !== 'object' ||
    !('local' in adjacent) ||
    typeof heavy !== 'object' ||
    !('local' in heavy)
  )
    throw new Error('Missing Shielded Caster Situations');
  expect(
    calculateCharacterSheetPreview(
      caster,
      {},
      {
        situations: [
          { ...adjacent, sheetEntryId: selectedId },
          { ...heavy, sheetEntryId: selectedId },
        ],
      },
    ).breakdowns.concentration.total,
  ).toBe(6);
  // A recipient-only body changes no holder total.
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: selectedId,
    catalogEntryId: abjurationId,
    operationId: 'replace-with-abjuration',
  });
  const recipient = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!recipient) throw new Error('Missing recipient-rule selection');
  expect(recipient.calculated.derivedStatistics).toEqual(
    inactive.calculated.derivedStatistics,
  );
  // Existing #355 admission remains a separate control, outside #357 inventory.
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
