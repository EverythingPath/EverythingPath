import { settlementFixture } from '../../tests/rules/settlement-fixture';
import { characterFixture } from '../../tests/rules/character-fixture';
import { assert, expect, test } from 'vitest';
import { activityFixture } from '../../tests/rules/activity-fixture';
import {
  activityAcceptanceFixtures,
  upgradeEdges,
} from '../../tests/rules/activity-acceptance-fixtures';
import { roll } from '../../tests/rules/upkeep-fixture';
import { projectActivity } from './rules-activity';
import { projectTeams } from './rules-teams';
import { projectWeeklyDraft } from './canonical-weekly-resolution';

test('[rules.teams.all-edges] every listed edge charges its literal copper cost and preserves identity, manager and annotations', () => {
  for (const [from, to, cost] of upgradeEdges) {
    const { draft, snapshot } = activityFixture('upgrade_team');
    snapshot.treasuryCopper = 200000;
    const team = snapshot.roster.teams[0]!;
    Object.assign(team, {
      teamType: from,
      managerCharacterId: 'pc',
      notes: 'Veterans',
      rewardCapExempt: true,
    });
    draft.activity.slots[0]!.choice = {
      choiceId: 'upgrade',
      actionId: 'upgrade_team',
      targetTeamId: 'team',
      toTeamType: to,
    };
    const result = projectActivity(draft, snapshot);
    expect(result.ready, `${from} -> ${to}`).toBe(true);
    expect(result.outcome.treasuryCopper).toBe(200000 - cost);
    expect(result.outcome.roster.teams).toEqual([{ ...team, teamType: to }]);
    const projected = projectTeams(
      result.outcome.roster,
      snapshot.characters,
      result.teamUse,
    );
    expect(projected.teams[0]!.available).toBe(false);
  }
});

test('[rules.teams.definitions] each tree exposes literal recruitment, size and inherited branch capabilities', () => {
  const rows = [
    ['moles', 1, 3, ['secureCache'], { check: 'Secrecy', dc: 15 }],
    ['propagandists', 2, 3, ['secureCache', 'spreadPropaganda'], null],
    ['saboteurs', 3, 3, ['sabotage', 'secureCache', 'spreadPropaganda'], null],
    ['spies', 3, 3, ['covertAction', 'secureCache', 'spreadPropaganda'], null],
    ['informants', 1, 6, ['gatherInformation'], { check: 'Loyalty', dc: 10 }],
    ['conspirators', 2, 6, ['activateRefuge', 'gatherInformation'], null],
    [
      'scholars',
      3,
      6,
      ['activateRefuge', 'gatherInformation', 'knowledgeCheck'],
      null,
    ],
    [
      'spellcasters',
      3,
      6,
      ['activateRefuge', 'gatherInformation', 'restoreCharacter'],
      null,
    ],
    ['defenders', 1, 6, ['reduceDanger'], { check: 'Security', dc: 15 }],
    ['infiltrators', 2, 6, ['reduceDanger', 'rescueCharacter'], null],
    [
      'guardians',
      3,
      6,
      ['manipulateEvents', 'reduceDanger', 'rescueCharacter'],
      null,
    ],
    [
      'specialists',
      3,
      6,
      ['reduceDanger', 'rescueCharacter', 'strikeTeam'],
      null,
    ],
    ['patrons', 1, 6, ['earnGold'], { check: 'Loyalty', dc: 10 }],
    ['merchants', 2, 6, ['brokerMarket', 'earnGold'], null],
    [
      'blackMarketeers',
      3,
      6,
      ['activateBlackMarket', 'brokerMarket', 'earnGold'],
      null,
    ],
    ['fixers', 3, 6, ['brokerMarket', 'earnGold', 'specialOrder'], null],
  ] as const;
  for (const [teamType, tier, size, actions, recruitment] of rows) {
    const { snapshot } = activityFixture('lie_low');
    snapshot.roster.teams[0]!.teamType = teamType;
    expect(
      projectTeams(snapshot.roster, snapshot.characters).teams[0],
    ).toMatchObject({ tier, size, actions, recruitment });
  }
});

test('[rules.teams.illegal-edges] every starting type rejects cross-tree, skipped-tier, backwards and same-type upgrades', () => {
  for (const [from] of upgradeEdges) {
    for (const to of ['moles', 'spies', 'fixers', from] as const) {
      if (upgradeEdges.some(([a, b]) => a === from && b === to)) continue;
      const { draft, snapshot } = activityFixture('upgrade_team');
      snapshot.treasuryCopper = 200000;
      snapshot.roster.teams[0]!.teamType = from;
      draft.activity.slots[0]!.choice = {
        choiceId: 'upgrade',
        actionId: 'upgrade_team',
        targetTeamId: 'team',
        toTeamType: to,
      };
      const result = projectActivity(draft, snapshot);
      expect(result.requirements).toContain('upgrade:upgrade-tree:exception');
      expect(result.outcome.treasuryCopper).toBe(200000);
      expect(result.outcome.roster.teams).toEqual(snapshot.roster.teams);
    }
  }
});

