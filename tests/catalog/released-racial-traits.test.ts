// @vitest-environment node
// pbl-released-racial-traits (PRD #251): the racial-trait batch units'
// resolver blocks (racial-traits-387 to -405 and -719), on entries imported
// from the pinned store. One import holds every key of the nineteen batch key
// lists and their context (released-racial-trait-keys.ts); each describe
// looks its traits up by name within its batch's list, and a check of "every
// entry" checks that list's keys, as the batch units did over their preview.
// The racial-traits-719 cases import that fixture tree's records on their
// own (below). Each case asserts only what the importer emits for the
// entries or what the resolver or the sheet computes from them; the batch
// reviews' and legal records are not read.
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';
import {
  applyCuration,
  collectCurationInputs,
  collectDescriptionInputs,
  parseCuration,
} from '../../scripts/catalog/curation';
import { mapEntry, upstreamRecord } from '../../scripts/catalog/map';
import { raceAbilityTraitKey } from '../../scripts/catalog/racial-trait-rules';
import type { LoadedRecord } from '../../scripts/catalog/records';
import {
  calculateCharacterSheet,
  calculateCharacterSheetProjections,
  modifierTargets,
  resolveSheet,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
  type SheetEntry,
} from '../../src/lib/character-sheet';
import { satisfiesRacialPrerequisite } from '../../src/lib/character-sheet-racial';
import {
  evaluateFormula,
  parseFormula,
} from '../../src/lib/character-sheet-formulas';
import { outputSchema } from '../../src/lib/catalog/curation-output-schema';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { pinnedRecordFile, readPinned } from './pinned-sources';
import { importReleasedEntries } from './released-entries';
import {
  racialTraitBatches,
  racialTraitContext,
  racialTraits719,
} from './released-racial-trait-keys';
import {
  alternateRow,
  grantedTraitRow,
  importedEntry,
  raceSheet,
  racialTraitBatch,
} from './released-racial-trait-sheet';
import { sheetDefinition } from './released-race-sheet';
import {
  situations719,
  totals719,
  type Statistic,
} from './released-racial-trait-719-totals';

const { entries } = await importReleasedEntries([
  ...Object.values(racialTraitBatches).flat(),
  ...racialTraitContext,
]);

describe('the racial-traits-387 keys', () => {
  const {
    batchEntries,
    entry,
    modifiers,
    indexOf,
    resolved,
    resolvedInSchool,
    racialTraitSheet,
    identityRace,
    total,
  } = racialTraitBatch(entries, 'racial-traits-387');
  it("the two heritages curated with their ability lines replace their race's ability score trait: it goes dormant, and their own adjustments count", () => {
    // The two heritages curated with their ability lines replace their race's
    // ability score trait: it goes dormant, and their own adjustments count.
    for (const [name, race, raceKey, before, after] of [
      [
        'Rimesoul (Frost Undine)',
        'Undine',
        'pf1/iqJvhd7NbmybUl0y',
        { 'ability.dex': 12, 'ability.wis': 12, 'ability.str': 8 },
        {
          'ability.dex': 12,
          'ability.int': 12,
          'ability.cha': 8,
          'ability.wis': 10,
          'ability.str': 10,
        },
      ],
      [
        'Div-Spawn (Spitespawn)',
        'Tiefling',
        'pf1/nVjKDLZSRONzYm8f',
        { 'ability.dex': 12, 'ability.int': 12, 'ability.cha': 8 },
        { 'ability.dex': 12, 'ability.cha': 12, 'ability.int': 8 },
      ],
    ] as const) {
      const heritage = entry(name);
      expect(heritage.detail.raceKeys?.[0], name).toBe(raceKey);
      expect(heritage.detail.replaces, name).toEqual([
        `local/race-ability-scores/${raceKey}`,
      ]);
      expect(heritage.detail.unresolvedReplacements, name).toBeUndefined();
      expect(importedEntry(entries, raceKey).name).toBe(race);
      const plain = racialTraitSheet({ race: raceKey });
      const chosen = racialTraitSheet({
        race: raceKey,
        traits: [heritage.externalKey],
      });
      for (const [target, value] of Object.entries(before))
        expect(total(plain, target as 'ability.str'), `${race} ${target}`).toBe(
          value,
        );
      for (const [target, value] of Object.entries(after))
        expect(
          total(chosen, target as 'ability.str'),
          `${name} ${target}`,
        ).toBe(value);
    }
  });

  it('Brine May\'s ability line belongs to its own Subrace Standard record, so Sea-Born keeps "Base Statistics" unmatched and carries no Modifier', () => {
    // Brine May's ability line belongs to its own Subrace Standard record, so
    // Sea-Born keeps "Base Statistics" unmatched and carries no Modifier.
    expect(entry('Sea-Born (Brine May)').modifiers).toEqual([]);
    expect(entry('Sea-Born (Brine May)').detail.unresolvedReplacements).toEqual(
      ['Base Statistics'],
    );
  });

  it('situational bonuses apply only when their Situation is selected', () => {
    // Situational bonuses apply only when their Situation is selected.
    for (const [name, target, label, value] of [
      ['Deep Tradition', 'attack.melee', 'against drow', 1],
      ['Deep Tradition', 'ac.other', 'attacks of opportunity', 1],
      ['Unfettered', 'save.ref', 'entangled', 2],
      ['Unfettered', 'cmb', 'escape a grapple', 2],
      ['Unfettered', 'cmd', 'grapple', 2],
      ['Minesight (Dwarf)', 'save.will', 'light descriptor', -2],
      ['Curiosity', 'skill.dip', 'gather information', 4],
      ['Curiosity', 'skill.khi', 'Knowledge (history)', 2],
      ['Curiosity', 'skill.klo', 'Knowledge (local)', 2],
      ['Irrepressible', 'save.will', 'dominate', 2],
      ['Scavenger', 'skill.per', 'hidden objects', 2],
      ['Darklands Guide', 'save.ref', 'traps and hazards', 2],
      ['Crystalline Form', 'ac.other', 'rays', 2],
      ['Shadowhunter (Halfling)', 'save.fort', 'negative levels', 2],
      ['Change Shape (Skinwalker - Scaleheart)', 'ability.str', 'bestial', 2],
      ['Halo', 'skill.int', 'evil creatures', 2],
      ['Halo', 'save.ref', 'blinded or dazzled', 2],
      ['Sense Aberration', 'skill.per', 'aberrations', 2],
    ] as const) {
      const base = target
        .replace(/^save\..*/, 'saves')
        .replace(/^ac\..*/, 'ac');
      const index = indexOf(name, base === target ? target : base, label);
      expect(resolved(name, target), `${name} ${target}`).toBe(0);
      expect(resolved(name, target, [index]), `${name} ${target}`).toBe(value);
    }
  });

  it("Own Two Feet's riding penalty sits on the Orang-Pendak race entry (its #328 description record); the trait adds no second copy, only the ability-check Note", () => {
    // Own Two Feet's riding penalty sits on the Orang-Pendak race entry (its
    // #328 description record); the trait adds no second copy, only the
    // ability-check Note.
    const feet = 'Own Two Feet';
    expect(entry(feet).modifiers).toEqual([]);
    expect(
      entry(feet).situationalNotes?.some(
        (note) => !note.target && note.text.includes('ability checks'),
      ),
    ).toBe(true);
  });

  it("Darklands Guide's initiative bonus applies always (PCGen's reading)", () => {
    // Darklands Guide's initiative bonus applies always (PCGen's reading).
    expect(resolved('Darklands Guide', 'init')).toBe(2);
  });

  it("shared Situations: the same type within one entry doesn't stack", () => {
    // Shared Situations: the same type within one entry doesn't stack.
    const reptile = 'Reptilian Ancestry';
    expect(modifiers(reptile).map((row) => row.condition?.situation)).toEqual([
      'mindAffecting',
      'poison',
    ]);
    expect(resolved(reptile, 'save.will', [0])).toBe(2);
    expect(resolved(reptile, 'save.will', [0, 1])).toBe(2);
    expect(modifiers('Dreamer').map((row) => row.condition?.situation)).toEqual(
      ['illusions'],
    );
    expect(resolved('Dreamer', 'save.will', [0])).toBe(2);
    const rat = 'Lab Rat';
    expect(modifiers(rat)[0]?.condition?.situation).toBe('poison');
    expect(resolved(rat, 'save.fort', [0, 1])).toBe(1);
  });

  it('school DCs apply to the named school only', () => {
    // School DCs apply to the named school only.
    for (const [name, school] of [
      ['Seducer', 'enchantment'],
      ['Utilitarian Magic', 'transmutation'],
    ] as const) {
      expect(resolvedInSchool(name, 'spellDC', school), name).toBe(1);
      expect(resolvedInSchool(name, 'spellDC', 'evocation'), name).toBe(0);
      expect(entry(name).unsupported, name).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'changes' })]),
      );
    }
  });

  it('imported changes keep mapping; nothing is curated a second time', () => {
    // Imported changes keep mapping; nothing is curated a second time.
    for (const [name, target, value] of [
      ['Unfettered', 'skill.esc', 4],
      ['Fey Nature', 'skill.han', 2],
      ['Fey Nature', 'skill.kna', 2],
      ['Keen Senses (Half-Elf)', 'skill.per', 2],
      ['Frightening', 'skill.int', 2],
      ['Scavenger', 'skill.apr', 2],
      ['Sense Aberration', 'skill.kdu', 2],
      ['Skilled (Aasimar - Angelkin)', 'skill.hea', 2],
      ['Alternate Skill Modifiers (Skinwalker - Fanglord)', 'skill.acr', 2],
      ['Armor (Kobold)', 'ac.natural', 1],
    ] as const)
      expect(resolved(name, target), `${name} ${target}`).toBe(value);
  });

  it("the race's re-homed note records supply Camouflage's and Greed's bonuses; Forest Walker's own checked records carry the same outputs and supersede the Orang-Pendak race note records (reported stale), so each counts once", () => {
    // The race's re-homed note records supply Camouflage's and Greed's bonuses;
    // Forest Walker's own checked records carry the same outputs and supersede
    // the Orang-Pendak race note records (reported stale), so each counts once.
    for (const [name, target, value] of [
      ['Forest Walker (Orang-Pendak)', 'skill.clm', 4],
      ['Forest Walker (Orang-Pendak)', 'skill.ste', 4],
      ['Camouflage', 'skill.ste', 4],
      ['Greed (Dwarf)', 'skill.apr', 2],
    ] as const) {
      const all = modifiers(name).map((_, index) => index);
      expect(resolved(name, target), `${name} ${target}`).toBe(0);
      expect(resolved(name, target, all), `${name} ${target}`).toBe(value);
    }
    expect(
      modifiers('Forest Walker (Orang-Pendak)').map((row) => row.bonusType),
    ).toEqual(['untyped', 'untyped', 'untyped', 'untyped']);
  });

  it('the two untargeted Final Change changes describe the transformed deep one and contribute nothing', () => {
    // The two untargeted Final Change changes describe the transformed deep
    // one and contribute nothing.
    expect(entry('Final Change').modifiers).toEqual([]);
  });

  // racial-traits-387.test.ts:302 is a mixed block: its checks of the batch's
  // curation and legal records stay with the unit; these three cases carry its
  // Note, sheet and rule-field checks.
  it('puts the Notes the Foundry data put on unrelated statistics at entry level, and the targeted Notes on their statistics', () => {
    for (const name of [
      'Energy Resistance (Suli)',
      'Negative Energy Affinity',
      'Deepsight',
    ])
      expect(
        entry(name)
          .situationalNotes?.filter((note) => note.target)
          .map((note) => note.target),
        name,
      ).toEqual([]);
    for (const [name, targets] of [
      ['Minesight (Dwarf)', ['attack', 'skill.per']],
      ['Dusksight (Dwarf)', ['attack.ranged']],
      ['Shadowhunter (Halfling)', ['attack']],
      ['Light Blindness (Drow)', ['attack', 'skill.per']],
      ['Magical Absorption', ['saves']],
    ] as const)
      expect(
        entry(name)
          .situationalNotes?.filter((note) => note.target)
          .map((note) => note.target)
          .sort(),
        name,
      ).toEqual(targets);
  });

  it("stacks Irrepressible's +2 against dominate and possession with Halfling Luck's +1 on every save, with no stacksWithinEntry", () => {
    // Racial bonuses from different Sources stack (PRD §8), so no
    // stacksWithinEntry is needed and the resolved sheet gives +3.
    const irrepressible = entry('Irrepressible');
    expect(irrepressible.modifiers.every((row) => !row.stacksWithinEntry)).toBe(
      true,
    );
    const luck = importedEntry(entries, 'pf1-content/HVI7FNwj2ng10qtj');
    expect(luck.name).toBe('Halfling Luck');
    expect(luck.modifiers).toEqual([
      { target: 'saves', bonusType: 'racial', value: 1 },
    ]);
    // The halfling race grants halfling luck; this test-only race carries only
    // the pinned Halfling identity and that Grant, so every bonus is the
    // traits'.
    const halflingKey = 'pf1/Hf31mrYb3uucNyLO';
    expect(irrepressible.detail.raceKeys?.[0]).toBe(halflingKey);
    expect(luck.detail).toMatchObject({
      raceKeys: [halflingKey],
      standard: true,
    });
    const halfling = identityRace(
      racialTraitSheet({ traits: [irrepressible.externalKey] }),
      halflingKey,
      [luck.externalKey],
    );
    const dominate = {
      local: 'against dominate and possession effects',
      sheetEntryId: `trait:${irrepressible.externalKey}`,
    };
    for (const target of ['save.fort', 'save.ref', 'save.will'] as const) {
      expect(
        calculateCharacterSheetProjections(halfling).current.breakdowns[target]
          .total,
        target,
      ).toBe(1);
      expect(
        calculateCharacterSheetProjections(halfling, { situations: [dominate] })
          .current.breakdowns[target].total,
        target,
      ).toBe(3);
    }
  });

  it('does not let Drow Heritage count as drow: that needs a reviewed racial-trait rule', () => {
    expect(entry('Drow Heritage')).not.toHaveProperty('countsAsRaces');
  });

  it('no armor, shield or natural armor bonus sits on ac.other', () => {
    // No armor, shield or natural armor bonus sits on ac.other.
    for (const row of batchEntries)
      for (const modifier of row.modifiers)
        if (['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType))
          expect(modifier.target, row.name).not.toBe('ac.other');
  });

  // The replacement fields in
  // racial-traits-387.test.ts:621, proof blocks whose record checks stay
  // with the unit (fix r2).
  it("reads the batch's unresolved replacement names (racial-traits-387.test.ts:621)", () => {
    // The batch's list: each trait that keeps a replacement name unresolved,
    // with those names; every other trait resolves all of its replacements.
    expect(batchEntries).toHaveLength(71);
    const unresolved = Object.fromEntries(
      batchEntries
        .filter((row) => row.detail.unresolvedReplacements?.length)
        .map((row) => [row.name, row.detail.unresolvedReplacements]),
    );
    expect(unresolved).toEqual({
      // Header the importer does not read (bold closes inside the label).
      'Alternate Spell-Like Ability (Dhampir - Ancient-Born)': [
        'Alternate Spell-Like Ability (Dhampir - Ancient-Born)',
      ],
      'Alternate Spell-Like Ability (Dhampir - Svetocher)': [
        'Alternate Spell-Like Ability (Dhampir - Svetocher)',
      ],
      // Category words and names with no trait record.
      'Living Machine': ['Type'],
      'Drow Heritage': ['Bonus Languages'],
      // "Nature Magic" is a typo for Natural Magic.
      'Magical Absorption': ['Past-Life Knowledge', 'Nature Magic'],
      // Changeling subraces and racial subtypes keep their race's ability trait.
      'Sea-Born (Brine May)': ['Base Statistics'],
      'Ekujae Elves': ['Base Statistics'],
      'Jininese Elves': ['Base Statistics'],
    });
  });
});

