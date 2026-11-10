import { abilityKeys } from '../character-sheet-abilities';
import {
  eidolonBaseFormKeys,
  eidolonBaseStatistics,
  eidolonChoiceOptions,
  eidolonEvolutions,
  type EidolonBaseFormKey,
  type EidolonEvolutionKey,
  type EvolutionDefinition,
  type EvolutionReference,
  type SizeAdjustment,
} from './representative-eidolons';
import type { CreatureSize } from '../character-sheet-creature-sizes';

// Representative prepared content: the Unchained summoner's eidolon, curated
// apart from the original (APG) eidolon. Text was checked against the legacy
// PRD Unchained summoner page, which prints no page numbers; the pages below
// follow Archives of Nethys' source lines. AoN gives no page for the Eidolon
// Base Statistics table, which the PRD prints between the class features
// (p. 25) and the subtypes (p. 29), so its page range is unverified. These
// values were checked against the PRD text: the subtypes' pool points, the
// archon's Skilled (Intimidate) until 16th, the protean's two grabs, Pounce
// (3 points, 7th level), Damage Reduction (3 points, 15th level) and Large
// and Huge (+4/+2 and +8/+4 Str/Con).
// Only the twelve subtypes printed in Pathfinder Unchained are curated; later
// books' subtypes (such as kami) and Unchained summoner archetypes are not.
const legacy = 'https://legacy.aonprd.com/unchained/classes/summoner.html';
const unchained = 'Pathfinder Unchained';
export const unchainedEidolonSources = [
  {
    book: unchained,
    pages: '25 (summoner; the eidolon’s subtype)',
    url: legacy,
  },
  {
    book: unchained,
    pages: '25–29 (Eidolon Base Statistics; page not verified)',
    url: `${legacy}#eidolon-base-statistics`,
  },
  {
    book: unchained,
    pages: '29–34 (eidolon subtypes)',
    url: 'https://aonprd.com/EidolonUCSubtypes.aspx',
  },
  {
    book: unchained,
    pages: '34 (base forms)',
    url: 'https://aonprd.com/EidolonUCBaseForms.aspx',
  },
  {
    book: unchained,
    pages: '35–39 (evolutions)',
    url: 'https://aonprd.com/SummonerUCEvolutions.aspx',
  },
];

/**
 * Pathfinder Unchained, Eidolon Base Statistics, summoner levels 1–20. Every
 * column matches APG Table 2–9 except the Evolution Pool, which equals the HD
 * column: smaller than the APG pool, because the subtype supplies evolutions
 * of its own.
 */
const unchainedEvolutionPools = [
  1, 2, 3, 3, 4, 5, 6, 6, 7, 8, 9, 9, 10, 11, 12, 12, 13, 14, 15, 15,
];
export const unchainedEidolonBaseStatistics = eidolonBaseStatistics.map(
  (row, index) => ({
    ...row,
    evolutionPool: unchainedEvolutionPools[index] ?? 0,
  }),
);

export const unchainedEidolonSubtypeKeys = [
  'agathion',
  'angel',
  'archon',
  'azata',
  'daemon',
  'demon',
  'devil',
  'div',
  'elemental',
  'inevitable',
  'protean',
  'psychopomp',
] as const;
export type UnchainedEidolonSubtypeKey =
  (typeof unchainedEidolonSubtypeKeys)[number];
export const unchainedEidolonElements = [
  'air',
  'earth',
  'fire',
  'water',
] as const;
export type UnchainedEidolonElement = (typeof unchainedEidolonElements)[number];

/**
 * The choices a subtype asks the summoner to make. Each choice belongs to its
 * subtype, so it survives a change of subtype and returns with it.
 */
export const unchainedSubtypeChoiceKeys = [
  'elemental-element',
  'archon-abilityIncrease-8',
  'azata-abilityIncrease-16',
  'demon-abilityIncrease-12',
  'psychopomp-abilityIncrease-16',
  'protean-grab-1',
] as const;
export type UnchainedSubtypeChoiceKey =
  (typeof unchainedSubtypeChoiceKeys)[number];
const labelled = (values: readonly string[]) =>
  values.map((value) => ({
    value,
    label: value.charAt(0).toUpperCase() + value.slice(1),
  }));
export const unchainedSubtypeChoiceOptions: Record<
  UnchainedSubtypeChoiceKey,
  {
    subtype: UnchainedEidolonSubtypeKey;
    label: string;
    options: readonly { value: string; label: string }[];
  }
