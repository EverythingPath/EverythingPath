/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { withSheetCatalog } from '../character-sheet-catalog';
import { reviewedTraitDefinition } from '../fixtures/traits-371/sheet';
import { heldTraits } from '../fixtures/traits-371/data';
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
        tokenIdentifier: `trait371|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    }
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed traits #371',
      description: '',
      organizationId: 'org',
      ownerId: 'trait371|owner',
      e2eFixture: {
        namespace: 'traits-371',
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
      ownerId: 'trait371|owner',
    });
    return { campaignId, otherCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'trait371|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'trait371|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'trait371|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed trait preview',
    kind: 'pc',
    operationId: 'create-traits-371',
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
  const rostlander = reviewedTraitDefinition('Rostlander (Kingmaker)');
  const word = reviewedTraitDefinition("The Word (Tyrant's Grasp)");
  const friends = reviewedTraitDefinition('Friends in High Places');
  const loner = reviewedTraitDefinition('Loner');
  for (const definition of [rostlander, word, friends, loner])
    expect(
      heldTraits.find((row) => row.externalKey === definition.ruleIdentity)
        ?.disposition,
    ).toBe('held');
  // Character-scoped fixtures exercise the held bodies without a release.
  const ids = await t.run(async (ctx) => {
    const insert = (definition: typeof rostlander) =>
      ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ...definition,
        stacksWithItself: false,
      });
    return {
      rostlander: await insert(rostlander),
      word: await insert(word),
      friends: await insert(friends),
      loner: await insert(loner),
      foreign: await ctx.db.insert('catalogEntry', {
        scope: 'campaign',
        campaignId: otherCampaignId,
        ...rostlander,
        stacksWithItself: false,
      }),
    };
  });
  const first = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:general',
    position: 0,
    catalogEntryId: ids.rostlander,
    operationId: 'select-rostlander',
  });
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!saved) throw new Error('Missing saved sheet');
  expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
    saved.calculated.derivedStatistics,
  );
  const fort = saved.calculated.breakdowns['save.fort'].total;
  expect(fort).toBe(1);
  const second = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:general',
    position: 1,
    catalogEntryId: ids.word,
    operationId: 'select-word',
  });
  // Two traits' +1 trait bonuses on Fortitude don't stack.
  const current = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!current) throw new Error('Missing current sheet');
  expect(current.calculated.breakdowns['save.fort'].total).toBe(fort);
  // Staged replacement equals the saved replacement: Friends in High Places
  // for Rostlander, beside The Word, which keeps the Fortitude bonus.
  const staged = calculateCharacterSheetPreview(current, {
    entries: current.entries.map((row) =>
      row._id === first ? { ...row, catalogEntryId: ids.friends } : row,
    ),
  });
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: first,
    catalogEntryId: ids.friends,
    operationId: 'replace-with-friends',
  });
  const replaced = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!replaced) throw new Error('Missing replaced sheet');
  expect(staged.derivedStatistics).toEqual(
    replaced.calculated.derivedStatistics,
  );
  const diplomacy = replaced.calculated.breakdowns['skill.dip'].total;
  expect(replaced.calculated.breakdowns['save.fort'].total).toBe(fort);
  // The +1 where you gathered information and the +2 with officials are
  // trait bonuses: with both Situations selected Diplomacy rises by 2, not 3.
  const situations = friends.modifiers
    .filter((row) => row.target === 'skill.dip')
    .map((row) => ({
      ...local(row.condition?.situation),
      sheetEntryId: first,
    }));
  expect(situations).toHaveLength(2);
  expect(
    calculateCharacterSheetPreview(replaced, {}, { situations }).breakdowns[
      'skill.dip'
    ].total,
  ).toBe(diplomacy + 2);
  expect(
    calculateCharacterSheetPreview(
      replaced,
      {},
      { situations: situations.slice(0, 1) },
    ).breakdowns['skill.dip'].total,
  ).toBe(diplomacy + 1);
  expect(replaced.entries.find((row) => row._id === second)).toMatchObject({
    catalogEntryId: ids.word,
  });
  // The drawback slot takes the drawback, whose penalties wait for their
  // Situation, and adds one trait to the budget.
  const drawback = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:drawback',
    position: 0,
    catalogEntryId: ids.loner,
    operationId: 'select-loner',
  });
  const lonerSheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!lonerSheet) throw new Error('Missing drawback sheet');
  expect(lonerSheet.calculated.selectionRules.budgets.traits).toBe(3);
  const before = lonerSheet.calculated.breakdowns;
  const adjacent = calculateCharacterSheetPreview(
    lonerSheet,
    {},
    {
      situations: [
        {
          ...local(loner.modifiers[0]?.condition?.situation),
          sheetEntryId: drawback,
        },
      ],
    },
  ).breakdowns;
  expect([
    adjacent['attack.melee'].total - before['attack.melee'].total,
    adjacent['ac.other'].total - before['ac.other'].total,
  ]).toEqual([-1, -1]);
  expect(calculateCharacterSheetPreview(lonerSheet).derivedStatistics).toEqual(
    lonerSheet.calculated.derivedStatistics,
  );
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
  ).toMatchObject({ active: true, catalogEntryId: ids.friends });
  expect(await t.query(api.catalogRelease.legalInputs, {})).toBeNull();
});
