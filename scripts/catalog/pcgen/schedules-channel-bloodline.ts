import {
  abilityFile,
  at,
  byLevel,
  byOrder,
  citeRows,
  classFile,
  classRows,
  classSkills,
  describeCastingRow,
  makeTableRowCiter,
  notOnTable,
  odds,
  proficiency,
  scheduleSteps,
  sharedRow,
  type ReviewedSchedule,
} from './schedule-model';

/**
 * #771A: the reviewed schedules of the Cleric and Sorcerer, the Core
 * Rulebook half of P7f's launch subset (research note 771-p7f-refresh,
 * refreshing 716-p7-rules §3 P7f; the model: `schedule-model.ts`).
 *
 * - A row is an entry of the table's Special column. The spells, which the
 *   Spells per Day columns give, the cleric's spontaneous casting and
 *   alignment restriction and the sorcerer's spell exchange are printed
 *   nowhere in it; they and the orisons and cantrips carry the class's
 *   casting, so they are `casting` rows: touching one is a #422 review item.
 * - The cleric's domains add a domain spell slot of each level the cleric
 *   can cast, as the wizard's arcane school adds a school slot, so they are
 *   a casting row; the sorcerer's bloodline spells add to her spells known,
 *   as the bloodrager's do (`schedules-rage-performance.ts`).
 * - Channel energy's dice are formula-held: PCGen defines a flag for each
 *   die and gates nothing on them, as the skald's spell kenning
 *   (`schedules-rage-performance.ts`). The sorcerer's bloodline powers,
 *   spells and feats are numbered: the powers and feats by class level, the
 *   spells by spell level.
 */

const coreRulebookAbilities =
  'roleplaying_game/core_rulebook/cr_abilities_class.lst';
const coreRulebookGlobals =
  'roleplaying_game/core_rulebook/cr_abilities_globalvar.lst';
const advancedClassGuideAbilities =
  'roleplaying_game/advanced_class_guide/acg_abilities_class.lst';
const innerSeaMagicAbilities =
  'campaign_setting/inner_sea_magic/ism_abilities_class.lst';
const ultimateMagicAbilities =
  'roleplaying_game/ultimate_magic/um_abilities_class.lst';
const crb = 'Pathfinder RPG Core Rulebook';

// --- Cleric -----------------------------------------------------------------

const clericFile = classFile('cleric.SjFqQceVeVBzBwgn');
const clericRow = classRows({
  recordPrefix: 'Cleric',
  grantFile: coreRulebookAbilities,
  foundryFile: clericFile,
});
/** The PRD's Table: Cleric (CRB p.39), whose 1st-level row is at :360. */
const clericTable = 'coreRulebook/classes/cleric.html';
const clericTableRow = makeTableRowCiter({ page: clericTable, firstRow: 360 });
const channelEnergyLevels = odds;

