import type { CharacterSheetCatalogEntry } from '../../src/lib/character-sheet';
import type { ArchetypeCastingChange } from '../../src/lib/character-sheet-archetype-casting';
import type { Doc, Id } from '../_generated/dataModel';
import {
  representativeClassFeatureSchedules,
  representativeAdditionalClassFeatures,
} from './representativeClassCatalog';
import { representativeSpellcastingFeatures } from './representativeSpellcastingCatalog';
import { findReviewedClassCasting } from '../../src/lib/character-sheet-casting-tables';

type Seed = CharacterSheetCatalogEntry & {
  sources: { book: string; pages: string }[];
};
type FeatureDetail = Extract<
  NonNullable<CharacterSheetCatalogEntry['detail']>,
  { kind: 'classFeature' }
>;
const core = (pages: string) => [
  { book: 'Pathfinder RPG Core Rulebook', pages },
];
const advanced = (pages: string) => [
  { book: 'Pathfinder RPG Advanced Player’s Guide', pages },
];
const ultimateMagic = (pages: string) => [
  { book: 'Pathfinder RPG Ultimate Magic', pages },
];
const advancedClass = (pages: string) => [
  { book: 'Pathfinder RPG Advanced Class Guide', pages },
];
// #422 casting specimens; docs/catalog-import/archetypes.md cites each one.
const occultAdventures = (pages: string) => [
  { book: 'Pathfinder RPG Occult Adventures', pages },
];
const legacyOfTheFirstWorld = [
  {
    book: 'Pathfinder Player Companion: Legacy of the First World',
    pages: '16',
  },
];
const ultimateIntrigue = (pages: string) => [
  { book: 'Pathfinder RPG Ultimate Intrigue', pages },
];
const magicTacticsToolbox = [
  { book: 'Pathfinder Player Companion: Magic Tactics Toolbox', pages: '26' },
];
// Occult Adventures p. 120: the Psychic Detective's own spell levels.
const psychicDetectiveSpells = [
  ['detect-chaos', 1],
  ['detect-evil', 1],
  ['detect-good', 1],
  ['detect-law', 1],
  ['find-traps', 1],
  ['calm-spirit', 3],
  ['daylight', 3],
  ['modify-memory', 4],
  ['banishment', 6],
  ['moment-of-prescience', 6],
  ['greater-scrying', 6],
] as const;
const medium = findReviewedClassCasting('medium');
// Both bard-table casters know and cast spontaneously, cantrips included.
const bardTableCasting = {
  table: { table: 'spontaneous-medium', cantrips: true },
  recording: { type: 'spontaneous', record: 'known' },
} as const;
const whole = (featureIdentity: string) => ({
  featureIdentity,
  scope: 'whole' as const,
});
const hexes = (...levels: number[]) =>
  levels.map((level) => ({
    featureIdentity: 'witch-hex',
    scope: 'part' as const,
    part: String(level),
  }));

// Ultimate Magic pp. 80–81: each Synthesist feature with its summoner level.
const synthesistFeatures = [
  { key: 'fused-eidolon', name: 'Fused Eidolon', classLevel: 1 },
  { key: 'fused-link', name: 'Fused Link', classLevel: 1 },
  { key: 'shielded-meld', name: 'Shielded Meld', classLevel: 4 },
  { key: 'makers-jump', name: 'Maker’s Jump', classLevel: 6 },
  {
    key: 'greater-shielded-meld',
    name: 'Greater Shielded Meld',
    classLevel: 12,
  },
  { key: 'split-forms', name: 'Split Forms', classLevel: 16 },
] as const;

function feature({
  key,
  name,
  sources,
  detail = {},
  facts = {},
}: {
  key: string;
  name: string;
  sources: Seed['sources'];
  detail?: Omit<FeatureDetail, 'kind'>;
  facts?: Pick<Partial<Seed>, 'grantsSlots' | 'ruleIdentity'>;
}): Seed {
  return {
    _id: key,
    name,
    ruleIdentity: key,
    modifiers: [],
    sources,
    ...facts,
    detail: { kind: 'classFeature', ...detail },
  };
}

