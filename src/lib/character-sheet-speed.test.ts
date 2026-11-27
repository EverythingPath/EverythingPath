// rotation-4 R3 (owner 2026-11-17, PRD #251; ORCH research stats-design.md
// "Land speed"): the sheet computes land speed. A race gives its base speed
// as a `base` Modifier on `speed.land` (Foundry races' `speeds.land`); its
// bonuses are typed, so two enhancement bonuses do not stack; Fast Movement
// is +10 untyped while armor is at most medium (CRB barbarian.html:381); the
// total is reduced in medium or heavy armor (30 to 20, 20 to 15: the PRD
// capture's gnoll, base 30 ft., in +1 scale mail has Speed 20 ft.,
// monsterCodex/gnolls.html:558; Foundry ActorPF.getReducedMovementSpeed),
// except with Armor Training (fighter.html:384: medium from 3rd level, heavy
// from 7th) or the dwarf's Slow and Steady (dwarves.html:362). Load is a Note.
import { expect, test } from 'vitest';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  calculateCharacterSheetProjections,
  personalAdjustmentConditionSchema,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
  type SheetEntry,
} from './character-sheet';
import { ruleKeyMatches } from './character-sheet-rule-keys';
import { deriveLandSpeed, reducedSpeed } from './character-sheet-speed';

const armor = (
  id: string,
  name: string,
  category: 'light' | 'medium' | 'heavy',
): CharacterSheetCatalogEntry => ({
  _id: id,
  name,
  ruleIdentity: `pf1/${id}`,
  modifiers: [],
  detail: {
    kind: 'item',
    armor: {
      slot: 'armor',
      category,
      bonus: 4,
      maxDex: 3,
      armorCheckPenalty: 0,
      asf: 20,
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
    // Foundry packs/races/human: speeds.land 30.
    _id: 'human',
    ruleIdentity: 'pf1/human',
    name: 'Human',
    modifiers: [{ target: 'speed.land', bonusType: 'base', value: 30 }],
    detail: { kind: 'race', racialTraits: [] },
  },
  {
    // Foundry packs/races/dwarf.nEltI9y37rKJTeWo: speeds.land 20, with the
    // pf1-content racial trait Slow and Steady.
    _id: 'dwarf',
    ruleIdentity: 'pf1/nEltI9y37rKJTeWo',
    name: 'Dwarf',
    modifiers: [{ target: 'speed.land', bonusType: 'base', value: 20 }],
    detail: { kind: 'race', racialTraits: ['slow-and-steady'] },
  },
  {
    _id: 'slow-and-steady',
    ruleIdentity: 'pf1-content/JsvoElxHBPdle8s8',
    name: 'Slow and Steady',
    modifiers: [],
    detail: {
      kind: 'racialTrait',
      raceEntryIds: ['dwarf'],
      replaces: [],
    },
  },
  {
    // Gnome: speeds.land 20, no Slow and Steady.
    _id: 'gnome',
    ruleIdentity: 'pf1/gnome',
    name: 'Gnome',
    modifiers: [{ target: 'speed.land', bonusType: 'base', value: 20 }],
    detail: { kind: 'race', racialTraits: [] },
  },
  {
    // CRB barbarian.html:381, as a reviewed replacement of Foundry's
    // `@armor.type` formula (stats-design "Land speed").
    _id: 'fast-movement',
    ruleIdentity: 'pf1/fastMovement',
    name: 'Fast Movement',
    modifiers: [
      {
        target: 'speed.land',
        bonusType: 'untyped',
        value: 10,
        condition: { armorAtMost: 'medium' },
      },
    ],
    detail: { kind: 'classFeature' },
  },
  {
    // CRB p. 294: haste, +30 ft. enhancement bonus (max twice normal speed).
    _id: 'haste',
    ruleIdentity: 'pf1/haste',
    name: 'Haste',
    modifiers: [{ target: 'speed.land', bonusType: 'enhancement', value: 30 }],
    detail: { kind: 'spellEffect' },
  },
  {
    // CRB p. 307: longstrider, +10 ft. enhancement bonus.
    _id: 'longstrider',
    ruleIdentity: 'pf1/longstrider',
    name: 'Longstrider',
    modifiers: [{ target: 'speed.land', bonusType: 'enhancement', value: 10 }],
    detail: { kind: 'spellEffect' },
  },
  armor('leather', 'Leather armor', 'light'),
  armor('chainmail', 'Chainmail', 'medium'),
  armor('full-plate', 'Full plate', 'heavy'),
  {
    _id: 'fighter',
    ruleIdentity: 'fighter',
    name: 'Fighter',
    modifiers: [],
    detail: {
      kind: 'class',
      classKind: 'base',
      tag: 'fighter',
      hitDie: 10,
      bab: 'full',
      saves: { fort: 'good', ref: 'poor', will: 'poor' },
      skillRanksPerLevel: 2,
      featuresByLevel: [{ classLevel: 3, catalogEntryId: 'armor-training' }],
    },
  },
  {
    // Foundry packs/class-abilities/armor-training.5JFfSqLMCpbRmERa.
    _id: 'armor-training',
    ruleIdentity: 'pf1/5JFfSqLMCpbRmERa',
    name: 'Armor Training',
    modifiers: [],
    detail: { kind: 'classFeature' },
  },
];

const row = (
  catalogEntryId: string,
  kind: 'race' | 'item' | 'classFeature' | 'spellEffect',
): SheetEntry => {
  const id = `${catalogEntryId}-row`;
  if (kind === 'race')
    return {
      _id: id,
      kind,
      active: true,
      catalogEntryId,
      state: { kind: 'race' },
    };
  if (kind === 'item')
    return {
      _id: id,
      kind,
      active: true,
      catalogEntryId,
      state: { kind: 'item' },
    };
  if (kind === 'spellEffect')
    return {
      _id: id,
      kind,
      active: true,
      catalogEntryId,
      state: { kind: 'spellEffect', casterLevel: 5 },
    };
  return {
    _id: id,
    kind,
    active: true,
    catalogEntryId,
    state: { kind: 'classFeature' },
  };
};

function sheet({
  race = 'human',
  fighter = 0,
  extra = [],
}: {
  race?: string | null;
  fighter?: number;
  extra?: SheetEntry[];
}): CharacterSheetInput {
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
      ...(race ? [row(race, 'race')] : []),
      ...Array.from(
        { length: fighter },
        (_, index): SheetEntry => ({
          _id: `level-${index + 1}`,
          kind: 'classLevel',
          active: true,
          state: {
            kind: 'classLevel',
            classEntryId: 'fighter',
            position: index + 1,
            hpGained: 10,
          },
        }),
      ),
      ...extra,
    ],
    catalogEntries: catalog,
  };
}

