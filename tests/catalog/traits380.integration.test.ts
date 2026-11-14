/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { withSheetCatalog } from '../character-sheet-catalog';
import { reviewedTraitDefinition } from '../fixtures/traits-380/sheet';
import { heldTraits } from '../fixtures/traits-380/data';
import { calculateCharacterSheetPreview } from '../../src/components/character-sheet/calculate-character-sheet-preview';

const modules = import.meta.glob('../../convex/**/*.ts');

function situationOf(scope: unknown) {
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
        tokenIdentifier: `trait380|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    }
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed traits #380',
      description: '',
      organizationId: 'org',
      ownerId: 'trait380|owner',
      e2eFixture: {
        namespace: 'traits-380',
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
      ownerId: 'trait380|owner',
    });
    return { campaignId, otherCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'trait380|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'trait380|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'trait380|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed trait preview',
    kind: 'pc',
    operationId: 'create-traits-380',
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
  const devotee = reviewedTraitDefinition(
    "Devotee of the Old Gods (Mummy's Mask)",
  );
  const traditionalist = reviewedTraitDefinition(
    'Traditionalist (Faiths and Philosophies)',
  );
  const arodenite = reviewedTraitDefinition('Faithful Arodenite (Aroden)');
  const oblivious = reviewedTraitDefinition('Oblivious');
  for (const definition of [devotee, traditionalist, arodenite, oblivious])
    expect(
      heldTraits.find((row) => row.externalKey === definition.ruleIdentity)
        ?.disposition,
    ).toBe('held');
  // Character-scoped fixtures exercise the held bodies without a release.
  const ids = await t.run(async (ctx) => {
    const insert = (definition: typeof devotee) =>
      ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ...definition,
        stacksWithItself: false,
      });
    return {
      devotee: await insert(devotee),
      traditionalist: await insert(traditionalist),
      arodenite: await insert(arodenite),
      oblivious: await insert(oblivious),
      foreign: await ctx.db.insert('catalogEntry', {
        scope: 'campaign',
        campaignId: otherCampaignId,
        ...devotee,
        stacksWithItself: false,
      }),
    };
  });
  const first = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:general',
    position: 0,
    catalogEntryId: ids.devotee,
    operationId: 'select-devotee',
  });
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!saved) throw new Error('Missing saved sheet');
  expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
    saved.calculated.derivedStatistics,
  );
  const history = saved.calculated.breakdowns['skill.khi'].total;
  const local = saved.calculated.breakdowns['skill.klo'].total;
  const diplomacy = saved.calculated.breakdowns['skill.dip'].total;
  const second = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:general',
    position: 1,
    catalogEntryId: ids.traditionalist,
    operationId: 'select-traditionalist',
  });
  // Traditionalist's +1 trait bonus on Knowledge (history) doesn't stack with
  // Devotee of the Old Gods'; its Knowledge (local) bonus applies.
  const current = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!current) throw new Error('Missing current sheet');
  expect(current.calculated.breakdowns['skill.khi'].total).toBe(history);
  expect(current.calculated.breakdowns['skill.klo'].total).toBe(local + 1);
  // Staged replacement equals the saved replacement: Faithful Arodenite for
  // Devotee of the Old Gods, beside Traditionalist, whose +1 is now the
  // Knowledge (history) bonus.
  const staged = calculateCharacterSheetPreview(current, {
    entries: current.entries.map((row) =>
      row._id === first ? { ...row, catalogEntryId: ids.arodenite } : row,
    ),
  });
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: first,
    catalogEntryId: ids.arodenite,
    operationId: 'replace-with-arodenite',
  });
  const replaced = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!replaced) throw new Error('Missing replaced sheet');
  expect(staged.derivedStatistics).toEqual(
    replaced.calculated.derivedStatistics,
  );
  expect(replaced.calculated.breakdowns['skill.khi'].total).toBe(history);
  expect(replaced.calculated.breakdowns['skill.dip'].total).toBe(diplomacy + 1);
  // Dealing with a follower of Aroden or Iomedae: the +1 trait bonus becomes
  // +3, not +4.
  const follower = arodenite.modifiers.findIndex(
    (row) => row.target === 'skill.dip' && row.condition?.situation,
  );
  expect(
    calculateCharacterSheetPreview(
      replaced,
      {},
      {
        situations: [
          {
            ...situationOf(arodenite.modifiers[follower]?.condition?.situation),
            sheetEntryId: first,
          },
        ],
      },
    ).breakdowns['skill.dip'].total,
  ).toBe(diplomacy + 3);
  expect(replaced.entries.find((row) => row._id === second)).toMatchObject({
    catalogEntryId: ids.traditionalist,
  });
  // The drawback slot takes the drawback, whose Sense Motive penalty always
  // applies and whose sight-based Perception penalty waits for its
  // Situation, and adds one trait to the budget.
  const drawback = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:drawback',
    position: 0,
    catalogEntryId: ids.oblivious,
    operationId: 'select-oblivious',
  });
  const drawbackSheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!drawbackSheet) throw new Error('Missing drawback sheet');
  expect(drawbackSheet.calculated.selectionRules.budgets.traits).toBe(3);
  const before = drawbackSheet.calculated.breakdowns;
  expect(before['skill.sen'].total).toBe(
    replaced.calculated.breakdowns['skill.sen'].total - 2,
  );
  expect(before['skill.per'].total).toBe(
    replaced.calculated.breakdowns['skill.per'].total,
  );
  const sight = oblivious.modifiers.findIndex(
    (row) => row.target === 'skill.per',
  );
  const penalized = calculateCharacterSheetPreview(
    drawbackSheet,
    {},
    {
      situations: [
        {
          ...situationOf(oblivious.modifiers[sight]?.condition?.situation),
          sheetEntryId: drawback,
        },
      ],
    },
  ).breakdowns;
  expect(penalized['skill.per'].total - before['skill.per'].total).toBe(-2);
  expect(penalized['skill.sen'].total - before['skill.sen'].total).toBe(0);
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
  ).toMatchObject({ active: true, catalogEntryId: ids.arodenite });
  expect(await t.query(api.catalogRelease.legalInputs, {})).toBeNull();
});
