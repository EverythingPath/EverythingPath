import { expect, test } from 'vitest';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  type CharacterSheetInput,
} from './character-sheet';
import type {
  AnimalCompanionProgressionState,
  CompanionProgressionSource,
} from './character-sheet-companion-progression';
import {
  resolveCompanionAllocationPools,
  summarizeCompanionAllocationShares,
} from './character-sheet-companion-sources';
import {
  resolveCompanionLinkedInput,
  type CompanionLinkedInput,
} from './character-sheet-linked-inputs';

function wolf(): CharacterSheetInput & {
  companionProgression: AnimalCompanionProgressionState;
} {
  return {
    characterKind: 'npc',
    entries: [
      {
        _id: 'base-row',
        kind: 'base',
        active: true,
        catalogEntryId: 'base',
        state: { kind: 'base' },
      },
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: abilityKeys.map((ability) => ({
          target: abilityTargets[ability],
          bonusType: 'base',
          value: {
            strength: 13,
            dexterity: 15,
            constitution: 15,
            intelligence: 2,
            wisdom: 12,
            charisma: 6,
          }[ability],
        })),
      },
    ],
    companionProgression: {
      species: 'wolf',
      hpGained: 10,
      skillRanks: {},
      abilityIncreases: [],
      advancementChoice: 'species',
      keep: false,
    },
  };
}

function input(
  value: number | null,
  linked: CompanionLinkedInput,
  sourceKey: string,
  fallback?: number,
) {
  return resolveCompanionLinkedInput({
    input: linked,
    candidates: [
      value === null
        ? { sourceKey, kind: 'unavailable', reason: 'inaccessible' }
        : { sourceKey, kind: 'available', value },
    ],
    ...(fallback === undefined ? {} : { fallback }),
  });
}
const rangerLevels = {
  kind: 'classLevels',
  classRuleIdentity: 'ranger',
} as const;
const druidLevels = {
  kind: 'classLevels',
  classRuleIdentity: 'druid',
} as const;
const characterLevel = { kind: 'characterLevel' } as const;

function beastMaster({
  ranger,
  allocatedLevels,
  pool,
  counting = true,
}: {
  ranger: number | null;
  allocatedLevels?: number;
  pool?: CompanionProgressionSource['pool'];
  counting?: boolean;
}) {
  return {
    companionProgressionSources: [
      {
        sourceKey: 'beast-master',
        ruleKind: 'beastMasterCompanion' as const,
        counting,
        ...(allocatedLevels === undefined ? {} : { allocatedLevels }),
        ...(pool ? { pool } : {}),
      },
    ] satisfies CompanionProgressionSource[],
    companionLinkedInputs: [input(ranger, rangerLevels, 'beast-master')],
  };
}

// APG p. 124 Beast Master with CRB Table 3–8: a level-7 Beast Master has four
// effective druid levels. All four give one companion 4 HD; two each give
// each companion 3 HD (the research note's worked example).
test('a Beast Master allocation is the effective level looked up for this companion', () => {
  const whole = calculateCharacterSheet(
    wolf(),
    beastMaster({
      ranger: 7,
      allocatedLevels: 4,
      pool: { allocated: 4, companions: 1, selections: 1 },
    }),
  );
  expect(whole).toMatchObject({
    level: 0,
    hitDice: 4,
    companionProgression: {
      status: 'active',
      effectiveLevel: 4,
      hitDice: 4,
      contributions: [
        {
          sourceKey: 'beast-master',
          ruleKind: 'beastMasterCompanion',
          classRuleIdentity: 'ranger',
          classLevels: 7,
          effectiveLevel: 4,
          kind: 'allocation',
          allocation: {
            levels: 4,
            budget: 4,
            pool: { allocated: 4, companions: 1 },
          },
        },
      ],
    },
  });
  const split = calculateCharacterSheet(
    wolf(),
    beastMaster({
      ranger: 7,
      allocatedLevels: 2,
      pool: { allocated: 4, companions: 2, selections: 1 },
    }),
  );
  expect(split).toMatchObject({
    hitDice: 3,
    companionProgression: {
      effectiveLevel: 2,
      hitDice: 3,
      contributions: [
        { allocation: { levels: 2, budget: 4, pool: { allocated: 4 } } },
      ],
    },
  });
  expect(
    split.warnings.filter(({ check }) => check.startsWith('companionAlloc')),
  ).toEqual([]);
});

