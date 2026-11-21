import { expect, test } from 'vitest';
import {
  representativeClassCatalog,
  representativeClassFeatureSchedules,
  representativeClassCounterparts,
} from '../../convex/lib/representativeClassCatalog';
import { representativeArchetypeCatalog } from '../../convex/lib/representativeArchetypeCatalog';
import { representativeSelectionCatalog } from '../../convex/lib/representativeSelectionCatalog';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  calculateCharacterSheetProjections,
  type CharacterSheetInput,
  type CharacterSheetCatalogEntry,
  type SheetEntry,
} from './character-sheet';
import {
  prerequisiteSheet,
  selectedFeat,
} from './character-sheet-prerequisite-fixture';
import { resolveProficiencies } from './character-sheet-proficiencies';

type MutableSheet = Omit<CharacterSheetInput, 'entries' | 'catalogEntries'> & {
  entries: SheetEntry[];
  catalogEntries: CharacterSheetCatalogEntry[];
};
function entryName(input: CharacterSheetInput, entry: SheetEntry) {
  const id = 'catalogEntryId' in entry ? entry.catalogEntryId : undefined;
  return input.catalogEntries.find((definition) => definition._id === id)?.name;
}
function sheet(classIdentity: string, count: number): MutableSheet {
  return {
    characterKind: 'pc',
    entries: [
      {
        _id: 'base-row',
        kind: 'base',
        active: true,
        catalogEntryId: 'base',
        state: { kind: 'base' },
      },
      ...Array.from(
        { length: count },
        (_, index): SheetEntry => ({
          _id: `level-${index + 1}`,
          kind: 'classLevel',
          active: true,
          state: {
            kind: 'classLevel',
            position: index + 1,
            classEntryId: classIdentity,
            hpGained: 5,
          },
        }),
      ),
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: abilityKeys.map((ability) => ({
          target: abilityTargets[ability],
          bonusType: 'base',
          value: 10,
        })),
      },
      ...representativeClassCatalog.map((definition) => ({
        ...definition,
        _id: definition.ruleIdentity,
        detail: {
          ...definition.detail,
          counterpartOf:
            representativeClassCounterparts[definition.ruleIdentity],
          featuresByLevel:
            representativeClassFeatureSchedules[definition.ruleIdentity] ?? [],
        },
      })),
      ...representativeArchetypeCatalog,
      ...representativeSelectionCatalog.map((definition) => ({
        ...definition,
        _id: definition.ruleIdentity,
      })),
    ],
  };
}

// CRB Table 12–5, p. 383: prestige saves begin at +1/+0, not the base-class +2.
test('Duelist uses its complete ten-level prestige progression', () => {
  const progression = Array.from({ length: 10 }, (_, index) => {
    const calculated = calculateCharacterSheet(sheet('duelist', index + 1));
    return [
      calculated.derivedStatistics.bab.total,
      calculated.derivedStatistics.fortitude.total,
      calculated.derivedStatistics.reflex.total,
      calculated.derivedStatistics.will.total,
    ];
  });
  expect(progression).toEqual([
    [1, 0, 1, 0],
    [2, 1, 1, 1],
    [3, 1, 2, 1],
    [4, 1, 2, 1],
    [5, 2, 3, 2],
    [6, 2, 3, 2],
    [7, 2, 4, 2],
    [8, 3, 4, 3],
    [9, 3, 5, 3],
    [10, 3, 5, 3],
  ]);
});

