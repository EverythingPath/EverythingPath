import { renderHook } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { projectWeeklyDraft } from '~/lib/canonical-weekly-resolution';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import type { UpkeepSnapshot } from '~/lib/rules-upkeep';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import { resourceEventFixture } from '../../../tests/rules/resource-event-fixture';
import { occurrence } from '../../../tests/rules/event-selection-fixture';
import { eventView } from './event-facts';
import { endingsWithout, pressEnding } from './event-outcome-facts';
import { persistentView } from './persistent-facts';
import { derivePhaseReadiness } from './phase-readiness';
import type { EventPanel, EventView } from './types';
import { useEventEdits } from './use-event-edits';

type Carried = WeeklyDraft['context']['carriedEvents'][number];

function facts(
  draft: WeeklyDraft,
  snapshot: UpkeepSnapshot,
  acceptedEventIds: ReadonlySet<string> | null = null,
) {
  const source = workspaceSourceSchema.parse({
    key: { campaignId: 'c', militiaId: 'm', draftId: draft.draftId },
    week: draft.week,
    sourceRevision: 0,
    snapshot,
    people: [{ characterId: 'pc', name: 'Wren Ashby' }],
  });
  const preview = projectWeeklyDraft({
    revision: draft,
    militiaSnapshot: snapshot,
  });
  const view = eventView(draft, source, preview, {
    acceptedEventIds,
    preparationFailed: false,
  });
  const { phases } = derivePhaseReadiness(draft, source, preview);
  const phase = phases.find((entry) => entry.phase === 'event')!;
  return { view, phase, preview, source };
}
function panel(view: EventView, eventId: string) {
  const found = view.occurrences.find(
    (entry) => entry.occurrence.eventId === eventId,
  )?.panel;
  expect(found?.family).toBe('outcome');
  return found as Extract<EventPanel, { family: 'outcome' }>;
}
const messages = (phase: ReturnType<typeof facts>['phase']) =>
  phase.requirements.map((entry) => entry.message);
function carried(
  eventId: string,
  eventType: Carried['eventType'],
  startedWeek: number,
  order = 0,
): Carried {
  return { eventId, eventType, startedWeek, order, targets: [] };
}
function withCarried(draft: WeeklyDraft, events: Carried[]) {
  draft.context = {
    ...draft.context,
    persistentPhaseEligible: events.length > 0,
    carriedEvents: events,
  };
}

test('[EVT-12.war-games] War Games shows its training gain, and a second one adds its own', () => {
  const { draft, snapshot } = resourceEventFixture(8);
  const rank = snapshot.rank;
  let { view } = facts(draft, snapshot);
  const games = panel(view, 'event');
  expect(games.eventType).toBe('war_games');
  expect(games.outcomes).toEqual([
    `Training +${rank}: ${snapshot.training} → ${snapshot.training + rank}.`,
  ]);
  expect(games.partial).toBe(false);
  // Optional, never a blocker.
  expect(games.whatHappened?.required).toBe(false);
  expect(games.notes).toEqual([]);

  const twice = resourceEventFixture(8, true);
  ({ view } = facts(twice.draft, twice.snapshot));
  const second = panel(view, 'second');
  expect(
    view.occurrences.find((entry) => entry.occurrence.eventId === 'second')
      ?.mode,
  ).toBe('base');
  expect(second.notes).toEqual([
    'Independent of Event 1.1 · War Games: each War Games adds its own training.',
  ]);
  expect(second.outcomes).toEqual([
    `Training +${rank}: ${snapshot.training + rank} → ${snapshot.training + 2 * rank}.`,
  ]);
});

test('[EVT-12.weeks] Week of Pain and Week of Serenity queue next week, and a second one adds nothing', () => {
  const pain = resourceEventFixture(100);
  pain.draft.acknowledgements = [];
  let { view } = facts(pain.draft, pain.snapshot);
  const next = pain.draft.week + 1;
  expect(panel(view, 'event')).toMatchObject({
    eventType: 'week_of_pain',
    whatHappened: null,
    outcomes: [
      `Next week (week ${next}): all organization checks −1.`,
      `Next week (week ${next}): Upkeep training loss is doubled.`,
    ],
  });
  const serenity = resourceEventFixture(2, true);
  ({ view } = facts(serenity.draft, serenity.snapshot));
  expect(panel(view, 'first').outcomes).toEqual([
    `Next week (week ${next}): all organization checks +5.`,
    `Next week (week ${next}): Activity training gain is doubled.`,
  ]);
  const second = view.occurrences.find(
    (entry) => entry.occurrence.eventId === 'second',
  )!;
  expect(second.mode).toBe('no_additional_effect');
  expect(panel(view, 'second')).toMatchObject({
    notes: [
      'No additional effect: Event 1.1 · Week of Serenity already applies this.',
    ],
    outcomes: [],
  });
});

