import { expect, test } from 'vitest';
import { roll, upkeepFixture } from '../../../tests/rules/upkeep-fixture';
import { projectWeeklyDraft } from '~/lib/canonical-weekly-resolution';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import type { UpkeepSnapshot } from '~/lib/rules-upkeep';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import { phaseView } from './phase-view';

test('the skipped first week has no Upkeep sections to decide', () => {
  const { draft, snapshot } = upkeepFixture();
  draft.context = { ...draft.context, firstMilitiaWeek: true };
  const source = workspaceSourceSchema.parse({
    key: { campaignId: 'campaign', militiaId: 'militia', draftId: 'draft' },
    week: draft.week,
    sourceRevision: 0,
    snapshot,
    people: [],
  });
  const preview = projectWeeklyDraft({
    revision: draft,
    militiaSnapshot: snapshot,
  });
  expect(phaseView('upkeep', draft, source, preview)).toMatchObject({
    skipped: true,
    sections: null,
  });
});

type Team = UpkeepSnapshot['roster']['teams'][number];
function team(
  teamId: string,
  status: Team['status'],
  teamType: Team['teamType'] = 'patrons',
): Team {
  return {
    teamId,
    teamType,
    name: teamId[0]!.toUpperCase() + teamId.slice(1),
    status,
    managerCharacterId: null,
    rewardCapExempt: false,
    notes: '',
  };
}

// Rank 3 (minimum treasury 30 gp), training 30, treasury 30 gp, notoriety 0.
function upkeep(
  arrange: (draft: WeeklyDraft, snapshot: UpkeepSnapshot) => void = () =>
    undefined,
) {
  const { draft, snapshot } = upkeepFixture();
  arrange(draft, snapshot);
  const source = workspaceSourceSchema.parse({
    key: { campaignId: 'campaign', militiaId: 'militia', draftId: 'draft' },
    week: draft.week,
    sourceRevision: 0,
    snapshot,
    people: [{ characterId: 'pc', name: 'Ameiko' }],
  });
  const preview = projectWeeklyDraft({
    revision: draft,
    militiaSnapshot: source.snapshot,
  });
  const view = phaseView('upkeep', draft, source, preview);
  if (view.phase !== 'upkeep' || !view.sections)
    throw new Error('Expected Upkeep sections');
  return { ...view, sections: view.sections };
}

test('an undecided disabled team offers the rules recovery cost and leaves the treasury shortage waiting', () => {
  const view = upkeep((_, snapshot) => {
    snapshot.treasuryCopper = 5000;
    snapshot.roster.teams.push(team('scouts', 'disabled'));
  });
  expect(view.sections.teams).toMatchObject({
    status: 'open',
    treasuryBeforeCopper: 5000,
    treasuryAfterRecoveryCopper: 5000,
    disabled: [
      {
        teamId: 'scouts',
        name: 'Scouts',
        typeName: 'Patrons',
        tier: 1,
        decision: null,
        rulesCostCopper: 3000,
        enteredCostCopper: 3000,
        adjustment: null,
      },
    ],
    missing: [],
  });
  // Recovering would leave 20 gp, below the 30 gp minimum; leaving would not.
  expect(view.sections.shortage).toMatchObject({
    status: 'waiting',
    minimumCopper: 3000,
    loss: null,
  });
});

test('a recovered team pays the rules cost in the baseline while a changed price stays a named post-baseline adjustment', () => {
  const view = upkeep((draft, snapshot) => {
    snapshot.treasuryCopper = 5000;
    snapshot.roster.teams.push(team('scouts', 'disabled'));
    draft.upkeep.teamDecisions = [
      { teamId: 'scouts', decision: 'recover', costCopper: 3000 },
    ];
    draft.tableAdjustments = [
      {
        kind: 'militia_value',
        adjustmentId: 'upkeep-recovery:scouts',
        field: 'treasuryCopper',
        operation: 'add',
        value: 2950,
        reason: 'The quartermaster owed us',
      },
    ];
  });
  expect(view.sections.teams).toMatchObject({
    status: 'resolved',
    treasuryAfterRecoveryCopper: 2000,
    adjustments: [{ teamId: 'scouts', name: 'Scouts', deltaCopper: 2950 }],
    disabled: [
      {
        decision: 'recover',
        enteredCostCopper: 50,
        adjustment: { deltaCopper: 2950, reason: 'The quartermaster owed us' },
      },
    ],
  });
  // The cheaper negotiated price does not avoid the baseline shortage.
  expect(view.sections.shortage).toMatchObject({
    status: 'open',
    treasuryAfterRecoveryCopper: 2000,
    minimumCopper: 3000,
    loss: { count: 2, sides: 4, rank: 3, trainingDelta: null },
  });
});

