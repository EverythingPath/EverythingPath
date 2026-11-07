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
} from '../fixtures/racial-traits-399/data';
import {
  racialTraitSheet,
  sheetDefinition,
} from '../fixtures/racial-traits-399/sheet';
import { raceAbilityTraitKey } from '../../scripts/catalog/racial-trait-rules';
import { materializePinnedTree, readPinned } from './pinned-sources';
import { bindSnapshotToCurrentNotices } from './batch-ownership';
import { assessWithUnclearedHolds } from './uncleared-holds';

const PLACEHOLDER =
  'Review required: replace this placeholder with readable rules text or structured outputs.';
const sha = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
// Standard traits whose Modifiers or Notes are race outputs the full import
// relocates or re-homes onto them (#719); a bounded import without the race
// lacks them.
const RELOCATED_FROM_RACE = [
  'pf1-content/eXhsF4CcvaCrLqLj', // Natural Hunter (Catfolk race changes)
  'pf1-content/eselzEcuEzC858lz', // Nocturnal (Syrinx) (Syrinx race notes)
  'pf1-content/f14x9PM3WRGXOJrF', // Constructed (Android race notes)
  'pf1-content/f2KIBwlRL87kTqh5', // Enchantment Resistance (Gillman race notes)
  'pf1-content/fbORYANXcG7HfMbQ', // Unassuming Foliage (Vine Leshy race notes)
  'pf1-content/gEJBYigk4fJKGkyM', // Sneaky (Grindylow) (Grindylow race change)
  'pf1-content/gh1taO4CBM237eMu', // Scales (Reptoid race description output)
  'pf1-content/gwRHgXExczYgcJOA', // Skilled (Svirfneblin) (Svirfneblin race changes)
];
const BLOG = 'Paizo Blog: The Gauntlet Will Be Ours!';
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
  'pf1-content/eNSivYdOXqQpPe52', // Spell-Like Ability (Tiefling - Spitespawn)
  'pf1-content/em8BoW2q3oUV9CHk', // Detect Thoughts
  'pf1-content/ewhFVskXwNn3uVnI', // Toxic
  'pf1-content/fLfQPOGCnNhp6Q5A', // Spell-Like Ability (Tiefling - Foulspawn)
  'pf1-content/fzbXyGr9NouJx3Qx', // Verdant Burst
  'pf1-content/gDO7etqF3QCXKyWZ', // Spell-Like Ability (Tiefling - Hungerseed)
  'pf1-content/gxI2toeA7yXzTIxV', // Fey Magic (Dwarf)
  'pf1-content/hAY8Dqng9SA6sRpC', // Subtle Manipulator
];
const unchainedBound = [
  'pf1-content/eNSivYdOXqQpPe52', // Spell-Like Ability (Tiefling - Spitespawn)
  'pf1-content/em8BoW2q3oUV9CHk', // Detect Thoughts
  'pf1-content/emWoMvZJYkXOz6ot', // Light Sensitivity (Orc)
  'pf1-content/emgcgmgSjpuv1GHa', // Demon-Spawn (Pitborn)
  'pf1-content/f91ILsrKfkpL9uUG', // Moroi-Born (Svetocher)
  'pf1-content/fJekoMzjSbktf0X4', // Acute Darkvision
  'pf1-content/fLfQPOGCnNhp6Q5A', // Spell-Like Ability (Tiefling - Foulspawn)
  'pf1-content/g6M0a4JgcPgjdjJT', // Fey Resilience
  'pf1-content/gDO7etqF3QCXKyWZ', // Spell-Like Ability (Tiefling - Hungerseed)
  'pf1-content/gyvG87iDUG02oQmR', // Dread Gnomes
  'pf1-content/hAY8Dqng9SA6sRpC', // Subtle Manipulator
];

