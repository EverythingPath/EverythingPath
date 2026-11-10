// @vitest-environment node
import { describe, expect, it } from 'vitest';
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
  incrementEntries,
  scheduleRows,
} from '../../scripts/catalog/pcgen/schedules';
import { pcgen716SmiteChallengeFiles } from '../fixtures/pcgen-716/smite-challenge-files';
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

// #716 P7d (research note 716-p7-rules §1, §3, §5, §6): the reviewed
// schedules of the Paladin, Antipaladin, Cavalier and Samurai, checked
// against the pinned PCGen, Foundry and PRD files. Every scenario reads
// pinned files, never committed curation state.

const tree = await readPcgenFixtureTree(pcgen716SmiteChallengeFiles);
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

const classNames = ['Paladin', 'Antipaladin', 'Cavalier', 'Samurai'] as const;
type ClassName = (typeof classNames)[number];

const { schedule, derive, compare, levelOf, countGrantKinds } = scheduleChecks({
  tree,
  view,
});

describe('the P7d schedules’ numbered variables (#716 P7d, note §5.1)', () => {
  it('gives every numbered variable its explicit level, by class level', () => {
    // CRB p.62: a mercy at 3rd and every three levels after. PCGen names
    // each by its level (Mercy3 … Mercy18, cr_abilities_globalvar.lst:664-669)
    // and gates it on the count of mercies (cr_abilities_class.lst:1367).
    expect(levelOf('Paladin', 'Mercy3')).toEqual(['mercy', 3]);
    expect(levelOf('Paladin', 'Mercy9')).toEqual(['mercy', 9]);
    expect(levelOf('Paladin', 'Mercy18')).toEqual(['mercy', 18]);
    // The note's "Mercy1–6 O = 3n": PCGen defines no Mercy1 to Mercy6, so
    // Mercy6 is the 6th-level mercy, the second, not the sixth.
    expect(levelOf('Paladin', 'Mercy6')).toEqual(['mercy', 6]);
    expect(levelOf('Paladin', 'Mercy1')).toEqual(['unknown']);
    // APG p.119: the antipaladin's smite good and cruelties by class level,
    // unlike the paladin's mercies (apg_abilities_class.lst:977-990).
    expect(levelOf('Antipaladin', 'SmiteGood10')).toEqual(['smite-good', 10]);
    expect(levelOf('Antipaladin', 'SmiteGood1')).toEqual(['smite-good', 1]);
    expect(levelOf('Antipaladin', 'Cruelty15')).toEqual(['cruelty', 15]);
    // APG p.33: order abilities at 2nd, 8th and 15th
    // (apg_abilities_class.lst:226-228); bonus feats at 6th, 12th and 18th,
    // in the archetypes' spelling and in PCGen's TYPE gates' (:221-223).
    expect(levelOf('Cavalier', 'OrderAbility8')).toEqual(['order', 8]);
    expect(levelOf('Cavalier', 'BonusFeat18')).toEqual(['bonus-feat', 18]);
    expect(levelOf('Cavalier', 'CavaliersBonusFeat12')).toEqual([
      'bonus-feat',
      12,
    ]);
    // UC p.20: the samurai's bonus feats, gated `=06` (uc_abilities_class.lst:210)
    // and set from FACTs spelled BonusFeats<n> (uc_abilities_globalvar.lst:296).
    expect(levelOf('Samurai', 'BonusFeat6')).toEqual(['bonus-feat', 6]);
    expect(levelOf('Samurai', 'BonusFeats12')).toEqual(['bonus-feat', 12]);
    expect(levelOf('Samurai', 'BonusFeats')).toEqual(['bonus-feat', null]);
    // Not table rows: the paladin's bonds are options of divine bond.
    expect(levelOf('Paladin', 'BondedMount')).toEqual(['option']);
    expect(levelOf('Paladin', 'CodeOfConduct')).toEqual(['notOnTable']);
    expect(levelOf('Samurai', 'SamuraiShieldProficiency')).toEqual([
      'proficiency',
    ]);
    // The samurai has no order ability flag, and the cavalier's aren't its.
    expect(levelOf('Samurai', 'OrderAbility2')).toEqual(['unknown']);
  });

  it('leaves the level of a mercy to the schedule: PCGen gates it on a count, not a level', () => {
    // cr_abilities_class.lst:1367: PREVARGTEQ:Mercies,1|PREVAREQ:Paladin_CF_Mercy3,1.
    expect(derive('Paladin').gatedParts.get('Mercy3')).toEqual({
      at: 'roleplaying_game/core_rulebook/cr_abilities_class.lst:1367',
      level: null,
      polarity: 'removal',
    });
    // The antipaladin's are gated at their levels (apg_abilities_class.lst:980).
    expect(derive('Antipaladin').gatedParts.get('SmiteGood10')?.level).toBe(10);
    expect(derive('Antipaladin').gatedParts.get('Cruelty15')?.level).toBe(15);
  });
});

