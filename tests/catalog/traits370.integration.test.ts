/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { withSheetCatalog } from '../character-sheet-catalog';
import { reviewedTraitDefinition } from '../fixtures/traits-370/sheet';
import { heldTraits } from '../fixtures/traits-370/data';
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
        tokenIdentifier: `trait370|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    }
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed traits #370',
      description: '',
      organizationId: 'org',
      ownerId: 'trait370|owner',
      e2eFixture: {
        namespace: 'traits-370',
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
      ownerId: 'trait370|owner',
    });
    return { campaignId, otherCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'trait370|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'trait370|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'trait370|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed trait preview',
    kind: 'pc',
    operationId: 'create-traits-370',
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
  const rapscallion = reviewedTraitDefinition('Rapscallion');
  const ambivalence = reviewedTraitDefinition(
    'Giant Ambivalence (Temperate Highlands)',
  );
  const proxy = reviewedTraitDefinition('Proxy of Many');
  const feyTaken = reviewedTraitDefinition('Fey-Taken');
  for (const definition of [rapscallion, ambivalence, proxy, feyTaken])
    expect(
      heldTraits.find((row) => row.externalKey === definition.ruleIdentity)
        ?.disposition,
    ).toBe('held');
  // Character-scoped fixtures exercise the held bodies without a release.
  const ids = await t.run(async (ctx) => {
    const insert = (definition: typeof rapscallion) =>
      ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ...definition,
        stacksWithItself: false,
      });
    return {
      rapscallion: await insert(rapscallion),
      ambivalence: await insert(ambivalence),
      proxy: await insert(proxy),
      feyTaken: await insert(feyTaken),
      foreign: await ctx.db.insert('catalogEntry', {
        scope: 'campaign',
        campaignId: otherCampaignId,
        ...rapscallion,
        stacksWithItself: false,
      }),
    };
  });
  const first = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:general',
    position: 0,
    catalogEntryId: ids.rapscallion,
    operationId: 'select-rapscallion',
  });
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!saved) throw new Error('Missing saved sheet');
  expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
    saved.calculated.derivedStatistics,
  );
  expect([
    saved.calculated.breakdowns.init.total,
    saved.calculated.breakdowns['skill.esc'].total,
  ]).toEqual([1, 1]);
  const second = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:general',
    position: 1,
    catalogEntryId: ids.ambivalence,
    operationId: 'select-ambivalence',
  });
  // Two traits' +1 trait bonuses on initiative don't stack.
  const current = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!current) throw new Error('Missing current sheet');
  expect([
    current.calculated.breakdowns.init.total,
    current.calculated.breakdowns['skill.sen'].total,
  ]).toEqual([1, 1]);
  // Staged replacement equals the saved replacement: Proxy of Many for
  // Rapscallion, beside Giant Ambivalence.
  const staged = calculateCharacterSheetPreview(current, {
    entries: current.entries.map((row) =>
      row._id === first ? { ...row, catalogEntryId: ids.proxy } : row,
    ),
  });
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: first,
    catalogEntryId: ids.proxy,
    operationId: 'replace-with-proxy',
  });
  const replaced = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!replaced) throw new Error('Missing replaced sheet');
  expect(staged.derivedStatistics).toEqual(
    replaced.calculated.derivedStatistics,
  );
  expect([
    replaced.calculated.breakdowns.init.total,
    replaced.calculated.breakdowns['skill.esc'].total,
    replaced.calculated.breakdowns['skill.dip'].total,
  ]).toEqual([1, 0, 0]);
  // The +2 and +4 favor bonuses are trait bonuses: with both Situations
  // selected the Diplomacy total is +4, not +6.
  const situations = proxy.modifiers.flatMap((row) =>
    row.condition?.situation
      ? [{ ...local(row.condition.situation), sheetEntryId: first }]
      : [],
  );
  expect(situations).toHaveLength(2);
  expect(
    calculateCharacterSheetPreview(replaced, {}, { situations }).breakdowns[
      'skill.dip'
    ].total,
  ).toBe(4);
  expect(replaced.entries.find((row) => row._id === second)).toMatchObject({
    catalogEntryId: ids.ambivalence,
  });
  // The drawback slot takes the drawback and adds one trait to the budget.
  // Its -2 save penalties apply only under their Situations.
  const drawbackEntry = await member.mutation(
    api.characterSheet.fillSelectionSlot,
    {
      ...scope,
      slotId: 'trait:drawback',
      position: 0,
      catalogEntryId: ids.feyTaken,
      operationId: 'select-fey-taken',
    },
  );
  const drawbackSheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!drawbackSheet) throw new Error('Missing drawback sheet');
  expect(drawbackSheet.calculated.selectionRules.budgets.traits).toBe(3);
  expect(
    calculateCharacterSheetPreview(drawbackSheet).derivedStatistics,
  ).toEqual(drawbackSheet.calculated.derivedStatistics);
  const feySituations = feyTaken.modifiers.flatMap((row) =>
    row.condition?.situation
      ? [{ ...local(row.condition.situation), sheetEntryId: drawbackEntry }]
      : [],
  );
  expect(feySituations).toHaveLength(2);
  const penalized = calculateCharacterSheetPreview(
    drawbackSheet,
    {},
    { situations: feySituations },
  ).breakdowns;
  // Without a class the save totals have no base; compare the difference.
  for (const save of ['save.fort', 'save.ref', 'save.will'] as const)
    expect(
      penalized[save].total - drawbackSheet.calculated.breakdowns[save].total,
      save,
    ).toBe(-2);
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
  ).toMatchObject({ active: true, catalogEntryId: ids.proxy });
  expect(await t.query(api.catalogRelease.legalInputs, {})).toBeNull();
});
