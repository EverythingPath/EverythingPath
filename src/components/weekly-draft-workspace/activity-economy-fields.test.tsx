import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { EconomyState } from '~/lib/rules-economy-state';
import type { StagedActionChoice } from '~/lib/weekly-draft-facts';
import { ActivityView } from './activity-view';
import {
  acceptingEdit,
  activityFacts,
  activitySlot,
  selectSlot,
} from './activity-view-fixture';
import type { ActivityView as Facts } from './types';

vi.mock('~/components/ui/select', () => import('./native-select-test-double'));

type Slot = Facts['slots'][number];
type Item = EconomyState['items'][number];
const item = (itemId: string, name: string, extra: Partial<Item> = {}) =>
  ({
    itemId,
    name,
    valueCopper: 10000,
    weight: 1,
    location: 'held',
    ...extra,
  }) satisfies Item;
const economy: EconomyState['items'] = [
  item('gear', 'Gear', { weight: 5, valueCopper: 90000 }),
  item('ring', 'Ring', { location: 'cache' }),
];
function facts(choice: StagedActionChoice, slot: Partial<Slot> = {}): Facts {
  return activityFacts(
    [
      activitySlot(choice, {
        position: {
          officers: [],
          refugeSettlementIds: [],
          settlements: [],
          propaganda: [],
          characterStatus: [],
          economy: {
            items: economy,
            caches: [
              {
                cacheId: 'mill',
                cacheClass: 'minor',
                location: 'Old Mill',
                secure: false,
                extradimensional: false,
                itemIds: ['ring'],
                status: 'hidden',
                returnActivityWeek: null,
              },
            ],
          },
        },
        ...slot,
      }),
    ],
    {
      settlements: [
        { value: 'town', label: 'Town' },
        { value: 'fort', label: 'Fort' },
      ],
      operating: {
        selected: null,
        missing: false,
        choices: [
          { value: 'town', label: 'Town', reputation: 'Friendly' },
          { value: 'fort', label: 'Fort', reputation: 'Indifferent' },
        ],
      },
    },
  );
}
function open(view: Facts, disabled = false) {
  const edit = acceptingEdit();
  const utils = render(
    <ActivityView
      view={view}
      edit={edit}
      disabled={disabled}
      correctionsHref="/campaigns/c/militia"
    />,
  );
  selectSlot(view.slots[0]!.actionName!);
  return { edit, ...utils };
}
function lastChoice(edit: ReturnType<typeof acceptingEdit>) {
  const call = edit.mock.lastCall![0];
  if (call.kind !== 'detail') throw new Error('Expected a detail edit');
  return call.choice;
}
const card = (group: string, name: string) =>
  within(screen.getByRole('radiogroup', { name: group })).getByRole('radio', {
    name,
  });
const button = (name: string) => screen.getByRole('button', { name });
const textbox = (name: string) => screen.getByRole('textbox', { name });
const options = (name: string) =>
  within(screen.getByRole('combobox', { name }))
    .getAllByRole('option')
    .map((option) => option.textContent);
const wandAvailability = {
  acknowledgementId: 'ack-wand',
  subjectId: 'availability:wand',
  outcome: 'In stock',
};