describe('the racial-traits-388 keys', () => {
  const {
    batchEntries,
    entry,
    modifiers,
    indexOf,
    resolved,
    racialTraitSheet,
    total,
  } = racialTraitBatch(entries, 'racial-traits-388');
  it("Archon-Blooded, curated with its ability line, replaces the aasimar's ability score trait: it goes dormant, and the heritage's adjustments count", () => {
    // Archon-Blooded, curated with its ability line, replaces the aasimar's
    // ability score trait: it goes dormant, and the heritage's adjustments count.
    const heritage = entry('Archon-Blooded (Lawbringers)');
    const raceKey = 'pf1/FHY3oIk5zSOFncJH';
    expect(heritage.detail.raceKeys?.[0]).toBe(raceKey);
    expect(heritage.detail.replaces).toEqual([
      'local/race-ability-scores/pf1/FHY3oIk5zSOFncJH',
    ]);
    expect(heritage.detail.unresolvedReplacements).toBeUndefined();
    expect(importedEntry(entries, raceKey).name).toBe('Aasimar');
    const plain = racialTraitSheet({ race: raceKey });
    const chosen = racialTraitSheet({
      race: raceKey,
      traits: [heritage.externalKey],
    });
    for (const [target, before, after] of [
      ['ability.str', 10, 10],
      ['ability.con', 10, 12],
      ['ability.wis', 12, 12],
      ['ability.cha', 12, 10],
    ] as const) {
      expect(total(plain, target as 'ability.str'), `Aasimar ${target}`).toBe(
        before,
      );
      expect(
        total(chosen, target as 'ability.str'),
        `Archon-Blooded ${target}`,
      ).toBe(after);
    }
  });

  it("the waker may's imported ability line replaces the changeling's Ability Modifiers trait by name", () => {
    // The waker may's imported ability line replaces the changeling's Ability
    // Modifiers trait by name.
    const waker = entry('Ability Modifiers (Changeling - Waker May)');
    expect(waker.detail.replaces).toEqual(['pf1-content/PxjUu8YOjXmWdagL']);
    for (const [target, value] of [
      ['ability.str', 2],
      ['ability.cha', 2],
      ['ability.wis', -2],
    ] as const)
      expect(resolved(waker.name, target), target).toBe(value);
  });

  it('the racial subtypes and the aquatic elf ethnicity carry no Modifier and keep "Base Statistics" unmatched', () => {
    // The racial subtypes and the aquatic elf ethnicity carry no Modifier and
    // keep "Base Statistics" unmatched.
    for (const name of [
      'Aquatic Elves',
      'Slave Born',
      'Arena-Bred',
      'Human-Raised (Half-Elf)',
    ]) {
      expect(entry(name).modifiers, name).toEqual([]);
      expect(entry(name).detail.unresolvedReplacements, name).toEqual([
        'Base Statistics',
      ]);
    }
  });

  it('situational bonuses apply only when their Situation is selected', () => {
    // Situational bonuses apply only when their Situation is selected.
    for (const [name, target, label, value] of [
      ['Eye for Opportunity', 'attack.melee', 'attacks of opportunity', 1],
      ['Siege Survivor', 'attack.melee', 'not moved', 1],
      ['Stalwart Watcher', 'attack.ranged', 'fey', 1],
      ['Craven', 'attack.melee', 'flanking', 1],
      ['Craven', 'ac.other', 'fear effect', 1],
      ['Nimble Faller', 'cmd', 'trip', 1],
      ['Xenophobic', 'save.will', 'other than fear', 1],
      ['Greed (Wyvaran)', 'skill.slt', 'take items', 2],
      ['Unnatural', 'ac.other', 'animals', 2],
      ['Unnatural', 'skill.han', 'animal type', -4],
      ['Unnatural', 'skill.umd', 'animal type', -4],
      ['Divided Attention', 'ac.other', 'flank', 1],
      ['Frightener', 'spellDC', 'fear descriptor', 1],
      ['Vampiric Empathy', 'skill.dip', 'bats, rats', 2],
      ['Shadowhunter (Half-Elf)', 'save.fort', 'negative levels', 2],
      ['Sensual', 'skill.prf', 'Perform', 2],
      ['Stonecunning (Dwarf)', 'skill.per', 'stonework', 2],
    ] as const) {
      const base = target
        .replace(/^save\..*/, 'saves')
        .replace(/^ac\..*/, 'ac')
        .replace(/^attack\..*/, 'attack');
      const index = modifiers(name).findIndex(
        (row) =>
          (row.target === target || row.target === base) &&
          JSON.stringify(row.condition?.situation ?? '').includes(label),
      );
      expect(index, `${name} ${target}`).toBeGreaterThanOrEqual(0);
      expect(resolved(name, target), `${name} ${target}`).toBe(0);
      expect(resolved(name, target, [index]), `${name} ${target}`).toBe(value);
    }
  });

  it("Acquisitive's +4 is the new total: racial bonuses on one entry don't stack, so the Situation raises the imported +2 to +4", () => {
    // Acquisitive's +4 is the new total: racial bonuses on one entry don't
    // stack, so the Situation raises the imported +2 to +4.
    const hoard = indexOf('Acquisitive', 'skill.apr', 'treasure hoard');
    expect(resolved('Acquisitive', 'skill.apr')).toBe(2);
    expect(resolved('Acquisitive', 'skill.apr', [hoard])).toBe(4);
  });

  it('shared Situations', () => {
    // Shared Situations.
    expect(
      modifiers('Craven').map((row) => row.condition?.situation),
    ).toContain('fear');
    const fear = modifiers('Craven').findIndex(
      (row) => row.condition?.situation === 'fear',
    );
    expect(resolved('Craven', 'save.will', [fear])).toBe(-2);
    const watcher = modifiers('Stalwart Watcher').findIndex(
      (row) => row.condition?.situation === 'mindAffecting',
    );
    expect(resolved('Stalwart Watcher', 'save.will', [watcher])).toBe(2);
    expect(
      modifiers('Share Knowledge').map((row) => row.condition?.situation),
    ).toEqual(['poison']);
    expect(resolved('Share Knowledge', 'save.fort', [0])).toBe(2);
  });

  it('imported changes keep mapping; nothing is curated a second time', () => {
    // Imported changes keep mapping; nothing is curated a second time.
    for (const [name, target, value] of [
      ['Craven', 'init', 1],
      ['Greed (Wyvaran)', 'skill.apr', 2],
      ['Deep Jungle', 'skill.sur', 2],
      ['Taskmaster', 'skill.dip', 2],
      ['Climber', 'skill.clm', 2],
      ['Giant Ancestry', 'cmb', 1],
      ['Giant Ancestry', 'cmd', 1],
      ['Giant Ancestry', 'skill.ste', -2],
      ['Market Dweller', 'skill.sen', 2],
      ['Forest Walker (Half-Orc)', 'skill.clm', 2],
      ["Ocean's Daughter", 'skill.swm', 1],
      ['Ability Score Modifiers (Kitsune)', 'ability.dex', 2],
      ['Ability Score Modifiers (Kitsune)', 'ability.str', -2],
    ] as const)
      expect(resolved(name, target), `${name} ${target}`).toBe(value);
  });

  it("the race's re-homed note records supply Fearless's and Stability's bonuses (shared Situations)", () => {
    // The race's re-homed note records supply Fearless's and Stability's
    // bonuses (shared Situations).
    for (const [name, target, value] of [
      ['Fearless (Green Martian)', 'save.will', 2],
      ['Stability (Duergar)', 'cmd', 4],
    ] as const) {
      const all = modifiers(name).map((_, index) => index);
      expect(resolved(name, target), `${name} ${target}`).toBe(0);
      expect(resolved(name, target, all), `${name} ${target}`).toBe(value);
    }
  });

  it("Stonecunning's own checked note record carries the Dwarf race record's outputs (an uncovered trait note), so the bonus counts once, untyped", () => {
    // Stonecunning's own checked note record carries the Dwarf race record's
    // outputs (an uncovered trait note), so the bonus counts once, untyped.
    expect(
      modifiers('Stonecunning (Dwarf)').map((row) => row.bonusType),
    ).toEqual(['untyped']);
  });

  it('no armor, shield or natural armor bonus sits on ac.other', () => {
    // No armor, shield or natural armor bonus sits on ac.other.
    for (const row of batchEntries)
      for (const modifier of row.modifiers)
        if (['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType))
          expect(modifier.target, row.name).not.toBe('ac.other');
  });

  // Rule fields of the batch review's named entries in
  // racial-traits-388.test.ts:283,
  // a proof block whose record checks stay with the unit (fix r2).
  it("keeps the named traits' Notes on their statistics or at entry level and their reviewed Modifiers (racial-traits-388.test.ts:283)", () => {
    expect(entry('Delicious').modifiers).toEqual([]);
    for (const name of [
      'Thunderous Resilience',
      'Sure Step (Half-Elf)',
      'Nimble Faller',
      'Deep Jungle',
      'Boundary Walker',
      'Amphibious (Adaro)',
      'Cannibalistic Vitality',
      'Unnatural',
    ])
      expect(
        entry(name)
          .situationalNotes?.filter((note) => note.target)
          .map((note) => note.target),
        name,
      ).toEqual([]);
    for (const [name, targets] of [
      ['Light Sensitivity (Kobold)', ['attack', 'skill.per']],
      ['Shadowhunter (Half-Elf)', ['attack']],
      ['Surface Survivalist', ['save.fort']],
      ['Carrion Sense', ['skill.per']],
      ['Pharaonic Will', ['saves']],
      ['Sociable', ['skill.dip']],
      ['Greed (Wyvaran)', ['skill.slt']],
      ["Ocean's Daughter", ['skill.swm']],
      [
        'Share Knowledge',
        [
          'skill.kar',
          'skill.kdu',
          'skill.ken',
          'skill.kge',
          'skill.khi',
          'skill.klo',
          'skill.kna',
          'skill.kno',
          'skill.kpl',
          'skill.kre',
        ],
      ],
    ] as const)
      expect(
        entry(name)
          .situationalNotes?.filter((note) => note.target)
          .map((note) => note.target)
          .sort(),
        name,
      ).toEqual(targets);
  });

  // The replacement fields in
  // racial-traits-388.test.ts:630, proof blocks whose record checks stay
  // with the unit (fix r2).
  it("reads the batch's unresolved replacement names and the named traits' replaced traits (racial-traits-388.test.ts:630)", () => {
    // The batch's list: each trait that keeps a replacement name unresolved,
    // with those names; every other trait resolves all of its replacements.
    expect(batchEntries).toHaveLength(71);
    const unresolved = Object.fromEntries(
      batchEntries
        .filter((row) => row.detail.unresolvedReplacements?.length)
        .map((row) => [row.name, row.detail.unresolvedReplacements]),
    );
    expect(unresolved).toEqual({
      // Racial subtypes and the aquatic elf ethnicity keep their race's ability
      // score trait.
      'Aquatic Elves': ['Base Statistics'],
      'Slave Born': ['Base Statistics'],
      'Arena-Bred': ['Base Statistics'],
      'Human-Raised (Half-Elf)': ['Base Statistics'],
      // Names with no standard trait record.
      'Cave Crawler': ['Fast Movement'],
      "Ocean's Daughter": ['Sea Lungs'],
    });
    for (const name of [
      'Alternate Spell-Like Ability (Skinwalker - Fanglord)',
      'Alternate Spell-Like Ability (Skinwalker - Aerieborn)',
      'Alternate Spell-Like Ability (Skinwalker - Coldborn)',
    ])
      expect(entry(name).detail.replaces, name).toEqual([
        'pf1-content/ZEVsEIPpOyHmpmEe',
      ]);
  });
});

describe('the racial-traits-389 keys', () => {
  const {
    batchEntries,
    entry,
    modifiers,
    indexOf,
    resolved,
    racialTraitSheet,
    identityRace,
    total,
  } = racialTraitBatch(entries, 'racial-traits-389');
  // Two records share the name "Feral" (the half-orc racial subtype and the
  // orc alternate), so a stable key also selects an entry.
  const FERAL_ORC = 'pf1-content/A7bikGavod3dmWDl';
  const FERAL_HALF_ORC = 'pf1-content/7JHnhD96PeWEnf7U';
  it('situational bonuses apply only when their Situation is selected', () => {
    // Situational bonuses apply only when their Situation is selected.
    for (const [name, target, base, label, value] of [
      ['Deep Warrior', 'ac.other', 'ac', 'aberration', 2],
      ['Deep Warrior', 'cmb', 'cmb', 'grapple aberrations', 2],
      ['Soaring Agility', 'ac.other', 'ac', '20 feet below', 1],
      ['Serpent Affinity', 'casterLevel', 'casterLevel', 'Scalykind', 1],
      ["Creator's Legacy", 'casterLevel', 'casterLevel', 'Plant domain', 1],
      ['Round Ears', 'skill.dis', 'skill.dis', 'appear human', 4],
      ['Secretive', 'save.will', 'saves', 'divination', 2],
      ['Light against Darkness', 'attack.melee', 'attack', 'demon', 1],
      ['Light against Darkness', 'attack.ranged', 'attack', 'demon', 1],
      ['Stoic', 'save.will', 'saves', 'emotion', 2],
      ['Take to the Water', 'init', 'init', 'swimming', 2],
      ['Take to the Water', 'save.ref', 'save.ref', 'swimming', 2],
      ['Stoneseer (Svirfneblin)', 'casterLevel', 'casterLevel', 'earth', 1],
      ['Object of Desire', 'casterLevel', 'casterLevel', 'charm', 1],
      ['Sound Mimicry', 'skill.blf', 'skill.blf', 'mimic sounds', 4],
      ['Ancestral Grudge', 'attack.melee', 'attack', 'dwarf or elf', 1],
      ['Shadowhunter (Elf)', 'save.fort', 'saves', 'negative levels', 2],
      [FERAL_ORC, 'attack.melee', 'attack.melee', 'negative hit points', 1],
      [FERAL_ORC, 'damage.melee', 'damage.melee', 'negative hit points', 1],
      ['Knack with Poison', 'skill.crf', 'skill.crf', 'make poison', 2],
      ['Knack with Poison', 'save.fort', 'save.fort', 'accidentally', 4],
    ] as const) {
      const index = indexOf(name, base, label);
      expect(resolved(name, target), `${name} ${target}`).toBe(0);
      expect(resolved(name, target, [index]), `${name} ${target}`).toBe(value);
    }
  });

  it('a dodge bonus to AC is neither armor, shield nor natural armor', () => {
    // A dodge bonus to AC is neither armor, shield nor natural armor.
    expect(resolved('Deep Warrior', 'ac.other', [0])).toBe(2);
  });

  it("one Situation covers both of Take to the Water's swimming bonuses, and the orc's feral bonus covers attack and damage", () => {
    // One Situation covers both of Take to the Water's swimming bonuses, and
    // the orc's feral bonus covers attack and damage.
    expect(
      modifiers('Take to the Water')
        .filter((row) => row.condition?.situation)
        .map((row) => row.condition?.situation),
    ).toEqual([{ local: 'while swimming' }, { local: 'while swimming' }]);
  });

  it("shared Situations only where the body's condition matches exactly; the same type within one entry doesn't stack", () => {
    // Shared Situations only where the body's condition matches exactly; the
    // same type within one entry doesn't stack.
    for (const [name, shared, target, value] of [
      ['Secretive', 'enchantment', 'save.will', 2],
      ['Stoic', 'fear', 'save.will', 2],
      ['Fey Fortitude', 'death', 'save.fort', 2],
      ['Knack with Poison', 'poison', 'save.fort', 2],
    ] as const) {
      const index = modifiers(name).findIndex(
        (row) => row.condition?.situation === shared,
      );
      expect(index, `${name} ${shared}`).toBeGreaterThanOrEqual(0);
      expect(resolved(name, target, [index]), name).toBe(value);
      const all = modifiers(name).map((_, index) => index);
      expect(resolved(name, target, all), name).toBe(
        name === 'Knack with Poison' ? 4 : value,
      );
    }
  });

  it('imported changes keep mapping; nothing is curated a second time', () => {
    // Imported changes keep mapping; nothing is curated a second time.
    for (const [name, target, value] of [
      ['Scarred', 'ac.natural', 1],
      ['Armor (Merfolk)', 'ac.natural', 2],
      ['Shiftless', 'skill.blf', 2],
      ['Shiftless', 'skill.slt', 2],
      ['Vigilant Gaze', 'skill.per', 1],
      ['Vigilant Gaze', 'skill.sen', 1],
      ['Take to the Water', 'skill.swm', 8],
      ['Skilled (Tiefling)', 'skill.blf', 2],
      ['Skilled (Tiefling)', 'skill.ste', 2],
      ['Ability Score Modifiers (Gathlain)', 'ability.dex', 2],
      ['Ability Score Modifiers (Gathlain)', 'ability.cha', 2],
      ['Ability Score Modifiers (Gathlain)', 'ability.con', -2],
    ] as const)
      expect(resolved(name, target), `${name} ${target}`).toBe(value);
    for (const name of ['Scarred', 'Armor (Merfolk)'])
      expect(
        modifiers(name).map((row) => [row.target, row.bonusType]),
        name,
      ).toEqual([['ac.natural', 'naturalArmor']]);
  });

  it("the changeling heritages' ability records replace the changeling's own ability trait by name: it goes dormant and their untyped lines count", () => {
    // The changeling heritages' ability records replace the changeling's own
    // ability trait by name: it goes dormant and their untyped lines count.
    const sorrow = entry('Ability Modifiers (Changeling - Sorrow May)');
    const virga = entry('Ability Modifiers (Changeling - Virga May)');
    const changelingAbilities = 'pf1-content/PxjUu8YOjXmWdagL';
    for (const heritage of [sorrow, virga])
      expect(heritage.detail.replaces, heritage.name).toEqual([
        changelingAbilities,
      ]);
    const changeling = 'pf1/9FBT6uqlRgaw9gug';
    expect(sorrow.detail.raceKeys?.[0]).toBe(changeling);
    const scores = (traits: string[]) => {
      const sheet = identityRace(racialTraitSheet({ traits }), changeling, [
        changelingAbilities,
      ]);
      return Object.fromEntries(
        (['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((ability) => [
          ability,
          total(sheet, `ability.${ability}`),
        ]),
      );
    };
    expect(scores([])).toEqual({
      str: 10,
      dex: 10,
      con: 8,
      int: 10,
      wis: 12,
      cha: 12,
    });
    expect(scores([sorrow.externalKey])).toEqual({
      str: 10,
      dex: 10,
      con: 8,
      int: 12,
      wis: 12,
      cha: 10,
    });
    expect(scores([virga.externalKey])).toEqual({
      str: 10,
      dex: 10,
      con: 8,
      int: 10,
      wis: 12,
      cha: 12,
    });
    for (const heritage of [sorrow, virga])
      expect(
        heritage.modifiers.map((row) => row.bonusType),
        heritage.name,
      ).toEqual(['untyped', 'untyped', 'untyped']);
  });

  it("Round Ears replaces Keen Senses (Half-Elf): its imported +2 Perception goes dormant while the alternate's Disguise bonus is a Situation", () => {
    // Round Ears replaces Keen Senses (Half-Elf): its imported +2 Perception
    // goes dormant while the alternate's Disguise bonus is a Situation.
    const ears = entry('Round Ears');
    const keen = importedEntry(entries, 'pf1-content/1HOWCThotIz5ztx0');
    expect(keen.name).toBe('Keen Senses (Half-Elf)');
    expect(ears.detail.replaces).toContain('pf1-content/1HOWCThotIz5ztx0');
    const halfElf = 'pf1/cCepRrfH5SalFfT4';
    expect(ears.detail.raceKeys?.[0]).toBe(halfElf);
    const plain = identityRace(racialTraitSheet({}), halfElf, [
      keen.externalKey,
    ]);
    const round = identityRace(
      racialTraitSheet({ traits: [ears.externalKey] }),
      halfElf,
      [keen.externalKey],
    );
    expect(total(plain, 'skill.per')).toBe(2);
    expect(total(round, 'skill.per')).toBe(0);
    expect(total(round, 'skill.dis')).toBe(0);
  });

  it('spell DC and other schools are unaffected by the caster level Situations', () => {
    // Spell DC and other schools are unaffected by the caster level Situations.
    for (const name of [
      'Serpent Affinity',
      "Creator's Legacy",
      'Stoneseer (Svirfneblin)',
      'Object of Desire',
    ])
      expect(resolved(name, 'spellDC', [0]), name).toBe(0);
  });

  it('no armor, shield or natural armor bonus sits on ac.other', () => {
    // No armor, shield or natural armor bonus sits on ac.other.
    for (const row of batchEntries)
      for (const modifier of row.modifiers)
        if (['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType))
          expect(modifier.target, row.name).not.toBe('ac.other');
  });

  // Rule fields of the batch review's named entries in
  // racial-traits-389.test.ts:337,
  // a proof block whose record checks stay with the unit (fix r2).
  it("keeps the named traits' Notes on their statistics or at entry level, their reviewed Modifiers, no feat slot for the bonus-feat traits, the weapon proficiencies the batch maps and no concentration Modifier or Note in the batch (racial-traits-389.test.ts:337)", () => {
    expect(batchEntries).toHaveLength(70);
    for (const row of batchEntries) {
      expect(
        row.modifiers.some((modifier) => modifier.target === 'concentration'),
        row.name,
      ).toBe(false);
      expect(
        (row.situationalNotes ?? []).some(
          (note) => note.target === 'concentration',
        ),
        row.name,
      ).toBe(false);
    }
    for (const name of [
      'Dragon-Scaled',
      'Energy Resistance (Undine)',
      'Stoic',
      'Take to the Water',
    ])
      expect(
        entry(name)
          .situationalNotes?.filter((note) => note.target)
          .map((note) => note.target),
        name,
      ).toEqual([]);
    for (const [name, targets] of [
      ['Emissary', ['skill.blf', 'skill.dip']],
      ['Silent Hunter', ['skill.ste']],
      ['Tenacious', ['save.fort', 'save.will']],
      ['Viscous Blood', ['skill.hea']],
      ['Shadowhunter (Elf)', ['attack']],
      ['Sound Mimicry', ['skill.blf']],
    ] as const)
      expect(
        entry(name)
          .situationalNotes?.filter((note) => note.target)
          .map((note) => note.target)
          .sort(),
        name,
      ).toEqual(targets);
    for (const name of [
      "Shaman's Apprentice",
      'Human-Raised (Elf)',
      'Primitive Feat',
      'Adoptive Parentage (Weapon Focus)',
    ]) {
      expect(entry(name).modifiers, name).toEqual([]);
      expect(entry(name)).not.toHaveProperty('grantsSlots');
    }
    for (const [name, grants] of [
      ['Lashvine', ['Whip', 'Scorpion Whip']],
      ['Drow-Trained', ['Hand Crossbow', 'Rapier', 'Shortsword']],
    ] as const)
      expect(
        (entry(name).proficiencies ?? []).map((row) =>
          'baseType' in row ? row.baseType : null,
        ),
        name,
      ).toEqual(expect.arrayContaining([...grants]));
  });

  // The replacement fields in
  // racial-traits-389.test.ts:631, proof blocks whose record checks stay
  // with the unit (fix r2).
  it("reads the batch's unresolved replacement names and the named traits' replaced traits (racial-traits-389.test.ts:631)", () => {
    // The batch's list: each trait that keeps a replacement name unresolved,
    // with those names; every other trait resolves all of its replacements.
    expect(batchEntries).toHaveLength(70);
    const unresolved = Object.fromEntries(
      batchEntries
        .filter((row) => row.detail.unresolvedReplacements?.length)
        .map((row) => [row.externalKey, row.detail.unresolvedReplacements]),
    );
    expect(unresolved).toEqual({
      // Racial subtypes keep their race's ability score trait.
      [FERAL_HALF_ORC]: ['Base Statistics'],
      'pf1-content/8lSKScxOqbUF5X1H': ['Base Statistics'], // Drow-Descended
      'pf1-content/9CFWFY7SgYQcanu3': ['Base Statistics'], // Nomadic
      // Green Widow (the green hag changeling trait) has no pf1-content record.
      'pf1-content/901VteaGCjg0FTKQ': ['Green Widow'], // Object of Desire
    });
    expect(entry('Adoptive Parentage (Weapon Focus)').detail.replaces).toEqual(
      [],
    );
  });
});

describe('the racial-traits-390 keys', () => {
  const {
    batchEntries,
    entry,
    modifiers,
    indexOf,
    resolved,
    racialTraitSheet,
    identityRace,
    total,
  } = racialTraitBatch(entries, 'racial-traits-390');
  it("the two heritages curated with their ability lines replace their race's ability score trait: it goes dormant, and their own adjustments count", () => {
    // The two heritages curated with their ability lines replace their race's
    // ability score trait: it goes dormant, and their own adjustments count.
    for (const [name, race, raceKey, before, after] of [
      [
        'Oni-Spawn (Hungerseed)',
        'Tiefling',
        'pf1/nVjKDLZSRONzYm8f',
        { 'ability.dex': 12, 'ability.int': 12, 'ability.cha': 8 },
        {
          'ability.str': 12,
          'ability.wis': 12,
          'ability.cha': 8,
          'ability.dex': 10,
          'ability.int': 10,
        },
      ],
      [
        'Smokesoul (Fume Sylph)',
        'Sylph',
        'pf1/pbX1xj9Z0ZhUfKvZ',
        { 'ability.dex': 12, 'ability.int': 12, 'ability.con': 8 },
        {
          'ability.dex': 12,
          'ability.cha': 12,
          'ability.con': 8,
          'ability.int': 10,
        },
      ],
    ] as const) {
      const heritage = entry(name);
      expect(heritage.detail.raceKeys?.[0], name).toBe(raceKey);
      expect(heritage.detail.replaces, name).toEqual([
        `local/race-ability-scores/${raceKey}`,
      ]);
      expect(heritage.detail.unresolvedReplacements, name).toBeUndefined();
      expect(importedEntry(entries, raceKey).name).toBe(race);
      const plain = racialTraitSheet({ race: raceKey });
      const chosen = racialTraitSheet({
        race: raceKey,
        traits: [heritage.externalKey],
      });
      for (const [target, value] of Object.entries(before))
        expect(total(plain, target), `${race} ${target}`).toBe(value);
      for (const [target, value] of Object.entries(after))
        expect(total(chosen, target), `${name} ${target}`).toBe(value);
    }
  });

  it('the other changeling and elf subraces keep "Base Statistics" unmatched and carry no Modifier', () => {
    // The other changeling and elf subraces keep "Base Statistics" unmatched
    // and carry no Modifier.
    for (const name of ['Night-Born (Moon May)', 'Forlorn Elves']) {
      expect(entry(name).modifiers, name).toEqual([]);
      expect(entry(name).detail.unresolvedReplacements, name).toEqual([
        'Base Statistics',
      ]);
    }
  });

  it('situational bonuses apply only when their Situation is selected', () => {
    // Situational bonuses apply only when their Situation is selected.
    for (const [name, target, base, label, value] of [
      ['Lasting Grudge', 'attack.melee', 'attack', '1 day ago', 1],
      ['Driven Worker', 'skill.crf', 'skill.crf', 'Craft skill', 4],
      ['Driven Worker', 'skill.prf', 'skill.prf', 'Perform skill', 4],
      ['Driven Worker', 'skill.pro', 'skill.pro', 'Profession skill', 4],
      [
        'Magic Resistant',
        'concentration',
        'concentration',
        'arcane spells',
        -2,
      ],
      ['Evasive Maneuvers', 'ac.other', 'ac', 'siege weapons', 2],
      ['Evasive Maneuvers', 'save.ref', 'save.ref', 'siege weapons', 2],
      ['Industrious Urbanite', 'skill.pro', 'skill.pro', 'earn money', 4],
      ['Nature Affinity', 'save.fort', 'save.fort', 'forest-related', 2],
      ['Shadow Foe', 'attack.melee', 'attack', 'Shadow Plane', 1],
      ['Shadow Foe', 'ac.other', 'ac', 'Shadow Plane', 1],
      ['Reflexive Improvisation', 'skill.acr', 'skills', 'untrained', 2],
      ['Dimdweller (Half-Orc)', 'skill.int', 'skill.int', 'dim light', 2],
      ['Dimdweller (Half-Orc)', 'skill.per', 'skill.per', 'dim light', 2],
      ['Dimdweller (Half-Orc)', 'skill.ste', 'skill.ste', 'dim light', 2],
      ['Shadow Dodger', 'ac.other', 'ac', 'incorporeal', 4],
      ['Shoulder to Shoulder', 'ac.other', 'ac', 'share your space', 1],
      ['Shoulder to Shoulder', 'attack.ranged', 'attack', 'aid another', 1],
      ['Shoulder to Shoulder', 'skill.dip', 'skills', 'aid another', 1],
      ['Swamp Leshy', 'skill.ste', 'skill.ste', 'swamps', 4],
      ['Hatred (Svirfneblin)', 'attack.melee', 'attack', 'reptilian', 1],
      ['Hatred (Svirfneblin)', 'attack.melee', 'attack', 'dwarf', 1],
      ['Rodent Empathy', 'skill.han', 'skill.han', 'rodents', 4],
    ] as const) {
      const index = indexOf(name, base, label);
      expect(resolved(name, target), `${name} ${target}`).toBe(0);
      expect(resolved(name, target, [index]), `${name} ${target}`).toBe(value);
    }
  });

  it('one Situation covers each multi-statistic rule', () => {
    // One Situation covers each multi-statistic rule.
    for (const [name, count] of [
      ['Dimdweller (Half-Orc)', 3],
      ['Evasive Maneuvers', 2],
      ['Shadow Foe', 2],
      ['Nature Affinity', 1],
      ['Shadow Dodger', 1],
    ] as const) {
      expect(modifiers(name), name).toHaveLength(count);
      expect(
        new Set(
          modifiers(name).map((row) =>
            JSON.stringify(row.condition?.situation),
          ),
        ).size,
        name,
      ).toBe(1);
    }
  });

  it("shared Situations only where the body's condition matches exactly; the race's re-homed Hardy bonuses are the shared poison, spells and spell-like Situations, each +2 and not stacking within the entry", () => {
    // Shared Situations only where the body's condition matches exactly; the
    // race's re-homed Hardy bonuses are the shared poison, spells and
    // spell-like Situations, each +2 and not stacking within the entry.
    for (const [name, shared, target, value] of [
      ['Unstoppable Magic', 'spellResistance', 'casterLevel', 2],
      ['Dirty Trickster', 'dirtyTrick', 'cmb', 2],
      ['Hardy', 'poison', 'save.fort', 2],
      ['Hardy', 'spells', 'save.will', 2],
      ['Hardy', 'spellLike', 'save.ref', 2],
    ] as const) {
      const index = modifiers(name).findIndex(
        (row) => row.condition?.situation === shared,
      );
      expect(index, `${name} ${shared}`).toBeGreaterThanOrEqual(0);
      expect(resolved(name, target), name).toBe(0);
      expect(resolved(name, target, [index]), name).toBe(value);
      const all = modifiers(name).map((_, index) => index);
      expect(resolved(name, target, all), name).toBe(value);
    }
  });

  it('imported changes keep mapping; nothing is curated a second time', () => {
    // Imported changes keep mapping; nothing is curated a second time.
    for (const [name, target, value] of [
      ['Jester', 'skill.dip', 2],
      ['Jester', 'skill.prf', 2],
      ['Sacred Tattoo', 'save.fort', 1],
      ['Sacred Tattoo', 'save.will', 1],
      ['Transitional Lore', 'skill.kna', 1],
      ['Transitional Lore', 'skill.sur', 1],
      ['Keen Senses (Drow)', 'skill.per', 2],
      ['Whispering Wind', 'skill.ste', 4],
      ['Outrider', 'skill.han', 2],
      ['Outrider', 'skill.rid', 2],
      ['Dual Minded', 'save.will', 2],
      ['Swamp Leshy', 'skill.swm', 2],
      ['Alternate Skill Modifiers (Skinwalker - Witchwolf)', 'skill.per', 2],
      ['+2 Natural Armor', 'ac.natural', 2],
    ] as const)
      expect(resolved(name, target), `${name} ${target}`).toBe(value);
    expect(
      modifiers('+2 Natural Armor').map((row) => [row.target, row.bonusType]),
    ).toEqual([['ac.natural', 'naturalArmor']]);
    expect(entry('+2 to One Ability Score (Human)').modifiers).toEqual([
      { target: 'ability.$choice', bonusType: 'racial', value: 2 },
    ]);
  });

  it("the Brine May ability record replaces the changeling's own ability trait by name: it goes dormant and the untyped line counts", () => {
    // The Brine May ability record replaces the changeling's own ability trait
    // by name: it goes dormant and the untyped line counts.
    const brine = entry('Ability Modifiers (Changeling - Brine May)');
    const changelingAbilities = 'pf1-content/PxjUu8YOjXmWdagL';
    expect(brine.detail.replaces).toEqual([changelingAbilities]);
    const changeling = 'pf1/9FBT6uqlRgaw9gug';
    expect(brine.detail.raceKeys?.[0]).toBe(changeling);
    const scores = (traits: string[]) => {
      const sheet = identityRace(racialTraitSheet({ traits }), changeling, [
        changelingAbilities,
      ]);
      return Object.fromEntries(
        (['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((ability) => [
          ability,
          total(sheet, `ability.${ability}`),
        ]),
      );
    };
    expect(scores([])).toEqual({
      str: 10,
      dex: 10,
      con: 8,
      int: 10,
      wis: 12,
      cha: 12,
    });
    expect(scores([brine.externalKey])).toEqual({
      str: 10,
      dex: 12,
      con: 8,
      int: 10,
      wis: 12,
      cha: 10,
    });
    expect(brine.modifiers.map((row) => row.bonusType)).toEqual([
      'untyped',
      'untyped',
      'untyped',
    ]);
  });

  it('Sure Step replaces Keen Senses (Drow): its imported +2 Perception goes dormant', () => {
    // Sure Step replaces Keen Senses (Drow): its imported +2 Perception goes
    // dormant.
    const step = entry('Sure Step (Drow)');
    const keen = entry('Keen Senses (Drow)');
    expect(step.detail.replaces).toEqual([keen.externalKey]);
    const drow = 'pf1/yLaDS5HGbwtgpkbP';
    expect(step.detail.raceKeys?.[0]).toBe(drow);
    const plain = identityRace(racialTraitSheet({}), drow, [keen.externalKey]);
    const stepped = identityRace(
      racialTraitSheet({ traits: [step.externalKey] }),
      drow,
      [keen.externalKey],
    );
    expect(total(plain, 'skill.per')).toBe(2);
    expect(total(stepped, 'skill.per')).toBe(0);
  });

  it("Pyrophile's fire spell damage stays a Note: no spell DC Modifier", () => {
    // Pyrophile's fire spell damage stays a Note: no spell DC Modifier.
    expect(entry('Pyrophile').modifiers).toEqual([]);
  });

  it('no armor, shield or natural armor bonus sits on ac.other', () => {
    // No armor, shield or natural armor bonus sits on ac.other.
    for (const row of batchEntries)
      for (const modifier of row.modifiers)
        if (['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType))
          expect(modifier.target, row.name).not.toBe('ac.other');
  });

  // Rule fields of the batch review's named entries in
  // racial-traits-390.test.ts:376,
  // a proof block whose record checks stay with the unit (fix r2).
  it("keeps the named traits' Notes on their statistics or at entry level, their reviewed Modifiers, no feat slot for the bonus-feat traits and the weapon proficiencies the batch maps (racial-traits-390.test.ts:376)", () => {
    for (const name of [
      'Energy Strike (Fire)',
      'Fiendish Resistance',
      'Magic Resistant',
      'Mouthless',
      'Pyrophile',
      'Rock Stepper',
      'Sure Step (Drow)',
      'Swamp Stride',
    ])
      expect(
        entry(name)
          .situationalNotes?.filter((note) => note.target)
          .map((note) => note.target),
        name,
      ).toEqual([]);
    for (const [name, targets] of [
      ['Light Sensitivity (Kuru)', ['attack', 'skill.per']],
      ['Keen Scent (Adaro)', ['skill.per']],
      ['Secret Strider', ['skill.sur']],
      ['Industrious Urbanite', ['skill.crf']],
      ['Evasive Maneuvers', ['skill.fly']],
      ['Grabbing Appendages', ['cmb']],
      ['Hag Racial Trait (Changeling - Veil May)', ['skill.blf']],
      ['Alternate Skill Modifiers (Skinwalker - Witchwolf)', ['skill.dip']],
    ] as const)
      expect(
        entry(name)
          .situationalNotes?.filter((note) => note.target)
          .map((note) => note.target)
          .sort(),
        name,
      ).toEqual(targets);
    expect(
      modifiers('Alternate Skill Modifiers (Skinwalker - Witchwolf)').map(
        (row) => row.target,
      ),
    ).toEqual(['skill.per']);
    expect(
      (entry('Chain Fighter').proficiencies ?? []).map((row) =>
        'baseType' in row ? row.baseType : null,
      ),
    ).toEqual(expect.arrayContaining(['Light Flail', 'Heavy Flail']));
    for (const name of ['Starchild', 'Grabbing Appendages']) {
      expect(entry(name).modifiers, name).toEqual([]);
      expect(entry(name)).not.toHaveProperty('grantsSlots');
    }
  });

  // The replacement fields in
  // racial-traits-390.test.ts:686, proof blocks whose record checks stay
  // with the unit (fix r2).
  it("reads the batch's unresolved replacement names and the named traits' replaced traits (racial-traits-390.test.ts:686)", () => {
    // The batch's list: each trait that keeps a replacement name unresolved,
    // with those names; every other trait resolves all of its replacements.
    expect(batchEntries).toHaveLength(74);
    const unresolved = Object.fromEntries(
      batchEntries
        .filter((row) => row.detail.unresolvedReplacements?.length)
        .map((row) => [row.externalKey, row.detail.unresolvedReplacements]),
    );
    expect(unresolved).toEqual({
      // No header and no parent trait of the same name (importer gap).
      'pf1-content/AQYBioB3D1EbhppG': ['Magma Affinity (Ifrit - Lavasoul)'],
      // The changeling's trait is named "Hag Racial Trait (Changeling)".
      'pf1-content/BD8FBL0PfVe5qfrt': ['Hag Trait'], // Pyrophile
      // Racial subtypes keep their race's ability score trait.
      'pf1-content/BE3QYzPCTLBEaGzv': ['Base Statistics'], // Forlorn Elves
      'pf1-content/BNpMu00YoQaJyRUt': ['Base Statistics'], // Night-Born (Moon May)
    });
    expect(entry('Swamp Leshy').detail.replaces).toHaveLength(2);
  });
});

describe('the racial-traits-391 keys', () => {
  const {
    batchEntries,
    entry,
    modifiers,
    indexOf,
    resolved,
    racialTraitSheet,
    identityRace,
    total,
  } = racialTraitBatch(entries, 'racial-traits-391');
  it('situational bonuses apply only when their Situation is selected', () => {
    // Situational bonuses apply only when their Situation is selected.
    for (const [name, target, base, label, value] of [
      ['Heart of the Sun', 'save.fort', 'save.fort', 'hot climate', 2],
      ['Heart of the Sun', 'save.fort', 'save.fort', 'swarms and vermin', 2],
      ['Institutional Memory', 'skill.khi', 'skill.khi', 'organizations', 4],
      ['Institutional Memory', 'skill.kre', 'skill.kre', 'organizations', 4],
      ['In the Shadows', 'skill.apr', 'skill.apr', 'Appraise', 2],
      ['In the Shadows', 'skill.crf', 'skill.crf', 'Craft', 2],
      ['In the Shadows', 'skill.slt', 'skill.slt', 'Sleight of Hand', 2],
      ['Behind the Veil (Gnome)', 'skill.blf', 'skill.blf', 'concealment', 2],
      ['Behind the Veil (Gnome)', 'skill.slt', 'skill.slt', 'concealment', 2],
      ['Insidious Telepathy', 'skill.dip', 'skill.dip', 'telepathically', 1],
      ['Insidious Telepathy', 'skill.umd', 'skill.umd', 'telepathically', 1],
      ['Shadowplay (Gnome)', 'casterLevel', 'casterLevel', 'shadow', 1],
      ['Heart of the Streets', 'ac.other', 'ac', 'two other allies', 1],
      ['Blightborn', 'save.will', 'saves', 'necromancy', 2],
      ['Blightborn', 'save.fort', 'saves', 'negative levels', 2],
      ['Deft Swords', 'cmd', 'cmd', 'swordlike', 2],
      ['Comprehensive Education', 'skill.kar', 'skill.kar', 'arcana', 1],
      ['Comprehensive Education', 'skill.kpl', 'skill.kpl', 'planes', 1],
      ['Slimehunter', 'save.ref', 'saves', 'aboleth', 2],
      ['Scent (Ratfolk)', 'skill.per', 'skill.per', 'sight or hearing', -2],
      [
        'Heart of the Mountains',
        'skill.acr',
        'skill.acr',
        'narrow surfaces',
        2,
      ],
      ['Blood Enmity', 'attack.melee', 'attack', 'dwarf or elf', 1],
      ['Fey Magic (Gnome - HftF)', 'spellDC', 'spellDC', 'compulsion', 1],
      ['Cautious Brawler', 'damage.melee', 'damage', 'nonlethal', 1],
      ['Water Bond', 'ac.other', 'ac', 'bonded body', 1],
      ['Water Bond', 'save.will', 'saves', 'bonded body', 1],
      ['Hatred (Gnome)', 'attack.melee', 'attack', 'reptilian', 1],
      ['Hatred (Gnome)', 'attack.melee', 'attack', 'goblinoid', 1],
      ['Sensitive Breath', 'save.fort', 'saves', 'disease', -2],
      ['Sensitive Breath', 'save.fort', 'saves', 'inhaled poisons', -2],
    ] as const) {
      const index = indexOf(name, base, label);
      expect(resolved(name, target), `${name} ${target}`).toBe(0);
      expect(resolved(name, target, [index]), `${name} ${target}`).toBe(value);
    }
  });

  it('one Situation covers each multi-statistic rule', () => {
    // One Situation covers each multi-statistic rule.
    for (const [name, count] of [
      ['Institutional Memory', 10],
      ['Insidious Telepathy', 7],
      ['Behind the Veil (Gnome)', 2],
      ['Water Bond', 2],
    ] as const) {
      expect(modifiers(name), name).toHaveLength(count);
      expect(
        new Set(
          modifiers(name).map((row) =>
            JSON.stringify(row.condition?.situation),
          ),
        ).size,
        name,
      ).toBe(1);
    }
  });

  it('each choice or class-skill Situation is its own: one per skill', () => {
    // Each choice or class-skill Situation is its own: one per skill.
    for (const [name, count] of [
      ['In the Shadows', 5],
      ['Comprehensive Education', 10],
    ] as const)
      expect(
        new Set(
          modifiers(name).map((row) =>
            JSON.stringify(row.condition?.situation),
          ),
        ).size,
        name,
      ).toBe(count);
  });

  it("two racial Situations on one entry don't stack: both selected give +2", () => {
    // Two racial Situations on one entry don't stack: both selected give +2.
    for (const [name, target] of [
      ['Heart of the Sun', 'save.fort'],
      ['Blightborn', 'save.will'],
    ] as const)
      expect(resolved(name, target, [0, 1]), name).toBe(2);
  });

  it("shared Situations only where the body's condition matches exactly", () => {
    // Shared Situations only where the body's condition matches exactly.
    const death = modifiers('Immortal Spark').findIndex(
      (row) => row.condition?.situation === 'death',
    );
    expect(death).toBeGreaterThanOrEqual(0);
    expect(resolved('Immortal Spark', 'save.will')).toBe(0);
    expect(resolved('Immortal Spark', 'save.will', [death])).toBe(2);
  });

  it("Blightborn's necromancy and curse bonus is not the shared spells Situation, which would cover every spell", () => {
    // Blightborn's necromancy and curse bonus is not the shared spells
    // Situation, which would cover every spell.
    expect(
      modifiers('Blightborn').some(
        (row) => row.condition?.situation === 'spells',
      ),
    ).toBe(false);
  });

  it('imported changes keep mapping; nothing is curated a second time', () => {
    // Imported changes keep mapping; nothing is curated a second time.
    for (const [name, target, value] of [
      ['Natural Armor (Adaro)', 'ac.natural', 2],
      ['Natural Armor (Locathah)', 'ac.natural', 2],
      ['Defensive Training (Svirfneblin)', 'ac.other', 2],
      ['Heart of the Streets', 'save.ref', 1],
      ['Heart of the Mountains', 'skill.clm', 2],
      ['Fosterling', 'skill.dip', 2],
      ['Fosterling', 'skill.han', 2],
      ['Garrulous', 'skill.dip', 2],
      ['Garrulous', 'skill.lin', 2],
      ['Wildfire Heart', 'init', 4],
      ['Skilled (Tiefling - Faultspawn)', 'skill.apr', 2],
      ['Skilled (Tiefling - Faultspawn)', 'skill.klo', 2],
      ['Immortal Spark', 'skill.khi', 2],
      ['Prehensile Tail (Kobold)', 'skill.acr', 2],
      ['Prehensile Tail (Kobold)', 'skill.clm', 2],
      ['Fey Wisdom', 'skill.dip', 1],
      ['Fey Wisdom', 'skill.kna', 1],
      ['Surreptitious', 'skill.dis', 2],
      ['Surreptitious', 'skill.ste', 2],
    ] as const)
      expect(resolved(name, target), `${name} ${target}`).toBe(value);
    for (const name of ['Natural Armor (Adaro)', 'Natural Armor (Locathah)'])
      expect(
        modifiers(name).map((row) => [row.target, row.bonusType]),
        name,
      ).toEqual([['ac.natural', 'naturalArmor']]);
  });

  it("Dragon Magic's raw +2 racial Perception, which the body does not grant, imports as 0 through its reviewed change replacement", () => {
    // Dragon Magic's raw +2 racial Perception, which the body does not grant,
    // imports as 0 through its reviewed change replacement.
    expect(entry('Dragon Magic').modifiers).toEqual([
      { target: 'skill.per', bonusType: 'racial', value: 0 },
    ]);
    expect(resolved('Dragon Magic', 'skill.per')).toBe(0);
  });

  it("Faultspawn replaces the tiefling's Skilled (#389) by name: its +2 Bluff and Stealth go dormant and the heritage's Appraise and Knowledge (local) count", () => {
    // Faultspawn replaces the tiefling's Skilled (#389) by name: its +2 Bluff
    // and Stealth go dormant and the heritage's Appraise and Knowledge (local)
    // count.
    const faultspawn = entry('Skilled (Tiefling - Faultspawn)');
    const skilled = 'pf1-content/AKuDJrwJUZULsJcS';
    expect(faultspawn.detail.replaces).toEqual([skilled]);
    const tiefling = 'pf1/nVjKDLZSRONzYm8f';
    expect(faultspawn.detail.raceKeys?.[0]).toBe(tiefling);
    const plain = identityRace(racialTraitSheet({}), tiefling, [skilled]);
    const spawn = identityRace(
      racialTraitSheet({ traits: [faultspawn.externalKey] }),
      tiefling,
      [skilled],
    );
    expect(total(plain, 'skill.blf')).toBe(2);
    expect(total(plain, 'skill.apr')).toBe(0);
    expect(total(spawn, 'skill.blf')).toBe(0);
    expect(total(spawn, 'skill.ste')).toBe(0);
    expect(total(spawn, 'skill.apr')).toBe(2);
    expect(total(spawn, 'skill.klo')).toBe(2);
  });

  it('Fey Wisdom replaces Keen Senses (Elf): its +2 Perception goes dormant', () => {
    // Fey Wisdom replaces Keen Senses (Elf): its +2 Perception goes dormant.
    const wisdom = entry('Fey Wisdom');
    const keen = 'pf1-content/WOF6A7695wxFO2ie';
    expect(wisdom.detail.replaces).toEqual([keen]);
    const elf = 'pf1/NgIhxRI0axrf3fcO';
    expect(wisdom.detail.raceKeys?.[0]).toBe(elf);
    const elfPlain = identityRace(racialTraitSheet({}), elf, [keen]);
    const wise = identityRace(
      racialTraitSheet({ traits: [wisdom.externalKey] }),
      elf,
      [keen],
    );
    expect(total(elfPlain, 'skill.per')).toBe(2);
    expect(total(wise, 'skill.per')).toBe(0);
    expect(total(wise, 'skill.dip')).toBe(1);
  });

  it("racial bonuses from distinct Sources stack (PRD §8): Fosterling's and Garrulous' +2 racial Diplomacy add up to +4", () => {
    // Racial bonuses from distinct Sources stack (PRD §8): Fosterling's and
    // Garrulous' +2 racial Diplomacy add up to +4.
    expect(
      resolveSheet([...modifiers('Fosterling'), ...modifiers('Garrulous')], {
        situations: [],
      })['skill.dip'].total,
    ).toBe(4);
  });

  it('no armor, shield or natural armor bonus sits on ac.other', () => {
    // No armor, shield or natural armor bonus sits on ac.other.
    for (const row of batchEntries)
      for (const modifier of row.modifiers)
        if (['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType))
          expect(modifier.target, row.name).not.toBe('ac.other');
  });

  // Rule fields of the batch review's named entries in
  // racial-traits-391.test.ts:355,
  // a proof block whose record checks stay with the unit (fix r2).
  it("keeps the named traits' Notes on their statistics or at entry level, their reviewed Modifiers and the weapon proficiencies the batch maps (racial-traits-391.test.ts:355)", () => {
    expect(entry('Change Shape (Reptoid)').modifiers).toEqual([]);
    expect(
      entry('Hag Racial Trait (Changeling - Crawling Skin)').modifiers,
    ).toEqual([]);
    for (const name of [
      'Sticky Tendrils',
      'Heart of the Streets',
      'Insidious Telepathy',
      'Poison Use (Vishkanya)',
      'Poison Minion (Elf)',
      'Heart of the Mountains',
    ])
      expect(
        entry(name)
          .situationalNotes?.filter((note) => note.target)
          .map((note) => note.target),
        name,
      ).toEqual([]);
    for (const [name, targets] of [
      ['Heart of the Sun', ['save.fort']],
      ['Gliding Wings (Kobold)', ['skill.fly']],
      ['Glide', ['skill.fly']],
      ['Garrulous', ['skill.lin']],
      ['Cautious Brawler', ['attack']],
      ['Hag Racial Trait (Changeling - Crawling Skin)', ['skill.dis']],
      ['Change Shape (Reptoid)', []],
    ] as const)
      expect(
        entry(name)
          .situationalNotes?.filter((note) => note.target)
          .map((note) => note.target)
          .sort(),
        name,
      ).toEqual(targets);
    expect(
      modifiers('Cautious Brawler').map((row) => [row.target, row.value]),
    ).toEqual([['damage', 1]]);
    expect(
      (entry('Weapon Familiarity (Elf)').proficiencies ?? []).map((row) =>
        'baseType' in row ? row.baseType : null,
      ),
    ).toEqual(['Longbow', 'Longsword', 'Rapier', 'Shortbow']);
  });

  // The replacement fields in
  // racial-traits-391.test.ts:680 and :543, proof blocks whose record checks stay
  // with the unit (fix r2).
  it("reads the batch's unresolved replacement names, the named traits' replaced traits and the race placement it names (racial-traits-391.test.ts:680)", () => {
    // The batch's list: each trait that keeps a replacement name unresolved,
    // with those names; every other trait resolves all of its replacements.
    expect(batchEntries).toHaveLength(75);
    const unresolved = Object.fromEntries(
      batchEntries
        .filter((row) => row.detail.unresolvedReplacements?.length)
        .map((row) => [row.externalKey, row.detail.unresolvedReplacements]),
    );
    expect(unresolved).toEqual({
      // The gathlain's fly speed trait has another name (importer gap).
      'pf1-content/DuFNFt2YIoJ9KYif': ['Racial Fly Speed'], // Sticky Tendrils
      // The duergar's spell-like ability trait has another name.
      'pf1-content/GL7VJG5KSRQDF4GS': ['Invisibility Spell-Like Ability'], // Blood Enmity
      // No header and no parent trait of the same name (importer gap).
      'pf1-content/Fzzd5GnZy7J7wU8j': ['Ice Affinity (Undine - Rimesoul)'],
    });
    expect(entry('Daylight Adaptation').detail.replaces).toHaveLength(1);
    expect(
      entry('Hag Racial Trait (Changeling - Crawling Skin)').detail,
    ).toMatchObject({ standard: true, raceKeys: ['pf1/9FBT6uqlRgaw9gug'] });
    // Its folder binds no race record.
    expect(entry('Insidious Telepathy').detail.raceKeys).toEqual([]);
  });
});

describe('the racial-traits-392 keys', () => {
  const {
    batchEntries,
    entry,
    modifiers,
    indexOf,
    resolved,
    racialTraitSheet,
    identityRace,
    total,
  } = racialTraitBatch(entries, 'racial-traits-392');
  it("the three heritages curated with their ability lines replace their race's ability score trait: it goes dormant, and their own adjustments count", () => {
    // The three heritages curated with their ability lines replace their
    // race's ability score trait: it goes dormant, and their own adjustments
    // count.
    for (const [name, race, raceKey, before, after] of [
      [
        'Ironsoul (Metal Oread)',
        'Oread',
        'pf1/4qEXPDlfIj1cIvCe',
        { 'ability.str': 12, 'ability.wis': 12, 'ability.cha': 8 },
        {
          'ability.con': 12,
          'ability.wis': 12,
          'ability.dex': 8,
          'ability.str': 10,
          'ability.cha': 10,
        },
      ],
      [
        'Rakshasa-Spawn (Beastbrood)',
        'Tiefling',
        'pf1/nVjKDLZSRONzYm8f',
        { 'ability.dex': 12, 'ability.int': 12, 'ability.cha': 8 },
        {
          'ability.dex': 12,
          'ability.cha': 12,
          'ability.wis': 8,
          'ability.int': 10,
        },
      ],
      [
        'Peri-Blooded (Emberkin)',
        'Aasimar',
        'pf1/FHY3oIk5zSOFncJH',
        { 'ability.wis': 12, 'ability.cha': 12 },
        { 'ability.int': 12, 'ability.cha': 12, 'ability.wis': 10 },
      ],
    ] as const) {
      const heritage = entry(name);
      expect(heritage.detail.raceKeys?.[0], name).toBe(raceKey);
      expect(heritage.detail.replaces, name).toEqual([
        `local/race-ability-scores/${raceKey}`,
      ]);
      expect(heritage.detail.unresolvedReplacements, name).toBeUndefined();
      expect(importedEntry(entries, raceKey).name).toBe(race);
      const plain = racialTraitSheet({ race: raceKey });
      const chosen = racialTraitSheet({
        race: raceKey,
        traits: [heritage.externalKey],
      });
      for (const [target, value] of Object.entries(before))
        expect(total(plain, target), `${race} ${target}`).toBe(value);
      for (const [target, value] of Object.entries(after))
        expect(total(chosen, target), `${name} ${target}`).toBe(value);
    }
  });

  it('the racial subtype and the flavor heritage carry no Modifier', () => {
    // The racial subtype and the flavor heritage carry no Modifier.
    for (const name of ['Elf-Raised', 'Mountain Half-Orcs (Cragkin)'])
      expect(entry(name).modifiers, name).toEqual([]);
    expect(entry('Elf-Raised').detail.unresolvedReplacements).toEqual([
      'Base Statistics',
    ]);
  });

  it('situational bonuses apply only when their Situation is selected', () => {
    // Situational bonuses apply only when their Situation is selected.
    for (const [name, target, base, label, value] of [
      ['Craftsman', 'skill.crf', 'skill.crf', 'metal or stone', 2],
      ['Craftsman', 'skill.pro', 'skill.pro', 'metal or stone', 2],
      ['Relentless', 'cmb', 'cmb', 'bull rush', 2],
      ['Relentless', 'cmb', 'cmb', 'overrun', 2],
      ['Ingratiating', 'skill.prf', 'skill.prf', 'chosen Perform', 2],
      ['Industrious', 'skill.crf', 'skill.crf', 'Craft skill', 2],
      ['Industrious', 'skill.pro', 'skill.pro', 'Profession skill', 2],
      ['Seasinger', 'skill.prf', 'skill.prf', 'Perform (sing)', 2],
      ['Seasinger', 'spellDC', 'spellDC', 'language-dependent', 1],
      ['Tribalistic', 'attack.melee', 'attack', 'aid another', 2],
      ['Tribalistic', 'skill.acr', 'skills', 'aid another', 2],
      ['Breeze-Kissed (Sylph)', 'ac.other', 'ac', 'nonmagical ranged', 2],
      ['Dragon Scholar', 'casterLevel', 'casterLevel', 'spell resistance', 2],
      ['Dragon Scholar', 'skill.kar', 'skill.kar', 'dragon type', 3],
      ['Shadowplay', 'casterLevel', 'casterLevel', 'shadow descriptor', 1],
      [
        'Alternate Skill Modifiers (Skinwalker - Nightskulk)',
        'skill.ste',
        'skill.ste',
        'urban',
        2,
      ],
      [
        'Alternate Weakness (Dhampir - Ancient-Born)',
        'save.fort',
        'saves',
        'physical ability',
        -1,
      ],
      [
        'Change Shape (Skinwalker - Seascarred)',
        'ability.con',
        'ability.con',
        'bestial',
        2,
      ],
      [
        'Change Shape (Skinwalker - Bloodmarked)',
        'ability.dex',
        'ability.dex',
        'bestial form"',
        2,
      ],
      [
        'Change Shape (Skinwalker - Bloodmarked)',
        'skill.per',
        'skill.per',
        'Perception feature',
        4,
      ],
      ['Dragon Soul', 'save.will', 'saves', 'sleep', 2],
      ['Dragon Soul', 'save.will', 'saves', 'paralysis', 2],
      ['Hatred (Dwarf)', 'attack.melee', 'attack', 'orc', 1],
      ['Hatred (Dwarf)', 'attack.melee', 'attack', 'goblinoid', 1],
    ] as const) {
      const index = indexOf(name, base, label);
      expect(resolved(name, target), `${name} ${target}`).toBe(0);
      expect(resolved(name, target, [index]), `${name} ${target}`).toBe(value);
    }
  });

  it('one Situation covers each multi-statistic rule', () => {
    // One Situation covers each multi-statistic rule.
    for (const [name, count] of [
      ['Craftsman', 2],
      ['Tribalistic', 2],
    ] as const) {
      expect(modifiers(name), name).toHaveLength(count);
      expect(
        new Set(
          modifiers(name).map((row) =>
            JSON.stringify(row.condition?.situation),
          ),
        ).size,
        name,
      ).toBe(1);
    }
  });

  it("shared Situations only where the body's condition matches exactly; the race's re-homed bonuses keep theirs", () => {
    // Shared Situations only where the body's condition matches exactly; the
    // race's re-homed bonuses keep theirs. Bonuses of one type on one entry
    // don't stack.
    for (const [name, shared, target, value] of [
      ['Intrepid Settler', 'fear', 'save.will', 2],
      ['Tripping Tentacles', 'trip', 'cmb', 4],
      ['Imposter-Wary', 'illusions', 'save.will', 2],
      ['Bullying', 'disarm', 'cmb', 1],
      ['Bullying', 'steal', 'cmb', 1],
      ['Dragon Soul', 'fear', 'save.fort', 2],
      ['Defensive Training (Gnome)', 'giants', 'ac.other', 4],
      ['Ward against Corruption', 'negativeEnergy', 'save.fort', 2],
      ['Ward against Corruption', 'death', 'save.ref', 2],
    ] as const) {
      const index = modifiers(name).findIndex(
        (row) => row.condition?.situation === shared,
      );
      expect(index, `${name} ${shared}`).toBeGreaterThanOrEqual(0);
      expect(resolved(name, target), name).toBe(0);
      expect(resolved(name, target, [index]), name).toBe(value);
      const all = modifiers(name)
        .map((row, index) => (row.condition?.situation ? index : -1))
        .filter((index) => index >= 0);
      expect(resolved(name, target, all), name).toBe(value);
    }
  });

  it('imported changes keep mapping; nothing is curated a second time', () => {
    // Imported changes keep mapping; nothing is curated a second time.
    for (const [name, target, value] of [
      ['Halfling Luck', 'save.fort', 1],
      ['Halfling Luck', 'save.will', 1],
      ['Intrepid Settler', 'skill.acr', 2],
      ['Intrepid Settler', 'skill.swm', 2],
      ['Wary', 'skill.sen', 1],
      ['Wary', 'skill.blf', 1],
      ['Dayguard', 'skill.per', 2],
      ['Wing-Clipped', 'skill.clm', 2],
      ['Ingratiating', 'skill.crf', 2],
      ['Ingratiating', 'skill.pro', 2],
      ['Skilled (Tiefling - Beastbrood)', 'skill.dis', 2],
      ['Skilled (Tiefling - Pitborn)', 'skill.dev', 2],
      ['Limber', 'skill.esc', 2],
      ['Sneaky (Hobgoblin)', 'skill.ste', 4],
      ['Spirit of the Waters', 'skill.swm', 4],
      ['Student of the City', 'skill.klo', 2],
      ['Burning Assurance (Sandkin)', 'skill.dip', 2],
      ['Alternate Skill Modifiers (Skinwalker - Nightskulk)', 'skill.han', 2],
      ['Industrious', 'concentration', 2],
      ['Natural Armor (Triton)', 'ac.natural', 2],
      ['Natural Armor (Gathlain)', 'ac.natural', 1],
      ['Scaled Skin', 'ac.natural', 1],
    ] as const)
      expect(resolved(name, target), `${name} ${target}`).toBe(value);
  });

  it("Seasinger's untyped +2 on every Perform skill is replaced by 0 (reviewed change replacement); only the Perform (sing) Situation gives +2 racial", () => {
    // Seasinger's untyped +2 on every Perform skill is replaced by 0 (reviewed
    // change replacement); only the Perform (sing) Situation gives +2 racial.
    expect(
      modifiers('Seasinger').map((row) => [
        row.target,
        row.bonusType,
        row.value,
      ]),
    ).toEqual([
      ['skill.prf', 'untyped', 0],
      ['spellDC', 'racial', 1],
      ['skill.prf', 'racial', 2],
    ]);
  });

  it("Svirfneblin Magic's illusion DC is the race's re-homed output", () => {
    // Svirfneblin Magic's illusion DC is the race's re-homed output.
    expect(modifiers('Svirfneblin Magic (Svirfneblin)')).toMatchObject([
      { target: 'spellDC', value: 1, condition: { school: 'illusion' } },
    ]);
  });

  it("the Snow May ability record replaces the changeling's own ability trait by name: it goes dormant and the untyped line counts", () => {
    // The Snow May ability record replaces the changeling's own ability trait
    // by name: it goes dormant and the untyped line counts.
    const snow = entry('Ability Modifiers (Changeling - Snow May)');
    const changelingAbilities = 'pf1-content/PxjUu8YOjXmWdagL';
    expect(snow.detail.replaces).toEqual([changelingAbilities]);
    const changeling = 'pf1/9FBT6uqlRgaw9gug';
    expect(snow.detail.raceKeys?.[0]).toBe(changeling);
    const scores = (traits: string[]) => {
      const sheet = identityRace(racialTraitSheet({ traits }), changeling, [
        changelingAbilities,
      ]);
      return Object.fromEntries(
        (['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((ability) => [
          ability,
          total(sheet, `ability.${ability}`),
        ]),
      );
    };
    expect(scores([])).toEqual({
      str: 10,
      dex: 10,
      con: 8,
      int: 10,
      wis: 12,
      cha: 12,
    });
    expect(scores([snow.externalKey])).toEqual({
      str: 10,
      dex: 10,
      con: 8,
      int: 12,
      wis: 12,
      cha: 10,
    });
  });

  it("the subrace skill records replace the tiefling's Skilled trait by name: its +2 Bluff and Stealth go dormant", () => {
    // The subrace skill records replace the tiefling's Skilled trait by name:
    // its +2 Bluff and Stealth go dormant.
    const tieflingSkilled = 'pf1-content/AKuDJrwJUZULsJcS';
    const beastbrood = entry('Skilled (Tiefling - Beastbrood)');
    expect(beastbrood.detail.replaces).toEqual([tieflingSkilled]);
    const tiefling = 'pf1/nVjKDLZSRONzYm8f';
    expect(beastbrood.detail.raceKeys?.[0]).toBe(tiefling);
    const skills = (traits: string[]) => {
      const sheet = identityRace(racialTraitSheet({ traits }), tiefling, [
        tieflingSkilled,
      ]);
      return ['skill.blf', 'skill.ste', 'skill.dis', 'skill.sen'].map(
        (target) => total(sheet, target),
      );
    };
    expect(skills([])).toEqual([2, 2, 0, 0]);
    expect(skills([beastbrood.externalKey])).toEqual([0, 0, 2, 2]);
  });

  it("racial bonuses from distinct Sources stack: Halfling Luck (+1) and #387's Irrepressible (+2 against dominate and possession) give +3 on such a save", () => {
    // Racial bonuses from distinct Sources stack: Halfling Luck (+1) and #387's
    // Irrepressible (+2 against dominate and possession) give +3 on such a save.
    // Irrepressible is a racial-traits-387 entry, looked up in that list.
    const irrepressible = racialTraitBatch(entries, 'racial-traits-387').entry(
      'Irrepressible',
    );
    expect(irrepressible.externalKey).toBe('pf1-content/1AmHSWuqAMrEBChf');
    const luck = entry('Halfling Luck');
    const dominated = resolveSheet(
      [
        ...modifiers('Halfling Luck'),
        ...racialTraitBatch(entries, 'racial-traits-387').modifiers(
          'Irrepressible',
        ),
      ],
      {
        situations: [
          {
            local: 'against dominate and possession effects',
            sheetEntryId: 'pf1-content/1AmHSWuqAMrEBChf',
          },
        ],
      },
    );
    expect(luck.modifiers).toEqual([
      { target: 'saves', bonusType: 'racial', value: 1 },
    ]);
    expect(dominated['save.will'].total).toBe(3);
  });

  it('no armor, shield or natural armor bonus sits on ac.other', () => {
    // Notes carry the readable rules; no armor, shield or natural armor bonus
    // sits on ac.other.
    for (const row of batchEntries)
      for (const modifier of row.modifiers)
        if (['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType))
          expect(modifier.target, row.name).not.toBe('ac.other');
  });

  // Rule fields of the batch review's named entries in
  // racial-traits-392.test.ts:472,
  // a proof block whose record checks stay with the unit (fix r2).
  it("keeps the named traits' Notes on their statistics or at entry level, their reviewed Modifiers, no feat slot for the bonus-feat traits, one skill rank per level for the Skilled traits and the weapon proficiencies the batch maps (racial-traits-392.test.ts:472)", () => {
    expect(
      entry('Hag Racial Trait (Changeling - Sea Lungs)').modifiers,
    ).toEqual([]);
    for (const name of [
      'Glider',
      'Lightbringer',
      'Scaled Skin',
      'Celestial Resistance',
      'Exalted Resistance',
    ])
      expect(
        entry(name)
          .situationalNotes?.filter((note) => note.target)
          .map((note) => note.target),
        name,
      ).toEqual([]);
    for (const [name, targets] of [
      ['Construct', ['save.fort']],
      ['Fangs', ['attack']],
      ['Telepathic Senses', ['skill.per']],
      ['Student of the City', ['skill.klo']],
      ['Spirit of the Waters', ['skill.swm']],
      ['Desert Delver', ['save.fort']],
    ] as const)
      expect(
        entry(name)
          .situationalNotes?.filter((note) => note.target)
          .map((note) => note.target)
          .sort(),
        name,
      ).toEqual(targets);
    for (const name of ['Skilled (Half-Orc)', 'Imposter-Wary'])
      expect(entry(name).detail.bonusSkillRanksPerLevel, name).toBe(1);
    for (const name of ['Psychic Sensitivity', 'Psychic Attunement']) {
      expect(entry(name).modifiers, name).toEqual([]);
      expect(entry(name)).not.toHaveProperty('grantsSlots');
    }
    const grants = {
      'Weapon Familiarity (Orc)': ['Falchion', 'Greataxe'],
      'Spirit of the Waters': ['Longspear', 'Net', 'Trident'],
      'Weapon Familiarity (Goblin)': ['Dogslicer', 'Horsechopper'],
      'Body Thorns': ['Armor Spikes'],
    } as Record<string, string[]>;
    // Every trait of the batch's list maps the weapon proficiencies of this
    // table, and no other.
    expect(batchEntries).toHaveLength(75);
    for (const row of batchEntries)
      expect(
        (row.proficiencies ?? []).map((grant) =>
          'baseType' in grant ? grant.baseType : null,
        ),
        row.name,
      ).toEqual(grants[row.name] ?? []);
  });

  // The replacement fields in
  // racial-traits-392.test.ts:799 and :665, proof blocks whose record checks stay
  // with the unit (fix r2).
  it("reads the batch's unresolved replacement names, Orc Blood's two counted races and the race placement it names (racial-traits-392.test.ts:799)", () => {
    // The batch's list: each trait that keeps a replacement name unresolved,
    // with those names; every other trait resolves all of its replacements.
    expect(batchEntries).toHaveLength(75);
    const unresolved = Object.fromEntries(
      batchEntries
        .filter((row) => row.detail.unresolvedReplacements?.length)
        .map((row) => [row.externalKey, row.detail.unresolvedReplacements]),
    );
    expect(unresolved).toEqual({
      // The header names traits it alters rather than replaces.
      'pf1-content/HSEQTjNZ9ZPnhZUZ': [
        'alters the change shape and spell-like ability racial traits',
      ],
      // No header and no parent trait of the same name (importer gap).
      'pf1-content/JhEI4m5iFNvOgm9H': [
        'Lightning Affinity (Sylph - Stormsoul)',
      ],
      // The racial subtype keeps its race's ability score trait.
      'pf1-content/JAbeHqFork30yKAt': ['Base Statistics'], // Elf-Raised
    });
    expect(entry('Orc Blood').countsAsRaces).toHaveLength(2);
    // Its folder binds no race record.
    expect(entry('Sexual Dimorphism').detail.raceKeys).toEqual([]);
  });
});

describe('the racial-traits-393 keys', () => {
  const {
    batchEntries,
    entry,
    modifiers,
    indexOf,
    resolved,
    racialTraitSheet,
    identityRace,
    total,
  } = racialTraitBatch(entries, 'racial-traits-393');
  it("Asura-Spawn's curated ability line replaces the tiefling's ability score trait: it goes dormant, and the heritage's own adjustments count", () => {
    // Asura-Spawn's curated ability line replaces the tiefling's ability score
    // trait: it goes dormant, and the heritage's own adjustments count.
    const faultspawn = entry('Asura-Spawn (Faultspawn)');
    const tieflingKey = 'pf1/nVjKDLZSRONzYm8f';
    expect(faultspawn.detail.raceKeys?.[0]).toBe(tieflingKey);
    expect(faultspawn.detail.replaces).toEqual([
      'local/race-ability-scores/pf1/nVjKDLZSRONzYm8f',
    ]);
    expect(faultspawn.detail.unresolvedReplacements).toBeUndefined();
    expect(importedEntry(entries, tieflingKey).name).toBe('Tiefling');
    const plainTiefling = racialTraitSheet({ race: tieflingKey });
    const faultspawnSheet = racialTraitSheet({
      race: tieflingKey,
      traits: [faultspawn.externalKey],
    });
    for (const [target, value] of Object.entries({
      'ability.dex': 12,
      'ability.int': 12,
      'ability.cha': 8,
      'ability.wis': 10,
    }))
      expect(total(plainTiefling, target), `Tiefling ${target}`).toBe(value);
    for (const [target, value] of Object.entries({
      'ability.dex': 12,
      'ability.wis': 12,
      'ability.int': 8,
      'ability.cha': 10,
    }))
      expect(total(faultspawnSheet, target), `Faultspawn ${target}`).toBe(
        value,
      );
  });

  it("Ragebred's conflicting permanent values remain unresolved; no partial penalty or shapechanged bonus is supplied, and its baseline stays active", () => {
    // Ragebred's conflicting permanent values remain unresolved; no partial
    // penalty or shapechanged bonus is supplied, and its baseline stays active.
    expect(entry('Wereboar-Kin (Ragebred)').modifiers).toEqual([]);
    expect(entry('Wereboar-Kin (Ragebred)').detail).toMatchObject({
      replaces: [],
      unresolvedReplacements: ['Base Statistics'],
    });
    expect(entry('Jiang-Shi Born (Ru-Shi)').modifiers).toEqual([
      { target: 'ability.str', bonusType: 'racial', value: 2 },
      { target: 'ability.int', bonusType: 'racial', value: 2 },
      { target: 'ability.dex', bonusType: 'racial', value: -2 },
    ]);
    for (const name of ['Mwangi Dwarves', 'Dreamthief-Born (Waker May)']) {
      expect(entry(name).modifiers, name).toEqual([]);
      expect(entry(name).detail.unresolvedReplacements, name).toEqual([
        'Base Statistics',
      ]);
    }
  });

  it('situational bonuses apply only when their Situation is selected', () => {
    // Situational bonuses apply only when their Situation is selected.
    for (const [name, target, base, label, value] of [
      ['Sea Legs', 'skill.acr', 'skill.acr', 'narrow or slippery', 4],
      ['Sea Legs', 'skill.clm', 'skill.clm', 'docks and ships', 4],
      ['Magehunter', 'attack.melee', 'attack', 'arcane spellcasters', 1],
      ['Magehunter', 'skill.spl', 'skill.spl', 'identify a spell', 2],
      ['Voice in the Darkness (Elf)', 'skill.int', 'skill.int', 'dim light', 2],
      ['Voice in the Darkness (Elf)', 'skill.ste', 'skill.ste', 'dim light', 2],
      ['Stoic Negotiator', 'skill.pro', 'skill.pro', 'merchant', 2],
      [
        'Behind the Veil (Halfling)',
        'skill.slt',
        'skill.slt',
        'concealment or cover',
        2,
      ],
      ['Creepy', 'skill.int', 'skill.int', 'demoralize', 2],
      ['Heart of the Slums', 'skill.sur', 'skill.sur', 'urban', 4],
      ['Underfoot Dodger', 'skill.acr', 'skill.acr', 'larger foes', 5],
      ['Eternal Hope', 'save.will', 'saves', 'despair', 2],
      ['Slave Hunter', 'save.fort', 'save.fort', 'disease', 2],
      ['Vampire Hunter', 'attack.ranged', 'attack', 'vampires', 1],
      [
        'Alternate Weakness (Dhampir - Ru-Shi)',
        'save.ref',
        'saves',
        'sonic effects and spells',
        -1,
      ],
      [
        'Change Shape (Skinwalker - Coldborn)',
        'ability.wis',
        'ability.wis',
        'bestial',
        2,
      ],
      [
        'Change Shape (Skinwalker - Aerieborn)',
        'ability.dex',
        'ability.dex',
        'bestial form"',
        2,
      ],
      [
        'Change Shape (Skinwalker - Aerieborn)',
        'skill.per',
        'skill.per',
        'Perception feature',
        4,
      ],
      [
        'Shadow Inheritor',
        'casterLevel',
        'casterLevel',
        'shadow descriptor',
        1,
      ],
      ['Knowledgeable', 'skill.kar', 'skill.kar', 'Knowledge (arcana)', 2],
      ['Knowledgeable', 'skill.kre', 'skill.kre', 'Knowledge (religion)', 2],
      [
        'Memories of the Forgotten',
        'skill.khi',
        'skill.khi',
        'Knowledge (history)',
        2,
      ],
    ] as const) {
      const index = indexOf(name, base, label);
      expect(resolved(name, target), `${name} ${target}`).toBe(0);
      expect(resolved(name, target, [index]), `${name} ${target}`).toBe(value);
    }
  });

  it('Obsessive, a standard gnome trait, stays prose: Modifiers would change the Gnome race totals the #719 check pins', () => {
    // Obsessive, a standard gnome trait, stays prose: Modifiers would change
    // the Gnome race totals the #719 check pins.
    expect(entry('Obsessive').modifiers).toEqual([]);
  });

  it('one chosen Knowledge skill: ten Modifiers, one Situation each; choosing one leaves the other Knowledge skills unchanged', () => {
    // One chosen Knowledge skill: ten Modifiers, one Situation each; choosing
    // one leaves the other Knowledge skills unchanged.
    for (const name of ['Knowledgeable', 'Memories of the Forgotten']) {
      expect(modifiers(name), name).toHaveLength(10);
      const arcana = indexOf(name, 'skill.kar', 'Knowledge (arcana)');
      expect(resolved(name, 'skill.kre', [arcana]), name).toBe(0);
    }
  });

  it("shared Situations only where the body's condition matches exactly; the race's re-homed bonuses keep theirs", () => {
    // Shared Situations only where the body's condition matches exactly; the
    // race's re-homed bonuses keep theirs. Bonuses of one type on one entry
    // don't stack.
    for (const [name, shared, target, value] of [
      ['Deep Shadow Explorer', 'fear', 'save.will', 2],
      ['Trusted Mediator', 'mindAffecting', 'save.will', 2],
      ['Gatecrasher', 'sunder', 'cmb', 2],
      ['Eternal Hope', 'fear', 'save.fort', 2],
      ['Cold-Blooded', 'mindAffecting', 'save.will', 2],
      ['Cold-Blooded', 'poison', 'save.fort', 2],
      ['Suspicious', 'illusions', 'save.ref', 2],
    ] as const) {
      const index = modifiers(name).findIndex(
        (row) => row.condition?.situation === shared,
      );
      expect(index, `${name} ${shared}`).toBeGreaterThanOrEqual(0);
      expect(resolved(name, target), name).toBe(0);
      expect(resolved(name, target, [index]), name).toBe(value);
      const all = modifiers(name)
        .map((row, index) => (row.condition?.situation ? index : -1))
        .filter((index) => index >= 0);
      expect(resolved(name, target, all), name).toBe(value);
    }
  });

  it('racial bonuses from distinct Sources stack (PRD; character-sheet.ts): Trusted Mediator and Cold-Blooded each give +2 racial against mind-affecting effects, +4 together', () => {
    // Racial bonuses from distinct Sources stack (PRD; character-sheet.ts):
    // Trusted Mediator and Cold-Blooded each give +2 racial against
    // mind-affecting effects, +4 together.
    const both = resolveSheet(
      [...modifiers('Trusted Mediator'), ...modifiers('Cold-Blooded')],
      { situations: ['mindAffecting'] },
    );
    expect(both['save.will'].total).toBe(4);
  });

  it('imported changes keep mapping; nothing is curated a second time', () => {
    // Imported changes keep mapping; nothing is curated a second time.
    for (const [name, target, value] of [
      ['Sea Legs', 'skill.swm', 2],
      ['Draconic Consular', 'skill.dip', 1],
      ['Draconic Consular', 'skill.kar', 1],
      ['Stoic Negotiator', 'skill.blf', 2],
      ['Stoic Negotiator', 'skill.dip', 2],
      ['Heart of the Slums', 'skill.slt', 2],
      ['Heart of the Slums', 'skill.ste', 2],
      ['Silver Tongued', 'skill.blf', 2],
      ['Silver Tongued', 'skill.dip', 2],
      ['Slave Hunter', 'skill.sur', 2],
      ['Cosmic Mind', 'skill.spl', 2],
      ['Cosmic Mind', 'skill.kre', 2],
      ['Keen Senses (Gnome)', 'skill.per', 2],
      ['Natural Armor (Sahuagin)', 'ac.natural', 3],
      ['Alternate Skill Modifiers (Skinwalker - Coldborn)', 'skill.clm', 2],
    ] as const)
      expect(resolved(name, target), `${name} ${target}`).toBe(value);
  });

  it("school DCs: Fell Magic and Hag Magic (AoE) curated, Gnome Magic the race's re-homed output", () => {
    // School DCs: Fell Magic and Hag Magic (AoE) curated, Gnome Magic the
    // race's re-homed output.
    for (const [name, school] of [
      ['Fell Magic (Gnome)', 'necromancy'],
      ['Hag Magic (AoE)', 'enchantment'],
      ['Gnome Magic (Gnome)', 'illusion'],
    ] as const)
      expect(modifiers(name), name).toMatchObject([
        {
          target: 'spellDC',
          bonusType: 'untyped',
          value: 1,
          condition: { school },
        },
      ]);
  });

  it("the Moon May ability record replaces the changeling's own ability trait by name: it goes dormant and the untyped line counts", () => {
    // The Moon May ability record replaces the changeling's own ability trait
    // by name: it goes dormant and the untyped line counts.
    const moon = entry('Ability Modifiers (Changeling - Moon May)');
    const changelingAbilities = 'pf1-content/PxjUu8YOjXmWdagL';
    expect(moon.detail.replaces).toEqual([changelingAbilities]);
    expect(
      entry('Ability Modifiers (Changeling - Hearth May)').detail.replaces,
    ).toEqual([changelingAbilities]);
    const changeling = 'pf1/9FBT6uqlRgaw9gug';
    expect(moon.detail.raceKeys?.[0]).toBe(changeling);
    const scores = (traits: string[]) => {
      const sheet = identityRace(racialTraitSheet({ traits }), changeling, [
        changelingAbilities,
      ]);
      return Object.fromEntries(
        (['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((ability) => [
          ability,
          total(sheet, `ability.${ability}`),
        ]),
      );
    };
    expect(scores([])).toEqual({
      str: 10,
      dex: 10,
      con: 8,
      int: 10,
      wis: 12,
      cha: 12,
    });
    expect(scores([moon.externalKey])).toEqual({
      str: 10,
      dex: 8,
      con: 10,
      int: 10,
      wis: 12,
      cha: 12,
    });
  });

  it('no armor, shield or natural armor bonus sits on ac.other', () => {
    // Notes carry the readable rules; no armor, shield or natural armor bonus
    // sits on ac.other.
    for (const row of batchEntries)
      for (const modifier of row.modifiers)
        if (['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType))
          expect(modifier.target, row.name).not.toBe('ac.other');
  });

  // Rule fields of the batch review's named entries in
  // racial-traits-393.test.ts:417,
  // a proof block whose record checks stay with the unit (fix r2).
  it("keeps the named traits' Notes on their statistics or at entry level, one skill rank per level for the Skilled traits and the weapon proficiencies the batch maps (racial-traits-393.test.ts:417)", () => {
    for (const name of [
      'Riverfolk',
      'Poison Use (Adaro)',
      'Amphibious (Grindylow)',
      'Gatecrasher',
      'Underfoot Dodger',
    ])
      expect(
        entry(name)
          .situationalNotes?.filter((note) => note.target)
          .map((note) => note.target),
        name,
      ).toEqual([]);
    for (const [name, targets] of [
      ['Warslinger', ['attack.ranged']],
      ['Dusksight (Gnome)', ['attack.ranged']],
      ['Mist Child', ['ac']],
      ['Creepy', ['spellDC']],
      ['Low Blow', ['attack']],
      ['Deep Dweller', ['attack', 'skill.per']],
      ['Silver Tongued', ['skill.dip']],
      ['Heart of the Slums', ['saves']],
      ['Seasoned', ['save.fort', 'save.fort']],
      ['Alternate Skill Modifiers (Skinwalker - Coldborn)', ['skill.dip']],
    ] as const)
      expect(
        entry(name)
          .situationalNotes?.filter((note) => note.target)
          .map((note) => note.target)
          .sort(),
        name,
      ).toEqual(targets);
    expect(entry('Skilled (Human)').detail.bonusSkillRanksPerLevel).toBe(1);
    const grants = {
      'Weapon Familiarity (Drow)': ['Hand Crossbow', 'Rapier', 'Shortsword'],
      'Jininese Weapon Mastery': ['Fighting Fan', 'Tonfa'],
    } as Record<string, string[]>;
    // Every trait of the batch's list maps the weapon proficiencies of this
    // table, and no other.
    expect(batchEntries).toHaveLength(74);
    for (const row of batchEntries)
      expect(
        (row.proficiencies ?? [])
          .map((grant) => ('baseType' in grant ? grant.baseType : null))
          .sort(),
        row.name,
      ).toEqual(grants[row.name] ?? []);
  });

  // The replacement fields in
  // racial-traits-393.test.ts:702 and :587, proof blocks whose record checks stay
  // with the unit (fix r2).
  it("reads the batch's unresolved replacement names, the named traits' replaced traits and the race placement it names (racial-traits-393.test.ts:702)", () => {
    // The batch's list: each trait that keeps a replacement name unresolved,
    // with those names; every other trait resolves all of its replacements.
    expect(batchEntries).toHaveLength(74);
    const unresolved = Object.fromEntries(
      batchEntries
        .filter((row) => row.detail.unresolvedReplacements?.length)
        .map((row) => [row.externalKey, row.detail.unresolvedReplacements]),
    );
    expect(unresolved).toEqual({
      // The racial subtypes and the changeling heritage keep their race's
      // ability score trait.
      'pf1-content/KW6G6g9qFZLryJxQ': ['Base Statistics'], // Mwangi Dwarves
      'pf1-content/LzFbBJDJsOh7wy8t': ['Base Statistics'], // Dreamthief-Born
      // Ragebred remains source-conflicted and keeps the manual fallback.
      'pf1-content/Mb0hz0BAj51wOmUr': ['Base Statistics'],
      // The annis hag's daughter's trait names a replaced trait no pinned
      // changeling record has (importer gap).
      'pf1-content/MNr30PKDqT4GLw8q': ['Hulking Changeling'], // Mist Child
    });
    expect(entry('Hag Magic (AoE)').detail.replaces).toEqual([
      'pf1-content/CmhdInCVqMiadv3T',
      'pf1-content/Qx1JqPVW0quaOGfY',
    ]);
    // Its folder binds no race record.
    expect(entry('Knowledgeable').detail.raceKeys).toEqual([]);
  });
});

describe('the racial-traits-394 keys', () => {
  const {
    batchEntries,
    entry,
    modifiers,
    situation,
    indexOf,
    resolved,
    racialTraitSheet,
    identityRace,
    total,
  } = racialTraitBatch(entries, 'racial-traits-394');
  it('Unlucky Halfling replaces Halfling Luck on the halfling sheet: the +1 racial bonus on saves goes dormant and the -1 penalty applies', () => {
    // Unlucky Halfling replaces Halfling Luck on the halfling sheet: the +1
    // racial bonus on saves goes dormant and the -1 penalty applies.
    const unlucky = entry('Unlucky Halfling');
    const halfling = unlucky.detail.raceKeys?.[0];
    if (!halfling) throw new Error('Unlucky Halfling has no race');
    expect(halfling).toBe('pf1/Hf31mrYb3uucNyLO');
    expect(importedEntry(entries, 'pf1-content/HVI7FNwj2ng10qtj').name).toBe(
      'Halfling Luck',
    );
    expect(unlucky.detail.replaces).toEqual(['pf1-content/HVI7FNwj2ng10qtj']);
    const luck = 'pf1-content/HVI7FNwj2ng10qtj';
    const plain = identityRace(racialTraitSheet({}), halfling, [luck]);
    const unluckySheet = identityRace(
      racialTraitSheet({ traits: [unlucky.externalKey] }),
      halfling,
      [luck],
    );
    for (const target of ['save.fort', 'save.ref', 'save.will']) {
      expect(total(plain, target), `Halfling ${target}`).toBe(1);
      expect(total(unluckySheet, target), `Unlucky ${target}`).toBe(-1);
    }
  });

  it('situational bonuses apply only when their Situation is selected', () => {
    // Situational bonuses apply only when their Situation is selected.
    for (const [name, target, base, label, value] of [
      ['Eternal Grudge', 'attack.melee', 'attack', 'dwarf and orc', 1],
      ['Ancient Enmity', 'attack.ranged', 'attack', 'elf subtype', 1],
      [
        'Memories Beyond Death',
        'skill.kar',
        'skill.kar',
        'Knowledge (arcana)',
        1,
      ],
      ['Wright', 'skill.han', 'skill.han', 'driving', 2],
      ['Wright', 'skill.umd', 'skill.umd', 'driving', 2],
      ['Wright', 'skill.crf', 'skill.crf', 'vehicles', 2],
      ['Blasphemous Covenant', 'skill.dip', 'skill.dip', 'demon subtype', 2],
      ['Dreamspeaker', 'spellDC', 'spellDC', 'sleep effects', 1],
      ['Unlucky Halfling', 'casterLevel', 'casterLevel', 'curse', 1],
      ['Unlucky Halfling', 'spellDC', 'spellDC', 'curse', 1],
      ['Wanderlust', 'casterLevel', 'casterLevel', 'movement', 1],
      ['Frenzy', 'ability.con', 'ability.con', 'frenzy', 2],
      ['Frenzy', 'ability.str', 'ability.str', 'frenzy', 2],
      ['Frenzy', 'ac.other', 'ac', 'frenzy', -2],
      [
        'Change Shape (Skinwalker - Witchwolf)',
        'ability.wis',
        'ability.wis',
        'bestial form"',
        2,
      ],
      [
        'Change Shape (Skinwalker - Witchwolf)',
        'save.will',
        'saves',
        'saving throw feature',
        2,
      ],
    ] as const) {
      const index = indexOf(name, base, label);
      expect(resolved(name, target), `${name} ${target}`).toBe(0);
      expect(resolved(name, target, [index]), `${name} ${target}`).toBe(value);
    }
  });

  it('one chosen Knowledge skill: ten Modifiers, one Situation each; choosing one leaves the other Knowledge skills unchanged', () => {
    // One chosen Knowledge skill: ten Modifiers, one Situation each; choosing
    // one leaves the other Knowledge skills unchanged.
    const memories = modifiers('Memories Beyond Death').filter((row) =>
      row.target.startsWith('skill.k'),
    );
    expect(memories).toHaveLength(10);
    const arcana = indexOf('Memories Beyond Death', 'skill.kar', 'arcana');
    expect(resolved('Memories Beyond Death', 'skill.kre', [arcana])).toBe(0);
  });

  it("Wright's driving bonus is one Modifier per skill the Foundry notes name", () => {
    // Wright's driving bonus is one Modifier per skill the Foundry notes name.
    expect(
      modifiers('Wright')
        .filter((row) => JSON.stringify(row.condition).includes('driving'))
        .map((row) => row.target)
        .sort(),
    ).toEqual([
      'skill.acr',
      'skill.dip',
      'skill.fly',
      'skill.han',
      'skill.int',
      'skill.kar',
      'skill.kna',
      'skill.pro',
      'skill.spl',
      'skill.umd',
    ]);
  });

  it("shared Situations only where the body's condition matches exactly", () => {
    // Shared Situations only where the body's condition matches exactly.
    for (const [name, shared, target, value] of [
      ['Memories Beyond Death', 'fear', 'save.will', 2],
      ['Vigilance', 'chaoticCreatures', 'ac.other', 2],
    ] as const) {
      const index = modifiers(name).findIndex(
        (row) => row.condition?.situation === shared,
      );
      expect(index, `${name} ${shared}`).toBeGreaterThanOrEqual(0);
      expect(resolved(name, target), name).toBe(0);
      expect(resolved(name, target, [index]), name).toBe(value);
    }
    expect(modifiers('Vigilance')).toMatchObject([
      { target: 'ac', bonusType: 'dodge', value: 2 },
    ]);
  });

  it("racial bonuses from distinct Sources stack (PRD; character-sheet.ts): Skilled (Tiefling - Hungerseed)'s +2 racial Intimidate and Wright's +2 racial Intimidate on driving checks give +4 together", () => {
    // Racial bonuses from distinct Sources stack (PRD; character-sheet.ts):
    // Skilled (Tiefling - Hungerseed)'s +2 racial Intimidate and Wright's +2
    // racial Intimidate on driving checks give +4 together.
    const driving = indexOf('Wright', 'skill.int', 'driving');
    const both = resolveSheet(
      [
        ...modifiers('Skilled (Tiefling - Hungerseed)'),
        modifiers('Wright')[driving]!,
      ],
      { situations: [situation('Wright', driving)] },
    );
    expect(both['skill.int'].total).toBe(4);
  });

  it('imported changes keep mapping; nothing is curated a second time', () => {
    // Imported changes keep mapping; nothing is curated a second time.
    for (const [name, target, value] of [
      ['Secretive Survivor', 'skill.blf', 2],
      ['Secretive Survivor', 'skill.ste', 2],
      ['Integrated', 'skill.dis', 1],
      ['Integrated', 'skill.klo', 1],
      ['Polyglot', 'skill.lin', 2],
      ['Over-Sized Ears', 'skill.per', 4],
      ['Sophisticate', 'skill.khi', 2],
      ['Sophisticate', 'skill.klo', 2],
      ['Wanderlust', 'skill.kge', 2],
      ['Wanderlust', 'skill.sur', 2],
      ['Keen Senses (Vishkanya)', 'skill.per', 2],
      ['Fortunate', 'save.ref', 2],
      ['Manipulative', 'skill.blf', 2],
      ['Manipulative', 'skill.per', 2],
      ['Skilled (Tiefling - Hungerseed)', 'skill.dis', 2],
      ['Skilled (Tiefling - Hungerseed)', 'skill.int', 2],
      ['Ability Modifiers (Changeling)', 'ability.wis', 2],
      ['Ability Modifiers (Changeling)', 'ability.con', -2],
      ['Natural Armor (Changeling)', 'ac.natural', 1],
    ] as const)
      expect(resolved(name, target), `${name} ${target}`).toBe(value);
  });

  it("Kindred-Raised's ability choice is the importer's ability.$choice Modifier (#721), not a resolver statistic; nothing is curated on it", () => {
    // Kindred-Raised's ability choice is the importer's ability.$choice
    // Modifier (#721), not a resolver statistic; nothing is curated on it.
    expect(entry('Kindred-Raised').modifiers).toEqual([
      { target: 'ability.$choice', bonusType: 'racial', value: 2 },
      { target: 'ability.cha', bonusType: 'untyped', value: 2 },
    ]);
  });

  it("Unlucky Halfling's -1 on saves is a reviewed untyped Modifier (the raw untypedPerm change does not map)", () => {
    // Unlucky Halfling's -1 on saves is a reviewed untyped Modifier (the raw
    // untypedPerm change does not map).
    expect(resolved('Unlucky Halfling', 'save.fort')).toBe(-1);
  });

  it("Aquatic Ancestry: the reviewed change replacement halves Foundry's full Hit Dice to the published half character level (+3 at 7th level)", () => {
    // Aquatic Ancestry: the reviewed change replacement halves Foundry's full
    // Hit Dice to the published half character level (+3 at 7th level).
    const [swim, ...rest] = modifiers('Aquatic Ancestry');
    expect(rest).toEqual([]);
    expect(swim).toMatchObject({
      target: 'skill.swm',
      bonusType: 'racial',
      value: { formula: 'floor(@hitDice / 2)' },
    });
    if (!swim || typeof swim.value === 'number')
      throw new Error('Expected formula');
    expect(
      evaluateFormula(parseFormula(swim.value.formula), (name) =>
        name === '@hitDice' ? 7 : 0,
      ),
    ).toBe(3);
  });

  it("Dreamspeaker's divination DC is curated as a school Modifier", () => {
    // Dreamspeaker's divination DC is curated as a school Modifier.
    // The note record's sleep-effect Modifier comes first, then the
    // description record's school Modifier.
    expect(modifiers('Dreamspeaker')).toMatchObject([
      {
        target: 'spellDC',
        bonusType: 'untyped',
        value: 1,
        condition: { situation: { local: 'for sleep effects you cast' } },
      },
      {
        target: 'spellDC',
        bonusType: 'untyped',
        value: 1,
        condition: { school: 'divination' },
      },
    ]);
  });

  it('standard traits of #719 races and the racial subtypes stay without reviewed Modifiers; the subtypes keep "Base Statistics" unresolved', () => {
    // Standard traits of #719 races and the racial subtypes stay without
    // reviewed Modifiers; the subtypes keep "Base Statistics" unresolved.
    for (const name of [
      'Orc Ferocity',
      'Slow Speed (Gnome)',
      'Hag Racial Trait (Changeling - Green Widow)',
      'Spiresworn Elves',
      "Song'o Halflings",
      'Gear Gnomes',
      'Mountain Clan',
      'Deep Kin',
      'Exiled Dwarf',
      'Winter-Born (Snow May)',
      'Green-Born (Callow May)',
    ])
      expect(entry(name).modifiers, name).toEqual([]);
  });

  it("Skilled (Kitsune)'s extra rank is read as one rank per level", () => {
    // Skilled (Kitsune)'s extra rank is read as one rank per level.
    expect(entry('Skilled (Kitsune)').detail.bonusSkillRanksPerLevel).toBe(1);
  });

  it('no armor, shield or natural armor bonus sits on ac.other', () => {
    // Notes carry the readable rules; no armor, shield or natural armor bonus
    // sits on ac.other.
    for (const row of batchEntries)
      for (const modifier of row.modifiers)
        if (['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType))
          expect(modifier.target, row.name).not.toBe('ac.other');
  });

  // Rule fields of the batch review's named entries in
  // racial-traits-394.test.ts:397,
  // a proof block whose record checks stay with the unit (fix r2).
  it("keeps the named traits' Notes on their statistics or at entry level and the weapon proficiencies the batch maps (racial-traits-394.test.ts:397)", () => {
    for (const name of [
      'Resist Level Drain (Dhampir)',
      'Water Sense (Undine)',
      'Amorphous',
      'Orc Ferocity',
    ])
      expect(
        entry(name)
          .situationalNotes?.filter((note) => note.target)
          .map((note) => note.target),
        name,
      ).toEqual([]);
    for (const [name, targets] of [
      ['Sophisticate', ['skill.khi', 'skill.klo']],
      ['Hag Racial Trait (Changeling - Green Widow)', ['skill.blf']],
      ['Ghost Hunter', ['attack']],
      ['Aquatic Ancestry', ['skill.swm']],
      ['Blasphemous Covenant', []],
    ] as const)
      expect(
        entry(name)
          .situationalNotes?.filter((note) => note.target)
          .map((note) => note.target)
          .sort(),
        name,
      ).toEqual(targets);
    const grants = {
      'Weapon Familiarity (Green Martian)': [
        'Longspear',
        'Longsword',
        'Shortspear',
        'Spear',
      ],
    } as Record<string, string[]>;
    // Every trait of the batch's list maps the weapon proficiencies of this
    // table, and no other.
    expect(batchEntries).toHaveLength(68);
    for (const row of batchEntries)
      expect(
        (row.proficiencies ?? [])
          .map((grant) => ('baseType' in grant ? grant.baseType : null))
          .sort(),
        row.name,
      ).toEqual(grants[row.name] ?? []);
  });

  // The replacement fields in
  // racial-traits-394.test.ts:707 and :580, proof blocks whose record checks stay
  // with the unit (fix r2).
  it("reads the batch's unresolved replacement names, the named traits' replaced traits and the race placement it names (racial-traits-394.test.ts:707)", () => {
    // The batch's list: each trait that keeps a replacement name unresolved,
    // with those names; every other trait resolves all of its replacements.
    expect(batchEntries).toHaveLength(68);
    const unresolved = Object.fromEntries(
      batchEntries
        .filter((row) => row.detail.unresolvedReplacements?.length)
        .map((row) => [row.externalKey, row.detail.unresolvedReplacements]),
    );
    expect(unresolved).toEqual({
      // The racial subtypes, ethnicities and changeling heritages keep their
      // race's ability score trait.
      'pf1-content/OhtzsoHplJO2iqs7': ['Base Statistics'], // Spiresworn Elves
      'pf1-content/PHryxw5cbuUqi07S': ['Base Statistics'], // Winter-Born (Snow May)
      'pf1-content/PKI1mYZltP1nWgBs': ['Base Statistics'], // Mountain Clan
      'pf1-content/POpOQ92KDbEjUHMM': ['Base Statistics'], // Exiled Dwarf
      'pf1-content/PtZLDuOW5e0OoVsx': ['Base Statistics'], // Gear Gnomes
      'pf1-content/Q901lu7ObAb1hJJ3': ['Base Statistics'], // Song'o Halflings
      'pf1-content/QkJI00xDaBcowq2i': ['Base Statistics'], // Deep Kin
      'pf1-content/QoUMSih2Xyc3GRR7': ['Base Statistics'], // Green-Born (Callow May)
      // Headers naming no standard trait record of the race (importer gap):
      // "Language" for Languages (Halfling), "Nature Magic" for Natural Magic.
      'pf1-content/OqqOmbw84qSUfekh': ['Keen Senses', 'Language'], // Polyglot
      'pf1-content/Owfw2qBYmmKJsSYD': ['Seed', 'Nature Magic'], // Martial Recollection
    });
    expect(entry('Kindred-Raised').detail.replaces).toHaveLength(5);
    expect(entry('Wright').detail.replaces).toEqual([
      'pf1-content/FD2SILZXcIMjauvr',
      'pf1-content/LcZE7cPw87DMzJYl',
    ]);
    // Its folder binds no race record.
    expect(entry('Languages (Lashunta)').detail.raceKeys).toEqual([]);
  });
});

describe('the racial-traits-395 keys', () => {
  const {
    batchEntries,
    entry,
    modifiers,
    situation,
    indexOf,
    resolved,
    racialTraitSheet,
    identityRace,
    total,
  } = racialTraitBatch(entries, 'racial-traits-395', { countsAsRaces: true });
  it('retains the Orc equivalence explicitly stated by Orc Atavism after Orc Blood is replaced', () => {
    expect(entry('Orc Atavism').countsAsRaces).toEqual([
      'pf1/JOuAdPAOTat7d5v6',
    ]);
    const sheet = identityRace(
      racialTraitSheet({ traits: ['pf1-content/SJOcTJ2MQI3AoMeh'] }),
      'pf1/dCAXgdA6Db1Z3ccz',
      ['pf1-content/JWzMBJeAQYDav9gw'],
    );
    expect(
      calculateCharacterSheetProjections(sheet).current.racial.countsAsRaces,
    ).toEqual(['pf1/JOuAdPAOTat7d5v6', 'pf1/dCAXgdA6Db1Z3ccz'].sort());
  });

  it("Garuda-Blooded (Plumekith) replaces the aasimar's ability score trait: the aasimar's +2 Wisdom and +2 Charisma go dormant and the curated heritage line (+2 Dexterity, +2 Wisdom) applies", () => {
    // Garuda-Blooded (Plumekith) replaces the aasimar's ability score trait:
    // the aasimar's +2 Wisdom and +2 Charisma go dormant and the curated
    // heritage line (+2 Dexterity, +2 Wisdom) applies.
    const garuda = entry('Garuda-Blooded (Plumekith)');
    const aasimar = garuda.detail.raceKeys?.[0];
    if (!aasimar) throw new Error('Garuda-Blooded has no race');
    expect(aasimar).toBe('pf1/FHY3oIk5zSOFncJH');
    const ability = raceAbilityTraitKey(aasimar);
    expect(garuda.detail.replaces).toEqual([ability]);
    const skilled = 'pf1-content/SiZwOvv9Vz2OluRK';
    const plain = identityRace(racialTraitSheet({}), aasimar, [
      ability,
      skilled,
    ]);
    const plumekith = identityRace(
      racialTraitSheet({ traits: [garuda.externalKey] }),
      aasimar,
      [ability, skilled],
    );
    // Diplomacy: +2 racial (Skilled) and the Charisma modifier.
    for (const [target, before, after] of [
      ['ability.dex', 10, 12],
      ['ability.wis', 12, 12],
      ['ability.cha', 12, 10],
      ['skill.dip', 3, 2],
    ] as const) {
      expect(total(plain, target), `Aasimar ${target}`).toBe(before);
      expect(total(plumekith, target), `Plumekith ${target}`).toBe(after);
    }
  });

  it('other curated heritage ability lines retain their independent expectations', () => {
    // Other curated heritage ability lines retain their independent expectations.
    for (const [name, expected] of [
      [
        'Nosferatu-Born (Ancient-Born)',
        [
          ['ability.str', 2],
          ['ability.wis', 2],
          ['ability.con', -2],
        ],
      ],
      [
        'Wereraptor-Kin (Aerieborn)',
        [
          ['ability.wis', 2],
          ['ability.cha', -2],
        ],
      ],
    ] as const) {
      expect(
        modifiers(name).map((row) => [row.target, row.value]),
        name,
      ).toEqual(expected);
      expect(
        modifiers(name).every((row) => row.bonusType === 'racial'),
        name,
      ).toBe(true);
      expect(entry(name).detail.replaces?.[0], name).toMatch(
        /^local\/race-ability-scores\//,
      );
    }
  });

  it('situational bonuses apply only when their Situation is selected', () => {
    // Situational bonuses apply only when their Situation is selected.
    for (const [name, target, base, label, value] of [
      ['Perfect', 'save.will', 'saves', 'transmutation', 2],
      ['Perfect', 'skill.blf', 'skill.blf', 'humanoids', 1],
      ['Cold-Honed', 'save.fort', 'save.fort', 'cold environments', 4],
      ['Piety', 'attack.melee', 'attack', 'deity', 2],
      ['Piety', 'save.ref', 'saves', 'deity', 2],
      ['Piety', 'skill.acr', 'skills', 'deity', 2],
      ['Shadowhunter (Dwarf)', 'save.fort', 'saves', 'negative levels', 2],
      ['Urbanite', 'skill.dip', 'skill.dip', 'gather information', 2],
      ['Urbanite', 'skill.sen', 'skill.sen', 'hunch', 2],
      ['Desert Runner', 'save.fort', 'save.fort', 'forced marches', 4],
      ['Bond to the Land', 'ac.other', 'ac', 'favored terrain', 2],
      ['Healthy', 'save.fort', 'saves', 'disease', 2],
      ['Aquatic Mastery', 'spellDC', 'spellDC', 'water descriptor', 1],
      ['Champion of Dark Powers', 'spellDC', 'spellDC', 'evil descriptor', 2],
      ['Forge-Hardened', 'skill.crf', 'skill.crf', 'Craft (armor)', 2],
      ['Forge-Hardened', 'save.will', 'saves', 'fatigue', 2],
      ['Defensive Training (Grippli)', 'ac.other', 'ac', 'magical beasts', 2],
      ['Celestial Crusader', 'attack.ranged', 'attack', 'evil outsiders', 1],
      ['Celestial Crusader', 'ac.other', 'ac', 'evil outsiders', 1],
      ['Celestial Crusader', 'skill.kpl', 'skill.kpl', 'identify', 2],
      ['Celestial Crusader', 'skill.spl', 'skill.spl', 'identify', 2],
      [
        'Hag Racial Trait (Changeling - Snow May)',
        'skill.acr',
        'skill.acr',
        'icy',
        5,
      ],
      ['Bandy-Legged', 'cmd', 'cmd', 'bull rush', 2],
      ['Bandy-Legged', 'cmd', 'cmd', 'trip attempts', 2],
    ] as const) {
      const index = indexOf(name, base, label);
      expect(resolved(name, target), `${name} ${target}`).toBe(0);
      expect(resolved(name, target, [index]), `${name} ${target}`).toBe(value);
    }
  });

  it("shared Situations only where the body's condition matches exactly", () => {
    // Shared Situations only where the body's condition matches exactly.
    for (const [name, shared, target, value] of [
      ['Healthy', 'poison', 'save.fort', 2],
    ] as const) {
      const index = modifiers(name).findIndex(
        (row) => row.condition?.situation === shared,
      );
      expect(index, `${name} ${shared}`).toBeGreaterThanOrEqual(0);
      expect(resolved(name, target), name).toBe(0);
      expect(resolved(name, target, [index]), name).toBe(value);
    }
  });

  it("Healthy's poison and disease bonuses are both racial on one entry: they do not stack", () => {
    // Healthy's poison and disease bonuses are both racial on one entry: they
    // do not stack.
    expect(
      resolved('Healthy', 'save.fort', [
        modifiers('Healthy').findIndex(
          (row) => row.condition?.situation === 'poison',
        ),
        indexOf('Healthy', 'saves', 'disease'),
      ]),
    ).toBe(2);
  });

  it("insight and dodge bonuses go on ac, never on ac.other's armor types", () => {
    // Insight and dodge bonuses go on ac, never on ac.other's armor types.
    expect(
      modifiers('Celestial Crusader').filter((row) => row.target === 'ac'),
    ).toMatchObject([{ bonusType: 'insight', value: 1 }]);
    expect(modifiers('Bond to the Land')).toMatchObject([
      { target: 'ac', bonusType: 'dodge', value: 2 },
    ]);
  });

  it("racial bonuses from distinct Sources stack (PRD; character-sheet.ts): Caretaker's +2 racial Sense Motive and Urbanite's +2 racial Sense Motive to get a hunch give +4 together", () => {
    // Racial bonuses from distinct Sources stack (PRD; character-sheet.ts):
    // Caretaker's +2 racial Sense Motive and Urbanite's +2 racial Sense Motive
    // to get a hunch give +4 together.
    const hunch = indexOf('Urbanite', 'skill.sen', 'hunch');
    const both = resolveSheet(
      [...modifiers('Caretaker'), modifiers('Urbanite')[hunch]!],
      { situations: [situation('Urbanite', hunch)] },
    );
    expect(both['skill.sen'].total).toBe(4);
  });

  it('imported changes keep mapping; nothing is curated a second time', () => {
    // Imported changes keep mapping; nothing is curated a second time.
    for (const [name, target, value] of [
      ['Caretaker', 'skill.sen', 2],
      ['Piety', 'skill.kre', 2],
      ['Gifted Linguist', 'skill.lin', 4],
      ['Duplicitous', 'skill.blf', 2],
      ['Duplicitous', 'skill.dis', 2],
      ['Skilled (Goblin)', 'skill.rid', 4],
      ['Skilled (Goblin)', 'skill.ste', 4],
      ['Skilled (Aasimar)', 'skill.dip', 2],
      ['Skilled (Aasimar)', 'skill.per', 2],
      ['Natural Armor (Deep One Hybrid)', 'ac.natural', 1],
      ['Bandy-Legged', 'skill.clm', 2],
      ['Bandy-Legged', 'skill.rid', 2],
    ] as const)
      expect(resolved(name, target), `${name} ${target}`).toBe(value);
  });

  it("Orc Atavism's ability changes are the importer's mapped Modifiers (#721)", () => {
    // Orc Atavism's ability changes are the importer's mapped Modifiers (#721).
    expect(entry('Orc Atavism').modifiers).toEqual([
      { target: 'ability.str', bonusType: 'racial', value: 2 },
      { target: 'ability.$choice', bonusType: 'racial', value: -2 },
    ]);
  });

  it('school Modifiers for the raw dc.school.ill and cl.school.trs changes', () => {
    // School Modifiers for the raw dc.school.ill and cl.school.trs changes.
    expect(modifiers('Faerie Dragon Magic')).toMatchObject([
      {
        target: 'spellDC',
        bonusType: 'untyped',
        value: 1,
        condition: { school: 'illusion' },
      },
    ]);
    expect(modifiers('Mordant Envoy')).toMatchObject([
      {
        target: 'casterLevel',
        bonusType: 'untyped',
        value: 1,
        condition: { school: 'transmutation' },
      },
    ]);
  });

  it('standard traits of #719 races, latent overlaps and the racial subtypes stay without reviewed Modifiers; the subtypes keep "Base Statistics" unresolved and Dual Talent stays unresolved (racial-traits-719)', () => {
    // Standard traits of #719 races, latent overlaps and the racial subtypes
    // stay without reviewed Modifiers; the subtypes keep "Base Statistics"
    // unresolved and Dual Talent stays unresolved (racial-traits-719).
    for (const name of [
      'Natural Weapons (Kitsune)',
      'Natural Magic',
      'Hag Racial Trait (Changeling - Hulking Changeling)',
      'Elf',
      'Languages (Cecaelia)',
      'Lifebound',
      'Arctic Elf',
      'Imperious Human',
      'Trailblazer',
      'Desert Dwarves',
      'Outsear Sahuagin',
      'Blood-Born (Veil May)',
      'Ash-Born (Hearth May)',
    ])
      expect(entry(name).modifiers, name).toEqual([]);
  });

  it("Stability (Dwarf) keeps the Dwarf race's re-homed note Modifiers", () => {
    // Stability (Dwarf) keeps the Dwarf race's re-homed note Modifiers.
    expect(entry('Stability (Dwarf)').modifiers).toEqual([
      {
        target: 'cmd',
        bonusType: 'racial',
        value: 4,
        condition: { situation: 'bullRushGround' },
      },
      {
        target: 'cmd',
        bonusType: 'racial',
        value: 4,
        condition: { situation: 'tripGround' },
      },
    ]);
  });

  it('no armor, shield or natural armor bonus sits on ac.other', () => {
    // Notes carry the readable rules; no armor, shield or natural armor bonus
    // sits on ac.other.
    for (const row of batchEntries)
      for (const modifier of row.modifiers)
        if (['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType))
          expect(modifier.target, row.name).not.toBe('ac.other');
  });

  // Rule fields of the batch review's named entries in
  // racial-traits-395.test.ts:415,
  // a proof block whose record checks stay with the unit (fix r2).
  it("keeps the named traits' Notes on their statistics or at entry level and the weapon proficiencies the batch maps (racial-traits-395.test.ts:415)", () => {
    for (const name of [
      'Joyous Companion',
      'Champion of Dark Powers',
      'Energy Strike (Acid)',
      'Cheek Pouches',
    ])
      expect(
        entry(name)
          .situationalNotes?.filter((note) => note.target)
          .map((note) => note.target),
        name,
      ).toEqual([]);
    for (const [name, targets] of [
      ['Mountaineer', ['skill.acr', 'skill.clm']],
      ['Shadowhunter (Dwarf)', ['attack']],
      ['Dusksight (Half-Elf)', ['attack.ranged']],
      ['Gifted Linguist', ['skill.lin']],
      ['Risky Troublemaker', ['skill.umd']],
      ['Healthy', ['saves']],
      ['Celestial Crusader', ['skill.kpl', 'skill.spl']],
      [
        'Hag Racial Trait (Changeling - Virga May)',
        ['attack.ranged', 'skill.acr', 'skill.clm', 'skill.fly', 'skill.per'],
      ],
    ] as const)
      expect(
        entry(name)
          .situationalNotes?.filter((note) => note.target)
          .map((note) => note.target)
          .sort(),
        name,
      ).toEqual(targets);
    const grants = {
      Swordtrained: [
        'Bastard Sword',
        'Dagger',
        'Falchion',
        'Greatsword',
        'Kukri',
        'Longsword',
        'Punching Dagger',
        'Rapier',
        'Scimitar',
        'Shortsword',
        'Two-Bladed Sword',
      ],
    } as Record<string, string[]>;
    // Every trait of the batch's list maps the weapon proficiencies of this
    // table, and no other.
    expect(batchEntries).toHaveLength(82);
    for (const row of batchEntries)
      expect(
        (row.proficiencies ?? [])
          .map((grant) => ('baseType' in grant ? grant.baseType : null))
          .sort(),
        row.name,
      ).toEqual(grants[row.name] ?? []);
  });

  // The replacement fields in
  // racial-traits-395.test.ts:733, proof blocks whose record checks stay
  // with the unit (fix r2).
  it("reads the batch's unresolved replacement names and the named traits' replaced traits (racial-traits-395.test.ts:733)", () => {
    // The batch's list: each trait that keeps a replacement name unresolved,
    // with those names; every other trait resolves all of its replacements.
    expect(batchEntries).toHaveLength(82);
    const unresolved = Object.fromEntries(
      batchEntries
        .filter((row) => row.detail.unresolvedReplacements?.length)
        .map((row) => [row.externalKey, row.detail.unresolvedReplacements]),
    );
    expect(unresolved).toEqual({
      'pf1-content/Rj3X80eJLvjX0SpQ': ['Base Statistics'], // Blood-Born (Veil May)
      'pf1-content/S2NJixZYq3fBtPig': ['Base Statistics'], // Arctic Elf
      'pf1-content/S54OGr1E0tI6V4jQ': ['Base Statistics'], // Imperious Human
      'pf1-content/ShvaEnYXmYs0vV6h': ['Base Statistics'], // Desert Dwarves
      'pf1-content/SpAdy1qMBxoxTQLN': ['Languages', 'Subtype', 'Type'], // Mostly Human (Suli)
      'pf1-content/SqRzbbqegU7NiqI0': ['Invisibility Spell-Like Ability'], // Magical Taskmaster
      'pf1-content/TOl6oVYoCVFP8YbS': ['Metal Affinity (Oread - Ironsoul)'], // Metal Affinity (Oread - Ironsoul)
      'pf1-content/TRCZ20ubvIc5MASZ': ['Base Statistics'], // Outsear Sahuagin
      'pf1-content/To9CTavwqfCUqpuZ': ['Base Statistics'], // Ash-Born (Hearth May)
      'pf1-content/TqBOLc2wmCF0ikFl': ['Base Statistics'], // Trailblazer
    });
    expect(entry('Orc Atavism').detail.replaces).toHaveLength(4);
    expect(entry('Orc Atavism').detail.replaces).toContain(
      'pf1-content/JWzMBJeAQYDav9gw',
    );
    expect(entry('Celestial Crusader').detail.replaces).toEqual([
      'pf1-content/Hr7VZkVINGbLYfpo',
      'pf1-content/SiZwOvv9Vz2OluRK',
    ]);
  });
});

describe('the racial-traits-396 keys', () => {
  const {
    batchEntries,
    entry,
    modifiers,
    situation,
    indexOf,
    resolved,
    racialTraitSheet,
    identityRace,
    total,
  } = racialTraitBatch(entries, 'racial-traits-396');
  it("Azata-Blooded (Musetouched) replaces the aasimar's ability score trait: the aasimar's +2 Wisdom and +2 Charisma go dormant and the curated heritage line (+2 Dexterity, +2 Charisma) applies", () => {
    // Azata-Blooded (Musetouched) replaces the aasimar's ability score trait:
    // the aasimar's +2 Wisdom and +2 Charisma go dormant and the curated
    // heritage line (+2 Dexterity, +2 Charisma) applies.
    const azata = entry('Azata-Blooded (Musetouched)');
    const aasimar = azata.detail.raceKeys?.[0];
    if (!aasimar) throw new Error('Azata-Blooded has no race');
    expect(aasimar).toBe('pf1/FHY3oIk5zSOFncJH');
    const ability = raceAbilityTraitKey(aasimar);
    expect(azata.detail.replaces).toEqual([ability]);
    const darkvision = 'pf1-content/VfIksZzCRMtktSu6';
    const plain = identityRace(racialTraitSheet({}), aasimar, [
      ability,
      darkvision,
    ]);
    const musetouched = identityRace(
      racialTraitSheet({ traits: [azata.externalKey] }),
      aasimar,
      [ability, darkvision],
    );
    for (const [target, before, after] of [
      ['ability.dex', 10, 12],
      ['ability.wis', 12, 10],
      ['ability.cha', 12, 12],
    ] as const) {
      expect(total(plain, target), `Aasimar ${target}`).toBe(before);
      expect(total(musetouched, target), `Musetouched ${target}`).toBe(after);
    }
  });

  it('the other curated heritage ability lines', () => {
    // The other curated heritage ability lines.
    for (const [name, expected] of [
      [
        'Kyton-Spawn (Shackleborn)',
        [
          ['ability.con', 2],
          ['ability.cha', 2],
          ['ability.wis', -2],
        ],
      ],
      [
        'Sunsoul (Solar Ifrit)',
        [
          ['ability.str', 2],
          ['ability.cha', 2],
          ['ability.wis', -2],
        ],
      ],
    ] as const) {
      expect(
        modifiers(name).map((row) => [row.target, row.value]),
        name,
      ).toEqual(expected);
      expect(
        modifiers(name).every((row) => row.bonusType === 'racial'),
        name,
      ).toBe(true);
      expect(entry(name).detail.replaces?.[0], name).toMatch(
        /^local\/race-ability-scores\//,
      );
    }
  });

  it('situational bonuses apply only when their Situation is selected', () => {
    // Situational bonuses apply only when their Situation is selected.
    for (const [name, target, base, label, value] of [
      ['Dragon Slayer', 'ac.other', 'ac', 'dragons', 2],
      ['Dragon Slayer', 'attack.melee', 'attack', 'dragons', 1],
      ['Self-Made Fate', 'save.will', 'saves', 'divine spells', 2],
      ['Evader (Gloomkin)', 'skill.ste', 'skill.ste', 'underground', 1],
      ['Evader (Gloomkin)', 'skill.sur', 'skill.sur', 'becoming lost', 5],
      ['Inured', 'save.will', 'save.will', 'sanity', 4],
      ['Shadowplay', 'casterLevel', 'casterLevel', 'shadow descriptor', 1],
      ['Practicality', 'save.ref', 'saves', 'illusions', 2],
      ['Voice in the Darkness (Half-Elf)', 'skill.int', 'skill.int', 'dim', 2],
      ['Voice in the Darkness (Half-Elf)', 'skill.ste', 'skill.ste', 'dim', 2],
      ['Jungle Affinity', 'skill.ste', 'skill.ste', 'jungle', 4],
      ['Wayfarer', 'skill.sur', 'skill.sur', 'becoming lost', 2],
      ['Psychic Defense', 'save.will', 'saves', 'psychic', 2],
      ['Deep Magic', 'casterLevel', 'casterLevel', 'dispel', 2],
      ['Hypnotic', 'spellDC', 'spellDC', 'fascinated', 1],
    ] as const) {
      const index = indexOf(name, base, label);
      expect(resolved(name, target), `${name} ${target}`).toBe(0);
      expect(resolved(name, target, [index]), `${name} ${target}`).toBe(value);
    }
  });

  it("Woodcraft's imported +1 racial improves to +2 in forest terrain: one racial bonus per entry, so the stronger applies (not +3)", () => {
    // Woodcraft's imported +1 racial improves to +2 in forest terrain: one
    // racial bonus per entry, so the stronger applies (not +3).
    for (const target of ['skill.kna', 'skill.sur'] as const) {
      const forest = indexOf('Woodcraft', target, 'forest');
      expect(resolved('Woodcraft', target), target).toBe(1);
      expect(resolved('Woodcraft', target, [forest]), target).toBe(2);
    }
  });

  it("shared Situations only where the body's condition matches exactly", () => {
    // Shared Situations only where the body's condition matches exactly.
    for (const [name, shared, target, value] of [
      ['Alert for Betrayal', 'illusions', 'save.will', 2],
      ['Deep Magic', 'spellResistance', 'casterLevel', 2],
      ['Aphorite Resistances', 'poison', 'save.fort', 2],
      ['Aphorite Resistances', 'mindAffecting', 'save.will', 2],
      ['Pride', 'mindAffecting', 'save.will', 2],
      ['Resistant', 'poison', 'save.fort', 2],
    ] as const) {
      const index = modifiers(name).findIndex(
        (row) => row.condition?.situation === shared,
      );
      expect(index, `${name} ${shared}`).toBeGreaterThanOrEqual(0);
      expect(resolved(name, target), name).toBe(0);
      expect(resolved(name, target, [index]), name).toBe(value);
    }
  });

  it("Aphorite Resistances' poison and mind-affecting bonuses are one untyped bonus on one entry: they do not add", () => {
    // Aphorite Resistances' poison and mind-affecting bonuses are one untyped
    // bonus on one entry: they do not add.
    expect(resolved('Aphorite Resistances', 'save.will', [0, 1])).toBe(2);
    expect(modifiers('Aphorite Resistances')).toMatchObject([
      { target: 'saves', bonusType: 'untyped', value: 2 },
      { target: 'saves', bonusType: 'untyped', value: 2 },
    ]);
  });

  it("racial bonuses from distinct Sources stack (PRD; character-sheet.ts): Wayfarer's +2 racial Survival to avoid becoming lost and Evader's +5 racial Survival to avoid becoming lost underground give +7 together", () => {
    // Racial bonuses from distinct Sources stack (PRD; character-sheet.ts):
    // Wayfarer's +2 racial Survival to avoid becoming lost and Evader's +5
    // racial Survival to avoid becoming lost underground give +7 together.
    const lost = indexOf('Wayfarer', 'skill.sur', 'becoming lost');
    const underground = indexOf('Evader (Gloomkin)', 'skill.sur', 'lost');
    const both = resolveSheet(
      [
        modifiers('Wayfarer')[lost]!,
        modifiers('Evader (Gloomkin)')[underground]!,
      ],
      {
        situations: [
          situation('Wayfarer', lost),
          situation('Evader (Gloomkin)', underground),
        ],
      },
    );
    expect(both['skill.sur'].total).toBe(7);
  });

  it('imported changes keep mapping; nothing is curated a second time', () => {
    // Imported changes keep mapping; nothing is curated a second time.
    for (const [name, target, value] of [
      ['Intimidating', 'skill.int', 2],
      ['Keen Senses (Elf)', 'skill.per', 2],
      ['Woodcraft', 'skill.kna', 1],
      ['Woodcraft', 'skill.sur', 1],
      ['Alternate Skill Modifiers (Skinwalker - Aerieborn)', 'skill.sen', 2],
      ['Alternate Skill Modifiers (Skinwalker - Aerieborn)', 'skill.per', 2],
      ['Skilled (Aasimar - Idyllkin)', 'skill.han', 2],
      ['Skilled (Aasimar - Idyllkin)', 'skill.sur', 2],
      ['Practicality', 'skill.sen', 2],
      ['Defensive Training (Kasatha)', 'ac.other', 2],
      ['Tough', 'save.fort', 1],
      ['Wayfarer', 'skill.kge', 2],
      ['Wayfarer', 'skill.klo', 2],
    ] as const)
      expect(resolved(name, target), `${name} ${target}`).toBe(value);
  });

  it("the half-orc's +2 to one ability score stays the importer's mapped choice Modifier (#721)", () => {
    // The half-orc's +2 to one ability score stays the importer's mapped
    // choice Modifier (#721).
    expect(entry('+2 to One Ability Score (Half-Orc)').modifiers).toEqual([
      { target: 'ability.$choice', bonusType: 'racial', value: 2 },
    ]);
  });

  it("Slag May's +1 racial melee damage: a reviewed Modifier for the unmapped raw mdamage change, on its Subrace Standard part only", () => {
    // Slag May's +1 racial melee damage: a reviewed Modifier for the unmapped
    // raw mdamage change, on its Subrace Standard part only.
    expect(
      modifiers('Hag Racial Trait (Changeling - Slag May)').map((row) => [
        row.target,
        row.bonusType,
        row.value,
      ]),
    ).toEqual([['damage.melee', 'racial', 1]]);
    expect(
      resolved('Hag Racial Trait (Changeling - Slag May)', 'damage.melee'),
    ).toBe(1);
  });

  it("Pyromaniac adds no spell DC or caster level Modifier (racial-traits-719 pins that it removes the gnome's illusion DC); standard traits of #719 races, latent overlaps, the hag option filed as a standard trait and the ethnicities stay without reviewed Modifiers", () => {
    // Pyromaniac adds no spell DC or caster level Modifier (racial-traits-719
    // pins that it removes the gnome's illusion DC); standard traits of #719
    // races, latent overlaps, the hag option filed as a standard trait and the
    // ethnicities stay without reviewed Modifiers.
    for (const name of [
      'Pyromaniac',
      'Hag Racial Trait (Changeling - Frostlaced Flesh)',
      'Undead Resistance',
      'Languages (Ghoran)',
      'Paraheen Dwarves',
      'Bleachlings',
      'First World Gnomes',
      'Darklands Half-Orcs (Gloomkin)',
      'Mute-Born (Sorrow May)',
    ])
      expect(entry(name).modifiers, name).toEqual([]);
  });

  it("Pride and Resistant keep their race's re-homed note Modifiers", () => {
    // Pride and Resistant keep their race's re-homed note Modifiers.
    expect(entry('Pride').modifiers).toEqual([
      {
        target: 'saves',
        bonusType: 'racial',
        value: 2,
        condition: { situation: 'mindAffecting' },
      },
    ]);
    expect(entry('Resistant').modifiers).toEqual([
      {
        target: 'saves',
        bonusType: 'racial',
        value: 2,
        condition: { situation: 'mindAffecting' },
      },
      {
        target: 'saves',
        bonusType: 'racial',
        value: 2,
        condition: { situation: 'poison' },
      },
    ]);
  });

  it("dodge bonuses go on ac, never on ac.other's armor types", () => {
    // Dodge bonuses go on ac, never on ac.other's armor types.
    for (const name of ['Dragon Slayer', 'Defensive Training (Kasatha)'])
      expect(
        modifiers(name).filter((row) => row.target === 'ac'),
        name,
      ).toMatchObject([{ bonusType: 'dodge', value: 2 }]);
  });

  it('no armor, shield or natural armor bonus sits on ac.other', () => {
    // No armor, shield or natural armor bonus sits on ac.other.
    for (const row of batchEntries)
      for (const modifier of row.modifiers)
        if (['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType))
          expect(modifier.target, row.name).not.toBe('ac.other');
  });

  // Rule fields of the batch review's named entries in
  // racial-traits-396.test.ts:402,
  // a proof block whose record checks stay with the unit (fix r2).
  it("keeps the named traits' Notes on their statistics or at entry level and the weapon proficiencies the batch maps (racial-traits-396.test.ts:402)", () => {
    for (const name of [
      'Pyromaniac',
      'Fire Insight',
      'Energy Strike (Cold)',
      'Special Qualities',
      'Aphorite Resistances',
      'Jungle Affinity',
    ])
      expect(
        entry(name)
          .situationalNotes?.filter((note) => note.target)
          .map((note) => note.target),
        name,
      ).toEqual([]);
    for (const [name, targets] of [
      ['Wayfarer', ['skill.lin']],
      ['Light Blindness (Sahuagin)', ['attack', 'skill.per']],
      ['Hag Racial Trait (Changeling - Frostlaced Flesh)', ['saves']],
    ] as const)
      expect(
        entry(name)
          .situationalNotes?.filter((note) => note.target)
          .map((note) => note.target)
          .sort(),
        name,
      ).toEqual(targets);
    // No trait of the batch's list maps a weapon proficiency.
    expect(batchEntries).toHaveLength(77);
    for (const row of batchEntries)
      expect(row.proficiencies ?? [], row.name).toEqual([]);
  });

  // The replacement fields in
  // racial-traits-396.test.ts:684, proof blocks whose record checks stay
  // with the unit (fix r2).
  it("reads the batch's unresolved replacement names and the named traits' replaced traits (racial-traits-396.test.ts:684)", () => {
    // The batch's list: each trait that keeps a replacement name unresolved,
    // with those names; every other trait resolves all of its replacements.
    expect(batchEntries).toHaveLength(77);
    const unresolved = Object.fromEntries(
      batchEntries
        .filter((row) => row.detail.unresolvedReplacements?.length)
        .map((row) => [row.externalKey, row.detail.unresolvedReplacements]),
    );
    expect(unresolved).toEqual({
      'pf1-content/UvWpHqJHIyUkValD': ['Base Statistics'], // Paraheen Dwarves
      'pf1-content/W199gG02chF53jD4': ['Base Statistics'], // Mute-Born (Sorrow May)
      'pf1-content/W84vzbaWfDxNW2hr': ['Base Statistics'], // Bleachlings
      'pf1-content/Wi9RMrZnkVkKMKNF': ['Base Statistics'], // First World Gnomes
    });
    expect(entry('Pyromaniac').detail.replaces).toEqual([
      'pf1-content/MiPbhGqPRX7H4C7a',
      'pf1-content/YHwpeek5IHtcZNDF',
    ]);
    expect(entry('Poison Minion (Gnome)').detail.replaces).toHaveLength(3);
    for (const name of [
      'Azata-Blooded (Musetouched)',
      'Kyton-Spawn (Shackleborn)',
      'Sunsoul (Solar Ifrit)',
    ])
      expect(entry(name).detail.unresolvedReplacements ?? [], name).toEqual([]);
  });
});

describe('the racial-traits-397 keys', () => {
  const {
    batchEntries,
    entry,
    modifiers,
    indexOf,
    resolved,
    racialTraitSheet,
    identityRace,
    total,
  } = racialTraitBatch(entries, 'racial-traits-397');
  it("Gemsoul (Crystal Oread) replaces the oread's ability score trait: the oread's +2 Strength, +2 Wisdom and -2 Charisma go dormant and the curated heritage line (+2 Strength, +2 Charisma, -2 Wisdom) applies", () => {
    // Gemsoul (Crystal Oread) replaces the oread's ability score trait: the
    // oread's +2 Strength, +2 Wisdom and -2 Charisma go dormant and the curated
    // heritage line (+2 Strength, +2 Charisma, -2 Wisdom) applies.
    const gemsoul = entry('Gemsoul (Crystal Oread)');
    const oread = gemsoul.detail.raceKeys?.[0];
    if (!oread) throw new Error('Gemsoul has no race');
    expect(oread).toBe('pf1/4qEXPDlfIj1cIvCe');
    const ability = raceAbilityTraitKey(oread);
    expect(gemsoul.detail.replaces).toEqual([ability]);
    const magic = 'pf1-content/b7b9LL5pcA63eOv1';
    const plain = identityRace(racialTraitSheet({}), oread, [ability, magic]);
    const crystal = identityRace(
      racialTraitSheet({ traits: [gemsoul.externalKey] }),
      oread,
      [ability, magic],
    );
    for (const [target, before, after] of [
      ['ability.str', 12, 12],
      ['ability.wis', 12, 8],
      ['ability.cha', 8, 12],
    ] as const) {
      expect(total(plain, target), `Oread ${target}`).toBe(before);
      expect(total(crystal, target), `Gemsoul ${target}`).toBe(after);
    }
  });

  it("Werebear-Kin's curated line: +2 Constitution, -2 Charisma (its +2 Wisdom while shapechanged stays readable)", () => {
    // Werebear-Kin's curated line: +2 Constitution, -2 Charisma (its +2 Wisdom
    // while shapechanged stays readable).
    expect(
      modifiers('Werebear-Kin (Coldborn)').map((row) => [
        row.target,
        row.bonusType,
        row.value,
      ]),
    ).toEqual([
      ['ability.con', 'racial', 2],
      ['ability.cha', 'racial', -2],
    ]);
    expect(entry('Werebear-Kin (Coldborn)').detail.replaces?.[0]).toMatch(
      /^local\/race-ability-scores\//,
    );
  });

  it('situational bonuses apply only when their Situation is selected', () => {
    // Situational bonuses apply only when their Situation is selected.
    for (const [name, target, base, label, value] of [
      ['Voice in the Darkness (Dwarf)', 'skill.int', 'skill.int', 'dim', 2],
      ['Voice in the Darkness (Dwarf)', 'skill.ste', 'skill.ste', 'dim', 2],
      ['Keeper of Secrets', 'skill.blf', 'skill.blf', 'cover up', 2],
      ['Keeper of Secrets', 'skill.lin', 'skill.lin', 'cover up', 2],
      ['Keeper of Secrets', 'spellDC', 'spellDC', 'humanoids', 1],
      ['Giant Hunter', 'attack.melee', 'attack', 'giant subtype', 1],
      ['Giant Hunter', 'skill.sur', 'skill.sur', 'tracks', 2],
      ['Spiritual Support', 'casterLevel', 'casterLevel', 'healing', 1],
      ['Barrow Warden', 'ac.other', 'ac', 'undead', 1],
      ['Barrow Warden', 'attack.melee', 'attack', 'undead', 1],
      ['Arcane Focus', 'concentration', 'concentration', 'defensively', 2],
      ['Surfacer Antagonist', 'attack.ranged', 'attack', 'humans', 1],
      ['Shadow Magic (Fetchling)', 'spellDC', 'spellDC', 'shadow', 1],
      ['Whispers from Shadow', 'skill.blf', 'skill.blf', 'lie', 4],
      ['Mountain-Born', 'skill.acr', 'skill.acr', 'ledges', 2],
      ['Mountain-Born', 'save.fort', 'saves', 'altitude', 2],
      ['Heavenborn', 'casterLevel', 'casterLevel', 'good or light', 1],
      ['Neglected Heritage', 'skill.dip', 'skill.dip', 'requests', 1],
      [
        'Hag Racial Trait (Changeling - Moon May)',
        'save.fort',
        'saves',
        'disease',
        2,
      ],
    ] as const) {
      const index = indexOf(name, base, label);
      expect(resolved(name, target), `${name} ${target}`).toBe(0);
      expect(resolved(name, target, [index]), `${name} ${target}`).toBe(value);
    }
  });

  it("the published types: Giant Hunter, Surfacer Antagonist and Barrow Warden's attack bonus are untyped, Barrow Warden's AC bonus is dodge", () => {
    // The published types: Giant Hunter, Surfacer Antagonist and Barrow
    // Warden's attack bonus are untyped, Barrow Warden's AC bonus is dodge.
    for (const [name, target, type] of [
      ['Giant Hunter', 'attack', 'untyped'],
      ['Giant Hunter', 'skill.sur', 'untyped'],
      ['Surfacer Antagonist', 'attack', 'untyped'],
      ['Barrow Warden', 'attack', 'untyped'],
      ['Barrow Warden', 'ac', 'dodge'],
      ['Voice in the Darkness (Dwarf)', 'skill.int', 'untyped'],
    ] as const)
      expect(
        modifiers(name).find((row) => row.target === target)?.bonusType,
        `${name} ${target}`,
      ).toBe(type);
  });

  it("shared Situations only where the body's condition matches exactly: the re-homed race note outputs of Illusion Resistance and Drow Immunities", () => {
    // Shared Situations only where the body's condition matches exactly: the
    // re-homed race note outputs of Illusion Resistance and Drow Immunities.
    for (const [name, shared, target, value] of [
      ['Illusion Resistance', 'illusions', 'save.will', 2],
      ['Drow Immunities', 'enchantment', 'save.will', 2],
    ] as const) {
      const index = modifiers(name).findIndex(
        (row) => row.condition?.situation === shared,
      );
      expect(index, `${name} ${shared}`).toBeGreaterThanOrEqual(0);
      expect(resolved(name, target), name).toBe(0);
      expect(resolved(name, target, [index]), name).toBe(value);
    }
  });

  it("racial bonuses from distinct Sources stack (PRD; character-sheet.ts): Slag Child's and Abandoned's +2 racial Stealth give +4 together", () => {
    // Racial bonuses from distinct Sources stack (PRD; character-sheet.ts):
    // Slag Child's and Abandoned's +2 racial Stealth give +4 together.
    const both = resolveSheet(
      [...modifiers('Slag Child'), ...modifiers('Abandoned')].filter(
        (row) => row.target === 'skill.ste',
      ),
      { situations: [] },
    );
    expect(both['skill.ste'].total).toBe(4);
  });

  it('imported changes keep mapping; nothing is curated a second time', () => {
    // Imported changes keep mapping; nothing is curated a second time.
    for (const [name, target, value] of [
      ['Keen Senses (Halfling)', 'skill.per', 2],
      ['Keen Senses (Triaxian)', 'skill.per', 2],
      ['Abandoned', 'skill.ste', 2],
      ['Abandoned', 'skill.sur', 2],
      ['Slag Child', 'skill.ste', 2],
      ['Slag Child', 'skill.sur', 2],
      ['Fey-Quickened', 'init', 2],
      ['Shadow Agent', 'skill.blf', 2],
      ['Shadow Agent', 'skill.dip', 2],
      ['World Walker', 'skill.kna', 1],
      ['World Walker', 'skill.klo', 1],
      ['World Walker', 'skill.ste', 2],
      ['Nimble (Strix)', 'save.ref', 1],
      ['Truespeaker', 'skill.lin', 2],
      ['Truespeaker', 'skill.sen', 2],
      ['Heavenborn', 'skill.kpl', 2],
      ['Skilled (Aasimar - Musetouched)', 'skill.dip', 2],
      ['Skilled (Aasimar - Musetouched)', 'skill.prf', 2],
      ['Granite Skin', 'ac.natural', 1],
      ['Emotionless', 'skill.sen', -4],
    ] as const)
      expect(resolved(name, target), `${name} ${target}`).toBe(value);
  });

  it('the alternates whose ability changes a reviewed rule maps (#721)', () => {
    // The alternates whose ability changes a reviewed rule maps (#721).
    expect(entry('Keen Kitsune').modifiers).toEqual([
      { target: 'ability.dex', bonusType: 'racial', value: 2 },
      { target: 'ability.int', bonusType: 'racial', value: 2 },
      { target: 'ability.str', bonusType: 'racial', value: -2 },
    ]);
    expect(entry('Tree-Born').modifiers).toEqual([
      { target: 'ability.dex', bonusType: 'racial', value: 2 },
      { target: 'ability.cha', bonusType: 'racial', value: 2 },
    ]);
  });

  it("the re-homed race description outputs (#719): Kitsune Magic's and Shadow Magic (Wayang)'s spell DCs", () => {
    // The re-homed race description outputs (#719): Kitsune Magic's and
    // Shadow Magic (Wayang)'s spell DCs.
    expect(entry('Kitsune Magic').modifiers).toEqual([
      {
        target: 'spellDC',
        bonusType: 'untyped',
        value: 1,
        condition: { school: 'enchantment' },
      },
    ]);
    expect(entry('Shadow Magic (Wayang)').modifiers).toMatchObject([
      { target: 'spellDC', bonusType: 'untyped', value: 1 },
    ]);
  });

  it('standard traits of #719 races, latent overlaps, ethnicities, racial subtypes and rules the sheet cannot model stay without reviewed Modifiers', () => {
    // Standard traits of #719 races, latent overlaps, ethnicities, racial
    // subtypes and rules the sheet cannot model stay without reviewed
    // Modifiers.
    for (const name of [
      'Duergar Immunities',
      'Mental Potency',
      'Light Dependent',
      'Plant',
      'Languages (Halfling)',
      'Languages (Gnome)',
      'Senses (Svirfneblin)',
      'Aberration',
      'Slow Speed (Grindylow)',
      'Adaptable Luck',
      'Shadow Sorcery',
      'Scion of Shadows',
      'Dragon',
      'Variant Aasimar Abilities',
      'Savage Elf',
      'Mountain Dwarf',
      'Snowcaster Elves',
      'Sky Citadel Dwarves',
      'Ekujae Half-Elves (Wildborn)',
      'Ferocity (Green Martian)',
      'pf1-content/ZP4KHOyP79pyrBpj' /* Warded Skin (Rainkin) */,
    ])
      expect(entry(name).modifiers, name).toEqual([]);
  });

  it("dodge bonuses go on ac, never on ac.other's armor types", () => {
    // Dodge bonuses go on ac, never on ac.other's armor types.
    expect(
      modifiers('Barrow Warden').filter((row) => row.target === 'ac'),
    ).toMatchObject([{ bonusType: 'dodge', value: 1 }]);
  });

  it('no armor, shield or natural armor bonus sits on ac.other', () => {
    // No armor, shield or natural armor bonus sits on ac.other.
    for (const row of batchEntries)
      for (const modifier of row.modifiers)
        if (['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType))
          expect(modifier.target, row.name).not.toBe('ac.other');
  });

  // Rule fields of the batch review's named entries in
  // racial-traits-397.test.ts:385,
  // a proof block whose record checks stay with the unit (fix r2).
  it("keeps the named traits' Notes on their statistics or at entry level and the weapon proficiencies the batch maps (racial-traits-397.test.ts:385)", () => {
    for (const name of [
      'Adaptable Luck',
      'Shadow Sorcery',
      'Mental Potency',
      'pf1-content/ZP4KHOyP79pyrBpj' /* Warded Skin (Rainkin) */,
      'Scion of Shadows',
      'Dragon',
      'Duergar Immunities',
      'Ferocity (Green Martian)',
    ])
      expect(
        entry(name)
          .situationalNotes?.filter((note) => note.target)
          .map((note) => note.target),
        name,
      ).toEqual([]);
    for (const [name, targets] of [
      ['Dusksight (Elf)', ['attack.ranged']],
      ['Creepy Doll', ['skill.int', 'skill.ste']],
    ] as const)
      expect(
        entry(name)
          .situationalNotes?.filter((note) => note.target)
          .map((note) => note.target)
          .sort(),
        name,
      ).toEqual(targets);
    // No trait of the batch's list maps a weapon proficiency.
    expect(batchEntries).toHaveLength(82);
    for (const row of batchEntries)
      expect(row.proficiencies ?? [], row.name).toEqual([]);
  });

  // The replacement fields in
  // racial-traits-397.test.ts:691 and :559, proof blocks whose record checks stay
  // with the unit (fix r2).
  it("reads the batch's unresolved replacement names, the named traits' replaced traits and the race placement it names (racial-traits-397.test.ts:691)", () => {
    // The batch's list: each trait that keeps a replacement name unresolved,
    // with those names; every other trait resolves all of its replacements.
    expect(batchEntries).toHaveLength(82);
    const unresolved = Object.fromEntries(
      batchEntries
        .filter((row) => row.detail.unresolvedReplacements?.length)
        .map((row) => [row.externalKey, row.detail.unresolvedReplacements]),
    );
    expect(unresolved).toEqual({
      'pf1-content/YIkZ9egduASu6nLh': ['Base Statistics'], // Savage Elf
      'pf1-content/Ym8MKzritdKsuKGX': ['Base Statistics'], // Mountain Dwarf
      'pf1-content/YsUd35wRZBO17r05': ['Base Statistics'], // Ekujae Half-Elves (Wildborn)
      'pf1-content/aR6GbtT8EtOqN1XR': ['Base Statistics'], // Snowcaster Elves
      'pf1-content/afX2SurqCJrV7f4B': ['Solar Affinity (Ifrit - Sunsoul)'], // Solar Affinity (Ifrit - Sunsoul)
      'pf1-content/auhlm92jQNA1fE1k': ['Base Statistics'], // Sky Citadel Dwarves
      'pf1-content/b8mD388daeaoKidm': ['Natural Armor', 'Spell-Like Ability'], // Natural Bounty
    });
    expect(entry('Breath Weapon (Dwarf)').detail.replaces).toHaveLength(4);
    expect(entry('Spiritual Support').detail.replaces).toHaveLength(2);
    expect(entry('Tree-Born').detail.replaces).toEqual([
      'pf1-content/7IMx5MBTrYTOhTnf',
      'pf1-content/lhDGN1bu2IsaabX4',
    ]);
    expect(entry('Mountain-Born').detail.replaces).toEqual([
      'pf1-content/b7b9LL5pcA63eOv1',
    ]);
    for (const name of ['Gemsoul (Crystal Oread)', 'Werebear-Kin (Coldborn)'])
      expect(entry(name).detail.unresolvedReplacements ?? [], name).toEqual([]);
    // Its folder binds no race record.
    expect(entry('Lashunta Magic').detail.raceKeys).toEqual([]);
  });
});

describe('the racial-traits-398 keys', () => {
  const {
    batchEntries,
    entry,
    modifiers,
    indexOf,
    resolved,
    racialTraitSheet,
    identityRace,
    total,
  } = racialTraitBatch(entries, 'racial-traits-398');
  it("Werewolf-Kin (Witchwolf) replaces the skinwalker's ability score trait: the skinwalker's +2 Wisdom and -2 Intelligence go dormant and the curated heritage line (+2 Constitution, -2 Intelligence) applies", () => {
    // Werewolf-Kin (Witchwolf) replaces the skinwalker's ability score trait:
    // the skinwalker's +2 Wisdom and -2 Intelligence go dormant and the curated
    // heritage line (+2 Constitution, -2 Intelligence) applies.
    const witchwolf = entry('Werewolf-Kin (Witchwolf)');
    const skinwalker = witchwolf.detail.raceKeys?.[0];
    if (!skinwalker) throw new Error('Werewolf-Kin has no race');
    expect(skinwalker).toBe('pf1/apWl6JIJ8U8p0azq');
    const ability = raceAbilityTraitKey(skinwalker);
    expect(witchwolf.detail.replaces).toEqual([ability]);
    const minded = 'pf1-content/bPkht5w4AKauP8Ip';
    const plain = identityRace(racialTraitSheet({}), skinwalker, [
      ability,
      minded,
    ]);
    const wolf = identityRace(
      racialTraitSheet({ traits: [witchwolf.externalKey] }),
      skinwalker,
      [ability, minded],
    );
    for (const [target, before, after] of [
      ['ability.con', 10, 12],
      ['ability.int', 8, 8],
      ['ability.wis', 12, 10],
    ] as const) {
      expect(total(plain, target), `Skinwalker ${target}`).toBe(before);
      expect(total(wolf, target), `Werewolf-Kin ${target}`).toBe(after);
    }
    expect(
      modifiers('Werewolf-Kin (Witchwolf)').map((row) => [
        row.target,
        row.bonusType,
        row.value,
      ]),
    ).toEqual([
      ['ability.con', 'racial', 2],
      ['ability.int', 'racial', -2],
    ]);
  });

  it('situational bonuses apply only when their Situation is selected', () => {
    // Situational bonuses apply only when their Situation is selected.
    for (const [name, target, base, label, value] of [
      ['Ageless Patience', 'skill.acr', 'skills', 'taking 20', 2],
      ['Pariah', 'save.will', 'saves', 'emotion and fear', 2],
      ['One of the Multitude', 'skill.blf', 'skill.blf', 'humanoids', 1],
      ['One of the Multitude', 'skill.ste', 'skill.ste', 'humanoids', 1],
      ['One of the Multitude', 'attack.melee', 'attack', 'flanking', 1],
      ['Human Shadow', 'skill.slt', 'skill.slt', 'human', 2],
      ['Human Shadow', 'skill.ste', 'skill.ste', 'human', 2],
      ['Unexpected Ally', 'skill.dip', 'skill.dip', 'attitude', 2],
      ['Unexpected Ally', 'attack.melee', 'attack', 'aid another', 1],
      ['Unexpected Ally', 'skill.per', 'skills', 'aid another', 1],
      ['Disgusting', 'cmb', 'cmb', 'grab', 2],
      ['Disgusting', 'skill.esc', 'skill.esc', 'grab', 2],
      ['Pit Boss', 'cmb', 'cmb', 'whip', 1],
      ['Heart of the Sea', 'concentration', 'concentration', 'underwater', 4],
      ['Heart of the Sea', 'skill.pro', 'skill.pro', 'sailor', 2],
      ['War-Leader', 'skill.pro', 'skill.pro', 'soldier', 2],
      [
        'Alternate Weakness (Dhampir - Ajibachana)',
        'casterLevel',
        'casterLevel',
        'holy',
        -1,
      ],
    ] as const) {
      const index = indexOf(name, base, label);
      expect(resolved(name, target), `${name} ${target}`).toBe(0);
      expect(resolved(name, target, [index]), `${name} ${target}`).toBe(value);
    }
  });

  it("Attentive: the imported +2 racial Sense Motive rises to the published +4 in its Situation (one entry's racial bonuses do not stack)", () => {
    // Attentive: the imported +2 racial Sense Motive rises to the published +4
    // in its Situation (one entry's racial bonuses do not stack).
    const attentive = indexOf('Attentive', 'skill.sen', 'enchanted');
    expect(resolved('Attentive', 'skill.sen')).toBe(2);
    expect(resolved('Attentive', 'skill.sen', [attentive])).toBe(4);
  });

  it("the published types: War-Leader's Profession and Unexpected Ally's Diplomacy bonuses are untyped", () => {
    // The published types: War-Leader's Profession and Unexpected Ally's
    // Diplomacy bonuses are untyped.
    for (const [name, target, type] of [
      ['War-Leader', 'skill.pro', 'untyped'],
      ['Unexpected Ally', 'skill.dip', 'untyped'],
      ['Alternate Weakness (Dhampir - Ajibachana)', 'casterLevel', 'untyped'],
    ] as const)
      expect(
        modifiers(name).find((row) => row.target === target)?.bonusType,
        `${name} ${target}`,
      ).toBe(type);
  });

  it("shared Situations only where the body's condition matches exactly: the re-homed race note outputs of Elven Magic", () => {
    // Shared Situations only where the body's condition matches exactly: the
    // re-homed race note outputs of Elven Magic.
    for (const [name, shared, target, value] of [
      ['Elven Magic (Elf)', 'spellResistance', 'casterLevel', 2],
      ['Elven Magic (Elf)', 'identifyMagicItems', 'skill.spl', 2],
    ] as const) {
      const index = modifiers(name).findIndex(
        (row) => row.condition?.situation === shared,
      );
      expect(index, `${name} ${shared}`).toBeGreaterThanOrEqual(0);
      expect(resolved(name, target), name).toBe(0);
      expect(resolved(name, target, [index]), name).toBe(value);
    }
  });

  it("Nocturnal (Strix) carries the Strix race's re-homed note outputs", () => {
    // Nocturnal (Strix) carries the Strix race's re-homed note outputs.
    expect(entry('Nocturnal (Strix)').modifiers).toEqual(
      ['skill.per', 'skill.ste'].map((target) => ({
        target,
        bonusType: 'racial',
        value: 2,
        condition: { situation: { local: 'in dim light or darkness' } },
      })),
    );
  });

  it("racial bonuses from distinct Sources stack (PRD; character-sheet.ts): Clever Cat's and Attentive's +2 racial Sense Motive give +4 together", () => {
    // Racial bonuses from distinct Sources stack (PRD; character-sheet.ts):
    // Clever Cat's and Attentive's +2 racial Sense Motive give +4 together.
    const both = resolveSheet(
      [...modifiers('Clever Cat'), ...modifiers('Attentive')].filter(
        (row) => row.target === 'skill.sen' && !row.condition,
      ),
      { situations: [] },
    );
    expect(both['skill.sen'].total).toBe(4);
  });

  it('imported changes keep mapping; nothing is curated a second time', () => {
    // Imported changes keep mapping; nothing is curated a second time.
    for (const [name, target, value] of [
      ['Sovyrian-Born', 'skill.khi', 2],
      ['Sovyrian-Born', 'skill.klo', 2],
      ['Sovyrian-Born', 'skill.spl', 2],
      ['Clever Cat', 'skill.blf', 2],
      ['Clever Cat', 'skill.dip', 2],
      ['Clever Cat', 'skill.sen', 2],
      ['Vestigal Wings', 'skill.acr', 2],
      ['Vestigal Wings', 'skill.clm', 2],
      ['Pariah', 'skill.blf', -2],
      ['Pariah', 'skill.dip', -2],
      ['Pariah', 'skill.sen', -2],
      ['War-Leader', 'skill.dip', 2],
      ['Heart of the Sea', 'skill.swm', 2],
      ['Skilled (Tiefling - Shackleborn)', 'skill.esc', 2],
      ['Skilled (Tiefling - Shackleborn)', 'skill.int', 2],
      ['Alternate Skill Modifiers (Dhampir - Svetocher)', 'skill.dip', 2],
      ['Alternate Skill Modifiers (Dhampir - Svetocher)', 'skill.kno', 2],
      ['Alternate Skill Modifiers (Dhampir - Ajibachana)', 'skill.esc', 2],
      ['Alternate Skill Modifiers (Dhampir - Ajibachana)', 'skill.umd', 2],
      ['Agile (Kitsune)', 'skill.acr', 2],
      ['Animal-Minded', 'skill.han', 2],
      ['Ability Scores (Vine Leshy)', 'ability.con', 2],
      ['Ability Scores (Vine Leshy)', 'ability.wis', 2],
      ['Ability Scores (Vine Leshy)', 'ability.int', -2],
    ] as const)
      expect(resolved(name, target), `${name} ${target}`).toBe(value);
  });

  it('standard traits of #719 races, types, languages, senses, racial subtypes and rules the sheet cannot model stay without reviewed Modifiers', () => {
    // Standard traits of #719 races, types, languages, senses, racial
    // subtypes and rules the sheet cannot model stay without reviewed
    // Modifiers.
    for (const name of [
      'Weapon Familiarity (Halfling)',
      'Ink Cloud',
      'Stable Tentacles',
      'Seed',
      'Darkvision (Changeling)',
      'Darkvision (Aphorite)',
      'Languages (Trox)',
      'Languages (Goblin)',
      'Languages (Hobgoblin)',
      'Languages (Ratfolk)',
      'Languages (Yaddithian)',
      'Goblinoid (Goblin)',
      'Dwarf',
      'Native Outsider (Aasimar)',
      'Aquatic (Aquatic Elf)',
      'Defensive Abilities',
      'Telepathy',
      'Treasure Sense',
      'Smog Sight',
      'Retreat Magic',
      'Wyrmcrowned',
      'Mystic',
      'Avenging',
      'Cosmopolitan',
      'Poison Minion (Drow)',
      'Shadow Blending',
      'Desert Runner',
      'Maelstrom Resistance',
    ])
      expect(entry(name).modifiers, name).toEqual([]);
  });

  it('no armor, shield or natural armor bonus sits on ac.other', () => {
    // No armor, shield or natural armor bonus sits on ac.other.
    for (const row of batchEntries)
      for (const modifier of row.modifiers)
        if (['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType))
          expect(modifier.target, row.name).not.toBe('ac.other');
  });

  // Rule fields of the batch review's named entries in
  // racial-traits-398.test.ts:376,
  // a proof block whose record checks stay with the unit (fix r2).
  it("keeps the named traits' Notes on their statistics or at entry level and the weapon proficiencies the batch maps (racial-traits-398.test.ts:376)", () => {
    for (const name of [
      'Illustrious Urbanite',
      'Retreat Magic',
      'Smog Sight',
      'Cliffside Charger (Cragkin)',
      'Heart of the Sea',
      'Treasure Sense',
      'Eternal Smith',
      'Energy Strike (Electricity)',
      'Defensive Abilities',
      'Maelstrom Resistance',
      'Resist Level Drain (Shabti)',
    ])
      expect(
        entry(name)
          .situationalNotes?.filter((note) => note.target)
          .map((note) => note.target),
        name,
      ).toEqual([]);
    for (const [name, targets] of [
      ['Shadow Blending', ['ac']],
      ['Stable Tentacles', ['cmd']],
      ['Human Shadow', ['skill.ste']],
      ['Vestigal Wings', ['skill.acr']],
      ['Honey Whisperer', ['skill.han']],
      ['Animal-Minded', ['skill.dip']],
      ['Light Sensitivity (Dhampir)', ['attack', 'skill.per']],
    ] as const)
      expect(
        entry(name)
          .situationalNotes?.filter((note) => note.target)
          .map((note) => note.target)
          .sort(),
        name,
      ).toEqual(targets);
    const grants: Record<string, string[]> = {
      'Pit Boss': ['Whip'],
      'Weapon Familiarity (Halfling)': ['Sling'],
    };
    // Every trait of the batch's list maps the weapon proficiencies of this
    // table, and no other.
    expect(batchEntries).toHaveLength(77);
    for (const row of batchEntries)
      expect(
        (row.proficiencies ?? []).map((grant) =>
          'baseType' in grant ? grant.baseType : null,
        ),
        row.name,
      ).toEqual(grants[row.name] ?? []);
  });

  // The replacement fields in
  // racial-traits-398.test.ts:714, proof blocks whose record checks stay
  // with the unit (fix r2).
  it("reads the batch's unresolved replacement names and the named traits' replaced traits (racial-traits-398.test.ts:714)", () => {
    // The batch's list: each trait that keeps a replacement name unresolved,
    // with those names; every other trait resolves all of its replacements.
    expect(batchEntries).toHaveLength(77);
    const unresolved = Object.fromEntries(
      batchEntries
        .filter((row) => row.detail.unresolvedReplacements?.length)
        .map((row) => [row.externalKey, row.detail.unresolvedReplacements]),
    );
    expect(unresolved).toEqual({
      'pf1-content/bUnlzKQfFNF97MqX': ['Base Statistics'], // Mystic
      'pf1-content/dEtxdn5mLY5M3i45': [
        'Alternate Spell-Like Ability (Dhampir - Ru-Shi)',
      ], // Alternate Spell-Like Ability (Dhampir - Ru-Shi)
      'pf1-content/dQpQkqUUdP5QbbYn': ['Base Statistics'], // Avenging
      'pf1-content/eIkJlRpLALMQNc4J': ['Base Statistics'], // Cosmopolitan
    });
    expect(entry('War-Leader').detail.replaces).toHaveLength(2);
    expect(entry('Poison Minion (Drow)').detail.replaces).toHaveLength(4);
    expect(
      entry('Alternate Weakness (Dhampir - Ajibachana)').detail.replaces,
    ).toEqual(['pf1-content/eJIBuryG68v4PJLk']);
    expect(
      entry('Werewolf-Kin (Witchwolf)').detail.unresolvedReplacements ?? [],
    ).toEqual([]);
  });
});

describe('the racial-traits-399 keys', () => {
  const {
    batchEntries,
    entry,
    modifiers,
    indexOf,
    resolved,
    racialTraitSheet,
    identityRace,
    total,
  } = racialTraitBatch(entries, 'racial-traits-399');
  it("Demon-Spawn (Pitborn) and Moroi-Born (Svetocher) replace their race's ability score trait: the race's line goes dormant and the curated heritage line applies", () => {
    // Demon-Spawn (Pitborn) and Moroi-Born (Svetocher) replace their race's
    // ability score trait: the race's line goes dormant and the curated heritage
    // line applies.
    for (const [name, race, lines] of [
      [
        'Demon-Spawn (Pitborn)',
        'pf1/nVjKDLZSRONzYm8f', // Tiefling: +2 Dex, +2 Int, -2 Cha
        [
          ['ability.str', 10, 12],
          ['ability.dex', 12, 10],
          ['ability.int', 12, 8],
          ['ability.cha', 8, 12],
        ],
      ],
      [
        'Moroi-Born (Svetocher)',
        'pf1/puKk997wHX3kIRkR', // Dhampir: +2 Dex, +2 Cha, -2 Con
        [
          ['ability.str', 10, 12],
          ['ability.dex', 12, 10],
          ['ability.con', 8, 8],
          ['ability.cha', 12, 12],
        ],
      ],
    ] as const) {
      const heritage = entry(name);
      expect(heritage.detail.raceKeys).toEqual([race]);
      const ability = raceAbilityTraitKey(race);
      expect(heritage.detail.replaces, name).toEqual([ability]);
      expect(heritage.detail.unresolvedReplacements ?? [], name).toEqual([]);
      const plain = identityRace(racialTraitSheet({}), race, [ability]);
      const taken = identityRace(
        racialTraitSheet({ traits: [heritage.externalKey] }),
        race,
        [ability],
      );
      for (const [target, before, after] of lines) {
        expect(total(plain, target), `${name} race ${target}`).toBe(before);
        expect(total(taken, target), `${name} ${target}`).toBe(after);
      }
    }
    expect(
      modifiers('Demon-Spawn (Pitborn)').map((row) => [
        row.target,
        row.bonusType,
        row.value,
      ]),
    ).toEqual([
      ['ability.str', 'racial', 2],
      ['ability.cha', 'racial', 2],
      ['ability.int', 'racial', -2],
    ]);
  });

  it('situational bonuses apply only when their Situation is selected', () => {
    // Situational bonuses apply only when their Situation is selected.
    for (const [name, target, base, label, value] of [
      ['Stubborn', 'save.will', 'save.will', 'enchantment (charm)', 2],
      ['Warden of Nature', 'ac.other', 'ac', 'aberrations', 2],
      ['Warden of Nature', 'attack.melee', 'attack', 'aberrations', 1],
      ['Defensive Training (Drow)', 'ac.other', 'ac', 'aberrations', 4],
      ['Nosophobia', 'save.fort', 'save.fort', 'disease', 4],
      ['Heart of the Snows', 'cmd', 'cmd', 'trip', 2],
      ['Heart of the Snows', 'save.fort', 'save.fort', 'cold climates', 2],
      ['Heart of the Snows', 'save.ref', 'saves', 'slipping', 2],
      ['Heart of the Snows', 'skill.acr', 'skill.acr', 'slippery', 2],
      ['Heart of the Snows', 'skill.clm', 'skill.clm', 'slippery', 2],
      ['Architectural Ingenuity', 'skill.crf', 'skill.crf', 'structures', 2],
      ['Architectural Ingenuity', 'skill.per', 'skill.per', 'structures', 2],
      ['Dimdweller (Dwarf)', 'skill.int', 'skill.int', 'concealment', 2],
      ['Dimdweller (Dwarf)', 'skill.per', 'skill.per', 'concealment', 2],
      ['Dimdweller (Elf)', 'skill.ste', 'skill.ste', 'concealment', 2],
      ['Junk Tinker', 'skill.han', 'skill.han', 'driving', 2],
      ['Junk Tinker', 'skill.umd', 'skill.umd', 'driving', 2],
      ['Junk Tinker', 'skill.crf', 'skill.crf', 'proper tools', 2],
      ['Terrain Chameleon', 'skill.ste', 'skill.ste', 'underwater', 4],
      ['Deathless Spirit', 'save.will', 'saves', 'energy drain', 2],
      ['Deathless Spirit', 'save.fort', 'saves', 'necromancy', 2],
      ['Shadowhunter (Gnome)', 'save.fort', 'saves', 'negative levels', 2],
      ['Shadowhunter (Human)', 'save.will', 'saves', 'negative levels', 2],
      [
        'Hag Racial Trait (Changeling - Sorrow May)',
        'save.will',
        'saves',
        'gaze',
        2,
      ],
    ] as const) {
      const index = indexOf(name, base, label);
      expect(resolved(name, target), `${name} ${target}`).toBe(0);
      expect(resolved(name, target, [index]), `${name} ${target}`).toBe(value);
    }
  });

  it("shared Situations only where the body's condition matches exactly", () => {
    // Shared Situations only where the body's condition matches exactly.
    for (const [name, shared, target, value] of [
      ['Nosophobia', 'poison', 'save.fort', 4],
      ['Deathless Spirit', 'death', 'save.will', 2],
      ['Deathless Spirit', 'negativeEnergy', 'save.ref', 2],
    ] as const) {
      const index = modifiers(name).findIndex(
        (row) => row.condition?.situation === shared,
      );
      expect(index, `${name} ${shared}`).toBeGreaterThanOrEqual(0);
      expect(resolved(name, target), name).toBe(0);
      expect(resolved(name, target, [index]), name).toBe(value);
    }
  });

  it("the published types: Nosophobia's, Terrain Chameleon's, Warden of Nature's attack and Shadowhunter's save bonuses are untyped", () => {
    // The published types: Nosophobia's, Terrain Chameleon's, Warden of
    // Nature's attack and Shadowhunter's save bonuses are untyped.
    for (const [name, target, type] of [
      ['Nosophobia', 'save.fort', 'untyped'],
      ['Terrain Chameleon', 'skill.ste', 'untyped'],
      ['Warden of Nature', 'attack', 'untyped'],
      ['Warden of Nature', 'ac', 'dodge'],
      ['Defensive Training (Drow)', 'ac', 'dodge'],
      ['Shadowhunter (Gnome)', 'saves', 'untyped'],
      ['Stubborn', 'save.will', 'racial'],
    ] as const)
      expect(
        modifiers(name).find((row) => row.target === target)?.bonusType,
        `${name} ${target}`,
      ).toBe(type);
  });

  it("Re-homed race outputs: Nocturnal (Syrinx), Unassuming Foliage and the Reptoid's natural armor on Scales", () => {
    // Re-homed race outputs: Nocturnal (Syrinx), Unassuming Foliage and the
    // Reptoid's natural armor on Scales.
    expect(entry('Nocturnal (Syrinx)').modifiers).toEqual(
      ['skill.per', 'skill.ste'].map((target) => ({
        target,
        bonusType: 'racial',
        value: 2,
        condition: { situation: { local: 'at night' } },
      })),
    );
    expect(entry('Unassuming Foliage').modifiers).toEqual([
      {
        target: 'skill.ste',
        bonusType: 'racial',
        value: 4,
        condition: { situation: 'forests' },
      },
    ]);
    expect(
      modifiers('Scales').map((row) => [row.target, row.bonusType, row.value]),
    ).toEqual([['ac.natural', 'naturalArmor', 1]]);
  });

  it("racial bonuses from distinct Sources stack (PRD; character-sheet.ts): Natural Hunter's and Dimdweller's +2 racial Stealth give +4 together when Dimdweller's Situation is selected", () => {
    // Racial bonuses from distinct Sources stack (PRD; character-sheet.ts):
    // Natural Hunter's and Dimdweller's +2 racial Stealth give +4 together
    // when Dimdweller's Situation is selected.
    const stealth = [
      ...modifiers('Natural Hunter'),
      ...modifiers('Dimdweller (Elf)'),
    ].filter((row) => row.target === 'skill.ste');
    const dim = stealth.findIndex((row) => row.condition?.situation);
    const scope = stealth[dim]?.condition?.situation;
    if (!scope || typeof scope === 'string' || !('local' in scope))
      throw new Error('Expected a local Situation');
    expect(resolveSheet(stealth, { situations: [] })['skill.ste'].total).toBe(
      2,
    );
    expect(
      resolveSheet(stealth, {
        situations: [
          { local: scope.local, sheetEntryId: stealth[dim]!.sheetEntryId },
        ],
      })['skill.ste'].total,
    ).toBe(4);
  });

  it('imported changes keep mapping; nothing is curated a second time', () => {
    // Imported changes keep mapping; nothing is curated a second time.
    for (const [name, target, value] of [
      ['Natural Hunter', 'skill.per', 2],
      ['Natural Hunter', 'skill.ste', 2],
      ['Natural Hunter', 'skill.sur', 2],
      ['City Scavenger', 'skill.per', 2],
      ['City Scavenger', 'skill.sur', 2],
      ['Vestigial Wings', 'skill.fly', 4],
      ['Architectural Ingenuity', 'skill.ken', 2],
      ['Skilled (Aasimar - Lawbringers)', 'skill.int', 2],
      ['Skilled (Aasimar - Lawbringers)', 'skill.sen', 2],
      ['Ability Modifiers (Changeling - Slag May)', 'ability.str', 2],
      ['Ability Modifiers (Changeling - Slag May)', 'ability.cha', 2],
      ['Ability Modifiers (Changeling - Slag May)', 'ability.con', -2],
      ['Sneaky (Grindylow)', 'skill.ste', 4],
      ['Skilled (Svirfneblin)', 'skill.ste', 2],
      ['Skilled (Svirfneblin)', 'skill.per', 2],
    ] as const)
      expect(resolved(name, target), `${name} ${target}`).toBe(value);
  });

  it('standard traits of #719 races, types, languages, senses, speeds, racial subtypes and rules the sheet cannot model stay without reviewed Modifiers', () => {
    // Standard traits of #719 races, types, languages, senses, speeds, racial
    // subtypes and rules the sheet cannot model stay without reviewed
    // Modifiers.
    for (const name of [
      'Languages (Human)',
      'Light Sensitivity (Orc)',
      'Poison Use (Drow)',
      'Languages (Wayang)',
      'Languages (Nagaji)',
      'Languages (Triaxian)',
      'Languages (Reptoid)',
      'Languages (Vine Leshy)',
      'Languages (Drow)',
      'Languages (Kuru)',
      'Slow Speed (Monkey Goblin)',
      'Normal Speed (Hobgoblin)',
      'Sprinter (Catfolk)',
      'Fiendish Sprinter',
      'Strong Limbs',
      'Goblinoid (Hobgoblin)',
      'Darkvision (Being of Ib)',
      'Acute Darkvision',
      'Deep Gillman',
      'Detect Thoughts',
      'Toxic',
      'Swarming',
      'Verdant Burst',
      'Hatred (Strix)',
      'Hag Racial Trait (Changeling - Into the Wind)',
      '+2 to Strength, Dexterity, or Constitution',
      'Mostly Human (Undine)',
      'Pass for Human',
      'Titled',
      'Fey Resilience',
      'Expanded Oddities',
      'Mist Affinity (Undine - Mistsoul)',
      'Powerful Presence',
      'Wanderer',
      'Fey Magic (Dwarf)',
      'Weapon Familiarity (Half-Elf)',
      'Subtle Manipulator',
      'Jungle Half-Orcs (Rainkin)',
      'Dread Gnomes',
      'Gutter Rat',
      'Spell-Like Ability (Tiefling - Spitespawn)',
    ])
      expect(entry(name).modifiers, name).toEqual([]);
  });

  it('no armor, shield or natural armor bonus sits on ac.other', () => {
    // No armor, shield or natural armor bonus sits on ac.other.
    for (const row of batchEntries)
      for (const modifier of row.modifiers)
        if (['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType))
          expect(modifier.target, row.name).not.toBe('ac.other');
  });

  // Rule fields of the batch review's named entries in
  // racial-traits-399.test.ts:409,
  // a proof block whose record checks stay with the unit (fix r2).
  it("keeps the named traits' Notes on their statistics or at entry level and the weapon proficiencies the batch maps (racial-traits-399.test.ts:409)", () => {
    for (const name of [
      'Fiendish Sprinter',
      'Sprinter (Catfolk)',
      'Poison Use (Drow)',
      'Deep Gillman',
      'Fey Resilience',
    ])
      expect(
        entry(name)
          .situationalNotes?.filter((note) => note.target)
          .map((note) => note.target),
        name,
      ).toEqual([]);
    for (const [name, targets] of [
      ['Light Sensitivity (Orc)', ['attack', 'skill.per']],
      ['Swarming', ['attack']],
      ['City Scavenger', ['skill.sur']],
      ['Stubborn', ['save.will']],
      ['Heart of the Snows', ['save.fort']],
      ['Shadowhunter (Gnome)', ['attack']],
    ] as const)
      expect(
        entry(name)
          .situationalNotes?.filter((note) => note.target)
          .map((note) => note.target)
          .sort(),
        name,
      ).toEqual(targets);
    // No trait of the batch's list maps a weapon proficiency.
    expect(batchEntries).toHaveLength(71);
    for (const row of batchEntries)
      expect(row.proficiencies ?? [], row.name).toEqual([]);
  });

  // The replacement fields in
  // racial-traits-399.test.ts:745, proof blocks whose record checks stay
  // with the unit (fix r2).
  it("reads the batch's unresolved replacement names and the named traits' replaced traits (racial-traits-399.test.ts:745)", () => {
    // The batch's list: each trait that keeps a replacement name unresolved,
    // with those names; every other trait resolves all of its replacements.
    expect(batchEntries).toHaveLength(71);
    const unresolved = Object.fromEntries(
      batchEntries
        .filter((row) => row.detail.unresolvedReplacements?.length)
        .map((row) => [row.externalKey, row.detail.unresolvedReplacements]),
    );
    expect(unresolved).toEqual({
      'pf1-content/erHe11Qn4judzeI1': ['Languages', 'Subtype', 'Type'], // Mostly Human (Undine)
      'pf1-content/euX1ucchOBHkK62k': ['Feather Step Spell-Like Ability'], // Titled
      'pf1-content/fscyXaZvorGwGprq': ['Mist Affinity (Undine - Mistsoul)'], // Mist Affinity (Undine - Mistsoul)
      'pf1-content/g2iIRBrSeUhIkDvu': ['Languages', 'Subtype', 'Type'], // Pass for Human
      'pf1-content/gyvG87iDUG02oQmR': ['Base Statistics'], // Dread Gnomes
      'pf1-content/h1rqC3aTXHfUTOQl': ['Base Statistics'], // Gutter Rat
    });
    expect(entry('Defensive Training (Drow)').detail.replaces).toHaveLength(3);
    expect(entry('Architectural Ingenuity').detail.replaces).toHaveLength(2);
    expect(entry('Strong Limbs').detail.replaces).toHaveLength(2);
    expect(entry('Subtle Manipulator').detail.replaces).toEqual([
      'pf1-content/iulHWSMNp9TABDDU',
    ]);
    for (const name of ['Demon-Spawn (Pitborn)', 'Moroi-Born (Svetocher)'])
      expect(entry(name).detail.unresolvedReplacements ?? [], name).toEqual([]);
  });
});

describe('the racial-traits-400 keys', () => {
  const {
    batchEntries,
    entry,
    modifiers,
    indexOf,
    resolved,
    racialTraitSheet,
    identityRace,
    total,
  } = racialTraitBatch(entries, 'racial-traits-400');
  it("the four curated heritage lines replace their race's ability score trait: the race's line goes dormant and the heritage line applies", () => {
    // The four curated heritage lines replace their race's ability score trait:
    // the race's line goes dormant and the heritage line applies.
    for (const [name, race, lines] of [
      [
        'Qlippoth-Spawn (the Motherless)',
        'pf1/nVjKDLZSRONzYm8f', // Tiefling: +2 Dex, +2 Int, -2 Cha
        [
          ['ability.str', 10, 12],
          ['ability.dex', 12, 10],
          ['ability.int', 12, 8],
          ['ability.wis', 10, 12],
          ['ability.cha', 8, 10],
        ],
      ],
      [
        'Devil-Spawn (Hellspawn)',
        'pf1/nVjKDLZSRONzYm8f',
        [
          ['ability.con', 10, 12],
          ['ability.dex', 12, 10],
          ['ability.int', 12, 10],
          ['ability.wis', 10, 12],
          ['ability.cha', 8, 8],
        ],
      ],
      [
        'Lavasoul (Magma Ifrit)',
        'pf1/TPHe88Yhy4SsDpKo', // Ifrit: +2 Dex, +2 Cha, -2 Wis
        [
          ['ability.dex', 12, 8],
          ['ability.con', 10, 12],
          ['ability.int', 10, 12],
          ['ability.wis', 8, 10],
          ['ability.cha', 12, 10],
        ],
      ],
      [
        'Stormsoul (Lightning Sylph)',
        'pf1/pbX1xj9Z0ZhUfKvZ', // Sylph: +2 Dex, +2 Int, -2 Con
        [
          ['ability.dex', 12, 12],
          ['ability.con', 8, 10],
          ['ability.int', 12, 10],
          ['ability.wis', 10, 8],
          ['ability.cha', 10, 12],
        ],
      ],
    ] as const) {
      const heritage = entry(name);
      expect(heritage.detail.raceKeys).toEqual([race]);
      const ability = raceAbilityTraitKey(race);
      expect(heritage.detail.replaces, name).toEqual([ability]);
      expect(heritage.detail.unresolvedReplacements ?? [], name).toEqual([]);
      const plain = identityRace(racialTraitSheet({}), race, [ability]);
      const taken = identityRace(
        racialTraitSheet({ traits: [heritage.externalKey] }),
        race,
        [ability],
      );
      for (const [target, before, after] of lines) {
        expect(total(plain, target), `${name} race ${target}`).toBe(before);
        expect(total(taken, target), `${name} ${target}`).toBe(after);
      }
    }
    expect(
      modifiers('Qlippoth-Spawn (the Motherless)').map((row) => [
        row.target,
        row.bonusType,
        row.value,
      ]),
    ).toEqual([
      ['ability.str', 'racial', 2],
      ['ability.wis', 'racial', 2],
      ['ability.int', 'racial', -2],
    ]);
  });

  it('situational bonuses apply only when their Situation is selected', () => {
    // Situational bonuses apply only when their Situation is selected.
    for (const [name, target, base, label, value] of [
      ['Saltbeard', 'ac.other', 'ac', 'aquatic or water', 2],
      ['Saltbeard', 'attack.melee', 'attack', 'aquatic or water', 1],
      ['Saltbeard', 'skill.pro', 'skill.pro', 'sailor', 2],
      ['Saltbeard', 'skill.sur', 'skill.sur', 'at sea', 2],
      ['Sky Sentinel', 'ac.other', 'ac', 'flying', 2],
      ['Sky Sentinel', 'attack.ranged', 'attack', 'flying', 1],
      ['Sky Sentinel', 'skill.per', 'skill.per', 'flying', 2],
      ['Spell Smasher', 'attack.melee', 'attack', 'casting', 1],
      ['Underfoot', 'ac.other', 'ac', 'larger', 1],
      ['Underfoot', 'save.ref', 'save.ref', 'trample', 1],
      ['Intense Curiosity', 'skill.per', 'skill.per', 'taking 20', 4],
      ['Intense Curiosity', 'skill.sur', 'skill.sur', 'taking 20', 4],
      [
        'Voice in the Darkness (Half-Orc)',
        'skill.int',
        'skill.int',
        'dim light',
        2,
      ],
      [
        'Voice in the Darkness (Half-Orc)',
        'skill.ste',
        'skill.ste',
        'dim light',
        2,
      ],
      ['Flighty', 'save.will', 'saves', 'patterns', 2],
      ['Healthy', 'save.fort', 'save.fort', 'disease', 4],
      ['Cleanliness', 'save.fort', 'saves', 'disease', 2],
    ] as const) {
      const index = indexOf(name, base, label);
      expect(resolved(name, target), `${name} ${target}`).toBe(0);
      expect(resolved(name, target, [index]), `${name} ${target}`).toBe(value);
    }
  });

  it("shared Situations only where the body's condition matches exactly", () => {
    // Shared Situations only where the body's condition matches exactly.
    for (const [name, shared, target, value] of [
      ['Healthy', 'poison', 'save.fort', 4],
      [
        'Hag Racial Trait (Changeling - Waker May)',
        'mindAffecting',
        'save.will',
        2,
      ],
      ['Small Quarter Ally', 'fear', 'save.ref', 1],
    ] as const) {
      const index = modifiers(name).findIndex(
        (row) => row.condition?.situation === shared,
      );
      expect(index, `${name} ${shared}`).toBeGreaterThanOrEqual(0);
      expect(resolved(name, target), name).toBe(0);
      expect(resolved(name, target, [index]), name).toBe(value);
    }
  });

  it("the published types: Healthy's, Cleanliness's, Saltbeard's skill, Sky Sentinel's Perception and Underfoot's Reflex bonuses are untyped", () => {
    // The published types: Healthy's, Cleanliness's, Saltbeard's skill,
    // Sky Sentinel's Perception and Underfoot's Reflex bonuses are untyped.
    for (const [name, target, type] of [
      ['Healthy', 'save.fort', 'untyped'],
      ['Cleanliness', 'saves', 'untyped'],
      ['Saltbeard', 'skill.pro', 'untyped'],
      ['Saltbeard', 'attack', 'racial'],
      ['Saltbeard', 'ac', 'dodge'],
      ['Sky Sentinel', 'skill.per', 'untyped'],
      ['Sky Sentinel', 'ac', 'dodge'],
      ['Underfoot', 'save.ref', 'untyped'],
      ['Underfoot', 'ac', 'dodge'],
      ['Small Quarter Ally', 'saves', 'luck'],
      ['Spell Smasher', 'attack', 'racial'],
    ] as const)
      expect(
        modifiers(name).find((row) => row.target === target)?.bonusType,
        `${name} ${target}`,
      ).toBe(type);
  });

  it("Wild Forest Kobold's raw Stealth change is replaced by 0 (reviewed change replacement); the description record supplies the published +2 racial Perception, and the imported Survival change stays", () => {
    // Wild Forest Kobold's raw Stealth change is replaced by 0 (reviewed change
    // replacement); the description record supplies the published +2 racial
    // Perception, and the imported Survival change stays.
    expect(
      modifiers('Wild Forest Kobold').map((row) => [
        row.target,
        row.bonusType,
        row.value,
      ]),
    ).toEqual([
      ['skill.ste', 'racial', 0],
      ['skill.sur', 'racial', 2],
      ['skill.per', 'racial', 2],
    ]);
    for (const [target, value] of [
      ['skill.ste', 0],
      ['skill.per', 2],
      ['skill.sur', 2],
    ] as const)
      expect(resolved('Wild Forest Kobold', target), target).toBe(value);
  });

  it("racial bonuses from distinct Sources stack (PRD; character-sheet.ts): Isolated's and Seascarred's +2 racial Perception give +4 together", () => {
    // Racial bonuses from distinct Sources stack (PRD; character-sheet.ts):
    // Isolated's and Seascarred's +2 racial Perception give +4 together.
    const perception = [
      ...modifiers('Isolated'),
      ...modifiers('Alternate Skill Modifiers (Skinwalker - Seascarred)'),
    ].filter((row) => row.target === 'skill.per');
    expect(
      resolveSheet(perception, { situations: [] })['skill.per'].total,
    ).toBe(4);
  });

  it('imported and relocated changes keep mapping; nothing is curated twice', () => {
    // Imported and relocated changes keep mapping; nothing is curated twice.
    for (const [name, target, value] of [
      ['Inquisitive', 'skill.dev', 2],
      ['Inquisitive', 'skill.esc', 2],
      ['Gift of Tongues', 'skill.blf', 1],
      ['Gift of Tongues', 'skill.dip', 1],
      ['Rock Climber', 'skill.acr', 1],
      ['Rock Climber', 'skill.clm', 1],
      ['Fleet-Footed', 'init', 2],
      ['Explorer', 'skill.clm', 2],
      ['Master Tinker', 'skill.dev', 1],
      ['Master Tinker', 'skill.ken', 1],
      ['Beast Bond', 'skill.han', 2],
      ['Beast Bond', 'skill.rid', 2],
      ['Moonkissed', 'save.fort', 1],
      ['Isolated', 'skill.kdu', 2],
      ['Alternate Skill Modifiers (Skinwalker - Seascarred)', 'skill.swm', 2],
      ['Skilled (Tiefling - the Motherless)', 'skill.esc', 2],
      ['Skilled (Tiefling - the Motherless)', 'skill.sur', 2],
      ['Skilled (Duskwalker)', 'skill.kre', 2],
      ['Skilled (Duskwalker)', 'skill.hea', 2],
      ['Exceptional Senses', 'skill.per', 2],
      ['Powerful Smell', 'skill.ste', -4],
    ] as const)
      expect(resolved(name, target), `${name} ${target}`).toBe(value);
  });

  it("Gift of Tongues' and Master Tinker's imported racial changes are replaced by 0 (reviewed change replacements); the description records supply the published untyped +1 (fix round 1, as for Seasinger)", () => {
    // Gift of Tongues' and Master Tinker's imported racial changes are replaced
    // by 0 (reviewed change replacements); the description records supply the
    // published untyped +1 (fix round 1, as for Seasinger).
    for (const [name, targets] of [
      ['Gift of Tongues', ['skill.blf', 'skill.dip']],
      ['Master Tinker', ['skill.dev', 'skill.ken']],
    ] as const)
      expect(
        modifiers(name).map((row) => [row.target, row.bonusType, row.value]),
        name,
      ).toEqual([
        ...targets.map((target) => [target, 'racial', 0]),
        ...targets.map((target) => [target, 'untyped', 1]),
      ]);
  });

  it("Mountaineer replaces Lifebound, but the Samsaran race's checked #328 description record keeps Lifebound's bonuses on the race (outstanding, listed for review): +2 where the published rules give 0", () => {
    // Mountaineer replaces Lifebound, but the Samsaran race's checked #328
    // description record keeps Lifebound's bonuses on the race (outstanding,
    // listed for review): +2 where the published rules give 0.
    // The race isn't in the trait's content closure (races grant traits, not
    // the reverse), so the race's checked description record is read from the
    // overlay itself.
    const SAMSARAN = 'pf1/aQ8RQYKVd2hqI4jh';
    const samsaran = reviewedCuration.records.find(
      (row) =>
        row.externalKey === SAMSARAN &&
        row.kind === 'description' &&
        row.status === 'checked',
    );
    if (!samsaran) throw new Error('Missing the Samsaran race record');
    expect(entry('Mountaineer').detail.replaces).toEqual([
      'pf1-content/TMYYCMogKs454s9n',
    ]);
    const race = samsaran.outputs.flatMap((raw) =>
      raw.kind === 'modifier'
        ? [
            {
              ...outputSchema.options[0]
                .omit({ kind: true })
                .extend({ target: z.enum(modifierTargets) })
                .parse(
                  Object.fromEntries(
                    Object.entries(raw).filter(([key]) => key !== 'kind'),
                  ),
                ),
              sheetEntryId: SAMSARAN,
              catalogEntryId: SAMSARAN,
              source: SAMSARAN,
              entryName: 'Samsaran',
              builtIn: false,
            },
          ]
        : [],
    );
    expect(race).toHaveLength(3);
    for (const [target, scope] of [
      ['save.will', 'death'],
      ['save.ref', 'negativeEnergy'],
      [
        'save.fort',
        { local: 'to remove negative levels', sheetEntryId: SAMSARAN },
      ],
    ] as const)
      expect(
        resolveSheet(race, { situations: [scope] })[target].total,
        JSON.stringify(scope),
      ).toBe(2);
  });

  it('standard traits of #719 races and covered race notes, types, languages, senses, speeds, spell-like abilities, natural attacks, racial subtypes and rules the sheet cannot model stay without reviewed Modifiers', () => {
    // Standard traits of #719 races and covered race notes, types, languages,
    // senses, speeds, spell-like abilities, natural attacks, racial subtypes and
    // rules the sheet cannot model stay without reviewed Modifiers.
    // Defensive Training (Dwarf) and Poison Resistance carry only their races'
    // re-homed #328 note outputs; the trait records add none.
    expect(entry('Defensive Training (Dwarf)').modifiers).toEqual([
      {
        target: 'ac',
        bonusType: 'dodge',
        value: 4,
        condition: { situation: 'giants' },
      },
    ]);
    expect(entry('Poison Resistance').modifiers).toEqual([
      {
        target: 'saves',
        bonusType: 'racial',
        value: { formula: '@hitDice' },
        condition: { situation: 'poison' },
      },
    ]);
    for (const name of [
      'Languages (Half-Orc)',
      'Low-Light Vision (Gnome)',
      'Natural Weapons',
      'Stonecunning (Svirfneblin)',
      'Spell Resistance (Svirfneblin)',
      'Gnome Subtype',
      'Languages (Tengu)',
      'Languages (Fetchling)',
      'Languages (Ifrit)',
      'Languages (Grippli)',
      'Languages (Primitive Human)',
      'Native Outsider (Fetchling)',
      'Slow Speed (Merfolk)',
      'Slow Speed (Ratfolk)',
      'Swim Speed (Adaro)',
      'Natural Climber (Monkey Goblin)',
      'Darkvision (Syrinx)',
      'Low-Light Vision (Strix)',
      'Amphibious (Aquatic Elf)',
      'Deep Sea Dweller',
      'Energy Resistance (Ifrit)',
      'Shadowy Resistance',
      'Spell-Like Ability (Undine)',
      'Spell-Like Abilities (Fetchling - Shadow Walk)',
      'Spell-Like Ability (Oread - Gemsoul)',
      'Envoy',
      'Incorruptible',
      'Soul Seer',
      'Heir to Undying Nobility',
      'Seasoned Spirit',
      "Cat's Claws",
      'Toothy',
      'Multi-Armed (Kasatha)',
      'Desert Stride',
      'Ganzi Oddity',
      'Shattered Soul',
      'Long-Lived',
      'Heroic',
      'Fey Thoughts (Half-Orc)',
      'Poison Minion (Dwarf)',
      'Mountaineer',
      'Earth Insight',
      'Writhing Eye',
      'Crystal Affinity (Oread - Gemsoul)',
      'Deep Delver',
      'Storm-Born (Virga May)',
    ])
      expect(entry(name).modifiers, name).toEqual([]);
  });

  it('no armor, shield or natural armor bonus sits on ac.other', () => {
    // No armor, shield or natural armor bonus sits on ac.other.
    for (const row of batchEntries)
      for (const modifier of row.modifiers)
        if (['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType))
          expect(modifier.target, row.name).not.toBe('ac.other');
  });

  // Rule fields of the batch review's named entries in
  // racial-traits-400.test.ts:535,
  // a proof block whose record checks stay with the unit (fix r2).
  it("keeps the named traits' Notes on their statistics or at entry level and the weapon proficiencies the batch maps (racial-traits-400.test.ts:535)", () => {
    for (const name of [
      'Energy Resistance (Ifrit)',
      'Shadowy Resistance',
      'Deep Sea Dweller',
      'Shattered Soul',
      'Earth Insight',
      'Desert Stride',
    ])
      expect(
        entry(name)
          .situationalNotes?.filter((note) => note.target)
          .map((note) => note.target),
        name,
      ).toEqual([]);
    for (const [name, targets] of [
      ['Mountaineer', ['save.fort', 'skill.acr', 'skill.clm']],
      ['Saltbeard', ['skill.apr']],
      ['Sky Sentinel', ['ac']],
      ['Gift of Tongues', ['skill.lin']],
      ['Master Tinker', ['attack']],
    ] as const)
      expect(
        entry(name)
          .situationalNotes?.filter((note) => note.target)
          .map((note) => note.target)
          .sort(),
        name,
      ).toEqual(targets);
    // Only Cat's Claws maps a weapon proficiency (Claw Blades).
    expect(batchEntries).toHaveLength(78);
    for (const row of batchEntries)
      expect(
        (row.proficiencies ?? []).map((grant) =>
          'baseType' in grant ? grant.baseType : null,
        ),
        row.name,
      ).toEqual(row.name === "Cat's Claws" ? ['Claw Blades'] : []);
  });

  // The replacement fields in
  // racial-traits-400.test.ts:897, proof blocks whose record checks stay
  // with the unit (fix r2).
  it("reads the batch's unresolved replacement names and the named traits' replaced traits (racial-traits-400.test.ts:897)", () => {
    // The batch's list: each trait that keeps a replacement name unresolved,
    // with those names; every other trait resolves all of its replacements.
    expect(batchEntries).toHaveLength(78);
    const unresolved = Object.fromEntries(
      batchEntries
        .filter((row) => row.detail.unresolvedReplacements?.length)
        .map((row) => [row.externalKey, row.detail.unresolvedReplacements]),
    );
    expect(unresolved).toEqual({
      'pf1-content/hsso3bR3LTyek5hG': ['Base Statistics'], // Deep Delver
      'pf1-content/iES8aXKMApVmwZad': ['Crystal Affinity (Oread - Gemsoul)'], // Crystal Affinity (Oread - Gemsoul)
      'pf1-content/jXo1JOAbSAm1iC5M': ['Base Statistics'], // Storm-Born (Virga May)
    });
    expect(entry('Sky Sentinel').detail.replaces).toHaveLength(3);
    expect(entry('Saltbeard').detail.replaces).toHaveLength(3);
    expect(entry('Seasoned Spirit').detail.replaces).toHaveLength(3);
    expect(entry('Isolated').detail.replaces).toHaveLength(2);
    for (const name of [
      'Qlippoth-Spawn (the Motherless)',
      'Devil-Spawn (Hellspawn)',
      'Lavasoul (Magma Ifrit)',
      'Stormsoul (Lightning Sylph)',
    ])
      expect(entry(name).detail.unresolvedReplacements ?? [], name).toEqual([]);
    for (const name of ['Deep Delver', 'Storm-Born (Virga May)'])
      expect(entry(name).detail.unresolvedReplacements, name).toEqual([
        'Base Statistics',
      ]);
    expect(
      entry('Skilled (Tiefling - the Motherless)').detail.replaces,
    ).toEqual(['pf1-content/AKuDJrwJUZULsJcS']);
  });
});

describe('the racial-traits-401 keys', () => {
  const {
    batchEntries,
    entry,
    modifiers,
    indexOf,
    resolved,
    racialTraitSheet,
    identityRace,
    total,
  } = racialTraitBatch(entries, 'racial-traits-401');
  it("the four curated heritage lines replace their race's ability score trait: the race's line goes dormant and the heritage line applies", () => {
    // The four curated heritage lines replace their race's ability score trait:
    // the race's line goes dormant and the heritage line applies.
    for (const [name, race, lines] of [
      [
        'Werebat-Kin (Bloodmarked)',
        'pf1/apWl6JIJ8U8p0azq', // Skinwalker: +2 Wis, -2 Int
        [
          ['ability.int', 8, 12],
          ['ability.wis', 12, 8],
          ['ability.dex', 10, 10],
        ],
      ],
      [
        'Wererat-Kin (Nightskulk)',
        'pf1/apWl6JIJ8U8p0azq',
        [
          ['ability.int', 8, 12],
          ['ability.str', 10, 8],
          ['ability.wis', 12, 10],
        ],
      ],
      [
        'Weretiger-Kin (Fanglord)',
        'pf1/apWl6JIJ8U8p0azq',
        [
          ['ability.dex', 10, 12],
          ['ability.wis', 12, 8],
          ['ability.int', 8, 10],
        ],
      ],
      [
        'Agathion-Blooded (Idyllkin)',
        'pf1/FHY3oIk5zSOFncJH', // Aasimar: +2 Wis, +2 Cha
        [
          ['ability.con', 10, 12],
          ['ability.cha', 12, 12],
          ['ability.wis', 12, 10],
        ],
      ],
    ] as const) {
      const heritage = entry(name);
      expect(heritage.detail.raceKeys).toEqual([race]);
      const ability = raceAbilityTraitKey(race);
      expect(heritage.detail.replaces, name).toEqual([ability]);
      expect(heritage.detail.unresolvedReplacements ?? [], name).toEqual([]);
      const plain = identityRace(racialTraitSheet({}), race, [ability]);
      const taken = identityRace(
        racialTraitSheet({ traits: [heritage.externalKey] }),
        race,
        [ability],
      );
      for (const [target, before, after] of lines) {
        expect(total(plain, target), `${name} race ${target}`).toBe(before);
        expect(total(taken, target), `${name} ${target}`).toBe(after);
      }
    }
    expect(
      modifiers('Werebat-Kin (Bloodmarked)').map((row) => [
        row.target,
        row.bonusType,
        row.value,
      ]),
    ).toEqual([
      ['ability.int', 'racial', 2],
      ['ability.wis', 'racial', -2],
    ]);
  });

  it('situational bonuses apply only when their Situation is selected', () => {
    // Situational bonuses apply only when their Situation is selected.
    for (const [name, target, base, label, value] of [
      [
        'Darklands Guide (Half-Elf)',
        'save.ref',
        'saves',
        'traps and hazards',
        2,
      ],
      ['Thinblood Resistance', 'save.fort', 'save.fort', 'disease', 2],
      ['Skulker', 'attack.melee', 'attack', 'Dexterity bonus', 1],
      ['Child of the Sea', 'skill.pro', 'skill.pro', 'sea vessel', 4],
      ['Stalker', 'skill.per', 'skill.per', 'observed', 1],
      ['Stalker', 'skill.kre', 'skill.kre', 'observed', 1],
      ['Stalker', 'attack.melee', 'attack', 'observed', 1],
      [
        'Magical Linguist (Gnome)',
        'save.will',
        'saves',
        'language-dependent',
        2,
      ],
      ['Pain Tolerance', 'save.will', 'saves', 'pain descriptor', 2],
      ['Unflinching Valor (Frostkin)', 'cmd', 'cmd', 'grappled', 1],
      ['Elf-Scorned', 'ac.other', 'ac', 'elves', 2],
      ['Elf-Scorned', 'attack.ranged', 'attack', 'elves', 1],
      [
        'Hatred (Half-Orc)',
        'attack.melee',
        'attack',
        'dwarf, elf and human',
        1,
      ],
      ['Wyrmscourged', 'ac.other', 'ac', 'against dragons', 2],
      ['Wyrmscourged', 'attack.melee', 'attack', 'against dragons', 1],
      ['Wyrmscourged', 'save.ref', 'saves', 'abilities of dragons', 2],
      ['Wyrmscourged', 'skill.kar', 'skill.kar', 'identify dragons', 2],
      ['Plagueborn', 'save.fort', 'saves', 'ingested poisons', 2],
      ['Squalid', 'save.fort', 'saves', 'sickened', 2],
      ['Oppressive', 'skill.int', 'skill.int', 'Oppressive', 4],
      [
        'Alternate Skill Modifiers (Skinwalker - Bloodmarked)',
        'skill.per',
        'skill.per',
        'at night',
        2,
      ],
      [
        'Change Shape (Skinwalker)',
        'ability.str',
        'ability.str',
        'Strength choice',
        2,
      ],
      [
        'Change Shape (Skinwalker)',
        'ac.natural',
        'ac.natural',
        'natural armor',
        1,
      ],
      [
        'Change Shape (Skinwalker - Ragebred)',
        'ability.con',
        'ability.con',
        'bestial form',
        2,
      ],
    ] as const) {
      const index = indexOf(name, base, label);
      expect(resolved(name, target), `${name} ${target}`).toBe(0);
      expect(resolved(name, target, [index]), `${name} ${target}`).toBe(value);
    }
  });

  it("shared Situations only where the body's condition matches exactly", () => {
    // Shared Situations only where the body's condition matches exactly.
    for (const [name, shared, target, value] of [
      ['Thinblood Resistance', 'poison', 'save.fort', 2],
      ['Venomkissed', 'poison', 'save.ref', 2],
      ['Unflinching Valor (Frostkin)', 'fear', 'save.will', 2],
    ] as const) {
      const index = modifiers(name).findIndex(
        (row) => row.condition?.situation === shared,
      );
      expect(index, `${name} ${shared}`).toBeGreaterThanOrEqual(0);
      expect(resolved(name, target), name).toBe(0);
      expect(resolved(name, target, [index]), name).toBe(value);
    }
    expect(
      modifiers('Crusading Magic').find((row) => row.target === 'casterLevel')
        ?.condition,
    ).toEqual({ situation: 'spellResistance' });
  });

  it("the published types: Darklands Guide's, Stalker's and Wyrmscourged's attack bonuses are untyped; Elf-Scorned's and Wyrmscourged's AC bonuses are dodge", () => {
    // The published types: Darklands Guide's, Stalker's and Wyrmscourged's
    // attack bonuses are untyped; Elf-Scorned's and Wyrmscourged's AC bonuses
    // are dodge.
    for (const [name, target, type] of [
      ['Darklands Guide (Half-Elf)', 'saves', 'untyped'],
      ['Darklands Guide (Half-Elf)', 'init', 'untyped'],
      ['Stalker', 'skill.per', 'untyped'],
      ['Stalker', 'damage', 'untyped'],
      ['Wyrmscourged', 'attack', 'untyped'],
      ['Wyrmscourged', 'ac', 'dodge'],
      ['Wyrmscourged', 'saves', 'dodge'],
      ['Elf-Scorned', 'ac', 'dodge'],
      ['Elf-Scorned', 'attack', 'racial'],
      ['Change Shape (Skinwalker)', 'ac.natural', 'naturalArmor'],
      ['Child of the Sea', 'skill.pro', 'racial'],
    ] as const)
      expect(
        modifiers(name).find((row) => row.target === target)?.bonusType,
        `${name} ${target}`,
      ).toBe(type);
  });

  it("Darklands Guide's initiative bonus applies always", () => {
    // Darklands Guide's initiative bonus applies always.
    expect(resolved('Darklands Guide (Half-Elf)', 'init')).toBe(2);
  });

  it("Heart of the Wilderness: the reviewed change replacement halves Foundry's full Hit Dice to the published half character level (+3 at 7th level)", () => {
    // Heart of the Wilderness: the reviewed change replacement halves
    // Foundry's full Hit Dice to the published half character level (+3 at 7th
    // level).
    const [survival, ...rest] = modifiers('Heart of the Wilderness');
    expect(rest).toEqual([]);
    expect(survival).toMatchObject({
      target: 'skill.sur',
      bonusType: 'racial',
      value: { formula: 'floor(@hitDice / 2)' },
    });
    if (!survival || typeof survival.value === 'number')
      throw new Error('Expected formula');
    expect(
      evaluateFormula(parseFormula(survival.value.formula), (name) =>
        name === '@hitDice' ? 7 : 0,
      ),
    ).toBe(3);
  });

  it("racial bonuses from distinct Sources stack (PRD; character-sheet.ts): Jungle Stalker's and Plumekith's +2 racial Acrobatics give +4 together", () => {
    // Racial bonuses from distinct Sources stack (PRD; character-sheet.ts):
    // Jungle Stalker's and Plumekith's +2 racial Acrobatics give +4 together.
    const acrobatics = [
      ...modifiers('Jungle Stalker'),
      ...modifiers('Skilled (Aasimar - Plumekith)'),
    ].filter((row) => row.target === 'skill.acr');
    expect(
      resolveSheet(acrobatics, { situations: [] })['skill.acr'].total,
    ).toBe(4);
  });

  it('imported changes keep mapping; nothing is curated twice', () => {
    // Imported changes keep mapping; nothing is curated twice.
    for (const [name, target, value] of [
      ['Urban Memories', 'skill.klo', 2],
      ['Crusading Magic', 'skill.kpl', 2],
      ['Jungle Stalker', 'skill.acr', 2],
      ['Curosity', 'skill.dip', 2],
      ['Curosity', 'skill.lin', 2],
      ['Princely', 'skill.dip', 2],
      ['Princely', 'skill.int', 2],
      ['Shamanic Enhancement', 'skill.spl', 2],
      ['Bestial', 'skill.per', 2],
      ['Child of the Sea', 'skill.swm', 4],
      ['Alternate Skill Modifiers (Dhampir - Ru-Shi)', 'skill.acr', 2],
      ['Alternate Skill Modifiers (Dhampir - Ru-Shi)', 'skill.ken', 2],
      ['Alternate Skill Modifiers (Skinwalker - Bloodmarked)', 'skill.fly', 2],
      ['Skilled (Tiefling - Hellspawn)', 'skill.dip', 2],
      ['Skilled (Tiefling - Hellspawn)', 'skill.sen', 2],
      ['Skilled (Tiefling - Grimspawn)', 'skill.dev', 2],
      ['Skilled (Tiefling - Grimspawn)', 'skill.slt', 2],
      ['Skilled (Aasimar - Plumekith)', 'skill.fly', 2],
      ['Ability Modifiers (Changeling - Veil May)', 'ability.wis', 2],
      ['Ability Modifiers (Changeling - Veil May)', 'ability.int', -2],
    ] as const)
      expect(resolved(name, target), `${name} ${target}`).toBe(value);
  });

  it("Beastmaster's imported racial change is replaced by 0 (reviewed change replacement); the description record supplies the untyped +2 of the pinned (APG) body (fix round 1, as for Gift of Tongues)", () => {
    // Beastmaster's imported racial change is replaced by 0 (reviewed change
    // replacement); the description record supplies the untyped +2 of the
    // pinned (APG) body (fix round 1, as for Gift of Tongues).
    expect(
      modifiers('Beastmaster').map((row) => [
        row.target,
        row.bonusType,
        row.value,
      ]),
    ).toEqual([
      ['skill.han', 'racial', 0],
      ['skill.han', 'untyped', 2],
    ]);
    expect(resolved('Beastmaster', 'skill.han')).toBe(2);
  });

  it("Latent race overlaps: the Kitsune's and the Grindylow's checked #328 description records already carry these traits' bonuses; the traits add none", () => {
    // Latent race overlaps: the Kitsune's and the Grindylow's checked #328
    // description records already carry these traits' bonuses; the traits add
    // none.
    for (const name of ['Change Shape (Kitsune)', 'Tangling Tentacles'])
      expect(entry(name).modifiers, name).toEqual([]);
  });

  it('Types, languages, senses, speeds, spell-like abilities, racial subtypes, choices and rules the sheet cannot model stay without reviewed Modifiers', () => {
    // Types, languages, senses, speeds, spell-like abilities, racial subtypes,
    // choices and rules the sheet cannot model stay without reviewed Modifiers.
    for (const name of [
      'Orc',
      'Darkvision (Orc)',
      'Languages (Orc)',
      'Darkvision (Shabti)',
      'Darkvision (Goblin)',
      'Darkvision (Strix)',
      'Darkvision (Oread)',
      'Languages (Vishkanya)',
      'Languages (Skinwalker)',
      'Low-Light Vision (Locathah)',
      'Low-Light Vision (Wyrwood)',
      'Normal Speed (Gathlain)',
      'Weapon Familiarity (Gnome)',
      'Weapon Familiarity (Vishkanya)',
      'Monstrous Humanoid (Cecaelia)',
      'Mostly Human (Ifrit)',
      'Skill Training',
      'Frightened by Magic',
      'Skilled (Aphorite)',
      'Planar Envoy',
      'Hag Racial Trait (Changeling - Dead Eyes)',
      'Dusksight (Half-Orc)',
      'Luckbringer',
      'Air Insight',
      'Blank Slate',
      'Brazen Flame',
      'Crossbow Training',
      'Darklands Stalker',
      'Fecund Earth',
      'Heart of the Fields',
      'Spell-Like Ability (Tiefling - the Motherless)',
      'Lava Gnomes',
      'Tower Elf',
    ])
      expect(entry(name).modifiers, name).toEqual([]);
  });

  it('no armor, shield or natural armor bonus sits on ac.other', () => {
    // No armor, shield or natural armor bonus sits on ac.other.
    for (const row of batchEntries)
      for (const modifier of row.modifiers)
        if (['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType))
          expect(modifier.target, row.name).not.toBe('ac.other');
  });

  // Rule fields of the batch review's named entries in
  // racial-traits-401.test.ts:474,
  // a proof block whose record checks stay with the unit (fix r2).
  it("keeps the named traits' Notes on their statistics or at entry level and the weapon proficiencies the batch maps (racial-traits-401.test.ts:474)", () => {
    for (const name of [
      'Air Insight',
      'Jungle Stalker',
      'Darklands Stalker',
      'Pain Tolerance',
      'Heart of the Wilderness',
    ])
      expect(
        entry(name)
          .situationalNotes?.filter((note) => note.target)
          .map((note) => note.target),
        name,
      ).toEqual([]);
    for (const [name, targets] of [
      ['Child of the Sea', ['skill.sur']],
      ['Wyrmscourged', ['skill.kar']],
      ['Dusksight (Half-Orc)', ['attack.ranged']],
      ['Crossbow Training', ['attack.ranged']],
      ['Planar Envoy', ['skill.lin']],
      ['Brazen Flame', ['damage.melee']],
      ['Hag Racial Trait (Changeling - Dead Eyes)', ['saves']],
      // Two traits are named Jumper; the review's lookup took the first.
      ['pf1-content/mZlhtYzG64k6EMHp', ['skill.acr']], // Jumper
      ['Blank Slate', ['skills']],
    ] as const)
      expect(
        entry(name)
          .situationalNotes?.filter((note) => note.target)
          .map((note) => note.target)
          .sort(),
        name,
      ).toEqual(targets);
    // Only Weapon Familiarity (Vishkanya) maps weapon proficiencies (three).
    expect(batchEntries).toHaveLength(75);
    for (const row of batchEntries)
      expect((row.proficiencies ?? []).length, row.name).toBe(
        row.name === 'Weapon Familiarity (Vishkanya)' ? 3 : 0,
      );
  });

  // The replacement fields in
  // racial-traits-401.test.ts:801, proof blocks whose record checks stay
  // with the unit (fix r2).
  it("reads the batch's unresolved replacement names and the named traits' replaced traits (racial-traits-401.test.ts:801)", () => {
    // The batch's list: each trait that keeps a replacement name unresolved,
    // with those names; every other trait resolves all of its replacements.
    expect(batchEntries).toHaveLength(75);
    const unresolved = Object.fromEntries(
      batchEntries
        .filter((row) => row.detail.unresolvedReplacements?.length)
        .map((row) => [row.externalKey, row.detail.unresolvedReplacements]),
    );
    expect(unresolved).toEqual({
      'pf1-content/leUhvuim6HknT0fn': ['Languages', 'Subtype', 'Type'], // Mostly Human (Ifrit)
      'pf1-content/nPnz19oJfnZKSFdI': ['Base Statistics'], // Lava Gnomes
      'pf1-content/o0ooSUUjwVjL79XE': ['Past-Life Knowledge', 'Nature Magic'], // Fecund Earth
      'pf1-content/oB8Ff3b2HNB2eddC': ['Base Statistics'], // Tower Elf
    });
    expect(entry('Wyrmscourged').detail.replaces).toHaveLength(3);
    expect(entry('Stalker').detail.replaces).toHaveLength(3);
    for (const name of [
      'Werebat-Kin (Bloodmarked)',
      'Wererat-Kin (Nightskulk)',
      'Weretiger-Kin (Fanglord)',
      'Agathion-Blooded (Idyllkin)',
    ])
      expect(entry(name).detail.unresolvedReplacements ?? [], name).toEqual([]);
    for (const name of ['Lava Gnomes', 'Tower Elf'])
      expect(entry(name).detail.unresolvedReplacements, name).toEqual([
        'Base Statistics',
      ]);
    for (const [name, parent] of [
      ['Skilled (Tiefling - Hellspawn)', 'pf1-content/AKuDJrwJUZULsJcS'],
      ['Skilled (Tiefling - Grimspawn)', 'pf1-content/AKuDJrwJUZULsJcS'],
      ['Change Shape (Skinwalker - Ragebred)', 'pf1-content/mLxAldGcZ0UnEfd7'],
    ] as const)
      expect(entry(name).detail.replaces, name).toEqual([parent]);
  });
});

describe('the racial-traits-402 keys', () => {
  const { batchEntries, entry } = racialTraitBatch(
    entries,
    'racial-traits-402',
  );
  it('keeps the Dwarf languages as readable prose, with the record languages field unmapped', () => {
    const languages = entry('Languages (Dwarf)');
    expect(languages.modifiers).toEqual([]);
    expect(languages.detail).toMatchObject({
      kind: 'racialTrait',
      raceKeys: ['pf1/nEltI9y37rKJTeWo'],
      standard: true,
      replaces: [],
    });
    expect(languages.unsupported).toContainEqual(
      expect.objectContaining({
        field: 'gameContent',
        value: { languages: ['common', 'dwarven'] },
      }),
    );
  });

  it('gives Elven Immunities (Half-Elf) its enchantment save Modifier, the Half-Elf its +2 ability choice and Fearless (Halfling) a fear save Modifier that stacks within its entry', () => {
    const immunities = entry('Elven Immunities (Half-Elf)');
    expect(immunities.modifiers).toEqual([
      {
        target: 'saves',
        bonusType: 'racial',
        value: 2,
        condition: { situation: 'enchantment' },
      },
    ]);
    expect(immunities.detail).toMatchObject({
      raceKeys: ['pf1/cCepRrfH5SalFfT4'],
      standard: true,
    });
    expect(entry('+2 to One Ability Score (Half-Elf)').modifiers).toEqual([
      { target: 'ability.$choice', bonusType: 'racial', value: 2 },
    ]);
    const fearless = entry('Fearless (Halfling)');
    expect(fearless.modifiers).toEqual([
      {
        target: 'saves',
        bonusType: 'racial',
        value: 2,
        condition: { situation: 'fear' },
        stacksWithinEntry: true,
      },
    ]);
    expect(fearless.detail).toMatchObject({
      raceKeys: ['pf1/Hf31mrYb3uucNyLO'],
    });
  });

  // The Notes check of racial-traits-402.test.ts:142, a proof block whose
  // record checks stay with the unit (fix r2): over the batch's list. A Note's
  // wording is incidental (the catalog digest holds it); its count and its
  // target, Situation and condition are compared (fix r3).
  it("keeps one Note without a target, Situation or condition on Elven Immunities (Half-Elf), and none on the batch's other traits (racial-traits-402.test.ts:142)", () => {
    const notes: Record<string, unknown> = {
      'Elven Immunities (Half-Elf)': [{}],
    };
    expect(batchEntries).toHaveLength(4);
    for (const row of batchEntries)
      expect(
        (row.situationalNotes ?? []).map(
          ({ text: _text, ...structure }) => structure,
        ),
        row.name,
      ).toEqual(notes[row.name] ?? []);
  });
});

describe('the racial-traits-403 keys', () => {
  const { batchEntries, entry } = racialTraitBatch(
    entries,
    'racial-traits-403',
  );
  it('gives Bonus Feat one feat slot and Weapon Familiarity (Half-Orc) its two weapon Proficiencies', () => {
    const bonusFeat = entry('Bonus Feat (Human)');
    expect(bonusFeat.grantsSlots).toEqual([{ kind: 'feat', count: 1 }]);
    expect(bonusFeat.modifiers).toEqual([]);
    expect(bonusFeat.detail).toMatchObject({
      raceKeys: ['pf1/e6IaBxKgMxy1yKlr'],
      standard: true,
    });
    // The Falchion and Greataxe records (racialTraitContext) supply the base
    // types the trait's weapon familiarity names.
    const familiarity = entry('Weapon Familiarity (Half-Orc)');
    expect(familiarity.proficiencies).toEqual([
      { baseType: 'Falchion' },
      { baseType: 'Greataxe' },
    ]);
    expect(familiarity.detail).toMatchObject({
      raceKeys: ['pf1/dCAXgdA6Db1Z3ccz'],
      standard: true,
    });
  });

  it('gives Elf Blood its counted races, Multitalented two favored classes and Sure-Footed its two skill bonuses', () => {
    expect(entry('Elf Blood').countsAsRaces).toEqual([
      'pf1/NgIhxRI0axrf3fcO',
      'pf1/e6IaBxKgMxy1yKlr',
    ]);
    expect(entry('Elf Blood').modifiers).toEqual([]);
    expect(entry('Multitalented').detail).toMatchObject({
      raceKeys: ['pf1/cCepRrfH5SalFfT4'],
      favoredClassCount: 2,
    });
    expect(entry('Sure-Footed').modifiers).toEqual([
      { target: 'skill.acr', bonusType: 'racial', value: 2 },
      { target: 'skill.clm', bonusType: 'racial', value: 2 },
    ]);
  });

  // The Notes check of racial-traits-403.test.ts:142, a proof block whose
  // record checks stay with the unit (fix r2): over the batch's list.
  it("keeps the batch's traits without a Situational Note (racial-traits-403.test.ts:142)", () => {
    const notes: Record<string, unknown> = {};
    expect(batchEntries).toHaveLength(5);
    for (const row of batchEntries)
      expect(row.situationalNotes ?? [], row.name).toEqual(
        notes[row.name] ?? [],
      );
  });
});

describe('the racial-traits-404 keys', () => {
  const { batchEntries, entry } = racialTraitBatch(
    entries,
    'racial-traits-404',
  );
  it('keeps the Half-Orc darkvision readable, its raw sense change unmapped', () => {
    const darkvision = entry('Darkvision (Half-Orc)');
    expect(darkvision.modifiers).toEqual([]);
    expect(darkvision.unsupported).toContainEqual(
      expect.objectContaining({
        field: 'changes',
        value: {
          target: 'sensedv',
          formula: '60',
          type: 'base',
          operator: 'set',
        },
      }),
    );
  });

  it('gives Adaptability a Skill Focus slot and keeps the Halfling speed as prose', () => {
    const adaptability = entry('Adaptability');
    expect(adaptability.grantsSlots).toEqual([
      { kind: 'feat', count: 1, feats: ['pf1/7zJTztNW7hdaqjKc'] },
    ]);
    expect(adaptability.modifiers).toEqual([]);
    // The slot's feat, the batch preview's only closure row.
    expect(importedEntry(entries, 'pf1/7zJTztNW7hdaqjKc').name).toBe(
      'Skill Focus',
    );
    const speed = entry('Slow Speed (Halfling)');
    expect(speed.modifiers).toEqual([]);
    expect(speed.unsupported).toContainEqual(
      expect.objectContaining({ field: 'changes' }),
    );
  });

  // The Notes check of racial-traits-404.test.ts:141, a proof block whose
  // record checks stay with the unit (fix r2): over the batch's list.
  it("keeps the batch's traits without a Situational Note (racial-traits-404.test.ts:141)", () => {
    const notes: Record<string, unknown> = {};
    expect(batchEntries).toHaveLength(3);
    for (const row of batchEntries)
      expect(row.situationalNotes ?? [], row.name).toEqual(
        notes[row.name] ?? [],
      );
  });
});

describe('the racial-traits-405 keys', () => {
  const { batchEntries, entry } = racialTraitBatch(
    entries,
    'racial-traits-405',
  );
  it('gives Elven Immunities (Elf) its enchantment save Modifier', () => {
    const immunities = entry('Elven Immunities (Elf)');
    expect(immunities.modifiers).toEqual([
      {
        target: 'saves',
        bonusType: 'racial',
        value: 2,
        condition: { situation: 'enchantment' },
      },
    ]);
    expect(immunities.detail).toMatchObject({
      kind: 'racialTrait',
      raceKeys: ['pf1/NgIhxRI0axrf3fcO'],
      standard: true,
      replaces: [],
    });
  });

  // The Notes check of racial-traits-405.test.ts:141, a proof block whose
  // record checks stay with the unit (fix r2): over the batch's list. A Note's
  // wording is incidental (the catalog digest holds it); its count and its
  // target, Situation and condition are compared (fix r3).
  it("keeps one Note without a target, Situation or condition on Elven Immunities (Elf), and none on the batch's other traits (racial-traits-405.test.ts:141)", () => {
    const notes: Record<string, unknown> = { 'Elven Immunities (Elf)': [{}] };
    expect(batchEntries).toHaveLength(1);
    for (const row of batchEntries)
      expect(
        (row.situationalNotes ?? []).map(
          ({ text: _text, ...structure }) => structure,
        ),
        row.name,
      ).toEqual(notes[row.name] ?? []);
  });
});

// racial-traits-719's cases import that fixture tree's records
// (racialTraits719: its nineteen races, their standard traits, ten alternates,
// Skill Focus and eleven weapons) on their own, as the batch unit did: their
// "every entry" checks and the import's report (`catalog.racialTraits`,
// `curation.missing`) are over exactly those records, which the import above
// would widen. The tree's "Lashunta" race folder holds none of its records, so
// it is named as context; every other folder comes with the traits it holds.
const LASHUNTA_FOLDER = 'pf1-content/AdTesmy8kKMUm2wL';
// The CRB Fighter is imported with them for the skill-rank budget case; the
// race sheets take the tree's races, Racial Traits and feat only, as the
// batch unit's did.
const FIGHTER = 'pf1/WLqBCT5DqmGAx8Wd';
const released719 = await importReleasedEntries([...racialTraits719, FIGHTER], {
  context: [LASHUNTA_FOLDER],
});
const definitions = [...released719.entries.values()]
  .filter((entry) =>
    ['race', 'racialTrait', 'feat'].includes(entry.detail.kind),
  )
  .map(sheetDefinition);

describe('the racial-traits-719 records', () => {
  const race = {
    human: 'pf1/e6IaBxKgMxy1yKlr',
    elf: 'pf1/NgIhxRI0axrf3fcO',
    dwarf: 'pf1/nEltI9y37rKJTeWo',
    gnome: 'pf1/efwHEwjvL9Z94MJI',
    halfElf: 'pf1/cCepRrfH5SalFfT4',
    halfOrc: 'pf1/dCAXgdA6Db1Z3ccz',
    halfling: 'pf1/Hf31mrYb3uucNyLO',
    orc: 'pf1/JOuAdPAOTat7d5v6',
  } as const;
  // Pinned races whose reviewed #328 outputs move onto a standard trait.
  const otherRace = {
    kitsune: 'pf1/GAoJIy6ycj3OovQT',
    svirfneblin: 'pf1/fX9F2amW2BcYoHwb',
    wayang: 'pf1/Vaf5bV3wpk24pVt2',
    ghoran: 'pf1/2mWMyKiPWk6Y8cNx',
    changeling: 'pf1/9FBT6uqlRgaw9gug',
    grindylow: 'pf1/Lt4ZP5GCinGvTfnF',
    cecaelia: 'pf1/NhEPoXIZWOOunSH7',
    nagaji: 'pf1/ZVzH0qb1Tqety6fU',
    reptoid: 'pf1/YCCdi4OEC4WuzelM',
    drow: 'pf1/yLaDS5HGbwtgpkbP',
  } as const;
  const lashuntaFemale = 'pf1/7aDvyO68K8hm58Qm';
  const trait = (id: string) => `pf1-content/${id}`;
  const t = {
    humanAbility: trait('BFszTUJLlDS1ZDB8'),
    bonusFeat: trait('uAJ9hLZYdH2JX7J8'),
    skilled: trait('LwDcZanOEHqVaYoh'),
    halfElfAbility: trait('orOAYDkNl4pqYWA4'),
    halfOrcAbility: trait('VHmuEYXmx81Q5EmC'),
    adaptability: trait('wZZzaSmiF8hTuRo7'),
    multitalented: trait('srOpqbXesXBuvTqe'),
    elfBlood: trait('rzYk40R1rWSfay4a'),
    orcBlood: trait('JWzMBJeAQYDav9gw'),
    keenSensesElf: trait('WOF6A7695wxFO2ie'),
    hardy: trait('AO5nhhUfI1b4M37H'),
    gnomeMagic: trait('MiPbhGqPRX7H4C7a'),
    fearless: trait('qoCLqjadKmJEN9R7'),
    halflingLuck: trait('HVI7FNwj2ng10qtj'),
    halfOrcFamiliarity: trait('sFlDW97gf1FHn217'),
    dualTalent: trait('SRBfqkzIldwETAHB'),
    urbanite: trait('SyXfxr53mzenpNu5'),
    stubborn: trait('eew9hWENxwAiLP8S'),
    pyromaniac: trait('URpcaP1vfemHJyal'),
    arcaneTraining: trait('v6db0gftaAJKUfvK'),
    dualMinded: trait('DEowtAtiVIQOh2dj'),
    cityRaised: trait('tC0JCXIRZK9tEoMm'),
    craven: trait('45xNKgDQ3SvKpW58'),
    smeller: trait('uXWtABSsuB1zn67j'),
    arcticElf: trait('S2NJixZYq3fBtPig'),
    shadowMagic: trait('XixpDZG7W0XELNni'),
    drowImmunities: trait('Yfywu8kU3UraGzlN'),
    drowPoisonUse: trait('fUAqkTyumLnQrGch'),
  };
  const skillFocus = 'pf1/7zJTztNW7hdaqjKc';
  /**
   * Dual Talent, which the player resolved to the three human traits it names
   * Manual replacement selections remain supported alongside mapped defaults.
   */
  const dualTalent: SheetEntry = {
    _id: `alternate:${t.dualTalent}`,
    kind: 'racialTrait',
    active: true,
    catalogEntryId: t.dualTalent,
    state: {
      kind: 'racialTrait',
      replaces: [t.humanAbility, t.skilled, t.bonusFeat],
    },
  };

  function entry(key: string) {
    const found = released719.entries.get(key);
    if (!found) throw new Error(`Missing entry ${key}`);
    return found;
  }
  function sheet(raceKey: string, entries: SheetEntry[] = []) {
    return raceSheet({ race: raceKey, definitions, entries });
  }
  function calculate(input: CharacterSheetInput, situations: string[] = []) {
    return calculateCharacterSheet(input, { situations });
  }
  function counting(input: CharacterSheetInput, key: string) {
    return calculate(input).resolvedEntries.find(
      (row) =>
        row.entry.kind === 'racialTrait' && row.entry.catalogEntryId === key,
    );
  }
  /** A pinned record as the importer loads it, read from the store. */
  async function storeRecord(key: string, pack: string) {
    const file = await pinnedRecordFile(key);
    const path = file.slice('pf1/'.length);
    return {
      repo: 'pf1' as const,
      pack,
      path,
      record: upstreamRecord.parse(parse(await readPinned('pf1', path))),
    } satisfies LoadedRecord;
  }

  /**
   * The race as #328 imported it: one entry carrying every mapped change and
   * every reviewed race note and description output, with no Racial Traits.
   */
  async function singleEntryRace(key: string) {
    const source = await storeRecord(key, 'races');
    const mapped = mapEntry({
      source,
      kind: 'race',
      resolveKey: (value) => value,
      lookup: new Map(),
      spellClassTags: new Set(),
    });
    const data = parseCuration(reviewedCuration);
    applyCuration({
      inputs: [
        ...collectCurationInputs({ source, externalKey: key, kind: 'race' }),
        ...collectDescriptionInputs({
          source,
          externalKey: key,
          kind: 'race',
          explicitlyReviewed: true,
        }),
      ],
      seeds: [],
      data,
      entries: [mapped],
    });
    return sheetDefinition({
      ...mapped,
      detail: { ...mapped.detail, racialTraits: [] },
    });
  }

  /** Every resolved statistic total, ordinary and in each Situation. */
  function totals(input: CharacterSheetInput, situations: string[]) {
    return Object.fromEntries(
      ['', ...situations].map((situation) => {
        const result = calculate(input, situation ? [situation] : []);
        return [
          situation || 'ordinary',
          Object.fromEntries(
            Object.entries(result.breakdowns).flatMap(([target, statistic]) => {
              const conditional = [
                ...statistic.conditional,
                ...(statistic.excluded ?? []),
              ]
                .map((modifier) => `${modifier.bonusType}:${modifier.value}`)
                .sort();
              return statistic.total || conditional.length
                ? [[target, { total: statistic.total, conditional }]]
                : [];
            }),
          ),
        ];
      }),
    );
  }
  /** A committed statistic as `totals` gives it. */
  function statistic(value: Statistic) {
    const [total, ...conditional] = typeof value === 'number' ? [value] : value;
    return { total, conditional };
  }
  /** A race's committed totals (totals719), in the shape `totals` gives. */
  function expandedTotals(raceKey: string) {
    const committed = totals719[raceKey];
    if (!committed) throw new Error(`No committed totals for ${raceKey}`);
    const ordinary = Object.fromEntries(
      Object.entries(committed.ordinary).map(([target, value]) => [
        target,
        statistic(value),
      ]),
    );
    return Object.fromEntries([
      ['ordinary', ordinary],
      ...situations719.map((situation) => {
        const changed = committed.situations[situation] ?? {};
        const merged = { ...committed.ordinary, ...changed };
        return [
          situation,
          Object.fromEntries(
            Object.entries(merged).flatMap(([target, value]) =>
              value === null ? [] : [[target, statistic(value)]],
            ),
          ),
        ];
      }),
    ]);
  }
  function situationsOf(definition: CharacterSheetCatalogEntry) {
    return definition.modifiers.flatMap((modifier) =>
      typeof modifier.condition?.situation === 'string'
        ? [modifier.condition.situation]
        : [],
    );
  }

  describe('standard Racial Trait Grants', () => {
    // The pinned `<Race>/Standard` folders, by record ID (ep-orch/research/719.md §1).
    const standard = {
      [race.human]: [
        'BFszTUJLlDS1ZDB8',
        'eNIYJNbM6UL7OdyE',
        'LwDcZanOEHqVaYoh',
        'uAJ9hLZYdH2JX7J8',
      ],
      [race.elf]: [
        'bRO90tmeaH1tFi2g',
        'GS07eqHZBCT979tA',
        'IuApwtNYMYMTabOZ',
        'WOF6A7695wxFO2ie',
        'X3ixmmB9S07XqKNX',
        'yQvZ03xcsuM8b595',
      ],
      [race.dwarf]: [
        '2F4IRW8AAicQ3VYc',
        '6JCG0ei0s0ossrtx',
        'ACFSI8aOJAYr89QM',
        'AO5nhhUfI1b4M37H',
        'GfQrx1OHTdOIVAWb',
        'iBCPIWFExt679Zhh',
        'JsvoElxHBPdle8s8',
        'JtJKg8vV58UJ6m1m',
        'rBKJCVwy3X2VjFdU',
        'T4PaZ33R29gTAFaT',
      ],
      [race.gnome]: [
        'FD2SILZXcIMjauvr',
        'ikQ2BoHJlx4zYGvB',
        'IQ5vHUbNbGqVaVV5',
        'L4yOFpviuO9WvCyT',
        'LcZE7cPw87DMzJYl',
        'MiPbhGqPRX7H4C7a',
        'mPD0yR9P3IGAC6nJ',
        'Pe7olUqkJIbDGl4q',
        'YHwpeek5IHtcZNDF',
        'ZaTEe0kZxKJuYYjT',
      ],
      [race.halfElf]: [
        '1HOWCThotIz5ztx0',
        '3HbUyHrEVeDiTH1d',
        'I8Zy5iy8HpAxBZQb',
        'orOAYDkNl4pqYWA4',
        'oTQL4P3IdoJQAkOB',
        'rzYk40R1rWSfay4a',
        'srOpqbXesXBuvTqe',
        'wZZzaSmiF8hTuRo7',
      ],
      [race.halfOrc]: [
        'iB5aNUyJPWjxx3tx',
        'JWzMBJeAQYDav9gw',
        'OyIvyI3x7V5HIzZL',
        'sFlDW97gf1FHn217',
        'UawXK40Ix4vmfMkY',
        'VHmuEYXmx81Q5EmC',
        'xeEmYqR3IUXoby9x',
      ],
      [race.halfling]: [
        'cOod8wThcNc0expZ',
        'HVI7FNwj2ng10qtj',
        'qoCLqjadKmJEN9R7',
        'sSs0BK09PLxjbkAa',
        'XVo4DApULZaETYcz',
        'xwr9DBDmvGMYHcut',
        'YMocjN3SlwHoQgW1',
      ],
      [race.orc]: [
        'emWoMvZJYkXOz6ot',
        'JlymGAKiie1gmqI2',
        'l7CqdrmNxsmEsBBG',
        'n4wxE73ZItt77fLt',
        'nQ9j793ikC9orJQA',
        'oKbTIUKJkGwFDHXu',
      ],
    };

    // The races here whose fixed ability changes no pinned trait owns
    // (ep-orch/research/721.md §1).
    const withAbilityTrait = new Set<string>([
      race.elf,
      race.dwarf,
      race.gnome,
      race.halfling,
      race.orc,
    ]);
    it.each(Object.entries(standard))(
      'links %s to exactly its Standard-folder trait records, which count through the resolver',
      (raceKey, ids) => {
        const detail = entry(raceKey).detail;
        expect(detail.kind).toBe('race');
        const keys = detail.kind === 'race' ? (detail.racialTraits ?? []) : [];
        // #721: plus the race's reviewed ability score trait, where it has one.
        const expected = [
          ...ids.map(trait),
          ...(withAbilityTrait.has(raceKey)
            ? [`local/race-ability-scores/${raceKey}`]
            : []),
        ].sort();
        expect([...keys].sort()).toEqual(expected);
        for (const key of keys)
          expect(entry(key).detail).toMatchObject({
            kind: 'racialTrait',
            raceKeys: [raceKey],
            standard: true,
            replaces: [],
          });
        const result = calculate(sheet(raceKey));
        expect(
          result.resolvedEntries
            .filter((row) => row.entry.kind === 'racialTrait' && row.counting)
            .map((row) =>
              row.entry.kind === 'racialTrait' ? row.entry.catalogEntryId : '',
            )
            .sort(),
        ).toEqual(expected);
      },
    );

    it('reports trait names with no pinned record, and moves fixed ability Modifiers onto the reviewed ability score trait', () => {
      const report = released719.artifact.catalog.racialTraits;
      const row = (key: string) =>
        report?.races.find((candidate) => candidate.externalKey === key);
      // Elf has no ability score trait record: #721's reviewed trait carries its
      // fixed changes.
      expect(row(race.elf)).toMatchObject({
        unmatchedTraitNames: ['Type', 'Size', 'Base Speed'],
        ownerlessModifiers: [],
        unlinkedStandardTraits: [],
        overlaps: [],
      });
      expect(entry(raceAbilityTraitKey(race.elf)).modifiers).toEqual([
        { target: 'ability.dex', bonusType: 'racial', value: 2 },
        { target: 'ability.int', bonusType: 'racial', value: 2 },
        { target: 'ability.con', bonusType: 'racial', value: -2 },
      ]);
      // Human's ability score trait is the reviewed +2 choice.
      expect(row(race.human)).toMatchObject({
        unmatchedTraitNames: ['Type', 'Size', 'Base Speed'],
        ownerlessModifiers: [],
      });
      expect(row(race.orc)?.ownerlessModifiers).toEqual([]);
      expect(entry(raceAbilityTraitKey(race.orc)).modifiers).toHaveLength(4);
      // Skilled owns the complete Stealth benefit. Stonework Perception is a
      // separate simultaneous fact, still reported against the ordinary bonus.
      expect(row(otherRace.svirfneblin)?.overlaps).toEqual([
        { target: 'skill.per', trait: trait('gwRHgXExczYgcJOA') },
      ]);
      expect(report?.summary).toMatchObject({
        races: 19,
        // #721: Lashunta (Female) now grants its reviewed ability score trait.
        racesWithTraits: 19,
        // 151 pinned standard traits and 14 reviewed ability score traits.
        linkedTraits: 165,
        unlinkedStandardTraits: 0,
        overlaps: 1,
        // #388: Stonecunning (Dwarf)'s own checked note record supersedes the
        // Dwarf race's skill.per note record.
        staleNotes: 1,
        alternates: 10,
        alternatesFullyResolved: 9,
        descriptionRehomes: { applied: 11, stale: 0, unused: 0 },
        abilityTraits: { applied: 14, stale: 0, unused: 58 },
      });
    });

    it('gives a race without a trait folder of its own name a reason', () => {
      expect(
        released719.artifact.catalog.racialTraits?.races.find(
          (row) => row.externalKey === lashuntaFemale,
        ),
      ).toMatchObject({
        // #721: its only Racial Trait is its reviewed ability score trait.
        racialTraits: ['local/race-ability-scores/pf1/7aDvyO68K8hm58Qm'],
        unlinkedReason:
          'No race folder is named "Lashunta (Female)"; the "Lashunta" folder binds only a race of exactly that name.',
      });
      expect(
        released719.artifact.catalog.racialTraits?.races.filter(
          (row) => row.unlinkedReason,
        ),
      ).toHaveLength(1);
    });
  });

  describe('relocated Modifiers', () => {
    it('Dual Talent grants two different +2 choices and replaces the ordinary Human choice, Bonus Feat and Skilled', () => {
      const alternate = alternateRow(t.dualTalent);
      const input = sheet(race.human, [
        grantedTraitRow({
          race: race.human,
          trait: t.humanAbility,
          choice: 'constitution',
        }),
        {
          ...alternate,
          state: {
            kind: 'racialTrait',
            choice: 'strength',
            secondChoice: 'dexterity',
          },
        },
      ]);
      const result = calculate(input);
      expect(result.abilities.strength.score).toBe(12);
      expect(result.abilities.dexterity.score).toBe(12);
      expect(result.abilities.constitution.score).toBe(10);
      expect(result.racial.bonusSkillRanksPerLevel).toBe(0);
      for (const key of [t.humanAbility, t.bonusFeat, t.skilled])
        expect(
          result.resolvedEntries.find(
            (row) =>
              row.entry.kind === 'racialTrait' &&
              row.entry.catalogEntryId === key,
          )?.counting,
        ).toBe(false);
      const duplicate = calculate(
        sheet(race.human, [
          {
            ...alternate,
            state: {
              kind: 'racialTrait',
              choice: 'strength',
              secondChoice: 'strength',
            },
          },
        ]),
      );
      expect(duplicate.abilities.strength.score).toBe(12);
      expect(
        duplicate.warnings.some(
          (warning) => warning.check === 'racialAbilityScoreDistinct',
        ),
      ).toBe(true);
      expect(
        calculate(
          sheet(race.human, [
            grantedTraitRow({
              race: race.human,
              trait: t.humanAbility,
              choice: 'constitution',
            }),
          ]),
        ).abilities.constitution.score,
      ).toBe(12);
    });
    it('Skilled owns the complete Svirfneblin Stealth benefit, including its actual local underground Situation', () => {
      const skilled = trait('gwRHgXExczYgcJOA');
      const input = sheet(otherRace.svirfneblin);
      const ordinary = calculateCharacterSheet(input);
      const underground = ordinary.breakdowns['skill.ste'].conditional.find(
        (modifier) =>
          typeof modifier.condition?.situation === 'object' &&
          'local' in modifier.condition.situation &&
          modifier.condition.situation.local === 'underground',
      );
      if (
        !underground ||
        typeof underground.condition?.situation !== 'object' ||
        !('local' in underground.condition.situation)
      )
        throw new Error('Missing actual underground Situation');
      const situations = [
        {
          ...underground.condition.situation,
          sheetEntryId: underground.sheetEntryId,
        },
      ];
      // Dex 12, Small +4 Stealth, Skilled +2 (improves to +4 underground).
      expect(ordinary.breakdowns['skill.ste'].total).toBe(7);
      expect(
        calculateCharacterSheet(input, { situations }).breakdowns['skill.ste']
          .total,
      ).toBe(9);
      const granted = ordinary.resolvedEntries.find(
        (row) =>
          row.entry.kind === 'racialTrait' &&
          row.entry.catalogEntryId === skilled,
      );
      if (granted?.entry.kind !== 'racialTrait')
        throw new Error('Missing Skilled Grant');
      expect(underground.sheetEntryId).toBe(granted.entry._id);
      // The Grant's sheet entry, by the race and trait keys it is granted from.
      expect(granted.entry._id).toBe(
        'grant:20:pf1/fX9F2amW2BcYoHwb::28:pf1-content/gwRHgXExczYgcJOA',
      );
      const inactive = {
        ...input,
        entries: [...input.entries, { ...granted.entry, active: false }],
      };
      expect(
        calculateCharacterSheet(inactive, { situations }).breakdowns[
          'skill.ste'
        ].total,
      ).toBe(5);
      const replacement = alternateRow('table-replacement');
      const replaced = {
        ...input,
        entries: [...input.entries, replacement],
        catalogEntries: [
          ...input.catalogEntries,
          {
            _id: 'table-replacement',
            ruleIdentity: 'table-replacement',
            modifiers: [],
            detail: {
              kind: 'racialTrait' as const,
              raceEntryIds: [otherRace.svirfneblin],
              replaces: [skilled],
            },
          },
        ],
      };
      expect(
        calculateCharacterSheet(replaced, { situations }).breakdowns[
          'skill.ste'
        ].total,
      ).toBe(5);
      // The distinct stonework Perception fact stays on the race.
      expect(
        calculateCharacterSheet(replaced).breakdowns['skill.per'].conditional,
      ).toEqual(
        expect.arrayContaining([expect.objectContaining({ value: 2 })]),
      );
      expect(
        calculateCharacterSheet(input, { situations }).breakdowns['skill.ste']
          .total,
      ).toBe(9);
    });
    it.each(Object.entries({ ...race, ...otherRace }))(
      'keeps the %s totals of the single-entry race, in ordinary play and in every Situation',
      async (_name, raceKey) => {
        const before = await singleEntryRace(raceKey);
        const after = sheet(raceKey);
        const situations = [
          ...new Set(
            [before, ...definitions].flatMap((definition) =>
              situationsOf(definition),
            ),
          ),
        ].sort();
        const original = raceSheet({
          race: raceKey,
          definitions: [
            before,
            ...definitions.filter((definition) => definition._id !== raceKey),
          ],
        });
        // The Situations are the committed list, and both readings give the
        // committed totals the unit computed (released-racial-trait-719-
        // totals.ts), as well as each other's.
        expect(situations).toEqual(situations719);
        const expected = expandedTotals(raceKey);
        expect(totals(original, situations)).toEqual(expected);
        expect(totals(after, situations)).toEqual(expected);
        expect(totals(after, situations)).toEqual(totals(original, situations));
        // Nothing that moved stays on the race as well: the committed counts
        // of the race's Modifiers read as one entry and as imported.
        const moved = entry(raceKey).modifiers;
        expect(before.modifiers).toHaveLength(totals719[raceKey]!.before);
        expect(moved).toHaveLength(totals719[raceKey]!.moved);
        expect(moved.length).toBeLessThanOrEqual(before.modifiers.length);
      },
    );

    it('keeps Fearless stacking with Halfling Luck after they become two traits', () => {
      const halfling = sheet(race.halfling);
      expect(calculate(halfling).breakdowns['save.will'].total).toBe(1);
      expect(calculate(halfling, ['fear']).breakdowns['save.will'].total).toBe(
        3,
      );
      // Craven (ARG p. 62) replaces both: neither bonus remains, and Craven's
      // own -2 against fear effects (checked in #388) applies instead.
      const craven = sheet(race.halfling, [alternateRow(t.craven)]);
      expect(calculate(craven).breakdowns['save.will'].total).toBe(0);
      expect(calculate(craven, ['fear']).breakdowns['save.will'].total).toBe(
        -2,
      );
      expect(calculate(craven).breakdowns.init.total).toBe(1);
    });

    it('counts the Gnome illusion DC once, on Gnome Magic, so Pyromaniac removes it', () => {
      const contributions = (input: CharacterSheetInput) => {
        const statistic = calculate(input).breakdowns.spellDC;
        return [
          ...statistic.applied,
          ...statistic.conditional,
          ...(statistic.excluded ?? []),
        ].map((modifier) => ({
          entry: modifier.catalogEntryId,
          value: modifier.value,
          school: modifier.condition?.school,
        }));
      };
      expect(contributions(sheet(race.gnome))).toEqual([
        { entry: t.gnomeMagic, value: 1, school: 'illusion' },
      ]);
      expect(
        entry(race.gnome).modifiers.some((row) => row.target === 'spellDC'),
      ).toBe(false);
      // The trait's own raw `dc.school.ill` change is covered, not unmapped.
      expect(
        entry(t.gnomeMagic).unsupported.filter(
          (issue) => issue.field === 'changes',
        ),
      ).toEqual([]);
      // Pyromaniac (ARG p. 33) replaces Gnome Magic and Illusion Resistance.
      expect(
        contributions(sheet(race.gnome, [alternateRow(t.pyromaniac)])),
      ).toEqual([]);
    });

    // Each reviewed description re-home: the race, its trait record and the raw
    // target of the trait change or note the moved output supersedes.
    it.each(
      (
        [
          [
            'Kitsune Magic',
            otherRace.kitsune,
            'YLr7f3djG85wvbAT',
            'spellDC',
            'dc.school.enc',
          ],
          [
            'Svirfneblin Magic',
            otherRace.svirfneblin,
            'Jnw41wF4ln2vH7d8',
            'spellDC',
            'dc.school.ill',
          ],
          [
            'Shadow Magic (Wayang)',
            otherRace.wayang,
            'XixpDZG7W0XELNni',
            'spellDC',
            'dc.school.ill',
          ],
          [
            'Ghoran natural armor',
            otherRace.ghoran,
            'DLslPcoXcnvQjIPH',
            'ac.natural',
            'nac',
          ],
          [
            'Changeling natural armor',
            otherRace.changeling,
            'Qx1JqPVW0quaOGfY',
            'ac.natural',
            'nac',
          ],
          [
            'Grindylow natural armor',
            otherRace.grindylow,
            'ttCN9QWoKGpAXX4H',
            'ac.natural',
            'nac',
          ],
          [
            'Cecaelia natural armor',
            otherRace.cecaelia,
            'v5Uff6XAqbnWbk4j',
            'ac.natural',
            'nac',
          ],
          [
            'Nagaji Armored Scales',
            otherRace.nagaji,
            'xoItsNqchG4wE6OG',
            'ac.natural',
            'nac',
          ],
          [
            'Reptoid Scales',
            otherRace.reptoid,
            'gh1taO4CBM237eMu',
            'ac.natural',
            'nac',
          ],
        ] as const
      ).map(([name, raceKey, id, target, superseded]) => ({
        name,
        raceKey,
        id,
        target,
        superseded,
      })),
    )(
      'moves the reviewed $name output onto its trait and counts it once',
      ({ raceKey, id, target, superseded }) => {
        const statistic = calculate(sheet(raceKey)).breakdowns[target];
        expect(
          [
            ...statistic.applied,
            ...statistic.conditional,
            ...(statistic.excluded ?? []),
          ].map((modifier) => modifier.catalogEntryId),
        ).toEqual([trait(id)]);
        expect(
          entry(raceKey).modifiers.some((row) => row.target === target),
        ).toBe(false);
        // The superseded raw change or note is neither mapped nor required.
        expect(
          entry(trait(id)).unsupported.filter(
            (issue) =>
              typeof issue.value === 'object' &&
              issue.value !== null &&
              'target' in issue.value &&
              issue.value.target === superseded,
          ),
        ).toEqual([]);
        expect(
          released719.artifact.curation.missing.filter(
            (input) => input.externalKey === trait(id),
          ),
        ).not.toContainEqual(expect.objectContaining({ target: superseded }));
      },
    );

    it("moves Kitsune's mapped ability changes onto its ability trait, whose own untypedPerm versions do not map", () => {
      const abilities = trait('6yUgkL8nRaoWTl41');
      expect(entry(abilities).modifiers).toEqual([
        { target: 'ability.dex', bonusType: 'racial', value: 2 },
        { target: 'ability.cha', bonusType: 'racial', value: 2 },
        { target: 'ability.str', bonusType: 'racial', value: -2 },
      ]);
      expect(
        entry(otherRace.kitsune).modifiers.filter((modifier) =>
          modifier.target.startsWith('ability.'),
        ),
      ).toEqual([]);
    });

    it('re-homes a race note several traits share onto the trait whose note states its numbers', () => {
      // Drow Immunities notes +2 against enchantments; Poison Use (Drow) notes no
      // number.
      const saves = (key: string) =>
        entry(key).modifiers.filter((modifier) => modifier.target === 'saves');
      expect(saves(t.drowImmunities)).not.toEqual([]);
      expect(saves(t.drowPoisonUse)).toEqual([]);
      expect(saves(otherRace.drow)).toEqual([]);
      expect(
        released719.artifact.catalog.racialTraits?.races.find(
          (row) => row.externalKey === otherRace.drow,
        ),
      ).toMatchObject({
        rehomedNotes: [{ target: 'allSavingThrows', trait: t.drowImmunities }],
        staleNotes: [],
      });
    });

    it('moves reviewed race notes onto the trait whose note covers the same statistic', () => {
      const dwarf = sheet(race.dwarf);
      const situations = ['poison', 'spells', 'spellLike'];
      expect(calculate(dwarf, situations).breakdowns['save.will'].total).toBe(
        2,
      );
      expect(
        entry(t.hardy).modifiers.filter(
          (modifier) => modifier.target === 'saves',
        ),
      ).toHaveLength(3);
      // Stubborn (ARG p. 12) replaces Hardy; its bonuses go with it.
      const stubborn = sheet(race.dwarf, [alternateRow(t.stubborn)]);
      expect(
        calculate(stubborn, situations).breakdowns['save.will'].total,
      ).toBe(0);
      expect(counting(stubborn, t.hardy)).toMatchObject({ counting: false });
    });
  });

  describe('#304 trait choices', () => {
    it('makes each +2 to one ability score a choice that contributes only once chosen', () => {
      for (const [raceKey, choiceTrait] of [
        [race.human, t.humanAbility],
        [race.halfElf, t.halfElfAbility],
        [race.halfOrc, t.halfOrcAbility],
      ] as const) {
        expect(entry(choiceTrait).modifiers).toEqual([
          { target: 'ability.$choice', bonusType: 'racial', value: 2 },
        ]);
        const unchosen = calculate(sheet(raceKey));
        expect(unchosen.abilities.strength.score).toBe(10);
        expect(unchosen.warnings).toContainEqual(
          expect.objectContaining({ check: 'racialAbilityScoreChoice' }),
        );
        const chosen = calculate(
          sheet(raceKey, [
            grantedTraitRow({
              race: raceKey,
              trait: choiceTrait,
              choice: 'strength',
            }),
          ]),
        );
        expect(chosen.abilities.strength.score).toBe(12);
        expect(chosen.abilities.dexterity.score).toBe(10);
      }
      // ARG p. 72 replaces the ordinary choice, Bonus Feat and Skilled.
      expect(entry(t.dualTalent).detail).toMatchObject({
        abilityChoiceCount: 2,
        replaces: [t.humanAbility, t.skilled, t.bonusFeat].sort(),
      });
      expect(
        released719.artifact.catalog.racialTraits?.unresolvedAlternates.find(
          (row) => row.externalKey === t.dualTalent,
        ),
      ).toBeUndefined();
      const unchosen = calculate(
        sheet(race.human, [
          grantedTraitRow({
            race: race.human,
            trait: t.humanAbility,
            choice: 'strength',
          }),
          alternateRow(t.dualTalent),
        ]),
      );
      expect(unchosen.abilities.strength.score).toBe(10);
      expect(
        unchosen.warnings.some(
          (warning) => warning.check === 'racialAbilityScoreChoice',
        ),
      ).toBe(true);
    });

    it('gives Bonus Feat a feat slot that Dual Talent removes', () => {
      const slots = (input: CharacterSheetInput) =>
        calculate(input).selectionRules.slots.filter((slot) =>
          slot.id.includes(t.bonusFeat),
        );
      expect(slots(sheet(race.human))).toMatchObject([
        { kind: 'feat', count: 1 },
      ]);
      expect(slots(sheet(race.human, [dualTalent]))).toEqual([]);
    });

    it('gives Skilled one skill rank per level from its change, which Dual Talent removes', async () => {
      expect(entry(t.skilled).detail).toMatchObject({
        bonusSkillRanksPerLevel: 1,
      });
      // The CRB fighter (2 + Int ranks per level), as the import emits it.
      const fighter = sheetDefinition(entry(FIGHTER));
      const level: SheetEntry = {
        _id: 'level-1',
        kind: 'classLevel',
        active: true,
        state: {
          kind: 'classLevel',
          classEntryId: fighter._id,
          position: 1,
          hpGained: 10,
        },
      };
      const budget = (extra: SheetEntry[]) =>
        calculateCharacterSheet(
          raceSheet({
            race: race.human,
            definitions: [...definitions, fighter],
            entries: [level, ...extra],
          }),
        ).classLevels[0]?.skillRankBudget;
      expect(budget([])).toBe(3);
      expect(budget([dualTalent])).toBe(2);
    });

    it('gives Adaptability a Skill Focus slot from the race record link, which Dual Minded replaces', () => {
      expect(entry(t.adaptability).grantsSlots).toEqual([
        { kind: 'feat', count: 1, feats: [skillFocus] },
      ]);
      const adaptability = (input: CharacterSheetInput) =>
        calculate(input).selectionRules.slots.filter((slot) =>
          slot.id.includes(t.adaptability),
        );
      expect(adaptability(sheet(race.halfElf))).toMatchObject([
        { kind: 'feat', count: 1, feats: [skillFocus] },
      ]);
      // Dual Minded (ARG p. 42) replaces Adaptability with +2 on Will saves.
      const dualMinded = sheet(race.halfElf, [alternateRow(t.dualMinded)]);
      expect(adaptability(dualMinded)).toEqual([]);
      expect(calculate(dualMinded).breakdowns['save.will'].total).toBe(2);
    });

    it('gives Multitalented two favored classes, which Arcane Training returns to one', () => {
      expect(calculate(sheet(race.halfElf)).racial.favoredClassCount).toBe(2);
      expect(
        calculate(sheet(race.halfElf, [alternateRow(t.arcaneTraining)])).racial
          .favoredClassCount,
      ).toBe(1);
    });
  });

  describe('race equivalence and weapon familiarity', () => {
    it('lets Elf Blood and Orc Blood count the race as their published races', () => {
      const halfElf = calculate(sheet(race.halfElf)).racial;
      expect(halfElf.countsAsRaces).toEqual(
        [race.elf, race.halfElf, race.human].sort(),
      );
      expect(satisfiesRacialPrerequisite(halfElf, { race: [race.elf] })).toBe(
        true,
      );
      const halfOrc = calculate(sheet(race.halfOrc)).racial;
      expect(halfOrc.countsAsRaces).toEqual(
        [race.halfOrc, race.human, race.orc].sort(),
      );
      expect(satisfiesRacialPrerequisite(halfOrc, { race: [race.elf] })).toBe(
        false,
      );
      // Only those two reviewed traits structure race equivalence.
      expect(
        [...released719.entries.values()]
          .filter((row) => row.countsAsRaces)
          .map((row) => row.externalKey)
          .sort(),
      ).toEqual([t.elfBlood, t.orcBlood].sort());
    });

    it('structures named weapon familiarity on the trait, so City-Raised and Smeller replace it', () => {
      const proficiencies = (input: CharacterSheetInput) =>
        calculate(input)
          .racial.proficiencies.map((grant) =>
            'baseType' in grant ? grant.baseType : '',
          )
          .sort();
      expect(proficiencies(sheet(race.elf))).toEqual([
        'Longbow',
        'Longsword',
        'Rapier',
        'Shortbow',
      ]);
      // "Battleaxe" on the trait is the pinned "Battle Axe" base type.
      expect(proficiencies(sheet(race.dwarf))).toEqual([
        'Battle Axe',
        'Heavy Pick',
        'Warhammer',
      ]);
      expect(proficiencies(sheet(race.halfling))).toEqual(['Sling']);
      expect(proficiencies(sheet(race.halfOrc))).toEqual([
        'Falchion',
        'Greataxe',
      ]);
      // City-Raised (ARG p. 52) replaces the half-orc familiarity.
      expect(
        proficiencies(sheet(race.halfOrc, [alternateRow(t.cityRaised)])),
      ).toEqual(['Longsword', 'Whip']);
      // Smeller (ARG p. 139) replaces the orc's Ferocity and Weapon Familiarity.
      expect(proficiencies(sheet(race.orc))).toEqual(['Falchion', 'Greataxe']);
      expect(proficiencies(sheet(race.orc, [alternateRow(t.smeller)]))).toEqual(
        [],
      );
      // Gnome Weapon Familiarity names no weapon: it stays prose.
      expect(entry(trait('mPD0yR9P3IGAC6nJ')).proficiencies).toBeUndefined();
    });
  });

  describe('alternate replacement', () => {
    it('leaves an alternate whose replaced trait has no pinned record for the player, without removing race Modifiers', () => {
      // Arctic Elf (ARG p. 23) replaces "Base Statistics", pf1-content's label
      // for a racial subtype: a named combination of alternates that keeps the
      // elf's ability scores, so the elf's ability score trait stays (#721).
      expect(entry(t.arcticElf).detail).toMatchObject({
        raceKeys: [race.elf],
        standard: false,
        replaces: [],
        unresolvedReplacements: ['Base Statistics'],
      });
      expect(
        released719.artifact.catalog.racialTraits?.unresolvedAlternates,
      ).toEqual([
        expect.objectContaining({
          externalKey: t.arcticElf,
          unmatched: ['Base Statistics'],
          missingHeader: false,
        }),
      ]);
      const result = calculate(sheet(race.elf, [alternateRow(t.arcticElf)]));
      expect(
        counting(
          sheet(race.elf, [alternateRow(t.arcticElf)]),
          raceAbilityTraitKey(race.elf),
        ),
      ).toMatchObject({ counting: true });
      expect(result.abilities.dexterity.score).toBe(12);
      expect(result.abilities.constitution.score).toBe(8);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ check: 'racialReplacementUnresolved' }),
      );
    });

    it('drops only Keen Senses when Urbanite replaces it', () => {
      const elf = sheet(race.elf);
      const urbanite = sheet(race.elf, [alternateRow(t.urbanite)]);
      expect(entry(t.urbanite).detail).toMatchObject({
        raceKeys: [race.elf],
        standard: false,
        replaces: [t.keenSensesElf],
      });
      const ordinary = new Map(
        Object.entries(calculate(elf).breakdowns).map(([target, value]) => [
          target,
          value.total,
        ]),
      );
      const changed = Object.entries(calculate(urbanite).breakdowns).flatMap(
        ([target, value]) =>
          value.total === ordinary.get(target)
            ? []
            : [[target, (ordinary.get(target) ?? 0) - value.total]],
      );
      expect(changed).toEqual([['skill.per', 2]]);
      // The comparison above, as two literals: every nonzero total of the
      // elf, and of the elf with Urbanite, which lacks only Perception.
      const nonzero = (input: CharacterSheetInput) =>
        Object.fromEntries(
          Object.entries(calculate(input).breakdowns).flatMap(
            ([target, value]) => (value.total ? [[target, value.total]] : []),
          ),
        );
      const elfTotals = {
        'ability.str': 10,
        'ability.dex': 12,
        'ability.con': 8,
        'ability.int': 12,
        'ability.wis': 10,
        'ability.cha': 10,
        'skill.acr': 1,
        'skill.apr': 1,
        'skill.crf': 1,
        'skill.dev': 1,
        'skill.esc': 1,
        'skill.fly': 1,
        'skill.kar': 1,
        'skill.kdu': 1,
        'skill.ken': 1,
        'skill.kge': 1,
        'skill.khi': 1,
        'skill.klo': 1,
        'skill.kna': 1,
        'skill.kno': 1,
        'skill.kpl': 1,
        'skill.kre': 1,
        'skill.lin': 1,
        'skill.per': 2,
        'skill.rid': 1,
        'skill.slt': 1,
        'skill.spl': 1,
        'skill.ste': 1,
        'speed.land': 30,
      };
      expect(nonzero(elf)).toEqual(elfTotals);
      const { 'skill.per': _perception, ...withoutPerception } = elfTotals;
      expect(nonzero(urbanite)).toEqual(withoutPerception);
    });
  });
  // The checks of racial-traits-719.test.ts:1190 on the tree's own import
  // (fix r2); its rebuilt import without Stonecunning's record stays with the
  // unit.
  it("counts Stonecunning (Dwarf)'s stonework Perception bonus once, on the trait and not on the Dwarf (racial-traits-719.test.ts:1190)", () => {
    const stonecunning = trait('6JCG0ei0s0ossrtx');
    expect(
      entry(stonecunning).modifiers.filter(
        (modifier) => modifier.target === 'skill.per',
      ),
    ).toHaveLength(1);
    expect(
      entry(race.dwarf).modifiers.some(
        (modifier) => modifier.target === 'skill.per',
      ),
    ).toBe(false);
  });

  it('does not apply the Svirfneblin Craft (alchemy) bonus to every Craft check', () => {
    // Both pinned descriptions explicitly restrict the +2 to Craft (alchemy).
    // The sheet currently has only the generic Craft target, so this stays
    // readable and unsupported rather than granting an unconditional +2.
    const result = calculate(sheet(otherRace.svirfneblin));
    expect(result.breakdowns['skill.crf'].total).toBe(0);
    expect(entry(otherRace.svirfneblin).unsupported).toContainEqual(
      expect.objectContaining({
        field: 'changes',
        reason: expect.stringContaining('Craft (alchemy)'),
      }),
    );
  });
});
