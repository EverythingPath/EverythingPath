/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { withSheetCatalog } from '../character-sheet-catalog';
import { reviewedTraitDefinition } from '../fixtures/traits-378/sheet';
import { heldTraits } from '../fixtures/traits-378/data';
import { calculateCharacterSheetPreview } from '../../src/components/character-sheet/calculate-character-sheet-preview';

const modules = import.meta.glob('../../convex/**/*.ts');

function localScope(scope: unknown) {
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
        tokenIdentifier: `trait378|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    }
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed traits #378',
      description: '',
      organizationId: 'org',
      ownerId: 'trait378|owner',
      e2eFixture: {
        namespace: 'traits-378',
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
      ownerId: 'trait378|owner',
    });
    return { campaignId, otherCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'trait378|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'trait378|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'trait378|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed trait preview',
    kind: 'pc',
    operationId: 'create-traits-378',
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
  const poverty = reviewedTraitDefinition('Poverty-Stricken');
  const marker = reviewedTraitDefinition('Deep Marker (Dwarf)');
  const wati = reviewedTraitDefinition("Wati Native (Mummy's Mask)");
  const condescending = reviewedTraitDefinition('Condescending');
  for (const definition of [poverty, marker, wati, condescending])
    expect(
      heldTraits.find((row) => row.externalKey === definition.ruleIdentity)
        ?.disposition,
    ).toBe('held');
  // Character-scoped fixtures exercise the held bodies without a release.
  const ids = await t.run(async (ctx) => {
    const insert = (definition: typeof poverty) =>
      ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ...definition,
        stacksWithItself: false,
      });
    return {
      poverty: await insert(poverty),
      marker: await insert(marker),
      wati: await insert(wati),
      condescending: await insert(condescending),
      foreign: await ctx.db.insert('catalogEntry', {
        scope: 'campaign',
        campaignId: otherCampaignId,
        ...poverty,
        stacksWithItself: false,
      }),
    };
  });
  const first = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:general',
    position: 0,
    catalogEntryId: ids.poverty,
    operationId: 'select-poverty',
  });
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!saved) throw new Error('Missing saved sheet');
  expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
    saved.calculated.derivedStatistics,
  );
  const survival = saved.calculated.breakdowns['skill.sur'].total;
  const local = saved.calculated.breakdowns['skill.klo'].total;
  const will = saved.calculated.breakdowns['save.will'].total;
  const fortitude = saved.calculated.breakdowns['save.fort'].total;
  await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:general',
    position: 1,
    catalogEntryId: ids.marker,
    operationId: 'select-marker',
  });
  // Deep Marker's +1 trait bonus on Survival doesn't stack with
  // Poverty-Stricken's; against fear its +1 trait bonus applies to every save.
  const current = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!current) throw new Error('Missing current sheet');
  expect(current.calculated.breakdowns['skill.sur'].total).toBe(survival);
  const afraid = calculateCharacterSheetPreview(
    current,
    {},
    { situations: ['fear'] },
  ).breakdowns;
  expect([afraid['save.fort'].total, afraid['save.will'].total]).toEqual([
    fortitude + 1,
    will + 1,
  ]);
  // Staged replacement equals the saved replacement: Wati Native for
  // Poverty-Stricken, beside Deep Marker, whose +1 is now the Survival bonus.
  const staged = calculateCharacterSheetPreview(current, {
    entries: current.entries.map((row) =>
      row._id === first ? { ...row, catalogEntryId: ids.wati } : row,
    ),
  });
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: first,
    catalogEntryId: ids.wati,
    operationId: 'replace-with-wati',
  });
  const replaced = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!replaced) throw new Error('Missing replaced sheet');
  expect(staged.derivedStatistics).toEqual(
    replaced.calculated.derivedStatistics,
  );
  expect(replaced.calculated.breakdowns['skill.sur'].total).toBe(survival);
  expect(replaced.calculated.breakdowns['skill.klo'].total).toBe(local + 1);
  // Against fear, Wati Native's +2 trait bonus and Deep Marker's +1 don't
  // stack: every save is +2.
  const fear = calculateCharacterSheetPreview(
    replaced,
    {},
    { situations: ['fear'] },
  ).breakdowns;
  expect([fear['save.fort'].total, fear['save.will'].total]).toEqual([
    fortitude + 2,
    will + 2,
  ]);
  // The drawback slot takes the drawback, whose Diplomacy and Intimidate
  // penalty waits for its Situation, and adds one trait to the budget.
  const drawback = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:drawback',
    position: 0,
    catalogEntryId: ids.condescending,
    operationId: 'select-condescending',
  });
  const drawbackSheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!drawbackSheet) throw new Error('Missing drawback sheet');
  expect(drawbackSheet.calculated.selectionRules.budgets.traits).toBe(3);
  const before = drawbackSheet.calculated.breakdowns;
  expect(before['skill.dip'].total).toBe(
    replaced.calculated.breakdowns['skill.dip'].total,
  );
  const attitude = calculateCharacterSheetPreview(
    drawbackSheet,
    {},
    {
      situations: [
        {
          ...localScope(condescending.modifiers[0]?.condition?.situation),
          sheetEntryId: drawback,
        },
      ],
    },
  ).breakdowns;
  expect(attitude['skill.dip'].total - before['skill.dip'].total).toBe(-5);
  expect(attitude['skill.int'].total - before['skill.int'].total).toBe(-5);
  expect(attitude['skill.blf'].total - before['skill.blf'].total).toBe(0);
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
  ).toMatchObject({ active: true, catalogEntryId: ids.wati });
  expect(await t.query(api.catalogRelease.legalInputs, {})).toBeNull();
});