describe('each P7d schedule against the PRD’s class table (#716 P7d, owner decision 8)', () => {
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
    // Table: Paladin, 1st level: "Aura of good, detect evil, smite evil 1/day".
    expect((await comparePrintedRows(schedule('Paladin')))[0]?.table).toEqual([
      'aura of good',
      'detect evil',
      'smite evil 1/day',
    ]);
    // Table: Cavalier, 15th level: "Order ability".
    expect((await comparePrintedRows(schedule('Cavalier')))[14]?.table).toEqual(
      ['order ability'],
    );
  });

  it('cites the casting rows the Special column doesn’t print, and prints no value column', async () => {
    expect(
      Object.fromEntries(
        classNames.map((className) => {
          const { printedTable } = schedule(className);
          if (printedTable?.status !== 'reviewed')
            throw new Error(`${className} has no reviewed table.`);
          return [className, Object.keys(printedTable.unprinted)];
        }),
      ),
    ).toEqual({
      Paladin: ['spells'],
      Antipaladin: ['spells'],
      Cavalier: [],
      Samurai: [],
    });
    for (const className of classNames)
      expect(await comparePrintedColumns(schedule(className))).toEqual([]);
  });
});

describe('PCGen’s schedule against each table (#716 P7d, note §5.2–3)', () => {
  it('settles every difference between PCGen, Foundry and the table with a cited decision or defect', async () => {
    for (const className of classNames)
      expect(
        (await compare(className)).filter(({ settledBy }) => !settledBy),
        className,
      ).toEqual([]);
    // CRB p.61: smite evil's later uses are formula-held; the spells are
    // Foundry's row alone.
    expect(brief(await compare('Paladin'))).toEqual([
      ['formulaIncrement', 'smite-evil', 'decision:smite-evil'],
      ['foundryOnly', 'spells', 'decision:spells'],
    ]);
    expect(brief(await compare('Antipaladin'))).toEqual([
      ['foundryOnly', 'spells', 'decision:spells'],
    ]);
    // APG p.33: the bonus feats are gated only by old-style TYPE tokens.
    expect(brief(await compare('Cavalier'))).toEqual([
      ['formulaIncrement', 'challenge', 'decision:challenge'],
      ['ungatedParts', 'bonus-feat', 'decision:bonus-feat'],
    ]);
    // UC p.19: the samurai's order abilities come from its order's records.
    expect(brief(await compare('Samurai'))).toEqual([
      ['formulaIncrement', 'challenge', 'decision:challenge'],
      ['formulaIncrement', 'order', 'decision:order'],
    ]);
  });
});

