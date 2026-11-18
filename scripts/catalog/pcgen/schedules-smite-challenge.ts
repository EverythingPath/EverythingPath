import {
  abilityFile,
  buildPerDaySteps,
  at,
  byLevel,
  classFile,
  citeRows,
  classRows,
  classSkills,
  describeCastingRow,
  makeTableRowCiter,
  notOnTable,
  option,
  proficiency,
  scheduleSteps,
  type ReviewedSchedule,
} from './schedule-model';

/**
 * #716 P7d: the reviewed schedules of the smite and challenge classes,
 * Paladin, Antipaladin, Cavalier and Samurai (research note 716-p7-rules §1,
 * §3; the model: `schedule-model.ts`).
 *
 * - A row is an entry of the table's Special column; the paladins' spells,
 *   which the Spells per Day columns give, are cited as `unprinted`.
 * - PCGen numbers the paladin's mercies by the level of each (`Mercy3` to
 *   `Mercy18`) but gates each on the count of mercies (`Mercies ≥ n`), so the
 *   reader gives no level and the schedule gives each; the antipaladin's
 *   smite good and cruelties, the cavalier's order abilities and the
 *   samurai's bonus feats are numbered and gated by class level. Smite evil,
 *   both challenges, the samurai's order abilities and the cavalier's bonus
 *   feats (gated only by old-style TYPE tokens) are formula-held, and the
 *   table alone gives their later rows.
 * - The antipaladin and the samurai are alternate classes (APG p.118,
 *   advancedPlayersGuide/coreClasses/paladin.html:388; UC p.18,
 *   ultimateCombat/classes/samurai.html:350), each with its own printed
 *   table, Foundry class record and PCGen class: each is its own schedule.
 *   The names they share with their base classes (the samurai's
 *   `TYPE:Base.PC.Cavalier`, uc_classes.lst:34, which only bars
 *   multiclassing, :36, :75; the cavalier orders a samurai may choose,
 *   samurai.html:398) establish no archetype's applicability: each class
 *   reads its own `<Class>_CF_` flags (note §6, decision 2).
 */

const coreRulebookClassAbilities =
  'roleplaying_game/core_rulebook/cr_abilities_class.lst';
const coreRulebookGlobals =
  'roleplaying_game/core_rulebook/cr_abilities_globalvar.lst';
const advancedPlayersGuideAbilities =
  'roleplaying_game/advanced_players_guide/apg_abilities_class.lst';
const advancedPlayersGuideGlobals =
  'roleplaying_game/advanced_players_guide/apg_abilities_globalvar.lst';
const ultimateCombatAbilities =
  'roleplaying_game/ultimate_combat/uc_abilities_class.lst';
const ultimateCombatGlobals =
  'roleplaying_game/ultimate_combat/uc_abilities_globalvar.lst';

/** Once a day at 1st and once more every three levels after, to seven at 19th. */
const perDayLevels = [1, 4, 7, 10, 13, 16, 19];
/** At 3rd and every three levels after: mercies and cruelties. */
const everyThirdLevels = [3, 6, 9, 12, 15, 18];
const orderLevels = [1, 2, 8, 15];
const bonusFeatLevels = [6, 12, 18];

// --- Paladin ----------------------------------------------------------------

const paladinFile = classFile('paladin.ohptcds1d5oG6Bjh');
const paladinRow = classRows({
  recordPrefix: 'Paladin',
  grantFile: coreRulebookClassAbilities,
  foundryFile: paladinFile,
});
/** The PRD's Table: Paladin (CRB p.61), whose 1st-level row is at :358. */
const paladinTable = 'coreRulebook/classes/paladin.html';
const paladinTableRow = makeTableRowCiter({
  page: paladinTable,
  firstRow: 358,
});

