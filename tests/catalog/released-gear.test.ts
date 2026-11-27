// @vitest-environment node
// pbl-released-gear (PRD #251): the gear batch tests' resolver blocks
// (armors-and-shields-424, weapons-and-ammo-425 to -429, items-430 and
// items-431), on entries imported from the pinned store. One import holds
// every key of the eight gear key lists (released-gear-keys.ts); a check of
// "every entry" of a list checks that list's keys. No assertion reads an
// entry's description or a reference to a key outside the import, so the
// lists' description links (to keys the import leaves out) are not imported.
import { describe, expect, it } from 'vitest';
import { findReviewedReplacementFormula } from '../../scripts/catalog/reviewed-change-replacements';
import {
  calculateCharacterSheet,
  resolveSheet,
} from '../../src/lib/character-sheet';
import { importReleasedEntries } from './released-entries';
import { armorKeys } from './released-armor';
import {
  armorSheet,
  gearSelection,
  itemSheet,
  weaponSheets,
  type Situation,
} from './released-gear-sheet';
import { gearSelections } from './released-gear-keys';

const { entries } = await importReleasedEntries(
  Object.values(gearSelections).flat(),
);
const { rangedWeapon, itemDefinition, weaponSheet } = weaponSheets(entries);

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
const ram = (local: readonly [string, string, string]) =>
  (
    [
      [-4, 'untyped', local[0]],
      [2, 'circumstance', local[1]],
      [2, 'circumstance', local[2]],
    ] as const
  ).flatMap(([value, bonusType, situation]) =>
    ['attack', 'damage'].map((target) =>
      expect.objectContaining({
        target,
        bonusType,
        value,
        condition: { situation: { local: situation }, weapon: '$self' },
      }),
    ),
  );
