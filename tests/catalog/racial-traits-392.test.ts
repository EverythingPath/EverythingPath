// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
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
} from '../fixtures/racial-traits-392/data';
import {
  previewEntry,
  racialTraitSheet,
  sheetDefinition,
} from '../fixtures/racial-traits-392/sheet';
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
  'pf1-content/IQ5vHUbNbGqVaVV5', // Defensive Training (Gnome)
  'pf1-content/IihEWtYnIufBuARs', // Ward against Corruption
  'pf1-content/Jnw41wF4ln2vH7d8', // Svirfneblin Magic (Svirfneblin)
  'pf1-content/JtJKg8vV58UJ6m1m', // Hatred (Dwarf)
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
  'pf1-content/HLRPBh2KsFeAZ80f', // Lightbringer
  'pf1-content/HSEQTjNZ9ZPnhZUZ', // Beast Talker
  'pf1-content/IFQQ7tPmJJM0ADpU', // Fey Magic (Half-Orc)
  'pf1-content/IQMSioY3z5n7YnvD', // Hydrated Vitality
  'pf1-content/JRAuStEQiJCdtUwp', // Spell-Like Abilities (Fetchling - Plane Shift)
  'pf1-content/JYBBbQdb096At3uS', // Body Thorns
  'pf1-content/JdmRjdRfq9S16pmP', // Change Shape (Skinwalker - Seascarred)
  'pf1-content/Jnw41wF4ln2vH7d8', // Svirfneblin Magic
  'pf1-content/K0OwTmAv3gNkTc8B', // Change Shape (Skinwalker - Bloodmarked)
  'pf1-content/K7YBN0QKQeWCJZ9K', // Breeze-Kissed
  'pf1-content/K8MPTqH6wXv1qsGS', // Poison Minion (Human)
];
const unchainedBound = [
  'pf1-content/HLRPBh2KsFeAZ80f', // light
  'pf1-content/Hi2xxPj8RqlQ5NYn', // Tripping Tentacles (Tentacle Sense)
  'pf1-content/Hp26XuRpA7QNUOZO', // Ironsoul (unerring weapon)
  'pf1-content/IFQQ7tPmJJM0ADpU', // Orc Ferocity
  'pf1-content/IJRr9hW0I3JvpP43', // Fangs (Spell-Like Ability (Dhampir))
  'pf1-content/JLGJMVewolF9XNVW', // Rakshasa-Spawn (through the tiefling's traits)
  'pf1-content/JRAuStEQiJCdtUwp', // its three linked spells
  'pf1-content/JYBBbQdb096At3uS', // Spell-Like Abilities (Gathlain), armor spikes
  'pf1-content/JdUecbyHLbK4aqT3', // Amphibious (Spell-Like Ability (Undine))
  'pf1-content/JdmRjdRfq9S16pmP', // Change Shape (Skinwalker)
  'pf1-content/JtvsIm1JAxjAL2YL', // Ancient-Born (daylight, through Light Sensitivity)
  'pf1-content/K0OwTmAv3gNkTc8B', // Change Shape (Skinwalker)
  'pf1-content/KEXruHT9nIp41wT1', // Peri-Blooded (through the aasimar's traits)
];

