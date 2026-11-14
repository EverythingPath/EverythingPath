import { expect, test } from 'vitest';
import { representativeArchetypeCatalog } from '../../convex/lib/representativeArchetypeCatalog';
import {
  representativeClassCatalog,
  representativeClassCounterparts,
  representativeClassFeatureSchedules,
} from '../../convex/lib/representativeClassCatalog';
import {
  representativeEquipmentCatalog,
  representativeWondrousItemCatalog,
} from '../../convex/lib/representativeItemCatalog';
import { representativeSelectionCatalog } from '../../convex/lib/representativeSelectionCatalog';
import { representativeSpellEffectCatalog } from '../../convex/lib/representativeSpellEffectCatalog';
import { representativeWeaponCatalog } from '../../convex/lib/representativeWeaponCatalog';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  type Ability,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
  type ResolveOptions,
  type SheetEntry,
} from './character-sheet';
import type {
  AttackLine,
  AttackRoutineState,
  ResolvedAttackRoutine,
  WeaponDetail,
} from './character-sheet-attacks';
import { readRoutineOptionProblem } from './character-sheet-routine-options';

// Core flurry of blows: CRB p. 57, Table: Monk (p. 56) and the CRB FAQ
// entries naz (fighter 19/monk 1), o72 (Power Attack and Combat Expertise
// use the flurry BAB) and qk0 (haste stacks). NPC Codex monks are printed
// stat blocks (Paizo, NPC Codex, Monk chapter; no page printed on the PRD).
// Unchained flurry: Pathfinder Unchained p. 14; it has no published worked
// example, so its fixtures only restate the text. Strength, Power Attack and
// the two-weapon chain under flurry are the settled #237 A1–A4 decisions.

type WeaponDefinition = Omit<CharacterSheetCatalogEntry, '_id'> & {
  detail: { kind: 'item'; weapon: WeaponDetail };
};

/** A seeded Base Item weapon (CRB Table 6–4, pp. 142–143). */
function seededWeapon(ruleIdentity: string): WeaponDefinition {
  const definition = representativeWeaponCatalog.find(
    (entry) => entry.ruleIdentity === ruleIdentity,
  );
  if (!definition || !('weapon' in definition.detail))
    throw new Error(`Missing seeded weapon ${ruleIdentity}`);
  return structuredClone(definition) as WeaponDefinition;
}

const weapons = {
  // CRB pp. 143, 147: exotic light, monk and trip.
  kama: seededWeapon('kama'),
  // CRB pp. 142, 148: simple two-handed, double and monk.
  quarterstaff: seededWeapon('quarterstaff'),
  // NPC Codex Axe Dancer's masterwork greataxe: not a flurry weapon. Not
  // seeded; CRB Table 6–4 (pp. 142–143): martial two-handed, 1d12, ×3.
  greataxe: {
    name: 'Greataxe',
    ruleIdentity: 'greataxe',
    modifiers: [],
    detail: {
      kind: 'item',
      weapon: {
        baseType: 'greataxe',
        proficiency: 'martial',
        handedness: 'twoHanded',
        attackType: 'melee',
        dice: '1d12',
        damageTypes: ['slashing'],
        threat: 20,
        mult: 3,
        strengthDamage: 'melee',
      },
    },
  },
  // UC FAQ (Feral Combat Training): a lizardfolk monk's claws.
  claw: seededWeapon('natural-claw'),
} satisfies Record<string, WeaponDefinition>;
type WeaponName = keyof typeof weapons;

type MonkSheet = {
  /** Class rule identities and their level counts, in recorded order. */
  levels: readonly (readonly [string, number])[];
  scores?: Partial<Record<Ability, number>>;
  /** Further Gear: weapons, armor and the amulet. */
  items?: readonly WeaponName[];
  /** A second copy of a weapon, for an off-hand weapon of the same kind. */
  copies?: readonly WeaponName[];
  feats?: readonly { identity: string; choice?: string }[];
  /** The routine's main weapon. */
  weapon?: WeaponName | 'unarmed';
  routine?: Partial<AttackRoutineState>;
  /** Switched-on Routine Options: feat or class-feature Catalog Entry IDs. */
  options?: readonly string[];
  entries?: SheetEntry[];
  catalogEntries?: CharacterSheetCatalogEntry[];
};

const featId = (identity: string) => `feat-def:${identity}`;

function featDefinition(identity: string): CharacterSheetCatalogEntry {
  const seeded = representativeSelectionCatalog.find(
    (definition) => definition.ruleIdentity === identity,
  );
  if (!seeded) throw new Error(`Missing seeded feat ${identity}`);
  return { ...seeded, _id: featId(identity) } as CharacterSheetCatalogEntry;
}

