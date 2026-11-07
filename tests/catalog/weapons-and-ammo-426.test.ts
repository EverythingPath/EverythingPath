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
} from '../fixtures/weapons-and-ammo-426/data';
import {
  rangedWeapon,
  weaponSheet,
} from '../fixtures/weapons-and-ammo-426/sheet';
import { materializePinnedTree, readPinned } from './pinned-sources';
import { bindSnapshotToCurrentNotices } from './batch-ownership';
import { assessWithUnclearedHolds } from './uncleared-holds';

const sha = (text: string | Uint8Array) =>
  createHash('sha256').update(text).digest('hex');
const BASTARD_SWORD = 'pf1/KtgSPHGqIRTwhwZM';
const BATTLE_AXE = 'pf1/JIljkqPWhmvAPYbI';
const RIPSAW_GLAIVE = 'pf1/NXy3C6WfJ67ZAPsy';
const FLYING_BLADE = 'pf1/IxZC7La61pQSiK1r';
const BUTCHERING_AXE = 'pf1/P2HkbmWWfqb9fOwD';
const SHORTSPEAR = 'pf1/N37FFAdWjVV6EolR';
const JAVELIN = 'pf1/KmbhZ4Z674Yk9yIh';
const DOUBLE_SPEAR = 'pf1/MgcUgsDhxQPUjljs';
const UNDERWATER_CROSSBOW = 'pf1/I6Ktb02Aj0En0D4F';
const PRONGED_BOLT = 'pf1/OSMucqGus8xjMxUT';
const ACID_BOLT = 'pf1/FSflNkwWnEY8pJuQ';
const REAVERS_SCYTHE = 'pf1/J0zfGICU57qryKxj';
const HACKBUT = 'pf1/FGtPRARd9Z57clLg';
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
// The records whose bound closure reaches another body with Unchained
// action-cost metadata: the Fog Cloud spell (Smoke Shot), the keen edge,
// malediction and unholy blight spells (Reaver's Scythe) and #425's Net
// (Lasso).
const unchainedBound = [
  'pf1/EVWH7YBTHWhorKm5', // Smoke Shot (Siege)
  'pf1/J0zfGICU57qryKxj', // Reaver's Scythe
  'pf1/P1zlk4ivL3jjyvp2', // Lasso
];

