import { expect, test } from 'vitest';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  calculateCharacterSheetProjections,
  type CharacterSheetInput,
} from './character-sheet';
import type { EidolonProgressionState } from './character-sheet-eidolon-progression';
import { resolveCompanionLinkedInput } from './character-sheet-linked-inputs';

// APG base forms: Biped Str 16, Dex 12, Con 13, Int 7, Wis 10, Cha 11.
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
      hpGained: 22,
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
type Source = { sourceKey: string; counting: boolean; level: number | null };
function options(
  sources: Source[] | number = [
    { sourceKey: 'eidolon-feature', counting: true, level: 5 },
  ],
  fallback?: number,
) {
  const list =
    typeof sources === 'number'
      ? [{ sourceKey: 'eidolon-feature', counting: true, level: sources }]
      : sources;
  return {
    companionProgressionSources: list.map(({ sourceKey, counting }) => ({
      sourceKey,
      ruleKind: 'eidolon' as const,
      counting,
    })),
    companionLinkedInputs: [
      resolveCompanionLinkedInput({
        input: { kind: 'classLevels', classRuleIdentity: 'summoner' },
        candidates: list
          .filter((source) => source.counting)
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

// APG Table 2–9, summoner level 5: HD 4, BAB +4, good +4, bad +1, Skills 16,
// Feats 2, Armor +4, Str/Dex +2, Evolution Pool 8, Max. Attacks 4.
test('summoner level 5 gives a biped its table statistics without inventing Class Levels', () => {
  const result = calculateCharacterSheet(eidolon(), options(5));
  expect(result).toMatchObject({
    level: 0,
    classLevels: [],
    racialHitDice: 0,
    hitDice: 4,
    // 22 recorded + Con +1 per HD.
    hp: 26,
    abilities: {
      strength: { score: 18 },
      dexterity: { score: 14 },
      constitution: { score: 13 },
      intelligence: { score: 7 },
    },
    derivedStatistics: {
      bab: { total: 4 },
      // Biped saves: Fort and Will good.
      fortitude: { total: 5 },
      reflex: { total: 3 },
      will: { total: 4 },
      // 10 + Dex 2 + natural armor (form 2 + table 4).
      ac: { total: 18 },
    },
    budgets: {
      kind: 'eidolon',
      generalFeats: 2,
      skillRanks: 16,
      skillRankCap: 4,
    },
    companionProgression: {
      kind: 'eidolon',
      status: 'active',
      baseForm: 'biped',
      effectiveLevel: 5,
      hitDice: 4,
      size: 'medium',
      budgets: {
        generalFeats: 2,
        skillRanks: 16,
        abilityIncreases: 1,
        maxAttacks: 4,
      },
      armor: { total: 4, armor: 0, natural: 6 },
      strengthDexterityBonus: 2,
      evolutionPool: {
        total: 8,
        spent: 0,
        remaining: 8,
        sources: [
          {
            sourceKey: 'eidolon-feature',
            classRuleIdentity: 'summoner',
            points: 8,
          },
        ],
      },
      naturalAttacks: [
        {
          type: 'claw',
          count: 2,
          role: 'primary',
          dice: '1d4',
          evolutions: [{ key: 'claws', free: true }],
          recorded: 0,
        },
      ],
      attackCount: 2,
      features: ['Darkvision 60 ft.', 'Link', 'Share spells', 'Evasion'],
    },
  });
  expect(
    result.skills.find((skill) => skill.key === 'skill.per'),
  ).toMatchObject({ classSkill: true });
  expect(checks(result)).toContain('eidolonEvolutionPointsUnspent');
});

test('evolutions spend the pool, add their effects and natural attacks', () => {
  const result = calculateCharacterSheet(
    eidolon({
      abilityIncreases: ['dexterity'],
      evolutions: [
        { key: 'bite' },
        { key: 'improvedNaturalArmor' },
        { key: 'abilityIncrease', choice: 'strength' },
        { key: 'skilled', choice: 'skill.per' },
        { key: 'limbs', choice: 'arms' },
        { key: 'slam', choice: 'replacesBaseClaws' },
      ],
    }),
    options(5),
  );
  expect(result).toMatchObject({
    abilities: {
      strength: { score: 20 },
      dexterity: { score: 15 },
    },
    derivedStatistics: { ac: { total: 20 } },
    companionProgression: {
      evolutionPool: { total: 8, spent: 8, remaining: 0 },
      armor: { natural: 8 },
      attackCount: 2,
      naturalAttacks: [
        expect.objectContaining({ type: 'bite', count: 1, dice: '1d6' }),
        expect.objectContaining({
          type: 'slam',
          count: 1,
          role: 'primary',
          dice: '1d8',
        }),
      ],
    },
  });
  // Skilled: +8 racial; no ranks, so no class-skill bonus.
  expect(result.breakdowns['skill.per'].total).toBe(8);
  expect(checks(result)).not.toContain('eidolonEvolutionPointsUnspent');
  expect(checks(result)).not.toContain('eidolonEvolutionPoolBudget');
});

test('over-budget and unmet evolutions are preserved, calculated and warned', () => {
  const evolutions = [
    { key: 'bite' as const },
    { key: 'tentacle' as const },
    { key: 'tentacle' as const },
    { key: 'large' as const },
    { key: 'pounce' as const },
    { key: 'scent' as const },
    { key: 'scent' as const },
  ];
  const input = eidolon({ evolutions });
  const result = calculateCharacterSheet(input, options(5));
  expect(input.companionProgression.evolutions).toEqual(evolutions);
  expect(result).toMatchObject({
    abilities: {
      strength: { score: 26 },
      dexterity: { score: 12 },
      constitution: { score: 17 },
    },
    companionProgression: {
      size: 'large',
      evolutionPool: { total: 8, spent: 10, remaining: -2 },
      attackCount: 5,
      naturalAttacks: expect.arrayContaining([
        expect.objectContaining({ type: 'claw', dice: '1d6' }),
      ]),
      evolutions: expect.arrayContaining([
        expect.objectContaining({
          key: 'large',
          cost: 4,
          issues: ['Requires summoner level 8.'],
        }),
        expect.objectContaining({
          key: 'pounce',
          issues: ['Only for the Quadruped base form.'],
        }),
      ]),
    },
  });
  expect(checks(result)).toEqual(
    expect.arrayContaining([
      'eidolonEvolutionPoolBudget',
      'eidolonMaxAttacks',
      'eidolonEvolutionRequirement',
    ]),
  );
  const restored = calculateCharacterSheet(input, options(13));
  expect(checks(restored)).not.toContain('eidolonEvolutionPoolBudget');
  expect(checks(restored)).not.toContain('eidolonMaxAttacks');
});

// Partial source loss and restoration (#249): a summoner level drop shrinks
// HD and the pool; restoring the level brings the same selections back.
test('a summoner level drop shrinks HD and the pool, and restoring it brings selections back', () => {
  const input = eidolon({
    evolutions: [
      { key: 'bite' },
      { key: 'flight', choice: 'wings' },
      { key: 'wingBuffet' },
      { key: 'improvedNaturalArmor' },
      { key: 'limbs', choice: 'legs' },
      { key: 'abilityIncrease', choice: 'strength' },
      { key: 'gore' },
    ],
  });
  const full = calculateCharacterSheet(input, options(8));
  expect(full).toMatchObject({
    hitDice: 6,
    companionProgression: {
      effectiveLevel: 8,
      evolutionPool: { total: 11, spent: 11 },
    },
  });
  expect(checks(full)).not.toContain('eidolonEvolutionPoolBudget');
  const reduced = calculateCharacterSheet(input, options(5));
  expect(reduced).toMatchObject({
    hitDice: 4,
    companionProgression: {
      effectiveLevel: 5,
      evolutionPool: { total: 8, spent: 11, remaining: -3 },
      evolutions: expect.arrayContaining([
        expect.objectContaining({ key: 'gore' }),
      ]),
    },
  });
  expect(checks(reduced)).toContain('eidolonEvolutionPoolBudget');
  expect(input.companionProgression.evolutions).toHaveLength(7);
  const restored = calculateCharacterSheet(input, options(8));
  expect(restored.companionProgression).toEqual(full.companionProgression);
  expect(restored.warnings).toEqual(full.warnings);
});

test('losing one of two summoner sources keeps the eidolon and losing both retains choices', () => {
  const input = eidolon({
    abilityIncreases: ['strength'],
    skillRanks: { 'skill.per': 4 },
    evolutions: [{ key: 'abilityIncrease', choice: 'strength' }],
  });
  const both = [
    { sourceKey: 'eidolon-feature', counting: true, level: 5 },
    { sourceKey: 'summoner-level', counting: true, level: 5 },
  ];
  const active = calculateCharacterSheet(input, options(both));
  expect(active.companionProgression).toMatchObject({
    effectiveLevel: 5,
    contributions: [expect.objectContaining({ sourceKey: 'eidolon-feature' })],
    evolutionPool: {
      total: 8,
      sources: [expect.objectContaining({ sourceKey: 'eidolon-feature' })],
    },
  });
  const partial = calculateCharacterSheet(
    input,
    options([{ ...both[0]!, counting: false }, both[1]!]),
  );
  expect(partial).toMatchObject({
    hitDice: 4,
    abilities: { strength: { score: 21 } },
    companionProgression: {
      status: 'active',
      effectiveLevel: 5,
      evolutionPool: {
        total: 8,
        sources: [
          expect.objectContaining({ sourceKey: 'summoner-level', points: 8 }),
        ],
      },
    },
  });
  const lost = options(both.map((source) => ({ ...source, counting: false })));
  const dormant = calculateCharacterSheet(input, lost);
  expect(dormant).toMatchObject({
    hitDice: null,
    hp: null,
    abilities: { strength: { score: 16 } },
    companionProgression: {
      status: 'dormant',
      hitDice: null,
      evolutionPool: { total: null, remaining: null },
      budgets: { maxAttacks: null },
    },
  });
  expect(checks(dormant)).toContain('companionProgressionDormant');
  expect(checks(dormant)).not.toContain('eidolonEvolutionPoolBudget');
  input.companionProgression.keep = true;
  const kept = calculateCharacterSheet(input, lost);
  expect(kept).toMatchObject({
    hitDice: null,
    abilities: { strength: { score: 19 } },
    companionProgression: { status: 'dormant', retained: true },
  });
  expect(kept.skills.find((skill) => skill.key === 'skill.per')?.ranks).toBe(4);
});

test('an unavailable summoner level stays unresolved until a saved fallback applies', () => {
  const input = eidolon();
  const unresolved = calculateCharacterSheet(
    input,
    options([{ sourceKey: 'eidolon-feature', counting: true, level: null }]),
  );
  expect(unresolved).toMatchObject({
    hitDice: null,
    hp: null,
    companionProgression: {
      status: 'unresolved',
      effectiveLevel: null,
      evolutionPool: { total: null },
      budgets: { skillRanks: null },
    },
  });
  expect(unresolved.affectedStatisticTargets).toEqual(
    expect.arrayContaining(['hitDice', 'bab', 'derived.ac']),
  );
  expect(checks(unresolved)).toContain('companionProgressionUnresolved');
  const fallback = calculateCharacterSheet(
    input,
    options([{ sourceKey: 'eidolon-feature', counting: true, level: null }], 3),
  );
  expect(fallback.companionProgression).toMatchObject({
    status: 'active',
    effectiveLevel: 3,
    hitDice: 3,
    contributions: [{ resolution: 'fallback', fallbackState: 'applied' }],
    evolutionPool: { total: 5 },
  });
});

// Explicit companion tables override ordinary per-HD formulas; Huge
// replaces, and does not stack with, Large (APG Large evolution).
test('the eidolon table replaces racial Hit Dice, keeps real Class Levels, and Huge replaces Large', () => {
  const input = eidolon({
    evolutions: [
      { key: 'large', upgrades: 1 },
      { key: 'abilityIncrease', choice: 'strength' },
    ],
  });
  input.racialHitDice = {
    count: 2,
    hpGained: 99,
    progression: {
      bab: 'threeQuarters',
      saves: { fort: 'good', ref: 'good', will: 'poor' },
      skillRanksPerHitDie: 2,
    },
  };
  input.entries = [
    ...input.entries,
    {
      _id: 'fighter-row',
      kind: 'classLevel',
      active: true,
      state: {
        kind: 'classLevel',
        position: 1,
        classEntryId: 'fighter',
        hpGained: 10,
      },
    },
  ];
  input.catalogEntries = [
    ...input.catalogEntries,
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
        classSkills: [],
      },
    },
  ];
  // Summoner 13: HD 10, BAB +10, Str/Dex +5, natural armor 2 + 10.
  const result = calculateCharacterSheet(input, options(13));
  expect(result).toMatchObject({
    level: 1,
    racialHitDice: 2,
    hitDice: 11,
    derivedStatistics: { bab: { total: 11 } },
    abilities: {
      strength: { score: 16 + 5 + 16 + 2 },
      dexterity: { score: 12 + 5 - 4 },
      constitution: { score: 13 + 8 },
    },
    companionProgression: {
      size: 'huge',
      hitDice: 10,
      armor: { natural: 2 + 10 + 5 },
      // Large 4 + Huge 6 + Strength increase of a Huge eidolon 4.
      evolutionPool: { total: 17, spent: 14 },
    },
  });
  expect(input.racialHitDice.count).toBe(2);
});

test('the table armor bonus can be split into an armor bonus without exceeding the table', () => {
  const split = calculateCharacterSheet(
    eidolon({ armorBonusAsArmor: 3 }),
    options(5),
  );
  expect(split).toMatchObject({
    breakdowns: { 'ac.armor': { total: 3 }, 'ac.natural': { total: 3 } },
    derivedStatistics: { ac: { total: 18 }, touchAc: { total: 12 } },
    companionProgression: { armor: { total: 4, armor: 3, natural: 3 } },
  });
  const over = calculateCharacterSheet(
    eidolon({ armorBonusAsArmor: 6 }),
    options(5),
  );
  expect(over.companionProgression).toMatchObject({
    armor: { total: 4, armor: 4, natural: 2 },
  });
  expect(checks(over)).toContain('eidolonArmorBonusSplit');
});

test('per-score, per-level and choice limits warn without trimming choices', () => {
  const result = calculateCharacterSheet(
    eidolon({
      classSkills: [
        'skill.acr',
        'skill.clm',
        'skill.swm',
        'skill.int',
        'skill.esc',
      ],
      skillRanks: { 'skill.per': 5 },
      evolutions: [
        { key: 'abilityIncrease', choice: 'strength' },
        { key: 'abilityIncrease', choice: 'strength' },
        { key: 'improvedNaturalArmor' },
        { key: 'improvedNaturalArmor' },
        { key: 'skilled' },
      ],
    }),
    options(5),
  );
  expect(result).toMatchObject({
    abilities: { strength: { score: 22 } },
    companionProgression: { armor: { natural: 10 } },
  });
  expect(checks(result)).toEqual(
    expect.arrayContaining([
      'eidolonEvolutionRequirement',
      'eidolonEvolutionChoiceMissing',
      'eidolonClassSkillCount',
      'companionSkillRankCap',
      'companionAbilityIncreaseBudget',
    ]),
  );
});

test('flight makes Fly a class skill and Small applies its form adjustments', () => {
  const result = calculateCharacterSheet(
    eidolon({
      size: 'small',
      evolutions: [{ key: 'flight', choice: 'wings' }],
    }),
    options(5),
  );
  expect(result).toMatchObject({
    abilities: {
      strength: { score: 14 },
      dexterity: { score: 16 },
      constitution: { score: 11 },
    },
    companionProgression: {
      size: 'small',
      naturalAttacks: [expect.objectContaining({ type: 'claw', dice: '1d3' })],
    },
  });
  expect(
    result.skills.find((skill) => skill.key === 'skill.fly'),
  ).toMatchObject({ classSkill: true });
});

test('base scores different from the base form warn while the recorded scores stay', () => {
  const result = calculateCharacterSheet(
    eidolon({}, { ...bipedScores, strength: 18 }),
    options(5),
  );
  expect(result.abilities.strength.score).toBe(20);
  expect(checks(result)).toContain('eidolonBaseFormScores');
});

test('a summoner level 9 eidolon with three natural attacks gains Multiattack', () => {
  const result = calculateCharacterSheet(
    eidolon({ evolutions: [{ key: 'bite' }] }),
    options(9),
  );
  expect(result.companionProgression).toMatchObject({
    multiattack: true,
    features: expect.arrayContaining(['Multiattack']),
  });
  const two = calculateCharacterSheet(eidolon(), options(9));
  expect(two.companionProgression).toMatchObject({ multiattack: false });
});

// #249/#302: permanent Intelligence applies retroactively to the eidolon's
// 6 + Int per HD skill ranks; Temporary Effects stay out of permanent facts.
test('ordinary and permanent projections share permanent-Int ranks and differ only by Temporary Effects', () => {
  const input = eidolon({
    evolutions: [{ key: 'abilityIncrease', choice: 'intelligence' }],
  });
  input.entries = [
    ...input.entries,
    {
      _id: 'effect-row',
      kind: 'spellEffect',
      active: true,
      catalogEntryId: 'effect',
      state: { kind: 'spellEffect', casterLevel: 3 },
    },
  ];
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'effect',
      ruleIdentity: 'effect',
      modifiers: [
        { target: 'ability.int', bonusType: 'enhancement', value: 4 },
        { target: 'ability.str', bonusType: 'enhancement', value: 4 },
      ],
      detail: { kind: 'spellEffect' },
    },
  ];
  const { current, permanent } = calculateCharacterSheetProjections(
    input,
    options(5),
  );
  // Int 9 (−1): 5 ranks per HD for 4 HD.
  expect(current).toMatchObject({
    hitDice: 4,
    abilities: { intelligence: { score: 13 }, strength: { score: 22 } },
    budgets: { skillRanks: 20 },
    companionProgression: { budgets: { skillRanks: 20 } },
  });
  expect(permanent).toMatchObject({
    hitDice: 4,
    abilities: { intelligence: { score: 9 }, strength: { score: 18 } },
    budgets: { skillRanks: 20 },
    companionProgression: { budgets: { skillRanks: 20 } },
  });
});

test('animal and eidolon progressions ignore each other’s supporting sources', () => {
  const eidolonResult = calculateCharacterSheet(eidolon(), {
    companionProgressionSources: [
      { sourceKey: 'nature-bond', ruleKind: 'druidCompanion', counting: true },
    ],
    companionLinkedInputs: [
      resolveCompanionLinkedInput({
        input: { kind: 'classLevels', classRuleIdentity: 'druid' },
        candidates: [{ sourceKey: 'nature-bond', kind: 'available', value: 5 }],
      }),
    ],
  });
  expect(eidolonResult.companionProgression).toMatchObject({
    kind: 'eidolon',
    status: 'dormant',
    contributions: [],
  });
});

// APG Table 2–9 Multiattack: a bonus feat with 3 or more natural attacks, so
// secondary natural attacks take −2 instead of −5 (CRB p. 182).
test('granted Multiattack reaches recorded secondary natural attacks', () => {
  const input = eidolon({
    evolutions: [{ key: 'bite' }, { key: 'tail' }, { key: 'tailSlap' }],
  });
  const natural = (id: string, type: 'bite' | 'tailSlap', dice: string) => ({
    _id: id,
    name: id,
    ruleIdentity: `natural-${id}`,
    modifiers: [],
    detail: {
      kind: 'item' as const,
      weapon: {
        baseType: id,
        proficiency: 'simple' as const,
        handedness: 'light' as const,
        attackType: 'melee' as const,
        dice,
        threat: 20,
        mult: 2,
        naturalAttack: { type },
      },
    },
  });
  input.entries = [
    ...input.entries,
    ...['bite', 'tail-slap'].map((id) => ({
      _id: id,
      kind: 'item' as const,
      active: true,
      catalogEntryId: id,
      state: { kind: 'item' as const },
    })),
    {
      _id: 'routine',
      kind: 'attackRoutine',
      active: true,
      state: {
        kind: 'attackRoutine',
        name: 'Bite',
        weaponEntryId: 'bite',
        hands: 'one',
        mode: 'melee',
        naturalAttackEntryIds: ['tail-slap'],
      },
    },
  ];
  input.catalogEntries = [
    ...input.catalogEntries,
    natural('bite', 'bite', '1d6'),
    natural('tail-slap', 'tailSlap', '1d6'),
  ];
  const result = calculateCharacterSheet(input, options(9));
  expect(result.companionProgression).toMatchObject({
    multiattack: true,
    naturalAttacks: expect.arrayContaining([
      expect.objectContaining({ type: 'bite', recorded: 1 }),
      expect.objectContaining({ type: 'tailSlap', recorded: 1 }),
      expect.objectContaining({ type: 'claw', recorded: 0 }),
    ]),
  });
  const secondary = result.attackRoutines[0]?.full.at(-1);
  expect(secondary?.naturalRole).toBe('secondary');
  expect(secondary?.attackBonus.applied).toContainEqual(
    expect.objectContaining({
      sheetEntryId: 'builtin:eidolon:multiattack',
      value: -2,
    }),
  );
});

function issuesOf(
  result: ReturnType<typeof calculateCharacterSheet>,
  key: string,
) {
  const progression = result.companionProgression;
  return progression?.kind === 'eidolon'
    ? progression.evolutions
        .filter((item) => !item.free && item.key === key)
        .map((item) => item.issues)
    : [];
}

// APG Ability Increase: “It can only be applied once to an individual ability
// score, plus 1 additional time for every 6 levels the summoner possesses.”
test('Ability Increase applies to one score once, plus once more per 6 summoner levels', () => {
  const strength = (times: number) =>
    eidolon({
      evolutions: Array.from({ length: times }, () => ({
        key: 'abilityIncrease' as const,
        choice: 'strength',
      })),
    });
  expect(
    issuesOf(
      calculateCharacterSheet(strength(2), options(5)),
      'abilityIncrease',
    ),
  ).toEqual([[], ['Applies to one score at most 1 time at summoner level 5.']]);
  expect(
    issuesOf(
      calculateCharacterSheet(strength(3), options(6)),
      'abilityIncrease',
    ),
  ).toEqual([
    [],
    [],
    ['Applies to one score at most 2 times at summoner level 6.'],
  ]);
  expect(
    issuesOf(
      calculateCharacterSheet(strength(4), options(12)),
      'abilityIncrease',
    ),
  ).toEqual([
    [],
    [],
    [],
    ['Applies to one score at most 3 times at summoner level 12.'],
  ]);
});

// APG Reach: “Pick one attack.” It carries no “more than once” clause.
test('Reach is selected once, whichever attack a second selection names', () => {
  const result = calculateCharacterSheet(
    eidolon({
      evolutions: [
        { key: 'bite' },
        { key: 'reach', choice: 'claw' },
        { key: 'reach', choice: 'bite' },
      ],
    }),
    options(5),
  );
  expect(issuesOf(result, 'reach')).toEqual([[], ['Selected more than once.']]);
});

test('a required evolution with a named choice needs that choice', () => {
  const result = calculateCharacterSheet(
    eidolon({
      evolutions: [
        { key: 'flight', choice: 'magic' },
        { key: 'wingBuffet' },
        { key: 'grab', choice: 'claw' },
        { key: 'swallowWhole' },
      ],
    }),
    options(9),
  );
  expect(issuesOf(result, 'wingBuffet')).toEqual([
    ['Requires flight with wings.'],
  ]);
  expect(issuesOf(result, 'swallowWhole')).toEqual([
    ['Requires grab with bite.'],
  ]);
  const met = calculateCharacterSheet(
    eidolon({
      evolutions: [
        { key: 'flight', choice: 'wings' },
        { key: 'wingBuffet' },
        { key: 'grab', choice: 'bite' },
        { key: 'swallowWhole' },
      ],
    }),
    options(9),
  );
  expect(issuesOf(met, 'wingBuffet')).toEqual([[]]);
  expect(issuesOf(met, 'swallowWhole')).toEqual([[]]);
});

test('the evolution pool lives on its supporting source, not the eidolon’s budgets', () => {
  const progression = calculateCharacterSheet(
    eidolon(),
    options(5),
  ).companionProgression;
  expect(
    progression?.kind === 'eidolon' && progression.budgets,
  ).not.toHaveProperty('evolutionPoints');
});
