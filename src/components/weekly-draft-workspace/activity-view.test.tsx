import { activityWarning } from './activity-warnings';
import {
  acceptingEdit,
  activityFacts,
  activitySlot,
  selectSlot,
} from './activity-view-fixture';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { expect, test, vi } from 'vitest';
vi.mock('~/components/ui/select', () => import('./native-select-test-double'));
import { ActivityView } from './activity-view';
import type { ActivityView as Facts } from './types';
import type { StagedActionChoice } from '~/lib/weekly-draft-facts';
const view: Facts = activityFacts(
  [
    activitySlot({
      actionId: 'drill_militia',
      choiceId: 'drill',
      costCopper: 0,
    }),
    activitySlot(null, { slotId: 'two', number: 2 }),
  ],
  { actions: [{ actionId: 'lie_low', name: 'Lie Low' }] },
);
test('[rules.P82.nested] a purchase keeps copper precision, requires its price and stages a complete typed detail', async () => {
  const edit = acceptingEdit();
  const purchaseView: Facts = {
    ...view,
    slots: [activitySlot({ choiceId: 'market', actionId: 'broker_market' })],
  };
  render(<ActivityView view={purchaseView} edit={edit} disabled={false} />);
  selectSlot('Broker Market');
  fireEvent.click(screen.getByRole('button', { name: 'Add purchase' }));
  const form = screen.getByRole('form', { name: 'New purchase' });
  const price = within(form).getByRole('textbox', { name: 'Price (gp)' });
  fireEvent.click(within(form).getByRole('button', { name: 'Save purchase' }));
  expect(await within(form).findByText('A price is required.')).toHaveAttribute(
    'role',
    'alert',
  );
  fireEvent.change(price, { target: { value: '1e3' } });
  fireEvent.click(within(form).getByRole('button', { name: 'Save purchase' }));
  expect(
    await within(form).findByText('Enter an amount in gp, such as 12 or 0.07.'),
  ).toHaveAttribute('role', 'alert');
  expect(edit).not.toHaveBeenCalled();
  // Gold is entered in gp and stored as exact copper.
  fireEvent.change(price, { target: { value: '1.23' } });
  fireEvent.click(within(form).getByRole('button', { name: 'Save purchase' }));
  await waitFor(() =>
    expect(edit).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'detail',
        choice: expect.objectContaining({
          purchases: [{ itemId: expect.any(String), priceCopper: 123 }],
        }),
      }),
    ),
  );
});