test('Duelist entry reads the recorded build before its BAB and same-level feat benefits', () => {
  const input = sheet('fighter', 7);
  input.entries = input.entries.map(
    (entry): SheetEntry =>
      entry.kind === 'classLevel'
        ? {
            ...entry,
            state: {
              ...entry.state,
              classEntryId: entry.state.position >= 6 ? 'duelist' : 'fighter',
              skillRanks:
                entry.state.position === 1
                  ? { 'skill.acr': 2, 'skill.prf': 2 }
                  : {},
            },
          }
        : entry,
  );
  for (const identity of ['dodge', 'mobility', 'weapon-finesse'])
    input.entries.push({
      _id: identity,
      kind: 'feat',
      active: true,
      catalogEntryId: identity,
      gainedAtClassLevel: identity === 'weapon-finesse' ? 'level-6' : 'level-1',
      state: { kind: 'feat', slot: 'general' },
    });
  const result = calculateCharacterSheet(input);
  const checks = result.prerequisites.filter(
    (check) => check.entryId === 'level-6',
  );
  expect(
    checks
      .filter((check) => 'bab' in check.clause)
      .map(({ view, met }) => [view, met]),
  ).toEqual([
    ['current', true],
    ['recorded', false],
  ]);
  expect(
    checks
      .filter(
        (check) =>
          'feat' in check.clause && check.clause.feat === 'weapon-finesse',
      )
      .map(({ view, met }) => [view, met]),
  ).toEqual([
    ['current', true],
    ['recorded', false],
  ]);
  expect(
    result.prerequisites.some((check) => check.entryId === 'level-7'),
  ).toBe(false);
});

// PU Tables 1–1, 1–2, 1–3 and 1–4; monk loses the original's good Will save.
test.each([
  ['barbarian', 20, 12, 6, 6, 'Rage (UC)'],
  ['monk', 20, 12, 12, 6, 'Flurry of Blows (UC)'],
  ['rogue', 15, 6, 12, 6, 'Sneak Attack +1d6 (UC)'],
  ['summoner', 15, 6, 6, 12, 'Eidolon (UC)'],
] satisfies [string, number, number, number, number, string][])(
  'Unchained %s has its own progression and original class level equivalence',
  (identity, bab, fortitude, reflex, will, firstFeature) => {
    const input = sheet(`unchained-${identity}`, 20);
    input.entries.push({
      _id: 'requirement',
      kind: 'feat',
      active: true,
      catalogEntryId: 'requirement',
      state: { kind: 'feat', slot: 'general' },
    });
    input.catalogEntries.push({
      _id: 'requirement',
      ruleIdentity: 'requirement',
      modifiers: [],
      detail: { kind: 'feat' },
      prerequisites: [{ kind: 'classLevel', classLevel: identity, min: 20 }],
    });
    const result = calculateCharacterSheet(input);
    expect(result.derivedStatistics).toMatchObject({
      bab: { total: bab },
      fortitude: { total: fortitude },
      reflex: { total: reflex },
      will: { total: will },
    });
    expect(
      result.prerequisites.find((check) => check.entryId === 'requirement')
        ?.met,
    ).toBe(true);
    expect(
      result.resolvedEntries.some(
        (row) =>
          row.counting &&
          'catalogEntryId' in row.entry &&
          entryName(input, row.entry) === firstFeature,
      ),
    ).toBe(true);
  },
);

