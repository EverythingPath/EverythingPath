import { expect, test } from 'vitest';
import type { Id } from '@convex/_generated/dataModel';
import {
  buildSheet,
  representativeWeapon,
} from './character-sheet-test-fixture';
import {
  attackOffHandChoiceValue,
  attackRoutineLineView,
  listAttackRoutineOffHands,
  listAttackRoutineRows,
  listAttackRoutineWeapons,
  listAttackRoutineAmmunition,
  listAttackAmmunitionCatalog,
  listAttackRoutineNaturalAttacks,
} from './attack-routine-view-model';

test('an off-hand double-end line keeps its own damage, critical and full-attack breakdown address', () => {
  const snapshot = buildSheet({
    sheetEntries: [
      {
        id: 'staff',
        name: 'Quarterstaff',
        modifiers: [],
        detail: {
          kind: 'item',
          consumable: false,
          weapon: {
            baseType: 'quarterstaff',
            proficiency: 'simple',
            handedness: 'twoHanded',
            dice: '1d6',
            threat: 20,
            mult: 2,
            otherEnd: { dice: '1d8', threat: 19, mult: 3 },
          },
        },
      },
    ],
    attackRoutines: [{ id: 'routine', name: 'Staff', weaponEntryId: 'staff' }],
  });
  const line = listAttackRoutineRows(snapshot)[0]?.single[0];
  if (!line) throw new Error('Missing attack line');
  const view = attackRoutineLineView({
    entryId: 'routine',
    sequence: 'full',
    attackIndex: 2,
    line: {
      ...line,
      hand: 'off',
      end: 'otherEnd',
      damageDice: '1d8',
      criticalThreat: { ...line.criticalThreat, total: 19 },
      criticalMultiplier: { ...line.criticalMultiplier, total: 3 },
    },
  });
  expect(view).toMatchObject({
    hand: 'off',
    end: 'otherEnd',
    roleLabel: null,
    positionLabel: 'Off hand',
    endLabel: 'Other end',
    position: 3,
    damage: {
      text: '1d8',
      target: {
        kind: 'attackRoutine',
        entryId: 'routine',
        sequence: 'full',
        attackIndex: 2,
        statistic: 'damageBonus',
      },
    },
    critical: { text: '19–20/×3' },
  });
  expect(
    listAttackRoutineOffHands(listAttackRoutineWeapons(snapshot), 'staff'),
  ).toMatchObject([
    {
      choice: { kind: 'otherEnd' },
      label: 'Other end of Quarterstaff',
      weapon: {
        dice: '1d8',
        threat: 19,
        mult: 3,
        handedness: 'light',
      },
    },
    {
      choice: { kind: 'weapon', weaponEntryId: 'staff' },
      label: 'Quarterstaff',
    },
    {
      choice: { kind: 'weapon', weaponEntryId: 'unarmed' },
      label: 'Unarmed strike',
    },
  ]);
});

test('a weapon ID cannot select the other-end card', () => {
  expect(
    attackOffHandChoiceValue({ kind: 'weapon', weaponEntryId: 'otherEnd' }),
  ).toBe('weapon:otherEnd');
  expect(attackOffHandChoiceValue({ kind: 'otherEnd' })).toBe('end:otherEnd');
});

test('ammunition choices keep same-named Gear rows distinct and exclude other items', () => {
  const snapshot = buildSheet({
    catalogOnly: [
      {
        id: 'shuriken',
        name: 'Shuriken',
        modifiers: [],
        detail: {
          kind: 'item',
          consumable: true,
          ammunition: true,
          weapon: {
            baseType: 'shuriken',
            proficiency: 'exotic',
            handedness: 'light',
            dice: '1d2',
            threat: 20,
            mult: 2,
            thrown: true,
            strengthDamage: 'thrown',
          },
        },
      },
    ],
    sheetEntries: [
      {
        id: 'arrows-a',
        name: 'Arrows',
        detail: { kind: 'item', consumable: true, ammunition: true },
        modifiers: [],
      },
      {
        id: 'arrows-b',
        name: 'Arrows',
        active: false,
        detail: { kind: 'item', consumable: true, ammunition: true },
        modifiers: [],
      },
      {
        id: 'rope',
        name: 'Rope',
        detail: { kind: 'item', consumable: false },
        modifiers: [],
      },
    ],
  });
  expect(listAttackRoutineAmmunition(snapshot)).toMatchObject([
    { entryId: 'arrows-a', label: 'Arrows 1', active: true },
    { entryId: 'arrows-b', label: 'Arrows 2', active: false },
  ]);
  expect(
    listAttackAmmunitionCatalog(snapshot).map((choice) => choice.label),
  ).toEqual(['Arrows', 'Arrows']);
});

