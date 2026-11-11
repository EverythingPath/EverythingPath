import { activityFixture } from './activity-fixture';
import { roll } from './upkeep-fixture';
import type { StagedActionChoice } from '../../src/lib/weekly-draft-facts';
import type { EconomyState } from '../../src/lib/rules-economy-state';
export type EconomyAction =
  | 'activate_black_market'
  | 'broker_market'
  | 'earn_gold'
  | 'secure_cache'
  | 'special_order';
export function economyFixture(actionId: EconomyAction) {
  const { draft, snapshot } = activityFixture('lie_low');
  snapshot.treasuryCopper = 1000000;
  snapshot.focus = 'Secrecy';
  snapshot.roster.teams[0]!.teamType =
    actionId === 'secure_cache'
      ? 'spies'
      : actionId === 'activate_black_market'
        ? 'blackMarketeers'
        : 'fixers';
  snapshot.settlements.push({
    settlementId: 'town',
    name: 'Town',
    reputation: 'Indifferent',
    secured: false,
    occupied: false,
    temporaryReputationShift: 0,
    refugeActivatedWeek: null,
    refugeActiveUntilWeek: null,
  });
  const economy: EconomyState = {
    items: [
      {
        itemId: 'gear',
        name: 'Supplies',
        valueCopper: 90000,
        weight: 5,
        location: 'held',
      },
    ],
    caches: [],
    markets: [],
    orders: [],
  };
  snapshot.economy = economy;
  const choices: Record<EconomyAction, StagedActionChoice> = {
    activate_black_market: {
      choiceId: 'economy',
      actionId: 'activate_black_market',
      teamId: 'team',
      settlementId: 'town',
      purchases: [],
      rolls: { check: roll(20, 19) },
    },
    broker_market: {
      choiceId: 'economy',
      actionId: 'broker_market',
      teamId: 'team',
      settlementId: 'town',
      purchases: [
        { itemId: 'bought', name: 'Wand', weight: 1, priceCopper: 1001 },
      ],
      acknowledgements: [
        {
          acknowledgementId: 'availability',
          subjectId: 'availability:bought',
          outcome: 'Available in town',
        },
      ],
    },
    earn_gold: {
      choiceId: 'economy',
      actionId: 'earn_gold',
      teamId: 'team',
      rolls: { check: roll(20, 10) },
    },
    secure_cache: {
      choiceId: 'economy',
      actionId: 'secure_cache',
      teamId: 'team',
      cacheId: 'cache',
      cacheClass: 'minor',
      mode: 'place',
      location: 'Old bridge',
      secure: false,
      extradimensional: false,
      itemIds: ['gear'],
      purchases: [],
      rolls: { check: roll(20, 14) },
    },
    special_order: {
      choiceId: 'economy',
      actionId: 'special_order',
      teamId: 'team',
      orderId: 'order',
      itemId: 'ordered',
      name: 'Magic sword',
      weight: 4,
      mode: 'purchase',
      settlementId: 'town',
      priceCopper: 1001,
      expedited: false,
      orderedDay: 273,
      rolls: { delivery: roll(6, 1, 1) },
      acknowledgements: [
        {
          acknowledgementId: 'availability',
          subjectId: 'availability:ordered',
          outcome: 'GM confirms item is available',
        },
      ],
    },
  };
  draft.activity.slots[0]!.choice = choices[actionId];
  return { draft, snapshot, economy, choice: choices[actionId] };
}
