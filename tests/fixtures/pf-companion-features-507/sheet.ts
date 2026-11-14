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
import type { AnimalCompanionProgressionState } from '../../../src/lib/character-sheet-companion-progression';
import { resolveCompanionLinkedInput } from '../../../src/lib/character-sheet-linked-inputs';
import { importedCatalogEntrySchema } from '../../../src/lib/catalog/imported-entry-schema';
import { preview } from './data';

// Test-only adapter from the batch's full-corpus preview resources to resolver
// catalog entries. The stable key is both the entry ID and its rule identity;
// no assessment, release or database reference is constructed. A target or
// bonus type the resolver does not know fails the parse rather than silently
// contributing nothing.
const modifierSchema = z.strictObject({
  target: z.enum(catalogModifierTargets),
  bonusType: z.enum(personalBonusTypes),
  value: z.number(),
  condition: modifierConditionSchema.optional(),
});

/** A batch resource by its exact name. */
export function previewResource(name: string) {
  const found = preview.entries.filter((row) => row.name === name);
  if (found.length !== 1) throw new Error(`Expected one ${name} fixture`);
  return importedCatalogEntrySchema.parse(found[0]);
}

/** A batch resource as a manual sheet entry's definition. */
export function resourceDefinition(name: string): CharacterSheetCatalogEntry {
  const entry = previewResource(name);
  return {
    _id: entry.externalKey,
    name: entry.name,
    ruleIdentity: entry.externalKey,
    stacksWithItself: false,
    modifiers: entry.modifiers.map((modifier) =>
      modifierSchema.parse(modifier),
    ),
    situationalNotes: (entry.situationalNotes ?? []).map((note) =>
      situationalNoteSchema.parse(note),
    ),
    detail: { kind: 'manual' },
  };
}

function manualRow(catalogEntryId: string): SheetEntry {
  return {
    _id: `manual:${catalogEntryId}`,
    kind: 'manual',
    active: true,
    catalogEntryId,
    state: { kind: 'manual' },
  };
}

/** The CRB wolf companion's recorded choices (no ability increase chosen). */
export const wolf: AnimalCompanionProgressionState = {
  species: 'wolf',
  hpGained: null,
  skillRanks: {},
  abilityIncreases: [],
  advancementChoice: 'species',
  keep: false,
};

/**
 * A classless CRB wolf animal companion (its starting scores), with optional
 * batch resources recorded as manual entries.
 */
export function companionSheet(
  resources: string[] = [],
): CharacterSheetInput & {
  companionProgression: AnimalCompanionProgressionState;
} {
  const definitions = resources.map(resourceDefinition);
  return {
    characterKind: 'npc',
    entries: [
      {
        _id: 'base-row',
        kind: 'base',
        active: true,
        catalogEntryId: 'base',
        state: { kind: 'base' },
      },
      ...definitions.map((row) => manualRow(row._id)),
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'fixture-base',
        modifiers: abilityKeys.map((ability) => ({
          target: abilityTargets[ability],
          bonusType: 'base',
          value: {
            strength: 13,
            dexterity: 15,
            constitution: 15,
            intelligence: 2,
            wisdom: 12,
            charisma: 6,
          }[ability],
        })),
      },
      ...definitions,
    ],
    companionProgression: wolf,
  };
}

/** The progression options for a druid of the given level (nature bond). */
export function druidCompanion(level: number) {
  return {
    companionProgressionSources: [
      {
        sourceKey: 'nature-bond',
        ruleKind: 'druidCompanion' as const,
        counting: true,
      },
    ],
    companionLinkedInputs: [
      resolveCompanionLinkedInput({
        input: { kind: 'classLevels', classRuleIdentity: 'druid' },
        candidates: [
          { sourceKey: 'nature-bond', kind: 'available', value: level },
        ],
      }),
    ],
  };
}
