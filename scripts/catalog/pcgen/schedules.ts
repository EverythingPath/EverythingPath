import type { PreviewEntry } from '../map';
import { toPcgenKey } from './keys';
import type { PcgenEffectiveRecord, PcgenEffectiveView } from './effective';
import { recordsByKey, type PcgenTree } from './lst';
import {
  isPrerequisiteToken,
  parsePrerequisite,
  type PcgenPrerequisite,
} from './pre';
import { sourcedTokens, type PcgenSourcedToken } from './tokens';
import {
  at,
  byLevel,
  byOrder,
  classSkills,
  evens,
  feature,
  grantIn,
  option,
  ordinal,
  proficiency,
  type At,
  type ClassSchedule,
  type ReviewedSchedule,
  type ScheduleBasis,
  type ScheduleClassName,
  type ScheduledFeature,
  type ScheduleNonRow,
  type UnscheduledClass,
} from './schedule-model';
import { alchemyTalentSchedules } from './schedules-alchemy-talents';
import { channelBloodlineSchedules } from './schedules-channel-bloodline';
import { companionSchedules } from './schedules-companions';
import { judgmentArcanaSchedules } from './schedules-judgment-arcana';
import { martialSchedules } from './schedules-martial';
import { mysteryHexSchedules } from './schedules-mystery-hex';
import { ragePerformanceSchedules } from './schedules-rage-performance';
import { smiteChallengeSchedules } from './schedules-smite-challenge';

export type {
  ClassSchedule,
  ReviewedSchedule,
  ScheduleBasis,
  ScheduledFeature,
  ScheduleNonRow,
  UnscheduledClass,
} from './schedule-model';

/**
 * #716 P5: the reviewed schedules of the first slice, Fighter, Rogue, Ranger
 * and Wizard (the model: `schedule-model.ts`). Bonus feats, talents, sneak
 * attack and combat style feats are numbered by class level; weapon training,
 * armor training, trap sense and favored enemy by order (`FavoredEnemy2` is
 * level 5). Bravery and favored terrain are formula-held.
 */
const crac = 'roleplaying_game/core_rulebook/cr_abilities_class.lst';
const crb = 'Pathfinder RPG Core Rulebook';
const pcgen = grantIn(crac);

const fighterFile = 'packs/classes/fighter.WLqBCT5DqmGAx8Wd.yaml';
const fighterBonusFeats = [1, ...evens];
const fighter: ReviewedSchedule = {
  kind: 'reviewed',
  className: 'Fighter',
  classKey: 'pf1/WLqBCT5DqmGAx8Wd',
  source: { book: crb, pages: '55–57' },
  foundryFile: fighterFile,
  acquisitionRecords: ['Fighter'],
  metadataRecords: ['Fighter'],
  flagNamespace: 'Fighter',
  slug: 'fighter',
  classSkillsRecord: 'Class Skills ~ Fighter',
  skillRanksPerLevel: 2,
  skillRanksAt: at(fighterFile, 57),
  features: [
    feature({
      id: 'bonus-feats',
      name: 'Bonus Feats',
      externalKey: 'pf1/CV8BsY3ciUb9TA1Y',
      levels: fighterBonusFeats,
      incrementName: () => 'Bonus Feat',
      parts: byLevel('BonusFeat', fighterBonusFeats),
      increments: 'numbered',
      pcgen: pcgen('Fighter ~ Bonus Feats', 1, 257),
      foundry: { level: 1, at: at(fighterFile, 42) },
      acquisitionFormula: at(
        'packs/class-abilities/bonus-feats-fgt.CV8BsY3ciUb9TA1Y.yaml',
        13,
      ),
    }),
    feature({
      id: 'bravery',
      name: 'Bravery',
      externalKey: 'pf1/h0Brxw6khcjlEf1T',
      levels: [2, 6, 10, 14, 18],
      incrementName: (index) => `Bravery +${index + 1}`,
      pcgen: pcgen('Fighter ~ Bravery', 2, 258),
      foundry: { level: 2, at: at(fighterFile, 44) },
      decision:
        'PCGen holds the later bonuses only in BONUS:VAR|Bravery|(BraveryLVL+2)/4 (cr_abilities_class.lst:888) and defines no Fighter_CF_Bravery<n> (cr_abilities_globalvar.lst:409-434); Foundry has +[[floor((@class.level + 2) / 4)]] (bravery.h0Brxw6khcjlEf1T.yaml:14). The table gives +1 to +5 at 2, 6, 10, 14 and 18.',
    }),
    feature({
      id: 'armor-training',
      name: 'Armor Training',
      externalKey: 'pf1/5JFfSqLMCpbRmERa',
      levels: [3, 7, 11, 15],
      incrementName: (index) => `Armor Training ${index + 1}`,
      parts: byOrder('ArmorTraining', [3, 7, 11, 15]),
      increments: 'numbered',
      pcgen: pcgen('Fighter ~ Armor Training', 3, 259),
      foundry: { level: 3, at: at(fighterFile, 46) },
      acquisitionFormula: at(
        'packs/class-abilities/armor-training.5JFfSqLMCpbRmERa.yaml',
        16,
      ),
    }),
    feature({
      id: 'weapon-training',
      name: 'Weapon Training',
      externalKey: 'pf1/RzEzudurxQFirFoF',
      levels: [5, 9, 13, 17],
      incrementName: (index) => `Weapon Training ${index + 1}`,
      parts: byOrder('WeaponTraining', [5, 9, 13, 17]),
      increments: 'numbered',
      pcgen: pcgen('Fighter ~ Weapon Training', 5, 260),
      foundry: { level: 5, at: at(fighterFile, 48) },
    }),
    feature({
      id: 'armor-mastery',
      name: 'Armor Mastery',
      externalKey: 'pf1/NwTe1Q2utlsmOAqK',
      levels: [19],
      pcgen: pcgen('Fighter ~ Armor Mastery', 19, 261),
      foundry: null,
      decision:
        'Foundry has the feature (armor-mastery.NwTe1Q2utlsmOAqK.yaml) but links it to no class; PCGen grants it at 19 (cr_abilities_class.lst:261), as the table does.',
    }),
    feature({
      id: 'weapon-mastery',
      name: 'Weapon Mastery',
      externalKey: 'pf1/McXAM1BoPHZLO1n4',
      levels: [20],
      pcgen: pcgen('pool:Weapon Mastery', 20, 262),
      foundry: { level: 20, at: at(fighterFile, 52) },
    }),
  ],
  nonRows: {
    ClassSkills: classSkills,
    ArmorProficiencies: proficiency,
    Proficiencies: proficiency,
    LightArmorProficiency: proficiency,
    MediumArmorProficiency: proficiency,
    HeavyArmorProficiency: proficiency,
    ShieldProficiency: proficiency,
    TowerShieldProficiency: proficiency,
  },
  grantNonRows: {},
  typeAliases: {},
  foundryNonRows: [
    {
      externalKey: 'pf1/iqeyCQIIVnNt0p3h',
      level: 7,
      text: 'Armor Training (Heavy Armor) is a choice within armor training in PCGen (Armor Training ~ Heavy Armor, cr_abilities_class.lst:895, among the armor training choices of :890), not a table row: the table gives armor training 2 at 7.',
    },
  ],
  defects: [],
};

