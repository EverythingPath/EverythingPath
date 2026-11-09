import { assert, expect, test } from 'vitest';
import { projectWeeklyDraft } from '~/lib/canonical-weekly-resolution';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import type { UpkeepSnapshot } from '~/lib/rules-upkeep';
import { editWeeklyDraft } from '~/lib/weekly-draft';
import { persistentEventFixture } from '../../../tests/rules/persistent-event-fixture';
import { recurringEventFixture } from '../../../tests/rules/recurring-event-fixture';
import { settlementFixture } from '../../../tests/rules/settlement-fixture';
import { roll } from '../../../tests/rules/upkeep-fixture';
import { persistentView } from './persistent-facts';
import { derivePhaseReadiness } from './phase-readiness';
import {
  decisionEdit,
  earlierPhasesKey,
  endingEdit,
  ordinal,
} from './persistent-sections';

type Carried = WeeklyDraft['context']['carriedEvents'][number];

function facts(draft: WeeklyDraft, snapshot: UpkeepSnapshot) {
  const source = workspaceSourceSchema.parse({
    key: { campaignId: 'campaign', militiaId: 'militia', draftId: 'draft' },
    week: draft.week,
    sourceRevision: 0,
    snapshot,
    people: [],
  });
  const preview = projectWeeklyDraft({
    revision: draft,
    militiaSnapshot: snapshot,
  });
  return {
    source,
    preview,
    view: persistentView(draft, source, preview),
  };
}

function theft(extra: Partial<Carried> = {}): Carried {
  return {
    eventId: 'carried',
    eventType: 'theft',
    startedWeek: 1,
    order: 0,
    targets: [],
    ...extra,
  };
}

// Records every rank boon Upkeep asks for, so its rank change is settled.
function acknowledgeBoons(draft: WeeklyDraft, snapshot: UpkeepSnapshot) {
  for (const key of facts(draft, snapshot).preview.phases!.upkeep
    .requirements) {
    const subject = /^(upkeep:boon:.+):acknowledgement$/.exec(key)?.[1];
    if (subject)
      draft.acknowledgements.push({
        acknowledgementId: subject,
        subjectId: subject,
        outcome: 'Recorded',
      });
  }
}

function withCarried(events: Carried[]) {
  const fixture = persistentEventFixture('theft');
  fixture.snapshot.treasuryCopper = 100000;
  fixture.draft.context = { ...fixture.draft.context, carriedEvents: events };
  acknowledgeBoons(fixture.draft, fixture.snapshot);
  return fixture;
}

test('[PER-01.order] sections keep started week, recorded order, then id, and keep same-type instances distinct', () => {
  const { draft, snapshot } = withCarried([
    theft({ eventId: 'late', startedWeek: 2, order: 0 }),
    theft({ eventId: 'b', order: 1 }),
    theft({ eventId: 'z', order: 0 }),
    theft({ eventId: 'a', order: 1 }),
  ]);
  draft.week = 5;
  const { view } = facts(draft, snapshot);
  expect(
    view.events.map((event) => [
      event.eventId,
      event.name,
      event.ageWeeks,
      event.orderLabel,
    ]),
  ).toEqual([
    ['z', 'Theft · Event 1', 4, '1st that week'],
    ['a', 'Theft · Event 2', 4, '2nd that week'],
    ['b', 'Theft · Event 3', 4, '2nd that week'],
    ['late', 'Theft · Event 4', 3, '1st that week'],
  ]);
  // A decision's position in storage never reorders the sections.
  draft.persistent.decisions = [
    { kind: 'unattempted', eventId: 'late' },
    { kind: 'unattempted', eventId: 'z' },
  ];
  expect(facts(draft, snapshot).view.events.map((e) => e.eventId)).toEqual([
    'z',
    'a',
    'b',
    'late',
  ]);
});

test.each([
  [1, '1st'],
  [2, '2nd'],
  [3, '3rd'],
  [4, '4th'],
  [11, '11th'],
  [12, '12th'],
  [13, '13th'],
  [21, '21st'],
  [22, '22nd'],
  [111, '111th'],
])('[PER-02.order] ordinal %i reads %s', (value, expected) => {
  expect(ordinal(value)).toBe(expected);
});

