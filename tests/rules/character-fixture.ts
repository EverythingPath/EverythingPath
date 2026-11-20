import { economyFixture } from './economy-fixture';
import { roll } from './upkeep-fixture';
import type { StagedActionChoice } from '../../src/lib/weekly-draft-facts';
export type CharacterAction =
  | 'rescue_character'
  | 'restore_character'
  | 'gather_information'
  | 'knowledge_check'
  | 'strike_team'
  | 'special';
export function characterFixture(actionId: CharacterAction) {
  const { draft, snapshot } = economyFixture('earn_gold');
  snapshot.roster.officers = [];
  snapshot.roster.teams[0]!.teamType =
    actionId === 'restore_character'
      ? 'spellcasters'
      : actionId === 'knowledge_check' || actionId === 'gather_information'
        ? 'scholars'
        : 'specialists';
  snapshot.characterActions = {
    people: snapshot.roster.people.map((entry) => ({
      characterId: entry.characterId,
      status: actionId === 'rescue_character' ? 'captured' : 'available',
      location: { kind: 'headquarters' },
      directRescueRequired: false,
      capture:
        actionId === 'rescue_character'
          ? { source: 'ordinary', week: draft.week - 1 }
          : null,
    })),
  };
  const choices: Record<CharacterAction, StagedActionChoice> = {
    rescue_character: {
      choiceId: 'character',
      actionId: 'rescue_character',
      teamId: 'team',
      characterId: 'pc',
      destination: { kind: 'headquarters' },
      rolls: { check: roll(20, 20) },
    },
    restore_character: {
      choiceId: 'character',
      actionId: 'restore_character',
      teamId: 'team',
      characterId: 'pc',
      mode: 'restoration',
      targetPresent: true,
    },
    gather_information: {
      choiceId: 'character',
      actionId: 'gather_information',
      teamId: 'team',
      subject: 'Enemy location',
      rolls: { check: roll(20, 10) },
    },
    knowledge_check: {
      choiceId: 'character',
      actionId: 'knowledge_check',
      teamId: 'team',
      subject: 'Identify wand',
      rolls: { check: roll(20, 10) },
    },
    strike_team: {
      choiceId: 'character',
      actionId: 'strike_team',
      teamId: 'team',
      mode: 'support',
      location: 'Old fort',
    },
    special: {
      choiceId: 'character',
      actionId: 'special',
      instruction: 'Negotiate passage',
      costCopper: 0,
    },
  };
  const choice = choices[actionId];
  choice.acknowledgements = [
    {
      acknowledgementId: 'outcome',
      subjectId: `${actionId}:character`,
      outcome: 'The table records the result and prescribed effects.',
    },
  ];
  draft.activity.slots[0]!.choice = choice;
  return { draft, snapshot, choice };
}
