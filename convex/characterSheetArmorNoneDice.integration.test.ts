// @vitest-environment edge-runtime
// rotation-5 (PRD #251): through the saved sheet's write paths and read,
// part A's armor-only Modifier condition (`armorAtMost: 'none'`, the monk's
// Fast Movement, CRB monk.html:405) and part D's dice increase (a `dice`
// rule value's optional `key`, `diceIncrease { key, amount }`: the
// Phylactery of Positive Channeling's +2d6, PCGen
// cr_equip_magic_items.lst:299). An entry stored before them reads as
// before.
import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import type { FunctionArgs } from 'convex/server';
import { api } from './_generated/api';
import {
  calculateDefinitionFingerprint,
  writeCatalogDefinition,
} from './lib/catalogCopies';
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
      name: 'Armor and dice',
      description: '',
      organizationId: 'org',
      ownerId: 'test|owner',
      e2eFixture: {
        namespace: 'armor-dice',
        version: 1,
        workerKey: '0',
        caseKey: 'armor',
        campaignKey: 'armor',
      },
    });
  });
  const owner = t.withIdentity({ tokenIdentifier: 'test|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'test|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'test|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Armor fixture',
    kind: 'pc',
    operationId: 'create',
  });
  const scope = { organizationId: 'org', campaignId, characterId };
  const human = await t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      ruleIdentity: 'fixture/human',
      name: 'Human',
      stacksWithItself: false,
      sources: [],
      modifiers: [{ target: 'speed.land', bonusType: 'base', value: 30 }],
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
  return { t, owner, member, outsider, scope, read, characterId };
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

const armorItem = (
  name: string,
  armor: {
    slot: 'armor' | 'shield';
    category?: 'light' | 'heavyShield';
  },
) =>
  homebrew(name, {
    detail: {
      kind: 'item',
      consumable: false,
      armor: {
        ...armor,
        bonus: 2,
        maxDex: null,
        armorCheckPenalty: 1,
        asf: 10,
      },
    },
  });

test('a player’s feature lost only in body armor applies with a shield and is lost in light armor with the reason; an outsider can neither write nor read', async () => {
  const { owner, member, outsider, scope, read } = await fixture();
  await member.mutation(api.catalogCopies.createOneOff, {
    ...scope,
    operationId: 'fast',
    definition: homebrew('Fast Movement', {
      detail: { kind: 'feat' },
      modifiers: [
        {
          target: 'speed.land',
          bonusType: 'enhancement',
          value: 10,
          condition: { armorAtMost: 'none' },
        },
      ],
    }),
  });
  expect((await read()).calculated.derivedStatistics.landSpeed?.total).toBe(40);
  await owner.mutation(api.catalogCopies.createOneOff, {
    ...scope,
    operationId: 'shield',
    definition: armorItem('Heavy steel shield', {
      slot: 'shield',
      category: 'heavyShield',
    }),
  });
  expect(
    (await read(member)).calculated.derivedStatistics.landSpeed?.total,
  ).toBe(40);
  await owner.mutation(api.catalogCopies.createOneOff, {
    ...scope,
    operationId: 'leather',
    definition: armorItem('Leather armor', {
      slot: 'armor',
      category: 'light',
    }),
  });
  const armored = (await read(member)).calculated.derivedStatistics.landSpeed;
  expect(armored?.total).toBe(30);
  expect(armored?.suppressed).toContainEqual(
    expect.objectContaining({
      entryName: 'Fast Movement',
      reason: 'Lost while wearing Leather armor (light armor).',
    }),
  );
  await expect(
    outsider.mutation(api.catalogCopies.createOneOff, {
      ...scope,
      operationId: 'outsider',
      definition: homebrew('Outsider movement', {
        detail: { kind: 'feat' },
        modifiers: [
          {
            target: 'speed.land',
            bonusType: 'untyped',
            value: 10,
            condition: { armorAtMost: 'none' },
          },
        ],
      }),
    }),
  ).rejects.toThrow('You do not have access to this org');
  await expect(read(outsider)).rejects.toThrow(
    'You do not have access to this org',
  );
});

