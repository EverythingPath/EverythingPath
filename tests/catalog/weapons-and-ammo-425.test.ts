import { expectWeaponObservations } from './weapon-observations';
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
import { buildAssessmentBinding } from '../../scripts/catalog/admission';
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
} from '../fixtures/weapons-and-ammo-425/data';
import {
  rangedWeapon,
  weaponSheet,
} from '../fixtures/weapons-and-ammo-425/sheet';
import { materializePinnedTree, readPinned } from './pinned-sources';
import { bindSnapshotToCurrentNotices } from './batch-ownership';
import { assessWithUnclearedHolds } from './uncleared-holds';

const sha = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
const SHOTEL = 'pf1/1vNxFfAeYalooWIF';
const PUNCHING_DAGGER = 'pf1/05NnBuNnkMsaNoXf';
const CLAW_BLADES = 'pf1/1TiILWBLdzYpnPky';
const TRIDENT = 'pf1/2mw29eyL5mzZgKqR';
const ARROW = 'pf1/23HXFjpPnuLFOylm';
const HEAVY_CRANK = 'pf1/0MFbQaJ3MUWV2fGM';
const LIGHT_CRANK = 'pf1/CbqPpYdIwqOOSTdR';
const THARK_RIFLE = 'pf1/CadEsVvAN7kdruSH';
const HAND_CROSSBOW = 'pf1/BgTqaNqyS3tnLGAg';
const HEARTSTAKE = 'pf1/6hzQCxhCoUEAQmo6';
const SILVER = 'pf1/7Bxjw0baCyDmSWjv';
const PRONGED = 'pf1/3sWj5S5ukzxl8oxK';
const BARBED = 'pf1/84twkW8rwnUEX4EY';
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
// One resolved statistic of one entry's Modifiers, with its Situations selected.
type Situation = string | { local: string; sheetEntryId: string };
function situations(name: string, sheetEntryId = entry(name).externalKey) {
  const out: Situation[] = [];
  for (const row of modifiers(name)) {
    const scope = row.condition?.situation;
    if (!scope) continue;
    if (typeof scope === 'string') out.push(scope);
    else if ('local' in scope) out.push({ local: scope.local, sheetEntryId });
    else throw new Error('Expected a shared or local Situation');
  }
  return out;
}
function resolved(name: string, target: string, selected = false) {
  return resolveSheet(modifiers(name), {
    situations: selected ? situations(name) : [],
  })[target as 'cmb'].total;
}
// Every record whose own action keeps Unchained action-cost metadata (every
// weapon action: Foundry records "unchained: {type: attack}" on each), and
// the three whose bound closure reaches another such body.
const unchainedBound = [
  'pf1/6dixCIl251JU2pJH', // Nagant M1895 Revolver: the revolver
  'pf1/6jcpvbj0JtD3PMc1', // Repeating Hand Crossbow: the repeating heavy crossbow
  'pf1/CbqPpYdIwqOOSTdR', // Light Crank Crossbow: the heavy crank and light crossbows
];

