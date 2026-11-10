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
} from '../fixtures/items-431/data';
import { itemSheet } from '../fixtures/items-431/sheet';
import { materializePinnedTree, readPinned } from './pinned-sources';
import { bindSnapshotToCurrentNotices } from './batch-ownership';
import { assessWithUnclearedHolds } from './uncleared-holds';

const sha = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
// The two Core Rulebook outfits have complete attribution evidence but are
// held on importer gap #762 (fixed: they import no armor block), so none is
// admitted; a later curation step re-admits them.
const MONKS_OUTFIT = 'pf1/GFOu4GXWqb6MJQQJ';
const EXPLORERS_OUTFIT = 'pf1/LZLwdGasEUnMplnc';
const OUTFITS = [MONKS_OUTFIT, EXPLORERS_OUTFIT];
const outfitHold = (key: string) =>
  `items-431-importer-gap-762-${key.split('/')[1]}`;
const RING_4 = 'pf1/C8PhETwQQHuDKUkm';
const RING_5 = 'pf1/KgDc9RWXqD5kjKvV';
const BRACERS_6 = 'pf1/IjptxC4fEDAhYrZT';
const BRACERS_2 = 'pf1/KZXBvLHJCuiZKXBH';
const BLACK_ROBE = 'pf1/CSM3wLxqmR8qMpyT';
const WHITE_ROBE = 'pf1/Dt0WMY6EU7M3g6mo';
const CLOAK_1 = 'pf1/MrxwYWWezbJTZLog';
const FISTS_3 = 'pf1/CI3CpcXYVz080fLG';
const FISTS_2 = 'pf1/DimjKFI7EQ94npji';
const PERFECTION_BELT = 'pf1/MvIylLVVvfr3kcW2';
const VAST_INTELLIGENCE = 'pf1/FIMH8jUpVdQXyMBj';
const MENTAL_PROWESS = 'pf1/GCU0bHWSSxVS7D6r';
const TIN_CAP = 'pf1/KxHYgsJaMhsLI2Xu';
const ELVENKIND_CLOAK = 'pf1/HSF0j88RR9JeTaJi';
const SOFTPAW_BOOTS = 'pf1/Ex7CexjHoS3hrgnV';
const DUMMY = 'pf1/GgSzAvYJmdk5JGL6';
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
  return [
    ...new Set(
      modifiers(name).flatMap((row) => {
        const scope = row.condition?.situation;
        if (!scope) return [];
        if (typeof scope === 'string' || !('local' in scope))
          throw new Error('Expected a local Situation');
        return [scope.local];
      }),
    ),
  ];
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
  'pf1/CmjSKOVJuQnV8o3S', // Holy water
  'pf1/DcISfXbLcIizCfdw', // Candle of Spirit Protection
  'pf1/Ez4eElDTO2hPJ6mR', // Telescope (×250)
  'pf1/FQNlET5dTwb8AUfw', // Fearsome Metamagic Rod, Lesser
  'pf1/FWXND5fEGFxRMyCT', // Bone Burn
  'pf1/FpevsSvU0iGE07KG', // Gauntlet of Rust
  'pf1/G75rkRiJQipV9R9S', // Glove of Storing
  'pf1/HGF43OZjDpRz9gn1', // Miner's lantern
  'pf1/IZJf5qzSMUx4pV4Y', // Telescope (×50)
  'pf1/IztzOuUqOp2IjWoQ', // Talisman of Life's Breath, Lesser
  'pf1/JxHgV6hfdnV2PgAR', // Ring of Shooting Stars
  'pf1/KKjzpkMjCqFpkhIW', // Mask of the Mesmerist
  'pf1/M4oAiw7nLbLmPLuB', // Talisman of Good Fortune, Lesser
  'pf1/MmrLS7XTeJdRCQcI', // Blue Whinnis
  'pf1/Mok9ccK8bgFg8dmS', // Traumatic Metamagic Rod, Greater
  'pf1/MxTsmNfAx9OephZX', // Bag of Tricks, Rust
  'pf1/N9hOIkIXM7BbjQNU', // Furious Metamagic Rod, Lesser
];
// Kits whose embedded item records (their contents) keep it; the importer
// doesn't import them, so they lie outside the bound closure and require no
// PZO1131 (#430 review).
const kits = [
  'pf1/CDQCyfYfW9aneX9e', // Kit, Wizard's
  'pf1/CUhcL6yCE9VW0AXv', // Kit, Oracle's
  'pf1/E13qnAa0Fdu7mvcZ', // Kit, Paladin's
  'pf1/InAHKpiWiATsMJNe', // Kit, Shifter's
  'pf1/IvvqBUI4UMiY5XVQ', // Kit, Slayer's
  'pf1/J5sXKSqZLcTwqGJi', // Kit, Swashbuckler's
  'pf1/MpOdZs55Qg4Vg64a', // Kit, Mesmerist's
  'pf1/NKiPR96W8na5kPqG', // Kit, Vigilante's
];
// Records whose bound closure reaches a linked body that keeps it (the
// spells, feats and items their descriptions link).
const unchainedBound = [
  'pf1/C8PhETwQQHuDKUkm', // Ring of Protection +4
  'pf1/CI3CpcXYVz080fLG', // Amulet of Mighty Fists +3
  'pf1/CcTP6ZVjrYpY27jr', // Bracers of Armor +3
  'pf1/CmjSKOVJuQnV8o3S', // Holy water
  'pf1/DimjKFI7EQ94npji', // Amulet of Mighty Fists +2
  'pf1/EIeLm4PP9hnCG0TU', // Goggles of Elvenkind
  'pf1/FIMH8jUpVdQXyMBj', // Headband of Vast Intelligence +4
  'pf1/FpevsSvU0iGE07KG', // Gauntlet of Rust
  'pf1/G75rkRiJQipV9R9S', // Glove of Storing
  'pf1/GCU0bHWSSxVS7D6r', // Headband of Mental Prowess +6 (Wis & Cha)
  'pf1/Gq3iB3i4tG55AFbE', // Sensory Deprivation Hood
  'pf1/HGF43OZjDpRz9gn1', // Miner's lantern
  'pf1/HSF0j88RR9JeTaJi', // Cloak of Elvenkind
  'pf1/ID7M52CCxshLzAZ6', // Bag of Holding (Type III)
  'pf1/IjptxC4fEDAhYrZT', // Bracers of Armor +6
  'pf1/IztzOuUqOp2IjWoQ', // Talisman of Life's Breath, Lesser
  'pf1/JxHgV6hfdnV2PgAR', // Ring of Shooting Stars
  'pf1/K1PJo4dWwVcYbTp7', // Bag of Holding (Type I)
  'pf1/K4h9sOActP9IUd7R', // False Coin
  'pf1/KKjzpkMjCqFpkhIW', // Mask of the Mesmerist
  'pf1/KZXBvLHJCuiZKXBH', // Bracers of Armor +2
  'pf1/KgDc9RWXqD5kjKvV', // Ring of Protection +5
  'pf1/KjehdvYS9zI7rtDV', // Efficient Quiver
  'pf1/MrxwYWWezbJTZLog', // Cloak of Resistance +1
  'pf1/MvIylLVVvfr3kcW2', // Belt of Physical Perfection +4
  'pf1/MxTsmNfAx9OephZX', // Bag of Tricks, Rust
];

