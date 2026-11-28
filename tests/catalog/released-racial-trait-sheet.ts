// pbl-released-racial-traits (PRD #251): the racial-trait resolver and sheet
// tests' seam over entries imported from the pinned store. It builds the
// definitions and sheets the racial-trait batch adapters built
// (tests/fixtures/racial-traits-NNN/sheet.ts and racial-traits-719/sheet.ts),
// and the lookups the batch units made over their preview, from imported
// entries instead: a batch's entries are looked up by name within its key
// list (released-racial-trait-keys.ts), as the batch units looked them up
// within their preview, and every other definition by its key.
import { z } from 'zod';
import type { Id } from '../../convex/_generated/dataModel';
import { outputSchema } from '../../src/lib/catalog/curation-output-schema';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';
import {
  abilityKeys,
  abilityTargets,
  bonusTypes,
  calculateCharacterSheetProjections,
  modifierConditionSchema,
  modifierTargets,
  resolveSheet,
  situationalNoteSchema,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
  type SheetEntry,
} from '../../src/lib/character-sheet';
import type { ReleasedEntry } from './released-entries';
// The resolver Modifier the landed race adapter parses: stable keys serve as
// the entry ID and rule identity, and an unknown target or bonus type fails.
import { modifierSchema } from './released-race-sheet';
import {
  racialTraitBatches,
  type RacialTraitBatch,
} from './released-racial-trait-keys';

export type ReleasedEntries = ReadonlyMap<string, ReleasedEntry>;

/** An imported entry, parsed as the importer's entry schema. */
export function importedEntry(entries: ReleasedEntries, key: string) {
  const row = entries.get(key);
  if (!row) throw new Error(`${key} was not imported`);
  return importedCatalogEntrySchema.parse(row);
}

/** An imported Racial Trait. */
function importedRacialTrait(entries: ReleasedEntries, key: string) {
  const entry = importedEntry(entries, key);
  if (entry.detail.kind !== 'racialTrait')
    throw new Error(`${key} is not a racial trait`);
  return { ...entry, detail: entry.detail };
}

/**
 * An imported race or Racial Trait as the racial-traits-387 to -401 batch
 * adapters built it (`sheetDefinition` there): its Modifiers and Notes, a
 * race's Racial Traits and a trait's race and replacements, nothing else of
 * the trait detail. racial-traits-395's adapter also carried a trait's
 * counted races (`countsAsRaces`).
 */
/** The fields every batch definition shares, its optional ones only when set. */
function batchBase(
  entry: ReturnType<typeof importedEntry>,
  countsAsRaces: boolean,
) {
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
    ...(countsAsRaces && entry.countsAsRaces
      ? { countsAsRaces: entry.countsAsRaces }
      : {}),
  };
}

function batchSheetDefinition(
  entries: ReleasedEntries,
  key: string,
  countsAsRaces: boolean,
): CharacterSheetCatalogEntry {
  const entry = importedEntry(entries, key);
  const detail = entry.detail;
  const base = batchBase(entry, countsAsRaces);
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
  throw new Error(`No sheet adapter for ${detail.kind} entries`);
}

/** Ten in every ability: the race and its traits supply every difference. */
const tenInEveryAbility: CharacterSheetCatalogEntry = {
  _id: 'base',
  ruleIdentity: 'fixture-base',
  modifiers: abilityKeys.map((ability) => ({
    target: abilityTargets[ability],
    bonusType: 'base',
    value: 10,
  })),
};

/** A selected racial trait: an alternate, or a standard trait on its own. */
function traitRow(catalogEntryId: string): SheetEntry {
  return {
    _id: `trait:${catalogEntryId}`,
    kind: 'racialTrait',
    active: true,
    catalogEntryId,
    state: { kind: 'racialTrait' },
  };
}

/**
 * The lookups and sheets one racial-trait batch unit (racial-traits-387 to
 * -401) made over its preview, over the imported entries:
 *
 * - `batchEntries`, the imported Racial Traits of the batch's key list, in
 *   its order;
 * - `entry(name)`, the list's trait of that name (or key: the units from
 *   racial-traits-389 on also took a key, for names two traits share);
 * - `modifiers(name)`, its Modifiers as the resolver takes them;
 * - `situation(name, index)`, the Situation of one of them, selected on its
 *   own entry; `indexOf(name, target, label)`, the Modifier on a target whose
 *   Situation names the label; `resolved(name, target, selected)`, one
 *   statistic of its Modifiers with those Situations selected, and
 *   `resolvedInSchool(name, target, school)`, for a spell of that school;
 * - `racialTraitSheet({ race, traits })`, a sheet with ten in every ability,
 *   the race (whose Racial Traits are its Grants) and the selected traits,
 *   each definition the batch adapter's reading of the imported entry;
 * - `identityRace(sheet, race, traits)`, that sheet with a test-only race:
 *   the race's identity granting only the listed traits;
 * - `total(sheet, target)`, the sheet's current total on a target.
 *
 * `countsAsRaces` builds the definitions as racial-traits-395's adapter did.
 */
