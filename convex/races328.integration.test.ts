/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import {
  heldRaceDefinition,
  heldRaceTraitDefinition,
  heldRaceTraitKeys,
} from '../tests/fixtures/races-328/sheet';
import { calculateCharacterSheetPreview } from '../src/components/character-sheet/calculate-character-sheet-preview';
import { abilityKeys } from '../src/lib/character-sheet';
import { findRacialProgression } from '../src/lib/character-sheet-creature-types';

const modules = import.meta.glob('./**/*.ts');

async function fixture() {
  const t = convexTest(schema, modules);
  const campaignId = await t.run(async (ctx) => {
    for (const [name, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `race328|${name}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    return ctx.db.insert('campaign', {
      name: 'Held race #328 fixture',
      description: '',
      organizationId: 'org',
      ownerId: 'race328|owner',
      e2eFixture: {
        namespace: 'race328',
        version: 1,
        workerKey: '0',
        caseKey: 'held',
        campaignKey: 'held',
      },
    });
  });
  const owner = t.withIdentity({ tokenIdentifier: 'race328|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'race328|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'race328|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Isolated held-content Gnoll',
    kind: 'pc',
    operationId: 'create',
  });
  const scope = { organizationId: 'org', campaignId, characterId };
  await owner.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    operationId: 'base',
  });
  // Direct seeding is intentionally limited to convex-test's isolated database.
  // This is not a global definition, accepted assessment or release admission.
  // #721: the Gnoll's adjustments are on its reviewed ability score trait.
  const gnoll = 'pf1/ITHs6VCRdSQUsoen';
  const { raceId, traitId } = await t.run(async (ctx) => {
    const race = heldRaceDefinition(gnoll);
    const raceId = await ctx.db.insert('catalogEntry', {
      ...race,
      scope: 'character',
      characterId,
    });
    const [traitKey] = heldRaceTraitKeys(gnoll);
    if (!traitKey) throw new Error('Missing Gnoll ability score trait');
    const trait = heldRaceTraitDefinition(traitKey);
    const traitId = await ctx.db.insert('catalogEntry', {
      ...trait,
      detail: { ...trait.detail, raceEntryIds: [raceId] },
      scope: 'character',
      characterId,
    });
    await ctx.db.patch('catalogEntry', raceId, {
      detail: { ...race.detail, racialTraits: [traitId] },
    });
    return { raceId, traitId };
  });
  return { owner, member, outsider, scope, raceId, traitId };
}

test('isolated held-content Gnoll agrees through saved-sheet reads and the application catalog preview', async () => {
  const { owner, member, outsider, scope, raceId, traitId } = await fixture();
  await member.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: raceId,
    operationId: 'select',
  });
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!saved) throw new Error('Missing isolated saved sheet');
  expect(saved.entries.filter((row) => row.kind === 'race')).toHaveLength(1);
  expect(saved.calculated).toMatchObject({
    level: 1,
    racialHitDice: 0,
    hitDice: 1,
  });
  expect(
    abilityKeys.map((ability) => saved.calculated.abilities[ability].score),
  ).toEqual([12, 10, 12, 10, 10, 10]);
  expect(
    saved.calculated.breakdowns['ability.str'].applied.filter(
      (modifier) => modifier.bonusType === 'racial',
    ),
  ).toHaveLength(1);
  expect(calculateCharacterSheetPreview(saved).abilities).toEqual(
    saved.calculated.abilities,
  );
  expect(
    (await member.query(api.catalogCopies.list, scope)).find(
      (entry) => entry._id === raceId,
    ),
  ).toMatchObject({
    scope: 'character',
    name: 'Held fixture: Gnoll',
    ruleIdentity: 'pf1/ITHs6VCRdSQUsoen',
    sources: [{ book: 'PZO1112', pages: '155' }],
    detail: { racialHitDice: 0, racialTraits: [traitId] },
  });
  expect(
    (await member.query(api.characterSheet.read, scope))?.calculated.abilities,
  ).toEqual(saved.calculated.abilities);
  await expect(
    outsider.query(api.characterSheet.read, scope),
  ).rejects.toThrow();
  await expect(outsider.query(api.catalogCopies.list, scope)).rejects.toThrow();
});

test('a fixture customization records fixed racial HP and ranks separately without creating Class Levels', async () => {
  const { owner, member, scope, raceId } = await fixture();
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: raceId,
    operationId: 'select',
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const race = before?.entries.find((entry) => entry.kind === 'race');
  if (!before || !race) throw new Error('Missing isolated race');
  await member.mutation(api.characterSheet.editRaceStatistics, {
    ...scope,
    entryId: race._id,
    racialHitDice: 3,
    racialProgression: findRacialProgression('humanoid'),
    racialHpGained: 7,
    racialSkillRanks: { per: 2 },
    operationId: 'custom-fixed-hd',
  });
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!saved) throw new Error('Missing customized sheet');
  expect(saved.calculated).toMatchObject({
    level: 1,
    racialHitDice: 3,
    hitDice: 4,
  });
  expect(saved.entries.filter((entry) => entry.kind === 'classLevel')).toEqual(
    before.entries.filter((entry) => entry.kind === 'classLevel'),
  );
  expect(saved.entries.find((entry) => entry._id === race._id)).toMatchObject({
    state: { racialHpGained: 7, racialSkillRanks: { per: 2 } },
  });
  expect(calculateCharacterSheetPreview(saved).hitDice).toBe(
    saved.calculated.hitDice,
  );
  expect(calculateCharacterSheetPreview(saved).budgets.racialSkillRanks).toBe(
    saved.calculated.budgets.racialSkillRanks,
  );
});
