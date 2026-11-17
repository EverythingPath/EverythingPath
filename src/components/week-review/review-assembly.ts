import {
  describeChange,
  type PlanAcknowledgement,
  type PlanChange,
} from './review-changes';
import type { ReviewItem, ReviewNote, ReviewPhase } from './review-facts';
import type { ReviewNames } from './review-text';

// Assembly shared by the live and frozen adapters: consequences are ordered
// into each phase's skeleton from its plan, in actual execution order, and
// each acknowledgement is placed once. Both modes therefore list the same
// consequences in the same order with the same effect chips.

/**
 * A consequence under assembly. `subjects` own warning and exception codes;
 * `checkTotals` are bare check totals a resolved check detail replaces.
 * Both are stripped before the facts leave an adapter.
 */
export type AssemblyItem = ReviewItem & {
  subjects: string[];
  checkTotals: string[];
};

export function newItem(
  key: string,
  title: string,
  subjects: string[] = [],
): AssemblyItem {
  return {
    key,
    title,
    details: [],
    effects: [],
    notes: [],
    missing: false,
    subjects,
    checkTotals: [],
  };
}

export function reviewItem({
  subjects: _subjects,
  checkTotals: _checkTotals,
  ...item
}: AssemblyItem): ReviewItem {
  return item;
}

/** Outcome notes: each acknowledgement is placed at most once in the review. */
export function createOutcomes() {
  const placed = new Set<string>();
  const note = (ack: PlanAcknowledgement, text: string): ReviewNote => {
    placed.add(ack.acknowledgementId);
    return { kind: 'outcome', key: `outcome:${ack.acknowledgementId}`, text };
  };
  return {
    isPlaced: (ack: PlanAcknowledgement) => placed.has(ack.acknowledgementId),
    place(target: AssemblyItem, ack: PlanAcknowledgement) {
      if (placed.has(ack.acknowledgementId) || !ack.outcome.trim()) return;
      target.notes.push(note(ack, ack.outcome));
    },
    /** Places an outcome no consequence owns, kept with its subject's name. */
    placeUnlinked(ack: PlanAcknowledgement, name: string) {
      return ack.outcome.trim() ? note(ack, `${name}: ${ack.outcome}`) : null;
    },
  };
}
export type Outcomes = ReturnType<typeof createOutcomes>;

function addPlanLine(
  target: AssemblyItem,
  described: ReturnType<typeof describeChange>,
  index: number,
  outcomes: Outcomes,
) {
  if (described.effect)
    target.effects.push({
      key: `${described.subject}:effect:${index}`,
      text: described.effect,
    });
  if (described.resolvesCheck)
    target.details = target.details.filter(
      (line) => !target.checkTotals.includes(line),
    );
  if (described.detail) target.details.push(described.detail);
  if (described.acknowledgement)
    outcomes.place(target, described.acknowledgement);
}

/** Order plan lines into the skeleton; unknown subjects keep plan order. */
export function applyPlan(
  phase: ReviewPhase,
  skeleton: AssemblyItem[],
  plan: readonly PlanChange[],
  names: ReviewNames,
  outcomes: Outcomes,
  describe: typeof describeChange = describeChange,
) {
  const leading: AssemblyItem[] = [];
  const trailing: AssemblyItem[] = [];
  const byKey = new Map(skeleton.map((entry) => [entry.key, entry]));
  let reachedSkeleton = false;
  plan.forEach((change, index) => {
    const described = describe(phase, change, names);
    const known = byKey.get(described.subject);
    reachedSkeleton ||= known !== undefined;
    const target =
      known ??
      newItem(described.subject, described.title, [
        described.subject,
        described.subject.replace(/^[a-z]+:/, ''),
      ]);
    if (!known) {
      byKey.set(described.subject, target);
      const before = !reachedSkeleton && skeleton.length > 0;
      (before ? leading : trailing).push(target);
    }
    addPlanLine(target, described, index, outcomes);
  });
  return [...leading, ...skeleton, ...trailing];
}

export function appendNote(
  map: Map<string, ReviewNote[]>,
  key: string,
  note: ReviewNote,
) {
  map.set(key, [...(map.get(key) ?? []), note]);
}
