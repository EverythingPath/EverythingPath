import { resourceEventFixture } from './resource-event-fixture';
export function recurringEventFixture(value = 54, twice = false) {
  const { draft, snapshot } = resourceEventFixture(value, twice);
  if (value === 66)
    for (const event of draft.event.occurrences.filter(
      (event) => event.eventId !== 'root',
    ))
      event.targets = [
        { kind: 'team', teamId: 'team' },
        { kind: 'team', teamId: 'second-team' },
      ];
  return { draft, snapshot };
}
