import { z } from 'zod';
import { abilityKeys, type Ability } from '../character-sheet-abilities';
import type { NaturalAttackType } from '../character-sheet-attack-types';
import type { CreatureSize } from '../character-sheet-creature-sizes';
import type { SkillTarget } from '../character-sheet-skill-definitions';

// Representative prepared content: the original (APG) summoner's eidolon.
// The Unchained eidolon (#418) is curated separately in
// representative-unchained-eidolons.ts; neither covers Synthesist fusion
// (#250) or Master Summoner (#420). Text checked against the PRD summoner page at the URL
// below; the PRD carries no page numbers, so the evolution page range is the
// chapter's and was not verified page by page.
const prd =
  'https://legacy.aonprd.com/advancedPlayersGuide/baseClasses/summoner.html';
export const eidolonSources = [
  {
    book: 'Pathfinder RPG Advanced Player’s Guide',
    pages: '57 (Table 2–9: Eidolon Base Statistics)',
    url: `${prd}#eidolons`,
  },
  {
    book: 'Pathfinder RPG Advanced Player’s Guide',
    pages: '57–58 (base forms, eidolon skills)',
    url: `${prd}#base-forms`,
  },
  {
    book: 'Pathfinder RPG Advanced Player’s Guide',
    pages: '58–63 (evolutions; page boundaries not verified)',
    url: `${prd}#evolutions`,
  },
];

/** APG Table 2–9: Eidolon Base Statistics, summoner levels 1–20. */
export const eidolonBaseStatistics = [
  [1, 1, 2, 0, 1, 0, 0, 3, 3],
  [2, 2, 3, 0, 1, 2, 1, 4, 3],
  [3, 3, 3, 1, 2, 2, 1, 5, 3],
  [3, 3, 3, 1, 2, 2, 1, 7, 4],
  [4, 4, 4, 1, 2, 4, 2, 8, 4],
  [5, 5, 4, 1, 3, 4, 2, 9, 4],
  [6, 6, 5, 2, 3, 6, 3, 10, 4],
  [6, 6, 5, 2, 3, 6, 3, 11, 4],
  [7, 7, 5, 2, 4, 6, 3, 13, 5],
  [8, 8, 6, 2, 4, 8, 4, 14, 5],
  [9, 9, 6, 3, 5, 8, 4, 15, 5],
  [9, 9, 6, 3, 5, 10, 5, 16, 5],
  [10, 10, 7, 3, 5, 10, 5, 17, 5],
  [11, 11, 7, 3, 6, 10, 5, 19, 6],
  [12, 12, 8, 4, 6, 12, 6, 20, 6],
  [12, 12, 8, 4, 6, 12, 6, 21, 6],
  [13, 13, 8, 4, 7, 14, 7, 22, 6],
  [14, 14, 9, 4, 7, 14, 7, 23, 6],
  [15, 15, 9, 5, 8, 14, 7, 25, 7],
  [15, 15, 9, 5, 8, 16, 8, 26, 7],
].map(
  ([
    hitDice,
    bab,
    goodSave,
    badSave,
    feats,
    armorBonus,
    strengthDexterity,
    evolutionPool,
    maxAttacks,
  ]) => ({
    hitDice: hitDice ?? 0,
    bab: bab ?? 0,
    goodSave: goodSave ?? 0,
    badSave: badSave ?? 0,
    feats: feats ?? 0,
    armorBonus: armorBonus ?? 0,
    strengthDexterity: strengthDexterity ?? 0,
    evolutionPool: evolutionPool ?? 0,
    maxAttacks: maxAttacks ?? 0,
  }),
);
export type EidolonBaseStatisticsRow = (typeof eidolonBaseStatistics)[number];

/** Table 2–9 Special column, by the summoner level that grants it. */
export const eidolonFeatures = [
  { level: 1, name: 'Darkvision 60 ft.' },
  { level: 1, name: 'Link' },
  { level: 1, name: 'Share spells' },
  { level: 2, name: 'Evasion' },
  { level: 6, name: 'Devotion' },
  { level: 9, name: 'Multiattack' },
  { level: 14, name: 'Improved evasion' },
] as const;
/** Table 2–9 “Ability score increase” levels: +1 to one score each. */
export const eidolonAbilityIncreaseLevels = [5, 10, 15] as const;

