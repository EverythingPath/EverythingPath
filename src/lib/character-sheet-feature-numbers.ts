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
 * - 64 characters of key (rotation-4 per-day, rotation-5 dice): the Foundry
 *   tags it names, such as `classFeat_channelEnergy`, are under 30; 64 as a
 *   Situation key.
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

/** What a keyed rule value and its increases share: the Foundry tag. */
const ruleValueKeySchema = z.string().min(1).max(maxRuleValueKeyLength);

/**
 * A class feature's dice, such as Channel Energy's d6: `count`d`die`. A
 * `key` (rotation-5) lets a `diceIncrease` of that key add to it; without
 * one, nothing does.
 */
export const diceRuleValueSchema = z.strictObject({
  kind: z.literal('dice'),
  die: z.number().int().min(2),
  amount: ruleValueAmountSchema,
  key: ruleValueKeySchema.optional(),
});

/**
 * An increase to every keyed dice value of its key (rotation-5), such as the
 * Phylactery of Positive Channeling's 2: dice of the keyed value's die.
 */
export const diceIncreaseRuleValueSchema = z.strictObject({
  kind: z.literal('diceIncrease'),
  key: ruleValueKeySchema,
  amount: ruleValueAmountSchema,
});

/** What a per-day maximum counts: uses, rounds (rage) or points (a pool). */
export const dailyMaximumUnits = ['uses', 'rounds', 'points'] as const;

/**
 * A per-day maximum (owner 2026-11-17): how many times, rounds or points per
 * day a limited ability gives, keyed by its Foundry tag (`uses.maxFormula`
 * with `per: day`). The maximum only: nothing tallies uses.
 */
export const dailyMaximumRuleValueSchema = z.strictObject({
  kind: z.literal('dailyMaximum'),
  key: ruleValueKeySchema,
  unit: z.enum(dailyMaximumUnits),
  amount: ruleValueAmountSchema,
});

/** An increase to every per-day maximum of its key, such as Extra Channel's 2. */
export const dailyMaximumIncreaseRuleValueSchema = z.strictObject({
  kind: z.literal('dailyMaximumIncrease'),
  key: ruleValueKeySchema,
  amount: ruleValueAmountSchema,
});

/**
 * Why one entry's rule values cannot be stored together, if they can't (fix
 * r1): a dice increase adds once per active copy of its entry, so an entry
 * repeats no `diceIncrease` key; and it raises another entry's dice, so it
 * names no key its own entry's dice carry. Every write refuses them through
 * `storedRuleValuesSchema`.
 */
export function diceIncreaseConflict(
  ruleValues: readonly RuleValue[],
): string | undefined {
  const ownKeys = new Set(
    ruleValues.flatMap((ruleValue) =>
      ruleValue.kind === 'dice' && ruleValue.key !== undefined
        ? [ruleValue.key]
        : [],
    ),
  );
  const increased = new Set<string>();
  for (const ruleValue of ruleValues) {
    if (ruleValue.kind !== 'diceIncrease') continue;
    if (increased.has(ruleValue.key))
      return `An entry increases the dice of ${ruleValue.key} once; this one repeats it.`;
    if (ownKeys.has(ruleValue.key))
      return `A dice increase raises another entry’s dice; ${ruleValue.key} is this entry’s own.`;
    increased.add(ruleValue.key);
  }
  return undefined;
}

const sourceSchema = z.strictObject({ entryId: z.string(), name: z.string() });
export type RuleValueSource = z.infer<typeof sourceSchema>;

const diceNumberFields = {
  kind: z.literal('dice'),
  entryId: z.string(),
  ruleValueIndex: z.number(),
  die: z.number(),
  sources: z.array(sourceSchema),
};

/**
 * A feature number on the sheet: one dice rule value of a counting entry,
 * with every dice increase of its key added (rotation-5). `sources` names its
 * rows or entry, then each increase that adds, and `increases` (fix r1),
 * present once any adds, gives each one's entry and dice for the row's
 * breakdown. While its own formula can't be evaluated `count` is null (the
 * sheet warns) and no increase adds, so that variant has no `increases`
 * (fix r2).
 */
export const featureNumberSchema = z.union([
  z.strictObject({
    ...diceNumberFields,
    count: z.number(),
    increases: z.array(sourceSchema.extend({ count: z.number() })).optional(),
  }),
  z.strictObject({ ...diceNumberFields, count: z.null() }),
]);
export type FeatureNumber = z.infer<typeof featureNumberSchema>;

/**
 * A per-day maximum on the sheet: one `dailyMaximum` rule value of a counting
 * entry with every increase of its key added, the total floored at 0
 * (rotation-5). `value` is null while its formula or an increase's can't be
 * evaluated (the sheet warns).
 */