function monkSheet({
  levels,
  scores = {},
  items = [],
  copies = [],
  feats = [],
  weapon = 'unarmed',
  routine = {},
  options = [],
  entries = [],
  catalogEntries = [],
}: MonkSheet): CharacterSheetInput {
  const gear = [
    ...new Set([...(weapon === 'unarmed' ? [] : [weapon]), ...items]),
  ];
  const mainWeapon: WeaponDetail | undefined =
    weapon === 'unarmed' ? undefined : weapons[weapon].detail.weapon;
  const hands = mainWeapon?.handedness === 'twoHanded' ? 'two' : 'one';
  const classRows = levels.flatMap(([identity, count]) =>
    Array.from({ length: count }, () => identity),
  );
  return {
    characterKind: 'pc',
    entries: [
      {
        _id: 'base-row',
        kind: 'base',
        active: true,
        catalogEntryId: 'base',
        state: { kind: 'base' },
      },
      ...classRows.map(
        (classEntryId, index): SheetEntry => ({
          _id: `level-${index + 1}`,
          kind: 'classLevel',
          active: true,
          state: {
            kind: 'classLevel',
            position: index + 1,
            classEntryId,
            hpGained: 5,
          },
        }),
      ),
      ...[...gear, ...copies.map((name) => `${name}-2`)].map(
        (id): SheetEntry => ({
          _id: `item:${id}`,
          kind: 'item',
          active: true,
          catalogEntryId: `weapon:${id.replace(/-2$/, '')}`,
          state: { kind: 'item' },
        }),
      ),
      {
        _id: 'routine',
        kind: 'attackRoutine',
        active: true,
        state: {
          kind: 'attackRoutine',
          name: 'Fists',
          weaponEntryId: weapon === 'unarmed' ? 'unarmed' : `item:${weapon}`,
          hands,
          mode: 'melee',
          options: [...options],
          ...routine,
        },
      },
      {
        _id: 'ordinary',
        kind: 'attackRoutine',
        active: true,
        state: {
          kind: 'attackRoutine',
          name: 'Ordinary',
          weaponEntryId: weapon === 'unarmed' ? 'unarmed' : `item:${weapon}`,
          hands,
          mode: 'melee',
          ...routine,
          options: [...options].filter((id) => !id.endsWith('flurry')),
        },
      },
      ...feats.map(
        ({ identity, choice }): SheetEntry => ({
          _id: `feat:${identity}`,
          kind: 'feat',
          active: true,
          catalogEntryId: featId(identity),
          state: { kind: 'feat', ...(choice ? { choice } : {}) },
        }),
      ),
      ...entries,
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: abilityKeys.map((ability) => ({
          target: abilityTargets[ability],
          bonusType: 'base' as const,
          value: scores[ability] ?? 10,
        })),
      },
      ...representativeClassCatalog.map((definition) => ({
        ...definition,
        _id: definition.ruleIdentity,
        detail: {
          ...definition.detail,
          counterpartOf:
            representativeClassCounterparts[definition.ruleIdentity],
          featuresByLevel:
            representativeClassFeatureSchedules[definition.ruleIdentity] ?? [],
        },
      })),
      ...representativeArchetypeCatalog,
      ...gear.map(
        (name): CharacterSheetCatalogEntry => ({
          ...weapons[name],
          _id: `weapon:${name}`,
        }),
      ),
      ...[
        ...new Set([
          ...feats.map((feat) => feat.identity),
          ...options.flatMap((id) =>
            id.startsWith('feat-def:') ? [id.slice('feat-def:'.length)] : [],
          ),
        ]),
      ].map(featDefinition),
      ...catalogEntries,
    ],
  };
}

type SheetRows = {
  entries: SheetEntry[];
  catalogEntries: CharacterSheetCatalogEntry[];
};

/** A seeded item in the monk's Gear, under its own rule identity. */
function seededItem(
  definition: Omit<CharacterSheetCatalogEntry, '_id'> | undefined,
): SheetRows {
  if (!definition) throw new Error('Missing seeded item');
  const id = definition.ruleIdentity;
  return {
    entries: [
      {
        _id: `item:${id}`,
        kind: 'item',
        active: true,
        catalogEntryId: id,
        state: { kind: 'item' },
      },
    ],
    catalogEntries: [{ ...definition, _id: id }],
  };
}

// CRB p. 496: the NPC Codex's amulets of mighty fists.
const amuletOfMightyFists = (enhancement: number) =>
  seededItem(
    representativeWondrousItemCatalog.find(
      (definition) =>
        definition.ruleIdentity === `amulet-of-mighty-fists-${enhancement}`,
    ),
  );

// CRB p. 294: haste's extra attack and its +1 on attack rolls.
const hasteEffect = ((): SheetRows => {
  const definition = representativeSpellEffectCatalog.find(
    (row) => row.sourceKey === 'haste',
  );
  if (definition?.detail.kind !== 'spellEffect')
    throw new Error('Missing seeded haste');
  return {
    entries: [
      {
        _id: 'effect:haste',
        kind: 'spellEffect',
        active: true,
        catalogEntryId: 'haste',
        state: {
          kind: 'spellEffect',
          casterLevel: definition.detail.defaultCasterLevel,
        },
      },
    ],
    catalogEntries: [{ ...definition, _id: 'haste' }],
  };
})();

/** Table: Monk's unarmed damage for a Medium monk, as the caller supplies it. */
const monkUnarmed = (dice: string): ResolveOptions => ({
  monkUnarmedStrike: { dice, sheetEntryId: 'monk-unarmed-strike' },
});

function routines(input: CharacterSheetInput, options?: ResolveOptions) {
  const calculated = calculateCharacterSheet(input, options);
  const find = (id: string): ResolvedAttackRoutine => {
    const routine = calculated.attackRoutines.find((row) => row.entryId === id);
    if (!routine) throw new Error(`Missing routine ${id}`);
    return routine;
  };
  return {
    flurry: find('routine'),
    ordinary: find('ordinary'),
    warnings: calculated.warnings,
  };
}
const attackTotals = (lines: readonly AttackLine[]) =>
  lines.map((line) => line.attackBonus.total);
const damageTotals = (lines: readonly AttackLine[]) =>
  lines.map((line) => line.damageBonus.total);
function contribution(
  statistic: AttackLine['attackBonus'],
  sheetEntryId: string,
) {
  return statistic.applied
    .filter((row) => row.sheetEntryId === sheetEntryId)
    .reduce((sum, row) => sum + row.value, 0);
}

const coreFlurry = 'monk-flurry';
const unchainedFlurry = 'unchained-monk-flurry';

