import { expect, test } from 'vitest';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  calculateCharacterSheetProjections,
  type CharacterSheetInput,
} from './character-sheet';
import type { CompanionProgressionSource } from './character-sheet-companion-progression';
import type { CompanionComponents } from './character-sheet-companion-components';
import {
  resolveCompanionAllocationPools,
  summarizeCompanionAllocationShares,
} from './character-sheet-companion-sources';
import type { EidolonProgressionState } from './character-sheet-eidolon-progression';
import { resolveCompanionLinkedInput } from './character-sheet-linked-inputs';

// Ultimate Magic p. 78, Broodmaster: "each eidolon has the same base attack
// bonus and base saving throw bonuses, but the rest of the eidolons' base
// statistics must be divided between the eidolons, including Hit Dice
// (minimum 1), skill points, number of feats, armor bonus, Str/Dex bonus,
// evolution pool (but see below), and maximum number of natural attacks."

const forms = {
  // APG base forms, before the Small adjustments (−4 Str, +2 Dex, −2 Con).
  biped: {
    strength: 16,
    dexterity: 12,
    constitution: 13,
    intelligence: 7,
    wisdom: 10,
    charisma: 11,
  },
  quadruped: {
    strength: 14,
    dexterity: 14,
    constitution: 13,
    intelligence: 7,
    wisdom: 10,
    charisma: 11,
  },
};
function broodEidolon(
  baseForm: keyof typeof forms,
  progression: Partial<EidolonProgressionState> = {},
): CharacterSheetInput & { companionProgression: EidolonProgressionState } {
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
          value: forms[baseForm][ability],
        })),
      },
    ],
    companionProgression: {
      kind: 'eidolon',
      baseForm,
      size: 'small',
      hpGained: 6,
      skillRanks: {},
      abilityIncreases: [],
      classSkills: [],
      armorBonusAsArmor: 0,
      evolutions: [],
      keep: false,
      ...progression,
    },
  };
}

function brood({
  summoner,
  components,
  pool,
  counting = true,
  ordinary = false,
}: {
  summoner: number | null;
  components?: Partial<CompanionComponents>;
  pool?: CompanionProgressionSource['componentPool'];
  counting?: boolean;
  /** An ordinary summoner source besides the Broodmaster one. */
  ordinary?: boolean;
}) {
  return {
    companionProgressionSources: [
      {
        sourceKey: 'brood',
        ruleKind: 'broodmasterEidolon' as const,
        counting,
        ...(components ? { allocatedComponents: components } : {}),
        ...(pool ? { componentPool: pool } : {}),
      },
      ...(ordinary
        ? [
            {
              sourceKey: 'eidolon',
              ruleKind: 'eidolon' as const,
              counting: true,
            },
          ]
        : []),
    ] satisfies CompanionProgressionSource[],
    companionLinkedInputs: [
      resolveCompanionLinkedInput({
        input: { kind: 'classLevels', classRuleIdentity: 'summoner' },
        candidates: [
          ...(counting
            ? [
                summoner === null
                  ? {
                      sourceKey: 'brood',
                      kind: 'unavailable' as const,
                      reason: 'inaccessible' as const,
                    }
                  : {
                      sourceKey: 'brood',
                      kind: 'available' as const,
                      value: summoner,
                    },
              ]
            : []),
          ...(ordinary && summoner !== null
            ? [
                {
                  sourceKey: 'eidolon',
                  kind: 'available' as const,
                  value: summoner,
                },
              ]
            : []),
        ],
      }),
    ],
  };
}

