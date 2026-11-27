import { assert, expect, test } from 'vitest';
import { upkeepFixture, roll } from '../../tests/rules/upkeep-fixture';
import { projectUpkeep } from './rules-upkeep';
import type { RawRoll } from './weekly-draft-facts';
import { activityFixture } from '../../tests/rules/activity-fixture';
import { projectActivity } from './rules-activity';
import { persistentEventFixture } from '../../tests/rules/persistent-event-fixture';
import { projectPersistentWeek } from './rules-persistent-events';
import { projectEventSelection } from './rules-event-selection';

const total = (
  sides: number,
  diceCount: number,
  diceTotal: number,
): RawRoll => ({
  sides,
  diceCount,
  diceTotal,
  provenance: { kind: 'table' },
  modifiers: [],
});

test.each([1, 2, 14, 20])(
  'missing-team raw %i keeps loss and end-week return timing',
  (die) => {
    const { draft, snapshot } = activityFixture('lie_low');
    snapshot.roster.teams[0]!.status = 'missing';
    draft.upkeep.teamDecisions = [
      { teamId: 'team', decision: 'recover', roll: roll(20, die) },
    ];
    const result = projectUpkeep(draft, snapshot);
    if (die === 1) expect(result.outcome.roster.teams).toEqual([]);
    else if (die === 2) {
      expect(result.outcome.roster.teams[0]!.status).toBe('missing');
      expect(result.plan).not.toContainEqual({
        kind: 'team_status',
        teamId: 'team',
        status: 'active',
        timing: 'end',
      });
    } else
      expect(result.plan).toContainEqual({
        kind: 'team_status',
        teamId: 'team',
        status: 'active',
        timing: 'end',
      });
  },
);

test.each([19, 20])(
  'Persistent nested officer check %i keeps mitigation outcome',
  (die) => {
    const { draft, snapshot } = persistentEventFixture('rivalry');
    draft.persistent.decisions = [
      {
        eventId: 'carried',
        kind: 'mitigate',
        officerCheck: {
          characterId: 'pc',
          skill: 'diplomacy',
          skillBonus: 0,
          roll: roll(20, die),
        },
      },
    ];
    expect(
      projectPersistentWeek(draft, snapshot).persistent.persistentEvents,
    ).toHaveLength(die === 20 ? 0 : 1);
  },
);

test('totals preserve modifier provenance and reserve a one-use bonus only once', () => {
  const { draft, snapshot } = upkeepFixture();
  snapshot.notoriety = 100;
  snapshot.bonuses = [
    {
      bonusId: 'reward',
      source: 'Story award',
      check: 'loyalty',
      value: 2,
      availableWeek: 40,
      consumedWeek: null,
    },
  ];
  const modifiers = [
    { sourceId: 'rank-focus', value: 3, reason: 'Rank' },
    { sourceId: 'bonus:reward', value: 2, reason: 'Story award' },
    { sourceId: 'table:morale', value: 1, reason: 'Encouragement' },
  ];
  draft.upkeep.rolls = {
    check: { ...roll(20, 5), modifiers },
    training: roll(6, 1),
    notoriety: roll(20, 1),
  };
  draft.upkeep.notorietyCheck = { ...roll(20, 12), modifiers: [modifiers[1]!] };
  const before = structuredClone(draft);
  const result = projectUpkeep(draft, snapshot);
  expect(result.checks.map((check) => check.total)).toEqual([11, 15]);
  expect(result.requirements).toContain(
    'upkeep:notoriety:bonus:reward:unavailable',
  );
  expect(result.checkUsage.bonusIds).toEqual(['reward']);
  expect(draft).toEqual(before);
  expect(snapshot.bonuses[0]!.consumedWeek).toBeNull();
});

test.each([
  { raw: undefined, requirement: 'upkeep:attrition-training:roll' },
  { raw: total(4, 1, 4), requirement: 'upkeep:attrition-training:dice:2d4' },
  { raw: total(6, 2, 8), requirement: 'upkeep:attrition-training:dice:2d4' },
])(
  'Upkeep preserves missing versus incomplete requirements $requirement',
  ({ raw, requirement }) => {
    const { draft, snapshot } = upkeepFixture();
    draft.upkeep.rolls = { check: total(20, 1, 6), training: raw };
    const before = structuredClone(draft);
    const result = projectUpkeep(draft, snapshot);
    expect(result.requirements).toContain(requirement);
    expect(result.outcome.training).toBe(30);
    expect(result.warnings).not.toContain(
      'upkeep:attrition-training:roll-range',
    );
    expect(draft).toEqual(before);
  },
);

