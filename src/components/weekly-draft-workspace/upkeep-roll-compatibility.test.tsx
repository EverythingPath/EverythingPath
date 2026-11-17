import {
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
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import type { RawRoll } from '~/lib/weekly-draft-facts';
import { derivePhaseReadiness } from './phase-readiness';
import { phaseView } from './phase-view';
import { UpkeepView } from './upkeep-view';
import type { UpkeepView as UpkeepFacts } from './types';

// The warning identities Upkeep reports to readiness and This phase.
function upkeepWarningIds(...facts: Parameters<typeof derivePhaseReadiness>) {
  const upkeep = derivePhaseReadiness(...facts).phases.find(
    (phase) => phase.phase === 'upkeep',
  );
  return upkeep?.warnings.map((warning) => warning.id) ?? [];
}

function total(sides: number, diceCount: number, diceTotal: number): RawRoll {
  return {
    sides,
    diceCount,
    diceTotal,
    provenance: { kind: 'table' },
    modifiers: [],
  };
}
const table = { kind: 'table' as const };

function fixture(
  configure: (
    draft: ReturnType<typeof upkeepFixture>['draft'],
    snapshot: ReturnType<typeof upkeepFixture>['snapshot'],
  ) => void,
) {
  const { draft, snapshot } = upkeepFixture();
  snapshot.treasuryCopper = 10000;
  snapshot.training = 20;
  configure(draft, snapshot);
  const source = workspaceSourceSchema.parse({
    key: {
      campaignId: 'campaign',
      militiaId: 'militia',
      draftId: draft.draftId,
    },
    week: draft.week,
    sourceRevision: 0,
    snapshot,
    people: [{ characterId: 'pc', name: 'Aubrin' }],
  });
  const preview = projectWeeklyDraft({
    revision: draft,
    militiaSnapshot: source.snapshot,
  });
  const view = phaseView('upkeep', draft, source, preview);
  if (view.phase !== 'upkeep') throw new Error('Expected Upkeep');
  return { draft, source, view, preview };
}
function missingScouts(snapshot: ReturnType<typeof upkeepFixture>['snapshot']) {
  snapshot.roster.teams.push({
    teamId: 'scouts',
    teamType: 'patrons',
    name: 'Scouts',
    status: 'missing',
    managerCharacterId: null,
    rewardCapExempt: false,
    notes: '',
  });
}
function returnCheck(view: UpkeepFacts) {
  const row = view.sections?.teams.missing.find(
    (team) => team.teamId === 'scouts',
  )?.return;
  if (row?.kind !== 'check') throw new Error('Expected a return check');
  return row.check;
}
const textbox = (name: string) => screen.getByRole('textbox', { name });

test('[rules.WEEK-15.upkeep-total] a recorded 2d4 total is complete, shows in the one total field without writing, and a blank clears through the existing nullable edit', () => {
  // Check 4 + 3 fails DC 10, so the attrition training roll is 2d4.
  const { view, preview } = fixture((draft) => {
    draft.upkeep.rolls = { check: roll(20, 4), training: total(4, 2, 7) };
  });
  const training = view.rolls.find((fact) => fact.field === 'training')!;
  expect(training).toMatchObject({ count: 2, sides: 4 });
  expect(training.normalized).toMatchObject({
    status: 'complete',
    diceTotal: 7,
    naturalValue: null,
    rangeWarning: null,
  });
  expect(
    preview.requirements.filter((key) => key.startsWith('upkeep:')),
  ).toEqual([]);
  expect(view.ready).toBe(true);
  const edit = vi.fn<(edit: WeeklyDraftEdit) => void>();
  render(<UpkeepView view={view} edit={edit} disabled={false} />);
  expect(textbox('Attrition training roll')).toHaveValue('7');
  expect(screen.getByText('2d4 · total of the dice only')).toBeVisible();
  expect(
    screen.queryByRole('textbox', { name: /die/ }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText('A value is required.')).not.toBeInTheDocument();
  // The complete check shows its value the same way, with no write.
  expect(textbox('Attrition Loyalty roll')).toHaveValue('4');
  expect(edit).not.toHaveBeenCalled();
  fireEvent.change(textbox('Attrition training roll'), {
    target: { value: '' },
  });
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'upkeep_roll',
    field: 'training',
    roll: null,
  });
});

