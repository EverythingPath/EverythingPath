// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { parseCuration } from '../../scripts/catalog/curation';
import { pcgenPin } from '../../scripts/catalog/inventory';
import type {
  PcgenPrestigeClass,
  PcgenTree,
} from '../../scripts/catalog/pcgen/lst';
import {
  applyStructureCuration,
  hashStructureSource,
} from '../../scripts/catalog/structure-curation';
import { parsePrerequisite } from '../../scripts/catalog/pcgen/pre';
import {
  translateRequirement,
  type PrestigeReferences,
} from '../../scripts/catalog/pcgen/requirements';
import { representativeClassCatalog } from '../../convex/lib/representativeClassCatalog';
import { join } from 'node:path';
import { readPcgenTree } from '../../scripts/catalog/pcgen/lst';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';
import evidence from '../fixtures/pcgen-716/prestige-evidence.json';
import {
  mapPinnedPrestige,
  pinnedFoundryReferences,
  prestigeEvidence,
  readPcgen716PrestigeTree,
  resolvingReferences,
} from './pcgen-716-prestige-tree';
import {
  pcgenCheckout,
  pcgenCheckoutIsAtPin,
  readPinned,
} from './pinned-sources';

// #716 P4 (plan §3, §9; research note 716-p4-rules.md): the prestige mapper
// on pinned PCGen 25523dbc class files. Feat and class feature references
// resolve against the pinned Foundry pf1 v11.11 records.
let tree: PcgenTree;
let references: PrestigeReferences;
beforeAll(async () => {
  tree = await readPcgen716PrestigeTree();
  references = await pinnedFoundryReferences();
}, 60_000);

const cr = 'roleplaying_game/core_rulebook/cr_classes.lst';
const apg = 'roleplaying_game/advanced_players_guide/apg_classes.lst';
const ag = 'roleplaying_game/adventurers_guide/ag_classes.lst';
const iswg = 'campaign_setting/inner_sea_world_guide/iswg_classes.lst';
const sos = 'campaign_setting/seekers_of_secrets/sos_classes.lst';
const isg = 'campaign_setting/inner_sea_gods/isg_classes.lst';
const feat = {
  dodge: 'pf1/JreaiTHdyWFNj3Tb',
  mobility: 'pf1/R7L4SlGRlnThqFrP',
  weaponFinesse: 'pf1/vWiTqHC4Y3Xn1Pme',
  pointBlankShot: 'pf1/8rsFtye3PwM6CKli',
  preciseShot: 'pf1/53urYIbYYpQuoSLd',
  weaponFocus: 'pf1/n250dFlbykAIAg5Z',
  magicalAptitude: 'pf1/CLSsMyNmdcNAOUKC',
};
const map = (file: string, line: number, externalKey: string) =>
  mapPinnedPrestige({ tree, file, line, externalKey, references });
const itemsOf = (mapping: ReturnType<typeof map>) =>
  mapping.items.map(({ kind, id, fields }) => [kind, id, fields ?? null]);
const advances = (levels: number[], kinds: string[]) =>
  levels.map((classLevel) => ({ classLevel, kinds }));
const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, index) => from + index);

const prestigeAt = (file: string, line: number): PcgenPrestigeClass => {
  const found = tree.prestigeClasses.find(
    ({ locator }) => locator.file === file && locator.line === line,
  );
  if (!found) throw new Error(`No prestige class at ${file}:${line}`);
  return found;
};

// The research note's P3 reader gap: `N:REPEATLEVEL:S` level lines failed the
// plain level-number test and were dropped, so five prestige classes lost
// all their casting advances.
describe('N:REPEATLEVEL level lines (#716 P4 reader fix)', () => {
  it('keeps Winter Witch’s 2:REPEATLEVEL:1 line (rowpg_classes.lst:16)', () => {
    const winterWitch = prestigeAt(
      'adventure_path/reign_of_winter/players_guide/rowpg_classes.lst',
      8,
    );
    expect(
      winterWitch.levelLines.map(({ line, level, repeatEvery, tokens }) => [
        line,
        level,
        repeatEvery,
        tokens.slice(1),
      ]),
    ).toEqual([
      [14, 1, null, ['ABILITY:Class|AUTOMATIC|Winter Witch']],
      [16, 2, 1, ['ADD:SPELLCASTER|Witch']],
    ]);
  });

  it('keeps Bloatmage’s and Exalted’s 1:REPEATLEVEL:1 lines', () => {
    const repeats = (file: string, line: number) =>
      prestigeAt(file, line)
        .levelLines.filter(({ repeatEvery }) => repeatEvery !== null)
        .map(({ line, level, repeatEvery, tokens }) => [
          line,
          level,
          repeatEvery,
          tokens.slice(1),
        ]);
    expect(
      repeats('campaign_setting/city_of_strangers/cos_classes.lst', 5),
    ).toEqual([[11, 1, 1, ['ADD:SPELLCASTER|Arcane']]]);
    expect(
      repeats('campaign_setting/inner_sea_gods/isg_classes.lst', 25),
    ).toEqual([[31, 1, 1, ['ADD:SPELLCASTER|Divine']]]);
  });
});

