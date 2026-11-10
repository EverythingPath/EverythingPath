import { changedPhases } from './changed-phases';
import { referenceFacts } from './reference-facts';
import { createDraftPersistence } from '~/lib/weekly-draft-persistence';
import { editWeeklyDraft } from '~/lib/weekly-draft';
import { projectWeeklyDraft } from '~/lib/canonical-weekly-resolution';
import { weeklySourceKey } from '~/lib/canonical-weekly-source';
import type { WorkspaceSource } from '~/lib/weekly-workspace-source';
import type { AcceptedWeeklyPreview } from '~/lib/weekly-confirmation-contract';
import type { WeeklyDraft, WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import type { WorkspaceGateway } from './gateway';
import { planEventTopology } from '~/lib/event-occurrence-preparation';
import { createEventPreparation } from './event-preparation';
import {
  acceptedEventIds,
  derivePhaseReadiness,
  phaseNavigation,
  confirmationDisabledReason,
} from './phase-readiness';
import type {
  LocalFormRegistration,
  Phase,
  PhaseView,
  WeeklyDraftWorkspace,
} from './types';
import { isStaleEndingForm } from './persistent-ending-guard';

type Persistence = ReturnType<typeof createDraftPersistence>;
type PersistenceSnapshot = ReturnType<Persistence['getSnapshot']>;

export function createWorkspace(gateway: WorkspaceGateway | null) {
  let state: WeeklyDraftWorkspace = {
    status: gateway ? 'loading' : 'unavailable',
  };
  type Ready = Extract<WeeklyDraftWorkspace, { status: 'ready' }>;
  let retained: { state: Ready; views: PhaseView[] } | null = null;
  let acceptedContext: { draft: WeeklyDraft; source: WorkspaceSource } | null =
    null;
  let handoff: { week: number; draftId: string } | null = null;
  let confirming = false;
  let confirmedWeek: Ready['confirmedWeek'] = null;
  let remoteChange: Ready['remoteChange'] = null;
  let remoteSequence = 0;
  let source: WorkspaceSource | null = null;
  let persistence: Persistence | null = null;
  let stopPersistence: () => void = () => undefined;
  let stopSource: () => void = () => undefined;
  let phase: Phase = 'upkeep';
  let feedback: 'idle' | 'saved' | 'failed' = 'idle';
  let pending: { id: number; edit: WeeklyDraftEdit }[] = [];
  let sequence = 0;
  let active = false;
  let reviewed: AcceptedWeeklyPreview | null = null;
  // A failed save asks for a fresh review, which showing Review & confirm
  // gives. A rejected Confirmation asks for more: it holds until the player
  // presses Review updated week, wherever they went meanwhile.
  let reviewRequired = false;
  let confirmationRejected = false;
  let previewRequest = '';
  let previewGeneration = 0;
  const operations = new Set<{ draftId: string }>();
  let preparation = createEventPreparation();
  let preparing = false;
  const listeners = new Set<() => void>();
  // This device's open or locally invalid Summary forms, by form identity.
  // They only ever disable this device's Confirm; they are never shared,
  // never saved and belong to the draft that was open when they registered.
  // Their raw input is kept beside them (without publishing) so it survives
  // leaving Review & confirm and coming back.
  const localForms = new Map<
    string,
    { draftId: string } & LocalFormRegistration
  >();
  const localValues = new Map<string, { draftId: string; values: unknown }>();
  function getPendingWork() {
    return operations.size > 0;
  }
  function keepLocalValues(id: string, values: unknown) {
    const draftId = source?.key.draftId;
    if (draftId) localValues.set(id, { draftId, values });
  }
  // Only a registered form's input is read back: a form that became clean
  // again has nothing to restore.
  function readLocalValues(id: string) {
    const kept = localValues.get(id);
    const draftId = source?.key.draftId;
    return kept?.draftId === draftId && localForms.get(id)?.draftId === draftId
      ? kept?.values
      : undefined;
  }
  function clearLocalForms() {
    localForms.clear();
    localValues.clear();
  }
  function setLocalForm(id: string, form: LocalFormRegistration | null) {
    const current = localForms.get(id);
    const draftId = source?.key.draftId;
    if (!form) localValues.delete(id);
    if (!form || !draftId) {
      if (!current) return;
      localForms.delete(id);
    } else {
      if (
        current?.draftId === draftId &&
        current.message === form.message &&
        current.phase === form.phase &&
        current.basis === form.basis
      )
        return;
      localForms.set(id, { draftId, ...form });
    }
    rebuild();
  }
  function listLocalForms(draftId: string) {
    return [...localForms]
      .filter(([, form]) => form.draftId === draftId)
      .map(([id, { draftId: _draftId, ...form }]) => ({ id, ...form }));
  }
  // Drops held Persistent endings whose decision no longer applies in the
  // latest Persistent facts, with their kept input.
  function dropStaleEndings(views: PhaseView[]) {
    const persistent = views.find((view) => view.phase === 'persistent');
    if (persistent?.phase !== 'persistent') return;
    for (const [id, form] of localForms)
      if (isStaleEndingForm(id, form.basis, persistent)) {
        localForms.delete(id);
        localValues.delete(id);
      }
  }
  function publish(next: WeeklyDraftWorkspace) {
    state = next;
    for (const listener of listeners) listener();
  }
  function retainAccepted() {
    if (retained || state.status !== 'ready' || !acceptedContext) return;
    const { draft, source: previous } = acceptedContext;
    const preview = projectWeeklyDraft({
      revision: draft,
      militiaSnapshot: previous.snapshot,
    });
    const { views, phases } = derivePhaseReadiness(draft, previous, preview);
    retained = {
      state: {
        ...state,
        setupNotes: previous.setupNotes,
        week: draft.week,
        phases,
        referenceFacts: referenceFacts(previous, draft, preview, views),
      },
      views,
    };
  }
  function publishRetained(observed: PersistenceSnapshot | undefined) {
    retainAccepted();
    if (retained)
      publish({
        ...retained.state,
        // Safe cast: retainAccepted builds these views with derivePhaseReadiness,
        // which has one view for every Phase.
        phaseView: retained.views.find((view) => view.phase === phase)!,
        navigation: phaseNavigation(phase, retained.state.phases),
        editingDisabled: true,
        canConfirm: false,
        confirmationDisabledReason: confirming
          ? 'Confirming the week…'
          : 'Opening the next week…',
        feedback: confirming
          ? 'confirming'
          : getPendingWork()
            ? 'pending'
            : feedback,
        failureReason:
          feedback === 'failed' ? (observed?.failureReason ?? null) : null,
        remoteChange: null,
        pendingWork: getPendingWork(),
        localForms: [],
        confirmedWeek,
      });
    else publish({ status: 'loading' });
  }
  function adoptSuccessor(next: WorkspaceSource) {
    if (handoff) {
      confirmedWeek = {
        transitionId: `${handoff.draftId}:${next.key.draftId}`,
        week: handoff.week,
      };
      handoff = null;
      phase = 'upkeep';
      confirming = false;
      feedback = 'idle';
      clearLocalForms();
      for (const operation of operations)
        if (operation.draftId !== next.key.draftId)
          operations.delete(operation);
    }
  }
  function acceptRemoteChange(change: PersistenceSnapshot['remoteChange']) {
    if (change && change.sequence > remoteSequence) {
      remoteSequence = change.sequence;
      const phases = changedPhases(change.targets);
      if (phases.length) remoteChange = { sequence: change.sequence, phases };
    }
  }
  function rebuild() {
    const observed = persistence?.getSnapshot();
    const accepted = observed?.observation?.draft;
    if (!active) return;
    if (!source || !persistence) {
      publish({ ...state });
      return;
    }
    if (!accepted || observed.observation?.status !== 'open') {
      publishRetained(observed);
      return;
    }
    adoptSuccessor(source);
    retained = null;
    acceptedContext = { draft: accepted, source };
    acceptRemoteChange(observed.remoteChange);
    if (phase === 'persistent' && !accepted.context.persistentPhaseEligible)
      phase = 'upkeep';
    let forecast: WeeklyDraft = accepted;
    for (const item of pending) {
      const result = editWeeklyDraft(forecast, item.edit);
      if (result.ok) forecast = result.draft;
    }
    const preview = projectWeeklyDraft({
      revision: forecast,
      militiaSnapshot: source.snapshot,
    });
    const matching =
      reviewed?.reviewed.sourceKey === preview.sourceKey &&
      reviewed.reviewed.sourceRevision === source.sourceRevision &&
      reviewed.reviewed.revision === accepted.revision;
    // Required Event positions are prepared from the accepted draft only while
    // nothing else is in flight, so every attempt starts from the newest
    // accepted observation and never builds on an unaccepted edit.
    const idle =
      pending.length === 0 &&
      !observed.pending &&
      !getPendingWork() &&
      !confirming &&
      !observed.confirming;
    const wasFailed = preparation.failed;
    const preparationEdits = idle
      ? preparation.next(
          planEventTopology(accepted, preview.phases?.event.positions ?? []),
        )
      : null;
    if (preparation.failed && !wasFailed) feedback = 'failed';
    const readiness = derivePhaseReadiness(forecast, source, preview, {
      acceptedEventIds: acceptedEventIds(accepted),
      preparationFailed: preparation.failed,
    });
    const { views } = readiness;
    dropStaleEndings(views);
    const local = listLocalForms(source.key.draftId);
    // Each open or invalid local form is also a local Required decision of
    // Review; the backend readiness and accepted review are unchanged.
    const phases = readiness.phases.map((item) =>
      item.phase === 'summary' && local.length
        ? {
            ...item,
            ready: false,
            requirements: [
              ...item.requirements,
              ...local.map((form) => ({
                id: `local:${form.id}`,
                message: form.message,
              })),
            ],
          }
        : item,
    );
    const isReviewRequired = reviewRequired || confirmationRejected;
    const canConfirm = Boolean(
      !confirming &&
      !isReviewRequired &&
      matching &&
      reviewed?.status === 'ready' &&
      !getPendingWork() &&
      local.length === 0,
    );
    const forecastPending = pending.length > 0 || !matching;
    const owner = persistence;
    publish({
      status: 'ready',
      setupNotes: source.setupNotes,
      week: accepted.week,
      // Safe cast: derivePhaseReadiness returns a view for every Phase, so the
      // current phase is always found.
      phaseView: views.find((view) => view.phase === phase)!,
      phases,
      referenceFacts: referenceFacts(source, forecast, preview, views),
      navigation: phaseNavigation(phase, phases),
      confirmationDisabledReason: confirmationDisabledReason({
        canConfirm,
        confirming: confirming || observed.confirming,
        reviewRequired: isReviewRequired,
        forecastPending,
        pendingWork: getPendingWork(),
        // Safe cast: phases maps readiness.phases, which has an entry for every
        // phase in phaseOrder, including 'summary'.
        decisions: phases.find((item) => item.phase === 'summary')!.requirements
          .length,
        localForms: local.length,
      }),
      feedback:
        confirming || observed.confirming
          ? 'confirming'
          : pending.length || observed.pending
            ? 'pending'
            : feedback,
      editingDisabled: confirming || observed.confirming,
      remoteChange,
      confirmedWeek,
      dismissConfirmedWeek,
      failureReason: feedback === 'failed' ? observed.failureReason : null,
      canConfirm,
      reviewRequired: isReviewRequired,
      forecastPending,
      pendingWork: getPendingWork(),
      localForms: local,
      edit: (value) =>
        persistence === owner ? edit(value) : Promise.resolve('failed'),
      viewPhase,
      reviewUpdatedWeek,
      confirm: () =>
        persistence === owner ? confirm() : Promise.resolve('failed'),
      eventPreparation: {
        status: preparation.failed
          ? 'failed'
          : preparing || preparationEdits
            ? 'preparing'
            : 'idle',
        retry: retryPreparation,
      },
    });
    if (preparationEdits) void prepare(owner, preparationEdits);
    schedulePreview(owner, accepted, source);
  }
  // Preparation uses the ordinary queued edits. A rejected attempt is not a
  // failure of the player's own work: the next rebuild recomputes the missing
  // positions from the refreshed observation and tries again within bounds.
  async function prepare(owner: Persistence, edits: WeeklyDraftEdit[]) {
    // Safe cast: rebuild, the only caller, returns early when source is null
    // and nothing between that check and its prepare call clears source.
    const operation = { draftId: source!.key.draftId };
    operations.add(operation);
    preparing = true;
    const items = edits.map((edit) => ({
      id: ++sequence,
      edit: structuredClone(edit),
    }));
    pending.push(...items);
    const saving = Promise.all(items.map((item) => owner.edit(item.edit)));
    rebuild();
    const results = await saving;
    const completed = operations.delete(operation);
    pending = pending.filter((entry) => !items.includes(entry));
    if (owner === persistence && active) {
      preparing = false;
      if (results.every((result) => result === 'accepted')) feedback = 'saved';
      previewRequest = '';
      rebuild();
    } else if (completed) rebuild();
  }
  function retryPreparation() {
    preparation.retry();
    rebuild();
  }
  function schedulePreview(
    owner: Persistence,
    accepted: WeeklyDraft,
    previewSource: WorkspaceSource,
  ) {
    if (getPendingWork()) return;
    const request = weeklySourceKey({
      draft: accepted,
      sourceRevision: previewSource.sourceRevision,
      snapshot: previewSource.snapshot,
    });
    if (request === previewRequest) return;
    previewRequest = request;
    const generation = ++previewGeneration;
    void owner
      .preview()
      .then((value) => {
        if (
          !active ||
          persistence !== owner ||
          generation !== previewGeneration
        )
          return;
        reviewed = value;
        if (!value) previewRequest = '';
        // A mismatched query waits for the next accepted source observation.
        if (value) rebuild();
      })
      .catch(() => {
        if (active && persistence === owner && generation === previewGeneration)
          failSource();
      });
  }
  async function edit(edit: WeeklyDraftEdit): Promise<'accepted' | 'failed'> {
    const owner = persistence;
    if (
      state.status !== 'ready' ||
      state.editingDisabled ||
      !owner ||
      owner.getSnapshot().confirming
    )
      return 'failed';
    // Safe cast: the `!owner` guard above proves persistence is set, and
    // source is only null when persistence is null too.
    const operation = { draftId: source!.key.draftId };
    operations.add(operation);
    const item = { id: ++sequence, edit: structuredClone(edit) };
    pending.push(item);
    const saving = owner.edit(item.edit);
    rebuild();
    const result = await saving;
    const completed = operations.delete(operation);
    pending = pending.filter((entry) => entry.id !== item.id);
    if (owner === persistence && active) {
      feedback = result === 'accepted' ? 'saved' : 'failed';
      if (result === 'failed') reviewRequired = true;
      previewRequest = '';
      rebuild();
    } else if (completed) rebuild();
    return result;
  }
  function viewPhase(next: Phase) {
    if (
      state.status !== 'ready' ||
      !state.phases.some((item) => item.phase === next && item.available)
    )
      return;
    if (next === 'summary' && !state.forecastPending && !state.pendingWork)
      reviewRequired = false;
    phase = next;
    rebuild();
  }
  // The explicit review after a stale or rejected request: the refreshed
  // week shown in Review & confirm becomes the one this device confirms.
  function reviewUpdatedWeek() {
    if (
      state.status !== 'ready' ||
      state.forecastPending ||
      state.pendingWork ||
      !state.phases.some((item) => item.phase === 'summary' && item.available)
    )
      return;
    reviewRequired = false;
    confirmationRejected = false;
    phase = 'summary';
    rebuild();
  }
  async function confirm(): Promise<'accepted' | 'failed'> {
    const owner = persistence;
    const review = reviewed;
    if (
      state.status !== 'ready' ||
      state.editingDisabled ||
      !owner ||
      !review ||
      !state.canConfirm
    )
      return 'failed';
    // Safe cast: confirm only gets here past the `!owner` check, and every
    // path that clears source also clears persistence.
    const operation = { draftId: source!.key.draftId };
    operations.add(operation);
    confirming = true;
    rebuild();
    const result = await owner.confirm(review);
    const completed = operations.delete(operation);
    if (active && owner === persistence) {
      if (result === 'failed') confirming = false;
      feedback = result === 'accepted' ? 'saved' : 'failed';
      confirmationRejected = result === 'failed';
      if (result === 'accepted') reviewRequired = false;
      reviewed = null;
      previewRequest = '';
      rebuild();
    } else if (completed) rebuild();
    return result;
  }
  function dismissConfirmedWeek() {
    confirmedWeek = null;
    rebuild();
  }
  function clearPresentation() {
    retained = null;
    handoff = null;
    acceptedContext = null;
    confirmedWeek = null;
    remoteChange = null;
    confirming = false;
    feedback = 'idle';
    clearLocalForms();
    previewGeneration++;
  }
  function receive(next: WorkspaceSource | null) {
    if (!active) return;
    if (!next) {
      clearPresentation();
      stopPersistence();
      persistence?.dispose();
      persistence = null;
      source = null;
      publish({ status: 'unavailable' });
      return;
    }
    const sameScope =
      source?.key.campaignId === next.key.campaignId &&
      source.key.militiaId === next.key.militiaId;
    // Safe cast: sameScope is only true when source?.key.campaignId equalled
    // next's campaign id, so source is set.
    if (sameScope && next.sourceRevision < source!.sourceRevision) return;
    if (!sameScope || source?.key.draftId !== next.key.draftId) {
      replacePersistence(next, sameScope);
    } else if (next.sourceRevision >= source.sourceRevision) source = next;
    rebuild();
  }
  function replacePersistence(next: WorkspaceSource, sameScope: boolean) {
    if (sameScope && state.status === 'ready') {
      retainAccepted();
      // Safe cast: receive passes sameScope true only after matching source's
      // key against next, so source is set.
      handoff ??= { week: state.week, draftId: source!.key.draftId };
    } else {
      clearPresentation();
      phase = gateway?.initialPhase ?? 'upkeep';
      publish({ status: 'loading' });
      for (const operation of operations)
        if (operation.draftId !== next.key.draftId)
          operations.delete(operation);
    }
    stopPersistence();
    persistence?.dispose();
    remoteChange = null;
    remoteSequence = 0;
    source = next;
    pending = [];
    clearLocalForms();
    preparation = createEventPreparation();
    preparing = false;
    reviewed = null;
    reviewRequired = false;
    confirmationRejected = false;
    previewRequest = '';
    previewGeneration++;
    // Safe cast: replacePersistence runs only from receive, which start
    // subscribes only when gateway is non-null.
    const owner = createDraftPersistence(gateway!.transport(next));
    persistence = owner;
    stopPersistence = owner.subscribe(rebuild);
    void owner.ready
      .then(() => {
        if (active && persistence === owner) rebuild();
      })
      .catch(() => {
        if (active && persistence === owner) failSource();
      });
  }
  function failSource() {
    if (!active) return;
    clearPresentation();
    stopPersistence();
    persistence?.dispose();
    persistence = null;
    source = null;
    publish({ status: 'failed' });
  }
  return {
    getSnapshot: () => state,
    getPendingWork,
    setLocalForm,
    keepLocalValues,
    readLocalValues,
    subscribe(this: void, listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      active = true;
      if (gateway) stopSource = gateway.subscribe(receive, failSource);
      return () => {
        active = false;
        clearPresentation();
        stopSource();
        stopPersistence();
        persistence?.dispose();
        persistence = null;
        source = null;
      };
    },
  };
}
