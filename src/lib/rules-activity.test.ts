import { actionChoiceRolls } from './weekly-draft-facts';
import { expect, test } from 'vitest';
import { activityFixture } from '../../tests/rules/activity-fixture';
import { upkeepFixture, roll } from '../../tests/rules/upkeep-fixture';
import { projectActivity } from './rules-activity';

test('[rules.A06.failure] failed dismissal removes its target and adds rolled Notoriety', () => {
  const { draft, snapshot } = upkeepFixture();
  snapshot.roster.teams.push({
    teamId: 'old',
    teamType: 'patrons',
    name: 'Old',
    status: 'active',
    managerCharacterId: null,
    rewardCapExempt: false,
    notes: '',
  });
  draft.activity.slots[0]!.choice = {
    choiceId: 'dismiss',
    actionId: 'dismiss_team',
    targetTeamId: 'old',
    rolls: { check: roll(20, 6), notoriety: roll(6, 4) },
  };
  const result = projectActivity(draft, snapshot);
  expect(result.outcome.roster.teams).toEqual([]);
  expect(result.outcome.notoriety).toBe(4);
  expect(result.plan).toContainEqual({
    kind: 'remove_team',
    choiceId: 'dismiss',
    teamId: 'old',
  });
  expect(result.ready).toBe(true);
});

test('[rules.A07.success] successful staged Drill pays baseline cost and adds rolled training plus Commandant Hit Dice', () => {
  const { draft, snapshot } = upkeepFixture();
  snapshot.roster.officers.push({ role: 'commandant', characterId: 'pc' });
  draft.activity.slots[0]!.choice = {
    choiceId: 'drill',
    actionId: 'drill_militia',
    rolls: { check: roll(20, 10), training: roll(6, 2, 5) },
  };
  const result = projectActivity(draft, snapshot);
  expect(result.outcome.training).toBe(47);
  expect(result.outcome.treasuryCopper).toBe(0);
  expect(result.ready).toBe(true);
});

test('[rules.A06.capacity] dismissal frees capacity for recruitment in either order, preserving separate team identities', () => {
  const { draft, snapshot } = upkeepFixture();
  snapshot.rank = 1;
  snapshot.roster.officers.push({ role: 'strategist', characterId: 'pc' });
  snapshot.roster.teams.push(
    {
      teamId: 'old',
      teamType: 'patrons',
      name: 'Old',
      status: 'active',
      managerCharacterId: null,
      rewardCapExempt: false,
      notes: '',
    },
    {
      teamId: 'other',
      teamType: 'patrons',
      name: 'Other',
      status: 'active',
      managerCharacterId: null,
      rewardCapExempt: false,
      notes: '',
    },
  );
  draft.activity.slots[0]!.choice = {
    choiceId: 'dismiss',
    actionId: 'dismiss_team',
    targetTeamId: 'old',
    rolls: { check: roll(20, 8), notoriety: roll(6, 3) },
  };
  draft.activity.slots[1]!.choice = {
    choiceId: 'recruit',
    actionId: 'recruit_team',
    teamType: 'patrons',
    rolls: { check: roll(20, 10) },
  };
  const result = projectActivity(draft, snapshot);
  expect(result.outcome.roster.teams.map((team) => team.teamId)).toEqual([
    'other',
    'recruit:recruit',
  ]);
  expect(result.ready).toBe(true);
  draft.activity.slots.reverse();
  const reversed = projectActivity(draft, snapshot);
  expect(reversed.ready).toBe(true);
  expect(reversed.outcome.roster.teams).toEqual(result.outcome.roster.teams);
});

test('[rules.A24.tree] Upgrade preserves identity and manager, charges the listed edge cost, and prohibits a second upgrade', () => {
  const { draft, snapshot } = upkeepFixture();
  snapshot.treasuryCopper = 30000;
  snapshot.roster.teams.push({
    teamId: 'team',
    teamType: 'patrons',
    name: 'Our team',
    status: 'active',
    managerCharacterId: 'pc',
    rewardCapExempt: true,
    notes: 'Keep',
  });
  draft.activity.slots[0]!.choice = {
    choiceId: 'upgrade',
    actionId: 'upgrade_team',
    targetTeamId: 'team',
    toTeamType: 'merchants',
  };
  let result = projectActivity(draft, snapshot);
  expect(result.outcome.treasuryCopper).toBe(25000);
  expect(result.outcome.roster.teams[0]).toEqual({
    ...snapshot.roster.teams[0],
    teamType: 'merchants',
  });
  draft.activity.slots[1]!.choice = {
    choiceId: 'again',
    actionId: 'upgrade_team',
    targetTeamId: 'team',
    toTeamType: 'fixers',
  };
  result = projectActivity(draft, snapshot);
  expect(result.requirements).toContain('again:team-upgrade-limit:exception');
  expect(result.outcome.roster.teams[0]!.teamType).toBe('merchants');
});

