import {
  abilityFile,
  at,
  byLevel,
  byOrder,
  classFile,
  classRows,
  classSkills,
  evens,
  makeTableRowCiter,
  makeUnchainedRowBuilder,
  notOnTable,
  odds,
  proficiency,
  scheduleSteps,
  type ReviewedSchedule,
} from './schedule-model';

/**
 * #716 P7b: the reviewed schedules of the ki, flurry and talent classes,
 * Monk, Monk (Unchained), Brawler, Ninja and Rogue (Unchained) (research note
 * 716-p7-rules §1, §3, §6; the model: `schedule-model.ts`).
 *
 * - A row is an entry of the table's Special column, or a step of a value
 *   the table prints in a column of its own (`printedTable.columns`): the
 *   monks' unarmed damage, AC bonus and fast movement, and the standard
 *   monk's flurry attacks; the Unchained monk's flurry steps in the Special
 *   column. The feature's acquisition is its Special column entry; the AC
 *   bonus's, which the Special column never prints, is cited as
 *   `unprinted`.
 * - PCGen numbers the monks' bonus feats, ki powers and the CRB ki pool and
 *   slow fall, the brawler's bonus combat feats, ninja tricks and the
 *   Unchained rogue's finesse training and talents; every other repeating
 *   feature is formula-held, and the table alone gives its later rows.
 * - Monk (Unchained) and Rogue (Unchained) are their own schedules
 *   (`unchained-monk`, `unchained-rogue`, the seeds' identities): their own
 *   records' grants and the shared `Monk_CF_`/`Rogue_CF_` flags. Original
 *   rogue archetypes reach the Unchained rogue by name and level at runtime,
 *   and original monk archetypes warn separately
 *   (docs/character-sheet/unchained-classes.md:12).
 */

const coreRulebookClassAbilities =
  'roleplaying_game/core_rulebook/cr_abilities_class.lst';
const coreRulebookGlobals =
  'roleplaying_game/core_rulebook/cr_abilities_globalvar.lst';
const unchainedClassAbilities =
  'roleplaying_game/pathfinder_unchained/pu_abilities_class.lst';

/**
 * The monks' steps their table prints in columns of their own, the same in
 * Table: Monk (coreRulebook/classes/monk.html:356-376) and the Unchained
 * Monk table (unchained/classes/monk.html:370-394).
 */
const unarmedDamage = [
  [1, 'Unarmed Strike'],
  [4, 'Unarmed Strike (1d8)'],
  [8, 'Unarmed Strike (1d10)'],
  [12, 'Unarmed Strike (2d6)'],
  [16, 'Unarmed Strike (2d8)'],
  [20, 'Unarmed Strike (2d10)'],
] as const;
const acBonus = [
  [1, 'AC Bonus'],
  [4, 'AC Bonus +1'],
  [8, 'AC Bonus +2'],
  [12, 'AC Bonus +3'],
  [16, 'AC Bonus +4'],
  [20, 'AC Bonus +5'],
] as const;
const fastMovement = [
  [3, 'Fast Movement'],
  [6, 'Fast Movement +20 ft.'],
  [9, 'Fast Movement +30 ft.'],
  [12, 'Fast Movement +40 ft.'],
  [15, 'Fast Movement +50 ft.'],
  [18, 'Fast Movement +60 ft.'],
] as const;

// --- Monk -------------------------------------------------------------------

const monkFile = classFile('monk.W8dxwZ1CZiwLKsqr');
const monkRow = classRows({
  recordPrefix: 'Monk',
  grantFile: coreRulebookClassAbilities,
  foundryFile: monkFile,
});
/** The PRD's Table: Monk (CRB p.57), whose 1st-level row is at :357. */
const monkTable = 'coreRulebook/classes/monk.html';
const monkTableRow = makeTableRowCiter({ page: monkTable, firstRow: 357 });
const monkBonusFeats = [1, 2, 6, 10, 14, 18];
/** Ki pool's rows, each with its ki strike (monk.html:360, :363, :366, :372, :408). */
const kiPool = [
  [4, 'Ki Pool (magic)'],
  [7, 'Ki Pool (cold iron/silver)'],
  [10, 'Ki Pool (lawful)'],
  [16, 'Ki Pool (adamantine)'],
] as const;
const slowFallLevels = [4, 6, 8, 10, 12, 14, 16, 18, 20];
/** The flurry's extra attacks: one at 1st, two at 8th, three at 15th (monk.html:385-387). */
const flurry = [
  [1, 'Flurry of Blows'],
  [8, 'Flurry of Blows (Improved Two-Weapon Fighting)'],
  [15, 'Flurry of Blows (Greater Two-Weapon Fighting)'],
] as const;