// CRB Tables 12–5 and 12–10, pp. 383 and 392: each acquisition row.
test.each([
  [
    'duelist',
    [
      [1, 'Canny Defense'],
      [1, 'Precise Strike'],
      [2, 'Improved Reaction +2'],
      [2, 'Parry'],
      [3, 'Enhanced Mobility'],
      [4, 'Combat Reflexes'],
      [4, 'Grace'],
      [5, 'Riposte'],
      [6, 'Acrobatic Charge'],
      [7, 'Elaborate Defense'],
      [8, 'Improved Reaction +4'],
      [9, 'Deflect Arrows'],
      [9, 'No Retreat'],
      [10, 'Crippling Critical'],
    ],
  ],
  [
    'shadowdancer',
    [
      [1, 'Hide in Plain Sight'],
      [2, 'Darkvision'],
      [2, 'Evasion'],
      [2, 'Uncanny Dodge'],
      [3, 'Rogue Talent'],
      [3, 'Shadow Illusion'],
      [3, 'Summon Shadow'],
      [4, 'Shadow Call'],
      [4, 'Shadow Jump (40 feet)'],
      [5, 'Defensive Roll'],
      [5, 'Improved Uncanny Dodge'],
      [6, 'Rogue Talent'],
      [6, 'Shadow Jump (80 feet)'],
      [7, 'Slippery Mind'],
      [8, 'Shadow Jump (160 feet)'],
      [8, 'Shadow Power'],
      [9, 'Rogue Talent'],
      [10, 'Improved Evasion'],
      [10, 'Shadow Jump (320 feet)'],
      [10, 'Shadow Master'],
    ],
  ],
] satisfies [string, [number, string][]][])(
  '%s grants the published acquisition schedule through level ten',
  (identity, expected) => {
    const input = sheet(identity, 10);
    const calculated = calculateCharacterSheet(input);
    expect(
      calculated.resolvedEntries
        .filter((row) => row.entry.kind === 'classFeature' && !row.dormant)
        .map((row) => [
          'grantKey' in row.entry ? row.entry.grantKey?.classLevel : undefined,
          entryName(input, row.entry),
        ]),
    ).toEqual(expected);
  },
);

test('an ordinary same-named feature cannot impersonate a different prerequisite', () => {
  const input = prerequisiteSheet(
    [
      {
        _id: 'held',
        kind: 'classFeature',
        active: true,
        catalogEntryId: 'held',
        state: { kind: 'classFeature' },
      },
      selectedFeat('required'),
    ],
    [
      {
        _id: 'held',
        ruleIdentity: 'another-class-feature',
        name: 'Grace',
        modifiers: [],
        detail: { kind: 'classFeature' },
      },
      {
        _id: 'required',
        ruleIdentity: 'required',
        modifiers: [],
        detail: { kind: 'feat' },
        prerequisites: [
          {
            kind: 'classFeature',
            classFeature: 'duelist-grace',
            classFeatureName: 'Grace',
          },
        ],
      },
    ],
  );
  expect(
    calculateCharacterSheet(input).prerequisites.map((check) => check.met),
  ).toEqual([false, false]);
});

test('an unscheduled UC feature cannot impersonate an available original feature', () => {
  const input = sheet('rogue', 1);
  input.catalogEntries.push(
    {
      _id: 'impostor',
      ruleIdentity: 'unrelated-evasion',
      name: 'Evasion (UC)',
      modifiers: [],
      detail: { kind: 'classFeature' },
    },
    {
      _id: 'required',
      ruleIdentity: 'required',
      modifiers: [],
      detail: { kind: 'feat' },
      prerequisites: [
        {
          kind: 'classFeature',
          classFeature: 'evasion',
          classFeatureName: 'Evasion',
        },
      ],
    },
  );
  input.entries.push(
    {
      _id: 'impostor',
      kind: 'classFeature',
      active: true,
      catalogEntryId: 'impostor',
      state: { kind: 'classFeature' },
    },
    {
      _id: 'required',
      kind: 'feat',
      active: true,
      catalogEntryId: 'required',
      state: { kind: 'feat', slot: 'general' },
    },
  );
  expect(
    calculateCharacterSheet(input)
      .prerequisites.filter((check) => check.entryId === 'required')
      .map((check) => check.met),
  ).toEqual([false]);
});

