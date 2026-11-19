// rotation-5 part A (stats-d2 follow-ups, root decision): a Modifier
// condition lost only while body armor is worn. The monk's Fast Movement:
// "A monk in armor or carrying a medium or heavy load loses this extra speed"
// (PRD coreRulebook/classes/monk.html:405); load stays a Note (owner
// 2026-11-17). `armorAtMost: 'none'` applies with no armor item active,
// whatever shield is held and whatever Condition applies, and is suppressed
// with a visible reason while any body armor is active. `unarmored` stays as
// it is: it also drops with a shield or a helpless-type Condition, which the
// monk's AC bonus needs (monk.html:384). Fixtures have the imported shape:
// Foundry fast-movement-mnk.CK5L0YJDENqBxLqv as stats-d2's reviewed
// replacement gives it (enhancement), a Foundry shield and armor item, and the
// sheet's Helpless condition.
import { expect, test } from 'vitest';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  modifierConditionSchema,
  personalAdjustmentConditionSchema,
  resolveSheet,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
  type InputSourcedModifier,
  type SheetEntry,
} from './character-sheet';
import { getConditionDefinition } from './character-sheet-conditions';
import { outputSchema } from './catalog/curation-output-schema';
import { importedCatalogEntrySchema } from './catalog/imported-entry-schema';

const item = (
  id: string,
  name: string,
  armor: {
    slot: 'armor' | 'shield';
    category?: 'light' | 'medium' | 'heavy' | 'heavyShield' | 'other';
  },
): CharacterSheetCatalogEntry => ({
  _id: id,
  name,
  ruleIdentity: `pf1/${id}`,
  modifiers: [],
  detail: {
    kind: 'item',
    armor: {
      ...armor,
      bonus: 2,
      maxDex: null,
      armorCheckPenalty: 1,
      asf: 10,
    },
  },
});

const catalog: CharacterSheetCatalogEntry[] = [
  {
    _id: 'base',
    ruleIdentity: 'base',
    modifiers: abilityKeys.map((key) => ({
      target: abilityTargets[key],
      bonusType: 'base',
      value: 10,
    })),
  },
  {
    _id: 'human',
    ruleIdentity: 'pf1/human',
    name: 'Human',
    modifiers: [{ target: 'speed.land', bonusType: 'base', value: 30 }],
    detail: { kind: 'race', racialTraits: [] },
  },
  {
    // The monk's Fast Movement at Monk 3: +10 enhancement, lost in armor.
    _id: 'fast-movement',
    ruleIdentity: 'pf1/CK5L0YJDENqBxLqv',
    name: 'Fast Movement',
    modifiers: [
      {
        target: 'speed.land',
        bonusType: 'enhancement',
        value: 10,
        condition: { armorAtMost: 'none' },
      },
    ],
    detail: { kind: 'classFeature' },
  },
  {
    // The same Modifier under `unarmored`, for comparison.
    _id: 'unarmored-movement',
    ruleIdentity: 'fixture/unarmored-movement',
    name: 'Unarmored movement',
    modifiers: [
      {
        target: 'speed.land',
        bonusType: 'untyped',
        value: 5,
        condition: { unarmored: true },
      },
    ],
    detail: { kind: 'classFeature' },
  },
  item('heavy-shield', 'Heavy steel shield', {
    slot: 'shield',
    category: 'heavyShield',
  }),
  item('leather', 'Leather armor', { slot: 'armor', category: 'light' }),
  item('chainmail', 'Chainmail', { slot: 'armor', category: 'medium' }),
  item('full-plate', 'Full plate', { slot: 'armor', category: 'heavy' }),
  // Body armor the item editor saved with a blank category, and one whose
  // category is `other`: still armor (fix r1).
  item('blank-armor', 'Mystery mail', { slot: 'armor' }),
  item('other-armor', 'Bone plates', { slot: 'armor', category: 'other' }),
  {
    _id: 'helpless',
    ruleIdentity: getConditionDefinition('helpless').ruleIdentity,
    name: 'Helpless',
    modifiers: [],
    detail: { kind: 'condition', conditionKey: 'helpless' },
  },
];