test('[rules.A04.order] changing to Strategist grants a later bonus action; removal retains the choice and blocks submission', () => {
  const { draft, snapshot } = upkeepFixture();
  snapshot.rank = 1;
  draft.activity.slots[0]!.choice = {
    choiceId: 'role',
    actionId: 'change_officer_role',
    characterId: 'pc',
    fromRole: 'ambassador',
    toRole: 'strategist',
  };
  draft.activity.slots[1]!.choice = {
    choiceId: 'drill',
    actionId: 'drill_militia',
    rolls: { check: roll(20, 8), training: roll(6, 2, 3) },
  };
  let result = projectActivity(draft, snapshot);
  expect(result.outcome.roster.officers).toEqual([
    { role: 'strategist', characterId: 'pc' },
  ]);
  expect(result.outcome.training).toBe(35);
  expect(result.checks[0]!.total).toBe(12);
  expect(result.ready).toBe(true);
  snapshot.roster.officers = [{ role: 'strategist', characterId: 'pc' }];
  draft.activity.slots[0]!.choice = {
    choiceId: 'role',
    actionId: 'change_officer_role',
    characterId: 'pc',
    fromRole: 'strategist',
    toRole: 'ambassador',
  };
  result = projectActivity(draft, snapshot);
  expect(result.requirements).toContain('drill:action-capacity');
  expect(result.slots[1]!.choice?.choiceId).toBe('drill');
  expect(result.outcome.training).toBe(30);
});

test('[rules.A12.exclusivity] Lie Low counts all teams and requires a reasoned exception alongside other actions', () => {
  const { draft, snapshot } = upkeepFixture();
  snapshot.notoriety = 3;
  snapshot.roster.teams.push({
    teamId: 'team',
    teamType: 'patrons',
    name: 'Team',
    status: 'missing',
    managerCharacterId: null,
    rewardCapExempt: true,
    notes: '',
  });
  draft.activity.slots[0]!.choice = { choiceId: 'low', actionId: 'lie_low' };
  expect(projectActivity(draft, snapshot).outcome.notoriety).toBe(2);
  draft.activity.slots[1]!.choice = {
    choiceId: 'role',
    actionId: 'change_officer_role',
    characterId: 'pc',
    fromRole: 'ambassador',
  };
  expect(projectActivity(draft, snapshot).requirements).toContain(
    'low:lie-low-exclusivity:exception',
  );
  draft.rulesExceptions.push({
    exceptionId: 'exception',
    subjectId: 'low',
    ruleId: 'lie-low-exclusivity',
    reason: 'Table ruling',
  });
  expect(projectActivity(draft, snapshot).outcome.notoriety).toBe(2);
  expect(projectActivity(draft, snapshot).ready).toBe(true);
});

test('[rules.T06.drill-once] duplicate Drill and maximum rank need exceptions without changing baseline arithmetic', () => {
  const { draft, snapshot } = upkeepFixture();
  snapshot.treasuryCopper = 10000;
  snapshot.characters[0]!.level = 3;
  const drill = {
    choiceId: 'first',
    actionId: 'drill_militia' as const,
    rolls: { check: roll(20, 15), training: roll(6, 2, 3) },
  };
  draft.activity.slots[0]!.choice = drill;
  draft.activity.slots[1]!.choice = { ...drill, choiceId: 'second' };
  let result = projectActivity(draft, snapshot);
  expect(result.requirements).toContain('first:maximum-rank:exception');
  expect(result.requirements).toContain('second:drill-limit:exception');
  draft.rulesExceptions = ['first', 'second'].flatMap((subjectId) => [
    {
      exceptionId: subjectId,
      subjectId,
      ruleId: 'maximum-rank',
      reason: 'Training beyond cap',
    },
    ...(subjectId === 'second'
      ? [
          {
            exceptionId: 'repeat',
            subjectId,
            ruleId: 'drill-limit',
            reason: 'Extra drill',
          },
        ]
      : []),
  ]);
  result = projectActivity(draft, snapshot);
  expect(result.outcome.training).toBe(40);
  expect(result.outcome.treasuryCopper).toBe(4000);
  expect(result.ready).toBe(true);
});