/** No armor, shield or natural armor bonus of the rows sits on ac.other. */
function expectNoDefenseBonusOnAcOther(
  rows: readonly {
    name: string;
    modifiers: readonly { target: string; bonusType: string }[];
  }[],
) {
  for (const row of rows)
    for (const modifier of row.modifiers)
      if (['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType))
        expect(modifier.target, row.name).not.toBe('ac.other');
}
const RAM_SITUATIONS = [
  'making a ram attack as a full-round action without charging (not with a gallery ram)',
  'a ram with a pick head attacking a stone structure',
  'a ram with a screw head attacking an earthen structure',
] as const;

describe('armor and shields (the armors-and-shields-424 keys)', () => {
  const { rows, modifiers, resolved } = gearSelection(
    entries,
    'armors-and-shields-424',
    { distinct: false },
  );
  const CHAIN_SHIRT = 'pf1/iGu21zy6QtroUZ4O';
  const BUCKLER = armorKeys.buckler;

  it('resolves the chain shirt and buckler, and a shield beside armor, through the public resolver', () => {
    // A proficient wearer with Dexterity 18: +4 armor, +1 shield, Dexterity
    // capped at +4, armor check penalties 2 + 1, spell failure 20% + 5%.
    const worn = calculateCharacterSheet(
      armorSheet(entries, {
        items: [CHAIN_SHIRT, BUCKLER],
        dexterity: 18,
        proficiencies: ['light', 'shield'],
      }),
    );
    expect(worn.breakdowns['ac.armor'].total).toBe(4);
    expect(worn.breakdowns['ac.shield'].total).toBe(1);
    expect(worn.derivedStatistics.ac.total).toBe(19);
    expect(worn.derivedStatistics.touchAc.total).toBe(14);
    expect(worn.equipment).toMatchObject({
      armorCheckPenalty: -3,
      spellFailure: 25,
      maxDexterityBonus: 4,
      nonproficiencyAttackPenalty: 0,
    });
    expect(worn.breakdowns['skill.clm'].total).toBe(-3);
    // Without the Proficiencies the armor check penalties reach attack rolls.
    const untrained = calculateCharacterSheet(
      armorSheet(entries, { items: [CHAIN_SHIRT, BUCKLER], dexterity: 18 }),
    );
    expect(untrained.equipment.nonproficiencyAttackPenalty).toBe(-3);
    // The buckler's −1 applies only while its arm wields a weapon, never to
    // a bow or crossbow ("You can use a bow or crossbow without penalty
    // while carrying it"): one Situation for melee, one for other ranged
    // weapons.
    expect(
      modifiers('Buckler').map((row) => [
        row.target,
        row.bonusType,
        row.value,
        JSON.stringify(row.condition?.situation),
      ]),
    ).toEqual([
      [
        'attack.melee',
        'untyped',
        -1,
        JSON.stringify({
          local:
            'while your buckler arm wields a melee weapon (an off-hand weapon, or helping to wield a two-handed weapon)',
        }),
      ],
      [
        'attack.ranged',
        'untyped',
        -1,
        JSON.stringify({
          local:
            'while your buckler arm wields a ranged weapon other than a bow or crossbow',
        }),
      ],
    ]);
    const buckler = (labels: string[]) =>
      resolveSheet(modifiers('Buckler'), {
        situations: labels.map((local) => ({ local, sheetEntryId: BUCKLER })),
      });
    const [melee, ranged] = modifiers('Buckler').map((row) => {
      const scope = row.condition?.situation;
      if (!scope || typeof scope === 'string' || !('local' in scope))
        throw new Error('Expected a local Situation');
      return scope.local;
    }) as [string, string];
    // Exempt: shooting a bow with the buckler worn selects no Situation, and
    // even with an off-hand melee weapon in the buckler arm the bow is
    // untouched.
    expect(buckler([])['attack.ranged'].total).toBe(0);
    expect(buckler([melee])['attack.ranged'].total).toBe(0);
    // Penalised: an off-hand melee weapon, or another ranged weapon (such as
    // an off-hand thrown dagger), in the buckler arm.
    expect(buckler([melee])['attack.melee'].total).toBe(-1);
    expect(buckler([ranged])['attack.ranged'].total).toBe(-1);
    expect(buckler([ranged])['attack.melee'].total).toBe(0);
    // A shield beside armor: each bonus on its own leaf, so they add.
    const pair = calculateCharacterSheet(
      armorSheet(entries, {
        items: [armorKeys.breastplate, armorKeys.heavySteelShield],
        proficiencies: ['medium', 'shield'],
      }),
    );
    expect(pair.breakdowns['ac.armor'].total).toBe(6);
    expect(pair.breakdowns['ac.shield'].total).toBe(2);
    expect(pair.derivedStatistics.ac.total).toBe(18);
    // The tower shield's imported −2 attack change is its encumbrance
    // penalty.
    expect(resolved('Tower Shield', 'attack.melee')).toBe(-2);
    const tower = calculateCharacterSheet(
      armorSheet(entries, {
        items: [armorKeys.towerShield],
        dexterity: 18,
        proficiencies: ['towerShield'],
      }),
    );
    expect(tower.breakdowns['ac.shield'].total).toBe(4);
    expect(tower.equipment.maxDexterityBonus).toBe(2);
    // Situation-gated item bonuses.
    for (const [name, target, value] of [
      ['Dancing Scarves', 'skill.blf', 2],
      ['Ice Coat', 'skill.ste', 2],
      ['Parade Armor', 'skill.dip', 2],
      ['Parade Armor', 'skill.int', 2],
    ] as const) {
      expect(resolved(name, target), `${name} ${target}`).toBe(0);
      expect(resolved(name, target, true), `${name} ${target}`).toBe(value);
    }
    expect(
      new Set(
        modifiers('Parade Armor').map((row) =>
          JSON.stringify(row.condition?.situation),
        ),
      ).size,
    ).toBe(1);
    // No armor, shield or natural armor bonus of the list's 66 entries sits
    // on ac.other.
    expectNoDefenseBonusOnAcOther(rows);
  });
});

/**
 * The batch tests' ammunition case: a launcher fires each listed ammunition
 * in turn and a melee weapon attacks beside them, every ammunition Situation
 * selected at once, with the ammunition flag set and then removed.
 */
type AmmunitionCase = {
  launcher: { id: string; key: string; name: string; ruleIdentity: string };
  melee: string;
  ammo: readonly [string, ...string[]];
  sheet: {
    strength?: number;
    dexterity: number;
    categories: ('simple' | 'martial')[];
    baseTypes?: string[];
  };
  flagged: Record<string, [number, number]>;
  unflagged: Record<string, [number, number]>;
};

function ammunitionCase(
  { entry, situations }: ReturnType<typeof gearSelection>,
  test: AmmunitionCase,
) {
  const { ammo, launcher } = test;
  const base = weaponSheet({
    weapons: [test.melee],
    items: ammo,
    bab: 5,
    ...test.sheet,
  });
  const sheet = (ammunition: boolean) => ({
    ...base,
    entries: [
      ...base.entries,
      {
        _id: `item:${launcher.id}`,
        kind: 'item' as const,
        active: true,
        catalogEntryId: launcher.id,
        state: { kind: 'item' as const },
      },
      ...ammo.map((key) => ({
        _id: `routine:${key}`,
        kind: 'attackRoutine' as const,
        active: true,
        state: {
          kind: 'attackRoutine' as const,
          name: key,
          weaponEntryId: `item:${launcher.id}`,
          hands: 'one' as const,
          mode: 'ranged' as const,
          ammunitionEntryId: `item:${key}`,
        },
      })),
    ],
    catalogEntries: [
      ...base.catalogEntries.map((definition) =>
        ammunition &&
        (ammo as readonly string[]).includes(definition._id) &&
        definition.detail?.kind === 'item'
          ? {
              ...definition,
              detail: { ...definition.detail, ammunition: true },
            }
          : definition,
      ),
      {
        _id: launcher.id,
        name: launcher.name,
        ruleIdentity: launcher.ruleIdentity,
        modifiers: [],
        detail: {
          kind: 'item' as const,
          consumable: false,
          weapon: rangedWeapon(launcher.key),
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
  expect(lines(true)).toEqual(test.flagged);
  // Removing the ammunition flag remains a resolver negative control.
  expect(lines(false)).toEqual(test.unflagged);
  // Every listed ammunition is ordinary (no siege) ammunition, which imports
  // with its flag.
  for (const key of ammo) expect(entry(key).detail.ammunition, key).toBe(true);
}
const routine = (key: string) => `routine:${key}`;

describe('weapons and ammunition (the weapons-and-ammo-425 keys)', () => {
  const selection = gearSelection(entries, 'weapons-and-ammo-425', {
    distinct: false,
  });
  const { rows, modifiers, situations, resolved } = selection;
  const SHOTEL = 'pf1/1vNxFfAeYalooWIF';
  const PUNCHING_DAGGER = 'pf1/05NnBuNnkMsaNoXf';
  const CLAW_BLADES = 'pf1/1TiILWBLdzYpnPky';

  it('resolves weapons’ statistics and curated Modifiers through the public resolver', () => {
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
    const at = (key: string) => {
      const row = routines.find((row) => row.entryId === `routine:${key}`)
        ?.single[0];
      if (!row) throw new Error(`No attack for ${key}`);
      return row;
    };
    expect(at(SHOTEL)).toMatchObject({
      attackBonus: { total: 7 },
      damageBonus: { total: 2 },
    });
    expect(at(SHOTEL).damageDice).toBe('1d8');
    expect(at(SHOTEL).criticalMultiplier.total).toBe(3);
    expect(at(PUNCHING_DAGGER).attackBonus.total).toBe(7);
    expect(at(PUNCHING_DAGGER).damageDice).toBe('1d4');
    expect(at(PUNCHING_DAGGER).criticalMultiplier.total).toBe(3);
    // The claw blades' +1 enhancement reaches attack rolls, not damage.
    expect(at(CLAW_BLADES).attackBonus.total).toBe(8);
    expect(at(CLAW_BLADES).damageBonus.total).toBe(2);
    // The shotel's +1 against shield users applies only under its
    // Situation, and only to the shotel's own attacks.
    const selected = calculateCharacterSheet(sheet, {
      situations: situations('Shotel', `item:${SHOTEL}`),
    }).attackRoutines;
    const selectedAt = (key: string) =>
      selected.find((row) => row.entryId === `routine:${key}`)?.single[0]
        ?.attackBonus.total;
    expect(selectedAt(SHOTEL)).toBe(8);
    expect(selectedAt(PUNCHING_DAGGER)).toBe(7);
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

  it('applies each curated Modifier only under its Situation', () => {
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
    // The Dan Bong's grapple bonus uses the shared Situation, whose
    // condition its body states exactly.
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
      [
        'Maxim M1910 Machine Gun',
        -4,
        'firing the Maxim when it is not mounted',
      ],
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
    // Ammunition Modifiers bind to the attacks that fire it (see the next
    // test).
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
    // None of the list's 96 entries gives an AC bonus, on ac.other or
    // anywhere else.
    for (const row of rows)
      for (const modifier of row.modifiers)
        expect(String(modifier.target), row.name).not.toMatch(/^ac/);
  });

  it('applies ammunition Modifiers only to the attacks that fire that ammunition (hand crossbow bolts, bullet and arrow; punching dagger)', () => {
    // A hand crossbow fires, in turn, a heartstake bolt, a silver bullet, a
    // pronged arrow and a barbed bolt; a punching dagger attacks in melee
    // (Dexterity 14, base attack +5).
    const HEARTSTAKE = 'pf1/6hzQCxhCoUEAQmo6';
    const SILVER = 'pf1/7Bxjw0baCyDmSWjv';
    const PRONGED = 'pf1/3sWj5S5ukzxl8oxK';
    const BARBED = 'pf1/84twkW8rwnUEX4EY';
    ammunitionCase(selection, {
      launcher: {
        id: 'crossbow',
        key: 'pf1/BgTqaNqyS3tnLGAg', // Hand Crossbow
        name: 'Hand Crossbow',
        ruleIdentity: 'fixture-hand-crossbow',
      },
      melee: PUNCHING_DAGGER,
      ammo: [HEARTSTAKE, SILVER, PRONGED, BARBED],
      sheet: {
        dexterity: 14,
        categories: ['simple'],
        baseTypes: ['hand crossbow'],
      },
      flagged: {
        [routine(PUNCHING_DAGGER)]: [5, 0],
        [routine(HEARTSTAKE)]: [5, 0],
        [routine(SILVER)]: [7, -1],
        [routine(PRONGED)]: [8, 0],
        [routine(BARBED)]: [7, 0],
      },
      unflagged: {
        [routine(PUNCHING_DAGGER)]: [5, 0],
        [routine(HEARTSTAKE)]: [7, 0],
        [routine(SILVER)]: [7, 0],
        [routine(PRONGED)]: [7, 0],
        [routine(BARBED)]: [7, 0],
      },
    });
  });
});

describe('weapons and ammunition (the weapons-and-ammo-426 keys)', () => {
  const selection = gearSelection(entries, 'weapons-and-ammo-426', {
    distinct: false,
  });
  const { rows, entry, modifiers, situations, resolved } = selection;
  const BASTARD_SWORD = 'pf1/KtgSPHGqIRTwhwZM';
  const BATTLE_AXE = 'pf1/JIljkqPWhmvAPYbI';
  const RIPSAW_GLAIVE = 'pf1/NXy3C6WfJ67ZAPsy';
  const FLYING_BLADE = 'pf1/IxZC7La61pQSiK1r';
  const BUTCHERING_AXE = 'pf1/P2HkbmWWfqb9fOwD';
  const REAVERS_SCYTHE = 'pf1/J0zfGICU57qryKxj';
  const HACKBUT = 'pf1/FGtPRARd9Z57clLg';

  it('resolves weapons’ statistics and curated Modifiers through the public resolver', () => {
    // A wielder with Strength 14 and base attack +5, proficient with simple
    // and martial weapons and with the four exotic weapons by hand.
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
    const plain = calculateCharacterSheet(sheet).attackRoutines;
    // One-handed: +2 Strength on damage; two-handed: +3.
    expect(line(plain, BASTARD_SWORD)).toEqual([7, 2, '1d10', 2]);
    expect(line(plain, BATTLE_AXE)).toEqual([7, 2, '1d8', 3]);
    expect(line(plain, RIPSAW_GLAIVE)).toEqual([7, 3, '1d10', 3]);
    // The flying blade's −2 and +2 each need their Situation.
    expect(line(plain, FLYING_BLADE)).toEqual([7, 3, '1d12', 3]);
    expect(line(plain, BUTCHERING_AXE)).toEqual([7, 3, '3d6', 3]);
    // The ripsaw glaive's +2 damage while spinning and the butchering axe's
    // −2 below Strength 19 apply only under their Situations, and only to
    // their own attacks.
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

  it('applies each curated Modifier only under its Situation', () => {
    for (const [name, target, value] of [
      ['Coat Pistol', 'skill.slt', 2],
      ['Boarding Axe', 'skill.clm', 2],
      ['Manople', 'cmd', 10],
      // Dodge bonuses resolve to the other-bonuses leaf, shield bonuses to
      // the shield leaf.
      ['Dueling Dagger', 'ac.other', 1],
      ['Boar Spear', 'ac.shield', 2],
      ['Bill', 'ac.shield', 1],
    ] as const) {
      expect(resolved(name, target), `${name} ${target}`).toBe(0);
      expect(resolved(name, target, true), `${name} ${target}`).toBe(value);
    }
    // AC bonuses go to AC (the shield bonuses to their own leaf), never to
    // ac.other (#734): none of the list's 99 entries targets it.
    for (const [name, bonusType, value] of [
      ['Dueling Dagger', 'dodge', 1],
      ['Boar Spear', 'shield', 2],
      ['Bill', 'shield', 1],
    ] as const)
      expect(modifiers(name), name).toEqual([
        expect.objectContaining({ target: 'ac', bonusType, value }),
      ]);
    for (const row of rows)
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
    // Its curated −4 Situation remains above, but the firearm's unmapped
    // Strength/reload profile cannot give a calculated attack.
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
    // The Reaver's Scythe's unholy +2d6 is a Note under the shared
    // Situation.
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

  it('applies ammunition Modifiers only to the attacks that fire that ammunition (underwater crossbow bolts; battle axe)', () => {
    // An underwater light crossbow fires, in turn, a pronged bolt and an
    // acid bolt; a battle axe attacks in melee (Strength and Dexterity 14,
    // base attack +5).
    const PRONGED_BOLT = 'pf1/OSMucqGus8xjMxUT';
    const ACID_BOLT = 'pf1/FSflNkwWnEY8pJuQ';
    ammunitionCase(selection, {
      launcher: {
        id: 'crossbow',
        key: 'pf1/I6Ktb02Aj0En0D4F', // Light Crossbow (Underwater)
        name: 'Light Crossbow (Underwater)',
        ruleIdentity: 'fixture-underwater-crossbow',
      },
      melee: BATTLE_AXE,
      ammo: [PRONGED_BOLT, ACID_BOLT],
      sheet: { strength: 14, dexterity: 14, categories: ['simple', 'martial'] },
      flagged: {
        [routine(BATTLE_AXE)]: [7, 2],
        [routine(PRONGED_BOLT)]: [8, 0],
        [routine(ACID_BOLT)]: [7, 0],
      },
      unflagged: {
        [routine(BATTLE_AXE)]: [7, 2],
        [routine(PRONGED_BOLT)]: [7, 0],
        [routine(ACID_BOLT)]: [7, 0],
      },
    });
  });
});

describe('weapons and ammunition (the weapons-and-ammo-427 keys)', () => {
  const selection = gearSelection(entries, 'weapons-and-ammo-427', {
    distinct: true,
  });
  const { rows, modifiers, situations, resolved } = selection;
  const GREATAXE = 'pf1/Wx22UaMqWgCrYi7r';
  const KUKRI = 'pf1/Uw42p33QKEUhlSMi';
  const SICA = 'pf1/P3gUxPKX72ZnojXx';
  const TAILBLADE = 'pf1/QigjqjvJ8j6f62Mo';
  const SICKLE_SWORD = 'pf1/a6w5DSGKSZo6LvTN';
  const COLOSSAL_RAM = 'pf1/RYGdmT9D0wqFL8F3';
  const GARGANTUAN_RAM = 'pf1/X9ii9ZxZO5XKuxP4';

  it('resolves weapons’ statistics and curated Modifiers through the public resolver', () => {
    // A wielder with Strength 14 and base attack +5, proficient with simple
    // and martial weapons and with the sica and sickle-sword by hand.
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

  it('applies each curated Modifier only under its Situation', () => {
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
    // None of the list's 100 entries carries an armor, shield or natural
    // armor bonus, and nothing targets ac.other (#734).
    for (const row of rows)
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
      [
        'Incendiary Arrow',
        'attack',
        'untyped',
        -1,
        'firing an incendiary arrow',
      ],
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
    for (const key of [COLOSSAL_RAM, GARGANTUAN_RAM])
      expect(modifiers(key), key).toEqual(ram(RAM_SITUATIONS));
  });

  it('applies ammunition Modifiers only to the attacks that fire that ammunition (longbow arrows; kukri)', () => {
    // A longbow fires, in turn, a lodestone, an incendiary and a blunt
    // arrow; a kukri attacks in melee (Strength and Dexterity 14, base
    // attack +5).
    const LODESTONE_ARROW = 'pf1/YblsiTF25I6uG9jN';
    const INCENDIARY_ARROW = 'pf1/TnlmmOvNB0gAy4LS';
    const BLUNT_ARROW = 'pf1/TaRfSanfIvyJeCdm';
    ammunitionCase(selection, {
      launcher: {
        id: 'longbow',
        key: 'pf1/PqJih70EG2A1XNGf', // Longbow
        name: 'Longbow',
        ruleIdentity: 'fixture-longbow',
      },
      melee: KUKRI,
      ammo: [LODESTONE_ARROW, INCENDIARY_ARROW, BLUNT_ARROW],
      sheet: { strength: 14, dexterity: 14, categories: ['simple', 'martial'] },
      flagged: {
        [routine(KUKRI)]: [7, 2],
        [routine(LODESTONE_ARROW)]: [11, 0],
        [routine(INCENDIARY_ARROW)]: [6, 0],
        [routine(BLUNT_ARROW)]: [3, 0],
      },
      unflagged: {
        [routine(KUKRI)]: [7, 2],
        [routine(LODESTONE_ARROW)]: [7, 0],
        [routine(INCENDIARY_ARROW)]: [7, 0],
        [routine(BLUNT_ARROW)]: [7, 0],
      },
    });
  });
});

describe('weapons and ammunition (the weapons-and-ammo-428 keys)', () => {
  const selection = gearSelection(entries, 'weapons-and-ammo-428', {
    distinct: true,
  });
  const { rows, modifiers, situations, resolved } = selection;
  const EARTH_BREAKER = 'pf1/b0hY6M0sYwvjnMZH';
  const DAGGER = 'pf1/fOSuWwRSZLTrROch';
  const SCIZORE = 'pf1/fqiZkTAd1BlgOaII';
  const SEA_KNIFE = 'pf1/nq0b69zA7Q35n0oE';
  const SPLIT_BLADE = 'pf1/hvWgMofsY3heVbFo';
  const SEAX = 'pf1/kY1zv3pOlGUfyX29';
  const HUGE_RAM = 'pf1/irDUE4zovCD1YbxN';

  it('resolves weapons’ statistics and curated Modifiers through the public resolver', () => {
    // A wielder with Strength 14 and base attack +5, proficient with simple
    // and martial weapons and with the split-blade sword and broken-back
    // seax by hand.
    const sheet = weaponSheet({
      weapons: [EARTH_BREAKER, DAGGER, SCIZORE, SEA_KNIFE, SPLIT_BLADE, SEAX],
      strength: 14,
      bab: 5,
      categories: ['simple', 'martial'],
      baseTypes: ['split-blade sword', 'broken-back seax'],
    });
    const plain = calculateCharacterSheet(sheet).attackRoutines;
    // One-handed and light: +2 Strength on damage; two-handed: +3. The
    // scizore's −1 and the sea-knife's −2 circumstance penalty apply to
    // every attack with them.
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
    // Without the exotic proficiencies the split-blade sword and seax take
    // −4.
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

  it('applies each curated Modifier only under its Situation', () => {
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
    // The only armor, shield or natural armor bonus among the list's 98
    // entries is the scizore's shield bonus, on ac; nothing targets
    // ac.other (#734).
    const defense = rows.flatMap((row) =>
      row.modifiers
        .filter((modifier) =>
          ['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType),
        )
        .map((modifier) => [row.name, modifier.target, modifier.bonusType]),
    );
    expect(defense).toEqual([['Scizore', 'ac', 'shield']]);
    for (const row of rows)
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
      [
        'Tangleshot Arrow',
        'attack',
        'untyped',
        -1,
        'firing a tangleshot arrow',
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
    // against stone or earthen structures, under three Situations (as the
    // colossal and gargantuan rams).
    expect(modifiers(HUGE_RAM)).toEqual(ram(RAM_SITUATIONS));
  });

  it('applies ammunition Modifiers only to the attacks that fire that ammunition (composite longbow arrows; dagger)', () => {
    // A longbow (the composite longbow's mapped statistics) fires, in turn,
    // a raining and a tangleshot arrow; a dagger attacks in melee (Strength
    // and Dexterity 14, base attack +5).
    const RAINING_ARROW = 'pf1/ge2hGHa9k1ly2hch';
    const TANGLESHOT_ARROW = 'pf1/gxTN2rn0eYV4QsYJ';
    ammunitionCase(selection, {
      launcher: {
        id: 'longbow',
        key: 'pf1/msTiRxZVnecbPCA8', // Composite Longbow
        name: 'Longbow',
        ruleIdentity: 'fixture-longbow',
      },
      melee: DAGGER,
      ammo: [RAINING_ARROW, TANGLESHOT_ARROW],
      sheet: { strength: 14, dexterity: 14, categories: ['simple', 'martial'] },
      flagged: {
        [routine(DAGGER)]: [7, 2],
        [routine(RAINING_ARROW)]: [5, 0],
        [routine(TANGLESHOT_ARROW)]: [6, 0],
      },
      unflagged: {
        [routine(DAGGER)]: [7, 2],
        [routine(RAINING_ARROW)]: [7, 0],
        [routine(TANGLESHOT_ARROW)]: [7, 0],
      },
    });
  });
});

describe('weapons and ammunition (the weapons-and-ammo-429 keys)', () => {
  const { rows, entry, modifiers, situations, resolved } = gearSelection(
    entries,
    'weapons-and-ammo-429',
    { distinct: true },
  );
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
  const LARGE_RAM = 'pf1/qyHqvrBvrPRgVbrt';

  it('resolves weapons’ statistics and curated Modifiers through the public resolver', () => {
    // A wielder with Strength 14 and base attack +5, proficient with simple
    // and martial weapons.
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
    // weapons plus named repeating-crossbow proficiency. Unmapped launchers
    // keep their imported Modifiers but give no sheet weapon.
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
          ...ranged.map((key) => ({
            ...itemDefinition(key),
            detail: {
              kind: 'item' as const,
              consumable: false,
              weapon: rangedWeapon(key),
            },
          })),
        ],
      };
    };
    const attacks = (
      input: ReturnType<typeof sheet>,
      selected: Situation[] = [],
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
      attacks(
        proficient,
        situations('Heavy Crossbow', `item:${HEAVY_CROSSBOW}`),
      ),
    ).toEqual({
      [`routine:${HEAVY_CROSSBOW}`]: [3, '1d10'],
      [`routine:${REPEATING_LIGHT_CROSSBOW}`]: [7, '1d8'],
    });
    // The gastraphetes' Situation is ordinary unsupported firing while
    // standing. Firing it prone, and a Large or larger creature using one a
    // size smaller than itself without support, fall outside it (the body's
    // exception, as the double hackbut's): no −4.
    const [unsupported] = situations('Gastraphetes', `item:${GASTRAPHETES}`);
    expect(unsupported).toEqual({
      local:
        'firing a gastraphetes while standing without support, unless you are a Large or larger creature using a gastraphetes one size smaller than yourself',
      sheetEntryId: `item:${GASTRAPHETES}`,
    });
    // The body's exception is the imported entry's Note.
    expect(entry(GASTRAPHETES).situationalNotes).toContainEqual(
      expect.objectContaining({
        text: expect.stringContaining(
          'you take no penalty for firing a gastraphetes while prone. A Large or larger creature can use a gastraphetes one size smaller than itself without any support',
        ),
      }),
    );
  });

  it('applies each curated Modifier only under its Situation', () => {
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
    // The gnome pincher's +2 applies on disarm and on steal checks: the
    // shared Situations.
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
    // The only armor, shield or natural armor bonus among the list's 81
    // entries is the meteor hammer's shield bonus, on ac; nothing targets
    // ac.other (#734).
    const defense = rows.flatMap((row) =>
      row.modifiers
        .filter((modifier) =>
          ['armor', 'shield', 'naturalArmor'].includes(modifier.bonusType),
        )
        .map((modifier) => [row.name, modifier.target, modifier.bonusType]),
    );
    expect(defense).toEqual([['Meteor Hammer', 'ac', 'shield']]);
    for (const row of rows)
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
      [
        'Ratfolk Tailblade',
        'untyped',
        -4,
        'using a loosely attached tailblade',
      ],
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
    // The large ram: −4 on attack and damage rolls without charging (never
    // a gallery ram), and the pick and screw heads' +2 circumstance bonuses
    // against stone or earthen structures, under three Situations (as the
    // other rams).
    expect(modifiers(LARGE_RAM)).toEqual(ram(RAM_SITUATIONS));
    // 22 Modifiers in all among the list's entries; no ammunition carries
    // one, and ordinary ammunition imports with its flag while siege
    // ammunition stays without one.
    expect(rows.reduce((total, row) => total + row.modifiers.length, 0)).toBe(
      22,
    );
    for (const [key, siege] of ammunition429) {
      expect(entry(key).modifiers, key).toEqual([]);
      expect(entry(key).detail.ammunition, key).toBe(siege ? undefined : true);
    }
  });
});

/**
 * The ammunition among the weapons-and-ammo-429 keys, as the batch review
 * classed it: each key and whether it is siege ammunition.
 */
const ammunition429 = [
  ['pf1/qTS8jlwPlLSvBqXX', false], // Little Starstones Sling Bullet
  ['pf1/qfGr6bMC2JWEhtqW', true], // Entangling Bolt (Siege)
  ['pf1/qqfGSep9THDz7Ptx', false], // Pheromone Arrow
  ['pf1/ru3xxm4XDuUI4rE1', false], // Alchemical Cartridge (Flare)
  ['pf1/syi2cVWBrZ5zdPUO', false], // Metal Cartridge
  ['pf1/u0m62wkXRMySE1eY', false], // Thistle Arrow
  ['pf1/uKUGHNEYBebWWqIP', false], // Splintercloud Arrow
  ['pf1/ud01Fiqw1aTjxu3B', false], // Alchemical Cartridge (Gray Dust Shot)
  ['pf1/uzKEhoSnSenjM9TJ', false], // Distance Arrow (Iron-tipped)
  ['pf1/v04yeRzoqrhYx0G7', false], // Crossbow Bolt
  ['pf1/v404qfv0Xg2VLhtZ', false], // Spongestones Sling Bullet
  ['pf1/v83MrHMKHhYONIa2', false], // Alchemical Cartridge (Repellent)
  ['pf1/vSOtYBySOG2Gt4Sb', false], // Air Reservoir
  ['pf1/w20dQkQPOe4sTiRT', false], // Firearm Bullet
  ['pf1/wZ0dp1iluJFWh239', true], // Bomb (Siege)
  ['pf1/xAxgFvkpvTgGRHZY', false], // Thorn Arrow
  ['pf1/xiugmcsMdCy4Hdg7', false], // Sharpstones Sling Bullet
] as const;

describe('items (the items-430 keys)', () => {
  const {
    rows,
    entry,
    modifiers,
    localSituations,
    situationsOn,
    resolvedWith,
  } = gearSelection(entries, 'items-430', { distinct: false });
  const situations = localSituations;
  const resolved = resolvedWith;
  const ENTERTAINERS_OUTFIT = 'pf1/6kZGQ2chmr3jpS1t';
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

  it('resolves the curated item bonuses through the public resolver', () => {
    // Defense: ring of protection +2 deflection, amulet +2 enhancement to
    // natural armor, bracers +4 armor and the ioun stone's +1 insight,
    // beside the entertainer's outfit (it adds nothing).
    const worn = calculateCharacterSheet(
      itemSheet(entries, {
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
      itemSheet(entries, { items: [ENTERTAINERS_OUTFIT] }),
    );
    expect(outfitOnly.derivedStatistics.ac.total).toBe(10);
    expect(outfitOnly.equipment).toMatchObject({
      armorCheckPenalty: 0,
      spellFailure: 0,
      maxDexterityBonus: null,
      nonproficiencyAttackPenalty: 0,
    });
    // Saves: the cloak's +3 resistance (the curated record supplies it; the
    // raw "resist" change is unsupported) and the horseshoe's +1 luck stack.
    const saves = calculateCharacterSheet(
      itemSheet(entries, { items: [CLOAK, HORSESHOE] }),
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
      itemSheet(entries, {
        items: [DEXTERITY_BELT, MIGHT_BELT],
        scores: { strength: 12, dexterity: 14 },
      }),
    );
    expect(belts.breakdowns['ability.dex'].total).toBe(18);
    expect(belts.breakdowns['ability.str'].total).toBe(16);
    // Situation-gated item bonuses: nothing without their Situation, the
    // value with it.
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
    expect(
      resolved("Psychometrist's Gloves", 'skill.dis', [handsPenalty]),
    ).toBe(-2);
    expect(
      resolved("Psychometrist's Gloves", 'skill.apr', [handsPenalty]),
    ).toBe(-2);
    // Mithral manacles: the restrained creature's penalties, frontal and
    // rear restraint exclusive; picking the lock is its own check.
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
    expect(resolved('Manacles, mithral', 'skill.esc', [frontalSkills])).toBe(
      -5,
    );
    expect(resolved('Manacles, mithral', 'skill.dev', [frontalLock])).toBe(-15);
    expect(resolved('Manacles, mithral', 'skill.esc', [rearSkills])).toBe(-10);
    expect(resolved('Manacles, mithral', 'skill.dev', [rearLock])).toBe(-25);
    expect(frontalLock).toContain('frontal restraint');
    expect(rearLock).toContain('rear restraint');
    // The companion outfit's +5 is a circumstance bonus, as its note and
    // body state (the drafter read it as untyped).
    expect(modifiers('Outfit, Companion Cold-Weather')).toMatchObject([
      {
        target: 'save.fort',
        bonusType: 'circumstance',
        value: 5,
        condition: {
          situation: { local: 'against exposure to cold weather' },
        },
      },
    ]);
    // Concealable thieves' tools: +2 circumstance on Disable Device always
    // (as masterwork thieves' tools); +4 on Sleight of Hand only to conceal
    // them.
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
    // The four-leaf clover: +2 luck on one save or skill check, both under
    // one Situation.
    expect(new Set(situations('Four-Leaf Clover')).size).toBe(1);
    expect(resolved('Four-Leaf Clover', 'save.ref')).toBe(0);
    expect(resolved('Four-Leaf Clover', 'skill.acr')).toBe(0);
    expect(
      resolved('Four-Leaf Clover', 'save.ref', situations('Four-Leaf Clover')),
    ).toBe(2);
    expect(
      resolved('Four-Leaf Clover', 'skill.acr', situations('Four-Leaf Clover')),
    ).toBe(2);
    // Curated change replacements: the masterwork tools' and instrument's
    // raw +2 on every Craft or Perform check imports as 0; the +2 applies
    // only under "made with them".
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
    // No armor, shield or natural armor bonus of the list's 96 entries sits
    // on ac.other.
    expectNoDefenseBonusOnAcOther(rows);
  });
});

describe('items (the items-431 keys)', () => {
  const {
    rows,
    entry,
    modifiers,
    localSituations,
    situationsOn,
    resolvedWith,
  } = gearSelection(entries, 'items-431', { distinct: true });
  const situations = localSituations;
  const resolved = resolvedWith;
  const MONKS_OUTFIT = 'pf1/GFOu4GXWqb6MJQQJ';
  const EXPLORERS_OUTFIT = 'pf1/LZLwdGasEUnMplnc';
  const OUTFITS = [MONKS_OUTFIT, EXPLORERS_OUTFIT];
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

  it('resolves the curated item bonuses through the public resolver', () => {
    // Defense: deflection bonuses don't stack (ring +5 over ring +4); armor
    // bonuses don't stack either, so the bracers' +6 wins over the robe's +5
    // armor bonus for an arcane spellcaster and the bracers' +2, beside the
    // explorer's outfit (it adds nothing).
    const worn = calculateCharacterSheet(
      itemSheet(entries, {
        items: [EXPLORERS_OUTFIT, RING_4, RING_5, BRACERS_6, BRACERS_2],
      }),
    );
    expect(worn.breakdowns['ac.armor'].total).toBe(6);
    expect(worn.breakdowns['ac.other'].total).toBe(5);
    expect(worn.derivedStatistics.ac.total).toBe(21);
    expect(worn.derivedStatistics.touchAc.total).toBe(15);
    expect(worn.equipment.nonproficiencyAttackPenalty).toBe(0);
    for (const key of OUTFITS) {
      const outfitOnly = calculateCharacterSheet(
        itemSheet(entries, { items: [key] }),
      );
      expect(outfitOnly.derivedStatistics.ac.total, key).toBe(10);
      expect(outfitOnly.equipment, key).toMatchObject({
        armorCheckPenalty: 0,
        spellFailure: 0,
        maxDexterityBonus: null,
        nonproficiencyAttackPenalty: 0,
      });
    }
    // The robes: Foundry's untyped +5 on armor AC imports as 0 (a curated
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
    // Saves: the cloak of resistance +1 (the curated record supplies it; the
    // raw "resist" change is unsupported); resistance bonuses don't stack,
    // so the robe's +4 wins for an arcane spellcaster.
    const cloak = calculateCharacterSheet(
      itemSheet(entries, { items: [CLOAK_1] }),
    );
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
          { local: 'worn by an arcane spellcaster', sheetEntryId: BLACK_ROBE },
        ],
      })['save.ref'].total,
    ).toBe(4);
    // Abilities: the belt's +4 on the three physical scores, the headbands'
    // enhancement bonuses, and the tin cap's −2 to Intelligence, Wisdom and
    // Charisma (the curated record supplies it; the raw "intPen" changes are
    // unsupported), which stack with them.
    const abilities = calculateCharacterSheet(
      itemSheet(entries, {
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
    // shared Situation, an exact match) and information-gathering
    // divinations (a local one); insight bonuses don't stack.
    expect(modifiers(TIN_CAP)[0]?.condition).toEqual({
      situation: 'mindAffecting',
    });
    const [divination] = situationsOn(TIN_CAP, 'saves') as [string];
    const cap = (selected: (string | { local: string })[]) =>
      resolveSheet(modifiers(TIN_CAP), {
        situations: selected.map((scope) =>
          typeof scope === 'string'
            ? scope
            : { ...scope, sheetEntryId: TIN_CAP },
        ),
      })['save.will'].total;
    expect(cap([])).toBe(0);
    expect(cap(['mindAffecting'])).toBe(4);
    expect(cap([{ local: divination }])).toBe(4);
    expect(cap(['mindAffecting', { local: divination }])).toBe(4);
    // Amulets of mighty fists: the enhancement bonus reaches only the
    // unarmed strike and natural attacks ($unarmedOrNatural), never the
    // sheet-level attack statistics; the raw "nattack" changes are
    // unsupported.
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
    // Curated change replacements: the raw bonus on every check imports as
    // 0; the bonus applies only under the body's condition.
    for (const [key, target, formula, type, value] of [
      [ELVENKIND_CLOAK, 'skill.ste', '5', 'competence', 5],
      [SOFTPAW_BOOTS, 'skill.ste', '1', 'circumstance', 1],
      [DUMMY, 'skill.prf', '2', 'circumstance', 2],
    ] as const) {
      expect(
        findReviewedReplacementFormula(key, { target, formula, type }),
      ).toBe('0');
      expect(modifiers(key)[0]).toMatchObject({ target, value: 0 });
      expect(resolved(key, target), key).toBe(0);
      expect(resolved(key, target, situationsOn(key, target)), key).toBe(value);
    }
    // Situation-gated item bonuses: nothing without their Situation, the
    // value with it.
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
      expect(
        resolved(name, target, situations(name)),
        `${name} ${target}`,
      ).toBe(value);
    }
    // The gloves of elvenkind keep their mapped +5 on every Spellcraft
    // check.
    expect(resolved('Gloves of Elvenkind', 'skill.spl')).toBe(5);
    // The goggles' +5 is a competence bonus, as the body (its
    // "compentence") and PCGen state; the drafter read it as untyped.
    expect(modifiers('Goggles of Elvenkind')).toMatchObject([
      { target: 'skill.spl', bonusType: 'competence', value: 5 },
    ]);
    // The softpaw boots' +2 tracking DC is another creature's check: a
    // Note.
    expect(situationsOn(SOFTPAW_BOOTS, 'skill.ste')).toHaveLength(1);
    expect(entry(SOFTPAW_BOOTS).situationalNotes?.map((n) => n.text)).toContain(
      'Furthermore, the DC to notice or follow the tracks of a catfolk wearing softpaw boots increases by +2.',
    );
    // Aura goggles: −2 on sight-based Perception while worn, +2
    // circumstance for read aura after removal; the two Situations are
    // exclusive.
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
    // No armor, shield or natural armor bonus of the list's 94 entries sits
    // on ac.other.
    expectNoDefenseBonusOnAcOther(rows);
  });
});

it('holds each gear key list at its batch preview’s entry count', () => {
  // The whole-list checks above cover these lists; the counts are the eight
  // batch previews' entries, written out, so a key dropped from a list
  // fails here rather than narrowing those checks.
  expect(
    Object.fromEntries(
      Object.entries(gearSelections).map(([name, keys]) => [name, keys.length]),
    ),
  ).toEqual({
    'armors-and-shields-424': 66,
    'weapons-and-ammo-425': 96,
    'weapons-and-ammo-426': 99,
    'weapons-and-ammo-427': 100,
    'weapons-and-ammo-428': 98,
    'weapons-and-ammo-429': 81,
    'items-430': 96,
    'items-431': 94,
  });
  // The weapons-and-ammo-429 ammunition the batch review listed: 17 rows,
  // two of them siege ammunition.
  expect(ammunition429).toHaveLength(17);
  expect(ammunition429.filter(([, siege]) => siege)).toHaveLength(2);
});
