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
} from '../fixtures/racial-traits-398/data';
import {
  racialTraitSheet,
  sheetDefinition,
} from '../fixtures/racial-traits-398/sheet';
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
  'pf1-content/bRO90tmeaH1tFi2g', // Elven Magic (Elf) (Elf race notes)
  'pf1-content/cFr4ZtTY4M2iTTWa', // Nocturnal (Strix) (Strix race notes)
];
// Records whose description link the importer cannot resolve fail admission
// on that import gap in any preview: Defensive Abilities links pf1-content's
// unassigned universal-monster-rules No Breath record, not a catalog entry.
const UNRESOLVED_LINK_GAP = ['pf1-content/cSe1S79oR6gJI9bF'];
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
  'pf1-content/bGb3Y5JukIgU1Kdt', // Ink Cloud
  'pf1-content/bQz5WGBgK1x813HO', // Alternate Spell-Like Ability (Skinwalker - Scaleheart)
  'pf1-content/biy9S2be3p758hMW', // Spell-Like Ability (Aasimar - Plumekith)
  'pf1-content/cEh0t6PAmegJIQCU', // Energy Strike (Electricity)
  'pf1-content/cnMT4bfxktgJnrm1', // Blood Courage
  'pf1-content/czaE6LoPE63urloL', // Seed
  'pf1-content/dEtxdn5mLY5M3i45', // Alternate Spell-Like Ability (Dhampir - Ru-Shi)
  'pf1-content/dMLf5DVvmyw2MLmm', // Fey Magic (Elf)
  'pf1-content/dXEb2y6woAp0MpCO', // Crystalline Dust
  'pf1-content/dagWgGQYv20usVZW', // Spell-Like Ability (Tiefling - Grimspawn)
  'pf1-content/deYG2mmqNjWZ4rR5', // Umbral Escort
  'pf1-content/dlBhceRWyWTbpBN8', // Fire in the Blood
  'pf1-content/e6cqGeDS6lFEFfzJ', // Ferrous Growth
  'pf1-content/eI3UbG7beFWfikl0', // Spell-Like Ability (Aphorite)
  'pf1-content/eIbeWPnBDu7zLYjF', // Spell-Like Ability (Aasimar - Lawbringers)
  'pf1-content/eKKCUEHE5IvE6x9L', // Poison Minion (Drow)
];
const unchainedBound = [
  'pf1-content/bQz5WGBgK1x813HO', // Alternate Spell-Like Ability (Skinwalker - Scaleheart)
  'pf1-content/bUnlzKQfFNF97MqX', // Mystic
  'pf1-content/bWTblS61a4GQlsgx', // War-Leader
  'pf1-content/bcJGI384LPRwuj2a', // Eternal Smith
  'pf1-content/biy9S2be3p758hMW', // Spell-Like Ability (Aasimar - Plumekith)
  'pf1-content/c6qcpCl83hFN26vn', // Superior Shapeshifter
  'pf1-content/cEh0t6PAmegJIQCU', // Energy Strike (Electricity)
  'pf1-content/calSa82WwxgUFwXr', // Werewolf-Kin (Witchwolf)
  'pf1-content/dEtxdn5mLY5M3i45', // Alternate Spell-Like Ability (Dhampir - Ru-Shi)
  'pf1-content/dX7u0gwFMcTexeSJ', // Alternate Weakness (Dhampir - Ajibachana)
  'pf1-content/dagWgGQYv20usVZW', // Spell-Like Ability (Tiefling - Grimspawn)
  'pf1-content/deYG2mmqNjWZ4rR5', // Umbral Escort
  'pf1-content/dtbQtYC7PMjK4Zs5', // Cliffside Charger (Cragkin)
  'pf1-content/e6cqGeDS6lFEFfzJ', // Ferrous Growth
  'pf1-content/eI3UbG7beFWfikl0', // Spell-Like Ability (Aphorite)
  'pf1-content/eIbeWPnBDu7zLYjF', // Spell-Like Ability (Aasimar - Lawbringers)
  'pf1-content/eJIBuryG68v4PJLk', // Light Sensitivity (Dhampir)
];

