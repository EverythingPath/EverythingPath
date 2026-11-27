import { expect, test } from 'vitest';
import { projectActivityAndEvents as project } from './rules-event-outcomes';
import { projectEventPurchaseCost } from './rules-event-benefits';
import { projectActivity } from './rules-activity';
import { projectRulesFoundations } from './rules-foundations';
import { resourceEventFixture } from '../../tests/rules/resource-event-fixture';
import { occurrence } from '../../tests/rules/event-selection-fixture';
import { roll } from '../../tests/rules/upkeep-fixture';
import { weeklyDraftSchema } from './weekly-draft-contract';

test('[rules.EV01.base] ordinary calm leaves resources unchanged and grants eligible carry', () => {
  const { draft, snapshot } = resourceEventFixture(46);
  const result = project(draft, snapshot).event;
  expect(result).toMatchObject({
    ready: true,
    plan: [],
    queuedEffects: [],
    nextUneventfulCarry: true,
  });
  expect(result.outcome.training).toBe(snapshot.training);
});
test('[rules.EV01.twice] duplicate calm forces next week without a chance roll or another carry', () => {
  const { draft, snapshot } = resourceEventFixture(46, true);
  const first = project(draft, snapshot).event;
  expect(first.ready).toBe(true);
  expect(first.queuedEffects).toEqual([
    {
      effectId: 'event:first:all_is_calm',
      sourceId: 'first',
      startsWeek: 41,
      endsWeek: 41,
      effect: { kind: 'all_is_calm' },
    },
  ]);
  draft.week = 41;
  draft.context = { ...draft.context, queuedEffects: first.queuedEffects };
  draft.event = { occurrences: [] };
  expect(project(draft, first.outcome).event).toMatchObject({
    ready: true,
    nextUneventfulCarry: false,
    selected: [],
  });
});
test('[rules.EV01.precedence] forced calm still resolves automatic events before suppressing stale normal inputs', () => {
  const { draft, snapshot } = resourceEventFixture(46);
  draft.context = {
    ...draft.context,
    queuedEffects: [
      {
        effectId: 'calm',
        sourceId: 'calm',
        startsWeek: 40,
        endsWeek: 40,
        effect: { kind: 'all_is_calm' },
      },
      {
        effectId: 'auto',
        sourceId: 'storm',
        startsWeek: 40,
        endsWeek: 40,
        effect: { kind: 'automatic_events', count: 1 },
      },
    ],
  };
  draft.event.occurrences.push(
    occurrence('auto', 10, { kind: 'automatic', sourceId: 'storm' }),
  );
  draft.event.occurrences[0]!.sabotage = { choiceId: 'stale' };
  delete draft.event.chanceRoll;
  const result = project(draft, snapshot).event;
  expect(result).toMatchObject({
    ready: true,
    nextUneventfulCarry: false,
    sabotage: [],
    selected: [{ eventId: 'auto' }],
  });
  expect(result.outcome.training).toBe(snapshot.training + snapshot.rank);
});
test('[rules.EV02.base] Broke the Code identifies the selected item without a caster-level limit and grants this-week Knowledge', () => {
  const { draft, snapshot } = resourceEventFixture(18);
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.outcome.economy?.items[0]?.identified).toBe(true);
  expect(result.outcome.eventBenefits?.skills).toMatchObject([
    {
      value: 2,
      skills: ['knowledge_local'],
      characterIds: ['pc'],
      startsWeek: 40,
      endsWeek: 40,
    },
  ]);
  expect(
    result.plan.find((change) => change.kind === 'event_identification'),
  ).toMatchObject({
    itemId: 'mystery',
    acknowledgement: { outcome: 'The table records the result.' },
  });
});
test('[rules.EV02.twice] duplicate Code identifies once and replaces the bonus with five', () => {
  const { draft, snapshot } = resourceEventFixture(18, true);
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(
    result.plan.filter((change) => change.kind === 'event_identification'),
  ).toHaveLength(1);
  expect(
    result.plan.filter((change) => change.kind === 'event_skill_benefit'),
  ).toMatchObject([
    { benefit: { value: 5, sourceEventIds: ['first', 'second'] } },
  ]);
  expect(result.outcome.eventBenefits?.skills).toHaveLength(1);
});
test('[rules.EV02.acknowledgement] missing identification item or acknowledgement blocks completion', () => {
  const { draft, snapshot } = resourceEventFixture(18);
  draft.acknowledgements = [];
  expect(project(draft, snapshot).event).toMatchObject({
    ready: false,
    requirements: ['event:acknowledgement'],
  });
  expect(
    project(draft, snapshot).event.outcome.economy?.items[0]?.identified,
  ).toBeUndefined();
  draft.event.occurrences[0]!.targets = [];
  expect(project(draft, snapshot).event.requirements).toContain('event:item');
});
test('[rules.EV06.base] Festival grants a town-specific morale bonus next week', () => {
  const { draft, snapshot } = resourceEventFixture(34);
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.outcome.eventBenefits?.skills).toMatchObject([
    {
      settlementId: 'town',
      value: 2,
      bonusType: 'morale',
      skills: ['bluff', 'diplomacy', 'intimidate'],
      startsWeek: 41,
      endsWeek: 41,
    },
  ]);
});
test('[rules.EV06.twice] duplicate Festival enhances one town bonus to five', () => {
  const { draft, snapshot } = resourceEventFixture(34, true);
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.outcome.eventBenefits?.skills).toMatchObject([
    { value: 5, settlementId: 'town' },
  ]);
  expect(result.outcome.eventBenefits?.skills).toHaveLength(1);
});
test('[rules.EV06.record] Festival needs a known settlement and an acknowledgement', () => {
  const { draft, snapshot } = resourceEventFixture(34);
  draft.event.occurrences[0]!.targets = [
    { kind: 'settlement', settlementId: 'elsewhere' },
  ];
  draft.acknowledgements = [];
  expect(project(draft, snapshot).event.requirements).toEqual([
    'event:acknowledgement',
    'event:settlement',
  ]);
});
test('[rules.EV07.base] every active PC receives a recorded alchemical item and next week Security two', () => {
  const { draft, snapshot } = resourceEventFixture(22);
  expect(weeklyDraftSchema.safeParse(draft).success).toBe(true);
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.outcome.economy?.items.at(-1)).toMatchObject({
    itemId: 'reward:event',
    ownerCharacterId: 'pc',
    valueCopper: 10000,
  });
  expect(result.queuedEffects).toMatchObject([
    {
      startsWeek: 41,
      endsWeek: 41,
      effect: { kind: 'check_modifier', check: 'security', value: 2 },
    },
  ]);
});
test('[rules.EV07.twice] duplicate Found Fire grants exactly two items per PC and a single Security two', () => {
  const { draft, snapshot } = resourceEventFixture(22, true);
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(
    result.outcome.economy?.items.filter(
      (item) => item.ownerCharacterId === 'pc',
    ),
  ).toHaveLength(2);
  expect(result.queuedEffects).toHaveLength(1);
  expect(result.queuedEffects[0]?.effect).toEqual({
    kind: 'check_modifier',
    check: 'security',
    value: 2,
  });
  expect(project(draft, snapshot).event).toEqual(result);
  expect(snapshot.economy!.items).toHaveLength(1);
});
test('[rules.EV07.record] reward recipient, value and classification matter; explicit exceptions preserve the source', () => {
  const { draft, snapshot } = resourceEventFixture(22);
  const event = draft.event.occurrences[0]!;
  const item = event.rewards![0]!;
  item.poison = true;
  item.valueCopper = 10001;
  expect(project(draft, snapshot).event.requirements).toContain(
    'event:reward:reward:event:exception',
  );
  draft.rulesExceptions.push({
    exceptionId: 'gift',
    subjectId: item.itemId,
    ruleId: 'alchemical-reward',
    reason: 'A narrative gift',
  });
  expect(project(draft, snapshot).event.ready).toBe(true);
  item.characterId = 'outsider';
  expect(project(draft, snapshot).event.requirements).toEqual([
    'event:reward:pc',
    'event:reward:outsider:recipient',
  ]);
  event.rewards = [];
  expect(project(draft, snapshot).event.requirements).toContain(
    'event:reward:pc',
  );
});
test('[rules.EV12.base] Market Day discounts all purchases and services in the chosen town including untracked markets', () => {
  const { draft, snapshot } = resourceEventFixture(38);
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.outcome.economy?.markets).toEqual([]);
  expect(projectEventPurchaseCost(result.outcome, 40, 'town', 10000)).toBe(
    9500,
  );
  expect(projectEventPurchaseCost(result.outcome, 41, 'town', 10000)).toBe(
    10000,
  );
});
test('[rules.EV12.twice] duplicate Market Day covers all operated towns including Broker marketplaces once', () => {
  const { draft, snapshot } = resourceEventFixture(38, true);
  snapshot.settlements.push({
    ...snapshot.settlements[0]!,
    settlementId: 'broker-town',
    name: 'Broker town',
  });
  snapshot.economy!.markets = [
    {
      marketId: 'broker',
      source: 'broker_market',
      settlementId: 'broker-town',
      availableWeek: 40,
      expiresWeek: 40,
      availability: 'small_city',
      availabilityPercent: null,
      salePercent: null,
      contraband: false,
    },
  ];
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.outcome.eventBenefits?.markets).toHaveLength(1);
  expect(
    projectEventPurchaseCost(result.outcome, 40, 'broker-town', 10000),
  ).toBe(9500);
});
test('[rules.EV12.composition] Market Day combines its extra discount with Helpful reputation at copper precision', () => {
  const { draft, snapshot } = resourceEventFixture(38);
  snapshot.settlements[0]!.reputation = 'Helpful';
  const result = project(draft, snapshot).event;
  expect(projectEventPurchaseCost(result.outcome, 40, 'town', 10001)).toBe(
    9026,
  );
});
test('[rules.EV12.inputs] absent or unknown town and absent acknowledgement remain required', () => {
  const { draft, snapshot } = resourceEventFixture(38);
  draft.event.occurrences[0]!.targets = [];
  draft.acknowledgements = [];
  expect(project(draft, snapshot).event.requirements).toEqual([
    'event:acknowledgement',
    'event:settlement',
  ]);
});
test('[rules.EV14.base] Night Ops grants current-week circumstance Stealth only after dark', () => {
  const { draft, snapshot } = resourceEventFixture(14);
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.outcome.eventBenefits?.skills).toMatchObject([
    {
      value: 2,
      bonusType: 'circumstance',
      skills: ['stealth'],
      afterDark: true,
      startsWeek: 40,
      endsWeek: 40,
    },
  ]);
});
test('[rules.EV14.twice] duplicate Night Ops replaces two with five', () => {
  const { draft, snapshot } = resourceEventFixture(14, true);
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.outcome.eventBenefits?.skills).toHaveLength(1);
  expect(result.outcome.eventBenefits?.skills[0]?.value).toBe(5);
});
test('[rules.EV14.record] acknowledging Night Ops is required and remains in the change plan', () => {
  const { draft, snapshot } = resourceEventFixture(14);
  expect(
    project(draft, snapshot).event.plan.some(
      (change) => change.kind === 'event_acknowledgement',
    ),
  ).toBe(true);
  draft.acknowledgements = [];
  expect(project(draft, snapshot).event.requirements).toContain(
    'event:acknowledgement',
  );
});
test('[rules.EV20.disabled] Turn Around recovers all disabled teams without altering missing teams', () => {
  const { draft, snapshot } = resourceEventFixture(30);
  snapshot.roster.teams[0]!.status = 'disabled';
  snapshot.roster.teams[1]!.status = 'missing';
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.outcome.roster.teams.map((team) => team.status)).toEqual([
    'active',
    'missing',
  ]);
  expect(result.outcome.bonuses).toEqual([]);
});
test('[rules.EV20.none] no disabled teams grants one team a single next-Activity check and never recovers it', () => {
  const { draft, snapshot } = resourceEventFixture(30);
  snapshot.roster.teams[0]!.status = 'missing';
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.outcome.roster.teams[0]!.status).toBe('missing');
  const bonus = result.outcome.bonuses[0]!;
  expect(bonus).toMatchObject({
    check: 'any',
    teamId: 'team',
    phase: 'activity',
    value: 2,
    availableWeek: 41,
    consumedWeek: null,
  });
  const input = {
    ...result.outcome,
    week: 41,
    slots: ['first', 'second'].map((choiceId) => ({
      slotId: choiceId,
      choice: {
        choiceId,
        actionId: 'special' as const,
        teamId: 'team',
        instruction: 'A check',
      },
    })),
    operatingSettlementId: null,
    queuedEffects: [],
    checks: [
      {
        checkId: 'first',
        choiceId: 'first',
        phase: 'activity' as const,
        teamId: 'team',
        check: 'security' as const,
        die: 10,
        bonusIds: [bonus.bonusId],
      },
      {
        checkId: 'second',
        choiceId: 'second',
        phase: 'activity' as const,
        teamId: 'team',
        check: 'loyalty' as const,
        die: 10,
        bonusIds: [bonus.bonusId],
      },
    ],
  };
  const checks = projectRulesFoundations(input);
  expect(
    checks.checks[0]?.modifiers.some(
      (modifier) => modifier.source === `bonus:${bonus.bonusId}`,
    ),
  ).toBe(true);
  expect(checks.requirements).toContain(
    `second:bonus:${bonus.bonusId}:unavailable`,
  );
  input.checks[0]!.teamId = 'second-team';
  expect(projectRulesFoundations(input).requirements).toContain(
    `first:bonus:${bonus.bonusId}:unavailable`,
  );
  input.week = 42;
  expect(projectRulesFoundations(input).requirements).toContain(
    `first:bonus:${bonus.bonusId}:unavailable`,
  );
});
test('[rules.EV20.empty] no roster requires a replacement rather than successful silent no-op', () => {
  const { draft, snapshot } = resourceEventFixture(30);
  snapshot.roster.teams = [];
  expect(project(draft, snapshot).event).toMatchObject({
    ready: false,
    requirements: ['event:replacement:1'],
    plan: [],
  });
});
test('[rules.EV20.order] duplicate Turn Around first recovers teams then requires a fresh boost target', () => {
  const { draft, snapshot } = resourceEventFixture(30, true);
  snapshot.roster.teams[0]!.status = 'disabled';
  draft.event.occurrences[2]!.targets = [];
  expect(project(draft, snapshot).event).toMatchObject({
    ready: false,
    requirements: ['second:team'],
  });
  draft.event.occurrences[2]!.targets = [
    { kind: 'team', teamId: 'second-team' },
  ];
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.outcome.bonuses).toMatchObject([
    { source: 'second', teamId: 'second-team' },
  ]);
  expect(
    result.plan.filter((change) => change.kind === 'event_team_recovery'),
  ).toHaveLength(1);
});
test('[rules.EV22.base] War Games adds current projected rank to training', () => {
  const { draft, snapshot } = resourceEventFixture(10);
  expect(project(draft, snapshot).event).toMatchObject({
    ready: true,
    outcome: { training: 33, rank: 3 },
    plan: [{ kind: 'event_training', eventId: 'event', before: 30, after: 33 }],
  });
});
test('[rules.EV22.duplicate] no-Twice War Games duplicates each grant their full training', () => {
  const { draft, snapshot } = resourceEventFixture(10, true);
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.outcome.training).toBe(36);
  expect(
    result.plan.filter((change) => change.kind === 'event_training'),
  ).toMatchObject([
    { eventId: 'first', before: 30, after: 33 },
    { eventId: 'second', before: 33, after: 36 },
  ]);
});
test('[rules.EV22.timing] crossing a rank threshold during Event does not advance rank outside Upkeep', () => {
  const { draft, snapshot } = resourceEventFixture(10, true);
  snapshot.training = 49;
  const result = project(draft, snapshot).event;
  expect(result.outcome).toMatchObject({ training: 55, rank: 3 });
  expect(projectActivity(draft, snapshot).outcome.training).toBe(49);
  draft.event.chanceRoll = roll(100, 100);
  expect(project(draft, snapshot).event.outcome.training).toBe(49);
});

