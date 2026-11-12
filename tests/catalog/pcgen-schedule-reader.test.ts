// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildEffectiveView } from '../../scripts/catalog/pcgen/effective';
import {
  compareSchedule,
  foundryAssociations,
  pcgenSchedule,
  rowKeyOf,
  scheduleRows,
  unscheduledClass,
  type ReviewedSchedule,
  type ScheduledFeature,
} from '../../scripts/catalog/pcgen/schedules';
import { pcgenPin } from '../../scripts/catalog/inventory';
import { pcgen716ReaderFiles } from '../fixtures/pcgen-716/reader-files';
import { readPcgenFixtureTree } from './pcgen-716-tree';
import { readPinned } from './pinned-sources';

// #716 P7-0 (research note 716-p7-rules §2): the reader phase before the
// schedule slices. Every case reads the pinned PCGen files; the schedules are
// built here in memory, never from committed curation state.

const tree = await readPcgenFixtureTree(pcgen716ReaderFiles);
const view = buildEffectiveView(tree);

const acg = 'roleplaying_game/advanced_class_guide';
const apgc = 'roleplaying_game/advanced_players_guide/apg_abilities_class.lst';
const puc = 'roleplaying_game/pathfinder_unchained/pu_abilities_class.lst';

/** A class whose table no one has reviewed: its PCGen names only. */
const unscheduled = (className: string) =>
  unscheduledClass({
    className,
    classKey: 'pf1/unreviewed',
    foundryFile: 'packs/classes/unreviewed.yaml',
    skillRanksPerLevel: 2,
    skillRanksAt: 'packs/classes/unreviewed.yaml:1',
    classSkillsRecord: `Class Skills ~ ${className}`,
  });
const derive = (className: string) =>
  pcgenSchedule({ tree, view, schedule: unscheduled(className) });

async function pinnedLine(at: string) {
  const [file = '', line = ''] = at.split(':');
  const text = await readPinned('pcgen', `${pcgenPin.directory}/${file}`);
  return text.split(/\r?\n/)[Number(line) - 1] ?? '';
}

/** Barbarian (Unchained)'s PCGen names (pu_abilities_class.lst:114-141). */
const unchainedBarbarian = {
  acquisitionRecords: ['Barbarian ~ Unchained Class Full'],
  metadataRecords: [
    'Barbarian',
    'Barbarian ~ Standard Class Full',
    'Barbarian ~ Unchained Class Full',
  ],
  flagNamespace: 'Barbarian',
  slug: 'unchained-barbarian',
};
const standardBarbarian = {
  ...unchainedBarbarian,
  acquisitionRecords: ['Barbarian ~ Standard Class Full'],
  slug: 'barbarian',
};

/** A reviewed schedule built in memory, for a class P7's slices review later. */
function reviewed(
  fields: Partial<Omit<ReviewedSchedule, 'className'>> &
    Pick<ReviewedSchedule, 'features'> & { className: string },
): ReviewedSchedule {
  return {
    ...unscheduled(fields.className),
    kind: 'reviewed',
    source: { book: 'Pathfinder RPG Pathfinder Unchained', pages: '8–11' },
    nonRows: {},
    typeAliases: {},
    foundryNonRows: [],
    defects: [],
    ...fields,
  } as ReviewedSchedule;
}
const feature = (
  fields: Pick<ScheduledFeature, 'id' | 'name' | 'externalKey' | 'levels'> &
    Partial<ScheduledFeature>,
): ScheduledFeature => ({
  whole: [],
  parts: {},
  increments: fields.levels.length > 1 ? 'formula' : 'none',
  pcgen: null,
  foundry: null,
  ...fields,
});

