// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { representativeArchetypeCatalog } from '../../convex/lib/representativeArchetypeCatalog';
import {
  representativeClassCatalog,
  representativeClassFeatureSchedules,
} from '../../convex/lib/representativeClassCatalog';
import { representativeSpellcastingSchedules } from '../../convex/lib/representativeSpellcastingCatalog';
import { parseIdentityLedger } from '../../scripts/catalog/everythingpath-identities';
import ledger from '../../scripts/catalog/everythingpath-identities.json';
import { stackingConflicts } from '../../scripts/catalog/pcgen/archetypes';
import { buildEffectiveView } from '../../scripts/catalog/pcgen/effective';
import {
  assignPcgenIdentities,
  pcgenBookFacts,
} from '../../scripts/catalog/pcgen/identities';
import { inventoryPcgen } from '../../scripts/catalog/pcgen/inventory';
import {
  allIncrementKeys,
  incrementEntries,
  scheduleRows,
} from '../../scripts/catalog/pcgen/schedules';
import { pcgen716JudgmentArcanaFiles } from '../fixtures/pcgen-716/judgment-arcana-files';
import {
  bindArchetypeMapper,
  brief,
  comparePrintedColumns,
  comparePrintedRows,
  listIncrementNames,
  listReplacements,
  pinnedLine,
  planArchetypeBatch,
  readArchetypeDetail,
  readInventoryClass,
  readPrdText,
  scheduleChecks,
  summarizeItems,
} from './pcgen-716-schedules';
import { readPcgenFixtureTree } from './pcgen-716-tree';
import { readPinned } from './pinned-sources';

// #771B (research note 771-p7f-refresh, the Oracle and Witch of the P7f
// launch subset, 716-p7-rules §3 and §4): the reviewed schedules of the
// Oracle and Witch, checked against the pinned PCGen, Foundry and PRD files.
// #772's PCGen inputs already hold the Advanced Player's Guide's records,
// globals and class blocks and the mapped archetypes' books, so the slice
// adds none. Every scenario reads pinned files, never committed curation
// state.

const tree = await readPcgenFixtureTree(pcgen716JudgmentArcanaFiles);
const view = buildEffectiveView(tree);
const reservedKeys = allIncrementKeys();
const inventory = inventoryPcgen(tree);
const identities = assignPcgenIdentities({
  inventory,
  view,
  ledger: parseIdentityLedger(ledger, { reservedKeys }),
  books: pcgenBookFacts(await readPinned('pf1', 'module/registry/sources.mjs')),
  reservedKeys,
});

const classNames = ['Oracle', 'Witch'] as const;
type ClassName = (typeof classNames)[number];

const { schedule, derive, compare, levelOf, countGrantKinds } = scheduleChecks({
  tree,
  view,
});

const advancedPlayersGuideAbilities =
  'roleplaying_game/advanced_players_guide/apg_abilities_class.lst';
const advancedPlayersGuideGlobals =
  'roleplaying_game/advanced_players_guide/apg_abilities_globalvar.lst';
const advancedPlayersGuideClasses =
  'roleplaying_game/advanced_players_guide/apg_classes.lst';
const mysterySpellLevels = [2, 4, 6, 8, 10, 12, 14, 16, 18];
const revelationLevels = [1, 3, 7, 11, 15, 19];
const hexLevels = [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20];

