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
} from '../fixtures/racial-traits-390/data';
import {
  previewEntry,
  racialTraitSheet,
  sheetDefinition,
} from '../fixtures/racial-traits-390/sheet';
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
  'pf1-content/AO5nhhUfI1b4M37H', // Hardy
  'pf1-content/CKxKRzXRJPG1TCu0', // Hatred (Svirfneblin)
  'pf1-content/CbGMxMkn1Zm56fqP', // Rodent Empathy
  'pf1-content/DLslPcoXcnvQjIPH', // +2 Natural Armor (Ghoran)
];
// #738 keeps every rules journal link as text: no journal-link gap is left.
const JOURNAL_LINK_GAP: string[] = [];
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
// body (a replaced trait, a linked spell or a body two links away), or both.
const unchainedOwn = [
  'pf1-content/Ax9nTBosPUTxsSm8', // Energy Strike (Fire)
  'pf1-content/BFUKz38eVbL0HHi0', // Magic Resistant
  'pf1-content/BRLeKQsuAdgeFbYa', // Toxic Skin
  'pf1-content/BoKaaVK4wgIJW1i9', // Spell-Like Ability (Tiefling)
  'pf1-content/CPsAbeWBokaEiZly', // Secret Strider
  'pf1-content/CmBe4LyfyjQ24hCA', // Jet (Cecaelia)
  'pf1-content/Cnfo5E1FQnEHb2r2', // Change Shape (Rougarou)
  'pf1-content/D7JILr96IKHWN4vQ', // Halfling Jinx
];
const unchainedBound = [
  'pf1-content/Awm5U8aA0n8RoC5o', // Sacred Tattoo (Orc Ferocity)
  'pf1-content/Ax9nTBosPUTxsSm8',
  'pf1-content/AzCeQSKFPUO7wO2u', // Light Sensitivity (Kuru) (daylight)
  'pf1-content/BE3QYzPCTLBEaGzv', // Forlorn Elves (Envoy and its spells)
  'pf1-content/BZvAxBgK3Qcj0J99', // Whispering Wind (Spell-Like Ability (Sylph))
  'pf1-content/BgNdXPtHRUJOuPwF', // Oni-Spawn (through the tiefling's traits)
  'pf1-content/BoKaaVK4wgIJW1i9',
  'pf1-content/Cnfo5E1FQnEHb2r2',
  'pf1-content/DFWkrIYLx6L7Vs6W', // Smokesoul (blurred movement, the sylph's traits)
  'pf1-content/DhiYQkB9XHcThkS8', // Tremorsense (Frenzy)
];

