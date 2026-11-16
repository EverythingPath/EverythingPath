import type { RawRoll } from '~/lib/weekly-draft-facts';
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import type { UpkeepDisabledTeam } from './types';

// Sends one Weekly Draft edit through the shared ordered store.
export type UpkeepEdit = (edit: WeeklyDraftEdit) => unknown;

// Weekly Draft edits behind the Upkeep team controls. Each goes through the
// existing `upkeep_team` operation, so its atomic recovery adjustment and
// latest-edit-wins ordering are unchanged.

// Recover at the rules cost (the decision's cost); a different agreed price
// is the reasoned post-baseline adjustment, and the rules price clears it.
export function recoverTeam(
  team: UpkeepDisabledTeam,
  price: { copper: number; reason: string } = {
    copper: team.rulesCostCopper,
    reason: '',
  },
): WeeklyDraftEdit {
  const deltaCopper = team.rulesCostCopper - price.copper;
  return {
    kind: 'upkeep_team',
    teamId: team.teamId,
    decision: {
      teamId: team.teamId,
      decision: 'recover',
      costCopper: team.rulesCostCopper,
    },
    recoveryAdjustment:
      deltaCopper === 0 ? null : { deltaCopper, reason: price.reason },
  };
}

// Leaving a team disabled also removes its recovery adjustment and any
// recorded ruling for recovering beyond the treasury.
export function leaveTeamDisabled(team: UpkeepDisabledTeam): WeeklyDraftEdit[] {
  const ruling = team.fundsException;
  return [
    {
      kind: 'upkeep_team',
      teamId: team.teamId,
      decision: { teamId: team.teamId, decision: 'leave' },
    },
    ...(ruling && !ruling.required
      ? [clearRulesException(ruling.exceptionId)]
      : []),
  ];
}

// A missing team's return check is stored on its (leave) decision; a blank
// clears the roll and keeps the decision.
export function recordReturnRoll(
  teamId: string,
  roll: RawRoll | null,
): WeeklyDraftEdit {
  return {
    kind: 'upkeep_team',
    teamId,
    decision: { teamId, decision: 'leave', ...(roll ? { roll } : {}) },
  };
}

// Clears a staged decision for a team no longer on the roster.
export function clearTeamDecision(teamId: string): WeeklyDraftEdit[] {
  return [{ kind: 'upkeep_team', teamId, decision: null }];
}

export function recordRecoveryFundsException(
  team: UpkeepDisabledTeam,
  reason: string,
): WeeklyDraftEdit | null {
  if (!team.fundsException) return null;
  return {
    kind: 'rules_exception',
    exception: {
      exceptionId: team.fundsException.exceptionId,
      subjectId: team.teamId,
      ruleId: 'upkeep-recovery-funds',
      reason,
    },
  };
}

export function clearRulesException(exceptionId: string): WeeklyDraftEdit {
  return { kind: 'clear_rules_exception', exceptionId };
}
