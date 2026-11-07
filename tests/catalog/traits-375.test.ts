// @vitest-environment node
import { recordedPrerequisiteFacts } from './prerequisite-audit-739';
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
  abilityTargets,
  modifierTargets,
  resolveSheet,
  calculateCharacterSheetProjections,
} from '../../src/lib/character-sheet';
import {
  review,
  heldTraits,
  folders,
  preview,
  pinnedFiles,
  pinnedSha256,
} from '../fixtures/traits-375/data';
import { reviewedTraitSheet } from '../fixtures/traits-375/sheet';
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
  if (row.detail.kind !== 'trait') throw new Error('Expected trait');
  return { ...row, detail: row.detail };
}
function candidate(name: string) {
  const row = heldTraits.find((row) => row.name === name);
  if (!row) throw new Error(`Missing review of ${name}`);
  return row;
}
function modifiers(name: string, sheetEntryId = entry(name).externalKey) {
  const row = entry(name);
  return row.modifiers.map((raw) => ({
    ...outputSchema.options[0]
      .omit({ kind: true })
      .extend({ target: z.enum(modifierTargets) })
      .parse(raw),
    sheetEntryId,
    catalogEntryId: row.externalKey,
    source: row.externalKey,
    entryName: row.name,
    builtIn: false,
  }));
}
// The Situation of one Modifier, selected on its sheet entry.
function situation(
  name: string,
  index: number,
  sheetEntryId = entry(name).externalKey,
) {
  const scope = modifiers(name)[index]?.condition?.situation;
  if (!scope) throw new Error(`Modifier ${index} of ${name} has no Situation`);
  if (typeof scope === 'string') return scope;
  if (!('local' in scope)) throw new Error('Expected a local Situation');
  return { local: scope.local, sheetEntryId };
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
const total = (sheet: ReturnType<typeof reviewedTraitSheet>, target: string) =>
  calculateCharacterSheetProjections(sheet).current.breakdowns[
    target as 'skill.per'
  ].total;

// Traits with no PCGen trait row at the pin, including alternate spellings.
const noRow = [
  'The Patriarch',
  'Unwelcome Business',
  'Neutralizing Gut (Tiefling)',
  "Gozreh's Sight (Gozreh)",
  'Twisted Transformations (any Great Old One)',
  'The Bridge',
  'Naturalist (Yamasa)',
  'Athletic Champion (War for the Crown)',
  'Eldritch Auditor',
  'Fires of Hell (Cheliax Faction)',
  'Expert Duelist (Sovereign Court)',
  'Proper Training (Grand Lodge)',
  'Impressive Presence (Sovereign Court)',
];

// Every trait whose bound content closure keeps Unchained action-cost
// metadata (owner ruling, 2026-10-17): 15 on the trait's own action and 4
// through linked bodies, 2 of them both ways.
const unchainedOwn = [
  'pf1-content/OnbHhJ2DEosiiCJF', // Roll With It
  'pf1-content/OqAVR6VHUGOWqwXj', // Unflinching Faith
  'pf1-content/OrDBgS5M8Dg7t4eu', // Servitor of Spirits
  'pf1-content/P9rHMYN4ZR0WvFcq', // The Patriarch
  'pf1-content/PLBAat0cTx58RYDk', // Resilient Construction
  'pf1-content/PjrEvovAcl1kXAiL', // Firebug
  'pf1-content/PqtbErvjsDpSPScU', // Prestigious Healer
  'pf1-content/Q5zpCyyF6lRb0Esq', // Tactile Telekinesis
  'pf1-content/QFnNKR7pVekNqbFM', // Open Palm of Irori
  'pf1-content/QXZnz2uhxW6wNsGS', // Imperfect Recall
  'pf1-content/Qa9gd4frcwixZqIG', // Honor-Bound
  'pf1-content/Ql325Cfo23lQmhKl', // Good Dreams
  'pf1-content/R9vCorsZWWgS9Zbc', // Fires of Hell
  'pf1-content/RFa8qDL9l5xC1JsF', // Heavenly Touch
  'pf1-content/RnLN1FgAETGciM4t', // Impressive Presence
];
const unchainedLinked = [
  'pf1-content/P9rHMYN4ZR0WvFcq', // The Patriarch: Know Direction
  'pf1-content/QSe1ejZnAuOnirnY', // Weapon Training: the twelve weapons
  'pf1-content/Ql325Cfo23lQmhKl', // Good Dreams: Halfling Jinx
  'pf1-content/RGrxCJTn2HTjjVdr', // Ancestor's Blade: Smite Evil
];

// A base sheet with the given ability scores, for the Intelligence formula.
function withScores(
  sheet: ReturnType<typeof reviewedTraitSheet>,
  scores: Partial<Record<'int', number>>,
) {
  const [base, ...rest] = sheet.catalogEntries;
  return {
    ...sheet,
    catalogEntries: [
      {
        ...base!,
        modifiers: base!.modifiers.map((modifier) =>
          modifier.target === abilityTargets.intelligence &&
          scores.int !== undefined
            ? { ...modifier, value: scores.int }
            : modifier,
        ),
      },
      ...rest,
    ],
  };
}

it('resolves the reviewed trait Modifiers, with trait bonuses that never stack', () => {
  // Trait bonuses from different traits on one skill never stack.
  expect(
    total(reviewedTraitSheet('Talented Organizer (Milani)'), 'skill.sen'),
  ).toBe(1);
  expect(
    total(
      reviewedTraitSheet('Talented Organizer (Milani)', "Outcast's Intuition"),
      'skill.sen',
    ),
  ).toBe(1);
  expect(
    total(
      reviewedTraitSheet('Market Rat (Human; Keleshite)', 'For the Money'),
      'skill.apr',
    ),
  ).toBe(1);
  // A bonus that rises in a Situation is its new total: Desperate Resolve's
  // +1 on concentration becomes +4, Armun Kelisk Scholar's +1 on Knowledge
  // (planes) becomes +3 and For the Money's +2 becomes +4.
  for (const [name, target, label, base, raised] of [
    ['Desperate Resolve', 'concentration', 'grappled', 1, 4],
    ['Armun Kelisk Scholar (Plane of Air)', 'skill.kpl', 'air subtype', 1, 3],
  ] as const) {
    expect(resolveSheet(modifiers(name))[target].total, name).toBe(base);
    expect(
      resolveSheet(modifiers(name), {
        situations: [situation(name, indexOf(name, target, label))],
      })[target].total,
      name,
    ).toBe(raised);
  }
  const money = 'For the Money';
  expect(
    resolveSheet(modifiers(money), {
      situations: [
        situation(money, indexOf(money, 'skills', 'haggle prices or')),
        situation(money, indexOf(money, 'skills', 'position of military')),
      ],
    })['skill.dip'].total,
  ).toBe(4);
  // Targetless or unmapped imported changes contribute nothing; reviewed
  // Modifiers supply the rule, under its Situation where it has one.
  for (const [name, target, value] of [
    ['Younger Sibling (Jade Regent)', 'save.will', 1],
    ['Unwelcome Business', 'skill.dis', 1],
    ['Regional Influence - Magnimar (Varisia)', 'skill.pro', 1],
    ['Criminal', 'skill.dev', 1],
    ['Proper Training (Grand Lodge)', 'skill.khi', 1],
    ['Athletic Champion (War for the Crown)', 'skill.swm', 1],
    ['Armun Kelisk Scholar (Plane of Air)', 'skill.kna', 1],
  ] as const) {
    expect(entry(name).unsupported, name).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'changes' })]),
    );
    const index = modifiers(name).findIndex(
      (row) => row.target === target && row.value === value,
    );
    expect(resolveSheet(modifiers(name))[target].total, name).toBe(0);
    expect(
      resolveSheet(modifiers(name), { situations: [situation(name, index)] })[
        target
      ].total,
      name,
    ).toBe(value);
  }
  for (const [name, value] of [
    ['Unbreakable Hate (Half-Orc, Orc)', 2],
    ['Desperate Resolve', 1],
  ] as const) {
    expect(entry(name).unsupported, name).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'changes',
          value: expect.objectContaining({ target: 'concentration' }),
        }),
      ]),
    );
    expect(resolveSheet(modifiers(name)).concentration.total, name).toBe(value);
  }
  // Choices are one Situation per option.
  for (const [name, count] of [
    ['Armun Kelisk Scholar (Plane of Air)', 20],
    ['Younger Sibling (Jade Regent)', 4],
    ['Unwelcome Business', 2],
    ['Criminal', 3],
    ['Proper Training (Grand Lodge)', 2],
    ['Athletic Champion (War for the Crown)', 6],
    ['Imperfect Recall', 10],
    ['Warrior Poet (Lands of the Linnorm Kings)', 11],
    ["Ex-Iomedaean (Hell's Vengeance)", 3],
  ] as const)
    expect(modifiers(name), name).toHaveLength(count);
  // Tactile Telekinesis adds the Intelligence modifier on Climb and Swim.
  const tactile = withScores(
    reviewedTraitSheet('Tactile Telekinesis (Lashunta)'),
    { int: 16 },
  );
  const scope = modifiers('Tactile Telekinesis (Lashunta)')[0]?.condition
    ?.situation;
  if (!scope || typeof scope === 'string' || !('local' in scope))
    throw new Error('Expected a local Situation');
  const tactileTotals = calculateCharacterSheetProjections(tactile, {
    situations: [{ local: scope.local, sheetEntryId: 'trait-row-0' }],
  }).current.breakdowns;
  expect(tactileTotals['skill.clm'].total).toBe(3);
  expect(tactileTotals['skill.swm'].total).toBe(3);
  expect(total(tactile, 'skill.clm')).toBe(0);
  // Freedom Fighter's +2 becomes a -2 penalty with slavers.
  const fighter = 'Freedom Fighter (Andoran)';
  expect(resolveSheet(modifiers(fighter))['skill.dip'].total).toBe(2);
  expect(
    resolveSheet(modifiers(fighter), {
      situations: [situation(fighter, indexOf(fighter, 'skill.dip', 'slave'))],
    })['skill.dip'].total,
  ).toBe(-2);
  // Shared Situations only where the body's condition matches exactly.
  for (const [name, key, target, value] of [
    ['Giant Slayer (Rise of the Runelords)', 'giants', 'damage.melee', 1],
    ['Student of Giantkind (Giantslayer)', 'giants', 'skill.dip', 1],
    ['Serpentine Squeeze (Ydersius)', 'grapple', 'cmb', 1],
  ] as const)
    expect(
      resolveSheet(modifiers(name), { situations: [key] })[target].total,
      name,
    ).toBe(value);
  for (const [name, key, target] of [
    ['Serpentine Squeeze (Ydersius)', 'grapple', 'cmd'],
    ['Neutralizing Gut (Tiefling)', 'poison', 'save.fort'],
    ['Enemy of the Undead (Geb)', 'spells', 'save.will'],
    ['Enemy of the Undead (Geb)', 'spellLike', 'save.will'],
    ['Unbalanced Insight', 'fear', 'save.will'],
    ['Enduring Stoicism (Strange Aeons)', 'fear', 'save.will'],
    ['Eldritch Auditor', 'identifyMagicItems', 'skill.spl'],
    ['Student of Giantkind (Giantslayer)', 'giants', 'skill.klo'],
  ] as const)
    expect(
      resolveSheet(modifiers(name), { situations: [key] })[target].total,
      `${name} ${key}`,
    ).toBe(0);
  // Foundry files these notes on other statistics; the reviewed Modifiers
  // land where the body puts them.
  for (const [name, targets] of [
    ['Blade of the Society (Rogue, Pathfinder Society)', ['damage']],
    ['Undead Slayer (Pharasma)', ['damage']],
    ['Second Tongue (Old Cults)', ['casterLevel']],
    ['Lost Nobility', ['attack', 'damage']],
    ["Ex-Iomedaean (Hell's Vengeance)", ['attack', 'damage', 'spellDC']],
  ] as const)
    expect(
      modifiers(name).map((row) => row.target),
      name,
    ).toEqual(targets);
  expect(modifiers('Eldritch Delver').map((row) => row.target)).toEqual([
    'skill.kdu',
    'skill.khi',
    'casterLevel',
  ]);
  // Untyped bonuses and penalties stay untyped, as published.
  for (const name of [
    'Pride',
    'Imperfect Recall',
    'Second Tongue (Old Cults)',
    'Celestial Contact (Aasimar)',
  ])
    expect(new Set(modifiers(name).map((row) => row.bonusType)), name).toEqual(
      new Set(['untyped']),
    );
  expect(
    modifiers('Twisted Transformations (any Great Old One)').map(
      (row) => row.bonusType,
    ),
  ).toEqual(['untyped', 'trait', 'untyped']);
  // Pride's -2 penalties wait for their Situation.
  expect(resolveSheet(modifiers('Pride'))['skill.sen'].total).toBe(0);
  expect(
    resolveSheet(modifiers('Pride'), {
      situations: [situation('Pride', indexOf('Pride', 'skill.sen', 'apolog'))],
    })['skill.sen'].total,
  ).toBe(-2);
  // No reviewed armor, shield or natural armor bonus lands on ac.other (#734).
  for (const row of preview.entries)
    for (const modifier of row.modifiers)
      if (['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType))
        expect(modifier.target, row.name).not.toBe('ac.other');
});

