import { z } from 'zod';
import {
  maxRuleValueBypassLength,
  maxRuleValueLocalSituationLength,
  maxRuleValueSituationKeyLength,
  ruleValueAmountSchema,
  type RuleValueContext,
  type RuleValueEntry,
} from './character-sheet-feature-numbers';

/**
 * The Situation a damage reduction or spell resistance line holds under, such
 * as the Robe of the Archmagi's "worn by an arcane spellcaster": a shared
 * Situation key or the entry's own local Situation.
 */
const ruleValueSituationSchema = z.union([
  z.string().min(1).max(maxRuleValueSituationKeyLength),
  z.strictObject({
    local: z.string().min(1).max(maxRuleValueLocalSituationLength),
  }),
]);
const ruleValueConditionSchema = z.strictObject({
  situation: ruleValueSituationSchema,
});

/** Damage reduction: a value and what bypasses it; `-` is DR x/—. */
export const damageReductionRuleValueSchema = z.strictObject({
  kind: z.literal('damageReduction'),
  amount: ruleValueAmountSchema,
  bypass: z.string().min(1).max(maxRuleValueBypassLength),
  condition: ruleValueConditionSchema.optional(),
});

/** Spell resistance (GLOSSARY), not the Situation "to overcome spell resistance". */
export const spellResistanceRuleValueSchema = z.strictObject({
  kind: z.literal('spellResistance'),
  amount: ruleValueAmountSchema,
  condition: ruleValueConditionSchema.optional(),
});

const lineFields = {
  entryId: z.string(),
  name: z.string(),
  ruleValueIndex: z.number(),
  /** Null while its formula can't be evaluated (the sheet warns). */
  value: z.number().nullable(),
};
const damageReductionLineSchema = z.strictObject({
  ...lineFields,
  bypass: z.string(),
  /** The line that gives its bypass's value. */
  applies: z.boolean(),
});
const spellResistanceLineSchema = z.strictObject({
  ...lineFields,
  applies: z.boolean(),
});

/**
 * Every damage reduction line, and the statistic: the highest value per
 * bypass, never a sum (root's default, 2026-11-17). A line under an
 * unselected Situation is `conditional` and never reaches `values`.
 */
export const damageReductionSchema = z.strictObject({
  values: z.array(
    z.strictObject({
      bypass: z.string(),
      value: z.number(),
      entryId: z.string(),
    }),
  ),
  lines: z.array(damageReductionLineSchema),
  conditional: z.array(
    damageReductionLineSchema
      .omit({ applies: true })
      .extend({ situation: ruleValueSituationSchema }),
  ),
});
export type DamageReduction = z.infer<typeof damageReductionSchema>;

/** Spell resistance: the highest applying line, never a sum. */
export const spellResistanceStatisticSchema = z.strictObject({
  value: z.number().nullable(),
  lines: z.array(spellResistanceLineSchema),
  conditional: z.array(
    spellResistanceLineSchema
      .omit({ applies: true })
      .extend({ situation: ruleValueSituationSchema }),
  ),
});
export type SpellResistanceStatistic = z.infer<
  typeof spellResistanceStatisticSchema
>;

type RuleValueSituation = z.infer<typeof ruleValueSituationSchema>;
type DamageReductionRuleValue = z.infer<typeof damageReductionRuleValueSchema>;
type SpellResistanceRuleValue = z.infer<typeof spellResistanceRuleValueSchema>;
type Line<Value> = {
  entryId: string;
  name: string;
  ruleValueIndex: number;
  value: number | null;
  ruleValue: Value;
  /** Set while the line's Situation is not selected. */
  situation?: RuleValueSituation;
};

export type ResistanceContext = RuleValueContext & {
  /** Whether a line's Situation is selected on this calculation. */
  situationApplies: (
    entry: RuleValueEntry,
    situation: RuleValueSituation,
  ) => boolean;
};

/** Each damage reduction and spell resistance line of a counting entry; a suppressed entry gives none. */
function listLines(ctx: ResistanceContext) {
  return ctx.activeEntries.flatMap((entry) =>
    entry.ruleValues.flatMap(
      (
        ruleValue,
        ruleValueIndex,
      ): Line<DamageReductionRuleValue | SpellResistanceRuleValue>[] => {
        if (
          ruleValue.kind !== 'damageReduction' &&
          ruleValue.kind !== 'spellResistance'
        )
          return [];
        const evaluation = ctx.evaluate(entry, ruleValueIndex);
        if (evaluation.kind === 'suppressed') return [];
        const situation = ruleValue.condition?.situation;
        return [
          {
            entryId: entry.sheetEntryId,
            name: entry.name,
            ruleValueIndex,
            value: evaluation.kind === 'value' ? evaluation.value : null,
            ruleValue,
            ...(situation && !ctx.situationApplies(entry, situation)
              ? { situation }
              : {}),
          },
        ];
      },
    ),
  );
}

/** The highest line with a value above 0; the first of equals. */
function highest<Item extends { value: number | null }>(
  lines: readonly Item[],
): Item | undefined {
  let best: Item | undefined;
  for (const line of lines)
    if (line.value !== null && line.value > (best?.value ?? 0)) best = line;
  return best;
}

export function resolveResistances(ctx: ResistanceContext): {
  damageReduction: DamageReduction;
  spellResistance: SpellResistanceStatistic;
} {
  const lines = listLines(ctx);
  return {
    damageReduction: resolveDamageReduction(
      lines.flatMap(({ ruleValue, ...line }) =>
        ruleValue.kind === 'damageReduction' ? [{ ...line, ruleValue }] : [],
      ),
    ),
    spellResistance: resolveSpellResistance(
      lines.flatMap(({ ruleValue, ...line }) =>
        ruleValue.kind === 'spellResistance' ? [{ ...line, ruleValue }] : [],
      ),
    ),
  };
}

function shownLine({ entryId, name, ruleValueIndex, value }: Line<unknown>) {
  return { entryId, name, ruleValueIndex, value };
}

function resolveDamageReduction(
  all: readonly Line<DamageReductionRuleValue>[],
): DamageReduction {
  const applying = all.filter((line) => !line.situation);
  const bypasses = [...new Set(applying.map((line) => line.ruleValue.bypass))];
  const winners = bypasses.flatMap((bypass) => {
    const best = highest(
      applying.filter((line) => line.ruleValue.bypass === bypass),
    );
    return best?.value ? [{ line: best, value: best.value }] : [];
  });
  return {
    // Highest first; equal values keep the order of their lines.
    values: [...winners]
      .sort((left, right) => right.value - left.value)
      .map(({ line, value }) => ({
        bypass: line.ruleValue.bypass,
        value,
        entryId: line.entryId,
      })),
    lines: applying.map((line) => ({
      ...shownLine(line),
      bypass: line.ruleValue.bypass,
      applies: winners.some((winner) => winner.line === line),
    })),
    conditional: all.flatMap((line) =>
      line.situation
        ? [
            {
              ...shownLine(line),
              bypass: line.ruleValue.bypass,
              situation: line.situation,
            },
          ]
        : [],
    ),
  };
}

function resolveSpellResistance(
  all: readonly Line<SpellResistanceRuleValue>[],
): SpellResistanceStatistic {
  const applying = all.filter((line) => !line.situation);
  const best = highest(applying);
  return {
    value: best?.value ?? null,
    lines: applying.map((line) => ({
      ...shownLine(line),
      applies: line === best,
    })),
    conditional: all.flatMap((line) =>
      line.situation ? [{ ...shownLine(line), situation: line.situation }] : [],
    ),
  };
}