test('[PER-01.overview] the first buyoff is available now at the rules cost and a staged buyoff moves the next buyoff week', () => {
  const { draft, snapshot } = withCarried([
    theft(),
    theft({ eventId: 'second', order: 1 }),
  ]);
  const initial = facts(draft, snapshot);
  let view = initial.view;
  const rank = initial.preview.phases!.upkeep.outcome.rank;
  expect(view).toMatchObject({
    firstBuyoff: true,
    buyoffAvailability: 'First buyoff available now',
    nextBuyoffWeek: 2,
    buyoffCostCopper: 2 * rank * 10 * 100,
    earlierPhases: [],
  });
  draft.persistent.decisions = [{ kind: 'buyoff', eventId: 'carried' }];
  ({ view } = facts(draft, snapshot));
  expect(view.nextBuyoffWeek).toBe(6);
  expect(view.events[0]).toMatchObject({
    ended: true,
    result: { tone: 'ends', text: `Ends · buyoff ${rank * 20} gp` },
  });
  expect(view.events[1]!.result).toEqual({
    tone: 'stays',
    text: 'Stays · half of incoming gains lost',
  });
});

test('[PER-01.cooldown] a later buyoff inside the four-week wait needs its exception before it ends anything', () => {
  const { draft, snapshot } = withCarried([theft()]);
  draft.week = 6;
  draft.context = { ...draft.context, lastBuyoffWeek: 4 };
  draft.persistent.decisions = [{ kind: 'buyoff', eventId: 'carried' }];
  let { view } = facts(draft, snapshot);
  expect(view.buyoffAvailability).toBe('Buyoff waits until week 8');
  expect(view.nextBuyoffWeek).toBe(8);
  expect(view.events[0]).toMatchObject({
    ended: false,
    result: { tone: 'attention', text: 'Buyoff needs a Rules Exception' },
    exceptions: [
      {
        exceptionId: 'persistent:carried:buyoff-cooldown',
        subjectId: 'carried',
        ruleId: 'buyoff-cooldown',
        reason: '',
      },
    ],
  });
  draft.rulesExceptions = [
    {
      exceptionId: 'persistent:carried:buyoff-cooldown',
      subjectId: 'carried',
      ruleId: 'buyoff-cooldown',
      reason: 'The table allows it',
    },
  ];
  ({ view } = facts(draft, snapshot));
  expect(view.events[0]).toMatchObject({ ended: true });
  expect(view.nextBuyoffWeek).toBe(10);
});

test('[PER-01.treasury] an unaffordable buyoff needs the treasury exception', () => {
  const { draft, snapshot } = withCarried([theft()]);
  snapshot.treasuryCopper = 0;
  draft.persistent.decisions = [{ kind: 'buyoff', eventId: 'carried' }];
  const { view } = facts(draft, snapshot);
  expect(view.events[0]).toMatchObject({
    ended: false,
    result: { text: 'Buyoff needs a Rules Exception' },
  });
  expect(view.events[0]!.exceptions.map((entry) => entry.ruleId)).toContain(
    'treasury',
  );
});

test('[PER-01.pending] an incomplete Upkeep leaves the cost pending and collapses into one earlier-phases item', () => {
  const { draft, snapshot } = withCarried([theft()]);
  draft.upkeep.rolls = {};
  const { view, source, preview } = facts(draft, snapshot);
  expect(view).toMatchObject({
    ready: false,
    buyoffCostCopper: null,
    earlierPhases: ['upkeep'],
    requirements: [earlierPhasesKey(['upkeep'])],
  });
  const persistent = derivePhaseReadiness(draft, source, preview).phases.find(
    (item) => item.phase === 'persistent',
  )!;
  expect(persistent.requirements).toEqual([
    {
      id: 'persistent:earlier-phases:upkeep',
      message: 'Earlier phases still need preparation: Upkeep.',
    },
  ]);
  draft.persistent.decisions = [{ kind: 'buyoff', eventId: 'carried' }];
  expect(facts(draft, snapshot).view.events[0]!.result.text).toBe(
    'Ends · buyoff cost waits for earlier phases',
  );
});

test("[PER-01.rank] the cost waits for Upkeep's rank change and then uses the new rank, not the starting one", () => {
  const { draft, snapshot } = persistentEventFixture('theft');
  snapshot.treasuryCopper = 100000;
  draft.context = { ...draft.context, carriedEvents: [theft()] };
  expect(facts(draft, snapshot).view.buyoffCostCopper).toBeNull();
  acknowledgeBoons(draft, snapshot);
  const { preview, view } = facts(draft, snapshot);
  const rank = preview.phases!.upkeep.outcome.rank;
  expect(rank).toBeGreaterThan(snapshot.rank);
  expect(view.buyoffCostCopper).toBe(rank * 10 * 2 * 100);
});

