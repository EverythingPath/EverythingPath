// @vitest-environment node
import { expect, it } from 'vitest';
import { representativeClassCatalog } from '../../convex/lib/representativeClassCatalog';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  type Ability,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
  type SheetEntry,
} from '../../src/lib/character-sheet';
import { armorKeys } from './released-armor';
import { importReleasedEntries } from './released-entries';

// rotation-1 (design B): Armor Training (pf1/5JFfSqLMCpbRmERa) as a code rule
// keyed by the feature's rule identity, as flurry is. PRD
// coreRulebook/classes/fighter.html:383: "Whenever he is wearing armor, he
// reduces the armor check penalty by 1 (to a minimum of 0) and increases the
// maximum Dexterity bonus allowed by his armor by 1. Every four levels
// thereafter (7th, 11th, and 15th), these bonuses increase by +1 each time, to
// a maximum –4 reduction of the armor check penalty and a +4 increase of the
// maximum Dexterity bonus allowed." The class table (:359, :363, :367, :371)
// gives Armor training 1 at 3rd, 2 at 7th, 3 at 11th and 4 at 15th. Root's
// default (2026-11-15): the armor's own penalty, never a shield's.

const ARMOR_TRAINING = 'pf1/5JFfSqLMCpbRmERa';
const BREASTPLATE = armorKeys.breastplate; // +6, max Dex 3, ACP 4
const FULL_PLATE = armorKeys.fullPlate; // +9, max Dex 1, ACP 6
const HEAVY_STEEL_SHIELD = armorKeys.heavySteelShield; // +2, ACP 2
const TOWER_SHIELD = armorKeys.towerShield; // +4, max Dex 2, ACP 10

// The feature and the four armors, imported from the pinned store.
const released = await importReleasedEntries([
  ARMOR_TRAINING,
  BREASTPLATE,
  FULL_PLATE,
  HEAVY_STEEL_SHIELD,
  TOWER_SHIELD,
]);

/** The imported feature: no Modifiers, two Notes. */
const armorTraining = (() => {
  const row = released.entries.get(ARMOR_TRAINING);
  if (!row) throw new Error('The import lacks Armor Training');
  return {
    _id: ARMOR_TRAINING,
    ruleIdentity: ARMOR_TRAINING,
    name: row.name,
    modifiers: row.modifiers,
    situationalNotes: row.situationalNotes,
    detail: row.detail,
  } as CharacterSheetCatalogEntry;
})();

/** An imported armor or shield (the #424 batch's), without its bash. */
function item(key: string): CharacterSheetCatalogEntry {
  const row = released.entries.get(key);
  if (row?.detail?.kind !== 'item' || !row.detail.armor)
    throw new Error(`Missing imported armor ${key}`);
  const { weapon: _bash, ...detail } = row.detail;
  return {
    _id: key,
    ruleIdentity: key,
    name: row.name,
    modifiers: [],
    detail,
  } as CharacterSheetCatalogEntry;
}

/** A seeded class, granting Armor Training at 3rd when it is the Fighter. */
function classDefinition(
  identity: 'fighter' | 'rogue',
  grants: boolean,
): CharacterSheetCatalogEntry {
  const definition = representativeClassCatalog.find(
    (row) => row.ruleIdentity === identity,
  );
  if (definition?.detail.kind !== 'class')
    throw new Error(`Missing seeded ${identity}`);
  return {
    ...definition,
    _id: identity,
    detail: {
      ...definition.detail,
      featuresByLevel:
        identity === 'fighter' && grants
          ? [{ classLevel: 3, catalogEntryId: ARMOR_TRAINING }]
          : [],
      picksByLevel: [],
    },
  } as CharacterSheetCatalogEntry;
}

