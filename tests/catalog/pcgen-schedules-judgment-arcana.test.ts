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

// #772 (research note 772-p7g-refresh, the P7g launch subset of 716-p7-rules
// §3 and §4): the reviewed schedules of the Inquisitor and Magus, checked
// against the pinned PCGen, Foundry and PRD files, and the magus #422 scan.
// Every scenario reads pinned files, never committed curation state.

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

const classNames = ['Inquisitor', 'Magus'] as const;
type ClassName = (typeof classNames)[number];

const { schedule, derive, compare, levelOf, countGrantKinds } = scheduleChecks({
  tree,
  view,
});

const ultimateMagicGlobals =
  'roleplaying_game/ultimate_magic/um_abilities_globalvar.lst';

describe('the #772 schedules’ numbered variables (note Q1, Q3)', () => {
  it('gives every numbered variable its explicit level, by class level', () => {
    // APG p.38: a teamwork feat at 3rd and every three levels after
    // (apg_abilities_class.lst:359-364).
    expect(levelOf('Inquisitor', 'TeamworkFeat3')).toEqual([
      'teamwork-feat',
      3,
    ]);
    expect(levelOf('Inquisitor', 'TeamworkFeat6')).toEqual([
      'teamwork-feat',
      6,
    ]);
    expect(levelOf('Inquisitor', 'TeamworkFeat18')).toEqual([
      'teamwork-feat',
      18,
    ]);
    expect(levelOf('Inquisitor', 'TeamworkFeat2')).toEqual(['unknown']);
    expect(levelOf('Inquisitor', 'TeamworkFeat')).toEqual([
      'teamwork-feat',
      null,
    ]);
    // Bane and greater bane, second and third judgment are rows of their own
    // (apg_abilities_globalvar.lst:62, :66, :64, :68).
    expect(levelOf('Inquisitor', 'Bane')).toEqual(['bane', null]);
    expect(levelOf('Inquisitor', 'GreaterBane')).toEqual([
      'greater-bane',
      null,
    ]);
    expect(levelOf('Inquisitor', 'SecondJudgment')).toEqual([
      'second-judgment',
      null,
    ]);
    expect(levelOf('Inquisitor', 'ThirdJudgment')).toEqual([
      'third-judgment',
      null,
    ]);
    // Spellbreaker's undefined flag names true judgment (defect
    // final-judgment).
    expect(levelOf('Inquisitor', 'FinalJudgment')).toEqual([
      'true-judgment',
      null,
    ]);
    // The nine judgments are options of judgment (apg_abilities_class.lst:297-298).
    expect(levelOf('Inquisitor', 'JudgmentHealing')).toEqual(['option']);
    expect(levelOf('Inquisitor', 'JudgmentPurity')).toEqual(['option']);
    // UM p.10: magus arcana at 3rd and every three levels after
    // (um_abilities_class.lst:72-77), Arcana15 gated but never defined.
    expect(levelOf('Magus', 'Arcana3')).toEqual(['magus-arcana', 3]);
    expect(levelOf('Magus', 'Arcana6')).toEqual(['magus-arcana', 6]);
    expect(levelOf('Magus', 'Arcana15')).toEqual(['magus-arcana', 15]);
    expect(levelOf('Magus', 'Arcana18')).toEqual(['magus-arcana', 18]);
    expect(levelOf('Magus', 'Arcana')).toEqual(['magus-arcana', null]);
    // UM p.11: bonus feats at 5th, 11th and 17th (um_abilities_class.lst:62-64).
    expect(levelOf('Magus', 'BonusFeat5')).toEqual(['bonus-feats', 5]);
    expect(levelOf('Magus', 'BonusFeat11')).toEqual(['bonus-feats', 11]);
    expect(levelOf('Magus', 'BonusFeat17')).toEqual(['bonus-feats', 17]);
    expect(levelOf('Magus', 'BonusFeat6')).toEqual(['unknown']);
    // The armor rows are named by their gates' flags
    // (um_abilities_globalvar.lst:25-26).
    expect(levelOf('Magus', 'MediumArmorProficiency')).toEqual([
      'medium-armor',
      null,
    ]);
    expect(levelOf('Magus', 'HeavyArmorProficiency')).toEqual([
      'heavy-armor',
      null,
    ]);
    expect(levelOf('Magus', 'ArmorProficiency')).toEqual(['proficiency']);
  });

  it('reads the teamwork feat, magus arcana and bonus feat gates as PCGen levels them', () => {
    // apg_abilities_class.lst:360: PREVARGTEQ:InquisitorLVL,6 inside PREMULT.
    expect(derive('Inquisitor').gatedParts.get('TeamworkFeat6')).toEqual({
      at: 'roleplaying_game/advanced_players_guide/apg_abilities_class.lst:360',
      level: 6,
      polarity: 'removal',
    });
    // um_abilities_class.lst:63: PRECLASS:1,Magus=11.
    expect(derive('Magus').gatedParts.get('BonusFeat11')?.level).toBe(11);
    // um_abilities_class.lst:73: MagusArcanaCount is a count, MagusArcanaLVL/3
    // (:72), no level variable: only the schedule gives the arcana's levels.
    expect(derive('Magus').gatedParts.get('Arcana6')?.level).toBeNull();
    expect(derive('Magus').gatedParts.get('Arcana15')?.at).toBe(
      'roleplaying_game/ultimate_magic/um_abilities_class.lst:76',
    );
  });
});

