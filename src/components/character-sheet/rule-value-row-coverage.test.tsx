import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { FunctionReference } from 'convex/server';
import { beforeEach, expect, test, vi } from 'vitest';
import type { MigrationMaintenance } from '../use-initial-migration-maintenance';
import type { RuleValue, SheetEntry } from '../../lib/character-sheet';
import { characterSheetNames } from './character-sheet-api-test-fixture';
import { CharacterSheetBlocks } from './character-sheet-blocks-test-fixture';
import {
  buildSheet,
  calculateFixtureSheet,
  characterId,
  emptyOwnerCandidates,
  type CatalogSheetEntry,
} from './character-sheet-test-fixture';
import type { CharacterSheetSnapshot } from './use-character-sheet';

// rotation-6 fix r2 (both reviews, finding 1): every kind of sheet entry
// whose per-day maxima and dice the read gives (`calculated.dailyMaxima` and
// `calculated.featureNumbers`) shows them, with each increase not counted,
// on its own row in the block that holds it. `rowOwners` names, kind by
// kind, the block and row: a new kind of entry with a Catalog Entry fails to
// typecheck here until it names its row, and the read's every number must
// then be found on that row. Test fixtures only: no committed record gives
// these entries rule values.

let snapshot: CharacterSheetSnapshot | undefined;
let calls: { name: string; args: Record<string, unknown> }[] = [];
const maintenance = vi.fn<() => MigrationMaintenance>();
vi.mock('../use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => maintenance(),
}));
const nameOf = characterSheetNames();
vi.mock('convex/react', () => ({
  useQuery: (query: FunctionReference<'query'>) => {
    const name = nameOf(query);
    return name === 'read' ? snapshot : name === 'companions' ? [] : undefined;
  },
  usePaginatedQuery: () => emptyOwnerCandidates(),
  useMutation: (mutation: FunctionReference<'mutation'>) => {
    const name = nameOf(mutation);
    return (args: Record<string, unknown>) => {
      calls.push({ name, args });
      return new Promise(() => undefined);
    };
  },
}));
vi.mock(
  '../ui/select',
  () => import('../weekly-draft-workspace/native-select-test-double'),
);
beforeEach(() => {
  snapshot = undefined;
  calls = [];
  maintenance.mockReturnValue({ kind: 'ready', readOnly: false, message: '' });
});

type CatalogEntry = CharacterSheetSnapshot['catalogEntries'][number];
type Entry = CharacterSheetSnapshot['entries'][number];

/**
 * The kinds of sheet entry the read counts rule values for: each with a
 * Catalog Entry, except a Spell (`ruleValueContext` skips it) and the base
 * entry (its definition is written only with base scores).
 */
type CountedKind = Exclude<
  Extract<SheetEntry, { catalogEntryId: string }>['kind'],
  'spell' | 'base'
>;
type Block =
  | 'races'
  | 'archetypes'
  | 'grants'
  | 'selections'
  | 'adjustments'
  | 'entries';
/** Where each kind's row is: its block's heading and the row's role. */
const rowOwners = {
  race: {
    label: 'selected race',
    block: 'races',
    region: 'Race',
    role: 'group',
  },
  racialTrait: {
    label: 'racial trait',
    block: 'races',
    region: 'Race',
    role: 'listitem',
  },
  archetype: {
    label: 'selected Archetype',
    block: 'archetypes',
    region: 'Archetypes',
    role: 'listitem',
  },
  classFeature: {
    label: 'class feature',
    block: 'grants',
    region: 'Class features',
    role: 'listitem',
  },
  feat: {
    label: 'saved feat',
    block: 'selections',
    region: 'Feats & traits',
    role: 'listitem',
  },
  trait: {
    label: 'saved trait',
    block: 'selections',
    region: 'Feats & traits',
    role: 'listitem',
  },
  manual: {
    label: 'personal adjustment',
    block: 'adjustments',
    region: 'Personal adjustments',
    role: 'listitem',
  },
  item: {
    label: 'recorded item',
    block: 'entries',
    region: 'Sheet entries',
    role: 'listitem',
  },
  spellEffect: {
    label: 'Spell Effect',
    block: 'entries',
    region: 'Sheet entries',
    role: 'listitem',
  },
  condition: {
    label: 'Condition',
    block: 'entries',
    region: 'Sheet entries',
    role: 'listitem',
  },
} as const satisfies Record<
  CountedKind,
  { label: string; block: Block; region: string; role: 'group' | 'listitem' }
