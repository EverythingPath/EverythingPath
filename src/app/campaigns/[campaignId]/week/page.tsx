'use client';
import { Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCampaign } from '~/components/campaign-shell/campaign-context';
import { WeeklyWorkspaceBoard } from '~/components/weekly-draft-workspace/board';
import { WeekSkeleton } from '~/components/weekly-draft-workspace/week-frame/week-frame';
import {
  normalizePhase,
  weekPath,
  type PhaseView,
} from '~/lib/campaign-routes';

// Thin address adapter over the shell-owned Workspace: the phase lives in the
// address and stays local to this player. The address is replaced in place so
// Back leaves the week instead of replaying phases.
function WeekHost() {
  const { campaign } = useCampaign();
  const params = useSearchParams();
  const phase = normalizePhase(params.get('phase'));
  const campaignId = campaign._id;
  const onPhaseChange = useCallback(
    (next: PhaseView) => {
      window.history.replaceState(null, '', weekPath(campaignId, next));
    },
    [campaignId],
  );
  return (
    <WeeklyWorkspaceBoard
      campaignId={campaignId}
      phase={phase}
      onPhaseChange={onPhaseChange}
    />
  );
}

export default function WeekPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Suspense fallback={<WeekSkeleton />}>
        <WeekHost />
      </Suspense>
    </div>
  );
}
