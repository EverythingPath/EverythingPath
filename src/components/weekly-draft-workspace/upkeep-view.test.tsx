import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { upkeepFixture, roll } from '../../../tests/rules/upkeep-fixture';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import { projectWeeklyDraft } from '~/lib/canonical-weekly-resolution';
import { editWeeklyDraft } from '~/lib/weekly-draft';
import type { UpkeepSnapshot } from '~/lib/rules-upkeep';
import type { WeeklyDraft, WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import { phaseView } from './phase-view';
import { UpkeepView } from './upkeep-view';

type Team = UpkeepSnapshot['roster']['teams'][number];
function team(teamId: string, status: Team['status']): Team {
  return {
    teamId,
    teamType: 'patrons',
    name: teamId[0]!.toUpperCase() + teamId.slice(1),
    status,
    managerCharacterId: null,
    rewardCapExempt: false,
    notes: '',
  };
}

// Rank 3 (minimum treasury 30 gp), training 20, treasury 100 gp, and a
// resolved attrition check unless arranged otherwise.
function fixture(
  arrange: (draft: WeeklyDraft, snapshot: UpkeepSnapshot) => void = () =>
    undefined,
) {
  const { draft, snapshot } = upkeepFixture();
  snapshot.treasuryCopper = 10000;
  snapshot.training = 20;
  draft.upkeep.rolls = { check: roll(20, 10), training: roll(6, 3) };
  draft.event.chanceRoll = roll(100, 100);
  arrange(draft, snapshot);
  const source = workspaceSourceSchema.parse({
    key: {
      campaignId: 'campaign',
      militiaId: 'militia',
      draftId: draft.draftId,
    },
    week: draft.week,
    sourceRevision: 0,
    snapshot,
    people: [
      {
        characterId: 'pc',
        name: 'A very long officer name that still remains readable',
      },
    ],
  });
  const preview = projectWeeklyDraft({
    revision: draft,
    militiaSnapshot: source.snapshot,
  });
  const view = phaseView('upkeep', draft, source, preview);
  if (view.phase !== 'upkeep') throw new Error('Expected Upkeep');
  return { draft, source, view };
}

function renderView(
  view: ReturnType<typeof fixture>['view'],
  options: { disabled?: boolean } = {},
) {
  const edit = vi.fn<(edit: WeeklyDraftEdit) => void>();
  render(
    <UpkeepView view={view} edit={edit} disabled={options.disabled ?? false} />,
  );
  return edit;
}

const section = (name: string) => screen.getByRole('region', { name });
const group = (name: string) => screen.getByRole('group', { name });

test('a disabled team offers Recover and Leave disabled, and the shortage step waits for the decision', () => {
  // Recovering would leave 20 gp, below the 30 gp minimum; leaving would not.
  const { view } = fixture((_, snapshot) => {
    snapshot.treasuryCopper = 5000;
    snapshot.roster.teams.push(team('scouts', 'disabled'));
  });
  const edit = renderView(view);
  const card = group('Scouts team condition');
  expect(within(card).getByText('Patrons · tier 1')).toBeVisible();
  expect(within(card).getByText('Disabled')).toBeVisible();
  expect(within(card).getByText('Pay 30 gp now')).toBeVisible();
  expect(
    within(card).queryByRole('button', { name: /remove/i }),
  ).not.toBeInTheDocument();
  fireEvent.click(within(card).getByRole('button', { name: 'Recover' }));
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'upkeep_team',
    teamId: 'scouts',
    decision: { teamId: 'scouts', decision: 'recover', costCopper: 3000 },
    recoveryAdjustment: null,
  });
  fireEvent.click(within(card).getByRole('button', { name: 'Leave disabled' }));
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'upkeep_team',
    teamId: 'scouts',
    decision: { teamId: 'scouts', decision: 'leave' },
  });
  expect(section('Team conditions')).toHaveTextContent('Decision needed');
  expect(section('Treasury shortage')).toHaveTextContent(
    'Waiting for team recovery decisions',
  );
  // Recovery without a decision shows no cost form yet.
  expect(
    screen.queryByLabelText('Scouts: Recovery cost (gp)'),
  ).not.toBeInTheDocument();
});