describe('the #771B schedules’ numbered variables (note Q1, Q3)', () => {
  it('gives every numbered variable its explicit level', () => {
    // APG p.42: a mystery spell at 2nd and every two levels after
    // (oracle.html:413), each mystery's spell gated by class level
    // (apg_abilities_class.lst:517), unlike the sorcerer's spell levels.
    expect(levelOf('Oracle', 'MysterySpell2')).toEqual(['mystery', 2]);
    expect(levelOf('Oracle', 'MysterySpell18')).toEqual(['mystery', 18]);
    expect(levelOf('Oracle', 'MysterySpell3')).toEqual(['unknown']);
    expect(levelOf('Oracle', 'OraclesMystery')).toEqual(['mystery', null]);
    expect(levelOf('Oracle', 'Mystery')).toEqual(['mystery', null]);
    // A revelation at 1st, 3rd and every four levels after (oracle.html:422),
    // gated by class level (apg_abilities_class.lst:480).
    expect(levelOf('Oracle', 'Revelation1')).toEqual(['revelation', 1]);
    expect(levelOf('Oracle', 'Revelation3')).toEqual(['revelation', 3]);
    expect(levelOf('Oracle', 'Revelation19')).toEqual(['revelation', 19]);
    expect(levelOf('Oracle', 'Revelation5')).toEqual(['unknown']);
    // PCGen defines Revelation20, not 19; Shigenjo's text gives it the
    // final revelation (defect revelation-19-20).
    expect(levelOf('Oracle', 'Revelation20')).toEqual([
      'final-revelation',
      null,
    ]);
    expect(levelOf('Oracle', 'FinalRevelation')).toEqual([
      'final-revelation',
      null,
    ]);
    expect(levelOf('Oracle', 'OraclesCurse')).toEqual(['oracles-curse', null]);
    // The mystery's class skills (oracle.html:412).
    expect(levelOf('Oracle', 'MysterySkills')).toEqual(['classSkills']);
    // APG p.65: a hex at 1st, 2nd and every two levels after (witch.html:415),
    // each kept by class level (apg_abilities_class.lst:868-878). The 10th-
    // and 18th-level hexes are hex rows, not the major and grand hex rows.
    expect(levelOf('Witch', 'Hex1')).toEqual(['hex', 1]);
    expect(levelOf('Witch', 'Hex2')).toEqual(['hex', 2]);
    expect(levelOf('Witch', 'Hex10')).toEqual(['hex', 10]);
    expect(levelOf('Witch', 'Hex18')).toEqual(['hex', 18]);
    expect(levelOf('Witch', 'Hex3')).toEqual(['unknown']);
    // Dimensional Occultist's lowercase spelling folds to the same part
    // (pfsfg_abilities_class.lst:136).
    expect(levelOf('Witch', 'hex8')).toEqual(['hex', 8]);
    expect(levelOf('Witch', 'Hex')).toEqual(['hex', null]);
    expect(levelOf('Witch', 'Hexes')).toEqual(['hex', null]);
    expect(levelOf('Witch', 'Familiar')).toEqual(['witchs-familiar', null]);
    expect(levelOf('Witch', 'PatronSpell')).toEqual(['patron-spells', null]);
    // The patron spells are no rows: each is a casting change of the patron
    // spells row.
    expect(levelOf('Witch', 'PatronSpell2')).toEqual(['casting']);
    expect(levelOf('Witch', 'PatronSpell18')).toEqual(['casting']);
    // The patron is the patron spells' pick (apg_abilities_class.lst:855).
    expect(levelOf('Witch', 'Patron')).toEqual(['option']);
    expect(levelOf('Witch', 'FamiliarTouchSpells')).toEqual(['notOnTable']);
    expect(levelOf('Witch', 'ClassSkills')).toEqual(['classSkills']);
  });

  it('reads the mystery spell, revelation and hex gates as PCGen levels them', () => {
    const oracle = derive('Oracle');
    // apg_abilities_class.lst:480: the mystery level counts each revelation
    // while its flag is unset, Revelation19 at Oracle 19.
    expect(oracle.gatedParts.get('Revelation19')).toMatchObject({
      at: `${advancedPlayersGuideAbilities}:480`,
      polarity: 'kept',
    });
    expect(oracle.gatedParts.get('MysterySpell2')?.polarity).toBe('kept');
    expect(oracle.gatedParts.has('Revelation20')).toBe(false);
    // Each hex pool is kept while its flag is unset.
    expect(derive('Witch').gatedParts.get('Hex10')).toMatchObject({
      at: `${advancedPlayersGuideAbilities}:873`,
      polarity: 'kept',
    });
  });
});

