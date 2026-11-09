import { z } from 'zod';
import { copperToGpInput, parseGpInput } from '~/lib/gp-money';
import type { StagedActionChoice } from '~/lib/weekly-draft-facts';
import { commonFieldEdits } from './activity-action-edits';
import type { EconomyChoice, IdentityState } from './activity-economy-detail';

// Named edits for the market, cache and Special Order detail editors. Each
// builds the next values of the choice fields it touches and hands them to
// `change`, which validates the complete choice and stages it as one detail
// edit. `undefined` omits a field (the existing clear); an empty list records
// that there are none. A new purchase, cache, ordered item or order gets its
// identity once, when the edit that creates it is made.

type Purchase = NonNullable<
  Extract<StagedActionChoice, { actionId: 'broker_market' }>['purchases']
>[number];
type Acknowledgement = NonNullable<
  StagedActionChoice['acknowledgements']
>[number];
// Returns false when the resulting choice is structurally invalid; `field`
// names where the caller shows why.
export type ChangeFields = (
  fields: Record<string, unknown>,
  field: string,
) => boolean;
export type PurchaseValues = {
  name: string | undefined;
  priceCopper: number;
  weight: number | undefined;
};
export type OrderItemValues = {
  name: string | undefined;
  priceCopper: number | undefined;
  weight: number | undefined;
};

const availabilitySubject = (itemId: string) => `availability:${itemId}`;

export function economyFieldEdits(
  choice: EconomyChoice,
  change: ChangeFields,
  newId: () => string = () => crypto.randomUUID(),
) {
  const set = (field: string, value: unknown) =>
    change({ [field]: value }, field);
  const acknowledgements = choice.acknowledgements ?? [];
  const purchases: Purchase[] | undefined =
    'purchases' in choice ? choice.purchases : undefined;
  // Acknowledgements without those about `itemIds`, or undefined when none
  // remain, so a removed purchase or item takes its availability with it.
  function withoutAvailability(itemIds: (string | undefined)[]) {
    const subjects = new Set(
      itemIds.flatMap((itemId) =>
        itemId ? [availabilitySubject(itemId)] : [],
      ),
    );
    const kept = acknowledgements.filter(
      (entry) => !subjects.has(entry.subjectId),
    );
    return kept.length ? kept : undefined;
  }
  function purchase(itemId: string, values: PurchaseValues): Purchase {
    return {
      itemId,
      priceCopper: values.priceCopper,
      ...(values.name === undefined ? {} : { name: values.name }),
      ...(values.weight === undefined ? {} : { weight: values.weight }),
    };
  }
  // A list of item references. Removing the last entry omits the list, so
  // only an explicit "none" records that there are none.
  function references(
    field: 'sales' | 'itemIds',
    recorded: string[] | undefined,
  ) {
    return {
      add: (itemId: string) =>
        recorded?.includes(itemId)
          ? true
          : set(field, [...(recorded ?? []), itemId]),
      remove: (itemId: string) => {
        const next = (recorded ?? []).filter((entry) => entry !== itemId);
        return set(field, next.length ? next : undefined);
      },
    };
  }
  const sales = references(
    'sales',
    'sales' in choice ? choice.sales : undefined,
  );
  const cacheItems = references(
    'itemIds',
    choice.actionId === 'secure_cache' ? choice.itemIds : undefined,
  );
  return {
    ...commonFieldEdits(choice, set),
    // Purchases (markets and placed caches).
    recordNoPurchases() {
      return set('purchases', []);
    },
    clearPurchases() {
      return change(
        {
          purchases: undefined,
          acknowledgements: withoutAvailability(
            (purchases ?? []).map((entry) => entry.itemId),
          ),
        },
        'purchases',
      );
    },
    addPurchase(values: PurchaseValues) {
      return set('purchases', [
        ...(purchases ?? []),
        purchase(newId(), values),
      ]);
    },
    savePurchase(itemId: string, values: PurchaseValues) {
      return set(
        'purchases',
        (purchases ?? []).map((entry) =>
          entry.itemId === itemId ? purchase(itemId, values) : entry,
        ),
      );
    },
    // Removing the last purchase leaves them unrecorded, like clearing.
    removePurchase(itemId: string) {
      const remaining = (purchases ?? []).filter(
        (entry) => entry.itemId !== itemId,
      );
      return change(
        {
          purchases: remaining.length ? remaining : undefined,
          acknowledgements: withoutAvailability([itemId]),
        },
        'purchases',
      );
    },
    // Whether a purchased or ordered item is available, as the table found.
    setAvailability(itemId: string, outcome: string) {
      const subjectId = availabilitySubject(itemId);
      const existing = acknowledgements.find(
        (entry) => entry.subjectId === subjectId,
      );
      const next: Acknowledgement = {
        acknowledgementId: existing?.acknowledgementId ?? newId(),
        subjectId,
        outcome,
      };
      return set('acknowledgements', [
        ...acknowledgements.filter((entry) => entry.subjectId !== subjectId),
        next,
      ]);
    },
    clearAvailability(itemId: string) {
      return set('acknowledgements', withoutAvailability([itemId]));
    },
    addSale: sales.add,
    removeSale: sales.remove,
    // A placed cache's held items.
    addCacheItem: cacheItems.add,
    removeCacheItem: cacheItems.remove,
    recordNoCacheItems() {
      return set('itemIds', []);
    },
    clearCacheItems() {
      return set('itemIds', undefined);
    },
    setBoolean(field: string, value: string) {
      return set(field, value === 'true');
    },
    // Placing makes a new cache, never reusing a missing cache's identity
    // (Militia corrections may restore it); retrieving drops an identity no
    // cache has, since retrieving refers to an existing cache.
    setCacheMode(mode: 'place' | 'retrieve', cache: IdentityState) {
      if (mode === 'place')
        return change(
          {
            mode,
            ...(cache === 'none' || cache === 'missing'
              ? { cacheId: newId() }
              : {}),
          },
          'mode',
        );
      return change(
        { mode, ...(cache === 'new' ? { cacheId: undefined } : {}) },
        'mode',
      );
    },
    useNewCache() {
      return set('cacheId', newId());
    },
    // Ordering makes a new item, never reusing a missing item's identity;
    // enchanting drops an identity no item has, since an enchantment refers
    // to an existing item.
    setOrderMode(mode: 'purchase' | 'enchantment', item: IdentityState) {
      const itemId = 'itemId' in choice ? choice.itemId : undefined;
      if (mode === 'purchase')
        return change(
          {
            mode,
            ...(item === 'none' || item === 'missing'
              ? {
                  itemId: newId(),
                  acknowledgements: withoutAvailability([itemId]),
                }
              : {}),
          },
          'mode',
        );
      return change(
        {
          mode,
          ...(item === 'new'
            ? {
                itemId: undefined,
                acknowledgements: withoutAvailability([itemId]),
              }
            : {}),
        },
        'mode',
      );
    },
    // The item to enchant; its old item's availability goes with it.
    setOrderItem(itemId: string | null) {
      const recorded = 'itemId' in choice ? choice.itemId : undefined;
      return change(
        {
          itemId: itemId ?? undefined,
          acknowledgements:
            recorded && recorded !== itemId
              ? withoutAvailability([recorded])
              : choice.acknowledgements,
        },
        'itemId',
      );
    },
    useNewOrderItem() {
      const recorded = 'itemId' in choice ? choice.itemId : undefined;
      return change(
        { itemId: newId(), acknowledgements: withoutAvailability([recorded]) },
        'itemId',
      );
    },
    saveOrderItem(values: OrderItemValues) {
      return change(
        {
          name: values.name,
          weight: values.weight,
          priceCopper: values.priceCopper,
        },
        'name',
      );
    },
    startOrder() {
      return set('orderId', newId());
    },
  };
}
export type EconomyFieldEdits = ReturnType<typeof economyFieldEdits>;

