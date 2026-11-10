import { expect, test } from 'vitest';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
  type SheetEntry,
} from './character-sheet';
import {
  attackRoutineWeaponUses,
  defaultAttackRoutineConfiguration,
  type WeaponDetail,
} from './character-sheet-attacks';

function rangedAttackSheet({
  weapon,
  mode = 'ranged',
  feats = [],
}: {
  weapon: WeaponDetail;
  mode?: 'ranged' | 'thrown';
  feats?: { identity: string; choice?: string; active?: boolean }[];
}): CharacterSheetInput {
  const input = attackSheet();
  return {
    ...input,
    entries: [
      ...input.entries.map<SheetEntry>((entry) =>
        entry.kind === 'attackRoutine'
          ? {
              ...entry,
              state: {
                ...entry.state,
                mode,
                hands: weapon.handedness === 'twoHanded' ? 'two' : 'one',
              },
            }
          : entry.kind === 'base'
            ? {
                ...entry,
                state: {
                  ...entry.state,
                  proficiencies: {
                    added: [
                      { category: 'simple' },
                      { category: 'martial' },
                      { baseType: weapon.baseType },
                    ],
                    removed: [],
                  },
                },
              }
            : entry,
      ),
      ...feats.map(({ choice, active = true }, index) => ({
        _id: `feat-row-${index}`,
        kind: 'feat' as const,
        active,
        catalogEntryId: `feat-definition-${index}`,
        state: { kind: 'feat' as const, ...(choice ? { choice } : {}) },
      })),
    ],
    catalogEntries: [
      ...input.catalogEntries.map((definition) =>
        definition._id === 'longsword'
          ? {
              ...definition,
              name: weapon.baseType,
              detail: { kind: 'item' as const, weapon },
            }
          : definition,
      ),
      ...feats.map(({ identity }, index) => ({
        _id: `feat-definition-${index}`,
        ruleIdentity: identity,
        name: 'Renamed feat copy',
        detail: { kind: 'feat' as const },
        modifiers: [],
      })),
    ],
  };
}

// CRB pp. 144, 132: a light crossbow reloads as a move action; Rapid Reload
// applies to the chosen crossbow type and gives hand/light crossbows the bow rate.
test('a reload-limited crossbow gets iteratives only with its chosen Rapid Reload feat', () => {
  const weapon: WeaponDetail = {
    baseType: 'light crossbow',
    proficiency: 'simple',
    attackType: 'ranged',
    handedness: 'twoHanded',
    dice: '1d8',
    threat: 19,
    mult: 2,
    strengthDamage: 'crossbow',
    rangeIncrement: 80,
    reload: 'move',
  };
  const ordinary = calculateCharacterSheet(rangedAttackSheet({ weapon }))
    .attackRoutines[0]!;
  expect(ordinary.single.map((line) => line.attackBonus.total)).toEqual([13]);
  expect(ordinary.full.map((line) => line.attackBonus.total)).toEqual([13]);
  const wrongChoice = calculateCharacterSheet(
    rangedAttackSheet({
      weapon,
      feats: [{ identity: 'rapid-reload', choice: 'heavy crossbow' }],
    }),
  ).attackRoutines[0]!;
  expect(wrongChoice.full).toHaveLength(1);
  const rapid = calculateCharacterSheet(
    rangedAttackSheet({
      weapon,
      feats: [{ identity: 'rapid-reload', choice: 'light crossbow' }],
    }),
  ).attackRoutines[0]!;
  expect(rapid.full.map((line) => line.attackBonus.total)).toEqual([13, 8, 3]);
  expect(rapid.single).toHaveLength(1);
  expect(rapid.attackRateNotes).toContain(
    'Reload: free action (Rapid Reload).',
  );
});

// CRB p. 132: Rapid Reload's choice names a crossbow type, however it was typed.
test.each([
  [' Light Crossbow ', 3],
  ['LIGHT-CROSSBOW', 3],
  ['light_crossbow', 3],
  ['light', 1],
  ['crossbow', 1],
])(
  'Rapid Reload chosen as %j matches the typed crossbow base type',
  (choice, count) => {
    const weapon: WeaponDetail = {
      baseType: 'Light Crossbow',
      proficiency: 'simple',
      attackType: 'ranged',
      dice: '1d8',
      threat: 19,
      mult: 2,
      strengthDamage: 'crossbow',
      reload: 'move',
    };
    const routine = calculateCharacterSheet(
      rangedAttackSheet({
        weapon,
        feats: [{ identity: 'rapid-reload', choice }],
      }),
    ).attackRoutines[0]!;
    expect(routine.full).toHaveLength(count);
  },
);

// CRB p. 144, 132: Rapid Reload leaves a heavy crossbow's reload a move action.
test.each([
  ['heavy crossbow', 'fullRound', 'move action', 1],
  ['hand crossbow', 'move', 'free action', 3],
  ['light crossbow', 'free', 'free action', 3],
] as const)(
  'Rapid Reload respects %s reload limits and active chosen selections',
  (baseType, reload, action, count) => {
    const weapon: WeaponDetail = {
      baseType,
      reload,
      proficiency: 'simple',
      attackType: 'ranged',
      dice: '1d8',
      threat: 19,
      mult: 2,
      strengthDamage: 'crossbow',
    };
    const feats = [
      { identity: 'rapid-reload', choice: baseType },
      { identity: 'rapid-reload', choice: 'other type' },
    ];
    const routine = calculateCharacterSheet(
      rangedAttackSheet({ weapon, feats }),
    ).attackRoutines[0]!;
    expect(routine.full).toHaveLength(count);
    expect(routine.attackRateNotes.join(' ')).toContain(action);
    const inactive = calculateCharacterSheet(
      rangedAttackSheet({
        weapon: { ...weapon, reload: 'move' },
        feats: [{ identity: 'rapid-reload', choice: baseType, active: false }],
      }),
    ).attackRoutines[0]!;
    expect(inactive.full).toHaveLength(1);
  },
);

// #236 / CRB p. 468: launcher and ammunition are separate identities; combining
// magic properties is a later rule. The routine's one ammunition choice is
// fired by each hand's launcher.
test('main and off-hand launcher lines both retain the routine ammunition', () => {
  const weapon: WeaponDetail = {
    baseType: 'longbow',
    proficiency: 'martial',
    attackType: 'ranged',
    handedness: 'twoHanded',
    dice: '1d8',
    threat: 20,
    mult: 3,
  };
  const input = rangedAttackSheet({ weapon });
  input.entries = [
    ...input.entries.map<SheetEntry>((entry) =>
      entry.kind === 'attackRoutine'
        ? {
            ...entry,
            state: {
              ...entry.state,
              ammunitionEntryId: 'arrows-row',
              offHand: {
                kind: 'weapon',
                weaponEntryId: 'off-row',
                mode: 'ranged',
              },
            },
          }
        : entry,
    ),
    {
      _id: 'arrows-row',
      kind: 'item',
      active: true,
      catalogEntryId: 'arrows',
      state: { kind: 'item', enhancement: 3 },
    },
    {
      _id: 'off-row',
      kind: 'item',
      active: true,
      catalogEntryId: 'longsword',
      state: { kind: 'item' },
    },
  ];
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'arrows',
      ruleIdentity: 'arrow',
      name: 'Arrows',
      modifiers: [],
      detail: { kind: 'item', ammunition: true },
    },
  ];
  const routine = calculateCharacterSheet(input).attackRoutines[0]!;
  expect(routine.single[0]).toMatchObject({
    weaponEntryId: 'weapon-row',
    launcherEntryId: 'weapon-row',
    ammunitionEntryId: 'arrows-row',
  });
  expect(
    routine.full
      .filter((line) => line.hand === 'main')
      .map((line) => line.ammunitionEntryId),
  ).toEqual(['arrows-row', 'arrows-row', 'arrows-row']);
  expect(routine.full.find((line) => line.hand === 'off')).toMatchObject({
    weaponEntryId: 'off-row',
    launcherEntryId: 'off-row',
    ammunitionEntryId: 'arrows-row',
  });
  // #408: the +3 arrows' enhancement applies to the launcher's lines.
  expect(routine.single[0]?.attackBonus.total).toBe(16);
  expect(
    routine.warnings.filter((warning) => warning.check.includes('Ammunition')),
  ).toEqual([]);
});

test('an off-hand launcher alone fires the routine ammunition and owns its advisory', () => {
  const sword: WeaponDetail = {
    baseType: 'longsword',
    proficiency: 'martial',
    attackType: 'melee',
    handedness: 'oneHanded',
    dice: '1d8',
    threat: 19,
    mult: 2,
  };
  const input = rangedAttackSheet({ weapon: sword });
  input.entries = [
    ...input.entries.map<SheetEntry>((entry) =>
      entry.kind === 'attackRoutine'
        ? {
            ...entry,
            state: {
              ...entry.state,
              mode: 'melee',
              ammunitionEntryId: 'bolts-row',
              offHand: {
                kind: 'weapon',
                weaponEntryId: 'hand-crossbow-row',
                mode: 'ranged',
              },
            },
          }
        : entry,
    ),
    {
      _id: 'hand-crossbow-row',
      kind: 'item',
      active: true,
      catalogEntryId: 'hand-crossbow',
      state: { kind: 'item' },
    },
  ];
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'hand-crossbow',
      ruleIdentity: 'hand-crossbow',
      name: 'Hand crossbow',
      modifiers: [],
      detail: {
        kind: 'item',
        weapon: {
          baseType: 'hand crossbow',
          proficiency: 'exotic',
          attackType: 'ranged',
          handedness: 'light',
          dice: '1d4',
          threat: 19,
          mult: 2,
          reload: 'move',
          strengthDamage: 'crossbow',
        },
      },
    },
  ];
  const routine = calculateCharacterSheet(input).attackRoutines[0]!;
  expect(routine.single[0]).toMatchObject({
    launcherEntryId: null,
    ammunitionEntryId: null,
  });
  expect(routine.full.find((line) => line.hand === 'off')).toMatchObject({
    weaponEntryId: 'hand-crossbow-row',
    launcherEntryId: 'hand-crossbow-row',
    ammunitionEntryId: 'bolts-row',
  });
  expect(routine.warnings).toContainEqual(
    expect.objectContaining({
      check: 'missingAttackAmmunition',
      subject: 'routine',
    }),
  );
});

