// rotation-7 (PRD #251; ORCH research favored-class-rewards.md, option A):
// a Class Level's favored class bonus may be a reward from the reviewed list
// (`src/lib/catalog/data/reviewed-favored-class-rewards.json`), stored by its
// id, and a formula reads how many levels chose it and count as
// `@favoredClassReward.<id>`. The fixtures have the imported shape: Foundry
// classes/bard.6GjOjO6r3R06fLwE, alchemist.JcaqlAawhf14q1lq and
// sorcerer.AoWSbnuTSGIxmv61, races/gnome.efwHEwjvL9Z94MJI and
// human.e6IaBxKgMxy1yKlr; the per-day maxima are fixtures of two records'
// shape in scripts/catalog/reviewed-curation.json: Bardic Performance
// pf1/ZfCUTi1MiLgR4T7I, whose checked record reads the count since
// reward-terms-1 (the fixture is its shape, not the record), and Bomb
// pf1/7gHiZBNHjwefbBLI, a held drafted record, with the count's term added,
// which that record does not have. The rewards are PCGen
// roleplaying_game/advanced_players_guide/apg_abilities_race.lst:142 ("Add 1
// to the bard's total number of bardic performance rounds per day", Gnome or
// Half-Elf) and :148 ("Add +1/2 to the number of bombs per day", Gnome).
import { expect, test } from 'vitest';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  calculateCharacterSheetProjections,
  type AbilityScores,
  type CharacterSheetCatalogEntry,
  type FavoredClassBonus,
  type SheetEntry,
} from './character-sheet';
import {
  favoredClassRewardsFitting,
  reviewedFavoredClassRewards,
} from './character-sheet-favored-class-rewards';

const classEntry = ({
  id,
  ruleIdentity,
  name,
  features = [],
  counterpartOf,
}: {
  id: string;
  ruleIdentity: string;
  name: string;
  features?: string[];
  /** An Unchained Class's original. */
  counterpartOf?: string;
}): CharacterSheetCatalogEntry => ({
  _id: id,
  ruleIdentity,
  name,
  modifiers: [],
  detail: {
    kind: 'class',
    classKind: 'base',
    tag: id,
    ...(counterpartOf ? { counterpartOf } : {}),
    hitDie: 8,
    bab: 'threeQuarters',
    saves: { fort: 'poor', ref: 'good', will: 'good' },
    skillRanksPerLevel: 6,
    featuresByLevel: features.map((catalogEntryId) => ({
      classLevel: 1,
      catalogEntryId,
    })),
  },
});

const feature = ({
  id,
  ruleIdentity,
  name,
  key,
  formula,
}: {
  id: string;
  ruleIdentity: string;
  name: string;
  key: string;
  formula: string;
}): CharacterSheetCatalogEntry => ({
  _id: id,
  // Fix r2: a catalog definition, whose rule values read the count.
  scope: 'global',
  ruleIdentity,
  name,
  modifiers: [],
  detail: { kind: 'classFeature' },
  ruleValues: [
    { kind: 'dailyMaximum', key, unit: 'rounds', amount: { formula } },
  ],
});

const race = (id: string, ruleIdentity: string, name: string) =>
  ({
    _id: id,
    ruleIdentity,
    name,
    modifiers: [],
    detail: { kind: 'race', racialTraits: [], racialHitDice: 0 },
  }) satisfies CharacterSheetCatalogEntry;

const gnome = race('gnome', 'pf1/efwHEwjvL9Z94MJI', 'Gnome');
const human = race('human', 'pf1/e6IaBxKgMxy1yKlr', 'Human');

/**
 * Fix r1: a race whose standard racial trait counts it as other races, as
 * the imported Half-Elf's Elf Blood (pf1-content/rzYk40R1rWSfay4a: Elf
 * pf1/NgIhxRI0axrf3fcO and Human) and the Half-Orc's Orc Blood
 * (pf1-content/JWzMBJeAQYDav9gw: Orc pf1/JOuAdPAOTat7d5v6 and Human) do
 * (docs/catalog-import/racial-traits-403.md).
 */
