/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { withSheetCatalog } from '../character-sheet-catalog';
import { reviewedTraitDefinition } from '../fixtures/traits-377/sheet';
import { heldTraits } from '../fixtures/traits-377/data';
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
        tokenIdentifier: `trait377|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    }
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed traits #377',
      description: '',
      organizationId: 'org',
      ownerId: 'trait377|owner',
      e2eFixture: {
        namespace: 'traits-377',
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
      ownerId: 'trait377|owner',
    });
    return { campaignId, otherCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'trait377|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'trait377|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'trait377|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed trait preview',
    kind: 'pc',
    operationId: 'create-traits-377',
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
  const quester = reviewedTraitDefinition('Sky Quester (Dwarf)');
  const inheritor = reviewedTraitDefinition(
    'Azlanti Inheritor (Human; Azlanti)',
  );
  const worshiper = reviewedTraitDefinition('Sky Spirit Worshiper (Shanguang)');
  const vain = reviewedTraitDefinition('Vain');
  for (const definition of [quester, inheritor, worshiper, vain])
    expect(
      heldTraits.find((row) => row.externalKey === definition.ruleIdentity)
        ?.disposition,
    ).toBe('held');
  // Character-scoped fixtures exercise the held bodies without a release.
  const ids = await t.run(async (ctx) => {
    const insert = (definition: typeof quester) =>
      ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ...definition,
        stacksWithItself: false,
      });
    return {
      quester: await insert(quester),
      inheritor: await insert(inheritor),
      worshiper: await insert(worshiper),
      vain: await insert(vain),
      foreign: await ctx.db.insert('catalogEntry', {
        scope: 'campaign',
        campaignId: otherCampaignId,
        ...quester,
        stacksWithItself: false,
      }),
    };
  });
  const first = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:general',
    position: 0,
    catalogEntryId: ids.quester,
    operationId: 'select-quester',
  });
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!saved) throw new Error('Missing saved sheet');
  expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
    saved.calculated.derivedStatistics,
  );
  const history = saved.calculated.breakdowns['skill.khi'].total;
  const appraise = saved.calculated.breakdowns['skill.apr'].total;
  const will = saved.calculated.breakdowns['save.will'].total;
  const fortitude = saved.calculated.breakdowns['save.fort'].total;
  const second = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:general',
    position: 1,
    catalogEntryId: ids.inheritor,
    operationId: 'select-inheritor',
  });
  // Azlanti Inheritor's +1 trait bonus on Knowledge (history) doesn't stack
  // with Sky Quester's; for an Azlanti object its +2 applies to Appraise.
  const current = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!current) throw new Error('Missing current sheet');
  expect(current.calculated.breakdowns['skill.khi'].total).toBe(history);
  const azlantiIndex = inheritor.modifiers.findIndex(
    (row) => row.target === 'skill.apr' && row.condition?.situation,
  );
  const azlanti = calculateCharacterSheetPreview(
    current,
    {},
    {
      situations: [
        {
          ...local(inheritor.modifiers[azlantiIndex]?.condition?.situation),
          sheetEntryId: second,
        },
      ],
    },
  ).breakdowns;
  expect([azlanti['skill.apr'].total, azlanti['skill.khi'].total]).toEqual([
    appraise + 2,
    history,
  ]);
  // Staged replacement equals the saved replacement: Sky Spirit Worshiper
  // for Sky Quester, beside Azlanti Inheritor, whose +1 is now the Knowledge
  // (history) bonus.
  const staged = calculateCharacterSheetPreview(current, {
    entries: current.entries.map((row) =>
      row._id === first ? { ...row, catalogEntryId: ids.worshiper } : row,
    ),
  });
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: first,
    catalogEntryId: ids.worshiper,
    operationId: 'replace-with-worshiper',
  });
  const replaced = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!replaced) throw new Error('Missing replaced sheet');
  expect(staged.derivedStatistics).toEqual(
    replaced.calculated.derivedStatistics,
  );
  expect(replaced.calculated.breakdowns['skill.khi'].total).toBe(history);
  expect(replaced.calculated.breakdowns['skill.kge'].total).toBe(
    saved.calculated.breakdowns['skill.kge'].total - 1,
  );
  // Against fear, Sky Spirit Worshiper's +2 trait bonus applies to every save.
  const fear = calculateCharacterSheetPreview(
    replaced,
    {},
    { situations: ['fear'] },
  ).breakdowns;
  expect([fear['save.fort'].total, fear['save.will'].total]).toEqual([
    fortitude + 2,
    will + 2,
  ]);
  expect(replaced.entries.find((row) => row._id === second)).toMatchObject({
    catalogEntryId: ids.inheritor,
  });
  // The drawback slot takes the drawback, whose Charisma-based skill penalty
  // waits for its Situation, and adds one trait to the budget.
  const drawback = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:drawback',
    position: 0,
    catalogEntryId: ids.vain,
    operationId: 'select-vain',
  });
  const drawbackSheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!drawbackSheet) throw new Error('Missing drawback sheet');
  expect(drawbackSheet.calculated.selectionRules.budgets.traits).toBe(3);
  const before = drawbackSheet.calculated.breakdowns;
  expect(before['skill.blf'].total).toBe(
    replaced.calculated.breakdowns['skill.blf'].total,
  );
  const failed = calculateCharacterSheetPreview(
    drawbackSheet,
    {},
    {
      situations: [
        {
          ...local(vain.modifiers[0]?.condition?.situation),
          sheetEntryId: drawback,
        },
      ],
    },
  ).breakdowns;
  expect(failed['skill.blf'].total - before['skill.blf'].total).toBe(-2);
  expect(failed['skill.dip'].total - before['skill.dip'].total).toBe(-2);
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
  ).toMatchObject({ active: true, catalogEntryId: ids.worshiper });
  expect(await t.query(api.catalogRelease.legalInputs, {})).toBeNull();
});
