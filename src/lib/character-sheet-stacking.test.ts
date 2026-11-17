import { expect, test } from 'vitest';
import {
  calculateCharacterSheet,
  abilityTargets,
  type SourcedModifier,
  type Modifier,
} from './character-sheet';

function calculateBuild(
  modifiers: SourcedModifier[],
  options?: Parameters<typeof calculateCharacterSheet>[1],
) {
  const ids = [...new Set(modifiers.map((item) => item.sheetEntryId))];
  return calculateCharacterSheet(
    {
      characterKind: 'pc',
      entries: [
        {
          _id: 'base-row',
          kind: 'base',
          active: true,
          catalogEntryId: 'base',
          state: { kind: 'base' },
        },
        ...ids.map((_id) => ({
          _id,
          kind: 'manual' as const,
          active: true,
          catalogEntryId: _id,
          state: { kind: 'manual' as const },
        })),
      ],
      catalogEntries: [
        {
          _id: 'base',
          ruleIdentity: 'base',
          modifiers: Object.values(abilityTargets).map(
            (target): Modifier => ({ target, bonusType: 'base', value: 10 }),
          ),
        },
        ...ids.map((_id) => {
          const items = modifiers.filter((item) => item.sheetEntryId === _id);
          if (!items[0]) throw new Error('Missing fixture contribution');
          return {
            _id,
            name: items[0].entryName,
            ruleIdentity: items[0].source,
            stacksWithItself: items[0].stacksWithItself,
            modifiers: items,
          };
        }),
      ],
    },
    options,
  );
}

function resolveBuild(
  modifiers: SourcedModifier[],
  options?: Parameters<typeof calculateCharacterSheet>[1],
) {
  return calculateBuild(modifiers, options).breakdowns;
}

function contribution(
  entry: string,
  value: number,
  overrides: Partial<SourcedModifier> = {},
): SourcedModifier {
  return {
    target: 'save.will',
    bonusType: 'resistance',
    value,
    sheetEntryId: entry,
    entryName: entry,
    source: entry,
    builtIn: false,
    ...overrides,
  };
}

test('CRB Magic, Combining Magical Effects: parent saves compete with leaf bonuses', () => {
  // https://legacy.aonprd.com/coreRulebook/magic.html#combining-magical-effects
  const result = resolveBuild([
    contribution('cloak', 2, { target: 'saves' }),
    contribution('resistance', 1),
  ]);
  expect(result['save.will'].total).toBe(2);
  expect(result['save.fort'].total).toBe(2);
  expect(result['save.ref'].total).toBe(2);
  expect(result['save.will'].applied.map((item) => item.entryName)).toEqual([
    'cloak',
  ]);
  expect(result['save.will'].suppressed).toEqual([
    expect.objectContaining({ entryName: 'resistance', suppressedBy: 'cloak' }),
  ]);
});