const rogueFile = 'packs/classes/rogue.24b0LaabeAlUx5gN.yaml';
const sneakAttack = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
const trapSense = [3, 6, 9, 12, 15, 18];
const rogue: ReviewedSchedule = {
  kind: 'reviewed',
  className: 'Rogue',
  classKey: 'pf1/24b0LaabeAlUx5gN',
  source: { book: crb, pages: '67–70' },
  foundryFile: rogueFile,
  acquisitionRecords: ['Rogue ~ Standard Class'],
  metadataRecords: [
    'Rogue',
    'Rogue ~ Standard Class',
    'Rogue ~ Unchained Class',
  ],
  flagNamespace: 'Rogue',
  slug: 'rogue',
  classSkillsRecord: 'Class Skills ~ Rogue',
  skillRanksPerLevel: 8,
  skillRanksAt: at(rogueFile, 92),
  features: [
    feature({
      id: 'sneak-attack',
      name: 'Sneak Attack',
      externalKey: 'pf1/6pjr8jMFSKqXkBKk',
      levels: sneakAttack,
      incrementName: (index) => `Sneak Attack +${index + 1}d6`,
      parts: byLevel('SneakAttack', sneakAttack),
      pcgen: pcgen('Rogue ~ Sneak Attack', 1, 197),
      foundry: { level: 1, at: at(rogueFile, 73) },
      acquisitionFormula: at(
        'packs/class-abilities/sneak-attack.6pjr8jMFSKqXkBKk.yaml',
        16,
      ),
      decision:
        'PCGen holds the dice in a formula (BONUS:VAR|RogueSneakAttackLVL|RogueLVL, cr_abilities_class.lst:1615); its Rogue_CF_SneakAttack1–19 (cr_abilities_globalvar.lst:892-901) are named by class level but gate nothing. The table gives +1d6 at 1 and every odd level after.',
    }),
    feature({
      id: 'trapfinding',
      name: 'Trapfinding',
      externalKey: 'pf1/pEODJDoTk7uhCZY7',
      levels: [1],
      pcgen: pcgen('Rogue ~ Trapfinding', 1, 198),
      foundry: { level: 1, at: at(rogueFile, 71) },
    }),
    feature({
      id: 'evasion',
      name: 'Evasion',
      externalKey: 'pf1/KQYCRLEdD4bGA5ak',
      levels: [2],
      pcgen: pcgen('Rogue ~ Evasion', 2, 199),
      foundry: { level: 2, at: at(rogueFile, 77) },
    }),
    feature({
      id: 'rogue-talents',
      name: 'Rogue Talents',
      externalKey: 'pf1/iBTrvPtn3jczInbn',
      levels: evens,
      incrementName: () => 'Rogue Talent',
      parts: byLevel('RogueTalent', evens),
      increments: 'numbered',
      pcgen: pcgen('Rogue ~ Rogue Talents', 2, 200),
      foundry: { level: 2, at: at(rogueFile, 75) },
    }),
    feature({
      id: 'trap-sense',
      name: 'Trap Sense',
      externalKey: 'pf1/BoEkMviJrW0PKmhj',
      levels: trapSense,
      incrementName: (index) => `Trap Sense +${index + 1}`,
      parts: byOrder('TrapSense', trapSense),
      pcgen: pcgen('Rogue ~ Trap Sense', 3, 201),
      foundry: { level: 3, at: at(rogueFile, 79) },
      decision:
        'PCGen holds the bonus in a formula (RogueTrapSenseLVL/3, cr_abilities_class.lst:1618); its Rogue_CF_TrapSense1–6 (cr_abilities_globalvar.lst:875-880) are numbered by order but gate nothing. The table gives +1 to +6 at 3, 6, 9, 12, 15 and 18.',
    }),
    feature({
      id: 'uncanny-dodge',
      name: 'Uncanny Dodge',
      externalKey: 'pf1/7WaQxnVaaoL4AGr8',
      levels: [4],
      pcgen: pcgen('Rogue ~ Uncanny Dodge Tracker', 4, 202),
      foundry: { level: 4, at: at(rogueFile, 81) },
    }),
    feature({
      id: 'improved-uncanny-dodge',
      name: 'Improved Uncanny Dodge',
      externalKey: 'pf1/ZfnHhhTFQVo0Lj4P',
      levels: [8],
      pcgen: null,
      foundry: { level: 8, at: at(rogueFile, 83) },
      decision:
        'PCGen grants no row: the Uncanny Dodge Tracker counts it at 8 (BONUS:VAR|UncannyDodgeLVL|1|PREVARGTEQ:RogueLVL,8|PREVAREQ:Rogue_CF_ImprovedUncannyDodge,0, cr_abilities_class.lst:1638). Foundry links it at 8, as the table does.',
    }),
    feature({
      id: 'advanced-talents',
      name: 'Advanced Talents',
      externalKey: 'pf1/EQ7JGo4P1XirLO46',
      levels: [10],
      pcgen: null,
      foundry: { level: 10, at: at(rogueFile, 85) },
      decision:
        'PCGen defines Rogue_CF_AdvancedTalents (cr_abilities_globalvar.lst:881) but gates no grant on it. Foundry links it at 10, as the table does.',
    }),
    feature({
      id: 'master-strike',
      name: 'Master Strike',
      externalKey: 'pf1/KmVwFz2ajNtvgvbp',
      levels: [20],
      pcgen: pcgen('Rogue ~ Master Strike', 20, 203),
      foundry: { level: 20, at: at(rogueFile, 87) },
    }),
  ],
  nonRows: {
    ClassSkills: classSkills,
    WeaponProficiencies: proficiency,
    ArmorProficiencies: proficiency,
  },
  grantNonRows: {},
  typeAliases: {},
  foundryNonRows: [],
  defects: [],
};