test('[rules.teams.independent-upgrades] different teams may upgrade independently while a repeated identity cannot upgrade twice', () => {
  const { draft, snapshot } = activityFixture('upgrade_team');
  snapshot.treasuryCopper = 200000;
  snapshot.roster.teams.push({
    ...snapshot.roster.teams[0]!,
    teamId: 'second',
  });
  draft.activity.slots[1]!.choice = {
    choiceId: 'other',
    actionId: 'upgrade_team',
    targetTeamId: 'second',
    toTeamType: 'merchants',
  };
  let result = projectActivity(draft, snapshot);
  expect(result.ready).toBe(true);
  expect(result.outcome.treasuryCopper).toBe(190000);
  expect(result.outcome.roster.teams.map((team) => team.teamType)).toEqual([
    'merchants',
    'merchants',
  ]);
  draft.activity.slots[1]!.choice = {
    choiceId: 'other',
    actionId: 'upgrade_team',
    targetTeamId: 'team',
    toTeamType: 'fixers',
  };
  result = projectActivity(draft, snapshot);
  expect(result.requirements).toContain('other:team-upgrade-limit:exception');
  expect(result.outcome.treasuryCopper).toBe(195000);
});

test('[rules.teams.recruit-then-act] recruitment creates a usable independent identity, while failure and reordering remove its later income', () => {
  const input = activityAcceptanceFixtures().find(
    (f) => f.name === 'recruit-then-act',
  )!.input;
  const draft = input.revision;
  const snapshot = input.militiaSnapshot;
  let result = projectActivity(draft, snapshot);
  expect(result.ready).toBe(true);
  expect(result.outcome.roster.teams[0]!.teamId).toBe('recruit:join');
  expect(result.outcome.treasuryCopper).toBe(1001100);
  assert(draft.activity.slots[0]!.choice?.actionId === 'recruit_team');
  draft.activity.slots[0]!.choice.rolls = { check: roll(20, 2) };
  result = projectActivity(draft, snapshot);
  expect(result.outcome.roster.teams).toEqual([]);
  expect(result.outcome.treasuryCopper).toBe(1000000);
  expect(result.requirements).toContain('earn:team');
  assert(draft.activity.slots[0]!.choice?.actionId === 'recruit_team');
  draft.activity.slots[0]!.choice.rolls = { check: roll(20, 15) };
  draft.activity.slots.reverse();
  expect(projectActivity(draft, snapshot).requirements).toContain('earn:team');
});

test('[rules.A12.count-floor] Lie Low counts every team condition and bonus team, clamps at zero and leaves zero-team notoriety unchanged', () => {
  const { draft, snapshot } = activityFixture('lie_low');
  snapshot.notoriety = 2;
  snapshot.roster.teams = ['active', 'disabled', 'missing'].map(
    (status, i) => ({
      ...snapshot.roster.teams[0]!,
      teamId: `team-${i}`,
      status: status as 'active' | 'disabled' | 'missing',
      rewardCapExempt: i === 0,
    }),
  );
  expect(projectActivity(draft, snapshot).outcome.notoriety).toBe(0);
  snapshot.notoriety = 10;
  expect(projectActivity(draft, snapshot).outcome.notoriety).toBe(7);
  snapshot.roster.teams = [];
  expect(projectActivity(draft, snapshot).outcome.notoriety).toBe(10);
});

test('[rules.activity.acceptance-ready] full-week representative upgrade, inherited action and recruit-action fixtures resolve completely', () => {
  for (const { name, input } of activityAcceptanceFixtures()) {
    const result = projectWeeklyDraft(input);
    expect(result.requirements, name).toEqual([]);
    expect(result.status, name).toBe('ready');
  }
});

test('[rules.teams.use-eligibility] repeated actions need distinct capable active teams; exceptions permit choices without changing income', () => {
  const input = activityAcceptanceFixtures().find(
    (f) => f.name === 'inherited-earn-fixers',
  )!.input;
  const { revision: draft, militiaSnapshot: snapshot } = input;
  const first = draft.activity.slots[0]!.choice!;
  draft.activity.slots[1]!.choice = { ...first, choiceId: 'second' };
  expect(projectActivity(draft, snapshot).requirements).toContain(
    'second:team-action-limit:exception',
  );
  snapshot.roster.teams.push({ ...snapshot.roster.teams[0]!, teamId: 'other' });
  draft.activity.slots[1]!.choice.teamId = 'other';
  expect(projectActivity(draft, snapshot).ready).toBe(true);
  expect(projectActivity(draft, snapshot).outcome.treasuryCopper).toBe(1006600);
  for (const status of ['disabled', 'missing'] as const) {
    snapshot.roster.teams[1]!.status = status;
    expect(projectActivity(draft, snapshot).requirements).toContain(
      'second:team-condition:exception',
    );
    draft.rulesExceptions = [
      {
        exceptionId: 'permit',
        subjectId: 'second',
        ruleId: 'team-condition',
        reason: 'Recovered by the table',
      },
    ];
    const result = projectActivity(draft, snapshot);
    expect(result.ready).toBe(true);
    expect(result.outcome.treasuryCopper).toBe(1006600);
    draft.rulesExceptions = [];
  }
  snapshot.roster.teams[1]!.status = 'active';
  snapshot.roster.teams[1]!.teamType = 'moles';
  expect(projectActivity(draft, snapshot).requirements).toContain(
    'second:team-action:exception',
  );
});