describe('the §3 fixtures', () => {
  // cr_classes.lst:398-405; CRB p. 382. All six clauses are typed: three of
  // three feats, two of two skills with TYPE.Perform as generic Perform, and
  // BAB +6. The seed's typed requirements match (prestige-and-unchained.md).
  it('maps Duelist (cr_classes.lst:400) to six typed clauses and its progression', () => {
    const duelist = map(cr, 398, 'everythingpath/duelist');
    const at = (line: number) => ({
      source: 'pcgen',
      locator: { file: cr, line, key: 'Duelist' },
    });
    expect(duelist.subject.entry).toEqual({
      externalKey: 'everythingpath/duelist',
      upstreamKey: `pcgen:${cr}#Duelist`,
      pack: 'roleplaying_game/core_rulebook',
      name: 'Duelist',
      detail: {
        kind: 'class',
        classKind: 'prestige',
        tag: 'duelist',
        hitDie: 10,
        bab: 'full',
        saves: { fort: 'poor', ref: 'good', will: 'poor' },
        classSkills: [
          'skill.acr',
          'skill.blf',
          'skill.esc',
          'skill.per',
          'skill.prf',
          'skill.sen',
        ],
        skillRanksPerLevel: 4,
        featuresByLevel: [],
      },
      description: '',
      prerequisiteText:
        'Dodge, Mobility, Weapon Finesse; Acrobatics 2 ranks, any Perform skill 2 ranks; base attack bonus +6',
      prerequisites: [
        { kind: 'feat', feat: feat.dodge },
        { kind: 'feat', feat: feat.mobility },
        { kind: 'feat', feat: feat.weaponFinesse },
        { kind: 'skillRanks', skillRanks: 'skill.acr', min: 2 },
        { kind: 'skillRanks', skillRanks: 'skill.prf', min: 2 },
        { kind: 'bab', bab: 6 },
      ],
      sources: [{ book: 'Core Rulebook', pages: '382' }],
      modifiers: [],
      unsupported: [],
      provenance: {
        name: at(398),
        sources: at(398),
        prerequisites: at(400),
        prerequisiteText: at(400),
        'detail.hitDie': at(398),
        'detail.skillRanksPerLevel': at(402),
        'detail.bab': at(398),
        'detail.saves': at(398),
        'detail.classSkills': at(402),
      },
    });
    expect(duelist.items).toEqual([]);
  });

  // cr_classes.lst:448-463; CRB p. 387 (SPC:346-350): Knowledge (arcana) and
  // (religion) 3 ranks, 2nd-level divine and arcane spells, and one arcane and
  // one divine advance at every level, as the representative seed has them.
  it('maps Mystic Theurge (cr_classes.lst:450) to two canCast clauses and ten double advances', () => {
    const theurge = map(cr, 448, 'everythingpath/mystic-theurge');
    const seed = representativeClassCatalog.find(
      ({ ruleIdentity }) => ruleIdentity === 'mystic-theurge',
    );
    expect(theurge.subject.entry.prerequisites).toEqual(seed?.prerequisites);
    expect(theurge.subject.entry.detail).toMatchObject({
      hitDie: 6,
      bab: 'half',
      saves: { fort: 'poor', ref: 'poor', will: 'good' },
      skillRanksPerLevel: 2,
      classSkills: seed?.detail.classSkills,
      castingAdvances:
        seed && 'castingAdvances' in seed.detail
          ? seed.detail.castingAdvances
          : null,
    });
    expect(theurge.items).toEqual([]);
  });

  // apg_classes.lst:424-438; PREMULT:2 is an all-of whose second branch is a
  // 1-of-2. Whether the casting requirement accepts extracts is open (S8), so
  // it stays unchecked; and its Extracts per Day advances alchemist extracts
  // (apg_abilities_class.lst:1362), which the model can't express, so it
  // gets no advance rows, only a hold.
  it('maps Master Chymist’s all-of (apg_classes.lst:426) and holds its casting requirement and advances', () => {
    const chymist = map(apg, 424, 'everythingpath/master-chymist');
    expect(chymist.subject.entry.prerequisites).toEqual([
      {
        kind: 'classFeature',
        classFeature: 'pf1/zrTVb83VhkFnEv6G',
        classFeatureName: 'Mutagen',
      },
      {
        anyOf: [
          {
            kind: 'classFeature',
            classFeature: 'pf1/4R0YV2SQZvZWsjoV',
            classFeatureName: 'Feral Mutagen',
          },
          {
            kind: 'classFeature',
            classFeature: 'pf1/7vDgnmTR2EA4kxqE',
            classFeatureName: 'Infuse Mutagen',
          },
        ],
      },
      {
        kind: 'unchecked',
        unchecked: 'able to cast 3rd-level arcane spells',
      },
    ]);
    expect(chymist.subject.entry.detail).not.toHaveProperty('castingAdvances');
    expect(itemsOf(chymist)).toEqual([
      ['uncheckedRequirement', 'PRESPELLTYPE:1,Arcane=3', ['prerequisites']],
      ['uncheckedCasting', 'alchemist', ['detail.castingAdvances']],
    ]);
  });

  // sos_classes.lst:22-33: Magical Aptitude, an item creation feat (a TYPE
  // selector, unchecked), three skills at 5 ranks and 2nd-level arcane or
  // divine spells; six advances to MAXLEVEL 7.
  it('maps Pathfinder Savant (sos_classes.lst:24) with an anyOf canCast and an unchecked selector', () => {
    const savant = map(sos, 22, 'everythingpath/pathfinder-savant');
    expect(savant.subject.entry.prerequisites).toEqual([
      { kind: 'feat', feat: feat.magicalAptitude },
      { kind: 'unchecked', unchecked: 'any ItemCreation feat' },
      { kind: 'skillRanks', skillRanks: 'skill.kar', min: 5 },
      { kind: 'skillRanks', skillRanks: 'skill.spl', min: 5 },
      { kind: 'skillRanks', skillRanks: 'skill.umd', min: 5 },
      {
        anyOf: [
          { kind: 'canCast', canCast: { spellLevel: 2, kind: 'arcane' } },
          { kind: 'canCast', canCast: { spellLevel: 2, kind: 'divine' } },
        ],
      },
    ]);
    expect(savant.subject.entry.detail).toMatchObject({
      castingAdvances: advances(range(2, 7), ['any']),
    });
    expect(itemsOf(savant)).toEqual([
      [
        'uncheckedRequirement',
        'PREABILITY:1,CATEGORY=FEAT,TYPE=ItemCreation',
        ['prerequisites'],
      ],
    ]);
  });

  // cr_classes.lst:345-361: PCGen's alignment bypass branch is an option,
  // not a rule; the rule branch alone is the requirement (plan §3).
  it('reduces Arcane Trickster’s PREMULT bypass (cr_classes.lst:347) to its alignment', () => {
    const trickster = map(cr, 345, 'everythingpath/arcane-trickster');
    expect(trickster.subject.entry.prerequisites).toEqual([
      { kind: 'alignment', alignment: ['NG', 'CG', 'N', 'CN', 'NE', 'CE'] },
      { kind: 'skillRanks', skillRanks: 'skill.dev', min: 4 },
      { kind: 'skillRanks', skillRanks: 'skill.esc', min: 4 },
      { kind: 'skillRanks', skillRanks: 'skill.kar', min: 4 },
      { kind: 'unchecked', unchecked: 'casts Mage Hand' },
      { kind: 'canCast', canCast: { spellLevel: 2, kind: 'arcane' } },
      {
        kind: 'unchecked',
        unchecked: 'PCGen variable SneakAttackDice at least 2',
      },
    ]);
    expect(trickster.subject.entry.detail).toMatchObject({
      castingAdvances: advances(range(1, 10), ['any']),
    });
  });

  // cr_classes.lst:326-340; SPC:338: Point-Blank Shot and Precise Shot,
  // Weapon Focus with a longbow or shortbow, 1st-level arcane spells and BAB
  // +6; no advance at levels 1, 5 and 9.
  it('maps Arcane Archer (cr_classes.lst:328) with a Weapon Focus choice anyOf', () => {
    const archer = map(cr, 326, 'everythingpath/arcane-archer');
    expect(archer.subject.entry.prerequisites).toEqual([
      { kind: 'feat', feat: feat.pointBlankShot },
      { kind: 'feat', feat: feat.preciseShot },
      {
        anyOf: [
          { kind: 'feat', feat: feat.weaponFocus, choice: 'Longbow' },
          { kind: 'feat', feat: feat.weaponFocus, choice: 'Shortbow' },
        ],
      },
      { kind: 'canCast', canCast: { spellLevel: 1, kind: 'arcane' } },
      { kind: 'bab', bab: 6 },
    ]);
    expect(archer.subject.entry.detail).toMatchObject({
      castingAdvances: advances([2, 3, 4, 6, 7, 8, 10], ['arcane']),
    });
    expect(archer.items).toEqual([]);
  });
});