it('resolves the reviewed racial trait Modifiers through the public resolver', () => {
  // Demon-Spawn (Pitborn) and Moroi-Born (Svetocher) replace their race's
  // ability score trait: the race's line goes dormant and the curated heritage
  // line applies.
  for (const [name, race, lines] of [
    [
      'Demon-Spawn (Pitborn)',
      'pf1/nVjKDLZSRONzYm8f', // Tiefling: +2 Dex, +2 Int, -2 Cha
      [
        ['ability.str', 10, 12],
        ['ability.dex', 12, 10],
        ['ability.int', 12, 8],
        ['ability.cha', 8, 12],
      ],
    ],
    [
      'Moroi-Born (Svetocher)',
      'pf1/puKk997wHX3kIRkR', // Dhampir: +2 Dex, +2 Cha, -2 Con
      [
        ['ability.str', 10, 12],
        ['ability.dex', 12, 10],
        ['ability.con', 8, 8],
        ['ability.cha', 12, 12],
      ],
    ],
  ] as const) {
    const heritage = entry(name);
    expect(heritage.detail.raceKeys).toEqual([race]);
    const ability = raceAbilityTraitKey(race);
    expect(heritage.detail.replaces, name).toEqual([ability]);
    expect(heritage.detail.unresolvedReplacements ?? [], name).toEqual([]);
    const plain = identityRace(racialTraitSheet({}), race, [ability]);
    const taken = identityRace(
      racialTraitSheet({ traits: [heritage.externalKey] }),
      race,
      [ability],
    );
    for (const [target, before, after] of lines) {
      expect(total(plain, target), `${name} race ${target}`).toBe(before);
      expect(total(taken, target), `${name} ${target}`).toBe(after);
    }
  }
  expect(
    modifiers('Demon-Spawn (Pitborn)').map((row) => [
      row.target,
      row.bonusType,
      row.value,
    ]),
  ).toEqual([
    ['ability.str', 'racial', 2],
    ['ability.cha', 'racial', 2],
    ['ability.int', 'racial', -2],
  ]);
  // Situational bonuses apply only when their Situation is selected.
  for (const [name, target, base, label, value] of [
    ['Stubborn', 'save.will', 'save.will', 'enchantment (charm)', 2],
    ['Warden of Nature', 'ac.other', 'ac', 'aberrations', 2],
    ['Warden of Nature', 'attack.melee', 'attack', 'aberrations', 1],
    ['Defensive Training (Drow)', 'ac.other', 'ac', 'aberrations', 4],
    ['Nosophobia', 'save.fort', 'save.fort', 'disease', 4],
    ['Heart of the Snows', 'cmd', 'cmd', 'trip', 2],
    ['Heart of the Snows', 'save.fort', 'save.fort', 'cold climates', 2],
    ['Heart of the Snows', 'save.ref', 'saves', 'slipping', 2],
    ['Heart of the Snows', 'skill.acr', 'skill.acr', 'slippery', 2],
    ['Heart of the Snows', 'skill.clm', 'skill.clm', 'slippery', 2],
    ['Architectural Ingenuity', 'skill.crf', 'skill.crf', 'structures', 2],
    ['Architectural Ingenuity', 'skill.per', 'skill.per', 'structures', 2],
    ['Dimdweller (Dwarf)', 'skill.int', 'skill.int', 'concealment', 2],
    ['Dimdweller (Dwarf)', 'skill.per', 'skill.per', 'concealment', 2],
    ['Dimdweller (Elf)', 'skill.ste', 'skill.ste', 'concealment', 2],
    ['Junk Tinker', 'skill.han', 'skill.han', 'driving', 2],
    ['Junk Tinker', 'skill.umd', 'skill.umd', 'driving', 2],
    ['Junk Tinker', 'skill.crf', 'skill.crf', 'proper tools', 2],
    ['Terrain Chameleon', 'skill.ste', 'skill.ste', 'underwater', 4],
    ['Deathless Spirit', 'save.will', 'saves', 'energy drain', 2],
    ['Deathless Spirit', 'save.fort', 'saves', 'necromancy', 2],
    ['Shadowhunter (Gnome)', 'save.fort', 'saves', 'negative levels', 2],
    ['Shadowhunter (Human)', 'save.will', 'saves', 'negative levels', 2],
    [
      'Hag Racial Trait (Changeling - Sorrow May)',
      'save.will',
      'saves',
      'gaze',
      2,
    ],
  ] as const) {
    const index = indexOf(name, base, label);
    expect(resolved(name, target), `${name} ${target}`).toBe(0);
    expect(resolved(name, target, [index]), `${name} ${target}`).toBe(value);
  }
  // Shared Situations only where the body's condition matches exactly.
  for (const [name, shared, target, value] of [
    ['Nosophobia', 'poison', 'save.fort', 4],
    ['Deathless Spirit', 'death', 'save.will', 2],
    ['Deathless Spirit', 'negativeEnergy', 'save.ref', 2],
  ] as const) {
    const index = modifiers(name).findIndex(
      (row) => row.condition?.situation === shared,
    );
    expect(index, `${name} ${shared}`).toBeGreaterThanOrEqual(0);
    expect(resolved(name, target), name).toBe(0);
    expect(resolved(name, target, [index]), name).toBe(value);
  }
  // The published types: Nosophobia's, Terrain Chameleon's, Warden of
  // Nature's attack and Shadowhunter's save bonuses are untyped.
  for (const [name, target, type] of [
    ['Nosophobia', 'save.fort', 'untyped'],
    ['Terrain Chameleon', 'skill.ste', 'untyped'],
    ['Warden of Nature', 'attack', 'untyped'],
    ['Warden of Nature', 'ac', 'dodge'],
    ['Defensive Training (Drow)', 'ac', 'dodge'],
    ['Shadowhunter (Gnome)', 'saves', 'untyped'],
    ['Stubborn', 'save.will', 'racial'],
  ] as const)
    expect(
      modifiers(name).find((row) => row.target === target)?.bonusType,
      `${name} ${target}`,
    ).toBe(type);
  // Re-homed race outputs: Nocturnal (Syrinx), Unassuming Foliage and the
  // Reptoid's natural armor on Scales.
  expect(entry('Nocturnal (Syrinx)').modifiers).toEqual(
    ['skill.per', 'skill.ste'].map((target) => ({
      target,
      bonusType: 'racial',
      value: 2,
      condition: { situation: { local: 'at night' } },
    })),
  );
  expect(entry('Unassuming Foliage').modifiers).toEqual([
    {
      target: 'skill.ste',
      bonusType: 'racial',
      value: 4,
      condition: { situation: 'forests' },
    },
  ]);
  expect(
    modifiers('Scales').map((row) => [row.target, row.bonusType, row.value]),
  ).toEqual([['ac.natural', 'naturalArmor', 1]]);
  // Racial bonuses from distinct Sources stack (PRD; character-sheet.ts):
  // Natural Hunter's and Dimdweller's +2 racial Stealth give +4 together
  // when Dimdweller's Situation is selected.
  const stealth = [
    ...modifiers('Natural Hunter'),
    ...modifiers('Dimdweller (Elf)'),
  ].filter((row) => row.target === 'skill.ste');
  const dim = stealth.findIndex((row) => row.condition?.situation);
  const scope = stealth[dim]?.condition?.situation;
  if (!scope || typeof scope === 'string' || !('local' in scope))
    throw new Error('Expected a local Situation');
  expect(resolveSheet(stealth, { situations: [] })['skill.ste'].total).toBe(2);
  expect(
    resolveSheet(stealth, {
      situations: [
        { local: scope.local, sheetEntryId: stealth[dim]!.sheetEntryId },
      ],
    })['skill.ste'].total,
  ).toBe(4);
  // Imported changes keep mapping; nothing is curated a second time.
  for (const [name, target, value] of [
    ['Natural Hunter', 'skill.per', 2],
    ['Natural Hunter', 'skill.ste', 2],
    ['Natural Hunter', 'skill.sur', 2],
    ['City Scavenger', 'skill.per', 2],
    ['City Scavenger', 'skill.sur', 2],
    ['Vestigial Wings', 'skill.fly', 4],
    ['Architectural Ingenuity', 'skill.ken', 2],
    ['Skilled (Aasimar - Lawbringers)', 'skill.int', 2],
    ['Skilled (Aasimar - Lawbringers)', 'skill.sen', 2],
    ['Ability Modifiers (Changeling - Slag May)', 'ability.str', 2],
    ['Ability Modifiers (Changeling - Slag May)', 'ability.cha', 2],
    ['Ability Modifiers (Changeling - Slag May)', 'ability.con', -2],
    ['Sneaky (Grindylow)', 'skill.ste', 4],
    ['Skilled (Svirfneblin)', 'skill.ste', 2],
    ['Skilled (Svirfneblin)', 'skill.per', 2],
  ] as const)
    expect(resolved(name, target), `${name} ${target}`).toBe(value);
  // Standard traits of #719 races, types, languages, senses, speeds, racial
  // subtypes and rules the sheet cannot model stay without reviewed
  // Modifiers.
  for (const name of [
    'Languages (Human)',
    'Light Sensitivity (Orc)',
    'Poison Use (Drow)',
    'Languages (Wayang)',
    'Languages (Nagaji)',
    'Languages (Triaxian)',
    'Languages (Reptoid)',
    'Languages (Vine Leshy)',
    'Languages (Drow)',
    'Languages (Kuru)',
    'Slow Speed (Monkey Goblin)',
    'Normal Speed (Hobgoblin)',
    'Sprinter (Catfolk)',
    'Fiendish Sprinter',
    'Strong Limbs',
    'Goblinoid (Hobgoblin)',
    'Darkvision (Being of Ib)',
    'Acute Darkvision',
    'Deep Gillman',
    'Detect Thoughts',
    'Toxic',
    'Swarming',
    'Verdant Burst',
    'Hatred (Strix)',
    'Hag Racial Trait (Changeling - Into the Wind)',
    '+2 to Strength, Dexterity, or Constitution',
    'Mostly Human (Undine)',
    'Pass for Human',
    'Titled',
    'Fey Resilience',
    'Expanded Oddities',
    'Mist Affinity (Undine - Mistsoul)',
    'Powerful Presence',
    'Wanderer',
    'Fey Magic (Dwarf)',
    'Weapon Familiarity (Half-Elf)',
    'Subtle Manipulator',
    'Jungle Half-Orcs (Rainkin)',
    'Dread Gnomes',
    'Gutter Rat',
    'Spell-Like Ability (Tiefling - Spitespawn)',
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
    ['Shadowhunter (Gnome)', 'rangedWeapon'],
    ['Shadowhunter (Human)', 'rangedWeapon'],
    ['Junk Tinker', 'skill.crf', '+[[2]] Racial bonus on driving checks.'],
    ['Weapon Familiarity (Half-Elf)', 'landSpeed'],
    ['Hatred (Strix)', 'attack'],
    ['Skilled (Svirfneblin)', 'skill.ste'],
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
    // Expanded Oddities' d20 oddity table is over 4096 characters, so its
    // body Note is split at a line boundary.
    expect(parts, row.name).toHaveLength(
      row.name === 'Expanded Oddities' ? 2 : 1,
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
  expect(required).toBe(53);
  // Notes the Foundry data put on unrelated statistics are entry-level.
  for (const name of [
    'Fiendish Sprinter',
    'Sprinter (Catfolk)',
    'Poison Use (Drow)',
    'Deep Gillman',
    'Fey Resilience',
  ])
    expect(
      entry(name)
        .situationalNotes?.filter((note) => note.target)
        .map((note) => note.target),
      name,
    ).toEqual([]);
  for (const [name, targets] of [
    ['Light Sensitivity (Orc)', ['attack', 'skill.per']],
    ['Swarming', ['attack']],
    ['City Scavenger', ['skill.sur']],
    ['Stubborn', ['save.will']],
    ['Heart of the Snows', ['save.fort']],
    ['Shadowhunter (Gnome)', ['attack']],
  ] as const)
    expect(
      entry(name)
        .situationalNotes?.filter((note) => note.target)
        .map((note) => note.target)
        .sort(),
      name,
    ).toEqual(targets);
  // The Notes read Foundry enrichers as text: Fiendish Sprinter's speed
  // bonus and the Orc's dazzled condition.
  expect(
    (entry('Fiendish Sprinter').situationalNotes ?? [])
      .map((note) => note.text)
      .join(' '),
  ).toContain('10-foot racial bonus');
  expect(
    (entry('Light Sensitivity (Orc)').situationalNotes ?? [])
      .map((note) => note.text)
      .join(' '),
  ).toContain('Orcs are dazzled');
  // Every record lists its outstanding calculations, never as a hold.
  for (const row of assessedTraits) {
    expect(
      row.mechanicsReview.outstandingCalculations.length,
      row.name,
    ).toBeGreaterThan(0);
    for (const text of row.mechanicsReview.outstandingCalculations)
      expect(row.holdIds.join(' '), row.name).not.toContain(text);
  }
  // Discrepancies the batch records rather than fixes.
  for (const name of [
    'Hatred (Strix)',
    'Toxic',
    'Subtle Manipulator',
    'Weapon Familiarity (Half-Elf)',
  ])
    expect(
      candidate(name).mechanicsReview.sourceDiscrepancies.join(' '),
      name,
    ).toMatch(/listed for review/i);
  for (const name of ['Junk Tinker', 'Skilled (Svirfneblin)'])
    expect(
      candidate(name).mechanicsReview.outstandingCalculations.join(' '),
      name,
    ).toMatch(/outstanding/i);
  // No record of this batch grants a weapon proficiency.
  for (const row of assessedTraits) {
    expect(row.mechanicsReview.proficiencyReview.grants, row.name).toEqual([]);
    expect(entry(row.externalKey).proficiencies ?? [], row.name).toEqual([]);
  }
});

it('records the race, alternate-trait, monster-ability and Unchained notice dependencies and enforces every hold', () => {
  const held = new Map(heldNotices.map((row) => [row.id, row.notices]));
  const holdId = (book: string) =>
    book === BLOG
      ? 'racial-traits-399-notice-primitive-human-blog-complete-chain'
      : `racial-traits-399-notice-${book}-complete-chain`;
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
      `racial-traits-399-whole-content-${row.externalKey.split('/')[1]}`,
    ]);
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices.filter((book) => book !== 'PZO1110').map(holdId),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  expect(
    assessedTraits.filter((row) => row.racialTraitKind === 'alt'),
  ).toHaveLength(29);
  // Universal monster rules the bodies grant or name take the earliest book
  // their pinned Universal Monster Rules journal page lists.
  for (const [name, book, page] of [
    ['Acute Darkvision', 'PZO1127', 'Darkvision'],
    ['Darkvision (Being of Ib)', 'PZO1127', 'Darkvision'],
    ['Deep Gillman', 'PZO1127', 'Darkvision'],
    ['Deep Gillman', 'PZO1112', 'Resistance'],
    ['Deathless Spirit', 'PZO1112', 'Resistance'],
    ['Light Sensitivity (Orc)', 'PZO1112', 'Light Sensitivity'],
    ['Shadowhunter (Gnome)', 'PZO1112', 'Incorporeal'],
    ['Shadowhunter (Human)', 'PZO1112', 'Incorporeal'],
    ['Fey Resilience', 'PZO1112', 'Damage Reduction'],
    ['Expanded Oddities', 'PZO1112', 'Natural Attacks'],
    ['Hag Racial Trait (Changeling - Sorrow May)', 'PZO1112', 'Gaze'],
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
  // Rules the bodies cite or depend on: Ultimate Combat's driving checks,
  // the APG dreamspun bloodline and memory lapse, the ARG fiendish
  // alternates, the APG Heart of the Streets and the blog source.
  for (const [name, book] of [
    ['Junk Tinker', 'PZO1118'],
    ['Mist Affinity (Undine - Mistsoul)', 'PZO1115'],
    ['Subtle Manipulator', 'PZO1115'],
    ['Pass for Human', 'PZO1121'],
    ['Gutter Rat', 'PZO1115'],
    ['+2 to Strength, Dexterity, or Constitution', BLOG],
  ] as const)
    expect(candidate(name).requiredNotices, name).toContain(book);
  expect(
    candidate('+2 to Strength, Dexterity, or Constitution').requiredNotices,
  ).toEqual([BLOG, 'PZO1110']);
  // Unchained action-cost metadata anywhere in the bound closure requires
  // the held PZO1131.
  const unchained = [...new Set([...unchainedOwn, ...unchainedBound])].sort();
  expect(unchained).toHaveLength(14);
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
    'Goblinoid (Hobgoblin)',
    'Constructed',
    'Mostly Human (Undine)',
    'Pass for Human',
    'Warden of Nature',
    'Defensive Training (Drow)',
  ])
    expect(
      candidate(name).inheritedRuleUnresolvedOrigins.join(' '),
      name,
    ).toContain('Creature type and subtype rules');
  // Third-party, blog and untraced origins stay named holds.
  expect(
    candidate('Detect Thoughts').inheritedRuleUnresolvedOrigins.join(' '),
  ).toContain('DYN0032-E');
  expect(
    candidate(
      '+2 to Strength, Dexterity, or Constitution',
    ).inheritedRuleUnresolvedOrigins.join(' '),
  ).toContain(BLOG);
  expect(
    candidate('Junk Tinker').inheritedRuleUnresolvedOrigins.join(' '),
  ).toContain('fragile');
  // Rejected rows and PCGen leads don't add books: the Tian Xia language
  // rows are rejected, and the heritage parts' parent rows too.
  // (The record cites Dragon Empires Gazetteer itself, so PZO9240 is required
  // on its own account, not the rejected row's.)
  for (const row of candidate('Languages (Wayang)')
    .rejectedRootComparisonEvidence)
    expect(row.book).toBeNull();
  expect(
    candidate('Languages (Wayang)').rejectedRootComparisonEvidence.map(
      (row) => row.line,
    ),
  ).toEqual([165, 163]);
  for (const name of [
    'Spell-Like Ability (Tiefling - Spitespawn)',
    'Spell-Like Ability (Tiefling - Foulspawn)',
    'Spell-Like Ability (Tiefling - Hungerseed)',
  ])
    expect(
      candidate(name).rejectedRootComparisonEvidence.map((row) => row.line),
      name,
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
    'pf1-content/erHe11Qn4judzeI1': ['Languages', 'Subtype', 'Type'], // Mostly Human (Undine)
    'pf1-content/euX1ucchOBHkK62k': ['Feather Step Spell-Like Ability'], // Titled
    'pf1-content/fscyXaZvorGwGprq': ['Mist Affinity (Undine - Mistsoul)'], // Mist Affinity (Undine - Mistsoul)
    'pf1-content/g2iIRBrSeUhIkDvu': ['Languages', 'Subtype', 'Type'], // Pass for Human
    'pf1-content/gyvG87iDUG02oQmR': ['Base Statistics'], // Dread Gnomes
    'pf1-content/h1rqC3aTXHfUTOQl': ['Base Statistics'], // Gutter Rat
  });
  // Defensive Training (Drow) replaces three drow traits, Architectural
  // Ingenuity and Strong Limbs two each; the curated heritage lines resolve
  // "Base Statistics" to the race's ability score trait.
  expect(entry('Defensive Training (Drow)').detail.replaces).toHaveLength(3);
  expect(entry('Architectural Ingenuity').detail.replaces).toHaveLength(2);
  expect(entry('Strong Limbs').detail.replaces).toHaveLength(2);
  expect(entry('Subtle Manipulator').detail.replaces).toEqual([
    'pf1-content/iulHWSMNp9TABDDU',
  ]);
  for (const name of ['Demon-Spawn (Pitborn)', 'Moroi-Born (Svetocher)'])
    expect(entry(name).detail.unresolvedReplacements ?? [], name).toEqual([]);
});

