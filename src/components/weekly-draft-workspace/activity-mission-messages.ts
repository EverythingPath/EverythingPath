import type { StagedActionChoice } from '~/lib/weekly-draft-facts';
import { isMissionActionId } from './activity-mission-actions';

// Wording for the information, mission and event-influence actions' rules
// codes. A code is matched whole, including an `:exception` ending, because
// the same key can mean a missing record (`settlement-secured`) or a rules
// departure that needs a reasoned exception (`settlement-secured:exception`).

type ActionId = StagedActionChoice['actionId'];

const EXCEPTION = 'Record a reasoned Rules Exception or revise the choice.';
const HAPPENED = 'Record what happened at the table.';

const shared: Record<string, string> = {
  team: 'Choose the acting team.',
  manager:
    'The team’s recorded manager is no longer on the roster. Repair the team in Militia corrections.',
  settlement: 'Choose the target settlement.',
  'settlement-reputation':
    'The settlement’s reputation is not recorded. Record it in Militia corrections.',
  'settlement-secured':
    'Whether the settlement is secured is not recorded. Record it in Militia corrections.',
  'settlement-secured:exception': `Reduce Danger normally needs a secured settlement. ${EXCEPTION}`,
  'settlement-occupied':
    'Whether enemies occupy the settlement is not recorded. Record it in Militia corrections.',
  'propaganda-limit:exception': `An earlier choice already spreads propaganda in this settlement this Activity. ${EXCEPTION}`,
  'refuge-reputation:exception': `A refuge normally needs a Hostile or Unfriendly settlement. ${EXCEPTION}`,
  location: 'Name the location.',
  instruction: 'Record the GM’s instruction for this action.',
  cost: 'Enter this action’s cost; enter 0 when it costs nothing.',
  subject: 'Name the subject.',
};

const byAction: Partial<Record<ActionId, Record<string, string>>> = {
  gather_information: {
    subject: 'Name what the team gathers information about.',
  },
  knowledge_check: {
    subject: 'Name what the team wants to know.',
  },
  covert_action: {
    mode: 'Choose augment, contact or cache.',
    location: 'Name the adventure site for the contact or cache.',
    'immediately-following-choice':
      'Choose the choice in the next occupied Action Slot to augment.',
  },
  strike_team: {
    mode: 'Choose support or extraction.',
    location: 'Name the location the Strike Team targets.',
  },
};

const warnings: Record<string, string> = {
  'settlement-occupied':
    'The recorded Occupied answer differs from the settlement’s record; the rules use the settlement’s record.',
};

/**
 * The wording for `code` (the part after the choice identity) of an
 * information, mission or event-influence choice, or null when the code
 * belongs to another action or has no wording here.
 */
export function missionCodeMessage(
  code: string,
  actionId: ActionId | undefined,
  warning = false,
) {
  if (!actionId || !isMissionActionId(actionId)) return null;
  if (warning) return warnings[code] ?? null;
  if (code === 'acknowledgement' || code.startsWith('acknowledgement:'))
    return HAPPENED;
  return byAction[actionId]?.[code] ?? shared[code] ?? null;
}