test('ranged line views preserve launcher and ammunition identities, the resolver range penalty and routine rate notes', () => {
  const snapshot = buildSheet({
    sheetEntries: [
      {
        id: 'bow',
        name: 'Longbow',
        detail: {
          kind: 'item',
          consumable: false,
          weapon: {
            baseType: 'longbow',
            proficiency: 'martial',
            handedness: 'twoHanded',
            attackType: 'ranged',
            dice: '1d8',
            threat: 20,
            mult: 3,
            rangeIncrement: 100,
          },
        },
        modifiers: [],
      },
      {
        id: 'arrows',
        name: 'Arrows',
        detail: { kind: 'item', consumable: true, ammunition: true },
        modifiers: [],
      },
    ],
    attackRoutines: [
      { id: 'routine', name: 'Bow', weaponEntryId: 'bow', mode: 'ranged' },
    ],
  });
  snapshot.calculated.attackRoutines = snapshot.calculated.attackRoutines.map(
    (routine) => ({
      ...routine,
      rangeIncrements: 2,
      ammunitionEntryId: 'arrows',
      attackRateNotes: ['Reload: move action. One attack per full attack.'],
      single: routine.single.map((line) => ({
        ...line,
        launcherEntryId: 'bow',
        ammunitionEntryId: 'arrows',
        rangePenalty: -2,
      })),
    }),
  );
  const row = listAttackRoutineRows(snapshot)[0];
  expect(row).toMatchObject({
    rangeIncrements: 2,
    ammunitionEntryId: 'arrows',
    attackRateNotes: ['Reload: move action. One attack per full attack.'],
    singleView: [
      {
        weaponEntryId: 'bow',
        launcherEntryId: 'bow',
        ammunitionEntryId: 'arrows',
        ammunitionName: 'Arrows',
        range: { text: '100 ft.', penalty: -2, penaltyText: '−2' },
      },
    ],
  });
  const legacy = buildSheet({
    attackRoutines: [{ id: 'missing', name: 'Missing', weaponEntryId: 'gone' }],
  });
  expect(listAttackRoutineRows(legacy)[0]).toMatchObject({
    ammunitionEntryId: null,
    rangeIncrements: 1,
  });
});

test('mixed natural lines display secondary role and keep independent breakdown addresses', () => {
  const snapshot = buildSheet({
    sheetEntries: [
      {
        id: 'claw',
        name: 'Claw',
        modifiers: [],
        detail: {
          kind: 'item',
          consumable: false,
          weapon: {
            baseType: 'claw',
            proficiency: 'always',
            naturalAttack: { type: 'claw' },
          },
        },
      },
    ],
    attackRoutines: [
      {
        id: 'mixed',
        name: 'Strike and claw',
        weaponEntryId: 'unarmed',
        naturalAttackEntryIds: ['claw'],
        availableLimbs: 0,
      },
    ],
  });
  const row = listAttackRoutineRows(snapshot)[0];
  expect(row?.fullView).toMatchObject([
    { attackKind: 'unarmed', damageKindLabel: 'Nonlethal' },
    {
      attackKind: 'natural',
      naturalRole: 'secondary',
      roleLabel: 'Secondary natural attack',
      damage: {
        target: {
          kind: 'attackRoutine',
          entryId: 'mixed',
          sequence: 'full',
          attackIndex: 1,
          statistic: 'damageBonus',
        },
      },
    },
  ]);
  expect(row?.warnings).toEqual(
    expect.arrayContaining([expect.objectContaining({ check: 'attackLimbs' })]),
  );
});