> = {
  'elemental-element': {
    subtype: 'elemental',
    label: 'Element',
    options: labelled(unchainedEidolonElements),
  },
  'archon-abilityIncrease-8': {
    subtype: 'archon',
    label: 'Ability Increase (8th level)',
    options: labelled(abilityKeys),
  },
  'azata-abilityIncrease-16': {
    subtype: 'azata',
    label: 'Ability Increase (16th level)',
    options: labelled(abilityKeys),
  },
  'demon-abilityIncrease-12': {
    subtype: 'demon',
    label: 'Ability Increase (12th level)',
    options: labelled(abilityKeys),
  },
  'psychopomp-abilityIncrease-16': {
    subtype: 'psychopomp',
    label: 'Ability Increase (16th level)',
    options: labelled(abilityKeys),
  },
  'protean-grab-1': {
    subtype: 'protean',
    label: 'Grab attack',
    options: eidolonChoiceOptions.grab,
  },
};

/** An evolution the subtype grants for free from a summoner level. */
export type UnchainedFixedEvolution = {
  id: string;
  level: number;
  /** The subtype replaces it from this level (resistance becomes immunity). */
  until?: number;
  key: EidolonEvolutionKey;
  choice?: string;
  /** The summoner chooses, recorded under this key. */
  choiceKey?: UnchainedSubtypeChoiceKey;
  upgrades?: number;
  /** Elemental eidolons gain it only for this element. */
  element?: UnchainedEidolonElement;
  /** Repeated selections, such as water's two swim evolutions. */
  count?: number;
};
type Feature = {
  level: number;
  until?: number;
  text: string;
  element?: UnchainedEidolonElement;
};
type DamageReduction = {
  level: number;
  amount: number;
  bypass: string;
  element?: UnchainedEidolonElement;
};
type Subtype = {
  name: string;
  alignment: string;
  pages: string;
  baseForms: Partial<Record<EidolonBaseFormKey, readonly EvolutionReference[]>>;
  evolutions: readonly UnchainedFixedEvolution[];
  poolBonuses: readonly { level: number; points: number }[];
  damageReduction: readonly DamageReduction[];
  features: readonly Feature[];
};

const bipedClaws: readonly EvolutionReference[] = [
  { key: 'claws' },
  { key: 'limbs', choice: 'arms' },
  { key: 'limbs', choice: 'legs' },
];
const bipedSlam: readonly EvolutionReference[] = [
  { key: 'limbs', choice: 'arms' },
  { key: 'limbs', choice: 'legs' },
  { key: 'slam' },
];
const quadrupedBite: readonly EvolutionReference[] = [
  { key: 'limbs', choice: 'legs' },
  { key: 'limbs', choice: 'legs' },
  { key: 'bite' },
];
const fixed = (
  subtype: UnchainedEidolonSubtypeKey,
  level: number,
  key: EidolonEvolutionKey,
  extra: Omit<UnchainedFixedEvolution, 'id' | 'level' | 'key'> = {},
): UnchainedFixedEvolution => ({
  id: `${subtype}-${key}${extra.choice ? `-${extra.choice}` : ''}${extra.element ? `-${extra.element}` : ''}-${level}`,
  level,
  key,
  ...extra,
});
/** Resistance at 1st level, replaced by immunity at 16th. */
const resistanceToImmunity = (
  subtype: UnchainedEidolonSubtypeKey,
  energy: string,
) => [
  fixed(subtype, 1, 'resistance', { choice: energy, until: 16 }),
  fixed(subtype, 16, 'immunity', { choice: energy }),
];
const truespeech = (subtype: string) =>
  `Immunity to petrification and truespeech (see the ${subtype} subtype)`;

/** The twelve subtypes printed in Pathfinder Unchained, pp. 29–34. */
export const unchainedEidolonSubtypes: Record<
  UnchainedEidolonSubtypeKey,
  Subtype