it('resolves the reviewed racial trait Modifiers through the public resolver', () => {
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
  // Attentive: the imported +2 racial Sense Motive rises to the published +4
  // in its Situation (one entry's racial bonuses do not stack).
  const attentive = indexOf('Attentive', 'skill.sen', 'enchanted');
  expect(resolved('Attentive', 'skill.sen')).toBe(2);
  expect(resolved('Attentive', 'skill.sen', [attentive])).toBe(4);
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
  // Nocturnal (Strix) carries the Strix race's re-homed note outputs.
  expect(entry('Nocturnal (Strix)').modifiers).toEqual(
    ['skill.per', 'skill.ste'].map((target) => ({
      target,
      bonusType: 'racial',
      value: 2,
      condition: { situation: { local: 'in dim light or darkness' } },
    })),
  );
  // Racial bonuses from distinct Sources stack (PRD; character-sheet.ts):
  // Clever Cat's and Attentive's +2 racial Sense Motive give +4 together.
  const both = resolveSheet(
    [...modifiers('Clever Cat'), ...modifiers('Attentive')].filter(
      (row) => row.target === 'skill.sen' && !row.condition,
    ),
    { situations: [] },
  );
  expect(both['skill.sen'].total).toBe(4);
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
    ['Honey Whisperer', 'skill.dip'],
    ['Desert Runner', 'conChecks'],
    ['Desert Runner', 'fort'],
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
  expect(coveredCount).toBe(covered.length);
  expect(required).toBe(40);
  // Notes the Foundry data put on unrelated statistics are entry-level.
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
  // The Notes read Foundry enrichers as text: Oread Gem Magic's distances
  // and weights, Cliffside Charger's speed bonus.
  const gems = (entry('Oread Gem Magic').situationalNotes ?? [])
    .map((note) => note.text)
    .join(' ');
  expect(gems).toContain('100-foot radius');
  expect(gems).toContain('200 pounds');
  expect(
    (entry('Cliffside Charger (Cragkin)').situationalNotes ?? [])
      .map((note) => note.text)
      .join(' '),
  ).toContain('+10-foot racial bonus');
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
  for (const name of ['War-Leader', 'Umbral Escort'])
    expect(
      candidate(name).mechanicsReview.sourceDiscrepancies.join(' '),
      name,
    ).toMatch(/listed for review/i);
  // Pit Boss and Weapon Familiarity (Halfling) grant a weapon proficiency
  // from their weapon field; no other record grants one.
  const grants: Record<string, string[]> = {
    'Pit Boss': ['Whip'],
    'Weapon Familiarity (Halfling)': ['Sling'],
  };
  for (const row of assessedTraits) {
    expect(row.mechanicsReview.proficiencyReview.grants, row.name).toEqual(
      grants[row.name] ?? [],
    );
    expect(
      (entry(row.externalKey).proficiencies ?? []).map((p) =>
        'baseType' in p ? p.baseType : p,
      ),
      row.name,
    ).toEqual(grants[row.name] ?? []);
  }
});

