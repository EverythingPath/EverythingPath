import { assert, expect, test } from 'vitest';
import { eventAcceptanceFixtures } from '../../tests/rules/event-acceptance-fixtures';
import { recurringEventFixture } from '../../tests/rules/recurring-event-fixture';
import { persistentEventFixture } from '../../tests/rules/persistent-event-fixture';
import { economyFixture } from '../../tests/rules/economy-fixture';
import { roll, upkeepFixture } from '../../tests/rules/upkeep-fixture';
import {
  projectWeeklyDraft,
  resolveCanonicalWeeklyDraft,
} from './canonical-weekly-resolution';
import { projectActivityAndEvents } from './rules-event-outcomes';
import { projectActivity } from './rules-activity';
import { projectUpkeep } from './rules-upkeep';
import { projectRulesFoundations } from './rules-foundations';
import { eventActionFixture } from '../../tests/rules/event-action-fixture';
import { activityFixture } from '../../tests/rules/activity-fixture';

test('[rules.EV23.serenity-composition] Pain and Serenity compose independently in either event order and expire together', () => {
  for (const values of [
    [100, 2],
    [2, 100],
  ]) {
    const { draft, snapshot } = recurringEventFixture(values[0], true);
    draft.event.occurrences[2]!.tableRoll = roll(100, values[1]!);
    const event = projectActivityAndEvents(draft, snapshot).event;
    expect(event.ready).toBe(true);
    expect(event.queuedEffects).toHaveLength(8);
    for (const week of [41, 42]) {
      const foundations = projectRulesFoundations({
        ...snapshot,
        week,
        slots: [
          { slotId: 'one', choice: { choiceId: 'work', actionId: 'lie_low' } },
        ],
        operatingSettlementId: null,
        queuedEffects: event.queuedEffects,
        checks: (
          ['upkeep', 'activity', 'event', 'persistent'] as const
        ).flatMap((phase) =>
          (['loyalty', 'secrecy', 'security'] as const).map((check) => ({
            checkId: `${phase}:${check}`,
            phase,
            check,
            die: 10,
            choiceId: 'work',
          })),
        ),
      });
      expect(foundations.requirements).toEqual([]);
      for (const check of foundations.checks)
        expect(check.total).toBe(
          10 +
            (check.checkId.endsWith(':loyalty') ? 3 : 1) +
            (week === 41 ? 4 : 0),
        );
      const upkeep = upkeepFixture();
      upkeep.draft.week = week;
      upkeep.snapshot.training = 100;
      upkeep.draft.context = {
        ...upkeep.draft.context,
        queuedEffects: event.queuedEffects,
      };
      upkeep.draft.upkeep.rolls = {
        check: roll(20, 1),
        training: roll(4, 1, 1),
      };
      expect(projectUpkeep(upkeep.draft, upkeep.snapshot).plan).toContainEqual({
        kind: 'training',
        step: 'attrition',
        before: 100,
        after: week === 41 ? 90 : 95,
      });
      upkeep.draft.upkeep.rolls.check = roll(20, 20);
      upkeep.draft.upkeep.rolls.training = roll(6, 2);
      expect(projectUpkeep(upkeep.draft, upkeep.snapshot).plan).toContainEqual({
        kind: 'training',
        step: 'attrition',
        before: 100,
        after: 102,
      });
      const drill = activityFixture('drill_militia');
      drill.draft.week = week;
      drill.draft.context = {
        ...drill.draft.context,
        queuedEffects: event.queuedEffects,
      };
      drill.snapshot.roster.officers = [
        { role: 'commandant', characterId: 'pc' },
      ];
      const activity = projectActivity(drill.draft, drill.snapshot);
      expect(activity.ready).toBe(true);
      expect(activity.outcome.training).toBe(week === 41 ? 64 : 47);
      expect(activity.outcome.treasuryCopper).toBe(27000);
    }
  }
});