it('resolves held weapons’ statistics and reviewed Modifiers through the public resolver', () => {
  // A wielder with Strength 14 and base attack +5, proficient with simple and
  // martial weapons and with the four exotic weapons by hand.
  const sheet = weaponSheet({
    weapons: [
      BASTARD_SWORD,
      BATTLE_AXE,
      RIPSAW_GLAIVE,
      FLYING_BLADE,
      BUTCHERING_AXE,
    ],
    strength: 14,
    bab: 5,
    categories: ['simple', 'martial'],
    baseTypes: [
      'bastard sword',
      'gnome ripsaw glaive',
      'flying blade',
      'butchering axe',
    ],
  });
  const line = (
    routines: ReturnType<typeof calculateCharacterSheet>['attackRoutines'],
    key: string,
  ) => {
    const row = routines.find((routine) => routine.entryId === `routine:${key}`)
      ?.single[0];
    return [
      row?.attackBonus.total,
      row?.damageBonus.total,
      row?.damageDice,
      row?.criticalMultiplier.total,
    ];
  };
  const plain = calculateCharacterSheet(sheet).attackRoutines;
  // One-handed: +2 Strength on damage; two-handed: +3.
  expect(line(plain, BASTARD_SWORD)).toEqual([7, 2, '1d10', 2]);
  expect(line(plain, BATTLE_AXE)).toEqual([7, 2, '1d8', 3]);
  expect(line(plain, RIPSAW_GLAIVE)).toEqual([7, 3, '1d10', 3]);
  // The flying blade's −2 and +2 each need their Situation.
  expect(line(plain, FLYING_BLADE)).toEqual([7, 3, '1d12', 3]);
  expect(line(plain, BUTCHERING_AXE)).toEqual([7, 3, '3d6', 3]);
  // The ripsaw glaive's +2 damage while spinning and the butchering axe's
  // −2 below Strength 19 apply only under their Situations, and only to their
  // own attacks.
  const selected = calculateCharacterSheet(sheet, {
    situations: [
      ...situations('Gnome Ripsaw Glaive', `item:${RIPSAW_GLAIVE}`),
      ...situations('Butchering Axe', `item:${BUTCHERING_AXE}`),
    ],
  }).attackRoutines;
  expect(line(selected, RIPSAW_GLAIVE)).toEqual([7, 5, '1d10', 3]);
  expect(line(selected, BUTCHERING_AXE)).toEqual([5, 3, '3d6', 3]);
  expect(line(selected, BATTLE_AXE)).toEqual([7, 2, '1d8', 3]);
  expect(line(selected, FLYING_BLADE)).toEqual([7, 3, '1d12', 3]);
  // The flying blade's two mutually exclusive cases: −2 on its ordinary
  // attacks, +2 instead on attacks of opportunity provoked by movement.
  const [ordinary, opportunity] = situations(
    'Flying Blade',
    `item:${FLYING_BLADE}`,
  );
  for (const [situation, attack] of [
    [ordinary, 5],
    [opportunity, 9],
  ] as const)
    expect(
      line(
        calculateCharacterSheet(sheet, { situations: [situation!] })
          .attackRoutines,
        FLYING_BLADE,
      ),
    ).toEqual([attack, 3, '1d12', 3]);
  // Without the exotic proficiency the bastard sword takes −4.
  const untrained = calculateCharacterSheet(
    weaponSheet({
      weapons: [BASTARD_SWORD],
      strength: 14,
      bab: 5,
      categories: ['simple', 'martial'],
    }),
  ).attackRoutines;
  expect(line(untrained, BASTARD_SWORD)).toEqual([3, 2, '1d10', 2]);
});

