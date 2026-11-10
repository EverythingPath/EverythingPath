// @vitest-environment edge-runtime
import { expect, test } from 'vitest';
import { prepare, releaseFixture } from '../tests/catalog-release-fixture';
import { withSheetCatalog } from '../tests/character-sheet-catalog';
import {
  canonicalReleaseJson,
  parseReleaseJson,
} from '../src/lib/catalog/release-schema';
import {
  calculateCharacterSheet,
  type ResolvedStatistic,
} from '../src/lib/character-sheet';
import { findReviewedClassCasting } from '../src/lib/character-sheet-casting-tables';
import type { RequestedSituation } from '../src/lib/character-sheet-situations';
import { candidateDefinition } from './lib/catalogCandidateDefinition';
import {
  alternateLocal,
  alternateTraits,
  type Alternate,
  deepWarriorNote,
  race,
  skySentinelNote,
  spiritualSupportNote,
  traits,
} from '../tests/source-body-proof-alternates';
import {
  type WordCase,
  wordCases,
  type WordModifier,
  type WordNote,
  wordOutputs,
  wordRace,
} from '../tests/source-body-proof-words';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';

const modules = import.meta.glob('./**/*.ts');

// The Source-body family's public proof (`scripts/catalog/launch-source-body.ts`):
// each output kind a reviewed body is delivered by, as the importer emits it,
// reaches the saved sheet through a Catalog Release, the app's candidate
// conversion and public reads and writes. Situational Modifiers on saves and
// each save, AC (dodge), CMB, CMD, skills, caster level, spell DC,
// concentration, attack and ranged attack and damage stay out of every total
// and are listed in `conditional` with their Situation; the read's own
// Situations apply them, as the client does, trait bonuses highest only
// beside racial ones; situational notes reach the entry or their statistic;
// counting as another race meets a race prerequisite; two favored classes are
// allowed; and a trait Selection's outputs leave the sheet when it is made
// inactive. A released Wizard's Spellcasting shows the casting targets on the
// statistics a caster uses: spell DC on each real slot DC (10 + spell level
// + Intelligence modifier), caster level and concentration on its own,
// each only in its Situation. body-ext-2 adds damage (melee and ranged) and
// melee damage, on their statistics and routine lines, and the circumstance
// (stacking across sources) and competence (highest only across sources, a
// marked increment adding within its entry) types, competence also on the
// Spellcasting's own concentration. body-ext-3 adds `replaces`: an
// alternate Racial Trait chosen takes the standard traits it names off the
// sheet, and its own body proves. The bodies are a synthetic fixture shaped
// as the imported rows they name: one race whose standard traits carry the
// racial outputs, five alternates, nine feats, eleven traits, three classes
// and two weapons. sb-tie adds the word fixture
// (`tests/source-body-proof-words.ts`): one body for each word the scope
// certifies, each asserted alike, on a sheet of its own race.
const countedRace = 'pf1/sourceBodyProofCountedRace';
// Traits, chosen as Selections: the `trait` kind and bonus type.
const traitSelections = {
  // `saves` +2 trait in `fear` (Courageous).
  courageous: 'pf1-content/sourceBodyProofCourageous',
  // `saves` +1 trait in a local Situation (History of Heresy).
  heresy: 'pf1-content/sourceBodyProofHeresy',
  // `skill.blf` and `skill.dip` +1 trait in one local Situation and
  // `spellDC` +1 trait in another (Charming).
  charming: 'pf1-content/sourceBodyProofCharming',
  // `skill.dev`, `skill.esc` and `skill.slt` +1 trait, each in its own local
  // Situation (Vagabond Child).
  vagabond: 'pf1-content/sourceBodyProofVagabond',
  // `skill.sen` +5 trait in a local Situation (Canter).
  canter: 'pf1-content/sourceBodyProofCanter',
  // `skill.kpl` +3 trait and `save.will` +2 trait, each in a local Situation
  // (Asmodean Demon Hunter).
  hunter: 'pf1-content/sourceBodyProofHunter',
  // `skill.sur` +4 trait in a local Situation, and a note on `skill.sur`
  // (Starchild).
  starchild: 'pf1-content/sourceBodyProofStarchild',
  // `skill.spl` +2 trait in `identifyMagicItems` (Loreseeker).
  loreseeker: 'pf1-content/sourceBodyProofLoreseeker',
  // `attack` +1 trait in a local Situation (Fencer).
  fencer: 'pf1-content/sourceBodyProofFencer',
} as const;
// body-ext-2: the damage targets and the circumstance and competence types,
// chosen as Selections only in their own tests.
const extended = {
  // `damage` +1 trait in a local Situation (Dirty Fighter), and a note on
  // `damage` (Brute's).
  dirtyFighter: 'pf1-content/sourceBodyProofDirtyFighter',
  // `damage.melee` +1 trait in a local Situation (Divine Warrior), and a
  // note on `damage.melee` (Flame of the Dawnflower's).
  divineWarrior: 'pf1-content/sourceBodyProofDivineWarrior',
  // `attack` +4 circumstance in a local Situation (Paired Opportunists).
  paired: 'pf1/sourceBodyProofPaired',
  // `attack` +2 circumstance in a local Situation (Dimensional Awareness).
  dimensional: 'pf1-content/sourceBodyProofDimensional',
  // `cmb` +2 competence in one local Situation and +4 in another
  // (Coordinated Maneuvers).
  coordinated: 'pf1-content/sourceBodyProofCoordinated',
  // `cmb` +2 competence in a local Situation (Cudgeler Sweep).
  cudgeler: 'pf1-content/sourceBodyProofCudgeler',
  // `concentration` +4 competence in a local Situation, and +1 and +2 in
  // two others, marked to stack within the entry (Shielded Caster).
  shielded: 'pf1-content/sourceBodyProofShielded',
} as const;
const feats = {
  // `concentration` +4 untyped in a local Situation (Combat Casting).
  casting: 'pf1/sourceBodyProofCasting',
  // `casterLevel` +2 untyped in `spellResistance` (Spell Penetration).
  penetration: 'pf1/sourceBodyProofPenetration',
  // `attack.ranged` and `damage.ranged` +1 untyped in `within30ft`
  // (Point-Blank Shot).
  pointBlank: 'pf1/sourceBodyProofPointBlank',
  // A feat whose one clause is the counted race.
  counted: 'pf1/sourceBodyProofCounted',
} as const;
const classes = {
  first: 'pf1/sourceBodyProofFirstClass',
  second: 'pf1/sourceBodyProofSecondClass',
  // A released Wizard: the reviewed Intelligence casting, whose slot DCs,
  // caster level and concentration the casting targets reach.
  wizard: 'pf1/sourceBodyProofWizard',
} as const;
const wizardCasting = findReviewedClassCasting('wizard');
const weapons = {
  melee: 'pf1/sourceBodyProofSword',
  ranged: 'pf1/sourceBodyProofBow',
} as const;

const local = {
  greed:
    'to determine the price of nonmagical goods containing precious metals or gemstones',
  stonework: 'to notice unusual stonework',
  orcs: 'vs. humanoids of the orc subtype',
  goblinoids: 'vs. humanoids of the goblinoid subtype',
  casting: 'casting defensively or while grappled',
  bullRush:
    'to bull rush an opponent while both you and it are standing on the ground',
  overrun:
    'to overrun an opponent while both you and it are standing on the ground',
  march:
    'to avoid fatigue, exhaustion, or ill effects from running, forced marches, starvation, thirst, or hot or cold environments',
  larger: 'against foes larger than you',
  trample: 'to avoid trample attacks',
  compulsion:
    'vs. spells and spell-like abilities of the enchantment (charm) and enchantment (compulsion) schools',
  craft: 'to create objects from metal or stone',
  heresy:
    'against divine spells, while you have no levels in a class that grants divine spellcasting',
  attracted: 'on a character that is (or could be) sexually attracted to you',
  languageDependent:
    'on language-dependent spells you cast on a character that is (or could be) sexually attracted to you',
  disable: 'if you chose Disable Device',
  escape: 'if you chose Escape Artist',
  sleight: 'if you chose Sleight of Hand',
  message: 'to intercept a secret message',
  demons: 'on Knowledge (planes) checks about demons',
  demonMinds: 'against mind-affecting spells and effects from demons',
  lost: 'to avoid becoming lost',
  opportunity:
    'on attacks of opportunity made with daggers, swords and similar bladed weapons',
  flanking: 'when you hit a foe you are flanking',
  divine:
    'with the one melee weapon you chose, for the duration of a divine spell you cast that affects it',
  paired:
    'attacks of opportunity against a creature both you and an adjacent ally with Paired Opportunists threaten',
  summoned:
    'attack of opportunity against a summoned or called creature that materializes in a space you threaten, if you identified the spell that summoned or called it',
  coordinated: 'while adjacent to an ally who also has Coordinated Maneuvers',
  grapple:
    'while breaking free from a grapple adjacent to an ally who also has Coordinated Maneuvers',
  sweep: 'trip immediately after a Cudgeler Style charge hit',
  shielded: 'Shielded Caster: adjacent to an ally who also has this feat',
  lightShield:
    'Shielded Caster: adjacent ally with this feat wields a buckler or light shield',
  heavyShield:
    'Shielded Caster: adjacent ally with this feat wields a heavy or tower shield',
  ...alternateLocal,
};
const sleepNote = 'Immune to magic sleep effects.';
const stoneNote =
  'Receive a Perception check to notice unusual stonework whenever passing within 10 feet, even without actively looking.';
const fearNote = 'Reroll one failed save against fear each day.';
const stubbornNote =
  'If you fail such a save, you receive another save 1 round later to prematurely end the effect.';
const northNote = 'You can automatically determine where true north is.';
const bruteNote =
  'Whenever you score a critical threat, you add (but not multiply, in the case of a confirmed critical hit) an amount of damage equal to your weapon’s critical modifier.';
const flameNote =
  'Whenever you score a critical hit with a scimitar, you deal an additional 2 points of fire damage to your target.';

type Situation = string | { local: string };
type Modifier = {
  target: string;
  bonusType: string;
  value: number;
  condition?: { situation: Situation };
  stacksWithinEntry?: true;
};
type Note = { text: string; target?: string; situation?: Situation };
type Body = {
  externalKey: string;
  name: string;
  pack: string;
  detail: Record<string, unknown>;
  modifiers?: Modifier[];
  situationalNotes?: Note[];
  countsAsRaces?: string[];
  prerequisites?: unknown[];
  prerequisiteText?: string;
};
const body = ({ externalKey, modifiers = [], ...rest }: Body) => ({
  externalKey,
  upstreamKey: externalKey,
  description: `${rest.name}.`,
  sources: [{ book: 'PZO1110', pages: '1' }],
  modifiers,
  unsupported: [],
  ...rest,
});
/** A Situational Modifier: `<target> <bonus type> <value>` in a Situation. */
const situational = (
  [target, bonusType, value]: [string, string, number],
  situation: Situation,
): Modifier => ({ target, bonusType, value, condition: { situation } });
const racialTrait = (
  externalKey: string,
  name: string,
  change: Omit<Body, 'externalKey' | 'name' | 'pack' | 'detail'> & {
    detail?: Record<string, unknown>;
  } = {},
) =>
  body({
    externalKey,
    name,
    pack: 'racial-traits',
    ...change,
    detail: {
      kind: 'racialTrait',
      bonusSkillRanksPerLevel: 0,
      raceKeys: [race],
      standard: true,
      ...change.detail,
    },
  });
/** The alternates' keys. */
const alternates = {
  lineage: alternateTraits.lineage.key,
  training: alternateTraits.training.key,
  deepWarrior: alternateTraits.deepWarrior.key,
  spiritualSupport: alternateTraits.spiritualSupport.key,
  skySentinel: alternateTraits.skySentinel.key,
};
/** An alternate Racial Trait, as the importer emits it, with its body. */
const alternate = ({
  key,
  name,
  replaces,
  modifiers,
  situationalNotes,
}: Alternate) =>
  racialTrait(key, name, {
    ...(modifiers ? { modifiers: [...modifiers] } : {}),
    ...(situationalNotes ? { situationalNotes: [...situationalNotes] } : {}),
    detail: { standard: false, replaces: [...replaces] },
  });
const feat = (
  externalKey: string,
  name: string,
  change: Omit<Body, 'externalKey' | 'name' | 'pack' | 'detail'> = {},
) =>
  body({
    externalKey,
    name,
    pack: 'feats',
    detail: { kind: 'feat', featTypes: ['General'], repeatable: 'no' },
    ...change,
  });