const monk: ReviewedSchedule = {
  kind: 'reviewed',
  className: 'Monk',
  classKey: 'pf1/W8dxwZ1CZiwLKsqr',
  source: { book: 'Pathfinder RPG Core Rulebook', pages: '56–60' },
  printedTable: {
    status: 'reviewed',
    page: monkTable,
    firstRow: 357,
    caption: 'Monk',
    unprinted: {
      'ac-bonus': `The table prints the AC bonus in its AC Bonus column (${monkTable}:356), +0 at 1st (${monkTableRow(1)}); the class text gives the feature at 1st (${monkTable}:383).`,
    },
    columns: {
      flurry: {
        column: 'Flurry of Blows Attack Bonus',
        reading: 'extraAttacks',
        text: `The Flurry of Blows Attack Bonus column (${monkTable}:356) prints the attacks of a base attack bonus equal to the monk level (${monkTable}:385) and one more, two from 8th and three from 15th (${monkTableRow(8)}, ${monkTableRow(15)}; :386-387).`,
      },
      'unarmed-strike': {
        column: 'Unarmed Damage',
        reading: 'value',
        text: `The Unarmed Damage column (${monkTable}:356) prints 1d6 at 1st and a step at 4th and every 4 levels after (${monkTableRow(4)}-376; :392).`,
      },
      'ac-bonus': {
        column: 'AC Bonus',
        reading: 'value',
        text: `The AC Bonus column (${monkTable}:356) prints +1 at 4th and 1 more every 4 levels after, to +5 at 20th (${monkTableRow(4)}-376; :383).`,
      },
      'fast-movement': {
        column: 'Fast Movement',
        reading: 'value',
        text: `The Fast Movement column (${monkTable}:356) prints +10 ft. at 3rd and 10 feet more every 3 levels after, to +60 ft. at 18th (${monkTableRow(3)}-376; :405).`,
      },
    },
  },
  foundryFile: monkFile,
  acquisitionRecords: ['Monk ~ Standard Class'],
  metadataRecords: ['Monk', 'Monk ~ Standard Class', 'Monk ~ Unchained Class'],
  flagNamespace: 'Monk',
  slug: 'monk',
  classSkillsRecord: 'Class Skills ~ Monk',
  skillRanksPerLevel: 4,
  skillRanksAt: at(monkFile, 102),
  features: [
    monkRow({
      id: 'bonus-feat',
      name: 'Bonus Feat',
      key: 'VjHjPja5QABBgRvR',
      levels: monkBonusFeats,
      incrementName: () => 'Bonus Feat',
      whole: ['BonusFeats'],
      parts: byLevel('BonusFeat', monkBonusFeats),
      increments: 'numbered',
      pcgenName: 'Monk Bonus Feat',
      pcgenLine: 173,
      foundryLine: 49,
      acquisitionFormula: abilityFile('bonus-feat-mnk.VjHjPja5QABBgRvR', 14),
      decision: `PCGen names Monk_CF_BonusFeat1, 2, 6, 10, 14 and 18 by the level of the feat and gates each on the count of feats so far (MonkBonusFeatCount 1 to 6, ${coreRulebookClassAbilities}:1210, :1212-1217): 1st, 2nd and every 4 levels after, as Table: Monk gives them (${monkTableRow(1)}, ${monkTableRow(2)}, ${monkTableRow(6)}, ${monkTableRow(10)}, ${monkTableRow(14)}, ${monkTableRow(18)}).`,
    }),
    monkRow({
      id: 'flurry',
      name: 'Flurry of Blows',
      key: 'JKJoHy5NveXGaZqv',
      ...scheduleSteps({ steps: flurry }),
      pcgenLine: 172,
      foundryLine: 51,
      decision: `PCGen grants Monk ~ Flurry of Blows once at 1 (${coreRulebookClassAbilities}:172) and holds the extra attacks in formulas (:1137-1151), numbering none; Foundry's Flurry of Blows computes nothing from the level (flurry-of-blows.JKJoHy5NveXGaZqv.yaml). Table: Monk prints flurry of blows in the Special column at 1st (${monkTableRow(1)}) and its attacks in the Flurry of Blows Attack Bonus column (${monkTable}:356): beyond those of a base attack bonus equal to the monk level (:385), one more at 1st, two from 8th and three from 15th (${monkTableRow(8)}, ${monkTableRow(15)}), the class text's Improved and Greater Two-Weapon Fighting (:386-387). Rows read at 1, 8 and 15.`,
    }),
    monkRow({
      id: 'stunning-fist',
      name: 'Stunning Fist',
      key: '2ausI8g6SsmbOpgF',
      levels: [1],
      pcgenLine: 175,
      foundryLine: 53,
    }),
    monkRow({
      id: 'unarmed-strike',
      name: 'Unarmed Strike',
      key: 'a4SPdPuOFdmfJdHN',
      ...scheduleSteps({ steps: unarmedDamage }),
      pcgenLine: 171,
      foundryLine: 55,
      decision: `PCGen grants Monk ~ Unarmed Strike once at 1 (${coreRulebookClassAbilities}:171), which grants Monk ~ Unarmed Damage (:1118); that record picks the damage by min(5,MonkUnarmedDamageLVL/4), numbering none (:1280). Foundry's Unarmed Strike computes nothing from the level (unarmed-strike.a4SPdPuOFdmfJdHN.yaml:12-15). Table: Monk prints unarmed strike in the Special column at 1st (${monkTableRow(1)}) and its damage in the Unarmed Damage column (${monkTable}:356; :392): 1d6 at 1st, 1d8 at 4th, 1d10 at 8th, 2d6 at 12th, 2d8 at 16th and 2d10 at 20th (${monkTableRow(4)}, ${monkTableRow(8)}, ${monkTableRow(12)}, ${monkTableRow(16)}, ${monkTableRow(20)}). Rows read at 1, 4, 8, 12, 16 and 20.`,
    }),
    monkRow({
      id: 'ac-bonus',
      name: 'AC Bonus',
      key: '4zVndIJ8NMWWzl1T',
      ...scheduleSteps({ steps: acBonus }),
      pcgenLine: 174,
      foundryLine: 57,
      acquisitionFormula: abilityFile('ac-bonus-mnk.4zVndIJ8NMWWzl1T', 18),
      decision: `PCGen grants Monk ~ AC Bonus once at 1 (${coreRulebookClassAbilities}:174) and holds the +1 per 4 levels in the Monk AC Tracker, min((MonkACLVL)/4,5), numbering none (:1090); Foundry's AC Bonus computes it from the level (ac-bonus-mnk.4zVndIJ8NMWWzl1T.yaml:15-18). The class text gives the feature at 1st and +1 at 4th, increasing every 4 levels to +5 at 20th (${monkTable}:383), as the AC Bonus column prints (${monkTable}:356; ${monkTableRow(4)}, ${monkTableRow(8)}, ${monkTableRow(12)}, ${monkTableRow(16)}, ${monkTableRow(20)}). Rows read at 1, 4, 8, 12, 16 and 20.`,
    }),
    monkRow({
      id: 'evasion',
      name: 'Evasion',
      key: 'KQYCRLEdD4bGA5ak',
      levels: [2],
      pcgenLine: 176,
      foundryLine: 59,
    }),
    monkRow({
      id: 'fast-movement',
      name: 'Fast Movement',
      key: 'CK5L0YJDENqBxLqv',
      ...scheduleSteps({ steps: fastMovement }),
      pcgenLine: 177,
      foundryLine: 61,
      acquisitionFormula: abilityFile('fast-movement-mnk.CK5L0YJDENqBxLqv', 15),
      decision: `PCGen grants Monk ~ Fast Movement once at 3 (${coreRulebookClassAbilities}:177) and holds the bonus in a formula, 10*floor(MonkFastMovementLVL/3), numbering none (:1098); Foundry's Fast Movement computes it from the level (fast-movement-mnk.CK5L0YJDENqBxLqv.yaml:15). Table: Monk prints fast movement in the Special column at 3rd (${monkTableRow(3)}) and the bonus in the Fast Movement column (${monkTable}:356; :405): +10 ft. at 3rd, then 10 feet more at 6th, 9th, 12th, 15th and 18th (${monkTableRow(6)}, ${monkTableRow(9)}, ${monkTableRow(12)}, ${monkTableRow(15)}, ${monkTableRow(18)}). Rows read at 3, 6, 9, 12, 15 and 18.`,
    }),
    monkRow({
      id: 'maneuver-training',
      name: 'Maneuver Training',
      key: 'E7enBZN7FCsoyIof',
      levels: [3],
      pcgenLine: 178,
      foundryLine: 63,
    }),
    monkRow({
      id: 'still-mind',
      name: 'Still Mind',
      key: '8VUae7CIgCidvSfg',
      levels: [3],
      pcgenLine: 179,
      foundryLine: 65,
    }),
    monkRow({
      id: 'ki-pool',
      name: 'Ki Pool',
      key: '2Og23i3rRXu5QQlg',
      ...scheduleSteps({ steps: kiPool }),
      parts: {
        // Each step of ki strike, added while kept
        // (cr_abilities_class.lst:1195-1198).
        KiPoolAbilities1: 4,
        KiPoolAbilities7: 7,
        KiPoolAbilities10: 10,
        KiPoolAbilities16: 16,
      },
      increments: 'numbered',
      pcgenLine: 180,
      foundryLine: 67,
      decision: `PCGen adds each ki strike step while Monk_CF_KiPoolAbilities1, 7, 10 and 16 is unset (${coreRulebookClassAbilities}:1195-1198): 7, 10 and 16 by the level of the step, 1 the magic step the pool brings at 4th. Table: Monk prints ki pool (magic), (cold iron/silver), (lawful) and (adamantine) at 4, 7, 10 and 16 (${monkTableRow(4)}, ${monkTableRow(7)}, ${monkTableRow(10)}, ${monkTableRow(16)}), so KiPoolAbilities1 is the 4th-level row.`,
    }),
    monkRow({
      id: 'slow-fall',
      name: 'Slow Fall',
      key: 'M4bXVPXouXroIt90',
      levels: slowFallLevels,
      // "Slow fall 20 ft." at 4th to "90 ft." at 18th, "any distance" at
      // 20th (monk.html:360-376).
      incrementName: (index) =>
        index === 8
          ? 'Slow Fall any distance'
          : `Slow Fall ${(index + 2) * 10} ft.`,
      parts: {
        // By value: the 10 feet each variable removes
        // (cr_abilities_class.lst:1121-1129), at the row whose distance it
        // completes.
        SlowFall10: 4,
        SlowFall20: 4,
        SlowFall30: 6,
        SlowFall40: 8,
        SlowFall50: 10,
        SlowFall60: 12,
        SlowFall70: 14,
        SlowFall80: 16,
        SlowFall90: 18,
      },
      increments: 'numbered',
      pcgenLine: 181,
      foundryLine: 69,
      decision: `PCGen counts slow fall in feet: each Monk_CF_SlowFall<N> takes 10 feet off (SlowFallLVL −2, SlowFall = floor(SlowFallLVL/2)×10), gated from monk level N/5 (${coreRulebookClassAbilities}:1103, :1121-1129), so SlowFall10 is gated at 2nd, before the feature. Table: Monk first prints slow fall 20 ft. at 4th, then 10 feet more every 2 levels to 90 ft. at 18th and any distance at 20th (${monkTableRow(4)}-376). Read by value: SlowFall10 and SlowFall20 are the 4th-level row, SlowFall<N> for N ≥ 30 the row printing N ft. (level N/5); no variable names the 20th-level row.`,
    }),
    monkRow({
      id: 'high-jump',
      name: 'High Jump',
      key: 'WJEF9WHs27kaFYJL',
      levels: [5],
      pcgenLine: 182,
      foundryLine: 71,
    }),
    monkRow({
      id: 'purity-of-body',
      name: 'Purity of Body',
      key: '82G7gl4C1AvtSHI4',
      levels: [5],
      pcgenLine: 183,
      foundryLine: 73,
    }),
    monkRow({
      id: 'wholeness-of-body',
      name: 'Wholeness of Body',
      key: 'ZPrMO00Iz2SfrNMq',
      levels: [7],
      pcgenLine: 184,
      foundryLine: 75,
    }),
    monkRow({
      id: 'improved-evasion',
      name: 'Improved Evasion',
      key: 'Cc2eFfhJYlClCGEH',
      levels: [9],
      pcgenLine: 185,
      foundryLine: 77,
    }),
    monkRow({
      id: 'diamond-body',
      name: 'Diamond Body',
      key: 'nRffrQSKTqjeBAO5',
      levels: [11],
      pcgenLine: 186,
      foundryLine: 79,
    }),
    monkRow({
      id: 'abundant-step',
      name: 'Abundant Step',
      key: 'XJtvco1XWggmr5LU',
      levels: [12],
      pcgenLine: 187,
      foundryLine: 81,
    }),
    monkRow({
      id: 'diamond-soul',
      name: 'Diamond Soul',
      key: 'bCdFkzKiVg52ufhu',
      levels: [13],
      pcgenLine: 188,
      foundryLine: 83,
    }),
    monkRow({
      id: 'quivering-palm',
      name: 'Quivering Palm',
      key: 'n4SWyKVcdmZK4t7d',
      levels: [15],
      pcgenLine: 189,
      foundryLine: 85,
    }),
    monkRow({
      id: 'timeless-body',
      name: 'Timeless Body',
      key: '5JlthJkVGEHPZypG',
      levels: [17],
      pcgenLine: 191,
      foundryLine: 87,
    }),
    monkRow({
      id: 'tongue-of-the-sun-and-moon',
      name: 'Tongue of the Sun and Moon',
      key: 'NKzRm45051DUHkd5',
      levels: [17],
      pcgenLine: 190,
      foundryLine: 89,
    }),
    monkRow({
      id: 'empty-body',
      name: 'Empty Body',
      key: 'dtnkUkinLVIl1b2T',
      levels: [19],
      pcgenLine: 192,
      foundryLine: 91,
    }),
    monkRow({
      id: 'perfect-self',
      name: 'Perfect Self',
      key: 'NNEU7hzPSu2LTyZv',
      levels: [20],
      pcgenLine: 193,
      foundryLine: 93,
    }),
  ],
  nonRows: {
    ClassSkills: classSkills,
    Proficiencies: proficiency,
    WeaponProficiencies: proficiency,
    Alignment: notOnTable(
      `The monk's alignment ("Any lawful", ${monkTable}:349) is class text, not a table row; Monk_CF_Alignment (${coreRulebookGlobals}:543) lifts it.`,
    ),
  },
  grantNonRows: {},
  typeAliases: {},
  foundryNonRows: [],
  defects: [
    {
      id: 'bonus-feat-14',
      suffixes: ['BonusFeat14'],
      text: `PCGen gates the 14th-level bonus feat on Monk_CF_BonusFeat14 (${coreRulebookClassAbilities}:1216), which it never defines or bridges (${coreRulebookGlobals}:538-542, :577-581 hold 1, 2, 6, 10 and 18): Table: Monk gives a bonus feat at 14th (${monkTableRow(14)}). The mapper maps the variable by its name.`,
    },
  ],
};

