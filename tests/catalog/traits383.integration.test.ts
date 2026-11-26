/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { withSheetCatalog } from '../character-sheet-catalog';
import { reviewedTraitDefinition } from '../fixtures/traits-383/sheet';
import { heldTraits } from '../fixtures/traits-383/data';
import { calculateCharacterSheetPreview } from '../../src/components/character-sheet/calculate-character-sheet-preview';

const modules = import.meta.glob('../../convex/**/*.ts');

function local_(scope: unknown) {
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
        tokenIdentifier: `trait383|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    }
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed traits #383',
      description: '',
      organizationId: 'org',
      ownerId: 'trait383|owner',
      e2eFixture: {
        namespace: 'traits-383',
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
      ownerId: 'trait383|owner',
    });
    return { campaignId, otherCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'trait383|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'trait383|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'trait383|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed trait preview',
    kind: 'pc',
    operationId: 'create-traits-383',
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
  const instigator = reviewedTraitDefinition(
    'Instigator of Rebellion (Minkai)',
  );
  const friend = reviewedTraitDefinition('Friend in Every Town');
  const explorer = reviewedTraitDefinition('Open-Minded Explorer (Averaka)');
  const vainglory = reviewedTraitDefinition('Vainglory');
  for (const definition of [instigator, friend, explorer, vainglory])
    expect(
      heldTraits.find((row) => row.externalKey === definition.ruleIdentity)
        ?.disposition,
    ).toBe('held');
  // Character-scoped fixtures exercise the held bodies without a release.
  const ids = await t.run(async (ctx) => {
    const insert = (definition: typeof instigator) =>
      ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ...definition,
        stacksWithItself: false,
      });
    return {
      instigator: await insert(instigator),
      friend: await insert(friend),
      explorer: await insert(explorer),
      vainglory: await insert(vainglory),
      foreign: await ctx.db.insert('catalogEntry', {
        scope: 'campaign',
        campaignId: otherCampaignId,
        ...instigator,
        stacksWithItself: false,
      }),
    };
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!before) throw new Error('Missing base sheet');
  const diplomacy = before.calculated.breakdowns['skill.dip'].total;
  const intimidate = before.calculated.breakdowns['skill.int'].total;
  const local = before.calculated.breakdowns['skill.klo'].total;
  const bluff = before.calculated.breakdowns['skill.blf'].total;
  const first = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:general',
    position: 0,
    catalogEntryId: ids.instigator,
    operationId: 'select-instigator',
  });
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!saved) throw new Error('Missing saved sheet');
  expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
    saved.calculated.derivedStatistics,
  );
  expect(saved.calculated.breakdowns['skill.dip'].total).toBe(diplomacy + 1);
  expect(saved.calculated.breakdowns['skill.int'].total).toBe(intimidate + 1);
  const second = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:general',
    position: 1,
    catalogEntryId: ids.friend,
    operationId: 'select-friend',
  });
  // Friend in Every Town's +1 trait bonus on Diplomacy doesn't stack with
  // Instigator of Rebellion's; its Knowledge (local) bonus applies.
  const current = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!current) throw new Error('Missing current sheet');
  expect(current.calculated.breakdowns['skill.dip'].total).toBe(diplomacy + 1);
  expect(current.calculated.breakdowns['skill.klo'].total).toBe(local + 1);
  // Staged replacement equals the saved replacement: Open-Minded Explorer
  // for Instigator of Rebellion, beside Friend in Every Town.
  const staged = calculateCharacterSheetPreview(current, {
    entries: current.entries.map((row) =>
      row._id === first ? { ...row, catalogEntryId: ids.explorer } : row,
    ),
  });
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: first,
    catalogEntryId: ids.explorer,
    operationId: 'replace-with-explorer',
  });
  const replaced = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!replaced) throw new Error('Missing replaced sheet');
  expect(staged.derivedStatistics).toEqual(
    replaced.calculated.derivedStatistics,
  );
  expect(replaced.calculated.breakdowns['skill.dip'].total).toBe(diplomacy + 1);
  expect(replaced.calculated.breakdowns['skill.int'].total).toBe(intimidate);
  // Speaking the target's racial or ethnic language raises Open-Minded
  // Explorer's bonus to +2, its new total; Friend in Every Town's +1 doesn't
  // add to it.
  const language = explorer.modifiers.findIndex((row) =>
    JSON.stringify(row.condition?.situation ?? '').includes('racial or ethnic'),
  );
  const speaking = calculateCharacterSheetPreview(
    replaced,
    {},
    {
      situations: [
        {
          ...local_(explorer.modifiers[language]?.condition?.situation),
          sheetEntryId: first,
        },
      ],
    },
  ).breakdowns;
  expect(speaking['skill.dip'].total).toBe(diplomacy + 2);
  expect(replaced.entries.find((row) => row._id === second)).toMatchObject({
    catalogEntryId: ids.friend,
  });
  // The drawback slot takes Vainglory, whose untyped -1 on Bluff applies,
  // and adds one trait to the budget.
  await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:drawback',
    position: 0,
    catalogEntryId: ids.vainglory,
    operationId: 'select-vainglory',
  });
  const drawbackSheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!drawbackSheet) throw new Error('Missing drawback sheet');
  expect(drawbackSheet.calculated.selectionRules.budgets.traits).toBe(3);
  expect(drawbackSheet.calculated.breakdowns['skill.blf'].total).toBe(
    bluff - 1,
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
  ).toMatchObject({ active: true, catalogEntryId: ids.explorer });
  expect(await t.query(api.catalogRelease.legalInputs, {})).toBeNull();
});
