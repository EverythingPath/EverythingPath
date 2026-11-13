import type { ActivityProjection } from '~/lib/rules-activity';
import type { EventOutcomeProjection } from '~/lib/rules-event-outcomes';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import type { RawRoll } from '~/lib/weekly-draft-facts';
import type {
  ActivityTeamFact,
  ActivityView,
  EventOccurrenceFacts,
  EventWhatHappened,
} from './types';

// One occurrence's facts before its event-specific panel is added.
export type EventPanelItem = Omit<EventOccurrenceFacts, 'panel'>;
type Item = EventPanelItem;

// What the event-specific controls need beyond the occurrence itself. Teams,
// refuges and hidden people are read after Activity: events before this one
// in the week never add them, and the rules stop a second Raid on a refuge
// the first one closed.
export type EventPanelContext = {
  draft: WeeklyDraft;
  projection: EventOutcomeProjection | undefined;
  activity: ActivityProjection | undefined;
  teams: ActivityTeamFact[];
  // Activity's slots with their checks and worded issues, which Hidden
  // Agenda recalculates.
  activitySlots: ActivityView['slots'];
  personName: (characterId: string) => string | null;
  settlementName: (settlementId: string) => string | null;
  // "Event 3 · Sickness"
  eventLabel: (eventId: string) => string;
  modifierLabel: (source: string, recorded: RawRoll | undefined) => string;
};

// The militia's rank while the Event resolves.
export const eventRank = (context: EventPanelContext) =>
  context.activity?.outcome.rank ?? context.projection?.outcome.rank ?? 0;

// The occurrence's own requirement codes, by the part after `<eventId>:`.
export function codes(item: Item) {
  const id = item.occurrence.eventId;
  return {
    has: (tail: string) => item.requirements.includes(`${id}:${tail}`),
  };
}

export function whatHappened(
  item: Item,
  context: EventPanelContext,
  hint: string,
): EventWhatHappened {
  const subjectId = `event:${item.occurrence.eventId}`;
  const recorded = context.draft.acknowledgements.find(
    (entry) => entry.subjectId === subjectId,
  );
  return {
    subjectId,
    // The rules ask for it while it is missing, and use it once recorded.
    required:
      codes(item).has('acknowledgement') ||
      item.changes.some((change) => change.kind === 'event_acknowledgement'),
    hint,
    acknowledgement: recorded
      ? {
          acknowledgementId: recorded.acknowledgementId,
          outcome: recorded.outcome,
        }
      : null,
  };
}
