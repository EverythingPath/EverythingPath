import { expect, test } from 'vitest';
import { activityRollSpec } from './rules-roll-spec';
import { eventRollSpec } from './rules-roll-spec';
import type { EventType } from './militia-domain';
import { activityFixture } from '../../tests/rules/activity-fixture';
import { economyFixture } from '../../tests/rules/economy-fixture';
import { recurringEventFixture } from '../../tests/rules/recurring-event-fixture';
import { projectActivity } from './rules-activity';
import { projectActivityAndEvents } from './rules-event-outcomes';
import { roll } from '../../tests/rules/upkeep-fixture';

test('Activity totals use action-specific dice rather than recorded metadata', () => {
  expect(activityRollSpec('drill_militia', 'training')).toEqual({
    count: 2,
    sides: 6,
  });
  expect(activityRollSpec('special_order', 'delivery')).toEqual({
    count: 2,
    sides: 6,
  });
  expect(activityRollSpec('reduce_danger', 'notoriety')).toEqual({
    count: 1,
    sides: 4,
  });
  expect(activityRollSpec('guarantee_event', 'notoriety')).toEqual({
    count: 1,
    sides: 6,
  });
  expect(activityRollSpec('special', 'check')).toBeNull();
  expect(activityRollSpec('lie_low', 'check')).toBeNull();
});

test('Event loss specifications distinguish Turncoat root from Raid capture targets', () => {
  expect(
    eventRollSpec({ kind: 'occurrence', eventType: 'turncoat' }, [
      'rolls',
      'loss',
    ]),
  ).toEqual({ count: 1, sides: 6 });
  expect(
    eventRollSpec({ kind: 'occurrence', eventType: 'raid' }, [
      'targetChecks',
      0,
      'rolls',
      'loss',
    ]),
  ).toEqual({ count: 1, sides: 100 });
  expect(
    eventRollSpec({ kind: 'occurrence', eventType: 'raid' }, ['rolls', 'loss']),
  ).toBeNull();
  expect(
    eventRollSpec({ kind: 'occurrence', eventType: null }, ['rolls', 'loss']),
  ).toBeNull();
});

test.each([
  'activate_black_market',
  'dismiss_team',
  'drill_militia',
  'earn_gold',
  'gather_information',
  'knowledge_check',
  'recruit_team',
  'reduce_danger',
  'rescue_character',
  'secure_cache',
  'spread_propaganda',
] as const)('%s has a raw d20 check specification', (actionId) => {
  expect(activityRollSpec(actionId, 'check')).toEqual({ count: 1, sides: 20 });
});

test.each([
  'activate_refuge',
  'broker_market',
  'change_officer_role',
  'covert_action',
  'lie_low',
  'manipulate_events',
  'restore_character',
  'strike_team',
  'upgrade_team',
  'special',
] as const)('%s does not invent ordinary action dice', (actionId) => {
  for (const field of ['check', 'notoriety', 'training', 'delivery'] as const)
    expect(activityRollSpec(actionId, field)).toBeNull();
});

test.each([
  'activate_black_market',
  'dismiss_team',
  'drill_militia',
  'earn_gold',
  'gather_information',
  'recruit_team',
] as const)(
  '%s keeps its conditional d6 notoriety specification',
  (actionId) => {
    expect(activityRollSpec(actionId, 'notoriety')).toEqual({
      count: 1,
      sides: 6,
    });
  },
);

test.each([
  'knowledge_check',
  'rescue_character',
  'secure_cache',
  'spread_propaganda',
] as const)('%s cannot acquire a generic notoriety roll', (actionId) => {
  expect(activityRollSpec(actionId, 'notoriety')).toBeNull();
  expect(activityRollSpec(actionId, 'training')).toBeNull();
  expect(activityRollSpec(actionId, 'delivery')).toBeNull();
});

test.each<EventType>(['sickness', 'theft'])(
  '%s occurrence check has a d20 specification',
  (eventType) => {
    expect(
      eventRollSpec({ kind: 'occurrence', eventType }, ['rolls', 'check']),
    ).toEqual({ count: 1, sides: 20 });
  },
);

test.each<EventType>(['cache_discovered', 'raid'])(
  '%s has no event-level check: each person or cache records its own',
  (eventType) => {
    expect(
      eventRollSpec({ kind: 'occurrence', eventType }, ['rolls', 'check']),
    ).toBeNull();
  },
);

