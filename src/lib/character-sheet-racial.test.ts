import { homebrewElfSubrace } from '../../tests/character-sheet-homebrew-subrace';
import { expect, test } from 'vitest';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  calculateCharacterSheetProjections,
  type CharacterSheetInput,
} from './character-sheet';
import { satisfiesRacialPrerequisite } from './character-sheet-racial';
import { representativeRaceCatalog } from '../../convex/lib/representativeRaceCatalog';

function sheet(): CharacterSheetInput {
  return {
    characterKind: 'pc',
    entries: [
      {
        _id: 'base-row',
        kind: 'base',
        active: true,
        catalogEntryId: 'base',
        state: { kind: 'base', abilityMethod: { kind: 'pointBuy', budget: 0 } },
      },
      {
        _id: 'race-row',
        kind: 'race',
        active: true,
        catalogEntryId: 'human',
        state: { kind: 'race' },
      },
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
      {
        _id: 'human',
        name: 'Human',
        ruleIdentity: 'human',
        modifiers: [],
        detail: { kind: 'race', racialTraits: ['ability'] },
      },
      {
        _id: 'ability',
        name: 'Ability Score',
        ruleIdentity: 'human-ability',
        modifiers: [
          { target: 'ability.$choice', bonusType: 'racial', value: 2 },
        ],
        detail: { kind: 'racialTrait', raceEntryIds: ['human'], replaces: [] },
      },
    ],
  };
}

// #220/#222: racial and class ranks add; a racial class skill earns +3 once.
test('racial ranks and creature-type class skills contribute to the ordinary skill total', () => {
  const input = sheet();
  input.catalogEntries = input.catalogEntries.map((entry) =>
    entry._id === 'human'
      ? {
          ...entry,
          detail: {
            kind: 'race',
            racialTraits: [],
            racialHitDice: 3,
            racialProgression: {
              creatureType: 'aberration',
              hitDie: 8,
              bab: 'threeQuarters',
              saves: { fort: 'poor', ref: 'poor', will: 'good' },
              skillRanksPerHitDie: 4,
              classSkills: ['per'],
            },
          },
        }
      : entry,
  );
  input.entries = input.entries.map((entry) =>
    entry.kind === 'race'
      ? {
          ...entry,
          state: {
            ...entry.state,
            racialHpGained: 11,
            racialSkillRanks: { per: 2, 'skill.per': 1, clm: 1 },
          },
        }
      : entry,
  );
  const result = calculateCharacterSheet(input);
  expect(
    result.skills.find((skill) => skill.key === 'skill.per'),
  ).toMatchObject({
    ranks: 3,
    classSkill: true,
  });
  expect(result.breakdowns['skill.per'].total).toBe(6);
  expect(result.breakdowns['skill.clm'].total).toBe(1);
});

// CRB pp. 25, 27, 28: +2 to one ability; #232 keeps this separate from base scores.
test('an unchosen racial ability-score choice contributes nothing, then changes only the chosen ability and never point buy', () => {
  const input = sheet();
  const unchosen = calculateCharacterSheet(input);
  expect(unchosen.abilities.strength.score).toBe(10);
  expect(unchosen.warnings).toContainEqual(
    expect.objectContaining({ check: 'racialAbilityScoreChoice' }),
  );
  input.entries = [
    ...input.entries,
    {
      _id: 'saved-choice',
      kind: 'racialTrait',
      active: true,
      catalogEntryId: 'ability',
      grantKey: { source: 'human', entry: 'human-ability' },
      state: { kind: 'racialTrait', choice: 'strength' },
    },
  ];
  const chosen = calculateCharacterSheet(input);
  expect(chosen.abilities.strength.score).toBe(12);
  expect(chosen.abilities.dexterity.score).toBe(10);
  expect(chosen.pointBuy?.spent).toBe(0);
  expect(
    chosen.warnings.some(
      (warning) => warning.check === 'racialAbilityScoreChoice',
    ),
  ).toBe(false);
});

