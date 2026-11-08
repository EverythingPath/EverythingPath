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
} from '../fixtures/racial-traits-391/data';
import {
  racialTraitSheet,
  sheetDefinition,
} from '../fixtures/racial-traits-391/sheet';
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
  'pf1-content/FD2SILZXcIMjauvr', // Hatred (Gnome)
  'pf1-content/FzTVEjj30jIOfvMw', // Sensitive Breath
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
  'pf1-content/EEjvlHbyXB1yYEgU', // Shadow Speaker
  'pf1-content/EQELT4ORTRAZs06D', // Drow Magic
  'pf1-content/ETapFH3D6SF1WwVn', // Spell-Like Ability (Tiefling - Beastbrood)
  'pf1-content/F2j2piaRH1DBhohG', // Weather Savvy
  'pf1-content/FNERRlnZL8mWZLLL', // Bloodmarked
  'pf1-content/FVyCe9ASrrxnXeyx', // Nightskulk
  'pf1-content/FkNwNCexIJKOgtY2', // Immortal Spark
  'pf1-content/FmU1AoSsE69xIeLH', // Sea Longing
  'pf1-content/Foqsm1jgAOgvnWCV', // Prehensile Tail (Kobold)
  'pf1-content/GXxza7xp8jSXG1kM', // Fey Magic (Gnome - HftF)
  'pf1-content/GfHikcU2W5jAIyT8', // Poison Minion (Elf)
  'pf1-content/GjiRIP6omZLo0j4y', // Samsaran Magic
  'pf1-content/GnO1Z83Jk3OBOvYt', // Spell-Like Abilities (Gathlain)
  'pf1-content/GyJ1zrZi3yP17xN6', // Spell-Like Ability (Munavri)
  'pf1-content/H1YJQ8kSvDqfq09q', // Water Bond
  'pf1-content/H59daebatbCBLoKq', // Change Shape (Reptoid)
];
const unchainedBound = [
  'pf1-content/DuFNFt2YIoJ9KYif', // Sticky Tendrils (spider climb, feather fall)
  'pf1-content/E8oONe3xMLCowfoc', // Insidious Telepathy (Lashunta Magic)
  'pf1-content/EEjvlHbyXB1yYEgU', // Shadow Speaker (Shadow Magic)
  'pf1-content/EKWfbMe0RnUmFJ6e', // Gliding Wings (feather fall)
  'pf1-content/EPHSQElGyQgaeplx', // Shadowplay (Gnome Magic)
  'pf1-content/EQELT4ORTRAZs06D',
  'pf1-content/ETapFH3D6SF1WwVn',
  'pf1-content/F22dd0H1yM74ocb4', // Garrulous (Ink Cloud)
  'pf1-content/F2j2piaRH1DBhohG',
  'pf1-content/FNERRlnZL8mWZLLL',
  'pf1-content/FVyCe9ASrrxnXeyx',
  'pf1-content/FkNwNCexIJKOgtY2',
  'pf1-content/GXxza7xp8jSXG1kM',
  'pf1-content/GjiRIP6omZLo0j4y',
  'pf1-content/GkuTWhbg0qcsr11b', // Glide (feather fall)
  'pf1-content/GnO1Z83Jk3OBOvYt',
  'pf1-content/GyJ1zrZi3yP17xN6',
  'pf1-content/H59daebatbCBLoKq',
];

