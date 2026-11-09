'use client';
import { useEffect, useMemo, useRef } from 'react';
import { useConvexAuth } from 'convex/react';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { FailedLoadCard } from '~/components/campaign-shell/failed-load';
import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { campaignPath } from '~/lib/campaign-routes';
import {
  useWeeklyDraftWorkspace,
  useWorkspaceController,
  type WorkspaceController,
} from './use-weekly-draft-workspace';
import { SummaryView } from './summary-view';
import { readConfirmControl } from './confirm-control';
import { PersistentView } from './persistent-view';
import { EventView } from './event-view';
import { ActivityView } from './activity-view';
import { UpkeepView } from './upkeep-view';
import { useSourceFocus } from './use-source-focus';
import { activitySlotAnchor } from './source-anchors';
import { SetupNotesButton } from './week-frame/setup-notes';
import { useReferencePanel } from './week-frame/use-reference-panel';
import { WeekFrame, WeekSkeleton } from './week-frame/week-frame';
import {
  ConfirmedWeekNotice,
  RemoteChangeNote,
  SaveFailureAlert,
} from './week-frame/week-status';
import type { Phase, WeeklyDraftWorkspace } from './types';
// Real document departures (reload, close, typed address) get the browser's
// own warning, read from the store at event time. Same-document navigation
// consults the departure guard, which reads the same store.
function useBeforeUnloadWarning(
  store: WorkspaceController['store'] | undefined,
) {
  useEffect(() => {
    if (!store) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (!store.getPendingWork()) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [store]);
}
// The address is one player's Phase View. An actual address change (link,
// Back, Forward, the opening address) moves this Workspace once. A request
// made while the store is still loading (the initial week only) is applied
// when it first becomes ready and then forgotten. A successor week never
// passes through loading: the store keeps the old week ready and read-only,
// then switches to the new week on Upkeep in one publication, and that
// store-side phase is published back into the address here. The old
// address value is never re-applied to the new week. The shell's owner
// cannot read the page's address during render, so this is what makes the
// opening phase authoritative.
function usePhaseAddress(
  store: WorkspaceController['store'] | undefined,
  workspace: WeeklyDraftWorkspace,
  phase: Phase | undefined,
  onPhaseChange: ((phase: Phase) => void) | undefined,
) {
  const requested = useRef(phase);
  const unapplied = useRef<Phase | undefined>(phase);
  const ready = workspace.status === 'ready';
  useEffect(() => {
    if (phase === undefined || !store) return;
    requested.current = phase;
    const current = store.getSnapshot();
    if (current.status === 'ready') {
      current.viewPhase(phase);
      unapplied.current = undefined;
    } else unapplied.current = phase;
  }, [phase, store]);
  useEffect(() => {
    if (!ready || !store || unapplied.current === undefined) return;
    const current = store.getSnapshot();
    if (current.status === 'ready') current.viewPhase(unapplied.current);
    unapplied.current = undefined;
  }, [ready, store]);
  const shown = ready ? workspace.phaseView.phase : null;
  // Each observed same-campaign successor (the store's transition identity,
  // published with the notice) writes `phase=upkeep` exactly once, even when
  // the address already read Upkeep. Saves, rerenders, dismissing the notice
  // and a fresh owner carry no new identity, so they publish nothing.
  const transition = ready
    ? (workspace.confirmedWeek?.transitionId ?? null)
    : null;
  const published = useRef<string | null>(null);
  useEffect(() => {
    if (shown === null || !onPhaseChange) return;
    const observed = transition !== null && transition !== published.current;
    if (observed) published.current = transition;
    if (!observed && shown === requested.current) return;
    // A render already superseded by a store-side change publishes nothing;
    // the next render compares the live phase.
    const live = store?.getSnapshot();
    if (live?.status === 'ready' && live.phaseView.phase !== shown) return;
    requested.current = shown;
    onPhaseChange(shown);
  }, [shown, transition, onPhaseChange, store]);
  return (next: Phase) => {
    requested.current = next;
    if (workspace.status === 'ready') {
      workspace.viewPhase(next);
      unapplied.current = undefined;
    } else unapplied.current = next;
    onPhaseChange?.(next);
  };
}
// The store's current Activity facts, read after an awaited edit so a
// follow-up edit starts from the newest accepted and pending choices.
function latestActivity(store: WorkspaceController['store'] | undefined) {
  const current = store?.getSnapshot();
  return current?.status === 'ready' && current.phaseView.phase === 'activity'
    ? current.phaseView
    : null;
}
// The store's current Table Adjustments (accepted plus this device's pending
// edits), read at Save time so a form never sends a list it captured earlier.
function latestAdjustments(store: WorkspaceController['store'] | undefined) {
  const current = store?.getSnapshot();
  return current?.status === 'ready' && current.phaseView.phase === 'summary'
    ? current.phaseView.adjustments
    : null;
}
// This device's Confirm guard for local forms (Review's adjustments and
// reasons, Persistent's table endings), from the one store.
function useLocalFormGuard(store: WorkspaceController['store'] | undefined) {
  return useMemo(
    () =>
      store && {
        set: store.setLocalForm,
        keep: store.keepLocalValues,
        read: store.readLocalValues,
      },
    [store],
  );
}
// The store's current Overseer support facts (Event or Persistent), read
// between the edits of a support move so each step plans from the newest
// accepted and pending draft.
function latestOverseer(store: WorkspaceController['store'] | undefined) {
  const current = store?.getSnapshot();
  return current?.status === 'ready' &&
    (current.phaseView.phase === 'event' ||
      current.phaseView.phase === 'persistent')
    ? current.phaseView.overseer
    : null;
}
// The frame's status row: a failed save and the other-player note, nothing
// in the normal state. Saving itself is shown where it happens.
function WorkspaceFeedback({
  workspace,
}: {
  workspace: Extract<WeeklyDraftWorkspace, { status: 'ready' }>;
}) {
  return (
    <>
      <SaveFailureAlert
        feedback={workspace.feedback}
        failureReason={workspace.failureReason}
      />
      <RemoteChangeNote change={workspace.remoteChange} />
    </>
  );
}
// `campaignId` scopes every reference link (Militia, Characters & officers,
// Finished weeks, Setup) to this campaign; without it the links stay off.
export function WeeklyWorkspaceBoard({
  campaignId = null,
  phase,
  onPhaseChange,
}: {
  campaignId?: string | null;
  phase?: Phase;
  onPhaseChange?: (phase: Phase) => void;
}) {
  const auth = useConvexAuth();
  const maintenance = useInitialMigrationMaintenance();
  const workspace = useWeeklyDraftWorkspace();
  const controller = useWorkspaceController();
  useBeforeUnloadWarning(controller?.store);
  const choosePhase = usePhaseAddress(
    controller?.store,
    workspace,
    phase,
    onPhaseChange,
  );
  const openSource = useSourceFocus(
    workspace.status === 'ready' ? workspace.phaseView.phase : null,
    choosePhase,
  );
  const panel = useReferencePanel(campaignId);
  const localFormGuard = useLocalFormGuard(controller?.store);
  const setupHref = campaignId ? campaignPath(campaignId, 'setup') : undefined;
  if (auth.isLoading || workspace.status === 'loading')
    return <WeekSkeleton phase={phase} />;
  if (workspace.status !== 'ready')
    return (
      <main className="mx-auto w-full max-w-6xl p-4">
        {workspace.status === 'failed' ? (
          <FailedLoadCard
            noun="The week"
            retry={controller?.retry ?? (() => window.location.reload())}
          />
        ) : (
          <Card className="p-6" role="status">
            No militia yet.
          </Card>
        )}
        {workspace.status === 'unavailable' && setupHref && (
          <Button asChild className="mt-4">
            <GuardedLink href={setupHref}>Set up militia</GuardedLink>
          </Button>
        )}
      </main>
    );
  const view = workspace.phaseView;
  // Every weekly write control is disabled while this device's Confirmation
  // is in flight, while a closed week is retained read-only until its
  // successor is usable (WEEK-10), and while app-wide editing is off (the
  // shell's banner says why); the store and the client reject those writes
  // as well.
  const disabled = workspace.editingDisabled || maintenance.readOnly;
  // One Confirmation control, shown in the review block and pinned in the
  // frame's footer and phone strip on Review & confirm.
  const confirmation = maintenance.readOnly
    ? {
        ...readConfirmControl(workspace),
        disabled: true,
        reason: maintenance.message,
      }
    : readConfirmControl(workspace);
  return (
    // A test/diagnostic hook, not UI: `display: contents` leaves the frame's
    // flex layout untouched while the save state stays readable.
    <div className="contents" data-week-feedback={workspace.feedback}>
      <WeekFrame
        week={workspace.week}
        phase={view.phase}
        phases={workspace.phases}
        navigation={workspace.navigation}
        confirmation={confirmation}
        choose={choosePhase}
        reference={{ facts: workspace.referenceFacts, panel }}
        status={<WorkspaceFeedback workspace={workspace} />}
        notice={
          <ConfirmedWeekNotice
            notice={workspace.confirmedWeek}
            campaignId={campaignId}
            dismiss={workspace.dismissConfirmedWeek}
          />
        }
        notes={<SetupNotesButton notes={workspace.setupNotes} />}
      >
        {view.phase === 'upkeep' ? (
          <UpkeepView view={view} edit={workspace.edit} disabled={disabled} />
        ) : view.phase === 'activity' ? (
          <ActivityView
            view={view}
            edit={workspace.edit}
            disabled={disabled}
            latest={() => latestActivity(controller?.store)}
            correctionsHref={
              campaignId ? campaignPath(campaignId, 'militia') : undefined
            }
            openEvent={() => choosePhase('event')}
          />
        ) : view.phase === 'event' ? (
          <EventView
            view={view}
            edit={workspace.edit}
            disabled={disabled}
            preparation={workspace.eventPreparation}
            openActivity={() => choosePhase('activity')}
            openActivitySlot={(slotId) =>
              openSource({
                phase: 'activity',
                anchor: slotId ? activitySlotAnchor(slotId) : null,
              })
            }
            latestOverseer={() => latestOverseer(controller?.store)}
          />
        ) : view.phase === 'persistent' ? (
          <PersistentView
            view={view}
            edit={workspace.edit}
            disabled={disabled}
            openSource={openSource}
            latestOverseer={() => latestOverseer(controller?.store)}
            localFormGuard={localFormGuard}
          />
        ) : view.phase === 'summary' ? (
          <SummaryView
            view={view}
            edit={workspace.edit}
            disabled={disabled}
            confirmation={confirmation}
            goTo={openSource}
            forecastPending={workspace.forecastPending}
            reviewRequired={workspace.reviewRequired}
            review={workspace.reviewUpdatedWeek}
            localForms={workspace.localForms}
            localFormGuard={localFormGuard}
            latestAdjustments={() =>
              latestAdjustments(controller?.store) ?? view.adjustments
            }
          />
        ) : null}
      </WeekFrame>
    </div>
  );
}