// Plan §3: PRELEVEL translates when it is a minimum. No pinned prestige
// class has one, so the fixture is a feat: Leadership, "Character level 7th"
// (CRB p. 129), as cr_feats.lst:114 gives it. A maximum level, such as Child
// of Two Worlds' first-level-only PRELEVEL:MAX=1 (aqua_feats.lst:29), has no
// atom and stays unchecked.
describe('PRELEVEL', () => {
  const tokenAt = async (file: string, line: number) => {
    const text = (
      await readPinned('pcgen', `${pcgenPin.directory}/${file}`)
    ).split(/\r?\n/)[line - 1];
    const token = text
      ?.split('\t')
      .find((part) => part.startsWith('PRELEVEL:'));
    if (!token) throw new Error(`No PRELEVEL at ${file}:${line}`);
    return translateRequirement(parsePrerequisite(token), {
      references,
      openCastingRequirement: undefined,
    });
  };

  it('maps a minimum level (cr_feats.lst:114) to characterLevel', async () => {
    expect(
      await tokenAt('roleplaying_game/core_rulebook/cr_feats.lst', 114),
    ).toEqual({
      token: 'PRELEVEL:MIN=7',
      clauses: [
        {
          rule: 'PRELEVEL MIN → characterLevel',
          prerequisite: { kind: 'characterLevel', characterLevel: 7 },
        },
      ],
      findings: [],
    });
  });

  it('keeps a maximum level (aqua_feats.lst:29) unchecked', async () => {
    const translated = await tokenAt(
      'campaign_setting/aquatic_adventures/aqua_feats.lst',
      29,
    );
    expect(translated.clauses).toEqual([
      {
        rule: 'unchecked: PRELEVEL maximum',
        prerequisite: {
          kind: 'unchecked',
          unchecked: 'character level 1 or lower',
        },
      },
    ]);
  });
});

