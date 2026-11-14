import {
  abilityFile,
  buildPerDaySteps,
  at,
  buildPlusSteps,
  byLevel,
  byOrder,
  classFile,
  classRows,
  classSkills,
  describeCastingRow,
  evens,
  makeTableRowCiter,
  makeUnchainedRowBuilder,
  notOnTable,
  ordinal,
  proficiency,
  scheduleSteps,
  sharedRow,
  type ReviewedSchedule,
  type RowFields,
  type ScheduledFeature,
} from './schedule-model';

/**
 * #716 P7c: the reviewed schedules of the performance and rage classes,
 * Bard, Barbarian, Barbarian (Unchained), Skald and Bloodrager (research
 * note 716-p7-rules §1, §3, §6; the model: `schedule-model.ts`).
 *
 * - A row is an entry of the table's Special column; the casting rows the
 *   column doesn't print (spells, the spell exchange) are cited as
 *   `unprinted`, as P7a's are.
 * - The bard's performances and the skald's raging songs are named
 *   subfeatures (`subfeatureOf`, note §6 decision 1): each is its own row,
 *   removed by its own flag, and a removal or alteration of bardic
 *   performance or raging song reaches every one of them.
 * - PCGen numbers the barbarians' rage powers, trap sense (the Unchained
 *   barbarian's danger sense) and damage reduction, the bard's inspire
 *   courage and inspire competence (by value), the skald's rage powers and
 *   versatile performances and the bloodrager's bloodline feats and spells
 *   (by spell level); every other repeating feature is formula-held, and the
 *   table alone gives its later rows.
 * - Barbarian (Unchained) is its own schedule (`unchained-barbarian`, the
 *   seed's identity): its own record's grants and the shared `Barbarian_CF_`
 *   flags. Original barbarian archetypes reach it by name and level at
 *   runtime (docs/character-sheet/unchained-classes.md:12).
 */

const coreRulebookClassAbilities =
  'roleplaying_game/core_rulebook/cr_abilities_class.lst';
const coreRulebookGlobals =
  'roleplaying_game/core_rulebook/cr_abilities_globalvar.lst';
const unchainedClassAbilities =
  'roleplaying_game/pathfinder_unchained/pu_abilities_class.lst';
const advancedClassGuideClasses =
  'roleplaying_game/advanced_class_guide/acg_classes.lst';
const advancedClassGuideAbilities =
  'roleplaying_game/advanced_class_guide/acg_abilities_class.lst';
const advancedClassGuideGlobals =
  'roleplaying_game/advanced_class_guide/acg_abilities_globalvar.lst';

/** Damage reduction's labels: `<name> <1 + index>/—`. */
const buildDamageReductionSteps = ({
  name,
  levels,
}: {
  name: string;
  levels: readonly number[];
}) => levels.map((level, index) => [level, `${name} ${index + 1}/—`] as const);

/** The decision of the spontaneous spell exchange, which the table prints no row for. */
const describeExchangeSpell = ({
  level,
  file,
  text,
}: {
  level: number;
  file: string;
  text: string;
}) =>
  `${describeCastingRow({ name: 'Exchange Spell', foundryLevel: level })} The table has no row for it: ${text} (${file}).`;

// --- Barbarian --------------------------------------------------------------

/**
 * The APG and Ultimate Combat barbarian archetypes' old-style
 * `BarbarianCF<feature>` TYPE tokens (Invulnerable Rager,
 * apg_abilities_class.lst:1546), which no global bridges: each names the
 * feature its `Barbarian_CF_<feature>` FACT removes. `BarbarianCFRagePower`
 * isn't one: Mad Dog sets it beside the rage powers it replaces by level
 * (anar_abilities_class.lst:7), so it stays an unknown token for review.
 */
const barbarianTypeAliases = {
  BarbarianCFDamageReduction: 'DamageReduction',
  BarbarianCFFastMovement: 'FastMovement',
  BarbarianCFImprovedUncannyDodge: 'ImprovedUncannyDodge',
  BarbarianCFIndomitableWill: 'IndomitableWill',
  BarbarianCFTrapSense: 'TrapSense',
  BarbarianCFUncannyDodge: 'UncannyDodge',
};

const barbarianFile = classFile('barbarian.g3pq7xWWdUVYw6ai');
const barbarianRow = classRows({
  recordPrefix: 'Barbarian',
  grantFile: coreRulebookClassAbilities,
  foundryFile: barbarianFile,
});
/** The PRD's Table: Barbarian (CRB p.32), whose 1st-level row is at :357. */
const barbarianTable = 'coreRulebook/classes/barbarian.html';
const barbarianTableRow = makeTableRowCiter({
  page: barbarianTable,
  firstRow: 357,
});
const trapSense = [3, 6, 9, 12, 15, 18];
const damageReduction = [7, 10, 13, 16, 19];

