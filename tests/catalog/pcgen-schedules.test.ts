// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { representativeArchetypeCatalog } from '../../convex/lib/representativeArchetypeCatalog';
import {
  representativeAdditionalClassFeatures,
  representativeClassFeatureSchedules,
} from '../../convex/lib/representativeClassCatalog';
import { buildEffectiveView } from '../../scripts/catalog/pcgen/effective';
import {
  allIncrementKeys,
  incrementEntries,
  resolveSuffix,
  scheduleRows,
  unscheduledClass,
  type UnscheduledClass,
} from '../../scripts/catalog/pcgen/schedules';
import { pcgen716ArchetypeFiles } from '../fixtures/pcgen-716/archetype-files';
import { brief, pinnedLine, scheduleChecks } from './pcgen-716-schedules';
import { readPcgenFixtureTree } from './pcgen-716-tree';
import { readPinned } from './pinned-sources';

const tree = await readPcgenFixtureTree(pcgen716ArchetypeFiles);
const view = buildEffectiveView(tree);

const { schedule, derive, compare, levelOf } = scheduleChecks({ tree, view });

describe('reviewed base class schedules (#716 P5, plan §4)', () => {
  it('gives every numbered variable its explicit level, by class level or by order', () => {
    // CRB Fighter table (pp.55–56): armor training 1 at 3, weapon training 3
    // at 13; bonus feats at 1 and every even level.
    expect(levelOf('Fighter', 'ArmorTraining1')).toEqual(['armor-training', 3]);
    expect(levelOf('Fighter', 'WeaponTraining3')).toEqual([
      'weapon-training',
      13,
    ]);
    expect(levelOf('Fighter', 'BonusFeat4')).toEqual(['bonus-feats', 4]);
    expect(levelOf('Fighter', 'Bravery')).toEqual(['bravery', null]);
    // CRB Ranger table (p.64): the 2nd favored enemy at 5, the 6th-level
    // combat style feat at 6.
    expect(levelOf('Ranger', 'FavoredEnemy2')).toEqual(['favored-enemy', 5]);
    expect(levelOf('Ranger', 'CombatStyleFeat6')).toEqual([
      'combat-style-feat',
      6,
    ]);
    // CRB Rogue table (p.68): trap sense +3 at 9, a talent at 2, sneak
    // attack +2d6 at 3.
    expect(levelOf('Rogue', 'TrapSense3')).toEqual(['trap-sense', 9]);
    expect(levelOf('Rogue', 'RogueTalent2')).toEqual(['rogue-talents', 2]);
    expect(levelOf('Rogue', 'SneakAttack3')).toEqual(['sneak-attack', 3]);
    expect(levelOf('Wizard', 'BonusFeat10')).toEqual(['bonus-feats', 10]);
    // Not table rows.
    expect(levelOf('Ranger', 'AnimalCompanion')).toEqual(['option']);
    expect(levelOf('Fighter', 'TowerShieldProficiency')).toEqual([
      'proficiency',
    ]);
    expect(levelOf('Rogue', 'DebilitatingInjury')).toEqual(['unknown']);
  });

  it('gives the Fighter and Rogue rows the representative CRB schedules give', () => {
    // convex/lib/representativeClassCatalog.ts: "Exact feature rows from CRB
    // Tables 3-9 and 3-13", one seed per increment (`fighter-bravery-6`).
    const seeded = (identity: string) =>
      (representativeClassFeatureSchedules[identity] ?? [])
        .map(({ classLevel, catalogEntryId }) => [
          classLevel,
          catalogEntryId
            .replace(`${identity}-`, '')
            .replace(/-\d+$/, '')
            .replace(/^(bonus-feat|talent)$/, '$1s')
            .replace(/^talents$/, 'rogue-talents'),
        ])
        .sort(([a], [b]) => Number(a) - Number(b));
    const reviewed = (className: string) =>
      scheduleRows(schedule(className)).map(({ classLevel, feature }) => [
        classLevel,
        feature,
      ]);
    for (const [className, identity] of [
      ['Fighter', 'fighter'],
      ['Rogue', 'rogue'],
    ] as const)
      expect(
        reviewed(className).sort(
          (a, b) =>
            Number(a[0]) - Number(b[0]) ||
            String(a[1]).localeCompare(String(b[1])),
        ),
      ).toEqual(
        seeded(identity).sort(
          (a, b) =>
            Number(a[0]) - Number(b[0]) ||
            String(a[1]).localeCompare(String(b[1])),
        ),
      );
  });

  it('keeps Bravery one PCGen row with a formula and only the reviewed table gives its five rows', async () => {
    const pcgen = derive('Fighter');
    // cr_abilities_class.lst:258 gates Bravery at 2; its later bonuses are
    // only BONUS:VAR|Bravery|(BraveryLVL+2)/4 (:888).
    expect(
      pcgen.acquisitions.filter(({ suffix }) => suffix === 'Bravery'),
    ).toEqual([
      {
        granted: 'Fighter ~ Bravery',
        suffix: 'Bravery',
        level: 2,
        at: 'roleplaying_game/core_rulebook/cr_abilities_class.lst:258',
      },
    ]);
    expect(
      await pinnedLine(
        'pcgen',
        'roleplaying_game/core_rulebook/cr_abilities_class.lst:888',
      ),
    ).toContain('BONUS:VAR|Bravery|(BraveryLVL+2)/4');
    expect(
      [...pcgen.defined].filter((name) => name.startsWith('Bravery')),
    ).toEqual(['Bravery']);
    expect(
      [...pcgen.gatedParts.keys()].some((part) => part.startsWith('Bravery')),
    ).toBe(false);
    const findings = (await compare('Fighter')).filter(
      ({ feature }) => feature === 'bravery',
    );
    expect(brief(findings)).toEqual([
      ['formulaIncrement', 'bravery', 'decision:bravery'],
    ]);
    expect(
      scheduleRows(schedule('Fighter'))
        .filter(({ feature }) => feature === 'bravery')
        .map(({ classLevel, externalKey }) => [classLevel, externalKey]),
    ).toEqual([
      // P6: the acquisition is the Foundry feature; each later row its own
      // increment entry.
      [2, 'pf1/h0Brxw6khcjlEf1T'],
      [6, 'everythingpath/fighter-bravery-6'],
      [10, 'everythingpath/fighter-bravery-10'],
      [14, 'everythingpath/fighter-bravery-14'],
      [18, 'everythingpath/fighter-bravery-18'],
    ]);
  });

  it('settles every difference between PCGen, Foundry and the table with a cited decision or defect', async () => {
    for (const className of ['Fighter', 'Rogue', 'Ranger', 'Wizard'])
      expect(
        (await compare(className)).filter(({ settledBy }) => !settledBy),
      ).toEqual([]);
    // Proficiency grants (cr_abilities_class.lst:237-242) stay prose.
    const fighter = (await compare('Fighter')).filter(
      ({ kind, feature }) =>
        kind !== 'nonRow' || !/Proficiency|Proficiencies/.test(feature),
    );
    expect(brief(fighter)).toEqual([
      ['formulaIncrement', 'bravery', 'decision:bravery'],
      ['pcgenOnly', 'armor-mastery', 'decision:armor-mastery'],
      ['nonRow', 'pf1/iqeyCQIIVnNt0p3h', 'foundryNonRow:pf1/iqeyCQIIVnNt0p3h'],
    ]);
    expect(brief(await compare('Rogue'))).toEqual([
      ['ungatedParts', 'sneak-attack', 'decision:sneak-attack'],
      ['ungatedParts', 'trap-sense', 'decision:trap-sense'],
      [
        'foundryOnly',
        'improved-uncanny-dodge',
        'decision:improved-uncanny-dodge',
      ],
      ['foundryOnly', 'advanced-talents', 'decision:advanced-talents'],
    ]);
    expect(brief(await compare('Ranger'))).toEqual([
      ['acquisitionLevel', 'favored-terrain', 'decision:favored-terrain'],
      ['sharedGate', 'improved-evasion', 'evasion-gate'],
      ['sharedGate', 'improved-quarry', 'quarry-gate'],
      ['undefinedPart', 'favored-enemy', 'favored-enemy-5'],
      ['formulaIncrement', 'favored-terrain', 'decision:favored-terrain'],
      ['foundryOnly', 'spells', 'decision:spells'],
    ]);
    expect(brief(await compare('Wizard'))).toEqual([
      ['nonRow', 'ClassSkills', 'nonRow:ClassSkills'],
      ['nonRow', 'WeaponProficiencies', 'nonRow:WeaponProficiencies'],
      ['nonRow', 'BonusLanguages', 'nonRow:BonusLanguages'],
    ]);
  });

  it('gives each class the skill ranks per level of its table, as Foundry records them', async () => {
    // CRB: fighter 2, rogue 8, ranger 6, wizard 2 ranks + Int modifier.
    const ranks = await Promise.all(
      ['Fighter', 'Rogue', 'Ranger', 'Wizard'].map(async (className) => {
        const { skillRanksPerLevel, skillRanksAt, foundryFile } =
          schedule(className);
        const [file = '', line = ''] = skillRanksAt.split(':');
        expect(file).toBe(foundryFile);
        const text = (await readPinned('pf1', file)).split(/\r?\n/)[
          Number(line) - 1
        ];
        expect(text).toBe(`  skillsPerLevel: ${skillRanksPerLevel}`);
        return skillRanksPerLevel;
      }),
    );
    expect(ranks).toEqual([2, 8, 6, 2]);
  });

  it('reads the TYPE bridges from the global variables, not by spelling', () => {
    const fighter = derive('Fighter').typeBridges;
    // cr_abilities_globalvar.lst:485-486, :489.
    expect(fighter.get('FighterArmorTraining_ALL')).toBe('ArmorTraining');
    expect(fighter.get('FighterWeaponTraining_ALL')).toBe('WeaponTraining');
    expect(fighter.get('FighterArmorTraining1')).toBe('ArmorTraining1');
    // Weapon training parts have no bridge: an archetype's
    // TYPE.FighterWeaponTraining1 sets nothing in PCGen.
    expect(fighter.has('FighterWeaponTraining1')).toBe(false);
    // :838 bridges both spellings of camouflage.
    const ranger = derive('Ranger').typeBridges;
    expect(ranger.get('RangerCamoflage')).toBe('Camouflage');
    expect(ranger.get('RangerCamouflage')).toBe('Camouflage');
  });
});

