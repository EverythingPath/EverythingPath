import { expect, test } from 'vitest';
import { upkeepFixture, roll } from '../../tests/rules/upkeep-fixture';
import { createWeeklyDraft } from './weekly-draft';
import { projectUpkeep } from './rules-upkeep';
import { weekStartFactsSchema } from './weekly-draft-contract';

test('[rules.U01.first-use] first use skips every Upkeep effect even at displayed week 40', () => {
  const { draft, snapshot } = upkeepFixture();
  const first = createWeeklyDraft({
    draftId: draft.draftId,
    week: 40,
    slotIds: [],
    context: weekStartFactsSchema
      .strip()
      .parse({ ...draft.context, firstMilitiaWeek: true }),
  });
  first.upkeep.rolls = {
    check: roll(20, 20),
    training: roll(6, 6),
    loss: roll(4, 4, 4),
  };
  first.upkeep.treasuryTransfers = [
    {
      transferId: 'deposit',
      direction: 'deposit',
      copper: 1000,
    },
  ];
  const before = structuredClone(snapshot);
  const result = projectUpkeep(first, snapshot);
  expect(result.skipped).toBe(true);
  expect(result.ready).toBe(true);
  expect(result.outcome).toEqual(snapshot);
  expect(result.plan).toEqual([]);
  expect(result.boons).toEqual([]);
  expect(snapshot).toEqual(before);
  expect(Object.isFrozen(first.context)).toBe(true);
});

test('[rules.U02.success] Loyalty DC10 loses the entered d6, with no automatic natural-one failure', () => {
  const { draft, snapshot } = upkeepFixture();
  draft.upkeep.rolls = { check: roll(20, 7), training: roll(6, 6) };
  expect(projectUpkeep(draft, snapshot).outcome.training).toBe(24);
  snapshot.characters[0]!.charisma = 22;
  draft.upkeep.rolls.check = roll(20, 1);
  expect(projectUpkeep(draft, snapshot).outcome.training).toBe(24);
});

test('[rules.U02.failure] DC9 loses 2d4 plus the week-start rank', () => {
  const { draft, snapshot } = upkeepFixture();
  draft.upkeep.rolls = { check: roll(20, 6), training: roll(4, 4, 4) };
  expect(projectUpkeep(draft, snapshot).outcome.training).toBe(19);
});

test('[rules.U02.natural-twenty] the natural die grants d6 training even with a negative Loyalty modifier', () => {
  const { draft, snapshot } = upkeepFixture();
  snapshot.characters[0]!.charisma = 0;
  snapshot.characters[0]!.constitution = 0;
  draft.upkeep.rolls = { check: roll(20, 20), training: roll(6, 6) };
  expect(projectUpkeep(draft, snapshot).outcome.training).toBe(36);
  draft.upkeep.rolls.check = roll(20, 17);
  snapshot.characters[0]!.charisma = 10;
  expect(projectUpkeep(draft, snapshot).outcome.training).toBe(24);
});

test('[rules.U02.modifiers] queued loss effects and annotated check modifiers apply once, never to a natural-20 gain', () => {
  const { draft, snapshot } = upkeepFixture();
  const withPain = createWeeklyDraft({
    draftId: draft.draftId,
    week: 40,
    slotIds: [],
    context: weekStartFactsSchema.strip().parse({
      ...draft.context,
      queuedEffects: [
        {
          effectId: 'pain-check',
          sourceId: 'pain',
          startsWeek: 40,
          endsWeek: 40,
          effect: { kind: 'check_modifier', check: 'loyalty', value: -1 },
        },
        {
          effectId: 'pain-loss',
          sourceId: 'pain',
          startsWeek: 40,
          endsWeek: 40,
          effect: { kind: 'upkeep_loss_multiplier', value: 2 },
        },
        {
          effectId: 'pain-again',
          sourceId: 'pain',
          startsWeek: 40,
          endsWeek: 40,
          effect: { kind: 'upkeep_loss_multiplier', value: 2 },
        },
        {
          effectId: 'expired',
          sourceId: 'old',
          startsWeek: 38,
          endsWeek: 39,
          effect: { kind: 'check_modifier', check: 'loyalty', value: -10 },
        },
      ],
    }),
  });
  withPain.upkeep.rolls = {
    check: {
      ...roll(20, 8),
      modifiers: [
        { sourceId: 'queued:pain', value: -1, reason: 'Week of Pain' },
      ],
    },
    training: roll(6, 4),
  };
  let result = projectUpkeep(withPain, snapshot);
  expect(result.checks[0]?.total).toBe(10);
  expect(result.outcome.training).toBe(22);
  withPain.upkeep.rolls.check = roll(20, 20);
  result = projectUpkeep(withPain, snapshot);
  expect(result.outcome.training).toBe(34);
});