const barbarian: ReviewedSchedule = {
  kind: 'reviewed',
  className: 'Barbarian',
  classKey: 'pf1/g3pq7xWWdUVYw6ai',
  source: { book: 'Pathfinder RPG Core Rulebook', pages: '31–34' },
  printedTable: {
    status: 'reviewed',
    page: barbarianTable,
    firstRow: 357,
    caption: 'Barbarian',
    unprinted: {},
  },
  foundryFile: barbarianFile,
  acquisitionRecords: ['Barbarian ~ Standard Class Full'],
  metadataRecords: [
    'Barbarian',
    'Barbarian ~ Standard Class Full',
    'Barbarian ~ Unchained Class Full',
  ],
  flagNamespace: 'Barbarian',
  slug: 'barbarian',
  classSkillsRecord: 'Class Skills ~ Barbarian',
  skillRanksPerLevel: 4,
  skillRanksAt: at(barbarianFile, 83),
  features: [
    barbarianRow({
      id: 'fast-movement',
      name: 'Fast Movement',
      key: '9EX00obqhGHcrOdp',
      levels: [1],
      pcgenLine: 150,
      foundryLine: 60,
    }),
    barbarianRow({
      id: 'rage',
      name: 'Rage',
      key: 'WSqWT9ZIshtC5vlV',
      levels: [1],
      pcgenLine: 149,
      foundryLine: 58,
    }),
    barbarianRow({
      id: 'rage-power',
      name: 'Rage Powers',
      key: 'HdzsFdoGauXFjU2S',
      levels: evens,
      // "Rage power" at 2nd and every 2 levels after (barbarian.html:358-376).
      incrementName: () => 'Rage Power',
      whole: ['RagePowers'],
      parts: byLevel('RagePower', evens),
      increments: 'numbered',
      pcgenLine: 151,
      foundryLine: 64,
    }),
    barbarianRow({
      id: 'uncanny-dodge',
      name: 'Uncanny Dodge',
      key: '7WaQxnVaaoL4AGr8',
      levels: [2],
      pcgenLine: null,
      foundryLine: 62,
      decision: `PCGen grants no uncanny dodge row: Barbarian ~ Standard Class Full grants the Barbarian ~ Uncanny Dodge Tracker at no level and on no gate (${coreRulebookClassAbilities}:148), and the tracker counts uncanny dodge from barbarian level 2 while Barbarian_CF_UncannyDodge is unset (:438). The class text gives it at 2nd (${barbarianTable}:414), as Table: Barbarian prints (${barbarianTableRow(2)}) and Foundry links it.`,
    }),
    barbarianRow({
      id: 'trap-sense',
      name: 'Trap Sense',
      key: 'BoEkMviJrW0PKmhj',
      ...scheduleSteps({
        steps: buildPlusSteps({ name: 'Trap Sense', levels: trapSense }),
      }),
      // By order: the nth +1 (cr_abilities_class.lst:441-446).
      parts: byOrder('TrapSense', trapSense),
      increments: 'numbered',
      pcgenLine: 152,
      foundryLine: 66,
      acquisitionFormula: abilityFile('trap-sense.BoEkMviJrW0PKmhj', 17),
      decision: `PCGen takes one point of trap sense off for each Barbarian_CF_TrapSense<n>, gated on the nth point (BarbarianTrapSenseLVL/3 ≥ n, ${coreRulebookClassAbilities}:441-446): numbered by order. The class text gives +1 at 3rd and +1 every three levels after (${barbarianTable}:416), as Table: Barbarian prints trap sense +1 to +6 (${barbarianTableRow(3)}, ${barbarianTableRow(6)}, ${barbarianTableRow(9)}, ${barbarianTableRow(12)}, ${barbarianTableRow(15)}, ${barbarianTableRow(18)}), so TrapSense3 is the 9th-level row.`,
    }),
    barbarianRow({
      id: 'improved-uncanny-dodge',
      name: 'Improved Uncanny Dodge',
      key: 'ZfnHhhTFQVo0Lj4P',
      levels: [5],
      pcgenLine: null,
      foundryLine: 68,
      decision: `PCGen grants no improved uncanny dodge row: the Barbarian ~ Uncanny Dodge Tracker counts it from barbarian level 5 while Barbarian_CF_ImprovedUncannyDodge is unset (${coreRulebookClassAbilities}:439). The class text gives it at 5th (${barbarianTable}:417), as Table: Barbarian prints (${barbarianTableRow(5)}) and Foundry links it.`,
    }),
    barbarianRow({
      id: 'damage-reduction',
      name: 'Damage Reduction',
      key: 'RENIeTVjWB7Mq6Mw',
      ...scheduleSteps({
        steps: buildDamageReductionSteps({
          name: 'Damage Reduction',
          levels: damageReduction,
        }),
      }),
      // By order: the nth point (cr_abilities_class.lst:448-452).
      parts: byOrder('DamageReduction', damageReduction),
      increments: 'numbered',
      pcgenLine: 153,
      foundryLine: 70,
      decision: `PCGen takes one point of damage reduction off for each Barbarian_CF_DamageReduction<n>, gated on the nth point ((BarbarianDRLVL-4)/3 ≥ n, ${coreRulebookClassAbilities}:448-452): numbered by order. The class text gives DR 1/— at 7th and 1 more at 10th and every three levels after (${barbarianTable}:419), as Table: Barbarian prints damage reduction 1/— to 5/— (${barbarianTableRow(7)}, ${barbarianTableRow(10)}, ${barbarianTableRow(13)}, ${barbarianTableRow(16)}, ${barbarianTableRow(19)}). Foundry's Damage Reduction computes nothing from the level (damage-reduction.RENIeTVjWB7Mq6Mw.yaml).`,
    }),
    barbarianRow({
      id: 'greater-rage',
      name: 'Greater Rage',
      key: 'IWNz5tJCnpig4UtX',
      levels: [11],
      pcgenLine: 154,
      foundryLine: 72,
    }),
    barbarianRow({
      id: 'indomitable-will',
      name: 'Indomitable Will',
      key: 'Q3x319WbNkCssApD',
      levels: [14],
      pcgenLine: 155,
      foundryLine: 74,
    }),
    barbarianRow({
      id: 'tireless-rage',
      name: 'Tireless Rage',
      key: 'aYdjgDZJCNvKpLQP',
      levels: [17],
      pcgenLine: 156,
      foundryLine: 76,
      foundryLevel: 16,
      decision: `Foundry links Tireless Rage at 16 (${barbarianFile}:76-77), but its own text says "Starting at 17th level" (tireless-rage.aYdjgDZJCNvKpLQP.yaml:14); PCGen grants Barbarian ~ Tireless Rage at 17 (${coreRulebookClassAbilities}:156), the class text gives it at 17th (${barbarianTable}:422) and Table: Barbarian prints it there (${barbarianTableRow(17)}). The row is at 17 (note §6, a Foundry defect).`,
    }),
    barbarianRow({
      id: 'mighty-rage',
      name: 'Mighty Rage',
      key: '0v0NLj0tuVAu2Cla',
      levels: [20],
      pcgenLine: 157,
      foundryLine: 78,
    }),
  ],
  nonRows: {
    ClassSkills: classSkills,
    Proficiencies: proficiency,
    WeaponProficiencies: proficiency,
    ArmorProficiencies: proficiency,
    // Sea Reaver's and Urban Barbarian's TYPE (uc_abilities_class.lst:305, :308).
    MediumArmorProficiency: proficiency,
  },
  grantNonRows: {},
  typeAliases: barbarianTypeAliases,
  foundryNonRows: [
    {
      externalKey: 'pf1/aYdjgDZJCNvKpLQP',
      level: 16,
      text: `Foundry links Tireless Rage at 16 (${barbarianFile}:76-77) against its own text, "Starting at 17th level" (tireless-rage.aYdjgDZJCNvKpLQP.yaml:14), PCGen (${coreRulebookClassAbilities}:156) and Table: Barbarian (${barbarianTableRow(17)}): the row is at 17.`,
    },
  ],
  defects: [],
};

// --- Barbarian (Unchained) ----------------------------------------------------

const unchainedBarbarianFile = classFile(
  'barbarian-unchained.W3EjUgYLJ1D9qDKw',
);
const unchainedBarbarianRow = makeUnchainedRowBuilder(
  classRows({
    recordPrefix: 'Unchained Barbarian',
    grantFile: unchainedClassAbilities,
    foundryFile: unchainedBarbarianFile,
  }),
);
/** The PRD's Unchained Barbarian table (Pathfinder Unchained p.9), whose 1st-level row is at :372. */
const unchainedBarbarianTable = 'unchained/classes/barbarian.html';
const unchainedBarbarianTableRow = makeTableRowCiter({
  page: unchainedBarbarianTable,
  firstRow: 372,
});