test('[rules.P81.recovery-adjustment] the recovery cost is entered in gp, a changed price needs a reason and becomes a post-baseline adjustment, and Use rules cost restores the baseline', async () => {
  const { draft, source, view } = fixture((draft, snapshot) => {
    snapshot.roster.teams.push(team('scouts', 'disabled'));
    draft.upkeep.teamDecisions = [
      { teamId: 'scouts', decision: 'recover', costCopper: 3000 },
    ];
  });
  const edit = renderView(view);
  const card = group('Scouts team condition');
  const recover = within(card).getByRole('button', { name: 'Recover' });
  expect(recover).toHaveAttribute('aria-pressed', 'true');
  // Re-selecting the staged choice sends nothing.
  fireEvent.click(recover);
  expect(edit).not.toHaveBeenCalled();
  const cost = within(card).getByLabelText('Scouts: Recovery cost (gp)');
  expect(cost).toHaveValue('30');
  expect(
    within(card).getByText('Rules cost 30 gp (minimum treasury)'),
  ).toBeVisible();
  expect(
    within(card).queryByLabelText('Scouts: Reason for the changed cost'),
  ).not.toBeInTheDocument();
  fireEvent.change(cost, { target: { value: '25' } });
  expect(
    await within(card).findByText(
      'A reason is required for a changed recovery cost.',
    ),
  ).toBeVisible();
  expect(within(card).getByText(/Table Adjustment \+5 gp/)).toBeVisible();
  expect(edit).not.toHaveBeenCalled();
  fireEvent.change(
    within(card).getByLabelText('Scouts: Reason for the changed cost'),
    {
      target: { value: 'Local healers discount' },
    },
  );
  await waitFor(() => expect(edit).toHaveBeenCalledTimes(1));
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'upkeep_team',
    teamId: 'scouts',
    decision: { teamId: 'scouts', decision: 'recover', costCopper: 3000 },
    recoveryAdjustment: { deltaCopper: 500, reason: 'Local healers discount' },
  });
  const result = editWeeklyDraft(draft, edit.mock.calls[0]![0]);
  if (!result.ok) throw new Error(result.error);
  const preview = projectWeeklyDraft({
    revision: result.draft,
    militiaSnapshot: source.snapshot,
  });
  expect(preview.requirements).toEqual([]);
  expect(preview.baseline?.militiaSnapshot.treasuryCopper).toBe(7000);
  expect(preview.outcome?.militiaSnapshot.treasuryCopper).toBe(7500);
  fireEvent.click(within(card).getByRole('button', { name: 'Use rules cost' }));
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'upkeep_team',
    teamId: 'scouts',
    decision: { teamId: 'scouts', decision: 'recover', costCopper: 3000 },
    recoveryAdjustment: null,
  });
  await waitFor(() => expect(cost).toHaveValue('30'));
  // A malformed price stays local with its own error and never saves.
  edit.mockClear();
  fireEvent.change(cost, { target: { value: '12a' } });
  expect(
    await within(card).findByText('Enter an amount in gp, such as 12 or 0.07.'),
  ).toBeVisible();
  expect(edit).not.toHaveBeenCalled();
});

test('a staged recovery price shows as a Table Adjustment after the Rules Baseline', () => {
  const { view } = fixture((draft, snapshot) => {
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
        value: 500,
        reason: 'Local healers discount',
      },
    ];
  });
  renderView(view);
  const teams = section('Team conditions');
  expect(teams).toHaveTextContent('Treasury −30 gp');
  expect(
    within(teams).getByText('Rules Baseline: treasury 100 gp → 70 gp'),
  ).toBeVisible();
  expect(
    within(teams).getByText(
      'Table Adjustments after the weekly rules: Scouts recovery price +5 gp',
    ),
  ).toBeVisible();
  expect(
    within(teams).getByLabelText('Scouts: Recovery cost (gp)'),
  ).toHaveValue('25');
  expect(
    within(teams).getByLabelText('Scouts: Reason for the changed cost'),
  ).toHaveValue('Local healers discount');
});

