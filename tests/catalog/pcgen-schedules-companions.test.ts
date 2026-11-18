// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { representativeClassFeatureSchedules } from '../../convex/lib/representativeClassCatalog';
import { parseIdentityLedger } from '../../scripts/catalog/everythingpath-identities';
import ledger from '../../scripts/catalog/everythingpath-identities.json';
import type { ArchetypeMapping } from '../../scripts/catalog/pcgen/archetypes';
import { buildEffectiveView } from '../../scripts/catalog/pcgen/effective';
import {
  assignPcgenIdentities,
  pcgenBookFacts,
} from '../../scripts/catalog/pcgen/identities';
import { inventoryPcgen } from '../../scripts/catalog/pcgen/inventory';
import type {
  CharacterSheetCatalogEntry,
  CharacterSheetInput,
} from '../../src/lib/character-sheet';
import { resolveCharacterSheetArchetypes } from '../../src/lib/character-sheet-archetypes';
import { preparedArchetypeDetail } from '../../src/lib/catalog/imported-archetype';
import {
  allIncrementKeys,
  incrementEntries,
  rowKeyOf,
  scheduleRows,
} from '../../scripts/catalog/pcgen/schedules';
import { prdClassExclusions } from '../../scripts/catalog/prd-coverage';
import { pcgen716CompanionFiles } from '../fixtures/pcgen-716/companion-files';
import {
  bindArchetypeMapper,
  brief,
  comparePrintedRows,
  pinnedLine,
  planArchetypeBatch,
  readArchetypeDetail,
  scheduleChecks,
  summarizeItems,
} from './pcgen-716-schedules';
import { readPcgenFixtureTree } from './pcgen-716-tree';
import { readPinned } from './pinned-sources';

// #716 P7a (research note 716-p7-rules §1, §3, §5): the reviewed schedules of
// the Druid, Summoner, Summoner (Unchained), Hunter and Shifter, checked
// against the pinned PCGen and Foundry files. Every scenario reads pinned
// files or builds its records in memory, never committed curation state.

const tree = await readPcgenFixtureTree(pcgen716CompanionFiles);
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
  'Druid',
  'Summoner',
  'Summoner (Unchained)',
  'Hunter',
  'Shifter',
] as const;
type ClassName = (typeof classNames)[number];

const { schedule, derive, compare, levelOf } = scheduleChecks({ tree, view });

describe('the P7a schedules’ numbered variables (#716 P7a, note §5.1)', () => {
  it('gives every numbered variable its explicit level, by class level or by order', () => {
    // Aspects at 1st, 5th, 10th and 15th, by order
    // (shifter-aspect.ph7qA9fJX3iPuqxa.yaml:26-28).
    expect(levelOf('Shifter', 'ShifterAspect2')).toEqual(['shifter-aspect', 5]);
    expect(levelOf('Shifter', 'ShifterAspect4')).toEqual([
      'shifter-aspect',
      15,
    ]);
    // CRB p.51: a wild shape use, and new forms, at each even level from 4th
    // (by class level), and the old-style TYPE names of the 6th and 8th.
    expect(levelOf('Druid', 'WildShapeUses6')).toEqual(['wild-shape', 6]);
    expect(levelOf('Druid', 'WildShapeOptions12')).toEqual(['wild-shape', 12]);
    expect(levelOf('Druid', 'WildShape8')).toEqual(['wild-shape', 8]);
    // ACG pp.28–29: teamwork feats every 3 levels; bonus tricks at 7, 13
    // and 19 (acg_abilities_class.lst:1192-1200).
    expect(levelOf('Hunter', 'TeamworkFeat9')).toEqual(['teamwork-feats', 9]);
    expect(levelOf('Hunter', 'BonusTrick13')).toEqual(['bonus-tricks', 13]);
    // Whole features, and both summoners' shared flag names.
    expect(levelOf('Summoner', 'SummonMonster')).toEqual([
      'summon-monster',
      null,
    ]);
    expect(levelOf('Summoner (Unchained)', 'MakersCall')).toEqual([
      'makers-call',
      null,
    ]);
    expect(levelOf('Hunter', 'ImprovedEmpatheticLink')).toEqual([
      'improved-empathic-link',
      null,
    ]);
    // Not table rows.
    expect(levelOf('Druid', 'AnimalCompanion')).toEqual(['option']);
    expect(levelOf('Summoner (Unchained)', 'EidolonSubtype_Devil')).toEqual([
      'option',
    ]);
    expect(levelOf('Shifter', 'ShifterAspect5')).toEqual(['notOnTable']);
    // A change to the summoners' spells, bound to their spells row.
    for (const className of ['Summoner', 'Summoner (Unchained)'] as const) {
      expect(levelOf(className, 'SummonMonsterSpells')).toEqual(['casting']);
      const target = schedule(className).nonRows.SummonMonsterSpells;
      expect(
        schedule(className).features.find(
          ({ id }) => target?.kind === 'casting' && id === target.of,
        ),
      ).toMatchObject({ id: 'spells', casting: true });
    }
    expect(levelOf('Hunter', 'TeamworkFeat8')).toEqual(['unknown']);
  });
});