describe('markets', () => {
  const market: StagedActionChoice = {
    choiceId: 'market',
    actionId: 'broker_market',
    settlementId: 'town',
    sales: ['gear'],
    purchases: [
      { itemId: 'wand', name: 'Wand', priceCopper: 1001, weight: 0.5 },
    ],
    acknowledgements: [wandAvailability],
  };

  test('the availability Save button wraps a long item name instead of widening the page', () => {
    open(facts(market));
    const classes = button('Save availability of wand').className.split(' ');
    expect(classes).toContain('whitespace-normal');
    expect(classes).not.toContain('whitespace-nowrap');
    expect(classes).toContain('max-w-full');
  });

  test('[rules.ACT-10.market-edit] a market edits its settlement, sales and each purchase’s availability without touching the rest', async () => {
    const { edit } = open(facts(market));
    fireEvent.click(card('Market settlement', 'Fort'));
    expect(lastChoice(edit)).toEqual({ ...market, settlementId: 'fort' });
    // An item that is not held stays addable, with where it is.
    expect(options('Add item to sell')).toEqual([
      '',
      'Ring · In a cache · 100 gp · 1 lb',
    ]);
    fireEvent.change(
      screen.getByRole('combobox', { name: 'Add item to sell' }),
      {
        target: { value: 'ring' },
      },
    );
    expect(lastChoice(edit)).toEqual({ ...market, sales: ['gear', 'ring'] });
    fireEvent.click(button('Remove sale Gear'));
    const { sales: _sales, ...unsold } = market;
    expect(lastChoice(edit)).toEqual(unsold);
    // The purchase's availability answer sits with the purchase only.
    expect(
      screen.queryByRole('textbox', { name: /Outcome acknowledgement/ }),
    ).not.toBeInTheDocument();
    fireEvent.change(textbox('Availability of Wand'), {
      target: { value: 'Two in stock' },
    });
    fireEvent.click(button('Save availability of wand'));
    await waitFor(() =>
      expect(lastChoice(edit)).toEqual({
        ...market,
        acknowledgements: [{ ...wandAvailability, outcome: 'Two in stock' }],
      }),
    );
    fireEvent.click(button('Remove purchase Wand'));
    const { acknowledgements: _acknowledgements, ...rest } = market;
    const { purchases: _purchases, ...unbought } = rest;
    expect(lastChoice(edit)).toEqual(unbought);
  });

  test('[rules.ACT-10.purchase-edit] purchases are recorded as none or cleared, and an edited purchase keeps its item', async () => {
    const { edit, rerender } = open(
      facts({ choiceId: 'market', actionId: 'activate_black_market' }),
    );
    expect(screen.getByText('Not recorded yet.')).toBeVisible();
    fireEvent.click(button('No purchases'));
    expect(lastChoice(edit)).toEqual({
      choiceId: 'market',
      actionId: 'activate_black_market',
      purchases: [],
    });
    rerender(
      <ActivityView
        view={facts({
          choiceId: 'market',
          actionId: 'activate_black_market',
          purchases: [],
        })}
        edit={edit}
        disabled={false}
      />,
    );
    expect(screen.getByText('No purchases.')).toBeVisible();
    fireEvent.click(button('Clear purchases'));
    expect(lastChoice(edit)).toEqual({
      choiceId: 'market',
      actionId: 'activate_black_market',
    });
    rerender(
      <ActivityView view={facts(market)} edit={edit} disabled={false} />,
    );
    fireEvent.click(button('Edit purchase Wand'));
    const form = screen.getByRole('form', { name: 'Purchase Wand' });
    expect(
      within(form).getByRole('textbox', { name: 'Price (gp)' }),
    ).toHaveValue('10.01');
    fireEvent.change(
      within(form).getByRole('textbox', { name: 'Weight (lb)' }),
      {
        target: { value: '0.75' },
      },
    );
    fireEvent.click(
      within(form).getByRole('button', { name: 'Save purchase' }),
    );
    await waitFor(() =>
      expect(lastChoice(edit)).toEqual({
        ...market,
        purchases: [
          { itemId: 'wand', name: 'Wand', priceCopper: 1001, weight: 0.75 },
        ],
      }),
    );
  });
});

