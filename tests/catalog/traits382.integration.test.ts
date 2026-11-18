/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { withSheetCatalog } from '../character-sheet-catalog';
import { reviewedTraitDefinition } from '../fixtures/traits-382/sheet';
import { heldTraits } from '../fixtures/traits-382/data';
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
        tokenIdentifier: `trait382|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    }
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed traits #382',
      description: '',
      organizationId: 'org',
      ownerId: 'trait382|owner',
      e2eFixture: {
        namespace: 'traits-382',
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
      ownerId: 'trait382|owner',
    });
    return { campaignId, otherCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'trait382|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'trait382|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'trait382|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed trait preview',
    kind: 'pc',
    operationId: 'create-traits-382',
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
  const chance = reviewedTraitDefinition('Chance Savior (Carrion Crown)');
  const firebrand = reviewedTraitDefinition(
    'Westcrown Firebrand (Council of Thieves)',
  );
  const eagle = reviewedTraitDefinition('Black Eagle Recruit (Lambreth)');
  const dependent = reviewedTraitDefinition('Dependent');
  for (const definition of [chance, firebrand, eagle, dependent])
    expect(
      heldTraits.find((row) => row.externalKey === definition.ruleIdentity)
        ?.disposition,
    ).toBe('held');
  // Character-scoped fixtures exercise the held bodies without a release.
  const ids = await t.run(async (ctx) => {
    const insert = (definition: typeof chance) =>
      ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ...definition,
        stacksWithItself: false,
      });
    return {
      chance: await insert(chance),
      firebrand: await insert(firebrand),
      eagle: await insert(eagle),
      dependent: await insert(dependent),
      foreign: await ctx.db.insert('catalogEntry', {
        scope: 'campaign',
        campaignId: otherCampaignId,
        ...chance,
        stacksWithItself: false,
      }),
    };
  });
  const first = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:general',
    position: 0,
    catalogEntryId: ids.chance,
    operationId: 'select-chance',
  });
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!saved) throw new Error('Missing saved sheet');
  expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
    saved.calculated.derivedStatistics,
  );
  const initiative = saved.calculated.breakdowns.init.total;
  const will = saved.calculated.breakdowns['save.will'].total;
  const diplomacy = saved.calculated.breakdowns['skill.dip'].total;
  const second = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:general',
    position: 1,
    catalogEntryId: ids.firebrand,
    operationId: 'select-firebrand',
  });
  // Westcrown Firebrand's +1 trait bonus on initiative doesn't stack with
  // Chance Savior's +2.
  const current = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!current) throw new Error('Missing current sheet');
  expect(current.calculated.breakdowns.init.total).toBe(initiative);
  // Staged replacement equals the saved replacement: Black Eagle Recruit for
  // Chance Savior, beside Westcrown Firebrand, whose +1 is now the initiative
  // bonus.
  const staged = calculateCharacterSheetPreview(current, {
    entries: current.entries.map((row) =>
      row._id === first ? { ...row, catalogEntryId: ids.eagle } : row,
    ),
  });
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: first,
    catalogEntryId: ids.eagle,
    operationId: 'replace-with-eagle',
  });
  const replaced = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!replaced) throw new Error('Missing replaced sheet');
  expect(staged.derivedStatistics).toEqual(
    replaced.calculated.derivedStatistics,
  );
  expect(replaced.calculated.breakdowns.init.total).toBe(initiative - 1);
  expect(replaced.calculated.breakdowns['save.will'].total).toBe(will);
  // Black Eagle Recruit's +1 against fear uses the shared Situation; an evil
  // outsider's fear effect raises it to +3, its new total.
  const fear = calculateCharacterSheetPreview(
    replaced,
    {},
    { situations: ['fear'] },
  ).breakdowns;
  expect(fear['save.will'].total).toBe(will + 1);
  const evilOutsider = eagle.modifiers.findIndex((row) =>
    JSON.stringify(row.condition?.situation).includes('evil outsider'),
  );
  const evil = calculateCharacterSheetPreview(
    replaced,
    {},
    {
      situations: [
        'fear',
        {
          ...local(eagle.modifiers[evilOutsider]?.condition?.situation),
          sheetEntryId: first,
        },
      ],
    },
  ).breakdowns;
  expect(evil['save.will'].total).toBe(will + 3);
  expect(evil['save.fort'].total - fear['save.fort'].total).toBe(2);
  expect(replaced.entries.find((row) => row._id === second)).toMatchObject({
    catalogEntryId: ids.firebrand,
  });
  // The drawback slot takes the drawback, whose shaken rule stays a readable
  // Note on Diplomacy, and adds one trait to the budget.
  await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:drawback',
    position: 0,
    catalogEntryId: ids.dependent,
    operationId: 'select-dependent',
  });
  const drawbackSheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!drawbackSheet) throw new Error('Missing drawback sheet');
  expect(drawbackSheet.calculated.selectionRules.budgets.traits).toBe(3);
  expect(drawbackSheet.calculated.breakdowns['skill.dip'].total).toBe(
    diplomacy,
  );
  expect(dependent.situationalNotes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        target: 'skill.dip',
        text: 'Whenever you fail a Diplomacy check, you become shaken for 1 hour.',
      }),
    ]),
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
  ).toMatchObject({ active: true, catalogEntryId: ids.eagle });
  expect(await t.query(api.catalogRelease.legalInputs, {})).toBeNull();
});