const cleric: ReviewedSchedule = {
  kind: 'reviewed',
  className: 'Cleric',
  classKey: 'pf1/SjFqQceVeVBzBwgn',
  // Foundry's pages (cleric.SjFqQceVeVBzBwgn.yaml:93).
  source: { book: crb, pages: '38–48' },
  printedTable: {
    status: 'reviewed',
    page: clericTable,
    firstRow: 360,
    caption: 'Cleric',
    unprinted: {
      'alignment-spells': `The Special column prints none of the cleric's casting; the class text gives the alignment restriction with the spells (${clericTable}:385, :399).`,
      spells: `The Spells per Day columns give the cleric's spells from 1st (${clericTableRow(1)}; ${clericTable}:385).`,
      'spontaneous-casting': `The Special column prints none of the cleric's casting; the class text gives spontaneous casting with the spells (${clericTable}:396).`,
    },
  },
  foundryFile: clericFile,
  acquisitionRecords: ['Cleric'],
  metadataRecords: ['Cleric'],
  flagNamespace: 'Cleric',
  slug: 'cleric',
  classSkillsRecord: 'Class Skills ~ Cleric',
  skillRanksPerLevel: 2,
  skillRanksAt: at(clericFile, 90),
  features: [
    clericRow({
      id: 'aura',
      name: 'Aura',
      key: 'Wkv124hVPATT35bm',
      levels: [1],
      pcgenLine: 217,
      foundryLine: 73,
      decision: `PCGen grants Cleric ~ Aura at 1 with no Cleric_CF_ gate (${coreRulebookAbilities}:217) and defines no Cleric_CF_Aura (${coreRulebookGlobals}:260-281), so no archetype flag removes it in PCGen; Foundry links Aura at 1, the level Table: Cleric prints it (${clericTableRow(1)}).`,
    }),
    clericRow({
      id: 'channel-energy',
      name: 'Channel Energy',
      key: 'kXXz1lO4i7CibHJ9',
      ...scheduleSteps({
        steps: channelEnergyLevels.map(
          (level, index) => [level, `Channel Energy ${index + 1}d6`] as const,
        ),
      }),
      // By order: the nth die, as PCGen defines them
      // (cr_abilities_globalvar.lst:272-281), gating nothing.
      parts: byOrder('ChannelEnergy', channelEnergyLevels),
      pcgenLine: 218,
      foundryLine: 69,
      acquisitionFormula: abilityFile('channel-energy.kXXz1lO4i7CibHJ9', 19),
      decision: `PCGen grants Cleric ~ Channel Energy once at 1 (${coreRulebookAbilities}:218) and holds its dice in a formula, (ClericChannelEnergyLVL+1)/2 with ClericChannelEnergyLVL the cleric level (${coreRulebookAbilities}:572, :574-575); it defines Cleric_CF_ChannelEnergy1 to 10, one per die by order, but gates nothing on them (defect channel-energy-steps). The class text gives 1d6 plus 1d6 for every two cleric levels beyond 1st (${clericTable}:391), as Table: Cleric prints channel energy 1d6 to 10d6 (${citeRows({ tableRow: clericTableRow, levels: channelEnergyLevels })}). Rows read at 1, 3 … 19.`,
    }),
    clericRow({
      id: 'alignment-spells',
      name: 'Chaotic, Evil, Good, and Lawful Spells',
      key: 'exdHrqciehozr5SD',
      levels: [1],
      whole: [],
      casting: true,
      pcgenLine: null,
      foundryLine: 77,
      decision: describeCastingRow({
        name: 'Chaotic, Evil, Good, and Lawful Spells',
        foundryLevel: 1,
      }),
    }),
    clericRow({
      id: 'spells',
      name: 'Cleric Spells',
      key: 'W4PGylYL7ghRfy5G',
      levels: [1],
      // Cleric_CF_Spellcasting is defined and bridged and gates nothing
      // (defect cleric-unwired-flags).
      whole: ['Spells', 'Spellcasting'],
      casting: true,
      pcgenLine: null,
      foundryLine: 83,
      decision: describeCastingRow({ name: 'Cleric Spells', foundryLevel: 1 }),
    }),
    clericRow({
      id: 'domains',
      name: 'Domains',
      key: 'zrUJt7YpAJkf2NC6',
      levels: [1],
      casting: true,
      pcgenLine: 221,
      foundryLine: 71,
      decision: `PCGen grants Cleric ~ Domains at 1 with no Cleric_CF_ gate (${coreRulebookAbilities}:221): Cleric_CF_Domains is defined and bridged but removes nothing (defect cleric-unwired-flags). Foundry links Domains at 1, the level Table: Cleric prints them (${clericTableRow(1)}). A cleric chooses two domains (${clericTable}:392), each a domain spell slot of each level she can cast (:393), as the wizard's arcane school adds a school slot: a casting row, touching it a #422 review item.`,
    }),
    clericRow({
      id: 'orisons',
      name: 'Orisons',
      key: 'RaFl9SpbAlXqhsDk',
      levels: [1],
      casting: true,
      pcgenLine: 219,
      foundryLine: 81,
    }),
    clericRow({
      id: 'spontaneous-casting',
      name: 'Spontaneous Casting',
      key: 'kx2ZfV2wjlAZgQ6E',
      levels: [1],
      casting: true,
      pcgenLine: 220,
      foundryLine: 75,
    }),
  ],
  nonRows: {
    ClassSkills: classSkills,
    // Defined and bridged, gating nothing (defect cleric-unwired-flags): the
    // weapon and armor proficiency record is granted with no flag
    // (cr_abilities_class.lst:216).
    Proficiencies: proficiency,
    ArmorProficiencies: proficiency,
    WeaponProficiencies: proficiency,
    ArmorProficiency: proficiency,
    WeaponProficiency: proficiency,
  },
  grantNonRows: {},
  typeAliases: {},
  foundryNonRows: [
    {
      externalKey: 'pf1/EvrFDqZDbbFS4Avb',
      level: 1,
      text: `Bonus Languages is class text (${clericTable}:400), not a row of Table: Cleric (${clericTableRow(1)}), as the druid’s is; PCGen grants none.`,
    },
  ],
  defects: [
    {
      id: 'channel-energy-steps',
      suffixes: channelEnergyLevels.map(
        (_, index) => `ChannelEnergy${index + 1}`,
      ),
      text: `PCGen defines Cleric_CF_ChannelEnergy1 to 10 (${coreRulebookGlobals}:272-281) and bridges each FACT (:299-308), but gates nothing on them: only the whole Cleric_CF_ChannelEnergy gates the grant (${coreRulebookAbilities}:218; TYPE bridge ${coreRulebookGlobals}:310), and the dice stay (ClericChannelEnergyLVL+1)/2 (${coreRulebookAbilities}:574-575), so an archetype setting one removes no die in PCGen. Their numbering is by order, the third die at 5th; Ecclesitheurge sets Cleric_CF_ChannelEnergy3 (${advancedClassGuideAbilities}:4633, TYPE :3014) for "the increase to channel energy gained at 3rd level" (advancedClassGuide/classOptions/cleric.html:359), the second die by order. The mapper maps each flag by order; which die an archetype's text replaces is read from its text.`,
    },
    {
      id: 'cleric-unwired-flags',
      suffixes: [
        'Domains',
        'Spellcasting',
        'SkillRanks',
        'Proficiencies',
        'ArmorProficiencies',
        'WeaponProficiencies',
        'ArmorProficiency',
        'WeaponProficiency',
      ],
      text: `PCGen defines and bridges Cleric_CF_Domains, Spellcasting, SkillRanks and the proficiency flags (${coreRulebookGlobals}:263-271, :287-298), but nothing gates them: the domains (${coreRulebookAbilities}:221) and the weapon and armor proficiency record (:216) are granted with no flag. An archetype setting one (Cleric_CF_Domains, ${innerSeaMagicAbilities}:442; Cleric_CF_SkillRanks and Domains, ${ultimateMagicAbilities}:2661; the proficiency flags, ${advancedClassGuideAbilities}:4633) removes nothing in PCGen. The mapper maps the domains and spellcasting flags by name to their rows and the proficiency flags to prose; the skill ranks flag names no row. What the archetype replaces is read from its text.`,
    },
  ],
};

