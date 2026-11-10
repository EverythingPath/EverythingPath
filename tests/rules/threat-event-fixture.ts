import { resourceEventFixture } from './resource-event-fixture';
import { roll } from './upkeep-fixture';
export function threatEventFixture(value = 62, twice = false) {
  const { draft, snapshot } = resourceEventFixture(value, twice);
  snapshot.roster.officers =
    value === 58 ? [{ role: 'overseer', characterId: 'pc' }] : [];
  snapshot.characters[0]!.wisdom = 14;
  snapshot.economy!.items = [
    {
      itemId: 'supplies',
      name: 'Supplies',
      valueCopper: 1000,
      weight: 1,
      location: 'cache',
    },
    {
      itemId: 'other-supplies',
      name: 'Other supplies',
      valueCopper: 1000,
      weight: 1,
      location: 'returning',
    },
  ];
  snapshot.economy!.caches = [
    {
      cacheId: 'cache',
      cacheClass: 'minor',
      location: 'Bridge',
      secure: false,
      extradimensional: false,
      itemIds: ['supplies'],
      status: 'hidden',
      returnActivityWeek: null,
    },
    {
      cacheId: 'returning',
      cacheClass: 'minor',
      location: 'Road',
      secure: false,
      extradimensional: false,
      itemIds: ['other-supplies'],
      status: 'returning',
      returnActivityWeek: 41,
    },
  ];
  snapshot.characterActions = {
    people: [
      {
        characterId: 'pc',
        status: 'hidden',
        location: { kind: 'refuge', settlementId: 'town' },
        directRescueRequired: false,
        capture: null,
      },
    ],
  };
  if (value === 70)
    draft.activity.slots = [
      {
        slotId: 'one',
        choice: {
          choiceId: 'work',
          actionId: 'special',
          teamId: 'team',
          instruction: 'Patrol',
          costCopper: 0,
          acknowledgements: [
            {
              acknowledgementId: 'work',
              subjectId: 'special:work',
              outcome: 'Patrolled',
            },
          ],
        },
      },
    ];
  for (const event of draft.event.occurrences.filter(
    (event) => event.eventId !== 'root',
  )) {
    if (value === 62) event.targets = [{ kind: 'cache', cacheId: 'cache' }];
    if (value === 70 || value === 90)
      event.targets = [{ kind: 'team', teamId: 'team' }];
    if (value === 82) event.averagePartyLevel = 7;
    if (value === 78)
      event.targets = [{ kind: 'settlement', settlementId: 'town' }];
    if (value === 90 && event.eventId === 'second')
      event.rolls = { check: roll(20, 17) };
    if (value === 58) {
      if (event.eventId === 'second') {
        event.targets = [{ kind: 'team', teamId: 'team' }];
        event.officerCheck = {
          characterId: 'pc',
          skill: 'diplomacy',
          skillBonus: 3,
          roll: roll(20, 10),
        };
      } else event.rolls = { loss: roll(6, 4) };
    }
  }
  return { draft, snapshot };
}