describe('P7-0’s grant kinds in the P7d classes (#716 P7d, note §5.3)', () => {
  it('reads every class’s grants as gated grants on its own class record', () => {
    // cr_abilities_class.lst:271-285; apg_abilities_globalvar.lst:76-90,
    // :38-51; uc_abilities_globalvar.lst:29-42. No ungated or nested grant.
    expect(
      Object.fromEntries(
        classNames.map((name) => [name, countGrantKinds(name)]),
      ),
    ).toEqual({
      Paladin: [15, 0, 0],
      Antipaladin: [15, 0, 0],
      Cavalier: [14, 0, 0],
      Samurai: [14, 0, 0],
    });
  });

  it('keeps the samurai, an alternate class of the cavalier, to its own records, flags and slug', async () => {
    // UC p.18: "The samurai is an alternate class for the cavalier base
    // class" (ultimateCombat/classes/samurai.html:350); it may choose a
    // cavalier order (:398), and PCGen's shared TYPE.Cavalier only bars
    // taking both classes (uc_classes.lst:36, :75).
    expect(
      await readPrdText({
        page: 'ultimateCombat/classes/samurai.html',
        from: 350,
        to: 350,
      }),
    ).toContain(
      'The samurai is an alternate class for the cavalier base class.',
    );
    expect(
      await pinnedLine(
        'pcgen',
        'roleplaying_game/ultimate_combat/uc_classes.lst:36',
      ),
    ).toContain('[!PRECLASS:1,TYPE.Cavalier=1]');
    const samurai = derive('Samurai');
    expect(
      samurai.acquisitions.filter(
        ({ granted }) => !granted.startsWith('Samurai ~'),
      ),
    ).toEqual([]);
    expect(samurai.flagNamespace).toBe('Samurai');
    expect([...samurai.gatedParts.keys()]).toEqual([
      'BonusFeat6',
      'BonusFeat12',
      'BonusFeat18',
    ]);
    expect(schedule('Samurai').slug).toBe('samurai');
    for (const { externalKey } of incrementEntries(schedule('Samurai')))
      expect(externalKey).toMatch(/^everythingpath\/samurai-/);
    // No cavalier row key or Foundry record is the samurai's.
    const cavalierKeys = new Set(
      scheduleRows(schedule('Cavalier')).map(({ externalKey }) => externalKey),
    );
    expect(
      scheduleRows(schedule('Samurai')).filter(({ externalKey }) =>
        cavalierKeys.has(externalKey),
      ),
    ).toEqual([]);
  });
});

