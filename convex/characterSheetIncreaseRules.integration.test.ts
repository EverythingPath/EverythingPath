// @vitest-environment edge-runtime
// rotation-6 (PRD #251): through the saved sheet's write paths and read, an
// increase that counts once per Source (`oncePerSource`, opt-in: root,
// 2026-11-20), an increase gated by its entry's saved choice (`choice`),
// the not-counted lines on the read, and a maximum that joins another of its
// key (`joins`). The fixtures are a player's one-offs, except the last
// test's, Catalog Copies stored as before rotation-6 with their provenance,
// and the shared definitions the refusal tests write directly; no committed
// record carries the new fields.
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
      name: 'Increases',
      description: '',
      organizationId: 'org',
      ownerId: 'test|owner',
      e2eFixture: {
        namespace: 'increases',
        version: 1,
        workerKey: '0',
        caseKey: 'increases',
        campaignKey: 'increases',
      },
    });
  });
  const owner = t.withIdentity({ tokenIdentifier: 'test|owner' });
  const member = t.withIdentity({ tokenIdentifier: 'test|member' });
  const outsider = t.withIdentity({ tokenIdentifier: 'test|outsider' });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Increase fixture',
    kind: 'pc',
    operationId: 'create',
  });
  const scope = { organizationId: 'org', campaignId, characterId };
  type Actor = typeof owner;
  async function read(actor: Actor = owner) {
    const sheet = await actor.query(api.characterSheet.read, scope);
    if (!sheet) throw new Error('Missing Character Sheet');
    return sheet;
  }
  async function oneOff(
    operationId: string,
    definition: Definition,
    actor: Actor = owner,
  ) {
    return actor.mutation(api.catalogCopies.createOneOff, {
      ...scope,
      operationId,
      definition,
    });
  }
  return { t, owner, member, outsider, scope, read, oneOff };
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

const pool = homebrew('Homebrew pool', {
  detail: { kind: 'feat' },
  ruleValues: [
    { kind: 'dailyMaximum', key: 'homebrewPool', unit: 'points', amount: 3 },
  ],
});

async function catalogEntryOf(
  read: () => Promise<{ entries: readonly unknown[] }>,
  sheetEntryId: string,
) {
  const row = (await read()).entries.find(
    (entry) => (entry as { _id: string })._id === sheetEntryId,
  ) as { catalogEntryId?: string } | undefined;
  if (!row?.catalogEntryId) throw new Error('Missing one-off row');
  return row.catalogEntryId as never;
}

test('a player’s item increase carrying oncePerSource counts once for two rows of it; a feat without it adds per row', async () => {
  const { owner, member, scope, read, oneOff } = await fixture();
  await oneOff('pool', pool);
  const charm = await oneOff(
    'charm',
    homebrew('Pool charm', {
      detail: { kind: 'item', consumable: false },
      ruleValues: [
        {
          kind: 'dailyMaximumIncrease',
          key: 'homebrewPool',
          amount: 2,
          oncePerSource: true,
        },
      ],
    }),
    member,
  );
  const feat = await oneOff(
    'feat',
    homebrew('Extra pool', {
      detail: { kind: 'feat' },
      ruleValues: [
        { kind: 'dailyMaximumIncrease', key: 'homebrewPool', amount: 1 },
      ],
    }),
  );
  for (const [operationId, sheetEntryId] of [
    ['charm-2', charm],
    ['feat-2', feat],
  ] as const)
    await owner.mutation(api.characterSheet.selectEntry, {
      ...scope,
      operationId,
      catalogEntryId: await catalogEntryOf(read, sheetEntryId),
    });
  const { calculated, permanentCalculated } = await read(member);
  for (const projection of [calculated, permanentCalculated])
    expect(
      projection.dailyMaxima.map(({ value, sources }) => ({
        value,
        sources: sources.map(({ name }) => name),
      })),
    ).toEqual([
      {
        value: 3 + 2 + 1 + 1,
        sources: ['Homebrew pool', 'Pool charm', 'Extra pool', 'Extra pool'],
      },
    ]);
  // rotation-6 part N: the second charm is listed on the read as not counted.
  expect(
    calculated.dailyMaxima.map(({ notCounted }) =>
      notCounted?.map(({ name, reason }) => `${name} ${reason}`),
    ),
  ).toEqual([['Pool charm sameSource']]);
});