// --- Monk (Unchained) ---------------------------------------------------------

const unchainedMonkFile = classFile('monk-unchained.5mQIOIw4hDhlREPo');
const unchainedMonkRow = makeUnchainedRowBuilder(
  classRows({
    recordPrefix: 'Unchained Monk',
    grantFile: unchainedClassAbilities,
    foundryFile: unchainedMonkFile,
  }),
);
/** The PRD's Unchained Monk table (Pathfinder Unchained p.15), whose 1st-level row is at :375. */
const unchainedMonkTable = 'unchained/classes/monk.html';
const unchainedMonkTableRow = makeTableRowCiter({
  page: unchainedMonkTable,
  firstRow: 375,
});
const kiPowers = evens.slice(1);
/** Style strike's rows (monk.html:379, :383, :387, :389, :391; :482). */
const styleStrike = [
  [5, 'Style Strike (1/round)'],
  [9, 'Style Strike'],
  [13, 'Style Strike'],
  [15, 'Style Strike (2/round)'],
  [17, 'Style Strike'],
] as const;
/** Ki pool's row, then each ki strike step it gives (monk.html:377, :381, :384, :390, :441). */
const unchainedKiPool = [
  [3, 'Ki Pool'],
  [7, 'Ki Strike (cold iron/silver)'],
  [10, 'Ki Strike (lawful)'],
  [16, 'Ki Strike (adamantine)'],
] as const;