test('[rules.A07.natural-one] natural one can succeed, calculated and entered sources count once, and missing dice remain required', () => {
  const { draft, snapshot } = upkeepFixture();
  snapshot.characters[0]!.charisma = 34;
  const raw = roll(20, 1);
  raw.modifiers = [
    { sourceId: 'officers', value: 12, reason: 'Already calculated' },
    { sourceId: 'table', value: 1, reason: 'Circumstance' },
  ];
  draft.activity.slots[0]!.choice = {
    choiceId: 'drill',
    actionId: 'drill_militia',
    rolls: { check: raw, training: roll(6, 3, 4), notoriety: roll(6, 5) },
  };
  let result = projectActivity(draft, snapshot);
  expect(result.checks[0]!.total).toBe(17);
  expect(result.outcome.training).toBe(37);
  expect(result.outcome.notoriety).toBe(5);
  delete draft.activity.slots[0]!.choice.rolls!.training;
  result = projectActivity(draft, snapshot);
  expect(result.ready).toBe(false);
  expect(result.outcome.training).toBe(30);
  draft.activity.slots[0]!.choice = null;
  expect(projectActivity(draft, snapshot).outcome).toEqual(snapshot);
});

test('[rules.A07.natural-one-only] Drill needs its notoriety roll only on a natural 1 and ignores one kept from an earlier natural 1', () => {
  const { draft, snapshot } = upkeepFixture();
  const drill = (check: number, notoriety?: number) => {
    draft.activity.slots[0]!.choice = {
      choiceId: 'drill',
      actionId: 'drill_militia',
      rolls: {
        check: roll(20, check),
        training: roll(6, 2, 5),
        ...(notoriety === undefined ? {} : { notoriety: roll(6, notoriety) }),
      },
    };
    return projectActivity(draft, snapshot);
  };
  const needed = drill(1);
  expect(needed.requirements).toContain('drill:notoriety:1d6');
  expect(needed.ready).toBe(false);
  for (const check of [2, 10, 20]) {
    const without = drill(check);
    const stale = drill(check, 6);
    expect(without.requirements).not.toContain('drill:notoriety:1d6');
    for (const key of [
      'outcome',
      'plan',
      'requirements',
      'warnings',
      'ready',
    ] as const)
      expect(stale[key]).toEqual(without[key]);
    expect(stale.outcome.notoriety).toBe(snapshot.notoriety);
  }
  expect(drill(1, 6).outcome.notoriety).toBe(snapshot.notoriety + 6);
});

test('Activity keeps missing action rolls unready and enforces assigned team usage after upgrades', () => {
  const { draft, snapshot } = upkeepFixture();
  snapshot.treasuryCopper = 20000;
  snapshot.roster.teams.push({
    teamId: 'team',
    teamType: 'patrons',
    name: 'Team',
    status: 'active',
    managerCharacterId: null,
    rewardCapExempt: false,
    notes: '',
  });
  draft.activity.slots[0]!.choice = {
    choiceId: 'upgrade',
    actionId: 'upgrade_team',
    targetTeamId: 'team',
    toTeamType: 'merchants',
  };
  draft.activity.slots[1]!.choice = {
    choiceId: 'earn',
    actionId: 'earn_gold',
    teamId: 'team',
  };
  const result = projectActivity(draft, snapshot);
  expect(result.requirements).toContain('earn:team-action-limit:exception');
  expect(result.ready).toBe(false);
  draft.activity.slots[0]!.choice = null;
  expect(projectActivity(draft, snapshot).requirements).toContain(
    'earn:check:1d20',
  );
  draft.activity.slots[1]!.choice = {
    choiceId: 'partial',
    actionId: 'dismiss_team',
  };
  expect(projectActivity(draft, snapshot).requirements).toContain(
    'partial:target-team',
  );
});

test('Exceptional higher-tier recruitment requires an explicit check and DC, while ordinary recruitment keeps its baseline', () => {
  const { draft, snapshot } = upkeepFixture();
  draft.activity.slots[0]!.choice = {
    choiceId: 'recruit',
    actionId: 'recruit_team',
    teamType: 'merchants',
    rolls: { check: roll(20, 15) },
  };
  draft.rulesExceptions.push({
    exceptionId: 'tier',
    subjectId: 'recruit',
    ruleId: 'recruit-tier',
    reason: 'Veterans join',
  });
  expect(projectActivity(draft, snapshot).requirements).toContain(
    'recruit:recruitment-check',
  );
  draft.activity.slots[0]!.choice.recruitmentCheck = {
    check: 'loyalty',
    dc: 15,
  };
  expect(
    projectActivity(draft, snapshot).outcome.roster.teams[0]!.teamType,
  ).toBe('merchants');
  draft.activity.slots[0]!.choice.teamType = 'patrons';
  draft.activity.slots[0]!.choice.recruitmentCheck.dc = 100;
  expect(
    projectActivity(draft, snapshot).outcome.roster.teams[0]!.teamType,
  ).toBe('patrons');
});