describe('each P7a schedule against the PRD’s class table (#716 P7a, owner decision 8)', () => {
  it('prints every row at its level, with its label, in the cited table row', async () => {
    const reviewed = classNames.filter(
      (className) => schedule(className).printedTable?.status === 'reviewed',
    );
    expect(reviewed).toEqual([
      'Druid',
      'Summoner',
      'Summoner (Unchained)',
      'Hunter',
    ]);
    for (const className of reviewed) {
      const { features, printedTable } = schedule(className);
      if (printedTable?.status !== 'reviewed') continue;
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
      // Only casting rows go unprinted.
      for (const id of Object.keys(printedTable.unprinted))
        expect(
          features.find((feature) => feature.id === id)?.casting,
          `${className} ${id}`,
        ).toBe(true);
      for (const row of rows)
        expect(row.schedule, `${className} ${row.level}`).toEqual(row.table);
    }
  });

  it('keeps the Shifter pending table review: the PRD prints no shifter', () => {
    const shifter = schedule('Shifter');
    expect(shifter.printedTable).toEqual({
      status: 'pendingTableReview',
      exclusion: 'not-in-prd',
    });
    expect(prdClassExclusions['not-in-prd'].schedules).toContain(shifter.slug);
    // Every conclusion read from the table says it is pending; none claims
    // the table.
    const conclusions = [
      ...shifter.features.flatMap(({ decision }) => decision ?? []),
      ...Object.values(shifter.nonRows).flatMap((nonRow) =>
        nonRow.kind === 'notOnTable' ? [nonRow.text] : [],
      ),
      ...shifter.foundryNonRows.map(({ text }) => text),
    ];
    expect(conclusions).toHaveLength(6);
    for (const text of conclusions) {
      expect(text).toContain('Pending table review');
      expect(text).not.toMatch(/the table gives/i);
    }
  });
});