const unchainedMonk: ReviewedSchedule = {
  kind: 'reviewed',
  className: 'Monk (Unchained)',
  classKey: 'pf1/5mQIOIw4hDhlREPo',
  source: { book: 'Pathfinder Unchained', pages: '14–19' },
  printedTable: {
    status: 'reviewed',
    page: unchainedMonkTable,
    firstRow: 375,
    caption: 'Unchained Monk',
    unprinted: {
      'ac-bonus': `The table prints the AC bonus in its AC Bonus column (${unchainedMonkTable}:370), +0 at 1st (${unchainedMonkTableRow(1)}); the class text gives the feature at 1st (${unchainedMonkTable}:406).`,
    },
    columns: {
      'unarmed-strike': {
        column: 'Unarmed Damage',
        reading: 'value',
        text: `The Unarmed Damage column (${unchainedMonkTable}:369) prints 1d6 at 1st and a step at 4th and every 4 levels after (${unchainedMonkTableRow(4)}-394; :418).`,
      },
      'ac-bonus': {
        column: 'AC Bonus',
        reading: 'value',
        text: `The AC Bonus column (${unchainedMonkTable}:370) prints +1 at 4th and 1 more every 4 levels after, to +5 at 20th (${unchainedMonkTableRow(4)}-394; :406).`,
      },
      'fast-movement': {
        column: 'Fast Movement',
        reading: 'value',
        text: `The Fast Movement column (${unchainedMonkTable}:371) prints +10 ft. at 3rd and 10 feet more every 3 levels after, to +60 ft. at 18th (${unchainedMonkTableRow(3)}-394; :439).`,
      },
    },
    alsoPrinted: {
      'ki-pool': [
        {
          level: 3,
          entry: 'ki strike (magic)',
          text: `The 3rd-level row prints ki pool and ki strike (magic) (${unchainedMonkTableRow(3)}); the ki pool gives the ki strike (${unchainedMonkTable}:441), and Foundry's Ki Pool (UC) holds both (ki-pool-uc.7BfYNNkYjjBevun8.yaml:21-27).`,
        },
      ],
    },
  },
  foundryFile: unchainedMonkFile,
  acquisitionRecords: ['Monk ~ Unchained Class'],
  metadataRecords: ['Monk', 'Monk ~ Standard Class', 'Monk ~ Unchained Class'],
  flagNamespace: 'Monk',
  slug: 'unchained-monk',
  classSkillsRecord: 'Class Skills ~ Unchained Monk',
  skillRanksPerLevel: 4,
  skillRanksAt: at(unchainedMonkFile, 93),
  features: [
    unchainedMonkRow({
      id: 'flurry',
      name: 'Flurry of Blows',
      key: 'TaBxJdJQp5SFDPyn',
      levels: [1, 11],
      // "Flurry of blows (bonus attack)" at 1st and 11th (monk.html:375, :385).
      incrementName: () => 'Flurry of Blows (bonus attack) (UC)',
      pcgenLine: 157,
      foundryLine: 54,
      decision: `PCGen grants Unchained Monk ~ Flurry of Blows once at 1 (${unchainedClassAbilities}:157) and counts its attacks from the base attack bonus in formulas (:492-495), numbering none; the class text gives a bonus attack at 1st and another at 11th (${unchainedMonkTable}:411-412), and the Unchained Monk table prints flurry of blows (bonus attack) at 1st and 11th (${unchainedMonkTableRow(1)}, ${unchainedMonkTableRow(11)}). Rows read at 1 and 11.`,
    }),
    unchainedMonkRow({
      id: 'unarmed-strike',
      name: 'Unarmed Strike',
      key: 'a4SPdPuOFdmfJdHN',
      ...scheduleSteps({ steps: unarmedDamage, suffix: ' (UC)' }),
      pcgenLine: 159,
      foundryLine: 56,
      decision: `PCGen grants Unchained Monk ~ Unarmed Strike once at 1 (${unchainedClassAbilities}:159), which grants the CRB's Monk ~ Unarmed Damage (:464), numbering no step (cr_abilities_class.lst:1280); Foundry links the CRB monk's Unarmed Strike, which computes nothing from the level (unarmed-strike.a4SPdPuOFdmfJdHN.yaml:12-15). The Unchained Monk table prints unarmed strike in the Special column at 1st (${unchainedMonkTableRow(1)}) and its damage in the Unarmed Damage column (${unchainedMonkTable}:369; :418): 1d6 at 1st, 1d8 at 4th, 1d10 at 8th, 2d6 at 12th, 2d8 at 16th and 2d10 at 20th (${unchainedMonkTableRow(4)}, ${unchainedMonkTableRow(8)}, ${unchainedMonkTableRow(12)}, ${unchainedMonkTableRow(16)}, ${unchainedMonkTableRow(20)}). Rows read at 1, 4, 8, 12, 16 and 20.`,
    }),
    unchainedMonkRow({
      id: 'ac-bonus',
      name: 'AC Bonus',
      key: '4zVndIJ8NMWWzl1T',
      ...scheduleSteps({ steps: acBonus, suffix: ' (UC)' }),
      pcgenLine: 155,
      foundryLine: 58,
      acquisitionFormula: abilityFile('ac-bonus-mnk.4zVndIJ8NMWWzl1T', 18),
      decision: `PCGen grants Unchained Monk ~ AC Bonus once at 1 (${unchainedClassAbilities}:155) with the CRB's Monk AC Tracker (:460), numbering none; Foundry links the CRB monk's AC Bonus, which computes it from the level (ac-bonus-mnk.4zVndIJ8NMWWzl1T.yaml:15-18). The class text gives the feature at 1st and +1 at 4th, increasing every 4 levels to +5 at 20th (${unchainedMonkTable}:406), as the AC Bonus column prints (${unchainedMonkTable}:370; ${unchainedMonkTableRow(4)}, ${unchainedMonkTableRow(8)}, ${unchainedMonkTableRow(12)}, ${unchainedMonkTableRow(16)}, ${unchainedMonkTableRow(20)}). Rows read at 1, 4, 8, 12, 16 and 20.`,
    }),
    unchainedMonkRow({
      id: 'stunning-fist',
      name: 'Stunning Fist',
      key: '2ausI8g6SsmbOpgF',
      levels: [1],
      pcgenLine: 158,
      foundryLine: 60,
    }),
    unchainedMonkRow({
      id: 'bonus-feat',
      name: 'Bonus Feat',
      key: 'VjHjPja5QABBgRvR',
      levels: monkBonusFeats,
      incrementName: () => 'Bonus Feat (UC)',
      // Its own flag, and the CRB's the Unchained archetypes set
      // (defect below).
      whole: ['BonusFeat', 'BonusFeats'],
      parts: byLevel('BonusFeat', monkBonusFeats),
      pcgenLine: 156,
      foundryLine: 62,
      acquisitionFormula: abilityFile('bonus-feat-mnk.VjHjPja5QABBgRvR', 14),
      decision: `PCGen gates Unchained Monk ~ Bonus Feat on Monk_CF_BonusFeat (${unchainedClassAbilities}:156) and holds its feats in one pool, 1+max((MonkBonusFeatLVL+2)/4,0) (:461), numbering none of them for the Unchained version. The class text gives a bonus feat at 1st, 2nd and every 4 levels after (${unchainedMonkTable}:409), as the Unchained Monk table prints (${unchainedMonkTableRow(1)}, ${unchainedMonkTableRow(2)}, ${unchainedMonkTableRow(6)}, ${unchainedMonkTableRow(10)}, ${unchainedMonkTableRow(14)}, ${unchainedMonkTableRow(18)}). The CRB's Monk_CF_BonusFeat<level> names map by name to these rows.`,
    }),
    unchainedMonkRow({
      id: 'evasion',
      name: 'Evasion',
      key: 'KQYCRLEdD4bGA5ak',
      levels: [2],
      pcgenLine: 160,
      foundryLine: 64,
    }),
    unchainedMonkRow({
      id: 'fast-movement',
      name: 'Fast Movement',
      key: 'CK5L0YJDENqBxLqv',
      ...scheduleSteps({ steps: fastMovement, suffix: ' (UC)' }),
      pcgenLine: 161,
      foundryLine: 66,
      acquisitionFormula: abilityFile('fast-movement-mnk.CK5L0YJDENqBxLqv', 15),
      decision: `PCGen grants Unchained Monk ~ Fast Movement once at 3 (${unchainedClassAbilities}:161) and holds the bonus in a formula, 10*floor(MonkFastMovementLVL/3), numbering none (:466); Foundry links the CRB monk's Fast Movement, which computes it from the level (fast-movement-mnk.CK5L0YJDENqBxLqv.yaml:15). The Unchained Monk table prints fast movement in the Special column at 3rd (${unchainedMonkTableRow(3)}) and the bonus in the Fast Movement column (${unchainedMonkTable}:371; :439): +10 ft. at 3rd, then 10 feet more at 6th, 9th, 12th, 15th and 18th (${unchainedMonkTableRow(6)}, ${unchainedMonkTableRow(9)}, ${unchainedMonkTableRow(12)}, ${unchainedMonkTableRow(15)}, ${unchainedMonkTableRow(18)}). Rows read at 3, 6, 9, 12, 15 and 18.`,
    }),
    unchainedMonkRow({
      id: 'ki-pool',
      name: 'Ki Pool',
      key: '7BfYNNkYjjBevun8',
      ...scheduleSteps({ steps: unchainedKiPool, suffix: ' (UC)' }),
      pcgenLine: 162,
      foundryLine: 68,
      decision: `PCGen grants Unchained Monk ~ Ki Pool once at 3 (${unchainedClassAbilities}:162) and numbers no ki strike step for it (the kept Monk_CF_KiPoolAbilities parts are the CRB ki pool's, cr_abilities_class.lst:1195-1198). The pool gives ki strike, magic at 3rd, cold iron and silver at 7th, lawful at 10th and adamantine at 16th (${unchainedMonkTable}:441), as the Unchained Monk table prints (${unchainedMonkTableRow(3)}, ${unchainedMonkTableRow(7)}, ${unchainedMonkTableRow(10)}, ${unchainedMonkTableRow(16)}). Rows read at 3, 7, 10 and 16.`,
    }),
    unchainedMonkRow({
      id: 'ki-powers',
      name: 'Ki Powers',
      key: 'NsP31IshAuY4gv0s',
      levels: kiPowers,
      // "Ki power" at 4th and every 2 levels after (monk.html:378-394).
      incrementName: () => 'Ki Power (UC)',
      parts: byLevel('KiPowers', kiPowers),
      increments: 'numbered',
      pcgenLine: 163,
      foundryLine: 70,
    }),
    unchainedMonkRow({
      id: 'still-mind',
      name: 'Still Mind',
      key: 'TTn7hey3SfqaTsLr',
      levels: [4],
      pcgenLine: 164,
      foundryLine: 72,
    }),
    unchainedMonkRow({
      id: 'purity-of-body',
      name: 'Purity of Body',
      key: '82G7gl4C1AvtSHI4',
      levels: [5],
      pcgenLine: 165,
      foundryLine: 74,
    }),
    unchainedMonkRow({
      id: 'style-strike',
      name: 'Style Strike',
      key: '0eJ9MA8iVuOG8VJi',
      ...scheduleSteps({ steps: styleStrike, suffix: ' (UC)' }),
      pcgenLine: 166,
      foundryLine: 76,
      decision: `PCGen grants Unchained Monk ~ Style Strike once at 5 (${unchainedClassAbilities}:166) and holds the strikes known in a pool, (MonkLVL-1)/4 (:471), numbering none. The class text gives a style strike at 5th and another at 9th and every 4 levels after, and two strikes per flurry at 15th (${unchainedMonkTable}:482), as the Unchained Monk table prints (${unchainedMonkTableRow(5)}, ${unchainedMonkTableRow(9)}, ${unchainedMonkTableRow(13)}, ${unchainedMonkTableRow(15)}, ${unchainedMonkTableRow(17)}). Rows read at 5, 9, 13, 15 and 17.`,
    }),
    unchainedMonkRow({
      id: 'improved-evasion',
      name: 'Improved Evasion',
      key: 'Cc2eFfhJYlClCGEH',
      levels: [9],
      pcgenLine: 167,
      foundryLine: 78,
    }),
    unchainedMonkRow({
      id: 'tongue-of-the-sun-and-moon',
      name: 'Tongue of the Sun and Moon',
      key: 'TX1sNG0DXRxr9Tlx',
      levels: [13],
      pcgenLine: 168,
      foundryLine: 80,
    }),
    unchainedMonkRow({
      id: 'timeless-body',
      name: 'Timeless Body',
      key: '5JlthJkVGEHPZypG',
      levels: [17],
      pcgenLine: 169,
      foundryLine: 82,
    }),
    unchainedMonkRow({
      id: 'flawless-mind',
      name: 'Flawless Mind',
      key: 'TXGAg84E7T6MFA8v',
      levels: [19],
      pcgenLine: 170,
      foundryLine: 84,
    }),
    unchainedMonkRow({
      id: 'perfect-self',
      name: 'Perfect Self',
      key: 'hp7tP0bRAj8eNqN9',
      levels: [20],
      pcgenLine: 171,
      foundryLine: 86,
    }),
  ],
  nonRows: {
    ClassSkills: classSkills,
    WeaponandArmorProficiency: proficiency,
    Proficiencies: proficiency,
    WeaponProficiencies: proficiency,
  },
  grantNonRows: {},
  typeAliases: {},
  foundryNonRows: [],
  defects: [
    {
      id: 'unchained-bonus-feat-flags',
      suffixes: [
        'BonusFeats',
        ...monkBonusFeats.map((level) => `BonusFeat${level}`),
      ],
      text: `PCGen gates the unchained monk's bonus feats on Monk_CF_BonusFeat (${unchainedClassAbilities}:156) and numbers none (its pool, :461, has no part lines). Monk_CF_BonusFeats and Monk_CF_BonusFeat1, 2, 6, 10 and 18 gate the CRB monk's records only (${coreRulebookClassAbilities}:173, :1212-1217), and BonusFeat14 is never defined (${coreRulebookGlobals}:538-542), yet the Unchained monk archetypes set them (Sage Counselor, ultimate_intrigue/support/ui_abilities_class_pu.lst:16; Invested Regent, heroes_of_the_high_court/support/hothc_abilities_class_pu.lst:3): in PCGen they remove nothing. The mapper maps each by its name to the unchained monk's bonus feats.`,
    },
  ],
};

