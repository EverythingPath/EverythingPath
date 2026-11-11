'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '~/components/ui/button';
import { Form } from '~/components/ui/form';
import { gp } from '~/components/week-review/review-text';
import type {
  EconomyActionId,
  EconomyChoice,
  EconomyDetail,
} from './activity-economy-detail';
import {
  orderItemFormSchema,
  orderItemFormValues,
  orderItemFromForm,
  type EconomyFieldEdits,
} from './activity-economy-edits';
import {
  ActionButton,
  AvailabilityAnswer,
  ContentsSummary,
  ItemReferenceList,
  MissingReferenceNote,
  PurchaseList,
  TextFormField,
  anyMissing,
  type EconomyContext,
} from './activity-economy-parts';
import {
  CommonFields,
  Field,
  Muted,
  Note,
  OptionField,
  type FieldError,
} from './activity-detail-parts';
import { ActivityText } from './activity-text';
import { WholeNumberField } from './whole-number-field';

// The detail editor for the market, cache and Special Order actions: the
// action's own choices, purchases and item references, then the cost, dice
// rolls and consumables every action shares. Each control writes one named
// edit; the host renders the team, the check, the receipt and exceptions.

type MarketId = 'activate_black_market' | 'broker_market';
type Choice<Id extends EconomyActionId = EconomyActionId> = Extract<
  EconomyChoice,
  { actionId: Id }
>;
type Detail<Id extends EconomyActionId> = Extract<
  EconomyDetail,
  { actionId: Id }
>;
type Matched<Id extends EconomyActionId> = {
  actionId: Id;
  choice: Choice<Id>;
  detail: Detail<Id>;
};
// A choice paired with the detail facts of the same action, so one
// discriminant narrows both.
type EconomyFields<Id extends EconomyActionId = EconomyActionId> =
  Id extends unknown ? Matched<Id> : never;
type Fields<Id extends EconomyActionId> = EconomyFields<Id> & {
  context: EconomyContext;
  correctionsHref?: string;
};

function isMatchedAction(fields: {
  actionId: EconomyActionId;
  choice: Choice;
  detail: EconomyDetail;
}): fields is EconomyFields {
  return fields.choice.actionId === fields.detail.actionId;
}

function booleanValue(value: boolean | undefined) {
  return value === undefined ? null : String(value);
}

function SettlementField({
  label,
  choice,
  detail,
  context,
}: Pick<Fields<EconomyActionId>, 'choice' | 'detail' | 'context'> & {
  label: string;
}) {
  return (
    <OptionField
      context={context}
      field="settlementId"
      label={label}
      options={detail.settlements}
      value={choice.settlementId ?? null}
      otherLabel="Reputation not recorded"
    />
  );
}

function marketText(market: Detail<MarketId>['market']) {
  const activation = `Activation costs ${gp(market.activationCopper)}.`;
  const availability = market.availability
    ? ` ${market.availability} availability; items sell for ${market.salePercent}% of their value.`
    : ` Items sell for ${market.salePercent}% of their value.`;
  const contraband = market.contraband
    ? ' Availability rolls succeed up to 90%, and contraband can be sold.'
    : '';
  return `${activation}${availability}${contraband}`;
}

function MarketFields({
  choice,
  detail,
  context,
  correctionsHref,
}: Fields<MarketId>) {
  return (
    <>
      <SettlementField
        label="Market settlement"
        choice={choice}
        detail={detail}
        context={context}
      />
      <Muted>{marketText(detail.market)}</Muted>
      <PurchaseList
        purchases={detail.purchases}
        context={context}
        intro="Purchases are paid when the market opens and arrive at the next Activity."
      />
      <Field name="sales" context={context}>
        <ItemReferenceList
          list={detail.sales}
          heading="Sales"
          addLabel="Add item to sell"
          removeLabel={(label) => `Remove sale ${label}`}
          onAdd={(itemId) => context.edits.addSale(itemId)}
          onRemove={(itemId) => context.edits.removeSale(itemId)}
          context={context}
          correctionsHref={correctionsHref}
        />
      </Field>
      {anyMissing(detail.settlements, detail.sales) && (
        <MissingReferenceNote correctionsHref={correctionsHref} />
      )}
    </>
  );
}

