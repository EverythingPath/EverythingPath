// @vitest-environment node
import { expectWeaponObservations } from './weapon-observations';
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
} from '../fixtures/weapons-and-ammo-429/data';
import {
  itemDefinition,
  rangedWeapon,
  weaponSheet,
} from '../fixtures/weapons-and-ammo-429/sheet';
import { materializePinnedTree, readPinned } from './pinned-sources';
import { bindSnapshotToCurrentNotices } from './batch-ownership';
import { assessWithUnclearedHolds } from './uncleared-holds';

const sha = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
const GREATSWORD = 'pf1/oyUApQSVsAqzyjdz';
const LONGSWORD = 'pf1/zWRlna42PMJVX6un';
const WARHAMMER = 'pf1/pCFqtR5WrJmeZnDF';
const METEOR_HAMMER = 'pf1/otf7OZQZhkAWoUR4';
const THORNBLADE = 'pf1/zOgD72irWuvqTCUq';
const SPIKED_CHAIN = 'pf1/u6Hv3AYMgkAtR7Jm';
const HEAVY_CROSSBOW = 'pf1/vqF4kshibBDN624D';
const DOUBLE_CROSSBOW = 'pf1/vyRDu111njgEV8xw';
const REPEATING_LIGHT_CROSSBOW = 'pf1/tSvbLpTfOIUnoGd0';
const GASTRAPHETES = 'pf1/t5h6nBc1BuN8Eh5d';
const SPEAR = 'pf1/s0LFk8Jk5CsgOj7V';
const LANCE = 'pf1/wuW25pHWYQGW81jL';
const HANDWRAPS = 'pf1/q1HlpY1NoUveS47l';
const KETTLE = 'pf1/xQegVPdAOD8rq2Rl';
const LARGE_RAM = 'pf1/qyHqvrBvrPRgVbrt';
const GRAY_DUST_SHOT = 'pf1/ud01Fiqw1aTjxu3B';
const THORN_ARROW = 'pf1/xAxgFvkpvTgGRHZY';
const RADIUM_RIFLE = 'pf1/xhUw4hzZlljYFCzj';
// Statistics that differ from the compared PCGen row (each one is recorded).
const DISAGREEMENTS: Record<string, string[]> = {
  'Battle Poi': ['rangeIncrement'],
  Planson: ['damage'],
  'Butterfly Knife': ['rangeIncrement'],
  Hurlbat: ['multiplier', 'handedness'],
  'Standard Catapult': ['damage', 'proficiency', 'handedness'],
  'Little Starstones Sling Bullet': ['price', 'weight'],
  'Pheromone Arrow': ['price'],
  Kerambit: ['weight', 'qualities'],
  Flambard: ['weight'],
  'Heavy Bombard': ['proficiency', 'handedness'],
  Crook: ['qualities'],
  'Splintercloud Arrow': ['price'],
  'Fire Lance': ['damageTypes'],
  "Monk's Spade": ['damageTypes'],
  'Heavy Catapult': ['proficiency', 'handedness'],
  'Bomb (Siege)': ['weight'],
  Lance: ['handedness'],
  'Rope Dart': ['weight'],
  'Warhammer Musket': ['qualities'],
  'Ratfolk Tailblade': ['damage'],
  'Hooked Lance': ['qualities'],
};
// Bodies that state no rule: explicit covered/no-output description records.
const NO_OUTPUT = [
  'Greatsword',
  'Warhammer',
  'Planson',
  'Horsechopper',
  'Spear',
  'Metal Cartridge',
  'Repeating Light Crossbow',
  'Urumi',
  'Starknife',
  'Splintercloud Arrow',
  'Fauchard',
  'Boarding Pike',
  'Falchion',
  'Greatclub',
  'Air Reservoir',
  'Club',
  'Firearm Bullet',
  'Glaive',
  'Thorn Arrow',
  'Halberd',
  'Longsword',
];
// Records no PCGen data row at the pin names.
const NO_PCGEN = [
  'Alchemical Cartridge (Repellent)',
  'Dwarven Chain-Flail',
  'Entangling Bolt (Siege)',
  'Gastraphetes',
  'M1914 Grenade (Fragmentation)',
  'Radium Rifle',
  'Thistle Arrow',
  'Thorn Arrow',
];
// The bodies the batch's content closures reach (full-corpus preview).
const CLOSURE = [
  'Alchemical Cartridge (Gray Dust)',
  'Amulet of Mighty Fists +1',
  'Craft Wondrous Item',
  'Magic Fang',
  'Magic Fang, Greater',
  'Permanency',
];
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
  return [...new Map(out.map((row) => [JSON.stringify(row), row])).values()];
}
function resolved(name: string, target: string, selected = false) {
  return resolveSheet(modifiers(name), {
    situations: selected ? situations(name) : [],
  })[target as 'cmb'].total;
}
type Routines = ReturnType<typeof calculateCharacterSheet>['attackRoutines'];
const line = (routines: Routines, key: string) => {
  const row = routines.find((routine) => routine.entryId === `routine:${key}`)
    ?.single[0];
  return [
    row?.attackBonus.total,
    row?.damageBonus.total,
    row?.damageDice,
    row?.criticalMultiplier.total,
  ];
};

