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
  evaluateFormula,
  parseFormula,
} from '../../src/lib/character-sheet-formulas';
import {
  review,
  assessedTraits,
  admittedTraits,
  excludedRows,
  preview,
  pinnedFiles,
  pinnedSha256,
} from '../fixtures/racial-traits-394/data';
import {
  previewEntry,
  racialTraitSheet,
  sheetDefinition,
} from '../fixtures/racial-traits-394/sheet';
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
  'pf1-content/Qx1JqPVW0quaOGfY', // Natural Armor (Changeling)
];
// Records whose description link the importer cannot resolve fail admission
// on that import gap in any preview (#738). This batch has none.
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
// body (a replaced trait, a linked spell or a body reached through its race),
// or both.
const unchainedOwn = [
  'pf1-content/OSKe4wubLjYQOswq', // Dragonmaw
  'pf1-content/OYQqWgVtw30JL2qT', // Spell-Like Abilities (Fetchling - Disguise Self)
  'pf1-content/OayRgLPHanjzhdK0', // Spell-Like Ability (Tiefling - Hellspawn)
  'pf1-content/OrBsTYxtz2gkCF62', // Change Size
  'pf1-content/OvR36pLkOfFeJVQZ', // Poison Minion (Half-Elf)
  'pf1-content/OyIvyI3x7V5HIzZL', // Orc Ferocity
  'pf1-content/P32v41a5IFStjrX2', // Experimental Body: Blessed
  'pf1-content/PEz0pdv3ODLB5O8A', // Hypnotic Gaze
  'pf1-content/PoeOzomLE0yQZG39', // Dreamspeaker
  'pf1-content/PpXi216y1kJgHY1C', // Frenzy
  'pf1-content/PpiI4GuDb2S5SPo6', // Spell-Like Ability (Aasimar - Idyllkin)
  'pf1-content/Q3bLl6S1s1r2Pgz9', // Spell-Like Ability (Sylph)
  'pf1-content/Q9DPJigrJ8kDDemn', // Fey Magic (Halfling)
  'pf1-content/QK5CNiDmMqT3cdFB', // Unlucky Halfling
  'pf1-content/Qgkfifudu74ghm0o', // Change Shape (Skinwalker - Witchwolf)
  'pf1-content/R0qRSOcfexnzVYYs', // Ghost Hunter
];
const unchainedBound = [
  'pf1-content/OYQqWgVtw30JL2qT', // Spell-Like Abilities (Fetchling - Disguise Self) (its linked spells)
  'pf1-content/OayRgLPHanjzhdK0', // Spell-Like Ability (Tiefling - Hellspawn) (pyrotechnics, the tiefling's Spell-Like Ability)
  'pf1-content/Ol8AbEHSbXnbj9eC', // Blasphemous Covenant (planar ally)
  'pf1-content/P32v41a5IFStjrX2', // Experimental Body: Blessed (its linked spells)
  'pf1-content/PEz0pdv3ODLB5O8A', // Hypnotic Gaze (hypnotism)
  'pf1-content/PKI1mYZltP1nWgBs', // Mountain Clan (Orc Ferocity, through Bestial)
  'pf1-content/PoeOzomLE0yQZG39', // Dreamspeaker (dream)
  'pf1-content/PpiI4GuDb2S5SPo6', // Spell-Like Ability (Aasimar - Idyllkin) (its spells and the aasimar's Spell-Like Ability)
  'pf1-content/Q3bLl6S1s1r2Pgz9', // Spell-Like Ability (Sylph) (feather fall)
  'pf1-content/QK5CNiDmMqT3cdFB', // Unlucky Halfling (ill omen)
  'pf1-content/Qgkfifudu74ghm0o', // Change Shape (Skinwalker - Witchwolf) (Change Shape (Skinwalker))
  'pf1-content/QkJI00xDaBcowq2i', // Deep Kin (Orc Ferocity, through Cavewight)
  'pf1-content/QuCU7zACopBCx8Ob', // Skilled (Kitsune) (Kitsune Magic and its spell)
];