function raceWithBlood({
  id,
  ruleIdentity,
  name,
  blood,
}: {
  id: string;
  ruleIdentity: string;
  name: string;
  blood: { id: string; ruleIdentity: string; countsAsRaces: string[] };
}) {
  return [
    {
      ...race(id, ruleIdentity, name),
      detail: { kind: 'race', racialTraits: [blood.id], racialHitDice: 0 },
    },
    {
      _id: blood.id,
      ruleIdentity: blood.ruleIdentity,
      modifiers: [],
      countsAsRaces: blood.countsAsRaces,
      detail: { kind: 'racialTrait', raceEntryIds: [id], replaces: [] },
    },
  ] as const satisfies readonly CharacterSheetCatalogEntry[];
}
const [halfElf, elfBlood] = raceWithBlood({
  id: 'half-elf',
  ruleIdentity: 'pf1/cCepRrfH5SalFfT4',
  name: 'Half-Elf',
  blood: {
    id: 'elf-blood',
    ruleIdentity: 'pf1-content/rzYk40R1rWSfay4a',
    countsAsRaces: ['pf1/NgIhxRI0axrf3fcO', 'pf1/e6IaBxKgMxy1yKlr'],
  },
});
const [halfOrc, orcBlood] = raceWithBlood({
  id: 'half-orc',
  ruleIdentity: 'pf1/dCAXgdA6Db1Z3ccz',
  name: 'Half-Orc',
  blood: {
    id: 'orc-blood',
    ruleIdentity: 'pf1-content/JWzMBJeAQYDav9gw',
    countsAsRaces: ['pf1/JOuAdPAOTat7d5v6', 'pf1/e6IaBxKgMxy1yKlr'],
  },
});

const catalog: CharacterSheetCatalogEntry[] = [
  classEntry({
    id: 'bard',
    ruleIdentity: 'pf1/6GjOjO6r3R06fLwE',
    name: 'Bard',
    features: ['performance'],
  }),
  feature({
    id: 'performance',
    ruleIdentity: 'pf1/ZfCUTi1MiLgR4T7I',
    name: 'Bardic Performance',
    key: 'classFeat_bardicPerformance',
    formula:
      '4 + @ability.cha.mod + 2 * (@classLevel.bard - 1) + @favoredClassReward.bardicPerformanceRound',
  }),
  classEntry({
    id: 'alchemist',
    ruleIdentity: 'pf1/JcaqlAawhf14q1lq',
    name: 'Alchemist',
    features: ['bomb'],
  }),
  feature({
    id: 'bomb',
    ruleIdentity: 'pf1/7gHiZBNHjwefbBLI',
    name: 'Bomb',
    key: 'classFeat_bomb',
    formula:
      'max(0, @classLevel.alchemist + @ability.int.mod) + floor(@favoredClassReward.bomb / 2)',
  }),
  classEntry({
    id: 'sorcerer',
    ruleIdentity: 'pf1/AoWSbnuTSGIxmv61',
    name: 'Sorcerer',
  }),
  classEntry({
    id: 'monk',
    ruleIdentity: 'pf1/W8dxwZ1CZiwLKsqr',
    name: 'Monk',
    features: ['stunning-fist', 'ki-pool'],
  }),
  classEntry({
    id: 'monk-unchained',
    ruleIdentity: 'pf1/5mQIOIw4hDhlREPo',
    name: 'Monk (Unchained)',
    features: ['stunning-fist'],
    counterpartOf: 'monk',
  }),
  feature({
    id: 'stunning-fist',
    ruleIdentity: 'fixture/stunning-fist',
    name: 'Stunning Fist',
    key: 'classFeat_stunningFist',
    formula: '1 + floor(@favoredClassReward.stunningFist / 2)',
  }),
  // Fix r1: a fixture ki pool of 1 point plus the Human reward's
  // quarter points, and a fixture rage of the held record's shape (Rage
  // pf1/WSqWT9ZIshtC5vlV) with the Dwarf and Half-Orc reward's round.
  feature({
    id: 'ki-pool',
    ruleIdentity: 'fixture/ki-pool',
    name: 'Ki Pool',
    key: 'classFeat_kiPool',
    formula: '1 + floor(@favoredClassReward.kiPoint / 4)',
  }),
  classEntry({
    id: 'barbarian',
    ruleIdentity: 'pf1/g3pq7xWWdUVYw6ai',
    name: 'Barbarian',
    features: ['rage'],
  }),
  feature({
    id: 'rage',
    ruleIdentity: 'pf1/WSqWT9ZIshtC5vlV',
    name: 'Rage',
    key: 'classFeat_rage',
    formula:
      '4 + @ability.con.mod + 2 * (@classLevel.barbarian - 1) + @favoredClassReward.rageRound',
  }),
  race('halfling', 'pf1/Hf31mrYb3uucNyLO', 'Halfling'),
  race('dwarf', 'pf1/nEltI9y37rKJTeWo', 'Dwarf'),
  gnome,
  human,
  halfElf,
  elfBlood,
  halfOrc,
  orcBlood,
];