> = {
  agathion: {
    name: 'Agathion',
    alignment: 'Neutral good',
    pages: '29',
    baseForms: { biped: bipedClaws, quadruped: quadrupedBite },
    evolutions: resistanceToImmunity('agathion', 'electricity'),
    poolBonuses: [],
    damageReduction: [
      { level: 12, amount: 5, bypass: 'evil' },
      { level: 20, amount: 10, bypass: 'evil' },
    ],
    features: [
      { level: 1, text: '+4 on saves against poison and petrification' },
      { level: 4, text: 'Cold resistance 10 and sonic resistance 10' },
      { level: 8, text: 'Lay on hands as a paladin of its Hit Dice' },
      { level: 12, text: truespeech('agathion') },
      { level: 16, text: 'Speak with animals (see the agathion subtype)' },
      { level: 20, text: 'Detect thoughts at will' },
    ],
  },
  angel: {
    name: 'Angel',
    alignment: 'Any good',
    pages: '30',
    baseForms: { biped: bipedSlam },
    evolutions: [
      ...resistanceToImmunity('angel', 'acid'),
      ...resistanceToImmunity('angel', 'cold'),
      fixed('angel', 8, 'flight', { choice: 'wings' }),
    ],
    poolBonuses: [],
    damageReduction: [{ level: 12, amount: 5, bypass: 'evil' }],
    features: [
      { level: 1, text: '+4 on saves against poison' },
      { level: 4, text: 'Electricity resistance 10 and fire resistance 10' },
      { level: 12, text: truespeech('angel') },
      { level: 20, text: 'Protective aura (see the angel subtype)' },
    ],
  },
  archon: {
    name: 'Archon',
    alignment: 'Lawful good',
    pages: '30',
    baseForms: { biped: bipedSlam },
    evolutions: [
      ...resistanceToImmunity('archon', 'electricity'),
      fixed('archon', 1, 'skilled', { choice: 'skill.int', until: 16 }),
      fixed('archon', 8, 'abilityIncrease', {
        choiceKey: 'archon-abilityIncrease-8',
      }),
    ],
    poolBonuses: [{ level: 4, points: 1 }],
    damageReduction: [{ level: 12, amount: 5, bypass: 'evil' }],
    features: [
      { level: 1, text: '+4 on saves against poison' },
      { level: 12, text: truespeech('archon') },
      { level: 16, text: 'Aura of menace (see the archon subtype)' },
      {
        level: 20,
        text: 'Greater teleport at will (CL 14th), itself and 50 lbs. only',
      },
    ],
  },
  azata: {
    name: 'Azata',
    alignment: 'Chaotic good',
    pages: '30',
    baseForms: {
      biped: [
        { key: 'limbs', choice: 'arms' },
        { key: 'limbs', choice: 'legs' },
      ],
      serpentine: [
        { key: 'limbs', choice: 'arms' },
        { key: 'tail' },
        { key: 'tailSlap' },
      ],
    },
    evolutions: [
      ...resistanceToImmunity('azata', 'electricity'),
      // The 4-point weapon training evolution: martial weapons too.
      fixed('azata', 1, 'weaponTraining', { upgrades: 1 }),
      fixed('azata', 8, 'flight', { choice: 'wings' }),
      fixed('azata', 16, 'abilityIncrease', {
        choiceKey: 'azata-abilityIncrease-16',
      }),
    ],
    poolBonuses: [],
    damageReduction: [{ level: 12, amount: 5, bypass: 'evil' }],
    features: [
      { level: 4, text: 'Cold resistance 10 and fire resistance 10' },
      { level: 12, text: truespeech('azata') },
      { level: 20, text: 'Energy form: incorporeal with doubled fly speed' },
    ],
  },
  daemon: {
    name: 'Daemon',
    alignment: 'Neutral evil',
    pages: '31',
    baseForms: {
      biped: bipedClaws,
      quadruped: quadrupedBite,
      serpentine: [
        { key: 'bite' },
        { key: 'reach', choice: 'bite' },
        { key: 'reach', choice: 'sting' },
        { key: 'sting' },
        { key: 'tail' },
      ],
    },
    evolutions: resistanceToImmunity('daemon', 'acid'),
    poolBonuses: [{ level: 8, points: 1 }],
    damageReduction: [{ level: 12, amount: 5, bypass: 'good' }],
    features: [
      {
        level: 1,
        until: 12,
        text: '+4 on saves against death effects, disease and poison',
      },
      {
        level: 4,
        text: 'Cold, electricity and fire resistance 10',
      },
      { level: 12, text: 'Immunity to death effects, disease and poison' },
      { level: 16, text: 'Telepathy' },
      { level: 20, text: 'Devour soul (see the daemon subtype)' },
    ],
  },
  demon: {
    name: 'Demon',
    alignment: 'Chaotic evil',
    pages: '31',
    baseForms: {
      biped: bipedClaws,
      quadruped: quadrupedBite,
      serpentine: [
        { key: 'bite' },
        { key: 'improvedDamage', choice: 'bite' },
        { key: 'reach', choice: 'bite' },
        { key: 'tail' },
        { key: 'tailSlap' },
      ],
    },
    evolutions: [
      ...resistanceToImmunity('demon', 'electricity'),
      fixed('demon', 1, 'resistance', { choice: 'fire' }),
      fixed('demon', 12, 'abilityIncrease', {
        choiceKey: 'demon-abilityIncrease-12',
      }),
    ],
    poolBonuses: [{ level: 8, points: 1 }],
    damageReduction: [{ level: 12, amount: 5, bypass: 'good' }],
    features: [
      { level: 1, until: 8, text: '+4 on saves against poison' },
      { level: 4, text: 'Acid resistance 10 and cold resistance 10' },
      { level: 8, text: 'Immunity to poison' },
      { level: 16, text: 'Telepathy' },
      { level: 20, text: 'Constant true seeing' },
    ],
  },
  devil: {
    name: 'Devil',
    alignment: 'Lawful evil',
    pages: '32',
    baseForms: { biped: bipedClaws },
    evolutions: [
      ...resistanceToImmunity('devil', 'fire'),
      fixed('devil', 1, 'skilled', { choice: 'skill.blf' }),
      fixed('devil', 8, 'skilled', { choice: 'skill.dip' }),
    ],
    poolBonuses: [],
    damageReduction: [{ level: 12, amount: 5, bypass: 'good' }],
    features: [
      { level: 1, until: 8, text: '+4 on saves against poison' },
      { level: 4, text: 'Acid resistance 10 and cold resistance 10' },
      { level: 8, text: 'Immunity to poison' },
      { level: 12, text: 'See in darkness (see the devil subtype)' },
      { level: 16, text: 'Telepathy' },
      { level: 20, text: 'Regeneration 5 (good weapons, good spells)' },
    ],
  },
  div: {
    name: 'Div',
    alignment: 'Neutral evil',
    pages: '32',
    baseForms: { biped: bipedClaws },
    evolutions: resistanceToImmunity('div', 'fire'),
    poolBonuses: [{ level: 8, points: 1 }],
    damageReduction: [{ level: 12, amount: 5, bypass: 'good' }],
    features: [
      { level: 1, until: 8, text: '+4 on saves against poison' },
      { level: 4, text: 'Acid resistance 10 and electricity resistance 10' },
      { level: 8, text: 'Immunity to poison' },
      { level: 12, text: 'See in darkness (see the div subtype)' },
      { level: 16, text: 'Telepathy' },
      {
        level: 20,
        text: 'Greater teleport at will (CL 14th), itself and 50 lbs. only',
      },
    ],
  },
  elemental: {
    name: 'Elemental',
    alignment: 'Neutral',
    pages: '33',
    baseForms: {
      biped: bipedSlam,
      quadruped: quadrupedBite,
      serpentine: [
        { key: 'bite' },
        { key: 'improvedNaturalArmor' },
        { key: 'reach', choice: 'bite' },
        { key: 'tail' },
        { key: 'tailSlap' },
      ],
    },
    evolutions: [
      fixed('elemental', 1, 'immunity', {
        choice: 'electricity',
        element: 'air',
      }),
      fixed('elemental', 1, 'immunity', { choice: 'acid', element: 'earth' }),
      fixed('elemental', 1, 'immunity', { choice: 'fire', element: 'fire' }),
      fixed('elemental', 1, 'immunity', { choice: 'cold', element: 'water' }),
      fixed('elemental', 8, 'flight', { choice: 'magic', element: 'air' }),
      fixed('elemental', 8, 'burrow', { element: 'earth' }),
      fixed('elemental', 8, 'swim', { element: 'water', count: 2 }),
      fixed('elemental', 8, 'gills', { element: 'water' }),
      fixed('elemental', 20, 'energyAttacks', {
        choice: 'fire',
        element: 'fire',
      }),
    ],
    poolBonuses: [{ level: 4, points: 1 }],
    damageReduction: [{ level: 20, amount: 5, bypass: '—', element: 'earth' }],
    features: [
      { level: 1, text: 'Immunity to paralysis and sleep' },
      { level: 8, text: '+20 ft. base speed', element: 'fire' },
      {
        level: 12,
        text: 'Immunity to bleed, poison and stun; cannot be flanked',
      },
      {
        level: 16,
        text: 'Immunity to critical hits and precision damage',
      },
      { level: 20, text: 'Whirlwind', element: 'air' },
      { level: 20, text: 'Earth mastery', element: 'earth' },
      { level: 20, text: 'Burn', element: 'fire' },
      { level: 20, text: 'Drench and vortex', element: 'water' },
    ],
  },
  inevitable: {
    name: 'Inevitable',
    alignment: 'Lawful neutral',
    pages: '33',
    baseForms: { biped: bipedSlam },
    evolutions: [],
    poolBonuses: [],
    damageReduction: [{ level: 12, amount: 5, bypass: 'chaotic' }],
    features: [
      {
        level: 1,
        text: 'Counts as a construct and an outsider for effects such as bane',
      },
      {
        level: 1,
        text: '+4 on saves against death effects, disease, necromancy effects, paralysis, poison, sleep and stun',
      },
      {
        level: 4,
        text: '+4 on saves against mind-affecting effects; immunity to nonlethal damage, fatigue and exhaustion',
      },
      { level: 8, text: 'Immunity to death effects, disease and poison' },
      {
        level: 12,
        text: 'Immunity to sleep and truespeech (see the inevitable subtype)',
      },
      {
        level: 16,
        text: 'Immunity to ability damage, ability drain, energy drain and necromancy effects',
      },
      {
        level: 20,
        text: 'Immunity to paralysis, sleep, stun and effects requiring a Fortitude save',
      },
    ],
  },
  protean: {
    name: 'Protean',
    alignment: 'Chaotic neutral',
    pages: '33',
    baseForms: {
      serpentine: [
        { key: 'bite' },
        { key: 'grab', choice: 'tailSlap' },
        { key: 'tail' },
        { key: 'tailSlap' },
      ],
    },
    evolutions: [
      ...resistanceToImmunity('protean', 'acid'),
      // Besides the base form's grab (tail slap): “the grab evolution, tied
      // to an attack type of the summoner's choice”.
      fixed('protean', 1, 'grab', { choiceKey: 'protean-grab-1' }),
      fixed('protean', 8, 'constrict'),
      fixed('protean', 12, 'blindsense'),
      // “As the flight evolution with 4 points spent”: flight by magic.
      fixed('protean', 12, 'flight', { choice: 'magic' }),
    ],
    poolBonuses: [],
    damageReduction: [{ level: 12, amount: 5, bypass: 'lawful' }],
    features: [
      { level: 4, text: 'Electricity resistance 10 and sonic resistance 10' },
      { level: 16, text: 'Amorphous anatomy (see the protean subtype)' },
      {
        level: 20,
        text: 'Constant freedom of movement and change shape (greater polymorph)',
      },
    ],
  },
  psychopomp: {
    name: 'Psychopomp',
    alignment: 'Neutral',
    pages: '34',
    baseForms: {
      biped: bipedSlam,
      quadruped: quadrupedBite,
      serpentine: [
        { key: 'bite' },
        { key: 'pull', choice: 'bite' },
        { key: 'reach', choice: 'bite' },
        { key: 'tail' },
        { key: 'tailSlap' },
      ],
    },
    evolutions: [
      fixed('psychopomp', 16, 'abilityIncrease', {
        choiceKey: 'psychopomp-abilityIncrease-16',
      }),
      fixed('psychopomp', 20, 'immunity', { choice: 'cold' }),
      fixed('psychopomp', 20, 'immunity', { choice: 'electricity' }),
    ],
    poolBonuses: [{ level: 8, points: 1 }],
    damageReduction: [
      { level: 12, amount: 5, bypass: 'adamantine' },
      { level: 20, amount: 10, bypass: 'adamantine' },
    ],
    features: [
      { level: 1, text: 'Immunity to death effects, disease and poison' },
      { level: 4, text: 'Cold resistance 10 and electricity resistance 10' },
      { level: 8, text: 'Spirit touch (see the psychopomp subtype)' },
      { level: 12, text: 'Spiritsense (see the psychopomp subtype)' },
      { level: 16, text: 'Invisibility (self only) at will' },
    ],
  },
};

