import { recurringEventFixture } from './recurring-event-fixture';
import { roll } from './upkeep-fixture';
import type { WeekStartFacts } from '../../src/lib/weekly-draft-contract';
export function persistentEventFixture(
  type: WeekStartFacts['carriedEvents'][number]['eventType'] = 'rivalry',
) {
  const { draft, snapshot } = recurringEventFixture(46);
  draft.week = 2;
  draft.upkeep.rolls.check = roll(20, 19);
  draft.upkeep.rolls.training = roll(6, 1);
  draft.context = {
    ...draft.context,
    firstMilitiaWeek: false,
    startDay: 7,
    persistentPhaseEligible: true,
    carriedEvents: [
      {
        eventId: 'carried',
        eventType: type,
        startedWeek: 1,
        order: 0,
        targets:
          type === 'rivalry'
            ? [
                { kind: 'team', teamId: 'team' },
                { kind: 'team', teamId: 'second-team' },
              ]
            : [],
      },
    ],
  };
  snapshot.roster.officers = [{ role: 'overseer', characterId: 'pc' }];
  return { draft, snapshot };
}