const trait = (
  externalKey: string,
  name: string,
  change: Omit<Body, 'externalKey' | 'name' | 'pack' | 'detail'> = {},
) =>
  body({
    externalKey,
    name,
    pack: 'pf-traits',
    detail: { kind: 'trait', traitType: 'combat' },
    ...change,
  });
const classBody = (externalKey: string, name: string, tag: string) =>
  body({
    externalKey,
    name,
    pack: 'classes',
    detail: {
      kind: 'class',
      tag,
      classKind: 'base',
      hitDie: 10,
      bab: 'full',
      saves: { fort: 'good', ref: 'poor', will: 'poor' },
      classSkills: [],
      skillRanksPerLevel: 2,
      featuresByLevel: [],
      picksByLevel: [],
    },
  });
/** A class body with an imported casting. */
function withCasting(
  { detail, ...rest }: ReturnType<typeof classBody>,
  casting: Record<string, unknown>,
) {
  const withIt: Record<string, unknown> = { ...detail, casting };
  return { ...rest, detail: withIt };
}
const weapon = (
  externalKey: string,
  name: string,
  profile: Record<string, unknown>,
) =>
  body({
    externalKey,
    name,
    pack: 'weapons-and-ammo',
    detail: {
      kind: 'item',
      consumable: false,
      price: 15,
      weight: 3,
      weapon: {
        proficiency: 'martial',
        threat: 20,
        mult: 2,
        finesse: false,
        monk: false,
        thrown: false,
        ...profile,
      },
    },
  });

const bodies = [
  body({
    externalKey: race,
    name: 'Source Body Proof Race',
    pack: 'races',
    detail: {
      kind: 'race',
      racialHitDice: 0,
      creatureTypes: ['humanoid'],
      creatureSubtypes: [],
      racialTraits: Object.values(traits),
      size: 'medium',
    },
  }),
  body({
    externalKey: countedRace,
    name: 'Source Body Counted Race',
    pack: 'races',
    detail: {
      kind: 'race',
      racialHitDice: 0,
      creatureTypes: ['humanoid'],
      creatureSubtypes: [],
      racialTraits: [],
      size: 'medium',
    },
  }),
  racialTrait(traits.defensive, 'Proof Defensive Training', {
    modifiers: [situational(['ac', 'dodge', 4], 'giants')],
    situationalNotes: [
      { text: 'Proof dwarves get a +4 dodge bonus to AC against giants.' },
    ],
  }),
  racialTrait(traits.hardy, 'Proof Hardy', {
    modifiers: ['poison', 'spells', 'spellLike'].map((situation) =>
      situational(['saves', 'racial', 2], situation),
    ),
  }),
  racialTrait(traits.immunities, 'Proof Immunities', {
    modifiers: [situational(['saves', 'racial', 2], 'enchantment')],
    situationalNotes: [{ text: sleepNote }],
  }),
  racialTrait(traits.fearless, 'Proof Fearless', {
    modifiers: [
      {
        ...situational(['saves', 'racial', 2], 'fear'),
        stacksWithinEntry: true,
      },
    ],
  }),
  racialTrait(traits.luck, 'Proof Luck', {
    modifiers: [{ target: 'saves', bonusType: 'racial', value: 1 }],
  }),
  racialTrait(traits.stability, 'Proof Stability', {
    modifiers: ['bullRushGround', 'tripGround'].map((situation) =>
      situational(['cmd', 'racial', 4], situation),
    ),
  }),
  racialTrait(traits.greed, 'Proof Greed', {
    modifiers: [
      situational(['skill.apr', 'racial', 2], { local: local.greed }),
    ],
  }),
  racialTrait(traits.stonecunning, 'Proof Stonecunning', {
    modifiers: [
      situational(['skill.per', 'untyped', 2], { local: local.stonework }),
    ],
    situationalNotes: [{ text: stoneNote }],
  }),
  racialTrait(traits.magic, 'Proof Magic', {
    modifiers: [
      situational(['skill.spl', 'racial', 2], 'identifyMagicItems'),
      situational(['casterLevel', 'racial', 2], 'spellResistance'),
    ],
  }),
  racialTrait(traits.hatred, 'Proof Hatred', {
    modifiers: [
      situational(['attack', 'racial', 1], { local: local.orcs }),
      situational(['attack', 'racial', 1], { local: local.goblinoids }),
    ],
  }),
  racialTrait(traits.wary, 'Proof Wary', {
    situationalNotes: [{ target: 'saves', situation: 'fear', text: fearNote }],
  }),
  racialTrait(traits.blood, 'Proof Blood', { countsAsRaces: [countedRace] }),
  racialTrait(traits.multitalented, 'Proof Multitalented', {
    detail: { favoredClassCount: 2 },
  }),
  racialTrait(traits.gatecrasher, 'Proof Gatecrasher', {
    modifiers: [situational(['cmb', 'untyped', 2], 'sunder')],
  }),
  racialTrait(traits.relentless, 'Proof Relentless', {
    modifiers: [local.bullRush, local.overrun].map((name) =>
      situational(['cmb', 'untyped', 2], { local: name }),
    ),
  }),
  racialTrait(traits.desertRunner, 'Proof Desert Runner', {
    modifiers: [
      situational(['save.fort', 'racial', 4], { local: local.march }),
    ],
  }),
  racialTrait(traits.underfoot, 'Proof Underfoot', {
    modifiers: [
      situational(['ac', 'dodge', 1], { local: local.larger }),
      situational(['save.ref', 'untyped', 1], { local: local.trample }),
    ],
  }),
  racialTrait(traits.stubborn, 'Proof Stubborn', {
    modifiers: [
      situational(['save.will', 'racial', 2], { local: local.compulsion }),
    ],
    situationalNotes: [{ target: 'save.will', text: stubbornNote }],
  }),
  racialTrait(traits.craftsman, 'Proof Craftsman', {
    modifiers: (['skill.crf', 'skill.pro'] as const).map((target) =>
      situational([target, 'racial', 2], { local: local.craft }),
    ),
  }),
  trait(traitSelections.courageous, 'Proof Courageous', {
    modifiers: [situational(['saves', 'trait', 2], 'fear')],
  }),
  trait(traitSelections.heresy, 'Proof Heresy', {
    modifiers: [situational(['saves', 'trait', 1], { local: local.heresy })],
  }),
  trait(traitSelections.charming, 'Proof Charming', {
    modifiers: [
      situational(['skill.blf', 'trait', 1], { local: local.attracted }),
      situational(['skill.dip', 'trait', 1], { local: local.attracted }),
      situational(['spellDC', 'trait', 1], { local: local.languageDependent }),
    ],
  }),
  trait(traitSelections.vagabond, 'Proof Vagabond', {
    modifiers: [
      situational(['skill.dev', 'trait', 1], { local: local.disable }),
      situational(['skill.esc', 'trait', 1], { local: local.escape }),
      situational(['skill.slt', 'trait', 1], { local: local.sleight }),
    ],
  }),
  trait(traitSelections.canter, 'Proof Canter', {
    modifiers: [
      situational(['skill.sen', 'trait', 5], { local: local.message }),
    ],
  }),
  trait(traitSelections.hunter, 'Proof Hunter', {
    modifiers: [
      situational(['skill.kpl', 'trait', 3], { local: local.demons }),
      situational(['save.will', 'trait', 2], { local: local.demonMinds }),
    ],
  }),
  trait(traitSelections.starchild, 'Proof Starchild', {
    modifiers: [situational(['skill.sur', 'trait', 4], { local: local.lost })],
    situationalNotes: [{ target: 'skill.sur', text: northNote }],
  }),
  trait(traitSelections.loreseeker, 'Proof Loreseeker', {
    modifiers: [situational(['skill.spl', 'trait', 2], 'identifyMagicItems')],
  }),
  trait(traitSelections.fencer, 'Proof Fencer', {
    modifiers: [
      situational(['attack', 'trait', 1], { local: local.opportunity }),
    ],
  }),
  trait(extended.dirtyFighter, 'Proof Dirty Fighter', {
    modifiers: [situational(['damage', 'trait', 1], { local: local.flanking })],
    situationalNotes: [{ target: 'damage', text: bruteNote }],
  }),
  trait(extended.divineWarrior, 'Proof Divine Warrior', {
    modifiers: [
      situational(['damage.melee', 'trait', 1], { local: local.divine }),
    ],
    situationalNotes: [{ target: 'damage.melee', text: flameNote }],
  }),
  feat(extended.paired, 'Proof Paired Opportunists', {
    modifiers: [
      situational(['attack', 'circumstance', 4], { local: local.paired }),
    ],
  }),
  feat(extended.dimensional, 'Proof Dimensional Awareness', {
    modifiers: [
      situational(['attack', 'circumstance', 2], { local: local.summoned }),
    ],
  }),
  feat(extended.coordinated, 'Proof Coordinated Maneuvers', {
    modifiers: [
      situational(['cmb', 'competence', 2], { local: local.coordinated }),
      situational(['cmb', 'competence', 4], { local: local.grapple }),
    ],
  }),
  feat(extended.cudgeler, 'Proof Cudgeler Sweep', {
    modifiers: [situational(['cmb', 'competence', 2], { local: local.sweep })],
  }),
  feat(extended.shielded, 'Proof Shielded Caster', {
    modifiers: [
      situational(['concentration', 'competence', 4], {
        local: local.shielded,
      }),
      {
        ...situational(['concentration', 'competence', 1], {
          local: local.lightShield,
        }),
        stacksWithinEntry: true,
      },
      {
        ...situational(['concentration', 'competence', 2], {
          local: local.heavyShield,
        }),
        stacksWithinEntry: true,
      },
    ],
  }),
  ...Object.values(alternateTraits).map(alternate),
  feat(feats.casting, 'Proof Casting', {
    modifiers: [
      situational(['concentration', 'untyped', 4], { local: local.casting }),
    ],
  }),
  feat(feats.penetration, 'Proof Penetration', {
    modifiers: [situational(['casterLevel', 'untyped', 2], 'spellResistance')],
  }),
  feat(feats.pointBlank, 'Proof Point-Blank', {
    modifiers: [
      situational(['attack.ranged', 'untyped', 1], 'within30ft'),
      situational(['damage.ranged', 'untyped', 1], 'within30ft'),
    ],
  }),
  feat(feats.counted, 'Proof Counted', {
    prerequisiteText: 'Source Body Counted Race',
    prerequisites: [{ race: [countedRace], kind: 'race' }],
  }),
  classBody(classes.first, 'Proof First Class', 'sourceBodyProofFirst'),
  classBody(classes.second, 'Proof Second Class', 'sourceBodyProofSecond'),
  // The imported casting names its ability, as the Wizard's does.
  withCasting(classBody(classes.wizard, 'Proof Wizard', 'wizard'), {
    ability: 'intelligence',
  }),
  weapon(weapons.melee, 'Proof Sword', {
    baseType: 'Longsword',
    groups: ['bladesHeavy'],
    handedness: 'oneHanded',
    attackType: 'melee',
    dice: '1d8',
    damageTypes: ['slashing'],
    strengthDamage: 'melee',
  }),
  weapon(weapons.ranged, 'Proof Bow', {
    baseType: 'Shortbow',
    groups: ['bows'],
    handedness: 'twoHanded',
    attackType: 'ranged',
    dice: '1d6',
    damageTypes: ['piercing'],
    rangeIncrement: 60,
    strengthDamage: 'bow',
    reload: 'free',
  }),
];

/** A body the fixture releases. */
type Released = {
  externalKey: string;
  name: string;
  detail: Record<string, unknown>;
};

/**
 * Inserts the stored identity a body starts from, before the release: the
 * stored class is a half-BAB class, so its full BAB comes from the release.
 */
function insertIdentity(
  ctx: MutationCtx,
  { externalKey, name, detail }: Released,
) {
  const identity = {
    scope: 'global' as const,
    name,
    ruleIdentity: externalKey,
    modifiers: [],
    sources: [],
    stacksWithItself: false,
  };
  switch (detail.kind) {
    case 'race':
      return ctx.db.insert('catalogEntry', {
        ...identity,
        detail: { kind: 'race', racialHitDice: 0, racialTraits: [] },
      });
    case 'racialTrait':
      return ctx.db.insert('catalogEntry', {
        ...identity,
        detail: { kind: 'racialTrait', raceEntryIds: [], replaces: [] },
      });
    case 'feat':
      return ctx.db.insert('catalogEntry', {
        ...identity,
        detail: { kind: 'feat' },
      });
    case 'trait':
      return ctx.db.insert('catalogEntry', {
        ...identity,
        detail: { kind: 'trait' },
      });
    case 'item':
      return ctx.db.insert('catalogEntry', {
        ...identity,
        detail: { kind: 'item', consumable: false },
      });
    default:
      return ctx.db.insert('catalogEntry', {
        ...identity,
        detail: {
          kind: 'class',
          classKind: 'base',
          hitDie: 6,
          bab: 'half',
          saves: { fort: 'poor', ref: 'poor', will: 'good' },
          skillRanksPerLevel: 2,
          classSkills: [],
          featuresByLevel: [],
          picksByLevel: [],
          // The stored casting the release's casting converts against.
          ...(detail.tag === 'wizard' && wizardCasting
            ? { casting: wizardCasting }
            : {}),
        },
      });
  }
}