const refusedOncePerSource = [
  {
    refusal: 'oncePerSource on a maximum',
    ruleValue: {
      kind: 'dailyMaximum',
      key: 'k',
      unit: 'uses',
      amount: 1,
      oncePerSource: true,
    },
  },
  {
    refusal: 'oncePerSource on dice',
    ruleValue: { kind: 'dice', die: 6, amount: 1, oncePerSource: true },
  },
  {
    refusal: 'oncePerSource on damage reduction',
    ruleValue: {
      kind: 'damageReduction',
      amount: 1,
      bypass: '-',
      oncePerSource: true,
    },
  },
  {
    refusal: 'oncePerSource false',
    ruleValue: {
      kind: 'dailyMaximumIncrease',
      key: 'k',
      amount: 1,
      oncePerSource: false,
    },
  },
] as const;

test.each(refusedOncePerSource)(
  'a player’s entry with $refusal is refused, and so is the shared definition write',
  async ({ ruleValue }) => {
    const { t, owner, scope, read } = await fixture();
    const before = await read();
    const definition = homebrew('Refused charm', {
      detail: { kind: 'feat' },
      // Deliberately outside the type: the server is the guard.
      ruleValues: [ruleValue as never],
    });
    await expect(
      owner.mutation(api.catalogCopies.createOneOff, {
        ...scope,
        operationId: 'refused',
        definition,
      }),
    ).rejects.toThrow(/Rule value is invalid|Validator error/);
    expect((await read()).entries).toEqual(before.entries);
    await expect(
      t.run((ctx) =>
        writeCatalogDefinition(ctx, {
          ...definition,
          scope: 'character' as const,
          characterId: scope.characterId,
          ruleIdentity: 'one-off:refused-charm',
        }),
      ),
    ).rejects.toThrow('Catalog definition is invalid');
  },
);

test('a player’s feat whose increase is for one choice adds once that choice is saved, and warns while none is', async () => {
  const { owner, scope, read, oneOff } = await fixture();
  await oneOff('pool', pool);
  const definition = homebrew('Pool feat', {
    detail: { kind: 'feat' },
    ruleValues: [
      {
        kind: 'dailyMaximumIncrease',
        key: 'homebrewPool',
        amount: 2,
        choice: ['Pool'],
      },
    ],
  });
  const feat = await oneOff('feat', definition);
  const shown = async () => {
    const sheet = await read();
    return {
      value: sheet.calculated.dailyMaxima.map(({ value }) => value),
      warnings: sheet.calculated.warnings
        .filter(({ check }) => check.startsWith('ruleValueChoice'))
        .map(({ check }) => check),
    };
  };
  expect(await shown()).toEqual({
    value: [3],
    warnings: ['ruleValueChoiceMissing'],
  });
  await owner.mutation(api.characterSheet.selectEntry, {
    ...scope,
    operationId: 'feat-chosen',
    catalogEntryId: await catalogEntryOf(read, feat),
    choice: 'pool',
  });
  // The first row still has no choice; the second adds.
  expect(await shown()).toEqual({
    value: [5],
    warnings: ['ruleValueChoiceMissing'],
  });
});

