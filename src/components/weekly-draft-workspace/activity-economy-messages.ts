import type { StagedActionChoice } from '~/lib/weekly-draft-facts';

// Wording for the market, cache and Special Order rules codes. Codes that
// name one item carry its identity after the key, so they match by prefix.

export const economyMessages: Record<string, string> = {
  purchases: 'Record the purchases, or record that there are none.',
  'cache-target': 'Choose whether to place or retrieve a cache.',
  'hidden-cache': 'Choose a hidden cache to retrieve.',
  'cache-items':
    'Review the cache’s items: a placed cache holds at least one item, each listed once, and a retrieved cache still holds its items.',
  'duplicate-cache':
    'This cache already exists. Place a new cache, or retrieve this one.',
  'cache-contents':
    'Complete the cache: its class, location, secure and extradimensional choices, the owned items and the purchases (or none).',
  'cache-tier':
    'This team’s tier does not normally handle this cache class or a secure location.',
  'cache-capacity':
    'The cache’s contents exceed its class’s weight or value limit.',
  'owned-items': 'Every owned item placed in a cache must be held now.',
  'purchased-items':
    'Each item bought for the cache needs a name, a weight and a new item.',
  itemId: 'Choose the item to order or enchant.',
  orderId: 'This Special Order has no order yet. Start the order.',
  priceCopper: 'Enter the item price or the enchantment cost.',
  expedited: 'Choose normal or expedited delivery.',
  orderedDay: 'Enter the day the order is placed.',
  settlementId: 'Choose the settlement where the order is placed.',
  'duplicate-order-or-item':
    'This order or its item already exists. Order a new item.',
  'existing-item': 'An enchantment needs an item the militia holds now.',
  'economy-state':
    'The militia’s items and caches are not recorded yet. Record them in Militia corrections.',
  'unreceived-order': 'This order is not waiting for delivery.',
  'delivery-day': 'The received day is before the order’s delivery day.',
  'receipt-acknowledgement': 'Describe what was received.',
  'ordered-item': 'The ordered item is no longer waiting for delivery.',
  'returning-items': 'A returning cache’s items are no longer on their way.',
};

const itemMessages: [RegExp, string][] = [
  [/^sale:/, 'Every sold item must be held when the market opens.'],
  [/^duplicate-item:/, 'Each purchase needs a new item; this one exists.'],
  [/^item:/, 'Name each purchase and enter its weight.'],
  [
    /^acknowledgement:availability:/,
    'Record whether each purchased or ordered item is available.',
  ],
];

type ActionId = StagedActionChoice['actionId'];
const actionMessages: Partial<Record<ActionId, Record<string, string>>> = {
  activate_black_market: {
    settlement:
      'Choose the market’s settlement; its reputation sets purchase prices.',
  },
  broker_market: {
    settlement:
      'Choose the market’s settlement; its reputation sets purchase prices.',
  },
  secure_cache: {
    settlement:
      'Choose where the cache’s purchases are bought; its reputation sets their prices.',
  },
  special_order: {
    item: 'Name the ordered item and enter its weight.',
    settlement:
      'Choose a settlement with a recorded reputation; it sets the price.',
  },
};

// The wording for a market, cache or order code that names one item, or
// that means something particular for `actionId`.
export function economyCodeMessage(key: string, actionId?: ActionId) {
  const own = actionId ? actionMessages[actionId]?.[key] : undefined;
  if (own) return own;
  return itemMessages.find(([pattern]) => pattern.test(key))?.[1] ?? null;
}