// The published example, UM p. 78: the first eidolon gets 4 skill points,
// one feat, +1 armor, +1 Strength, 2 evolution points and two attacks; the
// second the other 4 skill points, +1 armor, +1 Dexterity, 2 evolution
// points and one attack, but no feat. Each has 1 HD and BAB +2.
const first: CompanionComponents = {
  hitDice: 1,
  skillRanks: 4,
  feats: 1,
  armorBonus: 1,
  strengthBonus: 1,
  dexterityBonus: 0,
  evolutionPoints: 2,
  maxAttacks: 2,
};
const second: CompanionComponents = {
  hitDice: 1,
  skillRanks: 4,
  feats: 0,
  armorBonus: 1,
  strengthBonus: 0,
  dexterityBonus: 1,
  evolutionPoints: 2,
  maxAttacks: 1,
};
// APG Table 2–9 at summoner level 2, whole: HD 2, Skills 8, Feats 1,
// Armor +2, Str/Dex +1, Evolution Pool 4, Max. Attacks 3.
const levelTwoBudget: CompanionComponents = {
  hitDice: 2,
  skillRanks: 8,
  feats: 1,
  armorBonus: 2,
  strengthBonus: 1,
  dexterityBonus: 1,
  evolutionPoints: 4,
  maxAttacks: 3,
};
const exampleTotals: CompanionComponents = levelTwoBudget;
const examplePool = {
  allocated: exampleTotals,
  companions: 2,
  groupPurchases: [],
};

function checks(result: ReturnType<typeof calculateCharacterSheet>) {
  return result.warnings.map((warning) => warning.check);
}
function evolutionsOf(result: ReturnType<typeof calculateCharacterSheet>) {
  const progression = result.companionProgression;
  return progression?.kind === 'eidolon' ? progression.evolutions : [];
}

test('the published 2nd-level brood keeps BAB and saves whole and divides every other component', () => {
  const one = calculateCharacterSheet(
    broodEidolon('biped'),
    brood({ summoner: 2, components: first, pool: examplePool }),
  );
  expect(one).toMatchObject({
    level: 0,
    classLevels: [],
    hitDice: 1,
    // 6 recorded + Con 11 (Small) +0 for its single HD.
    hp: 6,
    abilities: {
      // 16 − 4 Small + 1 allocated Strength; 12 + 2 Small, no Dexterity.
      strength: { score: 13 },
      dexterity: { score: 14 },
    },
    derivedStatistics: {
      // Undivided: the summoner level 2 row, not a 1-HD eidolon's +1.
      bab: { total: 2 },
      // Biped good Fortitude and Will +3, bad Reflex +0, plus Dex +2.
      fortitude: { total: 3 },
      reflex: { total: 2 },
      will: { total: 3 },
    },
    budgets: {
      kind: 'eidolon',
      generalFeats: 1,
      skillRanks: 4,
      skillRankCap: 1,
    },
    companionProgression: {
      kind: 'eidolon',
      status: 'active',
      effectiveLevel: 2,
      hitDice: 1,
      budgets: { generalFeats: 1, skillRanks: 4, maxAttacks: 2 },
      armor: { total: 1, armor: 0, natural: 3 },
      strengthDexterityBonus: null,
      evolutionPool: {
        total: 2,
        sources: [
          {
            sourceKey: 'brood',
            ruleKind: 'broodmasterEidolon',
            classRuleIdentity: 'summoner',
            points: 2,
          },
        ],
      },
      contributions: [
        {
          kind: 'component',
          sourceKey: 'brood',
          ruleKind: 'broodmasterEidolon',
          classLevels: 2,
          effectiveLevel: 2,
          components: {
            allocated: first,
            budget: levelTwoBudget,
            pool: examplePool,
          },
        },
      ],
      brood: {
        components: first,
        budget: levelTwoBudget,
        groupPurchases: [],
        largestSize: 'small',
      },
    },
  });
  const two = calculateCharacterSheet(
    broodEidolon('quadruped'),
    brood({ summoner: 2, components: second, pool: examplePool }),
  );
  expect(two).toMatchObject({
    hitDice: 1,
    abilities: {
      strength: { score: 10 },
      // 14 + 2 Small + 1 allocated Dexterity.
      dexterity: { score: 17 },
    },
    derivedStatistics: { bab: { total: 2 } },
    // One HD would give an ordinary creature one feat; the brood gave none.
    budgets: { generalFeats: 0, skillRanks: 4 },
    companionProgression: {
      budgets: { generalFeats: 0, maxAttacks: 1 },
      evolutionPool: { total: 2 },
    },
  });
  expect(two.selectionRules.budgets.generalFeats).toBe(0);
  for (const result of [one, two])
    expect(
      checks(result).filter(
        (check) =>
          check.startsWith('companionComponent') || check.startsWith('brood'),
      ),
    ).toEqual([]);
});