const entry = (
  catalogEntryId: string,
  kind: 'race' | 'item' | 'classFeature' | 'condition',
): SheetEntry =>
  ({
    _id: `${catalogEntryId}-row`,
    kind,
    active: true,
    catalogEntryId,
    state: { kind },
  }) as SheetEntry;

function sheet(extra: SheetEntry[]): CharacterSheetInput {
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
      entry('human', 'race'),
      entry('fast-movement', 'classFeature'),
      entry('unarmored-movement', 'classFeature'),
      ...extra,
    ],
    catalogEntries: catalog,
  };
}

const speed = (input: CharacterSheetInput) =>
  calculateCharacterSheet(input).derivedStatistics.landSpeed;

test('with no armor and no shield both apply: 30 + 10 + 5', () => {
  expect(speed(sheet([]))?.total).toBe(45);
});

test('no armor with a shield: the armor-only condition applies, `unarmored` is lost', () => {
  const result = speed(sheet([entry('heavy-shield', 'item')]));
  expect(result?.total).toBe(40);
  expect(result?.applied.map(({ entryName }) => entryName)).toContain(
    'Fast Movement',
  );
  expect(result?.suppressed).toEqual([
    expect.objectContaining({
      entryName: 'Unarmored movement',
      reason: 'Lost while carrying Heavy steel shield.',
    }),
  ]);
});

test('light armor: suppressed with the reason shown', () => {
  const result = speed(sheet([entry('leather', 'item')]));
  expect(result?.total).toBe(30);
  expect(result?.suppressed).toContainEqual(
    expect.objectContaining({
      entryName: 'Fast Movement',
      value: 10,
      suppressedBy: 'leather-row',
      reason: 'Lost while wearing Leather armor (light armor).',
    }),
  );
});

test('body armor with no category: suppressed with the reason shown', () => {
  const result = speed(sheet([entry('blank-armor', 'item')]));
  expect(result?.total).toBe(30);
  expect(result?.suppressed).toContainEqual(
    expect.objectContaining({
      entryName: 'Fast Movement',
      value: 10,
      suppressedBy: 'blank-armor-row',
      reason:
        'Lost while wearing Mystery mail (its armor category is unknown).',
    }),
  );
});

test('body armor of category `other`: suppressed with the reason shown', () => {
  const result = speed(sheet([entry('other-armor', 'item')]));
  expect(result?.total).toBe(30);
  expect(result?.suppressed).toContainEqual(
    expect.objectContaining({
      entryName: 'Fast Movement',
      suppressedBy: 'other-armor-row',
      reason: 'Lost while wearing Bone plates (its armor category is unknown).',
    }),
  );
});

test('a shield beside uncategorised body armor: the armor names the loss', () => {
  const result = speed(
    sheet([entry('heavy-shield', 'item'), entry('blank-armor', 'item')]),
  );
  expect(result?.suppressed).toContainEqual(
    expect.objectContaining({
      entryName: 'Fast Movement',
      suppressedBy: 'blank-armor-row',
    }),
  );
});

test('a helpless character with no armor: the armor-only condition applies', () => {
  const result = speed(sheet([entry('helpless', 'condition')]));
  expect(result?.applied.map(({ entryName }) => entryName)).toContain(
    'Fast Movement',
  );
  expect(result?.suppressed).toEqual([
    expect.objectContaining({
      entryName: 'Unarmored movement',
      reason: 'Lost while Helpless.',
    }),
  ]);
});

test('armor switched off does not count', () => {
  const off = { ...entry('leather', 'item'), active: false } as SheetEntry;
  expect(speed(sheet([off]))?.total).toBe(45);
});