test('[rules.EV12.operation-scope] tracked towns are not fabricated operations; explicit historical context extends eligibility', () => {
  const { draft, snapshot } = resourceEventFixture(38, true);
  snapshot.settlements.push({
    ...snapshot.settlements[0]!,
    settlementId: 'unrelated',
    name: 'Unrelated',
  });
  let result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(projectEventPurchaseCost(result.outcome, 40, 'unrelated', 10000)).toBe(
    10000,
  );
  draft.context = { ...draft.context, operatedSettlementIds: ['unrelated'] };
  expect(weeklyDraftSchema.safeParse(draft).success).toBe(true);
  result = project(draft, snapshot).event;
  expect(projectEventPurchaseCost(result.outcome, 40, 'unrelated', 10000)).toBe(
    9500,
  );
});
test('[rules.EV06.operation-scope] a tracked but unused town is not an eligible Festival target', () => {
  const { draft, snapshot } = resourceEventFixture(34);
  snapshot.settlements.push({
    ...snapshot.settlements[0]!,
    settlementId: 'unrelated',
    name: 'Unrelated',
  });
  draft.event.occurrences[0]!.targets = [
    { kind: 'settlement', settlementId: 'unrelated' },
  ];
  expect(project(draft, snapshot).event.requirements).toContain(
    'event:event-settlement:exception',
  );
  draft.context = { ...draft.context, operatedSettlementIds: ['unrelated'] };
  expect(project(draft, snapshot).event.ready).toBe(true);
});

