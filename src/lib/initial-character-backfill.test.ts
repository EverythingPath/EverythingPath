import { expect, test } from 'vitest';
import type { LegacyCharacter } from './initial-character-backfill';
import {
  compareLegacyCharacterCandidate,
  mapLegacyCharacter,
  maxLegacyCharacterCandidateBytes,
} from './initial-character-backfill';
import {
  calculateCharacterSheetProjections,
  type CharacterSheetInput,
} from './character-sheet';

const character: LegacyCharacter = {
  _id: 'character-one',
  name: 'Aubrin',
  description: 'Recorded notes',
  ownerId: 'owner-one',
  campaignId: 'campaign-one',
  kind: 'npc',
  isActive: false,
  level: 3,
  strength: 7,
  dexterity: 13,
  constitution: 14,
  intelligence: 15,
  wisdom: 18,
  charisma: 21,
};

test('maps recorded scores and ordered Unspecified Class Levels without guessing a build', () => {
  const candidate = mapLegacyCharacter({ character, hasMilitia: true });
  expect(candidate.sheetMode).toBe('militiaOnly');
  expect(candidate.input.characterKind).toBe('npc');
  expect(candidate.input.entries).toMatchObject([
    {
      kind: 'base',
      active: true,
      state: {
        kind: 'base',
        abilityMethod: { kind: 'rolled' },
        traitCount: 2,
        campaignTraitRequired: false,
      },
    },
    {
      kind: 'classLevel',
      state: { position: 1, classEntryId: null, hpGained: null },
    },
    {
      kind: 'classLevel',
      state: { position: 2, classEntryId: null, hpGained: null },
    },
    {
      kind: 'classLevel',
      state: { position: 3, classEntryId: null, hpGained: null },
    },
  ]);
  const result = calculateCharacterSheetProjections(candidate.input).permanent;
  expect(result).toMatchObject({
    level: 3,
    hitDice: 3,
    hp: null,
    breakdowns: { bab: { total: 0 } },
    abilities: {
      strength: { score: 7, modifier: -2 },
      dexterity: { score: 13, modifier: 1 },
      constitution: { score: 14, modifier: 2 },
      intelligence: { score: 15, modifier: 2 },
      wisdom: { score: 18, modifier: 4 },
      charisma: { score: 21, modifier: 5 },
    },
  });
});

test('scopes every candidate entry identity to its Character', () => {
  const first = mapLegacyCharacter({ character, hasMilitia: true });
  const second = mapLegacyCharacter({
    character: { ...character, _id: 'character-two' },
    hasMilitia: true,
  });
  expect(first.input.entries.map(({ _id }) => _id)).toEqual([
    'legacy:base:character-one',
    'legacy:level:character-one:1',
    'legacy:level:character-one:2',
    'legacy:level:character-one:3',
  ]);
  expect(second.input.entries.map(({ _id }) => _id)).toEqual([
    'legacy:base:character-two',
    'legacy:level:character-two:1',
    'legacy:level:character-two:2',
    'legacy:level:character-two:3',
  ]);
});

test.each([
  { campaignId: 'campaign-one', hasMilitia: true, mode: 'militiaOnly' },
  { campaignId: 'campaign-one', hasMilitia: false, mode: 'full' },
  { campaignId: undefined, hasMilitia: true, mode: 'full' },
  { campaignId: undefined, hasMilitia: false, mode: 'full' },
])(
  'uses eligible presentation in $mode with campaign $campaignId',
  ({ campaignId, hasMilitia, mode }) => {
    const recorded = Object.freeze({
      ...character,
      campaignId,
      ownerId: undefined,
    });
    const before = structuredClone(recorded);
    const candidate = mapLegacyCharacter({ character: recorded, hasMilitia });
    expect(candidate.sheetMode).toBe(mode);
    expect(candidate.input.sheetMode).toBe(mode);
    expect(recorded).toEqual(before);
    expect(recorded).toMatchObject({
      _id: 'character-one',
      name: 'Aubrin',
      description: 'Recorded notes',
      kind: 'npc',
      isActive: false,
      ownerId: undefined,
    });
  },
);

