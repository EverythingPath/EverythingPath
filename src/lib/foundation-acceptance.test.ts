import { expect, test } from 'vitest';
import {
  foundationRows,
  foundationWeek,
} from '../../tests/rules/foundation-acceptance-fixtures';
import { roll } from '../../tests/rules/upkeep-fixture';
import {
  projectWeeklyDraft,
  resolveCanonicalWeeklyDraft,
} from './canonical-weekly-resolution';
import { projectRulesFoundations } from './rules-foundations';
import { militiaSnapshotSchema } from './canonical-weekly-source';

function foundations(input: ReturnType<typeof foundationWeek>) {
  return projectRulesFoundations({
    ...input.militiaSnapshot,
    week: input.revision.week,
    slots: input.revision.activity.slots,
    checks: [],
    operatingSettlementId: null,
    queuedEffects: structuredClone([...input.revision.context.queuedEffects]),
  });
}

test('[rules.acceptance.foundation-ranks] all table rows and focuses survive the complete weekly sequence', () => {
  for (const [
    rank,
    training,
    focused,
    secondary,
    actions,
    teams,
  ] of foundationRows) {
    for (const focus of ['Loyalty', 'Secrecy', 'Security'] as const) {
      const input = foundationWeek(rank, focus);
      const before = structuredClone(input);
      const preview = projectWeeklyDraft(input);
      expect(preview.requirements, `${rank}/${focus}`).toEqual([]);
      expect(preview.status).toBe('ready');
      expect(preview.baseline!.militiaSnapshot).toMatchObject({
        rank,
        training,
        focus,
        treasuryCopper: 100000,
        notoriety: 0,
      });
      expect(preview.phases!.upkeep.checks[0]!.modifier).toBe(
        focus === 'Loyalty' ? focused : secondary,
      );
      expect(foundations(input)).toMatchObject({
        capacity: { actions, teams },
        minimumTreasuryCopper: rank * 1000,
        organizationChecks: {
          loyalty: focus === 'Loyalty' ? focused : secondary,
          secrecy: focus === 'Secrecy' ? focused : secondary,
          security: focus === 'Security' ? focused : secondary,
        },
      });
      expect(resolveCanonicalWeeklyDraft(input).outcome).toEqual(
        preview.outcome,
      );
      expect(input).toEqual(before);
    }
  }
});

test('[rules.acceptance.foundation-thresholds] complete Upkeep advances across every boundary and retains rank after loss', () => {
  for (const [rank, threshold] of foundationRows) {
    for (const offset of [-1, 0, 1]) {
      const input = foundationWeek(1);
      input.militiaSnapshot.training = Math.max(0, threshold + offset) + 1;
      const expectedRank = offset < 0 ? Math.max(1, rank - 1) : rank;
      for (let boonRank = 2; boonRank <= expectedRank; boonRank++)
        input.revision.acknowledgements.push({
          acknowledgementId: `boon-${boonRank}`,
          subjectId: `upkeep:boon:${boonRank}:pc`,
          outcome: 'Player recorded the prescribed reward and qualification.',
        });
      const preview = projectWeeklyDraft(input);
      expect(preview.requirements, `${rank}/${offset}`).toEqual([]);
      expect(preview.outcome!.militiaSnapshot.rank).toBe(expectedRank);
      expect(preview.outcome!.militiaSnapshot.training).toBe(
        Math.max(0, threshold + offset),
      );
    }
    const retained = foundationWeek(rank);
    retained.militiaSnapshot.training = 0;
    expect(projectWeeklyDraft(retained).outcome!.militiaSnapshot.rank).toBe(
      rank,
    );
  }
});

test('[rules.acceptance.foundation-focus] absent focus remains required and invalid focus is structurally rejected', () => {
  const input = foundationWeek();
  input.militiaSnapshot.focus = null;
  const preview = projectWeeklyDraft(input);
  expect(preview.status).toBe('incomplete');
  expect(preview.requirements).toContain('focus');
  expect(
    militiaSnapshotSchema.safeParse({
      ...input.militiaSnapshot,
      focus: 'Combat',
    }).success,
  ).toBe(false);
});