it('resolves the reviewed item bonuses through the public resolver', () => {
  // Defense: deflection bonuses don't stack (ring +5 over ring +4); armor
  // bonuses don't stack either, so the bracers' +6 wins over the robe's +5
  // armor bonus for an arcane spellcaster and the bracers' +2, beside the
  // held explorer's outfit (it adds nothing).
  const worn = calculateCharacterSheet(
    itemSheet({
      items: [EXPLORERS_OUTFIT, RING_4, RING_5, BRACERS_6, BRACERS_2],
    }),
  );
  expect(worn.breakdowns['ac.armor'].total).toBe(6);
  expect(worn.breakdowns['ac.other'].total).toBe(5);
  expect(worn.derivedStatistics.ac.total).toBe(21);
  expect(worn.derivedStatistics.touchAc.total).toBe(15);
  expect(worn.equipment.nonproficiencyAttackPenalty).toBe(0);
  for (const key of OUTFITS) {
    const outfitOnly = calculateCharacterSheet(itemSheet({ items: [key] }));
    expect(outfitOnly.derivedStatistics.ac.total, key).toBe(10);
    expect(outfitOnly.equipment, key).toMatchObject({
      armorCheckPenalty: 0,
      spellFailure: 0,
      maxDexterityBonus: null,
      nonproficiencyAttackPenalty: 0,
    });
  }
  // The robes: Foundry's untyped +5 on armor AC imports as 0 (a reviewed
  // change replacement); the +5 armor bonus and +4 resistance bonus apply
  // for an arcane spellcaster, under one Situation, and the armor bonus
  // doesn't stack with the bracers.
  for (const robe of [BLACK_ROBE, WHITE_ROBE]) {
    expect(
      findReviewedReplacementFormula(robe, {
        target: 'aac',
        formula: '5',
        type: 'untyped',
      }),
    ).toBe('0');
    expect(modifiers(robe)[0]).toMatchObject({
      target: 'ac.armor',
      bonusType: 'untyped',
      value: 0,
    });
    const [arcane, ...rest] = situationsOn(robe, 'ac');
    expect(rest, robe).toEqual([]);
    expect(arcane, robe).toBe('worn by an arcane spellcaster');
    expect(resolved(robe, 'ac.armor'), robe).toBe(0);
    expect(resolved(robe, 'ac.armor', [arcane!]), robe).toBe(5);
    expect(resolved(robe, 'save.will'), robe).toBe(0);
    expect(resolved(robe, 'save.will', [arcane!]), robe).toBe(4);
    const [overcome] = situationsOn(robe, 'casterLevel') as [string];
    expect(overcome).toContain('to overcome spell resistance');
    expect(resolved(robe, 'casterLevel', [overcome]), robe).toBe(2);
  }
  // Saves: the cloak of resistance +1 (the reviewed record supplies it; the
  // raw "resist" change is unsupported); resistance bonuses don't stack, so
  // the robe's +4 wins for an arcane spellcaster.
  const cloak = calculateCharacterSheet(itemSheet({ items: [CLOAK_1] }));
  for (const save of ['save.fort', 'save.ref', 'save.will'] as const)
    expect(cloak.breakdowns[save].total, save).toBe(1);
  expect(
    entry(CLOAK_1).unsupported.some(
      (row) =>
        row.field === 'changes' &&
        JSON.stringify(row.value) ===
          JSON.stringify({
            target: 'allSavingThrows',
            formula: '1',
            type: 'resist',
          }),
    ),
  ).toBe(true);
  expect(
    resolveSheet([...modifiers(CLOAK_1), ...modifiers(BLACK_ROBE)], {
      situations: [
        {
          local: 'worn by an arcane spellcaster',
          sheetEntryId: BLACK_ROBE,
        },
      ],
    })['save.ref'].total,
  ).toBe(4);
  // Abilities: the belt's +4 on the three physical scores, the headbands'
  // enhancement bonuses, and the tin cap's −2 to Intelligence, Wisdom and
  // Charisma (the reviewed record supplies it; the raw "intPen" changes are
  // unsupported), which stack with them.
  const abilities = calculateCharacterSheet(
    itemSheet({
      items: [PERFECTION_BELT, VAST_INTELLIGENCE, MENTAL_PROWESS, TIN_CAP],
      scores: { strength: 12, dexterity: 14 },
    }),
  );
  expect(abilities.breakdowns['ability.str'].total).toBe(16);
  expect(abilities.breakdowns['ability.dex'].total).toBe(18);
  expect(abilities.breakdowns['ability.con'].total).toBe(14);
  expect(abilities.breakdowns['ability.int'].total).toBe(12);
  expect(abilities.breakdowns['ability.wis'].total).toBe(14);
  expect(abilities.breakdowns['ability.cha'].total).toBe(14);
  expect(
    entry(TIN_CAP)
      .unsupported.filter((row) => row.field === 'changes')
      .map((row) => (row.value as { target: string }).target),
  ).toEqual(['intPen', 'wisPen', 'chaPen']);
  // The tin cap's +4 insight on saves against mind-affecting effects (the
  // shared Situation, an exact match) and information-gathering divinations
  // (a local one); insight bonuses don't stack.
  expect(modifiers(TIN_CAP)[0]?.condition).toEqual({
    situation: 'mindAffecting',
  });
  const [divination] = situationsOn(TIN_CAP, 'saves') as [string];
  const cap = (selected: (string | { local: string })[]) =>
    resolveSheet(modifiers(TIN_CAP), {
      situations: selected.map((scope) =>
        typeof scope === 'string' ? scope : { ...scope, sheetEntryId: TIN_CAP },
      ),
    })['save.will'].total;
  expect(cap([])).toBe(0);
  expect(cap(['mindAffecting'])).toBe(4);
  expect(cap([{ local: divination }])).toBe(4);
  expect(cap(['mindAffecting', { local: divination }])).toBe(4);
  // Amulets of mighty fists: the enhancement bonus reaches only the unarmed
  // strike and natural attacks ($unarmedOrNatural), never the sheet-level
  // attack statistics; the raw "nattack" changes are unsupported.
  for (const [key, bonus] of [
    [FISTS_3, 3],
    [FISTS_2, 2],
  ] as const) {
    expect(modifiers(key).map((row) => row.condition)).toEqual([
      { weapon: '$unarmedOrNatural' },
      { weapon: '$unarmedOrNatural' },
    ]);
    expect(modifiers(key).map((row) => [row.target, row.value])).toEqual([
      ['attack', bonus],
      ['damage', bonus],
    ]);
    expect(resolved(key, 'attack.melee'), key).toBe(0);
  }
  // Reviewed change replacements: the raw bonus on every check imports as 0;
  // the bonus applies only under the body's condition.
  for (const [key, target, formula, type, value] of [
    [ELVENKIND_CLOAK, 'skill.ste', '5', 'competence', 5],
    [SOFTPAW_BOOTS, 'skill.ste', '1', 'circumstance', 1],
    [DUMMY, 'skill.prf', '2', 'circumstance', 2],
  ] as const) {
    expect(findReviewedReplacementFormula(key, { target, formula, type })).toBe(
      '0',
    );
    expect(modifiers(key)[0]).toMatchObject({ target, value: 0 });
    expect(resolved(key, target), key).toBe(0);
    expect(resolved(key, target, situationsOn(key, target)), key).toBe(value);
  }
  // Situation-gated item bonuses: nothing without their Situation, the value
  // with it.
  for (const [name, target, value] of [
    ['Saddle (military)', 'skill.rid', 2],
    ['Goggles of Elvenkind', 'skill.spl', 5],
    ['Gloves of Elvenkind', 'concentration', 5],
    ["Artist's Poster", 'skill.dip', 1],
    ['Hypnotist’s locket (locket)', 'skill.dip', 2],
    ['Parasol, umbrella', 'save.fort', 1],
    ['Telescope (×250)', 'skill.per', 6],
    ['Telescope (×250)', 'skill.kge', 6],
    ['Telescope (×50)', 'skill.per', 4],
    ['Telescope (×50)', 'skill.kge', 4],
    ['Sensory Deprivation Hood', 'skill.per', -10],
    ['False Coin', 'save.will', -1],
  ] as const) {
    expect(resolved(name, target), `${name} ${target}`).toBe(0);
    expect(resolved(name, target, situations(name)), `${name} ${target}`).toBe(
      value,
    );
  }
  // The gloves of elvenkind keep their mapped +5 on every Spellcraft check.
  expect(resolved('Gloves of Elvenkind', 'skill.spl')).toBe(5);
  // The goggles' +5 is a competence bonus, as the body (its "compentence")
  // and PCGen state; the drafter read it as untyped.
  expect(modifiers('Goggles of Elvenkind')).toMatchObject([
    { target: 'skill.spl', bonusType: 'competence', value: 5 },
  ]);
  // The softpaw boots' +2 tracking DC is another creature's check: a Note.
  expect(situationsOn(SOFTPAW_BOOTS, 'skill.ste')).toHaveLength(1);
  expect(entry(SOFTPAW_BOOTS).situationalNotes?.map((n) => n.text)).toContain(
    'Furthermore, the DC to notice or follow the tracks of a catfolk wearing softpaw boots increases by +2.',
  );
  // Aura goggles: −2 on sight-based Perception while worn, +2 circumstance
  // for read aura after removal; the two Situations are exclusive.
  const [wearing, removed] = situationsOn('Aura Goggles', 'skill.per') as [
    string,
    string,
  ];
  expect(resolved('Aura Goggles', 'skill.per')).toBe(0);
  expect(resolved('Aura Goggles', 'skill.per', [wearing])).toBe(-2);
  expect(resolved('Aura Goggles', 'skill.per', [removed])).toBe(2);
  // The talking board's two Linguistics bonuses are different uses.
  const [automatic, haunt] = situationsOn('Talking Board', 'skill.lin') as [
    string,
    string,
  ];
  expect(resolved('Talking Board', 'skill.lin')).toBe(0);
  expect(resolved('Talking Board', 'skill.lin', [automatic])).toBe(2);
  expect(resolved('Talking Board', 'skill.lin', [haunt])).toBe(4);
  // Luglurch ale: a halfling's −2 Perception and +1 Reflex and Acrobatics
  // share one Situation.
  const [drunk, ...others] = situations('Luglurch Ale (mug)');
  expect(others).toEqual([]);
  for (const [target, value] of [
    ['skill.per', -2],
    ['save.ref', 1],
    ['skill.acr', 1],
  ] as const) {
    expect(resolved('Luglurch Ale (mug)', target)).toBe(0);
    expect(resolved('Luglurch Ale (mug)', target, [drunk!])).toBe(value);
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
    'Ring of Protection +4': [['casterLevel', 12, 5]],
    "Kit, Wizard's": [
      ['price', 0, 21],
      ['weight', 0, 21],
    ],
    "Kit, Oracle's": [
      ['price', 0, 9],
      ['weight', 0, 29],
    ],
    'Luglurch Ale (mug)': [
      ['price', 1, 0.4],
      ['weight', 8, 1],
    ],
    'Holy water': [['handedness', 'splash', ['ranged']]],
    "Kit, Paladin's": [
      ['price', 0, 11],
      ['weight', 0, 30],
    ],
    'Softpaw boots': [
      ['price', 50, 25],
      ['weight', 4, 1],
    ],
    'Bloodvine Rope': [['price', 10, 200]],
    'Ring of Protection +5': [['casterLevel', 15, 5]],
    "Kit, Mesmerist's": [
      ['price', 0, 35],
      ['weight', 0, 26.5],
    ],
    'Bag of Tricks, Rust': [['casterLevel', 3, 5]],
    "Kit, Vigilante's": [
      ['price', 0, 8],
      ['weight', 0, 22],
    ],
  });
  // The outfits match their Core Rulebook rows in price and weight.
  for (const [key, price, weight] of [
    [MONKS_OUTFIT, 5, 2],
    [EXPLORERS_OUTFIT, 10, 8],
  ] as const)
    expect(
      candidate(key).mechanicsReview.gearReview.statistics.map((stat) => [
        stat.field,
        stat.pinned,
        stat.pcgen,
        stat.agrees,
      ]),
    ).toEqual([
      ['price', price, price, true],
      ['weight', weight, weight, true],
      ['armorBonus', 0, null, null],
    ]);
  // #762: no item in the batch is armor. The clothing and wondrous items'
  // material-only armor blocks import as nothing; each bracers' value is an
  // armor-bonus Modifier (CRB p. 504), not worn armor. The review's end state
  // still records the gap on the records it named.
  expect(
    preview.entries.filter(
      (row) => row.detail.kind === 'item' && row.detail.armor,
    ),
  ).toEqual([]);
  for (const [name, bonus] of [
    ['Bracers of Armor +2', 2],
    ['Bracers of Armor +3', 3],
    ['Bracers of Armor +6', 6],
  ] as const)
    expect(entry(name).modifiers, name).toEqual([
      { target: 'ac.armor', bonusType: 'armor', value: bonus },
    ]);
  for (const name of [
    'Bracers of Armor +2',
    'Bracers of Armor +3',
    'Bracers of Armor +6',
    'Cloak of Resistance +1',
    "Explorer's outfit",
    'Headband of Mental Prowess +6 (Wis & Cha)',
    'Headband of Vast Intelligence +4',
    "Monk's outfit",
    "Outfit, Burglar's",
    'Ring of Protection +4',
    'Ring of Protection +5',
  ])
    expect(
      candidate(name).mechanicsReview.outstandingCalculations.join(' '),
      name,
    ).toContain('#762');
  // Kits import with no price, weight or contents.
  for (const key of kits)
    expect(entry(key).detail, key).toMatchObject({ price: 0, weight: 0 });
  // The splash weapons' shape is the importer's fallback (#761).
  for (const name of ['Holy water', 'Bone Burn'])
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
  expect(descriptions).toBe(94);
  // The twelve required note records, by target.
  expect(
    assessedItems
      .filter((row) => row.mechanicsReview.curationRecords.length > 1)
      .map((row) => [
        row.name,
        row.mechanicsReview.curationRecords.slice(1).map((r) => r.target),
      ]),
  ).toEqual([
    ['Robe of the Archmagi (Black)', ['cl']],
    ['Parasol, umbrella', ['fort']],
    ['Robe of the Archmagi (White)', ['cl']],
    ['Goggles of Elvenkind', ['skill.spl']],
    ['Softpaw boots', ['skill.ste']],
    ['Telescope (×250)', ['skill.per']],
    ['Gauntlet of Rust', ['allSavingThrows']],
    ['Telescope (×50)', ['skill.per']],
    ["Artist's Poster", ['skill.dip']],
    ['Hypnotist’s locket (locket)', ['skill.dip']],
    ['Gloves of Elvenkind', ['concentration']],
    ['Tin Cap', ['allSavingThrows']],
  ]);
  // Bodies that state no rule beyond their mapped statistics and changes (or
  // are empty): explicit covered/no-output description records.
  const covered = assessedItems.filter(
    (row) => !row.mechanicsReview.curationRecords[0]?.outputs.length,
  );
  expect(covered.map((row) => row.name).sort()).toEqual([
    'Anvil, farrier (50 lbs)',
    'Ball (10 in)',
    'Board Game',
    'Bracers of Armor +2',
    'Bracers of Armor +3',
    'Bracers of Armor +6',
    'Cage, tiny',
    'Camel',
    'Censer',
    'Chewing Stick',
    'Comb',
    "Explorer's outfit",
    'Gloves of Elvenkind',
    'Hourglass (6 seconds)',
    'Hypnotist’s locket (locket)',
    'Ioun Torch',
    "Kit, Mesmerist's",
    "Kit, Oracle's",
    "Kit, Paladin's",
    "Kit, Shifter's",
    "Kit, Slayer's",
    "Kit, Swashbuckler's",
    "Kit, Vigilante's",
    "Kit, Wizard's",
    'Knife',
    "Monk's outfit",
    "Outfit, Burglar's",
    'Parasol, umbrella',
    'Pony (combat trained)',
    'Ring of Protection +4',
    'Ring of Protection +5',
    'Scissors',
    'Snorkel, masterwork',
    'Tent, pavilion',
    'Wine, Common (Pitcher)',
  ]);
  for (const row of covered)
    expect(
      row.mechanicsReview.curationRecords[0]?.rationale,
      row.name,
    ).toContain('Explicit covered/no-output');
  // The empty bodies (seven class kits and four uncited goods) bind the
  // empty text.
  expect(
    assessedItems
      .filter((row) => row.mechanicsReview.descriptionText === '')
      .map((row) => row.name)
      .sort(),
  ).toEqual([
    'Chewing Stick',
    'Comb',
    "Kit, Mesmerist's",
    "Kit, Oracle's",
    "Kit, Paladin's",
    "Kit, Shifter's",
    "Kit, Slayer's",
    "Kit, Swashbuckler's",
    "Kit, Vigilante's",
    'Knife',
    'Scissors',
  ]);
  // Notes on the statistic they qualify.
  for (const [name, targets] of [
    ['Headband of Vast Intelligence +4', ['ability.int', undefined]],
    ['Gauntlet of Rust', ['saves', undefined]],
    ['Silent Whistle', ['skill.per', 'skill.per', 'skill.prf']],
    ['Holy water', ['attack', 'attack', 'damage']],
  ] as const)
    expect(
      entry(name)
        .situationalNotes?.map((note) => note.target)
        .sort(),
      name,
    ).toEqual(targets);
  // Readable link text: an unlabeled link reads as the linked record's name.
  expect(
    entry('Mask of the Mesmerist').situationalNotes?.map((n) => n.text),
  ).toContain(
    'Once per day, if the wearer possesses the Mesmerist Tricks class feature, he can implant a trick without expending a use of his mesmerist trick ability. This trick also does not count against his limit of total tricks active at the same time.',
  );
});