function CacheItemsEmpty({
  selected,
  context,
}: {
  selected: unknown[] | null;
  context: EconomyContext;
}) {
  const { edits } = context;
  const unrecorded = selected === null;
  return (
    <div className="space-y-2">
      <Muted>{unrecorded ? 'Not recorded yet.' : 'No held items.'}</Muted>
      <ActionButton
        context={context}
        onClick={() =>
          unrecorded ? edits.recordNoCacheItems() : edits.clearCacheItems()
        }
      >
        {unrecorded ? 'No held items' : 'Clear held items'}
      </ActionButton>
    </div>
  );
}

function PlaceFields({
  choice,
  detail,
  context,
  correctionsHref,
}: Fields<'secure_cache'>) {
  const { edits } = context;
  const isPlacing = choice.mode === 'place';
  return (
    <div className="space-y-4">
      {!isPlacing && (
        <Note>
          {choice.mode === 'retrieve'
            ? 'Not used when retrieving; kept until you clear or replace them.'
            : 'Not used until you choose to place a cache; kept until you clear or replace them.'}
        </Note>
      )}
      {isPlacing && detail.cache !== 'new' && (
        <Field name="cacheId" context={context}>
          <div className="space-y-2">
            {detail.cache === 'existing' && (
              <Note>This cache already exists; placing makes a new cache.</Note>
            )}
            <ActionButton context={context} onClick={() => edits.useNewCache()}>
              {detail.cache === 'existing'
                ? 'Place a new cache'
                : 'Start a new cache'}
            </ActionButton>
          </div>
        </Field>
      )}
      <OptionField
        context={context}
        field="cacheClass"
        label="Cache class"
        options={detail.classes}
        value={choice.cacheClass ?? null}
        otherLabel="Needs a higher-tier team (Rules Exception)"
      />
      <Field name="location" context={context}>
        <ActivityText
          name="Cache location"
          value={choice.location ?? ''}
          disabled={context.disabled}
          onValue={(text) => edits.set('location', text.trim() || undefined)}
        />
      </Field>
      <OptionField
        context={context}
        field="secure"
        label="Location"
        options={detail.secure}
        value={booleanValue(choice.secure)}
        otherLabel="Needs a tier 3 team (Rules Exception)"
        onSelect={(next) => edits.setBoolean('secure', next)}
        onClear={() => edits.clear('secure')}
      />
      <OptionField
        context={context}
        field="extradimensional"
        label="Space"
        options={detail.extradimensional}
        value={booleanValue(choice.extradimensional)}
        otherLabel="Other"
        onSelect={(next) => edits.setBoolean('extradimensional', next)}
        onClear={() => edits.clear('extradimensional')}
      />
      <Field name="itemIds" context={context}>
        <ItemReferenceList
          list={detail.items}
          heading="Held items to place"
          addLabel="Add a held item"
          removeLabel={(label) => `Remove ${label} from the cache`}
          onAdd={(itemId) => edits.addCacheItem(itemId)}
          onRemove={(itemId) => edits.removeCacheItem(itemId)}
          context={context}
          correctionsHref={correctionsHref}
          empty={
            <CacheItemsEmpty
              selected={detail.items.selected}
              context={context}
            />
          }
        />
      </Field>
      <PurchaseList
        purchases={detail.purchases}
        context={context}
        intro="Items bought now go straight into the cache."
      />
      <SettlementField
        label="Purchase settlement"
        choice={choice}
        detail={detail}
        context={context}
      />
      <ContentsSummary contents={detail.contents} />
    </div>
  );
}

