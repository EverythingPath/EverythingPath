import type { CharacterSheetCatalogEntry } from '../../src/lib/character-sheet';

// Representative prepared-sheet casting features and the Spells they grant,
// not a curated Catalog Release. Pathfinder RPG Core Rulebook: cleric Domains
// p. 38 with the Fire (p. 43) and Sun (p. 46) domains; wizard Arcane School
// pp. 77–78 with Evocation and Universalist (pp. 78–81); sorcerer Bloodline
// p. 70 with the Draconic bloodline (p. 74). Spell list levels cite the CRB
// spell lists (pp. 224–238) for the CRB classes only. Most page citations
// await an owner check: see "Unverified citations" in
// docs/catalog-import/prestige-and-unchained.md.
const core = (pages: string) => [
  { book: 'Pathfinder RPG Core Rulebook', pages },
];

type SpellSeed = {
  name: string;
  ruleIdentity: string;
  sources: { book: string; pages: string }[];
  stacksWithItself: false;
  modifiers: [];
  detail: { kind: 'spell'; levels: Record<string, number>; school: string };
};
type FeatureSeed = CharacterSheetCatalogEntry & {
  sources: { book: string; pages: string }[];
};
type SpellcastingFacts = NonNullable<
  Extract<
    NonNullable<CharacterSheetCatalogEntry['detail']>,
    { kind: 'classFeature' }
  >['spellcasting']
>;

function spell({
  key,
  name,
  school,
  levels,
  pages,
}: {
  key: string;
  name: string;
  school: string;
  levels: Record<string, number>;
  pages: string;
}): SpellSeed {
  return {
    name,
    ruleIdentity: `representative-spell-${key}`,
    sources: core(pages),
    stacksWithItself: false,
    modifiers: [],
    detail: { kind: 'spell', levels, school },
  };
}

