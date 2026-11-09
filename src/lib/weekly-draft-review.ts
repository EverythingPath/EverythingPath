import type { WeeklyDraft } from './weekly-draft-contract';
import { actionChoiceEvents } from './weekly-draft-facts';

export type DraftReviewSubject =
  | { kind: 'activity'; choiceId: string }
  | { kind: 'event' | 'persistent'; eventId: string };
export type DraftReviewRequirement = `${string}:review`;

export function draftReviewRequirement(
  subject: DraftReviewSubject,
): DraftReviewRequirement {
  const id = subject.kind === 'activity' ? subject.choiceId : subject.eventId;
  return `${id}:review`;
}

export function activityReviewRequirement(choiceId: string) {
  return draftReviewRequirement({ kind: 'activity', choiceId });
}

export function draftSourceReviewRequirements(draft: WeeklyDraft) {
  const requirements = new Set<DraftReviewRequirement>();
  const events = [
    ...draft.event.occurrences,
    ...draft.activity.slots.flatMap((slot) => actionChoiceEvents(slot.choice)),
  ];
  for (const event of [...draft.context.carriedEvents, ...events]) {
    const code = draftReviewRequirement({
      kind: 'event',
      eventId: event.eventId,
    });
    if (event.reviewRequired) requirements.add(code);
  }
  for (const decision of [
    ...draft.persistent.decisions,
    ...events.flatMap((event) =>
      event.persistentDecision ? [event.persistentDecision] : [],
    ),
  ])
    if (decision.kind === 'mitigate' && decision.reviewRequired)
      requirements.add(
        draftReviewRequirement({
          kind: 'persistent',
          eventId: decision.eventId,
        }),
      );
  return [...requirements];
}
