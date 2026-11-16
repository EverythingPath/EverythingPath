import {
  abilityFile,
  at,
  buildPerDaySteps,
  buildPlusSteps,
  byLevel,
  classFile,
  citeRows,
  classRows,
  classSkills,
  evens,
  makeTableRowCiter,
  notOnTable,
  odds,
  option,
  ordinal,
  proficiency,
  scheduleSteps,
  type ReviewedSchedule,
  type Steps,
} from './schedule-model';

/**
 * #716 P7e: the reviewed schedules of the alchemy and talent classes,
 * Alchemist, Investigator, Slayer and Vigilante (research note 716-p7-rules
 * §1, §3; the model: `schedule-model.ts`).
 *
 * - A row is an entry of the table's Special column. Alchemy, the alchemist's
 *   and the investigator's extracts, is printed there and carries the
 *   class's casting (the Extracts per Day columns), so it is a `casting` row:
 *   touching it is a #422 review item.
 * - PCGen numbers the alchemist's discoveries and bomb dice, the
 *   investigator's talents, the slayer's talents and the vigilante's social
 *   and vigilante talents by class level, and both classes' poison
 *   resistance by value (`PoisonResistance4` is the +4 at 5th, note §2).
 *   The investigator's trap sense and studied strike, and the slayer's
 *   studied target, sneak attack and slayer's advance, are formula-held: the
 *   table alone gives their later rows.
 * - Poison immunity is a row of its own: Foundry links its own record, the
 *   table prints it apart from poison resistance, PCGen defines a flag for it
 *   (`<Class>_CF_PoisonImmunity`) that archetypes set beside the poison
 *   resistance flags (Clone Master, um_abilities_class.lst:2647), and the
 *   archetypes' text replaces it by name (“poison resistance +6 and poison
 *   immunity”, UM p.30).
 * - The PRD prints no vigilante (`prdClassExclusions['not-in-prd']`): its
 *   rows are pending table review, checked instead against PCGen's grants
 *   and part gates and Foundry's links and feature text.
 */

const advancedPlayersGuideAbilities =
  'roleplaying_game/advanced_players_guide/apg_abilities_class.lst';
const advancedPlayersGuideGlobals =
  'roleplaying_game/advanced_players_guide/apg_abilities_globalvar.lst';
const advancedClassGuideClasses =
  'roleplaying_game/advanced_class_guide/acg_classes.lst';
const advancedClassGuideAbilities =
  'roleplaying_game/advanced_class_guide/acg_abilities_class.lst';
const advancedClassGuideGlobals =
  'roleplaying_game/advanced_class_guide/acg_abilities_globalvar.lst';
const ultimateIntrigueAbilities =
  'roleplaying_game/ultimate_intrigue/ui_abilities_class.lst';

/** Poison resistance +2, +4 and +6 at 2nd, 5th and 8th (both classes). */
const poisonResistanceLevels = [2, 5, 8];
const poisonResistanceSteps = buildPlusSteps({
  name: 'Poison Resistance',
  levels: poisonResistanceLevels,
  first: 2,
  step: 2,
});
/** Named by value: `PoisonResistance<bonus>` is the row of that bonus (note §2). */
const poisonResistanceParts = {
  PoisonResistance2: 2,
  PoisonResistance4: 5,
  PoisonResistance6: 8,
};

// --- Alchemist --------------------------------------------------------------

const alchemistFile = classFile('alchemist.JcaqlAawhf14q1lq');
const alchemistRow = classRows({
  recordPrefix: 'Alchemist',
  grantFile: advancedPlayersGuideGlobals,
  foundryFile: alchemistFile,
});
/** The PRD's Table: Alchemist (APG p.27), whose 1st-level row is at :357. */
const alchemistTable = 'advancedPlayersGuide/baseClasses/alchemist.html';
const alchemistTableRow = makeTableRowCiter({
  page: alchemistTable,
  firstRow: 357,
});
const bombLevels = odds;
/** “Bomb 1d6” at 1st to “Bomb 10d6” at 19th. */
const bombSteps: Steps = bombLevels.map(
  (level, index) => [level, `Bomb ${index + 1}d6`] as const,
);
const discoveryLevels = evens.slice(0, -1);

