import { phaseView } from '../../src/components/weekly-draft-workspace/phase-view';
import { projectWeeklyDraft } from '../../src/lib/canonical-weekly-resolution';
import type { WeeklyDraft } from '../../src/lib/weekly-draft-contract';
import type { WorkspaceSource } from '../../src/lib/weekly-workspace-source';

// Bundle the same projection and Phase View builders the Workspace consumes.
export function acceptanceViews(draft: WeeklyDraft, source: WorkspaceSource) {
  const preview = projectWeeklyDraft({
    revision: draft,
    militiaSnapshot: source.snapshot,
  });
  return {
    preview,
    phases: (
      ['upkeep', 'activity', 'event', 'persistent', 'summary'] as const
    ).map((phase) => phaseView(phase, draft, source, preview)),
  };
}
