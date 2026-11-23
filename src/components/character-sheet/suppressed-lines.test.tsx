import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheetProjections,
  resolveSheet,
  type CharacterSheetInput,
  type InputSourcedModifier,
  type ResolvedStatistic,
} from '../../lib/character-sheet';
import { parseCharacterSheetBreakdowns } from '../../lib/character-sheet-breakdowns';
import { getConditionDefinition } from '../../lib/character-sheet-conditions';
import { deriveLandSpeed } from '../../lib/character-sheet-speed';
import {
  buildSheet,
  representativeEquipment,
  representativeWeapon,
  type CatalogSheetEntry,
} from './character-sheet-test-fixture';
import { describeMaxDexterity } from './equipment-statistics';
import { SuppressedLines } from './suppressed-lines';

// fix r5 (round 5, both axes): a set-aside line names the entry that set it
// aside unless its reason already does, and the reason says so itself where
// it is written (`reasonNamesSuppressor`): the renderer never decides from
// the reason's words. Every kind of reason the sheet produces is rendered
// here from a real calculation, and the entry names include words the reasons
// contain (`bonus`, `armor`, `a`).

afterEach(cleanup);

/**
 * The set-aside line of `entryName` explains itself exactly as `expected`:
 * the explanation is found by its whole text within that line, so a name
 * added after the reason, or one missing, fails.
 */
function expectDetail(
  statistic: ResolvedStatistic | null | undefined,
  entryName: string,
  expected: string,
) {
  if (!statistic) throw new Error('No statistic');
  render(
    <ul>
      <SuppressedLines items={statistic.suppressed} statistic={statistic} />
    </ul>,
  );
  const line = screen.getByText(entryName, { selector: 'span' }).closest('li');
  if (!line) throw new Error(`No set-aside line for ${entryName}`);
  expect(within(line).getByText(expected)).toBeInTheDocument();
}

const entry = (
  id: string,
  name: string,
  modifiers: CatalogSheetEntry['modifiers'],
): CatalogSheetEntry => ({
  id,
  name,
  detail: {
    kind: 'spellEffect',
    lastsOverOneDay: false,
    defaultCasterLevel: 6,
  },
  modifiers,
});
/** A CRB condition entry, its row id from its key. */
const condition = (
  name: string,
  conditionKey: NonNullable<
    Extract<CatalogSheetEntry['detail'], { kind: 'condition' }>['conditionKey']
  >,
  modifiers: CatalogSheetEntry['modifiers'] = [],
): CatalogSheetEntry => ({
  id: `entry-${conditionKey}`,
  name,
  detail: { kind: 'condition', conditionKey },
  modifiers,
});
const row = (
  sheetEntryId: string,
  entryName: string,
  fields: Pick<InputSourcedModifier, 'bonusType' | 'value'> &
    Partial<InputSourcedModifier>,
): InputSourcedModifier => ({
  target: 'init',
  sheetEntryId,
  entryName,
  source: sheetEntryId,
  builtIn: false,
  ...fields,
});

// Stacking (`stackByType`, `keepStrongestPerSource`, `suppressWithinEntry`):
// none of these reasons names an entry.

test('"A higher bonus of this type applies." names the winner, even one called `bonus`', () => {
  const sheet = buildSheet({
    adjustments: [
      {
        id: 'adj-bonus',
        name: 'bonus',
        modifiers: [{ target: 'init', bonusType: 'enhancement', value: 10 }],
      },
    ],
    sheetEntries: [
      entry('entry-1', 'Spell Effect', [
        { target: 'init', bonusType: 'enhancement', value: 5 },
      ]),
    ],
  });
  expectDetail(
    sheet.calculated.derivedStatistics.initiative,
    'Spell Effect',
    'A higher bonus of this type applies. (bonus)',
  );
});