test('Activity reserves and records one-use bonuses in its baseline plan', () => {
  const { draft, snapshot } = upkeepFixture();
  snapshot.bonuses.push({
    bonusId: 'reward',
    source: 'event',
    check: 'loyalty',
    value: 4,
    availableWeek: 40,
    consumedWeek: null,
  });
  const raw = roll(20, 6);
  raw.modifiers = [{ sourceId: 'bonus:reward', value: 4, reason: 'Reward' }];
  draft.activity.slots[0]!.choice = {
    choiceId: 'recruit',
    actionId: 'recruit_team',
    teamType: 'patrons',
    rolls: { check: raw },
  };
  const result = projectActivity(draft, snapshot);
  expect(result.checks[0]!.total).toBe(13);
  expect(result.outcome.bonuses[0]!.consumedWeek).toBe(40);
  expect(result.plan).toContainEqual({
    kind: 'consume_bonus',
    bonusId: 'reward',
    week: 40,
  });
  expect(snapshot.bonuses[0]!.consumedWeek).toBe(null);
});

test.each([
  ['patrons', 7, 6],
  ['informants', 7, 6],
  ['moles', 14, 13],
  ['defenders', 14, 13],
] as const)(
  '[rules.A14.checks.%s] recruitment uses its own check and DC',
  (teamType, success, failure) => {
    const { draft, snapshot } = upkeepFixture();
    draft.activity.slots[0]!.choice = {
      choiceId: 'recruit',
      actionId: 'recruit_team',
      teamType,
      rolls: { check: roll(20, success) },
    };
    expect(
      projectActivity(draft, snapshot).outcome.roster.teams[0]?.teamType,
    ).toBe(teamType);
    draft.activity.slots[0]!.choice.rolls!.check = roll(20, failure);
    expect(projectActivity(draft, snapshot).outcome.roster.teams).toEqual([]);
  },
);

test('[rules.A14.natural-one] recruitment natural one can succeed but adds Notoriety', () => {
  const { draft, snapshot } = upkeepFixture();
  snapshot.characters[0]!.charisma = 24;
  draft.activity.slots[0]!.choice = {
    choiceId: 'recruit',
    actionId: 'recruit_team',
    teamType: 'patrons',
    rolls: { check: roll(20, 1), notoriety: roll(6, 6) },
  };
  const result = projectActivity(draft, snapshot);
  expect(result.outcome.roster.teams).toHaveLength(1);
  expect(result.outcome.notoriety).toBe(6);
});

