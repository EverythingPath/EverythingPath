import { expect, test } from 'vitest';
import { representativeClassCatalog } from '../../convex/lib/representativeClassCatalog';
import { representativeSelectionCatalog } from '../../convex/lib/representativeSelectionCatalog';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  calculateCharacterSheetProjections,
  type Ability,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
  type ResolveOptions,
  type SheetEntry,
} from './character-sheet';
import {
  defaultAttackRoutineConfiguration,
  type AttackLine,
  type AttackRoutineState,
  type WeaponDetail,
} from './character-sheet-attacks';
import {
  readRoutineOptionProblem,
  routineOptionWarningSubject,
} from './character-sheet-routine-options';

// Printed numbers from the CRB feat chapter (pp. 118–136), the haste spell
// (p. 293) and the settled #229/#235/#237 decisions, through the public
// calculator. The routine options are the representative seeded feats.

const weapons = {
  longsword: {
    baseType: 'longsword',
    proficiency: 'martial',
    handedness: 'oneHanded',
    attackType: 'melee',
    dice: '1d8',
    damageTypes: ['slashing'],
    threat: 19,
    mult: 2,
    strengthDamage: 'melee',
  },
  greatsword: {
    baseType: 'greatsword',
    proficiency: 'martial',
    handedness: 'twoHanded',
    attackType: 'melee',
    dice: '2d6',
    damageTypes: ['slashing'],
    threat: 19,
    mult: 2,
    strengthDamage: 'melee',
  },
  dagger: {
    baseType: 'dagger',
    proficiency: 'simple',
    handedness: 'light',
    attackType: 'melee',
    dice: '1d4',
    damageTypes: ['piercing'],
    threat: 19,
    mult: 2,
    strengthDamage: 'melee',
  },
  rapier: {
    baseType: 'rapier',
    proficiency: 'martial',
    handedness: 'oneHanded',
    attackType: 'melee',
    dice: '1d6',
    damageTypes: ['piercing'],
    threat: 18,
    mult: 2,
    strengthDamage: 'melee',
    finesse: true,
  },
  'elven curve blade': {
    baseType: 'elven curve blade',
    proficiency: 'exotic',
    handedness: 'twoHanded',
    attackType: 'melee',
    dice: '1d10',
    damageTypes: ['slashing'],
    threat: 18,
    mult: 2,
    strengthDamage: 'melee',
    finesse: true,
  },
  longbow: {
    baseType: 'longbow',
    proficiency: 'martial',
    handedness: 'twoHanded',
    attackType: 'ranged',
    dice: '1d8',
    damageTypes: ['piercing'],
    threat: 20,
    mult: 3,
    strengthDamage: 'bow',
    rangeIncrement: 100,
  },
  'light crossbow': {
    baseType: 'light crossbow',
    proficiency: 'simple',
    handedness: 'twoHanded',
    attackType: 'ranged',
    dice: '1d8',
    damageTypes: ['piercing'],
    threat: 19,
    mult: 2,
    strengthDamage: 'crossbow',
    rangeIncrement: 80,
    reload: 'move',
  },
  javelin: {
    baseType: 'javelin',
    proficiency: 'simple',
    handedness: 'oneHanded',
    attackType: 'ranged',
    dice: '1d6',
    damageTypes: ['piercing'],
    threat: 20,
    mult: 2,
    thrown: true,
    strengthDamage: 'thrown',
    rangeIncrement: 30,
  },
  'gnome hooked hammer': {
    baseType: 'gnome hooked hammer',
    proficiency: 'exotic',
    handedness: 'twoHanded',
    attackType: 'melee',
    dice: '1d8',
    damageTypes: ['bludgeoning'],
    threat: 20,
    mult: 3,
    strengthDamage: 'melee',
    otherEnd: { dice: '1d6', threat: 20, mult: 4, damageTypes: ['piercing'] },
  },
  claw: {
    baseType: 'claw',
    proficiency: 'always',
    naturalAttack: { type: 'claw' },
  },
  bite: {
    baseType: 'bite',
    proficiency: 'always',
    naturalAttack: { type: 'bite' },
  },
} satisfies Record<string, WeaponDetail>;
type WeaponName = keyof typeof weapons;

type FeatSpec = {
  identity: string;
  /** Row suffix, for a second Selection of the same feat. */
  id?: string;
  choice?: string;
  active?: boolean;
  /** A renamed copy whose Catalog Entry differs from the recorded option. */
  copy?: boolean;
};

const featDefinitionId = (identity: string) => `feat-def:${identity}`;
const featRowId = (feat: FeatSpec) => `feat:${feat.id ?? feat.identity}`;

function featDefinition(identity: string): CharacterSheetCatalogEntry {
  const seeded = representativeSelectionCatalog.find(
    (definition) => definition.ruleIdentity === identity,
  );
  return {
    ...(seeded ?? {
      name: identity,
      ruleIdentity: identity,
      modifiers: [],
      detail: { kind: 'feat' as const },
    }),
    _id: featDefinitionId(identity),
  } as CharacterSheetCatalogEntry;
}

