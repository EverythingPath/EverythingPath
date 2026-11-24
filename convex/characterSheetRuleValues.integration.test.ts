// @vitest-environment edge-runtime
// rotation-2 (PRD #251; GLOSSARY: Rule value): the saved sheet's read gives
// a class feature's dice from its rule value. The Cleric's Channel Energy is
// 1d6 at 1st and gains a die at each odd level (CRB Table 3–5), each increase
// a row naming Channel Energy as its parentFeature, as a release imports them.
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import type { FunctionArgs } from 'convex/server';
import { api } from './_generated/api';
import { writeCatalogDefinition } from './lib/catalogCopies';
import schema from './schema';

const modules = import.meta.glob('./**/*.ts');
const channelEnergy = 'pf1/kXXz1lO4i7CibHJ9';

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
      name: 'Rule values',
      description: '',
      organizationId: 'org',
      ownerId: 'test|owner',
      e2eFixture: {
        namespace: 'rule-values',
        version: 1,
        workerKey: '0',
        caseKey: 'dice',
        campaignKey: 'dice',
      },
    });
  });
  const owner = t.withIdentity({ tokenIdentifier: 'test|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'test|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'test|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Channel fixture',
    kind: 'pc',
    operationId: 'create',
  });
  const scope = { organizationId: 'org', campaignId, characterId };
  const ids = await t.run(async (ctx) => {
    const feature = (
      ruleIdentity: string,
      name: string,
      parentFeature?: string,
    ) =>
      ctx.db.insert('catalogEntry', {
        scope: 'character',
        characterId,
        ruleIdentity,
        name,
        stacksWithItself: false,
        sources: [{ book: 'Pathfinder RPG Core Rulebook', pages: '38–48' }],
        modifiers: [],
        detail: {
          kind: 'classFeature',
          ...(parentFeature
            ? { parentFeature, part: `${name.at(-1)}:${parentFeature}` }
            : {}),
        },
      });
    const original = await ctx.db.insert('catalogEntry', {
      scope: 'global',
      ruleIdentity: 'fixture/channel-energy-original',
      name: 'Channel Energy',
      stacksWithItself: false,
      sources: [],
      modifiers: [],
      detail: { kind: 'classFeature' },
    });
    // A Catalog Copy stored before rule values existed: no `ruleValues`.
    const channel = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      copiedFrom: original,
      ruleIdentity: channelEnergy,
      name: 'Channel Energy',
      stacksWithItself: false,
      sources: [{ book: 'Pathfinder RPG Core Rulebook', pages: '38–48' }],
      modifiers: [],
      detail: { kind: 'classFeature' },
    });
    const third = await feature(
      'everythingpath/cleric-channel-energy-3',
      'Channel Energy row 3',
      channelEnergy,
    );
    const fifth = await feature(
      'everythingpath/cleric-channel-energy-5',
      'Channel Energy row 5',
      channelEnergy,
    );
    const cleric = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      ruleIdentity: 'fixture/cleric',
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
        featuresByLevel: [
          { classLevel: 1, catalogEntryId: channel },
          { classLevel: 3, catalogEntryId: third },
          { classLevel: 5, catalogEntryId: fifth },
        ],
        picksByLevel: [],
      },
    });
    return { channel, cleric };
  });
  type Actor = typeof owner;
  async function read(actor: Actor = owner) {
    const sheet = await actor.query(api.characterSheet.read, scope);
    if (!sheet) throw new Error('Missing Character Sheet');
    return sheet;
  }
  async function addCleric(actor: Actor, levels: readonly number[]) {
    for (const level of levels)
      await actor.mutation(api.characterSheet.addClassLevel, {
        ...scope,
        classEntryId: ids.cleric,
        operationId: `cleric-${level}`,
      });
  }
  const first = (await read()).entries.find((row) => row.kind === 'classLevel');
  if (!first) throw new Error('Missing first Class Level');
  await owner.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: first._id,
    classEntryId: ids.cleric,
    hpGained: 8,
    operationId: 'cleric-1',
  });
  return { t, owner, member, outsider, scope, read, addCleric, ...ids };
}

const dice = (
  numbers: readonly { count: number | null; die: number }[],
): { count: number | null; die: number }[] =>
  numbers.map(({ count, die }) => ({ count, die }));

