/// <reference types="vite/client" />
// @vitest-environment edge-runtime
// pbl-released-spells-1 (PRD #251): the spell batches' integration tests
// (catalogSpells516 to catalogSpells526), on entries imported from the
// pinned store. Each row records a batch's Spells on one class's list of a
// Convex-backed saved sheet, and every row runs every step the eleven batch
// tests ran between them: the class baseline and its casting numbers; per
// Spell, the browser's row, the recorded entry, the saved definition, its
// collection row and level warning, a sheet the Spell leaves as it was, and
// a client preview equal to the saved sheet; a player-written running effect
// where the batch test wrote one; and the refusals of other campaigns,
// Characters, outsiders and anonymous callers, then removal. The rule values
// each step reads are literals in the row.
import { convexTest } from 'convex-test';
import type { FunctionArgs, FunctionReturnType } from 'convex/server';
import { describe, expect, test } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';
import { calculateCharacterSheetPreview } from '../../src/components/character-sheet/calculate-character-sheet-preview';
import { extractCatalogDescriptionText } from '../../src/lib/catalog/description-text';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import { abilityKeys } from '../../src/lib/character-sheet';
import { findReviewedClassCasting } from '../../src/lib/character-sheet-casting-tables';
import { withSheetCatalog } from '../character-sheet-catalog';
import { importReleasedEntries } from './released-entries';
import { spellcastingClasses } from './released-spell-keys';
import { importedClass, importedSpell } from './released-spell-sheet';

const modules = import.meta.glob('../../convex/**/*.ts');

/** One Spell a row records, with the literals its steps check. */
type IntegrationSpell = {
  name: string;
  key: string;
  /** Its level on the row's class list, where it is recorded. */
  level: number;
  school: string;
  /** Its imported class levels, whole. */
  levels: Readonly<Record<string, number>>;
  /** Its committed Attribution Assessment's status. */
  assessment: 'unresolved' | 'confirmed';
  /** The sheet's warnings about its recorded entry: kind, check, message. */
  warnings: readonly (readonly [string, string, string])[];
  /** The operation ID its batch test recorded it with. */
  recordOperation: string;
};

/** The totals a step reads, current or permanent. */
type Totals = {
  /** Ability scores in `abilityKeys` order. */
  scores: readonly number[];
  fortitude: number;
  reflex: number;
  will: number;
  attackMelee: number;
  damageMelee: number;
};

/**
 * A running Spell Effect a player writes for a recorded Spell, as the batch
 * test wrote it, with the totals while it runs (current, permanent, and the
 * client's under the fear Situation) and once it stops.
 */
type RunningEffect = {
  name: string;
  spellKey: string;
  defaultCasterLevel: number;
  modifiers: FunctionArgs<
    typeof api.characterSheet.createSheetEntry
  >['modifiers'];
  /** The operation ID its batch test wrote it with. */
  operationId: string;
  running: Totals;
  runningPermanent: Totals;
  fearfulWill: number;
  fearfulPermanentWill: number;
};

/**
 * The class whose list a row's Spells go on, with its collection's heading:
 * the Wizard of the sheet's baseline catalog keeps a Spellbook; an Oracle,
 * installed from its released entry, knows its Spells.
 */
type CastingClass =
  | { className: 'Wizard'; heading: 'Spellbook' }
  | { className: 'Oracle'; heading: 'Spells known' };

type IntegrationRow = CastingClass &
  RunningPath & {
    batch: string;
    scores: Partial<
      Record<
        | 'strength'
        | 'dexterity'
        | 'constitution'
        | 'intelligence'
        | 'wisdom'
        | 'charisma',
        number
      >
    >;
    /** The class baseline's totals, current and permanent, before any Spell. */
    baseline: Totals;
    /** The class baseline's casting at class level 1. */
    casting: { concentration: number; levelOneDc: number };
    spells: readonly [IntegrationSpell, ...IntegrationSpell[]];
    /**
     * The names and operation IDs the batch test passed (a step the batch
     * test did not run takes the one the other rows pass).
     */
    steps: StepArguments;
  };

/** The arguments of a row's steps that differ between the batch tests. */
type StepArguments = {
  campaignName: string;
  /** The campaign's e2e fixture case and campaign key. */
  fixtureCase: string;
  classLevelOperation: string;
  crossCampaignRecordOperation: string;
  outsiderRemoveOperation: string;
  /** The level the second Character browses at. */
  secondCharacterBrowseLevel: number;
};

/**
 * Whether a row writes a running Spell Effect, as the batch test did: the
 * effect path carries at least one effect, the record-only path none.
 */
type RunningPath =
  | { kind: 'recordOnly'; runningEffects?: never }
  | {
      kind: 'runningEffect';
      runningEffects: readonly [RunningEffect, ...RunningEffect[]];
    };