it('resolves held weapons’ statistics and reviewed Modifiers through the public resolver', () => {
  // A proficient wielder (Strength 14, base attack +5) attacks with the
  // shotel (1d8, ×3), the punching dagger (1d4, ×3) and the claw blades
  // (1d4 and +1 enhancement on attack rolls only).
  const sheet = weaponSheet({
    weapons: [SHOTEL, PUNCHING_DAGGER, CLAW_BLADES],
    strength: 14,
    bab: 5,
    categories: ['simple', 'martial'],
    baseTypes: ['shotel', 'claw blades'],
  });
  const routines = calculateCharacterSheet(sheet).attackRoutines;
  const line = (key: string) =>
    routines.find((row) => row.entryId === `routine:${key}`)?.single[0];
  expect(line(SHOTEL)).toMatchObject({
    attackBonus: { total: 7 },
    damageBonus: { total: 2 },
  });
  expect(line(SHOTEL)?.damageDice).toBe('1d8');
  expect(line(SHOTEL)?.criticalMultiplier.total).toBe(3);
  expect(line(PUNCHING_DAGGER)?.attackBonus.total).toBe(7);
  expect(line(PUNCHING_DAGGER)?.damageDice).toBe('1d4');
  expect(line(PUNCHING_DAGGER)?.criticalMultiplier.total).toBe(3);
  // The claw blades' +1 enhancement reaches attack rolls, not damage.
  expect(line(CLAW_BLADES)?.attackBonus.total).toBe(8);
  expect(line(CLAW_BLADES)?.damageBonus.total).toBe(2);
  // The shotel's +1 against shield users applies only under its Situation,
  // and only to the shotel's own attacks.
  const selected = calculateCharacterSheet(sheet, {
    situations: situations('Shotel', `item:${SHOTEL}`),
  }).attackRoutines;
  const selectedLine = (key: string) =>
    selected.find((row) => row.entryId === `routine:${key}`)?.single[0];
  expect(selectedLine(SHOTEL)?.attackBonus.total).toBe(8);
  expect(selectedLine(PUNCHING_DAGGER)?.attackBonus.total).toBe(7);
  // Without the exotic proficiency the shotel takes −4.
  const untrained = calculateCharacterSheet(
    weaponSheet({
      weapons: [SHOTEL],
      strength: 14,
      bab: 5,
      categories: ['simple', 'martial'],
    }),
  ).attackRoutines[0]?.single[0];
  expect(untrained?.attackBonus.total).toBe(3);
});

it('applies each reviewed Modifier only under its Situation', () => {
  for (const [name, target, value] of [
    ['Sai', 'cmb', 2],
    ['Swordbreaker Dagger', 'cmb', 4],
    ['Dan Bong', 'cmb', 2],
    ['Heavy Crank Crossbow', 'cmb', 2],
    ['Heavy Crank Crossbow', 'skill.clm', 2],
    ['Light Crank Crossbow', 'cmb', 1],
    ['Light Crank Crossbow', 'skill.clm', 1],
    ['Iron Brush', 'skill.slt', 2],
    ['Machete', 'skill.sur', 1],
    ['Dwarven Light Axe-Gauntlet', 'cmd', 10],
    ['Kobold Tail Attachment (Razored)', 'cmd', 4],
  ] as const) {
    expect(resolved(name, target), `${name} ${target}`).toBe(0);
    expect(resolved(name, target, true), `${name} ${target}`).toBe(value);
  }
  // The Dan Bong's grapple bonus uses the shared Situation, whose condition
  // its body states exactly.
  expect(modifiers('Dan Bong')[0]?.condition).toEqual({
    situation: 'grapple',
  });
  // Weapon Modifiers bind to the weapon's own attacks.
  for (const [name, value, situation] of [
    [
      'Shotel',
      1,
      'against opponents using bucklers, light shields, or heavy shields',
    ],
    ['Net', -4, 'after the net is unfolded'],
    ['Maxim M1910 Machine Gun', -4, 'firing the Maxim when it is not mounted'],
    ['Aasen Mortar', -4, 'firing the mortar as a direct-fire siege engine'],
    ['Dwarven Heavy Pelletbow', -2, 'shooting a pelletbow with one hand'],
    ['Double-Barreled Musket', -4, 'Both Barrels'],
    ['Double-Barreled Pistol', -4, 'Both Barrels'],
    [
      'Pronged Arrow',
      1,
      'against creatures or objects one or more size categories smaller than you',
    ],
    ['Heartstake Bolt', -2, 'firing a heartstake bolt'],
  ] as const)
    expect(modifiers(name), name).toEqual([
      expect.objectContaining({
        target: 'attack',
        bonusType: 'untyped',
        value,
        condition: { situation: { local: situation }, weapon: '$self' },
      }),
    ]);
  // Ammunition Modifiers bind to the attacks that fire it (see the next test).
  expect(modifiers('Silver Firearm Bullet')).toEqual([
    expect.objectContaining({
      target: 'damage',
      bonusType: 'untyped',
      value: -1,
      condition: {
        situation: { local: 'a firearm shooting a silver bullet' },
        weapon: '$self',
      },
    }),
  ]);
  expect(modifiers('Claw Blades')).toEqual([
    expect.objectContaining({
      target: 'attack',
      bonusType: 'enhancement',
      value: 1,
      condition: { weapon: '$self' },
    }),
  ]);
  // No item here gives an AC bonus, on ac.other or anywhere else.
  for (const row of preview.entries)
    for (const modifier of row.modifiers)
      expect(String(modifier.target), row.name).not.toMatch(/^ac/);
});