test('[rules.P81.warning-context] a recovery beyond the treasury asks for its reasoned exception under the team, and nothing repeats it at the bottom', () => {
  const { view } = fixture((draft, snapshot) => {
    snapshot.treasuryCopper = 1000;
    snapshot.roster.teams.push(team('scouts', 'disabled'));
    snapshot.characters[0]!.isActive = false;
    draft.upkeep.teamDecisions = [
      { teamId: 'scouts', decision: 'recover', costCopper: 3000 },
    ];
  });
  const edit = renderView(view);
  const card = group('Scouts team condition');
  expect(
    within(card).getByText(/Scouts recovery costs more than the available/),
  ).toHaveAttribute('role', 'note');
  const reason = within(card).getByLabelText('Reason for the rules exception');
  fireEvent.change(reason, { target: { value: 'The mayor covers it' } });
  fireEvent.click(
    within(card).getByRole('button', { name: 'Record decision' }),
  );
  return waitFor(() => {
    expect(edit).toHaveBeenLastCalledWith({
      kind: 'rules_exception',
      exception: {
        exceptionId: 'upkeep:upkeep-recovery-funds:scouts',
        subjectId: 'scouts',
        ruleId: 'upkeep-recovery-funds',
        reason: 'The mayor covers it',
      },
    });
    expect(screen.queryByText(/Table ruling ·/)).not.toBeInTheDocument();
    // A warning no item owns is listed once at the end, without identifiers.
    expect(
      screen.getByText(/A very long officer name.*archived/),
    ).toBeVisible();
    expect(screen.queryByText(/officer:pc/)).not.toBeInTheDocument();
  });
});

test('a recorded rules exception can be cleared from its team', () => {
  const { view } = fixture((draft, snapshot) => {
    snapshot.treasuryCopper = 1000;
    snapshot.roster.teams.push(team('scouts', 'disabled'));
    draft.upkeep.teamDecisions = [
      { teamId: 'scouts', decision: 'recover', costCopper: 3000 },
    ];
    draft.rulesExceptions = [
      {
        exceptionId: 'x1',
        subjectId: 'scouts',
        ruleId: 'upkeep-recovery-funds',
        reason: 'The mayor covers it',
      },
    ];
  });
  const edit = renderView(view);
  const card = group('Scouts team condition');
  expect(
    within(card).getByLabelText('Reason for the rules exception'),
  ).toHaveValue('The mayor covers it');
  fireEvent.click(within(card).getByRole('button', { name: 'Clear decision' }));
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'clear_rules_exception',
    exceptionId: 'x1',
  });
});

test.each([
  [1, 'Natural 1: the team is lost for good'],
  [2, 'Stays missing'],
  [19, 'Returns at the end of the week — can’t act in this week’s Activity'],
])(
  'a missing team’s return check row shows its DC, bonus and result for a die of %i',
  (die, result) => {
    const { view } = fixture((draft, snapshot) => {
      snapshot.roster.teams.push(team('scouts', 'missing'));
      draft.upkeep.teamDecisions = [
        { teamId: 'scouts', decision: 'leave', roll: roll(20, die) },
      ];
    });
    const edit = renderView(view);
    const row = group('Scouts return check');
    expect(within(row).getByText('Missing')).toBeVisible();
    expect(
      within(row).getByText('Return check · Security DC 15'),
    ).toBeVisible();
    expect(row).toHaveTextContent(/bonus \+\d+ = total \d+/);
    expect(within(row).getByText(result)).toBeVisible();
    expect(
      within(row).queryByRole('button', { name: /recover|leave|remove/i }),
    ).not.toBeInTheDocument();
    fireEvent.change(
      within(row).getByRole('textbox', { name: 'Scouts return roll' }),
      { target: { value: '12' } },
    );
    expect(edit).toHaveBeenLastCalledWith({
      kind: 'upkeep_team',
      teamId: 'scouts',
      decision: {
        teamId: 'scouts',
        decision: 'leave',
        roll: {
          diceTotal: 12,
          diceCount: 1,
          sides: 20,
          provenance: { kind: 'table' },
          modifiers: [],
        },
      },
    });
  },
);

