import { expect, test } from 'vitest';
import {
  calculateCharacterSheet,
  type CharacterSheetInput,
  type SheetEntry,
} from './character-sheet';
import {
  resolveCompanionLinkedInput,
  type CompanionLinkedInputResolution,
} from './character-sheet-linked-inputs';
import {
  calculateLeadership,
  noLeadershipModifiers,
  type CohortCalculationInput,
  type CohortEquivalenceState,
} from './character-sheet-cohort';
import { cohortCalculationInputSchema } from './character-sheet-cohort-schema';
import {
  leadershipCohortLevel,
  monsterCohorts,
} from './catalog/representative-cohorts';
import {
  prerequisiteSheet,
  selectedFeat,
} from './character-sheet-prerequisite-fixture';

// CRB p. 129, Leadership: "Your base Leadership score equals your level plus
// your Charisma modifier." "Regardless of your Leadership score, you can only
// recruit a cohort who is two or more levels lower than yourself."

/** A cohort with the given number of fighter Class Levels. */
function cohort({
  levels = 1,
  racialHitDice = 0,
  equivalence,
}: {
  levels?: number;
  racialHitDice?: number;
  equivalence?: CohortEquivalenceState;
} = {}): CharacterSheetInput {
  const input = prerequisiteSheet(
    Array.from(
      { length: Math.max(0, levels - 1) },
      (_, index): SheetEntry => ({
        _id: `level-${index + 2}`,
        kind: 'classLevel',
        active: true,
        state: {
          kind: 'classLevel',
          position: index + 2,
          classEntryId: 'fighter',
          hpGained: 6,
        },
      }),
    ),
  );
  if (levels === 0)
    input.entries = input.entries.filter(
      (entry) => entry.kind !== 'classLevel',
    );
  if (racialHitDice) {
    input.entries = [
      ...input.entries,
      {
        _id: 'race-row',
        kind: 'race',
        active: true,
        catalogEntryId: 'pegasus-race',
        state: { kind: 'race', racialHpGained: 19 },
      },
    ];
    input.catalogEntries = [
      ...input.catalogEntries,
      {
        _id: 'pegasus-race',
        name: 'Pegasus',
        ruleIdentity: 'custom/pegasus',
        modifiers: [],
        detail: {
          kind: 'race',
          racialTraits: [],
          racialHitDice,
          racialProgression: {
            creatureType: 'magicalBeast',
            hitDie: 10,
            bab: 'full',
            saves: { fort: 'good', ref: 'good', will: 'poor' },
            skillRanksPerHitDie: 2,
            classSkills: [],
          },
        },
      },
    ];
  }
  return equivalence ? { ...input, cohortEquivalence: equivalence } : input;
}

type Leader = {
  level: number | null;
  charisma: number | null;
  fallback?: { level?: number; charisma?: number };
};
function leaderInputs(
  { level, charisma, fallback = {} }: Leader,
  sourceKeys = ['leadership'],
): CompanionLinkedInputResolution[] {
  const candidates = (value: number | null) =>
    sourceKeys.map((sourceKey) =>
      value === null
        ? {
            sourceKey,
            kind: 'unavailable' as const,
            reason: 'inaccessible' as const,
          }
        : { sourceKey, kind: 'available' as const, value },
    );
  return [
    resolveCompanionLinkedInput({
      input: { kind: 'characterLevel' },
      candidates: candidates(level),
      ...(fallback.level === undefined ? {} : { fallback: fallback.level }),
    }),
    resolveCompanionLinkedInput({
      input: { kind: 'abilityModifier', ability: 'charisma' },
      candidates: candidates(charisma),
      ...(fallback.charisma === undefined
        ? {}
        : { fallback: fallback.charisma }),
    }),
  ];
}
function linked(
  leader: Leader,
  sources: CohortCalculationInput['sources'] = [
    { sourceKey: 'leadership', counting: true },
  ],
): { cohort: CohortCalculationInput } {
  return {
    cohort: {
      sources,
      linkedInputs: leaderInputs(
        leader,
        sources.filter((source) => source.counting).map((s) => s.sourceKey),
      ),
    },
  };
}
function checks(result: ReturnType<typeof calculateCharacterSheet>) {
  return result.warnings
    .map((warning) => warning.check)
    .filter((check) => check.startsWith('cohort'));
}

test('the CRB Leadership table maps every score to its cohort level', () => {
  // CRB p. 129, Table: Leadership; "1 or lower" attracts no cohort.
  const table: [number, number][] = [
    [-3, 0],
    [1, 0],
    [2, 1],
    [3, 2],
    [4, 3],
    [5, 3],
    [6, 4],
    [7, 5],
    [8, 5],
    [9, 6],
    [10, 7],
    [11, 7],
    [12, 8],
    [13, 9],
    [14, 10],
    [15, 10],
    [16, 11],
    [17, 12],
    [18, 12],
    [19, 13],
    [20, 14],
    [21, 15],
    [22, 15],
    [23, 16],
    [24, 17],
    [25, 17],
    [31, 17],
  ];
  expect(table.map(([score]) => [score, leadershipCohortLevel(score)])).toEqual(
    table,
  );
});

