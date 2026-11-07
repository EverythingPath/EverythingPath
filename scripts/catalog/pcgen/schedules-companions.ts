import {
  abilityFile,
  at,
  byLevel,
  byOrder,
  classFile,
  classRows,
  classSkills,
  describeCastingRow,
  grantIn,
  notOnTable,
  option,
  ordinal,
  proficiency,
  type ReviewedSchedule,
  type RowFields,
} from './schedule-model';

/**
 * #716 P7a: the reviewed schedules of the companion and shape-changing
 * classes, Druid, Summoner, Summoner (Unchained), Hunter and Shifter
 * (research note 716-p7-rules §1, §3; the model: `schedule-model.ts`).
 *
 * - Every class feature both sources have is a row; a casting feature
 *   (spells, orisons, cantrips, spontaneous casting, the alignment
 *   restriction, the spontaneous spell exchange) is a `casting` row wherever
 *   either source links it, so an archetype touching it is a #422 review
 *   item; Bonus Languages is class text, not a table row, as P5's wizard's
 *   is.
 * - A grant PCGen gives with no `_CF_` gate (#716 P7-0 kind 2: Druid orisons,
 *   Summoner aspect, greater aspect, twin eidolon and cantrips) is still the
 *   feature's row; its decision says no archetype flag removes it in PCGen.
 * - Each row's level and label is checked against the PRD's class table
 *   (`printedTable`); the PRD prints no shifter, so the Shifter's
 *   table-derived conclusions are pending table review.
 */

// --- Druid ------------------------------------------------------------------

const coreRulebookClassAbilities =
  'roleplaying_game/core_rulebook/cr_abilities_class.lst';
const coreRulebookGlobals =
  'roleplaying_game/core_rulebook/cr_abilities_globalvar.lst';
const druidFile = classFile('druid.7eZQP0MzeO2svmVF');
const druidRow = classRows({
  recordPrefix: 'Druid',
  grantFile: coreRulebookClassAbilities,
  foundryFile: druidFile,
});
/** The PRD's Table: Druid (CRB p.49), whose 1st-level row is at :359. */
const druidTable = 'coreRulebook/classes/druid.html';
const druidTableRow = (level: number) => `${druidTable}:${358 + level}`;
const wildShapeLevels = [4, 6, 8, 10, 12, 14, 16, 18, 20];

