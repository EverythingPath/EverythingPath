import { activityLabel } from '~/components/weekly-draft-workspace/activity-labels';
import type { AffectedChoice } from '~/components/militia-corrections/affected-choice-copy';
import { choiceLabel } from '~/components/militia-corrections/affected-choice-copy';
import { weekPath } from '~/lib/campaign-routes';
import type {
  ChoiceIssueReason,
  RosterChoiceIssue,
} from '~/lib/roster-week-impact';

// User-facing wording of Characters & officers' two corrections. Nothing
// here names storage, revisions or synchronization.

export type CorrectionMode = 'officers' | 'roster';

export const MODE_HEADINGS: Record<CorrectionMode, string> = {
  officers: 'Correct officers',
  roster: 'Correct roster',
};

/**
 * The approved quick-pick reasons (#141 §1); picking one fills the reason,
 * which stays editable. This exception to Militia's no-preset-reasons
 * pattern applies only to these two corrections.
 */
export const QUICK_REASONS = [
  'Story change',
  'Fixing a mistake',
  'New officer joined',
  'Character left',
] as const;

export const HIT_DICE_INVALID = 'Enter a whole number of 0 or more.';

/** The Hit Dice override's label, for its input and the error summary. */
export const hitDiceLabel = (name: string) => `${name}'s Hit Dice`;

/** The error summary's link to a malformed Hit Dice override. */
export const hitDiceSummary = (name: string) =>
  `Enter a whole number of 0 or more for ${hitDiceLabel(name)}.`;

/**
 * The corrected roster fails the militia's integrity checks (a person
 * without their character's facts, a duplicate): never expected from these
 * controls, and never sent.
 */
export const INVALID_CORRECTION =
  'This correction leaves the roster incomplete. Start again from the latest values.';

/** Why a record whose rules facts the militia lacks cannot join yet. */
export const cannotJoinMessage = (name: string) =>
  `Open ${name}'s record and save it before adding them to the roster.`;

const NEW: Record<ChoiceIssueReason, string> = {
  character: 'would name a character who is not on the roster',
  fromRole: 'would change a role its character no longer holds',
  duplicateRole: 'would give a role its character already holds',
  capacity: 'would be beyond this week’s actions',
  overseer: 'would use an Overseer who no longer holds the role',
  exception: 'would need a rules exception',
  other: 'would need review',
};
const ALREADY: Record<ChoiceIssueReason, string> = {
  character: 'names a character who is not on the roster',
  fromRole: 'changes a role its character does not hold',
  duplicateRole: 'gives a role its character already holds',
  capacity: 'is beyond this week’s actions',
  overseer: 'uses an Overseer who does not hold the role',
  exception: 'needs a rules exception',
  other: 'needs review',
};

/**
 * A choice of the open week the correction affects, linked to the phase
 * that repairs it: "Activity slot 2 (Change Officer Role) would change a
 * role its character no longer holds." `existing` issues were already
 * there and the correction does not repair them.
 */
export function describeIssue(
  issue: RosterChoiceIssue,
  campaignId: string,
  existing = false,
): AffectedChoice {
  const { location } = issue;
  const action =
    location.kind === 'activitySlot' ? activityLabel(location.actionId) : null;
  const phrase = (existing ? ALREADY : NEW)[issue.reason];
  return {
    key: `${existing ? 'existing' : 'new'}:${issue.key}`,
    label: choiceLabel(location),
    action,
    detail: action ? `${action} · ${phrase}` : phrase,
    before: '',
    after: `${action ? `(${action}) ` : ''}${phrase}.`,
    href: weekPath(campaignId, issue.phase),
  };
}