// rotation-6 fix r4 (Spec r4 finding 1, the reviewer's probe first): an
// accepted choice warning is keyed by the options it names, so it reopens
// when a pool its entry's increase is for appears or goes, and when the
// entry's saved choice changes.
test('an accepted choice warning reopens when an option it names is added or removed, and when the saved choice changes', async () => {
  const { owner, scope, read, oneOff } = await fixture();
  await oneOff('pool', pool);
  const feat = await oneOff(
    'feat-with-alternatives',
    homebrew('Two pools', {
      detail: { kind: 'feat' },
      ruleValues: [
        {
          kind: 'dailyMaximumIncrease',
          key: 'homebrewPool',
          amount: 2,
          choice: ['First'],
        },
        {
          kind: 'dailyMaximumIncrease',
          key: 'laterPool',
          amount: 2,
          choice: ['Second'],
        },
      ],
    }),
  );
  const choose = (operationId: string, choice: string) =>
    owner.mutation(api.characterSheet.editSelection, {
      ...scope,
      entryId: feat,
      operationId,
      choice,
    });
  const unmatched = async () => {
    const sheet = await read();
    const warning = sheet.calculated.warnings.find(
      ({ check }) => check === 'ruleValueChoiceUnmatched',
    );
    if (!warning) throw new Error('Expected a choice advisory');
    return { warning, accepted: sheet.acceptedWarnings.length };
  };
  const accept = async (operationId: string) => {
    const { warning } = await unmatched();
    await owner.mutation(api.characterSheet.acceptWarning, {
      ...scope,
      operationId,
      check: warning.check,
      subject: warning.subject,
      fingerprint: warning.fingerprint,
    });
    expect((await unmatched()).accepted).toBe(1);
    return warning;
  };
  await choose('choose-other', 'Other');
  const first = await accept('accept-first');
  expect(first.message).toContain('First');
  expect(first.message).not.toContain('Second');
  // Added: the second pool appears and the advisory names its option too.
  const laterPool = await oneOff(
    'new-pool',
    homebrew('Later pool', {
      detail: { kind: 'feat' },
      ruleValues: [
        { kind: 'dailyMaximum', key: 'laterPool', unit: 'points', amount: 3 },
      ],
    }),
  );
  const added = await unmatched();
  expect(added.warning.message).toContain('Second');
  expect(added.accepted).toBe(0);
  // Removed: the second pool is set inactive and the advisory names First
  // alone again.
  await accept('accept-both');
  await owner.mutation(api.characterSheet.editSelection, {
    ...scope,
    entryId: laterPool,
    operationId: 'pool-inactive',
    active: false,
  });
  const removed = await unmatched();
  expect(removed.warning.message).not.toContain('Second');
  expect(removed.accepted).toBe(0);
  // The saved choice changes: another unmatched choice reopens it; the same
  // choice in another case or with spaces around it is the same fact.
  await accept('accept-other');
  await choose('choose-other-again', '  other ');
  expect((await unmatched()).accepted).toBe(1);
  await choose('choose-third', 'Third');
  expect((await unmatched()).accepted).toBe(0);
});

// rotation-6 fix r3 (root, 2026-11-20): a recorded personal adjustment has
// no choice control, and the gate does not read its choice: its increase is
// never counted, even with a choice written into its state through the
// Selection edit, and it warns nothing.
test('a player’s personal adjustment whose increase is for a choice is never counted, even with that choice in its state', async () => {
  const { owner, scope, read, oneOff } = await fixture();
  await oneOff('pool', pool);
  const adjustment = await oneOff(
    'adjustment',
    homebrew('Pool adjustment', {
      detail: { kind: 'manual' },
      ruleValues: [
        {
          kind: 'dailyMaximumIncrease',
          key: 'homebrewPool',
          amount: 2,
          choice: ['Pool'],
        },
      ],
    }),
  );
  const shown = async () => {
    const sheet = await read();
    return {
      maxima: sheet.calculated.dailyMaxima.map(({ value, notCounted }) => ({
        value,
        notCounted: notCounted?.map(({ reason }) => reason),
      })),
      warnings: sheet.calculated.warnings
        .filter(({ check }) => check.startsWith('ruleValueChoice'))
        .map(({ check }) => check),
    };
  };
  const never = {
    maxima: [{ value: 3, notCounted: ['choiceNotRead'] }],
    warnings: [],
  };
  expect(await shown()).toEqual(never);
  await owner.mutation(api.characterSheet.editSelection, {
    ...scope,
    operationId: 'adjustment-chosen',
    entryId: adjustment,
    choice: 'Pool',
  });
  expect(await shown()).toEqual(never);
});

