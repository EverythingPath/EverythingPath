import { assert, expect, test } from 'vitest';
import { economyFixture } from '../../tests/rules/economy-fixture';
import { roll } from '../../tests/rules/upkeep-fixture';
import { projectActivity } from './rules-activity';
import { editWeeklyDraft } from './weekly-draft';
import { economyStateSchema } from './rules-economy-state';
import { actionRestrictions } from './rules-action-eligibility';

function project(fixture: ReturnType<typeof economyFixture>) {
  return projectActivity(fixture.draft, fixture.snapshot);
}
function ready(fixture: ReturnType<typeof economyFixture>) {
  const result = project(fixture);
  expect(result.requirements).toEqual([]);
  expect(result.ready).toBe(true);
  expect(economyStateSchema.safeParse(result.outcome.economy).success).toBe(
    true,
  );
  return result;
}
test('[rules.A01.success] DC20 activates one-week black market with 90 percent availability, 55 percent sales and contraband', () => {
  const f = economyFixture('activate_black_market');
  if (f.choice.actionId !== 'activate_black_market') throw Error();
  f.choice.sales = ['gear'];
  f.choice.rolls = { check: roll(20, 17) };
  const r = ready(f);
  expect(r.checks[0]!.total).toBe(20);
  expect(r.outcome.economy!.markets[0]).toMatchObject({
    availabilityPercent: 90,
    salePercent: 55,
    contraband: true,
    availableWeek: 40,
    expiresWeek: 40,
  });
  expect(r.outcome.treasuryCopper).toBe(1044500);
  expect(r.outcome.economy!.items[0]!.location).toBe('sold');
});
test('[rules.A01.failure] one below DC20 pays 50 gp and adds rolled Notoriety without activating or selling', () => {
  const f = economyFixture('activate_black_market');
  assert(f.choice.actionId === 'activate_black_market');
  f.choice.rolls = { check: roll(20, 16), notoriety: roll(6, 4) };
  const r = ready(f);
  expect(r.checks[0]!.total).toBe(19);
  expect(r.outcome.notoriety).toBe(14);
  expect(r.outcome.treasuryCopper).toBe(995000);
  expect(r.outcome.economy!.markets).toEqual([]);
});
test('[rules.A01.lifecycle] black markets expire next week and clearing activation removes market and sales', () => {
  const f = economyFixture('activate_black_market');
  const previous = ready(f);
  f.snapshot = previous.outcome;
  f.draft = {
    ...f.draft,
    week: 41,
    activity: { ...f.draft.activity, slots: [] },
  };
  expect(ready(f).outcome.economy!.markets).toEqual([]);
  const original = economyFixture('activate_black_market');
  original.draft.activity.slots[0]!.choice = null;
  expect(ready(original).outcome.treasuryCopper).toBe(1000000);
  expect(ready(original).outcome.economy!.markets).toEqual([]);
});
test('[rules.A01.inputs] missing team, settlement, raw check, failure die and economy facts stay unready', () => {
  for (const key of ['teamId', 'settlementId', 'rolls'] as const) {
    const f = economyFixture('activate_black_market');
    if (f.choice.actionId !== 'activate_black_market') throw Error();
    delete f.choice[key];
    expect(project(f).ready).toBe(false);
  }
  const f = economyFixture('activate_black_market');
  delete f.snapshot.economy;
  expect(project(f).requirements).toContain('economy:economy-state');
  const failure = economyFixture('activate_black_market');
  assert(failure.choice.actionId === 'activate_black_market');
  failure.choice.rolls = { check: roll(20, 1) };
  expect(project(failure).ready).toBe(false);
});
test('[rules.A03.profiles] Merchants broker small-town availability and Fixers or Black Marketeers small-city availability', () => {
  for (const teamType of ['merchants', 'fixers', 'blackMarketeers'] as const) {
    const f = economyFixture('broker_market');
    f.snapshot.roster.teams[0]!.teamType = teamType;
    expect(ready(f).outcome.economy!.markets[0]!.availability).toBe(
      teamType === 'merchants' ? 'small_town' : 'small_city',
    );
  }
});
test('[rules.A03.payment] activation and contextual purchase costs are charged upfront at copper precision', () => {
  const f = economyFixture('broker_market');
  f.snapshot.settlements[0]!.reputation = 'Helpful';
  f.economy.markets.push({
    marketId: 'day',
    source: 'market_day',
    settlementId: 'town',
    availableWeek: 40,
    expiresWeek: 40,
    availability: null,
    availabilityPercent: null,
    salePercent: null,
    contraband: false,
  });
  const r = ready(f);
  expect(r.outcome.treasuryCopper).toBe(1000000 - 10000 - 903);
  expect(
    r.outcome.economy!.items.find((x) => x.itemId === 'bought')!.location,
  ).toBe('order');
});
test('[rules.A03.delivery] Broker purchases arrive next Activity and do not require or invent Special Order delivery dice', () => {
  const f = economyFixture('broker_market');
  const placed = ready(f);
  expect(placed.outcome.economy!.orders[0]).toMatchObject({
    dueDay: null,
    dueActivityWeek: 41,
    receipt: null,
  });
  f.snapshot = placed.outcome;
  f.draft = {
    ...f.draft,
    week: 41,
    activity: { ...f.draft.activity, slots: [] },
  };
  const received = ready(f);
  expect(
    received.outcome.economy!.items.find((x) => x.itemId === 'bought')!
      .location,
  ).toBe('held');
  f.snapshot = received.outcome;
  expect(ready(f).plan.filter((x) => x.kind === 'receive_order')).toEqual([]);
});
test('[rules.A03.expiry] Broker market expires while paid future delivery survives', () => {
  const f = economyFixture('broker_market');
  const r = ready(f);
  f.snapshot = r.outcome;
  f.snapshot.economy!.orders[0]!.dueActivityWeek = 42;
  f.draft = {
    ...f.draft,
    week: 41,
    activity: { ...f.draft.activity, slots: [] },
  };
  const next = ready(f);
  expect(next.outcome.economy!.markets).toEqual([]);
  expect(next.outcome.economy!.orders[0]!.receipt).toBeNull();
});
test('[rules.A08.tiers] Earn Gold multiplies the complete check by each eligible team tier', () => {
  for (const [teamType, tier] of [
    ['patrons', 1],
    ['merchants', 2],
    ['fixers', 3],
    ['blackMarketeers', 3],
  ] as const) {
    const f = economyFixture('earn_gold');
    f.snapshot.roster.teams[0]!.teamType = teamType;
    const r = ready(f);
    expect(r.outcome.treasuryCopper).toBe(
      1000000 + r.checks[0]!.total! * tier * 100,
    );
  }
});
test('[rules.A08.natural-one] natural one still earns gold and adds exactly the entered Notoriety die', () => {
  const f = economyFixture('earn_gold');
  assert(f.choice.actionId === 'earn_gold');
  f.choice.rolls = { check: roll(20, 1), notoriety: roll(6, 6) };
  const r = ready(f);
  expect(r.outcome.treasuryCopper).toBe(1000600);
  expect(r.outcome.notoriety).toBe(16);
});
test('[rules.A08.composition] manager and queued modifiers are included once in earnings', () => {
  const f = economyFixture('earn_gold');
  f.snapshot.roster.teams[0]!.managerCharacterId = 'pc';
  f.snapshot.characters[0]!.charisma = 16;
  f.draft = {
    ...f.draft,
    context: {
      ...f.draft.context,
      queuedEffects: [
        {
          effectId: 'penalty',
          sourceId: 'event',
          startsWeek: 40,
          endsWeek: 40,
          effect: { kind: 'check_modifier', check: 'loyalty', value: -2 },
        },
      ],
    },
  };
  const r = ready(f);
  expect(r.checks[0]!.total).toBe(15);
  expect(r.outcome.treasuryCopper).toBe(1004500);
});
test('[rules.A08.removed] clearing Earn Gold removes its income and makes a subsequent unaffordable order unready', () => {
  const f = economyFixture('earn_gold');
  f.snapshot.treasuryCopper = 0;
  const order = economyFixture('special_order').choice;
  order.choiceId = 'buy';
  delete order.teamId;
  f.snapshot.roster.teams.push({
    ...f.snapshot.roster.teams[0]!,
    teamId: 'other',
  });
  order.teamId = 'other';
  f.draft.activity.slots[1]!.choice = order;
  expect(ready(f).outcome.treasuryCopper).toBe(3300 - 951);
  f.draft.activity.slots[0]!.choice = null;
  const r = project(f);
  expect(r.requirements).toContain('buy:treasury:exception');
  expect(r.outcome.economy!.orders).toEqual([]);
});
test('[rules.A19.minor] minor cache accepts 5 lb and 900 gp exactly at DC15 and requires an exception above either limit', () => {
  const f = economyFixture('secure_cache');
  assert(f.choice.actionId === 'secure_cache');
  f.choice.rolls = { check: roll(20, 12) };
  expect(ready(f).outcome.economy!.caches[0]!.status).toBe('hidden');
  for (const field of ['weight', 'valueCopper'] as const) {
    const excess = economyFixture('secure_cache');
    excess.economy.items[0]![field] += 0.01;
    expect(project(excess).requirements).toContain(
      'economy:cache-capacity:exception',
    );
  }
});
test('[rules.A19.intermediate] intermediate cache accepts 10 lb and 2500 gp at DC20 and rejects lesser team tier', () => {
  const f = economyFixture('secure_cache');
  if (f.choice.actionId !== 'secure_cache') throw Error();
  f.choice.cacheClass = 'intermediate';
  f.choice.rolls = { check: roll(20, 17) };
  f.economy.items[0]!.weight = 10;
  f.economy.items[0]!.valueCopper = 250000;
  expect(ready(f).outcome.economy!.caches[0]!.status).toBe('hidden');
  f.snapshot.roster.teams[0]!.teamType = 'moles';
  expect(project(f).requirements).toContain('economy:cache-tier:exception');
});
test('[rules.A19.major] major cache has unlimited value and requires extradimensional storage above 20 lb', () => {
  const f = economyFixture('secure_cache');
  if (f.choice.actionId !== 'secure_cache') throw Error();
  f.choice.cacheClass = 'major';
  f.choice.rolls = {
    check: {
      ...roll(20, 20),
      modifiers: [
        { sourceId: 'magic', value: 7, reason: 'Magic aids concealment' },
      ],
    },
  };
  f.economy.items[0]!.weight = 20;
  f.economy.items[0]!.valueCopper = 99999999;
  expect(ready(f).outcome.economy!.caches[0]!.status).toBe('hidden');
  f.economy.items[0]!.weight = 21;
  expect(project(f).ready).toBe(false);
  f.choice.extradimensional = true;
  expect(ready(f).ready).toBe(true);
});
test('[rules.A19.secure] secure location adds 5 DC and requires a tier-three team even for minor caches', () => {
  const f = economyFixture('secure_cache');
  if (f.choice.actionId !== 'secure_cache') throw Error();
  f.choice.secure = true;
  f.choice.rolls = { check: roll(20, 16) };
  expect(ready(f).outcome.economy!.caches[0]!.status).toBe('returning');
  f.choice.rolls = { check: roll(20, 17) };
  expect(ready(f).outcome.economy!.caches[0]!.status).toBe('hidden');
  f.snapshot.roster.teams[0]!.teamType = 'propagandists';
  expect(project(f).ready).toBe(false);
});
test('[rules.A19.failure] failed placement withholds owned and purchased equipment until the next Activity', () => {
  const f = economyFixture('secure_cache');
  if (f.choice.actionId !== 'secure_cache') throw Error();
  f.choice.rolls = { check: roll(20, 1) };
  f.choice.settlementId = 'town';
  f.choice.purchases = [
    { itemId: 'supplies', name: 'Supplies', priceCopper: 100, weight: 0 },
  ];
  f.choice.acknowledgements = [
    {
      acknowledgementId: 'available',
      subjectId: 'availability:supplies',
      outcome: 'Available',
    },
  ];
  f.economy.items[0]!.valueCopper = 89900;
  const failed = ready(f);
  expect(failed.outcome.economy!.items.map((x) => x.location)).toEqual([
    'returning',
    'returning',
  ]);
  expect(failed.outcome.treasuryCopper).toBe(999900);
  f.snapshot = failed.outcome;
  f.draft = {
    ...f.draft,
    week: 41,
    activity: { ...f.draft.activity, slots: [] },
  };
  const next = ready(f);
  expect(next.outcome.economy!.items.map((x) => x.location)).toEqual([
    'held',
    'held',
  ]);
  expect(next.outcome.treasuryCopper).toBe(999900);
});
test('[rules.A19.retrieve] retrieval targets one hidden cache and restores exact equipment identities only after success', () => {
  const f = economyFixture('secure_cache');
  const placed = ready(f);
  f.snapshot = placed.outcome;
  f.draft.activity.slots[0]!.choice = {
    choiceId: 'retrieve',
    actionId: 'secure_cache',
    teamId: 'team',
    mode: 'retrieve',
    cacheId: 'cache',
    rolls: { check: roll(20, 11) },
  };
  expect(ready(f).outcome.economy!.items[0]!.location).toBe('cache');
  f.draft.activity.slots[0]!.choice.rolls = { check: roll(20, 12) };
  const r = ready(f);
  expect(r.outcome.economy!.items).toEqual([
    { ...f.economy.items[0], location: 'held' },
  ]);
  f.snapshot = r.outcome;
  expect(project(f).requirements).toContain('retrieve:hidden-cache');
});
test('[rules.A19.double-agent] persistent and next-Activity Double Agent use shared restrictions and require a reasoned exception', () => {
  const f = economyFixture('secure_cache');
  f.draft = {
    ...f.draft,
    context: {
      ...f.draft.context,
      carriedEvents: [
        {
          eventId: 'agent',
          eventType: 'double_agent',
          startedWeek: 39,
          order: 0,
          targets: [],
        },
      ],
      persistentPhaseEligible: true,
    },
  };
  expect(actionRestrictions(f.draft, f.choice)).toEqual(['action-blocked']);
  expect(project(f).outcome.economy!.caches).toEqual([]);
  f.draft.rulesExceptions = [
    {
      exceptionId: 'exception',
      subjectId: 'economy',
      ruleId: 'action-blocked',
      reason: 'The cache predates the infiltrator',
    },
  ];
  const r = ready(f);
  expect(r.checks[0]!.total).toBe(15);
  f.draft.rulesExceptions[0]!.reason = ' ';
  expect(project(f).ready).toBe(false);
  f.draft = {
    ...f.draft,
    context: {
      ...f.draft.context,
      carriedEvents: [],
      persistentPhaseEligible: false,
      queuedEffects: [
        {
          effectId: 'block',
          sourceId: 'agent',
          startsWeek: 40,
          endsWeek: 40,
          effect: { kind: 'block_action', actionId: 'secure_cache' },
        },
      ],
    },
  };
  expect(actionRestrictions(f.draft, f.choice)).toEqual(['action-blocked']);
  f.draft.week = 41;
  expect(actionRestrictions(f.draft, f.choice)).toEqual([]);
});
test('[rules.A21.price] Special Order discounts one item at copper precision, compounding contextual prices before rounding', () => {
  const f = economyFixture('special_order');
  f.snapshot.settlements[0]!.reputation = 'Hostile';
  const r = ready(f);
  expect(r.outcome.treasuryCopper).toBe(999002);
  expect(r.outcome.economy!.orders[0]!.priceCopper).toBe(998);
});
test('[rules.A21.ordinary] ordinary delivery retains 2 and 12 day boundaries and requires both dice', () => {
  for (const die of [1, 6]) {
    const f = economyFixture('special_order');
    assert(f.choice.actionId === 'special_order');
    f.choice.rolls = { delivery: roll(6, die, die) };
    expect(ready(f).outcome.economy!.orders[0]!.dueDay).toBe(273 + 2 * die);
  }
  const f = economyFixture('special_order');
  assert(f.choice.actionId === 'special_order');
  delete f.choice.rolls;
  expect(project(f).ready).toBe(false);
  expect(project(f).outcome.economy!.orders).toEqual([]);
});
test('[rules.A21.expedite] expedited delivery is one day with a 900 gp surcharge and no delivery dice', () => {
  const f = economyFixture('special_order');
  if (f.choice.actionId !== 'special_order') throw Error();
  f.choice.expedited = true;
  delete f.choice.rolls;
  const r = ready(f);
  expect(r.outcome.economy!.orders[0]).toMatchObject({
    dueDay: 274,
    deliveryDays: 1,
    priceCopper: 90951,
  });
  expect(r.outcome.treasuryCopper).toBe(909049);
});
test('[rules.A21.enchantment] enchantment retains the existing item and adds duration per 1000 gp until explicit receipt', () => {
  const f = economyFixture('special_order');
  if (f.choice.actionId !== 'special_order') throw Error();
  f.choice.itemId = 'gear';
  f.choice.mode = 'enchantment';
  f.choice.priceCopper = 150000;
  f.choice.acknowledgements![0]!.subjectId = 'availability:gear';
  const r = ready(f);
  expect(r.outcome.economy!.items).toHaveLength(1);
  expect(r.outcome.economy!.items[0]!.location).toBe('enchanting');
  expect(r.outcome.economy!.orders[0]).toMatchObject({
    deliveryDays: 3.5,
    dueDay: 276.5,
  });
  f.choice.receipt = { receivedDay: 277, acknowledgementId: 'receipt' };
  f.draft.acknowledgements.push({
    acknowledgementId: 'receipt',
    subjectId: 'order',
    outcome: 'Returned enchanted sword',
  });
  const received = ready(f);
  expect(received.outcome.economy!.items).toEqual([
    { ...f.economy.items[0], valueCopper: 240000 },
  ]);
});
test('[rules.A21.receipt] receipt crossing weeks requires its date and acknowledgement and never duplicates equipment', () => {
  const f = economyFixture('special_order');
  const placed = ready(f);
  f.snapshot = placed.outcome;
  f.draft = {
    ...f.draft,
    week: 41,
    activity: { ...f.draft.activity, slots: [] },
    orderReceipts: [
      { orderId: 'order', receivedDay: 280, acknowledgementId: 'receipt' },
    ],
    acknowledgements: [
      {
        acknowledgementId: 'receipt',
        subjectId: 'order',
        outcome: 'Collected item',
      },
    ],
  };
  const r = ready(f);
  expect(
    r.outcome.economy!.items.filter((x) => x.itemId === 'ordered'),
  ).toHaveLength(1);
  expect(
    r.outcome.economy!.items.find((x) => x.itemId === 'ordered')!.location,
  ).toBe('held');
  f.snapshot = r.outcome;
  expect(project(f).requirements).toContain('order:unreceived-order');
  expect(project(f).outcome.economy!.items).toEqual(r.outcome.economy!.items);
});
test('[rules.A21.inputs] missing availability, receipt acknowledgement and premature receipt cannot complete an order', () => {
  const f = economyFixture('special_order');
  if (f.choice.actionId !== 'special_order') throw Error();
  f.choice.acknowledgements = [];
  expect(project(f).ready).toBe(false);
  expect(project(f).outcome.economy!.orders).toEqual([]);
  f.choice.acknowledgements = [
    {
      acknowledgementId: 'a',
      subjectId: 'availability:ordered',
      outcome: 'Available',
    },
  ];
  f.choice.receipt = { receivedDay: 274, acknowledgementId: 'r' };
  expect(project(f).requirements).toContain('order:delivery-day');
  f.choice.receipt.receivedDay = 275;
  expect(project(f).requirements).toContain('order:receipt-acknowledgement');
});
test('[rules.A21.removed] replacing an order drops its details, paid cost, pending asset and receipt', () => {
  const f = economyFixture('special_order');
  const edited = editWeeklyDraft(f.draft, {
    kind: 'replace',
    slotId: 'one',
    choiceId: 'economy',
    choice: { choiceId: 'low', actionId: 'lie_low' },
  });
  expect(edited.ok).toBe(true);
  if (!edited.ok) return;
  f.draft = edited.draft;
  const r = ready(f);
  expect(r.outcome.economy!.orders).toEqual([]);
  expect(r.outcome.economy!.items).toEqual(f.economy.items);
  expect(r.outcome.treasuryCopper).toBe(1000000);
});