test('[PER-06.ending] a table ending needs its outcome and reason before it ends the event', () => {
  const { draft, snapshot } = withCarried([theft()]);
  draft.persistent.decisions = [
    {
      kind: 'end',
      eventId: 'carried',
      acknowledgement: {
        acknowledgementId: 'ack',
        subjectId: 'carried',
        outcome: 'The thieves fled',
      },
    },
  ];
  let { view } = facts(draft, snapshot);
  expect(view.events[0]).toMatchObject({
    ended: false,
    result: { tone: 'attention', text: 'Ending needs a Rules Exception' },
    exceptions: [{ ruleId: 'persistent-ending', reason: '' }],
  });
  draft.rulesExceptions = [
    {
      exceptionId: 'persistent:carried:persistent-ending',
      subjectId: 'carried',
      ruleId: 'persistent-ending',
      reason: 'The GM ruled it',
    },
  ];
  ({ view } = facts(draft, snapshot));
  expect(view.events[0]).toMatchObject({
    ended: true,
    result: { tone: 'ends', text: 'Ends · recorded at the table' },
  });
});

test('[PER-02.source] a successful Reduce Danger ends Theft from its Activity slot and undoing it restores the saved decision', () => {
  const { draft, snapshot } = settlementFixture('reduce_danger');
  draft.context = {
    ...draft.context,
    persistentPhaseEligible: true,
    carriedEvents: [theft({ startedWeek: 39 })],
  };
  draft.persistent.decisions = [{ kind: 'buyoff', eventId: 'carried' }];
  const slot = draft.activity.slots[0]!;
  let { view } = facts(draft, snapshot);
  expect(view.events[0]).toMatchObject({
    ended: true,
    endedBy: {
      label: 'Reduce Danger in Activity slot 1',
      link: { phase: 'activity', anchor: `activity-slot-${slot.slotId}` },
    },
    result: { tone: 'ends', text: 'Ends · Reduce Danger in Activity slot 1' },
    // The redundant saved decision is kept, not deleted.
    decision: { kind: 'buyoff', eventId: 'carried' },
    changes: [],
  });
  // A failed check is not an ending: the saved buyoff applies again.
  const choice = slot.choice!;
  assert('rolls' in choice);
  choice.rolls = { check: roll(20, 1) };
  ({ view } = facts(draft, snapshot));
  expect(view.events[0]).toMatchObject({
    endedBy: null,
    decision: { kind: 'buyoff' },
    result: { tone: 'ends' },
  });
  expect(view.events[0]!.result.text).toMatch(/^Ends · buyoff /);
  // Removing the source altogether also restores it.
  slot.choice = null;
  expect(facts(draft, snapshot).view.events[0]!.endedBy).toBeNull();
});

test('[PER-02.source] High Morale names its Event occurrence and links to it', () => {
  const { draft, snapshot } = recurringEventFixture(26);
  draft.context = {
    ...draft.context,
    persistentPhaseEligible: true,
    carriedEvents: [
      theft({ eventId: 'later', startedWeek: 39, order: 1 }),
      { ...theft({ eventId: 'older', startedWeek: 38 }), eventType: 'rivalry' },
    ],
  };
  const { view } = facts(draft, snapshot);
  const occurrence = draft.event.occurrences[0]!;
  expect(view.events.map((event) => event.endedBy)).toEqual([
    {
      label: 'High Morale in Event 1',
      link: {
        phase: 'event',
        anchor: `event-occurrence-${occurrence.eventId}`,
      },
    },
    null,
  ]);
});

test('[PER-02.source] an ending from a nested event uses the Event phase label, not its recorded position', () => {
  const { draft, snapshot } = recurringEventFixture(26, true);
  draft.context = {
    ...draft.context,
    persistentPhaseEligible: true,
    carriedEvents: [
      { ...theft({ eventId: 'older', startedWeek: 38 }), eventType: 'rivalry' },
    ],
  };
  const { view } = facts(draft, snapshot);
  // Recorded second, but labelled as Roll Twice's first child.
  expect(draft.event.occurrences.map((entry) => entry.eventId)).toEqual([
    'root',
    'first',
    'second',
  ]);
  expect(view.events[0]!.endedBy).toEqual({
    label: 'High Morale in Event 1.1',
    link: { phase: 'event', anchor: 'event-occurrence-first' },
  });
});