export const eidolonBaseFormKeys = [
  'biped',
  'quadruped',
  'serpentine',
] as const;
export type EidolonBaseFormKey = (typeof eidolonBaseFormKeys)[number];
export type Save = 'fort' | 'ref' | 'will';
export const saveNames: Record<Save, string> = {
  fort: 'Fortitude',
  ref: 'Reflex',
  will: 'Will',
};
/** APG base forms; their free evolutions are already in these statistics. */
export const eidolonBaseForms: Record<
  EidolonBaseFormKey,
  {
    name: string;
    speed: string;
    naturalArmor: number;
    goodSaves: readonly Save[];
    scores: Record<Ability, number>;
    freeEvolutions: readonly {
      key: EidolonEvolutionKey;
      choice?: string;
    }[];
  }
> = {
  biped: {
    name: 'Biped',
    speed: '30 ft.',
    naturalArmor: 2,
    goodSaves: ['fort', 'will'],
    scores: {
      strength: 16,
      dexterity: 12,
      constitution: 13,
      intelligence: 7,
      wisdom: 10,
      charisma: 11,
    },
    freeEvolutions: [
      { key: 'claws' },
      { key: 'limbs', choice: 'arms' },
      { key: 'limbs', choice: 'legs' },
    ],
  },
  quadruped: {
    name: 'Quadruped',
    speed: '40 ft.',
    naturalArmor: 2,
    goodSaves: ['fort', 'ref'],
    scores: {
      strength: 14,
      dexterity: 14,
      constitution: 13,
      intelligence: 7,
      wisdom: 10,
      charisma: 11,
    },
    freeEvolutions: [
      { key: 'bite' },
      { key: 'limbs', choice: 'legs' },
      { key: 'limbs', choice: 'legs' },
    ],
  },
  serpentine: {
    name: 'Serpentine',
    speed: '20 ft., climb 20 ft.',
    naturalArmor: 2,
    goodSaves: ['ref', 'will'],
    scores: {
      strength: 12,
      dexterity: 16,
      constitution: 13,
      intelligence: 7,
      wisdom: 10,
      charisma: 11,
    },
    freeEvolutions: [
      { key: 'bite' },
      { key: 'climb' },
      { key: 'reach', choice: 'bite' },
      { key: 'tail' },
      { key: 'tailSlap' },
    ],
  },
};
/** Any base form may instead be Small (APG base forms). */
export type SizeAdjustment = {
  scores: readonly { ability: Ability; value: number }[];
  skills: readonly { skill: SkillTarget; value: number }[];
};
export const smallEidolonAdjustments: SizeAdjustment = {
  scores: [
    { ability: 'strength', value: -4 },
    { ability: 'dexterity', value: 2 },
    { ability: 'constitution', value: -2 },
  ],
  skills: [
    { skill: 'skill.fly', value: 2 },
    { skill: 'skill.ste', value: 4 },
  ],
};

/** Eidolon class skills plus 4 summoner-chosen skills at 1st level. */
export const eidolonClassSkills = [
  'blf',
  'crf',
  'kpl',
  'per',
  'sen',
  'ste',
] as const;
export const eidolonChosenClassSkillCount = 4;

const energy = ['acid', 'cold', 'electricity', 'fire'] as const;
const labelled = (
  values: readonly string[],
  labels: Partial<Record<string, string>> = {},
) =>
  values.map((value) => ({
    value,
    label: labels[value] ?? value.charAt(0).toUpperCase() + value.slice(1),
  }));
