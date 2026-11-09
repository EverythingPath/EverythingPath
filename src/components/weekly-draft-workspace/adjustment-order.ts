import type { WeeklyDraft } from '~/lib/weekly-draft-contract';

type Adjustment = WeeklyDraft['tableAdjustments'][number];

/** The complete ordered list with one adjustment swapped with its neighbour. */
export function moveAdjustment(
  adjustments: readonly Adjustment[],
  index: number,
  offset: -1 | 1,
) {
  const next = [...adjustments];
  const target = index + offset;
  const [moved, neighbour] = [next[index], next[target]];
  if (!moved || !neighbour) return next;
  next[target] = moved;
  next[index] = neighbour;
  return next;
}

/**
 * The latest list with one adjustment, found by identity, swapped with its
 * neighbour; null when it has gone or has no neighbour that way, so nothing
 * is sent.
 */
export function moveAdjustmentById(
  latest: readonly Adjustment[],
  adjustmentId: string,
  offset: -1 | 1,
) {
  const index = latest.findIndex((item) => item.adjustmentId === adjustmentId);
  if (index === -1 || !latest[index + offset]) return null;
  return moveAdjustment(latest, index, offset);
}