test('allocated Hit Dice never stand in for an ordinary eidolon of that level', () => {
  const ordinary = calculateCharacterSheet(broodEidolon('biped'), {
    companionProgressionSources: [
      { sourceKey: 'eidolon', ruleKind: 'eidolon', counting: true },
    ],
    companionLinkedInputs: [
      resolveCompanionLinkedInput({
        input: { kind: 'classLevels', classRuleIdentity: 'summoner' },
        candidates: [{ sourceKey: 'eidolon', kind: 'available', value: 1 }],
      }),
    ],
  });
  const divided = calculateCharacterSheet(
    broodEidolon('biped'),
    brood({ summoner: 2, components: second, pool: examplePool }),
  );
  expect(ordinary.hitDice).toBe(divided.hitDice);
  expect(ordinary.derivedStatistics.bab.total).toBe(1);
  expect(divided.derivedStatistics.bab.total).toBe(2);
  expect(ordinary.budgets.generalFeats).toBe(1);
  expect(divided.budgets.generalFeats).toBe(0);
  expect(ordinary.companionProgression).toMatchObject({
    evolutionPool: { total: 3 },
  });
  expect(divided.companionProgression).toMatchObject({
    evolutionPool: { total: 2 },
  });
});

test('missing component allocations leave the eidolon unresolved instead of inventing zeroes', () => {
  const none = calculateCharacterSheet(
    broodEidolon('biped'),
    brood({ summoner: 2 }),
  );
  expect(none).toMatchObject({
    hitDice: null,
    companionProgression: {
      status: 'unresolved',
      hitDice: null,
      brood: { components: null, missing: expect.arrayContaining(['hitDice']) },
    },
  });
  expect(none.warnings).toContainEqual(
    expect.objectContaining({
      check: 'companionComponentMissing',
      kind: 'unresolved',
    }),
  );
  const { maxAttacks: _maxAttacks, ...partial } = first;
  const incomplete = calculateCharacterSheet(
    broodEidolon('biped'),
    brood({ summoner: 2, components: partial }),
  );
  expect(incomplete.companionProgression).toMatchObject({
    status: 'unresolved',
    brood: { missing: ['maxAttacks'] },
  });
  expect(incomplete.warnings).toContainEqual(
    expect.objectContaining({
      check: 'companionComponentMissing',
      message: expect.stringContaining('maximum natural attacks'),
    }),
  );
});

// UM p. 78, Larger Brood: an 8th-level broodmaster with 11 evolution points
// spends 4 on the large evolution for the brood before distributing the
// other 7 to individual eidolons.
test('a group purchase comes off the brood pool before individual allocations, which stay above budget with a warning', () => {
  const allocation = { ...first, evolutionPoints: 4 };
  const pool = {
    allocated: { ...exampleTotals, evolutionPoints: 8 },
    companions: 2,
    groupPurchases: ['large' as const],
  };
  const result = calculateCharacterSheet(
    broodEidolon('biped', { size: 'medium' }),
    brood({ summoner: 8, components: allocation, pool }),
  );
  expect(result.companionProgression).toMatchObject({
    status: 'active',
    evolutionPool: { total: 4 },
    contributions: [
      {
        components: {
          budget: { hitDice: 6, evolutionPoints: 7, maxAttacks: 4 },
        },
      },
    ],
    brood: {
      groupPurchases: [{ key: 'large', cost: 4, issues: [] }],
      largestSize: 'medium',
    },
  });
  const warning = result.warnings.find(
    ({ check }) => check === 'companionComponentBudget',
  );
  expect(warning?.message).toContain('evolution points');
  expect(warning?.message).toContain('8');
  expect(warning?.message).toContain('7');
  expect(checks(result)).not.toContain('broodEidolonSize');
  const within = calculateCharacterSheet(
    broodEidolon('biped', { size: 'medium' }),
    brood({
      summoner: 8,
      components: allocation,
      pool: { ...pool, allocated: { ...pool.allocated, evolutionPoints: 7 } },
    }),
  );
  expect(checks(within)).not.toContain('companionComponentBudget');
});