test.each(['missing', 'inactive', 'unavailable', 'invalid'] as const)(
  '%s ammunition keeps its choice and attacks with a routine warning',
  (availability) => {
    const weapon: WeaponDetail = {
      baseType: 'longbow',
      proficiency: 'martial',
      attackType: 'ranged',
      dice: '1d8',
      threat: 20,
      mult: 3,
    };
    const input = rangedAttackSheet({ weapon });
    input.entries = input.entries.map<SheetEntry>((entry) =>
      entry.kind === 'attackRoutine'
        ? {
            ...entry,
            state: { ...entry.state, ammunitionEntryId: 'arrows-row' },
          }
        : entry,
    );
    if (availability !== 'missing')
      input.entries = [
        ...input.entries,
        {
          _id: 'arrows-row',
          kind: 'item',
          active: availability !== 'inactive',
          ...(availability === 'unavailable'
            ? { grantKey: { source: 'missing-source', entry: 'arrow' } }
            : {}),
          catalogEntryId: 'arrows',
          state: { kind: 'item' },
        },
      ];
    input.catalogEntries = [
      ...input.catalogEntries,
      {
        _id: 'arrows',
        name: 'Arrows',
        ruleIdentity: 'arrow',
        modifiers: [],
        detail: { kind: 'item', ammunition: availability !== 'invalid' },
      },
    ];
    const routine = calculateCharacterSheet(input).attackRoutines[0]!;
    expect(routine.full).toHaveLength(3);
    expect(routine.single[0]?.ammunitionEntryId).toBe('arrows-row');
    expect(routine.warnings).toContainEqual(
      expect.objectContaining({
        check: `${availability}AttackAmmunition`,
        target: { kind: 'entry', entryId: 'routine' },
        subject: 'routine',
      }),
    );
  },
);

// CRB pp. 129, 131, 149; settled #237 A9: without Quick Draw each hand throws
// the one weapon it already holds, including no Improved/Greater off-hand
// extras. Quick Draw redraws with the throwing hand, so the other hand's
// weapon does not limit it; shuriken are drawn as ammunition.
test('held thrown weapons limit both chains until Quick Draw redraws with the throwing hand', () => {
  const weapon: WeaponDetail = {
    baseType: 'dagger',
    proficiency: 'simple',
    handedness: 'light',
    attackType: 'melee',
    thrown: true,
    thrownRangeIncrement: 10,
    dice: '1d4',
    threat: 19,
    mult: 2,
  };
  const sheet = (quickDraw: boolean) => {
    const input = rangedAttackSheet({
      weapon,
      mode: 'thrown',
      feats: [
        ...[
          'two-weapon-fighting',
          'improved-two-weapon-fighting',
          'greater-two-weapon-fighting',
        ].map((identity) => ({ identity })),
        ...(quickDraw ? [{ identity: 'quick-draw' }] : []),
      ],
    });
    input.entries = [
      ...input.entries.map<SheetEntry>((entry) =>
        entry.kind === 'attackRoutine'
          ? {
              ...entry,
              state: {
                ...entry.state,
                offHand: {
                  kind: 'weapon',
                  weaponEntryId: 'held-off',
                  mode: 'thrown',
                },
              },
            }
          : entry,
      ),
      {
        _id: 'held-off',
        kind: 'item',
        active: true,
        catalogEntryId: 'longsword',
        state: { kind: 'item' },
      },
    ];
    return calculateCharacterSheet(input).attackRoutines[0]!;
  };
  const held = sheet(false);
  expect(held.single.map((line) => line.attackBonus.total)).toEqual([13]);
  expect(
    held.full.map((line) => [
      line.hand,
      line.attackBonus.total,
      line.damageBonus.total,
    ]),
  ).toEqual([
    ['main', 11, 4],
    ['off', 11, 2],
  ]);
  expect(held.attackRateNotes).toContain(
    'One held thrown weapon per hand. Quick Draw permits additional throws.',
  );
  const drawing = sheet(true);
  expect(drawing.single).toHaveLength(1);
  expect(
    drawing.full.map((line) => [line.hand, line.attackBonus.total]),
  ).toEqual([
    ['main', 11],
    ['main', 6],
    ['main', 1],
    ['off', 11],
    ['off', 6],
    ['off', 1],
  ]);
  expect(drawing.attackRateNotes).toContain(
    'Quick Draw: draw thrown weapons as a free action.',
  );
});

// CRB p. 149: shuriken are drawn as ammunition, exempt from Quick Draw (#237 A9).
test('ammunition thrown weapons use the full rate without Quick Draw, whatever the other hand holds', () => {
  const weapon: WeaponDetail = {
    baseType: 'shuriken',
    proficiency: 'exotic',
    handedness: 'light',
    attackType: 'ranged',
    thrown: true,
    thrownRangeIncrement: 10,
    dice: '1d2',
    threat: 20,
    mult: 2,
  };
  const input = rangedAttackSheet({ weapon, mode: 'thrown' });
  input.catalogEntries = input.catalogEntries.map((entry) =>
    entry._id === 'longsword' && entry.detail?.kind === 'item'
      ? { ...entry, detail: { ...entry.detail, ammunition: true } }
      : entry,
  );
  expect(
    calculateCharacterSheet(input).attackRoutines[0]?.full.map(
      (line) => line.attackBonus.total,
    ),
  ).toEqual([13, 8, 3]);
  input.entries = [
    ...input.entries.map<SheetEntry>((entry) =>
      entry.kind === 'attackRoutine'
        ? {
            ...entry,
            state: {
              ...entry.state,
              offHand: {
                kind: 'weapon',
                weaponEntryId: 'other-shuriken',
                mode: 'thrown',
              },
            },
          }
        : entry,
    ),
    {
      _id: 'other-shuriken',
      kind: 'item',
      active: true,
      catalogEntryId: 'longsword',
      state: { kind: 'item' },
    },
  ];
  expect(
    calculateCharacterSheet(input)
      .attackRoutines[0]?.full.filter((line) => line.hand === 'main')
      .map((line) => line.attackBonus.total),
  ).toEqual([9, 4, -1]);
});

test('dedicated throwing weapons default to thrown mode while daggers retain melee', () => {
  const shared: WeaponDetail = {
    baseType: 'javelin',
    proficiency: 'simple',
    attackType: 'ranged',
    handedness: 'oneHanded',
    thrown: true,
    strengthDamage: 'thrown',
  };
  expect(defaultAttackRoutineConfiguration(shared)).toEqual({
    hands: 'one',
    mode: 'thrown',
  });
  expect(
    defaultAttackRoutineConfiguration({
      ...shared,
      baseType: 'dagger',
      attackType: 'melee',
      strengthDamage: 'melee',
    }),
  ).toEqual({ hands: 'one', mode: 'melee' });
});

// CRB pp. 131, 182: Point-Blank Shot is +1 attack/damage in its explicit
// within30ft Situation. Range increment and shooting into melee imply no Situation.
test('the ordinary Point-Blank Shot selection applies only in its flat Situation and combines with shooting into melee', async () => {
  const { representativeSelectionCatalog } =
    await import('../../convex/lib/representativeSelectionCatalog');
  const pointBlank = representativeSelectionCatalog.find(
    (entry) => entry.ruleIdentity === 'point-blank-shot',
  )!;
  const weapon: WeaponDetail = {
    baseType: 'longbow',
    proficiency: 'martial',
    attackType: 'ranged',
    dice: '1d8',
    threat: 20,
    mult: 3,
    rangeIncrement: 100,
    strengthDamage: 'bow',
  };
  const input = rangedAttackSheet({ weapon });
  input.entries = [
    ...input.entries,
    {
      _id: 'pbs-row',
      kind: 'feat',
      active: true,
      catalogEntryId: 'pbs-definition',
      state: { kind: 'feat' },
    },
  ];
  input.catalogEntries = [
    ...input.catalogEntries,
    { ...pointBlank, _id: 'pbs-definition', name: 'Renamed shot feat' },
  ];
  const ordinary = calculateCharacterSheet(input).attackRoutines[0]!;
  expect(ordinary.single[0]?.attackBonus.total).toBe(13);
  expect(ordinary.single[0]?.damageBonus.total).toBe(0);
  const close = calculateCharacterSheet(input, { situations: ['within30ft'] })
    .attackRoutines[0]!;
  expect(close.single[0]?.attackBonus.total).toBe(14);
  expect(close.single[0]?.damageBonus.total).toBe(1);
  expect(close.full.map((line) => line.attackBonus.total)).toEqual([14, 9, 4]);
  expect(close.single[0]?.attackBonus.applied).toContainEqual(
    expect.objectContaining({
      sheetEntryId: 'pbs-row',
      source: 'point-blank-shot',
      value: 1,
    }),
  );
  const melee = calculateCharacterSheet(input, {
    situations: ['shootingIntoMelee'],
  }).attackRoutines[0]!;
  expect(melee.single[0]?.attackBonus.total).toBe(9);
  expect(melee.single[0]?.damageBonus.total).toBe(0);
  const combined = calculateCharacterSheet(input, {
    situations: ['within30ft', 'shootingIntoMelee'],
  }).attackRoutines[0]!;
  expect(combined.single[0]?.attackBonus.total).toBe(10);
  expect(combined.single[0]?.damageBonus.total).toBe(1);
});