// rotation-6 fix r4 (Standards r4 finding 1, the reviewer's probe first): a
// race records a choice, its weapon proficiency choice saved as text in the
// Proficiencies editor, but the gate does not read a race's choice (root,
// 2026-11-20), so its increase is never counted and the line says that the
// entry's choice cannot affect it, not that it records none.
test('a player’s one-off race with a weapon proficiency choice saves it as text, and its increase for that choice is still never counted', async () => {
  const { owner, scope, read, oneOff } = await fixture();
  await oneOff('pool', pool);
  const race = await oneOff(
    'race',
    homebrew('Rapier race', {
      detail: { kind: 'race', racialTraits: [] },
      proficiencies: [{ choice: true }],
      ruleValues: [
        {
          kind: 'dailyMaximumIncrease',
          key: 'homebrewPool',
          amount: 2,
          choice: ['Rapier'],
        },
      ],
    }),
  );
  await owner.mutation(api.characterSheet.setProficiencyChoice, {
    ...scope,
    entryId: race,
    choice: ' rapier ',
    operationId: 'race-proficiency',
  });
  const sheet = await read();
  const row = sheet.entries.find(
    (entry) => (entry as { _id: string })._id === race,
  ) as { state: { choice?: string | null } } | undefined;
  expect(row?.state.choice).toBe('rapier');
  expect(
    sheet.calculated.dailyMaxima.map(({ value, notCounted }) => ({
      value,
      notCounted: notCounted?.map(({ name, reason }) => `${name} ${reason}`),
    })),
  ).toEqual([{ value: 3, notCounted: ['Rapier race choiceNotRead'] }]);
  expect(
    sheet.calculated.warnings.filter(({ check }) =>
      check.startsWith('ruleValueChoice'),
    ),
  ).toEqual([]);
});

const refusedChoice = [
  {
    refusal: 'an empty choice list',
    ruleValue: { kind: 'diceIncrease', key: 'k', amount: 1, choice: [] },
  },
  {
    refusal: 'a blank option',
    ruleValue: { kind: 'diceIncrease', key: 'k', amount: 1, choice: [' '] },
  },
  {
    refusal: 'an option over 64 characters',
    ruleValue: {
      kind: 'dailyMaximumIncrease',
      key: 'k',
      amount: 1,
      choice: ['o'.repeat(65)],
    },
  },
  {
    refusal: '17 options',
    ruleValue: {
      kind: 'dailyMaximumIncrease',
      key: 'k',
      amount: 1,
      choice: Array.from({ length: 17 }, (_, index) => `o${index}`),
    },
  },
  {
    refusal: 'a choice on a maximum',
    ruleValue: {
      kind: 'dailyMaximum',
      key: 'k',
      unit: 'uses',
      amount: 1,
      choice: ['Pool'],
    },
  },
  {
    refusal: 'a choice on spell resistance',
    ruleValue: { kind: 'spellResistance', amount: 1, choice: ['Pool'] },
  },
] as const;

test.each(refusedChoice)(
  'a player’s entry with $refusal is refused, and so is the shared definition write',
  async ({ ruleValue }) => {
    const { t, owner, scope, read } = await fixture();
    const before = await read();
    const definition = homebrew('Refused feat', {
      detail: { kind: 'feat' },
      // Deliberately outside the type: the server is the guard.
      ruleValues: [ruleValue as never],
    });
    await expect(
      owner.mutation(api.catalogCopies.createOneOff, {
        ...scope,
        operationId: 'refused',
        definition,
      }),
    ).rejects.toThrow(/Rule value is invalid|Validator error/);
    expect((await read()).entries).toEqual(before.entries);
    await expect(
      t.run((ctx) =>
        writeCatalogDefinition(ctx, {
          ...definition,
          scope: 'character' as const,
          characterId: scope.characterId,
          ruleIdentity: 'one-off:refused-feat',
        }),
      ),
    ).rejects.toThrow('Catalog definition is invalid');
  },
);

// rotation-6 fix r3 (root, 2026-11-20): nothing about an entry's kind is
// checked when a rule value is written, so a player's item, Spell Effect or
// Condition whose increase is for a choice is saved, through the one-off and
// the shared definition write alike; it saves no choice of its own (an
// item's abilities may each save one, read only for the ability), and the
// calculation reads no choice for it, so the read never counts it, lists it with that reason and warns nothing.
const noChoiceKinds = [
  { kind: 'an item', detail: { kind: 'item', consumable: false } },
  {
    kind: 'a Spell Effect',
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: true,
      defaultCasterLevel: 1,
    },
  },
  { kind: 'a Condition', detail: { kind: 'condition' } },
] as const;