// Table: Monk (CRB p. 56), the printed Flurry of Blows Attack Bonus column
// and BAB column for a pure monk without ability modifiers.
test.each([
  [1, [0], [-1, -1]],
  [2, [1], [0, 0]],
  [3, [2], [1, 1]],
  [4, [3], [2, 2]],
  [5, [3], [3, 3]],
  [6, [4], [4, 4, -1]],
  [7, [5], [5, 5, 0]],
  [8, [6, 1], [6, 6, 1, 1]],
  [9, [6, 1], [7, 7, 2, 2]],
  [10, [7, 2], [8, 8, 3, 3]],
  [11, [8, 3], [9, 9, 4, 4, -1]],
  [12, [9, 4], [10, 10, 5, 5, 0]],
  [13, [9, 4], [11, 11, 6, 6, 1]],
  [14, [10, 5], [12, 12, 7, 7, 2]],
  [15, [11, 6, 1], [13, 13, 8, 8, 3, 3]],
  [16, [12, 7, 2], [14, 14, 9, 9, 4, 4, -1]],
  [17, [12, 7, 2], [15, 15, 10, 10, 5, 5, 0]],
  [18, [13, 8, 3], [16, 16, 11, 11, 6, 6, 1]],
  [19, [14, 9, 4], [17, 17, 12, 12, 7, 7, 2]],
  [20, [15, 10, 5], [18, 18, 13, 13, 8, 8, 3]],
])(
  'Table: Monk at level %i: ordinary %j, flurry %j',
  (level, ordinary, flurry) => {
    const result = routines(
      monkSheet({ levels: [['monk', level]], options: [coreFlurry] }),
    );
    expect(attackTotals(result.ordinary.full)).toEqual(ordinary);
    expect(attackTotals(result.flurry.full)).toEqual(flurry);
    expect(result.flurry.flurry).toMatchObject({
      version: 'core',
      monkLevel: level,
      attackPenalty: -2,
      baseAttackBonus: { total: level },
    });
    // Single and full attacks are distinct: the single attack is unchanged.
    expect(attackTotals(result.flurry.single)).toEqual([ordinary[0]]);
    expect(result.flurry.single[0]?.extraAttack).toBeUndefined();
    expect(
      result.flurry.full.filter((line) => line.extraAttack?.kind === 'flurry'),
    ).toHaveLength(level >= 15 ? 3 : level >= 8 ? 2 : 1);
  },
);

// CRB FAQ naz (September 2010): "a fighter 19/monk 1 has a normal BAB of
// +19. When he flurries, he treats his monk BAB as +1 … for a total flurry
// BAB of +20."
test('a fighter 19/monk 1 flurries at base attack bonus +20', () => {
  const result = routines(
    monkSheet({
      levels: [
        ['fighter', 19],
        ['monk', 1],
      ],
      options: [coreFlurry],
    }),
  );
  expect(result.flurry.flurry?.baseAttackBonus.total).toBe(20);
  expect(result.flurry.optionNotes).toEqual([
    'Flurry of Blows: base attack bonus +20 with monk level 1, 1 extra attack, −2 on every attack.',
  ]);
  expect(attackTotals(result.ordinary.full)).toEqual([19, 14, 9, 4]);
  expect(attackTotals(result.flurry.full)).toEqual([18, 18, 13, 8, 3]);
  const [first] = result.flurry.full;
  expect(contribution(first!.attackBonus, 'builtin:class:fighter')).toBe(19);
  expect(contribution(first!.attackBonus, 'builtin:class:monk')).toBe(1);
  expect(
    first!.attackBonus.applied.find(
      (row) => row.sheetEntryId === 'builtin:class:monk',
    )?.entryName,
  ).toBe('Flurry of Blows: monk level 1');
});

// CRB FAQ o72 (July 2011): "The monk uses his improved flurrying BAB to
// determine the effect of those feats" (Power Attack and Combat Expertise).
test('Power Attack and Combat Expertise use the flurry base attack bonus of a fighter 19/monk 1', () => {
  const powerAttack = routines(
    monkSheet({
      levels: [
        ['fighter', 19],
        ['monk', 1],
      ],
      feats: [{ identity: 'power-attack' }],
      options: [coreFlurry, featId('power-attack')],
    }),
  );
  // BAB +19: five steps; flurry BAB +20: six.
  expect(
    contribution(
      powerAttack.ordinary.full[0]!.attackBonus,
      'feat:power-attack',
    ),
  ).toBe(-5);
  expect(
    contribution(
      powerAttack.flurry.single[0]!.attackBonus,
      'feat:power-attack',
    ),
  ).toBe(-5);
  for (const line of powerAttack.flurry.full) {
    expect(contribution(line.attackBonus, 'feat:power-attack')).toBe(-6);
    expect(contribution(line.damageBonus, 'feat:power-attack')).toBe(12);
  }
  const combatExpertise = routines(
    monkSheet({
      levels: [
        ['fighter', 19],
        ['monk', 1],
      ],
      scores: { intelligence: 13 },
      feats: [{ identity: 'combat-expertise' }],
      options: [coreFlurry, featId('combat-expertise')],
    }),
  );
  expect(attackTotals(combatExpertise.ordinary.full)).toEqual([
    19 - 5,
    14 - 5,
    9 - 5,
    4 - 5,
  ]);
  expect(attackTotals(combatExpertise.flurry.single)).toEqual([19 - 5]);
  expect(attackTotals(combatExpertise.flurry.full)).toEqual([
    18 - 6,
    18 - 6,
    13 - 6,
    8 - 6,
    3 - 6,
  ]);
});