function CacheFields(fields: Fields<'secure_cache'>) {
  const { choice, detail, context, correctionsHref } = fields;
  const { edits } = context;
  // Without a mode, a recorded cache to retrieve stays visible.
  const isRetrieving =
    choice.mode === 'retrieve' ||
    (choice.mode === undefined &&
      (detail.cache === 'existing' || detail.cache === 'missing'));
  return (
    <>
      <OptionField
        context={context}
        field="mode"
        label="Cache action"
        options={detail.modes}
        value={choice.mode ?? null}
        otherLabel="Other"
        onSelect={(next) =>
          // Safe cast: the options are detail.modes, which are cache modes.
          edits.setCacheMode(next as 'place' | 'retrieve', detail.cache)
        }
        onClear={() => edits.clear('mode')}
      />
      {isRetrieving && (
        <OptionField
          context={context}
          field="cacheId"
          label="Cache to retrieve"
          options={detail.caches}
          value={choice.cacheId ?? null}
          otherLabel="Not hidden now"
        />
      )}
      {isRetrieving && detail.retrievedItems && (
        <Muted>
          {detail.retrievedItems.length > 0
            ? `Holds: ${detail.retrievedItems.join(', ')}.`
            : 'Holds no items.'}
        </Muted>
      )}
      {(choice.mode === 'place' || detail.retainedPlace) && (
        <PlaceFields {...fields} />
      )}
      {anyMissing(detail.caches, detail.settlements, detail.items) && (
        <MissingReferenceNote correctionsHref={correctionsHref} />
      )}
    </>
  );
}

// The ordered item's name, weight and price, or an enchantment's cost.
function OrderItemForm({ choice, detail, context }: Fields<'special_order'>) {
  const isEnchanting = choice.mode === 'enchantment';
  const form = useForm({
    values: orderItemFormValues(choice),
    mode: 'onBlur',
    resolver: zodResolver(orderItemFormSchema),
  });
  const input = { disabled: context.disabled };
  const showsItem = !isEnchanting || detail.retainedItem;
  return (
    <Field name="name" context={context}>
      <Form {...form}>
        <form
          noValidate
          aria-label="Ordered item"
          className="space-y-2"
          onSubmit={form.handleSubmit((values) => {
            context.edits.saveOrderItem(orderItemFromForm(values));
          })}
        >
          {isEnchanting && detail.retainedItem && (
            <Note>
              The name and weight are not used by an enchantment; kept until you
              clear them.
            </Note>
          )}
          <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,7rem)_minmax(0,8rem)]">
            {showsItem && (
              <>
                <TextFormField {...input} name="name" label="Item name" />
                <TextFormField
                  {...input}
                  name="weight"
                  label="Weight (lb)"
                  decimal
                />
              </>
            )}
            <TextFormField
              {...input}
              name="price"
              label={isEnchanting ? 'Enchantment cost (gp)' : 'Item price (gp)'}
              decimal
            />
          </div>
          <Button type="submit" variant="outline" disabled={context.disabled}>
            Save ordered item
          </Button>
        </form>
      </Form>
    </Field>
  );
}

