import {
  actionChoiceRolls,
  stagedActionChoiceSchema,
} from './weekly-draft-facts';
import { activityRollSpec } from './rules-roll-spec';
import { expect, test } from 'vitest';
import { activityFixture } from '../../tests/rules/activity-fixture';
import { characterFixture } from '../../tests/rules/character-fixture';
import { economyFixture } from '../../tests/rules/economy-fixture';
import { settlementFixture } from '../../tests/rules/settlement-fixture';
import { occurrence, pair } from '../../tests/rules/event-selection-fixture';
import { roll } from '../../tests/rules/upkeep-fixture';
import { projectActivity } from './rules-activity';
import { projectActivityAndEvents } from './rules-event-outcomes';

const scenarios = [
  {
    action: 'dismiss_team',
    fixture: () => activityFixture('dismiss_team'),
    die: 6,
    total: 9,
    before: 14,
    after: 10,
    read: (result: ReturnType<typeof projectActivity>) =>
      result.outcome.notoriety,
  },
  {
    action: 'drill_militia',
    fixture: () => activityFixture('drill_militia'),
    die: 8,
    total: 11,
    before: 30,
    after: 37,
    read: (result: ReturnType<typeof projectActivity>) =>
      result.outcome.training,
  },
  {
    action: 'recruit_team',
    fixture: () => activityFixture('recruit_team'),
    die: 6,
    total: 9,
    before: 1,
    after: 2,
    read: (result: ReturnType<typeof projectActivity>) =>
      result.outcome.roster.teams.length,
  },
  {
    action: 'earn_gold',
    fixture: () => economyFixture('earn_gold'),
    die: 10,
    total: 11,
    before: 1003300,
    after: 1003900,
    read: (result: ReturnType<typeof projectActivity>) =>
      result.outcome.treasuryCopper,
  },
  {
    action: 'gather_information',
    fixture: () => characterFixture('gather_information'),
    die: 4,
    total: 13,
    before: false,
    after: true,
    read: (result: ReturnType<typeof projectActivity>) =>
      result.plan.find((change) => change.kind === 'information')?.succeeded,
  },
  {
    action: 'knowledge_check',
    fixture: () => characterFixture('knowledge_check'),
    die: 10,
    total: 16,
    before: 16,
    after: 18,
    read: (result: ReturnType<typeof projectActivity>) =>
      result.plan.find((change) => change.kind === 'information')?.achievedDc,
  },
  {
    action: 'rescue_character',
    fixture: () => characterFixture('rescue_character'),
    die: 18,
    total: 19,
    before: 'captured',
    after: 'available',
    read: (result: ReturnType<typeof projectActivity>) =>
      result.outcome.characterActions!.people[0]!.status,
  },
  {
    action: 'reduce_danger',
    fixture: () => settlementFixture('reduce_danger'),
    die: 13,
    total: 14,
    before: 0,
    after: 1,
    read: (result: ReturnType<typeof projectActivity>) =>
      result.outcome.settlements[0]!.reduceDangerReputationShift ?? 0,
  },
  {
    action: 'spread_propaganda',
    fixture: () => settlementFixture('spread_propaganda'),
    die: 16,
    total: 19,
    before: 'Hostile',
    after: 'Unfriendly',
    read: (result: ReturnType<typeof projectActivity>) =>
      result.outcome.settlements[0]!.reputation,
  },
  {
    action: 'activate_black_market',
    fixture: () => economyFixture('activate_black_market'),
    die: 16,
    total: 19,
    before: 0,
    after: 1,
    read: (result: ReturnType<typeof projectActivity>) =>
      result.outcome.economy!.markets.length,
  },
  {
    action: 'secure_cache',
    fixture: () => economyFixture('secure_cache'),
    die: 11,
    total: 14,
    before: 'returning',
    after: 'hidden',
    read: (result: ReturnType<typeof projectActivity>) =>
      result.outcome.economy!.caches[0]?.status,
  },
];

for (const { action, fixture, die, total, before, after, read } of scenarios) {
  test(`[rules.EV08.actions.${action}] Hidden Agenda recomputes the action outcome from its raw check and removing it restores the original projection`, () => {
    const { draft, snapshot } = fixture();
    const choice = draft.activity.slots[0]!.choice!;
    const notorietySpec = activityRollSpec(choice.actionId, 'notoriety');
    draft.activity.slots[0]!.choice = stagedActionChoiceSchema.parse({
      ...choice,
      rolls: {
        ...actionChoiceRolls(choice),
        check: roll(20, die),
        ...(notorietySpec ? { notoriety: roll(notorietySpec.sides, 4) } : {}),
      },
    });
    draft.event.chanceRoll = roll(100, 1);
    draft.event.occurrences = [occurrence('agenda', 42)];
    const unchanged = structuredClone({ draft, snapshot });
    const baseline = projectActivity(draft, snapshot);
    expect(baseline.ready).toBe(true);
    expect(baseline.checks[0]!.total).toBe(total);
    expect(read(baseline)).toBe(before);
    const result = projectActivityAndEvents(draft, snapshot);
    expect(result.event.requirements).toEqual([]);
    expect(result.activity.ready).toBe(true);
    expect(result.activity.checks[0]!.total).toBe(total + 2);
    expect(read(result.activity)).toBe(after);
    expect(
      result.activity.checks[0]!.modifiers.filter(
        (modifier) => modifier.source === 'queued:hidden-agenda',
      ),
    ).toEqual([{ source: 'queued:hidden-agenda', value: 2 }]);
    expect({ draft, snapshot }).toEqual(unchanged);

    draft.event.occurrences = pair(42);
    const twice = projectActivityAndEvents(draft, snapshot);
    expect(twice.event.requirements).toEqual([]);
    expect(twice.activity.checks[0]!.total).toBe(total + 5);
    draft.event.chanceRoll = roll(100, 100);
    expect(projectActivityAndEvents(draft, snapshot).activity).toEqual(
      baseline,
    );
  });
}

test('[rules.EV08.no-check] recalculation preserves narrative and paid actions without a check and never duplicates their costs', () => {
  for (const action of [
    'special',
    'restore_character',
    'strike_team',
  ] as const) {
    const { draft, snapshot } = characterFixture(action);
    draft.event.chanceRoll = roll(100, 1);
    draft.event.occurrences = pair(42);
    const baseline = projectActivity(draft, snapshot);
    expect(baseline.ready, action).toBe(true);
    const result = projectActivityAndEvents(draft, snapshot);
    expect(result.event.requirements, action).toEqual([]);
    expect(result.activity, action).toEqual(baseline);
  }
});