test('[rules.U03.threshold] only maximum Notoriety applies its own d20 loss and DC15 check', () => {
  const { draft, snapshot } = upkeepFixture();
  draft.upkeep.rolls = {
    check: roll(20, 7),
    training: roll(6, 1),
    notoriety: roll(20, 20),
  };
  draft.upkeep.notorietyCheck = roll(20, 12);
  snapshot.notoriety = 99;
  expect(projectUpkeep(draft, snapshot).outcome.training).toBe(29);
  snapshot.notoriety = 100;
  const result = projectUpkeep(draft, snapshot);
  expect(result.outcome.training).toBe(6);
  expect(result.checks.map((check) => check.total)).toEqual([10, 15]);
  expect(result.plan).toContainEqual({
    kind: 'training',
    step: 'notoriety',
    before: 29,
    after: 6,
  });
});

test('[rules.U03.reputation] DC14 lowers the selected nearest settlement without worsening Hostile or Unfriendly', () => {
  const expected = [
    'Hostile',
    'Unfriendly',
    'Unfriendly',
    'Indifferent',
    'Friendly',
  ];
  for (const [index, reputation] of (
    ['Hostile', 'Unfriendly', 'Indifferent', 'Friendly', 'Helpful'] as const
  ).entries()) {
    const { draft, snapshot } = upkeepFixture();
    snapshot.notoriety = 100;
    snapshot.settlements = [
      {
        settlementId: 'nearest',
        name: 'Phaendar',
        reputation,
        secured: false,
        occupied: false,
        temporaryReputationShift: null,
        refugeActivatedWeek: null,
        refugeActiveUntilWeek: null,
      },
    ];
    draft.upkeep.rolls = {
      check: roll(20, 7),
      training: roll(6, 1),
      notoriety: roll(20, 1),
    };
    draft.upkeep.notorietyCheck = roll(20, 11);
    draft.upkeep.nearestSettlementId = 'nearest';
    const result = projectUpkeep(draft, snapshot);
    expect(result.outcome.settlements[0]?.reputation).toBe(expected[index]);
    expect(snapshot.settlements[0]?.reputation).toBe(reputation);
  }
});

test('[rules.U04.shortage] disabled recovery is paid before rolled treasury shortage and deposits cannot erase the loss', () => {
  const { draft, snapshot } = upkeepFixture();
  snapshot.roster.teams = [
    {
      teamId: 'team',
      teamType: 'patrons',
      name: 'Patrons',
      status: 'disabled',
      rewardCapExempt: false,
      managerCharacterId: null,
      notes: '',
    },
  ];
  draft.upkeep.teamDecisions = [{ teamId: 'team', decision: 'recover' }];
  draft.upkeep.rolls = {
    check: roll(20, 7),
    training: roll(6, 1),
    loss: roll(4, 4, 4),
  };
  draft.upkeep.treasuryTransfers = [
    {
      transferId: 'deposit',
      direction: 'deposit',
      copper: 3001,
    },
  ];
  const result = projectUpkeep(draft, snapshot);
  expect(result.outcome.training).toBe(18);
  expect(result.outcome.treasuryCopper).toBe(3001);
  expect(result.outcome.roster.teams[0]?.status).toBe('active');
  expect(
    result.plan
      .filter((change) => change.kind === 'treasury')
      .map((change) => change.after),
  ).toEqual([0, 3001]);
});