it('applies ammunition Modifiers only to the attacks that fire that ammunition', () => {
  // A hand crossbow fires, in turn, a heartstake bolt, a silver bullet, a
  // pronged arrow and a barbed bolt; a punching dagger attacks in melee
  // (Dexterity 14, base attack +5). The ammunition definitions are marked
  // with explicit positive/negative flags at this resolver seam; every ammunition
  // Situation is selected at once.
  const ammo = [HEARTSTAKE, SILVER, PRONGED, BARBED];
  const base = weaponSheet({
    weapons: [PUNCHING_DAGGER],
    items: ammo,
    dexterity: 14,
    bab: 5,
    categories: ['simple'],
    baseTypes: ['hand crossbow'],
  });
  const sheet = (ammunition: boolean) => ({
    ...base,
    entries: [
      ...base.entries,
      {
        _id: 'item:crossbow',
        kind: 'item' as const,
        active: true,
        catalogEntryId: 'crossbow',
        state: { kind: 'item' as const },
      },
      ...ammo.map((key) => ({
        _id: `routine:${key}`,
        kind: 'attackRoutine' as const,
        active: true,
        state: {
          kind: 'attackRoutine' as const,
          name: key,
          weaponEntryId: 'item:crossbow',
          hands: 'one' as const,
          mode: 'ranged' as const,
          ammunitionEntryId: `item:${key}`,
        },
      })),
    ],
    catalogEntries: [
      ...base.catalogEntries.map((definition) =>
        ammunition &&
        ammo.includes(definition._id) &&
        definition.detail?.kind === 'item'
          ? {
              ...definition,
              detail: { ...definition.detail, ammunition: true },
            }
          : definition,
      ),
      {
        _id: 'crossbow',
        name: 'Hand Crossbow',
        ruleIdentity: 'fixture-hand-crossbow',
        modifiers: [],
        detail: {
          kind: 'item' as const,
          consumable: false,
          weapon: rangedWeapon(HAND_CROSSBOW),
        },
      },
    ],
  });
  const selected = ammo.flatMap((key) => situations(key, `item:${key}`));
  const lines = (ammunition: boolean) =>
    Object.fromEntries(
      calculateCharacterSheet(sheet(ammunition), {
        situations: selected,
      }).attackRoutines.map((routine) => [
        routine.entryId,
        [
          routine.single[0]?.attackBonus.total,
          routine.single[0]?.damageBonus.total,
        ],
      ]),
    );
  expect(lines(true)).toEqual({
    [`routine:${PUNCHING_DAGGER}`]: [5, 0],
    [`routine:${HEARTSTAKE}`]: [5, 0],
    [`routine:${SILVER}`]: [7, -1],
    [`routine:${PRONGED}`]: [8, 0],
    [`routine:${BARBED}`]: [7, 0],
  });
  // Removing the ammunition flag remains a resolver negative control.
  expect(lines(false)).toEqual({
    [`routine:${PUNCHING_DAGGER}`]: [5, 0],
    [`routine:${HEARTSTAKE}`]: [7, 0],
    [`routine:${SILVER}`]: [7, 0],
    [`routine:${PRONGED}`]: [7, 0],
    [`routine:${BARBED}`]: [7, 0],
  });
  for (const key of ammo)
    expect(entry(key).detail.ammunition, key).toBe(
      candidate(key).itemKind.includes('siege') ? undefined : true,
    );
});