const paladin: ReviewedSchedule = {
  kind: 'reviewed',
  className: 'Paladin',
  classKey: 'pf1/ohptcds1d5oG6Bjh',
  source: { book: 'Pathfinder RPG Core Rulebook', pages: '60–64' },
  printedTable: {
    status: 'reviewed',
    page: paladinTable,
    firstRow: 358,
    caption: 'Paladin',
    unprinted: {
      spells: `The Spells per Day columns give the paladin's spells from 4th (${paladinTableRow(4)}; ${paladinTable}:415, :417).`,
    },
  },
  foundryFile: paladinFile,
  acquisitionRecords: ['Paladin'],
  metadataRecords: ['Paladin'],
  flagNamespace: 'Paladin',
  slug: 'paladin',
  classSkillsRecord: 'Class Skills ~ Paladin',
  skillRanksPerLevel: 2,
  skillRanksAt: at(paladinFile, 99),
  features: [
    paladinRow({
      id: 'aura-of-good',
      name: 'Aura of Good',
      key: 'nzqkSBc6tvAqG8o2',
      levels: [1],
      pcgenLine: 271,
      foundryLine: 62,
    }),
    paladinRow({
      id: 'detect-evil',
      name: 'Detect Evil',
      key: '2YqtYAfLcV7KWkpJ',
      levels: [1],
      pcgenLine: 272,
      foundryLine: 64,
    }),
    paladinRow({
      id: 'smite-evil',
      name: 'Smite Evil',
      key: '2TsDfK0SKC8IGVx4',
      ...scheduleSteps({
        steps: buildPerDaySteps({ name: 'Smite Evil', levels: perDayLevels }),
      }),
      pcgenLine: 273,
      foundryLine: 66,
      acquisitionFormula: abilityFile('smite-evil.2TsDfK0SKC8IGVx4', 50),
      decision: `PCGen grants Paladin ~ Smite Evil once at 1 (${coreRulebookClassAbilities}:273) and holds the uses in a formula, min((SmiteEvilLVL+2)/3,7) (:1357), numbering none. The class text gives smite evil once a day at 1st and once more at 4th and every three levels after, to seven times a day at 19th (${paladinTable}:385, :387), as Table: Paladin prints smite evil 1/day to 7/day (${citeRows({ tableRow: paladinTableRow, levels: perDayLevels })}). Rows read at 1, 4, 7, 10, 13, 16 and 19. Foundry's Smite Evil counts its uses from the Hit Dice (smite-evil.2TsDfK0SKC8IGVx4.yaml:50).`,
    }),
    paladinRow({
      id: 'divine-grace',
      name: 'Divine Grace',
      key: 'eYuNS8kf9Z3V6kjO',
      levels: [2],
      pcgenLine: 274,
      foundryLine: 68,
    }),
    paladinRow({
      id: 'lay-on-hands',
      name: 'Lay on Hands',
      key: 'WhE4j0Jc82npdMCP',
      levels: [2],
      pcgenLine: 275,
      foundryLine: 70,
      acquisitionFormula: abilityFile('lay-on-hands.WhE4j0Jc82npdMCP', 19),
      decision: `The table prints lay on hands at 2nd only (${paladinTableRow(2)}); its uses and its 1d6 for every two paladin levels are class text (${paladinTable}:389), which Foundry's Lay on Hands computes from the level (lay-on-hands.WhE4j0Jc82npdMCP.yaml:19, :50): one row.`,
    }),
    paladinRow({
      id: 'aura-of-courage',
      name: 'Aura of Courage',
      key: 'RNIkkvqaq2iVrahs',
      levels: [3],
      pcgenLine: 276,
      foundryLine: 72,
    }),
    paladinRow({
      id: 'divine-health',
      name: 'Divine Health',
      key: 'C5tWPm12qyz5ND9u',
      levels: [3],
      pcgenLine: 277,
      foundryLine: 74,
    }),
    paladinRow({
      id: 'mercy',
      name: 'Mercy',
      key: 'Er8h3fZ2edJEviTv',
      levels: everyThirdLevels,
      // "Mercy" at 3rd and every 3 levels after (paladin.html:360-375).
      incrementName: () => 'Mercy',
      // By level: Mercy<n> is the mercy gained at level n, each gated on
      // its order (cr_abilities_class.lst:1367-1372).
      parts: byLevel('Mercy', everyThirdLevels),
      increments: 'numbered',
      countVariable: 'Mercies',
      pcgenLine: 278,
      foundryLine: 76,
      decision: `PCGen takes one mercy off for each Paladin_CF_Mercy<level>, gated on the nth mercy, Mercies ≥ n, where Mercies = min(MercyLVL/3,6) (${coreRulebookClassAbilities}:1361, :1367-1372): the flag is named by the level of its mercy (Mercy3 is the 3rd-level mercy, Mercy18 the sixth, at 18th; ${coreRulebookGlobals}:664-669 defines no Mercy1 to Mercy6), and its gate counts mercies, not levels, so PCGen gives no level and the schedule gives each. The class text gives a mercy at 3rd and every three levels after (${paladinTable}:393), as Table: Paladin prints (${citeRows({ tableRow: paladinTableRow, levels: everyThirdLevels })}). Foundry's Mercy computes nothing from the level (mercy.Er8h3fZ2edJEviTv.yaml). A record that lowers Mercies directly (Oath against Undeath's ghost touch aura, roleplaying_game/ultimate_magic/um_abilities_class.lst:1558) is named for review by the mapper (countVariable).`,
    }),
    paladinRow({
      id: 'channel-positive-energy',
      name: 'Channel Positive Energy',
      key: 'tHObxrPeyhimmz9V',
      levels: [4],
      pcgenLine: 279,
      foundryLine: 80,
      acquisitionFormula: abilityFile(
        'channel-positive-energy.tHObxrPeyhimmz9V',
        19,
      ),
      decision: `The table prints channel positive energy at 4th only (${paladinTableRow(4)}); the paladin channels as a cleric of her level (${paladinTable}:414), which Foundry's record computes from the level (channel-positive-energy.tHObxrPeyhimmz9V.yaml:19): one row.`,
    }),
    paladinRow({
      id: 'spells',
      name: 'Paladin Spells',
      key: '6h8ESfQp4dwX4qhk',
      levels: [4],
      whole: ['Spells'],
      casting: true,
      pcgenLine: null,
      foundryLine: 78,
      decision: `${describeCastingRow({ name: 'Paladin Spells', foundryLevel: 4 })} The class text gives the spells from 4th (${paladinTable}:415), and PCGen casts from the class block's 4th-level line (roleplaying_game/core_rulebook/cr_classes.lst:174-190), behind no flag (defect spells-flag).`,
    }),
    paladinRow({
      id: 'divine-bond',
      name: 'Divine Bond',
      key: 'z4NJaCcj9VZpBv7d',
      levels: [5],
      pcgenLine: 280,
      foundryLine: 82,
      decision: `The table prints divine bond at 5th only (${paladinTableRow(5)}); the bonded weapon's added bonus and the mount's calls a day are class text (${paladinTable}:421, :424), and Foundry's Divine Bond computes nothing from the level (divine-bond.z4NJaCcj9VZpBv7d.yaml): one row, its two bonds options (BondedMount, BondedWeapon).`,
    }),
    paladinRow({
      id: 'aura-of-resolve',
      name: 'Aura of Resolve',
      key: 'jiBCmy0kP1Uwaz0D',
      levels: [8],
      pcgenLine: 281,
      foundryLine: 84,
    }),
    paladinRow({
      id: 'aura-of-justice',
      name: 'Aura of Justice',
      key: 'wHfy3OJmTimVgXuO',
      levels: [11],
      pcgenLine: 282,
      foundryLine: 86,
    }),
    paladinRow({
      id: 'aura-of-faith',
      name: 'Aura of Faith',
      key: 'cUv3fmnuhtQjgQM5',
      levels: [14],
      pcgenLine: 283,
      foundryLine: 88,
    }),
    paladinRow({
      id: 'aura-of-righteousness',
      name: 'Aura of Righteousness',
      key: 'iFq0EX4yovswIox9',
      levels: [17],
      pcgenLine: 284,
      foundryLine: 90,
    }),
    paladinRow({
      id: 'holy-champion',
      name: 'Holy Champion',
      key: 'BPRtCoYTMDwsITXJ',
      levels: [20],
      pcgenLine: 285,
      foundryLine: 92,
    }),
  ],
  nonRows: {
    ClassSkills: classSkills,
    Proficiencies: proficiency,
    WeaponProficiencies: proficiency,
    WeaponProficiencySimple: proficiency,
    WeaponProficiencyMartial: proficiency,
    ArmorProficiencies: proficiency,
    ArmorProficiency: proficiency,
    ArmorProficiencyHeavy: proficiency,
    ArmorProficiencyMedium: proficiency,
    ArmorProficiencyLight: proficiency,
    ShieldProficiency: proficiency,
    // The two bonds of divine bond (paladin.html:420-423;
    // cr_abilities_globalvar.lst:673-674).
    BondedMount: option('divine-bond'),
    BondedWeapon: option('divine-bond'),
    CodeOfConduct: notOnTable(
      `The paladin's code of conduct is class text (${paladinTable}:435-436), not a table row; Paladin_CF_CodeOfConduct marks it (${coreRulebookGlobals}:680).`,
    ),
  },
  grantNonRows: {},
  typeAliases: {},
  foundryNonRows: [],
  defects: [
    {
      id: 'spells-flag',
      suffixes: ['Spells'],
      text: `PCGen defines Paladin_CF_Spells and sets it from its FACT (${coreRulebookGlobals}:671, :712) but gates nothing on it: the class block casts from 4th whatever the flag (roleplaying_game/core_rulebook/cr_classes.lst:174-190), so an archetype setting it keeps the spells in PCGen. The mapper maps it by its name to the casting row.`,
    },
  ],
};