const rangerFile = 'packs/classes/ranger.w3wjj6s3N69BsMc3.yaml';
const favoredEnemy = [1, 5, 10, 15, 20];
const combatStyle = [2, 6, 10, 14, 18];
const ranger: ReviewedSchedule = {
  kind: 'reviewed',
  className: 'Ranger',
  classKey: 'pf1/w3wjj6s3N69BsMc3',
  source: { book: crb, pages: '64–67' },
  foundryFile: rangerFile,
  acquisitionRecords: ['Ranger'],
  metadataRecords: ['Ranger'],
  flagNamespace: 'Ranger',
  slug: 'ranger',
  classSkillsRecord: 'Class Skills ~ Ranger',
  skillRanksPerLevel: 6,
  skillRanksAt: at(rangerFile, 102),
  features: [
    feature({
      id: 'favored-enemy',
      name: 'Favored Enemy',
      externalKey: 'pf1/XmALhWqXdN9yOmtd',
      levels: favoredEnemy,
      incrementName: (index) => `${ordinal(index + 1)} Favored Enemy`,
      parts: byOrder('FavoredEnemy', favoredEnemy),
      increments: 'numbered',
      pcgen: pcgen('Ranger ~ Favored Enemy', 1, 288),
      foundry: { level: 1, at: at(rangerFile, 63) },
    }),
    feature({
      id: 'track',
      name: 'Track',
      externalKey: 'pf1/r8wPs0bB3WhOLxbX',
      levels: [1],
      pcgen: pcgen('Ranger ~ Track', 1, 290),
      foundry: { level: 1, at: at(rangerFile, 65) },
    }),
    feature({
      id: 'wild-empathy',
      name: 'Wild Empathy',
      externalKey: 'pf1/Yr8dfM2d8JEWoYkr',
      levels: [1],
      pcgen: pcgen('Ranger ~ Wild Empathy', 1, 291),
      foundry: { level: 1, at: at(rangerFile, 67) },
    }),
    feature({
      id: 'combat-style-feat',
      name: 'Combat Style Feat',
      externalKey: 'pf1/BO7BEFHDcf6qBaYV',
      levels: combatStyle,
      incrementName: () => 'Combat Style Feat',
      parts: byLevel('CombatStyleFeat', combatStyle),
      increments: 'numbered',
      pcgen: pcgen('Ranger ~ Combat Style Feat', 2, 292),
      foundry: { level: 2, at: at(rangerFile, 69) },
      acquisitionFormula: at(
        'packs/class-abilities/combat-style-feat.BO7BEFHDcf6qBaYV.yaml',
        14,
      ),
    }),
    feature({
      id: 'endurance',
      name: 'Endurance',
      externalKey: 'pf1/E0skJEqlJOvB5CoA',
      levels: [3],
      pcgen: pcgen('Endurance', 3, 303),
      foundry: { level: 3, at: at(rangerFile, 73) },
    }),
    feature({
      id: 'favored-terrain',
      name: 'Favored Terrain',
      externalKey: 'pf1/U2YBSx1s8cT8iDq1',
      levels: [3, 8, 13, 18],
      incrementName: (index) => `${ordinal(index + 1)} Favored Terrain`,
      pcgen: pcgen('Ranger ~ Favored Terrain', 1, 289),
      foundry: { level: 3, at: at(rangerFile, 71) },
      decision:
        'PCGen gates the grant at 1 (cr_abilities_class.lst:289), but its terrain count (RangerFavoredTerrainLVL+2)/5 (:1445) first reaches 1 at 3, and it defines no Ranger_CF_FavoredTerrain<n> (cr_abilities_globalvar.lst:760). Foundry links it at 3 ("At 3rd level", favored-terrain.U2YBSx1s8cT8iDq1.yaml:14; "At 8th level and every five levels thereafter", :22). The table gives 3, 8, 13 and 18.',
    }),
    feature({
      id: 'hunters-bond',
      name: 'Hunter’s Bond',
      externalKey: 'pf1/Bs5i98ja24ODe9WL',
      levels: [4],
      whole: ['HuntersBond'],
      pcgen: pcgen("Ranger ~ Hunter's Bond", 4, 293),
      foundry: { level: 4, at: at(rangerFile, 77) },
    }),
    feature({
      id: 'spells',
      name: 'Spells',
      externalKey: 'pf1/Xi5BENHWBu1hLHKl',
      levels: [4],
      casting: true,
      pcgen: null,
      foundry: { level: 4, at: at(rangerFile, 75) },
      decision:
        'PCGen grants no row: Ranger_CF_Spells is only a FACTDEF (cr__datacontrols.lst:693). Foundry links Spells at 4, the level the table’s spells begin.',
    }),
    feature({
      id: 'woodland-stride',
      name: 'Woodland Stride',
      externalKey: 'pf1/5iXq1igb1Cq0qobT',
      levels: [7],
      pcgen: pcgen('Ranger ~ Woodland Stride', 7, 294),
      foundry: { level: 7, at: at(rangerFile, 79) },
    }),
    feature({
      id: 'swift-tracker',
      name: 'Swift Tracker',
      externalKey: 'pf1/sk0HNTe9lKBpHQpN',
      levels: [8],
      pcgen: pcgen('Ranger ~ Swift Tracker', 8, 295),
      foundry: { level: 8, at: at(rangerFile, 81) },
    }),
    feature({
      id: 'evasion',
      name: 'Evasion',
      externalKey: 'pf1/KQYCRLEdD4bGA5ak',
      levels: [9],
      pcgen: pcgen('Ranger ~ Evasion', 9, 296),
      foundry: { level: 9, at: at(rangerFile, 83) },
    }),
    feature({
      id: 'quarry',
      name: 'Quarry',
      externalKey: 'pf1/5NS7Ec3WhKIkhygg',
      levels: [11],
      pcgen: pcgen('Ranger ~ Quarry', 11, 297),
      foundry: { level: 11, at: at(rangerFile, 85) },
    }),
    feature({
      id: 'camouflage',
      name: 'Camouflage',
      externalKey: 'pf1/E90iE6Ynyq1cgGXA',
      levels: [12],
      pcgen: pcgen('Ranger ~ Camouflage', 12, 298),
      foundry: { level: 12, at: at(rangerFile, 87) },
    }),
    feature({
      id: 'improved-evasion',
      name: 'Improved Evasion',
      externalKey: 'pf1/Cc2eFfhJYlClCGEH',
      levels: [16],
      pcgen: pcgen('Ranger ~ Improved Evasion', 16, 299),
      foundry: { level: 16, at: at(rangerFile, 89) },
    }),
    feature({
      id: 'hide-in-plain-sight',
      name: 'Hide in Plain Sight',
      externalKey: 'pf1/ytotO22rp5ji6rT1',
      levels: [17],
      pcgen: pcgen('Ranger ~ Hide in Plain Sight', 17, 300),
      foundry: { level: 17, at: at(rangerFile, 91) },
    }),
    feature({
      id: 'improved-quarry',
      name: 'Improved Quarry',
      externalKey: 'pf1/oRac7XDHBN0JzuyY',
      levels: [19],
      pcgen: pcgen('Ranger ~ Improved Quarry', 19, 301),
      foundry: { level: 19, at: at(rangerFile, 93) },
    }),
    feature({
      id: 'master-hunter',
      name: 'Master Hunter',
      externalKey: 'pf1/GAHaeOGTBeR6LJ3K',
      levels: [20],
      pcgen: pcgen('Ranger ~ Master Hunter', 20, 302),
      foundry: { level: 20, at: at(rangerFile, 95) },
    }),
  ],
  nonRows: {
    ClassSkills: classSkills,
    Proficiencies: proficiency,
    WeaponProficiencies: proficiency,
    LightArmorProficiency: proficiency,
    MediumArmorProficiency: proficiency,
    ShieldProficiency: proficiency,
    AnimalCompanion: { kind: 'option', of: 'hunters-bond' },
  },
  grantNonRows: {},
  // Beast Master's TYPE spells the number (apg_abilities_class.lst:2664),
  // the only spelled number among the old-style tokens.
  typeAliases: { RangerCombatStyleFeat_Six: 'CombatStyleFeat6' },
  foundryNonRows: [],
  defects: [
    {
      id: 'evasion-gate',
      suffixes: ['Evasion', 'ImprovedEvasion'],
      text: 'PCGen gates Evasion and Improved Evasion on the same Ranger_CF_Evasion (cr_abilities_class.lst:296, :299), though it defines Ranger_CF_ImprovedEvasion (cr_abilities_globalvar.lst:775): in PCGen, removing evasion also removes improved evasion, and removing improved evasion removes nothing. The mapper maps each variable by its name.',
    },
    {
      id: 'quarry-gate',
      suffixes: ['Quarry', 'ImprovedQuarry'],
      text: 'PCGen gates Quarry and Improved Quarry on the same Ranger_CF_Quarry (cr_abilities_class.lst:297, :301), though it defines Ranger_CF_ImprovedQuarry (cr_abilities_globalvar.lst:776): in PCGen, removing quarry also removes improved quarry, and removing improved quarry removes nothing. The mapper maps each variable by its name.',
    },
    {
      id: 'favored-enemy-5',
      suffixes: ['FavoredEnemy5'],
      text: 'PCGen gates the fifth favored enemy on Ranger_CF_FavoredEnemy5 (cr_abilities_class.lst:1486), which it never defines (cr_abilities_globalvar.lst:782-785 define 1–4). The table gives the fifth favored enemy at 20.',
    },
  ],
};