// CRB pp. 144, 149: reloading needs a free other hand. An off-hand weapon,
// the other end or a carried shield occupies it; a buckler and the routine's
// own two-handed grip do not. A sling loads as a move action, and Rapid
// Reload applies only to its chosen crossbow, not a sling.
test.each([
  ['an off-hand weapon', 'one', 'off-hand', 1],
  ['a heavy shield', 'one', 'heavyShield', 1],
  ['a switched-off heavy shield', 'one', 'inactiveShield', 3],
  ['a buckler', 'one', 'buckler', 3],
  ['two hands on the crossbow', 'two', 'heavyShield', 3],
  ['nothing', 'one', null, 3],
] as const)(
  'a free-reloading crossbow with %s in the other hand',
  (_, hands, occupant, count) => {
    const crossbow: WeaponDetail = {
      baseType: 'light crossbow',
      proficiency: 'simple',
      attackType: 'ranged',
      reload: 'move',
      strengthDamage: 'crossbow',
      dice: '1d8',
      threat: 19,
      mult: 2,
    };
    const input = rangedAttackSheet({
      weapon: crossbow,
      feats: [{ identity: 'rapid-reload', choice: 'light crossbow' }],
    });
    input.entries = [
      ...input.entries.map<SheetEntry>((entry) =>
        entry.kind === 'attackRoutine'
          ? {
              ...entry,
              state: {
                ...entry.state,
                hands,
                ...(occupant === 'off-hand'
                  ? {
                      offHand: {
                        kind: 'weapon' as const,
                        weaponEntryId: 'sword-row',
                        mode: 'melee' as const,
                      },
                    }
                  : {}),
              },
            }
          : entry,
      ),
      {
        _id: 'sword-row',
        kind: 'item',
        active: true,
        catalogEntryId: 'sword',
        state: { kind: 'item' },
      },
      ...(occupant && occupant !== 'off-hand'
        ? [
            {
              _id: 'shield-row',
              kind: 'item' as const,
              active: occupant !== 'inactiveShield',
              catalogEntryId:
                occupant === 'buckler' ? 'buckler' : 'heavy-shield',
              state: { kind: 'item' as const },
            },
          ]
        : []),
    ];
    input.catalogEntries = [
      ...input.catalogEntries,
      {
        _id: 'sword',
        ruleIdentity: 'short-sword',
        modifiers: [],
        detail: {
          kind: 'item',
          weapon: {
            baseType: 'short sword',
            proficiency: 'martial',
            handedness: 'light',
            attackType: 'melee',
            dice: '1d6',
            threat: 19,
            mult: 2,
          },
        },
      },
      ...(['buckler', 'heavyShield'] as const).map((category) => ({
        _id: category === 'buckler' ? 'buckler' : 'heavy-shield',
        ruleIdentity: category,
        modifiers: [],
        detail: {
          kind: 'item' as const,
          armor: {
            slot: 'shield' as const,
            category,
            armorCheckPenalty: 1,
            bonus: 1,
          },
        },
      })),
    ];
    const routine = calculateCharacterSheet(input).attackRoutines[0]!;
    expect(routine.single).toHaveLength(1);
    expect(routine.full.filter((line) => line.hand === 'main')).toHaveLength(
      count,
    );
    expect(routine.attackRateNotes[0]).toBe(
      count === 1
        ? 'Reload: free action (Rapid Reload), but no free hand to reload. One attack per full attack.'
        : 'Reload: free action (Rapid Reload).',
    );
  },
);

test('a sling loads as a move action and ignores Rapid Reload', () => {
  const sling = calculateCharacterSheet(
    rangedAttackSheet({
      weapon: {
        baseType: 'sling',
        proficiency: 'simple',
        attackType: 'ranged',
        reload: 'move',
        strengthDamage: 'sling',
        dice: '1d4',
        threat: 20,
        mult: 2,
      },
      feats: [{ identity: 'rapid-reload', choice: 'sling' }],
    }),
  ).attackRoutines[0]!;
  expect(sling.full).toHaveLength(1);
  expect(sling.attackRateNotes).toContain(
    'Reload: move action. One attack per full attack.',
  );
});

// CRB pp. 132, 144: each hand holds a crossbow, so neither has a free hand to
// reload; each fires its one loaded bolt whatever its reload speed.
test('a crossbow in each hand fires one loaded attack per hand', () => {
  const weapon: WeaponDetail = {
    baseType: 'light crossbow',
    proficiency: 'simple',
    attackType: 'ranged',
    reload: 'move',
    strengthDamage: 'crossbow',
    dice: '1d8',
    threat: 19,
    mult: 2,
  };
  const input = rangedAttackSheet({
    weapon,
    feats: [
      { identity: 'improved-two-weapon-fighting' },
      { identity: 'rapid-reload', choice: 'light crossbow' },
    ],
  });
  input.entries = [
    ...input.entries.map<SheetEntry>((entry) =>
      entry.kind === 'attackRoutine'
        ? {
            ...entry,
            state: {
              ...entry.state,
              offHand: {
                kind: 'weapon',
                weaponEntryId: 'heavy-row',
                mode: 'ranged',
              },
            },
          }
        : entry,
    ),
    {
      _id: 'heavy-row',
      kind: 'item',
      active: true,
      catalogEntryId: 'heavy',
      state: { kind: 'item' },
    },
  ];
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'heavy',
      ruleIdentity: 'heavy-crossbow',
      modifiers: [],
      detail: {
        kind: 'item',
        weapon: { ...weapon, baseType: 'heavy crossbow', reload: 'fullRound' },
      },
    },
  ];
  const routine = calculateCharacterSheet(input).attackRoutines[0]!;
  expect(routine.single.map((line) => line.attackBonus.total)).toEqual([13]);
  expect(
    routine.full.map((line) => [line.hand, line.attackBonus.total]),
  ).toEqual([
    ['main', 7],
    ['off', 3],
  ]);
  expect(routine.attackRateNotes).toEqual([
    'Reload: free action (Rapid Reload), but no free hand to reload. One attack per full attack.',
    'Off hand: Reload: full-round action. One attack per full attack.',
  ]);
});

// CRB pp. 131, 182: shooting/throwing into melee takes −4 unless Precise Shot.
test.each(['ranged', 'thrown'] as const)(
  '%s shooting into melee is a flat Combat situation removed by active Precise Shot',
  (mode) => {
    const weapon: WeaponDetail = {
      baseType: 'javelin',
      proficiency: 'simple',
      attackType: 'ranged',
      thrown: true,
      dice: '1d6',
      threat: 20,
      mult: 2,
    };
    const input = rangedAttackSheet({ weapon, mode });
    const ordinary = calculateCharacterSheet(input).attackRoutines[0]!;
    expect(ordinary.single[0]?.attackBonus.total).toBe(13);
    expect(ordinary.single[0]?.attackBonus.conditional).toContainEqual(
      expect.objectContaining({
        builtIn: true,
        value: -4,
        condition: { situation: 'shootingIntoMelee' },
      }),
    );
    expect(
      calculateCharacterSheet(input, { situations: ['melee'] })
        .attackRoutines[0]?.single[0]?.attackBonus.total,
    ).toBe(13);
    const firing = calculateCharacterSheet(input, {
      situations: ['shootingIntoMelee'],
    });
    expect(firing.attackRoutines[0]?.single[0]?.attackBonus.total).toBe(9);
    expect(firing.breakdowns['attack.ranged'].total).toBe(0);
    const precise = rangedAttackSheet({
      weapon,
      mode,
      feats: [{ identity: 'precise-shot' }],
    });
    expect(
      calculateCharacterSheet(precise, { situations: ['shootingIntoMelee'] })
        .attackRoutines[0]?.single[0]?.attackBonus.total,
    ).toBe(13);
    expect(
      calculateCharacterSheet(precise).attackRoutines[0]?.single[0]?.attackBonus
        .conditional,
    ).toEqual([]);
    const inactive = rangedAttackSheet({
      weapon,
      mode,
      feats: [{ identity: 'precise-shot', active: false }],
    });
    expect(
      calculateCharacterSheet(inactive, { situations: ['shootingIntoMelee'] })
        .attackRoutines[0]?.single[0]?.attackBonus.total,
    ).toBe(9);
  },
);

// CRB p. 180: −2 for each range increment beyond the first; maxima are five
// thrown or ten projectile increments. Rule drift stays advisory.
test.each([
  ['ranged', 1, 13, false],
  ['ranged', 3, 9, false],
  ['ranged', 10, -5, false],
  ['ranged', 11, -7, true],
  ['thrown', 5, 5, false],
  ['thrown', 6, 3, true],
] as const)(
  '%s at increment %s keeps range penalties and advisory maxima',
  (mode, rangeIncrements, attack, warning) => {
    const weapon: WeaponDetail = {
      baseType: mode === 'thrown' ? 'javelin' : 'longbow',
      proficiency: 'martial',
      attackType: 'ranged',
      thrown: mode === 'thrown',
      rangeIncrement: 100,
      thrownRangeIncrement: 30,
      dice: '1d6',
      threat: 20,
      mult: 3,
    };
    const input = rangedAttackSheet({ weapon, mode });
    input.entries = input.entries.map((entry) =>
      entry.kind === 'attackRoutine'
        ? { ...entry, state: { ...entry.state, rangeIncrements } }
        : entry,
    );
    const result = calculateCharacterSheet(input).attackRoutines[0]!;
    expect(result.single[0]?.attackBonus.total).toBe(attack);
    expect(result.single[0]?.rangeIncrement?.total).toBe(
      mode === 'thrown' ? 30 : 100,
    );
    expect(
      result.warnings.some((row) => row.check === 'attackRangeExceeded'),
    ).toBe(warning);
    expect(result.full.map((line) => line.rangePenalty)).toEqual(
      result.full.map(() =>
        rangeIncrements > 1 ? -2 * (rangeIncrements - 1) : null,
      ),
    );
    if (rangeIncrements > 1)
      expect(result.single[0]?.attackBonus.applied).toContainEqual(
        expect.objectContaining({
          sheetEntryId: 'routine',
          entryName: 'Range penalty',
          value: -2 * (rangeIncrements - 1),
        }),
      );
  },
);

test('melee lines carry no range penalty', () => {
  const input = attackSheet();
  input.entries = input.entries.map((entry) =>
    entry.kind === 'attackRoutine'
      ? { ...entry, state: { ...entry.state, rangeIncrements: 4 } }
      : entry,
  );
  const routine = calculateCharacterSheet(input).attackRoutines[0]!;
  expect(routine.single[0]?.rangePenalty).toBeNull();
  expect(routine.single[0]?.attackBonus.total).toBe(15);
});

// CRB p. 180: range increments belong to the routine, so its maximum is
// checked once. A thrown hand caps the whole routine at five increments.
test.each([
  ['ranged', 'ranged', 11, 10],
  ['ranged', 'thrown', 7, 5],
  ['melee', 'thrown', 6, 5],
] as const)(
  'a %s main hand with a %s off hand at %s increments warns once at its %s-increment maximum',
  (mainMode, offMode, rangeIncrements, maximum) => {
    const javelin: WeaponDetail = {
      baseType: 'javelin',
      proficiency: 'simple',
      attackType: 'ranged',
      handedness: 'oneHanded',
      thrown: true,
      rangeIncrement: 30,
      thrownRangeIncrement: 30,
      dice: '1d6',
      threat: 20,
      mult: 2,
    };
    const input = rangedAttackSheet({ weapon: javelin });
    input.entries = [
      ...input.entries.map<SheetEntry>((entry) =>
        entry.kind === 'attackRoutine'
          ? {
              ...entry,
              state: {
                ...entry.state,
                mode: mainMode,
                rangeIncrements,
                offHand: {
                  kind: 'weapon',
                  weaponEntryId: 'other-javelin',
                  mode: offMode,
                },
              },
            }
          : entry,
      ),
      {
        _id: 'other-javelin',
        kind: 'item',
        active: true,
        catalogEntryId: 'longsword',
        state: { kind: 'item' },
      },
    ];
    const routine = calculateCharacterSheet(input).attackRoutines[0]!;
    const exceeded = routine.warnings.filter(
      (warning) => warning.check === 'attackRangeExceeded',
    );
    expect(exceeded).toEqual([
      expect.objectContaining({
        subject: 'routine',
        target: { kind: 'entry', entryId: 'routine' },
        fingerprint: JSON.stringify([rangeIncrements, maximum]),
      }),
    ]);
    expect(exceeded[0]?.message).toContain(`${maximum}-increment maximum`);
    expect(routine.full.find((line) => line.hand === 'off')?.rangePenalty).toBe(
      -2 * (rangeIncrements - 1),
    );
  },
);