test('[EVT-12.all-is-calm] All Is Calm asks for nothing and says whether the week is uneventful', () => {
  const { draft, snapshot } = resourceEventFixture(46);
  draft.acknowledgements = [];
  const first = facts(draft, snapshot);
  let view = first.view;
  const phase = first.phase;
  const calm = panel(view, 'event');
  expect(calm).toMatchObject({
    eventType: 'all_is_calm',
    whatHappened: null,
    partial: false,
    outcomes: ['No event this week.'],
    notes: [`Uneventful: next week’s event chance rises by ${snapshot.rank}.`],
  });
  expect(phase.requirements).toEqual([]);

  draft.context = { ...draft.context, firstMilitiaWeek: true };
  ({ view } = facts(draft, snapshot));
  expect(panel(view, 'event').notes).toEqual([
    'Not an uneventful week: the militia’s first week never counts.',
  ]);

  // Beside another event the calm has no effect; it never claims a quiet week.
  const mixed = resourceEventFixture(46, true);
  mixed.draft.event.occurrences[2] = occurrence('second', 82, {
    kind: 'roll_twice',
    parentEventId: 'root',
  });
  ({ view } = facts(mixed.draft, mixed.snapshot));
  expect(panel(view, 'first').outcomes).toEqual([
    'No effect: another event happens this week.',
  ]);

  // Twice: next week is calm, and two events never build the carry.
  const twice = resourceEventFixture(46, true);
  ({ view } = facts(twice.draft, twice.snapshot));
  expect(panel(view, 'second')).toMatchObject({
    notes: [
      'Twice with Event 1.1 · All Is Calm: next week is calm too.',
      'Not an uneventful week: more than one event happens this week.',
    ],
    outcomes: [
      `Next week (week ${twice.draft.week + 1}) is calm: no event-chance roll and no rolled event, and it does not count as uneventful.`,
    ],
  });
});

test('[EVT-12.storm] Calm before the Storm names next week’s automatic events and the Twice count', () => {
  const { draft, snapshot } = resourceEventFixture(54);
  const recorded = draft.acknowledgements;
  draft.acknowledgements = [];
  let { view } = facts(draft, snapshot);
  const next = draft.week + 1;
  expect(panel(view, 'event')).toMatchObject({
    eventType: 'calm_before_the_storm',
    whatHappened: null,
    outcomes: [
      `Next week (week ${next}): 1 automatic event before the normal Event roll.`,
    ],
    notes: [
      'Not an uneventful week: an event other than All Is Calm happens this week.',
    ],
  });
  // An account recorded earlier stays editable and clearable, never required.
  draft.acknowledgements = recorded;
  ({ view } = facts(draft, snapshot));
  expect(panel(view, 'event').whatHappened).toMatchObject({
    required: false,
    acknowledgement: { outcome: 'The table records the result.' },
  });
  const twice = resourceEventFixture(54, true);
  ({ view } = facts(twice.draft, twice.snapshot));
  expect(panel(view, 'first').outcomes).toEqual([
    `Next week (week ${next}): 2 automatic events before the normal Event roll.`,
  ]);
  expect(panel(view, 'first').notes[0]).toBe(
    'Includes the Twice from Event 1.2 · Calm before the Storm.',
  );
  expect(panel(view, 'second').notes[0]).toBe(
    'Twice with Event 1.1 · Calm before the Storm: the combined effect is listed under Event 1.1 · Calm before the Storm.',
  );
  expect(panel(view, 'second').outcomes).toEqual([]);
});