describe('each #771B schedule against the PRD’s class table (owner decision 8)', () => {
  it('prints every row at its level, with its label, in the cited table row', async () => {
    for (const className of classNames) {
      const { printedTable } = schedule(className);
      if (printedTable?.status !== 'reviewed')
        throw new Error(`${className} has no reviewed table.`);
      const rows = await comparePrintedRows(schedule(className));
      expect(
        rows.map(({ level, line }) => [level, line]),
        className,
      ).toEqual(
        Array.from({ length: 20 }, (_, index) => [
          index + 1,
          printedTable.firstRow + index,
        ]),
      );
      for (const row of rows)
        expect(row.schedule, `${className} ${row.level}`).toEqual(row.table);
    }
    // Table: Oracle, 1st level: "Mystery, oracle's curse, orisons,
    // revelation"; 2nd: "Mystery spell"; 20th: "Final revelation".
    const oracleRows = await comparePrintedRows(schedule('Oracle'));
    expect(oracleRows[0]?.table).toEqual([
      'mystery',
      "oracle's curse",
      'orisons',
      'revelation',
    ]);
    expect(oracleRows[1]?.table).toEqual(['mystery spell']);
    expect(oracleRows[19]?.table).toEqual(['final revelation']);
    // Table: Witch, 1st level: "Cantrips, hex, witch's familiar"; 10th:
    // "Hex, major hex"; 18th: "Hex, grand hex".
    const witchRows = await comparePrintedRows(schedule('Witch'));
    expect(witchRows[0]?.table).toEqual([
      'cantrips',
      'hex',
      "witch's familiar",
    ]);
    expect(witchRows[9]?.table).toEqual(['hex', 'major hex']);
    expect(witchRows[17]?.table).toEqual(['grand hex', 'hex']);
    expect(witchRows[2]?.table).toEqual([]);
  });

  it('cites the casting the Special column doesn’t print as unprinted, and prints no value column', async () => {
    const readUnprinted = (className: ClassName) => {
      const { printedTable } = schedule(className);
      if (printedTable?.status !== 'reviewed')
        throw new Error(`${className} has no reviewed table.`);
      return Object.keys(printedTable.unprinted);
    };
    // ORA:406, :410; orisons are printed at 1st (ORA:359).
    expect(readUnprinted('Oracle')).toEqual(['spells', 'exchange-spell']);
    // WIT:408-411, :522-523; cantrips are printed at 1st (WIT:378).
    expect(readUnprinted('Witch')).toEqual(['patron-spells', 'spells']);
    for (const className of classNames)
      expect(await comparePrintedColumns(schedule(className))).toEqual([]);
  });
});

describe('PCGen’s schedule against each table (note Q7)', () => {
  it('settles every difference between PCGen, Foundry and the table with a cited decision or defect', async () => {
    for (const className of classNames)
      expect(
        (await compare(className)).filter(({ settledBy }) => !settledBy),
        className,
      ).toEqual([]);
    // APG p.42: the orisons are granted with no flag; each mystery grants its
    // final revelation on the class's flag; PCGen grants no revelation,
    // spells, exchange or final revelation row, and gates the 19th-level
    // revelation on a flag it never defines.
    expect(brief(await compare('Oracle'))).toEqual([
      ['ungatedGrant', 'orisons', 'decision:orisons'],
      ...Array.from({ length: 15 }, () => [
        'nestedGrant',
        'final-revelation',
        'decision:final-revelation',
      ]),
      ['foundryOnly', 'revelation', 'decision:revelation'],
      ['undefinedPart', 'revelation', 'revelation-19-20'],
      ['foundryOnly', 'spells', 'decision:spells'],
      ['foundryOnly', 'exchange-spell', 'decision:exchange-spell'],
      ['foundryOnly', 'final-revelation', 'decision:final-revelation'],
    ]);
    // APG p.65: the familiar touch spells grant is no table row; the patron
    // spells are granted with no flag; PCGen grants no spells, major hex or
    // grand hex row.
    expect(brief(await compare('Witch'))).toEqual([
      ['nonRow', 'FamiliarTouchSpells', 'nonRow:FamiliarTouchSpells'],
      ['ungatedGrant', 'patron-spells', 'decision:patron-spells'],
      ['foundryOnly', 'spells', 'decision:spells'],
      ['foundryOnly', 'major-hex', 'decision:major-hex'],
      ['foundryOnly', 'grand-hex', 'decision:grand-hex'],
    ]);
  });

  it('records the 19th-level revelation gate on a flag PCGen never defines, which defines and bridges the 20th (defect revelation-19-20)', async () => {
    expect(
      await pinnedLine('pcgen', `${advancedPlayersGuideGlobals}:447`),
    ).toBe('CATEGORY=Class|Oracle.MOD\t\tDEFINE:Oracle_CF_Revelation20|0');
    const { defined } = derive('Oracle');
    expect(defined.has('Revelation19')).toBe(false);
    expect(defined.has('Revelation20')).toBe(true);
    expect(
      schedule('Oracle').defects.find(({ id }) => id === 'revelation-19-20')
        ?.suffixes,
    ).toEqual(['Revelation19', 'Revelation20']);
  });

  it('records the witch’s hex, patron spell and hexes flags that PCGen holds apart from the table as defects, never as behaviour', async () => {
    // apg_abilities_class.lst:853: the major and grand hexes are eligibility,
    // (WitchLVL>=10) and (WitchLVL>=18), with no flag.
    const hex = await pinnedLine(
      'pcgen',
      `${advancedPlayersGuideAbilities}:853`,
    );
    expect(hex).toContain('BONUS:VAR|WitchMajorHexQualify|(WitchLVL>=10)');
    expect(hex).toContain('BONUS:VAR|WitchGrandHexQualify|(WitchLVL>=18)');
    const defects = Object.fromEntries(
      schedule('Witch').defects.map(({ id, suffixes }) => [id, suffixes]),
    );
    expect(defects).toEqual({
      'major-grand-hex': ['Hex10', 'Hex18'],
      'patron-spell-flags': [
        'PatronSpell',
        ...mysterySpellLevels.map((level) => `PatronSpell${level}`),
      ],
      'hexes-type': ['Hexes'],
    });
    // The APG patrons gate their spells on the old-style TYPE, never on the
    // flag (Agility, :947).
    expect(
      await pinnedLine('pcgen', `${advancedPlayersGuideAbilities}:947`),
    ).toContain(
      'PREMULT:2,[PREVARGTEQ:WitchPatronLVL,2],[!PREABILITY:1,CATEGORY=Archetype,TYPE.WitchPatronSpell2]',
    );
    const { defined, typeBridges } = derive('Witch');
    expect(defined.has('PatronSpell')).toBe(true);
    // TYPE.WitchHexes writes Witch_CF_Hexes, which nothing defines
    // (apg_abilities_globalvar.lst:617).
    expect(typeBridges.get('WitchHexes')).toBe('Hexes');
    expect(defined.has('Hexes')).toBe(false);
  });
});