describe('named requirement exceptions (research note §1)', () => {
  // cr_classes.lst:409-423: CRB p. 384 requires proficiency with all martial
  // weapons; PCGen's internal tag is read as that proficiency.
  it('reads Eldritch Knight’s internal martial tag (cr_classes.lst:411) as martial proficiency', () => {
    const knight = map(cr, 409, 'everythingpath/eldritch-knight');
    expect(knight.subject.entry.prerequisites).toEqual([
      { kind: 'proficiency', proficiency: { category: 'martial' } },
      { kind: 'canCast', canCast: { spellLevel: 3, kind: 'arcane' } },
    ]);
    expect(knight.subject.entry.detail).toMatchObject({
      castingAdvances: advances(range(2, 10), ['arcane']),
    });
    expect(itemsOf(knight)).toEqual([
      [
        'conflict',
        'exception:proficiency:Weapon Prof ~ Martial',
        ['prerequisites'],
      ],
    ]);
  });

  // iswg_classes.lst:23-28: alignment as a prerequisite (not
  // detail.alignments), heavy armor proficiency, two skills, BAB +5 and the
  // devil-slaying PRETEXT unchecked.
  it('maps Hellknight (iswg_classes.lst:25) with heavy armor proficiency and an unchecked PRETEXT', () => {
    const hellknight = map(iswg, 23, 'everythingpath/hellknight');
    expect(hellknight.subject.entry.prerequisites).toEqual([
      { kind: 'proficiency', proficiency: { category: 'heavy' } },
      { kind: 'alignment', alignment: ['LG', 'LN', 'LE'] },
      { kind: 'skillRanks', skillRanks: 'skill.int', min: 5 },
      { kind: 'skillRanks', skillRanks: 'skill.kpl', min: 2 },
      {
        kind: 'unchecked',
        unchecked:
          'Must slay a devil with HD greater than your own. This must be witnessed by a Hellknight',
      },
      { kind: 'bab', bab: 5 },
    ]);
    expect(hellknight.subject.entry.detail).not.toHaveProperty('alignments');
    // #716 P10a, owner decision 3: a NAMEISPI record is held.
    expect(hellknight.subject.entry.unsupported).toEqual([
      {
        field: 'attribution',
        reason:
          'Product Identity: NAMEISPI (campaign_setting/inner_sea_world_guide/iswg_classes.lst:23)',
      },
    ]);
    expect(itemsOf(hellknight)).toEqual([
      [
        'conflict',
        'exception:proficiency:Armor Proficiency (Heavy)',
        ['prerequisites'],
      ],
      [
        'uncheckedRequirement',
        'PRETEXT:Must slay a devil with HD greater than your own. This must be witnessed by a Hellknight',
        ['prerequisites'],
      ],
      ['productIdentity', 'NAMEISPI', null],
    ]);
  });

  // iswg_classes.lst:57-88: Alertness and Two-Weapon Fighting don't resolve
  // against the fixture's Foundry records, so the whole 4-of-4 tag stays
  // unchecked; the class's own casting (SPELLSTAT, CAST, KNOWN) is held.
  it('keeps a tag with an unresolved feat unchecked and holds Red Mantis Assassin’s own casting (iswg_classes.lst:57)', () => {
    const mantis = map(iswg, 57, 'everythingpath/red-mantis-assassin');
    expect(mantis.subject.entry.prerequisites?.slice(0, 4)).toEqual([
      {
        kind: 'unchecked',
        unchecked:
          'Alertness, Exotic Weapon Proficiency (Sawtooth Sabre), Two-Weapon Fighting, Weapon Focus (Sawtooth Sabre)',
      },
      { kind: 'alignment', alignment: ['LE'] },
      { kind: 'skillRanks', skillRanks: 'skill.int', min: 5 },
      { kind: 'skillRanks', skillRanks: 'skill.per', min: 5 },
    ]);
    expect(itemsOf(mantis).map(([kind, id]) => [kind, id])).toEqual([
      [
        'uncheckedRequirement',
        'PREABILITY:4,CATEGORY=FEAT,Alertness,Exotic Weapon Proficiency (Sawtooth Sabre),Two-Weapon Fighting,Weapon Focus (Sawtooth Sabre)',
      ],
      ['uncheckedCasting', 'ownCasting'],
      ['productIdentity', 'NAMEISPI'],
    ]);
  });

  // psand_classes.lst:35-50: Brew Potion, four skills with two named
  // specialties typed and unresolved, and the casting requirement unchecked
  // while its reading of extracts is open (S8).
  it('maps Thuvian Alchemist (psand_classes.lst:37) with typed specialties and an unchecked casting requirement', () => {
    const thuvian = map(
      'player_companion/people_of_the_sands/psand_classes.lst',
      35,
      'everythingpath/thuvian-alchemist',
    );
    expect(thuvian.subject.entry.prerequisites?.slice(1)).toEqual([
      { kind: 'skillRanks', skillRanks: 'skill.crf.alchemy', min: 5 },
      { kind: 'skillRanks', skillRanks: 'skill.kna', min: 5 },
      { kind: 'skillRanks', skillRanks: 'skill.pro.herbalist', min: 5 },
      { kind: 'skillRanks', skillRanks: 'skill.spl', min: 5 },
      {
        kind: 'unchecked',
        unchecked: 'able to cast 2nd-level arcane spells',
      },
    ]);
    expect(itemsOf(thuvian).map(([kind, id]) => [kind, id])).toEqual([
      ['uncheckedRequirement', 'PREABILITY:1,CATEGORY=FEAT,Brew Potion'],
      ['uncheckedRequirement', 'PRESPELLTYPE:1,Arcane=2'],
      ['productIdentity', 'NAMEISPI'],
    ]);
  });

  // isg_classes.lst:25-31: PREALIGN:DEITY isn't an alignment and stays
  // unchecked; the 1:REPEATLEVEL:1 line gives a divine advance at 1–10.
  it('keeps Exalted’s PREALIGN:DEITY (isg_classes.lst:27) unchecked and expands its repeating advance', () => {
    const exalted = map(isg, 25, 'everythingpath/exalted');
    expect(
      exalted.requirements.map(({ token, clauses }) => [
        token,
        clauses.map(({ rule }) => rule),
      ]),
    ).toEqual([
      [
        'PREABILITY:2,CATEGORY=FEAT,deific obedience,skill focus (knowledge (religion))',
        ['unchecked: PREABILITY unresolved reference'],
      ],
      ['PREALIGN:DEITY', ['unchecked: PREALIGN DEITY']],
      ['PREDEITY:1,Y', ['unchecked: PREDEITY any deity or pantheon']],
      [
        'PRESKILL:2,Diplomacy=5,Knowledge (Religion)=5',
        ['PRESKILL all → skillRanks', 'PRESKILL all → skillRanks'],
      ],
      ['PRESPELLTYPE:1,Divine=3', ['PRESPELLTYPE all → canCast']],
      [exalted.requirements[5]?.token, ['unchecked: PRETEXT']],
    ]);
    expect(exalted.subject.entry.detail).toMatchObject({
      castingAdvances: advances(range(1, 10), ['divine']),
    });
  });
});