test('group purchases below their level or out of order are kept, still cost points and warn', () => {
  const early = calculateCharacterSheet(
    broodEidolon('biped'),
    brood({
      summoner: 7,
      components: first,
      pool: {
        allocated: first,
        companions: 1,
        groupPurchases: ['huge'],
      },
    }),
  );
  expect(early.companionProgression).toMatchObject({
    contributions: [
      // Table level 7 pool 10, less the recorded huge purchase's 6.
      { components: { budget: { evolutionPoints: 4 } } },
    ],
    brood: {
      groupPurchases: [
        {
          key: 'huge',
          cost: 6,
          issues: [
            'Requires summoner level 13.',
            'Requires the large evolution for the brood.',
          ],
        },
      ],
    },
  });
  expect(checks(early)).toContain('companionGroupPurchase');
});

test('a Medium brood eidolon needs the brood’s large evolution', () => {
  const medium = calculateCharacterSheet(
    broodEidolon('biped', { size: 'medium' }),
    brood({ summoner: 2, components: first, pool: examplePool }),
  );
  expect(checks(medium)).toContain('broodEidolonSize');
  // Without access to the summoner the group purchases are unknown.
  const hidden = calculateCharacterSheet(
    broodEidolon('biped', { size: 'medium' }),
    brood({ summoner: 2, components: first }),
  );
  expect(checks(hidden)).not.toContain('broodEidolonSize');
  expect(hidden.companionProgression).toMatchObject({
    status: 'active',
    brood: { budget: null, groupPurchases: null },
  });
});

// UM p. 78, Larger Brood: the huge evolution "allows him to have two Large
// eidolons", bought once from the brood's pool.
test('the brood’s huge purchase pays for an eidolon’s Large size, which applies as the large evolution does', () => {
  const share = { ...first, evolutionPoints: 2 };
  const pool = {
    allocated: { ...exampleTotals, evolutionPoints: 4 },
    companions: 2,
    groupPurchases: ['large' as const, 'huge' as const],
  };
  const large = calculateCharacterSheet(
    broodEidolon('biped', { size: 'medium', evolutions: [{ key: 'large' }] }),
    brood({ summoner: 13, components: share, pool }),
  );
  expect(large.companionProgression).toMatchObject({
    status: 'active',
    size: 'large',
    evolutionPool: { total: 2, spent: 0, remaining: 2 },
    brood: { largestSize: 'large' },
  });
  expect(evolutionsOf(large)).toContainEqual(
    expect.objectContaining({ key: 'large', cost: 0, paidByGroup: true }),
  );
  // Biped Str 16, +1 allocated, +8 Large; Dex 12 −2 Large.
  expect(large.abilities.strength.score).toBe(25);
  expect(large.abilities.dexterity.score).toBe(10);
  expect(checks(large)).not.toContain('broodEidolonSize');
  expect(checks(large)).not.toContain('eidolonEvolutionPoolBudget');

  // Without the huge purchase the eidolon pays for its own large evolution
  // from its allocated points and is larger than the brood allows.
  const unpaid = calculateCharacterSheet(
    broodEidolon('biped', { size: 'medium', evolutions: [{ key: 'large' }] }),
    brood({
      summoner: 13,
      components: share,
      pool: { ...pool, groupPurchases: ['large'] },
    }),
  );
  expect(unpaid.companionProgression).toMatchObject({
    size: 'large',
    evolutionPool: { total: 2, spent: 4, remaining: -2 },
    brood: { largestSize: 'medium' },
  });
  expect(evolutionsOf(unpaid)).toContainEqual(
    expect.objectContaining({ key: 'large', cost: 4, paidByGroup: false }),
  );
  expect(checks(unpaid)).toContain('broodEidolonSize');
  expect(checks(unpaid)).toContain('eidolonEvolutionPoolBudget');

  // The Huge upgrade is beyond the brood's purchases: it costs its own 6
  // points and warns.
  const huge = calculateCharacterSheet(
    broodEidolon('biped', {
      size: 'medium',
      evolutions: [{ key: 'large', upgrades: 1 }],
    }),
    brood({ summoner: 13, components: share, pool }),
  );
  expect(huge.companionProgression).toMatchObject({
    size: 'huge',
    evolutionPool: { spent: 6 },
  });
  expect(checks(huge)).toContain('broodEidolonSize');
});

