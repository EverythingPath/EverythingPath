import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import type { WorkspaceSource } from '~/lib/weekly-workspace-source';
import type { CanonicalResolutionPreview } from '~/lib/canonical-weekly-resolution';
import type { UpkeepView, PhaseView } from './types';
import { activityView } from './activity-facts';
import { eventView, type EventPreparationContext } from './event-facts';
import { persistentView } from './persistent-facts';
import { activityLabel } from './activity-labels';
import { withoutDuplicateRollCodes } from './roll-requirements';
import { eventSubjectLabel } from './event-tree-facts';
import { liveWeekReview } from './summary-review';
import { summaryMessage } from './summary-messages';
import { liveReviewSources } from './summary-sources';
import { isAppliedAdjustment } from '~/components/week-review/review-notes';
export function summaryView(
  draft: WeeklyDraft,
  source: WorkspaceSource,
  preview: CanonicalResolutionPreview,
  upkeep: UpkeepView,
  eventContext?: EventPreparationContext,
): Extract<PhaseView, { phase: 'summary' }> {
  const activity = activityView(draft, source, preview);
  const events = eventView(draft, source, preview, eventContext);
  const persistent = persistentView(draft, source, preview);
  const candidates = [
    ...upkeep.exceptions,
    ...activity.slots.flatMap((slot, index) =>
      slot.exceptions.map((item) => ({
        ...item,
        // Safe cast: activity-facts builds exceptions from the choice's
        // requirements and rulesExceptions, both empty for a slot without a
        // choice, so this callback only runs for chosen slots.
        subjectId: slot.choice!.choiceId,
        name: `Activity ${index + 1}: ${activity.actions.find((action) => action.actionId === slot.choice?.actionId)?.name ?? 'Choice'}`,
      })),
    ),
    ...events.occurrences.flatMap((event) =>
      event.exceptionChoices.map((item) => ({
        ...item,
        name: eventSubjectLabel(event),
      })),
    ),
    ...persistent.events.flatMap((event) =>
      event.exceptions.map((item) => ({ ...item, name: event.name })),
    ),
  ];
  const subjects = [
    ...activity.slots.flatMap((slot, index) =>
      slot.choice
        ? [
            {
              value: slot.choice.choiceId,
              label: `${activityLabel(slot.choice.actionId)} · Slot ${index + 1}`,
            },
          ]
        : [],
    ),
    ...events.occurrences.flatMap((event) => {
      const label = eventSubjectLabel(event);
      return [
        { value: event.occurrence.eventId, label },
        { value: `event:${event.occurrence.eventId}`, label },
        ...(event.occurrence.sabotage
          ? [
              {
                value: `sabotage:${event.occurrence.eventId}:${event.occurrence.sabotage.choiceId}`,
                label: `${label} · Sabotage`,
              },
            ]
          : []),
      ];
    }),
    ...persistent.events.map((event) => ({
      value: event.eventId,
      label: event.name,
    })),
    ...source.people.map((person) => ({
      value: person.characterId,
      label: person.name ?? 'Unnamed character',
    })),
    ...activity.teams,
    ...activity.settlements,
    ...draft.upkeep.treasuryTransfers.map((item) => ({
      value: item.transferId,
      label: `Treasury ${item.direction}`,
    })),
  ];
  const exceptions = [
    ...new Map(
      [
        ...draft.rulesExceptions.map((item) => ({
          ...item,
          name:
            subjects.find((subject) => subject.value === item.subjectId)
              ?.label ?? 'Table ruling',
        })),
        ...candidates,
      ].map((item) => [item.exceptionId, item]),
    ).values(),
  ];
  const options: Extract<PhaseView, { phase: 'summary' }>['options'] = {
    ...events.options,
    subjectId: subjects,
    choiceId: subjects,
    sourceId: subjects,
  };
  const eventMessages = events.messages;
  const states = [preview.baseline, preview.outcome].filter(
    (state) => state !== null,
  );
  for (const state of states) {
    for (const [field, values] of Object.entries({
      teamId: state.militiaSnapshot.roster.teams.map((team) => ({
        value: team.teamId,
        label: team.name,
      })),
      itemId: (state.militiaSnapshot.economy?.items ?? []).map((item) => ({
        value: item.itemId,
        label: item.name,
      })),
      cacheId: (state.militiaSnapshot.economy?.caches ?? []).map((cache) => ({
        value: cache.cacheId,
        label: cache.location,
      })),
      eventId: state.context.carriedEvents.map((event, index) => ({
        value: event.eventId,
        label:
          options.eventId?.find((item) => item.value === event.eventId)
            ?.label ?? `${activityLabel(event.eventType)} · Event ${index + 1}`,
      })),
    }))
      options[field] = [
        ...new Map(
          [...(options[field] ?? []), ...values].map((item) => [
            item.value,
            item,
          ]),
        ).values(),
      ];
  }
  // One line per missing die, as the Event phase shows it (#164).
  const requirements = withoutDuplicateRollCodes(preview.requirements);
  // An applied Table Adjustment is the table's decision, not a warning.
  const warnings = preview.warnings.filter(
    (code) => !isAppliedAdjustment(code, draft.tableAdjustments),
  );
  const sources = liveReviewSources({
    draft,
    source,
    codes: [...requirements, ...warnings],
    views: { upkeep, activity, event: events, persistent },
  });
  const view: Omit<Extract<PhaseView, { phase: 'summary' }>, 'review'> = {
    phase: 'summary',
    ready: preview.status === 'ready',
    adjustments: structuredClone(draft.tableAdjustments),
    exceptions,
    acknowledgements: draft.acknowledgements.map((item) => ({
      ...item,
      name:
        subjects.find((subject) => subject.value === item.subjectId)?.label ??
        'Table outcome',
    })),
    people: source.people.map((person) => ({
      ...person,
      name: person.name ?? 'Unnamed character',
    })),
    options,
    eventMessages,
    baseline: preview.baseline,
    outcome: preview.outcome,
    effects: preview.phases
      ? {
          upkeep: preview.phases.upkeep.plan,
          activity: preview.phases.activity.plan,
          event: preview.phases.event.plan,
          sabotage: preview.phases.event.sabotage,
          persistent: preview.phases.persistent.plan,
        }
      : null,
    requirements,
    warnings,
    sources,
  };
  return {
    ...view,
    review: liveWeekReview({
      draft,
      source,
      preview,
      views: { upkeep, activity, event: events, persistent },
      summary: view,
      message: (code, warning) => summaryMessage(code, view, warning),
    }),
  };
}