describe('base class level blocks (#716 P7-0 §2.1)', () => {
  it('reads a Brawler level line’s gated grant as an acquisition at the line’s level', async () => {
    // ACG p.23: bonus feats at 2nd level; PCGen grants them only on the
    // class block's level line, with no Brawler_CFP_Level gate.
    const at = `${acg}/acg_classes.lst:95`;
    expect(await pinnedLine(at)).toBe(
      '2\tABILITY:Brawler Class Feature|AUTOMATIC|Brawler ~ Bonus Feats|PREVAREQ:Brawler_CF_BonusFeats,0',
    );
    const brawler = derive('Brawler');
    expect(
      brawler.acquisitions.filter(({ suffix }) => suffix === 'BonusFeats'),
    ).toEqual([
      { granted: 'Brawler ~ Bonus Feats', suffix: 'BonusFeats', level: 2, at },
    ]);
    // ACG p.23-25: thirteen gated grants from 1st to 20th level.
    expect(
      brawler.acquisitions.map(({ suffix, level }) => [suffix, level]),
    ).toEqual([
      ['Proficiencies', 1],
      ['BrawlersCunning', 1],
      ['MartialFlexibility', 1],
      ['MartialTraining', 1],
      ['BonusFeats', 2],
      ['BrawlersFlurry', 2],
      ['ManeuverTraining', 3],
      ['ACBonus', 4],
      ['Knockout', 4],
      ['BrawlersStrike', 5],
      ['CloseWeaponMastery', 5],
      ['AwesomeBlow', 16],
      ['ImprovedAwesomeBlow', 20],
    ]);
  });

  it('binds a CATEGORY=CLASS .MOD line to the class record, not to the class block', async () => {
    // OA p.10: elemental focus at 1st level. Occult Adventures spells the
    // category CLASS (`Kineticist	CATEGORY:CLASS`, oa_abilities_class.lst:19).
    const at = 'roleplaying_game/occult_adventures/oa_abilities_class.lst:39';
    expect(await pinnedLine(at)).toContain(
      'CATEGORY=CLASS|Kineticist.MOD\tABILITY:Kineticist Class Feature|AUTOMATIC|Kineticist ~ Elemental Focus|PREVAREQ:Kineticist_CF_ElementalFocus,0|PREVARGTEQ:Kineticist_CFP_Level,1',
    );
    expect(
      derive('Kineticist').acquisitions.find(
        ({ suffix }) => suffix === 'ElementalFocus',
      ),
    ).toEqual({
      granted: 'Kineticist ~ Elemental Focus',
      suffix: 'ElementalFocus',
      level: 1,
      at,
    });
    const [block] = tree.baseClasses.filter(
      ({ locator }) => locator.key === 'Kineticist',
    );
    expect(block?.mods).toEqual([]);
  });

  it('retains base class blocks beside prestige blocks and skips Ex- classes', () => {
    const keys = tree.baseClasses.map(({ locator }) => locator.key);
    expect(keys).toEqual(expect.arrayContaining(['Brawler', 'Warpriest']));
    expect(keys.filter((key) => key.startsWith('Ex-'))).toEqual([]);
    expect(
      tree.prestigeClasses.some(({ locator }) => locator.key === 'Brawler'),
    ).toBe(false);
    // The class grant on the level line (`1 ABILITY:Class|AUTOMATIC|Warpriest`,
    // acg_classes.lst:369) grants the class record, not a feature.
    expect(
      derive('Warpriest').ungatedGrants.map(({ granted }) => granted),
    ).not.toContain('Warpriest');
  });
});