it('applies each reviewed Modifier only under its Situation', () => {
  for (const [name, target, value] of [
    ['Coat Pistol', 'skill.slt', 2],
    ['Boarding Axe', 'skill.clm', 2],
    ['Manople', 'cmd', 10],
    // Dodge bonuses resolve to the other-bonuses leaf, shield bonuses to the
    // shield leaf.
    ['Dueling Dagger', 'ac.other', 1],
    ['Boar Spear', 'ac.shield', 2],
    ['Bill', 'ac.shield', 1],
  ] as const) {
    expect(resolved(name, target), `${name} ${target}`).toBe(0);
    expect(resolved(name, target, true), `${name} ${target}`).toBe(value);
  }
  // AC bonuses go to AC (the shield bonuses to their own leaf), never to
  // ac.other (#734).
  for (const [name, bonusType, value] of [
    ['Dueling Dagger', 'dodge', 1],
    ['Boar Spear', 'shield', 2],
    ['Bill', 'shield', 1],
  ] as const)
    expect(modifiers(name), name).toEqual([
      expect.objectContaining({ target: 'ac', bonusType, value }),
    ]);
  for (const row of preview.entries)
    for (const modifier of row.modifiers)
      expect(String(modifier.target), row.name).not.toBe('ac.other');
  expect(modifiers('Boarding Axe')[0]?.bonusType).toBe('circumstance');
  // Weapon Modifiers bind to the weapon's own attacks.
  for (const [name, target, value, situation] of [
    [
      'Composite Shortbow',
      'attack',
      -2,
      'your Strength modifier is lower than the strength rating of the composite bow',
    ],
    [
      'Culverin',
      'attack',
      -4,
      'firing a culverin without support (such as a wall, a window, or a stand)',
    ],
    [
      'Standard Bombard',
      'attack',
      -4,
      'firing a bombard as a direct-fire siege engine',
    ],
    [
      'Dwarven Light Pelletbow',
      'attack',
      -2,
      'shooting a pelletbow with one hand',
    ],
    [
      'Knobkerrie',
      'attack',
      1,
      'ranged attack rolls against opponents using bucklers, light shields, or heavy shields, when proficient',
    ],
    [
      'Butchering Axe',
      'attack',
      -2,
      'your Strength is less than 19 (or 17 for a Small or smaller butchering axe)',
    ],
    [
      'Gnome Ripsaw Glaive',
      'damage',
      2,
      'while the ripsaw glaive’s blade is spinning',
    ],
    [
      'Double-Barreled Shotgun',
      'attack',
      -4,
      'Both Barrels: a double shot that fires bullets',
    ],
    [
      'Double Hackbut',
      'attack',
      -4,
      'Not Mounted: firing the double hackbut while it is not mounted, unless you are a Large or larger creature firing one a size smaller than yourself as a normal two-handed weapon',
    ],
    [
      'Pronged Bolt',
      'attack',
      1,
      'against creatures or objects one or more size categories smaller than you',
    ],
  ] as const)
    expect(modifiers(name), name).toEqual([
      expect.objectContaining({
        target,
        bonusType: 'untyped',
        value,
        condition: { situation: { local: situation }, weapon: '$self' },
      }),
    ]);
  // Its reviewed −4 Situation remains above, but the firearm's unreviewed
  // Strength/reload profile cannot certify a calculated attack.
  expect(() => rangedWeapon(HACKBUT)).toThrowError(
    new Error('unresolved strengthDamage, reload'),
  );
  // The flying blade's mutually exclusive cases.
  expect(modifiers('Flying Blade')).toEqual([
    expect.objectContaining({
      target: 'attack',
      bonusType: 'untyped',
      value: -2,
      condition: {
        situation: {
          local:
            'attacks with the flying blade other than attacks of opportunity provoked by movement',
        },
        weapon: '$self',
      },
    }),
    expect.objectContaining({
      target: 'attack',
      bonusType: 'untyped',
      value: 2,
      condition: {
        situation: {
          local:
            'attacks of opportunity provoked by movement made with the flying blade',
        },
        weapon: '$self',
      },
    }),
  ]);
  // The manticore's tail's −2 applies to every attack it makes.
  expect(modifiers("Manticore's Tail")).toEqual([
    expect.objectContaining({
      target: 'attack',
      bonusType: 'untyped',
      value: -2,
      condition: { weapon: '$self' },
    }),
  ]);
  // The Reaver's Scythe's unholy +2d6 is a Note under the shared Situation.
  expect(
    entry(REAVERS_SCYTHE).situationalNotes?.find((note) =>
      note.text.startsWith('Good Target'),
    ),
  ).toMatchObject({ target: 'damage', situation: 'goodCreatures' });
  expect(entry(REAVERS_SCYTHE).detail.magic).toEqual({
    enhancement: 2,
    masterwork: true,
  });
});