export const representativeGrantedSpellCatalog: SpellSeed[] = [
  spell({
    key: 'burning-hands',
    name: 'Burning Hands',
    school: 'evo',
    levels: { sorcerer: 1, wizard: 1 },
    pages: '250',
  }),
  spell({
    key: 'produce-flame',
    name: 'Produce Flame',
    school: 'evo',
    levels: { druid: 1 },
    pages: '326',
  }),
  spell({
    key: 'fireball',
    name: 'Fireball',
    school: 'evo',
    levels: { sorcerer: 3, wizard: 3 },
    pages: '283',
  }),
  spell({
    key: 'wall-of-fire',
    name: 'Wall of Fire',
    school: 'evo',
    levels: { druid: 5, sorcerer: 4, wizard: 4 },
    pages: '368',
  }),
  spell({
    key: 'fire-shield',
    name: 'Fire Shield',
    school: 'evo',
    levels: { sorcerer: 4, wizard: 4 },
    pages: '284',
  }),
  spell({
    key: 'fire-seeds',
    name: 'Fire Seeds',
    school: 'con',
    levels: { druid: 6 },
    pages: '283',
  }),
  spell({
    key: 'elemental-body-iv',
    name: 'Elemental Body IV',
    school: 'trs',
    levels: { sorcerer: 7, wizard: 7 },
    pages: '278',
  }),
  spell({
    key: 'incendiary-cloud',
    name: 'Incendiary Cloud',
    school: 'con',
    levels: { sorcerer: 8, wizard: 8 },
    pages: '300',
  }),
  spell({
    key: 'elemental-swarm',
    name: 'Elemental Swarm',
    school: 'con',
    levels: { druid: 9 },
    pages: '278',
  }),
  spell({
    key: 'endure-elements',
    name: 'Endure Elements',
    school: 'abj',
    levels: {
      cleric: 1,
      druid: 1,
      paladin: 1,
      ranger: 1,
      sorcerer: 1,
      wizard: 1,
    },
    pages: '277',
  }),
  spell({
    key: 'heat-metal',
    name: 'Heat Metal',
    school: 'trs',
    levels: { druid: 2 },
    pages: '293',
  }),
  spell({
    key: 'searing-light',
    name: 'Searing Light',
    school: 'evo',
    levels: { cleric: 3 },
    pages: '337',
  }),
  spell({
    key: 'flame-strike',
    name: 'Flame Strike',
    school: 'evo',
    levels: { cleric: 5, druid: 4 },
    pages: '285',
  }),
  spell({
    key: 'sunbeam',
    name: 'Sunbeam',
    school: 'evo',
    levels: { druid: 7 },
    pages: '352',
  }),
  spell({
    key: 'sunburst',
    name: 'Sunburst',
    school: 'evo',
    levels: { druid: 8, sorcerer: 8, wizard: 8 },
    pages: '353',
  }),
  spell({
    key: 'prismatic-sphere',
    name: 'Prismatic Sphere',
    school: 'abj',
    levels: { sorcerer: 9, wizard: 9 },
    pages: '327',
  }),
  spell({
    key: 'mage-armor',
    name: 'Mage Armor',
    school: 'con',
    levels: { sorcerer: 1, wizard: 1 },
    pages: '306',
  }),
  spell({
    key: 'resist-energy',
    name: 'Resist Energy',
    school: 'abj',
    levels: {
      cleric: 2,
      druid: 2,
      paladin: 2,
      ranger: 1,
      sorcerer: 2,
      wizard: 2,
    },
    pages: '334',
  }),
  spell({
    key: 'fly',
    name: 'Fly',
    school: 'trs',
    levels: { sorcerer: 3, wizard: 3 },
    pages: '284',
  }),
  spell({
    key: 'fear',
    name: 'Fear',
    school: 'nec',
    levels: { bard: 3, sorcerer: 4, wizard: 4 },
    pages: '281',
  }),
  spell({
    key: 'spell-resistance',
    name: 'Spell Resistance',
    school: 'abj',
    levels: { cleric: 5 },
    pages: '347',
  }),
  spell({
    key: 'form-of-the-dragon-i',
    name: 'Form of the Dragon I',
    school: 'trs',
    levels: { sorcerer: 6, wizard: 6 },
    pages: '288',
  }),
  spell({
    key: 'form-of-the-dragon-ii',
    name: 'Form of the Dragon II',
    school: 'trs',
    levels: { sorcerer: 7, wizard: 7 },
    pages: '288',
  }),
  spell({
    key: 'form-of-the-dragon-iii',
    name: 'Form of the Dragon III',
    school: 'trs',
    levels: { sorcerer: 8, wizard: 8 },
    pages: '289',
  }),
  spell({
    key: 'wish',
    name: 'Wish',
    school: 'uni',
    levels: { sorcerer: 9, wizard: 9 },
    pages: '371',
  }),
  // #422: the Psychic Detective's own spell list (Occult Adventures p. 120).
  // Class levels follow PCGen's CRB and Occult Adventures spell data; their
  // psychic list levels are not seeded, as the archetype states its own.
  ...(
    [
      ['detect-chaos', 'Detect Chaos', 'div', { cleric: 1 }, '266'],
      ['detect-evil', 'Detect Evil', 'div', { cleric: 1 }, '266'],
      ['detect-good', 'Detect Good', 'div', { cleric: 1 }, '267'],
      ['detect-law', 'Detect Law', 'div', { cleric: 1 }, '267'],
      ['find-traps', 'Find Traps', 'div', { cleric: 2 }, '281'],
      [
        'daylight',
        'Daylight',
        'evo',
        { bard: 3, cleric: 3, druid: 3, paladin: 3, sorcerer: 3, wizard: 3 },
        '264',
      ],
      ['modify-memory', 'Modify Memory', 'enc', { bard: 4 }, '315'],
      [
        'banishment',
        'Banishment',
        'abj',
        { cleric: 6, sorcerer: 7, wizard: 7 },
        '246',
      ],
      [
        'moment-of-prescience',
        'Moment of Prescience',
        'div',
        { sorcerer: 8, wizard: 8 },
        '315',
      ],
      [
        'greater-scrying',
        'Scrying, Greater',
        'div',
        { bard: 6, cleric: 7, druid: 7, sorcerer: 7, wizard: 7 },
        '337',
      ],
    ] as const
  ).map(([key, name, school, levels, pages]) =>
    spell({ key, name, school, levels: { ...levels }, pages }),
  ),
  {
    ...spell({
      key: 'calm-spirit',
      name: 'Calm Spirit',
      school: 'nec',
      levels: { medium: 1, cleric: 2, shaman: 2, spiritualist: 2 },
      pages: '160',
    }),
    sources: [{ book: 'Pathfinder RPG Occult Adventures', pages: '160' }],
  },
];