const unchainedBarbarian: ReviewedSchedule = {
  kind: 'reviewed',
  className: 'Barbarian (Unchained)',
  classKey: 'pf1/W3EjUgYLJ1D9qDKw',
  source: { book: 'Pathfinder Unchained', pages: '8–13' },
  printedTable: {
    status: 'reviewed',
    page: unchainedBarbarianTable,
    firstRow: 372,
    caption: 'Unchained Barbarian',
    unprinted: {},
  },
  foundryFile: unchainedBarbarianFile,
  acquisitionRecords: ['Barbarian ~ Unchained Class Full'],
  metadataRecords: [
    'Barbarian',
    'Barbarian ~ Standard Class Full',
    'Barbarian ~ Unchained Class Full',
  ],
  flagNamespace: 'Barbarian',
  slug: 'unchained-barbarian',
  classSkillsRecord: 'Class Skills ~ Unchained Barbarian',
  skillRanksPerLevel: 4,
  skillRanksAt: at(unchainedBarbarianFile, 77),
  features: [
    unchainedBarbarianRow({
      id: 'fast-movement',
      name: 'Fast Movement',
      key: '9EX00obqhGHcrOdp',
      levels: [1],
      pcgenLine: 133,
      foundryLine: 54,
    }),
    unchainedBarbarianRow({
      id: 'rage',
      name: 'Rage',
      key: '2Az38ZPYwjYBKZd2',
      levels: [1],
      pcgenLine: 132,
      foundryLine: 52,
    }),
    unchainedBarbarianRow({
      id: 'rage-power',
      name: 'Rage Powers',
      key: 'JtCZXN41TLQG48bo',
      levels: evens,
      // "Rage power" at 2nd and every 2 levels after (barbarian.html:373-391).
      incrementName: () => 'Rage Power (UC)',
      whole: ['RagePowers'],
      // The CRB's names (defect below).
      parts: byLevel('RagePower', evens),
      increments: 'numbered',
      pcgenLine: 134,
      foundryLine: 56,
    }),
    unchainedBarbarianRow({
      id: 'uncanny-dodge',
      name: 'Uncanny Dodge',
      key: '7WaQxnVaaoL4AGr8',
      levels: [2],
      pcgenRecord: 'Unchained Barbarian ~ Uncanny Dodge Tracker',
      pcgenLine: 135,
      foundryLine: 58,
      decision: `PCGen grants the Unchained Barbarian ~ Uncanny Dodge Tracker at 2 with no Barbarian_CF_ gate (${unchainedClassAbilities}:135), and the tracker counts uncanny dodge while Barbarian_CF_UncannyDodge is unset (:301): the flag removes the dodge, not the grant. The class text gives uncanny dodge at 2nd (${unchainedBarbarianTable}:461), as the Unchained Barbarian table prints (${unchainedBarbarianTableRow(2)}) and Foundry links it.`,
    }),
    unchainedBarbarianRow({
      id: 'danger-sense',
      name: 'Danger Sense',
      key: 'sTlu3zgAEDdJnER5',
      ...scheduleSteps({
        steps: buildPlusSteps({ name: 'Danger Sense', levels: trapSense }),
        suffix: ' (UC)',
      }),
      // The trap sense flags PCGen gates danger sense on.
      whole: ['TrapSense'],
      parts: byOrder('TrapSense', trapSense),
      increments: 'numbered',
      pcgenLine: 136,
      foundryLine: 60,
      acquisitionFormula: abilityFile('danger-sense.sTlu3zgAEDdJnER5', 15),
      decision: `PCGen gates Unchained Barbarian ~ Danger Sense on the shared Barbarian_CF_TrapSense (${unchainedClassAbilities}:136); the class text says danger sense "can be replaced by any archetype class feature that replaces trap sense" (${unchainedBarbarianTable}:464). It gives +1 at 3rd and +1 every three levels after, to +6 at 18th (:464), as the Unchained Barbarian table prints (${unchainedBarbarianTableRow(3)}, ${unchainedBarbarianTableRow(6)}, ${unchainedBarbarianTableRow(9)}, ${unchainedBarbarianTableRow(12)}, ${unchainedBarbarianTableRow(15)}, ${unchainedBarbarianTableRow(18)}). TrapSense<n> is read by order, the nth +1.`,
    }),
    unchainedBarbarianRow({
      id: 'improved-uncanny-dodge',
      name: 'Improved Uncanny Dodge',
      key: 'ZfnHhhTFQVo0Lj4P',
      levels: [5],
      pcgenLine: null,
      foundryLine: 62,
      decision: `PCGen grants no improved uncanny dodge row: the Unchained Barbarian ~ Uncanny Dodge Tracker counts it from barbarian level 5 while Barbarian_CF_ImprovedUncannyDodge is unset (${unchainedClassAbilities}:301). The class text gives it at 5th (${unchainedBarbarianTable}:466), as the Unchained Barbarian table prints (${unchainedBarbarianTableRow(5)}) and Foundry links it.`,
    }),
    unchainedBarbarianRow({
      id: 'damage-reduction',
      name: 'Damage Reduction',
      key: 'RENIeTVjWB7Mq6Mw',
      ...scheduleSteps({
        steps: buildDamageReductionSteps({
          name: 'Damage Reduction',
          levels: damageReduction,
        }),
        suffix: ' (UC)',
      }),
      parts: byOrder('DamageReduction', damageReduction),
      increments: 'numbered',
      pcgenLine: 137,
      foundryLine: 64,
      decision: `The class text gives DR 1/— at 7th and 1 more at 10th and every three levels after, up to 5 at 19th (${unchainedBarbarianTable}:469), as the Unchained Barbarian table prints (${unchainedBarbarianTableRow(7)}, ${unchainedBarbarianTableRow(10)}, ${unchainedBarbarianTableRow(13)}, ${unchainedBarbarianTableRow(16)}, ${unchainedBarbarianTableRow(19)}). Barbarian_CF_DamageReduction<n> is read by order, the nth point, as the CRB barbarian's.`,
    }),
    unchainedBarbarianRow({
      id: 'greater-rage',
      name: 'Greater Rage',
      key: 'wQzDpnuEOloBB7ZH',
      levels: [11],
      pcgenLine: 138,
      foundryLine: 66,
    }),
    unchainedBarbarianRow({
      id: 'indomitable-will',
      name: 'Indomitable Will',
      key: 'Q3x319WbNkCssApD',
      levels: [14],
      pcgenLine: 139,
      foundryLine: 68,
    }),
    unchainedBarbarianRow({
      id: 'tireless-rage',
      name: 'Tireless Rage',
      key: 'jttL7NeMj1wGPkDO',
      levels: [17],
      pcgenLine: 140,
      foundryLine: 70,
    }),
    unchainedBarbarianRow({
      id: 'mighty-rage',
      name: 'Mighty Rage',
      key: 'rmzUjpMld0deM9Aa',
      levels: [20],
      pcgenLine: 141,
      foundryLine: 72,
    }),
  ],
  nonRows: {
    ClassSkills: classSkills,
    Proficiencies: proficiency,
    WeaponProficiencies: proficiency,
    ArmorProficiencies: proficiency,
    // Sea Reaver's and Urban Barbarian's TYPE (uc_abilities_class.lst:305, :308).
    MediumArmorProficiency: proficiency,
  },
  grantNonRows: {},
  typeAliases: barbarianTypeAliases,
  foundryNonRows: [],
  defects: [
    {
      id: 'unchained-part-gates',
      suffixes: [
        ...evens.map((level) => `RagePower${level}`),
        ...trapSense.map((_, index) => `TrapSense${index + 1}`),
        ...damageReduction.map((_, index) => `DamageReduction${index + 1}`),
      ],
      text: `Barbarian_CF_RagePower<n>, Barbarian_CF_TrapSense<n> and Barbarian_CF_DamageReduction<n> gate only the CRB barbarian's records (${coreRulebookClassAbilities}:441-465); the Unchained records take a rage power, a point of danger sense or of damage reduction off only for the archetype TYPE tokens (TYPE.BarbarianRagePower2, ${unchainedClassAbilities}:313-337). An archetype that sets only the FACT removes nothing from the Unchained barbarian in PCGen. The mapper maps each variable by its name to the Unchained rows.`,
    },
  ],
};

// --- Bard -------------------------------------------------------------------

const bardFile = classFile('bard.6GjOjO6r3R06fLwE');
const bardRow = classRows({
  recordPrefix: 'Bard',
  grantFile: coreRulebookClassAbilities,
  foundryFile: bardFile,
});
/** The PRD's Table: Bard (CRB p.35), whose 1st-level row is at :358. */
const bardTable = 'coreRulebook/classes/bard.html';
const bardTableRow = makeTableRowCiter({ page: bardTable, firstRow: 358 });
const versatilePerformance = [2, 6, 10, 14, 18];
const inspireCourage = [1, 5, 11, 17];
const inspireCompetence = [3, 7, 11, 15, 19];
const loreMaster = [5, 11, 17];

/**
 * A bard performance: a named subfeature of bardic performance, granted
 * inside Bard ~ Bardic Performance (cr_abilities_class.lst:505) on its own
 * `Bard_CF_` flag, and described among the performances (bard.html:417-432).
 */
type Performance = Omit<RowFields, 'pcgenLine' | 'pcgenRecord'> & {
  /** Its `Bard_CF_` flag. */
  flag: string;
  /** Its line in the class text. */
  textLine: number;
};
function buildPerformanceRow({
  flag,
  textLine,
  decision,
  ...fields
}: Performance): ScheduledFeature {
  const [level = 1] = fields.levels;
  return bardRow({
    ...fields,
    whole: fields.whole ?? [flag],
    subfeatureOf: 'bardic-performance',
    pcgenRecord: `Bardic Performance ~ ${fields.name}`,
    pcgenLine: 505,
    decision: `PCGen grants Bardic Performance ~ ${fields.name} inside Bard ~ Bardic Performance, at BardicPerformanceLVL ${level} while Bard_CF_${flag} is unset (${coreRulebookClassAbilities}:505): a grant nested in the bardic performance record, which Bard_CF_${flag} removes. The class text gives it among the bardic performances at ${ordinal(level)} (${bardTable}:${textLine}), as Table: Bard prints (${bardTableRow(level)}) and Foundry links it.${decision ? ` ${decision}` : ''}`,
  });
}
/** A bard feature PCGen also grants with no `Bard_CF_` gate (the duplicate grants, cr_abilities_globalvar.lst:151-159). */
const describeUngatedDuplicate = ({
  name,
  line,
}: {
  name: string;
  line: number;
}) =>
  `PCGen grants Bard ~ ${name} twice: on its Bard_CF_ gate and again with no gate (${coreRulebookGlobals}:${line}), so no archetype flag removes it in PCGen (defect ungated-duplicate-grants).`;

