import { assert, expect, test } from 'vitest';
import { projectActivity } from './rules-activity';
import { projectSettlements } from './rules-settlements';
import { contextSettlementSchema } from './canonical-campaign-context';
import { settlementFixture } from '../../tests/rules/settlement-fixture';
import { economyFixture } from '../../tests/rules/economy-fixture';
import { roll } from '../../tests/rules/upkeep-fixture';
import { REPUTATION_LEVELS } from './militia-domain';

test('[rules.A02.reputation] Refuge changes only targeted effective reputation and permits reasoned unusual locations', () => {
  for (const reputation of REPUTATION_LEVELS) {
    const { draft, snapshot } = settlementFixture('activate_refuge');
    snapshot.settlements[0]!.reputation = reputation;
    snapshot.settlements.push({
      ...snapshot.settlements[0]!,
      settlementId: 'other',
    });
    const valid = reputation === 'Hostile' || reputation === 'Unfriendly';
    expect(projectActivity(draft, snapshot).ready).toBe(valid);
    if (!valid)
      draft.rulesExceptions.push({
        exceptionId: 'e',
        subjectId: 'settlement',
        ruleId: 'refuge-reputation',
        reason: 'Shelter local allies',
      });
    const result = projectActivity(draft, snapshot);
    expect(result.ready).toBe(true);
    expect(result.outcome.settlements[0]!.reputation).toBe(reputation);
    expect(
      projectSettlements(result.outcome.settlements, draft.week).settlements[0]!
        .reputation,
    ).toBe(
      valid
        ? REPUTATION_LEVELS[REPUTATION_LEVELS.indexOf(reputation) + 1]
        : reputation,
    );
    expect(result.outcome.settlements[1]).toEqual(snapshot.settlements[1]);
    expect(result.outcome.treasuryCopper).toBe(snapshot.treasuryCopper);
  }
});
test('[rules.A02.duration] Refuge renews without stacking and expires the next week', () => {
  const { draft, snapshot } = settlementFixture('activate_refuge');
  snapshot.settlements[0]!.reputation = 'Unfriendly';
  snapshot.settlements[0]!.refugeActivatedWeek = draft.week;
  snapshot.settlements[0]!.refugeActiveUntilWeek = draft.week;
  const result = projectActivity(draft, snapshot);
  expect(result.ready).toBe(true);
  expect(
    projectSettlements(result.outcome.settlements, draft.week).settlements[0]!
      .reputation,
  ).toBe('Indifferent');
  expect(
    projectSettlements(result.outcome.settlements, draft.week + 1)
      .settlements[0]!.reputation,
  ).toBe('Unfriendly');
  expect(result.plan).toContainEqual({
    kind: 'settlement_benefit',
    choiceId: 'settlement',
    settlementId: 'town',
    benefit: 'refuge',
    expiresWeek: draft.week,
  });
});
test('[rules.A15.success] Security 15 grants one temporary step and open movement without mutating source', () => {
  const { draft, snapshot } = settlementFixture('reduce_danger');
  const before = structuredClone(snapshot);
  const result = projectActivity(draft, snapshot);
  expect(result.ready).toBe(true);
  expect(result.checks[0]!.total).toBe(15);
  expect(result.outcome.settlements[0]).toMatchObject({
    reputation: 'Hostile',
    reduceDangerReputationShift: 1,
    reduceDangerUntilWeek: 40,
  });
  expect(result.plan).toContainEqual({
    kind: 'settlement_benefit',
    choiceId: 'settlement',
    settlementId: 'town',
    benefit: 'open_movement',
    expiresWeek: 40,
  });
  expect(
    contextSettlementSchema.safeParse(result.outcome.settlements[0]).success,
  ).toBe(true);
  expect(snapshot).toEqual(before);
});
test('[rules.A15.failure] Security 14 needs one d4 and adds exactly its notoriety on failure', () => {
  const { draft, snapshot, choice } = settlementFixture('reduce_danger');
  assert(choice.actionId === 'reduce_danger');
  choice.rolls = { check: roll(20, 13) };
  expect(projectActivity(draft, snapshot).requirements).toContain(
    'settlement:notoriety:1d4',
  );
  for (const die of [1, 4]) {
    choice.rolls.notoriety = roll(4, die);
    const result = projectActivity(draft, snapshot);
    expect(result.ready).toBe(true);
    expect(result.outcome.notoriety).toBe(snapshot.notoriety + die);
    expect(result.outcome.settlements).toEqual(snapshot.settlements);
    expect(result.endedEventIds).toEqual([]);
  }
});
test('[rules.A15.duration] Reduce Danger expiry preserves preexisting temporary context and permanent gains', () => {
  const { draft, snapshot } = settlementFixture('reduce_danger');
  snapshot.settlements[0]!.temporaryReputationShift = 1;
  const result = projectActivity(draft, snapshot);
  expect(
    projectSettlements(result.outcome.settlements, 40).settlements[0]!
      .reputation,
  ).toBe('Indifferent');
  expect(
    projectSettlements(result.outcome.settlements, 41).settlements[0]!
      .reputation,
  ).toBe('Unfriendly');
  draft.week = 41;
  const renewed = projectActivity(draft, result.outcome);
  expect(renewed.outcome.settlements[0]!.reduceDangerReputationShift).toBe(1);
  expect(renewed.outcome.settlements[0]!.temporaryReputationShift).toBe(1);
});
test('[rules.A15.theft] Reduce Danger ends each carried Theft once and changes only subsequent income', () => {
  const { draft, snapshot } = settlementFixture('reduce_danger');
  draft.context = {
    ...draft.context,
    carriedEvents: ['theft-1', 'theft-2'].map((eventId, order) => ({
      eventId,
      eventType: 'theft',
      startedWeek: 39,
      order,
      targets: [],
    })),
    persistentPhaseEligible: true,
  };
  const earned = economyFixture('earn_gold').choice;
  earned.teamId = 'earner';
  snapshot.roster.teams.push({
    ...snapshot.roster.teams[0]!,
    teamId: 'earner',
    teamType: 'fixers',
  });
  draft.activity.slots[1]!.choice = earned;
  const after = projectActivity(draft, snapshot);
  expect(after.ready).toBe(true);
  expect(after.endedEventIds).toEqual(['theft-1', 'theft-2']);
  expect(after.plan.filter((x) => x.kind === 'end_persistent_event')).toEqual(
    ['theft-1', 'theft-2'].map((eventId) => ({
      kind: 'end_persistent_event',
      choiceId: 'settlement',
      eventId,
    })),
  );
  expect(after.outcome.treasuryCopper).toBe(snapshot.treasuryCopper + 3900);
  draft.activity.slots.reverse();
  const before = projectActivity(draft, snapshot);
  expect(before.outcome.treasuryCopper).toBe(snapshot.treasuryCopper + 1950);
  expect(draft.context.persistentPhaseEligible).toBe(true);
});
test('[rules.A22.check] Propaganda pays exactly 100 gp even on failure and uses target occupation DC', () => {
  const { draft, snapshot, choice } = settlementFixture('spread_propaganda');
  if (choice.actionId !== 'spread_propaganda')
    throw new Error('Expected propaganda');
  choice.occupied = false;
  choice.costCopper = 0;
  snapshot.settlements[0]!.occupied = true;
  let result = projectActivity(draft, snapshot);
  expect(result.ready).toBe(true);
  expect(result.checks[0]!.total).toBe(20);
  expect(result.outcome.settlements[0]!.reputation).toBe('Hostile');
  expect(result.outcome.treasuryCopper).toBe(snapshot.treasuryCopper - 10000);
  expect(result.warnings).toEqual(
    expect.arrayContaining([
      'settlement:settlement-occupied',
      'settlement:calculated-cost',
    ]),
  );
  choice.rolls = { check: roll(20, 20) };
  snapshot.characters[0]!.charisma = 14;
  result = projectActivity(draft, snapshot);
  expect(result.checks[0]!.total).toBe(25);
  expect(result.outcome.settlements[0]!.reputation).toBe('Unfriendly');
});
test('[rules.A22.success] Propaganda permanently raises each base reputation only once up to Helpful', () => {
  for (const reputation of REPUTATION_LEVELS) {
    const { draft, snapshot } = settlementFixture('spread_propaganda');
    snapshot.settlements[0]!.reputation = reputation;
    const result = projectActivity(draft, snapshot);
    expect(result.ready).toBe(true);
    expect(result.outcome.settlements[0]!.reputation).toBe(
      REPUTATION_LEVELS[Math.min(4, REPUTATION_LEVELS.indexOf(reputation) + 1)],
    );
    expect(
      projectSettlements(result.outcome.settlements, 41).settlements[0]!
        .reputation,
    ).toBe(result.outcome.settlements[0]!.reputation);
  }
});
test('[rules.A22.attempt] A failed attempt consumes the settlement opportunity while different settlements remain independent', () => {
  const { draft, snapshot, choice } = settlementFixture('spread_propaganda');
  assert(choice.actionId === 'spread_propaganda');
  choice.rolls = { check: roll(20, 1) };
  snapshot.roster.teams.push({
    ...snapshot.roster.teams[0]!,
    teamId: 'second',
  });
  const second = {
    ...choice,
    choiceId: 'second',
    teamId: 'second',
    acknowledgements: [
      {
        acknowledgementId: 'second',
        subjectId: 'propaganda:second',
        outcome: 'Can influence',
      },
    ],
    rolls: { check: roll(20, 17) },
  };
  draft.activity.slots[1]!.choice = second;
  expect(projectActivity(draft, snapshot).requirements).toContain(
    'second:propaganda-limit:exception',
  );
  draft.rulesExceptions.push({
    exceptionId: 'retry',
    subjectId: 'second',
    ruleId: 'propaganda-limit',
    reason: 'Reinforcements support a retry',
  });
  expect(
    projectActivity(draft, snapshot).outcome.settlements[0]!.reputation,
  ).toBe('Unfriendly');
  draft.rulesExceptions = [];
  snapshot.settlements.push({
    ...snapshot.settlements[0]!,
    settlementId: 'other',
  });
  second.settlementId = 'other';
  const result = projectActivity(draft, snapshot);
  expect(result.ready).toBe(true);
  expect(result.outcome.settlements.map((x) => x.reputation)).toEqual([
    'Hostile',
    'Unfriendly',
  ]);
});
test('[rules.A22.adjudication] GM approval is assumed: no permission decision or impossible-target exception, while required facts and owned targets cannot be waived', () => {
  const { draft, snapshot, choice } = settlementFixture('spread_propaganda');
  if (choice.actionId !== 'spread_propaganda')
    throw new Error('Expected propaganda');
  const attempted = () => {
    const result = projectActivity(draft, snapshot);
    expect(result.ready).toBe(true);
    expect(
      [...result.requirements, ...result.warnings].filter((code) =>
        code.includes('propaganda-'),
      ),
    ).toEqual([]);
    expect(result.plan.map((entry) => entry.kind)).toContain(
      'propaganda_attempt',
    );
    // The resolved effects, not the choice echoed back in the outcome.
    return {
      plan: result.plan,
      checks: result.checks,
      warnings: result.warnings,
      settlements: result.outcome.settlements,
      treasuryCopper: result.outcome.treasuryCopper,
    };
  };
  // An unanswered permission raises no requirement.
  expect(choice.possible).toBeUndefined();
  const allowed = attempted();
  // An older choice's stored "impossible" answer is ignored, needs no
  // exception, and resolves exactly like an unanswered one.
  choice.possible = false;
  expect(attempted()).toEqual(allowed);
  // A leftover exception for the retired rule changes nothing either.
  draft.rulesExceptions.push({
    exceptionId: 'permission',
    subjectId: 'settlement',
    ruleId: 'propaganda-impossible',
    reason: 'Disguise changes the situation',
  });
  expect(attempted()).toEqual(allowed);
  // Occupation still sets the DC: +5 when occupied.
  snapshot.settlements[0]!.occupied = false;
  expect(projectActivity(draft, snapshot).checks[0]!.dc).toBe(20);
  snapshot.settlements[0]!.occupied = true;
  expect(projectActivity(draft, snapshot).checks[0]!.dc).toBe(25);
  snapshot.settlements[0]!.occupied = false;
  choice.settlementId = 'foreign';
  expect(projectActivity(draft, snapshot).requirements).toContain(
    'settlement:settlement',
  );
  choice.settlementId = 'town';
  snapshot.settlements[0]!.occupied = null;
  expect(projectActivity(draft, snapshot).requirements).toContain(
    'settlement:settlement-occupied',
  );
  snapshot.settlements[0]!.occupied = false;
  choice.acknowledgements = [];
  expect(projectActivity(draft, snapshot).requirements).toContain(
    'settlement:acknowledgement:propaganda:settlement',
  );
});
test('[rules.settlements.readiness] Missing team, target, rolls and context remain distinct from exceptions', () => {
  for (const action of [
    'activate_refuge',
    'reduce_danger',
    'spread_propaganda',
  ] as const) {
    const { draft, snapshot, choice } = settlementFixture(action);
    choice.teamId = 'foreign';
    choice.settlementId = 'foreign';
    expect(projectActivity(draft, snapshot).ready).toBe(false);
    choice.teamId = 'team';
    choice.settlementId = 'town';
    snapshot.settlements[0]!.reputation = null;
    expect(projectActivity(draft, snapshot).requirements).toContain(
      'settlement:settlement-reputation',
    );
  }
  const { draft, snapshot } = settlementFixture('reduce_danger');
  snapshot.settlements[0]!.secured = null;
  expect(projectActivity(draft, snapshot).requirements).toContain(
    'settlement:settlement-secured',
  );
  snapshot.settlements[0]!.secured = false;
  expect(projectActivity(draft, snapshot).requirements).toContain(
    'settlement:settlement-secured:exception',
  );
  draft.rulesExceptions.push({
    exceptionId: 'security',
    subjectId: 'settlement',
    ruleId: 'settlement-secured',
    reason: 'Local patrols cooperate',
  });
  expect(projectActivity(draft, snapshot).ready).toBe(true);
});
test('[rules.settlements.prices] Earlier Refuge recalculates later target-local purchase prices when reordered or removed', () => {
  const { draft, snapshot } = settlementFixture('activate_refuge');
  const purchase = economyFixture('special_order').choice;
  purchase.teamId = 'buyer';
  snapshot.roster.teams.push({
    ...snapshot.roster.teams[0]!,
    teamId: 'buyer',
    teamType: 'fixers',
  });
  draft.activity.slots[1]!.choice = purchase;
  const result = projectActivity(draft, snapshot);
  expect(result.ready).toBe(true);
  expect(result.outcome.economy!.orders[0]!.priceCopper).toBe(951);
  draft.activity.slots.reverse();
  expect(
    projectActivity(draft, snapshot).outcome.economy!.orders[0]!.priceCopper,
  ).toBe(998);
  draft.activity.slots[1]!.choice = null;
  expect(
    projectActivity(draft, snapshot).outcome.economy!.orders[0]!.priceCopper,
  ).toBe(998);
});