// APG p. 124 Strong Bond: from ranger level 12 the budget is the ranger level.
test('Strong Bond raises the Beast Master budget to the full ranger level from level 12', () => {
  const budgetAt = (ranger: number) => {
    const contribution = calculateCharacterSheet(
      wolf(),
      beastMaster({ ranger, allocatedLevels: 1 }),
    ).companionProgression?.contributions[0];
    return contribution?.kind === 'allocation'
      ? contribution.allocation.budget
      : undefined;
  };
  expect([3, 4, 11, 12, 20].map(budgetAt)).toEqual([0, 1, 8, 12, 20]);
});

test('an allocation above a shrunken budget keeps calculating and warns without trimming', () => {
  const result = calculateCharacterSheet(
    wolf(),
    beastMaster({
      ranger: 6,
      allocatedLevels: 4,
      pool: { allocated: 6, companions: 2, selections: 1 },
    }),
  );
  expect(result.companionProgression).toMatchObject({
    effectiveLevel: 4,
    hitDice: 4,
    contributions: [
      {
        allocation: {
          levels: 4,
          budget: 3,
          pool: { allocated: 6, companions: 2 },
        },
      },
    ],
  });
  expect(result.warnings).toContainEqual(
    expect.objectContaining({
      check: 'companionAllocationBudget',
      kind: 'rules',
      message: expect.stringContaining('above'),
    }),
  );
});

test('a missing allocation leaves progression unresolved and asks for one', () => {
  const result = calculateCharacterSheet(
    wolf(),
    beastMaster({
      ranger: 7,
      pool: { allocated: 3, companions: 2, selections: 1 },
    }),
  );
  expect(result).toMatchObject({
    hitDice: null,
    companionProgression: {
      status: 'unresolved',
      effectiveLevel: null,
      contributions: [
        {
          effectiveLevel: null,
          allocation: { levels: null, budget: 4, pool: { allocated: 3 } },
        },
      ],
    },
  });
  expect(result.warnings).toContainEqual(
    expect.objectContaining({ check: 'companionAllocationMissing' }),
  );
});

test('an unavailable ranger level leaves the allocation unresolved until a fallback supplies the budget', () => {
  const hidden = beastMaster({ ranger: null, allocatedLevels: 2 });
  expect(
    calculateCharacterSheet(wolf(), hidden).companionProgression,
  ).toMatchObject({
    status: 'unresolved',
    effectiveLevel: null,
    contributions: [{ allocation: { levels: 2, budget: null, pool: null } }],
  });
  hidden.companionLinkedInputs = [input(null, rangerLevels, 'beast-master', 7)];
  expect(
    calculateCharacterSheet(wolf(), hidden).companionProgression,
  ).toMatchObject({
    status: 'active',
    effectiveLevel: 2,
    contributions: [
      {
        resolution: 'fallback',
        fallbackState: 'applied',
        allocation: { levels: 2, budget: 4 },
      },
    ],
  });
});

// CRB p. 51: effective druid levels from several sources stack for one
// companion. Druid levels add to the companion they support; only the
// Beast Master's own budget is divided.
test('druid levels stack onto the allocated Beast Master levels of the supported companion', () => {
  const options = beastMaster({
    ranger: 7,
    allocatedLevels: 2,
    pool: { allocated: 4, companions: 2, selections: 1 },
  });
  const result = calculateCharacterSheet(wolf(), {
    companionProgressionSources: [
      ...options.companionProgressionSources,
      { sourceKey: 'nature-bond', ruleKind: 'druidCompanion', counting: true },
    ],
    companionLinkedInputs: [
      ...options.companionLinkedInputs,
      input(3, druidLevels, 'nature-bond'),
    ],
  });
  expect(result.companionProgression).toMatchObject({
    effectiveLevel: 5,
    hitDice: 5,
    contributions: [
      { sourceKey: 'beast-master', effectiveLevel: 2 },
      { sourceKey: 'nature-bond', effectiveLevel: 3, classLevels: 3 },
    ],
  });
});

test('a Beast Master replaces the ranger’s ordinary contribution whatever the source order', () => {
  for (const order of ['plain-first', 'allocation-first'] as const) {
    const options = beastMaster({ ranger: 7, allocatedLevels: 2 });
    const plain = {
      sourceKey: 'hunters-bond',
      ruleKind: 'rangerCompanion' as const,
      counting: true,
    };
    const result = calculateCharacterSheet(wolf(), {
      companionProgressionSources:
        order === 'plain-first'
          ? [plain, ...options.companionProgressionSources]
          : [...options.companionProgressionSources, plain],
      companionLinkedInputs: options.companionLinkedInputs,
    });
    expect(result.companionProgression).toMatchObject({
      effectiveLevel: 2,
      contributions: [{ sourceKey: 'beast-master', effectiveLevel: 2 }],
    });
    expect(result.companionProgression?.restrictions.join(' ')).not.toContain(
      'Hunter’s bond',
    );
  }
});