// FAQ o72; owner (#414): Combat Expertise used in a flurry takes its steps
// from the flurry base attack bonus, so its dodge bonus equals its penalty.
// Table: Monk, 4th level: BAB +3, flurry +2/+2, a flurry base attack bonus
// of +4 (the monk level). Combat Expertise (CRB p. 119): −1/+1 at BAB +3,
// −2/+2 from +4.
test('Combat Expertise’s dodge bonus follows a core flurry’s base attack bonus', () => {
  const input = monkSheet({
    levels: [['monk', 4]],
    scores: { intelligence: 13 },
    feats: [{ identity: 'combat-expertise' }],
    options: [coreFlurry, featId('combat-expertise')],
  });
  const result = routines(input);
  expect(attackTotals(result.ordinary.full)).toEqual([3 - 1]);
  expect(attackTotals(result.flurry.full)).toEqual([2 - 2, 2 - 2]);
  expect(result.flurry.flurry?.combatExpertise).toEqual({
    sheetEntryId: 'feat:combat-expertise',
    name: 'Combat Expertise',
    dodgeBonus: 2,
  });
  expect(result.flurry.optionNotes).toEqual([
    'Flurry of Blows: base attack bonus +4 with monk level 4, 1 extra attack, −2 on every attack.',
    "Combat Expertise: +2 dodge bonus to AC while flurrying, from the flurry's base attack bonus.",
  ]);
  // The sheet's AC Situation belongs to no routine and keeps BAB +3.
  const situation = { option: featId('combat-expertise') };
  const armorClass = (situations: ResolveOptions['situations']) =>
    calculateCharacterSheet(input, { situations }).derivedStatistics.ac.total;
  expect(armorClass([situation]) - armorClass([])).toBe(1);
  // Without Combat Expertise switched on, the flurry reports none.
  const withoutOption = routines(
    monkSheet({
      levels: [['monk', 4]],
      scores: { intelligence: 13 },
      feats: [{ identity: 'combat-expertise' }],
      options: [coreFlurry],
    }),
  );
  expect(withoutOption.flurry.flurry?.combatExpertise).toBeNull();
});

// NPC Codex, Monk: seven printed stat blocks whose flurry arithmetic follows
// the rules (Bullying Brawler, Swift Brawler and Horse Monk carry printing
// errors and are left out).
test.each([
  {
    name: 'Careful Initiate',
    level: 1,
    scores: { strength: 12, dexterity: 16 },
    feats: [{ identity: 'weapon-finesse' }],
    dice: '1d6',
    ordinary: [3],
    flurry: [2, 2],
    damage: 1,
  },
  {
    name: 'Cruel Devotee',
    level: 5,
    scores: { strength: 16 },
    dice: '1d8',
    ordinary: [6],
    flurry: [6, 6],
    damage: 3,
  },
  {
    name: 'Harrying Brute',
    level: 7,
    scores: { strength: 18 },
    weaponFocus: true,
    dice: '1d8',
    ordinary: [10],
    flurry: [10, 10, 5],
    damage: 4,
  },
  {
    name: 'Axe Dancer',
    level: 8,
    scores: { strength: 18 },
    dice: '1d10',
    ordinary: [10, 5],
    flurry: [10, 10, 5, 5],
    damage: 4,
  },
  {
    name: 'Cautious Hunter',
    level: 10,
    scores: { strength: 18 },
    dice: '1d10',
    ordinary: [11, 6],
    flurry: [12, 12, 7, 7],
    damage: 4,
  },
  {
    name: 'Sword Savant',
    level: 19,
    scores: { strength: 20 },
    amulet: 1,
    dice: '2d8',
    ordinary: [20, 15, 10],
    flurry: [23, 23, 18, 18, 13, 13, 8],
    damage: 6,
  },
  {
    name: 'Ageless Master',
    level: 20,
    scores: { strength: 18 },
    amulet: 3,
    weaponFocus: true,
    dice: '2d10',
    ordinary: [23, 18, 13],
    flurry: [26, 26, 21, 21, 16, 16, 11],
    damage: 7,
  },
])(
  'NPC Codex $name: unarmed $ordinary, flurry $flurry',
  ({
    level,
    scores,
    feats = [],
    weaponFocus,
    amulet,
    dice,
    ordinary,
    flurry,
    damage,
  }) => {
    const amulets = amulet ? [amuletOfMightyFists(amulet)] : [];
    const result = routines(
      monkSheet({
        levels: [['monk', level]],
        scores,
        // CRB p. 136: Weapon Focus (unarmed strike).
        feats: [
          ...feats,
          ...(weaponFocus
            ? [{ identity: 'weapon-focus', choice: 'unarmed strike' }]
            : []),
        ],
        options: [coreFlurry],
        entries: amulets.flatMap((extra) => extra.entries),
        catalogEntries: amulets.flatMap((extra) => extra.catalogEntries),
      }),
      monkUnarmed(dice),
    );
    expect(attackTotals(result.ordinary.full)).toEqual(ordinary);
    expect(attackTotals(result.flurry.full)).toEqual(flurry);
    expect(damageTotals(result.flurry.full)).toEqual(flurry.map(() => damage));
    expect(result.flurry.full.map((line) => line.damageDice)).toEqual(
      flurry.map(() => dice),
    );
    expect(attackTotals(result.flurry.single)).toEqual([ordinary[0]]);
  },
);

// CRB FAQ qk0 (April 2013): haste's extra attack stacks with flurry's; every
// flurry attack takes the −2 (CRB p. 57).
test('haste adds one more flurry attack at the highest bonus', () => {
  const result = routines(
    monkSheet({
      levels: [['monk', 5]],
      scores: { strength: 16 },
      options: [coreFlurry],
      ...hasteEffect,
    }),
  );
  // Haste's +1 on attack rolls (CRB p. 294) joins every line.
  expect(attackTotals(result.flurry.full)).toEqual([7, 7, 7]);
  expect(result.flurry.full.map((line) => line.extraAttack?.kind)).toEqual([
    undefined,
    'flurry',
    'haste',
  ]);
  expect(attackTotals(result.ordinary.full)).toEqual([7, 7]);
});

