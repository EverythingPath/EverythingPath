import { z } from 'zod';
import {
  identitySchema as id,
  integerSchema as int,
} from './weekly-draft-facts';

export const economyItemSchema = z.strictObject({
  itemId: id,
  ownerCharacterId: id.optional(),
  identified: z.boolean().optional(),
  name: z.string().trim().min(1),
  valueCopper: int,
  weight: z.number().nonnegative(),
  location: z.enum([
    'held',
    'cache',
    'order',
    'returning',
    'enchanting',
    'sold',
    'lost',
  ]),
});
export const economyStateSchema = z
  .strictObject({
    items: z.array(economyItemSchema),
    caches: z.array(
      z.strictObject({
        cacheId: id,
        cacheClass: z.enum(['minor', 'intermediate', 'major']),
        location: z.string().trim().min(1),
        secure: z.boolean(),
        extradimensional: z.boolean(),
        itemIds: z.array(id),
        status: z.enum(['hidden', 'retrieved', 'returning', 'lost']),
        returnActivityWeek: int.nullable(),
      }),
    ),
    markets: z.array(
      z.strictObject({
        marketId: id,
        source: z.enum([
          'activate_black_market',
          'broker_market',
          'market_day',
        ]),
        settlementId: id,
        availableWeek: int,
        expiresWeek: int,
        availability: z.enum(['small_town', 'small_city']).nullable(),
        availabilityPercent: int.nullable(),
        salePercent: int.nullable(),
        contraband: z.boolean(),
      }),
    ),
    orders: z.array(
      z.strictObject({
        orderId: id,
        itemId: id,
        source: z.enum([
          'special_order',
          'broker_market',
          'activate_black_market',
        ]),
        settlementId: id,
        mode: z.enum(['purchase', 'enchantment']),
        orderedWeek: int,
        orderedDay: int,
        dueDay: z.number().nonnegative().nullable(),
        dueActivityWeek: int.nullable(),
        priceCopper: int,
        deliveryDays: z.number().nonnegative().nullable(),
        enchantmentValueCopper: int,
        receipt: z
          .strictObject({ receivedDay: int, acknowledgementId: id })
          .nullable(),
      }),
    ),
  })
  .superRefine((state, ctx) => {
    for (const [name, ids] of [
      ['items', state.items.map((x) => x.itemId)],
      ['caches', state.caches.map((x) => x.cacheId)],
      ['markets', state.markets.map((x) => x.marketId)],
      ['orders', state.orders.map((x) => x.orderId)],
    ] as const) {
      if (new Set(ids).size !== ids.length)
        ctx.addIssue({
          code: 'custom',
          path: [name],
          message: 'Duplicate asset identity',
        });
    }
  });
export type EconomyState = z.infer<typeof economyStateSchema>;
export type EconomyChange =
  | {
      kind: 'market';
      choiceId: string;
      market: EconomyState['markets'][number];
    }
  | { kind: 'expire_market'; marketId: string }
  | {
      kind: 'item';
      choiceId: string;
      before: EconomyState['items'][number] | null;
      after: EconomyState['items'][number];
    }
  | {
      kind: 'cache';
      choiceId: string;
      before: EconomyState['caches'][number] | null;
      after: EconomyState['caches'][number];
    }
  | { kind: 'order'; choiceId: string; order: EconomyState['orders'][number] }
  | {
      kind: 'receive_order';
      orderId: string;
      receipt: NonNullable<EconomyState['orders'][number]['receipt']>;
    };