test("a range within every hand's maximum does not warn", () => {
  const input = rangedAttackSheet({
    weapon: {
      baseType: 'longbow',
      proficiency: 'martial',
      attackType: 'ranged',
      dice: '1d8',
      threat: 20,
      mult: 3,
    },
  });
  input.entries = input.entries.map((entry) =>
    entry.kind === 'attackRoutine'
      ? {
          ...entry,
          state: {
            ...entry.state,
            rangeIncrements: 5,
            offHand: { kind: 'otherEnd', mode: 'thrown' },
          },
        }
      : entry,
  );
  expect(
    calculateCharacterSheet(input).attackRoutines[0]?.warnings.filter(
      (warning) => warning.check === 'attackRangeExceeded',
    ),
  ).toEqual([]);
});

function pairedAttackSheet({
  light = false,
  feats = [],
}: { light?: boolean; feats?: string[] } = {}): CharacterSheetInput {
  const input = attackSheet();
  return {
    ...input,
    entries: [
      ...input.entries.map<SheetEntry>((entry) =>
        entry.kind === 'attackRoutine'
          ? {
              ...entry,
              state: {
                ...entry.state,
                offHand: {
                  kind: 'weapon',
                  weaponEntryId: 'off-weapon',
                  mode: 'melee' as const,
                },
              },
            }
          : entry,
      ),
      {
        _id: 'off-weapon',
        kind: 'item',
        active: true,
        catalogEntryId: 'off-catalog',
        state: { kind: 'item' },
      },
      ...feats.map((feat) => ({
        _id: `row-${feat}`,
        kind: 'feat' as const,
        active: true,
        catalogEntryId: `copy-${feat}`,
        state: { kind: 'feat' as const },
      })),
    ],
    catalogEntries: [
      ...input.catalogEntries,
      {
        _id: 'off-catalog',
        name: light ? 'Short sword' : 'Longsword',
        ruleIdentity: light ? 'short-sword' : 'longsword',
        modifiers: [],
        detail: {
          kind: 'item',
          weapon: {
            baseType: light ? 'short sword' : 'longsword',
            proficiency: 'martial',
            handedness: light ? 'light' : 'oneHanded',
            attackType: 'melee',
            dice: light ? '1d6' : '1d8',
            threat: 19,
            mult: 2,
            strengthDamage: 'melee',
          },
        },
      },
      ...feats.map((feat) => ({
        _id: `copy-${feat}`,
        name: 'Renamed catalog copy',
        ruleIdentity: feat,
        modifiers: [],
        detail: { kind: 'feat' as const },
      })),
    ],
  };
}

function attackSheet(bab = 11): CharacterSheetInput {
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
          proficiencies: { added: [{ category: 'martial' }], removed: [] },
        },
      },
      {
        _id: 'bab-row',
        kind: 'manual',
        active: true,
        catalogEntryId: 'bab',
        state: { kind: 'manual' },
      },
      {
        _id: 'weapon-row',
        kind: 'item',
        active: true,
        catalogEntryId: 'longsword',
        state: { kind: 'item' },
      },
      {
        _id: 'routine',
        kind: 'attackRoutine',
        active: true,
        state: {
          kind: 'attackRoutine',
          name: 'Sword',
          weaponEntryId: 'weapon-row',
          hands: 'one',
          mode: 'melee',
        },
      },
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: [
          ...abilityKeys.map((ability) => ({
            target: abilityTargets[ability],
            bonusType: 'base' as const,
            value:
              ability === 'strength' ? 18 : ability === 'dexterity' ? 14 : 10,
          })),
        ],
      },
      {
        _id: 'bab',
        ruleIdentity: 'bab',
        modifiers: [{ target: 'bab', bonusType: 'untyped', value: bab }],
      },
      {
        _id: 'longsword',
        name: 'Longsword',
        ruleIdentity: 'longsword',
        modifiers: [],
        detail: {
          kind: 'item',
          weapon: {
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
        },
      },
    ],
  };
}

test('weapon scoped Situations recompute only matching routine lines and stay out of sheet attack totals', () => {
  const input = attackSheet();
  input.catalogEntries.find((row) => row._id === 'longsword')!.modifiers = [
    {
      target: 'attack',
      value: 3,
      bonusType: 'enhancement',
      condition: { weapon: '$self', situation: 'evil' },
    },
  ];
  const ordinary = calculateCharacterSheet(input);
  const preview = calculateCharacterSheet(input, { situations: ['evil'] });
  expect(preview.breakdowns['attack.melee'].total).toBe(0);
  expect(ordinary.attackRoutines[0]?.single[0]?.attackBonus.total).toBe(15);
  expect(
    preview.attackRoutines[0]?.full.map((line) => line.attackBonus.total),
  ).toEqual([18, 13, 8]);
  input.entries = [
    ...input.entries,
    {
      _id: 'other-weapon',
      kind: 'item',
      active: true,
      catalogEntryId: 'longsword',
      state: { kind: 'item' },
    },
  ];
  input.entries = [
    ...input.entries,
    {
      _id: 'other-routine',
      kind: 'attackRoutine',
      active: true,
      state: {
        kind: 'attackRoutine',
        name: 'Other sword',
        weaponEntryId: 'other-weapon',
        mode: 'melee',
        hands: 'one',
      },
    },
  ];
  input.entries.find((row) => row._id === 'weapon-row')!.active = false;
  expect(
    calculateCharacterSheet(input, { situations: ['evil'] }).attackRoutines[1]
      ?.single[0]?.attackBonus.total,
  ).toBe(18);
});

test('Weapon Training matches a second weapon group while local Situations remain owned by each weapon entry', () => {
  const input = attackSheet();
  const sword = input.catalogEntries.find((row) => row._id === 'longsword')!;
  if (sword.detail?.kind === 'item' && sword.detail.weapon)
    sword.detail.weapon.groups = ['heavyBlades', 'close'];
  sword.modifiers = [
    {
      target: 'attack',
      bonusType: 'untyped',
      value: 3,
      condition: {
        weapon: '$self',
        situation: { local: 'against a marked foe' },
      },
    },
  ];
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'training',
      ruleIdentity: 'training',
      modifiers: [
        {
          target: 'attack',
          bonusType: 'untyped',
          value: 2,
          condition: { weapon: '$group', weaponSelection: 'close' },
        },
      ],
    },
  ];
  input.entries = [
    ...input.entries,
    {
      _id: 'training-row',
      kind: 'classFeature',
      active: true,
      catalogEntryId: 'training',
      state: { kind: 'classFeature' },
    },
    {
      _id: 'other-weapon',
      kind: 'item',
      active: true,
      catalogEntryId: 'longsword',
      state: { kind: 'item' },
    },
    {
      _id: 'other-routine',
      kind: 'attackRoutine',
      active: true,
      state: {
        kind: 'attackRoutine',
        name: 'Other sword',
        weaponEntryId: 'other-weapon',
        hands: 'one',
        mode: 'melee',
      },
    },
  ];
  const result = calculateCharacterSheet(input, {
    situations: [{ local: 'against a marked foe', sheetEntryId: 'weapon-row' }],
  });
  expect(result.breakdowns['attack.melee'].total).toBe(0);
  expect(
    result.attackRoutines.map((row) => row.single[0]?.attackBonus.total),
  ).toEqual([20, 17]);
});

// CRB pp. 179, 182: BAB +11 grants three attacks at +11/+6/+1.
// CRB pp. 141, 179: a one-handed melee weapon adds full Strength to damage.
test('a named routine has one standard attack and its ordered BAB iteratives', () => {
  const routine = calculateCharacterSheet(attackSheet()).attackRoutines[0];
  expect(routine?.single.map((line) => line.attackBonus.total)).toEqual([15]);
  expect(routine?.full.map((line) => line.attackBonus.total)).toEqual([
    15, 10, 5,
  ]);
  expect(routine?.single[0]).toMatchObject({
    damageDice: '1d8',
    damageBonus: { total: 4 },
    criticalThreat: { total: 19 },
    criticalMultiplier: { total: 2 },
    rangeIncrement: null,
  });
});

// CRB p. 202, Table 8–7: https://legacy.aonprd.com/coreRulebook/combat.html#two-weapon-fighting
test('two normal weapons apply minus six/minus ten only to the full attack', () => {
  const routine =
    calculateCharacterSheet(pairedAttackSheet()).attackRoutines[0];
  expect(routine?.single.map((line) => line.attackBonus.total)).toEqual([15]);
  expect(routine?.full.map((line) => line.attackBonus.total)).toEqual([
    9, 4, -1, 5,
  ]);
  expect(routine?.full.map((line) => line.hand)).toEqual([
    'main',
    'main',
    'main',
    'off',
  ]);
  expect(routine?.full[3]?.damageBonus.total).toBe(2);
});

test.each(['missing', 'inactive'] as const)(
  'an %s main weapon still reports the named off-hand warning with stable acceptance facts',
  (main) => {
    const input = pairedAttackSheet({ light: true });
    const offInactive: CharacterSheetInput = {
      ...input,
      entries: input.entries.map((entry) =>
        entry.kind === 'item' && entry._id === 'off-weapon'
          ? { ...entry, active: false }
          : entry,
      ),
    };
    const before = calculateCharacterSheet(offInactive).attackRoutines[0];
    const after = calculateCharacterSheet({
      ...offInactive,
      entries: offInactive.entries
        .filter((entry) => main !== 'missing' || entry._id !== 'weapon-row')
        .map((entry) =>
          main === 'inactive' &&
          entry.kind === 'item' &&
          entry._id === 'weapon-row'
            ? { ...entry, active: false }
            : entry,
        ),
    }).attackRoutines[0];
    const warning = before?.warnings.find(
      (row) => row.subject === 'routine:off',
    );
    expect(warning?.message).toBe(
      'Off hand: Short sword is switched off. Switch it on in Gear or choose another weapon. Off-hand attacks are skipped.',
    );
    expect(after?.warnings).toContainEqual(warning);
    expect(after?.single).toEqual([]);
    expect(after?.full).toEqual([]);
  },
);