test('[rules.E88.complete] queued and persistent event outcomes survive complete weekly resolution', () => {
  for (const { name, input } of eventAcceptanceFixtures()) {
    const untouched = structuredClone(input);
    const preview = projectWeeklyDraft(input);
    expect(preview.requirements, name).toEqual([]);
    expect(preview.status, name).toBe('ready');
    const resolved = resolveCanonicalWeeklyDraft(input);
    expect(resolved.outcome, name).toEqual(preview.outcome);
    expect(projectWeeklyDraft(input), name).toEqual(preview);
    expect(input, name).toEqual(untouched);
    const outcome = resolved.outcome!;
    if (name === 'storm') {
      expect(outcome.context.queuedEffects).toMatchObject([
        {
          sourceId: 'first',
          startsWeek: 41,
          endsWeek: 41,
          effect: { kind: 'automatic_events', count: 2 },
        },
      ]);
    }
    if (name === 'buyoff') {
      expect(outcome.militiaSnapshot.treasuryCopper).toBe(24000);
      expect(outcome.context.carriedEvents).toEqual([]);
      expect(outcome.context.lastBuyoffWeek).toBe(2);
    }
    if (name === 'morale') {
      expect(
        outcome.context.carriedEvents.map((event) => event.eventId),
      ).toEqual(['newest']);
      expect(preview.phases!.event.endedEventIds).toEqual(['older', 'later']);
    }
    if (name === 'queue') {
      expect(outcome.militiaSnapshot.training).toBe(36);
      expect(
        preview.phases!.event.selected.map((event) => event.eventId),
      ).toEqual(['auto-one', 'auto-two', 'event']);
      expect(outcome.context.queuedEffects).toEqual([
        {
          effectId: 'future',
          sourceId: 'future-source',
          startsWeek: 42,
          endsWeek: 42,
          effect: { kind: 'event_chance', value: 7 },
        },
      ]);
    }
  }
});

test('[rules.E07.phase] signed queued organization modifiers obey every phase and check combination', () => {
  const { draft, snapshot } = upkeepFixture();
  snapshot.roster.officers = [];
  const phases = ['upkeep', 'activity', 'event', 'persistent'] as const;
  const checks = ['loyalty', 'secrecy', 'security'] as const;
  for (const phase of phases)
    for (const check of checks) {
      const result = projectRulesFoundations({
        ...snapshot,
        week: 40,
        slots: [
          { slotId: 'one', choice: { choiceId: 'work', actionId: 'lie_low' } },
        ],
        operatingSettlementId: null,
        checks: phases.flatMap((candidatePhase) =>
          checks.map((candidateCheck) => ({
            checkId: `${candidatePhase}:${candidateCheck}`,
            phase: candidatePhase,
            check: candidateCheck,
            die: 10,
            choiceId: 'work',
          })),
        ),
        queuedEffects: [-2, 5].map((value) => ({
          effectId: `effect:${value}`,
          sourceId: `source:${value}`,
          startsWeek: draft.week,
          endsWeek: draft.week,
          effect: { kind: 'check_modifier', check, phase, value },
        })),
      });
      expect(result.requirements).toEqual([]);
      for (const projected of result.checks) {
        const matching = projected.checkId === `${phase}:${check}`;
        expect(
          projected.modifiers.filter((modifier) =>
            modifier.source.startsWith('queued:'),
          ),
        ).toEqual(
          matching
            ? [
                { source: 'queued:source:-2', value: -2 },
                { source: 'queued:source:5', value: 5 },
              ]
            : [],
        );
        expect(projected.total).toBe(
          10 +
            (projected.checkId.endsWith(':loyalty') ? 3 : 1) +
            (matching ? 3 : 0),
        );
      }
    }
});

test('[rules.EV05.exception] a cache exception retains the choice and single penalty; ending restores next-week eligibility', () => {
  const { draft, snapshot, choice } = economyFixture('secure_cache');
  draft.context = {
    ...draft.context,
    carriedEvents: [
      {
        eventId: 'agent',
        eventType: 'double_agent',
        startedWeek: 1,
        order: 0,
        targets: [],
      },
    ],
  };
  const untouched = structuredClone(choice);
  expect(projectActivity(draft, snapshot).requirements).toContain(
    'economy:action-blocked:exception',
  );
  draft.rulesExceptions.push({
    exceptionId: 'cache-permission',
    subjectId: 'economy',
    ruleId: 'action-blocked',
    reason: 'The agent cannot observe this expedition.',
  });
  const allowed = projectActivity(draft, snapshot);
  expect(allowed.requirements).not.toContain(
    'economy:action-blocked:exception',
  );
  expect(allowed.checks[0]?.total).toBe(15);
  expect(choice).toEqual(untouched);
  const buyoff = eventAcceptanceFixtures().find(
    (fixture) => fixture.name === 'buyoff',
  )!.input;
  const ended = resolveCanonicalWeeklyDraft(buyoff).outcome!;
  draft.context = {
    ...draft.context,
    carriedEvents: ended.context.carriedEvents,
  };
  draft.rulesExceptions = [];
  const restored = projectActivity(draft, snapshot);
  expect(restored.requirements).not.toContain(
    'economy:action-blocked:exception',
  );
  expect(restored.checks[0]?.total).toBe(17);
});

