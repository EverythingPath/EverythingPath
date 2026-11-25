import type { Id } from '@convex/_generated/dataModel';
import { expect, test } from 'vitest';
import type { AnimalCompanionProgressionState } from '~/lib/character-sheet-companion-progression';
import { resolveCompanionLinkedInput } from '~/lib/character-sheet-linked-inputs';
import { representativeAnimalCompanions } from '~/lib/catalog/representative-animal-companions';
import {
  buildSheet,
  calculateFixtureSheet as calculateCharacterSheet,
} from './character-sheet-test-fixture';
import { buildCompanionProgressionView } from './character-companion-progression-view-model';
import {
  buildCompanionAllocationPoolView,
  contributionFamilyLabel,
  formatCount,
  type CompanionAllocationPoolRow,
} from './character-companion-allocations-view-model';

const pool = {
  kind: 'allocation',
  ruleKind: 'beastMasterCompanion',
  label: 'Beast Master',
  classRuleIdentity: 'ranger',
  classLevels: 7,
  budget: 4,
  allocated: 6,
  remaining: -2,
  overBudget: true,
  restriction:
    'Beast Master divides its effective druid level among its animal companions and may choose any animal companion a druid can.',
  sources: [
    {
      book: 'Pathfinder RPG Advanced Player’s Guide',
      pages: '124',
      url: 'https://legacy.aonprd.com/advancedPlayersGuide/coreClasses/ranger.html#beast-master',
    },
  ],
  members: [
    {
      relationshipId: 'fang' as Id<'companionRelationship'>,
      sourceKey: 'beast-master',
      levels: 4,
      counting: true,
      companion: { characterId: 'wolf' as Id<'character'>, name: 'Fang' },
      lastOperationId: 'op',
    },
    {
      relationshipId: 'hidden' as Id<'companionRelationship'>,
      sourceKey: 'beast-master',
      levels: 2,
      counting: true,
      companion: null,
    },
    {
      relationshipId: 'resting' as Id<'companionRelationship'>,
      sourceKey: 'beast-master',
      levels: null,
      counting: false,
      companion: { characterId: 'claw' as Id<'character'>, name: 'Claw' },
    },
  ],
} satisfies CompanionAllocationPoolRow;

test('a divided budget shows its provenance, each companion’s share and an over-budget warning', () => {
  expect(buildCompanionAllocationPoolView({ pool })).toMatchObject({
    key: 'beastMasterCompanion',
    label: 'Beast Master',
    budgetSourceLabel: 'Ranger 7',
    budgetLabel: '4 effective levels',
    allocatedLabel: '6 allocated',
    remainingLabel: '2 over budget',
    citations: ['Pathfinder RPG Advanced Player’s Guide, p. 124'],
    warning:
      'Allocations total 6 effective levels, above the Beast Master budget of 4. Every recorded allocation is kept; change one yourself if needed.',
    suggestedLevels: null,
    members: [
      {
        key: 'fang/beast-master',
        name: 'Fang',
        href: '/characters/wolf',
        kind: 'allocation',
        levelsLabel: '4 levels',
        stateLabel: null,
      },
      {
        key: 'hidden/beast-master',
        name: 'Character unavailable',
        href: null,
        kind: 'allocation',
        levelsLabel: '2 levels',
      },
      {
        key: 'resting/beast-master',
        name: 'Claw',
        levelsLabel: 'Not allocated',
        stateLabel:
          'Not counting while its support or relationship is inactive; its allocation is kept.',
      },
    ],
  });
});