it('validates every item’s statistics, Base Item, defaults and end state against the pinned record and PCGen', async () => {
  const disagreements = Object.fromEntries(
    assessedItems
      .filter((row) => row.mechanicsReview.gearReview.disagreements.length)
      .map((row) => [row.name, row.mechanicsReview.gearReview.disagreements]),
  );
  expect(disagreements).toEqual({
    'Dye Arrow': ['price'],
    'Weighted Spear': ['qualities'],
    Flailpole: ['qualities'],
    'Orc Hornbow': ['rangeIncrement'],
    'Iron Brush': ['weight', 'rangeIncrement'],
    'Double-Barreled Musket': ['rangeIncrement'],
    'Nine-Section Whip': ['qualities'],
    'Blowgun Dart': ['weight'],
    'Plague Bundle (Siege)': ['weight'],
    'Wooden Stake': ['rangeIncrement'],
    'Dagger Pistol': ['qualities'],
    'Axe Musket': ['qualities'],
    'Bolas Bolt': ['price', 'weight'],
    'Liquid Ice (Siege)': ['weight'],
    Shortbow: ['damage'],
    Aklys: ['damage'],
    'Slow Burn Arrow': ['price'],
    'Dan Bong': ['weight', 'rangeIncrement'],
  });
  for (const row of assessedItems) {
    const raw = upstreamRecord.parse(
      parse(await readPinned(row.source.repo, row.source.path)),
    );
    const system = raw.system as {
      price?: number;
      weight?: { value?: number };
      actions?: {
        ability?: { critRange?: number; critMult?: number };
        damage?: { parts?: { formula?: string; types?: string[] }[] };
      }[];
    };
    const mapped = entry(row.externalKey).detail;
    const gear = row.mechanicsReview.gearReview;
    const stat = (field: string) =>
      gear.statistics.find((statistic) => statistic.field === field);
    expect(stat('price')?.pinned, row.name).toBe(system.price ?? 0);
    expect(stat('price')?.mapped, row.name).toBe(mapped.price);
    expect(stat('weight')?.pinned, row.name).toBe(system.weight?.value ?? 0);
    expect(stat('weight')?.mapped, row.name).toBe(mapped.weight);
    for (const statistic of gear.statistics)
      if (statistic.agrees === false && statistic.field !== 'qualities')
        expect(
          row.mechanicsReview.sourceDiscrepancies.join(' ').toLowerCase(),
          `${row.name} ${statistic.field}`,
        ).toMatch(
          {
            rangeIncrement: /range/,
            damageTypes: /damage type/,
          }[statistic.field as string] ??
            new RegExp(statistic.field.toLowerCase()),
        );
    const weapon = mapped.weapon;
    if (!weapon) {
      expect(row.itemKind, row.name).toMatch(/ammunition/);
      expect(gear.statistics.map((s) => s.field)).toEqual(['price', 'weight']);
      expect(gear.endState, row.name).toContain('An ammunition item');
      expect(gear.endState, row.name).toContain('#761');
      continue;
    }
    expectWeaponObservations({
      key: row.externalKey,
      name: row.name,
      weapon,
      statistics: gear.statistics,
      ability: system.actions?.[0]?.ability,
    });
    expect(gear.endState, row.name).toContain('Added to an Attack Routine');
    expect(gear.defaults ?? null, row.name).toBeNull();
  }
  // Representative mapped weapons: the Core Rulebook statistics.
  for (const [name, weapon] of [
    [
      'Punching Dagger',
      {
        proficiency: 'simple',
        handedness: 'light',
        dice: '1d4',
        threat: 20,
        mult: 3,
      },
    ],
    [
      'Shortsword',
      {
        proficiency: 'martial',
        handedness: 'light',
        dice: '1d6',
        threat: 19,
        mult: 2,
      },
    ],
    [
      'Heavy Mace',
      {
        proficiency: 'simple',
        handedness: 'oneHanded',
        dice: '1d8',
        threat: 20,
        mult: 2,
      },
    ],
    [
      'Two-Bladed Sword',
      {
        proficiency: 'exotic',
        handedness: '2h',
        dice: '1d8',
        threat: 19,
        mult: 2,
      },
    ],
    [
      'Hand Crossbow',
      {
        proficiency: 'exotic',
        handedness: 'light',
        dice: '1d4',
        threat: 19,
        mult: 2,
        rangeIncrement: 30,
      },
    ],
    [
      'Trident',
      {
        proficiency: 'martial',
        handedness: 'oneHanded',
        dice: '1d8',
        thrown: true,
        thrownRangeIncrement: 10,
      },
    ],
  ] as const)
    expect(entry(name).detail.weapon, name).toMatchObject(weapon);
  // The shortbow now retains its dice; the historical report's remaining
  // gaps persist: siege engines keep Foundry's subtypes, and
  // the scorpion whip's 15 ft. reach reads as a range increment.
  expect(entry('Shortbow').detail.weapon?.dice).toBe('1d6');
  expect(entry('Harvester').detail.weapon).toMatchObject({
    proficiency: 'siege',
    handedness: 'assault',
  });
  expect(entry('Gas Cylinder').detail.weapon).toMatchObject({
    proficiency: 'misc',
    handedness: 'other',
  });
  // Its source range is melee reach, not a thrown increment.
  expect(entry('Scorpion Whip').detail.weapon?.rangeIncrement).toBeUndefined();
  // Specific variants name another item in baseTypes; no baseItem is mapped.
  expect(
    candidate('Heavy Crossbow (Underwater)').mechanicsReview.gearReview
      .baseItem,
  ).toContain('Heavy Crossbow');
  expect(candidate(ARROW).mechanicsReview.gearReview.baseItem).toContain(
    'no baseItem',
  );
});

