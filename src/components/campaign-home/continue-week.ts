import { projectWeeklyDraft } from '~/lib/canonical-weekly-resolution';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import type { WorkspaceSource } from '~/lib/weekly-workspace-source';
import {
  acceptedEventIds,
  derivePhaseReadiness,
} from '~/components/weekly-draft-workspace/phase-readiness';
import type {
  Phase,
  PhaseReadiness,
} from '~/components/weekly-draft-workspace/types';

/**
 * Where Continue week opens: the first available preparatory phase that is
 * not ready, in rules order, else Review & confirm. Persistent is available
 * only when the week's fixed eligibility allows it; warnings never make a
 * phase unready.
 */
export function continuePhase(phases: PhaseReadiness[]): Phase {
  return (
    phases.find(
      (item) => item.phase !== 'summary' && item.available && !item.ready,
    )?.phase ?? 'summary'
  );
}

/**
 * The Week frame's readiness over the accepted draft, derived the same way
 * the Workspace derives it for an idle accepted draft. Nothing is saved.
 */
export function continueTarget(
  draft: WeeklyDraft,
  source: WorkspaceSource,
): { week: number; phase: Phase } {
  const preview = projectWeeklyDraft({
    revision: draft,
    militiaSnapshot: source.snapshot,
  });
  const { phases } = derivePhaseReadiness(draft, source, preview, {
    acceptedEventIds: acceptedEventIds(draft),
    preparationFailed: false,
  });
  return { week: draft.week, phase: continuePhase(phases) };
}