test('a scheduled return replaces the roll with the week it comes back', () => {
  const { view } = fixture((draft, snapshot) => {
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
  renderView(view);
  const row = group('Scouts return check');
  expect(
    within(row).getByText('Returns at the end of week 40 as a disabled team'),
  ).toBeVisible();
  expect(within(row).queryByRole('textbox')).not.toBeInTheDocument();
  expect(section('Team conditions')).toHaveTextContent('No cost');
});

test('a staged decision for a team no longer on the roster can be cleared', () => {
  const { view } = fixture((draft) => {
    draft.upkeep.teamDecisions = [
      { teamId: 'gone', decision: 'recover', costCopper: 3000 },
    ];
  });
  const edit = renderView(view);
  const row = group('Staged decision for a removed team');
  expect(
    within(row).getByText(
      'A staged decision refers to a team that is no longer on the roster.',
    ),
  ).toHaveAttribute('role', 'note');
  fireEvent.click(
    within(row).getByRole('button', { name: 'Clear staged decision' }),
  );
  expect(edit).toHaveBeenCalledWith({
    kind: 'upkeep_team',
    teamId: 'gone',
    decision: null,
  });
  expect(screen.queryByText(/\bgone\b/)).not.toBeInTheDocument();
});

test('steps that do not apply collapse to one line with their reason, and later steps say what they wait for', () => {
  const { view } = fixture((draft, snapshot) => {
    snapshot.notoriety = 64;
    draft.upkeep.rolls = {};
  });
  renderView(view);
  expect(section('Team conditions')).toHaveTextContent(
    'No disabled or missing teams',
  );
  expect(
    within(section('Team conditions')).queryByText(/Rules Baseline/),
  ).not.toBeInTheDocument();
  expect(section('Maximum notoriety')).toHaveTextContent(
    'Not this week · notoriety is 64 of 100',
  );
  expect(
    within(section('Maximum notoriety')).queryByRole('textbox'),
  ).not.toBeInTheDocument();
  expect(section('Treasury shortage')).toHaveTextContent(
    'Not this week · 100 gp after recovery, minimum 30 gp',
  );
  expect(section('Training attrition')).toHaveTextContent('Roll needed');
  expect(section('Training attrition')).toHaveTextContent('Loyalty DC 10');
  expect(
    screen.getByText(
      'The training roll appears once the check is in: 1d6 on a success, 2d4 + rank 3 on a failure.',
    ),
  ).toBeVisible();
  expect(
    screen.queryByRole('textbox', { name: 'Attrition training roll' }),
  ).not.toBeInTheDocument();
  expect(section('Rank')).toHaveTextContent('Waiting for the steps above');
  expect(section('Deposits and withdrawals')).toHaveTextContent(
    'Waiting for the steps above',
  );
  // Nothing from the old layout: no outcome tiles, no bottom hint.
  expect(screen.queryByText(/Training after Upkeep/)).not.toBeInTheDocument();
  expect(
    screen.queryByText(/Complete the required rolls/),
  ).not.toBeInTheDocument();
});

test('resolved attrition reports its own training change with the failure notation', () => {
  const { view } = fixture((draft) => {
    draft.upkeep.rolls = { check: roll(20, 2), training: roll(4, 3, 2) };
  });
  renderView(view);
  const attrition = section('Training attrition');
  expect(attrition).toHaveTextContent(
    'Failure: training drops by the training roll + rank 3',
  );
  // The dice are stated once, on the loss field; the rank sits beside it.
  expect(
    within(attrition).getByText('2d4 · total of the dice only'),
  ).toBeVisible();
  expect(
    within(attrition).getByText('Rank 3 is added by the rules'),
  ).toBeVisible();
  expect(within(attrition).getAllByText('Training −8')).toHaveLength(2);
  expect(section('Rank')).toHaveTextContent('Stays rank 3');
  expect(section('Deposits and withdrawals')).toHaveTextContent(
    'Treasury 100 gp → 100 gp',
  );
  expect(screen.getByRole('button', { name: 'Add' })).toBeVisible();
});

test('maximum notoriety asks for the nearest settlement after a failed check and clears it on a second tap', () => {
  const { view } = fixture((draft, snapshot) => {
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
    draft.upkeep.rolls = { ...draft.upkeep.rolls, notoriety: roll(20, 5) };
    draft.upkeep.notorietyCheck = roll(20, 2);
  });
  const edit = renderView(view);
  const notoriety = section('Maximum notoriety');
  expect(notoriety).toHaveTextContent('Training −8');
  expect(
    within(notoriety).getByText('Rank 3 is added by the rules'),
  ).toBeVisible();
  expect(notoriety).toHaveTextContent('Loyalty DC 15');
  expect(notoriety).toHaveTextContent('Failure');
  expect(
    within(notoriety).getByText('required: its reputation drops one step'),
  ).toBeVisible();
  const phaendar = within(notoriety).getByRole('button', { name: 'Phaendar' });
  expect(phaendar).toHaveTextContent('Friendly');
  fireEvent.click(phaendar);
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'upkeep_settlement',
    settlementId: 'phaendar',
  });
  cleanup();
  const selected = fixture((draft, snapshot) => {
    snapshot.notoriety = 100;
    snapshot.settlements = view.sections!.notoriety.settlement!.choices.map(
      (choice) => ({
        settlementId: choice.settlementId,
        name: choice.name,
        reputation: 'Friendly',
        secured: null,
        occupied: null,
        temporaryReputationShift: null,
        refugeActivatedWeek: null,
        refugeActiveUntilWeek: null,
      }),
    );
    draft.upkeep.rolls = { ...draft.upkeep.rolls, notoriety: roll(20, 5) };
    draft.upkeep.notorietyCheck = roll(20, 2);
    draft.upkeep.nearestSettlementId = 'phaendar';
  });
  const clear = renderView(selected.view);
  expect(section('Maximum notoriety')).toHaveTextContent(
    'Phaendar: Friendly → Indifferent',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Phaendar' }));
  expect(clear).toHaveBeenLastCalledWith({
    kind: 'upkeep_settlement',
    settlementId: null,
  });
});

test('a passed notoriety check needs the settlement only as a fallback', () => {
  const { view } = fixture((draft, snapshot) => {
    snapshot.notoriety = 100;
    snapshot.settlements = [];
    draft.upkeep.rolls = { ...draft.upkeep.rolls, notoriety: roll(20, 5) };
    draft.upkeep.notorietyCheck = roll(20, 20);
  });
  renderView(view);
  expect(
    screen.getByText('needed only if the Loyalty check fails'),
  ).toBeVisible();
});

test('the first week shows only that Upkeep is skipped', () => {
  const { view } = fixture((draft) => {
    draft.context = { ...draft.context, firstMilitiaWeek: true };
  });
  renderView(view);
  const upkeep = section('Upkeep');
  expect(
    within(upkeep).getByText('Upkeep is skipped for the militia’s first week.'),
  ).toBeVisible();
  expect(
    within(upkeep).getByText(
      'No team recovery, attrition, rank or transfers this week.',
    ),
  ).toBeVisible();
  expect(within(upkeep).queryByRole('textbox')).not.toBeInTheDocument();
  expect(within(upkeep).queryByRole('button')).not.toBeInTheDocument();
});

test('the Confirmation lock disables every Upkeep control', () => {
  const { view } = fixture((draft, snapshot) => {
    snapshot.notoriety = 100;
    snapshot.treasuryCopper = 1000;
    snapshot.roster.teams.push(
      team('scouts', 'disabled'),
      team('riders', 'missing'),
    );
    draft.upkeep.teamDecisions = [
      { teamId: 'scouts', decision: 'recover', costCopper: 3000 },
    ];
    draft.upkeep.rolls = { check: roll(20, 2) };
  });
  renderView(view, { disabled: true });
  const controls = [
    ...screen.getAllByRole('button'),
    ...screen.getAllByRole('textbox'),
  ];
  expect(controls.length).toBeGreaterThan(6);
  for (const control of controls) expect(control).toBeDisabled();
});

test('[rules.P81.recovery-arbitration] disjoint recoveries coexist while stale edits cannot partially overwrite a team and its adjustment', async () => {
  const { draft, source } = fixture((_, snapshot) => {
    snapshot.roster.teams.push(team('scouts', 'disabled'));
  });
  source.snapshot.roster.teams.push({
    ...source.snapshot.roster.teams[0]!,
    teamId: 'second',
    name: 'Second team',
  });
  const { createMemoryDraftAuthority } =
    await import('~/lib/memory-draft-persistence');
  const authority = createMemoryDraftAuthority(draft, source.snapshot);
  const request = (teamId: string) => ({
    draftId: draft.draftId,
    operationId: teamId,
    baseRevision: 0,
    edit: {
      kind: 'upkeep_team' as const,
      teamId,
      decision: { teamId, decision: 'recover' as const, costCopper: 3000 },
      recoveryAdjustment: { deltaCopper: 500, reason: 'Local discount' },
    },
  });
  await authority.transport.send(request('scouts'));
  await authority.transport.send(request('second'));
  const before = await authority.transport.read();
  expect(before.draft?.upkeep.teamDecisions).toHaveLength(2);
  expect(before.draft?.tableAdjustments).toHaveLength(2);
  await expect(
    authority.transport.send({
      draftId: draft.draftId,
      operationId: 'stale-adjustment',
      baseRevision: 0,
      edit: { kind: 'table_adjustments', adjustments: [] },
    }),
  ).rejects.toThrow();
  expect(await authority.transport.read()).toEqual(before);
  await authority.transport.send({
    draftId: draft.draftId,
    operationId: 'adjudicate',
    baseRevision: 2,
    edit: {
      kind: 'table_adjustments',
      adjustments: [
        {
          kind: 'militia_value',
          adjustmentId: 'upkeep-recovery:scouts',
          field: 'treasuryCopper',
          operation: 'add',
          value: 250,
          reason: 'Revised discount',
        },
      ],
    },
  });
  const adjusted = await authority.transport.read();
  await expect(
    authority.transport.send({
      draftId: draft.draftId,
      operationId: 'stale-leave',
      baseRevision: 2,
      edit: {
        kind: 'upkeep_team',
        teamId: 'scouts',
        decision: { teamId: 'scouts', decision: 'leave' },
      },
    }),
  ).rejects.toThrow();
  expect(await authority.transport.read()).toEqual(adjusted);
});

test('leaving a recovering team disabled also clears its recorded recovery-funds ruling', () => {
  const { view } = fixture((draft, snapshot) => {
    snapshot.treasuryCopper = 1000;
    snapshot.roster.teams.push(team('scouts', 'disabled'));
    draft.upkeep.teamDecisions = [
      { teamId: 'scouts', decision: 'recover', costCopper: 3000 },
    ];
    draft.rulesExceptions = [
      {
        exceptionId: 'x1',
        subjectId: 'scouts',
        ruleId: 'upkeep-recovery-funds',
        reason: 'The mayor covers it',
      },
    ];
  });
  const edit = renderView(view);
  fireEvent.click(
    within(group('Scouts team condition')).getByRole('button', {
      name: 'Leave disabled',
    }),
  );
  expect(edit.mock.calls.map(([item]) => item)).toEqual([
    {
      kind: 'upkeep_team',
      teamId: 'scouts',
      decision: { teamId: 'scouts', decision: 'leave' },
    },
    { kind: 'clear_rules_exception', exceptionId: 'x1' },
  ]);
});

test('rank names its own missing player-character level instead of waiting on earlier steps', () => {
  const { view } = fixture((_, snapshot) => {
    snapshot.characters = snapshot.characters.map((character) => ({
      ...character,
      isActive: false,
    }));
  });
  renderView(view);
  const rank = section('Rank');
  expect(rank).toHaveTextContent('Highest player-character level needed');
  expect(rank).not.toHaveTextContent('Waiting for the steps above');
  expect(within(rank).getByRole('note')).toHaveTextContent(
    'no active player character is on the roster',
  );
});
