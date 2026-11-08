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
} from '../fixtures/racial-traits-387/data';
import {
  previewEntry,
  racialTraitSheet,
  sheetDefinition,
} from '../fixtures/racial-traits-387/sheet';
import { materializePinnedTree, readPinned } from './pinned-sources';
import { bindSnapshotToCurrentNotices } from './batch-ownership';
import { assessWithUnclearedHolds } from './uncleared-holds';

const PLACEHOLDER =
  'Review required: replace this placeholder with readable rules text or structured outputs.';
const sha = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
function entry(name: string) {
  const row = preview.entries.find((row) => row.name === name);
  if (!row) throw new Error(`Missing ${name}`);
  if (row.detail.kind !== 'racialTrait') throw new Error('Expected trait');
  return { ...row, detail: row.detail };
}
function candidate(name: string) {
  const row = assessedTraits.find((row) => row.name === name);
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
function resolved(
  name: string,
  target: string,
  selected: number[] = [],
  options: { school?: string } = {},
) {
  return resolveSheet(modifiers(name), {
    ...options,
    situations: selected.map((index) => situation(name, index)),
  })[target as 'skill.per'].total;
}
const ability = (
  sheet: ReturnType<typeof racialTraitSheet>,
  target: 'ability.str',
) => calculateCharacterSheetProjections(sheet).current.breakdowns[target].total;

// Every record whose bound content closure keeps Unchained action-cost
// metadata (owner ruling, 2026-10-17): on its own action, through a bound
// body (a replaced trait, a linked spell or feat, or a body two links away),
// or both.
const unchainedOwn = [
  'pf1-content/09c76EsW9zGXAEZ0', // Alternate Spell-Like Ability (Ancient-Born)
  'pf1-content/0padhC2cSPeYhbuU', // Smite Good
  'pf1-content/1bZoIL5ZYzbjTHnQ', // Alternate Spell-Like Ability (Svetocher)
  'pf1-content/1zFEagiB7rG5o0ks', // Conservative Diplomacy
  'pf1-content/20tBxcHiLRujQYvC', // Crystalline Form
  'pf1-content/23HcNMKrQH3EnOQS', // Seducer
  'pf1-content/2AJOaBUtrLSKx6n4', // Intoxicating Aroma
  'pf1-content/2Apl0Nfjo4HelVN1', // Blood Frenzy
  'pf1-content/2Do0WTfTNBwfKgjU', // Change Shape (Scaleheart)
  'pf1-content/2NXp8S2ZZ2Lh5LS3', // Halo
  'pf1-content/2Sfr16Du1PcB739m', // Ooze Breath
  'pf1-content/2jJkIYgBDpnVusfr', // Utilitarian Magic
  'pf1-content/2mlJ9zKk5DkyT0Mm', // Spell-Like Ability (Ironsoul)
  'pf1-content/2uXjoDFad7NaBCOG', // Spell-Like Ability (Rimesoul)
  'pf1-content/2zhilqoeGrOO3yeI', // Lab Rat
];
const unchainedBound = [
  'pf1-content/09c76EsW9zGXAEZ0',
  'pf1-content/0CISUAPF2V91vvoo', // Rimesoul (Frost Undine)
  'pf1-content/0iFqZXfHNt2vAJ8h', // Div-Spawn (Spitespawn)
  'pf1-content/0kgOCeTSzC3Zg5v6', // Light from the Darkness
  'pf1-content/0padhC2cSPeYhbuU',
  'pf1-content/1bZoIL5ZYzbjTHnQ',
  'pf1-content/1kZ5mKCyb6CjEjFT', // Ekujae Elves
  'pf1-content/20tBxcHiLRujQYvC',
  'pf1-content/23HcNMKrQH3EnOQS',
  'pf1-content/2AJOaBUtrLSKx6n4',
  'pf1-content/2Do0WTfTNBwfKgjU',
  'pf1-content/2Sfr16Du1PcB739m',
  'pf1-content/2jJkIYgBDpnVusfr',
  'pf1-content/2mlJ9zKk5DkyT0Mm',
  'pf1-content/2ppVDApnWAEYnzHO', // Jininese Elves
  'pf1-content/2uXjoDFad7NaBCOG',
];

it('resolves the reviewed racial trait Modifiers through the public resolver', () => {
  // The two heritages curated with their ability lines replace their race's
  // ability score trait: it goes dormant, and their own adjustments count.
  for (const [name, race, before, after] of [
    [
      'Rimesoul (Frost Undine)',
      'Undine',
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
      { 'ability.dex': 12, 'ability.int': 12, 'ability.cha': 8 },
      { 'ability.dex': 12, 'ability.cha': 12, 'ability.int': 8 },
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
      expect(ability(plain, target as 'ability.str'), `${race} ${target}`).toBe(
        value,
      );
    for (const [target, value] of Object.entries(after))
      expect(
        ability(chosen, target as 'ability.str'),
        `${name} ${target}`,
      ).toBe(value);
  }
  // Brine May's ability line belongs to its own Subrace Standard record, so
  // Sea-Born keeps "Base Statistics" unmatched and carries no Modifier.
  expect(entry('Sea-Born (Brine May)').modifiers).toEqual([]);
  expect(entry('Sea-Born (Brine May)').detail.unresolvedReplacements).toEqual([
    'Base Statistics',
  ]);
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
    const base = target.replace(/^save\..*/, 'saves').replace(/^ac\..*/, 'ac');
    const index = indexOf(name, base === target ? target : base, label);
    expect(resolved(name, target), `${name} ${target}`).toBe(0);
    expect(resolved(name, target, [index]), `${name} ${target}`).toBe(value);
  }
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
  // Darklands Guide's initiative bonus applies always (PCGen's reading).
  expect(resolved('Darklands Guide', 'init')).toBe(2);
  // Shared Situations: the same type within one entry doesn't stack.
  const reptile = 'Reptilian Ancestry';
  expect(modifiers(reptile).map((row) => row.condition?.situation)).toEqual([
    'mindAffecting',
    'poison',
  ]);
  expect(resolved(reptile, 'save.will', [0])).toBe(2);
  expect(resolved(reptile, 'save.will', [0, 1])).toBe(2);
  expect(modifiers('Dreamer').map((row) => row.condition?.situation)).toEqual([
    'illusions',
  ]);
  expect(resolved('Dreamer', 'save.will', [0])).toBe(2);
  const rat = 'Lab Rat';
  expect(modifiers(rat)[0]?.condition?.situation).toBe('poison');
  expect(resolved(rat, 'save.fort', [0, 1])).toBe(1);
  // School DCs apply to the named school only.
  for (const [name, school] of [
    ['Seducer', 'enchantment'],
    ['Utilitarian Magic', 'transmutation'],
  ] as const) {
    expect(resolved(name, 'spellDC', [], { school }), name).toBe(1);
    expect(resolved(name, 'spellDC', [], { school: 'evocation' }), name).toBe(
      0,
    );
    expect(entry(name).unsupported, name).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'changes' })]),
    );
  }
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
  // The two untargeted Final Change changes describe the transformed deep
  // one and contribute nothing.
  expect(entry('Final Change').modifiers).toEqual([]);
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
      for (const markup of ['@UUID', '@Distance', '@Toggle', '[['])
        expect(part, row.name).not.toContain(markup);
    }
    const texts = (entry(row.name).situationalNotes ?? []).map(
      (note) => note.text,
    );
    for (const part of parts) expect(texts, row.name).toContain(part);
  }
  expect(required).toBe(35);
  // Repeated or race-supplied notes are the explicit covered/no-output records.
  expect(
    assessedTraits.flatMap((row) =>
      row.mechanicsReview.curationRecords
        .filter((record) => !record.outputs.length)
        .map((record) => `${row.name} ${record.target}`),
    ),
  ).toEqual([
    'Shadowhunter (Halfling) rangedWeapon',
    'Own Two Feet allSavingThrows',
    'Own Two Feet attack',
    'Own Two Feet skills',
  ]);
  for (const record of candidate(
    'Own Two Feet',
  ).mechanicsReview.curationRecords.filter((row) => !row.outputs.length))
    expect(record.rationale).toContain('Orang-Pendak race');
  // Standard traits whose Foundry note a checked race record covers have no
  // required record of their own (coveredTraitNotes).
  for (const name of ['Camouflage', 'Greed (Dwarf)']) {
    expect(candidate(name).sourceFields.contextNotes, name).toHaveLength(1);
    expect(candidate(name).mechanicsReview.curationRecords, name).toHaveLength(
      1,
    );
  }
  // Notes the Foundry data put on unrelated statistics are entry-level.
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
  // Every record lists its outstanding calculations, never as a hold.
  for (const row of assessedTraits) {
    expect(
      row.mechanicsReview.outstandingCalculations.length,
      row.name,
    ).toBeGreaterThan(0);
    for (const text of row.mechanicsReview.outstandingCalculations)
      expect(row.holdIds.join(' '), row.name).not.toContain(text);
    expect(row.mechanicsReview.proficiencyReview.grants, row.name).toEqual([]);
  }
  // Irrepressible's +2 stacks with halfling luck's +1 as the body says:
  // racial bonuses from different Sources stack (PRD §8), so no
  // stacksWithinEntry is needed and the resolved sheet gives +3.
  const irrepressible = entry('Irrepressible');
  expect(irrepressible.modifiers.every((row) => !row.stacksWithinEntry)).toBe(
    true,
  );
  const luck = previewEntry('Halfling Luck');
  expect(luck.modifiers).toEqual([
    { target: 'saves', bonusType: 'racial', value: 1 },
  ]);
  // The halfling race grants halfling luck; this test-only race carries only
  // the pinned Halfling identity and that Grant, so every bonus is the traits'.
  const halflingKey = irrepressible.detail.raceKeys?.[0];
  if (!halflingKey) throw new Error('Irrepressible has no race');
  expect(luck.detail).toMatchObject({
    raceKeys: [halflingKey],
    standard: true,
  });
  const selected = racialTraitSheet({ traits: [irrepressible.externalKey] });
  const halfling = {
    ...selected,
    entries: [
      ...selected.entries,
      {
        _id: 'race-row',
        kind: 'race' as const,
        active: true,
        catalogEntryId: halflingKey,
        state: { kind: 'race' as const },
      },
    ],
    catalogEntries: [
      ...selected.catalogEntries,
      {
        _id: halflingKey,
        name: 'Halfling (identity only)',
        ruleIdentity: halflingKey,
        modifiers: [],
        detail: { kind: 'race' as const, racialTraits: [luck.externalKey] },
      },
      sheetDefinition(luck.externalKey),
    ],
  };
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
  // Counting as drow is not curated: it needs a reviewed racial-trait rule.
  expect(entry('Drow Heritage')).not.toHaveProperty('countsAsRaces');
});