test('[rules.WEEK-15.upkeep-writer] editing a number writes the strict total against the live 2d4 specification and preserves the prior provenance and modifiers', () => {
  const generated = { kind: 'generated' as const, sourceId: 'roller' };
  const modifiers = [{ sourceId: 'helpful', value: 1, reason: 'Allies' }];
  const { view } = fixture((draft) => {
    draft.upkeep.rolls = {
      check: {
        diceTotal: 4,
        diceCount: 1,
        sides: 20,
        provenance: generated,
        modifiers,
      },
      training: roll(4, 3, 4),
    };
  });
  const edit = vi.fn<(edit: WeeklyDraftEdit) => void>();
  render(<UpkeepView view={view} edit={edit} disabled={false} />);
  // A recorded total displays without a write.
  expect(textbox('Attrition training roll')).toHaveValue('7');
  expect(edit).not.toHaveBeenCalled();
  fireEvent.change(textbox('Attrition training roll'), {
    target: { value: '6' },
  });
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'upkeep_roll',
    field: 'training',
    roll: {
      diceTotal: 6,
      diceCount: 2,
      sides: 4,
      provenance: table,
      modifiers: [],
    },
  });
  fireEvent.change(textbox('Attrition Loyalty roll'), {
    target: { value: '12' },
  });
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'upkeep_roll',
    field: 'check',
    roll: {
      diceTotal: 12,
      diceCount: 1,
      sides: 20,
      provenance: generated,
      modifiers,
    },
  });
});

test('[rules.WEEK-15.upkeep-zero] a recorded total of zero is visible with its range warning and stays complete', () => {
  const { draft, source, view, preview } = fixture((draft) => {
    draft.upkeep.rolls = { check: total(20, 1, 0) };
  });
  const check = view.rolls.find((fact) => fact.field === 'check')!;
  expect(check.normalized).toMatchObject({
    status: 'complete',
    diceTotal: 0,
    naturalValue: 0,
    rangeWarning: 'total',
  });
  expect(preview.warnings).toContain('upkeep:attrition:roll-range');
  render(<UpkeepView view={view} edit={vi.fn()} disabled={false} />);
  expect(textbox('Attrition Loyalty roll')).toHaveValue('0');
  // One inline advisory under the field; the step's notes do not repeat it.
  // The warning itself still reaches This phase and the Summary.
  expect(screen.getByText(/usual range is 1–20/)).toBeVisible();
  expect(
    screen.queryByText(/outside the usual 1–20 range/),
  ).not.toBeInTheDocument();
  expect(upkeepWarningIds(draft, source, preview)).toContain(
    'upkeep:attrition:roll-range',
  );
});

test('[rules.WEEK-15.upkeep-wrong-spec] a total recorded for a different specification stays incomplete, shows what the step needs and is replaced only by a deliberate edit', () => {
  const { view, preview } = fixture((draft) => {
    draft.upkeep.rolls = { check: roll(20, 4), training: total(6, 1, 5) };
  });
  const training = view.rolls.find((fact) => fact.field === 'training')!;
  expect(training.normalized.status).toBe('incomplete');
  expect(preview.requirements).toContain('upkeep:attrition-training:dice:2d4');
  const edit = vi.fn<(edit: WeeklyDraftEdit) => void>();
  render(<UpkeepView view={view} edit={edit} disabled={false} />);
  expect(textbox('Attrition training roll')).toHaveValue('');
  expect(
    screen.getByText(
      /Recorded total 5 was entered for 1d6, but this step needs 2d4/,
    ),
  ).toBeVisible();
  expect(edit).not.toHaveBeenCalled();
  fireEvent.change(textbox('Attrition training roll'), {
    target: { value: '5' },
  });
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'upkeep_roll',
    field: 'training',
    roll: {
      diceTotal: 5,
      diceCount: 2,
      sides: 4,
      provenance: table,
      modifiers: [],
    },
  });
});

test('[rules.WEEK-15.upkeep-natural] a single-die total of 20 keeps natural-20 attrition semantics while a multi-die 20 never does', () => {
  const natural = fixture((draft) => {
    draft.upkeep.rolls = { check: total(20, 1, 20), training: total(6, 1, 6) };
  });
  expect(
    natural.view.rolls.find((fact) => fact.field === 'training'),
  ).toMatchObject({ count: 1, sides: 6 });
  expect(natural.view.after.training).toBe(26);
  const twoDice = fixture((draft) => {
    draft.upkeep.rolls = { check: roll(20, 4), training: total(4, 2, 20) };
  });
  const training = twoDice.view.rolls.find(
    (fact) => fact.field === 'training',
  )!;
  expect(training.normalized).toMatchObject({
    status: 'complete',
    naturalValue: null,
    rangeWarning: 'total',
  });
});

test('[rules.WEEK-15.upkeep-team-roll] a missing team’s recorded return total shows in its field, is replaced exactly by a new total and clears through the decision edit', () => {
  const { view } = fixture((draft, snapshot) => {
    missingScouts(snapshot);
    draft.upkeep.rolls = { check: roll(20, 10), training: roll(6, 3) };
    draft.upkeep.teamDecisions = [
      { teamId: 'scouts', decision: 'leave', roll: total(20, 1, 1) },
    ];
  });
  const team = returnCheck(view);
  expect(team.recorded).toEqual(total(20, 1, 1));
  expect(team.normalized).toMatchObject({
    status: 'complete',
    naturalValue: 1,
  });
  const edit = vi.fn<(edit: WeeklyDraftEdit) => void>();
  render(<UpkeepView view={view} edit={edit} disabled={false} />);
  const card = screen.getByRole('group', { name: 'Scouts return check' });
  const field = within(card).getByRole('textbox', {
    name: 'Scouts return roll',
  });
  expect(field).toHaveValue('1');
  // A missing team has no Recover / Leave choice; only its return check.
  expect(
    within(card).queryByRole('button', { name: /recover|leave/i }),
  ).not.toBeInTheDocument();
  fireEvent.change(field, { target: { value: '17' } });
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'upkeep_team',
    teamId: 'scouts',
    decision: {
      teamId: 'scouts',
      decision: 'leave',
      roll: total(20, 1, 17),
    },
  });
  fireEvent.change(field, { target: { value: '' } });
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'upkeep_team',
    teamId: 'scouts',
    decision: { teamId: 'scouts', decision: 'leave' },
  });
});

