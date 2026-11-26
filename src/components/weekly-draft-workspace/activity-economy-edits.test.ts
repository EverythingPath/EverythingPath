import { describe, expect, test, vi } from 'vitest';
import {
  stagedActionChoiceSchema,
  type StagedActionChoice,
} from '~/lib/weekly-draft-facts';
import type { EconomyChoice } from './activity-economy-detail';
import {
  economyFieldEdits,
  orderItemFormSchema,
  orderItemFormValues,
  purchaseFormSchema,
  purchaseFormValues,
  purchaseFromForm,
} from './activity-economy-edits';

// Applies the edit like the detail host: merge, omit undefined, validate.
function harness(choice: StagedActionChoice) {
  const staged: StagedActionChoice[] = [];
  let id = 0;
  const newId = vi.fn(() => `new-${++id}`);
  const edits = economyFieldEdits(
    choice as EconomyChoice,
    (fields) => {
      const next = stagedActionChoiceSchema.safeParse(
        Object.fromEntries(
          Object.entries({ ...choice, ...fields }).filter(
            ([, value]) => value !== undefined,
          ),
        ),
      );
      if (next.success) staged.push(next.data);
      return next.success;
    },
    newId,
  );
  return { edits, staged, newId, last: () => staged.at(-1) };
}
const broker = (extra: Record<string, unknown> = {}) =>
  ({
    choiceId: 'market',
    actionId: 'broker_market',
    settlementId: 'town',
    ...extra,
  }) as StagedActionChoice;
const wand = { itemId: 'wand', name: 'Wand', priceCopper: 1001, weight: 0.5 };
const availability = (itemId: string) => ({
  acknowledgementId: `ack-${itemId}`,
  subjectId: `availability:${itemId}`,
  outcome: 'In stock',
});

describe('purchases', () => {
  test('[rules.ACT-10.purchase-edits] adding makes one new item identity; saving keeps it; removing takes only its own availability, and the last leaves purchases unrecorded', () => {
    const { edits, last, newId } = harness(
      broker({
        purchases: [wand],
        acknowledgements: [availability('wand'), availability('other')],
      }),
    );
    expect(
      edits.addPurchase({ name: 'Rope', priceCopper: 0, weight: undefined }),
    ).toBe(true);
    expect(newId).toHaveBeenCalledTimes(1);
    expect(last()).toMatchObject({
      purchases: [wand, { itemId: 'new-1', name: 'Rope', priceCopper: 0 }],
    });
    edits.savePurchase('wand', {
      name: undefined,
      priceCopper: 1234,
      weight: 2.25,
    });
    expect(last()).toMatchObject({
      purchases: [{ itemId: 'wand', priceCopper: 1234, weight: 2.25 }],
      settlementId: 'town',
    });
    edits.removePurchase('wand');
    // The last purchase removed leaves them unrecorded, not "none".
    expect(last()).toEqual(
      broker({ acknowledgements: [availability('other')] }),
    );
  });

  test('[rules.ACT-10.purchase-clear] “none” records an empty list; clear omits the list and its availability answers', () => {
    const { edits, last } = harness(
      broker({ purchases: [wand], acknowledgements: [availability('wand')] }),
    );
    edits.recordNoPurchases();
    expect(last()).toMatchObject({ purchases: [] });
    edits.clearPurchases();
    expect(last()).toEqual(broker());
  });

  test('[rules.ACT-10.availability-edits] an availability answer keeps its identity when changed and clears alone', () => {
    const { edits, last, newId } = harness(
      broker({ purchases: [wand], acknowledgements: [availability('wand')] }),
    );
    edits.setAvailability('wand', 'Sold out until spring');
    expect(newId).not.toHaveBeenCalled();
    expect(last()!.acknowledgements).toEqual([
      { ...availability('wand'), outcome: 'Sold out until spring' },
    ]);
    edits.clearAvailability('wand');
    expect(last()).toEqual(broker({ purchases: [wand] }));
  });
});

describe('item references', () => {
  test('[rules.ACT-10.sale-edits] sales and a cache’s held items add once, and removing the last leaves them unrecorded', () => {
    const market = harness(broker({ sales: ['gear'] }));
    market.edits.addSale('gear');
    expect(market.staged).toHaveLength(0);
    market.edits.addSale('ring');
    expect(market.last()).toMatchObject({ sales: ['gear', 'ring'] });
    market.edits.removeSale('gear');
    expect(market.last()).toEqual(broker());
    const cache = harness({
      choiceId: 'cache',
      actionId: 'secure_cache',
      mode: 'place',
      itemIds: ['gear'],
    });
    cache.edits.removeCacheItem('gear');
    expect(cache.last()).not.toHaveProperty('itemIds');
    cache.edits.recordNoCacheItems();
    expect(cache.last()).toMatchObject({ itemIds: [] });
    cache.edits.clearCacheItems();
    expect(cache.last()).not.toHaveProperty('itemIds');
  });
});

