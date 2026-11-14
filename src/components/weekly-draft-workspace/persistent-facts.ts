import { draftSourceReviewRequirements } from '~/lib/weekly-draft-review';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import type { WorkspaceSource } from '~/lib/weekly-workspace-source';
import type { CanonicalResolutionPreview } from '~/lib/canonical-weekly-resolution';
import { eventView } from './event-facts';
import { activityLabel } from './activity-labels';
import {
  buyoffAvailability,
  checkChoice,
  earlierPhases,
  earlierPhasesKey,
  isOwnRequirement,
  leaveNote,
  orderCarriedEvents,
  ordinal,
  projectedResult,
  sourceEndings,
} from './persistent-sections';
import type { PersistentView } from './types';
import { withoutDuplicateRollCodes } from './roll-requirements';
import {
  retainedFields,
  rivalryCheckFacts,
  theftCheckFacts,
  unmitigatedThefts,
} from './persistent-check-facts';

type Carried = WeeklyDraft['context']['carriedEvents'][number];

export function persistentView(
  draft: WeeklyDraft,
  source: WorkspaceSource,
  preview: CanonicalResolutionPreview,
): PersistentView {
  const phases = preview.phases;
  const projection = phases?.persistent;
  const { options, overseer } = eventView(draft, source, preview);
  const events = orderCarriedEvents(draft.context.carriedEvents);
  const named = events.map((event, index) => ({
    eventId: event.eventId,
    eventType: event.eventType,
    name: `${activityLabel(event.eventType)} · Event ${index + 1}`,
  }));
  const targetName = (target: Carried['targets'][number]) => {
    // Safe cast: every eventTargetSchema variant has a required id beside kind.
    const [field, id] = Object.entries(target).find(([key]) => key !== 'kind')!;
    return (
      options[field]?.find((option) => option.value === id)?.label ??
      `Unavailable ${target.kind}`
    );
  };
  const ownIds = events.map((event) => event.eventId);
  const allRequirements = [
    ...new Set([
      ...(projection?.requirements ?? []),
      ...draftSourceReviewRequirements(draft),
    ]),
  ];
  const earlier = earlierPhases(allRequirements, ownIds, phases);
  // The rank, and so the rules cost, is settled once Upkeep is complete.
  const costPending = !phases?.upkeep.ready;
  const endings = sourceEndings(draft, phases);
  const warnings = projection?.warnings ?? [];
  return {
    phase: 'persistent',
    ready:
      (projection?.ready ?? false) &&
      allRequirements.length === 0 &&
      earlier.length === 0,
    firstBuyoff: draft.context.lastBuyoffWeek === null,
    buyoffAvailability: buyoffAvailability(
      draft.week,
      draft.context.lastBuyoffWeek,
    ),
    nextBuyoffWeek: projection
      ? Math.max(draft.week, projection.nextBuyoffWeek)
      : null,
    buyoffCostCopper: costPending
      ? null
      : (projection?.buyoffCostCopper ?? null),
    earlierPhases: earlier,
    options,
    overseer,
    events: events.map((event, index) => {
      const requirements = withoutDuplicateRollCodes(
        allRequirements.filter((key) => key.startsWith(`${event.eventId}:`)),
      );
      const existing = draft.rulesExceptions.filter(
        (entry) => entry.subjectId === event.eventId,
      );
      const decision = structuredClone(
        draft.persistent.decisions.find(
          (entry) => entry.eventId === event.eventId,
        ) ?? null,
      );
      const changes =
        projection?.plan.filter(
          (change) => 'eventId' in change && change.eventId === event.eventId,
        ) ?? [];
      const endedBy = endings.get(event.eventId) ?? null;
      const checks =
        projection?.checks.filter((check) =>
          check.checkId.startsWith(`${event.eventId}:`),
        ) ?? [];
      const eventWarnings = warnings.filter((key) =>
        key.startsWith(`${event.eventId}:`),
      );
      const mitigation = decision?.kind === 'mitigate' ? decision : null;
      const otherThefts =
        event.eventType === 'theft'
          ? unmitigatedThefts(named, phases, event.eventId)
          : [];
      const context = { draft, source, phases };
      return {
        ...structuredClone(event),
        // Safe cast: named is events.map(...), so it has every index of events.
        name: named[index]!.name,
        typeLabel: activityLabel(event.eventType),
        ageWeeks: draft.week - event.startedWeek,
        orderLabel: `${ordinal(event.order + 1)} that week`,
        targetNames: event.targets.map(targetName),
        decision,
        ended: projection?.endedEventIds.includes(event.eventId) ?? false,
        endedBy,
        result: projectedResult({
          event,
          decision,
          endedBy,
          changes,
          requirements,
          costPending,
          otherThefts,
        }),
        leaveNote: leaveNote(event.eventType),
        check: checkChoice(event.eventType),
        changes,
        checks,
        theftCheck:
          mitigation && event.eventType === 'theft'
            ? theftCheckFacts(
                context,
                { eventId: event.eventId, checks, requirements },
                mitigation,
                otherThefts,
              )
            : null,
        rivalryCheck:
          mitigation && event.eventType === 'rivalry'
            ? rivalryCheckFacts(
                context,
                {
                  eventId: event.eventId,
                  changes,
                  requirements,
                  warnings: eventWarnings,
                },
                mitigation,
              )
            : null,
        retained: mitigation
          ? retainedFields(context, event.eventType, mitigation)
          : [],
        requirements,
        warnings: eventWarnings,
        exceptions: [
          ...existing,
          ...requirements.flatMap((key) => {
            if (!key.endsWith(':exception')) return [];
            const ruleId = key.slice(
              event.eventId.length + 1,
              -':exception'.length,
            );
            return existing.some((entry) => entry.ruleId === ruleId)
              ? []
              : [
                  {
                    exceptionId: `persistent:${event.eventId}:${ruleId}`,
                    subjectId: event.eventId,
                    ruleId,
                    reason: '',
                  },
                ];
          }),
        ],
      };
    }),
    // Per-event decisions stay itemised; everything an earlier phase still
    // needs collapses into one "Earlier phases still need preparation" item.
    requirements: [
      ...allRequirements.filter((key) => isOwnRequirement(key, ownIds)),
      ...(earlier.length ? [earlierPhasesKey(earlier)] : []),
    ],
    warnings,
  };
}
