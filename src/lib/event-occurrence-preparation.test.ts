import { expect, test } from 'vitest';
import { projectActivityAndEventShaping } from './rules-event-shaping';
import { projectWeeklyDraft } from './canonical-weekly-resolution';
import { editWeeklyDraft } from './weekly-draft';
import {
  eventOccurrenceIdentity,
  planEventTopology,
  removableEventOccurrence,
} from './event-occurrence-preparation';
import type { EventPositionGroup } from './rules-event-selection';
import type { WeeklyDraft } from './weekly-draft-contract';
import {
  eventSelectionFixture,
  occurrence,
} from '../../tests/rules/event-selection-fixture';
import { eventActionFixture } from '../../tests/rules/event-action-fixture';
import { roll } from '../../tests/rules/upkeep-fixture';

type Fixture = ReturnType<typeof eventSelectionFixture>;
function positions({ draft, snapshot }: Fixture) {
  return projectActivityAndEventShaping(draft, snapshot).event.positions;
}
// The complete preview includes replacements discovered while outcomes fold.
function previewPositions({ draft, snapshot }: Fixture) {
  return projectWeeklyDraft({ revision: draft, militiaSnapshot: snapshot })
    .phases!.event.positions;
}
function apply(draft: WeeklyDraft, groups: EventPositionGroup[]) {
  let next = draft;
  for (const edit of planEventTopology(next, groups).edits) {
    const result = editWeeklyDraft(next, edit);
    if (!result.ok) throw new Error(result.error);
    next = result.draft;
  }
  return next;
}
const origins = (draft: WeeklyDraft) =>
  draft.event.occurrences.map((event) => [event.eventId, event.origin]);

test('[EVT-03.positions] the engine traces the rolled root only when the chance roll triggers', () => {
  const fixture = eventSelectionFixture();
  fixture.snapshot.notoriety = 20;
  for (const [value, expected] of [
    [19, [{ kind: 'rolled', count: 1, eventIds: [] }]],
    [20, []],
    [21, []],
  ] as const) {
    fixture.draft.event.chanceRoll = roll(100, value);
    expect(positions(fixture)).toEqual(expected);
  }
  delete fixture.draft.event.chanceRoll;
  expect(positions(fixture)).toEqual([]);
});

test('[EVT-03.fill] a triggered chance prepares one blank root with a draft-scoped identity, then nothing', () => {
  const fixture = eventSelectionFixture();
  fixture.draft.draftId = 'week-7';
  const plan = planEventTopology(fixture.draft, positions(fixture));
  expect(plan.added).toEqual(['week-7:rolled:1']);
  expect(plan.edits).toEqual([
    {
      kind: 'event_tree',
      occurrences: [{ eventId: 'week-7:rolled:1', origin: { kind: 'rolled' } }],
    },
  ]);
  fixture.draft = apply(fixture.draft, positions(fixture));
  expect(planEventTopology(fixture.draft, positions(fixture)).edits).toEqual(
    [],
  );
  // Recomputing on another device or after a remount derives the same identity.
  expect(eventOccurrenceIdentity('week-7', { kind: 'rolled' }, 1)).toBe(
    'week-7:rolled:1',
  );
});

test('[EVT-13.expansion] the first normal Roll Twice prepares exactly two blank children after its parent', () => {
  const fixture = eventSelectionFixture();
  fixture.draft.draftId = 'd';
  fixture.draft.event.occurrences = [
    occurrence('root', 50),
    occurrence('later', 10, { kind: 'automatic', sourceId: 'unrelated' }),
  ];
  const plan = planEventTopology(fixture.draft, positions(fixture));
  expect(plan.added).toEqual(['root/twice/1', 'root/twice/2']);
  fixture.draft = apply(fixture.draft, positions(fixture));
  expect(origins(fixture.draft)).toEqual([
    ['root', { kind: 'rolled' }],
    ['root/twice/1', { kind: 'roll_twice', parentEventId: 'root' }],
    ['root/twice/2', { kind: 'roll_twice', parentEventId: 'root' }],
    ['later', { kind: 'automatic', sourceId: 'unrelated' }],
  ]);
  // The recorded root keeps every fact; only positions were added.
  expect(fixture.draft.event.occurrences[0]).toEqual(occurrence('root', 50));
});

