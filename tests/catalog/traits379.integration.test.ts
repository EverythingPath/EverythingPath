/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { withSheetCatalog } from '../character-sheet-catalog';
import { reviewedTraitDefinition } from '../fixtures/traits-379/sheet';
import { heldTraits } from '../fixtures/traits-379/data';
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
        tokenIdentifier: `trait379|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    }
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed traits #379',
      description: '',
      organizationId: 'org',
      ownerId: 'trait379|owner',
      e2eFixture: {
        namespace: 'traits-379',
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
      ownerId: 'trait379|owner',
    });
    return { campaignId, otherCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'trait379|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'trait379|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'trait379|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed trait preview',
    kind: 'pc',
    operationId: 'create-traits-379',
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
  const schemer = reviewedTraitDefinition('Holy Schemer (Calistria)');
  const aware = reviewedTraitDefinition('Self-Aware (Vampire; Vetala)');
  const gambler = reviewedTraitDefinition(
    'Practiced Gambler (Human; Varisian)',
  );
  const meticulous = reviewedTraitDefinition('Meticulous');
  for (const definition of [schemer, aware, gambler, meticulous])
    expect(
      heldTraits.find((row) => row.externalKey === definition.ruleIdentity)
        ?.disposition,
    ).toBe('held');
  // Character-scoped fixtures exercise the held bodies without a release.
  const ids = await t.run(async (ctx) => {
    const insert = (definition: typeof schemer) =>
      ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ...definition,
        stacksWithItself: false,
      });
    return {
      schemer: await insert(schemer),
      aware: await insert(aware),
      gambler: await insert(gambler),
      meticulous: await insert(meticulous),
      foreign: await ctx.db.insert('catalogEntry', {
        scope: 'campaign',
        campaignId: otherCampaignId,
        ...schemer,
        stacksWithItself: false,
      }),
    };
  });
  const first = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:general',
    position: 0,
    catalogEntryId: ids.schemer,
    operationId: 'select-schemer',
  });
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!saved) throw new Error('Missing saved sheet');
  expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
    saved.calculated.derivedStatistics,
  );
  const senseMotive = saved.calculated.breakdowns['skill.sen'].total;
  const bluff = saved.calculated.breakdowns['skill.blf'].total;
  const acrobatics = saved.calculated.breakdowns['skill.acr'].total;
  const second = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:general',
    position: 1,
    catalogEntryId: ids.aware,
    operationId: 'select-aware',
  });
  // Self-Aware's +1 trait bonus on Sense Motive doesn't stack with Holy
  // Schemer's.
  const current = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!current) throw new Error('Missing current sheet');
  expect(current.calculated.breakdowns['skill.sen'].total).toBe(senseMotive);
  // Staged replacement equals the saved replacement: Practiced Gambler for
  // Self-Aware, beside Holy Schemer, which keeps the Sense Motive bonus.
  const staged = calculateCharacterSheetPreview(current, {
    entries: current.entries.map((row) =>
      row._id === second ? { ...row, catalogEntryId: ids.gambler } : row,
    ),
  });
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: second,
    catalogEntryId: ids.gambler,
    operationId: 'replace-with-gambler',
  });
  const replaced = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!replaced) throw new Error('Missing replaced sheet');
  expect(staged.derivedStatistics).toEqual(
    replaced.calculated.derivedStatistics,
  );
  expect(replaced.calculated.breakdowns['skill.sen'].total).toBe(senseMotive);
  expect(replaced.calculated.breakdowns['skill.blf'].total).toBe(bluff + 1);
  // Gambling: the +1 trait bonus becomes +2, not +3.
  const gambling = gambler.modifiers.findIndex(
    (row) => row.target === 'skill.blf' && row.condition?.situation,
  );
  expect(
    calculateCharacterSheetPreview(
      replaced,
      {},
      {
        situations: [
          {
            ...local(gambler.modifiers[gambling]?.condition?.situation),
            sheetEntryId: second,
          },
        ],
      },
    ).breakdowns['skill.blf'].total,
  ).toBe(bluff + 2);
  expect(replaced.entries.find((row) => row._id === first)).toMatchObject({
    catalogEntryId: ids.schemer,
  });
  // The drawback slot takes the drawback, which adds one trait to the
  // budget; its -2 applies to every Dexterity-based skill.
  await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:drawback',
    position: 0,
    catalogEntryId: ids.meticulous,
    operationId: 'select-meticulous',
  });
  const drawbackSheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!drawbackSheet) throw new Error('Missing drawback sheet');
  expect(drawbackSheet.calculated.selectionRules.budgets.traits).toBe(3);
  const after = drawbackSheet.calculated.breakdowns;
  expect(after['skill.acr'].total).toBe(acrobatics - 2);
  expect(after['skill.slt'].total).toBe(
    replaced.calculated.breakdowns['skill.slt'].total - 2,
  );
  expect(after['skill.sen'].total).toBe(senseMotive);
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
  ).toMatchObject({ active: true, catalogEntryId: ids.schemer });
  expect(await t.query(api.catalogRelease.legalInputs, {})).toBeNull();
});