// #237 A1 on the Cruel Devotee's statistics (monk 5, Str 16): flurry BAB +5
// gives Power Attack two steps (−2/+4). Only attacks made with the off-hand
// weapon halve it; unarmed strikes have no off hand.
test('core flurry halves Power Attack only on off-hand weapon attacks', () => {
  const kamas = routines(
    monkSheet({
      levels: [['monk', 5]],
      scores: { strength: 16 },
      weapon: 'kama',
      copies: ['kama'],
      feats: [{ identity: 'power-attack' }],
      routine: {
        offHand: {
          kind: 'weapon',
          weaponEntryId: 'item:kama-2',
          mode: 'melee',
        },
      },
      options: [coreFlurry, featId('power-attack')],
    }),
  );
  expect(
    kamas.flurry.full.map((line) => [
      line.hand,
      line.weaponEntryId,
      line.attackBonus.total,
      line.damageBonus.total,
      contribution(line.damageBonus, 'feat:power-attack'),
    ]),
  ).toEqual([
    ['main', 'item:kama', 4, 7, 4],
    ['off', 'item:kama-2', 4, 5, 2],
  ]);
  expect(kamas.flurry.twoWeaponPenaltySummary).toBeNull();
  const unarmedOffHand = routines(
    monkSheet({
      levels: [['monk', 5]],
      scores: { strength: 16 },
      weapon: 'kama',
      feats: [{ identity: 'power-attack' }],
      routine: {
        offHand: { kind: 'weapon', weaponEntryId: 'unarmed', mode: 'melee' },
      },
      options: [coreFlurry, featId('power-attack')],
    }),
    monkUnarmed('1d8'),
  );
  expect(
    unarmedOffHand.flurry.full.map((line) => [
      line.attackKind,
      line.damageBonus.total,
      contribution(line.damageBonus, 'feat:power-attack'),
    ]),
  ).toEqual([
    ['manufactured', 7, 4],
    ['unarmed', 7, 4],
  ]);
});

// #237 A2 on the Cruel Devotee's statistics: a quarterstaff in both hands
// takes Str ×1 (+3) from the flurry, but Power Attack keeps its +50% (+6).
test('a two-handed monk weapon in a core flurry takes Str ×1 and Power Attack +50%', () => {
  const result = routines(
    monkSheet({
      levels: [['monk', 5]],
      scores: { strength: 16 },
      weapon: 'quarterstaff',
      feats: [{ identity: 'power-attack' }],
      options: [coreFlurry, featId('power-attack')],
    }),
  );
  expect(damageTotals(result.flurry.full)).toEqual([9, 9]);
  for (const line of result.flurry.full)
    expect(contribution(line.damageBonus, 'feat:power-attack')).toBe(6);
  // Outside the flurry the quarterstaff takes Str ×1½ (+4).
  expect(damageTotals(result.ordinary.full)).toEqual([4 + 3]);
});

// #237 A3: a core flurry is not two-weapon fighting: no Table 8–7 penalties,
// no Improved or Greater Two-Weapon Fighting attacks, no Double Slice and no
// Two-Weapon Rend.
test('core flurry ignores the two-weapon chain, Double Slice and Two-Weapon Rend', () => {
  const twoWeaponFeats = [
    'two-weapon-fighting',
    'improved-two-weapon-fighting',
    'greater-two-weapon-fighting',
    'double-slice',
    'two-weapon-rend',
  ].map((identity) => ({ identity }));
  const result = routines(
    monkSheet({
      levels: [['monk', 5]],
      scores: { strength: 16 },
      weapon: 'kama',
      copies: ['kama'],
      feats: twoWeaponFeats,
      routine: {
        offHand: {
          kind: 'weapon',
          weaponEntryId: 'item:kama-2',
          mode: 'melee',
        },
      },
      options: [coreFlurry],
    }),
  );
  expect(
    result.flurry.full.map((line) => [
      line.hand,
      line.attackBonus.total,
      line.damageBonus.total,
    ]),
  ).toEqual([
    ['main', 6, 3],
    ['off', 6, 3],
  ]);
  for (const line of result.flurry.full) {
    expect(contribution(line.attackBonus, 'feat:two-weapon-fighting')).toBe(0);
    expect(contribution(line.damageBonus, 'feat:double-slice')).toBe(0);
  }
  expect(result.flurry.twoWeaponRend).toBeNull();
  expect(result.flurry.twoWeaponPenaltySummary).toBeNull();
  // The same weapons outside the flurry fight with two weapons, where the
  // automatic Improved and Greater Two-Weapon Fighting add off-hand attacks.
  expect(result.ordinary.twoWeaponRend).not.toBeNull();
  expect(
    result.ordinary.full.filter((line) => line.hand === 'off'),
  ).toHaveLength(3);
});

// Pathfinder Unchained p. 14: "one additional attack at his highest base
// attack bonus", and "At 11th level, … an additional attack at his highest
// base attack bonus"; no penalty and no base attack bonus substitution.
test.each([
  [1, [1], [1, 1]],
  [6, [6, 1], [6, 6, 1]],
  [10, [10, 5], [10, 10, 5]],
  [11, [11, 6, 1], [11, 11, 11, 6, 1]],
  [16, [16, 11, 6, 1], [16, 16, 16, 11, 6, 1]],
])(
  'Unchained flurry at monk level %i: ordinary %j, flurry %j',
  (level, ordinary, flurry) => {
    const result = routines(
      monkSheet({
        levels: [['unchained-monk', level]],
        options: [unchainedFlurry],
      }),
    );
    expect(attackTotals(result.ordinary.full)).toEqual(ordinary);
    expect(attackTotals(result.flurry.full)).toEqual(flurry);
    expect(attackTotals(result.flurry.single)).toEqual([ordinary[0]]);
    expect(result.flurry.flurry).toMatchObject({
      version: 'unchained',
      monkLevel: level,
      attackPenalty: 0,
      extraAttacks: level >= 11 ? 2 : 1,
      baseAttackBonus: { total: level },
    });
  },
);