test('[rules.acceptance.foundation-boons] every crossed boon names PCs once, requires acknowledgement and retains chosen narrative outcomes', () => {
  const input = foundationWeek(1);
  input.militiaSnapshot.training = 5351;
  input.militiaSnapshot.roster.people.push({
    characterId: 'npc',
    kind: 'npc',
    hitDice: 20,
  });
  input.militiaSnapshot.characters.push({
    ...input.militiaSnapshot.characters[0]!,
    characterId: 'npc',
  });
  const missing = projectWeeklyDraft(input);
  expect(missing.status).toBe('incomplete');
  expect(missing.phases!.upkeep.boons).toHaveLength(19);
  for (const boon of missing.phases!.upkeep.boons) {
    expect(boon.characterIds).toEqual(['pc']);
    expect(missing.requirements).toContain(
      `upkeep:boon:${boon.rank}:pc:acknowledgement`,
    );
    input.revision.acknowledgements.push({
      acknowledgementId: `boon-${boon.rank}`,
      subjectId: `upkeep:boon:${boon.rank}:pc`,
      outcome:
        boon.rank === 19
          ? 'Champion: player confirmed prerequisites for Power Attack and recorded the feat.'
          : `Player recorded rank ${boon.rank} reward.`,
    });
  }
  const resolved = resolveCanonicalWeeklyDraft(input);
  expect(resolved.finalPlan.effects.adjudication.rulesExceptions).toEqual([]);
  input.revision.acknowledgements.find(
    (x) => x.subjectId === 'upkeep:boon:19:pc',
  )!.outcome =
    'Player recorded the feat using the table-approved prerequisite exception.';
  input.revision.rulesExceptions.push({
    exceptionId: 'champion-exception',
    subjectId: 'upkeep:boon:19:pc',
    ruleId: 'champion-qualification',
    reason: 'The table explicitly waives the normal feat prerequisite.',
  });
  const excepted = resolveCanonicalWeeklyDraft(input);
  expect(excepted.finalPlan.effects.adjudication.rulesExceptions).toEqual(
    input.revision.rulesExceptions,
  );
  expect(resolved.outcome!.militiaSnapshot.rank).toBe(20);
  expect(excepted.finalPlan.effects.adjudication.acknowledgements).toEqual(
    input.revision.acknowledgements,
  );
  expect(
    resolved.finalPlan.effects.upkeep.filter((x) => x.kind === 'boon'),
  ).toHaveLength(19);
  expect(resolved.outcome!.militiaSnapshot.characters).toEqual(
    input.militiaSnapshot.characters,
  );
  expect(
    missing
      .phases!.upkeep.boons.filter((x) => x.kind === 'skilled')
      .map((x) => [x.rank, x.skillRanks]),
  ).toEqual([
    [2, 1],
    [7, 1],
    [12, 1],
    [17, 1],
  ]);
});

test('[rules.acceptance.commandants] full-week Drill success, failure and natural-one success use distinct Hit Dice', () => {
  for (const [die, charisma, expectedTraining, notoriety] of [
    [10, 10, 31, 0],
    [2, 10, 15, 0],
    [1, 34, 31, 5],
  ]) {
    const input = foundationWeek(3);
    input.militiaSnapshot.characters[0]!.charisma = charisma!;
    input.militiaSnapshot.roster.officers = [
      { role: 'ambassador', characterId: 'pc' },
      { role: 'commandant', characterId: 'pc' },
      { role: 'commandant', characterId: 'npc' },
    ];
    input.militiaSnapshot.roster.people[0]!.hitDice = 3;
    input.militiaSnapshot.roster.people.push({
      characterId: 'npc',
      kind: 'npc',
      hitDice: 7,
    });
    input.militiaSnapshot.characters.push({
      ...input.militiaSnapshot.characters[0]!,
      characterId: 'npc',
      level: 2,
    });
    input.revision.activity.slots[0]!.choice = {
      choiceId: 'drill',
      actionId: 'drill_militia',
      rolls: {
        check: roll(20, die!),
        training: roll(6, 3, 3),
        notoriety: roll(6, 5),
      },
    };
    const result = resolveCanonicalWeeklyDraft(input);
    expect(result.outcome!.militiaSnapshot).toMatchObject({
      training: expectedTraining,
      notoriety,
      treasuryCopper: 97000,
    });
  }
});