const alchemist: ReviewedSchedule = {
  kind: 'reviewed',
  className: 'Alchemist',
  classKey: 'pf1/JcaqlAawhf14q1lq',
  source: { book: "Pathfinder RPG Advanced Player's Guide", pages: '26–31' },
  printedTable: {
    status: 'reviewed',
    page: alchemistTable,
    firstRow: 357,
    caption: 'Alchemist',
    unprinted: {},
  },
  foundryFile: alchemistFile,
  acquisitionRecords: ['Alchemist'],
  metadataRecords: ['Alchemist'],
  flagNamespace: 'Alchemist',
  slug: 'alchemist',
  classSkillsRecord: 'Alchemist ~ Class Skills',
  skillRanksPerLevel: 4,
  skillRanksAt: at(alchemistFile, 96),
  features: [
    alchemistRow({
      id: 'alchemy',
      name: 'Alchemy',
      key: '7GNdI4zKfTcxNCk4',
      levels: [1],
      casting: true,
      pcgenLine: 24,
      foundryLine: 62,
      decision: `Alchemy carries the alchemist's extracts, whose daily allotment the Extracts per Day columns give (${alchemistTable}:381, ${alchemistTableRow(1)}), so it stays a casting row: touching it is a #422 review item.`,
    }),
    alchemistRow({
      id: 'bomb',
      name: 'Bomb',
      key: '7gHiZBNHjwefbBLI',
      ...scheduleSteps({ steps: bombSteps }),
      // By class level (apg_abilities_class.lst:166-174).
      parts: byLevel('BombDamage', bombLevels.slice(1)),
      increments: 'numbered',
      pcgenLine: 25,
      foundryLine: 64,
      acquisitionFormula: abilityFile('bomb.7gHiZBNHjwefbBLI', 23),
      decision: `PCGen takes one die of bomb damage off for each Alchemist_CF_BombDamage<level>, gated at AlchemistBombLVL 3, 5 … 19 (${advancedPlayersGuideAbilities}:166-174): named and gated by class level. The class text adds 1d6 at every odd-numbered alchemist level (${alchemistTable}:391), as Table: Alchemist prints bomb 1d6 to 10d6 (${citeRows({ tableRow: alchemistTableRow, levels: bombLevels })}). Alchemist_CF_BombReduction lowers the die instead (a non-row, an alteration of bomb).`,
    }),
    alchemistRow({
      id: 'brew-potion',
      name: 'Brew Potion',
      key: 'afQ1oDc64797Cyq8',
      levels: [1],
      pcgenLine: 26,
      foundryLine: 66,
    }),
    alchemistRow({
      id: 'mutagen',
      name: 'Mutagen',
      key: 'zrTVb83VhkFnEv6G',
      levels: [1],
      pcgenLine: 27,
      foundryLine: 68,
      acquisitionFormula: abilityFile('mutagen.zrTVb83VhkFnEv6G', 18),
      decision: `The table prints mutagen at 1st only (${alchemistTableRow(1)}); its duration and DC scale with the class level in the class text (${alchemistTable}:395), which Foundry's Mutagen computes (mutagen.zrTVb83VhkFnEv6G.yaml:18, :23): one row. Persistent mutagen at 14th is its own row.`,
    }),
    alchemistRow({
      id: 'throw-anything',
      name: 'Throw Anything',
      key: 'jlvZK3xsfsDC358a',
      levels: [1],
      pcgenLine: 28,
      foundryLine: 70,
    }),
    alchemistRow({
      id: 'discovery',
      name: 'Discovery',
      key: 'Xcim6WFtAtxJxnmA',
      levels: discoveryLevels,
      // “Discovery” at 2nd and every 2 levels to 18th (alchemist.html:358-374).
      incrementName: () => 'Discovery',
      // By class level (apg_abilities_class.lst:156-164).
      parts: byLevel('Discovery', discoveryLevels),
      increments: 'numbered',
      pcgenLine: 29,
      foundryLine: 74,
      decision: `PCGen takes one discovery off the Alchemist Discovery pool for each Alchemist_CF_Discovery<level> (or old-style TYPE AlchemistDiscovery<level>), gated at AlchemistDiscoveryLVL 2, 4 … 18 (${advancedPlayersGuideAbilities}:156-164): named and gated by class level. The class text gives a discovery at 2nd and every 2 levels after, up to 18th (${alchemistTable}:399), as Table: Alchemist prints (${citeRows({ tableRow: alchemistTableRow, levels: discoveryLevels })}). The 2nd-level Discovery row is the first discovery, so Discovery2 replaces it; the 20th-level discoveries are grand discovery's.`,
    }),
    alchemistRow({
      id: 'poison-use',
      name: 'Poison Use',
      key: 'A54sLfcyoR5HGNbP',
      levels: [2],
      pcgenLine: 31,
      foundryLine: 72,
    }),
    alchemistRow({
      id: 'poison-resistance',
      name: 'Poison Resistance',
      key: '2qcz39w9O2Qlms0Q',
      ...scheduleSteps({ steps: poisonResistanceSteps }),
      parts: poisonResistanceParts,
      increments: 'numbered',
      pcgenLine: 30,
      foundryLine: 76,
      acquisitionFormula: abilityFile('poison-resistance.2qcz39w9O2Qlms0Q', 15),
      decision: `PCGen names each step of poison resistance by its bonus, Alchemist_CF_PoisonResistance2, 4 and 6, and gates each at AlchemistLVL 2, 5 and 8 (${advancedPlayersGuideAbilities}:95): by value, so PoisonResistance4 is the 5th-level row. The class text gives +2 at 2nd, +4 at 5th and +6 at 8th (${alchemistTable}:429), as Table: Alchemist prints (${citeRows({ tableRow: alchemistTableRow, levels: poisonResistanceLevels })}). The gates keep each step while its flag is set (defect poison-resistance-gates); the mapper maps the flags by name.`,
    }),
    alchemistRow({
      id: 'swift-alchemy',
      name: 'Swift Alchemy',
      key: 'WIoNDjnbzdHBkLJr',
      levels: [3],
      pcgenLine: 32,
      foundryLine: 78,
    }),
    alchemistRow({
      id: 'swift-poisoning',
      name: 'Swift Poisoning',
      key: 'FXjdFZlT0xiDr034',
      levels: [6],
      pcgenLine: 33,
      foundryLine: 80,
    }),
    alchemistRow({
      id: 'poison-immunity',
      name: 'Poison Immunity',
      key: 'tflIOhX6ukxtwXLx',
      levels: [10],
      pcgenLine: null,
      foundryLine: 82,
      decision: `PCGen grants no poison immunity row: Alchemist ~ Poison Resistance grants Immunity to Poison once its fourth step, at AlchemistLVL 10, is reached (${advancedPlayersGuideAbilities}:95), and its flag, Alchemist_CF_PoisonImmunity (${advancedPlayersGuideGlobals}:183), keeps that step when set instead of removing it (defect poison-resistance-gates). The class text gives immunity at 10th (${alchemistTable}:429), as Table: Alchemist prints (${alchemistTableRow(10)}) and Foundry links it: a row of its own, which an archetype replaces by name (Clone Master, “poison resistance +6 and poison immunity”).`,
    }),
    alchemistRow({
      id: 'persistent-mutagen',
      name: 'Persistent Mutagen',
      key: 'TeQgG1uEaWsMXBXX',
      levels: [14],
      pcgenLine: 34,
      foundryLine: 84,
    }),
    alchemistRow({
      id: 'instant-alchemy',
      name: 'Instant Alchemy',
      key: 'G7xqb0Ka8Bm9XAZz',
      levels: [18],
      pcgenLine: 35,
      foundryLine: 86,
    }),
    alchemistRow({
      id: 'grand-discovery',
      name: 'Grand Discovery',
      key: '1s0MIxdtmMD2403h',
      levels: [20],
      pcgenLine: 36,
      foundryLine: 88,
    }),
  ],
  nonRows: {
    ClassSkills: classSkills,
    Proficiencies: proficiency,
    BombReduction: notOnTable(
      `Alchemist_CF_BombReduction lowers the bombs' damage die from d6 to d4 (${advancedPlayersGuideAbilities}:73; ${advancedPlayersGuideGlobals}:194): no table row, but an alteration of bomb whose text reads as it replaces bomb (Clone Master, UM p.30).`,
    ),
  },
  grantNonRows: {},
  typeAliases: {},
  foundryNonRows: [],
  defects: [
    {
      id: 'poison-resistance-gates',
      suffixes: [...Object.keys(poisonResistanceParts), 'PoisonImmunity'],
      text: `PCGen adds each step of the alchemist's poison resistance, its immunity included, under PREMULT:1,[!PREABILITY:1,CATEGORY=Archetype,TYPE.AlchemistPoisonResistance<n>],[PREVAREQ:Alchemist_CF_PoisonResistance<n>,1] (${advancedPlayersGuideAbilities}:95): either branch keeps the step, so an archetype setting the flag keeps it, and only an old-style TYPE without the flag removes it. The investigator's same gates read ,0 (${advancedClassGuideAbilities}:1255-1258). The mapper maps each flag by its name to the row of that step.`,
    },
  ],
};