test('[rules.A24.warning] upgrade exceptions allow insufficient funds and a different tree while references remain required', () => {
  const { draft, snapshot } = upkeepFixture();
  snapshot.roster.teams = [
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
  draft.activity.slots[0]!.choice = {
    choiceId: 'upgrade',
    actionId: 'upgrade_team',
    targetTeamId: 'team',
    toTeamType: 'propagandists',
    costCopper: 1,
  };
  expect(projectActivity(draft, snapshot).requirements).toContain(
    'upgrade:upgrade-tree:exception',
  );
  draft.rulesExceptions = ['upgrade-tree', 'treasury'].map((ruleId) => ({
    exceptionId: ruleId,
    subjectId: 'upgrade',
    ruleId,
    reason: 'Table exception',
  }));
  const result = projectActivity(draft, snapshot);
  expect(result.ready).toBe(true);
  expect(result.outcome.treasuryCopper).toBe(-22000);
  expect(result.outcome.roster.teams[0]!.teamType).toBe('propagandists');
  expect(result.warnings).toContain('upgrade:calculated-cost');
  draft.activity.slots[0]!.choice.targetTeamId = 'unknown';
  expect(projectActivity(draft, snapshot).requirements).toContain(
    'upgrade:target-team',
  );
});

test('[rules.A04.pc] NPC role changes require exceptions; unassigning preserves people and characters', () => {
  const { draft, snapshot } = upkeepFixture();
  snapshot.roster.people[0]!.kind = 'npc';
  draft.activity.slots[0]!.choice = {
    choiceId: 'role',
    actionId: 'change_officer_role',
    characterId: 'pc',
    fromRole: 'ambassador',
  };
  expect(projectActivity(draft, snapshot).requirements).toContain(
    'role:officer-pc:exception',
  );
  draft.rulesExceptions = [
    {
      exceptionId: 'npc',
      subjectId: 'role',
      ruleId: 'officer-pc',
      reason: 'Ally agrees',
    },
  ];
  const result = projectActivity(draft, snapshot);
  expect(result.outcome.roster.officers).toEqual([]);
  expect(result.outcome.roster.people).toEqual(snapshot.roster.people);
  expect(result.outcome.characters).toEqual(snapshot.characters);
});

test('[rules.A04.manager-limit] leaving an NPC’s last role mid-week needs a Rules Exception when it leaves them over their new manager limit', () => {
  const { draft, snapshot } = upkeepFixture();
  snapshot.roster.people[0]!.kind = 'npc';
  snapshot.characters[0]!.charisma = 16;
  snapshot.roster.teams = ['one', 'two'].map((teamId) => ({
    teamId,
    teamType: 'patrons' as const,
    name: teamId,
    status: 'active' as const,
    managerCharacterId: 'pc',
    rewardCapExempt: false,
    notes: '',
  }));
  draft.activity.slots[0]!.choice = {
    choiceId: 'role',
    actionId: 'change_officer_role',
    characterId: 'pc',
    fromRole: 'ambassador',
  };
  const officerPc = {
    exceptionId: 'npc',
    subjectId: 'role',
    ruleId: 'officer-pc',
    reason: 'Ally agrees',
  };
  draft.rulesExceptions = [officerPc];
  const blocked = projectActivity(draft, snapshot);
  expect(blocked.requirements).toContain('role:manager-limit:exception');
  expect(blocked.outcome.roster.officers).toEqual(snapshot.roster.officers);
  draft.rulesExceptions = [
    officerPc,
    {
      exceptionId: 'limit',
      subjectId: 'role',
      ruleId: 'manager-limit',
      reason: 'The table keeps both teams with her',
    },
  ];
  const allowed = projectActivity(draft, snapshot);
  expect(allowed.requirements).toEqual([]);
  expect(allowed.outcome.roster.officers).toEqual([]);
  // Her teams and managers stay; the later roster warns about her new limit.
  expect(allowed.outcome.roster.teams).toEqual(snapshot.roster.teams);
  expect(allowed.warnings).toContain('role:manager-limit');
  // A later team check sees her lowered limit; an earlier one does not.
  const earn = {
    choiceId: 'earn',
    actionId: 'earn_gold' as const,
    teamId: 'one',
    rolls: { check: roll(20, 10) },
  };
  draft.activity.slots[1]!.choice = earn;
  expect(projectActivity(draft, snapshot).warnings).toContain(
    'manager:pc:capacity',
  );
  const change = draft.activity.slots[0]!.choice;
  draft.activity.slots[0]!.choice = earn;
  draft.activity.slots[1]!.choice = change;
  expect(projectActivity(draft, snapshot).warnings).not.toContain(
    'manager:pc:capacity',
  );
  draft.activity.slots[0]!.choice = change;
  draft.activity.slots[1]!.choice = null;
  // Moving to another role keeps her an Officer, so her limit is unchanged.
  draft.activity.slots[0]!.choice.toRole = 'marshal';
  draft.rulesExceptions = [officerPc];
  expect(projectActivity(draft, snapshot).requirements).toEqual([]);
  // A PC's limit never depends on roles.
  snapshot.roster.people[0]!.kind = 'pc';
  delete draft.activity.slots[0]!.choice.toRole;
  draft.rulesExceptions = [];
  expect(projectActivity(draft, snapshot).requirements).toEqual([]);
});

test('[rules.A07.hit-dice-fallback] a successful Drill adds each commandant’s Hit Dice override, zero included, or else their level', () => {
  for (const [hitDice, expected] of [
    [null, 47],
    [0, 37],
    [4, 41],
  ] as const) {
    const { draft, snapshot } = upkeepFixture();
    snapshot.roster.officers.push({ role: 'commandant', characterId: 'pc' });
    snapshot.roster.people[0]!.hitDice = hitDice;
    draft.activity.slots[0]!.choice = {
      choiceId: 'drill',
      actionId: 'drill_militia',
      rolls: { check: roll(20, 10), training: roll(6, 2, 5) },
    };
    const result = projectActivity(draft, snapshot);
    expect(result.outcome.training, String(hitDice)).toBe(expected);
    expect(result.ready).toBe(true);
  }
});

test('[rules.A07.cost] failed Drill costs treasury but never adds Commandant training or needs its gain dice', () => {
  const { draft, snapshot } = upkeepFixture();
  snapshot.roster.officers.push({ role: 'commandant', characterId: 'pc' });
  snapshot.roster.people[0]!.hitDice = null;
  draft.activity.slots[0]!.choice = {
    choiceId: 'drill',
    actionId: 'drill_militia',
    rolls: { check: roll(20, 2) },
  };
  const result = projectActivity(draft, snapshot);
  expect(result.outcome.training).toBe(30);
  expect(result.outcome.treasuryCopper).toBe(0);
  expect(result.ready).toBe(true);
});

test('[rules.F04.blocked-slot] a capacity exception cannot submit an occupied unavailable slot; moving into an allowed slot restores readiness', () => {
  const { draft, snapshot } = upkeepFixture();
  snapshot.rank = 1;
  draft.activity.slots[1]!.choice = {
    choiceId: 'drill',
    actionId: 'drill_militia',
    rolls: { check: roll(20, 12), training: roll(6, 2, 3) },
  };
  draft.rulesExceptions = [
    {
      exceptionId: 'extra',
      subjectId: 'drill',
      ruleId: 'action-capacity',
      reason: 'Extra action',
    },
  ];
  const before = structuredClone(draft);
  const blocked = projectActivity(draft, snapshot);
  expect(blocked.ready).toBe(false);
  expect(blocked.requirements).toContain('drill:action-capacity');
  expect(blocked.slots[1]!.choice).toEqual(draft.activity.slots[1]!.choice);
  expect(blocked.slots[1]!.overAllowance).toBe(true);
  expect(blocked.outcome.training).toBe(snapshot.training);
  expect(blocked.outcome.treasuryCopper).toBe(snapshot.treasuryCopper);
  expect(draft).toEqual(before);
  draft.activity.slots[0]!.choice = draft.activity.slots[1]!.choice;
  draft.activity.slots[1]!.choice = null;
  const moved = projectActivity(draft, snapshot);
  expect(moved.ready).toBe(true);
  expect(moved.outcome.training).toBe(35);
});

test('Drill remains available below the highest-PC rank cap', () => {
  const { draft, snapshot } = upkeepFixture();
  snapshot.rank = 4;
  snapshot.treasuryCopper = 10000;
  draft.activity.slots[0]!.choice = {
    choiceId: 'drill',
    actionId: 'drill_militia',
    rolls: { check: roll(20, 15), training: roll(6, 3, 4) },
  };
  const result = projectActivity(draft, snapshot);
  expect(result.ready).toBe(true);
  expect(result.outcome.training).toBe(37);
});

test('Moving a choice off the Strategist slot removes its annotated bonus instead of preserving stale arithmetic', () => {
  const { draft, snapshot } = upkeepFixture();
  snapshot.rank = 1;
  snapshot.roster.officers = [{ role: 'strategist', characterId: 'pc' }];
  const raw = roll(20, 7);
  raw.modifiers = [
    { sourceId: 'strategist', value: 2, reason: 'Bonus action' },
  ];
  draft.activity.slots[1]!.choice = {
    choiceId: 'drill',
    actionId: 'drill_militia',
    rolls: { check: raw, training: roll(6, 3, 4) },
  };
  expect(projectActivity(draft, snapshot).outcome.training).toBe(37);
  draft.activity.slots.reverse();
  const result = projectActivity(draft, snapshot);
  expect(result.checks[0]!.total).toBe(9);
  expect(result.outcome.training).toBe(30);
});

test('Helpful annotations require the operating settlement and can benefit only one Activity check', () => {
  const { draft, snapshot } = upkeepFixture();
  const raw = roll(20, 6);
  raw.modifiers = [
    { sourceId: 'helpful', value: 99, reason: 'Helpful settlement' },
  ];
  draft.activity.slots[0]!.choice = {
    choiceId: 'first',
    actionId: 'recruit_team',
    teamType: 'patrons',
    rolls: { check: raw },
  };
  let result = projectActivity(draft, snapshot);
  expect(result.requirements).toContain('first:helpful-ineligible');
  expect(result.outcome.roster.teams).toEqual([]);
  snapshot.settlements = [
    {
      settlementId: 'home',
      name: 'Home',
      reputation: 'Helpful',
      secured: false,
      occupied: false,
      temporaryReputationShift: 0,
      refugeActivatedWeek: null,
      refugeActiveUntilWeek: null,
    },
  ];
  draft.activity.operatingSettlementId = 'home';
  draft.activity.slots[1]!.choice = {
    choiceId: 'second',
    actionId: 'recruit_team',
    teamType: 'patrons',
    rolls: { check: raw },
  };
  result = projectActivity(draft, snapshot);
  expect(result.checks.map((check) => check.total)).toEqual([11, 9]);
  expect(result.checkUsage.helpful).toBe(true);
  expect(result.requirements).toContain('second:helpful-already-used');
  expect(result.outcome.roster.teams).toHaveLength(1);
});

test('Removing Strategist blocks its now-unavailable occurrence even with an action exception', () => {
  const { draft, snapshot } = upkeepFixture();
  snapshot.rank = 1;
  snapshot.roster.officers = [{ role: 'strategist', characterId: 'pc' }];
  draft.activity.slots[0]!.choice = {
    choiceId: 'remove',
    actionId: 'change_officer_role',
    characterId: 'pc',
    fromRole: 'strategist',
  };
  const raw = roll(20, 7);
  raw.modifiers = [
    { sourceId: 'strategist', value: 2, reason: 'Former bonus' },
  ];
  draft.activity.slots[1]!.choice = {
    choiceId: 'drill',
    actionId: 'drill_militia',
    rolls: { check: raw, training: roll(6, 3, 4) },
  };
  draft.rulesExceptions = [
    {
      exceptionId: 'extra',
      subjectId: 'drill',
      ruleId: 'action-capacity',
      reason: 'Extra action',
    },
  ];
  const result = projectActivity(draft, snapshot);
  expect(result.ready).toBe(false);
  expect(result.requirements).toContain('drill:action-capacity');
  expect(result.checks).toEqual([]);
  expect(result.outcome.training).toBe(30);
});

test.each([
  ['low_morale', 'drill_militia', 'loyalty', 11],
  ['double_agent', 'recruit_team', 'secrecy', 13],
] as const)(
  '[rules.activity.persistent.%s] carried penalties change success and apply only once',
  (eventType, actionId, check, total) => {
    const { draft, snapshot } = activityFixture(actionId);
    if (actionId === 'recruit_team')
      draft.activity.slots[0]!.choice = {
        choiceId: 'recruit',
        actionId,
        teamType: 'moles',
        rolls: { check: roll(20, 14) },
      };
    expect(projectActivity(draft, snapshot).ready).toBe(true);
    for (const copies of [1, 2]) {
      const carriedEvents = Array.from({ length: copies }, (_, order) => ({
        eventId: `penalty-${order}`,
        eventType,
        startedWeek: 39,
        order,
        targets: [],
      }));
      for (const queued of [false, true]) {
        const source = {
          ...draft,
          context: {
            ...draft.context,
            persistentPhaseEligible: true,
            carriedEvents,
            queuedEffects: queued
              ? carriedEvents.map((event) => ({
                  effectId: `queue-${event.eventId}`,
                  sourceId: event.eventId,
                  startsWeek: 40,
                  endsWeek: 40,
                  effect: { kind: 'check_modifier' as const, check, value: -2 },
                }))
              : [],
          },
        };
        const result = projectActivity(source, snapshot);
        expect(result.ready).toBe(true);
        expect(result.checks[0]!.total).toBe(total);
        expect(result.outcome.training).toBe(30);
        expect(result.outcome.roster.teams).toEqual(snapshot.roster.teams);
        expect(projectActivity(draft, snapshot).checks[0]!.total).toBe(
          total + 2,
        );
      }
    }
  },
);

test('Carried penalties preserve unrelated queued modifiers and do not reapply entered event provenance', () => {
  const { draft, snapshot } = activityFixture('drill_militia');
  const choice = draft.activity.slots[0]?.choice;
  const raw = actionChoiceRolls(choice ?? null).check;
  if (!raw) throw new Error('Missing fixture check');
  raw.modifiers = [{ sourceId: 'morale', value: -2, reason: 'Low Morale' }];
  const source = {
    ...draft,
    context: {
      ...draft.context,
      persistentPhaseEligible: true,
      carriedEvents: [
        {
          eventId: 'morale',
          eventType: 'low_morale' as const,
          startedWeek: 39,
          order: 0,
          targets: [],
        },
      ],
      queuedEffects: [
        {
          effectId: 'support',
          sourceId: 'ally',
          startsWeek: 40,
          endsWeek: 40,
          effect: {
            kind: 'check_modifier' as const,
            check: 'loyalty' as const,
            value: 1,
          },
        },
      ],
    },
  };
  const before = structuredClone(source);
  const result = projectActivity(source, snapshot);
  expect(result.checks[0]!.total).toBe(12);
  expect(result.outcome.training).toBe(30);
  expect(source).toEqual(before);
});

test('[rules.F05.final-roster] recruitment capacity uses completed dismissals rather than promised, missing-input or unavailable-slot removals', () => {
  for (const mode of [
    'no-dismissal',
    'unknown-target',
    'missing-check',
    'missing-notoriety',
    'extra-slot',
    'failed-dismissal',
    'success',
  ] as const) {
    const { draft, snapshot } = upkeepFixture();
    snapshot.rank = 1;
    snapshot.roster.officers = [{ role: 'strategist', characterId: 'pc' }];
    snapshot.roster.teams = ['old', 'other'].map((teamId) => ({
      teamId,
      teamType: 'patrons',
      name: teamId,
      status: 'active',
      managerCharacterId: null,
      rewardCapExempt: false,
      notes: '',
    }));
    draft.activity.slots[0]!.choice = {
      choiceId: 'recruit',
      actionId: 'recruit_team',
      teamType: 'patrons',
      rolls: { check: roll(20, 10) },
    };
    const dismissal = {
      choiceId: 'dismiss',
      actionId: 'dismiss_team' as const,
      targetTeamId: mode === 'unknown-target' ? 'unknown' : 'old',
      rolls:
        mode === 'missing-check'
          ? {}
          : {
              check: roll(20, mode === 'success' ? 10 : 2),
              ...(mode === 'missing-notoriety'
                ? {}
                : { notoriety: roll(6, 3) }),
            },
    };
    if (mode === 'extra-slot')
      draft.activity.slots.push({ slotId: 'extra', choice: dismissal });
    else if (mode !== 'no-dismissal')
      draft.activity.slots[1]!.choice = dismissal;
    const result = projectActivity(draft, snapshot);
    const removed = mode === 'failed-dismissal' || mode === 'success';
    expect(result.ready, mode).toBe(removed);
    expect(
      result.outcome.roster.teams.map((team) => team.teamId),
      mode,
    ).toEqual(
      removed
        ? ['other', 'recruit:recruit']
        : ['old', 'other', 'recruit:recruit'],
    );
    if (removed)
      expect(result.requirements).not.toContain(
        'recruit:team-capacity:exception',
      );
    else
      expect(result.requirements).toContain('recruit:team-capacity:exception');
    if (mode === 'failed-dismissal') expect(result.outcome.notoriety).toBe(3);
    if (mode === 'extra-slot')
      expect(result.requirements).toContain('dismiss:action-capacity');
  }
});

test('[rules.F05.recruitment-capacity-outcomes] failed recruitment consumes no capacity, rewarded teams stay exempt, and genuine excess still needs its exception', () => {
  const { draft, snapshot } = upkeepFixture();
  snapshot.rank = 1;
  snapshot.roster.teams = ['ordinary', 'reward'].map((teamId) => ({
    teamId,
    teamType: 'patrons',
    name: teamId,
    status: 'missing',
    managerCharacterId: null,
    rewardCapExempt: false,
    notes: '',
  }));
  draft.activity.slots[0]!.choice = {
    choiceId: 'recruit',
    actionId: 'recruit_team',
    teamType: 'patrons',
    rolls: { check: roll(20, 2) },
  };
  let result = projectActivity(draft, snapshot);
  expect(result.ready).toBe(true);
  expect(result.outcome.roster.teams).toEqual(snapshot.roster.teams);
  draft.activity.slots[0]!.choice.rolls!.check = roll(20, 10);
  result = projectActivity(draft, snapshot);
  expect(result.requirements).toContain('recruit:team-capacity:exception');
  draft.rulesExceptions = [
    {
      exceptionId: 'extra-team',
      subjectId: 'recruit',
      ruleId: 'team-capacity',
      reason: 'Temporary narrative reinforcement',
    },
  ];
  result = projectActivity(draft, snapshot);
  expect(result.ready).toBe(true);
  expect(result.outcome.roster.teams).toHaveLength(3);
  draft.rulesExceptions = [];
  snapshot.roster.teams[1]!.rewardCapExempt = true;
  result = projectActivity(draft, snapshot);
  expect(result.ready).toBe(true);
  expect(result.outcome.roster.teams).toHaveLength(3);
  expect(result.warnings).not.toContain('recruit:team-capacity');
});

test('[rules.F05.capacity-attribution] dismissing a reward team frees no counted place and only excess surviving recruits need exceptions', () => {
  const { draft, snapshot } = upkeepFixture();
  snapshot.roster.teams = ['first', 'second', 'third', 'reward'].map(
    (teamId) => ({
      teamId,
      teamType: 'patrons',
      name: teamId,
      status: 'active',
      managerCharacterId: null,
      rewardCapExempt: teamId === 'reward',
      notes: '',
    }),
  );
  draft.activity.slots[0]!.choice = {
    choiceId: 'recruit-first',
    actionId: 'recruit_team',
    teamType: 'patrons',
    rolls: { check: roll(20, 10) },
  };
  draft.activity.slots[1]!.choice = {
    choiceId: 'dismiss',
    actionId: 'dismiss_team',
    targetTeamId: 'reward',
    rolls: { check: roll(20, 10) },
  };
  let result = projectActivity(draft, snapshot);
  expect(result.outcome.roster.teams.map((team) => team.teamId)).toEqual([
    'first',
    'second',
    'third',
    'recruit:recruit-first',
  ]);
  expect(result.requirements).toContain(
    'recruit-first:team-capacity:exception',
  );
  snapshot.roster.teams = snapshot.roster.teams.slice(0, 2);
  draft.activity.slots[1]!.choice = {
    choiceId: 'recruit-second',
    actionId: 'recruit_team',
    teamType: 'patrons',
    rolls: { check: roll(20, 10) },
  };
  result = projectActivity(draft, snapshot);
  expect(result.requirements).not.toContain(
    'recruit-first:team-capacity:exception',
  );
  expect(result.requirements).toContain(
    'recruit-second:team-capacity:exception',
  );
  draft.rulesExceptions = [
    {
      exceptionId: 'extra',
      subjectId: 'recruit-first',
      ruleId: 'team-capacity',
      reason: 'Wrong occurrence',
    },
  ];
  expect(projectActivity(draft, snapshot).ready).toBe(false);
  draft.rulesExceptions[0]!.subjectId = 'recruit-second';
  expect(projectActivity(draft, snapshot).ready).toBe(true);
});
