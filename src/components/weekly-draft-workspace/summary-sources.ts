import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import type { WorkspaceSource } from '~/lib/weekly-workspace-source';
import type {
  ActivityView,
  EventView,
  Phase,
  PersistentView,
  SourceLink,
  UpkeepView,
} from './types';
import {
  activitySlotAnchor,
  eventOccurrenceAnchor,
  localFormElementId,
  persistentEventAnchor,
  upkeepStepAnchor,
  type UpkeepStep,
} from './source-anchors';

// Where a Review & confirm Required decision or warning comes from: the
// phase whose own list carries the code (the earliest, since Event repeats
// Activity's) and, where it can be named, the item within it. Codes of a
// saved Table Adjustment stay in Review and focus that adjustment. This is
// navigation only; readiness and its counts are unchanged.

type SourcePhase = Exclude<Phase, 'summary'>;
export type ReviewSourceFacts = {
  codes: readonly string[];
  /** Each phase's own requirement and warning codes. */
  owners: Record<SourcePhase, readonly string[]>;
  slots: readonly { slotId: string; choiceId: string | null }[];
  eventIds: readonly string[];
  persistentEventIds: readonly string[];
  teamIds: readonly string[];
  transferIds: readonly string[];
  adjustmentIds: readonly string[];
};

const sourcePhases: SourcePhase[] = [
  'upkeep',
  'activity',
  'event',
  'persistent',
];

// An identifier names a whole `:`-separated part of a code, never a prefix
// of a longer identifier.
const isNamedIn = (code: string, id: string) => `:${code}:`.includes(`:${id}:`);

function findUpkeepStep(
  code: string,
  facts: ReviewSourceFacts,
): UpkeepStep | null {
  if (/^upkeep:(boon|rank)\b|^rank:/.test(code)) return 'rank';
  if (code.startsWith('upkeep:attrition')) return 'attrition';
  if (code.startsWith('upkeep:notoriety')) return 'notoriety';
  if (code.startsWith('upkeep:shortage')) return 'shortage';
  if (
    code.startsWith('transfer:') ||
    facts.transferIds.some((id) => isNamedIn(code, id))
  )
    return 'transfers';
  if (
    code.startsWith('team:') ||
    facts.teamIds.some((id) => isNamedIn(code, id))
  )
    return 'teams';
  return null;
}

function findItemAnchor(
  phase: SourcePhase,
  code: string,
  facts: ReviewSourceFacts,
): string | null {
  if (phase === 'upkeep') {
    const step = findUpkeepStep(code, facts);
    return step ? upkeepStepAnchor(step) : null;
  }
  if (phase === 'activity') {
    const slot = facts.slots.find(
      (item) =>
        isNamedIn(code, item.slotId) ||
        (item.choiceId !== null && isNamedIn(code, item.choiceId)),
    );
    return slot ? activitySlotAnchor(slot.slotId) : null;
  }
  const ids = phase === 'event' ? facts.eventIds : facts.persistentEventIds;
  const id = ids.find((item) => isNamedIn(code, item));
  if (!id) return null;
  return phase === 'event'
    ? eventOccurrenceAnchor(id)
    : persistentEventAnchor(id);
}

// The earliest phase listing the code; an unlisted code keeps the phase its
// prefix names.
function findOwnerPhase(
  code: string,
  facts: ReviewSourceFacts,
): SourcePhase | null {
  const owner = sourcePhases.find((phase) =>
    facts.owners[phase].includes(code),
  );
  if (owner) return owner;
  if (code.startsWith('upkeep:')) return 'upkeep';
  if (code.startsWith('event:')) return 'event';
  return null;
}

function findSource(code: string, facts: ReviewSourceFacts): SourceLink | null {
  const adjustment = facts.adjustmentIds.find((id) =>
    code.startsWith(`adjustment:${id}:`),
  );
  if (adjustment)
    return {
      phase: 'summary',
      anchor: localFormElementId(`adjustment:${adjustment}`),
    };
  const phase = findOwnerPhase(code, facts);
  if (!phase) return null;
  return { phase, anchor: findItemAnchor(phase, code, facts) };
}

/** Each code's source, keyed by code; codes with no known source are absent. */
export function reviewSources(
  facts: ReviewSourceFacts,
): Record<string, SourceLink> {
  return Object.fromEntries(
    facts.codes.flatMap((code) => {
      const found = findSource(code, facts);
      return found ? [[code, found]] : [];
    }),
  );
}

type OwnCodes = { requirements: string[]; warnings: string[] };
const ownCodes = (view: OwnCodes) => [...view.requirements, ...view.warnings];

/** The live Summary's sources, read from the same phase views it derives. */
export function liveReviewSources({
  draft,
  source,
  codes,
  views,
}: {
  draft: WeeklyDraft;
  source: WorkspaceSource;
  codes: readonly string[];
  views: {
    upkeep: UpkeepView;
    activity: ActivityView;
    event: EventView;
    persistent: PersistentView;
  };
}) {
  return reviewSources({
    codes,
    owners: {
      upkeep: ownCodes(views.upkeep),
      activity: ownCodes(views.activity),
      event: ownCodes(views.event),
      persistent: ownCodes(views.persistent),
    },
    slots: views.activity.slots.map((slot) => ({
      slotId: slot.slotId,
      choiceId: slot.choice?.choiceId ?? null,
    })),
    eventIds: views.event.occurrences.map((event) => event.occurrence.eventId),
    persistentEventIds: views.persistent.events.map((event) => event.eventId),
    teamIds: source.snapshot.roster.teams.map((team) => team.teamId),
    transferIds: draft.upkeep.treasuryTransfers.map((item) => item.transferId),
    adjustmentIds: draft.tableAdjustments.map((item) => item.adjustmentId),
  });
}
