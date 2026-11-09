import { expect, test } from 'vitest';
import { resolveCompanionLinkedInput } from '~/lib/character-sheet-linked-inputs';
import type {
  CohortCalculationInput,
  CohortEquivalenceState,
} from '~/lib/character-sheet-cohort';
import {
  buildSheet,
  calculateFixtureSheet as calculateCharacterSheet,
} from './character-sheet-test-fixture';
import {
  buildCohortView,
  buildLeadershipSourcesView,
  cohortCreatureChoices,
  formatCohortLevel,
  leadershipReputationChoices,
} from './character-cohort-view-model';
import { buildCompanionRelationshipView } from './character-companions-view-model';

function fixture({
  levels = 5,
  equivalence,
  leader = { level: 9, charisma: 2 },
  permanentCharisma = leader?.charisma ?? null,
  sources = [{ sourceKey: 'leadership', counting: true }],
  areModifiersUndisclosed,
}: {
  levels?: number;
  equivalence?: CohortEquivalenceState;
  leader?: { level: number | null; charisma: number | null } | null;
  permanentCharisma?: number | null;
  sources?: CohortCalculationInput['sources'];
  areModifiersUndisclosed?: true;
} = {}) {
  const snapshot = buildSheet({
    levels: Array.from({ length: levels }, (_, index) => ({
      id: `level-${index + 1}`,
      hp: 6,
    })),
  });
  const input = {
    ...snapshot,
    characterKind: snapshot.character.kind,
    ...(equivalence ? { cohortEquivalence: equivalence } : {}),
  };
  const value = (number: number | null) =>
    number === null
      ? {
          sourceKey: 'leadership',
          kind: 'unavailable' as const,
          reason: 'inaccessible' as const,
        }
      : { sourceKey: 'leadership', kind: 'available' as const, value: number };
  const options = (charisma: number | null) =>
    leader
      ? {
          cohort: {
            sources,
            linkedInputs: [
              resolveCompanionLinkedInput({
                input: { kind: 'characterLevel' },
                candidates: [value(leader.level)],
              }),
              resolveCompanionLinkedInput({
                input: { kind: 'abilityModifier', ability: 'charisma' },
                candidates: [value(charisma)],
              }),
            ],
            ...(areModifiersUndisclosed ? { areModifiersUndisclosed } : {}),
          },
        }
      : {};
  return {
    ...snapshot,
    entries: snapshot.entries.map((entry) =>
      entry.kind === 'base' && equivalence
        ? {
            ...entry,
            state: { ...entry.state, cohortEquivalence: equivalence },
          }
        : entry,
    ),
    calculated: calculateCharacterSheet(
      input,
      options(leader?.charisma ?? null),
    ),
    permanentCalculated: calculateCharacterSheet(input, {
      ...options(permanentCharisma),
      permanentOnly: true,
    }),
  };
}

test('an ordinary cohort shows its equivalence and the level its leader allows with provenance', () => {
  const view = buildCohortView(fixture());
  expect(view).toMatchObject({
    status: 'active',
    statusLabel: 'Supported by its leader',
    recorded: null,
    equivalence: {
      basisLabel: 'Class Levels',
      display: '5',
      summary: 'An ordinary cohort’s equivalence is its 5 Class Levels.',
      citationLabel: null,
    },
    leadership: {
      inputs: [
        {
          label: 'Leader’s character level',
          display: '9',
          resolutionLabel: 'Calculated',
        },
        {
          label: 'Leader’s Charisma modifier',
          display: '+2',
          resolutionLabel: 'Calculated',
        },
      ],
      modifiers: [],
      score: 11,
      scoreLevelLabel: '7th level',
      permanentScoreLevelLabel: null,
      allowedLabel: '7th level',
      permanentAllowedLabel: null,
      summary:
        'Leadership Score 11 (level 9, Charisma +2) would attract a cohort of up to 7th level now. The table applies only when a cohort is attracted; afterwards a cohort stays two or more levels below its leader.',
    },
    warnings: [],
    sources: ['Pathfinder RPG Core Rulebook, p. 129'],
  });
});

test('a published monster cohort cites its book, and only two levels below its leader limits it', () => {
  const view = buildCohortView(
    fixture({
      levels: 2,
      equivalence: { kind: 'published', creatureKey: 'griffon' },
      leader: { level: 9, charisma: -1 },
      permanentCharisma: -3,
    }),
  );
  expect(view).toMatchObject({
    recorded: { kind: 'published', creatureKey: 'griffon' },
    equivalence: {
      basisLabel: 'Published monster cohort',
      display: '10',
      summary: 'Griffon (published cohort level 8) + 2 Class Levels = 10.',
      citationLabel: 'Pathfinder RPG Bestiary',
    },
    leadership: {
      // Leader 9 allows 7th. Score 8 would attract 5th now; without the
      // temporary Charisma the score falls to 6, attracting 4th.
      allowedLabel: '7th level',
      permanentAllowedLabel: null,
      scoreLevelLabel: '5th level',
      permanentScoreLevelLabel: '4th level',
    },
    warnings: [
      expect.objectContaining({ check: 'cohortOverLevel', accepted: false }),
    ],
  });
  expect(view?.sources).toEqual([
    'Pathfinder RPG Core Rulebook, p. 129',
    'Pathfinder RPG Bestiary',
  ]);
});

