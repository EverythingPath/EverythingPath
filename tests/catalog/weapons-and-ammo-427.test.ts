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
} from '../fixtures/weapons-and-ammo-427/data';
import {
  rangedWeapon,
  weaponSheet,
} from '../fixtures/weapons-and-ammo-427/sheet';
import { materializePinnedTree, readPinned } from './pinned-sources';
import { bindSnapshotToCurrentNotices } from './batch-ownership';
import { assessWithUnclearedHolds } from './uncleared-holds';

const sha = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
const GREATAXE = 'pf1/Wx22UaMqWgCrYi7r';
const KUKRI = 'pf1/Uw42p33QKEUhlSMi';
const SICA = 'pf1/P3gUxPKX72ZnojXx';
const TAILBLADE = 'pf1/QigjqjvJ8j6f62Mo';
const SICKLE_SWORD = 'pf1/a6w5DSGKSZo6LvTN';
const LONGSPEAR = 'pf1/awNlvqmRM1TZRVR9';
const LONGBOW = 'pf1/PqJih70EG2A1XNGf';
const LODESTONE_ARROW = 'pf1/YblsiTF25I6uG9jN';
const INCENDIARY_ARROW = 'pf1/TnlmmOvNB0gAy4LS';
const BLUNT_ARROW = 'pf1/TaRfSanfIvyJeCdm';
const COLOSSAL_RAM = 'pf1/RYGdmT9D0wqFL8F3';
const GARGANTUAN_RAM = 'pf1/X9ii9ZxZO5XKuxP4';
const FROST_BRAND = 'pf1/TXd09UXUUNBWPk4Q';
const RADIUM_PISTOL = 'pf1/aLCy6zW8AldME74r';
const BOULDER_HELMET = 'pf1/QXs5iZ1gpobwCNp9';
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
  // martial weapons and with the sica and sickle-sword by hand.
  const sheet = weaponSheet({
    weapons: [GREATAXE, KUKRI, SICA, TAILBLADE, SICKLE_SWORD],
    strength: 14,
    bab: 5,
    categories: ['simple', 'martial'],
    baseTypes: ['sica', 'sickle-sword'],
  });
  const plain = calculateCharacterSheet(sheet).attackRoutines;
  // One-handed and light: +2 Strength on damage; two-handed: +3.
  expect(line(plain, GREATAXE)).toEqual([7, 3, '1d12', 3]);
  expect(line(plain, KUKRI)).toEqual([7, 2, '1d4', 2]);
  expect(line(plain, SICA)).toEqual([7, 2, '1d6', 2]);
  expect(line(plain, TAILBLADE)).toEqual([7, 2, '1d3', 2]);
  expect(line(plain, SICKLE_SWORD)).toEqual([7, 2, '1d8', 2]);
  // The sica's +1 against shield users, the loose tailblade's −4 and the
  // sickle-sword's +2 after its swift action apply only under their
  // Situations, and only to their own attacks.
  const selected = calculateCharacterSheet(sheet, {
    situations: [
      ...situations('Sica', `item:${SICA}`),
      ...situations('Tailblade', `item:${TAILBLADE}`),
      ...situations('Sickle-Sword', `item:${SICKLE_SWORD}`),
    ],
  }).attackRoutines;
  expect(line(selected, SICA)).toEqual([8, 2, '1d6', 2]);
  expect(line(selected, TAILBLADE)).toEqual([3, 2, '1d3', 2]);
  expect(line(selected, SICKLE_SWORD)).toEqual([9, 2, '1d8', 2]);
  expect(line(selected, GREATAXE)).toEqual([7, 3, '1d12', 3]);
  expect(line(selected, KUKRI)).toEqual([7, 2, '1d4', 2]);
  // Without the exotic proficiencies the sica and sickle-sword take −4.
  const untrained = calculateCharacterSheet(
    weaponSheet({
      weapons: [SICA, SICKLE_SWORD],
      strength: 14,
      bab: 5,
      categories: ['simple', 'martial'],
    }),
  ).attackRoutines;
  expect(line(untrained, SICA)).toEqual([3, 2, '1d6', 2]);
  expect(line(untrained, SICKLE_SWORD)).toEqual([3, 2, '1d8', 2]);
});

