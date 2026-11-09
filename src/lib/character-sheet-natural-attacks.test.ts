import { expect, test } from 'vitest';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  type CharacterSheetInput,
  type SheetEntry,
} from './character-sheet';
import type { NaturalAttackType } from './character-sheet-attack-types';
import { attackRoutineWeaponUses } from './character-sheet-attacks';

function attackRoutine(...args: Parameters<typeof calculateCharacterSheet>) {
  const [routine] = calculateCharacterSheet(...args).attackRoutines;
  if (!routine) throw new Error('Expected an Attack Routine');
  return routine;
}

function first<Value>(values: readonly Value[]): Value {
  const value = values[0];
  if (value === undefined) throw new Error('Expected an attack line');
  return value;
}

function naturalSheet(): CharacterSheetInput {
  return {
    characterKind: 'pc',
    entries: [
      {
        _id: 'base',
        kind: 'base',
        active: true,
        catalogEntryId: 'base',
        state: { kind: 'base' },
      },
      {
        _id: 'bab',
        kind: 'manual',
        active: true,
        catalogEntryId: 'bab',
        state: { kind: 'manual' },
      },
      {
        _id: 'bite',
        kind: 'item',
        active: true,
        catalogEntryId: 'bite',
        state: { kind: 'item' },
      },
      {
        _id: 'routine',
        kind: 'attackRoutine',
        active: true,
        state: {
          kind: 'attackRoutine',
          name: 'Bite',
          weaponEntryId: 'bite',
          hands: 'one',
          mode: 'melee',
        },
      },
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: abilityKeys.map((ability) => ({
          target: abilityTargets[ability],
          bonusType: 'base',
          value:
            ability === 'strength' ? 18 : ability === 'dexterity' ? 22 : 10,
        })),
      },
      {
        _id: 'bab',
        ruleIdentity: 'bab',
        modifiers: [{ target: 'bab', bonusType: 'untyped', value: 11 }],
      },
      {
        _id: 'bite',
        name: 'Bite',
        ruleIdentity: 'natural-bite',
        modifiers: [],
        detail: {
          kind: 'item',
          weapon: {
            baseType: 'bite',
            proficiency: 'simple',
            handedness: 'light',
            attackType: 'melee',
            dice: '1d6',
            threat: 20,
            mult: 2,
            naturalAttack: { type: 'bite' },
          },
        },
      },
    ],
  };
}

// CRB p. 182; B1 p. 301 Natural Attacks: one possessed natural attack
// attacks at full BAB, adds 1½ positive Strength, and gains no BAB iteratives.
// https://aonprd.com/Rules.aspx?ID=131 / https://aonprd.com/UMR.aspx?ItemName=Natural%20Attacks
test('a sole natural attack is proficient and has one full attack with 1½ Strength', () => {
  const result = attackRoutine(naturalSheet());
  expect(result.single.map((line) => line.attackBonus.total)).toEqual([15]);
  expect(result.full.map((line) => line.attackBonus.total)).toEqual([15]);
  expect(result.full[0]).toMatchObject({
    attackKind: 'natural',
    naturalRole: 'primary',
    damageDice: '1d6',
    damageBonus: { total: 6 },
  });
  expect(first(result.full).damageBonus.applied).toContainEqual(
    expect.objectContaining({ sheetEntryId: 'builtin:ability.str', value: 6 }),
  );
});

function withNatural(
  input: CharacterSheetInput,
  id: string,
  type: NaturalAttackType = 'claw',
): CharacterSheetInput {
  return {
    ...input,
    entries: [
      ...input.entries,
      {
        _id: id,
        kind: 'item',
        active: true,
        catalogEntryId: id,
        state: { kind: 'item' },
      },
    ],
    catalogEntries: [
      ...input.catalogEntries,
      {
        _id: id,
        name: type,
        ruleIdentity: `natural-${type}`,
        modifiers: [],
        detail: {
          kind: 'item',
          weapon: {
            baseType: type,
            proficiency: 'always',
            handedness: 'light',
            attackType: 'melee',
            dice: '1d4',
            threat: 20,
            mult: 2,
            naturalAttack: { type },
          },
        },
      },
    ],
  };
}