describe('formula rows, skill ranks and bridges (#716 P7d, note §5.4–5)', () => {
  it('holds each formula-held feature’s later rows in the schedule alone, and numbers every other repeating feature', async () => {
    const formulaHeld: Record<ClassName, string[]> = {
      // Note §3: smite evil's uses (cr_abilities_class.lst:1357).
      Paladin: ['smite-evil'],
      Antipaladin: [],
      Cavalier: ['challenge'],
      Samurai: ['challenge', 'order'],
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
  });

  it('gives the paladin’s smite evil a row per use its table prints (note §5.4)', () => {
    // Table: Paladin, smite evil 1/day at 1st to 7/day at 19th
    // (paladin.html:358-376).
    expect(listIncrementNames(schedule('Paladin'))).toMatchObject({
      'everythingpath/paladin-smite-evil-4': 'Smite Evil 2/day',
      'everythingpath/paladin-smite-evil-19': 'Smite Evil 7/day',
    });
  });

  it('gives each class the skill ranks per level of its table, as Foundry records them', async () => {
    // Paladin and antipaladin 2, cavalier and samurai 4 ranks + Int modifier.
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
    expect(ranks).toEqual([2, 2, 4, 4]);
  });

  it('reads the TYPE bridges from the global variables, not by spelling', () => {
    // cr_abilities_globalvar.lst:730.
    expect(derive('Paladin').typeBridges.get('PaladinMercy')).toBe('Mercy');
    // The antipaladin's bridges are spelled Paladin<feature>
    // (apg_abilities_globalvar.lst:724).
    expect(derive('Antipaladin').typeBridges.get('PaladinCruelty')).toBe(
      'Cruelty',
    );
    expect(derive('Antipaladin').typeBridges.has('AntipaladinCruelty')).toBe(
      false,
    );
    // apg_abilities_globalvar.lst:326; uc_abilities_globalvar.lst:319.
    expect(derive('Cavalier').typeBridges.get('CavalierBonusFeats')).toBe(
      'BonusFeat',
    );
    expect(derive('Samurai').typeBridges.get('SamuraiBonusFeats')).toBe(
      'BonusFeat',
    );
    // No bridge gates the cavalier's numbered bonus feats; the schedule
    // names them by both spellings.
    expect(
      derive('Cavalier').typeBridges.has('CavalierCavaliersBonusFeat18'),
    ).toBe(false);
  });

  it('cites the Foundry lines that compute the repeating features’ increments', async () => {
    const readAcquisitionFormula = (className: ClassName, id: string) =>
      schedule(className).features.find((feature) => feature.id === id)
        ?.acquisitionFormula ?? '';
    for (const [className, id, text] of [
      ['Paladin', 'smite-evil', '@attributes.hd.total'],
      ['Paladin', 'lay-on-hands', 'floor(@class.level / 2)'],
      ['Paladin', 'channel-positive-energy', 'ceil(@class.level / 2)'],
      ['Antipaladin', 'smite-good', 'floor((@class.level - 1) / 3)'],
      ['Antipaladin', 'touch-of-corruption', 'floor(@class.level / 2)'],
      ['Antipaladin', 'channel-negative-energy', 'ceil(@class.level / 2)'],
      ['Cavalier', 'challenge', 'floor((@class.level - 1) / 3)'],
      ['Cavalier', 'bonus-feat', 'floor(@class.level / 6)'],
      ['Samurai', 'bonus-feat', 'floor(@class.level / 6)'],
    ] as const)
      expect(
        await pinnedLine('pf1', readAcquisitionFormula(className, id)),
        id,
      ).toContain(text);
    // Mercies, cruelties, orders, the samurai's challenge, divine bond and
    // banner compute nothing from the level.
    for (const [className, id, file] of [
      ['Paladin', 'mercy', 'mercy.Er8h3fZ2edJEviTv'],
      ['Paladin', 'divine-bond', 'divine-bond.z4NJaCcj9VZpBv7d'],
      ['Antipaladin', 'cruelty', 'cruelty.zwZnq5WCBCijev6o'],
      ['Cavalier', 'order', 'order.c3MSLdplxdRZrSxL'],
      ['Cavalier', 'banner', 'banner.pqu1Mvo46iRpVH3I'],
      ['Samurai', 'order', 'order-sam.Uo3yrfkyguM5wkI2'],
      ['Samurai', 'challenge', 'challenge-sam.AOasku7u72NB0q3J'],
    ] as const) {
      expect(readAcquisitionFormula(className, id), id).toBe('');
      expect(
        await readPinned('pf1', `packs/class-abilities/${file}.yaml`),
      ).not.toContain('@class.level');
    }
  });
});

describe('per-increment identities (#716 P7d, note §5.6–7)', () => {
  it('repeats no key in any P7d class’s featuresByLevel, and keys every later row by its slug', () => {
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
      // Smite evil 6, mercies 5.
      Paladin: 11,
      // Smite good 6, cruelties 5.
      Antipaladin: 11,
      // Challenge 6, order abilities 3, bonus feats 2.
      Cavalier: 11,
      Samurai: 11,
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
    // Table: Paladin (paladin.html:361-376).
    expect(listShortIncrementNames('Paladin')).toMatchObject({
      'paladin-smite-evil-13': 'Smite Evil 5/day',
      'paladin-mercy-18': 'Mercy',
    });
    // Table: Antipaladin (paladin.html:408-423).
    expect(listShortIncrementNames('Antipaladin')).toMatchObject({
      'antipaladin-smite-good-10': 'Smite Good 4/day',
      'antipaladin-cruelty-15': 'Cruelty',
    });
    // Table: Cavalier (cavalier.html:357-374).
    expect(listShortIncrementNames('Cavalier')).toMatchObject({
      'cavalier-challenge-7': 'Challenge 3/day',
      'cavalier-order-8': 'Order Ability',
      'cavalier-bonus-feat-18': 'Bonus Feat',
    });
    // Table: Samurai (samurai.html:365-382).
    expect(listShortIncrementNames('Samurai')).toMatchObject({
      'samurai-challenge-19': 'Challenge 7/day',
      'samurai-order-15': 'Order Ability',
      'samurai-bonus-feat-12': 'Bonus Feat',
    });
  });

  it('has no representative seed to equal: none of the four classes is seeded', () => {
    // convex/lib/representativeClassCatalog.ts:1046,
    // representativeSpellcastingCatalog.ts:449-456 (note §5.7).
    for (const identity of ['paladin', 'antipaladin', 'cavalier', 'samurai']) {
      expect(representativeClassFeatureSchedules).not.toHaveProperty(identity);
      expect(representativeSpellcastingSchedules).not.toHaveProperty(identity);
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
const mapPaladinArchetype = (name: string) =>
  mapPublishedArchetype({
    className: 'Paladin',
    archetype: `Paladin Archetype ~ ${name}`,
  });

describe('the P7d archetypes through the mapper (#716 P7d, note §5.8)', () => {
  it('Paladin: Oath against Undeath removes the 3rd- and 9th-level mercies, and its direct lowering of Mercies is named', async () => {
    // Ultimate Magic p.61: ghost touch aura "replaces the paladin's
    // 3rd-level and 9th-level mercies" (ultimateMagic/
    // spellcastingClassOptions/paladin.html:391); detect undead, aura of life
    // and superior channeler replace detect evil, aura of resolve and aura
    // of justice (:390, :393, :394). um_abilities_class.lst:2702 sets
    // Paladin_CF_Mercy3 and Mercy9, and its ghost touch aura also lowers
    // Mercies at 3 and 9 (:1558), which the mercy gates count, so PCGen
    // takes these mercies off twice.
    expect(
      await readPrdText({
        page: 'ultimateMagic/spellcastingClassOptions/paladin.html',
        from: 391,
        to: 391,
      }),
    ).toContain(
      "This ability replaces the paladin's 3rd-level and 9th-level mercies.",
    );
    expect(
      await pinnedLine(
        'pcgen',
        'roleplaying_game/ultimate_magic/um_abilities_class.lst:1558',
      ),
    ).toContain('BONUS:VAR|Mercies|-1|PRECLASS:1,Paladin=3');
    const mapping = mapPaladinArchetype('Oath against Undeath');
    expect(listReplacements(mapping)).toEqual([
      [1, 'pf1/2YqtYAfLcV7KWkpJ', 'whole'],
      [3, 'pf1/Er8h3fZ2edJEviTv', 'part'],
      [9, 'everythingpath/paladin-mercy-9', 'part'],
      [8, 'pf1/jiBCmy0kP1Uwaz0D', 'whole'],
      [11, 'pf1/wHfy3OJmTimVgXuO', 'whole'],
    ]);
    // Its PREMULT guard also names the whole mercy (um_abilities_class.lst:1524).
    expect(summarizeItems(mapping)).toEqual([
      ['conflict', 'countDecrement:mercy'],
      ['conflict', 'stackingGuard'],
    ]);
    const decrement = mapping.items.find(
      ({ id }) => id === 'countDecrement:mercy',
    );
    expect(decrement?.text).toContain('at 3, 9');
    expect(decrement?.text).toContain(
      'Paladin_CF_Mercy3 and Mercy9 also remove',
    );
    expect(planArchetypeBatch({ className: 'Paladin', mapping })).toEqual([6]);
  });

  it('Paladin: Holy Guide removes mercies by flag alone, so nothing lowers Mercies', () => {
    // ACG p.106; acg_abilities_class.lst:3519, :4659.
    const mapping = mapPaladinArchetype('Holy Guide');
    expect(listReplacements(mapping)).toEqual([
      [3, 'pf1/Er8h3fZ2edJEviTv', 'part'],
      [6, 'everythingpath/paladin-mercy-6', 'part'],
    ]);
    expect(
      summarizeItems(mapping).filter(([, id]) =>
        id?.startsWith('countDecrement'),
      ),
    ).toEqual([]);
    // Both replace the 3rd-level mercy.
    expect(
      stackingConflicts([
        mapping,
        mapPaladinArchetype('Oath against Undeath'),
      ]).conflicts.map(({ feature, part }) => [feature, part]),
    ).toEqual([['pf1/Er8h3fZ2edJEviTv', 3]]);
  });

  it('Antipaladin: Blighted Myrmidon removes the 10th-level smite good and 15th-level cruelty, by class level', () => {
    // Ultimate Wilderness; uw_abilities_class.lst:147 sets
    // Antipaladin_CF_SmiteGood10, AuraOfVengeance and Cruelty15.
    const mapping = mapPublishedArchetype({
      className: 'Antipaladin',
      archetype: 'Antipaladin Archetype ~ Blighted Myrmidon',
    });
    expect(listReplacements(mapping)).toEqual([
      [10, 'everythingpath/antipaladin-smite-good-10', 'part'],
      [11, 'pf1/SqTaI2sHPIZpLDtQ', 'whole'],
      [15, 'everythingpath/antipaladin-cruelty-15', 'part'],
    ]);
    // Foundry's smite good counts every use from the antipaladin level
    // (smite-good.DbC7QZBYYIClw1m6.yaml:50).
    expect(summarizeItems(mapping)).toEqual([
      ['unmatchedReplacement', 'alters:fiendish-boon'],
      ['unmatchedReplacement', 'alters:unholy-champion'],
      ['conflict', 'partialFormula:smite-good'],
    ]);
    expect(planArchetypeBatch({ className: 'Antipaladin', mapping })).toEqual([
      7,
    ]);
  });

  it('Antipaladin: the inventory gives Knight of the Sepulcher, keyed as a paladin’s, to the antipaladin, its key unchanged', () => {
    // UC p.63: keyed "Paladin Archetype ~" but it requires the antipaladin
    // (PRECLASS:1,Antipaladin=1, uc_abilities_class.lst:1446) and sets
    // Antipaladin_CF_ flags (:1928).
    const archetype = 'Paladin Archetype ~ Knight Of The Sepulcher';
    const className = readInventoryClass({ inventory, archetype });
    expect(className).toBe('Antipaladin');
    const mapping = mapPublishedArchetype({ className, archetype });
    expect(readArchetypeDetail(mapping).classKeys).toEqual([
      'pf1/uynVENa0deVdmf53',
    ]);
    expect(mapping.subject.entry.externalKey).toBe(
      'everythingpath/paladin-knight-of-the-sepulcher',
    );
    expect(listReplacements(mapping)).toContainEqual([
      10,
      'everythingpath/antipaladin-smite-good-10',
      'part',
    ]);
    expect(listReplacements(mapping)).toContainEqual([
      3,
      'pf1/zwZnq5WCBCijev6o',
      'whole',
    ]);
  });

  it('Antipaladin: the inventory gives Dread Vanguard, keyed as a paladin’s, to the antipaladin: its spells and aura of sin, its grants at their antipaladin levels', () => {
    // Champions of Corruption p.22: keyed "Paladin Archetype ~" but it
    // requires the antipaladin (PRECLASS:1,Antipaladin=1,
    // coc_abilities_class.lst:12); beacon of evil "replaces the dread
    // vanguard's ability to cast spells" (:13), granted at Antipaladin 4,
    // and dark emissary at Antipaladin 14 (:12).
    const archetype = 'Paladin Archetype ~ Dread Vanguard';
    const className = readInventoryClass({ inventory, archetype });
    expect(className).toBe('Antipaladin');
    const mapping = mapPublishedArchetype({ className, archetype });
    const detail = readArchetypeDetail(mapping);
    expect(detail.classKeys).toEqual(['pf1/uynVENa0deVdmf53']);
    expect(mapping.subject.entry.externalKey).toBe(
      'everythingpath/paladin-dread-vanguard',
    );
    expect(listReplacements(mapping)).toEqual([
      [4, 'pf1/4y0HhgmT2yPcdUoK', 'whole'],
      [14, 'pf1/nyz3JgtYMrJZF6o5', 'whole'],
    ]);
    expect(detail.adds.map(({ classLevel }) => classLevel)).toEqual([4, 14]);
    expect(summarizeItems(mapping)).toContainEqual([
      'uncheckedCasting',
      'casting:spells',
    ]);
  });

  it('Cavalier: Strategist removes the 18th-level bonus feat, its flag held on the defect', async () => {
    // UC p.39: strategic supremacy "replaces the cavalier's 18th-level bonus
    // feat"; drill instructor and tactical advantage replace expert trainer
    // and greater banner (ultimateCombat/classArchetypes/cavalier.html:438-440).
    // uc_abilities_class.lst:475 (TYPE.CavalierCavaliersBonusFeat18, PCGen's
    // gate) and :1890 (Cavalier_CF_BonusFeat18, which gates nothing).
    const text = await readPrdText({
      page: 'ultimateCombat/classArchetypes/cavalier.html',
      from: 438,
      to: 440,
    });
    expect(text).toContain(
      "This ability replaces the cavalier's 18th-level bonus feat.",
    );
    expect(text).toContain('This ability replaces expert trainer.');
    const mapping = mapPublishedArchetype({
      className: 'Cavalier',
      archetype: 'Cavalier Archetype ~ Strategist',
    });
    expect(listReplacements(mapping)).toEqual([
      [4, 'pf1/nBpz562qzAntafUI', 'whole'],
      [14, 'pf1/1Yy6Fn3UD82uviFg', 'whole'],
      [18, 'everythingpath/cavalier-bonus-feat-18', 'part'],
    ]);
    // Foundry's bonus feat counts every feat from the level
    // (bonus-feat-cav.vfu0FW2XYF7cBUQp.yaml:13); its tactician is the
    // cavalier's, altered (:437).
    expect(summarizeItems(mapping)).toEqual([
      ['conflict', 'partialFormula:bonus-feat'],
      ['conflict', 'defect:bonus-feat-flags'],
      ['unmatchedReplacement', 'alters:tactician'],
    ]);
    expect(planArchetypeBatch({ className: 'Cavalier', mapping })).toEqual([5]);
  });

  it('Cavalier: Herald Squire removes the 2nd-level order ability, and the order survives', async () => {
    // Knights of the Inner Sea p.21: fleet of foot "replaces the 2nd-level
    // order ability" (kotis_abilities_class.lst:13), Cavalier_CF_OrderAbility2
    // (:11). The 1st-level Order row is the pledge, apart from the order
    // abilities (cavalier.html:386, :406), so only the 2nd-level row goes.
    expect(
      await pinnedLine(
        'pcgen',
        'player_companion/knights_of_the_inner_sea/kotis_abilities_class.lst:13',
      ),
    ).toContain('This ability replaces the 2nd-level order ability.');
    const mapping = mapPublishedArchetype({
      className: 'Cavalier',
      archetype: 'Cavalier Archetype ~ Herald Squire',
    });
    const order = 'pf1/c3MSLdplxdRZrSxL';
    const detail = readArchetypeDetail(mapping);
    expect(
      detail.replaces.filter(
        ({ externalKey }) =>
          externalKey === order ||
          externalKey.startsWith('everythingpath/cavalier-order'),
      ),
    ).toEqual([
      {
        classLevel: 2,
        externalKey: 'everythingpath/cavalier-order-2',
        scope: 'part',
      },
    ]);
    expect(
      (detail.featureChanges ?? []).filter(
        ({ externalKey }) => externalKey === order,
      ),
    ).toEqual([{ externalKey: order, scope: 'part', classLevel: 2 }]);
  });

  it('Samurai: Sovereign Blade removes the bonus feats whole, held on the undefined gate', () => {
    // Legacy of Dragons p.14; lod_abilities_class.lst:334 sets
    // Samurai_CF_BonusFeats, which sets Samurai_CF_BonusFeat
    // (uc_abilities_globalvar.lst:295) while the grant reads the undefined
    // Samurai_CF_BonusFeats (:36).
    const mapping = mapPublishedArchetype({
      className: 'Samurai',
      archetype: 'Samurai Archetype ~ Sovereign Blade',
    });
    expect(listReplacements(mapping)).toEqual([
      [1, 'pf1/EpDI0Qi5SDRmL4lK', 'whole'],
      [4, 'pf1/IA4Z4xwEeubcDqF4', 'whole'],
      [6, 'pf1/lKnfkRSOpPjT4qRy', 'whole'],
    ]);
    expect(summarizeItems(mapping)).toEqual([
      ['conflict', 'defect:bonus-feats-gate'],
    ]);
    expect(planArchetypeBatch({ className: 'Samurai', mapping })).toEqual([5]);
  });

  it('Samurai: a cavalier archetype names no samurai row, whatever names the classes share', () => {
    // Note §6, decision 2: shared names establish no applicability.
    const mapping = mapPublishedArchetype({
      className: 'Samurai',
      archetype: 'Cavalier Archetype ~ Strategist',
    });
    expect(readArchetypeDetail(mapping).replaces).toEqual([]);
    expect(summarizeItems(mapping)).toContainEqual([
      'unmatchedReplacement',
      'noRemovalSignal',
    ]);
  });
});