test('[EVT-13.reroll] a later Roll Twice is rerolled in its own field and never prepares a replacement', () => {
  const fixture = eventSelectionFixture();
  fixture.draft.event.occurrences = [
    occurrence('root', 50),
    occurrence('first', 50, { kind: 'roll_twice', parentEventId: 'root' }),
    occurrence('second', 10, { kind: 'roll_twice', parentEventId: 'root' }),
  ];
  const groups = positions(fixture);
  expect(groups).toContainEqual({
    kind: 'replacement',
    parentEventId: 'first',
    count: 1,
    eventIds: [],
    reroll: true,
  });
  expect(planEventTopology(fixture.draft, groups).edits).toEqual([]);
  expect(
    projectActivityAndEventShaping(fixture.draft, fixture.snapshot).event
      .requirements,
  ).toContain('first:replacement:1');
});

test('[EVT-13.automatic] automatic sources prepare their count and an automatic Roll Twice rerolls without spending the expansion', () => {
  const fixture = eventSelectionFixture();
  fixture.draft.draftId = 'd';
  fixture.draft.context = {
    ...fixture.draft.context,
    queuedEffects: [
      {
        effectId: 'storm-effect',
        sourceId: 'storm',
        startsWeek: fixture.draft.week,
        endsWeek: fixture.draft.week,
        effect: { kind: 'automatic_events', count: 2 },
      },
    ],
  };
  fixture.draft = apply(fixture.draft, positions(fixture));
  expect(origins(fixture.draft)).toEqual([
    ['d:automatic:storm:1', { kind: 'automatic', sourceId: 'storm' }],
    ['d:automatic:storm:2', { kind: 'automatic', sourceId: 'storm' }],
    ['d:rolled:1', { kind: 'rolled' }],
  ]);
  fixture.draft.event.occurrences[0]!.tableRoll = roll(100, 50);
  fixture.draft.event.occurrences[2]!.tableRoll = roll(100, 50);
  const groups = positions(fixture);
  expect(groups).toContainEqual(
    expect.objectContaining({
      parentEventId: 'd:automatic:storm:1',
      reroll: true,
    }),
  );
  expect(planEventTopology(fixture.draft, groups).added).toEqual([
    'd:rolled:1/twice/1',
    'd:rolled:1/twice/2',
  ]);
});

test('[EVT-06.candidates] each guaranteeing choice prepares its two candidate roots in its own complete choice', () => {
  const fixture = eventActionFixture();
  const slot = fixture.draft.activity.slots.find(
    (entry) => entry.choice?.choiceId === 'shape',
  )!;
  if (slot.choice?.actionId !== 'guarantee_event') throw new Error('fixture');
  slot.choice.candidates = [
    { eventId: 'kept', origin: { kind: 'rolled' }, tableRoll: roll(100, 74) },
  ];
  delete slot.choice.selectedEventId;
  fixture.draft.draftId = 'd';
  const plan = planEventTopology(fixture.draft, positions(fixture));
  expect(plan.added).toEqual(['d:candidate:shape:2']);
  expect(plan.edits).toEqual([
    {
      kind: 'detail',
      slotId: slot.slotId,
      choiceId: 'shape',
      choice: {
        ...slot.choice,
        candidates: [
          slot.choice.candidates[0],
          { eventId: 'd:candidate:shape:2', origin: { kind: 'rolled' } },
        ],
      },
    },
  ]);
});

test('[EVT-13.candidate-reroll] a candidate Roll Twice, chosen or not, prepares nothing: it is rerolled in its own die', () => {
  const fixture = eventActionFixture();
  const choice = fixture.draft.activity.slots.find(
    (entry) => entry.choice?.choiceId === 'shape',
  )!.choice!;
  if (choice.actionId !== 'guarantee_event') throw new Error('fixture');
  choice.candidates = [
    { eventId: 'raid', origin: { kind: 'rolled' }, tableRoll: roll(100, 50) },
    { eventId: 'theft', origin: { kind: 'rolled' }, tableRoll: roll(100, 51) },
  ];
  for (const selectedEventId of ['raid', 'theft']) {
    choice.selectedEventId = selectedEventId;
    const traced = positions(fixture);
    expect(traced.filter((group) => group.kind === 'roll_twice')).toEqual([]);
    expect(planEventTopology(fixture.draft, traced)).toMatchObject({
      edits: [],
      added: [],
    });
  }
});