type Level = [classEntryId: string | null, bonus: FavoredClassBonus | null];

function sheet({
  levels,
  races = [gnome],
  favoredClassIds = ['bard'],
  scores = { charisma: 18 },
}: {
  levels: Level[];
  races?: CharacterSheetCatalogEntry[];
  favoredClassIds?: string[];
  scores?: Partial<AbilityScores>;
}) {
  const entries: SheetEntry[] = [
    {
      _id: 'base-row',
      kind: 'base',
      active: true,
      catalogEntryId: 'base',
      state: { kind: 'base', favoredClassIds },
    },
    ...races.map(
      (definition): SheetEntry => ({
        _id: `${definition._id}-row`,
        kind: 'race',
        active: true,
        catalogEntryId: definition._id,
        state: { kind: 'race' },
      }),
    ),
    ...levels.map(
      ([classEntryId, favoredClassBonus], index): SheetEntry => ({
        _id: `level-${index + 1}`,
        kind: 'classLevel',
        active: true,
        state: {
          kind: 'classLevel',
          position: index + 1,
          classEntryId,
          hpGained: 5,
          favoredClassBonus,
        },
      }),
    ),
  ];
  return {
    characterKind: 'pc' as const,
    entries,
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: abilityKeys.map((key) => ({
          target: abilityTargets[key],
          bonusType: 'base' as const,
          value: scores[key] ?? 10,
        })),
      },
      ...catalog,
    ],
  };
}

const reward = (id: string) =>
  ({ choice: 'reward', reward: id }) as const satisfies FavoredClassBonus;
const rounds = reward('bardicPerformanceRound');

function maximum(input: ReturnType<typeof sheet>, key: string) {
  return calculateCharacterSheet(input).dailyMaxima.find(
    (row) => row.key === key,
  )?.value;
}

function notCounted(input: ReturnType<typeof sheet>) {
  return calculateCharacterSheet(input).warnings.filter(
    (warning) => warning.check === 'favoredClassRewardNotCounted',
  );
}

test('a listed reward is the level’s favored class bonus: a favored Bard level with it needs no other, and gains no hit point or skill rank', () => {
  const none = calculateCharacterSheet(sheet({ levels: [['bard', null]] }));
  const chosen = calculateCharacterSheet(sheet({ levels: [['bard', rounds]] }));
  expect(none.warnings.map((warning) => warning.check)).toContain(
    'favoredClassBonusMissing',
  );
  expect(chosen.warnings.map((warning) => warning.check)).not.toContain(
    'favoredClassBonusMissing',
  );
  expect(chosen.hp).toBe(none.hp);
  expect(chosen.hp).toBe(5);
  expect(chosen.classLevels[0]?.skillRankBudget).toBe(
    none.classLevels[0]?.skillRankBudget,
  );
  expect(chosen.classLevels[0]?.skillRankBudget).toBe(6);
});