it('checks every required note record and the separate description pass against the pinned bodies', () => {
  let required = 0;
  for (const row of heldTraits) {
    const [description, ...notes] = row.mechanicsReview.curationRecords;
    const contextNotes = row.sourceFields.contextNotes as
      | { target: string; text: string }[]
      | undefined;
    expect(notes.map((note) => note.target).sort(), row.name).toEqual(
      (contextNotes ?? []).map((note) => note.target).sort(),
    );
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
    for (const part of parts) {
      expect(part.length, row.name).toBeLessThanOrEqual(4096);
      expect(part, row.name).not.toContain('@UUID');
      expect(part, row.name).not.toContain('[[');
    }
    const texts = (entry(row.name).situationalNotes ?? []).map(
      (note) => note.text,
    );
    for (const part of parts) expect(texts, row.name).toContain(part);
  }
  expect(required).toBe(116);
  // Hurricane Savvy's ranged-weapon note repeats its wind rule; it is the
  // explicit covered/no-output record.
  expect(
    heldTraits.flatMap((row) =>
      row.mechanicsReview.curationRecords
        .filter((record) => !record.outputs.length)
        .map((record) => `${row.name} ${record.target}`),
    ),
  ).toEqual(['Hurricane Savvy (The Shackles) rangedWeapon']);
  // Notes the drafter put on unrelated statistics are entry-level.
  for (const name of [
    'Airship Captain (Plane of Air)',
    'Family Trade',
    'Jungle Opportunist (Catfolk)',
    'Hedge Magician',
    'Dinosaur Whisperer (Ilizmagorti)',
    'Bladed Magic',
  ])
    expect(
      entry(name)
        .situationalNotes?.filter((note) => note.target)
        .map((note) => note.target),
      name,
    ).toEqual([]);
  // Retargeted readable Notes.
  for (const [name, target] of [
    ['Resilient Construction (Wyrwood)', 'hp'],
    ['Fires of Hell (Cheliax Faction)', 'damage'],
    ['Spell Duel Prodigy (Erages)', 'casterLevel'],
  ] as const)
    expect(
      entry(name)
        .situationalNotes?.filter((note) => note.target)
        .map((note) => note.target),
      name,
    ).toEqual([target]);
  // Every outstanding calculation is recorded, never as an attribution hold.
  for (const row of heldTraits)
    for (const text of row.mechanicsReview.outstandingCalculations)
      expect(row.holdIds.join(' '), row.name).not.toContain(text);
  expect(
    heldTraits
      .filter((row) => !row.mechanicsReview.outstandingCalculations.length)
      .map((row) => row.name)
      .sort(),
  ).toEqual([
    'Altruistic Diplomat (Hwanggot)',
    'Auspicious Tattoo (Human; Shoanti)',
    'Market Rat (Human; Keleshite)',
  ]);
});