// #232 permits equivalence on any Catalog Entry, including a selected class definition.
test('active Class Levels supply their class equivalence and proficiency once per source', () => {
  const input = sheet();
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'class',
      ruleIdentity: 'class',
      modifiers: [],
      countsAsRaces: ['elf'],
      proficiencies: [{ baseType: 'longbow' }],
      detail: {
        kind: 'class',
        classKind: 'base',
        hitDie: 8,
        bab: 'half',
        saves: { fort: 'poor', ref: 'poor', will: 'good' },
        skillRanksPerLevel: 2,
      },
    },
  ];
  input.entries = [
    ...input.entries,
    ...[1, 2].map((position) => ({
      _id: `level-${position}`,
      kind: 'classLevel' as const,
      active: true as const,
      state: {
        kind: 'classLevel' as const,
        classEntryId: 'class',
        position,
        hpGained: 8,
      },
    })),
  ];
  const result = calculateCharacterSheet(input);
  expect(satisfiesRacialPrerequisite(result.racial, { race: ['elf'] })).toBe(
    true,
  );
  expect(result.racial.proficiencies).toEqual([{ baseType: 'longbow' }]);
});

// CRB pp. 21, 22, 25–27, racial ability score adjustments. Values start from six base 10s.
test.each([
  ['elf', undefined, [10, 12, 8, 12, 10, 10]],
  ['dwarf', undefined, [10, 10, 12, 10, 12, 8]],
  ['human', 'wisdom', [10, 10, 10, 10, 12, 10]],
  ['half-elf', 'charisma', [10, 10, 10, 10, 10, 12]],
  ['half-orc', 'strength', [12, 10, 10, 10, 10, 10]],
] as const)(
  '%s racial scores agree in current and permanent projections while base stays untouched',
  (race, choice, scores) => {
    const input = sheet();
    input.entries = input.entries.map((entry) =>
      entry.kind === 'race' ? { ...entry, catalogEntryId: race } : entry,
    );
    input.catalogEntries = [
      input.catalogEntries[0]!,
      ...representativeRaceCatalog,
    ];
    if (choice) {
      const before = calculateCharacterSheet(input);
      expect(
        abilityKeys.map((ability) => before.abilities[ability].score),
      ).toEqual([10, 10, 10, 10, 10, 10]);
      input.entries = [
        ...input.entries,
        {
          _id: 'choice',
          kind: 'racialTrait',
          active: true,
          catalogEntryId: `${race}-ability`,
          grantKey: { source: race, entry: `${race}-ability` },
          state: { kind: 'racialTrait', choice },
        },
      ];
    }
    const result = calculateCharacterSheetProjections(input);
    expect(
      abilityKeys.map((ability) => result.current.abilities[ability].score),
    ).toEqual(scores);
    expect(
      abilityKeys.map((ability) => result.permanent.abilities[ability].score),
    ).toEqual(scores);
    expect(result.current.pointBuy?.spent).toBe(0);
  },
);

// #232: subrace and same-name overrides are separate selections; no inferred bundle.
test('selecting a player-authored subrace changes its named ability trait without selecting its separate vision override', () => {
  const input = sheet();
  input.catalogEntries = [
    input.catalogEntries[0]!,
    ...representativeRaceCatalog,
    ...homebrewElfSubrace,
  ];
  input.entries = [
    ...input.entries.map((entry) =>
      entry.kind === 'race' ? { ...entry, catalogEntryId: 'elf' } : entry,
    ),
    {
      _id: 'subrace',
      kind: 'racialTrait',
      active: true,
      catalogEntryId: 'homebrew-elf-ability',
      state: { kind: 'racialTrait' },
    },
  ];
  const result = calculateCharacterSheet(input);
  expect(result.abilities.intelligence.score).toBe(10);
  expect(result.abilities.charisma.score).toBe(12);
  expect(
    result.resolvedEntries.find(
      (row) =>
        row.entry.kind === 'racialTrait' &&
        row.entry.catalogEntryId === 'elf-low-light',
    )?.counting,
  ).toBe(true);
  expect(
    result.resolvedEntries.some(
      (row) =>
        row.entry.kind === 'racialTrait' &&
        row.entry.catalogEntryId === 'homebrew-elf-vision',
    ),
  ).toBe(false);
});