const s516_BullsStrength = {
  name: "Bull's Strength",
  key: 'pf1/05i5rxwim12hwktu',
  level: 2,
  school: 'trs',
  levels: {
    adept: 2,
    alchemist: 2,
    antipaladin: 2,
    arcanist: 2,
    bloodrager: 2,
    cleric: 2,
    druid: 2,
    hunter: 2,
    investigator: 2,
    magus: 2,
    medium: 2,
    oracle: 2,
    paladin: 2,
    psychic: 2,
    shaman: 2,
    sorcerer: 2,
    summoner: 2,
    summonerUnchained: 2,
    warpriest: 2,
    wizard: 2,
  },
  assessment: 'confirmed',
  recordOperation: 'record-bulls-strength',
  warnings: [['rules', 'spellLevel', 'Wizard cannot cast level 2 spells yet.']],
} as const satisfies IntegrationSpell;
const s517_DivineFavor = {
  name: 'Divine Favor',
  key: 'pf1/21bxbzdaawjrnvyo',
  level: 1,
  school: 'evo',
  levels: { cleric: 1, inquisitor: 1, oracle: 1, paladin: 1, warpriest: 1 },
  assessment: 'unresolved',
  recordOperation: 'record-0',
  warnings: [],
} as const satisfies IntegrationSpell;
const s517_Virtue = {
  name: 'Virtue',
  key: 'pf1/22x4iooz3c3vqof9',
  level: 0,
  school: 'trs',
  levels: {
    cleric: 0,
    druid: 0,
    hunter: 0,
    inquisitor: 0,
    medium: 0,
    oracle: 0,
    paladin: 1,
    psychic: 0,
    shaman: 0,
    spiritualist: 0,
    warpriest: 0,
  },
  assessment: 'confirmed',
  recordOperation: 'record-1',
  warnings: [],
} as const satisfies IntegrationSpell;
const s517_Blur = {
  name: 'Blur',
  key: 'pf1/18kryvj2dfuymk9d',
  level: 2,
  school: 'ill',
  levels: {
    alchemist: 2,
    arcanist: 2,
    bard: 2,
    investigator: 2,
    magus: 2,
    medium: 2,
    mesmerist: 2,
    occultist: 2,
    psychic: 2,
    skald: 2,
    sorcerer: 2,
    spiritualist: 2,
    summoner: 2,
    summonerUnchained: 2,
    wizard: 2,
  },
  assessment: 'unresolved',
  recordOperation: 'record-0',
  warnings: [['rules', 'spellLevel', 'Wizard cannot cast level 2 spells yet.']],
} as const satisfies IntegrationSpell;
const s517_ProtectionfromEnergy = {
  name: 'Protection from Energy',
  key: 'pf1/1vh2ewwvzvxunoxk',
  level: 3,
  school: 'abj',
  levels: {
    alchemist: 3,
    arcanist: 3,
    bloodrager: 3,
    cleric: 3,
    druid: 3,
    hunter: 2,
    inquisitor: 3,
    investigator: 3,
    occultist: 3,
    oracle: 3,
    psychic: 3,
    ranger: 2,
    shaman: 3,
    sorcerer: 3,
    spiritualist: 3,
    summoner: 3,
    summonerUnchained: 3,
    warpriest: 3,
    wizard: 3,
  },
  assessment: 'unresolved',
  recordOperation: 'record-1',
  warnings: [['rules', 'spellLevel', 'Wizard cannot cast level 3 spells yet.']],
} as const satisfies IntegrationSpell;
const s518_Bane = {
  name: 'Bane',
  key: 'pf1/3etxlex8u32g0hrx',
  level: 1,
  school: 'enc',
  levels: {
    antipaladin: 1,
    cleric: 1,
    inquisitor: 1,
    mesmerist: 1,
    oracle: 1,
    shaman: 1,
    warpriest: 1,
  },
  assessment: 'unresolved',
  recordOperation: 'record-0',
  warnings: [],
} as const satisfies IntegrationSpell;
const s518_Command = {
  name: 'Command',
  key: 'pf1/2p6fzj5t03oivndd',
  level: 1,
  school: 'enc',
  levels: {
    adept: 1,
    antipaladin: 1,
    cleric: 1,
    inquisitor: 1,
    medium: 1,
    mesmerist: 1,
    occultist: 1,
    oracle: 1,
    psychic: 1,
    warpriest: 1,
    witch: 1,
  },
  assessment: 'unresolved',
  recordOperation: 'record-1',
  warnings: [],
} as const satisfies IntegrationSpell;
const s518_ReducePerson = {
  name: 'Reduce Person',
  key: 'pf1/2y9e1l6zso9tdg0a',
  level: 1,
  school: 'trs',
  levels: {
    alchemist: 1,
    arcanist: 1,
    bloodrager: 1,
    investigator: 1,
    magus: 1,
    medium: 1,
    occultist: 1,
    psychic: 1,
    sorcerer: 1,
    summoner: 1,
    summonerUnchained: 1,
    witch: 1,
    wizard: 1,
  },
  assessment: 'confirmed',
  recordOperation: 'record-0',
  warnings: [],
} as const satisfies IntegrationSpell;
const s518_ShockingGrasp = {
  name: 'Shocking Grasp',
  key: 'pf1/33pe0bge7b7aq3io',
  level: 1,
  school: 'evo',
  levels: {
    arcanist: 1,
    bloodrager: 1,
    magus: 1,
    occultist: 1,
    sorcerer: 1,
    wizard: 1,
  },
  assessment: 'unresolved',
  recordOperation: 'record-1',
  warnings: [],
} as const satisfies IntegrationSpell;
const s519_MagicMissile = {
  name: 'Magic Missile',
  key: 'pf1/49yc9dpr4kvgki2s',
  level: 1,
  school: 'evo',
  levels: {
    arcanist: 1,
    bloodrager: 1,
    magus: 1,
    psychic: 1,
    sorcerer: 1,
    wizard: 1,
  },
  assessment: 'confirmed',
  recordOperation: 'record-0',
  warnings: [],
} as const satisfies IntegrationSpell;
const s519_SpiderClimb = {
  name: 'Spider Climb',
  key: 'pf1/3mfmhx8avu7h3iom',
  level: 2,
  school: 'trs',
  levels: {
    alchemist: 2,
    arcanist: 2,
    bloodrager: 2,
    druid: 2,
    hunter: 2,
    investigator: 2,
    magus: 2,
    medium: 2,
    occultist: 2,
    psychic: 2,
    sorcerer: 2,
    summoner: 2,
    summonerUnchained: 2,
    wizard: 2,
  },
  assessment: 'confirmed',
  recordOperation: 'record-1',
  warnings: [['rules', 'spellLevel', 'Wizard cannot cast level 2 spells yet.']],
} as const satisfies IntegrationSpell;
const s520_EffortlessArmor = {
  name: 'Effortless Armor',
  key: 'pf1/5kaozniy9sjydygq',
  level: 2,
  school: 'trs',
  levels: {
    cleric: 2,
    hunter: 2,
    inquisitor: 2,
    magus: 2,
    occultist: 2,
    oracle: 2,
    paladin: 2,
    psychic: 2,
    ranger: 2,
    warpriest: 2,
  },
  assessment: 'unresolved',
  recordOperation: 'record-0',
  warnings: [['rules', 'spellLevel', 'Oracle cannot cast level 2 spells yet.']],
} as const satisfies IntegrationSpell;
const s520_Heal = {
  name: 'Heal',
  key: 'pf1/4re1j2w8wkvsvnsi',
  level: 6,
  school: 'con',
  levels: {
    adept: 5,
    alchemist: 6,
    cleric: 6,
    druid: 7,
    inquisitor: 6,
    investigator: 6,
    occultist: 6,
    oracle: 6,
    shaman: 7,
    spiritualist: 6,
    warpriest: 6,
    witch: 7,
  },
  assessment: 'unresolved',
  recordOperation: 'record-1',
  warnings: [['rules', 'spellLevel', 'Oracle cannot cast level 6 spells yet.']],
} as const satisfies IntegrationSpell;
const s520_Scoop = {
  name: 'Scoop',
  key: 'pf1/4nqhjbhtb3cdk4oq',
  level: 0,
  school: 'evo',
  levels: { arcanist: 0, sorcerer: 0, wizard: 0 },
  assessment: 'unresolved',
  recordOperation: 'record-0',
  warnings: [],
} as const satisfies IntegrationSpell;
const s520_BadgersFerocity = {
  name: "Badger's Ferocity",
  key: 'pf1/4rjud9uoofhbwhht',
  level: 2,
  school: 'trs',
  levels: {
    arcanist: 2,
    cleric: 3,
    druid: 3,
    hunter: 2,
    occultist: 2,
    oracle: 3,
    ranger: 2,
    sorcerer: 2,
    warpriest: 3,
    wizard: 2,
  },
  assessment: 'unresolved',
  recordOperation: 'record-1',
  warnings: [['rules', 'spellLevel', 'Wizard cannot cast level 2 spells yet.']],
} as const satisfies IntegrationSpell;
const s521_CelestialHealing = {
  name: 'Celestial Healing',
  key: 'pf1/6d6bgiakwmwiu7qv',
  level: 1,
  school: 'con',
  levels: {
    arcanist: 1,
    bloodrager: 1,
    cleric: 1,
    magus: 1,
    oracle: 1,
    sorcerer: 1,
    summoner: 1,
    summonerUnchained: 1,
    warpriest: 1,
    witch: 1,
    wizard: 1,
  },
  assessment: 'unresolved',
  recordOperation: 'record-0',
  warnings: [],
} as const satisfies IntegrationSpell;
const s521_ParagonSurge = {
  name: 'Paragon Surge',
  key: 'pf1/5v3j49r4mdq9rbx6',
  level: 3,
  school: 'trs',
  levels: {
    alchemist: 3,
    arcanist: 3,
    bloodrager: 3,
    cleric: 3,
    investigator: 3,
    magus: 4,
    medium: 3,
    oracle: 3,
    paladin: 4,
    sorcerer: 3,
    warpriest: 3,
    witch: 3,
    wizard: 3,
  },
  assessment: 'confirmed',
  recordOperation: 'record-1',
  warnings: [['rules', 'spellLevel', 'Oracle cannot cast level 3 spells yet.']],
} as const satisfies IntegrationSpell;
const s521_Fireball = {
  name: 'Fireball',
  key: 'pf1/6oq1wcryviik9ice',
  level: 3,
  school: 'evo',
  levels: {
    arcanist: 3,
    bloodrager: 3,
    magus: 3,
    occultist: 3,
    sorcerer: 3,
    wizard: 3,
  },
  assessment: 'unresolved',
  recordOperation: 'record-0',
  warnings: [['rules', 'spellLevel', 'Wizard cannot cast level 3 spells yet.']],
} as const satisfies IntegrationSpell;
const s521_TouchofIdiocy = {
  name: 'Touch of Idiocy',
  key: 'pf1/648x72rflah0ggyz',
  level: 2,
  school: 'enc',
  levels: {
    arcanist: 2,
    bloodrager: 2,
    medium: 2,
    mesmerist: 2,
    psychic: 2,
    sorcerer: 2,
    spiritualist: 2,
    witch: 2,
    wizard: 2,
  },
  assessment: 'unresolved',
  recordOperation: 'record-1',
  warnings: [['rules', 'spellLevel', 'Wizard cannot cast level 2 spells yet.']],
} as const satisfies IntegrationSpell;
const s522_FoxsCunning = {
  name: "Fox's Cunning",
  key: 'pf1/743anqr1ahefv8zd',
  level: 2,
  school: 'trs',
  levels: {
    alchemist: 2,
    arcanist: 2,
    bard: 2,
    investigator: 2,
    medium: 2,
    psychic: 2,
    skald: 2,
    sorcerer: 2,
    summoner: 2,
    summonerUnchained: 2,
    wizard: 2,
  },
  assessment: 'unresolved',
  recordOperation: 'record-0',
  warnings: [['rules', 'spellLevel', 'Wizard cannot cast level 2 spells yet.']],
} as const satisfies IntegrationSpell;
const s522_Fly = {
  name: 'Fly',
  key: 'pf1/7d6sv5ecvi7kho3m',
  level: 3,
  school: 'trs',
  levels: {
    alchemist: 3,
    arcanist: 3,
    bloodrager: 3,
    investigator: 3,
    magus: 3,
    medium: 3,
    occultist: 3,
    psychic: 3,
    shaman: 3,
    sorcerer: 3,
    spiritualist: 3,
    summoner: 3,
    summonerUnchained: 3,
    witch: 3,
    wizard: 3,
  },
  assessment: 'unresolved',
  recordOperation: 'record-1',
  warnings: [['rules', 'spellLevel', 'Wizard cannot cast level 3 spells yet.']],
} as const satisfies IntegrationSpell;
const s523_SuppressCharmsandCompulsions = {
  name: 'Suppress Charms and Compulsions',
  key: 'pf1/8237jjhtwfqje4n6',
  level: 2,
  school: 'abj',
  levels: {
    arcanist: 2,
    bard: 2,
    cleric: 2,
    mesmerist: 2,
    oracle: 2,
    paladin: 2,
    psychic: 2,
    shaman: 2,
    skald: 2,
    sorcerer: 2,
    warpriest: 2,
    wizard: 2,
  },
  assessment: 'unresolved',
  recordOperation: 'record-0',
  warnings: [['rules', 'spellLevel', 'Oracle cannot cast level 2 spells yet.']],
} as const satisfies IntegrationSpell;
const s523_AngelicAspect = {
  name: 'Angelic Aspect',
  key: 'pf1/8jrtvmhydudy7fks',
  level: 5,
  school: 'trs',
  levels: {
    arcanist: 5,
    cleric: 5,
    oracle: 5,
    paladin: 3,
    sorcerer: 5,
    warpriest: 5,
    wizard: 5,
  },
  assessment: 'unresolved',
  recordOperation: 'record-1',
  warnings: [['rules', 'spellLevel', 'Oracle cannot cast level 5 spells yet.']],
} as const satisfies IntegrationSpell;
const s523_Rage = {
  name: 'Rage',
  key: 'pf1/8u1xa5javcxc6szk',
  level: 3,
  school: 'enc',
  levels: {
    alchemist: 3,
    arcanist: 3,
    bard: 2,
    bloodrager: 3,
    investigator: 3,
    mesmerist: 2,
    psychic: 3,
    skald: 2,
    sorcerer: 3,
    summoner: 3,
    summonerUnchained: 3,
    witch: 3,
    wizard: 3,
  },
  assessment: 'unresolved',
  recordOperation: 'record-0',
  warnings: [['rules', 'spellLevel', 'Wizard cannot cast level 3 spells yet.']],
} as const satisfies IntegrationSpell;
const s523_PolarRay = {
  name: 'Polar Ray',
  key: 'pf1/8jq1atxonnerix55',
  level: 8,
  school: 'evo',
  levels: { arcanist: 8, sorcerer: 8, wizard: 8 },
  assessment: 'unresolved',
  recordOperation: 'record-1',
  warnings: [['rules', 'spellLevel', 'Wizard cannot cast level 8 spells yet.']],
} as const satisfies IntegrationSpell;
const s524_Transformation = {
  name: 'Transformation',
  key: 'pf1/9pbl3ktd5oqejl19',
  level: 6,
  school: 'trs',
  levels: {
    alchemist: 6,
    arcanist: 6,
    investigator: 6,
    magus: 6,
    occultist: 6,
    psychic: 6,
    sorcerer: 6,
    spiritualist: 6,
    witch: 6,
    wizard: 6,
  },
  assessment: 'unresolved',
  recordOperation: 'record-0',
  warnings: [['rules', 'spellLevel', 'Wizard cannot cast level 6 spells yet.']],
} as const satisfies IntegrationSpell;
const s524_GirdAlly = {
  name: 'Gird Ally',
  key: 'pf1/9vld5joaodkatmj3',
  level: 2,
  school: 'abj',
  levels: {
    arcanist: 2,
    cleric: 2,
    druid: 2,
    hunter: 2,
    oracle: 2,
    sorcerer: 2,
    summoner: 2,
    summonerUnchained: 2,
    warpriest: 2,
    witch: 2,
    wizard: 2,
  },
  assessment: 'unresolved',
  recordOperation: 'record-1',
  warnings: [['rules', 'spellLevel', 'Wizard cannot cast level 2 spells yet.']],
} as const satisfies IntegrationSpell;
const s525_UnlivingRage = {
  name: 'Unliving Rage',
  key: 'pf1/aer23mbtykma1n1s',
  level: 3,
  school: 'nec',
  levels: {
    arcanist: 3,
    cleric: 2,
    mesmerist: 2,
    oracle: 2,
    sorcerer: 3,
    spiritualist: 3,
    warpriest: 2,
    witch: 3,
    wizard: 3,
  },
  assessment: 'unresolved',
  recordOperation: 'record-0',
  warnings: [['rules', 'spellLevel', 'Wizard cannot cast level 3 spells yet.']],
} as const satisfies IntegrationSpell;
const s525_SenseVitals = {
  name: 'Sense Vitals',
  key: 'pf1/aq0ch7ep4av2z214',
  level: 2,
  school: 'div',
  levels: {
    antipaladin: 2,
    arcanist: 2,
    bard: 2,
    hunter: 2,
    ranger: 2,
    skald: 2,
    sorcerer: 2,
    wizard: 2,
  },
  assessment: 'unresolved',
  recordOperation: 'record-1',
  warnings: [['rules', 'spellLevel', 'Wizard cannot cast level 2 spells yet.']],
} as const satisfies IntegrationSpell;
const s526_AnticipateThoughts = {
  name: 'Anticipate Thoughts',
  key: 'pf1/bexxf2117rcr21g1',
  level: 2,
  school: 'div',
  levels: {
    arcanist: 2,
    bard: 2,
    inquisitor: 2,
    magus: 2,
    mesmerist: 2,
    psychic: 2,
    skald: 2,
    sorcerer: 2,
    witch: 2,
    wizard: 2,
  },
  assessment: 'unresolved',
  recordOperation: 'record-0',
  warnings: [['rules', 'spellLevel', 'Wizard cannot cast level 2 spells yet.']],
} as const satisfies IntegrationSpell;
const s526_MindBlank = {
  name: 'Mind Blank',
  key: 'pf1/blvetbc929cfx4m8',
  level: 8,
  school: 'abj',
  levels: { arcanist: 8, psychic: 7, sorcerer: 8, witch: 8, wizard: 8 },
  assessment: 'unresolved',
  recordOperation: 'record-1',
  warnings: [['rules', 'spellLevel', 'Wizard cannot cast level 8 spells yet.']],
} as const satisfies IntegrationSpell;