it('applies ammunition Modifiers only to the attacks that fire that ammunition', () => {
  // An underwater light crossbow fires, in turn, a pronged bolt and an acid
  // bolt; a battle axe attacks in melee (Strength and Dexterity 14, base
  // attack +5). The ammunition definitions are marked as ammunition by hand,
  // as #761 will import them; every ammunition Situation is selected at once.
  const ammo = [PRONGED_BOLT, ACID_BOLT];
  const base = weaponSheet({
    weapons: [BATTLE_AXE],
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
        name: 'Light Crossbow (Underwater)',
        ruleIdentity: 'fixture-underwater-crossbow',
        modifiers: [],
        detail: {
          kind: 'item' as const,
          consumable: false,
          weapon: rangedWeapon(UNDERWATER_CROSSBOW),
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
    [`routine:${BATTLE_AXE}`]: [7, 2],
    [`routine:${PRONGED_BOLT}`]: [8, 0],
    [`routine:${ACID_BOLT}`]: [7, 0],
  });
  // Removing the ammunition flag remains a resolver negative control.
  expect(lines(false)).toEqual({
    [`routine:${BATTLE_AXE}`]: [7, 2],
    [`routine:${PRONGED_BOLT}`]: [7, 0],
    [`routine:${ACID_BOLT}`]: [7, 0],
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
    'Light Catapult': ['proficiency', 'handedness'],
    'Brass Knife': ['rangeIncrement'],
    'Smoke Shot (Siege)': ['weight'],
    'Rocket Springal': ['proficiency', 'handedness'],
    'Chain-Hammer': ['price', 'rangeIncrement'],
    'Butterfly Sword': ['price'],
    Kusarigama: ['damageTypes'],
    'Standard Trebuchet': ['damage', 'proficiency', 'handedness'],
    'Spear-Sling': ['rangeIncrement'],
    'Standard Bombard': ['damage', 'proficiency', 'handedness'],
    'Rope Gauntlet': ['damageTypes'],
    'Tri-Point Double-Edged Sword': ['qualities'],
    Jutte: ['qualities'],
    Flickmace: ['qualities'],
    'Throwing Arrow Cord': ['rangeIncrement'],
    'Drow Poison Crossbow Bolt': ['weight'],
    'Bleeding Arrow': ['price'],
    'Jolting Dart': ['damage', 'proficiency'],
    'Butchering Axe': ['threat', 'multiplier'],
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
    // Only the Reaver's Scythe is a magic weapon (+2, masterwork).
    expect(gear.defaults ?? null, row.name).toEqual(
      row.externalKey === REAVERS_SCYTHE
        ? { enhancement: 2, masterwork: true }
        : null,
    );
  }
  // Representative mapped weapons: the Core Rulebook statistics.
  for (const [name, weapon] of [
    [
      'Bastard Sword',
      {
        proficiency: 'exotic',
        handedness: 'oneHanded',
        dice: '1d10',
        threat: 19,
        mult: 2,
      },
    ],
    [
      'Rapier',
      {
        proficiency: 'martial',
        handedness: 'oneHanded',
        dice: '1d6',
        threat: 18,
        mult: 2,
        finesse: true,
      },
    ],
    [
      'Heavy Flail',
      {
        proficiency: 'martial',
        handedness: 'twoHanded',
        dice: '1d10',
        threat: 19,
        mult: 2,
      },
    ],
    [
      'Shortspear',
      {
        proficiency: 'simple',
        handedness: 'oneHanded',
        dice: '1d6',
        thrown: true,
        thrownRangeIncrement: 20,
      },
    ],
    [
      'Composite Shortbow',
      {
        proficiency: 'martial',
        handedness: 'twoHanded',
        dice: '1d6',
        mult: 3,
        rangeIncrement: 70,
      },
    ],
  ] as const)
    expect(entry(name).detail.weapon, name).toMatchObject(weapon);
  // Importer gaps the report lists: bare dice formulas map no dice, siege
  // engines keep Foundry's subtypes (the heavy ballista imports as a personal
  // exotic weapon), the whip's reach reads as a range increment and the
  // jolting dart's electricity part is lost.
  expect(entry('Standard Trebuchet').detail.weapon?.dice).toBeNull();
  expect(entry('Standard Bombard').detail.weapon?.dice).toBeNull();
  expect(entry('Light Catapult').detail.weapon).toMatchObject({
    proficiency: 'siege',
    handedness: 'indirect',
  });
  expect(entry('Heavy Ballista').detail.weapon).toMatchObject({
    proficiency: 'exotic',
    handedness: 'ranged',
  });
  expect(candidate('Heavy Ballista').itemKind).toBe('siege engine');
  expect(entry('M1914 Grenade (Concussion)').detail.weapon).toMatchObject({
    proficiency: 'misc',
    handedness: 'other',
  });
  // Its source range is melee reach, not a thrown range increment.
  expect(entry('Whip').detail.weapon?.rangeIncrement).toBeUndefined();
  expect(entry('Jolting Dart').detail.weapon?.damageTypes).toEqual([
    'piercing',
  ]);
  // Specific variants name another item in baseTypes; no baseItem is mapped.
  expect(
    candidate('Dwarven Light Pelletbow').mechanicsReview.gearReview.baseItem,
  ).toContain('Light Crossbow');
  expect(candidate(PRONGED_BOLT).mechanicsReview.gearReview.baseItem).toContain(
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
      .replace(/[–—]/g, '-')
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
  // Every item has exactly one description record (#759's ownership sweep);
  // the three required conditional records are checked.
  expect(descriptions).toBe(99);
  expect(conditionals).toBe(3);
  // Descriptive bodies get an explicit covered/no-output record.
  for (const name of [
    'Light Hammer',
    'Handaxe',
    'Battle Axe',
    'Shortspear',
    'Tetsubo',
    'Double Spear',
    'Dwarven Longhammer',
    'Steel Terbutje',
  ]) {
    const [record] = candidate(name).mechanicsReview.curationRecords;
    expect(record?.kind, name).toBe('description');
    expect(record?.outputs, name).toEqual([]);
    expect(record?.rationale, name).toContain('Explicit covered/no-output');
  }
  // The conditional placeholders are replaced: the Reaver's Scythe's by a
  // readable Note, the double firearms' Situations by the body's condition.
  const [, scythe] = candidate(REAVERS_SCYTHE).mechanicsReview.curationRecords;
  expect(scythe?.kind).toBe('conditional');
  expect(scythe?.outputs).toEqual([
    {
      kind: 'note',
      target: 'damage',
      situation: 'goodCreatures',
      text: "Good Target: +2d6 points of damage (not multiplied on a critical hit) from the scythe's unholy property.",
    },
  ]);
  // Notes on the statistic they qualify.
  for (const [name, targets] of [
    ['Gauntlet', ['cmd', 'damage']],
    ['Whip', ['attack', 'damage']],
    ['Boar Spear', ['ac']],
    ['Kumade', [undefined]],
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
    `weapons-and-ammo-426-notice-${book}-complete-chain`;
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
      `weapons-and-ammo-426-whole-content-${row.externalKey.split('/')[1]}`,
    );
    expect(row.noticeHoldIds, row.name).toEqual(
      row.requiredNotices.filter((book) => book !== 'PZO1110').map(holdId),
    );
    for (const id of row.noticeHoldIds) expect(held.has(id), id).toBe(true);
  }
  // Record-level "D&D 3.5" tags are held, not excluded.
  const tagged = assessedItems.filter((row) => row.holdIds.length > 1);
  expect(tagged.map((row) => row.name)).toEqual([
    'Acid Crossbow Bolt',
    'Lizard King War Trident',
    'Drow Poison Crossbow Bolt',
  ]);
  for (const row of tagged) {
    const id = row.externalKey.split('/')[1];
    expect(row.recordTags, row.name).toEqual(['D&D 3.5']);
    expect(row.holdIds, row.name).toEqual([
      `weapons-and-ammo-426-whole-content-${id}`,
      `weapons-and-ammo-426-record-level-3.5-tag-${id}`,
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
    'Barbed Arrow': ['PZO1123'],
    Earthmaul: ['PZO1118'],
    "Manticore's Tail": ['PZO1118'],
  });
  // Core Rulebook items whose body is the Core Rulebook DESC are held only on
  // their notices: the cited Ultimate Equipment or Ranged Tactics Toolbox,
  // and Unchained; the double spear is the Martial Arts Handbook DESC.
  for (const [key, wording, notices] of [
    [SHORTSPEAR, 'same', ['PZO1123', 'PZO1131', 'PZO1110']],
    [JAVELIN, 'same', ['PZO9452', 'PZO1123', 'PZO1131', 'PZO1110']],
    [DOUBLE_SPEAR, 'same-desc', ['PZO9493', 'PZO1131', 'PZO1110']],
  ] as const) {
    expect(candidate(key).coreRulebookWording, key).toBe(wording);
    expect(candidate(key).requiredNotices, key).toEqual(notices);
    expect(
      candidate(key).mechanicsReview.gearReview.disagreements,
      key,
    ).toEqual([]);
  }
  // Unchained action-cost metadata anywhere in the bound closure requires
  // the held PZO1131: every record with an action, and three through bound
  // bodies.
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
  expect(unchainedOwn).toHaveLength(87);
  expect(
    assessedItems
      .filter((row) => row.requiredNotices.includes('PZO1131'))
      .map((row) => row.externalKey)
      .sort(),
  ).toEqual([...new Set([...unchainedOwn, ...unchainedBound])].sort());
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
  // Ammunition records carry no action; only the smoke shot's linked Fog
  // Cloud spell brings PZO1131 in.
  expect(
    assessedItems
      .filter(
        (row) =>
          row.itemKind.includes('ammunition') &&
          row.requiredNotices.includes('PZO1131'),
      )
      .map((row) => row.name),
  ).toEqual(['Smoke Shot (Siege)']);
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
    held: 99,
    dependentlyOmitted: 0,
    unsupportedProseOnly: 0,
    excluded: 1,
    excludedFolders: 1,
    recordLevel35Holds: 3,
  });
  expect(excludedRows.map((row) => row.name)).toEqual(['Exotic Weapons']);
  for (const row of excludedRows) {
    const raw = upstreamRecord.parse(
      parse(await readPinned(row.source.repo, row.source.path)),
    );
    expect(raw._key, row.name).toBe(`!folders!${raw._id}`);
  }
  expect(preview.entries).toHaveLength(99);
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
      .replace(/[’']/g, "'")
      .replace(/\s+/g, ' ')
      .replace(/ \./g, '.')
      .trim();
  for (const [key, tag] of [
    [SHORTSPEAR, 'DESC'],
    [JAVELIN, 'DESC'],
    [DOUBLE_SPEAR, 'DESC'],
    ['pf1/JVObA6FqSBzZfikV', 'SPROP'],
  ] as const) {
    const row = candidate(key);
    const text = new RegExp(`\\t${tag}:([^\\t|]*)`).exec(
      row.comparison!.literalRow,
    )?.[1];
    expect(words(row.mechanicsReview.descriptionText), key).toBe(
      words(text ?? ''),
    );
  }
  // Records with no PCGen data row stay held on an unresolved root origin.
  expect(
    assessedItems
      .filter((row) => !row.comparison)
      .map((row) => row.name)
      .sort(),
  ).toEqual([
    'Dragoon Musket',
    'Dwarven Giant-Sticker',
    'Dwarven Light Pelletbow',
    'Dwarven Ram Hammer',
    'Earthmaul',
    'Lizard King War Trident',
    'M1914 Grenade (Concussion)',
    "Manticore's Tail",
    'Pronged Bolt',
    "Reaver's Scythe",
    'Steel Terbutje',
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
      required: 3,
      checked: 3,
      missing: 0,
      descriptions: { checked: 99 },
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
      'Fog Cloud',
      'Keen Edge',
      'Malediction (APG)',
      'Net',
      'Silk Rope',
      'Unholy Blight',
    ]);
    const ours = new Set(assessedItems.map((row) => row.externalKey));
    const gate = assessCatalogAdmission({
      artifact: authoritative,
      ...reviewedAdmission,
    });
    expect(gate.admitted.filter((row) => ours.has(row.externalKey))).toEqual(
      [],
    );
    // #738 keeps the Reaver's Scythe's keen and unholy journal links as text,
    // so it no longer fails on a reference and is held like the rest.
    expect(
      gate.failures
        .filter((row) => ours.has(row.externalKey))
        .map((row) => [row.externalKey, row.reason]),
    ).toEqual([]);
    const held = gate.held.filter((row) => ours.has(row.externalKey));
    expect(held).toHaveLength(99);
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
    // Confirming the shortspear's whole content (its body is the Core
    // Rulebook DESC) still holds it on the held Ultimate Equipment and
    // Unchained notices.
    const confirmed = assessWithUnclearedHolds({
      artifact: authoritative,
      ...reviewedAdmission,
      assessments: reviewedAdmission.assessments.map((row) =>
        row.externalKey === SHORTSPEAR
          ? { ...row, status: 'confirmed' as const }
          : row,
      ),
    });
    expect(
      confirmed.admitted.some((row) => row.externalKey === SHORTSPEAR),
    ).toBe(false);
    expect(
      confirmed.held.find((row) => row.externalKey === SHORTSPEAR)?.reason,
    ).toMatch(/Notice holds|Missing or unreviewed required notices/);
  } finally {
    await tree.dispose();
  }
});