it('pins all 100 keys, the complete bodies, checked bindings and literal PCGen and PRD evidence in the shared store', async () => {
  expect(review.candidates).toHaveLength(100);
  expect(new Set(review.candidates.map((row) => row.externalKey)).size).toBe(
    100,
  );
  expect(review.counts).toEqual({
    total: 100,
    admitted: 0,
    held: 71,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 29,
    excludedFolders: 12,
    excludedRaceBuilder: 17,
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
        reviewedOn: '2026-10-21',
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
    expect(entry(row.externalKey).sources).toEqual(
      row.citedSources.filter((source) => source.book !== BLOG),
    );
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
  expect(assessedTraits.filter((row) => row.prdComparison)).toHaveLength(21);
  expect(
    assessedTraits
      .filter((row) => row.prdComparison && !row.prdComparison.textMatches)
      .map((row) => row.name)
      .sort(),
  ).toEqual([
    'Dread Gnomes',
    'Gutter Rat',
    'Languages (Drow)',
    'Languages (Human)',
    'Stubborn',
    'Subtle Manipulator',
    'Warden of Nature',
  ]);
  // Skilled (Aasimar - Lawbringers)'s parent row is a rejected row.
  expect(
    candidate(
      'Skilled (Aasimar - Lawbringers)',
    ).rejectedRootComparisonEvidence.map((row) => [row.book, row.line]),
  ).toEqual([[null, 22]]);
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
    expect(
      artifact.curation.stale.map((record) => [
        record.externalKey,
        record.target,
      ]),
    ).toEqual([['pf1-content/gwRHgXExczYgcJOA', 'skill.ste']]);
    expect(artifact.curation.summary).toMatchObject({
      required: 52,
      checked: 52,
      missing: 0,
      descriptions: { candidates: 71, checked: 71 },
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
    // #328 S4-A compared Languages (Human) and keeps it held (fix round 1):
    // its ethnic-language sentences have no permitted comparison. The batch
    // admits nothing, with or without the owner's notice clearances.
    const admittedKeys = new Set(admittedTraits.map((row) => row.externalKey));
    expect(admittedKeys.size).toBe(0);
    expect(gate.admitted.filter((row) => ours.has(row.externalKey))).toEqual(
      [],
    );
    const committed = assessCatalogAdmission({
      artifact: authoritative,
      ...reviewedAdmission,
    });
    expect(
      committed.admitted.filter((row) => ours.has(row.externalKey)),
    ).toEqual([]);
    const languages = candidate('pf1-content/eNIYJNbM6UL7OdyE');
    expect(languages).toMatchObject({
      disposition: 'held',
      assessmentStatus: 'unresolved',
      holdIds: ['racial-traits-399-whole-content-eNIYJNbM6UL7OdyE'],
    });
    expect(languages.rationale).toContain('and their ethnic language');
    expect(languages.rationale).toContain('Taldane');
    expect(
      committed.held.find((row) => row.externalKey === languages.externalKey)
        ?.reason,
    ).toBe(languages.rationale);
    for (const row of gate.held.filter((row) =>
      admittedKeys.has(row.externalKey),
    ))
      expect(row.reason, row.name).toMatch(
        /Notice holds|Missing or unreviewed required notices/,
      );
    // No record fails admission: every one is held on its own reasons.
    expect(gate.failures.filter((row) => ours.has(row.externalKey))).toEqual(
      [],
    );
    const held = gate.held.filter(
      (row) => ours.has(row.externalKey) && !admittedKeys.has(row.externalKey),
    );
    expect(held).toHaveLength(71);
    // Detect Thoughts (Green Martian) is held on the source-matched Dynamite
    // comics hold (known-notice-holds.json), as #388 Fearless and #393
    // Multi-Armed are; every other record on its own whole-content hold.
    for (const row of held)
      if (row.externalKey === 'pf1-content/em8BoW2q3oUV9CHk')
        expect(row.reason, row.name).toMatch(/^Known notice\/evidence hold/);
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
    const keen = candidate('Languages (Human)');
    expect(keen.requiredNotices).toEqual(['PZO9280', 'PZO1121', 'PZO1110']);
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
