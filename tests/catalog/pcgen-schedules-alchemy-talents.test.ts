// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { representativeArchetypeCatalog } from '../../convex/lib/representativeArchetypeCatalog';
import { representativeClassFeatureSchedules } from '../../convex/lib/representativeClassCatalog';
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
  foundryAssociations,
  incrementEntries,
  scheduleRows,
} from '../../scripts/catalog/pcgen/schedules';
import { prdClassExclusions } from '../../scripts/catalog/prd-coverage';
import { pcgen716AlchemyTalentFiles } from '../fixtures/pcgen-716/alchemy-talent-files';
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

// #716 P7e (research note 716-p7-rules §1, §3, §4, §5): the reviewed
// schedules of the Alchemist, Investigator, Slayer and Vigilante, checked
// against the pinned PCGen, Foundry and PRD files, and the investigator's
// #422 scan. Every scenario reads pinned files, never committed curation
// state.

const tree = await readPcgenFixtureTree(pcgen716AlchemyTalentFiles);
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

const classNames = [
  'Alchemist',
  'Investigator',
  'Slayer',
  'Vigilante',
] as const;
type ClassName = (typeof classNames)[number];
/** The classes the PRD prints a table for: the vigilante's is pending (`not-in-prd`). */
const printedClassNames = ['Alchemist', 'Investigator', 'Slayer'] as const;

const { schedule, derive, compare, levelOf, countGrantKinds } = scheduleChecks({
  tree,
  view,
});

describe('the P7e schedules’ numbered variables (#716 P7e, note §5.1)', () => {
  it('gives every numbered variable its explicit level: by class level, and poison resistance by value', () => {
    // APG p.31 and ACG p.33: poison resistance +2 at 2nd, +4 at 5th, +6 at
    // 8th. PCGen names each step by its bonus (apg_abilities_class.lst:95;
    // acg_abilities_class.lst:1255-1257), so PoisonResistance4 is the 5th.
    for (const className of ['Alchemist', 'Investigator'] as const) {
      expect(levelOf(className, 'PoisonResistance2')).toEqual([
        'poison-resistance',
        2,
      ]);
      expect(levelOf(className, 'PoisonResistance4')).toEqual([
        'poison-resistance',
        5,
      ]);
      expect(levelOf(className, 'PoisonResistance6')).toEqual([
        'poison-resistance',
        8,
      ]);
      expect(levelOf(className, 'PoisonResistance8')).toEqual(['unknown']);
      // Immunity is a row of its own (APG p.31 at 10th; ACG p.33 at 11th).
      expect(levelOf(className, 'PoisonImmunity')).toEqual([
        'poison-immunity',
        null,
      ]);
    }
    // APG p.27-28: discoveries at 2nd to 18th, bomb dice at odd levels
    // (apg_abilities_class.lst:156-164, :166-174).
    expect(levelOf('Alchemist', 'Discovery2')).toEqual(['discovery', 2]);
    expect(levelOf('Alchemist', 'Discovery18')).toEqual(['discovery', 18]);
    expect(levelOf('Alchemist', 'BombDamage3')).toEqual(['bomb', 3]);
    expect(levelOf('Alchemist', 'BombDamage19')).toEqual(['bomb', 19]);
    expect(levelOf('Alchemist', 'BombReduction')).toEqual(['notOnTable']);
    // ACG p.32: talents at 3rd and every 2 levels after, gated inside
    // PREMULT (acg_abilities_class.lst:1260-1268).
    expect(levelOf('Investigator', 'Talent3')).toEqual([
      'investigator-talent',
      3,
    ]);
    expect(levelOf('Investigator', 'Talent19')).toEqual([
      'investigator-talent',
      19,
    ]);
    expect(levelOf('Investigator', 'Talent2')).toEqual(['unknown']);
    expect(levelOf('Investigator', 'TrapSense')).toEqual(['trap-sense', null]);
    // ACG p.54: talents at 2nd and every 2 levels after
    // (acg_abilities_class.lst:1819-1828).
    expect(levelOf('Slayer', 'Talent2')).toEqual(['slayer-talent', 2]);
    expect(levelOf('Slayer', 'Talent20')).toEqual(['slayer-talent', 20]);
    expect(levelOf('Slayer', 'Talents')).toEqual(['slayer-talent', null]);
    expect(levelOf('Slayer', 'AdvancedTalents')).toEqual([
      'advanced-talents',
      null,
    ]);
    // UI: social talents at odd levels, vigilante talents at even ones
    // (ui_abilities_class.lst:1185-1205).
    expect(levelOf('Vigilante', 'SocialTalent1')).toEqual(['social-talent', 1]);
    expect(levelOf('Vigilante', 'SocialTalent19')).toEqual([
      'social-talent',
      19,
    ]);
    expect(levelOf('Vigilante', 'VigilanteTalent20')).toEqual([
      'vigilante-talent',
      20,
    ]);
    expect(levelOf('Vigilante', 'SocialTalent2')).toEqual(['unknown']);
    // Not table rows: the specializations are options, the saves columns.
    expect(levelOf('Vigilante', 'Stalker')).toEqual(['option']);
    expect(levelOf('Vigilante', 'FortSaves')).toEqual(['notOnTable']);
    expect(levelOf('Slayer', 'ShieldProficiency')).toEqual(['proficiency']);
  });

  it('reads the poison resistance gates at their class levels: the investigator’s keep a step, the alchemist’s are inverted', async () => {
    // acg_abilities_class.lst:1256: kept while the flag is unset.
    expect(derive('Investigator').gatedParts.get('PoisonResistance4')).toEqual({
      at: 'roleplaying_game/advanced_class_guide/acg_abilities_class.lst:1256',
      level: 5,
      polarity: 'kept',
    });
    // apg_abilities_class.lst:95: the step is added under PREMULT:1 with the
    // flag at 1, so the reader reads a removal gate (defect
    // poison-resistance-gates).
    const at =
      'roleplaying_game/advanced_players_guide/apg_abilities_class.lst:95';
    expect(await pinnedLine('pcgen', at)).toContain(
      'BONUS:VAR|AlchemistPoisonLVL|1|PREVARGTEQ:AlchemistLVL,5|PREMULT:1,[!PREABILITY:1,CATEGORY=Archetype,TYPE.AlchemistPoisonResistance4],[PREVAREQ:Alchemist_CF_PoisonResistance4,1]',
    );
    expect(derive('Alchemist').gatedParts.get('PoisonResistance4')).toEqual({
      at,
      level: 5,
      polarity: 'removal',
    });
  });
});