// Pathfinder Unchained p. 14: "This additional attack stacks with the bonus
// attacks from haste".
test('haste stacks with the Unchained flurry', () => {
  const result = routines(
    monkSheet({
      levels: [['unchained-monk', 11]],
      options: [unchainedFlurry],
      ...hasteEffect,
    }),
  );
  // Haste's +1 on attack rolls (CRB p. 294) joins every line.
  expect(attackTotals(result.flurry.full)).toEqual([12, 12, 12, 12, 7, 2]);
});

// #237 A4 on an Unchained monk 5 with Str 16: monk weapons follow the
// normal Strength and Power Attack rules, without two-weapon penalties.
// PU p. 14: the multiple weapons add no attacks. Owner decision (#414):
// Double Slice and Two-Weapon Rend apply to the off-hand lines.
test('Unchained flurry keeps ordinary Strength and Power Attack per hand', () => {
  const kamas = routines(
    monkSheet({
      levels: [['unchained-monk', 5]],
      scores: { strength: 16 },
      weapon: 'kama',
      copies: ['kama'],
      feats: [
        { identity: 'power-attack' },
        { identity: 'two-weapon-fighting' },
        { identity: 'improved-two-weapon-fighting' },
      ],
      routine: {
        offHand: {
          kind: 'weapon',
          weaponEntryId: 'item:kama-2',
          mode: 'melee',
        },
      },
      options: [unchainedFlurry, featId('power-attack')],
    }),
  );
  expect(
    kamas.flurry.full.map((line) => [
      line.hand,
      line.attackBonus.total,
      line.damageBonus.total,
    ]),
  ).toEqual([
    ['main', 6, 7],
    ['off', 6, 3],
  ]);
  expect(kamas.flurry.twoWeaponPenaltySummary).toBeNull();
  const quarterstaff = routines(
    monkSheet({
      levels: [['unchained-monk', 5]],
      scores: { strength: 16 },
      weapon: 'quarterstaff',
      feats: [{ identity: 'power-attack' }],
      options: [unchainedFlurry, featId('power-attack')],
    }),
  );
  expect(damageTotals(quarterstaff.flurry.full)).toEqual([10, 10]);
  const doubleSlice = routines(
    monkSheet({
      levels: [['unchained-monk', 5]],
      scores: { strength: 16 },
      weapon: 'kama',
      copies: ['kama'],
      feats: [{ identity: 'double-slice' }, { identity: 'two-weapon-rend' }],
      routine: {
        offHand: {
          kind: 'weapon',
          weaponEntryId: 'item:kama-2',
          mode: 'melee',
        },
      },
      options: [unchainedFlurry],
    }),
  );
  expect(damageTotals(doubleSlice.flurry.full)).toEqual([3, 3]);
  expect(
    contribution(doubleSlice.flurry.full[1]!.damageBonus, 'feat:double-slice'),
  ).toBe(2);
  expect(doubleSlice.flurry.twoWeaponRend).toMatchObject({
    damageDice: '1d10',
    damageBonus: { total: 4 },
  });
  // PU p. 14: "There is no such thing as an off-hand attack for a monk
  // striking unarmed."
  const unarmedOffHand = routines(
    monkSheet({
      levels: [['unchained-monk', 5]],
      scores: { strength: 16 },
      weapon: 'kama',
      feats: [{ identity: 'power-attack' }],
      routine: {
        offHand: { kind: 'weapon', weaponEntryId: 'unarmed', mode: 'melee' },
      },
      options: [unchainedFlurry, featId('power-attack')],
    }),
    monkUnarmed('1d8'),
  );
  expect(damageTotals(unarmedOffHand.flurry.full)).toEqual([7, 7]);
});

// Owner decision (#414): each flurry counts only its own version's monk
// levels, despite the advisory against mixing versions (PU p. 6). The class
// family grants one Flurry of Blows, from whichever version comes first.
test('mixed core and Unchained monk levels count each version separately', () => {
  const coreFirst = [
    ['monk', 5],
    ['unchained-monk', 6],
  ] as const;
  const core = routines(
    monkSheet({ levels: coreFirst, options: [coreFlurry] }),
  );
  // BAB 3 + 6 = +9; core flurry replaces the monk's +3 with 5: +11. Eleven
  // family levels, but five core levels: one extra attack, not two.
  expect(core.flurry.flurry).toMatchObject({
    monkLevel: 5,
    extraAttacks: 1,
    baseAttackBonus: { total: 11 },
  });
  expect(attackTotals(core.flurry.full)).toEqual([9, 9, 4, -1]);
  expect(
    routines(monkSheet({ levels: coreFirst, options: [unchainedFlurry] }))
      .flurry.flurry,
  ).toBeNull();
  const unchainedFirst = [
    ['unchained-monk', 6],
    ['monk', 5],
  ] as const;
  // Eleven family levels, but six Unchained levels: one extra attack.
  const unchained = routines(
    monkSheet({ levels: unchainedFirst, options: [unchainedFlurry] }),
  );
  expect(unchained.flurry.flurry).toMatchObject({
    monkLevel: 6,
    extraAttacks: 1,
    baseAttackBonus: { total: 9 },
  });
  expect(attackTotals(unchained.flurry.full)).toEqual([9, 9, 4]);
});