export const dailyMaximumSchema = z.strictObject({
  entryId: z.string(),
  ruleValueIndex: z.number(),
  key: z.string(),
  unit: z.enum(dailyMaximumUnits),
  value: z.number().nullable(),
  /** The maximum's entry, then each increase that adds to it. */
  sources: z.array(sourceSchema),
  /**
   * Present while the floor applies: the amount plus every increase came to
   * `sum`, below 0, so `value` is 0. The breakdown's own line for it.
   */
  floor: z.strictObject({ sum: z.number() }).optional(),
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

type Increase = { source: RuleValueSource; value: number | null };

/**
 * Each increase of one kind of a counting entry, by key; a suppressed entry
 * gives none. With `keys`, only increases of those keys are evaluated, so one
 * with nothing to add to never warns (rotation-5 fix r1).
 */
function listIncreases(
  ctx: RuleValueContext,
  kind: 'dailyMaximumIncrease' | 'diceIncrease',
  keys?: ReadonlySet<string>,
) {
  const byKey = new Map<string, Increase[]>();
  for (const entry of ctx.activeEntries)
    entry.ruleValues.forEach((ruleValue, ruleValueIndex) => {
      if (ruleValue.kind !== kind) return;
      if (keys && !keys.has(ruleValue.key)) return;
      const evaluation = ctx.evaluate(entry, ruleValueIndex);
      if (evaluation.kind === 'suppressed') return;
      const increase = {
        source: { entryId: entry.sheetEntryId, name: entry.name },
        value: evaluation.kind === 'value' ? evaluation.value : null,
      };
      const bucket = byKey.get(ruleValue.key);
      if (bucket) bucket.push(increase);
      else byKey.set(ruleValue.key, [increase]);
    });
  return byKey;
}

/** An amount plus each increase; null once any of them is unresolved. */
function addIncreases(
  evaluation: RuleValueEvaluation,
  increases: readonly Increase[],
): number | null {
  return increases.reduce<number | null>(
    (total, increase) =>
      total === null || increase.value === null ? null : total + increase.value,
    evaluation.kind === 'value' ? evaluation.value : null,
  );
}

/**
 * Each counting entry's dice, apart per entry: two classes' channel energy
 * stay two numbers. A keyed dice value (rotation-5) adds every dice increase
 * of its key, each copy or item once, in its own die; an unkeyed one is as
 * before. A suppressed entry gives none. An increase is evaluated only when
 * an unsuppressed keyed dice value of its key is on the sheet, so one with
 * nothing to add to gives nothing and never warns; one whose amount does not
 * resolve warns on its own entry (the context) and adds nothing, so the dice
 * read as without it (fix r1).
 */
export function resolveFeatureNumbers(ctx: RuleValueContext): FeatureNumber[] {
  const dice = ctx.activeEntries.flatMap((entry) =>
    entry.ruleValues.flatMap((ruleValue, ruleValueIndex) => {
      if (ruleValue.kind !== 'dice') return [];
      const evaluation = ctx.evaluate(entry, ruleValueIndex);
      return evaluation.kind === 'suppressed'
        ? []
        : [{ entry, ruleValue, ruleValueIndex, evaluation }];
    }),
  );
  const increases = listIncreases(
    ctx,
    'diceIncrease',
    new Set(dice.flatMap(({ ruleValue }) => ruleValue.key ?? [])),
  );
  return dice.map(
    ({ entry, ruleValue, ruleValueIndex, evaluation }): FeatureNumber => {
      const number = {
        kind: 'dice' as const,
        entryId: entry.sheetEntryId,
        ruleValueIndex,
        die: ruleValue.die,
        sources: ruleValueSources(ctx, entry, ruleValue.amount),
      };
      // Dice that do not resolve show as unresolved with their own warning,
      // and no increase adds to them (fix r2).
      if (evaluation.kind !== 'value') return { ...number, count: null };
      const added = (
        ruleValue.key === undefined ? [] : (increases.get(ruleValue.key) ?? [])
      ).flatMap(({ source, value }) =>
        value === null ? [] : [{ ...source, count: value }],
      );
      return {
        ...number,
        count: added.reduce(
          (total, { count }) => total + count,
          evaluation.value,
        ),
        sources: [
          ...number.sources,
          ...added.map(({ entryId, name }) => ({ entryId, name })),
        ],
        ...(added.length ? { increases: added } : {}),
      };
    },
  );
}

/**
 * Each counting entry's per-day maxima (owner 2026-11-17), apart per entry
 * and key: two classes' maxima stay two numbers. A maximum adds every
 * increase of its key, each copy of the increasing entry once; one that
 * can't be evaluated leaves the maximum with no number. The total (the
 * amount plus every increase) is floored at 0 (root, 2026-11-18: a negative
 * count is not a number of uses); the amount itself may be negative inside
 * the sum, so a Cleric 1 with Charisma 1 and Extra Channel channels
 * 3 − 5 + 2 = 0 times, and a formula's own `max(1, …)` still applies before
 * the increases. A suppressed entry gives none. The context evaluates their
 * formulas on permanent ability modifiers. The maximum only: nothing here
 * tallies uses.
 */
export function resolveDailyMaxima(ctx: RuleValueContext): DailyMaximum[] {
  const increases = listIncreases(ctx, 'dailyMaximumIncrease');
  return ctx.activeEntries.flatMap((entry) =>
    entry.ruleValues.flatMap((ruleValue, ruleValueIndex): DailyMaximum[] => {
      if (ruleValue.kind !== 'dailyMaximum') return [];
      const evaluation = ctx.evaluate(entry, ruleValueIndex);
      if (evaluation.kind === 'suppressed') return [];
      const added = increases.get(ruleValue.key) ?? [];
      const sum = addIncreases(evaluation, added);
      const floored = sum !== null && sum < 0;
      return [
        {
          entryId: entry.sheetEntryId,
          ruleValueIndex,
          key: ruleValue.key,
          unit: ruleValue.unit,
          value: floored ? 0 : sum,
          sources: [
            ...ruleValueSources(ctx, entry, ruleValue.amount),
            ...added.map(({ source }) => source),
          ],
          ...(floored ? { floor: { sum } } : {}),
        },
      ];
    }),
  );
}
