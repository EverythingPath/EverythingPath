// rotation-6 fix r3 (root, 2026-11-20: the choice gate is narrowed to what
// already saves a choice): an increase with `choice` adds only while its
// entry has a saved choice that matches an option. Whether the gate reads an
// entry's choice is decided at read time, by where the sheet recorded one
// before this slice: as text in the row's own editor (a feat, a trait, a
// class feature, a selected Archetype, a racial trait, a granted personal
// adjustment). Every other entry's choice is not read, whatever it saves (fix
// r4: the race saves a race equivalence or a weapon proficiency choice, a
// recorded personal adjustment a choice the Selection writer puts in its
// state; a class-skill trait a skill, a race equivalence control a Rule
// Identity, a racial ability choice an ability score; an item, a Spell
// Effect and a Condition no choice of their own, an item's abilities each
// one read only for the ability), so its increase is never counted, is listed
// on the number it would raise with that reason, and warns nothing.
// Nothing is refused when such an increase is written. Test fixtures only:
// no committed record carries `choice`.
import { expect, test } from 'vitest';
import {
  calculateCharacterSheet,
  type CharacterSheetCatalogEntry,
  type RuleValue,
  type SheetEntry,
} from './character-sheet';
import {
  baseClass,
  baseScores,
  classLevelSheet,
} from './character-sheet-rule-value-fixture';

const channel = 'classFeat_channelEnergy';
const increase: RuleValue = {
  kind: 'dailyMaximumIncrease',
  key: channel,
  amount: 2,
  choice: ['Cleric'],
};

const definition = (
  _id: string,
  detail: CharacterSheetCatalogEntry['detail'],
  fields: Partial<CharacterSheetCatalogEntry> & { name: string },
): CharacterSheetCatalogEntry => ({
  _id,
  ruleIdentity: `fixture/${_id}`,
  modifiers: [],
  detail,
  ruleValues: [increase],
  ...fields,
});

const channelEnergy: CharacterSheetCatalogEntry = {
  _id: 'channel-energy',
  ruleIdentity: 'pf1/kXXz1lO4i7CibHJ9',
  name: 'Channel Energy',
  modifiers: [],
  detail: { kind: 'classFeature' },
  ruleValues: [
    {
      kind: 'dailyMaximum',
      key: channel,
      unit: 'uses',
      amount: { formula: '3 + @ability.cha.mod' },
    },
  ],
};

function read(
  rows: SheetEntry[],
  definitions: CharacterSheetCatalogEntry[],
  granted: string[] = [],
) {
  const result = calculateCharacterSheet(
    classLevelSheet(['cleric'], rows, [
      baseScores(),
      baseClass('cleric', 'Cleric', [
        { classLevel: 1, catalogEntryId: 'channel-energy' },
        ...granted.map((catalogEntryId) => ({ classLevel: 1, catalogEntryId })),
      ]),
      channelEnergy,
      ...definitions,
    ]),
  );
  return {
    maxima: result.dailyMaxima.map(({ value, sources, notCounted }) => ({
      value,
      sources: sources.map(({ name }) => name),
      notCounted: notCounted?.map(({ name, reason }) => `${name}: ${reason}`),
    })),
    choiceWarnings: result.warnings
      .filter(({ check }) => check.startsWith('ruleValueChoice'))
      .map(({ subject }) => subject),
  };
}

const row = (
  kind: SheetEntry['kind'],
  catalogEntryId: string,
  state: Record<string, unknown> = {},
) =>
  ({
    _id: `${catalogEntryId}-row`,
    kind,
    active: true,
    catalogEntryId,
    state: { kind, ...state },
  }) as SheetEntry;

// Each saved choice below is the option itself, in the representation its
// own control saves, so only the kind decides.
const cannotRecord: [
  string,
  SheetEntry,
  CharacterSheetCatalogEntry,
  /** Its race, for a racial trait. */
  [SheetEntry, CharacterSheetCatalogEntry]?,
][] = [
  [
    'a recorded item',
    row('item', 'charm'),
    definition(
      'charm',
      { kind: 'item', consumable: false },
      { name: 'Channel charm' },
    ),
  ],
  [
    'a Spell Effect',
    row('spellEffect', 'effect', { casterLevel: 1 }),
    definition(
      'effect',
      {
        kind: 'spellEffect',
        lastsOverOneDay: true,
        defaultCasterLevel: 1,
      },
      { name: 'Channel effect' },
    ),
  ],
  [
    'a Condition',
    row('condition', 'condition'),
    definition(
      'condition',
      { kind: 'condition' },
      { name: 'Channel condition' },
    ),
  ],
  [
    'the race, whose race equivalence or weapon proficiency choice is not read',
    row('race', 'race', { choice: 'Cleric' }),
    definition(
      'race',
      { kind: 'race', racialTraits: [] },
      { name: 'Channel race' },
    ),
  ],
  [
    'a recorded personal adjustment, which has no choice control, its choice saved by the Selection writer',
    row('manual', 'adjustment', { choice: 'Cleric' }),
    definition(
      'adjustment',
      { kind: 'manual' },
      { name: 'Channel adjustment' },
    ),
  ],
  [
    'a class-skill trait, whose control saves a skill',
    row('trait', 'skill-trait', { choice: 'Stealth' }),
    definition(
      'skill-trait',
      { kind: 'trait', classSkillChoice: ['skill.ste', 'skill.per'] },
      {
        name: 'Channel trait',
        ruleValues: [{ ...increase, choice: ['Stealth', 'skill.ste'] }],
      },
    ),
  ],
  [
    'a racial trait whose control saves an ability score',
    {
      ...row('racialTrait', 'ability-trait', {
        choice: 'strength',
      }),
      grantKey: {
        source: 'fixture/ability-race',
        entry: 'fixture/ability-trait',
      },
    } as SheetEntry,
    definition(
      'ability-trait',
      { kind: 'racialTrait', raceEntryIds: ['ability-race'], replaces: [] },
      {
        name: 'Channel heritage',
        modifiers: [
          { target: 'ability.$choice', bonusType: 'racial', value: 2 },
        ],
        ruleValues: [{ ...increase, choice: ['strength'] }],
      },
    ),
    [
      row('race', 'ability-race'),
      definition(
        'ability-race',
        { kind: 'race', racialTraits: ['ability-trait'] },
        { name: 'Plain race', ruleValues: [] },
      ),
    ],
  ],
  [
    'a feat whose control saves a race equivalence',
    row('feat', 'heritage', { choice: 'pf1/elf' }),
    definition(
      'heritage',
      { kind: 'feat' },
      {
        name: 'Channel lineage',
        countsAsRaces: { oneOf: ['pf1/elf', 'pf1/dwarf'] },
        ruleValues: [{ ...increase, choice: ['pf1/elf'] }],
      },
    ),
  ],
];