/** An Unchained evolution's requirements beyond those it shares with the APG. */
export type UnchainedEvolutionDefinition = EvolutionDefinition & {
  subtypes?: readonly UnchainedEidolonSubtypeKey[];
  /** At least one of these evolutions, such as poison’s bite or sting. */
  requiresAny?: readonly EvolutionReference[];
  /** Damage Reduction raises the DR the eidolon’s subtype grants. */
  requiresSubtypeDamageReduction?: boolean;
};
const outerSubtypes: readonly UnchainedEidolonSubtypeKey[] = [
  'agathion',
  'daemon',
  'demon',
  'devil',
  'div',
  'elemental',
  'protean',
  'psychopomp',
];
const fiendishSubtypes: readonly UnchainedEidolonSubtypeKey[] = [
  'daemon',
  'demon',
  'devil',
  'elemental',
  'protean',
];
const tentacleSubtypes: readonly UnchainedEidolonSubtypeKey[] = [
  'daemon',
  'demon',
  'protean',
];
/**
 * The Unchained evolution list, pp. 35–39. It has every APG evolution; the
 * differences are subtype requirements, Pounce (3 points, 7th level), Damage
 * Reduction (raises the subtype's DR from 15th level, with no alignment
 * choice or DR 10 upgrade), Constrict and Poison requirements, and the
 * smaller Large and Huge score bonuses.
 */