test('a stored reward names its id and nothing else: the illegal shapes do not type-check', () => {
  const shapes: FavoredClassBonus[] = [
    rounds,
    // @ts-expect-error a reward needs its id
    { choice: 'reward' },
    // @ts-expect-error a reward is not a note
    { choice: 'reward', note: 'Extra round' },
    // @ts-expect-error a hit point names no reward
    { choice: 'hp', reward: 'bardicPerformanceRound' },
  ];
  expect(shapes).toHaveLength(4);
});

test('a Gnome Bard counts each favored level that chose the round: Charisma 18, Bard 1 with one, 9 rounds; Bard 3 with one or three, 13 or 15', () => {
  const key = 'classFeat_bardicPerformance';
  expect(maximum(sheet({ levels: [['bard', null]] }), key)).toBe(8);
  expect(maximum(sheet({ levels: [['bard', rounds]] }), key)).toBe(9);
  expect(
    maximum(
      sheet({
        levels: [
          ['bard', rounds],
          ['bard', { choice: 'hp' }],
          ['bard', { choice: 'skill' }],
        ],
      }),
      key,
    ),
  ).toBe(13);
  const three = sheet({
    levels: [
      ['bard', rounds],
      ['bard', rounds],
      ['bard', rounds],
    ],
  });
  expect(maximum(three, key)).toBe(15);
  expect(notCounted(three)).toEqual([]);
  expect(
    calculateCharacterSheetProjections(three).permanent.dailyMaxima.find(
      (row) => row.key === key,
    )?.value,
  ).toBe(15);
});

test('a Human Bard who chose the round counts none, and each such level warns why in plain words', () => {
  const input = sheet({
    races: [human],
    levels: [
      ['bard', rounds],
      ['bard', rounds],
    ],
  });
  expect(maximum(input, 'classFeat_bardicPerformance')).toBe(10);
  expect(notCounted(input)).toEqual([
    {
      kind: 'rules',
      check: 'favoredClassRewardNotCounted',
      subject: 'level-1',
      target: {
        kind: 'classLevel',
        entryId: 'level-1',
        field: 'favoredClassBonus',
      },
      message:
        'Level 1: +1 round of bardic performance per day isn’t counted: your race isn’t Gnome or Half-Elf.',
      fingerprint: JSON.stringify([
        'bardicPerformanceRound',
        ['race'],
        ['pf1/6GjOjO6r3R06fLwE'],
        true,
        ['pf1/e6IaBxKgMxy1yKlr'],
      ]),
    },
    expect.objectContaining({
      subject: 'level-2',
      message:
        'Level 2: +1 round of bardic performance per day isn’t counted: your race isn’t Gnome or Half-Elf.',
    }),
  ]);
});

test('a multiclass Gnome counts the round only at its Bard levels: the Sorcerer levels that chose it add none and warn', () => {
  const input = sheet({
    levels: [
      ['bard', rounds],
      ['sorcerer', rounds],
      ['sorcerer', rounds],
    ],
  });
  expect(maximum(input, 'classFeat_bardicPerformance')).toBe(9);
  expect(notCounted(input).map((warning) => warning.message)).toEqual([
    'Level 2: +1 round of bardic performance per day isn’t counted: this level’s class isn’t Bard and isn’t one of your favored classes.',
    'Level 3: +1 round of bardic performance per day isn’t counted: this level’s class isn’t Bard and isn’t one of your favored classes.',
  ]);
});

test('a Gnome Bard whose Bard is not a favored class counts none, and warns', () => {
  const input = sheet({ favoredClassIds: [], levels: [['bard', rounds]] });
  expect(maximum(input, 'classFeat_bardicPerformance')).toBe(8);
  expect(notCounted(input).map((warning) => warning.message)).toEqual([
    'Level 1: +1 round of bardic performance per day isn’t counted: this level’s class isn’t one of your favored classes.',
  ]);
});