test('recovery beyond the treasury asks for its reasoned exception under the team', () => {
  const view = upkeep((draft, snapshot) => {
    snapshot.treasuryCopper = 1000;
    snapshot.roster.teams.push(team('scouts', 'disabled'));
    draft.upkeep.teamDecisions = [
      { teamId: 'scouts', decision: 'recover', costCopper: 3000 },
    ];
  });
  const scouts = view.sections.teams.disabled[0]!;
  expect(scouts.fundsException).toEqual({
    exceptionId: 'upkeep:upkeep-recovery-funds:scouts',
    reason: '',
    required: true,
  });
  expect(scouts.issues).toEqual([
    {
      code: 'team:scouts:recovery-funds',
      message:
        'Scouts recovery costs more than the available treasury. Record a table ruling to proceed.',
    },
  ]);
  expect(view.sections.teams.status).toBe('open');
});

test('a missing team shows its Security DC 15 return check result, and a natural 1 loses it', () => {
  const returning = (die: number) =>
    upkeep((draft, snapshot) => {
      snapshot.roster.teams.push(team('scouts', 'missing'));
      draft.upkeep.teamDecisions = [
        { teamId: 'scouts', decision: 'leave', roll: roll(20, die) },
      ];
    }).sections.teams.missing[0]!;
  const empty = upkeep((_, snapshot) => {
    snapshot.roster.teams.push(team('scouts', 'missing'));
  });
  expect(empty.sections.teams.status).toBe('open');
  expect(empty.sections.teams.missing[0]!.return).toMatchObject({
    kind: 'check',
    check: { dc: 15, total: null, result: null },
  });
  const check = (die: number) => {
    const row = returning(die).return;
    if (row?.kind !== 'check') throw new Error('Expected a return check');
    return row.check;
  };
  expect(check(1).result).toBe('lost');
  expect(check(2).result).toBe('stays-missing');
  const success = check(19);
  expect(success.result).toBe('returns');
  expect(success.normalized.diceTotal).toBe(19);
  expect(success.total).toBe((success.modifier ?? 0) + 19);
});

test('a scheduled return replaces the missing team check', () => {
  const view = upkeep((draft, snapshot) => {
    snapshot.roster.teams.push(team('scouts', 'missing'));
    draft.context = {
      ...draft.context,
      queuedEffects: [
        {
          eventType: 'missing_in_action',
          effectId: 'mia',
          sourceId: 'mia:scouts',
          startsWeek: 40,
          endsWeek: 40,
          effect: { kind: 'team_return', teamId: 'scouts', status: 'disabled' },
        },
      ],
    };
  });
  expect(view.sections.teams.missing[0]!.return).toEqual({
    kind: 'scheduled',
    week: 40,
    status: 'disabled',
  });
  expect(view.requirements.some((key) => key.startsWith('team:'))).toBe(false);
});

test('attrition shows the natural 20 gain, ordinary success loss and failure loss with rank added by the rules', () => {
  const attrition = (check: number, training?: [number, ...number[]]) =>
    upkeep((draft) => {
      draft.upkeep.rolls = {
        check: roll(20, check),
        ...(training ? { training: roll(...training) } : {}),
      };
    }).sections.attrition;
  const waiting = upkeep().sections.attrition;
  expect(waiting).toMatchObject({
    status: 'open',
    trainingDelta: null,
    check: { dc: 10, result: null },
    training: null,
  });
  expect(attrition(20)).toMatchObject({
    status: 'open',
    check: { result: 'natural-20' },
    training: { count: 1, sides: 6, rank: null, trainingDelta: null },
  });
  expect(attrition(20, [6, 4])).toMatchObject({
    status: 'resolved',
    trainingDelta: 4,
  });
  // The fixture's +1 check bonus makes 12 a success.
  expect(attrition(12, [6, 4])).toMatchObject({
    check: { result: 'success' },
    training: { rank: null },
    trainingDelta: -4,
  });
  expect(attrition(2, [4, 3, 2])).toMatchObject({
    check: { result: 'failure' },
    training: { count: 2, sides: 4, rank: 3, multiplier: 1 },
    trainingDelta: -8,
  });
});