// CRB p. 57: "A monk with natural weapons cannot use such weapons as part of
// a flurry of blows"; UC FAQ (Feral Combat Training) names a lizardfolk
// monk's claws. #237 A5: they stay out of the flurry, recorded and warned.
test('natural attacks stay recorded but out of the flurry, with a warning', () => {
  const result = routines(
    monkSheet({
      levels: [['monk', 5]],
      scores: { strength: 16 },
      items: ['claw'],
      routine: { naturalAttackEntryIds: ['item:claw'] },
      options: [coreFlurry],
    }),
  );
  expect(result.flurry.full.map((line) => line.attackKind)).toEqual([
    'unarmed',
    'unarmed',
  ]);
  expect(result.ordinary.full.map((line) => line.attackKind)).toEqual([
    'unarmed',
    'natural',
  ]);
  expect(result.flurry.warnings).toContainEqual(
    expect.objectContaining({
      check: 'flurryNaturalAttacks',
      target: { kind: 'entry', entryId: 'routine' },
      message:
        "Natural attacks can't be part of a flurry of blows. Fists keeps them recorded but leaves them out of its flurry.",
    }),
  );
  expect(
    result.ordinary.warnings.some((warning) =>
      warning.check.startsWith('flurry'),
    ),
  ).toBe(false);
});

// CRB p. 57: a natural attack can't make the flurry's attacks either.
test('a natural main weapon leaves the flurry without effect', () => {
  const result = routines(
    monkSheet({
      levels: [['monk', 5]],
      weapon: 'claw',
      options: [coreFlurry],
    }),
  );
  expect(result.flurry.flurry).toBeNull();
  expect(result.flurry.full).toEqual(result.ordinary.full);
  expect(result.flurry.options).toContainEqual(
    expect.objectContaining({
      ruleIdentity: coreFlurry,
      switchedOn: true,
      applicable: false,
    }),
  );
  expect(result.flurry.optionNotes).toEqual([
    "Flurry of Blows can't use a natural attack. It has no effect in this routine.",
  ]);
  expect(result.flurry.warnings.map((warning) => warning.check)).toContain(
    'flurryNaturalAttacks',
  );
});

// NPC Codex Axe Dancer: the masterwork greataxe is not a flurry weapon.
// CRB p. 57: "A monk cannot use any weapon other than an unarmed strike or a
// special monk weapon as part of a flurry of blows." The attacks are kept.
test('a weapon without the monk quality keeps its flurry lines with a warning', () => {
  const result = routines(
    monkSheet({
      levels: [['monk', 8]],
      scores: { strength: 18 },
      weapon: 'greataxe',
      options: [coreFlurry],
    }),
  );
  expect(attackTotals(result.flurry.full)).toHaveLength(4);
  expect(result.flurry.warnings).toContainEqual(
    expect.objectContaining({
      check: 'flurryWeapon',
      message:
        "Greataxe isn't a monk weapon. A flurry of blows uses only unarmed strikes and monk weapons; Fists keeps its flurry attacks.",
    }),
  );
  const monkWeapon = routines(
    monkSheet({
      levels: [['monk', 8]],
      weapon: 'quarterstaff',
      options: [coreFlurry],
    }),
  );
  expect(
    monkWeapon.flurry.warnings.some(
      (warning) => warning.check === 'flurryWeapon',
    ),
  ).toBe(false);
});

// CRB p. 57: "When wearing armor, using a shield, or carrying a medium or
// heavy load, a monk loses … his flurry of blows". The sheet tracks no load.
// A monk is proficient with no armor or shield (CRB, monk), so each one's
// armor check penalty (2, CRB Table 6–6, p. 151) also falls on every attack
// roll (CRB, Light Armor Proficiency and Shield Proficiency).
test.each(['chain-shirt', 'heavy-wooden-shield'])(
  'a worn %s warns and keeps the flurry',
  (ruleIdentity) => {
    const definition = representativeEquipmentCatalog.find(
      (row) => row.ruleIdentity === ruleIdentity,
    );
    const result = routines(
      monkSheet({
        levels: [['monk', 5]],
        options: [coreFlurry],
        ...seededItem(definition),
      }),
    );
    expect(attackTotals(result.flurry.full)).toEqual([1, 1]);
    expect(result.flurry.warnings).toContainEqual(
      expect.objectContaining({
        check: 'flurryArmor',
        message: `A monk loses flurry of blows while wearing armor or using a shield (${definition?.name}). Fists keeps its flurry attacks.`,
      }),
    );
  },
);

// The flurry is a Routine Option offered by the counting class feature.
test('a monk is offered the flurry of his own version', () => {
  const core = routines(monkSheet({ levels: [['monk', 1]] }));
  expect(core.flurry.options).toEqual([
    {
      catalogEntryId: coreFlurry,
      name: 'Flurry of Blows',
      ruleIdentity: coreFlurry,
      switchedOn: false,
      available: true,
      applicable: true,
    },
  ]);
  expect(core.flurry.flurry).toBeNull();
  const unchained = routines(monkSheet({ levels: [['unchained-monk', 1]] }));
  expect(unchained.flurry.options.map((option) => option.ruleIdentity)).toEqual(
    [unchainedFlurry],
  );
  const fighter = routines(monkSheet({ levels: [['fighter', 1]] }));
  expect(fighter.flurry.options).toEqual([]);
});

// Class-version changes (#406): a recorded core flurry has no effect on
// Unchained levels until the writer maps it; the mapped option then applies.
test('a class-version change leaves the other version’s flurry recorded with a warning', () => {
  const switched = routines(
    monkSheet({ levels: [['unchained-monk', 5]], options: [coreFlurry] }),
  );
  expect(switched.flurry.flurry).toBeNull();
  expect(attackTotals(switched.flurry.full)).toEqual([5]);
  const warning = switched.flurry.warnings.find(
    (row) => row.check === 'missingRoutineOption',
  );
  expect(warning).toMatchObject({
    message:
      "Flurry of Blows is switched on in Fists, but the class feature doesn't count on this sheet. It has no effect until it does.",
  });
  expect(warning && readRoutineOptionProblem(warning)).toBe('not-counting');
  const mapped = routines(
    monkSheet({ levels: [['unchained-monk', 5]], options: [unchainedFlurry] }),
  );
  expect(attackTotals(mapped.flurry.full)).toEqual([5, 5]);
});