describe('P7-0’s grant kinds in the #771B classes (note Q7)', () => {
  it('reads the oracle’s curse and mystery, its ungated orisons and nested final revelations, and the witch’s gated grants and ungated patron spells', () => {
    // apg_abilities_globalvar.lst:72-74, :551-555; the final revelations of
    // the APG's ten mysteries and the tree's five others
    // (apg_abilities_class.lst:517-535).
    expect(
      Object.fromEntries(
        classNames.map((name) => [name, countGrantKinds(name)]),
      ),
    ).toEqual({ Oracle: [2, 1, 15], Witch: [4, 1, 0] });
  });
});

describe('formula rows, skill ranks and class skills (note Q1, Q2, Q6)', () => {
  it('holds no feature’s later rows in the schedule alone: every repeating feature is numbered', async () => {
    for (const className of classNames) {
      const findings = await compare(className);
      expect(
        findings
          .filter(({ kind }) =>
            ['formulaIncrement', 'ungatedParts'].includes(kind),
          )
          .map(({ feature }) => feature),
        className,
      ).toEqual([]);
      const { gatedParts } = derive(className);
      for (const feature of schedule(className).features) {
        expect(feature.acquisitionFormula, feature.id).toBeUndefined();
        if (feature.levels.length > 1)
          expect(
            Object.keys(feature.parts).some((part) => gatedParts.has(part)),
            `${className} ${feature.id}`,
          ).toBe(true);
      }
    }
  });

  it('gives each class the skill ranks per level of its table, as Foundry records them', async () => {
    // Oracle 4, witch 2 ranks + Int modifier (ORA:353, WIT:358).
    const ranks = await Promise.all(
      classNames.map(async (className) => {
        const { skillRanksPerLevel, skillRanksAt, foundryFile } =
          schedule(className);
        expect(skillRanksAt.split(':')[0]).toBe(foundryFile);
        expect(await pinnedLine('pf1', skillRanksAt)).toBe(
          `  skillsPerLevel: ${skillRanksPerLevel}`,
        );
        return skillRanksPerLevel;
      }),
    );
    expect(ranks).toEqual([4, 2]);
  });

  it('reads the oracle’s class skills from no record: PCGen lists them on the class block alone', async () => {
    // apg_classes.lst:109, the nine skills ORA:352 prints; no ability record
    // holds them, as the witch's does (apg_abilities_class.lst:848).
    expect(schedule('Oracle').classSkillsRecord).toBeNull();
    expect(
      await pinnedLine('pcgen', `${advancedPlayersGuideClasses}:109`),
    ).toBe(
      'CLASS:Oracle\tSTARTSKILLPTS:4\tCSKILL:TYPE=Craft|Diplomacy|Heal|Knowledge (History)|Knowledge (Planes)|Knowledge (Religion)|TYPE=Profession|Sense Motive|Spellcraft',
    );
    expect(schedule('Witch').classSkillsRecord).toBe('Witch ~ Class Skills');
    expect(
      await pinnedLine('pcgen', `${advancedPlayersGuideAbilities}:848`),
    ).toContain('KEY:Witch ~ Class Skills');
  });
});