describe('each P7e schedule against the PRD’s class table (#716 P7e, owner decision 8)', () => {
  it('prints every row at its level, with its label, in the cited table row', async () => {
    for (const className of printedClassNames) {
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
    // Table: Alchemist, 10th level: "Discovery, poison immunity".
    expect((await comparePrintedRows(schedule('Alchemist')))[9]?.table).toEqual(
      ['discovery', 'poison immunity'],
    );
    // Table: Investigator, 11th level: "Investigator talent, poison immunity".
    expect(
      (await comparePrintedRows(schedule('Investigator')))[10]?.table,
    ).toEqual(['investigator talent', 'poison immunity']);
    // Table: Slayer, 10th level: "3rd studied target, advanced talents,
    // slayer talent".
    expect((await comparePrintedRows(schedule('Slayer')))[9]?.table).toEqual([
      '3rd studied target',
      'advanced talents',
      'slayer talent',
    ]);
  });

  it('cites no unprinted row and prints no value column: alchemy is the Special column’s', async () => {
    for (const className of printedClassNames) {
      const { printedTable } = schedule(className);
      if (printedTable?.status !== 'reviewed')
        throw new Error(`${className} has no reviewed table.`);
      expect(printedTable.unprinted, className).toEqual({});
      expect(await comparePrintedColumns(schedule(className))).toEqual([]);
    }
  });

  it('keeps the Vigilante pending table review, its rows checked against PCGen’s grants and gates and Foundry’s links and text', async () => {
    // The PRD has no Ultimate Intrigue pages (prd-coverage.ts, not-in-prd;
    // P8b's capture covers 38 of the 40 schedules).
    const vigilante = schedule('Vigilante');
    expect(vigilante.printedTable).toEqual({
      status: 'pendingTableReview',
      exclusion: 'not-in-prd',
    });
    expect(prdClassExclusions['not-in-prd'].schedules).toContain('vigilante');
    expect(prdClassExclusions['not-in-prd'].books).toContain(
      'Ultimate Intrigue',
    );
    // In its place: every acquisition at the level PCGen grants it
    // (ui_abilities_class.lst:10-19) and Foundry links it
    // (vigilante.Yf5Wv9X09SUHYCqM.yaml:95-114), and every numbered row at
    // the level PCGen gates it (:1185-1205).
    const pcgen = derive('Vigilante');
    const foundry = foundryAssociations(
      vigilante.foundryFile,
      await readPinned('pf1', vigilante.foundryFile),
    );
    for (const feature of vigilante.features) {
      const [acquiredAt] = feature.levels;
      expect(
        pcgen.acquisitions.find(
          ({ granted }) => granted === feature.pcgen?.granted,
        )?.level,
        feature.id,
      ).toBe(acquiredAt);
      expect(
        foundry.find(({ externalKey }) => externalKey === feature.externalKey)
          ?.level,
        feature.id,
      ).toBe(acquiredAt);
      for (const [part, level] of Object.entries(feature.parts))
        expect(pcgen.gatedParts.get(part)?.level, part).toBe(level);
    }
    // And each talent's cadence as Foundry's feature text gives it.
    expect(
      await pinnedLine(
        'pf1',
        'packs/class-abilities/social-talent.2uDIHsepFL6PRyRj.yaml:13',
      ),
    ).toContain('Starting at 1st level, and every 2 levels thereafter');
    expect(
      await pinnedLine(
        'pf1',
        'packs/class-abilities/vigilante-talent.o4FeJzhEdocIO4mY.yaml:13',
      ),
    ).toContain('Starting at 2nd level and every 2 levels thereafter');
    for (const id of ['social-talent', 'vigilante-talent'])
      expect(
        vigilante.features.find((feature) => feature.id === id)?.decision,
      ).toContain('Pending table review');
  });
});

describe('PCGen’s schedule against each table (#716 P7e, note §5.2–3)', () => {
  it('settles every difference between PCGen, Foundry and the table with a cited decision or defect', async () => {
    for (const className of classNames)
      expect(
        (await compare(className)).filter(({ settledBy }) => !settledBy),
        className,
      ).toEqual([]);
    // APG p.31: PCGen gives the alchemist's immunity inside poison
    // resistance, so only Foundry links its row.
    expect(brief(await compare('Alchemist'))).toEqual([
      ['foundryOnly', 'poison-immunity', 'decision:poison-immunity'],
    ]);
    // ACG p.31: trap sense and studied strike are formula-held; PCGen gives
    // the immunity at 10, the table at 11.
    expect(brief(await compare('Investigator'))).toEqual([
      [
        'ungatedGrant',
        'Investigator ~ Weapon and Armor Proficiency',
        'grantNonRow:Investigator ~ Weapon and Armor Proficiency',
      ],
      ['formulaIncrement', 'trap-sense', 'decision:trap-sense'],
      ['formulaIncrement', 'studied-strike', 'decision:studied-strike'],
      ['foundryOnly', 'poison-immunity', 'decision:poison-immunity'],
    ]);
    // ACG p.54: advanced talents are Foundry's row alone.
    expect(brief(await compare('Slayer'))).toEqual([
      [
        'ungatedGrant',
        'Slayer ~ Weapon and Armor Proficiency',
        'grantNonRow:Slayer ~ Weapon and Armor Proficiency',
      ],
      ['formulaIncrement', 'studied-target', 'decision:studied-target'],
      ['formulaIncrement', 'sneak-attack', 'decision:sneak-attack'],
      ['foundryOnly', 'advanced-talents', 'decision:advanced-talents'],
      ['formulaIncrement', 'slayers-advance', 'decision:slayers-advance'],
    ]);
    // UI: PCGen gates the class skills grant (ui_abilities_class.lst:8).
    expect(brief(await compare('Vigilante'))).toEqual([
      ['nonRow', 'ClassSkills', 'nonRow:ClassSkills'],
      [
        'ungatedGrant',
        'Vigilante ~ Weapon and Armor Proficiencies',
        'grantNonRow:Vigilante ~ Weapon and Armor Proficiencies',
      ],
    ]);
  });

  it('places each immunity at the table’s level, not PCGen’s copied 10th for the investigator', async () => {
    // ACG p.33: "At 11th level, the investigator gains immunity to poison"
    // (advancedClassGuide/classes/investigator.html:428); PCGen adds the
    // fourth step at InvestigatorLVL 10 (acg_abilities_class.lst:1258).
    expect(
      await readPrdText({
        page: 'advancedClassGuide/classes/investigator.html',
        from: 428,
        to: 428,
      }),
    ).toContain('At 11th level, the investigator gains immunity to poison.');
    expect(
      await pinnedLine(
        'pcgen',
        'roleplaying_game/advanced_class_guide/acg_abilities_class.lst:1258',
      ),
    ).toContain(
      'PREVARGTEQ:InvestigatorLVL,10|PREVAREQ:Investigator_CF_PoisonImmunity,0',
    );
    const findImmunityLevels = (className: ClassName) =>
      schedule(className).features.find(({ id }) => id === 'poison-immunity')
        ?.levels;
    expect(findImmunityLevels('Alchemist')).toEqual([10]);
    expect(findImmunityLevels('Investigator')).toEqual([11]);
  });
});

describe('P7-0’s grant kinds in the P7e classes (#716 P7e, note §5.3)', () => {
  it('reads the alchemist’s and vigilante’s gated record grants, and the investigator’s and slayer’s level-block grants beside an ungated proficiency', () => {
    // apg_abilities_globalvar.lst:24-36; acg_classes.lst:183-194, :333-342
    // (P7-0's level blocks); ui_abilities_class.lst:8-19.
    expect(
      Object.fromEntries(
        classNames.map((name) => [name, countGrantKinds(name)]),
      ),
    ).toEqual({
      Alchemist: [13, 0, 0],
      Investigator: [12, 1, 0],
      Slayer: [10, 1, 0],
      Vigilante: [11, 1, 0],
    });
    expect(
      derive('Investigator').acquisitions.every(({ at }) =>
        at.startsWith('roleplaying_game/advanced_class_guide/acg_classes.lst:'),
      ),
    ).toBe(true);
  });
});

describe('formula rows, skill ranks and bridges (#716 P7e, note §5.4–5)', () => {
  it('holds each formula-held feature’s later rows in the schedule alone, and numbers every other repeating feature', async () => {
    const formulaHeld: Record<ClassName, string[]> = {
      // Bombs, discoveries and poison resistance are all numbered.
      Alchemist: [],
      Investigator: ['trap-sense', 'studied-strike'],
      Slayer: ['studied-target', 'sneak-attack', 'slayers-advance'],
      // Social and vigilante talents are both numbered.
      Vigilante: [],
    };
    for (const className of classNames) {
      const findings = await compare(className);
      expect(
        findings
          .filter(({ kind }) => kind === 'formulaIncrement')
          .map(({ feature, settledBy }) => [feature, settledBy]),
        className,
      ).toEqual(formulaHeld[className].map((id) => [id, `decision:${id}`]));
      const { gatedParts } = derive(className);
      for (const feature of schedule(className).features)
        if (
          feature.levels.length > 1 &&
          !formulaHeld[className].includes(feature.id)
        )
          expect(
            Object.keys(feature.parts).some((part) => gatedParts.has(part)),
            `${className} ${feature.id}`,
          ).toBe(true);
    }
  });

  it('gives each formula-held feature a row per step its table prints (note §5.4)', () => {
    // Table: Investigator, trap sense +2 at 6th (investigator.html:383).
    expect(listIncrementNames(schedule('Investigator'))).toMatchObject({
      'everythingpath/investigator-trap-sense-6': 'Trap Sense +2',
      'everythingpath/investigator-studied-strike-20': 'Studied Strike +9d6',
    });
    // Table: Slayer, sneak attack +6d6 at 18th (slayer.html:387).
    expect(listIncrementNames(schedule('Slayer'))).toMatchObject({
      'everythingpath/slayer-sneak-attack-18': 'Sneak Attack +6d6',
      'everythingpath/slayer-studied-target-15': '4th Studied Target',
      'everythingpath/slayer-slayers-advance-17': 'Slayer’s Advance 2/day',
    });
  });

  it('gives each class the skill ranks per level of its table, as Foundry records them', async () => {
    // Alchemist 4, investigator, slayer and vigilante 6 ranks + Int modifier.
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
    expect(ranks).toEqual([4, 6, 6, 6]);
  });

  it('reads the TYPE bridges from the global variables, not by spelling', () => {
    // apg_abilities_globalvar.lst:252.
    expect(derive('Alchemist').typeBridges.get('AlchemistDiscovery')).toBe(
      'Discovery',
    );
    // acg_abilities_globalvar.lst:409, :416: the proficiency TYPEs set
    // Investigator_CF_Proficiencies.
    expect(
      derive('Investigator').typeBridges.get('InvestigatorWeaponProficiencies'),
    ).toBe('Proficiencies');
    expect(derive('Investigator').typeBridges.get('InvestigatorTalents')).toBe(
      'InvestigatorTalents',
    );
    expect(derive('Slayer').typeBridges.get('SlayerTalents')).toBe('Talents');
    // The vigilante has no old-style TYPE bridge.
    expect(derive('Vigilante').typeBridges.size).toBe(0);
  });

  it('cites the Foundry lines that compute the repeating features’ increments', async () => {
    const readAcquisitionFormula = ({
      className,
      id,
    }: {
      className: ClassName;
      id: string;
    }) =>
      schedule(className).features.find((feature) => feature.id === id)
        ?.acquisitionFormula ?? '';
    for (const [className, id, text] of [
      ['Alchemist', 'bomb', '(ceil(@class.level / 2) - 1)d6'],
      ['Alchemist', 'mutagen', '10 * @class.level'],
      ['Alchemist', 'poison-resistance', 'floor((@class.level + 1) / 3) * 2'],
      [
        'Investigator',
        'poison-resistance',
        'floor((@class.level + 1) / 3) * 2',
      ],
      ['Investigator', 'trap-sense', 'floor(@class.level / 3)'],
      ['Investigator', 'studied-strike', 'floor((@class.level - 2) / 2)'],
      ['Slayer', 'studied-target', 'floor(@class.level / 5) + 1'],
      ['Slayer', 'sneak-attack', '(floor(@class.level / 3))d6'],
      ['Slayer', 'slayers-advance', 'gte(@class.level, 17)'],
    ] as const)
      expect(
        await pinnedLine('pf1', readAcquisitionFormula({ className, id })),
        id,
      ).toContain(text);
    // Discoveries and every talent compute nothing from the level.
    for (const [className, id, file] of [
      ['Alchemist', 'discovery', 'discovery.Xcim6WFtAtxJxnmA'],
      [
        'Investigator',
        'investigator-talent',
        'investigator-talent.AOnFqb1h3gXbFUup',
      ],
      ['Slayer', 'slayer-talent', 'slayer-talents.Zn9ecDCXShBK4vj8'],
      ['Vigilante', 'social-talent', 'social-talent.2uDIHsepFL6PRyRj'],
      ['Vigilante', 'vigilante-talent', 'vigilante-talent.o4FeJzhEdocIO4mY'],
    ] as const) {
      expect(readAcquisitionFormula({ className, id }), id).toBe('');
      expect(
        await readPinned('pf1', `packs/class-abilities/${file}.yaml`),
      ).not.toContain('@class.level');
    }
  });
});

describe('per-increment identities (#716 P7e, note §5.6–7)', () => {
  it('repeats no key in any P7e class’s featuresByLevel, and keys every later row by its slug', () => {
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
          incrementEntries(schedule(className)).length,
        ]),
      ),
    ).toEqual({
      // Bomb 9, discoveries 8, poison resistance 2.
      Alchemist: 19,
      // Poison resistance 2, talents 8, trap sense 5, studied strike 8.
      Investigator: 23,
      // Studied target 4, talents 9, sneak attack 5, slayer's advance 1.
      Slayer: 19,
      // Social talents 9, vigilante talents 9.
      Vigilante: 18,
    });
  });

  it('names the later rows by their table labels, each class’s poison resistance under its own slug', () => {
    // The keys without their `everythingpath/` prefix, for reading.
    const listShortIncrementNames = (className: ClassName) =>
      Object.fromEntries(
        Object.entries(listIncrementNames(schedule(className))).map(
          ([externalKey, name]) => [
            externalKey.replace('everythingpath/', ''),
            name,
          ],
        ),
      );
    // Table: Alchemist (alchemist.html:359-375).
    expect(listShortIncrementNames('Alchemist')).toMatchObject({
      'alchemist-bomb-3': 'Bomb 2d6',
      'alchemist-bomb-19': 'Bomb 10d6',
      'alchemist-discovery-18': 'Discovery',
      'alchemist-poison-resistance-5': 'Poison Resistance +4',
    });
    // Table: Investigator (investigator.html:382-396).
    expect(listShortIncrementNames('Investigator')).toMatchObject({
      'investigator-poison-resistance-8': 'Poison Resistance +6',
      'investigator-investigator-talent-19': 'Investigator Talent',
    });
    // Table: Slayer (slayer.html:374-389).
    expect(listShortIncrementNames('Slayer')).toMatchObject({
      'slayer-studied-target-5': '2nd Studied Target',
      'slayer-slayer-talent-20': 'Slayer Talent',
    });
    expect(listShortIncrementNames('Vigilante')).toMatchObject({
      'vigilante-social-talent-3': 'Social Talent',
      'vigilante-vigilante-talent-20': 'Vigilante Talent',
    });
    // Both classes acquire Foundry's one Poison Resistance record.
    const findPoisonResistanceKey = (className: ClassName) =>
      schedule(className).features.find(({ id }) => id === 'poison-resistance')
        ?.externalKey;
    expect(findPoisonResistanceKey('Alchemist')).toBe('pf1/2qcz39w9O2Qlms0Q');
    expect(findPoisonResistanceKey('Investigator')).toBe(
      'pf1/2qcz39w9O2Qlms0Q',
    );
  });

  it('has no feature schedule seed to equal: the alchemist and investigator seeds carry only their casting', () => {
    // convex/lib/representativeClassCatalog.ts:1046,
    // representativeSpellcastingCatalog.ts (note §5.7).
    for (const identity of [
      'alchemist',
      'investigator',
      'slayer',
      'vigilante',
    ]) {
      expect(representativeClassFeatureSchedules).not.toHaveProperty(identity);
      expect(representativeSpellcastingSchedules).not.toHaveProperty(identity);
    }
  });
});