test('[rules.economy.ordered-assets] later actions cannot reuse sold, cached, or enchanting items and reorder recomputes the result', () => {
  const f = economyFixture('secure_cache');
  const second = economyFixture('special_order').choice;
  if (second.actionId !== 'special_order') throw Error();
  second.choiceId = 'enchant';
  second.teamId = 'fixers';
  second.itemId = 'gear';
  second.mode = 'enchantment';
  second.acknowledgements![0]!.subjectId = 'availability:gear';
  f.snapshot.roster.teams.push({
    ...f.snapshot.roster.teams[0]!,
    teamId: 'fixers',
    teamType: 'fixers',
  });
  f.draft.activity.slots[1]!.choice = second;
  expect(project(f).requirements).toContain('enchant:existing-item');
  f.draft.activity.slots.reverse();
  expect(project(f).requirements).toContain('economy:owned-items');
  expect(
    project(f).outcome.economy!.items.filter((x) => x.itemId === 'gear'),
  ).toHaveLength(1);
});
test('[rules.economy.multiple-markets] independent teams create distinct markets and orders and clearing one removes only its assets', () => {
  const f = economyFixture('broker_market');
  const second = economyFixture('broker_market').choice;
  if (second.actionId !== 'broker_market') throw Error();
  second.choiceId = 'second';
  second.teamId = 'other';
  second.purchases![0]!.itemId = 'other-item';
  second.acknowledgements![0]!.subjectId = 'availability:other-item';
  second.acknowledgements![0]!.acknowledgementId = 'other-availability';
  f.snapshot.roster.teams.push({
    ...f.snapshot.roster.teams[0]!,
    teamId: 'other',
  });
  f.draft.activity.slots[1]!.choice = second;
  expect(ready(f).outcome.economy!.markets).toHaveLength(2);
  expect(ready(f).outcome.economy!.orders).toHaveLength(2);
  f.draft.activity.slots[0]!.choice = null;
  const r = ready(f);
  expect(r.outcome.economy!.markets).toHaveLength(1);
  expect(r.outcome.economy!.orders[0]!.itemId).toBe('other-item');
  expect(r.outcome.treasuryCopper).toBe(988999);
});
test('[rules.economy.negative-check] negative modified Earn Gold results retain baseline arithmetic rather than inventing a minimum', () => {
  const f = economyFixture('earn_gold');
  assert(f.choice.actionId === 'earn_gold');
  f.choice.rolls = {
    check: {
      ...roll(20, 2),
      modifiers: [{ sourceId: 'penalty', value: -5, reason: 'Table penalty' }],
    },
  };
  const r = ready(f);
  expect(r.checks[0]!.total).toBe(-2);
  expect(r.outcome.treasuryCopper).toBe(999400);
});
test('[rules.economy.exceptions] treasury and cache exceptions retain baseline costs and required references', () => {
  const f = economyFixture('secure_cache');
  if (f.choice.actionId !== 'secure_cache') throw Error();
  f.economy.items[0]!.weight = 6;
  f.draft.rulesExceptions = [
    {
      exceptionId: 'capacity',
      subjectId: 'economy',
      ruleId: 'cache-capacity',
      reason: 'Special container',
    },
  ];
  expect(ready(f).outcome.economy!.caches).toHaveLength(1);
  f.choice.itemIds = ['missing'];
  expect(project(f).requirements).toContain('economy:owned-items');
  const order = economyFixture('special_order');
  order.snapshot.treasuryCopper = 0;
  order.draft.rulesExceptions = [
    {
      exceptionId: 'credit',
      subjectId: 'economy',
      ruleId: 'treasury',
      reason: 'Friendly merchant extends credit',
    },
  ];
  expect(ready(order).outcome.treasuryCopper).toBe(-951);
});
test('[rules.economy.draft-contract] cache contents and fractional order dates survive semantic edits and parsing', () => {
  const f = economyFixture('secure_cache');
  const edited = editWeeklyDraft(f.draft, {
    kind: 'detail',
    slotId: 'one',
    choiceId: 'economy',
    choice: f.choice,
  });
  expect(edited.ok).toBe(true);
  if (!edited.ok) throw Error();
  expect(projectActivity(edited.draft, f.snapshot)).toEqual(project(f));
  const order = economyFixture('special_order');
  order.draft = {
    ...order.draft,
    context: {
      ...order.draft.context,
      orders: [
        {
          orderId: 'old',
          itemId: 'old-item',
          settlementId: 'town',
          orderedDay: 270,
          dueDay: 276.5,
          priceCopper: 100000,
          receipt: null,
        },
      ],
    },
  };
  const received = editWeeklyDraft(order.draft, {
    kind: 'receive_order',
    orderId: 'old',
    receivedDay: 277,
    acknowledgementId: 'receipt',
  });
  expect(received.ok).toBe(true);
});