/**
 * A 1st-level Wizard or Oracle with Strength 10 and Intelligence 14 (and
 * Wisdom 14, and Charisma 14): +2 Will from the good save, +2 from Wisdom.
 */
const wizardInt14: Totals = {
  scores: [10, 10, 10, 14, 10, 10],
  fortitude: 0,
  reflex: 0,
  will: 2,
  attackMelee: 0,
  damageMelee: 0,
};
const casterWis14: Totals = {
  scores: [10, 10, 10, 14, 14, 10],
  fortitude: 0,
  reflex: 0,
  will: 4,
  attackMelee: 0,
  damageMelee: 0,
};
const casterWisCha14: Totals = {
  scores: [10, 10, 10, 14, 14, 14],
  fortitude: 0,
  reflex: 0,
  will: 4,
  attackMelee: 0,
  damageMelee: 0,
};

/** Bull's Strength's +4 enhancement to Strength (CRB p.251), as spells-516 wrote it. */
const bullsStrength: RunningEffect = {
  name: 'Isolated running Bull’s Strength',
  spellKey: 'pf1/05i5rxwim12hwktu',
  defaultCasterLevel: 3,
  operationId: 'separate-running-effect',
  modifiers: [{ target: 'ability.str', bonusType: 'enhancement', value: 4 }],
  running: {
    scores: [14, 10, 10, 14, 10, 10],
    fortitude: 0,
    reflex: 0,
    will: 2,
    attackMelee: 0,
    damageMelee: 0,
  },
  runningPermanent: {
    scores: [10, 10, 10, 14, 10, 10],
    fortitude: 0,
    reflex: 0,
    will: 2,
    attackMelee: 0,
    damageMelee: 0,
  },
  fearfulWill: 2,
  fearfulPermanentWill: 2,
};