test('every schema that lists the condition’s values takes `none`; a personal adjustment refuses it', () => {
  for (const limit of ['none', 'light', 'medium'] as const) {
    expect(
      modifierConditionSchema.safeParse({ armorAtMost: limit }).success,
    ).toBe(true);
    expect(
      outputSchema.safeParse({
        kind: 'modifier',
        target: 'speed.land',
        bonusType: 'enhancement',
        value: 10,
        condition: { armorAtMost: limit },
      }).success,
    ).toBe(true);
    // Release staging, discovery and candidate reads parse this schema.
    expect(
      importedCatalogEntrySchema.shape.modifiers.safeParse([
        {
          target: 'speed.land',
          bonusType: 'enhancement',
          value: 10,
          condition: { armorAtMost: limit },
        },
      ]).success,
    ).toBe(true);
  }
  expect(
    modifierConditionSchema.safeParse({ armorAtMost: 'heavy' }).success,
  ).toBe(false);
  expect(
    outputSchema.safeParse({
      kind: 'modifier',
      target: 'speed.land',
      bonusType: 'enhancement',
      value: 10,
      condition: { armorAtMost: 'heavy' },
    }).success,
  ).toBe(false);
  expect(
    personalAdjustmentConditionSchema.safeParse({ armorAtMost: 'none' })
      .success,
  ).toBe(false);
});

// fix r2, root's decision (2026-11-18): the rules grant an `armorAtMost`
// bonus only in armor *known* to qualify (the barbarian's Fast Movement,
// "while wearing no armor, light armor, or medium armor", PRD
// coreRulebook/classes/barbarian.html:381; Fleet, "while wearing light or no
// armor"), so an active body armor item of no known category loses
// `light` and `medium` too, with a reason that says its category is unknown.
// Fixtures: the stats-d2 rows' shapes, Fast Movement (+10, at most medium)
// and Fleet (+5, at most light).
const atMost = ({
  id,
  name,
  value,
  limit,
}: {
  id: string;
  name: string;
  value: number;
  limit: 'light' | 'medium';
}): CharacterSheetCatalogEntry => ({
  _id: id,
  ruleIdentity: `fixture/${id}`,
  name,
  modifiers: [
    {
      target: 'speed.land',
      bonusType: 'untyped',
      value,
      condition: { armorAtMost: limit },
    },
  ],
  detail: { kind: 'classFeature' },
});
function limitsSheet(armor: string[]): CharacterSheetInput {
  const input = sheet(armor.map((id) => entry(id, 'item')));
  return {
    ...input,
    entries: [
      ...input.entries,
      entry('barbarian-fast-movement', 'classFeature'),
      entry('fleet', 'classFeature'),
    ],
    catalogEntries: [
      ...input.catalogEntries,
      atMost({
        id: 'barbarian-fast-movement',
        name: 'Barbarian fast movement',
        value: 10,
        limit: 'medium',
      }),
      atMost({ id: 'fleet', name: 'Fleet', value: 5, limit: 'light' }),
    ],
  };
}
const limits = (armor: string[]) => {
  const result = speed(limitsSheet(armor));
  const named = new Set(['Barbarian fast movement', 'Fleet']);
  return {
    total: result?.total,
    applied: result?.applied
      .map(({ entryName }) => entryName)
      .filter((name) => named.has(name)),
    suppressed: result?.suppressed
      .filter(({ entryName }) => named.has(entryName))
      .map(({ entryName, suppressedBy, reason }) => ({
        entryName,
        suppressedBy,
        reason,
      })),
  };
};

test.each<[string, string, string]>([
  ['no category', 'blank-armor', 'Mystery mail'],
  ['category `other`', 'other-armor', 'Bone plates'],
])(
  'body armor of %s loses `light` and `medium`, the reason saying its category is unknown',
  (_, armor, name) => {
    const reason = `Lost while wearing ${name} (its armor category is unknown).`;
    expect(limits([armor])).toEqual({
      // 30: both monk Modifiers are lost too, as before.
      total: 30,
      applied: [],
      suppressed: [
        {
          entryName: 'Barbarian fast movement',
          suppressedBy: `${armor}-row`,
          reason,
        },
        { entryName: 'Fleet', suppressedBy: `${armor}-row`, reason },
      ],
    });
  },
);