export function racialTraitBatch(
  entries: ReleasedEntries,
  batch: RacialTraitBatch,
  { countsAsRaces = false }: { countsAsRaces?: boolean } = {},
) {
  const batchEntries = racialTraitBatches[batch].map((key) =>
    importedRacialTrait(entries, key),
  );
  function entry(nameOrKey: string) {
    const found = batchEntries.filter(
      (row) => row.externalKey === nameOrKey || row.name === nameOrKey,
    );
    if (found.length !== 1)
      throw new Error(`${batch} lists no single entry ${nameOrKey}`);
    return found[0]!;
  }
  function modifiers(name: string) {
    const row = entry(name);
    return row.modifiers.map((raw) => ({
      ...outputSchema.options[0]
        .omit({ kind: true })
        .extend({ target: z.enum(modifierTargets) })
        .parse(raw),
      sheetEntryId: row.externalKey,
      catalogEntryId: row.externalKey,
      source: row.externalKey,
      entryName: row.name,
      builtIn: false,
    }));
  }
  function situation(name: string, index: number) {
    const scope = modifiers(name)[index]?.condition?.situation;
    if (!scope)
      throw new Error(`Modifier ${index} of ${name} has no Situation`);
    if (typeof scope === 'string') return scope;
    if (!('local' in scope)) throw new Error('Expected a local Situation');
    return { local: scope.local, sheetEntryId: entry(name).externalKey };
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
  function resolved(name: string, target: string, selected: number[] = []) {
    return resolveSheet(modifiers(name), {
      situations: selected.map((index) => situation(name, index)),
    })[target as 'skill.per'].total;
  }
  /** One statistic of the trait's Modifiers for a spell of the school. */
  function resolvedInSchool(name: string, target: string, school: string) {
    return resolveSheet(modifiers(name), { school, situations: [] })[
      target as 'skill.per'
    ].total;
  }
  const sheetDefinition = (key: string) =>
    batchSheetDefinition(entries, key, countsAsRaces);
  function racialTraitSheet({
    race,
    traits = [],
  }: {
    race?: string;
    traits?: string[];
  }): CharacterSheetInput {
    const keys = new Set(traits);
    if (race) {
      keys.add(race);
      const detail = importedEntry(entries, race).detail;
      if (detail.kind !== 'race') throw new Error(`${race} is not a race`);
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
      catalogEntries: [tenInEveryAbility, ...[...keys].map(sheetDefinition)],
    };
  }
  function identityRace(
    sheet: CharacterSheetInput,
    raceKey: string,
    traits: string[],
  ): CharacterSheetInput {
    return {
      ...sheet,
      entries: [
        ...sheet.entries,
        {
          _id: 'race-row',
          kind: 'race' as const,
          active: true,
          catalogEntryId: raceKey,
          state: { kind: 'race' as const },
        },
      ],
      catalogEntries: [
        ...sheet.catalogEntries,
        {
          _id: raceKey,
          name: 'Race (identity only)',
          ruleIdentity: raceKey,
          modifiers: [],
          detail: { kind: 'race' as const, racialTraits: traits },
        },
        ...traits.map(sheetDefinition),
      ],
    };
  }
  const total = (sheet: CharacterSheetInput, target: string) =>
    calculateCharacterSheetProjections(sheet).current.breakdowns[
      target as 'ability.str'
    ].total;
  return {
    batchEntries,
    entry,
    modifiers,
    situation,
    indexOf,
    resolved,
    resolvedInSchool,
    racialTraitSheet,
    identityRace,
    total,
  };
}

/**
 * A sheet with ten in every ability, the race and the given entries, over
 * the definitions given, as racial-traits-719's adapter built it
 * (`raceSheet` there): the race's Racial Traits are its Grants.
 */
export function raceSheet({
  race,
  definitions,
  entries = [],
}: {
  race: string;
  definitions: CharacterSheetCatalogEntry[];
  entries?: SheetEntry[];
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
      {
        _id: 'race-row',
        kind: 'race',
        active: true,
        catalogEntryId: race,
        state: { kind: 'race' },
      },
      ...entries,
    ],
    catalogEntries: [tenInEveryAbility, ...definitions],
  };
}