// CRB p. 202, Table 8–7, the other three rows (same source as above).
test.each([
  { light: true, feats: [], attacks: [11, 6, 1, 7] },
  { light: false, feats: ['two-weapon-fighting'], attacks: [11, 6, 1, 11] },
  { light: true, feats: ['two-weapon-fighting'], attacks: [13, 8, 3, 13] },
])(
  'CRB two-weapon penalties with light=$light and feats=$feats',
  ({ light, feats, attacks }) => {
    const routine = calculateCharacterSheet(pairedAttackSheet({ light, feats }))
      .attackRoutines[0];
    expect(routine?.full.map((line) => line.attackBonus.total)).toEqual(
      attacks,
    );
    expect(routine?.single.map((line) => line.attackBonus.total)).toEqual([15]);
  },
);

test('the full-attack penalty breakdown credits the active Two-Weapon Fighting Selection', async () => {
  const { findCharacterSheetStatistic } =
    await import('./character-sheet-breakdowns');
  const calculated = calculateCharacterSheet(
    pairedAttackSheet({
      light: true,
      feats: ['two-weapon-fighting'],
    }),
  );
  for (const attackIndex of [0, 3]) {
    expect(
      findCharacterSheetStatistic(calculated, {
        kind: 'attackRoutine',
        entryId: 'routine',
        sequence: 'full',
        attackIndex,
        statistic: 'attackBonus',
      })?.applied,
    ).toContainEqual(
      expect.objectContaining({
        sheetEntryId: 'row-two-weapon-fighting',
        entryName: 'Two-weapon fighting',
        value: -2,
      }),
    );
  }
  expect(calculated.attackRoutines[0]?.twoWeaponPenaltySummary).toBe(
    'Two-weapon fighting, light off hand: −2 primary, −2 off hand',
  );
  expect(
    calculateCharacterSheet(attackSheet()).attackRoutines[0]
      ?.twoWeaponPenaltySummary,
  ).toBeNull();
});

test('ordinary seeded Greater Two-Weapon Fighting warns about missing prerequisites while retaining its attack', async () => {
  const { representativeSelectionCatalog } =
    await import('../../convex/lib/representativeSelectionCatalog');
  const input = pairedAttackSheet({
    light: true,
    feats: ['greater-two-weapon-fighting'],
  });
  const calculated = calculateCharacterSheet({
    ...input,
    catalogEntries: input.catalogEntries.map((definition) => {
      const seeded = representativeSelectionCatalog.find(
        (candidate) => candidate.ruleIdentity === definition.ruleIdentity,
      );
      return seeded
        ? { ...seeded, _id: definition._id, name: 'Renamed catalog copy' }
        : definition;
    }),
  });
  expect(
    calculated.attackRoutines[0]?.full
      .filter((line) => line.hand === 'off')
      .map((line) => line.attackBonus.total),
  ).toEqual([7, -3]);
  expect(calculated.warnings).toContainEqual(
    expect.objectContaining({
      check: 'prerequisites.current',
      target: { kind: 'entry', entryId: 'row-greater-two-weapon-fighting' },
    }),
  );
});

test('weapon proficiency uses keep the routine identity and identify each hand explicitly', () => {
  expect(attackRoutineWeaponUses(pairedAttackSheet())).toEqual([
    {
      entryId: 'weapon-row',
      routineEntryId: 'routine',
      hand: 'main',
      hands: 'one',
      attack: 'melee',
    },
    {
      entryId: 'off-weapon',
      routineEntryId: 'routine',
      hand: 'off',
      hands: 'one',
      attack: 'melee',
    },
  ]);
});

// CRB pp. 125, 127: Improved/Greater Two-Weapon Fighting add -5/-10 off-hand attacks.
// https://legacy.aonprd.com/coreRulebook/feats.html#improved-two-weapon-fighting
// https://legacy.aonprd.com/coreRulebook/feats.html#greater-two-weapon-fighting
test.each([
  {
    feats: ['two-weapon-fighting', 'improved-two-weapon-fighting'],
    attacks: [13, 8],
  },
  {
    feats: [
      'two-weapon-fighting',
      'improved-two-weapon-fighting',
      'greater-two-weapon-fighting',
    ],
    attacks: [13, 8, 3],
  },
  { feats: ['greater-two-weapon-fighting'], attacks: [7, -3] },
])(
  'active off-hand feats add exactly their attacks: $feats',
  ({ feats, attacks }) => {
    const routine = calculateCharacterSheet(
      pairedAttackSheet({ light: true, feats }),
    ).attackRoutines[0];
    expect(
      routine?.full
        .filter((line) => line.hand === 'off')
        .map((line) => line.attackBonus.total),
    ).toEqual(attacks);
    expect(routine?.single).toHaveLength(1);
    const extra = routine?.full.filter((line) => line.hand === 'off')[1];
    expect(extra?.attackBonus.applied).toContainEqual(
      expect.objectContaining({
        sheetEntryId: `row-${feats.includes('improved-two-weapon-fighting') ? 'improved-two-weapon-fighting' : 'greater-two-weapon-fighting'}`,
      }),
    );
  },
);

// CRB p. 122, Double Slice; CRB p. 179, off-hand damage and full Strength penalties.
// https://legacy.aonprd.com/coreRulebook/feats.html#double-slice
test.each([
  { strength: 17, feats: [], damage: 1 },
  { strength: 17, feats: ['double-slice'], damage: 3 },
  { strength: 7, feats: [], damage: -2 },
  { strength: 7, feats: ['double-slice'], damage: -2 },
])(
  'off-hand Strength $strength with feats=$feats gives damage $damage',
  ({ strength, feats, damage }) => {
    const input = pairedAttackSheet({ light: true, feats });
    const routine = calculateCharacterSheet({
      ...input,
      catalogEntries: input.catalogEntries.map((entry) =>
        entry._id === 'base'
          ? {
              ...entry,
              modifiers: entry.modifiers.map((modifier) =>
                modifier.target === 'ability.str'
                  ? { ...modifier, value: strength }
                  : modifier,
              ),
            }
          : entry,
      ),
    }).attackRoutines[0];
    expect(
      routine?.full.find((line) => line.hand === 'off')?.damageBonus.total,
    ).toBe(damage);
  },
);

// CRB pp. 143, 147: gnome hooked hammer is 1d8/×3 and 1d6/×4.
// CRB p. 202: the second end counts as light for two-weapon penalties.
// Decision #237 A10: primary full-attack end adds Str ×1; single end in two hands ×1½.
test.each([false, true])(
  'double ends retain separate weapon statistics and enchantments (Double Slice=$doubleSlice)',
  (doubleSlice) => {
    const input = attackSheet();
    const featInput = pairedAttackSheet({ feats: ['double-slice'] });
    const routine = calculateCharacterSheet({
      ...input,
      entries: [
        ...input.entries.map<SheetEntry>((entry) =>
          entry.kind === 'attackRoutine'
            ? {
                ...entry,
                state: {
                  ...entry.state,
                  hands: 'two',
                  offHand: { kind: 'otherEnd', mode: 'melee' },
                },
              }
            : entry.kind === 'item'
              ? {
                  ...entry,
                  state: {
                    kind: 'item',
                    enhancement: 2,
                    otherEnd: { masterwork: true },
                  },
                }
              : entry,
        ),
        ...(doubleSlice
          ? featInput.entries.filter((entry) => entry.kind === 'feat')
          : []),
      ],
      catalogEntries: [
        ...input.catalogEntries.map<CharacterSheetCatalogEntry>((entry) =>
          entry._id === 'longsword'
            ? {
                ...entry,
                name: 'Gnome hooked hammer',
                detail: {
                  kind: 'item',
                  weapon: {
                    baseType: 'gnome hooked hammer',
                    proficiency: 'always',
                    handedness: 'twoHanded',
                    attackType: 'melee',
                    strengthDamage: 'melee',
                    dice: '1d8',
                    threat: 20,
                    mult: 3,
                    damageTypes: ['bludgeoning'],
                    otherEnd: {
                      dice: '1d6',
                      threat: 20,
                      mult: 4,
                      damageTypes: ['piercing'],
                    },
                  },
                },
              }
            : entry,
        ),
        ...(doubleSlice
          ? featInput.catalogEntries.filter(
              (entry) => entry.detail?.kind === 'feat',
            )
          : []),
      ],
    }).attackRoutines[0];
    expect(routine?.single[0]).toMatchObject({
      attackBonus: { total: 17 },
      damageBonus: { total: 8 },
      hand: 'main',
      end: 'primary',
    });
    expect(routine?.full[0]).toMatchObject({
      attackBonus: { total: 13 },
      damageBonus: { total: 6 },
      damageDice: '1d8',
      criticalMultiplier: { total: 3 },
    });
    expect(routine?.full[3]).toMatchObject({
      attackBonus: { total: 8 },
      damageBonus: { total: doubleSlice ? 4 : 2 },
      hand: 'off',
      end: 'otherEnd',
      damageDice: '1d6',
      damageType: 'piercing',
      criticalMultiplier: { total: 4 },
      weaponEntryId: 'weapon-row',
    });
  },
);

