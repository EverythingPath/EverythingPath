// pbl-released-buffs (PRD #251): the buff resolver and sheet tests' seam over
// entries imported with importReleasedEntries. It builds what the buff batch
// adapters built from their preview (tests/fixtures/buffs-547/sheet.ts,
// pf-buffs-548/sheet.ts and pf-buffs-549/sheet.ts, the same code in each:
// `buffEntry`, `buffModifiers`, `buffSituations`, `total`) from imported
// entries instead, looking a buff up by the name a batch test used
// (released-buff-keys.ts) and checking the imported entry carries it; and
// it runs the admission gate on the released import as the release does.
import { z } from 'zod';
import { assessCatalogAdmission } from '../../scripts/catalog/admission';
import { readCommittedRegisterAdmission } from '../../scripts/catalog/register-admission';
import { importedCatalogEntrySchema } from '../../src/lib/catalog/imported-entry-schema';
import {
  catalogModifierTargets,
  modifierConditionSchema,
  personalBonusTypes,
  resolveSheet,
  type InputSourcedModifier,
  type LeafTarget,
  type ResolveOptions,
} from '../../src/lib/character-sheet';
import type { ReleasedEntry } from './released-entries';
import type { Artifact } from './rule-value-sheets';
import { buffBatches, type BuffBatch } from './released-buff-keys';

export type ReleasedEntries = ReadonlyMap<string, ReleasedEntry>;

/**
 * A buff Modifier as the batch adapters took it: a catalog target other than
 * a chosen ability, a personal bonus type, a number or a formula, an optional
 * condition and stacking flag, and nothing else.
 */
const modifierSchema = z.strictObject({
  target: z.enum(catalogModifierTargets).exclude(['ability.$choice']),
  bonusType: z.enum(personalBonusTypes),
  value: z.union([z.number(), z.strictObject({ formula: z.string() })]),
  condition: modifierConditionSchema.optional(),
  stacksWithinEntry: z.literal(true).optional(),
});

/** An imported entry as the batch previews held it; it refuses a missing key. */
export function importedBuff(entries: ReleasedEntries, key: string) {
  const row = entries.get(key);
  if (!row) throw new Error(`${key} was not imported`);
  return importedCatalogEntrySchema.parse(row);
}

export type ImportedBuff = ReturnType<typeof importedBuff>;

/** A Situation a buff's Modifiers name: shared, or local to its sheet entry. */
export type BuffSituation = string | { local: string; sheetEntryId: string };

/** A statistic's total with these buffs switched on. */
export function total(
  modifiers: readonly InputSourcedModifier[],
  target: LeafTarget,
  options: ResolveOptions = {},
) {
  return resolveSheet(modifiers, options)[target].total;
}

/**
 * The lookups one buff batch's tests made over their preview, over the
 * imported entries:
 *
 * - `entry(name)`, the batch's buff of that name (its key from
 *   released-buff-keys.ts; the imported entry must carry the name);
 * - `modifiers(name, { casterLevel })`, its Modifiers as switched-on sheet
 *   input, each parsed as the batch adapters parsed it (a Modifier outside
 *   that shape throws), with the effect's caster level when one is given and
 *   its key as sheet entry, catalog entry and Source;
 * - `situations(name)`, the shared and local Situations its Modifiers name,
 *   in Modifier order, each once.
 */
export function buffBatch(entries: ReleasedEntries, batch: BuffBatch) {
  const keys: Readonly<Record<string, string>> = buffBatches[batch].named;
  function entry(name: string) {
    const key = keys[name];
    if (key === undefined) throw new Error(`${batch} names no buff ${name}`);
    const row = importedBuff(entries, key);
    if (row.name !== name)
      throw new Error(`${key} is ${row.name}, not ${name}`);
    return row;
  }
  function modifiers(
    name: string,
    { casterLevel }: { casterLevel?: number } = {},
  ): InputSourcedModifier[] {
    const row = entry(name);
    return row.modifiers.map((raw, modifierIndex) => ({
      ...modifierSchema.parse(raw),
      modifierIndex,
      ...(casterLevel === undefined ? {} : { effectCasterLevel: casterLevel }),
      sheetEntryId: row.externalKey,
      catalogEntryId: row.externalKey,
      source: row.externalKey,
      entryName: row.name,
      builtIn: false,
    }));
  }
  function situations(name: string) {
    const row = entry(name);
    const out: BuffSituation[] = [];
    for (const modifier of row.modifiers) {
      const scope = modifier.condition?.situation;
      if (!scope) continue;
      if (typeof scope === 'string') out.push(scope);
      else if ('local' in scope)
        out.push({ local: scope.local, sheetEntryId: row.externalKey });
    }
    return out.filter(
      (scope, index) =>
        out.findIndex(
          (other) => JSON.stringify(other) === JSON.stringify(scope),
        ) === index,
    );
  }
  return { entry, modifiers, situations };
}

/** Where the admission gate puts an entry. */
export type GateState = 'admitted' | 'held' | 'dependentOmission' | 'failure';

/**
 * The admission gate's result for each entry of a released import, by key:
 * `assessCatalogAdmission` on the artifact `importReleasedEntries` returns,
 * with the committed notice register and frozen stored notices
 * (`readCommittedRegisterAdmission`), as `pnpm -s catalog:party-scope
 * --status` runs it on the whole import: the list it puts the entry on and
 * the reason it gives. It refuses an entry the gate puts on two lists.
 */
export async function releasedGateStates(artifact: Artifact) {
  const gate = assessCatalogAdmission({
    artifact,
    ...(await readCommittedRegisterAdmission()),
  });
  const states = new Map<string, readonly [GateState, string]>();
  for (const [state, rows] of [
    ['admitted', gate.admitted],
    ['held', gate.held],
    ['dependentOmission', gate.dependentOmissions],
    ['failure', gate.failures],
  ] as const)
    for (const { externalKey, reason } of rows) {
      if (states.has(externalKey))
        throw new Error(`The gate puts ${externalKey} on two lists`);
      states.set(externalKey, [state, reason]);
    }
  return states;
}