test('[rules.U04.rank] multi-rank progression uses post-loss training and the highest active PC cap', () => {
  const { draft, snapshot } = upkeepFixture();
  draft.upkeep.rolls = { check: roll(20, 7), training: roll(6, 6) };
  let result = projectUpkeep(draft, snapshot);
  expect(result.outcome.rank).toBe(4);
  snapshot.training = 81;
  snapshot.characters[0]!.level = 6;
  result = projectUpkeep(draft, snapshot);
  expect(result.outcome.rank).toBe(6);
  expect(result.boons.map((boon) => boon.rank)).toEqual([4, 5, 6]);
  expect(snapshot.rank).toBe(3);
  expect(result.plan.find((change) => change.kind === 'rank')).toEqual({
    kind: 'rank',
    before: 3,
    after: 6,
  });
  snapshot.training = 0;
  expect(projectUpkeep(draft, snapshot).outcome.rank).toBe(3);
});

test('[rules.U04.boons] every crossed PC boon requires its own recorded reward acknowledgement', () => {
  const { draft, snapshot } = upkeepFixture();
  snapshot.rank = 1;
  snapshot.training = 41;
  snapshot.roster.people.push({
    characterId: 'npc',
    kind: 'npc',
    hitDice: 20,
  });
  snapshot.characters.push({
    ...snapshot.characters[0]!,
    characterId: 'npc',
    level: 20,
  });
  draft.upkeep.rolls = { check: roll(20, 8), training: roll(6, 1) };
  const result = projectUpkeep(draft, snapshot);
  expect(
    result.boons.map((boon) => [boon.rank, boon.kind, boon.characterIds]),
  ).toEqual([
    [2, 'skilled', ['pc']],
    [3, 'gift', ['pc']],
    [4, 'title', ['pc']],
    [5, 'xp', ['pc']],
    [6, 'gift', ['pc']],
  ]);
  expect(result.ready).toBe(false);
  expect(result.requirements).toEqual(
    [2, 3, 4, 5, 6].map((rank) => `upkeep:boon:${rank}:pc:acknowledgement`),
  );
  for (const rank of [2, 3, 4, 5, 6])
    draft.acknowledgements.push({
      acknowledgementId: `ack-${rank}`,
      subjectId: `upkeep:boon:${rank}:pc`,
      outcome: 'Reward recorded on character sheet',
    });
  const accepted = projectUpkeep(draft, snapshot);
  expect(accepted.ready).toBe(true);
  expect(accepted.plan.filter((change) => change.kind === 'boon')).toHaveLength(
    5,
  );
  expect(accepted.plan).toContainEqual(
    expect.objectContaining({
      kind: 'boon',
      subjectId: 'upkeep:boon:5:pc',
      acknowledgement: draft.acknowledgements[3],
    }),
  );
  expect(projectUpkeep(draft, snapshot)).toEqual(accepted);
  const next = projectUpkeep(draft, accepted.outcome);
  expect(next.boons).toEqual([]);
});

test('[rules.T08.return] missing teams return only at week end; a natural one permanently loses the individual team', () => {
  const { draft, snapshot } = upkeepFixture();
  snapshot.training = 15;
  snapshot.roster.teams = ['returning', 'lost', 'still-missing'].map(
    (teamId) => ({
      teamId,
      teamType: 'patrons',
      name: teamId,
      status: 'missing',
      rewardCapExempt: false,
      managerCharacterId: null,
      notes: '',
    }),
  );
  draft.upkeep.rolls = { check: roll(20, 7), training: roll(6, 1) };
  draft.upkeep.teamDecisions = [
    { teamId: 'returning', decision: 'recover', roll: roll(20, 14) },
    { teamId: 'lost', decision: 'recover', roll: roll(20, 1) },
    { teamId: 'still-missing', decision: 'recover', roll: roll(20, 13) },
  ];
  const result = projectUpkeep(draft, snapshot);
  expect(
    result.outcome.roster.teams.map((team) => [team.teamId, team.status]),
  ).toEqual([
    ['returning', 'missing'],
    ['still-missing', 'missing'],
  ]);
  expect(result.plan).toContainEqual({
    kind: 'team_status',
    teamId: 'returning',
    status: 'active',
    timing: 'end',
  });
  expect(result.plan).toContainEqual({ kind: 'remove_team', teamId: 'lost' });
  expect(result.ready).toBe(true);
});