const attackLabels = { tailSlap: 'Tail slap' };
export const eidolonChoiceOptions = {
  ability: labelled(abilityKeys),
  energy: labelled(energy),
  energyOrSonic: labelled([...energy, 'sonic']),
  alignment: labelled(['chaotic', 'evil', 'good', 'lawful']),
  limbs: labelled(['arms', 'legs']),
  flight: labelled(['wings', 'magic']),
  clawReplacement: labelled(['additional', 'replacesBaseClaws'], {
    replacesBaseClaws: 'Replaces the base form’s claws',
  }),
  attack: labelled(
    [
      'bite',
      'claw',
      'gore',
      'pincer',
      'slam',
      'sting',
      'tailSlap',
      'tentacle',
      'wing',
    ],
    attackLabels,
  ),
  grab: labelled(
    ['bite', 'claw', 'pincer', 'slam', 'tailSlap', 'tentacle'],
    attackLabels,
  ),
  poison: labelled(['bite', 'sting']),
} satisfies Record<string, readonly { value: string; label: string }[]>;
export type EidolonChoiceKind = keyof typeof eidolonChoiceOptions | 'skill';

type DiceBySize = Partial<Record<CreatureSize, string>>;
const biteDice: DiceBySize = {
  small: '1d4',
  medium: '1d6',
  large: '1d8',
  huge: '2d6',
};
const clawDice: DiceBySize = {
  small: '1d3',
  medium: '1d4',
  large: '1d6',
  huge: '1d8',
};
/** An evolution, and the choice it must have been made with, if any. */
export type EvolutionReference = { key: EidolonEvolutionKey; choice?: string };
export type EvolutionDefinition = {
  name: string;
  cost: 1 | 2 | 3 | 4;
  summary: string;
  minimumLevel?: number;
  baseForms?: readonly EidolonBaseFormKey[];
  /** Unless noted, an evolution is selected once (APG Evolutions). */
  repeat?: 'any' | 'distinctChoice';
  choice?: EidolonChoiceKind;
  choiceCosts?: Partial<Record<string, number>>;
  upgrade?: {
    cost: number;
    max: number;
    label: string;
    minimumLevel?: number;
  };
  requires?: readonly EvolutionReference[];
  /** Selections may not exceed the eidolon’s count of these evolutions. */
  limitedBy?: EvolutionReference;
  attack?: {
    type: NaturalAttackType;
    count: number;
    role: 'primary' | 'secondary';
    dice: DiceBySize;
  };
  /** Rake counts as one natural attack toward the maximum. */
  attackCount?: number;
};
export const eidolonEvolutionKeys = [
  'bite',
  'claws',
  'climb',
  'gills',
  'improvedDamage',
  'improvedNaturalArmor',
  'magicAttacks',
  'mount',
  'pincers',
  'pounce',
  'pull',
  'push',
  'reach',
  'resistance',
  'scent',
  'skilled',
  'slam',
  'sting',
  'swim',
  'tail',
  'tailSlap',
  'tentacle',
  'wingBuffet',
  'abilityIncrease',
  'constrict',
  'energyAttacks',
  'flight',
  'gore',
  'grab',
  'immunity',
  'limbs',
  'poison',
  'rake',
  'rend',
  'trample',
  'tremorsense',
  'trip',
  'weaponTraining',
  'blindsense',
  'burrow',
  'damageReduction',
  'frightfulPresence',
  'swallowWhole',
  'web',
  'blindsight',
  'breathWeapon',
  'fastHealing',
  'large',
  'spellResistance',
] as const;
export type EidolonEvolutionKey = (typeof eidolonEvolutionKeys)[number];
export const eidolonEvolutionKeySchema = z.enum(eidolonEvolutionKeys);

/** The complete APG evolution list; effects outside the sheet stay prose. */
export const eidolonEvolutions: Record<
  EidolonEvolutionKey,
  EvolutionDefinition