it('resolves the reviewed racial trait Modifiers through the public resolver', () => {
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
    ['Heart of the Mountains', 'skill.acr', 'skill.acr', 'narrow surfaces', 2],
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
        modifiers(name).map((row) => JSON.stringify(row.condition?.situation)),
      ).size,
      name,
    ).toBe(1);
  }
  // Each choice or class-skill Situation is its own: one per skill.
  for (const [name, count] of [
    ['In the Shadows', 5],
    ['Comprehensive Education', 10],
  ] as const)
    expect(
      new Set(
        modifiers(name).map((row) => JSON.stringify(row.condition?.situation)),
      ).size,
      name,
    ).toBe(count);
  // Two racial Situations on one entry don't stack: both selected give +2.
  for (const [name, target] of [
    ['Heart of the Sun', 'save.fort'],
    ['Blightborn', 'save.will'],
  ] as const)
    expect(resolved(name, target, [0, 1]), name).toBe(2);
  // Shared Situations only where the body's condition matches exactly.
  const death = modifiers('Immortal Spark').findIndex(
    (row) => row.condition?.situation === 'death',
  );
  expect(death).toBeGreaterThanOrEqual(0);
  expect(resolved('Immortal Spark', 'save.will')).toBe(0);
  expect(resolved('Immortal Spark', 'save.will', [death])).toBe(2);
  // Blightborn's necromancy and curse bonus is not the shared spells
  // Situation, which would cover every spell.
  expect(
    modifiers('Blightborn').some(
      (row) => row.condition?.situation === 'spells',
    ),
  ).toBe(false);
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
  // Dragon Magic's raw +2 racial Perception, which the body does not grant,
  // imports as 0 through its reviewed change replacement.
  expect(entry('Dragon Magic').modifiers).toEqual([
    { target: 'skill.per', bonusType: 'racial', value: 0 },
  ]);
  expect(resolved('Dragon Magic', 'skill.per')).toBe(0);
  // Faultspawn replaces the tiefling's Skilled (#389) by name: its +2 Bluff
  // and Stealth go dormant and the heritage's Appraise and Knowledge (local)
  // count.
  const faultspawn = entry('Skilled (Tiefling - Faultspawn)');
  const skilled = 'pf1-content/AKuDJrwJUZULsJcS';
  expect(faultspawn.detail.replaces).toEqual([skilled]);
  const tiefling = faultspawn.detail.raceKeys?.[0];
  if (!tiefling) throw new Error('Faultspawn has no race');
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
  // Fey Wisdom replaces Keen Senses (Elf): its +2 Perception goes dormant.
  const wisdom = entry('Fey Wisdom');
  const keen = 'pf1-content/WOF6A7695wxFO2ie';
  expect(wisdom.detail.replaces).toEqual([keen]);
  const elf = wisdom.detail.raceKeys?.[0];
  if (!elf) throw new Error('Fey Wisdom has no race');
  const elfPlain = identityRace(racialTraitSheet({}), elf, [keen]);
  const wise = identityRace(
    racialTraitSheet({ traits: [wisdom.externalKey] }),
    elf,
    [keen],
  );
  expect(total(elfPlain, 'skill.per')).toBe(2);
  expect(total(wise, 'skill.per')).toBe(0);
  expect(total(wise, 'skill.dip')).toBe(1);
  // Racial bonuses from distinct Sources stack (PRD §8): Fosterling's and
  // Garrulous' +2 racial Diplomacy add up to +4.
  expect(
    resolveSheet([...modifiers('Fosterling'), ...modifiers('Garrulous')], {
      situations: [],
    })['skill.dip'].total,
  ).toBe(4);
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
        '1 feet',
      ])
        expect(part, row.name).not.toContain(markup);
    }
    const texts = (entry(row.externalKey).situationalNotes ?? []).map(
      (note) => note.text,
    );
    for (const part of parts) expect(texts, row.name).toContain(part);
  }
  expect(required).toBe(37);
  // The one explicit covered/no-output record: the Reptoid race's
  // description record already supplies Change Shape's Disguise bonus.
  expect(
    assessedTraits.flatMap((row) =>
      row.mechanicsReview.curationRecords
        .filter((record) => !record.outputs.length)
        .map((record) => `${row.name} ${record.target}`),
    ),
  ).toEqual(['Change Shape (Reptoid) skill.dis']);
  expect(entry('Change Shape (Reptoid)').modifiers).toEqual([]);
  // Crawling Skin's blood hag bonus stays a Note: the changeling grants every
  // hag option at once, so a Modifier would reach every changeling.
  expect(
    entry('Hag Racial Trait (Changeling - Crawling Skin)').modifiers,
  ).toEqual([]);
  // Race-covered trait notes have no required record of their own.
  for (const name of ['Hatred (Gnome)', 'Sensitive Breath'])
    expect(candidate(name).mechanicsReview.curationRecords, name).toHaveLength(
      1,
    );
  // Notes the Foundry data put on unrelated statistics are entry-level.
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
  // The drafter's attack Modifier for Cautious Brawler's damage bonus is not
  // used: the body gives it on damage rolls.
  expect(
    modifiers('Cautious Brawler').map((row) => [row.target, row.value]),
  ).toEqual([['damage', 1]]);
  // Every record lists its outstanding calculations, never as a hold.
  for (const row of assessedTraits) {
    expect(
      row.mechanicsReview.outstandingCalculations.length,
      row.name,
    ).toBeGreaterThan(0);
    for (const text of row.mechanicsReview.outstandingCalculations)
      expect(row.holdIds.join(' '), row.name).not.toContain(text);
  }
  // Weapon proficiencies are imported from the records' weaponProf fields.
  for (const [name, grants] of [
    ['Weapon Familiarity (Grippli)', ['Net']],
    [
      'Weapon Familiarity (Elf)',
      ['Longbow', 'Longsword', 'Rapier', 'Shortbow'],
    ],
    ['Weapon Familiarity (Dwarf)', ['Battleaxe', 'Heavy Pick', 'Warhammer']],
  ] as const)
    expect(
      candidate(name).mechanicsReview.proficiencyReview.grants,
      name,
    ).toEqual(grants);
  expect(
    (entry('Weapon Familiarity (Elf)').proficiencies ?? []).map((row) =>
      'baseType' in row ? row.baseType : null,
    ),
  ).toEqual(['Longbow', 'Longsword', 'Rapier', 'Shortbow']);
  expect(
    candidate('Weapon Familiarity (Elf)').mechanicsReview.proficiencyReview
      .outstandingFacts.length,
  ).toBe(2);
  for (const row of assessedTraits)
    if (!row.name.startsWith('Weapon Familiarity'))
      expect(row.mechanicsReview.proficiencyReview.grants, row.name).toEqual(
        [],
      );
});