// APG p. 115: the zen archer flurries "only when using a bow", so his
// archetype replaces the monk's Flurry of Blows and its Grant is dormant
// (#305). The recorded core flurry stays on with an advisory; the archetype
// was written for the core monk (PU p. 6), so on Unchained levels it
// replaces nothing and the mapped Unchained flurry applies.
test('a zen archer’s replaced flurry no longer counts until the monk is Unchained', () => {
  const zenArcher = (levels: MonkSheet['levels'], options: readonly string[]) =>
    routines(
      monkSheet({
        levels,
        options,
        entries: [
          {
            _id: 'archetype',
            kind: 'archetype',
            active: true,
            catalogEntryId: 'monk-zen-archer',
            state: { kind: 'archetype', classEntryId: levels[0]![0] },
          },
        ],
      }),
    );
  const core = zenArcher([['monk', 2]], [coreFlurry]);
  expect(core.flurry.flurry).toBeNull();
  expect(attackTotals(core.flurry.full)).toEqual([1]);
  expect(core.flurry.options).toEqual([
    expect.objectContaining({
      ruleIdentity: coreFlurry,
      switchedOn: true,
      available: false,
    }),
  ]);
  const warning = core.flurry.warnings.find(
    (row) => row.check === 'missingRoutineOption',
  );
  expect(warning).toMatchObject({
    message:
      "Flurry of Blows is switched on in Fists, but the class feature doesn't count on this sheet. It has no effect until it does.",
  });
  expect(warning && readRoutineOptionProblem(warning)).toBe('not-counting');
  const unchained = zenArcher([['unchained-monk', 2]], [unchainedFlurry]);
  expect(unchained.flurry.flurry).toMatchObject({
    version: 'unchained',
    monkLevel: 2,
  });
  expect(attackTotals(unchained.flurry.full)).toEqual([2, 2]);
  expect(
    unchained.flurry.warnings.filter(
      (row) => row.check === 'missingRoutineOption',
    ),
  ).toEqual([]);
  expect(unchained.warnings.map((row) => row.check)).toContain(
    'archetypeUnchainedMonk',
  );
});

// Speed (CRB p. 471; #764): "one extra attack with it", at the full base
// attack bonus and not cumulative with haste. In a flurry it is an attack
// with the speed weapon at that weapon's highest flurry bonus.
const speedAbility: CharacterSheetCatalogEntry = {
  _id: 'speed',
  name: 'Speed',
  ruleIdentity: 'speed',
  sourceKey: 'haste',
  modifiers: [],
  detail: { kind: 'itemAbility', appliesTo: 'weapon', bonusEquivalent: 3 },
};
function withSpeed(input: CharacterSheetInput, itemId: string) {
  return {
    ...input,
    entries: input.entries.map((entry) =>
      entry._id === itemId && entry.kind === 'item'
        ? {
            ...entry,
            state: {
              ...entry.state,
              enhancement: 1,
              abilities: [{ catalogEntryId: 'speed' }],
            },
          }
        : entry,
    ),
    catalogEntries: [...input.catalogEntries, speedAbility],
  };
}
const speedLines = (lines: readonly AttackLine[]) =>
  lines.map((line) => [
    line.hand,
    line.weaponEntryId,
    line.attackBonus.total,
    line.extraAttack?.kind ?? null,
    line.extraAttack?.sheetEntryId ?? null,
  ]);

test.each([
  ['core', 'monk', coreFlurry],
  ['Unchained', 'unchained-monk', unchainedFlurry],
] as const)(
  'a %s flurry gives a speed off-hand weapon its one extra attack, never more with haste',
  (_version, monk, flurry) => {
    const kamas = (main: string, haste: boolean) =>
      routines(
        withSpeed(
          monkSheet({
            levels: [[monk, 5]],
            scores: { strength: 16 },
            weapon: 'kama',
            copies: ['kama'],
            routine: {
              offHand: {
                kind: 'weapon',
                weaponEntryId: 'item:kama-2',
                mode: 'melee',
              },
            },
            options: [flurry],
            ...(haste ? hasteEffect : {}),
          }),
          main,
        ),
      ).flurry.full;
    const hasteLines = (lines: readonly AttackLine[]) =>
      speedLines(lines).filter(([, , , kind]) => kind === 'haste');
    // Speed on the off-hand kama: its extra attack is with that kama, at the
    // off-hand flurry line's bonus.
    const offSpeed = kamas('item:kama-2', false);
    const offLine = speedLines(offSpeed).find(
      ([hand, , , kind]) => hand === 'off' && kind !== 'haste',
    );
    expect(hasteLines(offSpeed)).toEqual([
      ['off', 'item:kama-2', offLine?.[2], 'haste', 'item:kama-2'],
    ]);
    expect(offSpeed).toHaveLength(3);
    // With haste as well: one extra attack, haste's own with the main hand.
    const hasted = kamas('item:kama-2', true);
    expect(hasteLines(hasted)).toEqual([
      ['main', 'item:kama', expect.any(Number), 'haste', 'effect:haste'],
    ]);
    expect(hasted).toHaveLength(3);
    // Speed on the main kama: unchanged, one main-hand extra attack with it.
    expect(hasteLines(kamas('item:kama', false))).toEqual([
      ['main', 'item:kama', expect.any(Number), 'haste', 'item:kama'],
    ]);
  },
);