function increments({
  levels,
  key,
  name,
  sources,
  list,
}: {
  levels: number[];
  key: string;
  name: (index: number) => string;
  sources: Seed['sources'];
  list?: string;
}): Seed[] {
  return levels.map((level, index) =>
    feature({
      key: `${key}-${level}`,
      name: name(index),
      sources,
      detail: {
        parentFeature: key,
        part: String(level),
        ...(list
          ? { picksByLevel: [{ classLevel: level, list, count: 1 }] }
          : {}),
      },
    }),
  );
}

// Prepared-sheet specimens, not a curated release or complete class content.
// Source URLs, coverage limits and prose mechanics are recorded in
// docs/catalog-import/archetypes.md. Every schedule reference has a definition.
export const representativeArchetypeCatalog: Seed[] = [
  ...representativeAdditionalClassFeatures,
  ...representativeSpellcastingFeatures,
  ...[1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20].map((level) =>
    feature({
      key: `fighter-bonus-feat-${level}`,
      name: 'Bonus Feat',
      sources: core('56'),
      detail: { parentFeature: 'fighter-bonus-feats', part: String(level) },
      facts: {
        grantsSlots: [{ kind: 'feat', count: 1, featTypes: ['combat'] }],
      },
    }),
  ),
  ...increments({
    levels: [2, 6, 10, 14, 18],
    key: 'fighter-bravery',
    name: (index) => `Bravery +${index + 1}`,
    sources: core('56'),
  }),
  ...increments({
    levels: [3, 7, 11, 15],
    key: 'fighter-armor-training',
    name: (index) => `Armor Training ${index + 1}`,
    sources: core('56'),
  }),
  ...increments({
    levels: [5, 9, 13, 17],
    key: 'fighter-weapon-training',
    name: (index) => `Weapon Training ${index + 1}`,
    sources: core('56–57'),
    list: 'Weapon groups',
  }),
  feature({
    key: 'fighter-armor-mastery',
    name: 'Armor Mastery',
    sources: core('57'),
  }),
  feature({
    key: 'fighter-weapon-mastery',
    name: 'Weapon Mastery',
    sources: core('57'),
    detail: {
      picksByLevel: [{ classLevel: 20, list: 'Weapon mastery', count: 1 }],
    },
  }),
  ...increments({
    levels: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19],
    key: 'rogue-sneak-attack',
    name: (index) => `Sneak Attack +${index + 1}d6`,
    sources: core('68'),
  }),
  feature({
    key: 'rogue-trapfinding',
    name: 'Trapfinding',
    sources: core('68'),
  }),
  feature({
    key: 'rogue-evasion',
    name: 'Evasion',
    sources: core('68'),
    detail: {},
    facts: { ruleIdentity: 'evasion' },
  }),
  ...increments({
    levels: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
    key: 'rogue-talent',
    name: () => 'Rogue Talent',
    sources: core('68–69'),
    list: 'Rogue talents',
  }),
  ...increments({
    levels: [3, 6, 9, 12, 15, 18],
    key: 'rogue-trap-sense',
    name: (index) => `Trap Sense +${index + 1}`,
    sources: core('69'),
  }),
  feature({
    key: 'rogue-uncanny-dodge',
    name: 'Uncanny Dodge',
    sources: core('69'),
    detail: { duplicateUpgrade: 'rogue-improved-uncanny-dodge' },
    facts: { ruleIdentity: 'uncanny-dodge' },
  }),
  feature({
    key: 'rogue-improved-uncanny-dodge',
    name: 'Improved Uncanny Dodge',
    sources: core('69'),
    detail: {},
    facts: { ruleIdentity: 'improved-uncanny-dodge' },
  }),
  feature({
    key: 'rogue-advanced-talents',
    name: 'Advanced Talents',
    sources: core('69–70'),
  }),
  feature({
    key: 'rogue-master-strike',
    name: 'Master Strike',
    sources: core('70'),
  }),
  ...increments({
    levels: [2, 6, 10, 14, 18],
    key: 'fighter-archer-hawkeye',
    name: (index) => `Hawkeye +${index + 1}`,
    sources: advanced('104'),
  }),
  ...increments({
    levels: [3, 7, 11, 15, 19],
    key: 'fighter-archer-trick-shot',
    name: () => 'Trick Shot',
    sources: advanced('104'),
    list: 'Archer trick shots',
  }),
  ...increments({
    levels: [5, 9, 13, 17],
    key: 'fighter-archer-expert-archer',
    name: () => 'Expert Archer',
    sources: advanced('104'),
  }),
  feature({
    key: 'fighter-archer-safe-shot',
    name: 'Safe Shot',
    sources: advanced('104'),
  }),
  ...increments({
    levels: [13, 17],
    key: 'fighter-archer-evasive-archer',
    name: (index) => `Evasive Archer +${(index + 1) * 2}`,
    sources: advanced('104'),
  }),
  feature({
    key: 'fighter-archer-volley',
    name: 'Volley',
    sources: advanced('104'),
  }),
  feature({
    key: 'fighter-archer-ranged-defense',
    name: 'Ranged Defense',
    sources: advanced('104'),
  }),
  feature({
    key: 'fighter-archer-weapon-mastery',
    name: 'Weapon Mastery (Bow)',
    sources: advanced('104'),
    detail: {
      picksByLevel: [{ classLevel: 20, list: 'Bow weapon mastery', count: 1 }],
    },
  }),
  feature({
    key: 'rogue-scout-charge',
    name: 'Scout’s Charge',
    sources: advanced('134'),
  }),
  feature({
    key: 'rogue-scout-skirmisher',
    name: 'Skirmisher',
    sources: advanced('134'),
  }),
  {
    _id: 'fighter-archer',
    name: 'Archer',
    ruleIdentity: 'fighter-archer',
    modifiers: [],
    sources: advanced('104'),
    detail: {
      kind: 'archetype',
      classEntryIds: ['fighter'],
      replaces: (representativeClassFeatureSchedules.fighter ?? [])
        .filter(
          ({ catalogEntryId }) =>
            catalogEntryId.startsWith('fighter-bravery-') ||
            catalogEntryId.startsWith('fighter-armor-training-') ||
            catalogEntryId.startsWith('fighter-weapon-training-') ||
            catalogEntryId === 'fighter-armor-mastery' ||
            catalogEntryId === 'fighter-weapon-mastery',
        )
        .map((row) => ({
          ...row,
          scope: row.catalogEntryId.startsWith('fighter-weapon-training-')
            ? ('part' as const)
            : ('whole' as const),
        })),
      adds: [
        ...[2, 6, 10, 14, 18].map((classLevel) => ({
          classLevel,
          catalogEntryId: `fighter-archer-hawkeye-${classLevel}`,
        })),
        ...[3, 7, 11, 15, 19].map((classLevel) => ({
          classLevel,
          catalogEntryId: `fighter-archer-trick-shot-${classLevel}`,
        })),
        ...[5, 9, 13, 17].map((classLevel) => ({
          classLevel,
          catalogEntryId: `fighter-archer-expert-archer-${classLevel}`,
        })),
        { classLevel: 9, catalogEntryId: 'fighter-archer-safe-shot' },
        ...[13, 17].map((classLevel) => ({
          classLevel,
          catalogEntryId: `fighter-archer-evasive-archer-${classLevel}`,
        })),
        { classLevel: 17, catalogEntryId: 'fighter-archer-volley' },
        { classLevel: 19, catalogEntryId: 'fighter-archer-ranged-defense' },
        { classLevel: 20, catalogEntryId: 'fighter-archer-weapon-mastery' },
      ],
    },
  },
  {
    _id: 'rogue-scout',
    name: 'Scout',
    ruleIdentity: 'rogue-scout',
    modifiers: [],
    sources: advanced('134'),
    detail: {
      kind: 'archetype',
      classEntryIds: ['rogue'],
      replaces: [
        {
          classLevel: 4,
          catalogEntryId: 'rogue-uncanny-dodge',
          scope: 'whole',
        },
        {
          classLevel: 8,
          catalogEntryId: 'rogue-improved-uncanny-dodge',
          scope: 'whole',
        },
      ],
      adds: [
        { classLevel: 4, catalogEntryId: 'rogue-scout-charge' },
        { classLevel: 8, catalogEntryId: 'rogue-scout-skirmisher' },
      ],
    },
  },
  // #414 flurry replacement specimen: the zen archer flurries "only when
  // using a bow". Only that replacement is seeded; the flurry it adds stays
  // prose (docs/catalog-import/archetypes.md).
  feature({
    key: 'monk-zen-archer-flurry',
    name: 'Flurry of Blows (Zen Archer)',
    sources: advanced('115'),
  }),
  {
    _id: 'monk-zen-archer',
    name: 'Zen Archer',
    ruleIdentity: 'monk-zen-archer',
    modifiers: [],
    sources: advanced('115'),
    detail: {
      kind: 'archetype',
      classEntryIds: ['monk'],
      replaces: [
        { classLevel: 1, catalogEntryId: 'monk-flurry', scope: 'whole' },
      ],
      adds: [{ classLevel: 1, catalogEntryId: 'monk-zen-archer-flurry' }],
    },
  },
  // #410 effective-level allocation examples. Ranger, druid and hunter
  // schedules are not seeded, so these archetypes add their features without
  // listing replaced rows; the replaced features are named in their notes.
  feature({
    key: 'ranger-beast-master-animal-companion',
    name: 'Animal Companion (Beast Master)',
    sources: advanced('124'),
  }),
  feature({
    key: 'ranger-beast-master-improved-empathic-link',
    name: 'Improved Empathic Link',
    sources: advanced('124'),
  }),
  feature({
    key: 'ranger-beast-master-strong-bond',
    name: 'Strong Bond',
    sources: advanced('124'),
  }),
  {
    _id: 'ranger-beast-master',
    name: 'Beast Master',
    ruleIdentity: 'ranger-beast-master',
    modifiers: [],
    sources: advanced('124'),
    detail: {
      kind: 'archetype',
      classEntryIds: ['ranger'],
      replaces: [],
      adds: [
        {
          classLevel: 4,
          catalogEntryId: 'ranger-beast-master-animal-companion',
        },
        {
          classLevel: 6,
          catalogEntryId: 'ranger-beast-master-improved-empathic-link',
        },
        { classLevel: 12, catalogEntryId: 'ranger-beast-master-strong-bond' },
      ],
      classSkillsAdded: ['skill.acr', 'skill.esc'],
      classSkillsRemoved: ['skill.kdu', 'skill.kge', 'skill.pro', 'skill.spl'],
    },
  },
  feature({
    key: 'druid-pack-lord-pack-bond',
    name: 'Pack Bond',
    sources: ultimateMagic('38'),
  }),
  feature({
    key: 'druid-pack-lord-improved-empathic-link',
    name: 'Improved Empathic Link',
    sources: ultimateMagic('38'),
  }),
  {
    _id: 'druid-pack-lord',
    name: 'Pack Lord',
    ruleIdentity: 'druid-pack-lord',
    modifiers: [],
    sources: ultimateMagic('38'),
    detail: {
      kind: 'archetype',
      classEntryIds: ['druid'],
      replaces: [],
      adds: [
        { classLevel: 1, catalogEntryId: 'druid-pack-lord-pack-bond' },
        {
          classLevel: 6,
          catalogEntryId: 'druid-pack-lord-improved-empathic-link',
        },
      ],
    },
  },
  feature({
    key: 'hunter-packmaster-pack-bond',
    name: 'Pack Bond',
    sources: advancedClass('96'),
  }),
  feature({
    key: 'hunter-packmaster-pack-focus',
    name: 'Pack Focus',
    sources: advancedClass('96'),
  }),
  feature({
    key: 'hunter-packmaster-second-pack-focus',
    name: 'Second Pack Focus',
    sources: advancedClass('96'),
  }),
  feature({
    key: 'hunter-packmaster-master-of-the-pack',
    name: 'Master of the Pack',
    sources: advancedClass('96'),
  }),
  {
    _id: 'hunter-packmaster',
    name: 'Packmaster',
    ruleIdentity: 'hunter-packmaster',
    modifiers: [],
    sources: advancedClass('96'),
    detail: {
      kind: 'archetype',
      classEntryIds: ['hunter'],
      replaces: [],
      adds: [
        { classLevel: 1, catalogEntryId: 'hunter-packmaster-pack-bond' },
        { classLevel: 1, catalogEntryId: 'hunter-packmaster-pack-focus' },
        {
          classLevel: 8,
          catalogEntryId: 'hunter-packmaster-second-pack-focus',
        },
        {
          classLevel: 20,
          catalogEntryId: 'hunter-packmaster-master-of-the-pack',
        },
      ],
    },
  },
  // #419 component allocation example. The summoner schedule is not seeded,
  // so Broodmaster adds its features without listing replaced rows: Eidolon
  // Brood replaces the eidolon; the other brood rules remain prose.
  feature({
    key: 'summoner-broodmaster-eidolon-brood',
    name: 'Eidolon Brood',
    sources: ultimateMagic('78'),
  }),
  feature({
    key: 'summoner-broodmaster-larger-brood',
    name: 'Larger Brood',
    sources: ultimateMagic('78'),
  }),
  {
    _id: 'summoner-broodmaster',
    name: 'Broodmaster',
    ruleIdentity: 'summoner-broodmaster',
    modifiers: [],
    sources: ultimateMagic('78'),
    detail: {
      kind: 'archetype',
      classEntryIds: ['summoner'],
      replaces: [],
      adds: [
        {
          classLevel: 2,
          catalogEntryId: 'summoner-broodmaster-eidolon-brood',
        },
        { classLevel: 8, catalogEntryId: 'summoner-broodmaster-larger-brood' },
      ],
    },
  },
  // #420 reduced progression example. As for Broodmaster, the summoner
  // schedule is not seeded: Lesser Eidolon replaces the eidolon, Summoning
  // Mastery replaces summon monster I and shield ally, and Augment
  // Summoning replaces bond senses. Only the halved level is calculated.
  feature({
    key: 'summoner-master-summoner-lesser-eidolon',
    name: 'Lesser Eidolon',
    sources: ultimateMagic('80'),
  }),
  feature({
    key: 'summoner-master-summoner-summoning-mastery',
    name: 'Summoning Mastery',
    sources: ultimateMagic('80'),
  }),
  feature({
    key: 'summoner-master-summoner-augment-summoning',
    name: 'Augment Summoning',
    sources: ultimateMagic('80'),
  }),
  {
    _id: 'summoner-master-summoner',
    name: 'Master Summoner',
    ruleIdentity: 'summoner-master-summoner',
    modifiers: [],
    sources: ultimateMagic('80'),
    detail: {
      kind: 'archetype',
      classEntryIds: ['summoner'],
      replaces: [],
      adds: [
        {
          classLevel: 1,
          catalogEntryId: 'summoner-master-summoner-lesser-eidolon',
        },
        {
          classLevel: 1,
          catalogEntryId: 'summoner-master-summoner-summoning-mastery',
        },
        {
          classLevel: 2,
          catalogEntryId: 'summoner-master-summoner-augment-summoning',
        },
      ],
    },
  },
  // #421 Combined Form example. As above, the summoner schedule is not
  // seeded: Fused Eidolon replaces the eidolon, bond senses and life bond;
  // Fused Link replaces life link; Shielded Meld and Greater Shielded Meld
  // replace shield ally and greater shield ally; Maker's Jump replaces
  // maker's call and transposition; Split Forms replaces merge forms. Only
  // the fused statistics are calculated, in the summoner's Combined Form.
  ...synthesistFeatures.map(({ key, name }) =>
    feature({
      key: `summoner-synthesist-${key}`,
      name,
      sources: ultimateMagic('80–81'),
    }),
  ),
  {
    _id: 'summoner-synthesist',
    name: 'Synthesist',
    ruleIdentity: 'summoner-synthesist',
    modifiers: [],
    sources: ultimateMagic('80–81'),
    detail: {
      kind: 'archetype',
      classEntryIds: ['summoner'],
      replaces: [],
      adds: synthesistFeatures.map(({ key, classLevel }) => ({
        classLevel,
        catalogEntryId: `summoner-synthesist-${key}`,
      })),
    },
  },
  // #422 casting specimens. Ranger, witch, magus and investigator schedules
  // are not seeded, so these list no `replaces` rows: `featureChanges` name the
  // class features each alters or replaces, and every feature's own rules
  // stay prose. docs/catalog-import/archetypes.md quotes the casting text.
  feature({
    key: 'ranger-skirmisher-hunters-tricks',
    name: 'Hunter’s Tricks',
    sources: advanced('128'),
  }),
  {
    _id: 'ranger-skirmisher',
    name: 'Skirmisher',
    ruleIdentity: 'ranger-skirmisher',
    modifiers: [],
    sources: advanced('128'),
    detail: {
      kind: 'archetype',
      classEntryIds: ['ranger'],
      replaces: [],
      adds: [
        { classLevel: 5, catalogEntryId: 'ranger-skirmisher-hunters-tricks' },
      ],
      featureChanges: [whole('ranger-spells')],
      // "Skirmishers do not gain any spells or spellcasting ability."
      casting: { presence: 'remove' },
    },
  },
  {
    _id: 'ranger-dandy',
    name: 'Dandy',
    ruleIdentity: 'ranger-dandy',
    modifiers: [],
    sources: ultimateIntrigue('41'),
    detail: {
      kind: 'archetype',
      classEntryIds: ['ranger'],
      replaces: [],
      adds: [],
      featureChanges: [whole('ranger-spells')],
      // Charisma, spontaneously from the bard list, with a medium's spells
      // known and per day. The text states no spell kind, so it inherits.
      casting: {
        ability: 'charisma',
        spellList: { classTag: 'bard' },
        ...(medium
          ? { table: { table: medium.table, cantrips: medium.cantrips } }
          : {}),
        recording: { type: 'spontaneous', record: 'known' },
      },
    },
  },
  ...(
    [
      ['fey-charm', 'Fey Charm', 1],
      ['seducers-kiss', 'Seducer’s Kiss', 6],
      ['garden-of-delight', 'Garden of Delight', 8],
    ] as const
  ).map(([key, name]) =>
    feature({
      key: `witch-seducer-${key}`,
      name,
      sources: legacyOfTheFirstWorld,
    }),
  ),
  {
    _id: 'witch-seducer',
    name: 'Seducer',
    ruleIdentity: 'witch-seducer',
    modifiers: [],
    sources: legacyOfTheFirstWorld,
    detail: {
      kind: 'archetype',
      classEntryIds: ['witch'],
      replaces: [],
      adds: [
        { classLevel: 1, catalogEntryId: 'witch-seducer-fey-charm' },
        { classLevel: 6, catalogEntryId: 'witch-seducer-seducers-kiss' },
        { classLevel: 8, catalogEntryId: 'witch-seducer-garden-of-delight' },
      ],
      // Fey Charm alters the 1st-level hex; the others replace the 6th- and
      // 8th-level hexes. The patron restriction stays prose.
      featureChanges: hexes(1, 6, 8),
      // Otherworldly Allure: Charisma replaces Intelligence.
      casting: { ability: 'charisma' },
    },
  },
  feature({
    key: 'witch-ley-line-guardian-conduit-surge',
    name: 'Conduit Surge',
    sources: occultAdventures('125'),
  }),
  {
    _id: 'witch-ley-line-guardian',
    name: 'Ley Line Guardian',
    ruleIdentity: 'witch-ley-line-guardian',
    modifiers: [],
    sources: occultAdventures('125'),
    detail: {
      kind: 'archetype',
      classEntryIds: ['witch'],
      replaces: [],
      adds: [
        {
          classLevel: 1,
          catalogEntryId: 'witch-ley-line-guardian-conduit-surge',
        },
      ],
      // Conduit Surge replaces the familiar and the 1st- and 8th-level hexes;
      // Ley Line Powered alters the witch's spellcasting.
      featureChanges: [
        whole('witch-familiar'),
        ...hexes(1, 8),
        whole('witch-spells'),
      ],
      // A sorcerer's spells per day and known, cast spontaneously.
      casting: {
        table: { table: 'spontaneous-full', cantrips: true },
        recording: { type: 'spontaneous', record: 'known' },
      },
    },
  },
  ...(
    [
      ['stone-spirit-hex', 'Stone Spirit Hex', 1],
      ['mountain-beast-empathy', 'Mountain Beast Empathy', 2],
    ] as const
  ).map(([key, name]) =>
    feature({
      key: `witch-mountain-witch-${key}`,
      name,
      sources: advancedClass('132'),
    }),
  ),
  {
    _id: 'witch-mountain-witch',
    name: 'Mountain Witch',
    ruleIdentity: 'witch-mountain-witch',
    modifiers: [],
    sources: advancedClass('132'),
    detail: {
      kind: 'archetype',
      classEntryIds: ['witch'],
      replaces: [],
      adds: [
        {
          classLevel: 1,
          catalogEntryId: 'witch-mountain-witch-stone-spirit-hex',
        },
        {
          classLevel: 2,
          catalogEntryId: 'witch-mountain-witch-mountain-beast-empathy',
        },
      ],
      // Stone Spirit Hex alters hex; Mountain Beast Empathy replaces the
      // 2nd-level hex. Its patron spell changes stay prose.
      featureChanges: [whole('witch-hex'), ...hexes(2)],
    },
  },
  {
    _id: 'magus-eldritch-scion',
    name: 'Eldritch Scion',
    ruleIdentity: 'magus-eldritch-scion',
    modifiers: [],
    sources: advancedClass('104'),
    detail: {
      kind: 'archetype',
      classEntryIds: ['magus'],
      replaces: [],
      adds: [],
      featureChanges: [whole('magus-spells')],
      // Charisma with a bard's spells per day and known. Its restated arcane
      // kind is not a change, so it is inherited.
      casting: { ability: 'charisma', ...bardTableCasting },
    },
  },
  {
    _id: 'magus-mindblade',
    name: 'Mindblade',
    ruleIdentity: 'magus-mindblade',
    modifiers: [],
    sources: occultAdventures('121'),
    detail: {
      kind: 'archetype',
      classEntryIds: ['magus'],
      replaces: [],
      adds: [],
      featureChanges: [whole('magus-spells')],
      // Magus spells cast as psychic spells with a bard's spells per day and
      // known. Its restated Intelligence is not a change, so it is inherited.
      // Psychic Access stays prose.
      casting: { spellKind: 'psychic', ...bardTableCasting },
    },
  },
  {
    _id: 'investigator-questioner',
    name: 'Questioner',
    ruleIdentity: 'investigator-questioner',
    modifiers: [],
    sources: magicTacticsToolbox,
    detail: {
      kind: 'archetype',
      classEntryIds: ['investigator'],
      replaces: [],
      adds: [],
      featureChanges: [whole('investigator-alchemy')],
      // Arcane spells from the bard list, as a bard. Its restated
      // Intelligence is not a change, so it is inherited.
      casting: {
        spellKind: 'arcane',
        spellList: { classTag: 'bard' },
        ...bardTableCasting,
      },
    },
  },
  {
    _id: 'investigator-psychic-detective',
    name: 'Psychic Detective',
    ruleIdentity: 'investigator-psychic-detective',
    modifiers: [],
    sources: occultAdventures('119–120'),
    detail: {
      kind: 'archetype',
      classEntryIds: ['investigator'],
      replaces: [],
      adds: [],
      featureChanges: [whole('investigator-alchemy')],
      // Psychic spells from the psychic list plus its own spell levels; the
      // "6th level or lower" limit follows from the bard table. Its restated
      // Intelligence is inherited.
      casting: {
        spellKind: 'psychic',
        spellList: {
          classTag: 'psychic',
          add: psychicDetectiveSpells.map(([key, spellLevel]) => ({
            catalogEntryId: `representative-spell-${key}`,
            spellLevel,
          })),
        },
        ...bardTableCasting,
      },
    },
  },
];