// #243: no alternate supplies its own source; entry and catalog order cannot change that decision.
test.each([false, true])(
  'a foreign alternate replacing its own required blood stays dormant in reversed order %s',
  (reverse) => {
    const input = sheet();
    input.entries = input.entries.map((entry) =>
      entry.kind === 'race' ? { ...entry, catalogEntryId: 'half-elf' } : entry,
    );
    input.catalogEntries = [
      input.catalogEntries[0]!,
      ...representativeRaceCatalog,
      {
        _id: 'foreign',
        ruleIdentity: 'foreign',
        modifiers: [],
        countsAsRaces: ['elf'],
        detail: {
          kind: 'racialTrait',
          raceEntryIds: ['elf'],
          replaces: ['half-elf-blood'],
        },
      },
    ];
    input.entries = [
      ...input.entries,
      {
        _id: 'foreign-row',
        kind: 'racialTrait',
        active: true,
        catalogEntryId: 'foreign',
        state: { kind: 'racialTrait' },
      },
    ];
    if (reverse) {
      input.entries = [...input.entries].reverse();
      input.catalogEntries = [...input.catalogEntries].reverse();
    }
    const result = calculateCharacterSheet(input);
    expect(
      result.resolvedEntries.find((row) => row.entry._id === 'foreign-row'),
    ).toMatchObject({ dormant: true, counting: false });
    expect(result.racial.countsAsRaces).toContain('elf');
    expect(
      result.resolvedEntries.find(
        (row) =>
          row.entry.kind === 'racialTrait' &&
          row.entry.catalogEntryId === 'half-elf-blood',
      )?.counting,
    ).toBe(true);
  },
);

// ARG half-orcs may select orc alternates; the explicit rule survives renamed Catalog Copies.
test('a renamed copied half-orc can take an orc alternate after its Orc Blood is replaced', () => {
  const input = sheet();
  input.entries = input.entries.map((entry) =>
    entry.kind === 'race' ? { ...entry, catalogEntryId: 'copy' } : entry,
  );
  input.catalogEntries = [
    input.catalogEntries[0]!,
    {
      _id: 'copy',
      name: 'Renamed Custom Race',
      ruleIdentity: 'c78a',
      modifiers: [],
      detail: {
        kind: 'race',
        racialTraits: ['blood'],
        allowedAlternateRaces: ['90f2'],
      },
    },
    {
      _id: 'orc',
      name: 'Renamed Orc Definition',
      ruleIdentity: '90f2',
      modifiers: [],
      detail: { kind: 'race', racialTraits: [] },
    },
    {
      _id: 'blood',
      ruleIdentity: 'blood',
      modifiers: [],
      countsAsRaces: ['90f2'],
      detail: { kind: 'racialTrait', raceEntryIds: ['copy'], replaces: [] },
    },
    {
      _id: 'alternate',
      ruleIdentity: 'alternate',
      modifiers: [],
      detail: {
        kind: 'racialTrait',
        raceEntryIds: ['orc'],
        replaces: ['blood'],
      },
    },
  ];
  input.entries = [
    ...input.entries,
    {
      _id: 'alternate-row',
      kind: 'racialTrait',
      active: true,
      catalogEntryId: 'alternate',
      state: { kind: 'racialTrait' },
    },
  ];
  const result = calculateCharacterSheet(input);
  expect(
    result.resolvedEntries.find((row) => row.entry._id === 'alternate-row')
      ?.counting,
  ).toBe(true);
  expect(satisfiesRacialPrerequisite(result.racial, { race: ['90f2'] })).toBe(
    false,
  );
});

// #232 countsAs applies on any active entry; Dragon Soul's oneOf has no default.
test('any active selection supplies equivalence and oneOf contributes only its recorded choice', () => {
  const input = sheet();
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'dragon-soul',
      ruleIdentity: 'dragon-soul',
      modifiers: [],
      countsAsRaces: { oneOf: ['elf', 'human'] },
      detail: { kind: 'racialTrait', raceEntryIds: ['human'], replaces: [] },
    },
    {
      _id: 'paragon',
      ruleIdentity: 'paragon',
      modifiers: [],
      countsAsRaces: ['drow'],
      detail: { kind: 'feat' },
    },
  ];
  input.entries = [
    ...input.entries,
    {
      _id: 'dragon',
      kind: 'racialTrait',
      active: true,
      catalogEntryId: 'dragon-soul',
      state: { kind: 'racialTrait' },
    },
    {
      _id: 'paragon',
      kind: 'feat',
      active: true,
      catalogEntryId: 'paragon',
      state: { kind: 'feat' },
    },
  ];
  const unchosen = calculateCharacterSheet(input);
  expect(satisfiesRacialPrerequisite(unchosen.racial, { race: ['elf'] })).toBe(
    false,
  );
  expect(
    satisfiesRacialPrerequisite(unchosen.racial, { race: ['elf', 'drow'] }),
  ).toBe(true);
  input.entries = input.entries.map((entry) =>
    entry.kind === 'racialTrait'
      ? { ...entry, state: { ...entry.state, choice: 'elf' } }
      : entry.kind === 'feat'
        ? { ...entry, active: false }
        : entry,
  );
  const chosen = calculateCharacterSheet(input);
  expect(satisfiesRacialPrerequisite(chosen.racial, { race: ['elf'] })).toBe(
    true,
  );
  expect(satisfiesRacialPrerequisite(chosen.racial, { race: ['drow'] })).toBe(
    false,
  );
});