/** A selected alternate Racial Trait. */
export function alternateRow(
  catalogEntryId: string,
): Extract<SheetEntry, { kind: 'racialTrait' }> {
  return {
    _id: `alternate:${catalogEntryId}`,
    kind: 'racialTrait',
    active: true,
    catalogEntryId,
    state: { kind: 'racialTrait' },
  };
}

/** The saved state of a race's granted trait, such as an ability choice. */
export function grantedTraitRow({
  race,
  trait,
  choice,
}: {
  race: string;
  trait: string;
  choice: string;
}): SheetEntry {
  return {
    _id: `granted:${trait}`,
    kind: 'racialTrait',
    active: true,
    catalogEntryId: trait,
    grantKey: { source: race, entry: trait },
    state: { kind: 'racialTrait', choice },
  };
}

// The integration tests' saved definitions. These bodies have no Catalog
// Entry ID conditions: accept only shared or local Situations, never imported
// external keys as stored references.
const localSituationSchema = z.union([
  z.string().min(1),
  z.strictObject({ local: z.string().min(1).max(4096) }),
]);
const localConditionSchema = modifierConditionSchema
  .pick({ situation: true, school: true })
  .extend({ situation: localSituationSchema.optional() })
  .strict();
const savedTraitModifier = outputSchema.options[0].omit({ kind: true }).extend({
  target: z.enum(modifierTargets),
  condition: localConditionSchema.optional(),
});
// A race's land speed is a `base` Modifier (stats-d2).
const savedRaceModifier = savedTraitModifier.extend({
  bonusType: z.enum(bonusTypes),
});
const savedNote = situationalNoteSchema
  .safeExtend({
    situation: localSituationSchema.optional(),
    condition: localConditionSchema.optional(),
  })
  .strict();

function savedFields(
  entry: ReturnType<typeof importedEntry>,
  modifier: typeof savedTraitModifier | typeof savedRaceModifier,
) {
  return {
    name: entry.name,
    ruleIdentity: entry.externalKey,
    stacksWithItself: false,
    sources: entry.sources,
    description: entry.description,
    modifiers: entry.modifiers.map((row) => modifier.parse(row)),
    ...(entry.situationalNotes
      ? {
          situationalNotes: entry.situationalNotes.map((note) =>
            savedNote.parse(note),
          ),
        }
      : {}),
  };
}

type EntryIds = ReadonlyMap<string, Id<'catalogEntry'>>;

function mapped(ids: EntryIds) {
  return (ref: string) => {
    const found = ids.get(ref);
    if (!found) throw new Error(`No inserted entry for ${ref}`);
    return found;
  };
}

/**
 * A character-scoped copy of an imported race, as the racial-traits-387 and
 * -388 integration tests saved one: its rule identity, sources, description,
 * Modifiers and Notes, and its Racial Traits mapped to the inserted IDs. No
 * assessment or Catalog Release is constructed.
 */
export function savedRaceDefinition(
  entries: ReleasedEntries,
  key: string,
  ids: EntryIds,
) {
  const entry = importedEntry(entries, key);
  if (entry.detail.kind !== 'race') throw new Error(`${key} is not a race`);
  return {
    ...savedFields(entry, savedRaceModifier),
    detail: {
      kind: 'race' as const,
      racialTraits: (entry.detail.racialTraits ?? []).map(mapped(ids)),
    },
  };
}

/**
 * A character-scoped copy of an imported Racial Trait, as the batch
 * integration tests saved one: its race and replacements mapped to the
 * inserted IDs, nothing else of the trait detail.
 */
export function savedTraitDefinition(
  entries: ReleasedEntries,
  key: string,
  ids: EntryIds,
) {
  const entry = importedRacialTrait(entries, key);
  return {
    ...savedFields(entry, savedTraitModifier),
    detail: {
      kind: 'racialTrait' as const,
      raceEntryIds: (entry.detail.raceKeys ?? []).map(mapped(ids)),
      replaces: (entry.detail.replaces ?? []).map(mapped(ids)),
    },
  };
}