>;

const poolKey = 'fixture_pool';
const diceKey = 'fixture_dice';
/** A host's own maximum and dice: n per day and nd6, n its place below. */
const host = (n: number): RuleValue[] => [
  { kind: 'dailyMaximum', key: poolKey, unit: 'uses', amount: n },
  { kind: 'dice', die: 6, amount: n, key: diceKey },
];
const boosterName = 'Fixture booster';
const notCountedChip = `${boosterName} not counted: no choice recorded`;

const definition = (fields: {
  _id: string;
  name: string;
  detail: unknown;
  ruleValues: RuleValue[];
}) =>
  ({
    _creationTime: 7,
    scope: 'character',
    characterId,
    ruleIdentity: fields._id,
    stacksWithItself: false,
    sources: [],
    modifiers: [],
    ...fields,
  }) as unknown as CatalogEntry;
const recorded = (
  id: string,
  catalogEntryId: string,
  state: { kind: 'feat' | 'trait' | 'archetype' } & Record<string, unknown>,
) =>
  ({
    _id: id,
    _creationTime: 60,
    characterId,
    kind: state.kind,
    active: true,
    catalogEntryId,
    state,
  }) as unknown as Entry;
/** "Fixture item" and the like, with its own maximum and dice. */
const sheetEntry = (
  id: string,
  detail: CatalogSheetEntry['detail'],
  n: number,
): CatalogSheetEntry => ({
  id,
  name: `Fixture ${id}`,
  detail,
  modifiers: [],
  ruleValues: host(n),
});

const gatedKey = 'fixture_gated';
const gatedIncrease: RuleValue = {
  kind: 'dailyMaximumIncrease',
  key: gatedKey,
  amount: 1,
  choice: ['Pool'],
};
/** With `gated`: each choice kind's increase for a choice, and its pool. */
const gatedValues: Record<string, RuleValue> = {
  elf: gatedIncrease,
  'elf-keen-senses': gatedIncrease,
  'fixture-archetype': gatedIncrease,
  'fixture-feature': gatedIncrease,
  'fixture-feat': gatedIncrease,
  'fixture-trait': gatedIncrease,
  'adjustment-catalog': gatedIncrease,
  'item-catalog': {
    kind: 'dailyMaximum',
    key: gatedKey,
    unit: 'uses',
    amount: 1,
  },
};

/** The class feature's Grants with `gated` (fix r4): kinds the row's editor records a choice on. */
const gatedGrants = [
  ['granted-fixture-feat', 'Granted fixture feat', { kind: 'feat' }],
  ['granted-fixture-trait', 'Granted fixture trait', { kind: 'trait' }],
  [
    'granted-fixture-adjustment',
    'Granted fixture adjustment',
    { kind: 'manual' },
  ],
] as const;

/** Each choice kind's increase for a choice, and its pool (fix r2). */
function addGatedValues(catalogEntries: CatalogEntry[]) {
  for (const [index, entry] of catalogEntries.entries()) {
    const extra = gatedValues[entry._id];
    if (extra)
      catalogEntries[index] = {
        ...entry,
        ruleValues: [...(entry.ruleValues ?? []), extra],
        ...(entry._id === 'fixture-feature'
          ? {
              grants: gatedGrants.map(([catalogEntryId]) => ({
                catalogEntryId,
              })),
            }
          : {}),
      } as CatalogEntry;
  }
  for (const [_id, name, detail] of gatedGrants)
    catalogEntries.push(
      definition({ _id, name, detail, ruleValues: [gatedIncrease] }),
    );
}

/**
 * A Rogue 1 Elf with an entry of every counted kind, each with its own
 * maximum and dice, and a feat whose increases of both keys are for a choice
 * it has not saved, so each number lists it as not counted.
 */