function routineState(
  input: CharacterSheetInput,
  patch: Partial<Extract<SheetEntry, { kind: 'attackRoutine' }>['state']>,
): CharacterSheetInput {
  return {
    ...input,
    entries: input.entries.map((entry) =>
      entry.kind === 'attackRoutine'
        ? { ...entry, state: { ...entry.state, ...patch } }
        : entry,
    ),
  };
}

// CRB p. 182 / B1 p. 301; a standard attack uses the main weapon.
test('possessing several natural attacks removes the sole bonus even when only one is selected', () => {
  const input = withNatural(naturalSheet(), 'claw');
  const selected = attackRoutine(input);
  expect(first(selected.single).damageBonus.total).toBe(4);
  const all = attackRoutine(
    routineState(input, { naturalAttackEntryIds: ['claw'] }),
  );
  expect(all.single.map((line) => line.weaponEntryId)).toEqual(['bite']);
  expect(
    all.full.map((line) => [
      line.weaponEntryId,
      line.attackBonus.total,
      line.damageBonus.total,
    ]),
  ).toEqual([
    ['bite', 15, 4],
    ['claw', 15, 4],
  ]);
});

function withSword(input: CharacterSheetInput): CharacterSheetInput {
  return {
    ...input,
    entries: [
      ...input.entries,
      {
        _id: 'sword',
        kind: 'item',
        active: true,
        catalogEntryId: 'sword',
        state: { kind: 'item' },
      },
    ],
    catalogEntries: [
      ...input.catalogEntries,
      {
        _id: 'sword',
        name: 'Greatsword',
        ruleIdentity: 'greatsword',
        modifiers: [],
        proficiencies: [{ category: 'martial' }],
        detail: {
          kind: 'item',
          weapon: {
            baseType: 'greatsword',
            proficiency: 'martial',
            handedness: 'twoHanded',
            attackType: 'melee',
            dice: '2d6',
            threat: 19,
            mult: 2,
            strengthDamage: 'melee',
          },
        },
      },
    ],
  };
}

// CRB p. 182; settled #237 A5: a weapon changes natural attacks only.
test.each([false, true])(
  'mixed natural attacks become secondary with Multiattack=%s, without two-weapon penalties',
  (multiattack) => {
    let input = routineState(withSword(withNatural(naturalSheet(), 'claw')), {
      weaponEntryId: 'sword',
      hands: 'two',
      naturalAttackEntryIds: ['bite', 'claw'],
    });
    if (multiattack)
      input = {
        ...input,
        entries: [
          ...input.entries,
          {
            _id: 'multiattack-row',
            kind: 'feat',
            active: true,
            catalogEntryId: 'multiattack-copy',
            state: { kind: 'feat' },
          },
        ],
        catalogEntries: [
          ...input.catalogEntries,
          {
            _id: 'multiattack-copy',
            name: 'Renamed copy',
            ruleIdentity: 'multiattack',
            modifiers: [],
            detail: { kind: 'feat' },
          },
        ],
      };
    const result = attackRoutine(input);
    expect(result.single.map((line) => line.attackBonus.total)).toEqual([15]);
    expect(result.full.map((line) => line.attackBonus.total)).toEqual(
      multiattack ? [15, 10, 5, 13, 13] : [15, 10, 5, 10, 10],
    );
    expect(result.full.map((line) => line.damageBonus.total)).toEqual([
      6, 6, 6, 2, 2,
    ]);
    expect(
      result.full.slice(-2).every((line) => line.naturalRole === 'secondary'),
    ).toBe(true);
    expect(result.twoWeaponPenaltySummary).toBeNull();
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        check: 'attackLimbs',
        target: { kind: 'entry', entryId: 'routine' },
      }),
    );
    expect(result.full.at(-1)?.attackBonus.applied).toContainEqual(
      expect.objectContaining({
        sheetEntryId: multiattack ? 'multiattack-row' : 'claw',
        value: multiattack ? -2 : -5,
      }),
    );
  },
);