test('"A worse penalty of this type applies." names the winner, even one called `armor`', () => {
  const statistic = resolveSheet([
    row('armor-row', 'armor', { bonusType: 'enhancement', value: -4 }),
    row('other-row', 'Lesser curse', { bonusType: 'enhancement', value: -2 }),
  ]).init;
  expectDetail(
    statistic,
    'Lesser curse',
    'A worse penalty of this type applies. (armor)',
  );
});

test('"A stronger entry from the same Source applies." names the winner, even one called `a`', () => {
  const statistic = resolveSheet([
    row('a-row', 'a', { bonusType: 'untyped', value: 4, source: 'pf1/x' }),
    row('b-row', 'Second copy', {
      bonusType: 'untyped',
      value: 2,
      source: 'pf1/x',
    }),
  ]).init;
  expectDetail(
    statistic,
    'Second copy',
    'A stronger entry from the same Source applies. (a)',
  );
});

test('"A stronger contribution from this entry applies." is the entry itself, so it names none', () => {
  const statistic = resolveSheet([
    row('a-row', 'a', { bonusType: 'enhancement', value: 4 }),
    row('a-row', 'a', { bonusType: 'enhancement', value: 2 }),
  ]).init;
  expectDetail(
    statistic,
    'a',
    'A stronger contribution from this entry applies.',
  );
});

// Composed statistics and conditions.

const fullPlate = (): CatalogSheetEntry => ({
  ...representativeEquipment('full-plate', 'plate'),
  itemState: { enhancement: 0 },
});

test('"Does not apply to touch AC." names no entry and has no winner to name', () => {
  const sheet = buildSheet({ sheetEntries: [fullPlate()] });
  expectDetail(
    sheet.calculated.derivedStatistics.touchAc,
    'Full plate',
    'Does not apply to touch AC.',
  );
});

test('the denied Dexterity reason names the condition after it', () => {
  const sheet = buildSheet({
    scores: {
      strength: 10,
      dexterity: 14,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    sheetEntries: [condition('Blinded', 'blinded')],
  });
  expectDetail(
    sheet.calculated.derivedStatistics.ac,
    'Dexterity',
    'Dexterity bonus and dodge bonuses are denied by this condition. (Blinded)',
  );
});

test('Blinded replaces a shield’s reason for setting aside a dodge bonus, and the line names Blinded', () => {
  // An unarmored dodge bonus is set aside by the shield ("Lost while
  // carrying …", which names the shield); Blinded denies dodge bonuses and
  // its reason replaces the shield's, naming no entry, so Blinded follows it.
  const sheet = buildSheet({
    sheetEntries: [
      entry('entry-dodge', 'Dodge bonus', [
        {
          target: 'ac.other',
          bonusType: 'dodge',
          value: 1,
          condition: { unarmored: true },
        },
      ]),
      representativeEquipment('heavy-steel-shield', 'shield'),
      condition('Blinded', 'blinded'),
    ],
  });
  expectDetail(
    sheet.calculated.derivedStatistics.ac,
    'Dodge bonus',
    'Dexterity bonus and dodge bonuses are denied by this condition. (Blinded)',
  );
});

test('"Replaced by Exhausted." names its winner, so a stored and parsed breakdown says it once', () => {
  const sheet = buildSheet({
    sheetEntries: [
      condition('Fatigued', 'fatigued', [
        { target: 'ability.str', bonusType: 'untyped', value: -2 },
      ]),
      condition('Exhausted', 'exhausted', [
        { target: 'ability.str', bonusType: 'untyped', value: -6 },
      ]),
    ],
  });
  const strength = parseCharacterSheetBreakdowns(sheet.calculated.breakdowns)[
    'ability.str'
  ];
  expect(strength.applied).toContainEqual(
    expect.objectContaining({ entryName: 'Exhausted' }),
  );
  expectDetail(strength, 'Fatigued', 'Replaced by Exhausted.');
});

test('the grappled invisibility reason names the condition only by its state, so the entry follows it', () => {
  const keys = ['invisible', 'grappled'] as const;
  const input: CharacterSheetInput = {
    characterKind: 'pc',
    entries: [
      {
        _id: 'base-row',
        kind: 'base',
        active: true,
        catalogEntryId: 'base',
        state: { kind: 'base' },
      },
      ...keys.map((_key, index) => ({
        _id: `row-${index}`,
        kind: 'condition' as const,
        active: true,
        catalogEntryId: `condition-${index}`,
        state: { kind: 'condition' as const },
      })),
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: abilityKeys.map((ability) => ({
          target: abilityTargets[ability],
          bonusType: 'base',
          value: 15,
        })),
      },
      ...keys.map((key, index) => ({
        _id: `condition-${index}`,
        ruleIdentity: getConditionDefinition(key).ruleIdentity,
        modifiers: [],
        detail: { kind: 'condition' as const, conditionKey: key },
      })),
    ],
  };
  const melee = calculateCharacterSheetProjections(input, {
    situations: ['sighted-opponent'],
  }).current.breakdowns['attack.melee'];
  expectDetail(
    melee,
    'Invisible',
    'While grappled, invisibility grants only +2 CMD to avoid being grappled. (Grappled)',
  );
});