// --- Investigator -----------------------------------------------------------

const investigatorFile = classFile('investigator.s27zdYVFenYBVtfu');
const investigatorRow = classRows({
  recordPrefix: 'Investigator',
  grantFile: advancedClassGuideClasses,
  foundryFile: investigatorFile,
});
/** The PRD's Table: Investigator (ACG p.31), whose 1st-level row is at :378. */
const investigatorTable = 'advancedClassGuide/classes/investigator.html';
const investigatorTableRow = makeTableRowCiter({
  page: investigatorTable,
  firstRow: 378,
});
const investigatorTalentLevels = odds.slice(1);
const trapSenseLevels = [3, 6, 9, 12, 15, 18];
const studiedStrikeLevels = [4, 6, 8, 10, 12, 14, 16, 18, 20];

const investigator: ReviewedSchedule = {
  kind: 'reviewed',
  className: 'Investigator',
  classKey: 'pf1/s27zdYVFenYBVtfu',
  source: { book: 'Pathfinder RPG Advanced Class Guide', pages: '30–35' },
  printedTable: {
    status: 'reviewed',
    page: investigatorTable,
    firstRow: 378,
    caption: 'Investigator',
    unprinted: {},
  },
  foundryFile: investigatorFile,
  acquisitionRecords: ['Investigator'],
  metadataRecords: ['Investigator'],
  flagNamespace: 'Investigator',
  slug: 'investigator',
  classSkillsRecord: 'Investigator ~ Class Skills',
  skillRanksPerLevel: 6,
  skillRanksAt: at(investigatorFile, 110),
  features: [
    investigatorRow({
      id: 'alchemy',
      name: 'Alchemy',
      key: 'gotW1ETzGrrwVtk2',
      levels: [1],
      casting: true,
      pcgenLine: 183,
      foundryLine: 80,
      decision: `Alchemy carries the investigator's extracts, whose daily allotment the Extracts per Day columns give (${investigatorTable}:411-418, ${investigatorTableRow(1)}), so it stays a casting row: touching it is a #422 review item (Questioner and Psychic Detective replace it).`,
    }),
    investigatorRow({
      id: 'inspiration',
      name: 'Inspiration',
      key: 'nKbyztRQCU5XMbbs',
      levels: [1],
      pcgenLine: 184,
      foundryLine: 78,
    }),
    investigatorRow({
      id: 'trapfinding',
      name: 'Trapfinding',
      key: 'pEODJDoTk7uhCZY7',
      levels: [1],
      pcgenLine: 185,
      foundryLine: 82,
    }),
    investigatorRow({
      id: 'poison-lore',
      name: 'Poison Lore',
      key: 'C7UgLJt7yRHnAqyG',
      levels: [2],
      pcgenLine: 186,
      foundryLine: 84,
    }),
    investigatorRow({
      id: 'poison-resistance',
      name: 'Poison Resistance',
      key: '2qcz39w9O2Qlms0Q',
      ...scheduleSteps({ steps: poisonResistanceSteps }),
      parts: poisonResistanceParts,
      increments: 'numbered',
      pcgenLine: 187,
      foundryLine: 86,
      acquisitionFormula: abilityFile('poison-resistance.2qcz39w9O2Qlms0Q', 15),
      decision: `PCGen adds each step of poison resistance while Investigator_CF_PoisonResistance2, 4 or 6 is unset, at InvestigatorLVL 2, 5 and 8 (${advancedClassGuideAbilities}:1255-1257): kept gates, named by value, so PoisonResistance4 is the 5th-level row. The class text gives +2 at 2nd, +4 at 5th and +6 at 8th (${investigatorTable}:428), as Table: Investigator prints (${citeRows({ tableRow: investigatorTableRow, levels: poisonResistanceLevels })}).`,
    }),
    investigatorRow({
      id: 'investigator-talent',
      name: 'Investigator Talent',
      key: 'AOnFqb1h3gXbFUup',
      levels: investigatorTalentLevels,
      // “Investigator talent” at 3rd and every 2 levels after
      // (investigator.html:380-396).
      incrementName: () => 'Investigator Talent',
      whole: ['InvestigatorTalents'],
      // By class level, inside PREMULT (acg_abilities_class.lst:1260-1268).
      parts: byLevel('Talent', investigatorTalentLevels),
      increments: 'numbered',
      pcgenName: 'Investigator Talents',
      pcgenLine: 188,
      foundryLine: 88,
      decision: `PCGen takes one talent off for each Investigator_CF_Talent<level>, gated PREMULT:2,[PRECLASS:1,Investigator=<level>],[PREVAREQ:Investigator_CF_Talent<level>,1] at 3, 5 … 19 (${advancedClassGuideAbilities}:1260-1268): named and gated by class level. The class text gives a talent at 3rd and every 2 levels after (${investigatorTable}:430), as Table: Investigator prints (${citeRows({ tableRow: investigatorTableRow, levels: investigatorTalentLevels })}). The 3rd-level row is the first talent, so Talent3 replaces it.`,
    }),
    investigatorRow({
      id: 'keen-recollection',
      name: 'Keen Recollection',
      key: 'rJBdkI8mlJBNWcU2',
      levels: [3],
      pcgenLine: 189,
      foundryLine: 90,
    }),
    investigatorRow({
      id: 'trap-sense',
      name: 'Trap Sense',
      key: 'BoEkMviJrW0PKmhj',
      ...scheduleSteps({
        steps: buildPlusSteps({ name: 'Trap Sense', levels: trapSenseLevels }),
      }),
      pcgenLine: 190,
      foundryLine: 92,
      acquisitionFormula: abilityFile('trap-sense.BoEkMviJrW0PKmhj', 17),
      decision: `PCGen grants Investigator ~ Trap Sense once at 3 (${advancedClassGuideClasses}:190) and holds the bonus in a formula, InvestigatorLVL/3 (${advancedClassGuideAbilities}:1252), numbering none. The class text gives +1 at 3rd and +1 every 3 levels after, to +6 at 18th (${investigatorTable}:495), as Table: Investigator prints trap sense +1 to +6 (${citeRows({ tableRow: investigatorTableRow, levels: trapSenseLevels })}).`,
    }),
    investigatorRow({
      id: 'studied-combat',
      name: 'Studied Combat',
      key: 'nVwveeNV71Bg7YnY',
      levels: [4],
      pcgenLine: 192,
      foundryLine: 94,
    }),
    investigatorRow({
      id: 'studied-strike',
      name: 'Studied Strike',
      key: '3WsfpUeW7oe4GOuh',
      ...scheduleSteps({
        steps: buildPlusSteps({
          name: 'Studied Strike',
          levels: studiedStrikeLevels,
          unit: 'd6',
        }),
      }),
      pcgenLine: 193,
      foundryLine: 96,
      acquisitionFormula: abilityFile('studied-strike.3WsfpUeW7oe4GOuh', 17),
      decision: `PCGen grants Investigator ~ Studied Strike once at 4 (${advancedClassGuideClasses}:193) and holds its dice in a formula, min(9,(InvestigatorLVL-2)/2) (${advancedClassGuideAbilities}:1249), numbering none. The class text gives 1d6 at 4th and 1d6 more every 2 levels after, to 9d6 at 20th (${investigatorTable}:500), as Table: Investigator prints studied strike +1d6 to +9d6 (${citeRows({ tableRow: investigatorTableRow, levels: studiedStrikeLevels })}).`,
    }),
    investigatorRow({
      id: 'swift-alchemy',
      name: 'Swift Alchemy',
      key: 'kEVqxs23oyNDxbc1',
      levels: [4],
      pcgenLine: 191,
      foundryLine: 98,
    }),
    investigatorRow({
      id: 'poison-immunity',
      name: 'Poison Immunity',
      key: 'tflIOhX6ukxtwXLx',
      levels: [11],
      pcgenLine: null,
      foundryLine: 100,
      decision: `PCGen grants no poison immunity row: Investigator ~ Poison Resistance grants Immunity to Poison once its fourth step is reached (${advancedClassGuideAbilities}:1247), which PCGen adds at InvestigatorLVL 10 while Investigator_CF_PoisonImmunity is unset (:1258), copying the alchemist's level. The class text gives immunity at 11th (${investigatorTable}:428), as Table: Investigator prints (${investigatorTableRow(11)}) and Foundry links it: a row of its own at 11.`,
    }),
    investigatorRow({
      id: 'true-inspiration',
      name: 'True Inspiration',
      key: 'H2Iac6ELVKBU6Ayu',
      levels: [20],
      pcgenLine: 194,
      foundryLine: 102,
    }),
  ],
  nonRows: {
    ClassSkills: classSkills,
    Proficiencies: proficiency,
    WeaponProficiencies: proficiency,
    ArmorProficiencies: proficiency,
  },
  grantNonRows: {
    // acg_classes.lst:182, granted with no gate; its own gates read the
    // undefined flags (defect undefined-flags).
    'Investigator ~ Weapon and Armor Proficiency': proficiency,
  },
  typeAliases: {},
  foundryNonRows: [],
  defects: [
    {
      id: 'undefined-flags',
      suffixes: ['ClassSkills', 'WeaponProficiencies', 'ArmorProficiencies'],
      text: `PCGen never defines Investigator_CF_ClassSkills, WeaponProficiencies or ArmorProficiencies (${advancedClassGuideGlobals}:347-373), though archetypes set them (Steel Hound, ${advancedClassGuideAbilities}:4652). ClassSkills is set from its FACT (${advancedClassGuideGlobals}:382) and gates the class skills (:344); the two proficiency FACTs set Investigator_CF_Proficiencies instead (:394-395), which gates nothing, while the proficiency record gates its weapons and armor on the undefined names (${advancedClassGuideAbilities}:1240), so they remove no proficiency in PCGen. The mapper maps each by its name: class skills to the class skill list, proficiencies to prose.`,
    },
  ],
};