function coverageSheet({
  gated = false,
  classSkillTrait = false,
  saved = [],
  extraCatalog = [],
}: {
  /** Each kind also has an increase for a choice (fix r2). */
  gated?: boolean;
  /** The trait's choice is a class skill of two (fix r3). */
  classSkillTrait?: boolean;
  /** Entries as a row's editor saved them, added to the sheet (fix r3). */
  saved?: Entry[];
  /** Definitions those entries need (fix r3). */
  extraCatalog?: CatalogEntry[];
} = {}): CharacterSheetSnapshot {
  const base = buildSheet({
    levels: [{ id: 'level-1', hp: 8, classId: 'rogue' }],
    race: { key: 'elf' },
    adjustments: [
      {
        id: 'adjustment',
        name: 'Fixture adjustment',
        modifiers: [],
        ruleValues: host(7),
      },
    ],
    sheetEntries: [
      sheetEntry('item', { kind: 'item', consumable: false }, 8),
      sheetEntry(
        'effect',
        { kind: 'spellEffect', lastsOverOneDay: true, defaultCasterLevel: 1 },
        9,
      ),
      sheetEntry('condition', { kind: 'condition' }, 10),
    ],
  });
  const withValues: Record<string, RuleValue[]> = {
    elf: host(1),
    'elf-keen-senses': host(2),
  };
  const catalogEntries = [
    ...base.catalogEntries.map((entry) => {
      if (entry._id === 'rogue' && entry.detail.kind === 'class')
        return {
          ...entry,
          detail: {
            ...entry.detail,
            featuresByLevel: [
              { classLevel: 1, catalogEntryId: 'fixture-feature' },
            ],
          },
        } as CatalogEntry;
      const ruleValues = withValues[entry._id];
      return ruleValues ? ({ ...entry, ruleValues } as CatalogEntry) : entry;
    }),
    definition({
      _id: 'fixture-archetype',
      name: 'Fixture archetype',
      detail: {
        kind: 'archetype',
        classEntryIds: ['rogue'],
        replaces: [],
        adds: [],
      },
      ruleValues: host(3),
    }),
    definition({
      _id: 'fixture-feature',
      name: 'Fixture feature',
      detail: { kind: 'classFeature' },
      ruleValues: host(4),
    }),
    definition({
      _id: 'fixture-feat',
      name: 'Fixture feat',
      detail: { kind: 'feat' },
      ruleValues: host(5),
    }),
    definition({
      _id: 'fixture-trait',
      name: 'Fixture trait',
      detail: classSkillTrait
        ? { kind: 'trait', classSkillChoice: ['skill.kge', 'skill.kna'] }
        : { kind: 'trait' },
      ruleValues: host(6),
    }),
    definition({
      _id: 'fixture-booster',
      name: boosterName,
      detail: { kind: 'feat' },
      ruleValues: [
        {
          kind: 'dailyMaximumIncrease',
          key: poolKey,
          amount: 1,
          choice: ['Pool'],
        },
        { kind: 'diceIncrease', key: diceKey, amount: 1, choice: ['Pool'] },
      ],
    }),
    ...extraCatalog,
  ];
  const entries = [
    ...base.entries,
    recorded('archetype-row', 'fixture-archetype', {
      kind: 'archetype',
      classEntryId: 'rogue',
    }),
    recorded('feat-row', 'fixture-feat', { kind: 'feat' }),
    recorded('trait-row', 'fixture-trait', { kind: 'trait' }),
    recorded('booster-row', 'fixture-booster', { kind: 'feat' }),
  ].filter((entry) => !saved.some(({ _id }) => _id === entry._id));
  entries.push(...saved);
  if (gated) addGatedValues(catalogEntries);
  const input = { entries, catalogEntries, characterKind: 'pc' as const };
  return {
    ...base,
    entries,
    catalogEntries,
    calculated: calculateFixtureSheet(input),
    permanentCalculated: calculateFixtureSheet(input, { permanentOnly: true }),
  };
}

const blocks = [
  ...new Set(Object.values(rowOwners).map(({ block }) => block)),
] satisfies Block[];

function kindOf(sheet: CharacterSheetSnapshot, entryId: string) {
  const resolved = sheet.calculated.resolvedEntries.find(
    ({ entry }) => entry._id === entryId,
  );
  if (!resolved) throw new Error(`No entry ${entryId}`);
  return resolved.entry.kind;
}
function nameOfEntry(sheet: CharacterSheetSnapshot, entryId: string) {
  const resolved = sheet.calculated.resolvedEntries.find(
    ({ entry }) => entry._id === entryId,
  );
  const catalogEntryId =
    resolved && 'catalogEntryId' in resolved.entry
      ? resolved.entry.catalogEntryId
      : undefined;
  const name = sheet.catalogEntries.find(
    ({ _id }) => _id === catalogEntryId,
  )?.name;
  if (!name) throw new Error(`No name for ${entryId}`);
  return name;
}
function rowOf(kind: string, name: string) {
  if (!(kind in rowOwners))
    throw new Error(`No row in the table shows a ${kind}'s numbers`);
  const { region, role } = rowOwners[kind as CountedKind];
  return within(
    within(screen.getByRole('region', { name: region })).getByRole(role, {
      name,
    }),
  );
}