it('resolves held weapons’ statistics and reviewed Modifiers through the public resolver', () => {
  // A wielder with Strength 14 and base attack +5, proficient with simple and
  // martial weapons.
  const weapons = [
    GREATSWORD,
    LONGSWORD,
    WARHAMMER,
    METEOR_HAMMER,
    THORNBLADE,
    SPIKED_CHAIN,
  ];
  const untrained = calculateCharacterSheet(
    weaponSheet({
      weapons,
      strength: 14,
      bab: 5,
      categories: ['simple', 'martial'],
    }),
  ).attackRoutines;
  // One-handed: +2 Strength on damage; two-handed: +3. The meteor hammer,
  // elven thornblade and spiked chain are exotic: −4 without their
  // proficiency.
  expect(line(untrained, GREATSWORD)).toEqual([7, 3, '2d6', 2]);
  expect(line(untrained, LONGSWORD)).toEqual([7, 2, '1d8', 2]);
  expect(line(untrained, WARHAMMER)).toEqual([7, 2, '1d8', 3]);
  expect(line(untrained, METEOR_HAMMER)).toEqual([3, 3, '1d8', 2]);
  expect(line(untrained, THORNBLADE)).toEqual([3, 2, '1d6', 2]);
  expect(line(untrained, SPIKED_CHAIN)).toEqual([3, 3, '2d4', 2]);
  const trained = weaponSheet({
    weapons,
    strength: 14,
    bab: 5,
    categories: ['simple', 'martial'],
    baseTypes: ['meteor hammer', 'elven thornblade', 'spiked chain'],
  });
  const plain = calculateCharacterSheet(trained).attackRoutines;
  expect(line(plain, METEOR_HAMMER)).toEqual([7, 3, '1d8', 2]);
  expect(line(plain, THORNBLADE)).toEqual([7, 2, '1d6', 2]);
  expect(line(plain, SPIKED_CHAIN)).toEqual([7, 3, '2d4', 2]);
  // The thornblade's +2 applies only on critical confirmation rolls (its
  // Situation) and only to its own attacks.
  const confirming = calculateCharacterSheet(trained, {
    situations: situations('Elven Thornblade', `item:${THORNBLADE}`),
  }).attackRoutines;
  expect(line(confirming, THORNBLADE)).toEqual([9, 2, '1d6', 2]);
  expect(line(confirming, LONGSWORD)).toEqual([7, 2, '1d8', 2]);
  expect(line(confirming, METEOR_HAMMER)).toEqual([7, 3, '1d8', 2]);
});