test('a missing equivalence and an unavailable leader stay unresolved, and an unlinked record keeps its equivalence', () => {
  const missing = buildCohortView(
    fixture({
      equivalence: { kind: 'entered', creature: 'Hippogriff', level: null },
      leader: { level: null, charisma: null },
    }),
  );
  expect(missing).toMatchObject({
    equivalence: {
      display: 'Unresolved',
      summary:
        'Enter the equivalence for Hippogriff. Its Hit Dice and Challenge Rating are never used.',
    },
    leadership: {
      inputs: [
        { display: 'Unresolved', resolutionLabel: 'Unresolved' },
        { display: 'Unresolved', resolutionLabel: 'Unresolved' },
      ],
      allowedLabel: 'Unresolved',
      scoreLevelLabel: 'Unresolved',
      summary:
        'The leader’s character level and Charisma modifier are needed. Save fallbacks while they are unavailable.',
    },
  });
  expect(missing?.warnings.map(({ check }) => check)).toEqual([
    'cohortEquivalenceMissing',
    'cohortLeadershipUnresolved',
  ]);
  const unlinked = buildCohortView(
    fixture({
      equivalence: { kind: 'entered', creature: 'Hippogriff', level: 4 },
      leader: null,
    }),
  );
  expect(unlinked).toMatchObject({
    status: 'unlinked',
    statusLabel: 'Not linked to a leader',
    equivalence: {
      basisLabel: 'Entered equivalence',
      summary: 'Hippogriff (entered 4) + 5 Class Levels = 9.',
    },
    leadership: null,
  });
  expect(buildCohortView(fixture({ leader: null }))).toBeNull();
});

test('without access to the leader, saved fallbacks give the allowed level while the score stays unresolved', () => {
  const view = buildCohortView(
    fixture({
      sources: [{ sourceKey: 'rule:cohort', counting: true }],
      areModifiersUndisclosed: true,
    }),
  );
  expect(view).toMatchObject({
    leadership: {
      modifiers: [],
      score: null,
      scoreLevelLabel: 'Unresolved',
      allowedLabel: '7th level',
      summary:
        'The leader’s Leadership modifiers are shown only with access to the leader, so its Leadership Score and the level it would attract stay unresolved.',
    },
    warnings: [],
  });
});

test('the leader’s view previews each cohort source’s Leadership Score from its own sheet', () => {
  const leader = fixture({ levels: 10, leader: null });
  const row = buildCompanionRelationshipView({
    relationshipId: 'relationship' as never,
    role: 'companion',
    kind: 'cohort',
    status: 'active',
    interruption: null,
    endpoint: { characterId: 'cohort' as never, name: 'Bryn' },
    linkedInputs: [],
    sources: [
      {
        key: 'leadership',
        label: 'Leadership',
        enabled: true,
        available: true,
        ruleKind: 'cohort',
        leadershipModifiers: {
          reputation: ['greatRenown'],
          hasCompanion: true,
          differentAlignment: false,
          cohortDeaths: 1,
          other: 0,
        },
      },
    ],
  });
  expect(buildLeadershipSourcesView({ row, leader })).toEqual([
    expect.objectContaining({
      key: 'relationship/leadership',
      sourceLabel: 'Leadership',
      cohortName: 'Bryn',
      rows: [
        expect.objectContaining({ label: 'Great renown', display: '+2' }),
        expect.objectContaining({
          label:
            'Has a familiar, special mount, or animal companion at recruitment',
          display: '-2',
        }),
        expect.objectContaining({
          label: 'Caused the death of a cohort',
          display: '-2',
        }),
      ],
      // Level 10, Charisma +0, modifiers −2: score 8 would attract 5th.
      score: 8,
      maximumLabel: '5th level',
      summary:
        'Leadership Score 8 would attract a cohort of up to 5th level now.',
    }),
  ]);
  expect(
    buildLeadershipSourcesView({
      row: { ...row, role: 'associated' },
      leader,
    }),
  ).toEqual([]);
});

test('curated choices list the published creatures and reputation modifiers', () => {
  expect(cohortCreatureChoices).toContainEqual({
    value: 'pegasus',
    label: 'Pegasus',
    level: 6,
    book: 'Pathfinder RPG Bestiary',
  });
  expect(cohortCreatureChoices).toContainEqual(
    expect.objectContaining({
      value: 'blinkDog',
      book: 'Pathfinder RPG Bestiary 2',
    }),
  );
  expect(leadershipReputationChoices[0]).toEqual({
    value: 'greatRenown',
    label: 'Great renown',
    modifier: '+2',
  });
  expect(formatCohortLevel(0)).toBe('No cohort');
  expect(formatCohortLevel(1)).toBe('1st level');
  expect(formatCohortLevel(12)).toBe('12th level');
});
