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
} from '../fixtures/racial-traits-393/data';
import {
  previewEntry,
  racialTraitSheet,
  sheetDefinition,
} from '../fixtures/racial-traits-393/sheet';
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
  'pf1-content/L2ucOsiHPXq7FKKF', // Cold-Blooded (Reptoid)
  'pf1-content/L6hDTTsdEWKBj4gE', // Suspicious (Strix)
  'pf1-content/MiPbhGqPRX7H4C7a', // Gnome Magic (Gnome)
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
// body (a replaced trait, a linked spell or a body reached through its race),
// or both.
const unchainedOwn = [
  'pf1-content/KqmKgeDMWBIS2qNP', // Festive
  'pf1-content/LUlO5qY8jJdj6gtz', // Fell Magic (Gnome)
  'pf1-content/LVToSTaVYtVk7Sa3', // Spell-Like Ability (Aasimar)
  'pf1-content/LcNmShAWgSJlqeMG', // Lesser Spell-Like Abilities
  'pf1-content/LgS28VNVT3n6hCKH', // Flexible Half-Breed
  'pf1-content/M8L159eLa2EZlLWg', // Change Shape (Skinwalker - Coldborn)
  'pf1-content/MHNxeoT3fFxa3kL2', // Change Shape (Skinwalker - Aerieborn)
  'pf1-content/MQnZG0JAiMqtO91T', // Frostmelding
  'pf1-content/Mcn12mWoyj1AY6j1', // Triton Magic
  'pf1-content/MiPbhGqPRX7H4C7a', // Gnome Magic (Gnome)
  'pf1-content/NBbiF9fQTgRfNaFb', // Hag Magic (AoE)
  'pf1-content/NbYp94wEAcVHg28i', // Fey Magic (Human)
  'pf1-content/NhfWDtVQtBcpKMBP', // Eternal Hope
  'pf1-content/NuYBojmRnuwgyASW', // Treacherous Earth (Oread)
];
const unchainedBound = [
  'pf1-content/KW6G6g9qFZLryJxQ', // Mwangi Dwarves (its linked Magic Resistant and Breath Weapon (Dwarf))
  'pf1-content/LUlO5qY8jJdj6gtz', // Fell Magic (Gnome) (Gnome Magic and the linked spells)
  'pf1-content/LVToSTaVYtVk7Sa3', // Spell-Like Ability (Aasimar) (its linked spells)
  'pf1-content/LcNmShAWgSJlqeMG', // Lesser Spell-Like Abilities (its linked spells)
  'pf1-content/LdbfPqPoza3xBUde', // Alternate Weakness (Dhampir - Ru-Shi) (daylight, through Light Sensitivity (Dhampir))
  'pf1-content/LgS28VNVT3n6hCKH', // Flexible Half-Breed (its linked spells)
  'pf1-content/M8L159eLa2EZlLWg', // Change Shape (Skinwalker - Coldborn) (Change Shape (Skinwalker))
  'pf1-content/MHNxeoT3fFxa3kL2', // Change Shape (Skinwalker - Aerieborn) (Change Shape (Skinwalker))
  'pf1-content/MQnZG0JAiMqtO91T', // Frostmelding (its linked spells)
  'pf1-content/Mcn12mWoyj1AY6j1', // Triton Magic (Spell-Like Ability (Undine) and summon nature's ally I)
  'pf1-content/MiPbhGqPRX7H4C7a', // Gnome Magic (Gnome) (its linked spells)
  'pf1-content/NApPIjNkVNBxzQS3', // Gatecrasher (Orc Ferocity)
  'pf1-content/NBbiF9fQTgRfNaFb', // Hag Magic (AoE) (its linked spells)
  'pf1-content/NBmeuhkyRCjD3kV4', // Asura-Spawn (Faultspawn) (through the tiefling's traits)
  'pf1-content/NQsZRny6Ed9oGDDP', // Shadow Inheritor (Shadow Magic (Wayang) and its spells)
  'pf1-content/Ni5twdUyps9MQyOX', // Jiang-Shi Born (Ru-Shi) (erase)
  'pf1-content/NuYBojmRnuwgyASW', // Treacherous Earth (Oread) (Spell-Like Ability (Oread))
];

