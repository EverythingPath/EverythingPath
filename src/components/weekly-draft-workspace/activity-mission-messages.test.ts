import { expect, test } from 'vitest';
import { activityWarning } from './activity-warnings';
import { missionCodeMessage } from './activity-mission-messages';
import { subjectMessage } from './summary-messages';

test('[rules.ACT-17.mission-codes] mission codes are worded for their action, a missing record differs from its Rules Exception, and other actions keep their wording', () => {
  const message = (
    code: string,
    actionId: Parameters<typeof subjectMessage>[3],
  ) => subjectMessage(`c:${code}`, 'c', false, actionId);
  expect(message('settlement-secured', 'reduce_danger')).toBe(
    'Whether the settlement is secured is not recorded. Record it in Militia corrections.',
  );
  expect(message('settlement-secured:exception', 'reduce_danger')).toBe(
    'Reduce Danger normally needs a secured settlement. Record a reasoned Rules Exception or revise the choice.',
  );
  expect(message('propaganda-limit:exception', 'spread_propaganda')).toBe(
    'An earlier choice already spreads propaganda in this settlement this Activity. Record a reasoned Rules Exception or revise the choice.',
  );
  expect(message('refuge-reputation:exception', 'activate_refuge')).toMatch(
    /^A refuge normally needs a Hostile or Unfriendly settlement\./,
  );
  expect(message('location', 'covert_action')).toBe(
    'Name the adventure site for the contact or cache.',
  );
  expect(message('location', 'strike_team')).toBe(
    'Name the location the Strike Team targets.',
  );
  expect(message('immediately-following-choice', 'covert_action')).toBe(
    'Choose the choice in the next occupied Action Slot to augment.',
  );
  expect(message('subject', 'knowledge_check')).toBe(
    'Name what the team wants to know.',
  );
  expect(message('cost', 'special')).toBe(
    'Enter this action’s cost; enter 0 when it costs nothing.',
  );
  for (const code of [
    'acknowledgement',
    'acknowledgement:gather_information:c',
    'acknowledgement:propaganda:c',
  ])
    expect(message(code, 'gather_information')).toBe(
      'Record what happened at the table.',
    );
  // The rolls and team rules keep their shared wording.
  expect(message('notoriety:1d6', 'guarantee_event')).toBe(
    'Notoriety roll: enter 1d6.',
  );
  expect(message('team-action:exception', 'strike_team')).toBe(
    'This team does not normally perform this action. Record a reasoned Rules Exception or revise the choice.',
  );
  // Another action's code is not reworded here.
  expect(missionCodeMessage('mode', 'restore_character')).toBeNull();
  expect(message('mode', 'restore_character')).toBe('Choose a mode.');
  expect(
    activityWarning('c:settlement-occupied', 'c', 'spread_propaganda'),
  ).toBe(
    'The recorded Occupied answer differs from the settlement’s record; the rules use the settlement’s record.',
  );
});
