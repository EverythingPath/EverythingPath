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
import {
  assessCatalogAdmission,
  buildAssessmentBinding,
} from '../../scripts/catalog/admission';
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
} from '../fixtures/weapons-and-ammo-428/data';
import {
  rangedWeapon,
  weaponSheet,
} from '../fixtures/weapons-and-ammo-428/sheet';
import { materializePinnedTree, readPinned } from './pinned-sources';
import { bindSnapshotToCurrentNotices } from './batch-ownership';
import { assessWithUnclearedHolds } from './uncleared-holds';

const sha = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
const EARTH_BREAKER = 'pf1/b0hY6M0sYwvjnMZH';
const DAGGER = 'pf1/fOSuWwRSZLTrROch';
const SCIZORE = 'pf1/fqiZkTAd1BlgOaII';
const SEA_KNIFE = 'pf1/nq0b69zA7Q35n0oE';
const SPLIT_BLADE = 'pf1/hvWgMofsY3heVbFo';
const SEAX = 'pf1/kY1zv3pOlGUfyX29';
const GUISARME = 'pf1/hBgclgYrnhecN3pX';
const RANSEUR = 'pf1/naiJiv2t267Xyi09';
const COMPOSITE_LONGBOW = 'pf1/msTiRxZVnecbPCA8';
const RAINING_ARROW = 'pf1/ge2hGHa9k1ly2hch';
const TANGLESHOT_ARROW = 'pf1/gxTN2rn0eYV4QsYJ';
const BALLISTA_NET = 'pf1/nsUPYzbxo7c3YvXy';
const HUGE_RAM = 'pf1/irDUE4zovCD1YbxN';
const DWARVEN_LONGAXE = 'pf1/darjoc2dHbh3Czxy';
const DOUBLE_WARAXE = 'pf1/kTiSd8vO1cPMxXWo';
// Statistics that differ from the compared PCGen row (each one is recorded).
const DISAGREEMENTS: Record<string, string[]> = {
  Tonfa: ['qualities'],
  'Throwing Arrow': ['price'],
  'Lungchuan Tamo': ['rangeIncrement'],
  'Sword Cane Pistol': ['qualities'],
  'Spring Blade': ['rangeIncrement'],
  Taiaha: ['damageTypes'],
  'Elven Branched Spear': ['qualities'],
  'Raining Arrow': ['price'],
  'Tangleshot Arrow': ['price'],
  'Kyoketsu Shoge': ['rangeIncrement'],
  'Barbed Spear': ['price'],
  'Split-Blade Sword': ['qualities'],
  'Tiger Fork': ['qualities'],
  'Gate Breaker Ballista': ['proficiency', 'handedness'],
  'Totem Spear': ['rangeIncrement', 'damageTypes', 'qualities'],
  'Tekko-Kagi': ['weight', 'qualities'],
  'Dwarven Double Waraxe': ['weight'],
  'Broken-Back Seax': ['damageTypes'],
  'Wrist Launcher': ['damageTypes'],
  'Throwing Shield': ['handedness'],
  'Halfling Double Sling': ['qualities'],
  'Sea-Knife': ['damageTypes', 'proficiency'],
  'Ballista Net': ['weight'],
  'Snag Net': ['damageTypes'],
};
// Bodies that state no rule: explicit covered/no-output description records.
const NO_OUTPUT = [
  'Earth Breaker',
  'Dwarven Sphinx Hammer',
  'Tonfa',
  'Lungchuan Tamo',
  'Light Pick',
  'Dwarven Longaxe',
  'Scythe',
  'Flindbar',
  'Mattock',
  'Throwing Axe',
  'Gnome Flick-Mace',
  'Guisarme',
  'Bo Staff',
  'Tiger Fork',
  'Dogslicer',
  'Kama',
  'Falcata',
  'Dart',
  'Repeating Crossbow Bolt',
  'Sap',
  'Ranseur',
  'Sickle',
];
// Records no PCGen data row at the pin names.
const NO_PCGEN = [
  'Alchemical Cartridge (Toxin)',
  'Brutal Bola',
  'Crystal Chakram',
  'Dragoon Cartridge',
  'Dragoon Pistol',
  'Dueling Sword',
  'Dwarven Heavy Axe-Gauntlet',
  'Dwarven Sphinx Hammer',
  'Lawrence 1917 Flamethrower',
  'Lawrence 1917 Flamethrower Fuel Tank',
  'M1917 Chemical Grenade',
  'Mosin-Nagant M1891 Rifle',
  'Phaleros',
  'Smoke Bullet',
  'Spider-Leg Sickle',
];
// The bodies the batch's content closures reach (full-corpus preview).
const CLOSURE = [
  'Black Tentacles',
  'Bless Water',
  'Coat Pistol',
  'Exotic Weapon Proficiency',
  'Holy water',
  'Longsword',
  'Net',
  'Rapid Reload',
  'Slow',
  'Sword Cane',
  'Tanglefoot Bag',
  'Vital Strike',
  'Weapon Finesse',
  'Web',
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
  // martial weapons and with the split-blade sword and broken-back seax by
  // hand.
  const sheet = weaponSheet({
    weapons: [EARTH_BREAKER, DAGGER, SCIZORE, SEA_KNIFE, SPLIT_BLADE, SEAX],
    strength: 14,
    bab: 5,
    categories: ['simple', 'martial'],
    baseTypes: ['split-blade sword', 'broken-back seax'],
  });
  const plain = calculateCharacterSheet(sheet).attackRoutines;
  // One-handed and light: +2 Strength on damage; two-handed: +3. The
  // scizore's −1 and the sea-knife's −2 circumstance penalty apply to every
  // attack with them.
  expect(line(plain, EARTH_BREAKER)).toEqual([7, 3, '2d6', 3]);
  expect(line(plain, DAGGER)).toEqual([7, 2, '1d4', 2]);
  expect(line(plain, SCIZORE)).toEqual([6, 2, '1d10', 2]);
  expect(line(plain, SEA_KNIFE)).toEqual([5, 2, '1d4', 2]);
  expect(line(plain, SPLIT_BLADE)).toEqual([7, 2, '2d6', 2]);
  expect(line(plain, SEAX)).toEqual([7, 2, '1d10', 2]);
  // The split-blade sword's −2 below Dexterity 15 and the seax's −2 below
  // Strength 15 apply only under their Situations, and only to their own
  // attacks.
  const selected = calculateCharacterSheet(sheet, {
    situations: [
      ...situations('Split-Blade Sword', `item:${SPLIT_BLADE}`),
      ...situations('Broken-Back Seax', `item:${SEAX}`),
    ],
  }).attackRoutines;
  expect(line(selected, SPLIT_BLADE)).toEqual([5, 2, '2d6', 2]);
  expect(line(selected, SEAX)).toEqual([5, 2, '1d10', 2]);
  expect(line(selected, EARTH_BREAKER)).toEqual([7, 3, '2d6', 3]);
  expect(line(selected, DAGGER)).toEqual([7, 2, '1d4', 2]);
  // Without the exotic proficiencies the split-blade sword and seax take −4.
  const untrained = calculateCharacterSheet(
    weaponSheet({
      weapons: [SPLIT_BLADE, SEAX],
      strength: 14,
      bab: 5,
      categories: ['simple', 'martial'],
    }),
  ).attackRoutines;
  expect(line(untrained, SPLIT_BLADE)).toEqual([3, 2, '2d6', 2]);
  expect(line(untrained, SEAX)).toEqual([3, 2, '1d10', 2]);
});