const bard: ReviewedSchedule = {
  kind: 'reviewed',
  className: 'Bard',
  classKey: 'pf1/6GjOjO6r3R06fLwE',
  source: { book: 'Pathfinder RPG Core Rulebook', pages: '34–38' },
  printedTable: {
    status: 'reviewed',
    page: bardTable,
    firstRow: 358,
    caption: 'Bard',
    unprinted: {
      spells: `The Spells per Day columns give the bard's spells from 1st (${bardTableRow(1)}; ${bardTable}:405-406).`,
      'exchange-spell': `The class text, not the Special column, gives the exchange at 5th and every third level after, as part of the spells (${bardTable}:408).`,
    },
  },
  foundryFile: bardFile,
  acquisitionRecords: ['Bard'],
  metadataRecords: ['Bard'],
  flagNamespace: 'Bard',
  slug: 'bard',
  classSkillsRecord: 'Class Skills ~ Bard',
  skillRanksPerLevel: 6,
  skillRanksAt: at(bardFile, 125),
  features: [
    bardRow({
      id: 'bardic-knowledge',
      name: 'Bardic Knowledge',
      key: 'Pb9pxYrx6tS87euP',
      levels: [1],
      pcgenLine: 206,
      foundryLine: 76,
    }),
    bardRow({
      id: 'bardic-performance',
      name: 'Bardic Performance',
      key: 'ZfCUTi1MiLgR4T7I',
      levels: [1],
      pcgenLine: 208,
      foundryLine: 82,
    }),
    bardRow({
      id: 'cantrips',
      name: 'Cantrips',
      key: 'IPy4aqFYbOppaqKC',
      levels: [1],
      casting: true,
      pcgenLine: 210,
      foundryLine: 88,
    }),
    bardRow({
      id: 'countersong',
      name: 'Countersong',
      key: 'RF8ioMkLc7LNnNT1',
      levels: [1],
      whole: ['CounterSong'],
      subfeatureOf: 'bardic-performance',
      pcgenName: 'Bardic Countersong',
      pcgenLine: 207,
      foundryLine: 84,
      decision: `PCGen grants countersong as its own class record, Bard ~ Bardic Countersong, gated on Bard_CF_CounterSong (${coreRulebookClassAbilities}:207), which grants Bardic Performance ~ Countersong (:504); the class text gives it among the bardic performances at 1st (${bardTable}:417), so it is a subfeature of bardic performance.`,
    }),
    buildPerformanceRow({
      id: 'distraction',
      name: 'Distraction',
      key: 'Kq3GVZ1yMv3ERQCJ',
      levels: [1],
      flag: 'BardDistraction',
      textLine: 418,
      foundryLine: 86,
    }),
    buildPerformanceRow({
      id: 'fascinate',
      name: 'Fascinate',
      key: 'tWE66WvFjS1o0S4y',
      levels: [1],
      flag: 'Fascinate',
      textLine: 419,
      foundryLine: 80,
    }),
    buildPerformanceRow({
      id: 'inspire-courage',
      name: 'Inspire Courage',
      key: 'h56K6HEBOItImPPL',
      ...scheduleSteps({
        steps: buildPlusSteps({
          name: 'Inspire Courage',
          levels: inspireCourage,
        }),
      }),
      flag: 'InspireCourage',
      // By order and value: the nth +1 (cr_abilities_class.lst:536-539).
      parts: byOrder('InspireCourage', inspireCourage),
      increments: 'numbered',
      textLine: 422,
      foundryLine: 78,
      decision: `PCGen takes 1 off the bonus for each Bard_CF_InspireCourage<n>, gated on the nth +1 (InspireCourageCount = min((BardicPerformanceLVL+7)/6,4) ≥ n, ${coreRulebookClassAbilities}:524, :536-539): +1 at 1st, +2 at 5th, +3 at 11th and +4 at 17th (${bardTable}:422; ${bardTableRow(1)}, ${bardTableRow(5)}, ${bardTableRow(11)}, ${bardTableRow(17)}).`,
    }),
    bardRow({
      id: 'spells',
      name: 'Bard Spells',
      key: 'S4VHXq1asXBwaRwo',
      levels: [1],
      // Bard_Archetype_Spellcasting marks the casting (cr__datacontrols.lst).
      whole: ['Spells', 'Spellcasting'],
      casting: true,
      pcgenLine: null,
      foundryLine: 90,
      decision: describeCastingRow({ name: 'Bard Spells', foundryLevel: 1 }),
    }),
    bardRow({
      id: 'versatile-performance',
      name: 'Versatile Performance',
      key: 'HAqAsb5H56C6cZm3',
      levels: versatilePerformance,
      // "Versatile performance" at 2nd and every 4 levels after
      // (bard.html:359-375).
      incrementName: () => 'Versatile Performance',
      // By level: the 2nd-level performance (defect below).
      parts: { VersatilePerformance2: 2 },
      pcgenLine: 211,
      foundryLine: 92,
      decision: `PCGen holds the performances in a pool, (VersatilePerformanceLVL+2)/4 (${coreRulebookClassAbilities}:507), and numbers only the 2nd-level one, Bard_CF_VersatilePerformance2 (:535; defect versatile-performance-2). The class text gives one at 2nd and another at 6th and every 4 levels after (${bardTable}:434), as Table: Bard prints (${bardTableRow(2)}, ${bardTableRow(6)}, ${bardTableRow(10)}, ${bardTableRow(14)}, ${bardTableRow(18)}): the later rows are the table's alone. ${describeUngatedDuplicate({ name: 'Versatile Performance', line: 156 })}`,
    }),
    bardRow({
      id: 'well-versed',
      name: 'Well-Versed',
      key: 'wew6ophJrcab24m6',
      levels: [2],
      whole: ['WellVersed'],
      pcgenLine: 212,
      foundryLine: 94,
      decision: describeUngatedDuplicate({ name: 'Well-Versed', line: 157 }),
    }),
    buildPerformanceRow({
      id: 'inspire-competence',
      name: 'Inspire Competence',
      key: '2M56kfIOws5yYtxq',
      ...scheduleSteps({
        steps: buildPlusSteps({
          name: 'Inspire Competence',
          levels: inspireCompetence,
          first: 2,
        }),
      }),
      flag: 'InspireCompetence',
      parts: {
        // By value: each 1 of the bonus, at the row it completes
        // (cr_abilities_class.lst:540-545); the +2 at 3rd is two.
        InspireCompetence1: 3,
        InspireCompetence2: 3,
        InspireCompetence3: 7,
        InspireCompetence4: 11,
        InspireCompetence5: 15,
        InspireCompetence6: 19,
      },
      increments: 'numbered',
      textLine: 423,
      foundryLine: 96,
      decision: `PCGen takes 1 off the bonus for each Bard_CF_InspireCompetence<n>, gated on the nth point (InspireCompetenceCount = (BardicPerformanceLVL+5)/4 ≥ n, ${coreRulebookClassAbilities}:525, :540-545): the count is 2 at 3rd, so InspireCompetence1 and 2 are both the +2 row, and 3 to 6 the +3 to +6 rows at 7th, 11th, 15th and 19th (${bardTable}:423; ${bardTableRow(3)}, ${bardTableRow(7)}, ${bardTableRow(11)}, ${bardTableRow(15)}, ${bardTableRow(19)}). Read by value (note §2).`,
    }),
    bardRow({
      id: 'lore-master',
      name: 'Lore Master',
      key: 'msQWK7TW7mufzf8l',
      ...scheduleSteps({
        steps: buildPerDaySteps({ name: 'Lore Master', levels: loreMaster }),
      }),
      pcgenLine: 213,
      foundryLine: 100,
      acquisitionFormula: abilityFile('lore-master.msQWK7TW7mufzf8l', 35),
      decision: `PCGen grants Bard ~ Lore Master once at 5 (${coreRulebookClassAbilities}:213) and holds the uses in a formula, min((LoreMasterLVL+1)/6,3) (:509), numbering none. The class text gives it at 5th and a use a day more at 11th and 17th (${bardTable}:437), as Table: Bard prints lore master 1/day to 3/day (${bardTableRow(5)}, ${bardTableRow(11)}, ${bardTableRow(17)}). Rows read at 5, 11 and 17. ${describeUngatedDuplicate({ name: 'Lore Master', line: 158 })}`,
    }),
    bardRow({
      id: 'exchange-spell',
      name: 'Exchange Spell',
      key: '5lDEyC6WejFyTEho',
      levels: [5],
      whole: [],
      casting: true,
      pcgenLine: null,
      foundryLine: 98,
      decision: describeExchangeSpell({
        level: 5,
        file: `${bardTable}:408`,
        text: 'the bard learns a new spell in place of one he knows at 5th and every third level after',
      }),
    }),
    buildPerformanceRow({
      id: 'suggestion',
      name: 'Suggestion',
      key: 'vtrruBLKeimBrupy',
      levels: [6],
      flag: 'Suggestion',
      textLine: 424,
      foundryLine: 102,
    }),
    buildPerformanceRow({
      id: 'dirge-of-doom',
      name: 'Dirge of Doom',
      key: 'pmWnRksUzrKvNOvy',
      levels: [8],
      flag: 'DirgeOfDoom',
      textLine: 426,
      foundryLine: 104,
    }),
    buildPerformanceRow({
      id: 'inspire-greatness',
      name: 'Inspire Greatness',
      key: 'X7gqbGkXTox6Ojhy',
      levels: [9],
      flag: 'InspireGreatness',
      textLine: 427,
      foundryLine: 106,
    }),
    bardRow({
      id: 'jack-of-all-trades',
      name: 'Jack of All Trades',
      key: 'qamuc5DZdOJMlRrD',
      levels: [10],
      // The table spells it "Jack-of-all-trades" (bard.html:367).
      incrementName: () => 'Jack-of-All-Trades',
      pcgenLine: 214,
      foundryLine: 108,
      decision: `The table prints jack-of-all-trades at 10th only (${bardTableRow(10)}); its 16th- and 19th-level effects are class text (${bardTable}:438). ${describeUngatedDuplicate({ name: 'Jack of All Trades', line: 159 })}`,
    }),
    buildPerformanceRow({
      id: 'soothing-performance',
      name: 'Soothing Performance',
      key: 'iGrgU1XzlweVO2tb',
      levels: [12],
      flag: 'SoothingPerformance',
      textLine: 428,
      foundryLine: 110,
    }),
    buildPerformanceRow({
      id: 'frightening-tune',
      name: 'Frightening Tune',
      key: 'qfjvZrIgJUjRXUUL',
      levels: [14],
      flag: 'FrighteningTune',
      textLine: 429,
      foundryLine: 112,
    }),
    buildPerformanceRow({
      id: 'inspire-heroics',
      name: 'Inspire Heroics',
      key: 'LIFTbzT5WDcsDn0O',
      levels: [15],
      flag: 'InspireHeroics',
      textLine: 430,
      foundryLine: 114,
    }),
    buildPerformanceRow({
      id: 'mass-suggestion',
      name: 'Mass Suggestion',
      key: 'FnfX1SMG9uzBghnB',
      levels: [18],
      flag: 'MassSuggestion',
      textLine: 431,
      foundryLine: 116,
    }),
    buildPerformanceRow({
      id: 'deadly-performance',
      name: 'Deadly Performance',
      key: 'RSoy0ll1sNno6mJD',
      levels: [20],
      flag: 'DeadlyPerformance',
      textLine: 432,
      foundryLine: 118,
    }),
  ],
  nonRows: {
    ClassSkills: classSkills,
    Proficiencies: proficiency,
    WeaponProficiencies: proficiency,
    ArmorProficiencies: proficiency,
    ArmoredCasting: {
      kind: 'casting',
      of: 'spells',
      text: `Armored casting is the bard spells' freedom from arcane spell failure in light armor and with a shield (${bardTable}:404), which PCGen grants as Bard ~ Armored Casting (${coreRulebookClassAbilities}:209); neither the table nor Foundry gives it a row.`,
    },
    Alignment: notOnTable(
      `The bard's alignment ("Any") is class text, not a table row; Bard_Archetype_Alignment marks it.`,
    ),
  },
  grantNonRows: {},
  // Dervish Dancer's misspelled frightening tune (uc_abilities_class.lst:385).
  typeAliases: { BardFrighteningPerformance: 'FrighteningTune' },
  foundryNonRows: [],
  defects: [
    {
      id: 'ungated-duplicate-grants',
      suffixes: [
        'ArmoredCasting',
        'BardicKnowledge',
        'CounterSong',
        'BardicPerformance',
        'Cantrips',
        'VersatilePerformance',
        'WellVersed',
        'LoreMaster',
        'JackOfAllTrades',
      ],
      text: `PCGen grants armored casting, bardic knowledge, countersong, bardic performance and cantrips at 1st, and versatile performance, well-versed, lore master and jack-of-all-trades at their levels, a second time with no Bard_CF_ gate (${coreRulebookGlobals}:151-159), besides their gated grants (${coreRulebookClassAbilities}:206-214): an archetype flag removing one of them removes nothing in PCGen. The mapper maps each by its name.`,
    },
    {
      id: 'versatile-performance-2',
      suffixes: ['VersatilePerformance2'],
      text: `PCGen gates the 2nd-level versatile performance on Bard_CF_VersatilePerformance2 at BardVersatilePerformanceLVL 2 (${coreRulebookClassAbilities}:535), a variable nothing binds, and never defines the flag (only a FACTDEF, roleplaying_game/core_rulebook/cr__datacontrols.lst:258; ${coreRulebookGlobals}:169-202): in PCGen it removes nothing. The mapper maps it by its name to the 2nd-level row.`,
    },
  ],
};

