import type { CanonicalWeekState } from '~/lib/canonical-weekly-source';
import {
  mergeSection,
  sectionKey,
  type MilitiaSectionKey,
  type SectionValue,
} from '~/lib/militia-correction-sections';
import { rosterBaselineKey } from '~/lib/roster-corrections';
import { classifyWriteFailure } from '~/lib/write-outcome';

// One local Militia Correction on this device: which section is open, the
// accepted section it started from, and what became of its last Save. The
// latest accepted militia is never stored here; every view is derived from
// it, so remote changes, a new week and a delayed acknowledgement are
// reconciled when they are observed. Other devices are never locked.

/** The newest accepted militia this device has observed. */
export type AcceptedMilitia = {
  revision: number;
  /** The open week's draft; a new one means the week changed. */
  draftId: string;
  state: CanonicalWeekState;
};

export type CorrectionTarget =
  | { kind: 'section'; section: MilitiaSectionKey }
  // Characters & officers' two corrections. Both depend on the whole roster
  // baseline (people, officer assignments and team managers), so any change
  // to it by another player is a conflict; other facts are merged.
  | { kind: 'officers' }
  | { kind: 'roster' };

/** What a correction corrects: a Militia section, the officers or roster. */
export type CorrectionSubject = MilitiaSectionKey | 'officers' | 'roster';

type Captured = {
  revision: number;
  draftId: string;
  week: number;
  /** Structural identity of the corrected facts when Correct was pressed. */
  section: string;
};

/** One Save: the revision it was sent against and the section it wrote. */
export type SaveAttempt = { expectedRevision: number; candidate: string };

type Status =
  | { kind: 'editing'; notice: 'unchanged' | null }
  | { kind: 'conflict' }
  | { kind: 'saving'; attempt: SaveAttempt }
  | { kind: 'rejected'; attempt: SaveAttempt; message: string | null }
  | { kind: 'unknown'; attempt: SaveAttempt };

export type Feedback = { kind: 'saved' | 'matched'; entry: CorrectionSubject };

export type Correction =
  | { kind: 'closed'; feedback: Feedback | null }
  | {
      kind: 'open';
      target: CorrectionTarget;
      captured: Captured;
      status: Status;
    };

export type CorrectionAction =
  | { type: 'open'; target: CorrectionTarget; accepted: AcceptedMilitia }
  | { type: 'restart'; accepted: AcceptedMilitia }
  | { type: 'cancel' }
  | { type: 'conflict' }
  | { type: 'unchanged' }
  | { type: 'submit'; attempt: SaveAttempt }
  | { type: 'accepted'; attempt: SaveAttempt }
  | { type: 'rejected'; attempt: SaveAttempt; message: string | null }
  | { type: 'unknown'; attempt: SaveAttempt }
  // The newest militia settled the open correction (see `correctionView`).
  | { type: 'reconciled'; feedback: Feedback };

export const closedCorrection: Correction = { kind: 'closed', feedback: null };

type Snapshot = CanonicalWeekState['militiaSnapshot'];
const targetKey = (target: CorrectionTarget, snapshot: Snapshot) =>
  target.kind === 'section'
    ? sectionKey(target.section, snapshot)
    : rosterBaselineKey(snapshot);

function capture(
  target: CorrectionTarget,
  accepted: AcceptedMilitia,
): Captured {
  return {
    revision: accepted.revision,
    draftId: accepted.draftId,
    week: accepted.state.week,
    section: targetKey(target, accepted.state.militiaSnapshot),
  };
}

const entryOf = (target: CorrectionTarget): CorrectionSubject =>
  target.kind === 'section' ? target.section : target.kind;

const sameAttempt = (status: Status, attempt: SaveAttempt) =>
  'attempt' in status &&
  status.attempt.expectedRevision === attempt.expectedRevision &&
  status.attempt.candidate === attempt.candidate;

export function correctionReducer(
  state: Correction,
  action: CorrectionAction,
): Correction {
  if (action.type === 'open')
    return state.kind === 'open'
      ? state
      : {
          kind: 'open',
          target: action.target,
          captured: capture(action.target, action.accepted),
          status: { kind: 'editing', notice: null },
        };
  if (state.kind === 'closed') return state;
  const saving = state.status.kind === 'saving';
  switch (action.type) {
    case 'restart':
      // A new correction from the newest facts: the caller also clears the
      // fields and the reason.
      if (saving) return state;
      return {
        ...state,
        captured: capture(state.target, action.accepted),
        status: { kind: 'editing', notice: null },
      };
    case 'cancel':
      return saving ? state : closedCorrection;
    case 'conflict':
      return saving ? state : { ...state, status: { kind: 'conflict' } };
    case 'unchanged':
      return saving
        ? state
        : { ...state, status: { kind: 'editing', notice: 'unchanged' } };
    case 'submit':
      return saving
        ? state
        : { ...state, status: { kind: 'saving', attempt: action.attempt } };
    case 'accepted':
      return sameAttempt(state.status, action.attempt)
        ? {
            kind: 'closed',
            feedback: { kind: 'saved', entry: entryOf(state.target) },
          }
        : state;
    case 'rejected':
      return sameAttempt(state.status, action.attempt)
        ? {
            ...state,
            status: {
              kind: 'rejected',
              attempt: action.attempt,
              message: action.message,
            },
          }
        : state;
    case 'unknown':
      return sameAttempt(state.status, action.attempt)
        ? { ...state, status: { kind: 'unknown', attempt: action.attempt } }
        : state;
    case 'reconciled':
      return saving ? state : { kind: 'closed', feedback: action.feedback };
  }
}

