/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { withSheetCatalog } from '../character-sheet-catalog';
import { reviewedTraitDefinition } from '../fixtures/traits-384/sheet';
import { heldTraits } from '../fixtures/traits-384/data';
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
        tokenIdentifier: `trait384|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    }
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed traits #384',
      description: '',
      organizationId: 'org',
      ownerId: 'trait384|owner',
      e2eFixture: {
        namespace: 'traits-384',
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
      ownerId: 'trait384|owner',
    });
    return { campaignId, otherCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'trait384|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'trait384|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'trait384|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed trait preview',
    kind: 'pc',
    operationId: 'create-traits-384',
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
  const hotspur = reviewedTraitDefinition('Absalom Hotspur (Absalom)');
  const reactionary = reviewedTraitDefinition('Reactionary');
  const heretic = reviewedTraitDefinition("Heretic's Caution");
  const anxious = reviewedTraitDefinition('Anxious');
  for (const definition of [hotspur, reactionary, heretic, anxious])
    expect(
      heldTraits.find((row) => row.externalKey === definition.ruleIdentity)
        ?.disposition,
    ).toBe('held');
  // Character-scoped fixtures exercise the held bodies without a release.
  const ids = await t.run(async (ctx) => {
    const insert = (definition: typeof hotspur) =>
      ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ...definition,
        stacksWithItself: false,
      });
    return {
      hotspur: await insert(hotspur),
      reactionary: await insert(reactionary),
      heretic: await insert(heretic),
      anxious: await insert(anxious),
      foreign: await ctx.db.insert('catalogEntry', {
        scope: 'campaign',
        campaignId: otherCampaignId,
        ...hotspur,
        stacksWithItself: false,
      }),
    };
  });
  const first = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:general',
    position: 0,
    catalogEntryId: ids.hotspur,
    operationId: 'select-hotspur',
  });
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!saved) throw new Error('Missing saved sheet');
  expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
    saved.calculated.derivedStatistics,
  );
  const initiative = saved.calculated.breakdowns.init.total;
  const knowledgeLocal = saved.calculated.breakdowns['skill.klo'].total;
  const bluff = saved.calculated.breakdowns['skill.blf'].total;
  const diplomacy = saved.calculated.breakdowns['skill.dip'].total;
  const second = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:general',
    position: 1,
    catalogEntryId: ids.reactionary,
    operationId: 'select-reactionary',
  });
  // Reactionary's +2 trait bonus on initiative doesn't stack with Absalom
  // Hotspur's +1: the higher one applies.
  const current = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!current) throw new Error('Missing current sheet');
  expect(current.calculated.breakdowns.init.total).toBe(initiative + 1);
  // Staged replacement equals the saved replacement: Heretic's Caution for
  // Absalom Hotspur, beside Reactionary. Knowledge (local) loses its +1 and
  // Bluff gains the imported +1.
  const staged = calculateCharacterSheetPreview(current, {
    entries: current.entries.map((row) =>
      row._id === first ? { ...row, catalogEntryId: ids.heretic } : row,
    ),
  });
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: first,
    catalogEntryId: ids.heretic,
    operationId: 'replace-with-heretic',
  });
  const replaced = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!replaced) throw new Error('Missing replaced sheet');
  expect(staged.derivedStatistics).toEqual(
    replaced.calculated.derivedStatistics,
  );
  expect(replaced.calculated.breakdowns.init.total).toBe(initiative + 1);
  expect(replaced.calculated.breakdowns['skill.klo'].total).toBe(
    knowledgeLocal - 1,
  );
  expect(replaced.calculated.breakdowns['skill.blf'].total).toBe(bluff + 1);
  // Against religious authorities the Bluff bonus is +3 in all, never +4.
  const authorities = heretic.modifiers.findIndex((row) =>
    JSON.stringify(row.condition?.situation ?? '').includes(
      'religious authorities',
    ),
  );
  const opposed = calculateCharacterSheetPreview(
    replaced,
    {},
    {
      situations: [
        {
          ...localSituation(
            heretic.modifiers[authorities]?.condition?.situation,
          ),
          sheetEntryId: first,
        },
      ],
    },
  ).breakdowns;
  expect(opposed['skill.blf'].total).toBe(bluff + 3);
  expect(replaced.entries.find((row) => row._id === second)).toMatchObject({
    catalogEntryId: ids.reactionary,
  });
  // The drawback slot takes the drawback, whose Diplomacy penalty always
  // applies, and adds one trait to the budget.
  await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:drawback',
    position: 0,
    catalogEntryId: ids.anxious,
    operationId: 'select-anxious',
  });
  const drawbackSheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!drawbackSheet) throw new Error('Missing drawback sheet');
  expect(drawbackSheet.calculated.selectionRules.budgets.traits).toBe(3);
  expect(drawbackSheet.calculated.breakdowns['skill.dip'].total).toBe(
    diplomacy - 2,
  );
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
  ).toMatchObject({ active: true, catalogEntryId: ids.heretic });
  expect(await t.query(api.catalogRelease.legalInputs, {})).toBeNull();
});
