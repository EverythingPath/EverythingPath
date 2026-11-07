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
} from '../fixtures/racial-traits-389/data';
import {
  previewEntry,
  racialTraitSheet,
  sheetDefinition,
} from '../fixtures/racial-traits-389/sheet';
import { materializePinnedTree, readPinned } from './pinned-sources';
import { bindSnapshotToCurrentNotices } from './batch-ownership';
import { assessWithUnclearedHolds } from './uncleared-holds';

const PLACEHOLDER =
  'Review required: replace this placeholder with readable rules text or structured outputs.';
const sha = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
// Two records share the name "Feral" (the half-orc racial subtype and the orc
// alternate), so a stable key also selects an entry.
const FERAL_ORC = 'pf1-content/A7bikGavod3dmWDl';
const FERAL_HALF_ORC = 'pf1-content/7JHnhD96PeWEnf7U';
// Standard traits whose Modifiers are race changes the full import relocates
// onto them (#719); a bounded import without the race lacks them.
const RELOCATED_FROM_RACE = ['pf1-content/7IMx5MBTrYTOhTnf'];
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
  'pf1-content/7KMw9IErP1W9vQsO', // Spell-Like Ability (Dhampir)
  'pf1-content/7cHKd5w3VKNTyFLW', // Repair Magic
  'pf1-content/7tA7QryetJUIsI9M', // Emissary
  'pf1-content/89ENmvsXsZYGFVBm', // Viscous Blood
  'pf1-content/8S5F3TatyTW9rRSB', // Alternate Spell-Like Ability (Ragebred)
  'pf1-content/8gIlEIGMp5PaAUpL', // Tenacious
  'pf1-content/8nCDInPZ48zvuu1D', // Poison Minion (wayang)
  'pf1-content/8vByVIUdiF70ApWv', // Stoneseer (Svirfneblin)
  'pf1-content/8vJZseDShMzcl6Oz', // Hag Magic (ISR)
  'pf1-content/93KXq6n1wiX0ifEy', // Spell-Like Ability (Shackleborn)
  'pf1-content/ACSn93JmJ1nTtpeY', // Acid Breath
];
const unchainedBound = [
  'pf1-content/7JHnhD96PeWEnf7U', // Feral (half-orc racial subtype)
  'pf1-content/7cHKd5w3VKNTyFLW',
  'pf1-content/86ckozGTUZvWb8dW', // Secretive
  'pf1-content/8Fcp5fwVESw51Dgm', // Stoic
  'pf1-content/8S3LbLY78NiCmXT8', // Lashvine
  'pf1-content/8S5F3TatyTW9rRSB',
  'pf1-content/8gIlEIGMp5PaAUpL',
  'pf1-content/8lSKScxOqbUF5X1H', // Drow-Descended
  'pf1-content/8nCDInPZ48zvuu1D',
  'pf1-content/8vByVIUdiF70ApWv',
  'pf1-content/901VteaGCjg0FTKQ', // Object of Desire
  'pf1-content/93KXq6n1wiX0ifEy',
  'pf1-content/ACSn93JmJ1nTtpeY',
];