test('[EVT-07.invasion] Invasion asks for its party level and What happened, then shows the encounter', () => {
  const { draft, snapshot } = resourceEventFixture(82);
  draft.acknowledgements = [];
  let { view, phase } = facts(draft, snapshot);
  let invasion = panel(view, 'event');
  expect(invasion.partyLevel).toEqual({
    value: null,
    required: true,
    challengeRating: null,
  });
  expect(invasion.whatHappened).toMatchObject({ required: true });
  expect(invasion.partial).toBe(true);
  expect(invasion.outcomes).toEqual([]);
  expect(messages(phase)).toEqual(
    expect.arrayContaining([
      'Event 1 · Invasion: enter the Average Party Level.',
      'Event 1 · Invasion: record what happened.',
    ]),
  );

  // Zero is a level, distinct from clear; the CR follows before the note.
  draft.event.occurrences[0]!.averagePartyLevel = 0;
  ({ view } = facts(draft, snapshot));
  expect(panel(view, 'event').partyLevel).toEqual({
    value: 0,
    required: false,
    challengeRating: 1,
  });

  draft.event.occurrences[0]!.averagePartyLevel = 8;
  draft.acknowledgements = [
    {
      acknowledgementId: 'event:event',
      subjectId: 'event:event',
      outcome: 'The table drove the invaders off.',
    },
  ];
  ({ view, phase } = facts(draft, snapshot));
  invasion = panel(view, 'event');
  expect(invasion.partial).toBe(false);
  expect(invasion.outcomes).toEqual([
    'The GM runs a combat encounter at CR 9 (Average Party Level 8 + 1).',
  ]);
  expect(phase.requirements).toEqual([]);
});

test('[EVT-07.invasion-independent] two Invasions keep their own level, account and encounter', () => {
  const { draft, snapshot } = resourceEventFixture(82, true);
  draft.event.occurrences[1]!.averagePartyLevel = 5;
  draft.event.occurrences[2]!.averagePartyLevel = 9;
  draft.acknowledgements = draft.acknowledgements.filter(
    (entry) => entry.subjectId !== 'event:second',
  );
  const { view, phase } = facts(draft, snapshot);
  expect(panel(view, 'first').outcomes).toEqual([
    'The GM runs a combat encounter at CR 6 (Average Party Level 5 + 1).',
  ]);
  expect(panel(view, 'second')).toMatchObject({
    partyLevel: { value: 9, challengeRating: 10 },
    notes: [
      'Independent of Event 1.1 · Invasion: each Invasion is its own encounter.',
    ],
    outcomes: [],
    partial: true,
  });
  expect(messages(phase)).toEqual([
    'Event 1.2 · Invasion: record what happened.',
  ]);
});

test('[EVT-09.night-ops] Night Ops requires What happened and shows this week’s Stealth benefit, +5 when twice', () => {
  const { draft, snapshot } = resourceEventFixture(14);
  let { view } = facts(draft, snapshot);
  expect(panel(view, 'event')).toMatchObject({
    eventType: 'night_ops',
    whatHappened: { required: true },
    outcomes: [
      `This week (week ${draft.week}): PCs gain +2 circumstance on Stealth after dark.`,
    ],
  });
  const twice = resourceEventFixture(14, true);
  ({ view } = facts(twice.draft, twice.snapshot));
  expect(panel(view, 'first').outcomes).toEqual([
    `This week (week ${draft.week}): PCs gain +5 circumstance on Stealth after dark.`,
  ]);
  expect(panel(view, 'second').whatHappened?.required).toBe(true);
});

