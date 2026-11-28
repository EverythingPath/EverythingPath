/// <reference types="vite/client" />
// @vitest-environment edge-runtime
// pbl-released-racial-traits (PRD #251): the racial-trait batches'
// integration tests (racialTraits387 to racialTraits401), on entries imported
// from the pinned store. Each row saves a race and its alternates as
// character-scoped Catalog Entries on a Convex-backed sheet: the imported race
// whole, or a test-only race that is the pinned race's identity granting the
// listed standard traits. The row selects the race and then its alternates,
// turns them off again, and checks its own numbers and Notes as literals at
// each step; every read checks that the client preview's derived statistics
// equal the saved sheet's, as the batch tests did at each of their reads.
// The shared steps then check that an outsider, an anonymous caller and
// another campaign's copy of one alternate are refused and leave the sheet
// unchanged.
import { convexTest } from 'convex-test';
import type { FunctionReturnType } from 'convex/server';
import { describe, expect, it, test } from 'vitest';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';
import { calculateCharacterSheetPreview } from '../../src/components/character-sheet/calculate-character-sheet-preview';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import { withSheetCatalog } from '../character-sheet-catalog';
import { importReleasedEntries } from './released-entries';
import {
  racialTraitBatches,
  type RacialTraitBatch,
} from './released-racial-trait-keys';
import {
  importedEntry,
  savedRaceDefinition,
  savedTraitDefinition,
} from './released-racial-trait-sheet';

const modules = import.meta.glob('../../convex/**/*.ts');

/**
 * The status of a key's committed Attribution Assessment, in the batch
 * reviews' words: a confirmed assessment reads `admitted`, an unresolved one
 * `held`. It is the assessment's status only, not whether a release admits
 * the entry: a release may still admit an unresolved entry on its declared
 * books.
 */
function disposition(key: string) {
  const status = reviewedAdmission.assessments.find(
    (row) => row.externalKey === key,
  )?.status;
  return status === 'confirmed'
    ? 'admitted'
    : status === 'unresolved'
      ? 'held'
      : status;
}

type SavedSheet = NonNullable<
  FunctionReturnType<typeof api.characterSheet.read>
>;

/** How a row saves its race. */
type RaceSetup =
  /**
   * The imported race, saved whole with its Modifiers and Notes; `grants` is
   * its imported Racial Traits list, which the row checks before saving.
   */
  | {
      kind: 'imported';
      race: string;
      grants: readonly [string, ...string[]];
      identityName?: never;
    }
  /**
   * A test-only race named `identityName`: the pinned race's identity with no
   * Modifiers, granting only `grants`.
   */
  | {
      kind: 'identity';
      race: string;
      grants: readonly [string, ...string[]];
      identityName: string;
    };

/** The steps a row's check drives, in its own order. */
type RacialTraitSteps = {
  /** Reads the saved sheet; the preview's derived statistics equal it. */
  read: () => Promise<SavedSheet>;
  /** Selects the row's race. */
  selectRace: () => Promise<void>;
  /** Selects or deselects one of the row's alternates. */
  turn: (key: string, selected: boolean) => Promise<void>;
  /** The six ability totals, by their short names. */
  scores: (sheet: SavedSheet) => Record<string, number>;
  /** The totals of the named statistics. */
  totals: (
    sheet: SavedSheet,
    targets: readonly string[],
  ) => Record<string, number>;
  /** The joined Note texts of a saved entry. */
  notes: (sheet: SavedSheet, key: string) => string;
};

type RacialTraitRow = {
  batch: RacialTraitBatch;
  /** What the row exercises, as the test title. */
  title: string;
  race: RaceSetup;
  /** The alternates saved beside the race's grants, each in the batch list. */
  alternates: readonly [string, ...string[]];
  /** The keys whose committed assessments the batch reviews read as held. */
  held: readonly [string, ...string[]];
  /** The keys whose committed assessments they read as admitted. */
  admitted: readonly string[];
  /** The alternate the refused edits try to select. */
  refused: string;
  check(steps: RacialTraitSteps): Promise<void>;
};

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;

const UNDINE = 'pf1/iqJvhd7NbmybUl0y';
const AASIMAR = 'pf1/FHY3oIk5zSOFncJH';
const CHANGELING = 'pf1/9FBT6uqlRgaw9gug';
const ELF = 'pf1/NgIhxRI0axrf3fcO';
const HALFLING = 'pf1/Hf31mrYb3uucNyLO';
const OREAD = 'pf1/4qEXPDlfIj1cIvCe';
const SKINWALKER = 'pf1/apWl6JIJ8U8p0azq';
const TIEFLING = 'pf1/nVjKDLZSRONzYm8f';
// The changeling's own ability trait.
const CHANGELING_ABILITIES = 'pf1-content/PxjUu8YOjXmWdagL';

