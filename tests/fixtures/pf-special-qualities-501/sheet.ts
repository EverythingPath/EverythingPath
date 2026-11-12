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
import type { WeaponDetail } from '../../../src/lib/character-sheet-attacks';
import { itemAbilityTargets } from '../../../src/lib/character-sheet-attack-types';
import { importedCatalogEntrySchema } from '../../../src/lib/catalog/imported-entry-schema';
import { preview } from './data';

// Test-only adapter from the batch's full-corpus preview entries to resolver
// Item Ability entries. Stable keys serve as both the entry ID and its rule
// identity, so no assessment, release or database reference is constructed.
// A target or bonus type the resolver does not know fails the parse rather
// than silently contributing nothing.
const modifierSchema = z.strictObject({
  target: z.enum(catalogModifierTargets),
  bonusType: z.enum(personalBonusTypes),
  value: z.union([z.number(), z.strictObject({ formula: z.string() })]),
  condition: modifierConditionSchema.optional(),
  stacksWithinEntry: z.literal(true).optional(),
});
const byKey = new Map(preview.entries.map((row) => [row.externalKey, row]));

/** The imported Item Ability, as a resolver catalog entry. */
export function abilityDefinition(key: string): CharacterSheetCatalogEntry {
  const entry = importedCatalogEntrySchema.parse(byKey.get(key));
  const detail = entry.detail;
  if (detail.kind !== 'itemAbility')
    throw new Error(`${key} is not an Item Ability`);
  if (!detail.appliesTo) throw new Error(`${key} applies to nothing`);
  return {
    _id: entry.externalKey,
    name: entry.name,
    ruleIdentity: entry.externalKey,
    ...(entry.sourceKey ? { sourceKey: entry.sourceKey } : {}),
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
      kind: 'itemAbility',
      appliesTo: z.enum(itemAbilityTargets).parse(detail.appliesTo),
      bonusEquivalent: detail.bonusEquivalent ?? 0,
      ...(detail.damageDice
        ? {
            damageDice: detail.damageDice.map(
              ({ dice, on, damageType, situation }) => ({
                dice,
                on,
                damageType,
                ...(situation === undefined ? {} : { situation }),
              }),
            ),
          }
        : {}),
      ...(detail.doublesThreat ? { doublesThreat: true } : {}),
      ...(detail.weaponDamageTypes
        ? { weaponDamageTypes: detail.weaponDamageTypes }
        : {}),
      ...(detail.choice ? { choice: detail.choice } : {}),
    },
  };
}

// Core Rulebook statistics (Table 6-4, p. 142; Table 6-6, p. 150) of the
// published items the abilities are placed on.
const weapon = (
  baseType: string,
  detail: Omit<WeaponDetail, 'baseType' | 'strengthDamage'>,
): WeaponDetail => ({ baseType, strengthDamage: 'melee', ...detail });
const armorItem = (
  id: string,
  name: string,
  detail: Extract<CharacterSheetCatalogEntry['detail'], { kind: 'item' }>,
): CharacterSheetCatalogEntry => ({
  _id: id,
  name,
  ruleIdentity: id,
  modifiers: [],
  detail,
});
export const baseItems: CharacterSheetCatalogEntry[] = [
  armorItem('longsword', 'Longsword', {
    kind: 'item',
    weapon: weapon('longsword', {
      proficiency: 'martial',
      handedness: 'oneHanded',
      attackType: 'melee',
      dice: '1d8',
      damageTypes: ['slashing'],
      threat: 19,
      mult: 2,
    }),
  }),
  armorItem('heavy-shield', 'Heavy steel shield', {
    kind: 'item',
    armor: {
      slot: 'shield',
      category: 'heavyShield',
      bonus: 2,
      maxDex: null,
      armorCheckPenalty: 2,
      asf: 15,
    },
    weapon: weapon('heavy shield', {
      proficiency: 'martial',
      handedness: 'oneHanded',
      attackType: 'melee',
      dice: '1d4',
      damageTypes: ['bludgeoning'],
      threat: 20,
      mult: 2,
    }),
  }),
  armorItem('full-plate', 'Full plate', {
    kind: 'item',
    armor: {
      slot: 'armor',
      category: 'heavy',
      bonus: 9,
      maxDex: 1,
      armorCheckPenalty: 6,
      asf: 35,
    },
  }),
];

export type ItemRow = {
  id: string;
  definition: string;
  state?: Omit<Extract<SheetEntry, { kind: 'item' }>['state'], 'kind'>;
};
export type RoutineRow = {
  id: string;
  weapon: string;
  offHand?: Extract<SheetEntry, { kind: 'attackRoutine' }>['state']['offHand'];
};

/**
 * A proficient sheet (Str 16, Dex 12, the rest 10, BAB 11) with the listed
 * items, their abilities and attack routines.
 */
export function abilitySheet({
  items,
  abilities,
  routines = [],
}: {
  items: ItemRow[];
  abilities: string[];
  routines?: RoutineRow[];
}): CharacterSheetInput {
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
              { category: 'heavy' },
              { category: 'shield' },
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
      ...items.map(
        ({ id, definition, state = {} }): SheetEntry => ({
          _id: id,
          kind: 'item',
          active: true,
          catalogEntryId: definition,
          state: { kind: 'item', ...state },
        }),
      ),
      ...routines.map(
        ({ id, weapon, offHand }): SheetEntry => ({
          _id: id,
          kind: 'attackRoutine',
          active: true,
          state: {
            kind: 'attackRoutine',
            name: id,
            weaponEntryId: weapon,
            hands: 'one',
            mode: 'melee',
            ...(offHand ? { offHand } : {}),
          },
        }),
      ),
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'fixture-base',
        modifiers: abilityKeys.map((key) => ({
          target: abilityTargets[key],
          bonusType: 'base' as const,
          value: key === 'strength' ? 16 : key === 'dexterity' ? 12 : 10,
        })),
      },
      {
        _id: 'bab',
        ruleIdentity: 'fixture-bab',
        modifiers: [{ target: 'bab', bonusType: 'untyped', value: 11 }],
      },
      ...baseItems,
      ...abilities.map(abilityDefinition),
    ],
  };
}