const druid: ReviewedSchedule = {
  kind: 'reviewed',
  className: 'Druid',
  classKey: 'pf1/7eZQP0MzeO2svmVF',
  source: { book: 'Pathfinder RPG Core Rulebook', pages: '48–53' },
  printedTable: {
    status: 'reviewed',
    page: druidTable,
    firstRow: 359,
    caption: 'Druid',
    unprinted: {
      'spontaneous-casting': `The Special column prints none of the druid's casting; the class text gives spontaneous casting with the spells (${druidTable}:389).`,
      'alignment-spells': `The Special column prints none of the druid's casting; the class text gives the alignment restriction with the spells (${druidTable}:390).`,
      spells: `The Spells per Day columns give the druid's spells from 1st (${druidTableRow(1)}; ${druidTable}:385).`,
    },
  },
  foundryFile: druidFile,
  acquisitionRecords: ['Druid'],
  metadataRecords: ['Druid'],
  flagNamespace: 'Druid',
  slug: 'druid',
  classSkillsRecord: 'Class Skills ~ Druid',
  skillRanksPerLevel: 4,
  skillRanksAt: at(druidFile, 100),
  features: [
    druidRow({
      id: 'nature-bond',
      name: 'Nature Bond',
      key: 'wZ40bxNVn95BbLBV',
      levels: [1],
      pcgenLine: 227,
      foundryLine: 65,
    }),
    druidRow({
      id: 'nature-sense',
      name: 'Nature Sense',
      key: 'UJPlPj3RUKLvmKzM',
      levels: [1],
      pcgenLine: 225,
      foundryLine: 67,
    }),
    druidRow({
      id: 'wild-empathy',
      name: 'Wild Empathy',
      key: 'Yr8dfM2d8JEWoYkr',
      levels: [1],
      pcgenLine: 226,
      foundryLine: 69,
    }),
    druidRow({
      id: 'spontaneous-casting',
      name: 'Spontaneous Casting',
      key: 'utbMg45UlQKSuak9',
      levels: [1],
      casting: true,
      pcgenLine: 224,
      foundryLine: 71,
    }),
    druidRow({
      id: 'alignment-spells',
      name: 'Chaotic, Evil, Good, and Lawful Spells',
      key: 'exdHrqciehozr5SD',
      levels: [1],
      whole: [],
      casting: true,
      pcgenLine: null,
      foundryLine: 73,
      decision: describeCastingRow({
        name: 'Chaotic, Evil, Good, and Lawful Spells',
        foundryLevel: 1,
      }),
    }),
    druidRow({
      id: 'orisons',
      name: 'Orisons',
      key: 'RaFl9SpbAlXqhsDk',
      levels: [1],
      casting: true,
      pcgenLine: 223,
      foundryLine: 77,
      decision: `PCGen grants Druid ~ Orisons at 1 with no Druid_CF_ gate (cr_abilities_class.lst:223) and defines no Druid_CF_Orisons (cr_abilities_globalvar.lst:324-353), so no archetype flag removes it in PCGen; Foundry links Orisons at 1, the level Table: Druid gives them (${druidTableRow(1)}).`,
    }),
    druidRow({
      id: 'spells',
      name: 'Druid Spells',
      key: 'YGxrR8krrZAviojA',
      levels: [1],
      // Druid_CF_Spellcasting is only a FACTDEF (cr__datacontrols.lst:399).
      whole: ['Spells', 'Spellcasting'],
      casting: true,
      pcgenLine: null,
      foundryLine: 79,
      decision: describeCastingRow({ name: 'Druid Spells', foundryLevel: 1 }),
    }),
    druidRow({
      id: 'woodland-stride',
      name: 'Woodland Stride',
      key: '5iXq1igb1Cq0qobT',
      levels: [2],
      pcgenLine: 228,
      foundryLine: 81,
    }),
    druidRow({
      id: 'trackless-step',
      name: 'Trackless Step',
      key: 'adslhIPLFgIaHBfh',
      levels: [3],
      pcgenLine: 229,
      foundryLine: 83,
    }),
    druidRow({
      id: 'resist-natures-lure',
      name: 'Resist Nature’s Lure',
      key: '0j7haa7K5O1CJ3ot',
      levels: [4],
      whole: ['ResistNaturesLure'],
      pcgenLine: 231,
      foundryLine: 85,
    }),
    druidRow({
      id: 'wild-shape',
      name: 'Wild Shape',
      key: 'sJdBOE9lwz5XAkUi',
      levels: wildShapeLevels,
      // Table: Druid's labels, wild shape (1/day) at 4th to (8/day) at 18th
      // and (at will) at 20th (druid.html:362-378; Foundry's wild shape,
      // wild-shape.sJdBOE9lwz5XAkUi.yaml:42-45).
      incrementName: (index) =>
        index === 8 ? 'Wild Shape (at will)' : `Wild Shape (${index + 1}/day)`,
      parts: {
        // The use removed at each level (cr_abilities_class.lst:863-871).
        ...byLevel('WildShapeUses', wildShapeLevels),
        // The forms gained at each level, kept while unset (:857-861).
        ...byLevel('WildShapeOptions', [4, 6, 8, 10, 12]),
        // Old-style TYPE bridges to undefined variables (defect below).
        WildShape6: 6,
        WildShape8: 8,
      },
      increments: 'numbered',
      pcgenLine: 230,
      foundryLine: 87,
      acquisitionFormula: abilityFile('wild-shape.sJdBOE9lwz5XAkUi', 82),
    }),
    druidRow({
      id: 'venom-immunity',
      name: 'Venom Immunity',
      key: 'yzmKDxR63yS5fqlc',
      levels: [9],
      pcgenLine: 232,
      foundryLine: 89,
    }),
    druidRow({
      id: 'a-thousand-faces',
      name: 'A Thousand Faces',
      key: 'MXj2WoyW7vLxiVYw',
      levels: [13],
      pcgenLine: 233,
      foundryLine: 91,
    }),
    druidRow({
      id: 'timeless-body',
      name: 'Timeless Body',
      key: '5JlthJkVGEHPZypG',
      levels: [15],
      pcgenLine: 234,
      foundryLine: 93,
    }),
  ],
  nonRows: {
    ClassSkills: classSkills,
    WeaponProficiencies: proficiency,
    ArmorProficiencies: proficiency,
    // Nature's bond is an animal companion or a domain
    // (cr_abilities_class.lst:772, :779).
    AnimalCompanion: option('nature-bond'),
    DruidDomain: option('nature-bond'),
  },
  grantNonRows: {},
  typeAliases: {},
  foundryNonRows: [
    {
      externalKey: 'pf1/HL53FUqkS4PZCMIK',
      level: 1,
      text: `Bonus Languages is class text, not a row of Table: Druid (${druidTableRow(1)}), as the wizard’s is; PCGen grants none.`,
    },
  ],
  defects: [
    {
      id: 'wild-shape-uses-6',
      suffixes: ['WildShapeUses6'],
      text: `PCGen gates the 6th-level use of wild shape on Druid_CF_WildShapeUses6 (cr_abilities_class.lst:864) and defines it (${coreRulebookGlobals}:339), but bridges FACT:Druid_CF_WildShapeUses<n>|true to its variable at every level but 6 (:369-376): an archetype's FACT:Druid_CF_WildShapeUses6|true (Green Faith Initiate, fap_abilities_class.lst:23) removes nothing in PCGen. The mapper maps the variable by its name.`,
    },
    {
      id: 'wild-shape-6-8',
      suffixes: ['WildShape6', 'WildShape8'],
      text: `PCGen bridges the old-style TYPE.DruidWildShape6 and TYPE.DruidWildShape8 to Druid_CF_WildShape6 and Druid_CF_WildShape8 (${coreRulebookGlobals}:398-399), which it never defines (:324-353) and nothing gates: Pack Lord's TYPE.DruidWildShape6 (um_abilities_class.lst:1091) removes nothing in PCGen. The mapper maps each by its name to the wild shape row at 6 or 8.`,
    },
  ],
};

// --- Summoner and Summoner (Unchained) ----------------------------------------

const advancedPlayersGuideClassAbilities =
  'roleplaying_game/advanced_players_guide/apg_abilities_class.lst';
const advancedPlayersGuideGlobals =
  'roleplaying_game/advanced_players_guide/apg_abilities_globalvar.lst';
const unchainedClassAbilities =
  'roleplaying_game/pathfinder_unchained/pu_abilities_class.lst';
const summonMonsterLevels = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
/**
 * Summon monster I to IX, then gate: the table's labels
 * (summon-monster.caNEmbCtoHA7NYtZ.yaml:32-37).
 */
const summonMonsterName = (index: number) =>
  ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'].map(
    (roman) => `Summon Monster ${roman}`,
  )[index] ?? 'Gate';