/**
 * The bodies through a prepared Catalog Release and the app's candidate
 * conversion (as `characterSheetModifiers.integration.test.ts` installs
 * them), and a Character of one level in each class with every score 10,
 * the race chosen and both weapons carried.
 */
async function fixture({
  released = bodies,
  chosenRace = race,
}: { released?: readonly Released[]; chosenRace?: string } = {}) {
  const { t, owner, outsider, scope } = await releaseFixture(modules);
  await t.run((ctx) =>
    ctx.db.insert('user', {
      tokenIdentifier: 'test|member',
      orgIds: [{ orgId: 'org', role: 'member' }],
    }),
  );
  const member = t.withIdentity({ tokenIdentifier: 'test|member' });
  const ids: Record<string, Id<'catalogEntry'>> = await t.run(async (ctx) => {
    const ids: Record<string, Id<'catalogEntry'>> = {};
    for (const entry of released)
      ids[entry.externalKey] = await insertIdentity(ctx, entry);
    return ids;
  });
  await prepare(
    t,
    released.map((entry) => ({
      kind: 'definition',
      key: entry.externalKey,
      payload: parseReleaseJson(JSON.parse(canonicalReleaseJson(entry))),
    })),
  );
  await t.run(async (ctx) => {
    const release = await ctx.db
      .query('catalogRelease')
      .withIndex('by_releaseNumber', (q) => q.eq('releaseNumber', 1))
      .unique();
    if (!release) throw new Error('Missing release');
    for (const id of Object.values(ids)) {
      const stored = await ctx.db.get('catalogEntry', id);
      if (!stored) throw new Error('Missing stored identity');
      const { _id, _creationTime, ...definition } = await candidateDefinition(
        ctx,
        release,
        stored,
      );
      await ctx.db.replace('catalogEntry', _id, definition);
    }
  });
  const id = (key: string) => {
    const found = ids[key];
    if (!found) throw new Error(`Missing ${key}`);
    return found;
  };
  const read = async (viewer = owner) => {
    const sheet = withSheetCatalog(
      await viewer.query(api.characterSheet.read, scope),
    );
    if (!sheet) throw new Error('Missing saved sheet');
    return sheet;
  };
  const first = (await read()).entries.find(
    (entry) => entry.kind === 'classLevel',
  );
  if (!first) throw new Error('Missing first Class Level');
  await member.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: first._id,
    classEntryId: id(classes.first),
    operationId: 'level-1',
  });
  const second = await member.mutation(api.characterSheet.addClassLevel, {
    ...scope,
    classEntryId: id(classes.second),
    operationId: 'level-2',
  });
  await member.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    operationId: 'scores',
  });
  await owner.mutation(api.characterSheet.selectRace, {
    ...scope,
    catalogEntryId: id(chosenRace),
    operationId: 'race',
  });
  const select = (key: string) =>
    member.mutation(api.characterSheet.selectEntry, {
      ...scope,
      catalogEntryId: id(key),
      operationId: `select-${key}`,
    });
  const sword = await select(weapons.melee);
  const bow = await select(weapons.ranged);
  return {
    owner,
    member,
    outsider,
    scope,
    id,
    read,
    select,
    levels: [first._id, second],
    sword,
    bow,
  };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;
type Sheet = Awaited<ReturnType<Fixture['read']>>;
type Statistic = Pick<ResolvedStatistic, 'total' | 'conditional'>;

/** A source's conditional contributions to a statistic, with their Situations. */
function conditionalOf(statistic: Statistic, key: string) {
  return statistic.conditional
    .filter((row) => row.source === key)
    .map(({ value, bonusType, condition }) => ({
      value,
      bonusType,
      situation: condition?.situation,
    }));
}

type Row = { source?: string; bonusType: string; value: number };

/** The sources of the rows of one bonus type (a statistic's applied or suppressed). */
function sourcesOf(rows: readonly Row[], bonusType: string) {
  return rows
    .filter((row) => row.bonusType === bonusType)
    .map(({ source }) => source);
}

/** The rows of one bonus type as [source, value] pairs. */
function sourceValuesOf(rows: readonly Row[], bonusType: string) {
  return rows
    .filter((row) => row.bonusType === bonusType)
    .map(({ source, value }) => [source, value]);
}

/**
 * Every Situation the read lists in `conditional`, as the client requests
 * it: a shared key as it is, a local one with its sheet entry.
 */
function listedSituations(sheet: Sheet): RequestedSituation[] {
  const { breakdowns, derivedStatistics, attackRoutines } = sheet.calculated;
  const statistics: Statistic[] = [
    ...Object.values(breakdowns),
    ...Object.values(derivedStatistics),
    ...attackRoutines.flatMap((routine) =>
      routine.single.flatMap((line) => [line.attackBonus, line.damageBonus]),
    ),
  ];
  const found = new Map<string, RequestedSituation>();
  for (const { conditional } of statistics)
    for (const { condition, sheetEntryId } of conditional) {
      const situation = condition?.situation;
      if (typeof situation === 'string') found.set(situation, situation);
      else if (situation && 'local' in situation)
        found.set(`${sheetEntryId}:${situation.local}`, {
          local: situation.local,
          sheetEntryId,
        });
    }
  return [...found.values()];
}

/** The sheet as if these Situations held, from one read's own data. */
function resolved(sheet: Sheet, situations: readonly RequestedSituation[]) {
  return calculateCharacterSheet(
    { ...sheet, characterKind: sheet.character.kind },
    { situations: [...situations] },
  );
}
type Calculated = ReturnType<typeof resolved> | Sheet['calculated'];

/** The totals the family's situational Modifiers reach. */
function totals(calculated: Calculated) {
  const { breakdowns, derivedStatistics: statistics } = calculated;
  return {
    fortitude: statistics.fortitude.total,
    reflex: statistics.reflex.total,
    will: statistics.will.total,
    ac: statistics.ac.total,
    touchAc: statistics.touchAc.total,
    flatFootedAc: statistics.flatFootedAc.total,
    cmd: statistics.cmd.total,
    appraise: breakdowns['skill.apr'].total,
    perception: breakdowns['skill.per'].total,
    spellcraft: breakdowns['skill.spl'].total,
    casterLevel: breakdowns.casterLevel.total,
    concentration: breakdowns.concentration.total,
    cmb: statistics.cmb.total,
    craft: breakdowns['skill.crf'].total,
    profession: breakdowns['skill.pro'].total,
    bluff: breakdowns['skill.blf'].total,
    diplomacy: breakdowns['skill.dip'].total,
    disableDevice: breakdowns['skill.dev'].total,
    escapeArtist: breakdowns['skill.esc'].total,
    sleightOfHand: breakdowns['skill.slt'].total,
    senseMotive: breakdowns['skill.sen'].total,
    knowledgePlanes: breakdowns['skill.kpl'].total,
    survival: breakdowns['skill.sur'].total,
    spellDC: breakdowns.spellDC.total,
  };
}

/** One weapon's first single-attack line. */
function line(calculated: Calculated, weaponEntryId: string) {
  const found = calculated.attackRoutines.find(
    (routine) => routine.weaponEntryId === weaponEntryId,
  )?.single[0];
  if (!found) throw new Error(`Missing a routine for ${weaponEntryId}`);
  return found;
}

/** The requested Situation a source's local Situation is, on this read. */
function localSituation(
  statistic: Statistic,
  key: string,
  name: string,
): RequestedSituation {
  const row = statistic.conditional.find(
    ({ source, condition }) =>
      source === key &&
      typeof condition?.situation === 'object' &&
      'local' in condition.situation &&
      condition.situation.local === name,
  );
  if (!row) throw new Error(`Missing the local Situation ${name}`);
  return { local: name, sheetEntryId: row.sheetEntryId };
}

test('situational Modifiers stay out of every total and are listed in conditional with their Situation', async () => {
  const { read, select } = await fixture();
  const raced = await read();
  for (const key of [feats.casting, feats.penetration, feats.pointBlank])
    await select(key);
  const sheet = await read();
  const { breakdowns, derivedStatistics: statistics } = sheet.calculated;
  // Only the unconditional +1 racial on saves enters a total, and the feats
  // change none.
  expect(totals(sheet.calculated)).toEqual(totals(raced.calculated));
  expect(
    statistics.will.applied
      .filter(({ source }) => source?.startsWith('pf1'))
      .map(({ source, value }) => [source, value]),
  ).toEqual([[traits.luck, 1]]);
  for (const save of ['fortitude', 'reflex', 'will'] as const) {
    expect(conditionalOf(statistics[save], traits.hardy), save).toEqual(
      ['poison', 'spells', 'spellLike'].map((situation) => ({
        value: 2,
        bonusType: 'racial',
        situation,
      })),
    );
    expect(conditionalOf(statistics[save], traits.immunities)).toEqual([
      { value: 2, bonusType: 'racial', situation: 'enchantment' },
    ]);
    expect(conditionalOf(statistics[save], traits.fearless)).toEqual([
      { value: 2, bonusType: 'racial', situation: 'fear' },
    ]);
  }
  // The dodge bonus is listed on AC, touch AC and CMD, never flat-footed AC.
  const giants = [{ value: 4, bonusType: 'dodge', situation: 'giants' }];
  expect(conditionalOf(statistics.ac, traits.defensive)).toEqual(giants);
  expect(conditionalOf(statistics.touchAc, traits.defensive)).toEqual(giants);
  expect(conditionalOf(statistics.cmd, traits.defensive)).toEqual(giants);
  expect(conditionalOf(statistics.flatFootedAc, traits.defensive)).toEqual([]);
  expect(conditionalOf(statistics.cmd, traits.stability)).toEqual(
    ['bullRushGround', 'tripGround'].map((situation) => ({
      value: 4,
      bonusType: 'racial',
      situation,
    })),
  );
  expect(conditionalOf(breakdowns['skill.apr'], traits.greed)).toEqual([
    { value: 2, bonusType: 'racial', situation: { local: local.greed } },
  ]);
  expect(conditionalOf(breakdowns['skill.per'], traits.stonecunning)).toEqual([
    { value: 2, bonusType: 'untyped', situation: { local: local.stonework } },
  ]);
  expect(conditionalOf(breakdowns['skill.spl'], traits.magic)).toEqual([
    { value: 2, bonusType: 'racial', situation: 'identifyMagicItems' },
  ]);
  expect(conditionalOf(breakdowns.casterLevel, traits.magic)).toEqual([
    { value: 2, bonusType: 'racial', situation: 'spellResistance' },
  ]);
  expect(conditionalOf(breakdowns.casterLevel, feats.penetration)).toEqual([
    { value: 2, bonusType: 'untyped', situation: 'spellResistance' },
  ]);
  expect(conditionalOf(breakdowns.concentration, feats.casting)).toEqual([
    { value: 4, bonusType: 'untyped', situation: { local: local.casting } },
  ]);
  const hatred = [local.orcs, local.goblinoids].map((name) => ({
    value: 1,
    bonusType: 'racial',
    situation: { local: name },
  }));
  expect(conditionalOf(breakdowns['attack.melee'], traits.hatred)).toEqual(
    hatred,
  );
  expect(conditionalOf(breakdowns['attack.ranged'], traits.hatred)).toEqual(
    hatred,
  );
  const within = [{ value: 1, bonusType: 'untyped', situation: 'within30ft' }];
  expect(conditionalOf(breakdowns['attack.ranged'], feats.pointBlank)).toEqual(
    within,
  );
  expect(conditionalOf(breakdowns['damage.ranged'], feats.pointBlank)).toEqual(
    within,
  );
  expect(conditionalOf(breakdowns['attack.melee'], feats.pointBlank)).toEqual(
    [],
  );
  expect(conditionalOf(breakdowns['damage.melee'], feats.pointBlank)).toEqual(
    [],
  );
});