it('resolves the reviewed racial trait Modifiers through the public resolver', () => {
  // The two heritages curated with their ability lines replace their race's
  // ability score trait: it goes dormant, and their own adjustments count.
  for (const [name, race, before, after] of [
    [
      'Oni-Spawn (Hungerseed)',
      'Tiefling',
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
    const raceKey = heritage.detail.raceKeys?.[0];
    if (!raceKey) throw new Error(`${name} has no race`);
    const abilityTrait = `local/race-ability-scores/${raceKey}`;
    expect(heritage.detail.replaces, name).toEqual([abilityTrait]);
    expect(heritage.detail.unresolvedReplacements, name).toBeUndefined();
    expect(previewEntry(race).externalKey).toBe(raceKey);
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
  // The other changeling and elf subraces keep "Base Statistics" unmatched
  // and carry no Modifier.
  for (const name of ['Night-Born (Moon May)', 'Forlorn Elves']) {
    expect(entry(name).modifiers, name).toEqual([]);
    expect(entry(name).detail.unresolvedReplacements, name).toEqual([
      'Base Statistics',
    ]);
  }
  // Situational bonuses apply only when their Situation is selected.
  for (const [name, target, base, label, value] of [
    ['Lasting Grudge', 'attack.melee', 'attack', '1 day ago', 1],
    ['Driven Worker', 'skill.crf', 'skill.crf', 'Craft skill', 4],
    ['Driven Worker', 'skill.prf', 'skill.prf', 'Perform skill', 4],
    ['Driven Worker', 'skill.pro', 'skill.pro', 'Profession skill', 4],
    ['Magic Resistant', 'concentration', 'concentration', 'arcane spells', -2],
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
        modifiers(name).map((row) => JSON.stringify(row.condition?.situation)),
      ).size,
      name,
    ).toBe(1);
  }
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
  // The Brine May ability record replaces the changeling's own ability trait
  // by name: it goes dormant and the untyped line counts.
  const brine = entry('Ability Modifiers (Changeling - Brine May)');
  const changelingAbilities = 'pf1-content/PxjUu8YOjXmWdagL';
  expect(brine.detail.replaces).toEqual([changelingAbilities]);
  const changeling = brine.detail.raceKeys?.[0];
  if (!changeling) throw new Error('Brine May has no race');
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
  // Sure Step replaces Keen Senses (Drow): its imported +2 Perception goes
  // dormant.
  const step = entry('Sure Step (Drow)');
  const keen = entry('Keen Senses (Drow)');
  expect(step.detail.replaces).toEqual([keen.externalKey]);
  const drow = step.detail.raceKeys?.[0];
  if (!drow) throw new Error('Sure Step has no race');
  const plain = identityRace(racialTraitSheet({}), drow, [keen.externalKey]);
  const stepped = identityRace(
    racialTraitSheet({ traits: [step.externalKey] }),
    drow,
    [keen.externalKey],
  );
  expect(total(plain, 'skill.per')).toBe(2);
  expect(total(stepped, 'skill.per')).toBe(0);
  // Pyrophile's fire spell damage stays a Note: no spell DC Modifier.
  expect(entry('Pyrophile').modifiers).toEqual([]);
  // No armor, shield or natural armor bonus sits on ac.other.
  for (const row of preview.entries)
    for (const modifier of row.modifiers)
      if (['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType))
        expect(modifier.target, row.name).not.toBe('ac.other');
});

it('checks every required note record and the separate description pass against the pinned bodies', () => {
  let required = 0;
  for (const row of assessedTraits) {
    const [description, ...notes] = row.mechanicsReview.curationRecords;
    required += notes.length;
    for (const record of row.mechanicsReview.curationRecords) {
      expect(record.status, row.name).toBe('checked');
      expect(record.diagnostics, row.name).toEqual([]);
      expect(JSON.stringify(record.outputs), row.name).not.toContain(
        PLACEHOLDER,
      );
      if (!record.outputs.length)
        expect(record.rationale, row.name).toContain(
          'Explicit covered/no-output',
        );
    }
    expect(description).toMatchObject({
      kind: 'description',
      text: row.mechanicsReview.descriptionText,
    });
    const parts = description!.outputs.flatMap((output) =>
      output.kind === 'note' ? [output.text] : [],
    );
    expect(parts, row.name).toHaveLength(1);
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
  expect(required).toBe(37);
  // Repeated notes are the explicit covered/no-output records.
  expect(
    assessedTraits.flatMap((row) =>
      row.mechanicsReview.curationRecords
        .filter((record) => !record.outputs.length)
        .map((record) => `${row.name} ${record.target}`),
    ),
  ).toEqual(['Hag Racial Trait (Changeling - Veil May) skill.dip']);
  // Race-covered trait notes have no required record of their own.
  for (const name of ['Hardy', 'Hatred (Svirfneblin)', 'Rodent Empathy'])
    expect(candidate(name).mechanicsReview.curationRecords, name).toHaveLength(
      1,
    );
  // Notes the Foundry data put on unrelated statistics are entry-level.
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
  // The drafter's wild empathy Diplomacy Modifier and spell DC Modifier are
  // not used.
  expect(
    modifiers('Alternate Skill Modifiers (Skinwalker - Witchwolf)').map(
      (row) => row.target,
    ),
  ).toEqual(['skill.per']);
  // Every record lists its outstanding calculations, never as a hold.
  for (const row of assessedTraits) {
    expect(
      row.mechanicsReview.outstandingCalculations.length,
      row.name,
    ).toBeGreaterThan(0);
    for (const text of row.mechanicsReview.outstandingCalculations)
      expect(row.holdIds.join(' '), row.name).not.toContain(text);
  }
  // Weapon proficiencies are imported from the record's weaponProf field.
  expect(
    candidate('Chain Fighter').mechanicsReview.proficiencyReview.grants,
  ).toEqual(['Light Flail', 'Heavy Flail']);
  expect(
    (entry('Chain Fighter').proficiencies ?? []).map((row) =>
      'baseType' in row ? row.baseType : null,
    ),
  ).toEqual(expect.arrayContaining(['Light Flail', 'Heavy Flail']));
  for (const row of assessedTraits)
    if (row.name !== 'Chain Fighter')
      expect(row.mechanicsReview.proficiencyReview.grants, row.name).toEqual(
        [],
      );
  // Bonus feat grants are listed as outstanding, not curated.
  for (const name of ['Starchild', 'Grabbing Appendages']) {
    expect(entry(name).modifiers, name).toEqual([]);
    expect(entry(name)).not.toHaveProperty('grantsSlots');
    expect(
      entry(name).unsupported?.some(
        (issue) =>
          issue.field === 'changes' &&
          JSON.stringify(issue.value).includes('bonusFeats'),
      ),
      name,
    ).toBe(true);
  }
});

it('records the race, alternate-trait, monster-ability and Unchained notice dependencies and enforces every hold', () => {
  const held = new Map(heldNotices.map((row) => [row.id, row.notices]));
  const holdId = (book: string) =>
    `racial-traits-390-notice-${book}-complete-chain`;
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
      // #328 S4-A: the launch comparison supersedes the whole-content
      // hold, and the notice chains are reviewed (PZO1110), cleared
      // (PZO1121) or confirmed (PZO9280), so the row records no hold.
      expect(row.holdIds, row.name).toEqual([]);
      expect(row.noticeHoldIds, row.name).toEqual([]);
      continue;
    }
    expect(row.holdIds, row.name).toEqual([
      `racial-traits-390-whole-content-${row.externalKey.split('/')[1]}`,
    ]);
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices.filter((book) => book !== 'PZO1110').map(holdId),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  expect(
    assessedTraits.filter((row) => row.racialTraitKind === 'alt'),
  ).toHaveLength(36);
  // Dwarf Traits depends on the dwarf alternate racial traits it lets the
  // duergar select: the Dwarf race's book is recorded and required.
  expect(
    candidate('Dwarf Traits').inheritedRuleNotices.some(
      (notice) =>
        notice.book === 'PZO1110' &&
        notice.location.includes('/packs/races/dwarf.'),
    ),
  ).toBe(true);
  // Universal monster rules the bodies grant take the earliest book their
  // pinned Universal Monster Rules journal page lists.
  for (const [name, book, page] of [
    ['Darkvision (Ifrit)', 'PZO1127', 'Darkvision'],
    ['Darkvision (Kobold)', 'PZO1127', 'Darkvision'],
    ['Darkvision (Wayang)', 'PZO1127', 'Darkvision'],
    ['Darkvision (Cecaelia)', 'PZO1127', 'Darkvision'],
    ['Darkvision (Munavri)', 'PZO1127', 'Darkvision'],
    ['Darkvision (Merfolk)', 'PZO1127', 'Darkvision'],
    ['Darkvision (Merfolk)', 'PZO1112', 'Light Sensitivity'],
    ['Daysighted', 'PZO1127', 'Darkvision'],
    ['Light Sensitivity (Kuru)', 'PZO1112', 'Light Sensitivity'],
    ['Low-Light Vision (Wyvaran)', 'PZO1112', 'Low-Light Vision'],
    ['Surface Infiltrator', 'PZO1112', 'Low-Light Vision'],
    ['Keen Scent (Adaro)', 'PZO1112', 'Scent'],
    ['Tremorsense', 'PZO1112', 'Tremorsense'],
    ['Claws (Changeling)', 'PZO1112', 'Natural Attacks'],
    ['Fiendish Resistance', 'PZO1112', 'Resistance'],
    ['Energy Strike (Fire)', 'PZO1112', 'Resistance'],
    ['Magic Resistant', 'PZO1112', 'Spell Resistance'],
    ['Change Shape (Rougarou)', 'PZO1112', 'Change Shape'],
    ['Jet (Cecaelia)', 'PZO1116', 'Jet'],
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
  // Rules the bodies cite or depend on: the efreeti bloodline (Ultimate
  // Magic), the Ash and Smoke subdomains and the shadow and verdant
  // bloodlines (APG), the dirty trick maneuver (APG), siege weapons (Ultimate
  // Combat), Psychic Sensitivity (Occult Adventures) and blurred movement
  // (Advanced Class Guide).
  for (const [name, book] of [
    ['Magma Affinity (Ifrit - Lavasoul)', 'PZO1117'],
    ['Magma Affinity (Ifrit - Lavasoul)', 'PZO1115'],
    ['Smokesoul (Fume Sylph)', 'PZO1115'],
    ['Smokesoul (Fume Sylph)', 'PZO1129'],
    ['Fertile Soil', 'PZO1115'],
    ['Dirty Trickster', 'PZO1115'],
    ['Evasive Maneuvers', 'PZO1118'],
    ['Starchild', 'PZO1132'],
  ] as const)
    expect(candidate(name).requiredNotices, name).toContain(book);
  // Unchained action-cost metadata anywhere in the bound closure requires
  // the held PZO1131.
  const unchained = [...new Set([...unchainedOwn, ...unchainedBound])].sort();
  expect(unchained).toHaveLength(15);
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
  // Creature types have no pinned rules record: named unresolved origins.
  for (const name of ['Monstrous Humanoid (Trox)', 'Shadow Foe'])
    expect(
      candidate(name).inheritedRuleUnresolvedOrigins.join(' '),
      name,
    ).toContain('Creature type and subtype rules');
  // Rejected rows and PCGen leads don't add books: Bestiary 3's adaro row is
  // a lead in other wording, and the changeling's own hag trait row names no
  // book.
  expect(
    candidate('Speak with Sharks (Adaro)').additionalComparisonLeads.map(
      (row) => row.book,
    ),
  ).toEqual(['PZO1120']);
  expect(candidate('Speak with Sharks (Adaro)').requiredNotices).toEqual([
    'PZO9482',
    'PZO1110',
  ]);
  expect(
    candidate(
      'Hag Racial Trait (Changeling - Veil May)',
    ).rejectedRootComparisonEvidence.map((row) => row.book),
  ).toEqual([null]);
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
      // #328 S4-A: an admitted trait stays in its batch's notice row as
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
    // No header and no parent trait of the same name (importer gap).
    'pf1-content/AQYBioB3D1EbhppG': ['Magma Affinity (Ifrit - Lavasoul)'],
    // The changeling's trait is named "Hag Racial Trait (Changeling)".
    'pf1-content/BD8FBL0PfVe5qfrt': ['Hag Trait'], // Pyrophile
    // Racial subtypes keep their race's ability score trait.
    'pf1-content/BE3QYzPCTLBEaGzv': ['Base Statistics'], // Forlorn Elves
    'pf1-content/BNpMu00YoQaJyRUt': ['Base Statistics'], // Night-Born (Moon May)
  });
  // Swamp Leshy's header names unassuming foliage, which the body only
  // alters; the importer reads both names as replaced (listed for review).
  expect(entry('Swamp Leshy').detail.replaces).toHaveLength(2);
});

it('pins all 100 keys, the complete bodies, checked bindings and literal PCGen and PRD evidence in the shared store', async () => {
  expect(review.candidates).toHaveLength(100);
  expect(new Set(review.candidates.map((row) => row.externalKey)).size).toBe(
    100,
  );
  expect(review.counts).toEqual({
    total: 100,
    admitted: 2,
    held: 72,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 26,
    excludedFolders: 10,
    excludedRaceBuilder: 16,
    recordLevel35Holds: 0,
  });
  for (const row of excludedRows) {
    const raw = upstreamRecord.parse(
      parse(await readPinned(row.source.repo, row.source.path)),
    );
    if (row.kind === 'folder')
      expect(raw._key, row.name).toBe(`!folders!${raw._id}`);
    else {
      expect(row.folderPath[0], row.name).toBe('Race Builder');
      expect(raw._key, row.name).toBe(`!items!${raw._id}`);
    }
  }
  expect(preview.entries).toHaveLength(74);
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
        reviewedOn: '2026-10-19',
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
  expect(assessedTraits.filter((row) => row.prdComparison)).toHaveLength(20);
  expect(
    assessedTraits
      .filter((row) => row.prdComparison && !row.prdComparison.textMatches)
      .map((row) => row.name)
      .sort(),
  ).toEqual([
    '+2 to One Ability Score (Human)',
    'Chain Fighter',
    'Dual Minded',
    'Hardy',
    'Languages (Undine)',
    'Spell-Like Ability (Tiefling)',
    'Water Affinity',
  ]);
  // The tiefling's caster level reads "character level" in the pinned body
  // and "class level" in the PRD paragraph: recorded, not resolved.
  expect(
    candidate('Spell-Like Ability (Tiefling)').prdComparison?.wordDifferences,
  ).toContainEqual({ pinned: 'character', prd: 'class' });
  // Chain Fighter and Dual Minded follow their APG rows' wording; their APG
  // books are cited and required.
  for (const name of ['Chain Fighter', 'Dual Minded'])
    expect(
      candidate(name).additionalComparisonLeads.map((row) => row.book),
      name,
    ).toEqual(['PZO1115']);
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
      required: 37,
      checked: 37,
      missing: 0,
      descriptions: { candidates: 74, checked: 74 },
    });
    expect(
      artifact.catalog.entries.map((row) => row.externalKey).sort(),
    ).toEqual(assessedTraits.map((row) => row.externalKey).sort());
    // A bounded import extracts no race, so the race changes the full import
    // relocates onto a standard trait are absent here.
    for (const row of artifact.catalog.entries) {
      const saved = entry(row.externalKey);
      expect(
        {
          description: row.description,
          situationalNotes: row.situationalNotes,
          sources: row.sources,
        },
        row.name,
      ).toEqual({
        description: saved.description,
        situationalNotes: saved.situationalNotes,
        sources: saved.sources,
      });
      if (!RELOCATED_FROM_RACE.includes(row.externalKey))
        expect(row.modifiers, row.name).toEqual(saved.modifiers);
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
    const gate = assessCatalogAdmission({
      artifact: authoritative,
      ...reviewedAdmission,
    });
    // #328 S4-A admits the batch's Human, Dwarf and Half-Orc standard
    // traits; every other record stays held.
    expect(
      gate.admitted
        .filter((row) => ours.has(row.externalKey))
        .map((row) => row.externalKey)
        .sort(),
    ).toEqual(admittedTraits.map((row) => row.externalKey).sort());
    // #738 resolved the journal-link import gaps: no record fails, and
    // every record is held on its own reasons.
    expect(
      gate.failures
        .filter((row) => ours.has(row.externalKey))
        .map((row) => [row.externalKey, row.reason])
        .sort(),
    ).toEqual(
      JOURNAL_LINK_GAP.map((key) => [
        key,
        'Broken structure or reference: unresolved imported reference.',
      ]),
    );
    const held = gate.held.filter((row) => ours.has(row.externalKey));
    expect(held).toHaveLength(72);
    for (const row of held)
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
    // its other books' held notices.
    const dwarf = candidate('Hardy');
    expect(dwarf.requiredNotices).toEqual(['PZO9280', 'PZO1121', 'PZO1110']);
    // With its PCGen-confirmed books reviewed (2026-10-31), only the notice
    // holds the owner's clearance clears still hold it, so this runs uncleared.
    const confirmed = assessWithUnclearedHolds({
      artifact: authoritative,
      ...reviewedAdmission,
      assessments: reviewedAdmission.assessments.map((row) =>
        row.externalKey === dwarf.externalKey
          ? { ...row, status: 'confirmed' as const }
          : row,
      ),
    });
    expect(
      confirmed.admitted.some((row) => row.externalKey === dwarf.externalKey),
    ).toBe(false);
    expect(
      confirmed.held.find((row) => row.externalKey === dwarf.externalKey)
        ?.reason,
    ).toMatch(/Notice holds|Missing or unreviewed required notices/);
  } finally {
    await tree.dispose();
  }
});