const eidolonOptions = Object.fromEntries(
  [
    'EidolonBaseForm',
    'EidolonType',
    'ShareSpells',
    ...[
      'Agathion',
      'Angel',
      'Archon',
      'Azata',
      'Daemon',
      'Demon',
      'Devil',
      'Div',
      'Elemental',
      'Inevitable',
      'Protean',
      'Psychopomp',
    ].map((subtype) => `EidolonSubtype_${subtype}`),
  ].map((suffix) => [suffix, option('eidolon')]),
);
const summonerNonRows = {
  ClassSkills: classSkills,
  ArmorProficiencies: proficiency,
  SimpleWeapons: proficiency,
  SummonMonsterSpells: {
    kind: 'casting',
    of: 'spells',
    text: `Summoner_CF_SummonMonsterSpells (${advancedPlayersGuideGlobals}:488) gates no row: an archetype setting it changes the summon spells on the class's spell list (Wild Caller "swaps out those spells on his spell list with summon nature's ally spells", arg_abilities_class.lst:227), so it changes the summoner's spells.`,
  },
  // The eidolon's subtype, base form, type and its shared spells are choices
  // within the eidolon; the subtype flags are never defined
  // (ag_abilities_pu.lst:59).
  ...eidolonOptions,
} as const;

/** The summoners' features, the same in both versions. */
type SummonerFeatureId =
  | 'eidolon'
  | 'life-link'
  | 'summon-monster'
  | 'cantrips'
  | 'spells'
  | 'bond-senses'
  | 'shield-ally'
  | 'exchange-spell'
  | 'makers-call'
  | 'transposition'
  | 'aspect'
  | 'greater-shield-ally'
  | 'life-bond'
  | 'merge-forms'
  | 'greater-aspect'
  | 'twin-eidolon';
/** Each feature's Foundry id, and the class's. */
type SummonerKeys = Readonly<Record<SummonerFeatureId | 'class', string>>;

type SummonerVersion = {
  className: 'Summoner' | 'Summoner (Unchained)';
  /** The Foundry name suffix and seed identity of the version. */
  suffix: '' | ' (UC)';
  foundryFile: string;
  acquisitionRecord: string;
  /** The PCGen record prefix of the version's features. */
  recordPrefix: 'Summoner' | 'Unchained Summoner';
  grantFile: string;
  /** How far the version's Foundry class links sit below the standard summoner's. */
  foundryShift: 0 | 2;
  /** The line of PCGen's grant of each feature it grants. */
  grantLines: Readonly<Partial<Record<SummonerFeatureId, number>>>;
  keys: SummonerKeys;
  /** The PRD page printing the version's table, and its 1st-level row's line. */
  table: { page: string; firstRow: number; caption: string };
};