it('resolves the reviewed racial trait Modifiers through the public resolver', () => {
  // Situational bonuses apply only when their Situation is selected.
  for (const [name, target, base, label, value] of [
    ['Deep Warrior', 'ac.other', 'ac', 'aberration', 2],
    ['Deep Warrior', 'cmb', 'cmb', 'grapple aberrations', 2],
    ['Soaring Agility', 'ac.other', 'ac', '20 feet below', 1],
    ['Serpent Affinity', 'casterLevel', 'casterLevel', 'Scalykind', 1],
    ["Creator's Legacy", 'casterLevel', 'casterLevel', 'Plant domain', 1],
    ['Round Ears', 'skill.dis', 'skill.dis', 'appear human', 4],
    ['Secretive', 'save.will', 'saves', 'divination', 2],
    ['Light against Darkness', 'attack.melee', 'attack', 'demon', 1],
    ['Light against Darkness', 'attack.ranged', 'attack', 'demon', 1],
    ['Stoic', 'save.will', 'saves', 'emotion', 2],
    ['Take to the Water', 'init', 'init', 'swimming', 2],
    ['Take to the Water', 'save.ref', 'save.ref', 'swimming', 2],
    ['Stoneseer (Svirfneblin)', 'casterLevel', 'casterLevel', 'earth', 1],
    ['Object of Desire', 'casterLevel', 'casterLevel', 'charm', 1],
    ['Sound Mimicry', 'skill.blf', 'skill.blf', 'mimic sounds', 4],
    ['Ancestral Grudge', 'attack.melee', 'attack', 'dwarf or elf', 1],
    ['Shadowhunter (Elf)', 'save.fort', 'saves', 'negative levels', 2],
    [FERAL_ORC, 'attack.melee', 'attack.melee', 'negative hit points', 1],
    [FERAL_ORC, 'damage.melee', 'damage.melee', 'negative hit points', 1],
    ['Knack with Poison', 'skill.crf', 'skill.crf', 'make poison', 2],
    ['Knack with Poison', 'save.fort', 'save.fort', 'accidentally', 4],
  ] as const) {
    const index = indexOf(name, base, label);
    expect(resolved(name, target), `${name} ${target}`).toBe(0);
    expect(resolved(name, target, [index]), `${name} ${target}`).toBe(value);
  }
  // A dodge bonus to AC is neither armor, shield nor natural armor.
  expect(resolved('Deep Warrior', 'ac.other', [0])).toBe(2);
  // One Situation covers both of Take to the Water's swimming bonuses, and
  // the orc's feral bonus covers attack and damage.
  expect(
    modifiers('Take to the Water')
      .filter((row) => row.condition?.situation)
      .map((row) => row.condition?.situation),
  ).toEqual([{ local: 'while swimming' }, { local: 'while swimming' }]);
  // Shared Situations only where the body's condition matches exactly; the
  // same type within one entry doesn't stack.
  for (const [name, shared, target, value] of [
    ['Secretive', 'enchantment', 'save.will', 2],
    ['Stoic', 'fear', 'save.will', 2],
    ['Fey Fortitude', 'death', 'save.fort', 2],
    ['Knack with Poison', 'poison', 'save.fort', 2],
  ] as const) {
    const index = modifiers(name).findIndex(
      (row) => row.condition?.situation === shared,
    );
    expect(index, `${name} ${shared}`).toBeGreaterThanOrEqual(0);
    expect(resolved(name, target, [index]), name).toBe(value);
    const all = modifiers(name).map((_, index) => index);
    expect(resolved(name, target, all), name).toBe(
      name === 'Knack with Poison' ? 4 : value,
    );
  }
  // Imported changes keep mapping; nothing is curated a second time.
  for (const [name, target, value] of [
    ['Scarred', 'ac.natural', 1],
    ['Armor (Merfolk)', 'ac.natural', 2],
    ['Shiftless', 'skill.blf', 2],
    ['Shiftless', 'skill.slt', 2],
    ['Vigilant Gaze', 'skill.per', 1],
    ['Vigilant Gaze', 'skill.sen', 1],
    ['Take to the Water', 'skill.swm', 8],
    ['Skilled (Tiefling)', 'skill.blf', 2],
    ['Skilled (Tiefling)', 'skill.ste', 2],
    ['Ability Score Modifiers (Gathlain)', 'ability.dex', 2],
    ['Ability Score Modifiers (Gathlain)', 'ability.cha', 2],
    ['Ability Score Modifiers (Gathlain)', 'ability.con', -2],
  ] as const)
    expect(resolved(name, target), `${name} ${target}`).toBe(value);
  for (const name of ['Scarred', 'Armor (Merfolk)'])
    expect(
      modifiers(name).map((row) => [row.target, row.bonusType]),
      name,
    ).toEqual([['ac.natural', 'naturalArmor']]);
  // The changeling heritages' ability records replace the changeling's own
  // ability trait by name: it goes dormant and their untyped lines count.
  const sorrow = entry('Ability Modifiers (Changeling - Sorrow May)');
  const virga = entry('Ability Modifiers (Changeling - Virga May)');
  const changelingAbilities = 'pf1-content/PxjUu8YOjXmWdagL';
  for (const heritage of [sorrow, virga])
    expect(heritage.detail.replaces, heritage.name).toEqual([
      changelingAbilities,
    ]);
  const changeling = sorrow.detail.raceKeys?.[0];
  if (!changeling) throw new Error('Sorrow May has no race');
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
  expect(scores([sorrow.externalKey])).toEqual({
    str: 10,
    dex: 10,
    con: 8,
    int: 12,
    wis: 12,
    cha: 10,
  });
  expect(scores([virga.externalKey])).toEqual({
    str: 10,
    dex: 10,
    con: 8,
    int: 10,
    wis: 12,
    cha: 12,
  });
  for (const heritage of [sorrow, virga])
    expect(
      heritage.modifiers.map((row) => row.bonusType),
      heritage.name,
    ).toEqual(['untyped', 'untyped', 'untyped']);
  // Round Ears replaces Keen Senses (Half-Elf): its imported +2 Perception
  // goes dormant while the alternate's Disguise bonus is a Situation.
  const ears = entry('Round Ears');
  const keen = previewEntry('Keen Senses (Half-Elf)');
  expect(ears.detail.replaces).toContain(keen.externalKey);
  const halfElf = ears.detail.raceKeys?.[0];
  if (!halfElf) throw new Error('Round Ears has no race');
  const plain = identityRace(racialTraitSheet({}), halfElf, [keen.externalKey]);
  const round = identityRace(
    racialTraitSheet({ traits: [ears.externalKey] }),
    halfElf,
    [keen.externalKey],
  );
  expect(total(plain, 'skill.per')).toBe(2);
  expect(total(round, 'skill.per')).toBe(0);
  expect(total(round, 'skill.dis')).toBe(0);
  // Spell DC and other schools are unaffected by the caster level Situations.
  for (const name of [
    'Serpent Affinity',
    "Creator's Legacy",
    'Stoneseer (Svirfneblin)',
    'Object of Desire',
  ])
    expect(resolved(name, 'spellDC', [0]), name).toBe(0);
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
    const texts = (entry(row.externalKey).situationalNotes ?? []).map(
      (note) => note.text,
    );
    for (const part of parts) expect(texts, row.name).toContain(part);
  }
  expect(required).toBe(32);
  // Repeated notes are the explicit covered/no-output records.
  expect(
    assessedTraits.flatMap((row) =>
      row.mechanicsReview.curationRecords
        .filter((record) => !record.outputs.length)
        .map((record) => `${row.name} ${record.target}`),
    ),
  ).toEqual([
    'Tenacious conChecks',
    'Take to the Water conChecks',
    'Shadowhunter (Elf) rangedWeapon',
  ]);
  // Foundry's conChecks (Constitution checks) never becomes concentration.
  for (const row of preview.entries) {
    expect(
      row.modifiers.some((modifier) => modifier.target === 'concentration'),
      row.name,
    ).toBe(false);
    expect(
      (row.situationalNotes ?? []).some(
        (note) => note.target === 'concentration',
      ),
      row.name,
    ).toBe(false);
  }
  // Notes the Foundry data put on unrelated statistics are entry-level.
  for (const name of [
    'Dragon-Scaled',
    'Energy Resistance (Undine)',
    'Stoic',
    'Take to the Water',
  ])
    expect(
      entry(name)
        .situationalNotes?.filter((note) => note.target)
        .map((note) => note.target),
      name,
    ).toEqual([]);
  for (const [name, targets] of [
    ['Emissary', ['skill.blf', 'skill.dip']],
    ['Silent Hunter', ['skill.ste']],
    ['Tenacious', ['save.fort', 'save.will']],
    ['Viscous Blood', ['skill.hea']],
    ['Shadowhunter (Elf)', ['attack']],
    ['Sound Mimicry', ['skill.blf']],
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
  for (const [name, grants] of [
    ['Lashvine', ['Whip', 'Scorpion Whip']],
    ['Drow-Trained', ['Hand Crossbow', 'Rapier', 'Shortsword']],
  ] as const) {
    expect(candidate(name).mechanicsReview.proficiencyReview.grants).toEqual(
      grants,
    );
    expect(
      (entry(name).proficiencies ?? []).map((row) =>
        'baseType' in row ? row.baseType : null,
      ),
      name,
    ).toEqual(expect.arrayContaining([...grants]));
  }
  for (const row of assessedTraits)
    if (!['Lashvine', 'Drow-Trained'].includes(row.name))
      expect(row.mechanicsReview.proficiencyReview.grants, row.name).toEqual(
        [],
      );
  // Bonus feat grants are listed as outstanding, not curated.
  for (const name of [
    "Shaman's Apprentice",
    'Human-Raised (Elf)',
    'Primitive Feat',
    'Adoptive Parentage (Weapon Focus)',
  ]) {
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
    book === 'Paizo Blog: The Gauntlet Will Be Ours!'
      ? 'racial-traits-389-notice-primitive-human-blog-complete-chain'
      : `racial-traits-389-notice-${book}-complete-chain`;
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
      `racial-traits-389-whole-content-${row.externalKey.split('/')[1]}`,
    ]);
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices.filter((book) => book !== 'PZO1110').map(holdId),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  expect(
    assessedTraits.filter((row) => row.racialTraitKind === 'alt'),
  ).toHaveLength(36);
  // Universal monster rules the bodies grant take the earliest book their
  // pinned Universal Monster Rules journal page lists.
  for (const [name, book, page] of [
    ['Darkvision (Duskwalker)', 'PZO1127', 'Darkvision'],
    ['Darkvision (Grippli)', 'PZO1127', 'Darkvision'],
    ['Darkvision (Trox)', 'PZO1127', 'Darkvision'],
    ['Darkvision (Dwarf)', 'PZO1127', 'Darkvision'],
    ['Low-Light Vision (Vine Leshy)', 'PZO1112', 'Low-Light Vision'],
    ['Low-Light Vision (Deep One Hybrid)', 'PZO1112', 'Low-Light Vision'],
    ['Vigilant Gaze', 'PZO1112', 'Low-Light Vision'],
    ['Scent', 'PZO1112', 'Scent'],
    ['Lashvine', 'PZO1112', 'Natural Attacks'],
    ['Acid Breath', 'PZO1112', 'Breath Weapon'],
    ['Dragon-Scaled', 'PZO1112', 'Resistance'],
    ['Energy Resistance (Undine)', 'PZO1112', 'Resistance'],
    ['Poison Minion (wayang)', 'PZO1112', 'Poison'],
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
  // Rules the bodies cite or depend on: the Scalykind domain (Inner Sea World
  // Guide), the verdant sorcerer bloodline (APG) and the bloodrager (ACG),
  // the witch spell list (APG), the scorpion whip (Ultimate Equipment) and
  // the Primitive Human's blog source.
  for (const [name, book] of [
    ['Serpent Affinity', 'PZO9226'],
    ["Creator's Legacy", 'PZO1115'],
    ["Creator's Legacy", 'PZO1129'],
    ['Hag Magic (ISR)', 'PZO1115'],
    ['Lashvine', 'PZO1123'],
    ['Primitive Feat', 'Paizo Blog: The Gauntlet Will Be Ours!'],
  ] as const)
    expect(candidate(name).requiredNotices, name).toContain(book);
  expect(candidate('Primitive Feat').requiredNotices).toEqual([
    'Paizo Blog: The Gauntlet Will Be Ours!',
    'PZO1110',
  ]);
  // Unchained action-cost metadata anywhere in the bound closure requires
  // the held PZO1131.
  const unchained = [...new Set([...unchainedOwn, ...unchainedBound])].sort();
  expect(unchained).toHaveLength(17);
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
  for (const name of ['Vishkanya', 'Kitsune'])
    expect(
      candidate(name).inheritedRuleUnresolvedOrigins.join(' '),
      name,
    ).toContain('Creature type and subtype rules');
  // Rejected same-name rows and PCGen leads don't add books.
  expect(
    candidate('Hag Magic (ISR)').rejectedRootComparisonEvidence.map(
      (row) => row.book,
    ),
  ).toEqual(['PZO9464']);
  expect(candidate('Hag Magic (ISR)').requiredNotices).not.toContain('PZO9464');
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
    // Racial subtypes keep their race's ability score trait.
    [FERAL_HALF_ORC]: ['Base Statistics'],
    'pf1-content/8lSKScxOqbUF5X1H': ['Base Statistics'], // Drow-Descended
    'pf1-content/9CFWFY7SgYQcanu3': ['Base Statistics'], // Nomadic
    // Green Widow (the green hag changeling trait) has no pf1-content record.
    'pf1-content/901VteaGCjg0FTKQ': ['Green Widow'], // Object of Desire
  });
  // Adoptive Parentage's header is split over two bold tags, so the importer
  // reads no replacement (reported as an importer gap).
  expect(entry('Adoptive Parentage (Weapon Focus)').detail.replaces).toEqual(
    [],
  );
  expect(
    candidate('Adoptive Parentage (Weapon Focus)').mechanicsReview
      .descriptionText,
  ).toContain('<strong>Replaced</strong> <strong>Trait(s)</strong>');
});

