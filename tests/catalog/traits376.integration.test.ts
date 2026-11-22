/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { withSheetCatalog } from '../character-sheet-catalog';
import { reviewedTraitDefinition } from '../fixtures/traits-376/sheet';
import { heldTraits } from '../fixtures/traits-376/data';
import { calculateCharacterSheetPreview } from '../../src/components/character-sheet/calculate-character-sheet-preview';

const modules = import.meta.glob('../../convex/**/*.ts');

function local(scope: unknown) {
  if (typeof scope !== 'object' || scope === null || !('local' in scope))
    throw new Error('Expected a local Situation');
  return scope as { local: string };
}

test('isolated held trait selections preview the reviewed numbers, keep trait bonuses from stacking and enforce shared campaign access', async () => {
  const t = convexTest(schema, modules);
  const { campaignId, otherCampaignId } = await t.run(async (ctx) => {
    for (const [user, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const) {
      await ctx.db.insert('user', {
        tokenIdentifier: `trait376|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    }
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed traits #376',
      description: '',
      organizationId: 'org',
      ownerId: 'trait376|owner',
      e2eFixture: {
        namespace: 'traits-376',
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
      ownerId: 'trait376|owner',
    });
    return { campaignId, otherCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'trait376|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'trait376|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'trait376|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed trait preview',
    kind: 'pc',
    operationId: 'create-traits-376',
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
  const faith = reviewedTraitDefinition('Indomitable Faith');
  const purity = reviewedTraitDefinition('Purity of Faith (Iomedae)');
  const courageous = reviewedTraitDefinition('Courageous');
  const doubting = reviewedTraitDefinition('Self-Doubting');
  for (const definition of [faith, purity, courageous, doubting])
    expect(
      heldTraits.find((row) => row.externalKey === definition.ruleIdentity)
        ?.disposition,
    ).toBe('held');
  // Character-scoped fixtures exercise the held bodies without a release.
  const ids = await t.run(async (ctx) => {
    const insert = (definition: typeof faith) =>
      ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ...definition,
        stacksWithItself: false,
      });
    return {
      faith: await insert(faith),
      purity: await insert(purity),
      courageous: await insert(courageous),
      doubting: await insert(doubting),
      foreign: await ctx.db.insert('catalogEntry', {
        scope: 'campaign',
        campaignId: otherCampaignId,
        ...faith,
        stacksWithItself: false,
      }),
    };
  });
  const first = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:general',
    position: 0,
    catalogEntryId: ids.faith,
    operationId: 'select-faith',
  });
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!saved) throw new Error('Missing saved sheet');
  expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
    saved.calculated.derivedStatistics,
  );
  const will = saved.calculated.breakdowns['save.will'].total;
  const fortitude = saved.calculated.breakdowns['save.fort'].total;
  const second = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:general',
    position: 1,
    catalogEntryId: ids.purity,
    operationId: 'select-purity',
  });
  // Purity of Faith's +1 trait bonus on Will saves doesn't stack with
  // Indomitable Faith's; against an evil outsider its +1 applies to
  // Fortitude, and Will still gets only +1.
  const current = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!current) throw new Error('Missing current sheet');
  expect(current.calculated.breakdowns['save.will'].total).toBe(will);
  const evilIndex = purity.modifiers.findIndex(
    (row) => row.target === 'saves' && row.condition?.situation,
  );
  const evil = calculateCharacterSheetPreview(
    current,
    {},
    {
      situations: [
        {
          ...local(purity.modifiers[evilIndex]?.condition?.situation),
          sheetEntryId: second,
        },
      ],
    },
  ).breakdowns;
  expect([evil['save.fort'].total, evil['save.will'].total]).toEqual([
    fortitude + 1,
    will,
  ]);
  // Staged replacement equals the saved replacement: Courageous for
  // Indomitable Faith, beside Purity of Faith, whose +1 is now the Will bonus.
  const staged = calculateCharacterSheetPreview(current, {
    entries: current.entries.map((row) =>
      row._id === first ? { ...row, catalogEntryId: ids.courageous } : row,
    ),
  });
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: first,
    catalogEntryId: ids.courageous,
    operationId: 'replace-with-courageous',
  });
  const replaced = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!replaced) throw new Error('Missing replaced sheet');
  expect(staged.derivedStatistics).toEqual(
    replaced.calculated.derivedStatistics,
  );
  expect(replaced.calculated.breakdowns['save.will'].total).toBe(will);
  // Against fear, Courageous's +2 trait bonus replaces Purity's +1 on Will
  // (+2, not +3) and applies to Fortitude.
  const fear = calculateCharacterSheetPreview(
    replaced,
    {},
    { situations: ['fear'] },
  ).breakdowns;
  expect([fear['save.fort'].total, fear['save.will'].total]).toEqual([
    fortitude + 2,
    will + 1,
  ]);
  expect(replaced.entries.find((row) => row._id === second)).toMatchObject({
    catalogEntryId: ids.purity,
  });
  // The drawback slot takes the drawback, whose Will penalty waits for its
  // Situation, and adds one trait to the budget.
  const drawback = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:drawback',
    position: 0,
    catalogEntryId: ids.doubting,
    operationId: 'select-doubting',
  });
  const drawbackSheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!drawbackSheet) throw new Error('Missing drawback sheet');
  expect(drawbackSheet.calculated.selectionRules.budgets.traits).toBe(3);
  const before = drawbackSheet.calculated.breakdowns;
  expect(before['save.will'].total).toBe(
    replaced.calculated.breakdowns['save.will'].total,
  );
  const willIndex = doubting.modifiers.findIndex(
    (row) => row.target === 'save.will',
  );
  const failed = calculateCharacterSheetPreview(
    drawbackSheet,
    {},
    {
      situations: [
        {
          ...local(doubting.modifiers[willIndex]?.condition?.situation),
          sheetEntryId: drawback,
        },
      ],
    },
  ).breakdowns;
  expect(failed['save.will'].total - before['save.will'].total).toBe(-2);
  expect(
    calculateCharacterSheetPreview(drawbackSheet).derivedStatistics,
  ).toEqual(drawbackSheet.calculated.derivedStatistics);
  await expect(
    member.mutation(api.characterSheet.editSelection, {
      ...scope,
      entryId: first,
      catalogEntryId: ids.foreign,
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
        entryId: first,
        active: false,
        operationId: 'denied-edit',
      }),
    ).rejects.toThrow();
  }
  expect(
    (await owner.query(api.characterSheet.read, scope))?.entries.find(
      (row) => row._id === first,
    ),
  ).toMatchObject({ active: true, catalogEntryId: ids.courageous });
  expect(await t.query(api.catalogRelease.legalInputs, {})).toBeNull();
});