function summoner(version: SummonerVersion): ReviewedSchedule {
  const isUnchained = version.className === 'Summoner (Unchained)';
  const classRow = classRows(version);
  const tableRow = (level: number) =>
    `${version.table.page}:${version.table.firstRow + level - 1}`;
  const row = ({
    id,
    name,
    whole,
    foundryLine,
    ...fields
  }: Omit<RowFields, 'key' | 'pcgenLine' | 'foundryLine'> & {
    id: SummonerFeatureId;
    /** The standard summoner's Foundry link line. */
    foundryLine: number;
  }) =>
    classRow({
      ...fields,
      id,
      name: `${name}${version.suffix}`,
      pcgenName: fields.pcgenName ?? name.replace('’', "'"),
      whole: whole ?? [name.replace(/[^A-Za-z]/g, '')],
      key: version.keys[id],
      pcgenLine: version.grantLines[id] ?? null,
      foundryLine: foundryLine + version.foundryShift,
    });
  const ungated = (id: SummonerFeatureId, name: string, level: number) =>
    `PCGen grants ${version.recordPrefix} ~ ${name} at ${level} with no Summoner_CF_ gate (${version.grantFile}:${version.grantLines[id]}), so no archetype flag removes it in PCGen (P7-0 kind 2); Foundry links it at ${level}, the level Table: ${version.table.caption} gives it (${tableRow(level)}). An archetype's Summoner_CF_ flag for it maps by its name.`;
  const summonMonsterTable = `Table: ${version.table.caption} gives summon monster I at 1, II to IX at 3 to 17, and gate at 19 (${tableRow(1)}, :${version.table.firstRow + 2}-${version.table.firstRow + 18}), each a row of summon monster`;
  return {
    kind: 'reviewed',
    className: version.className,
    classKey: `pf1/${version.keys.class}`,
    source: isUnchained
      ? { book: 'Pathfinder Unchained', pages: '25–39' }
      : { book: 'Pathfinder RPG Advanced Player’s Guide', pages: '54–64' },
    printedTable: {
      status: 'reviewed',
      ...version.table,
      unprinted: {
        spells: `The Spells per Day columns give the summoner's spells from 1st (${tableRow(1)}).`,
        'exchange-spell': `The class text, not the Special column, gives the exchange at 5th and every third level after, as part of the spells (${version.table.page}:${isUnchained ? 452 : 410}).`,
      },
    },
    foundryFile: version.foundryFile,
    acquisitionRecords: [version.acquisitionRecord],
    metadataRecords: [
      'Summoner',
      'Summoner ~ Standard Class',
      'Summoner ~ Unchained Class',
    ],
    flagNamespace: 'Summoner',
    slug: isUnchained ? 'unchained-summoner' : 'summoner',
    classSkillsRecord: isUnchained
      ? 'Unchained Summoner ~ Skills'
      : 'Summoner ~ Skill',
    skillRanksPerLevel: 2,
    skillRanksAt: at(version.foundryFile, 95 + version.foundryShift),
    features: [
      row({
        id: 'eidolon',
        name: 'Eidolon',
        levels: [1],
        foundryLine: 60,
      }),
      row({
        id: 'life-link',
        name: 'Life Link',
        levels: [1],
        foundryLine: 62,
      }),
      row({
        id: 'summon-monster',
        name: 'Summon Monster',
        levels: summonMonsterLevels,
        incrementName: (index) =>
          `${summonMonsterName(index)}${version.suffix}`,
        foundryLine: 64,
        ...(isUnchained
          ? {
              decision: `PCGen holds the spell level in the summon monster record and grants no gate (pu_abilities_class.lst:256); Foundry's Summon Monster (UC) says "At 3rd level, and every 2 levels thereafter, the power of this ability increases by one spell level … At 19th level, this ability can be used as Gate" (summon-monster-uc.pMpN2f4mTgLt2NaR.yaml:32-37). ${summonMonsterTable}.`,
            }
          : {
              laterGrants: [
                grantIn(version.grantFile)('Summoner ~ Gate', 19, 761),
              ],
              decision: `PCGen holds the spell level in the summon monster record and grants Summoner ~ Gate at 19 on the same Summoner_CF_SummonMonster (apg_abilities_class.lst:751, :761): gate is part of summon monster, as Foundry's Summon Monster says ("At 3rd level, and every 2 levels thereafter, the power of this ability increases by one spell level … At 19th level, this ability can be used as Gate", summon-monster.caNEmbCtoHA7NYtZ.yaml:32-37). ${summonMonsterTable}, so removing summon monster removes gate.`,
            }),
      }),
      row({
        id: 'cantrips',
        name: 'Cantrips',
        levels: [1],
        casting: true,
        foundryLine: 66,
        decision: ungated('cantrips', 'Cantrips', 1),
      }),
      row({
        id: 'spells',
        name: 'Summoner Spells',
        pcgenName: 'Spells',
        levels: [1],
        whole: ['Spells', 'SpellsKnown'],
        casting: true,
        foundryLine: 68,
        decision: isUnchained
          ? ungated('spells', 'Spells', 1)
          : describeCastingRow({ name: 'Summoner Spells', foundryLevel: 1 }),
      }),
      row({
        id: 'bond-senses',
        name: 'Bond Senses',
        levels: [2],
        foundryLine: 70,
      }),
      row({
        id: 'shield-ally',
        name: 'Shield Ally',
        levels: [4],
        foundryLine: 72,
      }),
      row({
        id: 'exchange-spell',
        name: 'Exchange Spell',
        levels: [5],
        whole: [],
        casting: true,
        foundryLine: 74,
        decision: `${describeCastingRow({ name: 'Exchange Spell', foundryLevel: 5 })} The table has no row for it: the class's spells let it exchange a spell known at 5th and every third level after (exchange-spell-medium.5lDEyC6WejFyTEho.yaml:22).`,
      }),
      row({
        id: 'makers-call',
        name: 'Maker’s Call',
        levels: [6],
        whole: ['MakersCall'],
        foundryLine: 76,
      }),
      row({
        id: 'transposition',
        name: 'Transposition',
        levels: [8],
        foundryLine: 78,
      }),
      row({
        id: 'aspect',
        name: 'Aspect',
        levels: [10],
        foundryLine: 80,
        decision: ungated('aspect', 'Aspect', 10),
      }),
      row({
        id: 'greater-shield-ally',
        name: 'Greater Shield Ally',
        levels: [12],
        foundryLine: 82,
      }),
      row({
        id: 'life-bond',
        name: 'Life Bond',
        levels: [14],
        foundryLine: 84,
      }),
      row({
        id: 'merge-forms',
        name: 'Merge Forms',
        levels: [16],
        foundryLine: 86,
      }),
      row({
        id: 'greater-aspect',
        name: 'Greater Aspect',
        levels: [18],
        foundryLine: 88,
        decision: ungated('greater-aspect', 'Greater Aspect', 18),
      }),
      row({
        id: 'twin-eidolon',
        name: 'Twin Eidolon',
        levels: [20],
        foundryLine: 90,
        decision: ungated('twin-eidolon', 'Twin Eidolon', 20),
      }),
    ],
    nonRows: summonerNonRows,
    grantNonRows: {
      [`${version.recordPrefix} ~ Weapon and Armor Proficiency`]: proficiency,
    },
    typeAliases: {},
    foundryNonRows: [],
    defects: [],
  };
}

const standardSummonerKeys = {
  class: 'BrnHPJ2EVSQSyNQ8',
  eidolon: 'YmWKyC6bPUqHf9iQ',
  'life-link': 'xYuyemfGIFp0a97P',
  'summon-monster': 'caNEmbCtoHA7NYtZ',
  cantrips: 'IPy4aqFYbOppaqKC',
  spells: 'BBJV12ndKXeygKz3',
  'bond-senses': 'Aj7SwIo94HfcpR9R',
  'shield-ally': 'AaZ3OdpKFsMC6dFg',
  'exchange-spell': '5lDEyC6WejFyTEho',
  'makers-call': 'Jw6BEoNMBxfSN4cu',
  transposition: 'NAso2tQYl5bBfL1O',
  aspect: 'r5dE8fMdwjLVCHma',
  'greater-shield-ally': '81XUmdEI8Yr0UXeG',
  'life-bond': 'ZF6FlGlFJRaiO4OH',
  'merge-forms': 'CW99G919xJkrIWAu',
  'greater-aspect': 'ew7BBQtX2HrVhxOu',
  'twin-eidolon': 'jXEgYhQCj2o1fAVZ',
} as const satisfies SummonerKeys;

const standardSummoner = summoner({
  className: 'Summoner',
  suffix: '',
  foundryFile: classFile('summoner.BrnHPJ2EVSQSyNQ8'),
  acquisitionRecord: 'Summoner ~ Standard Class',
  recordPrefix: 'Summoner',
  grantFile: advancedPlayersGuideClassAbilities,
  foundryShift: 0,
  grantLines: {
    cantrips: 748,
    eidolon: 749,
    'life-link': 750,
    'summon-monster': 751,
    'bond-senses': 752,
    'shield-ally': 753,
    'makers-call': 754,
    transposition: 755,
    aspect: 756,
    'greater-shield-ally': 757,
    'life-bond': 758,
    'merge-forms': 759,
    'greater-aspect': 760,
    'twin-eidolon': 762,
  },
  keys: standardSummonerKeys,
  // The PRD's Table: Summoner (APG p.54).
  table: {
    page: 'advancedPlayersGuide/baseClasses/summoner.html',
    firstRow: 358,
    caption: 'Summoner',
  },
});

