/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import { calculateCharacterSheetPreview } from '../src/components/character-sheet/calculate-character-sheet-preview';
import { findRacialProgression } from '../src/lib/character-sheet-creature-types';

const modules = import.meta.glob('./**/*.ts');

test('isolated custom race preserves editable Dragon seed, racial HP/ranks and member-only saved-sheet preview parity', async () => {
  const t = convexTest(schema, modules);
  const campaignId = await t.run(async (ctx) => {
    for (const [name, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `racialHd329|${name}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    return ctx.db.insert('campaign', {
      name: 'Isolated racial-HD #329 fixture',
      description: '',
      organizationId: 'org',
      ownerId: 'racialHd329|owner',
      e2eFixture: {
        namespace: 'racialHd329',
        version: 1,
        workerKey: '0',
        caseKey: 'custom',
        campaignKey: 'custom',
      },
    });
  });
  const owner = t.withIdentity({ tokenIdentifier: 'racialHd329|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'racialHd329|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'racialHd329|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Custom fixed-HD seed demonstration',
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
  // Character-scoped authored fixture only: none of the thirteen held resources
  // is made selectable, copied as a race, admitted or activated by this test.
  const raceId = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      ruleIdentity: 'fixture-custom-racial-hd-329',
      name: 'Custom seed demonstration race',
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: { kind: 'race', racialTraits: [], racialHitDice: 0 },
    }),
  );
  await member.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: raceId,
    operationId: 'select',
  });
  const before = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const race = before?.entries.find((entry) => entry.kind === 'race');
  if (!before || !race) throw new Error('Missing custom race');
  expect(race.state.racialHpGained ?? null).toBeNull();
  const seed = findRacialProgression('dragon');
  if (!seed) throw new Error('Missing Dragon seed');
  const edit = {
    ...scope,
    entryId: race._id,
    racialHitDice: 3,
    racialProgression: seed,
    racialHpGained: 7,
    racialSkillRanks: { per: 2 },
    operationId: 'seed',
  };
  await member.mutation(api.characterSheet.editRaceStatistics, edit);
  const seeded = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!seeded) throw new Error('Missing seeded race');
  expect(seeded.calculated).toMatchObject({
    level: 1,
    racialHitDice: 3,
    hitDice: 4,
    hp: null,
    budgets: { generalFeats: 2, skillRankCap: 4, racialSkillRanks: 18 },
    derivedStatistics: {
      bab: { total: 3 },
      fortitude: { total: 3 },
      reflex: { total: 3 },
      will: { total: 3 },
    },
  });
  const customized = {
    ...seed,
    creatureType: 'Authored Dragon variant',
    hitDie: 8,
    bab: 'half' as const,
    saves: {
      fort: 'poor' as const,
      ref: 'good' as const,
      will: 'poor' as const,
    },
    skillRanksPerHitDie: 4,
    classSkills: ['per'],
  };
  await owner.mutation(api.characterSheet.editRaceStatistics, {
    ...edit,
    racialProgression: customized,
    operationId: 'customize',
  });
  const saved = withSheetCatalog(
    await member.query(api.characterSheet.read, scope),
  );
  if (!saved) throw new Error('Missing customized sheet');
  const savedRace = saved.entries.find((entry) => entry._id === race._id);
  if (savedRace?.kind !== 'race') throw new Error('Missing saved race');
  expect(
    saved.catalogEntries.find(
      (entry) => entry._id === savedRace.catalogEntryId,
    ),
  ).toMatchObject({
    detail: { kind: 'race', racialHitDice: 3, racialProgression: customized },
  });
  expect(savedRace).toMatchObject({
    state: { racialHpGained: 7, racialSkillRanks: { per: 2 } },
  });
  expect(saved.entries.filter((entry) => entry.kind === 'classLevel')).toEqual(
    before.entries.filter((entry) => entry.kind === 'classLevel'),
  );
  expect(saved.calculated).toMatchObject({
    level: 1,
    racialHitDice: 3,
    hitDice: 4,
    budgets: { racialSkillRanks: 12 },
    derivedStatistics: {
      bab: { total: 1 },
      fortitude: { total: 1 },
      reflex: { total: 3 },
      will: { total: 1 },
    },
  });
  expect(calculateCharacterSheetPreview(saved)).toEqual(saved.calculated);
  expect(
    (await owner.query(api.characterSheet.read, scope))?.calculated,
  ).toEqual(saved.calculated);
  expect(findRacialProgression('dragon')).toEqual(seed);
  // A repeated save carries the edited fields, preserving the player's choices
  // without reapplying the default or generating another Catalog Copy.
  await member.mutation(api.characterSheet.editRaceStatistics, {
    ...edit,
    racialProgression: customized,
    operationId: 'repeat-custom',
  });
  const preserved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  expect(preserved?.catalogEntries).toEqual(saved.catalogEntries);
  expect(preserved?.calculated).toEqual(saved.calculated);
  expect(preserved?.revision).toBe(saved.revision);
  await expect(
    outsider.query(api.characterSheet.read, scope),
  ).rejects.toThrow();
  await expect(outsider.query(api.catalogCopies.list, scope)).rejects.toThrow();
  await expect(
    outsider.mutation(api.characterSheet.editRaceStatistics, {
      ...edit,
      operationId: 'foreign-edit',
    }),
  ).rejects.toThrow();
  expect(
    (await owner.query(api.characterSheet.read, scope))?.calculated,
  ).toEqual(saved.calculated);
});