test.each(['missing', 'inactive', 'same-row', 'not-double'] as const)(
  'an invalid %s off hand remains recorded and warns while keeping the main attack',
  (configuration) => {
    const input = pairedAttackSheet();
    const routine = calculateCharacterSheet({
      ...input,
      entries: input.entries.map((entry) =>
        entry.kind === 'attackRoutine'
          ? {
              ...entry,
              state: {
                ...entry.state,
                offHand:
                  configuration === 'not-double'
                    ? { kind: 'otherEnd', mode: 'melee' }
                    : {
                        kind: 'weapon',
                        weaponEntryId:
                          configuration === 'missing'
                            ? 'gone'
                            : configuration === 'same-row'
                              ? 'weapon-row'
                              : 'off-weapon',
                        mode: 'melee',
                      },
              },
            }
          : entry.kind === 'item' &&
              entry._id === 'off-weapon' &&
              configuration === 'inactive'
            ? { ...entry, active: false }
            : entry,
      ),
    }).attackRoutines[0];
    expect(routine?.single).toHaveLength(1);
    expect(routine?.full.map((line) => line.attackBonus.total)).toEqual([
      15, 10, 5,
    ]);
    expect(routine?.offHand).toBeDefined();
    expect(routine?.warnings).toContainEqual(
      expect.objectContaining({
        check:
          configuration === 'missing'
            ? 'missingAttackWeapon'
            : configuration === 'inactive'
              ? 'inactiveAttackWeapon'
              : 'invalidAttackOffHand',
        target: { kind: 'entry', entryId: 'routine' },
        subject: 'routine:off',
      }),
    );
  },
);

// CRB p. 141: two-handed weapons require both hands; suitability remains advisory.
test('two hands occupied by the main weapon warns while retaining both chosen weapons', () => {
  const input = pairedAttackSheet();
  const routine = calculateCharacterSheet({
    ...input,
    entries: input.entries.map((entry) =>
      entry.kind === 'attackRoutine'
        ? { ...entry, state: { ...entry.state, hands: 'two' } }
        : entry,
    ),
  }).attackRoutines[0];
  expect(routine?.full).toHaveLength(4);
  expect(routine?.warnings).toContainEqual(
    expect.objectContaining({
      check: 'unsuitableAttackOffHand',
      target: { kind: 'entry', entryId: 'routine' },
    }),
  );
});

test('each hand applies its own proficiency penalty and mode', () => {
  const input = pairedAttackSheet({
    light: true,
    feats: ['two-weapon-fighting'],
  });
  const routine = calculateCharacterSheet({
    ...input,
    entries: input.entries.map((entry) =>
      entry.kind === 'attackRoutine'
        ? {
            ...entry,
            state: {
              ...entry.state,
              offHand: {
                kind: 'weapon',
                weaponEntryId: 'off-weapon',
                mode: 'thrown',
              },
            },
          }
        : entry,
    ),
    catalogEntries: input.catalogEntries.map((entry) =>
      entry._id === 'off-catalog'
        ? {
            ...entry,
            detail: {
              kind: 'item',
              weapon: {
                baseType: 'dagger',
                proficiency: 'simple',
                handedness: 'light',
                attackType: 'melee',
                dice: '1d4',
                threat: 19,
                mult: 2,
                thrown: true,
                thrownRangeIncrement: 10,
                strengthDamage: 'melee',
              },
            },
          }
        : entry,
    ),
  }).attackRoutines[0];
  expect(routine?.full[0]?.attackBonus.total).toBe(13);
  // Dex +2, BAB +11, TWF -2 and nonproficiency -4 = +7.
  expect(routine?.full[3]).toMatchObject({
    mode: 'thrown',
    attackBonus: { total: 7 },
    damageBonus: { total: 2 },
    rangeIncrement: { total: 10 },
  });
});

// CRB pp. 147, 179: a composite bow adds Strength only up to its rating;
// off-hand damage then halves the positive bonus. This unusual hand choice is advisory.
test.each([false, true])(
  'an off-hand composite bow caps Strength before its hand multiplier (Double Slice=%s)',
  (doubleSlice) => {
    const input = pairedAttackSheet({
      feats: doubleSlice ? ['double-slice'] : [],
    });
    const routine = calculateCharacterSheet({
      ...input,
      entries: input.entries.map((entry) =>
        entry.kind === 'attackRoutine'
          ? {
              ...entry,
              state: {
                ...entry.state,
                offHand: {
                  kind: 'weapon',
                  weaponEntryId: 'off-weapon',
                  mode: 'ranged',
                },
              },
            }
          : entry,
      ),
      catalogEntries: input.catalogEntries.map((entry) =>
        entry._id === 'off-catalog'
          ? {
              ...entry,
              name: 'Composite longbow (+3)',
              detail: {
                kind: 'item',
                weapon: {
                  baseType: 'longbow',
                  proficiency: 'martial',
                  handedness: 'twoHanded',
                  attackType: 'ranged',
                  dice: '1d8',
                  threat: 20,
                  mult: 3,
                  strengthDamage: 'compositeBow',
                  strengthRating: 3,
                },
              },
            }
          : entry,
      ),
    }).attackRoutines[0];
    expect(
      routine?.full.find((line) => line.hand === 'off')?.damageBonus.total,
    ).toBe(doubleSlice ? 3 : 1);
    expect(routine?.warnings).toContainEqual(
      expect.objectContaining({
        check: 'unsuitableAttackHands',
        subject: 'routine:off',
      }),
    );
  },
);

test.each(['inactive', 'dormant', 'impostor'] as const)(
  '$state attack feats cannot alter the routine',
  (state) => {
    const input = pairedAttackSheet({
      light: true,
      feats: [
        'two-weapon-fighting',
        'improved-two-weapon-fighting',
        'greater-two-weapon-fighting',
        'double-slice',
      ],
    });
    const routine = calculateCharacterSheet({
      ...input,
      entries: input.entries.map((entry) =>
        entry.kind === 'feat'
          ? {
              ...entry,
              active: state !== 'inactive',
              ...(state === 'dormant'
                ? {
                    grantKey: {
                      source: 'missing-source',
                      entry: entry.catalogEntryId,
                    },
                  }
                : {}),
            }
          : entry,
      ),
      catalogEntries: input.catalogEntries.map((entry) =>
        entry.detail?.kind === 'feat' && state === 'impostor'
          ? {
              ...entry,
              name: entry.ruleIdentity,
              ruleIdentity: `unrelated-${entry.ruleIdentity}`,
            }
          : entry,
      ),
    }).attackRoutines[0];
    expect(routine?.full.map((line) => line.attackBonus.total)).toEqual([
      11, 6, 1, 7,
    ]);
    expect(routine?.full[3]?.damageBonus.total).toBe(2);
  },
);

test('remapping renamed copies preserves active feat benefits and source breakdowns', async () => {
  const input = pairedAttackSheet({
    light: true,
    feats: [
      'two-weapon-fighting',
      'improved-two-weapon-fighting',
      'double-slice',
    ],
  });
  const calculated = calculateCharacterSheet(input);
  expect(
    calculated.attackRoutines[0]?.full.map((line) => line.attackBonus.total),
  ).toEqual([13, 8, 3, 13, 8]);
  const { findCharacterSheetStatistic } =
    await import('./character-sheet-breakdowns');
  expect(
    findCharacterSheetStatistic(calculated, {
      kind: 'attackRoutine',
      entryId: 'routine',
      sequence: 'full',
      attackIndex: 4,
      statistic: 'damageBonus',
    }),
  ).toMatchObject({
    total: 4,
    applied: expect.arrayContaining([
      expect.objectContaining({
        sheetEntryId: 'builtin:ability.str',
        value: 2,
      }),
      expect.objectContaining({
        sheetEntryId: 'row-double-slice',
        entryName: 'Double Slice',
        value: 2,
      }),
    ]),
  });
});

test('attack number lookups retain provenance for single and full attacks', async () => {
  const { findCharacterSheetStatistic } =
    await import('./character-sheet-breakdowns');
  const calculated = calculateCharacterSheet(attackSheet());
  const target = {
    kind: 'attackRoutine',
    entryId: 'routine',
    sequence: 'full',
    attackIndex: 1,
    statistic: 'attackBonus',
  } as const;
  expect(findCharacterSheetStatistic(calculated, target)).toMatchObject({
    total: 10,
    applied: expect.arrayContaining([
      expect.objectContaining({ entryName: 'Strength', value: 4 }),
      expect.objectContaining({ sheetEntryId: 'bab-row', value: 11 }),
      expect.objectContaining({ entryName: 'Iterative attack 2', value: -5 }),
    ]),
  });
});

test.each([
  ['melee', 'Strength', 'str', 4, 4],
  ['ranged', 'Dexterity', 'dex', 2, 0],
] as const)(
  '%s ability and iterative contributions credit ability and BAB rather than the weapon',
  (mode, label, ability, attackValue, damageValue) => {
    const input = attackSheet();
    const routine = calculateCharacterSheet({
      ...input,
      entries: input.entries.map((entry) =>
        entry.kind === 'attackRoutine'
          ? { ...entry, state: { ...entry.state, mode } }
          : entry,
      ),
    }).attackRoutines[0];
    expect(routine?.single[0]?.attackBonus.applied).toContainEqual(
      expect.objectContaining({
        entryName: label,
        source: `builtin:ability.${ability}`,
        sheetEntryId: `builtin:ability.${ability}`,
        value: attackValue,
      }),
    );
    expect(routine?.single[0]?.damageBonus.applied).toContainEqual(
      expect.objectContaining({
        entryName: 'Strength to damage',
        source: 'builtin:ability.str',
        sheetEntryId: 'builtin:ability.str',
        value: damageValue,
      }),
    );
    expect(routine?.full[1]?.attackBonus.applied).toContainEqual(
      expect.objectContaining({
        entryName: 'Iterative attack 2',
        source: 'builtin:bab',
        sheetEntryId: 'builtin:bab',
        value: -5,
      }),
    );
    expect(routine?.single[0]?.criticalThreat.applied).toContainEqual(
      expect.objectContaining({
        source: 'weapon-row',
        sheetEntryId: 'weapon-row',
      }),
    );
  },
);