it('applies each reviewed Modifier only under its Situation', () => {
  for (const [name, target, value] of [
    ['Spring Blade', 'skill.slt', 4],
    ['Dagger', 'skill.slt', 2],
    ['War Razor', 'skill.slt', 2],
    ['Kobold Tail Attachment (Spiked)', 'cmd', 4],
    ['Elven Curve Blade', 'cmd', 2],
    ['Bardiche', 'cmd', 2],
    ['Waveblade', 'cmd', 2],
    ['Pata', 'cmd', 10],
    ['Dwarven Heavy Axe-Gauntlet', 'cmd', 10],
    ['Scizore', 'cmd', 10],
    ['Lucerne Hammer', 'cmb', 2],
    ['Tekko-Kagi', 'cmb', 2],
    // The scizore's +1 shield bonus resolves to the shield leaf (#734).
    ['Scizore', 'ac.shield', 1],
    ['Scizore', 'ac.other', 0],
  ] as const) {
    expect(resolved(name, target), `${name} ${target}`).toBe(0);
    expect(resolved(name, target, true), `${name} ${target}`).toBe(value);
  }
  // The only armor, shield or natural armor bonus in the batch is the
  // scizore's shield bonus, on ac; nothing targets ac.other (#734).
  const defense = preview.entries.flatMap((row) =>
    row.modifiers
      .filter((modifier) =>
        ['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType),
      )
      .map((modifier) => [row.name, modifier.target, modifier.bonusType]),
  );
  expect(defense).toEqual([['Scizore', 'ac', 'shield']]);
  for (const row of preview.entries)
    for (const modifier of row.modifiers)
      expect(String(modifier.target), row.name).not.toBe('ac.other');
  // Weapon and ammunition Modifiers bind to their own attacks.
  for (const [name, target, bonusType, value, situation] of [
    [
      'Sling',
      'attack',
      'untyped',
      -1,
      'hurling ordinary stones with the sling',
    ],
    [
      'Flask Pike',
      'attack',
      'untyped',
      -2,
      'attacking with the flask pike while it is loaded with a flask',
    ],
    [
      'Elven Branched Spear',
      'attack',
      'untyped',
      2,
      'attacks of opportunity provoked by movement made with the elven branched spear',
    ],
    [
      'Barbed Spear',
      'attack',
      'untyped',
      -4,
      'jamming the barbed head into the foot of a creature that is prone, flying above you, or at least one size category larger than you',
    ],
    [
      'Split-Blade Sword',
      'attack',
      'untyped',
      -2,
      'your Dexterity score is less than 15',
    ],
    [
      'Broken-Back Seax',
      'attack',
      'untyped',
      -2,
      'your Strength score is less than 15',
    ],
    [
      'Dwarven Double Waraxe',
      'attack',
      'untyped',
      1,
      'attack rolls after the first when using Cleave or Great Cleave',
    ],
    [
      'Composite Longbow',
      'attack',
      'untyped',
      -2,
      'your Strength modifier is less than the strength rating of the composite bow',
    ],
    ['Reflex Bow', 'attack', 'circumstance', 1, 'while mounted'],
    [
      'Halfling Double Sling',
      'attack',
      'untyped',
      -1,
      'hurling ordinary stones with the double sling',
    ],
    ['Raining Arrow', 'attack', 'untyped', -2, 'firing a raining arrow'],
    ['Tangleshot Arrow', 'attack', 'untyped', -1, 'firing a tangleshot arrow'],
  ] as const)
    expect(modifiers(name), name).toEqual([
      expect.objectContaining({
        target,
        bonusType,
        value,
        condition: { situation: { local: situation }, weapon: '$self' },
      }),
    ]);
  // The stonebow's −1 with stones and −2 when shot with one hand are two
  // Situations that can apply together.
  expect(modifiers('Stonebow')).toEqual(
    [
      [-1, 'shooting ordinary stones with the stonebow'],
      [-2, 'shooting the stonebow with one hand'],
    ].map(([value, local]) =>
      expect.objectContaining({
        target: 'attack',
        bonusType: 'untyped',
        value,
        condition: { situation: { local }, weapon: '$self' },
      }),
    ),
  );
  // Unconditional penalties on every attack with the weapon.
  for (const [name, bonusType, value] of [
    ['Sea-Knife', 'circumstance', -2],
    ['Scizore', 'untyped', -1],
    ['Lawrence 1917 Flamethrower', 'untyped', -2],
  ] as const)
    expect(
      modifiers(name).filter((row) => row.target === 'attack'),
      name,
    ).toEqual([
      expect.objectContaining({
        target: 'attack',
        bonusType,
        value,
        condition: { weapon: '$self' },
      }),
    ]);
  // The huge ram: −4 on attack and damage rolls without charging (never a
  // gallery ram), and the pick and screw heads' +2 circumstance bonuses
  // against stone or earthen structures, under three Situations (as #427's
  // rams).
  expect(modifiers(HUGE_RAM)).toEqual(
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
});

it('applies ammunition Modifiers only to the attacks that fire that ammunition', () => {
  // A longbow (the composite longbow's mapped statistics) fires, in turn, a
  // raining and a tangleshot arrow; a dagger attacks in melee (Strength and
  // Dexterity 14, base attack +5). The ammunition definitions carry explicit
  // ammunition flags at this resolver seam; every Situation
  // is selected at once.
  const ammo = [RAINING_ARROW, TANGLESHOT_ARROW];
  const base = weaponSheet({
    weapons: [DAGGER],
    items: ammo,
    strength: 14,
    dexterity: 14,
    bab: 5,
    categories: ['simple', 'martial'],
  });
  const sheet = (ammunition: boolean) => ({
    ...base,
    entries: [
      ...base.entries,
      {
        _id: 'item:longbow',
        kind: 'item' as const,
        active: true,
        catalogEntryId: 'longbow',
        state: { kind: 'item' as const },
      },
      ...ammo.map((key) => ({
        _id: `routine:${key}`,
        kind: 'attackRoutine' as const,
        active: true,
        state: {
          kind: 'attackRoutine' as const,
          name: key,
          weaponEntryId: 'item:longbow',
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
        _id: 'longbow',
        name: 'Longbow',
        ruleIdentity: 'fixture-longbow',
        modifiers: [],
        detail: {
          kind: 'item' as const,
          consumable: false,
          weapon: rangedWeapon(COMPOSITE_LONGBOW),
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
    [`routine:${DAGGER}`]: [7, 2],
    [`routine:${RAINING_ARROW}`]: [5, 0],
    [`routine:${TANGLESHOT_ARROW}`]: [6, 0],
  });
  // Removing the ammunition flag remains a resolver negative control.
  expect(lines(false)).toEqual({
    [`routine:${DAGGER}`]: [7, 2],
    [`routine:${RAINING_ARROW}`]: [7, 0],
    [`routine:${TANGLESHOT_ARROW}`]: [7, 0],
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
      'Earth Breaker',
      {
        proficiency: 'martial',
        handedness: 'twoHanded',
        dice: '2d6',
        threat: 20,
        mult: 3,
      },
    ],
    [
      'Dagger',
      {
        proficiency: 'simple',
        handedness: 'light',
        dice: '1d4',
        threat: 19,
        mult: 2,
        finesse: true,
        thrown: true,
        thrownRangeIncrement: 10,
      },
    ],
    [
      'Guisarme',
      {
        proficiency: 'martial',
        handedness: 'twoHanded',
        dice: '2d4',
        threat: 20,
        mult: 3,
      },
    ],
    [
      'Composite Longbow',
      {
        proficiency: 'martial',
        handedness: 'twoHanded',
        dice: '1d8',
        mult: 3,
        rangeIncrement: 110,
      },
    ],
    [
      'Elven Curve Blade',
      {
        proficiency: 'exotic',
        handedness: 'twoHanded',
        dice: '1d10',
        threat: 18,
        mult: 2,
        finesse: true,
      },
    ],
  ] as const)
    expect(entry(name).detail.weapon, name).toMatchObject(weapon);
  // Importer gaps the report lists: siege engines keep Foundry's subtypes
  // (the fiend's mouth cannon imports as a personal exotic weapon, the siege
  // tower and the chemical grenade as "misc"/"other"), items without damage
  // map no dice, and the sling imports as a thrown weapon.
  for (const name of [
    'Gargantuan Siege Tower',
    'Escalade Ladder, Large',
    'Escalade Ladder, Huge',
    'Escalade Ladder, Gargantuan',
    'M1917 Chemical Grenade',
    'Wrist Launcher',
    'Snag Net',
  ])
    expect(entry(name).detail.weapon?.dice ?? null, name).toBeNull();
  expect(entry(HUGE_RAM).detail.weapon).toMatchObject({
    proficiency: 'siege',
    handedness: 'assault',
    dice: '3d6',
  });
  expect(entry('Gate Breaker Ballista').detail.weapon).toMatchObject({
    proficiency: 'siege',
    handedness: 'direct',
    dice: '6d8',
  });
  expect(entry("Fiend's Mouth Cannon").detail.weapon).toMatchObject({
    proficiency: 'exotic',
    handedness: 'ranged',
  });
  expect(candidate("Fiend's Mouth Cannon").itemKind).toBe('siege engine');
  expect(entry('Gargantuan Siege Tower').detail.weapon).toMatchObject({
    proficiency: 'misc',
    handedness: 'other',
  });
  expect(candidate('Gargantuan Siege Tower').itemKind).toBe('siege engine');
  expect(candidate('M1917 Chemical Grenade').itemKind).toBe('weapon');
  expect(entry('Sling').detail.weapon).toMatchObject({
    thrown: false,
    strengthDamage: 'sling',
    reload: 'move',
    dice: '1d4',
  });
  // Specific variants name another item in baseTypes; no baseItem is mapped.
  for (const [name, other] of [
    ['Dueling Sword', 'Longsword'],
    ['Horse Bow', 'Longbow'],
    ['Spiral Rapier', 'Rapier'],
  ] as const)
    expect(candidate(name).mechanicsReview.gearReview.baseItem, name).toContain(
      other,
    );
  expect(
    candidate(RAINING_ARROW).mechanicsReview.gearReview.baseItem,
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
  expect(descriptions).toBe(98);
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
  // The gnome flick-mace's body is an editorial remark, not the book's text.
  expect(
    candidate('Gnome Flick-Mace').inheritedRuleUnresolvedOrigins,
  ).toContainEqual(expect.stringContaining('editorial remark'));
  // Notes on the statistic they qualify.
  for (const [name, targets] of [
    ['Brass Knuckles', ['attack', 'cmd', 'damage', undefined]],
    ['Scizore', ['ac', 'cmd']],
    ['Sling', ['attack', 'attack', 'damage']],
    ['Composite Longbow', ['attack', 'attack', 'damage']],
    ['Snag Net', ['attack', 'cmb', undefined]],
    ['Elven Curve Blade', ['attack', 'cmd']],
    ['Gate Breaker Ballista', ['attack', undefined]],
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
    `weapons-and-ammo-428-notice-${book}-complete-chain`;
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
      `weapons-and-ammo-428-whole-content-${row.externalKey.split('/')[1]}`,
    );
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices.filter((book) => book !== 'PZO1110').map(holdId),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  // The rejected alternates' books are not required: the Weapon Master's
  // Handbook flick-mace, the Elves of Golarion raining and tangleshot arrows
  // and the Advanced Race Guide dogslicer.
  expect(candidate('Gnome Flick-Mace').requiredNotices).not.toContain(
    'PZO9463',
  );
  for (const key of [RAINING_ARROW, TANGLESHOT_ARROW])
    expect(candidate(key).requiredNotices, key).not.toContain('PZO9402');
  expect(candidate('Dogslicer').requiredNotices).not.toContain('PZO1121');
  // Record-level "D&D 3.5" tags are held, not excluded.
  const tagged = assessedItems.filter((row) => row.holdIds.length > 1);
  expect(tagged.map((row) => row.name)).toEqual(['Smoke Bullet', "Bich'hwa"]);
  for (const row of tagged) {
    const id = row.externalKey.split('/')[1];
    expect(row.recordTags, row.name).toEqual(['D&D 3.5']);
    expect(row.holdIds, row.name).toEqual([
      `weapons-and-ammo-428-whole-content-${id}`,
      `weapons-and-ammo-428-record-level-3.5-tag-${id}`,
    ]);
  }
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
    "Alchemical Cartridge (Dragon's Breath)": ['PZO1118'],
    'Dragoon Cartridge': ['PZO1118'],
    'Mosin-Nagant M1891 Rifle': ['PZO1118'],
    'Baston Fighting Stick': ['PZO1123'],
    'Ballista Net': ['PZO1118'],
    'Alchemical Cartridge (Toxin)': ['PZO1118'],
  });
  // Core Rulebook items whose body is the Core Rulebook DESC, with every
  // compared statistic matching, are held only on their notices: the cited
  // Ultimate Equipment and Unchained.
  for (const key of [GUISARME, RANSEUR]) {
    expect(candidate(key).coreRulebookWording, key).toBe('same');
    expect(candidate(key).requiredNotices, key).toEqual([
      'PZO1123',
      'PZO1131',
      'PZO1110',
    ]);
    expect(
      candidate(key).mechanicsReview.gearReview.disagreements,
      key,
    ).toEqual([]);
  }
  // Unchained action-cost metadata anywhere in the bound closure requires
  // the held PZO1131: the 86 records with an action, and three ammunition
  // records through the bodies they link (the raining arrow's holy water, the
  // tangleshot arrow's tanglefoot bag and the ballista net's net).
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
  expect(unchainedOwn).toHaveLength(86);
  expect(
    assessedItems
      .filter((row) => row.requiredNotices.includes('PZO1131'))
      .map((row) => row.externalKey)
      .sort(),
  ).toEqual(
    [...unchainedOwn, RAINING_ARROW, TANGLESHOT_ARROW, BALLISTA_NET].sort(),
  );
  const bound = Object.fromEntries(
    assessedItems
      .map(
        (row) =>
          [
            row.name,
            row.inheritedRuleNotices.filter(
              (notice) =>
                notice.book === 'PZO1131' &&
                notice.rule.includes('on the bound'),
            ).length,
          ] as const,
      )
      .filter(([, count]) => count),
  );
  expect(bound).toEqual({
    'Dueling Sword': 1,
    'Sword Cane Pistol': 2,
    'Raining Arrow': 2,
    'Tangleshot Arrow': 4,
    'Ballista Net': 1,
    'Snag Net': 1,
  });
  for (const row of assessedItems)
    expect(
      row.inheritedRuleNotices.some(
        (notice) =>
          notice.book === 'PZO1131' &&
          notice.rule.includes("item's own action"),
      ),
      row.name,
    ).toBe(unchainedOwn.includes(row.externalKey));
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
    held: 98,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 2,
    excludedFolders: 2,
    recordLevel35Holds: 2,
  });
  // The two Foundry folder records are excluded by the import contract.
  expect(excludedRows.map((row) => [row.name, row.rawKey])).toEqual([
    ['Siege Weapons', '!folders!kcvTVAG7Ax7g3UcQ'],
    ['Martial Weapons', '!folders!ojvASzhaCGmnx8xQ'],
  ]);
  expect(preview.entries).toHaveLength(98);
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
  // The bodies that are a PCGen DESC or SPROP word for word.
  const words = (text: string) =>
    text
      .replace(/<[^>]+>/g, '')
      .replace(/&quot;/g, '"')
      .replace(/[’']/g, "'")
      .replace(/[–—]/g, '-')
      .replace(/\s+/g, ' ')
      .replace(/ \./g, '.')
      .trim();
  for (const [key, field, wording] of [
    [GUISARME, 'DESC', 'same'],
    [RANSEUR, 'DESC', 'same'],
    [SEAX, 'DESC', 'same-desc'],
    ['pf1/jk9EoGeHslLieXsf', 'DESC', 'same-desc'],
    [DWARVEN_LONGAXE, 'SPROP', 'same-sprop'],
    [DOUBLE_WARAXE, 'SPROP', 'same-sprop'],
  ] as const) {
    const row = candidate(key);
    expect(row.coreRulebookWording, key).toBe(wording);
    const text = new RegExp(`\\t${field}:([^\\t|]*)`).exec(
      row.comparison!.literalRow,
    )?.[1];
    expect(words(row.mechanicsReview.descriptionText), key).toBe(
      words(text ?? ''),
    );
  }
  // The split-blade sword's body is its DESC but for PCGen's stray space; the
  // baston's adds a bracketed book reference; the horse bow's adds a last
  // sentence.
  const desc = (key: string) =>
    words(/\tDESC:([^\t|]*)/.exec(candidate(key).comparison!.literalRow)![1]!);
  expect(desc(SPLIT_BLADE).replace('yet- effective', 'yet-effective')).toBe(
    words(candidate(SPLIT_BLADE).mechanicsReview.descriptionText),
  );
  expect(
    words(
      candidate('Baston Fighting Stick').mechanicsReview.descriptionText,
    ).replace(/ \(\s*Pathfinder RPG Ultimate Equipment 22\)/, ''),
  ).toBe(desc('pf1/lxN8LUTXzcckKu32'));
  expect(
    words(candidate('Horse Bow').mechanicsReview.descriptionText).startsWith(
      desc('pf1/lNkiFRCBELwKFaTg'),
    ),
  ).toBe(true);
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
      descriptions: { checked: 98 },
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
    const gate = assessCatalogAdmission({
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
    expect(held).toHaveLength(98);
    for (const row of held)
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
    // Confirming the guisarme's whole content (its body is the Core Rulebook
    // DESC) still holds it on the held Ultimate Equipment and Unchained
    // notices.
    const confirmed = assessWithUnclearedHolds({
      artifact: authoritative,
      ...reviewedAdmission,
      assessments: reviewedAdmission.assessments.map((row) =>
        row.externalKey === GUISARME
          ? { ...row, status: 'confirmed' as const }
          : row,
      ),
    });
    expect(confirmed.admitted.some((row) => row.externalKey === GUISARME)).toBe(
      false,
    );
    expect(
      confirmed.held.find((row) => row.externalKey === GUISARME)?.reason,
    ).toMatch(/Notice holds|Missing or unreviewed required notices/);
  } finally {
    await tree.dispose();
  }
});