const wizardFile = 'packs/classes/wizard.0c4lYDywj6bQ0i8r.yaml';
const wizardBonusFeats = [5, 10, 15, 20];
// Wizard schools and powers depend on the chosen school; none is a table row
// (Wizard_CF_SchoolPower1/8 and the named powers, cr_abilities_globalvar.lst:1098-1163).
const schoolOptions = [
  ...[
    'Abjuration',
    'Conjuration',
    'Divination',
    'Enchantment',
    'Evocation',
    'Illusion',
    'Necromancy',
    'Transmutation',
  ].map((school) => `${school}OppositionSchool`),
  'SchoolPower1',
  'SchoolPower8',
  'AcidDart',
  'AuraOfDespair',
  'BlindingRay',
  'ChangeShape',
  'DazingTouch',
  'DimensionalSteps',
  'DivinersFortune',
  'ElementalWall',
  'EnchantingSmile',
  'EnergyAbsorption',
  'ExtendedIllusion',
  'ForceMissile',
  'Forwarned',
  'GraveTouch',
  'HandOfTheApprentice',
  'IntenseSpells',
  'InvisibilityField',
  'LifeSight',
  'MetamagicMastery',
  'PhysicalEnhancement',
  'PowerOverUndead',
  'ProtectiveWard',
  'Resistance',
  'ScryingAdept',
  'SummonersCharm',
  'TelekineticFist',
];
const wizard: ReviewedSchedule = {
  kind: 'reviewed',
  className: 'Wizard',
  classKey: 'pf1/0c4lYDywj6bQ0i8r',
  source: { book: crb, pages: '77–83' },
  foundryFile: wizardFile,
  acquisitionRecords: ['Wizard'],
  metadataRecords: ['Wizard'],
  flagNamespace: 'Wizard',
  slug: 'wizard',
  classSkillsRecord: 'Class Skills ~ Wizard',
  skillRanksPerLevel: 2,
  skillRanksAt: at(wizardFile, 77),
  features: [
    feature({
      id: 'arcane-bond',
      name: 'Arcane Bond',
      externalKey: 'pf1/pW1PNlDcdGl7KuEa',
      levels: [1],
      pcgen: pcgen('Wizard ~ Arcane Bond', 1, 318),
      foundry: { level: 1, at: at(wizardFile, 59) },
    }),
    feature({
      id: 'arcane-school',
      name: 'Arcane School',
      externalKey: 'pf1/20JWTam2dn7jjZFV',
      levels: [1],
      casting: true,
      pcgen: pcgen('Wizard ~ Arcane School', 1, 319),
      foundry: { level: 1, at: at(wizardFile, 61) },
    }),
    feature({
      id: 'cantrips',
      name: 'Cantrips',
      externalKey: 'pf1/IPy4aqFYbOppaqKC',
      levels: [1],
      casting: true,
      pcgen: pcgen('Wizard ~ Cantrips', 1, 320),
      foundry: { level: 1, at: at(wizardFile, 65) },
    }),
    feature({
      id: 'scribe-scroll',
      name: 'Scribe Scroll',
      externalKey: 'pf1/BS9WDbCy2Up3QHw9',
      levels: [1],
      pcgen: pcgen('Wizard ~ Scribe Scroll', 1, 321),
      foundry: { level: 1, at: at(wizardFile, 63) },
    }),
    feature({
      id: 'spellbooks',
      name: 'Spellbooks',
      externalKey: 'pf1/4wdsdOkgv4uEkS9K',
      levels: [1],
      whole: ['SpellBook'],
      casting: true,
      pcgen: pcgen('Wizard ~ Spellbooks', 1, 323),
      foundry: { level: 1, at: at(wizardFile, 67) },
    }),
    feature({
      id: 'spells',
      name: 'Spells',
      externalKey: 'pf1/LrjNAKP05lZq2tZZ',
      levels: [1],
      casting: true,
      pcgen: pcgen('Wizard ~ Spells', 1, 316),
      foundry: { level: 1, at: at(wizardFile, 69) },
    }),
    feature({
      id: 'bonus-feats',
      name: 'Bonus Feats',
      externalKey: 'pf1/2h3lI574tmVjOalQ',
      levels: wizardBonusFeats,
      incrementName: () => 'Bonus Feat',
      parts: byLevel('BonusFeat', wizardBonusFeats),
      increments: 'numbered',
      pcgen: pcgen('Wizard ~ Bonus Feats', 5, 322),
      foundry: { level: 5, at: at(wizardFile, 71) },
      acquisitionFormula: at(
        'packs/class-abilities/bonus-feats-wiz.2h3lI574tmVjOalQ.yaml',
        13,
      ),
    }),
  ],
  nonRows: {
    ClassSkills: classSkills,
    WeaponProficiencies: proficiency,
    BonusLanguages: {
      kind: 'notOnTable',
      text: 'Bonus Languages (granted at 1, cr_abilities_class.lst:317) is class text, not a table row; Foundry links nothing for it.',
    },
    Familiar: option('arcane-bond'),
    BondedObject: option('arcane-bond'),
    ...Object.fromEntries(
      schoolOptions.map((suffix) => [suffix, option('arcane-school')]),
    ),
  },
  grantNonRows: {},
  typeAliases: {},
  foundryNonRows: [],
  defects: [],
};

const schedules: Readonly<Record<ScheduleClassName, ReviewedSchedule>> = {
  Fighter: fighter,
  Rogue: rogue,
  Ranger: ranger,
  Wizard: wizard,
  ...companionSchedules,
  ...martialSchedules,
  ...ragePerformanceSchedules,
  ...smiteChallengeSchedules,
  ...alchemyTalentSchedules,
  ...judgmentArcanaSchedules,
  ...channelBloodlineSchedules,
  ...mysteryHexSchedules,
};

/** The reviewed schedule of a class, or undefined while it has none (P7). */
export function reviewedSchedule(className: string) {
  return Object.values(schedules).find(
    (schedule) => schedule.className === className,
  );
}

/**
 * A class whose table no one has reviewed yet (#716 P6, ahead of P7's
 * schedule slices): no rows, so every removal or touch flag of its
 * archetypes names no row and goes to review, and only a checked structure
 * record settles what they replace (plan §4, §6). The Foundry class, its
 * skill ranks and its PCGen class skills record are the caller's; its PCGen
 * names default to the class name's (a version names its own, #716 P7-0).
 */
export function unscheduledClass(
  fields: Pick<
    UnscheduledClass,
    | 'className'
    | 'classKey'
    | 'foundryFile'
    | 'skillRanksPerLevel'
    | 'skillRanksAt'
    | 'classSkillsRecord'
  > &
    Partial<
      Pick<
        UnscheduledClass,
        'acquisitionRecords' | 'metadataRecords' | 'flagNamespace' | 'slug'
      >
    >,
): UnscheduledClass {
  return {
    acquisitionRecords: [fields.className],
    metadataRecords: [fields.className],
    flagNamespace: fields.className,
    slug: fields.className.toLowerCase(),
    ...fields,
    kind: 'unscheduled',
    features: [],
    nonRows: {},
    grantNonRows: {},
    typeAliases: {},
    foundryNonRows: [],
    defects: [],
  };
}

/** A schedule row: one acquisition or increment of a feature. */
export type ScheduleRow = {
  classLevel: number;
  externalKey: string;
  feature: string;
};

/**
 * The catalog key of a feature's row at a class level (#716 P6): the Foundry
 * feature at its acquisition, else the increment's own key,
 * `everythingpath/<slug>-<feature id>-<level>` (`fighter-bravery-6`,
 * `unchained-barbarian-danger-sense-6`).
 */
export function rowKeyOf(
  schedule: ClassSchedule,
  feature: ScheduledFeature,
  classLevel: number,
) {
  return classLevel === feature.levels[0]
    ? feature.externalKey
    : `everythingpath/${schedule.slug}-${feature.id}-${classLevel}`;
}

/**
 * The class's `featuresByLevel`: one row per acquisition or increment, by
 * level and then table order. A feature's first row is its Foundry record;
 * each later row is an increment entry (`incrementEntries`), so no key
 * repeats and the acquisition record's modifiers count once.
 */
export function scheduleRows(schedule: ReviewedSchedule): ScheduleRow[] {
  return schedule.features
    .flatMap((feature) =>
      feature.levels.map((classLevel) => ({
        classLevel,
        externalKey: rowKeyOf(schedule, feature, classLevel),
        feature: feature.id,
      })),
    )
    .sort((left, right) => left.classLevel - right.classLevel);
}

/**
 * One class feature entry per later row of a feature (#716 P6): no
 * modifiers, the acquisition's Foundry key as its parent, and as its part the
 * `<classLevel>:<parent>` the sheet gives a row without one
 * (`classFeatureMetadata`), so a part change or replacement still compares
 * equal to the row. Its provenance is the reviewed schedule.
 */
export function incrementEntries(schedule: ReviewedSchedule): PreviewEntry[] {
  return schedule.features.flatMap((feature) =>
    feature.levels.slice(1).map((classLevel, index): PreviewEntry => {
      const externalKey = rowKeyOf(schedule, feature, classLevel);
      const name = feature.incrementName?.(index + 1);
      if (!name)
        throw new Error(
          `${feature.name} has no table label for its increments.`,
        );
      const { book, pages } = schedule.source;
      const overlay = (target: string) => ({
        source: 'overlay' as const,
        locator: { externalKey, kind: 'schedule', target },
      });
      return {
        externalKey,
        upstreamKey: externalKey,
        pack: 'everythingpath-schedules',
        name,
        detail: {
          kind: 'classFeature',
          parentFeature: feature.externalKey,
          part: `${classLevel}:${feature.externalKey}`,
        },
        description: `<p>${name}: the ${schedule.className} table's ${ordinal(classLevel)}-level row of ${feature.name} (${book} pp. ${pages}). The ${feature.name} entry's own rules give its value.</p>`,
        sources: [{ ...schedule.source }],
        modifiers: [],
        unsupported: [],
        provenance: {
          name: overlay('name'),
          description: overlay('description'),
          sources: overlay('sources'),
          'detail.parentFeature': overlay('detail.parentFeature'),
          'detail.part': overlay('detail.part'),
        },
      };
    }),
  );
}

/** Every increment key of the reviewed schedules, which no identity may take. */
export function allIncrementKeys() {
  return Object.values(schedules).flatMap((schedule) =>
    incrementEntries(schedule).map(({ externalKey }) => externalKey),
  );
}

/** What a `<Class>_CF_` or `_Archetype_` suffix names. */
export type ScheduleTarget =
  | { kind: 'feature'; feature: ScheduledFeature; classLevel: number | null }
  | (ScheduleNonRow & { feature?: never })
  | { kind: 'unknown' };

const fold = (text: string) => text.toLowerCase();

