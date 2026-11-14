// The Source-body family's public replacement fixture
// (`convex/characterSheetSourceBody.integration.test.ts` releases it): the
// proof race, its standard Racial Traits and its alternate Racial Traits,
// each alternate with the standard traits it replaces and its own body. The
// family's registry entry binds this module by bytes beside the proof
// (`scripts/catalog/launch-source-body.ts`), and the catalog test's coverage
// tie reads it: every `replaces` shape the family's scope certifies (each
// replaced-trait count up to `mostReplaced`, each a standard trait of the
// alternate's one race) is one an alternate here exercises
// (`tests/catalog/launch-source-body.test.ts`).

/** The proof race, whose standard traits carry the racial outputs. */
export const race = 'pf1/sourceBodyProofRace';
export const traits = {
  // `ac` +4 dodge in `giants`, and its description note (Defensive Training).
  defensive: 'pf1-content/sourceBodyProofDefensive',
  // `saves` +2 racial in `poison`, `spells` and `spellLike` (Hardy).
  hardy: 'pf1-content/sourceBodyProofHardy',
  // `saves` +2 racial in `enchantment`, and an untargeted note (Elven
  // Immunities).
  immunities: 'pf1-content/sourceBodyProofImmunities',
  // `saves` +2 racial in `fear`, marked to stack within its entry (Fearless).
  fearless: 'pf1-content/sourceBodyProofFearless',
  // `saves` +1 racial, unconditional (Halfling Luck, beside Fearless).
  luck: 'pf1-content/sourceBodyProofLuck',
  // `cmd` +4 racial in `bullRushGround` and `tripGround` (Stability).
  stability: 'pf1-content/sourceBodyProofStability',
  // `skill.apr` +2 racial in a local Situation (Greed).
  greed: 'pf1-content/sourceBodyProofGreed',
  // `skill.per` +2 untyped in a local Situation, and an untargeted note
  // (Stonecunning).
  stonecunning: 'pf1-content/sourceBodyProofStonecunning',
  // `skill.spl` +2 racial in `identifyMagicItems` and `casterLevel` +2
  // racial in `spellResistance` (Elven Magic).
  magic: 'pf1-content/sourceBodyProofMagic',
  // `attack` +1 racial in two local Situations (Hatred).
  hatred: 'pf1-content/sourceBodyProofHatred',
  // A note on `saves` in `fear`: a targeted situational note.
  wary: 'pf1-content/sourceBodyProofWary',
  // `countsAsRaces` (Elf Blood).
  blood: 'pf1-content/sourceBodyProofBlood',
  // `favoredClassCount: 2` (Multitalented).
  multitalented: 'pf1-content/sourceBodyProofMultitalented',
  // `cmb` +2 untyped in `sunder` (Gatecrasher).
  gatecrasher: 'pf1-content/sourceBodyProofGatecrasher',
  // `cmb` +2 untyped in two local Situations (Relentless).
  relentless: 'pf1-content/sourceBodyProofRelentless',
  // `save.fort` +4 racial in a local Situation (Desert Runner).
  desertRunner: 'pf1-content/sourceBodyProofDesertRunner',
  // `ac` +1 dodge and `save.ref` +1 untyped, each in a local Situation
  // (Underfoot).
  underfoot: 'pf1-content/sourceBodyProofUnderfoot',
  // `save.will` +2 racial in a local Situation, and a note on `save.will`
  // (Stubborn).
  stubborn: 'pf1-content/sourceBodyProofStubborn',
  // `skill.crf` and `skill.pro` +2 racial in one local Situation
  // (Craftsman).
  craftsman: 'pf1-content/sourceBodyProofCraftsman',
} as const;

type Situation = string | { local: string };
type Modifier = {
  target: string;
  bonusType: string;
  value: number;
  condition: { situation: Situation };
};
type Note = { text: string; target?: string };
/** An alternate Racial Trait of the proof race. */
export type Alternate = {
  key: string;
  name: string;
  /** The standard traits it replaces, by key, in the importer's order. */
  replaces: readonly string[];
  modifiers?: readonly Modifier[];
  situationalNotes?: readonly Note[];
};

/** The local Situations of the alternates' own bodies. */
export const alternateLocal = {
  aberrations: 'against monsters of the aberration type',
  grappleAberrations:
    'on combat maneuver checks to grapple aberrations or to continue a grapple with one',
  healing: 'when casting conjuration (healing) spells upon allies',
  flying: 'against flying creatures',
};
export const deepWarriorNote =
  'Proof dwarves get a +2 dodge bonus to AC against aberrations and a +2 racial bonus to CMB to grapple them.';
export const spiritualSupportNote =
  'Proof dwarves gain a +1 racial bonus to their caster levels when casting conjuration (healing) spells upon allies.';
export const skySentinelNote =
  'Enemies on higher ground gain no attack roll bonus against you.';
const situational = (
  [target, bonusType, value]: [string, string, number],
  situation: Situation,
): Modifier => ({ target, bonusType, value, condition: { situation } });

/** The alternates, keyed by their names in the proof. */
export const alternateTraits = {
  // Replaces the counting trait (as Dual Minded replaces Elf Blood).
  lineage: {
    key: 'pf1-content/sourceBodyProofLineage',
    name: 'Proof Lineage',
    replaces: [traits.blood],
  },
  // Replaces the favored-class trait (as Arcane Training replaces
  // Multitalented).
  training: {
    key: 'pf1-content/sourceBodyProofTraining',
    name: 'Proof Training',
    replaces: [traits.multitalented],
  },
  // body-ext-3: replaces the dodge trait and carries its own body: `ac` +2
  // dodge and `cmb` +2 racial, each in a local Situation, and its
  // description note (as Deep Warrior replaces Defensive Training).
  deepWarrior: {
    key: 'pf1-content/sourceBodyProofDeepWarrior',
    name: 'Proof Deep Warrior',
    replaces: [traits.defensive],
    modifiers: [
      situational(['ac', 'dodge', 2], { local: alternateLocal.aberrations }),
      situational(['cmb', 'racial', 2], {
        local: alternateLocal.grappleAberrations,
      }),
    ],
    situationalNotes: [{ text: deepWarriorNote }],
  },
  // body-ext-3 fix r1: replaces two standard traits, `casterLevel` +1
  // racial in a local Situation, and its note (as Spiritual Support
  // replaces Greed and Hardy).
  spiritualSupport: {
    key: 'pf1-content/sourceBodyProofSpiritualSupport',
    name: 'Proof Spiritual Support',
    replaces: [traits.greed, traits.hardy],
    modifiers: [
      situational(['casterLevel', 'racial', 1], {
        local: alternateLocal.healing,
      }),
    ],
    situationalNotes: [{ text: spiritualSupportNote }],
  },
  // body-ext-3 fix r1: replaces three standard traits, `attack` +1 racial,
  // `ac` +2 dodge and `skill.per` +2 untyped in one local Situation, and a
  // note on `ac` (as Sky Sentinel replaces Defensive Training, Hatred and
  // Stonecunning).
  skySentinel: {
    key: 'pf1-content/sourceBodyProofSkySentinel',
    name: 'Proof Sky Sentinel',
    replaces: [traits.defensive, traits.hatred, traits.stonecunning],
    modifiers: [
      situational(['attack', 'racial', 1], { local: alternateLocal.flying }),
      situational(['ac', 'dodge', 2], { local: alternateLocal.flying }),
      situational(['skill.per', 'untyped', 2], {
        local: alternateLocal.flying,
      }),
    ],
    situationalNotes: [{ target: 'ac', text: skySentinelNote }],
  },
} as const satisfies Record<string, Alternate>;