it('records the race, alternate-trait, monster-ability and Unchained notice dependencies and enforces every hold', () => {
  const held = new Map(heldNotices.map((row) => [row.id, row.notices]));
  const holdId = (book: string) =>
    `racial-traits-398-notice-${book}-complete-chain`;
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
      `racial-traits-398-whole-content-${row.externalKey.split('/')[1]}`,
    ]);
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices.filter((book) => book !== 'PZO1110').map(holdId),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  expect(
    assessedTraits.filter((row) => row.racialTraitKind === 'alt'),
  ).toHaveLength(32);
  // Universal monster rules the bodies grant or name take the earliest book
  // their pinned Universal Monster Rules journal page lists.
  for (const [name, book, page] of [
    ['Draconic Heritage', 'PZO1127', 'Darkvision'],
    ['Draconic Heritage', 'PZO1112', 'Low-Light Vision'],
    ['Darkvision (Aphorite)', 'PZO1127', 'Darkvision'],
    ['Darkvision (Changeling)', 'PZO1127', 'Darkvision'],
    ['Blended View (Elf)', 'PZO1127', 'Darkvision'],
    ['Treasure Sense', 'PZO1112', 'Scent'],
    ['Telepathy', 'PZO1112', 'Telepathy'],
    ['Defensive Abilities', 'PZO1116', 'No Breath'],
    ['Defensive Abilities', 'PZO1112', 'Resistance'],
    ['Maelstrom Resistance', 'PZO1112', 'Resistance'],
    ['Energy Strike (Electricity)', 'PZO1112', 'Resistance'],
    ['Fire in the Blood', 'PZO1112', 'Fast Healing'],
    ['Light Sensitivity (Dhampir)', 'PZO1112', 'Light Sensitivity'],
    ['Natural Weapon (Kuru)', 'PZO1112', 'Natural Attacks'],
    ['Blunt Head', 'PZO1112', 'Natural Attacks'],
    ['Poison Minion (Drow)', 'PZO1112', 'Poison'],
    ['Werewolf-Kin (Witchwolf)', 'PZO1112', 'Natural Attacks'],
    ['Werewolf-Kin (Witchwolf)', 'PZO1127', 'Darkvision'],
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
  // Rules the bodies depend on: the Ultimate Magic Eldritch Heritage feat,
  // the APG and ARG spells, the Bestiary advanced simple template, Ultimate
  // Campaign's mass combat, and Fox Shape (Dragon Empires Primer) with its
  // Bestiary 3 fox.
  for (const [name, book] of [
    ['Draconic Heritage', 'PZO1117'],
    ['Superior Shapeshifter', 'PZO1120'],
    ['Oread Gem Magic', 'PZO1115'],
    ['Oread Gem Magic', 'PZO1121'],
    ['Oread Gem Magic', 'PZO1112'],
    ['War-Leader', 'PZO1125'],
    ['Superior Shapeshifter', 'PZO9421'],
    ['Honey Whisperer', 'PZO1129'],
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
    'Aquatic (Aquatic Elf)',
    'Dwarf',
    'Goblinoid (Goblin)',
    'Native Outsider (Aasimar)',
  ])
    expect(
      candidate(name).inheritedRuleUnresolvedOrigins.join(' '),
      name,
    ).toContain('Creature type and subtype rules');
  // Linked feats with empty source fields take their books from the
  // inherited rules (feats-341 and feats-363): no "no source" hold.
  for (const name of ['Draconic Heritage', 'Superior Shapeshifter'])
    expect(
      candidate(name).inheritedRuleUnresolvedOrigins.join(' '),
      name,
    ).not.toContain('cites no source');
  for (const [name, path, line, book] of [
    ['Draconic Heritage', 'ultimate_magic/um_feats.lst', 37, 'PZO1117'],
    [
      'Superior Shapeshifter',
      'dragon_empires_primer/dep_feats.lst',
      23,
      'PZO9421',
    ],
  ] as const)
    expect(
      candidate(name).inheritedRuleComparisonEvidence.some(
        (row) =>
          row.path.endsWith(path) && row.line === line && row.book === book,
      ),
      name,
    ).toBe(true);
  expect(
    candidate('Draconic Heritage').mechanicsReview.sourceDiscrepancies.join(
      ' ',
    ),
  ).toContain('"APG" superscript');
  // Rejected rows and PCGen leads don't add books: Ink Cloud's Bestiary 3
  // monster row is a lead, and the heritage parts' parent rows are rejected.
  expect(candidate('Ink Cloud').requiredNotices).not.toContain('PZO1120');
  expect(
    candidate('Ink Cloud').additionalComparisonLeads.map((row) => row.book),
  ).toEqual(['PZO1120']);
  expect(
    candidate(
      'Spell-Like Ability (Tiefling - Grimspawn)',
    ).rejectedRootComparisonEvidence.map((row) => row.line),
  ).toEqual([21]);
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
    'pf1-content/bUnlzKQfFNF97MqX': ['Base Statistics'], // Mystic
    'pf1-content/dEtxdn5mLY5M3i45': [
      'Alternate Spell-Like Ability (Dhampir - Ru-Shi)',
    ], // Alternate Spell-Like Ability (Dhampir - Ru-Shi)
    'pf1-content/dQpQkqUUdP5QbbYn': ['Base Statistics'], // Avenging
    'pf1-content/eIkJlRpLALMQNc4J': ['Base Statistics'], // Cosmopolitan
  });
  // War-Leader replaces two half-orc traits, Poison Minion (Drow) four;
  // the curated heritage line resolves "Base Statistics" to the
  // skinwalker's ability score trait.
  expect(entry('War-Leader').detail.replaces).toHaveLength(2);
  expect(entry('Poison Minion (Drow)').detail.replaces).toHaveLength(4);
  expect(
    entry('Alternate Weakness (Dhampir - Ajibachana)').detail.replaces,
  ).toEqual(['pf1-content/eJIBuryG68v4PJLk']);
  expect(
    entry('Werewolf-Kin (Witchwolf)').detail.unresolvedReplacements ?? [],
  ).toEqual([]);
});