test('a saved Cleric reads its channel dice from Channel Energy’s rule value; an old copy without one reads as before', async () => {
  const { t, owner, member, read, addCleric, channel } = await fixture();
  await addCleric(owner, [2, 3]);
  const before = await read();
  expect(before.calculated.featureNumbers).toEqual([]);
  expect(before.permanentCalculated.featureNumbers).toEqual([]);

  // The same definition with Channel Energy's rule value, as a release
  // carrying it stores it.
  await t.run((ctx) =>
    ctx.db.patch('catalogEntry', channel, {
      ruleValues: [{ kind: 'dice', die: 6, amount: { rows: {} } }],
    }),
  );
  const after = await read();
  const channelRow = after.calculated.resolvedEntries.find(
    ({ entry }) =>
      'catalogEntryId' in entry && entry.catalogEntryId === channel,
  )?.entry._id;
  for (const projection of [after.calculated, after.permanentCalculated])
    expect(projection.featureNumbers).toEqual([
      {
        kind: 'dice',
        entryId: channelRow,
        ruleValueIndex: 0,
        count: 2,
        die: 6,
        sources: [
          { entryId: channelRow, name: 'Channel Energy' },
          { entryId: expect.any(String), name: 'Channel Energy row 3' },
        ],
      },
    ]);
  // No other number moves.
  const { featureNumbers: _before, ...beforeRest } = before.calculated;
  const { featureNumbers: _after, ...afterRest } = after.calculated;
  expect(afterRest).toEqual(beforeRest);

  // A member's edit recalculates: Cleric 5 channels 3d6.
  await addCleric(member, [4, 5]);
  expect(dice((await read(member)).calculated.featureNumbers)).toEqual([
    { count: 3, die: 6 },
  ]);
});

test('an outsider can neither read the dice nor add a level', async () => {
  const { outsider, scope, cleric } = await fixture();
  await expect(outsider.query(api.characterSheet.read, scope)).rejects.toThrow(
    'You do not have access to this org',
  );
  await expect(
    outsider.mutation(api.characterSheet.addClassLevel, {
      ...scope,
      classEntryId: cleric,
      operationId: 'outsider-cleric',
    }),
  ).rejects.toThrow('You do not have access to this org');
});

// R2: damage reduction and spell resistance from feats a player made in the
// app. Both damage reduction lines are listed and the highest per bypass is
// the statistic, never a sum; spell resistance is the highest applying line,
// and a line under the feat's own Situation is listed as conditional.
const homebrewFeat = (
  name: string,
  ruleValues: NonNullable<
    FunctionArgs<
      typeof api.catalogCopies.createOneOff
    >['definition']['ruleValues']
  >,
) =>
  ({
    name,
    modifiers: [],
    stacksWithItself: false,
    sources: [],
    detail: { kind: 'feat' },
    ruleValues,
  }) satisfies FunctionArgs<
    typeof api.catalogCopies.createOneOff
  >['definition'];

test('a player’s feats give damage reduction and spell resistance on the saved sheet', async () => {
  const { owner, member, outsider, scope, read } = await fixture();
  await owner.mutation(api.catalogCopies.createOneOff, {
    ...scope,
    operationId: 'hide',
    definition: homebrewFeat('Stone hide', [
      { kind: 'damageReduction', amount: 2, bypass: '-' },
      { kind: 'spellResistance', amount: 13 },
    ]),
  });
  await member.mutation(api.catalogCopies.createOneOff, {
    ...scope,
    operationId: 'ward',
    definition: homebrewFeat('Warded skin', [
      { kind: 'damageReduction', amount: 1, bypass: '-' },
      { kind: 'damageReduction', amount: 5, bypass: 'cold iron' },
      {
        kind: 'spellResistance',
        amount: 15,
        condition: { situation: { local: 'against divine spells' } },
      },
    ]),
  });
  const { calculated, permanentCalculated } = await read(member);
  for (const projection of [calculated, permanentCalculated]) {
    expect(
      projection.damageReduction.values.map(
        ({ value, bypass }) => `${value}/${bypass}`,
      ),
    ).toEqual(['5/cold iron', '2/-']);
    expect(
      projection.damageReduction.lines.map(
        ({ name, value, bypass, applies }) =>
          `${name} ${value}/${bypass} ${applies}`,
      ),
    ).toEqual([
      'Stone hide 2/- true',
      'Warded skin 1/- false',
      'Warded skin 5/cold iron true',
    ]);
    expect(projection.spellResistanceStatistic).toMatchObject({
      value: 13,
      lines: [{ name: 'Stone hide', value: 13, applies: true }],
      conditional: [
        {
          name: 'Warded skin',
          value: 15,
          situation: { local: 'against divine spells' },
        },
      ],
    });
  }
  await expect(
    outsider.mutation(api.catalogCopies.createOneOff, {
      ...scope,
      operationId: 'outsider',
      definition: homebrewFeat('Outsider hide', [
        { kind: 'damageReduction', amount: 10, bypass: '-' },
      ]),
    }),
  ).rejects.toThrow('You do not have access to this org');
});