test('an ordinary cohort’s equivalence is its own Class Levels, within the leader’s Leadership Score and level', () => {
  // Leader 9 with Cha +2: score 11 gives 7th; 9 − 2 also allows 7th.
  const result = calculateCharacterSheet(
    cohort({ levels: 5 }),
    linked({ level: 9, charisma: 2 }),
  );
  expect(result.level).toBe(5);
  expect(result.hitDice).toBe(5);
  expect(result.cohort).toMatchObject({
    status: 'active',
    equivalence: {
      basis: 'classLevels',
      classLevels: 5,
      creatureLevel: null,
      value: 5,
      missing: false,
    },
    leadership: {
      characterLevel: { value: 9, resolution: 'calculated' },
      charismaModifier: { value: 2, resolution: 'calculated' },
      modifierTotal: 0,
      score: 11,
      scoreLevel: 7,
      leaderLevelLimit: 7,
      maximumLevel: 7,
    },
    overLevel: false,
  });
  expect(result.cohort?.sources).toContainEqual(
    expect.objectContaining({
      book: 'Pathfinder RPG Core Rulebook',
      pages: '129',
    }),
  );
  expect(checks(result)).toEqual([]);
});

test('recorded Leadership modifiers adjust the score with their provenance', () => {
  const result = calculateCharacterSheet(
    cohort({ levels: 5 }),
    linked({ level: 12, charisma: 3 }, [
      {
        sourceKey: 'leadership',
        counting: true,
        leadershipModifiers: {
          reputation: ['greatRenown', 'fairnessAndGenerosity', 'cruelty'],
          hasCompanion: true,
          differentAlignment: true,
          cohortDeaths: 2,
          other: 1,
        },
      },
    ]),
  );
  // 12 + 3 + 2 + 1 − 2 − 2 − 1 − 4 + 1 = 10, giving 7th; 12 − 2 allows 10th.
  expect(result.cohort?.leadership).toMatchObject({
    modifiers: [
      { key: 'greatRenown', label: 'Great renown', value: 2 },
      {
        key: 'fairnessAndGenerosity',
        label: 'Fairness and generosity',
        value: 1,
      },
      { key: 'cruelty', label: 'Cruelty', value: -2 },
      {
        key: 'hasCompanion',
        label:
          'Has a familiar, special mount, or animal companion at recruitment',
        value: -2,
      },
      {
        key: 'differentAlignment',
        label: 'Recruits a cohort of a different alignment',
        value: -1,
      },
      {
        key: 'cohortDeaths',
        label: 'Caused the death of 2 cohorts',
        value: -4,
      },
      { key: 'other', label: 'Other modifiers', value: 1 },
    ],
    modifierTotal: -5,
    score: 10,
    scoreLevel: 7,
    leaderLevelLimit: 10,
    maximumLevel: 7,
  });
});

test('a cohort above two levels below its leader keeps its Class Levels and warns', () => {
  // Leader 7, Cha +0: score 7 would attract 5th now, and 7 − 2 allows 5th.
  const over = calculateCharacterSheet(
    cohort({ levels: 6 }),
    linked({ level: 7, charisma: 0 }),
  );
  expect(over.level).toBe(6);
  expect(over.cohort).toMatchObject({
    equivalence: { value: 6 },
    leadership: { scoreLevel: 5, leaderLevelLimit: 5, maximumLevel: 5 },
    overLevel: true,
  });
  expect(checks(over)).toEqual(['cohortOverLevel']);
  const message = over.warnings.find(
    ({ check }) => check === 'cohortOverLevel',
  )?.message;
  expect(message).toContain('two or more levels below its leader');
  expect(message).not.toContain('Leadership Score');
});

test('after recruitment the table is information: an advanced cohort above it but two levels below its leader does not warn', () => {
  // CRB p. 129 consults Table: Leadership only when attracting a cohort.
  // Leader 12, Cha −1, cruelty: score 9 would attract 6th now; the cohort
  // advanced to 8th, still two or more levels below its leader (10th).
  const advanced = calculateCharacterSheet(
    cohort({ levels: 8 }),
    linked({ level: 12, charisma: -1 }, [
      {
        sourceKey: 'leadership',
        counting: true,
        leadershipModifiers: {
          ...noLeadershipModifiers,
          reputation: ['cruelty'],
        },
      },
    ]),
  );
  expect(advanced.cohort).toMatchObject({
    equivalence: { value: 8 },
    leadership: { score: 9, scoreLevel: 6, leaderLevelLimit: 10 },
    overLevel: false,
  });
  expect(checks(advanced)).toEqual([]);
  // A score of 1 or lower would attract no cohort now; the cohort stays.
  const none = calculateCharacterSheet(
    cohort({ levels: 1 }),
    linked({ level: 3, charisma: -2 }),
  );
  expect(none.cohort).toMatchObject({
    leadership: {
      score: 1,
      scoreLevel: 0,
      leaderLevelLimit: 1,
      maximumLevel: 0,
    },
    overLevel: false,
  });
  expect(checks(none)).toEqual([]);
});

