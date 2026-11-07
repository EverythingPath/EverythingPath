import { describe, expect, test } from 'vitest';
import { foundationWeek } from '../../../tests/rules/foundation-acceptance-fixtures';
import { roll } from '../../../tests/rules/upkeep-fixture';
import { projectWeeklyDraft } from '~/lib/canonical-weekly-resolution';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import type { EconomyState } from '~/lib/rules-economy-state';
import type { UpkeepSnapshot } from '~/lib/rules-upkeep';
import type { StagedActionChoice } from '~/lib/weekly-draft-facts';
import { activityView } from './activity-facts';
import {
  economyAcknowledgementSubjects,
  economyDetail,
  type EconomyDetail,
} from './activity-economy-detail';
import { activityFacts, activitySlot } from './activity-view-fixture';
import type { ActivityTeamFact, ActivityView } from './types';

type Team = UpkeepSnapshot['roster']['teams'][number];
type Item = EconomyState['items'][number];
const team = (teamId: string, teamType: Team['teamType']): Team => ({
  teamId,
  teamType,
  name: teamId,
  status: 'active',
  managerCharacterId: null,
  rewardCapExempt: false,
  notes: '',
});
const item = (itemId: string, name: string, extra: Partial<Item> = {}) =>
  ({
    itemId,
    name,
    valueCopper: 10000,
    weight: 1,
    location: 'held',
    ...extra,
  }) satisfies Item;

// Rank 3 with Upkeep complete, one PC (Ameiko), Phaendar, a Spies and a
// Fixers team, and an economy: a Ring hidden in the Old Mill cache, Ameiko's
// held Gear and a sold Lamp.
function week() {
  const input = foundationWeek(3);
  const snapshot = input.militiaSnapshot;
  snapshot.roster.teams.push(team('spy', 'spies'), team('fix', 'fixers'));
  snapshot.settlements.push({
    settlementId: 'phaendar',
    name: 'Phaendar',
    reputation: 'Indifferent',
    secured: false,
    occupied: false,
    temporaryReputationShift: 0,
    refugeActivatedWeek: null,
    refugeActiveUntilWeek: null,
  });
  snapshot.economy = {
    items: [
      item('ring', 'Ring', { location: 'cache' }),
      item('gear', 'Gear', { ownerCharacterId: 'pc', weight: 5 }),
      item('lamp', 'Lamp', { location: 'sold' }),
    ],
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
    markets: [],
    orders: [],
  };
  const view = () =>
    activityView(
      input.revision,
      workspaceSourceSchema.parse({
        key: {
          campaignId: 'campaign',
          militiaId: 'militia',
          draftId: input.revision.draftId,
        },
        week: input.revision.week,
        sourceRevision: 0,
        snapshot,
        people: [{ characterId: 'pc', name: 'Ameiko' }],
      }),
      projectWeeklyDraft(input),
    );
  const place = (index: number, choice: StagedActionChoice | null) => {
    input.revision.activity.slots[index]!.choice = choice;
  };
  return { view, place };
}
function narrow<Id extends EconomyDetail['actionId']>(
  detail: EconomyDetail | null,
  actionId: Id,
) {
  if (detail?.actionId !== actionId) throw new Error(`Expected ${actionId}`);
  return detail as Extract<EconomyDetail, { actionId: Id }>;
}
const at = (view: ActivityView, index: number) =>
  economyDetail(view, view.slots[index]!);
const retrieve: StagedActionChoice = {
  choiceId: 'retrieve',
  actionId: 'secure_cache',
  teamId: 'spy',
  mode: 'retrieve',
  cacheId: 'mill',
  rolls: { check: roll(20, 20) },
};
const market = (extra: Partial<StagedActionChoice> = {}) =>
  ({
    choiceId: 'market',
    actionId: 'broker_market',
    teamId: 'fix',
    settlementId: 'phaendar',
    ...extra,
  }) as StagedActionChoice;