describe('modes and identities', () => {
  const cache = (extra: Record<string, unknown>) =>
    ({
      choiceId: 'cache',
      actionId: 'secure_cache',
      cacheClass: 'minor',
      location: 'Old Mill',
      ...extra,
    }) as StagedActionChoice;

  test('[rules.ACT-10.cache-mode] placing makes a new cache once; retrieving drops only a cache that does not exist, keeping the placing values', () => {
    const fresh = harness(cache({ mode: 'retrieve' }));
    fresh.edits.setCacheMode('place', 'none');
    expect(fresh.last()).toMatchObject({ mode: 'place', cacheId: 'new-1' });
    const placed = harness(cache({ mode: 'place', cacheId: 'mine' }));
    placed.edits.setCacheMode('place', 'new');
    expect(placed.newId).not.toHaveBeenCalled();
    placed.edits.setCacheMode('retrieve', 'new');
    expect(placed.last()).toEqual(cache({ mode: 'retrieve' }));
    const existing = harness(cache({ mode: 'retrieve', cacheId: 'mill' }));
    existing.edits.setCacheMode('place', 'existing');
    expect(existing.last()).toEqual(cache({ mode: 'place', cacheId: 'mill' }));
    existing.edits.useNewCache();
    expect(existing.last()).toMatchObject({ cacheId: 'new-1' });
    // A missing cache's identity is never reused for a new one.
    const missing = harness(cache({ mode: 'retrieve', cacheId: 'gone' }));
    missing.edits.setCacheMode('place', 'missing');
    expect(missing.last()).toEqual(cache({ mode: 'place', cacheId: 'new-1' }));
  });

  test('[rules.ACT-10.order-mode] ordering makes a new item once; enchanting drops a new item and its availability; replacing the item drops the old answer', () => {
    const order = (extra: Record<string, unknown>) =>
      ({
        choiceId: 'order',
        actionId: 'special_order',
        orderId: 'o',
        name: 'Wand',
        ...extra,
      }) as StagedActionChoice;
    const blank = harness(order({}));
    blank.edits.setOrderMode('purchase', 'none');
    expect(blank.last()).toMatchObject({ mode: 'purchase', itemId: 'new-1' });
    const fresh = harness(
      order({
        mode: 'purchase',
        itemId: 'mine',
        acknowledgements: [availability('mine')],
      }),
    );
    fresh.edits.setOrderMode('enchantment', 'new');
    expect(fresh.last()).toEqual(order({ mode: 'enchantment' }));
    const enchanting = harness(
      order({
        mode: 'enchantment',
        itemId: 'gear',
        acknowledgements: [availability('gear')],
      }),
    );
    enchanting.edits.setOrderItem('ring');
    expect(enchanting.last()).toEqual(
      order({ mode: 'enchantment', itemId: 'ring' }),
    );
    enchanting.edits.setOrderMode('purchase', 'existing');
    expect(enchanting.newId).not.toHaveBeenCalled();
    enchanting.edits.useNewOrderItem();
    expect(enchanting.last()).toEqual(
      order({ mode: 'enchantment', itemId: 'new-1' }),
    );
    const missing = harness(
      order({
        mode: 'enchantment',
        itemId: 'gone',
        acknowledgements: [availability('gone')],
      }),
    );
    missing.edits.setOrderMode('purchase', 'missing');
    expect(missing.last()).toEqual(
      order({ mode: 'purchase', itemId: 'new-1' }),
    );
    const legacy = harness(order({}));
    legacy.edits.startOrder();
    expect(legacy.last()).toMatchObject({ orderId: 'new-1' });
  });

  test('[rules.ACT-15.order-item] saving the ordered item writes name, weight and price together; blanks omit them and an explicit zero stays', () => {
    const { edits, last } = harness({
      choiceId: 'order',
      actionId: 'special_order',
      name: 'Wand',
      weight: 1,
      priceCopper: 500,
    });
    edits.saveOrderItem({
      name: undefined,
      weight: undefined,
      priceCopper: 0,
    });
    expect(last()).toEqual({
      choiceId: 'order',
      actionId: 'special_order',
      priceCopper: 0,
    });
  });
});

describe('forms', () => {
  test('[rules.ACT-11.gp-entry] purchase prices are entered in gp to the exact copper, with required and malformed messages', () => {
    const parse = (price: string, weight = '', name = '') =>
      purchaseFormSchema.safeParse({ name, price, weight });
    expect(parse('12.34', '1.5', ' Wand ')).toMatchObject({
      success: true,
      data: { name: 'Wand', price: 1234, weight: 1.5 },
    });
    expect(parse('0').data).toEqual({
      name: undefined,
      price: 0,
      weight: undefined,
    });
    expect(parse('0.07').data?.price).toBe(7);
    expect(parse('').error?.issues[0]?.message).toBe('A price is required.');
    expect(parse('1.234').error?.issues[0]?.message).toBe(
      'Use at most two decimal places (1 cp = 0.01 gp).',
    );
    expect(parse('1e3').error?.issues[0]?.message).toBe(
      'Enter an amount in gp, such as 12 or 0.07.',
    );
    expect(parse('1', 'heavy').error?.issues[0]?.message).toBe(
      'Enter the weight in pounds, such as 2 or 0.5.',
    );
    expect(parse('1', '.5').data?.weight).toBe(0.5);
    // Every stored copper amount round-trips exactly.
    const values = purchaseFormValues({
      name: 'Wand',
      priceCopper: 123456789,
      weight: 0.25,
    });
    expect(values).toEqual({
      name: 'Wand',
      price: '1234567.89',
      weight: '0.25',
    });
    expect(purchaseFromForm(purchaseFormSchema.parse(values)).priceCopper).toBe(
      123456789,
    );
    // The ordered item's price may be blank while preparing.
    expect(
      orderItemFormSchema.parse({ name: '', price: '', weight: '' }),
    ).toEqual({ name: undefined, price: undefined, weight: undefined });
    expect(
      orderItemFormValues({
        choiceId: 'o',
        actionId: 'special_order',
        priceCopper: 1,
      }),
    ).toEqual({ name: '', price: '0.01', weight: '' });
  });
});