export const unchainedEidolonEvolutions: Record<
  EidolonEvolutionKey,
  UnchainedEvolutionDefinition
> = {
  ...eidolonEvolutions,
  bite: { ...eidolonEvolutions.bite, subtypes: outerSubtypes },
  claws: {
    ...eidolonEvolutions.claws,
    summary:
      'Two primary claws on one pair of limbs: any number of pairs of arms but at most one pair of legs.',
    subtypes: outerSubtypes,
  },
  mount: { ...eidolonEvolutions.mount, subtypes: fiendishSubtypes },
  pincers: { ...eidolonEvolutions.pincers, subtypes: outerSubtypes },
  sting: { ...eidolonEvolutions.sting, subtypes: outerSubtypes },
  tail: { ...eidolonEvolutions.tail, subtypes: outerSubtypes },
  tailSlap: { ...eidolonEvolutions.tailSlap, subtypes: outerSubtypes },
  tentacle: { ...eidolonEvolutions.tentacle, subtypes: tentacleSubtypes },
  pounce: {
    ...eidolonEvolutions.pounce,
    cost: 3,
    minimumLevel: 7,
  },
  constrict: {
    ...eidolonEvolutions.constrict,
    summary: 'Grab damage again when grappling; needs the grab evolution.',
    requires: [{ key: 'grab' }],
  },
  gore: { ...eidolonEvolutions.gore, subtypes: outerSubtypes },
  poison: {
    ...eidolonEvolutions.poison,
    subtypes: fiendishSubtypes,
    requiresAny: [{ key: 'bite' }, { key: 'sting' }],
  },
  trip: { ...eidolonEvolutions.trip, subtypes: fiendishSubtypes },
  damageReduction: {
    name: 'Damage Reduction',
    cost: 3,
    summary: 'Raises the damage reduction the eidolon’s subtype grants by 5.',
    minimumLevel: 15,
    requiresSubtypeDamageReduction: true,
  },
  swallowWhole: { ...eidolonEvolutions.swallowWhole, subtypes: outerSubtypes },
  web: { ...eidolonEvolutions.web, subtypes: tentacleSubtypes },
  large: {
    ...eidolonEvolutions.large,
    summary:
      'Large: +4 Str, +2 Con, −2 Dex, +2 natural armor; a biped gains 10 ft. reach. 6 more points make it Huge instead: +8 Str, +4 Con, −4 Dex, +5 natural armor.',
  },
};

/** Unchained Large and Huge replace, and do not stack with, each other. */
export const unchainedEidolonSizeEvolutions: Record<
  'large' | 'huge',
  SizeAdjustment & { size: CreatureSize; naturalArmor: number }
> = {
  large: {
    size: 'large',
    scores: [
      { ability: 'strength', value: 4 },
      { ability: 'constitution', value: 2 },
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
      { ability: 'strength', value: 8 },
      { ability: 'constitution', value: 4 },
      { ability: 'dexterity', value: -4 },
    ],
    naturalArmor: 5,
    skills: [
      { skill: 'skill.fly', value: -4 },
      { skill: 'skill.ste', value: -8 },
    ],
  },
};

/** The base forms an Unchained subtype allows. */
export function unchainedSubtypeBaseForms(subtype: UnchainedEidolonSubtypeKey) {
  return eidolonBaseFormKeys.filter(
    (form) => unchainedEidolonSubtypes[subtype].baseForms[form] !== undefined,
  );
}