describe('PCGen’s schedule against each table (#716 P7a, note §5.2–3)', () => {
  it('settles every difference between PCGen, Foundry and the table with a cited decision or defect', async () => {
    for (const className of classNames)
      expect(
        (await compare(className)).filter(({ settledBy }) => !settledBy),
        className,
      ).toEqual([]);
    // The druid's orisons stand on the level alone; the alignment restriction
    // and the spells are Foundry's casting rows; bonus languages is text.
    expect(brief(await compare('Druid'))).toEqual([
      ['ungatedGrant', 'orisons', 'decision:orisons'],
      ['foundryOnly', 'alignment-spells', 'decision:alignment-spells'],
      ['foundryOnly', 'spells', 'decision:spells'],
      ['nonRow', 'pf1/HL53FUqkS4PZCMIK', 'foundryNonRow:pf1/HL53FUqkS4PZCMIK'],
    ]);
    // Gate is summon monster's 19th-level row, so it raises
    // no finding of its own.
    expect(brief(await compare('Summoner'))).toEqual([
      [
        'ungatedGrant',
        'Summoner ~ Weapon and Armor Proficiency',
        'grantNonRow:Summoner ~ Weapon and Armor Proficiency',
      ],
      ['ungatedGrant', 'cantrips', 'decision:cantrips'],
      ['ungatedGrant', 'aspect', 'decision:aspect'],
      ['ungatedGrant', 'greater-aspect', 'decision:greater-aspect'],
      ['ungatedGrant', 'twin-eidolon', 'decision:twin-eidolon'],
      ['formulaIncrement', 'summon-monster', 'decision:summon-monster'],
      ['foundryOnly', 'spells', 'decision:spells'],
      ['foundryOnly', 'exchange-spell', 'decision:exchange-spell'],
    ]);
    expect(brief(await compare('Summoner (Unchained)'))).toEqual([
      ['nonRow', 'ClassSkills', 'nonRow:ClassSkills'],
      [
        'ungatedGrant',
        'Unchained Summoner ~ Weapon and Armor Proficiency',
        'grantNonRow:Unchained Summoner ~ Weapon and Armor Proficiency',
      ],
      ['ungatedGrant', 'spells', 'decision:spells'],
      ['ungatedGrant', 'cantrips', 'decision:cantrips'],
      ['ungatedGrant', 'aspect', 'decision:aspect'],
      ['ungatedGrant', 'greater-aspect', 'decision:greater-aspect'],
      ['ungatedGrant', 'twin-eidolon', 'decision:twin-eidolon'],
      ['formulaIncrement', 'summon-monster', 'decision:summon-monster'],
      ['foundryOnly', 'exchange-spell', 'decision:exchange-spell'],
    ]);
    expect(brief(await compare('Hunter'))).toEqual([
      [
        'ungatedGrant',
        'Hunter ~ Weapon and Armor Proficiency',
        'grantNonRow:Hunter ~ Weapon and Armor Proficiency',
      ],
      ['pcgenOnly', 'orisons', 'decision:orisons'],
      ['foundryOnly', 'alignment-spells', 'decision:alignment-spells'],
      ['foundryOnly', 'spells', 'decision:spells'],
      ['foundryOnly', 'exchange-spell', 'decision:exchange-spell'],
      // BonusTrick7, 13 and 19 (acg_abilities_class.lst:1198-1200).
      ['undefinedPart', 'bonus-tricks', 'bonus-trick-parts'],
      ['undefinedPart', 'bonus-tricks', 'bonus-trick-parts'],
      ['undefinedPart', 'bonus-tricks', 'bonus-trick-parts'],
    ]);
    expect(brief(await compare('Shifter'))).toEqual([
      ['nonRow', 'ClassSkills', 'nonRow:ClassSkills'],
      ['nonRow', 'BonusLanguages', 'nonRow:BonusLanguages'],
      [
        'ungatedGrant',
        'Shifter ~ Weapon and Armor Proficiencies',
        'grantNonRow:Shifter ~ Weapon and Armor Proficiencies',
      ],
      // Claws and defensive instinct improve in formulas alone
      // (uw_abilities_class.lst:14, :16).
      ['formulaIncrement', 'shifter-claws', 'decision:shifter-claws'],
      ['formulaIncrement', 'defensive-instinct', 'decision:defensive-instinct'],
      ['nonRow', 'pf1/7fhS2HmIivLXQxlq', 'foundryNonRow:pf1/7fhS2HmIivLXQxlq'],
    ]);
  });
});

