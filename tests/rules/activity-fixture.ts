import { upkeepFixture, roll } from './upkeep-fixture';
import type { StagedActionChoice } from '../../src/lib/weekly-draft-facts';

export function activityFixture(
  actionId:
    | 'change_officer_role'
    | 'dismiss_team'
    | 'drill_militia'
    | 'recruit_team'
    | 'upgrade_team'
    | 'lie_low',
) {
  const { draft, snapshot } = upkeepFixture();
  snapshot.notoriety = 10;
  snapshot.treasuryCopper = 30000;
  snapshot.roster.teams = [
    {
      teamId: 'team',
      teamType: 'patrons',
      name: 'Team',
      status: 'active',
      managerCharacterId: null,
      rewardCapExempt: false,
      notes: '',
    },
  ];
  const choices: Record<typeof actionId, StagedActionChoice> = {
    change_officer_role: {
      choiceId: 'role',
      actionId: 'change_officer_role',
      characterId: 'pc',
      fromRole: 'ambassador',
      toRole: 'commandant',
    },
    dismiss_team: {
      choiceId: 'dismiss',
      actionId: 'dismiss_team',
      targetTeamId: 'team',
      rolls: { check: roll(20, 6), notoriety: roll(6, 4) },
    },
    drill_militia: {
      choiceId: 'drill',
      actionId: 'drill_militia',
      rolls: { check: roll(20, 10), training: roll(6, 3, 4) },
    },
    recruit_team: {
      choiceId: 'recruit',
      actionId: 'recruit_team',
      teamType: 'informants',
      rolls: { check: roll(20, 10) },
    },
    upgrade_team: {
      choiceId: 'upgrade',
      actionId: 'upgrade_team',
      targetTeamId: 'team',
      toTeamType: 'merchants',
    },
    lie_low: { choiceId: 'low', actionId: 'lie_low' },
  };
  draft.activity.slots[0]!.choice = choices[actionId];
  return { draft, snapshot };
}
