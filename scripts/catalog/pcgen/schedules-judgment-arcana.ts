import {
  abilityFile,
  at,
  buildPerDaySteps,
  byLevel,
  classFile,
  citeRows,
  classRows,
  classSkills,
  describeCastingRow,
  makeTableRowCiter,
  option,
  proficiency,
  scheduleSteps,
  type ReviewedSchedule,
} from './schedule-model';

/**
 * #772: the reviewed schedules of the Inquisitor and Magus, P7g's launch
 * subset (research note 772-p7g-refresh, refreshing 716-p7-rules §3 P7g and
 * §4; the model: `schedule-model.ts`).
 *
 * - A row is an entry of the table's Special column. The spells, which the
 *   Spells per Day columns give, the inquisitor's spell exchange and the
 *   magus's spellbooks are printed nowhere in it; they and the orisons and
 *   cantrips carry the class's casting, so they are `casting` rows: touching
 *   one is a #422 review item.
 * - PCGen numbers the inquisitor's teamwork feats and the magus's arcana and
 *   bonus feats by class level. The inquisitor's judgment uses are
 *   formula-held: the table alone gives their later rows. Bane is one row at
 *   5th whose rounds a day are the class level; greater bane is its own row.
 * - A row is a casting row when touching it changes what the class's casting
 *   record holds: its list, table, ability or spell recording. Greater spell
 *   access adds wizard spells to the magus list, as the bloodrager's
 *   bloodline spells add theirs (`schedules-rage-performance.ts`); spell
 *   recall and knowledge pool spend arcane pool on the magus's own spells,
 *   as the skald's spell kenning, no casting row, spends a slot.
 */

const advancedPlayersGuideAbilities =
  'roleplaying_game/advanced_players_guide/apg_abilities_class.lst';
const advancedPlayersGuideGlobals =
  'roleplaying_game/advanced_players_guide/apg_abilities_globalvar.lst';
const advancedPlayersGuideControls =
  'roleplaying_game/advanced_players_guide/apg__datacontrols.lst';
const ultimateCombatAbilities =
  'roleplaying_game/ultimate_combat/uc_abilities_class.lst';
const ultimateMagicAbilities =
  'roleplaying_game/ultimate_magic/um_abilities_class.lst';
const ultimateMagicGlobals =
  'roleplaying_game/ultimate_magic/um_abilities_globalvar.lst';
const ultimateMagicClasses = 'roleplaying_game/ultimate_magic/um_classes.lst';

// --- Inquisitor -------------------------------------------------------------

const inquisitorFile = classFile('inquisitor.Fv3FbmXptuDRiL5y');
const inquisitorRow = classRows({
  recordPrefix: 'Inquisitor',
  grantFile: advancedPlayersGuideGlobals,
  foundryFile: inquisitorFile,
});
/** The PRD's Table: Inquisitor (APG p.39), whose 1st-level row is at :358. */
const inquisitorTable = 'advancedPlayersGuide/baseClasses/inquisitor.html';
const inquisitorTableRow = makeTableRowCiter({
  page: inquisitorTable,
  firstRow: 358,
});
const judgmentLevels = [1, 4, 7, 10, 13, 16, 19];
const teamworkFeatLevels = [3, 6, 9, 12, 15, 18];
/** The nine judgments sacred and profane judgment grant (apg_abilities_class.lst:297-298). */
const judgments = [
  'Healing',
  'Resiliency',
  'Resistance',
  'Smiting',
  'Destruction',
  'Justice',
  'Piercing',
  'Protection',
  'Purity',
];