test('[rules.acceptance.officer-abilities] each allowed ability, negative/tied scores, multiple holders and absent identities are explained', () => {
  const roles = [
    ['ambassador', 'loyalty', 'constitution', 'charisma'],
    ['marshal', 'security', 'strength', 'wisdom'],
    ['spymaster', 'secrecy', 'dexterity', 'intelligence'],
  ] as const;
  for (const [role, check, first, second] of roles) {
    for (const [a, b, bonus] of [
      [18, 12, 4],
      [12, 18, 4],
      [6, 8, -1],
      [14, 14, 2],
    ]) {
      const input = foundationWeek(3);
      const pc = input.militiaSnapshot.characters[0]!;
      pc[first] = a!;
      pc[second] = b!;
      input.militiaSnapshot.roster.officers = [{ role, characterId: 'pc' }];
      expect(foundations(input).officers.bonuses[check]).toBe(bonus);
      input.militiaSnapshot.roster.people.push({
        characterId: 'other',
        kind: 'npc',
        hitDice: 1,
      });
      input.militiaSnapshot.characters.push({ ...pc, characterId: 'other' });
      input.militiaSnapshot.roster.officers.push({
        role,
        characterId: 'other',
      });
      expect(foundations(input).officers.bonuses[check]).toBe(bonus);
      input.militiaSnapshot.characters[1]![first] = Math.max(a!, b!) + 2;
      expect(foundations(input).officers.bonuses[check]).toBe(bonus! + 1);
      pc.isActive = false;
      expect(foundations(input).warnings).toContain('officer:pc:archived');
      input.militiaSnapshot.characters = [];
      expect(foundations(input).requirements).toContain('officer:pc:character');
      expect(foundations(input).officers.bonuses[check]).toBe(0);
    }
  }
});

test('[rules.acceptance.overseer] secondary bonuses and Overseer support apply to every check within one selected event occurrence', () => {
  for (const focus of ['Loyalty', 'Secrecy', 'Security'] as const) {
    const input = foundationWeek(3, focus);
    input.militiaSnapshot.roster.officers = [
      { role: 'overseer', characterId: 'pc' },
    ];
    Object.assign(input.militiaSnapshot.characters[0]!, {
      charisma: 18,
      constitution: 12,
      strength: 14,
      wisdom: 20,
      dexterity: 16,
      intelligence: 12,
    });
    const checks = ['loyalty', 'secrecy', 'security', 'loyalty'] as const;
    const project = () =>
      projectRulesFoundations({
        ...input.militiaSnapshot,
        week: 40,
        slots: [],
        operatingSettlementId: null,
        queuedEffects: [],
        checks: ['selected', 'other'].flatMap((eventId) =>
          checks.map((check, index) => ({
            checkId: `${eventId}:${index}`,
            eventId,
            phase: 'event' as const,
            check,
            die: 10,
            overseerCharacterId: 'pc',
          })),
        ),
      });
    const result = project();
    expect(result.checks.map((check) => check.total)).toEqual(
      ['selected', 'other'].flatMap((eventId) =>
        checks.map(
          (check) =>
            10 +
            (focus.toLowerCase() === check ? 3 : 2) +
            (eventId === 'selected'
              ? { loyalty: 4, secrecy: 3, security: 5 }[check]
              : 0),
        ),
      ),
    );
    expect(result.checkUsage.overseerEventId).toBe('selected');
    expect(result.requirements).toEqual(
      checks.map((_, index) => `other:${index}:overseer-already-used`),
    );
    input.militiaSnapshot.roster.officers = [];
    const absent = project();
    expect(absent.checkUsage.overseerEventId).toBeNull();
    expect(absent.requirements).toEqual(
      ['selected', 'other'].flatMap((eventId) =>
        checks.map((_, index) => `${eventId}:${index}:overseer-ineligible`),
      ),
    );
    expect(absent.checks.map((check) => check.total)).toEqual(
      ['selected', 'other'].flatMap(() =>
        checks.map((check) => 10 + (focus.toLowerCase() === check ? 3 : 1)),
      ),
    );
  }
});

test('[rules.acceptance.strategist] multiple holders provide one bonus slot and all checks on only that choice gain two', () => {
  const input = foundationWeek(1);
  input.militiaSnapshot.roster.officers = [
    { role: 'strategist', characterId: 'pc' },
    { role: 'strategist', characterId: 'other' },
  ];
  input.militiaSnapshot.roster.people.push({
    characterId: 'other',
    kind: 'npc',
    hitDice: 1,
  });
  input.militiaSnapshot.characters.push({
    ...input.militiaSnapshot.characters[0]!,
    characterId: 'other',
  });
  input.revision.activity.slots.forEach((slot, i) => {
    slot.choice = { choiceId: `choice-${i}`, actionId: 'drill_militia' };
  });
  const result = projectRulesFoundations({
    ...input.militiaSnapshot,
    week: 40,
    slots: input.revision.activity.slots,
    operatingSettlementId: null,
    queuedEffects: [],
    checks: [0, 1].flatMap((i) =>
      (['loyalty', 'secrecy', 'security'] as const).map((check) => ({
        checkId: `${i}-${check}`,
        phase: 'activity' as const,
        check,
        die: 10,
        choiceId: `choice-${i}`,
      })),
    ),
  });
  expect(result.capacity.actions).toBe(2);
  expect(result.checks.map((x) => x.total)).toEqual([12, 10, 10, 14, 12, 12]);
});

