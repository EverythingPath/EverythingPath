import { expect, test } from 'vitest';
import { acceptedCampaignSetup } from '../../../tests/rules/accepted-campaign';
import type { StagedReference } from '~/lib/correction-staged-choices';
import { noCapturedFacts, rememberFacts } from '~/lib/reference-restoration';
import {
  carriedDependencyError,
  describeChoice,
  identityNames,
  namedItemReferences,
  namedSourceReferences,
  neededByNote,
  restoreFirstNote,
  restoreLabel,
  type IdentityNames,
} from './affected-choice-copy';

const names: IdentityNames = (kind, id) =>
  ({ scouts: 'Scouts', guards: 'Guards' })[id] ?? null;

const slot = (missing: StagedReference['missing']): StagedReference => ({
  key: 'activitySlot:two',
  phase: 'activity',
  location: {
    kind: 'activitySlot',
    slotId: 'two',
    position: 2,
    actionId: 'dismiss_team',
  },
  missing,
});

test('a choice is named by its slot, action and what it would lose, never by identity', () => {
  expect(
    describeChoice(
      slot([
        { kind: 'team', id: 'scouts' },
        { kind: 'team', id: 'guards' },
        { kind: 'event', id: 'e-1' },
      ]),
      'campaign',
      names,
    ),
  ).toEqual({
    key: 'activitySlot:two',
    label: 'Activity slot 2',
    action: 'Dismiss Team',
    detail: 'Dismiss Team · uses Scouts, Guards and a missing event',
    before: 'Removing Scouts, Guards and a missing event leaves',
    after: '(Dismiss Team) without 2 teams and an event.',
    href: '/campaigns/campaign/week?phase=activity',
  });
});

test('restoring names the identity when known, else the choice that needs it', () => {
  const unknown = slot([{ kind: 'team', id: 'lost' }]);
  expect(restoreLabel({ kind: 'team', id: 'scouts' }, [], names)).toBe(
    'Restore Scouts',
  );
  expect(restoreLabel({ kind: 'team', id: 'lost' }, [unknown], names)).toBe(
    'Restore missing team for Activity slot 2',
  );
});

test('carried context names what must stay', () => {
  expect(
    carriedDependencyError(
      {
        key: 'queuedEffect:q',
        phase: null,
        location: { kind: 'queuedEffect', effectId: 'q' },
        missing: [{ kind: 'team', id: 'scouts' }],
      },
      names,
    ),
  ).toBe('Keep Scouts: a queued effect still needs it.');
});

// Items and caches (#177).
function economyState() {
  const { state } = acceptedCampaignSetup('officer');
  const snapshot = structuredClone(state.militiaSnapshot);
  snapshot.economy!.items.push({
    itemId: 'ring',
    name: 'Ring',
    valueCopper: 500,
    weight: 0.1,
    location: 'cache',
  });
  snapshot.economy!.caches[0]!.itemIds = ['ring'];
  return snapshot;
}

test('items and caches are named from the militia, then from facts this device saw', () => {
  const snapshot = economyState();
  const seen = rememberFacts(noCapturedFacts, snapshot);
  const removed = {
    ...snapshot,
    economy: { ...snapshot.economy!, items: [], caches: [] },
  };
  for (const names of [
    identityNames(snapshot, noCapturedFacts, new Map()),
    identityNames(removed, seen, new Map()),
  ]) {
    expect(names('item', 'ring')).toBe('Ring');
    expect(names('cache', 'forest-cache')).toBe('Cache at Forest');
  }
  expect(
    identityNames(removed, noCapturedFacts, new Map())('item', 'ring'),
  ).toBeNull();
});

test('a cache whose contents are missing names the items to restore first', () => {
  const names: IdentityNames = (kind, id) =>
    ({ ring: 'Ring', gem: 'Gem' })[id] ?? null;
  expect(restoreFirstNote([{ kind: 'item', id: 'ring' }], names)).toBe(
    'Restore Ring in Items first.',
  );
  expect(
    restoreFirstNote(
      [
        { kind: 'item', id: 'ring' },
        { kind: 'item', id: 'gem' },
      ],
      names,
    ),
  ).toBe('Restore Ring and Gem in Items first.');
  expect(neededByNote(['Activity slot 2', 'Cache at Old Mill'])).toBe(
    'Needed by Activity slot 2 and Cache at Old Mill',
  );
});

