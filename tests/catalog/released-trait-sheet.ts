// pbl-released-traits (PRD #251): the trait resolver and sheet tests' seam
// over entries imported with importReleasedEntries. It builds the definitions
// and sheets the twenty trait batch adapters built (tests/fixtures/
// traits-NNN/sheet.ts), and the lookups the batch units made over their
// preview, from imported entries instead, looking entries up by name within
// one batch's key list (released-trait-keys.ts) as the batch tests looked
// them up within their preview.
import { z } from 'zod';
import { outputSchema } from '../../src/lib/catalog/curation-output-schema';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheetProjections,
  modifierConditionSchema,
  modifierTargets,
  situationalNoteSchema,
  type CharacterSheetInput,
} from '../../src/lib/character-sheet';
import type { ReleasedEntry } from './released-entries';
import { traitBatches, type TraitBatch } from './released-trait-keys';

export type ReleasedEntries = ReadonlyMap<string, ReleasedEntry>;

// These bodies have no Catalog Entry ID conditions. Accept only shared or
// local Situations, never imported external keys as stored references.
const localSituationSchema = z.union([
  z.string().min(1),
  z.strictObject({ local: z.string().min(1).max(4096) }),
]);
const localConditionSchema = modifierConditionSchema
  .pick({ situation: true })
  .extend({ situation: localSituationSchema })
  .strict();
const sheetNoteSchema = situationalNoteSchema
  .safeExtend({
    situation: localSituationSchema.optional(),
    condition: localConditionSchema.optional(),
  })
  .strict();

/** An imported entry as a trait. */
function importedTrait(entries: ReleasedEntries, key: string) {
  const row = entries.get(key);
  if (!row) throw new Error(`${key} was not imported`);
  const entry = importedCatalogEntrySchema.parse(row);
  if (entry.detail.kind !== 'trait') throw new Error('Expected trait');
  return { ...entry, detail: entry.detail };
}

/**
 * A character-scoped definition of an imported trait, as the batch adapters'
 * `reviewedTraitDefinition` built one from a preview row: its rule identity,
 * mechanics and detail, without an assessment or Catalog Release.
 * Prerequisite atoms that name other entries' stable keys are left out; the
 * requirement stays readable as prerequisiteText.
 */
export function traitDefinition(entries: ReleasedEntries, key: string) {
  const entry = importedTrait(entries, key);
  return {
    name: `Released fixture: ${entry.name}`,
    ruleIdentity: entry.externalKey,
    description: entry.description,
    sources: entry.sources,
    ...(entry.prerequisiteText
      ? { prerequisiteText: entry.prerequisiteText }
      : {}),
    modifiers: entry.modifiers.map((modifier) =>
      outputSchema.options[0]
        .omit({ kind: true })
        .extend({
          target: z.enum(modifierTargets),
          condition: localConditionSchema.optional(),
        })
        .parse(modifier),
    ),
    ...(entry.situationalNotes
      ? {
          situationalNotes: entry.situationalNotes.map((note) =>
            sheetNoteSchema.parse(note),
          ),
        }
      : {}),
    detail: entry.detail,
  };
}

export type TraitDefinition = ReturnType<typeof traitDefinition>;

/**
 * The lookups and sheets one trait batch unit made over its preview, over
 * the imported entries of that batch's key list:
 *
 * - `batchEntries`, the imported traits of the list, in its order;
 * - `entry(name)`, the list's trait of that name;
 * - `modifiers(name)`, its Modifiers as the resolver takes them;
 * - `situation(name, index)`, the Situation of one of them, selected on its
 *   sheet entry;
 * - `indexOf(name, target, label)`, the Modifier on a target whose Situation
 *   names the label;
 * - `traitSheet(...names)`, a sheet with ability scores of 10 and the named
 *   traits, and `total(sheet, target)`, its current total on a target.
 */
export function traitBatch(entries: ReleasedEntries, batch: TraitBatch) {
  const batchEntries = traitBatches[batch].map((key) =>
    importedTrait(entries, key),
  );
  const byName = new Map(batchEntries.map((row) => [row.name, row]));
  if (byName.size !== batchEntries.length)
    throw new Error(`${batch} lists two entries with one name`);
  function entry(name: string) {
    const row = byName.get(name);
    if (!row) throw new Error(`${batch} lists no entry named ${name}`);
    return row;
  }
  function modifiers(name: string, sheetEntryId = entry(name).externalKey) {
    const row = entry(name);
    return row.modifiers.map((raw) => ({
      ...outputSchema.options[0]
        .omit({ kind: true })
        .extend({ target: z.enum(modifierTargets) })
        .parse(raw),
      sheetEntryId,
      catalogEntryId: row.externalKey,
      source: row.externalKey,
      entryName: row.name,
      builtIn: false,
    }));
  }
  function situation(
    name: string,
    index: number,
    sheetEntryId = entry(name).externalKey,
  ) {
    const scope = modifiers(name)[index]?.condition?.situation;
    if (!scope)
      throw new Error(`Modifier ${index} of ${name} has no Situation`);
    if (typeof scope === 'string') return scope;
    if (!('local' in scope)) throw new Error('Expected a local Situation');
    return { local: scope.local, sheetEntryId };
  }
  function indexOf(name: string, target: string, label: string) {
    const index = modifiers(name).findIndex(
      (row) =>
        row.target === target &&
        JSON.stringify(row.condition?.situation ?? '').includes(label),
    );
    if (index < 0)
      throw new Error(`No ${target} Modifier "${label}" on ${name}`);
    return index;
  }
  function traitSheet(...names: string[]): CharacterSheetInput {
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
        ...names.map((_, index) => ({
          _id: `trait-row-${index}`,
          kind: 'trait' as const,
          active: true,
          catalogEntryId: `trait-${index}`,
          state: { kind: 'trait' as const },
        })),
      ],
      catalogEntries: [
        {
          _id: 'base',
          ruleIdentity: 'fixture-base',
          modifiers: abilityKeys.map((ability) => ({
            target: abilityTargets[ability],
            bonusType: 'base',
            value: 10,
          })),
        },
        ...names.map((name, index) => ({
          _id: `trait-${index}`,
          ...traitDefinition(entries, entry(name).externalKey),
        })),
      ],
    };
  }
  const total = (sheet: CharacterSheetInput, target: string) =>
    calculateCharacterSheetProjections(sheet).current.breakdowns[
      target as 'skill.per'
    ].total;
  return {
    batchEntries,
    entry,
    modifiers,
    situation,
    indexOf,
    traitSheet,
    total,
  };
}