// --- Antipaladin ------------------------------------------------------------

const antipaladinFile = classFile('antipaladin.uynVENa0deVdmf53');
const antipaladinRow = classRows({
  recordPrefix: 'Antipaladin',
  grantFile: advancedPlayersGuideGlobals,
  foundryFile: antipaladinFile,
});
/** The PRD's Table: Antipaladin (APG p.119), whose 1st-level row is at :405. */
const antipaladinTable = 'advancedPlayersGuide/coreClasses/paladin.html';
const antipaladinTableRow = makeTableRowCiter({
  page: antipaladinTable,
  firstRow: 405,
});

const antipaladin: ReviewedSchedule = {
  kind: 'reviewed',
  className: 'Antipaladin',
  classKey: 'pf1/uynVENa0deVdmf53',
  source: {
    book: "Pathfinder RPG Advanced Player's Guide",
    pages: '118–123',
  },
  printedTable: {
    status: 'reviewed',
    page: antipaladinTable,
    firstRow: 405,
    caption: 'Antipaladin',
    unprinted: {
      spells: `The Spells per Day columns give the antipaladin's spells from 4th (${antipaladinTableRow(4)}; ${antipaladinTable}:460).`,
    },
  },
  foundryFile: antipaladinFile,
  acquisitionRecords: ['Antipaladin'],
  metadataRecords: ['Antipaladin'],
  flagNamespace: 'Antipaladin',
  slug: 'antipaladin',
  classSkillsRecord: 'Antipaladin ~ Class Skills',
  skillRanksPerLevel: 2,
  skillRanksAt: at(antipaladinFile, 104),
  features: [
    antipaladinRow({
      id: 'aura-of-evil',
      name: 'Aura of Evil',
      key: '2YA3Ken4K90rB0EE',
      levels: [1],
      pcgenRecord: 'Aura of Evil',
      pcgenLine: 76,
      foundryLine: 67,
    }),
    antipaladinRow({
      id: 'detect-good',
      name: 'Detect Good',
      key: '4RSsmGUZBhTiGmSj',
      levels: [1],
      pcgenRecord: 'Detect Good',
      pcgenLine: 77,
      foundryLine: 69,
    }),
    antipaladinRow({
      id: 'smite-good',
      name: 'Smite Good',
      key: 'DbC7QZBYYIClw1m6',
      ...scheduleSteps({
        steps: buildPerDaySteps({ name: 'Smite Good', levels: perDayLevels }),
      }),
      // By class level, unlike the paladin's mercies
      // (apg_abilities_class.lst:977-983).
      parts: byLevel('SmiteGood', perDayLevels),
      increments: 'numbered',
      pcgenRecord: 'Smite Good',
      pcgenLine: 78,
      foundryLine: 71,
      acquisitionFormula: abilityFile('smite-good.DbC7QZBYYIClw1m6', 50),
      decision: `PCGen takes one use off for each Antipaladin_CF_SmiteGood<level>, gated at DetectGoodLVL 1, 4, 7, 10, 13, 16 and 19 (${advancedPlayersGuideAbilities}:977-983): named and gated by class level, unlike the paladin's mercies. The class text gives smite good once a day at 1st and once more at 4th and every three levels after (${antipaladinTable}:431, :433), as Table: Antipaladin prints smite good 1/day to 7/day (${citeRows({ tableRow: antipaladinTableRow, levels: perDayLevels })}).`,
    }),
    antipaladinRow({
      id: 'touch-of-corruption',
      name: 'Touch of Corruption',
      key: 'aabyB4FV9OH7hcYZ',
      levels: [2],
      pcgenLine: 79,
      foundryLine: 73,
      acquisitionFormula: abilityFile(
        'touch-of-corruption.aabyB4FV9OH7hcYZ',
        21,
      ),
      decision: `The table prints touch of corruption at 2nd only (${antipaladinTableRow(2)}); its uses and 1d6 for every two antipaladin levels are class text (${antipaladinTable}:435), which Foundry's record computes from the level (touch-of-corruption.aabyB4FV9OH7hcYZ.yaml:21): one row.`,
    }),
    antipaladinRow({
      id: 'unholy-resilience',
      name: 'Unholy Resilience',
      key: 'J0CtwXcv94eGCSaW',
      levels: [2],
      pcgenLine: 80,
      foundryLine: 75,
    }),
    antipaladinRow({
      id: 'aura-of-cowardice',
      name: 'Aura of Cowardice',
      key: 'dhBZs1g1QQNQM3vm',
      levels: [3],
      pcgenLine: 81,
      foundryLine: 77,
    }),
    antipaladinRow({
      id: 'cruelty',
      name: 'Cruelty',
      key: 'zwZnq5WCBCijev6o',
      levels: everyThirdLevels,
      // "Cruelty" at 3rd and every 3 levels after (paladin.html:407-422).
      incrementName: () => 'Cruelty',
      // By class level (apg_abilities_class.lst:985-990).
      parts: byLevel('Cruelty', everyThirdLevels),
      increments: 'numbered',
      pcgenLine: 82,
      foundryLine: 81,
      decision: `PCGen takes one cruelty off for each Antipaladin_CF_Cruelty<level>, gated at CrueltyLVL 3, 6, 9, 12, 15 and 18 (${advancedPlayersGuideAbilities}:985-990): named and gated by class level, unlike the paladin's mercies. The class text gives a cruelty at 3rd and every three levels after (${antipaladinTable}:439), as Table: Antipaladin prints (${citeRows({ tableRow: antipaladinTableRow, levels: everyThirdLevels })}).`,
    }),
    antipaladinRow({
      id: 'plague-bringer',
      name: 'Plague Bringer',
      key: 'jz0LkAoq9lgyZXGM',
      levels: [3],
      pcgenLine: 83,
      foundryLine: 79,
    }),
    antipaladinRow({
      id: 'channel-negative-energy',
      name: 'Channel Negative Energy',
      key: 'veyAa4qdI9lqSx6m',
      levels: [4],
      pcgenLine: 84,
      foundryLine: 85,
      acquisitionFormula: abilityFile(
        'channel-negative-energy.veyAa4qdI9lqSx6m',
        19,
      ),
      decision: `The table prints channel negative energy at 4th only (${antipaladinTableRow(4)}); the antipaladin channels as a cleric of his level (${antipaladinTable}:459), which Foundry's record computes from the level (channel-negative-energy.veyAa4qdI9lqSx6m.yaml:19): one row.`,
    }),
    antipaladinRow({
      id: 'spells',
      name: 'Antipaladin Spells',
      key: '4y0HhgmT2yPcdUoK',
      levels: [4],
      whole: ['Spells'],
      casting: true,
      pcgenLine: null,
      foundryLine: 83,
      decision: `${describeCastingRow({ name: 'Antipaladin Spells', foundryLevel: 4 })} The class text gives the spells from 4th (${antipaladinTable}:460), and PCGen casts from the class block's 4th-level line (roleplaying_game/advanced_players_guide/apg_classes.lst:226-242), behind no flag (defect spells-flag).`,
    }),
    antipaladinRow({
      id: 'fiendish-boon',
      name: 'Fiendish Boon',
      key: 'LYWqXODjRJjVJeQ1',
      levels: [5],
      pcgenLine: 85,
      foundryLine: 87,
    }),
    antipaladinRow({
      id: 'aura-of-despair',
      name: 'Aura of Despair',
      key: '31CVgcirb74C3ieQ',
      levels: [8],
      pcgenLine: 86,
      foundryLine: 89,
    }),
    antipaladinRow({
      id: 'aura-of-vengeance',
      name: 'Aura of Vengeance',
      key: 'SqTaI2sHPIZpLDtQ',
      levels: [11],
      pcgenLine: 87,
      foundryLine: 91,
    }),
    antipaladinRow({
      id: 'aura-of-sin',
      name: 'Aura of Sin',
      key: 'nyz3JgtYMrJZF6o5',
      levels: [14],
      pcgenLine: 88,
      foundryLine: 93,
    }),
    antipaladinRow({
      id: 'aura-of-depravity',
      name: 'Aura of Depravity',
      key: 'LkbGAZaa2KDrnS89',
      levels: [17],
      pcgenLine: 89,
      foundryLine: 95,
    }),
    antipaladinRow({
      id: 'unholy-champion',
      name: 'Unholy Champion',
      key: 'aqB7IymBc8kzJbzQ',
      levels: [20],
      pcgenLine: 90,
      foundryLine: 97,
    }),
  ],
  nonRows: {
    ClassSkills: classSkills,
    WeaponProficiencies: proficiency,
    ArmorProficiencies: proficiency,
  },
  grantNonRows: {},
  typeAliases: {
    // Dread Vanguard's TYPE (coc_abilities_class.lst:12), spelled as the
    // antipaladin's bridges are (Paladin<feature>,
    // apg_abilities_globalvar.lst:718-732): its beacon of evil "replaces the
    // dread vanguard's ability to cast spells" (:13).
    PaladinSpells: 'Spells',
  },
  foundryNonRows: [],
  defects: [
    {
      id: 'spells-flag',
      suffixes: ['Spells'],
      text: `PCGen defines Antipaladin_CF_Spells and sets it from its FACT (${advancedPlayersGuideGlobals}:665, :699) but gates nothing on it: the class block casts from 4th whatever the flag (roleplaying_game/advanced_players_guide/apg_classes.lst:226-242), so an archetype setting it keeps the spells in PCGen. The mapper maps it by its name to the casting row.`,
    },
  ],
};