test('[rules.economy.theft-income] carried Theft halves earnings and copper-precise sales once without reducing expenses', () => {
  for (const action of [
    'earn_gold',
    'activate_black_market',
    'broker_market',
  ] as const) {
    const f = economyFixture(action);
    f.economy.items[0]!.valueCopper = 100;
    if (
      f.choice.actionId === 'activate_black_market' ||
      f.choice.actionId === 'broker_market'
    )
      f.choice.sales = ['gear'];
    const ordinary = ready(f);
    f.draft = {
      ...f.draft,
      context: {
        ...f.draft.context,
        persistentPhaseEligible: true,
        carriedEvents: [
          {
            eventId: 'theft-one',
            eventType: 'theft',
            startedWeek: 38,
            order: 0,
            targets: [],
          },
          {
            eventId: 'theft-two',
            eventType: 'theft',
            startedWeek: 39,
            order: 1,
            targets: [],
          },
        ],
      },
    };
    const affected = ready(f);
    const gross =
      action === 'earn_gold'
        ? 3300
        : action === 'activate_black_market'
          ? 55
          : 50;
    expect(affected.outcome.treasuryCopper).toBe(
      ordinary.outcome.treasuryCopper - gross + Math.round(gross / 2),
    );
    expect(affected.outcome.economy).toEqual(ordinary.outcome.economy);
    expect(affected.endedEventIds).toEqual([]);
  }
});
test('[rules.economy.theft-order] earlier theft-reduced income changes whether a later purchase is affordable', () => {
  const f = economyFixture('earn_gold');
  f.snapshot.treasuryCopper = 0;
  const order = economyFixture('special_order').choice;
  if (order.actionId !== 'special_order') throw Error();
  order.choiceId = 'buy';
  order.teamId = 'other';
  order.priceCopper = 2000;
  f.snapshot.roster.teams.push({
    ...f.snapshot.roster.teams[0]!,
    teamId: 'other',
  });
  f.draft.activity.slots[1]!.choice = order;
  expect(ready(f).outcome.treasuryCopper).toBe(1400);
  f.draft = {
    ...f.draft,
    context: {
      ...f.draft.context,
      persistentPhaseEligible: true,
      carriedEvents: [
        {
          eventId: 'theft',
          eventType: 'theft',
          startedWeek: 39,
          order: 0,
          targets: [],
        },
      ],
    },
  };
  const affected = project(f);
  expect(affected.requirements).toContain('buy:treasury:exception');
  expect(affected.outcome.treasuryCopper).toBe(1650);
  expect(affected.outcome.economy!.orders).toEqual([]);
});