// --- Brawler ----------------------------------------------------------------

const advancedClassGuideClasses =
  'roleplaying_game/advanced_class_guide/acg_classes.lst';
const advancedClassGuideGlobals =
  'roleplaying_game/advanced_class_guide/acg_abilities_globalvar.lst';
const brawlerFile = classFile('brawler.iDlGMIezGuqqt8Us');
const brawlerRow = classRows({
  recordPrefix: 'Brawler',
  grantFile: advancedClassGuideClasses,
  foundryFile: brawlerFile,
});
/** The PRD's Brawler table (ACG p.24), whose 1st-level row is at :371. */
const brawlerTable = 'advancedClassGuide/classes/brawler.html';
const brawlerTableRow = makeTableRowCiter({
  page: brawlerTable,
  firstRow: 371,
});
const brawlerBonusFeats = [2, 5, 8, 11, 14, 17, 20];
const maneuverTraining = [3, 7, 11, 15, 19];
const brawlerAcBonus = [4, 9, 13, 18];
const knockout = [4, 10, 16];
/** Martial flexibility's action at each row (brawler.html:406-412). */
const martialFlexibility = [
  [1, 'Martial Flexibility'],
  [6, 'Martial Flexibility (swift action)'],
  [10, 'Martial Flexibility (free action)'],
  [12, 'Martial Flexibility (immediate action)'],
  [20, 'Martial Flexibility (any number)'],
] as const;
/** The feat brawler's flurry acts as at each row (brawler.html:442). */
const brawlersFlurry = [
  [2, 'Brawler’s Flurry (Two-Weapon Fighting)'],
  [8, 'Brawler’s Flurry (Improved Two-Weapon Fighting)'],
  [15, 'Brawler’s Flurry (Greater Two-Weapon Fighting)'],
] as const;
/** What brawler's strike overcomes at each row (brawler.html:454). */
const brawlersStrike = [
  [5, 'Brawler’s Strike (magic)'],
  [9, 'Brawler’s Strike (cold iron and silver)'],
  [12, 'Brawler’s Strike (alignment)'],
  [17, 'Brawler’s Strike (adamantine)'],
] as const;
/** A brawler decision: PCGen grants `name` once, at `line`, and `text` gives the table's later rows. */
const describeFormulaHeld = ({
  name,
  line,
  text,
}: {
  name: string;
  line: number;
  text: string;
}) =>
  `PCGen grants Brawler ~ ${name} once (${advancedClassGuideClasses}:${line}) and numbers no later step; ${text}`;