test.each([0, 1, 21, 4095])(
  'preserves a recorded level of %i and stable candidate identities',
  (level) => {
    const recorded: LegacyCharacter = {
      ...character,
      level,
      kind: 'pc',
      strength: -2,
    };
    const first = mapLegacyCharacter({ character: recorded, hasMilitia: true });
    expect(
      mapLegacyCharacter({ character: recorded, hasMilitia: true }),
    ).toEqual(first);
    expect(first.input.entries).toHaveLength(level + 1);
    expect(first.input.characterKind).toBe('pc');
    expect(
      new TextEncoder().encode(JSON.stringify(first)).byteLength,
    ).toBeLessThanOrEqual(maxLegacyCharacterCandidateBytes);
    expect(
      compareLegacyCharacterCandidate({
        character: recorded,
        input: first.input,
      }).equal,
    ).toBe(true);
  },
);

test('maps every recorded identity without truncation before the batch storage size check', () => {
  const recorded = {
    ...character,
    _id: 'x'.repeat(maxLegacyCharacterCandidateBytes),
  };
  const candidate = mapLegacyCharacter({
    character: recorded,
    hasMilitia: true,
  });
  expect(candidate.input.entries[0]?._id).toBe(`legacy:base:${recorded._id}`);
  expect(candidate.input.entries[3]?._id).toBe(
    `legacy:level:${recorded._id}:3`,
  );
  expect(recorded._id).toHaveLength(maxLegacyCharacterCandidateBytes);
});

test('checks preserved sheet effects through the public permanent resolver', () => {
  const candidate = mapLegacyCharacter({ character, hasMilitia: true });
  const input: CharacterSheetInput = {
    ...candidate.input,
    entries: [
      ...candidate.input.entries,
      {
        _id: 'recorded-drain',
        kind: 'abilityDrain',
        active: true,
        state: {
          kind: 'abilityDrain',
          ability: 'constitution',
          points: 3,
        },
      },
      {
        _id: 'recorded-damage',
        kind: 'abilityDamage',
        active: true,
        state: {
          kind: 'abilityDamage',
          ability: 'charisma',
          points: 4,
        },
      },
    ],
  };
  const before = structuredClone(input);
  expect(compareLegacyCharacterCandidate({ character, input })).toMatchObject({
    equal: false,
    mismatches: [
      { source: 'legacy', field: 'constitution', expected: 14, actual: 11 },
    ],
    flat: { constitution: 11, charisma: 21 },
  });
  expect(input).toEqual(before);
});

test.each([
  { field: 'level', expected: 4, actual: 3 },
  { field: 'strength', expected: 8, actual: 7 },
  { field: 'dexterity', expected: 14, actual: 13 },
  { field: 'constitution', expected: 15, actual: 14 },
  { field: 'intelligence', expected: 16, actual: 15 },
  { field: 'wisdom', expected: 19, actual: 18 },
  { field: 'charisma', expected: 22, actual: 21 },
  { field: 'kind', expected: 'pc', actual: 'npc' },
])(
  'reports exact flat $field differences without rewriting inputs',
  ({ field, expected, actual }) => {
    const candidate = mapLegacyCharacter({ character, hasMilitia: true });
    const recorded: LegacyCharacter = { ...character, [field]: expected };
    const before = structuredClone(candidate);
    expect(
      compareLegacyCharacterCandidate({
        character: recorded,
        input: candidate.input,
      }),
    ).toMatchObject({
      equal: false,
      mismatches: [{ source: 'legacy', field, expected, actual }],
    });
    expect(candidate).toEqual(before);
  },
);

test.each([
  {
    field: 'characterId',
    expected: 'other-character',
    actual: 'character-one',
  },
  { field: 'level', expected: 4, actual: 3 },
  { field: 'strength', expected: 8, actual: 7 },
  { field: 'dexterity', expected: 14, actual: 13 },
  { field: 'constitution', expected: 15, actual: 14 },
  { field: 'intelligence', expected: 16, actual: 15 },
  { field: 'wisdom', expected: 19, actual: 18 },
  { field: 'charisma', expected: 22, actual: 21 },
  { field: 'isActive', expected: true, actual: false },
])(
  'reports exact current facts $field differences without correcting mirrors',
  ({ field, expected, actual }) => {
    const candidate = mapLegacyCharacter({ character, hasMilitia: true });
    const baseline = compareLegacyCharacterCandidate({
      character,
      input: candidate.input,
    }).facts;
    const mirror = { ...baseline, [field]: expected };
    const before = structuredClone(mirror);
    expect(
      compareLegacyCharacterCandidate({
        character,
        input: candidate.input,
        facts: [baseline, mirror],
      }),
    ).toMatchObject({
      equal: false,
      mismatches: [
        { source: 'facts', field: `facts[1].${field}`, expected, actual },
      ],
    });
    expect(mirror).toEqual(before);
  },
);

