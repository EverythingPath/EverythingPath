import { threatEventFixture } from '../../tests/rules/threat-event-fixture';
import { expect, test } from 'vitest';
import { economyFixture } from '../../tests/rules/economy-fixture';
import { upkeepFixture, roll } from '../../tests/rules/upkeep-fixture';
import { editWeeklyDraft } from './weekly-draft';
import { projectWeeklyDraft } from './canonical-weekly-resolution';
import { projectUpkeep } from './rules-upkeep';

function fixture() {
  const { draft, snapshot } = economyFixture('earn_gold');
  snapshot.training = 15;
  snapshot.treasuryCopper = 20000;
  snapshot.roster.teams[0]!.status = 'disabled';
  draft.upkeep.rolls = { check: roll(20, 10), training: roll(6, 1) };
  draft.event.chanceRoll = roll(100, 100);
  return { draft, snapshot };
}

test('[rules.T07.same-week] paid and recorded narrative recovery enable the same-week inherited action with separate baseline and adjusted costs', () => {
  for (const narrative of [false, true]) {
    const { draft, snapshot } = fixture();
    const edit = editWeeklyDraft(draft, {
      kind: 'upkeep_team',
      teamId: 'team',
      decision: { teamId: 'team', decision: 'recover', costCopper: 3000 },
      ...(narrative
        ? {
            recoveryAdjustment: {
              deltaCopper: 3000,
              reason: 'The temple heals the team without charge',
            },
          }
        : {}),
    });
    if (!edit.ok) throw new Error(edit.error);
    const result = projectWeeklyDraft({
      revision: edit.draft,
      militiaSnapshot: snapshot,
    });
    expect(result.requirements).toEqual([]);
    expect(result.status).toBe('ready');
    expect(result.baseline!.militiaSnapshot.treasuryCopper).toBe(20300);
    expect(result.outcome!.militiaSnapshot.treasuryCopper).toBe(
      narrative ? 23300 : 20300,
    );
    expect(result.outcome!.militiaSnapshot.roster.teams[0]!.status).toBe(
      'active',
    );
    expect(result.source!.revision.tableAdjustments).toEqual(
      edit.draft.tableAdjustments,
    );
  }
});

test('[rules.T07.individual-cost] each recovered team pays the current minimum and leaving a team disabled preserves its ineligibility', () => {
  const { draft, snapshot } = fixture();
  snapshot.roster.teams.push({
    ...snapshot.roster.teams[0]!,
    teamId: 'second',
  });
  draft.upkeep.teamDecisions = ['team', 'second'].map((teamId) => ({
    teamId,
    decision: 'recover',
  }));
  let result = projectUpkeep(draft, snapshot);
  expect(result.ready).toBe(true);
  expect(result.outcome.treasuryCopper).toBe(14000);
  expect(result.outcome.roster.teams.map((team) => team.status)).toEqual([
    'active',
    'active',
  ]);
  draft.upkeep.teamDecisions[0]!.decision = 'leave';
  const preview = projectWeeklyDraft({
    revision: draft,
    militiaSnapshot: snapshot,
  });
  expect(preview.requirements).toContain('economy:team-condition:exception');
  result = projectUpkeep(draft, snapshot);
  expect(result.outcome.treasuryCopper).toBe(17000);
  expect(result.outcome.roster.teams[0]!.status).toBe('disabled');
});

test('[rules.T08.natural-one] a natural-one missing-team return permanently loses the team despite a successful total', () => {
  const { draft, snapshot } = fixture();
  snapshot.roster.teams[0]!.status = 'missing';
  snapshot.characters[0]!.strength = 40;
  snapshot.roster.officers.push({ role: 'marshal', characterId: 'pc' });
  draft.upkeep.teamDecisions = [
    { teamId: 'team', decision: 'recover', roll: roll(20, 1) },
  ];
  const result = projectUpkeep(draft, snapshot);
  expect(
    result.checks.find((check) => check.checkId === 'team:team:return')?.total,
  ).toBe(17);
  expect(result.outcome.roster.teams).toEqual([]);
});

test('[rules.T08.condition-order] scheduled and ordinary end-week returns preserve later Sickness and Turn Around decisions', () => {
  for (const queued of [false, true]) {
    for (const heals of [false, true]) {
      const { draft, snapshot } = threatEventFixture(90, heals);
      snapshot.training = 15;
      snapshot.roster.teams[0]!.status = 'missing';
      draft.upkeep.rolls = { check: roll(20, 10), training: roll(6, 1) };
      draft.upkeep.teamDecisions = [
        { teamId: 'team', decision: 'recover', roll: roll(20, 14) },
      ];
      if (queued)
        draft.context = {
          ...draft.context,
          queuedEffects: [
            {
              effectId: 'return',
              sourceId: 'earlier-absence',
              startsWeek: 40,
              endsWeek: 40,
              effect: { kind: 'team_return', teamId: 'team', status: 'active' },
            },
          ],
        };
      if (heals) {
        draft.event.occurrences[2]!.tableRoll = roll(100, 30);
        draft.event.occurrences[2]!.targets = [];
      }
      const result = projectWeeklyDraft({
        revision: draft,
        militiaSnapshot: snapshot,
      });
      expect(result.requirements).toEqual([]);
      expect(result.outcome!.militiaSnapshot.roster.teams[0]!.status).toBe(
        heals ? 'active' : 'disabled',
      );
      expect(result.phases!.upkeep.outcome.roster.teams[0]!.status).toBe(
        'missing',
      );
    }
  }
});

test('[rules.U02.dice-boundaries] attrition uses both ends of every prescribed die range without converting natural gains to losses', () => {
  for (const [check, sides, dice, expected] of [
    [7, 6, [1], 29],
    [7, 6, [6], 24],
    [6, 4, [1, 1], 25],
    [6, 4, [4, 4], 19],
    [20, 6, [1], 31],
    [20, 6, [6], 36],
  ] as const) {
    const { draft, snapshot } = upkeepFixture();
    draft.upkeep.rolls = {
      check: roll(20, check),
      training: roll(sides, ...dice),
    };
    expect(projectUpkeep(draft, snapshot).outcome.training).toBe(expected);
  }
});