test.each<EventType>(['rivalry', 'turncoat'])(
  '%s officer checks keep their d20 separate from root loss',
  (eventType) => {
    expect(
      eventRollSpec({ kind: 'occurrence', eventType }, [
        'officerCheck',
        'roll',
      ]),
    ).toEqual({ count: 1, sides: 20 });
  },
);

test('Sabotage and unresolved table rolls have type-independent fixed specifications', () => {
  const context = { kind: 'occurrence', eventType: null } as const;
  expect(eventRollSpec(context, ['tableRoll'])).toEqual({
    count: 1,
    sides: 100,
  });
  expect(eventRollSpec(context, ['sabotage', 'rolls', 'check'])).toEqual({
    count: 1,
    sides: 20,
  });
  expect(eventRollSpec(context, ['sabotage', 'rolls', 'notoriety'])).toEqual({
    count: 1,
    sides: 6,
  });
  expect(eventRollSpec(context, ['sabotage', 'rolls', 'training'])).toBeNull();
  expect(eventRollSpec(context, ['officerCheck', 'roll'])).toBeNull();
});

test('target paths are exact and do not infer capture dice for unrelated events', () => {
  const context = { kind: 'occurrence', eventType: 'raid' } as const;
  expect(eventRollSpec(context, ['targetChecks', 3, 'rolls', 'check'])).toEqual(
    { count: 1, sides: 20 },
  );
  expect(
    eventRollSpec({ kind: 'occurrence', eventType: 'cache_discovered' }, [
      'targetChecks',
      0,
      'rolls',
      'check',
    ]),
  ).toEqual({ count: 1, sides: 20 });
  expect(
    eventRollSpec({ kind: 'occurrence', eventType: 'cache_discovered' }, [
      'targetChecks',
      0,
      'rolls',
      'loss',
    ]),
  ).toBeNull();
  for (const path of [
    ['targetChecks', '0', 'rolls', 'loss'],
    ['targetChecks', -1, 'rolls', 'loss'],
    ['targetChecks', 0.5, 'rolls', 'loss'],
    ['targetChecks', 0, 'loss'],
    ['targetChecks', 0, 'rolls', 'loss', 'diceTotal'],
    ['rolls.loss'],
    ['event', 'tableRoll'],
    ['rolls', 'duration'],
    ['rolls', 'reward'],
  ])
    expect(eventRollSpec(context, path)).toBeNull();
});

test('a failed Drill keeps its training specification without consuming retained training', () => {
  const { draft, snapshot } = activityFixture('drill_militia');
  const choice = draft.activity.slots[0]!.choice;
  if (choice?.actionId !== 'drill_militia')
    throw new Error('Expected Drill fixture');
  choice.rolls = { check: roll(20, 2), training: roll(4, 4) };
  const before = structuredClone(draft);
  const result = projectActivity(draft, snapshot);
  expect(activityRollSpec(choice.actionId, 'training')).toEqual({
    count: 2,
    sides: 6,
  });
  expect(result.outcome.training).toBe(30);
  expect(result.requirements).not.toContain('drill:training:2d6');
  expect(draft).toEqual(before);
});

test('expedited Special Order keeps delivery metadata inert and charges its existing cost', () => {
  const { draft, snapshot, choice } = economyFixture('special_order');
  if (choice.actionId !== 'special_order')
    throw new Error('Expected Special Order fixture');
  choice.expedited = true;
  choice.rolls = { delivery: roll(4, 4) };
  const before = structuredClone(draft);
  const result = projectActivity(draft, snapshot);
  expect(activityRollSpec(choice.actionId, 'delivery')).toEqual({
    count: 2,
    sides: 6,
  });
  expect(result.ready).toBe(true);
  expect(result.outcome.economy?.orders[0]?.dueDay).toBe(274);
  expect(result.outcome.treasuryCopper).toBe(909049);
  expect(draft).toEqual(before);
});

test('declined Theft mitigation retains its known spec without requiring or using stored dice', () => {
  const { draft, snapshot } = recurringEventFixture(74);
  const event = draft.event.occurrences[0]!;
  event.mitigation = 'unattempted';
  event.rolls = { check: roll(4, 4) };
  const before = structuredClone(draft);
  const result = projectActivityAndEvents(draft, snapshot).event;
  expect(
    eventRollSpec({ kind: 'occurrence', eventType: 'theft' }, [
      'rolls',
      'check',
    ]),
  ).toEqual({ count: 1, sides: 20 });
  expect(result.ready).toBe(true);
  expect(result.checks).toEqual([]);
  expect(result.outcome.treasuryCopper).toBe(15000);
  expect(draft).toEqual(before);
});