// ARG half-elf Elf Blood and APG alternate rules; #232/#243 require current equivalence without dormant effects.
test('equivalence from an active blood trait allows parent-race alternates and explicitly curated replacements, then disappears when blood is replaced', () => {
  const input = sheet();
  input.entries = input.entries.map((entry) =>
    entry.kind === 'race' ? { ...entry, catalogEntryId: 'half-elf' } : entry,
  );
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'half-elf',
      name: 'Half-Elf',
      ruleIdentity: 'half-elf',
      modifiers: [],
      detail: { kind: 'race', racialTraits: ['blood', 'half-elf-keen'] },
    },
    {
      _id: 'elf',
      name: 'Elf',
      ruleIdentity: 'elf',
      modifiers: [],
      detail: { kind: 'race', racialTraits: ['elf-keen'] },
    },
    {
      _id: 'blood',
      name: 'Elf Blood',
      ruleIdentity: 'elf-blood',
      modifiers: [],
      countsAsRaces: ['elf', 'human'],
      detail: { kind: 'racialTrait', raceEntryIds: ['half-elf'], replaces: [] },
    },
    {
      _id: 'half-elf-keen',
      name: 'Keen Senses (Half-Elf)',
      ruleIdentity: 'half-elf-keen',
      modifiers: [{ target: 'skill.per', bonusType: 'racial', value: 2 }],
      detail: { kind: 'racialTrait', raceEntryIds: ['half-elf'], replaces: [] },
    },
    {
      _id: 'elf-keen',
      name: 'Keen Senses (Elf)',
      ruleIdentity: 'elf-keen',
      modifiers: [],
      detail: { kind: 'racialTrait', raceEntryIds: ['elf'], replaces: [] },
    },
    {
      _id: 'elf-alternate',
      name: 'Elf Alternate',
      ruleIdentity: 'elf-alternate',
      modifiers: [],
      detail: {
        kind: 'racialTrait',
        raceEntryIds: ['elf'],
        replaces: ['half-elf-keen'],
      },
    },
    {
      _id: 'blood-alternate',
      name: 'Blood Alternate',
      ruleIdentity: 'blood-alternate',
      modifiers: [],
      detail: {
        kind: 'racialTrait',
        raceEntryIds: ['half-elf'],
        replaces: ['blood'],
      },
    },
  ];
  input.entries = [
    ...input.entries,
    {
      _id: 'elf-alternate-row',
      kind: 'racialTrait',
      active: true,
      catalogEntryId: 'elf-alternate',
      state: { kind: 'racialTrait' },
    },
  ];
  const parent = calculateCharacterSheet(input);
  expect(satisfiesRacialPrerequisite(parent.racial, { race: ['elf'] })).toBe(
    true,
  );
  expect(
    parent.resolvedEntries.find((row) => row.entry._id === 'elf-alternate-row')
      ?.counting,
  ).toBe(true);
  expect(
    parent.resolvedEntries.find(
      (row) =>
        row.entry.kind === 'racialTrait' &&
        row.entry.catalogEntryId === 'half-elf-keen',
    )?.counting,
  ).toBe(false);
  input.entries = [
    ...input.entries,
    {
      _id: 'blood-alternate-row',
      kind: 'racialTrait',
      active: true,
      catalogEntryId: 'blood-alternate',
      state: { kind: 'racialTrait' },
    },
  ];
  const changed = calculateCharacterSheet(input);
  expect(satisfiesRacialPrerequisite(changed.racial, { race: ['elf'] })).toBe(
    false,
  );
  expect(
    changed.resolvedEntries.find((row) => row.entry._id === 'elf-alternate-row')
      ?.counting,
  ).toBe(false);
  expect(
    changed.resolvedEntries.find(
      (row) =>
        row.entry.kind === 'racialTrait' &&
        row.entry.catalogEntryId === 'half-elf-keen',
    )?.counting,
  ).toBe(true);
});

