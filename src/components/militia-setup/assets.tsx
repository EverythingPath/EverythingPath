import { useFieldArray, useFormContext } from 'react-hook-form';
import { Button } from '~/components/ui/button';
import type { SetupCharacter } from './roster';
import type { MilitiaSetup } from '~/lib/canonical-setup';
import {
  SETUP_ASSET_SUBSECTIONS,
  type SetupAssetSubsection,
} from '~/lib/setup-sections';
import {
  SetupField as Field,
  SetupEntry,
  SetupSection,
  choices,
  useSettlementOptions,
  yesNo,
} from './fields';

// The Assets step. Correction callers may choose which lists to show.
export function SetupAssets({
  characters,
  subsections = SETUP_ASSET_SUBSECTIONS,
}: {
  characters: SetupCharacter[];
  subsections?: readonly SetupAssetSubsection[];
}) {
  const show = (subsection: SetupAssetSubsection) =>
    subsections.includes(subsection);
  return (
    <>
      {show('items') ? <SetupItems characters={characters} /> : null}
      {show('caches') ? <SetupCaches /> : null}
      {show('orders') ? <SetupOrders /> : null}
      {show('marketplaces') ? <SetupMarketplaces /> : null}
    </>
  );
}
export function SetupItems({
  characters,
  rowNotes,
}: {
  characters: SetupCharacter[];
  /** A note under an item's title, by its identity. */
  rowNotes?: ReadonlyMap<string, string>;
}) {
  const { control, watch } = useFormContext<MilitiaSetup>();
  const items = useFieldArray({
    control,
    name: 'state.militiaSnapshot.economy.items',
  });
  const values = watch();
  return (
    <SetupSection
      title="Items"
      add="Add item"
      onAdd={() =>
        items.append({
          itemId: crypto.randomUUID(),
          name: '',
          valueCopper: 0,
          weight: 0,
          location: 'held',
        })
      }
    >
      {items.fields.map((row, i) => (
        <SetupEntry
          key={row.id}
          label={`Item ${i + 1}`}
          note={rowNotes?.get(row.itemId)}
          onRemove={() => items.remove(i)}
        >
          <Field
            name={`state.militiaSnapshot.economy.items.${i}.name`}
            label="Item name"
          />
          <Field
            name={`state.militiaSnapshot.economy.items.${i}.valueCopper`}
            label="Item value (copper)"
            numeric
          />
          <Field
            name={`state.militiaSnapshot.economy.items.${i}.ownerCharacterId`}
            label="Item owner (optional)"
            options={[
              { value: undefined, label: 'Militia' },
              ...characters
                .filter((character) =>
                  values.state.militiaSnapshot.characters.some(
                    (x) => x.characterId === character.characterId,
                  ),
                )
                .map((character) => ({
                  value: character.characterId,
                  label: character.name,
                })),
            ]}
          />
          <Field
            name={`state.militiaSnapshot.economy.items.${i}.identified`}
            label="Item identified"
            options={[{ value: undefined, label: 'Unknown' }, ...yesNo]}
          />
          <Field
            name={`state.militiaSnapshot.economy.items.${i}.weight`}
            label="Item weight"
            numeric
            decimal
          />
          <Field
            name={`state.militiaSnapshot.economy.items.${i}.location`}
            label="Item location"
            options={choices([
              'held',
              'cache',
              'order',
              'returning',
              'enchanting',
              'sold',
              'lost',
            ])}
          />
        </SetupEntry>
      ))}
    </SetupSection>
  );
}
export function SetupCaches({
  rowNotes,
}: {
  /** A note under a cache's title, by its identity. */
  rowNotes?: ReadonlyMap<string, string>;
} = {}) {
  const { control, watch, setValue } = useFormContext<MilitiaSetup>();
  const caches = useFieldArray({
    control,
    name: 'state.militiaSnapshot.economy.caches',
  });
  const economy = watch('state.militiaSnapshot.economy');
  return (
    <SetupSection
      title="Caches"
      add="Add cache"
      onAdd={() =>
        caches.append({
          cacheId: crypto.randomUUID(),
          cacheClass: 'minor',
          location: '',
          secure: false,
          extradimensional: false,
          itemIds: [],
          status: 'hidden',
          returnActivityWeek: null,
        })
      }
    >
      {caches.fields.map((row, i) => (
        <SetupEntry
          key={row.id}
          label={`Cache ${i + 1}`}
          note={rowNotes?.get(row.cacheId)}
          onRemove={() => caches.remove(i)}
        >
          <Field
            name={`state.militiaSnapshot.economy.caches.${i}.location`}
            label="Cache location"
          />
          <Field
            name={`state.militiaSnapshot.economy.caches.${i}.cacheClass`}
            label="Cache class"
            options={choices(['minor', 'intermediate', 'major'])}
          />
          <Field
            name={`state.militiaSnapshot.economy.caches.${i}.status`}
            label="Cache status"
            options={choices(['hidden', 'retrieved', 'returning', 'lost'])}
          />
          <Field
            name={`state.militiaSnapshot.economy.caches.${i}.secure`}
            label="Secure location"
            options={yesNo}
          />
          <Field
            name={`state.militiaSnapshot.economy.caches.${i}.extradimensional`}
            label="Extradimensional"
            options={yesNo}
          />
          <Field
            name={`state.militiaSnapshot.economy.caches.${i}.returnActivityWeek`}
            label="Return Activity week (optional)"
            numeric
          />
          <div className="space-y-2">
            <p className="text-sm font-medium">Cache contents</p>
            <div className="flex flex-wrap gap-2">
              {economy?.items.map((item) => {
                const current = economy.caches[i]?.itemIds ?? [];
                const selected = current.includes(item.itemId);
                return (
                  <Button
                    key={item.itemId}
                    type="button"
                    variant={selected ? 'default' : 'outline'}
                    aria-pressed={selected}
                    onClick={() =>
                      setValue(
                        `state.militiaSnapshot.economy.caches.${i}.itemIds`,
                        selected
                          ? current.filter((id) => id !== item.itemId)
                          : [...current, item.itemId],
                      )
                    }
                  >
                    {item.name || 'Unnamed item'}
                  </Button>
                );
              })}
            </div>
          </div>
        </SetupEntry>
      ))}
    </SetupSection>
  );
}
export function SetupOrders() {
  const { control, watch, setValue } = useFormContext<MilitiaSetup>();
  const orders = useFieldArray({
    control,
    name: 'state.militiaSnapshot.economy.orders',
  });
  const values = watch();
  const economy = values.state.militiaSnapshot.economy;
  const settlements = useSettlementOptions();
  return (
    <SetupSection
      title="Orders"
      add="Add order"
      onAdd={() =>
        orders.append({
          orderId: crypto.randomUUID(),
          itemId: '',
          settlementId: '',
          source: 'special_order',
          mode: 'purchase',
          orderedWeek: values.state.week,
          orderedDay: values.state.context.startDay,
          dueDay: null,
          dueActivityWeek: null,
          priceCopper: 0,
          deliveryDays: null,
          enchantmentValueCopper: 0,
          receipt: null,
        })
      }
    >
      {orders.fields.map((row, i) => (
        <SetupEntry
          key={row.id}
          label={`Order ${i + 1}`}
          onRemove={() => orders.remove(i)}
        >
          <Field
            name={`state.militiaSnapshot.economy.orders.${i}.itemId`}
            label="Ordered item"
            options={
              economy?.items.map((item) => ({
                value: item.itemId,
                label: item.name || 'Unnamed item',
              })) ?? []
            }
          />
          <Field
            name={`state.militiaSnapshot.economy.orders.${i}.settlementId`}
            label="Delivery settlement"
            options={settlements}
          />
          <Field
            name={`state.militiaSnapshot.economy.orders.${i}.source`}
            label="Order source"
            options={choices([
              'special_order',
              'broker_market',
              'activate_black_market',
            ])}
          />
          <Field
            name={`state.militiaSnapshot.economy.orders.${i}.mode`}
            label="Order kind"
            options={choices(['purchase', 'enchantment'])}
          />
          <Field
            name={`state.militiaSnapshot.economy.orders.${i}.orderedWeek`}
            label="Ordered week"
            numeric
          />
          <Field
            name={`state.militiaSnapshot.economy.orders.${i}.orderedDay`}
            label="Ordered day"
            numeric
          />
          <Field
            name={`state.militiaSnapshot.economy.orders.${i}.dueDay`}
            label="Due day (day delivery)"
            numeric
            decimal
          />
          <Field
            name={`state.militiaSnapshot.economy.orders.${i}.dueActivityWeek`}
            label="Due Activity week (market delivery)"
            numeric
          />
          <Field
            name={`state.militiaSnapshot.economy.orders.${i}.priceCopper`}
            label="Price paid (copper)"
            numeric
          />
          <Field
            name={`state.militiaSnapshot.economy.orders.${i}.deliveryDays`}
            label="Delivery duration (days)"
            numeric
            decimal
          />
          <Field
            name={`state.militiaSnapshot.economy.orders.${i}.enchantmentValueCopper`}
            label="Enchantment value (copper)"
            numeric
          />
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              aria-pressed={Boolean(economy?.orders[i]?.receipt)}
              onClick={() =>
                setValue(
                  `state.militiaSnapshot.economy.orders.${i}.receipt`,
                  economy?.orders[i]?.receipt
                    ? null
                    : {
                        receivedDay: values.state.context.startDay,
                        acknowledgementId: crypto.randomUUID(),
                      },
                )
              }
            >
              {economy?.orders[i]?.receipt
                ? 'Mark unreceived'
                : 'Record receipt'}
            </Button>
            {economy?.orders[i]?.receipt && (
              <Field
                name={`state.militiaSnapshot.economy.orders.${i}.receipt.receivedDay`}
                label="Received day"
                numeric
              />
            )}
          </div>
        </SetupEntry>
      ))}
    </SetupSection>
  );
}
export function SetupMarketplaces() {
  const { control, watch } = useFormContext<MilitiaSetup>();
  const markets = useFieldArray({
    control,
    name: 'state.militiaSnapshot.economy.markets',
  });
  const week = watch('state.week');
  const settlements = useSettlementOptions();
  return (
    <SetupSection
      title="Marketplaces"
      add="Add marketplace"
      onAdd={() =>
        markets.append({
          marketId: crypto.randomUUID(),
          source: 'broker_market',
          settlementId: '',
          availableWeek: week,
          expiresWeek: week,
          availability: null,
          availabilityPercent: null,
          salePercent: null,
          contraband: false,
        })
      }
    >
      {markets.fields.map((row, i) => (
        <SetupEntry
          key={row.id}
          label={`Marketplace ${i + 1}`}
          onRemove={() => markets.remove(i)}
        >
          <Field
            name={`state.militiaSnapshot.economy.markets.${i}.source`}
            label="Market source"
            options={choices([
              'activate_black_market',
              'broker_market',
              'market_day',
            ])}
          />
          <Field
            name={`state.militiaSnapshot.economy.markets.${i}.settlementId`}
            label="Market settlement"
            options={settlements}
          />
          <Field
            name={`state.militiaSnapshot.economy.markets.${i}.availableWeek`}
            label="Available week"
            numeric
          />
          <Field
            name={`state.militiaSnapshot.economy.markets.${i}.expiresWeek`}
            label="Expires week"
            numeric
          />
          <Field
            name={`state.militiaSnapshot.economy.markets.${i}.availability`}
            label="Availability"
            options={[
              { value: null, label: 'Not applicable' },
              ...choices(['small_town', 'small_city']),
            ]}
          />
          <Field
            name={`state.militiaSnapshot.economy.markets.${i}.availabilityPercent`}
            label="Availability percent (optional)"
            numeric
          />
          <Field
            name={`state.militiaSnapshot.economy.markets.${i}.salePercent`}
            label="Sale percent (optional)"
            numeric
          />
          <Field
            name={`state.militiaSnapshot.economy.markets.${i}.contraband`}
            label="Contraband allowed"
            options={yesNo}
          />
        </SetupEntry>
      ))}
    </SetupSection>
  );
}
