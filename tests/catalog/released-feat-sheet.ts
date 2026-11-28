// pbl-released-feats-1 (PRD #251): the feat resolver and sheet tests' seam
// over entries imported with importReleasedEntries. It builds the definitions
// and sheets the feat batch adapters built (tests/fixtures/feats-NNN/sheet.ts),
// with the shape checks each of them made (`DefinitionShape`), and the lookups
// the batch units made over their preview, from imported entries instead,
// looking feats up by name within one batch's named keys
// (released-feat-keys.ts) as the batch tests looked them up within their
// preview. Later feat slices add their batches to released-feat-keys.ts and
// reuse these functions; pbl-released-feats-2 added the lookups by value and
// by position its batches' units made (`valueSituation`, `indexSituation`)
// and moved `assessmentStatus` here from the first slice's two files.
import { z } from 'zod';
import { outputSchema } from '../../src/lib/catalog/curation-output-schema';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';
import { reviewedAdmission } from '../../src/lib/catalog/reviewed-data';
import {
  abilityKeys,
  abilityTargets,
  modifierConditionSchema,
  modifierTargets,
  situationalNoteSchema,
  type AbilityScores,
  type CharacterSheetInput,
} from '../../src/lib/character-sheet';
import type { ReleasedEntry } from './released-entries';
import {
  featBatches,
  type FeatBatch,
  type SituationLookup,
} from './released-feat-keys';

export type ReleasedEntries = ReadonlyMap<string, ReleasedEntry>;

/** The status of a key's committed Attribution Assessment. */
export const assessmentStatus = (key: string) =>
  reviewedAdmission.assessments.find((row) => row.externalKey === key)?.status;

// The definitions' conditions name no Catalog Entry ID: a Situation is a
// shared key or local text, and a `whileActive` entry (an imported external
// key, never a stored reference) is not accepted; anything else fails the
// parse.
const localOnlySituationSchema = z.strictObject({
  local: z.string().min(1).max(4096),
});
const localSituationSchema = z.union([
  z.string().min(1),
  localOnlySituationSchema,
]);
const definitionConditionSchema = modifierConditionSchema
  .omit({ whileActive: true })
  .extend({ situation: localSituationSchema.optional() })
  .strict();
const definitionNoteSchema = situationalNoteSchema
  .safeExtend({
    situation: localSituationSchema.optional(),
    condition: definitionConditionSchema.optional(),
  })
  .strict();
const resolverModifierSchema = outputSchema.options[0]
  .omit({ kind: true })
  .extend({ target: z.enum(modifierTargets) });

/**
 * The checks of the batch adapter a definition replaces, on the imported
 * entry; an entry that fails them throws, as the old adapter's parse did:
 *
 * - `numeric`: `featFixtureDefinition` of feats-330 to feats-332. Each
 *   Modifier has only a target, a bonus type and a value: no condition, no
 *   `stacksWithinEntry`.
 * - `option`: `featFixtureDefinition` of feats-333 (Lunge). Each Modifier has
 *   a target, a bonus type, a value and the condition `{ option: true }` and
 *   nothing else; Notes are present and text only; prerequisites are present
 *   and each has a numeric BAB.
 * - `localSituation`: `heldFeatDefinition` of feats-334. A Modifier's or a
 *   Note's condition holds only a Situation, and every Situation is local
 *   text, never a shared key.
 * - `situation`: `heldFeatDefinition` and `reviewedFeatDefinition` of
 *   feats-335 to feats-338. As `localSituation`, but a Situation may also be a
 *   shared key.
 * - `resolver`: feats-332's `sheetWithFeat` in its unit, which took the
 *   Modifiers as the resolver parses them and checked nothing more.
 */
export type DefinitionShape =
  | 'numeric'
  | 'option'
  | 'localSituation'
  | 'situation'
  | 'resolver';