test('a missing team’s out-of-range return total shows one advisory in its card, under the field', () => {
  const { draft, source, view, preview } = fixture((draft, snapshot) => {
    missingScouts(snapshot);
    draft.upkeep.rolls = { check: roll(20, 10), training: roll(6, 3) };
    draft.upkeep.teamDecisions = [
      { teamId: 'scouts', decision: 'leave', roll: total(20, 1, 0) },
    ];
  });
  expect(preview.warnings).toContain('team:scouts:return:roll-range');
  render(<UpkeepView view={view} edit={vi.fn()} disabled={false} />);
  const card = screen.getByRole('group', { name: 'Scouts return check' });
  expect(within(card).getByText(/usual range is 1–20/)).toBeVisible();
  expect(
    within(card).queryByText(/outside the usual 1–20 range/),
  ).not.toBeInTheDocument();
  expect(upkeepWarningIds(draft, source, preview)).toContain(
    'team:scouts:return:roll-range',
  );
});

test.each([
  ['wrong sides', total(6, 1, 5), 'Recorded total 5 was entered for 1d6'],
  ['wrong count', total(20, 2, 25), 'Recorded total 25 was entered for 2d20'],
])(
  '[rules.WEEK-15.upkeep-team-incompatible] a missing team’s %s return roll stays visible with its explanation, can be cleared, and a deliberate total replaces it',
  (_label, recorded, explanation) => {
    const { view, preview } = fixture((draft, snapshot) => {
      missingScouts(snapshot);
      draft.upkeep.rolls = { check: roll(20, 10), training: roll(6, 3) };
      draft.upkeep.teamDecisions = [
        {
          teamId: 'scouts',
          decision: 'leave',
          roll: recorded,
        },
      ];
    });
    expect(preview.requirements).toContain('team:scouts:return:dice:1d20');
    // The incompatible roll keeps the return check row open for repair.
    expect(returnCheck(view).normalized.status).toBe('incomplete');
    const edit = vi.fn<(edit: WeeklyDraftEdit) => void>();
    render(<UpkeepView view={view} edit={edit} disabled={false} />);
    const card = screen.getByRole('group', { name: 'Scouts return check' });
    const field = within(card).getByRole('textbox', {
      name: 'Scouts return roll',
    });
    expect(field).toHaveValue('');
    expect(within(card).getByText(new RegExp(explanation))).toBeVisible();
    fireEvent.click(
      within(card).getByRole('button', { name: 'Clear scouts return roll' }),
    );
    expect(edit).toHaveBeenLastCalledWith({
      kind: 'upkeep_team',
      teamId: 'scouts',
      decision: { teamId: 'scouts', decision: 'leave' },
    });
    // The explicit clear discards the field's local state, so query it again.
    fireEvent.change(
      within(card).getByRole('textbox', { name: 'Scouts return roll' }),
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
          provenance: table,
          modifiers: [],
        },
      },
    });
  },
);

test('[rules.WEEK-14.upkeep-malformed] malformed totals never reach the edit and required feedback is distinct from format errors', async () => {
  const { view } = fixture((draft) => {
    draft.upkeep.rolls = { check: roll(20, 4) };
  });
  const edit = vi.fn<(edit: WeeklyDraftEdit) => void>();
  render(<UpkeepView view={view} edit={edit} disabled={false} />);
  const field = textbox('Attrition training roll');
  const alerts = () =>
    screen.getAllByRole('alert').map((alert) => alert.textContent);
  for (const invalid of ['-1', '2.5', '1e1', ' 7', '７']) {
    fireEvent.change(field, { target: { value: invalid } });
    expect(field).toHaveValue('');
    expect(alerts()).toContain('Use digits only.');
  }
  expect(edit).not.toHaveBeenCalled();
  // Leaving the field keeps the rejected-input error; once the field is
  // validly empty again, focus loss reports the ordinary required feedback.
  fireEvent.blur(field);
  expect(alerts()).toContain('Use digits only.');
  fireEvent.change(field, { target: { value: '3' } });
  fireEvent.change(field, { target: { value: '' } });
  fireEvent.blur(field);
  await waitFor(() => expect(alerts()).toContain('A value is required.'));
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'upkeep_roll',
    field: 'training',
    roll: null,
  });
});