it('resolves the reviewed racial trait Modifiers through the public resolver', () => {
  // Unlucky Halfling replaces Halfling Luck on the halfling sheet: the +1
  // racial bonus on saves goes dormant and the -1 penalty applies.
  const unlucky = entry('Unlucky Halfling');
  const halfling = unlucky.detail.raceKeys?.[0];
  if (!halfling) throw new Error('Unlucky Halfling has no race');
  expect(halfling).toBe('pf1/Hf31mrYb3uucNyLO');
  expect(previewEntry('Halfling Luck').externalKey).toBe(
    'pf1-content/HVI7FNwj2ng10qtj',
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
  // One chosen Knowledge skill: ten Modifiers, one Situation each; choosing
  // one leaves the other Knowledge skills unchanged.
  const memories = modifiers('Memories Beyond Death').filter((row) =>
    row.target.startsWith('skill.k'),
  );
  expect(memories).toHaveLength(10);
  const arcana = indexOf('Memories Beyond Death', 'skill.kar', 'arcana');
  expect(resolved('Memories Beyond Death', 'skill.kre', [arcana])).toBe(0);
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
  // Kindred-Raised's ability choice is the importer's ability.$choice
  // Modifier (#721), not a resolver statistic; nothing is curated on it.
  expect(entry('Kindred-Raised').modifiers).toEqual([
    { target: 'ability.$choice', bonusType: 'racial', value: 2 },
    { target: 'ability.cha', bonusType: 'untyped', value: 2 },
  ]);
  // Unlucky Halfling's -1 on saves is a reviewed untyped Modifier (the raw
  // untypedPerm change does not map).
  expect(resolved('Unlucky Halfling', 'save.fort')).toBe(-1);
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
  // Skilled (Kitsune)'s extra rank is read as one rank per level.
  expect(entry('Skilled (Kitsune)').detail.bonusSkillRanksPerLevel).toBe(1);
  // Notes carry the readable rules; no armor, shield or natural armor bonus
  // sits on ac.other.
  for (const row of preview.entries)
    for (const modifier of row.modifiers)
      if (['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType))
        expect(modifier.target, row.name).not.toBe('ac.other');
});

it('checks every required note record and the separate description pass against the pinned bodies', () => {
  // Foundry conChecks notes (drafted onto concentration) whose rule another
  // Note states: explicit covered/no-output records.
  const covered = new Set([
    'Orc Ferocity conChecks',
    'Aquatic Ancestry conChecks',
  ]);
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
      const key = `${row.name} ${record.target}`;
      if (covered.has(key)) {
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
  expect(required).toBe(31);
  // Notes the Foundry data put on unrelated statistics are entry-level.
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
  // The Notes follow the body: Resist Level Drain's "than" and "you took",
  // Aquatic Ancestry without the Foundry "(currently +...)" value.
  const drain = (entry('Resist Level Drain (Dhampir)').situationalNotes ?? [])
    .map((note) => note.text)
    .join(' ');
  expect(drain).toContain('more negative levels than you have Hit Dice');
  expect(drain).toContain('any negative levels you take are removed');
  const swim = (entry('Aquatic Ancestry').situationalNotes ?? [])
    .map((note) => note.text)
    .join(' ');
  expect(swim).toContain('always take 10 on Swim checks');
  expect(swim).not.toContain('currently');
  // Every record lists its outstanding calculations, never as a hold.
  for (const row of assessedTraits) {
    expect(
      row.mechanicsReview.outstandingCalculations.length,
      row.name,
    ).toBeGreaterThan(0);
    for (const text of row.mechanicsReview.outstandingCalculations)
      expect(row.holdIds.join(' '), row.name).not.toContain(text);
  }
  // Hag Racial Trait (Green Widow) stays a Note: every hag option is a
  // standard trait of the changeling race (#391 Crawling Skin).
  expect(
    candidate(
      'Hag Racial Trait (Changeling - Green Widow)',
    ).mechanicsReview.outstandingCalculations.join(' '),
  ).toContain('#719 race-total');
  // Weapon proficiencies are imported from the records' weaponProf fields;
  // Military Tradition's choice of two stays an outstanding fact.
  const grants = {
    'Weapon Familiarity (Green Martian)': [
      'Longspear',
      'Longsword',
      'Shortspear',
      'Spear',
    ],
  } as Record<string, string[]>;
  for (const row of assessedTraits) {
    const expected = grants[row.name] ?? [];
    expect(
      [...row.mechanicsReview.proficiencyReview.grants].sort(),
      row.name,
    ).toEqual(expected);
    expect(
      (entry(row.name).proficiencies ?? [])
        .map((row) => ('baseType' in row ? row.baseType : null))
        .sort(),
      row.name,
    ).toEqual(expected);
  }
  expect(
    candidate('Military Tradition').mechanicsReview.proficiencyReview
      .outstandingFacts,
  ).toHaveLength(1);
});

it('records the race, alternate-trait, monster-ability and Unchained notice dependencies and enforces every hold', () => {
  const held = new Map(heldNotices.map((row) => [row.id, row.notices]));
  const holdId = (book: string) =>
    `racial-traits-394-notice-${book}-complete-chain`;
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
      `racial-traits-394-whole-content-${row.externalKey.split('/')[1]}`,
    ]);
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices.filter((book) => book !== 'PZO1110').map(holdId),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  expect(
    assessedTraits.filter((row) => row.racialTraitKind === 'alt'),
  ).toHaveLength(28);
  // Languages (Lashunta)'s folder binds no race: both pinned lashunta race
  // records' books are recorded and required.
  expect(entry('Languages (Lashunta)').detail.raceKeys).toEqual([]);
  expect(
    candidate('Languages (Lashunta)')
      .inheritedRuleNotices.filter((notice) =>
        notice.location.includes('/packs/races/'),
      )
      .map((notice) => notice.rule.split(' race')[0]),
  ).toEqual(['the Lashunta (Male)', 'the Lashunta (Female)']);
  // Universal monster rules the bodies grant take the earliest book their
  // pinned Universal Monster Rules journal page lists.
  for (const [name, book, page] of [
    ['Darkvision (Hobgoblin)', 'PZO1127', 'Darkvision'],
    ['Change Shape (Skinwalker - Witchwolf)', 'PZO1127', 'Darkvision'],
    ['Change Shape (Skinwalker - Witchwolf)', 'PZO1112', 'Natural Attacks'],
    ['Low-Light Vision (Kuru)', 'PZO1112', 'Low-Light Vision'],
    ['Blindsense (Sahuagin)', 'PZO1112', 'Blindsense'],
    ['Water Sense (Undine)', 'PZO1112', 'Blindsense'],
    ['Spell Resistance (Munavri)', 'PZO1112', 'Spell Resistance'],
    ['Amorphous', 'PZO1116', 'Amorphous'],
    ['Ghost Hunter', 'PZO1112', 'Incorporeal'],
    ['Change Size', 'PZO1112', 'Change Shape'],
    ['Dragonmaw', 'PZO1112', 'Natural Attacks'],
    ['Poison Minion (Half-Elf)', 'PZO1112', 'Poison'],
    ['Winter-Born (Snow May)', 'PZO1112', 'Resistance'],
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
  // Rules the bodies depend on: Ultimate Combat's driving checks, the APG
  // alchemist's extracts, the Blood of the Beast row Skilled (Kitsune) comes
  // from, and the linked Ill Omen's Mythic Adventures citation.
  for (const [name, book] of [
    ['Wright', 'PZO1118'],
    ['Experimental Body: Blessed', 'PZO1115'],
    ['Skilled (Kitsune)', 'PZO9473'],
    ['Unlucky Halfling', 'PZO1126'],
  ] as const)
    expect(candidate(name).requiredNotices, name).toContain(book);
  // Unchained action-cost metadata anywhere in the bound closure requires
  // the held PZO1131.
  const unchained = [...new Set([...unchainedOwn, ...unchainedBound])].sort();
  expect(unchained).toHaveLength(20);
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
  // Creature types and subtypes, the creatures the bodies name and the
  // third-party record have no pinned rules record: named unresolved origins.
  for (const [name, text] of [
    ['Aquatic (Merfolk)', 'Creature type and subtype rules'],
    ['Change Size', 'Creature type and subtype rules'],
    ['Blasphemous Covenant', 'Creature type and subtype rules'],
    ['Eternal Grudge', 'Creature type and subtype rules'],
    ['Aquatic Ancestry', 'deep one and skum'],
    ['Dragonmaw', 'chromatic dragons'],
    ['Weapon Familiarity (Green Martian)', 'Third-party source'],
  ] as const)
    expect(
      candidate(name).inheritedRuleUnresolvedOrigins.join(' '),
      name,
    ).toContain(text);
  // Rejected rows and PCGen leads don't add books: Wanderlust's ARG lead
  // leaves ARG unrequired (the record cites Inner Sea Races and APG).
  expect(
    candidate('Languages (Samsaran)').rejectedRootComparisonEvidence,
  ).toHaveLength(2);
  expect(candidate('Wanderlust').requiredNotices).not.toContain('PZO1121');
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
  // Kindred-Raised replaces the half-elf's ability, adaptability, elven
  // immunities, keen senses and multitalented traits; Wright replaces hatred
  // and obsessive.
  expect(entry('Kindred-Raised').detail.replaces).toHaveLength(5);
  expect(entry('Wright').detail.replaces).toEqual([
    'pf1-content/FD2SILZXcIMjauvr',
    'pf1-content/LcZE7cPw87DMzJYl',
  ]);
});

it('pins all 100 keys, the complete bodies, checked bindings and literal PCGen and PRD evidence in the shared store', async () => {
  expect(review.candidates).toHaveLength(100);
  expect(new Set(review.candidates.map((row) => row.externalKey)).size).toBe(
    100,
  );
  expect(review.counts).toEqual({
    total: 100,
    admitted: 2,
    held: 66,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 32,
    excludedFolders: 20,
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
  expect(preview.entries).toHaveLength(68);
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
  expect(assessedTraits.filter((row) => row.prdComparison)).toHaveLength(20);
  expect(
    assessedTraits
      .filter((row) => row.prdComparison && !row.prdComparison.textMatches)
      .map((row) => row.name)
      .sort(),
  ).toEqual([
    'Ancient Enmity',
    'Dreamspeaker',
    'Eternal Grudge',
    'Exiled Dwarf',
    'Gear Gnomes',
    'Languages (Tiefling)',
    'Manipulative',
    'Orc Ferocity',
    'Spell-Like Ability (Sylph)',
    'Wanderlust',
  ]);
  // Ancient Enmity's untyped "+1 bonus" (the APG wording) where the PRD
  // reads "racial", and Orc Ferocity's "1 or more" where the PRD reads "above
  // 0": recorded, not resolved.
  expect(
    candidate('Ancient Enmity').prdComparison?.wordDifferences,
  ).toContainEqual({ pinned: '', prd: 'racial' });
  expect(
    candidate('Orc Ferocity').prdComparison?.wordDifferences,
  ).toContainEqual({ pinned: '1 or more', prd: 'above 0' });
  // Eternal Grudge, Dreamspeaker, Ancient Enmity and Wanderlust follow their
  // APG rows' wording, with the ARG rows as leads; Integrated follows its ARG
  // row (word for word the same), with the APG row as a lead.
  for (const name of [
    'Eternal Grudge',
    'Dreamspeaker',
    'Ancient Enmity',
    'Wanderlust',
  ]) {
    expect(candidate(name).comparison?.book, name).toBe('PZO1115');
    expect(
      candidate(name).additionalComparisonLeads.map((row) => row.book),
      name,
    ).toEqual(['PZO1121']);
  }
  expect(candidate('Integrated').comparison?.book).toBe('PZO1121');
  expect(
    candidate('Integrated').additionalComparisonLeads.map((row) => row.book),
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
      required: 31,
      checked: 31,
      missing: 0,
      descriptions: { candidates: 68, checked: 68 },
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
    const gate = assessWithUnclearedHolds({
      artifact: authoritative,
      ...reviewedAdmission,
    });
    // #328 S4-A confirms the batch's Human, Dwarf and Half-Orc standard
    // traits. Without the owner's notice clearances (this gate) they stay
    // held on their notice chains; the committed gate admits them.
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
    // Only the journal-link import gap fails (#738); it doesn't depend on
    // curation, and every other record is held on its own reasons.
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
    const held = gate.held.filter(
      (row) => ours.has(row.externalKey) && !admittedKeys.has(row.externalKey),
    );
    expect(held).toHaveLength(68 - JOURNAL_LINK_GAP.length - 2);
    // The Dynamite comics source-matched hold (known-notice-holds.json,
    // #227/#241) wins over the batch hold for the Green Martian record.
    for (const row of held)
      if (row.name === 'Weapon Familiarity (Green Martian)')
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
    // its other books' held notices.
    const gnome = candidate('Slow Speed (Gnome)');
    expect(gnome.requiredNotices).toEqual(['PZO1121', 'PZO9280', 'PZO1110']);
    const confirmed = assessWithUnclearedHolds({
      artifact: authoritative,
      ...reviewedAdmission,
      assessments: reviewedAdmission.assessments.map((row) =>
        row.externalKey === gnome.externalKey
          ? { ...row, status: 'confirmed' as const }
          : row,
      ),
    });
    expect(
      confirmed.admitted.some((row) => row.externalKey === gnome.externalKey),
    ).toBe(false);
    expect(
      confirmed.held.find((row) => row.externalKey === gnome.externalKey)
        ?.reason,
    ).toMatch(/Notice holds|Missing or unreviewed required notices/);
  } finally {
    await tree.dispose();
  }
});