// #222 fixes count independently of missing progression; unknown racial HP is never guessed.
test('an incomplete custom racial progression retains actual Hit Dice and exposes unresolved data', () => {
  const input = sheet();
  input.catalogEntries = input.catalogEntries.map((entry) =>
    entry.detail?.kind === 'race'
      ? { ...entry, detail: { ...entry.detail, racialHitDice: 2 } }
      : entry,
  );
  const result = calculateCharacterSheet(input);
  expect(result.level).toBe(0);
  expect(result.hitDice).toBe(2);
  expect(result.hp).toBeNull();
  expect(result.budgets.racialSkillRanks).toBeNull();
  expect(result.warnings).toContainEqual(
    expect.objectContaining({
      check: 'racialProgressionMissing',
      kind: 'unresolved',
    }),
  );
});

// #243 Keep supplies an intentional source even when its normal eligibility is absent.
test.each([false, true])(
  'a kept foreign alternate anchors equivalence without cyclic eligibility in reverse order %s',
  (reverse) => {
    const input = sheet();
    input.catalogEntries = [
      ...input.catalogEntries,
      {
        _id: 'dwarf',
        ruleIdentity: 'dwarf',
        modifiers: [],
        detail: { kind: 'race', racialTraits: [] },
      },
      {
        _id: 'elf',
        ruleIdentity: 'elf',
        modifiers: [],
        detail: { kind: 'race', racialTraits: [] },
      },
      {
        _id: 'a',
        ruleIdentity: 'a',
        modifiers: [],
        countsAsRaces: ['elf'],
        detail: { kind: 'racialTrait', raceEntryIds: ['dwarf'], replaces: [] },
      },
      {
        _id: 'b',
        ruleIdentity: 'b',
        modifiers: [],
        countsAsRaces: ['dwarf'],
        detail: { kind: 'racialTrait', raceEntryIds: ['elf'], replaces: [] },
      },
    ];
    input.entries = [
      ...input.entries,
      {
        _id: 'a',
        kind: 'racialTrait',
        active: true,
        kept: true,
        catalogEntryId: 'a',
        state: { kind: 'racialTrait' },
      },
      {
        _id: 'b',
        kind: 'racialTrait',
        active: true,
        catalogEntryId: 'b',
        state: { kind: 'racialTrait' },
      },
    ];
    if (reverse) input.entries = [...input.entries].reverse();
    const anchored = calculateCharacterSheet(input);
    expect(
      anchored.resolvedEntries.find((row) => row.entry._id === 'b')?.counting,
    ).toBe(true);
    input.entries = input.entries.map((entry) =>
      entry.kind === 'racialTrait' ? { ...entry, kept: undefined } : entry,
    );
    expect(
      calculateCharacterSheet(input)
        .resolvedEntries.filter(
          (row) => row.entry._id === 'a' || row.entry._id === 'b',
        )
        .map((row) => row.counting),
    ).toEqual([false, false]);
  },
);