test.each(noChoiceKinds)(
  'a player’s entry for $kind whose increase is for a choice is saved, and the read never counts it',
  async ({ detail }) => {
    const { t, scope, read, oneOff } = await fixture();
    await oneOff('pool', pool);
    const definition = homebrew('Pool charm', {
      detail,
      ruleValues: [
        {
          kind: 'dailyMaximumIncrease',
          key: 'homebrewPool',
          amount: 1,
          choice: ['Pool'],
        },
      ],
    });
    await oneOff('saved', definition);
    const sheet = await read();
    expect(
      sheet.calculated.dailyMaxima.map(({ value, notCounted }) => ({
        value,
        notCounted,
      })),
    ).toEqual([
      {
        value: 3,
        notCounted: [
          expect.objectContaining({
            name: 'Pool charm',
            reason: 'choiceNotRead',
          }),
        ],
      },
    ]);
    expect(
      sheet.calculated.warnings.filter(({ check }) =>
        check.startsWith('ruleValueChoice'),
      ),
    ).toEqual([]);
    await expect(
      t.run((ctx) =>
        writeCatalogDefinition(ctx, {
          ...definition,
          scope: 'character' as const,
          characterId: scope.characterId,
          ruleIdentity: 'one-off:saved-charm',
        }),
      ),
    ).resolves.toBeTruthy();
  },
);

test('a player’s maximum that joins adds to the pool of its key on the read, and stands alone without one', async () => {
  const { read, oneOff } = await fixture();
  await oneOff(
    'joining',
    homebrew('Joining pool', {
      detail: { kind: 'feat' },
      ruleValues: [
        {
          kind: 'dailyMaximum',
          key: 'homebrewPool',
          unit: 'points',
          amount: 2,
          joins: true,
        },
      ],
    }),
  );
  const shown = async () =>
    (await read()).calculated.dailyMaxima.map(({ value, sources }) => ({
      value,
      sources: sources.map(({ name }) => name),
    }));
  expect(await shown()).toEqual([{ value: 2, sources: ['Joining pool'] }]);
  await oneOff('pool', pool);
  expect(await shown()).toEqual([
    { value: 5, sources: ['Homebrew pool', 'Joining pool'] },
  ]);
});

const refusedJoins = [
  {
    refusal: 'joins on an increase',
    ruleValue: {
      kind: 'dailyMaximumIncrease',
      key: 'k',
      amount: 1,
      joins: true,
    },
  },
  {
    refusal: 'joins false',
    ruleValue: {
      kind: 'dailyMaximum',
      key: 'k',
      unit: 'uses',
      amount: 1,
      joins: false,
    },
  },
  {
    refusal: 'joins on dice',
    ruleValue: { kind: 'dice', die: 6, amount: 1, joins: true },
  },
] as const;

test.each(refusedJoins)(
  'a player’s entry with $refusal is refused, and so is the shared definition write',
  async ({ ruleValue }) => {
    const { t, owner, scope, read } = await fixture();
    const before = await read();
    const definition = homebrew('Refused pool', {
      detail: { kind: 'feat' },
      // Deliberately outside the type: the server is the guard.
      ruleValues: [ruleValue as never],
    });
    await expect(
      owner.mutation(api.catalogCopies.createOneOff, {
        ...scope,
        operationId: 'refused',
        definition,
      }),
    ).rejects.toThrow(/Rule value is invalid|Validator error/);
    expect((await read()).entries).toEqual(before.entries);
    await expect(
      t.run((ctx) =>
        writeCatalogDefinition(ctx, {
          ...definition,
          scope: 'character' as const,
          characterId: scope.characterId,
          ruleIdentity: 'one-off:refused-pool',
        }),
      ),
    ).rejects.toThrow('Catalog definition is invalid');
  },
);