test('a half reward counts whole selections and the formula floors them: a Gnome Alchemist 3 with 1, 2 or 3 bombs chosen has 3, 4 or 4 bombs', () => {
  const bomb = reward('bomb');
  const counts = [1, 2, 3].map((selections) =>
    maximum(
      sheet({
        favoredClassIds: ['alchemist'],
        scores: {},
        levels: [0, 1, 2].map(
          (index): Level => [
            'alchemist',
            index < selections ? bomb : { choice: 'hp' },
          ],
        ),
      }),
      'classFeat_bomb',
    ),
  );
  expect(counts).toEqual([3, 4, 4]);
});

test('a reward id the list no longer holds counts none and warns; a formula naming an unlisted reward is unresolved', () => {
  const input = sheet({ levels: [['bard', reward('retiredReward')]] });
  expect(maximum(input, 'classFeat_bardicPerformance')).toBe(8);
  expect(notCounted(input).map((warning) => warning.message)).toEqual([
    'Level 1: this favored class reward isn’t counted: the sheet no longer lists it.',
  ]);
  const unlisted = sheet({ levels: [['bard', rounds]] });
  unlisted.catalogEntries = unlisted.catalogEntries.map((entry) =>
    entry._id === 'performance'
      ? {
          ...entry,
          ruleValues: [
            {
              kind: 'dailyMaximum',
              key: 'classFeat_bardicPerformance',
              unit: 'rounds',
              amount: { formula: '4 + @favoredClassReward.notListed' },
            },
          ],
        }
      : entry,
  );
  expect(maximum(unlisted, 'classFeat_bardicPerformance')).toBeNull();
});

test('the rewards that fit a level are those of its class for one of the character’s races', () => {
  const ids = (classIdentity: string, raceIdentities: string[]) =>
    favoredClassRewardsFitting({
      classIdentities: [classIdentity],
      raceIdentities,
    }).map((row) => row.id);
  expect(ids('pf1/6GjOjO6r3R06fLwE', ['pf1/efwHEwjvL9Z94MJI'])).toEqual([
    'bardicPerformanceRound',
  ]);
  expect(ids('pf1/6GjOjO6r3R06fLwE', ['pf1/e6IaBxKgMxy1yKlr'])).toEqual([]);
  expect(ids('pf1/JcaqlAawhf14q1lq', ['gnome'])).toEqual(['bomb']);
  expect(ids('pf1/W8dxwZ1CZiwLKsqr', ['pf1/e6IaBxKgMxy1yKlr'])).toEqual([
    'kiPoint',
  ]);
  // reward-target: five untargeted rewards and the two domain rewards.
  expect(reviewedFavoredClassRewards.rewards).toHaveLength(7);
});

test('an Unchained Monk level counts as the Monk’s for its favored class options, as for the favored class: a Halfling with two of them choosing Stunning Fist gains one attempt', () => {
  const halfling = catalog.find((entry) => entry._id === 'halfling');
  if (!halfling) throw new Error('Missing fixture');
  const fist = reward('stunningFist');
  const input = sheet({
    races: [halfling],
    favoredClassIds: ['monk'],
    levels: [
      ['monk-unchained', fist],
      ['monk-unchained', fist],
    ],
  });
  expect(maximum(input, 'classFeat_stunningFist')).toBe(2);
  expect(notCounted(input)).toEqual([]);
  expect(
    favoredClassRewardsFitting({
      classIdentities: ['pf1/W8dxwZ1CZiwLKsqr'],
      raceIdentities: ['pf1/Hf31mrYb3uucNyLO'],
    }).map((row) => row.id),
  ).toEqual(['stunningFist']);
});

