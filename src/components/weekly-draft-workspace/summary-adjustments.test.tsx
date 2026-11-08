import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { expect, test, vi, type Mock } from 'vitest';
import type {
  ReviewException,
  WeekReviewFacts,
} from '~/components/week-review/review-facts';
import { SummaryView } from './summary-view';
import { AddAdjustment } from './summary-adjustments';
import { adjustmentTargets } from './summary-adjustment-form';
import { confirmControlFixture } from './confirm-control-test-helpers';
import type { PhaseView } from './types';
import type { LocalFormGuard } from './use-summary-forms';

// The live Summary's Table Adjustment and Rules Exception reason forms: raw
// input stays local until a valid Save, every open or invalid form is
// registered with the Confirm guard, and each Save sends one semantic edit
// built from the latest known list.

type Summary = Extract<PhaseView, { phase: 'summary' }>;
type Adjustment = Summary['adjustments'][number];
const empty = (
  phase: 'upkeep' | 'activity' | 'event' | 'persistent',
  number: 1 | 2 | 3 | 4,
) => ({
  phase,
  number,
  title: phase,
  chips: [],
  status: 'empty' as const,
  statusText: 'Nothing.',
  items: [],
});
const review: WeekReviewFacts = {
  mode: 'live',
  sections: [
    empty('upkeep', 1),
    empty('activity', 2),
    empty('event', 3),
    empty('persistent', 4),
  ],
  unassociated: [],
  adjustments: [],
  result: { nextWeek: 5, complete: true, rows: [] },
};
const base: Summary = {
  phase: 'summary',
  effects: null,
  ready: true,
  baseline: null,
  outcome: null,
  requirements: [],
  warnings: [],
  adjustments: [],
  exceptions: [],
  acknowledgements: [],
  people: [],
  options: {
    teamId: [{ value: 'scouts', label: 'Scouts' }],
    settlementId: [{ value: 'phaendar', label: 'Phaendar' }],
    eventId: [
      { value: 'theft-1', label: 'Theft · Event 1' },
      { value: 'theft-2', label: 'Theft · Event 2' },
    ],
  },
  review,
};
const first: Adjustment = {
  adjustmentId: 'first',
  kind: 'militia_value',
  field: 'treasuryCopper',
  operation: 'add',
  value: 500,
  reason: 'Reward',
};
const second: Adjustment = {
  adjustmentId: 'second',
  kind: 'team_status',
  teamId: 'scouts',
  status: 'disabled',
  reason: 'Rest',
};
function summary(adjustments: Adjustment[], extra: Partial<Summary> = {}) {
  return {
    ...base,
    ...extra,
    adjustments,
    review: {
      ...review,
      ...extra.review,
      adjustments: adjustments.map((adjustment, index) => ({
        key: `adjustment:${adjustment.adjustmentId}`,
        adjustmentId: adjustment.adjustmentId,
        number: index + 1,
        kind: 'Militia value',
        effect: `Effect ${adjustment.adjustmentId}`,
        reason: adjustment.reason,
        notes: [],
      })),
    },
  };
}
/** The store's guard in memory: registrations, and input kept beside them. */
function memoryGuard() {
  const forms = new Map<string, string>();
  const values = new Map<string, unknown>();
  const set = vi.fn<LocalFormGuard['set']>((id, form) => {
    if (form) forms.set(id, form.message);
    else {
      forms.delete(id);
      values.delete(id);
    }
  });
  return {
    set,
    keep: (id: string, kept: unknown) => void values.set(id, kept),
    read: (id: string) => (forms.has(id) ? values.get(id) : undefined),
    /** What the store would publish as `localForms`. */
    published: () => [...forms].map(([id, message]) => ({ id, message })),
  };
}
function setup(view: Summary, edit = vi.fn().mockResolvedValue('accepted')) {
  const guard = memoryGuard();
  const register = guard.set;
  const props = {
    edit,
    disabled: false,
    confirmation: confirmControlFixture(),
    forecastPending: false,
    reviewRequired: false,
    review: vi.fn(),
    localFormGuard: guard,
  };
  const result = render(<SummaryView view={view} {...props} />);
  return {
    edit,
    guard,
    register,
    rerender: (next: Summary, extra: Partial<typeof props> = {}) =>
      result.rerender(
        <SummaryView
          view={next}
          {...props}
          localForms={guard.published()}
          {...extra}
        />,
      ),
    /** Leaves Review & confirm and comes back to it. */
    remount: (next: Summary) => {
      result.unmount();
      render(
        <SummaryView view={next} {...props} localForms={guard.published()} />,
      );
    },
  };
}
/** The current registration of each local form id (null once withdrawn). */
function registrations(register: Mock<LocalFormGuard['set']>) {
  return Object.fromEntries(
    register.mock.calls.map(([id, form]) => [id, form?.message ?? null]),
  );
}
const reasonOf = (n: number) =>
  screen.getByRole('textbox', { name: `Reason for adjustment ${n}` });

