import { z } from 'zod';
import type { RuleValue } from './character-sheet';
import { normalize } from './character-sheet-prerequisite-schema';

/**
 * Application limits on rule values (fix r1), refused at every write that
 * stores them (`createOneOff`, `writeCatalogDefinition`), as a Modifier's
 * and a Situational Note's are:
 * - 16 per entry: a published entry gives a few: one dice value, damage
 *   reduction or spell resistance, per-day maximum, or an increase per key it
 *   raises (a dice increase or a per-day increase; the rotation-5 test
 *   fixture of the Phylactery of Positive Channeling raises two keys' dice,
 *   as PCGen's record does, and no committed record gives it); 16 leaves
 *   room for a homebrew entry with several bypass lines or keys and still
 *   refuses an accidentally repeated list.
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
 * - An increase's choice (rotation-6): 1 to 16 options of 1 to 64
 *   characters, each with a character other than a space. An option names
 *   what the feat is taken for, a class ("Cleric") or a pool ("Bloodrage"),
 *   under 30 characters; 64 as a key; 16 leaves room for every name and tag
 *   one feature is known by and still refuses an accidentally pasted list.
 */
export const maxRuleValuesPerEntry = 16;
export const maxRuleValueFormulaLength = 4096;
export const maxRuleValueBypassLength = 64;
export const maxRuleValueSituationKeyLength = 64;
export const maxRuleValueLocalSituationLength = 4096;
export const maxRuleValueKeyLength = 64;
export const maxRuleValueChoiceOptions = 16;
export const maxRuleValueChoiceLength = 64;

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
 * What an increase may carry besides its key and amount (rotation-6).
 * `oncePerSource` (root, 2026-11-20: opt-in, not the default): of the active
 * increases of one kind and one key that carry it, that the choice gate does
 * not leave out, and that share a Source (the entry's
 * `sourceKey`, else its rule identity, as stacking uses), one is selected
 * (`countedPerSource`, rotation-6 fix r7): the largest resolved copy, which
 * contributes only when the receiving maximum's or dice's own amount
 * resolves; with every copy unresolved, the first, which adds nothing either;
 * the others are not counted. So in a test fixture two Bracelets of Mercy
 * carrying it add one use, not two (no committed record carries it); without
 * it every copy adds.
 * Only `true` is stored, and only on an increase: every other kind's strict
 * schema refuses it.
 */
const increaseChoiceOptionSchema = z
  .string()
  .min(1)
  .max(maxRuleValueChoiceLength)
  .regex(/\S/);
const increaseFields = {
  oncePerSource: z.literal(true).optional(),
  /**
   * rotation-6 part C: the reviewed options the increase is for. It adds
   * only while its entry has a saved choice that is one of them
   * (`choiceMatches`); without the field it adds whatever the choice is.
   * Nothing about the entry's kind is checked when it is written: an entry
   * whose choice the gate does not read (`RuleValueEntry.readsChoice`, fix
   * r3) never adds it (root, 2026-11-20), whatever choice it saves.
   */
  choice: z
    .tuple([increaseChoiceOptionSchema], increaseChoiceOptionSchema)
    .refine((options) => options.length <= maxRuleValueChoiceOptions)
    .optional(),
};

/**
 * Whether a saved choice is one of an increase's options: trimmed and
 * case-insensitively, as the sheet compares a feat's choice in its duplicate
 * check and prerequisites (`normalize`). No choice, or a blank one, matches
 * nothing.
 */
export function choiceMatches(
  choice: string | null,
  options: readonly string[],
) {
  const saved = normalize(choice ?? '');
  return saved !== '' && options.some((option) => normalize(option) === saved);
}

/**
 * One increase's options compared as `choiceMatches` compares them and in no
 * order: two lists with the same key are the same options. The choice
 * warning's message and its fingerprint both compare by it (rotation-6 fix
 * r5).
 */
export function choiceOptionsKey(options: readonly string[]) {
  return JSON.stringify([...new Set(options.map(normalize))].sort());
}

/**
 * The facts a choice warning is accepted for (rotation-6 fix r4): the saved
 * choice and the options of each increase it names, by `choiceOptionsKey`,
 * so an acceptance covers those options and that choice alone
 * (`rules-checks.md`).
 */