test('an unresolved budget and a one-companion-per-selection increase say so without inventing numbers', () => {
  expect(
    buildCompanionAllocationPoolView({
      pool: {
        ...pool,
        classLevels: null,
        budget: null,
        allocated: 2,
        remaining: null,
        overBudget: false,
      },
    }),
  ).toMatchObject({
    budgetSourceLabel: 'Ranger level unavailable',
    budgetLabel: 'Unresolved',
    remainingLabel: null,
    warning: null,
  });
  expect(
    buildCompanionAllocationPoolView({
      pool: { ...pool, allocated: 3, remaining: 1, overBudget: false },
    }),
  ).toMatchObject({ remainingLabel: '1 unallocated', suggestedLevels: 1 });
  const boon = {
    ...pool,
    kind: 'increase',
    ruleKind: 'boonCompanion',
    label: 'Boon Companion',
    budget: 1,
    allocated: 2,
    overBudget: true,
    members: pool.members.map(({ levels: _levels, ...member }) => member),
  } satisfies CompanionAllocationPoolRow;
  const increase = buildCompanionAllocationPoolView({ pool: boon });
  expect(increase).toMatchObject({
    kind: 'increase',
    budgetSourceLabel: '1 selection',
    budgetLabel: 'One companion each',
    allocatedLabel: 'Supports 2 companions',
    remainingLabel: null,
    warning:
      'Boon Companion applies to one companion per selection but supports 2 on 1 selection. Each keeps the benefit until you remove a source.',
    members: [{ kind: 'increase' }, {}, {}],
  });
  expect(increase.members[0]).not.toHaveProperty('levelsLabel');
  expect(
    buildCompanionAllocationPoolView({
      pool: { ...boon, budget: 2, overBudget: false },
    }),
  ).toMatchObject({ budgetSourceLabel: '2 selections', warning: null });
});

test('counts read “1 level” and “2 levels”', () => {
  expect([0, 1, 2].map((count) => formatCount(count, 'level'))).toEqual([
    '0 levels',
    '1 level',
    '2 levels',
  ]);
});

test('the companion sheet explains its share of a divided budget', () => {
  const choices: AnimalCompanionProgressionState = {
    species: 'wolf',
    hpGained: 10,
    skillRanks: {},
    abilityIncreases: [],
    advancementChoice: 'species',
    keep: false,
  };
  const snapshot = buildSheet({
    levels: [],
    scores: representativeAnimalCompanions.wolf.scores,
  });
  const input = {
    ...snapshot,
    characterKind: snapshot.character.kind,
    companionProgression: choices,
  };
  const options = {
    companionProgressionSources: [
      {
        sourceKey: 'beast-master',
        ruleKind: 'beastMasterCompanion' as const,
        counting: true,
        allocatedLevels: 2,
        pool: { allocated: 6, companions: 2, selections: 1 },
      },
    ],
    companionLinkedInputs: [
      resolveCompanionLinkedInput({
        input: { kind: 'classLevels', classRuleIdentity: 'ranger' },
        candidates: [
          { sourceKey: 'beast-master', kind: 'available', value: 7 },
        ],
      }),
    ],
  };
  const view = buildCompanionProgressionView({
    ...snapshot,
    entries: snapshot.entries.map((entry) =>
      entry.kind === 'base'
        ? { ...entry, state: { ...entry.state, companionProgression: choices } }
        : entry,
    ),
    calculated: calculateCharacterSheet(input, options),
    permanentCalculated: calculateCharacterSheet(input, {
      ...options,
      permanentOnly: true,
    }),
  });
  expect(view?.ordinary.contributions).toMatchObject([
    {
      sourceLabel: 'Beast Master',
      allocationSummary:
        '2 of 4 effective levels allocated here; 6 allocated across 2 companions.',
    },
  ]);
  expect(view?.ordinary.warnings).toContainEqual(
    expect.objectContaining({ check: 'companionAllocationBudget' }),
  );
});

test('an increase reads its level from character level, never an internal family', () => {
  expect(
    contributionFamilyLabel({
      kind: 'increase',
      classRuleIdentity: 'boonCompanion',
    }),
  ).toBe('Character level');
  expect(
    contributionFamilyLabel({ kind: 'ordinary', classRuleIdentity: 'ranger' }),
  ).toBe('Ranger');
});