describe('items and caches at the slot position', () => {
  test('[rules.ACT-10.economy-position] a cache retrieved in an earlier slot makes its items held for a later sale, never for its own slot', () => {
    const { view, place } = week();
    place(0, retrieve);
    place(1, market());
    const facts = view();
    const cache = narrow(at(facts, 0), 'secure_cache');
    expect(cache.caches[0]).toMatchObject({
      value: 'mill',
      label: 'Old Mill',
      description: 'Minor cache · Hidden · 1 item',
      eligible: true,
    });
    expect(cache.retrievedItems).toEqual(['Ring']);
    const sales = narrow(at(facts, 1), 'broker_market').sales;
    expect(sales.selected).toBeNull();
    expect(sales.available).toEqual([
      expect.objectContaining({
        value: 'ring',
        description: 'Held · 100 gp · 1 lb',
        eligible: true,
      }),
      expect.objectContaining({
        value: 'gear',
        description: 'Held · Owned by Ameiko · 100 gp · 5 lb',
        eligible: true,
      }),
      expect.objectContaining({
        value: 'lamp',
        description: 'Sold · 100 gp · 1 lb',
        eligible: false,
      }),
    ]);
    // Swapped, the market comes first and the Ring is still in its cache.
    place(0, market());
    place(1, retrieve);
    const swapped = narrow(at(view(), 0), 'broker_market').sales.available;
    expect(swapped.find((entry) => entry.value === 'ring')).toMatchObject({
      description: 'In a cache · 100 gp · 1 lb',
      eligible: false,
    });
  });

  test('[rules.ACT-10.economy-staged] purchases staged in an earlier slot are offered as staged items; this and later slots’ purchases are not', () => {
    const { view, place } = week();
    place(
      0,
      market({
        purchases: [{ itemId: 'potion', name: 'Potion', priceCopper: 5000 }],
      }),
    );
    place(1, {
      choiceId: 'cache',
      actionId: 'secure_cache',
      teamId: 'spy',
      mode: 'place',
      cacheId: 'new-cache',
      purchases: [{ itemId: 'rope', name: 'Rope', priceCopper: 100 }],
    });
    const facts = view();
    const first = narrow(at(facts, 0), 'broker_market');
    expect(first.sales.available.map((entry) => entry.value)).not.toContain(
      'potion',
    );
    expect(first.sales.available.map((entry) => entry.value)).not.toContain(
      'rope',
    );
    const second = narrow(at(facts, 1), 'secure_cache');
    expect(
      second.items.available.find((entry) => entry.value === 'potion'),
    ).toMatchObject({
      label: 'Potion',
      description: 'Staged in Action Slot 1',
      eligible: false,
    });
    // Its own purchase is not one of the items it can also place.
    expect(second.items.available.map((entry) => entry.value)).not.toContain(
      'rope',
    );
    expect(second.cache).toBe('new');
    // An order for an item an earlier slot already buys would duplicate it.
    place(1, {
      choiceId: 'order',
      actionId: 'special_order',
      mode: 'purchase',
      itemId: 'potion',
    });
    const order = narrow(at(view(), 1), 'special_order');
    expect(order.item).toBe('existing');
    expect(order.existingItem).toBe('Potion');
  });

  test('[rules.ACT-10.economy-missing] a sold item, retrieved cache and settlement nothing knows stay listed as missing', () => {
    const { view, place } = week();
    place(
      0,
      market({ settlementId: 'gone-town', sales: ['gear', 'gone-item'] }),
    );
    place(1, { ...retrieve, cacheId: 'gone-cache' });
    const facts = view();
    const first = narrow(at(facts, 0), 'broker_market');
    expect(first.sales.selected).toEqual([
      expect.objectContaining({ value: 'gear', label: 'Gear', missing: false }),
      {
        value: 'gone-item',
        label: 'Missing item',
        description: 'No longer one of the militia’s items',
        eligible: false,
        missing: true,
      },
    ]);
    expect(first.settlements[0]).toMatchObject({
      value: 'gone-town',
      label: 'Missing settlement',
      missing: true,
    });
    const second = narrow(at(facts, 1), 'secure_cache');
    expect(second.caches[0]).toMatchObject({
      value: 'gone-cache',
      label: 'Missing cache',
      missing: true,
    });
    expect(second.retrievedItems).toBeNull();
  });
});

type Slot = ActivityView['slots'][number];
const position = (items: Item[]): Slot['position'] => ({
  officers: [],
  refugeSettlementIds: [],
  settlements: [],
  propaganda: [],
  characterStatus: [],
  economy: { items, caches: [] },
});
const roster = (teamType: string, tier: number): ActivityTeamFact[] => [
  {
    teamId: 'acting',
    name: 'Acting team',
    teamType,
    typeName: teamType,
    tier,
    condition: 'active',
    unavailable: false,
    recruitedInSlot: null,
  },
];
function detailFor(
  choice: StagedActionChoice,
  slot: Partial<Slot> = {},
  view: Partial<ActivityView> = {},
) {
  const facts = activityFacts(
    [
      activitySlot(choice, {
        position: position([
          item('gear', 'Gear', { weight: 5, valueCopper: 90000 }),
        ]),
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
          { value: 'fort', label: 'Fort', reputation: null },
        ],
      },
      ...view,
    },
  );
  return economyDetail(facts, facts.slots[0]!);
}