export function choiceWarningFacts(
  choice: string | null,
  optionLists: readonly (readonly string[])[],
) {
  const lists = optionLists.map(choiceOptionsKey);
  return [normalize(choice ?? ''), [...new Set(lists)].sort()] as const;
}

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
  ...increaseFields,
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
  /**
   * rotation-6 part J: the maximum is part of another one of its key and
   * unit, as Rage (Cleric)'s rounds "stack with any rounds of rage you might
   * have from levels of barbarian" (Foundry rage-cleric.HJMvo9iDrDwjLAgM,
   * at its pin 418761d2): it adds to that maximum instead of
   * standing alone (`resolveDailyMaxima`). Only `true` is stored.
   */
  joins: z.literal(true).optional(),
});

/** An increase to every per-day maximum of its key, such as Extra Channel's 2. */
export const dailyMaximumIncreaseRuleValueSchema = z.strictObject({
  kind: z.literal('dailyMaximumIncrease'),
  key: ruleValueKeySchema,
  amount: ruleValueAmountSchema,
  ...increaseFields,
});

/**
 * Why one entry's rule values cannot be stored together, if they can't (fix
 * r1): a dice increase adds once per active copy of its entry, so one entry
 * carries no two increases of one key (increases of one key on different
 * entries, or on independent copies, each add); and it raises another
 * entry's dice, so it
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

/**
 * An increase not counted, and why (rotation-6 part N): another
 * increase of its kind and key from the same Source is the selected one
 * (`counted`, `oncePerSource`; rotation-6 fix r7): the largest resolved copy,
 * which contributes only when the receiving maximum's or dice's own amount
 * resolves, or with every copy unresolved the first, which adds nothing
 * either; or it is for a choice and its entry has no saved choice
 * that is one of its options: none saved (`noChoice`), another (`otherChoice`,
 * with that choice, trimmed), or an entry whose choice the gate does not read
 * (`choiceNotRead`, fix r3; fix r4: such an entry may save a choice, a
 * race's weapon proficiency choice for one, that can still never affect the
 * increase), whose increase is never counted. The row shows each as a muted
 * chip.
 */
const notCountedSchema = z.discriminatedUnion('reason', [
  sourceSchema.extend({
    reason: z.literal('sameSource'),
    counted: sourceSchema,
  }),
  sourceSchema.extend({ reason: z.literal('noChoice') }),
  sourceSchema.extend({ reason: z.literal('choiceNotRead') }),
  sourceSchema.extend({ reason: z.literal('otherChoice'), choice: z.string() }),
]);
type IncreaseNotCounted = z.infer<typeof notCountedSchema>;

const diceNumberFields = {
  kind: z.literal('dice'),
  entryId: z.string(),
  ruleValueIndex: z.number(),
  die: z.number(),
  sources: z.array(sourceSchema),
  /** Present once a dice increase of its key is not counted (rotation-6). */
  notCounted: z.array(notCountedSchema).optional(),
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
   * `sum`, below 0, so `value` is 0. The calculation field; the row shows it
   * as a chip beside the maximum.
   */
  floor: z.strictObject({ sum: z.number() }).optional(),
  /**
   * Present once a per-day increase of its key is not counted (rotation-6).
   */
  notCounted: z.array(notCountedSchema).optional(),
});
export type DailyMaximum = z.infer<typeof dailyMaximumSchema>;