test('[rules.acceptance.manager-checks] independent team identities use their current manager once and preserve reference warnings', () => {
  const input = foundationWeek(3);
  const pc = input.militiaSnapshot.characters[0]!;
  pc.charisma = 16;
  input.militiaSnapshot.characters.push({
    ...pc,
    characterId: 'other',
    charisma: 8,
  });
  input.militiaSnapshot.roster.people.push({
    characterId: 'other',
    kind: 'npc',
    hitDice: 1,
  });
  input.militiaSnapshot.roster.teams = ['one', 'two'].map((teamId, i) => ({
    teamId,
    name: teamId,
    teamType: 'patrons',
    status: 'active',
    managerCharacterId: i === 0 ? 'pc' : 'other',
    rewardCapExempt: false,
    notes: '',
  }));
  input.revision.activity.slots.forEach((slot, i) => {
    slot.choice = {
      choiceId: `choice-${i}`,
      actionId: 'earn_gold',
      teamId: i === 0 ? 'one' : 'two',
    };
  });
  const project = () =>
    projectRulesFoundations({
      ...input.militiaSnapshot,
      week: 40,
      slots: input.revision.activity.slots,
      operatingSettlementId: null,
      queuedEffects: [],
      checks: [0, 1].map((i) => ({
        checkId: `check-${i}`,
        phase: 'activity' as const,
        check: 'loyalty' as const,
        die: 10,
        choiceId: `choice-${i}`,
      })),
    });
  expect(project().checks.map((x) => x.total)).toEqual([16, 13]);
  input.militiaSnapshot.roster.teams[0]!.managerCharacterId = 'other';
  expect(project().checks.map((x) => x.total)).toEqual([13, 13]);
  expect(project().warnings).toContain('manager:other:capacity');
  input.militiaSnapshot.characters[1]!.isActive = false;
  expect(project().warnings).toContain('manager:other:archived');
  input.militiaSnapshot.characters.pop();
  expect(project().requirements).toContain('manager:other:character');
  expect(project().checks.map((x) => x.total)).toEqual([13, 13]);
});

test('[rules.acceptance.reputation-rows] every row exposes social, sighting, operating-event and copper-price facts', () => {
  const input = foundationWeek();
  const rows = [
    ['Hostile', 5, 5, 0, 10501, [1, 4]],
    ['Unfriendly', 2, 0, 5, 10001, null],
    ['Indifferent', 0, 0, 0, 10001, null],
    ['Friendly', -2, 0, -5, 10001, null],
    ['Helpful', 0, -5, 0, 9501, null],
  ] as const;
  for (const [
    reputation,
    socialDcModifier,
    pricePercent,
    eventChanceModifier,
    costCopper,
    sightingDays,
  ] of rows) {
    input.militiaSnapshot.settlements = [
      {
        settlementId: 'town',
        name: 'Town',
        reputation,
        temporaryReputationShift: 0,
        secured: false,
        occupied: true,
        refugeActivatedWeek: null,
        refugeActiveUntilWeek: null,
      },
    ];
    const result = projectRulesFoundations({
      ...input.militiaSnapshot,
      week: 40,
      slots: [],
      checks: [],
      queuedEffects: [],
      operatingSettlementId: 'town',
      purchases: [
        { purchaseId: 'purchase', settlementId: 'town', priceCopper: 10001 },
      ],
    });
    expect(result.settlements[0]).toMatchObject({
      socialDcModifier,
      pricePercent,
      eventChanceModifier,
      sightingDays,
    });
    expect(result.eventChanceModifier).toBe(eventChanceModifier);
    expect(result.purchases[0]!.costCopper).toBe(costCopper);
  }
});