// --- Skald ------------------------------------------------------------------

const skaldFile = classFile('skald.G2SqFdNKFxbujzbH');
const skaldRow = classRows({
  recordPrefix: 'Skald',
  grantFile: advancedClassGuideClasses,
  foundryFile: skaldFile,
});
/** The PRD's Skald table (ACG p.49), whose 1st-level row is at :379. */
const skaldTable = 'advancedClassGuide/classes/skald.html';
const skaldTableRow = makeTableRowCiter({ page: skaldTable, firstRow: 379 });
const skaldVersatilePerformance = [2, 7, 12, 17];
const skaldRagePowers = [3, 6, 9, 12, 15, 18];
const spellKenning = [5, 11, 17];
const skaldLoreMaster = [7, 13, 19];
const skaldDamageReduction = [9, 14, 19];
/** Inspired rage's rows (skald.html:379-398, :458). */
const inspiredRage = [
  [1, 'Inspired Rage +1 (+2 Str/Con)'],
  [4, 'Inspired Rage +2'],
  [8, 'Inspired Rage +3 (+4 Str/Con)'],
  [12, 'Inspired Rage +4'],
  [16, 'Inspired Rage +5 (+6 Str/Con)'],
  [20, 'Inspired Rage +6'],
] as const;
/** A skald's raging song: a named subfeature of raging song (skald.html:452-467). */
const describeRagingSong = ({
  name,
  level,
  textLine,
}: {
  name: string;
  level: number;
  textLine: number;
}) =>
  `The class text gives ${name.toLowerCase()} at ${ordinal(level)} as one of the raging songs (${skaldTable}:${textLine}, under raging song, :452), so it is a subfeature of raging song.`;