test.each([0, 9])(
  'Upkeep 2d4 total %i remains usable with an advisory',
  (value) => {
    const { draft, snapshot } = upkeepFixture();
    snapshot.training = 15;
    draft.upkeep.rolls = {
      check: total(20, 1, 6),
      training: total(4, 2, value),
    };
    const result = projectUpkeep(draft, snapshot);
    expect(result.ready).toBe(true);
    expect(result.warnings).toContain('upkeep:attrition-training:roll-range');
    expect(result.outcome.training).toBe(value === 0 ? 12 : 3);
  },
);

test('a multi-die sum of twenty cannot supply a natural twenty or a complete d20 check', () => {
  const { draft, snapshot } = upkeepFixture();
  draft.upkeep.rolls = { check: total(20, 2, 20), training: total(6, 1, 6) };
  const result = projectUpkeep(draft, snapshot);
  expect(result.requirements).toContain('upkeep:attrition:dice:1d20');
  expect(result.outcome.training).toBe(30);
});

test.each([roll(6, 3), total(6, 1, 7), total(4, 2, 7)])(
  'Drill incomplete training retains its required 2d6 identity',
  (raw) => {
    const { draft, snapshot } = activityFixture('drill_militia');
    const choice = draft.activity.slots[0]!.choice!;
    assert(choice.actionId === 'drill_militia');
    choice.rolls = { check: total(20, 1, 10), training: raw };
    const result = projectActivity(draft, snapshot);
    expect(result.requirements).toContain('drill:training:2d6');
    expect(result.outcome.training).toBe(30);
  },
);

test.each([0, 20])(
  'Drill out-of-range total %i applies once without natural-d20 behavior',
  (value) => {
    const { draft, snapshot } = activityFixture('drill_militia');
    assert(draft.activity.slots[0]!.choice?.actionId === 'drill_militia');
    draft.activity.slots[0]!.choice.rolls = {
      check: total(20, 1, 10),
      training: total(6, 2, value),
    };
    const result = projectActivity(draft, snapshot);
    expect(result.ready).toBe(true);
    expect(result.warnings).toContain('drill:training:roll-range');
    expect(result.outcome.training).toBe(value === 0 ? 30 : 50);
  },
);

test.each([undefined, total(100, 2, 50), total(20, 1, 10)])(
  'Event chance missing or incompatible specs retain requirement identity',
  (raw) => {
    const { draft, snapshot } = activityFixture('lie_low');
    draft.event.chanceRoll = raw;
    const result = projectEventSelection(
      draft,
      projectActivity(draft, snapshot),
    );
    expect(result.ready).toBe(false);
    expect(result.requirements).toContain('event:chance:1d100');
  },
);

test.each([0, 101])('Event percentile total %i stays advisory', (value) => {
  const { draft, snapshot } = activityFixture('lie_low');
  draft.event.chanceRoll = total(100, 1, value);
  const result = projectEventSelection(draft, projectActivity(draft, snapshot));
  expect(result.warnings).toContain('event:chance:roll-range');
});

test('Activity natural one comes from the complete raw d20, never its modified total', () => {
  const { draft, snapshot } = activityFixture('recruit_team');
  const choice = draft.activity.slots[0]!.choice!;
  assert(choice.actionId === 'recruit_team');
  choice.rolls = {
    check: {
      ...roll(20, 1),
      modifiers: [{ sourceId: 'table:aid', value: 30, reason: 'Aid' }],
    },
    notoriety: roll(6, 4),
  };
  const result = projectActivity(draft, snapshot);
  expect(result.outcome.notoriety).toBe(14);
  expect(result.checks[0]!.total).toBeGreaterThan(20);
  choice.rolls.check = total(20, 2, 1);
  const incomplete = projectActivity(draft, snapshot);
  expect(incomplete.requirements).toContain('recruit:check:1d20');
  expect(incomplete.outcome.notoriety).toBe(10);
});

test('Activity total checks consume selected one-use bonuses in the existing plan', () => {
  const { draft, snapshot } = upkeepFixture();
  snapshot.bonuses.push({
    bonusId: 'reward',
    source: 'event',
    check: 'loyalty',
    value: 4,
    availableWeek: 40,
    consumedWeek: null,
  });
  draft.activity.slots[0]!.choice = {
    choiceId: 'recruit',
    actionId: 'recruit_team',
    teamType: 'patrons',
    rolls: {
      check: {
        ...roll(20, 6),
        modifiers: [{ sourceId: 'bonus:reward', value: 4, reason: 'Reward' }],
      },
    },
  };
  const result = projectActivity(draft, snapshot);
  expect(result.checks[0]!.total).toBe(13);
  expect(result.plan).toContainEqual({
    kind: 'consume_bonus',
    bonusId: 'reward',
    week: 40,
  });
  expect(snapshot.bonuses[0]!.consumedWeek).toBeNull();
});