// Original Monk Ki Pool: CRB p. 59, level 4. Unchained Monk: PU p. 16, level 3.
test('a feature whose acquisition level changes becomes dormant across a version switch', () => {
  const input = sheet('monk', 4);
  const original = calculateCharacterSheet(input).resolvedEntries.find(
    (row) =>
      row.entry.kind === 'classFeature' &&
      row.entry.catalogEntryId === 'monk-ki-pool',
  );
  if (original?.entry.kind !== 'classFeature')
    throw new Error('Missing Ki Pool');
  expect(original.entry.grantKey?.classLevel).toBe(4);
  input.entries.push({
    ...original.entry,
    state: { ...original.entry.state, choice: 'retained' },
  });
  input.entries = input.entries.map(
    (entry): SheetEntry =>
      entry.kind === 'classLevel'
        ? {
            ...entry,
            state: { ...entry.state, classEntryId: 'unchained-monk' },
          }
        : entry,
  );
  const switched = calculateCharacterSheet(input);
  expect(
    switched.resolvedEntries.find((row) => row.entry._id === original.entry._id)
      ?.dormant,
  ).toBe(true);
  const shifted = switched.resolvedEntries.find(
    (row) =>
      row.counting &&
      row.entry.kind === 'classFeature' &&
      row.entry.catalogEntryId === 'unchained-monk-ki-pool',
  )?.entry;
  expect(
    shifted?.kind === 'classFeature' ? shifted.grantKey?.classLevel : undefined,
  ).toBe(3);
  input.entries = input.entries.map(
    (entry): SheetEntry =>
      entry.kind === 'classLevel'
        ? {
            ...entry,
            state: { ...entry.state, classEntryId: 'monk' },
          }
        : entry,
  );
  expect(
    calculateCharacterSheet(input).resolvedEntries.find(
      (row) => row.entry._id === original.entry._id,
    ),
  ).toMatchObject({
    dormant: false,
    counting: true,
    entry: { state: { choice: 'retained' } },
  });
});

test('Unchained Rogue receives Weapon Finesse from first-level Finesse Training', () => {
  const result = calculateCharacterSheet(sheet('unchained-rogue', 1));
  expect(
    result.resolvedEntries.some(
      (row) =>
        row.counting &&
        row.entry.kind === 'feat' &&
        row.entry.catalogEntryId === 'weapon-finesse',
    ),
  ).toBe(true);
});

// Pathfinder Unchained p. 14: an explicit weapon list, not simple weapons.
test('Unchained Monk grants only its listed weapon proficiencies', () => {
  expect(
    resolveProficiencies(sheet('unchained-monk', 1)).grants.map(
      (grant) => grant.proficiency,
    ),
  ).toEqual(
    [
      'club',
      'light crossbow',
      'heavy crossbow',
      'dagger',
      'handaxe',
      'javelin',
      'kama',
      'nunchaku',
      'quarterstaff',
      'sai',
      'short sword',
      'shortspear',
      'shuriken',
      'siangham',
      'sling',
      'spear',
    ].map((baseType) => ({ baseType })),
  );
});

test('generic Perform ranks never satisfy Shadowdancer dance specialization', () => {
  const input = sheet('rogue', 5);
  input.entries = input.entries.map(
    (entry): SheetEntry =>
      entry.kind === 'classLevel'
        ? {
            ...entry,
            state: { ...entry.state, skillRanks: { 'skill.prf': 1 } },
          }
        : entry,
  );
  input.entries.push({
    _id: 'entry',
    kind: 'classLevel',
    active: true,
    state: {
      kind: 'classLevel',
      position: 6,
      classEntryId: 'shadowdancer',
      hpGained: 5,
    },
  });
  expect(
    calculateCharacterSheet(input)
      .prerequisites.filter(
        (check) =>
          check.entryId === 'entry' &&
          'skillRanks' in check.clause &&
          check.clause.skillRanks === 'skill.prf.dance',
      )
      .map(({ view, met }) => [view, met]),
  ).toEqual([
    ['current', null],
    ['recorded', null],
  ]);
});