const inquisitor: ReviewedSchedule = {
  kind: 'reviewed',
  className: 'Inquisitor',
  classKey: 'pf1/Fv3FbmXptuDRiL5y',
  source: { book: "Pathfinder RPG Advanced Player's Guide", pages: '38–42' },
  printedTable: {
    status: 'reviewed',
    page: inquisitorTable,
    firstRow: 358,
    caption: 'Inquisitor',
    unprinted: {
      spells: `The Spells per Day columns give the inquisitor's spells, which the class text describes (${inquisitorTable}:406, ${inquisitorTableRow(1)}); the Special column prints no spells entry.`,
      'exchange-spell': `The class text lets the inquisitor exchange a spell known at 5th and every third level after (${inquisitorTable}:410); the table prints no entry for it.`,
    },
  },
  foundryFile: inquisitorFile,
  acquisitionRecords: ['Inquisitor'],
  metadataRecords: ['Inquisitor'],
  flagNamespace: 'Inquisitor',
  slug: 'inquisitor',
  classSkillsRecord: 'Inquisitor ~ Class Skills',
  skillRanksPerLevel: 6,
  skillRanksAt: at(inquisitorFile, 113),
  features: [
    inquisitorRow({
      id: 'domain',
      name: 'Domain',
      key: 'dMtxCqoMLtD9nEjU',
      levels: [1],
      whole: ['Domains'],
      pcgenName: 'Domains',
      pcgenLine: 53,
      foundryLine: 66,
      decision: `The inquisitor's domain gives domain powers only: no bonus spells or spell slots (${inquisitorTable}:412), so it is no casting row.`,
    }),
    inquisitorRow({
      id: 'judgment',
      name: 'Judgment',
      key: 'qI4IouTn4uvDPSXv',
      ...scheduleSteps({
        steps: buildPerDaySteps({ name: 'Judgment', levels: judgmentLevels }),
      }),
      pcgenLine: 54,
      foundryLine: 68,
      acquisitionFormula: abilityFile('judgment.qI4IouTn4uvDPSXv', 88),
      decision: `PCGen grants Inquisitor ~ Judgment once at 1 (${advancedPlayersGuideGlobals}:54) and holds its uses in a formula, 1+(InquisitorLVL-1)/3 (${advancedPlayersGuideAbilities}:354), numbering none. The class text gives one use a day at 1st and one more at 4th and every three levels after (${inquisitorTable}:414), as Table: Inquisitor prints judgment 1/day to 7/day (${citeRows({ tableRow: inquisitorTableRow, levels: judgmentLevels })}).`,
    }),
    inquisitorRow({
      id: 'monster-lore',
      name: 'Monster Lore',
      key: '9Y9dpXEcjXGtH6Pe',
      levels: [1],
      pcgenLine: 55,
      foundryLine: 70,
    }),
    inquisitorRow({
      id: 'orisons',
      name: 'Orisons',
      key: 'RaFl9SpbAlXqhsDk',
      levels: [1],
      casting: true,
      pcgenLine: null,
      foundryLine: 74,
      decision: `PCGen defines Inquisitor ~ Orisons (${advancedPlayersGuideAbilities}:296) but grants it nowhere; Foundry links Orisons at 1, the level Table: Inquisitor prints them (${inquisitorTableRow(1)}). They are 0-level spells of the class's casting, so they stay a casting row: touching it is a #422 review item.`,
    }),
    inquisitorRow({
      id: 'spells',
      name: 'Inquisitor Spells',
      key: 'HnrnO6l02MdT9lf5',
      levels: [1],
      whole: ['Spells'],
      casting: true,
      pcgenLine: null,
      foundryLine: 76,
      decision: describeCastingRow({
        name: 'Inquisitor Spells',
        foundryLevel: 1,
      }),
    }),
    inquisitorRow({
      id: 'stern-gaze',
      name: 'Stern Gaze',
      key: 'CzEGD1Fv60Sa4UXe',
      levels: [1],
      pcgenLine: 56,
      foundryLine: 72,
    }),
    inquisitorRow({
      id: 'cunning-initiative',
      name: 'Cunning Initiative',
      key: 'FkPoMSAx3FTGvnXy',
      levels: [2],
      pcgenLine: 57,
      foundryLine: 80,
    }),
    inquisitorRow({
      id: 'detect-alignment',
      name: 'Detect Alignment',
      key: 'KGjeQOeDKBMUt98q',
      levels: [2],
      pcgenLine: 58,
      foundryLine: 82,
    }),
    inquisitorRow({
      id: 'track',
      name: 'Track',
      key: 'r8wPs0bB3WhOLxbX',
      levels: [2],
      pcgenLine: 59,
      foundryLine: 78,
    }),
    inquisitorRow({
      id: 'solo-tactics',
      name: 'Solo Tactics',
      key: '10EysX8x5hvz48lr',
      levels: [3],
      pcgenLine: 60,
      foundryLine: 84,
    }),
    inquisitorRow({
      id: 'teamwork-feat',
      name: 'Teamwork Feat',
      key: '717fyDCcfLtD345B',
      levels: teamworkFeatLevels,
      // “Teamwork feat” at 3rd and every three levels after
      // (inquisitor.html:360-375).
      incrementName: () => 'Teamwork Feat',
      // By class level, inside PREMULT (apg_abilities_class.lst:359-364).
      parts: byLevel('TeamworkFeat', teamworkFeatLevels),
      increments: 'numbered',
      pcgenLine: 61,
      foundryLine: 86,
      acquisitionFormula: abilityFile('teamwork-feat.717fyDCcfLtD345B', 13),
      decision: `PCGen takes one teamwork feat off for each Inquisitor_CF_TeamworkFeat<level>, gated PREMULT:2,[PREVARGTEQ:InquisitorLVL,<level>],[PREVAREQ:Inquisitor_CF_TeamworkFeat<level>,1] at 3, 6 … 18 (${advancedPlayersGuideAbilities}:359-364): named and gated by class level. The class text gives a teamwork feat at 3rd and every three levels after (${inquisitorTable}:432), as Table: Inquisitor prints (${citeRows({ tableRow: inquisitorTableRow, levels: teamworkFeatLevels })}). The 3rd-level row is the first feat, so TeamworkFeat3 replaces it.`,
    }),
    inquisitorRow({
      id: 'exchange-spell',
      name: 'Exchange Spell',
      key: '5lDEyC6WejFyTEho',
      levels: [5],
      whole: [],
      casting: true,
      pcgenLine: null,
      foundryLine: 88,
      decision: `${describeCastingRow({ name: 'Exchange Spell', foundryLevel: 5 })} The table has no row for it: the class text lets the inquisitor exchange a spell known at 5th and every third level after (${inquisitorTable}:410).`,
    }),
    inquisitorRow({
      id: 'bane',
      name: 'Bane',
      key: 'MpvhQz62qw68D2pd',
      levels: [5],
      pcgenLine: 62,
      foundryLine: 90,
      acquisitionFormula: abilityFile('bane.MpvhQz62qw68D2pd', 40),
      decision: `The table prints bane at 5th only (${inquisitorTableRow(5)}); its rounds a day are the class level, in PCGen (BONUS:VAR|InquisitorBanePool|InquisitorLVL, ${advancedPlayersGuideAbilities}:305) and Foundry (bane.MpvhQz62qw68D2pd.yaml:40): one row. Greater bane at 12th is its own row (${inquisitorTableRow(12)}; ${advancedPlayersGuideGlobals}:66).`,
    }),
    inquisitorRow({
      id: 'discern-lies',
      name: 'Discern Lies',
      key: 'S9lYCsz7oA7v3GzR',
      levels: [5],
      pcgenLine: 63,
      foundryLine: 92,
    }),
    inquisitorRow({
      id: 'second-judgment',
      name: 'Second Judgment',
      key: 'L9DSWVtX0siTfaXL',
      levels: [8],
      pcgenLine: 64,
      foundryLine: 94,
    }),
    inquisitorRow({
      id: 'stalwart',
      name: 'Stalwart',
      key: 'igyMWtX3cB2HZeSF',
      levels: [11],
      pcgenLine: 65,
      foundryLine: 96,
    }),
    inquisitorRow({
      id: 'greater-bane',
      name: 'Greater Bane',
      key: 'TNYCH3v1Y9lUQDPT',
      levels: [12],
      pcgenLine: 66,
      foundryLine: 98,
    }),
    inquisitorRow({
      id: 'exploit-weakness',
      name: 'Exploit Weakness',
      key: 'UGtjpdIwNF8mAh4z',
      levels: [14],
      pcgenLine: 67,
      foundryLine: 100,
    }),
    inquisitorRow({
      id: 'third-judgment',
      name: 'Third Judgment',
      key: 'QXskUuwbmQtFoFti',
      levels: [16],
      pcgenLine: 68,
      foundryLine: 102,
    }),
    inquisitorRow({
      id: 'slayer',
      name: 'Slayer',
      key: 'cbRqq4Zwspgr3681',
      levels: [17],
      pcgenLine: 69,
      foundryLine: 104,
    }),
    inquisitorRow({
      id: 'true-judgment',
      name: 'True Judgment',
      key: '1SnLu7RJAq1hJzYg',
      levels: [20],
      // Spellbreaker's undefined flag names it (defect final-judgment).
      whole: ['TrueJudgment', 'FinalJudgment'],
      pcgenLine: 70,
      foundryLine: 106,
    }),
  ],
  nonRows: {
    ClassSkills: classSkills,
    ...Object.fromEntries(
      judgments.map((judgment) => [`Judgment${judgment}`, option('judgment')]),
    ),
  },
  grantNonRows: {},
  typeAliases: {},
  foundryNonRows: [],
  defects: [
    {
      id: 'final-judgment',
      suffixes: ['FinalJudgment'],
      text: `Spellbreaker sets FACT:Inquisitor_CF_FinalJudgment and its TYPE InquisitorFinalJudgment (${ultimateCombatAbilities}:1914, :870), but PCGen never defines Inquisitor_CF_FinalJudgment (${advancedPlayersGuideGlobals}:343-378) and bridges neither the FACT nor the TYPE (:380-435); only a FACTDEF names it (${advancedPlayersGuideControls}:223). True judgment's grant gates on Inquisitor_CF_TrueJudgment (${advancedPlayersGuideGlobals}:70), so PCGen keeps it. The archetype's page calls the 20th-level feature final judgment (ultimateCombat/classArchetypes/inquisitor.html:371), the class table true judgment (${inquisitorTableRow(20)}): the mapper maps the flag by name to true judgment.`,
    },
  ],
};