test('[rules.U02.provenance] entered modifiers augment raw dice while computed and one-use sources are never counted twice', () => {
  const { draft, snapshot } = upkeepFixture();
  snapshot.notoriety = 100;
  snapshot.training = 15;
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
  draft.upkeep.rolls = {
    check: {
      ...roll(20, 5),
      modifiers: [
        { sourceId: 'rank-focus', value: 3, reason: 'Rank' },
        { sourceId: 'bonus:reward', value: 2, reason: 'Story award' },
        { sourceId: 'table:morale', value: 1, reason: 'Encouragement' },
      ],
    },
    training: roll(6, 1),
    notoriety: roll(20, 1),
  };
  draft.upkeep.notorietyCheck = {
    ...roll(20, 12),
    modifiers: [{ sourceId: 'bonus:reward', value: 2, reason: 'Story award' }],
  };
  const result = projectUpkeep(draft, snapshot);
  expect(result.checks.map((check) => check.total)).toEqual([11, 15]);
  expect(result.requirements).toContain(
    'upkeep:notoriety:bonus:reward:unavailable',
  );
  expect(result.checkUsage.bonusIds).toEqual(['reward']);
  expect(snapshot.bonuses[0]?.consumedWeek).toBeNull();
});

test('[rules.U02.readiness] missing dice never invent a loss, rank increase, or Activity gain', () => {
  const { draft, snapshot } = upkeepFixture();
  draft.upkeep.rolls.training = roll(6, 6);
  draft.activity.slots[0]!.choice = {
    choiceId: 'drill',
    actionId: 'drill_militia',
    rolls: { training: roll(6, 6) },
  };
  let result = projectUpkeep(draft, snapshot);
  expect(result.ready).toBe(false);
  expect(result.requirements).toContain('upkeep:attrition:roll');
  expect(result.outcome.training).toBe(30);
  expect(result.outcome.rank).toBe(3);
  draft.upkeep.rolls.check = roll(20, 7);
  delete draft.upkeep.rolls.training;
  result = projectUpkeep(draft, snapshot);
  expect(result.requirements).toContain('upkeep:attrition-training:roll');
  expect(result.boons).toEqual([]);
  draft.upkeep.rolls.training = roll(4, 2, 2);
  expect(projectUpkeep(draft, snapshot).requirements).toContain(
    'upkeep:attrition-training:dice:1d6',
  );
});

test('[rules.U03.inputs] maximum Notoriety requires an independent loss, check and known target reputation', () => {
  const { draft, snapshot } = upkeepFixture();
  snapshot.notoriety = 100;
  draft.upkeep.rolls = { check: roll(20, 7), training: roll(6, 1) };
  let result = projectUpkeep(draft, snapshot);
  expect(result.requirements).toEqual(
    expect.arrayContaining([
      'upkeep:notoriety-training:roll',
      'upkeep:notoriety:roll',
    ]),
  );
  draft.upkeep.rolls.notoriety = roll(20, 1);
  draft.upkeep.notorietyCheck = roll(20, 11);
  result = projectUpkeep(draft, snapshot);
  expect(result.requirements).toContain('upkeep:notoriety:nearest-settlement');
  expect(result.outcome.rank).toBe(3);
  draft.upkeep.nearestSettlementId = 'unknown';
  expect(projectUpkeep(draft, snapshot).ready).toBe(false);
});

test('[rules.U04.boundary] a copper below the starting minimum incurs shortage; exact minimum and later withdrawals do not', () => {
  const { draft, snapshot } = upkeepFixture();
  snapshot.training = 15;
  draft.upkeep.rolls = {
    check: roll(20, 7),
    training: roll(6, 1),
    loss: roll(4, 1, 1),
  };
  draft.upkeep.treasuryTransfers = [
    {
      transferId: 'withdraw',
      direction: 'withdraw',
      copper: 1,
    },
  ];
  expect(projectUpkeep(draft, snapshot).outcome).toMatchObject({
    training: 14,
    treasuryCopper: 2999,
  });
  snapshot.treasuryCopper = 2999;
  draft.upkeep.treasuryTransfers = [
    {
      transferId: 'deposit',
      direction: 'deposit',
      copper: 1,
    },
  ];
  expect(projectUpkeep(draft, snapshot).outcome).toMatchObject({
    training: 9,
    treasuryCopper: 3000,
  });
});