test('[rules.P82.union] the Rescue destination saves either branch of its union without inventing a character reference', async () => {
  const edit = acceptingEdit();
  const rescue = (
    destination?: Extract<
      StagedActionChoice,
      { actionId: 'rescue_character' }
    >['destination'],
  ): Facts => ({
    ...view,
    settlements: [{ value: 'town', label: 'Town' }],
    slots: [
      activitySlot({
        choiceId: 'rescue',
        actionId: 'rescue_character',
        ...(destination ? { destination } : {}),
      }),
    ],
  });
  const { rerender } = render(
    <ActivityView view={rescue()} edit={edit} disabled={false} />,
  );
  selectSlot('Rescue Character');
  const destination = () =>
    screen.getByRole('radiogroup', { name: 'Destination' });
  fireEvent.click(
    within(destination()).getByRole('radio', { name: 'Refuge in Town' }),
  );
  await waitFor(() =>
    expect(edit).toHaveBeenLastCalledWith({
      kind: 'detail',
      slotId: 'one',
      choiceId: 'rescue',
      choice: {
        choiceId: 'rescue',
        actionId: 'rescue_character',
        destination: { kind: 'refuge', settlementId: 'town' },
      },
    }),
  );
  rerender(
    <ActivityView
      view={rescue({ kind: 'refuge', settlementId: 'town' })}
      edit={edit}
      disabled={false}
    />,
  );
  expect(
    within(destination()).getByRole('radio', { name: 'Refuge in Town' }),
  ).toHaveAttribute('aria-checked', 'true');
  fireEvent.click(
    within(destination()).getByRole('radio', { name: 'Headquarters' }),
  );
  expect(edit).toHaveBeenLastCalledWith(
    expect.objectContaining({
      choice: {
        choiceId: 'rescue',
        actionId: 'rescue_character',
        destination: { kind: 'headquarters' },
      },
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Clear destination' }));
  expect(edit).toHaveBeenLastCalledWith(
    expect.objectContaining({
      choice: { choiceId: 'rescue', actionId: 'rescue_character' },
    }),
  );
});

test('[rules.P82.decimal] item weight can be typed as a decimal and complete detail failures are visible', async () => {
  const edit = acceptingEdit();
  render(
    <ActivityView
      view={{
        ...view,
        slots: [activitySlot({ choiceId: 'order', actionId: 'special_order' })],
      }}
      edit={edit}
      disabled={false}
    />,
  );
  selectSlot('Special Order');
  const form = screen.getByRole('form', { name: 'Ordered item' });
  const weight = within(form).getByRole('textbox', { name: 'Weight (lb)' });
  fireEvent.change(weight, { target: { value: '1' } });
  fireEvent.change(weight, { target: { value: '1.' } });
  expect(weight).toHaveValue('1.');
  fireEvent.change(weight, { target: { value: 'one' } });
  fireEvent.click(
    within(form).getByRole('button', { name: 'Save ordered item' }),
  );
  expect(
    await within(form).findByText(
      'Enter the weight in pounds, such as 2 or 0.5.',
    ),
  ).toHaveAttribute('role', 'alert');
  expect(edit).not.toHaveBeenCalled();
  fireEvent.change(weight, { target: { value: '1.5' } });
  fireEvent.click(
    within(form).getByRole('button', { name: 'Save ordered item' }),
  );
  await waitFor(() =>
    expect(edit).toHaveBeenCalledWith(
      expect.objectContaining({
        choice: expect.objectContaining({ weight: 1.5 }),
      }),
    ),
  );
});

test('[rules.P82.references] cache item lists use named cards instead of internal references', async () => {
  const edit = acceptingEdit();
  render(
    <ActivityView
      view={{
        ...view,
        items: [{ value: 'internal-item', label: 'Healing potion' }],
        slots: [
          activitySlot({
            choiceId: 'cache',
            actionId: 'secure_cache',
            mode: 'place',
            cacheId: 'new-cache',
          }),
        ],
      }}
      edit={edit}
      disabled={false}
    />,
  );
  selectSlot('Secure Cache');
  const add = screen.getByRole('combobox', { name: 'Add a held item' });
  expect(
    within(add)
      .getAllByRole('option')
      .map((option) => option.textContent),
  ).toEqual(['', 'Healing potion']);
  fireEvent.change(add, { target: { value: 'internal-item' } });
  await waitFor(() =>
    expect(edit).toHaveBeenCalledWith(
      expect.objectContaining({
        choice: expect.objectContaining({ itemIds: ['internal-item'] }),
      }),
    ),
  );
  expect(screen.queryByText(/internal-item/)).not.toBeInTheDocument();
});

test('[rules.P82.warnings] staged choices explain range and calculated-cost mismatches in their details and count them on the card', () => {
  const warnings = ['drill:check:roll-range', 'drill:calculated-cost'];
  render(
    <ActivityView
      view={{
        ...view,
        slots: [
          activitySlot(view.slots[0]!.choice, {
            warnings,
            warningCount: 2,
            issues: warnings.map((code) => ({
              code,
              message: activityWarning(code, 'drill'),
            })),
          }),
        ],
      }}
      edit={acceptingEdit()}
      disabled={false}
    />,
  );
  expect(
    within(screen.getByRole('group', { name: 'Action Slot 1' })).getByText(
      '2 warnings',
    ),
  ).toBeVisible();
  selectSlot('Drill Militia');
  expect(screen.getByText(/The roll is outside its usual range/)).toBeVisible();
  expect(
    screen.getByText(/The preview uses the calculated cost/),
  ).toBeVisible();
  expect(screen.queryByText('drill:check:roll-range')).not.toBeInTheDocument();
});
test('[rules.P82.receipt] recording an order receipt binds its notes to the same receipt and order', async () => {
  const edit = acceptingEdit();
  render(
    <ActivityView
      view={{
        ...view,
        slots: [
          activitySlot({
            choiceId: 'order-choice',
            actionId: 'special_order',
            orderId: 'order',
          }),
        ],
      }}
      edit={edit}
      disabled={false}
    />,
  );
  selectSlot('Special Order');
  fireEvent.change(screen.getByRole('textbox', { name: 'Receipt notes' }), {
    target: { value: 'The ordered potion arrived' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Record receipt' }));
  await waitFor(() => expect(edit).toHaveBeenCalledTimes(1));
  const choice = detailChoice(edit);
  if (choice.actionId !== 'special_order') throw new Error('Expected order');
  expect(choice.receipt).toEqual({
    receivedDay: 21,
    acknowledgementId: expect.any(String),
  });
  expect(choice.acknowledgements).toEqual([
    {
      acknowledgementId: choice.receipt!.acknowledgementId,
      subjectId: 'order',
      outcome: 'The ordered potion arrived',
    },
  ]);
});

function detailChoice(edit: ReturnType<typeof acceptingEdit>) {
  const operation = edit.mock.calls[0]![0];
  if (operation.kind !== 'detail') throw new Error('Expected detail edit');
  return operation.choice;
}
