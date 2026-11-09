import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { Id } from '@convex/_generated/dataModel';
import { acceptedCampaignSetup } from '../../../tests/rules/accepted-campaign';
import type { CanonicalWeekState } from '~/lib/canonical-weekly-source';
import { createWeeklyDraft } from '~/lib/weekly-draft';
import { MilitiaSection } from '~/components/campaign-sections/militia-section';
import { stableControl } from '../../../tests/stable-control';
import { convexNames } from '../../../tests/convex-names';
import { api } from '@convex/_generated/api';

// Items, Caches, Orders and Marketplaces corrections (#177): each saves only
// its own list, names the open-week choices a removal affects, and restores
// missing items and caches under their identities, items before the cache
// that holds them.

type Call = {
  args: Record<string, unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};
let calls: Call[] = [];
let queries: Record<string, unknown> = {};

const nameOf = convexNames({
  workspace: api.canonicalDraftPersistence.workspace,
  observe: api.canonicalDraftPersistence.observe,
  read: api.canonicalLedger.read,
  save: api.canonicalLedger.save,
});
vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => ({
    kind: 'ready',
    readOnly: false,
    message: '',
  }),
}));
vi.mock('convex/react', () => ({
  useMutation: () => (args: Record<string, unknown>) =>
    new Promise((resolve, reject) => {
      calls.push({ args, resolve, reject });
    }),
}));
vi.mock('@tanstack/react-query', async () => {
  const { queryDataMock } = await import('../../../tests/query-data');
  return queryDataMock((name) => queries[nameOf(name)]);
});
vi.mock('~/lib/sharedQueries', () => ({
  useCharacterLedgerQuery: () => ({
    data: [
      {
        _id: 'officer',
        name: 'Ada',
        level: 12,
        strength: 10,
        dexterity: 11,
        constitution: 12,
        intelligence: 13,
        wisdom: 14,
        charisma: 15,
      },
    ],
  }),
}));
vi.mock('~/components/campaign-shell/navigation-guard', () => ({
  GuardedLink: ({
    href,
    children,
    ...props
  }: ComponentProps<'a'> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

type Snapshot = CanonicalWeekState['militiaSnapshot'];
type Economy = NonNullable<Snapshot['economy']>;
type Item = Economy['items'][number];
type Cache = Economy['caches'][number];

const campaignId = 'campaign' as Id<'campaign'>;
const ring: Item = {
  itemId: 'ring',
  name: 'Ring',
  valueCopper: 500,
  weight: 0.25,
  location: 'cache',
  identified: true,
};
const gem: Item = {
  itemId: 'gem',
  name: 'Gem',
  valueCopper: 200,
  weight: 0.5,
  location: 'held',
};
const mill: Cache = {
  cacheId: 'mill',
  cacheClass: 'minor',
  location: 'Old Mill',
  secure: true,
  extradimensional: false,
  itemIds: ['ring'],
  status: 'hidden',
  returnActivityWeek: null,
};

// The accepted militia (Sword on order from Town, a cache in the Forest)
// with the Ring in the Old Mill cache and the Gem, unless left out.
function state({ withItems = true, withMill = true } = {}) {
  const value = structuredClone(acceptedCampaignSetup('officer').state);
  const economy = value.militiaSnapshot.economy!;
  if (withItems) economy.items.push({ ...ring }, { ...gem });
  if (withMill) economy.caches.push({ ...mill, itemIds: [...mill.itemIds] });
  return value;
}
// The open week: Activity slot 2 retrieves the Old Mill cache and a rolled
// theft targets the Gem.
function openDraft(week: CanonicalWeekState) {
  const draft = createWeeklyDraft({
    draftId: 'draft-9',
    week: week.week,
    context: week.context,
    slotIds: ['one', 'two'],
  });
  draft.activity.slots[1]!.choice = {
    choiceId: 'fetch',
    actionId: 'secure_cache',
    mode: 'retrieve',
    cacheId: 'mill',
  };
  draft.event.occurrences = [
    {
      eventId: 'rolled',
      origin: { kind: 'rolled' },
      eventType: 'theft',
      targets: [{ kind: 'item', itemId: 'gem' }],
    },
  ];
  return draft;
}
function setMilitia(revision: number, week: CanonicalWeekState) {
  queries = {
    workspace: {
      key: { campaignId, militiaId: 'militia', draftId: 'draft-9' },
      week: week.week,
    },
    read: { revision, state: week },
    observe: { status: 'open', revision: 1, draft: openDraft(week) },
  };
}
const page = () => (
  <MilitiaSection campaignId={campaignId} organizationId="org" />
);
const index = () =>
  screen.getByRole('navigation', { name: 'Militia sections' });
const entry = (name: RegExp) => within(index()).getByRole('button', { name });
const pane = (heading: string) =>
  within(
    screen
      .getByRole('heading', { name: heading })
      .closest<HTMLElement>('section')!,
  );
const summary = () =>
  screen
    .getByText('Fix these before saving')
    .closest<HTMLElement>('[role="alert"]')!;
async function press(button: HTMLElement) {
  await act(async () => {
    fireEvent.click(button);
  });
}
function openSection(label: 'Items' | 'Caches' | 'Orders' | 'Marketplaces') {
  fireEvent.click(entry(new RegExp(`^${label}`)));
  fireEvent.click(
    screen.getByRole('button', { name: `Correct ${label.toLowerCase()}` }),
  );
  const editor = pane(`Correct ${label.toLowerCase()}`);
  return {
    editor,
    reason: stableControl('textbox', 'Reason for correction', editor),
    save: stableControl('button', 'Save correction', editor),
  };
}
const sent = () => calls[0]!.args.snapshot as Snapshot;
const choose = (
  container: Pick<typeof screen, 'getByRole'>,
  group: string,
  choice: string,
) =>
  fireEvent.click(
    within(container.getByRole('group', { name: group })).getByRole('button', {
      name: choice,
    }),
  );

beforeEach(() => {
  calls = [];
  setMilitia(3, state());
});

describe('Items correction', () => {
  test('adding an item with a decimal weight saves only the items onto the latest militia, keeping concurrent caches and orders', async () => {
    const view = render(page());
    const { editor, reason, save } = openSection('Items');
    fireEvent.click(editor.getByRole('button', { name: 'Add item' }));
    const added = within(editor.getByRole('group', { name: 'Item 4' }));
    fireEvent.change(added.getByRole('textbox', { name: 'Item name' }), {
      target: { value: 'Lantern' },
    });
    fireEvent.change(
      added.getByRole('textbox', { name: 'Item value (copper)' }),
      { target: { value: '120' } },
    );
    fireEvent.change(added.getByRole('textbox', { name: 'Item weight' }), {
      target: { value: '1.5' },
    });
    // Another player changes the caches and orders meanwhile.
    const latest = state();
    latest.militiaSnapshot.economy!.caches[0]!.location = 'Deep Forest';
    latest.militiaSnapshot.economy!.orders[0]!.deliveryDays = 2.5;
    setMilitia(4, latest);
    view.rerender(page());
    fireEvent.change(reason(), { target: { value: 'Bought a lantern' } });
    await press(save());
    expect(calls).toHaveLength(1);
    expect(calls[0]!.args).toMatchObject({
      expectedRevision: 4,
      reason: 'Bought a lantern',
    });
    const economy = sent().economy!;
    expect(economy.items.at(-1)).toMatchObject({
      name: 'Lantern',
      valueCopper: 120,
      weight: 1.5,
      location: 'held',
    });
    expect(economy.caches).toEqual(latest.militiaSnapshot.economy!.caches);
    expect(economy.orders).toEqual(latest.militiaSnapshot.economy!.orders);
    expect(sent().roster).toEqual(latest.militiaSnapshot.roster);
  });

  test('a militia without assets yet gains a complete economy holding only the added item', async () => {
    const bare = state({ withItems: false, withMill: false });
    delete bare.militiaSnapshot.economy;
    bare.context.orders = [];
    setMilitia(3, bare);
    render(page());
    const { editor, reason, save } = openSection('Items');
    fireEvent.click(editor.getByRole('button', { name: 'Add item' }));
    const added = within(editor.getByRole('group', { name: 'Item 1' }));
    fireEvent.change(added.getByRole('textbox', { name: 'Item name' }), {
      target: { value: 'Lantern' },
    });
    fireEvent.change(
      added.getByRole('textbox', { name: 'Item value (copper)' }),
      { target: { value: '120' } },
    );
    fireEvent.change(added.getByRole('textbox', { name: 'Item weight' }), {
      target: { value: '1.5' },
    });
    fireEvent.change(reason(), { target: { value: 'Bought a lantern' } });
    await press(save());
    expect(calls).toHaveLength(1);
    expect(sent().economy).toEqual({
      items: [expect.objectContaining({ name: 'Lantern', weight: 1.5 })],
      caches: [],
      orders: [],
      markets: [],
    });
  });

  test('a malformed decimal is invalid, not required, in the linked summary', async () => {
    render(page());
    const { editor, reason, save } = openSection('Items');
    const first = within(editor.getByRole('group', { name: 'Item 1' }));
    fireEvent.change(first.getByRole('textbox', { name: 'Item weight' }), {
      target: { value: '2.x' },
    });
    fireEvent.change(reason(), { target: { value: 'Reweighed' } });
    await press(save());
    expect(calls).toHaveLength(0);
    expect(
      within(summary()).getByRole('button', {
        name: 'Enter a valid number for Item 1 weight.',
      }),
    ).toBeVisible();
  });

  test('removing an item a staged choice uses names the choice and still saves', async () => {
    render(page());
    const { editor, reason, save } = openSection('Items');
    fireEvent.click(editor.getByRole('button', { name: 'Remove Item 3' }));
    const affects = screen.getByRole('complementary', {
      name: 'This affects the open week',
    });
    expect(affects).toHaveTextContent(
      'Removing Gem leaves Event · Theft without an item.',
    );
    expect(
      within(affects).getByRole('link', { name: 'Event · Theft' }),
    ).toHaveAttribute('href', '/campaigns/campaign/week?phase=event');
    fireEvent.change(reason(), { target: { value: 'Gem was sold' } });
    await press(save());
    expect(calls).toHaveLength(1);
    expect(sent().economy!.items.map((item) => item.itemId)).toEqual([
      'sword',
      'ring',
    ]);
  });

  test('removing an item a cache holds or an order needs is refused, naming the item and what holds it', async () => {
    render(page());
    const { editor, reason, save } = openSection('Items');
    fireEvent.click(editor.getByRole('button', { name: 'Remove Item 2' }));
    fireEvent.click(editor.getByRole('button', { name: 'Remove Item 1' }));
    fireEvent.change(reason(), { target: { value: 'Clearing out' } });
    await press(save());
    expect(calls).toHaveLength(0);
    const errors = summary();
    expect(errors).toHaveTextContent('Keep Ring: Cache at Old Mill holds it.');
    // The Sword's order is carried into the week: named once.
    expect(errors).toHaveTextContent(
      'Keep Sword: a carried order still needs it.',
    );
    expect(errors).not.toHaveTextContent('an order from Town');
    expect(errors).not.toHaveTextContent('Unknown referenced entity');
  });
});

describe('Caches correction', () => {
  test('removing a cache a staged slot retrieves names the slot and saves only the caches', async () => {
    render(page());
    const { editor, reason, save } = openSection('Caches');
    fireEvent.click(editor.getByRole('button', { name: 'Remove Cache 2' }));
    expect(
      screen.getByRole('complementary', {
        name: 'This affects the open week',
      }),
    ).toHaveTextContent(
      'Removing Cache at Old Mill leaves Activity slot 2 (Secure Cache) without a cache.',
    );
    fireEvent.change(reason(), { target: { value: 'The mill burned' } });
    await press(save());
    expect(calls).toHaveLength(1);
    const before = state().militiaSnapshot.economy!;
    expect(sent().economy).toEqual({
      ...before,
      caches: before.caches.filter((cache) => cache.cacheId !== 'mill'),
    });
  });
});

describe('an item removed by another player meanwhile', () => {
  test('a cache correction holding it is refused, naming the cache and the item', async () => {
    const view = render(page());
    const { editor, reason, save } = openSection('Caches');
    const forest = within(editor.getByRole('group', { name: 'Cache 1' }));
    fireEvent.click(forest.getByRole('button', { name: 'Gem' }));
    // The Gem is sold elsewhere before this correction is saved.
    const latest = state();
    latest.militiaSnapshot.economy!.items =
      latest.militiaSnapshot.economy!.items.filter(
        (item) => item.itemId !== 'gem',
      );
    setMilitia(4, latest);
    view.rerender(page());
    fireEvent.change(reason(), { target: { value: 'Hid the gem' } });
    await press(save());
    expect(calls).toHaveLength(0);
    expect(summary()).toHaveTextContent(
      'Cache at Forest holds Gem, which is no longer in the militia.',
    );
    expect(summary()).not.toHaveTextContent('Unknown referenced entity');
  });
});

describe('Orders correction', () => {
  test('decimal delivery facts and a recorded then cleared receipt save only the orders', async () => {
    render(page());
    const { editor, reason, save } = openSection('Orders');
    const order = within(editor.getByRole('group', { name: 'Order 1' }));
    fireEvent.change(
      order.getByRole('textbox', { name: 'Delivery duration (days)' }),
      { target: { value: '1.5' } },
    );
    fireEvent.change(
      order.getByRole('textbox', { name: 'Due day (day delivery)' }),
      { target: { value: '56.5' } },
    );
    fireEvent.click(order.getByRole('button', { name: 'Record receipt' }));
    expect(order.getByRole('textbox', { name: 'Received day' })).toHaveValue(
      '56',
    );
    fireEvent.change(reason(), { target: { value: 'Sword arrived' } });
    await press(save());
    expect(calls).toHaveLength(1);
    const before = state().militiaSnapshot.economy!;
    expect(sent().economy).toEqual({
      ...before,
      orders: [
        {
          ...before.orders[0]!,
          deliveryDays: 1.5,
          dueDay: 56.5,
          receipt: { receivedDay: 56, acknowledgementId: expect.any(String) },
        },
      ],
    });
  });

  test('a recorded receipt can be cleared', async () => {
    const received = state();
    received.militiaSnapshot.economy!.orders[0]!.receipt = {
      receivedDay: 56,
      acknowledgementId: 'ack',
    };
    setMilitia(3, received);
    render(page());
    const { editor, reason, save } = openSection('Orders');
    fireEvent.click(editor.getByRole('button', { name: 'Mark unreceived' }));
    fireEvent.change(reason(), { target: { value: 'Not delivered yet' } });
    await press(save());
    expect(calls).toHaveLength(1);
    expect(sent().economy!.orders[0]!.receipt).toBeNull();
  });
});

describe('Marketplaces correction', () => {
  test('an added marketplace saves only the marketplaces', async () => {
    render(page());
    const { editor, reason, save } = openSection('Marketplaces');
    fireEvent.click(editor.getByRole('button', { name: 'Add marketplace' }));
    const market = within(editor.getByRole('group', { name: 'Marketplace 1' }));
    choose(market, 'Market settlement', 'Town');
    fireEvent.change(
      market.getByRole('textbox', { name: 'Sale percent (optional)' }),
      { target: { value: '60' } },
    );
    fireEvent.change(reason(), { target: { value: 'Broker opened' } });
    await press(save());
    expect(calls).toHaveLength(1);
    const before = state().militiaSnapshot.economy!;
    expect(sent().economy).toEqual({
      ...before,
      markets: [
        expect.objectContaining({
          source: 'broker_market',
          settlementId: 'town',
          salePercent: 60,
        }),
      ],
    });
  });
});

describe('restoring missing items and caches', () => {
  test('a cache holding a missing item waits for it; the item is restored first from facts this device saw', async () => {
    const view = render(page());
    setMilitia(4, state({ withItems: false, withMill: false }));
    view.rerender(page());

    fireEvent.click(entry(/^Caches/));
    const cacheMissing = within(
      screen.getByRole('region', { name: 'Missing from the militia' }),
    );
    expect(cacheMissing.getByText('Cache at Old Mill')).toBeVisible();
    const restoreMill = cacheMissing.getByRole('button', {
      name: 'Restore Cache at Old Mill',
    });
    expect(restoreMill).toBeDisabled();
    expect(restoreMill).toHaveAccessibleDescription(
      'Restore Ring in Items first.',
    );

    fireEvent.click(entry(/^Items/));
    const itemMissing = within(
      screen.getByRole('region', { name: 'Missing from the militia' }),
    );
    expect(itemMissing.getByText('Gem')).toBeVisible();
    expect(
      itemMissing.getByRole('link', { name: 'Event · Theft' }),
    ).toHaveAttribute('href', '/campaigns/campaign/week?phase=event');
    expect(itemMissing.getByText('Ring')).toBeVisible();
    expect(itemMissing.getByText(/Cache at Old Mill/)).toBeVisible();
    fireEvent.click(itemMissing.getByRole('button', { name: 'Restore Ring' }));
    const editor = pane('Correct items');
    const restored = within(editor.getByRole('group', { name: 'Item 2' }));
    expect(restored.getByText('Needed by Cache at Old Mill')).toBeVisible();
    // The Gem can be added to the same correction.
    fireEvent.click(editor.getByRole('button', { name: 'Restore Gem' }));
    fireEvent.change(
      stableControl('textbox', 'Reason for correction', editor)(),
      { target: { value: 'Never sold' } },
    );
    await press(stableControl('button', 'Save correction', editor)());
    expect(calls).toHaveLength(1);
    expect(sent().economy!.items.slice(1)).toEqual([ring, gem]);
    expect(sent().economy!.caches).toEqual(
      state({ withMill: false }).militiaSnapshot.economy!.caches,
    );
  });

  test('once its items exist, a cache is restored after a reload from entered facts', async () => {
    setMilitia(5, state({ withMill: false }));
    render(page());
    fireEvent.click(entry(/^Caches/));
    const missing = within(
      screen.getByRole('region', { name: 'Missing from the militia' }),
    );
    expect(missing.getByText('A missing cache')).toBeVisible();
    fireEvent.click(
      missing.getByRole('button', {
        name: 'Restore missing cache for Activity slot 2',
      }),
    );
    const editor = pane('Correct caches');
    const restored = within(editor.getByRole('group', { name: 'Cache 2' }));
    expect(restored.getByText('Needed by Activity slot 2')).toBeVisible();
    // Nothing is invented: the facts are entered again.
    expect(
      restored.getByRole('textbox', { name: 'Cache location' }),
    ).toHaveValue('');
    const reason = stableControl('textbox', 'Reason for correction', editor);
    const save = stableControl('button', 'Save correction', editor);
    fireEvent.change(reason(), { target: { value: 'The mill still stands' } });
    await press(save());
    expect(calls).toHaveLength(0);
    for (const message of [
      'Cache 2 location is required.',
      'Cache 2 class is required.',
      'Cache 2 status is required.',
      'Cache 2 secure location is required.',
      'Cache 2 extradimensional is required.',
    ])
      expect(summary()).toHaveTextContent(message);

    fireEvent.change(
      restored.getByRole('textbox', { name: 'Cache location' }),
      {
        target: { value: 'Old Mill' },
      },
    );
    choose(restored, 'Cache class', 'minor');
    choose(restored, 'Cache status', 'hidden');
    choose(restored, 'Secure location', 'Yes');
    choose(restored, 'Extradimensional', 'No');
    fireEvent.click(restored.getByRole('button', { name: 'Ring' }));
    await press(save());
    expect(calls).toHaveLength(1);
    expect(sent().economy!.caches.at(-1)).toEqual(mill);
    expect(sent().economy!.items).toEqual(
      state({ withMill: false }).militiaSnapshot.economy!.items,
    );
  });
});