describe('§3’s unchecked cases', () => {
  it('keeps Brightness Seeker’s compound branch (eog_classes.lst:6) unchecked', () => {
    const seeker = map(
      'player_companion/elves_of_golarion/eog_classes.lst',
      4,
      'everythingpath/brightness-seeker',
    );
    expect(
      seeker.requirements.find(({ token }) => token.startsWith('PREMULT'))
        ?.clauses,
    ).toEqual([
      {
        rule: 'unchecked: PREMULT 1-of-2 or compound branch',
        prerequisite: {
          kind: 'unchecked',
          unchecked:
            '(Knowledge (Nature) 4 ranks, Knowledge (Religion) 8 ranks) or (Knowledge (Nature) 8 ranks, Knowledge (Religion) 4 ranks)',
        },
      },
    ]);
  });

  // teog_classes.lst:7: four of three skills is a PCGen data error, reported.
  it('reports Lion Blade’s PRESKILL:4 of three skills (teog_classes.lst:7) as a data error', () => {
    const lionBlade = map(
      'player_companion/taldor_echoes_of_glory/teog_classes.lst',
      5,
      'everythingpath/lion-blade',
    );
    expect(
      itemsOf(lionBlade).filter(([, id]) => String(id).includes('PRESKILL:4')),
    ).toEqual([
      [
        'uncheckedRequirement',
        'PRESKILL:4,Bluff=6,Disguise=8,Stealth=8',
        ['prerequisites'],
      ],
      [
        'conflict',
        'dataError:PRESKILL:4,Bluff=6,Disguise=8,Stealth=8',
        ['prerequisites'],
      ],
    ]);
  });

  it('keeps Westcrown Devil’s 3-of-10 skills (ag_classes.lst:476) unchecked and holds its Occult Studies advances', () => {
    const devil = map(ag, 474, 'everythingpath/westcrown-devil');
    expect(
      devil.requirements
        .flatMap(({ clauses }) => clauses)
        .filter(({ rule }) => rule === 'unchecked: PRESKILL 3-of-10'),
    ).toHaveLength(1);
    expect(
      itemsOf(devil).filter(([kind]) => kind === 'uncheckedCasting'),
    ).toEqual([['uncheckedCasting', 'feature', ['detail.castingAdvances']]]);
  });
});