// CRB p. 391: two skill requirements and three feats; no Acrobatics requirement.
test('Shadowdancer entry uses the published five requirement clauses', () => {
  const input = sheet('rogue', 5);
  input.entries.push({
    _id: 'entry',
    kind: 'classLevel',
    active: true,
    state: {
      kind: 'classLevel',
      position: 6,
      classEntryId: 'shadowdancer',
      hpGained: 5,
    },
  });
  expect(
    calculateCharacterSheet(input)
      .prerequisites.filter(
        (check) => check.entryId === 'entry' && check.view === 'recorded',
      )
      .map((check) => check.clause),
  ).toEqual([
    { kind: 'skillRanks', skillRanks: 'skill.prf.dance', min: 2 },
    { kind: 'skillRanks', skillRanks: 'skill.ste', min: 5 },
    { kind: 'feat', feat: 'combat-reflexes' },
    { kind: 'feat', feat: 'dodge' },
    { kind: 'feat', feat: 'mobility' },
  ]);
});

test.each(['duelist', 'shadowdancer'])(
  '%s has no automatic favored entitlement and retains explicit table overrides',
  (identity) => {
    const input = sheet(identity, 1);
    input.entries = input.entries.map(
      (entry): SheetEntry =>
        entry.kind === 'base'
          ? { ...entry, state: { ...entry.state, favoredClassIds: [identity] } }
          : entry.kind === 'classLevel'
            ? {
                ...entry,
                state: { ...entry.state, favoredClassBonus: { choice: 'hp' } },
              }
            : entry,
    );
    const result = calculateCharacterSheet(input);
    expect(result.hp).toBe(6);
    expect(result.warnings.map((warning) => warning.check)).toContain(
      'favoredClassPrestige',
    );
    expect(result.warnings.map((warning) => warning.check)).toContain(
      'favoredClassBonusNotFavored',
    );
    input.entries = input.entries.map(
      (entry): SheetEntry =>
        entry.kind === 'classLevel'
          ? { ...entry, state: { ...entry.state, favoredClassBonus: null } }
          : entry,
    );
    const withoutOverride = calculateCharacterSheet(input);
    expect(withoutOverride.hp).toBe(5);
    expect(
      withoutOverride.warnings.some(
        (warning) => warning.check === 'favoredClassBonusMissing',
      ),
    ).toBe(false);
  },
);

test.each(['barbarian', 'monk', 'rogue', 'summoner'])(
  'mixed %s versions remain present and warn',
  (identity) => {
    const input = sheet(identity, 2);
    input.entries = input.entries.map(
      (entry): SheetEntry =>
        entry.kind === 'classLevel' && entry.state.position === 2
          ? {
              ...entry,
              state: { ...entry.state, classEntryId: `unchained-${identity}` },
            }
          : entry,
    );
    const result = calculateCharacterSheet(input);
    expect(
      result.warnings.filter((warning) => warning.check === 'classVersions'),
    ).toHaveLength(1);
    expect(result.classLevels).toHaveLength(2);
  },
);

test.each(['rogue', 'unchained-rogue'])(
  '%s meets the other version’s same-named feature requirement without relying on a suffix',
  (identity) => {
    const input = sheet(identity, 1);
    input.catalogEntries = input.catalogEntries.map((entry) => ({
      ...entry,
      name: entry.name?.replace(/ \(UC\)/g, ''),
    }));
    const otherIdentity =
      identity === 'rogue'
        ? 'unchained-rogue-sneak-attack-1'
        : 'rogue-sneak-attack-1';
    input.catalogEntries.push({
      _id: 'required',
      ruleIdentity: 'required',
      modifiers: [],
      detail: { kind: 'feat' },
      prerequisites: [{ kind: 'classFeature', classFeature: otherIdentity }],
    });
    input.entries.push({
      _id: 'required',
      kind: 'feat',
      active: true,
      catalogEntryId: 'required',
      state: { kind: 'feat', slot: 'general' },
    });
    expect(
      calculateCharacterSheet(input)
        .prerequisites.filter((check) => check.entryId === 'required')
        .map((check) => check.met),
    ).toEqual([true]);
  },
);

