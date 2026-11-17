import type { CanonicalResolutionPreview } from '~/lib/canonical-weekly-resolution';
import {
  isCandidateChoice,
  isSurplusEventOccurrence,
  planEventTopology,
  uniquePositions,
} from '~/lib/event-occurrence-preparation';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import type { WorkspaceSource } from '~/lib/weekly-workspace-source';
import {
  candidateChoiceLabel,
  type EventPreparationContext,
} from './event-facts';
import { candidateSetMessage } from './event-messages';
import {
  eventName,
  eventTraceFacts,
  eventTreeBlocks,
} from './event-tree-facts';
import type {
  ActivityCandidateSet,
  EventBlock,
  EventTraceFacts,
} from './types';

// Each Activity choice's event candidates as the Event phase reads them:
// labels, resolved names, statuses and open items come from the same tree,
// status and wording Event uses, so both phases describe a candidate the
// same way. Only the candidate sets are read, never Event's inputs, panels
// or options, so Activity does not build the whole Event phase each update.

function nestedCount(block: EventBlock<EventTraceFacts>): number {
  return [...block.children, ...block.hidden].reduce(
    (count, child) => count + 1 + nestedCount(child),
    0,
  );
}

export function activityCandidateSets(
  draft: WeeklyDraft,
  source: WorkspaceSource,
  preview: CanonicalResolutionPreview,
  context: EventPreparationContext = {
    acceptedEventIds: null,
    preparationFailed: false,
  },
): ActivityCandidateSet[] {
  const projection = preview.phases?.event;
  const positions = uniquePositions(projection?.positions ?? []);
  const tree = eventTreeBlocks({
    draft,
    projection,
    plan: planEventTopology(draft, positions),
    accepted: context.acceptedEventIds,
    facts: ({ event }) => eventTraceFacts(projection, event),
    // Per-candidate open items stay in Event; the set's own are below.
    issues: () => [],
  });
  const repair = {
    surplus: (eventId: string) =>
      isSurplusEventOccurrence(draft, positions, eventId),
    removal: () => null,
  };
  const codes = [
    ...(projection?.requirements ?? []),
    ...(projection?.warnings ?? []),
  ];
  return draft.activity.slots.flatMap(({ choice }) => {
    if (!isCandidateChoice(choice)) return [];
    const own = [
      ...new Set(
        codes.filter(
          (code) =>
            code === `${choice.choiceId}:candidates:2` ||
            code === `${choice.choiceId}:selected-event`,
        ),
      ),
    ];
    return [
      {
        choiceId: choice.choiceId,
        active: tree.activeCandidateSets.has(choice.choiceId),
        candidates: tree.roots
          .filter((entry) => entry.owner?.choice.choiceId === choice.choiceId)
          .map((entry) => {
            const block = tree.block(entry, repair);
            return {
              eventId: block.eventId,
              label: block.label,
              name: eventName(block.item.resolvedType),
              status: block.statusLabel,
              chosen: block.candidate?.chosen ?? false,
              nested: nestedCount(block),
            };
          }),
        issues: own.flatMap((code) => {
          const message = candidateSetMessage(code, {
            positions,
            candidateLabel: (choiceId) =>
              candidateChoiceLabel(draft, source, choiceId),
            preparationFailed: context.preparationFailed,
          });
          return message ? [{ code, message }] : [];
        }),
      },
    ];
  });
}
