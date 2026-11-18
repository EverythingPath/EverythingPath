import type {
  PlanChange,
  SabotageFact,
} from '~/components/week-review/review-changes';
import type { ComparedState } from '~/components/week-review/review-comparison';
import type { ReviewPhase } from '~/components/week-review/review-facts';
import type { CanonicalResolutionRecord } from '~/lib/canonical-resolution-record';
import { militiaSnapshotSchema } from '~/lib/canonical-weekly-source';
import { weekStartFactsSchema } from '~/lib/weekly-draft-contract';

// Reads one immutable Resolution Record's stored artifacts: complete typed
// plans and states. Stored states are only checked for their structure:
// nothing is recalculated, and a part that does not match today's structure
// stays unknown.

type Artifact = CanonicalResolutionRecord['baselinePlan'];
export type Facts = Readonly<Record<string, unknown>>;
type Snapshot = NonNullable<ComparedState['militiaSnapshot']>;
type Context = NonNullable<ComparedState['context']>;

export type RecordedPlans = Record<ReviewPhase, readonly PlanChange[] | null>;
export type RecordedWeek = {
  /** Each phase's recorded plan, in execution order; null if not recorded. */
  plans: RecordedPlans;
  sabotage: readonly SabotageFact[];
  atConfirmation: ComparedState;
  baseline: ComparedState;
  final: ComparedState;
  /** Whether every compared state holds its complete militia and context. */
  complete: boolean;
  nextWeek: number;
};

const phases = ['upkeep', 'activity', 'event', 'persistent'] as const;

export function isFacts(value: unknown): value is Facts {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function parseSnapshot(value: unknown): Snapshot | null {
  const parsed = militiaSnapshotSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
function parseContext(value: unknown): Context | null {
  const parsed = weekStartFactsSchema.strip().safeParse(value);
  return parsed.success ? parsed.data : null;
}

type TypedPlan = { before: Facts; after: Facts; effects: Facts };
function parseTypedPlan(artifact: Artifact): TypedPlan | null {
  const { before, after, effects } = artifact.data;
  return isFacts(before) && isFacts(after) && isFacts(effects)
    ? { before, after, effects }
    : null;
}

/** A stored week state; a part failing its structure stays unknown. */
function weekState(value: Facts | undefined): ComparedState {
  return {
    militiaSnapshot: parseSnapshot(value?.militiaSnapshot),
    context: parseContext(value?.context),
  };
}

function planEntries(
  effects: Facts | undefined,
  field: string,
): readonly unknown[] | null {
  const value = effects?.[field];
  return Array.isArray(value) ? value : null;
}

function findWeek(value: Facts | undefined) {
  return typeof value?.week === 'number' ? value.week : null;
}

export function readRecordedWeek(
  record: CanonicalResolutionRecord,
): RecordedWeek {
  const baselinePlan = parseTypedPlan(record.baselinePlan);
  const finalPlan = parseTypedPlan(record.finalPlan);
  // Phase consequences are the same in both plans; the baseline's come first.
  const sources = [baselinePlan?.effects, finalPlan?.effects];
  const find = (field: string) =>
    sources.reduce<readonly unknown[] | null>(
      (found, effects) => found ?? planEntries(effects, field),
      null,
    );
  // Safe cast: stored entries keep the shapes the typed plan had when recorded.
  const plans = Object.fromEntries(
    phases.map((phase) => [phase, find(phase)]),
  ) as RecordedPlans;
  // Safe cast: recorded Sabotage entries keep the SabotageFact shape they were
  // written with.
  const sabotage = (find('sabotage') ?? []) as readonly SabotageFact[];

  const atConfirmation: ComparedState = {
    militiaSnapshot: record.sourceMilitiaSnapshot,
    context: record.source.context,
  };
  const baseline = weekState(baselinePlan?.after);
  const recordedFinal = finalState(record, finalPlan);
  // The recorded successor context is the Final week context.
  const final = {
    ...recordedFinal,
    context: recordedFinal.context ?? record.successorContext,
  };
  const states = [atConfirmation, baseline, final];
  return {
    plans,
    sabotage,
    atConfirmation,
    baseline,
    final,
    complete: states.every(
      (state) => state.militiaSnapshot !== null && state.context !== null,
    ),
    nextWeek:
      findWeek(record.finalOutcome.data) ??
      findWeek(finalPlan?.after) ??
      record.source.week + 1,
  };
}

/** The Final column: the recorded outcome, else the final plan's result. */
function finalState(
  record: CanonicalResolutionRecord,
  finalPlan: TypedPlan | null,
): ComparedState {
  const outcome = weekState(record.finalOutcome.data);
  return outcome.militiaSnapshot || !finalPlan
    ? outcome
    : weekState(finalPlan.after);
}