describe('per-increment identities (note Q1, item 7)', () => {
  it('repeats no key in either class’s featuresByLevel, and keys every later row by its slug', () => {
    for (const className of classNames) {
      const reviewed = schedule(className);
      const keys = scheduleRows(reviewed).map(({ externalKey }) => externalKey);
      expect(new Set(keys).size, className).toBe(keys.length);
      for (const entry of incrementEntries(reviewed)) {
        expect(entry.externalKey).toMatch(
          new RegExp(`^everythingpath/${reviewed.slug}-[a-z-]+-\\d+$`),
        );
        expect(entry.modifiers).toEqual([]);
      }
    }
    expect(
      Object.fromEntries(
        classNames.map((className) => [
          className,
          [
            schedule(className).features.length,
            incrementEntries(schedule(className)).length,
            scheduleRows(schedule(className)).length,
          ],
        ]),
      ),
    ).toEqual({
      // 7 features; mystery spells 9, revelations 5.
      Oracle: [7, 14, 21],
      // 7 features; hexes 10.
      Witch: [7, 10, 17],
    });
  });

  it('names the later rows by their table labels', () => {
    expect(listIncrementNames(schedule('Oracle'))).toEqual({
      ...Object.fromEntries(
        mysterySpellLevels.map((level) => [
          `everythingpath/oracle-mystery-${level}`,
          'Mystery Spell',
        ]),
      ),
      ...Object.fromEntries(
        revelationLevels
          .slice(1)
          .map((level) => [
            `everythingpath/oracle-revelation-${level}`,
            'Revelation',
          ]),
      ),
    });
    expect(listIncrementNames(schedule('Witch'))).toEqual(
      Object.fromEntries(
        hexLevels
          .slice(1)
          .map((level) => [`everythingpath/witch-hex-${level}`, 'Hex']),
      ),
    );
  });

  it('has no feature schedule seed to equal, and agrees with the witch seed’s ranks and class skills', async () => {
    // convex/lib/representativeClassCatalog.ts: no oracle seed, and the
    // witch seed carries no features (note Q6).
    for (const identity of ['oracle', 'witch']) {
      expect(representativeClassFeatureSchedules).not.toHaveProperty(identity);
      expect(representativeSpellcastingSchedules).not.toHaveProperty(identity);
    }
    expect(
      representativeClassCatalog.find(
        ({ ruleIdentity }) => ruleIdentity === schedule('Oracle').slug,
      ),
    ).toBeUndefined();
    const witch = schedule('Witch');
    const seed = representativeClassCatalog.find(
      ({ ruleIdentity }) => ruleIdentity === witch.slug,
    );
    if (seed?.detail.kind !== 'class') throw new Error('No witch seed.');
    expect(seed.detail.featuresByLevel).toEqual([]);
    expect(seed.detail.skillRanksPerLevel).toBe(witch.skillRanksPerLevel);
    // WIT:356: eleven class skills; Foundry adds Artistry and Lore
    // (witch.RC4D4WFT5kRKkdqp.yaml:15-28).
    const foundry = await readPinned('pf1', witch.foundryFile);
    expect(
      [...foundry.matchAll(/^ {4}([a-z]{3}): true$/gm)]
        .map(([, id]) => `skill.${id}`)
        .filter((id) => id !== 'skill.art' && id !== 'skill.lor'),
    ).toEqual(seed.detail.classSkills);
    expect(seed.detail.classSkills).toHaveLength(11);
  });
});

// One published archetype per class through the mapper (note Q5), each in a
// sub-batch of at most 100 keys (plan Appendix G), each mapped on the class
// the inventory gives it.
const { mapPublishedArchetype } = bindArchetypeMapper({
  tree,
  view,
  identities,
});
const mapInventoryArchetype = (archetype: string) =>
  mapPublishedArchetype({
    className: readInventoryClass({ inventory, archetype }),
    archetype,
  });