function sheet({
  fighter,
  rogue = 0,
  dexterity = 10,
  worn = [],
  grants = true,
  entries = [],
}: {
  fighter: number;
  rogue?: number;
  dexterity?: number;
  worn?: readonly string[];
  grants?: boolean;
  entries?: SheetEntry[];
}): CharacterSheetInput {
  const scores: Partial<Record<Ability, number>> = { dexterity };
  const levels = [
    ...Array.from({ length: fighter }, () => 'fighter'),
    ...Array.from({ length: rogue }, () => 'rogue'),
  ];
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
      ...levels.map(
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
      ...worn.map(
        (key): SheetEntry => ({
          _id: `worn-${key}`,
          kind: 'item',
          active: true,
          catalogEntryId: key,
          state: { kind: 'item' },
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
      classDefinition('fighter', grants),
      classDefinition('rogue', grants),
      armorTraining,
      ...[BREASTPLATE, FULL_PLATE, HEAVY_STEEL_SHIELD, TOWER_SHIELD].map(item),
    ],
  };
}

/** Each worn item's maximum Dexterity bonus and armor check penalty. */
function items(input: CharacterSheetInput) {
  return Object.fromEntries(
    calculateCharacterSheet(input).equipment.items.map((row) => [
      row.name,
      // A penalty of 0 is stored as −0, as for any armor without one.
      { maxDex: row.maxDexterityBonus, acp: row.armorCheckPenalty || 0 },
    ]),
  );
}

it.each([
  // Granted at 3rd (:359): a Fighter 2 has no Armor Training.
  { fighter: 2, maxDex: 3, acp: -4 },
  { fighter: 3, maxDex: 4, acp: -3 },
  { fighter: 6, maxDex: 4, acp: -3 },
  { fighter: 7, maxDex: 5, acp: -2 },
  { fighter: 11, maxDex: 6, acp: -1 },
  { fighter: 15, maxDex: 7, acp: 0 },
  // "to a maximum –4 reduction … and a +4 increase": past 15th it stays 4.
  { fighter: 19, maxDex: 7, acp: 0 },
  { fighter: 20, maxDex: 7, acp: 0 },
])(
  'Fighter $fighter in a Breastplate: max Dex +$maxDex, armor check penalty $acp',
  ({ fighter, maxDex, acp }) => {
    const input = sheet({ fighter, worn: [BREASTPLATE] });
    expect(items(input)).toEqual({ Breastplate: { maxDex, acp } });
    const calculated = calculateCharacterSheet(input);
    expect(calculated.equipment.maxDexterityBonus).toBe(maxDex);
    expect(calculated.equipment.armorCheckPenalty || 0).toBe(acp);
  },
);

it('reduces a heavy armor penalty by 4 at most and only to 0: Full Plate at Fighter 15', () => {
  expect(items(sheet({ fighter: 15, worn: [FULL_PLATE] }))).toEqual({
    'Full Plate': { maxDex: 5, acp: -2 },
  });
});

it("leaves a shield's penalty and a tower shield's cap as they are", () => {
  // Fighter 7 (Armor Training 2): the Breastplate's penalty 4 → 2; the Heavy
  // Steel Shield keeps its 2, so the total is −4, not −2.
  const shielded = sheet({
    fighter: 7,
    worn: [BREASTPLATE, HEAVY_STEEL_SHIELD],
  });
  expect(items(shielded)).toEqual({
    Breastplate: { maxDex: 5, acp: -2 },
    'Heavy Steel Shield': { maxDex: null, acp: -2 },
  });
  expect(calculateCharacterSheet(shielded).equipment.armorCheckPenalty).toBe(
    -4,
  );
  // The tower shield's own cap (2) is not "allowed by his armor": it still
  // caps Dexterity at Fighter 15.
  const tower = sheet({ fighter: 15, worn: [BREASTPLATE, TOWER_SHIELD] });
  expect(items(tower)).toEqual({
    Breastplate: { maxDex: 7, acp: 0 },
    'Tower Shield': { maxDex: 2, acp: -10 },
  });
  expect(calculateCharacterSheet(tower).equipment.maxDexterityBonus).toBe(2);
});

it('applies only while armor is worn, and explains the numbers on the item', () => {
  expect(items(sheet({ fighter: 7 }))).toEqual({});
  expect(items(sheet({ fighter: 7, worn: [HEAVY_STEEL_SHIELD] }))).toEqual({
    'Heavy Steel Shield': { maxDex: null, acp: -2 },
  });
  const breastplate = calculateCharacterSheet(
    sheet({ fighter: 7, worn: [BREASTPLATE] }),
  ).equipment.items[0];
  expect(breastplate?.adjustmentExplanation).toBe(
    'Armor Training 2: maximum Dexterity bonus +2, armor check penalty reduced by 2 (to a minimum of 0).',
  );
});

it('gives nothing to a Fighter whose Armor Training is absent or switched off', () => {
  // Absent: an archetype that replaces it leaves no Armor Training row.
  expect(
    items(sheet({ fighter: 7, worn: [BREASTPLATE], grants: false })),
  ).toEqual({ Breastplate: { maxDex: 3, acp: -4 } });
  // Switched off on the sheet.
  const on = sheet({ fighter: 7, worn: [BREASTPLATE] });
  const granted = calculateCharacterSheet(on).resolvedEntries.find(
    (row) =>
      row.origin === 'grant' &&
      'catalogEntryId' in row.entry &&
      row.entry.catalogEntryId === ARMOR_TRAINING,
  );
  if (!granted || !('grantKey' in granted.entry) || !granted.entry.grantKey)
    throw new Error('Armor Training is not granted');
  const off = sheet({
    fighter: 7,
    worn: [BREASTPLATE],
    entries: [
      { ...granted.entry, _id: 'stored-armor-training', active: false },
    ],
  });
  expect(items(off)).toEqual({ Breastplate: { maxDex: 3, acp: -4 } });
});

it("raises AC only when the Dexterity modifier exceeds the armor's cap, and never CMD", () => {
  const defenses = (fighter: number, dexterity: number) => {
    const { derivedStatistics } = calculateCharacterSheet(
      sheet({ fighter, dexterity, worn: [BREASTPLATE] }),
    );
    return {
      ac: derivedStatistics.ac.total,
      cmd: derivedStatistics.cmd.total - fighter, // less BAB (full)
    };
  };
  // Dexterity 18 (+4) over the Breastplate's 3: Armor Training 1 lets the
  // fourth point in. 10 + 6 + Dex.
  expect(defenses(2, 18).ac).toBe(19);
  expect(defenses(3, 18).ac).toBe(20);
  // Armor Training 2 raises the cap to 5, but Dexterity gives only +4.
  expect(defenses(7, 18).ac).toBe(20);
  // Dexterity 14 (+2) is under the cap either way.
  expect(defenses(2, 14).ac).toBe(18);
  expect(defenses(3, 14).ac).toBe(18);
  // PRD 251 line 184: "Armor max Dex caps AC, not CMD." CMD has the full +4
  // with or without Armor Training: 10 + Dex 4 (+ BAB).
  expect(defenses(2, 18).cmd).toBe(14);
  expect(defenses(3, 18).cmd).toBe(14);
});

it("lowers the armor's penalty on Strength- and Dexterity-based skills", () => {
  const climb = (fighter: number) =>
    calculateCharacterSheet(sheet({ fighter, worn: [BREASTPLATE] })).breakdowns[
      'skill.clm'
    ].total;
  // No ranks, Strength 10: only the penalty, −4, then −3 and −2.
  expect(climb(2)).toBe(-4);
  expect(climb(3)).toBe(-3);
  expect(climb(7)).toBe(-2);
});

it('counts fighter levels only: Fighter 3 / Rogue 4 has Armor Training 1', () => {
  expect(items(sheet({ fighter: 3, rogue: 4, worn: [BREASTPLATE] }))).toEqual({
    Breastplate: { maxDex: 4, acp: -3 },
  });
  // Rogue levels alone grant nothing.
  expect(items(sheet({ fighter: 0, rogue: 7, worn: [BREASTPLATE] }))).toEqual({
    Breastplate: { maxDex: 3, acp: -4 },
  });
});