test('compares the resolved candidate with flat values and every current facts mirror', () => {
  const candidate = mapLegacyCharacter({ character, hasMilitia: true });
  const facts = {
    characterId: 'character-one',
    level: 3,
    strength: 7,
    dexterity: 13,
    constitution: 14,
    intelligence: 15,
    wisdom: 18,
    charisma: 21,
    isActive: false,
  };
  const result = compareLegacyCharacterCandidate({
    character,
    input: candidate.input,
    facts: [facts, { ...facts }],
  });
  expect(result).toEqual({
    equal: true,
    mismatches: [],
    flat: {
      level: 3,
      strength: 7,
      dexterity: 13,
      constitution: 14,
      intelligence: 15,
      wisdom: 18,
      charisma: 21,
    },
    facts,
  });
});

test.each([
  { field: 'level', value: -1 },
  { field: 'level', value: 1.5 },
  { field: 'level', value: 4096 },
  { field: 'strength', value: 12.5 },
  { field: 'dexterity', value: Infinity },
  { field: 'constitution', value: Number.NaN },
  { field: 'intelligence', value: Number.MAX_SAFE_INTEGER + 1 },
  { field: 'wisdom', value: Number.NEGATIVE_INFINITY },
  { field: 'charisma', value: -10.1 },
])(
  'reports invalid recorded $field without normalizing it: $value',
  ({ field, value }) => {
    const recorded = { ...character, [field]: value };
    const before = structuredClone(recorded);
    expect(() =>
      mapLegacyCharacter({ character: recorded, hasMilitia: true }),
    ).toThrow(field);
    expect(recorded).toEqual(before);
  },
);

function withRace(input: CharacterSheetInput, count: number) {
  return {
    ...input,
    entries: [
      ...input.entries,
      {
        _id: 'recorded-race',
        kind: 'race',
        active: true,
        catalogEntryId: 'race',
        state: { kind: 'race', racialHpGained: 7 },
      },
    ],
    catalogEntries: [
      ...input.catalogEntries,
      {
        _id: 'race',
        name: 'Recorded race',
        ruleIdentity: 'recorded-race',
        modifiers: [],
        detail: { kind: 'race', racialTraits: [], racialHitDice: count },
      },
    ],
  } satisfies CharacterSheetInput;
}

test('reports a racial Hit Dice difference from current facts without correcting mirrors', () => {
  const candidate = mapLegacyCharacter({ character, hasMilitia: true });
  const input = withRace(candidate.input, 2);
  const result = compareLegacyCharacterCandidate({ character, input });
  expect(result.facts.racialHitDice).toBe(2);
  const mirror = { ...result.facts };
  delete mirror.racialHitDice;
  const stale = { ...result.facts, racialHitDice: 1 };
  const before = structuredClone([mirror, stale]);
  expect(
    compareLegacyCharacterCandidate({
      character,
      input,
      facts: [result.facts, mirror, stale],
    }),
  ).toMatchObject({
    equal: false,
    mismatches: [
      {
        source: 'facts',
        field: 'facts[1].racialHitDice',
        expected: 0,
        actual: 2,
      },
      {
        source: 'facts',
        field: 'facts[2].racialHitDice',
        expected: 1,
        actual: 2,
      },
    ],
  });
  expect([mirror, stale]).toEqual(before);
});

test('treats absent racial Hit Dice as zero for legacy-mapped Characters', () => {
  const candidate = mapLegacyCharacter({ character, hasMilitia: true });
  const result = compareLegacyCharacterCandidate({
    character,
    input: candidate.input,
  });
  expect(result.facts).not.toHaveProperty('racialHitDice');
  expect(
    compareLegacyCharacterCandidate({
      character,
      input: candidate.input,
      facts: [result.facts, { ...result.facts, racialHitDice: 0 }],
    }),
  ).toMatchObject({ equal: true, mismatches: [] });
  expect(
    compareLegacyCharacterCandidate({
      character,
      input: withRace(candidate.input, 0),
      facts: [result.facts, { ...result.facts, racialHitDice: 0 }],
    }),
  ).toMatchObject({ equal: true, mismatches: [] });
});