test('maximum notoriety collapses below the threshold and asks for the settlement only after a failed check', () => {
  const below = upkeep((draft, snapshot) => {
    snapshot.notoriety = 64;
    draft.upkeep.notorietyCheck = roll(20, 3);
  }).sections.notoriety;
  expect(below).toEqual({
    status: 'inapplicable',
    notoriety: 64,
    threshold: 100,
    trainingDelta: null,
    loss: null,
    check: null,
    settlement: null,
  });
  const at = (check?: number) =>
    upkeep((draft, snapshot) => {
      snapshot.notoriety = 100;
      snapshot.settlements = [
        {
          settlementId: 'phaendar',
          name: 'Phaendar',
          reputation: 'Friendly',
          secured: null,
          occupied: null,
          temporaryReputationShift: null,
          refugeActivatedWeek: null,
          refugeActiveUntilWeek: null,
        },
      ];
      draft.upkeep.rolls = { notoriety: roll(20, 5) };
      if (check !== undefined) draft.upkeep.notorietyCheck = roll(20, check);
    }).sections.notoriety;
  expect(at()).toMatchObject({
    status: 'open',
    trainingDelta: -8,
    loss: { count: 1, sides: 20, rank: 3 },
    check: { dc: 15, result: null },
    settlement: { required: false, selected: null },
  });
  expect(at(20)).toMatchObject({
    status: 'resolved',
    check: { result: 'success' },
    settlement: { required: false, change: null },
  });
  expect(at(2)).toMatchObject({
    status: 'open',
    check: { result: 'failure' },
    settlement: {
      required: true,
      choices: [{ settlementId: 'phaendar', reputation: 'Friendly' }],
    },
  });
});

test('rank waits for the earlier steps and then reports the actual transition', () => {
  expect(upkeep().sections.rank).toMatchObject({
    status: 'waiting',
    before: 3,
    after: null,
  });
  // Training 30 − 2 = 28 reaches rank 4, whose boon still needs recording.
  const promoted = upkeep((draft) => {
    draft.upkeep.rolls = { check: roll(20, 12), training: roll(6, 2) };
  });
  expect(promoted.sections.rank).toMatchObject({
    status: 'open',
    before: 3,
    after: 4,
  });
  const settled = upkeep((draft, snapshot) => {
    snapshot.training = 12;
    draft.upkeep.rolls = { check: roll(20, 12), training: roll(6, 2) };
    draft.upkeep.treasuryTransfers = [
      {
        transferId: 'deposit',
        direction: 'deposit',
        copper: 250,
      },
    ];
  });
  expect(settled.sections.rank).toMatchObject({
    status: 'resolved',
    before: 3,
    after: 3,
  });
  expect(settled.sections.transfers).toMatchObject({
    beforeCopper: 3000,
    afterCopper: 3250,
  });
});

test('a staged decision for a team no longer on the roster is exposed for repair', () => {
  const view = upkeep((draft) => {
    draft.upkeep.teamDecisions = [
      { teamId: 'gone', decision: 'recover', costCopper: 3000 },
    ];
  });
  expect(view.requirements).toContain('team:gone:reference');
  expect(view.sections.teams).toMatchObject({
    status: 'open',
    orphans: [{ teamId: 'gone' }],
  });
});

test('a missing team shows its calculated Security bonus before the die is entered', () => {
  const view = upkeep((_, snapshot) => {
    snapshot.roster.teams.push(team('scouts', 'missing'));
  });
  const row = view.sections.teams.missing[0]!.return;
  if (row?.kind !== 'check') throw new Error('Expected a return check');
  expect(row.check.total).toBeNull();
  expect(row.check.modifier).toEqual(expect.any(Number));
  const rolled = upkeep((draft, snapshot) => {
    snapshot.roster.teams.push(team('scouts', 'missing'));
    draft.upkeep.teamDecisions = [
      { teamId: 'scouts', decision: 'leave', roll: roll(20, 9) },
    ];
  }).sections.teams.missing[0]!.return;
  if (rolled?.kind !== 'check') throw new Error('Expected a return check');
  expect(rolled.check.modifier).toBe(row.check.modifier);
  expect(rolled.check.total).toBe(9 + row.check.modifier!);
});

test('rank reports its own missing player-character cap instead of waiting', () => {
  const view = upkeep((draft, snapshot) => {
    snapshot.characters = snapshot.characters.map((character) => ({
      ...character,
      isActive: false,
    }));
    draft.upkeep.rolls = { check: roll(20, 12), training: roll(6, 2) };
  });
  expect(view.requirements).toEqual(['highest-level-pc']);
  expect(view.sections.rank).toMatchObject({
    status: 'open',
    after: null,
    issues: [{ code: 'highest-level-pc' }],
  });
  expect(view.sections.transfers.status).not.toBe('waiting');
});

test('a recovery-funds ruling left over after choosing Leave disabled is not shown under the team', () => {
  const view = upkeep((draft, snapshot) => {
    snapshot.treasuryCopper = 1000;
    snapshot.roster.teams.push(team('scouts', 'disabled'));
    draft.upkeep.teamDecisions = [{ teamId: 'scouts', decision: 'leave' }];
    draft.rulesExceptions = [
      {
        exceptionId: 'funds',
        subjectId: 'scouts',
        ruleId: 'upkeep-recovery-funds',
        reason: 'Owed favour',
      },
    ];
  });
  expect(view.sections.teams.disabled[0]!.fundsException).toBeNull();
});
