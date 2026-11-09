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
} from '../fixtures/racial-traits-395/data';
import {
  racialTraitSheet,
  sheetDefinition,
} from '../fixtures/racial-traits-395/sheet';
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
  'pf1-content/T4PaZ33R29gTAFaT', // Stability (Dwarf)
];
// Records whose description link the importer cannot resolve fail admission
// on that import gap in any preview: Orc Atavism links the unassigned
// pf-universal-monster-rules Ferocity record (reported as its own gap).
const UNRESOLVED_LINK_GAP = ['pf1-content/SJOcTJ2MQI3AoMeh'];
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

it('retains the Orc equivalence explicitly stated by Orc Atavism after Orc Blood is replaced', () => {
  expect(entry('Orc Atavism').countsAsRaces).toEqual(['pf1/JOuAdPAOTat7d5v6']);
  const sheet = identityRace(
    racialTraitSheet({ traits: ['pf1-content/SJOcTJ2MQI3AoMeh'] }),
    'pf1/dCAXgdA6Db1Z3ccz',
    ['pf1-content/JWzMBJeAQYDav9gw'],
  );
  expect(
    calculateCharacterSheetProjections(sheet).current.racial.countsAsRaces,
  ).toEqual(['pf1/JOuAdPAOTat7d5v6', 'pf1/dCAXgdA6Db1Z3ccz'].sort());
});
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
  'pf1-content/RKCOV7Roq9MdxLZ5', // Faerie Dragon Magic
  'pf1-content/RScQcZuZDW9bGV8c', // Elemental Assault
  'pf1-content/RciaNbMBeBVfJMjZ', // Energy Strike (Acid)
  'pf1-content/RleWFHpXOUaneeqN', // Alternate Spell-Like Ability (Skinwalker - Seascarred)
  'pf1-content/RpWzdpSJZcaBAvhn', // Spell-Like Ability (Sylph - Smokesoul)
  'pf1-content/RyZzO5ouGh5GzvjZ', // Spell-Like Ability (Ifrit)
  'pf1-content/SL536HxlnXKaBne1', // Piety
  'pf1-content/SNbWlc13JTMMG3qd', // Pass without Trace
  'pf1-content/SWGQSYy6SVgjeVyj', // Efreeti Magic
  'pf1-content/SlDu4fhDm9imymQ9', // Natural Magic
  'pf1-content/SqRzbbqegU7NiqI0', // Magical Taskmaster
  'pf1-content/T88sJDx0MPvvjKtb', // Nimbus of Vitality
  'pf1-content/TJfxEOgpWyjJcZJJ', // Spell-Like Ability (Ifrit - Sunsoul)
  'pf1-content/TNbX1iRPplCIvhdO', // Spell-Like Ability (Tiefling - Pitborn)
  'pf1-content/ThceEvBPQBpGFGS0', // Mordant Envoy
  'pf1-content/TkLZDtMlHbg0Ljlt', // Prehensile Tail (Tiefling)
  'pf1-content/TqLGCRRZcEjDtZvM', // Cheek Pouches
];
const unchainedBound = [
  'pf1-content/R7UDXRs0E5klyzCY', // Garuda-Blooded (Plumekith)
  'pf1-content/RKCOV7Roq9MdxLZ5', // Faerie Dragon Magic
  'pf1-content/RciaNbMBeBVfJMjZ', // Energy Strike (Acid)
  'pf1-content/RleWFHpXOUaneeqN', // Alternate Spell-Like Ability (Skinwalker - Seascarred)
  'pf1-content/RpWzdpSJZcaBAvhn', // Spell-Like Ability (Sylph - Smokesoul)
  'pf1-content/Rx1ayk8e3zpDoslL', // Forge-Hardened
  'pf1-content/RyZzO5ouGh5GzvjZ', // Spell-Like Ability (Ifrit)
  'pf1-content/S2fAbQom6ogn4gh9', // Wereraptor-Kin (Aerieborn)
  'pf1-content/SFD4dGofogr1c1S9', // Nosferatu-Born (Ancient-Born)
  'pf1-content/SJOcTJ2MQI3AoMeh', // Orc Atavism
  'pf1-content/SNbWlc13JTMMG3qd', // Pass without Trace
  'pf1-content/SQZL2A9E62X4Xn7i', // Duplicitous
  'pf1-content/SWGQSYy6SVgjeVyj', // Efreeti Magic
  'pf1-content/SlDu4fhDm9imymQ9', // Natural Magic
  'pf1-content/T88sJDx0MPvvjKtb', // Nimbus of Vitality
  'pf1-content/TJfxEOgpWyjJcZJJ', // Spell-Like Ability (Ifrit - Sunsoul)
  'pf1-content/TNbX1iRPplCIvhdO', // Spell-Like Ability (Tiefling - Pitborn)
  'pf1-content/TRCZ20ubvIc5MASZ', // Outsear Sahuagin
  'pf1-content/TSEP7Z6CFb3Clbjh', // Lost Promise
  'pf1-content/ThceEvBPQBpGFGS0', // Mordant Envoy
  'pf1-content/TwqzAm7tIeUpqdPI', // Risky Troublemaker
];

