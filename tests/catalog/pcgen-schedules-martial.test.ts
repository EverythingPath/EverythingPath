// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  representativeAdditionalClassFeatures,
  representativeClassFeatureSchedules,
} from '../../convex/lib/representativeClassCatalog';
import { parseIdentityLedger } from '../../scripts/catalog/everythingpath-identities';
import ledger from '../../scripts/catalog/everythingpath-identities.json';
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
import { pcgen716MartialFiles } from '../fixtures/pcgen-716/martial-files';
import {
  bindArchetypeMapper,
  brief,
  comparePrintedColumns,
  comparePrintedRows,
  listIncrementNames,
  listReplacements,
  normalizePrintedLabel,
  pinnedLine,
  planArchetypeBatch,
  readArchetypeDetail,
  scheduleChecks,
  summarizeItems,
} from './pcgen-716-schedules';
import { readPcgenFixtureTree } from './pcgen-716-tree';
import { readPinned } from './pinned-sources';

// #716 P7b (research note 716-p7-rules §1, §3, §5, §6): the reviewed
// schedules of the Monk, Monk (Unchained), Brawler, Ninja and Rogue
// (Unchained), checked against the pinned PCGen, Foundry and PRD files.
// Every scenario reads pinned files or builds its records in memory, never
// committed curation state.

const tree = await readPcgenFixtureTree(pcgen716MartialFiles);
const view = buildEffectiveView(tree);
const inventory = inventoryPcgen(tree);
const reservedKeys = allIncrementKeys();
const identities = assignPcgenIdentities({
  inventory,
  view,
  ledger: parseIdentityLedger(ledger, { reservedKeys }),
  books: pcgenBookFacts(await readPinned('pf1', 'module/registry/sources.mjs')),
  reservedKeys,
});

const classNames = [
  'Monk',
  'Monk (Unchained)',
  'Brawler',
  'Ninja',
  'Rogue (Unchained)',
] as const;
type ClassName = (typeof classNames)[number];

const { schedule, derive, compare, levelOf, countGrantKinds } = scheduleChecks({
  tree,
  view,
});

describe('the P7b schedules’ numbered variables (#716 P7b, note §5.1)', () => {
  it('gives every numbered variable its explicit level: by class level, by order or by value', () => {
    // CRB p.59: slow fall 20 ft. at 4th, 10 feet more every 2 levels; PCGen
    // counts the feet (cr_abilities_class.lst:1121-1129).
    expect(levelOf('Monk', 'SlowFall10')).toEqual(['slow-fall', 4]);
    expect(levelOf('Monk', 'SlowFall20')).toEqual(['slow-fall', 4]);
    expect(levelOf('Monk', 'SlowFall80')).toEqual(['slow-fall', 16]);
    // Ki strike's steps: the 4th-level magic step is KiPoolAbilities1
    // (:1195-1198).
    expect(levelOf('Monk', 'KiPoolAbilities1')).toEqual(['ki-pool', 4]);
    expect(levelOf('Monk', 'KiPoolAbilities10')).toEqual(['ki-pool', 10]);
    // Named by level, gated by count (:1210-1217).
    expect(levelOf('Monk', 'BonusFeat14')).toEqual(['bonus-feat', 14]);
    // Pathfinder Unchained p.16: a ki power at 4th and every 2 levels.
    expect(levelOf('Monk (Unchained)', 'KiPowers12')).toEqual([
      'ki-powers',
      12,
    ]);
    // The CRB's bonus feat names, as the Unchained archetypes set them.
    expect(levelOf('Monk (Unchained)', 'BonusFeat6')).toEqual([
      'bonus-feat',
      6,
    ]);
    expect(levelOf('Monk (Unchained)', 'BonusFeats')).toEqual([
      'bonus-feat',
      null,
    ]);
    // ACG p.24: a bonus combat feat at 2nd and every 3 levels.
    expect(levelOf('Brawler', 'BonusFeat11')).toEqual(['bonus-feats', 11]);
    // UC p.14: a ninja trick at 2nd and every 2 levels.
    expect(levelOf('Ninja', 'NinjaTrick8')).toEqual(['ninja-tricks', 8]);
    // Pathfinder Unchained p.20: finesse training by order, the 2nd at 3rd;
    // danger sense on the shared trap sense names.
    expect(levelOf('Rogue (Unchained)', 'FinesseTraining2')).toEqual([
      'finesse-training',
      3,
    ]);
    expect(levelOf('Rogue (Unchained)', 'FinesseTraining4')).toEqual([
      'finesse-training',
      19,
    ]);
    expect(levelOf('Rogue (Unchained)', 'TrapSense')).toEqual([
      'danger-sense',
      null,
    ]);
    expect(levelOf('Rogue (Unchained)', 'TrapSense2')).toEqual([
      'danger-sense',
      6,
    ]);
    expect(levelOf('Rogue (Unchained)', 'RogueTalent10')).toEqual([
      'talent',
      10,
    ]);
    // Not table rows.
    expect(levelOf('Monk', 'Alignment')).toEqual(['notOnTable']);
    expect(levelOf('Monk (Unchained)', 'WeaponandArmorProficiency')).toEqual([
      'proficiency',
    ]);
    expect(levelOf('Rogue (Unchained)', 'Skills')).toEqual(['classSkills']);
    // The ninja's acquisition gate, a FACT PCGen reads as an undefined
    // variable (uc_abilities_globalvar.lst:21).
    expect(levelOf('Ninja', 'Trick')).toEqual(['unknown']);
    // The CRB monk numbers no ki power.
    expect(levelOf('Monk', 'KiPowers4')).toEqual(['unknown']);
  });
});