function granted(keys: readonly string[]) {
  return keys.map((key, index) => ({
    spellLevel: index + 1,
    catalogEntryId: `representative-spell-${key}`,
  }));
}

function feature({
  key,
  name,
  pages,
  spellcasting,
  picks,
}: {
  key: string;
  name: string;
  pages: string;
  spellcasting: SpellcastingFacts;
  picks?: { list: string; count: number };
}): FeatureSeed {
  return {
    _id: key,
    name,
    ruleIdentity: key,
    modifiers: [],
    sources: core(pages),
    detail: {
      kind: 'classFeature',
      spellcasting,
      ...(picks ? { picksByLevel: [{ classLevel: 1, ...picks }] } : {}),
    },
  };
}

export const representativeSpellcastingFeatures: FeatureSeed[] = [
  feature({
    key: 'cleric-domains',
    name: 'Domains',
    pages: '38–39',
    spellcasting: { chooses: 'domain' },
    picks: { list: 'Domains', count: 2 },
  }),
  feature({
    key: 'domain-fire',
    name: 'Fire Domain',
    pages: '43',
    spellcasting: {
      optionKind: 'domain',
      extraSlot: 'domain',
      grantedSpells: {
        style: 'slot',
        spells: granted([
          'burning-hands',
          'produce-flame',
          'fireball',
          'wall-of-fire',
          'fire-shield',
          'fire-seeds',
          'elemental-body-iv',
          'incendiary-cloud',
          'elemental-swarm',
        ]),
      },
    },
  }),
  feature({
    key: 'domain-sun',
    name: 'Sun Domain',
    pages: '46',
    spellcasting: {
      optionKind: 'domain',
      extraSlot: 'domain',
      grantedSpells: {
        style: 'slot',
        spells: granted([
          'endure-elements',
          'heat-metal',
          'searing-light',
          'fire-shield',
          'flame-strike',
          'fire-seeds',
          'sunbeam',
          'sunburst',
          'prismatic-sphere',
        ]),
      },
    },
  }),
  feature({
    key: 'wizard-arcane-school',
    name: 'Arcane School',
    pages: '77–78',
    spellcasting: { chooses: 'school' },
    picks: { list: 'Arcane schools', count: 1 },
  }),
  feature({
    key: 'school-evocation',
    name: 'Evocation',
    pages: '79–80',
    spellcasting: {
      optionKind: 'school',
      school: 'evo',
      extraSlot: 'school',
      oppositionSchoolCount: 2,
    },
  }),
  feature({
    key: 'school-universalist',
    name: 'Universalist',
    pages: '81',
    spellcasting: { optionKind: 'school' },
  }),
  feature({
    key: 'sorcerer-bloodline',
    name: 'Bloodline',
    pages: '70–71',
    spellcasting: { chooses: 'bloodline' },
    picks: { list: 'Bloodlines', count: 1 },
  }),
  // Bonus spells at sorcerer 3rd and every two levels thereafter (CRB p. 70).
  feature({
    key: 'bloodline-draconic',
    name: 'Draconic Bloodline',
    pages: '74',
    spellcasting: {
      optionKind: 'bloodline',
      grantedSpells: {
        style: 'schedule',
        schedule: Array.from({ length: 9 }, (_, index) => ({
          spellLevel: index + 1,
          classLevel: 2 * (index + 1) + 1,
        })),
        spells: granted([
          'mage-armor',
          'resist-energy',
          'fly',
          'fear',
          'spell-resistance',
          'form-of-the-dragon-i',
          'form-of-the-dragon-ii',
          'form-of-the-dragon-iii',
          'wish',
        ]),
      },
    },
  }),
];

export const representativeSpellcastingSchedules: Record<
  string,
  { classLevel: number; catalogEntryId: string }[]
> = {
  cleric: [{ classLevel: 1, catalogEntryId: 'cleric-domains' }],
  wizard: [{ classLevel: 1, catalogEntryId: 'wizard-arcane-school' }],
  sorcerer: [{ classLevel: 1, catalogEntryId: 'sorcerer-bloodline' }],
};