// B1 p. 301 printed Medium rows and default roles; the possessed bite keeps
// these other forms from invoking the sole-type exception.
test.each([
  ['claw', '1d4', 'primary'],
  ['gore', '1d6', 'primary'],
  ['hoof', '1d4', 'secondary'],
  ['pincer', '1d6', 'secondary'],
  ['slam', '1d4', 'primary'],
  ['sting', '1d4', 'primary'],
  ['tailSlap', '1d6', 'secondary'],
  ['talons', '1d4', 'primary'],
  ['tentacle', '1d4', 'secondary'],
  ['wing', '1d4', 'secondary'],
  ['other', '1d4', 'secondary'],
] as const)(
  'generic %s receives printed %s damage and %s role',
  (type, dice, role) => {
    const input = withNatural(naturalSheet(), 'natural', type);
    const generic = {
      ...input,
      catalogEntries: input.catalogEntries.map((entry) =>
        entry._id === 'natural'
          ? {
              ...entry,
              detail: {
                kind: 'item' as const,
                weapon: {
                  baseType: type,
                  proficiency: 'always' as const,
                  naturalAttack: { type },
                },
              },
            }
          : entry,
      ),
    };
    expect(
      first(
        attackRoutine(routineState(generic, { weaponEntryId: 'natural' }))
          .single,
      ),
    ).toMatchObject({
      damageDice: dice,
      naturalRole: role,
      attackBonus: { total: role === 'primary' ? 15 : 10 },
      damageBonus: { total: role === 'primary' ? 4 : 2 },
    });
  },
);

test('a natural Strength penalty applies in full to sole and secondary attacks', () => {
  const original = naturalSheet();
  const input = {
    ...original,
    catalogEntries: original.catalogEntries.map((entry) =>
      entry._id === 'base'
        ? {
            ...entry,
            modifiers: entry.modifiers.map((modifier) =>
              modifier.target === 'ability.str'
                ? { ...modifier, value: 4 }
                : modifier,
            ),
          }
        : entry,
    ),
  };
  expect(first(attackRoutine(input).single).damageBonus.total).toBe(-3);
  const mixed = routineState(withSword(input), {
    weaponEntryId: 'sword',
    naturalAttackEntryIds: ['bite'],
  });
  expect(attackRoutine(mixed).full.at(-1)?.damageBonus.total).toBe(-3);
});

test('a generic sole tail created without a role override is promoted to primary', () => {
  const input = naturalSheet();
  const tail = {
    ...input,
    catalogEntries: input.catalogEntries.map((entry) =>
      entry._id === 'bite'
        ? {
            ...entry,
            detail: {
              kind: 'item' as const,
              weapon: {
                baseType: 'tail slap',
                proficiency: 'always' as const,
                naturalAttack: {
                  type: 'tailSlap' as const,
                },
              },
            },
          }
        : entry,
    ),
  };
  expect(first(attackRoutine(tail).single)).toMatchObject({
    naturalRole: 'primary',
    attackBonus: { total: 15 },
    damageBonus: { total: 6 },
  });
});

// CRB p. 56 printed Small monk table: Medium 2d6 → Small 1d10.
test('the monk hook preserves printed Small damage and warns instead of guessing an unsupported size conversion', () => {
  const input = routineState(naturalSheet(), { weaponEntryId: 'unarmed' });
  expect(
    first(
      attackRoutine(input, {
        size: 'small',
        monkUnarmedStrike: { dice: '2d6', sheetEntryId: 'monk' },
      }).single,
    ).damageDice,
  ).toBe('1d10');
  const unresolved = attackRoutine(input, {
    size: 'large',
    monkUnarmedStrike: { dice: '1d7', sheetEntryId: 'monk' },
  });
  expect(unresolved.single).toEqual([]);
  expect(unresolved.warnings).toContainEqual(
    expect.objectContaining({ check: 'attackWeaponUnresolved' }),
  );
});

