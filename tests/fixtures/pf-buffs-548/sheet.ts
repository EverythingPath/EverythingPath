import { z } from 'zod';
import {
  catalogModifierTargets,
  modifierConditionSchema,
  personalBonusTypes,
  resolveSheet,
  type InputSourcedModifier,
  type LeafTarget,
  type ResolveOptions,
} from '../../../src/lib/character-sheet';
import { preview } from './data';

// Test-only adapter from the batch's full-corpus preview entries to resolver
// input. Stable keys serve as the sheet entry, catalog entry and Source, so no
// assessment, release or database reference is constructed.
const modifierSchema = z.strictObject({
  target: z.enum(catalogModifierTargets).exclude(['ability.$choice']),
  bonusType: z.enum(personalBonusTypes),
  value: z.union([z.number(), z.strictObject({ formula: z.string() })]),
  condition: modifierConditionSchema.optional(),
  stacksWithinEntry: z.literal(true).optional(),
});

export function buffEntry(name: string) {
  const row = preview.entries.find(
    (row) => row.externalKey === name || row.name === name,
  );
  if (!row) throw new Error(`Missing buff ${name}`);
  return row;
}

/** One buff's imported and reviewed Modifiers as switched-on sheet input. */
export function buffModifiers(
  name: string,
  { casterLevel }: { casterLevel?: number } = {},
): InputSourcedModifier[] {
  const row = buffEntry(name);
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

/** The local and shared Situations one buff's Modifiers name. */
export function buffSituations(name: string) {
  const row = buffEntry(name);
  const out: (string | { local: string; sheetEntryId: string })[] = [];
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

/** A statistic's total with these buffs switched on. */
export function total(
  modifiers: readonly InputSourcedModifier[],
  target: LeafTarget,
  options: ResolveOptions = {},
) {
  return resolveSheet(modifiers, options)[target].total;
}