// Each row cites its bonus authority; typed penalties follow #209's CRB p. 208 resolution.
test.each([
  [
    'alchemical',
    4,
    'CRB p. 208: https://legacy.aonprd.com/coreRulebook/magic.html#combining-magical-effects',
  ],
  [
    'armor',
    4,
    'CRB p. 208: https://legacy.aonprd.com/coreRulebook/magic.html#combining-magical-effects',
  ],
  [
    'circumstance',
    6,
    'CRB p. 208: https://legacy.aonprd.com/coreRulebook/magic.html#combining-magical-effects',
  ],
  [
    'competence',
    4,
    'CRB p. 208: https://legacy.aonprd.com/coreRulebook/magic.html#combining-magical-effects',
  ],
  [
    'deflection',
    4,
    'CRB p. 208: https://legacy.aonprd.com/coreRulebook/magic.html#combining-magical-effects',
  ],
  [
    'dodge',
    6,
    'CRB p. 208: https://legacy.aonprd.com/coreRulebook/magic.html#combining-magical-effects',
  ],
  [
    'enhancement',
    4,
    'CRB p. 208: https://legacy.aonprd.com/coreRulebook/magic.html#combining-magical-effects',
  ],
  [
    'inherent',
    4,
    'CRB p. 208: https://legacy.aonprd.com/coreRulebook/magic.html#combining-magical-effects',
  ],
  [
    'insight',
    4,
    'CRB p. 208: https://legacy.aonprd.com/coreRulebook/magic.html#combining-magical-effects',
  ],
  [
    'luck',
    4,
    'CRB p. 208: https://legacy.aonprd.com/coreRulebook/magic.html#combining-magical-effects',
  ],
  [
    'morale',
    4,
    'CRB p. 208: https://legacy.aonprd.com/coreRulebook/magic.html#combining-magical-effects',
  ],
  [
    'naturalArmor',
    4,
    'CRB p. 208: https://legacy.aonprd.com/coreRulebook/magic.html#combining-magical-effects',
  ],
  [
    'profane',
    4,
    'CRB p. 208: https://legacy.aonprd.com/coreRulebook/magic.html#combining-magical-effects',
  ],
  [
    'racial',
    6,
    'CRB p. 208: https://legacy.aonprd.com/coreRulebook/magic.html#combining-magical-effects',
  ],
  [
    'resistance',
    4,
    'CRB p. 208: https://legacy.aonprd.com/coreRulebook/magic.html#combining-magical-effects',
  ],
  [
    'sacred',
    4,
    'CRB p. 208: https://legacy.aonprd.com/coreRulebook/magic.html#combining-magical-effects',
  ],
  [
    'shield',
    4,
    'CRB p. 208: https://legacy.aonprd.com/coreRulebook/magic.html#combining-magical-effects',
  ],
  [
    'size',
    4,
    'CRB p. 208: https://legacy.aonprd.com/coreRulebook/magic.html#combining-magical-effects',
  ],
  [
    'trait',
    4,
    'APG p. 326: https://www.aonprd.com/Rules.aspx?Name=Traits&Category=Basics; typed penalties follow #209',
  ],
  [
    'untyped',
    6,
    'CRB p. 208: https://legacy.aonprd.com/coreRulebook/magic.html#combining-magical-effects',
  ],
  [
    'base',
    4,
    '#251 §2 and data-model Stacking: internal base type is highest-only; typed penalties follow #209',
  ],
] as const)(
  'stacking for %s bonuses gives %s (%s)',
  (bonusType, total, _citation) => {
    expect(
      resolveBuild([
        contribution('one', 2, { bonusType }),
        contribution('two', 4, { bonusType }),
      ])['save.will'].total,
    ).toBe(total);
    expect(
      resolveBuild([
        contribution('one', -2, { bonusType }),
        contribution('two', -4, { bonusType }),
        contribution('bonus', 3, { bonusType }),
      ])['save.will'].total,
    ).toBe(bonusType === 'untyped' ? -3 : -1);
  },
);

test('same Source keeps the greatest net entry across types before type stacking', () => {
  // #251 §8 / #209 resolution: https://github.com/AndreasUnunger/EverythingPath/issues/251
  const result = resolveBuild([
    contribution('original', 8, { source: 'shared', bonusType: 'morale' }),
    contribution('original', -5, { source: 'shared', bonusType: 'untyped' }),
    contribution('copy', 4, { source: 'shared', bonusType: 'luck' }),
    contribution('other', 6, { bonusType: 'luck' }),
  ])['save.will'];
  expect(result.total).toBe(6);
  expect(
    result.suppressed.filter((item) => item.sheetEntryId === 'original'),
  ).toHaveLength(2);
  expect(
    result.suppressed.find((item) => item.sheetEntryId === 'original')
      ?.suppressedBy,
  ).toBe('copy');
});