> = {
  bite: {
    name: 'Bite',
    cost: 1,
    summary:
      'Primary bite. If the eidolon already has a bite, it adds 1½ times its Strength modifier to bite damage instead.',
    attack: { type: 'bite', count: 1, role: 'primary', dice: biteDice },
  },
  claws: {
    name: 'Claws',
    cost: 1,
    summary: 'Two primary claws on one pair of limbs.',
    repeat: 'any',
    limitedBy: { key: 'limbs' },
    attack: { type: 'claw', count: 2, role: 'primary', dice: clawDice },
  },
  climb: {
    name: 'Climb',
    cost: 1,
    summary:
      'Climb speed equal to base speed; each further selection adds 20 ft.',
    repeat: 'any',
  },
  gills: { name: 'Gills', cost: 1, summary: 'Breathes underwater.' },
  improvedDamage: {
    name: 'Improved Damage',
    cost: 1,
    summary: 'One natural attack’s damage die increases by one step.',
    repeat: 'distinctChoice',
    choice: 'attack',
  },
  improvedNaturalArmor: {
    name: 'Improved Natural Armor',
    cost: 1,
    summary: '+2 natural armor; once for every five summoner levels.',
    repeat: 'any',
  },
  magicAttacks: {
    name: 'Magic Attacks',
    cost: 1,
    summary:
      'Natural attacks count as magic; from summoner level 10 also as the eidolon’s alignment.',
  },
  mount: {
    name: 'Mount',
    cost: 1,
    summary:
      'Serves as a combat-trained mount at least one size larger than its rider.',
    baseForms: ['quadruped', 'serpentine'],
  },
  pincers: {
    name: 'Pincers',
    cost: 1,
    summary:
      'Two secondary pincers on a pair of arms, or replacing the base form’s claws.',
    repeat: 'any',
    choice: 'clawReplacement',
    limitedBy: { key: 'limbs', choice: 'arms' },
    attack: { type: 'pincer', count: 2, role: 'secondary', dice: biteDice },
  },
  pounce: {
    name: 'Pounce',
    cost: 1,
    summary: 'Full attack after a charge.',
    baseForms: ['quadruped'],
  },
  pull: {
    name: 'Pull',
    cost: 1,
    summary: 'A chosen natural attack can pull the target 5 ft. closer.',
    repeat: 'distinctChoice',
    choice: 'attack',
  },
  push: {
    name: 'Push',
    cost: 1,
    summary: 'A chosen natural attack can push the target 5 ft. away.',
    repeat: 'distinctChoice',
    choice: 'attack',
  },
  reach: {
    name: 'Reach',
    cost: 1,
    summary: 'One chosen attack’s reach increases by 5 ft.',
    choice: 'attack',
  },
  resistance: {
    name: 'Resistance',
    cost: 1,
    summary:
      'Resist 5 to one energy type, 10 from summoner level 5 and 15 from level 10.',
    repeat: 'distinctChoice',
    choice: 'energyOrSonic',
  },
  scent: { name: 'Scent', cost: 1, summary: 'Gains scent.' },
  skilled: {
    name: 'Skilled',
    cost: 1,
    summary: '+8 racial bonus on one skill.',
    repeat: 'distinctChoice',
    choice: 'skill',
  },
  slam: {
    name: 'Slam',
    cost: 1,
    summary:
      'Primary slam on a pair of arms, or replacing the base form’s claws.',
    repeat: 'any',
    choice: 'clawReplacement',
    limitedBy: { key: 'limbs', choice: 'arms' },
    attack: {
      type: 'slam',
      count: 1,
      role: 'primary',
      dice: { small: '1d6', medium: '1d8', large: '2d6', huge: '2d8' },
    },
  },
  sting: {
    name: 'Sting',
    cost: 1,
    summary: 'Primary sting at the end of a tail.',
    repeat: 'any',
    limitedBy: { key: 'tail' },
    attack: { type: 'sting', count: 1, role: 'primary', dice: clawDice },
  },
  swim: {
    name: 'Swim',
    cost: 1,
    summary:
      'Swim speed equal to base speed; each further selection adds 20 ft.',
    repeat: 'any',
  },
  tail: {
    name: 'Tail',
    cost: 1,
    summary: '+2 racial bonus on Acrobatics checks to balance.',
    repeat: 'any',
  },
  tailSlap: {
    name: 'Tail Slap',
    cost: 1,
    summary: 'Secondary tail slap.',
    repeat: 'any',
    limitedBy: { key: 'tail' },
    attack: { type: 'tailSlap', count: 1, role: 'secondary', dice: biteDice },
  },
  tentacle: {
    name: 'Tentacle',
    cost: 1,
    summary: 'Secondary tentacle.',
    repeat: 'any',
    attack: { type: 'tentacle', count: 1, role: 'secondary', dice: clawDice },
  },
  wingBuffet: {
    name: 'Wing Buffet',
    cost: 1,
    summary: 'Two secondary wing buffets; needs flight with wings.',
    requires: [{ key: 'flight', choice: 'wings' }],
    attack: { type: 'wing', count: 2, role: 'secondary', dice: clawDice },
  },
  abilityIncrease: {
    name: 'Ability Increase',
    cost: 2,
    summary:
      '+2 to one ability score; once per score plus once more for every 6 summoner levels. Costs 4 for Strength or Constitution of a Large or Huge eidolon.',
    repeat: 'any',
    choice: 'ability',
  },
  constrict: {
    name: 'Constrict',
    cost: 2,
    summary: 'Grab damage again when grappling.',
    baseForms: ['serpentine'],
  },
  energyAttacks: {
    name: 'Energy Attacks',
    cost: 2,
    summary: 'Natural attacks deal 1d6 of one energy type.',
    minimumLevel: 5,
    choice: 'energy',
  },
  flight: {
    name: 'Flight',
    cost: 2,
    summary:
      'Fly speed equal to base speed. Flying by magic costs 2 more; each further point adds 20 ft. of fly speed.',
    minimumLevel: 5,
    choice: 'flight',
    choiceCosts: { magic: 2 },
    upgrade: { cost: 1, max: 20, label: '+20 ft. fly speed' },
  },
  gore: {
    name: 'Gore',
    cost: 2,
    summary: 'Primary gore.',
    attack: { type: 'gore', count: 1, role: 'primary', dice: biteDice },
  },
  grab: {
    name: 'Grab',
    cost: 2,
    summary: 'Grab with one chosen attack type; +4 CMB to grapple.',
    choice: 'grab',
  },
  immunity: {
    name: 'Immunity',
    cost: 2,
    summary: 'Immunity to one energy type.',
    minimumLevel: 7,
    repeat: 'distinctChoice',
    choice: 'energyOrSonic',
  },
  limbs: {
    name: 'Limbs',
    cost: 2,
    summary: 'A pair of legs (+10 ft. base speed) or arms with hands.',
    repeat: 'any',
    choice: 'limbs',
  },
  poison: {
    name: 'Poison',
    cost: 2,
    summary:
      'A bite or sting poisons (1d4 Str damage); 2 more points make it Constitution damage.',
    minimumLevel: 7,
    choice: 'poison',
    upgrade: { cost: 2, max: 1, label: 'Constitution damage' },
  },
  rake: {
    name: 'Rake',
    cost: 2,
    summary:
      'Two rakes against a grappled foe; counts as one natural attack toward the maximum.',
    minimumLevel: 4,
    baseForms: ['quadruped'],
    attackCount: 1,
  },
  rend: {
    name: 'Rend',
    cost: 2,
    summary: 'Extra damage after two claw hits on one target.',
    minimumLevel: 6,
    requires: [{ key: 'claws' }],
  },
  trample: {
    name: 'Trample',
    cost: 2,
    summary: 'Trample creatures at least one size smaller.',
    baseForms: ['biped', 'quadruped'],
  },
  tremorsense: {
    name: 'Tremorsense',
    cost: 2,
    summary: 'Tremorsense 30 ft.',
    minimumLevel: 7,
  },
  trip: {
    name: 'Trip',
    cost: 2,
    summary: 'A successful bite allows a free trip attempt.',
    requires: [{ key: 'bite' }],
  },
  weaponTraining: {
    name: 'Weapon Training',
    cost: 2,
    summary:
      'Simple Weapon Proficiency; 2 more points add all martial weapons.',
    upgrade: { cost: 2, max: 1, label: 'Martial Weapon Proficiency' },
  },
  blindsense: {
    name: 'Blindsense',
    cost: 3,
    summary: 'Blindsense 30 ft.',
    minimumLevel: 9,
  },
  burrow: {
    name: 'Burrow',
    cost: 3,
    summary: 'Burrow speed equal to half base speed.',
    minimumLevel: 9,
  },
  damageReduction: {
    name: 'Damage Reduction',
    cost: 3,
    summary:
      'DR 5 bypassed by one opposed alignment; 2 more points make it DR 10 from summoner level 12.',
    minimumLevel: 9,
    choice: 'alignment',
    upgrade: { cost: 2, max: 1, label: 'DR 10', minimumLevel: 12 },
  },
  frightfulPresence: {
    name: 'Frightful Presence',
    cost: 3,
    summary: 'Frightful presence within 30 ft.',
    minimumLevel: 11,
  },
  swallowWhole: {
    name: 'Swallow Whole',
    cost: 3,
    summary: 'Swallow a creature grabbed with its bite.',
    minimumLevel: 9,
    requires: [{ key: 'grab', choice: 'bite' }],
  },
  web: {
    name: 'Web',
    cost: 3,
    summary: 'Spins webs; needs the climb evolution.',
    minimumLevel: 7,
    requires: [{ key: 'climb' }],
  },
  blindsight: {
    name: 'Blindsight',
    cost: 4,
    summary: 'Blindsight 30 ft.; needs blindsense.',
    minimumLevel: 11,
    requires: [{ key: 'blindsense' }],
  },
  breathWeapon: {
    name: 'Breath Weapon',
    cost: 4,
    summary:
      '1d6 per HD of one energy type once per day; each further point adds a use (maximum 3/day).',
    minimumLevel: 9,
    choice: 'energy',
    upgrade: { cost: 1, max: 2, label: 'Additional daily use' },
  },
  fastHealing: {
    name: 'Fast Healing',
    cost: 4,
    summary: 'Fast healing 1; every 2 more points add 1 (maximum 5).',
    minimumLevel: 11,
    upgrade: { cost: 2, max: 4, label: '+1 fast healing' },
  },
  large: {
    name: 'Large',
    cost: 4,
    summary:
      'Large: +8 Str, +4 Con, −2 Dex, +2 natural armor. 6 more points make it Huge instead: +16 Str, +8 Con, −4 Dex, +5 natural armor.',
    minimumLevel: 8,
    upgrade: { cost: 6, max: 1, label: 'Huge', minimumLevel: 13 },
  },
  spellResistance: {
    name: 'Spell Resistance',
    cost: 4,
    summary: 'Spell resistance 11 + summoner level.',
    minimumLevel: 9,
  },
};