describe('each #772 schedule against the PRD’s class table (owner decision 8)', () => {
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
    // Table: Inquisitor, 1st level: "Domain, judgment 1/day, monster lore,
    // orisons, stern gaze".
    expect(
      (await comparePrintedRows(schedule('Inquisitor')))[0]?.table,
    ).toEqual([
      'domain',
      'judgment 1/day',
      'monster lore',
      'orisons',
      'stern gaze',
    ]);
    // 16th: "Judgment 6/day, third judgment".
    expect(
      (await comparePrintedRows(schedule('Inquisitor')))[15]?.table,
    ).toEqual(['judgment 6/day', 'third judgment']);
    // Table: Magus, 7th level: "Knowledge Pool, Medium Armor"; 11th: "Bonus
    // Feat, Improved Spell Recall".
    const magusRows = await comparePrintedRows(schedule('Magus'));
    expect(magusRows[6]?.table).toEqual(['knowledge pool', 'medium armor']);
    expect(magusRows[10]?.table).toEqual([
      'bonus feat',
      'improved spell recall',
    ]);
  });

  it('cites the spells (and the inquisitor’s exchange, the magus’s spellbooks) as unprinted, and prints no value column', async () => {
    const readUnprinted = (className: ClassName) => {
      const { printedTable } = schedule(className);
      if (printedTable?.status !== 'reviewed')
        throw new Error(`${className} has no reviewed table.`);
      return Object.keys(printedTable.unprinted);
    };
    // INQ:406, :410; orisons are printed at 1st (INQ:358).
    expect(readUnprinted('Inquisitor')).toEqual(['spells', 'exchange-spell']);
    // MAG:389, :393; cantrips are printed at 1st (MAG:367).
    expect(readUnprinted('Magus')).toEqual(['spellbooks', 'spells']);
    // Judgment uses are printed in the Special column, the spells per day in
    // columns `classTableRows` can't name (prd-coverage.ts:357-372).
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
    // APG p.40: judgment's uses are formula-held; PCGen grants no orisons
    // (apg_abilities_class.lst:296 is never granted), no spells and no
    // spell exchange row.
    expect(brief(await compare('Inquisitor'))).toEqual([
      ['formulaIncrement', 'judgment', 'decision:judgment'],
      ['foundryOnly', 'orisons', 'decision:orisons'],
      ['foundryOnly', 'spells', 'decision:spells'],
      ['foundryOnly', 'exchange-spell', 'decision:exchange-spell'],
    ]);
    // UM p.9: the armor proficiency grant is no table row; PCGen grants no
    // spellbooks or spells row; Arcana15 is gated but never defined.
    expect(brief(await compare('Magus'))).toEqual([
      ['nonRow', 'ArmorProficiency', 'nonRow:ArmorProficiency'],
      ['foundryOnly', 'spellbooks', 'decision:spellbooks'],
      ['foundryOnly', 'spells', 'decision:spells'],
      ['undefinedPart', 'magus-arcana', 'arcana-15'],
    ]);
  });

  it('settles the inquisitor’s nested judgment grants as options of judgment', () => {
    // apg_abilities_class.lst:297-298: sacred and profane judgment each
    // grant the nine judgments gated on Inquisitor_CF_Judgment<X>.
    const nested = derive('Inquisitor').nestedGrants;
    expect(nested).toHaveLength(18);
    expect(new Set(nested.map(({ suffix }) => suffix))).toEqual(
      new Set(
        [
          'Healing',
          'Resiliency',
          'Resistance',
          'Smiting',
          'Destruction',
          'Justice',
          'Piercing',
          'Protection',
          'Purity',
        ].map((judgment) => `Judgment${judgment}`),
      ),
    );
    for (const { suffix } of nested)
      expect(levelOf('Inquisitor', suffix), suffix).toEqual(['option']);
  });

  it('records Arcana15 as gated, never defined and set by no archetype (defect arcana-15)', async () => {
    expect(
      await pinnedLine(
        'pcgen',
        'roleplaying_game/ultimate_magic/um_abilities_class.lst:76',
      ),
    ).toContain('PREVARGTEQ:MagusArcanaCount,5|PREVAREQ:Magus_CF_Arcana15,1');
    const { defined } = derive('Magus');
    expect(
      ['Arcana3', 'Arcana6', 'Arcana9', 'Arcana12', 'Arcana15', 'Arcana18'].map(
        (part) => [part, defined.has(part)],
      ),
    ).toEqual([
      ['Arcana3', true],
      ['Arcana6', true],
      ['Arcana9', true],
      ['Arcana12', true],
      ['Arcana15', false],
      ['Arcana18', true],
    ]);
  });
});

