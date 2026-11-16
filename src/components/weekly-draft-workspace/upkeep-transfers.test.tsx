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
import type { UpkeepSnapshot } from '~/lib/rules-upkeep';
import type { WeeklyDraft, WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import { phaseView } from './phase-view';
import { UpkeepView } from './upkeep-view';

// Rank 3, treasury 30 gp, resolved attrition, and no officers at all: the
// transfer controls never ask for a character.
function renderTransfers(
  arrange: (draft: WeeklyDraft, snapshot: UpkeepSnapshot) => void = () =>
    undefined,
  disabled = false,
) {
  const { draft, snapshot } = upkeepFixture();
  snapshot.training = 15;
  snapshot.roster.officers = [];
  draft.upkeep.rolls = { check: roll(20, 7), training: roll(6, 1) };
  arrange(draft, snapshot);
  const source = workspaceSourceSchema.parse({
    key: { campaignId: 'campaign', militiaId: 'militia', draftId: 'draft' },
    week: draft.week,
    sourceRevision: 0,
    snapshot,
    people: [{ characterId: 'pc', name: 'Ameiko' }],
  });
  const view = phaseView(
    'upkeep',
    draft,
    source,
    projectWeeklyDraft({ revision: draft, militiaSnapshot: snapshot }),
  );
  if (view.phase !== 'upkeep') throw new Error('Expected Upkeep');
  const edit = vi.fn<(edit: WeeklyDraftEdit) => void>();
  render(<UpkeepView view={view} edit={edit} disabled={disabled} />);
  return {
    edit,
    step: screen.getByRole('region', { name: 'Deposits and withdrawals' }),
  };
}

const amount = (step: HTMLElement) =>
  within(step).getByRole('textbox', { name: 'Transfer amount (gp)' });

test('[rules.UPK-10.add] a deposit or withdrawal is added in gp as exact copper with no character to choose', async () => {
  const { edit, step } = renderTransfers();
  expect(step).toHaveTextContent('No deposits or withdrawals this week.');
  expect(
    screen.queryByRole('group', { name: 'Officer' }),
  ).not.toBeInTheDocument();
  fireEvent.change(amount(step), { target: { value: '0.07' } });
  fireEvent.click(within(step).getByRole('button', { name: 'Add' }));
  await waitFor(() =>
    expect(edit).toHaveBeenLastCalledWith({
      kind: 'upkeep_transfer',
      transfer: {
        transferId: expect.any(String),
        direction: 'deposit',
        copper: 7,
      },
    }),
  );
  await waitFor(() => expect(amount(step)).toHaveValue(''));
  const direction = within(step).getByRole('group', {
    name: 'Transfer direction',
  });
  fireEvent.click(within(direction).getByRole('button', { name: 'Withdraw' }));
  expect(
    within(direction).getByRole('button', { name: 'Withdraw' }),
  ).toHaveAttribute('aria-pressed', 'true');
  fireEvent.change(amount(step), { target: { value: '0' } });
  fireEvent.click(within(step).getByRole('button', { name: 'Add' }));
  await waitFor(() =>
    expect(edit).toHaveBeenLastCalledWith({
      kind: 'upkeep_transfer',
      transfer: {
        transferId: expect.any(String),
        direction: 'withdraw',
        copper: 0,
      },
    }),
  );
  const [first, second] = edit.mock.calls.map(([call]) =>
    call.kind === 'upkeep_transfer' ? call.transfer.transferId : null,
  );
  expect(first).not.toBe(second);
});

test('[rules.UPK-10.amount-errors] empty and malformed amounts keep their own message in the field and send nothing', async () => {
  const { edit, step } = renderTransfers();
  const add = within(step).getByRole('button', { name: 'Add' });
  fireEvent.click(add);
  expect(await within(step).findByRole('alert')).toHaveTextContent(
    'An amount is required.',
  );
  for (const [text, message] of [
    ['1.234', 'Use at most two decimal places (1 cp = 0.01 gp).'],
    ['12x', 'Enter an amount in gp, such as 12 or 0.07.'],
    ['-5', 'Enter an amount in gp, such as 12 or 0.07.'],
  ] as const) {
    fireEvent.change(amount(step), { target: { value: text } });
    fireEvent.click(add);
    await waitFor(() =>
      expect(within(step).getByRole('alert')).toHaveTextContent(message),
    );
    expect(amount(step)).toHaveValue(text);
  }
  expect(edit).not.toHaveBeenCalled();
});

test('[rules.UPK-09.row-exception] a withdrawal beyond the treasury shows its warning and reasoned exception on its row, and removing it clears the ruling too', async () => {
  const { edit, step } = renderTransfers((draft) => {
    draft.upkeep.treasuryTransfers = [
      { transferId: 'deposit', direction: 'deposit', copper: 2500 },
      { transferId: 'withdraw', direction: 'withdraw', copper: 6000 },
    ];
    draft.rulesExceptions = [
      {
        exceptionId: 'loan',
        subjectId: 'withdraw',
        ruleId: 'upkeep-transfer-funds',
        reason: 'A loan',
      },
    ];
  });
  expect(step).toHaveTextContent('Treasury 30 gp → -5 gp');
  const rows = within(
    within(step).getByRole('list', { name: 'Staged transfers' }),
  ).getAllByRole('listitem');
  expect(rows[0]).toHaveTextContent('Deposit');
  expect(rows[0]).toHaveTextContent('+25 gp');
  expect(rows[1]).toHaveTextContent('Withdrawal');
  expect(rows[1]).toHaveTextContent('−60 gp');
  expect(
    within(rows[1]!).getByText(
      'This withdrawal of 60 gp exceeds the available treasury. Record a table ruling to proceed.',
    ),
  ).toHaveAttribute('role', 'note');
  const reason = within(rows[1]!).getByLabelText(
    'Reason for the rules exception',
  );
  expect(reason).toHaveValue('A loan');
  fireEvent.change(reason, { target: { value: 'The mayor lends it' } });
  fireEvent.click(
    within(rows[1]!).getByRole('button', { name: 'Record decision' }),
  );
  await waitFor(() =>
    expect(edit).toHaveBeenLastCalledWith({
      kind: 'rules_exception',
      exception: {
        exceptionId: 'loan',
        subjectId: 'withdraw',
        ruleId: 'upkeep-transfer-funds',
        reason: 'The mayor lends it',
      },
    }),
  );
  edit.mockClear();
  fireEvent.click(
    within(step).getByRole('button', { name: 'Remove withdrawal of 60 gp' }),
  );
  expect(edit.mock.calls).toEqual([
    [{ kind: 'clear_upkeep_transfer', transferId: 'withdraw' }],
    [{ kind: 'clear_rules_exception', exceptionId: 'loan' }],
  ]);
  edit.mockClear();
  fireEvent.click(
    within(step).getByRole('button', { name: 'Remove deposit of 25 gp' }),
  );
  expect(edit.mock.calls).toEqual([
    [{ kind: 'clear_upkeep_transfer', transferId: 'deposit' }],
  ]);
  expect(step).not.toHaveTextContent(/officer/i);
});

test('[rules.UPK-10.locked] Confirmation locks every transfer control', () => {
  const { step } = renderTransfers((draft) => {
    draft.upkeep.treasuryTransfers = [
      { transferId: 'withdraw', direction: 'withdraw', copper: 6000 },
    ];
  }, true);
  expect(amount(step)).toBeDisabled();
  for (const button of within(step).getAllByRole('button'))
    expect(button).toBeDisabled();
  expect(
    within(step).getByLabelText('Reason for the rules exception'),
  ).toBeDisabled();
});