/** The label of a non-skill choice an evolution offers, if it offers it. */
export function eidolonChoiceOptionLabel(
  key: EidolonEvolutionKey,
  value: string,
) {
  const kind = eidolonEvolutions[key].choice;
  return kind && kind !== 'skill'
    ? eidolonChoiceOptions[kind].find((option) => option.value === value)?.label
    : undefined;
}

/** Large and Huge replace, and do not stack with, each other (APG Large). */
export const eidolonSizeEvolutions: Record<
  'large' | 'huge',
  SizeAdjustment & { size: CreatureSize; naturalArmor: number }
> = {
  large: {
    size: 'large',
    scores: [
      { ability: 'strength', value: 8 },
      { ability: 'constitution', value: 4 },
      { ability: 'dexterity', value: -2 },
    ],
    naturalArmor: 2,
    skills: [
      { skill: 'skill.fly', value: -2 },
      { skill: 'skill.ste', value: -4 },
    ],
  },
  huge: {
    size: 'huge',
    scores: [
      { ability: 'strength', value: 16 },
      { ability: 'constitution', value: 8 },
      { ability: 'dexterity', value: -4 },
    ],
    naturalArmor: 5,
    skills: [
      { skill: 'skill.fly', value: -4 },
      { skill: 'skill.ste', value: -8 },
    ],
  },
};