type StoredSeed = Omit<
  Extract<
    Doc<'catalogEntry'>,
    {
      detail: {
        kind:
          | 'race'
          | 'racialTrait'
          | 'archetype'
          | 'classFeature'
          | 'feat'
          | 'trait';
      };
    }
  >,
  '_id' | '_creationTime' | 'scope' | 'characterId'
>;

/** Archetype casting changes name Spells by seed key until materialized. */
function materializeCasting(
  casting: ArchetypeCastingChange | undefined,
  idForKey: (key: string) => Id<'catalogEntry'>,
) {
  if (!casting) return undefined;
  const { spellList, grantedSpells, ...rest } = casting;
  const reference = (row: { catalogEntryId: string }) => ({
    catalogEntryId: idForKey(row.catalogEntryId),
  });
  return {
    ...rest,
    ...(spellList
      ? {
          spellList: {
            ...spellList,
            add: spellList.add?.map((row) => ({
              ...row,
              catalogEntryId: idForKey(row.catalogEntryId),
            })),
            remove: spellList.remove?.map(reference),
          },
        }
      : {}),
    ...(grantedSpells
      ? {
          grantedSpells: {
            ...grantedSpells,
            add: grantedSpells.add && {
              ...grantedSpells.add,
              spells: grantedSpells.add.spells.map((row) => ({
                ...row,
                catalogEntryId: idForKey(row.catalogEntryId),
              })),
            },
            remove: grantedSpells.remove?.map(reference),
          },
        }
      : {}),
  };
}

