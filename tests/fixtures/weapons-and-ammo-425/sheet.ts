import { preparedItemWeapon } from '../../../src/lib/catalog/imported-item';
import { z } from 'zod';
import {
  abilityKeys,
  abilityTargets,
  catalogModifierTargets,
  modifierConditionSchema,
  personalBonusTypes,
  situationalNoteSchema,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
  type SheetEntry,
} from '../../../src/lib/character-sheet';
import {
  defaultAttackRoutineConfiguration,
  type WeaponDetail,
} from '../../../src/lib/character-sheet-attacks';
import { importedCatalogEntrySchema } from '../../../src/lib/catalog/imported-entry-schema';
import { preview } from './data';

// Current weapon profiles use the production release adapter. The legacy
// branches preserve older direct-resolver fixtures and do not qualify releases.
const modifierSchema = z.strictObject({
  target: z.enum(catalogModifierTargets),
  bonusType: z.enum(personalBonusTypes),
  value: z.number(),
  condition: modifierConditionSchema.optional(),
  stacksWithinEntry: z.literal(true).optional(),
});

const byKey = new Map(
  [...preview.entries, ...preview.closure].map((row) => [row.externalKey, row]),
);
const handedness = {
  light: 'light',
  '1h': 'oneHanded',
  '2h': 'twoHanded',
} as const;
const proficiency = z.enum(['simple', 'martial', 'exotic']);

/** A melee weapon's imported detail as the sheet's weapon. */
export function sheetWeapon(key: string): WeaponDetail {
  const entry = importedCatalogEntrySchema.parse(byKey.get(key));
  const weapon = entry.detail.kind === 'item' ? entry.detail.weapon : undefined;
  if (weapon && 'baseType' in weapon) return preparedItemWeapon({ weapon });
  if (!weapon?.dice || !(weapon.handedness in handedness))
    throw new Error(`${key} is not a mapped melee weapon`);
  return {
    baseType: (weapon.baseTypes[0] ?? entry.name).toLowerCase(),
    proficiency: proficiency.parse(weapon.proficiency),
    groups: weapon.groups,
    handedness: handedness[weapon.handedness as keyof typeof handedness],
    attackType: 'melee',
    dice: weapon.dice,
    damageTypes: weapon.damageTypes,
    threat: weapon.threat,
    mult: weapon.mult,
    finesse: weapon.finesse,
    strengthDamage: 'melee',
  };
}

/**
 * Current ranged profiles use the production adapter; the legacy fallback
 * retains the archived crossbow fixture's direct-resolver contract.
 */
export function rangedWeapon(key: string): WeaponDetail {
  const entry = importedCatalogEntrySchema.parse(byKey.get(key));
  const weapon = entry.detail.kind === 'item' ? entry.detail.weapon : undefined;
  if (weapon && 'baseType' in weapon) return preparedItemWeapon({ weapon });
  if (!weapon?.dice || weapon.handedness !== 'ranged' || !weapon.rangeIncrement)
    throw new Error(`${key} is not a mapped ranged weapon`);
  return {
    baseType: (weapon.baseTypes[0] ?? entry.name).toLowerCase(),
    proficiency: proficiency.parse(weapon.proficiency),
    groups: weapon.groups,
    handedness: 'light',
    attackType: 'ranged',
    dice: weapon.dice,
    damageTypes: weapon.damageTypes,
    threat: weapon.threat,
    mult: weapon.mult,
    strengthDamage: 'crossbow',
    rangeIncrement: weapon.rangeIncrement,
  };
}

/** The item's imported Modifiers and Notes, with its weapon when it is a melee weapon. */
export function itemDefinition(
  key: string,
  { weapon = false }: { weapon?: boolean } = {},
): CharacterSheetCatalogEntry {
  const entry = importedCatalogEntrySchema.parse(byKey.get(key));
  if (entry.detail.kind !== 'item') throw new Error(`${key} is not an item`);
  return {
    _id: entry.externalKey,
    name: entry.name,
    ruleIdentity: entry.externalKey,
    stacksWithItself: false,
    modifiers: entry.modifiers.map((modifier) =>
      modifierSchema.parse(modifier),
    ),
    ...(entry.situationalNotes
      ? {
          situationalNotes: entry.situationalNotes.map((note) =>
            situationalNoteSchema.parse(note),
          ),
        }
      : {}),
    detail: {
      kind: 'item',
      consumable: entry.detail.consumable,
      ...(weapon ? { weapon: sheetWeapon(key) } : {}),
    },
  };
}

/**
 * A sheet with base scores (Strength and Dexterity as given, 10 elsewhere),
 * a base attack bonus, the weapon Proficiency categories and base types added
 * by hand, an Attack Routine for each listed weapon and the other items
 * carried.
 */
export function weaponSheet({
  weapons = [],
  items = [],
  strength = 10,
  dexterity = 10,
  bab = 0,
  categories = [],
  baseTypes = [],
}: {
  weapons?: string[];
  items?: string[];
  strength?: number;
  dexterity?: number;
  bab?: number;
  categories?: ('simple' | 'martial')[];
  baseTypes?: string[];
}): CharacterSheetInput {
  const routines: SheetEntry[] = weapons.map((key) => ({
    _id: `routine:${key}`,
    kind: 'attackRoutine',
    active: true,
    state: {
      kind: 'attackRoutine',
      name: key,
      weaponEntryId: `item:${key}`,
      ...defaultAttackRoutineConfiguration(sheetWeapon(key)),
    },
  }));
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
              ...categories.map((category) => ({ category })),
              ...baseTypes.map((baseType) => ({ baseType })),
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
      ...[...weapons, ...items].map((key) => ({
        _id: `item:${key}`,
        kind: 'item' as const,
        active: true,
        catalogEntryId: key,
        state: { kind: 'item' as const },
      })),
      ...routines,
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'fixture-base',
        modifiers: abilityKeys.map((ability) => ({
          target: abilityTargets[ability],
          bonusType: 'base',
          value:
            ability === 'strength'
              ? strength
              : ability === 'dexterity'
                ? dexterity
                : 10,
        })),
      },
      {
        _id: 'bab',
        ruleIdentity: 'fixture-bab',
        modifiers: [{ target: 'bab', bonusType: 'untyped', value: bab }],
      },
      ...weapons.map((key) => itemDefinition(key, { weapon: true })),
      ...items.map((key) => itemDefinition(key)),
    ],
  };
}
