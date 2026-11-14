/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { withSheetCatalog } from '../character-sheet-catalog';
import { reviewedTraitDefinition } from '../fixtures/traits-385/sheet';
import { heldTraits } from '../fixtures/traits-385/data';
import { calculateCharacterSheetPreview } from '../../src/components/character-sheet/calculate-character-sheet-preview';

const modules = import.meta.glob('../../convex/**/*.ts');

function localSituation(scope: unknown) {
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
        tokenIdentifier: `trait385|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    }
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed traits #385',
      description: '',
      organizationId: 'org',
      ownerId: 'trait385|owner',
      e2eFixture: {
        namespace: 'traits-385',
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
      ownerId: 'trait385|owner',
    });
    return { campaignId, otherCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'trait385|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'trait385|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'trait385|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed trait preview',
    kind: 'pc',
    operationId: 'create-traits-385',
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
  const smuggler = reviewedTraitDefinition('Undermarket Smuggler (Goka)');
  const advocate = reviewedTraitDefinition('Minkai Advocate (Minkai)');
  const loner = reviewedTraitDefinition('Loner of the Rocks (Oread)');
  const attached = reviewedTraitDefinition('Attached');
  for (const definition of [smuggler, advocate, loner, attached])
    expect(
      heldTraits.find((row) => row.externalKey === definition.ruleIdentity)
        ?.disposition,
    ).toBe('held');
  // Character-scoped fixtures exercise the held bodies without a release.
  const ids = await t.run(async (ctx) => {
    const insert = (definition: typeof smuggler) =>
      ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ...definition,
        stacksWithItself: false,
      });
    return {
      smuggler: await insert(smuggler),
      advocate: await insert(advocate),
      loner: await insert(loner),
      attached: await insert(attached),
      foreign: await ctx.db.insert('catalogEntry', {
        scope: 'campaign',
        campaignId: otherCampaignId,
        ...smuggler,
        stacksWithItself: false,
      }),
    };
  });
  const first = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:general',
    position: 0,
    catalogEntryId: ids.smuggler,
    operationId: 'select-smuggler',
  });
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!saved) throw new Error('Missing saved sheet');
  expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
    saved.calculated.derivedStatistics,
  );
  const bluff = saved.calculated.breakdowns['skill.blf'].total;
  const sleight = saved.calculated.breakdowns['skill.slt'].total;
  const survival = saved.calculated.breakdowns['skill.sur'].total;
  const heal = saved.calculated.breakdowns['skill.hea'].total;
  const will = saved.calculated.breakdowns['save.will'].total;
  const second = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:general',
    position: 1,
    catalogEntryId: ids.advocate,
    operationId: 'select-advocate',
  });
  // Minkai Advocate's +1 trait bonus on Bluff doesn't stack with Undermarket
  // Smuggler's +1.
  const current = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!current) throw new Error('Missing current sheet');
  expect(current.calculated.breakdowns['skill.blf'].total).toBe(bluff);
  // Staged replacement equals the saved replacement: Loner of the Rocks for
  // Undermarket Smuggler, beside Minkai Advocate. Sleight of Hand loses its
  // +1; Heal and Survival gain the imported +1; Bluff keeps Minkai's +1.
  const staged = calculateCharacterSheetPreview(current, {
    entries: current.entries.map((row) =>
      row._id === first ? { ...row, catalogEntryId: ids.loner } : row,
    ),
  });
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: first,
    catalogEntryId: ids.loner,
    operationId: 'replace-with-loner',
  });
  const replaced = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!replaced) throw new Error('Missing replaced sheet');
  expect(staged.derivedStatistics).toEqual(
    replaced.calculated.derivedStatistics,
  );
  expect(replaced.calculated.breakdowns['skill.blf'].total).toBe(bluff);
  expect(replaced.calculated.breakdowns['skill.slt'].total).toBe(sleight - 1);
  expect(replaced.calculated.breakdowns['skill.sur'].total).toBe(survival + 1);
  expect(replaced.calculated.breakdowns['skill.hea'].total).toBe(heal + 1);
  // In underground or mountain environments the Survival bonus is +2 in all,
  // never +3.
  const mountains = loner.modifiers.findIndex((row) =>
    JSON.stringify(row.condition?.situation ?? '').includes('mountain'),
  );
  const outdoors = calculateCharacterSheetPreview(
    replaced,
    {},
    {
      situations: [
        {
          ...localSituation(loner.modifiers[mountains]?.condition?.situation),
          sheetEntryId: first,
        },
      ],
    },
  ).breakdowns;
  expect(outdoors['skill.sur'].total).toBe(survival + 2);
  expect(replaced.entries.find((row) => row._id === second)).toMatchObject({
    catalogEntryId: ids.advocate,
  });
  // The drawback slot takes the drawback, whose Will penalty applies only in
  // its Situation, and adds one trait to the budget.
  const drawback = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:drawback',
    position: 0,
    catalogEntryId: ids.attached,
    operationId: 'select-attached',
  });
  const drawbackSheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!drawbackSheet) throw new Error('Missing drawback sheet');
  expect(drawbackSheet.calculated.selectionRules.budgets.traits).toBe(3);
  expect(drawbackSheet.calculated.breakdowns['save.will'].total).toBe(will);
  const threatened = attached.modifiers.findIndex(
    (row) => row.target === 'save.will',
  );
  expect(
    calculateCharacterSheetPreview(
      drawbackSheet,
      {},
      {
        situations: [
          {
            ...localSituation(
              attached.modifiers[threatened]?.condition?.situation,
            ),
            sheetEntryId: drawback,
          },
        ],
      },
    ).breakdowns['save.will'].total,
  ).toBe(will - 1);
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
  ).toMatchObject({ active: true, catalogEntryId: ids.loner });
  expect(await t.query(api.catalogRelease.legalInputs, {})).toBeNull();
});
