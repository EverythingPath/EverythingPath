import { recurringEventFixture } from './recurring-event-fixture';
import { persistentEventFixture } from './persistent-event-fixture';
import { occurrence } from './event-selection-fixture';
import { roll } from './upkeep-fixture';
import { resourceEventFixture } from './resource-event-fixture';
import { threatEventFixture } from './threat-event-fixture';

// Ready sources shared by the behavioral assertions and actual adapter parity.
export function eventAcceptanceFixtures() {
  const storm = recurringEventFixture(54, true);
  storm.draft.context = { ...storm.draft.context, firstMilitiaWeek: true };

  const buyoff = persistentEventFixture('double_agent');
  buyoff.snapshot.training = 15;
  buyoff.draft.persistent.decisions = [{ eventId: 'carried', kind: 'buyoff' }];

  const morale = recurringEventFixture(26, true);
  morale.draft.context = {
    ...morale.draft.context,
    firstMilitiaWeek: true,
    persistentPhaseEligible: true,
    carriedEvents: ['older', 'later', 'newest'].map((eventId, order) => ({
      eventId,
      eventType: 'low_morale' as const,
      startedWeek: 39,
      order,
      targets: [],
    })),
  };
  const queue = recurringEventFixture(46);
  queue.draft.context = {
    ...queue.draft.context,
    firstMilitiaWeek: true,
    queuedEffects: [
      {
        effectId: 'due',
        sourceId: 'storm-source',
        startsWeek: 40,
        endsWeek: 40,
        effect: { kind: 'automatic_events', count: 2 },
      },
      {
        effectId: 'future',
        sourceId: 'future-source',
        startsWeek: 42,
        endsWeek: 42,
        effect: { kind: 'event_chance', value: 7 },
      },
      {
        effectId: 'expired',
        sourceId: 'old-source',
        startsWeek: 38,
        endsWeek: 39,
        effect: { kind: 'event_chance', value: 80 },
      },
    ],
  };
  queue.draft.event.occurrences.unshift(
    occurrence('auto-one', 10, { kind: 'automatic', sourceId: 'storm-source' }),
    occurrence('auto-two', 10, { kind: 'automatic', sourceId: 'storm-source' }),
  );
  queue.draft.event.chanceRoll = roll(100, 1);

  const fixtures = Object.entries({ storm, buyoff, morale, queue }).map(
    ([name, { draft, snapshot }]) => ({
      name,
      input: { revision: draft, militiaSnapshot: snapshot },
    }),
  );
  for (const group of [
    { create: resourceEventFixture, values: [46, 18, 34, 22, 38, 14, 30, 10] },
    {
      create: recurringEventFixture,
      values: [54, 98, 42, 26, 86, 66, 74, 100, 2],
    },
    { create: threatEventFixture, values: [62, 82, 70, 78, 90, 58] },
  ])
    for (const value of group.values)
      for (const twice of [false, true]) {
        const { draft, snapshot } = group.create(value, twice);
        draft.context = {
          ...draft.context,
          firstMilitiaWeek: true,
          operatedSettlementIds: ['town'],
        };
        if (value === 78 && twice) {
          snapshot.settlements.push({
            ...snapshot.settlements[0]!,
            settlementId: 'second-town',
            name: 'Second town',
          });
          draft.event.occurrences[2]!.targets = [
            { kind: 'settlement', settlementId: 'second-town' },
          ];
        }
        fixtures.push({
          name: `event-${value}-${twice ? 'twice' : 'base'}`,
          input: { revision: draft, militiaSnapshot: snapshot },
        });
      }
  return fixtures;
}