test('a published monster cohort adds its Class Levels to the mapping, never its Hit Dice or Challenge Rating', () => {
  // Bestiary Monster Cohorts: pegasus is cohort level 6 with four racial HD.
  const result = calculateCharacterSheet(
    cohort({
      levels: 1,
      racialHitDice: 4,
      equivalence: { kind: 'published', creatureKey: 'pegasus' },
    }),
    linked({ level: 11, charisma: 3 }),
  );
  expect(result.level).toBe(1);
  expect(result.hitDice).toBe(5);
  expect(result.cohort).toMatchObject({
    equivalence: {
      basis: 'published',
      creatureKey: 'pegasus',
      creature: 'Pegasus',
      creatureLevel: 6,
      classLevels: 1,
      value: 7,
      missing: false,
      citation: {
        book: 'Pathfinder RPG Bestiary',
        url: 'https://legacy.aonprd.com/bestiary/monsterCohorts.html',
      },
    },
    // Score 14 gives 10th; 11 − 2 allows 9th.
    leadership: { maximumLevel: 9 },
    overLevel: false,
  });
  expect(monsterCohorts.pegasus).toMatchObject({ name: 'Pegasus', level: 6 });
});

test('an unlisted creature uses its explicitly entered equivalence, and a missing one stays unresolved', () => {
  const entered = calculateCharacterSheet(
    cohort({
      levels: 0,
      racialHitDice: 3,
      equivalence: { kind: 'entered', creature: 'Hippogriff', level: 4 },
    }),
    linked({ level: 9, charisma: 1 }),
  );
  expect(entered.cohort?.equivalence).toMatchObject({
    basis: 'entered',
    creature: 'Hippogriff',
    creatureKey: null,
    creatureLevel: 4,
    classLevels: 0,
    value: 4,
    citation: null,
  });
  expect(checks(entered)).toEqual([]);
  const missing = calculateCharacterSheet(
    cohort({
      levels: 2,
      racialHitDice: 3,
      equivalence: { kind: 'entered', creature: 'Hippogriff', level: null },
    }),
    linked({ level: 9, charisma: 1 }),
  );
  expect(missing.level).toBe(2);
  expect(missing.hitDice).toBe(5);
  expect(missing.cohort).toMatchObject({
    equivalence: { basis: 'entered', value: null, missing: true },
    leadership: { maximumLevel: 7 },
    overLevel: false,
  });
  expect(checks(missing)).toEqual(['cohortEquivalenceMissing']);
  expect(
    missing.warnings.find(({ check }) => check === 'cohortEquivalenceMissing'),
  ).toMatchObject({ kind: 'unresolved' });
});

test('a cohort with Racial Hit Dice and no recorded equivalence never falls back to its Hit Dice', () => {
  const result = calculateCharacterSheet(
    cohort({ levels: 1, racialHitDice: 4 }),
    linked({ level: 20, charisma: 5 }),
  );
  expect(result.hitDice).toBe(5);
  expect(result.cohort?.equivalence).toMatchObject({
    basis: 'classLevels',
    value: null,
    missing: true,
  });
  expect(checks(result)).toEqual(['cohortEquivalenceMissing']);
});

test('an unavailable leader leaves the allowed level unresolved until saved fallbacks supply it', () => {
  const hidden = calculateCharacterSheet(
    cohort({ levels: 5 }),
    linked({ level: null, charisma: null }),
  );
  expect(hidden.cohort).toMatchObject({
    status: 'active',
    equivalence: { value: 5 },
    leadership: {
      characterLevel: { value: null, resolution: 'unresolved' },
      score: null,
      scoreLevel: null,
      leaderLevelLimit: null,
      maximumLevel: null,
    },
    overLevel: false,
  });
  expect(checks(hidden)).toEqual(['cohortLeadershipUnresolved']);
  const partial = calculateCharacterSheet(
    cohort({ levels: 5 }),
    linked({ level: null, charisma: null, fallback: { level: 9 } }),
  );
  // The leader level limit needs only the level; the score needs both.
  expect(partial.cohort?.leadership).toMatchObject({
    score: null,
    leaderLevelLimit: 7,
    maximumLevel: null,
  });
  const fallback = calculateCharacterSheet(
    cohort({ levels: 5 }),
    linked({
      level: null,
      charisma: null,
      fallback: { level: 9, charisma: 2 },
    }),
  );
  expect(fallback.cohort?.leadership).toMatchObject({
    characterLevel: {
      value: 9,
      resolution: 'fallback',
      fallbackState: 'applied',
    },
    charismaModifier: { value: 2, resolution: 'fallback' },
    score: 11,
    maximumLevel: 7,
  });
  expect(checks(fallback)).toEqual([]);
});

