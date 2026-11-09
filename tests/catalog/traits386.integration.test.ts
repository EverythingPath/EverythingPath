/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { withSheetCatalog } from '../character-sheet-catalog';
import { reviewedTraitDefinition } from '../fixtures/traits-386/sheet';
import { heldTraits } from '../fixtures/traits-386/data';
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
        tokenIdentifier: `trait386|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    }
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed traits #386',
      description: '',
      organizationId: 'org',
      ownerId: 'trait386|owner',
      e2eFixture: {
        namespace: 'traits-386',
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
      ownerId: 'trait386|owner',
    });
    return { campaignId, otherCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'trait386|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'trait386|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'trait386|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed trait preview',
    kind: 'pc',
    operationId: 'create-traits-386',
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
  const shenmen = reviewedTraitDefinition('Shenmen Prospector (Shenmen)');
  const crafter = reviewedTraitDefinition('Magic Crafter');
  const ties = reviewedTraitDefinition('Local Ties (Iron Gods)');
  const lonely = reviewedTraitDefinition('Lonely');
  for (const definition of [shenmen, crafter, ties, lonely])
    expect(
      heldTraits.find((row) => row.externalKey === definition.ruleIdentity)
        ?.disposition,
    ).toBe('held');
  // Character-scoped fixtures exercise the held bodies without a release.
  const ids = await t.run(async (ctx) => {
    const insert = (definition: typeof shenmen) =>
      ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ...definition,
        stacksWithItself: false,
      });
    return {
      shenmen: await insert(shenmen),
      crafter: await insert(crafter),
      ties: await insert(ties),
      lonely: await insert(lonely),
      foreign: await ctx.db.insert('catalogEntry', {
        scope: 'campaign',
        campaignId: otherCampaignId,
        ...shenmen,
        stacksWithItself: false,
      }),
    };
  });
  const first = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:general',
    position: 0,
    catalogEntryId: ids.shenmen,
    operationId: 'select-shenmen',
  });
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!saved) throw new Error('Missing saved sheet');
  expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
    saved.calculated.derivedStatistics,
  );
  const appraise = saved.calculated.breakdowns['skill.apr'].total;
  const dungeoneering = saved.calculated.breakdowns['skill.kdu'].total;
  const disable = saved.calculated.breakdowns['skill.dev'].total;
  const senseMotive = saved.calculated.breakdowns['skill.sen'].total;
  const second = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:general',
    position: 1,
    catalogEntryId: ids.crafter,
    operationId: 'select-crafter',
  });
  // Magic Crafter's +1 trait bonus on Appraise doesn't stack with Shenmen
  // Prospector's +1.
  const current = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!current) throw new Error('Missing current sheet');
  expect(current.calculated.breakdowns['skill.apr'].total).toBe(appraise);
  // Staged replacement equals the saved replacement: Local Ties for Shenmen
  // Prospector, beside Magic Crafter. Knowledge (dungeoneering) loses its +1,
  // Appraise keeps Magic Crafter's +1 and the reviewed change replacements
  // keep Disable Device unchanged until the choice Situation is selected.
  const staged = calculateCharacterSheetPreview(current, {
    entries: current.entries.map((row) =>
      row._id === first ? { ...row, catalogEntryId: ids.ties } : row,
    ),
  });
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: first,
    catalogEntryId: ids.ties,
    operationId: 'replace-with-ties',
  });
  const replaced = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!replaced) throw new Error('Missing replaced sheet');
  expect(staged.derivedStatistics).toEqual(
    replaced.calculated.derivedStatistics,
  );
  expect(replaced.calculated.breakdowns['skill.apr'].total).toBe(appraise);
  expect(replaced.calculated.breakdowns['skill.kdu'].total).toBe(
    dungeoneering - 1,
  );
  expect(replaced.calculated.breakdowns['skill.dev'].total).toBe(disable);
  // With the Technologist feat the chosen Disable Device bonus is +3 in all.
  const technologist = ties.modifiers.findIndex((row) =>
    JSON.stringify(row.condition?.situation ?? '').includes(
      'Disable Device and possess the Technologist feat',
    ),
  );
  const chosen = calculateCharacterSheetPreview(
    replaced,
    {},
    {
      situations: [
        {
          ...localSituation(ties.modifiers[technologist]?.condition?.situation),
          sheetEntryId: first,
        },
      ],
    },
  ).breakdowns;
  expect(chosen['skill.dev'].total).toBe(disable + 3);
  expect(replaced.entries.find((row) => row._id === second)).toMatchObject({
    catalogEntryId: ids.crafter,
  });
  // The drawback slot takes the drawback, whose Sense Motive penalty always
  // applies, and adds one trait to the budget.
  await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:drawback',
    position: 0,
    catalogEntryId: ids.lonely,
    operationId: 'select-lonely',
  });
  const drawbackSheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!drawbackSheet) throw new Error('Missing drawback sheet');
  expect(drawbackSheet.calculated.selectionRules.budgets.traits).toBe(3);
  expect(drawbackSheet.calculated.breakdowns['skill.sen'].total).toBe(
    senseMotive - 2,
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
  ).toMatchObject({ active: true, catalogEntryId: ids.ties });
  expect(await t.query(api.catalogRelease.legalInputs, {})).toBeNull();
});