it('resolves the reviewed racial trait Modifiers through the public resolver', () => {
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
  const plain = identityRace(racialTraitSheet({}), aasimar, [ability, skilled]);
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
  // Insight and dodge bonuses go on ac, never on ac.other's armor types.
  expect(
    modifiers('Celestial Crusader').filter((row) => row.target === 'ac'),
  ).toMatchObject([{ bonusType: 'insight', value: 1 }]);
  expect(modifiers('Bond to the Land')).toMatchObject([
    { target: 'ac', bonusType: 'dodge', value: 2 },
  ]);
  // Racial bonuses from distinct Sources stack (PRD; character-sheet.ts):
  // Caretaker's +2 racial Sense Motive and Urbanite's +2 racial Sense Motive
  // to get a hunch give +4 together.
  const hunch = indexOf('Urbanite', 'skill.sen', 'hunch');
  const both = resolveSheet(
    [...modifiers('Caretaker'), modifiers('Urbanite')[hunch]!],
    { situations: [situation('Urbanite', hunch)] },
  );
  expect(both['skill.sen'].total).toBe(4);
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
  // Orc Atavism's ability changes are the importer's mapped Modifiers (#721).
  expect(entry('Orc Atavism').modifiers).toEqual([
    { target: 'ability.str', bonusType: 'racial', value: 2 },
    { target: 'ability.$choice', bonusType: 'racial', value: -2 },
  ]);
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
    'Cold-Honed skill.acr',
    'Shadowhunter (Dwarf) rangedWeapon',
    'Desert Runner conChecks',
    'Lifebound allSavingThrows',
    'Lifebound fort',
    'Lifebound conChecks',
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
  expect(required).toBe(51);
  // Notes the Foundry data put on unrelated statistics are entry-level.
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
  // The Notes follow the body: Joyous Companion's "emotion" without the
  // superscript book reference stays as the pinned text reads.
  const joy = (entry('Joyous Companion').situationalNotes ?? [])
    .map((note) => note.text)
    .join(' ');
  expect(joy).toContain('adjacent allies');
  // Every record lists its outstanding calculations, never as a hold.
  for (const row of assessedTraits) {
    expect(
      row.mechanicsReview.outstandingCalculations.length,
      row.name,
    ).toBeGreaterThan(0);
    for (const text of row.mechanicsReview.outstandingCalculations)
      expect(row.holdIds.join(' '), row.name).not.toContain(text);
  }
  // Hulking Changeling's melee damage bonus stays readable: every hag option
  // is a standard trait of the changeling race (#391 Crawling Skin).
  expect(
    candidate(
      'Hag Racial Trait (Changeling - Hulking Changeling)',
    ).mechanicsReview.outstandingCalculations.join(' '),
  ).toContain('#719');
  // Weapon proficiencies are imported from the records' weaponProf fields;
  // Swordtrained's elven curve blade stays an outstanding fact.
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
    candidate('Swordtrained').mechanicsReview.proficiencyReview
      .outstandingFacts,
  ).toHaveLength(1);
});

