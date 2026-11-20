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
} from '../../../src/lib/character-sheet';
import { armorCategory } from '../../../src/lib/character-sheet-armor-categories';
import { importedCatalogEntrySchema } from '../../../src/lib/catalog/imported-entry-schema';
import { preview } from './data';

// Test-only adapter from the batch's full-corpus preview entries to resolver
// catalog entries. Stable keys serve as both the entry ID and its rule
// identity, so no assessment, release or database reference is constructed.
// A target, bonus type or armor category the resolver does not know fails the
// parse rather than silently contributing nothing.
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

/** The item's imported armor block as a resolver item; its bash weapon is left out. */
export function itemDefinition(key: string): CharacterSheetCatalogEntry {
  const entry = importedCatalogEntrySchema.parse(byKey.get(key));
  const detail = entry.detail;
  if (detail.kind !== 'item' || !detail.armor)
    throw new Error(`${key} is not armor or a shield`);
  const category = armorCategory(detail.armor.category);
  if (!category) throw new Error(`${key} has no known armor category`);
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
      consumable: detail.consumable,
      armor: { ...detail.armor, category: detail.armor.category as never },
    },
  };
}

/**
 * A sheet with base scores (Dexterity as given, 10 elsewhere), the listed
 * items worn, and the armor and shield Proficiency categories added by hand.
 */
export function armorSheet({
  items,
  dexterity = 10,
  proficiencies = [],
}: {
  items: string[];
  dexterity?: number;
  proficiencies?: ('light' | 'medium' | 'heavy' | 'shield' | 'towerShield')[];
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
            added: proficiencies.map((category) => ({ category })),
            removed: [],
          },
        },
      },
      ...items.map((key) => ({
        _id: `item:${key}`,
        kind: 'item' as const,
        active: true,
        catalogEntryId: key,
        state: { kind: 'item' as const },
      })),
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'fixture-base',
        modifiers: abilityKeys.map((ability) => ({
          target: abilityTargets[ability],
          bonusType: 'base',
          value: ability === 'dexterity' ? dexterity : 10,
        })),
      },
      ...items.map(itemDefinition),
    ],
  };
}