describe('caches', () => {
  test('[rules.ACT-10.cache-edit] placing starts a new cache and records its class, location, security, space and held items', async () => {
    const blank: StagedActionChoice = {
      choiceId: 'cache',
      actionId: 'secure_cache',
    };
    const { edit, rerender } = open(facts(blank));
    fireEvent.click(card('Cache action', 'Place a cache'));
    const placed = lastChoice(edit);
    expect(placed).toEqual({
      ...blank,
      mode: 'place',
      cacheId: expect.any(String),
    });
    const choice = {
      ...placed,
      purchases: [{ itemId: 'rope', priceCopper: 100, weight: 1 }],
    } as StagedActionChoice;
    rerender(
      <ActivityView view={facts(choice)} edit={edit} disabled={false} />,
    );
    fireEvent.click(card('Cache class', 'Minor'));
    expect(lastChoice(edit)).toEqual({ ...choice, cacheClass: 'minor' });
    fireEvent.click(card('Location', 'Secure location'));
    expect(lastChoice(edit)).toEqual({ ...choice, secure: true });
    fireEvent.click(card('Space', 'Ordinary space'));
    expect(lastChoice(edit)).toEqual({ ...choice, extradimensional: false });
    fireEvent.click(button('No held items'));
    expect(lastChoice(edit)).toEqual({ ...choice, itemIds: [] });
    fireEvent.change(textbox('Cache location'), {
      target: { value: 'Under the bridge' },
    });
    fireEvent.click(button('Save cache location'));
    await waitFor(() =>
      expect(lastChoice(edit)).toEqual({
        ...choice,
        location: 'Under the bridge',
      }),
    );
    const full = {
      ...choice,
      cacheClass: 'minor',
      itemIds: ['gear'],
    } as StagedActionChoice;
    rerender(<ActivityView view={facts(full)} edit={edit} disabled={false} />);
    expect(
      screen.getByText(/Contents: 6 lb of 5 lb, over the limit/),
    ).toHaveAttribute('role', 'note');
    fireEvent.click(button('Remove Gear from the cache'));
    const { itemIds: _itemIds, ...emptied } = full as Record<string, unknown>;
    expect(lastChoice(edit)).toEqual(emptied);
  });

  test('[rules.ACT-10.cache-retrieve] retrieving lists hidden caches, keeps placing values visible and a missing cache repairable', () => {
    const choice: StagedActionChoice = {
      choiceId: 'cache',
      actionId: 'secure_cache',
      mode: 'retrieve',
      cacheId: 'gone',
      location: 'Old well',
    };
    const { edit, rerender } = open(facts(choice));
    const caches = screen.getByRole('radiogroup', {
      name: 'Cache to retrieve',
    });
    expect(
      within(caches)
        .getAllByRole('radio')
        .map((radio) => radio.textContent),
    ).toEqual([
      expect.stringContaining('Missing cache'),
      expect.stringContaining('Old Mill'),
    ]);
    expect(
      screen.getByText(/Not used when retrieving; kept until you clear/),
    ).toBeVisible();
    expect(textbox('Cache location')).toHaveValue('Old well');
    expect(
      screen.getByRole('link', { name: 'Open Militia corrections' }),
    ).toHaveAttribute('href', '/campaigns/c/militia');
    fireEvent.click(within(caches).getByRole('radio', { name: 'Old Mill' }));
    expect(lastChoice(edit)).toEqual({ ...choice, cacheId: 'mill' });
    rerender(
      <ActivityView
        view={facts({ ...choice, cacheId: 'mill' })}
        edit={edit}
        disabled={false}
      />,
    );
    expect(screen.getByText('Holds: Ring.')).toBeVisible();
    // Clearing the mode keeps every recorded value on screen.
    const { mode: _mode, ...unset } = { ...choice, cacheId: 'mill' };
    rerender(
      <ActivityView
        view={facts(unset as StagedActionChoice)}
        edit={edit}
        disabled={false}
      />,
    );
    expect(
      screen.getByText(/Not used until you choose to place a cache/),
    ).toBeVisible();
    expect(textbox('Cache location')).toHaveValue('Old well');
    expect(card('Cache to retrieve', 'Old Mill')).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });
});

