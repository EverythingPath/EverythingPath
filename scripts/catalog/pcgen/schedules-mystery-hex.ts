import {
  at,
  byLevel,
  citeRows,
  classFile,
  classRows,
  classSkills,
  describeCastingRow,
  evens,
  makeTableRowCiter,
  notOnTable,
  option,
  ordinal,
  type ReviewedSchedule,
  type ScheduleNonRow,
} from './schedule-model';

/**
 * #771B: the reviewed schedules of the Oracle and Witch, the Advanced
 * Player's Guide half of P7f's launch subset (research note
 * 771-p7f-refresh, refreshing 716-p7-rules §3 P7f and §4; the model:
 * `schedule-model.ts`).
 *
 * - A row is an entry of the table's Special column. The spells, which the
 *   Spells per Day columns give, the oracle's spell exchange and the
 *   witch's patron spells are printed nowhere in it; they and the orisons
 *   and cantrips carry the class's casting, so they are `casting` rows:
 *   touching one is a #422 review item.
 * - The oracle's mystery adds its spells to her spells known, and the
 *   witch's familiar stores every spell she knows, as the wizard's
 *   spellbook holds his, so both are casting rows. The patron's spells are
 *   no rows of their own: each is a casting change of the patron spells row.
 * - PCGen numbers the mystery spells, revelations and hexes by class level,
 *   each kept while its flag is unset; no feature is formula-held. The
 *   major and grand hexes are rows of their own beside the hex picks they
 *   are chosen with, subfeatures of hex.
 */

const advancedPlayersGuideAbilities =
  'roleplaying_game/advanced_players_guide/apg_abilities_class.lst';
const advancedPlayersGuideGlobals =
  'roleplaying_game/advanced_players_guide/apg_abilities_globalvar.lst';
const advancedPlayersGuideClasses =
  'roleplaying_game/advanced_players_guide/apg_classes.lst';
const advancedRaceGuideAbilities =
  'roleplaying_game/advanced_race_guide/arg_abilities_class.lst';
const monsterCodexAbilities =
  'roleplaying_game/monster_codex/mc_abilities_class.lst';
const legacyOfDragonsAbilities =
  'player_companion/legacy_of_dragons/lod_abilities_class.lst';
const apg = "Pathfinder RPG Advanced Player's Guide";

// --- Oracle -----------------------------------------------------------------

const oracleFile = classFile('oracle.5S0u8yFcP861wgd1');
const oracleRow = classRows({
  recordPrefix: 'Oracle',
  grantFile: advancedPlayersGuideGlobals,
  foundryFile: oracleFile,
});
/** The PRD's Table: Oracle (APG p.43), whose 1st-level row is at :359. */
const oracleTable = 'advancedPlayersGuide/baseClasses/oracle.html';
const oracleTableRow = makeTableRowCiter({ page: oracleTable, firstRow: 359 });
const mysterySpellLevels = evens.slice(0, -1);
const revelationLevels = [1, 3, 7, 11, 15, 19];