/** Divine Favor's minimum +1 luck on attack and damage (CRB p.273), as spells-517 wrote it. */
const divineFavor: RunningEffect = {
  name: 'Isolated running Divine Favor',
  spellKey: 'pf1/21bxbzdaawjrnvyo',
  defaultCasterLevel: 1,
  operationId: 'separate-running-effect',
  modifiers: [
    { target: 'attack', bonusType: 'luck', value: 1 },
    { target: 'damage', bonusType: 'luck', value: 1 },
  ],
  running: {
    scores: [10, 10, 10, 14, 14, 10],
    fortitude: 0,
    reflex: 0,
    will: 4,
    attackMelee: 1,
    damageMelee: 1,
  },
  runningPermanent: {
    scores: [10, 10, 10, 14, 14, 10],
    fortitude: 0,
    reflex: 0,
    will: 4,
    attackMelee: 0,
    damageMelee: 0,
  },
  fearfulWill: 4,
  fearfulPermanentWill: 4,
};

/** Bane's -1 on attacks and -1 on saves against fear (CRB p.246), as spells-518 wrote it. */
const bane: RunningEffect = {
  name: 'Isolated running Bane',
  spellKey: 'pf1/3etxlex8u32g0hrx',
  defaultCasterLevel: 1,
  operationId: 'separate-running-bane',
  modifiers: [
    { target: 'attack', bonusType: 'untyped', value: -1 },
    {
      target: 'saves',
      bonusType: 'untyped',
      value: -1,
      condition: { situation: 'fear' },
    },
  ],
  running: {
    scores: [10, 10, 10, 14, 14, 10],
    fortitude: 0,
    reflex: 0,
    will: 4,
    attackMelee: -1,
    damageMelee: 0,
  },
  runningPermanent: {
    scores: [10, 10, 10, 14, 14, 10],
    fortitude: 0,
    reflex: 0,
    will: 4,
    attackMelee: 0,
    damageMelee: 0,
  },
  fearfulWill: 3,
  fearfulPermanentWill: 4,
};