const unchainedSummonerKeys = {
  class: '5iDrtRQMuIhLymUA',
  eidolon: 'Yr1ZNxgxDVsRwxtj',
  'life-link': 'EcplvDrXlpIkYfeg',
  'summon-monster': 'pMpN2f4mTgLt2NaR',
  cantrips: 'IPy4aqFYbOppaqKC',
  spells: '99xgyzySNVXWW87X',
  'bond-senses': 'fJuxnPlNDncuHuT5',
  'shield-ally': 'hPgtTh79AeIocmpt',
  'exchange-spell': '5lDEyC6WejFyTEho',
  'makers-call': 'YOanbBgt7VuD5QDt',
  transposition: 'uhfXFDZBrYHwQnZX',
  aspect: 'Zy94TROPC7Es6yA7',
  'greater-shield-ally': 'U6LZteLyMA4gLAFF',
  'life-bond': 'UmMT57HYbdF3qJep',
  'merge-forms': 'k9ZGUwUB9yJiz4Ea',
  'greater-aspect': '5fTHyPmis1IyBmNF',
  'twin-eidolon': 'uURWe8xOp8w7YBQY',
} as const satisfies SummonerKeys;

const unchainedSummoner = summoner({
  className: 'Summoner (Unchained)',
  suffix: ' (UC)',
  foundryFile: classFile('summoner-unchained.5iDrtRQMuIhLymUA'),
  acquisitionRecord: 'Summoner ~ Unchained Class',
  recordPrefix: 'Unchained Summoner',
  grantFile: unchainedClassAbilities,
  foundryShift: 2,
  grantLines: {
    spells: 252,
    cantrips: 253,
    eidolon: 254,
    'life-link': 255,
    'summon-monster': 256,
    'bond-senses': 257,
    'shield-ally': 258,
    'makers-call': 259,
    transposition: 260,
    aspect: 261,
    'greater-shield-ally': 262,
    'life-bond': 263,
    'merge-forms': 264,
    'greater-aspect': 265,
    'twin-eidolon': 266,
  },
  keys: unchainedSummonerKeys,
  // The PRD's Unchained Summoner table (Pathfinder Unchained p.26).
  table: {
    page: 'unchained/classes/summoner.html',
    firstRow: 383,
    caption: 'Unchained Summoner',
  },
});

// --- Hunter -----------------------------------------------------------------

const advancedClassGuideClasses =
  'roleplaying_game/advanced_class_guide/acg_classes.lst';
const advancedClassGuideClassAbilities =
  'roleplaying_game/advanced_class_guide/acg_abilities_class.lst';
const advancedClassGuideGlobals =
  'roleplaying_game/advanced_class_guide/acg_abilities_globalvar.lst';
const hunterFile = classFile('hunter.Immo2BuSe5WGdRW9');
const hunterRow = classRows({
  recordPrefix: 'Hunter',
  grantFile: advancedClassGuideClasses,
  foundryFile: hunterFile,
});
/** The PRD's Hunter table (ACG p.27), whose 1st-level row is at :378. */
const hunterTable = 'advancedClassGuide/classes/hunter.html';
const hunterTableRow = (level: number) => `${hunterTable}:${377 + level}`;
const teamworkFeats = [3, 6, 9, 12, 15, 18];
const bonusTricks = [7, 13, 19];