// CRB pp. 142,182: unarmed is always available, 1d3 Medium nonlethal,
// light for Two-Weapon Fighting; Improved Unarmed Strike changes damage kind.
test('built-in unarmed strike needs no Gear, is proficient, and mixes with secondary naturals', () => {
  const input = routineState(naturalSheet(), {
    weaponEntryId: 'unarmed',
    naturalAttackEntryIds: ['bite'],
  });
  const result = attackRoutine(input);
  expect(first(result.single)).toMatchObject({
    weaponEntryId: 'unarmed',
    attackKind: 'unarmed',
    damageDice: '1d3',
    damageKind: 'nonlethal',
    attackBonus: { total: 15 },
    damageBonus: { total: 4 },
  });
  expect(
    result.full.map((line) => [line.attackBonus.total, line.damageBonus.total]),
  ).toEqual([
    [15, 4],
    [10, 4],
    [5, 4],
    [10, 2],
  ]);
});

// Bestiary p. 301 printed bite row, retained corpus bca5f2a.
test.each([
  ['fine', '1'],
  ['diminutive', '1d2'],
  ['tiny', '1d3'],
  ['small', '1d4'],
  ['medium', '1d6'],
  ['large', '1d8'],
  ['huge', '2d6'],
  ['gargantuan', '2d8'],
  ['colossal', '4d6'],
] as const)('generic bite uses printed %s damage %s', (size, dice) => {
  expect(attackRoutine(naturalSheet(), { size }).single[0]?.damageDice).toBe(
    dice,
  );
});

// CRB p. 182 and #237 A14, March 2015 CRB FAQ dice chart.
test.each([
  ['small', '1d2'],
  ['large', '1d4'],
  ['tiny', '1'],
  ['huge', '1d6'],
] as const)('built-in unarmed uses %s damage %s', (size, dice) => {
  expect(
    attackRoutine(routineState(naturalSheet(), { weaponEntryId: 'unarmed' }), {
      size,
    }).single[0]?.damageDice,
  ).toBe(dice);
});

test('familiar opt-in chooses the greater attack ability but leaves natural Strength damage unchanged', () => {
  const result = first(
    attackRoutine(naturalSheet(), {
      naturalAttackAbility: 'greaterStrengthDexterity',
    }).single,
  );
  expect(result.attackBonus.total).toBe(17);
  expect(result.attackBonus.applied).toContainEqual(
    expect.objectContaining({ sheetEntryId: 'builtin:ability.dex', value: 6 }),
  );
  expect(result.damageBonus.total).toBe(6);
});

// CRB p. 56 monk table; Large 7th-level monk 2d6, Huge steps to 3d6.
test('a source-backed monk hook replaces unarmed dice and uses full Strength on either hand', () => {
  const input = routineState(withSword(naturalSheet()), {
    weaponEntryId: 'sword',
    offHand: { kind: 'weapon', weaponEntryId: 'unarmed', mode: 'melee' },
  });
  const result = attackRoutine(input, {
    size: 'huge',
    monkUnarmedStrike: { dice: '1d8', sheetEntryId: 'monk-unarmed-feature' },
  });
  expect(result.full.at(-1)).toMatchObject({
    damageDice: '3d6',
    damageBonus: { total: 4 },
    damageKind: 'lethalOrNonlethal',
    damageDiceSource: { sheetEntryId: 'monk-unarmed-feature' },
  });
});

test('a Fine claw has no guessed damage while a generic profile without item statistics resolves normally', () => {
  const input = routineState(withNatural(naturalSheet(), 'claw'), {
    weaponEntryId: 'claw',
  });
  const fine = attackRoutine(input, { size: 'fine' });
  expect(fine.single).toEqual([]);
  expect(fine.warnings).toContainEqual(
    expect.objectContaining({ check: 'attackWeaponUnresolved' }),
  );
  const generic = {
    ...naturalSheet(),
    catalogEntries: naturalSheet().catalogEntries.map((entry) =>
      entry._id === 'bite'
        ? {
            ...entry,
            detail: {
              kind: 'item' as const,
              weapon: {
                baseType: 'bite',
                proficiency: 'always' as const,
                naturalAttack: { type: 'bite' as const },
              },
            },
          }
        : entry,
    ),
  };
  expect(attackRoutine(generic, { size: 'large' }).single[0]).toMatchObject({
    damageDice: '1d8',
    criticalMultiplier: { total: 2 },
  });
});