// fix r1: the public mutation refuses rule values the shared schema refuses
// and those beyond the application limits, as it refuses a bad Modifier or
// Situational Note; nothing is stored. An unsupported but well-formed formula
// is stored and warns when the sheet evaluates it.
test.each([
  {
    refusal: 'too many rule values',
    ruleValues: Array.from({ length: 17 }, () => ({
      kind: 'spellResistance' as const,
      amount: 11,
    })),
    message: 'An entry supports at most 16 Rule values',
  },
  {
    refusal: 'an over-long formula',
    ruleValues: [
      {
        kind: 'spellResistance' as const,
        amount: { formula: `10 + ${'1 + '.repeat(1024)}1` },
      },
    ],
    message: 'Rule value is invalid',
  },
  {
    refusal: 'a one-sided die',
    ruleValues: [{ kind: 'dice' as const, die: 1, amount: 2 }],
    message: 'Rule value is invalid',
  },
  {
    refusal: 'a fractional amount',
    ruleValues: [{ kind: 'spellResistance' as const, amount: 11.5 }],
    message: 'Rule value is invalid',
  },
  {
    refusal: 'a negative amount',
    ruleValues: [{ kind: 'damageReduction' as const, amount: -1, bypass: '-' }],
    message: 'Rule value is invalid',
  },
  {
    refusal: 'zero per row',
    ruleValues: [
      { kind: 'dice' as const, die: 6, amount: { rows: { per: 0 } } },
    ],
    message: 'Rule value is invalid',
  },
  {
    refusal: 'an empty bypass',
    ruleValues: [{ kind: 'damageReduction' as const, amount: 5, bypass: '' }],
    message: 'Rule value is invalid',
  },
  {
    refusal: 'an over-long bypass',
    ruleValues: [
      {
        kind: 'damageReduction' as const,
        amount: 5,
        bypass: 'cold iron '.repeat(10),
      },
    ],
    message: 'Rule value is invalid',
  },
])(
  'a player’s feat with $refusal is refused',
  async ({ ruleValues, message }) => {
    const { owner, scope, read } = await fixture();
    const before = await read();
    await expect(
      owner.mutation(api.catalogCopies.createOneOff, {
        ...scope,
        operationId: 'refused',
        definition: homebrewFeat('Refused hide', ruleValues),
      }),
    ).rejects.toThrow(message);
    expect((await read()).entries).toEqual(before.entries);
  },
);

test('a player’s feat with an unsupported formula is stored and warns', async () => {
  const { owner, scope, read } = await fixture();
  await owner.mutation(api.catalogCopies.createOneOff, {
    ...scope,
    operationId: 'unsupported',
    definition: homebrewFeat('Shifting hide', [
      { kind: 'spellResistance', amount: { formula: '10 + @unknownThing' } },
    ]),
  });
  const { calculated } = await read();
  expect(calculated.spellResistanceStatistic).toMatchObject({
    value: null,
    lines: [{ name: 'Shifting hide', value: null }],
  });
  const [line] = calculated.spellResistanceStatistic.lines;
  expect(calculated.warnings).toContainEqual(
    expect.objectContaining({
      check: 'unsupportedFormula',
      subject: `${line?.entryId}:ruleValue:0`,
    }),
  );
});

test('the shared definition write refuses a rule value the schema refuses', async () => {
  const { t, scope } = await fixture();
  const definition = {
    ...homebrewFeat('Stored hide', [
      { kind: 'damageReduction', amount: 5, bypass: '-' },
    ]),
    scope: 'character' as const,
    characterId: scope.characterId,
    ruleIdentity: 'one-off:stored-hide',
  };
  await t.run((ctx) => writeCatalogDefinition(ctx, definition));
  for (const ruleValues of [
    [{ kind: 'dice', die: 1, amount: 2 }],
    [{ kind: 'damageReduction', amount: 5, bypass: '' }],
    Array.from({ length: 17 }, () => ({ kind: 'spellResistance', amount: 11 })),
  ])
    await expect(
      t.run((ctx) =>
        writeCatalogDefinition(ctx, { ...definition, ruleValues }),
      ),
    ).rejects.toThrow('Catalog definition is invalid');
});