const hunter: ReviewedSchedule = {
  kind: 'reviewed',
  className: 'Hunter',
  classKey: 'pf1/Immo2BuSe5WGdRW9',
  source: { book: 'Pathfinder RPG Advanced Class Guide', pages: '26–29' },
  printedTable: {
    status: 'reviewed',
    page: hunterTable,
    firstRow: 378,
    caption: 'Hunter',
    unprinted: {
      'alignment-spells': `The Special column prints none of the hunter's casting; the class text gives the alignment restriction with the spells (${hunterTable}:452).`,
      spells: `The Spells per Day columns give the hunter's spells from 1st (${hunterTableRow(1)}; ${hunterTable}:441).`,
      'exchange-spell': `The class text, not the Special column, gives the exchange at 5th and every 3 levels after, as part of the spells (${hunterTable}:447).`,
    },
  },
  foundryFile: hunterFile,
  acquisitionRecords: ['Hunter'],
  metadataRecords: ['Hunter'],
  flagNamespace: 'Hunter',
  slug: 'hunter',
  classSkillsRecord: 'Hunter ~ Class Skills',
  skillRanksPerLevel: 6,
  skillRanksAt: at(hunterFile, 105),
  features: [
    hunterRow({
      id: 'animal-companion',
      name: 'Animal Companion',
      key: 'V7cGG7vKN0BY2Bhb',
      levels: [1],
      pcgenLine: 123,
      foundryLine: 64,
    }),
    hunterRow({
      id: 'animal-focus',
      name: 'Animal Focus',
      key: '4r83TfLHXrRmXtIn',
      levels: [1],
      pcgenLine: 124,
      foundryLine: 58,
    }),
    hunterRow({
      id: 'nature-training',
      name: 'Nature Training',
      key: 'qqfc9I2awuSdfCxf',
      levels: [1],
      pcgenLine: 125,
      foundryLine: 60,
    }),
    hunterRow({
      id: 'orisons',
      name: 'Orisons',
      key: 'RaFl9SpbAlXqhsDk',
      levels: [1],
      casting: true,
      pcgenLine: 126,
      foundryLine: null,
      decision: `PCGen grants Hunter ~ Orisons at 1 (acg_classes.lst:126), the level the Hunter table gives them (${hunterTableRow(1)}); Foundry links no orisons to the hunter: its Orisons (orisons.RaFl9SpbAlXqhsDk.yaml:9-15) names the cleric, druid, inquisitor, oracle, shaman and warpriest.`,
    }),
    hunterRow({
      id: 'wild-empathy',
      name: 'Wild Empathy',
      key: 'Yr8dfM2d8JEWoYkr',
      levels: [1],
      pcgenLine: 127,
      foundryLine: 62,
    }),
    hunterRow({
      id: 'alignment-spells',
      name: 'Chaotic, Evil, Good, and Lawful Spells',
      key: 'exdHrqciehozr5SD',
      levels: [1],
      whole: [],
      casting: true,
      pcgenLine: null,
      foundryLine: 66,
      decision: describeCastingRow({
        name: 'Chaotic, Evil, Good, and Lawful Spells',
        foundryLevel: 1,
      }),
    }),
    hunterRow({
      id: 'spells',
      name: 'Hunter Spells',
      key: 'bbOaTvY5Ip2aaG0i',
      levels: [1],
      whole: ['Spells'],
      casting: true,
      pcgenLine: null,
      foundryLine: 68,
      decision: describeCastingRow({ name: 'Hunter Spells', foundryLevel: 1 }),
    }),
    hunterRow({
      id: 'precise-companion',
      name: 'Precise Companion',
      key: 'sxpGOVklEiwzkRjM',
      levels: [2],
      pcgenLine: 128,
      foundryLine: 70,
    }),
    hunterRow({
      id: 'track',
      name: 'Track',
      key: 'r8wPs0bB3WhOLxbX',
      levels: [2],
      pcgenLine: 129,
      foundryLine: 72,
    }),
    hunterRow({
      id: 'hunter-tactics',
      name: 'Hunter Tactics',
      key: 'nE79k9XBL67xrLCT',
      levels: [3],
      pcgenLine: 130,
      foundryLine: 74,
    }),
    hunterRow({
      id: 'teamwork-feats',
      name: 'Teamwork Feats',
      key: 'Rh0LztkmetWVC6jk',
      levels: teamworkFeats,
      // "Teamwork feat" at 3rd and every 3 levels to 18th (hunter.html:380-395).
      incrementName: () => 'Teamwork Feat',
      parts: byLevel('TeamworkFeat', teamworkFeats),
      increments: 'numbered',
      pcgenLine: 131,
      foundryLine: 76,
      acquisitionFormula: abilityFile('teamwork-feat-hun.Rh0LztkmetWVC6jk', 13),
    }),
    hunterRow({
      id: 'improved-empathic-link',
      name: 'Improved Empathic Link',
      key: 'pGDnMUhjGfphXiJB',
      levels: [4],
      // The globals bridge the flag to a misspelled variable (defect below).
      whole: ['ImprovedEmpathicLink', 'ImprovedEmpatheticLink'],
      pcgenLine: 132,
      foundryLine: 78,
    }),
    hunterRow({
      id: 'exchange-spell',
      name: 'Exchange Spell',
      key: '5lDEyC6WejFyTEho',
      levels: [5],
      whole: [],
      casting: true,
      pcgenLine: null,
      foundryLine: 80,
      decision: `${describeCastingRow({ name: 'Exchange Spell', foundryLevel: 5 })} The table has no row for it: the class's spells let it exchange a spell known at 5th and every third level after (exchange-spell-medium.5lDEyC6WejFyTEho.yaml:22).`,
    }),
    hunterRow({
      id: 'woodland-stride',
      name: 'Woodland Stride',
      key: '5iXq1igb1Cq0qobT',
      levels: [5],
      pcgenLine: 133,
      foundryLine: 82,
    }),
    hunterRow({
      id: 'bonus-tricks',
      name: 'Bonus Tricks',
      key: 'VNAsksfmUCMQsoZE',
      levels: bonusTricks,
      // "Bonus trick" at 7th, 13th and 19th (hunter.html:384, :390, :396).
      incrementName: () => 'Bonus Trick',
      parts: byLevel('BonusTrick', bonusTricks),
      increments: 'numbered',
      pcgenLine: 134,
      foundryLine: 84,
    }),
    hunterRow({
      id: 'second-animal-focus',
      name: 'Second Animal Focus',
      key: '5BQFf6N973yHrGtk',
      levels: [8],
      pcgenLine: 135,
      foundryLine: 86,
    }),
    hunterRow({
      id: 'swift-tracker',
      name: 'Swift Tracker',
      key: 'sk0HNTe9lKBpHQpN',
      levels: [8],
      pcgenLine: 136,
      foundryLine: 88,
    }),
    hunterRow({
      id: 'raise-animal-companion',
      name: 'Raise Animal Companion',
      key: 'h0hqYiLG7hkjPCin',
      levels: [10],
      pcgenLine: 137,
      foundryLine: 90,
    }),
    hunterRow({
      id: 'speak-with-master',
      name: 'Speak With Master',
      key: 'DnQK1UZ09ufe1Jmn',
      levels: [11],
      pcgenLine: 138,
      foundryLine: 92,
    }),
    hunterRow({
      id: 'greater-empathic-link',
      name: 'Greater Empathic Link',
      key: 'fkZVfqo0SOHAfJhh',
      levels: [14],
      pcgenLine: 139,
      foundryLine: 94,
    }),
    hunterRow({
      id: 'one-with-the-wild',
      name: 'One With The Wild',
      key: 'o2NhcAoFTDL4QSMN',
      levels: [17],
      pcgenLine: 140,
      foundryLine: 96,
    }),
    hunterRow({
      id: 'master-hunter',
      name: 'Master Hunter',
      key: 'uOQAy8ijKtqOj14V',
      levels: [20],
      pcgenLine: 141,
      foundryLine: 98,
    }),
  ],
  nonRows: {
    ClassSkills: classSkills,
    WeaponProficiencies: proficiency,
    ArmorProficiencies: proficiency,
  },
  grantNonRows: { 'Hunter ~ Weapon and Armor Proficiency': proficiency },
  // Feral Hunter's TYPE spells two flags its own .MOD line sets as
  // Hunter_CF_GreaterEmpathicLink and Hunter_CF_OneWithTheWild
  // (acg_abilities_class.lst:3145, :4641); no global bridges either spelling.
  typeAliases: {
    HunterGreaterEmpatheticLink: 'GreaterEmpathicLink',
    HunterMasterOfTheWild: 'OneWithTheWild',
  },
  foundryNonRows: [],
  defects: [
    {
      id: 'improved-empathic-link-bridge',
      suffixes: ['ImprovedEmpathicLink', 'ImprovedEmpatheticLink'],
      text: `PCGen gates Improved Empathic Link on Hunter_CF_ImprovedEmpathicLink (acg_classes.lst:132), but bridges FACT:Hunter_CF_ImprovedEmpathicLink|true and TYPE.HunterImprovedEmpathicLink to the misspelled Hunter_CF_ImprovedEmpatheticLink (${advancedClassGuideGlobals}:282, :304): an archetype removing it (Uprooter Scout, aco_abilities_class.lst:246) removes nothing in PCGen. The mapper maps both names to the feature.`,
    },
    {
      id: 'teamwork-feat-8',
      suffixes: ['TeamworkFeat8'],
      text: `PCGen defines and bridges Hunter_CF_TeamworkFeat8 (${advancedClassGuideGlobals}:318, :326), which gates nothing: the Hunter table gives teamwork feats at 3, 6, 9, 12, 15 and 18 (${hunterTableRow(3)}-395; ${advancedClassGuideClassAbilities}:1192-1197).`,
    },
    {
      id: 'bonus-trick-parts',
      suffixes: bonusTricks.map((level) => `BonusTrick${level}`),
      text: `PCGen gates the bonus tricks at 7, 13 and 19 on Hunter_CF_BonusTrick7, 13 and 19 (${advancedClassGuideClassAbilities}:1198-1200), which it never defines or bridges (${advancedClassGuideGlobals}:244-330): only the whole Hunter_CF_BonusTricks has a bridge (:284, :306). The mapper maps each by its name.`,
    },
  ],
};

