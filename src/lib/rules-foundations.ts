import { projectProgression } from './rules-progression';
import {
  projectSettlements,
  projectPurchases,
  type FoundationPurchase,
} from './rules-settlements';
import { projectTeams, type ActivityTeamUse } from './rules-teams';
import {
  projectOfficers,
  type FoundationCharacter,
  type OrganizationCheck,
} from './rules-officers';
import { projectChecks, type CheckUsage } from './rules-checks';
import type { CanonicalRoster } from './canonical-roster';
import type {
  ContextBonus,
  ContextSettlement,
} from './canonical-campaign-context';
import type { QueuedEffect, StagedActionChoice } from './weekly-draft-facts';
import {
  getOrganizationCheckBonusesForMilitia,
  getAdvancementForRank,
  getMinimumTreasuryForRank,
  type MilitiaFocusCheck,
} from './militia-progression-rules';

export type FoundationCheck = {
  checkId: string;
  phase: 'upkeep' | 'activity' | 'event' | 'persistent';
  check: OrganizationCheck;
  die?: number;
  choiceId?: string;
  teamId?: string;
  eventId?: string;
  overseerCharacterId?: string;
  helpful?: boolean;
  bonusIds?: string[];
};
export type FoundationInput = {
  rank: number;
  training: number;
  focus: MilitiaFocusCheck | null;
  week: number;
  roster: CanonicalRoster;
  characters: FoundationCharacter[];
  slots: { slotId: string; choice: StagedActionChoice | null }[];
  checks: FoundationCheck[];
  checkUsage?: CheckUsage;
  activity?: ActivityTeamUse;
  purchases?: FoundationPurchase[];
  settlements: ContextSettlement[];
  operatingSettlementId: string | null;
  bonuses: ContextBonus[];
  queuedEffects: QueuedEffect[];
};

// Input is the current projected state at this point in the week, not the
// immutable week-start roster. This function never executes phase transitions.
export function projectRulesFoundations(input: FoundationInput) {
  const row = getAdvancementForRank(input.rank);
  const requirements: string[] = [];
  if (!row) requirements.push('rank');
  if (!input.focus) requirements.push('focus');
  const progression = projectProgression(
    input.rank,
    input.training,
    input.roster,
    input.characters,
  );
  requirements.push(...progression.requirements);
  const teamProjection = projectTeams(
    input.roster,
    input.characters,
    input.activity,
  );
  requirements.push(...teamProjection.requirements);
  const officers = projectOfficers(input.roster, input.characters, input.focus);
  requirements.push(...officers.requirements);
  const actions = (row?.actions ?? 0) + (officers.strategistAssigned ? 1 : 0);
  const base = getOrganizationCheckBonusesForMilitia(input);
  const organizationChecks = {
    loyalty: base.loyalty + officers.bonuses.loyalty,
    secrecy: base.secrecy + officers.bonuses.secrecy,
    security: base.security + officers.bonuses.security,
  };
  const settlementProjection = projectSettlements(
    input.settlements,
    input.week,
  );
  requirements.push(...settlementProjection.requirements);
  const operating = settlementProjection.settlements.find(
    (x) => x.settlementId === input.operatingSettlementId,
  );
  if (input.operatingSettlementId && !operating)
    requirements.push('operating-settlement');
  const purchases = projectPurchases(
    input.purchases ?? [],
    settlementProjection.settlements,
  );
  for (const purchase of purchases)
    if (purchase.costCopper === null)
      requirements.push(`purchase:${purchase.purchaseId}:settlement`);
  const checkProjection = projectChecks(input, {
    officers,
    teams: teamProjection.teams,
    operating,
    base,
    row,
  });
  requirements.push(...checkProjection.requirements);
  const countedTeams = input.roster.teams.filter(
    (x) => !x.rewardCapExempt,
  ).length;
  const slots = input.slots.map((slot, index) => ({
    ...slot,
    overAllowance: index >= actions && slot.choice !== null,
  }));
  const warnings = [
    ...checkProjection.warnings,
    ...progression.warnings,
    ...officers.warnings,
    ...teamProjection.warnings,
  ];
  if (countedTeams > (row?.teams ?? 0)) warnings.push('teams:capacity');
  for (const slot of slots)
    if (slot.overAllowance) warnings.push(`slot:${slot.slotId}:capacity`);
  return {
    requirements,
    officers,
    settlements: settlementProjection.settlements,
    eventChanceModifier:
      input.operatingSettlementId === null
        ? 0
        : (operating?.eventChanceModifier ?? null),
    purchases,
    minimumTreasuryCopper: getMinimumTreasuryForRank(input.rank) * 100,
    strikeTeamRounds: Math.floor(input.rank / 2),
    teams: teamProjection.teams,
    warnings,
    checks: checkProjection.checks,
    checkUsage: checkProjection.usage,
    progression,
    capacity: { actions, teams: row?.teams ?? 0, countedTeams },
    organizationChecks,
    slots,
  };
}