// An entry stored before rotation-6, a Catalog Copy with its provenance,
// carries none of the new fields: its increases add per copy, whatever the
// feat's saved choice, the read has no not-counted list, and nothing is
// rewritten.
test('Catalog Copies stored before rotation-6 read and compute exactly as before', async () => {
  const { t, owner, scope, read } = await fixture();
  const ids = await t.run(async (ctx) => {
    const fields = {
      stacksWithItself: false,
      sources: [],
      modifiers: [],
    };
    const legacyChannel = {
      ...fields,
      ruleIdentity: 'fixture/legacy-channel',
      name: 'Legacy channel',
      detail: { kind: 'classFeature' as const },
      ruleValues: [
        {
          kind: 'dice' as const,
          die: 6,
          amount: 3,
          key: 'classFeat_channelEnergy',
        },
        {
          kind: 'dailyMaximum' as const,
          key: 'classFeat_channelEnergy',
          unit: 'uses' as const,
          amount: 3,
        },
      ],
    };
    const legacyFeat = {
      ...fields,
      ruleIdentity: 'fixture/legacy-extra-channel',
      name: 'Legacy extra channel',
      detail: { kind: 'feat' as const },
      ruleValues: [
        {
          kind: 'dailyMaximumIncrease' as const,
          key: 'classFeat_channelEnergy',
          amount: 2,
        },
        {
          kind: 'diceIncrease' as const,
          key: 'classFeat_channelEnergy',
          amount: 1,
        },
      ],
    };
    async function copyOf(
      definition: typeof legacyChannel | typeof legacyFeat,
    ) {
      const original = await ctx.db.insert('catalogEntry', {
        ...definition,
        scope: 'global',
      });
      const originalDocument = await ctx.db.get('catalogEntry', original);
      if (!originalDocument) throw new Error('Missing original');
      return ctx.db.insert('catalogEntry', {
        ...definition,
        scope: 'character',
        characterId: scope.characterId,
        copiedFrom: original,
        copiedFromFingerprint:
          await calculateDefinitionFingerprint(originalDocument),
        sourceKey: definition.ruleIdentity,
      });
    }
    const channel = await copyOf(legacyChannel);
    const feat = await copyOf(legacyFeat);
    const legacyClass = await ctx.db.insert('catalogEntry', {
      ...fields,
      scope: 'character',
      characterId: scope.characterId,
      ruleIdentity: 'fixture/legacy-cleric',
      name: 'Cleric',
      detail: {
        kind: 'class',
        classKind: 'base',
        tag: 'cleric',
        hitDie: 8,
        bab: 'threeQuarters',
        saves: { fort: 'good', ref: 'poor', will: 'good' },
        skillRanksPerLevel: 2,
        classSkills: [],
        featuresByLevel: [{ classLevel: 1, catalogEntryId: channel }],
        picksByLevel: [],
      },
    });
    return { channel, feat, legacyClass };
  });
  const stored = await t.run(async (ctx) => [
    await ctx.db.get('catalogEntry', ids.channel),
    await ctx.db.get('catalogEntry', ids.feat),
  ]);
  await owner.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    classEntryId: ids.legacyClass,
    operationId: 'legacy-cleric-1',
  });
  for (const [operationId, choice] of [
    ['feat-1', 'Paladin'],
    ['feat-2', null],
  ] as const)
    await owner.mutation(api.characterSheet.selectEntry, {
      ...scope,
      operationId,
      catalogEntryId: ids.feat,
      choice,
    });
  const sheet = await read();
  const rowOf = (catalogEntryId: string) =>
    sheet.calculated.resolvedEntries.flatMap(({ entry }) =>
      'catalogEntryId' in entry && entry.catalogEntryId === catalogEntryId
        ? [entry._id]
        : [],
    );
  const [channelRow] = rowOf(ids.channel);
  const featRows = rowOf(ids.feat);
  if (!channelRow || featRows.length !== 2) throw new Error('Missing rows');
  const channelSource = { entryId: channelRow, name: 'Legacy channel' };
  const featSources = featRows.map((entryId) => ({
    entryId,
    name: 'Legacy extra channel',
  }));
  for (const projection of [sheet.calculated, sheet.permanentCalculated]) {
    // Exactly the shapes read before: every copy adds, no `notCounted`.
    expect(projection.featureNumbers).toEqual([
      {
        kind: 'dice',
        entryId: channelRow,
        ruleValueIndex: 0,
        count: 3 + 1 + 1,
        die: 6,
        sources: [channelSource, ...featSources],
        increases: featSources.map((source) => ({ ...source, count: 1 })),
      },
    ]);
    expect(projection.dailyMaxima).toEqual([
      {
        entryId: channelRow,
        ruleValueIndex: 1,
        key: 'classFeat_channelEnergy',
        unit: 'uses',
        value: 3 + 2 + 2,
        sources: [channelSource, ...featSources],
      },
    ]);
    expect(
      projection.warnings.filter(({ check }) =>
        check.startsWith('ruleValueChoice'),
      ),
    ).toEqual([]);
  }
  expect(
    await t.run(async (ctx) => [
      await ctx.db.get('catalogEntry', ids.channel),
      await ctx.db.get('catalogEntry', ids.feat),
    ]),
  ).toEqual(stored);
});