// #716 P6 (research note 716-p6 §3): every later row is its own increment
// entry, so no key repeats in `featuresByLevel` and the acquisition record's
// modifiers count once.
describe('per-increment identities (#716 P6)', () => {
  const classNames = ['Fighter', 'Rogue', 'Ranger', 'Wizard'] as const;

  it('repeats no key in any reviewed class’s featuresByLevel', () => {
    for (const className of classNames) {
      const keys = scheduleRows(schedule(className)).map(
        ({ externalKey }) => externalKey,
      );
      expect(new Set(keys).size, className).toBe(keys.length);
    }
  });

  it('gives each later bravery row an entry with no modifiers under the Foundry feature', () => {
    // CRB p.56: bravery at 2, 6, 10, 14 and 18; the acquisition stays
    // Foundry's bravery.h0Brxw6khcjlEf1T.
    const bravery = incrementEntries(schedule('Fighter')).filter(
      ({ detail }) =>
        detail.kind === 'classFeature' &&
        detail.parentFeature === 'pf1/h0Brxw6khcjlEf1T',
    );
    expect(
      bravery.map(({ externalKey, name, detail, modifiers }) => [
        externalKey,
        name,
        detail,
        modifiers,
      ]),
    ).toEqual(
      [6, 10, 14, 18].map((level, index) => [
        `everythingpath/fighter-bravery-${level}`,
        // CRB Table 3–9: Bravery +2 at 6th through +5 at 18th.
        `Bravery +${index + 2}`,
        {
          kind: 'classFeature',
          parentFeature: 'pf1/h0Brxw6khcjlEf1T',
          // The part the sheet gives a row without one (classFeatureMetadata).
          part: `${level}:pf1/h0Brxw6khcjlEf1T`,
        },
        [],
      ]),
    );
    expect(bravery[0]?.description).toBe(
      "<p>Bravery +2: the Fighter table's 6th-level row of Bravery (Pathfinder RPG Core Rulebook pp. 55–57). The Bravery entry's own rules give its value.</p>",
    );
    expect(bravery[0]?.sources).toEqual([
      { book: 'Pathfinder RPG Core Rulebook', pages: '55–57' },
    ]);
    expect(bravery[0]?.provenance?.['detail.part']).toEqual({
      source: 'overlay',
      locator: {
        externalKey: 'everythingpath/fighter-bravery-6',
        kind: 'schedule',
        target: 'detail.part',
      },
    });
  });

  it('names each Fighter and Rogue increment as the seeded CRB tables do', () => {
    // The representative seeds transcribe CRB Tables 3–9 and 3–13 (pp. 56,
    // 68); their names are the independent source here.
    const seeded = new Map(
      [
        ...representativeArchetypeCatalog,
        ...representativeAdditionalClassFeatures,
      ].map(({ ruleIdentity, name }) => [ruleIdentity, name]),
    );
    const seedRows = (identity: string) =>
      new Map<string, string | undefined>(
        (representativeClassFeatureSchedules[identity] ?? []).map(
          ({ classLevel, catalogEntryId }) =>
            [
              `${classLevel}:${catalogEntryId.replace(/-\d+$/, '')}`,
              seeded.get(catalogEntryId),
            ] as const,
        ),
      );
    const seedKey: Record<string, string> = {
      'bonus-feats': 'bonus-feat',
      'rogue-talents': 'talent',
    };
    for (const [className, identity] of [
      ['Fighter', 'fighter'],
      ['Rogue', 'rogue'],
    ] as const) {
      const rows = seedRows(identity);
      for (const { externalKey, name } of incrementEntries(
        schedule(className),
      )) {
        const [, feature = '', classLevel = ''] =
          /^everythingpath\/\w+?-(.+)-(\d+)$/.exec(externalKey) ?? [];
        expect(name, externalKey).toBe(
          rows.get(`${classLevel}:${identity}-${seedKey[feature] ?? feature}`),
        );
      }
    }
  });

  it('names the Ranger and Wizard increments by their CRB table labels', () => {
    const names = (className: string) =>
      Object.fromEntries(
        incrementEntries(schedule(className)).map(({ externalKey, name }) => [
          externalKey.replace('everythingpath/', ''),
          name,
        ]),
      );
    expect(names('Ranger')).toMatchObject({
      'ranger-favored-enemy-5': '2nd Favored Enemy',
      'ranger-favored-enemy-20': '5th Favored Enemy',
      'ranger-combat-style-feat-6': 'Combat Style Feat',
      'ranger-favored-terrain-8': '2nd Favored Terrain',
    });
    expect(names('Wizard')).toEqual({
      'wizard-bonus-feats-10': 'Bonus Feat',
      'wizard-bonus-feats-15': 'Bonus Feat',
      'wizard-bonus-feats-20': 'Bonus Feat',
    });
  });

  it('keys every later row and only later rows', () => {
    // Fighter: 11 bonus feats, 5 bravery, 4 armor and 4 weapon training
    // rows, one acquisition each; Rogue: 10 sneak attack, 10 talents, 6 trap
    // sense; Ranger: 5 favored enemies, 5 combat style feats, 4 favored
    // terrains; Wizard: 4 bonus feats (CRB pp.55–57, 67–70, 64–67, 77–83).
    expect(
      Object.fromEntries(
        classNames.map((className) => [
          className,
          incrementEntries(schedule(className)).length,
        ]),
      ),
    ).toEqual({ Fighter: 20, Rogue: 23, Ranger: 11, Wizard: 3 });
    // Every slice's increment keys, counted here alone; each slice's suite
    // counts its own classes': P5's 57, P7a's 47
    // (pcgen-schedules-companions.test.ts), P7b's 145
    // (pcgen-schedules-martial.test.ts), P7c's 84
    // (pcgen-schedules-rage-performance.test.ts), P7d's 44
    // (pcgen-schedules-smite-challenge.test.ts), P7e's 79
    // (pcgen-schedules-alchemy-talents.test.ts), #772's 18
    // (pcgen-schedules-judgment-arcana.test.ts), #771A's 23
    // (pcgen-schedules-channel-bloodline.test.ts) and #771B's 24
    // (pcgen-schedules-mystery-hex.test.ts).
    expect(allIncrementKeys()).toHaveLength(521);
  });
});

describe('a class awaiting review (#716 P6)', () => {
  it('has no rows, non-rows, aliases or defects, and can’t be given any', () => {
    const witch = unscheduledClass({
      className: 'Witch',
      classKey: 'pf1/RC4D4WFT5kRKkdqp',
      foundryFile: 'packs/classes/witch.RC4D4WFT5kRKkdqp.yaml',
      skillRanksPerLevel: 2,
      skillRanksAt: 'packs/classes/witch.RC4D4WFT5kRKkdqp.yaml:1',
      classSkillsRecord: 'Class Skills ~ Witch',
    });
    expect(witch).toMatchObject({
      kind: 'unscheduled',
      acquisitionRecords: ['Witch'],
      metadataRecords: ['Witch'],
      flagNamespace: 'Witch',
      slug: 'witch',
      features: [],
      nonRows: {},
      defects: [],
    });
    expect(resolveSuffix(witch, 'Hex1')).toEqual({ kind: 'unknown' });
    const [bonusFeats] = schedule('Fighter').features;
    const contradictory: UnscheduledClass = {
      ...witch,
      // @ts-expect-error: an unscheduled class can't carry a feature row.
      features: [bonusFeats],
    };
    expect(contradictory.kind).toBe('unscheduled');
  });
});