// --- Sorcerer ---------------------------------------------------------------

const sorcererFile = classFile('sorcerer.AoWSbnuTSGIxmv61');
const sorcererRow = classRows({
  recordPrefix: 'Sorcerer',
  grantFile: coreRulebookAbilities,
  foundryFile: sorcererFile,
});
/** The PRD's Table: Sorcerer (CRB p.71), whose 1st-level row is at :359. */
const sorcererTable = 'coreRulebook/classes/sorcerer.html';
const sorcererTableRow = makeTableRowCiter({
  page: sorcererTable,
  firstRow: 359,
});
const bloodlinePowers = [1, 3, 9, 15, 20];
const bloodlineSpells = [3, 5, 7, 9, 11, 13, 15, 17, 19];
const bloodlineFeats = [7, 13, 19];

const sorcerer: ReviewedSchedule = {
  kind: 'reviewed',
  className: 'Sorcerer',
  classKey: 'pf1/AoWSbnuTSGIxmv61',
  // Foundry's pages (sorcerer.AoWSbnuTSGIxmv61.yaml:77).
  source: { book: crb, pages: '70–77' },
  printedTable: {
    status: 'reviewed',
    page: sorcererTable,
    firstRow: 359,
    caption: 'Sorcerer',
    unprinted: {
      spells: `The Spells per Day columns give the sorcerer's spells from 1st (${sorcererTableRow(1)}; ${sorcererTable}:410).`,
      'exchange-spell': `The class text, not the Special column, gives the exchange at 4th and every even level after, as part of the spells (${sorcererTable}:413).`,
    },
  },
  foundryFile: sorcererFile,
  acquisitionRecords: ['Sorcerer'],
  metadataRecords: ['Sorcerer'],
  flagNamespace: 'Sorcerer',
  slug: 'sorcerer',
  classSkillsRecord: 'Sorcerer ~ Class Skills',
  skillRanksPerLevel: 2,
  skillRanksAt: at(sorcererFile, 74),
  features: [
    sorcererRow({
      id: 'bloodline',
      name: 'Bloodline',
      key: 'F5mCXQR9VZfKfpTH',
      levels: bloodlinePowers,
      // "Bloodline power" at 1st, 3rd, 9th, 15th and 20th
      // (sorcerer.html:359-378); the table never prints "bloodline".
      incrementName: () => 'Bloodline Power',
      whole: ['Bloodline'],
      // By level: the power gained at that level, kept through each
      // bloodline's own variable (cr_abilities_class.lst:2334). The
      // 1st-level power shares the Bloodline row (nonRows below).
      parts: byLevel('BloodlinePower', bloodlinePowers.slice(1)),
      increments: 'numbered',
      pcgenName: 'Standard Bloodline',
      pcgenLine: 308,
      foundryLine: 59,
      decision: `PCGen grants Sorcerer ~ Standard Bloodline once at 1 (${coreRulebookAbilities}:308) and defines Sorcerer_CF_BloodlinePower1, 3, 9, 15 and 20 (${coreRulebookGlobals}:985-989), named by class level. Each bloodline binds them into its own variables, which gate its powers: Sorcerer_Aberrant_BloodlinePower3 holds 1 while Sorcerer_CF_BloodlinePower3 is unset (${coreRulebookAbilities}:2334) and gates the aberrant bloodline's 3rd-level power (:2333), so an archetype setting one removes the power of that level, as the bloodrager's bloodline powers. The class text gives bloodline powers at 1st and higher levels (${sorcererTable}:415), as Table: Sorcerer prints bloodline power (${citeRows({ tableRow: sorcererTableRow, levels: bloodlinePowers })}): the 1st-level power is the bloodline's row, so BloodlinePower1 is a held non-row, and each later one a row of its own.`,
    }),
    sorcererRow({
      id: 'cantrips',
      name: 'Cantrips',
      key: 'IPy4aqFYbOppaqKC',
      levels: [1],
      casting: true,
      pcgenLine: 309,
      foundryLine: 61,
    }),
    sorcererRow({
      id: 'eschew-materials',
      name: 'Eschew Materials',
      key: 'vVkKDPniD09W5JgO',
      levels: [1],
      pcgenLine: 310,
      foundryLine: 57,
    }),
    sorcererRow({
      id: 'spells',
      name: 'Sorcerer Spells',
      key: 'yaL9DS7Eu5OmsxnV',
      levels: [1],
      whole: ['Spells'],
      casting: true,
      pcgenName: 'Spells',
      pcgenLine: 307,
      foundryLine: 63,
    }),
    sorcererRow({
      id: 'bloodline-spell',
      name: 'Bloodline Spell',
      key: 'qlQxKPARGGdOgNWm',
      levels: bloodlineSpells,
      // "Bloodline spell" at 3rd and every two levels after
      // (sorcerer.html:361-377).
      incrementName: () => 'Bloodline Spell',
      whole: ['BloodlineSpells'],
      // By spell level: the bloodline's 1st- to 9th-level spell, as each
      // bloodline's bonus spells gate them (cr_abilities_class.lst:2338).
      parts: byOrder('BloodlineSpell', bloodlineSpells),
      increments: 'numbered',
      casting: true,
      pcgenLine: null,
      foundryLine: 65,
      decision: `PCGen grants no bloodline spell row: each bloodline's bonus spells record adds its spell of level n while Sorcerer_CF_BloodlineSpell<n> is unset, from BloodlineCasterLVL 3, 5 … 19 (aberrant, ${coreRulebookAbilities}:2338; defined ${coreRulebookGlobals}:993-1001), numbered by spell level, so BloodlineSpell2 is the 5th-level row. The class text gives a bloodline spell at 3rd and every two levels after (${sorcererTable}:416), as Table: Sorcerer prints (${citeRows({ tableRow: sorcererTableRow, levels: bloodlineSpells })}) and Foundry links the 3rd. The spells add to the spells known, so it is a casting row.`,
    }),
    sorcererRow({
      id: 'exchange-spell',
      name: 'Exchange Spell',
      key: 'dopWa3n4mgTGpTYi',
      levels: [4],
      whole: [],
      casting: true,
      pcgenLine: null,
      foundryLine: 67,
      decision: `${describeCastingRow({ name: 'Exchange Spell', foundryLevel: 4 })} The table has no row for it: the class text lets the sorcerer exchange a spell known at 4th and every even level after (${sorcererTable}:413).`,
    }),
    sorcererRow({
      id: 'bloodline-feat',
      name: 'Bloodline Feat',
      key: 'W1KWAZxUNxfCv8rG',
      levels: bloodlineFeats,
      // "Bloodline feat" at 7th, 13th and 19th (sorcerer.html:365, :371,
      // :377).
      incrementName: () => 'Bloodline Feat',
      whole: ['BloodlineFeats'],
      parts: {
        // By class level, as the Bloodline Tracker gates them
        // (cr_abilities_class.lst:1711-1713).
        ...byLevel('BloodlineFeat', bloodlineFeats),
        // The archetypes' spelling (Tattooed Sorcerer,
        // ism_abilities_class.lst:452), which nothing defines or reads.
        ...byLevel('BloodlineBonusFeat', bloodlineFeats),
      },
      increments: 'numbered',
      pcgenLine: null,
      foundryLine: 69,
      acquisitionFormula: abilityFile(
        'bloodline-feat-sor.W1KWAZxUNxfCv8rG',
        13,
      ),
      decision: `PCGen grants no bloodline feat row: the Bloodline Tracker counts the feats, (BloodlineFeatProgression-1)/6 with the progression the sorcerer level, and takes one off while Sorcerer_CF_BloodlineFeat7, 13 or 19 is set (${coreRulebookAbilities}:1707-1713), named by class level but never defined (defect bloodline-feat-flags). The class text gives a bonus feat at 7th and every six levels after (${sorcererTable}:417), as Table: Sorcerer prints (${citeRows({ tableRow: sorcererTableRow, levels: bloodlineFeats })}) and Foundry links the 7th.`,
    }),
  ],
  nonRows: {
    ClassSkills: classSkills,
    WeaponProficiencies: proficiency,
    BloodlinePower1: sharedRow({
      of: 'bloodline',
      level: 1,
      text: `Sorcerer_CF_BloodlinePower1 removes only the bloodline's 1st-level power (each bloodline's Sorcerer_<Bloodline>_BloodlinePower1, ${coreRulebookAbilities}:2333-2334) and keeps the bloodline, which PCGen grants apart (Standard Bloodline, :308). The schedule's 1st-level row is the Bloodline itself, which carries both (Foundry's Sorcerer Bloodline; ${sorcererTableRow(1)} prints bloodline power), so no row removes the power alone: what the archetype replaces is read from its text.`,
    }),
    // Unlike the bloodrager's (`schedules-rage-performance.ts`, where it
    // names the whole bloodline), the sorcerer's powers flag names no row:
    // Eldritch Scrapper sets it beside the 1st-, 9th- and 15th-level powers
    // and replaces only those (advancedClassGuide/classOptions/sorcerer.html:354).
    BloodlinePowers: notOnTable(
      `Sorcerer_CF_BloodlinePowers gates only each bloodline's descriptive Bloodline Powers record (aberrant, ${coreRulebookAbilities}:2342, bound at :2334), never a power or the bloodline: each power is gated on its own level's flag. An archetype setting it (Eldritch Scrapper, beside BloodlinePower1, 9 and 15, ${advancedClassGuideAbilities}:4685; Mongrel Mage, beside the whole bloodline, :4686) removes no row in PCGen; what its text replaces is read from it.`,
    ),
  },
  grantNonRows: {},
  typeAliases: {},
  foundryNonRows: [],
  defects: [
    {
      id: 'bloodline-feat-flags',
      suffixes: [
        ...bloodlineFeats.map((level) => `BloodlineFeat${level}`),
        ...bloodlineFeats.map((level) => `BloodlineBonusFeat${level}`),
        'BloodlineFeats',
      ],
      text: `PCGen gates the bloodline feats on Sorcerer_CF_BloodlineFeat7, 13 and 19 (${coreRulebookAbilities}:1711-1713) but never defines them (${coreRulebookGlobals}:973-1001) or bridges a FACT to them (:1003-1022); the archetypes spell them Sorcerer_CF_BloodlineBonusFeat7, 13 and 19 (Tattooed Sorcerer, ${innerSeaMagicAbilities}:452), which nothing defines or reads; and Sorcerer_CF_BloodlineFeats, defined and bridged (${coreRulebookGlobals}:990, :1011), gates nothing (Mongrel Mage, ${advancedClassGuideAbilities}:4686). No archetype flag removes a bloodline feat in PCGen. The mapper maps each spelling by name to the 7th-, 13th- and 19th-level rows, and the whole flag to the feature.`,
    },
    {
      id: 'bloodline-spell-numbering',
      suffixes: bloodlineSpells.map((_, index) => `BloodlineSpell${index + 1}`),
      text: `PCGen gates each bloodline's spells on Sorcerer_CF_BloodlineSpell1 to 9 by spell level (aberrant, ${coreRulebookAbilities}:2338), so BloodlineSpell2 is the 5th-level row. Razmiran Priest is inconsistent: its archetype sets BloodlineSpell3 and 5 (${innerSeaMagicAbilities}:451), while its Lay Healer sets BloodlineSpell2 and 3 with the TYPEs SorcererBloodlineSpellLvl3 and Lvl5 (:342), which no bridge resolves; the PRD capture holds no Inner Sea Magic text, so the reading rests on PCGen's descriptions. The mapper maps each flag by spell level; which spell an archetype replaces is read from its text.`,
    },
  ],
};

/** The #771A schedules, by class name. */
export const channelBloodlineSchedules = {
  Cleric: cleric,
  Sorcerer: sorcerer,
} as const satisfies Readonly<Record<string, ReviewedSchedule>>;