describe('P7-0’s grant kinds in the P7a classes (#716 P7a, note §5.3)', () => {
  it('reads each class’s gated, ungated and nested grants', () => {
    const kinds = (className: ClassName) => {
      const { acquisitions, ungatedGrants, nestedGrants } = derive(className);
      return {
        gated: acquisitions.length,
        ungated: ungatedGrants.map(({ granted, level }) => [granted, level]),
        nested: nestedGrants.length,
      };
    };
    expect(kinds('Druid')).toEqual({
      gated: 11,
      // Orisons at 1st; PCGen gates them on the level alone
      // (cr_abilities_class.lst:223).
      ungated: [['Druid ~ Orisons', 1]],
      nested: 0,
    });
    // Aspect at 10th, greater aspect at 18th, twin eidolon at
    // 20th (apg_abilities_class.lst:747-762).
    expect(kinds('Summoner')).toEqual({
      gated: 11,
      ungated: [
        ['Summoner ~ Weapon and Armor Proficiency', 1],
        ['Summoner ~ Cantrips', 1],
        ['Summoner ~ Aspect', 10],
        ['Summoner ~ Greater Aspect', 18],
        ['Summoner ~ Twin Eidolon', 20],
      ],
      nested: 0,
    });
    expect(kinds('Summoner (Unchained)')).toEqual({
      gated: 11,
      ungated: [
        ['Unchained Summoner ~ Weapon and Armor Proficiency', 1],
        ['Unchained Summoner ~ Spells', 1],
        ['Unchained Summoner ~ Cantrips', 1],
        ['Unchained Summoner ~ Aspect', 10],
        ['Unchained Summoner ~ Greater Aspect', 18],
        ['Unchained Summoner ~ Twin Eidolon', 20],
      ],
      nested: 0,
    });
    // The hunter's and shifter's grants stand on their class blocks' level
    // lines (acg_classes.lst:122-141, uw_classes.lst:16-32).
    expect(kinds('Hunter')).toEqual({
      gated: 19,
      ungated: [['Hunter ~ Weapon and Armor Proficiency', 1]],
      nested: 0,
    });
    expect(kinds('Shifter')).toEqual({
      gated: 16,
      ungated: [['Shifter ~ Weapon and Armor Proficiencies', 1]],
      nested: 0,
    });
  });

  it('keeps the Unchained summoner to its own record and slug, with no shared gate', async () => {
    const unchained = derive('Summoner (Unchained)');
    expect(
      unchained.acquisitions.filter(
        ({ granted }) => !granted.startsWith('Unchained Summoner ~'),
      ),
    ).toEqual([]);
    // The flags are the standard summoner's (apg_abilities_globalvar.lst:489).
    expect(unchained.defined.has('Eidolon')).toBe(true);
    expect(
      (await compare('Summoner (Unchained)')).filter(
        ({ kind }) => kind === 'sharedGate',
      ),
    ).toEqual([]);
    const reviewed = schedule('Summoner (Unchained)');
    expect(reviewed.slug).toBe('unchained-summoner');
    expect(
      incrementEntries(reviewed)
        .filter(({ externalKey }) => externalKey.includes('summon-monster'))
        .map(({ externalKey, name }) => [externalKey, name]),
    ).toEqual(
      [3, 5, 7, 9, 11, 13, 15, 17, 19].map((level, index) => [
        `everythingpath/unchained-summoner-summon-monster-${level}`,
        index === 8
          ? 'Gate (UC)'
          : `Summon Monster ${['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'][index]} (UC)`,
      ]),
    );
  });

  it('reads Summoner ~ Gate on the summon monster gate as summon monster’s 19th-level row', async () => {
    // Gate at 19th, "can be used as gate" in Foundry's Summon
    // Monster (summon-monster.caNEmbCtoHA7NYtZ.yaml:32-37).
    const gate = derive('Summoner').acquisitions.find(
      ({ granted }) => granted === 'Summoner ~ Gate',
    );
    expect(gate).toEqual({
      granted: 'Summoner ~ Gate',
      suffix: 'SummonMonster',
      level: 19,
      at: 'roleplaying_game/advanced_players_guide/apg_abilities_class.lst:761',
    });
    expect(
      await pinnedLine(
        'pf1',
        'packs/class-abilities/summon-monster.caNEmbCtoHA7NYtZ.yaml:37',
      ),
    ).toContain('{Gate}');
    const reviewed = schedule('Summoner');
    const summonMonster = reviewed.features.find(
      ({ id }) => id === 'summon-monster',
    );
    if (!summonMonster) throw new Error('No summon monster.');
    expect(rowKeyOf(reviewed, summonMonster, 19)).toBe(
      'everythingpath/summoner-summon-monster-19',
    );
    expect(
      (await compare('Summoner')).filter(
        ({ feature }) => feature === 'summon-monster',
      ),
    ).toEqual([
      expect.objectContaining({
        kind: 'formulaIncrement',
        settledBy: 'decision:summon-monster',
      }),
    ]);
  });
});