describe('the #771B archetypes through the mapper (note Q2, Q5)', () => {
  it('assigns every oracle and witch archetype of the tree to its class', () => {
    for (const className of classNames) {
      const owned = inventory.owners.filter(({ record }) =>
        record.locator.key.startsWith(`${className} Archetype ~ `),
      );
      expect(owned.length, className).toBeGreaterThan(0);
      for (const { record, className: assigned } of owned)
        expect(assigned, record.locator.key).toBe(className);
    }
  });

  it('counts the casting rows of each class', () => {
    // The mystery adds its spells to the spells known (ORA:413); the
    // familiar stores the witch's spells (WIT:448), as the wizard's
    // spellbook holds his.
    expect(
      schedule('Oracle')
        .features.filter(({ casting }) => casting)
        .map(({ id }) => id),
    ).toEqual(['mystery', 'orisons', 'spells', 'exchange-spell']);
    expect(
      schedule('Witch')
        .features.filter(({ casting }) => casting)
        .map(({ id }) => id),
    ).toEqual(['witchs-familiar', 'cantrips', 'patron-spells', 'spells']);
  });

  it('Oracle: Shigenjo replaces five mystery spells, the 7th- and 15th-level revelations and the final revelation; its class skills read against no base list', async () => {
    // ARG p.164 (advancedRaceGuide/featuredRaces/tengus.html:390-405). Its
    // FACTs (arg_abilities_class.lst:1118) remove the 2nd-, 4th-, 8th-, 12th-
    // and 14th-level mystery spells, the 7th- and 15th-level revelations
    // and Revelation20. Its text also replaces the 16th-level mystery spell
    // (:395), which no flag names, and lets it learn quivering palm "in
    // place of a revelation" at 15th (:404), where PCGen removes the
    // revelation; Revelation20 is its final revelation (:405; defect
    // revelation-19-20). Each is a review item, not behaviour.
    const page = await readPrdText({
      page: 'advancedRaceGuide/featuredRaces/tengus.html',
      from: 392,
      to: 405,
    });
    expect(page).toContain(
      'A shigenjo adds Survival to her list of class skills in place of Diplomacy.',
    );
    expect(page).toContain(
      "These bonus spells replace the shigenjo's mystery bonus spells at these levels.",
    );
    expect(page).toContain(
      "This ability replaces the shigenjo's 7th-level revelation.",
    );
    const archetype = 'Oracle Archetype ~ Shigenjo';
    expect(readInventoryClass({ inventory, archetype })).toBe('Oracle');
    const mapping = mapInventoryArchetype(archetype);
    expect(listReplacements(mapping)).toEqual([
      [2, 'everythingpath/oracle-mystery-2', 'part'],
      [4, 'everythingpath/oracle-mystery-4', 'part'],
      [8, 'everythingpath/oracle-mystery-8', 'part'],
      [12, 'everythingpath/oracle-mystery-12', 'part'],
      [14, 'everythingpath/oracle-mystery-14', 'part'],
      [7, 'everythingpath/oracle-revelation-7', 'part'],
      [15, 'everythingpath/oracle-revelation-15', 'part'],
      [20, 'pf1/8vF0UoXribL1DOG2', 'whole'],
    ]);
    expect(summarizeItems(mapping)).toEqual([
      ['uncheckedCasting', 'casting:mystery'],
      ['conflict', 'defect:revelation-19-20'],
      ['unmatchedReplacement', 'classSkillsBase'],
    ]);
    expect(listReplacements(mapping).filter(([level]) => level === 16)).toEqual(
      [],
    );
    // Its class skills record clears the list and grants the oracle's nine
    // with four more (arg_abilities_class.lst:749), where the text trades
    // Diplomacy for Survival: read against no base list, all eleven are
    // additions, held for review on the fields the item names.
    const detail = readArchetypeDetail(mapping);
    expect(detail.classSkillsAdded).toHaveLength(11);
    expect(detail.classSkillsAdded).toContain('skill.dip');
    expect(
      mapping.items.find(({ id }) => id === 'classSkillsBase')?.fields,
    ).toEqual(['detail.classSkillsAdded', 'detail.classSkillsRemoved']);
    expect(planArchetypeBatch({ className: 'Oracle', mapping })).toEqual([11]);
  });

  it('Witch: Bouda replaces the familiar and the 1st- and 10th-level hexes; the 10th is held on the major hex defect', async () => {
    // Monster Codex p.92 (monsterCodex/gnolls.html:368-378): fetish
    // "replaces the familiar class feature"; hyena shape "replaces the major
    // hex granted at 10th level", while PCGen sets Witch_CF_Hex10
    // (mc_abilities_class.lst:151), the 10th-level hex.
    const page = await readPrdText({
      page: 'monsterCodex/gnolls.html',
      from: 371,
      to: 378,
    });
    expect(page).toContain('This ability replaces the familiar class feature.');
    expect(page).toContain(
      'This ability replaces the major hex granted at 10th level.',
    );
    const archetype = 'Witch Archetype ~ Bouda';
    expect(readInventoryClass({ inventory, archetype })).toBe('Witch');
    const mapping = mapInventoryArchetype(archetype);
    expect(listReplacements(mapping)).toEqual([
      [1, 'pf1/3d9Rgw40NV8ohRtf', 'whole'],
      [1, 'pf1/GBkIhC1Bpp2MAD4e', 'part'],
      [10, 'everythingpath/witch-hex-10', 'part'],
    ]);
    expect(summarizeItems(mapping)).toEqual([
      ['uncheckedCasting', 'casting:witchs-familiar'],
      ['conflict', 'defect:major-grand-hex'],
    ]);
    expect(planArchetypeBatch({ className: 'Witch', mapping })).toEqual([4]);
  });
});