const rows: RacialTraitRow[] = [
  {
    batch: 'racial-traits-387',
    title:
      'an isolated Undine sheet takes the held Rimesoul heritage in place of the ability score trait, keeps the Deepsight Note and keeps access to the campaign',
    race: {
      kind: 'imported',
      race: UNDINE,
      grants: [
        'local/race-ability-scores/pf1/iqJvhd7NbmybUl0y',
        'pf1-content/2zJmqweobLpf54yh',
        'pf1-content/539xDsN3QbslLsz8',
        'pf1-content/9lCx7sugVXLoYbIW',
        'pf1-content/AisJptj1zLCA5blH',
        'pf1-content/B3cuHM7Ab4p8kLmH',
        'pf1-content/JkYEEoXqg586RnrU',
        'pf1-content/hV2bbHMgni1OCXAg',
      ],
    },
    alternates: [
      'pf1-content/0CISUAPF2V91vvoo', // Rimesoul (Frost Undine)
      'pf1-content/1JlE7WfSvWMead3S', // Deepsight
    ],
    held: ['pf1-content/0CISUAPF2V91vvoo', 'pf1-content/1JlE7WfSvWMead3S'],
    admitted: [],
    refused: 'pf1-content/0CISUAPF2V91vvoo',
    async check({ read, selectRace, turn, scores, notes }) {
      const RIMESOUL = 'pf1-content/0CISUAPF2V91vvoo';
      const DEEPSIGHT = 'pf1-content/1JlE7WfSvWMead3S';
      await selectRace();
      // The undine's reviewed ability score trait: +2 Dex, +2 Wis, -2 Str.
      const undine = { str: 8, dex: 12, con: 10, int: 10, wis: 12, cha: 10 };
      expect(scores(await read())).toEqual(undine);
      await turn(RIMESOUL, true);
      // Rimesoul replaces it: +2 Dex, +2 Int, -2 Cha.
      const rimesoul = { str: 10, dex: 12, con: 10, int: 12, wis: 10, cha: 8 };
      expect(scores(await read())).toEqual(rimesoul);
      // Deepsight replaces Darkvision (Undine); its readable Note is saved
      // with it, and no ability score changes.
      await turn(DEEPSIGHT, true);
      const both = await read();
      expect(scores(both)).toEqual(rimesoul);
      expect(notes(both, DEEPSIGHT)).toContain(
        'darkvision 120 feet when underwater',
      );
      // Turning the heritage off brings the ability score trait back.
      await turn(RIMESOUL, false);
      expect(scores(await read())).toEqual(undine);
    },
  },
  {
    batch: 'racial-traits-388',
    title:
      'an isolated Aasimar sheet takes the held Archon-Blooded heritage in place of the ability score trait and keeps access to the campaign',
    race: {
      kind: 'imported',
      race: AASIMAR,
      grants: [
        'local/race-ability-scores/pf1/FHY3oIk5zSOFncJH',
        'pf1-content/Hr7VZkVINGbLYfpo',
        'pf1-content/LVToSTaVYtVk7Sa3',
        'pf1-content/SiZwOvv9Vz2OluRK',
        'pf1-content/VfIksZzCRMtktSu6',
        'pf1-content/dk1o8LLPRw7etojM',
        'pf1-content/rd6xPFT4I6qEU1zu',
      ],
    },
    alternates: [
      'pf1-content/3haIOIRYDeFc1YZH', // Archon-Blooded (Lawbringers)
    ],
    held: ['pf1-content/3haIOIRYDeFc1YZH'],
    admitted: [],
    refused: 'pf1-content/3haIOIRYDeFc1YZH',
    async check({ read, selectRace, turn, scores, notes }) {
      const ARCHON = 'pf1-content/3haIOIRYDeFc1YZH';
      await selectRace();
      // The aasimar's reviewed ability score trait: +2 Wis, +2 Cha.
      const aasimar = { str: 10, dex: 10, con: 10, int: 10, wis: 12, cha: 12 };
      expect(scores(await read())).toEqual(aasimar);
      await turn(ARCHON, true);
      // Archon-Blooded replaces it: +2 Con, +2 Wis. Its readable Note is saved.
      const archon = await read();
      expect(scores(archon)).toEqual({
        str: 10,
        dex: 10,
        con: 12,
        int: 10,
        wis: 12,
        cha: 10,
      });
      expect(notes(archon, ARCHON)).toContain('continual flame');
      // Turning the heritage off brings the ability score trait back.
      await turn(ARCHON, false);
      expect(scores(await read())).toEqual(aasimar);
    },
  },
  {
    batch: 'racial-traits-389',
    title:
      'an isolated changeling sheet takes the held Sorrow May heritage and Hag Magic in place of their standard traits and keeps access to the campaign',
    race: {
      kind: 'identity',
      race: CHANGELING,
      identityName: 'Changeling (identity only)',
      grants: [
        CHANGELING_ABILITIES,
        'pf1-content/Qx1JqPVW0quaOGfY', // Natural Armor (Changeling)
      ],
    },
    alternates: [
      'pf1-content/7lquuXyjHJKCYDOU', // Ability Modifiers (Changeling - Sorrow May)
      'pf1-content/8vJZseDShMzcl6Oz', // Hag Magic (ISR)
    ],
    held: ['pf1-content/7lquuXyjHJKCYDOU', 'pf1-content/8vJZseDShMzcl6Oz'],
    admitted: [],
    refused: 'pf1-content/7lquuXyjHJKCYDOU',
    async check({ read, selectRace, turn, scores, totals, notes }) {
      const SORROW_MAY = 'pf1-content/7lquuXyjHJKCYDOU';
      const HAG_MAGIC = 'pf1-content/8vJZseDShMzcl6Oz';
      await selectRace();
      // The changeling's ability trait (+2 Wis, +2 Cha, -2 Con) and its +1
      // natural armor.
      const changeling = {
        str: 10,
        dex: 10,
        con: 8,
        int: 10,
        wis: 12,
        cha: 12,
      };
      const plain = await read();
      expect(scores(plain)).toEqual(changeling);
      expect(totals(plain, ['ac.natural'])).toEqual({ 'ac.natural': 1 });
      await turn(SORROW_MAY, true);
      // The Sorrow May heritage replaces it: +2 Int, +2 Wis, -2 Con.
      const sorrow = { str: 10, dex: 10, con: 8, int: 12, wis: 12, cha: 10 };
      expect(scores(await read())).toEqual(sorrow);
      // Hag Magic replaces the natural armor trait.
      await turn(HAG_MAGIC, true);
      const both = await read();
      expect(scores(both)).toEqual(sorrow);
      expect(totals(both, ['ac.natural'])).toEqual({ 'ac.natural': 0 });
      expect(notes(both, HAG_MAGIC)).toContain('witch spell list');
      // Turning the heritage off brings the ability trait back.
      await turn(SORROW_MAY, false);
      expect(scores(await read())).toEqual(changeling);
    },
  },
  {
    batch: 'racial-traits-390',
    title:
      'an isolated changeling sheet takes the held Brine May ability record in place of the changeling ability trait, adds the held Pyrophile without changing the ability scores or the spell DC, and keeps access to the campaign',
    race: {
      kind: 'identity',
      race: CHANGELING,
      identityName: 'Changeling (identity only)',
      grants: [
        CHANGELING_ABILITIES,
        'pf1-content/CmhdInCVqMiadv3T', // Claws (Changeling)
      ],
    },
    alternates: [
      'pf1-content/C1PaDJ7bjwWd2U4C', // Ability Modifiers (Changeling - Brine May)
      'pf1-content/BD8FBL0PfVe5qfrt', // Pyrophile
    ],
    held: [
      'pf1-content/CmhdInCVqMiadv3T',
      'pf1-content/C1PaDJ7bjwWd2U4C',
      'pf1-content/BD8FBL0PfVe5qfrt',
    ],
    admitted: [],
    refused: 'pf1-content/C1PaDJ7bjwWd2U4C',
    async check({ read, selectRace, turn, scores, totals, notes }) {
      const CLAWS = 'pf1-content/CmhdInCVqMiadv3T';
      const BRINE_MAY = 'pf1-content/C1PaDJ7bjwWd2U4C';
      const PYROPHILE = 'pf1-content/BD8FBL0PfVe5qfrt';
      await selectRace();
      // The changeling's ability trait (+2 Wis, +2 Cha, -2 Con); Claws adds
      // only its readable Note (two 1d4 claw attacks).
      const changeling = {
        str: 10,
        dex: 10,
        con: 8,
        int: 10,
        wis: 12,
        cha: 12,
      };
      const plain = await read();
      expect(scores(plain)).toEqual(changeling);
      expect(notes(plain, CLAWS)).toContain('two claw attacks');
      await turn(BRINE_MAY, true);
      // The Brine May ability record replaces it: +2 Dex, +2 Wis, -2 Con.
      const brine = { str: 10, dex: 12, con: 8, int: 10, wis: 12, cha: 10 };
      const brineSheet = await read();
      expect(scores(brineSheet)).toEqual(brine);
      expect(totals(brineSheet, ['spellDC'])).toEqual({ spellDC: 0 });
      // Pyrophile's fire spell damage bonus stays a readable Note; the ability
      // scores and the spell DC do not change.
      await turn(PYROPHILE, true);
      const both = await read();
      expect(scores(both)).toEqual(brine);
      expect(totals(both, ['spellDC'])).toEqual({ spellDC: 0 });
      expect(notes(both, PYROPHILE)).toContain(
        'spells with the fire descriptor',
      );
      // Turning the record off brings the ability trait back.
      await turn(BRINE_MAY, false);
      expect(scores(await read())).toEqual(changeling);
    },
  },
  {
    batch: 'racial-traits-391',
    title:
      'an isolated elf sheet takes the held Fey Wisdom in place of Keen Senses, adds the held Dragon Magic without changing Perception, Diplomacy or Knowledge (nature), and keeps access to the campaign',
    race: {
      kind: 'identity',
      race: ELF,
      identityName: 'Elf (identity only)',
      grants: [
        'pf1-content/WOF6A7695wxFO2ie', // Keen Senses (Elf)
        'pf1-content/bRO90tmeaH1tFi2g', // Elven Magic
        'pf1-content/GS07eqHZBCT979tA', // Weapon Familiarity (Elf)
      ],
    },
    alternates: [
      'pf1-content/GSkWHI5OKIScXKx3', // Fey Wisdom
      'pf1-content/H1bYc9y68ZKt1auL', // Dragon Magic
    ],
    held: ['pf1-content/GSkWHI5OKIScXKx3', 'pf1-content/H1bYc9y68ZKt1auL'],
    // #328 S4-B admits Weapon Familiarity (Elf).
    admitted: ['pf1-content/GS07eqHZBCT979tA'],
    refused: 'pf1-content/GSkWHI5OKIScXKx3',
    async check({ read, selectRace, turn, totals, notes }) {
      const WEAPON_FAMILIARITY = 'pf1-content/GS07eqHZBCT979tA';
      const FEY_WISDOM = 'pf1-content/GSkWHI5OKIScXKx3';
      const DRAGON_MAGIC = 'pf1-content/H1bYc9y68ZKt1auL';
      const skills = ['skill.per', 'skill.dip', 'skill.kna'] as const;
      await selectRace();
      // Keen Senses (Elf) gives +2 racial Perception; Weapon Familiarity
      // (Elf) adds its readable Note.
      const elf = { 'skill.per': 2, 'skill.dip': 0, 'skill.kna': 0 };
      const plain = await read();
      expect(totals(plain, skills)).toEqual(elf);
      expect(notes(plain, WEAPON_FAMILIARITY)).toContain('longbows');
      await turn(FEY_WISDOM, true);
      // Fey Wisdom replaces Keen Senses: +1 racial Diplomacy and Knowledge
      // (nature), and the +2 Perception goes dormant.
      const wise = { 'skill.per': 0, 'skill.dip': 1, 'skill.kna': 1 };
      expect(totals(await read(), skills)).toEqual(wise);
      // Dragon Magic: its raw +2 Perception imports as 0 (reviewed change
      // replacement), so the three skill totals stay; its readable Note is
      // saved. (The row does not check that Elven Magic goes dormant.)
      await turn(DRAGON_MAGIC, true);
      const both = await read();
      expect(totals(both, skills)).toEqual(wise);
      expect(notes(both, DRAGON_MAGIC)).toContain('draconic bloodline');
      // Turning Fey Wisdom off brings Keen Senses back.
      await turn(FEY_WISDOM, false);
      expect(totals(await read(), skills)).toEqual(elf);
    },
  },
  {
    batch: 'racial-traits-392',
    title:
      'an isolated changeling sheet takes the held Snow May ability record in place of the changeling ability trait, keeps the Sea Lungs Note and keeps access to the campaign',
    race: {
      kind: 'identity',
      race: CHANGELING,
      identityName: 'Changeling (identity only)',
      grants: [
        CHANGELING_ABILITIES,
        'pf1-content/IQphttqw1U0aVd3j', // Hag Racial Trait (Changeling - Sea Lungs)
      ],
    },
    alternates: [
      'pf1-content/HEOPhaWDWb6tyTnS', // Ability Modifiers (Changeling - Snow May)
    ],
    held: ['pf1-content/IQphttqw1U0aVd3j', 'pf1-content/HEOPhaWDWb6tyTnS'],
    admitted: [],
    refused: 'pf1-content/HEOPhaWDWb6tyTnS',
    async check({ read, selectRace, turn, scores, totals, notes }) {
      const SEA_LUNGS = 'pf1-content/IQphttqw1U0aVd3j';
      const SNOW_MAY = 'pf1-content/HEOPhaWDWb6tyTnS';
      await selectRace();
      // The changeling's ability trait (+2 Wis, +2 Cha, -2 Con); Sea Lungs
      // adds only its readable Note (holding breath for 3 x Constitution
      // rounds).
      const changeling = {
        str: 10,
        dex: 10,
        con: 8,
        int: 10,
        wis: 12,
        cha: 12,
      };
      const plain = await read();
      expect(scores(plain)).toEqual(changeling);
      expect(totals(plain, ['concentration'])).toEqual({ concentration: 0 });
      expect(notes(plain, SEA_LUNGS)).toContain('hold her breath');
      await turn(SNOW_MAY, true);
      // The Snow May ability record replaces it: +2 Int, +2 Wis, -2 Con;
      // concentration does not change.
      const snow = await read();
      expect(scores(snow)).toEqual({
        str: 10,
        dex: 10,
        con: 8,
        int: 12,
        wis: 12,
        cha: 10,
      });
      expect(totals(snow, ['concentration'])).toEqual({ concentration: 0 });
      // Turning the record off brings the ability trait back.
      await turn(SNOW_MAY, false);
      expect(scores(await read())).toEqual(changeling);
    },
  },
  {
    batch: 'racial-traits-393',
    title:
      'an isolated changeling sheet takes the held Moon May ability record and Hag Magic (AoE) in place of the changeling traits they replace, and keeps access to the campaign',
    race: {
      kind: 'identity',
      race: CHANGELING,
      identityName: 'Changeling (identity only)',
      grants: [
        CHANGELING_ABILITIES,
        'pf1-content/CmhdInCVqMiadv3T', // Claws (Changeling)
        'pf1-content/Qx1JqPVW0quaOGfY', // Natural Armor (Changeling)
      ],
    },
    alternates: [
      'pf1-content/KXcFJRaHS35vdjSn', // Ability Modifiers (Changeling - Moon May)
      'pf1-content/NBbiF9fQTgRfNaFb', // Hag Magic (AoE)
    ],
    held: ['pf1-content/KXcFJRaHS35vdjSn', 'pf1-content/NBbiF9fQTgRfNaFb'],
    admitted: [],
    refused: 'pf1-content/KXcFJRaHS35vdjSn',
    async check({ read, selectRace, turn, scores, totals, notes }) {
      const MOON_MAY = 'pf1-content/KXcFJRaHS35vdjSn';
      const HAG_MAGIC = 'pf1-content/NBbiF9fQTgRfNaFb';
      await selectRace();
      // The changeling's ability trait (+2 Wis, +2 Cha, -2 Con) and its +1
      // natural armor.
      const changeling = {
        str: 10,
        dex: 10,
        con: 8,
        int: 10,
        wis: 12,
        cha: 12,
      };
      const plain = await read();
      expect(scores(plain)).toEqual(changeling);
      expect(totals(plain, ['ac.natural'])).toEqual({ 'ac.natural': 1 });
      await turn(MOON_MAY, true);
      // The Moon May ability record replaces it: +2 Wis, +2 Cha, -2 Dex.
      const moon = { str: 10, dex: 8, con: 10, int: 10, wis: 12, cha: 12 };
      expect(scores(await read())).toEqual(moon);
      await turn(HAG_MAGIC, true);
      // Hag Magic (AoE) makes the claws and natural armor dormant and keeps
      // its readable spell-like abilities.
      const hag = await read();
      expect(totals(hag, ['ac.natural'])).toEqual({ 'ac.natural': 0 });
      expect(scores(hag)).toEqual(moon);
      expect(notes(hag, HAG_MAGIC)).toContain('dancing lights');
      // Turning both records off brings the replaced traits back.
      await turn(HAG_MAGIC, false);
      await turn(MOON_MAY, false);
      const restored = await read();
      expect(scores(restored)).toEqual(changeling);
      expect(totals(restored, ['ac.natural'])).toEqual({ 'ac.natural': 1 });
    },
  },
  {
    batch: 'racial-traits-394',
    title:
      'an isolated halfling sheet takes the held Unlucky Halfling, Secretive Survivor and Fey Magic (Halfling) in place of the halfling traits they replace, and keeps access to the campaign',
    race: {
      kind: 'identity',
      race: HALFLING,
      identityName: 'Halfling (identity only)',
      grants: [
        'pf1-content/HVI7FNwj2ng10qtj', // Halfling Luck
        'pf1-content/sSs0BK09PLxjbkAa', // Sure-Footed
        'pf1-content/XVo4DApULZaETYcz', // Keen Senses (Halfling)
      ],
    },
    alternates: [
      'pf1-content/QK5CNiDmMqT3cdFB', // Unlucky Halfling
      'pf1-content/O0p9WY2bZpciuXs4', // Secretive Survivor
      'pf1-content/Q9DPJigrJ8kDDemn', // Fey Magic (Halfling)
    ],
    held: [
      'pf1-content/QK5CNiDmMqT3cdFB',
      'pf1-content/O0p9WY2bZpciuXs4',
      'pf1-content/Q9DPJigrJ8kDDemn',
    ],
    admitted: [],
    refused: 'pf1-content/QK5CNiDmMqT3cdFB',
    async check({ read, selectRace, turn, totals, notes }) {
      const UNLUCKY = 'pf1-content/QK5CNiDmMqT3cdFB';
      const SECRETIVE = 'pf1-content/O0p9WY2bZpciuXs4';
      const FEY_MAGIC = 'pf1-content/Q9DPJigrJ8kDDemn';
      const targets = [
        'save.fort',
        'save.ref',
        'save.will',
        'skill.acr',
        'skill.clm',
        'skill.blf',
        'skill.ste',
        'skill.per',
      ] as const;
      await selectRace();
      // Halfling Luck (+1 racial on all saves), Sure-Footed (+2 racial
      // Acrobatics and Climb) and Keen Senses (+2 racial Perception).
      const halfling = {
        'save.fort': 1,
        'save.ref': 1,
        'save.will': 1,
        'skill.acr': 2,
        'skill.clm': 2,
        'skill.blf': 0,
        'skill.ste': 0,
        'skill.per': 2,
      };
      expect(totals(await read(), targets)).toEqual(halfling);
      for (const key of [UNLUCKY, SECRETIVE, FEY_MAGIC]) await turn(key, true);
      // Unlucky Halfling: Halfling Luck goes dormant and its -1 untyped
      // penalty applies (+1 to -1). Secretive Survivor: Sure-Footed goes
      // dormant and its +2 racial Bluff and Stealth apply. Fey Magic
      // (Halfling): Keen Senses goes dormant; its spell-like abilities stay
      // readable.
      const unlucky = await read();
      expect(totals(unlucky, targets)).toEqual({
        'save.fort': -1,
        'save.ref': -1,
        'save.will': -1,
        'skill.acr': 0,
        'skill.clm': 0,
        'skill.blf': 2,
        'skill.ste': 2,
        'skill.per': 0,
      });
      expect(notes(unlucky, FEY_MAGIC)).toContain('resist nature');
      expect(notes(unlucky, UNLUCKY)).toContain('ill omen');
      // Turning them off brings the replaced traits back.
      for (const key of [UNLUCKY, SECRETIVE, FEY_MAGIC]) await turn(key, false);
      expect(totals(await read(), targets)).toEqual(halfling);
    },
  },
  {
    batch: 'racial-traits-395',
    title:
      'an isolated aasimar sheet takes the held Garuda-Blooded (Plumekith) and Celestial Crusader in place of the aasimar traits they replace, and keeps access to the campaign',
    race: {
      kind: 'identity',
      race: AASIMAR,
      identityName: 'Aasimar (identity only)',
      grants: [
        // The aasimar's ability score trait, the importer's local trait that
        // "Base Statistics" resolves to once a heritage's ability line is
        // curated.
        'local/race-ability-scores/pf1/FHY3oIk5zSOFncJH',
        'pf1-content/SiZwOvv9Vz2OluRK', // Skilled (Aasimar)
        'pf1-content/Hr7VZkVINGbLYfpo', // Celestial Resistance
      ],
    },
    alternates: [
      'pf1-content/R7UDXRs0E5klyzCY', // Garuda-Blooded (Plumekith)
      'pf1-content/SnhFeGgq8qpGMVDh', // Celestial Crusader
    ],
    held: ['pf1-content/R7UDXRs0E5klyzCY', 'pf1-content/SnhFeGgq8qpGMVDh'],
    admitted: [],
    refused: 'pf1-content/R7UDXRs0E5klyzCY',
    async check({ read, selectRace, turn, totals, notes }) {
      const GARUDA = 'pf1-content/R7UDXRs0E5klyzCY';
      const CRUSADER = 'pf1-content/SnhFeGgq8qpGMVDh';
      const targets = [
        'ability.str',
        'ability.dex',
        'ability.wis',
        'ability.cha',
        'skill.dip',
        'skill.per',
        'skill.kpl',
        'attack.melee',
        'ac.other',
      ] as const;
      await selectRace();
      // The aasimar's +2 Wisdom and +2 Charisma and Skilled (+2 racial
      // Diplomacy and Perception, each with its +1 ability modifier).
      const aasimar = {
        'ability.str': 10,
        'ability.dex': 10,
        'ability.wis': 12,
        'ability.cha': 12,
        'skill.dip': 3,
        'skill.per': 3,
        'skill.kpl': 0,
        'attack.melee': 0,
        'ac.other': 0,
      };
      expect(totals(await read(), targets)).toEqual(aasimar);
      for (const key of [GARUDA, CRUSADER]) await turn(key, true);
      // Garuda-Blooded: the curated ability line (+2 Dex, +2 Wis) replaces
      // the aasimar's ability score trait (+2 Wis, +2 Cha), so Diplomacy also
      // loses the Charisma modifier. Celestial Crusader: Skilled goes
      // dormant; its insight and identify bonuses are off until their
      // Situation is selected.
      const plumekith = await read();
      expect(totals(plumekith, targets)).toEqual({
        'ability.str': 10,
        'ability.dex': 12,
        'ability.wis': 12,
        'ability.cha': 10,
        'skill.dip': 0,
        'skill.per': 1,
        'skill.kpl': 0,
        'attack.melee': 0,
        'ac.other': 0,
      });
      expect(notes(plumekith, GARUDA)).toContain('plumekith');
      expect(notes(plumekith, CRUSADER)).toContain('untrained');
      // Turning them off brings the replaced traits back.
      for (const key of [GARUDA, CRUSADER]) await turn(key, false);
      expect(totals(await read(), targets)).toEqual(aasimar);
    },
  },
  {
    batch: 'racial-traits-396',
    title:
      'an isolated aasimar sheet takes the held Azata-Blooded (Musetouched) and Skilled (Aasimar - Idyllkin) in place of the aasimar traits they replace, keeps the Darkvision Note and keeps access to the campaign',
    race: {
      kind: 'identity',
      race: AASIMAR,
      identityName: 'Aasimar (identity only)',
      grants: [
        'local/race-ability-scores/pf1/FHY3oIk5zSOFncJH',
        'pf1-content/SiZwOvv9Vz2OluRK', // Skilled (Aasimar)
        'pf1-content/VfIksZzCRMtktSu6', // Darkvision (Aasimar)
      ],
    },
    alternates: [
      'pf1-content/U8dkiXDmSDOETLxv', // Azata-Blooded (Musetouched)
      'pf1-content/V5V8tGIQ5JWnd9mq', // Skilled (Aasimar - Idyllkin)
    ],
    held: [
      'pf1-content/U8dkiXDmSDOETLxv',
      'pf1-content/V5V8tGIQ5JWnd9mq',
      'pf1-content/VfIksZzCRMtktSu6',
    ],
    admitted: [],
    refused: 'pf1-content/U8dkiXDmSDOETLxv',
    async check({ read, selectRace, turn, totals, notes }) {
      const DARKVISION = 'pf1-content/VfIksZzCRMtktSu6';
      const AZATA = 'pf1-content/U8dkiXDmSDOETLxv';
      const IDYLLKIN = 'pf1-content/V5V8tGIQ5JWnd9mq';
      const targets = [
        'ability.str',
        'ability.dex',
        'ability.wis',
        'ability.cha',
        'skill.dip',
        'skill.per',
        'skill.han',
        'skill.sur',
      ] as const;
      await selectRace();
      // The aasimar's +2 Wisdom and +2 Charisma and Skilled (+2 racial
      // Diplomacy and Perception); the skills add the Charisma and Wisdom
      // modifiers (+1).
      const aasimar = {
        'ability.str': 10,
        'ability.dex': 10,
        'ability.wis': 12,
        'ability.cha': 12,
        'skill.dip': 3,
        'skill.per': 3,
        'skill.han': 1,
        'skill.sur': 1,
      };
      expect(totals(await read(), targets)).toEqual(aasimar);
      for (const key of [AZATA, IDYLLKIN]) await turn(key, true);
      // Azata-Blooded: the curated ability line (+2 Dex, +2 Cha) replaces the
      // aasimar's ability score trait (+2 Wis, +2 Cha). Skilled (Aasimar -
      // Idyllkin): +2 racial Handle Animal and Survival in place of Skilled's
      // Diplomacy and Perception. Wisdom falls to 10, so Perception and
      // Survival also lose the +1 Wisdom modifier.
      const musetouched = await read();
      expect(totals(musetouched, targets)).toEqual({
        'ability.str': 10,
        'ability.dex': 12,
        'ability.wis': 10,
        'ability.cha': 12,
        'skill.dip': 1,
        'skill.per': 0,
        'skill.han': 3,
        'skill.sur': 2,
      });
      expect(notes(musetouched, AZATA)).toContain('musetouched');
      expect(notes(musetouched, DARKVISION)).toContain('60 feet');
      // Turning them off brings the replaced traits back.
      for (const key of [AZATA, IDYLLKIN]) await turn(key, false);
      expect(totals(await read(), targets)).toEqual(aasimar);
    },
  },
  {
    batch: 'racial-traits-397',
    title:
      'an isolated oread sheet takes the held Gemsoul (Crystal Oread), Granite Skin and Mountain-Born in place of the oread traits they replace, keeps the Spell-Like Ability (Oread) Note and keeps access to the campaign',
    race: {
      kind: 'identity',
      race: OREAD,
      identityName: 'Oread (identity only)',
      grants: [
        'local/race-ability-scores/pf1/4qEXPDlfIj1cIvCe',
        'pf1-content/pbItjcPIPXPP15oc', // Energy Resistance (Oread)
        'pf1-content/b7b9LL5pcA63eOv1', // Spell-Like Ability (Oread)
      ],
    },
    alternates: [
      'pf1-content/a1otKF9eFw6gSfvB', // Gemsoul (Crystal Oread)
      'pf1-content/aD19XOFMcxvFTIYY', // Granite Skin
      'pf1-content/XXB7Lnp9pMBlS5Or', // Mountain-Born
    ],
    held: [
      'pf1-content/a1otKF9eFw6gSfvB',
      'pf1-content/aD19XOFMcxvFTIYY',
      'pf1-content/XXB7Lnp9pMBlS5Or',
      'pf1-content/b7b9LL5pcA63eOv1',
    ],
    admitted: [],
    refused: 'pf1-content/a1otKF9eFw6gSfvB',
    async check({ read, selectRace, turn, totals, notes }) {
      const MAGIC = 'pf1-content/b7b9LL5pcA63eOv1';
      const GEMSOUL = 'pf1-content/a1otKF9eFw6gSfvB';
      const GRANITE = 'pf1-content/aD19XOFMcxvFTIYY';
      const MOUNTAIN = 'pf1-content/XXB7Lnp9pMBlS5Or';
      const targets = [
        'ability.str',
        'ability.wis',
        'ability.cha',
        'ac.natural',
        'skill.sen',
        'skill.acr',
      ] as const;
      await selectRace();
      // The oread's +2 Strength, +2 Wisdom and -2 Charisma; Sense Motive adds
      // the Wisdom modifier (+1).
      const oread = {
        'ability.str': 12,
        'ability.wis': 12,
        'ability.cha': 8,
        'ac.natural': 0,
        'skill.sen': 1,
        'skill.acr': 0,
      };
      expect(totals(await read(), targets)).toEqual(oread);
      for (const key of [GEMSOUL, GRANITE, MOUNTAIN]) await turn(key, true);
      // Gemsoul: the curated ability line (+2 Str, +2 Cha, -2 Wis) replaces
      // the oread's ability score trait (+2 Str, +2 Wis, -2 Cha), so Wisdom
      // falls to 8 and Sense Motive loses 2 with it. Granite Skin: +1 racial
      // natural armor in place of energy resistance. Mountain-Born's
      // Acrobatics bonus is a manual Situation, so the total stays.
      const crystal = await read();
      expect(totals(crystal, targets)).toEqual({
        'ability.str': 12,
        'ability.wis': 8,
        'ability.cha': 12,
        'ac.natural': 1,
        'skill.sen': -1,
        'skill.acr': 0,
      });
      expect(notes(crystal, GEMSOUL)).toContain('Gemsouls');
      expect(notes(crystal, MOUNTAIN)).toContain('narrow ledges');
      expect(notes(crystal, MAGIC)).toContain('magic stone');
      // Turning them off brings the replaced traits back.
      for (const key of [GEMSOUL, GRANITE, MOUNTAIN]) await turn(key, false);
      expect(totals(await read(), targets)).toEqual(oread);
    },
  },
  {
    batch: 'racial-traits-398',
    title:
      'an isolated skinwalker sheet takes the held Werewolf-Kin (Witchwolf) in place of the skinwalker ability score trait it replaces, keeps the Animal-Minded Note and keeps access to the campaign',
    race: {
      kind: 'identity',
      race: SKINWALKER,
      identityName: 'Skinwalker (identity only)',
      grants: [
        'local/race-ability-scores/pf1/apWl6JIJ8U8p0azq',
        'pf1-content/bPkht5w4AKauP8Ip', // Animal-Minded
      ],
    },
    alternates: [
      'pf1-content/calSa82WwxgUFwXr', // Werewolf-Kin (Witchwolf)
    ],
    held: ['pf1-content/calSa82WwxgUFwXr', 'pf1-content/bPkht5w4AKauP8Ip'],
    admitted: [],
    refused: 'pf1-content/calSa82WwxgUFwXr',
    async check({ read, selectRace, turn, totals, notes }) {
      const MINDED = 'pf1-content/bPkht5w4AKauP8Ip';
      const WITCHWOLF = 'pf1-content/calSa82WwxgUFwXr';
      const targets = [
        'ability.con',
        'ability.int',
        'ability.wis',
        'skill.han',
        'skill.sen',
      ] as const;
      await selectRace();
      // The skinwalker's +2 Wisdom and -2 Intelligence; Animal-Minded's +2
      // racial Handle Animal; Sense Motive adds the Wisdom modifier (+1).
      const skinwalker = {
        'ability.con': 10,
        'ability.int': 8,
        'ability.wis': 12,
        'skill.han': 2,
        'skill.sen': 1,
      };
      const plain = await read();
      expect(totals(plain, targets)).toEqual(skinwalker);
      expect(notes(plain, MINDED)).toContain('wild empathy');
      await turn(WITCHWOLF, true);
      // Werewolf-Kin: the curated ability line (+2 Con, -2 Int) replaces the
      // skinwalker's ability score trait (+2 Wis, -2 Int), so Wisdom falls to
      // 10 and Sense Motive loses its +1 with it.
      const wolf = await read();
      expect(totals(wolf, targets)).toEqual({
        'ability.con': 12,
        'ability.int': 8,
        'ability.wis': 10,
        'skill.han': 2,
        'skill.sen': 0,
      });
      expect(notes(wolf, WITCHWOLF)).toContain('Ancestry werewolf');
      // Turning it off brings the replaced trait back.
      await turn(WITCHWOLF, false);
      expect(totals(await read(), targets)).toEqual(skinwalker);
    },
  },
  {
    batch: 'racial-traits-399',
    title:
      'an isolated tiefling sheet takes the held Demon-Spawn (Pitborn) in place of the tiefling ability score trait and the held Vestigial Wings in place of Skilled, and keeps access to the campaign',
    race: {
      kind: 'identity',
      race: TIEFLING,
      identityName: 'Tiefling (identity only)',
      grants: [
        'local/race-ability-scores/pf1/nVjKDLZSRONzYm8f',
        'pf1-content/AKuDJrwJUZULsJcS', // Skilled (Tiefling)
      ],
    },
    alternates: [
      'pf1-content/emgcgmgSjpuv1GHa', // Demon-Spawn (Pitborn)
      'pf1-content/gxxWYxmCBUIWCPqU', // Vestigial Wings
    ],
    held: ['pf1-content/emgcgmgSjpuv1GHa', 'pf1-content/gxxWYxmCBUIWCPqU'],
    admitted: [],
    refused: 'pf1-content/emgcgmgSjpuv1GHa',
    async check({ read, selectRace, turn, totals, notes }) {
      const PITBORN = 'pf1-content/emgcgmgSjpuv1GHa';
      const WINGS = 'pf1-content/gxxWYxmCBUIWCPqU';
      const targets = [
        'ability.str',
        'ability.dex',
        'ability.int',
        'ability.cha',
        'skill.blf',
        'skill.ste',
        'skill.fly',
      ] as const;
      await selectRace();
      // The tiefling's +2 Dexterity, +2 Intelligence and -2 Charisma;
      // Skilled's +2 racial Bluff and Stealth. Skills add the ability
      // modifier.
      const tiefling = {
        'ability.str': 10,
        'ability.dex': 12,
        'ability.int': 12,
        'ability.cha': 8,
        'skill.blf': 1,
        'skill.ste': 3,
        'skill.fly': 1,
      };
      expect(totals(await read(), targets)).toEqual(tiefling);
      // Demon-Spawn (Pitborn): the curated ability line (+2 Str, +2 Cha,
      // -2 Int) replaces the tiefling's (+2 Dex, +2 Int, -2 Cha), and the
      // skills follow their abilities.
      await turn(PITBORN, true);
      const pitborn = await read();
      expect(totals(pitborn, targets)).toEqual({
        'ability.str': 12,
        'ability.dex': 10,
        'ability.int': 8,
        'ability.cha': 12,
        'skill.blf': 3,
        'skill.ste': 2,
        'skill.fly': 0,
      });
      expect(notes(pitborn, PITBORN)).toContain('Ancestry Demon');
      // Vestigial Wings replaces Skilled: Bluff and Stealth lose their +2
      // racial bonus and Fly gains the wings' +4 racial bonus.
      await turn(WINGS, true);
      expect(totals(await read(), targets)).toEqual({
        'ability.str': 12,
        'ability.dex': 10,
        'ability.int': 8,
        'ability.cha': 12,
        'skill.blf': 1,
        'skill.ste': 0,
        'skill.fly': 4,
      });
      // Turning them off brings the replaced traits back.
      for (const key of [PITBORN, WINGS]) await turn(key, false);
      expect(totals(await read(), targets)).toEqual(tiefling);
    },
  },
  {
    batch: 'racial-traits-400',
    title:
      'an isolated tiefling sheet takes the held Qlippoth-Spawn (the Motherless) in place of the tiefling ability score trait and the held Motherless Skilled in place of Skilled, and keeps access to the campaign',
    race: {
      kind: 'identity',
      race: TIEFLING,
      identityName: 'Tiefling (identity only)',
      grants: [
        'local/race-ability-scores/pf1/nVjKDLZSRONzYm8f',
        'pf1-content/AKuDJrwJUZULsJcS', // Skilled (Tiefling)
      ],
    },
    alternates: [
      'pf1-content/iWZjiKTQnGS5XnB0', // Qlippoth-Spawn (the Motherless)
      'pf1-content/iMdXJ73UwSIDDJdk', // Skilled (Tiefling - the Motherless)
    ],
    held: ['pf1-content/iWZjiKTQnGS5XnB0', 'pf1-content/iMdXJ73UwSIDDJdk'],
    admitted: [],
    refused: 'pf1-content/iWZjiKTQnGS5XnB0',
    async check({ read, selectRace, turn, totals, notes }) {
      const QLIPPOTH = 'pf1-content/iWZjiKTQnGS5XnB0';
      const MOTHERLESS = 'pf1-content/iMdXJ73UwSIDDJdk';
      const targets = [
        'ability.str',
        'ability.dex',
        'ability.int',
        'ability.wis',
        'ability.cha',
        'skill.blf',
        'skill.ste',
        'skill.esc',
        'skill.sur',
      ] as const;
      await selectRace();
      // The tiefling's +2 Dexterity, +2 Intelligence and -2 Charisma;
      // Skilled's +2 racial Bluff and Stealth. Skills add the ability
      // modifier.
      const tiefling = {
        'ability.str': 10,
        'ability.dex': 12,
        'ability.int': 12,
        'ability.wis': 10,
        'ability.cha': 8,
        'skill.blf': 1,
        'skill.ste': 3,
        'skill.esc': 1,
        'skill.sur': 0,
      };
      expect(totals(await read(), targets)).toEqual(tiefling);
      // Qlippoth-Spawn (the Motherless): the curated ability line (+2 Str,
      // +2 Wis, -2 Int) replaces the tiefling's (+2 Dex, +2 Int, -2 Cha), and
      // the skills follow their abilities.
      await turn(QLIPPOTH, true);
      const qlippoth = await read();
      expect(totals(qlippoth, targets)).toEqual({
        'ability.str': 12,
        'ability.dex': 10,
        'ability.int': 8,
        'ability.wis': 12,
        'ability.cha': 10,
        'skill.blf': 2,
        'skill.ste': 2,
        'skill.esc': 0,
        'skill.sur': 1,
      });
      expect(notes(qlippoth, QLIPPOTH)).toContain('Ancestry Qlippoth');
      // The Motherless Skilled replaces Skilled: Bluff and Stealth lose their
      // +2 racial bonus and Escape Artist and Survival gain one.
      await turn(MOTHERLESS, true);
      expect(totals(await read(), targets)).toEqual({
        'ability.str': 12,
        'ability.dex': 10,
        'ability.int': 8,
        'ability.wis': 12,
        'ability.cha': 10,
        'skill.blf': 0,
        'skill.ste': 0,
        'skill.esc': 2,
        'skill.sur': 3,
      });
      // Turning them off brings the replaced traits back.
      for (const key of [QLIPPOTH, MOTHERLESS]) await turn(key, false);
      expect(totals(await read(), targets)).toEqual(tiefling);
    },
  },
  {
    batch: 'racial-traits-401',
    title:
      'an isolated skinwalker sheet takes the held Werebat-Kin (Bloodmarked) in place of the skinwalker ability score trait and the held Bloodmarked skill part in place of Animal-Minded, and keeps access to the campaign',
    race: {
      kind: 'identity',
      race: SKINWALKER,
      identityName: 'Skinwalker (identity only)',
      grants: [
        'local/race-ability-scores/pf1/apWl6JIJ8U8p0azq',
        'pf1-content/bPkht5w4AKauP8Ip', // Animal-Minded
      ],
    },
    alternates: [
      'pf1-content/mBfn8hCLwEsAxlnl', // Werebat-Kin (Bloodmarked)
      'pf1-content/mDDre98oyYIFLJy5', // Alternate Skill Modifiers (Skinwalker - Bloodmarked)
    ],
    held: ['pf1-content/mBfn8hCLwEsAxlnl', 'pf1-content/mDDre98oyYIFLJy5'],
    admitted: [],
    refused: 'pf1-content/mBfn8hCLwEsAxlnl',
    async check({ read, selectRace, turn, totals, notes }) {
      const WEREBAT = 'pf1-content/mBfn8hCLwEsAxlnl';
      const BLOODMARKED = 'pf1-content/mDDre98oyYIFLJy5';
      const targets = [
        'ability.dex',
        'ability.int',
        'ability.wis',
        'skill.han',
        'skill.fly',
        'skill.per',
      ] as const;
      await selectRace();
      // The skinwalker's +2 Wisdom and -2 Intelligence; Animal-Minded's +2
      // racial Handle Animal. Skills add the ability modifier.
      const skinwalker = {
        'ability.dex': 10,
        'ability.int': 8,
        'ability.wis': 12,
        'skill.han': 2,
        'skill.fly': 0,
        'skill.per': 1,
      };
      expect(totals(await read(), targets)).toEqual(skinwalker);
      // Werebat-Kin (Bloodmarked): the curated ability line (+2 Int, -2 Wis)
      // replaces the skinwalker's (+2 Wis, -2 Int), and Perception follows
      // Wisdom.
      await turn(WEREBAT, true);
      const werebat = await read();
      expect(totals(werebat, targets)).toEqual({
        'ability.dex': 10,
        'ability.int': 12,
        'ability.wis': 8,
        'skill.han': 2,
        'skill.fly': 0,
        'skill.per': -1,
      });
      expect(notes(werebat, WEREBAT)).toContain('Ancestry werebat');
      // The Bloodmarked skill part replaces Animal-Minded: Handle Animal
      // loses its +2 racial bonus and Fly gains one; the Perception bonus at
      // night is a Situation the player selects.
      await turn(BLOODMARKED, true);
      expect(totals(await read(), targets)).toEqual({
        'ability.dex': 10,
        'ability.int': 12,
        'ability.wis': 8,
        'skill.han': 0,
        'skill.fly': 2,
        'skill.per': -1,
      });
      // Turning them off brings the replaced traits back.
      for (const key of [WEREBAT, BLOODMARKED]) await turn(key, false);
      expect(totals(await read(), targets)).toEqual(skinwalker);
    },
  },
];