test('light armor beside uncategorised body armor: the unknown one loses `light` and `medium`, its reason alone', () => {
  const reason =
    'Lost while wearing Mystery mail (its armor category is unknown).';
  expect(limits(['leather', 'blank-armor'])).toEqual({
    total: 30,
    applied: [],
    suppressed: [
      {
        entryName: 'Barbarian fast movement',
        suppressedBy: 'blank-armor-row',
        reason,
      },
      { entryName: 'Fleet', suppressedBy: 'blank-armor-row', reason },
    ],
  });
});

// fix r3 (both round 3 reviewers): the reason names every active body armor
// item that loses the limit, in sheet order: a known one heavier than the
// limit by its category, an uncategorised one as unknown. The sheet can have
// two suits active: equipping one leaves the other as it was.
const lostReasons = (armor: string[]) =>
  Object.fromEntries(
    speed(limitsSheet(armor))
      ?.suppressed.filter(({ entryName }) => entryName !== 'Unarmored movement')
      .map(({ entryName, suppressedBy, reason }) => [
        entryName,
        { suppressedBy, reason },
      ]) ?? [],
  );

test('known armor beside uncategorised body armor: a limit the known armor exceeds names both, one it meets names only the unknown', () => {
  const both = {
    suppressedBy: 'chainmail-row',
    reason:
      'Lost while wearing Chainmail (medium armor) and Mystery mail (its armor category is unknown).',
  };
  expect(lostReasons(['chainmail', 'blank-armor'])).toEqual({
    // `none` and `light`: Chainmail is heavier, Mystery mail is unknown.
    'Fast Movement': both,
    Fleet: both,
    // `medium`: Chainmail qualifies, Mystery mail is not known to.
    'Barbarian fast movement': {
      suppressedBy: 'blank-armor-row',
      reason:
        'Lost while wearing Mystery mail (its armor category is unknown).',
    },
  });
  // Sheet order: the unknown one first.
  expect(lostReasons(['blank-armor', 'full-plate'])).toEqual(
    Object.fromEntries(
      ['Fast Movement', 'Fleet', 'Barbarian fast movement'].map((name) => [
        name,
        {
          suppressedBy: 'blank-armor-row',
          reason:
            'Lost while wearing Mystery mail (its armor category is unknown) and Full plate (heavy armor).',
        },
      ]),
    ),
  );
});

test('two known armors: every one heavier than the limit, and only those', () => {
  const both = {
    suppressedBy: 'chainmail-row',
    reason:
      'Lost while wearing Chainmail (medium armor) and Full plate (heavy armor).',
  };
  expect(lostReasons(['chainmail', 'full-plate'])).toEqual({
    'Fast Movement': both,
    Fleet: both,
    'Barbarian fast movement': {
      suppressedBy: 'full-plate-row',
      reason: 'Lost while wearing Full plate (heavy armor).',
    },
  });
  // Both within `medium`: only the monk's `none` and Fleet's `light` lose.
  expect(lostReasons(['leather', 'chainmail'])).toEqual({
    'Fast Movement': {
      suppressedBy: 'leather-row',
      reason:
        'Lost while wearing Leather armor (light armor) and Chainmail (medium armor).',
    },
    Fleet: {
      suppressedBy: 'chainmail-row',
      reason: 'Lost while wearing Chainmail (medium armor).',
    },
  });
});

test('light, medium and no armor: `light` and `medium` as before', () => {
  // 30 + 10 + 5 (Fast Movement, Fleet) + 10 + 5 (the monk's two).
  expect(limits([])).toEqual({
    total: 60,
    applied: ['Barbarian fast movement', 'Fleet'],
    suppressed: [],
  });
  // The monk's two are lost in any armor.
  expect(limits(['leather'])).toEqual({
    total: 45,
    applied: ['Barbarian fast movement', 'Fleet'],
    suppressed: [],
  });
  expect(limits(['chainmail'])).toMatchObject({
    applied: ['Barbarian fast movement'],
    suppressed: [
      {
        entryName: 'Fleet',
        suppressedBy: 'chainmail-row',
        reason: 'Lost while wearing Chainmail (medium armor).',
      },
    ],
  });
});