const brawler: ReviewedSchedule = {
  kind: 'reviewed',
  className: 'Brawler',
  classKey: 'pf1/iDlGMIezGuqqt8Us',
  source: { book: 'Pathfinder RPG Advanced Class Guide', pages: '23–25' },
  printedTable: {
    status: 'reviewed',
    page: brawlerTable,
    firstRow: 371,
    caption: 'Brawler',
    unprinted: {},
  },
  foundryFile: brawlerFile,
  acquisitionRecords: ['Brawler'],
  metadataRecords: ['Brawler'],
  flagNamespace: 'Brawler',
  slug: 'brawler',
  classSkillsRecord: 'Brawler ~ Class Skills',
  skillRanksPerLevel: 4,
  skillRanksAt: at(brawlerFile, 78),
  features: [
    brawlerRow({
      id: 'brawlers-cunning',
      name: 'Brawler’s Cunning',
      key: '6wtTc1PRWBKZuF9D',
      levels: [1],
      pcgenLine: 92,
      foundryLine: 47,
    }),
    brawlerRow({
      id: 'martial-flexibility',
      name: 'Martial Flexibility',
      key: 'sOwXPOtI5IlEBKwr',
      ...scheduleSteps({ steps: martialFlexibility }),
      pcgenLine: 93,
      foundryLine: 49,
      decision: describeFormulaHeld({
        name: 'Martial Flexibility',
        line: 93,
        text: `the class text improves it at 6th, 10th, 12th and 20th (${brawlerTable}:409-412), as the Brawler table prints martial flexibility (swift action), (free action), (immediate action) and (any number) (${brawlerTableRow(6)}, ${brawlerTableRow(10)}, ${brawlerTableRow(12)}, ${brawlerTableRow(20)}). Rows read at 1, 6, 10, 12 and 20.`,
      }),
    }),
    brawlerRow({
      id: 'martial-training',
      name: 'Martial Training',
      key: 'agVFqf3mfxf0l8oT',
      levels: [1],
      pcgenLine: 94,
      foundryLine: 51,
    }),
    brawlerRow({
      id: 'unarmed-strike',
      name: 'Unarmed Strike',
      key: 'dlrAyDyBF8ldtpH8',
      levels: [1],
      pcgenLine: null,
      foundryLine: 53,
      decision: `PCGen grants no unarmed strike row: the Brawler record grants Improved Unarmed Strike and the Internal Brawler ~ Unarmed Damage tracker on Brawler_CF_UnarmedStrike at no level (${advancedClassGuideGlobals}:170). The class text gives unarmed strike at 1st (${brawlerTable}:416), as the Brawler table prints (${brawlerTableRow(1)}) and Foundry links it.`,
    }),
    brawlerRow({
      id: 'bonus-feats',
      name: 'Bonus Combat Feats',
      key: 'o8AEIzEXMjEZ2EX1',
      levels: brawlerBonusFeats,
      // "Bonus combat feat" at 2nd and every 3 levels after
      // (brawler.html:372-390).
      incrementName: () => 'Bonus Combat Feat',
      whole: ['BonusFeats'],
      parts: byLevel('BonusFeat', brawlerBonusFeats),
      increments: 'numbered',
      pcgenName: 'Bonus Feats',
      pcgenLine: 95,
      foundryLine: 55,
      acquisitionFormula: abilityFile(
        'bonus-combat-feats-bra.o8AEIzEXMjEZ2EX1',
        13,
      ),
    }),
    brawlerRow({
      id: 'brawlers-flurry',
      name: 'Brawler’s Flurry',
      key: 'UwcsrKHgN6mEo8Bd',
      ...scheduleSteps({ steps: brawlersFlurry }),
      pcgenLine: 96,
      foundryLine: 57,
      decision: describeFormulaHeld({
        name: 'Brawler’s Flurry',
        line: 96,
        text: `it counts the attacks from the brawler level (acg_abilities_class.lst:908-911). The class text gives Two-Weapon Fighting at 2nd, Improved Two-Weapon Fighting at 8th and Greater Two-Weapon Fighting at 15th (${brawlerTable}:442), as the Brawler table prints (${brawlerTableRow(2)}, ${brawlerTableRow(8)}, ${brawlerTableRow(15)}). Rows read at 2, 8 and 15.`,
      }),
    }),
    brawlerRow({
      id: 'maneuver-training',
      name: 'Maneuver Training',
      key: 'n1PlbzPfZGklyUVV',
      levels: maneuverTraining,
      incrementName: (index) => `Maneuver Training ${index + 1}`,
      pcgenLine: 97,
      foundryLine: 59,
      decision: describeFormulaHeld({
        name: 'Maneuver Training',
        line: 97,
        text: `the class text gives a maneuver at 3rd and every 4 levels after (${brawlerTable}:446), as the Brawler table prints maneuver training 1 to 5 (${brawlerTableRow(3)}, ${brawlerTableRow(7)}, ${brawlerTableRow(11)}, ${brawlerTableRow(15)}, ${brawlerTableRow(19)}). Rows read at 3, 7, 11, 15 and 19.`,
      }),
    }),
    brawlerRow({
      id: 'ac-bonus',
      name: 'AC Bonus',
      key: 'Z53orCz6KeTS5LOb',
      levels: brawlerAcBonus,
      incrementName: (index) => `AC Bonus +${index + 1}`,
      pcgenLine: 98,
      foundryLine: 61,
      acquisitionFormula: abilityFile('ac-bonus-bra.Z53orCz6KeTS5LOb', 16),
      decision: describeFormulaHeld({
        name: 'AC Bonus',
        line: 98,
        text: `the class text gives +1 at 4th, increasing by 1 at 9th, 13th and 18th (${brawlerTable}:449), as the Brawler table prints AC bonus +1 to +4 (${brawlerTableRow(4)}, ${brawlerTableRow(9)}, ${brawlerTableRow(13)}, ${brawlerTableRow(18)}). Rows read at 4, 9, 13 and 18.`,
      }),
    }),
    brawlerRow({
      id: 'knockout',
      name: 'Knockout',
      key: 'SQXP7EIAIH22DM39',
      levels: knockout,
      incrementName: (index) => `Knockout ${index + 1}/day`,
      pcgenLine: 99,
      foundryLine: 63,
      acquisitionFormula: abilityFile('knockout.SQXP7EIAIH22DM39', 51),
      decision: describeFormulaHeld({
        name: 'Knockout',
        line: 99,
        text: `the class text gives one use a day at 4th, two at 10th and three at 16th (${brawlerTable}:452), as the Brawler table prints knockout 1/day to 3/day (${brawlerTableRow(4)}, ${brawlerTableRow(10)}, ${brawlerTableRow(16)}). Rows read at 4, 10 and 16.`,
      }),
    }),
    brawlerRow({
      id: 'close-weapon-mastery',
      name: 'Close Weapon Mastery',
      key: '9iDmR626f7nfGE3k',
      levels: [5],
      pcgenLine: 101,
      foundryLine: 65,
    }),
    brawlerRow({
      id: 'brawlers-strike',
      name: 'Brawler’s Strike',
      key: '7ORiNdGyLzGddgNK',
      ...scheduleSteps({ steps: brawlersStrike }),
      pcgenLine: 100,
      foundryLine: 67,
      decision: describeFormulaHeld({
        name: 'Brawler’s Strike',
        line: 100,
        text: `the class text gives magic at 5th, cold iron and silver at 9th, an alignment at 12th and adamantine at 17th (${brawlerTable}:454), as the Brawler table prints (${brawlerTableRow(5)}, ${brawlerTableRow(9)}, ${brawlerTableRow(12)}, ${brawlerTableRow(17)}). Rows read at 5, 9, 12 and 17.`,
      }),
    }),
    brawlerRow({
      id: 'awesome-blow',
      name: 'Awesome Blow',
      key: 'EnMgClQRxY1GXg4e',
      levels: [16],
      pcgenLine: 102,
      foundryLine: 69,
    }),
    brawlerRow({
      id: 'improved-awesome-blow',
      name: 'Improved Awesome Blow',
      key: 'W6lurGAdeDsAch3G',
      levels: [20],
      pcgenLine: 103,
      foundryLine: 71,
    }),
  ],
  nonRows: {
    ClassSkills: classSkills,
    Proficiencies: proficiency,
    ArmorProficiencies: proficiency,
    WeaponProficiencies: proficiency,
  },
  grantNonRows: {},
  typeAliases: {},
  foundryNonRows: [],
  defects: [],
};

// --- Ninja ------------------------------------------------------------------

const ultimateCombatGlobals =
  'roleplaying_game/ultimate_combat/uc_abilities_globalvar.lst';
const ninjaFile = classFile('ninja.DGDOm05afSJj454X');
const ninjaRow = classRows({
  recordPrefix: 'Ninja',
  grantFile: ultimateCombatGlobals,
  foundryFile: ninjaFile,
});
/** The PRD's Ninja table (UC p.14), whose 1st-level row is at :367. */
const ninjaTable = 'ultimateCombat/classes/ninja.html';
const ninjaTableRow = makeTableRowCiter({ page: ninjaTable, firstRow: 367 });
const noTrace = [3, 6, 9, 12, 15, 18];