it('refuses a race setup whose fields do not match its kind', () => {
  const grants = ['pf1-content/SiZwOvv9Vz2OluRK'] as const;
  const identity = {
    kind: 'identity',
    race: AASIMAR,
    grants,
    identityName: 'Aasimar (identity only)',
  } as const;
  const shapes: RaceSetup[] = [
    // @ts-expect-error An imported race is saved whole, under no identity name.
    { kind: 'imported', race: AASIMAR, grants, identityName: 'Aasimar' },
    // @ts-expect-error An identity row spread into an imported race keeps its name.
    { ...identity, kind: 'imported' },
    // @ts-expect-error A test-only race names its identity.
    { kind: 'identity', race: AASIMAR, grants },
    // @ts-expect-error A race grants at least one trait.
    { kind: 'identity', race: AASIMAR, grants: [], identityName: 'Aasimar' },
    // @ts-expect-error There is no other kind.
    { ...identity, kind: 'withoutTraits' },
  ];
  expect(shapes).toHaveLength(5);
});

/**
 * Each row race's standard Racial Traits, as the importer links them from
 * the race's Standard folder. The importer moves a race's changes and notes
 * onto its standard traits only when they are imported with it, so each row
 * imports its race with all of them, not only the ones it saves.
 */
const standardTraits: Record<string, readonly [string, ...string[]]> = {
  [UNDINE]: [
    'pf1-content/2zJmqweobLpf54yh',
    'pf1-content/539xDsN3QbslLsz8',
    'pf1-content/9lCx7sugVXLoYbIW',
    'pf1-content/AisJptj1zLCA5blH',
    'pf1-content/B3cuHM7Ab4p8kLmH',
    'pf1-content/JkYEEoXqg586RnrU',
    'pf1-content/hV2bbHMgni1OCXAg',
  ],
  [AASIMAR]: [
    'pf1-content/Hr7VZkVINGbLYfpo',
    'pf1-content/LVToSTaVYtVk7Sa3',
    'pf1-content/SiZwOvv9Vz2OluRK',
    'pf1-content/VfIksZzCRMtktSu6',
    'pf1-content/dk1o8LLPRw7etojM',
    'pf1-content/rd6xPFT4I6qEU1zu',
  ],
  [CHANGELING]: [
    'pf1-content/CmhdInCVqMiadv3T',
    'pf1-content/G8wXEXBfUKfRxuVV',
    'pf1-content/IQphttqw1U0aVd3j',
    'pf1-content/PxjUu8YOjXmWdagL',
    'pf1-content/QgiMP50bjeNmLvbI',
    'pf1-content/Qx1JqPVW0quaOGfY',
    'pf1-content/SCPbTbMBMkwN2Uba',
    'pf1-content/VRVtIxsv59vhHm5y',
    'pf1-content/dFhNrCde0uxjohHy',
    'pf1-content/gGkyhubX0tZ3GwR7',
    'pf1-content/nIhtofd7nMqG4cKF',
    'pf1-content/qVuEXf9CgkYlYK3l',
  ],
  [ELF]: [
    'pf1-content/GS07eqHZBCT979tA',
    'pf1-content/IuApwtNYMYMTabOZ',
    'pf1-content/WOF6A7695wxFO2ie',
    'pf1-content/X3ixmmB9S07XqKNX',
    'pf1-content/bRO90tmeaH1tFi2g',
    'pf1-content/yQvZ03xcsuM8b595',
  ],
  [HALFLING]: [
    'pf1-content/HVI7FNwj2ng10qtj',
    'pf1-content/XVo4DApULZaETYcz',
    'pf1-content/YMocjN3SlwHoQgW1',
    'pf1-content/cOod8wThcNc0expZ',
    'pf1-content/qoCLqjadKmJEN9R7',
    'pf1-content/sSs0BK09PLxjbkAa',
    'pf1-content/xwr9DBDmvGMYHcut',
  ],
  [OREAD]: [
    'pf1-content/UYSb1Adt09Nn6xut',
    'pf1-content/VqKrfxVGYTHWF2ZK',
    'pf1-content/b7b9LL5pcA63eOv1',
    'pf1-content/o4Uk5x9MPYEVfz9P',
    'pf1-content/pbItjcPIPXPP15oc',
    'pf1-content/ulA1l56n9dBEn3vI',
    'pf1-content/y9fELjoo3IShhDhL',
  ],
  [SKINWALKER]: [
    'pf1-content/ZEVsEIPpOyHmpmEe',
    'pf1-content/bPkht5w4AKauP8Ip',
    'pf1-content/mCQvy9sQgS937eTg',
    'pf1-content/mLxAldGcZ0UnEfd7',
    'pf1-content/u06YS9FvVU8JEH36',
  ],
  [TIEFLING]: [
    'pf1-content/748xpeIEFeiucTjV',
    'pf1-content/AKuDJrwJUZULsJcS',
    'pf1-content/BoKaaVK4wgIJW1i9',
    'pf1-content/CcJc9pWgmHCgTmGO',
    'pf1-content/PrbroPUHndaGtsXZ',
    'pf1-content/VKPGN4SPNATBrToA',
    'pf1-content/yUhK1WYx2tDgdCvZ',
  ],
};