test('the fixture gives every counted kind a maximum and dice, each listing the increase not counted', () => {
  const sheet = coverageSheet();
  const kinds = (ids: { entryId: string }[]) =>
    new Set(ids.map(({ entryId }) => kindOf(sheet, entryId)));
  expect(kinds(sheet.calculated.dailyMaxima)).toEqual(
    new Set(Object.keys(rowOwners)),
  );
  expect(kinds(sheet.calculated.featureNumbers)).toEqual(
    new Set(Object.keys(rowOwners)),
  );
  for (const number of [
    ...sheet.calculated.dailyMaxima,
    ...sheet.calculated.featureNumbers,
  ])
    expect(number.notCounted).toEqual([
      { entryId: 'booster-row', name: boosterName, reason: 'noChoice' },
    ]);
});

test('every maximum and dice the read gives is shown on its entry’s row, with the increase not counted beside each', () => {
  snapshot = coverageSheet();
  render(<CharacterSheetBlocks blocks={blocks} />);
  const sheet = snapshot;
  for (const maximum of sheet.calculated.dailyMaxima) {
    const row = rowOf(
      kindOf(sheet, maximum.entryId),
      nameOfEntry(sheet, maximum.entryId),
    );
    expect(row.getByText(`${maximum.value}/day`)).toBeVisible();
  }
  for (const number of sheet.calculated.featureNumbers) {
    const row = rowOf(
      kindOf(sheet, number.entryId),
      nameOfEntry(sheet, number.entryId),
    );
    expect(row.getByText(`${number.count}d${number.die}`)).toBeVisible();
    // One beside the maximum, one beside the dice.
    expect(row.getAllByText(notCountedChip)).toHaveLength(2);
  }
});

test.each(
  (Object.keys(rowOwners) as CountedKind[]).map(
    (kind) => [rowOwners[kind].label, kind] as const,
  ),
)('a %s’s row shows its own maximum, dice and not-counted lines', (_, kind) => {
  snapshot = coverageSheet();
  render(<CharacterSheetBlocks blocks={[rowOwners[kind].block]} />);
  const sheet = snapshot;
  const [maximum] = sheet.calculated.dailyMaxima.filter(
    ({ entryId }) => kindOf(sheet, entryId) === kind,
  );
  if (!maximum) throw new Error(`No ${kind} maximum`);
  const row = rowOf(kind, nameOfEntry(sheet, maximum.entryId));
  expect(row.getByText(`${maximum.value}/day`)).toBeVisible();
  expect(row.getByText(`${maximum.value}d6`)).toBeVisible();
  expect(row.getAllByText(notCountedChip)).toHaveLength(2);
});

test('a Spell’s rule values are never counted, so the read gives it no number to show', () => {
  const base = buildSheet({
    sheetEntries: [
      {
        id: 'spell',
        name: 'Fixture spell',
        detail: {
          kind: 'spell',
          level: 1,
          school: 'evocation',
          classLevels: [],
        } as unknown as CatalogSheetEntry['detail'],
        modifiers: [],
        ruleValues: host(1),
      },
    ],
  });
  expect(base.calculated.dailyMaxima).toEqual([]);
  expect(base.calculated.featureNumbers).toEqual([]);
});

// rotation-6 fix r3 (root, 2026-11-20: a choice is recorded only where the
// sheet recorded one before rotation-6): an entry whose row's own editor
// saves its choice as text shows the advisory on that row, naming the
// choice, and the choice its editor saves is the one the read counts,
// trimmed and in any case. Another entry's choice is not read (the race,
// whose Proficiencies editor can save a weapon proficiency choice, a
// recorded personal adjustment, an item, a Spell Effect, a Condition, and a
// class-skill trait, whose control saves a skill; fix r4: no such saved
// choice can affect the increase): its increase is never counted, shown
// beside the number it would raise, with no advisory and no field asking for
// a choice.
// rotation-6 fix r4 (Spec r4 finding 3): a granted feat, trait and
// personal adjustment too, each through its own grant row's editor, so every
// kind whose choice is read is recorded through an editor here.
type ChoiceCase =
  | 'racialTrait'
  | 'archetype'
  | 'classFeature'
  | 'feat'
  | 'trait'
  | 'grantedFeat'
  | 'grantedTrait'
  | 'grantedAdjustment';
