import { gp } from '~/components/week-review/review-text';
import {
  cacheLimits,
  enchantmentCopperPerDay,
  expeditedDelivery,
  marketTerms,
  secureCache,
} from '~/lib/rules-economy';
import type { EconomyState } from '~/lib/rules-economy-state';
import { declaredChoiceEntities } from '~/lib/weekly-draft-identities';
import type { StagedActionChoice } from '~/lib/weekly-draft-facts';
import {
  consumables,
  detailRolls,
  option,
  ordered,
  withMissing,
  type DetailCommon,
  type DetailOption,
  type DetailRollField,
} from './activity-action-detail';
import { activityLabel } from './activity-labels';
import type { ActivityView } from './types';

// Presentation facts for the market, cache and Special Order detail editors.
// Items and caches come from the militia's economy as the ordered Activity
// sees it at this slot (and from earlier slots' staged purchases and caches);
// groups guide the table and never filter. A recorded item or cache that
// nothing here knows stays listed as missing.

type Slot = ActivityView['slots'][number];
type Choice<Id extends StagedActionChoice['actionId']> = Extract<
  StagedActionChoice,
  { actionId: Id }
>;
export const ECONOMY_ACTIONS = [
  'activate_black_market',
  'broker_market',
  'secure_cache',
  'special_order',
] as const satisfies readonly StagedActionChoice['actionId'][];
export type EconomyActionId = (typeof ECONOMY_ACTIONS)[number];
export type EconomyChoice = Choice<EconomyActionId>;
export function isEconomyChoice(
  choice: StagedActionChoice,
): choice is EconomyChoice {
  const actions: readonly string[] = ECONOMY_ACTIONS;
  return actions.includes(choice.actionId);
}

// A recorded list of item references. `selected` is null while the list is
// not recorded; an empty list records that there are none.
export type DetailReferenceList = {
  selected: DetailOption[] | null;
  // What can be added, eligible first; never an item already selected.
  available: DetailOption[];
};
// The table's answer to whether a purchased or ordered item is available.
export type AvailabilityFact = {
  itemId: string;
  outcome: string | null;
  // The rules wait for it before the purchase is made.
  required: boolean;
};
export type PurchaseFact = {
  itemId: string;
  name: string | null;
  priceCopper: number;
  weight: number | null;
  // A name or weight is still missing.
  incomplete: boolean;
  // The item already exists, so this purchase cannot create it.
  duplicate: boolean;
  availability: AvailabilityFact;
};
// A recorded item or cache identity: one this choice creates, one the
// militia or an earlier slot already has, a reference to one nothing here
// has, or none.
export type IdentityState = 'new' | 'existing' | 'missing' | 'none';
export type CacheContents = {
  weight: number;
  valueCopper: number;
  // Recorded items whose weight or value is unknown here.
  unknown: number;
  // The chosen class's limits; null weight or value means no limit.
  limit: { weight: number | null; valueCopper: number | null } | null;
};
type MarketFacts = {
  settlements: DetailOption[];
  market: {
    // Null until the acting team is known.
    availability: string | null;
    salePercent: number;
    contraband: boolean;
    activationCopper: number;
  };
  // Null while the purchases are not recorded.
  purchases: PurchaseFact[] | null;
  sales: DetailReferenceList;
};
type Specific =
  | ({ actionId: 'activate_black_market' } & MarketFacts)
  | ({ actionId: 'broker_market' } & MarketFacts)
  | {
      actionId: 'secure_cache';
      modes: DetailOption[];
      // Retrieve: the caches at this slot, hidden ones first.
      caches: DetailOption[];
      // The chosen cache's item names while retrieving a known cache.
      retrievedItems: string[] | null;
      // The recorded cache identity.
      cache: IdentityState;
      classes: DetailOption[];
      secure: DetailOption[];
      extradimensional: DetailOption[];
      items: DetailReferenceList;
      purchases: PurchaseFact[] | null;
      settlements: DetailOption[];
      contents: CacheContents;
      // Placing values are recorded while not placing; kept until cleared.
      retainedPlace: boolean;
    }
  | {
      actionId: 'special_order';
      modes: DetailOption[];
      // The recorded item identity.
      item: IdentityState;
      // The existing item's name, which a purchase would duplicate.
      existingItem: string | null;
      // Enchantment: the items at this slot, held ones first.
      enchantItems: DetailOption[];
      settlements: DetailOption[];
      deliveries: DetailOption[];
      availability: AvailabilityFact | null;
      // The order identity the receipt and delivery belong to.
      hasOrder: boolean;
      startDay: number;
      // A name or weight is recorded while enchanting; kept until cleared.
      retainedItem: boolean;
    };