it('resolves the reviewed racial trait Modifiers through the public resolver', () => {
  // The three heritages curated with their ability lines replace their
  // race's ability score trait: it goes dormant, and their own adjustments
  // count.
  for (const [name, race, before, after] of [
    [
      'Ironsoul (Metal Oread)',
      'Oread',
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
      { 'ability.wis': 12, 'ability.cha': 12 },
      { 'ability.int': 12, 'ability.cha': 12, 'ability.wis': 10 },
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
  // The racial subtype and the flavor heritage carry no Modifier.
  for (const name of ['Elf-Raised', 'Mountain Half-Orcs (Cragkin)'])
    expect(entry(name).modifiers, name).toEqual([]);
  expect(entry('Elf-Raised').detail.unresolvedReplacements).toEqual([
    'Base Statistics',
  ]);
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
  // One Situation covers each multi-statistic rule.
  for (const [name, count] of [
    ['Craftsman', 2],
    ['Tribalistic', 2],
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
  // Seasinger's untyped +2 on every Perform skill is replaced by 0 (reviewed
  // change replacement); only the Perform (sing) Situation gives +2 racial.
  expect(
    modifiers('Seasinger').map((row) => [row.target, row.bonusType, row.value]),
  ).toEqual([
    ['skill.prf', 'untyped', 0],
    ['spellDC', 'racial', 1],
    ['skill.prf', 'racial', 2],
  ]);
  // Svirfneblin Magic's illusion DC is the race's re-homed output.
  expect(modifiers('Svirfneblin Magic (Svirfneblin)')).toMatchObject([
    { target: 'spellDC', value: 1, condition: { school: 'illusion' } },
  ]);
  // The Snow May ability record replaces the changeling's own ability trait
  // by name: it goes dormant and the untyped line counts.
  const snow = entry('Ability Modifiers (Changeling - Snow May)');
  const changelingAbilities = 'pf1-content/PxjUu8YOjXmWdagL';
  expect(snow.detail.replaces).toEqual([changelingAbilities]);
  const changeling = snow.detail.raceKeys?.[0];
  if (!changeling) throw new Error('Snow May has no race');
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
  // The subrace skill records replace the tiefling's Skilled trait by name:
  // its +2 Bluff and Stealth go dormant.
  const tieflingSkilled = 'pf1-content/AKuDJrwJUZULsJcS';
  const beastbrood = entry('Skilled (Tiefling - Beastbrood)');
  expect(beastbrood.detail.replaces).toEqual([tieflingSkilled]);
  const tiefling = beastbrood.detail.raceKeys?.[0];
  if (!tiefling) throw new Error('Beastbrood has no race');
  const skills = (traits: string[]) => {
    const sheet = identityRace(racialTraitSheet({ traits }), tiefling, [
      tieflingSkilled,
    ]);
    return ['skill.blf', 'skill.ste', 'skill.dis', 'skill.sen'].map((target) =>
      total(sheet, target),
    );
  };
  expect(skills([])).toEqual([2, 2, 0, 0]);
  expect(skills([beastbrood.externalKey])).toEqual([0, 0, 2, 2]);
  // Racial bonuses from distinct Sources stack: Halfling Luck (+1) and #387's
  // Irrepressible (+2 against dominate and possession) give +3 on such a save.
  const irrepressible = JSON.parse(
    readFileSync('tests/fixtures/racial-traits-387/preview.json', 'utf8'),
  ).entries.find(
    (row: { externalKey: string }) =>
      row.externalKey === 'pf1-content/1AmHSWuqAMrEBChf',
  );
  const luck = entry('Halfling Luck');
  const dominated = resolveSheet(
    [
      ...modifiers('Halfling Luck'),
      ...irrepressible.modifiers.map((raw: Record<string, unknown>) => ({
        ...raw,
        sheetEntryId: irrepressible.externalKey,
        catalogEntryId: irrepressible.externalKey,
        source: irrepressible.externalKey,
        entryName: irrepressible.name,
        builtIn: false,
      })),
    ],
    {
      situations: [
        {
          local: 'against dominate and possession effects',
          sheetEntryId: irrepressible.externalKey,
        },
      ],
    },
  );
  expect(luck.modifiers).toEqual([
    { target: 'saves', bonusType: 'racial', value: 1 },
  ]);
  expect(dominated['save.will'].total).toBe(3);
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
  expect(required).toBe(33);
  // Repeated or misplaced notes are the explicit covered/no-output records.
  expect(
    assessedTraits.flatMap((row) =>
      row.mechanicsReview.curationRecords
        .filter((record) => !record.outputs.length)
        .map((record) => `${row.name} ${record.target}`),
    ),
  ).toEqual([
    'Construct ac',
    'Hag Racial Trait (Changeling - Sea Lungs) conChecks',
  ]);
  // Foundry conChecks (Constitution checks) is never put on concentration.
  expect(entry('Hag Racial Trait (Changeling - Sea Lungs)').modifiers).toEqual(
    [],
  );
  // Race-covered trait notes have no required record of their own.
  for (const name of [
    'Defensive Training (Gnome)',
    'Hatred (Dwarf)',
    'Ward against Corruption',
  ])
    expect(candidate(name).mechanicsReview.curationRecords, name).toHaveLength(
      1,
    );
  // Notes the Foundry data put on unrelated statistics are entry-level.
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
  const grants = {
    'Weapon Familiarity (Orc)': ['Falchion', 'Greataxe'],
    'Spirit of the Waters': ['Longspear', 'Net', 'Trident'],
    'Weapon Familiarity (Goblin)': ['Dogslicer', 'Horsechopper'],
    'Body Thorns': ['Armor Spikes'],
  } as Record<string, string[]>;
  for (const row of assessedTraits) {
    const expected = grants[row.name] ?? [];
    expect(
      [...row.mechanicsReview.proficiencyReview.grants].sort(),
      row.name,
    ).toEqual(expected);
    expect(
      (entry(row.name).proficiencies ?? []).map((row) =>
        'baseType' in row ? row.baseType : null,
      ),
      row.name,
    ).toEqual(expected);
  }
  // Skill rank grants are read as one rank per level.
  for (const name of ['Skilled (Half-Orc)', 'Imposter-Wary'])
    expect(entry(name).detail.bonusSkillRanksPerLevel, name).toBe(1);
  // Bonus feat grants are listed as outstanding, not curated.
  for (const name of ['Psychic Sensitivity', 'Psychic Attunement']) {
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
    `racial-traits-392-notice-${book}-complete-chain`;
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
      `racial-traits-392-whole-content-${row.externalKey.split('/')[1]}`,
    ]);
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices.filter((book) => book !== 'PZO1110').map(holdId),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  expect(
    assessedTraits.filter((row) => row.racialTraitKind === 'alt'),
  ).toHaveLength(35);
  // Sexual Dimorphism's folder binds no race: both pinned lashunta race
  // records' books are recorded and required.
  const dimorphism = candidate('Sexual Dimorphism');
  expect(entry('Sexual Dimorphism').detail.raceKeys).toEqual([]);
  expect(
    dimorphism.inheritedRuleNotices
      .filter((notice) => notice.location.includes('/packs/races/'))
      .map((notice) => notice.rule.split(' race')[0]),
  ).toEqual(['the Lashunta (Male)', 'the Lashunta (Female)']);
  // Shadowplay grants elves the fetchling's spell-like abilities: the
  // Fetchling race record's book is recorded.
  expect(
    candidate('Shadowplay').inheritedRuleNotices.some(
      (notice) =>
        notice.book === 'PZO9280' &&
        notice.location.includes('/packs/races/fetchling.'),
    ),
  ).toBe(true);
  // Universal monster rules the bodies grant take the earliest book their
  // pinned Universal Monster Rules journal page lists.
  for (const [name, book, page] of [
    ['Low-Light Vision (Half-Elf)', 'PZO1112', 'Low-Light Vision'],
    ['Telepathic Senses', 'PZO1127', 'Darkvision'],
    ['Telepathic Senses', 'PZO1112', 'Telepathy'],
    ['Natural Weapon (Rougarou)', 'PZO1112', 'Natural Attacks'],
    ['Fangs', 'PZO1112', 'Natural Attacks'],
    ['Celestial Resistance', 'PZO1112', 'Resistance'],
    ['Scaled Skin', 'PZO1112', 'Resistance'],
    ['Desert Delver', 'PZO1112', 'Resistance'],
    ['Exalted Resistance', 'PZO1112', 'Spell Resistance'],
    ['Spell Resistance (Drow Noble)', 'PZO1112', 'Spell Resistance'],
    ['Hydrated Vitality', 'PZO1112', 'Fast Healing'],
    ['Poison Minion (Human)', 'PZO1112', 'Poison'],
    ['Amphibious', 'PZO1112', 'Amphibious'],
    ['Beast Talker', 'PZO1112', 'Change Shape'],
    ['Change Shape (Skinwalker - Seascarred)', 'PZO1112', 'Ferocity'],
    ['Change Shape (Skinwalker - Bloodmarked)', 'PZO1112', 'Scent'],
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
  // Rules the bodies depend on: the steal maneuver, the Metal subdomain and
  // the stormborn bloodline (APG), the shaitan bloodline (Ultimate Magic),
  // thought components and Psychic Sensitivity (Occult Adventures), unerring
  // weapon (Ultimate Combat).
  for (const [name, book] of [
    ['Bullying', 'PZO1115'],
    ['Ironsoul (Metal Oread)', 'PZO1115'],
    ['Ironsoul (Metal Oread)', 'PZO1117'],
    ['Ironsoul (Metal Oread)', 'PZO1118'],
    ['Lightning Affinity (Sylph - Stormsoul)', 'PZO1115'],
    ['Telepathic Senses', 'PZO1132'],
    ['Psychic Sensitivity', 'PZO1132'],
    ['Psychic Attunement', 'PZO1132'],
  ] as const)
    expect(candidate(name).requiredNotices, name).toContain(book);
  // Unchained action-cost metadata anywhere in the bound closure requires
  // the held PZO1131.
  const unchained = [...new Set([...unchainedOwn, ...unchainedBound])].sort();
  expect(unchained).toHaveLength(18);
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
  // Creature types and sahkils have no pinned rules record: named
  // unresolved origins; so do the shadow descriptor and Psychic Virtuoso.
  for (const [name, text] of [
    ['Construct', 'Creature type and subtype rules'],
    ['Ratfolk', 'Creature type and subtype rules'],
    ['Amphibious', 'Creature type and subtype rules'],
    ['Ward against Corruption', 'Sahkils'],
    ['Shadowplay', 'shadow descriptor'],
    ['Psychic Attunement', 'Psychic Virtuoso'],
    ['Normal Speed (Undine)', 'languages paragraph'],
  ] as const)
    expect(
      candidate(name).inheritedRuleUnresolvedOrigins.join(' '),
      name,
    ).toContain(text);
  // Rejected rows and PCGen leads don't add books.
  expect(
    candidate('Limber').rejectedRootComparisonEvidence.map((row) => row.book),
  ).toEqual(['PZO9280']);
  expect(candidate('Limber').requiredNotices).toEqual([
    'PZO9280',
    'PZO1121',
    'PZO1120',
    'PZO1110',
  ]);
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
    // The header names traits it alters rather than replaces.
    'pf1-content/HSEQTjNZ9ZPnhZUZ': [
      'alters the change shape and spell-like ability racial traits',
    ],
    // No header and no parent trait of the same name (importer gap).
    'pf1-content/JhEI4m5iFNvOgm9H': ['Lightning Affinity (Sylph - Stormsoul)'],
    // The racial subtype keeps its race's ability score trait.
    'pf1-content/JAbeHqFork30yKAt': ['Base Statistics'], // Elf-Raised
  });
  // Orc Blood counts as human and orc through the reviewed rule.
  expect(entry('Orc Blood').countsAsRaces).toHaveLength(2);
});
it('pins all 100 keys, the complete bodies, checked bindings and literal PCGen and PRD evidence in the shared store', async () => {
  expect(review.candidates).toHaveLength(100);
  expect(new Set(review.candidates.map((row) => row.externalKey)).size).toBe(
    100,
  );
  expect(review.counts).toEqual({
    total: 100,
    admitted: 7,
    held: 68,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 25,
    excludedFolders: 14,
    excludedRaceBuilder: 11,
    recordLevel35Holds: 0,
  });
  for (const row of excludedRows) {
    const raw = upstreamRecord.parse(
      parse(await readPinned(row.source.repo, row.source.path)),
    );
    if (row.kind === 'folder')
      expect(raw._key, row.name).toBe(`!folders!${raw._id}`);
    // The Race Builder subtree's Movement folder is a folder record too.
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
  expect(assessedTraits.filter((row) => row.prdComparison)).toHaveLength(28);
  expect(
    assessedTraits
      .filter((row) => row.prdComparison && !row.prdComparison.textMatches)
      .map((row) => row.name)
      .sort(),
  ).toEqual([
    'Craftsman',
    'Defensive Training (Gnome)',
    'Elf-Raised',
    'Hatred (Dwarf)',
    'Languages (Elf)',
    'Normal Speed (Undine)',
    'Spell-Like Abilities (Fetchling - Plane Shift)',
    'Spirit of the Waters',
  ]);
  // Hatred (Dwarf) reads an untyped "+1 bonus" (the CRB wording) where the
  // PRD paragraph reads "+1 racial bonus"; the fetchling's caster level reads
  // "character level" where the PRD reads "total Hit Dice": recorded, not
  // resolved.
  expect(
    candidate('Hatred (Dwarf)').prdComparison?.wordDifferences,
  ).toContainEqual({ pinned: '', prd: 'racial' });
  expect(
    candidate('Spell-Like Abilities (Fetchling - Plane Shift)').prdComparison
      ?.wordDifferences,
  ).toContainEqual({ pinned: 'character level', prd: 'total Hit Dice' });
  // Normal Speed (Undine)'s pinned body is the languages paragraph.
  expect(
    candidate('Normal Speed (Undine)').prdComparison?.paragraphText,
  ).toContain('base speed of 30 feet');
  // Craftsman, Spirit of the Waters follow their APG rows' wording; the ARG
  // printings are leads whose book is cited and required.
  for (const name of ['Craftsman', 'Spirit of the Waters']) {
    expect(candidate(name).comparison?.book, name).toBe('PZO1115');
    expect(
      candidate(name).additionalComparisonLeads.map((row) => row.book),
      name,
    ).toEqual(['PZO1121']);
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
      required: 33,
      checked: 33,
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
    expect(held).toHaveLength(68);
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
    const dwarf = candidate('Slow and Steady (Dwarf)');
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