// --- Shifter ----------------------------------------------------------------

const ultimateWildernessClasses =
  'roleplaying_game/ultimate_wilderness/uw_classes.lst';
const shifterFile = classFile('shifter.16mfrGi2UHTsME4W');
const shifterRow = classRows({
  recordPrefix: 'Shifter',
  grantFile: ultimateWildernessClasses,
  foundryFile: shifterFile,
});
const aspects = [1, 5, 10, 15];
/**
 * Shifter claws' later rows: the improvements Foundry's Shifter Claws gives
 * (shifter-claws.fi5PsRq1XW7MStPM.yaml:21-27) and PCGen holds in the claw
 * record's level-gated lines (uw_abilities_class.lst:14).
 */
const shifterClaws = [
  [1, 'Shifter Claws'],
  [3, 'Shifter Claws (DR/cold iron, magic, silver)'],
  [7, 'Shifter Claws (1d6)'],
  [11, 'Shifter Claws (1d8)'],
  [13, 'Shifter Claws (1d10)'],
  [17, 'Shifter Claws (×3)'],
  [19, 'Shifter Claws (DR/adamantine, —)'],
] as const;
/** +1 at 4th and every 4 levels after, to +5 at 20th (defensive-instinct.l52geoeGQcQz84AE.yaml:26-29). */
const defensiveInstinct = [2, 4, 8, 12, 16, 20];
/** No table: the PRD prints no shifter (`prdClassExclusions['not-in-prd']`). */
const pendingTableReview =
  'Pending table review: the PRD prints no shifter table (prdClassExclusions, not-in-prd).';