/** Resolves a variable suffix by name: a whole feature, a part at its explicit level, or a non-row. */
export function resolveSuffix(
  schedule: ClassSchedule,
  suffix: string,
): ScheduleTarget {
  const name = fold(suffix);
  for (const feature of schedule.features) {
    if (feature.whole.some((whole) => fold(whole) === name))
      return { kind: 'feature', feature, classLevel: null };
    const part = Object.entries(feature.parts).find(
      ([candidate]) => fold(candidate) === name,
    );
    if (part) return { kind: 'feature', feature, classLevel: part[1] };
  }
  const nonRow = Object.entries(schedule.nonRows).find(
    ([candidate]) => fold(candidate) === name,
  );
  return nonRow ? nonRow[1] : { kind: 'unknown' };
}

// --- PCGen's own schedule ---------------------------------------------------

/**
 * A gated grant (kind 1, #716 P7-0): `PREVAREQ:<namespace>_CF_<suffix>,0` at
 * a level, `PREVARGTEQ:<namespace>_CFP_Level,N` (or `PRECLASS:1,<class>=N`)
 * or the class block's level line it stands on.
 */
export type PcgenAcquisition = {
  granted: string;
  suffix: string;
  level: number;
  at: At;
};
/**
 * A numbered part variable PCGen gates: `,1` removes a pick when an
 * archetype sets it (`removal`), `,0` adds one while it is kept (`kept`),
 * at the level the same token's prerequisites give, nested ones included.
 * A part bound into a variable that gates a grant is kept through that
 * variable (`binding`; the bloodrager's bloodline powers).
 */
export type PcgenGatedPart = {
  at: At;
  /** For a gate through a variable, the binding that reads the flag. */
  binding?: At;
  level: number | null;
  polarity: 'removal' | 'kept';
};
/**
 * An ungated grant (kind 2): a class feature granted at a level with no
 * `<namespace>_CF_` gate (`Summoner ~ Aspect`, apg_abilities_class.lst:756),
 * so no archetype flag removes it.
 */
export type PcgenUngatedGrant = { granted: string; level: number; at: At };
/**
 * A nested grant (kind 3): a feature record's grant gated
 * `PREVAREQ:<namespace>_CF_<suffix>,0` (the bard performances inside
 * `Bard ~ Bardic Performance`, cr_abilities_class.lst:505), at the level its
 * own prerequisites give.
 */
export type PcgenNestedGrant = {
  granted: string;
  suffix: string;
  /** The feature record holding the grant. */
  owner: string;
  level: number | null;
  at: At;
};
export type PcgenSchedule = {
  flagNamespace: string;
  acquisitions: PcgenAcquisition[];
  /** Numbered part suffixes PCGen gates anywhere, removal gates first. */
  gatedParts: ReadonlyMap<string, PcgenGatedPart>;
  ungatedGrants: PcgenUngatedGrant[];
  nestedGrants: PcgenNestedGrant[];
  /** `<namespace>_CF_` suffixes PCGen defines (`DEFINE:<namespace>_CF_<suffix>|0`). */
  defined: ReadonlySet<string>;
  /** Old-style archetype TYPE tokens and the suffix each sets (`BONUS:VAR|…|PREABILITY:1,CATEGORY=Archetype,TYPE.<type>`). */
  typeBridges: ReadonlyMap<string, string>;
};
/** The PCGen names a schedule reads PCGen's own schedule by. */
export type PcgenScheduleNames = Pick<
  ScheduleBasis,
  'acquisitionRecords' | 'metadataRecords' | 'flagNamespace'
>;

function prerequisitesOf(token: string): PcgenPrerequisite[] {
  return token.split('|').filter(isPrerequisiteToken).map(parsePrerequisite);
}
/** Every prerequisite node, nested ones included, and whether all its ancestors are required. */
function* walk(
  nodes: readonly PcgenPrerequisite[],
  isRequired = true,
): Generator<{ node: PcgenPrerequisite; isRequired: boolean }> {
  for (const node of nodes) {
    yield { node, isRequired };
    const nested = node.items.filter(
      (item): item is PcgenPrerequisite => typeof item !== 'string',
    );
    // `PREMULT:n` requires every item only when n counts them all.
    const allRequired =
      isRequired &&
      !node.isNegated &&
      node.kind === 'PREMULT' &&
      node.count === nested.length;
    yield* walk(nested, allRequired);
  }
}
/** A prerequisite's number, parsed so `06` and `01` read as 6 and 1. */
const numberOf = (value: string | PcgenPrerequisite | undefined) =>
  typeof value === 'string' && /^\d+$/.test(value.trim())
    ? Number(value)
    : null;
/** `PREVAREQ:<variable>,<value>` gates in a token, nested ones included. */
function varGates(nodes: readonly PcgenPrerequisite[]) {
  return [...walk(nodes)].flatMap(({ node }) => {
    const [variable, value] = node.items;
    const number = numberOf(value);
    return node.kind === 'PREVAREQ' &&
      !node.isNegated &&
      typeof variable === 'string' &&
      number !== null
      ? [{ variable, value: number }]
      : [];
  });
}
/**
 * The class a schedule reads PCGen's gates for: its flag namespace and the
 * variables bound to its level.
 */
type ClassGates = {
  namespace: string;
  /** The folded variables that hold the class level, each with the level it holds it from (0: from 1st). */
  levelVariables: ReadonlyMap<string, number>;
};

/** What a class block binds to its own level (`CL`, `classlevel()`, acg_classes.lst:168). */
const classLevelFormulas = new Set([
  'cl',
  'classlevel()',
  'classlevel("appliedas=nonepic")',
]);

type Binding = {
  variable: string;
  formula: string;
  conditions: PcgenPrerequisite[];
};

/** `BONUS:VAR|<variable>|<formula>`, with an optional `TYPE=` and prerequisites: what the variable holds, and when. */
function bindingOf(token: string): Binding | null {
  const [tag, variable, formula, ...rest] = token.split('|');
  if (tag !== 'BONUS:VAR' || !variable || !formula) return null;
  const conditions = rest.filter((part) => !part.startsWith('TYPE='));
  return conditions.every(isPrerequisiteToken)
    ? {
        variable: fold(variable),
        formula: fold(formula),
        conditions: conditions.map(parsePrerequisite),
      }
    : null;
}

/** `PREVARGTEQ:<level variable>,N`: the class level it requires. */
function variableLevel(
  node: PcgenPrerequisite,
  levelVariables: ClassGates['levelVariables'],
) {
  const [variable, value] = node.items;
  const from =
    typeof variable === 'string' ? levelVariables.get(fold(variable)) : null;
  const level = numberOf(value);
  return node.kind === 'PREVARGTEQ' &&
    !node.isNegated &&
    from != null &&
    level !== null
    ? Math.max(level, from)
    : null;
}

/**
 * The level from which a binding holds the class level: its formula's, raised
 * by each condition on a level variable (`BONUS:VAR|FighterWeaponTrainingLVL|FighterLVL|TYPE=Class|PREVARGTEQ:Fighter_CFP_Level,5`,
 * cr_abilities_class.lst:255). Null when the formula is no level variable or
 * a condition is anything else.
 */
function heldFrom(
  { formula, conditions }: Binding,
  levelVariables: ClassGates['levelVariables'],
) {
  const from = levelVariables.get(formula);
  if (from === undefined) return null;
  const levels = conditions.map((node) => variableLevel(node, levelVariables));
  return levels.every((level) => level !== null)
    ? Math.max(from, ...levels)
    : null;
}

/**
 * The variables bound to a class's level: `<namespace>_CFP_Level`, those its
 * class block binds to its level (`BONUS:VAR|DruidLVL|CL`, cr_classes.lst:93),
 * and those any record but an archetype binds, whole, to one of them
 * (`BONUS:VAR|DruidWildShape|DruidLVL`, cr_abilities_class.lst:796), through
 * any chain (acg_abilities_class.lst:359-361). A formula
 * (`(RogueLvl+5)/8`) binds nothing.
 */
