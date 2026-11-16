import { assert, expect, test } from 'vitest';
import { projectActivityAndEvents as project } from './rules-event-outcomes';
import { projectActivity } from './rules-activity';
import { projectUpkeep } from './rules-upkeep';
import { recurringEventFixture } from '../../tests/rules/recurring-event-fixture';
import { occurrence } from '../../tests/rules/event-selection-fixture';
import { roll, upkeepFixture } from '../../tests/rules/upkeep-fixture';
import { activityFixture } from '../../tests/rules/activity-fixture';
import { settlementFixture } from '../../tests/rules/settlement-fixture';
import { weeklyDraftSchema } from './weekly-draft-contract';

test('[rules.EV04.base] Calm before Storm queues one automatic event and excludes quiet carry', () => {
  const { draft, snapshot } = recurringEventFixture();
  const result = project(draft, snapshot).event;
  expect(result).toMatchObject({ ready: true, nextUneventfulCarry: false });
  expect(result.queuedEffects).toMatchObject([
    {
      startsWeek: 41,
      endsWeek: 41,
      effect: { kind: 'automatic_events', count: 1 },
    },
  ]);
});
test('[rules.EV04.twice] duplicate Storm queues exactly two automatic events before next normal event', () => {
  const { draft, snapshot } = recurringEventFixture(54, true);
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.queuedEffects).toHaveLength(1);
  expect(result.queuedEffects[0]?.effect).toEqual({
    kind: 'automatic_events',
    count: 2,
  });
  draft.week = 41;
  draft.context = { ...draft.context, queuedEffects: result.queuedEffects };
  draft.event = {
    chanceRoll: roll(100, 1),
    occurrences: [
      occurrence('auto-one', 10, { kind: 'automatic', sourceId: 'first' }),
      occurrence('auto-two', 10, { kind: 'automatic', sourceId: 'first' }),
      occurrence('normal', 10),
    ],
  };
  const next = project(draft, result.outcome).event;
  expect(next.ready).toBe(true);
  expect(next.selected.map((event) => event.eventId)).toEqual([
    'auto-one',
    'auto-two',
    'normal',
  ]);
  expect(next.outcome.training).toBe(39);
});
test('[rules.EV04.replacement] automatic repeated Roll Twice requires its own replacement without consuming normal expansion', () => {
  const { draft, snapshot } = recurringEventFixture();
  const result = project(draft, snapshot).event;
  draft.week = 41;
  draft.context = { ...draft.context, queuedEffects: result.queuedEffects };
  draft.event = {
    chanceRoll: roll(100, 100),
    occurrences: [
      occurrence('auto', 50, { kind: 'automatic', sourceId: 'event' }),
    ],
  };
  expect(project(draft, result.outcome).event.requirements).toContain(
    'auto:replacement:1',
  );
});
test('[rules.EV05.base] Double Agent supplies a temporary penalty and next-Activity-only cache restriction', () => {
  const { draft, snapshot } = recurringEventFixture(98);
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.persistentEvents).toEqual([]);
  expect(result.queuedEffects.map((effect) => effect.effect)).toEqual([
    { kind: 'check_modifier', check: 'secrecy', value: -2 },
    { kind: 'block_action', actionId: 'secure_cache' },
  ]);
  draft.week = 41;
  draft.context = { ...draft.context, queuedEffects: result.queuedEffects };
  draft.activity.slots = [
    {
      slotId: 'cache',
      choice: { choiceId: 'cache', actionId: 'secure_cache' },
    },
  ];
  expect(projectActivity(draft, result.outcome).requirements).toContain(
    'cache:action-blocked:exception',
  );
  draft.week = 42;
  expect(projectActivity(draft, result.outcome).requirements).not.toContain(
    'cache:action-blocked:exception',
  );
});
test('[rules.EV05.twice] persistent Double Agent retains stable identity without queued penalty or block duplicates', () => {
  const { draft, snapshot } = recurringEventFixture(98, true);
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.queuedEffects).toEqual([]);
  expect(result.persistentEvents).toMatchObject([
    {
      eventId: 'first',
      eventType: 'double_agent',
      startedWeek: 40,
      order: 0,
      sourceEventIds: ['first', 'second'],
    },
  ]);
  draft.week = 42;
  draft.context = {
    ...draft.context,
    carriedEvents: result.persistentEvents,
    persistentPhaseEligible: true,
  };
  draft.activity.slots = [
    {
      slotId: 'cache',
      choice: { choiceId: 'cache', actionId: 'secure_cache' },
    },
  ];
  expect(projectActivity(draft, result.outcome).requirements).toContain(
    'cache:action-blocked:exception',
  );
});
test('[rules.EV05.single-penalty] a queued and persistent copy contributes only one Secrecy penalty', () => {
  const { draft, snapshot } = recurringEventFixture(98, true);
  const first = project(draft, snapshot).event;
  draft.context = {
    ...draft.context,
    carriedEvents: first.persistentEvents,
    persistentPhaseEligible: true,
    queuedEffects: [
      {
        effectId: 'old',
        sourceId: 'different',
        eventType: 'double_agent',
        startsWeek: 40,
        endsWeek: 41,
        effect: { kind: 'check_modifier', check: 'secrecy', value: -2 },
      },
    ],
  };
  draft.event.occurrences = [occurrence('cache', 62)];
  draft.event.occurrences[0]!.targets = [{ kind: 'cache', cacheId: 'cache' }];
  draft.event.occurrences[0]!.targetChecks = [
    {
      target: { kind: 'cache', cacheId: 'cache' },
      mitigation: 'attempted',
      rolls: { check: roll(20, 14) },
    },
  ];
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.checks[0]?.total).toBe(13);
});
test('[rules.EV08.base] Hidden Agenda recomputes a failed Drill into a success from its raw roll', () => {
  const { draft, snapshot } = activityFixture('drill_militia');
  assert(draft.activity.slots[0]!.choice?.actionId === 'drill_militia');
  draft.activity.slots[0]!.choice.rolls = {
    check: roll(20, 8),
    training: roll(6, 2, 4),
  };
  draft.event.chanceRoll = roll(100, 1);
  draft.event.occurrences = [occurrence('agenda', 42)];
  expect(projectActivity(draft, snapshot).outcome.training).toBe(30);
  const result = project(draft, snapshot);
  expect(result.event.ready).toBe(true);
  expect(result.activity.outcome.training).toBe(36);
  expect(result.activity.checks[0]?.total).toBe(13);
});
test('[rules.EV08.twice] duplicate Hidden Agenda is effective five and clearing it removes all derived effects', () => {
  const { draft, snapshot } = recurringEventFixture(42, true);
  draft.activity.slots = [
    {
      slotId: 'drill',
      choice: {
        choiceId: 'drill',
        actionId: 'drill_militia',
        rolls: { check: roll(20, 5), training: roll(6, 2, 4) },
      },
    },
  ];
  const result = project(draft, snapshot);
  expect(result.event.ready).toBe(true);
  expect(result.activity.checks[0]?.total).toBe(13);
  expect(
    result.event.plan.filter(
      (change) => change.kind === 'event_activity_bonus',
    ),
  ).toMatchObject([{ value: 5 }]);
  draft.event.chanceRoll = roll(100, 100);
  expect(project(draft, snapshot).activity.outcome.training).toBe(30);
});
test('[rules.EV08.readiness] newly successful actions expose required reward dice rather than inventing outcomes', () => {
  const { draft, snapshot } = recurringEventFixture(42);
  draft.activity.slots = [
    {
      slotId: 'drill',
      choice: {
        choiceId: 'drill',
        actionId: 'drill_militia',
        rolls: { check: roll(20, 8) },
      },
    },
  ];
  expect(project(draft, snapshot).event.requirements).toContain(
    'drill:training:2d6',
  );
});
test('[rules.EV09.base] High Morale ends the oldest persistent event and queues Loyalty two', () => {
  const { draft, snapshot } = recurringEventFixture(26);
  draft.context = {
    ...draft.context,
    persistentPhaseEligible: true,
    carriedEvents: [
      {
        eventId: 'later',
        eventType: 'theft',
        startedWeek: 39,
        order: 1,
        targets: [],
      },
      {
        eventId: 'older',
        eventType: 'double_agent',
        startedWeek: 38,
        order: 0,
        targets: [],
      },
    ],
  };
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.endedEventIds).toEqual(['older']);
  expect(result.persistentEvents.map((event) => event.eventId)).toEqual([
    'later',
  ]);
  expect(result.queuedEffects[0]?.effect).toEqual({
    kind: 'check_modifier',
    check: 'loyalty',
    value: 2,
  });
});
test('[rules.EV09.twice] duplicate High Morale ends only two and queues one Loyalty five even with three available', () => {
  const { draft, snapshot } = recurringEventFixture(26, true);
  draft.context = {
    ...draft.context,
    persistentPhaseEligible: true,
    carriedEvents: ['one', 'two', 'three'].map((eventId, order) => ({
      eventId,
      eventType: 'low_morale',
      startedWeek: 39,
      order,
      targets: [],
    })),
  };
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.endedEventIds).toEqual(['one', 'two']);
  expect(result.persistentEvents.map((event) => event.eventId)).toEqual([
    'three',
  ]);
  expect(result.queuedEffects).toHaveLength(1);
  expect(result.queuedEffects[0]?.effect).toEqual({
    kind: 'check_modifier',
    check: 'loyalty',
    value: 5,
  });
});
test('[rules.EV09.empty] High Morale still grants its bonus when there are fewer persistent events than endings', () => {
  for (const count of [0, 1]) {
    const { draft, snapshot } = recurringEventFixture(26, true);
    draft.context = {
      ...draft.context,
      persistentPhaseEligible: count > 0,
      carriedEvents: count
        ? [
            {
              eventId: 'one',
              eventType: 'theft',
              startedWeek: 39,
              order: 0,
              targets: [],
            },
          ]
        : [],
    };
    const result = project(draft, snapshot).event;
    expect(result.ready).toBe(true);
    expect(result.persistentEvents).toEqual([]);
    expect(result.queuedEffects[0]?.effect).toMatchObject({ value: 5 });
  }
});
test('[rules.EV11.base] Low Morale affects subsequent checks in event order', () => {
  const { draft, snapshot } = recurringEventFixture(86, true);
  draft.event.occurrences[2]!.tableRoll = roll(100, 74);
  draft.event.occurrences[2]!.mitigation = 'attempted';
  draft.event.occurrences[2]!.rolls = { check: roll(20, 18) };
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.checks[0]?.total).toBe(19);
  expect(result.outcome.treasuryCopper).toBe(15000);
});
test('[rules.EV11.twice] duplicate Low Morale becomes one persistent penalty and no queued duplicate', () => {
  const { draft, snapshot } = recurringEventFixture(86, true);
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.queuedEffects).toEqual([]);
  expect(result.persistentEvents).toMatchObject([
    { eventId: 'first', eventType: 'low_morale' },
  ]);
});
test('[rules.EV16.base] Rivalry records two distinct teams and blocks only next Activity', () => {
  const { draft, snapshot } = recurringEventFixture(66);
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.queuedEffects).toHaveLength(2);
  expect(result.queuedEffects.map((effect) => effect.effect)).toEqual([
    { kind: 'team_unavailable', teamId: 'team', phase: 'activity' },
    { kind: 'team_unavailable', teamId: 'second-team', phase: 'activity' },
  ]);
});
test('[rules.EV16.base-check] a base Rivalry cannot be ended by the persistent-only officer check', () => {
  const { draft, snapshot } = recurringEventFixture(66);
  snapshot.roster.officers = [{ role: 'overseer', characterId: 'pc' }];
  draft.event.occurrences[0]!.officerCheck = {
    characterId: 'pc',
    skill: 'diplomacy',
    skillBonus: 0,
    roll: roll(20, 20),
  };
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.queuedEffects).toHaveLength(2);
  expect(
    result.plan.filter((entry) => entry.kind === 'event_officer_check'),
  ).toEqual([]);
});
test('[rules.EV16.twice] persistent Rivalry retains both targets and prevents later Activity even without queues', () => {
  const { draft, snapshot } = recurringEventFixture(66, true);
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.queuedEffects).toEqual([]);
  expect(result.persistentEvents[0]?.targets).toHaveLength(2);
  draft.week = 45;
  draft.context = {
    ...draft.context,
    carriedEvents: result.persistentEvents,
    persistentPhaseEligible: true,
  };
  draft.activity.slots = [
    {
      slotId: 'work',
      choice: {
        choiceId: 'work',
        actionId: 'special',
        teamId: 'team',
        instruction: 'Scout',
      },
    },
  ];
  expect(projectActivity(draft, result.outcome).requirements).toContain(
    'work:team-unavailable:exception',
  );
});
test('[rules.EV16.check] an optional officer social check ends Rivalry at twenty but incomplete attempts remain required', () => {
  const { draft, snapshot } = recurringEventFixture(66, true);
  snapshot.roster.officers = [{ role: 'overseer', characterId: 'pc' }];
  const event = draft.event.occurrences[2]!;
  event.officerCheck = {
    characterId: 'pc',
    skill: 'intimidate',
    skillBonus: 3,
    roll: roll(20, 17),
  };
  let result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.persistentEvents).toEqual([]);
  expect(result.endedEventIds).toContain('first');
  delete event.officerCheck.roll;
  result = project(draft, snapshot).event;
  expect(result.ready).toBe(false);
  expect(result.persistentEvents).toHaveLength(1);
});
test('[rules.EV16.inputs] Rivalry requires two existing distinct targets and a selection acknowledgement', () => {
  const { draft, snapshot } = recurringEventFixture(66);
  draft.event.occurrences[0]!.targets = [
    { kind: 'team', teamId: 'team' },
    { kind: 'team', teamId: 'team' },
  ];
  draft.acknowledgements = [];
  expect(project(draft, snapshot).event.requirements).toEqual([
    'event:acknowledgement',
    'event:teams',
  ]);
});
test('[rules.EV19.base] Theft halves treasury after already ordered Activity costs', () => {
  const { draft, snapshot } = recurringEventFixture(74);
  draft.activity.slots = [
    {
      slotId: 'drill',
      choice: {
        choiceId: 'drill',
        actionId: 'drill_militia',
        rolls: { check: roll(20, 1), notoriety: roll(6, 1) },
      },
    },
  ];
  const result = project(draft, snapshot);
  expect(result.event.ready).toBe(true);
  expect(result.activity.outcome.treasuryCopper).toBe(27000);
  expect(result.event.outcome.treasuryCopper).toBe(13500);
});
test('[rules.EV19.mitigate] Theft saves at Loyalty twenty with copper precision and missing attempts cause no loss', () => {
  const { draft, snapshot } = recurringEventFixture(74);
  snapshot.treasuryCopper = 30001;
  const event = draft.event.occurrences[0]!;
  event.mitigation = 'attempted';
  let result = project(draft, snapshot).event;
  expect(result.ready).toBe(false);
  expect(result.outcome.treasuryCopper).toBe(30001);
  event.rolls = { check: roll(20, 17) };
  result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.outcome.treasuryCopper).toBe(27001);
  event.rolls.check = roll(20, 16);
  expect(project(draft, snapshot).event.outcome.treasuryCopper).toBe(15001);
});
test('[rules.EV19.twice] duplicate Theft halves balance once and creates the future income restriction', () => {
  const { draft, snapshot } = recurringEventFixture(74, true);
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.outcome.treasuryCopper).toBe(15000);
  expect(result.persistentEvents).toMatchObject([
    { eventId: 'first', eventType: 'theft' },
  ]);
});
test('[rules.EV19.ending] successful Reduce Danger removes carried Theft before Event projection', () => {
  const { draft, snapshot } = settlementFixture('reduce_danger');
  draft.context = {
    ...draft.context,
    persistentPhaseEligible: true,
    carriedEvents: [
      {
        eventId: 'theft',
        eventType: 'theft',
        startedWeek: 39,
        order: 0,
        targets: [],
      },
    ],
  };
  draft.event.chanceRoll = roll(100, 100);
  const result = project(draft, snapshot);
  expect(result.event.ready).toBe(true);
  expect(result.event.persistentEvents).toEqual([]);
  expect(result.event.endedEventIds).toContain('theft');
});
test('[rules.EV23.base] Pain queues all check penalties and one doubled next-Upkeep loss', () => {
  const { draft, snapshot } = recurringEventFixture(100);
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.queuedEffects).toHaveLength(4);
  expect(result.queuedEffects.map((effect) => effect.effect)).toEqual([
    { kind: 'check_modifier', check: 'loyalty', value: -1 },
    { kind: 'check_modifier', check: 'secrecy', value: -1 },
    { kind: 'check_modifier', check: 'security', value: -1 },
    { kind: 'upkeep_loss_multiplier', value: 2 },
  ]);
});
test('[rules.EV23.twice] duplicate Pain does not add effects and doubles every loss rather than natural-twenty gains', () => {
  const { draft, snapshot } = recurringEventFixture(100, true);
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.queuedEffects).toHaveLength(4);
  const next = upkeepFixture();
  next.draft.week = 41;
  next.draft.context = {
    ...next.draft.context,
    queuedEffects: result.queuedEffects,
  };
  next.snapshot.training = 100;
  next.snapshot.notoriety = 100;
  next.snapshot.treasuryCopper = 0;
  next.draft.upkeep.rolls = {
    check: roll(20, 8),
    training: roll(6, 2),
    notoriety: roll(20, 3),
    loss: roll(4, 1, 1),
  };
  next.draft.upkeep.notorietyCheck = roll(20, 13);
  const upkeep = projectUpkeep(next.draft, next.snapshot);
  expect(
    upkeep.plan.filter((change) => change.kind === 'training'),
  ).toMatchObject([
    { step: 'attrition', before: 100, after: 96 },
    { step: 'notoriety', before: 96, after: 84 },
    { step: 'shortage', before: 84, after: 74 },
  ]);
  next.snapshot.notoriety = 0;
  next.snapshot.treasuryCopper = 3000;
  next.draft.upkeep.rolls.check = roll(20, 20);
  next.draft.upkeep.rolls.training = roll(6, 2);
  expect(projectUpkeep(next.draft, next.snapshot).outcome.training).toBe(102);
});
test('[rules.EV24.base] Serenity doubles full Drill gain including Commandant while leaving costs unchanged', () => {
  const { draft, snapshot } = recurringEventFixture(2);
  const result = project(draft, snapshot).event;
  const next = activityFixture('drill_militia');
  next.draft.week = 41;
  next.draft.context = {
    ...next.draft.context,
    queuedEffects: result.queuedEffects,
  };
  next.snapshot.roster.officers = [{ role: 'commandant', characterId: 'pc' }];
  assert(next.draft.activity.slots[0]!.choice?.actionId === 'drill_militia');
  next.draft.activity.slots[0]!.choice.rolls = {
    check: roll(20, 10),
    training: roll(6, 2, 5),
  };
  const activity = projectActivity(next.draft, next.snapshot);
  expect(activity.ready).toBe(true);
  expect(activity.outcome.training).toBe(64);
  expect(activity.outcome.treasuryCopper).toBe(27000);
});
test('[rules.EV24.twice] duplicate Serenity supplies one set of effects and expires after next week', () => {
  const { draft, snapshot } = recurringEventFixture(2, true);
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.queuedEffects).toHaveLength(4);
  expect(
    result.queuedEffects
      .filter((effect) => effect.effect.kind === 'check_modifier')
      .every(
        (effect) =>
          effect.effect.kind === 'check_modifier' && effect.effect.value === 5,
      ),
  ).toBe(true);
  const next = activityFixture('drill_militia');
  next.draft.week = 42;
  next.draft.context = {
    ...next.draft.context,
    queuedEffects: result.queuedEffects,
  };
  expect(projectActivity(next.draft, next.snapshot).outcome.training).toBe(37);
  expect(weeklyDraftSchema.safeParse(draft).success).toBe(true);
});