test('Elixir of the Peaks adds its curated mountain bonus before comparing competence', () => {
  // #230 resolution, Elixir of the Peaks: https://aonprd.com/MagicWondrousDisplay.aspx?FinalName=Elixir%20of%20the%20Peaks
  const result = resolveBuild([
    contribution('elixir', 2, { bonusType: 'competence' }),
    contribution('elixir', 1, { bonusType: 'competence' }),
    contribution('elixir', 10, {
      bonusType: 'competence',
      stacksWithinEntry: true,
    }),
    contribution('other', 11, { bonusType: 'competence' }),
  ])['save.will'];
  expect(result.total).toBe(12);
  expect(result.applied.map((item) => item.value)).toEqual([2, 10]);
  expect(
    result.suppressed.map((item) => item.value).sort((a, b) => a - b),
  ).toEqual([1, 11]);
});

test.each([
  {
    name: 'haste, boots of speed and speed',
    self: false,
    total: 1,
    source: 'https://legacy.aonprd.com/coreRulebook/spells/haste.html',
  },
  {
    name: 'explicitly stacking sneak attack',
    self: true,
    total: 3,
    source:
      'https://legacy.aonprd.com/coreRulebook/prestigeClasses/arcaneTrickster.html',
  },
])('$name uses its shared Source ($source)', ({ self, total }) => {
  expect(
    resolveBuild(
      ['spell', 'boots', 'weapon'].map((entry) =>
        contribution(entry, 1, {
          source: 'shared-effect',
          bonusType: 'untyped',
          stacksWithItself: self,
        }),
      ),
    )['save.will'].total,
  ).toBe(total);
});

test('Superstition replaces the raging morale bonus only in its Situation', () => {
  // https://aonprd.com/BarbarianRagePowers.aspx?Type=Offensive (Superstition); #251 §8.
  const modifiers = [
    contribution('rage', 2, { bonusType: 'morale' }),
    contribution('superstition', 3, {
      bonusType: 'morale',
      condition: { situation: 'spells', whileActive: 'rage' },
    }),
  ];
  const ordinary = resolveBuild(modifiers)['save.will'];
  expect(ordinary.total).toBe(2);
  expect(ordinary.conditional).toEqual([
    expect.objectContaining({ entryName: 'superstition' }),
  ]);
  const situational = resolveBuild(modifiers, { situations: ['spells'] })[
    'save.will'
  ];
  expect(situational.total).toBe(3);
  expect(situational.suppressed).toEqual([
    expect.objectContaining({ entryName: 'rage' }),
  ]);
  expect(
    resolveBuild(modifiers.slice(1), { situations: ['spells'] })['save.will']
      .total,
  ).toBe(0);
});

test('local Situations belong to one entry and matching words do not activate another', () => {
  // #251 §8 and model Conditional Modifiers: local Situations match nothing else.
  const modifiers = ['one', 'two'].map((entry) =>
    contribution(entry, 2, {
      bonusType: 'untyped',
      condition: { situation: { local: 'on high ground' } },
    }),
  );
  const result = resolveBuild(modifiers, {
    situations: [{ local: 'on high ground', sheetEntryId: 'one' }],
  })['save.will'];
  expect(result.total).toBe(2);
  expect(result.conditional.map((item) => item.sheetEntryId)).toEqual(['two']);
});

test('every parent expands to its closed leaves and armor enhancements remain separate', () => {
  // #209 resolution: https://legacy.aonprd.com/coreRulebook/magicItems/armor.html
  const result = resolveBuild([
    contribution('armor', 2, { target: 'ac.armor', bonusType: 'enhancement' }),
    contribution('shield', 3, {
      target: 'ac.shield',
      bonusType: 'enhancement',
    }),
    contribution('natural', 1, {
      target: 'ac.natural',
      bonusType: 'enhancement',
    }),
    contribution('other', 4, { target: 'ac', bonusType: 'deflection' }),
    contribution('attacks', 2, { target: 'attack' }),
    contribution('damage', 3, { target: 'damage' }),
    contribution('skills', 5, { target: 'skills' }),
    contribution('perception', 4, { target: 'skill.per' }),
  ]);
  expect(result['ac.armor'].total).toBe(2);
  expect(result['ac.shield'].total).toBe(3);
  expect(result['ac.natural'].total).toBe(1);
  expect(result['ac.other'].total).toBe(4);
  expect(result['attack.melee'].total).toBe(2);
  expect(result['attack.ranged'].total).toBe(2);
  expect(result['damage.melee'].total).toBe(3);
  expect(result['damage.ranged'].total).toBe(3);
  expect(result['skill.per'].total).toBe(5);
  expect(result['skill.acr'].total).toBe(5);
});