function levelVariablesOf(
  view: PcgenEffectiveView,
  blocks: readonly PcgenEffectiveRecord[],
  namespace: string,
) {
  const levelVariables = new Map([[fold(`${namespace}_CFP_Level`), 0]]);
  for (const { token } of blocks.flatMap(({ tokens }) => tokens)) {
    const binding = bindingOf(token);
    if (
      binding?.conditions.length === 0 &&
      classLevelFormulas.has(binding.formula)
    )
      levelVariables.set(binding.variable, 0);
  }
  const bindings = [...view.records.values()].flatMap(({ record, tokens }) =>
    fold(record.category) === 'archetype'
      ? []
      : tokens.flatMap(({ token }) => bindingOf(token) ?? []),
  );
  for (let grown = true; grown; ) {
    grown = false;
    for (const binding of bindings) {
      if (levelVariables.has(binding.variable)) continue;
      const from = heldFrom(binding, levelVariables);
      if (from === null) continue;
      levelVariables.set(binding.variable, from);
      grown = true;
    }
  }
  return levelVariables;
}

/** The prerequisites a token requires: not negated, and under no any-of `PREMULT`. */
const requiredPrerequisites = (nodes: readonly PcgenPrerequisite[]) =>
  [...walk(nodes)].flatMap(({ node, isRequired }) =>
    isRequired && !node.isNegated ? [node] : [],
  );

/** `PRECLASS:1,<namespace>=N`: N. */
function classLevels(node: PcgenPrerequisite, { namespace }: ClassGates) {
  if (node.kind !== 'PRECLASS' || node.count !== 1) return [];
  return node.items.flatMap((item) => {
    const [name, level] = typeof item === 'string' ? item.split('=') : [];
    return name !== undefined && fold(name) === fold(namespace)
      ? (numberOf(level) ?? [])
      : [];
  });
}

/**
 * The class level a token's required prerequisites gate it at: the highest
 * `PREVARGTEQ` on a level variable or `PRECLASS:1,<namespace>=N`.
 */
function gateLevel(nodes: readonly PcgenPrerequisite[], gates: ClassGates) {
  const levels = requiredPrerequisites(nodes).flatMap((node) => {
    const level = variableLevel(node, gates.levelVariables);
    return level === null ? classLevels(node, gates) : [level];
  });
  return levels.length > 0 ? Math.max(...levels) : null;
}

/** What a token grants: an ABILITY's key, with its category, or a pool. */
function grantedBy(token: string) {
  if (token.startsWith('ABILITY:')) {
    const [category = '', , key] = token.slice('ABILITY:'.length).split('|');
    return key ? { granted: key, category } : null;
  }
  const pool = /^BONUS:ABILITYPOOL\|([^|]+)\|/.exec(token)?.[1];
  return pool ? { granted: `pool:${pool}`, category: null } : null;
}

const atOf = ({ file, line }: Pick<PcgenSourcedToken, 'file' | 'line'>) =>
  at(file, line);

/** `DEFINE:<namespace>_CF_<suffix>|0`: a suffix PCGen defines. */
function definedSuffix(prefix: string, token: string) {
  return new RegExp(`^DEFINE:${prefix}(\\w+)\\|0$`).exec(token)?.[1];
}

/** `BONUS:VAR|<namespace>_CF_<suffix>|1|…|PREABILITY:1,CATEGORY=Archetype,TYPE.<type>,…`: the TYPEs that set a suffix. */
function bridgedTypes(prefix: string, token: string) {
  const bridge = new RegExp(
    `^BONUS:VAR\\|${prefix}(\\w+)\\|1\\|TYPE=Boolean\\|PREABILITY:1,CATEGORY=Archetype,(.+)$`,
  ).exec(token);
  const [, suffix, types] = bridge ?? [];
  return suffix && types
    ? types
        .split(',')
        .map((type) => [type.replace(/^TYPE[.=]/, ''), suffix] as const)
    : [];
}

/** An old-style archetype gate: `!PREABILITY:1,CATEGORY=Archetype,TYPE.…`. */
const isArchetypeGated = (nodes: readonly PcgenPrerequisite[]) =>
  nodes.some(
    (node) =>
      node.kind === 'PREABILITY' &&
      node.isNegated &&
      node.items.includes('CATEGORY=Archetype'),
  );

/**
 * A class grant at a level, gated (kind 1) or not (kind 2): the level is the
 * level line's, else (or if higher) the prerequisites'. Only a class feature
 * grant with no `_CF_` and no old-style archetype gate is ungated; a grant of
 * the class record itself (`ABILITY:Class|…`) is neither.
 */
function classGrantOf(
  gates: ClassGates,
  sourced: PcgenSourcedToken,
  lineLevel: number | null,
):
  | { kind: 'gated'; acquisition: PcgenAcquisition }
  | { kind: 'ungated'; grant: PcgenUngatedGrant }
  | null {
  const grant = grantedBy(sourced.token);
  if (!grant) return null;
  const nodes = prerequisitesOf(sourced.token);
  const prerequisiteLevel = gateLevel(nodes, gates);
  const level =
    lineLevel === null
      ? prerequisiteLevel
      : Math.max(lineLevel, prerequisiteLevel ?? 0);
  if (level === null) return null;
  const flags = flagGatesOf(gates.namespace, nodes);
  const gate = flags.find(({ value }) => value === 0);
  const at = atOf(sourced);
  if (gate)
    return {
      kind: 'gated',
      acquisition: { granted: grant.granted, suffix: gate.suffix, level, at },
    };
  return flags.length === 0 &&
    grant.category?.endsWith('Class Feature') &&
    !isArchetypeGated(nodes)
    ? { kind: 'ungated', grant: { granted: grant.granted, level, at } }
    : null;
}

/** The `<namespace>_CF_<suffix>` gates prerequisites name, nested ones included. */
function flagGatesOf(namespace: string, nodes: readonly PcgenPrerequisite[]) {
  const prefix = fold(`${namespace}_CF_`);
  return varGates(nodes).flatMap(({ variable, value }) =>
    fold(variable).startsWith(prefix)
      ? [{ suffix: variable.slice(prefix.length), value }]
      : [],
  );
}

/** A token's prerequisites and their flag gates, if it names the namespace's flags at all. */
function flagGates(namespace: string, token: string) {
  if (!fold(token).includes(fold(`${namespace}_CF_`))) return null;
  const nodes = prerequisitesOf(token);
  return { nodes, gates: flagGatesOf(namespace, nodes) };
}

/**
 * The variables bound to hold 1 while a numbered part is kept, by folded
 * name: `BONUS:VAR|<variable>|if(<namespace>_CF_<part>==0,1,0)`, the test
 * alone or joined with `&&` to others (each bloodrager bloodline's
 * `Bloodrager_<Bloodline>_BloodlinePower<n>`, acg_abilities_class.lst:566).
 */
function keptPartBindingsOf(view: PcgenEffectiveView, namespace: string) {
  const kept = new RegExp(
    `^BONUS:VAR\\|(\\w+)\\|if\\(\\(?${namespace}_CF_(\\w*\\d)==0(?:&&[^,()]*)?\\)?,1,0\\)(?:\\||$)`,
    'i',
  );
  const bindings = new Map<string, { suffix: string; at: At }>();
  for (const { tokens } of view.records.values())
    for (const sourced of tokens) {
      const [, variable, suffix] = kept.exec(sourced.token) ?? [];
      if (variable && suffix && !bindings.has(fold(variable)))
        bindings.set(fold(variable), { suffix, at: atOf(sourced) });
    }
  return bindings;
}

/** A grant's required `PREVARGTEQ:<variable>,1` (or `PREVAREQ`) gates on a kept part's variable. */
function keptPartGates(
  token: string,
  bindings: ReturnType<typeof keptPartBindingsOf>,
) {
  if (bindings.size === 0 || !grantedBy(token)) return [];
  return requiredPrerequisites(prerequisitesOf(token)).flatMap((node) => {
    const [variable, value] = node.items;
    const binding =
      typeof variable === 'string' ? bindings.get(fold(variable)) : undefined;
    return (node.kind === 'PREVARGTEQ' || node.kind === 'PREVAREQ') &&
      binding &&
      numberOf(value) === 1
      ? [binding]
      : [];
  });
}

/**
 * Part suffixes (ending in their number) gated anywhere: `,1` removal gates
 * first, then `,0` kept gates, each at its first use. A grant gated on a
 * variable bound to a kept part (`keptPartBindingsOf`) is a kept gate too.
 */