test('an item a cache or order holds is named with what holds it, whether this correction or another player removed it', () => {
  const snapshot = economyState();
  const names = identityNames(snapshot, noCapturedFacts, new Map());
  const unknown = 'Unknown referenced entity';
  const descriptors = [
    'state.militiaSnapshot.economy.caches.0.itemIds.0',
    'state.militiaSnapshot.economy.orders.0.itemId',
    'state.militiaSnapshot.economy.orders.0.settlementId',
  ].map((field) => ({ field, message: unknown, kind: 'refinement' as const }));
  const messages = (removing: boolean, carriedOrders = new Set<string>()) =>
    namedItemReferences(descriptors, snapshot, {
      removing,
      carriedOrders,
      names,
    }).map((descriptor) => descriptor.message);
  expect(messages(true)).toEqual([
    'Keep Ring: Cache at Forest holds it.',
    'Keep Sword: an order from Town still needs it.',
    unknown,
  ]);
  expect(messages(false)).toEqual([
    'Cache at Forest holds Ring, which is no longer in the militia.',
    'An order from Town is for Sword, which is no longer in the militia.',
    unknown,
  ]);
  // An order carried into the week is named as carried context instead.
  expect(messages(true, new Set(['sword-order']))).toEqual([
    'Keep Ring: Cache at Forest holds it.',
    unknown,
  ]);
});

test('a condition or carried benefit naming a settlement or character the militia lacks says which, at the list that fixes it', () => {
  const { state } = acceptedCampaignSetup('officer');
  const snapshot = structuredClone(state.militiaSnapshot);
  snapshot.characterActions = {
    people: [
      {
        characterId: 'officer',
        status: 'hidden',
        location: { kind: 'refuge', settlementId: 'mill' },
        directRescueRequired: false,
        capture: null,
      },
    ],
  };
  snapshot.eventBenefits = {
    skills: [
      {
        benefitId: 'b-1',
        sourceEventIds: ['e-1'],
        characterIds: ['officer', 'nara'],
        skills: ['diplomacy'],
        bonusType: 'morale',
        value: 2,
        settlementId: 'mill',
        afterDark: false,
        startsWeek: 9,
        endsWeek: 10,
      },
    ],
    markets: [
      {
        benefitId: 'b-2',
        sourceEventIds: ['e-2'],
        settlementIds: ['town', 'mill'],
        discountPercent: 5,
        startsWeek: 9,
        endsWeek: 9,
      },
    ],
  };
  // This device saw the Old Mill before another player removed it.
  const seen = rememberFacts(noCapturedFacts, {
    ...snapshot,
    settlements: [
      ...snapshot.settlements,
      { ...snapshot.settlements[0]!, settlementId: 'mill', name: 'Old Mill' },
    ],
  });
  const names = identityNames(snapshot, seen, new Map([['nara', 'Nara']]));
  const unknown = 'Unknown referenced entity';
  const path = 'state.militiaSnapshot';
  const named = namedSourceReferences(
    [
      `${path}.characterActions.people.0.location`,
      `${path}.eventBenefits.skills.0.settlementId`,
      `${path}.eventBenefits.skills.0.characterIds.1`,
      `${path}.eventBenefits.markets.0.settlementIds.1`,
      `${path}.economy.orders.0.settlementId`,
    ].map((field) => ({
      field,
      message: unknown,
      kind: 'refinement' as const,
    })),
    snapshot,
    names,
  );
  expect(named.map(({ field, message }) => [field, message])).toEqual([
    [
      `${path}.characterActions.people.0.location`,
      'Character condition 1 names Old Mill, which is no longer in the militia.',
    ],
    [
      `${path}.eventBenefits.skills.0.settlementId`,
      'Skill benefit 1 names Old Mill, which is no longer in the militia.',
    ],
    [
      `${path}.eventBenefits.skills.0.characterIds`,
      'Skill benefit 1 names Nara, which is no longer in the militia.',
    ],
    [
      `${path}.eventBenefits.markets.0.settlementIds`,
      'Market Day benefit 1 names Old Mill, which is no longer in the militia.',
    ],
    [`${path}.economy.orders.0.settlementId`, unknown],
  ]);
  // Two conditions for one character name that character.
  snapshot.characterActions.people.push({
    ...snapshot.characterActions.people[0]!,
  });
  expect(
    namedSourceReferences(
      [
        {
          field: `${path}.characterActions.people`,
          message: 'Duplicate character state',
          kind: 'refinement',
        },
      ],
      snapshot,
      identityNames(snapshot, seen, new Map([['officer', 'Ada']])),
    ).map(({ message }) => message),
  ).toEqual(['Ada has more than one character condition.']);
});