describe('kept-part gates, nested prerequisites and padding (#716 P7-0 §2.2–3)', () => {
  it('reads the Witch’s hexes, added while kept, as gated parts at their levels', async () => {
    // APG p.65: a hex at 1st level and every even level.
    expect(await pinnedLine(`${apgc}:868`)).toContain(
      'BONUS:ABILITYPOOL|Witch Hex|1|PREVARGTEQ:WitchLVL,1|PREVAREQ:Witch_CF_Hex1,0',
    );
    const { gatedParts } = derive('Witch');
    expect(gatedParts.get('Hex1')).toEqual({
      at: `${apgc}:868`,
      level: 1,
      polarity: 'kept',
    });
    expect(gatedParts.get('Hex8')).toMatchObject({
      level: 8,
      polarity: 'kept',
    });
  });

  it('finds the Investigator talent’s gate and level inside PREMULT', async () => {
    // ACG p.31: investigator talents at 3rd level and every 2 levels after.
    const at = `${acg}/acg_abilities_class.lst:1260`;
    expect(await pinnedLine(at)).toContain(
      'PREMULT:2,[PRECLASS:1,Investigator=3],[PREVAREQ:Investigator_CF_Talent3,1]',
    );
    expect(derive('Investigator').gatedParts.get('Talent3')).toEqual({
      at,
      level: 3,
      polarity: 'removal',
    });
  });

  it('parses zero-padded levels as numbers: Samurai =06, Kineticist 01', async () => {
    // UC p.20: samurai bonus feats at 6, 12 and 18.
    const samurai =
      'roleplaying_game/ultimate_combat/uc_abilities_class.lst:210';
    expect(await pinnedLine(samurai)).toContain(
      'PRECLASS:1,Samurai=06|PREVAREQ:Samurai_CF_BonusFeat6,1',
    );
    expect(derive('Samurai').gatedParts.get('BonusFeat6')).toEqual({
      at: samurai,
      level: 6,
      polarity: 'removal',
    });
    // OA p.12: infusions at 1st, 3rd and every odd level.
    const kineticist =
      'roleplaying_game/occult_adventures/oa_abilities_class.lst:559';
    expect(await pinnedLine(kineticist)).toContain(
      'PREVARGTEQ:KineticistLVL,01|PREVAREQ:Kineticist_CF_Infusion1,1',
    );
    const { gatedParts } = derive('Kineticist');
    expect(gatedParts.get('Infusion1')).toEqual({
      at: kineticist,
      level: 1,
      polarity: 'removal',
    });
    expect(gatedParts.get('Infusion3')?.level).toBe(3);
  });

  it('reads levels on variables bound to the class level, whatever their names', async () => {
    // CRB p.51: wild shape from 4th level, once per day at 4th. The gates
    // test DruidWildShape, bound to DruidLVL (cr_abilities_class.lst:796),
    // which the class block binds to the class level (cr_classes.lst:93).
    const crac = 'roleplaying_game/core_rulebook/cr_abilities_class.lst';
    expect(await pinnedLine(`${crac}:796`)).toContain(
      'BONUS:VAR|DruidWildShape|DruidLVL',
    );
    expect(
      await pinnedLine('roleplaying_game/core_rulebook/cr_classes.lst:93'),
    ).toContain('BONUS:VAR|DruidLVL|CL');
    expect(await pinnedLine(`${crac}:857`)).toContain(
      'PREMULT:2,[PREVARGTEQ:DruidWildShape,4],[PREVAREQ:Druid_CF_WildShapeOptions4,0]',
    );
    expect(await pinnedLine(`${crac}:863`)).toContain(
      'PREMULT:2,[PREVARGTEQ:DruidWildShape,4],[PREVAREQ:Druid_CF_WildShapeUses4,1]',
    );
    const { gatedParts } = derive('Druid');
    expect(gatedParts.get('WildShapeOptions4')).toEqual({
      at: `${crac}:857`,
      level: 4,
      polarity: 'kept',
    });
    expect(gatedParts.get('WildShapeUses4')).toEqual({
      at: `${crac}:863`,
      level: 4,
      polarity: 'removal',
    });
    // ACG p.15: a bloodline feat at 6th level. BloodragerBloodlineFeatProgression
    // is bound, through BloodragerBloodlineProgressionLVL, to BloodragerLVL
    // (acg_abilities_class.lst:359-361), the class level (acg_classes.lst:40).
    const acgc = `${acg}/acg_abilities_class.lst`;
    expect(await pinnedLine(`${acgc}:359`)).toContain(
      'BONUS:VAR|BloodragerBloodlineProgressionLVL|BloodragerLVL|TYPE=Base',
    );
    expect(await pinnedLine(`${acgc}:361`)).toContain(
      'BONUS:VAR|BloodragerBloodlineFeatProgression|BloodragerBloodlineProgressionLVL|TYPE=Base',
    );
    expect(await pinnedLine(`${acg}/acg_classes.lst:40`)).toContain(
      'BONUS:VAR|BloodragerLVL|CL',
    );
    expect(await pinnedLine(`${acgc}:369`)).toContain(
      'PREVARGTEQ:BloodragerBloodlineFeatProgression,6|PREVAREQ:Bloodrager_CF_BloodlineFeat6,0',
    );
    expect(derive('Bloodrager').gatedParts.get('BloodlineFeat6')).toEqual({
      at: `${acgc}:369`,
      level: 6,
      polarity: 'kept',
    });
  });

  it('reads a part flag a bloodline binds into its own variable as a kept gate on the grant that variable gates', async () => {
    // ACG p.16: a bloodline power at 1st, 4th and every 4 levels after. Each
    // bloodline binds the flag into its own variable, which gates the power.
    const acgc = `${acg}/acg_abilities_class.lst`;
    expect(await pinnedLine(`${acgc}:566`)).toContain(
      'BONUS:VAR|Bloodrager_Aberrant_BloodlinePower4|if((Bloodrager_CF_BloodlinePower4==0&&Bloodrager_Aberrant_BloodlineProgressionLVL>=4),1,0)',
    );
    expect(await pinnedLine(`${acgc}:565`)).toContain(
      'ABILITY:Special Ability|AUTOMATIC|TYPE=Aberrant Bloodrager Bloodline ~ Power LVL 04|PREVARGTEQ:Bloodrager_Aberrant_BloodlinePower4,1',
    );
    const { gatedParts } = derive('Bloodrager');
    expect(gatedParts.get('BloodlinePower4')).toEqual({
      at: `${acgc}:565`,
      binding: `${acgc}:566`,
      level: null,
      polarity: 'kept',
    });
    expect(
      [1, 4, 8, 12, 16, 20].map((level) =>
        gatedParts.has(`BloodlinePower${level}`),
      ),
    ).toEqual([true, true, true, true, true, true]);
  });
});

