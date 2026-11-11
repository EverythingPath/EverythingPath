import { activityFixture } from './activity-fixture';
import { roll } from './upkeep-fixture';
import type { WeeklyDraft } from '../../src/lib/weekly-draft-contract';
import type { StagedActionChoice } from '../../src/lib/weekly-draft-facts';
export function eventActionFixture(
  actionId:
    | 'covert_action'
    | 'guarantee_event'
    | 'manipulate_events'
    | 'sabotage' = 'guarantee_event',
) {
  const { draft, snapshot } = activityFixture('drill_militia');
  draft.activity.operatingSettlementId = 'town';
  snapshot.settlements = [
    {
      settlementId: 'town',
      name: 'Town',
      reputation: 'Indifferent',
      secured: true,
      occupied: false,
      temporaryReputationShift: 0,
      refugeActivatedWeek: 39,
      refugeActiveUntilWeek: 41,
    },
  ];
  snapshot.roster.officers = [];
  snapshot.characters[0]!.charisma = 16;
  snapshot.roster.teams[0]!.teamType =
    actionId === 'covert_action'
      ? 'spies'
      : actionId === 'manipulate_events'
        ? 'guardians'
        : 'saboteurs';
  snapshot.roster.teams[0]!.managerCharacterId = 'pc';
  const candidate = (
    eventId: string,
    value: number,
  ): WeeklyDraft['event']['occurrences'][number] => ({
    eventId,
    origin: { kind: 'rolled' },
    tableRoll: roll(100, value),
  });
  const choices: Record<
    Exclude<typeof actionId, 'sabotage'>,
    StagedActionChoice
  > = {
    covert_action: {
      choiceId: 'shape',
      actionId: 'covert_action',
      teamId: 'team',
      mode: 'augment',
      followingChoiceId: 'drill',
    },
    guarantee_event: {
      choiceId: 'shape',
      actionId: 'guarantee_event',
      rolls: { notoriety: roll(6, 3) },
      candidates: [candidate('raid', 78), candidate('theft', 74)],
      selectedEventId: 'raid',
    },
    manipulate_events: {
      choiceId: 'shape',
      actionId: 'manipulate_events',
      teamId: 'team',
      candidates: [candidate('raid', 78), candidate('theft', 74)],
      selectedEventId: 'raid',
    },
  };
  const choice =
    choices[actionId === 'sabotage' ? 'guarantee_event' : actionId];
  choice.acknowledgements = [
    {
      acknowledgementId: 'receipt',
      subjectId: `${choice.actionId}:shape`,
      outcome: 'Recorded choice at the table.',
    },
  ];
  const drill = draft.activity.slots[0]!.choice;
  draft.activity.slots = [
    { slotId: 'one', choice },
    { slotId: 'two', choice: actionId === 'covert_action' ? drill : null },
  ];
  if (actionId === 'sabotage' && choice.actionId === 'guarantee_event') {
    choice.candidates![0]!.sabotage = {
      choiceId: 'react',
      teamId: 'team',
      check: 'secrecy',
      rolls: { check: roll(20, 14), notoriety: roll(6, 4) },
    };
    draft.acknowledgements.push({
      acknowledgementId: 'react-receipt',
      subjectId: 'sabotage:raid:react',
      outcome: 'The raid was disrupted.',
    });
  }
  return { draft, snapshot, choice };
}
