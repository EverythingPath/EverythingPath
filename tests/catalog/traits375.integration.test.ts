/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { withSheetCatalog } from '../character-sheet-catalog';
import { reviewedTraitDefinition } from '../fixtures/traits-375/sheet';
import { heldTraits } from '../fixtures/traits-375/data';
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
        tokenIdentifier: `trait375|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    }
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed traits #375',
      description: '',
      organizationId: 'org',
      ownerId: 'trait375|owner',
      e2eFixture: {
        namespace: 'traits-375',
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
      ownerId: 'trait375|owner',
    });
    return { campaignId, otherCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'trait375|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'trait375|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'trait375|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed trait preview',
    kind: 'pc',
    operationId: 'create-traits-375',
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
  const organizer = reviewedTraitDefinition('Talented Organizer (Milani)');
  const outcast = reviewedTraitDefinition("Outcast's Intuition");
  const money = reviewedTraitDefinition('For the Money');
  const pride = reviewedTraitDefinition('Pride');
  for (const definition of [organizer, outcast, money, pride])
    expect(
      heldTraits.find((row) => row.externalKey === definition.ruleIdentity)
        ?.disposition,
    ).toBe('held');
  // Character-scoped fixtures exercise the held bodies without a release.
  const ids = await t.run(async (ctx) => {
    const insert = (definition: typeof organizer) =>
      ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ...definition,
        stacksWithItself: false,
      });
    return {
      organizer: await insert(organizer),
      outcast: await insert(outcast),
      money: await insert(money),
      pride: await insert(pride),
      foreign: await ctx.db.insert('catalogEntry', {
        scope: 'campaign',
        campaignId: otherCampaignId,
        ...organizer,
        stacksWithItself: false,
      }),
    };
  });
  const first = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:general',
    position: 0,
    catalogEntryId: ids.organizer,
    operationId: 'select-organizer',
  });
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!saved) throw new Error('Missing saved sheet');
  expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
    saved.calculated.derivedStatistics,
  );
  const senseMotive = saved.calculated.breakdowns['skill.sen'].total;
  const appraise = saved.calculated.breakdowns['skill.apr'].total;
  const diplomacy = saved.calculated.breakdowns['skill.dip'].total;
  const second = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:general',
    position: 1,
    catalogEntryId: ids.outcast,
    operationId: 'select-outcast',
  });
  // Outcast's Intuition's +1 trait bonus on Sense Motive doesn't stack with
  // Talented Organizer's.
  const current = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!current) throw new Error('Missing current sheet');
  expect(current.calculated.breakdowns['skill.sen'].total).toBe(senseMotive);
  // Staged replacement equals the saved replacement: For the Money for
  // Talented Organizer, beside Outcast's Intuition, whose +1 is now the
  // Sense Motive bonus.
  const staged = calculateCharacterSheetPreview(current, {
    entries: current.entries.map((row) =>
      row._id === first ? { ...row, catalogEntryId: ids.money } : row,
    ),
  });
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: first,
    catalogEntryId: ids.money,
    operationId: 'replace-with-money',
  });
  const replaced = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!replaced) throw new Error('Missing replaced sheet');
  expect(staged.derivedStatistics).toEqual(
    replaced.calculated.derivedStatistics,
  );
  expect(replaced.calculated.breakdowns['skill.sen'].total).toBe(senseMotive);
  expect(replaced.calculated.breakdowns['skill.apr'].total).toBe(appraise + 1);
  // Haggling from a position of power: the +1 trait bonus on Appraise
  // becomes +4, not +5.
  const power = money.modifiers.findIndex(
    (row) =>
      row.target === 'skills' &&
      JSON.stringify(row.condition?.situation).includes('position of'),
  );
  expect(
    calculateCharacterSheetPreview(
      replaced,
      {},
      {
        situations: [
          {
            ...local(money.modifiers[power]?.condition?.situation),
            sheetEntryId: first,
          },
        ],
      },
    ).breakdowns['skill.apr'].total,
  ).toBe(appraise + 4);
  expect(replaced.entries.find((row) => row._id === second)).toMatchObject({
    catalogEntryId: ids.outcast,
  });
  // The drawback slot takes the drawback, whose penalties wait for their
  // Situation, and adds one trait to the budget.
  const drawback = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:drawback',
    position: 0,
    catalogEntryId: ids.pride,
    operationId: 'select-pride',
  });
  const drawbackSheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!drawbackSheet) throw new Error('Missing drawback sheet');
  expect(drawbackSheet.calculated.selectionRules.budgets.traits).toBe(3);
  const before = drawbackSheet.calculated.breakdowns;
  expect(before['skill.dip'].total).toBe(diplomacy);
  const challenged = pride.modifiers.findIndex(
    (row) => row.target === 'skill.dip',
  );
  const penalized = calculateCharacterSheetPreview(
    drawbackSheet,
    {},
    {
      situations: [
        {
          ...local(pride.modifiers[challenged]?.condition?.situation),
          sheetEntryId: drawback,
        },
      ],
    },
  ).breakdowns;
  expect(penalized['skill.dip'].total - before['skill.dip'].total).toBe(-2);
  expect(penalized['skill.sen'].total - before['skill.sen'].total).toBe(-2);
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
  ).toMatchObject({ active: true, catalogEntryId: ids.money });
  expect(await t.query(api.catalogRelease.legalInputs, {})).toBeNull();
});