it('records the race, alternate-trait, monster-ability and Unchained notice dependencies and enforces every hold', () => {
  const held = new Map(heldNotices.map((row) => [row.id, row.notices]));
  const holdId = (book: string) =>
    `racial-traits-395-notice-${book}-complete-chain`;
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
      `racial-traits-395-whole-content-${row.externalKey.split('/')[1]}`,
    ]);
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices.filter((book) => book !== 'PZO1110').map(holdId),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  expect(
    assessedTraits.filter((row) => row.racialTraitKind === 'alt'),
  ).toHaveLength(32);
  // Universal monster rules the bodies grant take the earliest book their
  // pinned Universal Monster Rules journal page lists.
  for (const [name, book, page] of [
    ['Darkvision (Sylph)', 'PZO1127', 'Darkvision'],
    ['Darkvision (Wyrwood)', 'PZO1127', 'Darkvision'],
    ['Darkvision (Sahuagin)', 'PZO1127', 'Darkvision'],
    ['Low-Light Vision (Gathlain)', 'PZO1112', 'Low-Light Vision'],
    ['Dusksight (Half-Elf)', 'PZO1112', 'Low-Light Vision'],
    ['See in Darkness', 'PZO1116', 'See in Darkness'],
    ['Natural Weapons (Kitsune)', 'PZO1112', 'Natural Attacks'],
    ['Lost Promise', 'PZO1112', 'Natural Attacks'],
    ['Shadowhunter (Dwarf)', 'PZO1112', 'Incorporeal'],
    ['Champion of Dark Powers', 'PZO1112', 'Spell Resistance'],
    ['Energy Strike (Acid)', 'PZO1112', 'Resistance'],
    ['Nimbus of Vitality', 'PZO1112', 'Fast Healing'],
    ['Orc Atavism', 'PZO1112', 'Ferocity'],
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
  // Rules the bodies depend on: Ultimate Magic's emotion descriptor and
  // shaitan bloodline, the APG Metal subdomain, Occult Adventures' thought
  // components, the Inner Sea Races row Orc Atavism comes from, the tiefling's
  // Maw or Claw (ARG) and the human race Mostly Human counts as.
  for (const [name, book] of [
    ['Joyous Companion', 'PZO1117'],
    ['Metal Affinity (Oread - Ironsoul)', 'PZO1117'],
    ['Metal Affinity (Oread - Ironsoul)', 'PZO1115'],
    ['Voiceless', 'PZO1132'],
    ['Orc Atavism', 'PZO9280'],
    ['Lost Promise', 'PZO1121'],
  ] as const)
    expect(candidate(name).requiredNotices, name).toContain(book);
  expect(
    candidate('Mostly Human (Suli)').inheritedRuleNotices.some((notice) =>
      notice.rule.startsWith('the Human race (the body counts'),
    ),
  ).toBe(true);
  expect(
    candidate('Lost Promise')
      .inheritedRuleNotices.filter((notice) =>
        notice.rule.startsWith('the Maw or Claw'),
      )
      .map((notice) => notice.book)
      .sort(),
  ).toEqual(['PZO1121', 'PZO9280']);
  // Unchained action-cost metadata anywhere in the bound closure requires
  // the held PZO1131.
  const unchained = [...new Set([...unchainedOwn, ...unchainedBound])].sort();
  expect(unchained).toHaveLength(26);
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
    'Native Outsider (Suli)',
    'Elf',
    'Reptilian (Kobold)',
    'Catfolk',
    'Perfect',
    'Defensive Training (Grippli)',
    'Celestial Crusader',
    'Mostly Human (Suli)',
  ])
    expect(
      candidate(name).inheritedRuleUnresolvedOrigins.join(' '),
      name,
    ).toContain('Creature type and subtype rules');
  // Rejected rows and PCGen leads don't add books: the mostly human sylph's
  // Inner Sea Races row leaves Languages (Sylph) on its race's books, and
  // Desert Runner follows its APG row with the ARG row as a lead.
  expect(
    candidate('Languages (Sylph)').rejectedRootComparisonEvidence,
  ).toHaveLength(1);
  expect(candidate('Desert Runner').comparison?.book).toBe('PZO1115');
  expect(
    candidate('Desert Runner').additionalComparisonLeads.map((row) => row.book),
  ).toEqual(['PZO1121']);
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
  const replacements740: Record<string, string[]> = {
    'pf1-content/SRBfqkzIldwETAHB': [
      'pf1-content/BFszTUJLlDS1ZDB8',
      'pf1-content/LwDcZanOEHqVaYoh',
      'pf1-content/uAJ9hLZYdH2JX7J8',
    ],
    'pf1-content/TbnWNAk91q2wgqCP': [
      'local/race-ability-scores/pf1/FHY3oIk5zSOFncJH',
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
  // Orc Atavism replaces the half-orc's ability score trait, Intimidating,
  // Orc Blood (the counts-as rule) and Orc Ferocity; Celestial Crusader
  // replaces Celestial Resistance and Skilled (Aasimar).
  expect(entry('Orc Atavism').detail.replaces).toHaveLength(4);
  expect(entry('Orc Atavism').detail.replaces).toContain(
    'pf1-content/JWzMBJeAQYDav9gw',
  );
  expect(entry('Celestial Crusader').detail.replaces).toEqual([
    'pf1-content/Hr7VZkVINGbLYfpo',
    'pf1-content/SiZwOvv9Vz2OluRK',
  ]);
});