describe('Special Orders', () => {
  const order: StagedActionChoice = {
    choiceId: 'order-choice',
    actionId: 'special_order',
    orderId: 'order',
    orderedDay: 21,
  };

  test('[rules.ACT-15.order-edit] an order makes its new item once, saves its name, weight and gp price together and records delivery', async () => {
    const { edit, rerender } = open(
      facts(order, { requirements: ['order-choice:delivery:2d6'] }),
    );
    fireEvent.click(card('Order', 'Order an item'));
    const ordering = lastChoice(edit);
    expect(ordering).toEqual({
      ...order,
      mode: 'purchase',
      itemId: expect.any(String),
    });
    rerender(
      <ActivityView view={facts(ordering)} edit={edit} disabled={false} />,
    );
    const form = screen.getByRole('form', { name: 'Ordered item' });
    fireEvent.change(within(form).getByRole('textbox', { name: 'Item name' }), {
      target: { value: 'Wand of light' },
    });
    fireEvent.change(
      within(form).getByRole('textbox', { name: 'Item price (gp)' }),
      { target: { value: '12.5' } },
    );
    fireEvent.click(
      within(form).getByRole('button', { name: 'Save ordered item' }),
    );
    await waitFor(() =>
      expect(lastChoice(edit)).toEqual({
        ...ordering,
        name: 'Wand of light',
        priceCopper: 1250,
      }),
    );
    fireEvent.click(card('Delivery', 'Expedited'));
    expect(lastChoice(edit)).toEqual({ ...ordering, expedited: true });
    fireEvent.click(card('Order settlement', 'Town'));
    expect(lastChoice(edit)).toEqual({ ...ordering, settlementId: 'town' });
    expect(textbox('Ordered on day')).toHaveValue('21');
    fireEvent.change(textbox('Ordered on day'), { target: { value: '0' } });
    expect(lastChoice(edit)).toEqual({ ...ordering, orderedDay: 0 });
    fireEvent.change(textbox('Delivery roll'), { target: { value: '7' } });
    expect(lastChoice(edit)).toMatchObject({
      rolls: { delivery: { diceTotal: 7, diceCount: 2, sides: 6 } },
    });
  });

  test('[rules.ACT-15.order-receipt] an enchantment picks a held item, a missing order can be started, and a receipt clears with its notes', () => {
    const enchanting: StagedActionChoice = {
      ...order,
      mode: 'enchantment',
      itemId: 'gear',
      receipt: { receivedDay: 25, acknowledgementId: 'receipt' },
      acknowledgements: [
        {
          acknowledgementId: 'receipt',
          subjectId: 'order',
          outcome: 'Arrived',
        },
      ],
    };
    const { edit, rerender } = open(facts(enchanting));
    expect(card('Item to enchant', 'Gear')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(
      within(screen.getByRole('form', { name: 'Ordered item' })).getByRole(
        'textbox',
        { name: 'Enchantment cost (gp)' },
      ),
    ).toBeVisible();
    // The receipt notes are shown once, in the receipt.
    expect(textbox('Receipt notes')).toHaveValue('Arrived');
    expect(
      screen.queryByRole('textbox', { name: /Outcome acknowledgement/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(button('Clear receipt'));
    const { receipt: _receipt, ...unreceived } = enchanting;
    expect(lastChoice(edit)).toEqual({ ...unreceived, acknowledgements: [] });
    const { orderId: _orderId, ...unordered } = order;
    rerender(
      <ActivityView view={facts(unordered)} edit={edit} disabled={false} />,
    );
    expect(
      screen.getByText('This Special Order has no order yet.'),
    ).toBeVisible();
    fireEvent.click(button('Start the order'));
    expect(lastChoice(edit)).toEqual({
      ...unordered,
      orderId: expect.any(String),
    });
  });
});

test('[rules.WEEK-10.economy-disabled] a closed week disables every market, cache and order control', () => {
  open(
    facts({
      choiceId: 'market',
      actionId: 'broker_market',
      purchases: [{ itemId: 'wand', name: 'Wand', priceCopper: 1 }],
      sales: ['gear'],
    }),
    true,
  );
  const details = screen.getByRole('region', { name: 'Action Slot 1 details' });
  for (const control of [
    ...within(details).getAllByRole('button'),
    ...within(details).getAllByRole('radio'),
    ...within(details).getAllByRole('textbox'),
    ...within(details).getAllByRole('combobox'),
  ])
    expect(control).toBeDisabled();
});
