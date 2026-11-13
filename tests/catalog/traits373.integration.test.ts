/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { withSheetCatalog } from '../character-sheet-catalog';
import { reviewedTraitDefinition } from '../fixtures/traits-373/sheet';
import { heldTraits } from '../fixtures/traits-373/data';
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
        tokenIdentifier: `trait373|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    }
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed traits #373',
      description: '',
      organizationId: 'org',
      ownerId: 'trait373|owner',
      e2eFixture: {
        namespace: 'traits-373',
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
      ownerId: 'trait373|owner',
    });
    return { campaignId, otherCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'trait373|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'trait373|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'trait373|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed trait preview',
    kind: 'pc',
    operationId: 'create-traits-373',
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
  const traditionalist = reviewedTraitDefinition(
    'Traditionalist (Divine Anthology)',
  );
  const tactician = reviewedTraitDefinition('Crusader Tactician (Lastwall)');
  const creative = reviewedTraitDefinition('Creative Reality (Ganzi)');
  const fraud = reviewedTraitDefinition('Guilty Fraud');
  for (const definition of [traditionalist, tactician, creative, fraud])
    expect(
      heldTraits.find((row) => row.externalKey === definition.ruleIdentity)
        ?.disposition,
    ).toBe('held');
  // Character-scoped fixtures exercise the held bodies without a release.
  const ids = await t.run(async (ctx) => {
    const insert = (definition: typeof traditionalist) =>
      ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ...definition,
        stacksWithItself: false,
      });
    return {
      traditionalist: await insert(traditionalist),
      tactician: await insert(tactician),
      creative: await insert(creative),
      fraud: await insert(fraud),
      foreign: await ctx.db.insert('catalogEntry', {
        scope: 'campaign',
        campaignId: otherCampaignId,
        ...traditionalist,
        stacksWithItself: false,
      }),
    };
  });
  const first = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:general',
    position: 0,
    catalogEntryId: ids.traditionalist,
    operationId: 'select-traditionalist',
  });
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!saved) throw new Error('Missing saved sheet');
  expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
    saved.calculated.derivedStatistics,
  );
  const nobility = saved.calculated.breakdowns['skill.kno'].total;
  const engineering = saved.calculated.breakdowns['skill.ken'].total;
  const bluff = saved.calculated.breakdowns['skill.blf'].total;
  const second = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:general',
    position: 1,
    catalogEntryId: ids.tactician,
    operationId: 'select-tactician',
  });
  // Crusader Tactician's +1 trait bonus on Knowledge (nobility) doesn't stack
  // with Traditionalist's; its Knowledge (engineering) bonus applies.
  const current = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!current) throw new Error('Missing current sheet');
  expect(current.calculated.breakdowns['skill.kno'].total).toBe(nobility);
  expect(current.calculated.breakdowns['skill.ken'].total).toBe(
    engineering + 1,
  );
  // Staged replacement equals the saved replacement: Creative Reality for
  // Traditionalist, beside Crusader Tactician, whose +1 is now the
  // Knowledge (nobility) bonus.
  const staged = calculateCharacterSheetPreview(current, {
    entries: current.entries.map((row) =>
      row._id === first ? { ...row, catalogEntryId: ids.creative } : row,
    ),
  });
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: first,
    catalogEntryId: ids.creative,
    operationId: 'replace-with-creative',
  });
  const replaced = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!replaced) throw new Error('Missing replaced sheet');
  expect(staged.derivedStatistics).toEqual(
    replaced.calculated.derivedStatistics,
  );
  expect(replaced.calculated.breakdowns['skill.kno'].total).toBe(nobility);
  expect(replaced.calculated.breakdowns['skill.blf'].total).toBe(bluff + 1);
  // Convincing someone an honest answer is a falsehood: the +1 trait bonus
  // becomes +5, not +6.
  const falsehood = creative.modifiers.findIndex(
    (row) => row.target === 'skill.blf' && row.condition?.situation,
  );
  expect(
    calculateCharacterSheetPreview(
      replaced,
      {},
      {
        situations: [
          {
            ...local(creative.modifiers[falsehood]?.condition?.situation),
            sheetEntryId: first,
          },
        ],
      },
    ).breakdowns['skill.blf'].total,
  ).toBe(bluff + 5);
  expect(replaced.entries.find((row) => row._id === second)).toMatchObject({
    catalogEntryId: ids.tactician,
  });
  // The drawback slot takes the drawback, whose Bluff penalty waits for its
  // Situation, and adds one trait to the budget.
  const drawback = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:drawback',
    position: 0,
    catalogEntryId: ids.fraud,
    operationId: 'select-fraud',
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
  const indifferent = calculateCharacterSheetPreview(
    drawbackSheet,
    {},
    {
      situations: [
        {
          ...local(fraud.modifiers[0]?.condition?.situation),
          sheetEntryId: drawback,
        },
      ],
    },
  ).breakdowns;
  expect(indifferent['skill.blf'].total - before['skill.blf'].total).toBe(-4);
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
  ).toMatchObject({ active: true, catalogEntryId: ids.creative });
  expect(await t.query(api.catalogRelease.legalInputs, {})).toBeNull();
});