it('pins all 100 keys, the complete bodies, checked bindings and literal PCGen and PRD evidence in the shared store', async () => {
  expect(review.candidates).toHaveLength(100);
  expect(new Set(review.candidates.map((row) => row.externalKey)).size).toBe(
    100,
  );
  expect(review.counts).toEqual({
    total: 100,
    admitted: 1,
    held: 81,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 18,
    excludedFolders: 9,
    excludedRaceBuilder: 9,
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
  expect(assessedTraits.filter((row) => row.prdComparison)).toHaveLength(24);
  expect(
    assessedTraits
      .filter((row) => row.prdComparison && !row.prdComparison.textMatches)
      .map((row) => row.name)
      .sort(),
  ).toEqual([
    'Arctic Elf',
    'Bond to the Land',
    'Desert Runner',
    'Efreeti Magic',
    'Gifted Linguist',
    'Imperious Human',
    'Languages (Sylph)',
    'Skilled (Aasimar)',
    'Spell-Like Ability (Ifrit)',
    'Stability (Dwarf)',
    'Swordtrained',
  ]);
  // Stability (Dwarf)'s "receive" where the PRD reads "gain", and
  // Swordtrained's PRD clause the pinned body omits: recorded, not resolved.
  expect(candidate('Stability (Dwarf)').prdComparison?.wordDifferences).toEqual(
    [{ pinned: 'receive', prd: 'gain' }],
  );
  // Orc Atavism's only PCGen row is Inner Sea Races p.212: a lead whose book
  // is required, as #394 did for Skilled (Kitsune).
  expect(
    candidate('Orc Atavism').additionalComparisonLeads.map((row) => [
      row.book,
      row.line,
    ]),
  ).toEqual([['PZO9280', 152]]);
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
      required: 51,
      checked: 51,
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
    // Only Orc Atavism's unresolved link gap fails; it doesn't depend on
    // curation, and every other record is held on its own reasons.
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
    expect(held).toHaveLength(82 - UNRESOLVED_LINK_GAP.length - 1);
    for (const row of held) {
      const additions740: Record<string, string> = {
        'Dual Talent': 'Two different ability scores each gain +2 racial.',
        'Angel-Blooded (Angelkin)':
          'The exact pinned native ability line is +2 Str, +2 Cha.',
      };
      if (additions740[row.name]) {
        expect(row.reason, row.name).toContain(
          candidate(row.externalKey).rationale,
        );
        expect(row.reason, row.name).toContain(additions740[row.name]);
      } else
        expect(row.reason, row.name).toBe(candidate(row.externalKey).rationale);
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
    const gnome = candidate('Stability (Dwarf)');
    expect(gnome.requiredNotices).toEqual(['PZO9280', 'PZO1121', 'PZO1110']);
    // With its PCGen-confirmed books reviewed (2026-10-31), only the notice
    // holds the owner's clearance clears still hold it, so this runs uncleared.
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
