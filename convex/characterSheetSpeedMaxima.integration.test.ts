// @vitest-environment edge-runtime
// rotation-4 (owner 2026-11-17, PRD #251): the saved sheet's read gives land
// speed from the race's `base` Modifier on `speed.land`, reduced in medium or
// heavy armor, and per-day maxima from `dailyMaximum` rule values. A race
// copy stored before land speed existed reads as before: no Speed.
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import type { FunctionArgs } from 'convex/server';
import { api } from './_generated/api';
import { writeCatalogDefinition } from './lib/catalogCopies';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');
type Definition = FunctionArgs<
  typeof api.catalogCopies.createOneOff
>['definition'];

async function fixture() {
  const t = convexTest(schema, modules);
  const campaignId = await t.run(async (ctx) => {
    for (const [person, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `test|${person}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    return ctx.db.insert('campaign', {
      name: 'Speed and maxima',
      description: '',
      organizationId: 'org',
      ownerId: 'test|owner',
      e2eFixture: {
        namespace: 'speed-maxima',
        version: 1,
        workerKey: '0',
        caseKey: 'speed',
        campaignKey: 'speed',
      },
    });
  });
  const owner = t.withIdentity({ tokenIdentifier: 'test|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'test|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'test|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Speed fixture',
    kind: 'pc',
    operationId: 'create',
  });
  const scope = { organizationId: 'org', campaignId, characterId };
  // A race copy stored before land speed existed: no `speed.land` Modifier.
  const human = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      ruleIdentity: 'fixture/human',
      name: 'Human',
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: { kind: 'race', racialTraits: [], racialHitDice: 0 },
    }),
  );
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: human,
    operationId: 'human',
  });
  type Actor = typeof owner;
  async function read(actor: Actor = owner) {
    const sheet = await actor.query(api.characterSheet.read, scope);
    if (!sheet) throw new Error('Missing Character Sheet');
    return sheet;
  }
  return { t, owner, member, outsider, scope, read, human };
}

const homebrew = (
  name: string,
  fields: Partial<Definition> & Pick<Definition, 'detail'>,
): Definition => ({
  name,
  modifiers: [],
  stacksWithItself: false,
  sources: [],
  ...fields,
});

test('a race copy without a base speed reads as before; with one the saved sheet shows land speed, reduced in heavy armor, Fast Movement lost', async () => {
  const { t, owner, member, scope: writeScope, read, human } = await fixture();
  const before = await read();
  expect(before.calculated.derivedStatistics.landSpeed).toBeUndefined();
  expect(before.calculated.dailyMaxima).toEqual([]);
  expect(before.calculated.breakdowns['speed.land']?.total).toBe(0);

  // The same race as a release carrying `speeds.land` stores it.
  await t.run((ctx) =>
    ctx.db.patch('catalogEntry', human, {
      modifiers: [{ target: 'speed.land', bonusType: 'base', value: 30 }],
    }),
  );
  const after = await read();
  for (const projection of [after.calculated, after.permanentCalculated])
    expect(projection.derivedStatistics.landSpeed?.total).toBe(30);
  // No other number moves.
  const withoutSpeed = (sheet: typeof before) => {
    const { landSpeed: _speed, ...derived } =
      sheet.calculated.derivedStatistics;
    const { 'speed.land': _leaf, ...breakdowns } = sheet.calculated.breakdowns;
    return { derived, breakdowns, warnings: sheet.calculated.warnings };
  };
  expect(withoutSpeed(after)).toEqual(withoutSpeed(before));

  // A member adds Fast Movement (armor at most medium) and full plate.
  await member.mutation(api.catalogCopies.createOneOff, {
    ...writeScope,
    operationId: 'fast',
    definition: homebrew('Fast Movement', {
      detail: { kind: 'feat' },
      modifiers: [
        {
          target: 'speed.land',
          bonusType: 'untyped',
          value: 10,
          condition: { armorAtMost: 'medium' },
        },
      ],
    }),
  });
  expect(
    (await read(member)).calculated.derivedStatistics.landSpeed?.total,
  ).toBe(40);
  await owner.mutation(api.catalogCopies.createOneOff, {
    ...writeScope,
    operationId: 'plate',
    definition: homebrew('Full plate', {
      detail: {
        kind: 'item',
        consumable: false,
        armor: {
          slot: 'armor',
          category: 'heavy',
          bonus: 9,
          maxDex: 1,
          armorCheckPenalty: 6,
          asf: 35,
        },
      },
    }),
  });
  const armored = (await read(member)).calculated.derivedStatistics.landSpeed;
  expect(armored?.total).toBe(20);
  expect(armored?.suppressed).toContainEqual(
    expect.objectContaining({
      entryName: 'Fast Movement',
      reason: 'Lost while wearing Full plate (heavy armor).',
    }),
  );
});

test('a player’s feature gives a per-day maximum on permanent ability modifiers; an outsider can do neither', async () => {
  const { owner, member, outsider, scope: writeScope, read } = await fixture();
  await owner.mutation(api.catalogCopies.createOneOff, {
    ...writeScope,
    operationId: 'pool',
    definition: homebrew('Homebrew pool', {
      detail: { kind: 'feat' },
      ruleValues: [
        {
          kind: 'dailyMaximum',
          key: 'homebrewPool',
          unit: 'points',
          amount: { formula: '3 + @ability.cha.mod' },
        },
      ],
    }),
  });
  for (const operationId of ['extra-1', 'extra-2'])
    await member.mutation(api.catalogCopies.createOneOff, {
      ...writeScope,
      operationId,
      definition: homebrew('Extra pool', {
        detail: { kind: 'feat' },
        ruleValues: [
          { kind: 'dailyMaximumIncrease', key: 'homebrewPool', amount: 2 },
        ],
      }),
    });
  const { calculated, permanentCalculated } = await read(member);
  for (const projection of [calculated, permanentCalculated])
    expect(
      projection.dailyMaxima.map(({ key, unit, value, sources }) => ({
        key,
        unit,
        value,
        sources: sources.map(({ name }) => name),
      })),
    ).toEqual([
      {
        key: 'homebrewPool',
        unit: 'points',
        // Charisma 10: 3 + 0, and +2 for each copy of the increase.
        value: 7,
        sources: ['Homebrew pool', 'Extra pool', 'Extra pool'],
      },
    ]);
  await expect(
    outsider.query(api.characterSheet.read, writeScope),
  ).rejects.toThrow('You do not have access to this org');
  await expect(
    outsider.mutation(api.catalogCopies.createOneOff, {
      ...writeScope,
      operationId: 'outsider',
      definition: homebrew('Outsider pool', {
        detail: { kind: 'feat' },
        ruleValues: [
          { kind: 'dailyMaximum', key: 'k', unit: 'uses', amount: 1 },
        ],
      }),
    }),
  ).rejects.toThrow('You do not have access to this org');
});

// Every write path refuses a per-day rule value the shared schema refuses,
// as it refuses the earlier kinds; nothing is stored.
const refused = [
  {
    refusal: 'an empty key',
    ruleValue: { kind: 'dailyMaximum', key: '', unit: 'uses', amount: 1 },
  },
  {
    refusal: 'a key over 64 characters',
    ruleValue: { kind: 'dailyMaximumIncrease', key: 'k'.repeat(65), amount: 1 },
  },
  {
    refusal: 'an unknown unit',
    ruleValue: { kind: 'dailyMaximum', key: 'k', unit: 'minutes', amount: 1 },
  },
  {
    refusal: 'a negative increase',
    ruleValue: { kind: 'dailyMaximumIncrease', key: 'k', amount: -2 },
  },
  {
    refusal: 'an over-long formula',
    ruleValue: {
      kind: 'dailyMaximum',
      key: 'k',
      unit: 'uses',
      amount: { formula: `3 + ${'1 + '.repeat(1024)}1` },
    },
  },
  {
    refusal: 'a tally of uses',
    ruleValue: {
      kind: 'dailyMaximum',
      key: 'k',
      unit: 'uses',
      amount: 1,
      used: 0,
    },
  },
] as const;

test.each(refused)(
  'a player’s feature with $refusal is refused',
  async ({ ruleValue }) => {
    const { owner, scope: writeScope, read } = await fixture();
    const before = await read();
    await expect(
      owner.mutation(api.catalogCopies.createOneOff, {
        ...writeScope,
        operationId: 'refused',
        definition: homebrew('Refused pool', {
          detail: { kind: 'feat' },
          // Deliberately outside the type: the server is the guard.
          ruleValues: [ruleValue as never],
        }),
      }),
    ).rejects.toThrow(/Rule value is invalid|Validator error/);
    expect((await read()).entries).toEqual(before.entries);
  },
);

test('the shared definition write refuses a per-day rule value the schema refuses', async () => {
  const { t, scope: writeScope } = await fixture();
  const definition = {
    ...homebrew('Stored pool', {
      detail: { kind: 'feat' },
      ruleValues: [
        { kind: 'dailyMaximum', key: 'k', unit: 'rounds', amount: 4 },
      ],
    }),
    scope: 'character' as const,
    characterId: writeScope.characterId,
    ruleIdentity: 'one-off:stored-pool',
  };
  await t.run((ctx) => writeCatalogDefinition(ctx, definition));
  for (const { ruleValue } of refused)
    await expect(
      t.run((ctx) =>
        writeCatalogDefinition(ctx, { ...definition, ruleValues: [ruleValue] }),
      ),
    ).rejects.toThrow('Catalog definition is invalid');
});
