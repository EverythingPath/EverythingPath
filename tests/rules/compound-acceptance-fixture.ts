import type { CanonicalWeekState } from '../../src/lib/canonical-weekly-source';
import { persistentEventFixture } from './persistent-event-fixture';
import { roll } from './upkeep-fixture';

export function compoundAcceptanceFixture() {
  const { draft, snapshot: initialSnapshot } =
    persistentEventFixture('low_morale');
  initialSnapshot.rank = 7;
  initialSnapshot.training = 55;
  initialSnapshot.roster.people.push({
    characterId: 'strategist',
    kind: 'npc',
    hitDice: 7,
  });
  initialSnapshot.characters.push({
    ...initialSnapshot.characters[0]!,
    characterId: 'strategist',
  });
  initialSnapshot.roster.officers.push({
    role: 'strategist',
    characterId: 'strategist',
  });
  const input = { revision: draft, militiaSnapshot: initialSnapshot };
  const snapshot = input.militiaSnapshot;
  snapshot.roster.teams = [
    {
      teamId: 'rescuers',
      teamType: 'specialists',
      name: 'Rescuers',
      status: 'disabled',
      rewardCapExempt: false,
      managerCharacterId: null,
      notes: '',
    },
    {
      teamId: 'spies',
      teamType: 'spies',
      name: 'Spies',
      status: 'active',
      rewardCapExempt: false,
      managerCharacterId: null,
      notes: '',
    },
    {
      teamId: 'fixers',
      teamType: 'fixers',
      name: 'Fixers',
      status: 'active',
      rewardCapExempt: false,
      managerCharacterId: null,
      notes: '',
    },
  ];
  snapshot.economy = {
    items: [
      {
        itemId: 'gear',
        name: 'Supplies',
        valueCopper: 1000,
        weight: 1,
        location: 'held',
      },
    ],
    caches: [],
    markets: [],
    orders: [],
  };
  snapshot.characterActions = {
    people: [
      {
        characterId: 'pc',
        status: 'captured',
        location: { kind: 'headquarters' },
        directRescueRequired: false,
        capture: { source: 'ordinary', week: 1 },
      },
    ],
  };
  draft.context = {
    ...draft.context,
    queuedEffects: [
      {
        effectId: 'old',
        sourceId: 'old-event',
        startsWeek: 2,
        endsWeek: 2,
        effect: {
          kind: 'check_modifier',
          check: 'loyalty',
          phase: 'upkeep',
          value: 1,
        },
      },
    ],
  };
  draft.activity.slots = [
    {
      slotId: 'role-slot',
      choice: {
        choiceId: 'role',
        actionId: 'change_officer_role',
        characterId: 'pc',
        fromRole: 'overseer',
        toRole: 'ambassador',
      },
    },
    {
      slotId: 'rescue-slot',
      choice: {
        choiceId: 'rescue',
        actionId: 'rescue_character',
        teamId: 'rescuers',
        characterId: 'pc',
        destination: { kind: 'headquarters' },
        rolls: { check: roll(20, 20) },
      },
    },
    {
      slotId: 'cache-slot',
      choice: {
        choiceId: 'cache',
        actionId: 'secure_cache',
        teamId: 'spies',
        cacheId: 'hidden',
        cacheClass: 'minor',
        mode: 'place',
        location: 'Bridge',
        secure: false,
        extradimensional: false,
        itemIds: ['gear'],
        purchases: [],
        rolls: { check: roll(20, 20) },
      },
    },
    {
      slotId: 'market-slot',
      choice: {
        choiceId: 'market',
        actionId: 'broker_market',
        teamId: 'fixers',
        settlementId: 'town',
        purchases: [
          { itemId: 'wand', name: 'Wand', priceCopper: 2000, weight: 1 },
        ],
      },
    },
  ];
  draft.upkeep.teamDecisions = [{ teamId: 'rescuers', decision: 'leave' }];
  draft.rulesExceptions = [
    {
      exceptionId: 'rescuers-permission',
      subjectId: 'rescue',
      ruleId: 'team-condition',
      reason:
        'The disabled rescuers can undertake this limited rescue mission.',
    },
  ];
  draft.acknowledgements = [
    {
      acknowledgementId: 'rescue-done',
      subjectId: 'rescue_character:rescue',
      outcome: 'The officer returns home',
    },
    {
      acknowledgementId: 'wand-available',
      subjectId: 'availability:wand',
      outcome: 'Wand available in town',
    },
  ];
  draft.event.occurrences = [
    { eventId: 'storm', origin: { kind: 'rolled' }, tableRoll: roll(100, 54) },
  ];
  draft.persistent.decisions = [{ eventId: 'carried', kind: 'buyoff' }];
  draft.tableAdjustments = [
    {
      kind: 'settlement_reputation',
      adjustmentId: 'favor',
      settlementId: 'town',
      reputation: 'Friendly',
      reason: 'The officer was rescued',
    },
  ];

  // Authored from the scenario and rules, never from a projection or write plan:
  // attrition -1 training; rescue +10 Notoriety; market 100 gp + wand 20 gp;
  // rank-7 buyoff 140 gp; new order due next Activity; old queue expires.
  const before: CanonicalWeekState = {
    week: 2,
    militiaSnapshot: structuredClone(snapshot),
    context: {
      firstMilitiaWeek: false,
      startDay: 7,
      uneventfulCarry: false,
      carriedEvents: [
        {
          eventId: 'carried',
          eventType: 'low_morale',
          startedWeek: 1,
          order: 0,
          targets: [],
        },
      ],
      queuedEffects: [
        {
          effectId: 'old',
          sourceId: 'old-event',
          startsWeek: 2,
          endsWeek: 2,
          effect: {
            kind: 'check_modifier',
            check: 'loyalty',
            phase: 'upkeep',
            value: 1,
          },
        },
      ],
      orders: [],
      lastBuyoffWeek: null,
    },
  };
  const expected: CanonicalWeekState = {
    week: 3,
    militiaSnapshot: {
      ...structuredClone(snapshot),
      training: 54,
      treasuryCopper: 4000,
      notoriety: 20,
      roster: {
        ...structuredClone(snapshot.roster),
        officers: [
          { role: 'strategist', characterId: 'strategist' },
          { role: 'ambassador', characterId: 'pc' },
        ],
      },
      settlements: [{ ...snapshot.settlements[0]!, reputation: 'Friendly' }],
      characterActions: {
        people: [
          {
            characterId: 'pc',
            status: 'available',
            location: { kind: 'headquarters' },
            directRescueRequired: false,
            capture: null,
            rescuedWeek: 2,
          },
        ],
      },
      economy: {
        items: [
          {
            itemId: 'gear',
            name: 'Supplies',
            valueCopper: 1000,
            weight: 1,
            location: 'cache',
          },
          {
            itemId: 'wand',
            name: 'Wand',
            valueCopper: 2000,
            weight: 1,
            location: 'order',
          },
        ],
        caches: [
          {
            cacheId: 'hidden',
            cacheClass: 'minor',
            location: 'Bridge',
            secure: false,
            extradimensional: false,
            itemIds: ['gear'],
            status: 'hidden',
            returnActivityWeek: null,
          },
        ],
        markets: [
          {
            marketId: 'market:market',
            source: 'broker_market',
            settlementId: 'town',
            availableWeek: 2,
            expiresWeek: 2,
            availability: 'small_city',
            availabilityPercent: null,
            salePercent: 50,
            contraband: false,
          },
        ],
        orders: [
          {
            orderId: 'order:market:wand',
            itemId: 'wand',
            source: 'broker_market',
            settlementId: 'town',
            mode: 'purchase',
            orderedWeek: 2,
            orderedDay: 7,
            dueDay: null,
            dueActivityWeek: 3,
            priceCopper: 2000,
            deliveryDays: null,
            enchantmentValueCopper: 0,
            receipt: null,
          },
        ],
      },
      eventBenefits: { skills: [], markets: [] },
    },
    context: {
      firstMilitiaWeek: false,
      startDay: 14,
      uneventfulCarry: false,
      carriedEvents: [],
      queuedEffects: [
        {
          eventType: 'calm_before_the_storm',
          effectId: 'event:storm:automatic_events',
          sourceId: 'storm',
          startsWeek: 3,
          endsWeek: 3,
          effect: { kind: 'automatic_events', count: 1 },
        },
      ],
      orders: [],
      lastBuyoffWeek: 2,
      operatedSettlementIds: ['town'],
    },
  };
  return { input, before, expected };
}
