import { expect, test } from 'vitest';
import { projectWeeklyDraft } from '~/lib/canonical-weekly-resolution';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import type { UpkeepSnapshot } from '~/lib/rules-upkeep';
import { eventActionFixture } from '../../../tests/rules/event-action-fixture';
import { occurrence } from '../../../tests/rules/event-selection-fixture';
import { activityCandidateSets } from './activity-candidate-facts';
import { eventView, type EventPreparationContext } from './event-facts';
import { eventName } from './event-tree-facts';
import type { EventBlock } from './types';

// Activity's candidate summary reads only the candidate sets, without
// building the whole Event phase, and says exactly what Event says.

function nestedCount(block: EventBlock): number {
  return [...block.children, ...block.hidden].reduce(
    (count, child) => count + 1 + nestedCount(child),
    0,
  );
}
// The summary as it was read from Event's complete facts.
function fromEventFacts(
  draft: WeeklyDraft,
  snapshot: UpkeepSnapshot,
  context?: EventPreparationContext,
) {
  const { source, preview } = inputs(draft, snapshot);
  return eventView(draft, source, preview, context).candidates.map((set) => ({
    choiceId: set.choiceId,
    active: set.active,
    candidates: set.blocks.map((block) => ({
      eventId: block.eventId,
      label: block.label,
      name: eventName(block.item.resolvedType),
      status: block.statusLabel,
      chosen: block.candidate?.chosen ?? false,
      nested: nestedCount(block),
    })),
    issues: set.issues,
  }));
}
function inputs(draft: WeeklyDraft, snapshot: UpkeepSnapshot) {
  const source = workspaceSourceSchema.parse({
    key: { campaignId: 'c', militiaId: 'm', draftId: draft.draftId },
    week: draft.week,
    sourceRevision: 0,
    snapshot,
    people: [],
  });
  return {
    source,
    preview: projectWeeklyDraft({ revision: draft, militiaSnapshot: snapshot }),
  };
}
function summary(
  draft: WeeklyDraft,
  snapshot: UpkeepSnapshot,
  context?: EventPreparationContext,
) {
  const { source, preview } = inputs(draft, snapshot);
  return activityCandidateSets(draft, source, preview, context);
}
function expectSameAsEvent(
  draft: WeeklyDraft,
  snapshot: UpkeepSnapshot,
  context?: EventPreparationContext,
) {
  const expected = fromEventFacts(draft, snapshot, context);
  expect(expected.length).toBeGreaterThan(0);
  expect(summary(draft, snapshot, context)).toEqual(expected);
  return expected;
}

test('[ACT-10.candidate-summary] a chosen pair reads as Event reads it', () => {
  const { draft, snapshot } = eventActionFixture();
  const [set] = expectSameAsEvent(draft, snapshot);
  expect(set!.candidates.map((entry) => entry.chosen)).toEqual([true, false]);
});

test('[ACT-10.candidate-summary-open] an unchosen pair, a missing roll and a surplus entry carry Event’s issues', () => {
  const { draft, snapshot, choice } = eventActionFixture('manipulate_events');
  if (choice.actionId !== 'manipulate_events') throw new Error('fixture');
  delete choice.selectedEventId;
  choice.candidates = [
    occurrence('raid', 78),
    { eventId: 'pending', origin: { kind: 'rolled' } },
    occurrence('extra', 70),
  ];
  const [set] = expectSameAsEvent(draft, snapshot);
  expect(set!.issues.length).toBeGreaterThan(0);
});

test('[ACT-10.candidate-summary-nested] a replacement for a candidate that cannot occur counts as a nested event', () => {
  const { draft, snapshot, choice } = eventActionFixture();
  if (choice.actionId !== 'guarantee_event') throw new Error('fixture');
  // Rivalry needs two teams; the militia has one.
  choice.candidates = [
    occurrence('raid', 50),
    occurrence('rivalry', 66),
    occurrence('rivalry/replacement', 74, {
      kind: 'replacement',
      parentEventId: 'rivalry',
    }),
  ];
  const [set] = expectSameAsEvent(draft, snapshot);
  expect(set!.candidates.map((entry) => entry.nested)).toEqual([0, 1]);
});

test('[ACT-10.candidate-summary-preparing] positions still being saved or failing to prepare read as Event reads them', () => {
  const { draft, snapshot, choice } = eventActionFixture();
  if (choice.actionId !== 'guarantee_event') throw new Error('fixture');
  delete choice.selectedEventId;
  choice.candidates = [occurrence('raid', 78)];
  for (const preparationFailed of [false, true])
    expectSameAsEvent(draft, snapshot, {
      acceptedEventIds: new Set(['raid']),
      preparationFailed,
    });
});

test('[ACT-10.candidate-summary-calm] a set a calm week does not use stays listed, inactive', () => {
  const { draft, snapshot } = eventActionFixture();
  draft.context = {
    ...draft.context,
    queuedEffects: [
      {
        effectId: 'calm',
        sourceId: 'calm',
        startsWeek: draft.week,
        endsWeek: draft.week,
        effect: { kind: 'all_is_calm' },
      },
    ],
  };
  const [set] = expectSameAsEvent(draft, snapshot);
  expect(set!.active).toBe(false);
});