test('a natural main attack and one weapon in the off-hand field form a mix without two-weapon penalties', () => {
  const input = routineState(withSword(naturalSheet()), {
    offHand: { kind: 'weapon', weaponEntryId: 'sword', mode: 'melee' },
  });
  const result = attackRoutine(input);
  expect(first(result.single)).toMatchObject({
    naturalRole: 'primary',
    attackBonus: { total: 15 },
    damageBonus: { total: 6 },
  });
  expect(
    result.full.map((line) => [line.attackBonus.total, line.damageBonus.total]),
  ).toEqual([
    [10, 2],
    [15, 4],
    [10, 4],
    [5, 4],
  ]);
  expect(result.twoWeaponPenaltySummary).toBeNull();
});

test('the lone manufactured weapon in a natural-main routine is a main weapon for attacks and proficiency', () => {
  const input = routineState(withSword(naturalSheet()), {
    offHand: { kind: 'weapon', weaponEntryId: 'sword', mode: 'melee' },
  });
  const result = calculateCharacterSheet(input);
  expect(first(result.attackRoutines).full.slice(1)).toMatchObject([
    { hand: 'main', attackBonus: { total: 15 }, damageBonus: { total: 4 } },
    { hand: 'main', attackBonus: { total: 10 }, damageBonus: { total: 4 } },
    { hand: 'main', attackBonus: { total: 5 }, damageBonus: { total: 4 } },
  ]);
  expect(attackRoutineWeaponUses(input)).toContainEqual(
    expect.objectContaining({ entryId: 'sword', hand: 'main' }),
  );
});

test('missing natural warnings remain owned by the routine when its main weapon is switched off', () => {
  let input = routineState(naturalSheet(), {
    naturalAttackEntryIds: ['missing-claw'],
  });
  const before = attackRoutine(input).warnings.find(
    (warning) => warning.subject === 'routine:natural:missing-claw',
  );
  expect(before).toMatchObject({
    check: 'missingAttackWeapon',
    target: { kind: 'entry', entryId: 'routine' },
  });
  input = {
    ...input,
    entries: input.entries.map((entry) =>
      entry.kind === 'item' && entry._id === 'bite'
        ? { ...entry, active: false }
        : entry,
    ),
  };
  expect(attackRoutine(input).warnings).toContainEqual(before);
});

test('a two-handed weapon beside a natural main occupies both available limbs', () => {
  const input = routineState(withSword(withNatural(naturalSheet(), 'claw')), {
    offHand: { kind: 'weapon', weaponEntryId: 'sword', mode: 'melee' },
    naturalAttackEntryIds: ['claw'],
    availableLimbs: 2,
  });
  const result = attackRoutine(input);
  expect(result.warnings).toContainEqual(
    expect.objectContaining({
      check: 'attackLimbs',
      message:
        '1 claw, slam or tentacle attacks need free limbs, but only 0 are available after holding weapons. The attacks remain in this routine.',
    }),
  );
  expect(result.full.at(-1)?.weaponEntryId).toBe('claw');
});

test('selecting the main natural attack again warns without duplicating its attack', () => {
  const result = attackRoutine(
    routineState(naturalSheet(), { naturalAttackEntryIds: ['bite'] }),
  );
  expect(result.full.map((line) => line.weaponEntryId)).toEqual(['bite']);
  expect(result.warnings).toContainEqual(
    expect.objectContaining({
      check: 'invalidAttackWeapon',
      subject: 'routine:natural:bite',
      target: { kind: 'entry', entryId: 'routine' },
      message:
        'Bite is already the main natural attack. Its additional natural attack line is skipped.',
    }),
  );
});

