import type { WeeklyDraftWorkspace } from './types';

/**
 * The one Confirmation control of Review & confirm, read from the store.
 * The review block's Confirm week and the frame's pinned one are two views
 * of this object: the same enabled state, the same pending label and the
 * same handler, which confirms the retained reviewed source. The store
 * itself refuses a second request while one is in flight.
 */
export type ConfirmControl = {
  /** This device's Confirmation is in flight until the next week is usable. */
  confirming: boolean;
  disabled: boolean;
  /** Why Confirmation is unavailable right now; null when it is available. */
  reason: string | null;
  confirm: () => void;
};

export function readConfirmControl(
  workspace: Extract<WeeklyDraftWorkspace, { status: 'ready' }>,
): ConfirmControl {
  return {
    confirming: workspace.feedback === 'confirming',
    // Every weekly write, Confirm included, is off while a Confirmation is in
    // flight or a closed week is retained read-only (WEEK-10).
    disabled: !workspace.canConfirm || workspace.editingDisabled,
    reason: workspace.confirmationDisabledReason,
    confirm: () => {
      void workspace.confirm();
    },
  };
}
