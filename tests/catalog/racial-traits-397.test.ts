// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';
import { reviewedCuration } from '../../scripts/catalog/reviewed-curation-data';
import { importCatalog } from '../../scripts/catalog/import';
import {
  upstreamRecord,
  sourceDescription,
} from '../../scripts/catalog/records';
import {
  assessCatalogAdmission,
  buildAssessmentBinding,
} from '../../scripts/catalog/admission';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import remaps from '../../scripts/catalog/reviewed-remaps.json';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
import { outputSchema } from '../../src/lib/catalog/curation-output-schema';
import {
  modifierTargets,
  resolveSheet,
  calculateCharacterSheetProjections,
} from '../../src/lib/character-sheet';
import {
  review,
  assessedTraits,
  admittedTraits,
  excludedRows,
  preview,
  pinnedFiles,
  pinnedSha256,
} from '../fixtures/racial-traits-397/data';
import {
  racialTraitSheet,
  sheetDefinition,
} from '../fixtures/racial-traits-397/sheet';
import { raceAbilityTraitKey } from '../../scripts/catalog/racial-trait-rules';
import { materializePinnedTree, readPinned } from './pinned-sources';
import { bindSnapshotToCurrentNotices } from './batch-ownership';
import { assessWithUnclearedHolds } from './uncleared-holds';

const PLACEHOLDER =
  'Review required: replace this placeholder with readable rules text or structured outputs.';
const sha = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
// Standard traits whose Modifiers are race outputs the full import re-homes
// onto them (#719); a bounded import without the race lacks them.
const RELOCATED_FROM_RACE = [
  'pf1-content/XhtOzYgJSTJCxIU9', // Emotionless (Android race change)
  'pf1-content/XixpDZG7W0XELNni', // Shadow Magic (Wayang) (race description)
  'pf1-content/YHwpeek5IHtcZNDF', // Illusion Resistance (Gnome race note)
  'pf1-content/YLr7f3djG85wvbAT', // Kitsune Magic (race description)
  'pf1-content/Yfywu8kU3UraGzlN', // Drow Immunities (Drow race note)
];
// Records whose description link the importer cannot resolve fail admission
// on that import gap in any preview: Creepy Doll links the pf1
// monster-abilities Freeze record, which is not a catalog entry.
const UNRESOLVED_LINK_GAP = ['pf1-content/YZ1WIRlAYAAfvbBR'];
function entry(name: string) {
  const row = preview.entries.find(
    (row) => row.externalKey === name || row.name === name,
  );
  if (!row) throw new Error(`Missing ${name}`);
  if (row.detail.kind !== 'racialTrait') throw new Error('Expected trait');
  return { ...row, detail: row.detail };
}
function candidate(name: string) {
  const row = assessedTraits.find(
    (row) => row.externalKey === name || row.name === name,
  );
  if (!row) throw new Error(`Missing review of ${name}`);
  return row;
}
function modifiers(name: string) {
  const row = entry(name);
  return row.modifiers.map((raw) => ({
    ...outputSchema.options[0]
      .omit({ kind: true })
      .extend({ target: z.enum(modifierTargets) })
      .parse(raw),
    sheetEntryId: row.externalKey,
    catalogEntryId: row.externalKey,
    source: row.externalKey,
    entryName: row.name,
    builtIn: false,
  }));
}
// The Situation of one Modifier, selected on its own entry.
function situation(name: string, index: number) {
  const scope = modifiers(name)[index]?.condition?.situation;
  if (!scope) throw new Error(`Modifier ${index} of ${name} has no Situation`);
  if (typeof scope === 'string') return scope;
  if (!('local' in scope)) throw new Error('Expected a local Situation');
  return { local: scope.local, sheetEntryId: entry(name).externalKey };
}
function indexOf(name: string, target: string, label: string) {
  const index = modifiers(name).findIndex(
    (row) =>
      row.target === target &&
      JSON.stringify(row.condition?.situation ?? '').includes(label),
  );
  if (index < 0) throw new Error(`No ${target} Modifier "${label}" on ${name}`);
  return index;
}
// One resolved statistic of one entry's Modifiers, with Situations selected.
function resolved(name: string, target: string, selected: number[] = []) {
  return resolveSheet(modifiers(name), {
    situations: selected.map((index) => situation(name, index)),
  })[target as 'skill.per'].total;
}
const total = (sheet: ReturnType<typeof racialTraitSheet>, target: string) =>
  calculateCharacterSheetProjections(sheet).current.breakdowns[
    target as 'ability.str'
  ].total;