describe('castingAdvances (#415)', () => {
  // rowpg_classes.lst:16: the advance names the witch class, which the model
  // can't target; Winter Witch is the only prestige class with a class-named
  // ADD:SPELLCASTER (research note §2).
  it('holds Winter Witch’s witch advance (rowpg_classes.lst:16) for review instead of guessing', () => {
    const winterWitch = map(
      'adventure_path/reign_of_winter/players_guide/rowpg_classes.lst',
      8,
      'everythingpath/winter-witch',
    );
    expect(winterWitch.subject.entry.detail).not.toHaveProperty(
      'castingAdvances',
    );
    expect(
      itemsOf(winterWitch).filter(([kind]) => kind === 'uncheckedCasting'),
    ).toEqual([
      [
        'uncheckedCasting',
        '2:REPEATLEVEL:1:ADD:SPELLCASTER|Witch',
        ['detail.castingAdvances'],
      ],
    ]);
  });

  it('expands Bloatmage’s 1:REPEATLEVEL:1 (cos_classes.lst:11) through MAXLEVEL 10', () => {
    const bloatmage = map(
      'campaign_setting/city_of_strangers/cos_classes.lst',
      5,
      'everythingpath/bloatmage',
    );
    expect(bloatmage.subject.entry.detail).toMatchObject({
      castingAdvances: advances(range(1, 10), ['arcane']),
    });
  });

  // tg_classes.lst:4-10: no MAXLEVEL, so the repeating line runs to the
  // highest level line (10), held as a conflict.
  it('holds Technomancer’s repeating advance without MAXLEVEL (tg_classes.lst:10)', () => {
    const technomancer = map(
      'campaign_setting/technology_guide/tg_classes.lst',
      4,
      'everythingpath/technomancer',
    );
    expect(technomancer.subject.entry.detail).toMatchObject({
      castingAdvances: advances(range(2, 10), ['arcane']),
    });
    expect(
      itemsOf(technomancer).filter(([kind]) => kind === 'conflict'),
    ).toEqual([['conflict', 'MAXLEVEL', ['detail.castingAdvances']]]);
  });

  it('holds Evangelist’s Aligned Class (isg_classes.lst:6) as an unchecked casting', () => {
    const evangelist = map(isg, 6, 'everythingpath/evangelist');
    expect(evangelist.subject.entry.detail).not.toHaveProperty(
      'castingAdvances',
    );
    expect(
      itemsOf(evangelist).filter(([kind]) => kind === 'uncheckedCasting'),
    ).toEqual([['uncheckedCasting', 'feature', ['detail.castingAdvances']]]);
  });
});