const skald: ReviewedSchedule = {
  kind: 'reviewed',
  className: 'Skald',
  classKey: 'pf1/G2SqFdNKFxbujzbH',
  source: { book: 'Pathfinder RPG Advanced Class Guide', pages: '49–53' },
  printedTable: {
    status: 'reviewed',
    page: skaldTable,
    firstRow: 379,
    caption: 'Skald',
    unprinted: {
      spells: `The Spells per Day columns give the skald's spells from 1st (${skaldTableRow(1)}; ${skaldTable}:446).`,
      'exchange-spell': `The class text, not the Special column, gives the exchange at 5th and every 3 levels after, as part of the spells (${skaldTable}:449).`,
    },
  },
  foundryFile: skaldFile,
  acquisitionRecords: ['Skald'],
  metadataRecords: ['Skald'],
  flagNamespace: 'Skald',
  slug: 'skald',
  classSkillsRecord: 'Skald ~ Class Skills',
  skillRanksPerLevel: 4,
  skillRanksAt: at(skaldFile, 118),
  features: [
    skaldRow({
      id: 'bardic-knowledge',
      name: 'Bardic Knowledge',
      key: 'Pb9pxYrx6tS87euP',
      levels: [1],
      pcgenLine: 282,
      foundryLine: 79,
    }),
    skaldRow({
      id: 'cantrips',
      name: 'Cantrips',
      key: 'IPy4aqFYbOppaqKC',
      levels: [1],
      casting: true,
      pcgenLine: 283,
      foundryLine: 81,
    }),
    skaldRow({
      id: 'raging-song',
      name: 'Raging Song',
      key: 'sPqP7QFldieWEADi',
      levels: [1],
      pcgenLine: 284,
      foundryLine: 75,
    }),
    skaldRow({
      id: 'inspired-rage',
      name: 'Inspired Rage',
      key: '1HQUUhQhowqKfmCA',
      ...scheduleSteps({ steps: inspiredRage }),
      subfeatureOf: 'raging-song',
      pcgenLine: 285,
      foundryLine: 73,
      decision: `PCGen grants Skald ~ Inspired Rage once at 1 (${advancedClassGuideClasses}:285) and holds its bonuses in formulas, numbering none. The class text gives +2 Str and Con and +1 Will at 1st, the Will bonus 1 more at 4th and every 4 levels after and the Str and Con bonus 2 more at 8th and 16th (${skaldTable}:458), as the Skald table prints inspired rage +1 (+2 Str/Con) to +6 (${skaldTableRow(1)}, ${skaldTableRow(4)}, ${skaldTableRow(8)}, ${skaldTableRow(12)}, ${skaldTableRow(16)}, ${skaldTableRow(20)}). Rows read at 1, 4, 8, 12, 16 and 20. ${describeRagingSong({ name: 'Inspired Rage', level: 1, textLine: 458 })}`,
    }),
    skaldRow({
      id: 'scribe-scroll',
      name: 'Scribe Scroll',
      key: 'BS9WDbCy2Up3QHw9',
      levels: [1],
      pcgenLine: 286,
      foundryLine: 77,
    }),
    skaldRow({
      id: 'spells',
      name: 'Skald Spells',
      key: 'sRC2DqMqSDtX7ISa',
      levels: [1],
      whole: ['Spells'],
      casting: true,
      pcgenLine: null,
      foundryLine: 83,
      decision: describeCastingRow({ name: 'Skald Spells', foundryLevel: 1 }),
    }),
    skaldRow({
      id: 'versatile-performance',
      name: 'Versatile Performance',
      key: 'KQeYLQvYh1QgS0XI',
      levels: skaldVersatilePerformance,
      // "Versatile performance" at 2nd and every 5 levels after
      // (skald.html:380-395).
      incrementName: () => 'Versatile Performance',
      parts: byLevel('VersatilePerformance', skaldVersatilePerformance),
      increments: 'numbered',
      pcgenLine: 287,
      foundryLine: 85,
    }),
    skaldRow({
      id: 'well-versed',
      name: 'Well-Versed',
      key: 'wew6ophJrcab24m6',
      levels: [2],
      whole: ['WellVersed'],
      pcgenLine: 288,
      foundryLine: 87,
    }),
    skaldRow({
      id: 'rage-power',
      name: 'Rage Powers',
      key: 'i4GboHYSOofHEJ4i',
      levels: skaldRagePowers,
      // "Rage power" at 3rd and every 3 levels after (skald.html:381-396).
      incrementName: () => 'Rage Power',
      whole: ['RagePowers'],
      parts: byLevel('RagePower', skaldRagePowers),
      increments: 'numbered',
      pcgenLine: 289,
      foundryLine: 89,
    }),
    skaldRow({
      id: 'song-of-marching',
      name: 'Song of Marching',
      key: 'jR8RFYhHsjRzzmB0',
      levels: [3],
      subfeatureOf: 'raging-song',
      pcgenLine: 290,
      foundryLine: 91,
      decision: describeRagingSong({
        name: 'Song of Marching',
        level: 3,
        textLine: 461,
      }),
    }),
    skaldRow({
      id: 'uncanny-dodge',
      name: 'Uncanny Dodge',
      key: '7WaQxnVaaoL4AGr8',
      levels: [4],
      pcgenLine: 291,
      foundryLine: 93,
    }),
    skaldRow({
      id: 'spell-kenning',
      name: 'Spell Kenning',
      key: 'tlvQVJUUFUVQ92EH',
      ...scheduleSteps({
        steps: buildPerDaySteps({
          name: 'Spell Kenning',
          levels: spellKenning,
        }),
      }),
      parts: byLevel('SpellKenning', spellKenning),
      pcgenLine: 292,
      foundryLine: 97,
      acquisitionFormula: abilityFile('spell-kenning.tlvQVJUUFUVQ92EH', 35),
      decision: `PCGen grants Skald ~ Spell Kenning once at 5 (${advancedClassGuideClasses}:292) and defines Skald_CF_SpellKenning5, 11 and 17, named by class level, but gates nothing on them (defect spell-kenning-parts). The class text gives one use a day at 5th, two at 11th and three at 17th (${skaldTable}:487), as the Skald table prints spell kenning 1/day to 3/day (${skaldTableRow(5)}, ${skaldTableRow(11)}, ${skaldTableRow(17)}). Rows read at 5, 11 and 17.`,
    }),
    skaldRow({
      id: 'exchange-spell',
      name: 'Exchange Spell',
      key: '5lDEyC6WejFyTEho',
      levels: [5],
      whole: [],
      casting: true,
      pcgenLine: null,
      foundryLine: 95,
      decision: describeExchangeSpell({
        level: 5,
        file: `${skaldTable}:449`,
        text: 'the skald learns a new spell in place of one he knows at 5th and every 3 levels after',
      }),
    }),
    skaldRow({
      id: 'song-of-strength',
      name: 'Song of Strength',
      key: 'xqWYyijR7PxZGI69',
      levels: [6],
      subfeatureOf: 'raging-song',
      pcgenLine: 293,
      foundryLine: 99,
      decision: describeRagingSong({
        name: 'Song of Strength',
        level: 6,
        textLine: 463,
      }),
    }),
    skaldRow({
      id: 'lore-master',
      name: 'Lore Master',
      key: 'ptw7bHU3Z7HNj2qz',
      ...scheduleSteps({
        steps: buildPerDaySteps({
          name: 'Lore Master',
          levels: skaldLoreMaster,
        }),
      }),
      pcgenLine: 294,
      foundryLine: 101,
      acquisitionFormula: abilityFile('lore-master-ska.ptw7bHU3Z7HNj2qz', 37),
      decision: `PCGen grants Skald ~ Lore Master once at 7 (${advancedClassGuideClasses}:294) and numbers no later use. The class text gives one use a day at 7th, two at 13th and three at 19th (${skaldTable}:490), as the Skald table prints lore master 1/day to 3/day (${skaldTableRow(7)}, ${skaldTableRow(13)}, ${skaldTableRow(19)}). Rows read at 7, 13 and 19.`,
    }),
    skaldRow({
      id: 'improved-uncanny-dodge',
      name: 'Improved Uncanny Dodge',
      key: 'ZfnHhhTFQVo0Lj4P',
      levels: [8],
      pcgenLine: 295,
      foundryLine: 103,
    }),
    skaldRow({
      id: 'damage-reduction',
      name: 'Damage Reduction',
      key: 'kMjMAG6Gjs7unAz5',
      ...scheduleSteps({
        steps: buildDamageReductionSteps({
          name: 'DR',
          levels: skaldDamageReduction,
        }),
      }),
      pcgenLine: 296,
      foundryLine: 105,
      decision: `PCGen grants Skald ~ Damage Reduction once at 9 (${advancedClassGuideClasses}:296) and numbers no later point. The class text gives DR 1/— at 9th and 1 more at 14th and 19th (${skaldTable}:495), as the Skald table prints DR 1/— to 3/— (${skaldTableRow(9)}, ${skaldTableRow(14)}, ${skaldTableRow(19)}). Rows read at 9, 14 and 19.`,
    }),
    skaldRow({
      id: 'dirge-of-doom',
      name: 'Dirge of Doom',
      key: 'pmWnRksUzrKvNOvy',
      levels: [10],
      subfeatureOf: 'raging-song',
      pcgenLine: 297,
      foundryLine: 107,
      decision: describeRagingSong({
        name: 'Dirge of Doom',
        level: 10,
        textLine: 465,
      }),
    }),
    skaldRow({
      id: 'song-of-the-fallen',
      name: 'Song of the Fallen',
      key: 'CYOk7sUXkGbfRKPi',
      levels: [14],
      subfeatureOf: 'raging-song',
      pcgenLine: 298,
      foundryLine: 109,
      decision: describeRagingSong({
        name: 'Song of the Fallen',
        level: 14,
        textLine: 467,
      }),
    }),
    skaldRow({
      id: 'master-skald',
      name: 'Master Skald',
      key: 'q7aOR0jKvbkVHhyF',
      levels: [20],
      pcgenLine: 299,
      foundryLine: 111,
    }),
  ],
  nonRows: {
    ClassSkills: classSkills,
    Proficiencies: proficiency,
    WeaponProficiencies: proficiency,
    ArmorProficiencies: proficiency,
  },
  grantNonRows: {
    'Skald ~ Weapon and Armor Proficiency': proficiency,
  },
  typeAliases: {},
  foundryNonRows: [],
  defects: [
    {
      id: 'spell-kenning-parts',
      suffixes: ['SpellKenning5', 'SpellKenning11', 'SpellKenning17'],
      text: `PCGen defines Skald_CF_SpellKenning5, 11 and 17 (${advancedClassGuideGlobals}:518-520) but gates nothing on them: an archetype setting one (Herald of the Horn, ${advancedClassGuideAbilities}:4674) removes no use of spell kenning in PCGen. The mapper maps each by its name, the use a day gained at that level.`,
    },
  ],
};