export type EconomyDetail = DetailCommon & Specific;

type ItemFact = {
  itemId: string;
  label: string;
  location: EconomyState['items'][number]['location'] | null;
  owner: string | null;
  weight: number | null;
  valueCopper: number | null;
  // Staged by the choice in this earlier Action Slot.
  stagedIn: number | null;
};
type CacheFact = {
  cacheId: string;
  label: string;
  status: EconomyState['caches'][number]['status'] | null;
  cacheClass: EconomyState['caches'][number]['cacheClass'] | null;
  secure: boolean;
  itemIds: string[];
  stagedIn: number | null;
};

const LOCATIONS: Record<NonNullable<ItemFact['location']>, string> = {
  held: 'Held',
  cache: 'In a cache',
  order: 'On order',
  returning: 'Returning from a cache',
  enchanting: 'Being enchanted',
  sold: 'Sold',
  lost: 'Lost',
};
const AVAILABILITY = { small_town: 'Small town', small_city: 'Small city' };
const CACHE_STATUS: Record<NonNullable<CacheFact['status']>, string> = {
  hidden: 'Hidden',
  retrieved: 'Retrieved',
  returning: 'Returning',
  lost: 'Lost',
};

function pounds(weight: number) {
  return `${weight} lb`;
}

function declaredBefore(view: ActivityView, slot: Slot) {
  return view.slots.flatMap((entry) =>
    entry.choice && entry.number < slot.number
      ? [{ choice: entry.choice, number: entry.number }]
      : [],
  );
}
// Items and caches declared by this slot or a later one are not offered here:
// the rules take choices in slot order, so they do not exist yet.
function declaredFromHere(view: ActivityView, slot: Slot) {
  const items = new Set<string>();
  const caches = new Set<string>();
  for (const entry of view.slots)
    if (entry.choice && entry.number >= slot.number) {
      const declared = declaredChoiceEntities(entry.choice);
      declared.item.forEach((id) => items.add(id));
      declared.cache.forEach((id) => caches.add(id));
    }
  return { items, caches };
}

function stagedItemName(choice: StagedActionChoice, itemId: string) {
  if ('purchases' in choice) {
    const name = choice.purchases?.find(
      (entry) => entry.itemId === itemId,
    )?.name;
    if (name) return name;
  }
  if (choice.actionId === 'special_order' && choice.name) return choice.name;
  return null;
}

function itemFacts(view: ActivityView, slot: Slot): ItemFact[] {
  const economy = slot.position?.economy;
  const owner = (characterId: string | undefined) =>
    characterId
      ? (view.characters.find((entry) => entry.characterId === characterId)
          ?.name ?? null)
      : null;
  const later = declaredFromHere(view, slot).items;
  const base: ItemFact[] = economy
    ? economy.items.map((item) => ({
        itemId: item.itemId,
        label: item.name,
        location: item.location,
        owner: owner(item.ownerCharacterId),
        weight: item.weight,
        valueCopper: item.valueCopper,
        stagedIn: null,
      }))
    : view.items
        .filter((item) => !later.has(item.value))
        .map((item) => ({
          itemId: item.value,
          label: item.label,
          location: null,
          owner: null,
          weight: null,
          valueCopper: null,
          stagedIn: null,
        }));
  const known = new Set(base.map((item) => item.itemId));
  const staged = declaredBefore(view, slot).flatMap(({ choice, number }) =>
    declaredChoiceEntities(choice)
      .item.filter((itemId) => !known.has(itemId))
      .map<ItemFact>((itemId) => ({
        itemId,
        label:
          stagedItemName(choice, itemId) ??
          `${activityLabel(choice.actionId)} item`,
        location: null,
        owner: null,
        weight: null,
        valueCopper: null,
        stagedIn: number,
      })),
  );
  return [...base, ...staged];
}

function cacheFacts(view: ActivityView, slot: Slot): CacheFact[] {
  const economy = slot.position?.economy;
  const later = declaredFromHere(view, slot).caches;
  const base: CacheFact[] = economy
    ? economy.caches.map((cache) => ({
        cacheId: cache.cacheId,
        label: cache.location,
        status: cache.status,
        cacheClass: cache.cacheClass,
        secure: cache.secure,
        itemIds: cache.itemIds,
        stagedIn: null,
      }))
    : view.caches
        .filter((cache) => !later.has(cache.value))
        .map((cache) => ({
          cacheId: cache.value,
          label: cache.label,
          status: null,
          cacheClass: null,
          secure: false,
          itemIds: [],
          stagedIn: null,
        }));
  const known = new Set(base.map((cache) => cache.cacheId));
  const staged = declaredBefore(view, slot).flatMap(({ choice, number }) =>
    declaredChoiceEntities(choice)
      .cache.filter((cacheId) => !known.has(cacheId))
      .map<CacheFact>((cacheId) => ({
        cacheId,
        label:
          choice.actionId === 'secure_cache' && choice.location
            ? choice.location
            : 'Staged cache',
        status: null,
        cacheClass:
          choice.actionId === 'secure_cache'
            ? (choice.cacheClass ?? null)
            : null,
        secure: choice.actionId === 'secure_cache' && choice.secure === true,
        itemIds: [],
        stagedIn: number,
      })),
  );
  return [...base, ...staged];
}