test('the read’s own Situations apply them: AC reaches touch AC and CMD, one entry’s Situations never stack, separate traits do, and caster level rises only against spell resistance', async () => {
  const { read, select } = await fixture();
  for (const key of [feats.casting, feats.penetration]) await select(key);
  const sheet = await read();
  const base = totals(sheet.calculated);
  const { breakdowns } = sheet.calculated;
  const under = (...situations: RequestedSituation[]) =>
    totals(resolved(sheet, situations));
  // The listed Situations, and nothing applies with none of them.
  expect(listedSituations(sheet)).toEqual(
    expect.arrayContaining([
      'giants',
      'poison',
      'spells',
      'spellLike',
      'enchantment',
      'fear',
      'bullRushGround',
      'tripGround',
      'identifyMagicItems',
      'spellResistance',
    ]),
  );
  expect(under()).toEqual(base);
  // +4 dodge against giants: AC, touch AC and CMD, never flat-footed AC.
  expect(under('giants')).toEqual({
    ...base,
    ac: base.ac + 4,
    touchAc: base.touchAc + 4,
    cmd: base.cmd + 4,
  });
  // One entry's Situations: +2 against poison, and still +2 against a
  // poisonous spell.
  const saves = (change: number) => ({
    fortitude: base.fortitude + change,
    reflex: base.reflex + change,
    will: base.will + change,
  });
  expect(under('poison')).toEqual({ ...base, ...saves(2) });
  expect(under('poison', 'spells', 'spellLike')).toEqual({
    ...base,
    ...saves(2),
  });
  expect(under('enchantment')).toEqual({ ...base, ...saves(2) });
  // Separate traits stack: Fearless's +2 against fear beside the
  // unconditional +1 already in the total, +3 in all, and Hardy's +2
  // against a frightening poison.
  expect(under('fear')).toEqual({ ...base, ...saves(2) });
  const racialOn = (calculated: Calculated) =>
    sourceValuesOf(calculated.derivedStatistics.will.applied, 'racial');
  expect(racialOn(sheet.calculated)).toEqual([[traits.luck, 1]]);
  expect(racialOn(resolved(sheet, ['fear'])).sort()).toEqual(
    [
      [traits.luck, 1],
      [traits.fearless, 2],
    ].sort(),
  );
  expect(under('fear', 'poison')).toEqual({ ...base, ...saves(4) });
  // +4 CMD in either ground Situation, and +4 with both.
  expect(under('bullRushGround')).toEqual({ ...base, cmd: base.cmd + 4 });
  expect(under('tripGround')).toEqual({ ...base, cmd: base.cmd + 4 });
  expect(under('bullRushGround', 'tripGround')).toEqual({
    ...base,
    cmd: base.cmd + 4,
  });
  expect(under('giants', 'tripGround')).toEqual({
    ...base,
    ac: base.ac + 4,
    touchAc: base.touchAc + 4,
    cmd: base.cmd + 8,
  });
  // Skills, each in its own Situation, local ones with their entry.
  expect(
    under(localSituation(breakdowns['skill.apr'], traits.greed, local.greed)),
  ).toEqual({ ...base, appraise: base.appraise + 2 });
  expect(
    under(
      localSituation(
        breakdowns['skill.per'],
        traits.stonecunning,
        local.stonework,
      ),
    ),
  ).toEqual({ ...base, perception: base.perception + 2 });
  expect(under('identifyMagicItems')).toEqual({
    ...base,
    spellcraft: base.spellcraft + 2,
  });
  // A local Situation named alike on another entry matches nothing.
  expect(under({ local: local.greed, sheetEntryId: 'another-entry' })).toEqual(
    base,
  );
  // Caster level: +2 racial and +2 untyped stack, against spell resistance
  // only; the ordinary caster level is unchanged, in any other Situation.
  expect(under('spellResistance')).toEqual({
    ...base,
    casterLevel: base.casterLevel + 4,
  });
  expect(under('spells', 'identifyMagicItems').casterLevel).toBe(
    base.casterLevel,
  );
  expect(
    under(
      localSituation(breakdowns.concentration, feats.casting, local.casting),
    ),
  ).toEqual({ ...base, concentration: base.concentration + 4 });
});

test('routine lines carry the attack and ranged Modifiers in their Situations', async () => {
  const { read, select, sword, bow } = await fixture();
  await select(feats.pointBlank);
  const sheet = await read();
  const { breakdowns } = sheet.calculated;
  const lines = (situations: RequestedSituation[]) => {
    const calculated = resolved(sheet, situations);
    return {
      swordAttack: line(calculated, sword).attackBonus.total,
      swordDamage: line(calculated, sword).damageBonus.total,
      bowAttack: line(calculated, bow).attackBonus.total,
      bowDamage: line(calculated, bow).damageBonus.total,
    };
  };
  const base = lines([]);
  expect({
    swordAttack: line(sheet.calculated, sword).attackBonus.total,
    swordDamage: line(sheet.calculated, sword).damageBonus.total,
    bowAttack: line(sheet.calculated, bow).attackBonus.total,
    bowDamage: line(sheet.calculated, bow).damageBonus.total,
  }).toEqual(base);
  // Each line lists its Modifiers in their Situations.
  const hatred = [local.orcs, local.goblinoids].map((name) => ({
    value: 1,
    bonusType: 'racial',
    situation: { local: name },
  }));
  const within = [{ value: 1, bonusType: 'untyped', situation: 'within30ft' }];
  expect(
    conditionalOf(line(sheet.calculated, sword).attackBonus, traits.hatred),
  ).toEqual(hatred);
  expect(
    conditionalOf(line(sheet.calculated, bow).attackBonus, traits.hatred),
  ).toEqual(hatred);
  expect(
    conditionalOf(line(sheet.calculated, bow).attackBonus, feats.pointBlank),
  ).toEqual(within);
  expect(
    conditionalOf(line(sheet.calculated, bow).damageBonus, feats.pointBlank),
  ).toEqual(within);
  expect(
    conditionalOf(line(sheet.calculated, sword).attackBonus, feats.pointBlank),
  ).toEqual([]);
  // Against an orc: +1 on every line's attack; two of the entry's
  // Situations together are still +1.
  const orcs = localSituation(
    breakdowns['attack.melee'],
    traits.hatred,
    local.orcs,
  );
  const goblinoids = localSituation(
    breakdowns['attack.melee'],
    traits.hatred,
    local.goblinoids,
  );
  expect(lines([orcs])).toEqual({
    ...base,
    swordAttack: base.swordAttack + 1,
    bowAttack: base.bowAttack + 1,
  });
  expect(lines([orcs, goblinoids])).toEqual(lines([orcs]));
  // Within 30 feet: +1 attack and +1 damage on ranged lines only.
  expect(lines(['within30ft'])).toEqual({
    ...base,
    bowAttack: base.bowAttack + 1,
    bowDamage: base.bowDamage + 1,
  });
  expect(lines(['within30ft', orcs])).toEqual({
    ...base,
    swordAttack: base.swordAttack + 1,
    bowAttack: base.bowAttack + 2,
    bowDamage: base.bowDamage + 1,
  });
});

test('untargeted notes reach the entry and a targeted note its statistic, changing no number', async () => {
  const { read } = await fixture();
  const sheet = await read();
  const { entryNotes, derivedStatistics, breakdowns } = sheet.calculated;
  expect(
    entryNotes
      .filter(({ text }) => [sleepNote, stoneNote].includes(text))
      .map(({ source, text }) => [source, text]),
  ).toEqual([
    [traits.immunities, sleepNote],
    [traits.stonecunning, stoneNote],
  ]);
  expect(entryNotes.some(({ text }) => text === fearNote)).toBe(false);
  for (const save of ['save.fort', 'save.ref', 'save.will'] as const)
    expect(
      (breakdowns[save].notes ?? []).map(({ source, situation, text }) => ({
        source,
        situation,
        text,
      })),
      save,
    ).toEqual([
      { source: traits.wary, situation: 'fear', text: fearNote },
      // A note on one save reaches that save only.
      ...(save === 'save.will'
        ? [
            {
              source: traits.stubborn,
              situation: undefined,
              text: stubbornNote,
            },
          ]
        : []),
    ]);
  expect(totals(resolved(sheet, ['fear'])).will).toBe(
    derivedStatistics.will.total + 2,
  );
});

test('counting as another race meets a race prerequisite only while the trait is active', async () => {
  const { member, scope, read, select, id } = await fixture();
  const counted = await select(feats.counted);
  const met = async () =>
    (await read()).calculated.prerequisites
      .filter((row) => row.entryId === counted && row.view === 'current')
      .map((row) => row.met);
  expect((await read()).calculated.racial.countsAsRaces).toContain(countedRace);
  expect(await met()).toEqual([true]);
  // The alternate replaces the counting trait: the clause is unmet.
  const lineage = (selected: boolean, operationId: string) =>
    member.mutation(api.characterSheet.setRacialTraitSelected, {
      ...scope,
      catalogEntryId: id(alternates.lineage),
      selected,
      operationId,
    });
  await lineage(true, 'lineage');
  expect((await read()).calculated.racial.countsAsRaces).not.toContain(
    countedRace,
  );
  expect(await met()).toEqual([false]);
  expect(
    (await read()).calculated.warnings.filter((warning) =>
      warning.check.startsWith('prerequisites.'),
    ),
  ).not.toEqual([]);
  // Restored, it is met again.
  await lineage(false, 'restore');
  expect(await met()).toEqual([true]);
});

test('two favored classes are allowed only with the trait, and a favored class bonus on either class counts', async () => {
  const { member, scope, read, id, levels } = await fixture();
  const [firstLevel, secondLevel] = levels;
  if (!firstLevel || !secondLevel) throw new Error('Missing Class Levels');
  const checks = (sheet: Sheet) =>
    sheet.calculated.warnings
      .map(({ check }) => check)
      .filter((check) => check.startsWith('favoredClass'))
      .sort();
  const hp = (sheet: Sheet) => sheet.calculated.breakdowns.hp.total;
  const before = await read();
  await member.mutation(api.characterSheet.editCreationSettings, {
    ...scope,
    settings: {},
    favoredClassIds: [id(classes.first), id(classes.second)],
    operationId: 'favored',
  });
  for (const [entryId, operationId] of [
    [firstLevel, 'bonus-1'],
    [secondLevel, 'bonus-2'],
  ] as const)
    await member.mutation(api.characterSheet.editClassLevel, {
      ...scope,
      entryId,
      favoredClassBonus: { choice: 'hp' },
      operationId,
    });
  const favored = await read();
  expect(favored.calculated.racial.favoredClassCount).toBe(2);
  // Both levels' +1 HP count, with no count or "not favored" warning.
  expect(checks(favored)).toEqual([]);
  expect(hp(favored)).toBe(hp(before) + 2);
  // The alternate replaces the trait: one favored class only.
  await member.mutation(api.characterSheet.setRacialTraitSelected, {
    ...scope,
    catalogEntryId: id(alternates.training),
    selected: true,
    operationId: 'training',
  });
  const single = await read();
  expect(single.calculated.racial.favoredClassCount).toBe(1);
  expect(checks(single)).toContain('favoredClassCount');
});