function optionSheet({
  bab = 11,
  scores = {},
  weapon = 'longsword',
  items = [],
  routine = {},
  feats = [],
  options = [],
  entries = [],
  catalogEntries = [],
  shieldProficiency = true,
}: {
  bab?: number;
  scores?: Partial<Record<Ability, number>>;
  weapon?: WeaponName | 'unarmed';
  /** Further Gear weapons, for off hands and natural attacks. */
  items?: WeaponName[];
  routine?: Partial<AttackRoutineState>;
  feats?: FeatSpec[];
  /** Feat identities switched on in the routine. */
  options?: string[];
  entries?: SheetEntry[];
  catalogEntries?: CharacterSheetCatalogEntry[];
  shieldProficiency?: boolean;
} = {}): CharacterSheetInput {
  const gear = [
    ...new Set([...(weapon === 'unarmed' ? [] : [weapon]), ...items]),
  ];
  const mainWeapon = weapon === 'unarmed' ? undefined : weapons[weapon];
  const featDefinitions = [
    ...new Map(
      [...feats.map((feat) => feat.identity), ...options].map((identity) => [
        identity,
        featDefinition(identity),
      ]),
    ).values(),
  ];
  return {
    characterKind: 'pc',
    entries: [
      {
        _id: 'base-row',
        kind: 'base',
        active: true,
        catalogEntryId: 'base',
        state: {
          kind: 'base',
          proficiencies: {
            added: [
              { category: 'simple' },
              { category: 'martial' },
              ...(shieldProficiency ? [{ category: 'shield' as const }] : []),
              { baseType: 'gnome hooked hammer' },
              { baseType: 'elven curve blade' },
            ],
            removed: [],
          },
        },
      },
      {
        _id: 'bab-row',
        kind: 'manual',
        active: true,
        catalogEntryId: 'bab',
        state: { kind: 'manual' },
      },
      ...gear.map(
        (name): SheetEntry => ({
          _id: `item:${name}`,
          kind: 'item',
          active: true,
          catalogEntryId: `weapon:${name}`,
          state: { kind: 'item' },
        }),
      ),
      {
        _id: 'routine',
        kind: 'attackRoutine',
        active: true,
        state: {
          kind: 'attackRoutine',
          name: 'Routine',
          weaponEntryId: weapon === 'unarmed' ? 'unarmed' : `item:${weapon}`,
          ...(mainWeapon
            ? defaultAttackRoutineConfiguration(mainWeapon)
            : { hands: 'one', mode: 'melee' }),
          options: options.map(featDefinitionId),
          ...routine,
        },
      },
      ...feats.map(
        (feat): SheetEntry => ({
          _id: featRowId(feat),
          kind: 'feat',
          active: feat.active ?? true,
          catalogEntryId: feat.copy
            ? `copy:${feat.identity}`
            : featDefinitionId(feat.identity),
          state: {
            kind: 'feat',
            ...(feat.choice ? { choice: feat.choice } : {}),
          },
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
          value:
            scores[ability] ??
            (ability === 'strength' ? 18 : ability === 'dexterity' ? 14 : 10),
        })),
      },
      {
        _id: 'bab',
        ruleIdentity: 'bab',
        modifiers: [{ target: 'bab', bonusType: 'untyped', value: bab }],
      },
      ...gear.map(
        (name): CharacterSheetCatalogEntry => ({
          _id: `weapon:${name}`,
          name: name.charAt(0).toUpperCase() + name.slice(1),
          ruleIdentity: name,
          modifiers: [],
          detail: { kind: 'item', weapon: weapons[name] },
        }),
      ),
      ...featDefinitions,
      ...feats.flatMap((feat) =>
        feat.copy
          ? [
              {
                ...featDefinition(feat.identity),
                _id: `copy:${feat.identity}`,
                name: `Renamed ${feat.identity}`,
              },
            ]
          : [],
      ),
      ...catalogEntries,
    ],
  };
}

const withFeats = (...identities: string[]) =>
  identities.map((identity) => ({ identity }));