// Form text: a name (blank omits it), a price in gp (exact copper) and a
// weight in pounds (a decimal; blank omits it).
const nameText = z.string().transform((text) => text.trim() || undefined);
const optionalGpText = z.string().transform((text, context) => {
  const parsed = parseGpInput(text);
  if (parsed.kind === 'valid') return parsed.copper;
  if (parsed.kind === 'empty') return undefined;
  context.addIssue({ code: 'custom', message: parsed.message });
  return z.NEVER;
});
const requiredGpText = z.string().transform((text, context) => {
  const parsed = parseGpInput(text);
  if (parsed.kind === 'valid') return parsed.copper;
  context.addIssue({
    code: 'custom',
    message: parsed.kind === 'empty' ? 'A price is required.' : parsed.message,
  });
  return z.NEVER;
});
const weightText = z.string().transform((text, context) => {
  const trimmed = text.trim();
  if (trimmed === '') return undefined;
  if (/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed)) {
    const weight = Number(trimmed);
    if (Number.isFinite(weight)) return weight;
  }
  context.addIssue({
    code: 'custom',
    message: 'Enter the weight in pounds, such as 2 or 0.5.',
  });
  return z.NEVER;
});

export const purchaseFormSchema = z.object({
  name: nameText,
  price: requiredGpText,
  weight: weightText,
});
export type PurchaseForm = z.input<typeof purchaseFormSchema>;
export function purchaseFromForm(
  form: z.output<typeof purchaseFormSchema>,
): PurchaseValues {
  return { name: form.name, priceCopper: form.price, weight: form.weight };
}
export function purchaseFormValues(purchase?: {
  name: string | null;
  priceCopper: number;
  weight: number | null;
}): PurchaseForm {
  return {
    name: purchase?.name ?? '',
    price: purchase ? copperToGpInput(purchase.priceCopper) : '',
    weight:
      purchase?.weight === null || purchase?.weight === undefined
        ? ''
        : String(purchase.weight),
  };
}

export const orderItemFormSchema = z.object({
  name: nameText,
  price: optionalGpText,
  weight: weightText,
});
export type OrderItemForm = z.input<typeof orderItemFormSchema>;
export function orderItemFromForm(
  form: z.output<typeof orderItemFormSchema>,
): OrderItemValues {
  return { name: form.name, priceCopper: form.price, weight: form.weight };
}
export function orderItemFormValues(
  choice: Extract<StagedActionChoice, { actionId: 'special_order' }>,
): OrderItemForm {
  return {
    name: choice.name ?? '',
    price:
      choice.priceCopper === undefined
        ? ''
        : copperToGpInput(choice.priceCopper),
    weight: choice.weight === undefined ? '' : String(choice.weight),
  };
}