// CRB pp. 141, 179 and the ranged-weapon descriptions, pp. 144–149.
test.each([
  ['longsword', 'one', 'melee', 18, 15, 4, null],
  ['longsword', 'two', 'melee', 18, 15, 6, null],
  ['dagger', 'two', 'melee', 18, 15, 4, null],
  ['greatsword', 'two', 'melee', 7, 9, -2, null],
  ['spear', 'two', 'thrown', 18, 13, 4, 20],
  ['spear', 'two', 'thrown', 7, 13, -2, 20],
  ['longbow', 'two', 'ranged', 18, 13, 0, 100],
  ['longbow', 'two', 'ranged', 7, 13, -2, 100],
  ['composite-longbow-2', 'two', 'ranged', 18, 13, 2, 110],
  ['composite-longbow-2', 'two', 'ranged', 12, 11, 1, 110],
  ['light-crossbow', 'two', 'ranged', 7, 13, 0, 80],
  ['sling', 'one', 'ranged', 18, 13, 4, 50],
] as const)(
  'CRB %s in %s hand(s), %s mode, Strength %s resolves attack and damage',
  async (weaponId, hands, mode, strength, attack, damage, range) => {
    const { representativeWeaponCatalog } =
      await import('../../convex/lib/representativeWeaponCatalog');
    const input = attackSheet();
    const sheet: CharacterSheetInput = {
      ...input,
      entries: input.entries.map((entry) =>
        entry.kind === 'item'
          ? { ...entry, catalogEntryId: weaponId }
          : entry.kind === 'attackRoutine'
            ? { ...entry, state: { ...entry.state, hands, mode } }
            : entry.kind === 'base'
              ? {
                  ...entry,
                  state: {
                    ...entry.state,
                    proficiencies: {
                      added: [{ category: 'martial' }, { category: 'simple' }],
                      removed: [],
                    },
                  },
                }
              : entry,
      ),
      catalogEntries: [
        ...input.catalogEntries
          .filter((entry) => entry._id !== 'longsword')
          .map((entry) =>
            entry._id === 'base'
              ? {
                  ...entry,
                  modifiers: entry.modifiers.map((modifier) =>
                    modifier.target === 'ability.str'
                      ? { ...modifier, value: strength }
                      : modifier,
                  ),
                }
              : entry,
          ),
        ...representativeWeaponCatalog.map((weapon) => ({
          ...weapon,
          _id: weapon.ruleIdentity,
        })),
      ],
    };
    const line = calculateCharacterSheet(sheet).attackRoutines[0]?.single[0];
    expect(line?.attackBonus.total).toBe(attack);
    expect(line?.damageBonus.total).toBe(damage);
    expect(line?.rangeIncrement?.total ?? null).toBe(range);
  },
);

test.each([0, 5, 6, 10, 11, 15, 16, 20])(
  'CRB BAB %s controls only full-attack iteratives',
  (bab) => {
    const routine = calculateCharacterSheet(attackSheet(bab)).attackRoutines[0];
    const expected = bab < 6 ? 1 : bab < 11 ? 2 : bab < 16 ? 3 : 4;
    expect(routine?.single).toHaveLength(1);
    expect(routine?.full).toHaveLength(expected);
  },
);

test('a missing weapon preserves its routine and emits an addressable warning', () => {
  const input = attackSheet();
  const result = calculateCharacterSheet({
    ...input,
    entries: input.entries.filter((entry) => entry.kind !== 'item'),
  });
  expect(result.attackRoutines[0]).toMatchObject({
    entryId: 'routine',
    name: 'Sword',
    weaponEntryId: 'weapon-row',
    single: [],
    full: [],
  });
  expect(result.warnings).toContainEqual(
    expect.objectContaining({
      check: 'missingAttackWeapon',
      target: { kind: 'entry', entryId: 'routine' },
    }),
  );
});

test('a switched-off weapon keeps its routine with a distinct warning and no attack lines', () => {
  const input = attackSheet();
  const calculated = calculateCharacterSheet({
    ...input,
    entries: input.entries.map((entry) =>
      entry.kind === 'item' ? { ...entry, active: false } : entry,
    ),
  });
  expect(calculated.attackRoutines[0]).toMatchObject({
    single: [],
    full: [],
    warnings: [
      expect.objectContaining({
        check: 'inactiveAttackWeapon',
        message: expect.stringContaining('switched off'),
        target: { kind: 'entry', entryId: 'routine' },
      }),
    ],
  });
});

test('a dormant weapon keeps its routine without contributing attacks or proficiency uses', () => {
  const input = attackSheet();
  const calculated = calculateCharacterSheet({
    ...input,
    entries: input.entries.map((entry) =>
      entry.kind === 'item'
        ? {
            ...entry,
            grantKey: { source: 'missing-source', entry: 'longsword' },
          }
        : entry,
    ),
  });
  expect(calculated.attackRoutines[0]).toMatchObject({
    single: [],
    full: [],
    warnings: [
      expect.objectContaining({
        check: 'unavailableAttackWeapon',
        target: { kind: 'entry', entryId: 'routine' },
      }),
    ],
  });
  expect(calculated.weaponProficiencies).toEqual([]);
});

test.each(['non-item', 'non-weapon'] as const)(
  'a %s reference warns on its routine without pretending it left Gear',
  (kind) => {
    const input = attackSheet();
    const calculated = calculateCharacterSheet({
      ...input,
      entries: input.entries.map((entry) =>
        entry.kind === 'attackRoutine' && kind === 'non-item'
          ? { ...entry, state: { ...entry.state, weaponEntryId: 'bab-row' } }
          : entry,
      ),
      catalogEntries: input.catalogEntries.map((entry) =>
        entry._id === 'longsword' && kind === 'non-weapon'
          ? { ...entry, detail: { kind: 'item' } }
          : entry,
      ),
    });
    expect(calculated.attackRoutines[0]).toMatchObject({
      single: [],
      warnings: [
        expect.objectContaining({
          check: 'invalidAttackWeapon',
          target: { kind: 'entry', entryId: 'routine' },
        }),
      ],
    });
  },
);

test('switched-off and missing weapons supply no routine uses for proficiency checks', () => {
  const input = attackSheet();
  expect(
    attackRoutineWeaponUses({
      ...input,
      entries: input.entries.map((entry) =>
        entry.kind === 'item' ? { ...entry, active: false } : entry,
      ),
    }),
  ).toEqual([]);
  expect(
    attackRoutineWeaponUses({
      ...input,
      entries: input.entries.filter((entry) => entry.kind !== 'item'),
    }),
  ).toEqual([]);
});

// CRB p. 141: two-handed weapons require two hands. The choice remains advisory.
test('one-handed use of a greatsword warns without blocking its routine', () => {
  const input = attackSheet();
  const calculated = calculateCharacterSheet({
    ...input,
    catalogEntries: input.catalogEntries.map((entry) =>
      entry.detail?.kind === 'item' && entry.detail.weapon
        ? {
            ...entry,
            name: 'Greatsword',
            detail: {
              ...entry.detail,
              weapon: {
                ...entry.detail.weapon,
                handedness: 'twoHanded',
                dice: '2d6',
              },
            },
          }
        : entry,
    ),
  });
  expect(calculated.attackRoutines[0]?.single).toHaveLength(1);
  expect(calculated.attackRoutines[0]?.warnings).toContainEqual(
    expect.objectContaining({
      check: 'unsuitableAttackHands',
      target: { kind: 'entry', entryId: 'routine' },
    }),
  );
});

// CRB p. 141, thrown weapons: throwing a melee weapon not designed to be
// thrown gives -4 to attack and a 10-foot range increment, with full Strength.
test('throwing a longsword applies the improvised throw penalty and range with an advisory warning', () => {
  const input = attackSheet();
  const calculated = calculateCharacterSheet({
    ...input,
    entries: input.entries.map((entry) =>
      entry.kind === 'attackRoutine'
        ? { ...entry, state: { ...entry.state, mode: 'thrown' } }
        : entry,
    ),
  });
  expect(calculated.attackRoutines[0]).toMatchObject({
    single: [
      {
        attackBonus: { total: 9 },
        damageBonus: { total: 4 },
        rangeIncrement: { total: 10 },
      },
    ],
    warnings: [expect.objectContaining({ check: 'unsuitableAttackMode' })],
  });
});

test('throwing a nonproficient longsword applies the improvised nonproficiency penalty once', () => {
  const input = attackSheet();
  const calculated = calculateCharacterSheet({
    ...input,
    entries: input.entries.map((entry) =>
      entry.kind === 'attackRoutine'
        ? { ...entry, state: { ...entry.state, mode: 'thrown' } }
        : entry.kind === 'base'
          ? {
              ...entry,
              state: {
                ...entry.state,
                proficiencies: { added: [], removed: [] },
              },
            }
          : entry,
    ),
  });
  // CRB p. 144: improvised weapons count as nonproficient (-4).
  // BAB +11 and Dexterity +2 therefore give +9, even without sword proficiency.
  expect(calculated.attackRoutines[0]?.single[0]?.attackBonus.total).toBe(9);
  expect(
    calculated.attackRoutines[0]?.full.map((line) => line.attackBonus.total),
  ).toEqual([9]);
});

test.each(['melee', 'ranged'] as const)(
  'a weapon used in an unsuitable %s mode warns but keeps the chosen mode',
  (mode) => {
    const input = attackSheet();
    const calculated = calculateCharacterSheet({
      ...input,
      entries: input.entries.map((entry) =>
        entry.kind === 'attackRoutine'
          ? { ...entry, state: { ...entry.state, mode } }
          : entry,
      ),
      catalogEntries: input.catalogEntries.map((entry) =>
        entry.detail?.kind === 'item' && entry.detail.weapon
          ? {
              ...entry,
              detail: {
                ...entry.detail,
                weapon: {
                  ...entry.detail.weapon,
                  attackType: mode === 'melee' ? 'ranged' : 'melee',
                },
              },
            }
          : entry,
      ),
    });
    expect(calculated.attackRoutines[0]?.single[0]?.mode).toBe(mode);
    expect(calculated.attackRoutines[0]?.warnings).toContainEqual(
      expect.objectContaining({ check: 'unsuitableAttackMode' }),
    );
  },
);

test('grappled keeps invisibility attack modifiers suppressed in routine lines', () => {
  const input = attackSheet();
  const calculated = calculateCharacterSheet(
    {
      ...input,
      entries: [
        ...input.entries,
        ...(['grappled', 'invisible'] as const).map((condition) => ({
          _id: condition,
          kind: 'condition' as const,
          active: true,
          catalogEntryId: condition,
          state: { kind: 'condition' as const },
        })),
      ],
      catalogEntries: [
        ...input.catalogEntries,
        ...(['grappled', 'invisible'] as const).map((condition) => ({
          _id: condition,
          name: condition,
          ruleIdentity: condition,
          modifiers:
            condition === 'invisible'
              ? [
                  {
                    target: 'attack.melee' as const,
                    bonusType: 'untyped' as const,
                    value: 2,
                  },
                ]
              : [],
          detail: { kind: 'condition' as const, conditionKey: condition },
        })),
      ],
    },
    { situations: ['sighted-opponent'] },
  );
  expect(calculated.attackRoutines[0]?.single[0]?.attackBonus.total).toBe(13);
  expect(
    calculated.attackRoutines[0]?.single[0]?.attackBonus.suppressed,
  ).toContainEqual(
    expect.objectContaining({ sheetEntryId: 'invisible', value: 2 }),
  );
});