it('applies each reviewed Modifier only under its Situation', () => {
  for (const [name, target, value] of [
    ['Screaming Bullet', 'skill.int', 5],
    ['Halfling Rope-Shot', 'skill.slt', 2],
    ['Switchscythe', 'skill.blf', 5],
    ['Switchscythe', 'skill.slt', 5],
    ['Kobold Tail Attachment (Sweeper)', 'cmd', 4],
    ['Kobold Tail Attachment (Long Lash)', 'cmd', 4],
    ['Bec de Corbin', 'cmb', 2],
    ['Armor Spikes', 'cmb', -4],
    ['Dwarven Boulder Helmet', 'cmb', 2],
    // A circumstance bonus to AC resolves to the other-bonuses leaf.
    ['Dwarven Boulder Helmet', 'ac.other', 2],
  ] as const) {
    expect(resolved(name, target), `${name} ${target}`).toBe(0);
    expect(resolved(name, target, true), `${name} ${target}`).toBe(value);
  }
  expect(modifiers('Dwarven Boulder Helmet')).toEqual([
    expect.objectContaining({
      target: 'cmb',
      bonusType: 'circumstance',
      value: 2,
      condition: {
        situation: {
          local: 'attempting a bull rush with the dwarven boulder helmet',
        },
      },
    }),
    expect.objectContaining({
      target: 'ac',
      bonusType: 'circumstance',
      value: 2,
      condition: {
        situation: { local: 'against critical hit confirmation rolls' },
      },
    }),
  ]);
  // No armor, shield or natural armor bonus is curated in the batch, and
  // nothing targets ac.other (#734).
  for (const row of preview.entries)
    for (const modifier of row.modifiers) {
      expect(String(modifier.target), row.name).not.toBe('ac.other');
      expect(['armor', 'shield', 'naturalArmor'], row.name).not.toContain(
        modifier.bonusType,
      );
    }
  // Weapon and ammunition Modifiers bind to their own attacks.
  for (const [name, target, bonusType, value, situation] of [
    [
      'Sica',
      'attack',
      'untyped',
      1,
      'against opponents using bucklers, light shields, or heavy shields',
    ],
    [
      'Light Crossbow',
      'attack',
      'untyped',
      -2,
      'shooting the light crossbow with one hand',
    ],
    [
      'Halfling Sling Staff',
      'attack',
      'untyped',
      -1,
      'hurling ordinary stones with the halfling sling staff',
    ],
    [
      'Tailblade',
      'attack',
      'untyped',
      -4,
      'using a loosely attached tailblade',
    ],
    [
      'Sling Glove',
      'attack',
      'untyped',
      -4,
      'throwing a stone at an adjacent target',
    ],
    [
      'Sickle-Sword',
      'attack',
      'untyped',
      2,
      'your next attack roll this turn after spending a swift action while wielding the sickle-sword in one hand and nothing in the other',
    ],
    [
      'Blunt Arrow',
      'attack',
      'untyped',
      -4,
      'firing a blunt arrow to deal nonlethal damage',
    ],
    ['Incendiary Arrow', 'attack', 'untyped', -1, 'firing an incendiary arrow'],
    [
      'Incendiary Crossbow Bolt',
      'attack',
      'untyped',
      -1,
      'firing an incendiary bolt',
    ],
    [
      'Lodestone Arrow',
      'attack',
      'circumstance',
      4,
      'firing an activated lodestone arrow at a target wearing metal armor or a target made of metal',
    ],
  ] as const)
    expect(modifiers(name), name).toEqual([
      expect.objectContaining({
        target,
        bonusType,
        value,
        condition: { situation: { local: situation }, weapon: '$self' },
      }),
    ]);
  // The rams: −4 on attack and damage rolls without charging (never a
  // gallery ram), and the pick and screw heads' +2 circumstance bonuses
  // against stone or earthen structures, under three Situations.
  const notCharging =
    'making a ram attack as a full-round action without charging (not with a gallery ram)';
  const pick = 'a ram with a pick head attacking a stone structure';
  const screw = 'a ram with a screw head attacking an earthen structure';
  for (const ram of [COLOSSAL_RAM, GARGANTUAN_RAM])
    expect(modifiers(ram), ram).toEqual(
      [
        [-4, 'untyped', notCharging],
        [2, 'circumstance', pick],
        [2, 'circumstance', screw],
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
  // A longbow fires, in turn, a lodestone, an incendiary and a blunt arrow;
  // a kukri attacks in melee (Strength and Dexterity 14, base attack +5). The
  // ammunition definitions use explicit resolver flags; the import bridge now
  // import them; every ammunition Situation is selected at once.
  const ammo = [LODESTONE_ARROW, INCENDIARY_ARROW, BLUNT_ARROW];
  const base = weaponSheet({
    weapons: [KUKRI],
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
          weapon: rangedWeapon(LONGBOW),
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
    [`routine:${KUKRI}`]: [7, 2],
    [`routine:${LODESTONE_ARROW}`]: [11, 0],
    [`routine:${INCENDIARY_ARROW}`]: [6, 0],
    [`routine:${BLUNT_ARROW}`]: [3, 0],
  });
  // Removing the ammunition flag remains a resolver negative control.
  expect(lines(false)).toEqual({
    [`routine:${KUKRI}`]: [7, 2],
    [`routine:${LODESTONE_ARROW}`]: [7, 0],
    [`routine:${INCENDIARY_ARROW}`]: [7, 0],
    [`routine:${BLUNT_ARROW}`]: [7, 0],
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
    'Smoke Arrow': ['weight'],
    Cannon: ['proficiency', 'handedness'],
    'Halfling Rope-Shot': ['weight'],
    Tailblade: ['damage'],
    "Heavy Slaver's Crossbow": ['multiplier'],
    Naginata: ['qualities'],
    'Barbazu Beard': ['damageTypes'],
    "Light Slaver's Crossbow": ['multiplier'],
    Stingchuck: ['handedness'],
    'Trip Arrow': ['price'],
    'Gnome Hooked Hammer': ['damageTypes'],
    'Incendiary Crossbow Bolt': ['price'],
    Sansetsukon: ['qualities'],
    'Double Chicken Saber': ['qualities'],
    'Fighting Fan': ['weight', 'qualities'],
    Nodachi: ['qualities'],
    'Fire Crossbow Bolt': ['weight'],
    'Arrow Springal': ['proficiency', 'handedness'],
    'Wushu Dart': ['weight'],
    'Shang Gou': ['qualities'],
    'Lodestone Arrow': ['price'],
    Tepoztopilli: ['qualities'],
    'Halfling Sling Staff': ['damage'],
    'Dwarven Maulaxe': ['rangeIncrement'],
    'Collapsible Kumade': ['multiplier'],
    'Lantern Staff': ['multiplier'],
    'Emei Piercer': ['weight', 'qualities'],
    'Heavy Trebuchet': ['proficiency', 'handedness'],
    'Chain Spear': ['qualities'],
    'Armor Spikes': ['price', 'weight'],
    'Dwarven Urgrosh': ['damageTypes', 'qualities'],
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
    // Only the frost brand is a magic weapon (+3, masterwork).
    expect(gear.defaults ?? null, row.name).toEqual(
      row.externalKey === FROST_BRAND
        ? { enhancement: 3, masterwork: true }
        : null,
    );
  }
  // Representative mapped weapons: the Core Rulebook statistics.
  for (const [name, weapon] of [
    [
      'Greataxe',
      {
        proficiency: 'martial',
        handedness: 'twoHanded',
        dice: '1d12',
        threat: 20,
        mult: 3,
      },
    ],
    [
      'Kukri',
      {
        proficiency: 'martial',
        handedness: 'light',
        dice: '1d4',
        threat: 18,
        mult: 2,
        finesse: true,
      },
    ],
    [
      'Longspear',
      {
        proficiency: 'simple',
        handedness: 'twoHanded',
        dice: '1d8',
        threat: 20,
        mult: 3,
      },
    ],
    [
      'Light Crossbow',
      {
        proficiency: 'simple',
        handedness: 'twoHanded',
        dice: '1d8',
        threat: 19,
        mult: 2,
        rangeIncrement: 80,
      },
    ],
    [
      'Longbow',
      {
        proficiency: 'martial',
        handedness: 'twoHanded',
        dice: '1d8',
        mult: 3,
        rangeIncrement: 100,
      },
    ],
    [
      'Frost Brand',
      {
        proficiency: 'martial',
        handedness: 'twoHanded',
        dice: '2d6',
        threat: 19,
        mult: 2,
      },
    ],
  ] as const)
    expect(entry(name).detail.weapon, name).toMatchObject(weapon);
  expect(entry(FROST_BRAND).detail.magic).toEqual({
    enhancement: 3,
    masterwork: true,
  });
  // Importer gaps the report lists: galleries map no dice, siege engines keep
  // Foundry's subtypes (the light ballista imports as a personal exotic
  // weapon), the slaver's crossbows keep a ×1 multiplier, the halfling sling
  // staff imports as a thrown weapon and the maulaxe loses its throw.
  for (const name of ['Gargantuan Gallery', 'Huge Gallery'])
    expect(entry(name).detail.weapon?.dice ?? null, name).toBeNull();
  expect(entry(COLOSSAL_RAM).detail.weapon).toMatchObject({
    proficiency: 'siege',
    handedness: 'assault',
    dice: '10d6',
  });
  expect(entry('Heavy Trebuchet').detail.weapon).toMatchObject({
    proficiency: 'siege',
    handedness: 'indirect',
  });
  expect(entry('Light Ballista').detail.weapon).toMatchObject({
    proficiency: 'exotic',
    handedness: 'ranged',
  });
  expect(candidate('Light Ballista').itemKind).toBe('siege engine');
  for (const name of ["Heavy Slaver's Crossbow", "Light Slaver's Crossbow"])
    expect(entry(name).detail.weapon?.mult, name).toBe(1);
  expect(entry('Halfling Sling Staff').detail.weapon).toMatchObject({
    // The source describes a launcher, with sling Strength and reload rules.
    thrown: false,
    strengthDamage: 'sling',
    reload: 'move',
    dice: '1d8',
  });
  expect(entry('Dwarven Maulaxe').detail.weapon?.rangeIncrement).toBe(
    undefined,
  );
  // Specific variants name another item in baseTypes; no baseItem is mapped.
  expect(candidate('Cutlass').mechanicsReview.gearReview.baseItem).toContain(
    'Scimitar',
  );
  expect(candidate(FROST_BRAND).mechanicsReview.gearReview.baseItem).toContain(
    'Greatsword',
  );
  expect(
    candidate(LODESTONE_ARROW).mechanicsReview.gearReview.baseItem,
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
  expect(descriptions).toBe(100);
  // Descriptive bodies get an explicit covered/no-output record.
  for (const name of [
    'Kukri',
    'Longspear',
    'Greataxe',
    'Scimitar',
    'Dire Flail',
    'Orc Double Axe',
    'Nine-Ring Broadsword',
    'Sling Bullet',
  ]) {
    const [record] = candidate(name).mechanicsReview.curationRecords;
    expect(record?.outputs, name).toEqual([]);
    expect(record?.rationale, name).toContain('Explicit covered/no-output');
  }
  // Notes on the statistic they qualify.
  for (const [name, targets] of [
    ['Spiked Gauntlet', ['attack', 'cmd']],
    ['Longbow', ['attack', 'damage']],
    ['Shield Spikes (Heavy)', ['attack', 'damage']],
    ['Kobold Tail Attachment (Sweeper)', ['attack', 'cmb']],
    ['Chain Spear', ['cmb']],
    ['Smoke Arrow', [undefined]],
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
    `weapons-and-ammo-427-notice-${book}-complete-chain`;
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
      `weapons-and-ammo-427-whole-content-${row.externalKey.split('/')[1]}`,
    );
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices.filter((book) => book !== 'PZO1110').map(holdId),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  // Record-level "D&D 3.5" tags are held, not excluded.
  const tagged = assessedItems.filter((row) => row.holdIds.length > 1);
  expect(tagged.map((row) => row.name)).toEqual([
    'Pickaxe',
    'Fire Crossbow Bolt',
  ]);
  for (const row of tagged) {
    const id = row.externalKey.split('/')[1];
    expect(row.recordTags, row.name).toEqual(['D&D 3.5']);
    expect(row.holdIds, row.name).toEqual([
      `weapons-and-ammo-427-whole-content-${id}`,
      `weapons-and-ammo-427-record-level-3.5-tag-${id}`,
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
    'Screaming Bullet': ['PZO1118'],
    'Paddle-Foot Pistol': ['PZO1118'],
    'Rockwasp Bomb (Siege)': ['PZO1112', 'PZO1118'],
    'Defoliant Shot (Siege)': ['PZO1123', 'PZO1118'],
    'Alchemical Cartridge (Molten Shot)': ['PZO1118'],
    'Alchemical Cartridge (Gray Dust)': ['PZO1118'],
    'Alchemical Cartridge (Smoke)': ['PZO1118'],
    Flak: ['PZO1118'],
    'Radium Pistol': ['DYN0032-E', 'PZO1118'],
  });
  // Core Rulebook items whose body is the Core Rulebook DESC, with every
  // compared statistic matching, are held only on their notices: the cited
  // Ultimate Equipment and Unchained.
  for (const key of [KUKRI, LONGSPEAR]) {
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
  // the held PZO1131: here exactly the 81 records with an action. Frost
  // Brand also reaches it through its three linked spells; no record without
  // an action reaches any.
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
  expect(unchainedOwn).toHaveLength(81);
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
      rules.filter((rule) => rule.includes('on the bound')).length,
      row.name,
    ).toBe(row.externalKey === FROST_BRAND ? 3 : 0);
  }
  // Ammunition records carry no action and require no Unchained notice.
  expect(
    assessedItems.filter(
      (row) =>
        row.itemKind.includes('ammunition') &&
        row.requiredNotices.includes('PZO1131'),
    ),
  ).toEqual([]);
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
    held: 100,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 0,
    excludedFolders: 0,
    recordLevel35Holds: 2,
  });
  expect(excludedRows).toEqual([]);
  expect(preview.entries).toHaveLength(100);
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
  // The bodies that are a Core Rulebook DESC word for word.
  const words = (text: string) =>
    text
      .replace(/<[^>]+>/g, '')
      .replace(/[’']/g, "'")
      .replace(/\s+/g, ' ')
      .replace(/ \./g, '.')
      .trim();
  for (const key of [KUKRI, LONGSPEAR]) {
    const row = candidate(key);
    const text = /\tDESC:([^\t|]*)/.exec(row.comparison!.literalRow)?.[1];
    expect(words(row.mechanicsReview.descriptionText), key).toBe(
      words(text ?? ''),
    );
  }
  // The dwarven boulder helmet's body is the Advanced Race Guide SPROP word
  // for word (PCGen escapes the percent sign as "%%"); it is held on its
  // notices.
  const helmet = candidate(BOULDER_HELMET);
  expect(helmet.coreRulebookWording).toBe('same-sprop');
  expect(helmet.mechanicsReview.gearReview.disagreements).toEqual([]);
  expect(helmet.requiredNotices).toEqual(['PZO1121', 'PZO1131', 'PZO1110']);
  const sprop = /\tSPROP:([^\t|]*)/.exec(helmet.comparison!.literalRow)?.[1];
  expect(words(helmet.mechanicsReview.descriptionText)).toBe(
    words((sprop ?? '').replace(/%%/g, '%')),
  );
  expect(helmet.rationale).toContain(
    'Its body is the SPROP of PCGen arg_equip_arms_armor.lst:15',
  );
  // Records with no PCGen data row stay held on an unresolved root origin.
  expect(
    assessedItems
      .filter((row) => !row.comparison)
      .map((row) => row.name)
      .sort(),
  ).toEqual([
    'Alchemical Cartridge (Molten Shot)',
    'Cylinder Rifle',
    'Defoliant Shot (Siege)',
    'Halfling Stitched Sling',
    'Madsen Light Machine Gun',
    'Paddle-Foot Pistol',
    'Radium Pistol',
    'Rockwasp Bomb (Siege)',
    'Screaming Bullet',
  ]);
  for (const row of assessedItems.filter((row) => !row.comparison))
    expect(row.inheritedRuleUnresolvedOrigins[0], row.name).toContain(
      'no PCGen data row at the pin names it',
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
      descriptions: { checked: 100 },
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
    expect(preview.closure.map((row) => row.name).sort()).toEqual([
      'Bolas Bolt',
      'Craft Magic Arms and Armor',
      'Defoliant',
      'Dispel Magic',
      'Greatsword',
      'Ice Storm',
      'Protection from Energy',
      'Rapid Reload',
    ]);
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
    expect(held).toHaveLength(100);
    // The uncited Radium Pistol also falls in the importer's known
    // unattributed-source hold (#227/#241), which the gate reports first.
    for (const row of held)
      if (row.externalKey === RADIUM_PISTOL)
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
    // Confirming the kukri's whole content (its body is the Core Rulebook
    // DESC) still holds it on the held Ultimate Equipment and Unchained
    // notices.
    const confirmed = assessWithUnclearedHolds({
      artifact: authoritative,
      ...reviewedAdmission,
      assessments: reviewedAdmission.assessments.map((row) =>
        row.externalKey === KUKRI
          ? { ...row, status: 'confirmed' as const }
          : row,
      ),
    });
    expect(confirmed.admitted.some((row) => row.externalKey === KUKRI)).toBe(
      false,
    );
    expect(
      confirmed.held.find((row) => row.externalKey === KUKRI)?.reason,
    ).toMatch(/Notice holds|Missing or unreviewed required notices/);
  } finally {
    await tree.dispose();
  }
});