test('[rules.EV09.recompute] ending Low Morale recomputes the next event check at its DC boundary', () => {
  const { draft, snapshot } = recurringEventFixture(26, true);
  draft.context = {
    ...draft.context,
    carriedEvents: [
      {
        eventId: 'old',
        eventType: 'low_morale',
        startedWeek: 39,
        order: 0,
        targets: [],
      },
    ],
  };
  const theft = draft.event.occurrences[2]!;
  theft.tableRoll = roll(100, 74);
  theft.mitigation = 'attempted';
  theft.rolls = { check: roll(20, 17) };
  let event = projectActivityAndEvents(draft, snapshot).event;
  expect(event.ready).toBe(true);
  expect(event.checks[0]?.total).toBe(20);
  expect(event.outcome.treasuryCopper).toBe(27000);
  draft.event.occurrences[1]!.tableRoll = roll(100, 46);
  event = projectActivityAndEvents(draft, snapshot).event;
  expect(event.checks[0]?.total).toBe(18);
  expect(event.outcome.treasuryCopper).toBe(15000);
});

test('[rules.EV11.duration] temporary Low Morale expires and persistent Low Morale affects later Upkeep until ended', () => {
  const { draft, snapshot } = recurringEventFixture(86);
  const temporary = projectActivityAndEvents(draft, snapshot).event;
  const next = upkeepFixture();
  next.snapshot.roster.officers = [];
  next.draft.upkeep.rolls = { check: roll(20, 10), training: roll(6, 2) };
  next.draft.context = {
    ...next.draft.context,
    queuedEffects: temporary.queuedEffects,
  };
  next.draft.week = 41;
  expect(projectUpkeep(next.draft, next.snapshot).checks[0]?.total).toBe(11);
  next.draft.week = 42;
  expect(projectUpkeep(next.draft, next.snapshot).checks[0]?.total).toBe(13);
  const carried =
    persistentEventFixture('low_morale').draft.context.carriedEvents;
  next.draft.context = { ...next.draft.context, carriedEvents: carried };
  expect(projectUpkeep(next.draft, next.snapshot).checks[0]?.total).toBe(11);
  next.draft.context = { ...next.draft.context, carriedEvents: [] };
  expect(projectUpkeep(next.draft, next.snapshot).checks[0]?.total).toBe(13);
});

test('[rules.EV23.expiry] Pain applies all check penalties for exactly the next week', () => {
  const { draft, snapshot } = recurringEventFixture(100, true);
  const event = projectActivityAndEvents(draft, snapshot).event;
  for (const week of [40, 41, 42]) {
    const result = projectRulesFoundations({
      ...snapshot,
      week,
      slots: [
        { slotId: 'one', choice: { choiceId: 'work', actionId: 'lie_low' } },
      ],
      operatingSettlementId: null,
      queuedEffects: event.queuedEffects,
      checks: (['upkeep', 'activity', 'event', 'persistent'] as const).flatMap(
        (phase) =>
          (['loyalty', 'secrecy', 'security'] as const).map((check) => ({
            checkId: `${phase}:${check}`,
            phase,
            check,
            die: 10,
            choiceId: 'work',
          })),
      ),
    });
    expect(result.requirements).toEqual([]);
    for (const check of result.checks)
      expect(check.total).toBe(
        10 +
          (check.checkId.endsWith(':loyalty') ? 3 : 1) +
          (week === 41 ? -1 : 0),
      );
  }
});