// Armor.

const unarmoredBonus = entry('entry-monk', 'AC bonus', [
  {
    target: 'ac.other',
    bonusType: 'untyped',
    value: 2,
    condition: { unarmored: true },
  },
]);

test('"Lost while carrying Heavy steel shield." names the shield, so it is not named again', () => {
  const sheet = buildSheet({
    sheetEntries: [
      unarmoredBonus,
      representativeEquipment('heavy-steel-shield', 'shield'),
    ],
  });
  const ac = sheet.calculated.derivedStatistics.ac;
  expect(ac.applied).toContainEqual(
    expect.objectContaining({ sheetEntryId: 'shield' }),
  );
  expectDetail(ac, 'AC bonus', 'Lost while carrying Heavy steel shield.');
});

test('"Lost while Helpless." names the condition, so it is not named again', () => {
  const sheet = buildSheet({
    sheetEntries: [
      unarmoredBonus,
      condition('Helpless', 'helpless', [
        { target: 'ac.other', bonusType: 'untyped', value: -4 },
      ]),
    ],
  });
  expectDetail(
    sheet.calculated.derivedStatistics.ac,
    'AC bonus',
    'Lost while Helpless.',
  );
});

test('"Lost while wearing Full plate." names the body armor, which also gives AC its armor bonus, so it is not named again', () => {
  const sheet = buildSheet({ sheetEntries: [unarmoredBonus, fullPlate()] });
  const ac = sheet.calculated.derivedStatistics.ac;
  expect(ac.applied).toContainEqual(
    expect.objectContaining({ entryName: 'Full plate', bonusType: 'armor' }),
  );
  expectDetail(ac, 'AC bonus', 'Lost while wearing Full plate.');
});

test('an armor limit on AC names the body armor, which also gives AC its armor bonus, once', () => {
  const sheet = buildSheet({
    sheetEntries: [
      entry('entry-limit', 'Light-armor bonus', [
        {
          target: 'ac.other',
          bonusType: 'untyped',
          value: 1,
          condition: { armorAtMost: 'light' },
        },
      ]),
      fullPlate(),
    ],
  });
  const ac = sheet.calculated.derivedStatistics.ac;
  expect(ac.applied).toContainEqual(
    expect.objectContaining({ entryName: 'Full plate', bonusType: 'armor' }),
  );
  expectDetail(
    ac,
    'Light-armor bonus',
    'Lost while wearing Full plate (heavy armor).',
  );
});