const shifter: ReviewedSchedule = {
  kind: 'reviewed',
  className: 'Shifter',
  classKey: 'pf1/16mfrGi2UHTsME4W',
  source: { book: 'Pathfinder RPG Ultimate Wilderness', pages: '26–31' },
  printedTable: { status: 'pendingTableReview', exclusion: 'not-in-prd' },
  foundryFile: shifterFile,
  acquisitionRecords: ['Shifter'],
  metadataRecords: ['Shifter'],
  flagNamespace: 'Shifter',
  slug: 'shifter',
  classSkillsRecord: 'Shifter ~ Class Skills',
  skillRanksPerLevel: 4,
  skillRanksAt: at(shifterFile, 110),
  features: [
    shifterRow({
      id: 'shifter-aspect',
      name: 'Shifter Aspect',
      key: 'ph7qA9fJX3iPuqxa',
      levels: aspects,
      incrementName: (index) => `Shifter Aspect (${ordinal(index + 1)})`,
      parts: byOrder('ShifterAspect', aspects),
      increments: 'numbered',
      pcgenLine: 19,
      foundryLine: 75,
      decision: `PCGen numbers five aspect picks, Shifter_CF_ShifterAspect1–5 at 1, 5, 10, 15 and 20 (uw_abilities_class.lst:1314-1318); Foundry's Shifter Aspect gives the second at 5th, the third at 10th and the fourth at 15th (shifter-aspect.ph7qA9fJX3iPuqxa.yaml:26-28), and Final Aspect the fifth at 20th (final-aspect.joNziZgJl9ZOJZlF.yaml:14). Shifter aspect is read at 1, 5, 10 and 15, and the fifth aspect as final aspect's row. ${pendingTableReview}`,
    }),
    shifterRow({
      id: 'shifter-claws',
      name: 'Shifter Claws',
      key: 'fi5PsRq1XW7MStPM',
      levels: shifterClaws.map(([level]) => level),
      incrementName: (index) => shifterClaws[index]?.[1] ?? 'Shifter Claws',
      pcgenLine: 20,
      foundryLine: 77,
      decision: `PCGen grants Shifter ~ Shifter Claws once at 1 (uw_classes.lst:20) and holds every improvement in the record's level-gated lines, numbering none (uw_abilities_class.lst:14): DR/cold iron and DR/silver at 3, 1d6 at 7, 1d8 at 11, 1d10 at 13, ×3 at 17, DR/adamantine and DR/— at 19. Foundry's Shifter Claws gives the same levels (shifter-claws.fi5PsRq1XW7MStPM.yaml:21-27) and computes nothing from the level. Rows read at 1, 3, 7, 11, 13, 17 and 19. ${pendingTableReview}`,
    }),
    shifterRow({
      id: 'wild-empathy',
      name: 'Wild Empathy',
      key: 'Yr8dfM2d8JEWoYkr',
      levels: [1],
      pcgenLine: 21,
      foundryLine: 79,
    }),
    shifterRow({
      id: 'defensive-instinct',
      name: 'Defensive Instinct',
      key: 'l52geoeGQcQz84AE',
      levels: defensiveInstinct,
      incrementName: (index) =>
        index === 0 ? 'Defensive Instinct' : `Defensive Instinct +${index}`,
      pcgenLine: 22,
      foundryLine: 83,
      acquisitionFormula: abilityFile(
        'defensive-instinct.l52geoeGQcQz84AE',
        14,
      ),
      decision: `PCGen grants Shifter ~ Defensive Instinct once at 2 (uw_classes.lst:22) and holds the +1 per 4 shifter levels in a formula, min((ShifterACLVL)/4,5), numbering none (uw_abilities_class.lst:16). Foundry's Defensive Instinct gives +1 at 4th, increasing every 4 levels to +5 at 20th, and computes it from the level (defensive-instinct.l52geoeGQcQz84AE.yaml:14, :26-29). Rows read at 2, then +1 to +5 at 4, 8, 12, 16 and 20. ${pendingTableReview}`,
    }),
    shifterRow({
      id: 'track',
      name: 'Track',
      key: 'r8wPs0bB3WhOLxbX',
      levels: [2],
      pcgenLine: 23,
      foundryLine: 85,
    }),
    shifterRow({
      id: 'woodland-stride',
      name: 'Woodland Stride',
      key: '5iXq1igb1Cq0qobT',
      levels: [3],
      pcgenLine: 24,
      foundryLine: 87,
    }),
    shifterRow({
      id: 'wild-shape',
      name: 'Wild Shape',
      key: 'qjpLIatoQIzmcehq',
      levels: [4],
      pcgenLine: 25,
      foundryLine: 89,
    }),
    shifterRow({
      id: 'trackless-step',
      name: 'Trackless Step',
      key: 'adslhIPLFgIaHBfh',
      levels: [5],
      pcgenLine: 26,
      foundryLine: 91,
    }),
    shifterRow({
      id: 'shifters-fury',
      name: 'Shifter’s Fury',
      key: 'eM1RMYR1EUBuUVTv',
      levels: [6],
      whole: ['ShiftersFury'],
      pcgenLine: 27,
      foundryLine: 93,
    }),
    shifterRow({
      id: 'chimeric-aspect',
      name: 'Chimeric Aspect',
      key: 'jPNCx02S3ZlIPOmL',
      levels: [9],
      pcgenLine: 28,
      foundryLine: 95,
    }),
    shifterRow({
      id: 'greater-chimeric-aspect',
      name: 'Greater Chimeric Aspect',
      key: 'bXxt8L2PITMstpka',
      levels: [14],
      pcgenLine: 29,
      foundryLine: 97,
    }),
    shifterRow({
      id: 'a-thousand-faces',
      name: 'A Thousand Faces',
      key: 'MXj2WoyW7vLxiVYw',
      levels: [18],
      whole: ['ThousandFaces'],
      pcgenLine: 30,
      foundryLine: 99,
    }),
    shifterRow({
      id: 'timeless-body',
      name: 'Timeless Body',
      key: '5JlthJkVGEHPZypG',
      levels: [18],
      pcgenLine: 31,
      foundryLine: 101,
    }),
    shifterRow({
      id: 'final-aspect',
      name: 'Final Aspect',
      key: 'joNziZgJl9ZOJZlF',
      levels: [20],
      pcgenLine: 32,
      foundryLine: 103,
    }),
  ],
  nonRows: {
    ClassSkills: classSkills,
    WeaponProficiencies: proficiency,
    ArmorProficiencies: proficiency,
    ShieldProficiency: proficiency,
    BonusLanguages: notOnTable(
      `Bonus Languages (granted at 1, uw_classes.lst:18) is class text, not a table row, as the wizard’s is. ${pendingTableReview}`,
    ),
    ShifterAspect5: notOnTable(
      `The fifth aspect (Shifter_CF_ShifterAspect5 at 20, uw_abilities_class.lst:1318) is final aspect’s (final-aspect.joNziZgJl9ZOJZlF.yaml:14), not a shifter aspect row: what removing it replaces is read from the text. ${pendingTableReview}`,
    ),
  },
  grantNonRows: { 'Shifter ~ Weapon and Armor Proficiencies': proficiency },
  typeAliases: {},
  foundryNonRows: [
    {
      externalKey: 'pf1/7fhS2HmIivLXQxlq',
      level: 1,
      text: `Bonus Languages is class text, not a table row, as the wizard’s is. ${pendingTableReview}`,
    },
  ],
  defects: [],
};

/** The P7a schedules, by class name. */
export const companionSchedules = {
  Druid: druid,
  Summoner: standardSummoner,
  'Summoner (Unchained)': unchainedSummoner,
  Hunter: hunter,
  Shifter: shifter,
} as const satisfies Readonly<Record<string, ReviewedSchedule>>;
