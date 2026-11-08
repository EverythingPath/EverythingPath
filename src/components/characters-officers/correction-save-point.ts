import {
  describeChoice,
  identityNames,
  type AffectedChoice,
} from '~/components/militia-corrections/affected-choice-copy';
import type { CanonicalWeekState } from '~/lib/canonical-weekly-source';
import { correctionImpact } from '~/lib/correction-staged-choices';
import { noCapturedFacts } from '~/lib/reference-restoration';
import {
  managerLimitWarnings,
  pcAssignmentHints,
  rosterRemovalWarnings,
} from '~/lib/roster-corrections';
import {
  allowancePreview,
  rosterChoiceIssues,
  type RosterChoiceIssue,
  type RosterWeek,
} from '~/lib/roster-week-impact';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import { describeIssue } from './correction-copy';

type Snapshot = CanonicalWeekState['militiaSnapshot'];

/** What Save would do, shown above the reason. */
export type SavePoint = {
  /** "Activity actions this week: 5 → 4", or null. */
  allowance: string | null;
  /** Named cascades and lowered limits. */
  warnings: string[];
  /** Newly assigned PCs: normally a Change Officer Role action. */
  hints: string[];
  /** Open-week choices affected, each linked to its phase. */
  affectsWeek: AffectedChoice[];
};

const noFindings: RosterWeek = { allowance: null, findings: new Set() };
// Problems a roster or officer correction can repair; rules exceptions and
// unrelated gaps of the week are left to their phases.
const repairable = (issue: RosterChoiceIssue) =>
  issue.reason !== 'other' && issue.reason !== 'exception';

/**
 * The save point of a correction from `latest` to `corrected`: the
 * Strategist allowance, named cascades and lowered team limits, hints for
 * newly assigned PCs, and the open week's choices it affects: those it
 * newly leaves needing attention (missing identities first) and those
 * already needing a roster or officer repair that it leaves in place.
 */
export function savePoint({
  campaignId,
  latest,
  corrected,
  names,
  draft,
  before,
  after,
}: {
  campaignId: string;
  latest: Snapshot;
  corrected: Snapshot;
  names: ReadonlyMap<string, string>;
  draft: WeeklyDraft | null;
  /** The open week over `latest` and over `corrected`. */
  before: RosterWeek;
  after: RosterWeek;
}): SavePoint {
  const affectsWeek: AffectedChoice[] = [];
  if (draft) {
    const identities = identityNames(latest, noCapturedFacts, names);
    const fresh = rosterChoiceIssues(draft, before, after);
    const still = new Set(
      rosterChoiceIssues(draft, noFindings, after).map((issue) => issue.key),
    );
    const already = rosterChoiceIssues(draft, noFindings, before).filter(
      (issue) =>
        repairable(issue) &&
        still.has(issue.key) &&
        !fresh.some((other) => other.key === issue.key),
    );
    affectsWeek.push(
      ...correctionImpact(draft, latest, corrected).added.map((reference) =>
        describeChoice(reference, campaignId, identities),
      ),
      ...fresh.map((issue) => describeIssue(issue, campaignId)),
      ...already.map((issue) => describeIssue(issue, campaignId, true)),
    );
  }
  return {
    allowance: allowancePreview(before, after),
    warnings: [
      ...rosterRemovalWarnings(latest, corrected, names),
      ...managerLimitWarnings(latest, corrected, names),
    ],
    hints: pcAssignmentHints(latest, corrected, names),
    affectsWeek,
  };
}