// One published archetype per class through the mapper (note §5.8), each in a
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

describe('the P7e archetypes through the mapper (#716 P7e, note §5.8)', () => {
  it('Alchemist: Clone Master removes poison resistance +6 and poison immunity, its flags held on the inverted gates', async () => {
    // UM p.30: rebirth "replaces poison resistance +6 and poison immunity"
    // (ultimateMagic/spellcastingClassOptions/alchemist.html); its bombs deal
    // a die step lower, which "otherwise functions as and replaces" bomb.
    const page = await readPrdText({
      page: 'ultimateMagic/spellcastingClassOptions/alchemist.html',
      from: 384,
      to: 392,
    });
    expect(page).toContain(
      'This ability replaces poison resistance +6 and poison immunity.',
    );
    expect(page).toContain(
      'This otherwise functions as and replaces the standard alchemist bomb class feature.',
    );
    const archetype = 'Alchemist Archetype ~ Clone Master';
    expect(readInventoryClass({ inventory, archetype })).toBe('Alchemist');
    const mapping = mapInventoryArchetype(archetype);
    expect(listReplacements(mapping)).toEqual([
      [8, 'everythingpath/alchemist-poison-resistance-8', 'part'],
      [10, 'pf1/tflIOhX6ukxtwXLx', 'whole'],
    ]);
    // Foundry's poison resistance computes every step from the level
    // (poison-resistance.2qcz39w9O2Qlms0Q.yaml:15).
    expect(summarizeItems(mapping)).toEqual([
      ['conflict', 'partialFormula:poison-resistance'],
      ['conflict', 'defect:poison-resistance-gates'],
      ['unmatchedReplacement', 'notOnTable:BombReduction'],
    ]);
    expect(planArchetypeBatch({ className: 'Alchemist', mapping })).toEqual([
      5,
    ]);
  });

  it('Investigator: Questioner replaces alchemy and poison lore; its alchemy touch is a casting item (#422)', () => {
    // Magic Tactics Toolbox p.26: spells "replaces alchemy"
    // (magtt_abilities_class.lst:114); inspiration for subterfuge and
    // restricted talents "alter" inspiration and investigator talents (:113,
    // :116). PCGen also removes poison lore (FACT:Investigator_CF_PoisonLore,
    // :105), for know-it-all at 2nd (:115), whose DESC states no replacement.
    const archetype = 'Investigator Archetype ~ Questioner';
    expect(readInventoryClass({ inventory, archetype })).toBe('Investigator');
    const mapping = mapInventoryArchetype(archetype);
    expect(listReplacements(mapping)).toEqual([
      [1, 'pf1/gotW1ETzGrrwVtk2', 'whole'],
      [2, 'pf1/C7UgLJt7yRHnAqyG', 'whole'],
    ]);
    expect(summarizeItems(mapping)).toEqual([
      ['unmatchedReplacement', 'alters:inspiration'],
      ['unmatchedReplacement', 'alters:investigator-talent'],
      ['uncheckedCasting', 'casting:alchemy'],
    ]);
    expect(planArchetypeBatch({ className: 'Investigator', mapping })).toEqual([
      5,
    ]);
  });

  it('Investigator: Psychic Detective replaces alchemy, the 3rd-level talent and poison resistance whole; its alchemy touch is a casting item (#422)', async () => {
    // OA pp.119-120: psychic detective spells "replaces alchemy"; phrenic
    // dabbler "replaces the investigator talent gained at 3rd level";
    // psychic meddler "replaces poison lore, poison resistance, swift
    // alchemy, and poison immunity" (occultAdventures/archetypes/other.html).
    const page = await readPrdText({
      page: 'occultAdventures/archetypes/other.html',
      from: 505,
      to: 525,
    });
    expect(page).toContain(
      'This ability replaces poison lore, poison resistance, swift alchemy, and poison immunity.',
    );
    expect(page).toContain(
      'This ability replaces the investigator talent gained at 3rd level.',
    );
    const archetype = 'Investigator Archetype ~ Psychic Detective';
    expect(readInventoryClass({ inventory, archetype })).toBe('Investigator');
    const mapping = mapInventoryArchetype(archetype);
    expect(listReplacements(mapping)).toEqual([
      [3, 'pf1/AOnFqb1h3gXbFUup', 'part'],
      [2, 'pf1/C7UgLJt7yRHnAqyG', 'whole'],
      [2, 'pf1/2qcz39w9O2Qlms0Q', 'whole'],
      [4, 'pf1/kEVqxs23oyNDxbc1', 'whole'],
      [11, 'pf1/tflIOhX6ukxtwXLx', 'whole'],
      [1, 'pf1/gotW1ETzGrrwVtk2', 'whole'],
    ]);
    // Its ClassSkills flag is never defined (defect undefined-flags); its
    // own spell levels hold its casting (castingContract, OA p.120).
    expect(summarizeItems(mapping)).toEqual([
      ['uncheckedCasting', 'casting:alchemy'],
      ['conflict', 'defect:undefined-flags'],
      ['uncheckedCasting', 'castingContract'],
    ]);
    expect(planArchetypeBatch({ className: 'Investigator', mapping })).toEqual([
      7,
    ]);
  });

  it('Slayer: Cleaner replaces track, stalker and the 4th-level slayer talent', async () => {
    // ACG p.55: deceitful "replaces track", misdirection "replaces stalker"
    // (advancedClassGuide/classOptions/slayer.html:364, :366); without a
    // trace at 4th (:365); acg_abilities_class.lst:4678 sets
    // Slayer_CF_Talent4.
    const page = await readPrdText({
      page: 'advancedClassGuide/classOptions/slayer.html',
      from: 364,
      to: 366,
    });
    expect(page).toContain('This ability replaces track.');
    expect(page).toContain('This ability replaces stalker.');
    expect(page).toContain(
      'This ability replaces the slayer talent gained at 4th level.',
    );
    const archetype = 'Slayer Archetype ~ Cleaner';
    expect(readInventoryClass({ inventory, archetype })).toBe('Slayer');
    const mapping = mapInventoryArchetype(archetype);
    expect(listReplacements(mapping)).toEqual([
      [4, 'everythingpath/slayer-slayer-talent-4', 'part'],
      [1, 'pf1/r8wPs0bB3WhOLxbX', 'whole'],
      [7, 'pf1/0oO5lfLEq2ggvGHg', 'whole'],
    ]);
    // Its .MOD's second PREMULT guard leaves out the talent
    // (acg_abilities_class.lst:4678), against its first (:3731).
    expect(summarizeItems(mapping)).toEqual([['conflict', 'stackingGuard#2']]);
    expect(planArchetypeBatch({ className: 'Slayer', mapping })).toEqual([4]);
  });

  it('Vigilante: Warlock replaces five vigilante talents, the specialization and unshakable, and its added spellcasting is a casting item', () => {
    // UI p.60; ui_abilities_class.lst:973 and its FACTs set
    // Vigilante_CF_VigilanteTalent4/8/10/14/16, VigilanteSpecialization and
    // Unshakable. It casts as a magus (:1038; ADD:SPELLCASTER|VWarlock, :973),
    // though the vigilante has no casting row: a casting change, reviewed
    // by hand (PRD #251 decision 7).
    const archetype = 'Vigilante Archetype ~ Warlock';
    expect(readInventoryClass({ inventory, archetype })).toBe('Vigilante');
    const mapping = mapInventoryArchetype(archetype);
    expect(listReplacements(mapping)).toEqual([
      [4, 'everythingpath/vigilante-vigilante-talent-4', 'part'],
      [8, 'everythingpath/vigilante-vigilante-talent-8', 'part'],
      [10, 'everythingpath/vigilante-vigilante-talent-10', 'part'],
      [14, 'everythingpath/vigilante-vigilante-talent-14', 'part'],
      [16, 'everythingpath/vigilante-vigilante-talent-16', 'part'],
      [1, 'pf1/vTE94sQboMmdAakT', 'whole'],
      [3, 'pf1/4U69gg3altKZvFHD', 'whole'],
    ]);
    expect(summarizeItems(mapping)).toEqual([
      ['unmatchedReplacement', 'unknown:SkillRanks'],
      ['uncheckedCasting', 'castingAddition'],
    ]);
    expect(
      mapping.items.find(({ id }) => id === 'castingAddition')?.fields,
    ).toEqual(['detail.casting']);
    expect(planArchetypeBatch({ className: 'Vigilante', mapping })).toEqual([
      6,
    ]);
  });

  it('Vigilante: every archetype adding spellcasting to the vigilante is held on it, by its casting tokens or its granted spellcasting', () => {
    // UI p.55 and p.62: Cabalist casts as a magus from the witch list
    // (ui_abilities_class.lst:996; ADD:SPELLCASTER|VCabalist, :970), Zealot
    // as an inquisitor (:1072; ADD:SPELLCASTER|Inquisitor, :975). UI p.57:
    // Magical Child casts as an unchained summoner, granted with no casting
    // token (Magical Child ~ Spellcasting,
    // support/ui_abilities_class_pu.lst:97).
    for (const name of ['Cabalist', 'Zealot', 'Magical Child'])
      expect(
        summarizeItems(
          mapInventoryArchetype(`Vigilante Archetype ~ ${name}`),
        ).filter(([kind]) => kind === 'uncheckedCasting'),
        name,
      ).toEqual([['uncheckedCasting', 'castingAddition']]);
    // An archetype adding no spellcasting raises none (Cleaner, above, on
    // the slayer; a vigilante one here).
    expect(
      summarizeItems(
        mapInventoryArchetype('Vigilante Archetype ~ Brute'),
      ).filter(([kind]) => kind === 'uncheckedCasting'),
    ).toEqual([]);
  });
});