function itemDescription(item: ItemFact) {
  if (item.stagedIn !== null) return `Staged in Action Slot ${item.stagedIn}`;
  return (
    [
      item.location ? LOCATIONS[item.location] : null,
      item.owner ? `Owned by ${item.owner}` : null,
      item.valueCopper !== null ? gp(item.valueCopper) : null,
      item.weight !== null ? pounds(item.weight) : null,
    ]
      .filter(Boolean)
      .join(' · ') || null
  );
}
function itemOption(item: ItemFact) {
  // Without the rules preview every known item stays in one group.
  return option(
    item.itemId,
    item.label,
    itemDescription(item),
    item.location === null ? item.stagedIn === null : item.location === 'held',
  );
}
const MISSING_ITEM = {
  label: 'Missing item',
  description: 'No longer one of the militia’s items',
};
function missingItem(itemId: string): DetailOption {
  return { value: itemId, ...MISSING_ITEM, eligible: false, missing: true };
}

// A recorded list of item references and what can be added to it.
function referenceList(
  items: ItemFact[],
  recorded: string[] | undefined,
  exclude: ReadonlySet<string>,
): DetailReferenceList {
  const selected = recorded?.map((itemId) => {
    const item = items.find((entry) => entry.itemId === itemId);
    return item ? itemOption(item) : missingItem(itemId);
  });
  return {
    selected: selected ?? null,
    available: ordered(
      items
        .filter(
          (item) =>
            !exclude.has(item.itemId) && !recorded?.includes(item.itemId),
        )
        .map(itemOption),
    ),
  };
}

function availability(
  choice: EconomyChoice,
  slot: Slot,
  itemId: string,
): AvailabilityFact {
  const subjectId = `availability:${itemId}`;
  return {
    itemId,
    outcome:
      choice.acknowledgements?.find((entry) => entry.subjectId === subjectId)
        ?.outcome ?? null,
    required: slot.requirements.includes(
      `${choice.choiceId}:acknowledgement:${subjectId}`,
    ),
  };
}

function purchaseFacts(
  choice: EconomyChoice,
  slot: Slot,
  items: ItemFact[],
): PurchaseFact[] | null {
  if (!('purchases' in choice) || !choice.purchases) return null;
  return choice.purchases.map((purchase) => ({
    itemId: purchase.itemId,
    name: purchase.name ?? null,
    priceCopper: purchase.priceCopper,
    weight: purchase.weight ?? null,
    incomplete: purchase.name === undefined || purchase.weight === undefined,
    duplicate:
      slot.requirements.includes(
        `${choice.choiceId}:duplicate-item:${purchase.itemId}`,
      ) || items.some((item) => item.itemId === purchase.itemId),
    availability: availability(choice, slot, purchase.itemId),
  }));
}

function settlementOptions(view: ActivityView, recorded: string | undefined) {
  return withMissing(
    ordered(
      view.settlements.map((settlement) => {
        const reputation =
          view.operating.choices.find(
            (entry) => entry.value === settlement.value,
          )?.reputation ?? null;
        return option(
          settlement.value,
          settlement.label,
          reputation ?? 'Reputation not recorded',
          reputation !== null,
        );
      }),
    ),
    recorded,
    'Missing settlement',
    'No longer one of the campaign’s settlements',
  );
}

// Whether `recorded` is unset, known here, created by this choice, or a
// reference to something nothing here has.
function identityState(
  recorded: string | undefined,
  isKnown: boolean,
  isCreated: boolean,
): IdentityState {
  if (!recorded) return 'none';
  if (isKnown) return 'existing';
  return isCreated ? 'new' : 'missing';
}

function teamTier(view: ActivityView, choice: EconomyChoice) {
  const team = view.teamRoster.find((entry) => entry.teamId === choice.teamId);
  return team ? { tier: team.tier, teamType: team.teamType } : null;
}

