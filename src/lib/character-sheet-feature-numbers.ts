import { z } from 'zod';
import type { RuleValue } from './character-sheet';

/**
 * Application limits on rule values (fix r1), refused at every write that
 * stores them (`createOneOff`, `writeCatalogDefinition`), as a Modifier's
 * and a Situational Note's are:
 * - 16 per entry: a published entry gives at most one of each kind (dice,
 *   damage reduction, spell resistance); 16 leaves room for a homebrew entry
 *   with several bypass lines and still refuses an accidentally repeated list.
 * - 4096 characters of formula: what the formula evaluator accepts
 *   (`character-sheet-formulas.ts`) and a Modifier's formula limit, so a
 *   longer formula could never give a number.
 * - 64 characters of bypass: the longest printed bypasses, such as "cold iron
 *   and good" or "adamantine and bludgeoning", are under 30; 64 leaves room
 *   for a homebrew pair, as a shared Situation key's 64.
 * - A Situation as a Situational Note's: a key of 64, local text of 4096.
 */
export const maxRuleValuesPerEntry = 16;
export const maxRuleValueFormulaLength = 4096;
export const maxRuleValueBypassLength = 64;
export const maxRuleValueSituationKeyLength = 64;
export const maxRuleValueLocalSituationLength = 4096;

/**
 * How much a rule value gives: a whole number; the count of the feature's
 * active rows (the entry and each active increment naming it as its
 * `parentFeature`), times `per`; or a formula in the sheet's closed grammar.
 * A row an Archetype replaces is dormant, so it is not counted.
 */
export const ruleValueAmountSchema = z.union([
  z.number().int().min(0),
  z.strictObject({
    rows: z.strictObject({ per: z.number().int().min(1).optional() }),
  }),
  z.strictObject({
    formula: z.string().min(1).max(maxRuleValueFormulaLength),
  }),
]);
export type RuleValueAmount = z.infer<typeof ruleValueAmountSchema>;

/** A class feature's dice, such as Channel Energy's d6: `count`d`die`. */
export const diceRuleValueSchema = z.strictObject({
  kind: z.literal('dice'),
  die: z.number().int().min(2),
  amount: ruleValueAmountSchema,
});

const sourceSchema = z.strictObject({ entryId: z.string(), name: z.string() });
export type RuleValueSource = z.infer<typeof sourceSchema>;

/**
 * A feature number on the sheet: one rule value of a counting entry. `count`
 * is null while its formula can't be evaluated (the sheet warns).
 */
export const featureNumberSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('dice'),
    entryId: z.string(),
    ruleValueIndex: z.number(),
    count: z.number().nullable(),
    die: z.number(),
    sources: z.array(sourceSchema),
  }),
]);
export type FeatureNumber = z.infer<typeof featureNumberSchema>;

/** A counting entry that gives rule values. */
export type RuleValueEntry = {
  sheetEntryId: string;
  name: string;
  ruleValues: readonly RuleValue[];
};

/** What one rule value gives in this calculation. */
export type RuleValueEvaluation =
  | { kind: 'value'; value: number }
  /** Its formula can't be evaluated; the sheet warns. */
  | { kind: 'unresolved' }
  /** Its entry is suppressed (a condition), so it gives nothing. */
  | { kind: 'suppressed' };

/**
 * One calculation's rule values: its counting entries that give any, each
 * entry's counted rows, and the evaluation of each rule value's amount.
 */
export type RuleValueContext = {
  activeEntries: readonly RuleValueEntry[];
  rows: (entry: RuleValueEntry) => readonly RuleValueSource[];
  evaluate: (
    entry: RuleValueEntry,
    ruleValueIndex: number,
  ) => RuleValueEvaluation;
};

/** Where a rule value's amount comes from: the counted rows, or the entry. */
export function ruleValueSources(
  ctx: RuleValueContext,
  entry: RuleValueEntry,
  amount: RuleValueAmount,
): RuleValueSource[] {
  return typeof amount === 'object' && 'rows' in amount
    ? [...ctx.rows(entry)]
    : [{ entryId: entry.sheetEntryId, name: entry.name }];
}

/**
 * Each counting entry's dice, apart per entry: two classes' channel energy
 * stay two numbers. A suppressed entry gives none.
 */
export function resolveFeatureNumbers(ctx: RuleValueContext): FeatureNumber[] {
  return ctx.activeEntries.flatMap((entry) =>
    entry.ruleValues.flatMap((ruleValue, ruleValueIndex): FeatureNumber[] => {
      if (ruleValue.kind !== 'dice') return [];
      const evaluation = ctx.evaluate(entry, ruleValueIndex);
      if (evaluation.kind === 'suppressed') return [];
      return [
        {
          kind: 'dice',
          entryId: entry.sheetEntryId,
          ruleValueIndex,
          count: evaluation.kind === 'value' ? evaluation.value : null,
          die: ruleValue.die,
          sources: ruleValueSources(ctx, entry, ruleValue.amount),
        },
      ];
    }),
  );
}
