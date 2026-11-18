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
 * - 64 characters of per-day key (rotation-4): the Foundry tags it names,
 *   such as `classFeat_channelEnergy`, are under 30; 64 as a Situation key.
 */
export const maxRuleValuesPerEntry = 16;
export const maxRuleValueFormulaLength = 4096;
export const maxRuleValueBypassLength = 64;
export const maxRuleValueSituationKeyLength = 64;
export const maxRuleValueLocalSituationLength = 4096;
export const maxRuleValueKeyLength = 64;

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

/** What a per-day maximum counts: uses, rounds (rage) or points (a pool). */
export const dailyMaximumUnits = ['uses', 'rounds', 'points'] as const;
const dailyKeySchema = z.string().min(1).max(maxRuleValueKeyLength);

/**
 * A per-day maximum (owner 2026-11-17): how many times, rounds or points per
 * day a limited ability gives, keyed by its Foundry tag (`uses.maxFormula`
 * with `per: day`). The maximum only: nothing tallies uses.
 */
export const dailyMaximumRuleValueSchema = z.strictObject({
  kind: z.literal('dailyMaximum'),
  key: dailyKeySchema,
  unit: z.enum(dailyMaximumUnits),
  amount: ruleValueAmountSchema,
});

/** An increase to every per-day maximum of its key, such as Extra Channel's 2. */
export const dailyMaximumIncreaseRuleValueSchema = z.strictObject({
  kind: z.literal('dailyMaximumIncrease'),
  key: dailyKeySchema,
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

/**
 * A per-day maximum on the sheet: one `dailyMaximum` rule value of a counting
 * entry with every increase of its key added. `value` is null while its
 * formula or an increase's can't be evaluated (the sheet warns).
 */
export const dailyMaximumSchema = z.strictObject({
  entryId: z.string(),
  ruleValueIndex: z.number(),
  key: z.string(),
  unit: z.enum(dailyMaximumUnits),
  value: z.number().nullable(),
  /** The maximum's entry, then each increase that adds to it. */
  sources: z.array(sourceSchema),
});
export type DailyMaximum = z.infer<typeof dailyMaximumSchema>;

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

/** Each increase of a counting entry, by key; a suppressed entry gives none. */
function listIncreases(ctx: RuleValueContext) {
  const byKey = new Map<
    string,
    { source: RuleValueSource; value: number | null }[]
  >();
  for (const entry of ctx.activeEntries)
    entry.ruleValues.forEach((ruleValue, ruleValueIndex) => {
      if (ruleValue.kind !== 'dailyMaximumIncrease') return;
      const evaluation = ctx.evaluate(entry, ruleValueIndex);
      if (evaluation.kind === 'suppressed') return;
      byKey.set(ruleValue.key, [
        ...(byKey.get(ruleValue.key) ?? []),
        {
          source: { entryId: entry.sheetEntryId, name: entry.name },
          value: evaluation.kind === 'value' ? evaluation.value : null,
        },
      ]);
    });
  return byKey;
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

/**
 * Each counting entry's per-day maxima (owner 2026-11-17), apart per entry
 * and key: two classes' maxima stay two numbers. A maximum adds every
 * increase of its key, each copy of the increasing entry once; one that
 * can't be evaluated leaves the maximum with no number. A suppressed entry
 * gives none. The context evaluates their formulas on permanent ability
 * modifiers. The maximum only: nothing here tallies uses.
 */
export function resolveDailyMaxima(ctx: RuleValueContext): DailyMaximum[] {
  const increases = listIncreases(ctx);
  return ctx.activeEntries.flatMap((entry) =>
    entry.ruleValues.flatMap((ruleValue, ruleValueIndex): DailyMaximum[] => {
      if (ruleValue.kind !== 'dailyMaximum') return [];
      const evaluation = ctx.evaluate(entry, ruleValueIndex);
      if (evaluation.kind === 'suppressed') return [];
      const added = increases.get(ruleValue.key) ?? [];
      return [
        {
          entryId: entry.sheetEntryId,
          ruleValueIndex,
          key: ruleValue.key,
          unit: ruleValue.unit,
          value: added.reduce<number | null>(
            (total, increase) =>
              total === null || increase.value === null
                ? null
                : total + increase.value,
            evaluation.kind === 'value' ? evaluation.value : null,
          ),
          sources: [
            ...ruleValueSources(ctx, entry, ruleValue.amount),
            ...added.map(({ source }) => source),
          ],
        },
      ];
    }),
  );
}
