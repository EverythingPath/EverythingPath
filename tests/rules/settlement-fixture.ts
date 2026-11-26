import { economyFixture } from './economy-fixture';
import { roll } from './upkeep-fixture';
import type { StagedActionChoice } from '../../src/lib/weekly-draft-facts';
export type SettlementAction =
  | 'activate_refuge'
  | 'reduce_danger'
  | 'spread_propaganda';
export function settlementFixture(actionId: SettlementAction) {
  const { draft, snapshot } = economyFixture('earn_gold');
  snapshot.focus = 'Loyalty';
  snapshot.settlements[0]!.reputation = 'Hostile';
  snapshot.settlements[0]!.secured = true;
  snapshot.roster.teams[0]!.teamType =
    actionId === 'activate_refuge'
      ? 'conspirators'
      : actionId === 'reduce_danger'
        ? 'defenders'
        : 'propagandists';
  const choice: Extract<StagedActionChoice, { actionId: SettlementAction }> =
    actionId === 'spread_propaganda'
      ? {
          actionId,
          choiceId: 'settlement',
          teamId: 'team',
          settlementId: 'town',
          acknowledgements: [
            {
              acknowledgementId: 'permission',
              subjectId: 'propaganda:settlement',
              outcome: 'The GM confirms this town can be influenced.',
            },
          ],
          rolls: { check: roll(20, 17) },
        }
      : {
          actionId,
          choiceId: 'settlement',
          teamId: 'team',
          settlementId: 'town',
          ...(actionId === 'reduce_danger'
            ? { rolls: { check: roll(20, 14) } }
            : {}),
        };
  draft.activity.slots[0]!.choice = choice;
  return { draft, snapshot, choice };
}