export function materializeRepresentativeArchetypeCatalog(
  idForKey: (key: string) => Id<'catalogEntry'>,
): { key: string; definition: StoredSeed }[] {
  return representativeArchetypeCatalog.map((entry) => {
    const detail = entry.detail;
    if (detail?.kind !== 'archetype' && detail?.kind !== 'classFeature')
      throw new Error('Unsupported representative archetype seed');
    return {
      key: entry._id,
      definition: {
        name: entry.name ?? entry._id,
        ruleIdentity: entry.ruleIdentity,
        stacksWithItself: false,
        sources: entry.sources,
        modifiers: [],
        ...(entry.grants
          ? {
              grants: entry.grants.map((grant) => ({
                ...grant,
                catalogEntryId: idForKey(grant.catalogEntryId),
              })),
            }
          : {}),
        ...(entry.grantsSlots
          ? {
              grantsSlots: entry.grantsSlots.map((slot) => ({
                ...slot,
                featTypes: slot.featTypes ? [...slot.featTypes] : undefined,
                feats: slot.feats?.map(idForKey),
              })),
            }
          : {}),
        detail:
          detail.kind === 'archetype'
            ? {
                ...detail,
                classEntryIds: detail.classEntryIds.map(idForKey),
                replaces: detail.replaces.map((row) => ({
                  ...row,
                  catalogEntryId: idForKey(row.catalogEntryId),
                })),
                adds: detail.adds.map((row) => ({
                  ...row,
                  catalogEntryId: idForKey(row.catalogEntryId),
                })),
                classSkillsAdded: detail.classSkillsAdded
                  ? [...detail.classSkillsAdded]
                  : undefined,
                classSkillsRemoved: detail.classSkillsRemoved
                  ? [...detail.classSkillsRemoved]
                  : undefined,
                featureChanges: detail.featureChanges
                  ? [...detail.featureChanges]
                  : undefined,
                picksByLevel: detail.picksByLevel
                  ? [...detail.picksByLevel]
                  : undefined,
                casting: materializeCasting(detail.casting, idForKey),
              }
            : {
                ...detail,
                duplicateUpgrade: detail.duplicateUpgrade
                  ? idForKey(detail.duplicateUpgrade)
                  : undefined,
                picksByLevel: detail.picksByLevel
                  ? [...detail.picksByLevel]
                  : undefined,
                spellcasting: detail.spellcasting
                  ? {
                      ...detail.spellcasting,
                      grantedSpells: detail.spellcasting.grantedSpells
                        ? {
                            ...detail.spellcasting.grantedSpells,
                            schedule:
                              detail.spellcasting.grantedSpells.schedule?.map(
                                (step) => ({ ...step }),
                              ),
                            spells:
                              detail.spellcasting.grantedSpells.spells.map(
                                (row) => ({
                                  ...row,
                                  catalogEntryId: idForKey(row.catalogEntryId),
                                }),
                              ),
                          }
                        : undefined,
                    }
                  : undefined,
              },
      },
    };
  });
}
