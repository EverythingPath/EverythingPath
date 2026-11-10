import { projectWeeklyDraft } from './canonical-weekly-resolution';
import type { CanonicalWeekState } from './canonical-weekly-source';
import {
  choicePhase,
  type ChoiceLocation,
  type StagedChoicePhase,
} from './correction-staged-choices';
import { getAdvancementForRank } from './militia-progression-rules';
import { projectOfficers } from './rules-officers';
import type { WeeklyDraft } from './weekly-draft-contract';
import { actionChoiceEvents } from './weekly-draft-facts';

// What a roster or officer correction does to the open week, read from the
// shared rules rather than re-derived: the week is projected over the
// accepted militia and over the corrected one, and what the correction
// newly asks of the week's choices is located at the choice that repairs it.
// A choice can need attention while every character it names still exists:
// a pending Change Officer Role for a role its character no longer holds, an
// Overseer selection for someone who is no longer Overseer, a slot the
// Strategist's action no longer covers.

type Snapshot = CanonicalWeekState['militiaSnapshot'];

/** The open week as the rules see it over one militia. */
export type RosterWeek = {
  /** Activity actions this week; null when the rules cannot tell. */
  allowance: number | null;
  /** Every rules requirement and warning the week has. */
  findings: ReadonlySet<string>;
};

// Without an open week, or before the rank's allowance is known: the rank's
// actions and the Strategist's one.
function rankAllowance(snapshot: Snapshot) {
  const row = getAdvancementForRank(snapshot.rank);
  if (!row) return null;
  const officers = projectOfficers(
    snapshot.roster,
    snapshot.characters,
    snapshot.focus,
  );
  return row.actions + (officers.strategistAssigned ? 1 : 0);
}

/** The open week's allowance and rules findings over `snapshot`. */
export function projectRosterWeek(
  snapshot: Snapshot,
  draft: WeeklyDraft | null,
): RosterWeek {
  if (!draft)
    return { allowance: rankAllowance(snapshot), findings: new Set() };
  const preview = projectWeeklyDraft({
    revision: draft,
    militiaSnapshot: snapshot,
  });
  // The allowance Activity starts with, after Upkeep.
  const first = preview.phases?.activity.slots[0];
  return {
    allowance: first?.allowanceKnown
      ? first.allowance
      : rankAllowance(snapshot),
    findings: new Set([...preview.requirements, ...preview.warnings]),
  };
}

/** "Activity actions this week: 5 → 4", or null when it does not change. */
export function allowancePreview(before: RosterWeek, after: RosterWeek) {
  if (
    before.allowance === null ||
    after.allowance === null ||
    before.allowance === after.allowance
  )
    return null;
  return `Activity actions this week: ${before.allowance} → ${after.allowance}`;
}

/** Why a choice needs attention after the correction. */
export type ChoiceIssueReason =
  | 'character'
  | 'fromRole'
  | 'duplicateRole'
  | 'capacity'
  | 'overseer'
  | 'exception'
  | 'other';

export type RosterChoiceIssue = {
  key: string;
  location: ChoiceLocation;
  phase: StagedChoicePhase;
  reason: ChoiceIssueReason;
};

const reasonOrder: ChoiceIssueReason[] = [
  'character',
  'fromRole',
  'duplicateRole',
  'capacity',
  'overseer',
  'exception',
  'other',
];

// The rule a finding names: its last part, after the owner's identity and
// any check within it ("0:overseer-ineligible").
function reasonOf(finding: string): ChoiceIssueReason {
  if (finding.endsWith(':exception')) return 'exception';
  const rule = finding.split(':').at(-1);
  switch (rule) {
    case 'character':
    case 'officer':
      return 'character';
    case 'from-role':
      return 'fromRole';
    case 'duplicate-role':
      return 'duplicateRole';
    case 'action-capacity':
    case 'capacity':
      return 'capacity';
    case 'officer-pc':
    case 'officer-role-limit':
    case 'officer-assignment':
    case 'manager-limit':
      return 'exception';
  }
  return rule?.startsWith('overseer') ? 'overseer' : 'other';
}

function locationKey(location: ChoiceLocation) {
  switch (location.kind) {
    case 'activitySlot':
      return `activitySlot:${location.slotId}`;
    case 'event':
    case 'persistentDecision':
      return `${location.kind}:${location.eventId}`;
    default:
      return location.kind;
  }
}

type Owner = { prefix: string; location: ChoiceLocation; order: number };

// The owners findings are keyed by: an Activity choice (and the events it
// produced and its slot), a rolled event, a carried event's decision.
function owners(draft: WeeklyDraft): Owner[] {
  const found: Owner[] = [];
  draft.activity.slots.forEach((slot, index) => {
    if (!slot.choice) return;
    const location: ChoiceLocation = {
      kind: 'activitySlot',
      slotId: slot.slotId,
      position: index + 1,
      actionId: slot.choice.actionId,
    };
    const order = 100 + index;
    found.push(
      { prefix: `${slot.choice.choiceId}:`, location, order },
      { prefix: `slot:${slot.slotId}:`, location, order },
      ...actionChoiceEvents(slot.choice).map((event) => ({
        prefix: `${event.eventId}:`,
        location,
        order,
      })),
    );
  });
  draft.event.occurrences.forEach((event, index) =>
    found.push({
      prefix: `${event.eventId}:`,
      location: {
        kind: 'event',
        eventId: event.eventId,
        eventType: event.eventType ?? null,
      },
      order: 1000 + index,
    }),
  );
  draft.context.carriedEvents.forEach((event, index) =>
    found.push({
      prefix: `${event.eventId}:`,
      location: {
        kind: 'persistentDecision',
        eventId: event.eventId,
        eventType: event.eventType,
      },
      order: 2000 + index,
    }),
  );
  // The longest identity first, so one containing ':' still locates.
  return found.sort((a, b) => b.prefix.length - a.prefix.length);
}

/**
 * The open week's choices that the correction newly leaves needing
 * attention, one per choice with its most direct reason, in week order.
 * Missing identities are named by the Militia corrections' reference
 * warnings instead, so they are left out here.
 */
export function rosterChoiceIssues(
  draft: WeeklyDraft,
  before: RosterWeek,
  after: RosterWeek,
): RosterChoiceIssue[] {
  const located = owners(draft);
  const issues = new Map<string, RosterChoiceIssue & { order: number }>();
  for (const finding of after.findings) {
    if (before.findings.has(finding) || finding.endsWith(':reference'))
      continue;
    const owner = located.find(({ prefix }) => finding.startsWith(prefix));
    if (!owner) continue;
    const phase = choicePhase(owner.location);
    if (!phase) continue;
    const reason = reasonOf(finding.slice(owner.prefix.length));
    const key = locationKey(owner.location);
    const existing = issues.get(key);
    if (
      existing &&
      reasonOrder.indexOf(existing.reason) <= reasonOrder.indexOf(reason)
    )
      continue;
    issues.set(key, {
      key,
      location: owner.location,
      phase,
      reason,
      order: owner.order,
    });
  }
  return [...issues.values()]
    .sort((a, b) => a.order - b.order)
    .map(({ order: _order, ...issue }) => issue);
}