it('pins all 100 keys, the complete bodies, checked bindings and literal PCGen and PRD evidence in the shared store', async () => {
  expect(review.candidates).toHaveLength(100);
  expect(new Set(review.candidates.map((row) => row.externalKey)).size).toBe(
    100,
  );
  expect(review.counts).toEqual({
    total: 100,
    admitted: 2,
    held: 75,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 23,
    excludedFolders: 11,
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
  expect(preview.entries).toHaveLength(77);
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
  expect(assessedTraits.filter((row) => row.prdComparison)).toHaveLength(16);
  expect(
    assessedTraits
      .filter((row) => row.prdComparison && !row.prdComparison.textMatches)
      .map((row) => row.name)
      .sort(),
  ).toEqual([
    'Elven Magic (Elf)',
    'Languages (Goblin)',
    'Languages (Hobgoblin)',
    'Languages (Ratfolk)',
  ]);
  // The Spell-Like Ability heritage parts' parent rows are rejected rows.
  for (const name of [
    'Spell-Like Ability (Aasimar - Plumekith)',
    'Spell-Like Ability (Aasimar - Lawbringers)',
  ])
    expect(
      candidate(name).rejectedRootComparisonEvidence.map((row) => [
        row.book,
        row.line,
      ]),
      name,
    ).toEqual([[null, 23]]);
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
      required: 40,
      checked: 40,
      missing: 0,
      descriptions: { candidates: 77, checked: 77 },
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
    const gate = assessCatalogAdmission({
      artifact: authoritative,
      ...reviewedAdmission,
    });
    // #328 S4-B admits the batch's Half-Elf, Elf, Gnome and Halfling
    // standard traits; every other record stays held.
    expect(
      gate.admitted
        .filter((row) => ours.has(row.externalKey))
        .map((row) => row.externalKey)
        .sort(),
    ).toEqual(admittedTraits.map((row) => row.externalKey).sort());
    // Only Defensive Abilities' stripped universal-monster-rules link fails
    // (an import gap that doesn't depend on curation); every other record is
    // held on its own reasons.
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
    const held = gate.held.filter((row) => ours.has(row.externalKey));
    expect(held).toHaveLength(77 - UNRESOLVED_LINK_GAP.length - 2);
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
    const keen = candidate('Weapon Familiarity (Halfling)');
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