test('`unarmored` in uncategorised body armor is as before: lost, naming the armor', () => {
  expect(speed(limitsSheet(['blank-armor']))?.suppressed).toContainEqual(
    expect.objectContaining({
      entryName: 'Unarmored movement',
      suppressedBy: 'blank-armor-row',
      reason: 'Lost while wearing Mystery mail.',
    }),
  );
});

// fix r4 (round 4 Standards 1): `resolveSheet` takes the heaviest armor as
// `wornArmor` for `armorAtMost`; a caller that passes it without the body
// armor list keeps the decision it had before fix r3. Given both, the list
// decides.
const raw = ({
  sheetEntryId,
  entryName,
  value,
  condition,
}: {
  sheetEntryId: string;
  entryName: string;
  value: number;
  condition?: { armorAtMost: 'light' | 'medium' };
}): InputSourcedModifier => ({
  target: 'speed.land',
  bonusType: condition ? 'untyped' : 'base',
  value,
  sheetEntryId,
  entryName,
  source: sheetEntryId,
  builtIn: false,
  ...(condition ? { condition } : {}),
});
const rawSpeed = [
  raw({ sheetEntryId: 'human-row', entryName: 'Human', value: 30 }),
  raw({
    sheetEntryId: 'fast-row',
    entryName: 'Barbarian fast movement',
    value: 10,
    condition: { armorAtMost: 'medium' },
  }),
  raw({
    sheetEntryId: 'fleet-row',
    entryName: 'Fleet',
    value: 5,
    condition: { armorAtMost: 'light' },
  }),
];
const fullPlate = {
  sheetEntryId: 'full-plate-row',
  name: 'Full plate',
  category: 'heavy',
} as const;

test('`wornArmor` alone: heavy armor loses both limits, as before fix r3', () => {
  const result = resolveSheet(rawSpeed, { wornArmor: fullPlate })['speed.land'];
  expect(result.total).toBe(30);
  expect(
    result.suppressed.map(({ entryName, suppressedBy, reason }) => ({
      entryName,
      suppressedBy,
      reason,
    })),
  ).toEqual(
    ['Barbarian fast movement', 'Fleet'].map((entryName) => ({
      entryName,
      suppressedBy: 'full-plate-row',
      reason: 'Lost while wearing Full plate (heavy armor).',
    })),
  );
  // Medium armor: only Fleet's `light` is lost.
  expect(
    resolveSheet(rawSpeed, {
      wornArmor: { ...fullPlate, name: 'Chainmail', category: 'medium' },
    })['speed.land'].total,
  ).toBe(40);
  expect(resolveSheet(rawSpeed)['speed.land'].total).toBe(45);
});

test('`wornArmor` and `bodyArmor` both: the list decides', () => {
  const blank = { sheetEntryId: 'blank-armor-row', name: 'Mystery mail' };
  // The list adds an uncategorised suit the heaviest armor leaves out.
  const result = resolveSheet(rawSpeed, {
    wornArmor: { ...fullPlate, name: 'Leather armor', category: 'light' },
    bodyArmor: [
      { ...fullPlate, name: 'Leather armor', category: 'light' },
      blank,
    ],
  })['speed.land'];
  expect(result.total).toBe(30);
  expect(result.suppressed.map(({ suppressedBy }) => suppressedBy)).toEqual([
    'blank-armor-row',
    'blank-armor-row',
  ]);
  // An empty list: nothing is worn, whatever `wornArmor` says.
  expect(
    resolveSheet(rawSpeed, { wornArmor: fullPlate, bodyArmor: [] })[
      'speed.land'
    ].total,
  ).toBe(45);
});