describe('version isolation (#716 P7-0 §2.4)', () => {
  it('draws Unchained Barbarian acquisitions from its own record and definitions from the shared ones', async () => {
    const unchained = pcgenSchedule({
      tree,
      view,
      schedule: unchainedBarbarian,
    });
    // Pathfinder Unchained p.8: rage at 1st (pu_abilities_class.lst:132).
    expect(
      unchained.acquisitions.find(({ suffix }) => suffix === 'Rage'),
    ).toEqual({
      granted: 'Unchained Barbarian ~ Rage',
      suffix: 'Rage',
      level: 1,
      at: `${puc}:132`,
    });
    expect(
      unchained.acquisitions.filter(({ granted }) =>
        granted.startsWith('Barbarian ~'),
      ),
    ).toEqual([]);
    // The flag is defined once, for both versions
    // (cr_abilities_globalvar.lst:27, `DEFINE:Barbarian_CF_Rage|0`).
    expect(
      await pinnedLine(
        'roleplaying_game/core_rulebook/cr_abilities_globalvar.lst:27',
      ),
    ).toBe('CATEGORY=Class|Barbarian.MOD\tDEFINE:Barbarian_CF_Rage|0');
    expect(unchained.defined.has('Rage')).toBe(true);
    const standard = pcgenSchedule({ tree, view, schedule: standardBarbarian });
    expect(
      standard.acquisitions.find(({ suffix }) => suffix === 'Rage')?.granted,
    ).toBe('Barbarian ~ Rage');
    expect(
      standard.acquisitions.filter(({ granted }) =>
        granted.startsWith('Unchained'),
      ),
    ).toEqual([]);
  });

  it('keys an Unchained schedule’s later rows by its own slug and raises no shared gate', () => {
    // Pathfinder Unchained p.9: danger sense at 3rd, gated on the shared
    // Barbarian_CF_TrapSense (pu_abilities_class.lst:136); +2 at 6th.
    const dangerSense = feature({
      id: 'danger-sense',
      name: 'Danger Sense',
      externalKey: 'pf1/danger-sense',
      levels: [3, 6],
      whole: ['TrapSense'],
      incrementName: (index) => `Danger Sense +${index + 1}`,
      pcgen: {
        granted: 'Unchained Barbarian ~ Danger Sense',
        level: 3,
        at: `${puc}:136`,
      },
    });
    const rage = feature({
      id: 'rage',
      name: 'Rage',
      externalKey: 'pf1/rage',
      levels: [1],
      whole: ['Rage'],
      pcgen: {
        granted: 'Unchained Barbarian ~ Rage',
        level: 1,
        at: `${puc}:132`,
      },
    });
    const schedule = reviewed({
      ...unchainedBarbarian,
      className: 'Barbarian',
      features: [rage, dangerSense],
    });
    expect(rowKeyOf(schedule, dangerSense, 6)).toBe(
      'everythingpath/unchained-barbarian-danger-sense-6',
    );
    expect(
      scheduleRows(schedule).map(({ externalKey }) => externalKey),
    ).toEqual([
      'pf1/rage',
      'pf1/danger-sense',
      'everythingpath/unchained-barbarian-danger-sense-6',
    ]);
    const findings = compareSchedule({
      schedule,
      pcgen: pcgenSchedule({ tree, view, schedule }),
      foundry: [],
    });
    expect(findings.filter(({ kind }) => kind === 'sharedGate')).toEqual([]);
    // No standard grant reaches the Unchained schedule.
    expect(
      findings.filter(({ text }) => /(?<!Unchained )Barbarian ~/.test(text)),
    ).toEqual([]);
  });
});