// Fix r1: a reward's race is matched against what the character counts as
// (`resolveCharacterSheetRacialFacts(...).countsAsRaces`: the active race's
// identity and every counting entry's stored `countsAsRaces`), so a Half-Elf
// or a Half-Orc may take a Human reward (the Advanced Player's Guide FAQ,
// research decision in issue #225).
test('a Half-Elf Monk counts the Human ki reward, as Elf Blood counts it as a Human: four selections at 1/4 point each give floor(4 / 4) = 1 point, a fixture pool of 1 + 1 = 2', () => {
  const ki = reward('kiPoint');
  const input = sheet({
    races: [halfElf],
    favoredClassIds: ['monk'],
    levels: [
      ['monk', ki],
      ['monk', ki],
      ['monk', ki],
      ['monk', ki],
    ],
  });
  expect(calculateCharacterSheet(input).racial.countsAsRaces).toContain(
    human.ruleIdentity,
  );
  expect(maximum(input, 'classFeat_kiPool')).toBe(2);
  expect(notCounted(input)).toEqual([]);
  const three = sheet({
    races: [halfElf],
    favoredClassIds: ['monk'],
    levels: [
      ['monk', ki],
      ['monk', ki],
      ['monk', ki],
      ['monk', { choice: 'hp' }],
    ],
  });
  expect(maximum(three, 'classFeat_kiPool')).toBe(1);
});

test('a Half-Orc Barbarian counts the Dwarf and Half-Orc rage round: Constitution 10, Barbarian 2 with two, 4 + 2 + 2 = 8 rounds; a Half-Orc Monk counts the Human ki reward through Orc Blood', () => {
  const input = sheet({
    races: [halfOrc],
    favoredClassIds: ['barbarian'],
    scores: {},
    levels: [
      ['barbarian', reward('rageRound')],
      ['barbarian', reward('rageRound')],
    ],
  });
  expect(maximum(input, 'classFeat_rage')).toBe(8);
  expect(notCounted(input)).toEqual([]);
  const monk = sheet({
    races: [halfOrc],
    favoredClassIds: ['monk'],
    levels: Array.from({ length: 4 }, (): Level => ['monk', reward('kiPoint')]),
  });
  expect(maximum(monk, 'classFeat_kiPool')).toBe(2);
  expect(notCounted(monk)).toEqual([]);
});

test('a Human Alchemist who chose the Gnome bomb counts none and warns; a Half-Elf, counted as a Human and an Elf, counts none either', () => {
  for (const races of [[human], [halfElf]]) {
    const input = sheet({
      races,
      favoredClassIds: ['alchemist'],
      scores: {},
      levels: [['alchemist', reward('bomb')]],
    });
    expect(maximum(input, 'classFeat_bomb')).toBe(1);
    expect(notCounted(input).map((warning) => warning.message)).toEqual([
      'Level 1: +1/2 bomb per day isn’t counted: your race isn’t Gnome.',
    ]);
  }
});

// Fix r1: an accepted warning is keyed by its fingerprint, so it reopens
// when a fact that decides it changes (docs/character-sheet/rules-checks.md,
// "Accepted Warnings").
test('the not-counted warning’s fingerprint holds the races, the class and whether it is favored: a Human Bard turned Dwarf reopens it, a changed Charisma or another level does not', () => {
  const fingerprint = (input: ReturnType<typeof sheet>) =>
    notCounted(input).find((warning) => warning.subject === 'level-1')
      ?.fingerprint;
  const humanBard = fingerprint(
    sheet({ races: [human], levels: [['bard', rounds]] }),
  );
  expect(humanBard).toBeDefined();
  const dwarf = catalog.find((entry) => entry._id === 'dwarf');
  if (!dwarf) throw new Error('Missing fixture');
  expect(
    fingerprint(sheet({ races: [dwarf], levels: [['bard', rounds]] })),
  ).not.toBe(humanBard);
  expect(
    fingerprint(
      sheet({
        races: [human],
        levels: [['bard', rounds]],
        favoredClassIds: ['sorcerer'],
      }),
    ),
  ).not.toBe(humanBard);
  expect(
    fingerprint(
      sheet({
        races: [human],
        scores: { charisma: 12 },
        levels: [
          ['bard', rounds],
          ['bard', { choice: 'hp' }],
        ],
      }),
    ),
  ).toBe(humanBard);
});