test('[rules.P85.adjustment-local-reason] a cleared adjustment reason stays local, amber and registered until Cancel restores the accepted one', async () => {
  const { edit, register } = setup(summary([first, second]));
  fireEvent.change(reasonOf(1), { target: { value: '' } });
  await waitFor(() =>
    expect(registrations(register)['adjustment:first']).toBe(
      'Table Adjustment 1 “Effect first” needs a reason.',
    ),
  );
  expect(reasonOf(1)).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByText('A reason is required.')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Save adjustment 1' }));
  await waitFor(() =>
    expect(screen.getByText('A reason is required.')).toBeVisible(),
  );
  expect(edit).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole('button', { name: 'Cancel changes to adjustment 1' }),
  );
  await waitFor(() => expect(reasonOf(1)).toHaveValue('Reward'));
  expect(registrations(register)['adjustment:first']).toBeNull();
  expect(edit).not.toHaveBeenCalled();
  expect(
    screen.getByRole('button', { name: 'Edit adjustment 1' }),
  ).toHaveFocus();
});

test('[rules.P85.adjustment-edit] editing keeps identity and saves against the latest list, keeping another player’s adjustment', async () => {
  const remote: Adjustment = {
    adjustmentId: 'remote',
    kind: 'event_end',
    eventId: 'theft-2',
    reason: 'Added elsewhere',
  };
  const edit = vi.fn().mockResolvedValue('accepted');
  const guard = memoryGuard();
  const register = guard.set;
  render(
    <SummaryView
      view={summary([first, second])}
      edit={edit}
      disabled={false}
      confirmation={confirmControlFixture()}
      forecastPending={false}
      reviewRequired={false}
      review={vi.fn()}
      localFormGuard={guard}
      // Accepted since this form opened; not yet rendered here.
      latestAdjustments={() => [first, second, remote]}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Edit adjustment 1' }));
  const row = within(screen.getByRole('form', { name: 'Adjustment 1 editor' }));
  fireEvent.click(row.getByRole('button', { name: 'Set to' }));
  fireEvent.change(row.getByRole('textbox', { name: 'Amount' }), {
    target: { value: '12.05' },
  });
  fireEvent.change(reasonOf(1), { target: { value: 'Counted again' } });
  await waitFor(() =>
    expect(registrations(register)['adjustment:first']).toBe(
      'Table Adjustment 1 “Effect first”: save or cancel your changes.',
    ),
  );
  fireEvent.click(row.getByRole('button', { name: 'Save adjustment 1' }));
  await waitFor(() =>
    expect(edit).toHaveBeenCalledWith({
      kind: 'table_adjustments',
      adjustments: [
        {
          adjustmentId: 'first',
          kind: 'militia_value',
          field: 'treasuryCopper',
          operation: 'set',
          value: 1205,
          reason: 'Counted again',
        },
        second,
        remote,
      ],
    }),
  );
  await waitFor(() =>
    expect(registrations(register)['adjustment:first']).toBeNull(),
  );
});

test('[rules.P85.adjustment-kinds-forms] every kind card opens its form and saves its complete discriminant', async () => {
  const { edit } = setup(summary([first]));
  const open = (kind: string) => {
    fireEvent.click(screen.getByRole('button', { name: kind }));
    return within(screen.getByRole('form', { name: `New ${kind} adjustment` }));
  };
  const choose = (
    form: ReturnType<typeof open>,
    group: string,
    value: string,
  ) =>
    fireEvent.click(
      within(form.getByRole('group', { name: group })).getByRole('button', {
        name: value,
      }),
    );
  const saveWith = async (form: ReturnType<typeof open>, reason: string) => {
    fireEvent.change(form.getByRole('textbox', { name: 'Reason' }), {
      target: { value: reason },
    });
    fireEvent.click(form.getByRole('button', { name: 'Save adjustment' }));
    await waitFor(() =>
      expect(edit.mock.lastCall?.[0]).toMatchObject({
        adjustments: [first, expect.objectContaining({ reason })],
      }),
    );
    return (edit.mock.lastCall![0] as { adjustments: Adjustment[] })
      .adjustments[1];
  };
  let form = open('Team condition');
  expect(
    within(form.getByRole('group', { name: 'Condition' }))
      .getAllByRole('button')
      .map((button) => button.textContent),
  ).toEqual(['Active', 'Disabled', 'Missing']);
  choose(form, 'Team', 'Scouts');
  choose(form, 'Condition', 'Missing');
  expect(await saveWith(form, 'Lost in the woods')).toMatchObject({
    kind: 'team_status',
    teamId: 'scouts',
    status: 'missing',
  });
  form = open('Settlement reputation');
  choose(form, 'Settlement', 'Phaendar');
  choose(form, 'Reputation', 'Helpful');
  expect(await saveWith(form, 'Saved the mayor')).toMatchObject({
    kind: 'settlement_reputation',
    settlementId: 'phaendar',
    reputation: 'Helpful',
  });
  form = open('End persistent event');
  choose(form, 'Event', 'Theft · Event 2');
  expect(await saveWith(form, 'The thieves left')).toMatchObject({
    kind: 'event_end',
    eventId: 'theft-2',
  });
  form = open('Militia value');
  choose(form, 'Field', 'Rank');
  fireEvent.change(form.getByRole('textbox', { name: 'Amount' }), {
    target: { value: '0' },
  });
  expect(await saveWith(form, 'Rank held')).toMatchObject({
    kind: 'militia_value',
    field: 'rank',
    operation: 'add',
    value: 0,
  });
});

test('[rules.P85.adjustment-new-cancel] a new form is a local decision until Cancel, which sends nothing and returns focus to its card', async () => {
  const edit = vi.fn().mockResolvedValue('accepted');
  const guard = memoryGuard();
  const register = guard.set;
  render(
    <AddAdjustment
      targets={adjustmentTargets(base)}
      latest={() => []}
      edit={edit}
      guard={guard}
      disabled={false}
      localForms={[]}
      removedDrafts={[]}
    />,
  );
  const card = screen.getByRole('button', { name: 'Militia value' });
  fireEvent.click(card);
  await waitFor(() =>
    expect(
      Object.entries(registrations(register)).find(([id]) =>
        id.startsWith('new-adjustment:'),
      )?.[1],
    ).toBe('New Militia value adjustment: save or cancel it.'),
  );
  const form = within(
    screen.getByRole('form', { name: 'New Militia value adjustment' }),
  );
  fireEvent.change(form.getByRole('textbox', { name: 'Amount' }), {
    target: { value: '1.005' },
  });
  await waitFor(() =>
    expect(
      form.getByText('Use at most two decimal places (1 cp = 0.01 gp).'),
    ).toBeVisible(),
  );
  // Malformed input stays exactly as typed.
  expect(form.getByRole('textbox', { name: 'Amount' })).toHaveValue('1.005');
  expect(edit).not.toHaveBeenCalled();
  fireEvent.click(form.getByRole('button', { name: 'Cancel' }));
  await waitFor(() =>
    expect(
      screen.queryByRole('form', { name: 'New Militia value adjustment' }),
    ).not.toBeInTheDocument(),
  );
  expect(card).toHaveFocus();
  expect(
    Object.values(registrations(register)).every((value) => value === null),
  ).toBe(true);
  expect(edit).not.toHaveBeenCalled();
});

test('[rules.P85.adjustment-single] one adjustment has no earlier/later controls', () => {
  setup(summary([first]));
  expect(
    screen.queryByRole('button', { name: /Move adjustment/ }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Remove adjustment 1' }),
  ).toBeEnabled();
});

test('[rules.P85.adjustment-remote] another player’s change refreshes an untouched row and never replaces local input', async () => {
  const { rerender } = setup(summary([first, second]));
  fireEvent.change(reasonOf(1), { target: { value: 'My local reason' } });
  rerender(
    summary([
      { ...first, reason: 'Their reason' },
      { ...second, reason: 'Their rest' },
    ]),
  );
  await waitFor(() => expect(reasonOf(2)).toHaveValue('Their rest'));
  expect(reasonOf(1)).toHaveValue('My local reason');
  expect(
    screen.getByText(/Another player changed this adjustment/),
  ).toBeVisible();
  fireEvent.click(
    screen.getByRole('button', { name: 'Cancel changes to adjustment 1' }),
  );
  await waitFor(() => expect(reasonOf(1)).toHaveValue('Their reason'));
  expect(
    screen.queryByText(/Another player changed this adjustment/),
  ).not.toBeInTheDocument();
});

test('[rules.P85.adjustment-failure] a failed save keeps the local input, its registration and a recovery message', async () => {
  const edit = vi.fn().mockResolvedValue('failed');
  const { register } = setup(summary([first]), edit);
  fireEvent.change(reasonOf(1), { target: { value: 'Better reason' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save adjustment 1' }));
  await waitFor(() =>
    expect(screen.getByText(/The adjustment could not be saved/)).toBeVisible(),
  );
  expect(edit).toHaveBeenCalledTimes(1);
  expect(reasonOf(1)).toHaveValue('Better reason');
  expect(registrations(register)['adjustment:first']).toBe(
    'Table Adjustment 1 “Effect first”: save or cancel your changes.',
  );
});

test('[rules.P85.adjustment-removed] unsaved changes to an adjustment another player removed are kept to add again or discard', async () => {
  const { register, rerender, edit } = setup(summary([first, second]));
  fireEvent.change(reasonOf(1), { target: { value: 'Keep my words' } });
  await waitFor(() =>
    expect(registrations(register)['adjustment:first']).not.toBeNull(),
  );
  rerender(summary([second]));
  await waitFor(() =>
    expect(
      screen.getByText(
        'Another player removed the Militia value adjustment “Keep my words” while you were changing it. Your unsaved changes are kept.',
      ),
    ).toBeVisible(),
  );
  // Still this device's local decision, now naming what happened.
  expect(registrations(register)['adjustment:first']).toBe(
    'Militia value adjustment “Keep my words” was removed by another player. Add your version again or discard it.',
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Add again as a new adjustment' }),
  );
  const form = within(
    screen.getByRole('form', { name: 'New Militia value adjustment' }),
  );
  expect(form.getByRole('textbox', { name: 'Reason' })).toHaveValue(
    'Keep my words',
  );
  expect(form.getByRole('textbox', { name: 'Amount' })).toHaveValue('5');
  expect(registrations(register)['adjustment:first']).toBeNull();
  fireEvent.click(form.getByRole('button', { name: 'Save adjustment' }));
  await waitFor(() =>
    expect(edit).toHaveBeenCalledWith({
      kind: 'table_adjustments',
      adjustments: [
        second,
        {
          ...first,
          adjustmentId: expect.not.stringMatching(/^first$/),
          reason: 'Keep my words',
        },
      ],
    }),
  );
});

test('[rules.P85.adjustment-return] local input and its Confirm guard survive leaving Review & confirm and coming back', async () => {
  const { register, remount, edit } = setup(summary([first, second]));
  fireEvent.change(reasonOf(2), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Team condition' }));
  fireEvent.click(
    within(screen.getByRole('group', { name: 'Team' })).getByRole('button', {
      name: 'Scouts',
    }),
  );
  await waitFor(() =>
    expect(registrations(register)['adjustment:second']).toBe(
      'Table Adjustment 2 “Effect second” needs a reason.',
    ),
  );
  remount(summary([first, second]));
  await waitFor(() => expect(reasonOf(2)).toHaveValue(''));
  expect(reasonOf(2)).toHaveAttribute('aria-invalid', 'true');
  expect(
    screen.getByRole('button', { name: 'Cancel changes to adjustment 2' }),
  ).toBeVisible();
  const form = within(
    screen.getByRole('form', { name: 'New Team condition adjustment' }),
  );
  expect(
    within(form.getByRole('group', { name: 'Team' })).getByRole('button', {
      name: 'Scouts',
    }),
  ).toHaveAttribute('aria-pressed', 'true');
  await waitFor(() =>
    expect(registrations(register)['adjustment:second']).toBe(
      'Table Adjustment 2 “Effect second” needs a reason.',
    ),
  );
  expect(edit).not.toHaveBeenCalled();
});

test('[rules.P85.adjustment-gone-target] an untouched adjustment whose team left the week shows the field error at once', async () => {
  setup(summary([{ ...second, teamId: 'gone' }]));
  expect(
    await screen.findByText(
      'This team is no longer part of the week. Choose another team.',
    ),
  ).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'Edit adjustment 1' }),
  ).toHaveAttribute('aria-expanded', 'true');
});

test('[rules.P85.adjustment-own-remove] removing an adjustment with unsaved changes on this device keeps no draft', async () => {
  const { rerender } = setup(summary([first, second]));
  fireEvent.change(reasonOf(1), { target: { value: 'Discard me' } });
  fireEvent.click(screen.getByRole('button', { name: 'Remove adjustment 1' }));
  await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2));
  rerender(summary([second]));
  await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(1));
  expect(screen.queryByText(/was removed by another player/)).toBeNull();
});