const ninja: ReviewedSchedule = {
  kind: 'reviewed',
  className: 'Ninja',
  classKey: 'pf1/DGDOm05afSJj454X',
  source: { book: 'Pathfinder RPG Ultimate Combat', pages: '13–17' },
  printedTable: {
    status: 'reviewed',
    page: ninjaTable,
    firstRow: 367,
    caption: 'Ninja',
    unprinted: {},
  },
  foundryFile: ninjaFile,
  acquisitionRecords: ['Ninja'],
  metadataRecords: ['Ninja'],
  flagNamespace: 'Ninja',
  slug: 'ninja',
  classSkillsRecord: 'Ninja ~ Class Skill',
  skillRanksPerLevel: 8,
  skillRanksAt: at(ninjaFile, 83),
  features: [
    ninjaRow({
      id: 'sneak-attack',
      name: 'Sneak Attack',
      key: '6pjr8jMFSKqXkBKk',
      levels: odds,
      incrementName: (index) => `Sneak Attack +${index + 1}d6`,
      pcgenLine: 20,
      foundryLine: 60,
      acquisitionFormula: abilityFile('sneak-attack.6pjr8jMFSKqXkBKk', 16),
      decision: `PCGen grants Ninja ~ Sneak Attack once at 1 (${ultimateCombatGlobals}:20) and defines no Ninja_CF_SneakAttack<n> (:182-204); Foundry's Sneak Attack computes (ceil(@class.level / 2))d6 (sneak-attack.6pjr8jMFSKqXkBKk.yaml:16). The Ninja table prints sneak attack +1d6 at 1st and 1d6 more every odd level to +10d6 at 19th (${ninjaTableRow(1)}-385).`,
    }),
    ninjaRow({
      id: 'poison-use',
      name: 'Poison Use',
      key: 'A54sLfcyoR5HGNbP',
      levels: [1],
      pcgenLine: 19,
      foundryLine: 62,
    }),
    ninjaRow({
      id: 'ki-pool',
      name: 'Ki Pool',
      key: 'V4rFQp52p7nzcijL',
      levels: [2],
      pcgenLine: 22,
      foundryLine: 64,
    }),
    ninjaRow({
      id: 'ninja-tricks',
      name: 'Ninja Tricks',
      key: 'V6chaFSNuJvUc9DN',
      levels: evens,
      // "Ninja trick" at 2nd and every 2 levels after (ninja.html:368-386).
      incrementName: () => 'Ninja Trick',
      whole: ['NinjaTrick'],
      parts: byLevel('NinjaTrick', evens),
      increments: 'numbered',
      pcgenName: 'Ninja Trick',
      pcgenLine: 21,
      foundryLine: 66,
    }),
    ninjaRow({
      id: 'no-trace',
      name: 'No Trace',
      key: 'V3TQ2f5HeX4K6l4p',
      levels: noTrace,
      incrementName: (index) => `No Trace +${index + 1}`,
      pcgenLine: 23,
      foundryLine: 68,
      acquisitionFormula: abilityFile('no-trace.V3TQ2f5HeX4K6l4p', 14),
      decision: `PCGen grants Ninja ~ No Trace once at 3 (${ultimateCombatGlobals}:23) and numbers no later bonus; Foundry's No Trace computes +[[floor(@class.level / 3)]] (no-trace.V3TQ2f5HeX4K6l4p.yaml:14). The class text gives +1 at 3rd, increasing every 3 levels (${ninjaTable}:463), as the Ninja table prints no trace +1 to +6 (${ninjaTableRow(3)}, ${ninjaTableRow(6)}, ${ninjaTableRow(9)}, ${ninjaTableRow(12)}, ${ninjaTableRow(15)}, ${ninjaTableRow(18)}). Rows read at 3, 6, 9, 12, 15 and 18.`,
    }),
    ninjaRow({
      id: 'uncanny-dodge',
      name: 'Uncanny Dodge',
      key: '7WaQxnVaaoL4AGr8',
      levels: [4],
      pcgenRecord: 'Uncanny Dodge ~ Base',
      pcgenLine: 24,
      foundryLine: 70,
    }),
    ninjaRow({
      id: 'light-steps',
      name: 'Light Steps',
      key: 'uSq9FyjQp3MF1ZPc',
      levels: [6],
      pcgenLine: 25,
      foundryLine: 72,
    }),
    ninjaRow({
      id: 'improved-uncanny-dodge',
      name: 'Improved Uncanny Dodge',
      key: 'ZfnHhhTFQVo0Lj4P',
      levels: [8],
      // The same record as uncanny dodge, on its own gate.
      pcgenRecord: 'Uncanny Dodge ~ Base',
      pcgenLine: 26,
      foundryLine: 74,
    }),
    ninjaRow({
      id: 'master-tricks',
      name: 'Master Tricks',
      key: 'mZ4ZtYBkLpRWrQYY',
      levels: [10],
      pcgenLine: null,
      foundryLine: 76,
      decision: `PCGen grants no master tricks row: its advanced ninja tricks are ninja trick choices from 10th level (PREVARGTEQ:NinjaTrickLVL,10, uc_abilities_class.lst:156-172). The class text gives master tricks at 10th, in place of a ninja trick (${ninjaTable}:469), as the Ninja table prints (${ninjaTableRow(10)}) and Foundry links it.`,
    }),
    ninjaRow({
      id: 'hidden-master',
      name: 'Hidden Master',
      key: 'Q6nL5pL41d7LzJWr',
      levels: [20],
      pcgenLine: 27,
      foundryLine: 78,
    }),
  ],
  nonRows: {
    ClassSkills: classSkills,
    WeaponProficiencies: proficiency,
    ArmorProficiency: proficiency,
  },
  grantNonRows: {},
  typeAliases: {},
  foundryNonRows: [],
  defects: [
    {
      id: 'ninja-trick-gate',
      suffixes: ['Trick', 'NinjaTrick'],
      text: `PCGen gates Ninja ~ Ninja Trick on the variable Ninja_CF_Trick (${ultimateCombatGlobals}:21), which it never defines (:182-204; Ninja_CF_Trick is a FACT, uc__datacontrols.lst:141), while FACT:Ninja_CF_Trick|true and TYPE.NinjaTrick set Ninja_CF_NinjaTrick (:213, :235), which gates no grant: no archetype flag removes ninja tricks in PCGen. The mapper maps Ninja_CF_NinjaTrick by its name to the ninja tricks.`,
    },
    {
      id: 'improved-uncanny-dodge-bridge',
      suffixes: ['ImprovedUncannyDodge', 'HiddenMaster'],
      text: `PCGen bridges Ninja_CF_ImprovedUncannyDodge from FACT:Ninja_CF_HiddenMaster (${ultimateCombatGlobals}:218), not from its own FACT: an archetype's FACT:Ninja_CF_ImprovedUncannyDodge|true (Frozen Shadow, isi_abilities_class.lst:215) removes nothing in PCGen, and FACT:Ninja_CF_HiddenMaster|true removes both. The mapper maps each by its name.`,
    },
  ],
};

// --- Rogue (Unchained) --------------------------------------------------------

const unchainedRogueFile = classFile('rogue-unchained.5tsZI6zk29yX1ckA');
const unchainedRogueRow = makeUnchainedRowBuilder(
  classRows({
    recordPrefix: 'Unchained Rogue',
    grantFile: unchainedClassAbilities,
    foundryFile: unchainedRogueFile,
  }),
);
/** The PRD's Unchained Rogue table (Pathfinder Unchained p.21), whose 1st-level row is at :373. */
const unchainedRogueTable = 'unchained/classes/rogue.html';
const unchainedRogueTableRow = makeTableRowCiter({
  page: unchainedRogueTable,
  firstRow: 373,
});
const finesseTraining = [1, 3, 11, 19];
const dangerSense = [3, 6, 9, 12, 15, 18];
const roguesEdge = [5, 10, 15, 20];

