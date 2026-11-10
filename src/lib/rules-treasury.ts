import type { WeeklyDraft } from './weekly-draft-contract';

// Persistent Theft takes half of incoming gains, not half of expenses or the
// current balance. Several active occurrences impose the same restriction.
export function projectTreasuryIncome(
  grossCopper: number,
  carriedEvents: WeeklyDraft['context']['carriedEvents'],
  endedEventIds: readonly string[] = [],
  week?: number,
) {
  const theftEventIds = carriedEvents
    .filter(
      (event) =>
        event.eventType === 'theft' && !endedEventIds.includes(event.eventId),
    )
    .map((event) => event.eventId);
  const retainedCopper =
    grossCopper > 0 && theftEventIds.length > 0
      ? Math.round(
          grossCopper *
            (carriedEvents
              .filter((event) => theftEventIds.includes(event.eventId))
              .every(
                (event) =>
                  week !== undefined && event.mitigation?.week === week,
              )
              ? 0.9
              : 0.5),
        )
      : grossCopper;
  return { grossCopper, retainedCopper, theftEventIds };
}