function calculateRoutine(
  input: CharacterSheetInput,
  options?: ResolveOptions,
) {
  return calculateCharacterSheet(input, options).attackRoutines[0]!;
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

// CRB p. 131: −1/+2, and −1/+2 more at base attack bonus +4 and every 4 after.
test.each([
  [1, -1, 2],
  [3, -1, 2],
  [4, -2, 4],
  [8, -3, 6],
  [11, -3, 6],
  [12, -4, 8],
  [16, -5, 10],
  [20, -6, 12],
])(
  'Power Attack at base attack bonus +%i is %i on attacks and +%i on one-handed damage',
  (bab, penalty, bonus) => {
    const routine = calculateRoutine(
      optionSheet({
        bab,
        feats: withFeats('power-attack'),
        options: ['power-attack'],
      }),
    );
    for (const line of [...routine.single, ...routine.full]) {
      expect(contribution(line.attackBonus, 'feat:power-attack')).toBe(penalty);
      expect(contribution(line.damageBonus, 'feat:power-attack')).toBe(bonus);
    }
    expect(routine.single[0]!.attackBonus.total).toBe(bab + 4 + penalty);
    expect(routine.single[0]!.damageBonus.total).toBe(4 + bonus);
    expect(routine.options).toContainEqual(
      expect.objectContaining({
        catalogEntryId: 'feat-def:power-attack',
        name: 'Power Attack',
        switchedOn: true,
        available: true,
        applicable: true,
      }),
    );
  },
);

// CRB p. 131 (+50% two-handed or one-handed in two hands, a light weapon
// excluded; −50% off hand); FAQ July 2013: a weapon in one hand counts as
// one-handed; #237 A10: a double weapon's primary end is plain.
test.each([
  ['longsword in one hand', 'longsword', {}, [], 6, undefined],
  ['longsword in two hands', 'longsword', { hands: 'two' }, [], 9, undefined],
  ['greatsword', 'greatsword', {}, [], 9, undefined],
  ['greatsword in one hand', 'greatsword', { hands: 'one' }, [], 6, undefined],
  ['dagger in two hands', 'dagger', { hands: 'two' }, [], 6, undefined],
  [
    'longsword with an off-hand dagger',
    'longsword',
    {
      offHand: { kind: 'weapon', weaponEntryId: 'item:dagger', mode: 'melee' },
    },
    ['dagger'],
    6,
    3,
  ],
  [
    'gnome hooked hammer using both ends',
    'gnome hooked hammer',
    { offHand: { kind: 'otherEnd', mode: 'melee' } },
    [],
    6,
    3,
  ],
  [
    'gnome hooked hammer, one end in two hands',
    'gnome hooked hammer',
    {},
    [],
    9,
    undefined,
  ],
] as const)(
  'Power Attack damage with a %s',
  (_, weapon, routine, items, mainBonus, offBonus) => {
    const calculated = calculateRoutine(
      optionSheet({
        weapon,
        items: [...items],
        routine: routine as Partial<AttackRoutineState>,
        feats: withFeats('power-attack'),
        options: ['power-attack'],
      }),
    );
    const main = calculated.full.filter((line) => line.hand === 'main');
    const off = calculated.full.filter((line) => line.hand === 'off');
    expect(
      main.map((line) => contribution(line.damageBonus, 'feat:power-attack')),
    ).toEqual(main.map(() => mainBonus));
    expect(
      off.map((line) => contribution(line.damageBonus, 'feat:power-attack')),
    ).toEqual(off.map(() => offBonus));
    expect(
      contribution(calculated.single[0]!.damageBonus, 'feat:power-attack'),
    ).toBe(
      'offHand' in routine && routine.offHand.kind === 'otherEnd'
        ? 9
        : mainBonus,
    );
  },
);

// CRB p. 131: a primary natural weapon with 1½ Strength gets +50%, a
// secondary one −50%; #237 A5 makes naturals beside a weapon secondary.
test('Power Attack follows the natural attack Strength multiplier', () => {
  const sole = calculateRoutine(
    optionSheet({
      weapon: 'claw',
      feats: withFeats('power-attack'),
      options: ['power-attack'],
    }),
  );
  expect(contribution(sole.single[0]!.damageBonus, 'feat:power-attack')).toBe(
    9,
  );
  const mixed = calculateRoutine(
    optionSheet({
      items: ['bite'],
      routine: { naturalAttackEntryIds: ['item:bite'] },
      feats: withFeats('power-attack'),
      options: ['power-attack'],
    }),
  );
  const bite = mixed.full.find((line) => line.attackKind === 'natural')!;
  expect(bite.naturalRole).toBe('secondary');
  expect(contribution(bite.attackBonus, 'feat:power-attack')).toBe(-3);
  expect(contribution(bite.damageBonus, 'feat:power-attack')).toBe(3);
});

// CRB p. 131: melee only; the CMB penalty is a Situation outside the lines.
test('Power Attack leaves ranged and thrown routines alone and puts its CMB penalty in a Situation', () => {
  for (const weapon of ['longbow', 'javelin'] as const) {
    const routine = calculateRoutine(
      optionSheet({
        weapon,
        feats: withFeats('power-attack'),
        options: ['power-attack'],
      }),
    );
    const line = routine.single[0]!;
    expect(contribution(line.attackBonus, 'feat:power-attack')).toBe(0);
    expect(contribution(line.damageBonus, 'feat:power-attack')).toBe(0);
    expect(routine.optionNotes).toContain(
      'Power Attack applies to melee attacks only. It has no effect in this routine.',
    );
    expect(routine.options[0]).toMatchObject({ applicable: false });
  }
  const input = optionSheet({
    feats: withFeats('power-attack'),
    options: ['power-attack'],
  });
  const ordinary = calculateCharacterSheet(input);
  expect(ordinary.derivedStatistics.cmb.total).toBe(15);
  const preview = calculateCharacterSheet(input, {
    situations: [{ option: 'feat-def:power-attack' }],
  });
  expect(preview.derivedStatistics.cmb.total).toBe(12);
});

// CRB p. 121: ranged attacks, thrown included, with no hand multiplier.
test.each([
  ['longbow', 13 - 3, 0 + 6],
  ['javelin', 13 - 3, 4 + 6],
  ['longsword', 15, 4],
] as const)('Deadly Aim on a %s routine', (weapon, attack, damage) => {
  const routine = calculateRoutine(
    optionSheet({
      weapon,
      feats: withFeats('deadly-aim'),
      options: ['deadly-aim'],
    }),
  );
  expect(routine.single[0]!.attackBonus.total).toBe(attack);
  expect(routine.single[0]!.damageBonus.total).toBe(damage);
});

// CRB p. 119: −1 melee attack and CMB for +1 dodge AC, scaling every 4 BAB.
test('Combat Expertise changes melee lines, while its dodge AC and CMB are a Situation', () => {
  const input = optionSheet({
    feats: withFeats('combat-expertise'),
    options: ['combat-expertise'],
  });
  const ordinary = calculateCharacterSheet(input);
  const routine = ordinary.attackRoutines[0]!;
  expect(attackTotals(routine.full)).toEqual([12, 7, 2]);
  expect(ordinary.derivedStatistics.ac.total).toBe(12);
  expect(ordinary.derivedStatistics.cmb.total).toBe(15);
  expect(
    ordinary.breakdowns['ac.other'].conditional.map((row) => row.entryName),
  ).toEqual(['Combat Expertise']);
  const preview = calculateCharacterSheet(input, {
    situations: [{ option: 'feat-def:combat-expertise' }],
  });
  expect(preview.derivedStatistics.ac.total).toBe(15);
  expect(preview.derivedStatistics.touchAc.total).toBe(15);
  expect(preview.derivedStatistics.cmb.total).toBe(12);
  const ranged = calculateRoutine(
    optionSheet({
      weapon: 'longbow',
      feats: withFeats('combat-expertise'),
      options: ['combat-expertise'],
    }),
  );
  expect(ranged.single[0]!.attackBonus.total).toBe(13);
});

// CRB p. 118; #237 A7: +1, and +1 per five caster levels, on every weapon,
// natural attacks and unarmed strikes included.
test.each([
  [0, 1],
  [4, 1],
  [5, 2],
  [10, 3],
  [20, 5],
])(
  'Arcane Strike at arcane caster level %i adds +%i damage to every line',
  (casterLevel, bonus) => {
    for (const weapon of ['longsword', 'longbow', 'claw', 'unarmed'] as const) {
      const ordinary = calculateRoutine(optionSheet({ weapon }));
      const routine = calculateRoutine(
        optionSheet({
          weapon,
          feats: withFeats('arcane-strike'),
          options: ['arcane-strike'],
        }),
        { arcaneCasterLevel: casterLevel },
      );
      expect(damageTotals(routine.full)).toEqual(
        damageTotals(ordinary.full).map((total) => total + bonus),
      );
    }
  },
);

// CRB p. 118: a wizard's own arcane caster level reaches Arcane Strike
// through the calculator's casting stage, not a supplied option.
test.each([
  [4, 1],
  [5, 2],
  [10, 3],
])(
  'Arcane Strike for a %ith-level wizard adds +%i damage',
  (wizardLevel, bonus) => {
    const wizard = representativeClassCatalog.find(
      (definition) => definition.ruleIdentity === 'wizard',
    );
    if (!wizard) throw new Error('Missing representative wizard');
    const sheet = (options: string[]) =>
      optionSheet({
        feats: withFeats('arcane-strike'),
        options,
        entries: Array.from(
          { length: wizardLevel },
          (_, index): SheetEntry => ({
            _id: `wizard-${index + 1}`,
            kind: 'classLevel',
            active: true,
            state: {
              kind: 'classLevel',
              classEntryId: 'wizard',
              position: index + 1,
              hpGained: 4,
            },
          }),
        ),
        catalogEntries: [
          { ...wizard, _id: 'wizard' } as CharacterSheetCatalogEntry,
        ],
      });
    const ordinary = calculateCharacterSheet(sheet([]));
    expect(ordinary.spellcastings).toContainEqual(
      expect.objectContaining({
        classTag: 'wizard',
        casterLevel: expect.objectContaining({ total: wizardLevel }),
      }),
    );
    const routine = calculateRoutine(sheet(['arcane-strike']));
    expect(damageTotals(routine.full)).toEqual(
      damageTotals(ordinary.attackRoutines[0]!.full).map(
        (total) => total + bonus,
      ),
    );
    expect(routine.warnings).toEqual([]);
  },
);

// CRB p. 132: one more ranged attack at the highest bonus, −2 on all,
// full attack only.
test('Rapid Shot adds a highest-bonus shot and −2 on every full-attack line', () => {
  const routine = calculateRoutine(
    optionSheet({
      weapon: 'longbow',
      feats: withFeats('rapid-shot'),
      options: ['rapid-shot'],
    }),
  );
  expect(attackTotals(routine.single)).toEqual([13]);
  expect(attackTotals(routine.full)).toEqual([11, 11, 6, 1]);
  expect(routine.full.map((line) => line.extraAttack?.kind)).toEqual([
    undefined,
    'rapidShot',
    undefined,
    undefined,
  ]);
  expect(contribution(routine.full[2]!.attackBonus, 'feat:rapid-shot')).toBe(
    -2,
  );
});

test.each([
  [
    'longsword',
    [15, 10, 5],
    'Rapid Shot needs a ranged or thrown main weapon. It has no effect in this routine.',
  ],
  [
    'light crossbow',
    [13],
    'Rapid Shot needs a weapon that can fire again this round. It has no effect in this routine.',
  ],
  [
    'javelin',
    [13],
    'Rapid Shot needs a weapon that can fire again this round. It has no effect in this routine.',
  ],
] as const)('Rapid Shot has no effect with a %s', (weapon, totals, note) => {
  const routine = calculateRoutine(
    optionSheet({
      weapon,
      feats: withFeats('rapid-shot'),
      options: ['rapid-shot'],
    }),
  );
  expect(attackTotals(routine.full)).toEqual(totals);
  expect(routine.optionNotes).toEqual([note]);
  expect(routine.options[0]).toMatchObject({ applicable: false });
});

// CRB p. 130: a bow's first full-attack shot fires two arrows.
test('Manyshot doubles the arrows of a bow’s first full-attack shot only', () => {
  const routine = calculateRoutine(
    optionSheet({
      weapon: 'longbow',
      feats: withFeats('rapid-shot', 'manyshot'),
      options: ['rapid-shot', 'manyshot'],
    }),
  );
  expect(routine.full.map((line) => line.projectiles)).toEqual([
    2,
    undefined,
    undefined,
    undefined,
  ]);
  expect(routine.single[0]!.projectiles).toBeUndefined();
  expect(routine.optionNotes).toEqual([
    'Manyshot: the first attack fires two arrows. Precision damage and critical damage apply once.',
  ]);
  const crossbow = calculateRoutine(
    optionSheet({
      weapon: 'light crossbow',
      feats: withFeats('manyshot'),
      options: ['manyshot'],
    }),
  );
  expect(crossbow.full.map((line) => line.projectiles)).toEqual([undefined]);
  expect(crossbow.optionNotes).toEqual([
    'Manyshot needs a bow. It has no effect in this routine.',
  ]);
});

// CRB pp. 136, 128, 126; #237 A6: the single attack's weapon dice ×2/×3/×4,
// natural attacks and unarmed strikes included; full attacks unchanged.
test.each([
  ['longsword', ['vital-strike'], '2d8', '1d8', 2],
  ['longsword', ['improved-vital-strike'], '3d8', '1d8', 3],
  [
    'longsword',
    ['vital-strike', 'improved-vital-strike', 'greater-vital-strike'],
    '4d8',
    '1d8',
    4,
  ],
  ['greatsword', ['vital-strike'], '4d6', '2d6', 2],
  ['claw', ['vital-strike'], '2d4', '1d4', 2],
  ['unarmed', ['improved-vital-strike'], '3d3', '1d3', 3],
] as const)(
  'Vital Strike with a %s and %j rolls %s',
  (weapon, feats, dice, weaponDice, multiplier) => {
    const ordinary = calculateRoutine(optionSheet({ weapon }));
    const routine = calculateRoutine(
      optionSheet({
        weapon,
        feats: withFeats(...feats),
        options: [...feats],
      }),
    );
    expect(routine.single[0]).toMatchObject({
      damageDice: dice,
      vitalStrike: { multiplier, weaponDice },
      damageBonus: { total: ordinary.single[0]!.damageBonus.total },
    });
    expect(routine.full.map((line) => line.damageDice)).toEqual(
      ordinary.full.map((line) => line.damageDice),
    );
    expect(routine.full.every((line) => !line.vitalStrike)).toBe(true);
  },
);

// CRB p. 130: +5 ft. reach on melee attacks; −2 AC until the next turn.
test('Lunge notes its reach on the routine and keeps its AC penalty in a Situation', () => {
  const input = optionSheet({ feats: withFeats('lunge'), options: ['lunge'] });
  const ordinary = calculateCharacterSheet(input);
  expect(ordinary.attackRoutines[0]!.optionNotes).toEqual([
    'Lunge: +5 ft. reach for melee attacks until the end of your turn.',
  ]);
  expect(ordinary.derivedStatistics.ac.total).toBe(12);
  const preview = calculateCharacterSheet(input, {
    situations: [{ option: 'feat-def:lunge' }],
  });
  expect(preview.derivedStatistics.ac.total).toBe(10);
  const ranged = calculateRoutine(
    optionSheet({
      weapon: 'longbow',
      feats: withFeats('lunge'),
      options: ['lunge'],
    }),
  );
  expect(ranged.optionNotes).toEqual([
    'Lunge applies to melee attacks only. It has no effect in this routine.',
  ]);
});

// CRB p. 130: two more unarmed strikes at the highest bonus in a full
// attack that makes one; offered only with an unarmed strike.
test("Medusa's Wrath adds two highest-bonus unarmed strikes to an unarmed full attack", () => {
  const routine = calculateRoutine(
    optionSheet({
      weapon: 'unarmed',
      feats: withFeats('medusas-wrath'),
      options: ['medusas-wrath'],
    }),
  );
  expect(attackTotals(routine.single)).toEqual([15]);
  expect(attackTotals(routine.full)).toEqual([15, 15, 15, 10, 5]);
  expect(routine.full.map((line) => line.extraAttack?.kind)).toEqual([
    undefined,
    'medusasWrath',
    'medusasWrath',
    undefined,
    undefined,
  ]);
  const offHand = calculateRoutine(
    optionSheet({
      routine: {
        offHand: { kind: 'weapon', weaponEntryId: 'unarmed', mode: 'melee' },
      },
      feats: withFeats('medusas-wrath'),
      options: ['medusas-wrath'],
    }),
  );
  // The extras are unarmed strikes at the main hand's highest bonus: the
  // primary two-weapon penalty and full Strength, not the off hand's.
  expect(
    offHand.full.map((line) => [
      line.hand,
      line.weaponName,
      line.extraAttack?.kind,
      line.attackBonus.total,
      line.damageBonus.total,
    ]),
  ).toEqual([
    ['main', 'Longsword', undefined, 11, 4],
    ['main', 'Unarmed strike', 'medusasWrath', 11, 4],
    ['main', 'Unarmed strike', 'medusasWrath', 11, 4],
    ['main', 'Longsword', undefined, 6, 4],
    ['main', 'Longsword', undefined, 1, 4],
    ['off', 'Unarmed strike', undefined, 7, 2],
  ]);
});

test("Medusa's Wrath is offered only with an unarmed strike and otherwise has no effect", () => {
  const offered = calculateRoutine(
    optionSheet({
      weapon: 'unarmed',
      feats: withFeats('medusas-wrath'),
    }),
  );
  expect(offered.options).toEqual([
    {
      catalogEntryId: 'feat-def:medusas-wrath',
      name: "Medusa's Wrath",
      ruleIdentity: 'medusas-wrath',
      switchedOn: false,
      available: true,
      applicable: true,
    },
  ]);
  expect(
    calculateRoutine(optionSheet({ feats: withFeats('medusas-wrath') }))
      .options,
  ).toEqual([]);
  const retained = calculateRoutine(
    optionSheet({
      feats: withFeats('medusas-wrath'),
      options: ['medusas-wrath'],
    }),
  );
  expect(attackTotals(retained.full)).toEqual([15, 10, 5]);
  expect(retained.options[0]).toMatchObject({
    switchedOn: true,
    applicable: false,
  });
  expect(retained.optionNotes).toEqual([
    "Medusa's Wrath needs an unarmed strike in this routine. It has no effect here.",
  ]);
});

const hasteEntries = (...sources: { id: string; sourceKey?: string }[]) => ({
  entries: sources.map(
    ({ id }): SheetEntry => ({
      _id: `effect:${id}`,
      kind: 'spellEffect',
      active: true,
      catalogEntryId: id,
      state: { kind: 'spellEffect', casterLevel: 5 },
    }),
  ),
  catalogEntries: sources.map(
    ({ id, sourceKey }): CharacterSheetCatalogEntry => ({
      _id: id,
      name: id,
      ruleIdentity: id,
      ...(sourceKey ? { sourceKey } : {}),
      modifiers: [],
      detail: { kind: 'spellEffect' },
    }),
  ),
});

// CRB p. 293; FAQ "Speed Weapons" (June 2013): one extra attack at the full
// base attack bonus, not cumulative with similar effects.
test('haste-like Sources add one extra attack at the highest bonus however many apply', () => {
  const one = calculateRoutine(optionSheet(hasteEntries({ id: 'haste' })));
  expect(attackTotals(one.full)).toEqual([15, 15, 10, 5]);
  expect(one.full[1]!.extraAttack).toEqual({
    kind: 'haste',
    sheetEntryId: 'effect:haste',
    name: 'haste',
  });
  expect(attackTotals(one.single)).toEqual([15]);
  const two = calculateRoutine(
    optionSheet(
      hasteEntries(
        { id: 'haste' },
        { id: 'boots-of-speed', sourceKey: 'haste' },
      ),
    ),
  );
  expect(attackTotals(two.full)).toEqual([15, 15, 10, 5]);
  const natural = calculateRoutine(
    optionSheet({ weapon: 'claw', ...hasteEntries({ id: 'haste' }) }),
  );
  expect(natural.full).toHaveLength(2);
  const crossbow = calculateRoutine(
    optionSheet({ weapon: 'light crossbow', ...hasteEntries({ id: 'haste' }) }),
  );
  expect(crossbow.full).toHaveLength(1);
  const withRapidShot = calculateRoutine(
    optionSheet({
      weapon: 'longbow',
      feats: withFeats('rapid-shot'),
      options: ['rapid-shot'],
      ...hasteEntries({ id: 'haste' }),
    }),
  );
  expect(attackTotals(withRapidShot.full)).toEqual([11, 11, 11, 6, 1]);
  expect(withRapidShot.full.map((line) => line.extraAttack?.kind)).toEqual([
    undefined,
    'haste',
    'rapidShot',
    undefined,
    undefined,
  ]);
});

test('a temporary haste stays out of the permanent projection’s full attack', () => {
  const { current, permanent } = calculateCharacterSheetProjections(
    optionSheet(hasteEntries({ id: 'haste' })),
  );
  expect(current.attackRoutines[0]!.full).toHaveLength(4);
  expect(permanent.attackRoutines[0]!.full).toHaveLength(3);
});

const shield = (armorCheckPenalty: number) => ({
  entries: [
    {
      _id: 'shield-row',
      kind: 'item' as const,
      active: true,
      catalogEntryId: 'shield',
      state: { kind: 'item' as const },
    },
  ],
  catalogEntries: [
    {
      _id: 'shield',
      name: 'Heavy steel shield',
      ruleIdentity: 'heavy-steel-shield',
      modifiers: [],
      detail: {
        kind: 'item' as const,
        armor: {
          slot: 'shield' as const,
          category: 'heavyShield' as const,
          armorCheckPenalty,
          bonus: 2,
        },
      },
    },
  ],
});

// CRB p. 136: Dexterity on attacks with light and natural weapons, unarmed
// strikes and weapons with the finesse property (the rapier, whip, spiked
// chain and elven curve blade), whichever ability is better; a carried
// shield's armor check penalty then applies.
test.each([
  ['rapier', 15, 'Dexterity (Weapon Finesse)'],
  ['elven curve blade', 15, 'Dexterity (Weapon Finesse)'],
  ['dagger', 15, 'Dexterity (Weapon Finesse)'],
  ['claw', 15, 'Dexterity (Weapon Finesse)'],
  ['unarmed', 15, 'Dexterity (Weapon Finesse)'],
  ['longsword', 12, 'Strength'],
  ['javelin', 15, 'Dexterity'],
] as const)(
  'Weapon Finesse with a %s attacks at +%i using %s',
  (weapon, total, ability) => {
    const routine = calculateRoutine(
      optionSheet({
        weapon,
        scores: { strength: 12, dexterity: 18 },
        feats: withFeats('weapon-finesse'),
      }),
    );
    expect(routine.single[0]!.attackBonus.total).toBe(total);
    expect(routine.single[0]!.attackBonus.applied).toContainEqual(
      expect.objectContaining({ entryName: ability }),
    );
    // Damage keeps Strength.
    expect(routine.single[0]!.damageBonus.total).toBe(1);
  },
);

test('Weapon Finesse keeps Strength when it is better, counting a shield’s armor check penalty', () => {
  const strong = calculateRoutine(
    optionSheet({ weapon: 'rapier', feats: withFeats('weapon-finesse') }),
  );
  expect(strong.single[0]!.attackBonus.total).toBe(15);
  const withoutFeat = calculateRoutine(
    optionSheet({ weapon: 'rapier', scores: { strength: 12, dexterity: 18 } }),
  );
  expect(withoutFeat.single[0]!.attackBonus.total).toBe(12);
  const shielded = calculateRoutine(
    optionSheet({
      weapon: 'rapier',
      scores: { strength: 12, dexterity: 18 },
      feats: withFeats('weapon-finesse'),
      ...shield(2),
    }),
  );
  expect(shielded.single[0]!.attackBonus.total).toBe(13);
  expect(shielded.single[0]!.attackBonus.applied).toContainEqual(
    expect.objectContaining({
      sheetEntryId: 'shield-row',
      value: -2,
      entryName: 'Heavy steel shield armor check penalty (Weapon Finesse)',
    }),
  );
  const heavyPenalty = calculateRoutine(
    optionSheet({
      weapon: 'rapier',
      scores: { strength: 12, dexterity: 18 },
      feats: withFeats('weapon-finesse'),
      ...shield(4),
    }),
  );
  expect(heavyPenalty.single[0]!.attackBonus.total).toBe(12);
});

// The finesse property, not the weapon's name, makes a weapon eligible.
test('Weapon Finesse reads the finesse property rather than the weapon name', () => {
  const input = optionSheet({
    weapon: 'rapier',
    scores: { strength: 12, dexterity: 18 },
    feats: withFeats('weapon-finesse'),
  });
  const rapier = input.catalogEntries.find(
    (entry) => entry._id === 'weapon:rapier',
  );
  if (rapier?.detail?.kind !== 'item' || !rapier.detail.weapon)
    throw new Error('Missing rapier');
  rapier.detail.weapon = { ...rapier.detail.weapon, finesse: false };
  const routine = calculateRoutine(input);
  expect(routine.single[0]!.attackBonus.total).toBe(12);
  expect(routine.single[0]!.attackBonus.applied).toContainEqual(
    expect.objectContaining({ entryName: 'Strength' }),
  );
});

// CRB p. 136, #237: a nonproficient shield's armor check penalty already
// applies to every attack roll, so Weapon Finesse applies it only once and
// still prefers Dexterity, because the penalty applies to Strength as well.
test('Weapon Finesse applies a nonproficient shield’s armor check penalty once', () => {
  const sheet = (weapon: WeaponName, armorCheckPenalty: number) =>
    calculateRoutine(
      optionSheet({
        weapon,
        scores: { strength: 12, dexterity: 18 },
        feats: withFeats('weapon-finesse'),
        shieldProficiency: false,
        ...shield(armorCheckPenalty),
      }),
    );
  const shieldRows = (line: AttackLine) =>
    line.attackBonus.applied.filter((row) => row.sheetEntryId === 'shield-row');
  const finessed = sheet('rapier', 2).single[0]!;
  expect(finessed.attackBonus.total).toBe(13);
  expect(shieldRows(finessed)).toEqual([
    expect.objectContaining({ value: -2 }),
  ]);
  expect(finessed.attackBonus.applied).toContainEqual(
    expect.objectContaining({ entryName: 'Dexterity (Weapon Finesse)' }),
  );
  const heavy = sheet('rapier', 4).single[0]!;
  expect(heavy.attackBonus.total).toBe(11);
  expect(shieldRows(heavy)).toEqual([expect.objectContaining({ value: -4 })]);
  const longsword = sheet('longsword', 2).single[0]!;
  expect(longsword.attackBonus.total).toBe(10);
  expect(shieldRows(longsword)).toEqual([
    expect.objectContaining({ value: -2 }),
  ]);
});

// CRB p. 127 (Improved Critical), p. 469 (keen); #237 A15: expanders double
// the chosen weapon's threat range once.
test.each([
  ['longsword', 19, 17],
  ['rapier', 18, 15],
  ['longbow', 20, 19],
] as const)(
  'Improved Critical doubles a %s threat range from %i to %i',
  (weapon, threat, doubled) => {
    const ordinary = calculateRoutine(optionSheet({ weapon }));
    expect(ordinary.single[0]!.criticalThreat.total).toBe(threat);
    const routine = calculateRoutine(
      optionSheet({
        weapon,
        feats: [{ identity: 'improved-critical', choice: ` ${weapon} ` }],
      }),
    );
    for (const line of [...routine.single, ...routine.full])
      expect(line.criticalThreat.total).toBe(doubled);
  },
);

test('threat-range doubling applies once and only to the chosen weapon', () => {
  const twice = calculateRoutine(
    optionSheet({
      feats: [
        { identity: 'improved-critical', choice: 'longsword' },
        {
          identity: 'improved-critical',
          id: 'second',
          choice: 'Longsword',
          copy: true,
        },
      ],
    }),
  );
  expect(twice.single[0]!.criticalThreat).toMatchObject({
    total: 17,
    suppressed: [
      expect.objectContaining({
        sheetEntryId: 'feat:second',
        reason: 'Threat-range expanders double the threat range only once.',
      }),
    ],
  });
  const otherWeapon = calculateRoutine(
    optionSheet({
      feats: [{ identity: 'improved-critical', choice: 'rapier' }],
    }),
  );
  expect(otherWeapon.single[0]!.criticalThreat.total).toBe(19);
});

// CRB p. 136: one Rend after a two-weapon full attack, 1d10 + 1½ Strength.
test('Two-Weapon Rend adds one Rend after a two-weapon full attack only', () => {
  const routine = calculateRoutine(
    optionSheet({
      items: ['dagger'],
      routine: {
        offHand: {
          kind: 'weapon',
          weaponEntryId: 'item:dagger',
          mode: 'melee',
        },
      },
      feats: withFeats('two-weapon-rend'),
    }),
  );
  expect(routine.twoWeaponRend).toMatchObject({
    sheetEntryId: 'feat:two-weapon-rend',
    damageDice: '1d10',
    damageBonus: { total: 6 },
  });
  expect(routine.full.every((line) => line.damageDice !== '1d10')).toBe(true);
  expect(
    calculateRoutine(optionSheet({ feats: withFeats('two-weapon-rend') }))
      .twoWeaponRend,
  ).toBeNull();
  const weak = calculateRoutine(
    optionSheet({
      scores: { strength: 8 },
      items: ['dagger'],
      routine: {
        offHand: {
          kind: 'weapon',
          weaponEntryId: 'item:dagger',
          mode: 'melee',
        },
      },
      feats: withFeats('two-weapon-rend'),
    }),
  );
  expect(weak.twoWeaponRend?.damageBonus.total).toBe(-1);
  const naturalMain = calculateRoutine(
    optionSheet({
      weapon: 'claw',
      items: ['dagger'],
      routine: {
        offHand: {
          kind: 'weapon',
          weaponEntryId: 'item:dagger',
          mode: 'melee',
        },
      },
      feats: withFeats('two-weapon-rend'),
    }),
  );
  expect(naturalMain.twoWeaponRend).toBeNull();
});

// #229: options are per routine; a switched-on option without its active
// feat stays recorded with an advisory warning and has no effect.
test('options change only the routine that switches them on', () => {
  const input = optionSheet({
    feats: withFeats('power-attack'),
    options: ['power-attack'],
    entries: [
      {
        _id: 'second-routine',
        kind: 'attackRoutine',
        active: true,
        state: {
          kind: 'attackRoutine',
          name: 'Second',
          weaponEntryId: 'item:longsword',
          hands: 'one',
          mode: 'melee',
        },
      },
    ],
  });
  const [first, second] = calculateCharacterSheet(input).attackRoutines;
  expect(attackTotals(first!.full)).toEqual([12, 7, 2]);
  expect(attackTotals(second!.full)).toEqual([15, 10, 5]);
  expect(second!.options).toEqual([
    expect.objectContaining({
      catalogEntryId: 'feat-def:power-attack',
      switchedOn: false,
      available: true,
    }),
  ]);
});

test.each([
  [
    'missing',
    [],
    "Power Attack is switched on in Routine, but the feat isn't on the sheet. It has no effect until the feat is added.",
    'missing',
  ],
  [
    'switched off',
    [{ identity: 'power-attack', active: false }],
    'Power Attack is switched on in Routine, but the feat is switched off. It has no effect until the feat is switched on.',
    'inactive',
  ],
] as const)(
  'a %s Routine Option feat warns without blocking the routine',
  (_, feats, message, problem) => {
    const routine = calculateRoutine(
      optionSheet({ feats: [...feats], options: ['power-attack'] }),
    );
    expect(attackTotals(routine.full)).toEqual([15, 10, 5]);
    expect(routine.warnings).toEqual([
      expect.objectContaining({
        check: 'missingRoutineOption',
        kind: 'rules',
        subject: 'routine:option:feat-def:power-attack',
        target: { kind: 'entry', entryId: 'routine' },
        message,
      }),
    ]);
    expect(routine.options).toEqual([
      expect.objectContaining({
        switchedOn: true,
        available: false,
        applicable: false,
      }),
    ]);
    expect(readRoutineOptionProblem(routine.warnings[0]!)).toBe(problem);
  },
);

test('a recorded option that is not a Routine Option, or is gone, warns', () => {
  const routine = calculateRoutine(
    optionSheet({
      feats: withFeats('weapon-finesse'),
      routine: { options: ['feat-def:weapon-finesse', 'gone'] },
    }),
  );
  expect(routine.warnings.map((warning) => warning.message)).toEqual([
    'Weapon Finesse is not a Routine Option. Switch it off in Routine.',
    'A switched-on option of Routine is no longer available. Switch it off in this routine.',
  ]);
  expect(
    routine.warnings.map((warning) => [
      warning.subject,
      readRoutineOptionProblem(warning),
    ]),
  ).toEqual([
    [
      routineOptionWarningSubject('routine', 'feat-def:weapon-finesse'),
      'not-option',
    ],
    [routineOptionWarningSubject('routine', 'gone'), 'missing'],
  ]);
  expect(attackTotals(routine.full)).toEqual([15, 10, 5]);
});

// A renamed Catalog Copy keeps its rule identity and its option behavior.
test('a renamed feat copy supplies a recorded option by rule identity', () => {
  const routine = calculateRoutine(
    optionSheet({
      feats: [{ identity: 'deadly-aim', copy: true }],
      weapon: 'longbow',
      options: ['deadly-aim'],
    }),
  );
  expect(routine.single[0]!.damageBonus.total).toBe(6);
  expect(routine.warnings).toEqual([]);
  expect(routine.options).toEqual([
    expect.objectContaining({
      catalogEntryId: 'feat-def:deadly-aim',
      name: 'Renamed deadly-aim',
      switchedOn: true,
    }),
  ]);
});