test('[PER-03.cards] only Theft and Rivalry offer a check card', () => {
  const { draft, snapshot } = withCarried([
    theft(),
    { ...theft({ eventId: 'morale', order: 1 }), eventType: 'low_morale' },
    { ...theft({ eventId: 'agent', order: 2 }), eventType: 'double_agent' },
  ]);
  const { view } = facts(draft, snapshot);
  expect(view.events.map((event) => event.check?.label ?? null)).toEqual([
    'Loyalty check (this week only)',
    null,
    null,
  ]);
  expect(view.events[1]!.leaveNote).toBe('Loyalty checks suffer −2.');
});

test('[PER-03.edits] cards send amount-free replacements and leave a saved decision untouched when tapped again', () => {
  const buyoff = { kind: 'buyoff' as const, eventId: 'e' };
  expect(decisionEdit({ eventId: 'e', decision: buyoff }, 'buyoff')).toBeNull();
  expect(decisionEdit({ eventId: 'e', decision: null }, 'buyoff')).toEqual({
    kind: 'persistent_decision',
    decision: { kind: 'buyoff', eventId: 'e' },
  });
  expect(
    decisionEdit({ eventId: 'e', decision: null }, 'unattempted'),
  ).toBeNull();
  expect(
    decisionEdit({ eventId: 'e', decision: buyoff }, 'unattempted'),
  ).toEqual({
    kind: 'persistent_decision',
    decision: { kind: 'unattempted', eventId: 'e' },
  });
  const mitigate = {
    kind: 'mitigate' as const,
    eventId: 'e',
    overseerCharacterId: 'pc',
  };
  expect(
    decisionEdit({ eventId: 'e', decision: mitigate }, 'mitigate'),
  ).toBeNull();
  expect(decisionEdit({ eventId: 'e', decision: buyoff }, 'end')).toBeNull();
});

test('[PER-06.identity] an ending edit keeps its acknowledgement identity and binds it to the event', () => {
  const saved = {
    kind: 'end' as const,
    eventId: 'e',
    acknowledgement: {
      acknowledgementId: 'kept',
      subjectId: 'stale',
      outcome: 'Old',
    },
  };
  expect(endingEdit({ eventId: 'e', decision: saved }, '  New  ')).toEqual({
    kind: 'persistent_decision',
    decision: {
      kind: 'end',
      eventId: 'e',
      acknowledgement: {
        acknowledgementId: 'kept',
        subjectId: 'e',
        outcome: 'New',
      },
    },
  });
  expect(
    endingEdit({ eventId: 'e', decision: null }, 'Done', () => 'fresh'),
  ).toMatchObject({
    decision: { acknowledgement: { acknowledgementId: 'fresh' } },
  });
});

test('[PER-09.leave] Leave it replaces only this event’s decision and keeps every Rules Exception', () => {
  const { draft, snapshot } = withCarried([
    theft(),
    theft({ eventId: 'second', order: 1 }),
  ]);
  draft.persistent.decisions = [
    {
      kind: 'end',
      eventId: 'carried',
      acknowledgement: {
        acknowledgementId: 'ack',
        subjectId: 'carried',
        outcome: 'Settled',
      },
    },
    { kind: 'buyoff', eventId: 'second' },
  ];
  draft.rulesExceptions = [
    {
      exceptionId: 'persistent:carried:persistent-ending',
      subjectId: 'carried',
      ruleId: 'persistent-ending',
      reason: 'The GM ruled it',
    },
  ];
  const { view } = facts(draft, snapshot);
  const leave = decisionEdit(view.events[0]!, 'unattempted');
  assert(leave);
  const next = editWeeklyDraft(draft, leave);
  assert(next.ok);
  expect(next.draft.persistent.decisions).toEqual([
    { kind: 'buyoff', eventId: 'second' },
    { kind: 'unattempted', eventId: 'carried' },
  ]);
  expect(next.draft.rulesExceptions).toEqual(draft.rulesExceptions);
  const after = facts(next.draft, snapshot).view.events[0]!;
  expect(after).toMatchObject({
    ended: false,
    result: { tone: 'stays' },
    // The kept exception stays listed so it can be removed deliberately.
    exceptions: [{ ruleId: 'persistent-ending', reason: 'The GM ruled it' }],
  });
});