test.each([
  ['unchained-rogue', 'unchained-rogue', true],
  ['unchained-rogue', 'rogue', true],
  ['rogue', 'unchained-rogue', false],
  ['rogue', 'rogue', true],
] satisfies [string, string, boolean][])(
  '%s levels satisfy the typed %s class requirement: %s',
  (heldIdentity, requiredIdentity, met) => {
    const input = sheet(heldIdentity, 1);
    input.catalogEntries.push({
      _id: 'required',
      ruleIdentity: 'required',
      modifiers: [],
      detail: { kind: 'feat' },
      prerequisites: [
        { kind: 'classLevel', classLevel: requiredIdentity, min: 1 },
      ],
    });
    input.entries.push({
      _id: 'required',
      kind: 'feat',
      active: true,
      catalogEntryId: 'required',
      gainedAtClassLevel: 'level-1',
      state: { kind: 'feat', slot: 'general' },
    });
    expect(
      calculateCharacterSheet(input)
        .prerequisites.filter((check) => check.entryId === 'required')
        .map((check) => [check.view, check.met]),
    ).toEqual([
      ['current', met],
      ['recorded', met],
    ]);
  },
);

test.each([
  ['unchained-rogue', 2],
  ['rogue', 1],
] satisfies [string, number][])(
  'class-level formulas retain own Unchained counts beside the original family with a second %s level',
  (secondClass, ownCount) => {
    const input = sheet('unchained-rogue', 2);
    input.catalogEntries = input.catalogEntries.map((definition) =>
      definition.ruleIdentity === 'unchained-rogue'
        ? { ...definition, ruleIdentity: 'rogueUnchained' }
        : definition,
    );
    input.entries = input.entries.map(
      (entry): SheetEntry =>
        entry.kind === 'classLevel' && entry.state.position === 2
          ? { ...entry, state: { ...entry.state, classEntryId: secondClass } }
          : entry,
    );
    input.catalogEntries.push({
      _id: 'counts',
      ruleIdentity: 'counts',
      modifiers: [
        {
          target: 'ability.str',
          bonusType: 'untyped',
          value: { formula: '@classLevel.rogue' },
        },
        {
          target: 'ability.dex',
          bonusType: 'untyped',
          value: { formula: '@classLevel.rogueUnchained' },
        },
      ],
      detail: { kind: 'manual' },
    });
    input.entries.push({
      _id: 'counts',
      kind: 'manual',
      active: true,
      catalogEntryId: 'counts',
      state: { kind: 'manual' },
    });
    const { current, permanent } = calculateCharacterSheetProjections(input);
    for (const projection of [current, permanent]) {
      expect(projection.abilities.strength.score).toBe(12);
      expect(projection.abilities.dexterity.score).toBe(10 + ownCount);
    }
  },
);

test.each([
  ['barbarian', true],
  ['summoner', false],
  [undefined, false],
] satisfies [string | undefined, boolean][])(
  'an unavailable original feature uses its retained class identity %s rather than a display suffix',
  (classFeatureClass, met) => {
    const input = sheet('unchained-barbarian', 1);
    input.catalogEntries = input.catalogEntries
      .filter((definition) => definition.ruleIdentity !== 'barbarian-rage')
      .map((definition) => ({
        ...definition,
        name: definition.name?.replace(/ \(UC\)/g, ''),
      }));
    input.catalogEntries.push({
      _id: 'required',
      ruleIdentity: 'required',
      modifiers: [],
      detail: { kind: 'feat' },
      prerequisites: [
        {
          kind: 'classFeature',
          classFeature: 'barbarian-rage',
          classFeatureName: 'Rage',
          classFeatureClass,
        },
      ],
    });
    input.entries.push({
      _id: 'required',
      kind: 'feat',
      active: true,
      catalogEntryId: 'required',
      gainedAtClassLevel: 'level-1',
      state: { kind: 'feat', slot: 'general' },
    });
    expect(
      calculateCharacterSheet(input)
        .prerequisites.filter((check) => check.entryId === 'required')
        .map((check) => check.met),
    ).toEqual([met, met]);
  },
);