it('records the trait framework, inherited rules, linked bodies and enforced notice holds without inventing attribution', () => {
  const held = new Map(heldNotices.map((row) => [row.id, row.notices]));
  for (const row of heldTraits) {
    expect(row.requiredNotices, row.name).toContain('PZO1115');
    expect(row.requiredNotices.at(-1), row.name).toBe('PZO1110');
    const [framework, drawback] = row.inheritedRuleComparisonEvidence;
    expect(framework, row.name).toMatchObject({
      line: 18,
      book: 'PZO1115',
      appliesToRootBody: false,
    });
    expect(framework?.literalRow, row.name).toContain(
      'BONUS:SAVE|Reflex|1|TYPE=Trait',
    );
    if (row.traitType === 'drawback') {
      expect(row.requiredNotices, row.name).toContain('PZO1125');
      expect(drawback?.literalRow, row.name).toMatch(
        /^ABILITYCATEGORY:Drawbacks\t/,
      );
    }
    for (const cited of row.citedSources)
      expect(row.requiredNotices, row.name).toContain(cited.book);
    for (const linked of row.linkedContentReview)
      for (const book of linked.sources)
        expect(row.requiredNotices, row.name).toContain(book.id);
    expect(row.holdIds, row.name).toEqual([
      `traits-375-whole-content-${row.externalKey.split('/')[1]}`,
    ]);
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices
        .filter((book) => book !== 'PZO1110')
        .map((book) => `traits-375-notice-${book}-complete-chain`),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  expect(
    heldTraits
      .filter((row) => row.traitType === 'drawback')
      .map((row) => row.name),
  ).toEqual(['Pride']);
  // Rootless records take their book from the PCGen comparison.
  for (const [name, book] of [
    ['Armun Kelisk Scholar (Plane of Air)', 'PZO9447'],
    ['Blade of the Society (Rogue, Pathfinder Society)', 'PZO9221'],
  ] as const) {
    expect(candidate(name).citedSources, name).toEqual([]);
    expect(candidate(name).comparison?.book, name).toBe(book);
    expect(candidate(name).requiredNotices, name).toContain(book);
  }
  // Inherited rules the bodies change or depend on.
  for (const [name, book] of [
    ['Servitor of Spirits (Tian Xia)', 'PZO1132'],
    ['Airship Captain (Plane of Air)', 'PZO1114'],
    ['Airship Captain (Plane of Air)', 'PZO1118'],
    ['Bladed Magic', 'PZO1117'],
    ['Weapon Training (Human; Ulfen)', 'PZO1123'],
    ['Weapon Training (Human; Ulfen)', 'PZO9452'],
    ['Friends and Enemies (Rise of the Runelords)', 'PZO1123'],
  ] as const)
    expect(candidate(name).requiredNotices, name).toContain(book);
  // Class features name the pinned class record's literal line.
  for (const [name, suffix] of [
    ["Ancestor's Blade (Shizuru)", 'paladin.ohptcds1d5oG6Bjh.yaml#L101'],
    ['Bladed Magic', 'magus.xZLcyrEKYZoJPS2k.yaml#L104'],
  ] as const)
    expect(
      candidate(name).inheritedRuleNotices.some((notice) =>
        notice.location.endsWith(suffix),
      ),
      name,
    ).toBe(true);
  // Unchained action-cost metadata anywhere in the bound closure, the
  // trait's own actions included, requires the held PZO1131.
  const unchained = [...new Set([...unchainedOwn, ...unchainedLinked])].sort();
  expect(unchained).toHaveLength(17);
  expect(
    heldTraits
      .filter((row) => row.requiredNotices.includes('PZO1131'))
      .map((row) => row.externalKey)
      .sort(),
  ).toEqual(unchained);
  const bodies = new Map(
    [...preview.entries, ...preview.closure].map((row) => [
      row.externalKey,
      row,
    ]),
  );
  for (const key of unchained) {
    const row = heldTraits.find((row) => row.externalKey === key)!;
    expect(row.noticeHoldIds, row.name).toContain(
      'traits-375-notice-PZO1131-complete-chain',
    );
    const rules = row.inheritedRuleNotices
      .filter((notice) => notice.book === 'PZO1131')
      .map((notice) => notice.rule);
    if (unchainedOwn.includes(key))
      expect(rules, row.name).toEqual(
        expect.arrayContaining([expect.stringContaining("trait's own action")]),
      );
    if (unchainedLinked.includes(key)) {
      expect(rules, row.name).toEqual(
        expect.arrayContaining([expect.stringContaining('on the bound')]),
      );
      for (const linked of row.linkedContentReview)
        expect(bodies.has(linked.externalKey), linked.name).toBe(true);
    }
    // The metadata is literally in the trait's own record or a bound body.
    const own =
      (
        row.sourceFields.actions as
          | { activation?: { unchained?: unknown } }[]
          | undefined
      )?.some((action) => action.activation?.unchained) ?? false;
    expect(own, row.name).toBe(unchainedOwn.includes(key));
  }
  for (const row of heldTraits.filter(
    (row) => !unchained.includes(row.externalKey),
  ))
    expect(
      (
        row.sourceFields.actions as
          | { activation?: { unchained?: unknown } }[]
          | undefined
      )?.some((action) => action.activation?.unchained) ?? false,
      row.name,
    ).toBe(false);
  // Same-name rows of other traits and unpinned printings are not required.
  for (const [name, book] of [
    ['Family Ties (Rise of the Runelords)', 'PZO1125'],
    ['Firebug (Kobold)', 'PZO9433'],
    ['Undead Slayer (Pharasma)', 'PZO9442'],
    ['Freedom Fighter (Andoran)', 'PZO9404'],
    ['Freedom Fighter (Andoran)', 'PZO9421'],
    ['Blade of the Society (Rogue, Pathfinder Society)', 'PZO9000-11E'],
    ['Beast of the Society (Druid, Pathfinder Society)', 'PZO9221'],
    ['The Patriarch', 'PZO9474'],
    ['The Bridge', 'PZO9474'],
  ] as const)
    expect(candidate(name).requiredNotices, name).not.toContain(book);
  const linkedNames = heldTraits.flatMap((row) =>
    row.linkedContentReview.map((linked) => linked.name),
  );
  expect(linkedNames).toHaveLength(25);
  expect(new Set(linkedNames).size).toBe(25);
  expect(
    candidate('Regional Recluse - Arsmeril or Crying Leaf (Varisia)')
      .linkedContentReview.map((linked) => linked.externalKey)
      .sort(),
  ).toEqual([
    'pf1-content/BDByEeeSK08bn8gp',
    'pf1-content/EtUNYMr9ykH2XhZA',
    'pf1-content/SUxxga9Juql4kY3J',
    'pf1-content/qDxSXompaz69Ceqj',
  ]);
  // Linked records that cite no source take their book from their class
  // record or a Core Rulebook PCGen row.
  for (const [name, linked] of [
    ["Ancestor's Blade (Shizuru)", 'Smite Evil'],
    ['Friends and Enemies (Rise of the Runelords)', 'Bit And Bridle'],
    ['Friends and Enemies (Rise of the Runelords)', 'Stabling'],
  ] as const)
    expect(
      candidate(name).linkedContentReview.find((row) => row.name === linked)
        ?.sources,
      `${name} ${linked}`,
    ).toEqual([]);
  // The closure holds the linked bodies, and Halfling Jinx's own link.
  expect(preview.closure.map((row) => row.externalKey).sort()).toEqual(
    [
      ...new Set([
        ...heldTraits.flatMap((row) =>
          row.linkedContentReview.map((linked) => linked.externalKey),
        ),
        'pf1-content/HVI7FNwj2ng10qtj',
      ]),
    ].sort(),
  );
  for (const name of noRow) {
    expect(candidate(name).comparison, name).toBeNull();
    expect(candidate(name).additionalComparisonLeads, name).toEqual([]);
    expect(candidate(name).inheritedRuleUnresolvedOrigins[0], name).toContain(
      'no PCGen row at the pin',
    );
  }
  expect(heldTraits.filter((row) => !row.comparison)).toHaveLength(
    noRow.length,
  );
  // Origins no permitted evidence sources stay named unresolved origins.
  for (const [name, origins] of [
    ['Permanent Scars', ['emotion descriptor', 'pain descriptor']],
    ['Enduring Stoicism (Strange Aeons)', ['emotion descriptor']],
    ['Resilient Construction (Wyrwood)', ['destroyed at 0 hit points']],
    [
      'Friends and Enemies (Rise of the Runelords)',
      ['heavy combat trained horse'],
    ],
  ] as const)
    expect(candidate(name).inheritedRuleUnresolvedOrigins, name).toEqual(
      origins.map((origin) => expect.stringContaining(origin)),
    );
  for (const requirement of review.noticeRequirements) {
    if (requirement.book === 'PZO1110') {
      expect(requirement.holdId).toBeNull();
      continue;
    }
    expect(held.get(requirement.holdId ?? ''), requirement.book).toEqual([
      requirement.book,
      ...requirement.registryKeys.filter((key) => key !== requirement.book),
    ]);
    for (const key of requirement.candidates)
      expect(
        heldTraits.find((row) => row.externalKey === key)?.noticeHoldIds,
      ).toContain(requirement.holdId);
  }
});

it('records prerequisite mapper findings against the actual mapped atoms', () => {
  const kinds = (name: string) =>
    entry(name).prerequisites?.map((atom) =>
      'kind' in atom ? atom.kind : 'anyOf',
    );
  const facts = (name: string) =>
    recordedPrerequisiteFacts({
      batch: 'traits-375',
      candidate: candidate(name),
    });
  // "Half-Orc, Orc" maps two race atoms that must both hold, and Lashunta
  // maps no race (#739).
  for (const [name, mapped] of [
    ['Unbreakable Hate (Half-Orc, Orc)', ['anyOf']],
    ['Tactile Telekinesis (Lashunta)', ['unchecked']],
  ] as const) {
    expect(kinds(name), name).toEqual(mapped);
    expect(facts(name), name).toEqual(
      expect.arrayContaining([expect.stringContaining('#739')]),
    );
  }
  expect(kinds('Servitor of Spirits (Tian Xia)')).toEqual(['unchecked']);
  expect(kinds('Good Dreams (Desna; Halfling)')).toEqual([
    'unchecked',
    'race',
    'unchecked',
  ]);
  for (const [name, gap] of [
    ['Proper Training (Grand Lodge)', 'no faction fact exists'],
    ['Market Rat (Human; Keleshite)', 'no heritage or ethnicity fact exists'],
    ['Dragonslayer (Dahak)', 'no deity fact exists'],
    ['Naturalist (Yamasa)', 'no region fact exists'],
    ['The Patriarch', 'no birth-date fact exists'],
  ] as const)
    expect(facts(name), name).toEqual(
      expect.arrayContaining([expect.stringContaining(gap)]),
    );
  for (const row of heldTraits)
    expect(row.mechanicsReview.prerequisiteReview.normalizedAtoms).toEqual(
      entry(row.name).prerequisites ?? [],
    );
});
it('pins all 100 keys, the complete bodies, checked bindings and literal PCGen evidence in the shared store', async () => {
  expect(review.candidates).toHaveLength(100);
  expect(new Set(review.candidates.map((row) => row.externalKey)).size).toBe(
    100,
  );
  expect(review.counts).toEqual({
    total: 100,
    admitted: 0,
    held: 100,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 0,
    recordLevel35Holds: 0,
  });
  // This batch has no folder record.
  expect(folders).toEqual([]);
  expect(preview.entries).toHaveLength(100);
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
        reviewedOn: '2026-10-18',
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
    expect(entry(row.name).detail.traitType).toBe(row.traitType);
  }
  for (const row of heldTraits)
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
  for (const row of heldTraits) {
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
      const { path, line, text, sha256 } = comparison.publicationAnchor;
      expect(files.get(path)).toBe(sha256);
      const publication = await readFile(
        `tests/fixtures/pinned/pcgen/${path}`,
        'utf8',
      );
      expect(publication.split(/\r?\n/)[line - 1]?.split('\t')[0]).toBe(text);
    }
  }
  // Auspicious Tattoo's body equals its Humans of Golarion row's benefit.
  expect(
    candidate('Auspicious Tattoo (Human; Shoanti)').comparison?.literalRow,
  ).toContain('BONUS:SAVE|Will|1|TYPE=Trait');
});

