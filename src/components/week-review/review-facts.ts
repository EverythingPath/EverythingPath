// The six-section week presentation contract. Everything here is plain,
// already-named renderable data: a live adapter (the open Weekly Draft and its
// Resolution Preview) and a frozen adapter (one immutable Resolution Record)
// both produce it, and one renderer draws it. Keys are internal stable
// identities for React and tests; they are never shown to players.

export type ReviewMode = 'live' | 'record';
export type ReviewPhase = 'upkeep' | 'activity' | 'event' | 'persistent';

export type ReviewWarning = { kind: 'warning'; key: string; message: string };
export type ReviewException = {
  kind: 'exception';
  key: string;
  exceptionId: string;
  subjectId: string;
  ruleId: string;
  /** Readable rule name for the chip, e.g. "Team already acted". */
  rule: string;
  /** The accepted reason; empty while a required exception has none yet. */
  reason: string;
  /**
   * A retired rule's exception on the open week: it no longer permits
   * anything, and is shown only so players can remove it.
   */
  obsolete: boolean;
};

// Why each retired rule's exception no longer applies, by rule.
const obsoleteExceptionMessages: Record<string, string> = {
  'action-capacity':
    'This recorded exception cannot permit an extra action. Move the choice to an available slot, clear it, or restore the allowance.',
  'propaganda-impossible':
    'Spread Propaganda now assumes the GM allows it, so this recorded exception has no effect. You can remove it.',
};

/** Whether an exception for `ruleId` belongs to a retired rule. */
export function isObsoleteException(ruleId: string) {
  return Object.hasOwn(obsoleteExceptionMessages, ruleId);
}

/** Why an obsolete exception for `ruleId` no longer applies. */
export function obsoleteExceptionMessage(ruleId: string) {
  return (
    obsoleteExceptionMessages[ruleId] ??
    'This recorded exception no longer applies. You can remove it.'
  );
}
export type ReviewOutcome = { kind: 'outcome'; key: string; text: string };
export type ReviewNote = ReviewWarning | ReviewException | ReviewOutcome;

/** One effect of a consequence, shown as its chip, e.g. "Training −4". */
export type ReviewEffect = { key: string; text: string };

export type ReviewItem = {
  key: string;
  title: string;
  /** Check details and other explanatory lines, in rules order. */
  details: string[];
  effects: ReviewEffect[];
  notes: ReviewNote[];
  /**
   * The item's original subject is no longer part of the week; its retained
   * facts (for example an exception) stay visible at the end of the phase.
   */
  missing: boolean;
};

export type ReviewSection = {
  phase: ReviewPhase;
  number: 1 | 2 | 3 | 4;
  title: string;
  /** Net phase changes derived from the phase plan. */
  chips: string[];
  /**
   * `incomplete` still lists the partial consequences that are known;
   * `not-applicable` and `empty` have no items.
   */
  status: 'complete' | 'incomplete' | 'empty' | 'not-applicable';
  /** Honest one-line explanation for incomplete, empty or not-applicable. */
  statusText: string | null;
  items: ReviewItem[];
};

export type ReviewAdjustment = {
  key: string;
  adjustmentId: string;
  /** 1-based application order. */
  number: number;
  /** "Militia value", "Team condition", … */
  kind: string;
  /** Effect chip, e.g. "Treasury +5 gp" or "Hollow Scouts → Disabled". */
  effect: string;
  reason: string;
  notes: ReviewNote[];
};

/**
 * A value in one Result column. `absent` is a real structural fact (the team,
 * event or settlement does not exist in that state); `unavailable` means the
 * column itself is not known yet and is never shown as zero or unchanged.
 */
export type ResultCell =
  | { kind: 'value'; text: string; key: string }
  | { kind: 'absent'; text: string }
  /** `text` replaces the default "Not available", e.g. "Not recorded". */
  | { kind: 'unavailable'; text?: string };

export type ResultRow = {
  key: string;
  group: string;
  label: string;
  now: ResultCell;
  baseline: ResultCell;
  final: ResultCell;
  /** Now differs from the Rules Baseline, or the Rules Baseline from Final. */
  changed: boolean;
  /** Final differs from the Rules Baseline (a Table Adjustment applied). */
  finalDiffers: boolean;
  /** Plain-text description of a Table Adjustment difference, if any. */
  difference: string | null;
};

export type ReviewResult = {
  /** The week that begins (live) or began (record) after this one. */
  nextWeek: number;
  /** Baseline and Final are known; otherwise those columns are unavailable. */
  complete: boolean;
  rows: ResultRow[];
};

export type WeekReviewFacts = {
  mode: ReviewMode;
  sections: [ReviewSection, ReviewSection, ReviewSection, ReviewSection];
  /** Facts whose phase cannot be determined; never discarded. */
  unassociated: ReviewNote[];
  adjustments: ReviewAdjustment[];
  result: ReviewResult;
};