function gatedPartsOf(view: PcgenEffectiveView, gates: ClassGates) {
  const found = { removal: new Map(), kept: new Map() } satisfies Record<
    PcgenGatedPart['polarity'],
    Map<string, PcgenGatedPart>
  >;
  const bindings = keptPartBindingsOf(view, gates.namespace);
  for (const effective of view.records.values())
    for (const sourced of effective.tokens) {
      const read = flagGates(gates.namespace, sourced.token);
      for (const { suffix, value } of read?.gates ?? []) {
        if (!/\d$/.test(suffix) || (value !== 0 && value !== 1)) continue;
        const polarity = value === 1 ? 'removal' : 'kept';
        if (found[polarity].has(suffix)) continue;
        found[polarity].set(suffix, {
          at: atOf(sourced),
          level: read ? gateLevel(read.nodes, gates) : null,
          polarity,
        });
      }
      for (const { suffix, at: binding } of keptPartGates(
        sourced.token,
        bindings,
      )) {
        if (found.kept.has(suffix)) continue;
        found.kept.set(suffix, {
          at: atOf(sourced),
          binding,
          level: gateLevel(prerequisitesOf(sourced.token), gates),
          polarity: 'kept',
        });
      }
    }
  return new Map([...found.kept, ...found.removal]);
}

/** A feature grant: a pool, or an ability of a feature category (not `Internal` proficiencies or feats). */
const isFeatureGrant = ({ category }: { category: string | null }) =>
  category === null ||
  category === 'Special Ability' ||
  category.endsWith('Class Feature');

/**
 * Feature records' feature grants gated on an unnumbered
 * `<namespace>_CF_<suffix>,0` (kind 3). Class records, class blocks and
 * archetypes aren't feature records.
 */
function nestedGrantsOf(view: PcgenEffectiveView, gates: ClassGates) {
  const nested = new Map<string, PcgenNestedGrant>();
  for (const { record, tokens } of view.records.values()) {
    if (['class', 'archetype'].includes(fold(record.category))) continue;
    for (const sourced of tokens) {
      const grant = grantedBy(sourced.token);
      if (!grant || !isFeatureGrant(grant)) continue;
      const read = flagGates(gates.namespace, sourced.token);
      const gate = read?.gates.find(
        ({ suffix, value }) => value === 0 && !/\d$/.test(suffix),
      );
      if (!read || !gate) continue;
      const found: PcgenNestedGrant = {
        granted: grant.granted,
        suffix: gate.suffix,
        owner: record.locator.key,
        level: gateLevel(read.nodes, gates),
        at: atOf(sourced),
      };
      const key = `${found.granted}|${found.suffix}|${found.at}`;
      if (!nested.has(key)) nested.set(key, found);
    }
  }
  return [...nested.values()];
}

/**
 * The schedule PCGen alone gives a class version: the gated grants of its
 * acquisition records and of its class block's level lines, its ungated and
 * nested grants, the part variables it gates, and the variables and TYPE
 * bridges its metadata records (shared by its versions) define. Only a grant
 * gives a row; a formula gives nothing more (plan §4.3).
 */
export function pcgenSchedule({
  tree,
  view,
  schedule,
}: {
  tree: PcgenTree;
  view: PcgenEffectiveView;
  schedule: PcgenScheduleNames;
}): PcgenSchedule {
  const { flagNamespace: namespace } = schedule;
  const prefix = `${namespace}_CF_`;
  const tokensOf = (keys: readonly string[]) =>
    [...new Set(keys)]
      .flatMap((key) => recordsByKey(tree.classRecords, key))
      .flatMap((record) => view.records.get(record)?.tokens ?? []);
  const blocks = tree.baseClasses
    .filter(({ locator }) => fold(locator.key) === fold(namespace))
    .flatMap((block) => view.records.get(block) ?? []);
  const gates: ClassGates = {
    namespace,
    levelVariables: levelVariablesOf(view, blocks, namespace),
  };
  const grants = [
    ...tokensOf(schedule.acquisitionRecords).map((sourced) =>
      classGrantOf(gates, sourced, null),
    ),
    ...blocks.flatMap(({ levelLines }) =>
      levelLines.flatMap((line) =>
        sourcedTokens(line)
          .slice(1)
          .map((sourced) => classGrantOf(gates, sourced, line.level)),
      ),
    ),
  ];
  const metadata = [
    ...tokensOf([...schedule.metadataRecords, ...schedule.acquisitionRecords]),
    ...blocks.flatMap(({ tokens }) => tokens),
  ];
  return {
    flagNamespace: namespace,
    acquisitions: grants.flatMap((grant) =>
      grant?.kind === 'gated' ? [grant.acquisition] : [],
    ),
    gatedParts: gatedPartsOf(view, gates),
    ungatedGrants: grants.flatMap((grant) =>
      grant?.kind === 'ungated' ? [grant.grant] : [],
    ),
    nestedGrants: nestedGrantsOf(view, gates),
    defined: new Set(
      metadata.flatMap(({ token }) => definedSuffix(prefix, token) ?? []),
    ),
    typeBridges: new Map(
      metadata.flatMap(({ token }) => bridgedTypes(prefix, token)),
    ),
  };
}

/**
 * Where PCGen's schedule differs from the reviewed table: a formula-held
 * feature's missing rows, an acquisition at another level, a shared or
 * undefined gate, a row only one source has, or a grant no archetype flag
 * removes (an ungated or nested grant, #716 P7-0). Each is settled by the
 * reviewed schedule's decision or defect, or left unsettled.
 */
export type ScheduleFinding = {
  kind:
    | 'formulaIncrement'
    | 'acquisitionLevel'
    | 'sharedGate'
    | 'undefinedPart'
    | 'ungatedParts'
    | 'pcgenOnly'
    | 'foundryOnly'
    | 'ungatedGrant'
    | 'nestedGrant'
    | 'nonRow'
    | 'unexplained';
  feature: string;
  text: string;
  /** The decision or defect that settles it, if any. */
  settledBy: string | null;
};

export type FoundryAssociation = { level: number; externalKey: string; at: At };

/** Foundry's class associations, by level and stable key, from the pinned class record. */
export function foundryAssociations(file: string, text: string) {
  const lines = text.split(/\r?\n/);
  return lines.flatMap((line, index): FoundryAssociation[] => {
    const level = /^\s+- level: (\d+)$/.exec(line)?.[1];
    const id = /\.Item\.([A-Za-z0-9]+)$/.exec(lines[index + 1] ?? '')?.[1];
    return level && id
      ? [
          {
            level: Number(level),
            externalKey: `pf1/${id}`,
            at: at(file, index + 1),
          },
        ]
      : [];
  });
}

type Comparison = {
  schedule: ClassSchedule;
  pcgen: PcgenSchedule;
  foundry: readonly FoundryAssociation[];
};

const defectOf = (schedule: ClassSchedule, suffix: string) =>
  schedule.defects.find(({ suffixes }) => suffixes.includes(suffix))?.id ??
  null;
const decisionOf = (feature: ScheduledFeature) =>
  feature.decision ? `decision:${feature.id}` : null;

/** One PCGen acquisition against the table: no feature, a shared gate, another level. */
function acquisitionFindings(
  { schedule, pcgen }: Comparison,
  acquisition: PcgenAcquisition,
): ScheduleFinding[] {
  // A record PCGen grants for two rows is each row's where the schedule
  // cites it (`Uncanny Dodge ~ Base` at 4 and 8, uc_abilities_globalvar.lst:24,
  // :26, #716 P7b).
  const granting = schedule.features.filter((candidate) =>
    grants(candidate, acquisition.granted),
  );
  const feature =
    granting.find(({ pcgen: granted }) => granted?.at === acquisition.at) ??
    granting[0];
  const later = laterGrantOf(schedule, acquisition.granted);
  if (!feature && later) return laterGrantFindings(later, acquisition, pcgen);
  if (!feature) {
    const known =
      resolveSuffix(schedule, acquisition.suffix).kind !== 'unknown';
    return [
      {
        kind: known ? 'nonRow' : 'unexplained',
        feature: acquisition.suffix,
        text: `${acquisition.granted} at ${acquisition.level} (${acquisition.at}) is no table feature.`,
        settledBy: known ? `nonRow:${acquisition.suffix}` : null,
      },
    ];
  }
  const findings: ScheduleFinding[] = [];
  if (!feature.whole.some((whole) => fold(whole) === fold(acquisition.suffix)))
    findings.push({
      kind: 'sharedGate',
      feature: feature.id,
      text: `${acquisition.granted} (${acquisition.at}) is gated on ${pcgen.flagNamespace}_CF_${acquisition.suffix}.`,
      settledBy: defectOf(schedule, acquisition.suffix),
    });
  if (
    acquisition.level !== feature.pcgen?.level ||
    acquisition.at !== feature.pcgen.at
  )
    findings.push({
      kind: 'unexplained',
      feature: feature.id,
      text: `PCGen grants ${feature.name} at ${acquisition.level} (${acquisition.at}), not as the schedule cites it.`,
      settledBy: null,
    });
  else if (acquisition.level !== feature.levels[0])
    findings.push({
      kind: 'acquisitionLevel',
      feature: feature.id,
      text: `PCGen grants ${feature.name} at ${acquisition.level} (${acquisition.at}); the table gives ${feature.levels[0]}.`,
      settledBy: decisionOf(feature),
    });
  return findings;
}