test('[rules.E88.notoriety] reactive Sabotage caps the rules baseline while explicit adjustments can exceed it', () => {
  const { draft, snapshot } = eventActionFixture('sabotage');
  snapshot.notoriety = 96;
  draft.context = { ...draft.context, firstMilitiaWeek: true };
  const input = { revision: draft, militiaSnapshot: snapshot };
  const preview = projectWeeklyDraft(input);
  expect(preview.requirements).toEqual([]);
  // Guarantee raises 96 to 99, then Sabotage's four reaches the rules cap.
  expect(preview.baseline!.militiaSnapshot.notoriety).toBe(100);
  draft.tableAdjustments = [
    {
      adjustmentId: 'cap-exception',
      kind: 'militia_value',
      field: 'notoriety',
      operation: 'add',
      value: 7,
      reason: 'The table tracks temporary excess.',
    },
  ];
  const adjusted = resolveCanonicalWeeklyDraft(input);
  expect(adjusted.baseline!.militiaSnapshot.notoriety).toBe(100);
  expect(adjusted.outcome!.militiaSnapshot.notoriety).toBe(107);
});

test('[rules.E07.stale] an unattempted mitigation ignores retained dice and modifiers', () => {
  const { draft, snapshot } = recurringEventFixture(74);
  const theft = draft.event.occurrences[0]!;
  theft.mitigation = 'attempted';
  theft.rolls = { check: roll(20, 18) };
  theft.rolls.check!.modifiers = [
    {
      sourceId: 'table-support',
      value: 100,
      reason: 'Support for an attempted check',
    },
  ];
  const attempted = projectActivityAndEvents(draft, snapshot).event;
  expect(attempted.ready).toBe(true);
  expect(attempted.checks[0]?.total).toBe(121);
  expect(attempted.outcome.treasuryCopper).toBe(27000);
  theft.mitigation = 'unattempted';
  const declined = projectActivityAndEvents(draft, snapshot).event;
  expect(declined.ready).toBe(true);
  expect(declined.checks).toEqual([]);
  expect(declined.outcome.treasuryCopper).toBe(15000);
});

test('[rules.E88.covert-cap] successful Covert suppression preserves the pre-action value across the cap', () => {
  for (const notoriety of [-10, 98, 100, 110]) {
    const { draft, snapshot } = eventActionFixture('covert_action');
    snapshot.notoriety = notoriety;
    snapshot.characters[0]!.charisma = 40;
    assert(draft.activity.slots[1]!.choice?.actionId === 'drill_militia');
    draft.activity.slots[1]!.choice.rolls = {
      check: roll(20, 1),
      training: roll(6, 2, 4),
      notoriety: roll(6, 4),
    };
    const result = projectActivity(draft, snapshot);
    expect(result.ready).toBe(true);
    expect(result.outcome.notoriety, String(notoriety)).toBe(notoriety);
    expect(result.plan.filter((change) => change.kind === 'notoriety')).toEqual(
      [],
    );
    // A later unsuppressed Guarantee operates on that restored value.
    const guarantee = eventActionFixture().choice;
    guarantee.choiceId = 'later';
    draft.activity.slots.push({ slotId: 'third', choice: guarantee });
    snapshot.roster.officers.push({ role: 'strategist', characterId: 'pc' });
    const later = projectActivity(draft, snapshot);
    expect(later.outcome.notoriety).toBe(
      Math.max(0, Math.min(100, notoriety + 3)),
    );
    draft.activity.slots.pop();
    snapshot.characters[0]!.charisma = 10;
    expect(projectActivity(draft, snapshot).outcome.notoriety).toBe(
      Math.max(0, Math.min(100, notoriety + 4)),
    );
    draft.activity.slots[1]!.choice = {
      choiceId: 'drill',
      actionId: 'lie_low',
    };
    draft.rulesExceptions.push({
      exceptionId: 'lie-low',
      subjectId: 'drill',
      ruleId: 'lie-low-exclusivity',
      reason: 'Concurrent quiet operations',
    });
    const quieter = projectActivity(draft, snapshot);
    expect(quieter.ready).toBe(true);
    expect(quieter.outcome.notoriety).toBe(
      Math.max(0, Math.min(100, notoriety - 1)),
    );
    draft.activity.slots = [];
    expect(projectActivity(draft, snapshot).outcome.notoriety).toBe(notoriety);
  }
});