describe('market details', () => {
  test('[rules.ACT-10.market-facts] a market names its availability, sale share and activation cost from the acting team and action', () => {
    const broker = narrow(
      detailFor(
        { choiceId: 'm', actionId: 'broker_market', teamId: 'acting' },
        {},
        { teamRoster: roster('merchants', 2) },
      ),
      'broker_market',
    );
    expect(broker.market).toEqual({
      availability: 'Small town',
      salePercent: 50,
      contraband: false,
      activationCopper: 10000,
    });
    expect(broker.purchases).toBeNull();
    // A settlement without a recorded reputation cannot price purchases.
    expect(broker.settlements).toEqual([
      expect.objectContaining({
        value: 'town',
        description: 'Friendly',
        eligible: true,
      }),
      expect.objectContaining({
        value: 'fort',
        description: 'Reputation not recorded',
        eligible: false,
      }),
    ]);
    const black = narrow(
      detailFor(
        { choiceId: 'm', actionId: 'activate_black_market', teamId: 'acting' },
        {},
        { teamRoster: roster('blackMarketeers', 3) },
      ),
      'activate_black_market',
    );
    expect(black.market).toEqual({
      availability: 'Small city',
      salePercent: 55,
      contraband: true,
      activationCopper: 5000,
    });
    // Its notoriety roll shows only once the rules read the check as failed.
    expect(black.rolls).toEqual([]);
    const blackCheck = (succeeded: boolean) =>
      detailFor(
        { choiceId: 'm', actionId: 'activate_black_market', teamId: 'acting' },
        {
          check: {
            spec: { count: 1, sides: 20 },
            organizationCheck: 'secrecy',
            dc: 20,
            modifier: 3,
            total: succeeded ? 21 : 19,
            succeeded,
            breakdown: [],
          },
        },
        { teamRoster: roster('blackMarketeers', 3) },
      )!.rolls;
    expect(blackCheck(true)).toEqual([]);
    expect(blackCheck(false)).toEqual([
      expect.objectContaining({
        field: 'notoriety',
        when: 'Rolled if the Secrecy check fails: Notoriety rises by the roll.',
        shownBecause: 'The check fails',
      }),
    ]);
  });

  test('[rules.ACT-10.purchase-facts] each purchase shows its missing name or weight, an existing item and its availability answer', () => {
    const choice: StagedActionChoice = {
      choiceId: 'm',
      actionId: 'broker_market',
      purchases: [
        { itemId: 'wand', name: 'Wand', priceCopper: 1001, weight: 0.5 },
        { itemId: 'gear', name: 'Gear', priceCopper: 5, weight: 1 },
        { itemId: 'cloak', priceCopper: 0 },
      ],
      acknowledgements: [
        {
          acknowledgementId: 'a',
          subjectId: 'availability:wand',
          outcome: 'In stock',
        },
      ],
    };
    const market = narrow(
      detailFor(choice, {
        requirements: ['m:acknowledgement:availability:cloak'],
      }),
      'broker_market',
    );
    expect(market.purchases).toEqual([
      {
        itemId: 'wand',
        name: 'Wand',
        priceCopper: 1001,
        weight: 0.5,
        incomplete: false,
        duplicate: false,
        availability: { itemId: 'wand', outcome: 'In stock', required: false },
      },
      expect.objectContaining({ itemId: 'gear', duplicate: true }),
      expect.objectContaining({
        itemId: 'cloak',
        name: null,
        weight: null,
        incomplete: true,
        availability: { itemId: 'cloak', outcome: null, required: true },
      }),
    ]);
    expect(economyAcknowledgementSubjects(choice)).toEqual(
      new Set(['availability:wand', 'availability:gear', 'availability:cloak']),
    );
  });
});

