import { expect, test } from 'vitest';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  type CharacterSheetInput,
} from './character-sheet';
import type { EidolonProgressionState } from './character-sheet-eidolon-progression';
import { resolveCompanionLinkedInput } from './character-sheet-linked-inputs';

// Unchained base forms share the APG scores: Biped Str 16, Dex 12, Con 13.
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
          value: bipedScores[ability],
        })),
      },
    ],
    companionProgression: {
      kind: 'eidolon',
      version: 'unchained',
      subtype: 'angel',
      subtypeChoices: [],
      baseForm: 'biped',
      size: 'medium',
      hpGained: 20,
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
function options(
  level: number,
  {
    ruleKind = 'unchainedEidolon',
    unsupportedArchetypes,
  }: {
    ruleKind?: 'eidolon' | 'unchainedEidolon';
    unsupportedArchetypes?: string[];
  } = {},
) {
  return {
    companionProgressionSources: [
      {
        sourceKey: 'eidolon-feature',
        ruleKind,
        counting: true,
        ...(unsupportedArchetypes ? { unsupportedArchetypes } : {}),
      },
    ],
    companionLinkedInputs: [
      resolveCompanionLinkedInput({
        input: { kind: 'classLevels', classRuleIdentity: 'summoner' },
        candidates: [
          { sourceKey: 'eidolon-feature', kind: 'available', value: level },
        ],
      }),
    ],
  };
}
function checks(result: ReturnType<typeof calculateCharacterSheet>) {
  return result.warnings.map((warning) => warning.check);
}
function warning(
  result: ReturnType<typeof calculateCharacterSheet>,
  check: string,
) {
  return result.warnings.find((item) => item.check === check);
}
function progressionOf(result: ReturnType<typeof calculateCharacterSheet>) {
  const progression = result.companionProgression;
  if (progression?.kind !== 'eidolon') throw new Error('Missing eidolon');
  return progression;
}

// Unchained Eidolon Base Statistics, level 4: HD 3, BAB +3, good +3, poor +1,
// Feats 2, Armor +2, Str/Dex +1, Evolution Pool 3, Max. Attacks 4.
test('an angel at summoner level 4 uses the Unchained table, its subtype base form and fixed evolutions', () => {
  const result = calculateCharacterSheet(eidolon(), options(4));
  expect(result).toMatchObject({
    hitDice: 3,
    // 20 recorded + Con +1 per HD.
    hp: 23,
    abilities: { strength: { score: 17 }, dexterity: { score: 13 } },
    derivedStatistics: {
      bab: { total: 3 },
      fortitude: { total: 4 },
      reflex: { total: 2 },
      will: { total: 3 },
    },
    companionProgression: {
      kind: 'eidolon',
      version: 'unchained',
      versionMismatch: false,
      status: 'active',
      effectiveLevel: 4,
      hitDice: 3,
      subtype: {
        key: 'angel',
        name: 'Angel',
        alignment: 'Any good',
        element: null,
      },
      evolutionPool: {
        total: 3,
        spent: 0,
        remaining: 3,
        bonuses: [],
        sources: [
          expect.objectContaining({
            sourceKey: 'eidolon-feature',
            ruleKind: 'unchainedEidolon',
            points: 3,
          }),
        ],
      },
      budgets: { maxAttacks: 4 },
      naturalAttacks: [
        expect.objectContaining({
          type: 'slam',
          count: 1,
          role: 'primary',
          dice: '1d8',
        }),
      ],
      attackCount: 1,
    },
  });
  const progression = progressionOf(result);
  expect(
    progression.evolutions.map(({ key, choice, origin, level, cost }) => [
      key,
      choice,
      origin,
      level,
      cost,
    ]),
  ).toEqual([
    ['limbs', 'arms', 'baseForm', null, 0],
    ['limbs', 'legs', 'baseForm', null, 0],
    ['slam', null, 'baseForm', null, 0],
    ['resistance', 'acid', 'subtype', 1, 0],
    ['resistance', 'cold', 'subtype', 1, 0],
  ]);
  expect(progression.features).toEqual(
    expect.arrayContaining([
      '+4 on saves against poison',
      'Electricity resistance 10 and fire resistance 10',
    ]),
  );
  expect(progression.sources).toContainEqual(
    expect.objectContaining({
      book: 'Pathfinder Unchained',
      pages: '29–34 (eidolon subtypes)',
    }),
  );
});

test('at 8th level an angel grows wings and at 16th its resistances become immunities', () => {
  const eighth = progressionOf(calculateCharacterSheet(eidolon(), options(8)));
  expect(eighth).toMatchObject({ evolutionPool: { total: 6 } });
  expect(eighth.evolutions).toContainEqual(
    expect.objectContaining({
      key: 'flight',
      choice: 'wings',
      origin: 'subtype',
      level: 8,
    }),
  );
  expect(eighth.classSkills).toContain('skill.fly');
  const sixteenth = progressionOf(
    calculateCharacterSheet(eidolon(), options(16)),
  );
  expect(
    sixteenth.evolutions
      .filter(({ origin }) => origin === 'subtype')
      .map(({ key, choice }) => [key, choice]),
  ).toEqual([
    ['immunity', 'acid'],
    ['immunity', 'cold'],
    ['flight', 'wings'],
  ]);
  expect(sixteenth.features).toContain('DR 5/evil');
});

test('an archon adds a pool point at 4th level, Skilled Intimidate and its chosen 8th-level ability increase', () => {
  const missing = calculateCharacterSheet(
    eidolon({ subtype: 'archon' }),
    options(8),
  );
  expect(progressionOf(missing)).toMatchObject({
    evolutionPool: {
      // Unchained pool 6 at 8th level, plus the archon's point from 4th.
      total: 7,
      bonuses: [{ label: 'Archon subtype (4th level)', points: 1 }],
    },
  });
  expect(progressionOf(missing).evolutions).toContainEqual(
    expect.objectContaining({
      key: 'abilityIncrease',
      origin: 'subtype',
      choiceKey: 'archon-abilityIncrease-8',
      missingChoice: true,
    }),
  );
  expect(warning(missing, 'eidolonSubtypeChoiceMissing')).toMatchObject({
    kind: 'incomplete',
    message: expect.stringContaining('Ability Increase (8th level)'),
  });
  const chosen = calculateCharacterSheet(
    eidolon({
      subtype: 'archon',
      subtypeChoices: [{ key: 'archon-abilityIncrease-8', choice: 'strength' }],
    }),
    options(8),
  );
  // Str 16 + table 3 + archon Ability Increase 2.
  expect(chosen.abilities.strength.score).toBe(21);
  expect(checks(chosen)).not.toContain('eidolonSubtypeChoiceMissing');
  // Skilled (Intimidate) is a +8 racial bonus.
  expect(chosen.breakdowns['skill.int'].total).toBe(8);
  expect(
    calculateCharacterSheet(eidolon(), options(8)).breakdowns['skill.int']
      .total,
  ).toBe(0);
});

test('subtype requirements and Unchained costs warn without trimming the recorded evolution', () => {
  const result = calculateCharacterSheet(
    eidolon({
      baseForm: 'biped',
      evolutions: [{ key: 'bite' }, { key: 'pounce' }],
    }),
    options(6),
  );
  const progression = progressionOf(result);
  expect(
    progression.evolutions.filter(({ origin }) => origin === 'chosen'),
  ).toEqual([
    expect.objectContaining({
      key: 'bite',
      cost: 1,
      issues: [
        'Only for the agathion, daemon, demon, devil, div, elemental, protean or psychopomp subtype.',
      ],
    }),
    expect.objectContaining({
      key: 'pounce',
      cost: 3,
      issues: [
        'Requires summoner level 7.',
        'Only for the Quadruped base form.',
      ],
    }),
  ]);
  expect(progression.evolutionPool).toMatchObject({
    total: 5,
    spent: 4,
    remaining: 1,
  });
  expect(progression.naturalAttacks.map(({ type }) => type)).toContain('bite');
  expect(checks(result)).toContain('eidolonEvolutionRequirement');
});

test('an original-only Damage Reduction choice and upgrade stay recorded but do not count on an Unchained eidolon', () => {
  const recorded = {
    subtype: 'demon' as const,
    baseForm: 'quadruped' as const,
    evolutions: [
      { key: 'damageReduction' as const, choice: 'good', upgrades: 1 },
    ],
  };
  const unchained = calculateCharacterSheet(eidolon(recorded), options(15));
  const item = progressionOf(unchained).evolutions.find(
    ({ key }) => key === 'damageReduction',
  );
  expect(item).toMatchObject({
    cost: 3,
    choice: 'good',
    upgrades: 1,
    dormant: ['choice', 'upgrades'],
    issues: [],
  });
  expect(progressionOf(unchained).features).toContain('DR 10/good');
  expect(warning(unchained, 'eidolonVersionUnavailable')).toMatchObject({
    message: expect.stringContaining('Damage Reduction'),
  });
  const original = calculateCharacterSheet(
    eidolon({ ...recorded, version: 'original' }),
    options(15, { ruleKind: 'eidolon' }),
  );
  expect(
    progressionOf(original).evolutions.find(
      ({ key }) => key === 'damageReduction',
    ),
  ).toMatchObject({ cost: 5, dormant: [], issues: [] });
  expect(warning(original, 'eidolonVersionUnavailable')?.message).toBe(
    'The Unchained subtype Demon is kept without counting on an original eidolon.',
  );
  // The Unchained subtype is kept but does not count on an original eidolon.
  expect(progressionOf(original)).toMatchObject({
    subtype: null,
    dormantChoices: [
      expect.objectContaining({
        kind: 'subtype',
        key: 'demon',
        reason: 'version',
      }),
    ],
  });
});

test('summoner levels of the other version leave the eidolon unresolved and keep every choice', () => {
  const state = { evolutions: [{ key: 'improvedNaturalArmor' as const }] };
  const mixed = calculateCharacterSheet(
    eidolon(state),
    options(8, { ruleKind: 'eidolon' }),
  );
  expect(mixed).toMatchObject({
    hitDice: null,
    companionProgression: {
      version: 'unchained',
      versionMismatch: true,
      status: 'unresolved',
      effectiveLevel: null,
      evolutionPool: { total: null },
      contributions: [
        expect.objectContaining({
          ruleKind: 'eidolon',
          classLevels: 8,
          counting: false,
        }),
      ],
    },
  });
  expect(warning(mixed, 'eidolonVersionMismatch')).toMatchObject({
    kind: 'unresolved',
    message: expect.stringContaining('original summoner levels'),
  });
  expect(checks(mixed)).not.toContain('companionProgressionUnresolved');
  const original = calculateCharacterSheet(
    eidolon({ ...state, version: 'original' }),
    options(8),
  );
  expect(original).toMatchObject({
    hitDice: null,
    companionProgression: {
      version: 'original',
      versionMismatch: true,
      status: 'unresolved',
    },
  });
  expect(warning(original, 'eidolonVersionMismatch')?.message).toContain(
    'Unchained summoner levels',
  );
  // Converting the eidolon to the summoner's version restores it.
  expect(
    calculateCharacterSheet(eidolon(state), options(8)).companionProgression,
  ).toMatchObject({ status: 'active', versionMismatch: false, hitDice: 6 });
});

// Pathfinder Unchained, Protean: the serpentine base form has “grab [tail
// slap]”, and at 1st level the eidolon also gains “the grab evolution, tied
// to an attack type of the summoner's choice”.
test('a protean gains its base form’s tail slap grab and a 1st-level grab on the attack the summoner chooses', () => {
  const protean = (subtypeChoices: EidolonProgressionState['subtypeChoices']) =>
    progressionOf(
      calculateCharacterSheet(
        eidolon({ subtype: 'protean', baseForm: 'serpentine', subtypeChoices }),
        options(1),
      ),
    );
  const grabs = (progression: ReturnType<typeof protean>) =>
    progression.evolutions
      .filter(({ key }) => key === 'grab')
      .map(({ origin, choice, choiceKey, missingChoice }) => ({
        origin,
        choice,
        choiceKey,
        missingChoice,
      }));
  const missing = protean([]);
  expect(grabs(missing)).toEqual([
    {
      origin: 'baseForm',
      choice: 'tailSlap',
      choiceKey: null,
      missingChoice: false,
    },
    {
      origin: 'subtype',
      choice: null,
      choiceKey: 'protean-grab-1',
      missingChoice: true,
    },
  ]);
  expect(missing.subtype?.missingChoices).toEqual(['protean-grab-1']);
  const chosen = protean([{ key: 'protean-grab-1', choice: 'bite' }]);
  expect(grabs(chosen)).toEqual([
    {
      origin: 'baseForm',
      choice: 'tailSlap',
      choiceKey: null,
      missingChoice: false,
    },
    {
      origin: 'subtype',
      choice: 'bite',
      choiceKey: 'protean-grab-1',
      missingChoice: false,
    },
  ]);
  expect(chosen.subtype?.missingChoices).toEqual([]);
});

test('a subtype change keeps the former subtype’s choices dormant and restores them on return', () => {
  const choices = [
    { key: 'archon-abilityIncrease-8' as const, choice: 'strength' },
  ];
  const angel = calculateCharacterSheet(
    eidolon({ subtype: 'angel', subtypeChoices: choices }),
    options(8),
  );
  expect(angel.abilities.strength.score).toBe(19);
  expect(progressionOf(angel).dormantChoices).toEqual([
    {
      kind: 'subtypeChoice',
      key: 'archon-abilityIncrease-8',
      label: 'Archon: Ability Increase (8th level)',
      choice: 'Strength',
      reason: 'subtype',
    },
  ]);
  const archon = calculateCharacterSheet(
    eidolon({ subtype: 'archon', subtypeChoices: choices }),
    options(8),
  );
  expect(archon.abilities.strength.score).toBe(21);
  expect(progressionOf(archon).dormantChoices).toEqual([]);
});

test('an elemental’s element chooses its immunity and 8th-level evolutions', () => {
  const missing = calculateCharacterSheet(
    eidolon({ subtype: 'elemental' }),
    options(8),
  );
  expect(progressionOf(missing).subtype).toMatchObject({ element: null });
  expect(warning(missing, 'eidolonSubtypeChoiceMissing')?.message).toContain(
    'Element',
  );
  const air = progressionOf(
    calculateCharacterSheet(
      eidolon({
        subtype: 'elemental',
        subtypeChoices: [{ key: 'elemental-element', choice: 'air' }],
      }),
      options(8),
    ),
  );
  expect(air).toMatchObject({
    subtype: { element: 'air' },
    // Pool 6 plus the elemental's point from 4th level.
    evolutionPool: { total: 7 },
  });
  expect(
    air.evolutions
      .filter(({ origin }) => origin === 'subtype')
      .map(({ key, choice }) => [key, choice]),
  ).toEqual([
    ['immunity', 'electricity'],
    ['flight', 'magic'],
  ]);
  const water = progressionOf(
    calculateCharacterSheet(
      eidolon({
        subtype: 'elemental',
        subtypeChoices: [{ key: 'elemental-element', choice: 'water' }],
      }),
      options(8),
    ),
  );
  expect(
    water.evolutions
      .filter(({ origin }) => origin === 'subtype')
      .map(({ key }) => key),
  ).toEqual(['immunity', 'swim', 'swim', 'gills']);
});

test('Unchained Large adds +4 Str and +2 Con, half the APG bonuses', () => {
  const result = calculateCharacterSheet(
    eidolon({ subtype: 'demon', evolutions: [{ key: 'large' }] }),
    options(8),
  );
  expect(result).toMatchObject({
    // Str 16 + table 3 + Large 4; Con 13 + Large 2; Dex 12 + 3 − 2.
    abilities: {
      strength: { score: 23 },
      constitution: { score: 15 },
      dexterity: { score: 13 },
    },
    companionProgression: { size: 'large' },
  });
});

test('a missing subtype or a base form the subtype does not offer warns and uses the plain base form', () => {
  const missing = calculateCharacterSheet(
    eidolon({ subtype: undefined }),
    options(4),
  );
  expect(progressionOf(missing)).toMatchObject({
    subtype: null,
    naturalAttacks: [expect.objectContaining({ type: 'claw', count: 2 })],
  });
  expect(warning(missing, 'eidolonSubtypeMissing')).toMatchObject({
    kind: 'incomplete',
  });
  const quadrupedAngel = calculateCharacterSheet(
    eidolon({ baseForm: 'quadruped' }),
    options(4),
  );
  expect(warning(quadrupedAngel, 'eidolonSubtypeBaseForm')?.message).toBe(
    'Angel eidolons use the Biped base form; the recorded Quadruped base form is kept.',
  );
  expect(progressionOf(quadrupedAngel).naturalAttacks).toEqual([
    expect.objectContaining({ type: 'bite' }),
  ]);
});

test('an original-summoner Archetype is never assumed to apply to an Unchained eidolon', () => {
  const result = calculateCharacterSheet(
    eidolon(),
    options(4, { unsupportedArchetypes: ['Evolutionist'] }),
  );
  expect(progressionOf(result)).toMatchObject({
    status: 'active',
    unsupportedArchetypes: ['Evolutionist'],
  });
  expect(warning(result, 'eidolonUnchainedArchetype')?.message).toBe(
    'Evolutionist was written for the original summoner; its eidolon changes are not applied to an Unchained eidolon.',
  );
  // The original eidolon does not read the Unchained-only note.
  const original = calculateCharacterSheet(
    eidolon({ version: 'original' }),
    options(4, {
      ruleKind: 'eidolon',
      unsupportedArchetypes: ['Evolutionist'],
    }),
  );
  expect(progressionOf(original).unsupportedArchetypes).toEqual([]);
});

test('an original eidolon without a version keeps its APG calculation', () => {
  const {
    version: _version,
    subtype: _subtype,
    subtypeChoices: _choices,
    ...state
  } = eidolon().companionProgression;
  const result = calculateCharacterSheet(
    { ...eidolon(), companionProgression: state },
    options(4, { ruleKind: 'eidolon' }),
  );
  expect(result.companionProgression).toMatchObject({
    version: 'original',
    status: 'active',
    // APG Table 2–9 pool at 4th level.
    evolutionPool: { total: 7, bonuses: [] },
    subtype: null,
    dormantChoices: [],
  });
});