test('[rules.acceptance.notoriety-bounds] additive action effects cap at 100, floor at zero and adjustments follow the baseline', () => {
  const input = foundationWeek(3);
  input.militiaSnapshot.notoriety = 98;
  input.militiaSnapshot.roster.teams = [
    {
      teamId: 'team',
      teamType: 'patrons',
      name: 'Team',
      status: 'active',
      managerCharacterId: null,
      rewardCapExempt: false,
      notes: '',
    },
  ];
  input.revision.activity.slots[0]!.choice = {
    choiceId: 'dismiss',
    actionId: 'dismiss_team',
    targetTeamId: 'team',
    rolls: { check: roll(20, 1), notoriety: roll(6, 5) },
  };
  input.revision.tableAdjustments = [
    {
      adjustmentId: 'override',
      kind: 'militia_value',
      field: 'notoriety',
      operation: 'add',
      value: 7,
      reason: 'Table allows a temporary value above the normal cap.',
    },
  ];
  const result = projectWeeklyDraft(input);
  expect(result.requirements).toEqual([]);
  expect(result.baseline!.militiaSnapshot.notoriety).toBe(100);
  expect(result.outcome!.militiaSnapshot.notoriety).toBe(107);
  input.revision.tableAdjustments = [];
  input.militiaSnapshot.roster.teams.push({
    ...input.militiaSnapshot.roster.teams[0]!,
    teamId: 'remaining',
  });
  input.revision.activity.slots[1]!.choice = {
    choiceId: 'low',
    actionId: 'lie_low',
  };
  input.revision.rulesExceptions.push({
    exceptionId: 'lie-low-exception',
    subjectId: 'low',
    ruleId: 'lie-low-exclusivity',
    reason: 'The table permits a later reduction.',
  });
  expect(
    resolveCanonicalWeeklyDraft(input).baseline!.militiaSnapshot.notoriety,
  ).toBe(99);
  input.revision.activity.slots[1]!.choice = null;
  input.militiaSnapshot.notoriety = 0;
  input.revision.activity.slots[0]!.choice = {
    choiceId: 'low',
    actionId: 'lie_low',
  };
  expect(projectWeeklyDraft(input).baseline!.militiaSnapshot.notoriety).toBe(0);
});

test('[rules.acceptance.team-capacity] all rank caps count missing and disabled identities but exclude rewards at both boundaries', () => {
  for (const [rank, , , , , cap] of foundationRows) {
    const input = foundationWeek(rank);
    input.militiaSnapshot.roster.teams = Array.from(
      { length: cap },
      (_, i) => ({
        teamId: `team-${i}`,
        name: 'Repeated patrons',
        teamType: 'patrons',
        status: (['active', 'disabled', 'missing'] as const)[i % 3]!,
        managerCharacterId: null,
        rewardCapExempt: false,
        notes: '',
      }),
    );
    const first = foundations(input);
    expect(first.capacity.countedTeams).toBe(cap);
    expect(first.warnings).not.toContain('teams:capacity');
    input.militiaSnapshot.roster.teams.push({
      ...input.militiaSnapshot.roster.teams[0]!,
      teamId: 'reward',
      rewardCapExempt: true,
    });
    expect(foundations(input).capacity.countedTeams).toBe(cap);
    expect(foundations(input).warnings).not.toContain('teams:capacity');
    input.militiaSnapshot.roster.teams.push({
      ...input.militiaSnapshot.roster.teams[0]!,
      teamId: 'extra',
    });
    expect(foundations(input).capacity.countedTeams).toBe(cap + 1);
    expect(foundations(input).warnings).toContain('teams:capacity');
    expect(foundations(input).teams.map((x) => x.teamId)).toEqual(
      input.militiaSnapshot.roster.teams.map((x) => x.teamId),
    );
  }
});

test('[rules.acceptance.xp-shares] every XP award divides among active PCs with floor rounding and excludes cohorts and officers', () => {
  const input = foundationWeek(1);
  input.militiaSnapshot.training = 5350;
  for (const characterId of ['second', 'third', 'npc', 'cohort']) {
    input.militiaSnapshot.roster.people.push({
      characterId,
      kind: characterId === 'npc' || characterId === 'cohort' ? 'npc' : 'pc',
      hitDice: 20,
    });
    input.militiaSnapshot.characters.push({
      ...input.militiaSnapshot.characters[0]!,
      characterId,
    });
  }
  const boons = foundations(input).progression.boons;
  expect(
    boons
      .filter((x) => x.kind === 'xp')
      .map((x) => [x.rank, x.xp, x.xpPerPc, x.characterIds]),
  ).toEqual([
    [5, 1200, 400, ['pc', 'second', 'third']],
    [10, 3200, 1066, ['pc', 'second', 'third']],
    [15, 6400, 2133, ['pc', 'second', 'third']],
    [20, 25600, 8533, ['pc', 'second', 'third']],
  ]);
});