// --- Cavalier ---------------------------------------------------------------

const cavalierFile = classFile('cavalier.u1ed3H9xtYQXTP5v');
const cavalierRow = classRows({
  recordPrefix: 'Cavalier',
  grantFile: advancedPlayersGuideGlobals,
  foundryFile: cavalierFile,
});
/** The PRD's Table: Cavalier (APG p.33), whose 1st-level row is at :356. */
const cavalierTable = 'advancedPlayersGuide/baseClasses/cavalier.html';
const cavalierTableRow = makeTableRowCiter({
  page: cavalierTable,
  firstRow: 356,
});

const cavalier: ReviewedSchedule = {
  kind: 'reviewed',
  className: 'Cavalier',
  classKey: 'pf1/u1ed3H9xtYQXTP5v',
  source: { book: "Pathfinder RPG Advanced Player's Guide", pages: '32–37' },
  printedTable: {
    status: 'reviewed',
    page: cavalierTable,
    firstRow: 356,
    caption: 'Cavalier',
    unprinted: {},
  },
  foundryFile: cavalierFile,
  acquisitionRecords: ['Cavalier'],
  metadataRecords: ['Cavalier'],
  flagNamespace: 'Cavalier',
  slug: 'cavalier',
  classSkillsRecord: 'Cavalier ~ Class Skills',
  skillRanksPerLevel: 4,
  skillRanksAt: at(cavalierFile, 81),
  features: [
    cavalierRow({
      id: 'challenge',
      name: 'Challenge',
      key: 'WNi2SBF6Z2zhBMCl',
      ...scheduleSteps({
        steps: buildPerDaySteps({ name: 'Challenge', levels: perDayLevels }),
      }),
      pcgenLine: 38,
      foundryLine: 50,
      acquisitionFormula: abilityFile('challenge-cav.WNi2SBF6Z2zhBMCl', 37),
      decision: `PCGen grants Cavalier ~ Challenge once at 1 (${advancedPlayersGuideGlobals}:38) and holds the uses in a formula, (CavalierLVL+2)/3 (${advancedPlayersGuideAbilities}:193), numbering none. The class text gives a challenge once a day at 1st and once more at 4th and every three levels after (${cavalierTable}:380), as Table: Cavalier prints challenge 1/day to 7/day (${citeRows({ tableRow: cavalierTableRow, levels: perDayLevels })}). Rows read at 1, 4, 7, 10, 13, 16 and 19.`,
    }),
    cavalierRow({
      id: 'mount',
      name: 'Mount',
      key: 'P2XyBCDEUGOFwRAF',
      levels: [1],
      pcgenLine: 39,
      foundryLine: 52,
    }),
    cavalierRow({
      id: 'order',
      name: 'Order',
      key: 'c3MSLdplxdRZrSxL',
      levels: orderLevels,
      // "Order" at 1st, "Order ability" at 2nd, 8th and 15th
      // (cavalier.html:356-370).
      incrementName: (index) => (index === 0 ? 'Order' : 'Order Ability'),
      // By class level (apg_abilities_class.lst:226-228).
      parts: byLevel('OrderAbility', orderLevels.slice(1)),
      increments: 'numbered',
      pcgenLine: 40,
      foundryLine: 54,
      decision: `PCGen grants Cavalier ~ Order once at 1 (${advancedPlayersGuideGlobals}:40) and takes each order ability off for Cavalier_CF_OrderAbility2, 8 or 15, gated at OrderAbilityLVL 2, 8 and 15 (${advancedPlayersGuideAbilities}:226-228): named and gated by class level. The class text has the cavalier pledge himself to an order at 1st, whose challenge, skills and edicts he gains then (${cavalierTable}:386), and each order give its order abilities at 2nd, 8th and 15th (the order of the cockatrice's, ${cavalierTable}:406-409), as Table: Cavalier prints order and then order ability (${citeRows({ tableRow: cavalierTableRow, levels: orderLevels })}). The 1st-level Order row is the pledge, apart from the order abilities, so a part removal of an order ability leaves the order.`,
    }),
    cavalierRow({
      id: 'tactician',
      name: 'Tactician',
      key: 'YKyAQ2o5Yzox79B8',
      levels: [1],
      pcgenLine: 41,
      foundryLine: 56,
    }),
    cavalierRow({
      id: 'cavaliers-charge',
      name: 'Cavalier’s Charge',
      key: 'QGv2YjclwgkruFE6',
      levels: [3],
      whole: ['CavaliersCharge'],
      pcgenLine: 42,
      foundryLine: 58,
    }),
    cavalierRow({
      id: 'expert-trainer',
      name: 'Expert Trainer',
      key: 'nBpz562qzAntafUI',
      levels: [4],
      pcgenLine: 43,
      foundryLine: 60,
    }),
    cavalierRow({
      id: 'banner',
      name: 'Banner',
      key: 'pqu1Mvo46iRpVH3I',
      levels: [5],
      pcgenLine: 45,
      foundryLine: 62,
      decision: `The table prints banner at 5th only (${cavalierTableRow(5)}); its bonuses' rise at 10th and every five levels after is class text (${cavalierTable}:391), and Foundry's Banner computes nothing from the level (banner.pqu1Mvo46iRpVH3I.yaml): one row.`,
    }),
    cavalierRow({
      id: 'bonus-feat',
      name: 'Bonus Feat',
      key: 'vfu0FW2XYF7cBUQp',
      levels: bonusFeatLevels,
      // "Bonus feat" at 6th, 12th and 18th (cavalier.html:361-373).
      incrementName: () => 'Bonus Feat',
      // TYPE.CavalierBonusFeats is bridged to the whole
      // (apg_abilities_globalvar.lst:326).
      whole: ['BonusFeat', 'BonusFeats'],
      parts: {
        // As PCGen gates them: TYPE.CavalierCavaliersBonusFeat<n>
        // (apg_abilities_class.lst:221-223).
        ...byLevel('CavaliersBonusFeat', bonusFeatLevels),
        // As the archetypes' flags and the comment at :219 spell them
        // (defect bonus-feat-flags).
        ...byLevel('BonusFeat', bonusFeatLevels),
      },
      increments: 'numbered',
      pcgenLine: 44,
      foundryLine: 64,
      acquisitionFormula: abilityFile('bonus-feat-cav.vfu0FW2XYF7cBUQp', 13),
      decision: `PCGen grants Cavalier ~ Bonus Feat once at 6 (${advancedPlayersGuideGlobals}:44) with a pool of CavalierLVL/6 feats (${advancedPlayersGuideAbilities}:208), and takes a feat off only for an archetype of TYPE CavalierCavaliersBonusFeat6, 12 or 18 (:221-223), an old-style TYPE gate and no Cavalier_CF_ flag, so PCGen gates no part variable; the archetypes' Cavalier_CF_BonusFeat<n> flags gate nothing (defect bonus-feat-flags). The class text gives a bonus feat at 6th and every six levels after (${cavalierTable}:392), as Table: Cavalier prints (${citeRows({ tableRow: cavalierTableRow, levels: bonusFeatLevels })}). Both spellings map by name, by class level.`,
    }),
    cavalierRow({
      id: 'greater-tactician',
      name: 'Greater Tactician',
      key: 'ikVwT8b9zfj701k1',
      levels: [9],
      pcgenLine: 46,
      foundryLine: 66,
    }),
    cavalierRow({
      id: 'mighty-charge',
      name: 'Mighty Charge',
      key: 'fo3SQLOjFcQSmVMJ',
      levels: [11],
      pcgenLine: 47,
      foundryLine: 68,
    }),
    cavalierRow({
      id: 'demanding-challenge',
      name: 'Demanding Challenge',
      key: 'jqXRcfZYvBL50z0q',
      levels: [12],
      pcgenLine: 48,
      foundryLine: 70,
    }),
    cavalierRow({
      id: 'greater-banner',
      name: 'Greater Banner',
      key: '1Yy6Fn3UD82uviFg',
      levels: [14],
      pcgenLine: 49,
      foundryLine: 72,
    }),
    cavalierRow({
      id: 'master-tactician',
      // Foundry's record is "Master Tacitician" (master-tacitician.mrJ61WiA6PuZgPTJ.yaml).
      name: 'Master Tactician',
      key: 'mrJ61WiA6PuZgPTJ',
      levels: [17],
      pcgenLine: 50,
      foundryLine: 74,
    }),
    cavalierRow({
      id: 'supreme-charge',
      name: 'Supreme Charge',
      key: 'pZaZcT8gMPQGX9Ur',
      levels: [20],
      pcgenLine: 51,
      foundryLine: 76,
    }),
  ],
  nonRows: {
    ClassSkills: classSkills,
    Proficiencies: proficiency,
    WeaponProficiencies: proficiency,
    ArmorProficiencies: proficiency,
    ArmorProficiency: proficiency,
    HeavyArmorProficiency: proficiency,
    MediumArmorProficiency: proficiency,
    LightArmorProficiency: proficiency,
    ShieldProficiency: proficiency,
  },
  grantNonRows: {},
  typeAliases: {
    // Fell Rider's rampage "replaces cavalier's charge" (ARG p.137,
    // advancedRaceGuide/featuredRaces/hobgoblins.html:395;
    // arg_abilities_class.lst:568).
    CavalierCharge: 'CavaliersCharge',
    // Standard Bearer's mount "replaces the standard cavalier's banner
    // ability" (UC p.38, ultimateCombat/classArchetypes/cavalier.html:432;
    // uc_abilities_class.lst:474).
    CavalierCavaliersBanner: 'Banner',
    // Cavalier's charge spelled with its apostrophe (Oadiran Horselord,
    // Spellscar Drifter, campaign_setting/inner_sea_combat/
    // isc_abilities_class.lst:29, :35) and without the class prefix (Herald
    // Squire, player_companion/knights_of_the_inner_sea/
    // kotis_abilities_class.lst:11).
    "CavalierCavalier'sCharge": 'CavaliersCharge',
    CavaliersCharge: 'CavaliersCharge',
  },
  foundryNonRows: [],
  defects: [
    {
      id: 'bonus-feat-flags',
      suffixes: bonusFeatLevels.map((level) => `BonusFeat${level}`),
      text: `Archetypes mark a cavalier bonus feat removed with Cavalier_CF_BonusFeat6, 12 or 18 (Strategist, ${ultimateCombatAbilities}:1890; Oadiran Horselord, campaign_setting/inner_sea_combat/isc_abilities_class.lst:584) or TYPE CavalierBonusFeat<n>, as the comment at ${advancedPlayersGuideAbilities}:219 names it, but PCGen defines no such flag (${advancedPlayersGuideGlobals}:278-294) and takes a feat off only for TYPE CavalierCavaliersBonusFeat<n> (${advancedPlayersGuideAbilities}:221-223): those spellings remove nothing in PCGen. The mapper maps each by its name to the row of that level.`,
    },
  ],
};