describe('the witch #422 scan (note Q5)', () => {
  const seducer = mapInventoryArchetype('Witch Archetype ~ Seducer');
  const leyLineGuardian = mapInventoryArchetype(
    'Witch Archetype ~ Ley Line Guardian',
  );
  const mountainWitch = mapInventoryArchetype(
    'Witch Archetype ~ Mountain Witch',
  );
  const getSeedFeatureChanges = (ruleIdentity: string) => {
    const seed = representativeArchetypeCatalog.find(
      (entry) => entry.ruleIdentity === ruleIdentity,
    );
    if (seed?.detail?.kind !== 'archetype')
      throw new Error(`No ${ruleIdentity} seed.`);
    return seed.detail.featureChanges ?? [];
  };

  it('Seducer: replaces the 1st-, 6th- and 8th-level hexes and touches the familiar and spells by its archetype marks alone', () => {
    // LotFW p.16 has no PRD page: its text rests on PCGen's descriptions
    // and the seed (lotfw_abilities_class.lst:294-300). The seed alters
    // the 1st-level hex (Fey Charm); PCGen removes it.
    expect(listReplacements(seducer)).toEqual([
      [1, 'pf1/GBkIhC1Bpp2MAD4e', 'part'],
      [6, 'everythingpath/witch-hex-6', 'part'],
      [8, 'everythingpath/witch-hex-8', 'part'],
    ]);
    expect(summarizeItems(seducer)).toEqual([
      ['unmatchedReplacement', 'alters:witchs-familiar'],
      ['unmatchedReplacement', 'alters:spells'],
      ['uncheckedCasting', 'casting:witchs-familiar'],
      ['uncheckedCasting', 'casting:spells'],
    ]);
    // The seed names only the hexes (representativeArchetypeCatalog.ts,
    // hexes(1, 6, 8)); the familiar and spells wholes come from PCGen's
    // Witch_Archetype_ marks alone: review items, not a seed rewrite.
    expect(getSeedFeatureChanges('witch-seducer')).toEqual(
      [1, 6, 8].map((level) => ({
        featureIdentity: 'witch-hex',
        scope: 'part',
        part: String(level),
      })),
    );
    expect(
      (readArchetypeDetail(seducer).featureChanges ?? [])
        .filter(({ scope }) => scope === 'whole')
        .map(({ externalKey }) => externalKey),
    ).toEqual(['pf1/3d9Rgw40NV8ohRtf', 'pf1/K0Ls0j080ptiPvTC']);
  });

  it('Ley Line Guardian: replaces the familiar and the 1st- and 8th-level hexes, and alters the spells, as its seed names them', async () => {
    // OA p.125 (occultAdventures/archetypes/other.html:615-619).
    const page = await readPrdText({
      page: 'occultAdventures/archetypes/other.html',
      from: 615,
      to: 619,
    });
    expect(page).toContain("This ability alters the witch's spellcasting.");
    expect(page).toContain(
      'This ability replaces familiar and the hexes gained at 1st and 8th levels.',
    );
    expect(listReplacements(leyLineGuardian)).toEqual([
      [1, 'pf1/3d9Rgw40NV8ohRtf', 'whole'],
      [1, 'pf1/GBkIhC1Bpp2MAD4e', 'part'],
      [8, 'everythingpath/witch-hex-8', 'part'],
    ]);
    // Its category TYPE is spelled "Witch Archetype"
    // (oa_abilities_class.lst:1918), which the mapper skips only unspaced, as
    // #771A's sorcerer archetypes': it names no feature and stays for review,
    // and its stacking guard leaves it out.
    expect(summarizeItems(leyLineGuardian)).toEqual([
      ['unmatchedReplacement', 'alters:spells'],
      ['uncheckedCasting', 'casting:spells'],
      ['uncheckedCasting', 'casting:witchs-familiar'],
      ['unmatchedReplacement', 'unknown: Archetype'],
      ['conflict', 'stackingGuard'],
    ]);
    // The mapping changes what the seed names: the familiar and spells
    // whole, the 1st- and 8th-level hexes.
    expect(getSeedFeatureChanges('witch-ley-line-guardian')).toEqual([
      { featureIdentity: 'witch-familiar', scope: 'whole' },
      { featureIdentity: 'witch-hex', scope: 'part', part: '1' },
      { featureIdentity: 'witch-hex', scope: 'part', part: '8' },
      { featureIdentity: 'witch-spells', scope: 'whole' },
    ]);
    expect(
      (readArchetypeDetail(leyLineGuardian).featureChanges ?? []).map(
        (change) => [
          change.externalKey,
          change.scope === 'whole' ? 'whole' : change.classLevel,
        ],
      ),
    ).toEqual(
      expect.arrayContaining([
        ['pf1/3d9Rgw40NV8ohRtf', 'whole'],
        ['pf1/GBkIhC1Bpp2MAD4e', 1],
        ['pf1/GBkIhC1Bpp2MAD4e', 8],
        ['pf1/K0Ls0j080ptiPvTC', 'whole'],
      ]),
    );
    expect(readArchetypeDetail(leyLineGuardian).featureChanges).toHaveLength(4);
  });

  it('Mountain Witch: replaces the 2nd-level hex alone; the seed’s alteration of hex and its patron spells are text the flags miss', async () => {
    // ACG p.132 (advancedClassGuide/classOptions/witch.html:360-362).
    const page = await readPrdText({
      page: 'advancedClassGuide/classOptions/witch.html',
      from: 360,
      to: 362,
    });
    expect(page).toContain('This ability alters hex.');
    expect(page).toContain(
      'A mountain witch replaces some of her patron spells with the following',
    );
    expect(page).toContain(
      'This ability replaces the hex gained at 2nd level.',
    );
    expect(listReplacements(mountainWitch)).toEqual([
      [2, 'everythingpath/witch-hex-2', 'part'],
    ]);
    // Its stacking guard names the whole hex (Witch_Archetype_Hex,
    // acg_abilities_class.lst:4703), as the seed's alteration does, while its
    // flags remove the 2nd-level hex alone: the guard's difference is the
    // only item. Its TYPE CF_WitchHex (:4023) resolves to nothing, and no
    // flag marks the patron spells its Spells record replaces (:4032).
    expect(summarizeItems(mountainWitch)).toEqual([
      ['conflict', 'stackingGuard'],
    ]);
    expect(readArchetypeDetail(mountainWitch).featureChanges).toEqual([
      { externalKey: 'pf1/GBkIhC1Bpp2MAD4e', scope: 'part', classLevel: 2 },
    ]);
    // The seed alters the whole hex (AWIT:361) and replaces the 2nd-level
    // one; the mapping keeps only the part, and raises no casting item for
    // the patron spells its text changes (:360): review items, not a seed
    // rewrite.
    expect(getSeedFeatureChanges('witch-mountain-witch')).toEqual([
      { featureIdentity: 'witch-hex', scope: 'whole' },
      { featureIdentity: 'witch-hex', scope: 'part', part: '2' },
    ]);
  });

  it('keeps the published conflict pairs: Seducer × Ley Line Guardian on the 1st- and 8th-level hexes, the familiar and the spells', () => {
    expect(
      stackingConflicts([seducer, leyLineGuardian]).conflicts.map(
        ({ feature, part }) => [feature, part],
      ),
    ).toEqual([
      ['pf1/3d9Rgw40NV8ohRtf', null],
      ['pf1/K0Ls0j080ptiPvTC', null],
      ['pf1/GBkIhC1Bpp2MAD4e', 1],
      ['pf1/GBkIhC1Bpp2MAD4e', 8],
    ]);
  });
});