describe('P7-0’s grant kinds in the #772 classes (note Q7)', () => {
  it('reads both classes’ gated record grants, and the inquisitor’s nested judgments', () => {
    // apg_abilities_globalvar.lst:53-70; um_abilities_globalvar.lst:9-26.
    expect(
      Object.fromEntries(
        classNames.map((name) => [name, countGrantKinds(name)]),
      ),
    ).toEqual({ Inquisitor: [18, 0, 18], Magus: [18, 0, 0] });
  });

  it('levels the magus’s armor grants through MagusArmorProficiencyLVL, bound in its armor proficiency record (um_abilities_class.lst:26)', () => {
    const levelOfGrant = (granted: string) =>
      derive('Magus').acquisitions.find((found) => found.granted === granted);
    expect(levelOfGrant('Magus ~ Medium Armor')).toMatchObject({
      level: 7,
      at: `${ultimateMagicGlobals}:25`,
    });
    expect(levelOfGrant('Magus ~ Heavy Armor')).toMatchObject({
      level: 13,
      at: `${ultimateMagicGlobals}:26`,
    });
  });
});

describe('the magus’s armor flags (defect armor-flags, note Q4)', () => {
  it('bridges the medium and heavy armor FACTs to variables nothing defines or reads, and gates both rows on a branch that always holds', async () => {
    // um_abilities_globalvar.lst:93-94: the FACT bridges write
    // Magus_CF_MediumArmor and Magus_CF_HeavyArmor.
    expect(await pinnedLine('pcgen', `${ultimateMagicGlobals}:93`)).toContain(
      'BONUS:VAR|Magus_CF_MediumArmor|1|TYPE=Boolean|PREFACT:1,ABILITIES,Magus_CF_MediumArmorProficiency=True',
    );
    expect(await pinnedLine('pcgen', `${ultimateMagicGlobals}:94`)).toContain(
      'BONUS:VAR|Magus_CF_HeavyArmor|1|TYPE=Boolean|PREFACT:1,ABILITIES,Magus_CF_HeavyArmorProficiency=True',
    );
    const globals = await readPinned(
      'pcgen',
      `data/pathfinder/paizo/${ultimateMagicGlobals}`,
    );
    expect(globals.match(/Magus_CF_MediumArmor\b/g)).toHaveLength(1);
    expect(globals.match(/Magus_CF_HeavyArmor\b/g)).toHaveLength(1);
    // :25: the ArmorProficiency branch reads ,0 with PREVARGTEQ, so it holds
    // whether the flag is 0 or 1.
    expect(await pinnedLine('pcgen', `${ultimateMagicGlobals}:25`)).toContain(
      '[PREVAREQ:Magus_CF_MediumArmorProficiency,0],[PREVARGTEQ:Magus_CF_ArmorProficiency,0]|PREVARGTEQ:MagusArmorProficiencyLVL,7',
    );
    const { defects } = schedule('Magus');
    const armor = defects.find(({ id }) => id === 'armor-flags');
    expect(armor?.suffixes).toEqual([
      'MediumArmorProficiency',
      'HeavyArmorProficiency',
      'ArmorProficiency',
    ]);
    // The removal through the unbound level variable is read from PCGen's
    // semantics, not from a PCGen run (note Q4, branch 4).
    expect(armor?.text).toContain('inferred');
  });
});