// APG Table 2–9, Skills: "Eidolons with Intelligence scores above the base
// value modify these totals as normal (an eidolon receives a number of skill
// ranks equal to 6 + its Intelligence modifier per HD)."
test('a brood eidolon’s own Intelligence adjusts its allocated ranks per allocated Hit Die', () => {
  const withIntelligence = (score: number) => {
    const input = broodEidolon('biped');
    return {
      ...input,
      catalogEntries: input.catalogEntries.map((entry) => ({
        ...entry,
        modifiers: entry.modifiers.map((modifier) =>
          modifier.target === abilityTargets.intelligence
            ? { ...modifier, value: score }
            : modifier,
        ),
      })),
    };
  };
  const ranks = (score: number) =>
    calculateCharacterSheet(
      withIntelligence(score),
      brood({
        summoner: 4,
        components: { ...first, hitDice: 2, skillRanks: 8 },
        pool: examplePool,
      }),
    ).budgets.skillRanks;
  // The table's Skills column assumes the base forms' Int 7.
  expect(ranks(7)).toBe(8);
  // Int 13 (+1): 8 allocated + 2 HD × (7 − 4).
  expect(ranks(13)).toBe(14);
  // Int 9 (−1): 8 + 2 × (5 − 4).
  expect(ranks(9)).toBe(10);
  // Int 1 (−5): at least 1 rank per HD, so 8 + 2 × (1 − 4).
  expect(ranks(1)).toBe(2);
});

test('fewer than one Hit Die warns and keeps the recorded allocation', () => {
  const result = calculateCharacterSheet(
    broodEidolon('biped'),
    brood({ summoner: 2, components: { ...first, hitDice: 0 } }),
  );
  expect(result.companionProgression).toMatchObject({ hitDice: 0 });
  expect(checks(result)).toContain('broodEidolonHitDice');
});

test('losing the Broodmaster source keeps its allocations and surviving summoner support advances an ordinary eidolon', () => {
  const lost = calculateCharacterSheet(
    broodEidolon('biped'),
    brood({ summoner: 4, components: first, counting: false, ordinary: true }),
  );
  expect(lost).toMatchObject({
    hitDice: 3,
    companionProgression: {
      status: 'active',
      brood: null,
      contributions: [
        {
          kind: 'component',
          counting: false,
          effectiveLevel: null,
          components: { allocated: first },
        },
        { kind: 'ordinary', sourceKey: 'eidolon', effectiveLevel: 4 },
      ],
    },
  });
  const dormant = calculateCharacterSheet(
    broodEidolon('biped'),
    brood({ summoner: 4, components: first, counting: false }),
  );
  expect(dormant.companionProgression).toMatchObject({
    status: 'dormant',
    contributions: [{ components: { allocated: first } }],
  });
  const restored = calculateCharacterSheet(
    broodEidolon('biped'),
    brood({ summoner: 4, components: first }),
  );
  expect(restored).toMatchObject({
    hitDice: 1,
    companionProgression: { brood: { components: first } },
  });
});

