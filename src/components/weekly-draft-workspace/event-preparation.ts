import type { EventTopologyPlan } from '~/lib/event-occurrence-preparation';
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';

// Attempts for one preparation intent (the same missing positions) before
// the Workspace stops and offers an explicit retry.
export const EVENT_PREPARATION_ATTEMPTS = 3;

/**
 * Decides when the Workspace sends Event preparation for the accepted draft.
 * Every attempt is a fresh ordinary edit computed from the latest accepted
 * observation, so a rejected attempt is recomputed rather than replayed; the
 * same intent is attempted a bounded number of times.
 */
export function createEventPreparation(
  maxAttempts = EVENT_PREPARATION_ATTEMPTS,
) {
  let intent: string | null = null;
  let attempts = 0;
  let failed = false;
  return {
    /** The edits to send now, or null when nothing is missing or attempts are spent. */
    next(plan: EventTopologyPlan): WeeklyDraftEdit[] | null {
      if (plan.edits.length === 0) {
        intent = null;
        attempts = 0;
        failed = false;
        return null;
      }
      const next = plan.added.join('\n');
      if (next !== intent) {
        intent = next;
        attempts = 0;
        failed = false;
      }
      if (attempts >= maxAttempts) {
        failed = true;
        return null;
      }
      attempts++;
      return plan.edits;
    },
    get failed() {
      return failed;
    },
    retry() {
      attempts = 0;
      failed = false;
    },
  };
}