/** A condition of only a Situation, of the given kind (the batch adapters'). */
function situationShape(
  situation: typeof localOnlySituationSchema | typeof localSituationSchema,
) {
  const condition = z.strictObject({ situation });
  return z.object({
    modifiers: z.array(
      resolverModifierSchema.extend({ condition: condition.optional() }),
    ),
    situationalNotes: z
      .array(
        situationalNoteSchema
          .safeExtend({
            situation: situation.optional(),
            condition: condition.optional(),
          })
          .strict(),
      )
      .optional(),
  });
}

const numericModifierSchema = outputSchema.options[0]
  .pick({ target: true, bonusType: true, value: true })
  .extend({ target: z.enum(modifierTargets) });

const definitionShapes: Record<DefinitionShape, z.ZodType> = {
  numeric: z.object({ modifiers: z.array(numericModifierSchema.strict()) }),
  option: z.object({
    modifiers: z.array(
      numericModifierSchema
        .extend({ condition: z.strictObject({ option: z.literal(true) }) })
        .strict(),
    ),
    situationalNotes: z.array(z.strictObject({ text: z.string() })),
    prerequisites: z.array(z.object({ bab: z.number() })),
  }),
  localSituation: situationShape(localOnlySituationSchema),
  situation: situationShape(localSituationSchema),
  resolver: z.object({ modifiers: z.array(resolverModifierSchema) }),
};

/** An imported entry as a feat. */
function importedFeat(entries: ReleasedEntries, key: string) {
  const row = entries.get(key);
  if (!row) throw new Error(`${key} was not imported`);
  const entry = importedCatalogEntrySchema.parse(row);
  if (entry.detail.kind !== 'feat') throw new Error(`${key} is no feat`);
  return { ...entry, detail: entry.detail };
}

/**
 * A character-scoped definition of an imported feat, as the batch adapters'
 * `featFixtureDefinition`, `heldFeatDefinition` and `reviewedFeatDefinition`
 * built one from a preview row, after the checks of the adapter `shape`
 * names: its rule identity, description, sources, prerequisites, slot grants
 * (without their stable-key feat lists), Modifiers, Situational Notes and
 * detail. A reviewed repeatability is kept; the unusable
 * `repeatable: 'unreviewed'` is left out, as the batch adapters left it out.
 * No assessment or Catalog Release is built.
 */
export function featDefinition(
  entries: ReleasedEntries,
  key: string,
  shape: DefinitionShape,
) {
  const entry = importedFeat(entries, key);
  definitionShapes[shape].parse(entries.get(key));
  const { repeatable, ...rest } = entry.detail;
  const detail =
    repeatable === undefined || repeatable === 'unreviewed'
      ? rest
      : { ...rest, repeatable };
  return {
    name: `Released fixture: ${entry.name}`,
    ruleIdentity: entry.externalKey,
    description: entry.description,
    sources: entry.sources,
    ...(entry.prerequisiteText
      ? { prerequisiteText: entry.prerequisiteText }
      : {}),
    ...(entry.prerequisites ? { prerequisites: entry.prerequisites } : {}),
    ...(entry.grantsSlots
      ? {
          grantsSlots: entry.grantsSlots.map(
            ({ feats: _feats, ...slot }) => slot,
          ),
        }
      : {}),
    modifiers: entry.modifiers.map((modifier) =>
      resolverModifierSchema
        .extend({ condition: definitionConditionSchema.optional() })
        .parse(modifier),
    ),
    ...(entry.situationalNotes
      ? {
          situationalNotes: entry.situationalNotes.map((note) =>
            definitionNoteSchema.parse(note),
          ),
        }
      : {}),
    detail,
  };
}

export type FeatDefinition = ReturnType<typeof featDefinition>;

