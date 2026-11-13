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
import { importedCatalogEntrySchema } from '../../../src/lib/catalog/imported-entry-schema';
import { preview } from './data';

// Test-only adapter from the batch's full-corpus preview entries to resolver
// catalog entries. Stable keys serve as both the entry ID and its rule
// identity, so no assessment, release or database reference is constructed.
// A target or bonus type the resolver does not know fails the parse rather
// than silently contributing nothing.
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

export function sheetDefinition(key: string): CharacterSheetCatalogEntry {
  const entry = importedCatalogEntrySchema.parse(byKey.get(key));
  const detail = entry.detail;
  const base = {
    _id: entry.externalKey,
    name: entry.name,
    ruleIdentity: entry.externalKey,
    stacksWithItself: false,
    modifiers: entry.modifiers.map((modifier) =>
      modifierSchema.parse(modifier),
    ),
    ...(entry.countsAsRaces ? { countsAsRaces: entry.countsAsRaces } : {}),
    ...(entry.situationalNotes
      ? {
          situationalNotes: entry.situationalNotes.map((note) =>
            situationalNoteSchema.parse(note),
          ),
        }
      : {}),
  };
  if (detail.kind === 'race')
    return {
      ...base,
      detail: {
        kind: 'race',
        racialHitDice: detail.racialHitDice,
        creatureTypes: detail.creatureTypes,
        creatureSubtypes: detail.creatureSubtypes,
        racialTraits: detail.racialTraits ?? [],
        ...(detail.size ? { size: detail.size } : {}),
      },
    };
  if (detail.kind === 'racialTrait')
    return {
      ...base,
      detail: {
        kind: 'racialTrait',
        raceEntryIds: detail.raceKeys ?? [],
        replaces: detail.replaces ?? [],
        ...(detail.unresolvedReplacements
          ? { unresolvedReplacements: detail.unresolvedReplacements }
          : {}),
      },
    };
  throw new Error(`No sheet adapter for ${detail.kind} fixtures`);
}

/** Ten in every ability: the race and its traits supply every difference. */
const baseDefinition: CharacterSheetCatalogEntry = {
  _id: 'base',
  ruleIdentity: 'fixture-base',
  modifiers: abilityKeys.map((ability) => ({
    target: abilityTargets[ability],
    bonusType: 'base',
    value: 10,
  })),
};

/** A selected racial trait: an alternate, or a standard trait on its own. */
export function traitRow(catalogEntryId: string): SheetEntry {
  return {
    _id: `trait:${catalogEntryId}`,
    kind: 'racialTrait',
    active: true,
    catalogEntryId,
    state: { kind: 'racialTrait' },
  };
}

/**
 * A sheet with the base scores, an optional race (whose standard traits are
 * its Grants) and the selected racial traits. Every definition the sheet needs
 * comes from the committed preview fixture.
 */
export function racialTraitSheet({
  race,
  traits = [],
}: {
  race?: string;
  traits?: string[];
}): CharacterSheetInput {
  const keys = new Set(traits);
  if (race) {
    keys.add(race);
    const detail = byKey.get(race)?.detail;
    if (detail?.kind !== 'race') throw new Error(`Missing race ${race}`);
    for (const key of detail.racialTraits ?? []) keys.add(key);
  }
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
      ...(race
        ? [
            {
              _id: 'race-row',
              kind: 'race' as const,
              active: true,
              catalogEntryId: race,
              state: { kind: 'race' as const },
            },
          ]
        : []),
      ...traits.map(traitRow),
    ],
    catalogEntries: [baseDefinition, ...[...keys].map(sheetDefinition)],
  };
}