// APG Alternate Racial Traits: a standard trait cannot be exchanged twice; #232 unresolved links stay manual.
test('manual replacement targets override unresolved prose, retain chosen state and duplicate replacements warn', () => {
  const input = sheet();
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'alternate',
      name: 'Alternate',
      ruleIdentity: 'alternate',
      modifiers: [],
      detail: {
        kind: 'racialTrait',
        raceEntryIds: ['human'],
        replaces: [],
        unresolvedReplacements: ['Base Statistics'],
      },
    },
  ];
  input.entries = [
    ...input.entries,
    {
      _id: 'alternate-row',
      kind: 'racialTrait',
      active: true,
      catalogEntryId: 'alternate',
      state: { kind: 'racialTrait' },
    },
  ];
  expect(calculateCharacterSheet(input).warnings).toContainEqual(
    expect.objectContaining({ check: 'racialReplacementUnresolved' }),
  );
  input.entries = input.entries.map((entry) =>
    entry.kind === 'racialTrait' && entry._id === 'alternate-row'
      ? {
          ...entry,
          state: { kind: 'racialTrait' as const, replaces: ['ability'] },
        }
      : entry,
  );
  const replaced = calculateCharacterSheet(input);
  expect(
    replaced.resolvedEntries.find(
      (row) =>
        row.entry.kind === 'racialTrait' &&
        row.entry.catalogEntryId === 'ability',
    ),
  ).toMatchObject({ dormant: true, counting: false });
  expect(
    replaced.warnings.some(
      (warning) => warning.check === 'racialReplacementUnresolved',
    ),
  ).toBe(false);
  expect(
    satisfiesRacialPrerequisite(replaced.racial, {
      racialTrait: 'human-ability',
    }),
  ).toBe(false);
  input.entries = [
    ...input.entries,
    {
      _id: 'second-row',
      kind: 'racialTrait',
      active: true,
      catalogEntryId: 'alternate',
      state: { kind: 'racialTrait', replaces: ['ability'] },
    },
  ];
  expect(calculateCharacterSheet(input).warnings).toContainEqual(
    expect.objectContaining({ check: 'racialReplacementDuplicate' }),
  );
  input.entries = input.entries.map((entry) =>
    entry.kind === 'racialTrait' ? { ...entry, active: false } : entry,
  );
  expect(
    calculateCharacterSheet(input).resolvedEntries.find(
      (row) =>
        row.entry.kind === 'racialTrait' &&
        row.entry.catalogEntryId === 'ability',
    ),
  ).toMatchObject({ dormant: false, counting: true });
});

// CRB human and half-elf racial traits; #232 places slots and proficiency on their trait.
test('race facts stay on the race while active traits provide slots, skill ranks, favored classes and familiarity', () => {
  const input = sheet();
  input.entries = [
    ...input.entries,
    {
      _id: 'level',
      kind: 'classLevel',
      active: true,
      state: {
        kind: 'classLevel',
        classEntryId: 'fighter',
        position: 1,
        hpGained: 10,
      },
    },
  ];
  input.catalogEntries = [
    ...input.catalogEntries.map((entry) =>
      entry._id === 'human'
        ? {
            ...entry,
            detail: {
              kind: 'race' as const,
              racialTraits: [
                'ability',
                'skilled',
                'multitalented',
                'familiarity',
                'bonus-feat',
              ],
              size: 'small' as const,
              creatureTypes: ['humanoid'],
              racialHitDice: 0,
            },
          }
        : entry,
    ),
    {
      _id: 'fighter',
      ruleIdentity: 'fighter',
      modifiers: [],
      detail: {
        kind: 'class',
        classKind: 'base',
        hitDie: 10,
        bab: 'full',
        saves: { fort: 'good', ref: 'poor', will: 'poor' },
        skillRanksPerLevel: 2,
      },
    },
    {
      _id: 'skilled',
      ruleIdentity: 'skilled',
      modifiers: [],
      detail: {
        kind: 'racialTrait',
        raceEntryIds: ['human'],
        replaces: [],
        bonusSkillRanksPerLevel: 1,
      },
    },
    {
      _id: 'multitalented',
      ruleIdentity: 'multitalented',
      modifiers: [],
      detail: {
        kind: 'racialTrait',
        raceEntryIds: ['human'],
        replaces: [],
        favoredClassCount: 2,
      },
    },
    {
      _id: 'familiarity',
      ruleIdentity: 'familiarity',
      modifiers: [],
      proficiencies: [{ baseType: 'longbow' }],
      detail: { kind: 'racialTrait', raceEntryIds: ['human'], replaces: [] },
    },
    {
      _id: 'bonus-feat',
      ruleIdentity: 'bonus-feat',
      modifiers: [],
      grantsSlots: [{ kind: 'feat', count: 1 }],
      detail: { kind: 'racialTrait', raceEntryIds: ['human'], replaces: [] },
    },
  ];
  const result = calculateCharacterSheet(input);
  expect(result.racial).toMatchObject({
    size: 'small',
    creatureTypes: ['humanoid'],
    favoredClassCount: 2,
    bonusSkillRanksPerLevel: 1,
    proficiencies: [{ baseType: 'longbow' }],
  });
  expect(result.classLevels[0]?.skillRankBudget).toBe(3);
  expect(result.derivedStatistics.ac.total).toBe(11);
  expect(
    result.resolvedEntries.find(
      (row) =>
        row.entry.kind === 'racialTrait' &&
        row.entry.catalogEntryId === 'bonus-feat',
    )?.counting,
  ).toBe(true);
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'replace-facts',
      ruleIdentity: 'replace-facts',
      modifiers: [],
      detail: {
        kind: 'racialTrait',
        raceEntryIds: ['human'],
        replaces: ['skilled', 'multitalented', 'familiarity', 'bonus-feat'],
      },
    },
  ];
  input.entries = [
    ...input.entries,
    {
      _id: 'replace-facts',
      kind: 'racialTrait',
      active: true,
      catalogEntryId: 'replace-facts',
      state: { kind: 'racialTrait' },
    },
  ];
  const withdrawn = calculateCharacterSheet(input);
  expect(withdrawn.racial).toMatchObject({
    favoredClassCount: 1,
    bonusSkillRanksPerLevel: 0,
    proficiencies: [],
  });
  expect(withdrawn.classLevels[0]?.skillRankBudget).toBe(2);
  expect(
    withdrawn.resolvedEntries.find(
      (row) =>
        row.entry.kind === 'racialTrait' &&
        row.entry.catalogEntryId === 'bonus-feat',
    )?.counting,
  ).toBe(false);
  input.entries = input.entries.map((entry) =>
    entry.kind === 'racialTrait' && entry._id === 'replace-facts'
      ? { ...entry, active: false }
      : entry,
  );
  expect(calculateCharacterSheet(input).racial).toMatchObject({
    favoredClassCount: 2,
    bonusSkillRanksPerLevel: 1,
    proficiencies: [{ baseType: 'longbow' }],
  });
});

