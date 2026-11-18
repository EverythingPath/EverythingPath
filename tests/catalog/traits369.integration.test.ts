/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { withSheetCatalog } from '../character-sheet-catalog';
import { reviewedTraitDefinition } from '../fixtures/traits-369/sheet';
import { heldTraits } from '../fixtures/traits-369/data';
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
        tokenIdentifier: `trait369|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    }
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed traits #369',
      description: '',
      organizationId: 'org',
      ownerId: 'trait369|owner',
      e2eFixture: {
        namespace: 'traits-369',
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
      ownerId: 'trait369|owner',
    });
    return { campaignId, otherCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'trait369|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'trait369|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'trait369|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed trait preview',
    kind: 'pc',
    operationId: 'create-traits-369',
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
  const eunuch = reviewedTraitDefinition('Silvertongued Eunuch (Quain)');
  const diplomat = reviewedTraitDefinition('Shadow Diplomat (Shadow Lodge)');
  const betrayal = reviewedTraitDefinition('Betrayal of Trust');
  const misbegotten = reviewedTraitDefinition('Misbegotten');
  for (const definition of [eunuch, diplomat, betrayal, misbegotten])
    expect(
      heldTraits.find((row) => row.externalKey === definition.ruleIdentity)
        ?.disposition,
    ).toBe('held');
  // Character-scoped fixtures exercise the held bodies without a release.
  const ids = await t.run(async (ctx) => {
    const insert = (definition: typeof eunuch) =>
      ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ...definition,
        stacksWithItself: false,
      });
    return {
      eunuch: await insert(eunuch),
      diplomat: await insert(diplomat),
      betrayal: await insert(betrayal),
      misbegotten: await insert(misbegotten),
      foreign: await ctx.db.insert('catalogEntry', {
        scope: 'campaign',
        campaignId: otherCampaignId,
        ...eunuch,
        stacksWithItself: false,
      }),
    };
  });
  const first = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:general',
    position: 0,
    catalogEntryId: ids.eunuch,
    operationId: 'select-eunuch',
  });
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!saved) throw new Error('Missing saved sheet');
  expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
    saved.calculated.derivedStatistics,
  );
  expect([
    saved.calculated.breakdowns['skill.dip'].total,
    saved.calculated.breakdowns['skill.kno'].total,
  ]).toEqual([1, 1]);
  const second = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:general',
    position: 1,
    catalogEntryId: ids.diplomat,
    operationId: 'select-diplomat',
  });
  // Two traits' +1 trait bonuses on Diplomacy don't stack.
  const current = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!current) throw new Error('Missing current sheet');
  expect(current.calculated.breakdowns['skill.dip'].total).toBe(1);
  // Staged replacement equals the saved replacement: Betrayal of Trust for
  // Silvertongued Eunuch, beside Shadow Diplomat.
  const staged = calculateCharacterSheetPreview(current, {
    entries: current.entries.map((row) =>
      row._id === first ? { ...row, catalogEntryId: ids.betrayal } : row,
    ),
  });
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: first,
    catalogEntryId: ids.betrayal,
    operationId: 'replace-with-betrayal',
  });
  const replaced = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!replaced) throw new Error('Missing replaced sheet');
  expect(staged.derivedStatistics).toEqual(
    replaced.calculated.derivedStatistics,
  );
  expect([
    replaced.calculated.breakdowns['skill.dip'].total,
    replaced.calculated.breakdowns['skill.kno'].total,
    replaced.calculated.breakdowns['skill.blf'].total,
  ]).toEqual([1, 0, 2]);
  // The +2 on Bluff and the +4 to conceal infidelity are trait bonuses: with
  // the Situation selected the Bluff total is +4, not +6.
  const situations = betrayal.modifiers.flatMap((row) =>
    row.condition?.situation
      ? [{ ...local(row.condition.situation), sheetEntryId: first }]
      : [],
  );
  expect(situations).toHaveLength(1);
  expect(
    calculateCharacterSheetPreview(replaced, {}, { situations }).breakdowns[
      'skill.blf'
    ].total,
  ).toBe(4);
  expect(replaced.entries.find((row) => row._id === second)).toMatchObject({
    catalogEntryId: ids.diplomat,
  });
  // The drawback slot takes the drawback, whose -2 applies to every
  // Dexterity-based skill, and adds one trait to the budget.
  await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:drawback',
    position: 0,
    catalogEntryId: ids.misbegotten,
    operationId: 'select-misbegotten',
  });
  const drawbackSheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!drawbackSheet) throw new Error('Missing drawback sheet');
  expect(drawbackSheet.calculated.selectionRules.budgets.traits).toBe(3);
  expect([
    drawbackSheet.calculated.breakdowns['skill.acr'].total,
    drawbackSheet.calculated.breakdowns['skill.ste'].total,
    drawbackSheet.calculated.breakdowns['skill.swm'].total,
  ]).toEqual([-2, -2, 0]);
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
  ).toMatchObject({ active: true, catalogEntryId: ids.betrayal });
  expect(await t.query(api.catalogRelease.legalInputs, {})).toBeNull();
});