/**
 * The lookups and sheets one feat batch unit made over its preview, over the
 * imported entries of that batch's named keys:
 *
 * - `key(name)`, the key the batch names that feat by (a key only, for
 *   selecting a Situation or finding a record; it returns no entry);
 * - `entry(name)`, the imported entry, as the import emits it, which must
 *   carry that name, as the batch units found it by name. Every route below
 *   that returns an entry, its Modifiers, a Situation, a definition or a
 *   sheet for a named feat goes through it;
 * - `modifiers(name)`, its Modifiers as the resolver takes them, sourced to
 *   its key;
 * - `localSituation(name, target)`, the local Situation its batch unit's
 *   helper selected by target (the batch's `situationLookup`): `first`, the
 *   first Modifier on the target, which must have a local Situation;
 *   `firstLocal`, the first Modifier on the target whose Situation is not a
 *   shared key. It is selected on the feat key's sheet entry;
 * - `valueSituation(name, value)`, for a batch whose lookup is `value`: the
 *   local Situation of the first Modifier whose value is `value`, whatever
 *   its target, on the feat key's sheet entry;
 * - `indexSituation(name, index = 0)`, for a batch whose lookup is `index`:
 *   the local Situation of the Modifier at `index`, on the feat key's sheet
 *   entry;
 * - each of the three refuses a batch whose unit's helper chose otherwise,
 *   and a Modifier it selects without a local Situation;
 * - `definition(name, shape)`, its `featDefinition`;
 * - `featSheet(name, shape, scores)`, a sheet with a base entry of the given
 *   ability scores (10 for the others) and the feat's definition selected:
 *   the base entry's ID is `base` on row `base-row`, the feat's `feat` on row
 *   `feat-row`, as the batch adapters built it.
 */
export function featBatch(entries: ReleasedEntries, batch: FeatBatch) {
  const data: (typeof featBatches)[FeatBatch] = featBatches[batch];
  const named: Readonly<Record<string, string>> = data.named;
  function key(name: string) {
    const found = named[name];
    if (!found) throw new Error(`${batch} names no feat ${name}`);
    return found;
  }
  function entry(name: string) {
    const row = entries.get(key(name));
    if (!row) throw new Error(`${name} was not imported`);
    if (row.name !== name)
      throw new Error(`${key(name)} imports as ${row.name}, not ${name}`);
    return row;
  }
  function modifiers(name: string) {
    const row = entry(name);
    return row.modifiers.map((raw) => ({
      ...resolverModifierSchema.parse(raw),
      sheetEntryId: row.externalKey,
      catalogEntryId: row.externalKey,
      entryName: row.name,
      source: row.externalKey,
      builtIn: false,
    }));
  }
  const lookup: SituationLookup = data.situationLookup;
  function lookupOf(...allowed: SituationLookup[]) {
    if (!allowed.includes(lookup))
      throw new Error(`${batch}'s unit looks Situations up by ${lookup}`);
  }
  function local(
    name: string,
    modifier: ReturnType<typeof modifiers>[number] | undefined,
    selected: string,
  ) {
    const situation = modifier?.condition?.situation;
    if (typeof situation !== 'object' || !('local' in situation))
      throw new Error(`Missing local Situation: ${name}, ${selected}`);
    return { ...situation, sheetEntryId: entry(name).externalKey };
  }
  function localSituation(name: string, target: string) {
    lookupOf('first', 'firstLocal');
    return local(
      name,
      modifiers(name).find(
        (row) =>
          row.target === target &&
          (lookup === 'first' || typeof row.condition?.situation === 'object'),
      ),
      target,
    );
  }
  function valueSituation(name: string, value: number) {
    lookupOf('value');
    return local(
      name,
      modifiers(name).find((row) => row.value === value),
      `value ${value}`,
    );
  }
  function indexSituation(name: string, index = 0) {
    lookupOf('index');
    return local(name, modifiers(name)[index], `Modifier ${index}`);
  }
  function featSheet(
    name: string,
    shape: DefinitionShape,
    scores: Partial<AbilityScores> = {},
  ): CharacterSheetInput {
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
          _id: 'feat-row',
          kind: 'feat',
          active: true,
          catalogEntryId: 'feat',
          state: { kind: 'feat' },
        },
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
        {
          _id: 'feat',
          ...featDefinition(entries, entry(name).externalKey, shape),
        },
      ],
    };
  }
  return {
    key,
    entry,
    modifiers,
    localSituation,
    valueSituation,
    indexSituation,
    definition: (name: string, shape: DefinitionShape) =>
      featDefinition(entries, entry(name).externalKey, shape),
    featSheet,
  };
}