test('[EVT-13.ineligible] an event that cannot occur prepares one replacement unless a Rules Exception keeps it', () => {
  const fixture = eventSelectionFixture();
  fixture.snapshot.settlements = fixture.snapshot.settlements.map((town) => ({
    ...town,
    refugeActivatedWeek: null,
    refugeActiveUntilWeek: null,
  }));
  fixture.draft.event.occurrences = [occurrence('root', 78)];
  expect(planEventTopology(fixture.draft, positions(fixture)).added).toEqual([
    'root/replacement/1',
  ]);
  fixture.draft.rulesExceptions = [
    {
      exceptionId: 'keep',
      subjectId: 'root',
      ruleId: 'event-eligibility',
      reason: 'The table keeps the raid.',
    },
  ];
  expect(planEventTopology(fixture.draft, positions(fixture)).edits).toEqual(
    [],
  );
});

test('[EVT-13.preview] the complete preview carries the same position trace the store prepares from', () => {
  const fixture = eventSelectionFixture();
  fixture.draft.event.occurrences = [
    occurrence('root', 50),
    occurrence('first', 50, { kind: 'roll_twice', parentEventId: 'root' }),
  ];
  expect(previewPositions(fixture)).toEqual(positions(fixture));
  expect(
    planEventTopology(fixture.draft, previewPositions(fixture)).added,
  ).toEqual(['root/twice/2']);
});

test('[EVT-03.retained] inactive children and roots stay untouched; returning to Roll Twice needs no new positions', () => {
  const fixture = eventSelectionFixture();
  fixture.draft.event.occurrences = [
    occurrence('root', 10),
    occurrence('first', 45, { kind: 'roll_twice', parentEventId: 'root' }),
    occurrence('second', 82, { kind: 'roll_twice', parentEventId: 'root' }),
  ];
  expect(planEventTopology(fixture.draft, positions(fixture)).edits).toEqual(
    [],
  );
  fixture.draft.event.occurrences[0]!.tableRoll = roll(100, 51);
  expect(positions(fixture)).toContainEqual({
    kind: 'roll_twice',
    parentEventId: 'root',
    count: 2,
    eventIds: ['first', 'second'],
    reroll: false,
  });
  expect(planEventTopology(fixture.draft, positions(fixture)).edits).toEqual(
    [],
  );
  // A quiet chance roll leaves the whole recorded tree in place.
  fixture.draft.event.chanceRoll = roll(100, 100);
  expect(positions(fixture)).toEqual([]);
});

test('[EVT-13.legacy] surplus legacy positions are reported, never trimmed or topped up', () => {
  const fixture = eventSelectionFixture();
  fixture.draft.event.occurrences = [
    occurrence('one', 10),
    { eventId: 'two', origin: { kind: 'rolled' } },
  ];
  const plan = planEventTopology(fixture.draft, positions(fixture));
  expect(plan.edits).toEqual([]);
  expect(plan.surplus).toEqual([
    { kind: 'rolled', count: 1, eventIds: ['one', 'two'] },
  ]);
});

test('[EVT-03.collision] a derived identity already used anywhere in the draft gets a deterministic suffix', () => {
  const fixture = eventSelectionFixture();
  fixture.draft.draftId = 'd';
  fixture.draft.context = {
    ...fixture.draft.context,
    carriedEvents: [
      {
        ...fixture.draft.context.carriedEvents[0],
        eventId: 'd:rolled:1',
        eventType: 'theft',
        startedWeek: 1,
        order: 1,
        targets: [],
      } as WeeklyDraft['context']['carriedEvents'][number],
    ],
  };
  expect(planEventTopology(fixture.draft, positions(fixture)).added).toEqual([
    'd:rolled:1~2',
  ]);
});

test('[EVT-03.remove] only an empty surplus occurrence without descendants or references is removable by clearing', () => {
  const fixture = eventSelectionFixture();
  fixture.draft.event.occurrences = [
    occurrence('one', 10),
    { eventId: 'two', origin: { kind: 'rolled' } },
  ];
  const groups = positions(fixture);
  expect(removableEventOccurrence(fixture.draft, groups, 'two')).toEqual({
    kind: 'event_tree',
    occurrences: [occurrence('one', 10)],
  });
  expect(removableEventOccurrence(fixture.draft, groups, 'one')).toBeNull();
  fixture.draft.acknowledgements = [
    { acknowledgementId: 'a', subjectId: 'event:two', outcome: 'Noted.' },
  ];
  expect(removableEventOccurrence(fixture.draft, groups, 'two')).toBeNull();
  // A required position keeps its blank placeholder.
  fixture.draft.event.occurrences = [
    { eventId: 'only', origin: { kind: 'rolled' } },
  ];
  fixture.draft.acknowledgements = [];
  expect(
    removableEventOccurrence(fixture.draft, positions(fixture), 'only'),
  ).toBeNull();
});