const exception: ReviewException = {
  kind: 'exception',
  key: 'exception:acted',
  exceptionId: 'acted',
  subjectId: 'choice',
  ruleId: 'team-acted',
  rule: 'Team already acted',
  reason: 'The GM allowed a second job',
  obsolete: false,
};
function withException(note: ReviewException): Summary {
  const [upkeep, activity, event, persistent] = review.sections;
  return {
    ...base,
    exceptions: [
      {
        exceptionId: note.exceptionId,
        subjectId: note.subjectId,
        ruleId: note.ruleId,
        reason: note.reason,
        name: 'Activity 2: Earn Gold',
      },
    ],
    review: {
      ...review,
      sections: [
        upkeep,
        {
          ...activity,
          status: 'complete',
          statusText: null,
          items: [
            {
              key: 'choice',
              title: 'Activity 2: Earn Gold',
              details: [],
              effects: [],
              notes: [note],
              missing: false,
            },
          ],
        },
        event,
        persistent,
      ],
    },
  };
}
const exceptionReason = () =>
  screen.getByRole('textbox', {
    name: 'Reason for Team already acted exception',
  });

test('[rules.P85.exception-local] a blank exception reason is never saved; it is a local decision until Save, Cancel or clearing the exception', async () => {
  const { edit, register, rerender } = setup(withException(exception));
  fireEvent.change(exceptionReason(), { target: { value: '  ' } });
  await waitFor(() =>
    expect(registrations(register)['exception:acted']).toBe(
      'Activity 2: Earn Gold · Team already acted exception needs a reason. Save one, cancel, or clear the exception.',
    ),
  );
  expect(exceptionReason()).toHaveAttribute('aria-invalid', 'true');
  fireEvent.click(
    screen.getByRole('button', { name: 'Save Team already acted reason' }),
  );
  await waitFor(() =>
    expect(screen.getByText('A reason is required.')).toBeVisible(),
  );
  expect(edit).not.toHaveBeenCalled();
  // Another player's accepted reason does not overwrite the local text.
  rerender(withException({ ...exception, reason: 'Their reason' }));
  await waitFor(() =>
    expect(
      screen.getByText(/Another player changed this reason/),
    ).toBeVisible(),
  );
  expect(exceptionReason()).toHaveValue('  ');
  fireEvent.click(
    screen.getByRole('button', { name: 'Cancel Team already acted reason' }),
  );
  await waitFor(() => expect(exceptionReason()).toHaveValue('Their reason'));
  expect(registrations(register)['exception:acted']).toBeNull();
  fireEvent.click(
    screen.getByRole('button', { name: 'Clear Team already acted exception' }),
  );
  expect(edit).toHaveBeenCalledWith({
    kind: 'clear_rules_exception',
    exceptionId: 'acted',
  });
});

test('[rules.P85.local-decisions] local decisions are listed with Go to form, which focuses the invalid field', async () => {
  const guard = memoryGuard();
  render(
    <SummaryView
      view={summary([first])}
      edit={vi.fn()}
      disabled={false}
      confirmation={confirmControlFixture({ disabled: true })}
      forecastPending={false}
      reviewRequired={false}
      review={vi.fn()}
      localFormGuard={guard}
      localForms={[
        {
          id: 'adjustment:first',
          message: 'Table Adjustment 1 “Effect first” needs a reason.',
        },
      ]}
    />,
  );
  fireEvent.change(reasonOf(1), { target: { value: '' } });
  await waitFor(() =>
    expect(reasonOf(1)).toHaveAttribute('aria-invalid', 'true'),
  );
  const decisions = within(
    screen.getByRole('region', { name: 'Required decisions' }),
  );
  expect(
    decisions.getByText('Table Adjustment 1 “Effect first” needs a reason.'),
  ).toBeVisible();
  fireEvent.click(decisions.getByRole('button', { name: 'Go to form' }));
  expect(reasonOf(1)).toHaveFocus();
  expect(screen.getByRole('button', { name: 'Confirm week' })).toBeDisabled();
});