test('[rules.U01.import] an imported later-use militia executes Upkeep even when the displayed week is one', () => {
  const { draft, snapshot } = upkeepFixture();
  draft.week = 1;
  draft.upkeep.rolls = { check: roll(20, 7), training: roll(6, 4) };
  const result = projectUpkeep(draft, snapshot);
  expect(result.skipped).toBe(false);
  expect(result.outcome.training).toBe(26);
});

test('[rules.U02.consumption] used check bonuses appear in the staged plan and are unavailable to later phases', () => {
  const { draft, snapshot } = upkeepFixture();
  snapshot.training = 15;
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
  draft.upkeep.rolls = {
    check: {
      ...roll(20, 5),
      modifiers: [
        { sourceId: 'bonus:reward', value: 2, reason: 'Story award' },
      ],
    },
    training: roll(6, 1),
  };
  const result = projectUpkeep(draft, snapshot);
  expect(result.outcome.bonuses[0]?.consumedWeek).toBe(40);
  expect(result.plan).toContainEqual({
    kind: 'consume_bonus',
    bonusId: 'reward',
    week: 40,
  });
  expect(snapshot.bonuses[0]?.consumedWeek).toBeNull();
});

test('[rules.U01.recompute] changed attrition recomputes later capacity without discarding a staged extra choice', async () => {
  const { projectRulesFoundations } = await import('./rules-foundations');
  const { draft, snapshot } = upkeepFixture();
  snapshot.rank = 1;
  snapshot.training = 10;
  draft.activity.slots[1]!.choice = {
    choiceId: 'extra',
    actionId: 'earn_gold',
    teamId: 'patrons',
  };
  draft.upkeep.rolls = { check: roll(20, 20), training: roll(6, 1) };
  const laterFacts = () =>
    projectRulesFoundations({
      ...projectUpkeep(draft, snapshot).outcome,
      week: draft.week,
      slots: draft.activity.slots,
      checks: [],
      operatingSettlementId: null,
      queuedEffects: [],
    });
  expect(laterFacts().capacity.actions).toBe(2);
  draft.upkeep.rolls.check = roll(20, 8);
  expect(laterFacts().capacity.actions).toBe(1);
  expect(laterFacts().slots[1]).toMatchObject({
    overAllowance: true,
    choice: { choiceId: 'extra', actionId: 'earn_gold' },
  });
  expect(snapshot.training).toBe(10);
});

test('[rules.U05.order] staged copper transfers follow the post-loss rank increase and leave the source unchanged', () => {
  const { draft, snapshot } = upkeepFixture();
  draft.upkeep.rolls = { check: roll(20, 7), training: roll(6, 1) };
  draft.upkeep.treasuryTransfers = [
    {
      transferId: 'deposit',
      direction: 'deposit',
      copper: 501,
    },
    {
      transferId: 'withdraw',
      direction: 'withdraw',
      copper: 250,
    },
  ];
  const result = projectUpkeep(draft, snapshot);
  expect(result.outcome).toMatchObject({
    rank: 4,
    training: 29,
    treasuryCopper: 3251,
  });
  expect(result.plan.map((change) => change.kind)).toEqual([
    'training',
    'rank',
    'boon',
    'treasury',
    'treasury',
  ]);
  expect(snapshot.treasuryCopper).toBe(3000);
});

test('[rules.U03.recompute] reducing starting Notoriety ignores stale maximum-penalty rolls and target', () => {
  const { draft, snapshot } = upkeepFixture();
  draft.upkeep.rolls = {
    check: roll(20, 7),
    training: roll(6, 1),
    notoriety: roll(20, 20),
  };
  draft.upkeep.notorietyCheck = roll(20, 1);
  snapshot.notoriety = 100;
  expect(projectUpkeep(draft, snapshot).requirements).toContain(
    'upkeep:notoriety:nearest-settlement',
  );
  snapshot.notoriety = 99;
  const result = projectUpkeep(draft, snapshot);
  expect(result.requirements).not.toContain(
    'upkeep:notoriety:nearest-settlement',
  );
  expect(result.outcome.training).toBe(29);
  expect(
    result.plan.some((change) => change.kind === 'settlement_reputation'),
  ).toBe(false);
});