// --- Magus ------------------------------------------------------------------

const magusFile = classFile('magus.xZLcyrEKYZoJPS2k');
const magusRow = classRows({
  recordPrefix: 'Magus',
  grantFile: ultimateMagicGlobals,
  foundryFile: magusFile,
});
/** The PRD's Table: Magus (UM p.10), whose 1st-level row is at :367. */
const magusTable = 'ultimateMagic/spellcasters/magus.html';
const magusTableRow = makeTableRowCiter({ page: magusTable, firstRow: 367 });
const arcanaLevels = [3, 6, 9, 12, 15, 18];
const bonusFeatLevels = [5, 11, 17];

const magus: ReviewedSchedule = {
  kind: 'reviewed',
  className: 'Magus',
  classKey: 'pf1/xZLcyrEKYZoJPS2k',
  source: { book: 'Pathfinder RPG Ultimate Magic', pages: '9–13' },
  printedTable: {
    status: 'reviewed',
    page: magusTable,
    firstRow: 367,
    caption: 'Magus',
    unprinted: {
      spellbooks: `The class text gives the magus's spellbook (${magusTable}:393); the table prints no entry for it.`,
      spells: `The Spells per Day columns give the magus's spells, which the class text describes (${magusTable}:389, ${magusTableRow(1)}); the Special column prints no spells entry.`,
    },
  },
  foundryFile: magusFile,
  acquisitionRecords: ['Magus'],
  metadataRecords: ['Magus'],
  flagNamespace: 'Magus',
  slug: 'magus',
  classSkillsRecord: 'Magus ~ Class Skills',
  skillRanksPerLevel: 2,
  skillRanksAt: at(magusFile, 102),
  features: [
    magusRow({
      id: 'arcane-pool',
      name: 'Arcane Pool',
      key: 'mpe3JHJMINddqLWr',
      levels: [1],
      pcgenLine: 10,
      foundryLine: 58,
    }),
    magusRow({
      id: 'spell-combat',
      name: 'Spell Combat',
      key: 'lj4yLDvoxGFHiwSk',
      levels: [1],
      pcgenLine: 11,
      foundryLine: 60,
    }),
    magusRow({
      id: 'cantrips',
      name: 'Cantrips',
      key: 'IPy4aqFYbOppaqKC',
      levels: [1],
      casting: true,
      pcgenLine: 12,
      foundryLine: 62,
    }),
    magusRow({
      id: 'spellbooks',
      name: 'Spellbooks',
      key: 'P0EhxFOJJXWMBiZi',
      levels: [1],
      casting: true,
      pcgenLine: null,
      foundryLine: 64,
      decision: `${describeCastingRow({ name: 'Spellbooks', foundryLevel: 1 })} PCGen gives only the Internal Magus Free Spellbook, with no level gate (${ultimateMagicGlobals}:7); the wizard's spellbooks are a casting row too.`,
    }),
    magusRow({
      id: 'spells',
      name: 'Magus Spells',
      key: 'Bd6X95yJfPz6zPkP',
      levels: [1],
      whole: ['Spells'],
      casting: true,
      pcgenLine: null,
      foundryLine: 66,
      decision: `${describeCastingRow({ name: 'Magus Spells', foundryLevel: 1 })} PCGen defines and bridges Magus_CF_Spells (${ultimateMagicGlobals}:32, :67) but gates nothing on it.`,
    }),
    magusRow({
      id: 'spellstrike',
      name: 'Spellstrike',
      key: 'OsEuRDHP7jcJ2fIJ',
      levels: [2],
      pcgenLine: 13,
      foundryLine: 68,
    }),
    magusRow({
      id: 'magus-arcana',
      name: 'Magus Arcana',
      key: 'HJ2vLLDYkihPxFkD',
      levels: arcanaLevels,
      // “Magus Arcana” at 3rd and every three levels after
      // (magus.html:369-384).
      incrementName: () => 'Magus Arcana',
      whole: ['Arcana'],
      // By class level, gated on a count (um_abilities_class.lst:72-77).
      parts: byLevel('Arcana', arcanaLevels),
      increments: 'numbered',
      pcgenLine: 14,
      foundryLine: 70,
      decision: `PCGen takes one arcana off the Magus Arcana pool for each Magus_CF_Arcana<level>, gated PREVARGTEQ:MagusArcanaCount,<n> where the count is MagusArcanaLVL/3 (${ultimateMagicAbilities}:72-77): named by class level, though only the schedule levels them. The class text gives an arcana at 3rd and every three levels after (${magusTable}:402), as Table: Magus prints (${citeRows({ tableRow: magusTableRow, levels: arcanaLevels })}). The 3rd-level row is the first arcana, so Arcana3 replaces it; Arcana15 is never defined (defect arcana-15).`,
    }),
    magusRow({
      id: 'spell-recall',
      name: 'Spell Recall',
      key: 'IyfoUjtyaS8lakWc',
      levels: [4],
      pcgenLine: 15,
      foundryLine: 72,
    }),
    magusRow({
      id: 'bonus-feats',
      name: 'Bonus Feats',
      key: 'gzBR0qkMdu0KkLV0',
      levels: bonusFeatLevels,
      // “Bonus Feat” at 5th, 11th and 17th (magus.html:371, :377, :383).
      incrementName: () => 'Bonus Feat',
      // By class level, inside PREMULT (um_abilities_class.lst:62-64).
      parts: byLevel('BonusFeat', bonusFeatLevels),
      increments: 'numbered',
      pcgenLine: 16,
      foundryLine: 74,
      acquisitionFormula: abilityFile('bonus-feats-mag.gzBR0qkMdu0KkLV0', 13),
      decision: `PCGen takes one bonus feat off for each Magus_CF_BonusFeat<level>, gated PREMULT:2,[PRECLASS:1,Magus=<level>],[PREVAREQ:Magus_CF_BonusFeat<level>,1] at 5, 11 and 17 (${ultimateMagicAbilities}:62-64): named and gated by class level. The class text gives a bonus feat at 5th and every six levels after (${magusTable}:424), as Table: Magus prints (${citeRows({ tableRow: magusTableRow, levels: bonusFeatLevels })}). The 5th-level row is the first feat, so BonusFeat5 replaces it.`,
    }),
    magusRow({
      id: 'knowledge-pool',
      name: 'Knowledge Pool',
      key: 'QhHS0Qr5FxH4LtaI',
      levels: [7],
      pcgenLine: 17,
      foundryLine: 76,
    }),
    magusRow({
      id: 'medium-armor',
      name: 'Medium Armor',
      key: 'Js83QWyHQQ4PjP0m',
      levels: [7],
      whole: ['MediumArmorProficiency'],
      pcgenLine: 25,
      foundryLine: 78,
      decision: `PCGen grants Magus ~ Medium Armor at MagusArmorProficiencyLVL 7 (${ultimateMagicGlobals}:25), the level Magus ~ Armor Proficiency binds to the magus level (${ultimateMagicAbilities}:26; MagusLVL, ${ultimateMagicClasses}:8), gated on Magus_CF_MediumArmorProficiency, which names the row; Table: Magus prints it at 7th (${magusTableRow(7)}). Its flags don't remove it in PCGen (defect armor-flags).`,
    }),
    magusRow({
      id: 'improved-spell-combat',
      name: 'Improved Spell Combat',
      key: 'G1z392b58wRybqjL',
      levels: [8],
      pcgenLine: 18,
      foundryLine: 80,
    }),
    magusRow({
      id: 'fighter-training',
      name: 'Fighter Training',
      key: 'ePNt8fgtaAxmLnHs',
      levels: [10],
      pcgenLine: 19,
      foundryLine: 82,
    }),
    magusRow({
      id: 'improved-spell-recall',
      name: 'Improved Spell Recall',
      key: 'dakApiblq3ad7AZI',
      levels: [11],
      pcgenLine: 20,
      foundryLine: 84,
    }),
    magusRow({
      id: 'heavy-armor',
      name: 'Heavy Armor',
      key: '0AXAMXGLJIw7CGBd',
      levels: [13],
      whole: ['HeavyArmorProficiency'],
      pcgenLine: 26,
      foundryLine: 86,
      decision: `PCGen grants Magus ~ Heavy Armor at MagusArmorProficiencyLVL 13 (${ultimateMagicGlobals}:26), gated on Magus_CF_HeavyArmorProficiency, which names the row; Table: Magus prints it at 13th (${magusTableRow(13)}). Its flags don't remove it in PCGen (defect armor-flags).`,
    }),
    magusRow({
      id: 'greater-spell-combat',
      name: 'Greater Spell Combat',
      key: 'nWDMATASYzzAShr6',
      levels: [14],
      pcgenLine: 21,
      foundryLine: 88,
    }),
    magusRow({
      id: 'counterstrike',
      name: 'Counterstrike',
      key: 'zLXBKnWXbZ2YKOBo',
      levels: [16],
      pcgenLine: 22,
      foundryLine: 90,
    }),
    magusRow({
      id: 'greater-spell-access',
      name: 'Greater Spell Access',
      key: 'i64BU7HTfaRJEYFj',
      levels: [19],
      casting: true,
      pcgenLine: 23,
      foundryLine: 92,
      decision: `Greater spell access adds 14 wizard spells to the magus spell list as magus spells (${magusTable}:433), a change to the class's spell list, as the bloodrager's bloodline spells are; so it is a casting row: touching it is a #422 review item.`,
    }),
    magusRow({
      id: 'true-magus',
      name: 'True Magus',
      key: 'XAMIufM24q2qAB7o',
      levels: [20],
      pcgenLine: 24,
      foundryLine: 94,
    }),
  ],
  nonRows: {
    ClassSkills: classSkills,
    WeaponProficiency: proficiency,
    ArmorProficiency: proficiency,
    // Magus_Archetype_Proficiencies, which Staff Magus sets beside its
    // weapon and armor proficiency flags (um_abilities_class.lst:2681).
    Proficiencies: proficiency,
  },
  grantNonRows: {},
  typeAliases: {},
  foundryNonRows: [],
  defects: [
    {
      id: 'arcana-15',
      suffixes: ['Arcana15'],
      text: `PCGen gates the 15th-level arcana on Magus_CF_Arcana15 (${ultimateMagicAbilities}:76) but never defines it (${ultimateMagicGlobals}:33-37 define 3, 6, 9, 12 and 18), bridges no FACT to it (:67-72) and no archetype sets it. The mapper maps the flag by name to the 15th-level arcana.`,
    },
    {
      id: 'armor-flags',
      suffixes: [
        'MediumArmorProficiency',
        'HeavyArmorProficiency',
        'ArmorProficiency',
      ],
      text: `The FACT bridges of Magus_CF_MediumArmorProficiency and HeavyArmorProficiency write Magus_CF_MediumArmor and Magus_CF_HeavyArmor (${ultimateMagicGlobals}:93-94), which nothing defines or reads, so those FACTs remove neither armor row; the rows' Magus_CF_ArmorProficiency branch reads PREVARGTEQ …,0, which always holds (:25-26, as light armor's at :29). PCGen removes the rows only through an old-style TYPE or, inferred from PCGen's semantics and not from a PCGen run, as a side effect of removing Magus ~ Armor Proficiency (:9), the only record binding MagusArmorProficiencyLVL (${ultimateMagicAbilities}:26). The mapper maps the medium and heavy armor flags by name to their rows and the armor proficiency flag to prose; whether an archetype's text replaces the armor rows (Staff Magus and Mindblade replace both by other abilities) is read from its text.`,
    },
  ],
};

/** The #772 schedules, by class name. */
export const judgmentArcanaSchedules = {
  Inquisitor: inquisitor,
  Magus: magus,
} as const satisfies Readonly<Record<string, ReviewedSchedule>>;