test('body armor saved with no category still loses the armor-only feature, with the reason', async () => {
  const { owner, scope, read } = await fixture();
  await owner.mutation(api.catalogCopies.createOneOff, {
    ...scope,
    operationId: 'fast',
    definition: homebrew('Fast Movement', {
      detail: { kind: 'feat' },
      modifiers: [
        {
          target: 'speed.land',
          bonusType: 'enhancement',
          value: 10,
          condition: { armorAtMost: 'none' },
        },
      ],
    }),
  });
  // The item editor lets the category stay blank.
  await owner.mutation(api.catalogCopies.createOneOff, {
    ...scope,
    operationId: 'blank',
    definition: armorItem('Mystery mail', { slot: 'armor' }),
  });
  const speed = (await read()).calculated.derivedStatistics.landSpeed;
  expect(speed?.total).toBe(30);
  expect(speed?.suppressed).toContainEqual(
    expect.objectContaining({
      entryName: 'Fast Movement',
      reason:
        'Lost while wearing Mystery mail (its armor category is unknown).',
    }),
  );
});

test('a personal adjustment cannot carry the armor-only condition, and an unknown limit is refused', async () => {
  const { owner, scope, read } = await fixture();
  const before = await read();
  const modifiers = (condition: unknown) => [
    {
      target: 'speed.land' as const,
      bonusType: 'untyped' as const,
      value: 10,
      // Deliberately outside the type: the server is the guard.
      condition: condition as never,
    },
  ];
  for (const definition of [
    homebrew('Refused adjustment', {
      detail: { kind: 'manual' },
      modifiers: modifiers({ armorAtMost: 'none' }),
    }),
    homebrew('Refused limit', {
      detail: { kind: 'feat' },
      modifiers: modifiers({ armorAtMost: 'heavy' }),
    }),
  ])
    await expect(
      owner.mutation(api.catalogCopies.createOneOff, {
        ...scope,
        operationId: `refused-${definition.name}`,
        definition,
      }),
    ).rejects.toThrow(/Modifier condition is invalid|Validator error/);
  expect((await read()).entries).toEqual(before.entries);
});

test('a Catalog Copy stored before dice keys reads as before; a player’s keyed dice and an item’s increase add per copy, named in the sources', async () => {
  const { t, owner, member, scope, read } = await fixture();
  // As stored before rotation-5: a dice value with no key.
  await owner.mutation(api.catalogCopies.createOneOff, {
    ...scope,
    operationId: 'old',
    definition: homebrew('Old channel', {
      detail: { kind: 'feat' },
      ruleValues: [{ kind: 'dice', die: 6, amount: 3 }],
    }),
  });
  const stored = await t.run((ctx) =>
    ctx.db
      .query('catalogEntry')
      .filter((q) => q.eq(q.field('name'), 'Old channel'))
      .first(),
  );
  expect(stored?.ruleValues).toEqual([{ kind: 'dice', die: 6, amount: 3 }]);
  const before = await read();
  const oldDice = before.calculated.featureNumbers.map(({ count, die }) => [
    count,
    die,
  ]);
  await owner.mutation(api.catalogCopies.createOneOff, {
    ...scope,
    operationId: 'channel',
    definition: homebrew('Homebrew channel', {
      detail: { kind: 'feat' },
      ruleValues: [{ kind: 'dice', die: 6, amount: 2, key: 'homebrewChannel' }],
    }),
  });
  for (const operationId of ['item-1', 'item-2'])
    await member.mutation(api.catalogCopies.createOneOff, {
      ...scope,
      operationId,
      definition: homebrew('Channeling focus', {
        detail: { kind: 'item', consumable: false },
        ruleValues: [
          { kind: 'diceIncrease', key: 'homebrewChannel', amount: 2 },
        ],
      }),
    });
  const { calculated, permanentCalculated } = await read(member);
  for (const projection of [calculated, permanentCalculated]) {
    const numbers = projection.featureNumbers.map(
      ({ count, die, sources }) => ({
        count,
        die,
        sources: sources.map(({ name }) => name),
      }),
    );
    // The old copy's dice are unchanged; nothing adds to an unkeyed value.
    expect(
      numbers.filter(({ sources }) => sources[0] === 'Old channel'),
    ).toEqual(
      oldDice.map(([count, die]) => ({ count, die, sources: ['Old channel'] })),
    );
    expect(
      numbers.filter(({ sources }) => sources[0] === 'Homebrew channel'),
    ).toEqual([
      {
        count: 6,
        die: 6,
        sources: ['Homebrew channel', 'Channeling focus', 'Channeling focus'],
      },
    ]);
  }
  expect(oldDice).toEqual([[3, 6]]);
});