export type CorrectionView =
  | { kind: 'closed'; feedback: Feedback | null }
  | {
      kind: 'editing';
      /**
       * `retry`: the militia changed while saving but not in this section;
       * `unconfirmed`: the last Save may not have been applied and the
       * militia does not show it; `rejected`: refused with `message`.
       */
      notice: 'unchanged' | 'retry' | 'unconfirmed' | 'rejected' | null;
      message: string | null;
    }
  | { kind: 'saving' }
  | { kind: 'conflict' }
  | { kind: 'weekChanged' };

const editing = (
  notice: Extract<CorrectionView, { kind: 'editing' }>['notice'] = null,
  message: string | null = null,
): CorrectionView => ({ kind: 'editing', notice, message });

// What the open correction means against the newest accepted militia.
export function correctionView(
  state: Correction,
  accepted: AcceptedMilitia,
): CorrectionView {
  if (state.kind === 'closed') return state;
  const { status, captured, target } = state;
  if (status.kind === 'saving') return { kind: 'saving' };
  if (
    accepted.draftId !== captured.draftId ||
    accepted.state.week !== captured.week
  )
    return { kind: 'weekChanged' };
  const latest = targetKey(target, accepted.state.militiaSnapshot);
  const changed = latest !== captured.section;
  if (status.kind === 'editing') return editing(status.notice);
  if (status.kind === 'conflict') return { kind: 'conflict' };
  // Saves are bound to their revision, so saving again can never apply the
  // same correction twice. Until a newer revision is observed, a Save that
  // failed or went unconfirmed has not been applied.
  if (accepted.revision === status.attempt.expectedRevision)
    return status.kind === 'rejected'
      ? editing('rejected', status.message)
      : editing('unconfirmed');
  // The militia moved on. If it now shows this correction (an earlier
  // unconfirmed Save was applied), there is nothing left to save; the reason
  // is not claimed as stored.
  if (latest === status.attempt.candidate)
    return {
      kind: 'closed',
      feedback: { kind: 'matched', entry: entryOf(target) },
    };
  if (changed) return { kind: 'conflict' };
  // A refusal against an older revision was a race with another section's
  // write: retry against the newest militia.
  return editing(status.kind === 'rejected' ? 'retry' : 'unconfirmed');
}

export type SavePlan =
  | { kind: 'busy' }
  | { kind: 'conflict' }
  | { kind: 'unchanged' }
  | {
      kind: 'send';
      attempt: SaveAttempt;
      snapshot: CanonicalWeekState['militiaSnapshot'];
    };

// Save applies the player's correction to the newest accepted militia and
// sends it against the newest revision, unless another player changed what
// it corrects since Correct (even another row of it), which is a conflict.
function planSave(
  state: Extract<Correction, { kind: 'open' }>,
  accepted: AcceptedMilitia,
  apply: (latest: Snapshot) => Snapshot,
): SavePlan {
  const view = correctionView(state, accepted);
  if (view.kind !== 'editing' && view.kind !== 'conflict')
    return { kind: 'busy' };
  const latest = accepted.state.militiaSnapshot;
  const current = targetKey(state.target, latest);
  if (view.kind === 'conflict' || current !== state.captured.section)
    return { kind: 'conflict' };
  const snapshot = apply(latest);
  const candidate = targetKey(state.target, snapshot);
  if (candidate === current) return { kind: 'unchanged' };
  return {
    kind: 'send',
    attempt: { expectedRevision: accepted.revision, candidate },
    snapshot,
  };
}

/** A section correction's Save: only that section is merged. */
export function planSectionSave<K extends MilitiaSectionKey>(
  state: Correction,
  accepted: AcceptedMilitia,
  section: K,
  yours: SectionValue<K>,
): SavePlan {
  if (state.kind !== 'open' || state.target.kind !== 'section')
    return { kind: 'busy' };
  return planSave(state, accepted, (latest) =>
    mergeSection(section, latest, yours),
  );
}

/**
 * An officer or roster correction's Save: `apply` makes the correction on
 * the newest militia (only the assignments, or membership and overrides
 * with their cascades).
 */
export function planRosterSave(
  state: Correction,
  accepted: AcceptedMilitia,
  apply: (latest: Snapshot) => Snapshot,
): SavePlan {
  if (state.kind !== 'open' || state.target.kind === 'section')
    return { kind: 'busy' };
  return planSave(state, accepted, apply);
}

/** A correction as the militia's only write accepts it. */
export type CorrectionWrite = (correction: {
  expectedRevision: number;
  snapshot: Snapshot;
  reason: string;
}) => Promise<unknown>;

// Sends one planned correction and reports its outcome to the lifecycle.
// Only a ConvexError is a definite refusal; anything else may or may not
// have been applied and is reconciled from the observed militia.
export function sendCorrection(
  plan: Extract<SavePlan, { kind: 'send' }>,
  reason: string,
  save: CorrectionWrite,
  dispatch: (action: CorrectionAction) => void,
) {
  const { attempt } = plan;
  dispatch({ type: 'submit', attempt });
  return save({
    expectedRevision: attempt.expectedRevision,
    snapshot: plan.snapshot,
    reason,
  }).then(
    () => dispatch({ type: 'accepted', attempt }),
    (error: unknown) => {
      const failure = classifyWriteFailure(error);
      dispatch(
        failure.kind === 'rejected'
          ? { type: 'rejected', attempt, message: failure.message }
          : { type: 'unknown', attempt },
      );
    },
  );
}