/** A test-only race: the pinned race identity granting the listed traits. */
function identityRace(
  sheet: ReturnType<typeof racialTraitSheet>,
  raceKey: string,
  traits: string[],
) {
  return {
    ...sheet,
    entries: [
      ...sheet.entries,
      {
        _id: 'race-row',
        kind: 'race' as const,
        active: true,
        catalogEntryId: raceKey,
        state: { kind: 'race' as const },
      },
    ],
    catalogEntries: [
      ...sheet.catalogEntries,
      {
        _id: raceKey,
        name: 'Race (identity only)',
        ruleIdentity: raceKey,
        modifiers: [],
        detail: { kind: 'race' as const, racialTraits: traits },
      },
      ...traits.map(sheetDefinition),
    ],
  };
}

// Every record whose bound content closure keeps Unchained action-cost
// metadata (owner ruling, 2026-10-17): on its own action, through a bound
// body (a replaced trait, a linked spell or a body reached through its race),
// or both.
const unchainedOwn = [
  'pf1-content/XixpDZG7W0XELNni', // Shadow Magic (Wayang)
  'pf1-content/YLr7f3djG85wvbAT', // Kitsune Magic
  'pf1-content/YoZiTsd9x0KSCOi7', // Repairing Nanites
  'pf1-content/ZDYzHXisxHABCWza', // Stoic Defender
  'pf1-content/ZEVsEIPpOyHmpmEe', // Spell-Like Ability (Skinwalker)
  'pf1-content/ZJVdNI7JLIsgnQYz', // Lashunta Magic
  'pf1-content/ZTMNDc8mw9C76y6N', // Spell-Like Ability (Sylph - Stormsoul)
  'pf1-content/Zty4nj3QFPOC0hYX', // Breath Weapon (Dwarf)
  'pf1-content/a7nraRpo1VzmXYAj', // Prehensile Tail (Monkey Goblin)
  'pf1-content/a95VioTuysgFg9EZ', // Adaptable Luck
  'pf1-content/aJGZNcrbFJhbzUaz', // Light Dependent
  'pf1-content/aMGMC5XWT62jCouw', // Inspire Imitation
  'pf1-content/agovSwSID6zOPIDN', // Sense Thoughts
  'pf1-content/b6I8HENTNj6Gyyg1', // Spell-Like Ability (Aasimar - Emberkin)
  'pf1-content/b7b9LL5pcA63eOv1', // Spell-Like Ability (Oread)
  'pf1-content/b8mD388daeaoKidm', // Natural Bounty
];
const unchainedBound = [
  'pf1-content/XXB7Lnp9pMBlS5Or', // Mountain-Born
  'pf1-content/XixpDZG7W0XELNni', // Shadow Magic (Wayang)
  'pf1-content/YLr7f3djG85wvbAT', // Kitsune Magic
  'pf1-content/YoZiTsd9x0KSCOi7', // Repairing Nanites
  'pf1-content/ZDYzHXisxHABCWza', // Stoic Defender
  'pf1-content/ZEVsEIPpOyHmpmEe', // Spell-Like Ability (Skinwalker)
  'pf1-content/ZJVdNI7JLIsgnQYz', // Lashunta Magic
  'pf1-content/ZLFxIufcHBwiIZrl', // Werebear-Kin (Coldborn)
  'pf1-content/ZP4KHOyP79pyrBpj', // Warded Skin (Rainkin)
  'pf1-content/ZTMNDc8mw9C76y6N', // Spell-Like Ability (Sylph - Stormsoul)
  'pf1-content/ZW41vB78wXvRWWfs', // Variant Aasimar Abilities
  'pf1-content/a1otKF9eFw6gSfvB', // Gemsoul (Crystal Oread)
  'pf1-content/aLTD5kME13aY9UWk', // Scion of Shadows
  'pf1-content/aR6GbtT8EtOqN1XR', // Snowcaster Elves
  'pf1-content/agovSwSID6zOPIDN', // Sense Thoughts
  'pf1-content/aqfQQbZuntXaiXS0', // Heavenborn
  'pf1-content/b6I8HENTNj6Gyyg1', // Spell-Like Ability (Aasimar - Emberkin)
  'pf1-content/b7b9LL5pcA63eOv1', // Spell-Like Ability (Oread)
  'pf1-content/b8mD388daeaoKidm', // Natural Bounty
];