describe('each P7b schedule against the PRD’s class table (#716 P7b, owner decision 8)', () => {
  it('prints every row at its level, with its label, in the cited table row', async () => {
    for (const className of classNames) {
      const { printedTable } = schedule(className);
      if (printedTable?.status !== 'reviewed')
        throw new Error(`${className} has no reviewed table.`);
      const rows = await comparePrintedRows(schedule(className));
      // Twenty rows, the 1st-level row at the cited line and each level's
      // on the next.
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
  });

  it('cites the column that prints each monk’s AC bonus, and the ki strike the unchained ki pool row prints', async () => {
    for (const className of ['Monk', 'Monk (Unchained)'] as const) {
      const { printedTable } = schedule(className);
      if (printedTable?.status !== 'reviewed') throw new Error(className);
      expect(Object.keys(printedTable.unprinted)).toEqual(['ac-bonus']);
      const header = /\((\S+?\.html:\d+)\)/.exec(
        printedTable.unprinted['ac-bonus'] ?? '',
      )?.[1];
      expect(await pinnedLine('prd', `pages/${header}`)).toContain('AC Bonus');
    }
    // Unchained Monk table, 3rd level: "Ki pool, ki strike (magic)".
    expect(
      (await comparePrintedRows(schedule('Monk (Unchained)')))[2]?.table,
    ).toEqual(['fast movement', 'ki pool', 'ki strike (magic)']);
    // Every other P7b table prints every row.
    for (const className of ['Brawler', 'Ninja', 'Rogue (Unchained)'] as const)
      expect(schedule(className).printedTable).toMatchObject({
        unprinted: {},
      });
  });

  it('steps each monk’s unarmed damage, AC bonus, fast movement and CRB flurry where its own column does', async () => {
    const compareColumnSteps = async (className: ClassName) =>
      Object.fromEntries(
        (await comparePrintedColumns(schedule(className))).map(
          ({ feature, schedule: rows, table }) => {
            // Each later row at the level its column steps, labelled with
            // the value the column prints there.
            expect(
              rows.map(({ level }) => level),
              `${className} ${feature}`,
            ).toEqual(table.map(({ level }) => level));
            for (const [index, { label }] of rows.entries())
              if (table[index]?.reading === 'value')
                expect(
                  normalizePrintedLabel(label),
                  `${className} ${feature}`,
                ).toContain(normalizePrintedLabel(table[index].printed));
            return [feature, table.map(({ level }) => level)];
          },
        ),
      );
    // Table: Monk (monk.html:356-376): unarmed damage 1d8 at 4th to 2d10 at
    // 20th, AC bonus +1 at 4th to +5 at 20th, fast movement +20 ft. at 6th
    // to +60 ft. at 18th, and the flurry's attacks beyond a base attack bonus
    // equal to the monk level (:385) at 8th (+6/+6/+1/+1) and 15th
    // (+13/+13/+8/+8/+3/+3).
    expect(await compareColumnSteps('Monk')).toEqual({
      flurry: [8, 15],
      'unarmed-strike': [4, 8, 12, 16, 20],
      'ac-bonus': [4, 8, 12, 16, 20],
      'fast-movement': [6, 9, 12, 15, 18],
    });
    // The Unchained Monk table (monk.html:370-394) prints its flurry's bonus
    // attacks in the Special column.
    expect(await compareColumnSteps('Monk (Unchained)')).toEqual({
      'unarmed-strike': [4, 8, 12, 16, 20],
      'ac-bonus': [4, 8, 12, 16, 20],
      'fast-movement': [6, 9, 12, 15, 18],
    });
    for (const className of ['Brawler', 'Ninja', 'Rogue (Unchained)'] as const)
      expect(await comparePrintedColumns(schedule(className))).toEqual([]);
  });
});

describe('PCGen’s schedule against each table (#716 P7b, note §5.2–3)', () => {
  it('settles every difference between PCGen, Foundry and the table with a cited decision or defect', async () => {
    for (const className of classNames)
      expect(
        (await compare(className)).filter(({ settledBy }) => !settledBy),
        className,
      ).toEqual([]);
    // CRB p.57: the 14th-level bonus feat's variable is never defined.
    expect(brief(await compare('Monk'))).toEqual([
      ['undefinedPart', 'bonus-feat', 'bonus-feat-14'],
      ['formulaIncrement', 'flurry', 'decision:flurry'],
      ['formulaIncrement', 'unarmed-strike', 'decision:unarmed-strike'],
      ['formulaIncrement', 'ac-bonus', 'decision:ac-bonus'],
      ['formulaIncrement', 'fast-movement', 'decision:fast-movement'],
    ]);
    expect(brief(await compare('Monk (Unchained)'))).toEqual([
      [
        'nonRow',
        'WeaponandArmorProficiency',
        'nonRow:WeaponandArmorProficiency',
      ],
      ['formulaIncrement', 'flurry', 'decision:flurry'],
      ['formulaIncrement', 'unarmed-strike', 'decision:unarmed-strike'],
      ['formulaIncrement', 'ac-bonus', 'decision:ac-bonus'],
      ['undefinedPart', 'bonus-feat', 'unchained-bonus-feat-flags'],
      ['formulaIncrement', 'fast-movement', 'decision:fast-movement'],
      ['formulaIncrement', 'ki-pool', 'decision:ki-pool'],
      ['formulaIncrement', 'style-strike', 'decision:style-strike'],
    ]);
    expect(brief(await compare('Brawler'))).toEqual([
      ['nonRow', 'Proficiencies', 'nonRow:Proficiencies'],
      [
        'formulaIncrement',
        'martial-flexibility',
        'decision:martial-flexibility',
      ],
      ['foundryOnly', 'unarmed-strike', 'decision:unarmed-strike'],
      ['formulaIncrement', 'brawlers-flurry', 'decision:brawlers-flurry'],
      ['formulaIncrement', 'maneuver-training', 'decision:maneuver-training'],
      ['formulaIncrement', 'ac-bonus', 'decision:ac-bonus'],
      ['formulaIncrement', 'knockout', 'decision:knockout'],
      ['formulaIncrement', 'brawlers-strike', 'decision:brawlers-strike'],
    ]);
    // Improved uncanny dodge's grant, Uncanny Dodge ~ Base at 8, is its own
    // row's (uc_abilities_globalvar.lst:26), so it raises no finding.
    expect(brief(await compare('Ninja'))).toEqual([
      ['sharedGate', 'ninja-tricks', 'ninja-trick-gate'],
      ['formulaIncrement', 'sneak-attack', 'decision:sneak-attack'],
      ['formulaIncrement', 'no-trace', 'decision:no-trace'],
      ['foundryOnly', 'master-tricks', 'decision:master-tricks'],
    ]);
    expect(brief(await compare('Rogue (Unchained)'))).toEqual([
      ['nonRow', 'ArmorProficiency', 'nonRow:ArmorProficiency'],
      ['nonRow', 'Skills', 'nonRow:Skills'],
      ['nonRow', 'WeaponProficiency', 'nonRow:WeaponProficiency'],
      ['ungatedParts', 'sneak-attack', 'decision:sneak-attack'],
      ['ungatedParts', 'danger-sense', 'decision:danger-sense'],
      ['formulaIncrement', 'rogues-edge', 'decision:rogues-edge'],
      [
        'foundryOnly',
        'improved-uncanny-dodge',
        'decision:improved-uncanny-dodge',
      ],
      ['foundryOnly', 'advanced-talents', 'decision:advanced-talents'],
    ]);
  });
});

describe('P7-0’s grant kinds in the P7b classes (#716 P7b, note §5.3)', () => {
  it('reads each class’s gated grants, and finds no ungated or nested one', () => {
    // Every grant is gated: the CRB monk's on Monk ~ Standard Class
    // (cr_abilities_class.lst:171-193), the Unchained versions' on their own
    // records (pu_abilities_class.lst:154-171, :217-229), the brawler's on
    // its class block's level lines (acg_classes.lst:91-103) and the
    // ninja's on its class record (uc_abilities_globalvar.lst:19-27).
    expect(
      Object.fromEntries(
        classNames.map((name) => [name, countGrantKinds(name)]),
      ),
    ).toEqual({
      Monk: [23, 0, 0],
      'Monk (Unchained)': [18, 0, 0],
      Brawler: [13, 0, 0],
      Ninja: [9, 0, 0],
      'Rogue (Unchained)': [13, 0, 0],
    });
    // The brawler's grants stand on the level lines of its class block.
    expect(
      derive('Brawler').acquisitions.map(({ granted, level }) => [
        granted,
        level,
      ]),
    ).toContainEqual(['Brawler ~ Bonus Feats', 2]);
  });

  it('reads Uncanny Dodge ~ Base at 4 and at 8 as the ninja’s two uncanny dodge rows', () => {
    // UC pp.15–16: uncanny dodge at 4th, improved uncanny dodge at 8th; PCGen
    // grants the same record on each gate.
    expect(
      derive('Ninja')
        .acquisitions.filter(
          ({ granted }) => granted === 'Uncanny Dodge ~ Base',
        )
        .map(({ suffix, level }) => [suffix, level]),
    ).toEqual([
      ['UncannyDodge', 4],
      ['ImprovedUncannyDodge', 8],
    ]);
    expect(
      schedule('Ninja')
        .features.filter(
          ({ pcgen }) => pcgen?.granted === 'Uncanny Dodge ~ Base',
        )
        .map(({ id, pcgen }) => [id, pcgen?.level]),
    ).toEqual([
      ['uncanny-dodge', 4],
      ['improved-uncanny-dodge', 8],
    ]);
  });

  it('keeps each Unchained schedule to its own record and slug, with no shared gate', async () => {
    for (const [className, prefix, slug] of [
      ['Monk (Unchained)', 'Unchained Monk ~', 'unchained-monk'],
      ['Rogue (Unchained)', 'Unchained Rogue ~', 'unchained-rogue'],
    ] as const) {
      expect(
        derive(className).acquisitions.filter(
          ({ granted }) => !granted.startsWith(prefix),
        ),
        className,
      ).toEqual([]);
      expect(
        (await compare(className)).filter(({ kind }) => kind === 'sharedGate'),
        className,
      ).toEqual([]);
      expect(schedule(className).slug).toBe(slug);
      for (const { externalKey } of incrementEntries(schedule(className)))
        expect(externalKey.startsWith(`everythingpath/${slug}-`)).toBe(true);
    }
    // The flags are the standard classes' (cr_abilities_globalvar.lst:513,
    // :875), and the Unchained records add their own
    // (pu_abilities_class.lst:184, :232).
    expect(derive('Monk (Unchained)').defined.has('BonusFeats')).toBe(true);
    expect(derive('Monk (Unchained)').defined.has('KiPowers')).toBe(true);
    expect(derive('Rogue (Unchained)').defined.has('TrapSense')).toBe(true);
    expect(derive('Rogue (Unchained)').defined.has('FinesseTraining')).toBe(
      true,
    );
  });

  it('finds the CRB monk’s bonus feat gates under the shared names the Unchained archetypes set', () => {
    // Monk_CF_BonusFeat6 gates the CRB monk's pool alone
    // (cr_abilities_class.lst:1214); the Unchained monk's pool numbers none
    // (pu_abilities_class.lst:461), hence the reviewed defect.
    expect(derive('Monk (Unchained)').gatedParts.get('BonusFeat6')?.at).toBe(
      'roleplaying_game/core_rulebook/cr_abilities_class.lst:1214',
    );
    expect(schedule('Monk (Unchained)').defects.map(({ id }) => id)).toEqual([
      'unchained-bonus-feat-flags',
    ]);
  });
});

describe('formula rows, skill ranks and bridges (#716 P7b, note §5.4–5)', () => {
  it('holds each formula-held feature’s later rows in the schedule alone, and numbers every other repeating feature', async () => {
    const formulaHeld: Record<ClassName, string[]> = {
      // The monks' unarmed damage, AC bonus and fast movement, and the CRB
      // monk's flurry, step in columns of their own (note §3: "Formula:
      // flurry, unarmed damage, AC bonus, fast movement").
      Monk: ['flurry', 'unarmed-strike', 'ac-bonus', 'fast-movement'],
      'Monk (Unchained)': [
        'flurry',
        'unarmed-strike',
        'ac-bonus',
        'fast-movement',
        'ki-pool',
        'style-strike',
      ],
      Brawler: [
        'martial-flexibility',
        'brawlers-flurry',
        'maneuver-training',
        'ac-bonus',
        'knockout',
        'brawlers-strike',
      ],
      Ninja: ['sneak-attack', 'no-trace'],
      'Rogue (Unchained)': ['rogues-edge'],
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
      const ungated = findings
        .filter(({ kind }) => kind === 'ungatedParts')
        .map(({ feature }) => feature);
      for (const feature of schedule(className).features)
        if (
          feature.levels.length > 1 &&
          !formulaHeld[className].includes(feature.id) &&
          !ungated.includes(feature.id)
        )
          expect(
            Object.keys(feature.parts).some((part) => gatedParts.has(part)),
            `${className} ${feature.id}`,
          ).toBe(true);
    }
    // The CRB monk's column-printed features, each held in a formula: its
    // acquisition, then the steps of its column (monk.html:357-376).
    const findMonkFeature = (id: string) =>
      schedule('Monk').features.find((feature) => feature.id === id);
    expect(
      ['flurry', 'unarmed-strike', 'ac-bonus', 'fast-movement'].map((id) => [
        findMonkFeature(id)?.increments,
        findMonkFeature(id)?.levels,
      ]),
    ).toEqual([
      ['formula', [1, 8, 15]],
      ['formula', [1, 4, 8, 12, 16, 20]],
      ['formula', [1, 4, 8, 12, 16, 20]],
      ['formula', [3, 6, 9, 12, 15, 18]],
    ]);
  });

  it('gives each class the skill ranks per level of its table, as Foundry records them', async () => {
    // Monk 4, both Unchained classes and the ninja 8 and 4, brawler 4
    // ranks + Int modifier.
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
    expect(ranks).toEqual([4, 4, 4, 8, 8]);
  });

  it('reads the TYPE bridges from the global variables, not by spelling', () => {
    // cr_abilities_globalvar.lst:615, :637.
    const monk = derive('Monk').typeBridges;
    expect(monk.get('MonkBonusFeats')).toBe('BonusFeats');
    expect(monk.get('MonkWeaponProficiencies')).toBe('Proficiencies');
    // acg_abilities_globalvar.lst, the brawler's.
    expect(derive('Brawler').typeBridges.get('BrawlerACBonus')).toBe('ACBonus');
    // uc_abilities_globalvar.lst:233, :235: the ninja's poison and trick.
    const ninja = derive('Ninja').typeBridges;
    expect(ninja.get('NinjaPoison')).toBe('PoisonUse');
    expect(ninja.get('NinjaTrick')).toBe('NinjaTrick');
    // Shared by both rogues (cr_abilities_globalvar.lst).
    expect(derive('Rogue (Unchained)').typeBridges.get('RogueTrapSense')).toBe(
      'TrapSense',
    );
  });

  it('cites the Foundry lines that compute the repeating features’ increments', async () => {
    const readAcquisitionFormula = (className: ClassName, id: string) =>
      schedule(className).features.find((feature) => feature.id === id)
        ?.acquisitionFormula ?? '';
    for (const [className, id, text] of [
      ['Monk', 'bonus-feat', '1 + floor((@class.level + 2) / 4)'],
      ['Monk', 'ac-bonus', 'floor(@class.level / 4)'],
      ['Monk', 'fast-movement', '10 * (floor(@class.level / 3))'],
      ['Monk (Unchained)', 'bonus-feat', '1 + floor((@class.level + 2) / 4)'],
      ['Monk (Unchained)', 'ac-bonus', 'floor(@class.level / 4)'],
      ['Monk (Unchained)', 'fast-movement', '10 * (floor(@class.level / 3))'],
      ['Brawler', 'bonus-feats', 'floor((@class.level + 1) / 3)'],
      ['Brawler', 'ac-bonus', 'floor((@class.level - 1) / 4)'],
      ['Brawler', 'knockout', 'gte(@class.level, 10)'],
      ['Ninja', 'sneak-attack', '(ceil(@class.level / 2))d6'],
      ['Ninja', 'no-trace', 'floor(@class.level / 3)'],
      ['Rogue (Unchained)', 'sneak-attack', '(ceil(@class.level / 2))d6'],
      ['Rogue (Unchained)', 'danger-sense', 'floor(@class.level / 3)'],
      ['Rogue (Unchained)', 'rogues-edge', 'floor(@class.level / 5)'],
    ] as const)
      expect(
        await pinnedLine('pf1', readAcquisitionFormula(className, id)),
        id,
      ).toContain(text);
    // Foundry's Flurry of Blows and Unarmed Strike compute nothing from the
    // level, so a part removal of either leaves the other rows their own.
    for (const [id, file] of [
      ['flurry', 'flurry-of-blows.JKJoHy5NveXGaZqv'],
      ['unarmed-strike', 'unarmed-strike.a4SPdPuOFdmfJdHN'],
    ] as const) {
      expect(readAcquisitionFormula('Monk', id), id).toBe('');
      expect(
        await readPinned('pf1', `packs/class-abilities/${file}.yaml`),
      ).not.toContain('@class.level');
    }
  });
});

describe('per-increment identities (#716 P7b, note §5.6–7)', () => {
  it('repeats no key in any P7b class’s featuresByLevel, and keys every later row by its slug', () => {
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
      // Bonus feat 5, flurry 2, unarmed strike 5, AC bonus 5, fast movement
      // 5, ki pool 3, slow fall 8.
      Monk: 33,
      // Flurry 1, unarmed strike 5, AC bonus 5, bonus feat 5, fast movement
      // 5, ki pool 3, ki powers 8, style strike 4.
      'Monk (Unchained)': 36,
      // Martial flexibility 4, bonus feats 6, flurry 2, maneuver training
      // 4, AC bonus 3, knockout 2, brawler's strike 3.
      Brawler: 24,
      // Sneak attack 9, ninja tricks 9, no trace 5.
      Ninja: 23,
      // Finesse training 3, sneak attack 9, talents 9, danger sense 5,
      // rogue's edge 3.
      'Rogue (Unchained)': 29,
    });
  });

  it('names the later rows by their table labels', () => {
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
    // Table: Monk (monk.html:360-376), and the flurry's steps by the class
    // text (:386-387).
    expect(listShortIncrementNames('Monk')).toMatchObject({
      'monk-flurry-8': 'Flurry of Blows (Improved Two-Weapon Fighting)',
      'monk-flurry-15': 'Flurry of Blows (Greater Two-Weapon Fighting)',
      'monk-unarmed-strike-12': 'Unarmed Strike (2d6)',
      'monk-ac-bonus-20': 'AC Bonus +5',
      'monk-fast-movement-18': 'Fast Movement +60 ft.',
      'monk-ki-pool-7': 'Ki Pool (cold iron/silver)',
      'monk-ki-pool-16': 'Ki Pool (adamantine)',
      'monk-slow-fall-6': 'Slow Fall 30 ft.',
      'monk-slow-fall-20': 'Slow Fall any distance',
      'monk-bonus-feat-14': 'Bonus Feat',
    });
    // The Unchained Monk table (monk.html:381-394).
    expect(listShortIncrementNames('Monk (Unchained)')).toMatchObject({
      'unchained-monk-flurry-11': 'Flurry of Blows (bonus attack) (UC)',
      'unchained-monk-unarmed-strike-20': 'Unarmed Strike (2d10) (UC)',
      'unchained-monk-ac-bonus-4': 'AC Bonus +1 (UC)',
      'unchained-monk-fast-movement-6': 'Fast Movement +20 ft. (UC)',
      'unchained-monk-ki-pool-7': 'Ki Strike (cold iron/silver) (UC)',
      'unchained-monk-style-strike-15': 'Style Strike (2/round) (UC)',
      'unchained-monk-style-strike-17': 'Style Strike (UC)',
      'unchained-monk-ki-powers-20': 'Ki Power (UC)',
    });
    // The Brawler table (brawler.html:376-390).
    expect(listShortIncrementNames('Brawler')).toMatchObject({
      'brawler-martial-flexibility-12':
        'Martial Flexibility (immediate action)',
      'brawler-brawlers-flurry-15':
        'Brawler’s Flurry (Greater Two-Weapon Fighting)',
      'brawler-maneuver-training-19': 'Maneuver Training 5',
      'brawler-ac-bonus-18': 'AC Bonus +4',
      'brawler-knockout-16': 'Knockout 3/day',
      'brawler-brawlers-strike-12': 'Brawler’s Strike (alignment)',
    });
    // The Ninja table (ninja.html:369-385).
    expect(listShortIncrementNames('Ninja')).toMatchObject({
      'ninja-sneak-attack-19': 'Sneak Attack +10d6',
      'ninja-ninja-tricks-20': 'Ninja Trick',
      'ninja-no-trace-18': 'No Trace +6',
    });
  });

  it('gives the monks the rows their representative seeds give', () => {
    // convex/lib/representativeClassCatalog.ts:927-940: flurry, unarmed
    // strike, the 1st-level bonus feat, evasion and ki pool, each a row of
    // the reviewed schedule at its level.
    for (const [className, identity] of [
      ['Monk', 'monk'],
      ['Monk (Unchained)', 'unchained-monk'],
    ] as const) {
      const rows = scheduleRows(schedule(className)).map(
        ({ classLevel, feature }) => [classLevel, feature],
      );
      const seeds = (representativeClassFeatureSchedules[identity] ?? []).map(
        ({ classLevel, catalogEntryId }) => [
          classLevel,
          catalogEntryId.replace(`${identity}-`, '').replace(/-\d+$/, ''),
        ],
      );
      expect(seeds, className).toHaveLength(5);
      for (const seed of seeds) expect(rows, className).toContainEqual(seed);
    }
  });

  it('gives the Unchained rogue every row of its seed, the seed’s keys and names for the later rows', () => {
    // convex/lib/representativeClassCatalog.ts:953-1019: all twenty levels of
    // the Unchained Rogue table.
    const reviewed = schedule('Rogue (Unchained)');
    const seeds = representativeClassFeatureSchedules['unchained-rogue'] ?? [];
    const extractSeedFeature = (catalogEntryId: string) =>
      catalogEntryId.replace('unchained-rogue-', '').replace(/-\d+$/, '');
    const sortRows = (rows: readonly (number | string)[][]) =>
      rows.map(String).sort();
    expect(
      sortRows(
        scheduleRows(reviewed).map(({ classLevel, feature }) => [
          classLevel,
          feature,
        ]),
      ),
    ).toEqual(
      sortRows(
        seeds.map(({ classLevel, catalogEntryId }) => [
          classLevel,
          extractSeedFeature(catalogEntryId),
        ]),
      ),
    );
    // Each later row is the seed's own row, by key and name.
    const seedNames = new Map(
      representativeAdditionalClassFeatures.map(({ _id, name }) => [
        `everythingpath/${_id}`,
        name,
      ]),
    );
    for (const { externalKey, name } of incrementEntries(reviewed))
      expect(normalizePrintedLabel(name), externalKey).toBe(
        normalizePrintedLabel(seedNames.get(externalKey) ?? ''),
      );
  });
});