test('[rules.U05.preview] carried persistent Theft withholds half of incoming deposits once at copper precision', () => {
  const { draft: original, snapshot } = upkeepFixture();
  const draft = createWeeklyDraft({
    draftId: original.draftId,
    week: 40,
    slotIds: [],
    context: weekStartFactsSchema.strip().parse({
      ...original.context,
      carriedEvents: [
        {
          eventId: 'theft',
          eventType: 'theft',
          startedWeek: 39,
          order: 0,
          targets: [],
        },
        {
          eventId: 'duplicate-theft',
          eventType: 'theft',
          startedWeek: 39,
          order: 1,
          targets: [],
        },
      ],
    }),
  });
  snapshot.training = 15;
  draft.upkeep.rolls = { check: roll(20, 7), training: roll(6, 1) };
  draft.upkeep.treasuryTransfers = [
    {
      transferId: 'deposit',
      direction: 'deposit',
      copper: 501,
    },
  ];
  const result = projectUpkeep(draft, snapshot);
  expect(result.outcome.treasuryCopper).toBe(3251);
  expect(result.plan).toContainEqual({
    kind: 'treasury',
    sourceId: 'theft:theft:deposit',
    before: 3501,
    after: 3251,
  });
});

test('[rules.U04.recovery-inputs] a decision for an unknown team cannot silently disappear from readiness', () => {
  const { draft, snapshot } = upkeepFixture();
  snapshot.training = 15;
  draft.upkeep.rolls = { check: roll(20, 7), training: roll(6, 1) };
  draft.upkeep.teamDecisions = [{ teamId: 'unknown', decision: 'recover' }];
  const result = projectUpkeep(draft, snapshot);
  expect(result.requirements).toContain('team:unknown:reference');
  expect(result.ready).toBe(false);
});

test('[rules.U02.sources] officer and queued annotations cannot reapply an included or expired modifier', () => {
  const { draft: original, snapshot } = upkeepFixture();
  snapshot.training = 15;
  snapshot.characters[0]!.charisma = 14;
  const draft = createWeeklyDraft({
    draftId: original.draftId,
    week: 40,
    slotIds: [],
    context: weekStartFactsSchema.strip().parse({
      ...original.context,
      queuedEffects: [
        {
          effectId: 'penalty',
          sourceId: 'event',
          startsWeek: 40,
          endsWeek: 40,
          effect: { kind: 'check_modifier', check: 'loyalty', value: -1 },
        },
        {
          effectId: 'old-penalty',
          sourceId: 'old',
          startsWeek: 39,
          endsWeek: 39,
          effect: { kind: 'check_modifier', check: 'loyalty', value: -5 },
        },
      ],
    }),
  });
  draft.upkeep.rolls = {
    check: {
      ...roll(20, 6),
      modifiers: [
        { sourceId: 'pc', value: 2, reason: 'Ambassador' },
        { sourceId: 'penalty', value: -1, reason: 'Event' },
        { sourceId: 'queued:old', value: -5, reason: 'Expired event' },
      ],
    },
    training: roll(6, 1),
  };
  expect(projectUpkeep(draft, snapshot).checks[0]?.total).toBe(10);
});