// --- Slayer -----------------------------------------------------------------

const slayerFile = classFile('slayer.cOY76lMUkupH534m');
const slayerRow = classRows({
  recordPrefix: 'Slayer',
  grantFile: advancedClassGuideClasses,
  foundryFile: slayerFile,
});
/** The PRD's Table: Slayer (ACG p.54), whose 1st-level row is at :370. */
const slayerTable = 'advancedClassGuide/classes/slayer.html';
const slayerTableRow = makeTableRowCiter({ page: slayerTable, firstRow: 370 });
const studiedTargetLevels = [1, 5, 10, 15, 20];
/** “1st studied target” at 1st to “5th studied target” at 20th. */
const studiedTargetSteps: Steps = studiedTargetLevels.map(
  (level, index) => [level, `${ordinal(index + 1)} Studied Target`] as const,
);
const sneakAttackLevels = [3, 6, 9, 12, 15, 18];
const slayersAdvanceLevels = [13, 17];

const slayer: ReviewedSchedule = {
  kind: 'reviewed',
  className: 'Slayer',
  classKey: 'pf1/cOY76lMUkupH534m',
  source: { book: 'Pathfinder RPG Advanced Class Guide', pages: '53–55' },
  printedTable: {
    status: 'reviewed',
    page: slayerTable,
    firstRow: 370,
    caption: 'Slayer',
    unprinted: {},
  },
  foundryFile: slayerFile,
  acquisitionRecords: ['Slayer'],
  metadataRecords: ['Slayer'],
  flagNamespace: 'Slayer',
  slug: 'slayer',
  classSkillsRecord: 'Slayer ~ Class Skills',
  skillRanksPerLevel: 6,
  skillRanksAt: at(slayerFile, 81),
  features: [
    slayerRow({
      id: 'studied-target',
      name: 'Studied Target',
      key: 'JnXrphJlr1ULx1MK',
      ...scheduleSteps({ steps: studiedTargetSteps }),
      pcgenLine: 333,
      foundryLine: 54,
      acquisitionFormula: abilityFile('studied-target.JnXrphJlr1ULx1MK', 21),
      decision: `PCGen grants Slayer ~ Studied Target once at 1 (${advancedClassGuideClasses}:333) and holds the bonus in a formula, SlayerStudiedTargetLVL/5+1 (${advancedClassGuideAbilities}:1798), numbering none. The class text raises the bonus and the targets maintained by 1 at 5th, 10th, 15th and 20th (${slayerTable}:405), as Table: Slayer prints 1st to 5th studied target (${citeRows({ tableRow: slayerTableRow, levels: studiedTargetLevels })}).`,
    }),
    slayerRow({
      id: 'track',
      name: 'Track',
      key: 'r8wPs0bB3WhOLxbX',
      levels: [1],
      pcgenLine: 334,
      foundryLine: 56,
    }),
    slayerRow({
      id: 'slayer-talent',
      name: 'Slayer Talents',
      key: 'Zn9ecDCXShBK4vj8',
      levels: evens,
      // “Slayer talent” at 2nd and every 2 levels after (slayer.html:371-389).
      incrementName: () => 'Slayer Talent',
      whole: ['Talents', 'SlayerTalents'],
      // By class level (acg_abilities_class.lst:1819-1828).
      parts: byLevel('Talent', evens),
      increments: 'numbered',
      pcgenLine: 335,
      foundryLine: 58,
      decision: `PCGen takes one talent off for each Slayer_CF_Talent<level>, gated at SlayerTalentLVL 2, 4 … 20 (${advancedClassGuideAbilities}:1819-1828): named and gated by class level. The class text gives a talent at 2nd and every 2 levels after (${slayerTable}:410), as Table: Slayer prints (${citeRows({ tableRow: slayerTableRow, levels: evens })}). The 2nd-level row is the first talent, so Talent2 replaces it; from 10th a talent may be an advanced talent, which is advanced talents' row.`,
    }),
    slayerRow({
      id: 'sneak-attack',
      name: 'Sneak Attack',
      key: 'Wl3FUflcmvQP0PaQ',
      ...scheduleSteps({
        steps: buildPlusSteps({
          name: 'Sneak Attack',
          levels: sneakAttackLevels,
          unit: 'd6',
        }),
      }),
      pcgenLine: 336,
      foundryLine: 60,
      acquisitionFormula: abilityFile('sneak-attack-sla.Wl3FUflcmvQP0PaQ', 16),
      decision: `PCGen grants Slayer ~ Sneak Attack once at 3 (${advancedClassGuideClasses}:336) and holds the dice in a formula, SlayerSneakAttackLVL/3 (${advancedClassGuideAbilities}:1801), numbering none. The class text gives 1d6 at 3rd and 1d6 more every 3 levels after (${slayerTable}:427), as Table: Slayer prints sneak attack +1d6 to +6d6 (${citeRows({ tableRow: slayerTableRow, levels: sneakAttackLevels })}).`,
    }),
    slayerRow({
      id: 'stalker',
      name: 'Stalker',
      key: '0oO5lfLEq2ggvGHg',
      levels: [7],
      pcgenLine: 337,
      foundryLine: 62,
    }),
    slayerRow({
      id: 'advanced-talents',
      name: 'Advanced Talents',
      key: 'aNTZXUUBQlh5VDTv',
      levels: [10],
      pcgenLine: null,
      foundryLine: 64,
      decision: `PCGen grants no advanced talents row: its advanced slayer talents are talents of the Slayer Talent pool, each requiring a level (${advancedClassGuideAbilities}:1802). The class text lets a slayer take an advanced talent in place of a slayer talent from 10th (${slayerTable}:433), as Table: Slayer prints (${slayerTableRow(10)}) and Foundry links it.`,
    }),
    slayerRow({
      id: 'swift-tracker',
      name: 'Swift Tracker',
      key: 'sk0HNTe9lKBpHQpN',
      levels: [11],
      pcgenLine: 338,
      foundryLine: 66,
    }),
    slayerRow({
      id: 'slayers-advance',
      name: 'Slayer’s Advance',
      key: 'yotHT522pQoKDhID',
      ...scheduleSteps({
        steps: buildPerDaySteps({
          name: 'Slayer’s Advance',
          levels: slayersAdvanceLevels,
        }),
      }),
      whole: ['SlayersAdvance'],
      pcgenLine: 339,
      foundryLine: 68,
      acquisitionFormula: abilityFile('slayer-s-advance.yotHT522pQoKDhID', 32),
      decision: `PCGen grants Slayer ~ Slayer's Advance once at 13 (${advancedClassGuideClasses}:339) and holds the uses in a formula, 1+(SlayerLVL>16) (${advancedClassGuideAbilities}:1797), numbering none. The class text gives it once a day at 13th and twice at 17th (${slayerTable}:445), as Table: Slayer prints slayer's advance 1/day and 2/day (${citeRows({ tableRow: slayerTableRow, levels: slayersAdvanceLevels })}).`,
    }),
    slayerRow({
      id: 'quarry',
      name: 'Quarry',
      key: '5NS7Ec3WhKIkhygg',
      levels: [14],
      pcgenLine: 340,
      foundryLine: 70,
    }),
    slayerRow({
      id: 'improved-quarry',
      name: 'Improved Quarry',
      key: 'oRac7XDHBN0JzuyY',
      levels: [19],
      pcgenLine: 341,
      foundryLine: 72,
    }),
    slayerRow({
      id: 'master-slayer',
      name: 'Master Slayer',
      key: 'znkQ87s5WAKHaUVu',
      levels: [20],
      pcgenLine: 342,
      foundryLine: 74,
    }),
  ],
  nonRows: {
    ClassSkills: classSkills,
    WeaponProficiencies: proficiency,
    ArmorProficiencies: proficiency,
    LightArmorProficiency: proficiency,
    MediumArmorProficiency: proficiency,
    ShieldProficiency: proficiency,
  },
  grantNonRows: {
    // acg_classes.lst:332, granted with no gate.
    'Slayer ~ Weapon and Armor Proficiency': proficiency,
  },
  typeAliases: {},
  foundryNonRows: [],
  defects: [],
};