test('[rules.EV12.settlement-exception] known unoperated targets allow recorded rule exceptions while nonexistent IDs remain invalid', () => {
  for (const value of [34, 38]) {
    const { draft, snapshot } = resourceEventFixture(value);
    snapshot.settlements.push({
      ...snapshot.settlements[0]!,
      settlementId: 'unrelated',
      name: 'Unrelated',
    });
    draft.event.occurrences[0]!.targets = [
      { kind: 'settlement', settlementId: 'unrelated' },
    ];
    expect(project(draft, snapshot).event.requirements).toContain(
      'event:event-settlement:exception',
    );
    draft.rulesExceptions.push({
      exceptionId: 'town',
      subjectId: 'event',
      ruleId: 'event-settlement',
      reason: 'Allied town hosts us',
    });
    expect(project(draft, snapshot).event).toMatchObject({
      ready: true,
      warnings: ['event:event-settlement'],
    });
    draft.event.occurrences[0]!.targets = [
      { kind: 'settlement', settlementId: 'missing' },
    ];
    expect(project(draft, snapshot).event.requirements).toContain(
      'event:settlement',
    );
  }
});

test('[rules.EV12.unselected-town] Market Day remains the rolled event without settlements and waits for a valid chosen town', () => {
  for (const twice of [false, true]) {
    const { draft, snapshot } = resourceEventFixture(38, twice);
    const town = snapshot.settlements[0]!;
    snapshot.settlements = [];
    delete draft.activity.operatingSettlementId;
    for (const event of draft.event.occurrences) event.targets = [];
    const before = structuredClone(draft);
    let result = project(draft, snapshot).event;
    const eventIds = twice ? ['first', 'second'] : ['event'];
    expect(result.selected.map((event) => event.eventId)).toEqual(eventIds);
    expect(result.requirements).toEqual(
      eventIds.map((id) => `${id}:settlement`),
    );
    expect(result.ready).toBe(false);
    expect(draft).toEqual(before);
    snapshot.settlements = [town];
    draft.activity.operatingSettlementId = town.settlementId;
    result = project(draft, snapshot).event;
    // Creating a town does not choose the base occurrence's target implicitly.
    expect(result.ready).toBe(false);
    expect(result.requirements).toContain(`${eventIds[0]}:settlement`);
    for (const event of draft.event.occurrences)
      event.targets = [{ kind: 'settlement', settlementId: town.settlementId }];
    result = project(draft, snapshot).event;
    expect(result.requirements).toEqual([]);
    expect(result.ready).toBe(true);
    expect(result.selected.map((event) => event.eventId)).toEqual(eventIds);
    expect(
      projectEventPurchaseCost(
        result.outcome,
        draft.week,
        town.settlementId,
        10000,
      ),
    ).toBe(9500);
  }
});