// Plan §6 and the P2 contract: a prestige class passes the structure gate
// only when checked records settle each of its review items, an
// `uncheckedRequirement` per unchecked clause included.
describe('the structure gate on a mapped prestige class', () => {
  // A checked record names its review receipt (#757); these cases don't check
  // receipts, so they cite #716 P6's rules review.
  const reviewer = {
    reviewedBy: 'reviewer',
    reviewedOn: '2026-10-17',
    receipt: 'reviewer-20261018-081620-1216172',
  };
  const gate = (structures: unknown[]) => {
    const hellknight = map(iswg, 23, 'everythingpath/hellknight');
    return {
      hellknight,
      report: applyStructureCuration({
        subjects: [hellknight.subject],
        items: hellknight.items,
        ownedFeatures: [],
        data: parseCuration({ records: [], structures }),
        variantDecisions: [],
      }),
    };
  };

  // iswg_classes.lst:23-37: the three CLASS:Hellknight lines and the nine
  // level lines, by raw text; ISWG's _pfs .MOD is conditional and not applied.
  it('hashes the class block’s raw lines by upstream key', async () => {
    const { hellknight } = gate([]);
    const lines = (
      await readPinned('pcgen', `${pcgenPin.directory}/${iswg}`)
    ).split(/\r?\n/);
    const parts = [23, 25, 27, 29, 30, 31, 32, 33, 34, 35, 36, 37].map(
      (line) => ({
        source: {
          source: 'pcgen' as const,
          locator: { file: iswg, line, key: 'Hellknight' },
        },
        text: lines[line - 1] ?? '',
      }),
    );
    const [first, ...rest] = parts;
    if (!first) throw new Error('No Hellknight lines');
    expect(hellknight.subject.sourceSha256).toBe(
      hashStructureSource([first, ...rest]),
    );
  });

  it('holds Hellknight until a checked record settles every item', () => {
    const { hellknight, report } = gate([]);
    expect(report.held).toEqual(['everythingpath/hellknight']);
    expect(report.handReview.map(({ kind }) => kind)).toEqual([
      'conflict',
      'uncheckedRequirement',
      'productIdentity',
    ]);
    const ref = {
      externalKey: 'everythingpath/hellknight',
      sourceSha256: hellknight.subject.sourceSha256,
    };
    const prerequisites = hellknight.subject.entry.prerequisites;
    const [proficiency, unchecked, pi] = hellknight.items;
    const record = (resolves: typeof hellknight.items) => ({
      ...ref,
      fields: { prerequisites },
      resolves: resolves.map(({ kind, id }) => ({ kind, id })),
      status: 'checked',
      rationale:
        'Reviewed against iswg_classes.lst:25: heavy armor proficiency and the witnessed devil-slaying stay as mapped.',
      ...reviewer,
    });
    if (!proficiency || !unchecked || !pi) throw new Error('Missing items');
    expect(gate([record([proficiency, pi])]).report.handReview).toEqual([
      unchecked,
    ]);
    expect(gate([record([proficiency, unchecked, pi])]).report).toMatchObject({
      passed: true,
      held: [],
    });
  });
});