it('records the race, alternate-trait, monster-ability and Unchained notice dependencies and enforces every hold', () => {
  const held = new Map(heldNotices.map((row) => [row.id, row.notices]));
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
      `racial-traits-387-whole-content-${row.externalKey.split('/')[1]}`,
    ]);
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices
        .filter((book) => book !== 'PZO1110')
        .map((book) => `racial-traits-387-notice-${book}-complete-chain`),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  expect(
    assessedTraits.filter((row) => row.racialTraitKind === 'alt'),
  ).toHaveLength(34);
  // Universal monster rules the bodies grant take the earliest book their
  // pinned Universal Monster Rules journal page lists.
  for (const [name, book, page] of [
    ['Darkvision (Fetchling)', 'PZO1127', 'Darkvision'],
    ['Low-Light Vision (Naiad)', 'PZO1112', 'Low-Light Vision'],
    ['Scent (Catfolk)', 'PZO1112', 'Scent'],
    ['Amphibious (Locathah)', 'PZO1112', 'Amphibious'],
    ['Tentacle Attacks', 'PZO1112', 'Natural Attacks'],
    ['Hard Head, Big Teeth', 'PZO1112', 'Natural Attacks'],
    ['Change Shape (Skinwalker - Scaleheart)', 'PZO1112', 'Ferocity'],
    ['Light Blindness (Drow)', 'PZO1112', 'Light Blindness'],
    ['Negative Energy Affinity', 'PZO1116', 'Negative Energy Affinity'],
    ['Ooze Breath', 'PZO1112', 'Breath Weapon'],
    ['Energy Resistance (Suli)', 'PZO1112', 'Resistance'],
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
  // Rules the bodies cite or depend on.
  for (const [name, book] of [
    ['Dreamer', 'PZO1132'],
    ['Light from the Darkness', 'PZO1121'],
    ['Rimesoul (Frost Undine)', 'PZO1115'],
    ['Drow Heritage', 'PZO9280'],
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
  // Creature types have no pinned rules record: named unresolved origins.
  for (const name of [
    'Native Outsider (Aphorite)',
    'Fey',
    'Tengu',
    'Dhampir',
    'Native Outsider (Undine)',
    'Living Machine',
  ])
    expect(
      candidate(name).inheritedRuleUnresolvedOrigins.join(' '),
      name,
    ).toContain('Creature type and subtype rules');
  // Rejected same-name rows and PCGen leads don't add books.
  for (const [name, book] of [
    ['Greed (Dwarf)', 'PZO9280'],
    ['Halo', 'PZO9424'],
    ['Blood Frenzy', 'PZO1112'],
  ] as const) {
    const rows = [
      ...candidate(name).rejectedRootComparisonEvidence,
      ...candidate(name).additionalComparisonLeads,
    ];
    expect(
      rows.some((row) => row.book === book) || name === 'Greed (Dwarf)',
      name,
    ).toBe(true);
  }
  expect(candidate('Halo').requiredNotices).not.toContain('PZO9424');
  expect(candidate('Blood Frenzy').requiredNotices).not.toContain('PZO1112');
  for (const requirement of review.noticeRequirements) {
    if (requirement.book === 'PZO1110') {
      expect(requirement.holdId).toBeNull();
      continue;
    }
    expect(held.get(requirement.holdId ?? ''), requirement.book).toEqual([
      requirement.book,
      ...requirement.registryKeys.filter((key) => key !== requirement.book),
    ]);
    for (const key of requirement.candidates) {
      const row = assessedTraits.find((row) => row.externalKey === key);
      // #328 S4-A: an admitted trait stays in its batch's notice row as
      // history, with no hold of its own.
      if (row?.disposition === 'admitted')
        expect(row.noticeHoldIds, row.name).toEqual([]);
      else expect(row?.noticeHoldIds).toContain(requirement.holdId);
    }
  }
});

it('records the importer reading of every race, replacement and unresolved name', () => {
  for (const row of assessedTraits) {
    const detail = entry(row.name).detail;
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
      .filter((row) => entry(row.name).detail.unresolvedReplacements?.length)
      .map((row) => [row.name, entry(row.name).detail.unresolvedReplacements]),
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

it('pins all 100 keys, the complete bodies, checked bindings and literal PCGen and PRD evidence in the shared store', async () => {
  expect(review.candidates).toHaveLength(100);
  expect(new Set(review.candidates.map((row) => row.externalKey)).size).toBe(
    100,
  );
  expect(review.counts).toEqual({
    total: 100,
    admitted: 2,
    held: 69,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 29,
    excludedFolders: 19,
    excludedRaceBuilder: 10,
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
  expect(preview.entries).toHaveLength(71);
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
    expect(entry(row.name).sources).toEqual(row.citedSources);
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
  expect(
    assessedTraits.filter((row) => row.prdComparison).map((row) => row.name),
  ).toHaveLength(21);
  expect(
    assessedTraits
      .filter((row) => row.prdComparison && !row.prdComparison.textMatches)
      .map((row) => row.name)
      .sort(),
  ).toEqual(['Greed (Dwarf)', 'Negative Energy Affinity']);
  expect(candidate('Greed (Dwarf)').prdComparison?.wordDifferences).toEqual([
    { pinned: 'receive', prd: 'gain' },
  ]);
  // Darklands Guide's initiative reading comes from its literal PCGen row.
  expect(candidate('Darklands Guide').comparison?.literalRow).toContain(
    'BONUS:COMBAT|INITIATIVE|2',
  );
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
      descriptions: { candidates: 71, checked: 71 },
    });
    expect(
      artifact.catalog.entries.map((row) => row.externalKey).sort(),
    ).toEqual(assessedTraits.map((row) => row.externalKey).sort());
    // A bounded import applies no race note record (its race is outside the
    // selection), so these two standard traits lack the re-homed bonuses.
    const rehomed = ['Camouflage', 'Greed (Dwarf)'];
    for (const row of artifact.catalog.entries) {
      const saved = entry(row.name);
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
      if (rehomed.includes(row.name))
        expect(row.modifiers, row.name).toEqual([]);
      else expect(row.modifiers, row.name).toEqual(saved.modifiers);
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
    expect(gate.failures.filter((row) => ours.has(row.externalKey))).toEqual(
      [],
    );
    const held = gate.held.filter((row) => ours.has(row.externalKey));
    expect(held).toHaveLength(69);
    for (const row of held)
      expect(row.reason, row.name).toBe(candidate(row.name).rationale);
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
    // its other cited books' held notices.
    const keen = candidate('Keen Senses (Half-Elf)');
    expect(keen.requiredNotices).toEqual(['PZO9280', 'PZO1121', 'PZO1110']);
    // With its PCGen-confirmed books reviewed (2026-10-31), only the notice
    // holds the owner's clearance clears still hold it, so this runs uncleared.
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