it('records the race, alternate-trait, monster-ability and Unchained notice dependencies and enforces every hold', () => {
  const held = new Map(heldNotices.map((row) => [row.id, row.notices]));
  const holdId = (book: string) =>
    `racial-traits-391-notice-${book}-complete-chain`;
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
      `racial-traits-391-whole-content-${row.externalKey.split('/')[1]}`,
    ]);
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices.filter((book) => book !== 'PZO1110').map(holdId),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  expect(
    assessedTraits.filter((row) => row.racialTraitKind === 'alt'),
  ).toHaveLength(34);
  // Insidious Telepathy's folder "Lashunta" links no race record (both pinned
  // lashunta records are named by sex); their book is recorded from them.
  const telepathy = candidate('Insidious Telepathy');
  expect(entry('Insidious Telepathy').detail.raceKeys).toEqual([]);
  expect(
    telepathy.inheritedRuleNotices
      .filter((notice) => notice.location.includes('/packs/races/lashunta-'))
      .map((notice) => notice.book),
  ).toEqual(['PZO9280', 'PZO9280']);
  // Universal monster rules the bodies grant take the earliest book their
  // pinned Universal Monster Rules journal page lists.
  for (const [name, book, page] of [
    ['Darkvision (Drow)', 'PZO1127', 'Darkvision'],
    ['Superior Darkvision', 'PZO1127', 'Darkvision'],
    ['Darkvision (Grindylow)', 'PZO1127', 'Darkvision'],
    ['Daylight Adaptation', 'PZO1127', 'Darkvision'],
    ['Daylight Adaptation', 'PZO1112', 'Light Blindness'],
    ['Low-Light Vision (Vishkanya)', 'PZO1112', 'Low-Light Vision'],
    ['Low-Light Vision (Triton)', 'PZO1112', 'Low-Light Vision'],
    ['Senses (Rougarou)', 'PZO1112', 'Low-Light Vision'],
    ['Senses (Rougarou)', 'PZO1112', 'Scent'],
    ['Scent (Ratfolk)', 'PZO1112', 'Scent'],
    ['Amphibious (Cecaelia)', 'PZO1112', 'Amphibious'],
    ['Amphibious (Gillman)', 'PZO1112', 'Amphibious'],
    ['Claws (Yaddithian)', 'PZO1112', 'Natural Attacks'],
    ['Change Shape (Reptoid)', 'PZO1112', 'Change Shape'],
    ['Insidious Telepathy', 'PZO1112', 'Telepathy'],
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
  // Rules the bodies cite or depend on: the boreal bloodline and the Ice
  // subdomain (APG), lesser age resistance (Ultimate Magic), object reading
  // (Occult Adventures) and feather step (APG).
  for (const [name, book] of [
    ['Ice Affinity (Undine - Rimesoul)', 'PZO1115'],
    ['Immortal Spark', 'PZO1117'],
    ['Spell-Like Ability (Munavri)', 'PZO1132'],
    ['Spell-Like Abilities (Gathlain)', 'PZO1115'],
  ] as const)
    expect(candidate(name).requiredNotices, name).toContain(book);
  // Unchained action-cost metadata anywhere in the bound closure requires
  // the held PZO1131.
  const unchained = [...new Set([...unchainedOwn, ...unchainedBound])].sort();
  expect(unchained).toHaveLength(22);
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
    'Monstrous Humanoid (Sahuagin)',
    'Aquatic (Locathah)',
    'Native Outsider (Ganzi)',
    'Native Outsider (Shabti)',
    'Native Outsider (Ifrit)',
    'Amphibious (Gillman)',
  ])
    expect(
      candidate(name).inheritedRuleUnresolvedOrigins.join(' '),
      name,
    ).toContain('Creature type and subtype rules');
  // Shadowplay's shadow descriptor cites no Ultimate Magic page: unresolved.
  expect(candidate('Shadowplay (Gnome)').requiredNotices).not.toContain(
    'PZO1117',
  );
  expect(
    candidate('Shadowplay (Gnome)').inheritedRuleUnresolvedOrigins.join(' '),
  ).toContain('shadow spell descriptor');
  // Rejected rows don't add books: the Tian Xia kitsune language rows, the
  // feyborn Fey Magic row and the tiefling's own trait rows.
  expect(
    candidate('Languages (Kitsune)').rejectedRootComparisonEvidence.map(
      (row) => row.book,
    ),
  ).toEqual(['PZO9421', 'PZO9240']);
  expect(
    candidate('Fey Magic (Gnome - HftF)').rejectedRootComparisonEvidence.map(
      (row) => row.book,
    ),
  ).toEqual(['PZO9456']);
  expect(candidate('Fey Magic (Gnome - HftF)').requiredNotices).not.toContain(
    'PZO9456',
  );
  for (const name of [
    'Spell-Like Ability (Tiefling - Beastbrood)',
    'Skilled (Tiefling - Faultspawn)',
  ])
    expect(
      candidate(name).rejectedRootComparisonEvidence.map((row) => row.book),
      name,
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
    // The gathlain's fly speed trait has another name (importer gap).
    'pf1-content/DuFNFt2YIoJ9KYif': ['Racial Fly Speed'], // Sticky Tendrils
    // The duergar's spell-like ability trait has another name.
    'pf1-content/GL7VJG5KSRQDF4GS': ['Invisibility Spell-Like Ability'], // Blood Enmity
    // No header and no parent trait of the same name (importer gap).
    'pf1-content/Fzzd5GnZy7J7wU8j': ['Ice Affinity (Undine - Rimesoul)'],
  });
  // Daylight Adaptation's body removes light blindness, but its header names
  // only Spell Resistance, so the drow's Light Blindness stays granted.
  expect(entry('Daylight Adaptation').detail.replaces).toHaveLength(1);
  // The changeling's hag racial trait options are each filed as a standard
  // trait of the race, so the race grants them all at once (importer gap).
  expect(
    entry('Hag Racial Trait (Changeling - Crawling Skin)').detail,
  ).toMatchObject({ standard: true, raceKeys: ['pf1/9FBT6uqlRgaw9gug'] });
});

it('pins all 100 keys, the complete bodies, checked bindings and literal PCGen and PRD evidence in the shared store', async () => {
  expect(review.candidates).toHaveLength(100);
  expect(new Set(review.candidates.map((row) => row.externalKey)).size).toBe(
    100,
  );
  expect(review.counts).toEqual({
    total: 100,
    admitted: 3,
    held: 72,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 25,
    excludedFolders: 11,
    excludedRaceBuilder: 14,
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
  expect(preview.entries).toHaveLength(75);
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
  expect(assessedTraits.filter((row) => row.prdComparison)).toHaveLength(15);
  expect(
    assessedTraits
      .filter((row) => row.prdComparison && !row.prdComparison.textMatches)
      .map((row) => row.name),
  ).toEqual([]);
  // Heart of the Streets follows its ARG row's wording ("racial bonus"); the
  // earlier APG printing is a lead whose cited book is required.
  expect(
    candidate('Heart of the Streets').additionalComparisonLeads.map(
      (row) => row.book,
    ),
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
      descriptions: { candidates: 75, checked: 75 },
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
    const dwarf = candidate('Weapon Familiarity (Dwarf)');
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
