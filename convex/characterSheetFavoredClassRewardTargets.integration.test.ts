// @vitest-environment edge-runtime
// reward-target (PRD #251; ORCH research reward-power-choice.md, design D1):
// through the saved sheet's one write path for a Class Level's favored class
// bonus (`editClassLevel`) and its read, a targeted reward's selection names
// the per-day maximum it adds to (`{ choice: 'reward', reward, target }`).
// The save refuses a targeted reward without a target or with one the list
// does not give it, and an untargeted reward with one. The class and race are
// character-scoped fixtures with the imported identities of Foundry
// classes/cleric.SjFqQceVeVBzBwgn and races/dwarf.nEltI9y37rKJTeWo; Fire
// Bolt is a catalog fixture on its key (pf1/V57hEfKt1MroRI91) whose formula
// reads the count alone, which no committed record does.
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import type { Id } from './_generated/dataModel';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

async function fixture() {
  const t = convexTest(schema, modules);
  const campaignId = await t.run(async (ctx) => {
    await ctx.db.insert('user', {
      tokenIdentifier: 'test|owner',
      orgIds: [{ orgId: 'org', role: 'member' }],
      characterSheetDemo: true,
    });
    return ctx.db.insert('campaign', {
      name: 'Favored class reward targets',
      description: '',
      organizationId: 'org',
      ownerId: 'test|owner',
      e2eFixture: {
        namespace: 'favored-reward-targets',
        version: 1,
        workerKey: '0',
        caseKey: 'targets',
        campaignKey: 'targets',
      },
    });
  });
  const owner = t.withIdentity({ tokenIdentifier: 'test|owner' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Targeted reward fixture',
    kind: 'pc',
    operationId: 'create',
  });
  const scope = { organizationId: 'org', campaignId, characterId };
  const { raceId, clericId } = await t.run(async (ctx) => {
    const fireBolt = await ctx.db.insert('catalogEntry', {
      scope: 'global',
      ruleIdentity: 'fixture/fire-bolt',
      name: 'Fire Bolt',
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: { kind: 'classFeature' },
      ruleValues: [
        {
          kind: 'dailyMaximum',
          key: 'classFeat_fireBolt',
          unit: 'uses',
          amount: { formula: '@favoredClassReward.clericDomainPowerUse' },
        },
      ],
    });
    return {
      raceId: await ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ruleIdentity: 'pf1/nEltI9y37rKJTeWo',
        name: 'Dwarf',
        stacksWithItself: false,
        sources: [],
        modifiers: [],
        detail: { kind: 'race', racialTraits: [], racialHitDice: 0 },
      }),
      clericId: await ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ruleIdentity: 'pf1/SjFqQceVeVBzBwgn',
        name: 'Cleric',
        stacksWithItself: false,
        sources: [],
        modifiers: [],
        detail: {
          kind: 'class',
          classKind: 'base',
          tag: 'cleric',
          hitDie: 8,
          bab: 'threeQuarters',
          saves: { fort: 'good', ref: 'poor', will: 'good' },
          skillRanksPerLevel: 2,
          classSkills: [],
          featuresByLevel: [{ classLevel: 1, catalogEntryId: fireBolt }],
          picksByLevel: [],
        },
      }),
    };
  });
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: raceId,
    operationId: 'race',
  });
  await owner.mutation(api.characterSheet.editCreationSettings, {
    ...scope,
    settings: {},
    favoredClassIds: [clericId],
    operationId: 'favored',
  });
  async function read() {
    const sheet = await owner.query(api.characterSheet.read, { characterId });
    if (!sheet) throw new Error('Missing Character Sheet');
    return sheet;
  }
  const first = (await read()).entries.find(
    (entry) => entry.kind === 'classLevel',
  );
  if (!first) throw new Error('Missing Class Level');
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: first._id,
    classEntryId: clericId,
    hpGained: 8,
    operationId: 'cleric',
  });
  const save = (
    favoredClassBonus: {
      choice: 'reward';
      reward: string;
      target?: string;
    },
    operationId: string,
  ) =>
    owner.mutation(api.characterSheet.editClassLevel, {
      ...scope,
      entryId: first._id,
      favoredClassBonus,
      operationId,
    });
  return { read, save, levelId: first._id };
}

function bonusOf(
  sheet: { entries: readonly { _id: string; kind: string; state: unknown }[] },
  entryId: Id<'characterSheetEntry'>,
) {
  const row = sheet.entries.find((entry) => entry._id === entryId);
  if (row?.kind !== 'classLevel') throw new Error('Missing Class Level');
  return (row.state as { favoredClassBonus?: unknown }).favoredClassBonus;
}
const fireBoltUses = (sheet: {
  calculated: { dailyMaxima: readonly { key: string; value: number | null }[] };
}) =>
  sheet.calculated.dailyMaxima.find((row) => row.key === 'classFeat_fireBolt')
    ?.value;

test('editClassLevel saves a domain reward with the power it adds to, and the read counts it in that power’s rule value', async () => {
  const { read, save, levelId } = await fixture();
  expect(fireBoltUses(await read())).toBe(0);
  await save(
    {
      choice: 'reward',
      reward: 'clericDomainPowerUse',
      target: 'classFeat_fireBolt',
    },
    'fire-bolt',
  );
  const sheet = await read();
  expect(bonusOf(sheet, levelId)).toEqual({
    choice: 'reward',
    reward: 'clericDomainPowerUse',
    target: 'classFeat_fireBolt',
  });
  expect(fireBoltUses(sheet)).toBe(1);
  expect(
    sheet.calculated.warnings.filter(({ check }) =>
      check.startsWith('favoredClass'),
    ),
  ).toEqual([]);
});

test('editClassLevel refuses a domain reward without a power or with one the list does not give it, and an untargeted reward with a power, leaving the sheet as it was', async () => {
  const { read, save } = await fixture();
  const before = await read();
  for (const [bonus, message] of [
    [
      { choice: 'reward', reward: 'clericDomainPowerUse' },
      'Choose the power this favored class reward adds to',
    ],
    [
      {
        choice: 'reward',
        reward: 'clericDomainPowerUse',
        target: 'classFeat_channelEnergy',
      },
      'Choose a power this favored class reward can add to',
    ],
    [
      // Fire Bolt's key in another case is not a listed key.
      {
        choice: 'reward',
        reward: 'clericDomainPowerUse',
        target: 'classfeat_firebolt',
      },
      'Choose a power this favored class reward can add to',
    ],
    [
      {
        choice: 'reward',
        reward: 'bardicPerformanceRound',
        target: 'classFeat_bardicPerformance',
      },
      'This favored class reward doesn’t add to a chosen power',
    ],
  ] as const)
    await expect(save(bonus, `refused-${message}`)).rejects.toThrow(message);
  expect(await read()).toEqual(before);
});