const speed = (input: CharacterSheetInput) =>
  calculateCharacterSheet(input).derivedStatistics.landSpeed;

test.each([
  ['human', null, 30],
  ['human', 'leather', 30],
  ['human', 'chainmail', 20],
  ['human', 'full-plate', 20],
  ['gnome', 'leather', 20],
  ['gnome', 'chainmail', 15],
  ['gnome', 'full-plate', 15],
])('a %s in %s armor moves %i ft.', (race, worn, total) => {
  expect(
    speed(sheet({ race, extra: worn ? [row(worn, 'item')] : [] }))?.total,
  ).toBe(total);
});

test('the reduction is listed in the breakdown under the armor worn', () => {
  const result = speed(sheet({ extra: [row('chainmail', 'item')] }));
  expect(
    result?.applied.map(({ entryName, value, bonusType }) => ({
      entryName,
      value,
      bonusType,
    })),
  ).toEqual([
    { entryName: 'Human', value: 30, bonusType: 'base' },
    { entryName: 'Chainmail (medium armor)', value: -10, bonusType: 'untyped' },
  ]);
});

test('reduced speeds follow the armor table: 20 → 15, 30 → 20, 40 → 30, 50 → 35', () => {
  expect([20, 30, 40, 50].map(reducedSpeed)).toEqual([15, 20, 30, 35]);
});

test('Fast Movement adds +10 in medium armor before the reduction, and is lost in heavy armor with the reason shown', () => {
  const fast = row('fast-movement', 'classFeature');
  expect(speed(sheet({ extra: [fast] }))?.total).toBe(40);
  // 40 ft. in medium armor is 30 ft.
  expect(speed(sheet({ extra: [fast, row('chainmail', 'item')] }))?.total).toBe(
    30,
  );
  const heavy = speed(sheet({ extra: [fast, row('full-plate', 'item')] }));
  expect(heavy?.total).toBe(20);
  expect(heavy?.suppressed).toContainEqual(
    expect.objectContaining({
      entryName: 'Fast Movement',
      value: 10,
      suppressedBy: 'full-plate-row',
      reason: 'Lost while wearing Full plate (heavy armor).',
    }),
  );
});