test('losing the Beast Master source removes only its levels and keeps the recorded allocation', () => {
  const result = calculateCharacterSheet(wolf(), {
    companionProgressionSources: [
      {
        sourceKey: 'beast-master',
        ruleKind: 'beastMasterCompanion',
        counting: false,
        allocatedLevels: 2,
      },
      { sourceKey: 'nature-bond', ruleKind: 'druidCompanion', counting: true },
    ],
    companionLinkedInputs: [
      input(7, rangerLevels, 'beast-master'),
      input(3, druidLevels, 'nature-bond'),
    ],
  });
  expect(result.companionProgression).toMatchObject({
    status: 'active',
    effectiveLevel: 3,
    contributions: [
      {
        sourceKey: 'beast-master',
        counting: false,
        effectiveLevel: null,
        allocation: { levels: 2 },
      },
      { sourceKey: 'nature-bond', effectiveLevel: 3 },
    ],
  });
  expect(
    result.warnings.filter(({ check }) => check.startsWith('companionAlloc')),
  ).toEqual([]);
});

// Boon Companion (Ultimate Wilderness p. 217): four more levels for one
// companion, to a maximum effective druid level equal to character level.
// Each time it is taken it applies to a different companion.
test('Boon Companion adds four levels to one supported companion per selection, capped by character level', () => {
  const boon = (
    allocatedLevels: number,
    level: number,
    { companions = 1, selections = 1 } = {},
  ) => {
    const options = beastMaster({ ranger: 7, allocatedLevels });
    return calculateCharacterSheet(wolf(), {
      companionProgressionSources: [
        ...options.companionProgressionSources,
        {
          sourceKey: 'boon',
          ruleKind: 'boonCompanion',
          counting: true,
          pool: { allocated: companions, companions, selections },
        },
      ],
      companionLinkedInputs: [
        ...options.companionLinkedInputs,
        input(level, characterLevel, 'boon'),
      ],
    });
  };
  expect(boon(2, 7).companionProgression).toMatchObject({
    effectiveLevel: 6,
    contributions: [
      { sourceKey: 'beast-master', effectiveLevel: 2 },
      {
        sourceKey: 'boon',
        ruleKind: 'boonCompanion',
        classRuleIdentity: 'boonCompanion',
        classLevels: null,
        effectiveLevel: 4,
        kind: 'increase',
        increase: { amount: 4, characterLevel: 7 },
      },
    ],
  });
  expect(boon(4, 7).companionProgression).toMatchObject({
    effectiveLevel: 7,
    contributions: [{ effectiveLevel: 4 }, { effectiveLevel: 3 }],
  });
  const shared = boon(2, 7, { companions: 2 });
  expect(shared.warnings).toContainEqual(
    expect.objectContaining({
      check: 'companionAllocationBudget',
      message:
        'Boon Companion applies to one companion per selection, but 2 companions draw on 1. Each keeps the benefit until a source is removed.',
    }),
  );
  expect(shared.companionProgression?.effectiveLevel).toBe(6);
  const twice = boon(2, 7, { companions: 2, selections: 2 });
  expect(
    twice.warnings.filter(({ check }) => check.startsWith('companionAlloc')),
  ).toEqual([]);
  expect(twice.companionProgression?.effectiveLevel).toBe(6);
});

test('Boon Companion alone grants no companion progression', () => {
  const result = calculateCharacterSheet(wolf(), {
    companionProgressionSources: [
      { sourceKey: 'boon', ruleKind: 'boonCompanion', counting: true },
    ],
    companionLinkedInputs: [input(9, characterLevel, 'boon')],
  });
  expect(result.companionProgression).toMatchObject({
    status: 'dormant',
    contributions: [{ sourceKey: 'boon', effectiveLevel: 0 }],
  });
  expect(result.companionProgression?.restrictions.join(' ')).toContain(
    'Boon Companion',
  );
});

// Ultimate Magic p. 38 Pack Lord and Advanced Class Guide p. 96 Packmaster:
// the same divided budget, equal to the druid or hunter level.
test('Pack Lord and Packmaster divide their full class level', () => {
  for (const [ruleKind, classRuleIdentity] of [
    ['packLordCompanion', 'druid'],
    ['packmasterCompanion', 'hunter'],
  ] as const) {
    const result = calculateCharacterSheet(wolf(), {
      companionProgressionSources: [
        { sourceKey: 'pack', ruleKind, counting: true, allocatedLevels: 3 },
      ],
      companionLinkedInputs: [
        input(5, { kind: 'classLevels', classRuleIdentity }, 'pack'),
      ],
    });
    expect(result.companionProgression).toMatchObject({
      effectiveLevel: 3,
      contributions: [
        {
          classRuleIdentity,
          classLevels: 5,
          allocation: { levels: 3, budget: 5 },
        },
      ],
    });
  }
});