it('resolves the reviewed racial trait Modifiers through the public resolver', () => {
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
  // Racial bonuses from distinct Sources stack (PRD; character-sheet.ts):
  // Slag Child's and Abandoned's +2 racial Stealth give +4 together.
  const both = resolveSheet(
    [...modifiers('Slag Child'), ...modifiers('Abandoned')].filter(
      (row) => row.target === 'skill.ste',
    ),
    { situations: [] },
  );
  expect(both['skill.ste'].total).toBe(4);
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
  // Dodge bonuses go on ac, never on ac.other's armor types.
  expect(
    modifiers('Barrow Warden').filter((row) => row.target === 'ac'),
  ).toMatchObject([{ bonusType: 'dodge', value: 1 }]);
  // No armor, shield or natural armor bonus sits on ac.other.
  for (const row of preview.entries)
    for (const modifier of row.modifiers)
      if (['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType))
        expect(modifier.target, row.name).not.toBe('ac.other');
});

it('checks every required note record and the separate description pass against the pinned bodies', () => {
  // Foundry notes whose rule another Note states, or a race record already
  // supplies (latent overlap): explicit covered/no-output records.
  const covered: [string, string, string?][] = [
    ['Adaptable Luck', 'allSavingThrows'],
    ['Adaptable Luck', 'attack'],
    ['Adaptable Luck', 'skills'],
    ['Duergar Immunities', 'allSavingThrows', '+[[2]]'],
  ];
  let required = 0;
  let coveredCount = 0;
  for (const row of assessedTraits) {
    const [description, ...notes] = row.mechanicsReview.curationRecords;
    required += notes.length;
    for (const record of row.mechanicsReview.curationRecords) {
      expect(record.status, row.name).toBe('checked');
      expect(record.diagnostics, row.name).toEqual([]);
      expect(JSON.stringify(record.outputs), row.name).not.toContain(
        PLACEHOLDER,
      );
      const key = `${row.name} ${record.target}`;
      if (
        covered.some(
          ([name, target, prefix]) =>
            name === row.name &&
            target === record.target &&
            (!prefix || record.text.startsWith(prefix)),
        )
      ) {
        coveredCount += 1;
        expect(record.outputs, key).toEqual([]);
        expect(record.rationale, key).toContain('Explicit covered/no-output');
      } else expect(record.outputs.length, key).toBeGreaterThan(0);
    }
    expect(description).toMatchObject({
      kind: 'description',
      text: row.mechanicsReview.descriptionText,
    });
    const parts = description!.outputs.flatMap((output) =>
      output.kind === 'note' ? [output.text] : [],
    );
    // Variant Aasimar Abilities' d% table runs past 4096 characters, so its
    // Note is split at line boundaries.
    expect(parts, row.name).toHaveLength(
      row.name === 'Variant Aasimar Abilities' ? 3 : 1,
    );
    for (const part of parts) {
      expect(part.length, row.name).toBeLessThanOrEqual(4096);
      for (const markup of [
        '@UUID',
        '@Distance',
        '@Toggle',
        '@Condition',
        '[[',
      ])
        expect(part, row.name).not.toContain(markup);
    }
    const texts = (entry(row.externalKey).situationalNotes ?? []).map(
      (note) => note.text,
    );
    for (const part of parts) expect(texts, row.name).toContain(part);
  }
  expect(coveredCount).toBe(covered.length);
  expect(required).toBe(35);
  // Notes the Foundry data put on unrelated statistics are entry-level.
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
  // The Notes read Foundry enrichers as text: Breath Weapon's shapes.
  const breath = (entry('Breath Weapon (Dwarf)').situationalNotes ?? [])
    .map((note) => note.text)
    .join(' ');
  expect(breath).toContain('15-foot cone');
  expect(breath).toContain('20-foot line');
  // Every record lists its outstanding calculations, never as a hold.
  for (const row of assessedTraits) {
    expect(
      row.mechanicsReview.outstandingCalculations.length,
      row.name,
    ).toBeGreaterThan(0);
    for (const text of row.mechanicsReview.outstandingCalculations)
      expect(row.holdIds.join(' '), row.name).not.toContain(text);
  }
  // Imported bonus types the text contradicts, and the half-elf exchange
  // line, are listed for review rather than fixed.
  for (const name of [
    'Keen Senses (Triaxian)',
    'Emotionless',
    'Inspire Imitation',
  ])
    expect(
      candidate(name).mechanicsReview.sourceDiscrepancies.join(' '),
      name,
    ).toMatch(/listed for review/i);
  // No record of this batch grants a weapon or armor proficiency.
  for (const row of assessedTraits) {
    expect(row.mechanicsReview.proficiencyReview.grants, row.name).toEqual([]);
    expect(entry(row.name).proficiencies ?? [], row.name).toEqual([]);
  }
});

it('records the race, alternate-trait, monster-ability and Unchained notice dependencies and enforces every hold', () => {
  const held = new Map(heldNotices.map((row) => [row.id, row.notices]));
  const holdId = (book: string) =>
    `racial-traits-397-notice-${book}-complete-chain`;
  for (const row of assessedTraits) {
    expect(row.requiredNotices.at(-1), row.name).toBe('PZO1110');
    for (const cited of row.citedSources)
      expect(row.requiredNotices, row.name).toContain(cited.book);
    for (const linked of row.linkedContentReview)
      for (const book of linked.sources)
        expect(row.requiredNotices, row.name).toContain(book.id);
    // The race record's books (Race abilities).
    const races = row.inheritedRuleNotices.filter((notice) =>
      notice.location.includes('/packs/races/'),
    );
    expect(races.length, row.name).toBeGreaterThan(0);
    for (const notice of races)
      expect(row.requiredNotices, row.name).toContain(notice.book);
    // Every alternate records the APG exchange framework.
    const framework = row.inheritedRuleComparisonEvidence.find(
      (comparison) => comparison.line === 86,
    );
    if (row.racialTraitKind === 'alt') {
      expect(row.requiredNotices, row.name).toContain('PZO1115');
      expect(framework?.literalRow, row.name).toContain(
        'This racial trait replaces the intimidating racial trait',
      );
    } else expect(framework, row.name).toBeUndefined();
    if (row.disposition === 'admitted') {
      // #328 S4-B: the launch comparison supersedes the whole-content
      // hold, and the notice chains are reviewed (PZO1110), cleared
      // (PZO1121) or confirmed (PZO9280), so the row records no hold.
      expect(row.holdIds, row.name).toEqual([]);
      expect(row.noticeHoldIds, row.name).toEqual([]);
      continue;
    }
    expect(row.holdIds, row.name).toEqual([
      `racial-traits-397-whole-content-${row.externalKey.split('/')[1]}`,
    ]);
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices.filter((book) => book !== 'PZO1110').map(holdId),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  expect(
    assessedTraits.filter((row) => row.racialTraitKind === 'alt'),
  ).toHaveLength(41);
  // Lashunta Magic's folder binds no race (raceKeys empty): both Lashunta
  // race records' books are recorded from the folder.
  expect(entry('Lashunta Magic').detail.raceKeys).toEqual([]);
  expect(
    candidate('Lashunta Magic').inheritedRuleNotices.filter((notice) =>
      notice.location.includes('/packs/races/'),
    ).length,
  ).toBeGreaterThan(1);
  // Universal monster rules the bodies grant or name take the earliest book
  // their pinned Universal Monster Rules journal page lists.
  for (const [name, book, page] of [
    ['Low-Light Vision (Triaxian)', 'PZO1112', 'Low-Light Vision'],
    ['Low-Light Vision (Human)', 'PZO1112', 'Low-Light Vision'],
    ['Senses (Svirfneblin)', 'PZO1127', 'Darkvision'],
    ['Senses (Svirfneblin)', 'PZO1112', 'Low-Light Vision'],
    ['Darkvision (Yaddithian)', 'PZO1127', 'Darkvision'],
    ['Blended View (Gnome)', 'PZO1127', 'Darkvision'],
    ['Dusksight (Elf)', 'PZO1112', 'Low-Light Vision'],
    ['Languages (Astomoi)', 'PZO1112', 'Telepathy'],
    ['Ferocity (Green Martian)', 'PZO1112', 'Ferocity'],
    ['Breath Weapon (Dwarf)', 'PZO1112', 'Breath Weapon'],
    [
      'pf1-content/ZP4KHOyP79pyrBpj' /* Warded Skin (Rainkin) */,
      'PZO1112',
      'Spell Resistance',
    ],
    ['Creepy Doll', 'PZO1116', 'Freeze'],
    ['Werebear-Kin (Coldborn)', 'PZO1112', 'Natural Attacks'],
    ['Variant Aasimar Abilities', 'PZO1116', 'Unnatural Aura'],
  ] as const)
    expect(
      candidate(name).inheritedRuleNotices.some(
        (notice) =>
          notice.book === book &&
          notice.location.includes('universal-monster-rules-umr') &&
          notice.rule.length > 0,
      ) && candidate(name).requiredNotices.includes(book),
      `${name} ${page}`,
    ).toBe(true);
  // Rules the bodies depend on: the APG shadow and deep earth bloodlines,
  // the Ultimate Magic shadow descriptor the body cites, the Occult
  // Adventures mesmerist and Psychic Sensitivity, and Ultimate Equipment's
  // holy weapon special ability one Variant Aasimar result links.
  for (const [name, book] of [
    ['Shadow Sorcery', 'PZO1115'],
    ['Shadow Sorcery', 'PZO1117'],
    ['Gemsoul (Crystal Oread)', 'PZO1115'],
    ['Mental Potency', 'PZO1132'],
    ['Occult Scion', 'PZO1132'],
    ['Variant Aasimar Abilities', 'PZO1123'],
    ['Giant Hunter', 'PZO9232'],
  ] as const)
    expect(candidate(name).requiredNotices, name).toContain(book);
  // Unchained action-cost metadata anywhere in the bound closure requires
  // the held PZO1131.
  const unchained = [...new Set([...unchainedOwn, ...unchainedBound])].sort();
  expect(unchained).toHaveLength(24);
  expect(
    assessedTraits
      .filter((row) => row.requiredNotices.includes('PZO1131'))
      .map((row) => row.externalKey)
      .sort(),
  ).toEqual(unchained);
  for (const row of assessedTraits) {
    const own =
      (
        row.sourceFields.actions as
          | { activation?: { unchained?: unknown } }[]
          | undefined
      )?.some((action) => action.activation?.unchained) ?? false;
    expect(own, row.name).toBe(unchainedOwn.includes(row.externalKey));
    const rules = row.inheritedRuleNotices
      .filter((notice) => notice.book === 'PZO1131')
      .map((notice) => notice.rule);
    expect(
      rules.some((rule) => rule.includes("racial trait's own action")),
      row.name,
    ).toBe(own);
    expect(
      rules.some((rule) => rule.includes('on the bound')),
      row.name,
    ).toBe(unchainedBound.includes(row.externalKey));
  }
  // Creature types and subtypes have no pinned rules record: named
  // unresolved origins.
  for (const name of [
    'Aberration',
    'Type',
    'Dragon',
    'Plant',
    'Scion of Shadows',
    'Giant Hunter',
    'Barrow Warden',
    'Surfacer Antagonist',
  ])
    expect(
      candidate(name).inheritedRuleUnresolvedOrigins.join(' '),
      name,
    ).toContain('Creature type and subtype rules');
  // Rejected rows and PCGen leads don't add books: the Horror Adventures
  // deep jungle halfling row leaves Languages (Halfling) on its race's
  // books, the People of the North row leaves Snowcaster Elves on its own,
  // and Giant Hunter follows its ARG row with the Rival Guide row (a book the
  // record cites) as a lead.
  expect(candidate('Languages (Halfling)').requiredNotices).not.toContain(
    'PZO1135',
  );
  expect(candidate('Snowcaster Elves').requiredNotices).not.toContain(
    'PZO9428',
  );
  expect(candidate('Giant Hunter').comparison?.book).toBe('PZO1121');
  expect(
    candidate('Giant Hunter').additionalComparisonLeads.map((row) => row.book),
  ).toEqual(['PZO9232']);
  for (const row of review.noticeRequirements) {
    if (row.book === 'PZO1110') {
      expect(row.holdId).toBeNull();
      continue;
    }
    expect(held.get(row.holdId ?? ''), row.book).toEqual([
      row.book,
      ...row.registryKeys.filter((key) => key !== row.book),
    ]);
    for (const key of row.candidates) {
      const trait = assessedTraits.find((trait) => trait.externalKey === key);
      // #328 S4-B: an admitted trait stays in its batch's notice row as
      // history, with no hold of its own.
      if (trait?.disposition === 'admitted')
        expect(trait.noticeHoldIds, trait.name).toEqual([]);
      else expect(trait?.noticeHoldIds).toContain(row.holdId);
    }
  }
});

it('records the importer reading of every race, replacement and unresolved name', () => {
  for (const row of assessedTraits) {
    const detail = entry(row.externalKey).detail;
    const reviewed = row.mechanicsReview.racialTraitReview;
    expect(reviewed.raceKeys, row.name).toEqual(detail.raceKeys);
    expect(reviewed.standard, row.name).toBe(detail.standard);
    expect(reviewed.replaces, row.name).toEqual(detail.replaces ?? []);
    expect(reviewed.unresolvedReplacements, row.name).toEqual(
      detail.unresolvedReplacements ?? [],
    );
    expect(reviewed.kind, row.name).toBe(row.racialTraitKind);
    expect(detail.standard, row.name).toBe(row.racialTraitKind === 'std');
  }
  const unresolved = Object.fromEntries(
    assessedTraits
      .filter(
        (row) => entry(row.externalKey).detail.unresolvedReplacements?.length,
      )
      .map((row) => [
        row.externalKey,
        entry(row.externalKey).detail.unresolvedReplacements,
      ]),
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
  // Breath Weapon (Dwarf) replaces four dwarf traits, Spiritual Support two;
  // Tree-Born resolves the gathlain's aliases; the curated heritage lines
  // resolve "Base Statistics" to their race's ability score trait.
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
});

it('pins all 100 keys, the complete bodies, checked bindings and literal PCGen and PRD evidence in the shared store', async () => {
  expect(review.candidates).toHaveLength(100);
  expect(new Set(review.candidates.map((row) => row.externalKey)).size).toBe(
    100,
  );
  expect(review.counts).toEqual({
    total: 100,
    admitted: 4,
    held: 78,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 18,
    excludedFolders: 6,
    excludedRaceBuilder: 12,
    recordLevel35Holds: 0,
  });
  for (const row of excludedRows) {
    const raw = upstreamRecord.parse(
      parse(await readPinned(row.source.repo, row.source.path)),
    );
    if (row.kind === 'folder')
      expect(raw._key, row.name).toBe(`!folders!${raw._id}`);
    // The Race Builder subtree's Other folder is a folder record too.
    else {
      expect(row.folderPath[0], row.name).toBe('Race Builder');
      expect(raw._key, row.name).toBe(`!items!${raw._id}`);
    }
  }
  expect(preview.entries).toHaveLength(82);
  for (const row of review.candidates) {
    const bytes = await readPinned(row.source.repo, row.source.path);
    expect(sha(bytes), row.externalKey).toBe(row.source.sha256);
    const raw = upstreamRecord.parse(parse(bytes));
    expect(raw._id).toBe(row.externalKey.split('/')[1]);
    expect(raw.name).toBe(row.name);
    if (row.disposition === 'excluded') continue;
    expect(raw.system).toEqual(row.sourceFields);
    expect(row.sourceFields.tags ?? []).not.toContain('3.5');
    const description = sourceDescription(raw);
    expect(sha(description)).toBe(row.descriptionSha256);
    expect(description).toBe(row.mechanicsReview.descriptionText);
    for (const reviewed of row.mechanicsReview.curationRecords) {
      expect(reviewed).toMatchObject({
        status: 'checked',
        reviewedBy: 'Opus (AI curator) for the owner',
        reviewedOn: '2026-10-20',
      });
      expect(sha(reviewed.text)).toBe(reviewed.textSha256);
      expect(
        reviewedCuration.records.find(
          (current) =>
            current.externalKey === row.externalKey &&
            current.kind === reviewed.kind &&
            current.target === reviewed.target &&
            current.textSha256 === reviewed.textSha256,
        ),
      ).toEqual(reviewed);
    }
    expect(entry(row.externalKey).sources).toEqual(row.citedSources);
  }
  for (const row of assessedTraits)
    for (const linked of row.linkedContentReview)
      expect(sha(await readPinned(linked.repo, linked.path)), linked.name).toBe(
        linked.sha256,
      );
  const files = new Map(
    review.comparisonSources.pcgenFiles.map((file) => [file.path, file.sha256]),
  );
  for (const [path, digest] of files) {
    const bytes = await readFile(`tests/fixtures/pinned/pcgen/${path}`);
    expect(sha(bytes), path).toBe(digest);
  }
  for (const row of assessedTraits) {
    for (const comparison of [
      row.comparison,
      ...row.additionalComparisonLeads,
      ...row.rejectedRootComparisonEvidence,
      ...row.inheritedRuleComparisonEvidence,
    ]) {
      if (!comparison) continue;
      expect(files.get(comparison.path)).toBe(comparison.comparisonFileSha256);
      const lines = (
        await readFile(`tests/fixtures/pinned/pcgen/${comparison.path}`, 'utf8')
      ).split(/\r?\n/);
      expect(lines[comparison.line - 1]).toBe(comparison.literalRow);
      expect(sha(comparison.literalRow)).toBe(comparison.comparisonLineSha256);
      if (!comparison.publicationAnchor) {
        // Core Essentials support rows name no book.
        expect(comparison.path, row.name).toContain('/core_essentials/');
        continue;
      }
      const { path, line, text, sha256 } = comparison.publicationAnchor;
      expect(files.get(path)).toBe(sha256);
      const publication = await readFile(
        `tests/fixtures/pinned/pcgen/${path}`,
        'utf8',
      );
      expect(publication.split(/\r?\n/)[line - 1]?.split('\t')[0]).toBe(text);
    }
    // The PRD paragraph is literally on the pinned capture page.
    const prd = row.prdComparison;
    if (!prd) continue;
    const page = await readPinned('prd', prd.path);
    expect(sha(page), prd.path).toBe(prd.pageSha256);
    expect(page, row.name).toContain(prd.literalParagraph);
    expect(sha(prd.literalParagraph)).toBe(prd.paragraphSha256);
    expect(prd.textMatches, row.name).toBe(prd.wordDifferences.length === 0);
  }
  expect(assessedTraits.filter((row) => row.prdComparison)).toHaveLength(18);
  expect(
    assessedTraits
      .filter((row) => row.prdComparison && !row.prdComparison.textMatches)
      .map((row) => row.name)
      .sort(),
  ).toEqual([
    'Fire Affinity',
    'Illusion Resistance',
    'Languages (Gnome)',
    'Languages (Halfling)',
    'Mountain Dwarf',
    'Savage Elf',
    'Spell-Like Ability (Oread)',
  ]);
  // Illusion Resistance's "get ... on saving throws ... or" where the PRD
  // reads "gain ... saving throw ... and": recorded, not resolved.
  expect(
    candidate('Illusion Resistance').prdComparison?.wordDifferences,
  ).toEqual([
    { pinned: 'get', prd: 'gain' },
    { pinned: '', prd: 'saving throw' },
    { pinned: 'on saving throws', prd: '' },
    { pinned: 'or', prd: 'and' },
  ]);
  // The deep jungle halfling's Horror Adventures row is a different body,
  // kept as a rejected row.
  expect(
    candidate('Languages (Halfling)').rejectedRootComparisonEvidence.map(
      (row) => [row.book, row.line],
    ),
  ).toEqual([['PZO1135', 91]]);
});

it('reextracts the reviewed mechanics from a clean shared fixture tree and keeps every racial trait held on its own holds', async () => {
  const tree = await materializePinnedTree(pinnedFiles, {
    sha256: pinnedSha256,
  });
  try {
    const artifact = await importCatalog({
      ...tree,
      remaps,
      curation: reviewedCuration,
      candidateKeys: review.candidates.map((row) => row.externalKey),
    });
    expect(artifact.curation.missing).toEqual([]);
    expect(artifact.curation.stale).toEqual([]);
    expect(artifact.curation.summary).toMatchObject({
      required: 35,
      checked: 35,
      missing: 0,
      descriptions: { candidates: 82, checked: 82 },
    });
    expect(
      artifact.catalog.entries.map((row) => row.externalKey).sort(),
    ).toEqual(assessedTraits.map((row) => row.externalKey).sort());
    // A bounded import extracts no race, so the race changes the full import
    // relocates onto a standard trait are absent here.
    for (const row of artifact.catalog.entries) {
      const saved = entry(row.externalKey);
      expect(
        { description: row.description, sources: row.sources },
        row.name,
      ).toEqual({ description: saved.description, sources: saved.sources });
      if (!RELOCATED_FROM_RACE.includes(row.externalKey)) {
        expect(row.modifiers, row.name).toEqual(saved.modifiers);
        expect(row.situationalNotes, row.name).toEqual(saved.situationalNotes);
      } else
        // The race's re-homed note text is absent too; the trait's own Notes
        // are the same.
        for (const note of row.situationalNotes ?? [])
          expect(saved.situationalNotes, row.name).toContainEqual(note);
    }
    // The assessments are bound against the full-corpus content closure: the
    // committed entries and the entries their closures reach.
    const authoritative = {
      ...artifact,
      catalog: {
        ...artifact.catalog,
        entries: [
          ...preview.entries,
          ...preview.closure,
        ] as unknown as typeof artifact.catalog.entries,
      },
    };
    const ours = new Set(assessedTraits.map((row) => row.externalKey));
    const gate = assessWithUnclearedHolds({
      artifact: authoritative,
      ...reviewedAdmission,
    });
    // #328 S4-B confirms the batch's Half-Elf, Elf, Gnome and Halfling
    // standard traits. Without the owner's notice clearances (this gate) they
    // stay held on their notice chains; the committed gate admits them.
    const admittedKeys = new Set(admittedTraits.map((row) => row.externalKey));
    expect(gate.admitted.filter((row) => ours.has(row.externalKey))).toEqual(
      [],
    );
    expect(
      assessCatalogAdmission({ artifact: authoritative, ...reviewedAdmission })
        .admitted.filter((row) => ours.has(row.externalKey))
        .map((row) => row.externalKey)
        .sort(),
    ).toEqual([...admittedKeys].sort());
    for (const row of gate.held.filter((row) =>
      admittedKeys.has(row.externalKey),
    ))
      expect(row.reason, row.name).toMatch(
        /Notice holds|Missing or unreviewed required notices/,
      );
    // Only Creepy Doll's stripped monster-abilities link fails (an import
    // gap that doesn't depend on curation); every other record is held on its
    // own reasons.
    expect(
      gate.failures
        .filter((row) => ours.has(row.externalKey))
        .map((row) => [row.externalKey, row.reason])
        .sort(),
    ).toEqual(
      UNRESOLVED_LINK_GAP.map((key) => [
        key,
        'Broken structure or reference: unresolved imported reference.',
      ]),
    );
    const held = gate.held.filter(
      (row) => ours.has(row.externalKey) && !admittedKeys.has(row.externalKey),
    );
    expect(held).toHaveLength(82 - UNRESOLVED_LINK_GAP.length - 4);
    // The Dynamite comics source-matched hold (known-notice-holds.json,
    // #227/#241) wins over the batch hold for the Green Martian record.
    for (const row of held)
      if (row.name === 'Ferocity (Green Martian)')
        expect(row.reason).toContain('Known notice/evidence hold');
      else
        expect(row.reason, row.name).toBe(candidate(row.externalKey).rationale);
    for (const row of assessedTraits) {
      const assessment = reviewedAdmission.assessments.find(
        (a) => a.externalKey === row.externalKey,
      );
      expect(assessment).toMatchObject({
        status: row.assessmentStatus,
        ...bindSnapshotToCurrentNotices(row.currentBinding),
        requiredNotices: row.requiredNotices,
      });
      expect(
        buildAssessmentBinding({
          artifact: authoritative,
          entry: authoritative.catalog.entries.find(
            (candidate) => candidate.externalKey === row.externalKey,
          )!,
          requiredNotices: row.requiredNotices,
          evidenceIds: [row.evidenceId],
          ...reviewedAdmission,
        }),
      ).toEqual(bindSnapshotToCurrentNotices(row.currentBinding));
    }
    // Confirming a CRB-cited standard trait's whole content still holds it on
    // its other books' held notices. (#328 S4-B admits Keen Senses (Halfling), the
    // earlier control, so a still-held standard trait stands in.)
    const keen = candidate('Duergar Immunities');
    expect(keen.disposition).toBe('held');
    expect(keen.requiredNotices).toEqual([
      'PZO9280',
      'PZO1112',
      'PZO1121',
      'PZO1110',
    ]);
    const confirmed = assessWithUnclearedHolds({
      artifact: authoritative,
      ...reviewedAdmission,
      assessments: reviewedAdmission.assessments.map((row) =>
        row.externalKey === keen.externalKey
          ? { ...row, status: 'confirmed' as const }
          : row,
      ),
    });
    expect(
      confirmed.admitted.some((row) => row.externalKey === keen.externalKey),
    ).toBe(false);
    expect(
      confirmed.held.find((row) => row.externalKey === keen.externalKey)
        ?.reason,
    ).toMatch(/Notice holds|Missing or unreviewed required notices/);
  } finally {
    await tree.dispose();
  }
});