test.each(cannotRecord.map(([label, ...rest]) => [label, rest] as const))(
  '%s: no choice it saves can affect an increase, so its increase is never counted, is listed with that reason and warns nothing',
  (_, [entry, catalogEntry, race]) => {
    expect(
      read(
        race ? [race[0], entry] : [entry],
        race ? [race[1], catalogEntry] : [catalogEntry],
      ),
    ).toEqual({
      maxima: [
        {
          value: 3,
          sources: ['Channel Energy'],
          notCounted: [`${catalogEntry.name}: choiceNotRead`],
        },
      ],
      choiceWarnings: [],
    });
  },
);

test('an entry whose choice is not read gives its ungated increase as before', () => {
  const charm = definition(
    'charm',
    { kind: 'item', consumable: false },
    {
      name: 'Channel charm',
      ruleValues: [{ kind: 'dailyMaximumIncrease', key: channel, amount: 2 }],
    },
  );
  expect(read([row('item', 'charm')], [charm])).toEqual({
    maxima: [
      {
        value: 5,
        sources: ['Channel Energy', 'Channel charm'],
        notCounted: undefined,
      },
    ],
    choiceWarnings: [],
  });
});

// The kinds that record a choice as text in their own row's editor: with no
// choice saved each is listed as having none and warns (the advisory); with
// the option saved, trimmed and in any case, each adds.
const canRecord = {
  feat: definition('feat', { kind: 'feat' }, { name: 'Channel feat' }),
  trait: definition('trait', { kind: 'trait' }, { name: 'Channel trait' }),
  racialTrait: definition(
    'racial',
    {
      kind: 'racialTrait',
      raceEntryIds: ['plain-race'],
      replaces: [],
    },
    { name: 'Channel heritage' },
  ),
  race: definition(
    'plain-race',
    { kind: 'race', racialTraits: ['racial'] },
    { name: 'Plain race', ruleValues: [] },
  ),
  classFeature: definition(
    'feature',
    {
      kind: 'classFeature',
    },
    { name: 'Channel feature' },
  ),
  manual: definition(
    'granted',
    { kind: 'manual' },
    { name: 'Channel adjustment' },
  ),
  archetype: definition(
    'archetype',
    { kind: 'archetype', classEntryIds: ['cleric'], replaces: [], adds: [] },
    { name: 'Channel path' },
  ),
};
const recordedRows = (choice?: string) => {
  const state = choice === undefined ? {} : { choice };
  const grant = (entry: string) => ({
    source: 'cleric',
    entry: `fixture/${entry}`,
    classLevel: 1,
  });
  return [
    row('feat', 'feat', state),
    row('trait', 'trait', state),
    row('archetype', 'archetype', { classEntryId: 'cleric', ...state }),
    row('race', 'plain-race'),
    {
      ...row('racialTrait', 'racial', state),
      grantKey: { source: 'fixture/plain-race', entry: 'fixture/racial' },
    } as SheetEntry,
    {
      ...row('classFeature', 'feature', state),
      grantKey: grant('feature'),
    } as SheetEntry,
    {
      ...row('manual', 'granted', state),
      grantKey: grant('granted'),
    } as SheetEntry,
  ];
};

test('a feat, a trait, a selected Archetype, a racial trait, a granted class feature and a granted personal adjustment with no choice saved are each listed as having none, and each warns', () => {
  const shown = read(recordedRows(), Object.values(canRecord), [
    'feature',
    'granted',
  ]);
  expect(shown.maxima).toEqual([
    {
      value: 3,
      sources: ['Channel Energy'],
      notCounted: [
        'Channel feat: noChoice',
        'Channel trait: noChoice',
        'Channel path: noChoice',
        'Channel heritage: noChoice',
        'Channel feature: noChoice',
        'Channel adjustment: noChoice',
      ],
    },
  ]);
  expect(shown.choiceWarnings).toHaveLength(6);
});

test('each of them adds once the option is saved: 3 + 6 × 2 = 15 uses', () => {
  expect(
    read(recordedRows(' cleric '), Object.values(canRecord), [
      'feature',
      'granted',
    ]).maxima,
  ).toEqual([
    {
      value: 15,
      sources: [
        'Channel Energy',
        'Channel feat',
        'Channel trait',
        'Channel path',
        'Channel heritage',
        'Channel feature',
        'Channel adjustment',
      ],
      notCounted: undefined,
    },
  ]);
});