test('[EVT-07.high-morale] High Morale ends the oldest by default, offers the current carried events and records a choice', () => {
  const { draft, snapshot } = resourceEventFixture(26);
  withCarried(draft, [
    carried('later', 'theft', 39, 1),
    carried('older', 'double_agent', 38),
  ]);
  let { view, phase, preview, source } = facts(draft, snapshot);
  let morale = panel(view, 'event');
  expect(morale.endings).toMatchObject({
    label: 'Persistent event that ends',
    required: false,
    count: 1,
    chosen: false,
    selected: ['older'],
    hint: 'The oldest carried event ends unless you choose another.',
    retained: [],
  });
  expect(morale.endings!.choices.map((choice) => choice.label)).toEqual([
    'Double Agent',
    'Theft',
  ]);
  expect(morale.endings!.choices[0]!.description).toBe(
    'Since week 38 · 1st that week',
  );
  const next = draft.week + 1;
  expect(morale.outcomes).toEqual([
    'Double Agent (since week 38) ends now.',
    `Next week (week ${next}): Loyalty checks +2.`,
  ]);
  expect(phase.requirements).toEqual([]);

  // Choosing the later one records it as the event target Persistent reads.
  draft.event.occurrences[0]!.targets = [{ kind: 'event', eventId: 'later' }];
  ({ view, preview, source } = facts(draft, snapshot));
  morale = panel(view, 'event');
  expect(morale.endings).toMatchObject({ chosen: true, selected: ['later'] });
  expect(morale.endings!.hint).toBeNull();
  expect(morale.outcomes[0]).toBe('Theft (since week 39) ends now.');
  const persistent = persistentView(draft, source, preview);
  expect(
    persistent.events.map((event) => [event.eventId, event.endedBy?.label]),
  ).toEqual([
    ['older', undefined],
    ['later', 'High Morale in Event 1'],
  ]);
  expect(morale.retained).toEqual([]);

  // A recorded ending no longer carried stays until cleared, and blocks.
  draft.event.occurrences[0]!.targets = [{ kind: 'event', eventId: 'gone' }];
  ({ view, phase } = facts(draft, snapshot));
  morale = panel(view, 'event');
  expect(morale.endings).toMatchObject({
    required: true,
    selected: [],
    retained: [
      {
        value: 'gone',
        label: 'A carried event no longer recorded',
        reason: 'It is no longer current when this event resolves. Clear it.',
      },
    ],
  });
  expect(messages(phase)).toContain(
    'Event 1 · High Morale: choose the carried event that ends.',
  );
});

test('[EVT-07.high-morale-fewer] High Morale with fewer carried events than it ends still grants its bonus', () => {
  const { draft, snapshot } = resourceEventFixture(26, true);
  withCarried(draft, [carried('one', 'theft', 39)]);
  let { view, phase } = facts(draft, snapshot);
  expect(panel(view, 'first').endings).toMatchObject({
    count: 1,
    selected: ['one'],
  });
  // The Twice occurrence would end one more, but none is left.
  expect(panel(view, 'second').endings).toMatchObject({
    count: 0,
    selected: [],
    choices: [],
    hint: 'No carried persistent event is left to end. The Loyalty bonus still applies.',
  });
  expect(panel(view, 'first').outcomes).toEqual([
    'Theft (since week 39) ends now.',
    `Next week (week ${draft.week + 1}): Loyalty checks +5.`,
  ]);
  expect(phase.requirements).toEqual([]);

  withCarried(draft, []);
  ({ view } = facts(draft, snapshot));
  expect(panel(view, 'first').endings).toMatchObject({
    count: 0,
    hint: 'No carried persistent event is left to end. The Loyalty bonus still applies.',
  });
  expect(panel(view, 'first').outcomes).toEqual([
    `Next week (week ${draft.week + 1}): Loyalty checks +5.`,
  ]);

  // Three carried: the Twice ends exactly one more, the second oldest.
  withCarried(draft, [
    carried('a', 'theft', 37),
    carried('b', 'low_morale', 38),
    carried('c', 'rivalry', 39),
  ]);
  ({ view, phase } = facts(draft, snapshot));
  expect(panel(view, 'second').endings).toMatchObject({
    count: 1,
    selected: ['b'],
  });
  expect(
    panel(view, 'second').endings!.choices.map((choice) => choice.value),
  ).toEqual(['b', 'c']);
  expect(panel(view, 'second').notes[0]).toBe(
    'Twice with Event 1.1 · High Morale: this one ends its own carried events; the combined Loyalty bonus is listed under Event 1.1 · High Morale.',
  );
  expect(phase.requirements).toEqual([]);
});