// --- Samurai ----------------------------------------------------------------

const samuraiFile = classFile('samurai.yM8xfml1Xrccfwux');
const samuraiRow = classRows({
  recordPrefix: 'Samurai',
  grantFile: ultimateCombatGlobals,
  foundryFile: samuraiFile,
});
/** The PRD's Table: Samurai (UC p.19), whose 1st-level row is at :364. */
const samuraiTable = 'ultimateCombat/classes/samurai.html';
const samuraiTableRow = makeTableRowCiter({
  page: samuraiTable,
  firstRow: 364,
});

const samurai: ReviewedSchedule = {
  kind: 'reviewed',
  className: 'Samurai',
  classKey: 'pf1/yM8xfml1Xrccfwux',
  source: { book: 'Pathfinder RPG Ultimate Combat', pages: '18–22' },
  printedTable: {
    status: 'reviewed',
    page: samuraiTable,
    firstRow: 364,
    caption: 'Samurai',
    unprinted: {},
  },
  foundryFile: samuraiFile,
  acquisitionRecords: ['Samurai'],
  metadataRecords: ['Samurai'],
  flagNamespace: 'Samurai',
  slug: 'samurai',
  classSkillsRecord: 'Samurai ~ Class Skill',
  skillRanksPerLevel: 4,
  skillRanksAt: at(samuraiFile, 84),
  features: [
    samuraiRow({
      id: 'challenge',
      name: 'Challenge',
      key: 'AOasku7u72NB0q3J',
      ...scheduleSteps({
        steps: buildPerDaySteps({ name: 'Challenge', levels: perDayLevels }),
      }),
      pcgenLine: 29,
      foundryLine: 53,
      decision: `PCGen grants Samurai ~ Challenge once at 1 (${ultimateCombatGlobals}:29) and holds the uses in a formula, min((SamuraiChallengeLVL+2)/3,7) (${ultimateCombatAbilities}:187), numbering none. The class text gives a challenge once a day at 1st, plus once more for every three levels beyond 1st, to seven times a day at 19th (${samuraiTable}:391), as Table: Samurai prints challenge 1/day to 7/day (${citeRows({ tableRow: samuraiTableRow, levels: perDayLevels })}). Rows read at 1, 4, 7, 10, 13, 16 and 19. Foundry's Challenge (SAM) computes nothing from the level (challenge-sam.AOasku7u72NB0q3J.yaml).`,
    }),
    samuraiRow({
      id: 'mount',
      name: 'Mount',
      key: 'EpDI0Qi5SDRmL4lK',
      levels: [1],
      pcgenLine: 30,
      foundryLine: 55,
    }),
    samuraiRow({
      id: 'order',
      name: 'Order',
      key: 'Uo3yrfkyguM5wkI2',
      levels: orderLevels,
      // "Order" at 1st, "Order ability" at 2nd, 8th and 15th
      // (samurai.html:364-378).
      incrementName: (index) => (index === 0 ? 'Order' : 'Order Ability'),
      pcgenLine: 31,
      foundryLine: 57,
      decision: `PCGen grants Samurai ~ Order once at 1 (${ultimateCombatGlobals}:31) and the chosen order's abilities through the order's own records at OrderAbilityLVL, bound to SamuraiLVL (${ultimateCombatAbilities}:189), numbering none: the samurai has no order ability flag. The class text has the samurai pledge himself to an order at 1st, typically the order of the warrior, or the ronin or a cavalier order (${samuraiTable}:397-398, :419), each order's abilities at 2nd, 8th and 15th (the order of the warrior's, :427-430), as Table: Samurai prints order and then order ability (${citeRows({ tableRow: samuraiTableRow, levels: orderLevels })}). Rows read at 1, 2, 8 and 15; the orders a samurai may choose are options of the order, which no shared PCGen name makes cavalier rows.`,
    }),
    samuraiRow({
      id: 'resolve',
      name: 'Resolve',
      key: 'fdEn4hZJkIhJEwrQ',
      levels: [1],
      pcgenLine: 32,
      foundryLine: 59,
    }),
    samuraiRow({
      id: 'weapon-expertise',
      name: 'Weapon Expertise',
      key: 'SDe1qkWV2217wSao',
      levels: [3],
      pcgenLine: 33,
      foundryLine: 61,
    }),
    samuraiRow({
      id: 'mounted-archer',
      name: 'Mounted Archer',
      key: 'IA4Z4xwEeubcDqF4',
      levels: [4],
      pcgenLine: 34,
      foundryLine: 63,
    }),
    samuraiRow({
      id: 'banner',
      name: 'Banner',
      key: 'QyW6ly6dN84Ev6AY',
      levels: [5],
      pcgenLine: 35,
      foundryLine: 65,
    }),
    samuraiRow({
      id: 'bonus-feat',
      name: 'Bonus Feat',
      key: 'lKnfkRSOpPjT4qRy',
      levels: bonusFeatLevels,
      // "Bonus feat" at 6th, 12th and 18th (samurai.html:369-381).
      incrementName: () => 'Bonus Feat',
      // The grant's gate and the archetypes' FACT spell it BonusFeats
      // (uc_abilities_globalvar.lst:36; defect bonus-feats-gate).
      whole: ['BonusFeat', 'BonusFeats'],
      parts: {
        // As PCGen gates them (uc_abilities_class.lst:210-212).
        ...byLevel('BonusFeat', bonusFeatLevels),
        // As the FACTs that set them spell them
        // (uc_abilities_globalvar.lst:296-298).
        ...byLevel('BonusFeats', bonusFeatLevels),
      },
      increments: 'numbered',
      pcgenLine: 36,
      foundryLine: 67,
      acquisitionFormula: abilityFile('bonus-feat-sam.lKnfkRSOpPjT4qRy', 13),
      decision: `PCGen grants Samurai ~ Bonus Feat once at 6 (${ultimateCombatGlobals}:36) with a count of SamuraiLVL/6 feats (${ultimateCombatAbilities}:191), and takes a feat off for each Samurai_CF_BonusFeat6, 12 and 18, gated at Samurai 06, 12 and 18 (:210-212): by class level. Those variables are set from FACTs spelled BonusFeats6, 12 and 18 (${ultimateCombatGlobals}:296-298), so both spellings map by name. The class text gives a bonus feat at 6th and every six levels after (${samuraiTable}:410), as Table: Samurai prints (${citeRows({ tableRow: samuraiTableRow, levels: bonusFeatLevels })}).`,
    }),
    samuraiRow({
      id: 'greater-resolve',
      name: 'Greater Resolve',
      key: '5yPVt0Gip4Q1TTs4',
      levels: [9],
      pcgenLine: 37,
      foundryLine: 69,
    }),
    samuraiRow({
      id: 'honorable-stand',
      name: 'Honorable Stand',
      key: 't2XEI2AKkv1CY8to',
      levels: [11],
      pcgenLine: 38,
      foundryLine: 71,
    }),
    samuraiRow({
      id: 'demanding-challenge',
      name: 'Demanding Challenge',
      key: 'BDP3HgB0vmZ9vbQY',
      levels: [12],
      pcgenLine: 39,
      foundryLine: 73,
    }),
    samuraiRow({
      id: 'greater-banner',
      name: 'Greater Banner',
      key: 'f2Xg4pkJelnVyTCH',
      levels: [14],
      pcgenLine: 40,
      foundryLine: 75,
    }),
    samuraiRow({
      id: 'true-resolve',
      name: 'True Resolve',
      key: 'CZrFfvYMX3HK03lC',
      levels: [17],
      pcgenLine: 41,
      foundryLine: 77,
    }),
    samuraiRow({
      id: 'last-stand',
      name: 'Last Stand',
      key: 'k2CQRwlyblNHuius',
      levels: [20],
      pcgenLine: 42,
      foundryLine: 79,
    }),
  ],
  nonRows: {
    ClassSkills: classSkills,
    WeaponProficiencies: proficiency,
    ArmorProficiency: proficiency,
    SamuraiArmorProficiencyHeavy: proficiency,
    SamuraiArmorProficiencyLight: proficiency,
    SamuraiArmorProficiencyMedium: proficiency,
    SamuraiShieldProficiency: proficiency,
  },
  grantNonRows: {},
  typeAliases: {},
  foundryNonRows: [],
  defects: [
    {
      id: 'bonus-feats-gate',
      suffixes: ['BonusFeats'],
      text: `PCGen gates Samurai ~ Bonus Feat on Samurai_CF_BonusFeats (${ultimateCombatGlobals}:36), a variable it never defines (${ultimateCombatGlobals}:268-271 define BonusFeat and BonusFeat6 to 18), while the FACT of that name sets Samurai_CF_BonusFeat (:295): an archetype setting it (Sovereign Blade, player_companion/legacy_of_dragons/lod_abilities_class.lst:334) removes no bonus feat in PCGen. The mapper maps it by its name to the whole feature.`,
    },
  ],
};

/** The P7d schedules, by class name. */
export const smiteChallengeSchedules = {
  Paladin: paladin,
  Antipaladin: antipaladin,
  Cavalier: cavalier,
  Samurai: samurai,
} as const satisfies Readonly<Record<string, ReviewedSchedule>>;