test('an alternate that replaces a standard trait takes it off the sheet, and its own body proves in its Situations', async () => {
  const { member, scope, read, id } = await fixture();
  const deepWarrior = (selected: boolean, operationId: string) =>
    member.mutation(api.characterSheet.setRacialTraitSelected, {
      ...scope,
      catalogEntryId: id(alternates.deepWarrior),
      selected,
      operationId,
    });
  /** A Racial Trait's resolved row: its origin, state and reason. */
  const state = (sheet: Sheet, key: string) => traitState(sheet, id(key));
  const notesOf = (sheet: Sheet) =>
    sheet.calculated.entryNotes
      .filter(({ text }) => text === deepWarriorNote)
      .map(({ source }) => source);
  const before = await read();
  const giants = [{ value: 4, bonusType: 'dodge', situation: 'giants' }];
  const counting = [
    { origin: 'grant', dormant: false, counting: true, reason: undefined },
  ];
  expect(state(before, traits.defensive)).toEqual(counting);
  expect(state(before, alternates.deepWarrior)).toEqual([]);
  expect(
    conditionalOf(before.calculated.derivedStatistics.ac, traits.defensive),
  ).toEqual(giants);
  expect(notesOf(before)).toEqual([]);

  await deepWarrior(true, 'deep-warrior');
  const sheet = await read();
  const { derivedStatistics: statistics } = sheet.calculated;
  // The replaced trait is dormant, replaced, and none of its outputs remain.
  expect(state(sheet, traits.defensive)).toEqual([
    { origin: 'grant', dormant: true, counting: false, reason: 'replaced' },
  ]);
  expect(state(sheet, alternates.deepWarrior)).toEqual([
    { origin: 'selection', dormant: false, counting: true, reason: undefined },
  ]);
  for (const statistic of ['ac', 'touchAc', 'cmd'] as const)
    expect(
      conditionalOf(statistics[statistic], traits.defensive),
      statistic,
    ).toEqual([]);
  // Other standard traits are untouched.
  expect(state(sheet, traits.hardy)).toEqual(counting);
  // The alternate's own body: its dodge bonus on AC, touch AC and CMD, never
  // flat-footed AC, its CMB bonus, and its note on the entry.
  const aberrations = [
    { value: 2, bonusType: 'dodge', situation: { local: local.aberrations } },
  ];
  expect(conditionalOf(statistics.ac, alternates.deepWarrior)).toEqual(
    aberrations,
  );
  expect(conditionalOf(statistics.touchAc, alternates.deepWarrior)).toEqual(
    aberrations,
  );
  expect(conditionalOf(statistics.cmd, alternates.deepWarrior)).toEqual(
    aberrations,
  );
  expect(
    conditionalOf(statistics.flatFootedAc, alternates.deepWarrior),
  ).toEqual([]);
  expect(conditionalOf(statistics.cmb, alternates.deepWarrior)).toEqual([
    {
      value: 2,
      bonusType: 'racial',
      situation: { local: local.grappleAberrations },
    },
  ]);
  expect(notesOf(sheet)).toEqual([alternates.deepWarrior]);
  // Applied in the read's own Situations: the replaced +4 against giants is
  // gone; the alternate's bonuses apply only in theirs.
  const base = totals(sheet.calculated);
  expect(totals(before.calculated)).toEqual(base);
  const under = (...situations: RequestedSituation[]) =>
    totals(resolved(sheet, situations));
  expect(under('giants')).toEqual(base);
  expect(
    under(
      localSituation(statistics.ac, alternates.deepWarrior, local.aberrations),
    ),
  ).toEqual({
    ...base,
    ac: base.ac + 2,
    touchAc: base.touchAc + 2,
    cmd: base.cmd + 2,
  });
  expect(
    under(
      localSituation(
        statistics.cmb,
        alternates.deepWarrior,
        local.grappleAberrations,
      ),
    ),
  ).toEqual({ ...base, cmb: base.cmb + 2 });

  // Deselected, the replaced trait is back and the alternate's body gone.
  await deepWarrior(false, 'restore');
  const restored = await read();
  expect(state(restored, traits.defensive)).toEqual(counting);
  expect(
    conditionalOf(restored.calculated.derivedStatistics.ac, traits.defensive),
  ).toEqual(giants);
  expect(
    conditionalOf(
      restored.calculated.derivedStatistics.ac,
      alternates.deepWarrior,
    ),
  ).toEqual([]);
  expect(notesOf(restored)).toEqual([]);
});

/** A Racial Trait's resolved rows: each one's origin, state and reason. */
function traitState(sheet: Sheet, catalogEntryId: string) {
  return sheet.calculated.resolvedEntries
    .filter(
      ({ entry }) =>
        'catalogEntryId' in entry && entry.catalogEntryId === catalogEntryId,
    )
    .map(({ origin, dormant, counting, reason }) => ({
      origin,
      dormant,
      counting,
      reason: reason?.kind,
    }));
}

test('an alternate that replaces several standard traits takes each off the sheet and back, beside another, and its own body proves in its Situations', async () => {
  const { member, scope, read, id } = await fixture();
  const choose = (key: string, selected: boolean, operationId: string) =>
    member.mutation(api.characterSheet.setRacialTraitSelected, {
      ...scope,
      catalogEntryId: id(key),
      selected,
      operationId,
    });
  const spiritual = alternateTraits.spiritualSupport;
  const sky = alternateTraits.skySentinel;
  const replacedKeys = [...spiritual.replaces, ...sky.replaces];
  /** Each replaced standard trait's resolved rows, keyed by trait. */
  const states = (sheet: Sheet) =>
    Object.fromEntries(
      replacedKeys.map((key) => [key, traitState(sheet, id(key))]),
    );
  const grant = (dormant: boolean) => [
    {
      origin: 'grant',
      dormant,
      counting: !dormant,
      reason: dormant ? 'replaced' : undefined,
    },
  ];
  const allCounting = Object.fromEntries(
    replacedKeys.map((key) => [key, grant(false)]),
  );
  expect(states(await read())).toEqual(allCounting);

  await choose(spiritual.key, true, 'spiritual');
  await choose(sky.key, true, 'sky');
  const sheet = await read();
  const { breakdowns, derivedStatistics: statistics } = sheet.calculated;
  // Every replaced trait, the last of each list too, is dormant and
  // replaced; a trait neither names still counts.
  expect(states(sheet)).toEqual(
    Object.fromEntries(replacedKeys.map((key) => [key, grant(true)])),
  );
  for (const key of [traits.immunities, traits.magic, traits.luck])
    expect(traitState(sheet, id(key)), key).toEqual(grant(false));
  // None of the replaced traits' outputs remain.
  expect(conditionalOf(breakdowns['skill.apr'], traits.greed)).toEqual([]);
  for (const save of ['fortitude', 'reflex', 'will'] as const)
    expect(conditionalOf(statistics[save], traits.hardy), save).toEqual([]);
  for (const statistic of ['ac', 'touchAc', 'cmd'] as const)
    expect(
      conditionalOf(statistics[statistic], traits.defensive),
      statistic,
    ).toEqual([]);
  expect(conditionalOf(breakdowns['attack.melee'], traits.hatred)).toEqual([]);
  expect(conditionalOf(breakdowns['skill.per'], traits.stonecunning)).toEqual(
    [],
  );
  expect(
    sheet.calculated.entryNotes.some(({ text }) => text === stoneNote),
  ).toBe(false);
  // Each alternate's own body.
  expect(conditionalOf(breakdowns.casterLevel, spiritual.key)).toEqual([
    { value: 1, bonusType: 'racial', situation: { local: local.healing } },
  ]);
  const flying = (value: number, bonusType: string) => [
    { value, bonusType, situation: { local: local.flying } },
  ];
  for (const target of ['attack.melee', 'attack.ranged'] as const)
    expect(conditionalOf(breakdowns[target], sky.key), target).toEqual(
      flying(1, 'racial'),
    );
  for (const statistic of ['ac', 'touchAc', 'cmd'] as const)
    expect(conditionalOf(statistics[statistic], sky.key), statistic).toEqual(
      flying(2, 'dodge'),
    );
  expect(conditionalOf(statistics.flatFootedAc, sky.key)).toEqual([]);
  expect(conditionalOf(breakdowns['skill.per'], sky.key)).toEqual(
    flying(2, 'untyped'),
  );
  expect(
    sheet.calculated.entryNotes
      .filter(({ text }) =>
        [spiritualSupportNote, skySentinelNote].includes(text),
      )
      .map(({ source, text }) => [source, text]),
  ).toEqual([[spiritual.key, spiritualSupportNote]]);
  expect(
    (breakdowns['ac.other'].notes ?? [])
      .filter(({ source }) => source === sky.key)
      .map(({ text }) => text),
  ).toEqual([skySentinelNote]);
  // (A note on `ac` reaches its `ac.other` leaf.)
  // The read's own Situations: the replaced traits' bonuses never apply, the
  // alternates' only in theirs.
  const base = totals(sheet.calculated);
  const under = (...situations: RequestedSituation[]) =>
    resolved(sheet, situations);
  for (const situation of ['giants', 'poison', 'spells'])
    expect(totals(under(situation)), situation).toEqual(base);
  expect(
    totals(
      under(
        localSituation(breakdowns.casterLevel, spiritual.key, local.healing),
      ),
    ),
  ).toEqual({ ...base, casterLevel: base.casterLevel + 1 });
  const inFlight = under(localSituation(statistics.ac, sky.key, local.flying));
  expect(totals(inFlight)).toEqual({
    ...base,
    ac: base.ac + 2,
    touchAc: base.touchAc + 2,
    cmd: base.cmd + 2,
    perception: base.perception + 2,
  });
  expect(inFlight.breakdowns['attack.melee'].total).toBe(
    breakdowns['attack.melee'].total + 1,
  );

  // One alternate deselected: its three traits are back, the other's two
  // stay replaced.
  await choose(sky.key, false, 'sky-off');
  expect(states(await read())).toEqual({
    ...allCounting,
    ...Object.fromEntries(spiritual.replaces.map((key) => [key, grant(true)])),
  });
  // Both deselected: every trait is back, with its outputs.
  await choose(spiritual.key, false, 'spiritual-off');
  const restored = await read();
  expect(states(restored)).toEqual(allCounting);
  expect(
    conditionalOf(
      restored.calculated.derivedStatistics.fortitude,
      traits.hardy,
    ),
  ).not.toEqual([]);
  expect(
    conditionalOf(restored.calculated.breakdowns['skill.apr'], traits.greed),
  ).not.toEqual([]);
  expect(
    conditionalOf(restored.calculated.breakdowns.casterLevel, spiritual.key),
  ).toEqual([]);
});

/** Each trait chosen as a Selection, and their sheet entries. */
async function withTraits({ select }: Fixture) {
  const entries: Record<string, string> = {};
  for (const key of Object.values(traitSelections))
    entries[key] = await select(key);
  return entries;
}

test('cmb, save, skill and spell DC Modifiers and trait Selections’ trait bonuses stay out of every total and are listed in conditional with their Situation', async () => {
  const f = await fixture();
  const raced = await f.read();
  await withTraits(f);
  const sheet = await f.read();
  const { breakdowns, derivedStatistics: statistics } = sheet.calculated;
  expect(totals(sheet.calculated)).toEqual(totals(raced.calculated));
  const listed = (value: number, bonusType: string, situation: Situation) => [
    { value, bonusType, situation },
  ];
  const at = (name: string) => ({ local: name });
  // CMB, never CMD.
  expect(conditionalOf(statistics.cmb, traits.gatecrasher)).toEqual(
    listed(2, 'untyped', 'sunder'),
  );
  expect(conditionalOf(statistics.cmb, traits.relentless)).toEqual(
    [local.bullRush, local.overrun].map((name) => ({
      value: 2,
      bonusType: 'untyped',
      situation: at(name),
    })),
  );
  for (const key of [traits.gatecrasher, traits.relentless])
    expect(conditionalOf(statistics.cmd, key)).toEqual([]);
  // A save target reaches its own save only.
  const saves = ['fortitude', 'reflex', 'will'] as const;
  for (const [key, save, value, bonusType, name] of [
    [traits.desertRunner, 'fortitude', 4, 'racial', local.march],
    [traits.underfoot, 'reflex', 1, 'untyped', local.trample],
    [traits.stubborn, 'will', 2, 'racial', local.compulsion],
    [traitSelections.hunter, 'will', 2, 'trait', local.demonMinds],
  ] as const)
    for (const other of saves)
      expect(conditionalOf(statistics[other], key), `${key} ${other}`).toEqual(
        other === save ? listed(value, bonusType, at(name)) : [],
      );
  // Trait bonuses on every save, in a shared and a local Situation.
  for (const save of saves) {
    expect(conditionalOf(statistics[save], traitSelections.courageous)).toEqual(
      listed(2, 'trait', 'fear'),
    );
    expect(conditionalOf(statistics[save], traitSelections.heresy)).toEqual(
      listed(1, 'trait', at(local.heresy)),
    );
  }
  // Skills: each target its own skill.
  for (const [target, key, value, bonusType, name] of [
    ['skill.crf', traits.craftsman, 2, 'racial', local.craft],
    ['skill.pro', traits.craftsman, 2, 'racial', local.craft],
    ['skill.blf', traitSelections.charming, 1, 'trait', local.attracted],
    ['skill.dip', traitSelections.charming, 1, 'trait', local.attracted],
    ['skill.dev', traitSelections.vagabond, 1, 'trait', local.disable],
    ['skill.esc', traitSelections.vagabond, 1, 'trait', local.escape],
    ['skill.slt', traitSelections.vagabond, 1, 'trait', local.sleight],
    ['skill.sen', traitSelections.canter, 5, 'trait', local.message],
    ['skill.kpl', traitSelections.hunter, 3, 'trait', local.demons],
    ['skill.sur', traitSelections.starchild, 4, 'trait', local.lost],
  ] as const)
    expect(conditionalOf(breakdowns[target], key), target).toEqual(
      listed(value, bonusType, at(name)),
    );
  expect(
    conditionalOf(breakdowns['skill.spl'], traitSelections.loreseeker),
  ).toEqual(listed(2, 'trait', 'identifyMagicItems'));
  // Spell DC: Charming's spell clause, not its skill one.
  expect(conditionalOf(breakdowns.spellDC, traitSelections.charming)).toEqual(
    listed(1, 'trait', at(local.languageDependent)),
  );
  // A trait's attack bonus on melee and ranged attacks.
  for (const target of ['attack.melee', 'attack.ranged'] as const)
    expect(conditionalOf(breakdowns[target], traitSelections.fencer)).toEqual(
      listed(1, 'trait', at(local.opportunity)),
    );
});