test('every sheet offers unarmed strike without Gear and natural attacks keep their own role', () => {
  const snapshot = buildSheet({
    sheetEntries: [
      {
        id: 'claw',
        name: 'Claw',
        modifiers: [],
        detail: {
          kind: 'item',
          consumable: false,
          weapon: {
            baseType: 'claw',
            proficiency: 'always',
            naturalAttack: { type: 'claw' },
          },
        },
      },
    ],
    attackRoutines: [{ id: 'natural', name: 'Claw', weaponEntryId: 'claw' }],
  });
  expect(listAttackRoutineWeapons(buildSheet())).toMatchObject([
    { entryId: 'unarmed', label: 'Unarmed strike', isBuiltIn: true },
  ]);
  expect(listAttackRoutineNaturalAttacks(snapshot)).toMatchObject([
    {
      entryId: 'claw',
      label: 'Claw',
      naturalType: 'claw',
      naturalRole: 'primary',
      roleLabel: 'Primary natural attack',
    },
  ]);
  const line = listAttackRoutineRows(snapshot)[0]?.singleView[0];
  expect(line).toMatchObject({
    attackKind: 'natural',
    naturalRole: 'primary',
    roleLabel: 'Primary natural attack',
  });
  expect(
    listAttackRoutineOffHands(listAttackRoutineWeapons(snapshot), 'unarmed'),
  ).toMatchObject([{ entryId: 'unarmed' }]);
});

test('routine editors retain recorded missing natural choices and the default or explicit limb count', () => {
  const snapshot = buildSheet({
    attackRoutines: [
      { id: 'default', name: 'Unarmed', weaponEntryId: 'unarmed' },
      {
        id: 'missing',
        name: 'Missing claws',
        weaponEntryId: 'unarmed',
        naturalAttackEntryIds: ['missing-claw'],
        availableLimbs: 4,
      },
    ],
  });
  expect(listAttackRoutineRows(snapshot)).toMatchObject([
    { entryId: 'default', naturalAttackEntryIds: [], availableLimbs: 2 },
    {
      entryId: 'missing',
      naturalAttackEntryIds: ['missing-claw'],
      availableLimbs: 4,
    },
  ]);
});

const optionWeapons = [
  {
    id: 'sword',
    name: 'Longsword',
    modifiers: [],
    detail: {
      kind: 'item' as const,
      consumable: false,
      weapon: {
        baseType: 'longsword',
        proficiency: 'martial' as const,
        handedness: 'oneHanded' as const,
        dice: '1d8',
        threat: 19,
        mult: 2,
      },
    },
  },
  {
    id: 'dagger',
    name: 'Dagger',
    modifiers: [],
    detail: {
      kind: 'item' as const,
      consumable: false,
      weapon: {
        baseType: 'dagger',
        proficiency: 'simple' as const,
        handedness: 'light' as const,
        dice: '1d4',
        threat: 19,
        mult: 2,
      },
    },
  },
];

test('routine rows expose switched-on option chips, Vital Strike dice and the Rend breakdown address', () => {
  const snapshot = buildSheet({
    sheetEntries: optionWeapons,
    feats: [
      { id: 'power', key: 'power-attack' },
      { id: 'vital', key: 'vital-strike' },
      { id: 'rend', key: 'two-weapon-rend' },
      { id: 'expertise', key: 'combat-expertise', active: false },
    ],
    attackRoutines: [
      {
        id: 'routine',
        name: 'Two blades',
        weaponEntryId: 'sword',
        offHand: { kind: 'weapon', weaponEntryId: 'dagger', mode: 'melee' },
        options: ['vital-catalog', 'expertise-catalog'],
      },
    ],
  });
  const [row] = listAttackRoutineRows(snapshot);
  expect(row?.optionIds).toEqual(['vital-catalog', 'expertise-catalog']);
  expect(row?.optionChips).toEqual([
    {
      catalogEntryId: 'vital-catalog',
      label: 'Vital Strike',
      isInEffect: true,
    },
    {
      catalogEntryId: 'expertise-catalog',
      label: 'Combat Expertise',
      isInEffect: false,
    },
  ]);
  expect(row?.options.map((option) => option.name)).toEqual([
    'Vital Strike',
    'Combat Expertise',
    'Power Attack',
  ]);
  expect(row?.singleView[0]).toMatchObject({
    damage: { dice: '2d8' },
    vitalStrike: { label: 'Vital Strike', multiplier: 2 },
    extraAttack: null,
  });
  expect(row?.fullView.every((line) => line.vitalStrike === null)).toBe(true);
  expect(row?.rendView).toMatchObject({
    label: 'Two-Weapon Rend',
    text: '1d10',
    note: 'Once per round, when both hands hit.',
    target: { kind: 'twoWeaponRend', entryId: 'routine' },
  });
});