const oracle: ReviewedSchedule = {
  kind: 'reviewed',
  className: 'Oracle',
  classKey: 'pf1/5S0u8yFcP861wgd1',
  // Foundry's pages (oracle.5S0u8yFcP861wgd1.yaml:75).
  source: { book: apg, pages: '42–54' },
  printedTable: {
    status: 'reviewed',
    page: oracleTable,
    firstRow: 359,
    caption: 'Oracle',
    unprinted: {
      spells: `The Spells per Day columns give the oracle's spells from 1st (${oracleTableRow(1)}; ${oracleTable}:406-408).`,
      'exchange-spell': `The class text, not the Special column, gives the exchange at 4th and every even level after, as part of the spells (${oracleTable}:410).`,
    },
  },
  foundryFile: oracleFile,
  acquisitionRecords: ['Oracle'],
  metadataRecords: ['Oracle'],
  flagNamespace: 'Oracle',
  slug: 'oracle',
  // No record holds the class skills: PCGen lists them on the class block
  // alone (apg_classes.lst:109).
  classSkillsRecord: null,
  skillRanksPerLevel: 4,
  skillRanksAt: at(oracleFile, 72),
  features: [
    oracleRow({
      id: 'mystery',
      name: 'Mystery',
      key: 'ZhQM4K4dqStS6qRn',
      levels: [1, ...mysterySpellLevels],
      // "Mystery" at 1st, "Mystery spell" at 2nd and every two levels after
      // (oracle.html:359-376).
      incrementName: (index) => (index === 0 ? 'Mystery' : 'Mystery Spell'),
      whole: ['OraclesMystery', 'Mystery'],
      // By class level: each mystery's spells are kept while the flag is
      // unset (apg_abilities_class.lst:517).
      parts: byLevel('MysterySpell', mysterySpellLevels),
      increments: 'numbered',
      casting: true,
      pcgenRecord: "Oracle's Mystery",
      pcgenLine: 74,
      foundryLine: 55,
      decision: `PCGen grants Oracle's Mystery once at 1 (${advancedPlayersGuideGlobals}:74), and each mystery adds its spell of the level while Oracle_CF_MysterySpell<level> is unset, PREMULT:2,[PRECLASS:1,Oracle=<level>],[PREVAREQ:Oracle_CF_MysterySpell<level>,0] at 2, 4 … 18 (battle, ${advancedPlayersGuideAbilities}:517; defined ${advancedPlayersGuideGlobals}:448-456): named and gated by class level. The class text gives an additional spell from the mystery at 2nd and every two levels after (${oracleTable}:413), as Table: Oracle prints mystery spell (${citeRows({ tableRow: oracleTableRow, levels: mysterySpellLevels })}): each a row of the mystery, as the bloodrager's bloodline powers are of the bloodline. The spells add to the spells known, so it is a casting row.`,
    }),
    oracleRow({
      id: 'oracles-curse',
      name: 'Oracle’s Curse',
      key: 'kkVnlOkjhww8MoHc',
      levels: [1],
      pcgenRecord: "Oracle's Curse",
      pcgenLine: 73,
      foundryLine: 57,
      decision: `The table prints the curse at 1st only (${oracleTableRow(1)}); its effects at 5th, 10th and 15th are each curse's own (${oracleTable}:415-420), read from the oracle level plus one for every two levels of other classes (:414), as PCGen's OracleCurseLVL (${advancedPlayersGuideAbilities}:479): one row.`,
    }),
    oracleRow({
      id: 'orisons',
      name: 'Orisons',
      key: 'RaFl9SpbAlXqhsDk',
      levels: [1],
      casting: true,
      pcgenLine: 72,
      foundryLine: 61,
      decision: `PCGen grants Oracle ~ Orisons at 1 with no Oracle_CF_ gate (${advancedPlayersGuideGlobals}:72) and defines no flag for it (:440-458), so no archetype flag removes it in PCGen; Foundry links Orisons at 1, the level Table: Oracle prints them (${oracleTableRow(1)}). They are 0-level spells of the class's casting, so they stay a casting row: touching it is a #422 review item.`,
    }),
    oracleRow({
      id: 'revelation',
      name: 'Revelation',
      key: 'adu4NROFqgwv70sw',
      levels: revelationLevels,
      // "Revelation" at 1st, 3rd and every four levels after
      // (oracle.html:359-377).
      incrementName: () => 'Revelation',
      // By class level, inside the mystery's level count
      // (apg_abilities_class.lst:480).
      parts: byLevel('Revelation', revelationLevels),
      increments: 'numbered',
      pcgenLine: null,
      foundryLine: 59,
      decision: `PCGen grants no revelation row: Oracle's Mystery counts the revelations into OracleMysteryLevel, one while Oracle_CF_Revelation1 is unset and one more at PRECLASS:1,Oracle=3, 7, 11, 15 and 19 while that level's flag is unset (${advancedPlayersGuideAbilities}:480), and each mystery's revelation pool is that count (battle, :517): named and gated by class level. PCGen gates the 19th on a flag it never defines (defect revelation-19-20). The class text gives a revelation at 1st, 3rd and every four levels after (${oracleTable}:422), as Table: Oracle prints (${citeRows({ tableRow: oracleTableRow, levels: revelationLevels })}) and Foundry links the 1st.`,
    }),
    oracleRow({
      id: 'spells',
      name: 'Oracle Spells',
      key: '72r8mMxzMNWpdt0D',
      levels: [1],
      whole: ['Spells'],
      casting: true,
      pcgenLine: null,
      foundryLine: 63,
      decision: describeCastingRow({ name: 'Oracle Spells', foundryLevel: 1 }),
    }),
    oracleRow({
      id: 'exchange-spell',
      name: 'Exchange Spell',
      key: 'dopWa3n4mgTGpTYi',
      levels: [4],
      whole: [],
      casting: true,
      pcgenLine: null,
      foundryLine: 65,
      decision: `${describeCastingRow({ name: 'Exchange Spell', foundryLevel: 4 })} The table has no row for it: the class text lets the oracle exchange a spell known at 4th and every even level after (${oracleTable}:410).`,
    }),
    oracleRow({
      id: 'final-revelation',
      name: 'Final Revelation',
      key: '8vF0UoXribL1DOG2',
      levels: [20],
      // Shigenjo's flag for its final revelation (defect revelation-19-20).
      whole: ['FinalRevelation', 'Revelation20'],
      pcgenLine: null,
      foundryLine: 67,
      decision: `PCGen grants no final revelation row: each mystery grants its own, <Mystery> Mystery ~ Final Revelation, at PRECLASS:1,Oracle=20 while Oracle_CF_FinalRevelation is unset (battle, ${advancedPlayersGuideAbilities}:517; the APG's ten mysteries, :517-535), a grant nested in the mystery record, which the flag removes. The class text gives the final revelation at 20th (${oracleTable}:423), as Table: Oracle prints (${oracleTableRow(20)}) and Foundry links it.`,
    }),
  ],
  nonRows: {
    // The mystery's own class skills (oracle.html:412), each mystery's
    // Internal grant kept while the flag is unset
    // (apg_abilities_class.lst:517).
    MysterySkills: classSkills,
  },
  grantNonRows: {},
  typeAliases: {},
  foundryNonRows: [],
  defects: [
    {
      id: 'revelation-19-20',
      suffixes: ['Revelation19', 'Revelation20'],
      text: `PCGen gates the 19th-level revelation on Oracle_CF_Revelation19 (${advancedPlayersGuideAbilities}:480) but never defines it: it defines and bridges Oracle_CF_Revelation20 instead (${advancedPlayersGuideGlobals}:447, :465), which gates nothing, so a flag for the 19th-level revelation removes nothing in PCGen. Shigenjo sets Revelation20 (${advancedRaceGuideAbilities}:1118) for its final revelation, which "replaces the final revelation of the shigenjo's mystery" (:757; advancedRaceGuide/featuredRaces/tengus.html:405), while PCGen keeps the mystery's final revelation, since it sets no Oracle_CF_FinalRevelation. The mapper maps Revelation19 to the 19th-level revelation row and Revelation20 by name to the final revelation; what an archetype replaces is read from its text.`,
    },
  ],
};