test('CRB AC, touch, flat-footed AC and CMD compose eligible contributions including penalties', () => {
  // https://legacy.aonprd.com/coreRulebook/combat.html#armor-class
  // https://legacy.aonprd.com/coreRulebook/combat.html#combat-maneuver-defense
  const result = calculateBuild([
    contribution('dex', 4, { target: 'ability.dex', bonusType: 'enhancement' }),
    contribution('str', 2, { target: 'ability.str', bonusType: 'enhancement' }),
    contribution('bab', 3, { target: 'bab', bonusType: 'base' }),
    // Equipment identifies the base's recipient before enhancements compose.
    contribution('armor', 6, {
      target: 'ac.armor',
      bonusType: 'armor',
      armorItem: { entryId: 'armor', component: 'base' },
    }),
    contribution('armor-magic', 2, {
      target: 'ac.armor',
      bonusType: 'enhancement',
    }),
    contribution('shield', 2, {
      target: 'ac.shield',
      bonusType: 'shield',
      armorItem: { entryId: 'shield', component: 'base' },
    }),
    contribution('shield-magic', 1, {
      target: 'ac.shield',
      bonusType: 'enhancement',
    }),
    contribution('natural', 1, {
      target: 'ac.natural',
      bonusType: 'naturalArmor',
    }),
    contribution('dodge', 1, { target: 'ac', bonusType: 'dodge' }),
    contribution('ring', 2, { target: 'ac', bonusType: 'deflection' }),
    contribution('misc', 4, { target: 'ac', bonusType: 'untyped' }),
    contribution('penalty', -2, { target: 'ac', bonusType: 'untyped' }),
    contribution('future-dodge', 2, {
      target: 'ac',
      bonusType: 'dodge',
      condition: { situation: 'traps' },
    }),
  ]).derivedStatistics;
  expect(result.ac.total).toBe(29);
  expect(result.touchAc.total).toBe(17);
  expect(result.flatFootedAc.total).toBe(26);
  expect(result.cmd.total).toBe(17);
  expect(result.flatFootedCmd.total).toBe(15);
  expect(result.touchAc.conditional.map((item) => item.entryName)).toEqual([
    'future-dodge',
  ]);
  expect(result.cmd.conditional.map((item) => item.entryName)).toEqual([
    'future-dodge',
  ]);
  expect(result.flatFootedAc.conditional).toEqual([]);
  expect(
    result.flatFootedCmd.applied.some((item) => item.entryName === 'dodge'),
  ).toBe(true);
});

test('CRB CMD uses its special size modifier without the AC size penalty', () => {
  // https://legacy.aonprd.com/coreRulebook/combat.html#combat-maneuver-defense
  const result = calculateBuild([
    contribution('large', -1, { target: 'ac', bonusType: 'size' }),
  ]).derivedStatistics;
  expect(result.ac.total).toBe(9);
  expect(result.cmd.total).toBe(10);
  expect(result.flatFootedCmd.total).toBe(10);
  expect(result.cmd.suppressed).toContainEqual(
    expect.objectContaining({ entryName: 'large', bonusType: 'size' }),
  );

  const withSpecialSize = calculateBuild([
    contribution('large', -1, { target: 'ac', bonusType: 'size' }),
    contribution('large', 1, { target: 'cmd', bonusType: 'size' }),
  ]).derivedStatistics;
  expect(withSpecialSize.cmd.total).toBe(11);
});