const rows: readonly IntegrationRow[] = [
  {
    batch: 'spells-516',
    className: 'Wizard',
    heading: 'Spellbook',
    scores: { strength: 10, intelligence: 14 },
    baseline: wizardInt14,
    casting: { concentration: 3, levelOneDc: 13 },
    spells: [s516_BullsStrength],
    kind: 'runningEffect',
    runningEffects: [bullsStrength],
    steps: {
      campaignName: 'Isolated held Spells #516',
      fixtureCase: 'held',
      classLevelOperation: 'wizard-baseline',
      crossCampaignRecordOperation: 'wrong-campaign-record-refused',
      outsiderRemoveOperation: 'outsider-refused',
      secondCharacterBrowseLevel: 2,
    },
  },
  {
    batch: 'spells-517',
    className: 'Oracle',
    heading: 'Spells known',
    scores: { strength: 10, intelligence: 14, wisdom: 14 },
    baseline: casterWis14,
    casting: { concentration: 1, levelOneDc: 11 },
    spells: [s517_DivineFavor, s517_Virtue],
    kind: 'runningEffect',
    runningEffects: [divineFavor],
    steps: {
      campaignName: 'Isolated held Spells #517',
      fixtureCase: 'Oracle',
      classLevelOperation: 'class-baseline',
      crossCampaignRecordOperation: 'wrong-campaign-record-refused',
      outsiderRemoveOperation: 'outsider-remove-refused',
      secondCharacterBrowseLevel: 2,
    },
  },
  {
    batch: 'spells-517',
    className: 'Wizard',
    heading: 'Spellbook',
    scores: { strength: 10, intelligence: 14, wisdom: 14 },
    baseline: casterWis14,
    casting: { concentration: 3, levelOneDc: 13 },
    spells: [s517_Blur, s517_ProtectionfromEnergy],
    kind: 'recordOnly',
    steps: {
      campaignName: 'Isolated held Spells #517',
      fixtureCase: 'Wizard',
      classLevelOperation: 'class-baseline',
      crossCampaignRecordOperation: 'wrong-campaign-record-refused',
      outsiderRemoveOperation: 'outsider-remove-refused',
      secondCharacterBrowseLevel: 2,
    },
  },
  {
    batch: 'spells-518',
    className: 'Oracle',
    heading: 'Spells known',
    scores: { strength: 10, intelligence: 14, wisdom: 14 },
    baseline: casterWis14,
    casting: { concentration: 1, levelOneDc: 11 },
    spells: [s518_Bane, s518_Command],
    kind: 'runningEffect',
    runningEffects: [bane],
    steps: {
      campaignName: 'Isolated held Spells #518',
      fixtureCase: 'Oracle',
      classLevelOperation: 'class-baseline',
      crossCampaignRecordOperation: 'wrong-campaign-record-refused',
      outsiderRemoveOperation: 'outsider-remove-refused',
      secondCharacterBrowseLevel: 2,
    },
  },
  {
    batch: 'spells-518',
    className: 'Wizard',
    heading: 'Spellbook',
    scores: { strength: 10, intelligence: 14, wisdom: 14 },
    baseline: casterWis14,
    casting: { concentration: 3, levelOneDc: 13 },
    spells: [s518_ReducePerson, s518_ShockingGrasp],
    kind: 'recordOnly',
    steps: {
      campaignName: 'Isolated held Spells #518',
      fixtureCase: 'Wizard',
      classLevelOperation: 'class-baseline',
      crossCampaignRecordOperation: 'wrong-campaign-record-refused',
      outsiderRemoveOperation: 'outsider-remove-refused',
      secondCharacterBrowseLevel: 2,
    },
  },
  {
    batch: 'spells-519',
    className: 'Wizard',
    heading: 'Spellbook',
    scores: { strength: 10, intelligence: 14, wisdom: 14 },
    baseline: casterWis14,
    casting: { concentration: 3, levelOneDc: 13 },
    spells: [s519_MagicMissile, s519_SpiderClimb],
    kind: 'recordOnly',
    steps: {
      campaignName: 'Isolated held Spells #519',
      fixtureCase: 'Wizard',
      classLevelOperation: 'class-baseline',
      crossCampaignRecordOperation: 'wrong-campaign-record-refused',
      outsiderRemoveOperation: 'outsider-remove-refused',
      secondCharacterBrowseLevel: 2,
    },
  },
  {
    batch: 'spells-520',
    className: 'Oracle',
    heading: 'Spells known',
    scores: { strength: 10, intelligence: 14, wisdom: 14 },
    baseline: casterWis14,
    casting: { concentration: 1, levelOneDc: 11 },
    spells: [s520_EffortlessArmor, s520_Heal],
    kind: 'recordOnly',
    steps: {
      campaignName: 'Isolated held Spells #520',
      fixtureCase: 'Oracle',
      classLevelOperation: 'class-baseline',
      crossCampaignRecordOperation: 'wrong-campaign-record-refused',
      outsiderRemoveOperation: 'outsider-remove-refused',
      secondCharacterBrowseLevel: 2,
    },
  },
  {
    batch: 'spells-520',
    className: 'Wizard',
    heading: 'Spellbook',
    scores: { strength: 10, intelligence: 14, wisdom: 14 },
    baseline: casterWis14,
    casting: { concentration: 3, levelOneDc: 13 },
    spells: [s520_Scoop, s520_BadgersFerocity],
    kind: 'recordOnly',
    steps: {
      campaignName: 'Isolated held Spells #520',
      fixtureCase: 'Wizard',
      classLevelOperation: 'class-baseline',
      crossCampaignRecordOperation: 'wrong-campaign-record-refused',
      outsiderRemoveOperation: 'outsider-remove-refused',
      secondCharacterBrowseLevel: 2,
    },
  },
  {
    batch: 'spells-521',
    className: 'Oracle',
    heading: 'Spells known',
    scores: { strength: 10, intelligence: 14, wisdom: 14, charisma: 14 },
    baseline: casterWisCha14,
    casting: { concentration: 3, levelOneDc: 13 },
    spells: [s521_CelestialHealing, s521_ParagonSurge],
    kind: 'recordOnly',
    steps: {
      campaignName: 'Isolated held Spells #521',
      fixtureCase: 'Oracle',
      classLevelOperation: 'class-baseline',
      crossCampaignRecordOperation: 'wrong-campaign-record-refused',
      outsiderRemoveOperation: 'outsider-remove-refused',
      secondCharacterBrowseLevel: 2,
    },
  },
  {
    batch: 'spells-521',
    className: 'Wizard',
    heading: 'Spellbook',
    scores: { strength: 10, intelligence: 14, wisdom: 14, charisma: 14 },
    baseline: casterWisCha14,
    casting: { concentration: 3, levelOneDc: 13 },
    spells: [s521_Fireball, s521_TouchofIdiocy],
    kind: 'recordOnly',
    steps: {
      campaignName: 'Isolated held Spells #521',
      fixtureCase: 'Wizard',
      classLevelOperation: 'class-baseline',
      crossCampaignRecordOperation: 'wrong-campaign-record-refused',
      outsiderRemoveOperation: 'outsider-remove-refused',
      secondCharacterBrowseLevel: 2,
    },
  },
  {
    batch: 'spells-522',
    className: 'Wizard',
    heading: 'Spellbook',
    scores: { strength: 10, intelligence: 14, wisdom: 14, charisma: 14 },
    baseline: casterWisCha14,
    casting: { concentration: 3, levelOneDc: 13 },
    spells: [s522_FoxsCunning, s522_Fly],
    kind: 'recordOnly',
    steps: {
      campaignName: 'Isolated held Spells #522',
      fixtureCase: 'Wizard',
      classLevelOperation: 'class-baseline',
      crossCampaignRecordOperation: 'wrong-campaign-record-refused',
      outsiderRemoveOperation: 'outsider-remove-refused',
      secondCharacterBrowseLevel: 2,
    },
  },
  {
    batch: 'spells-523',
    className: 'Oracle',
    heading: 'Spells known',
    scores: { strength: 10, intelligence: 14, wisdom: 14, charisma: 14 },
    baseline: casterWisCha14,
    casting: { concentration: 3, levelOneDc: 13 },
    spells: [s523_SuppressCharmsandCompulsions, s523_AngelicAspect],
    kind: 'recordOnly',
    steps: {
      campaignName: 'Isolated held Spells #523',
      fixtureCase: 'Oracle',
      classLevelOperation: 'class-baseline',
      crossCampaignRecordOperation: 'cross-campaign-record-refused',
      outsiderRemoveOperation: 'outsider-remove-refused',
      secondCharacterBrowseLevel: 2,
    },
  },
  {
    batch: 'spells-523',
    className: 'Wizard',
    heading: 'Spellbook',
    scores: { strength: 10, intelligence: 14, wisdom: 14, charisma: 14 },
    baseline: casterWisCha14,
    casting: { concentration: 3, levelOneDc: 13 },
    spells: [s523_Rage, s523_PolarRay],
    kind: 'recordOnly',
    steps: {
      campaignName: 'Isolated held Spells #523',
      fixtureCase: 'Wizard',
      classLevelOperation: 'class-baseline',
      crossCampaignRecordOperation: 'cross-campaign-record-refused',
      outsiderRemoveOperation: 'outsider-remove-refused',
      secondCharacterBrowseLevel: 2,
    },
  },
  {
    batch: 'spells-524',
    className: 'Wizard',
    heading: 'Spellbook',
    scores: { strength: 10, intelligence: 14, wisdom: 14, charisma: 14 },
    baseline: casterWisCha14,
    casting: { concentration: 3, levelOneDc: 13 },
    spells: [s524_Transformation, s524_GirdAlly],
    kind: 'recordOnly',
    steps: {
      campaignName: 'Isolated held Spells #524',
      fixtureCase: 'Wizard',
      classLevelOperation: 'class-baseline',
      crossCampaignRecordOperation: 'wrong-campaign-record-refused',
      outsiderRemoveOperation: 'outsider-remove-refused',
      secondCharacterBrowseLevel: 2,
    },
  },
  {
    batch: 'spells-525',
    className: 'Wizard',
    heading: 'Spellbook',
    scores: { strength: 10, intelligence: 14, wisdom: 14, charisma: 14 },
    baseline: casterWisCha14,
    casting: { concentration: 3, levelOneDc: 13 },
    spells: [s525_UnlivingRage, s525_SenseVitals],
    kind: 'recordOnly',
    steps: {
      campaignName: 'Isolated held Spells #525',
      fixtureCase: 'Wizard',
      classLevelOperation: 'class-baseline',
      crossCampaignRecordOperation: 'wrong-campaign-record-refused',
      outsiderRemoveOperation: 'outsider-remove-refused',
      secondCharacterBrowseLevel: 2,
    },
  },
  {
    batch: 'spells-526',
    className: 'Wizard',
    heading: 'Spellbook',
    scores: { strength: 10, intelligence: 14, wisdom: 14, charisma: 14 },
    baseline: casterWisCha14,
    casting: { concentration: 3, levelOneDc: 13 },
    spells: [s526_AnticipateThoughts, s526_MindBlank],
    kind: 'recordOnly',
    steps: {
      campaignName: 'Isolated held Spells #526',
      fixtureCase: 'Wizard',
      classLevelOperation: 'class-baseline',
      crossCampaignRecordOperation: 'wrong-campaign-record-refused',
      outsiderRemoveOperation: 'outsider-remove-refused',
      secondCharacterBrowseLevel: 2,
    },
  },
];

