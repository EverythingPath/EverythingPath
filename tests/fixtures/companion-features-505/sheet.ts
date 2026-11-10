import {
  abilityKeys,
  abilityTargets,
  situationalNoteSchema,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
  type SheetEntry,
} from '../../../src/lib/character-sheet';
import { resolveCompanionLinkedInput } from '../../../src/lib/character-sheet-linked-inputs';
import { importedCatalogEntrySchema } from '../../../src/lib/catalog/imported-entry-schema';
import { preview } from './data';

/** A batch resource by its exact name. */
export function previewResource(name: string) {
  const found = preview.entries.filter((row) => row.name === name);
  if (found.length !== 1) throw new Error(`Expected one ${name} fixture`);
  return importedCatalogEntrySchema.parse(found[0]);
}

/**
 * Test-only adapter: a batch resource as a manual sheet entry's definition, so
 * its reviewed Notes reach the resolver. The stable key is both the entry ID
 * and its rule identity; no assessment, release or database reference is
 * constructed. These resources carry no Modifiers.
 */
export function resourceDefinition(name: string): CharacterSheetCatalogEntry {
  const entry = previewResource(name);
  if (entry.modifiers.length) throw new Error(`${name} has Modifiers`);
  return {
    _id: entry.externalKey,
    name: entry.name,
    ruleIdentity: entry.externalKey,
    stacksWithItself: false,
    modifiers: [],
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

/**
 * The Bestiary cat's scores (the familiar calculation's representative cat),
 * with optional batch resources recorded as manual entries.
 */
export function familiarSheet(resources: string[] = []): CharacterSheetInput {
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
            strength: 3,
            dexterity: 15,
            constitution: 8,
            intelligence: 2,
            wisdom: 12,
            charisma: 7,
          }[ability],
        })),
      },
      ...definitions,
    ],
  };
}

/** The familiar options for a master of the given familiar-granting level. */
export function familiarAtMasterLevel(level: number) {
  return {
    familiar: {
      baseCreatureKey: 'cat' as const,
      linkedInputs: [
        resolveCompanionLinkedInput({
          input: { kind: 'familiarProgressionLevels' },
          candidates: [
            { sourceKey: 'arcane-bond', kind: 'available', value: level },
          ],
        }),
      ],
    },
  };
}