const choiceRows = {
  racialTrait: {
    label: rowOwners.racialTrait.label,
    kind: 'racialTrait',
    name: 'Keen Senses',
    granted: true,
  },
  archetype: {
    label: rowOwners.archetype.label,
    kind: 'archetype',
    name: 'Fixture archetype',
    subject: 'Fixture archetype for Rogue',
    entryId: 'archetype-row',
  },
  classFeature: {
    label: rowOwners.classFeature.label,
    kind: 'classFeature',
    name: 'Fixture feature',
    granted: true,
  },
  feat: {
    label: rowOwners.feat.label,
    kind: 'feat',
    name: 'Fixture feat',
    entryId: 'feat-row',
  },
  trait: {
    label: rowOwners.trait.label,
    kind: 'trait',
    name: 'Fixture trait',
    entryId: 'trait-row',
  },
  grantedFeat: {
    label: 'granted feat',
    kind: 'feat',
    name: 'Granted fixture feat',
    granted: true,
    block: 'selections',
  },
  grantedTrait: {
    label: 'granted trait',
    kind: 'trait',
    name: 'Granted fixture trait',
    granted: true,
    block: 'selections',
  },
  grantedAdjustment: {
    label: 'granted personal adjustment',
    kind: 'manual',
    name: 'Granted fixture adjustment',
    granted: true,
    block: 'grants',
  },
} as const satisfies Record<
  ChoiceCase,
  {
    label: string;
    kind: CountedKind;
    name: string;
    subject?: string;
    /** Granted, so its state is written to its Grant. */
    granted?: true;
    /** A recorded entry's row, which the save edits. */
    entryId?: string;
    /** A granted row's block, when not its kind's recorded row's. */
    block?: Block;
  }
>;
/** The case's row: its kind's own, or, granted, any list item of its name. */
function choiceRowOf(choice: ChoiceCase) {
  const entry: { kind: CountedKind; name: string; block?: Block } =
    choiceRows[choice];
  return entry.block
    ? within(screen.getByRole('listitem', { name: entry.name }))
    : rowOf(entry.kind, entry.name);
}
const gatedPool = (sheet: CharacterSheetSnapshot) =>
  sheet.calculated.dailyMaxima.find(({ key }) => key === gatedKey);
/** The gated pool's value, the names that add to it and those not counted. */
function poolCounts(sheet: CharacterSheetSnapshot) {
  const pool = gatedPool(sheet);
  if (pool?.value == null) throw new Error('No gated pool');
  return {
    value: pool.value,
    adds: pool.sources.slice(1).map(({ name }) => name),
    notCounted: (pool.notCounted ?? []).map(({ name }) => name),
  };
}

/** The entry as its row's save wrote it: on its Grant, or on its row. */
function savedEntry(
  choice: ChoiceCase,
  sheet: CharacterSheetSnapshot,
  args: Record<string, unknown>,
): Entry {
  const entry: { kind: CountedKind; granted?: true; entryId?: string } =
    choiceRows[choice];
  const { kind } = entry;
  if (entry.granted) {
    const { grantKey, state } = args as {
      grantKey: Record<string, unknown>;
      state: { choice: string };
    };
    const granted = sheet.calculated.resolvedEntries.find(
      ({ entry: row }) =>
        'grantKey' in row &&
        JSON.stringify(row.grantKey) === JSON.stringify(grantKey),
    );
    if (!granted || !('catalogEntryId' in granted.entry))
      throw new Error(`No Grant for ${kind}`);
    return {
      _id: `${kind}-saved`,
      _creationTime: 61,
      characterId,
      kind,
      active: true,
      catalogEntryId: granted.entry.catalogEntryId,
      grantKey,
      state: { kind, choice: state.choice },
    } as unknown as Entry;
  }
  const stored = sheet.entries.find(({ _id }) => _id === entry.entryId);
  if (!stored || !('state' in stored)) throw new Error(`No row for ${kind}`);
  return {
    ...stored,
    state: { ...stored.state, choice: args.choice },
  } as unknown as Entry;
}