const notFound = 'Character not found';
const noAccess = 'You do not have access to this org';
const otherCharacter = 'Catalog Entry does not belong to this Character';

type Calculation = {
  abilities: Record<(typeof abilityKeys)[number], { score: number }>;
  derivedStatistics: Record<'fortitude' | 'reflex' | 'will', { total: number }>;
  breakdowns: Record<'attack.melee' | 'damage.melee', { total: number }>;
};

/** The totals of a saved sheet's or client preview's calculation. */
function totalsOf(calculated: Calculation): Totals {
  return {
    scores: abilityKeys.map((ability) => calculated.abilities[ability].score),
    fortitude: calculated.derivedStatistics.fortitude.total,
    reflex: calculated.derivedStatistics.reflex.total,
    will: calculated.derivedStatistics.will.total,
    attackMelee: calculated.breakdowns['attack.melee'].total,
    damageMelee: calculated.breakdowns['damage.melee'].total,
  };
}

const { entries } = await importReleasedEntries([
  ...rows.flatMap((row) => row.spells.map((spell) => spell.key)),
  ...Object.values(spellcastingClasses),
]);

type Harness = ReturnType<typeof convexTest>;
type Actor = ReturnType<Harness['withIdentity']>;
type Scope = {
  organizationId: string;
  campaignId: Id<'campaign'>;
  characterId: Id<'character'>;
};
type Filters = Scope & { castingClassId: Id<'catalogEntry'> };

/** A campaign of the org with an owner and a member, and an outsider of another org. */
async function campaignOf(t: Harness, row: IntegrationRow) {
  const tag = row.batch.replace('spells-', 'spell');
  const campaignId = await t.run(async (ctx) => {
    for (const [name, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: `${tag}|${name}`,
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    return ctx.db.insert('campaign', {
      name: row.steps.campaignName,
      description: '',
      organizationId: 'org',
      ownerId: `${tag}|owner`,
      e2eFixture: {
        namespace: row.batch,
        version: 1,
        workerKey: '0',
        caseKey: row.steps.fixtureCase,
        campaignKey: row.steps.fixtureCase,
      },
    });
  });
  return {
    tag,
    campaignId,
    owner: t.withIdentity({ tokenIdentifier: `${tag}|owner` }),
    member: t.withIdentity({ tokenIdentifier: `${tag}|member` }),
    outsider: t.withIdentity({ tokenIdentifier: `${tag}|outsider` }),
  };
}

/**
 * Installs the released Oracle with only the class metadata its Spell
 * collection needs, as the batch tests installed their pinned Oracle context.
 */
async function installOracle(t: Harness, characterId: Id<'character'>) {
  const context = importedClass(entries, spellcastingClasses.oracle);
  expect(context.name).toBe('Oracle');
  const casting = findReviewedClassCasting(context.detail.tag);
  if (!casting) throw new Error('Missing reviewed Oracle casting table');
  return t.run((ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: context.name,
      ruleIdentity: context.externalKey,
      sources: context.sources,
      modifiers: [],
      stacksWithItself: false,
      detail: {
        kind: 'class',
        hitDie: context.detail.hitDie,
        bab: context.detail.bab,
        saves: context.detail.saves,
        classSkills: context.detail.classSkills,
        classKind: context.detail.classKind,
        skillRanksPerLevel: context.detail.skillRanksPerLevel,
        featuresByLevel: [],
        picksByLevel: [],
        casting,
      },
    }),
  );
}

/** The baseline catalog's class of the row, or the released Oracle installed. */
async function castingClassOf(
  t: Harness,
  baselineClassId: Id<'catalogEntry'> | undefined,
  { row, characterId }: { row: IntegrationRow; characterId: Id<'character'> },
) {
  if (baselineClassId) return baselineClassId;
  if (row.className !== 'Oracle')
    throw new Error(`Missing ${row.className} baseline`);
  return installOracle(t, characterId);
}

/**
 * The row's class at level 1 with the row's base scores; its totals and
 * casting are the row's literals.
 */
async function classBaseline({
  t,
  owner,
  member,
  scope,
  row,
}: {
  t: Harness;
  owner: Actor;
  member: Actor;
  scope: Scope;
  row: IntegrationRow;
}) {
  const initial = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  const level = initial?.entries.find((entry) => entry.kind === 'classLevel');
  if (!level) throw new Error('Missing initial class level');
  const castingClassId = await castingClassOf(
    t,
    initial?.catalogEntries.find(
      (entry) => entry.name === row.className && entry.detail.kind === 'class',
    )?._id,
    { row, characterId: scope.characterId },
  );
  await member.mutation(api.characterSheet.editClassLevel, {
    ...scope,
    entryId: level._id,
    classEntryId: castingClassId,
    operationId: row.steps.classLevelOperation,
  });
  await member.mutation(api.characterSheet.editBaseScores, {
    ...scope,
    scores: row.scores,
    operationId: 'base-scores',
  });
  const baseline = await owner.query(api.characterSheet.read, scope);
  if (!baseline) throw new Error('Missing baseline calculation');
  expect(totalsOf(baseline.calculated)).toEqual(row.baseline);
  expect(totalsOf(baseline.permanentCalculated)).toEqual(row.baseline);
  const casting = baseline.calculated.spellcastings.find(
    (entry) => entry.classEntryId === castingClassId,
  );
  expect(casting).toMatchObject({
    classLevels: 1,
    casterLevel: { total: 1 },
    concentration: { total: row.casting.concentration },
  });
  expect(casting?.slots.find((slot) => slot.spellLevel === 1)?.dc.total).toBe(
    row.casting.levelOneDc,
  );
  return { castingClassId, baseline };
}

type Recording = {
  owner: Actor;
  member: Actor;
  scope: Scope;
  castingClassId: Id<'catalogEntry'>;
  baseline: NonNullable<FunctionReturnType<typeof api.characterSheet.read>>;
  row: IntegrationRow;
};

/** The saved definition is the inserted one, and its rule-bearing fields are the literals. */
function expectSavedDefinition({
  definition,
  entry,
  spell,
  characterId,
}: {
  definition: unknown;
  entry: ReturnType<typeof importedSpell>;
  spell: IntegrationSpell;
  characterId: Id<'character'>;
}) {
  expect(definition).toMatchObject({
    scope: 'character',
    characterId,
    ruleIdentity: entry.externalKey,
    sources: entry.sources,
    modifiers: [],
    detail: {
      kind: 'spell',
      levels: entry.detail.levels,
      school: entry.detail.school,
    },
  });
  expect(definition).toMatchObject({
    ruleIdentity: spell.key,
    modifiers: [],
    detail: { kind: 'spell', levels: spell.levels, school: spell.school },
  });
  expect((definition as { detail: { levels: unknown } }).detail.levels).toEqual(
    spell.levels,
  );
}

/**
 * Browses for one installed Spell, records it, and checks the saved entry,
 * definition, collection row and warnings, a sheet the Spell leaves as it was
 * and a client preview equal to the saved sheet.
 */
async function recordSpell(
  { owner, member, scope, castingClassId, baseline, row }: Recording,
  {
    spell,
    entry,
    catalogEntryId,
  }: {
    spell: IntegrationSpell;
    entry: ReturnType<typeof importedSpell>;
    catalogEntryId: Id<'catalogEntry'>;
  },
) {
  expect(entry.name).toBe(spell.name);
  const filters = { ...scope, castingClassId };
  const page = await member.query(api.characterSheetSpells.browse, {
    ...filters,
    spellLevel: spell.level,
    paginationOpts: { cursor: null, numItems: 25 },
  });
  expect(page.page).toContainEqual(
    expect.objectContaining({
      catalogEntryId,
      name: spell.name,
      spellLevel: spell.level,
      school: spell.school,
    }),
  );
  const entryId = await member.mutation(api.characterSheetSpells.record, {
    ...filters,
    catalogEntryId,
    operationId: spell.recordOperation,
  });
  const saved = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!saved) throw new Error('Missing isolated saved sheet');
  expect(saved.entries.find((item) => item._id === entryId)).toMatchObject({
    kind: 'spell',
    state: { kind: 'spell', castingClassId, level: spell.level },
  });
  expectSavedDefinition({
    definition: saved.catalogEntries.find(
      (item) => item._id === catalogEntryId,
    ),
    entry,
    spell,
    characterId: scope.characterId,
  });
  const collection = saved.calculated.spellCollections.collections.find(
    (item) => item.classEntryId === castingClassId,
  );
  expect(collection).toMatchObject({ heading: row.heading });
  expect(JSON.stringify(collection)).toContain(entryId);
  expect(collection?.spells).toContainEqual({
    entryId,
    catalogEntryId,
    ruleIdentity: spell.key,
    name: spell.name,
    classEntryId: castingClassId,
    castingClassName: row.className,
    school: spell.school,
    description: extractCatalogDescriptionText({ html: entry.description }),
    spellLevel: spell.level,
    explicitLevel: spell.level,
    offList: false,
    twoSlots: false,
  });
  expect(
    saved.calculated.warnings
      .filter((warning) => warning.subject === entryId)
      .map((warning) => [warning.kind, warning.check, warning.message]),
  ).toEqual(spell.warnings);
  // The recorded Spell moves nothing on the sheet.
  expect(totalsOf(saved.calculated)).toEqual(row.baseline);
  expect(totalsOf(saved.permanentCalculated)).toEqual(row.baseline);
  for (const key of [
    'abilities',
    'derivedStatistics',
    'proficiencies',
    'spellcastings',
    'spellEffects',
  ] as const)
    expect(saved.calculated[key], key).toEqual(baseline.calculated[key]);
  for (const key of [
    'abilities',
    'derivedStatistics',
    'proficiencies',
  ] as const)
    expect(saved.permanentCalculated[key], key).toEqual(
      baseline.permanentCalculated[key],
    );
  // The client preview equals the saved sheet.
  const client = calculateCharacterSheetPreview(saved);
  for (const key of [
    'abilities',
    'derivedStatistics',
    'spellCollections',
    'spellEffects',
    'spellcastings',
  ] as const)
    expect(client[key], key).toEqual(saved.calculated[key]);
  expect(
    (await member.query(api.characterSheet.read, scope))?.calculated.abilities,
  ).toEqual(saved.calculated.abilities);
  return entryId;
}