it('checks every description and conditional record against the pinned bodies', () => {
  const squash = (text: string) =>
    text
      .replace(/@UUID\[[^\]]*\]\{([^}]*)\}/g, '$1')
      .replace(/<[^>]+>/g, '')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/[’]/g, "'")
      .replace(/\s+/g, '');
  let descriptions = 0;
  let conditionals = 0;
  for (const row of assessedItems) {
    for (const record of row.mechanicsReview.curationRecords) {
      expect(record.status, row.name).toBe('checked');
      expect(record.diagnostics, row.name).toEqual([]);
      if (record.kind === 'conditional') {
        conditionals++;
        continue;
      }
      descriptions++;
      expect(record.text).toBe(row.mechanicsReview.descriptionText);
      for (const output of record.outputs)
        if (output.kind === 'note')
          expect(
            squash(row.mechanicsReview.descriptionText),
            `${row.name}: ${output.text.slice(0, 40)}`,
          ).toContain(squash(output.text).replace(/\.$/, ''));
    }
    for (const text of row.mechanicsReview.outstandingCalculations)
      expect(row.holdIds.join(' '), row.name).not.toContain(text);
  }
  // Every item has exactly one description record (#759's ownership sweep).
  expect(descriptions).toBe(96);
  expect(conditionals).toBe(2);
  // The thirty prose-pass candidates all have a checked record; descriptive
  // ones are explicit covered/no-output.
  for (const name of ['Punching Dagger', 'Blowgun'])
    expect(
      candidate(name).mechanicsReview.curationRecords[0]?.outputs,
      name,
    ).toEqual([]);
  // Descriptive bodies get an explicit covered/no-output record: their rules
  // are the weapon block, or the conditional record for the double barrels.
  for (const name of [
    'Shortsword',
    'Ankus',
    'Terbutje',
    'Hanbo',
    'Whistling Arrow',
    'Double-Barreled Musket',
  ]) {
    const [record] = candidate(name).mechanicsReview.curationRecords;
    expect(record?.kind, name).toBe('description');
    expect(record?.outputs, name).toEqual([]);
    expect(record?.rationale, name).toContain('Explicit covered/no-output');
  }
  // Notes on the statistic they qualify.
  for (const [name, targets] of [
    ['Sai', ['cmb']],
    ["Cat-o'-Nine-Tails", ['damage']],
    ['Net', ['attack', 'attack', undefined]],
  ] as const)
    expect(
      entry(name)
        .situationalNotes?.map((note) => note.target)
        .sort(),
      name,
    ).toEqual(targets);
});