describe('formula rows, skill ranks and bridges (note Q1, Q3, Q6)', () => {
  it('holds only judgment’s later rows in the schedule alone, and numbers every other repeating feature', async () => {
    const formulaHeld: Record<ClassName, string[]> = {
      // Teamwork feats are numbered; bane is one row (note Q1).
      Inquisitor: ['judgment'],
      // Magus arcana and bonus feats are both numbered (note Q3).
      Magus: [],
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

  it('gives judgment a row per use its table prints (INQ:358-376)', () => {
    expect(listIncrementNames(schedule('Inquisitor'))).toMatchObject({
      'everythingpath/inquisitor-judgment-4': 'Judgment 2/day',
      'everythingpath/inquisitor-judgment-19': 'Judgment 7/day',
    });
  });

  it('keeps bane one row: its rounds a day are the class level, and greater bane is its own row', async () => {
    const findFeature = (id: string) =>
      schedule('Inquisitor').features.find((feature) => feature.id === id);
    expect(findFeature('bane')?.levels).toEqual([5]);
    expect(findFeature('greater-bane')?.levels).toEqual([12]);
    // bane.MpvhQz62qw68D2pd.yaml:40; apg_abilities_class.lst:305.
    expect(
      await pinnedLine('pf1', findFeature('bane')?.acquisitionFormula ?? ''),
    ).toContain("maxFormula: '@class.level'");
    expect(
      await pinnedLine(
        'pcgen',
        'roleplaying_game/advanced_players_guide/apg_abilities_class.lst:305',
      ),
    ).toContain('BONUS:VAR|InquisitorBanePool|InquisitorLVL');
  });

  it('gives each class the skill ranks per level of its table, as Foundry records them', async () => {
    // Inquisitor 6, magus 2 ranks + Int modifier (INQ:353, MAG:355).
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
    expect(ranks).toEqual([6, 2]);
  });

  it('reads the TYPE bridges from the global variables, not by spelling', () => {
    // apg_abilities_globalvar.lst:418: TYPE.InquisitorJudgements sets
    // Inquisitor_CF_Judgment; :426 the 6th-level teamwork feat.
    expect(derive('Inquisitor').typeBridges.get('InquisitorJudgements')).toBe(
      'Judgment',
    );
    expect(
      derive('Inquisitor').typeBridges.get('InquisitorTeamworkFeat6'),
    ).toBe('TeamworkFeat6');
    // um_abilities_globalvar.lst:99, :104.
    expect(derive('Magus').typeBridges.get('MagusArcanaLvl3')).toBe('Arcana3');
    expect(derive('Magus').typeBridges.get('MagusArmorProficiency')).toBe(
      'ArmorProficiency',
    );
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
      ['Inquisitor', 'judgment', '1 + floor((@class.level - 1) / 3)'],
      ['Inquisitor', 'teamwork-feat', 'floor(@class.level / 3)'],
      ['Magus', 'bonus-feats', 'floor((@class.level + 1) / 6)'],
    ] as const)
      expect(
        await pinnedLine('pf1', readAcquisitionFormula({ className, id })),
        id,
      ).toContain(text);
    // Magus arcana computes nothing from the level.
    expect(
      readAcquisitionFormula({ className: 'Magus', id: 'magus-arcana' }),
    ).toBe('');
    expect(
      await readPinned(
        'pf1',
        'packs/class-abilities/magus-arcana.HJ2vLLDYkihPxFkD.yaml',
      ),
    ).not.toContain('@class.level');
  });
});

describe('per-increment identities (note Q7, item 7)', () => {
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
      // 21 features; judgment 6 and teamwork feats 5.
      Inquisitor: [21, 11, 32],
      // 19 features; magus arcana 5 and bonus feats 2.
      Magus: [19, 7, 26],
    });
  });

  it('names the later rows by their table labels', () => {
    expect(listIncrementNames(schedule('Inquisitor'))).toMatchObject({
      'everythingpath/inquisitor-teamwork-feat-6': 'Teamwork Feat',
      'everythingpath/inquisitor-teamwork-feat-18': 'Teamwork Feat',
    });
    expect(listIncrementNames(schedule('Magus'))).toMatchObject({
      'everythingpath/magus-magus-arcana-6': 'Magus Arcana',
      'everythingpath/magus-magus-arcana-15': 'Magus Arcana',
      'everythingpath/magus-bonus-feats-11': 'Bonus Feat',
      'everythingpath/magus-bonus-feats-17': 'Bonus Feat',
    });
  });

  it('has no feature schedule seed to equal, and agrees with the magus seed’s ranks, class skills and proficiencies', async () => {
    // convex/lib/representativeClassCatalog.ts:680-715 (featuresByLevel: []),
    // :1046; no inquisitor seed (note Q6).
    for (const identity of ['inquisitor', 'magus']) {
      expect(representativeClassFeatureSchedules).not.toHaveProperty(identity);
      expect(representativeSpellcastingSchedules).not.toHaveProperty(identity);
    }
    expect(
      representativeClassCatalog.some(
        ({ ruleIdentity }) => ruleIdentity === 'inquisitor',
      ),
    ).toBe(false);
    const seed = representativeClassCatalog.find(
      ({ ruleIdentity }) => ruleIdentity === 'magus',
    );
    if (seed?.detail.kind !== 'class') throw new Error('No magus seed.');
    const magus = schedule('Magus');
    expect(seed.ruleIdentity).toBe(magus.slug);
    expect(seed.detail.featuresByLevel).toEqual([]);
    expect(seed.detail.skillRanksPerLevel).toBe(magus.skillRanksPerLevel);
    // MAG:354 prints twelve class skills; Foundry adds the background skills
    // Artistry and Lore (magus.xZLcyrEKYZoJPS2k.yaml:18-32).
    const foundry = await readPinned('pf1', magus.foundryFile);
    const foundrySkills = [...foundry.matchAll(/^ {4}([a-z]{3}): true$/gm)].map(
      ([, id]) => `skill.${id}`,
    );
    expect(
      foundrySkills.filter((id) => id !== 'skill.art' && id !== 'skill.lor'),
    ).toEqual(seed.detail.classSkills);
    expect(seed.detail.classSkills).toHaveLength(12);
    // MAG:388: simple and martial weapons, light armor; Foundry's
    // weaponProf and armorProf (:8-9, :108-110).
    expect(seed.proficiencies).toEqual([
      { category: 'simple' },
      { category: 'martial' },
      { category: 'light' },
    ]);
    expect(foundry).toContain('armorProf:\n    - lgt\n');
    expect(foundry).toContain('weaponProf:\n    - simple\n    - martial\n');
  });
});