test('flat-footed defenses retain Dexterity penalties and CMD receives eligible AC penalty types', () => {
  // CRB Combat, Armor Class and Combat Maneuver Defense (same sources as the composition fixture).
  const result = calculateBuild([
    contribution('dex', -4, { target: 'ability.dex', bonusType: 'untyped' }),
    contribution('armor-penalty', -2, {
      target: 'ac.armor',
      bonusType: 'armor',
    }),
    contribution('dodge-penalty', -1, { target: 'ac', bonusType: 'dodge' }),
    contribution('circumstance-penalty', -3, {
      target: 'ac',
      bonusType: 'circumstance',
    }),
  ]).derivedStatistics;
  expect(result.ac.total).toBe(2);
  expect(result.flatFootedAc.total).toBe(2);
  expect(result.cmd.total).toBe(2);
  expect(result.flatFootedCmd.total).toBe(2);
  expect(
    result.cmd.applied
      .filter((item) => !item.builtIn)
      .map((item) => item.value)
      .sort(),
  ).toEqual([-1, -2, -3]);
});

test.each([
  {
    name: 'one entry penalizes two AC leaves',
    modifiers: [
      contribution('adjustment', -2, {
        target: 'ac.armor',
        bonusType: 'untyped',
      }),
      contribution('adjustment', -2, {
        target: 'ac.shield',
        bonusType: 'untyped',
      }),
    ],
    total: 6,
    applied: 2,
    suppressed: 0,
  },
  {
    name: 'one Source supplies entries on different AC leaves',
    modifiers: [
      contribution('armor', -2, {
        target: 'ac.armor',
        bonusType: 'untyped',
        source: 'shared',
      }),
      contribution('shield', -3, {
        target: 'ac.shield',
        bonusType: 'untyped',
        source: 'shared',
      }),
    ],
    total: 5,
    applied: 2,
    suppressed: 0,
  },
  {
    name: 'one penalty type applies on different AC leaves',
    modifiers: [
      contribution('armor', -2, { target: 'ac.armor', bonusType: 'armor' }),
      contribution('shield', -3, { target: 'ac.shield', bonusType: 'armor' }),
    ],
    total: 7,
    applied: 1,
    suppressed: 1,
  },
  {
    name: 'an admitted AC bonus and direct CMD bonus share an entry and type',
    modifiers: [
      contribution('adjustment', 2, { target: 'ac', bonusType: 'deflection' }),
      contribution('adjustment', 3, { target: 'cmd', bonusType: 'deflection' }),
    ],
    total: 13,
    applied: 1,
    suppressed: 1,
  },
  {
    name: 'an admitted AC bonus and direct CMD bonus come from different entries',
    modifiers: [
      contribution('ring', 2, { target: 'ac', bonusType: 'deflection' }),
      contribution('protection', 3, { target: 'cmd', bonusType: 'deflection' }),
    ],
    total: 13,
    applied: 1,
    suppressed: 1,
  },
  {
    name: 'a typed AC penalty competes with a direct CMD penalty',
    modifiers: [
      contribution('armor', -2, { target: 'ac.armor', bonusType: 'armor' }),
      contribution('exposed', -3, { target: 'cmd', bonusType: 'armor' }),
    ],
    total: 7,
    applied: 1,
    suppressed: 1,
  },
  {
    name: 'ordinary same-entry bonuses compete with a stronger third entry',
    modifiers: [
      contribution('adjustment', 2, { target: 'ac', bonusType: 'deflection' }),
      contribution('adjustment', 3, { target: 'cmd', bonusType: 'deflection' }),
      contribution('protection', 4, {
        target: 'ac.natural',
        bonusType: 'deflection',
      }),
    ],
    total: 14,
    applied: 1,
    suppressed: 2,
  },
])(
  'CMD applies CRB stacking to admitted contributions when $name',
  ({ modifiers, total, applied, suppressed }) => {
    // CRB p. 208: https://legacy.aonprd.com/coreRulebook/magic.html#combining-magical-effects
    const result = calculateBuild(modifiers).derivedStatistics;
    for (const statistic of [result.cmd, result.flatFootedCmd]) {
      expect(statistic.total).toBe(total);
      expect(statistic.applied.filter((item) => !item.builtIn)).toHaveLength(
        applied,
      );
      expect(statistic.suppressed).toHaveLength(suppressed);
      if (suppressed)
        expect(statistic.suppressed[0]).toEqual(
          expect.objectContaining({ value: modifiers[0]?.value }),
        );
    }
  },
);