it('pins all 100 keys, the complete bodies, checked bindings and literal PCGen and PRD evidence in the shared store', async () => {
  expect(review.candidates).toHaveLength(100);
  expect(new Set(review.candidates.map((row) => row.externalKey)).size).toBe(
    100,
  );
  expect(review.counts).toEqual({
    total: 100,
    admitted: 1,
    held: 69,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 30,
    excludedFolders: 11,
    excludedRaceBuilder: 19,
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
  expect(preview.entries).toHaveLength(70);
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
    // The blog source is a title-only custom source the importer leaves out.
    expect(entry(row.externalKey).sources).toEqual(
      row.citedSources.filter(
        (source) => source.book !== 'Paizo Blog: The Gauntlet Will Be Ours!',
      ),
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
  expect(assessedTraits.filter((row) => row.prdComparison)).toHaveLength(20);
  expect(
    assessedTraits
      .filter((row) => row.prdComparison && !row.prdComparison.textMatches)
      .map((row) => row.name)
      .sort(),
  ).toEqual([
    'Deep Warrior',
    'Silent Hunter',
    'Skilled (Tiefling)',
    'Spell-Like Ability (Dhampir)',
  ]);
  // The dhampir's caster level reads "character level" in the pinned body and
  // "class level" in the PRD paragraph: recorded, not resolved.
  expect(
    candidate('Spell-Like Ability (Dhampir)').prdComparison?.wordDifferences,
  ).toContainEqual({ pinned: 'character', prd: 'class' });
  // Deep Warrior and Silent Hunter follow their APG rows' wording.
  for (const name of ['Deep Warrior', 'Silent Hunter'])
    expect(candidate(name).comparison?.book, name).toBe('PZO1115');
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
      required: 32,
      checked: 32,
      missing: 0,
      descriptions: { candidates: 70, checked: 70 },
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
    expect(gate.failures.filter((row) => ours.has(row.externalKey))).toEqual(
      [],
    );
    const held = gate.held.filter((row) => ours.has(row.externalKey));
    expect(held).toHaveLength(69);
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
    const dwarf = candidate('Darkvision (Dwarf)');
    expect(dwarf.requiredNotices).toEqual([
      'PZO9280',
      'PZO1121',
      'PZO1127',
      'PZO1110',
    ]);
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