test('[rules.T07.funds] recovery exposes insufficient funds and permits a reasoned exception without changing its baseline cost', () => {
  const { draft, snapshot } = upkeepFixture();
  snapshot.training = 15;
  snapshot.treasuryCopper = 100;
  snapshot.roster.teams = [
    {
      teamId: 'disabled',
      teamType: 'patrons',
      name: 'Patrons',
      status: 'disabled',
      managerCharacterId: null,
      rewardCapExempt: false,
      notes: '',
    },
  ];
  draft.upkeep.teamDecisions = [
    { teamId: 'disabled', decision: 'recover', costCopper: 0 },
  ];
  draft.upkeep.rolls = {
    check: roll(20, 7),
    training: roll(6, 1),
    loss: roll(4, 1, 1),
  };
  let result = projectUpkeep(draft, snapshot);
  expect(result.outcome.treasuryCopper).toBe(-2900);
  expect(result.warnings).toContain('team:disabled:recovery-funds');
  expect(result.warnings).toContain('team:disabled:recovery-cost-baseline');
  expect(result.ready).toBe(false);
  draft.rulesExceptions = [
    {
      exceptionId: 'credit',
      subjectId: 'disabled',
      ruleId: 'upkeep-recovery-funds',
      reason: 'The local smith extends credit',
    },
  ];
  result = projectUpkeep(draft, snapshot);
  expect(result.ready).toBe(true);
  expect(result.outcome.treasuryCopper).toBe(-2900);
});

test('[rules.U02.persistent-morale] carried Low Morale affects both Loyalty checks once, with or without a matching queue', () => {
  const { draft: original, snapshot } = upkeepFixture();
  snapshot.notoriety = 100;
  snapshot.training = 30;
  for (const queued of [false, true]) {
    const draft = createWeeklyDraft({
      draftId: original.draftId,
      week: 40,
      slotIds: [],
      context: weekStartFactsSchema.strip().parse({
        ...original.context,
        carriedEvents: [
          {
            eventId: 'morale',
            eventType: 'low_morale',
            startedWeek: 38,
            order: 0,
            targets: [],
          },
        ],
        queuedEffects: queued
          ? [
              {
                effectId: 'morale-queue',
                sourceId: 'morale',
                startsWeek: 40,
                endsWeek: 40,
                effect: {
                  kind: 'check_modifier',
                  check: 'loyalty',
                  value: -2,
                },
              },
            ]
          : [],
      }),
    });
    draft.upkeep.rolls = {
      check: roll(20, 8),
      training: roll(4, 1, 1),
      notoriety: roll(20, 1),
    };
    draft.upkeep.notorietyCheck = roll(20, 13);
    const result = projectUpkeep(draft, snapshot);
    expect(result.checks.map((check) => check.total)).toEqual([9, 14]);
    expect(result.outcome.training).toBe(21);
    expect(result.requirements).toContain(
      'upkeep:notoriety:nearest-settlement',
    );
  }
});

test('[rules.T08.manager-scope] a missing team return check receives no manager bonus', () => {
  const { draft, snapshot } = upkeepFixture();
  snapshot.training = 15;
  snapshot.roster.officers = [];
  snapshot.characters[0]!.charisma = 18;
  snapshot.roster.teams = [
    {
      teamId: 'missing',
      teamType: 'patrons',
      name: 'Patrons',
      status: 'missing',
      rewardCapExempt: false,
      managerCharacterId: 'pc',
      notes: '',
    },
  ];
  draft.upkeep.rolls = { check: roll(20, 7), training: roll(6, 1) };
  draft.upkeep.teamDecisions = [
    { teamId: 'missing', decision: 'recover', roll: roll(20, 10) },
  ];
  const result = projectUpkeep(draft, snapshot);
  expect(result.checks[0]?.total).toBe(11);
  expect(result.plan.some((change) => change.kind === 'team_status')).toBe(
    false,
  );
  expect(result.outcome.roster.teams[0]?.status).toBe('missing');
  draft.upkeep.teamDecisions[0]!.roll = roll(20, 14);
  expect(projectUpkeep(draft, snapshot).plan).toContainEqual({
    kind: 'team_status',
    teamId: 'missing',
    status: 'active',
    timing: 'end',
  });
});