test('both projections read the allocated Hit Dice as actual Hit Dice', () => {
  const { current, permanent } = calculateCharacterSheetProjections(
    broodEidolon('biped'),
    {
      projectionInputs: {
        current: brood({ summoner: 2, components: first, pool: examplePool }),
        permanent: brood({
          summoner: 2,
          components: first,
          pool: examplePool,
        }),
      },
    },
  );
  expect(current.hitDice).toBe(1);
  expect(permanent.hitDice).toBe(1);
});

test('the brood pool totals counting members, deducts group purchases and checks the brood’s size capacity', () => {
  const shares = summarizeCompanionAllocationShares([
    {
      relationshipId: 'first',
      active: true,
      sources: [
        {
          key: 'brood',
          ruleKind: 'broodmasterEidolon',
          counting: true,
          allocatedComponents: first,
          selectionId: 'archetype',
        },
      ],
    },
    {
      relationshipId: 'second',
      active: true,
      sources: [
        {
          key: 'brood',
          ruleKind: 'broodmasterEidolon',
          counting: true,
          allocatedComponents: { ...second, evolutionPoints: 6 },
          selectionId: 'archetype',
        },
      ],
    },
    {
      relationshipId: 'former',
      active: false,
      sources: [
        {
          key: 'brood',
          ruleKind: 'broodmasterEidolon',
          counting: true,
          allocatedComponents: first,
          selectionId: 'archetype',
        },
      ],
    },
  ]);
  const pools = resolveCompanionAllocationPools({
    shares,
    classLevels: { summoner: 8 },
    groupPurchases: { broodmasterEidolon: ['large'] },
    sizes: { first: 'medium', second: 'small', former: 'small' },
  });
  expect(pools).toEqual([
    expect.objectContaining({
      kind: 'component',
      ruleKind: 'broodmasterEidolon',
      label: 'Broodmaster',
      classLevels: 8,
      budget: expect.objectContaining({ hitDice: 6, evolutionPoints: 7 }),
      allocated: expect.objectContaining({ hitDice: 2, evolutionPoints: 8 }),
      remaining: expect.objectContaining({ hitDice: 4, evolutionPoints: -1 }),
      overBudget: true,
      overBudgetComponents: ['evolutionPoints'],
      groupPurchases: [
        expect.objectContaining({ key: 'large', cost: 4, issues: [] }),
      ],
      // One Medium (2) and one Small (1) of four Small-eidolon places.
      capacity: { allowed: 4, used: 3 },
      members: [
        expect.objectContaining({
          relationshipId: 'first',
          components: first,
          counting: true,
        }),
        expect.objectContaining({ relationshipId: 'second', counting: true }),
        expect.objectContaining({ relationshipId: 'former', counting: false }),
      ],
      sources: expect.arrayContaining([
        expect.objectContaining({
          book: 'Pathfinder RPG Ultimate Magic',
          pages: '78',
        }),
      ]),
    }),
  ]);
  const crowded = resolveCompanionAllocationPools({
    shares,
    classLevels: { summoner: 8 },
    groupPurchases: {},
    sizes: { first: 'medium', second: 'small' },
  });
  // Without Larger Brood: two Small eidolons, so a Medium one overfills it.
  expect(crowded[0]).toMatchObject({
    capacity: { allowed: 2, used: 3 },
    overBudget: false,
    budget: { evolutionPoints: 11 },
  });
  const largeBrood = resolveCompanionAllocationPools({
    shares,
    classLevels: { summoner: 13 },
    groupPurchases: { broodmasterEidolon: ['large', 'huge'] },
    sizes: { first: 'large', second: 'large' },
  });
  // Two Large eidolons fill the huge purchase's eight Small places.
  expect(largeBrood[0]).toMatchObject({ capacity: { allowed: 8, used: 8 } });
});