/**
 * A player-written running effect, never an imported or admitted Spell
 * Effect (recording its Spell never creates it): its totals while it runs
 * and once it stops are literals.
 */
async function runEffect(
  { owner, member, scope, row }: Recording,
  effect: RunningEffect,
) {
  const effectId = await member.mutation(api.characterSheet.createSheetEntry, {
    ...scope,
    name: effect.name,
    modifiers: effect.modifiers,
    detail: {
      kind: 'spellEffect',
      spellKey: effect.spellKey,
      defaultCasterLevel: effect.defaultCasterLevel,
      lastsOverOneDay: false,
    },
    operationId: effect.operationId,
  });
  const running = withSheetCatalog(
    await owner.query(api.characterSheet.read, scope),
  );
  if (!running) throw new Error('Missing running-effect preview');
  expect(totalsOf(running.calculated)).toEqual(effect.running);
  expect(totalsOf(running.permanentCalculated)).toEqual(
    effect.runningPermanent,
  );
  const client = calculateCharacterSheetPreview(running);
  expect(client.abilities).toEqual(running.calculated.abilities);
  expect(client.breakdowns['attack.melee'].total).toBe(
    running.calculated.breakdowns['attack.melee'].total,
  );
  expect(
    calculateCharacterSheetPreview(running, {}, { situations: ['fear'] })
      .derivedStatistics.will.total,
  ).toBe(effect.fearfulWill);
  expect(
    calculateCharacterSheetPreview(
      running,
      {},
      { situations: ['fear'], permanentOnly: true },
    ).derivedStatistics.will.total,
  ).toBe(effect.fearfulPermanentWill);
  await member.mutation(api.characterSheet.editSheetEntry, {
    ...scope,
    entryId: effectId,
    active: false,
    operationId: 'stop-running-effect',
  });
  const stopped = await owner.query(api.characterSheet.read, scope);
  if (!stopped) throw new Error('Missing stopped-effect sheet');
  expect(totalsOf(stopped.calculated)).toEqual(row.baseline);
}

/** Another campaign, an outsider and an anonymous caller are refused. */
async function expectCampaignRefusals(
  {
    t,
    tag,
    member,
    outsider,
    filters,
    steps,
  }: {
    t: Harness;
    tag: string;
    member: Actor;
    outsider: Actor;
    filters: Filters;
    steps: StepArguments;
  },
  firstSpellId: Id<'catalogEntry'>,
) {
  const otherCampaignId = await t.run((ctx) =>
    ctx.db.insert('campaign', {
      name: 'Other campaign',
      description: '',
      organizationId: 'org',
      ownerId: `${tag}|owner`,
    }),
  );
  const scope = {
    organizationId: filters.organizationId,
    campaignId: filters.campaignId,
    characterId: filters.characterId,
  };
  const page = { paginationOpts: { cursor: null, numItems: 25 } };
  await expect(
    member.query(api.characterSheet.read, {
      ...scope,
      campaignId: otherCampaignId,
    }),
  ).rejects.toThrow(notFound);
  await expect(
    member.query(api.characterSheetSpells.browse, {
      ...filters,
      ...page,
      campaignId: otherCampaignId,
    }),
  ).rejects.toThrow(notFound);
  await expect(
    member.mutation(api.characterSheetSpells.record, {
      ...filters,
      campaignId: otherCampaignId,
      catalogEntryId: firstSpellId,
      operationId: steps.crossCampaignRecordOperation,
    }),
  ).rejects.toThrow(notFound);
  await expect(outsider.query(api.characterSheet.read, scope)).rejects.toThrow(
    noAccess,
  );
  await expect(
    outsider.query(api.characterSheetSpells.browse, { ...filters, ...page }),
  ).rejects.toThrow(noAccess);
  await expect(t.query(api.characterSheet.read, scope)).rejects.toThrow(
    noAccess,
  );
  await expect(
    t.mutation(api.characterSheetSpells.record, {
      ...filters,
      catalogEntryId: firstSpellId,
      operationId: 'unauthenticated-record-refused',
    }),
  ).rejects.toThrow(noAccess);
}

/**
 * A second Character of the campaign, on the Wizard list, neither lists nor
 * records the first Character's Spell.
 */