// #232 assigns replacement name resolution to import/curation, never runtime.
test('same-named traits from different races never infer a runtime replacement', () => {
  const input = sheet();
  input.catalogEntries = input.catalogEntries.map((entry) =>
    entry._id === 'ability' ? { ...entry, name: 'Keen Senses (Human)' } : entry,
  );
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'elf',
      name: 'Elf',
      ruleIdentity: 'elf',
      modifiers: [],
      detail: { kind: 'race', racialTraits: ['elf-keen'] },
    },
    {
      _id: 'elf-keen',
      name: 'Keen Senses (Elf)',
      ruleIdentity: 'elf-keen',
      modifiers: [],
      detail: { kind: 'racialTrait', raceEntryIds: ['elf'], replaces: [] },
    },
    {
      _id: 'alternate',
      ruleIdentity: 'alternate',
      modifiers: [],
      detail: {
        kind: 'racialTrait',
        raceEntryIds: ['human'],
        replaces: ['elf-keen'],
      },
    },
  ];
  input.entries = [
    ...input.entries,
    {
      _id: 'alternate-row',
      kind: 'racialTrait',
      catalogEntryId: 'alternate',
      active: true,
      state: { kind: 'racialTrait' },
    },
  ];
  expect(
    calculateCharacterSheet(input).resolvedEntries.find(
      (row) =>
        row.entry.kind === 'racialTrait' &&
        row.entry.catalogEntryId === 'ability',
    )?.counting,
  ).toBe(true);
});