test('[EVT-07.retained-outcome] inputs a calm, morale or training event does not use stay listed for clearing', () => {
  const { draft, snapshot } = resourceEventFixture(26);
  withCarried(draft, [carried('one', 'theft', 39)]);
  Object.assign(draft.event.occurrences[0]!, {
    targets: [
      { kind: 'event', eventId: 'one' },
      { kind: 'team', teamId: 'team' },
    ],
    averagePartyLevel: 4,
    mitigation: 'attempted',
  });
  const { view } = facts(draft, snapshot);
  const morale = panel(view, 'event');
  expect(morale.retained.map((entry) => entry.field)).toEqual([
    'targets',
    'averagePartyLevel',
    'mitigation',
  ]);
  expect(morale.retained[1]).toEqual({
    field: 'averagePartyLevel',
    label: 'Average Party Level',
    value: '4',
  });
  // The event target is High Morale's own and is not listed.
  expect(morale.endings!.selected).toEqual(['one']);
  // A High Morale rerolled into War Games keeps its ending, named, and any
  // Overseer support recorded on the occurrence.
  const games = resourceEventFixture(8);
  withCarried(games.draft, [carried('one', 'theft', 39)]);
  Object.assign(games.draft.event.occurrences[0]!, {
    averagePartyLevel: 3,
    targets: [{ kind: 'event', eventId: 'one' }],
    overseerCharacterId: 'pc',
  });
  expect(
    panel(facts(games.draft, games.snapshot).view, 'event').retained,
  ).toEqual([
    { field: 'targets', label: 'Targets', value: 'Theft (since week 39)' },
    { field: 'averagePartyLevel', label: 'Average Party Level', value: '3' },
    {
      field: 'overseerCharacterId',
      label: 'Overseer support',
      value: 'Wren Ashby',
    },
  ]);
});

test('[EVT-03.automatic-source] the Automatic events step names the source week and its automatic events resolve first', () => {
  const { draft, snapshot } = resourceEventFixture(8);
  draft.context = {
    ...draft.context,
    queuedEffects: [
      {
        eventType: 'calm_before_the_storm',
        effectId: 'event:storm:automatic_events',
        sourceId: 'storm',
        startsWeek: draft.week,
        endsWeek: draft.week,
        effect: { kind: 'automatic_events', count: 1 },
      },
    ],
  };
  draft.event.occurrences = [
    occurrence('auto', 8, { kind: 'automatic', sourceId: 'storm' }),
    ...draft.event.occurrences,
  ];
  const { view } = facts(draft, snapshot);
  expect(view.automatic?.sources).toEqual([
    {
      sourceId: 'storm',
      label: 'Calm before the Storm',
      week: draft.week - 1,
      count: 1,
    },
  ]);
  expect(panel(view, 'auto').outcomes[0]).toMatch(/^Training \+/);
});

test('[EVT-12.forced-calm] a forced calm still resolves automatic events and says why the week is not uneventful', () => {
  const { draft, snapshot } = resourceEventFixture(8);
  draft.acknowledgements = [];
  draft.context = {
    ...draft.context,
    queuedEffects: [
      {
        eventType: 'all_is_calm',
        effectId: 'event:calm:all_is_calm',
        sourceId: 'calm',
        startsWeek: draft.week,
        endsWeek: draft.week,
        effect: { kind: 'all_is_calm' },
      },
      {
        eventType: 'calm_before_the_storm',
        effectId: 'event:storm:automatic_events',
        sourceId: 'storm',
        startsWeek: draft.week,
        endsWeek: draft.week,
        effect: { kind: 'automatic_events', count: 1 },
      },
    ],
  };
  // The recorded rolled War Games stays on record but does not happen.
  draft.event.occurrences = [
    occurrence('auto', 8, { kind: 'automatic', sourceId: 'storm' }),
    ...draft.event.occurrences,
  ];
  const { view, phase } = facts(draft, snapshot);
  expect(view.chanceStep.applies).toBe('forced_calm');
  expect(view.rolled.reason).toBe('No rolled event in a calm week');
  expect(view.automatic?.blocks.map((block) => block.eventId)).toEqual([
    'auto',
  ]);
  expect(phase.requirements).toEqual([]);
  expect(view.outcome.lines).toEqual([
    'This week: War Games.',
    'Not an uneventful week: a calm forced by last week’s All Is Calm never counts; automatic events happen this week; an event other than All Is Calm happens this week.',
  ]);
});