// Two option cards for a yes/no field.
function yesNo(
  yes: [label: string, description: string | null, eligible?: boolean],
  no: [label: string, description: string | null],
): DetailOption[] {
  return [
    option('true', yes[0], yes[1], yes[2] ?? true),
    option('false', no[0], no[1]),
  ];
}

type Build<Id extends EconomyActionId> = (
  choice: Choice<Id>,
  slot: Slot,
  view: ActivityView,
) => Extract<Specific, { actionId: Id }>;

const marketDetail: Build<'activate_black_market' | 'broker_market'> = (
  choice,
  slot,
  view,
) => {
  const items = itemFacts(view, slot);
  const teamType = teamTier(view, choice)?.teamType ?? null;
  const terms = marketTerms(choice.actionId, teamType ?? '');
  const own = new Set((choice.purchases ?? []).map((entry) => entry.itemId));
  return {
    actionId: choice.actionId,
    settlements: settlementOptions(view, choice.settlementId),
    market: {
      availability: teamType ? AVAILABILITY[terms.availability] : null,
      salePercent: terms.salePercent,
      contraband: terms.contraband,
      activationCopper: terms.costCopper,
    },
    purchases: purchaseFacts(choice, slot, items),
    sales: referenceList(items, choice.sales, own),
  };
};

function limitsText(cacheClass: keyof typeof cacheLimits) {
  const limits = cacheLimits[cacheClass];
  const value = limits.value === Infinity ? 'any value' : gp(limits.value);
  return `Up to ${pounds(limits.weight)} and ${value} · DC ${limits.dc} · Tier ${limits.tier}+ team`;
}

function cacheContents(
  choice: Choice<'secure_cache'>,
  items: ItemFact[],
): CacheContents {
  let weight = 0;
  let valueCopper = 0;
  let unknown = 0;
  for (const itemId of choice.itemIds ?? []) {
    const item = items.find((entry) => entry.itemId === itemId);
    if (item?.weight == null || item.valueCopper === null) unknown += 1;
    else {
      weight += item.weight;
      valueCopper += item.valueCopper;
    }
  }
  for (const purchase of choice.purchases ?? []) {
    valueCopper += purchase.priceCopper;
    if (purchase.weight === undefined) unknown += 1;
    else weight += purchase.weight;
  }
  const limits = choice.cacheClass ? cacheLimits[choice.cacheClass] : null;
  return {
    weight,
    valueCopper,
    unknown,
    limit: limits
      ? {
          weight:
            choice.cacheClass === 'major' && choice.extradimensional
              ? null
              : limits.weight,
          valueCopper: limits.value === Infinity ? null : limits.value,
        }
      : null,
  };
}

const cacheDetail: Build<'secure_cache'> = (choice, slot, view) => {
  const items = itemFacts(view, slot);
  const caches = cacheFacts(view, slot);
  const tier = teamTier(view, choice)?.tier ?? null;
  const known = caches.find((cache) => cache.cacheId === choice.cacheId);
  const own = new Set((choice.purchases ?? []).map((entry) => entry.itemId));
  const describeCache = (cache: CacheFact) =>
    cache.stagedIn !== null
      ? `Placed in Action Slot ${cache.stagedIn}`
      : [
          cache.cacheClass ? `${activityLabel(cache.cacheClass)} cache` : null,
          cache.status ? CACHE_STATUS[cache.status] : null,
          cache.secure ? 'Secure' : null,
          cache.itemIds.length
            ? `${cache.itemIds.length} item${cache.itemIds.length === 1 ? '' : 's'}`
            : null,
        ]
          .filter(Boolean)
          .join(' · ') || null;
  return {
    actionId: choice.actionId,
    modes: [
      option('place', 'Place a cache', 'Hide held or newly bought items'),
      option(
        'retrieve',
        'Retrieve a cache',
        'Bring a hidden cache’s items back',
      ),
    ],
    caches: withMissing(
      ordered(
        caches.map((cache) =>
          option(
            cache.cacheId,
            cache.label,
            describeCache(cache),
            cache.status === null
              ? cache.stagedIn === null
              : cache.status === 'hidden',
          ),
        ),
      ),
      choice.mode === 'place' ? undefined : choice.cacheId,
      'Missing cache',
      'No longer one of the militia’s caches',
    ),
    retrievedItems:
      choice.mode === 'retrieve' && known?.stagedIn === null
        ? known.itemIds.map(
            (itemId) =>
              items.find((item) => item.itemId === itemId)?.label ??
              MISSING_ITEM.label,
          )
        : null,
    cache: identityState(
      choice.cacheId,
      known !== undefined,
      choice.mode === 'place',
    ),
    classes: (['minor', 'intermediate', 'major'] as const).map((cacheClass) =>
      option(
        cacheClass,
        activityLabel(cacheClass),
        limitsText(cacheClass),
        tier === null || tier >= cacheLimits[cacheClass].tier,
      ),
    ),
    secure: yesNo(
      [
        'Secure location',
        `+${secureCache.dcBonus} DC · Tier ${secureCache.tier} team`,
        tier === null || tier >= secureCache.tier,
      ],
      ['Ordinary location', null],
    ),
    extradimensional: yesNo(
      ['Extradimensional', 'A major cache has no weight limit'],
      ['Ordinary space', null],
    ),
    items: referenceList(items, choice.itemIds, own),
    purchases: purchaseFacts(choice, slot, items),
    settlements: settlementOptions(view, choice.settlementId),
    contents: cacheContents(choice, items),
    retainedPlace:
      choice.mode !== 'place' &&
      [
        choice.cacheClass,
        choice.location,
        choice.secure,
        choice.extradimensional,
        choice.itemIds,
        choice.purchases,
        choice.settlementId,
      ].some((value) => value !== undefined),
  };
};