// --- Vigilante --------------------------------------------------------------

const vigilanteFile = classFile('vigilante.Yf5Wv9X09SUHYCqM');
const vigilanteRow = classRows({
  recordPrefix: 'Vigilante',
  grantFile: ultimateIntrigueAbilities,
  foundryFile: vigilanteFile,
});
/** No table: the PRD prints no vigilante (`prdClassExclusions['not-in-prd']`). */
const pendingTableReview =
  'Pending table review: the PRD prints no vigilante table (prdClassExclusions, not-in-prd).';

const vigilante: ReviewedSchedule = {
  kind: 'reviewed',
  className: 'Vigilante',
  classKey: 'pf1/Yf5Wv9X09SUHYCqM',
  source: { book: 'Pathfinder RPG Ultimate Intrigue', pages: '8–23' },
  printedTable: { status: 'pendingTableReview', exclusion: 'not-in-prd' },
  foundryFile: vigilanteFile,
  acquisitionRecords: ['Vigilante'],
  metadataRecords: ['Vigilante'],
  flagNamespace: 'Vigilante',
  slug: 'vigilante',
  classSkillsRecord: 'Vigilante ~ Class Skills',
  skillRanksPerLevel: 6,
  skillRanksAt: at(vigilanteFile, 120),
  features: [
    vigilanteRow({
      id: 'dual-identity',
      name: 'Dual Identity',
      key: 'caHXpWVlJLxRKvOS',
      levels: [1],
      pcgenLine: 10,
      foundryLine: 95,
    }),
    vigilanteRow({
      id: 'seamless-guise',
      name: 'Seamless Guise',
      key: 'TMpfSlpC7To6uXGE',
      levels: [1],
      pcgenLine: 11,
      foundryLine: 97,
    }),
    vigilanteRow({
      id: 'social-talent',
      name: 'Social Talent',
      key: '2uDIHsepFL6PRyRj',
      levels: odds,
      incrementName: () => 'Social Talent',
      // By class level (ui_abilities_class.lst:1185-1194).
      parts: byLevel('SocialTalent', odds),
      increments: 'numbered',
      pcgenLine: 12,
      foundryLine: 99,
      decision: `PCGen takes one social talent off for each Vigilante_CF_SocialTalent<level>, gated at VigilanteLVL 1, 3 … 19 (${ultimateIntrigueAbilities}:1185-1194): named and gated by class level. Foundry's Social Talent gives one at 1st and every 2 levels after (social-talent.2uDIHsepFL6PRyRj.yaml:13). The 1st-level row is the first social talent, so SocialTalent1 replaces it. ${pendingTableReview}`,
    }),
    vigilanteRow({
      id: 'vigilante-specialization',
      name: 'Vigilante Specialization',
      key: 'vTE94sQboMmdAakT',
      levels: [1],
      pcgenLine: 13,
      foundryLine: 101,
      decision: `Foundry's Vigilante Specialization has the vigilante choose avenger or stalker at 1st (vigilante-specialization.vTE94sQboMmdAakT.yaml:14), and PCGen grants it once at 1 (${ultimateIntrigueAbilities}:13), each specialization behind its own flag (Avenger, Stalker; :1181-1182): one row, its specializations options of it. The stalker's hidden strike dice, 1d8 more at 3rd and every 2 levels after (vigilante-specialization.vTE94sQboMmdAakT.yaml:23), are the specialization's own rules. ${pendingTableReview}`,
    }),
    vigilanteRow({
      id: 'vigilante-talent',
      name: 'Vigilante Talent',
      key: 'o4FeJzhEdocIO4mY',
      levels: evens,
      incrementName: () => 'Vigilante Talent',
      // By class level (ui_abilities_class.lst:1196-1205).
      parts: byLevel('VigilanteTalent', evens),
      increments: 'numbered',
      pcgenLine: 14,
      foundryLine: 103,
      decision: `PCGen takes one vigilante talent off for each Vigilante_CF_VigilanteTalent<level>, gated at VigilanteLVL 2, 4 … 20 (${ultimateIntrigueAbilities}:1196-1205): named and gated by class level. Foundry's Vigilante Talent gives one at 2nd and every 2 levels after (vigilante-talent.o4FeJzhEdocIO4mY.yaml:13). The 2nd-level row is the first vigilante talent, so VigilanteTalent2 replaces it. ${pendingTableReview}`,
    }),
    vigilanteRow({
      id: 'unshakable',
      name: 'Unshakable',
      key: '4U69gg3altKZvFHD',
      levels: [3],
      pcgenLine: 15,
      foundryLine: 105,
    }),
    vigilanteRow({
      id: 'startling-appearance',
      name: 'Startling Appearance',
      key: 'qCl2cw0leReIXuRn',
      levels: [5],
      pcgenLine: 16,
      foundryLine: 107,
    }),
    vigilanteRow({
      id: 'frightening-appearance',
      name: 'Frightening Appearance',
      key: '2tq8HQ4ZQpiL3njr',
      levels: [11],
      pcgenLine: 17,
      foundryLine: 109,
    }),
    vigilanteRow({
      id: 'stunning-appearance',
      name: 'Stunning Appearance',
      key: 'fCaw2ldaQlkktvsB',
      levels: [17],
      pcgenLine: 18,
      foundryLine: 111,
    }),
    vigilanteRow({
      id: 'vengeance-strike',
      name: 'Vengeance Strike',
      key: 'xrruZUG1zqIHe35h',
      levels: [20],
      pcgenLine: 19,
      foundryLine: 113,
    }),
  ],
  nonRows: {
    ClassSkills: classSkills,
    WeaponProficiencies: proficiency,
    ArmorProficiencies: proficiency,
    ShieldProficiency: proficiency,
    // The two specializations (vigilante-specialization.vTE94sQboMmdAakT.yaml:14;
    // ui_abilities_class.lst:1181-1182).
    Avenger: option('vigilante-specialization'),
    Stalker: option('vigilante-specialization'),
    FortSaves: notOnTable(
      `Vigilante_CF_FortSaves marks a change to the vigilante's Fortitude save progression (${ultimateIntrigueAbilities}:1207), a column of the class table, not a feature row.`,
    ),
    ReflexSaves: notOnTable(
      `Vigilante_CF_ReflexSaves marks a change to the vigilante's Reflex save progression (${ultimateIntrigueAbilities}:1208), a column of the class table, not a feature row.`,
    ),
    WillSaves: notOnTable(
      `Vigilante_CF_WillSaves marks a change to the vigilante's Will save progression (${ultimateIntrigueAbilities}:1209), a column of the class table, not a feature row.`,
    ),
  },
  grantNonRows: {
    // ui_abilities_class.lst:9, granted with no gate.
    'Vigilante ~ Weapon and Armor Proficiencies': proficiency,
  },
  typeAliases: {},
  foundryNonRows: [],
  defects: [],
};

/** The P7e schedules, by class name. */
export const alchemyTalentSchedules = {
  Alchemist: alchemist,
  Investigator: investigator,
  Slayer: slayer,
  Vigilante: vigilante,
} as const satisfies Readonly<Record<string, ReviewedSchedule>>;