test('without counting support the cohort keeps its equivalence and choices but has no allowed level', () => {
  const modifiers = {
    ...noLeadershipModifiers,
    reputation: ['greatRenown' as const],
  };
  const dormant = calculateCharacterSheet(
    cohort({
      levels: 9,
      equivalence: { kind: 'entered', creature: 'Hippogriff', level: 4 },
    }),
    linked({ level: 9, charisma: 0 }, [
      {
        sourceKey: 'leadership',
        counting: false,
        leadershipModifiers: modifiers,
      },
    ]),
  );
  expect(dormant.level).toBe(9);
  expect(dormant.cohort).toMatchObject({
    status: 'dormant',
    equivalence: { basis: 'entered', value: 13 },
    leadership: null,
    overLevel: false,
  });
  expect(checks(dormant)).toEqual([]);
  // A recorded equivalence on a Character with no cohort relationship.
  const unlinked = calculateCharacterSheet(
    cohort({
      levels: 2,
      equivalence: { kind: 'published', creatureKey: 'worg' },
    }),
  );
  expect(unlinked.cohort).toMatchObject({
    status: 'unlinked',
    equivalence: { value: 7 },
    leadership: null,
  });
  expect(calculateCharacterSheet(cohort({ levels: 2 })).cohort).toBeNull();
});

test('differing Leadership modifiers on two counting sources leave the score unresolved rather than picking one', () => {
  const result = calculateCharacterSheet(
    cohort({ levels: 5 }),
    linked({ level: 12, charisma: 2 }, [
      {
        sourceKey: 'leadership',
        counting: true,
        leadershipModifiers: {
          ...noLeadershipModifiers,
          reputation: ['greatRenown'],
        },
      },
      {
        sourceKey: 'second',
        counting: true,
        leadershipModifiers: {
          ...noLeadershipModifiers,
          reputation: ['cruelty'],
        },
      },
    ]),
  );
  expect(result.cohort?.leadership).toMatchObject({
    conflict: true,
    score: null,
    maximumLevel: null,
    leaderLevelLimit: 10,
  });
  expect(checks(result)).toEqual(['cohortLeadershipUnresolved']);
  // Agreeing sources calculate.
  const agreeing = calculateCharacterSheet(
    cohort({ levels: 5 }),
    linked({ level: 12, charisma: 2 }, [
      { sourceKey: 'leadership', counting: true },
      {
        sourceKey: 'second',
        counting: true,
        leadershipModifiers: noLeadershipModifiers,
      },
    ]),
  );
  expect(agreeing.cohort?.leadership).toMatchObject({
    conflict: false,
    score: 14,
  });
});

test('a cohort’s own prerequisites read its own Character level, never the leader’s', () => {
  const input = cohort({ levels: 1 });
  input.entries = [...input.entries, selectedFeat('veteran')];
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'veteran',
      ruleIdentity: 'feat/veteran',
      modifiers: [],
      detail: { kind: 'feat' },
      prerequisites: [{ characterLevel: 3 }],
    },
  ];
  const result = calculateCharacterSheet(
    input,
    linked({ level: 12, charisma: 2 }),
  );
  expect(
    result.prerequisites
      .filter(({ view }) => view === 'current')
      .map(({ met }) => met),
  ).toEqual([false]);
});

test('the pure Leadership calculation is shared with the leader’s own view', () => {
  expect(
    calculateLeadership({
      characterLevel: 10,
      charismaModifier: 4,
      modifiers: { ...noLeadershipModifiers, reputation: ['specialPower'] },
    }),
  ).toMatchObject({
    score: 15,
    scoreLevel: 10,
    leaderLevelLimit: 8,
    maximumLevel: 8,
  });
});

test('undisclosed Leadership modifiers cannot travel with a source’s recorded modifiers', () => {
  const source = { sourceKey: 'rule:cohort', counting: true };
  expect(
    cohortCalculationInputSchema.safeParse({
      sources: [source],
      linkedInputs: [],
      areModifiersUndisclosed: true,
    }).success,
  ).toBe(true);
  expect(
    cohortCalculationInputSchema.safeParse({
      sources: [{ ...source, leadershipModifiers: noLeadershipModifiers }],
      linkedInputs: [],
      areModifiersUndisclosed: true,
    }).success,
  ).toBe(false);
});