const orderDetail: Build<'special_order'> = (choice, slot, view) => {
  const items = itemFacts(view, slot);
  const existing = items.find((item) => item.itemId === choice.itemId);
  const perDay = gp(enchantmentCopperPerDay);
  return {
    actionId: choice.actionId,
    modes: [
      option('purchase', 'Order an item', '5% discount · a new item'),
      option(
        'enchantment',
        'Enchant an item',
        `An item the militia holds · +1 day per ${perDay}`,
      ),
    ],
    item: identityState(
      choice.itemId,
      existing !== undefined,
      choice.mode === 'purchase',
    ),
    existingItem: existing?.label ?? null,
    enchantItems: withMissing(
      ordered(items.map(itemOption)),
      choice.mode === 'purchase' ? undefined : choice.itemId,
      MISSING_ITEM.label,
      MISSING_ITEM.description,
    ),
    settlements: settlementOptions(view, choice.settlementId),
    deliveries: [
      option('false', 'Normal delivery', '2d6 days'),
      option(
        'true',
        'Expedited',
        `+${gp(expeditedDelivery.costCopper)} · ${expeditedDelivery.days} day`,
      ),
    ],
    availability: choice.itemId
      ? availability(choice, slot, choice.itemId)
      : null,
    hasOrder: choice.orderId !== undefined,
    startDay: view.startDay,
    retainedItem:
      choice.mode === 'enchantment' &&
      (choice.name !== undefined || choice.weight !== undefined),
  };
};

const rollWhen: Partial<
  Record<EconomyActionId, Partial<Record<DetailRollField, string>>>
> = {
  activate_black_market: {
    notoriety:
      'Rolled if the Secrecy check fails: Notoriety rises by the roll.',
  },
  special_order: {
    delivery: `Rolled unless delivery is expedited: the order arrives after this many days, plus 1 day per ${gp(enchantmentCopperPerDay)} for an enchantment.`,
  },
};

function specific(choice: EconomyChoice, slot: Slot, view: ActivityView) {
  switch (choice.actionId) {
    case 'activate_black_market':
    case 'broker_market':
      return marketDetail(choice, slot, view);
    case 'secure_cache':
      return cacheDetail(choice, slot, view);
    case 'special_order':
      return orderDetail(choice, slot, view);
  }
}

// The detail facts for a market, cache or Special Order choice, or null for
// other actions.
export function economyDetail(
  view: ActivityView,
  slot: Slot,
): EconomyDetail | null {
  const choice = slot.choice;
  if (!choice || !isEconomyChoice(choice)) return null;
  return {
    ...specific(choice, slot, view),
    rolls: detailRolls(choice, slot, rollWhen[choice.actionId]),
    consumables: consumables(choice, slot, view),
  };
}

// Acknowledgement subjects the economy editor shows beside their purchase,
// order or receipt, so the host does not list them again.
export function economyAcknowledgementSubjects(choice: EconomyChoice) {
  const subjects = new Set<string>();
  if ('purchases' in choice)
    for (const purchase of choice.purchases ?? [])
      subjects.add(`availability:${purchase.itemId}`);
  if (choice.actionId === 'special_order') {
    if (choice.itemId) subjects.add(`availability:${choice.itemId}`);
    const receipt = choice.acknowledgements?.find(
      (entry) => entry.acknowledgementId === choice.receipt?.acknowledgementId,
    );
    if (receipt) subjects.add(receipt.subjectId);
  }
  return subjects;
}