describe('formula rows, skill ranks and bridges (#716 P7a, note §5.4–5)', () => {
  it('holds summon monster’s, shifter claws’ and defensive instinct’s later rows in the schedule alone, and numbers every other repeating feature', async () => {
    const formulaHeld: Record<ClassName, string[]> = {
      Druid: [],
      Summoner: ['summon-monster'],
      'Summoner (Unchained)': ['summon-monster'],
      Hunter: [],
      Shifter: ['shifter-claws', 'defensive-instinct'],
    };
    for (const className of classNames) {
      const findings = await compare(className);
      const formula = findings
        .filter(({ kind }) => kind === 'formulaIncrement')
        .map(({ feature, settledBy }) => [feature, settledBy]);
      expect(formula, className).toEqual(
        formulaHeld[className].map((id) => [id, `decision:${id}`]),
      );
      // Every other feature with later rows has gated, numbered parts.
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

  it('gives each class the skill ranks per level of its table, as Foundry records them', async () => {
    // Druid 4, both summoners 2, hunter 6 and shifter 4 ranks + Int
    // modifier.
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
    expect(ranks).toEqual([4, 2, 2, 6, 4]);
  });

  it('reads the TYPE bridges from the global variables, not by spelling', () => {
    // cr_abilities_globalvar.lst:388, :398.
    const druid = derive('Druid').typeBridges;
    expect(druid.get('DruidWildShape')).toBe('WildShape');
    expect(druid.get('DruidWildShape6')).toBe('WildShape6');
    // acg_abilities_globalvar.lst:304 bridges to the misspelled variable.
    const hunter = derive('Hunter').typeBridges;
    expect(hunter.get('HunterImprovedEmpathicLink')).toBe(
      'ImprovedEmpatheticLink',
    );
    expect(hunter.get('HunterTeamworkFeats')).toBe('TeamworkFeats');
    // apg_abilities_globalvar.lst:531, shared by both summoners.
    expect(derive('Summoner').typeBridges.get('SummonerEidolon')).toBe(
      'Eidolon',
    );
    expect(
      derive('Summoner (Unchained)').typeBridges.get('SummonerEidolon'),
    ).toBe('Eidolon');
  });

  it('cites the Foundry lines that compute wild shape’s, teamwork feats’ and defensive instinct’s increments', async () => {
    expect(
      await pinnedLine(
        'pf1',
        schedule('Druid').features.find(({ id }) => id === 'wild-shape')
          ?.acquisitionFormula ?? '',
      ),
    ).toContain('min(floor((@class.level - 2) / 2), 8)');
    expect(
      await pinnedLine(
        'pf1',
        schedule('Hunter').features.find(({ id }) => id === 'teamwork-feats')
          ?.acquisitionFormula ?? '',
      ),
    ).toContain('floor(@class.level / 3)');
    // The +1 per 4 shifter levels, held on the acquisition row: a part
    // removal of it is held as a partial formula.
    expect(
      await pinnedLine(
        'pf1',
        schedule('Shifter').features.find(
          ({ id }) => id === 'defensive-instinct',
        )?.acquisitionFormula ?? '',
      ),
    ).toContain('floor(@class.level / 4)');
  });
});

describe('per-increment identities (#716 P7a, note §5.6–7)', () => {
  it('repeats no key in any P7a class’s featuresByLevel, and keys every later row by its slug', () => {
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
      // Wild shape 8; summon monster 9 each; teamwork feats 5, bonus
      // tricks 2; shifter aspect 3, shifter claws 6, defensive instinct 5.
      Druid: 8,
      Summoner: 9,
      'Summoner (Unchained)': 9,
      Hunter: 7,
      Shifter: 14,
    });
  });

  it('names the later rows by their table labels', () => {
    const names = (className: ClassName) =>
      Object.fromEntries(
        incrementEntries(schedule(className)).map(({ externalKey, name }) => [
          externalKey.replace('everythingpath/', ''),
          name,
        ]),
      );
    // wild-shape.sJdBOE9lwz5XAkUi.yaml:42-45.
    expect(names('Druid')).toMatchObject({
      'druid-wild-shape-6': 'Wild Shape (2/day)',
      'druid-wild-shape-18': 'Wild Shape (8/day)',
      'druid-wild-shape-20': 'Wild Shape (at will)',
    });
    // summon-monster.caNEmbCtoHA7NYtZ.yaml:32-37.
    expect(names('Summoner')).toMatchObject({
      'summoner-summon-monster-3': 'Summon Monster II',
      'summoner-summon-monster-17': 'Summon Monster IX',
      'summoner-summon-monster-19': 'Gate',
    });
    expect(names('Hunter')).toMatchObject({
      'hunter-teamwork-feats-6': 'Teamwork Feat',
      'hunter-bonus-tricks-13': 'Bonus Trick',
    });
    // shifter-aspect.ph7qA9fJX3iPuqxa.yaml:26-28,
    // shifter-claws.fi5PsRq1XW7MStPM.yaml:21-27 and
    // defensive-instinct.l52geoeGQcQz84AE.yaml:26-29.
    expect(names('Shifter')).toEqual({
      'shifter-shifter-aspect-5': 'Shifter Aspect (2nd)',
      'shifter-shifter-aspect-10': 'Shifter Aspect (3rd)',
      'shifter-shifter-aspect-15': 'Shifter Aspect (4th)',
      'shifter-shifter-claws-3': 'Shifter Claws (DR/cold iron, magic, silver)',
      'shifter-shifter-claws-7': 'Shifter Claws (1d6)',
      'shifter-shifter-claws-11': 'Shifter Claws (1d8)',
      'shifter-shifter-claws-13': 'Shifter Claws (1d10)',
      'shifter-shifter-claws-17': 'Shifter Claws (×3)',
      'shifter-shifter-claws-19': 'Shifter Claws (DR/adamantine, —)',
      'shifter-defensive-instinct-4': 'Defensive Instinct +1',
      'shifter-defensive-instinct-8': 'Defensive Instinct +2',
      'shifter-defensive-instinct-12': 'Defensive Instinct +3',
      'shifter-defensive-instinct-16': 'Defensive Instinct +4',
      'shifter-defensive-instinct-20': 'Defensive Instinct +5',
    });
  });

  it('gives the summoners the rows the representative Unchained seeds give', () => {
    // convex/lib/representativeClassCatalog.ts:941-952: the acquisition rows
    // of both summoner tables to 2nd level, casting aside.
    const seeded = (identity: string) =>
      (representativeClassFeatureSchedules[identity] ?? []).map(
        ({ classLevel, catalogEntryId }) => [
          classLevel,
          catalogEntryId.replace(`${identity}-`, ''),
        ],
      );
    for (const [className, identity] of [
      ['Summoner', 'summoner'],
      ['Summoner (Unchained)', 'unchained-summoner'],
    ] as const) {
      const reviewed = schedule(className);
      const casting = new Set(
        reviewed.features.flatMap(({ id, casting }) => (casting ? [id] : [])),
      );
      const seeds = seeded(identity);
      const top = Math.max(...seeds.map(([level]) => Number(level)));
      expect(
        scheduleRows(reviewed)
          .filter(
            ({ classLevel, feature }) =>
              classLevel <= top && !casting.has(feature),
          )
          .map(({ classLevel, feature }) => [classLevel, feature]),
        className,
      ).toEqual(seeds);
    }
  });
});

// One published archetype per class through the mapper (note §5.8), each in a
// sub-batch of at most 100 keys (plan Appendix G).
const { mapPublishedArchetype } = bindArchetypeMapper({
  tree,
  view,
  identities,
});
const row = (classLevel: number, externalKey: string, scope = 'whole') => ({
  classLevel,
  externalKey,
  scope,
});

/** Twenty levels of a reviewed class and its archetypes, as the release converter prepares them. */
function classSheet(
  className: ClassName,
  archetypes: readonly ArchetypeMapping[],
): CharacterSheetInput {
  const reviewed = schedule(className);
  const rows = scheduleRows(reviewed);
  const increments = new Map(
    incrementEntries(reviewed).map((entry) => [entry.externalKey, entry]),
  );
  const feature = (key: string): CharacterSheetCatalogEntry => {
    const detail = increments.get(key)?.detail;
    return {
      _id: key,
      ruleIdentity: key,
      name: key,
      modifiers: [],
      detail:
        detail?.kind === 'classFeature'
          ? {
              kind: 'classFeature',
              parentFeature: detail.parentFeature,
              part: detail.part,
            }
          : { kind: 'classFeature' },
    };
  };
  const catalog = new Map<string, CharacterSheetCatalogEntry>([
    [
      reviewed.classKey,
      {
        _id: reviewed.classKey,
        ruleIdentity: reviewed.classKey,
        name: reviewed.className,
        modifiers: [],
        detail: {
          kind: 'class',
          classKind: 'base',
          hitDie: 8,
          bab: 'threeQuarters',
          saves: { fort: 'poor', ref: 'poor', will: 'good' },
          skillRanksPerLevel: reviewed.skillRanksPerLevel,
          classSkills: [],
          featuresByLevel: rows.map(({ classLevel, externalKey }) => ({
            classLevel,
            catalogEntryId: externalKey,
          })),
          picksByLevel: [],
        },
      } as CharacterSheetCatalogEntry,
    ],
    ...[
      ...rows.map(({ externalKey }) => externalKey),
      ...archetypes.flatMap(({ features }) =>
        features.map(({ entry }) => entry.externalKey),
      ),
    ].map((key) => [key, feature(key)] as const),
  ]);
  const prepared = archetypes.map(({ subject: { entry } }) => {
    if (entry.detail.kind !== 'archetype') throw new Error('Not an archetype.');
    return {
      _id: entry.externalKey,
      ruleIdentity: entry.externalKey,
      name: entry.name,
      modifiers: [],
      detail: preparedArchetypeDetail(entry.detail, (key) => {
        const target = catalog.get(key) ?? feature(key);
        return {
          id: key,
          ruleIdentity: key,
          ...(target.detail?.kind === 'classFeature'
            ? {
                parentFeature: target.detail.parentFeature,
                part: target.detail.part,
              }
            : {}),
        };
      }),
    } satisfies CharacterSheetCatalogEntry;
  });
  return {
    characterKind: 'pc',
    entries: [
      ...Array.from({ length: 20 }, (_, index) => ({
        _id: `level-${index + 1}`,
        kind: 'classLevel' as const,
        active: true as const,
        state: {
          kind: 'classLevel' as const,
          classEntryId: reviewed.classKey,
          position: index + 1,
          hpGained: 5,
        },
      })),
      ...prepared.map(({ _id }) => ({
        _id: `selection-${_id}`,
        kind: 'archetype' as const,
        catalogEntryId: _id,
        active: true,
        state: { kind: 'archetype' as const },
      })),
    ],
    catalogEntries: [...catalog.values(), ...prepared],
  };
}

describe('the P7a archetypes through the mapper (#716 P7a, note §5.8)', () => {
  it('Druid: Green Faith Initiate removes the 6th- and 10th-level uses of wild shape, on the unbridged flag', () => {
    // Faiths & Philosophies p.11; fap_abilities_class.lst:23.
    const mapping = mapPublishedArchetype({
      className: 'Druid',
      archetype: 'Druid Archetype ~ Green Faith Initiate',
    });
    expect(readArchetypeDetail(mapping).replaces).toEqual([
      row(3, 'pf1/adslhIPLFgIaHBfh'),
      row(6, 'everythingpath/druid-wild-shape-6', 'part'),
      row(10, 'everythingpath/druid-wild-shape-10', 'part'),
      row(9, 'pf1/yzmKDxR63yS5fqlc'),
      row(13, 'pf1/MXj2WoyW7vLxiVYw'),
    ]);
    // Foundry's wild shape counts every use from the druid level
    // (wild-shape.sJdBOE9lwz5XAkUi.yaml:82), and PCGen never bridges the
    // 6th-level flag: both hold it for review.
    expect(summarizeItems(mapping)).toEqual([
      ['conflict', 'partialFormula:wild-shape'],
      ['conflict', 'defect:wild-shape-uses-6'],
    ]);
    expect(planArchetypeBatch({ className: 'Druid', mapping })).toEqual([6]);
  });

  it('Summoner: Wild Caller removes summon monster whole, gate with it, and changes the spells', () => {
    // ARG p.44; arg_abilities_class.lst:196 and its .MOD line :1135.
    const mapping = mapPublishedArchetype({
      className: 'Summoner',
      archetype: 'Summoner Archetype ~ Wild Caller',
    });
    expect(readArchetypeDetail(mapping).replaces).toEqual([
      row(1, 'pf1/caNEmbCtoHA7NYtZ'),
    ]);
    expect(summarizeItems(mapping)).toEqual([
      ['unmatchedReplacement', 'alters:eidolon'],
      // It swaps the summon monster spells on its spell list for summon
      // nature's ally (arg_abilities_class.lst:227): a #422 casting change.
      ['uncheckedCasting', 'casting:spells'],
      ['unmatchedReplacement', 'option:EidolonBaseForm'],
      ['unmatchedReplacement', 'option:EidolonType'],
      ['conflict', 'stackingGuard#2'],
    ]);
    expect(
      mapping.items.find(({ id }) => id === 'casting:spells')?.text,
    ).toContain('arg_abilities_class.lst:227');
    expect(planArchetypeBatch({ className: 'Summoner', mapping })).toEqual([4]);
    // On the sheet the whole removal takes every summon monster row, gate
    // at 19 included.
    const replaced = resolveCharacterSheetArchetypes(
      classSheet('Summoner', [mapping]),
    ).classes[0]?.archetypes[0]?.replacements;
    expect(
      replaced?.map(({ classLevel, catalogEntryId }) => [
        classLevel,
        catalogEntryId,
      ]),
    ).toEqual(
      [1, 3, 5, 7, 9, 11, 13, 15, 17, 19].map((level) => [
        level,
        level === 1
          ? 'pf1/caNEmbCtoHA7NYtZ'
          : `everythingpath/summoner-summon-monster-${level}`,
      ]),
    );
  });

  it('Summoner (Unchained): Devil Binder’s removals name the Unchained rows, its eidolon subtypes are options', () => {
    // Adventurer's Guide p.95, written for the Unchained summoner
    // (PREABILITY:1,CATEGORY=CLASS,Summoner ~ Unchained Class,
    // ag_abilities_pu.lst:59).
    const mapping = mapPublishedArchetype({
      className: 'Summoner (Unchained)',
      archetype: 'Summoner Archetype ~ Devil Binder',
    });
    expect(readArchetypeDetail(mapping).classKeys).toEqual([
      'pf1/5iDrtRQMuIhLymUA',
    ]);
    expect(readArchetypeDetail(mapping).replaces).toEqual([
      row(2, 'pf1/fJuxnPlNDncuHuT5'),
      row(4, 'pf1/hPgtTh79AeIocmpt'),
      row(8, 'pf1/uhfXFDZBrYHwQnZX'),
      row(12, 'pf1/U6LZteLyMA4gLAFF'),
      row(16, 'pf1/k9ZGUwUB9yJiz4Ea'),
      row(20, 'pf1/uURWe8xOp8w7YBQY'),
      row(6, 'pf1/YOanbBgt7VuD5QDt'),
    ]);
    expect(summarizeItems(mapping)).toEqual([
      ['unmatchedReplacement', 'alters:eidolon'],
      ['uncheckedCasting', 'casting:spells'],
      ...[
        'Agathion',
        'Angel',
        'Archon',
        'Azata',
        'Daemon',
        'Demon',
        'Div',
        'Elemental',
        'Inevitable',
        'Protean',
        'Psychopomp',
      ].map((subtype) => [
        'unmatchedReplacement',
        `option:EidolonSubtype_${subtype}`,
      ]),
    ]);
    expect(
      planArchetypeBatch({ className: 'Summoner (Unchained)', mapping }),
    ).toEqual([5]);
  });

  it('Hunter: Feral Hunter removes five of six teamwork feats, held on the formula and the misspelled bridge', () => {
    // ACG p.96; acg_abilities_class.lst:3145 and its .MOD line :4641.
    const mapping = mapPublishedArchetype({
      className: 'Hunter',
      archetype: 'Hunter Archetype ~ Feral Hunter',
    });
    expect(
      readArchetypeDetail(mapping)
        .replaces.filter(({ scope }) => scope === 'part')
        .map(({ classLevel, externalKey }) => [classLevel, externalKey]),
    ).toEqual(
      [6, 9, 12, 15, 18].map((level) => [
        level,
        `everythingpath/hunter-teamwork-feats-${level}`,
      ]),
    );
    // Foundry counts every teamwork feat from the hunter level
    // (teamwork-feat-hun.Rh0LztkmetWVC6jk.yaml:13); the improved empathic
    // link flag is bridged to a misspelled variable; and the base line's
    // PREMULT guard names the teamwork feat parts its .MOD line's guard
    // names whole (:3145, :4641).
    expect(summarizeItems(mapping)).toEqual([
      ['conflict', 'partialFormula:teamwork-feats'],
      ['conflict', 'defect:improved-empathic-link-bridge'],
      ['conflict', 'stackingGuard'],
    ]);
    expect(planArchetypeBatch({ className: 'Hunter', mapping })).toEqual([6]);
  });

  it('Shifter: Elementalist Shifter removes the shifter aspect whole', () => {
    // UW p.78; uw_abilities_class.lst:1033.
    const mapping = mapPublishedArchetype({
      className: 'Shifter',
      archetype: 'Shifter Archetype ~ Elementalist Shifter',
    });
    expect(readArchetypeDetail(mapping).replaces).toEqual([
      row(1, 'pf1/ph7qA9fJX3iPuqxa'),
      row(1, 'pf1/Yr8dfM2d8JEWoYkr'),
      row(1, 'pf1/fi5PsRq1XW7MStPM'),
      row(9, 'pf1/jPNCx02S3ZlIPOmL'),
      row(14, 'pf1/bXxt8L2PITMstpka'),
    ]);
    expect(summarizeItems(mapping)).toEqual([
      ['unmatchedReplacement', 'alters:wild-shape'],
      ['unmatchedReplacement', 'notOnTable:BonusLanguages'],
    ]);
    expect(planArchetypeBatch({ className: 'Shifter', mapping })).toEqual([7]);
  });
});
