import type { StagedActionChoice } from '~/lib/weekly-draft-facts';

// The information, mission and event-influence actions, which share one
// detail editor in the selected slot.
export const MISSION_ACTIONS = [
  'gather_information',
  'knowledge_check',
  'covert_action',
  'special',
  'spread_propaganda',
  'strike_team',
  'activate_refuge',
  'reduce_danger',
  'guarantee_event',
  'manipulate_events',
] as const satisfies readonly StagedActionChoice['actionId'][];
export type MissionActionId = (typeof MISSION_ACTIONS)[number];
export type MissionChoice = Extract<
  StagedActionChoice,
  { actionId: MissionActionId }
>;

export function isMissionActionId(
  actionId: StagedActionChoice['actionId'],
): actionId is MissionActionId {
  const actions: readonly string[] = MISSION_ACTIONS;
  return actions.includes(actionId);
}
export function isMissionChoice(
  choice: StagedActionChoice,
): choice is MissionChoice {
  return isMissionActionId(choice.actionId);
}