// Fix r1 (root, 2026-11-22): the count is read only where a reviewed rule
// value's formula is evaluated. A formula a player types (a Personal
// Adjustment's or any Modifier's, and a one-off's rule value) reads it as
// before the count existed: an unsupported variable, its warning and no
// number. Fix r2: by the definition's provenance, a catalog definition's
// rule values only; every stored shape a writer gives is in
// character-sheet-favored-class-reward-provenance.test.ts.
function withOwn(
  input: ReturnType<typeof sheet>,
  definition: Omit<CharacterSheetCatalogEntry, '_id' | 'detail'>,
) {
  input.entries.push({
    _id: 'own-row',
    kind: 'manual',
    active: true,
    catalogEntryId: 'own',
    state: { kind: 'manual' },
  });
  input.catalogEntries.push({
    _id: 'own',
    scope: 'character',
    ...definition,
    detail: { kind: 'manual' },
  });
  return input;
}

test('a Personal Adjustment’s initiative formula 2 + @favoredClassReward.bomb gives 0 with its warning, as before the count existed, a bomb chosen or not', () => {
  for (const bonus of [null, reward('bomb')]) {
    const input = withOwn(
      sheet({
        favoredClassIds: ['alchemist'],
        scores: {},
        levels: [['alchemist', bonus]],
      }),
      {
        ruleIdentity: 'manual:own',
        name: 'Quick reflexes',
        modifiers: [
          {
            target: 'init',
            bonusType: 'untyped',
            value: { formula: '2 + @favoredClassReward.bomb' },
          },
        ],
      },
    );
    const result = calculateCharacterSheet(input);
    expect(result.breakdowns.init.total).toBe(0);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        check: 'unsupportedFormula',
        message:
          'This Modifier contributes nothing. @favoredClassReward.bomb is not a supported variable.',
      }),
    );
  }
});

test('a one-off’s per-day maximum naming the count gives no number and warns, as before; the fixture rule value of the same formula reads it', () => {
  const formula = '4 + @favoredClassReward.bardicPerformanceRound';
  const input = withOwn(sheet({ levels: [['bard', rounds]] }), {
    ruleIdentity: 'one-off:own',
    name: 'Homebrew song',
    modifiers: [],
    ruleValues: [
      {
        kind: 'dailyMaximum',
        key: 'homebrew_song',
        unit: 'rounds',
        amount: { formula },
      },
    ],
  });
  expect(maximum(input, 'homebrew_song')).toBeNull();
  expect(calculateCharacterSheet(input).warnings).toContainEqual(
    expect.objectContaining({
      subject: 'own-row:ruleValue:0',
      message:
        'This rule value gives no number. @favoredClassReward.bardicPerformanceRound is not a supported variable.',
    }),
  );
  expect(maximum(input, 'classFeat_bardicPerformance')).toBe(9);
});

test('a catalog Modifier naming the count is unsupported too: the count is no Modifier variable', () => {
  const input = withOwn(sheet({ levels: [['bard', rounds]] }), {
    scope: 'global',
    ruleIdentity: 'fixture/performer',
    name: 'Performer',
    modifiers: [
      {
        target: 'skill.prf',
        bonusType: 'untyped',
        value: { formula: '@favoredClassReward.bardicPerformanceRound' },
      },
    ],
  });
  expect(calculateCharacterSheet(input).warnings).toContainEqual(
    expect.objectContaining({
      check: 'unsupportedFormula',
      message:
        'This Modifier contributes nothing. @favoredClassReward.bardicPerformanceRound is not a supported variable.',
    }),
  );
});