describe('cache details', () => {
  test('[rules.ACT-10.cache-place] placing shows class limits against the team tier and the contents’ weight and value', () => {
    const place = (extra: Partial<StagedActionChoice> = {}) =>
      narrow(
        detailFor(
          {
            choiceId: 'c',
            actionId: 'secure_cache',
            teamId: 'acting',
            mode: 'place',
            cacheId: 'fresh',
            itemIds: ['gear'],
            purchases: [{ itemId: 'rope', priceCopper: 10000, weight: 2 }],
            ...extra,
          } as StagedActionChoice,
          {},
          { teamRoster: roster('moles', 1) },
        ),
        'secure_cache',
      );
    const minor = place({ cacheClass: 'minor' });
    expect(minor.cache).toBe('new');
    expect(minor.classes.map((entry) => [entry.value, entry.eligible])).toEqual(
      [
        ['minor', true],
        ['intermediate', false],
        ['major', false],
      ],
    );
    expect(minor.classes[0]!.description).toBe(
      'Up to 5 lb and 900 gp · DC 15 · Tier 1+ team',
    );
    expect(minor.secure[0]).toMatchObject({ value: 'true', eligible: false });
    expect(minor.contents).toEqual({
      weight: 7,
      valueCopper: 100000,
      unknown: 0,
      limit: { weight: 5, valueCopper: 90000 },
    });
    expect(minor.items.selected).toEqual([
      expect.objectContaining({ value: 'gear', eligible: true }),
    ]);
    const major = place({ cacheClass: 'major', extradimensional: true });
    expect(major.contents.limit).toEqual({ weight: null, valueCopper: null });
    expect(place({ cacheId: 'gear-cache' }).cache).toBe('new');
    expect(place({ cacheId: undefined }).cache).toBe('none');
    expect(place().retainedPlace).toBe(false);
  });

  test('[rules.ACT-10.cache-retained] placing values recorded while retrieving are retained and reported', () => {
    const retrieving = narrow(
      detailFor({
        choiceId: 'c',
        actionId: 'secure_cache',
        mode: 'retrieve',
        location: 'Old Mill',
      }),
      'secure_cache',
    );
    expect(retrieving.retainedPlace).toBe(true);
    expect(retrieving.cache).toBe('none');
    // A cleared mode keeps them, and a recorded cache nothing has is missing.
    const unset = narrow(
      detailFor({
        choiceId: 'c',
        actionId: 'secure_cache',
        cacheId: 'gone',
        location: 'Old Mill',
      }),
      'secure_cache',
    );
    expect(unset.retainedPlace).toBe(true);
    expect(unset.cache).toBe('missing');
    expect(unset.caches[0]).toMatchObject({ value: 'gone', missing: true });
  });
});

describe('Special Order details', () => {
  test('[rules.ACT-10.order-identity] an order knows whether its item is new or existing, offers held items to enchant and keeps an unused name', () => {
    const order = (extra: Partial<StagedActionChoice>) =>
      narrow(
        detailFor(
          {
            choiceId: 'o',
            actionId: 'special_order',
            orderId: 'order',
            ...extra,
          } as StagedActionChoice,
          { requirements: ['o:delivery:2d6'] },
        ),
        'special_order',
      );
    const purchase = order({ mode: 'purchase', itemId: 'new-item' });
    expect(purchase.item).toBe('new');
    expect(purchase.hasOrder).toBe(true);
    expect(purchase.availability).toEqual({
      itemId: 'new-item',
      outcome: null,
      required: false,
    });
    expect(purchase.rolls).toEqual([
      expect.objectContaining({ field: 'delivery', required: true }),
    ]);
    expect(purchase.deliveries.map((entry) => entry.label)).toEqual([
      'Normal delivery',
      'Expedited',
    ]);
    const duplicate = order({ mode: 'purchase', itemId: 'gear' });
    expect(duplicate.item).toBe('existing');
    expect(duplicate.existingItem).toBe('Gear');
    const enchant = order({ mode: 'enchantment', itemId: 'gear', name: 'Old' });
    expect(enchant.enchantItems[0]).toMatchObject({
      value: 'gear',
      eligible: true,
    });
    expect(enchant.retainedItem).toBe(true);
    const lost = order({ mode: 'enchantment', itemId: 'lost' });
    expect(lost.item).toBe('missing');
    expect(lost.enchantItems[0]).toMatchObject({
      value: 'lost',
      label: 'Missing item',
      missing: true,
    });
    expect(order({}).item).toBe('none');
    expect(order({}).availability).toBeNull();
  });
});