test('an armor limit names every armor that loses it, even one called `armor`, and the armor that reduces speed is not named again', () => {
  const sheet = buildSheet({
    sheetEntries: [
      // The representative races carry no speed: a base speed of 30 ft.
      entry('entry-race', 'Human', [
        { target: 'speed.land', bonusType: 'base', value: 30 },
      ]),
      entry('entry-fm', 'Fast Movement', [
        {
          target: 'speed.land',
          bonusType: 'enhancement',
          value: 10,
          condition: { armorAtMost: 'none' },
        },
      ]),
      fullPlate(),
      {
        id: 'mystery',
        name: 'armor',
        detail: {
          kind: 'item',
          consumable: false,
          armor: {
            slot: 'armor',
            bonus: 2,
            maxDex: null,
            armorCheckPenalty: 1,
            asf: 10,
          },
        },
        modifiers: [],
      },
    ],
  });
  const speed = sheet.calculated.derivedStatistics.landSpeed;
  expect(speed?.applied).toContainEqual(
    expect.objectContaining({ entryName: 'Full plate (heavy armor)' }),
  );
  expectDetail(
    speed,
    'Fast Movement',
    'Lost while wearing Full plate (heavy armor) and armor (its armor category is unknown).',
  );
});

const speedStatistic = resolveSheet([
  row('race-row', 'Human', {
    target: 'speed.land',
    bonusType: 'base',
    value: 30,
  }),
])['speed.land'];
const heavy = {
  sheetEntryId: 'plate',
  name: 'Full plate',
  category: 'heavy',
} as const;

test("a speed exemption's reason names the exemption", () => {
  const speed = deriveLandSpeed({
    statistic: speedStatistic,
    wornArmor: heavy,
    armorTrainingTier: 0,
    exemption: { sheetEntryId: 'slow-row', name: 'Slow and Steady' },
  });
  expectDetail(
    speed,
    'Full plate (heavy armor)',
    'Slow and Steady: speed is never modified by armor.',
  );
});

test('a speed exemption that also gives the statistic a line is named once', () => {
  const statistic = resolveSheet([
    row('race-row', 'Dwarf', {
      target: 'speed.land',
      bonusType: 'base',
      value: 20,
    }),
    row('slow-row', 'Slow and Steady', {
      target: 'speed.land',
      bonusType: 'untyped',
      value: 5,
    }),
  ])['speed.land'];
  expect(statistic.applied).toContainEqual(
    expect.objectContaining({ sheetEntryId: 'slow-row' }),
  );
  const speed = deriveLandSpeed({
    statistic,
    wornArmor: heavy,
    armorTrainingTier: 0,
    exemption: { sheetEntryId: 'slow-row', name: 'Slow and Steady' },
  });
  expectDetail(
    speed,
    'Full plate (heavy armor)',
    'Slow and Steady: speed is never modified by armor.',
  );
});

test("Armor Training's reason names Armor Training", () => {
  const speed = deriveLandSpeed({
    statistic: speedStatistic,
    wornArmor: heavy,
    armorTrainingTier: 2,
  });
  expectDetail(
    speed,
    'Full plate (heavy armor)',
    'Armor Training 2: moves at normal speed in heavy armor.',
  );
});

test('"A lower maximum applies" names the item with the lower maximum', () => {
  const sheet = buildSheet({
    sheetEntries: [
      fullPlate(),
      {
        ...representativeEquipment('breastplate', 'chest'),
        name: 'a',
      },
    ],
  });
  const totals = sheet.calculated.equipment;
  expectDetail(
    describeMaxDexterity(totals),
    'a',
    'A lower maximum applies (Full plate)',
  );
});

// Attacks.

test('the threat-range reason names the expander that applies', () => {
  const sheet = buildSheet({
    sheetEntries: [
      representativeWeapon('longsword', 'sword', {
        itemState: { enhancement: 1, abilities: [{ catalogEntryId: 'keen' }] },
      }),
    ],
    itemAbilities: ['keen'],
    feats: [{ id: 'feat-ic', key: 'improved-critical', choice: 'longsword' }],
    attackRoutines: [{ id: 'routine', name: 'Sword', weaponEntryId: 'sword' }],
  });
  const threat = sheet.calculated.attackRoutines[0]?.single[0]?.criticalThreat;
  expectDetail(
    threat,
    'Keen',
    'Threat-range expanders double the threat range only once. (Improved Critical)',
  );
});