// CRB Intelligence retroactively determines the ordinary racial rank budget.
test.each([
  [2, true, { per: 2, 'skill.per': 1, clm: 2 }, 4, true],
  [0, true, { per: 1 }, 0, false],
  [2, false, { per: 2, clm: 2, swm: 2 }, null, false],
] as const)(
  'racial rank allocation warns against its computed budget with %s Hit Dice and known progression %s',
  (count, known, ranks, budget, warns) => {
    const input = sheet();
    input.catalogEntries = input.catalogEntries.map((entry) =>
      entry._id === 'human'
        ? {
            ...entry,
            detail: {
              kind: 'race',
              racialTraits: [],
              racialHitDice: count,
              ...(known
                ? {
                    racialProgression: {
                      creatureType: 'humanoid',
                      classSkills: [],
                      hitDie: 8,
                      bab: 'half',
                      saves: { fort: 'poor', ref: 'poor', will: 'good' },
                      skillRanksPerHitDie: 2,
                    },
                  }
                : {}),
            },
          }
        : entry,
    );
    input.entries = input.entries.map((entry) =>
      entry.kind === 'race'
        ? {
            ...entry,
            state: {
              ...entry.state,
              racialHpGained: 8,
              racialSkillRanks: ranks,
            },
          }
        : entry,
    );
    const result = calculateCharacterSheet(input);
    expect(result.budgets.racialSkillRanks).toBe(budget);
    expect(
      result.warnings.some(
        (warning) => warning.check === 'racialSkillRankBudget',
      ),
    ).toBe(warns);
  },
);

// CRB small size, chosen score adjustment and grappled Dex penalty compose;
// conditions are excluded from permanent statistics and dormant Grants.
test.each([false, true])(
  'racial size and score choice compose with current conditions while a dormant condition counts for nothing (%s)',
  (dormant) => {
    const input = sheet();
    input.catalogEntries = [
      ...input.catalogEntries.map((entry) =>
        entry._id === 'human'
          ? {
              ...entry,
              detail: {
                kind: 'race' as const,
                racialTraits: ['ability'],
                size: 'small' as const,
              },
            }
          : entry,
      ),
      {
        _id: 'grappled',
        ruleIdentity: 'grappled',
        modifiers: [],
        detail: { kind: 'condition', conditionKey: 'grappled' },
      },
    ];
    input.entries = [
      ...input.entries,
      {
        _id: 'chosen-score',
        kind: 'racialTrait',
        active: true,
        catalogEntryId: 'ability',
        grantKey: { source: 'human', entry: 'human-ability' },
        state: { kind: 'racialTrait', choice: 'dexterity' },
      },
      {
        _id: 'condition',
        kind: 'condition',
        active: true,
        catalogEntryId: 'grappled',
        ...(dormant
          ? { grantKey: { source: 'missing-source', entry: 'grappled' } }
          : {}),
        state: { kind: 'condition' },
      },
    ];
    const result = calculateCharacterSheetProjections(input);
    expect(result.current.abilities.dexterity.score).toBe(dormant ? 12 : 8);
    expect(result.current.derivedStatistics.ac.total).toBe(dormant ? 12 : 10);
    expect(result.permanent.abilities.dexterity.score).toBe(12);
    expect(result.permanent.derivedStatistics.ac.total).toBe(12);
  },
);

test('a curated replacement uses a renamed Catalog Copy identity without name inference', () => {
  const input = sheet();
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'copy',
      name: 'Renamed copy',
      ruleIdentity: 'human-ability',
      modifiers: [],
      detail: { kind: 'racialTrait', raceEntryIds: ['human'], replaces: [] },
    },
    {
      _id: 'alternate',
      name: 'Unrelated name',
      ruleIdentity: 'alternate',
      modifiers: [],
      detail: {
        kind: 'racialTrait',
        raceEntryIds: ['human'],
        replaces: ['copy'],
      },
    },
  ];
  input.entries = [
    ...input.entries,
    {
      _id: 'alternate-row',
      kind: 'racialTrait',
      active: true,
      catalogEntryId: 'alternate',
      state: { kind: 'racialTrait' },
    },
  ];
  expect(
    calculateCharacterSheet(input).resolvedEntries.find(
      (row) =>
        row.entry.kind === 'racialTrait' &&
        row.entry.catalogEntryId === 'ability',
    )?.counting,
  ).toBe(false);
});

test('representative fixed ability grants use source-derived identities and expose no illustrative content', () => {
  for (const [key, identity] of [
    ['elf-ability', 'local/race-ability-scores/pf1/NgIhxRI0axrf3fcO'],
    ['dwarf-ability', 'local/race-ability-scores/pf1/nEltI9y37rKJTeWo'],
  ]) {
    expect(
      representativeRaceCatalog.find((entry) => entry._id === key)
        ?.ruleIdentity,
    ).toBe(identity);
  }
  expect(
    representativeRaceCatalog.filter((entry) =>
      /illustrative/i.test(`${entry._id} ${entry.name}`),
    ),
  ).toEqual([]);
});