test('the read’s own Situations apply them: CMB per maneuver, a save target on its save only, trait bonuses highest-only beside racial ones, and spell DC', async () => {
  const f = await fixture();
  await withTraits(f);
  const sheet = await f.read();
  const base = totals(sheet.calculated);
  const { breakdowns, derivedStatistics: statistics } = sheet.calculated;
  const under = (...situations: RequestedSituation[]) =>
    totals(resolved(sheet, situations));
  const at = (statistic: Statistic, key: string, name: string) =>
    localSituation(statistic, key, name);
  expect(under()).toEqual(base);
  // CMB: +2 to sunder; Relentless's two Situations are one +2; separate
  // untyped bonuses stack. CMD is unchanged.
  const bullRush = at(statistics.cmb, traits.relentless, local.bullRush);
  const overrun = at(statistics.cmb, traits.relentless, local.overrun);
  expect(under('sunder')).toEqual({ ...base, cmb: base.cmb + 2 });
  expect(under(bullRush)).toEqual({ ...base, cmb: base.cmb + 2 });
  expect(under(bullRush, overrun)).toEqual({ ...base, cmb: base.cmb + 2 });
  expect(under('sunder', bullRush)).toEqual({ ...base, cmb: base.cmb + 4 });
  // Each save target raises its own save only.
  expect(
    under(at(statistics.fortitude, traits.desertRunner, local.march)),
  ).toEqual({ ...base, fortitude: base.fortitude + 4 });
  expect(under(at(statistics.reflex, traits.underfoot, local.trample))).toEqual(
    { ...base, reflex: base.reflex + 1 },
  );
  expect(under(at(statistics.will, traits.stubborn, local.compulsion))).toEqual(
    { ...base, will: base.will + 2 },
  );
  // Underfoot's dodge bonus: AC, touch AC and CMD.
  expect(under(at(statistics.ac, traits.underfoot, local.larger))).toEqual({
    ...base,
    ac: base.ac + 1,
    touchAc: base.touchAc + 1,
    cmd: base.cmd + 1,
  });
  // Trait bonuses: against fear, Courageous's +2 trait stacks with
  // Fearless's +2 racial; History of Heresy's +1 trait alone is +1, and
  // beside Courageous only the higher trait bonus applies.
  const allSaves = (change: number) => ({
    fortitude: base.fortitude + change,
    reflex: base.reflex + change,
    will: base.will + change,
  });
  const heresy = at(statistics.will, traitSelections.heresy, local.heresy);
  expect(under('fear')).toEqual({ ...base, ...allSaves(4) });
  expect(under(heresy)).toEqual({ ...base, ...allSaves(1) });
  expect(under('fear', heresy)).toEqual({ ...base, ...allSaves(4) });
  const traitOn = (calculated: Calculated) =>
    sourceValuesOf(calculated.derivedStatistics.will.applied, 'trait');
  const both = resolved(sheet, ['fear', heresy]);
  expect(traitOn(both)).toEqual([[traitSelections.courageous, 2]]);
  expect(
    sourceValuesOf(both.derivedStatistics.will.suppressed, 'trait'),
  ).toEqual([[traitSelections.heresy, 1]]);
  // Two trait Situations on Will: the higher +2, not +4.
  const demonMinds = at(
    statistics.will,
    traitSelections.hunter,
    local.demonMinds,
  );
  expect(under(demonMinds)).toEqual({ ...base, will: base.will + 2 });
  expect(under(demonMinds, heresy)).toEqual({
    ...base,
    ...allSaves(1),
    will: base.will + 2,
  });
  // Skills, each in its own Situation; Craftsman's one Situation reaches
  // Craft and Profession, Charming's Bluff and Diplomacy.
  expect(
    under(at(breakdowns['skill.crf'], traits.craftsman, local.craft)),
  ).toEqual({
    ...base,
    craft: base.craft + 2,
    profession: base.profession + 2,
  });
  expect(
    under(
      at(breakdowns['skill.blf'], traitSelections.charming, local.attracted),
    ),
  ).toEqual({ ...base, bluff: base.bluff + 1, diplomacy: base.diplomacy + 1 });
  for (const [target, key, name, total, value] of [
    ['skill.dev', traitSelections.vagabond, local.disable, 'disableDevice', 1],
    ['skill.esc', traitSelections.vagabond, local.escape, 'escapeArtist', 1],
    ['skill.slt', traitSelections.vagabond, local.sleight, 'sleightOfHand', 1],
    ['skill.sen', traitSelections.canter, local.message, 'senseMotive', 5],
    ['skill.kpl', traitSelections.hunter, local.demons, 'knowledgePlanes', 3],
    ['skill.sur', traitSelections.starchild, local.lost, 'survival', 4],
  ] as const)
    expect(under(at(breakdowns[target], key, name)), target).toEqual({
      ...base,
      [total]: base[total] + value,
    });
  // Loreseeker's +2 trait and Elven Magic's +2 racial stack on Spellcraft.
  expect(under('identifyMagicItems')).toEqual({
    ...base,
    spellcraft: base.spellcraft + 4,
  });
  // Spell DC: +1 for a language-dependent spell on such a creature only.
  expect(
    under(
      at(breakdowns.spellDC, traitSelections.charming, local.languageDependent),
    ),
  ).toEqual({ ...base, spellDC: base.spellDC + 1 });
});

test('a trait’s attack bonus reaches every routine line in its Situation, beside a racial one', async () => {
  const f = await fixture();
  await withTraits(f);
  const sheet = await f.read();
  const { breakdowns } = sheet.calculated;
  const attacks = (situations: RequestedSituation[]) => {
    const calculated = resolved(sheet, situations);
    return {
      sword: line(calculated, f.sword).attackBonus.total,
      bow: line(calculated, f.bow).attackBonus.total,
    };
  };
  const base = attacks([]);
  for (const weapon of [f.sword, f.bow])
    expect(
      conditionalOf(
        line(sheet.calculated, weapon).attackBonus,
        traitSelections.fencer,
      ),
    ).toEqual([
      { value: 1, bonusType: 'trait', situation: { local: local.opportunity } },
    ]);
  const opportunity = localSituation(
    breakdowns['attack.melee'],
    traitSelections.fencer,
    local.opportunity,
  );
  const orcs = localSituation(
    breakdowns['attack.melee'],
    traits.hatred,
    local.orcs,
  );
  expect(attacks([opportunity])).toEqual({
    sword: base.sword + 1,
    bow: base.bow + 1,
  });
  expect(attacks([opportunity, orcs])).toEqual({
    sword: base.sword + 2,
    bow: base.bow + 2,
  });
});

test('a trait’s note on a skill reaches that skill, and a trait made inactive leaves the sheet', async () => {
  const f = await fixture();
  const chosen = await withTraits(f);
  const sheet = await f.read();
  const { breakdowns } = sheet.calculated;
  const notesOf = (target: 'skill.sur' | 'skill.per', key: string) =>
    (breakdowns[target].notes ?? [])
      .filter(({ source }) => source === key)
      .map(({ text }) => text);
  expect(notesOf('skill.sur', traitSelections.starchild)).toEqual([northNote]);
  expect(notesOf('skill.per', traitSelections.starchild)).toEqual([]);
  expect(
    sheet.calculated.entryNotes.some(({ text }) => text === northNote),
  ).toBe(false);
  // Courageous made inactive: no trait bonus is listed or applies.
  const entryId = chosen[traitSelections.courageous];
  if (!entryId) throw new Error('Missing Courageous');
  await f.member.mutation(api.characterSheet.editSelection, {
    ...f.scope,
    entryId: entryId as Id<'characterSheetEntry'>,
    active: false,
    operationId: 'courageous-off',
  });
  const off = await f.read();
  expect(
    conditionalOf(
      off.calculated.derivedStatistics.will,
      traitSelections.courageous,
    ),
  ).toEqual([]);
  expect(totals(resolved(off, ['fear'])).will).toBe(
    off.calculated.derivedStatistics.will.total + 2,
  );
});

/** Each sword and bow line's attack and damage totals. */
function lineTotals(calculated: Calculated, { sword, bow }: Fixture) {
  return {
    swordAttack: line(calculated, sword).attackBonus.total,
    swordDamage: line(calculated, sword).damageBonus.total,
    bowAttack: line(calculated, bow).attackBonus.total,
    bowDamage: line(calculated, bow).damageBonus.total,
  };
}

test('damage and melee damage Modifiers stay out of every total, are listed on their damage statistics and routine lines, and apply in their Situations, trait bonuses highest only', async () => {
  const f = await fixture();
  const raced = await f.read();
  for (const key of [extended.dirtyFighter, extended.divineWarrior])
    await f.select(key);
  const sheet = await f.read();
  const { breakdowns } = sheet.calculated;
  const base = lineTotals(sheet.calculated, f);
  expect(base).toEqual(lineTotals(raced.calculated, f));
  expect(totals(sheet.calculated)).toEqual(totals(raced.calculated));
  for (const target of ['damage.melee', 'damage.ranged'] as const)
    expect(breakdowns[target].total, target).toBe(
      raced.calculated.breakdowns[target].total,
    );
  const flanking = [
    { value: 1, bonusType: 'trait', situation: { local: local.flanking } },
  ];
  const divine = [
    { value: 1, bonusType: 'trait', situation: { local: local.divine } },
  ];
  // `damage` reaches melee and ranged damage; `damage.melee` melee only.
  expect(
    conditionalOf(breakdowns['damage.melee'], extended.dirtyFighter),
  ).toEqual(flanking);
  expect(
    conditionalOf(breakdowns['damage.ranged'], extended.dirtyFighter),
  ).toEqual(flanking);
  expect(
    conditionalOf(breakdowns['damage.melee'], extended.divineWarrior),
  ).toEqual(divine);
  expect(
    conditionalOf(breakdowns['damage.ranged'], extended.divineWarrior),
  ).toEqual([]);
  // No attack statistic lists either.
  for (const target of ['attack.melee', 'attack.ranged'] as const)
    for (const key of [extended.dirtyFighter, extended.divineWarrior])
      expect(conditionalOf(breakdowns[target], key), target).toEqual([]);
  // On the routine lines: both on the sword's damage, Dirty Fighter's on the
  // bow's.
  const swordDamage = line(sheet.calculated, f.sword).damageBonus;
  const bowDamage = line(sheet.calculated, f.bow).damageBonus;
  expect(conditionalOf(swordDamage, extended.dirtyFighter)).toEqual(flanking);
  expect(conditionalOf(swordDamage, extended.divineWarrior)).toEqual(divine);
  expect(conditionalOf(bowDamage, extended.dirtyFighter)).toEqual(flanking);
  expect(conditionalOf(bowDamage, extended.divineWarrior)).toEqual([]);
  // The read's own Situations apply them.
  const flank = localSituation(
    breakdowns['damage.melee'],
    extended.dirtyFighter,
    local.flanking,
  );
  const blessed = localSituation(
    breakdowns['damage.melee'],
    extended.divineWarrior,
    local.divine,
  );
  const lines = (...situations: RequestedSituation[]) =>
    lineTotals(resolved(sheet, situations), f);
  expect(lines()).toEqual(base);
  expect(lines(flank)).toEqual({
    ...base,
    swordDamage: base.swordDamage + 1,
    bowDamage: base.bowDamage + 1,
  });
  expect(lines(blessed)).toEqual({
    ...base,
    swordDamage: base.swordDamage + 1,
  });
  // Two trait bonuses on the sword's damage: the higher +1, not +2; the
  // other is suppressed.
  const both = resolved(sheet, [flank, blessed]);
  expect(lineTotals(both, f)).toEqual({
    ...base,
    swordDamage: base.swordDamage + 1,
    bowDamage: base.bowDamage + 1,
  });
  const swordBoth = line(both, f.sword).damageBonus;
  expect(
    [
      ...sourcesOf(swordBoth.applied, 'trait'),
      ...sourcesOf(swordBoth.suppressed, 'trait'),
    ].sort(),
  ).toEqual([extended.dirtyFighter, extended.divineWarrior].sort());
  expect(sourcesOf(swordBoth.applied, 'trait')).toHaveLength(1);
  // Beside Hatred's racial attack bonus nothing else changes.
  const orcs = localSituation(
    breakdowns['attack.melee'],
    traits.hatred,
    local.orcs,
  );
  expect(lines(flank, orcs)).toEqual({
    swordAttack: base.swordAttack + 1,
    swordDamage: base.swordDamage + 1,
    bowAttack: base.bowAttack + 1,
    bowDamage: base.bowDamage + 1,
  });
  // A note on `damage` reaches melee and ranged damage; one on
  // `damage.melee` melee only; neither reaches the entry notes.
  const notesOf = (target: 'damage.melee' | 'damage.ranged') =>
    (breakdowns[target].notes ?? [])
      .map(({ source, text }) => [source, text])
      .sort();
  expect(notesOf('damage.melee')).toEqual(
    [
      [extended.dirtyFighter, bruteNote],
      [extended.divineWarrior, flameNote],
    ].sort(),
  );
  expect(notesOf('damage.ranged')).toEqual([
    [extended.dirtyFighter, bruteNote],
  ]);
  expect(
    sheet.calculated.entryNotes.some(({ text }) =>
      [bruteNote, flameNote].includes(text),
    ),
  ).toBe(false);
});