/** A counting entry that gives rule values. */
export type RuleValueEntry = {
  sheetEntryId: string;
  name: string;
  /** Its Source, as stacking reads it: `sourceKey`, else the rule identity. */
  source: string;
  /** Its saved choice (a feat's "taken for"), if its state has one. */
  choice: string | null;
  /**
   * Whether the gate reads this entry's saved choice (rotation-6 fix r3):
   * text saved in its row's own editor, on the kinds the sheet records one
   * that way. False for every other entry, whatever choice it may save, and
   * its increase for a choice is then never counted.
   */
  readsChoice: boolean;
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
  /**
   * Whether a rule value is decided suppressed before anything about it is
   * evaluated (rotation-5 fix r2 for keyed dice and dice increases,
   * rotation-6 fix r1 for the per-day kinds): `evaluate` then gives
   * `suppressed` without evaluating its formula.
   */
  suppressed: (entry: RuleValueEntry, ruleValueIndex: number) => boolean;
  evaluate: (
    entry: RuleValueEntry,
    ruleValueIndex: number,
  ) => RuleValueEvaluation;
  /**
   * An entry's increase that a number of its kind and key on the sheet
   * receives (rotation-6 fix r6) is not counted for its choice
   * (rotation-6 part C): none saved (`missing`), or one that none of the
   * entry's increases is for (`unmatched`); `options` are what that increase
   * is for, `ruleValueIndex` which of the entry's rule values it is. The
   * sheet warns once per entry, naming every such increase's options
   * (rotation-6 fix r1) and counting the increases (fix r6).
   */
  warnChoice: (
    entry: RuleValueEntry,
    problem: 'missing' | 'unmatched',
    increase: ChoiceIncrease,
  ) => void;
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

/** An increase and, when it carries `oncePerSource`, its entry's Source. */
type ListedIncrease = Increase & { oncePerSource?: string };

/** An increase its entry's choice leaves out, with what it is for. */
type NotChosen = ChoiceIncrease & {
  line: IncreaseNotCounted;
  entry: RuleValueEntry;
};

/** An increase left out for its choice: what it is for, and which it is. */
export type ChoiceIncrease = {
  options: readonly string[];
  ruleValueIndex: number;
};

/**
 * The increase that counts for each Source among one kind's increases of
 * one key that carry `oncePerSource` and passed the choice gate (rotation-6
 * part S): the largest resolved one, the first of equal ones; with none of
 * the Source resolved (rotation-6 fix r1), the first, so a maximum it raises
 * has no number, since one of them adds and none has one, while the group
 * adds no dice to the dice it raises, since an unresolved increase adds no
 * dice; a resolved base still receives the other increases that count
 * (fix r2, fix r6). The one picked adds only when the receiving maximum's or
 * dice's own amount resolves.
 */
function countedPerSource(increases: readonly ListedIncrease[]) {
  const counted = new Map<string, ListedIncrease>();
  for (const increase of increases) {
    const { oncePerSource, value } = increase;
    if (oncePerSource === undefined) continue;
    const best = counted.get(oncePerSource);
    if (
      !best ||
      (value !== null && (best.value === null || value > best.value))
    )
      counted.set(oncePerSource, increase);
  }
  return counted;
}

/**
 * One key's increases, as they add (rotation-6 part S): among those that
 * carry `oncePerSource`, per Source, only the one `countedPerSource` picks
 * adds; the others, resolved or not, are not counted (an unresolved one
 * beside a resolved one of its Source leaves nothing unresolved, rotation-6 fix r1).
 * An increase without the field adds per copy as before, an unresolved one
 * leaving its maximum unresolved. Those its entry's choice left out
 * (`notChosen`) come first among the lines not counted.
 */
function countIncreases({
  listed,
  notChosen,
}: {
  listed: readonly ListedIncrease[];
  notChosen: readonly NotChosen[];
}) {
  const perSource = countedPerSource(listed);
  const counted: Increase[] = [];
  const notCounted: IncreaseNotCounted[] = notChosen.map(({ line }) => line);
  for (const increase of listed) {
    const winner =
      increase.oncePerSource === undefined
        ? increase
        : (perSource.get(increase.oncePerSource) ?? increase);
    if (winner === increase)
      counted.push({ source: increase.source, value: increase.value });
    else
      notCounted.push({
        ...increase.source,
        reason: 'sameSource',
        counted: winner.source,
      });
  }
  return { counted, notCounted, notChosen };
}

type IncreaseRuleValue = Extract<
  RuleValue,
  { kind: 'dailyMaximumIncrease' | 'diceIncrease' }
>;

/**
 * The line of an increase its entry's choice leaves out (rotation-6 part C):
 * an entry whose choice the gate does not read (fix r3), whatever its state
 * holds;
 * else none saved, or another one, trimmed. None when it has no `choice` or
 * the saved choice is one of its options.
 */
function notChosenLine(
  entry: RuleValueEntry,
  { choice: options }: IncreaseRuleValue,
): IncreaseNotCounted | undefined {
  if (!options) return undefined;
  const source = { entryId: entry.sheetEntryId, name: entry.name };
  if (!entry.readsChoice) return { ...source, reason: 'choiceNotRead' };
  if (choiceMatches(entry.choice, options)) return undefined;
  const saved = (entry.choice ?? '').trim();
  return saved
    ? { ...source, reason: 'otherChoice', choice: saved }
    : { ...source, reason: 'noChoice' };
}

type KeyIncreases = {
  listed: ListedIncrease[];
  notChosen: NotChosen[];
};
function keyIncreases(byKey: Map<string, KeyIncreases>, key: string) {
  const existing = byKey.get(key);
  if (existing) return existing;
  const created: KeyIncreases = { listed: [], notChosen: [] };
  byKey.set(key, created);
  return created;
}

/**
 * Each increase of one kind of a counting entry, by key; a suppressed entry
 * gives none and is decided suppressed first (rotation-6 fix r1). With `keys`, only
 * increases of those keys are evaluated, so one with nothing to add to never
 * warns (rotation-5 fix r1). One whose entry's choice is none of its options
 * is not counted (rotation-6 part C) and is not evaluated, since it cannot
 * apply (rotation-6 fix r1), so its formula never warns and it takes no part in
 * `oncePerSource`; each key's other increases are counted by
 * `countIncreases`, once. The first lookup of a key, by the first number of
 * this kind that receives it (a per-day maximum for per-day increases, dice
 * for dice increases; rotation-6 fix r6), raises its choice warnings
 * (`warnChoices`).
 */
function listIncreases(
  ctx: RuleValueContext,
  kind: IncreaseRuleValue['kind'],
  keys?: ReadonlySet<string>,
) {
  const byKey = new Map<string, KeyIncreases>();
  for (const entry of ctx.activeEntries)
    entry.ruleValues.forEach((ruleValue, ruleValueIndex) => {
      if (ruleValue.kind !== kind || (keys && !keys.has(ruleValue.key))) return;
      // Suppression first, then the choice, then the formula (rotation-6 fix r1).
      if (ctx.suppressed(entry, ruleValueIndex)) return;
      const line = notChosenLine(entry, ruleValue);
      if (line && ruleValue.choice) {
        keyIncreases(byKey, ruleValue.key).notChosen.push({
          line,
          entry,
          options: ruleValue.choice,
          ruleValueIndex,
        });
        return;
      }
      const evaluation = ctx.evaluate(entry, ruleValueIndex);
      if (evaluation.kind === 'suppressed') return;
      keyIncreases(byKey, ruleValue.key).listed.push({
        source: { entryId: entry.sheetEntryId, name: entry.name },
        value: evaluation.kind === 'value' ? evaluation.value : null,
        ...(ruleValue.oncePerSource ? { oncePerSource: entry.source } : {}),
      });
    });
  const counted = new Map(
    [...byKey].map(([key, increases]) => [key, countIncreases(increases)]),
  );
  // Each key's choice warnings are raised once, for its first receiving
  // number, not again for every maximum or dice of the key (fix r2).
  const warned = new Set<string>();
  return (key: string | undefined) => {
    const increases =
      (key === undefined ? undefined : counted.get(key)) ?? noIncreases;
    if (key !== undefined && !warned.has(key)) {
      warned.add(key);
      warnChoices(ctx, increases.notChosen);
    }
    return increases;
  };
}

type CountedIncreases = ReturnType<typeof countIncreases>;
const noIncreases: CountedIncreases = {
  counted: [],
  notCounted: [],
  notChosen: [],
};

/**
 * Each increase that a number of its kind and key on the sheet receives and
 * that its entry's choice leaves out warns on its entry (rotation-6 part C), naming what it is for: a missing
 * choice always; another choice only when none of the entry's increases is
 * for it, since an entry with one output per pool, each for its own choice
 * (an Extra-Rage-like record), leaves the other pool's output uncounted by
 * design. An entry whose choice the gate does not read warns nothing (fix
 * r3): no choice it could save would count the increase, so no advisory asks
 * for one; its line says why.
 */
function warnChoices(ctx: RuleValueContext, notChosen: readonly NotChosen[]) {
  for (const { line, entry, options, ruleValueIndex } of notChosen) {
    const increase = { options, ruleValueIndex };
    if (line.reason === 'noChoice') ctx.warnChoice(entry, 'missing', increase);
    else if (line.reason === 'otherChoice' && !choosesAnIncrease(entry))
      ctx.warnChoice(entry, 'unmatched', increase);
  }
}

/** Whether the entry's saved choice is one that any of its increases is for. */
function choosesAnIncrease(entry: RuleValueEntry) {
  return entry.ruleValues.some(
    (ruleValue) =>
      (ruleValue.kind === 'dailyMaximumIncrease' ||
        ruleValue.kind === 'diceIncrease') &&
      ruleValue.choice !== undefined &&
      choiceMatches(entry.choice, ruleValue.choice),
  );
}

/** An amount plus each increase; null once any of them is unresolved. */
function addIncreases(
  evaluation: RuleValueEvaluation,
  increases: readonly Pick<Increase, 'value'>[],
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
 * of its key that counts (`countIncreases`), each copy or item once unless
 * it counts once per Source, in its own die; an unkeyed one is as before. A
 * suppressed entry gives none. An increase is evaluated only when an
 * unsuppressed keyed dice value of its key is on the sheet and, if it is for
 * a choice, the gate reads its entry's choice and it is one of its options
 * (rotation-6 fix r1, fix r3), so one with nothing to add to gives nothing
 * and never warns; one whose amount does not resolve warns on its own entry
 * (the context) and adds nothing, so the dice read as without it (fix r1).
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
      const keyed = increases(ruleValue.key);
      const { notCounted } = keyed;
      const number = {
        kind: 'dice' as const,
        entryId: entry.sheetEntryId,
        ruleValueIndex,
        die: ruleValue.die,
        sources: ruleValueSources(ctx, entry, ruleValue.amount),
        // Listed resolved or not: they are the increases' state, not the dice's.
        ...(notCounted.length ? { notCounted } : {}),
      };
      // Dice that do not resolve show as unresolved with their own warning,
      // and no increase adds to them (fix r2).
      if (evaluation.kind !== 'value') return { ...number, count: null };
      const added = keyed.counted.flatMap(({ source, value }) =>
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
 * increase of its key that counts (`countIncreases`: each copy of the
 * increasing entry once, unless the increase counts once per Source or is
 * for a choice its entry has not saved or whose choice is not read); one that counts
 * and can't be evaluated leaves the maximum with no number. The total (the
 * amount plus every increase) is floored at 0 (root, 2026-11-18: a negative
 * count is not a number of uses); the amount itself may be negative inside
 * the sum, so a Cleric 1 with Charisma 1 and Extra Channel channels
 * 3 − 5 + 2 = 0 times, and a formula's own `max(1, …)` still applies before
 * the increases. A suppressed entry gives none, decided before its formulas
 * are evaluated (rotation-6 fix r1). The context evaluates their formulas on permanent
 * ability modifiers. The maximum only: nothing here
 * tallies uses.
 *
 * rotation-6 part J: a maximum with `joins` adds its amount to the first
 * unsuppressed maximum of its key and unit without `joins` (its host), like
 * an increase, named in the host's sources after the host's own, and gives
 * no maximum of its own; with no such host, whatever maxima of other keys or
 * units are on the sheet, the first joining one of its key and unit is the
 * host and the others join it. The floor applies to the joined sum. A
 * joining maximum joins only a maximum of its own unit.
 */
export function resolveDailyMaxima(ctx: RuleValueContext): DailyMaximum[] {
  const increases = listIncreases(ctx, 'dailyMaximumIncrease');
  const maxima = presentDailyMaxima(ctx).flatMap(
    (maximum): ResolvedMaximum[] => {
      const evaluation = ctx.evaluate(maximum.entry, maximum.ruleValueIndex);
      // A present maximum is not suppressed (`ctx.suppressed` is the check
      // `evaluate` makes for the per-day kinds), so none is dropped here.
      return evaluation.kind === 'suppressed'
        ? []
        : [{ ...maximum, evaluation }];
    },
  );
  const joinedTo = joinMaxima(maxima);
  const joining = new Set([...joinedTo.values()].flat());
  return maxima.flatMap((maximum) =>
    joining.has(maximum)
      ? []
      : [
          joinedMaximum(ctx, {
            maximum,
            joined: joinedTo.get(maximum) ?? [],
            increases: increases(maximum.ruleValue.key),
          }),
        ],
  );
}

/**
 * reward-target fix r3: the per-day maxima the sheet has, the first step of
 * `resolveDailyMaxima`: each `dailyMaximum` of a counting entry that is not
 * suppressed (a replaced Condition, an entry a condition suppresses). Which
 * maxima are present is decided before any formula is evaluated, so it never
 * depends on what a formula reads, a favored-class reward's count included.
 */
function presentDailyMaxima(ctx: RuleValueContext) {
  return ctx.activeEntries.flatMap((entry) =>
    entry.ruleValues.flatMap((ruleValue, ruleValueIndex) =>
      ruleValue.kind === 'dailyMaximum' &&
      !ctx.suppressed(entry, ruleValueIndex)
        ? [{ entry, ruleValue, ruleValueIndex }]
        : [],
    ),
  );
}

/**
 * The keys of the per-day maxima the sheet has (`presentDailyMaxima`): the
 * keys of the rows `resolveDailyMaxima` yields, read without evaluating a
 * formula. They are what the sheet has, whatever reward: a caller offers a
 * targeted favored-class reward's power only where one of these is among the
 * fitting reward's reviewed targets.
 */
export function dailyMaximumKeys(ctx: RuleValueContext): ReadonlySet<string> {
  return new Set(presentDailyMaxima(ctx).map(({ ruleValue }) => ruleValue.key));
}

type ResolvedMaximum = {
  entry: RuleValueEntry;
  ruleValue: Extract<RuleValue, { kind: 'dailyMaximum' }>;
  ruleValueIndex: number;
  evaluation: RuleValueEvaluation;
};

/**
 * A maximum on the sheet: its own amount, each maximum joined to it, then
 * each increase of its key that adds, the sum floored at 0, with the
 * increases not counted listed (`listIncreases` warns for a choice, once
 * per key).
 */
function joinedMaximum(
  ctx: RuleValueContext,
  {
    maximum: { entry, ruleValue, ruleValueIndex, evaluation },
    joined,
    increases,
  }: {
    maximum: ResolvedMaximum;
    joined: readonly ResolvedMaximum[];
    increases: CountedIncreases;
  },
): DailyMaximum {
  const joinedValues = joined.map((other) => ({
    sources: ruleValueSources(ctx, other.entry, other.ruleValue.amount),
    value: other.evaluation.kind === 'value' ? other.evaluation.value : null,
  }));
  const { notCounted, counted: added } = increases;
  const sum = addIncreases(evaluation, [...joinedValues, ...added]);
  const floored = sum !== null && sum < 0;
  return {
    entryId: entry.sheetEntryId,
    ruleValueIndex,
    key: ruleValue.key,
    unit: ruleValue.unit,
    value: floored ? 0 : sum,
    sources: [
      ...ruleValueSources(ctx, entry, ruleValue.amount),
      ...joinedValues.flatMap(({ sources }) => sources),
      ...added.map(({ source }) => source),
    ],
    ...(floored ? { floor: { sum } } : {}),
    ...(notCounted.length ? { notCounted } : {}),
  };
}

/**
 * Each host's joining maxima (rotation-6 part J): a maximum with `joins`
 * joins the first maximum of its key and unit without it, or with none the
 * first of its key and unit with it, unless that is itself. The maxima are
 * grouped by key and unit once (rotation-6 fix r1).
 */
function joinMaxima(maxima: readonly ResolvedMaximum[]) {
  const pools = new Map<string, ResolvedMaximum[]>();
  for (const maximum of maxima) {
    const key = JSON.stringify([maximum.ruleValue.key, maximum.ruleValue.unit]);
    const pool = pools.get(key);
    if (pool) pool.push(maximum);
    else pools.set(key, [maximum]);
  }
  const joinedTo = new Map<ResolvedMaximum, ResolvedMaximum[]>();
  for (const pool of pools.values()) {
    const host =
      pool.find(({ ruleValue }) => !ruleValue.joins) ??
      pool.find(({ ruleValue }) => ruleValue.joins);
    if (!host) continue;
    const joining = pool.filter(
      (maximum) => maximum.ruleValue.joins && maximum !== host,
    );
    if (joining.length) joinedTo.set(host, joining);
  }
  return joinedTo;
}