test('[rules.U05.overdraft] each withdrawal checks running funds and requires its own reasoned exception', () => {
  const { draft, snapshot } = upkeepFixture();
  snapshot.training = 15;
  draft.upkeep.rolls = { check: roll(20, 7), training: roll(6, 1) };
  draft.upkeep.treasuryTransfers = [
    {
      transferId: 'withdraw',
      direction: 'withdraw',
      copper: 3100,
    },
  ];
  let result = projectUpkeep(draft, snapshot);
  expect(result.outcome.treasuryCopper).toBe(-100);
  expect(result.warnings).toContain('transfer:withdraw:funds');
  expect(result.requirements).toContain('transfer:withdraw:funds-exception');
  expect(result.ready).toBe(false);
  draft.rulesExceptions = [
    {
      exceptionId: 'credit',
      subjectId: 'withdraw',
      ruleId: 'upkeep-transfer-funds',
      reason: 'The table approves a loan',
    },
  ];
  result = projectUpkeep(draft, snapshot);
  expect(result.ready).toBe(true);
  expect(result.outcome.treasuryCopper).toBe(-100);
  draft.rulesExceptions = [];
  draft.upkeep.treasuryTransfers.unshift({
    transferId: 'deposit',
    direction: 'deposit',
    copper: 100,
  });
  expect(projectUpkeep(draft, snapshot)).toMatchObject({
    ready: true,
    warnings: [],
    outcome: { treasuryCopper: 0 },
  });
  draft.upkeep.treasuryTransfers.reverse();
  expect(projectUpkeep(draft, snapshot).requirements).toContain(
    'transfer:withdraw:funds-exception',
  );
  expect(snapshot.treasuryCopper).toBe(3000);
});

test('[rules.U05.officer-exception] transfers need no officer: a transfer resolves without a ruling, and a retired officer ruling stays recorded but inert', () => {
  const { draft, snapshot } = upkeepFixture();
  snapshot.training = 15;
  snapshot.roster.officers = [];
  draft.upkeep.rolls = { check: roll(20, 7), training: roll(6, 1) };
  const oldRuling = {
    exceptionId: 'approved',
    subjectId: 'transfer',
    ruleId: 'upkeep-transfer-officer',
    reason: 'The officers delegate this transfer',
  };
  for (const direction of ['deposit', 'withdraw'] as const) {
    for (const exceptions of [[], [oldRuling]]) {
      draft.upkeep.treasuryTransfers = [
        { transferId: 'transfer', direction, copper: 100 },
      ];
      draft.rulesExceptions = exceptions;
      const result = projectUpkeep(draft, snapshot);
      expect(result.ready).toBe(true);
      expect(result.requirements).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.outcome.treasuryCopper).toBe(
        direction === 'deposit' ? 3100 : 2900,
      );
      expect(draft.rulesExceptions).toEqual(exceptions);
    }
  }
});

test('[rules.U05.characterless] deposits and withdrawals resolve in staged order with no roster, officers or character, and their plan entries name no one', () => {
  const { draft, snapshot } = upkeepFixture();
  snapshot.training = 15;
  snapshot.roster = { people: [], officers: [], teams: [] };
  snapshot.characters = [];
  draft.upkeep.rolls = { check: roll(20, 7), training: roll(6, 1) };
  draft.upkeep.treasuryTransfers = [
    { transferId: 'zero', direction: 'deposit', copper: 0 },
    { transferId: 'deposit', direction: 'deposit', copper: 7 },
    { transferId: 'withdraw', direction: 'withdraw', copper: 3007 },
    { transferId: 'overdraft', direction: 'withdraw', copper: 1 },
  ];
  const result = projectUpkeep(draft, snapshot);
  expect(result.outcome.treasuryCopper).toBe(-1);
  expect(
    result.plan.flatMap((change) =>
      change.kind === 'treasury' ? [change] : [],
    ),
  ).toEqual([
    {
      kind: 'treasury',
      sourceId: 'zero',
      before: 3000,
      after: 3000,
    },
    {
      kind: 'treasury',
      sourceId: 'deposit',
      before: 3000,
      after: 3007,
    },
    {
      kind: 'treasury',
      sourceId: 'withdraw',
      before: 3007,
      after: 0,
    },
    {
      kind: 'treasury',
      sourceId: 'overdraft',
      before: 0,
      after: -1,
    },
  ]);
  // Only the withdrawal beyond the running treasury needs its ruling; with no
  // player character the rank cap still asks for one, as before.
  expect(result.warnings).toEqual(['transfer:overdraft:funds']);
  expect(result.requirements).toEqual([
    'highest-level-pc',
    'transfer:overdraft:funds-exception',
  ]);
});