it('applies ranged weapons’ attack penalties only to their own attacks', () => {
  // Dexterity 14 and base attack +5, proficient with simple and martial
  // weapons plus named repeating-crossbow proficiency. Unsupported launchers
  // retain their imported Modifiers; this fixture does not certify release support.
  expect(() => rangedWeapon(DOUBLE_CROSSBOW)).toThrow(
    new Error('unresolved reload'),
  );
  expect(() => rangedWeapon(GASTRAPHETES)).toThrow(
    new Error('unresolved strengthDamage, reload'),
  );
  const ranged = [HEAVY_CROSSBOW, REPEATING_LIGHT_CROSSBOW];
  const sheet = () => {
    const base = weaponSheet({
      dexterity: 14,
      bab: 5,
      categories: ['simple', 'martial'],
      baseTypes: ['repeating light crossbow'],
    });
    return {
      ...base,
      entries: [
        ...base.entries,
        ...ranged.flatMap((key) => [
          {
            _id: `item:${key}`,
            kind: 'item' as const,
            active: true,
            catalogEntryId: key,
            state: { kind: 'item' as const },
          },
          {
            _id: `routine:${key}`,
            kind: 'attackRoutine' as const,
            active: true,
            state: {
              kind: 'attackRoutine' as const,
              name: key,
              weaponEntryId: `item:${key}`,
              hands: 'two' as const,
              mode: 'ranged' as const,
            },
          },
        ]),
      ],
      catalogEntries: [
        ...base.catalogEntries,
        ...ranged.map((key) => {
          const definition = itemDefinition(key);
          return {
            ...definition,
            detail: {
              kind: 'item' as const,
              consumable: false,
              weapon: rangedWeapon(key),
            },
          };
        }),
      ],
    };
  };
  const attacks = (
    input: ReturnType<typeof sheet>,
    selected: ReturnType<typeof situations> = [],
  ) =>
    Object.fromEntries(
      calculateCharacterSheet(input, {
        situations: selected,
      }).attackRoutines.map((routine) => [
        routine.entryId,
        [routine.single[0]?.attackBonus.total, routine.single[0]?.damageDice],
      ]),
    );
  // Base attack +5 and Dexterity +2, before either Situation is selected.
  const proficient = sheet();
  expect(attacks(proficient)).toEqual({
    [`routine:${HEAVY_CROSSBOW}`]: [7, '1d10'],
    [`routine:${REPEATING_LIGHT_CROSSBOW}`]: [7, '1d8'],
  });
  // Shooting the heavy crossbow with one hand applies its -4 only to it.
  expect(
    attacks(proficient, situations('Heavy Crossbow', `item:${HEAVY_CROSSBOW}`)),
  ).toEqual({
    [`routine:${HEAVY_CROSSBOW}`]: [3, '1d10'],
    [`routine:${REPEATING_LIGHT_CROSSBOW}`]: [7, '1d8'],
  });
  // The gastraphetes' Situation is ordinary unsupported firing while
  // standing. Firing it prone, and a Large or larger creature using one a
  // size smaller than itself without support, fall outside it (the body's
  // exception, as #426's double hackbut): no −4.
  const [unsupported] = situations('Gastraphetes', `item:${GASTRAPHETES}`);
  expect(unsupported).toEqual({
    local:
      'firing a gastraphetes while standing without support, unless you are a Large or larger creature using a gastraphetes one size smaller than yourself',
    sheetEntryId: `item:${GASTRAPHETES}`,
  });
  expect(
    candidate(GASTRAPHETES).mechanicsReview.curationRecords[0]?.outputs,
  ).toContainEqual(
    expect.objectContaining({
      kind: 'note',
      text: expect.stringContaining(
        'you take no penalty for firing a gastraphetes while prone. A Large or larger creature can use a gastraphetes one size smaller than itself without any support',
      ),
    }),
  );
});