it('resolves the reviewed racial trait Modifiers through the public resolver', () => {
  // Asura-Spawn's curated ability line replaces the tiefling's ability score
  // trait: it goes dormant, and the heritage's own adjustments count.
  const faultspawn = entry('Asura-Spawn (Faultspawn)');
  const tieflingKey = faultspawn.detail.raceKeys?.[0];
  if (!tieflingKey) throw new Error('Asura-Spawn has no race');
  expect(faultspawn.detail.replaces).toEqual([
    `local/race-ability-scores/${tieflingKey}`,
  ]);
  expect(faultspawn.detail.unresolvedReplacements).toBeUndefined();
  expect(previewEntry('Tiefling').externalKey).toBe(tieflingKey);
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
    expect(total(faultspawnSheet, target), `Faultspawn ${target}`).toBe(value);
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
    ['Shadow Inheritor', 'casterLevel', 'casterLevel', 'shadow descriptor', 1],
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
  // Obsessive, a standard gnome trait, stays prose: Modifiers would change
  // the Gnome race totals the #719 check pins.
  expect(entry('Obsessive').modifiers).toEqual([]);
  // One chosen Knowledge skill: ten Modifiers, one Situation each; choosing
  // one leaves the other Knowledge skills unchanged.
  for (const name of ['Knowledgeable', 'Memories of the Forgotten']) {
    expect(modifiers(name), name).toHaveLength(10);
    const arcana = indexOf(name, 'skill.kar', 'Knowledge (arcana)');
    expect(resolved(name, 'skill.kre', [arcana]), name).toBe(0);
  }
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
  // Racial bonuses from distinct Sources stack (PRD; character-sheet.ts):
  // Trusted Mediator and Cold-Blooded each give +2 racial against
  // mind-affecting effects, +4 together.
  const both = resolveSheet(
    [...modifiers('Trusted Mediator'), ...modifiers('Cold-Blooded')],
    { situations: ['mindAffecting'] },
  );
  expect(both['save.will'].total).toBe(4);
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
  // The Moon May ability record replaces the changeling's own ability trait
  // by name: it goes dormant and the untyped line counts.
  const moon = entry('Ability Modifiers (Changeling - Moon May)');
  const changelingAbilities = 'pf1-content/PxjUu8YOjXmWdagL';
  expect(moon.detail.replaces).toEqual([changelingAbilities]);
  expect(
    entry('Ability Modifiers (Changeling - Hearth May)').detail.replaces,
  ).toEqual([changelingAbilities]);
  const changeling = moon.detail.raceKeys?.[0];
  if (!changeling) throw new Error('Moon May has no race');
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
  // Notes carry the readable rules; no armor, shield or natural armor bonus
  // sits on ac.other.
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
      expect(record.outputs.length, row.name).toBeGreaterThan(0);
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
  expect(required).toBe(38);
  // Race-covered trait notes and the re-homed Gnome Magic DC have no
  // required record of their own.
  for (const name of ['Cold-Blooded', 'Suspicious', 'Gnome Magic (Gnome)'])
    expect(candidate(name).mechanicsReview.curationRecords, name).toHaveLength(
      1,
    );
  // Notes the Foundry data put on unrelated statistics are entry-level.
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
  // Seasoned's Notes follow the body's temperature ranges, not the Foundry
  // notes' (90 to 110 and 40 to 0 degrees).
  const seasoned = (entry('Seasoned').situationalNotes ?? [])
    .map((note) => note.text)
    .join(' ');
  expect(seasoned).toContain('between 90 and 140 degrees');
  expect(seasoned).toContain('between 40 and -20 degrees');
  // Every record lists its outstanding calculations, never as a hold.
  for (const row of assessedTraits) {
    expect(
      row.mechanicsReview.outstandingCalculations.length,
      row.name,
    ).toBeGreaterThan(0);
    for (const text of row.mechanicsReview.outstandingCalculations)
      expect(row.holdIds.join(' '), row.name).not.toContain(text);
  }
  // The two disputed ability lines are outstanding calculations.
  for (const name of ['Wereboar-Kin (Ragebred)', 'Jiang-Shi Born (Ru-Shi)'])
    expect(
      candidate(name).mechanicsReview.outstandingCalculations.join(' '),
      name,
    ).toContain('No book PDF is available to decide between them');
  // Weapon proficiencies are imported from the records' weaponProf fields.
  const grants = {
    'Weapon Familiarity (Drow)': ['Hand Crossbow', 'Rapier', 'Shortsword'],
    'Jininese Weapon Mastery': ['Fighting Fan', 'Tonfa'],
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
  // Skilled's extra rank is read as one rank per level.
  expect(entry('Skilled (Human)').detail.bonusSkillRanksPerLevel).toBe(1);
});

it('records the race, alternate-trait, monster-ability and Unchained notice dependencies and enforces every hold', () => {
  const held = new Map(heldNotices.map((row) => [row.id, row.notices]));
  const holdId = (book: string) =>
    `racial-traits-393-notice-${book}-complete-chain`;
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
    if (row.disposition !== 'held') {
      // #328 S4-A: the launch comparison supersedes the whole-content
      // hold, and the notice chains are reviewed (PZO1110), cleared
      // (PZO1121) or confirmed (PZO9280), so the row records no hold.
      expect(row.holdIds, row.name).toEqual([]);
      expect(row.noticeHoldIds, row.name).toEqual([]);
      continue;
    }
    expect(row.holdIds, row.name).toEqual([
      `racial-traits-393-whole-content-${row.externalKey.split('/')[1]}`,
    ]);
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices.filter((book) => book !== 'PZO1110').map(holdId),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  expect(
    assessedTraits.filter((row) => row.racialTraitKind === 'alt'),
  ).toHaveLength(37);
  // Knowledgeable's folder binds no race: both pinned lashunta race records'
  // books are recorded and required.
  expect(entry('Knowledgeable').detail.raceKeys).toEqual([]);
  expect(
    candidate('Knowledgeable')
      .inheritedRuleNotices.filter((notice) =>
        notice.location.includes('/packs/races/'),
      )
      .map((notice) => notice.rule.split(' race')[0]),
  ).toEqual(['the Lashunta (Male)', 'the Lashunta (Female)']);
  // Universal monster rules the bodies grant take the earliest book their
  // pinned Universal Monster Rules journal page lists.
  for (const [name, book, page] of [
    ['Dusksight (Gnome)', 'PZO1112', 'Low-Light Vision'],
    ['Deep Dweller', 'PZO1127', 'Darkvision'],
    ['Deep Dweller', 'PZO1112', 'Light Sensitivity'],
    ['Darkvision (Gnome)', 'PZO1127', 'Darkvision'],
    ['Senses (Dhampir)', 'PZO1112', 'Low-Light Vision'],
    ['Riverfolk', 'PZO1112', 'Vulnerabilities'],
    ['Spell Resistance (Drow)', 'PZO1112', 'Spell Resistance'],
    ['Amphibious (Merfolk)', 'PZO1112', 'Amphibious'],
    ['Amphibious (Grindylow)', 'PZO1112', 'Amphibious'],
    ['Claw Attack', 'PZO1112', 'Natural Attacks'],
    ['Natural Weapon (Tengu)', 'PZO1112', 'Natural Attacks'],
    ['Change Shape (Skinwalker - Coldborn)', 'PZO1112', 'Scent'],
    ['Fey Magic (Human)', 'PZO1112', 'Low-Light Vision'],
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
  // Rules the bodies depend on: the shadow descriptor the body cites to
  // Ultimate Magic, the shadow bloodline and the oracle (APG), and the
  // Ultimate Equipment weapons Jininese elves use.
  for (const [name, book] of [
    ['Shadow Inheritor', 'PZO1117'],
    ['Shadow Inheritor', 'PZO1115'],
    ['Jininese Weapon Mastery', 'PZO1123'],
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
  // Creature types, the dolphin and the third-party record have no pinned
  // rules record: named unresolved origins.
  for (const [name, text] of [
    ['Leshy', 'Creature type and subtype rules'],
    ['Outsider', 'Creature type and subtype rules'],
    ['Amphibious (Merfolk)', 'Creature type and subtype rules'],
    ['Triton Magic', 'dolphin'],
    ['Multi-Armed (Green Martian)', 'Third-party source'],
  ] as const)
    expect(
      candidate(name).inheritedRuleUnresolvedOrigins.join(' '),
      name,
    ).toContain(text);
  // Rejected rows and PCGen leads don't add books.
  expect(
    candidate('Hag Magic (AoE)').rejectedRootComparisonEvidence.map(
      (row) => row.book,
    ),
  ).toEqual(['PZO9280']);
  expect(candidate('Poison Use (Adaro)').requiredNotices).not.toContain(
    'PZO1120',
  );
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
      if (trait && trait.disposition !== 'held')
        expect(trait.noticeHoldIds, trait.name).toEqual([]);
      else expect(trait?.noticeHoldIds).toContain(row.holdId);
    }
  }
});

it('records the importer reading of every race, replacement and unresolved name', () => {
  const replacements740: Record<string, string[]> = {
    'pf1-content/Ni5twdUyps9MQyOX': [
      'local/race-ability-scores/pf1/puKk997wHX3kIRkR',
    ],
  };
  for (const row of assessedTraits) {
    const detail = entry(row.externalKey).detail;
    const reviewed = row.mechanicsReview.racialTraitReview;
    expect(reviewed.raceKeys, row.name).toEqual(detail.raceKeys);
    expect(reviewed.standard, row.name).toBe(detail.standard);
    expect(
      replacements740[row.externalKey] ?? reviewed.replaces,
      row.name,
    ).toEqual(detail.replaces ?? []);
    expect(
      replacements740[row.externalKey] ? [] : reviewed.unresolvedReplacements,
      row.name,
    ).toEqual(detail.unresolvedReplacements ?? []);
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
  // Hag Magic (AoE) replaces the changeling's claws and natural armor.
  expect(entry('Hag Magic (AoE)').detail.replaces).toEqual([
    'pf1-content/CmhdInCVqMiadv3T',
    'pf1-content/Qx1JqPVW0quaOGfY',
  ]);
});

it('pins all 100 keys, the complete bodies, checked bindings and literal PCGen and PRD evidence in the shared store', async () => {
  expect(review.candidates).toHaveLength(100);
  expect(new Set(review.candidates.map((row) => row.externalKey)).size).toBe(
    100,
  );
  expect(review.counts).toEqual({
    total: 100,
    admitted: 3,
    held: 70,
    dependentlyOmitted: 1,
    unsupportedProseOnly: 0,
    excluded: 26,
    excludedFolders: 15,
    excludedRaceBuilder: 11,
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
  expect(assessedTraits.filter((row) => row.prdComparison)).toHaveLength(22);
  expect(
    assessedTraits
      .filter((row) => row.prdComparison && !row.prdComparison.textMatches)
      .map((row) => row.name)
      .sort(),
  ).toEqual([
    'Air Affinity',
    'Eternal Hope',
    'Gatecrasher',
    'Gnome Magic (Gnome)',
    'Senses (Dhampir)',
    'Skilled (Human)',
    'Spell Resistance (Drow)',
    'Spell-Like Ability (Aasimar)',
  ]);
  // Gatecrasher's untyped "+2 bonus" (the APG wording) where the PRD reads
  // "racial", and the aasimar's "character level" where the PRD reads "class
  // level": recorded, not resolved.
  expect(
    candidate('Gatecrasher').prdComparison?.wordDifferences,
  ).toContainEqual({ pinned: '', prd: 'racial' });
  expect(
    candidate('Spell-Like Ability (Aasimar)').prdComparison?.wordDifferences,
  ).toContainEqual({ pinned: 'character', prd: 'class' });
  // Gatecrasher follows its APG row's wording, with the ARG row rejected;
  // Warslinger, Low Blow and Eternal Hope follow their ARG rows, with the
  // earlier APG printings as leads. Both books are cited and required.
  expect(candidate('Gatecrasher').comparison?.book).toBe('PZO1115');
  expect(
    candidate('Gatecrasher').rejectedRootComparisonEvidence.map(
      (row) => row.book,
    ),
  ).toEqual(['PZO1121']);
  for (const name of ['Warslinger', 'Low Blow', 'Eternal Hope']) {
    expect(candidate(name).comparison?.book, name).toBe('PZO1121');
    expect(
      candidate(name).additionalComparisonLeads.map((row) => row.book),
      name,
    ).toEqual(['PZO1115']);
  }
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
      required: 38,
      checked: 38,
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
    // #328 S4-B: Gnome Magic is confirmed, but the committed gate omits it
    // on the four cantrips it links (held in their own batches).
    expect(
      assessCatalogAdmission({ artifact: authoritative, ...reviewedAdmission })
        .dependentOmissions.filter((row) => ours.has(row.externalKey))
        .map((row) => [row.externalKey, row.reason]),
    ).toEqual([
      [
        'pf1-content/MiPbhGqPRX7H4C7a',
        'Dependent omission: pf1/a6isom7wx0nmhwfp, pf1/ct9fhh8uawn8e4md, pf1/mtxqp85izkb20djq, pf1/zymaptg3vmnvfvxl.',
      ],
    ]);
    const settled = new Set(
      assessedTraits
        .filter((row) => row.disposition !== 'held')
        .map((row) => row.externalKey),
    );
    const held = gate.held.filter(
      (row) => ours.has(row.externalKey) && !settled.has(row.externalKey),
    );
    expect(held).toHaveLength(70);
    // The Dynamite comics source-matched hold (known-notice-holds.json,
    // #227/#241) wins over the batch hold for the Green Martian record.
    for (const row of held)
      if (row.name === 'Multi-Armed (Green Martian)')
        expect(row.reason).toContain('Known notice/evidence hold');
      else {
        const additions740: Record<string, string> = {
          'Wereboar-Kin (Ragebred)':
            'Automatic ability mapping and Base Statistics replacement are withheld.',
          'Jiang-Shi Born (Ru-Shi)':
            'The exact pinned native ability line is +2 Str, +2 Int, -2 Dex.',
        };
        if (additions740[row.name]) {
          expect(row.reason, row.name).toContain(
            candidate(row.externalKey).rationale,
          );
          expect(row.reason, row.name).toContain(additions740[row.name]);
        } else
          expect(row.reason, row.name).toBe(
            candidate(row.externalKey).rationale,
          );
      }
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
          evidenceIds: Object.keys(row.currentBinding.evidenceFingerprints),
          ...reviewedAdmission,
        }),
      ).toEqual(bindSnapshotToCurrentNotices(row.currentBinding));
    }
    // Confirming a CRB-cited standard trait's whole content still holds it on
    // its other books' held notices.
    const gnome = candidate('Keen Senses (Gnome)');
    expect(gnome.requiredNotices).toEqual(['PZO9280', 'PZO1121', 'PZO1110']);
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