test('circumstance and competence Modifiers stay out of every total and are listed with their Situation; circumstance bonuses from different sources stack, competence bonuses don’t', async () => {
  const f = await fixture();
  const raced = await f.read();
  for (const key of [
    extended.paired,
    extended.dimensional,
    extended.coordinated,
    extended.cudgeler,
    extended.shielded,
    feats.casting,
  ])
    await f.select(key);
  const sheet = await f.read();
  const { breakdowns, derivedStatistics: statistics } = sheet.calculated;
  const base = totals(sheet.calculated);
  const baseLines = lineTotals(sheet.calculated, f);
  expect(base).toEqual(totals(raced.calculated));
  expect(baseLines).toEqual(lineTotals(raced.calculated, f));
  const listed = (value: number, bonusType: string, name: string) => ({
    value,
    bonusType,
    situation: { local: name },
  });
  // Circumstance on attack: both attack statistics and every line.
  for (const statistic of [
    breakdowns['attack.melee'],
    breakdowns['attack.ranged'],
    line(sheet.calculated, f.sword).attackBonus,
    line(sheet.calculated, f.bow).attackBonus,
  ]) {
    expect(conditionalOf(statistic, extended.paired)).toEqual([
      listed(4, 'circumstance', local.paired),
    ]);
    expect(conditionalOf(statistic, extended.dimensional)).toEqual([
      listed(2, 'circumstance', local.summoned),
    ]);
  }
  for (const key of [extended.paired, extended.dimensional])
    expect(conditionalOf(breakdowns['damage.melee'], key)).toEqual([]);
  // Competence on CMB, never CMD.
  expect(conditionalOf(statistics.cmb, extended.coordinated)).toEqual([
    listed(2, 'competence', local.coordinated),
    listed(4, 'competence', local.grapple),
  ]);
  expect(conditionalOf(statistics.cmb, extended.cudgeler)).toEqual([
    listed(2, 'competence', local.sweep),
  ]);
  for (const key of [extended.coordinated, extended.cudgeler])
    expect(conditionalOf(statistics.cmd, key)).toEqual([]);
  // Competence on concentration, two increments marked to stack.
  expect(
    breakdowns.concentration.conditional
      .filter(({ source }) => source === extended.shielded)
      .map(({ value, bonusType, stacksWithinEntry }) => [
        value,
        bonusType,
        stacksWithinEntry ?? false,
      ]),
  ).toEqual([
    [4, 'competence', false],
    [1, 'competence', true],
    [2, 'competence', true],
  ]);
  const under = (...situations: RequestedSituation[]) =>
    totals(resolved(sheet, situations));
  const lines = (...situations: RequestedSituation[]) =>
    lineTotals(resolved(sheet, situations), f);
  const at = (statistic: Statistic, key: string, name: string) =>
    localSituation(statistic, key, name);
  // Circumstance: +4 and +2 alone, +6 together, on every line's attack.
  const paired = at(breakdowns['attack.melee'], extended.paired, local.paired);
  const summoned = at(
    breakdowns['attack.melee'],
    extended.dimensional,
    local.summoned,
  );
  const attacks = (change: number) => ({
    ...baseLines,
    swordAttack: baseLines.swordAttack + change,
    bowAttack: baseLines.bowAttack + change,
  });
  expect(lines(paired)).toEqual(attacks(4));
  expect(lines(summoned)).toEqual(attacks(2));
  expect(lines(paired, summoned)).toEqual(attacks(6));
  const circumstanceOn = sourceValuesOf(
    resolved(sheet, [paired, summoned]).breakdowns['attack.melee'].applied,
    'circumstance',
  ).sort();
  expect(circumstanceOn).toEqual(
    [
      [extended.paired, 4],
      [extended.dimensional, 2],
    ].sort(),
  );
  // Competence on CMB: +2 from either source, still +2 from both, the other
  // suppressed; +4 breaking a grapple, which one entry's other Situation
  // doesn't raise; Gatecrasher's untyped +2 stacks with it.
  const coordinated = at(
    statistics.cmb,
    extended.coordinated,
    local.coordinated,
  );
  const grapple = at(statistics.cmb, extended.coordinated, local.grapple);
  const sweep = at(statistics.cmb, extended.cudgeler, local.sweep);
  expect(under(coordinated)).toEqual({ ...base, cmb: base.cmb + 2 });
  expect(under(sweep)).toEqual({ ...base, cmb: base.cmb + 2 });
  expect(under(coordinated, sweep)).toEqual({ ...base, cmb: base.cmb + 2 });
  const competence = resolved(sheet, [coordinated, sweep]).derivedStatistics
    .cmb;
  expect(sourcesOf(competence.applied, 'competence')).toHaveLength(1);
  expect(
    [
      ...sourcesOf(competence.applied, 'competence'),
      ...sourcesOf(competence.suppressed, 'competence'),
    ].sort(),
  ).toEqual([extended.coordinated, extended.cudgeler].sort());
  expect(under(grapple, sweep)).toEqual({ ...base, cmb: base.cmb + 4 });
  expect(under(coordinated, grapple)).toEqual({ ...base, cmb: base.cmb + 4 });
  expect(under('sunder', coordinated)).toEqual({ ...base, cmb: base.cmb + 4 });
  // Competence within one entry: +4, and each marked increment adds to it;
  // Combat Casting's untyped +4 stacks.
  const shielded = at(
    breakdowns.concentration,
    extended.shielded,
    local.shielded,
  );
  const lightShield = at(
    breakdowns.concentration,
    extended.shielded,
    local.lightShield,
  );
  const heavyShield = at(
    breakdowns.concentration,
    extended.shielded,
    local.heavyShield,
  );
  const defensively = at(
    breakdowns.concentration,
    feats.casting,
    local.casting,
  );
  const concentration = (change: number) => ({
    ...base,
    concentration: base.concentration + change,
  });
  expect(under(shielded)).toEqual(concentration(4));
  expect(under(shielded, lightShield)).toEqual(concentration(5));
  expect(under(shielded, heavyShield)).toEqual(concentration(6));
  expect(under(shielded, defensively)).toEqual(concentration(8));
  // Unrelated Situations reach none of them.
  expect(under('spellResistance', 'fear')).toMatchObject({
    cmb: base.cmb,
    concentration: base.concentration,
  });
  expect(lines('fear', 'sunder')).toEqual(baseLines);
});

/**
 * The fixture with a third level, in the released Wizard, Intelligence 14
 * (+2) and Charming chosen: the Wizard casts 0- and 1st-level spells.
 */
async function wizardFixture() {
  const f = await fixture();
  await f.member.mutation(api.characterSheet.addClassLevel, {
    ...f.scope,
    classEntryId: f.id(classes.wizard),
    operationId: 'wizard-1',
  });
  await f.member.mutation(api.characterSheet.editBaseScores, {
    ...f.scope,
    scores: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 14,
      wisdom: 10,
      charisma: 10,
    },
    operationId: 'intelligence',
  });
  const charming = await f.select(traitSelections.charming);
  for (const key of [feats.casting, feats.penetration]) await f.select(key);
  return { ...f, charming };
}

/** The Wizard's Spellcasting on a calculation. */
function wizardOf(calculated: Calculated) {
  const casting = calculated.spellcastings.find(
    ({ classTag }) => classTag === 'wizard',
  );
  if (!casting) throw new Error('Missing the Wizard Spellcasting');
  return casting;
}

/** One slot's DC, with the contributions that build it. */
function slotDC(calculated: Calculated, spellLevel: number) {
  const slot = wizardOf(calculated).slots.find(
    (row) => row.spellLevel === spellLevel,
  );
  if (!slot) throw new Error(`Missing the ${spellLevel}-level slot`);
  return {
    total: slot.dc.total,
    unresolved: slot.dcUnresolved,
    // A built-in contribution by its name, a Modifier by its source.
    applied: slot.dc.applied.map(
      ({ entryName, source, builtIn, value, bonusType }) => ({
        from: builtIn ? entryName : (source ?? entryName),
        value,
        bonusType,
      }),
    ),
    conditional: conditionalOf(slot.dc, traitSelections.charming),
  };
}

test('a spell DC Modifier reaches the Spellcasting’s real slot DCs, 10 + spell level + ability modifier, only in its Situation', async () => {
  const f = await wizardFixture();
  const sheet = await f.read();
  const casting = wizardOf(sheet.calculated);
  expect(casting).toMatchObject({
    name: 'Proof Wizard',
    ability: 'intelligence',
    castableSpellLevels: [0, 1],
  });
  const firstSlot = casting.slots.find((row) => row.spellLevel === 1);
  if (!firstSlot) throw new Error('Missing the 1st-level slot');
  const languageDependent = localSituation(
    firstSlot.dc,
    traitSelections.charming,
    local.languageDependent,
  );
  const listed = [
    {
      value: 1,
      bonusType: 'trait',
      situation: { local: local.languageDependent },
    },
  ];
  // Before: 10 + 1 + 2 at 1st level and 10 + 0 + 2 at 0, each listing
  // Charming's +1 in its Situation and applying none of it.
  const base = (spellLevel: number) => ({
    total: 12 + spellLevel,
    unresolved: false,
    applied: expect.arrayContaining([
      expect.objectContaining({ from: 'Spell level', value: 10 + spellLevel }),
      expect.objectContaining({ from: 'Casting ability modifier', value: 2 }),
    ]),
    conditional: listed,
  });
  for (const spellLevel of [0, 1]) {
    const dc = slotDC(sheet.calculated, spellLevel);
    expect(dc, `${spellLevel} before`).toEqual(base(spellLevel));
    expect(dc.applied.map(({ from }) => from)).not.toContain(
      traitSelections.charming,
    );
  }
  // Within its Situation: +1 trait on every slot's DC, applied.
  const within = resolved(sheet, [languageDependent]);
  for (const spellLevel of [0, 1]) {
    const dc = slotDC(within, spellLevel);
    expect(dc.total, `${spellLevel} within`).toBe(13 + spellLevel);
    expect(dc.applied).toContainEqual({
      from: traitSelections.charming,
      value: 1,
      bonusType: 'trait',
    });
  }
  // Outside it: Charming's skill Situation, a same-named local Situation on
  // another entry, and an unrelated shared one leave every DC as it was.
  const attracted = localSituation(
    sheet.calculated.breakdowns['skill.blf'],
    traitSelections.charming,
    local.attracted,
  );
  for (const [label, situations] of [
    ['its skill Situation', [attracted]],
    [
      'another entry’s local Situation',
      [{ local: local.languageDependent, sheetEntryId: 'another-entry' }],
    ],
    ['a shared Situation', ['spellResistance', 'fear']],
  ] as const) {
    const outside = resolved(sheet, [...situations]);
    for (const spellLevel of [0, 1])
      expect(slotDC(outside, spellLevel), `${label} ${spellLevel}`).toEqual(
        base(spellLevel),
      );
  }
  // Made inactive, Charming leaves the DCs: listed nowhere, applied nowhere.
  await f.member.mutation(api.characterSheet.editSelection, {
    ...f.scope,
    entryId: f.charming,
    active: false,
    operationId: 'charming-off',
  });
  const off = await f.read();
  for (const spellLevel of [0, 1]) {
    expect(slotDC(off.calculated, spellLevel).conditional).toEqual([]);
    expect(slotDC(resolved(off, [languageDependent]), spellLevel).total).toBe(
      12 + spellLevel,
    );
  }
});