test('allocation shares count one source per active companion and keep inactive allocations recorded', () => {
  const shares = summarizeCompanionAllocationShares([
    {
      relationshipId: 'a',
      active: true,
      sources: [
        {
          key: 'bm',
          ruleKind: 'beastMasterCompanion',
          counting: true,
          allocatedLevels: 2,
          selectionId: 'ranger-1',
        },
        {
          key: 'bm-again',
          ruleKind: 'beastMasterCompanion',
          counting: true,
          allocatedLevels: 9,
          selectionId: 'ranger-1',
        },
        {
          key: 'boon',
          ruleKind: 'boonCompanion',
          counting: true,
          selectionId: 'boon-feat',
        },
      ],
    },
    {
      relationshipId: 'b',
      active: true,
      sources: [
        {
          key: 'bm',
          ruleKind: 'beastMasterCompanion',
          counting: true,
          allocatedLevels: 3,
          selectionId: 'ranger-1',
        },
      ],
    },
    {
      relationshipId: 'c',
      active: false,
      sources: [
        {
          key: 'bm',
          ruleKind: 'beastMasterCompanion',
          counting: true,
          allocatedLevels: 4,
          selectionId: 'ranger-1',
        },
      ],
    },
    {
      relationshipId: 'd',
      active: true,
      sources: [
        {
          key: 'bm',
          ruleKind: 'beastMasterCompanion',
          counting: false,
          allocatedLevels: 1,
          selectionId: 'ranger-1',
        },
      ],
    },
  ]);
  expect(shares.get('beastMasterCompanion')).toEqual({
    allocated: 5,
    companions: 2,
    selections: 1,
    members: [
      { relationshipId: 'a', sourceKey: 'bm', levels: 2, counting: true },
      { relationshipId: 'b', sourceKey: 'bm', levels: 3, counting: true },
      { relationshipId: 'c', sourceKey: 'bm', levels: 4, counting: false },
      { relationshipId: 'd', sourceKey: 'bm', levels: 1, counting: false },
    ],
  });
  expect(shares.get('boonCompanion')).toMatchObject({
    allocated: 1,
    companions: 1,
    selections: 1,
  });
  const pools = resolveCompanionAllocationPools({
    shares,
    classLevels: { ranger: 6 },
  });
  expect(pools).toEqual([
    expect.objectContaining({
      ruleKind: 'beastMasterCompanion',
      kind: 'allocation',
      classRuleIdentity: 'ranger',
      classLevels: 6,
      budget: 3,
      allocated: 5,
      remaining: -2,
      overBudget: true,
      sources: [
        expect.objectContaining({
          book: 'Pathfinder RPG Advanced Player’s Guide',
          pages: '124',
        }),
      ],
    }),
    expect.objectContaining({
      ruleKind: 'boonCompanion',
      kind: 'increase',
      budget: 1,
      allocated: 1,
      overBudget: false,
    }),
  ]);
});

// Ultimate Wilderness p. 217: each Boon Companion Selection applies to a
// different companion, so the budget is one companion per Selection.
test('Boon Companion allows one companion per selection and warns when two share one', () => {
  const boonPool = (selections: [string, string]) =>
    resolveCompanionAllocationPools({
      shares: summarizeCompanionAllocationShares(
        selections.map((selectionId, index) => ({
          relationshipId: `wolf-${index}`,
          active: true,
          sources: [
            {
              key: 'boon',
              ruleKind: 'boonCompanion',
              counting: true,
              selectionId,
            },
          ],
        })),
      ),
      classLevels: {},
    });
  expect(boonPool(['boon-1', 'boon-2'])).toEqual([
    expect.objectContaining({
      kind: 'increase',
      budget: 2,
      allocated: 2,
      overBudget: false,
      members: [
        { relationshipId: 'wolf-0', sourceKey: 'boon', counting: true },
        { relationshipId: 'wolf-1', sourceKey: 'boon', counting: true },
      ],
    }),
  ]);
  expect(boonPool(['boon-1', 'boon-1'])).toEqual([
    expect.objectContaining({ budget: 1, allocated: 2, overBudget: true }),
  ]);
});