it('reextracts the reviewed mechanics from a clean shared fixture tree and keeps every trait held on its own holds', async () => {
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
    expect(artifact.curation.passed).toBe(true);
    expect(artifact.curation.missing).toEqual([]);
    expect(artifact.curation.stale).toEqual([]);
    expect(artifact.curation.summary).toMatchObject({
      required: 116,
      checked: 116,
      missing: 0,
      descriptions: { candidates: 100, checked: 100 },
    });
    expect(
      artifact.catalog.entries.map((row) => row.externalKey).sort(),
    ).toEqual(heldTraits.map((row) => row.externalKey).sort());
    for (const row of artifact.catalog.entries) {
      const saved = entry(row.name);
      expect({
        description: row.description,
        modifiers: row.modifiers,
        situationalNotes: row.situationalNotes,
        sources: row.sources,
      }).toEqual({
        description: saved.description,
        modifiers: saved.modifiers,
        situationalNotes: saved.situationalNotes,
        sources: saved.sources,
      });
    }
    // The assessments are bound against the full-corpus content closure: the
    // committed entries and the linked bodies in their closures.
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
    const ours = new Set(heldTraits.map((row) => row.externalKey));
    const gate = assessCatalogAdmission({
      artifact: authoritative,
      ...reviewedAdmission,
    });
    expect(gate.admitted.filter((row) => ours.has(row.externalKey))).toEqual(
      [],
    );
    // Friends and Enemies links a horse record absent from the pinned pack;
    // the importer strips it and the gate reports the entry before its holds
    // apply. #738 keeps Impressive Presence's journal link as text.
    expect(gate.failures.filter((row) => ours.has(row.externalKey))).toEqual([
      {
        externalKey: 'pf1-content/QlxaIQ9zRpMach7V',
        reason: 'Broken structure or reference: unresolved imported reference.',
      },
    ]);
    const held = gate.held.filter((row) => ours.has(row.externalKey));
    expect(held).toHaveLength(99);
    for (const row of held)
      expect(row.reason, row.name).toBe(candidate(row.name).rationale);
    for (const row of heldTraits) {
      const assessment = reviewedAdmission.assessments.find(
        (a) => a.externalKey === row.externalKey,
      );
      expect(assessment).toMatchObject({
        status: 'unresolved',
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
    // Confirming a trait's whole content still holds it on its held notices:
    // every trait requires the held APG trait framework notice.
    const orphan = candidate('Market Rat (Human; Keleshite)');
    expect(orphan.requiredNotices).toEqual(['PZO9417', 'PZO1115', 'PZO1110']);
    // With its PCGen-confirmed books reviewed (2026-10-31), only the notice
    // holds the owner's clearance clears still hold it, so this runs uncleared.
    const confirmed = assessWithUnclearedHolds({
      artifact: authoritative,
      ...reviewedAdmission,
      assessments: reviewedAdmission.assessments.map((row) =>
        row.externalKey === orphan.externalKey
          ? { ...row, status: 'confirmed' as const }
          : row,
      ),
    });
    expect(
      confirmed.admitted.some((row) => row.externalKey === orphan.externalKey),
    ).toBe(false);
    expect(
      confirmed.held.find((row) => row.externalKey === orphan.externalKey)
        ?.reason,
    ).toMatch(/Notice holds|Missing or unreviewed required notices/);
  } finally {
    await tree.dispose();
  }
});
