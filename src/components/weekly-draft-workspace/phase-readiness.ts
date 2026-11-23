import type { CanonicalResolutionPreview } from '~/lib/canonical-weekly-resolution';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import { actionChoiceEvents } from '~/lib/weekly-draft-facts';
import type { WorkspaceSource } from '~/lib/weekly-workspace-source';
import { phaseView } from './phase-view';
import { withoutDuplicateRollCodes } from './roll-requirements';
import { summaryMessage } from './summary-messages';
import type { Phase, PhaseReadiness } from './types';
import type { EventPreparationContext } from './event-facts';

const phaseOrder: Phase[] = [
  'upkeep',
  'activity',
  'event',
  'persistent',
  'summary',
];

/** The Event occurrences an accepted draft already holds, by identity. */
export function acceptedEventIds(accepted: WeeklyDraft): Set<string> {
  return new Set(
    [
      ...accepted.event.occurrences,
      ...accepted.activity.slots.flatMap((slot) =>
        actionChoiceEvents(slot.choice),
      ),
    ].map((event) => event.eventId),
  );
}

export function derivePhaseReadiness(
  draft: WeeklyDraft,
  source: WorkspaceSource,
  preview: CanonicalResolutionPreview,
  event?: EventPreparationContext,
) {
  const views = phaseOrder.map((phase) =>
    phaseView(phase, draft, source, preview, event),
  );
  // Safe cast: phaseOrder includes 'summary', and phaseView returns a view of
  // the phase it was given.
  const summary = views.find((view) => view.phase === 'summary')!;
  const phases: PhaseReadiness[] = views.map((view) => ({
    phase: view.phase,
    available:
      view.phase !== 'persistent' || draft.context.persistentPhaseEligible,
    ...(view.phase === 'upkeep' ? { skipped: view.skipped } : {}),
    ready: view.ready,
    // One line per missing die in every phase and in Review's count.
    requirements: withoutDuplicateRollCodes([
      ...new Set(view.requirements),
    ]).map((id) => ({
      id,
      message: summaryMessage(id, summary),
    })),
    warnings: [...new Set(view.warnings)].map((id) => ({
      id,
      message: summaryMessage(id, summary, true),
    })),
  }));
  return { views, phases };
}

export function phaseNavigation(phase: Phase, phases: PhaseReadiness[]) {
  const available = phases.filter((item) => item.available);
  const index = available.findIndex((item) => item.phase === phase);
  return {
    previous: available[index - 1]?.phase ?? null,
    next: available[index + 1]?.phase ?? null,
  };
}

export function confirmationDisabledReason({
  canConfirm,
  confirming,
  reviewRequired,
  forecastPending,
  pendingWork,
  decisions,
  localForms = 0,
}: {
  canConfirm: boolean;
  confirming: boolean;
  reviewRequired: boolean;
  forecastPending: boolean;
  pendingWork: boolean;
  decisions: number;
  /** This device's open or invalid Summary forms; never shared state. */
  localForms?: number;
}) {
  if (confirming) return 'Confirming the week…';
  if (reviewRequired) return 'Review the updated week before confirming.';
  if (forecastPending || pendingWork)
    return 'Review will be ready when your changes are saved.';
  if (localForms)
    return localForms === 1
      ? 'Save or cancel your unsaved change first.'
      : `Save or cancel your ${localForms} unsaved changes first.`;
  if (canConfirm) return null;
  if (decisions)
    return `${decisions} ${decisions === 1 ? 'decision' : 'decisions'} left`;
  return 'Review the updated week before confirming.';
}