/** The feature whose later row PCGen grants as this record, if any. */
function laterGrantOf(schedule: ClassSchedule, granted: string) {
  for (const feature of schedule.features) {
    const grant = feature.laterGrants?.find(
      (candidate) => toPcgenKey(candidate.granted) === toPcgenKey(granted),
    );
    if (grant) return { feature, grant };
  }
  return undefined;
}

/**
 * A later row PCGen grants as its own record (`Summoner ~ Gate`): on the
 * feature's own gate, at a level the table gives the feature and as the
 * schedule cites it, it is that row and no finding.
 */
function laterGrantFindings(
  { feature, grant }: NonNullable<ReturnType<typeof laterGrantOf>>,
  acquisition: PcgenAcquisition,
  pcgen: PcgenSchedule,
): ScheduleFinding[] {
  const isCited =
    acquisition.level === grant.level &&
    acquisition.at === grant.at &&
    feature.levels.includes(grant.level);
  const isOwnGate = feature.whole.some(
    (whole) => fold(whole) === fold(acquisition.suffix),
  );
  if (isCited && isOwnGate) return [];
  return [
    {
      kind: 'unexplained',
      feature: feature.id,
      text: `PCGen grants ${acquisition.granted} at ${acquisition.level} (${acquisition.at}) on ${pcgen.flagNamespace}_CF_${acquisition.suffix}, not as the schedule cites ${feature.name}'s row.`,
      settledBy: null,
    },
  ];
}

const grants = (feature: ScheduledFeature, granted: string) =>
  feature.pcgen !== null &&
  toPcgenKey(granted) === toPcgenKey(feature.pcgen.granted);

/**
 * A table feature only one source has. A feature PCGen grants ungated or
 * nested isn't Foundry-only: its `ungatedGrant` or `nestedGrant` finding
 * names it.
 */
function sourceFindings(
  { pcgen, foundry }: Comparison,
  feature: ScheduledFeature,
): ScheduleFinding[] {
  const acquired = [
    ...pcgen.acquisitions,
    ...pcgen.ungatedGrants,
    ...pcgen.nestedGrants,
  ].some(({ granted }) => grants(feature, granted));
  const linked = foundry.some(
    ({ externalKey }) => externalKey === feature.externalKey,
  );
  return [
    ...(acquired
      ? []
      : [
          {
            kind: 'foundryOnly',
            feature: feature.id,
            text: `PCGen grants no ${feature.name} row.`,
            settledBy: decisionOf(feature),
          } satisfies ScheduleFinding,
        ]),
    ...(linked
      ? []
      : [
          {
            kind: 'pcgenOnly',
            feature: feature.id,
            text: `Foundry links no ${feature.name} to the class.`,
            settledBy: decisionOf(feature),
          } satisfies ScheduleFinding,
        ]),
  ];
}

/** A feature's later rows PCGen holds in a formula, and parts it gates but never defines. */
function incrementFindings(
  { schedule, pcgen }: Comparison,
  feature: ScheduledFeature,
): ScheduleFinding[] {
  const parts = Object.keys(feature.parts);
  const gated = parts.filter((part) => pcgen.gatedParts.has(part));
  return [
    ...(feature.levels.length > 1 && gated.length === 0
      ? [
          {
            kind: parts.length > 0 ? 'ungatedParts' : 'formulaIncrement',
            feature: feature.id,
            text: `PCGen gives ${feature.name} one row at ${feature.pcgen?.level ?? '—'} and gates no part; the table gives ${feature.levels.join(', ')}.`,
            settledBy: decisionOf(feature),
          } satisfies ScheduleFinding,
        ]
      : []),
    ...gated
      .filter((part) => !pcgen.defined.has(part))
      .map(
        (part): ScheduleFinding => ({
          kind: 'undefinedPart',
          feature: feature.id,
          text: `PCGen gates ${pcgen.flagNamespace}_CF_${part} (${pcgen.gatedParts.get(part)?.at}) but never defines it.`,
          settledBy: defectOf(schedule, part),
        }),
      ),
  ];
}

/** The reviewed non-row a PCGen grant is (a proficiency grant), if any. */
const grantNonRowOf = (schedule: ClassSchedule, granted: string) =>
  Object.hasOwn(schedule.grantNonRows, granted)
    ? `grantNonRow:${granted}`
    : null;

/** A grant no archetype flag removes, against the table feature it grants, if any. */
function ungatedFindings({ schedule, pcgen }: Comparison): ScheduleFinding[] {
  return pcgen.ungatedGrants.map(({ granted, level, at: where }) => {
    const feature = schedule.features.find((candidate) =>
      grants(candidate, granted),
    );
    return {
      kind: 'ungatedGrant',
      feature: feature?.id ?? granted,
      text: `PCGen grants ${granted} at ${level} (${where}) with no ${pcgen.flagNamespace}_CF_ gate: no archetype flag removes it, so a replacement goes to review.`,
      settledBy: feature
        ? decisionOf(feature)
        : grantNonRowOf(schedule, granted),
    };
  });
}

/**
 * A feature record's grant gated on a class flag, against the table feature
 * its grant or flag names. A flag the schedule reviews as a non-row (a
 * school's powers are options of arcane school) is no class row to compare.
 */
function nestedFindings({ schedule, pcgen }: Comparison): ScheduleFinding[] {
  return pcgen.nestedGrants.flatMap(
    ({ granted, suffix, owner, level, at: where }): ScheduleFinding[] => {
      const target = resolveSuffix(schedule, suffix);
      const feature =
        schedule.features.find((candidate) => grants(candidate, granted)) ??
        (target.kind === 'feature' ? target.feature : undefined);
      if (!feature && target.kind !== 'unknown') return [];
      return [
        {
          kind: 'nestedGrant',
          feature: feature?.id ?? granted,
          text: `${owner} grants ${granted} (${where}) gated on ${pcgen.flagNamespace}_CF_${suffix}${level === null ? '' : ` at ${level}`}: a grant inside a feature record, which no class row gives.`,
          settledBy: feature ? decisionOf(feature) : null,
        },
      ];
    },
  );
}

/** A Foundry association that is no table row's first acquisition. */
function associationFindings(
  { schedule }: Comparison,
  association: FoundryAssociation,
): ScheduleFinding[] {
  const known = schedule.features.some(
    (feature) =>
      feature.externalKey === association.externalKey &&
      feature.levels[0] === association.level,
  );
  if (known) return [];
  const nonRow = schedule.foundryNonRows.some(
    ({ externalKey, level }) =>
      externalKey === association.externalKey && level === association.level,
  );
  return [
    {
      kind: nonRow ? 'nonRow' : 'unexplained',
      feature: association.externalKey,
      text: `Foundry links ${association.externalKey} at ${association.level} (${association.at}).`,
      settledBy: nonRow ? `foundryNonRow:${association.externalKey}` : null,
    },
  ];
}

/** Compares PCGen's and Foundry's schedules with the reviewed table. */
export function compareSchedule(comparison: Comparison): ScheduleFinding[] {
  const { schedule, pcgen, foundry } = comparison;
  return [
    ...pcgen.acquisitions.flatMap((acquisition) =>
      acquisitionFindings(comparison, acquisition),
    ),
    ...ungatedFindings(comparison),
    ...nestedFindings(comparison),
    ...schedule.features.flatMap((feature) => [
      ...sourceFindings(comparison, feature),
      ...incrementFindings(comparison, feature),
    ]),
    ...foundry.flatMap((association) =>
      associationFindings(comparison, association),
    ),
  ];
}