test('line views name an extra attack and Manyshot arrows', () => {
  const snapshot = buildSheet({
    sheetEntries: optionWeapons,
    attackRoutines: [{ id: 'routine', name: 'Sword', weaponEntryId: 'sword' }],
  });
  const line = snapshot.calculated.attackRoutines[0]!.full[0]!;
  expect(
    attackRoutineLineView({
      entryId: 'routine',
      sequence: 'full',
      attackIndex: 1,
      line: {
        ...line,
        extraAttack: { kind: 'haste', sheetEntryId: 'haste', name: 'Haste' },
        projectiles: 2,
      },
    }),
  ).toMatchObject({
    position: 2,
    extraAttack: { kind: 'haste', label: 'Haste' },
    projectilesLabel: '2 arrows',
  });
});

test('Item Ability dice read as extra damage parts with their critical and Situation wording', () => {
  const snapshot = buildSheet({
    sheetEntries: [
      {
        id: 'sword',
        name: 'Longsword',
        modifiers: [],
        detail: {
          kind: 'item',
          consumable: false,
          weapon: {
            baseType: 'longsword',
            proficiency: 'martial',
            dice: '1d8',
            threat: 19,
            mult: 2,
          },
        },
      },
    ],
    attackRoutines: [{ id: 'routine', name: 'Sword', weaponEntryId: 'sword' }],
  });
  const line = listAttackRoutineRows(snapshot)[0]?.single[0];
  if (!line) throw new Error('Missing attack line');
  const part = {
    sheetEntryId: 'sword',
    catalogEntryId: 'ability',
    situation: null,
    applies: true,
  };
  const view = attackRoutineLineView({
    entryId: 'routine',
    sequence: 'single',
    attackIndex: 0,
    line: {
      ...line,
      extraDamage: [
        {
          ...part,
          name: 'Flaming burst',
          dice: '1d6',
          damageType: 'fire',
          on: 'hit',
        },
        {
          ...part,
          name: 'Flaming burst',
          dice: '1d10',
          damageType: 'fire',
          on: 'crit',
        },
        {
          ...part,
          name: 'Bane',
          dice: '2d6',
          damageType: null,
          on: 'hit',
          situation: 'undead',
          applies: false,
        },
      ],
    },
  });
  expect(view.extraDamage).toEqual([
    {
      text: '+1d6 fire',
      source: 'Flaming burst',
      critical: false,
      situation: null,
      sheetEntryId: 'sword',
      applies: true,
    },
    {
      text: '+1d10 fire on a critical hit',
      source: 'Flaming burst',
      critical: true,
      situation: null,
      sheetEntryId: 'sword',
      applies: true,
    },
    {
      text: '+2d6 vs. undead',
      source: 'Bane',
      critical: false,
      situation: 'undead',
      sheetEntryId: 'sword',
      applies: false,
    },
  ]);
});

test('a specific weapon reads as the calculator sees it: its Base Item’s weapon, never its own placeholder', () => {
  const placeholder = {
    baseType: 'longsword',
    proficiency: 'simple' as const,
    dice: '1d4',
    threat: 20,
    mult: 2,
  };
  const snapshot = buildSheet({
    sheetEntries: [
      representativeWeapon('longsword', 'sword'),
      {
        id: 'tongue',
        name: 'Flame tongue',
        modifiers: [],
        detail: {
          kind: 'item',
          consumable: false,
          baseItem: 'sword-catalog' as Id<'catalogEntry'>,
          weapon: placeholder,
        },
      },
      {
        id: 'orphan',
        name: 'Orphaned blade',
        modifiers: [],
        detail: {
          kind: 'item',
          consumable: false,
          baseItem: 'missing-catalog' as Id<'catalogEntry'>,
          weapon: placeholder,
        },
      },
    ],
  });
  const weapons = listAttackRoutineWeapons(snapshot);
  expect(
    weapons.find((weapon) => weapon.entryId === 'tongue')?.weapon,
  ).toMatchObject({ dice: '1d8', threat: 19, proficiency: 'martial' });
  // Its Base Item is gone: the calculator has no weapon, so neither does the panel.
  expect(weapons.find((weapon) => weapon.entryId === 'orphan')).toBeUndefined();
});
