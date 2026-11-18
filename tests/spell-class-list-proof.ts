/**
 * The spell class-list family's public fixture
 * (`convex/characterSheetSpellClassList.integration.test.ts`, bound by bytes
 * in the family's registry entry beside the test): every class with a
 * reviewed casting, each at the class level where it first casts its highest
 * spell level, and one Spell per spell level 0 to 9 on the list of every
 * class that casts that level. The coverage tie
 * (`tests/catalog/launch-spell-class-list.test.ts`) checks that every
 * (collection path, spell level) pair and every (class, spell level) the
 * family's scope certifies is one this fixture exercises.
 *
 * Each casting's castable spell levels, collection heading and casting
 * ability are the printed class tables' (CRB, APG, UM, ACG, OA, Unchained,
 * GameMastery Guide for the Adept), written out rather than read from the
 * app's casting data.
 */
export type ClassListProofHeading =
  | 'Spellbook'
  | 'Spells known'
  | 'Familiar'
  | 'Formula book'
  | null;
type CastingAbility = 'intelligence' | 'wisdom' | 'charisma';
export type ClassListProofCasting = {
  classTag: string;
  heading: ClassListProofHeading;
  ability: CastingAbility;
  classLevel: number;
  spellLevels: readonly number[];
};

/** Int 14 (+2), Wis 16 (+3), Cha 18 (+4). */
export const classListProofScores = {
  intelligence: 14,
  wisdom: 16,
  charisma: 18,
} as const;
export const classListProofModifiers: Record<CastingAbility, number> = {
  intelligence: 2,
  wisdom: 3,
  charisma: 4,
};

const levels = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, index) => from + index);
/** A casting row: class, heading, ability, class level and spell levels. */
const casting = (
  [classTag, heading, ability]: [string, ClassListProofHeading, CastingAbility],
  classLevel: number,
  spellLevels: readonly number[],
): ClassListProofCasting => ({
  classTag,
  heading,
  ability,
  classLevel,
  spellLevels,
});
const full = levels(0, 9);
const six = levels(0, 6);
const fourNoZero = levels(1, 4);

export const classListProofCastings: readonly ClassListProofCasting[] = [
  // Recorded into a spellbook.
  casting(['wizard', 'Spellbook', 'intelligence'], 17, full),
  casting(['arcanist', 'Spellbook', 'intelligence'], 18, full),
  casting(['magus', 'Spellbook', 'intelligence'], 16, six),
  // Spells known.
  casting(['sorcerer', 'Spells known', 'charisma'], 18, full),
  casting(['oracle', 'Spells known', 'charisma'], 18, full),
  casting(['psychic', 'Spells known', 'intelligence'], 18, full),
  casting(['bard', 'Spells known', 'charisma'], 16, six),
  casting(['hunter', 'Spells known', 'wisdom'], 16, six),
  casting(['inquisitor', 'Spells known', 'wisdom'], 16, six),
  casting(['mesmerist', 'Spells known', 'charisma'], 16, six),
  casting(['skald', 'Spells known', 'charisma'], 16, six),
  casting(['spiritualist', 'Spells known', 'wisdom'], 16, six),
  casting(['summoner', 'Spells known', 'charisma'], 16, six),
  casting(['summonerUnchained', 'Spells known', 'charisma'], 16, six),
  casting(['occultist', 'Spells known', 'intelligence'], 16, six),
  casting(['medium', 'Spells known', 'charisma'], 13, levels(0, 4)),
  casting(['bloodrager', 'Spells known', 'charisma'], 13, fourNoZero),
  // Recorded with a familiar.
  casting(['witch', 'Familiar', 'intelligence'], 17, full),
  // Formula books: extracts have no level 0.
  casting(['alchemist', 'Formula book', 'intelligence'], 16, levels(1, 6)),
  casting(['investigator', 'Formula book', 'intelligence'], 16, levels(1, 6)),
  // Browsed whole and read-only.
  casting(['cleric', null, 'wisdom'], 17, full),
  casting(['druid', null, 'wisdom'], 17, full),
  casting(['shaman', null, 'wisdom'], 17, full),
  casting(['warpriest', null, 'wisdom'], 16, six),
  casting(['paladin', null, 'charisma'], 13, fourNoZero),
  casting(['antipaladin', null, 'charisma'], 13, fourNoZero),
  casting(['ranger', null, 'wisdom'], 13, fourNoZero),
  casting(['adept', null, 'wisdom'], 16, levels(0, 5)),
];

export const classListProofSpellKey = (spellLevel: number) =>
  `pf1/classListProofLevel${spellLevel}`;

/**
 * The Spell of a spell level, imported-shaped: on the list of every casting
 * that casts the level, at that level, with no granted levels.
 */
function classListProofSpell(spellLevel: number) {
  const key = classListProofSpellKey(spellLevel);
  return {
    externalKey: key,
    upstreamKey: key.split('/')[1] ?? key,
    pack: 'spells',
    name: `Class List Proof Level ${spellLevel}`,
    detail: {
      kind: 'spell' as const,
      levels: Object.fromEntries(
        classListProofCastings
          .filter(({ spellLevels }) => spellLevels.includes(spellLevel))
          .map(({ classTag }) => [classTag, spellLevel]),
      ),
      grantedLevels: {},
      school: 'enc',
      subschools: [],
      descriptors: [],
    },
    description: `A level ${spellLevel} Spell on every list that casts it.`,
    sources: [{ book: 'PZO1110', pages: '1' }],
    modifiers: [],
    unsupported: [],
  };
}
export const classListProofSpells = levels(0, 9).map(classListProofSpell);
