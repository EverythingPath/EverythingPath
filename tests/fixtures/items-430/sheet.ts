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
import { importedCatalogEntrySchema } from '../../../src/lib/catalog/imported-entry-schema';
import { preview } from './data';

// Test-only adapter from the batch's full-corpus preview entries to resolver
// catalog entries. Stable keys serve as both the entry ID and its rule
// identity, so no assessment, release or database reference is constructed.
// A target or bonus type the resolver does not know fails the parse rather
// than silently contributing nothing. The splash weapons' weapon block is
// left out (its proficiency and handedness are not sheet categories, #761).
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

/** The item's imported Modifiers, Notes and armor block as a resolver item. */
export function itemDefinition(key: string): CharacterSheetCatalogEntry {
  const entry = importedCatalogEntrySchema.parse(byKey.get(key));
  const detail = entry.detail;
  if (detail.kind !== 'item') throw new Error(`${key} is not an item`);
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
      ...(detail.armor
        ? {
            armor: {
              ...detail.armor,
              category: detail.armor.category as never,
            },
          }
        : {}),
    },
  };
}

/**
 * A sheet with base scores (10 unless given), the listed items active, and
 * no class levels.
 */
export function itemSheet({
  items,
  scores = {},
}: {
  items: string[];
  scores?: Partial<Record<(typeof abilityKeys)[number], number>>;
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
          value: scores[ability] ?? 10,
        })),
      },
      ...items.map(itemDefinition),
    ],
  };
}