it('records the cited, PCGen, inherited and Unchained notice dependencies and enforces every hold', () => {
  const held = new Map(heldNotices.map((row) => [row.id, row.notices]));
  const holdId = (book: string) => `items-431-notice-${book}-complete-chain`;
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
    if (OUTFITS.includes(row.externalKey)) {
      expect(row.requiredNotices, row.name).toEqual(['PZO1110']);
      expect(row.holdIds, row.name).toEqual([outfitHold(row.externalKey)]);
      expect(row.noticeHoldIds, row.name).toEqual([]);
      expect(row.noticeRequirementsComplete, row.name).toBe(true);
      expect(row.releaseBlocker, row.name).toMatchObject({
        issue: 'https://github.com/AndreasUnunger/EverythingPath/issues/762',
        attributionComplete: true,
      });
      expect(row.rationale).toContain('#762');
      continue;
    }
    expect(row.releaseBlocker, row.name).toBeUndefined();
    expect(row.holdIds, row.name).toEqual([
      `items-431-whole-content-${row.externalKey.split('/')[1]}`,
    ]);
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices.filter((book) => book !== 'PZO1110').map(holdId),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  // Rejected rows add no book.
  for (const key of OUTFITS)
    expect(candidate(key).rejectedRootComparisonEvidence).toEqual([
      expect.objectContaining({ book: 'PZO1123' }),
    ]);
  expect(candidate('Marked cards').requiredNotices).toEqual([
    'PZO1123',
    'PZO1110',
  ]);
  expect(candidate('Bag of Holding (Type I)').requiredNotices).not.toContain(
    'PZO9489',
  );
  expect(candidate('Bloodvine Rope').requiredNotices).toEqual([
    'PZO1115',
    'PZO1129',
    'PZO1110',
  ]);
  // Inherited rules: the Bestiary creatures the mounts, the rust bag and the
  // gauntlet name, low-light vision and the fuse grenade.
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
    'Pony (combat trained)': ['PZO1112'],
    'Goggles of Elvenkind': ['PZO1112'],
    'Gauntlet of Rust': ['PZO1112'],
    'Unerring grenade': ['PZO1123'],
    Camel: ['PZO1116'],
    'Bag of Tricks, Rust': ['PZO1112'],
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
  // The kits keep their other holds (their cited book and unresolved wording).
  for (const key of kits) {
    const row = candidate(key);
    expect(row.requiredNotices, row.name).not.toContain('PZO1131');
    expect(row.unchainedReview, row.name).toContain('outside the bound');
    expect(row.requiredNotices.length, row.name).toBeGreaterThan(1);
    expect(row.holdIds, row.name).toEqual([
      `items-431-whole-content-${key.split('/')[1]}`,
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
    held: 94,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 6,
    excludedFolders: 6,
    recordLevel35Holds: 0,
  });
  expect(excludedRows.map((row) => row.name).sort()).toEqual([
    'Adventuring Gear',
    'Body',
    'Feet',
    'Food and Drink',
    'Headband',
    'Ioun Stones',
  ]);
  for (const row of excludedRows) {
    const raw = upstreamRecord.parse(
      parse(await readPinned(row.source.repo, row.source.path)),
    );
    expect(raw._key, row.name).toBe(`!folders!${raw._id}`);
  }
  expect(preview.entries).toHaveLength(94);
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
  // The outfits: complete Core Rulebook rows whose DESC is the body (complete
  // attribution evidence; held only on #762).
  for (const key of OUTFITS) {
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
    expect(row.citedSources.map((source) => source.book)).toEqual(['PZO1110']);
    expect(row.linkedContentReview).toEqual([]);
    expect(row.sourceFields.actions).toBeUndefined();
  }
  // Records with no Paizo PCGen data row stay held on an unresolved origin.
  expect(
    assessedItems
      .filter((row) => !row.comparison)
      .map((row) => row.name)
      .sort(),
  ).toEqual([
    'Bone Burn',
    'Chewing Stick',
    'Comb',
    'Knife',
    'Scissors',
    'Spirit planchette',
    'Unerring grenade',
  ]);
  for (const row of assessedItems.filter((row) => !row.comparison))
    expect(row.inheritedRuleUnresolvedOrigins[0], row.name).toMatch(
      /no PCGen data row at the pin names it/,
    );
});

it('reextracts the reviewed items from a clean shared fixture tree, holds every item on its own holds (the two outfits only on #762)', async () => {
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
      required: 12,
      checked: 12,
      missing: 0,
      descriptions: { checked: 94 },
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
    // #738 keeps the rust bag's pf1e-rules journal link as text, so it no
    // longer fails on a reference and stays held.
    expect(
      gate.failures
        .filter((row) => ours.has(row.externalKey))
        .map((row) => [row.externalKey, row.reason]),
    ).toEqual([]);
    expect(held).toHaveLength(94);
    for (const key of OUTFITS)
      expect(held.find((row) => row.externalKey === key)?.reason).toMatch(
        new RegExp(`^${outfitHold(key)}: held only on importer gap #762`),
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
    const ring = candidate(RING_4);
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