describe('the investigator #422 scan (#716 P7e, note §4)', () => {
  const questioner = mapInventoryArchetype(
    'Investigator Archetype ~ Questioner',
  );
  const psychicDetective = mapInventoryArchetype(
    'Investigator Archetype ~ Psychic Detective',
  );
  const getSeedFeatureChanges = (ruleIdentity: string) => {
    const seed = representativeArchetypeCatalog.find(
      (entry) => entry.ruleIdentity === ruleIdentity,
    );
    if (seed?.detail?.kind !== 'archetype')
      throw new Error(`No ${ruleIdentity} seed.`);
    return seed.detail.featureChanges ?? [];
  };

  it('maps both specimens’ whole alchemy, as their seeds name it (docs/catalog-import/archetypes.md:144-154)', () => {
    // The seeds name only the casting feature; the specimens' text replaces
    // or alters more, which the mapping names too.
    const alchemy = { externalKey: 'pf1/gotW1ETzGrrwVtk2', scope: 'whole' };
    for (const [ruleIdentity, mapping] of [
      ['investigator-questioner', questioner],
      ['investigator-psychic-detective', psychicDetective],
    ] as const) {
      expect(getSeedFeatureChanges(ruleIdentity)).toEqual([
        { featureIdentity: 'investigator-alchemy', scope: 'whole' },
      ]);
      expect(readArchetypeDetail(mapping).featureChanges).toContainEqual(
        alchemy,
      );
    }
    expect(readArchetypeDetail(questioner).featureChanges).toEqual([
      { externalKey: 'pf1/nKbyztRQCU5XMbbs', scope: 'whole' },
      alchemy,
      { externalKey: 'pf1/C7UgLJt7yRHnAqyG', scope: 'whole' },
      { externalKey: 'pf1/AOnFqb1h3gXbFUup', scope: 'whole' },
    ]);
  });

  it('raises uncheckedCasting on every touch of a casting row, never settling it', () => {
    // Alchemy is the investigator's only casting row; every archetype here
    // touching it is held on it.
    expect(
      schedule('Investigator')
        .features.filter(({ casting }) => casting)
        .map(({ id }) => id),
    ).toEqual(['alchemy']);
    for (const mapping of [questioner, psychicDetective])
      expect(
        mapping.items.filter(({ kind }) => kind === 'uncheckedCasting'),
      ).toContainEqual(
        expect.objectContaining({
          id: 'casting:alchemy',
          fields: ['detail.casting'],
        }),
      );
  });

  it('still finds Questioner × Psychic Detective conflicting: alchemy, poison lore and the investigator talents', () => {
    expect(
      stackingConflicts([questioner, psychicDetective]).conflicts.map(
        ({ feature, part }) => [feature, part],
      ),
    ).toEqual([
      ['pf1/gotW1ETzGrrwVtk2', null],
      ['pf1/C7UgLJt7yRHnAqyG', null],
      ['pf1/AOnFqb1h3gXbFUup', null],
    ]);
  });
});
