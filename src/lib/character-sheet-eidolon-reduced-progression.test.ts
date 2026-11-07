import { expect, test } from 'vitest';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  type CharacterSheetInput,
} from './character-sheet';
import {
  getCompanionReductionRule,
  progressionContributions,
  reduceProgressionLevel,
  type CompanionProgressionSource,
} from './character-sheet-companion-sources';
import type { EidolonProgressionState } from './character-sheet-eidolon-progression';
import { resolveCompanionLinkedInput } from './character-sheet-linked-inputs';

// Ultimate Magic p. 80, Master Summoner, Lesser Eidolon: "A master
// summoner's class level is halved (minimum 1) for the purposes of
// determining his eidolon's abilities, Hit Dice, evolution pool, and so on.
// The eidolon otherwise functions as normal."

const bipedScores = {
  strength: 16,
  dexterity: 12,
  constitution: 13,
  intelligence: 7,
  wisdom: 10,
  charisma: 11,
};
function eidolon(
  progression: Partial<EidolonProgressionState> = {},
  scores: Record<(typeof abilityKeys)[number], number> = bipedScores,
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
          value: scores[ability],
        })),
      },
    ],
    companionProgression: {
      kind: 'eidolon',
      baseForm: 'biped',
      size: 'medium',
      hpGained: 10,
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

type Source = Omit<CompanionProgressionSource, 'counting'> & {
  counting?: boolean;
  /** The summoner level this source reads; null is unavailable. */
  level: number | null;
};
function lesser(level: number | null, extra: Partial<Source> = {}): Source {
  return {
    sourceKey: 'lesser-eidolon',
    ruleKind: 'masterSummonerEidolon',
    level,
    ...extra,
  };
}
function options(sources: Source[], fallback?: number) {
  return {
    companionProgressionSources: sources.map(
      ({ level: _level, counting = true, ...source }) => ({
        ...source,
        counting,
      }),
    ) satisfies CompanionProgressionSource[],
    companionLinkedInputs: [
      resolveCompanionLinkedInput({
        input: { kind: 'classLevels', classRuleIdentity: 'summoner' },
        candidates: sources
          .filter((source) => source.counting !== false)
          .map(({ sourceKey, level }) =>
            level === null
              ? {
                  sourceKey,
                  kind: 'unavailable' as const,
                  reason: 'inaccessible' as const,
                }
              : { sourceKey, kind: 'available' as const, value: level },
          ),
        ...(fallback === undefined ? {} : { fallback }),
      }),
    ],
  };
}
function checks(result: ReturnType<typeof calculateCharacterSheet>) {
  return result.warnings.map((warning) => warning.check);
}
function progressionOf(result: ReturnType<typeof calculateCharacterSheet>) {
  const progression = result.companionProgression;
  if (progression?.kind !== 'eidolon') throw new Error('Expected an eidolon');
  return progression;
}

test('the curated reduction halves the summoner level, rounding down, to at least 1', () => {
  const { steps } = getCompanionReductionRule('masterSummonerEidolon');
  expect(steps).toEqual([
    { kind: 'divide', divisor: 2 },
    { kind: 'minimum', value: 1 },
  ]);
  const cases = [
    [1, 1],
    [2, 1],
    [3, 1],
    [7, 3],
    [8, 4],
    [19, 9],
    [20, 10],
  ] as const;
  for (const [level, effective] of cases)
    expect(reduceProgressionLevel(level, steps).effectiveLevel).toBe(effective);
  expect(reduceProgressionLevel(7, steps).steps).toEqual([
    { kind: 'divide', operand: 2, result: 3 },
    { kind: 'minimum', operand: 1, result: 3 },
  ]);
  // The minimum is a held summoner level's: no levels is no eidolon.
  expect(reduceProgressionLevel(0, steps)).toEqual({
    effectiveLevel: 0,
    steps: [],
  });
});

// The research example (#248): at summoner level 7 the Lesser Eidolon uses
// level 3 of APG Table 2–9: HD 3, BAB +3, good +3, bad +1, Feats 2, Armor +2,
// Str/Dex +1, Evolution Pool 5, Max. Attacks 3, not the level 7 row's 6 HD
// and 10 points.
test('a 7th-level master summoner’s eidolon reads the level 3 row of the eidolon table', () => {
  const result = calculateCharacterSheet(eidolon(), options([lesser(7)]));
  expect(result).toMatchObject({
    level: 0,
    classLevels: [],
    hitDice: 3,
    // 10 recorded + Con +1 per HD.
    hp: 13,
    abilities: {
      strength: { score: 17 },
      dexterity: { score: 13 },
    },
    derivedStatistics: {
      bab: { total: 3 },
      fortitude: { total: 4 },
      reflex: { total: 2 },
      will: { total: 3 },
    },
    budgets: {
      kind: 'eidolon',
      generalFeats: 2,
      // 6 + Int −2 per HD, as for any eidolon: the variant fixes no ranks.
      skillRanks: 12,
      skillRankCap: 3,
    },
    companionProgression: {
      kind: 'eidolon',
      status: 'active',
      effectiveLevel: 3,
      hitDice: 3,
      budgets: { abilityIncreases: 0, maxAttacks: 3 },
      armor: { total: 2, natural: 4 },
      strengthDexterityBonus: 1,
      evolutionPool: {
        total: 5,
        sources: [
          {
            sourceKey: 'lesser-eidolon',
            ruleKind: 'masterSummonerEidolon',
            classRuleIdentity: 'summoner',
            points: 5,
          },
        ],
      },
      contributions: [
        {
          kind: 'reduced',
          sourceKey: 'lesser-eidolon',
          ruleKind: 'masterSummonerEidolon',
          classRuleIdentity: 'summoner',
          // The actual summoner level stays distinct from the reduced one.
          classLevels: 7,
          effectiveLevel: 3,
          counting: true,
          resolution: 'calculated',
          reduction: {
            steps: [
              { kind: 'divide', operand: 2, result: 3 },
              { kind: 'minimum', operand: 1, result: 3 },
            ],
          },
        },
      ],
    },
  });
  expect(progressionOf(result).features).toEqual([
    'Darkvision 60 ft.',
    'Link',
    'Share spells',
    'Evasion',
  ]);
  expect(progressionOf(result).sources).toContainEqual(
    expect.objectContaining({ book: 'Pathfinder RPG Ultimate Magic' }),
  );
  expect(
    checks(result).filter((check) => check.startsWith('companionProgression')),
  ).toEqual([]);
  // The same summoner level without the archetype: the whole level 7 row.
  const ordinary = calculateCharacterSheet(
    eidolon(),
    options([lesser(7, { ruleKind: 'eidolon' })]),
  );
  expect(ordinary).toMatchObject({
    hitDice: 6,
    companionProgression: { effectiveLevel: 7, evolutionPool: { total: 10 } },
  });
});

test('the minimum keeps a 1st- to 3rd-level master summoner’s eidolon at the level 1 row', () => {
  for (const level of [1, 2, 3]) {
    const result = calculateCharacterSheet(
      eidolon({ hpGained: 4 }),
      options([lesser(level)]),
    );
    expect(result).toMatchObject({
      hitDice: 1,
      derivedStatistics: { bab: { total: 1 } },
      companionProgression: {
        status: 'active',
        effectiveLevel: 1,
        evolutionPool: { total: 3 },
        contributions: [{ classLevels: level, effectiveLevel: 1 }],
      },
    });
  }
  const twentieth = calculateCharacterSheet(
    eidolon({ hpGained: 40 }),
    options([lesser(20)]),
  );
  // Level 10 row: HD 8, BAB +8, Evolution Pool 14, Max. Attacks 5.
  expect(twentieth).toMatchObject({
    hitDice: 8,
    derivedStatistics: { bab: { total: 8 } },
    companionProgression: {
      effectiveLevel: 10,
      evolutionPool: { total: 14 },
      budgets: { abilityIncreases: 2, maxAttacks: 5 },
    },
  });
  expect(progressionOf(twentieth).features).toContain('Devotion');
  // A biped's two claws: the level 9 row's extra attack, not Multiattack.
  expect(progressionOf(twentieth).features).toContain(
    'Extra natural attack at −5 (fewer than 3 natural attacks)',
  );
});

// "abilities, Hit Dice, evolution pool, and so on": the Special column, the
// evolutions' summoner-level minimums and the per-level evolution limits
// read the reduced level too.
test('evolution minimums, ability increases and Multiattack follow the reduced level', () => {
  const fifteenth = calculateCharacterSheet(
    eidolon({ hpGained: 30, evolutions: [{ key: 'large' }] }),
    options([lesser(15)]),
  );
  // Level 7: the large evolution needs summoner level 8.
  expect(progressionOf(fifteenth).evolutions).toContainEqual(
    expect.objectContaining({
      key: 'large',
      issues: ['Requires summoner level 8.'],
    }),
  );
  expect(progressionOf(fifteenth).budgets.abilityIncreases).toBe(1);
  expect(
    progressionOf(fifteenth).features.some((feature) =>
      feature.startsWith('Extra natural attack'),
    ),
  ).toBe(false);
  const sixteenth = calculateCharacterSheet(
    eidolon({ hpGained: 30, evolutions: [{ key: 'large' }] }),
    options([lesser(16)]),
  );
  expect(progressionOf(sixteenth).evolutions).toContainEqual(
    expect.objectContaining({ key: 'large', issues: [] }),
  );
  // Ability Increase "plus 1 additional time for every 6 levels": two
  // Strength increases need level 6, a master summoner level 12.
  const twice = eidolon({
    hpGained: 30,
    evolutions: [
      { key: 'abilityIncrease', choice: 'strength' },
      { key: 'abilityIncrease', choice: 'strength' },
    ],
  });
  const secondIncrease = (level: number) =>
    progressionOf(
      calculateCharacterSheet(twice, options([lesser(level)])),
    ).evolutions.filter((item) => item.origin === 'chosen')[1]?.issues;
  expect(secondIncrease(11)).toEqual([
    'Applies to one score at most 1 time at summoner level 5.',
  ]);
  expect(secondIncrease(12)).toEqual([]);
});

test('the eidolon’s own Intelligence adjusts its ranks per reduced HD, as for any eidolon', () => {
  const result = calculateCharacterSheet(
    eidolon({}, { ...bipedScores, intelligence: 13 }),
    options([lesser(7)]),
  );
  // 3 HD × (6 + Int +1).
  expect(result.budgets).toMatchObject({ skillRanks: 21, skillRankCap: 3 });
});

test('a reduced source replaces an ordinary summoner contribution whatever the order', () => {
  for (const sources of [
    [lesser(7, { sourceKey: 'class', ruleKind: 'eidolon' }), lesser(7)],
    [lesser(7), lesser(7, { sourceKey: 'class', ruleKind: 'eidolon' })],
  ]) {
    const result = calculateCharacterSheet(eidolon(), options(sources));
    expect(progressionOf(result)).toMatchObject({
      effectiveLevel: 3,
      hitDice: 3,
      contributions: [{ kind: 'reduced', effectiveLevel: 3 }],
    });
    expect(progressionOf(result).contributions).toHaveLength(1);
  }
});

test('a level loss shrinks the reduced row and keeps every choice; restoring the level restores it', () => {
  // Large (4 points), bite and reach (1 each) spend 6 points.
  const state = eidolon({
    hpGained: 12,
    evolutions: [{ key: 'large' }, { key: 'bite' }, { key: 'reach' }],
  });
  const before = calculateCharacterSheet(state, options([lesser(16)]));
  expect(progressionOf(before)).toMatchObject({
    effectiveLevel: 8,
    hitDice: 6,
    evolutionPool: { total: 11, spent: 6, remaining: 5 },
  });
  const reduced = calculateCharacterSheet(state, options([lesser(9)]));
  expect(progressionOf(reduced)).toMatchObject({
    effectiveLevel: 4,
    hitDice: 3,
    evolutionPool: { total: 7, spent: 6, remaining: 1 },
  });
  expect(progressionOf(reduced).evolutions.map(({ key }) => key)).toEqual(
    expect.arrayContaining(['large', 'bite', 'reach']),
  );
  expect(checks(reduced)).toContain('eidolonEvolutionRequirement');
  const lower = calculateCharacterSheet(state, options([lesser(7)]));
  expect(progressionOf(lower).evolutionPool).toMatchObject({
    total: 5,
    remaining: -1,
  });
  expect(checks(lower)).toContain('eidolonEvolutionPoolBudget');
  expect(
    calculateCharacterSheet(state, options([lesser(16)])).companionProgression,
  ).toEqual(before.companionProgression);
});

test('an unavailable summoner level stays unresolved; a saved fallback is the summoner level, halved after', () => {
  const hidden = calculateCharacterSheet(eidolon(), options([lesser(null)]));
  expect(hidden).toMatchObject({
    hitDice: null,
    companionProgression: {
      status: 'unresolved',
      effectiveLevel: null,
      hitDice: null,
      contributions: [
        {
          kind: 'reduced',
          classLevels: null,
          effectiveLevel: null,
          reduction: { steps: [] },
          resolution: 'unresolved',
        },
      ],
    },
  });
  expect(checks(hidden)).toContain('companionProgressionUnresolved');
  const fallback = calculateCharacterSheet(
    eidolon(),
    options([lesser(null)], 9),
  );
  expect(fallback).toMatchObject({
    hitDice: 3,
    companionProgression: {
      status: 'active',
      effectiveLevel: 4,
      contributions: [
        {
          classLevels: 9,
          effectiveLevel: 4,
          resolution: 'fallback',
          fallbackState: 'applied',
        },
      ],
    },
  });
});

test('losing the Lesser Eidolon source keeps every choice; restoring it restores the same results', () => {
  const state = eidolon({ evolutions: [{ key: 'bite' }] });
  const active = calculateCharacterSheet(state, options([lesser(7)]));
  const lost = calculateCharacterSheet(
    state,
    options([lesser(7, { counting: false })]),
  );
  expect(lost).toMatchObject({
    hitDice: null,
    companionProgression: {
      status: 'dormant',
      effectiveLevel: null,
      contributions: [
        { kind: 'reduced', counting: false, effectiveLevel: null },
      ],
      evolutions: expect.arrayContaining([
        expect.objectContaining({ key: 'bite' }),
      ]),
    },
  });
  expect(
    calculateCharacterSheet(state, options([lesser(7)])).companionProgression,
  ).toEqual(active.companionProgression);
});

test('conflicting progression rules on one source leave the eidolon unresolved with every choice kept', () => {
  const state = eidolon({ evolutions: [{ key: 'bite' }] });
  const result = calculateCharacterSheet(
    state,
    options([
      lesser(7, {
        sourceKey: 'class',
        ruleKind: 'eidolon',
        ruleConflict: {
          disclosure: 'disclosed',
          ruleKinds: ['broodmasterEidolon', 'masterSummonerEidolon'],
        },
      }),
    ]),
  );
  expect(result).toMatchObject({
    hitDice: null,
    companionProgression: {
      status: 'unresolved',
      effectiveLevel: null,
      hitDice: null,
      evolutionPool: { total: null },
      contributions: [
        {
          kind: 'ordinary',
          sourceKey: 'class',
          classLevels: 7,
          effectiveLevel: null,
          ruleConflict: {
            disclosure: 'disclosed',
            ruleKinds: ['broodmasterEidolon', 'masterSummonerEidolon'],
          },
        },
      ],
      evolutions: expect.arrayContaining([
        expect.objectContaining({ key: 'bite' }),
      ]),
    },
  });
  const conflict = result.warnings.find(
    (warning) => warning.check === 'companionProgressionRuleConflict',
  );
  expect(conflict?.message).toBe(
    'Broodmaster and Master Summoner each change how this eidolon advances from the same summoner levels, and no published rule decides between them. Every recorded choice and share is kept; turn one of the Archetypes off to calculate the eidolon.',
  );
  expect(checks(result)).not.toContain('companionProgressionUnresolved');
});

test('a conflicted source is an ordinary eidolon contribution whatever kind a caller passes', () => {
  const { companionProgressionSources, companionLinkedInputs } = options([
    lesser(7, {
      ruleConflict: {
        disclosure: 'disclosed',
        ruleKinds: ['broodmasterEidolon', 'masterSummonerEidolon'],
      },
    }),
  ]);
  expect(
    progressionContributions({
      sources: companionProgressionSources,
      linkedInputs: companionLinkedInputs,
      ruleKinds: ['eidolon', 'masterSummonerEidolon'],
    }),
  ).toMatchObject([
    {
      kind: 'ordinary',
      ruleKind: 'eidolon',
      classLevels: 7,
      effectiveLevel: null,
      ruleConflict: {
        disclosure: 'disclosed',
        ruleKinds: ['broodmasterEidolon', 'masterSummonerEidolon'],
      },
    },
  ]);
});

test('an Unchained eidolon never counts a Master Summoner source', () => {
  const result = calculateCharacterSheet(
    eidolon({ version: 'unchained', subtype: 'angel' }),
    options([lesser(7)]),
  );
  expect(progressionOf(result)).toMatchObject({
    status: 'unresolved',
    versionMismatch: true,
    effectiveLevel: null,
    contributions: [{ ruleKind: 'masterSummonerEidolon', counting: false }],
  });
});