// The published archetypes through the mapper (note Q2, Q4, Q5), each in a
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

describe('the #772 archetypes through the mapper (note Q2, Q4)', () => {
  it('assigns every inquisitor and magus archetype of the tree to its class', () => {
    for (const className of classNames) {
      const owned = inventory.owners.filter(({ record }) =>
        record.locator.key.startsWith(`${className} Archetype ~ `),
      );
      expect(owned.length, className).toBeGreaterThan(0);
      for (const { record, className: assigned } of owned)
        expect(assigned, record.locator.key).toBe(className);
    }
  });

  it('Inquisitor: Spellbreaker replaces monster lore, the teamwork feats, solo tactics and true judgment, its undefined FinalJudgment held on the defect', async () => {
    // UC p.40: strong-willed "replaces monster lore", foil casting "replaces
    // solo tactics" (ultimateCombat/classArchetypes/inquisitor.html:368,
    // :370); impervious replaces the 20th-level feature, which the
    // archetype's page calls final judgment (:371) and the class table true
    // judgment (INQ:377).
    const page = await readPrdText({
      page: 'ultimateCombat/classArchetypes/inquisitor.html',
      from: 368,
      to: 371,
    });
    expect(page).toContain('This ability replaces monster lore.');
    expect(page).toContain('This ability replaces solo tactics.');
    const archetype = 'Inquisitor Archetype ~ Spellbreaker';
    expect(readInventoryClass({ inventory, archetype })).toBe('Inquisitor');
    const mapping = mapInventoryArchetype(archetype);
    expect(listReplacements(mapping)).toEqual([
      [1, 'pf1/9Y9dpXEcjXGtH6Pe', 'whole'],
      [3, 'pf1/717fyDCcfLtD345B', 'whole'],
      [3, 'pf1/10EysX8x5hvz48lr', 'whole'],
      [20, 'pf1/1SnLu7RJAq1hJzYg', 'whole'],
    ]);
    // A whole teamwork feat removal raises no partialFormula. Its PREMULT
    // guard names TYPE.InquisitorBonusTeamworkFeat, not its own
    // InquisitorTeamworkFeat (uc_abilities_class.lst:870).
    expect(summarizeItems(mapping)).toEqual([
      ['conflict', 'defect:final-judgment'],
      ['conflict', 'stackingGuard'],
    ]);
    expect(planArchetypeBatch({ className: 'Inquisitor', mapping })).toEqual([
      5,
    ]);
  });

  it('Inquisitor: Sin Eater replaces the domain, the 6th-level teamwork feat and exploit weakness, the part held on teamwork feat’s formula', () => {
    // UM p.39: eat sin "replaces an inquisitor's domain"; speak with dead
    // "replaces the bonus teamwork feat gained at 6th level"; burden of sin
    // "replaces exploit weakness"
    // (ultimateMagic/spellcastingClassOptions/inquisitor.html:477-479);
    // um_abilities_class.lst:2677.
    const archetype = 'Inquisitor Archetype ~ Sin Eater';
    expect(readInventoryClass({ inventory, archetype })).toBe('Inquisitor');
    const mapping = mapInventoryArchetype(archetype);
    expect(listReplacements(mapping)).toEqual([
      [1, 'pf1/dMtxCqoMLtD9nEjU', 'whole'],
      [6, 'everythingpath/inquisitor-teamwork-feat-6', 'part'],
      [14, 'pf1/UGtjpdIwNF8mAh4z', 'whole'],
    ]);
    // Foundry's teamwork feat counts every feat from the level
    // (teamwork-feat.717fyDCcfLtD345B.yaml:13).
    expect(summarizeItems(mapping)).toEqual([
      ['conflict', 'partialFormula:teamwork-feat'],
    ]);
    expect(planArchetypeBatch({ className: 'Inquisitor', mapping })).toEqual([
      4,
    ]);
  });

  it('Magus: Staff Magus replaces fighter training; its armor proficiency flag is held on the armor defect, its text replacing medium and heavy armor by another ability', async () => {
    // UM p.20: quarterstaff defense "replaces the medium armor and heavy
    // armor class abilities", staff weapon "replaces fighter training"
    // (ultimateMagic/spellcastingClassOptions/magus.html:406-407). PCGen sets
    // only Magus_CF_ArmorProficiency (um_abilities_class.lst:2681), which
    // names no armor row: the medium and heavy armor rows stay for review.
    const page = await readPrdText({
      page: 'ultimateMagic/spellcastingClassOptions/magus.html',
      from: 404,
      to: 407,
    });
    expect(page).toContain(
      'This replaces the normal magus weapon and armor proficiency feature.',
    );
    expect(page).toContain(
      'This ability replaces the medium armor and heavy armor class abilities.',
    );
    const archetype = 'Magus Archetype ~ Staff Magus';
    expect(readInventoryClass({ inventory, archetype })).toBe('Magus');
    const mapping = mapInventoryArchetype(archetype);
    expect(listReplacements(mapping)).toEqual([
      [10, 'pf1/ePNt8fgtaAxmLnHs', 'whole'],
    ]);
    expect(summarizeItems(mapping)).toEqual([
      ['conflict', 'defect:armor-flags'],
    ]);
  });
});