test('caster level and concentration Modifiers reach the Spellcasting’s own caster level and concentration only in their Situations', async () => {
  const f = await wizardFixture();
  const sheet = await f.read();
  const casting = wizardOf(sheet.calculated);
  const casterLevel = casting.casterLevel;
  const concentration = casting.concentration;
  if (!casterLevel || !concentration)
    throw new Error('Missing the Wizard caster level or concentration');
  // Wizard 1: caster level 1; concentration 1 + Intelligence +2.
  expect([casterLevel.total, concentration.total]).toEqual([1, 3]);
  expect(conditionalOf(casterLevel, feats.penetration)).toEqual([
    { value: 2, bonusType: 'untyped', situation: 'spellResistance' },
  ]);
  expect(conditionalOf(casterLevel, traits.magic)).toEqual([
    { value: 2, bonusType: 'racial', situation: 'spellResistance' },
  ]);
  expect(conditionalOf(concentration, feats.casting)).toEqual([
    { value: 4, bonusType: 'untyped', situation: { local: local.casting } },
  ]);
  const defensively = localSituation(
    concentration,
    feats.casting,
    local.casting,
  );
  const of = (situations: RequestedSituation[]) => {
    const resolvedCasting = wizardOf(resolved(sheet, situations));
    return {
      casterLevel: resolvedCasting.casterLevel?.total,
      concentration: resolvedCasting.concentration?.total,
      dc: resolvedCasting.slots.find((row) => row.spellLevel === 1)?.dc.total,
    };
  };
  const base = { casterLevel: 1, concentration: 3, dc: 13 };
  expect(of([])).toEqual(base);
  // Against spell resistance: +2 racial and +2 untyped stack on the check,
  // and the DC doesn't move. (Concentration, composed from this caster
  // level, is not asserted in that Situation: reported, body-ext fix r1.)
  expect(of(['spellResistance'])).toMatchObject({ casterLevel: 5, dc: 13 });
  // Casting defensively: +4 concentration only.
  expect(of([defensively])).toEqual({ ...base, concentration: 7 });
  expect(of(['spells', 'identifyMagicItems'])).toEqual(base);
});

test('a competence concentration Modifier reaches the Spellcasting’s own concentration only in its Situation, its marked increment adding to it', async () => {
  const f = await wizardFixture();
  await f.select(extended.shielded);
  const sheet = await f.read();
  const concentration = wizardOf(sheet.calculated).concentration;
  if (!concentration) throw new Error('Missing the Wizard concentration');
  expect(concentration.total).toBe(3);
  expect(conditionalOf(concentration, extended.shielded)).toEqual(
    [local.shielded, local.lightShield, local.heavyShield].map(
      (name, index) => ({
        value: [4, 1, 2][index],
        bonusType: 'competence',
        situation: { local: name },
      }),
    ),
  );
  const at = (name: string) =>
    localSituation(concentration, extended.shielded, name);
  const of = (...situations: RequestedSituation[]) =>
    wizardOf(resolved(sheet, situations)).concentration?.total;
  expect(of()).toBe(3);
  expect(of(at(local.shielded))).toBe(7);
  expect(of(at(local.shielded), at(local.lightShield))).toBe(8);
  expect(of(at(local.shielded), at(local.heavyShield))).toBe(9);
  // Beside Combat Casting's untyped +4: they stack.
  const defensively = localSituation(
    concentration,
    feats.casting,
    local.casting,
  );
  expect(of(at(local.shielded), defensively)).toBe(11);
  expect(of('fear', 'spells')).toBe(3);
});

test('an outsider is refused', async () => {
  const { outsider, scope } = await fixture();
  await expect(outsider.query(api.characterSheet.read, scope)).rejects.toThrow(
    'You do not have access to this org',
  );
});

// The word fixture (sb-tie): each word the family's scope certifies, one
// body each, on one sheet of the word race (its Racial Trait cases are the
// race's standard traits; the feat and trait cases are chosen as
// Selections), with the proof's classes and weapons. Every case is asserted
// alike, from its data, so the catalog test's coverage tie can read the
// fixture as what this proof exercises.
const wordBodies: Released[] = [
  body({
    externalKey: wordRace,
    name: 'Source Body Word Race',
    pack: 'races',
    detail: {
      kind: 'race',
      racialHitDice: 0,
      creatureTypes: ['humanoid'],
      creatureSubtypes: [],
      racialTraits: wordCases
        .filter(({ kind }) => kind === 'racialTrait')
        .map(({ key }) => key),
      size: 'medium',
    },
  }),
  ...wordCases.map((wordCase) => {
    const { key, name, kind } = wordCase;
    const outputs = wordOutputs(wordCase);
    if (kind === 'racialTrait')
      return racialTrait(key, name, {
        ...outputs,
        detail: { raceKeys: [wordRace] },
      });
    return kind === 'feat'
      ? feat(key, name, outputs)
      : trait(key, name, outputs);
  }),
  ...bodies.filter(
    ({ detail }) => detail.kind === 'class' || detail.kind === 'item',
  ),
];

/** The leaf statistics a target reaches (`expandModifier`, `noteMatchesTarget`). */
function leavesOf(target: string): readonly string[] {
  const parents: Record<string, readonly string[]> = {
    ac: ['ac.other'],
    saves: ['save.fort', 'save.ref', 'save.will'],
    attack: ['attack.melee', 'attack.ranged'],
    damage: ['damage.melee', 'damage.ranged'],
  };
  return parents[target] ?? [target];
}
/**
 * The derived statistics and routine lines a leaf's bonus of a type raises:
 * a save its save, a dodge bonus AC, touch AC and CMD (never flat-footed AC),
 * CMB and CMD themselves, and each attack and damage leaf its weapon's line.
 */
function derivedOf(leaf: string, bonusType: string): readonly string[] {
  if (leaf === 'ac.other') {
    if (bonusType !== 'dodge')
      throw new Error(`No reach for an ac ${bonusType} bonus`);
    return ['derived.ac', 'derived.touchAc', 'derived.cmd'];
  }
  const reach: Record<string, readonly string[]> = {
    'save.fort': ['derived.fortitude'],
    'save.ref': ['derived.reflex'],
    'save.will': ['derived.will'],
    cmb: ['derived.cmb'],
    cmd: ['derived.cmd'],
    'attack.melee': ['line.swordAttack'],
    'attack.ranged': ['line.bowAttack'],
    'damage.melee': ['line.swordDamage'],
    'damage.ranged': ['line.bowDamage'],
  };
  return reach[leaf] ?? [];
}

/** Every leaf total, the derived defenses and saves, and both lines. */
function snapshot(calculated: Calculated, weapons: Fixture) {
  const { breakdowns, derivedStatistics: statistics } = calculated;
  const lines = lineTotals(calculated, weapons);
  return {
    ...Object.fromEntries(
      Object.entries(breakdowns).map(([leaf, { total }]) => [leaf, total]),
    ),
    'derived.fortitude': statistics.fortitude.total,
    'derived.reflex': statistics.reflex.total,
    'derived.will': statistics.will.total,
    'derived.ac': statistics.ac.total,
    'derived.touchAc': statistics.touchAc.total,
    'derived.flatFootedAc': statistics.flatFootedAc.total,
    'derived.cmb': statistics.cmb.total,
    'derived.cmd': statistics.cmd.total,
    ...Object.fromEntries(
      Object.entries(lines).map(([name, total]) => [`line.${name}`, total]),
    ),
  };
}

/** The case's word, as its label: its kind and its one output. */
function wordLabel({ kind, output }: WordCase) {
  const kindOf = (situation: unknown) =>
    situation === undefined
      ? 'none'
      : typeof situation === 'string'
        ? 'shared'
        : 'local';
  if (output.kind === 'modifier') {
    const { condition, target, bonusType, value } = output.modifier;
    return `${kind}: ${kindOf(condition.situation)} ${target} ${bonusType} ${value}`;
  }
  const { target, situation } = output.note;
  return `${kind}: note ${target ?? 'untargeted'} ${kindOf(situation)}`;
}

let wordSheet:
  | Promise<{ f: Fixture; sheet: Sheet; base: ReturnType<typeof snapshot> }>
  | undefined;
/** The word sheet, built once for every case. */
function words() {
  wordSheet ??= (async () => {
    const f = await fixture({ released: wordBodies, chosenRace: wordRace });
    for (const { key, kind } of wordCases)
      if (kind !== 'racialTrait') await f.select(key);
    const sheet = await f.read();
    const base = snapshot(resolved(sheet, []), f);
    // The read's own totals are the totals in no Situation.
    expect(snapshot(sheet.calculated, f)).toEqual(base);
    return { f, sheet, base };
  })();
  return wordSheet;
}

type Words = Awaited<ReturnType<typeof words>>;
type Breakdowns = Calculated['breakdowns'];
/** One leaf's statistic, by its key. */
const leafOf = (breakdowns: Breakdowns, leaf: string) =>
  breakdowns[leaf as keyof Breakdowns];

/**
 * The Situation a case's Modifier is in, as the client requests it, and one
 * it is not in: another shared key, or its local name on another entry.
 */
function requestsOf(
  breakdowns: Breakdowns,
  key: string,
  { target, condition: { situation } }: WordModifier,
): [inside: RequestedSituation, elsewhere: RequestedSituation] {
  if (typeof situation === 'string')
    return [situation, 'sourceBodyWordElsewhere'];
  const [first = target] = leavesOf(target);
  return [
    localSituation(leafOf(breakdowns, first), key, situation.local),
    { local: situation.local, sheetEntryId: 'another-entry' },
  ];
}

/** Every leaf's conditional rows from the case, as the reached ones expect. */
function expectListedOn(
  { breakdowns, key }: { breakdowns: Breakdowns; key: string },
  reached: readonly string[],
  rows: unknown[],
) {
  for (const leaf of Object.keys(breakdowns))
    expect(conditionalOf(leafOf(breakdowns, leaf), key), leaf).toEqual(
      reached.includes(leaf) ? rows : [],
    );
}

/**
 * A Modifier case: listed on exactly its leaves with its Situation and in no
 * total; outside its Situation no total changes; inside it each reached
 * leaf, and what it feeds, rises by the value, the case's own contribution
 * applied, and nothing else changes.
 */
function expectModifierWord(
  { f, sheet, base }: Words,
  key: string,
  modifier: WordModifier,
) {
  const { target, bonusType, value, condition } = modifier;
  const { breakdowns } = sheet.calculated;
  const reached = leavesOf(target);
  expectListedOn({ breakdowns, key }, reached, [
    { value, bonusType, situation: condition.situation },
  ]);
  const [inside, elsewhere] = requestsOf(breakdowns, key, modifier);
  expect(snapshot(resolved(sheet, [elsewhere]), f)).toEqual(base);
  const applied = resolved(sheet, [inside]);
  const expected: Record<string, number> = { ...base };
  for (const name of reached.flatMap((leaf) => [
    leaf,
    ...derivedOf(leaf, bonusType),
  ]))
    expected[name] = (expected[name] ?? Number.NaN) + value;
  expect(snapshot(applied, f)).toEqual(expected);
  for (const leaf of reached)
    expect(
      sourceValuesOf(
        leafOf(applied.breakdowns, leaf).applied,
        bonusType,
      ).filter(([source]) => source === key),
      leaf,
    ).toEqual([[key, value]]);
}

/**
 * A note case: on the entry when untargeted, else on exactly its leaves
 * with its Situation; it changes no number, in its Situation or out of it.
 */
function expectNoteWord(
  { f, sheet, base }: Words,
  key: string,
  note: WordNote,
) {
  const { breakdowns, entryNotes } = sheet.calculated;
  const reached = note.target ? leavesOf(note.target) : [];
  expect(
    entryNotes.filter(({ source }) => source === key).map(({ text }) => text),
  ).toEqual(reached.length ? [] : [note.text]);
  const notesOf = (leaf: string) =>
    (leafOf(breakdowns, leaf).notes ?? []).filter(
      ({ source }) => source === key,
    );
  for (const leaf of Object.keys(breakdowns))
    expect(
      notesOf(leaf).map(({ situation, text }) => ({ situation, text })),
      leaf,
    ).toEqual(
      reached.includes(leaf)
        ? [{ situation: note.situation, text: note.text }]
        : [],
    );
  expectListedOn({ breakdowns, key }, [], []);
  const { situation } = note;
  if (situation === undefined) return;
  const [row] = notesOf(reached[0] ?? '');
  if (!row) throw new Error(`Missing the note of ${key}`);
  const requested: RequestedSituation =
    typeof situation === 'string'
      ? situation
      : { local: situation.local, sheetEntryId: row.sheetEntryId };
  expect(snapshot(resolved(sheet, [requested]), f)).toEqual(base);
}

test.each(wordCases.map((wordCase) => [wordLabel(wordCase), wordCase]))(
  'the word %s reaches exactly its statistics, only in its Situation',
  async (_, { key, output }) => {
    const sheet = await words();
    if (output.kind === 'modifier')
      expectModifierWord(sheet, key, output.modifier);
    else expectNoteWord(sheet, key, output.note);
  },
);