// fix r1 (finding 5): a Catalog Copy written before rotation-5, with its
// provenance (`copiedFrom` and the original's fingerprint), unkeyed dice, a
// per-day maximum with no floor and an `armorAtMost: 'medium'` Modifier
// (no `none`), reads and computes exactly as before: 3d6, 3/day, 40 ft.;
// a dice increase on the sheet does not reach it, and nothing is rewritten.
test('a Catalog Copy stored before rotation-5 with unkeyed dice reads and computes exactly as before', async () => {
  const { t, owner, scope, read } = await fixture();
  const ids = await t.run(async (ctx) => {
    const legacy = {
      ruleIdentity: 'fixture/legacy-channel',
      name: 'Legacy channel',
      stacksWithItself: false,
      sources: [],
      modifiers: [
        {
          target: 'speed.land' as const,
          bonusType: 'enhancement' as const,
          value: 10,
          condition: { armorAtMost: 'medium' as const },
        },
      ],
      detail: { kind: 'classFeature' as const },
      ruleValues: [
        { kind: 'dice' as const, die: 6, amount: 3 },
        {
          kind: 'dailyMaximum' as const,
          key: 'classFeat_channelEnergy',
          unit: 'uses' as const,
          amount: { formula: '3 + @ability.cha.mod' },
        },
      ],
    };
    const original = await ctx.db.insert('catalogEntry', {
      ...legacy,
      scope: 'global',
    });
    const originalDocument = await ctx.db.get('catalogEntry', original);
    if (!originalDocument) throw new Error('Missing original');
    const copy = await ctx.db.insert('catalogEntry', {
      ...legacy,
      scope: 'character',
      characterId: scope.characterId,
      copiedFrom: original,
      copiedFromFingerprint:
        await calculateDefinitionFingerprint(originalDocument),
      sourceKey: legacy.ruleIdentity,
    });
    const legacyClass = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId: scope.characterId,
      ruleIdentity: 'fixture/legacy-cleric',
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
        featuresByLevel: [{ classLevel: 1, catalogEntryId: copy }],
        picksByLevel: [],
      },
    });
    return { copy, legacyClass };
  });
  const stored = await t.run((ctx) => ctx.db.get('catalogEntry', ids.copy));
  await owner.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    classEntryId: ids.legacyClass,
    operationId: 'legacy-cleric-1',
  });
  const expected = async () => {
    const sheet = await read();
    const row = sheet.calculated.resolvedEntries.find(
      ({ entry }) =>
        'catalogEntryId' in entry && entry.catalogEntryId === ids.copy,
    )?.entry._id;
    if (!row) throw new Error('Missing the copy’s row');
    const source = { entryId: row, name: 'Legacy channel' };
    for (const projection of [sheet.calculated, sheet.permanentCalculated]) {
      // Exactly the shapes read before: no `increases`, no `floor`.
      expect(projection.featureNumbers).toEqual([
        {
          kind: 'dice',
          entryId: row,
          ruleValueIndex: 0,
          count: 3,
          die: 6,
          sources: [source],
        },
      ]);
      expect(projection.dailyMaxima).toEqual([
        {
          entryId: row,
          ruleValueIndex: 1,
          key: 'classFeat_channelEnergy',
          unit: 'uses',
          value: 3,
          sources: [source],
        },
      ]);
      expect(projection.derivedStatistics.landSpeed?.total).toBe(40);
    }
    return sheet;
  };
  await expected();
  // An increase on the sheet does not reach the unkeyed dice.
  await owner.mutation(api.catalogCopies.createOneOff, {
    ...scope,
    operationId: 'focus',
    definition: homebrew('Channeling focus', {
      detail: { kind: 'item', consumable: false },
      ruleValues: [
        { kind: 'diceIncrease', key: 'classFeat_channelEnergy', amount: 2 },
      ],
    }),
  });
  await expected();
  // Nothing rewrote the stored copy.
  expect(await t.run((ctx) => ctx.db.get('catalogEntry', ids.copy))).toEqual(
    stored,
  );
});