test('[rules.settlements.partial-expiry] Partial temporary effects are missing facts rather than silently zero', () => {
  const { draft, snapshot } = settlementFixture('reduce_danger');
  const settlement = snapshot.settlements[0]!;
  for (const partial of [
    { reduceDangerReputationShift: 1 },
    { reduceDangerUntilWeek: 40 },
  ]) {
    const invalid = { ...settlement, ...partial };
    expect(contextSettlementSchema.safeParse(invalid).success).toBe(false);
    expect(
      projectSettlements([invalid], 40).settlements[0]!.reputation,
    ).toBeNull();
    snapshot.settlements = [invalid];
    expect(projectActivity(draft, snapshot).requirements).toContain(
      'settlement:settlement-reputation',
    );
  }
});

test('[rules.settlements.modifiers] Operating Helpful, officers, managers and contextual sources apply once while target social DC stays separate', () => {
  const { draft, snapshot, choice } = settlementFixture('spread_propaganda');
  assert(choice.actionId === 'spread_propaganda');
  snapshot.settlements.push({
    ...snapshot.settlements[0]!,
    settlementId: 'hq',
    reputation: 'Helpful',
  });
  draft.activity.operatingSettlementId = 'hq';
  snapshot.characters[0]!.charisma = 14;
  snapshot.roster.teams[0]!.managerCharacterId = 'pc';
  choice.rolls = {
    check: {
      ...roll(20, 15),
      modifiers: [
        { sourceId: 'helpful', value: 2, reason: 'Recorded source' },
        { sourceId: 'officers', value: 2, reason: 'Recorded source' },
        { sourceId: 'manager:pc', value: 2, reason: 'Recorded source' },
        { sourceId: 'pc', value: 2, reason: 'Recorded source' },
        { sourceId: 'weather', value: 1, reason: 'Weather' },
        { sourceId: 'weather', value: 1, reason: 'Weather' },
      ],
    },
  };
  const result = projectActivity(draft, snapshot);
  expect(result.ready).toBe(true);
  expect(result.checks[0]!.total).toBe(25);
  expect(
    result.checks[0]!.modifiers.filter((x) => x.source === 'helpful'),
  ).toEqual([{ source: 'helpful', value: 2 }]);
  expect(result.outcome.settlements.map((x) => x.reputation)).toEqual([
    'Unfriendly',
    'Helpful',
  ]);
  expect(result.checkUsage.helpful).toBe(true);
});

test('[rules.A15.multiple-teams] Separate military teams each grant a temporary step to the same town', () => {
  const { draft, snapshot, choice } = settlementFixture('reduce_danger');
  snapshot.roster.teams.push({
    ...snapshot.roster.teams[0]!,
    teamId: 'second',
  });
  draft.activity.slots[1]!.choice = {
    ...choice,
    choiceId: 'second',
    teamId: 'second',
  };
  const result = projectActivity(draft, snapshot);
  expect(result.ready).toBe(true);
  expect(result.outcome.settlements[0]!.reduceDangerReputationShift).toBe(2);
  expect(
    projectSettlements(result.outcome.settlements, 40).settlements[0]!
      .reputation,
  ).toBe('Indifferent');
  expect(
    projectSettlements(result.outcome.settlements, 41).settlements[0]!
      .reputation,
  ).toBe('Hostile');
});