test('a natural-only situational attack bonus follows the natural line in a manufactured routine', () => {
  const input = routineState(withSword(naturalSheet()), {
    weaponEntryId: 'sword',
    hands: 'two',
    naturalAttackEntryIds: ['bite'],
  });
  const scoped: CharacterSheetInput = {
    ...input,
    catalogEntries: input.catalogEntries.map((entry) =>
      entry._id === 'bab'
        ? {
            ...entry,
            modifiers: [
              ...entry.modifiers,
              {
                target: 'attack',
                bonusType: 'untyped',
                value: 2,
                condition: {
                  weapon: '$unarmedOrNatural',
                  situation: 'flanking',
                },
              },
            ],
          }
        : entry,
    ),
  };
  const result = attackRoutine(scoped, { situations: ['flanking'] });
  expect(result.single.map((line) => line.attackBonus.total)).toEqual([15]);
  expect(result.full.map((line) => line.attackBonus.total)).toEqual([
    15, 10, 5, 12,
  ]);
});

test.each([
  ['bite', [17]],
  ['unarmed', [17, 12, 7]],
] as const)(
  'natural and unarmed main lines receive their scoped bonus (%s)',
  (weaponEntryId, attacks) => {
    const input = routineState(naturalSheet(), { weaponEntryId });
    const scoped: CharacterSheetInput = {
      ...input,
      catalogEntries: input.catalogEntries.map((entry) =>
        entry._id === 'bab'
          ? {
              ...entry,
              modifiers: [
                ...entry.modifiers,
                {
                  target: 'attack',
                  bonusType: 'untyped',
                  value: 2,
                  condition: { weapon: '$unarmedOrNatural' },
                },
              ],
            }
          : entry,
      ),
    };
    const result = attackRoutine(scoped);
    expect(result.single.map((line) => line.attackBonus.total)).toEqual([17]);
    expect(result.full.map((line) => line.attackBonus.total)).toEqual(attacks);
  },
);

test('an additional manufactured weapon receives its own attack and damage modifiers without applying them to the natural main', () => {
  const input = routineState(withSword(naturalSheet()), {
    offHand: { kind: 'weapon', weaponEntryId: 'sword', mode: 'melee' },
  });
  const scoped: CharacterSheetInput = {
    ...input,
    catalogEntries: input.catalogEntries.map((entry) =>
      entry._id === 'sword'
        ? {
            ...entry,
            modifiers: [
              {
                target: 'attack',
                bonusType: 'untyped',
                value: 2,
                condition: { weapon: '$self' },
              },
              {
                target: 'damage',
                bonusType: 'untyped',
                value: 3,
                condition: { weapon: '$choice', weaponSelection: 'greatsword' },
              },
            ],
          }
        : entry,
    ),
  };
  expect(
    attackRoutine(scoped).full.map((line) => [
      line.attackBonus.total,
      line.damageBonus.total,
    ]),
  ).toEqual([
    [10, 2],
    [17, 7],
    [12, 7],
    [7, 7],
  ]);
});

// B1 p. 301: a sole attack or a single possessed natural form is primary.
test('sole hooves and a pair of hooves are primary, while a hoof alongside a bite is secondary', () => {
  const hoof = routineState(withNatural(naturalSheet(), 'hoof', 'hoof'), {
    weaponEntryId: 'hoof',
  });
  const mixed = attackRoutine(hoof).single[0];
  expect(mixed).toMatchObject({
    naturalRole: 'secondary',
    attackBonus: { total: 10 },
    damageBonus: { total: 2 },
  });
  const sole = {
    ...hoof,
    entries: hoof.entries.filter((entry) => entry._id !== 'bite'),
  };
  expect(attackRoutine(sole).single[0]).toMatchObject({
    naturalRole: 'primary',
    attackBonus: { total: 15 },
    damageBonus: { total: 6 },
  });
  const paired = routineState(withNatural(sole, 'second-hoof', 'hoof'), {
    naturalAttackEntryIds: ['second-hoof'],
  });
  expect(
    attackRoutine(paired).full.map((line) => [
      line.naturalRole,
      line.attackBonus.total,
      line.damageBonus.total,
    ]),
  ).toEqual([
    ['primary', 15, 4],
    ['primary', 15, 4],
  ]);
});

