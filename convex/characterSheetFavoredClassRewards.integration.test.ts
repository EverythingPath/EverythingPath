// @vitest-environment edge-runtime
// rotation-7 (PRD #251; ORCH research favored-class-rewards.md, option A):
// through the saved sheet's one write path for a Class Level's favored class
// bonus (`editClassLevel`) and its read, a reward from the reviewed list
// (`src/lib/catalog/data/reviewed-favored-class-rewards.json`), stored by its
// id beside the hit point, the skill rank and the note. The class and race
// are character-scoped fixtures with the imported identities of Foundry
// classes/bard.6GjOjO6r3R06fLwE, races/gnome.efwHEwjvL9Z94MJI and
// races/human.e6IaBxKgMxy1yKlr. The committed Bardic Performance record
// reads the count and is checked (reward-terms-1); this test stores its own
// fixture of that shape.
import { convexTest } from 'convex-test';
import { expect, onTestFinished, test, vi } from 'vitest';
import type { Id } from './_generated/dataModel';
import { api } from './_generated/api';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');

async function fixture({ race = 'gnome' }: { race?: 'gnome' | 'human' } = {}) {
  const t = convexTest(schema, modules);
  const campaignId = await t.run(async (ctx) => {
    for (const [person, orgId] of [
      ['owner', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `test|${person}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    return ctx.db.insert('campaign', {
      name: 'Favored class rewards',
      description: '',
      organizationId: 'org',
      ownerId: 'test|owner',
      e2eFixture: {
        namespace: 'favored-rewards',
        version: 1,
        workerKey: '0',
        caseKey: 'favored',
        campaignKey: 'favored',
      },
    });
  });
  const owner = t.withIdentity({ tokenIdentifier: 'test|owner' });
  const outsider = t.withIdentity({ tokenIdentifier: 'test|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Favored fixture',
    kind: 'pc',
    operationId: 'create',
  });
  const scope = { organizationId: 'org', campaignId, characterId };
  const { raceId, bardId } = await t.run(async (ctx) => {
    // A fixture of the Bardic Performance record's shape
    // (pf1/ZfCUTi1MiLgR4T7I) with the count's term, which its checked
    // record has since reward-terms-1. Fix r2: a catalog definition, as an
    // imported one is, so its rule values read the count.
    const performance = await ctx.db.insert('catalogEntry', {
      scope: 'global',
      ruleIdentity: 'fixture/bardic-performance',
      name: 'Bardic Performance',
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: { kind: 'classFeature' },
      ruleValues: [
        {
          kind: 'dailyMaximum',
          key: 'classFeat_bardicPerformance',
          unit: 'rounds',
          amount: {
            formula:
              '4 + @ability.cha.mod + 2 * (@classLevel.bard - 1) + @favoredClassReward.bardicPerformanceRound',
          },
        },
      ],
    });
    return {
      raceId: await ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ruleIdentity:
          race === 'gnome' ? 'pf1/efwHEwjvL9Z94MJI' : 'pf1/e6IaBxKgMxy1yKlr',
        name: race === 'gnome' ? 'Gnome' : 'Human',
        stacksWithItself: false,
        sources: [],
        modifiers: [],
        detail: { kind: 'race', racialTraits: [], racialHitDice: 0 },
      }),
      bardId: await ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ruleIdentity: 'pf1/6GjOjO6r3R06fLwE',
        name: 'Bard',
        stacksWithItself: false,
        sources: [],
        modifiers: [],
        detail: {
          kind: 'class',
          classKind: 'base',
          tag: 'bard',
          hitDie: 8,
          bab: 'threeQuarters',
          saves: { fort: 'poor', ref: 'good', will: 'good' },
          skillRanksPerLevel: 6,
          classSkills: [],
          featuresByLevel: [{ classLevel: 1, catalogEntryId: performance }],
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
    favoredClassIds: [bardId],
    operationId: 'favored',
  });
  async function read() {
    const sheet = await owner.query(api.characterSheet.read, {
      characterId: scope.characterId,
    });
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
    classEntryId: bardId,
    hpGained: 8,
    operationId: 'bard',
  });
  return { t, owner, outsider, scope, read, levelId: first._id, bardId };
}

function bonusOf(
  sheet: { entries: readonly { _id: string; kind: string; state: unknown }[] },
  entryId: Id<'characterSheetEntry'>,
) {
  const row = sheet.entries.find((entry) => entry._id === entryId);
  if (row?.kind !== 'classLevel') throw new Error('Missing Class Level');
  return (row.state as { favoredClassBonus?: unknown }).favoredClassBonus;
}

test('editClassLevel saves a listed reward by its id, and the read returns it as the level’s favored class bonus', async () => {
  const { owner, scope, read, levelId } = await fixture();
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: levelId,
    favoredClassBonus: { choice: 'reward', reward: 'bardicPerformanceRound' },
    operationId: 'reward',
  });
  const sheet = await read();
  expect(bonusOf(sheet, levelId)).toEqual({
    choice: 'reward',
    reward: 'bardicPerformanceRound',
  });
  expect(sheet.calculated.hp).toBe(8);
  expect(
    sheet.calculated.warnings.map((warning) => warning.check),
  ).not.toContain('favoredClassBonusMissing');
});

test('editClassLevel refuses a reward id the list does not hold and leaves the sheet as it was; an outsider cannot save one', async () => {
  const { owner, outsider, scope, read, levelId } = await fixture();
  const before = await read();
  for (const reward of ['', 'bardicPerformance', 'BardicPerformanceRound'])
    await expect(
      owner.mutation(api.characterSheet.editClassLevel, {
        ...scope,
        entryId: levelId,
        favoredClassBonus: { choice: 'reward', reward },
        operationId: `unlisted-${reward}`,
      }),
    ).rejects.toThrow('Choose a favored class reward from the list');
  await expect(
    outsider.mutation(api.characterSheet.editClassLevel, {
      ...scope,
      entryId: levelId,
      favoredClassBonus: { choice: 'reward', reward: 'bardicPerformanceRound' },
      operationId: 'outsider',
    }),
  ).rejects.toThrow('You do not have access to this org');
  expect(await read()).toEqual(before);
});

test('a listed reward whose race does not fit is saved as chosen, as a hit point on a class that is not favored is', async () => {
  const { owner, scope, read, levelId } = await fixture({ race: 'human' });
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: levelId,
    favoredClassBonus: { choice: 'reward', reward: 'bardicPerformanceRound' },
    operationId: 'human-reward',
  });
  expect(bonusOf(await read(), levelId)).toEqual({
    choice: 'reward',
    reward: 'bardicPerformanceRound',
  });
});

test('Class Levels stored before rewards existed, with a hit point, a skill rank and a note, read and calculate as before', async () => {
  const { t, owner, scope, read, levelId, bardId } = await fixture();
  const second = await owner.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    position: 2,
    operationId: 'second',
  });
  const third = await owner.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    position: 3,
    operationId: 'third',
  });
  // Written as the stored documents are, not through the write path.
  await t.run(async (ctx) => {
    for (const [entryId, favoredClassBonus] of [
      [levelId, { choice: 'hp' }],
      [second, { choice: 'skill' }],
      [third, { choice: 'alt', note: 'Extra spell known' }],
    ] as const) {
      const row = await ctx.db.get('characterSheetEntry', entryId);
      if (row?.kind !== 'classLevel') throw new Error('Missing Class Level');
      await ctx.db.patch('characterSheetEntry', entryId, {
        state: {
          ...row.state,
          classEntryId: bardId,
          hpGained: 8,
          favoredClassBonus,
        },
      });
    }
  });
  const sheet = await read();
  expect(bonusOf(sheet, third)).toEqual({
    choice: 'alt',
    note: 'Extra spell known',
  });
  // 8 + 8 + 8 and the favored hit point; the skill rank adds to level 2's
  // budget: Bard 6 + Intelligence 0 + 1.
  expect(sheet.calculated.hp).toBe(25);
  expect(
    sheet.calculated.classLevels.map((level) => level.skillRankBudget),
  ).toEqual([6, 7, 6]);
  expect(
    sheet.calculated.warnings.filter((warning) =>
      warning.check.startsWith('favoredClass'),
    ),
  ).toEqual([]);
});

function rounds(sheet: {
  calculated: { dailyMaxima: readonly { key: string; value: number | null }[] };
}) {
  return sheet.calculated.dailyMaxima.find(
    (row) => row.key === 'classFeat_bardicPerformance',
  )?.value;
}

test('the saved reward reaches a formula through the read: a Gnome Bard 1 has 5 rounds with it, a Human Bard 1 has 4 and a warning naming the level and why', async () => {
  for (const race of ['gnome', 'human'] as const) {
    const { owner, scope, read, levelId } = await fixture({ race });
    expect(rounds(await read())).toBe(4);
    await owner.mutation(api.characterSheet.editClassLevel, {
      ...scope,
      entryId: levelId,
      favoredClassBonus: { choice: 'reward', reward: 'bardicPerformanceRound' },
      operationId: 'reward',
    });
    const sheet = await read();
    expect(rounds(sheet)).toBe(race === 'gnome' ? 5 : 4);
    expect(
      sheet.calculated.warnings
        .filter((warning) => warning.check === 'favoredClassRewardNotCounted')
        .map((warning) => warning.message),
    ).toEqual(
      race === 'gnome'
        ? []
        : [
            'Level 1: +1 round of bardic performance per day isn’t counted: your race isn’t Gnome or Half-Elf.',
          ],
    );
  }
});

// Fix r1 (root, 2026-11-22): a formula a player types through the public
// writer reads the count as before it existed: unsupported, 0 and a warning.
test('a Personal Adjustment saved with the initiative formula 2 + @favoredClassReward.bardicPerformanceRound gives 0 and its warning, with the reward chosen', async () => {
  const { owner, scope, read, levelId } = await fixture();
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: levelId,
    favoredClassBonus: { choice: 'reward', reward: 'bardicPerformanceRound' },
    operationId: 'reward',
  });
  await owner.mutation(api.characterSheet.createPersonalAdjustment, {
    ...scope,
    name: 'Quick reflexes',
    modifiers: [
      {
        target: 'init',
        bonusType: 'untyped',
        value: { formula: '2 + @favoredClassReward.bardicPerformanceRound' },
      },
    ],
    operationId: 'adjustment',
  });
  const sheet = await read();
  expect(rounds(sheet)).toBe(5);
  expect(sheet.calculated.breakdowns.init.total).toBe(0);
  expect(sheet.calculated.warnings).toContainEqual(
    expect.objectContaining({
      check: 'unsupportedFormula',
      message:
        'This Modifier contributes nothing. @favoredClassReward.bardicPerformanceRound is not a supported variable.',
    }),
  );
});

// Fix r2 (root, 2026-11-22): the count resolves by the provenance of the
// rule value, not by how its entry is named. A one-off Condition is the
// Character's own definition however it is saved or edited, so its formula
// gives what it gave before the count existed (the base, 06cefcf0): no
// number and the unsupported-variable warning, with the reward chosen.
const conditionFormula = '2 + @favoredClassReward.bardicPerformanceRound';
const conditionWarning =
  'This rule value gives no number. @favoredClassReward.bardicPerformanceRound is not a supported variable.';

async function oneOffCondition(conditionKey?: 'dazzled') {
  const context = await fixture();
  await context.owner.mutation(api.characterSheet.editClassLevel, {
    ...context.scope,
    entryId: context.levelId,
    favoredClassBonus: { choice: 'reward', reward: 'bardicPerformanceRound' },
    operationId: 'reward',
  });
  const entryId = await context.owner.mutation(api.catalogCopies.createOneOff, {
    ...context.scope,
    operationId: 'custom-condition',
    definition: {
      name: conditionKey ? 'Dazzled' : 'Custom condition',
      detail: { kind: 'condition', ...(conditionKey ? { conditionKey } : {}) },
      sources: [],
      modifiers: [],
      stacksWithItself: false,
      ruleValues: [
        {
          kind: 'dailyMaximum',
          key: 'customConditionPool',
          unit: 'uses',
          amount: { formula: conditionFormula },
        },
      ],
    },
  });
  return { ...context, entryId };
}

function conditionPool(
  sheet: Awaited<ReturnType<Awaited<ReturnType<typeof fixture>>['read']>>,
) {
  return {
    value: sheet.calculated.dailyMaxima.find(
      ({ key }) => key === 'customConditionPool',
    )?.value,
    warnings: sheet.calculated.warnings
      .filter(({ check }) => check === 'unsupportedFormula')
      .map(({ message }) => message),
  };
}

test('a one-off Condition saved as Dazzled with a per-day maximum naming the count gives no number and its warning, with the reward chosen', async () => {
  const { read } = await oneOffCondition('dazzled');
  const sheet = await read();
  expect(rounds(sheet)).toBe(5);
  expect(conditionPool(sheet)).toEqual({
    value: null,
    warnings: [conditionWarning],
  });
});

test('a one-off Condition edited to the core-rule Fatigued keeps its per-day maximum unsupported, its warning unchanged', async () => {
  const { owner, scope, read, entryId } = await oneOffCondition();
  expect(conditionPool(await read())).toEqual({
    value: null,
    warnings: [conditionWarning],
  });
  await owner.mutation(api.characterSheet.editSheetEntry, {
    ...scope,
    entryId,
    operationId: 'condition-type',
    detail: { kind: 'condition', conditionKey: 'fatigued' },
  });
  expect(conditionPool(await read())).toEqual({
    value: null,
    warnings: [conditionWarning],
  });
});

// Here the Character owns no identical copy, so the move builds a new Catalog
// Copy from the staged snapshot (`characterMoveDefinition`) the guard starts from.
test('a one-off Condition saved to the campaign, carried by a move as a Catalog Copy, keeps its per-day maximum unsupported, its warning unchanged', async () => {
  // The move's scheduled cleanup would run after the test ends.
  vi.useFakeTimers();
  onTestFinished(() => void vi.useRealTimers());
  const { owner, scope, read, entryId } = await oneOffCondition();
  const entry = (await read()).entries.find(({ _id }) => _id === entryId);
  if (!entry || !('catalogEntryId' in entry)) throw new Error('No one-off');
  const { catalogEntryId } = entry;
  await owner.mutation(api.catalogCopies.saveToCatalog, {
    ...scope,
    catalogEntryId,
    operationId: 'save',
  });
  const command = { characterId: scope.characterId, operationId: 'leave' };
  let progress = await owner.mutation(api.characterMoves.start, command);
  for (let i = 0; i < 50 && progress.state !== 'completed'; i++)
    progress = await owner.mutation(api.characterMoves.resume, command);
  expect(progress.state).toBe('completed');
  const sheet = await owner.query(api.characterSheet.read, {
    characterId: scope.characterId,
  });
  if (!sheet) throw new Error('Missing Character Sheet');
  expect(
    sheet.catalogEntries.find((row) => row.copiedFrom === catalogEntryId),
  ).toMatchObject({ scope: 'character' });
  expect(conditionPool(sheet)).toEqual({
    value: null,
    warnings: [conditionWarning],
  });
});
