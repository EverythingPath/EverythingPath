import { expect, test } from 'vitest';
import {
  representativeClassCatalog,
  representativeClassCounterparts,
} from '../../convex/lib/representativeClassCatalog';
import { representativeArchetypeCatalog } from '../../convex/lib/representativeArchetypeCatalog';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  type CharacterSheetInput,
  type SheetEntry,
} from './character-sheet';
import { resolveCombinedForm } from './character-sheet-combined-form';
import type { CompanionProgressionSource } from './character-sheet-companion-sources';
import type { EidolonProgressionState } from './character-sheet-eidolon-progression';
import { resolveCompanionLinkedInput } from './character-sheet-linked-inputs';
import { heldRaceDefinition } from '../../tests/fixtures/races-328/sheet';

// Ultimate Magic pp. 80–81, Synthesist, Fused Eidolon: "In all other cases, this
// ability functions as the summoner's normal eidolon ability ... This ability
// replaces the class's eidolon ability, bond senses, and life bond."

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
        _id: 'eidolon-base',
        kind: 'base',
        active: true,
        catalogEntryId: 'eidolon-scores',
        state: { kind: 'base' },
      },
    ],
    catalogEntries: [
      {
        _id: 'eidolon-scores',
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
function eidolonOptions(
  level: number | null,
  ruleKind: CompanionProgressionSource['ruleKind'] = 'synthesistEidolon',
  extra: Partial<CompanionProgressionSource> = {},
  fallback?: number,
) {
  return {
    companionProgressionSources: [
      { sourceKey: 'fused-eidolon', ruleKind, counting: true, ...extra },
    ],
    companionLinkedInputs: [
      resolveCompanionLinkedInput({
        input: { kind: 'classLevels', classRuleIdentity: 'summoner' },
        candidates: [
          level === null
            ? {
                sourceKey: 'fused-eidolon',
                kind: 'unavailable',
                reason: 'inaccessible',
              }
            : { sourceKey: 'fused-eidolon', kind: 'available', value: level },
        ],
        ...(fallback === undefined ? {} : { fallback }),
      }),
    ],
  };
}
function progressionOf(result: ReturnType<typeof calculateCharacterSheet>) {
  const progression = result.companionProgression;
  if (progression?.kind !== 'eidolon') throw new Error('Expected an eidolon');
  return progression;
}

test('a Synthesist source advances its original eidolon at the whole summoner level and cites the archetype', () => {
  const result = calculateCharacterSheet(eidolon(), eidolonOptions(7));
  // APG Table 2–9, level 7: HD 6, BAB +6, Evolution Pool 10.
  expect(result).toMatchObject({
    hitDice: 6,
    derivedStatistics: { bab: { total: 6 } },
    companionProgression: {
      status: 'active',
      effectiveLevel: 7,
      evolutionPool: { total: 10 },
      contributions: [
        {
          kind: 'ordinary',
          ruleKind: 'synthesistEidolon',
          classLevels: 7,
          effectiveLevel: 7,
          counting: true,
        },
      ],
    },
  });
  expect(progressionOf(result).sources).toContainEqual(
    expect.objectContaining({
      book: 'Pathfinder RPG Ultimate Magic',
      pages: '80–81',
    }),
  );
  // An Unchained eidolon never counts an original-summoner Synthesist source.
  const unchained = calculateCharacterSheet(
    eidolon({ version: 'unchained', subtype: 'angel' }),
    eidolonOptions(7),
  );
  expect(unchained.companionProgression).toMatchObject({
    status: 'unresolved',
    versionMismatch: true,
  });
});

const summonerScores = {
  strength: 10,
  dexterity: 14,
  constitution: 10,
  intelligence: 10,
  wisdom: 12,
  charisma: 16,
};
/** A Synthesist with the given Class Levels, in order, and its own scores. */
function synthesist(
  levels: readonly (readonly [string, number])[],
): CharacterSheetInput & { entries: SheetEntry[] } {
  const classLevels = levels.flatMap(([classEntryId, count]) =>
    Array.from({ length: count }, () => classEntryId),
  );
  return {
    characterKind: 'pc',
    entries: [
      {
        _id: 'summoner-base',
        kind: 'base',
        active: true,
        catalogEntryId: 'summoner-scores',
        state: { kind: 'base' },
      },
      ...classLevels.map(
        (classEntryId, index): SheetEntry => ({
          _id: `level-${index + 1}`,
          kind: 'classLevel',
          active: true,
          state: {
            kind: 'classLevel',
            position: index + 1,
            classEntryId,
            hpGained: 8,
          },
        }),
      ),
      {
        _id: 'synthesist',
        kind: 'archetype',
        active: true,
        catalogEntryId: 'summoner-synthesist',
        state: {
          kind: 'archetype',
          classEntryId: classLevels.includes('unchained-summoner')
            ? 'unchained-summoner'
            : 'summoner',
        },
      },
    ],
    catalogEntries: [
      {
        _id: 'summoner-scores',
        ruleIdentity: 'base',
        modifiers: abilityKeys.map((ability) => ({
          target: abilityTargets[ability],
          bonusType: 'base',
          value: summonerScores[ability],
        })),
      },
      ...representativeClassCatalog.map((definition) => ({
        ...definition,
        _id: definition.ruleIdentity,
        detail: {
          ...definition.detail,
          counterpartOf:
            representativeClassCounterparts[definition.ruleIdentity],
        },
      })),
      ...representativeArchetypeCatalog,
    ],
  };
}
/** The Combined Form of a Synthesist and an eidolon of its summoner level. */
function fuse(
  summoner: CharacterSheetInput,
  fusedEidolon: CharacterSheetInput = eidolon(),
  options: ReturnType<typeof eidolonOptions> = eidolonOptions(1),
) {
  return resolveCombinedForm({
    summoner: {
      input: summoner,
      calculated: calculateCharacterSheet(summoner),
    },
    eidolon: {
      kind: 'calculated',
      calculated: calculateCharacterSheet(fusedEidolon, options),
    },
    calculateFused: (options) => calculateCharacterSheet(summoner, options),
  });
}

// Official FAQ, "Does a synthesist (page 80) use his own Hit Dice or his
// eidolon's Hit Dice ...": "When fused, use the eidolon's BAB instead of the
// summoner's class BAB, and add in BAB from other sources as normal. For
// example, a fighter 19/summoner 1 normally has a total BAB of +19 ... and
// when fused with his eidolon this increases to +20."
test('fused BAB replaces only the summoner class’s BAB with the eidolon’s and keeps other BAB', () => {
  const summoner = synthesist([
    ['fighter', 19],
    ['summoner', 1],
  ]);
  expect(calculateCharacterSheet(summoner).derivedStatistics.bab.total).toBe(
    19,
  );
  expect(fuse(summoner)).toMatchObject({
    status: 'calculated',
    summonerLevel: 1,
    baseAttackBonus: {
      total: 20,
      contributions: [
        { label: 'Fighter 19', value: 19, from: 'summoner' },
        { label: 'Eidolon BAB', value: 1, from: 'eidolon' },
      ],
      replaced: [{ label: 'Summoner 1', value: 0 }],
    },
  });
});

test('evolution effects read the eidolon’s Hit Dice, not the summoner’s', () => {
  const form = fuse(
    synthesist([
      ['fighter', 19],
      ['summoner', 1],
    ]),
  );
  // FAQ: "The synthesist uses the eidolon's Hit Dice for the effects of
  // evolutions, not his summoner Hit Dice or his total Hit Dice."
  expect(form?.evolutions).toMatchObject({ hitDice: 1, characterHitDice: 20 });
});

// FAQ: "If the synthesist's eidolon has the Skilled evolution, the
// synthesist gains the bonus to that skill."
test('the eidolon’s Skilled evolution adds its +8 racial bonus to the synthesist’s own skill', () => {
  const summoner = synthesist([['summoner', 1]]);
  const [level] = summoner.entries.filter((row) => row.kind === 'classLevel');
  if (level?.kind !== 'classLevel') throw new Error('Missing level');
  level.state.skillRanks = { 'skill.per': 1 };
  // 1 rank + Wis +1; Perception is not a summoner class skill.
  const perception = (calculated: { skill: string; total: number | null }[]) =>
    calculated.find(({ skill }) => skill === 'skill.per');
  const form = fuse(
    summoner,
    // The eidolon's own ranks are never read: it has no skills of its own.
    eidolon({
      evolutions: [{ key: 'skilled', choice: 'skill.per' }],
      skillRanks: { 'skill.per': 1 },
    }),
  );
  expect(calculateCharacterSheet(summoner).breakdowns['skill.per'].total).toBe(
    2,
  );
  expect(perception(form?.skills ?? [])).toMatchObject({
    total: 10,
    skilled: 8,
  });
  expect(perception(form?.skills ?? [])).not.toBeUndefined();
  expect(form?.skills.find(({ skill }) => skill === 'skill.ste')).toMatchObject(
    { skilled: null },
  );
  expect(form?.evolutions.list).toContainEqual({
    key: 'skilled',
    name: 'Skilled',
    choice: 'skill.per',
  });
});

// Fused Eidolon: "the synthesist uses the eidolon's Strength, Dexterity, and
// Constitution, but retains his own Intelligence, Wisdom, and Charisma." FAQ:
// an eidolon's mental Ability Increase "has no effect on the synthesist
// because he uses his own mental ability scores".
test('fused physical scores are the eidolon’s and its mental increases never reach the summoner', () => {
  const summoner = synthesist([['summoner', 1]]);
  const mental = fuse(
    summoner,
    eidolon({ evolutions: [{ key: 'abilityIncrease', choice: 'charisma' }] }),
  );
  expect(mental?.abilities).toEqual([
    {
      ability: 'strength',
      score: 16,
      modifier: 3,
      from: 'eidolon',
      excluded: [],
    },
    {
      ability: 'dexterity',
      score: 12,
      modifier: 1,
      from: 'eidolon',
      excluded: [],
    },
    {
      ability: 'constitution',
      score: 13,
      modifier: 1,
      from: 'eidolon',
      excluded: [],
    },
    {
      ability: 'intelligence',
      score: 10,
      modifier: 0,
      from: 'summoner',
      excluded: [],
    },
    {
      ability: 'wisdom',
      score: 12,
      modifier: 1,
      from: 'summoner',
      excluded: [],
    },
    {
      ability: 'charisma',
      score: 16,
      modifier: 3,
      from: 'summoner',
      excluded: [{ label: 'Ability Increase evolution', value: 2 }],
    },
  ]);
  // A physical increase changes the substituted score itself.
  const physical = fuse(
    summoner,
    eidolon({ evolutions: [{ key: 'abilityIncrease', choice: 'strength' }] }),
  );
  expect(physical?.abilities[0]).toMatchObject({ score: 18, modifier: 4 });
  // The summoner's own sheet keeps its own scores.
  expect(calculateCharacterSheet(summoner).abilities.strength.score).toBe(10);
});

const chainShirt = {
  _id: 'chain-shirt',
  name: 'Chain shirt',
  ruleIdentity: 'chain-shirt',
  modifiers: [],
  detail: {
    kind: 'item' as const,
    armor: {
      slot: 'armor' as const,
      category: 'light' as const,
      bonus: 4,
      maxDex: 4,
      armorCheckPenalty: 2,
      asf: 20,
    },
  },
};
/** A Synthesist of the given summoner level wearing a chain shirt. */
function armoredSynthesist(level: number) {
  const summoner = synthesist([['summoner', level]]);
  summoner.entries.push({
    _id: 'worn-chain-shirt',
    kind: 'item',
    active: true,
    catalogEntryId: 'chain-shirt',
    state: { kind: 'item' },
  });
  return {
    ...summoner,
    catalogEntries: [...summoner.catalogEntries, chainShirt],
  };
}

// Fused Eidolon: "gains the eidolon's armor and natural armor bonuses ...
// While fused, the synthesist loses the benefits of his armor"; FAQ: "any
// armor the synthesist wears does not function while the eidolon is
// present". Shielded Meld (4th): "+2 shield bonus to his Armor Class and a
// +2 circumstance bonus on his saving throws".
test('the fused form wears the eidolon’s armor, not the summoner’s, and gains Shielded Meld', () => {
  const summoner = armoredSynthesist(4);
  const ordinary = calculateCharacterSheet(summoner);
  // 10 + chain shirt 4 + Dex 2; Acrobatics Dex 2 − armor check penalty 2.
  expect(ordinary.derivedStatistics.ac.total).toBe(16);
  expect(ordinary.breakdowns['skill.acr'].total).toBe(0);
  // APG Table 2–9, level 4: HD 3, BAB +3, good/bad saves +3/+1, armor
  // bonus +2, Str/Dex bonus +1. Biped natural armor +2.
  const form = fuse(summoner, eidolon({ hpGained: 20 }), eidolonOptions(4));
  expect(form).toMatchObject({
    status: 'calculated',
    size: 'medium',
    // 10 + natural armor 4 + Dex 13 (+1) + Shielded Meld 2.
    armorClass: { total: 17, touch: 11, flatFooted: 16 },
    // Summoner base saves +1/+1/+4 with fused Con and Dex, own Wis, +2.
    saves: {
      fortitude: { total: 4 },
      reflex: { total: 4 },
      will: { total: 7 },
    },
    baseAttackBonus: { total: 3 },
    // BAB +3 and the eidolon's Strength 17 (+3).
    combatManeuverBonus: 6,
    // Eight per level and the fused Constitution 13 (+1) per level; the
    // eidolon's 20 + 3 × Con +1 as temporary hit points.
    hitPoints: { total: 36, temporary: 23 },
    features: [{ name: 'Shielded Meld' }],
  });
  expect(form?.armorClass.contributions).toEqual(
    expect.arrayContaining([
      { label: 'Eidolon natural armor', value: 4, from: 'eidolon' },
      { label: 'Shielded Meld', value: 2, from: 'eidolon' },
    ]),
  );
  expect(
    form?.armorClass.contributions.some(({ label }) => label === 'Chain shirt'),
  ).toBe(false);
  // No armor check penalty: Dex 13 (+1).
  expect(form?.skills.find(({ skill }) => skill === 'skill.acr')?.total).toBe(
    1,
  );
  // Greater Shielded Meld (12th) replaces the +2 with +4.
  expect(
    fuse(armoredSynthesist(12), eidolon({ hpGained: 40 }), eidolonOptions(12))
      ?.features,
  ).toEqual([
    {
      name: 'Greater Shielded Meld',
      summary:
        '+4 shield bonus to AC and +4 circumstance bonus on saving throws while fused.',
    },
  ]);
});

test('the fused form takes the eidolon’s size', () => {
  // Large evolution (summoner level 8): +8 Str, +4 Con, −2 Dex, +2 natural
  // armor, Stealth −4 and Fly −2. Level 8 row: BAB +6, Str/Dex bonus +3.
  const form = fuse(
    synthesist([['summoner', 8]]),
    eidolon({ hpGained: 30, evolutions: [{ key: 'large' }] }),
    eidolonOptions(8),
  );
  expect(form).toMatchObject({
    size: 'large',
    // BAB +6, Str +8, special size +1.
    combatManeuverBonus: 15,
  });
  expect(form?.abilities.slice(0, 3)).toMatchObject([
    { ability: 'strength', score: 27 },
    { ability: 'dexterity', score: 13 },
    { ability: 'constitution', score: 17 },
  ]);
  expect(form?.armorClass.contributions).toContainEqual({
    label: 'Size',
    value: -1,
    from: 'summoner',
  });
  // Dex 13 (+1) and the Large size −4.
  expect(form?.skills.find(({ skill }) => skill === 'skill.ste')?.total).toBe(
    -3,
  );
});

/**
 * A Small Synthesist of the given summoner level (a gnome: −2 Str racial,
 * +4 size bonus on Stealth) wearing a belt of giant strength +4.
 */
function smallBeltedSynthesist(level: number) {
  const summoner = synthesist([['summoner', level]]);
  summoner.entries.push(
    {
      _id: 'gnome-race',
      kind: 'race',
      active: true,
      catalogEntryId: 'gnome',
      state: { kind: 'race' },
    },
    {
      _id: 'worn-belt',
      kind: 'item',
      active: true,
      catalogEntryId: 'belt-of-giant-strength',
      state: { kind: 'item' },
    },
  );
  return {
    ...summoner,
    catalogEntries: [
      ...summoner.catalogEntries,
      {
        _id: 'gnome',
        name: 'Gnome',
        ruleIdentity: 'gnome',
        modifiers: [
          { target: 'ability.str', bonusType: 'racial', value: -2 },
          { target: 'skill.ste', bonusType: 'size', value: 4 },
        ],
        detail: { kind: 'race' as const, racialTraits: [], size: 'small' },
      },
      {
        _id: 'belt-of-giant-strength',
        name: 'Belt of giant strength +4',
        ruleIdentity: 'belt-of-giant-strength',
        modifiers: [
          { target: 'ability.str', bonusType: 'enhancement', value: 4 },
        ],
        detail: { kind: 'item' as const },
      },
    ],
  } satisfies CharacterSheetInput;
}

// Fused Eidolon: "the synthesist uses the eidolon's Strength, Dexterity, and
// Constitution"; #250 reads this as replacing the summoner's scores
// entirely, item and racial bonuses included, and the eidolon's size as
// replacing the summoner's size adjustments.
test('the eidolon’s physical scores replace the summoner’s item and racial modifiers and its size replaces the summoner’s', () => {
  const summoner = smallBeltedSynthesist(1);
  const ordinary = calculateCharacterSheet(summoner);
  // 10 − 2 racial + 4 enhancement; Small: +1 size AC and +4 Stealth.
  expect(ordinary.abilities.strength.score).toBe(12);
  expect(ordinary.derivedStatistics.ac.applied).toContainEqual(
    expect.objectContaining({ entryName: 'Size', value: 1 }),
  );
  expect(ordinary.breakdowns['skill.ste'].total).toBe(6);
  const form = fuse(summoner);
  expect(form).toMatchObject({
    status: 'calculated',
    size: 'medium',
    advisories: [],
    // BAB +1 and the eidolon's Str 16 (+3), with no Small special size −1.
    combatManeuverBonus: 4,
  });
  expect(form?.abilities.slice(0, 3)).toEqual([
    {
      ability: 'strength',
      score: 16,
      modifier: 3,
      from: 'eidolon',
      excluded: [],
    },
    {
      ability: 'dexterity',
      score: 12,
      modifier: 1,
      from: 'eidolon',
      excluded: [],
    },
    {
      ability: 'constitution',
      score: 13,
      modifier: 1,
      from: 'eidolon',
      excluded: [],
    },
  ]);
  expect(
    form?.armorClass.contributions.some(({ label }) => label === 'Size'),
  ).toBe(false);
  // Dex 12 (+1); the gnome's +4 size bonus is gone.
  expect(form?.skills.find(({ skill }) => skill === 'skill.ste')?.total).toBe(
    1,
  );
});

// #720: the imported Gnoll's natural armor (Bestiary p. 155: "a +2 natural
// armor bonus") is a natural armor bonus to AC, like the fused eidolon's.
// Bonuses of one type do not stack, so only the higher counts.
test('a Gnoll synthesist’s racial natural armor does not stack with the fused eidolon’s', () => {
  const gnoll = 'pf1/ITHs6VCRdSQUsoen';
  const summoner = synthesist([['summoner', 4]]);
  summoner.entries.push({
    _id: 'gnoll-race',
    kind: 'race',
    active: true,
    catalogEntryId: gnoll,
    state: { kind: 'race' },
  });
  const input = {
    ...summoner,
    catalogEntries: [
      ...summoner.catalogEntries,
      { _id: gnoll, ...heldRaceDefinition(gnoll) },
    ],
  };
  expect(calculateCharacterSheet(input).breakdowns['ac.natural'].total).toBe(2);
  const form = fuse(input, eidolon({ hpGained: 20 }), eidolonOptions(4));
  // 10 + natural armor 4 + Dex 13 (+1) + Shielded Meld 2; a racial-typed
  // +2 would have stacked to 19.
  expect(form?.armorClass.total).toBe(17);
});

test('an eidolon smaller than the synthesist is advised, not blocked', () => {
  const smallEidolon = eidolon({ size: 'small' });
  expect(fuse(synthesist([['summoner', 1]]), smallEidolon)).toMatchObject({
    status: 'calculated',
    size: 'small',
    advisories: [
      {
        kind: 'eidolonSmallerThanSynthesist',
        message:
          'Fused Eidolon requires the eidolon to be at least the synthesist’s size; this eidolon is small and the synthesist medium.',
      },
    ],
  });
  // A Small synthesist may fuse with a Small eidolon.
  expect(fuse(smallBeltedSynthesist(1), smallEidolon)?.advisories).toEqual([]);
});

/** A recorded Synthesist Grant at the given summoner level. */
function recordedGrant(
  feature: 'shielded-meld' | 'greater-shielded-meld',
  classLevel: number,
  active: boolean,
): SheetEntry {
  return {
    _id: `recorded-${feature}`,
    kind: 'classFeature',
    active,
    catalogEntryId: `summoner-synthesist-${feature}`,
    grantKey: {
      source: 'summoner-synthesist',
      classLevel,
      entry: `summoner-synthesist-${feature}`,
    },
    state: { kind: 'classFeature' },
  };
}

// PRD §6: dormant entries supply no modifiers. Shielded Meld comes from the
// Synthesist's own Grants, not from the summoner level alone.
test('Shielded Meld comes from the Synthesist’s Grants: a deactivated or dormant Grant supplies nothing', () => {
  const deactivated = armoredSynthesist(4);
  deactivated.entries.push(recordedGrant('shielded-meld', 4, false));
  const withoutMeld = fuse(
    deactivated,
    eidolon({ hpGained: 20 }),
    eidolonOptions(4),
  );
  expect(withoutMeld).toMatchObject({
    status: 'calculated',
    // 10 + natural armor 4 + Dex 13 (+1), no Shielded Meld.
    armorClass: { total: 15 },
    saves: { fortitude: { total: 2 } },
    features: [],
  });
  // A deactivated Greater Shielded Meld leaves the lesser +2.
  const lesser = armoredSynthesist(12);
  lesser.entries.push(recordedGrant('greater-shielded-meld', 12, false));
  expect(
    fuse(lesser, eidolon({ hpGained: 40 }), eidolonOptions(12))?.features,
  ).toEqual([
    {
      name: 'Shielded Meld',
      summary:
        '+2 shield bonus to AC and +2 circumstance bonus on saving throws while fused.',
    },
  ]);
  // A recorded Shielded Meld whose 4th summoner level is gone is dormant.
  const dormant = armoredSynthesist(3);
  dormant.entries.push(recordedGrant('shielded-meld', 4, true));
  const calculated = calculateCharacterSheet(dormant);
  expect(
    calculated.resolvedEntries.find(
      (row) => row.storedEntryId === 'recorded-shielded-meld',
    ),
  ).toMatchObject({ dormant: true, counting: false });
  expect(
    fuse(dormant, eidolon({ hpGained: 20 }), eidolonOptions(3))?.features,
  ).toEqual([]);
});

test('a Character without an active Synthesist has no Combined Form', () => {
  const summoner = synthesist([['summoner', 1]]);
  const ordinary = {
    ...summoner,
    entries: summoner.entries.filter((row) => row.kind !== 'archetype'),
  };
  expect(fuse(ordinary)).toBeNull();
  const off = {
    ...summoner,
    entries: summoner.entries.map((row) =>
      row.kind === 'archetype' ? { ...row, active: false } : row,
    ),
  };
  expect(fuse(off)).toBeNull();
});

test('a missing or unavailable eidolon leaves every fused value unresolved but keeps the summoner’s mental scores', () => {
  const summoner = synthesist([['summoner', 1]]);
  const calculated = calculateCharacterSheet(summoner);
  for (const unavailable of [
    'noEidolon',
    'eidolonUnavailable',
    'multipleEidolons',
  ] as const) {
    const form = resolveCombinedForm({
      summoner: { input: summoner, calculated },
      eidolon: { kind: 'unavailable', reason: unavailable },
      calculateFused: () => {
        throw new Error('No fused calculation without an eidolon');
      },
    });
    expect(form).toMatchObject({
      status: 'unresolved',
      unresolved: [{ reason: unavailable }],
      baseAttackBonus: { total: null },
      armorClass: { total: null },
      hitPoints: { total: null, temporary: null },
      abilities: [
        { ability: 'strength', score: null },
        { ability: 'dexterity', score: null },
        { ability: 'constitution', score: null },
        { ability: 'intelligence', score: 10, from: 'summoner' },
        { ability: 'wisdom', score: 12, from: 'summoner' },
        { ability: 'charisma', score: 16, from: 'summoner' },
      ],
    });
  }
});

test('an unresolved eidolon progression or competing rules leave the Combined Form unresolved', () => {
  const summoner = synthesist([['summoner', 7]]);
  // A hidden summoner level with no saved fallback.
  expect(fuse(summoner, eidolon(), eidolonOptions(null))).toMatchObject({
    status: 'unresolved',
    unresolved: [{ reason: 'eidolonProgressionUnresolved' }],
    inputs: [
      {
        label: 'Summoner level',
        value: null,
        resolution: 'unresolved',
        fallbackState: 'none',
      },
    ],
  });
  // Synthesist and Master Summoner each replace the eidolon.
  const conflicted = fuse(
    summoner,
    eidolon(),
    eidolonOptions(7, 'eidolon', {
      ruleConflict: {
        disclosure: 'disclosed',
        ruleKinds: ['masterSummonerEidolon', 'synthesistEidolon'],
      },
    }),
  );
  expect(conflicted?.unresolved).toEqual([
    {
      reason: 'eidolonProgressionUnresolved',
      message:
        'Master Summoner and Synthesist each replace the eidolon with no published precedence, so its fused statistics cannot be calculated.',
    },
  ]);
});

test('a saved fallback summoner level is shown as the input the eidolon used', () => {
  const form = fuse(
    synthesist([['summoner', 4]]),
    eidolon({ hpGained: 20 }),
    eidolonOptions(null, 'synthesistEidolon', {}, 4),
  );
  expect(form).toMatchObject({
    status: 'calculated',
    baseAttackBonus: { total: 3 },
    inputs: [
      {
        label: 'Summoner level',
        value: 4,
        resolution: 'fallback',
        fallbackState: 'applied',
      },
    ],
  });
});

test('unrecorded eidolon hit points leave only the temporary hit points unresolved', () => {
  const form = fuse(synthesist([['summoner', 1]]), eidolon({ hpGained: null }));
  expect(form).toMatchObject({
    status: 'calculated',
    baseAttackBonus: { total: 1 },
    // Eight and the fused Constitution 13 (+1).
    hitPoints: { total: 9, temporary: null },
    unresolved: [{ reason: 'eidolonHitPoints' }],
  });
});

// Synthesist is written for the original summoner; Pathfinder Unchained's
// general archetype compatibility is not a Synthesist-specific conversion.
test('a Synthesist on Unchained summoner levels has no assumed Combined Form', () => {
  const summoner = synthesist([['unchained-summoner', 4]]);
  expect(
    fuse(summoner, eidolon({ version: 'unchained', subtype: 'angel' })),
  ).toMatchObject({
    status: 'unresolved',
    unresolved: [{ reason: 'unchainedSummoner' }],
    baseAttackBonus: { total: null },
  });
});