// --- Bloodrager -------------------------------------------------------------

const bloodragerFile = classFile('bloodrager.E27lMw9YNOAjS009');
const bloodragerRow = classRows({
  recordPrefix: 'Bloodrager',
  grantFile: advancedClassGuideClasses,
  foundryFile: bloodragerFile,
});
/** The PRD's Bloodrager table (ACG p.16), whose 1st-level row is at :376. */
const bloodragerTable = 'advancedClassGuide/classes/bloodrager.html';
const bloodragerTableRow = makeTableRowCiter({
  page: bloodragerTable,
  firstRow: 376,
});
const bloodlinePowers = [1, 4, 8, 12, 16, 20];
const bloodlineFeats = [6, 9, 12, 15, 18];
const bloodlineSpells = [7, 10, 13, 16];

const bloodrager: ReviewedSchedule = {
  kind: 'reviewed',
  className: 'Bloodrager',
  classKey: 'pf1/E27lMw9YNOAjS009',
  source: { book: 'Pathfinder RPG Advanced Class Guide', pages: '15–22' },
  printedTable: {
    status: 'reviewed',
    page: bloodragerTable,
    firstRow: 376,
    caption: 'Bloodrager',
    unprinted: {
      spells: `The Spells per Day columns give the bloodrager's spells from 4th (${bloodragerTableRow(4)}; ${bloodragerTable}:462).`,
      'exchange-spell': `The class text, not the Special column, gives the exchange at 8th and every 3 levels after, as part of the spells (${bloodragerTable}:464).`,
    },
    alsoPrinted: {
      bloodline: [
        {
          level: 1,
          entry: 'bloodline power',
          text: `The 1st-level row prints bloodline and bloodline power (${bloodragerTableRow(1)}); the bloodline gives its first power at 1st (${bloodragerTable}:441), and Foundry's Bloodrager Bloodline holds both (bloodrager-bloodline.Aq9rx7oWgv7A7kiV.yaml).`,
        },
      ],
    },
  },
  foundryFile: bloodragerFile,
  acquisitionRecords: ['Bloodrager'],
  metadataRecords: ['Bloodrager'],
  flagNamespace: 'Bloodrager',
  slug: 'bloodrager',
  classSkillsRecord: 'Bloodrager ~ Class Skills',
  skillRanksPerLevel: 4,
  skillRanksAt: at(bloodragerFile, 95),
  features: [
    bloodragerRow({
      id: 'bloodline',
      name: 'Bloodline',
      key: 'Aq9rx7oWgv7A7kiV',
      levels: bloodlinePowers,
      // "Bloodline power" at 4th and every 4 levels after
      // (bloodrager.html:379-395).
      incrementName: (index) => (index === 0 ? 'Bloodline' : 'Bloodline Power'),
      whole: ['Bloodline', 'BloodlinePowers'],
      // By level: the power gained at that level, kept through each
      // bloodline's own variable (acg_abilities_class.lst:565-566). The
      // 1st-level power shares the Bloodline row (nonRows below).
      parts: byLevel('BloodlinePower', bloodlinePowers.slice(1)),
      pcgenName: 'Standard Bloodline',
      pcgenLine: 48,
      foundryLine: 58,
      decision: `PCGen grants Bloodrager ~ Standard Bloodline once at 1 (${advancedClassGuideClasses}:48) and defines Bloodrager_CF_BloodlinePower1, 4, 8, 12, 16 and 20 (${advancedClassGuideGlobals}:105-110), named by class level. Each bloodline binds them into its own variables, which gate its powers: Bloodrager_Aberrant_BloodlinePower4 holds 1 while Bloodrager_CF_BloodlinePower4 is unset (${advancedClassGuideAbilities}:566), and gates the aberrant bloodline's 4th-level power (:565), so an archetype setting one removes the power of that level; the 1st-level power shares the Bloodline row, so BloodlinePower1 is a held non-row. The class text gives a bloodline power at 1st, 4th and every 4 levels after (${bloodragerTable}:441), as the Bloodrager table prints (${bloodragerTableRow(1)}, ${bloodragerTableRow(4)}, ${bloodragerTableRow(8)}, ${bloodragerTableRow(12)}, ${bloodragerTableRow(16)}, ${bloodragerTableRow(20)}): the 1st-level power is the bloodline's row, each later one a row of its own.`,
    }),
    bloodragerRow({
      id: 'bloodrage',
      name: 'Bloodrage',
      key: '5op6M5xchCJNsYRt',
      levels: [1],
      pcgenLine: 49,
      foundryLine: 60,
    }),
    bloodragerRow({
      id: 'fast-movement',
      name: 'Fast Movement',
      key: '9EX00obqhGHcrOdp',
      levels: [1],
      pcgenLine: 50,
      foundryLine: 62,
    }),
    bloodragerRow({
      id: 'uncanny-dodge',
      name: 'Uncanny Dodge',
      key: '7WaQxnVaaoL4AGr8',
      levels: [2],
      pcgenName: 'Uncanny Dodge Tracker',
      pcgenLine: 51,
      foundryLine: 64,
      decision: `PCGen grants the Bloodrager ~ Uncanny Dodge Tracker on the class block's 2nd-level line with no Bloodrager_CF_ gate (${advancedClassGuideClasses}:51): the tracker, not the grant, reads Bloodrager_CF_UncannyDodge. The class text gives uncanny dodge at 2nd (${bloodragerTable}:453), as the Bloodrager table prints (${bloodragerTableRow(2)}) and Foundry links it.`,
    }),
    bloodragerRow({
      id: 'blood-sanctuary',
      name: 'Blood Sanctuary',
      key: 'xvBGDYUbsE4Ozean',
      levels: [3],
      pcgenLine: 52,
      foundryLine: 66,
    }),
    bloodragerRow({
      id: 'blood-casting',
      name: 'Blood Casting',
      key: 'HFab4vfATqdqnlSJ',
      levels: [4],
      pcgenLine: 53,
      foundryLine: 70,
    }),
    bloodragerRow({
      id: 'eschew-materials',
      name: 'Eschew Materials',
      key: 'vVkKDPniD09W5JgO',
      levels: [4],
      pcgenLine: 54,
      foundryLine: 72,
    }),
    bloodragerRow({
      id: 'spells',
      name: 'Bloodrager Spells',
      key: 'uomEu0NuSl6Q43fP',
      levels: [4],
      whole: ['Spells'],
      casting: true,
      pcgenName: 'Spells',
      pcgenLine: 55,
      foundryLine: 68,
    }),
    bloodragerRow({
      id: 'improved-uncanny-dodge',
      name: 'Improved Uncanny Dodge',
      key: 'ZfnHhhTFQVo0Lj4P',
      levels: [5],
      pcgenLine: 56,
      foundryLine: 74,
      decision: `PCGen grants Bloodrager ~ Improved Uncanny Dodge on the class block's 5th-level line behind "PREVAREQ:PREVAREQ:Bloodrager_CF_ImprovedUncannyDodge,0" (${advancedClassGuideClasses}:56), a malformed gate that names no flag (defect improved-uncanny-dodge-gate). The class text gives it at 5th (${bloodragerTable}:466), as the Bloodrager table prints (${bloodragerTableRow(5)}) and Foundry links it.`,
    }),
    bloodragerRow({
      id: 'bloodline-feat',
      name: 'Bloodline Feat',
      key: 'xxD5AbgfJ5OuzVld',
      levels: bloodlineFeats,
      // "Bloodline feat" at 6th and every 3 levels after
      // (bloodrager.html:381-393).
      incrementName: () => 'Bloodline Feat',
      whole: ['BloodlineFeats'],
      // Each feat, added while kept (acg_abilities_class.lst:369-373).
      parts: byLevel('BloodlineFeat', bloodlineFeats),
      increments: 'numbered',
      pcgenLine: null,
      foundryLine: 76,
      acquisitionFormula: abilityFile(
        'bloodline-feat-blo.xxD5AbgfJ5OuzVld',
        13,
      ),
      decision: `PCGen grants no bloodline feat row: the Bloodrager ~ Bloodline Tracker adds each feat while Bloodrager_CF_BloodlineFeat6, 9, 12, 15 or 18 is unset (${advancedClassGuideAbilities}:369-373), named by class level. The class text gives a bonus feat at 6th and every 3 levels after (${bloodragerTable}:442), as the Bloodrager table prints (${bloodragerTableRow(6)}, ${bloodragerTableRow(9)}, ${bloodragerTableRow(12)}, ${bloodragerTableRow(15)}, ${bloodragerTableRow(18)}) and Foundry links the 6th.`,
    }),
    bloodragerRow({
      id: 'bloodline-spell',
      name: 'Bloodline Spell',
      key: 'RJ66UHdnwJ7VuWFo',
      levels: bloodlineSpells,
      // "Bloodline spell" at 7th, 10th, 13th and 16th (bloodrager.html:382-391).
      incrementName: () => 'Bloodline Spell',
      // Enlightened Bloodrager's TYPE.BloodragerBonusSpells
      // (arca_abilities_class.lst:13) names them too.
      whole: ['BloodlineSpells', 'BloodlineSpell', 'BonusSpells'],
      parts: {
        // By spell level: the bloodline's 1st- to 4th-level spell, as the
        // bloodlines' bonus spells gate them (acg_abilities_class.lst:578).
        ...byOrder('BloodlineSpell', bloodlineSpells),
        // By class level, as the archetypes name them (Untouchable Rager,
        // acg_abilities_class.lst:4625).
        ...byLevel('BloodlineSpell', bloodlineSpells),
      },
      increments: 'numbered',
      casting: true,
      pcgenLine: null,
      foundryLine: 80,
      decision: `PCGen grants no bloodline spell row: each bloodline's bonus spells record adds its spell of level n while Bloodrager_CF_BloodlineSpell<n> is unset, at 7th, 10th, 13th and 16th (${advancedClassGuideAbilities}:578), numbered by spell level (note §2), and the archetypes name the same spells by class level (Bloodrager_Archetype_BloodlineSpell7, ${advancedClassGuideAbilities}:4625; defect bloodline-spell-flags). The class text gives a bloodline spell at 7th, 10th, 13th and 16th (${bloodragerTable}:443), as the Bloodrager table prints (${bloodragerTableRow(7)}, ${bloodragerTableRow(10)}, ${bloodragerTableRow(13)}, ${bloodragerTableRow(16)}) and Foundry links the 7th. The spells add to the spells known, so it is a casting row.`,
    }),
    bloodragerRow({
      id: 'damage-reduction',
      name: 'Damage Reduction',
      key: 'RENIeTVjWB7Mq6Mw',
      ...scheduleSteps({
        steps: buildDamageReductionSteps({
          name: 'Damage Reduction',
          levels: damageReduction,
        }),
      }),
      pcgenLine: 57,
      foundryLine: 78,
      decision: `PCGen grants Bloodrager ~ Damage Reduction once at 7 (${advancedClassGuideClasses}:57) and numbers no later point. The class text gives DR 1/— at 7th and 1 more at 10th and every 3 levels after (${bloodragerTable}:469), as the Bloodrager table prints damage reduction 1/— to 5/— (${bloodragerTableRow(7)}, ${bloodragerTableRow(10)}, ${bloodragerTableRow(13)}, ${bloodragerTableRow(16)}, ${bloodragerTableRow(19)}). Rows read at 7, 10, 13, 16 and 19.`,
    }),
    bloodragerRow({
      id: 'exchange-spell',
      name: 'Exchange Spell',
      key: 'XfN89DtlUrwHGNrp',
      levels: [8],
      whole: [],
      casting: true,
      pcgenLine: null,
      foundryLine: 82,
      decision: describeExchangeSpell({
        level: 8,
        file: `${bloodragerTable}:464`,
        text: 'the bloodrager learns a new spell in place of one he knows at 8th and every 3 levels after',
      }),
    }),
    bloodragerRow({
      id: 'greater-bloodrage',
      name: 'Greater Bloodrage',
      key: 'FsOPunvM3kGqD32i',
      levels: [11],
      pcgenLine: 58,
      foundryLine: 84,
    }),
    bloodragerRow({
      id: 'indomitable-will',
      name: 'Indomitable Will',
      key: 'Q3x319WbNkCssApD',
      levels: [14],
      pcgenLine: 59,
      foundryLine: 86,
    }),
    bloodragerRow({
      id: 'tireless-bloodrage',
      name: 'Tireless Bloodrage',
      key: 'vETLfsVXQo1qG2PX',
      levels: [17],
      pcgenLine: 60,
      foundryLine: 88,
    }),
    bloodragerRow({
      id: 'mighty-bloodrage',
      name: 'Mighty Bloodrage',
      key: 'NoJMNxuXDTHzPMcm',
      levels: [20],
      pcgenLine: 61,
      foundryLine: 90,
    }),
  ],
  nonRows: {
    ClassSkills: classSkills,
    ArmorProficiency: proficiency,
    WeaponProficiencies: proficiency,
    BloodlinePower1: sharedRow({
      of: 'bloodline',
      level: 1,
      text: `Bloodrager_CF_BloodlinePower1 removes only the bloodline's 1st-level power (each bloodline's Bloodrager_<Bloodline>_BloodlinePower1, ${advancedClassGuideAbilities}:565-566) and keeps the bloodline, which PCGen grants apart (Standard Bloodline, ${advancedClassGuideClasses}:48). The schedule's 1st-level row is the Bloodline itself, which carries both (Foundry's Bloodrager Bloodline; ${bloodragerTableRow(1)} prints bloodline and bloodline power), so no row removes the power alone: what the archetype replaces is read from its text.`,
    }),
  },
  grantNonRows: {
    'Bloodrager ~ Weapon and Armor Proficiency': proficiency,
  },
  typeAliases: {},
  foundryNonRows: [],
  defects: [
    {
      id: 'improved-uncanny-dodge-gate',
      suffixes: ['ImprovedUncannyDodge'],
      text: `PCGen gates the bloodrager's improved uncanny dodge on "PREVAREQ:PREVAREQ:Bloodrager_CF_ImprovedUncannyDodge,0" (${advancedClassGuideClasses}:56), which names no flag: an archetype setting Bloodrager_CF_ImprovedUncannyDodge (Metamagic Rager, ${advancedClassGuideAbilities}:4620) removes nothing in PCGen. The mapper maps it by its name.`,
    },
    {
      id: 'bloodline-spell-flags',
      suffixes: [
        'BloodlineSpell',
        'BloodlineSpells',
        'BonusSpells',
        ...bloodlineSpells.map((_, index) => `BloodlineSpell${index + 1}`),
        ...bloodlineSpells.map((level) => `BloodlineSpell${level}`),
      ],
      text: `PCGen gates the bloodline spells on Bloodrager_CF_BloodlineSpell1 to 4, by spell level (${advancedClassGuideAbilities}:578), which it never defines, while the archetypes mark them by class level, Bloodrager_Archetype_BloodlineSpell7 to 16 (${advancedClassGuideAbilities}:4625), names nothing gates: no archetype flag removes a bloodline spell in PCGen. The mapper maps both spellings by name to the 7th-, 10th-, 13th- and 16th-level rows.`,
    },
  ],
};

/** The P7c schedules, by class name. */
export const ragePerformanceSchedules = {
  Bard: bard,
  Barbarian: barbarian,
  'Barbarian (Unchained)': unchainedBarbarian,
  Skald: skald,
  Bloodrager: bloodrager,
} as const satisfies Readonly<Record<string, ReviewedSchedule>>;
