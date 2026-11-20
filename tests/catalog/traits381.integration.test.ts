/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { withSheetCatalog } from '../character-sheet-catalog';
import { reviewedTraitDefinition } from '../fixtures/traits-381/sheet';
import { heldTraits } from '../fixtures/traits-381/data';
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
        tokenIdentifier: `trait381|${user}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    }
    const campaignId = await ctx.db.insert('campaign', {
      name: 'Isolated reviewed traits #381',
      description: '',
      organizationId: 'org',
      ownerId: 'trait381|owner',
      e2eFixture: {
        namespace: 'traits-381',
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
      ownerId: 'trait381|owner',
    });
    return { campaignId, otherCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: 'trait381|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'trait381|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'trait381|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Reviewed trait preview',
    kind: 'pc',
    operationId: 'create-traits-381',
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
  const bloody = reviewedTraitDefinition('Bloody-Minded');
  const tough = reviewedTraitDefinition("Local Tough (Hell's Vengeance)");
  const soul = reviewedTraitDefinition("Soul-Searcher's Strength (Rivethun)");
  const secrets = reviewedTraitDefinition('Too Many Secrets');
  for (const definition of [bloody, tough, soul, secrets])
    expect(
      heldTraits.find((row) => row.externalKey === definition.ruleIdentity)
        ?.disposition,
    ).toBe('held');
  // Character-scoped fixtures exercise the held bodies without a release.
  const ids = await t.run(async (ctx) => {
    const insert = (definition: typeof bloody) =>
      ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ...definition,
        stacksWithItself: false,
      });
    return {
      bloody: await insert(bloody),
      tough: await insert(tough),
      soul: await insert(soul),
      secrets: await insert(secrets),
      foreign: await ctx.db.insert('catalogEntry', {
        scope: 'campaign',
        campaignId: otherCampaignId,
        ...bloody,
        stacksWithItself: false,
      }),
    };
  });
  const first = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:general',
    position: 0,
    catalogEntryId: ids.bloody,
    operationId: 'select-bloody',
  });
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!saved) throw new Error('Missing saved sheet');
  expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
    saved.calculated.derivedStatistics,
  );
  const intimidate = saved.calculated.breakdowns['skill.int'].total;
  const initiative = saved.calculated.breakdowns.init.total;
  const fortitude = saved.calculated.breakdowns['save.fort'].total;
  const will = saved.calculated.breakdowns['save.will'].total;
  const bluff = saved.calculated.breakdowns['skill.blf'].total;
  const second = await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:general',
    position: 1,
    catalogEntryId: ids.tough,
    operationId: 'select-tough',
  });
  // Local Tough's +1 trait bonus on Intimidate doesn't stack with
  // Bloody-Minded's.
  const current = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!current) throw new Error('Missing current sheet');
  expect(current.calculated.breakdowns['skill.int'].total).toBe(intimidate);
  // Staged replacement equals the saved replacement: Soul-Searcher's
  // Strength for Bloody-Minded, beside Local Tough, whose +1 is now the
  // Intimidate bonus. The reviewed change replacement leaves Fortitude alone.
  const staged = calculateCharacterSheetPreview(current, {
    entries: current.entries.map((row) =>
      row._id === first ? { ...row, catalogEntryId: ids.soul } : row,
    ),
  });
  await member.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: first,
    catalogEntryId: ids.soul,
    operationId: 'replace-with-soul',
  });
  const replaced = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!replaced) throw new Error('Missing replaced sheet');
  expect(staged.derivedStatistics).toEqual(
    replaced.calculated.derivedStatistics,
  );
  expect(replaced.calculated.breakdowns['skill.int'].total).toBe(intimidate);
  expect(replaced.calculated.breakdowns.init.total).toBe(initiative - 1);
  expect(replaced.calculated.breakdowns['save.fort'].total).toBe(fortitude);
  // Choosing Will puts the +1 on Will saves only.
  const chosen = soul.modifiers.findIndex(
    (row) =>
      row.target === 'save.will' &&
      JSON.stringify(row.condition?.situation).includes('chose Will'),
  );
  const willChosen = calculateCharacterSheetPreview(
    replaced,
    {},
    {
      situations: [
        {
          ...local(soul.modifiers[chosen]?.condition?.situation),
          sheetEntryId: first,
        },
      ],
    },
  ).breakdowns;
  expect(willChosen['save.will'].total).toBe(will + 1);
  expect(willChosen['save.fort'].total).toBe(fortitude);
  expect(replaced.entries.find((row) => row._id === second)).toMatchObject({
    catalogEntryId: ids.tough,
  });
  // The drawback slot takes the drawback, whose Bluff penalty always applies
  // and whose illusion penalty waits for the shared Situation, and adds one
  // trait to the budget.
  await member.mutation(api.characterSheet.fillSelectionSlot, {
    ...scope,
    slotId: 'trait:drawback',
    position: 0,
    catalogEntryId: ids.secrets,
    operationId: 'select-secrets',
  });
  const drawbackSheet = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!drawbackSheet) throw new Error('Missing drawback sheet');
  expect(drawbackSheet.calculated.selectionRules.budgets.traits).toBe(3);
  const before = drawbackSheet.calculated.breakdowns;
  expect(before['skill.blf'].total).toBe(bluff - 2);
  expect(before['save.will'].total).toBe(will);
  const illusion = calculateCharacterSheetPreview(
    drawbackSheet,
    {},
    { situations: ['illusions'] },
  ).breakdowns;
  expect(illusion['save.will'].total - before['save.will'].total).toBe(-2);
  expect(illusion['save.ref'].total - before['save.ref'].total).toBe(-2);
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
  ).toMatchObject({ active: true, catalogEntryId: ids.soul });
  expect(await t.query(api.catalogRelease.legalInputs, {})).toBeNull();
});