// --- Witch ------------------------------------------------------------------

const witchFile = classFile('witch.RC4D4WFT5kRKkdqp');
const witchRow = classRows({
  recordPrefix: 'Witch',
  grantFile: advancedPlayersGuideGlobals,
  foundryFile: witchFile,
});
/** The PRD's Table: Witch (APG p.66), whose 1st-level row is at :378. */
const witchTable = 'advancedPlayersGuide/baseClasses/witch.html';
const witchTableRow = makeTableRowCiter({ page: witchTable, firstRow: 378 });
const hexLevels = [1, ...evens];
const patronSpellLevels = evens.slice(0, -1);

const witch: ReviewedSchedule = {
  kind: 'reviewed',
  className: 'Witch',
  classKey: 'pf1/RC4D4WFT5kRKkdqp',
  // Foundry's pages (witch.RC4D4WFT5kRKkdqp.yaml:74).
  source: { book: apg, pages: '65–71' },
  printedTable: {
    status: 'reviewed',
    page: witchTable,
    firstRow: 378,
    caption: 'Witch',
    unprinted: {
      'patron-spells': `The class text, not the Special column, gives the patron at 1st and its spells at 2nd and every two levels after (${witchTable}:523).`,
      spells: `The Spells per Day columns give the witch's spells from 1st (${witchTableRow(1)}; ${witchTable}:408-411).`,
    },
  },
  foundryFile: witchFile,
  acquisitionRecords: ['Witch'],
  metadataRecords: ['Witch'],
  flagNamespace: 'Witch',
  slug: 'witch',
  classSkillsRecord: 'Witch ~ Class Skills',
  skillRanksPerLevel: 2,
  skillRanksAt: at(witchFile, 71),
  features: [
    witchRow({
      id: 'hex',
      name: 'Hex',
      key: 'GBkIhC1Bpp2MAD4e',
      levels: hexLevels,
      // "Hex" at 1st, 2nd and every two levels after (witch.html:378-397).
      incrementName: () => 'Hex',
      // Witch_CF_Hexes, which Witch_CF_Hex's bridge also reads
      // (apg_abilities_globalvar.lst:590; defect hexes-type).
      whole: ['Hex', 'Hexes'],
      // By class level: one hex pick while the flag is unset
      // (apg_abilities_class.lst:868-878).
      parts: byLevel('Hex', hexLevels),
      increments: 'numbered',
      pcgenLine: 553,
      foundryLine: 54,
      decision: `PCGen grants Witch ~ Hex once at 1 (${advancedPlayersGuideGlobals}:553) and adds one pick to the Witch Hex pool at each of WitchLVL 1, 2, 4 … 20 while Witch_CF_Hex<level> is unset (${advancedPlayersGuideAbilities}:868-878; defined ${advancedPlayersGuideGlobals}:565-575), WitchLVL the witch level (${advancedPlayersGuideClasses}:172): named and gated by class level. The class text gives a hex at 1st, 2nd and every two levels after (${witchTable}:415), as Table: Witch prints (${citeRows({ tableRow: witchTableRow, levels: hexLevels })}). The 10th- and 18th-level picks are hex rows; the major and grand hex are rows of their own (defect major-grand-hex).`,
    }),
    witchRow({
      id: 'witchs-familiar',
      name: 'Witch’s Familiar',
      key: '3d9Rgw40NV8ohRtf',
      levels: [1],
      // The default WitchsFamiliar names nothing; PCGen gates the grant on
      // Witch_CF_Familiar (apg_abilities_globalvar.lst:551).
      whole: ['Familiar'],
      casting: true,
      pcgenName: 'Familiar',
      pcgenLine: 551,
      foundryLine: 56,
      decision: `Familiars store every spell the witch knows, and she can prepare no spell her familiar doesn't store (${witchTable}:448), as the wizard's spellbook holds his spells: touching the familiar changes what the class's casting can prepare, so it is a casting row, and touching it is a #422 review item.`,
    }),
    witchRow({
      id: 'cantrips',
      name: 'Cantrips',
      key: 'IPy4aqFYbOppaqKC',
      levels: [1],
      casting: true,
      pcgenLine: 552,
      foundryLine: 58,
    }),
    witchRow({
      id: 'patron-spells',
      name: 'Patron Spells',
      key: '4k6uFSPDhObXgLqu',
      levels: [1],
      // Witch_CF_PatronSpell is defined and bridged and gates nothing
      // (defect patron-spell-flags).
      whole: ['PatronSpells', 'PatronSpell'],
      casting: true,
      pcgenLine: 554,
      foundryLine: 60,
      decision: `PCGen grants Witch ~ Patron Spells at 1 with no Witch_CF_ gate (${advancedPlayersGuideGlobals}:554), so no archetype flag removes it in PCGen; Foundry links Patron Spells at 1. The witch selects a patron at 1st, and it adds spells to her spells known at 2nd and every two levels after (${witchTable}:523): its spells are the class's casting, so it is a casting row, and each patron spell a casting change of it, no row of its own.`,
    }),
    witchRow({
      id: 'spells',
      name: 'Witch Spells',
      key: 'K0Ls0j080ptiPvTC',
      levels: [1],
      whole: ['Spells'],
      casting: true,
      pcgenLine: null,
      foundryLine: 62,
      decision: describeCastingRow({ name: 'Witch Spells', foundryLevel: 1 }),
    }),
    witchRow({
      id: 'major-hex',
      name: 'Major Hex',
      key: 'aZ5eCIRrsvax5CZZ',
      levels: [10],
      subfeatureOf: 'hex',
      pcgenLine: null,
      foundryLine: 64,
      decision: `PCGen grants no major hex row: Witch ~ Hex sets WitchMajorHexQualify to (WitchLVL>=10) (${advancedPlayersGuideAbilities}:853), which each major hex requires (:900-907), with no flag. The class text lets the witch choose a major hex whenever she could select a new hex from 10th on (${witchTable}:450), as Table: Witch prints "hex, major hex" at 10th (${witchTableRow(10)}) and Foundry links it: a row of its own beside the 10th-level hex, a subfeature of hex, so a whole removal or alteration of hex reaches it (defect major-grand-hex).`,
    }),
    witchRow({
      id: 'grand-hex',
      name: 'Grand Hex',
      key: 'IMhG1JjaWP6p9ORe',
      levels: [18],
      subfeatureOf: 'hex',
      pcgenLine: null,
      foundryLine: 66,
      decision: `PCGen grants no grand hex row: Witch ~ Hex sets WitchGrandHexQualify to (WitchLVL>=18) (${advancedPlayersGuideAbilities}:853), which each grand hex requires (:909-913), with no flag. The class text lets the witch choose a grand hex whenever she could select a new hex from 18th on (${witchTable}:468), as Table: Witch prints "hex, grand hex" at 18th (${witchTableRow(18)}) and Foundry links it: a row of its own beside the 18th-level hex, a subfeature of hex (defect major-grand-hex).`,
    }),
  ],
  nonRows: {
    ClassSkills: classSkills,
    // The patron, chosen with the patron spells: the Witch Patron pool
    // loses its pick while Witch_CF_Patron is set
    // (apg_abilities_class.lst:855).
    Patron: option('patron-spells'),
    FamiliarTouchSpells: notOnTable(
      `PCGen grants Witch ~ Familiar Touch Spells at 3 on its own flag (${advancedPlayersGuideGlobals}:555): the familiar's delivery of touch spells, as the wizard's arcane bond familiar's, which the witch's familiar functions like (${witchTable}:446). Table: Witch prints no row for it (${witchTableRow(3)}); what an archetype setting it replaces is read from its text.`,
    ),
    ...Object.fromEntries(
      patronSpellLevels.map((level, index): [string, ScheduleNonRow] => [
        `PatronSpell${level}`,
        {
          kind: 'casting',
          of: 'patron-spells',
          text: `Witch_CF_PatronSpell${level} names the patron's spell gained at ${ordinal(level)} level (${advancedPlayersGuideGlobals}:${577 + index}; ${witchTable}:523), which the table prints no row for (defect patron-spell-flags).`,
        },
      ]),
    ),
  },
  grantNonRows: {},
  typeAliases: {},
  foundryNonRows: [],
  defects: [
    {
      id: 'major-grand-hex',
      suffixes: ['Hex10', 'Hex18'],
      text: `The 10th- and 18th-level hexes are hex picks, kept while Witch_CF_Hex10 and Hex18 are unset (${advancedPlayersGuideAbilities}:873, :877); the major and grand hexes are only eligibility from those levels, (WitchLVL>=10) and (WitchLVL>=18) (:853), with no flag (${witchTable}:450, :468). The text can equate the two: Bouda's hyena shape "replaces the major hex granted at 10th level" (monsterCodex/gnolls.html:378), while PCGen sets Witch_CF_Hex10 for it (${monsterCodexAbilities}:151), the 10th-level hex. The mapper maps each flag to the hex row; whether an archetype also replaces the major or grand hex row is read from its text.`,
    },
    {
      id: 'patron-spell-flags',
      suffixes: [
        'PatronSpell',
        ...patronSpellLevels.map((level) => `PatronSpell${level}`),
      ],
      text: `PCGen defines and bridges Witch_CF_PatronSpell and PatronSpell2 to 18 (${advancedPlayersGuideGlobals}:564, :577-585, :592, :605-613), but the Advanced Player's Guide's patrons gate their spells on the old-style TYPE instead, !PREABILITY:1,CATEGORY=Archetype,TYPE.WitchPatronSpell<level> (Agility, ${advancedPlayersGuideAbilities}:947), so a FACT:Witch_CF_PatronSpell<level> removes none of their spells in PCGen; the whole flag gates nothing (Legacy of Dragons, ${legacyOfDragonsAbilities}:365), and the patron spells are granted with no flag (${advancedPlayersGuideGlobals}:554). The mapper maps the whole flag to the patron spells row and each spell to a casting change of it; what an archetype replaces is read from its text.`,
    },
    {
      id: 'hexes-type',
      suffixes: ['Hexes'],
      text: `FACT:Witch_CF_Hexes is bridged with Witch_CF_Hex (${advancedPlayersGuideGlobals}:590), but the old-style TYPE.WitchHexes writes Witch_CF_Hexes (:617), which PCGen never defines and nothing reads. The mapper maps the flag by name to the whole hex.`,
    },
  ],
};

/** The #771B schedules, by class name. */
export const mysteryHexSchedules = {
  Oracle: oracle,
  Witch: witch,
} as const satisfies Readonly<Record<string, ReviewedSchedule>>;