test('a second enhancement bonus does not stack: haste and longstrider give +30, not +40', () => {
  const result = speed(
    sheet({
      extra: [row('haste', 'spellEffect'), row('longstrider', 'spellEffect')],
    }),
  );
  expect(result?.total).toBe(60);
  expect(result?.suppressed).toContainEqual(
    expect.objectContaining({
      entryName: 'Longstrider',
      reason: 'A higher bonus of this type applies.',
    }),
  );
});

test('untyped bonuses stack with an enhancement bonus', () => {
  expect(
    speed(
      sheet({
        extra: [
          row('fast-movement', 'classFeature'),
          row('longstrider', 'spellEffect'),
        ],
      }),
    )?.total,
  ).toBe(50);
});

test.each([
  // Fighter 2: no Armor Training yet.
  [2, 'chainmail', 20],
  // Fighter 3, Armor Training 1: normal speed in medium armor, not heavy.
  [3, 'chainmail', 30],
  [3, 'full-plate', 20],
  [6, 'full-plate', 20],
  // Fighter 7, Armor Training 2: normal speed in heavy armor too.
  [7, 'full-plate', 30],
])('a human Fighter %i in %s moves %i ft.', (fighter, worn, total) => {
  const result = speed(sheet({ fighter, extra: [row(worn, 'item')] }));
  expect(result?.total).toBe(total);
});

test('Armor Training shows the reduction it lifts', () => {
  const result = speed(
    sheet({ fighter: 3, extra: [row('chainmail', 'item')] }),
  );
  expect(result?.suppressed).toContainEqual(
    expect.objectContaining({
      entryName: 'Chainmail (medium armor)',
      value: -10,
      reason: 'Armor Training 1: moves at normal speed in medium armor.',
    }),
  );
});

test('a dwarf’s speed is never reduced by armor (Slow and Steady)', () => {
  expect(
    ruleKeyMatches('pf1-content/JsvoElxHBPdle8s8', 'slow-and-steady'),
  ).toBe(true);
  const result = speed(
    sheet({ race: 'dwarf', extra: [row('full-plate', 'item')] }),
  );
  expect(result?.total).toBe(20);
  expect(result?.suppressed).toContainEqual(
    expect.objectContaining({
      entryName: 'Full plate (heavy armor)',
      reason: 'Slow and Steady: speed is never modified by armor.',
    }),
  );
});

test('a shield is not armor: no reduction, Fast Movement kept', () => {
  const shield: CharacterSheetCatalogEntry = {
    _id: 'tower',
    name: 'Tower shield',
    ruleIdentity: 'pf1/tower',
    modifiers: [],
    detail: {
      kind: 'item',
      armor: {
        slot: 'shield',
        category: 'towerShield',
        bonus: 4,
        maxDex: 2,
        armorCheckPenalty: 10,
        asf: 50,
      },
    },
  };
  const input = sheet({
    extra: [row('fast-movement', 'classFeature'), row('tower', 'item')],
  });
  expect(speed({ ...input, catalogEntries: [...catalog, shield] })?.total).toBe(
    40,
  );
});

test('without a race base speed the sheet shows no land speed', () => {
  const result = calculateCharacterSheet(
    sheet({ race: null, extra: [row('fast-movement', 'classFeature')] }),
  );
  expect(result.derivedStatistics.landSpeed).toBeUndefined();
  expect(result.breakdowns['speed.land'].total).toBe(10);
});

test('a Temporary Effect leaves the permanent projection', () => {
  const { current, permanent } = calculateCharacterSheetProjections(
    sheet({ extra: [row('haste', 'spellEffect')] }),
  );
  expect(current.derivedStatistics.landSpeed?.total).toBe(60);
  expect(permanent.derivedStatistics.landSpeed?.total).toBe(30);
});

test('deriveLandSpeed keeps a statistic without armor untouched', () => {
  const statistic = calculateCharacterSheet(sheet({})).breakdowns['speed.land'];
  expect(deriveLandSpeed({ statistic, armorTrainingTier: 0 })).toBe(statistic);
});

test('a personal adjustment cannot carry an armor condition', () => {
  expect(
    personalAdjustmentConditionSchema.safeParse({ armorAtMost: 'medium' })
      .success,
  ).toBe(false);
});