async function expectSeparateCatalog(
  { member, filters }: { member: Actor; filters: Filters },
  {
    firstSpellId,
    spellLevel,
  }: {
    firstSpellId: Id<'catalogEntry'>;
    spellLevel: number;
  },
) {
  const secondCharacterId = await member.mutation(api.characterSheet.create, {
    organizationId: filters.organizationId,
    campaignId: filters.campaignId,
    name: 'Separate Character catalog',
    kind: 'pc',
    operationId: 'create-separate-spell-catalog',
  });
  const secondScope = {
    organizationId: filters.organizationId,
    campaignId: filters.campaignId,
    characterId: secondCharacterId,
  };
  const secondSheet = withSheetCatalog(
    await member.query(api.characterSheet.read, secondScope),
  );
  const secondLevel = secondSheet?.entries.find(
    (entry) => entry.kind === 'classLevel',
  );
  const secondWizard = secondSheet?.catalogEntries.find(
    (entry) => entry.name === 'Wizard' && entry.detail.kind === 'class',
  );
  if (!secondLevel || !secondWizard)
    throw new Error('Missing second Character Wizard baseline');
  await member.mutation(api.characterSheet.editClassLevel, {
    ...secondScope,
    entryId: secondLevel._id,
    classEntryId: secondWizard._id,
    operationId: 'second-character-wizard',
  });
  const secondBrowser = await member.query(api.characterSheetSpells.browse, {
    ...secondScope,
    castingClassId: secondWizard._id,
    spellLevel,
    paginationOpts: { cursor: null, numItems: 25 },
  });
  expect(secondBrowser.page.map((entry) => entry.catalogEntryId)).not.toContain(
    firstSpellId,
  );
  await expect(
    member.mutation(api.characterSheetSpells.record, {
      ...secondScope,
      castingClassId: secondWizard._id,
      catalogEntryId: firstSpellId,
      operationId: 'another-character-spell-refused',
    }),
  ).rejects.toThrow(otherCharacter);
}

/** An outsider can neither record nor remove; the member removes the first Spell only. */
async function expectRemoval(
  {
    owner,
    member,
    outsider,
    filters,
    steps,
  }: {
    owner: Actor;
    member: Actor;
    outsider: Actor;
    filters: Filters;
    steps: StepArguments;
  },
  {
    firstSpellId,
    recordedIds,
  }: {
    firstSpellId: Id<'catalogEntry'>;
    recordedIds: readonly [
      Id<'characterSheetEntry'>,
      ...Id<'characterSheetEntry'>[],
    ];
  },
) {
  const scope = {
    organizationId: filters.organizationId,
    campaignId: filters.campaignId,
    characterId: filters.characterId,
  };
  const [firstEntryId, ...others] = recordedIds;
  await expect(
    outsider.mutation(api.characterSheetSpells.record, {
      ...filters,
      catalogEntryId: firstSpellId,
      operationId: 'outsider-record-refused',
    }),
  ).rejects.toThrow(noAccess);
  await expect(
    outsider.mutation(api.characterSheetSpells.remove, {
      ...scope,
      entryId: firstEntryId,
      operationId: steps.outsiderRemoveOperation,
    }),
  ).rejects.toThrow(noAccess);
  expect(
    (await owner.query(api.characterSheet.read, scope))?.entries.some(
      (entry) => entry._id === firstEntryId,
    ),
  ).toBe(true);
  await member.mutation(api.characterSheetSpells.remove, {
    ...scope,
    entryId: firstEntryId,
    operationId: 'member-removes-spell',
  });
  const removed = await owner.query(api.characterSheet.read, scope);
  expect(removed?.entries.some((entry) => entry._id === firstEntryId)).toBe(
    false,
  );
  for (const entryId of others)
    expect(removed?.entries.some((entry) => entry._id === entryId)).toBe(true);
}

describe('the row table', () => {
  test('a running-effect row needs an effect and a record-only row takes none', () => {
    const effectRow = rows.find((row) => row.kind === 'runningEffect');
    const plainRow = rows.find((row) => row.kind === 'recordOnly');
    if (effectRow?.kind !== 'runningEffect' || plainRow?.kind !== 'recordOnly')
      throw new Error('Missing a row of each path');
    const effects = [bane] as const;
    const refused = [
      // @ts-expect-error An effect path with an empty effect list.
      ((): RunningPath => ({ kind: 'runningEffect', runningEffects: [] }))(),
      // @ts-expect-error An effect row spread with an empty effect list.
      ((): IntegrationRow => ({ ...effectRow, runningEffects: [] }))(),
      // @ts-expect-error A record-only path with an effect.
      ((): RunningPath => ({ kind: 'recordOnly', runningEffects: effects }))(),
      // @ts-expect-error A record-only row spread with an effect.
      ((): IntegrationRow => ({ ...plainRow, runningEffects: effects }))(),
      // @ts-expect-error An effect row spread onto the record-only path.
      ((): IntegrationRow => ({ ...effectRow, kind: 'recordOnly' }))(),
    ];
    expect(refused).toHaveLength(5);
  });
});

describe('recorded Spells of the spell batches on a saved sheet', () => {
  test.each(rows)(
    '$batch: the $className list records its Spells through the public writers, and others are refused',
    async (row) => {
      for (const spell of row.spells)
        expect(
          reviewedAdmission.assessments.find(
            (assessment) => assessment.externalKey === spell.key,
          )?.status,
          spell.name,
        ).toBe(spell.assessment);
      const t = convexTest(schema, modules);
      const people = await campaignOf(t, row);
      const characterId = await people.owner.mutation(
        api.characterSheet.create,
        {
          organizationId: 'org',
          campaignId: people.campaignId,
          name: 'Source-backed Spell collection preview',
          kind: 'pc',
          operationId: `create-${row.batch}`,
        },
      );
      const scope = {
        organizationId: 'org',
        campaignId: people.campaignId,
        characterId,
      };
      const { castingClassId, baseline } = await classBaseline({
        t,
        ...people,
        scope,
        row,
      });
      // The internal writer installs only into this convex-test Character
      // catalog; no shipping permission, running Spell Effect or Catalog
      // Release is created.
      const installed = row.spells.map((spell) =>
        importedSpell(entries, spell.key),
      );
      const spellIds = await people.owner.mutation(
        internal.characterSheetSpells.installPreparedCatalog,
        { ...scope, spells: installed, operationId: 'isolated-spell-catalog' },
      );
      const recording = { ...people, scope, castingClassId, baseline, row };
      const recordedIds: Id<'characterSheetEntry'>[] = [];
      for (const [index, spell] of row.spells.entries()) {
        const entry = installed[index];
        const catalogEntryId = spellIds[index];
        if (!entry || !catalogEntryId)
          throw new Error(`Missing installed Spell: ${spell.name}`);
        recordedIds.push(
          await recordSpell(recording, { spell, entry, catalogEntryId }),
        );
      }
      if (row.kind === 'runningEffect')
        for (const effect of row.runningEffects)
          await runEffect(recording, effect);
      const [firstEntryId, ...otherEntryIds] = recordedIds;
      const [firstSpellId] = spellIds;
      if (!firstEntryId || !firstSpellId)
        throw new Error('Missing recorded Spell');
      const filters = { ...scope, castingClassId };
      await expectCampaignRefusals(
        { t, ...people, filters, steps: row.steps },
        firstSpellId,
      );
      await expectSeparateCatalog(
        { member: people.member, filters },
        { firstSpellId, spellLevel: row.steps.secondCharacterBrowseLevel },
      );
      await expectRemoval(
        { ...people, filters, steps: row.steps },
        { firstSpellId, recordedIds: [firstEntryId, ...otherEntryIds] },
      );
    },
  );
});