test.each(
  (Object.keys(choiceRows) as ChoiceCase[]).map(
    (choice) => [choiceRows[choice].label, choice] as const,
  ),
)(
  'a %s whose increase is for a choice shows the advisory on its row, and the choice its own editor saves is the one the read counts',
  async (_, choice) => {
    const sheet = coverageSheet({ gated: true });
    snapshot = sheet;
    const entry: {
      kind: CountedKind;
      name: string;
      subject?: string;
      block?: Block;
    } = choiceRows[choice];
    render(
      <CharacterSheetBlocks
        blocks={[entry.block ?? rowOwners[entry.kind].block]}
      />,
    );
    const { name } = entry;
    const subject = entry.subject ?? name;
    const row = choiceRowOf(choice);
    expect(
      row.getByText(
        `${name}’s increase is not counted until its choice is recorded; it is for the choice Pool.`,
      ),
    ).toBeVisible();
    fireEvent.click(row.getByRole('button', { name: `Edit ${subject}` }));
    fireEvent.change(
      row.getByRole('textbox', { name: `Choice for ${subject}` }),
      { target: { value: ' pool ' } },
    );
    fireEvent.click(row.getByRole('button', { name: `Save ${subject}` }));
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    const before = poolCounts(sheet);
    const after = poolCounts(
      coverageSheet({
        gated: true,
        saved: [savedEntry(choice, sheet, calls.at(-1)?.args ?? {})],
      }),
    );
    expect(before.adds).not.toContain(name);
    expect(after).toEqual({
      value: before.value + 1,
      adds: [...before.adds, name],
      notCounted: before.notCounted.filter((other) => other !== name),
    });
  },
);

test('the race’s and a recorded personal adjustment’s choice cannot affect an increase: their increases are shown as never counted beside the pool, with no advisory and no field asking for a choice', () => {
  snapshot = coverageSheet({ gated: true });
  render(<CharacterSheetBlocks blocks={['races', 'adjustments', 'entries']} />);
  const pool = rowOf('item', 'Fixture item');
  for (const name of ['Elf', 'Fixture adjustment']) {
    expect(
      pool.getByText(
        `${name} never counted: its choice can’t affect this increase`,
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole('combobox', { name: `Choice for ${name}` }),
    ).toBeNull();
    expect(
      screen.queryByRole('textbox', { name: `Choice for ${name}` }),
    ).toBeNull();
    expect(screen.queryByText(new RegExp(`^${name}’s increase`))).toBeNull();
  }
});

test('a class-skill trait records its class skill through its own control, and its increase is never counted, whatever it is for', async () => {
  const sheet = coverageSheet({ gated: true, classSkillTrait: true });
  snapshot = sheet;
  render(<CharacterSheetBlocks blocks={['selections']} />);
  const row = rowOf('trait', 'Fixture trait');
  expect(row.queryByText(/Fixture trait’s increase/)).toBeNull();
  fireEvent.click(row.getByRole('button', { name: 'Edit Fixture trait' }));
  fireEvent.click(row.getByRole('radio', { name: 'Knowledge (nature)' }));
  fireEvent.click(row.getByRole('button', { name: 'Save Fixture trait' }));
  await waitFor(() =>
    expect(calls.at(-1)?.args).toMatchObject({ choice: 'Knowledge (nature)' }),
  );
  const after = gatedPool(
    coverageSheet({
      gated: true,
      classSkillTrait: true,
      saved: [savedEntry('trait', sheet, calls.at(-1)?.args ?? {})],
    }),
  );
  expect(after?.notCounted).toContainEqual({
    entryId: 'trait-row',
    name: 'Fixture trait',
    reason: 'choiceNotRead',
  });
});

// rotation-6 fix r3 (both reviews of round 3): creating a one-off race while
// a race is selected leaves two active races (the writer's behaviour before
// rotation-6, `convex/characterSheetTwoRaces.integration.test.ts`); the read
// gives both races' numbers, so the Race panel shows every active race's,
// each under its own name.
test('with two active races the Race panel shows each one’s maximum, dice and not-counted lines under its own name', () => {
  snapshot = coverageSheet({
    extraCatalog: [
      definition({
        _id: 'fixture-race',
        name: 'Fixture race',
        detail: { kind: 'race', racialTraits: [] },
        ruleValues: host(11),
      }),
    ],
    saved: [
      {
        _id: 'second-race-row',
        _creationTime: 62,
        characterId,
        kind: 'race',
        active: true,
        catalogEntryId: 'fixture-race',
        state: { kind: 'race' },
      } as unknown as Entry,
    ],
  });
  render(<CharacterSheetBlocks blocks={['races']} />);
  for (const [name, n] of [
    ['Elf', 1],
    ['Fixture race', 11],
  ] as const) {
    const race = rowOf('race', name);
    expect(race.getByText(`${n}/day`)).toBeVisible();
    expect(race.getByText(`${n}d6`)).toBeVisible();
    expect(race.getAllByText(notCountedChip)).toHaveLength(2);
  }
});