test('[EVT-07.outcome-edits] endings, party level and retained clears save the whole occurrence with every other field', () => {
  const { draft, snapshot } = resourceEventFixture(26);
  withCarried(draft, [
    carried('one', 'theft', 39),
    carried('two', 'theft', 40),
  ]);
  Object.assign(draft.event.occurrences[0]!, {
    targets: [{ kind: 'team', teamId: 'team' }],
    averagePartyLevel: 4,
    rolls: {
      check: {
        diceTotal: 3,
        diceCount: 1,
        sides: 20,
        provenance: { kind: 'table' },
        modifiers: [],
      },
    },
  });
  const original = structuredClone(draft.event.occurrences[0]!);
  const { view } = facts(draft, snapshot);
  const edit = vi.fn();
  const { result } = renderHook(() => useEventEdits(view, edit));
  const last = () => edit.mock.lastCall![0];

  expect(result.current.setTargets('event', 'event', ['two'])).toBeNull();
  expect(last()).toEqual({
    kind: 'event_occurrence',
    occurrence: {
      ...original,
      targets: [
        { kind: 'team', teamId: 'team' },
        { kind: 'event', eventId: 'two' },
      ],
    },
  });
  // Back to the rules' oldest: the event targets go, the team stays.
  result.current.setTargets('event', 'event', []);
  expect(last().occurrence.targets).toEqual([{ kind: 'team', teamId: 'team' }]);

  // Zero is a level; null clears it without touching anything else.
  result.current.setAveragePartyLevel('event', 0);
  expect(last().occurrence).toEqual({ ...original, averagePartyLevel: 0 });
  result.current.setAveragePartyLevel('event', null);
  const { averagePartyLevel: _level, ...withoutLevel } = original;
  expect(last().occurrence).toEqual(withoutLevel);

  // Clearing unused targets keeps the kinds the event uses.
  draft.event.occurrences[0]!.targets = [
    { kind: 'team', teamId: 'team' },
    { kind: 'event', eventId: 'one' },
  ];
  const next = facts(draft, snapshot).view;
  const edits = renderHook(() => useEventEdits(next, edit)).result.current;
  edits.clearRetained('event', 'targets', { targets: ['event'] });
  expect(last().occurrence.targets).toEqual([
    { kind: 'event', eventId: 'one' },
  ]);
  edits.clearRetained('event', 'rolls');
  expect(last().occurrence).not.toHaveProperty('rolls');
  expect(last().occurrence.averagePartyLevel).toBe(4);

  // Nothing is sent for an occurrence the draft does not hold yet.
  const pending = facts(draft, snapshot, new Set()).view;
  const refused = vi.fn();
  const blocked = renderHook(() => useEventEdits(pending, refused)).result
    .current;
  expect(blocked.setAveragePartyLevel('event', 5)).toBe(
    'This event is not ready for its roll yet.',
  );
  expect(blocked.setTargets('event', 'event', ['one'])).toBe(
    'This event is not ready for its roll yet.',
  );
  expect(blocked.clearRetained('event', 'rolls')).toBe(
    'This event is not ready for its roll yet.',
  );
  expect(refused).not.toHaveBeenCalled();
});

test('[EVT-07.ending-press] pressing an ending card replaces one ending and toggles within two', () => {
  const base = {
    label: 'Persistent events that end',
    hint: null,
    required: false,
    choices: [],
    retained: [],
  };
  const one = { ...base, count: 1, chosen: false, selected: ['a'] };
  expect(pressEnding(one, 'b')).toEqual(['b']);
  const two = { ...base, count: 2, chosen: false, selected: ['a', 'b'] };
  // From the rules' default a press starts a fresh choice.
  expect(pressEnding(two, 'c')).toEqual(['c']);
  const chosen = { ...two, chosen: true };
  expect(pressEnding(chosen, 'b')).toEqual(['a']);
  expect(pressEnding(chosen, 'c')).toEqual(['b', 'c']);
  expect(
    endingsWithout(
      { ...chosen, retained: [{ value: 'gone', label: 'Gone', reason: '' }] },
      'gone',
    ),
  ).toEqual(['a', 'b']);
  // A retained entry is cleared without turning the default into a choice.
  expect(
    endingsWithout(
      { ...two, retained: [{ value: 'gone', label: 'Gone', reason: '' }] },
      'gone',
    ),
  ).toEqual([]);
});
