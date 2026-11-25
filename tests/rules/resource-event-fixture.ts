import {
  eventSelectionFixture,
  occurrence,
  pair,
} from './event-selection-fixture';
export function resourceEventFixture(value = 10, twice = false) {
  const { draft, snapshot } = eventSelectionFixture();
  snapshot.economy!.items = [
    {
      itemId: 'mystery',
      name: 'Unknown relic',
      valueCopper: 100000,
      weight: 1,
      location: 'held',
    },
  ];
  draft.event.occurrences = twice ? pair(value) : [occurrence('event', value)];
  for (const event of draft.event.occurrences.filter(
    (event) => event.eventId !== 'root',
  )) {
    draft.acknowledgements.push({
      acknowledgementId: `receipt:${event.eventId}`,
      subjectId: `event:${event.eventId}`,
      outcome: 'The table records the result.',
    });
    if (value === 18) event.targets = [{ kind: 'item', itemId: 'mystery' }];
    if (value === 34 || value === 38)
      event.targets = [{ kind: 'settlement', settlementId: 'town' }];
    if (value === 30) event.targets = [{ kind: 'team', teamId: 'team' }];
    if (value === 22)
      event.rewards = [
        {
          itemId: `reward:${event.eventId}`,
          characterId: 'pc',
          name: 'Alchemist fire',
          valueCopper: 10000,
          weight: 1,
          alchemical: true,
          poison: false,
        },
      ];
  }
  return { draft, snapshot };
}