function OrderFields(fields: Fields<'special_order'>) {
  const { choice, detail, context, correctionsHref } = fields;
  const { edits } = context;
  const isPurchasing = choice.mode === 'purchase';
  // The availability answer is named for the enchanted item or the order.
  const itemName =
    (choice.mode === 'enchantment'
      ? detail.enchantItems.find((option) => option.value === choice.itemId)
          ?.label
      : choice.name) ?? 'the ordered item';
  return (
    <>
      {!detail.hasOrder && (
        <Field name="orderId" context={context}>
          <div className="space-y-2">
            <Note>This Special Order has no order yet.</Note>
            <ActionButton context={context} onClick={() => edits.startOrder()}>
              Start the order
            </ActionButton>
          </div>
        </Field>
      )}
      <OptionField
        context={context}
        field="mode"
        label="Order"
        options={detail.modes}
        value={choice.mode ?? null}
        otherLabel="Other"
        onSelect={(next) =>
          // Safe cast: the options are detail.modes, which are order modes.
          edits.setOrderMode(next as 'purchase' | 'enchantment', detail.item)
        }
        onClear={() => edits.clear('mode')}
      />
      {isPurchasing && detail.item !== 'new' && (
        <Field name="itemId" context={context}>
          <div className="space-y-2">
            {detail.item === 'existing' && (
              <Note>
                {detail.existingItem} is already one of the militia’s items; an
                order buys a new one.
              </Note>
            )}
            <ActionButton
              context={context}
              onClick={() => edits.useNewOrderItem()}
            >
              Order a new item
            </ActionButton>
          </div>
        </Field>
      )}
      {(choice.mode === 'enchantment' ||
        (choice.mode === undefined &&
          (detail.item === 'existing' || detail.item === 'missing'))) && (
        <OptionField
          context={context}
          field="itemId"
          label="Item to enchant"
          options={detail.enchantItems}
          value={choice.itemId ?? null}
          otherLabel="Not held now"
          onSelect={(next) => edits.setOrderItem(next)}
          onClear={() => edits.setOrderItem(null)}
        />
      )}
      <OrderItemForm {...fields} />
      <SettlementField
        label="Order settlement"
        choice={choice}
        detail={detail}
        context={context}
      />
      <OptionField
        context={context}
        field="expedited"
        label="Delivery"
        options={detail.deliveries}
        value={booleanValue(choice.expedited)}
        otherLabel="Other"
        onSelect={(next) => edits.setBoolean('expedited', next)}
        onClear={() => edits.clear('expedited')}
      />
      <Field name="orderedDay" context={context}>
        <WholeNumberField
          label="Ordered on day"
          value={choice.orderedDay ?? null}
          disabled={context.disabled}
          onValue={(next) => edits.set('orderedDay', next ?? undefined)}
          description={`This Activity starts on day ${detail.startDay}.`}
        />
      </Field>
      {detail.availability && (
        <AvailabilityAnswer
          availability={detail.availability}
          name={itemName}
          context={context}
        />
      )}
      {anyMissing(detail.settlements, detail.enchantItems) && (
        <MissingReferenceNote correctionsHref={correctionsHref} />
      )}
    </>
  );
}

function Specific({
  choice,
  detail,
  context,
  correctionsHref,
}: {
  choice: Choice;
  detail: EconomyDetail;
  context: EconomyContext;
  correctionsHref?: string;
}) {
  const fields = { actionId: detail.actionId, choice, detail };
  if (!isMatchedAction(fields)) return null;
  const props = { context, correctionsHref };
  switch (fields.actionId) {
    case 'activate_black_market':
    case 'broker_market':
      return <MarketFields {...fields} {...props} />;
    case 'secure_cache':
      return <CacheFields {...fields} {...props} />;
    case 'special_order':
      return <OrderFields {...fields} {...props} />;
  }
}

export function ActivityEconomyFields({
  choice,
  detail,
  calculatedCostCopper,
  disabled,
  edits,
  fieldError,
  correctionsHref,
}: {
  choice: EconomyChoice;
  detail: EconomyDetail;
  calculatedCostCopper: number | null;
  disabled: boolean;
  edits: EconomyFieldEdits;
  // A structural save failure for one choice field, shown under its control.
  fieldError: FieldError;
  // Where a missing item, cache or settlement is restored.
  correctionsHref?: string;
}) {
  const context: EconomyContext = { edits, disabled, fieldError };
  return (
    <div className="min-w-0 space-y-4">
      <Specific
        choice={choice}
        detail={detail}
        context={context}
        correctionsHref={correctionsHref}
      />
      <CommonFields
        choice={choice}
        detail={detail}
        calculatedCostCopper={calculatedCostCopper}
        context={context}
      />
    </div>
  );
}