describe('ungated and nested grants (#716 P7-0 §2.5)', () => {
  it('reads Summoner Aspect, granted with no removal gate, as an ungated grant', async () => {
    // APG p.58: aspect at 10th level; PCGen gates it only on the level.
    const at = `${apgc}:756`;
    expect(await pinnedLine(at)).toContain(
      'Summoner ~ Aspect|PREVARGTEQ:Summoner_CFP_Level,10|PREVARLT:Summoner_CFP_Level,18',
    );
    const versionRecords = {
      acquisitionRecords: ['Summoner ~ Standard Class'],
      metadataRecords: [
        'Summoner',
        'Summoner ~ Standard Class',
        'Summoner ~ Unchained Class',
      ],
    };
    const summoner = { ...unscheduled('Summoner'), ...versionRecords };
    const pcgen = pcgenSchedule({ tree, view, schedule: summoner });
    expect(pcgen.ungatedGrants).toContainEqual({
      granted: 'Summoner ~ Aspect',
      level: 10,
      at,
    });
    expect(pcgen.acquisitions.map(({ granted }) => granted)).not.toContain(
      'Summoner ~ Aspect',
    );
    const foundryFile = 'packs/classes/summoner.BrnHPJ2EVSQSyNQ8.yaml';
    const foundry = foundryAssociations(
      foundryFile,
      await readPinned('pf1', foundryFile),
    );
    // Foundry links the 10th-level aspect (summoner…yaml:80-81).
    expect(foundry).toContainEqual({
      level: 10,
      externalKey: 'pf1/r5dE8fMdwjLVCHma',
      at: `${foundryFile}:80`,
    });
    const aspect = feature({
      id: 'aspect',
      name: 'Aspect',
      externalKey: 'pf1/r5dE8fMdwjLVCHma',
      levels: [10],
      whole: ['Aspect'],
      pcgen: { granted: 'Summoner ~ Aspect', level: 10, at },
      foundry: { level: 10, at: `${foundryFile}:80` },
    });
    const findings = compareSchedule({
      schedule: reviewed({
        ...versionRecords,
        className: 'Summoner',
        features: [aspect],
      }),
      pcgen,
      foundry,
    }).filter(({ feature }) => feature === 'aspect');
    expect(findings.map(({ kind, settledBy }) => [kind, settledBy])).toEqual([
      ['ungatedGrant', null],
    ]);
    // Unscheduled, the grant is still a finding, never dropped.
    expect(
      compareSchedule({ schedule: summoner, pcgen, foundry: [] })
        .filter(({ kind }) => kind === 'ungatedGrant')
        .map(({ feature }) => feature),
    ).toContain('Summoner ~ Aspect');
  });

  it('reads the Bard performances inside Bardic Performance as nested grants', async () => {
    // CRB p.35: fascinate from 1st level, inspire competence from 3rd.
    const at = 'roleplaying_game/core_rulebook/cr_abilities_class.lst:505';
    expect(await pinnedLine(at)).toContain(
      'ABILITY:Special Ability|AUTOMATIC|Bardic Performance ~ Fascinate|PREVAREQ:Bard_CF_Fascinate,0|PREVARGTEQ:BardicPerformanceLVL,1',
    );
    const pcgen = derive('Bard');
    expect(pcgen.nestedGrants).toContainEqual({
      granted: 'Bardic Performance ~ Fascinate',
      suffix: 'Fascinate',
      owner: 'Bard ~ Bardic Performance',
      level: 1,
      at,
    });
    expect(
      pcgen.nestedGrants.find(({ suffix }) => suffix === 'InspireCompetence')
        ?.level,
    ).toBe(3);
    const findings = compareSchedule({
      schedule: unscheduled('Bard'),
      pcgen,
      foundry: [],
    });
    expect(
      findings
        .filter(({ kind }) => kind === 'nestedGrant')
        .map(({ feature }) => feature),
    ).toContain('Bardic Performance ~ Fascinate');
  });
});
