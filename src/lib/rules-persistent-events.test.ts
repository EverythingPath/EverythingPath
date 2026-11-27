import { expect, test } from 'vitest';
import { projectActivityAndEvents } from './rules-event-outcomes';
import { projectActivity } from './rules-activity';
import {
  projectPersistentEvents,
  projectPersistentWeek,
  createPersistentSuccessor,
} from './rules-persistent-events';
import { persistentEventFixture } from '../../tests/rules/persistent-event-fixture';
import { roll } from '../../tests/rules/upkeep-fixture';
import { pair } from '../../tests/rules/event-selection-fixture';
import { weeklyDraftSchema } from './weekly-draft-contract';
function project(...args: Parameters<typeof projectActivityAndEvents>) {
  const event = projectActivityAndEvents(...args).event;
  return { event, persistent: projectPersistentEvents(args[0], event) };
}
test('[rules.P01.oldest] decisions use stable oldest-first instance order rather than their input order', () => {
  const { draft, snapshot } = persistentEventFixture('low_morale');
  const base = draft.context.carriedEvents[0]!;
  draft.context = {
    ...draft.context,
    carriedEvents: [
      { ...base, eventId: 'new', startedWeek: 2, order: 0 },
      { ...base, eventId: 'tie-later', order: 2 },
      { ...base, eventId: 'old', order: 1 },
    ],
  };
  draft.persistent.decisions = [
    { eventId: 'new', kind: 'buyoff' },
    { eventId: 'old', kind: 'buyoff' },
  ];
  const result = project(draft, snapshot).persistent;
  expect(
    result.plan
      .filter((entry) => entry.kind === 'persistent_buyoff')
      .map((entry) => entry.eventId),
  ).toEqual(['old']);
  expect(result.persistentEvents.map((entry) => entry.eventId)).toEqual([
    'tie-later',
    'new',
  ]);
  expect(result.requirements).toContain('new:buyoff-cooldown:exception');
});
test('[rules.P01.eligibility] fixed eligibility survives endings and same-week persistence without adding the phase', () => {
  const { draft, snapshot } = persistentEventFixture('double_agent');
  draft.persistent.decisions = [{ eventId: 'carried', kind: 'buyoff' }];
  expect(project(draft, snapshot).persistent.eligible).toBe(true);
  draft.context = {
    ...draft.context,
    carriedEvents: [],
    persistentPhaseEligible: false,
  };
  draft.persistent.decisions = [];
  draft.event.occurrences = pair(98);
  const result = project(draft, snapshot);
  expect(result.persistent.eligible).toBe(false);
  expect(result.persistent.persistentEvents).toHaveLength(1);
  const next = createPersistentSuccessor(
    draft,
    result.event,
    result.persistent,
    'next',
    [],
  );
  expect(next.draft.context.persistentPhaseEligible).toBe(true);
});
test.each(['bluff', 'diplomacy', 'intimidate'] as const)(
  '[rules.P02.rivalry.%s] week-two through four targets remain restricted until officer twenty permanently ends',
  (skill) => {
    let { draft, snapshot } = persistentEventFixture();
    for (const week of [2, 3, 4]) {
      expect(draft.week).toBe(week);
      draft.activity.slots = [
        {
          slotId: 'one',
          choice: {
            choiceId: 'work',
            actionId: 'special',
            teamId: 'team',
            instruction: 'Patrol',
          },
        },
      ];
      expect(projectActivity(draft, snapshot).requirements).toContain(
        'work:team-unavailable:exception',
      );
      draft.activity.slots = [];
      draft.persistent.decisions =
        week === 2
          ? []
          : [
              {
                eventId: 'carried',
                kind: 'mitigate',
                officerCheck: {
                  characterId: 'pc',
                  skill,
                  skillBonus: 0,
                  roll: roll(20, week === 4 ? 20 : 19),
                },
              },
            ];
      const { event, persistent } = project(draft, snapshot);
      expect(persistent.ready).toBe(true);
      expect(persistent.persistentEvents).toHaveLength(week === 4 ? 0 : 1);
      const next = createPersistentSuccessor(
        draft,
        event,
        persistent,
        `week-${week + 1}`,
        [],
      );
      draft = next.draft;
      snapshot = next.outcome;
      draft.event.chanceRoll = roll(100, 100);
    }
    draft.activity.slots = [
      {
        slotId: 'one',
        choice: {
          choiceId: 'work',
          actionId: 'special',
          teamId: 'team',
          instruction: 'Patrol',
        },
      },
    ];
    expect(projectActivity(draft, snapshot).requirements).not.toContain(
      'work:team-unavailable:exception',
    );
  },
);
test('[rules.P02.optional] absent mitigation is valid; an incomplete officer attempt retains targets and blocks readiness', () => {
  const { draft, snapshot } = persistentEventFixture();
  expect(project(draft, snapshot).persistent.ready).toBe(true);
  draft.persistent.decisions = [
    {
      eventId: 'carried',
      kind: 'mitigate',
      officerCheck: { characterId: 'pc', skill: 'bluff', skillBonus: 0 },
    },
  ];
  const result = project(draft, snapshot).persistent;
  expect(result.ready).toBe(false);
  expect(result.requirements).toContain('carried:officer:1d20');
  expect(result.persistentEvents[0]?.targets).toHaveLength(2);
});
test('[rules.P02.weekly] Theft mitigation recomputes current incoming gains, retains principal and expires next week', () => {
  const { draft, snapshot } = persistentEventFixture('theft');
  snapshot.training = 15;
  draft.upkeep.treasuryTransfers = [
    {
      transferId: 'income',
      direction: 'deposit',
      copper: 1000,
    },
  ];
  const unmitigated = projectPersistentWeek(draft, snapshot);
  draft.persistent.decisions = [
    { eventId: 'carried', kind: 'mitigate', rolls: { check: roll(20, 20) } },
  ];
  const mitigated = projectPersistentWeek(draft, snapshot);
  expect(
    mitigated.ready,
    [
      ...mitigated.upkeep.requirements,
      ...mitigated.persistent.requirements,
    ].join(','),
  ).toBe(true);
  expect(
    mitigated.persistent.outcome.treasuryCopper -
      unmitigated.persistent.outcome.treasuryCopper,
  ).toBe(400);
  expect(mitigated.persistent.persistentEvents).toHaveLength(1);
  expect(mitigated.persistent.persistentEvents[0]?.mitigation).toEqual({
    week: 2,
    retainedIncomePercent: 90,
  });
  const next = createPersistentSuccessor(
    draft,
    mitigated.event,
    mitigated.persistent,
    'next',
    [],
  );
  expect(next.draft.context.carriedEvents[0]?.mitigation).toBeUndefined();
  expect(next.draft.persistent.decisions).toEqual([]);
  next.draft.event.chanceRoll = roll(100, 100);
  next.draft.upkeep.rolls.check = roll(20, 19);
  next.draft.upkeep.rolls.training = roll(6, 1);
  next.draft.upkeep.treasuryTransfers = draft.upkeep.treasuryTransfers;
  expect(
    projectPersistentWeek(next.draft, next.outcome).persistent.outcome
      .treasuryCopper,
  ).toBe(next.outcome.treasuryCopper + 500);
});
test('[rules.P03.first] first buyoff is immediate, costs twice current minimum, and remains a pure staged result', () => {
  const { draft, snapshot } = persistentEventFixture('low_morale');
  const source = structuredClone({ draft, snapshot });
  draft.persistent.decisions = [{ eventId: 'carried', kind: 'buyoff' }];
  const result = project(draft, snapshot).persistent;
  expect(result.ready).toBe(true);
  expect(result.buyoffCostCopper).toBe(6000);
  expect(result.outcome.treasuryCopper).toBe(snapshot.treasuryCopper - 6000);
  expect(result.lastBuyoffWeek).toBe(2);
  expect(result.nextBuyoffWeek).toBe(6);
  expect(result.persistentEvents).toEqual([]);
  expect(snapshot).toEqual(source.snapshot);
  expect(draft.context).toEqual(source.draft.context);
});
test.each([5, 6])(
  '[rules.P03.cooldown.%s] cooldown is shared across different event identities',
  (week) => {
    const { draft, snapshot } = persistentEventFixture('double_agent');
    draft.week = week;
    draft.context = { ...draft.context, lastBuyoffWeek: 2 };
    draft.persistent.decisions = [{ eventId: 'carried', kind: 'buyoff' }];
    const result = project(draft, snapshot).persistent;
    expect(result.ready).toBe(week === 6);
    expect(result.persistentEvents).toHaveLength(week === 6 ? 0 : 1);
  },
);
test('[rules.P03.cost] insufficient funds need a reason and an exception preserves computed cost', () => {
  const { draft, snapshot } = persistentEventFixture('theft');
  snapshot.rank = 5;
  snapshot.treasuryCopper = 1;
  draft.persistent.decisions = [{ eventId: 'carried', kind: 'buyoff' }];
  let result = project(draft, snapshot).persistent;
  expect(result.requirements).toContain('carried:treasury:exception');
  expect(result.outcome.treasuryCopper).toBe(1);
  draft.rulesExceptions = [
    {
      exceptionId: 'spend',
      subjectId: 'carried',
      ruleId: 'treasury',
      reason: 'Sponsor covers deficit',
    },
  ];
  result = project(draft, snapshot).persistent;
  expect(result.ready).toBe(true);
  expect(result.outcome.treasuryCopper).toBe(-9999);
});
test('[rules.P01.identity] same-type instances keep distinct targets and ending only releases the selected instance', () => {
  const { draft, snapshot } = persistentEventFixture();
  const base = draft.context.carriedEvents[0]!;
  draft.context = {
    ...draft.context,
    carriedEvents: [base, { ...base, eventId: 'other', order: 1 }],
  };
  draft.persistent.decisions = [{ eventId: 'carried', kind: 'buyoff' }];
  const { event, persistent } = project(draft, snapshot);
  expect(persistent.persistentEvents.map((entry) => entry.eventId)).toEqual([
    'other',
  ]);
  const next = createPersistentSuccessor(draft, event, persistent, 'next', []);
  expect(next.draft.context.carriedEvents[0]?.targets).toEqual(base.targets);
  expect(weeklyDraftSchema.safeParse(next.draft).success).toBe(true);
});
test.each([
  { name: 'empty', targets: [] },
  {
    name: 'deleted',
    targets: [
      { kind: 'team' as const, teamId: 'team' },
      { kind: 'team' as const, teamId: 'absent' },
    ],
  },
])(
  '[rules.P01.targets.$name] absent or deleted Rivalry targets remain incomplete even without a mitigation attempt',
  ({ targets }) => {
    const { draft, snapshot } = persistentEventFixture();
    draft.context = {
      ...draft.context,
      carriedEvents: [{ ...draft.context.carriedEvents[0]!, targets }],
    };
    const result = project(draft, snapshot).persistent;
    expect(result.ready).toBe(false);
    expect(result.requirements).toContain('carried:teams');
  },
);
test('[rules.P02.order] buying off oldest Low Morale changes a later Theft mitigation check without changing already resolved phases', () => {
  const { draft, snapshot } = persistentEventFixture('low_morale');
  snapshot.focus = 'Loyalty';
  draft.context = {
    ...draft.context,
    carriedEvents: [
      draft.context.carriedEvents[0]!,
      {
        eventId: 'thief',
        eventType: 'theft',
        startedWeek: 2,
        order: 1,
        targets: [],
      },
    ],
  };
  draft.persistent.decisions = [
    { eventId: 'thief', kind: 'mitigate', rolls: { check: roll(20, 17) } },
  ];
  expect(project(draft, snapshot).persistent.plan).toContainEqual({
    kind: 'persistent_mitigation',
    eventId: 'thief',
    week: 2,
    total: 18,
    dc: 20,
    succeeded: false,
  });
  draft.persistent.decisions.push({ eventId: 'carried', kind: 'buyoff' });
  expect(project(draft, snapshot).persistent.plan).toContainEqual({
    kind: 'persistent_mitigation',
    eventId: 'thief',
    week: 2,
    total: 20,
    dc: 20,
    succeeded: true,
  });
});
test('[rules.P02.successor] successor discards expired queues and mitigation while retaining future automatic rolls without execution', () => {
  const { draft, snapshot } = persistentEventFixture('theft');
  draft.context = {
    ...draft.context,
    queuedEffects: [
      {
        effectId: 'old',
        sourceId: 'old',
        startsWeek: 1,
        endsWeek: 2,
        effect: { kind: 'check_modifier', check: 'loyalty', value: 5 },
      },
      {
        effectId: 'future',
        sourceId: 'storm',
        startsWeek: 3,
        endsWeek: 3,
        effect: { kind: 'automatic_events', count: 2 },
      },
    ],
  };
  const { event, persistent } = project(draft, snapshot);
  const next = createPersistentSuccessor(draft, event, persistent, 'next', []);
  expect(
    next.draft.context.queuedEffects.map((entry) => entry.effectId),
  ).toEqual(['future']);
  expect(next.draft.event.occurrences).toEqual([]);
  expect(next.outcome.treasuryCopper).toBe(snapshot.treasuryCopper);
  expect(next.draft.week).toBe(3);
  expect(next.draft.context.startDay).toBe(14);
  expect(next.draft.context.firstMilitiaWeek).toBe(false);
});
test('[rules.P02.ending] recorded narrative ending requires a matching acknowledgement and reasoned exception', () => {
  const { draft, snapshot } = persistentEventFixture('double_agent');
  draft.persistent.decisions = [
    {
      kind: 'end',
      eventId: 'carried',
      acknowledgement: {
        acknowledgementId: 'end',
        subjectId: 'carried',
        outcome: 'The spy was exposed in play',
      },
    },
  ];
  expect(project(draft, snapshot).persistent.requirements).toContain(
    'carried:persistent-ending:exception',
  );
  draft.rulesExceptions = [
    {
      exceptionId: 'end',
      subjectId: 'carried',
      ruleId: 'persistent-ending',
      reason: 'Recorded adventure outcome',
    },
  ];
  const result = project(draft, snapshot).persistent;
  expect(result.ready).toBe(true);
  expect(result.persistentEvents).toEqual([]);
  expect(result.plan[0]).toMatchObject({
    kind: 'persistent_ended',
    reason: 'recorded',
    acknowledgement: { outcome: 'The spy was exposed in play' },
  });
});
test('[rules.P02.upkeep-return] ordinary Upkeep recovery stays missing during Activity and returns once at week end', () => {
  const { draft, snapshot } = persistentEventFixture('low_morale');
  snapshot.training = 10;
  snapshot.roster.teams[0]!.status = 'missing';
  draft.upkeep.teamDecisions = [
    { teamId: 'team', decision: 'recover', roll: roll(20, 20) },
  ];
  const result = projectPersistentWeek(draft, snapshot);
  expect(
    result.ready,
    [...result.upkeep.requirements, ...result.persistent.requirements].join(
      ',',
    ),
  ).toBe(true);
  expect(result.activity.outcome.roster.teams[0]?.status).toBe('missing');
  expect(result.persistent.outcome.roster.teams[0]?.status).toBe('active');
  expect(
    createPersistentSuccessor(
      draft,
      result.event,
      result.persistent,
      'next',
      [],
    ).outcome.roster.teams[0]?.status,
  ).toBe('active');
});
test('[rules.P02.incomplete-upkeep] successor preparation cannot advance a partial upstream Upkeep result', () => {
  const { draft, snapshot } = persistentEventFixture('theft');
  snapshot.training = 10;
  delete draft.upkeep.rolls.check;
  const result = projectPersistentWeek(draft, snapshot);
  expect(result.ready).toBe(false);
  expect(result.persistent.ready).toBe(false);
  expect(() =>
    createPersistentSuccessor(
      draft,
      result.event,
      result.persistent,
      'next',
      [],
    ),
  ).toThrow('ready projection');
});