// #306 composition: owning a weapon is insufficient; its routine's hand use
// selects the bastard sword's named exotic requirement (CRB p. 145).
test('real one-handed exotic routines apply minus four and warn, while two hands use martial training', async () => {
  const { representativeWeaponCatalog } =
    await import('../../convex/lib/representativeWeaponCatalog');
  const input = attackSheet();
  const sheet: CharacterSheetInput = {
    ...input,
    entries: [
      ...input.entries.map((entry) =>
        entry.kind === 'item'
          ? { ...entry, catalogEntryId: 'bastard-sword' }
          : entry,
      ),
      {
        _id: 'two-hands',
        kind: 'attackRoutine',
        active: true,
        state: {
          kind: 'attackRoutine',
          name: 'Two hands',
          weaponEntryId: 'weapon-row',
          hands: 'two',
          mode: 'melee',
        },
      },
    ],
    catalogEntries: [
      ...input.catalogEntries,
      ...representativeWeaponCatalog.map((weapon) => ({
        ...weapon,
        _id: weapon.ruleIdentity,
      })),
    ],
  };
  const calculated = calculateCharacterSheet(sheet);
  expect(
    calculated.attackRoutines.map(
      (routine) => routine.single[0]?.attackBonus.total,
    ),
  ).toEqual([11, 15]);
  expect(calculated.weaponProficiencies).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        entryId: 'weapon-row',
        hands: 'one',
        attackPenalty: -4,
      }),
      expect.objectContaining({
        entryId: 'weapon-row',
        hands: 'two',
        attackPenalty: 0,
      }),
    ]),
  );
  expect(calculated.warnings).toContainEqual(
    expect.objectContaining({
      check: 'oneHandedExotic',
      target: { kind: 'entry', entryId: 'routine' },
    }),
  );
});

test('two one-handed routines for the same exotic weapon each own exactly one warning', async () => {
  const { representativeWeaponCatalog } =
    await import('../../convex/lib/representativeWeaponCatalog');
  const input = attackSheet();
  const calculated = calculateCharacterSheet({
    ...input,
    entries: [
      ...input.entries.map((entry) =>
        entry.kind === 'item'
          ? { ...entry, catalogEntryId: 'bastard-sword' }
          : entry,
      ),
      {
        _id: 'second-routine',
        kind: 'attackRoutine',
        active: true,
        state: {
          kind: 'attackRoutine',
          name: 'Another swing',
          weaponEntryId: 'weapon-row',
          hands: 'one',
          mode: 'melee',
        },
      },
    ],
    catalogEntries: [
      ...input.catalogEntries,
      ...representativeWeaponCatalog.map((weapon) => ({
        ...weapon,
        _id: weapon.ruleIdentity,
      })),
    ],
  });
  expect(
    calculated.attackRoutines.map((routine) =>
      routine.warnings
        .filter((warning) => warning.check === 'oneHandedExotic')
        .map((warning) => warning.subject),
    ),
  ).toEqual([['routine'], ['second-routine']]);
  expect(
    calculated.warnings
      .filter((warning) => warning.check === 'oneHandedExotic')
      .map((warning) => warning.subject),
  ).toEqual(['routine', 'second-routine']);
});

test('routine exotic warnings reopen for relevant proficiency changes and ignore unrelated ones', async () => {
  const { representativeWeaponCatalog } =
    await import('../../convex/lib/representativeWeaponCatalog');
  const input = attackSheet();
  const sheet: CharacterSheetInput = {
    ...input,
    entries: input.entries.map((entry) =>
      entry.kind === 'item'
        ? { ...entry, catalogEntryId: 'bastard-sword' }
        : entry,
    ),
    catalogEntries: [
      ...input.catalogEntries,
      ...representativeWeaponCatalog.map((weapon) => ({
        ...weapon,
        _id: weapon.ruleIdentity,
      })),
    ],
  };
  const fingerprint = (value: CharacterSheetInput) =>
    calculateCharacterSheet(value).attackRoutines[0]?.warnings.find(
      (warning) => warning.check === 'oneHandedExotic',
    )?.fingerprint;
  const before = fingerprint(sheet);
  expect(before).toBeDefined();
  expect(
    fingerprint({
      ...sheet,
      entries: sheet.entries.map((entry) =>
        entry.kind === 'base'
          ? {
              ...entry,
              state: {
                ...entry.state,
                proficiencies: {
                  added: [{ category: 'martial' }, { baseType: 'longbow' }],
                  removed: [],
                },
              },
            }
          : entry,
      ),
    }),
  ).toBe(before);
  expect(
    fingerprint({
      ...sheet,
      entries: sheet.entries.map((entry) =>
        entry.kind === 'base'
          ? {
              ...entry,
              state: {
                ...entry.state,
                proficiencies: {
                  added: [{ category: 'martial' }],
                  removed: [{ baseType: 'bastard sword' }],
                },
              },
            }
          : entry,
      ),
    }),
  ).not.toBe(before);
});

test('armor penalties apply once and weapon enhancement stays local to its routine', () => {
  const input = attackSheet();
  const calculated = calculateCharacterSheet({
    ...input,
    entries: [
      ...input.entries.map((entry) =>
        entry.kind === 'item'
          ? { ...entry, state: { kind: 'item' as const, enhancement: 2 } }
          : entry,
      ),
      {
        _id: 'armor-row',
        kind: 'item',
        active: true,
        catalogEntryId: 'armor',
        state: { kind: 'item' },
      },
      {
        _id: 'plain-weapon',
        kind: 'item',
        active: true,
        catalogEntryId: 'longsword',
        state: { kind: 'item', masterwork: true },
      },
      {
        _id: 'plain-routine',
        kind: 'attackRoutine',
        active: true,
        state: {
          kind: 'attackRoutine',
          name: 'Masterwork sword',
          weaponEntryId: 'plain-weapon',
          hands: 'one',
          mode: 'melee',
        },
      },
    ],
    catalogEntries: [
      ...input.catalogEntries,
      {
        _id: 'armor',
        name: 'Full plate',
        ruleIdentity: 'full-plate',
        modifiers: [],
        detail: {
          kind: 'item',
          armor: { slot: 'armor', category: 'heavy', armorCheckPenalty: 6 },
        },
      },
    ],
  });
  // BAB +11, Str +4, nonproficient full plate -6, enhancements +2/+1.
  expect(
    calculated.attackRoutines.map(
      (routine) => routine.single[0]?.attackBonus.total,
    ),
  ).toEqual([11, 10]);
  expect(
    calculated.attackRoutines.map(
      (routine) => routine.single[0]?.damageBonus.total,
    ),
  ).toEqual([6, 4]);
  expect(
    calculated.attackRoutines[0]?.single[0]?.attackBonus.applied.filter(
      (source) => source.sheetEntryId === 'armor-row',
    ),
  ).toHaveLength(1);
});

test('ranged nonproficiency and conditional formula modifiers use the current sheet projection', async () => {
  const { representativeWeaponCatalog } =
    await import('../../convex/lib/representativeWeaponCatalog');
  const input = attackSheet();
  const calculated = calculateCharacterSheet(
    {
      ...input,
      entries: input.entries.map((entry) =>
        entry.kind === 'item'
          ? { ...entry, catalogEntryId: 'light-crossbow' }
          : entry.kind === 'attackRoutine'
            ? {
                ...entry,
                state: { ...entry.state, mode: 'ranged', hands: 'two' },
              }
            : entry,
      ),
      catalogEntries: [
        ...input.catalogEntries.map((entry) =>
          entry._id === 'bab'
            ? {
                ...entry,
                modifiers: [
                  ...entry.modifiers,
                  {
                    target: 'attack.ranged' as const,
                    bonusType: 'untyped' as const,
                    value: { formula: '@ability.dex.mod' },
                    condition: { situation: { local: 'on high ground' } },
                  },
                ],
              }
            : entry,
        ),
        ...representativeWeaponCatalog.map((weapon) => ({
          ...weapon,
          _id: weapon.ruleIdentity,
        })),
      ],
    },
    { situations: [{ local: 'on high ground', sheetEntryId: 'bab-row' }] },
  );
  expect(calculated.attackRoutines[0]?.single[0]?.attackBonus.total).toBe(11);
  expect(
    calculated.attackRoutines[0]?.single[0]?.attackBonus.applied,
  ).toContainEqual(
    expect.objectContaining({
      entryName: 'Not proficient: Light crossbow',
      target: 'attack.ranged',
      value: -4,
    }),
  );
});

test('an underpowered nonproficient composite bow applies both distinct penalties', async () => {
  const { representativeWeaponCatalog } =
    await import('../../convex/lib/representativeWeaponCatalog');
  const input = attackSheet();
  const calculated = calculateCharacterSheet({
    ...input,
    entries: input.entries.map((entry) =>
      entry.kind === 'base'
        ? { ...entry, state: { kind: 'base' } }
        : entry.kind === 'item'
          ? { ...entry, catalogEntryId: 'composite-longbow-2' }
          : entry.kind === 'attackRoutine'
            ? {
                ...entry,
                state: { ...entry.state, mode: 'ranged', hands: 'two' },
              }
            : entry,
    ),
    catalogEntries: [
      ...input.catalogEntries.map((entry) =>
        entry._id === 'base'
          ? {
              ...entry,
              modifiers: entry.modifiers.map((modifier) =>
                modifier.target === 'ability.str'
                  ? { ...modifier, value: 12 }
                  : modifier,
              ),
            }
          : entry,
      ),
      ...representativeWeaponCatalog.map((weapon) => ({
        ...weapon,
        _id: weapon.ruleIdentity,
      })),
    ],
  });
  // BAB +11, Dex +2, nonproficiency -4, insufficient Strength rating -2.
  expect(calculated.attackRoutines[0]?.single[0]?.attackBonus.total).toBe(7);
});

// CRB Table 8–1: a Small attacker receives a +1 size modifier to attack.
test('routine attack bonuses include the current creature size', () => {
  const calculated = calculateCharacterSheet(attackSheet(), { size: 'small' });
  expect(calculated.attackRoutines[0]?.single[0]?.attackBonus.total).toBe(16);
  expect(
    calculated.attackRoutines[0]?.single[0]?.attackBonus.applied,
  ).toContainEqual(
    expect.objectContaining({ entryName: 'Size', value: 1, bonusType: 'size' }),
  );
});