describe('the magus #422 scan (note Q5)', () => {
  const mindblade = mapInventoryArchetype('Magus Archetype ~ Mindblade');
  const eldritchScion = mapInventoryArchetype(
    'Magus Archetype ~ Eldritch Scion',
  );
  const spells = { externalKey: 'pf1/Bd6X95yJfPz6zPkP', scope: 'whole' };
  const getSeedFeatureChanges = (ruleIdentity: string) => {
    const seed = representativeArchetypeCatalog.find(
      (entry) => entry.ruleIdentity === ruleIdentity,
    );
    if (seed?.detail?.kind !== 'archetype')
      throw new Error(`No ${ruleIdentity} seed.`);
    return seed.detail.featureChanges ?? [];
  };

  it('counts the spells, cantrips, spellbooks and greater spell access as the magus’s casting rows', () => {
    // Greater spell access adds wizard spells to the magus list (MAG:433),
    // a casting change as the bloodrager's bloodline spells are; spell recall
    // and knowledge pool spend arcane pool on the magus's own spells, as the
    // skald's spell kenning, no casting row, spends a slot.
    expect(
      schedule('Magus')
        .features.filter(({ casting }) => casting)
        .map(({ id }) => id),
    ).toEqual(['cantrips', 'spellbooks', 'spells', 'greater-spell-access']);
    expect(
      schedule('Inquisitor')
        .features.filter(({ casting }) => casting)
        .map(({ id }) => id),
    ).toEqual(['orisons', 'spells', 'exchange-spell']);
  });

  it('maps both specimens’ spells, as their seeds name them (docs/catalog-import/archetypes.md:144-154)', () => {
    for (const [ruleIdentity, mapping] of [
      ['magus-mindblade', mindblade],
      ['magus-eldritch-scion', eldritchScion],
    ] as const) {
      expect(getSeedFeatureChanges(ruleIdentity)).toEqual([
        { featureIdentity: 'magus-spells', scope: 'whole' },
      ]);
      expect(readArchetypeDetail(mapping).featureChanges).toContainEqual(
        spells,
      );
    }
  });

  it('Mindblade: replaces seven features whole, alters the spells and touches two casting rows; its armor proficiency flag is held on the armor defect', () => {
    // OA pp.121-122 (occultAdventures/archetypes/other.html:540-548); its
    // FACTs (oa_abilities_class.lst:1783) set no Magus_CF_Spells, only
    // Magus_Archetype_Spells, and no medium or heavy armor flag, though its
    // text replaces both (:546, :548): review items, not seed rewrites.
    expect(listReplacements(mindblade)).toEqual([
      [8, 'pf1/G1z392b58wRybqjL', 'whole'],
      [4, 'pf1/IyfoUjtyaS8lakWc', 'whole'],
      [7, 'pf1/QhHS0Qr5FxH4LtaI', 'whole'],
      [11, 'pf1/dakApiblq3ad7AZI', 'whole'],
      [14, 'pf1/nWDMATASYzzAShr6', 'whole'],
      [19, 'pf1/i64BU7HTfaRJEYFj', 'whole'],
      [1, 'pf1/mpe3JHJMINddqLWr', 'whole'],
    ]);
    // It grants light armor proficiency back itself, as an Internal TYPE
    // grant no feature record resolves (oa_abilities_class.lst:1783).
    expect(summarizeItems(mindblade)).toEqual([
      ['unmatchedReplacement', 'alters:spells'],
      ['uncheckedCasting', 'casting:greater-spell-access'],
      ['uncheckedCasting', 'casting:spells'],
      ['conflict', 'defect:armor-flags'],
      ['unmatchedReplacement', 'grant:Internal|TYPE=ArmorProfLight'],
    ]);
  });

  it('Eldritch Scion: replaces the spells, arcane pool, spell recall and knowledge pool, and alters the spell combats by same-named grants', () => {
    // ACG p.104 (advancedClassGuide/classOptions/magus.html:356-366);
    // acg_abilities_class.lst:4653.
    expect(listReplacements(eldritchScion)).toEqual([
      [1, 'pf1/Bd6X95yJfPz6zPkP', 'whole'],
      [4, 'pf1/IyfoUjtyaS8lakWc', 'whole'],
      [1, 'pf1/mpe3JHJMINddqLWr', 'whole'],
      [7, 'pf1/QhHS0Qr5FxH4LtaI', 'whole'],
    ]);
    // Its PREMULT guard also names the three spell combats
    // (acg_abilities_class.lst:3374), which its flags only alter.
    expect(summarizeItems(eldritchScion)).toEqual([
      ['uncheckedCasting', 'casting:spells'],
      ['unmatchedReplacement', 'alters:spell-combat'],
      ['unmatchedReplacement', 'alters:improved-spell-combat'],
      ['unmatchedReplacement', 'alters:greater-spell-combat'],
      ['conflict', 'stackingGuard'],
    ]);
  });

  it('changes more than the seeds name: each difference is a review item, the seeds unchanged', () => {
    // The seeds name only the spells (representativeArchetypeCatalog.ts:795,
    // :812); the mappings change every feature the specimens' flags name.
    // Mindblade's text also replaces medium and heavy armor (other.html:546,
    // :548), which no flag names, and its armor proficiency flag has no
    // text; Eldritch Scion's PCGen spells flag gates nothing
    // (um_abilities_globalvar.lst:32): its casting changes by name and seed
    // alone.
    const listWholes = (mapping: typeof mindblade) =>
      (readArchetypeDetail(mapping).featureChanges ?? [])
        .filter(({ scope }) => scope === 'whole')
        .map(({ externalKey }) => externalKey)
        .sort();
    expect(listWholes(mindblade)).toEqual(
      [
        'pf1/mpe3JHJMINddqLWr',
        'pf1/Bd6X95yJfPz6zPkP',
        'pf1/IyfoUjtyaS8lakWc',
        'pf1/QhHS0Qr5FxH4LtaI',
        'pf1/G1z392b58wRybqjL',
        'pf1/dakApiblq3ad7AZI',
        'pf1/nWDMATASYzzAShr6',
        'pf1/i64BU7HTfaRJEYFj',
      ].sort(),
    );
    expect(listWholes(eldritchScion)).toEqual(
      [
        'pf1/mpe3JHJMINddqLWr',
        'pf1/Bd6X95yJfPz6zPkP',
        'pf1/IyfoUjtyaS8lakWc',
        'pf1/QhHS0Qr5FxH4LtaI',
      ].sort(),
    );
    for (const mapping of [mindblade, eldritchScion])
      expect(
        listReplacements(mapping).filter(([, externalKey]) =>
          ['pf1/Js83QWyHQQ4PjP0m', 'pf1/0AXAMXGLJIw7CGBd'].includes(
            String(externalKey),
          ),
        ),
      ).toEqual([]);
  });

  it('raises uncheckedCasting on every touch of a casting row, never settling it', () => {
    for (const mapping of [mindblade, eldritchScion])
      expect(
        mapping.items.filter(({ kind }) => kind === 'uncheckedCasting'),
      ).toContainEqual(
        expect.objectContaining({
          id: 'casting:spells',
          fields: ['detail.casting'],
        }),
      );
  });

  it('finds Mindblade × Eldritch Scion conflicting on the spells, arcane pool, spell recall and knowledge pool', () => {
    expect(
      stackingConflicts([mindblade, eldritchScion]).conflicts.map(
        ({ feature, part }) => [feature, part],
      ),
    ).toEqual([
      ['pf1/IyfoUjtyaS8lakWc', null],
      ['pf1/QhHS0Qr5FxH4LtaI', null],
      ['pf1/mpe3JHJMINddqLWr', null],
      ['pf1/Bd6X95yJfPz6zPkP', null],
    ]);
  });
});