it('records the cited, PCGen, inherited and Unchained notice dependencies and enforces every hold', () => {
  const held = new Map(heldNotices.map((row) => [row.id, row.notices]));
  const holdId = (book: string) =>
    `weapons-and-ammo-425-notice-${book}-complete-chain`;
  for (const row of assessedItems) {
    expect(row.requiredNotices.at(-1), row.name).toBe('PZO1110');
    for (const cited of row.citedSources)
      expect(row.requiredNotices, row.name).toContain(cited.book);
    for (const comparison of [row.comparison, ...row.additionalComparisonLeads])
      if (comparison)
        expect(row.requiredNotices, row.name).toContain(comparison.book);
    for (const notice of row.inheritedRuleNotices)
      expect(row.requiredNotices, row.name).toContain(notice.book);
    for (const linked of row.linkedContentReview)
      for (const book of linked.sources)
        expect(row.requiredNotices, row.name).toContain(book.id);
    for (const rejected of row.rejectedRootComparisonEvidence)
      if (
        rejected.book !== 'PZO1110' &&
        !row.citedSources.some((cited) => cited.book === rejected.book) &&
        ![row.comparison, ...row.additionalComparisonLeads].some(
          (comparison) => comparison?.book === rejected.book,
        )
      )
        expect(row.requiredNotices, row.name).not.toContain(rejected.book);
    expect(row.disposition, row.name).toBe('held');
    expect(row.holdIds[0], row.name).toBe(
      `weapons-and-ammo-425-whole-content-${row.externalKey.split('/')[1]}`,
    );
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices.filter((book) => book !== 'PZO1110').map(holdId),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  // The Thorn Bracer's record-level "D&D 3.5" tag is held, not excluded.
  expect(candidate('Thorn Bracer').recordTags).toEqual(['D&D 3.5']);
  expect(candidate('Thorn Bracer').holdIds).toEqual([
    'weapons-and-ammo-425-whole-content-5xOwEtugqeDjUkAG',
    'weapons-and-ammo-425-record-level-3.5-tag-5xOwEtugqeDjUkAG',
  ]);
  expect(
    assessedItems
      .filter((row) => row.holdIds.length > 1)
      .map((row) => row.name),
  ).toEqual(['Thorn Bracer']);
  // Inherited rules the bodies apply.
  for (const [name, books] of [
    ['Heartstake Bolt', ['PZO1112']],
    ['Silver Firearm Bullet', ['PZO1112']],
    ['Barbed Bolt', ['PZO1123']],
    ['Dye Arrow', ['PZO1123']],
    ['Sanpkhang', ['PZO1121', 'PZO1131']],
    ['Weighted Bolt', ['PZO1118']],
    ['Flechette Bolt', ['PZO1118']],
    ['Aasen Mortar', ['PZO1118', 'PZO1131']],
    ['Thark Rifle', ['DYN0032-E', 'PZO1118', 'PZO1131']],
  ] as const)
    expect(
      candidate(name).inheritedRuleNotices.map((notice) => notice.book),
      name,
    ).toEqual(books);
  // Core Rulebook items whose body is the Core Rulebook DESC are held only on
  // their notices: the cited Ultimate Equipment and, for weapons, Unchained.
  for (const [key, notices] of [
    [PUNCHING_DAGGER, ['PZO1123', 'PZO1131', 'PZO1110']],
    [TRIDENT, ['PZO1123', 'PZO1131', 'PZO1110']],
    [ARROW, ['PZO1123', 'PZO1110']],
  ] as const) {
    expect(candidate(key).coreRulebookWording, key).toBe('same');
    expect(candidate(key).requiredNotices, key).toEqual(notices);
    expect(
      candidate(key).mechanicsReview.gearReview.disagreements,
      key,
    ).toEqual([]);
  }
  // Unchained action-cost metadata anywhere in the bound closure requires
  // the held PZO1131: every record with an action.
  const unchainedOwn = assessedItems
    .filter((row) =>
      (
        row.sourceFields.actions as
          | { activation?: { unchained?: unknown } }[]
          | undefined
      )?.some((action) => action.activation?.unchained),
    )
    .map((row) => row.externalKey)
    .sort();
  expect(unchainedOwn).toHaveLength(73);
  expect(
    assessedItems
      .filter((row) => row.requiredNotices.includes('PZO1131'))
      .map((row) => row.externalKey)
      .sort(),
  ).toEqual(unchainedOwn);
  for (const row of assessedItems) {
    const rules = row.inheritedRuleNotices
      .filter((notice) => notice.book === 'PZO1131')
      .map((notice) => notice.rule);
    expect(
      rules.some((rule) => rule.includes("item's own action")),
      row.name,
    ).toBe(unchainedOwn.includes(row.externalKey));
    expect(
      rules.some((rule) => rule.includes('on the bound')),
      row.name,
    ).toBe(unchainedBound.includes(row.externalKey));
  }
  // Ammunition records carry no action.
  for (const row of assessedItems.filter((row) =>
    row.itemKind.includes('ammunition'),
  ))
    expect(row.requiredNotices, row.name).not.toContain('PZO1131');
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
    recordLevel35Holds: 1,
  });
  expect(excludedRows.map((row) => row.name).sort()).toEqual([
    'Ammunition',
    'Firearms',
    'Magic Weapons',
    'Simple Weapons',
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
  // The three Core Rulebook bodies that are the DESC word for word.
  for (const key of [PUNCHING_DAGGER, TRIDENT, ARROW]) {
    const row = candidate(key);
    const desc = /\tDESC:([^\t]*)/.exec(row.comparison!.literalRow)?.[1];
    const words = (text: string) =>
      text
        .replace(/<[^>]+>/g, '')
        .replace(/[’']/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
    expect(words(row.mechanicsReview.descriptionText), key).toBe(
      words(desc ?? ''),
    );
  }
  // Records with no PCGen data row stay held on an unresolved root origin.
  expect(
    assessedItems
      .filter((row) => !row.comparison)
      .map((row) => row.name)
      .sort(),
  ).toEqual([
    'Aasen Mortar',
    'Crushing Wheel',
    'Doru',
    'Dwarven Heavy Pelletbow',
    'Dwarven Light Axe-Gauntlet',
    'Gas Cylinder',
    'Harvester',
    'Hotchkiss 6 Pounder',
    'Maxim M1910 Machine Gun',
    'Nagant M1895 Revolver',
    'Smoke Sling Bullet',
    'Thark Rifle',
    'Thorn Bow',
    'Thorn Bracer',
  ]);
});

it('reextracts the reviewed items from a clean shared fixture tree and holds every one on its own holds', async () => {
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
    const gate = assessWithUnclearedHolds({
      artifact: authoritative,
      ...reviewedAdmission,
    });
    expect(gate.admitted.filter((row) => ours.has(row.externalKey))).toEqual(
      [],
    );
    // #738 keeps the crank crossbows' Climb journal link as text, so they no
    // longer fail on a reference and are held like the rest.
    expect(
      gate.failures
        .filter((row) => ours.has(row.externalKey))
        .map((row) => [row.externalKey, row.reason]),
    ).toEqual([]);
    const held = gate.held.filter((row) => ours.has(row.externalKey));
    expect(held).toHaveLength(96);
    expect(held.map((row) => row.externalKey)).toEqual(
      expect.arrayContaining([HEAVY_CRANK, LIGHT_CRANK]),
    );
    // The uncited Thark Rifle also falls in the importer's known
    // unattributed-source hold (#227/#241), which the gate reports first.
    for (const row of held)
      if (row.externalKey === THARK_RIFLE)
        expect(row.reason).toMatch(/^Known notice\/evidence hold/);
      else
        expect(row.reason, row.name).toBe(candidate(row.externalKey).rationale);
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
    // Confirming the punching dagger's whole content (its body is the Core
    // Rulebook DESC) still holds it on the held Ultimate Equipment and
    // Unchained notices.
    const confirmed = assessWithUnclearedHolds({
      artifact: authoritative,
      ...reviewedAdmission,
      assessments: reviewedAdmission.assessments.map((row) =>
        row.externalKey === PUNCHING_DAGGER
          ? { ...row, status: 'confirmed' as const }
          : row,
      ),
    });
    expect(
      confirmed.admitted.some((row) => row.externalKey === PUNCHING_DAGGER),
    ).toBe(false);
    expect(
      confirmed.held.find((row) => row.externalKey === PUNCHING_DAGGER)?.reason,
    ).toMatch(/Notice holds|Missing or unreviewed required notices/);
  } finally {
    await tree.dispose();
  }
});