const unchainedRogue: ReviewedSchedule = {
  kind: 'reviewed',
  className: 'Rogue (Unchained)',
  classKey: 'pf1/5tsZI6zk29yX1ckA',
  source: { book: 'Pathfinder Unchained', pages: '20–24' },
  printedTable: {
    status: 'reviewed',
    page: unchainedRogueTable,
    firstRow: 373,
    caption: 'Unchained Rogue',
    unprinted: {},
  },
  foundryFile: unchainedRogueFile,
  acquisitionRecords: ['Rogue ~ Unchained Class'],
  metadataRecords: [
    'Rogue',
    'Rogue ~ Standard Class',
    'Rogue ~ Unchained Class',
  ],
  flagNamespace: 'Rogue',
  slug: 'unchained-rogue',
  classSkillsRecord: 'Unchained Rogue ~ Skills',
  skillRanksPerLevel: 8,
  skillRanksAt: at(unchainedRogueFile, 100),
  features: [
    unchainedRogueRow({
      id: 'finesse-training',
      name: 'Finesse Training',
      key: 'HmNDcFTlaEqr60Vw',
      levels: finesseTraining,
      // "Finesse training" at 1st, 3rd, 11th and 19th (rogue.html:373, :375,
      // :383, :391).
      incrementName: () => 'Finesse Training (UC)',
      // By order: the 2nd to 4th finesse training (defect below).
      parts: byOrder('FinesseTraining', finesseTraining),
      increments: 'numbered',
      pcgenLine: 218,
      foundryLine: 73,
      decision: `PCGen names Rogue_CF_FinesseTraining2, 3 and 4 by order, the finesse trainings after the 1st-level Weapon Finesse (${unchainedClassAbilities}:235-237); the class text gives Weapon Finesse at 1st and a weapon at 3rd, 11th and 19th (${unchainedRogueTable}:410), as the Unchained Rogue table prints finesse training at 1st, 3rd, 11th and 19th (${unchainedRogueTableRow(1)}, ${unchainedRogueTableRow(3)}, ${unchainedRogueTableRow(11)}, ${unchainedRogueTableRow(19)}). FinesseTraining2 is read at 3, 3 at 11 and 4 at 19.`,
    }),
    unchainedRogueRow({
      id: 'sneak-attack',
      name: 'Sneak Attack',
      key: 'rg0FL5INDBUt2oSK',
      levels: odds,
      incrementName: (index) => `Sneak Attack +${index + 1}d6 (UC)`,
      parts: byLevel('SneakAttack', odds),
      pcgenLine: 220,
      foundryLine: 75,
      acquisitionFormula: abilityFile('sneak-attack-uc.rg0FL5INDBUt2oSK', 16),
      decision: `PCGen holds the dice in a formula (BONUS:VAR|RogueSneakAttackLVL|RogueLVL, ${unchainedClassAbilities}:589); its Rogue_CF_SneakAttack1–19 (${coreRulebookGlobals}:892-901) are named by class level but gate nothing. The Unchained Rogue table prints sneak attack +1d6 at 1st and 1d6 more every odd level to +10d6 at 19th (${unchainedRogueTableRow(1)}-391).`,
    }),
    unchainedRogueRow({
      id: 'trapfinding',
      name: 'Trapfinding',
      key: 'pEODJDoTk7uhCZY7',
      levels: [1],
      pcgenLine: 221,
      foundryLine: 77,
    }),
    unchainedRogueRow({
      id: 'evasion',
      name: 'Evasion',
      key: 'KQYCRLEdD4bGA5ak',
      levels: [2],
      pcgenLine: 223,
      foundryLine: 79,
    }),
    unchainedRogueRow({
      id: 'talent',
      name: 'Rogue Talents',
      key: 'iBTrvPtn3jczInbn',
      levels: evens,
      // "Rogue talent" at 2nd and every 2 levels after (rogue.html:374-392).
      incrementName: () => 'Rogue Talent (UC)',
      parts: byLevel('RogueTalent', evens),
      increments: 'numbered',
      pcgenLine: 224,
      foundryLine: 81,
    }),
    unchainedRogueRow({
      id: 'danger-sense',
      name: 'Danger Sense',
      key: 'sTlu3zgAEDdJnER5',
      levels: dangerSense,
      incrementName: (index) => `Danger Sense +${index + 1} (UC)`,
      // The trap sense flags PCGen gates danger sense on.
      whole: ['TrapSense'],
      parts: byOrder('TrapSense', dangerSense),
      pcgenLine: 225,
      foundryLine: 83,
      acquisitionFormula: abilityFile('danger-sense.sTlu3zgAEDdJnER5', 15),
      decision: `PCGen gates Unchained Rogue ~ Danger Sense on the shared Rogue_CF_TrapSense (${unchainedClassAbilities}:225), which the archetypes written for the Unchained rogue set to replace it (Unchained Consigliere, ultimate_intrigue/support/ui_abilities_class_pu.lst:27); the class text counts danger sense as trap sense (${unchainedRogueTable}:444). It holds the bonus in a formula (RogueTrapSenseLVL/3, :582); Rogue_CF_TrapSense1–6 (${coreRulebookGlobals}:875-880) are numbered by order but gate nothing. The Unchained Rogue table prints danger sense +1 to +6 at 3, 6, 9, 12, 15 and 18 (${unchainedRogueTableRow(3)}, ${unchainedRogueTableRow(6)}, ${unchainedRogueTableRow(9)}, ${unchainedRogueTableRow(12)}, ${unchainedRogueTableRow(15)}, ${unchainedRogueTableRow(18)}).`,
    }),
    unchainedRogueRow({
      id: 'debilitating-injury',
      name: 'Debilitating Injury',
      key: 'nL9Ds9nflmID84vo',
      levels: [4],
      pcgenLine: 226,
      foundryLine: 85,
    }),
    unchainedRogueRow({
      id: 'uncanny-dodge',
      name: 'Uncanny Dodge',
      key: '7WaQxnVaaoL4AGr8',
      levels: [4],
      pcgenName: 'Uncanny Dodge Tracker',
      pcgenLine: 227,
      foundryLine: 87,
    }),
    unchainedRogueRow({
      id: 'rogues-edge',
      name: 'Rogue’s Edge',
      key: 'iyYyc3rKW0cBZ1cs',
      levels: roguesEdge,
      incrementName: () => 'Rogue’s Edge (UC)',
      pcgenName: 'Rogues Edge',
      pcgenLine: 228,
      foundryLine: 89,
      acquisitionFormula: abilityFile('rogue-s-edge-uc.iyYyc3rKW0cBZ1cs', 14),
      decision: `PCGen grants Unchained Rogue ~ Rogues Edge once at 5 (${unchainedClassAbilities}:228) and holds the skills in a pool, RogueLVL/5 (:588), numbering none. The class text gives a skill at 5th, 10th, 15th and 20th (${unchainedRogueTable}:455), as the Unchained Rogue table prints rogue's edge (${unchainedRogueTableRow(5)}, ${unchainedRogueTableRow(10)}, ${unchainedRogueTableRow(15)}, ${unchainedRogueTableRow(20)}). Rows read at 5, 10, 15 and 20.`,
    }),
    unchainedRogueRow({
      id: 'improved-uncanny-dodge',
      name: 'Improved Uncanny Dodge',
      key: 'ZfnHhhTFQVo0Lj4P',
      levels: [8],
      pcgenLine: null,
      foundryLine: 91,
      decision: `PCGen grants no row: the Uncanny Dodge Tracker counts it at 8 (BONUS:VAR|UncannyDodgeLVL|1|PREVARGTEQ:RogueLVL,8|PREVAREQ:Rogue_CF_ImprovedUncannyDodge,0, ${unchainedClassAbilities}:594). The class text gives it at 8th (${unchainedRogueTable}:457), as the Unchained Rogue table prints (${unchainedRogueTableRow(8)}) and Foundry links it.`,
    }),
    unchainedRogueRow({
      id: 'advanced-talents',
      name: 'Advanced Talents',
      key: 'EQ7JGo4P1XirLO46',
      levels: [10],
      pcgenLine: null,
      foundryLine: 93,
      decision: `PCGen defines Rogue_CF_AdvancedTalents (${coreRulebookGlobals}:881) but gates no grant on it. The class text gives advanced talents at 10th, in place of a rogue talent (${unchainedRogueTable}:461), as the Unchained Rogue table prints (${unchainedRogueTableRow(10)}) and Foundry links it.`,
    }),
    unchainedRogueRow({
      id: 'master-strike',
      name: 'Master Strike',
      key: '9l1EOZ2l3wLudvJN',
      levels: [20],
      pcgenLine: 229,
      foundryLine: 95,
    }),
  ],
  nonRows: {
    ClassSkills: classSkills,
    Skills: classSkills,
    WeaponProficiencies: proficiency,
    ArmorProficiencies: proficiency,
    WeaponProficiency: proficiency,
    ArmorProficiency: proficiency,
  },
  grantNonRows: {},
  typeAliases: {},
  foundryNonRows: [],
  defects: [
    {
      id: 'finesse-training-gates',
      suffixes: ['FinesseTraining2', 'FinesseTraining3', 'FinesseTraining4'],
      text: `PCGen gates Rogue_CF_FinesseTraining2, 3 and 4 at RogueFinesseTrainingLVL 2, 3 and 4 (${unchainedClassAbilities}:612-614), but RogueFinesseTrainingLVL = (RogueLvl+5)/8 (:585) reaches only 1, 2 and 3, at 3rd, 11th and 19th: in PCGen FinesseTraining2 removes the 11th-level weapon, FinesseTraining3 the 19th-level one and FinesseTraining4 none. The mapper maps each by its name, the nth finesse training: 3, 11 and 19.`,
    },
  ],
};

/** The P7b schedules, by class name. */
export const martialSchedules = {
  Monk: monk,
  'Monk (Unchained)': unchainedMonk,
  Brawler: brawler,
  Ninja: ninja,
  'Rogue (Unchained)': unchainedRogue,
} as const satisfies Readonly<Record<string, ReviewedSchedule>>;