// One published archetype per class through the mapper (note §5.8), each in a
// sub-batch of at most 100 keys (plan Appendix G).
const { mapPublishedArchetype } = bindArchetypeMapper({
  tree,
  view,
  identities,
});

describe('the P7b archetypes through the mapper (#716 P7b, note §5.8)', () => {
  it('Monk: Karmic Monk removes the 7th- and 10th-level ki pool steps and slow fall 80 feet, by value', () => {
    // Occult Adventures, PRD occultAdventures/archetypes/other.html:556
    // ("replaces the 7th- and 10th-level ki pool abilities") and :559
    // ("replaces slow fall 80 feet"); oa_abilities_class.lst:1792.
    const mapping = mapPublishedArchetype({
      className: 'Monk',
      archetype: 'Monk Archetype ~ Karmic Monk',
    });
    expect(listReplacements(mapping)).toEqual([
      [7, 'everythingpath/monk-ki-pool-7', 'part'],
      [10, 'everythingpath/monk-ki-pool-10', 'part'],
      [3, 'pf1/8VUae7CIgCidvSfg', 'whole'],
      [9, 'pf1/Cc2eFfhJYlClCGEH', 'whole'],
      [1, 'pf1/2ausI8g6SsmbOpgF', 'whole'],
      [16, 'everythingpath/monk-slow-fall-16', 'part'],
    ]);
    // Harmonic Self alters perfect self; the alignment is class text.
    expect(summarizeItems(mapping)).toEqual([
      ['unmatchedReplacement', 'alters:perfect-self'],
      ['unmatchedReplacement', 'notOnTable:Alignment'],
    ]);
    expect(planArchetypeBatch({ className: 'Monk', mapping })).toEqual([9]);
  });

  it('Monk (Unchained): Sage Counselor’s bonus feat and ki power parts name the Unchained rows, held on the shared flags', () => {
    // Ultimate Intrigue p.67; ui_abilities_class_pu.lst:16.
    const mapping = mapPublishedArchetype({
      className: 'Monk (Unchained)',
      archetype: 'Unchained Monk Archetype ~ Sage Counselor',
    });
    expect(readArchetypeDetail(mapping).classKeys).toEqual([
      'pf1/5mQIOIw4hDhlREPo',
    ]);
    expect(listReplacements(mapping)).toEqual([
      [1, 'pf1/VjHjPja5QABBgRvR', 'part'],
      [2, 'everythingpath/unchained-monk-bonus-feat-2', 'part'],
      [6, 'everythingpath/unchained-monk-bonus-feat-6', 'part'],
      [10, 'everythingpath/unchained-monk-bonus-feat-10', 'part'],
      [4, 'pf1/NsP31IshAuY4gv0s', 'part'],
    ]);
    // Foundry's bonus feat counts every feat from the monk level
    // (bonus-feat-mnk.VjHjPja5QABBgRvR.yaml:14), and PCGen's numbered names
    // gate the CRB monk's feats alone.
    expect(summarizeItems(mapping)).toEqual([
      ['unmatchedReplacement', 'alters:flurry'],
      ['unmatchedReplacement', 'alters:ki-pool'],
      ['conflict', 'partialFormula:bonus-feat'],
      ['conflict', 'defect:unchained-bonus-feat-flags'],
    ]);
    expect(
      planArchetypeBatch({ className: 'Monk (Unchained)', mapping }),
    ).toEqual([4]);
  });

  it('Brawler: Living Avalanche removes the 2nd- and 5th-level bonus combat feats, held on the formula', () => {
    // Ultimate Wilderness p.42; uw_abilities_class.lst:352.
    const mapping = mapPublishedArchetype({
      className: 'Brawler',
      archetype: 'Brawler Archetype ~ Living Avalanche',
    });
    expect(listReplacements(mapping)).toEqual([
      [2, 'pf1/o8AEIzEXMjEZ2EX1', 'part'],
      [5, 'everythingpath/brawler-bonus-feats-5', 'part'],
      [4, 'pf1/Z53orCz6KeTS5LOb', 'whole'],
      [16, 'pf1/EnMgClQRxY1GXg4e', 'whole'],
      [20, 'pf1/W6lurGAdeDsAch3G', 'whole'],
    ]);
    // Foundry counts every bonus combat feat from the brawler level
    // (bonus-combat-feats-bra.o8AEIzEXMjEZ2EX1.yaml:13).
    expect(summarizeItems(mapping)).toEqual([
      ['unmatchedReplacement', 'alters:maneuver-training'],
      ['conflict', 'partialFormula:bonus-feats'],
    ]);
    expect(planArchetypeBatch({ className: 'Brawler', mapping })).toEqual([6]);
  });

  it('Ninja: Frozen Shadow removes both uncanny dodges, held on the misbridged flag', () => {
    // Inner Sea Intrigue p.38; isi_abilities_class.lst:215.
    const mapping = mapPublishedArchetype({
      className: 'Ninja',
      archetype: 'Ninja Archetype ~ Frozen Shadow',
    });
    expect(listReplacements(mapping)).toEqual([
      [4, 'pf1/7WaQxnVaaoL4AGr8', 'whole'],
      [8, 'pf1/ZfnHhhTFQVo0Lj4P', 'whole'],
    ]);
    expect(summarizeItems(mapping)).toEqual([
      ['unmatchedReplacement', 'alters:ki-pool'],
      ['conflict', 'defect:improved-uncanny-dodge-bridge'],
    ]);
    expect(planArchetypeBatch({ className: 'Ninja', mapping })).toEqual([4]);
  });

  it('Rogue (Unchained): Unchained Consigliere removes danger sense on the shared trap sense flag and the 10th-level talent', () => {
    // Ultimate Intrigue p.44, written for the Unchained rogue
    // (PREABILITY:1,CATEGORY=CLASS,Rogue ~ Unchained Class,
    // ui_abilities_class_pu.lst:27).
    const mapping = mapPublishedArchetype({
      className: 'Rogue (Unchained)',
      archetype: 'Rogue Archetype ~ Unchained Consigliere',
    });
    expect(readArchetypeDetail(mapping).classKeys).toEqual([
      'pf1/5tsZI6zk29yX1ckA',
    ]);
    expect(listReplacements(mapping)).toEqual([
      [1, 'pf1/pEODJDoTk7uhCZY7', 'whole'],
      [2, 'pf1/KQYCRLEdD4bGA5ak', 'whole'],
      [4, 'pf1/7WaQxnVaaoL4AGr8', 'whole'],
      [8, 'pf1/ZfnHhhTFQVo0Lj4P', 'whole'],
      [3, 'pf1/sTlu3zgAEDdJnER5', 'whole'],
      [10, 'everythingpath/unchained-rogue-talent-10', 'part'],
    ]);
    expect(summarizeItems(mapping)).toEqual([]);
    expect(
      planArchetypeBatch({ className: 'Rogue (Unchained)', mapping }),
    ).toEqual([5]);
  });
});