/**
 * `prestige-evidence.json` records the mapper's totals over the whole pinned
 * tree, with every reference resolving (Appendix E's "if crosswalked"
 * reading). Against Appendix E:
 * - 97 unchecked clauses, not 95: Eldritch Knight's internal tag is now
 *   typed and nested feat choices such as Heritor Knight's Skill Focus
 *   (Knowledge (religion)) are typed choices, while PREALIGN:DEITY (Exalted,
 *   Divine Scion), PREDEITY:1,PANTHEON and the casting requirements of Master
 *   Chymist and Thuvian Alchemist (open S8) stay unchecked;
 * - 48 of the 89 names keep one;
 * - of the level lines' ADD:SPELLCASTER tokens, ANY 235, Arcane 82 and Divine
 *   47 match plan §2, and only Winter Witch names a class: the plan's other
 *   seven class-named lines are monster race classes (research note §2).
 */
describe('the prestige evidence', () => {
  it('is for the pinned PCGen data and records the corrected totals', () => {
    expect(evidence.pcgen).toEqual({
      commit: pcgenPin.commit,
      directory: pcgenPin.directory,
    });
    expect({
      records: evidence.prestigeRecords,
      mapped: evidence.mapped,
      uncheckedClauses: evidence.uncheckedClauses,
      classesWithUnchecked: evidence.classesWithUnchecked,
      advanceLevelTokens: evidence.advanceLevelTokens,
      items: evidence.items,
    }).toEqual({
      records: 99,
      mapped: 99,
      uncheckedClauses: 97,
      classesWithUnchecked: { records: 54, names: 48, of: 89 },
      advanceLevelTokens: {
        ANY: 235,
        Arcane: 82,
        Divine: 47,
        'class-named or counted': 1,
      },
      items: {
        conflict: 19,
        option: 1,
        productIdentity: 24,
        uncheckedCasting: 10,
        uncheckedRequirement: 97,
      },
    });
    expect(
      evidence.reviewItems
        .filter(({ kind }) => kind === 'uncheckedCasting')
        .map(({ key, id }) => [key, id]),
    ).toEqual([
      ['Winter Witch', '2:REPEATLEVEL:1:ADD:SPELLCASTER|Witch'],
      ['Evangelist', 'feature'],
      ['Red Mantis Assassin', 'ownCasting'],
      ['Genie Binder', 'feature'],
      ['Pathfinder Field Agent', 'feature'],
      ['Living Monolith', 'feature'],
      ['Master Chymist', 'alchemist'],
      ['Aspis Agent', 'feature'],
      ['Red Mantis Assassin', 'ownCasting'],
      ['Westcrown Devil', 'feature'],
    ]);
  });

  it('matches the review items the mapper finds in the pinned inputs', () => {
    const pinned = prestigeEvidence(tree);
    const owners = new Set(
      tree.prestigeClasses.map(
        ({ locator }) => `${locator.file}:${locator.line}`,
      ),
    );
    expect(pinned.reviewItems).toEqual(
      evidence.reviewItems.filter(({ owner }) => owners.has(owner)),
    );
    expect(pinned.reviewItems.length).toBeGreaterThan(10);
    // Every mapped entry is a valid release body.
    for (const record of tree.prestigeClasses)
      importedCatalogEntrySchema.parse(
        map(record.locator.file, record.locator.line, 'everythingpath/evidence')
          .subject.entry,
      );
    expect(resolvingReferences.feat('Dodge')).toBe('feat:dodge');
  });
});

describe.skipIf(!pcgenCheckoutIsAtPin())(
  'optional audit: the prestige evidence against the full local PCGen checkout (skips without it)',
  () => {
    it('regenerates the committed evidence', async () => {
      const full = await readPcgenTree(join(pcgenCheckout, pcgenPin.directory));
      expect(prestigeEvidence(full)).toEqual(evidence);
    }, 120_000);
  },
);
