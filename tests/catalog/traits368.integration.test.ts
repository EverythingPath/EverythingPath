/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { withSheetCatalog } from '../character-sheet-catalog';
import { reviewedTraitDefinition } from '../fixtures/traits-368/sheet';
import { heldTraits } from '../fixtures/traits-368/data';
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
        tokenIdentifier: `trait368|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    }
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed traits #368',
      description: '',
      organizationId: 'org',
      ownerId: 'trait368|owner',
      e2eFixture: {
        namespace: 'traits-368',
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
      ownerId: 'trait368|owner',
    });
    return { campaignId, otherCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'trait368|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'trait368|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'trait368|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed trait preview',
    kind: 'pc',
    operationId: 'create-traits-368',
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
  const excitable = reviewedTraitDefinition('Excitable (Gnome)');
  const wary = reviewedTraitDefinition('Wary of Danger (Human; Kellid)');
  const varki = reviewedTraitDefinition('Varki Landspeaker (Human; Varki)');
  const impatient = reviewedTraitDefinition('Impatient');
  for (const definition of [excitable, wary, varki, impatient])
    expect(
      heldTraits.find((row) => row.externalKey === definition.ruleIdentity)
        ?.disposition,
    ).toBe('held');
  // Character-scoped fixtures exercise the held bodies without a release.
  const ids = await t.run(async (ctx) => {
    const insert = (definition: typeof excitable) =>
      ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ...definition,
        stacksWithItself: false,
      });
    return {
      excitable: await insert(excitable),
      wary: await insert(wary),
      varki: await insert(varki),
      impatient: await insert(impatient),
      foreign: await ctx.db.insert('catalogEntry', {
        scope: 'campaign',
        campaignId: otherCampaignId,
        ...excitable,
        stacksWithItself: false,
      }),
    };
  });
  const first = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:general',
    position: 0,
    catalogEntryId: ids.excitable,
    operationId: 'select-excitable',
  });
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!saved) throw new Error('Missing saved sheet');
  expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
    saved.calculated.derivedStatistics,
  );
  expect(saved.calculated.breakdowns.init.total).toBe(2);
  const second = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:general',
    position: 1,
    catalogEntryId: ids.wary,
    operationId: 'select-wary',
  });
  // Two traits' +2 trait bonuses on initiative don't stack.
  const current = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!current) throw new Error('Missing current sheet');
  expect(current.calculated.breakdowns.init.total).toBe(2);
  // Staged replacement equals the saved replacement: Varki Landspeaker for
  // Excitable, beside Wary of Danger.
  const staged = calculateCharacterSheetPreview(current, {
    entries: current.entries.map((row) =>
      row._id === first ? { ...row, catalogEntryId: ids.varki } : row,
    ),
  });
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: first,
    catalogEntryId: ids.varki,
    operationId: 'replace-with-varki',
  });
  const replaced = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!replaced) throw new Error('Missing replaced sheet');
  expect(staged.derivedStatistics).toEqual(
    replaced.calculated.derivedStatistics,
  );
  expect([
    replaced.calculated.breakdowns.init.total,
    replaced.calculated.breakdowns['skill.sur'].total,
  ]).toEqual([2, 0]);
  // The cold-terrain +1 and the spirit query's +5 are trait bonuses: with
  // both Situations selected the Survival total is +5, not +6.
  const situations = varki.modifiers.map((row) => ({
    ...local(row.condition?.situation),
    sheetEntryId: first,
  }));
  expect(
    calculateCharacterSheetPreview(replaced, {}, { situations }).breakdowns[
      'skill.sur'
    ].total,
  ).toBe(5);
  expect(
    calculateCharacterSheetPreview(
      replaced,
      {},
      { situations: situations.slice(0, 1) },
    ).breakdowns['skill.sur'].total,
  ).toBe(1);
  expect(replaced.entries.find((row) => row._id === second)).toMatchObject({
    catalogEntryId: ids.wary,
  });
  // The drawback slot takes the drawback, whose penalties wait for their
  // Situation, and adds one trait to the budget.
  const drawback = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:drawback',
    position: 0,
    catalogEntryId: ids.impatient,
    operationId: 'select-impatient',
  });
  const impatientSheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!impatientSheet) throw new Error('Missing drawback sheet');
  expect(impatientSheet.calculated.selectionRules.budgets.traits).toBe(3);
  expect(impatientSheet.calculated.breakdowns['save.will'].total).toBe(0);
  const lastToAct = calculateCharacterSheetPreview(
    impatientSheet,
    {},
    {
      situations: [
        {
          ...local(impatient.modifiers[0]?.condition?.situation),
          sheetEntryId: drawback,
        },
      ],
    },
  ).breakdowns;
  expect([lastToAct['save.will'].total, lastToAct['skill.per'].total]).toEqual([
    -1, -1,
  ]);
  expect(
    calculateCharacterSheetPreview(impatientSheet).derivedStatistics,
  ).toEqual(impatientSheet.calculated.derivedStatistics);
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
  ).toMatchObject({ active: true, catalogEntryId: ids.varki });
  expect(await t.query(api.catalogRelease.legalInputs, {})).toBeNull();
});