test('[rules.A06.success-repeat] successful dismissal adds no notoriety and a second dismissal cannot remove a different team', () => {
  const { draft, snapshot } = activityFixture('dismiss_team');
  assert(draft.activity.slots[0]!.choice?.actionId === 'dismiss_team');
  draft.activity.slots[0]!.choice.rolls = { check: roll(20, 7) };
  draft.activity.slots[1]!.choice = {
    ...draft.activity.slots[0]!.choice,
    choiceId: 'again',
  };
  const result = projectActivity(draft, snapshot);
  expect(result.outcome.roster.teams).toEqual([]);
  expect(result.outcome.notoriety).toBe(10);
  expect(result.requirements).toContain('again:target-team');
});

test('[rules.teams.action-upgrade-order] action before upgrade and upgrade before action both preserve the earlier result and block reusing that team', () => {
  const input = activityAcceptanceFixtures().find(
    (f) => f.name === 'recruit-then-act',
  )!.input;
  const { revision: draft, militiaSnapshot: snapshot } = input;
  snapshot.roster.teams = [
    {
      teamId: 'team',
      teamType: 'patrons',
      name: 'Patrons',
      status: 'active',
      managerCharacterId: null,
      rewardCapExempt: false,
      notes: '',
    },
  ];
  draft.activity.slots[0]!.choice = {
    choiceId: 'earn',
    actionId: 'earn_gold',
    teamId: 'team',
    rolls: { check: roll(20, 10) },
  };
  draft.activity.slots[1]!.choice = {
    choiceId: 'upgrade',
    actionId: 'upgrade_team',
    targetTeamId: 'team',
    toTeamType: 'merchants',
  };
  let result = projectActivity(draft, snapshot);
  expect(result.requirements).toContain('upgrade:team-action-limit:exception');
  expect(result.outcome.treasuryCopper).toBe(1001100);
  expect(result.outcome.roster.teams[0]!.teamType).toBe('patrons');
  draft.activity.slots.reverse();
  result = projectActivity(draft, snapshot);
  expect(result.requirements).toContain('earn:team-action-limit:exception');
  expect(result.outcome.treasuryCopper).toBe(995000);
  expect(result.outcome.roster.teams[0]!.teamType).toBe('merchants');
});

test('[rules.A09.boundaries] all Intelligence tiers independently resolve DC14/15 and failed natural one adds only its notoriety', () => {
  for (const [teamType, bonus] of [
    ['informants', 2],
    ['conspirators', 4],
    ['scholars', 6],
    ['spellcasters', 6],
  ] as const) {
    const { draft, snapshot, choice } = characterFixture('gather_information');
    assert(choice.actionId === 'gather_information');
    snapshot.roster.teams[0]!.teamType = teamType;
    for (const total of [14, 15]) {
      choice.rolls = { check: roll(20, total - 3 - bonus) };
      const result = projectActivity(draft, snapshot);
      expect(result.plan).toContainEqual(
        expect.objectContaining({
          kind: 'information',
          total,
          succeeded: total === 15,
        }),
      );
    }
    choice.rolls = { check: roll(20, 1), notoriety: roll(6, 6) };
    const result = projectActivity(draft, snapshot);
    expect(result.plan).toContainEqual(
      expect.objectContaining({ kind: 'information', succeeded: false }),
    );
    expect(result.outcome.notoriety).toBe(16);
  }
});

test('[rules.A02.rescue-order] a new refuge becomes a same-week rescue destination only after its activation choice', () => {
  const { draft, snapshot, choice } = characterFixture('rescue_character');
  if (choice.actionId !== 'rescue_character') throw new Error('Fixture action');
  snapshot.settlements[0]!.reputation = 'Hostile';
  snapshot.settlements[0]!.secured = true;
  snapshot.roster.teams.push({
    ...snapshot.roster.teams[0]!,
    teamId: 'refuge-team',
    teamType: 'conspirators',
  });
  const activation = settlementFixture('activate_refuge').choice;
  activation.teamId = 'refuge-team';
  choice.destination = { kind: 'refuge', settlementId: 'town' };
  draft.activity.slots[0]!.choice = activation;
  draft.activity.slots[1]!.choice = choice;
  let result = projectActivity(draft, snapshot);
  expect(result.ready).toBe(true);
  expect(result.outcome.characterActions!.people[0]!.status).toBe('available');
  expect(result.outcome.characterActions!.people[0]!.location).toEqual({
    kind: 'refuge',
    settlementId: 'town',
  });
  draft.activity.slots.reverse();
  result = projectActivity(draft, snapshot);
  expect(result.ready).toBe(false);
  expect(result.outcome.characterActions!.people[0]!.status).toBe('captured');
});