test('Improved Unarmed Strike uses its active rule identity and does not change damage numbers', () => {
  const input = routineState(naturalSheet(), { weaponEntryId: 'unarmed' });
  const feat: SheetEntry = {
    _id: 'ius',
    kind: 'feat',
    active: true,
    catalogEntryId: 'ius-copy',
    state: { kind: 'feat' },
  };
  const selected = {
    ...input,
    entries: [...input.entries, feat],
    catalogEntries: [
      ...input.catalogEntries,
      {
        _id: 'ius-copy',
        name: 'Renamed feat',
        ruleIdentity: 'improved-unarmed-strike',
        modifiers: [],
      },
    ],
  };
  expect(attackRoutine(selected).single[0]).toMatchObject({
    damageKind: 'lethalOrNonlethal',
    attackBonus: { total: 15 },
    damageBonus: { total: 4 },
  });
  const off = {
    ...selected,
    entries: selected.entries.map((entry) =>
      entry.kind === 'feat' && entry._id === 'ius'
        ? { ...entry, active: false }
        : entry,
    ),
  };
  expect(attackRoutine(off).single[0]?.damageKind).toBe('nonlethal');
});

test('natural proficiency exceptions apply to the public proficiency facts and Weapon Focus prerequisite', () => {
  const input = naturalSheet();
  const focused = {
    ...input,
    entries: [
      ...input.entries,
      {
        _id: 'focus',
        kind: 'feat' as const,
        active: true,
        catalogEntryId: 'focus',
        state: { kind: 'feat' as const, choice: 'bite' },
      },
    ],
    catalogEntries: [
      ...input.catalogEntries,
      {
        _id: 'focus',
        name: 'Weapon Focus',
        ruleIdentity: 'weapon-focus',
        modifiers: [],
        detail: { kind: 'feat' as const },
        proficiencyPrerequisites: [
          {
            kind: 'proficiency' as const,
            proficiency: { choice: true as const },
          },
        ],
      },
    ],
  };
  const result = calculateCharacterSheet(focused);
  expect(result.weaponProficiencies[0]).toMatchObject({
    proficient: true,
    attackPenalty: 0,
  });
  expect(result.proficiencyPrerequisites).toContainEqual(
    expect.objectContaining({ entryId: 'focus', view: 'current', met: true }),
  );
});

// CRB p. 182: unarmed strikes count as light weapons; Table 8–7 p. 202.
test('built-in unarmed strike can occupy both hands without a duplicate Gear warning', () => {
  const input = routineState(naturalSheet(), {
    weaponEntryId: 'unarmed',
    offHand: { kind: 'weapon', weaponEntryId: 'unarmed', mode: 'melee' },
  });
  const result = attackRoutine(input);
  expect(
    result.full.map((line) => [
      line.hand,
      line.attackBonus.total,
      line.damageBonus.total,
    ]),
  ).toEqual([
    ['main', 11, 4],
    ['main', 6, 4],
    ['main', 1, 4],
    ['off', 7, 2],
  ]);
  expect(
    result.warnings.filter(
      (warning) => warning.check === 'invalidAttackOffHand',
    ),
  ).toEqual([]);
});

test.each([false, true])(
  'Double Slice does not duplicate already full Strength for natural-main or monk off-hand (monk=%s)',
  (monk) => {
    const base = withSword(naturalSheet());
    const input = routineState(
      {
        ...base,
        entries: [
          ...base.entries,
          {
            _id: 'double-slice',
            kind: 'feat',
            active: true,
            catalogEntryId: 'double-slice',
            state: { kind: 'feat' },
          },
        ],
        catalogEntries: [
          ...base.catalogEntries,
          { _id: 'double-slice', ruleIdentity: 'double-slice', modifiers: [] },
        ],
      },
      {
        weaponEntryId: monk ? 'sword' : 'bite',
        offHand: {
          kind: 'weapon',
          weaponEntryId: monk ? 'unarmed' : 'sword',
          mode: 'melee',
        },
      },
    );
    const result = attackRoutine(
      input,
      monk ? { monkUnarmedStrike: { dice: '1d6', sheetEntryId: 'monk' } } : {},
    );
    expect(result.full.at(-1)?.damageBonus.total).toBe(4);
    expect(
      result.full
        .at(-1)
        ?.damageBonus.applied.some(
          (modifier) => modifier.sheetEntryId === 'double-slice',
        ),
    ).toBe(false);
  },
);