test('CMD retains explicit same-entry stacking before comparing competing bonus entries', () => {
  // #209 CRB p. 208 resolution: https://legacy.aonprd.com/coreRulebook/magic.html#combining-magical-effects
  const result = calculateBuild([
    contribution('adjustment', 2, {
      target: 'ac',
      bonusType: 'deflection',
      stacksWithinEntry: true,
    }),
    contribution('adjustment', 3, {
      target: 'cmd',
      bonusType: 'deflection',
      stacksWithinEntry: true,
    }),
    contribution('protection', 4, {
      target: 'ac.natural',
      bonusType: 'deflection',
    }),
  ]).derivedStatistics;
  for (const statistic of [result.cmd, result.flatFootedCmd]) {
    expect(statistic.total).toBe(15);
    expect(statistic.applied.filter((item) => !item.builtIn)).toEqual([
      expect.objectContaining({ sheetEntryId: 'adjustment', value: 2 }),
      expect.objectContaining({ sheetEntryId: 'adjustment', value: 3 }),
    ]);
    expect(statistic.suppressed).toEqual([
      expect.objectContaining({
        sheetEntryId: 'protection',
        value: 4,
        suppressedBy: 'adjustment',
      }),
    ]);
  }
});

test('shared haste Source overrides distinct rule identities, while inactive effects stay out', () => {
  // CRB haste: https://legacy.aonprd.com/coreRulebook/spells/haste.html
  const result = calculateCharacterSheet({
    characterKind: 'pc',
    entries: [
      {
        _id: 'base-row',
        kind: 'base',
        active: true,
        catalogEntryId: 'base',
        state: { kind: 'base' },
      },
      {
        _id: 'haste',
        kind: 'manual',
        active: true,
        catalogEntryId: 'haste',
        state: { kind: 'manual' },
      },
      {
        _id: 'boots',
        kind: 'manual',
        active: true,
        catalogEntryId: 'boots',
        state: { kind: 'manual' },
      },
      {
        _id: 'off',
        kind: 'manual',
        active: false,
        catalogEntryId: 'off',
        state: { kind: 'manual' },
      },
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: Object.values(abilityTargets).map(
          (target): Modifier => ({ target, bonusType: 'base', value: 10 }),
        ),
      },
      {
        _id: 'haste',
        ruleIdentity: 'spell:haste',
        sourceKey: 'haste',
        modifiers: [{ target: 'ac', bonusType: 'dodge', value: 1 }],
      },
      {
        _id: 'boots',
        ruleIdentity: 'item:boots',
        sourceKey: 'haste',
        modifiers: [{ target: 'ac', bonusType: 'dodge', value: 1 }],
      },
      {
        _id: 'off',
        ruleIdentity: 'off',
        modifiers: [{ target: 'ac', bonusType: 'dodge', value: 20 }],
      },
    ],
  });
  expect(result.derivedStatistics.ac.total).toBe(11);
  expect(result.breakdowns['ac.other'].suppressed).toEqual([
    expect.objectContaining({ sheetEntryId: 'boots', suppressedBy: 'haste' }),
  ]);
  expect(result.breakdowns['ac.other'].conditional).toEqual([]);
});

test('All AC armor, shield and natural armor bonuses stay out of touch AC', () => {
  // CRB Combat, Touch Attacks: armor, shield and natural armor do not apply.
  // https://legacy.aonprd.com/coreRulebook/combat.html#touch-attacks
  const result = calculateBuild([
    contribution('armor', 6, { target: 'ac', bonusType: 'armor' }),
    contribution('shield', 2, { target: 'ac', bonusType: 'shield' }),
    contribution('natural', 3, { target: 'ac', bonusType: 'naturalArmor' }),
    contribution('ring', 1, { target: 'ac', bonusType: 'deflection' }),
  ]);
  expect(result.derivedStatistics.ac.total).toBe(22);
  expect(result.derivedStatistics.touchAc.total).toBe(11);
  expect(result.breakdowns['ac.armor'].total).toBe(6);
  expect(result.breakdowns['ac.shield'].total).toBe(2);
  expect(result.breakdowns['ac.natural'].total).toBe(3);
  expect(
    result.derivedStatistics.touchAc.suppressed.map((item) => item.entryName),
  ).toEqual(['armor', 'shield', 'natural']);
});