// fix r1: one entry repeats no dice increase and raises none of its own
// dice, at each write; nothing is stored.
const refusedTogether = [
  {
    refusal: 'a repeated increase',
    ruleValues: [
      { kind: 'diceIncrease', key: 'homebrewChannel', amount: 2 },
      { kind: 'diceIncrease', key: 'homebrewChannel', amount: 2 },
    ],
    reason:
      'An entry increases the dice of homebrewChannel once; this one repeats it.',
  },
  {
    refusal: 'an increase to its own dice',
    ruleValues: [
      { kind: 'dice', die: 6, amount: 4, key: 'homebrewChannel' },
      { kind: 'diceIncrease', key: 'homebrewChannel', amount: 2 },
    ],
    reason:
      'A dice increase raises another entry’s dice; homebrewChannel is this entry’s own.',
  },
] as const;

test.each(refusedTogether)(
  'a player’s entry with $refusal is refused, and so is the shared definition write',
  async ({ ruleValues, reason }) => {
    const { t, owner, scope, read } = await fixture();
    const before = await read();
    const definition = homebrew('Refused focus', {
      detail: { kind: 'item', consumable: false },
      ruleValues: [...ruleValues],
    });
    await expect(
      owner.mutation(api.catalogCopies.createOneOff, {
        ...scope,
        operationId: 'refused',
        definition,
      }),
    ).rejects.toThrow(reason);
    expect((await read()).entries).toEqual(before.entries);
    await expect(
      t.run((ctx) =>
        writeCatalogDefinition(ctx, {
          ...definition,
          scope: 'character' as const,
          characterId: scope.characterId,
          ruleIdentity: 'one-off:refused-focus',
        }),
      ),
    ).rejects.toThrow('Catalog definition is invalid');
  },
);

// Every write path refuses a dice key or increase the shared schema refuses,
// as it refuses the earlier kinds; nothing is stored.
const refusedDice = [
  {
    refusal: 'an empty dice key',
    ruleValue: { kind: 'dice', die: 6, amount: 1, key: '' },
  },
  {
    refusal: 'an increase key over 64 characters',
    ruleValue: { kind: 'diceIncrease', key: 'k'.repeat(65), amount: 1 },
  },
  {
    refusal: 'an increase without a key',
    ruleValue: { kind: 'diceIncrease', amount: 1 },
  },
  {
    refusal: 'a negative increase',
    ruleValue: { kind: 'diceIncrease', key: 'k', amount: -2 },
  },
  {
    refusal: 'an increase with its own die',
    ruleValue: { kind: 'diceIncrease', key: 'k', amount: 2, die: 8 },
  },
  {
    refusal: 'an over-long formula',
    ruleValue: {
      kind: 'diceIncrease',
      key: 'k',
      amount: { formula: `2 + ${'1 + '.repeat(1024)}1` },
    },
  },
] as const;

test.each(refusedDice)(
  'a player’s entry with $refusal is refused',
  async ({ ruleValue }) => {
    const { owner, scope, read } = await fixture();
    const before = await read();
    await expect(
      owner.mutation(api.catalogCopies.createOneOff, {
        ...scope,
        operationId: 'refused',
        definition: homebrew('Refused focus', {
          detail: { kind: 'feat' },
          // Deliberately outside the type: the server is the guard.
          ruleValues: [ruleValue as never],
        }),
      }),
    ).rejects.toThrow(/Rule value is invalid|Validator error/);
    expect((await read()).entries).toEqual(before.entries);
  },
);

test('the shared definition write takes a dice increase and refuses what the schema refuses', async () => {
  const { t, scope } = await fixture();
  const definition = {
    ...homebrew('Stored focus', {
      detail: { kind: 'feat' },
      ruleValues: [{ kind: 'diceIncrease', key: 'k', amount: 2 }],
    }),
    scope: 'character' as const,
    characterId: scope.characterId,
    ruleIdentity: 'one-off:stored-focus',
  };
  await t.run((ctx) => writeCatalogDefinition(ctx, definition));
  for (const { ruleValue } of refusedDice)
    await expect(
      t.run((ctx) =>
        writeCatalogDefinition(ctx, {
          ...definition,
          ruleValues: [ruleValue as never],
        }),
      ),
    ).rejects.toThrow('Catalog definition is invalid');
});
