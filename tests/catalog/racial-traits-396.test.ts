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
} from '../fixtures/racial-traits-396/data';
import {
  racialTraitSheet,
  sheetDefinition,
} from '../fixtures/racial-traits-396/sheet';
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
  'pf1-content/UbqcWIBRROTWK8l0', // Pride (Syrinx)
  'pf1-content/XQySDLBHVVeaaRzo', // Resistant (Nagaji)
];
// Records whose description link the importer cannot resolve fail admission
// on that import gap in any preview. None in this batch.
const UNRESOLVED_LINK_GAP: string[] = [];
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
  'pf1-content/UBaGcNVcXL59Bfoq', // Cat's Luck
  'pf1-content/URpcaP1vfemHJyal', // Pyromaniac
  'pf1-content/Ucd87mayBCsB4mpW', // Poison Minion (Half-Orc)
  'pf1-content/Uu1wTwtXGLuFWugv', // Energy Strike (Cold)
  'pf1-content/V1sxwRKkE3x6qoMX', // Spell-Like Ability (Ifrit - Lavasoul)
  'pf1-content/VKKENsPZuC210Ock', // Alternate Spell-Like Ability (Skinwalker - Witchwolf)
  'pf1-content/WCxIMzfaq7mV3b2o', // Inspiration
  'pf1-content/WF6xe4rsv4mnhPIz', // Tree Dialect
  'pf1-content/WJO1PMH4T8qWg9wK', // Experimental Body: Fey-Touched
  'pf1-content/WfRb4ifVrYFjSJNV', // Hypnotic
  'pf1-content/WvOUUxWA9WOyYUGc', // Stone in the Blood
  'pf1-content/X3R13oOAjWS0XJys', // Spell-Like Abilities (Drow Noble)
  'pf1-content/X7Zw9GPsNULV907F', // Prehensile Tail (Vanara)
  'pf1-content/XKf2zezBFglZk9zk', // Poison Minion (Gnome)
  'pf1-content/XPYjs1zYjY2E02gz', // Spell-Like Abilities (Drow)
];
const unchainedBound = [
  'pf1-content/U8dkiXDmSDOETLxv', // Azata-Blooded (Musetouched)
  'pf1-content/UMT2CcRjz9uXlsvb', // Kyton-Spawn (Shackleborn)
  'pf1-content/URpcaP1vfemHJyal', // Pyromaniac
  'pf1-content/Ucd87mayBCsB4mpW', // Poison Minion (Half-Orc)
  'pf1-content/Uu1wTwtXGLuFWugv', // Energy Strike (Cold)
  'pf1-content/V1sxwRKkE3x6qoMX', // Spell-Like Ability (Ifrit - Lavasoul)
  'pf1-content/VKKENsPZuC210Ock', // Alternate Spell-Like Ability (Skinwalker - Witchwolf)
  'pf1-content/VQJKPH7YtgzXQj4J', // Inured
  'pf1-content/VavtvA1snnAQD7lX', // Dragon Slayer
  'pf1-content/W84vzbaWfDxNW2hr', // Bleachlings
  'pf1-content/W8kHLAzmTHKAUWWU', // Special Qualities
  'pf1-content/WCxIMzfaq7mV3b2o', // Inspiration
  'pf1-content/WE57FyExdDq2mjnV', // Sunsoul (Solar Ifrit)
  'pf1-content/WF6xe4rsv4mnhPIz', // Tree Dialect
  'pf1-content/WJO1PMH4T8qWg9wK', // Experimental Body: Fey-Touched
  'pf1-content/WLj6hpVMQwt2vRRP', // Deep Magic
  'pf1-content/WTmVd9Sq3RNMG60F', // Vivacious
  'pf1-content/Wi9RMrZnkVkKMKNF', // First World Gnomes
  'pf1-content/XKf2zezBFglZk9zk', // Poison Minion (Gnome)
];