function standardTraitsOf(race: string) {
  const keys = standardTraits[race];
  if (!keys) throw new Error(`No standard traits listed for ${race}`);
  return keys;
}

// One import holds every row's race, the race's standard traits and the
// row's alternates (whose replaced traits are standard traits of their race).
// The descriptions' links to spells are not imported, so they stay text; no
// assertion reads a description.
const { entries } = await importReleasedEntries(
  rows.flatMap((row) => [
    row.race.race,
    ...standardTraitsOf(row.race.race),
    ...row.alternates,
  ]),
);

/**
 * Runs one row on a fresh convex-test database: an owner and a member of the
 * campaign's organization and an outsider; a character with ability scores
 * of 10; the row's race, its grants and its alternates as character-scoped
 * Catalog Entries. The row's check drives the steps; then the outsider, an
 * anonymous caller and the member with another campaign's copy of the
 * refused alternate are refused, and the sheet's entries and revision are
 * unchanged.
 */
async function runRow(row: RacialTraitRow) {
  const batchKeys: readonly string[] = racialTraitBatches[row.batch];
  for (const key of row.alternates)
    if (!batchKeys.includes(key))
      throw new Error(`${row.batch} lists no ${key}`);
  for (const key of row.held) expect(disposition(key), key).toBe('held');
  for (const key of row.admitted)
    expect(disposition(key), key).toBe('admitted');
  const raceEntry = importedEntry(entries, row.race.race);
  if (raceEntry.detail.kind !== 'race')
    throw new Error(`${row.race.race} is not a race`);
  if (row.race.kind === 'imported')
    expect(raceEntry.detail.racialTraits).toEqual(row.race.grants);
  const user = (name: string) => `${row.batch}|${name}`;
  const t = convexTest(schema, modules);
  const { campaignId, otherCampaignId } = await t.run(async (ctx) => {
    for (const [name, orgId] of [
      ['owner', 'org'],
      ['member', 'org'],
      ['outsider', 'other'],
    ] as const)
      await ctx.db.insert('user', {
        tokenIdentifier: user(name),
        orgIds: [{ orgId, role: 'member' }],
        characterSheetDemo: true,
      });
    const campaignId = await ctx.db.insert('campaign', {
      name: `Isolated released racial traits (${row.batch})`,
      description: '',
      organizationId: 'org',
      ownerId: user('owner'),
      e2eFixture: {
        namespace: row.batch,
        version: 1,
        workerKey: '0',
        caseKey: 'released',
        campaignKey: 'released',
      },
    });
    const otherCampaignId = await ctx.db.insert('campaign', {
      name: 'Other isolated campaign',
      description: '',
      organizationId: 'org',
      ownerId: user('owner'),
    });
    return { campaignId, otherCampaignId };
  });
  const owner = t.withIdentity({ tokenIdentifier: user('owner') });
  const member = t.withIdentity({ tokenIdentifier: user('member') });
  const outsider = t.withIdentity({ tokenIdentifier: user('outsider') });
  const characterId = await owner.mutation(api.characterSheet.create, {
    organizationId: 'org',
    campaignId,
    name: 'Released racial trait preview',
    kind: 'pc',
    operationId: `create-${row.batch}`,
  });
  const scope = { organizationId: 'org', campaignId, characterId };
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
    operationId: 'base-scores',
  });
  const race = row.race;
  const traits = [...race.grants, ...row.alternates];
  // Placeholders first, so references map to the inserted IDs; then the
  // definitions.
  const ids = await t
    .run(async (ctx) => {
      const ids = new Map<string, Id<'catalogEntry'>>();
      for (const key of traits)
        ids.set(
          key,
          await ctx.db.insert('catalogEntry', {
            scope: 'character',
            characterId,
            name: key,
            ruleIdentity: key,
            stacksWithItself: false,
            modifiers: [],
            sources: [],
            detail: {
              kind: 'racialTrait' as const,
              raceEntryIds: [],
              replaces: [],
            },
          }),
        );
      if (race.kind === 'imported') {
        const raceId = await ctx.db.insert('catalogEntry', {
          scope: 'character',
          characterId,
          name: race.race,
          ruleIdentity: race.race,
          stacksWithItself: false,
          modifiers: [],
          sources: [],
          detail: { kind: 'race' as const, racialTraits: [] },
        });
        ids.set(race.race, raceId);
        await ctx.db.replace('catalogEntry', raceId, {
          scope: 'character',
          characterId,
          ...savedRaceDefinition(entries, race.race, ids),
        });
      } else
        ids.set(
          race.race,
          await ctx.db.insert('catalogEntry', {
            scope: 'character',
            characterId,
            name: race.identityName,
            ruleIdentity: race.race,
            stacksWithItself: false,
            modifiers: [],
            sources: [],
            detail: {
              kind: 'race' as const,
              racialTraits: race.grants.map((key) => ids.get(key)!),
            },
          }),
        );
      for (const key of traits)
        await ctx.db.replace('catalogEntry', ids.get(key)!, {
          scope: 'character',
          characterId,
          ...savedTraitDefinition(entries, key, ids),
        });
      return Object.fromEntries(ids);
    })
    .then((rows) => new Map(Object.entries(rows)));
  const id = (key: string) => {
    const found = ids.get(key);
    if (!found) throw new Error(`No saved entry for ${key}`);
    return found;
  };
  async function read() {
    const saved = withSheetCatalog(
      await owner.query(api.characterSheet.read, scope),
    );
    if (!saved) throw new Error('Missing saved sheet');
    expect(calculateCharacterSheetPreview(saved).derivedStatistics).toEqual(
      saved.calculated.derivedStatistics,
    );
    return saved;
  }
  let operation = 0;
  const steps: RacialTraitSteps = {
    read,
    selectRace: async () => {
      await member.mutation(api.characterSheet.selectRace, {
        ...scope,
        catalogEntryId: id(race.race),
        operationId: 'race',
      });
    },
    turn: async (key, selected) => {
      if (!row.alternates.includes(key))
        throw new Error(`${key} is no alternate of ${row.batch}`);
      operation += 1;
      await member.mutation(api.characterSheet.setRacialTraitSelected, {
        ...scope,
        catalogEntryId: id(key),
        selected,
        operationId: `turn-${operation}`,
      });
    },
    scores: (sheet) =>
      Object.fromEntries(
        ABILITIES.map((ability) => [
          ability,
          sheet.calculated.breakdowns[`ability.${ability}`].total,
        ]),
      ),
    totals: (sheet, targets) =>
      Object.fromEntries(
        targets.map((target) => [
          target,
          sheet.calculated.breakdowns[target as 'skill.per'].total,
        ]),
      ),
    notes: (sheet, key) =>
      sheet.catalogEntries
        .find((entry) => entry._id === id(key))
        ?.situationalNotes?.map((note) => note.text)
        .join(' ') ?? '',
  };
  await row.check(steps);
  // Outsiders, anonymous callers and another campaign's entries are refused.
  const noAccess = 'You do not have access to this org';
  const before = await read();
  await expect(
    outsider.mutation(api.characterSheet.setRacialTraitSelected, {
      ...scope,
      catalogEntryId: id(row.refused),
      selected: true,
      operationId: 'outsider',
    }),
  ).rejects.toThrow(noAccess);
  await expect(
    t.mutation(api.characterSheet.setRacialTraitSelected, {
      ...scope,
      catalogEntryId: id(row.refused),
      selected: true,
      operationId: 'anonymous',
    }),
  ).rejects.toThrow(noAccess);
  const foreign = await t.run(async (ctx) =>
    ctx.db.insert('catalogEntry', {
      scope: 'campaign',
      campaignId: otherCampaignId,
      ...savedTraitDefinition(entries, row.refused, ids),
    }),
  );
  await expect(
    member.mutation(api.characterSheet.setRacialTraitSelected, {
      ...scope,
      catalogEntryId: foreign,
      selected: true,
      operationId: 'foreign',
    }),
  ).rejects.toThrow('Catalog Entry does not belong to this Character');
  const after = await read();
  expect(after.entries).toEqual(before.entries);
  expect(after.revision).toBe(before.revision);
}

describe('released racial traits on a saved sheet', () => {
  for (const row of rows)
    test(`${row.title} (${row.batch})`, () => runRow(row), 60_000);
});