test('original Scout replacements match Unchained Rogue features at their exact levels', () => {
  const input = sheet('unchained-rogue', 8);
  input.entries.push({
    _id: 'scout',
    kind: 'archetype',
    active: true,
    catalogEntryId: 'rogue-scout',
    state: { kind: 'archetype', classEntryId: 'rogue' },
  });
  const result = calculateCharacterSheet(input);
  expect(
    result.resolvedEntries
      .filter((row) => row.dormant && row.entry.kind === 'classFeature')
      .map((row) => entryName(input, row.entry)),
  ).toEqual(['Uncanny Dodge (UC)', 'Improved Uncanny Dodge (UC)']);
  expect(
    result.warnings.some(
      (warning) => warning.check === 'archetypeReplacementUnmatched',
    ),
  ).toBe(false);
});

test.each([
  ['barbarian', 'rage', 'Rage', 1],
  ['barbarian', 'uncanny-dodge', 'Uncanny Dodge', 2],
  ['summoner', 'eidolon', 'Eidolon', 1],
  ['summoner', 'bond-senses', 'Bond Senses', 2],
] satisfies [string, string, string, number][])(
  'original %s archetype replacement of %s matches its Unchained acquisition row',
  (identity, key, name, classLevel) => {
    const input = sheet(`unchained-${identity}`, 3);
    input.catalogEntries.push({
      _id: 'archetype',
      ruleIdentity: 'archetype',
      modifiers: [],
      detail: {
        kind: 'archetype',
        classEntryIds: [identity],
        replaces: [{ classLevel, catalogEntryId: `${identity}-${key}` }],
        adds: [],
      },
    });
    input.entries.push({
      _id: 'archetype',
      kind: 'archetype',
      active: true,
      catalogEntryId: 'archetype',
      state: { kind: 'archetype', classEntryId: identity },
    });
    const result = calculateCharacterSheet(input);
    expect(
      result.resolvedEntries
        .filter((row) => row.dormant && row.entry.kind === 'classFeature')
        .map((row) => [
          'grantKey' in row.entry ? row.entry.grantKey?.classLevel : undefined,
          entryName(input, row.entry),
        ]),
    ).toEqual([[classLevel, `${name} (UC)`]]);
    expect(
      result.warnings.some((warning) =>
        warning.check.startsWith('archetypeReplacementUnmatched'),
      ),
    ).toBe(false);
  },
);

test.each([
  ['barbarian', 'barbarian-trap-sense-3', 'archetypeReplacementUnmatched'],
  ['rogue', 'rogue-trap-sense-3', 'archetypeReplacementUnmatched'],
  ['monk', 'monk-flurry', 'archetypeUnchainedMonk'],
])(
  'original %s archetypes warn and leave unmatched or incompatible features available',
  (identity, replacedId, check) => {
    const input = sheet(`unchained-${identity}`, 3);
    input.catalogEntries.push({
      _id: 'synthetic-archetype',
      ruleIdentity: 'synthetic-archetype',
      modifiers: [],
      detail: {
        kind: 'archetype',
        classEntryIds: [identity],
        replaces: [
          {
            classLevel: identity === 'monk' ? 1 : 3,
            catalogEntryId: replacedId,
          },
        ],
        adds: [],
      },
    });
    input.entries.push({
      _id: 'archetype',
      kind: 'archetype',
      active: true,
      catalogEntryId: 'synthetic-archetype',
      state: { kind: 'archetype', classEntryId: identity },
    });
    const result = calculateCharacterSheet(input);
    expect(result.warnings.some((warning) => warning.check === check)).toBe(
      true,
    );
    expect(
      result.resolvedEntries.filter(
        (row) => row.entry.kind === 'classFeature' && row.dormant,
      ),
    ).toEqual([]);
  },
);