test.each(['armor', 'shield', 'naturalArmor'] as const)(
  'direct ac.other %s Modifiers stay out of touch AC and its conditional preview',
  (bonusType) => {
    // CRB Combat, Touch Attacks: armor, shield and natural armor do not apply.
    // CMD retains all AC penalties: https://legacy.aonprd.com/coreRulebook/combat.html#combat-maneuver-defense
    // https://legacy.aonprd.com/coreRulebook/combat.html#touch-attacks
    const modifiers = [
      contribution('protection', 6, { target: 'ac.other', bonusType }),
      contribution('penalty', -2, { target: 'ac.other', bonusType }),
      contribution('ring', 1, { target: 'ac.other', bonusType: 'deflection' }),
      contribution('future-protection', 3, {
        target: 'ac.other',
        bonusType,
        condition: { situation: 'traps' },
      }),
      contribution('future-ring', 2, {
        target: 'ac.other',
        bonusType: 'deflection',
        condition: { situation: 'traps' },
      }),
    ];
    const ordinary = calculateBuild(modifiers).derivedStatistics;
    expect(ordinary.touchAc.total).toBe(11);
    expect(ordinary.ac.total).toBe(15);
    expect(ordinary.flatFootedAc.total).toBe(15);
    expect(ordinary.cmd.total).toBe(9);
    expect(ordinary.flatFootedCmd.total).toBe(9);
    expect(ordinary.touchAc.conditional.map((item) => item.entryName)).toEqual([
      'future-ring',
    ]);
    expect(ordinary.touchAc.suppressed.map((item) => item.entryName)).toEqual([
      'protection',
      'penalty',
    ]);
    const preview = calculateBuild(modifiers, {
      situations: ['traps'],
    }).derivedStatistics;
    expect(preview.touchAc.total).toBe(12);
    expect(preview.ac.total).toBe(16);
    expect(preview.cmd.total).toBe(10);
  },
);

test('same Source retains the most severe negative net after resolving each entry', () => {
  // CRB Magic: same spell of different strengths keeps the highest strength;
  // typed penalties take the worst. #209 identifies the broader ambiguity.
  // https://legacy.aonprd.com/coreRulebook/magic.html#combining-magical-effects
  const result = resolveBuild([
    contribution('weaker', -2, { source: 'shared', bonusType: 'untyped' }),
    contribution('stronger', 3, { source: 'shared', bonusType: 'morale' }),
    contribution('stronger', -8, { source: 'shared', bonusType: 'untyped' }),
  ])['save.will'];
  expect(result.total).toBe(-5);
  expect(result.applied.map((item) => item.value)).toEqual([3, -8]);
  expect(result.suppressed).toEqual([
    expect.objectContaining({
      sheetEntryId: 'weaker',
      suppressedBy: 'stronger',
    }),
  ]);
});

test.each([
  { values: [-5, 2], total: 2, winner: 'second' },
  { values: [0, -5], total: -5, winner: 'second' },
])(
  'same Source distinguishes positive nets from nonpositive nets: $values',
  ({ values, total, winner }) => {
    // #251 §8 greatest net; CRB p. 208 worst penalty refines nonpositive nets.
    // https://legacy.aonprd.com/coreRulebook/magic.html#combining-magical-effects
    const result = resolveBuild([
      contribution('first', values[0] ?? 0, {
        source: 'shared',
        bonusType: 'untyped',
      }),
      contribution('second', values[1] ?? 0, {
        source: 'shared',
        bonusType: 'untyped',
      }),
    ])['save.will'];
    expect(result.total).toBe(total);
    expect(result.applied.map((item) => item.sheetEntryId)).toEqual([winner]);
  },
);
