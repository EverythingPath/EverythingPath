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
import { findReviewedReplacementFormula } from '../../scripts/catalog/reviewed-change-replacements';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import remaps from '../../scripts/catalog/reviewed-remaps.json';
import heldNotices from '../../scripts/catalog/legal/held-notices.json';
import { outputSchema } from '../../src/lib/catalog/curation-output-schema';
import {
  calculateCharacterSheet,
  modifierTargets,
  resolveSheet,
} from '../../src/lib/character-sheet';
import {
  review,
  assessedItems,
  excludedRows,
  preview,
  pinnedFiles,
  pinnedSha256,
} from '../fixtures/items-430/data';
import { itemSheet } from '../fixtures/items-430/sheet';
import { materializePinnedTree, readPinned } from './pinned-sources';
import { bindSnapshotToCurrentNotices } from './batch-ownership';
import { assessWithUnclearedHolds } from './uncleared-holds';

const sha = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
const ENTERTAINERS_OUTFIT = 'pf1/6kZGQ2chmr3jpS1t';
// The outfit's attribution evidence is complete, but it is held on importer
// gap #762 (fixed: it imports no armor block), so none is admitted; a later
// curation step re-admits it.
const OUTFIT_HOLD = 'items-430-importer-gap-762-6kZGQ2chmr3jpS1t';
const RING_OF_PROTECTION = 'pf1/0AIz2Gk74uaiLQIh';
const AMULET_2 = 'pf1/5F06HJzeAlqTOot1';
const BRACERS = 'pf1/7r3OittOtOxLNlKS';
const IOUN_STONE = 'pf1/71VGp1a4z1BQFNXu';
const CLOAK = 'pf1/2rDdqODASJmbq7WP';
const HORSESHOE = 'pf1/7P3H1yV8835Am6c6';
const DEXTERITY_BELT = 'pf1/6JNWUofyniDkjhjk';
const MIGHT_BELT = 'pf1/1hPPkMMfEuJha8YB';
const ARTISANS_TOOLS = 'pf1/5WTK5HUkSZVClehk';
const INSTRUMENT = 'pf1/74nJBzdY4yvMZcBe';
function entry(name: string) {
  const row = preview.entries.find(
    (row) => row.externalKey === name || row.name === name,
  );
  if (!row) throw new Error(`Missing ${name}`);
  if (row.detail.kind !== 'item') throw new Error('Expected an item');
  return { ...row, detail: row.detail };
}
function candidate(name: string) {
  const row = assessedItems.find(
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
/** The local Situation labels of one entry's Modifiers, in order. */
function situations(name: string) {
  return modifiers(name).flatMap((row) => {
    const scope = row.condition?.situation;
    if (!scope) return [];
    if (typeof scope === 'string' || !('local' in scope))
      throw new Error('Expected a local Situation');
    return [scope.local];
  });
}
/** The local Situation labels of one entry's Modifiers on one target. */
function situationsOn(name: string, target: string) {
  return modifiers(name).flatMap((row) => {
    const scope = row.condition?.situation;
    return row.target === target && scope && typeof scope === 'object'
      ? 'local' in scope
        ? [scope.local]
        : []
      : [];
  });
}
// One resolved statistic of one entry's Modifiers, with the given local
// Situations selected.
function resolved(name: string, target: string, selected: string[] = []) {
  return resolveSheet(modifiers(name), {
    situations: selected.map((local) => ({
      local,
      sheetEntryId: entry(name).externalKey,
    })),
  })[target as 'attack.melee'].total;
}
// Records whose own actions keep Unchained action-cost metadata.
const unchainedOwn = [
  'pf1/10sYHJgoPNRINvIs', // Talisman of Life's Breath, Greater
  'pf1/18ucrDrOpyJ9PPtz', // Talisman of Freedom, Lesser
  'pf1/1pVnewyLQzxMm5Of', // Talisman of Beneficial Winds, Greater
  'pf1/1xX9RpN7lE1Kmb90', // Talisman of Warrior's Courage, Greater
  'pf1/22BilpOY4Ojtp65W', // Talisman of Beneficial Winds, Lesser
  'pf1/2ESkDCUMqdZADvED', // Scarring Metamagic Rod, Lesser
  'pf1/2PN3qewFLwGkAfIv', // Ghast retch flask
  'pf1/3JXrO94ufjK2cPaS', // Furious Metamagic Rod, Greater
  'pf1/3X5eQAn1loq3zLoa', // Traumatic Metamagic Rod
  'pf1/4LACHLj32eNPEUus', // Scarring Metamagic Rod
  'pf1/4RYxDQnoD1b3q0hl', // Scarring Metamagic Rod, Greater
  'pf1/4wl3M4JRW3XUlC9l', // Unholy water
  'pf1/59DIqzsv39rBeDyL', // Shriek bomb
  'pf1/642TKruPm8EBSJnX', // Grappling hook, mithral
  'pf1/6DhqaqxvKCOCRY4h', // Rod of Wonder
  'pf1/75BtLXILwFjnYiej', // Staff of Healing
  'pf1/7P3H1yV8835Am6c6', // Lucky Horseshoe
  'pf1/7akkjTZmcW9TIqTr', // Traumatic Metamagic Rod, Lesser
  'pf1/7nKTn2r7YQhpkM54', // Furious Metamagic Rod
  'pf1/8BQVjVwWEEOHMlNJ', // Shrunken Head
  'pf1/8Ll266amCrQtdH9Q', // Four-Leaf Clover
  'pf1/8MBgNjcE2qdluyCF', // Alchemical Coal (choking smoke)
  'pf1/8PD72Rs10gjUYGq4', // Logical Metamagic Rod, Greater
];
// Containers whose embedded item records (their contents) keep it; the
// importer doesn't import them, so they lie outside the bound closure and
// require no PZO1131 (#430 review).
const kits = [
  'pf1/0A67B0qcuGhlLnPK', // Kit, Psychic's
  'pf1/3QoyxChtFEAw4TUj', // Kit, Occultist's
  'pf1/6yfwD4QhSsmXaCUX', // Grooming Kit
  'pf1/8gOHyRFOj2K0F0Qj', // Kit, Witch's
  'pf1/9IQU7ZRO4KhglOV0', // Kit, Gunslinger's
  'pf1/9NkBjZfztOP8qgsY', // Kit, Inquisitor's
];
// Records whose bound closure reaches a linked body that keeps it (the
// spells, feats, races and items their descriptions link).
const unchainedBound = [
  'pf1/0AIz2Gk74uaiLQIh', // Ring of Protection +2
  'pf1/10sYHJgoPNRINvIs', // Talisman of Life's Breath, Greater
  'pf1/18ucrDrOpyJ9PPtz', // Talisman of Freedom, Lesser
  'pf1/1hPPkMMfEuJha8YB', // Belt of Physical Might +4 (Str & Dex)
  'pf1/1pVnewyLQzxMm5Of', // Talisman of Beneficial Winds, Greater
  'pf1/22BilpOY4Ojtp65W', // Talisman of Beneficial Winds, Lesser
  'pf1/2rDdqODASJmbq7WP', // Cloak of Resistance +3
  'pf1/3jgVeXbVIQdRutRM', // Headband of Alluring Charisma +6
  'pf1/4wl3M4JRW3XUlC9l', // Unholy water
  'pf1/5F06HJzeAlqTOot1', // Amulet of Natural Armor +2
  'pf1/5ZivT8vBANjQLueE', // Belt of Mighty Constitution +2
  'pf1/69OvRQZBk0nhhpAK', // Outfit, Dilettante's
  'pf1/6JNWUofyniDkjhjk', // Belt of Incredible Dexterity +4
  'pf1/75BtLXILwFjnYiej', // Staff of Healing
  'pf1/7r3OittOtOxLNlKS', // Bracers of Armor +4
  'pf1/7wVpGfxaz1Jv0pBA', // Ring of the Hidden Psyche
  'pf1/8BQVjVwWEEOHMlNJ', // Shrunken Head
  'pf1/9FJz9ZJ1r4pbZBIU', // Caltrops (Cold Iron)
  'pf1/9KkspSc1gaif4kzP', // Amulet of Natural Armor +5
  'pf1/9Uxwqax0pLPyT2j7', // Amulet of Natural Armor +1
  'pf1/At9EUYmQrLCwIDKg', // Bag of Holding (Type IV)
  'pf1/BP3w8KlGr97WYNe8', // Belt of Physical Might +6 (Str & Dex)
];

it('resolves the reviewed item bonuses through the public resolver', () => {
  // Defense: ring of protection +2 deflection, amulet +2 enhancement to
  // natural armor, bracers +4 armor and the ioun stone's +1 insight, beside
  // the held entertainer's outfit (it adds nothing).
  const worn = calculateCharacterSheet(
    itemSheet({
      items: [
        ENTERTAINERS_OUTFIT,
        RING_OF_PROTECTION,
        AMULET_2,
        BRACERS,
        IOUN_STONE,
      ],
    }),
  );
  // The bracers' +4 armor bonus Modifier (#762); deflection and insight
  // land on ac.other.
  expect(worn.breakdowns['ac.armor'].total).toBe(4);
  expect(worn.breakdowns['ac.natural'].total).toBe(2);
  expect(worn.breakdowns['ac.other'].total).toBe(3);
  expect(worn.derivedStatistics.ac.total).toBe(19);
  expect(worn.derivedStatistics.touchAc.total).toBe(13);
  expect(worn.equipment.nonproficiencyAttackPenalty).toBe(0);
  const outfitOnly = calculateCharacterSheet(
    itemSheet({ items: [ENTERTAINERS_OUTFIT] }),
  );
  expect(outfitOnly.derivedStatistics.ac.total).toBe(10);
  expect(outfitOnly.equipment).toMatchObject({
    armorCheckPenalty: 0,
    spellFailure: 0,
    maxDexterityBonus: null,
    nonproficiencyAttackPenalty: 0,
  });
  // Saves: the cloak's +3 resistance (the reviewed record supplies it; the
  // raw "resist" change is unsupported) and the horseshoe's +1 luck stack.
  const saves = calculateCharacterSheet(
    itemSheet({ items: [CLOAK, HORSESHOE] }),
  );
  for (const save of ['save.fort', 'save.ref', 'save.will'] as const)
    expect(saves.breakdowns[save].total, save).toBe(4);
  expect(
    entry(CLOAK).unsupported.some(
      (row) =>
        row.field === 'changes' &&
        JSON.stringify(row.value) ===
          JSON.stringify({
            target: 'allSavingThrows',
            formula: '3',
            type: 'resist',
          }),
    ),
  ).toBe(true);
  // Abilities: enhancement bonuses don't stack, so Dexterity takes +4 once
  // from the two belts; Strength +4 from the belt of physical might.
  const belts = calculateCharacterSheet(
    itemSheet({
      items: [DEXTERITY_BELT, MIGHT_BELT],
      scores: { strength: 12, dexterity: 14 },
    }),
  );
  expect(belts.breakdowns['ability.dex'].total).toBe(18);
  expect(belts.breakdowns['ability.str'].total).toBe(16);
  // Situation-gated item bonuses: nothing without their Situation, the value
  // with it.
  for (const [name, target, value] of [
    ["Psychometrist's Gloves", 'skill.apr', 2],
    ['Portable Sweat Lodge', 'skill.hea', 2],
    ['Saddle (exotic, military)', 'skill.rid', 2],
    ["Outfit, Dilettante's", 'skill.slt', 2],
    ["Thieves' tool extenders, mithral", 'skill.dev', -4],
    ['Bell net', 'skill.ste', -2],
    ['Outfit, Companion Cold-Weather', 'save.fort', 5],
    ['Dusty Rose Prism Ioun Stone', 'cmb', 1],
    ['Hoodwink Cowl', 'skill.per', -10],
    ['Shrunken Head', 'spellDC', 1],
  ] as const) {
    expect(resolved(name, target), `${name} ${target}`).toBe(0);
    expect(
      resolved(name, target, situationsOn(name, target)),
      `${name} ${target}`,
    ).toBe(value);
  }
  // The psychometrist's gloves' −2 reaches any skill check that needs the
  // hands, under its own Situation, apart from the Appraise bonus.
  const [handsPenalty] = situationsOn("Psychometrist's Gloves", 'skills') as [
    string,
  ];
  expect(resolved("Psychometrist's Gloves", 'skill.dis', [handsPenalty])).toBe(
    -2,
  );
  expect(resolved("Psychometrist's Gloves", 'skill.apr', [handsPenalty])).toBe(
    -2,
  );
  // Mithral manacles: the restrained creature's penalties, frontal and rear
  // restraint exclusive; picking the lock is its own check.
  const [frontalAttack] = situationsOn('Manacles, mithral', 'attack') as [
    string,
  ];
  const [frontalSkills, rearSkills] = situationsOn(
    'Manacles, mithral',
    'skills',
  ) as [string, string];
  const [frontalLock, rearLock] = situationsOn(
    'Manacles, mithral',
    'skill.dev',
  ) as [string, string];
  expect(resolved('Manacles, mithral', 'attack.melee')).toBe(0);
  expect(resolved('Manacles, mithral', 'skill.esc')).toBe(0);
  expect(resolved('Manacles, mithral', 'attack.melee', [frontalAttack])).toBe(
    -4,
  );
  expect(resolved('Manacles, mithral', 'skill.esc', [frontalSkills])).toBe(-5);
  expect(resolved('Manacles, mithral', 'skill.dev', [frontalLock])).toBe(-15);
  expect(resolved('Manacles, mithral', 'skill.esc', [rearSkills])).toBe(-10);
  expect(resolved('Manacles, mithral', 'skill.dev', [rearLock])).toBe(-25);
  expect(frontalLock).toContain('frontal restraint');
  expect(rearLock).toContain('rear restraint');
  // The companion outfit's +5 is a circumstance bonus, as its note and body
  // state (the drafter read it as untyped).
  expect(modifiers('Outfit, Companion Cold-Weather')).toMatchObject([
    {
      target: 'save.fort',
      bonusType: 'circumstance',
      value: 5,
      condition: { situation: { local: 'against exposure to cold weather' } },
    },
  ]);
  // Concealable thieves' tools: +2 circumstance on Disable Device always (as
  // masterwork thieves' tools); +4 on Sleight of Hand only to conceal them.
  expect(resolved("Thieves' Tools, concealable", 'skill.dev')).toBe(2);
  expect(resolved("Thieves' Tools, concealable", 'skill.slt')).toBe(0);
  expect(
    resolved(
      "Thieves' Tools, concealable",
      'skill.slt',
      situations("Thieves' Tools, concealable"),
    ),
  ).toBe(4);
  // The planchette's two Linguistics bonuses are mutually exclusive.
  const [automatic, haunt] = situations('Automatic writing planchette') as [
    string,
    string,
  ];
  expect(resolved('Automatic writing planchette', 'skill.lin')).toBe(0);
  expect(
    resolved('Automatic writing planchette', 'skill.lin', [automatic]),
  ).toBe(2);
  expect(resolved('Automatic writing planchette', 'skill.lin', [haunt])).toBe(
    4,
  );
  // The lucky horseshoe: +1 luck while carried; invoking it gives +4 luck,
  // which doesn't stack with the +1.
  expect(resolved('Lucky Horseshoe', 'save.will')).toBe(1);
  expect(
    resolved('Lucky Horseshoe', 'save.will', situations('Lucky Horseshoe')),
  ).toBe(4);
  // The four-leaf clover: +2 luck on one save or skill check, both under one
  // Situation.
  expect(new Set(situations('Four-Leaf Clover')).size).toBe(1);
  expect(resolved('Four-Leaf Clover', 'save.ref')).toBe(0);
  expect(resolved('Four-Leaf Clover', 'skill.acr')).toBe(0);
  expect(
    resolved('Four-Leaf Clover', 'save.ref', situations('Four-Leaf Clover')),
  ).toBe(2);
  expect(
    resolved('Four-Leaf Clover', 'skill.acr', situations('Four-Leaf Clover')),
  ).toBe(2);
  // Reviewed change replacements: the masterwork tools' and instrument's raw
  // +2 on every Craft or Perform check imports as 0; the +2 applies only
  // under "made with them".
  for (const [key, target, formula] of [
    [ARTISANS_TOOLS, 'skill.crf', '2'],
    [INSTRUMENT, 'skill.prf', '2'],
  ] as const) {
    expect(
      findReviewedReplacementFormula(key, {
        target,
        formula,
        type: 'circumstance',
      }),
    ).toBe('0');
    expect(resolved(key, target), key).toBe(0);
    expect(resolved(key, target, situations(key)), key).toBe(2);
    expect(modifiers(key)[0]).toMatchObject({ target, value: 0 });
  }
  // No armor, shield or natural armor bonus sits on ac.other.
  for (const row of preview.entries)
    for (const modifier of row.modifiers)
      if (['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType))
        expect(modifier.target, row.name).not.toBe('ac.other');
});

it('validates every item’s statistics, Base Item, defaults and end state against the pinned record and PCGen', () => {
  for (const row of assessedItems) {
    const gear = row.mechanicsReview.gearReview;
    const mapped = entry(row.externalKey);
    const value = Object.fromEntries(
      gear.statistics.map((stat) => [stat.field, stat.mapped]),
    );
    expect(value.price, row.name).toBe(mapped.detail.price);
    expect(value.weight, row.name).toBe(mapped.detail.weight);
    // #762: real armor's bonus is its armor block's; a non-armor item's
    // armor value is an armor-bonus Modifier on ac.armor; a material-only
    // block (clothing, wondrous items) imports as neither, +0.
    const armorBonus =
      mapped.detail.armor?.bonus ??
      mapped.modifiers.find(
        (modifier) =>
          modifier.target === 'ac.armor' && modifier.bonusType === 'armor',
      )?.value;
    if ('armorBonus' in value)
      expect(value.armorBonus, row.name).toBe(armorBonus ?? 0);
    else expect(armorBonus, row.name).toBeUndefined();
    expect('rangeIncrement' in value, row.name).toBe(
      Boolean(mapped.detail.weapon),
    );
    expect(gear.itemKind, row.name).toBe(row.itemKind);
    expect(gear.statisticsAgree, row.name).toBe(
      gear.statistics.every((stat) => stat.agrees !== false),
    );
    expect(gear.disagreements, row.name).toEqual(
      gear.statistics
        .filter((stat) => stat.agrees === false)
        .map((stat) => stat.field),
    );
    expect(gear.defaults ?? null, row.name).toEqual(
      mapped.detail.magic ?? null,
    );
    expect(gear.endState.length, row.name).toBeGreaterThan(0);
    for (const field of gear.disagreements)
      expect(
        row.mechanicsReview.sourceDiscrepancies.some((text) =>
          text
            .toLowerCase()
            .includes(field === 'casterLevel' ? 'caster level' : field),
        ),
        `${row.name} ${field}`,
      ).toBe(true);
  }
  // The statistics PCGen disagrees on, each a recorded discrepancy.
  expect(
    Object.fromEntries(
      assessedItems
        .filter((row) => !row.mechanicsReview.gearReview.statisticsAgree)
        .map((row) => [
          row.name,
          row.mechanicsReview.gearReview.statistics
            .filter((stat) => stat.agrees === false)
            .map((stat) => [stat.field, stat.pinned, stat.pcgen]),
        ]),
    ),
  ).toEqual({
    "Kit, Psychic's": [
      ['price', 0, 35],
      ['weight', 0, 27],
    ],
    'Ring of Protection +2': [['casterLevel', 6, 5]],
    'Ghast retch flask': [['handedness', 'splash', ['ranged']]],
    'Cloak of Resistance +3': [['casterLevel', 9, 5]],
    "Kit, Occultist's": [
      ['price', 0, 45],
      ['weight', 0, 32.5],
    ],
    'Shriek bomb': [['handedness', 'splash', ['ranged']]],
    'Amulet of Natural Armor +2': [['casterLevel', 6, 5]],
    'Grappling hook, mithral': [['price', 1001, 2001]],
    "Outfit, Dilettante's": [['weight', 8, 2]],
    'Grooming Kit': [['weight', 1.3, 2]],
    "Kit, Witch's": [
      ['price', 0, 21],
      ['weight', 0, 21],
    ],
    "Kit, Gunslinger's": [
      ['price', 0, 26],
      ['weight', 0, 31],
    ],
    'Amulet of Natural Armor +5': [['casterLevel', 15, 5]],
    "Kit, Inquisitor's": [
      ['price', 0, 30],
      ['weight', 0, 34],
    ],
    "Fortune-teller's deck": [['weight', 0.1, 0.5]],
  });
  // The outfit matches its Core Rulebook row in price and weight.
  expect(
    candidate(ENTERTAINERS_OUTFIT).mechanicsReview.gearReview.statistics.map(
      (stat) => [stat.field, stat.pinned, stat.pcgen, stat.agrees],
    ),
  ).toEqual([
    ['price', 3, 3, true],
    ['weight', 4, 4, true],
    ['armorBonus', 0, null, null],
  ]);
  // #762: no item in the batch is armor. The clothing and wondrous items'
  // material-only armor blocks import as nothing; the bracers' +4 is an
  // armor-bonus Modifier (CRB p. 504), not worn armor.
  expect(
    preview.entries.filter(
      (row) => row.detail.kind === 'item' && row.detail.armor,
    ),
  ).toEqual([]);
  expect(entry(BRACERS).modifiers).toEqual([
    { target: 'ac.armor', bonusType: 'armor', value: 4 },
  ]);
  // Kits import with no price, weight or contents.
  for (const row of assessedItems.filter((row) => row.itemKind === 'kit'))
    if (row.name !== 'Grooming Kit')
      expect(entry(row.externalKey).detail, row.name).toMatchObject({
        price: 0,
        weight: 0,
      });
  // The splash weapons' shape is the importer's fallback (#761).
  for (const name of ['Ghast retch flask', 'Unholy water', 'Shriek bomb'])
    expect(entry(name).detail.weapon, name).toMatchObject({
      proficiency: 'always',
      handedness: 'splash',
      dice: null,
    });
});

it('checks every description and required note record against the pinned bodies', () => {
  let descriptions = 0;
  for (const row of assessedItems) {
    const records = row.mechanicsReview.curationRecords;
    const [description, ...notes] = records;
    descriptions++;
    expect(description, row.name).toMatchObject({
      kind: 'description',
      status: 'checked',
      diagnostics: [],
      text: row.mechanicsReview.descriptionText,
    });
    for (const note of notes)
      expect(note, row.name).toMatchObject({
        kind: 'note',
        status: 'checked',
        diagnostics: [],
      });
    // Every Note is the body's own sentences, sanitized.
    const texts = (entry(row.externalKey).situationalNotes ?? []).map(
      (note) => note.text,
    );
    for (const record of records)
      for (const output of record.outputs)
        if (output.kind === 'note') {
          expect(texts, row.name).toContain(output.text);
          expect(output.text, row.name).not.toMatch(/@UUID|@Condition|@Save/);
        }
    for (const text of row.mechanicsReview.outstandingCalculations)
      expect(row.holdIds.join(' '), row.name).not.toContain(text);
  }
  expect(descriptions).toBe(96);
  // The two required note records: the companion outfit and the concealable
  // thieves' tools.
  expect(
    assessedItems
      .filter((row) => row.mechanicsReview.curationRecords.length > 1)
      .map((row) => [
        row.name,
        row.mechanicsReview.curationRecords.slice(1).map((r) => r.target),
      ]),
  ).toEqual([
    ['Outfit, Companion Cold-Weather', ['fort']],
    ["Thieves' Tools, concealable", ['skill.slt']],
  ]);
  // 29 bodies state no rule beyond their mapped statistics and changes (or
  // are empty): explicit covered/no-output description records.
  const covered = assessedItems.filter(
    (row) => !row.mechanicsReview.curationRecords[0]?.outputs.length,
  );
  expect(covered).toHaveLength(29);
  for (const row of covered)
    expect(
      row.mechanicsReview.curationRecords[0]?.rationale,
      row.name,
    ).toContain('Explicit covered/no-output');
  // The empty bodies (five class kits, the hairbrush and the spoon) bind the
  // empty text.
  expect(
    assessedItems
      .filter((row) => row.mechanicsReview.descriptionText === '')
      .map((row) => row.name)
      .sort(),
  ).toEqual([
    'Hairbrush',
    "Kit, Gunslinger's",
    "Kit, Inquisitor's",
    "Kit, Occultist's",
    "Kit, Psychic's",
    "Kit, Witch's",
    'Spoon',
  ]);
  // Notes on the statistic they qualify.
  for (const [name, targets] of [
    ['Headband of Alluring Charisma +6', ['ability.cha']],
    ['Lucky Horseshoe', ['saves']],
    ['Lock, average', ['skill.dev']],
    ['Signal Whistle', ['skill.per', 'skill.prf']],
    ["Kineticist's Diadem", ['damage']],
  ] as const)
    expect(
      entry(name)
        .situationalNotes?.map((note) => note.target)
        .sort(),
      name,
    ).toEqual(targets);
  // Readable enricher text: an unlabeled link reads as the linked name, a
  // condition and a save as Foundry shows them.
  expect(
    entry('Talisman of Freedom, Lesser').situationalNotes?.map((n) => n.text),
  ).toContain(
    'The first time that the wearer becomes grappled, entangled, or paralyzed, he is automatically affected by Freedom of Movement for 3 rounds.',
  );
  expect(
    entry('Ring of the Hidden Psyche').situationalNotes?.map((n) => n.text),
  ).toContain(
    'From inside the ring, she can attempt a Possession, Greater on anyone who voluntarily wears the ring (DC 23 Will negates).',
  );
});

it('records the cited, PCGen, inherited and Unchained notice dependencies and enforces every hold', () => {
  const held = new Map(heldNotices.map((row) => [row.id, row.notices]));
  const holdId = (book: string) => `items-430-notice-${book}-complete-chain`;
  for (const row of assessedItems) {
    expect(row.requiredNotices.at(-1), row.name).toBe('PZO1110');
    for (const cited of row.citedSources)
      expect(row.requiredNotices, row.name).toContain(cited.book);
    for (const comparison of [row.comparison, ...row.additionalComparisonLeads])
      if (comparison)
        expect(row.requiredNotices, row.name).toContain(comparison.book);
    for (const inherited of row.inheritedRuleNotices)
      expect(row.requiredNotices, row.name).toContain(inherited.book);
    for (const linked of row.linkedContentReview)
      for (const book of linked.sources)
        expect(row.requiredNotices, row.name).toContain(book.id);
    expect(row.disposition, row.name).toBe('held');
    if (row.externalKey === ENTERTAINERS_OUTFIT) {
      expect(row.requiredNotices, row.name).toEqual(['PZO1110']);
      expect(row.holdIds, row.name).toEqual([OUTFIT_HOLD]);
      expect(row.noticeHoldIds, row.name).toEqual([]);
      expect(row.noticeRequirementsComplete, row.name).toBe(true);
      expect(row.rationale).toContain('#762');
      continue;
    }
    expect(row.holdIds, row.name).toEqual([
      `items-430-whole-content-${row.externalKey.split('/')[1]}`,
    ]);
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices.filter((book) => book !== 'PZO1110').map(holdId),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  // Rejected rows add no book.
  expect(candidate(ENTERTAINERS_OUTFIT).rejectedRootComparisonEvidence).toEqual(
    [expect.objectContaining({ book: 'PZO1123' })],
  );
  expect(candidate('Amulet of Natural Armor +2').requiredNotices).not.toContain(
    'PZO9489',
  );
  expect(candidate('Gecko, riding (combat trained)').requiredNotices).toEqual([
    'PZO1123',
    'PZO1120',
    'PZO1112',
    'PZO1110',
  ]);
  // Inherited rules: the alchemist's formula book (Advanced Player's Guide)
  // and the Bestiary creatures and template the mounts point to.
  expect(
    Object.fromEntries(
      assessedItems
        .filter((row) =>
          row.inheritedRuleNotices.some((n) => n.book !== 'PZO1131'),
        )
        .map((row) => [
          row.name,
          row.inheritedRuleNotices
            .filter((n) => n.book !== 'PZO1131')
            .map((n) => n.book),
        ]),
    ),
  ).toEqual({
    'Formula Book': ['PZO1115'],
    'Dire Bat, riding': ['PZO1112'],
    'Horse, light (combat trained)': ['PZO1112'],
    'Dusty Rose Prism Ioun Stone': ['PZO1138'],
    Mastodon: ['PZO1112'],
    "Outfit, Dilettante's": ['PZO1121'],
    'Horse, light': ['PZO1112'],
    'Gecko, riding (combat trained)': ['PZO1120', 'PZO1112'],
  });
  // Unchained action-cost metadata anywhere in the bound closure (own or
  // linked) requires the held PZO1131; the kits' unimported contents don't.
  expect(
    assessedItems
      .filter((row) => row.requiredNotices.includes('PZO1131'))
      .map((row) => row.externalKey)
      .sort(),
  ).toEqual([...new Set([...unchainedOwn, ...unchainedBound])].sort());
  for (const row of assessedItems) {
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
      rules.some((rule) => rule.includes("item's own action")),
      row.name,
    ).toBe(own);
    expect(
      rules.some((rule) => rule.includes('embedded item records')),
      row.name,
    ).toBe(false);
    expect(
      rules.some((rule) => rule.includes('on the bound')),
      row.name,
    ).toBe(unchainedBound.includes(row.externalKey));
  }
  expect(candidate(ENTERTAINERS_OUTFIT).sourceFields.actions).toBeUndefined();
  // The kits keep their other holds (their cited book and unresolved wording).
  for (const key of kits) {
    const row = candidate(key);
    expect(row.requiredNotices, row.name).not.toContain('PZO1131');
    expect(row.requiredNotices.length, row.name).toBeGreaterThan(1);
    expect(row.holdIds, row.name).toEqual([
      `items-430-whole-content-${key.split('/')[1]}`,
    ]);
  }
  for (const row of review.noticeRequirements) {
    if (row.book === 'PZO1110') {
      expect(row.holdId).toBeNull();
      continue;
    }
    expect(held.get(row.holdId ?? ''), row.book).toEqual([
      row.book,
      ...row.registryKeys.filter((key) => key !== row.book),
    ]);
    for (const key of row.candidates)
      expect(candidate(key).noticeHoldIds).toContain(row.holdId);
  }
});

it('pins all 100 keys, the complete bodies and literal PCGen evidence in the shared store', async () => {
  expect(review.candidates).toHaveLength(100);
  expect(new Set(review.candidates.map((row) => row.externalKey)).size).toBe(
    100,
  );
  expect(review.counts).toEqual({
    total: 100,
    admitted: 0,
    held: 96,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 4,
    excludedFolders: 4,
    recordLevel35Holds: 0,
  });
  expect(excludedRows.map((row) => row.name).sort()).toEqual([
    'Class Kits',
    'Head',
    'Miscellaneous',
    'Wondrous Items',
  ]);
  for (const row of excludedRows) {
    const raw = upstreamRecord.parse(
      parse(await readPinned(row.source.repo, row.source.path)),
    );
    expect(raw._key, row.name).toBe(`!folders!${raw._id}`);
  }
  expect(preview.entries).toHaveLength(96);
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
    expect(entry(row.externalKey).sources).toEqual(row.citedSources);
    for (const linked of row.linkedContentReview)
      expect(sha(await readPinned(linked.repo, linked.path)), linked.name).toBe(
        linked.sha256,
      );
  }
  const files = new Map(
    review.comparisonSources.pcgenFiles.map((file) => [file.path, file.sha256]),
  );
  for (const [path, digest] of files) {
    const bytes = await readFile(`tests/fixtures/pinned/pcgen/${path}`);
    expect(sha(bytes), path).toBe(digest);
  }
  for (const row of assessedItems)
    for (const comparison of [
      row.comparison,
      ...row.additionalComparisonLeads,
      ...row.rejectedRootComparisonEvidence,
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
  // The outfit: a complete Core Rulebook row whose DESC is the body apart
  // from its dashes (complete attribution evidence; held only on #762).
  for (const key of [ENTERTAINERS_OUTFIT]) {
    const row = candidate(key);
    expect(row.comparison).toMatchObject({
      book: 'PZO1110',
      completeDirectComparison: true,
      evidenceRole: 'complete-root-comparison',
    });
    const desc = /\tDESC:([^\t]*)/.exec(row.comparison!.literalRow)?.[1];
    const words = (text: string) =>
      text
        .replace(/<[^>]+>/g, '')
        .replace(/[’']/g, "'")
        .replace(/[–-]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    expect(words(row.mechanicsReview.descriptionText)).toBe(words(desc ?? ''));
    expect(row.citedSources).toEqual([{ book: 'PZO1110', pages: '159, 161' }]);
    expect(row.linkedContentReview).toEqual([]);
  }
  // Records with no Paizo PCGen data row stay held on an unresolved origin.
  expect(
    assessedItems
      .filter((row) => !row.comparison)
      .map((row) => row.name)
      .sort(),
  ).toEqual([
    'Dung grenade',
    'Hairbrush',
    'Musical instrument, masterwork',
    'Spoon',
    'Treasure chest, large',
    'Unholy water',
  ]);
  for (const row of assessedItems.filter((row) => !row.comparison))
    expect(row.inheritedRuleUnresolvedOrigins[0], row.name).toMatch(
      /no PCGen data row at the pin names it/,
    );
});

it('reextracts the reviewed items from a clean shared fixture tree, holds every item on its own holds (the entertainer’s outfit only on #762)', async () => {
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
      required: 2,
      checked: 2,
      missing: 0,
      descriptions: { checked: 96 },
    });
    expect(
      artifact.catalog.entries.map((row) => row.externalKey).sort(),
    ).toEqual(assessedItems.map((row) => row.externalKey).sort());
    for (const row of artifact.catalog.entries) {
      const saved = entry(row.externalKey);
      expect(
        {
          detail: row.detail,
          modifiers: row.modifiers,
          situationalNotes: row.situationalNotes,
          sources: row.sources,
        },
        row.name,
      ).toEqual({
        detail: saved.detail,
        modifiers: saved.modifiers,
        situationalNotes: saved.situationalNotes,
        sources: saved.sources,
      });
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
    const ours = new Set(assessedItems.map((row) => row.externalKey));
    const gate = assessCatalogAdmission({
      artifact: authoritative,
      ...reviewedAdmission,
    });
    expect(
      gate.admitted
        .filter((row) => ours.has(row.externalKey))
        .map((row) => row.externalKey)
        .sort(),
    ).toEqual([]);
    const held = gate.held.filter((row) => ours.has(row.externalKey));
    for (const row of held)
      expect(row.reason, row.name).toBe(candidate(row.externalKey).rationale);
    // #738 keeps the three bodies' rules journal links as text, so none
    // fails on a reference: all 96 stay held.
    expect(
      gate.failures
        .filter((row) => ours.has(row.externalKey))
        .map((row) => [row.externalKey, row.reason]),
    ).toEqual([]);
    expect(held).toHaveLength(96);
    expect(
      held.find((row) => row.externalKey === ENTERTAINERS_OUTFIT)?.reason,
    ).toMatch(
      /^items-430-importer-gap-762-6kZGQ2chmr3jpS1t: held only on importer gap #762/,
    );
    for (const row of assessedItems) {
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
    // Confirming a held Core Rulebook item's whole content still holds it on
    // the held Ultimate Equipment and Unchained notices.
    const ring = candidate(RING_OF_PROTECTION);
    const confirmed = assessWithUnclearedHolds({
      artifact: authoritative,
      ...reviewedAdmission,
      assessments: reviewedAdmission.assessments.map((row) =>
        row.externalKey === ring.externalKey
          ? { ...row, status: 'confirmed' as const }
          : row,
      ),
    });
    expect(
      confirmed.admitted.some((row) => row.externalKey === ring.externalKey),
    ).toBe(false);
    expect(
      confirmed.held.find((row) => row.externalKey === ring.externalKey)
        ?.reason,
    ).toMatch(/Notice holds|Missing or unreviewed required notices/);
  } finally {
    await tree.dispose();
  }
});