it('resolves the reviewed racial trait Modifiers through the public resolver', () => {
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
  // Woodcraft's imported +1 racial improves to +2 in forest terrain: one
  // racial bonus per entry, so the stronger applies (not +3).
  for (const target of ['skill.kna', 'skill.sur'] as const) {
    const forest = indexOf('Woodcraft', target, 'forest');
    expect(resolved('Woodcraft', target), target).toBe(1);
    expect(resolved('Woodcraft', target, [forest]), target).toBe(2);
  }
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
  // Aphorite Resistances' poison and mind-affecting bonuses are one untyped
  // bonus on one entry: they do not add.
  expect(resolved('Aphorite Resistances', 'save.will', [0, 1])).toBe(2);
  expect(modifiers('Aphorite Resistances')).toMatchObject([
    { target: 'saves', bonusType: 'untyped', value: 2 },
    { target: 'saves', bonusType: 'untyped', value: 2 },
  ]);
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
  // The half-orc's +2 to one ability score stays the importer's mapped
  // choice Modifier (#721).
  expect(entry('+2 to One Ability Score (Half-Orc)').modifiers).toEqual([
    { target: 'ability.$choice', bonusType: 'racial', value: 2 },
  ]);
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
  // Dodge bonuses go on ac, never on ac.other's armor types.
  for (const name of ['Dragon Slayer', 'Defensive Training (Kasatha)'])
    expect(
      modifiers(name).filter((row) => row.target === 'ac'),
      name,
    ).toMatchObject([{ bonusType: 'dodge', value: 2 }]);
  // No armor, shield or natural armor bonus sits on ac.other.
  for (const row of preview.entries)
    for (const modifier of row.modifiers)
      if (['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType))
        expect(modifier.target, row.name).not.toBe('ac.other');
});

it('checks every required note record and the separate description pass against the pinned bodies', () => {
  // Foundry notes whose rule another Note states, or a race record already
  // supplies (latent overlap): explicit covered/no-output records.
  const covered = new Set([
    'Pyromaniac spellEffect',
    'Poison Minion (Gnome) ac',
    'Undead Resistance allSavingThrows',
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
  expect(required).toBe(33);
  // Notes the Foundry data put on unrelated statistics are entry-level.
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
  // The Notes read Foundry enrichers as text: light blindness's conditions.
  const blind = (entry('Light Blindness (Sahuagin)').situationalNotes ?? [])
    .map((note) => note.text)
    .join(' ');
  expect(blind).toContain('blinded for 1 round');
  // Every record lists its outstanding calculations, never as a hold.
  for (const row of assessedTraits) {
    expect(
      row.mechanicsReview.outstandingCalculations.length,
      row.name,
    ).toBeGreaterThan(0);
    for (const text of row.mechanicsReview.outstandingCalculations)
      expect(row.holdIds.join(' '), row.name).not.toContain(text);
  }
  // Frostlaced Flesh's cold save bonus stays readable: every hag option is a
  // standard trait of the changeling race (#391 Crawling Skin).
  expect(
    candidate(
      'Hag Racial Trait (Changeling - Frostlaced Flesh)',
    ).mechanicsReview.outstandingCalculations.join(' '),
  ).toContain('#719');
  // Practicality's imported racial Sense Motive, which the body gives
  // untyped, is listed for review rather than fixed.
  expect(
    candidate('Practicality').mechanicsReview.sourceDiscrepancies.join(' '),
  ).toContain('listed for review');
  // No record of this batch grants a weapon or armor proficiency.
  for (const row of assessedTraits) {
    expect(row.mechanicsReview.proficiencyReview.grants, row.name).toEqual([]);
    expect(entry(row.name).proficiencies ?? [], row.name).toEqual([]);
  }
});

it('records the race, alternate-trait, monster-ability and Unchained notice dependencies and enforces every hold', () => {
  const held = new Map(heldNotices.map((row) => [row.id, row.notices]));
  const holdId = (book: string) =>
    `racial-traits-396-notice-${book}-complete-chain`;
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
      `racial-traits-396-whole-content-${row.externalKey.split('/')[1]}`,
    ]);
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices.filter((book) => book !== 'PZO1110').map(holdId),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  expect(
    assessedTraits.filter((row) => row.racialTraitKind === 'alt'),
  ).toHaveLength(29);
  // Universal monster rules the bodies grant take the earliest book their
  // pinned Universal Monster Rules journal page lists.
  for (const [name, book, page] of [
    ['Darkvision (Ratfolk)', 'PZO1127', 'Darkvision'],
    ['Darkvision (Tiefling)', 'PZO1127', 'Darkvision'],
    ['Darkvision (Wyvaran)', 'PZO1127', 'Darkvision'],
    ['Darkvision (Aasimar)', 'PZO1127', 'Darkvision'],
    ['Low-Light Vision (Elf)', 'PZO1112', 'Low-Light Vision'],
    ['Low-Light Vision (Suli)', 'PZO1112', 'Low-Light Vision'],
    ['Low-Light Vision (Merfolk)', 'PZO1112', 'Low-Light Vision'],
    ['Day Raider', 'PZO1112', 'Low-Light Vision'],
    ['Surface Sprinter', 'PZO1112', 'Low-Light Vision'],
    ['Powerful Bite', 'PZO1112', 'Natural Attacks'],
    ['Poison Minion (Half-Orc)', 'PZO1112', 'Poison'],
    ['Poison Minion (Gnome)', 'PZO1112', 'Poison'],
    ['Light Blindness (Sahuagin)', 'PZO1112', 'Light Blindness'],
    ['Energy Strike (Cold)', 'PZO1112', 'Resistance'],
    ['Aphorite Resistances', 'PZO1112', 'Resistance'],
    ['Stone in the Blood', 'PZO1112', 'Fast Healing'],
    ['Throwback', 'PZO1112', 'Amphibious'],
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
  // Rules the bodies depend on: the APG alchemist bombs and oracle flame
  // mystery, Occult Adventures' psychic spells and Bestiary 5's psychic
  // magic, Horror Adventures' sanity rules, the First World creature
  // template and the APG alchemist extracts.
  for (const [name, book] of [
    ['Pyromaniac', 'PZO1115'],
    ['Psychic Defense', 'PZO1132'],
    ['Psychic Defense', 'PZO1133'],
    ['Inured', 'PZO1135'],
    ['First World Gnomes', 'PZO9298'],
    ['Experimental Body: Fey-Touched', 'PZO1115'],
  ] as const)
    expect(candidate(name).requiredNotices, name).toContain(book);
  expect(
    candidate('Pyromaniac')
      .inheritedRuleNotices.filter((notice) =>
        /alchemist class and its bombs|oracle class/.test(notice.rule),
      )
      .map((notice) => notice.book),
  ).toEqual(['PZO1115', 'PZO1115']);
  // Unchained action-cost metadata anywhere in the bound closure requires
  // the held PZO1131.
  const unchained = [...new Set([...unchainedOwn, ...unchainedBound])].sort();
  expect(unchained).toHaveLength(25);
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
    'Dragon Slayer',
    'Self-Made Fate',
    'Throwback',
    'Monstrous Humanoid (Adaro)',
  ])
    expect(
      candidate(name).inheritedRuleUnresolvedOrigins.join(' '),
      name,
    ).toContain('Creature type and subtype rules');
  // Rejected rows and PCGen leads don't add books: the Inner Sea Races
  // oread rows leave Languages (Oread) on its race's books, the Bestiary
  // sahuagin row leaves Speak with Sharks on Blood of the Sea, and Pyromaniac
  // follows its ARG row with the earlier APG row as a lead.
  expect(
    candidate('Languages (Oread)').rejectedRootComparisonEvidence,
  ).toHaveLength(2);
  expect(
    candidate('Speak with Sharks (Sahuagin)').requiredNotices,
  ).not.toContain('PZO1112');
  expect(candidate('Pyromaniac').comparison?.book).toBe('PZO1121');
  expect(
    candidate('Pyromaniac').additionalComparisonLeads.map((row) => row.book),
  ).toEqual(['PZO1115']);
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
    'pf1-content/UvWpHqJHIyUkValD': ['Base Statistics'], // Paraheen Dwarves
    'pf1-content/W199gG02chF53jD4': ['Base Statistics'], // Mute-Born (Sorrow May)
    'pf1-content/W84vzbaWfDxNW2hr': ['Base Statistics'], // Bleachlings
    'pf1-content/Wi9RMrZnkVkKMKNF': ['Base Statistics'], // First World Gnomes
  });
  // Pyromaniac replaces Gnome Magic and Illusion Resistance; Poison Minion
  // (Gnome) also Defensive Training; the curated heritage lines resolve
  // "Base Statistics" to their race's ability score trait.
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

it('pins all 100 keys, the complete bodies, checked bindings and literal PCGen and PRD evidence in the shared store', async () => {
  expect(review.candidates).toHaveLength(100);
  expect(new Set(review.candidates.map((row) => row.externalKey)).size).toBe(
    100,
  );
  expect(review.counts).toEqual({
    total: 100,
    admitted: 4,
    held: 73,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 23,
    excludedFolders: 13,
    excludedRaceBuilder: 10,
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
  expect(assessedTraits.filter((row) => row.prdComparison)).toHaveLength(19);
  expect(
    assessedTraits
      .filter((row) => row.prdComparison && !row.prdComparison.textMatches)
      .map((row) => row.name)
      .sort(),
  ).toEqual([
    '+2 to One Ability Score (Half-Orc)',
    "Cat's Luck",
    'Intimidating',
    'Languages (Oread)',
  ]);
  // Cat's Luck's "attempts" where the PRD reads "makes": recorded, not
  // resolved.
  expect(candidate("Cat's Luck").prdComparison?.wordDifferences).toEqual([
    { pinned: 'attempts', prd: 'makes' },
  ]);
  // Speak with Sharks' Bestiary row is a different body, kept as a rejected
  // row.
  expect(
    candidate(
      'Speak with Sharks (Sahuagin)',
    ).rejectedRootComparisonEvidence.map((row) => [row.book, row.line]),
  ).toEqual([['PZO1112', 1079]]);
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
      required: 33,
      checked: 33,
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
    // No record fails on an import gap; every record is held on its own
    // reasons.
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
    expect(held).toHaveLength(77 - UNRESOLVED_LINK_GAP.length - 4);
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
    const keen = candidate('Keen Senses (Elf)');
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