it('applies each reviewed Modifier only under its Situation', () => {
  for (const [name, target, value] of [
    ['Kerambit', 'skill.slt', 2],
    ['Butterfly Knife', 'skill.slt', 2],
    ['Tube Arrow Shooter', 'skill.slt', 2],
    ['Kobold Tail Attachment (Pounder)', 'cmd', 4],
    ['Flambard', 'cmb', 4],
    // The meteor hammer's +1 shield bonus in fortress mode resolves to the
    // shield leaf (#734).
    ['Meteor Hammer', 'ac.shield', 1],
    ['Meteor Hammer', 'ac.other', 0],
  ] as const) {
    expect(resolved(name, target), `${name} ${target}`).toBe(0);
    expect(resolved(name, target, true), `${name} ${target}`).toBe(value);
  }
  // The gnome pincher's +2 applies on disarm and on steal checks: the shared
  // Situations.
  expect(modifiers('Gnome Pincher')).toEqual(
    ['disarm', 'steal'].map((situation) =>
      expect.objectContaining({
        target: 'cmb',
        bonusType: 'untyped',
        value: 2,
        condition: { situation },
      }),
    ),
  );
  for (const [selected, total] of [
    [[], 0],
    [['disarm'], 2],
    [['steal'], 2],
    [['trip'], 0],
  ] as const)
    expect(
      resolveSheet(modifiers('Gnome Pincher'), { situations: [...selected] })
        .cmb.total,
      selected.join(),
    ).toBe(total);
  // The only armor, shield or natural armor bonus in the batch is the meteor
  // hammer's shield bonus, on ac; nothing targets ac.other (#734).
  const defense = preview.entries.flatMap((row) =>
    row.modifiers
      .filter((modifier) =>
        ['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType),
      )
      .map((modifier) => [row.name, modifier.target, modifier.bonusType]),
  );
  expect(defense).toEqual([['Meteor Hammer', 'ac', 'shield']]);
  for (const row of preview.entries)
    for (const modifier of row.modifiers)
      expect(String(modifier.target), row.name).not.toBe('ac.other');
  // Weapon Modifiers bind to their own attacks.
  for (const [name, bonusType, value, situation] of [
    [
      'Heavy Crossbow',
      'untyped',
      -4,
      'shooting the heavy crossbow with one hand',
    ],
    [
      'Elven Thornblade',
      'untyped',
      2,
      'on attack rolls made to confirm critical hits with an elven thornblade',
    ],
    ['Hurlbat', 'untyped', -1, 'making a melee attack with the hurlbat'],
    [
      'Gastraphetes',
      'untyped',
      -4,
      'firing a gastraphetes while standing without support, unless you are a Large or larger creature using a gastraphetes one size smaller than yourself',
    ],
    ['Ratfolk Tailblade', 'untyped', -4, 'using a loosely attached tailblade'],
    [
      'Heavy Bombard',
      'untyped',
      -4,
      'firing a bombard as a direct-fire siege engine',
    ],
    [
      'Light Bombard',
      'untyped',
      -4,
      'firing a bombard as a direct-fire siege engine',
    ],
  ] as const)
    expect(modifiers(name), name).toEqual([
      expect.objectContaining({
        target: 'attack',
        bonusType,
        value,
        condition: { situation: { local: situation }, weapon: '$self' },
      }),
    ]);
  // The double crossbow's −4 applies to every attack with it.
  expect(modifiers(DOUBLE_CROSSBOW)).toEqual([
    expect.objectContaining({
      target: 'attack',
      bonusType: 'untyped',
      value: -4,
      condition: { weapon: '$self' },
    }),
  ]);
  // The large ram: −4 on attack and damage rolls without charging (never a
  // gallery ram), and the pick and screw heads' +2 circumstance bonuses
  // against stone or earthen structures, under three Situations (as #427's
  // and #428's rams).
  expect(modifiers(LARGE_RAM)).toEqual(
    [
      [
        -4,
        'untyped',
        'making a ram attack as a full-round action without charging (not with a gallery ram)',
      ],
      [2, 'circumstance', 'a ram with a pick head attacking a stone structure'],
      [
        2,
        'circumstance',
        'a ram with a screw head attacking an earthen structure',
      ],
    ].flatMap(([value, bonusType, local]) =>
      ['attack', 'damage'].map((target) =>
        expect.objectContaining({
          target,
          bonusType,
          value,
          condition: { situation: { local }, weapon: '$self' },
        }),
      ),
    ),
  );
  // 22 Modifiers in all; no ammunition record carries one, and as imported
  // ordinary ammunition now retains its flag; siege ammunition stays unsupported.
  expect(
    preview.entries.reduce((total, row) => total + row.modifiers.length, 0),
  ).toBe(22);
  for (const row of assessedItems.filter((row) =>
    row.itemKind.includes('ammunition'),
  )) {
    expect(entry(row.externalKey).modifiers, row.name).toEqual([]);
    expect(entry(row.externalKey).detail.ammunition, row.name).toBe(
      row.itemKind.includes('siege') ? undefined : true,
    );
  }
});

it('validates every item’s statistics, Base Item, defaults and end state against the pinned record and PCGen', async () => {
  const disagreements = Object.fromEntries(
    assessedItems
      .filter((row) => row.mechanicsReview.gearReview.disagreements.length)
      .map((row) => [row.name, row.mechanicsReview.gearReview.disagreements]),
  );
  expect(disagreements).toEqual(DISAGREEMENTS);
  for (const row of assessedItems) {
    const raw = upstreamRecord.parse(
      parse(await readPinned(row.source.repo, row.source.path)),
    );
    const system = raw.system as {
      price?: number;
      weight?: { value?: number };
      actions?: {
        ability?: { critRange?: number; critMult?: number };
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
      if (statistic.agrees === false)
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
    // No item in the batch is magic.
    expect(gear.defaults ?? null, row.name).toBeNull();
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
  }
  // Representative mapped weapons.
  for (const [name, weapon] of [
    [
      'Greatsword',
      {
        proficiency: 'martial',
        handedness: 'twoHanded',
        dice: '2d6',
        threat: 19,
        mult: 2,
      },
    ],
    [
      'Spear',
      {
        proficiency: 'simple',
        handedness: 'twoHanded',
        dice: '1d8',
        mult: 3,
        thrown: true,
        thrownRangeIncrement: 20,
      },
    ],
    [
      'Elven Thornblade',
      {
        proficiency: 'exotic',
        handedness: 'oneHanded',
        dice: '1d6',
        threat: 18,
        mult: 2,
        finesse: true,
      },
    ],
    [
      'Heavy Crossbow',
      {
        proficiency: 'simple',
        handedness: 'twoHanded',
        dice: '1d10',
        threat: 19,
        rangeIncrement: 120,
      },
    ],
    [
      'Shotgun',
      {
        proficiency: 'exotic',
        handedness: 'twoHanded',
        dice: '1d8',
        rangeIncrement: 20,
      },
    ],
  ] as const)
    expect(entry(name).detail.weapon, name).toMatchObject(weapon);
  // Importer gaps the report lists: siege engines keep Foundry's subtypes
  // (the light trebuchet and light bombard import as personal exotic
  // weapons, the grenade as "misc"/"other"), items without damage and the
  // standard catapult's bare "6d6" map no dice, and the hurlbat imports as
  // its thrown action.
  for (const name of [
    'Colossal Gallery',
    'Huge Siege Tower',
    'Assault Bridge, Huge',
    'Escalade Ladder, Colossal',
    'Corvus',
    'Launching Crossbow',
    'Handwraps',
    'Standard Catapult',
  ])
    expect(entry(name).detail.weapon?.dice ?? null, name).toBeNull();
  expect(entry(LARGE_RAM).detail.weapon).toMatchObject({
    proficiency: 'siege',
    handedness: 'assault',
    dice: '2d6',
    mult: 3,
  });
  expect(entry('Heavy Bombard').detail.weapon).toMatchObject({
    proficiency: 'siege',
    handedness: 'indirect',
    dice: '9d6',
    mult: 4,
  });
  for (const name of ['Light Trebuchet', 'Light Bombard']) {
    expect(entry(name).detail.weapon, name).toMatchObject({
      proficiency: 'exotic',
      handedness: 'ranged',
    });
    expect(candidate(name).itemKind, name).toBe('siege engine');
  }
  expect(entry('M1914 Grenade (Fragmentation)').detail.weapon).toMatchObject({
    proficiency: 'misc',
    handedness: 'other',
    dice: '4d6',
  });
  expect(candidate('M1914 Grenade (Fragmentation)').itemKind).toBe('weapon');
  expect(entry('Hurlbat').detail.weapon).toMatchObject({
    thrown: true,
    mult: 2,
    rangeIncrement: 10,
  });
  // Specific variants name another item in baseTypes; no baseItem is mapped.
  for (const [name, other] of [
    ['Wahaika', 'Club'],
    ['Tri-Bladed Katar', 'Punching Dagger'],
    ['Kobold Tail Attachment (Pounder)', 'Kobold Tail Attachment'],
  ] as const)
    expect(candidate(name).mechanicsReview.gearReview.baseItem, name).toContain(
      other,
    );
  expect(
    candidate(GRAY_DUST_SHOT).mechanicsReview.gearReview.baseItem,
  ).toContain('no baseItem');
});

it('checks every description record against the pinned bodies', () => {
  const squash = (text: string) =>
    text
      .replace(/@UUID\[[^\]]*\]\{([^}]*)\}/g, '$1')
      .replace(/<[^>]+>/g, '')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/[’]/g, "'")
      .replace(/[–—]/g, '-')
      .replace(/\s+/g, '');
  let descriptions = 0;
  for (const row of assessedItems) {
    // No candidate needs a required conditional record.
    expect(
      row.mechanicsReview.curationRecords.map((record) => record.kind),
      row.name,
    ).toEqual(['description']);
    for (const record of row.mechanicsReview.curationRecords) {
      expect(record.status, row.name).toBe('checked');
      expect(record.diagnostics, row.name).toEqual([]);
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
  expect(descriptions).toBe(81);
  // Descriptive bodies get an explicit covered/no-output record.
  expect(
    assessedItems
      .filter((row) => !row.mechanicsReview.curationRecords[0]?.outputs.length)
      .map((row) => row.name),
  ).toEqual(NO_OUTPUT);
  for (const name of NO_OUTPUT)
    expect(
      candidate(name).mechanicsReview.curationRecords[0]?.rationale,
      name,
    ).toContain('Explicit covered/no-output');
  // The splintercloud arrow's body holds only its recipe line.
  expect(
    candidate('Splintercloud Arrow').mechanicsReview.sourceDiscrepancies[0],
  ).toContain('only the Alchemy Manual recipe');
  // 113 outputs: 91 Notes and 22 Modifiers.
  const outputs = assessedItems.flatMap(
    (row) => row.mechanicsReview.curationRecords[0]?.outputs ?? [],
  );
  expect(outputs.filter((output) => output.kind === 'note')).toHaveLength(91);
  expect(outputs.filter((output) => output.kind === 'modifier')).toHaveLength(
    22,
  );
  // Notes on the statistic they qualify.
  for (const [name, targets] of [
    ['Cestus', ['cmd', 'damage', undefined]],
    ['Meteor Hammer', ['attack', 'cmb']],
    ['Lance', ['attack', 'damage']],
    ['Heavy Crossbow', ['attack', 'attack']],
    ['Bladed Scarf', ['attack', 'cmd']],
    ['Gnome Pincher', ['attack', 'cmb']],
    ['Spongestones Sling Bullet', ['damage', undefined]],
    ['Corvus', [undefined, undefined, undefined]],
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
    `weapons-and-ammo-429-notice-${book}-complete-chain`;
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
      `weapons-and-ammo-429-whole-content-${row.externalKey.split('/')[1]}`,
    );
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices.filter((book) => book !== 'PZO1110').map(holdId),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  // The rejected alternates' books are not required: the Legacy of Fire
  // meteor hammer, the Advanced Race Guide horsechopper, the Inner Sea World
  // Guide and Adventurer's Armory urumis, the Elves of Golarion arrows and the
  // Inner Sea World Guide firearm bullet.
  expect(candidate(METEOR_HAMMER).requiredNotices).not.toContain('PZO9404');
  expect(candidate('Horsechopper').requiredNotices).not.toContain('PZO1121');
  expect(candidate('Urumi').requiredNotices).not.toContain('PZO9226');
  expect(candidate('Urumi').requiredNotices).not.toContain('PZO9410');
  for (const name of ['Pheromone Arrow', 'Splintercloud Arrow'])
    expect(candidate(name).requiredNotices, name).not.toContain('PZO9402');
  expect(candidate('Firearm Bullet').requiredNotices).not.toContain('PZO9226');
  // Record-level "D&D 3.5" tags are held, not excluded.
  const tagged = assessedItems.filter((row) => row.holdIds.length > 1);
  expect(tagged.map((row) => row.name)).toEqual(['Thorn Arrow']);
  const id = THORN_ARROW.split('/')[1];
  expect(tagged[0]?.recordTags).toEqual(['D&D 3.5']);
  expect(tagged[0]?.holdIds).toEqual([
    `weapons-and-ammo-429-whole-content-${id}`,
    `weapons-and-ammo-429-record-level-3.5-tag-${id}`,
  ]);
  // Inherited rules the bodies apply, other than Unchained action costs.
  expect(
    Object.fromEntries(
      assessedItems
        .map(
          (row) =>
            [
              row.name,
              row.inheritedRuleNotices
                .map((notice) => notice.book)
                .filter((book) => book !== 'PZO1131'),
            ] as const,
        )
        .filter(([, books]) => books.length),
    ),
  ).toEqual({
    'Entangling Bolt (Siege)': ['PZO1118'],
    'Alchemical Cartridge (Flare)': ['PZO1118'],
    'Alchemical Cartridge (Gray Dust Shot)': ['PZO1118'],
    'Alchemical Cartridge (Repellent)': ['PZO1118'],
    'Double Crossbow': ['PZO1115'],
    'Gnome Pincher': ['PZO1115'],
    'Radium Rifle': ['DYN0032-E', 'PZO1118'],
  });
  // Core Rulebook items whose body is the Core Rulebook DESC are held on
  // their notices: the cited Ultimate Equipment and Unchained.
  for (const key of [SPEAR, LONGSWORD, LANCE]) {
    expect(candidate(key).coreRulebookWording, key).toBe('same');
    expect(candidate(key).requiredNotices, key).toEqual([
      'PZO1123',
      'PZO1131',
      'PZO1110',
    ]);
  }
  for (const key of [SPEAR, LONGSWORD])
    expect(
      candidate(key).mechanicsReview.gearReview.disagreements,
      key,
    ).toEqual([]);
  // The handwraps and traveling kettle are the Martial Arts Handbook DESC.
  expect(candidate(HANDWRAPS).requiredNotices).toEqual([
    'PZO9493',
    'PZO1131',
    'PZO1123',
    'PZO1110',
  ]);
  expect(candidate(KETTLE).requiredNotices).toEqual([
    'PZO9493',
    'PZO1131',
    'PZO1110',
  ]);
  // Unchained action-cost metadata anywhere in the bound closure requires
  // the held PZO1131: the 64 records with an action. No ammunition record's
  // closure reaches it.
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
  expect(unchainedOwn).toHaveLength(64);
  expect(
    assessedItems
      .filter((row) => row.requiredNotices.includes('PZO1131'))
      .map((row) => row.externalKey)
      .sort(),
  ).toEqual(unchainedOwn);
  for (const row of assessedItems)
    expect(
      row.inheritedRuleNotices.some(
        (notice) =>
          notice.book === 'PZO1131' &&
          notice.rule.includes("item's own action"),
      ),
      row.name,
    ).toBe(unchainedOwn.includes(row.externalKey));
  // The handwraps also reach it through the spells their linked amulet of
  // mighty fists links.
  expect(
    Object.fromEntries(
      assessedItems
        .map(
          (row) =>
            [
              row.name,
              row.inheritedRuleNotices
                .filter(
                  (notice) =>
                    notice.book === 'PZO1131' &&
                    notice.rule.includes('on the bound'),
                )
                .map((notice) => notice.rule.split('on the bound ')[1]),
            ] as const,
        )
        .filter(([, rules]) => rules.length),
    ),
  ).toEqual({
    Handwraps: [
      'Magic Fang, Greater record (cost 2, type action)',
      'Magic Fang record (cost 2, type action)',
      'Permanency record (cost 6, type action)',
    ],
  });
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

it('pins all 81 keys, the complete bodies and literal PCGen evidence in the shared store', async () => {
  expect(review.candidates).toHaveLength(81);
  expect(new Set(review.candidates.map((row) => row.externalKey)).size).toBe(
    81,
  );
  expect(review.counts).toEqual({
    total: 81,
    admitted: 0,
    held: 81,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 0,
    excludedFolders: 0,
    recordLevel35Holds: 1,
  });
  expect(excludedRows).toEqual([]);
  expect(preview.entries).toHaveLength(81);
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
  // The bodies that are a PCGen DESC word for word.
  const words = (text: string) =>
    text
      .replace(/<[^>]+>/g, '')
      .replace(/&quot;/g, '"')
      .replace(/@UUID\[[^\]]*\]\{([^}]*)\}/g, '$1')
      .replace(/[’']/g, "'")
      .replace(/[–—]/g, '-')
      .replace(/\s+/g, ' ')
      .replace(/ ([.)])/g, '$1')
      .trim();
  for (const [key, wording] of [
    [SPEAR, 'same'],
    [LONGSWORD, 'same'],
    [LANCE, 'same'],
    [HANDWRAPS, 'same-desc'],
    [KETTLE, 'same-desc'],
  ] as const) {
    const row = candidate(key);
    expect(row.coreRulebookWording, key).toBe(wording);
    const text = /\tDESC:([^\t|]*)/.exec(row.comparison!.literalRow)?.[1];
    expect(words(row.mechanicsReview.descriptionText), key).toBe(
      words(text ?? ''),
    );
  }
  // The halberd's body is its DESC but for "axelike".
  expect(
    words(
      /\tDESC:([^\t|]*)/.exec(candidate('Halberd').comparison!.literalRow)![1]!,
    ).replace('axe-like', 'axelike'),
  ).toBe(words(candidate('Halberd').mechanicsReview.descriptionText));
  // Records with no PCGen data row stay held on an unresolved root origin.
  expect(
    assessedItems
      .filter((row) => !row.comparison)
      .map((row) => row.name)
      .sort(),
  ).toEqual(NO_PCGEN);
  for (const row of assessedItems.filter((row) => !row.comparison))
    expect(row.inheritedRuleUnresolvedOrigins[0], row.name).toMatch(
      /no PCGen data row at the pin names it/,
    );
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
      required: 0,
      missing: 0,
      descriptions: { checked: 81 },
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
    expect(preview.closure.map((row) => row.name).sort()).toEqual(CLOSURE);
    const ours = new Set(assessedItems.map((row) => row.externalKey));
    const gate = assessWithUnclearedHolds({
      artifact: authoritative,
      ...reviewedAdmission,
    });
    expect(gate.admitted.filter((row) => ours.has(row.externalKey))).toEqual(
      [],
    );
    expect(gate.failures.filter((row) => ours.has(row.externalKey))).toEqual(
      [],
    );
    const held = gate.held.filter((row) => ours.has(row.externalKey));
    expect(held).toHaveLength(81);
    // The uncited Radium Rifle also falls in the importer's known notice
    // hold "dynamite-comics", which the gate reports first (as #425's Thark
    // Rifle).
    for (const row of held)
      if (row.externalKey === RADIUM_RIFLE)
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
    // Confirming the longsword's whole content (its body is the Core Rulebook
    // DESC) still holds it on the held Ultimate Equipment and Unchained
    // notices.
    const confirmed = assessWithUnclearedHolds({
      artifact: authoritative,
      ...reviewedAdmission,
      assessments: reviewedAdmission.assessments.map((row) =>
        row.externalKey === LONGSWORD
          ? { ...row, status: 'confirmed' as const }
          : row,
      ),
    });
    expect(
      confirmed.admitted.some((row) => row.externalKey === LONGSWORD),
    ).toBe(false);
    expect(
      confirmed.held.find((row) => row.externalKey === LONGSWORD)?.reason,
    ).toMatch(/Notice holds|Missing or unreviewed required notices/);
  } finally {
    await tree.dispose();
  }
});
