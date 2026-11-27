import { normalizeRawRoll } from './raw-roll';
import type { EventBenefits } from './rules-event-benefits';
import type { CharacterActionState } from './rules-character-state';
import { projectTreasuryIncome } from './rules-treasury';
import type { EconomyState } from './rules-economy-state';
import type { WeeklyDraft } from './weekly-draft-contract';
import {
  projectRulesFoundations,
  type FoundationInput,
} from './rules-foundations';
import type { rawRollSchema } from './weekly-draft-facts';
import type { z } from 'zod';
import { getMinimumTreasuryForRank } from './militia-progression-rules';
import { projectProgression } from './rules-progression';
import { REPUTATION_LEVELS } from './militia-domain';

export type UpkeepSnapshot = Pick<
  FoundationInput,
  | 'rank'
  | 'training'
  | 'focus'
  | 'roster'
  | 'characters'
  | 'settlements'
  | 'bonuses'
> & {
  treasuryCopper: number;
  notoriety: number;
  economy?: EconomyState;
  eventBenefits?: EventBenefits;
  characterActions?: CharacterActionState;
};
type RawRoll = z.infer<typeof rawRollSchema>;
// Upkeep check thresholds (militia-rules.md, Team Conditions and Upkeep).
export const UPKEEP_RULES = {
  attritionDc: 10,
  maximumNotoriety: 100,
  notorietyDc: 15,
  returnDc: 15,
} as const;
// A natural 20 succeeds attrition and gains training; the natural value is
// the raw single die, never the modified total.
export function attritionOutcome(total: number, naturalValue: number | null) {
  if (naturalValue === 20) return 'natural-20' as const;
  return total >= UPKEEP_RULES.attritionDc
    ? ('success' as const)
    : ('failure' as const);
}
// Failing the maximum-notoriety Loyalty check lowers the nearest settlement.
export function notorietyOutcome(total: number) {
  return total >= UPKEEP_RULES.notorietyDc
    ? ('success' as const)
    : ('failure' as const);
}
// Requirements raised by Step 4 (rank, boons, the highest PC level) and
// Step 5 (transfers). Every other Upkeep requirement belongs to an earlier
// step, which rank and transfers wait for.
export function isRankOrTransferRequirement(key: string) {
  return /^(rank:|upkeep:boon:|transfer:|highest-level-pc$)/.test(key);
}
// A missing team returns at the end of the week on DC 15 Security; a natural
// 1 loses it permanently.
export function returnOutcome(total: number, naturalValue: number | null) {
  if (naturalValue === 1) return 'lost' as const;
  return total >= UPKEEP_RULES.returnDc
    ? ('returns' as const)
    : ('stays-missing' as const);
}
type TrainingStep = 'attrition' | 'notoriety' | 'shortage';
export type UpkeepChange =
  | {
      kind: 'boon';
      subjectId: string;
      characterId: string;
      reward: ReturnType<typeof projectProgression>['boons'][number];
      acknowledgement: WeeklyDraft['acknowledgements'][number] | null;
    }
  | { kind: 'consume_bonus'; bonusId: string; week: number }
  | { kind: 'remove_team'; teamId: string }
  | { kind: 'rank'; before: number; after: number }
  | {
      kind: 'treasury';
      sourceId: string;
      before: number;
      after: number;
    }
  | {
      kind: 'team_status';
      teamId: string;
      status: 'active';
      timing: 'start' | 'end';
    }
  | {
      kind: 'settlement_reputation';
      settlementId: string;
      before: string;
      after: string;
    }
  | { kind: 'training'; step: TrainingStep; before: number; after: number };
type UpkeepProjection = {
  skipped: boolean;
  ready: boolean;
  outcome: UpkeepSnapshot;
  plan: UpkeepChange[];
  boons: ReturnType<typeof projectProgression>['boons'];
  // Step 4's inputs once the earlier steps are settled: the training it
  // judged, the highest active PC level capping rank and the rank training
  // alone would reach. Null while an earlier step is open or Upkeep skipped.
  progression: {
    training: number;
    highestPcLevel: number | null;
    trainingRank: number;
  } | null;
  requirements: string[];
  warnings: string[];
  checkUsage: ReturnType<typeof projectRulesFoundations>['checkUsage'];
  checks: ReturnType<typeof projectRulesFoundations>['checks'];
};
function foundationInput(
  draft: WeeklyDraft,
  state: UpkeepSnapshot,
): FoundationInput {
  return {
    ...state,
    week: draft.week,
    slots: draft.activity.slots,
    operatingSettlementId: draft.activity.operatingSettlementId ?? null,
    queuedEffects: upkeepCheckEffects(draft),
    checks: [],
  };
}
function upkeepCheckEffects(
  draft: WeeklyDraft,
): FoundationInput['queuedEffects'] {
  const morale = draft.context.carriedEvents.filter(
    (event) => event.eventType === 'low_morale',
  );
  const sources = new Set(morale.map((event) => event.eventId));
  const queued = draft.context.queuedEffects.filter(
    (effect) =>
      !(
        (sources.has(effect.sourceId) ||
          (morale.length > 0 && effect.eventType === 'low_morale')) &&
        effect.effect.kind === 'check_modifier' &&
        effect.effect.check === 'loyalty'
      ),
  );
  const persistent = morale[0];
  if (persistent)
    queued.push({
      eventType: 'low_morale',
      effectId: `persistent:${persistent.eventId}`,
      sourceId: persistent.eventId,
      startsWeek: draft.week,
      endsWeek: draft.week,
      effect: { kind: 'check_modifier', check: 'loyalty', value: -2 },
    });
  return queued;
}
function dice(
  raw: RawRoll | undefined,
  count: number,
  sides: number,
  id: string,
  result: UpkeepProjection,
) {
  const normalized = normalizeRawRoll(raw, { count, sides });
  if (normalized.status === 'missing') {
    result.requirements.push(`${id}:roll`);
    return null;
  }
  if (normalized.status !== 'complete') {
    result.requirements.push(`${id}:dice:${count}d${sides}`);
    return null;
  }
  if (normalized.rangeWarning) result.warnings.push(`${id}:roll-range`);
  return normalized.diceTotal;
}
function check(
  draft: WeeklyDraft,
  state: UpkeepSnapshot,
  raw: RawRoll | undefined,
  id: string,
  result: UpkeepProjection,
  organizationCheck: 'loyalty' | 'security' = 'loyalty',
) {
  const die = dice(raw, 1, 20, id, result);
  if (die === null) return null;
  const bonusIds =
    raw?.modifiers.flatMap((modifier) =>
      modifier.sourceId.startsWith('bonus:')
        ? [modifier.sourceId.slice(6)]
        : [],
    ) ?? [];
  const facts = projectRulesFoundations({
    ...foundationInput(draft, state),
    checkUsage: result.checkUsage,
    checks: [
      {
        checkId: id,
        phase: 'upkeep',
        check: organizationCheck,
        die,
        bonusIds,
      },
    ],
  });
  result.checkUsage = facts.checkUsage;
  // Safe cast: `projectChecks` maps each requested check to one projected
  // check, and this Upkeep check is the only one requested.
  const projected = facts.checks[0]!;
  applyEnteredModifiers(draft, state, raw, projected);
  result.checks.push(projected);
  const diagnostics = checkDiagnostics(facts, id);
  result.requirements.push(...diagnostics.requirements);
  result.warnings.push(...diagnostics.warnings);
  return projected.total;
}
function applyEnteredModifiers(
  draft: WeeklyDraft,
  state: UpkeepSnapshot,
  raw: RawRoll | undefined,
  projected: UpkeepProjection['checks'][number],
) {
  // A modifier with a calculated source is provenance, not a second addition.
  // One-use selections use bonus:<identity>; foundation checks enforce their use.
  const sources = new Set([
    ...projected.modifiers.map((modifier) => modifier.source),
    ...state.roster.officers.map((officer) => officer.characterId),
    ...draft.context.carriedEvents.map((event) => event.eventId),
    ...state.roster.teams.flatMap((team) =>
      team.managerCharacterId ? [team.managerCharacterId] : [],
    ),
    ...draft.context.queuedEffects.flatMap((effect) => [
      effect.effectId,
      effect.sourceId,
    ]),
  ]);
  for (const modifier of raw?.modifiers ?? []) {
    if (
      sources.has(modifier.sourceId) ||
      /^(bonus|queued|officer|manager):/.test(modifier.sourceId)
    )
      continue;
    sources.add(modifier.sourceId);
    projected.modifiers.push({
      source: modifier.sourceId,
      value: modifier.value,
    });
    projected.modifier += modifier.value;
    if (projected.total !== null) projected.total += modifier.value;
  }
}
function checkDiagnostics(
  facts: ReturnType<typeof projectRulesFoundations>,
  id: string,
) {
  const requirements = facts.requirements.filter(
    (key) =>
      key === 'focus' ||
      key === 'rank' ||
      key.startsWith('officer:') ||
      key.startsWith(`${id}:`),
  );
  const warnings = facts.warnings.filter(
    (key) => key.startsWith(`${id}:`) || key.startsWith('officer:'),
  );
  return { requirements, warnings };
}
function training(result: UpkeepProjection, step: TrainingStep, delta: number) {
  const before = result.outcome.training;
  result.outcome.training = Math.max(0, before + delta);
  result.plan.push({
    kind: 'training',
    step,
    before,
    after: result.outcome.training,
  });
}
function attrition(
  draft: WeeklyDraft,
  state: UpkeepSnapshot,
  result: UpkeepProjection,
) {
  const total = check(
    draft,
    state,
    draft.upkeep.rolls.check,
    'upkeep:attrition',
    result,
  );
  if (total === null) return;
  const outcome = attritionOutcome(
    total,
    normalizeRawRoll(draft.upkeep.rolls.check, { count: 1, sides: 20 })
      .naturalValue,
  );
  const naturalTwenty = outcome === 'natural-20';
  const success = outcome !== 'failure';
  const loss = dice(
    draft.upkeep.rolls.training,
    success ? 1 : 2,
    success ? 6 : 4,
    'upkeep:attrition-training',
    result,
  );
  if (loss !== null)
    training(
      result,
      'attrition',
      naturalTwenty
        ? loss
        : -(loss + (success ? 0 : state.rank)) * lossMultiplier(draft),
    );
}
function notoriety(
  draft: WeeklyDraft,
  state: UpkeepSnapshot,
  result: UpkeepProjection,
) {
  if (state.notoriety < UPKEEP_RULES.maximumNotoriety) return;
  const loss = dice(
    draft.upkeep.rolls.notoriety,
    1,
    20,
    'upkeep:notoriety-training',
    result,
  );
  if (loss !== null)
    training(result, 'notoriety', -(loss + state.rank) * lossMultiplier(draft));
  const total = check(
    draft,
    state,
    draft.upkeep.notorietyCheck,
    'upkeep:notoriety',
    result,
  );
  if (total !== null && notorietyOutcome(total) === 'failure')
    lowerReputation(draft, result);
}
function lowerReputation(draft: WeeklyDraft, result: UpkeepProjection) {
  const settlement = result.outcome.settlements.find(
    (entry) => entry.settlementId === draft.upkeep.nearestSettlementId,
  );
  if (!settlement) {
    result.requirements.push('upkeep:notoriety:nearest-settlement');
    return;
  }
  if (settlement.reputation === null) {
    result.requirements.push('upkeep:notoriety:settlement-reputation');
    return;
  }
  const before = settlement.reputation;
  const index = REPUTATION_LEVELS.indexOf(before);
  // Safe cast: `index > 1` keeps `index - 1` within the reputation levels.
  const after = index > 1 ? REPUTATION_LEVELS[index - 1]! : before;
  settlement.reputation = after;
  result.plan.push({
    kind: 'settlement_reputation',
    settlementId: settlement.settlementId,
    before,
    after,
  });
}
function treasury(result: UpkeepProjection, sourceId: string, delta: number) {
  const before = result.outcome.treasuryCopper;
  result.outcome.treasuryCopper += delta;
  result.plan.push({
    kind: 'treasury',
    sourceId,
    before,
    after: result.outcome.treasuryCopper,
  });
}
function removeTeam(result: UpkeepProjection, teamId: string) {
  result.outcome.roster.teams = result.outcome.roster.teams.filter(
    (team) => team.teamId !== teamId,
  );
  result.plan.push({ kind: 'remove_team', teamId });
}
function recoverTeams(
  draft: WeeklyDraft,
  state: UpkeepSnapshot,
  result: UpkeepProjection,
) {
  for (const decision of draft.upkeep.teamDecisions) {
    if (!state.roster.teams.some((team) => team.teamId === decision.teamId))
      result.requirements.push(`team:${decision.teamId}:reference`);
  }
  for (const team of result.outcome.roster.teams) {
    const decision = draft.upkeep.teamDecisions.find(
      (decision) => decision.teamId === team.teamId,
    );
    if (team.status === 'missing') {
      missingTeam(draft, state, team.teamId, result);
      continue;
    }
    if (team.status !== 'disabled') continue;
    recoverDisabled(draft, team, decision, result);
  }
}
function recoverDisabled(
  draft: WeeklyDraft,
  team: UpkeepSnapshot['roster']['teams'][number],
  decision: WeeklyDraft['upkeep']['teamDecisions'][number] | undefined,
  result: UpkeepProjection,
) {
  if (!decision) {
    result.requirements.push(`team:${team.teamId}:recovery-decision`);
    return;
  }
  if (decision.decision !== 'recover') return;
  const cost = getMinimumTreasuryForRank(result.outcome.rank) * 100;
  if (decision.costCopper !== undefined && decision.costCopper !== cost)
    result.warnings.push(`team:${team.teamId}:recovery-cost-baseline`);
  if (result.outcome.treasuryCopper < cost) {
    result.warnings.push(`team:${team.teamId}:recovery-funds`);
    if (
      !draft.rulesExceptions.some(
        (exception) =>
          exception.subjectId === team.teamId &&
          exception.ruleId === 'upkeep-recovery-funds',
      )
    )
      result.requirements.push(`team:${team.teamId}:recovery-funds-exception`);
  }
  treasury(result, `recovery:${team.teamId}`, -cost);
  team.status = 'active';
  result.plan.push({
    kind: 'team_status',
    teamId: team.teamId,
    status: 'active',
    timing: 'start',
  });
}
function missingTeam(
  draft: WeeklyDraft,
  state: UpkeepSnapshot,
  teamId: string,
  result: UpkeepProjection,
) {
  if (
    draft.context.queuedEffects.some(
      (effect) =>
        effect.effect.kind === 'team_return' &&
        effect.effect.teamId === teamId &&
        effect.endsWeek >= draft.week,
    )
  )
    return;
  const decision = draft.upkeep.teamDecisions.find(
    (decision) => decision.teamId === teamId,
  );
  const total = check(
    draft,
    state,
    decision?.roll,
    `team:${teamId}:return`,
    result,
    'security',
  );
  if (total === null) return;
  const outcome = returnOutcome(
    total,
    normalizeRawRoll(decision?.roll, { count: 1, sides: 20 }).naturalValue,
  );
  if (outcome === 'lost') {
    removeTeam(result, teamId);
  } else if (outcome === 'returns') {
    result.plan.push({
      kind: 'team_status',
      teamId,
      status: 'active',
      timing: 'end',
    });
  }
}
function shortage(
  draft: WeeklyDraft,
  state: UpkeepSnapshot,
  result: UpkeepProjection,
) {
  if (
    result.outcome.treasuryCopper >=
    getMinimumTreasuryForRank(state.rank) * 100
  )
    return;
  const loss = dice(draft.upkeep.rolls.loss, 2, 4, 'upkeep:shortage', result);
  if (loss !== null)
    training(result, 'shortage', -(loss + state.rank) * lossMultiplier(draft));
}
function progression(draft: WeeklyDraft, result: UpkeepProjection) {
  if (result.requirements.length > 0) return;
  const state = result.outcome;
  const progression = projectProgression(
    state.rank,
    state.training,
    state.roster,
    state.characters,
  );
  result.requirements.push(...progression.requirements);
  result.warnings.push(...progression.warnings);
  result.boons = progression.boons;
  result.progression = {
    training: state.training,
    highestPcLevel: progression.highestPcLevel,
    trainingRank: progression.trainingRank,
  };
  if (progression.eligibleRank !== state.rank) {
    result.plan.push({
      kind: 'rank',
      before: state.rank,
      after: progression.eligibleRank,
    });
    state.rank = progression.eligibleRank;
  }
  for (const reward of result.boons) {
    for (const characterId of reward.characterIds) {
      const subjectId = `upkeep:boon:${reward.rank}:${characterId}`;
      const acknowledgement =
        draft.acknowledgements.find((ack) => ack.subjectId === subjectId) ??
        null;
      if (!acknowledgement)
        result.requirements.push(`${subjectId}:acknowledgement`);
      result.plan.push({
        kind: 'boon',
        subjectId,
        characterId,
        reward,
        acknowledgement,
      });
    }
  }
}
// Step 5. The corpus lets only officers transfer; the table approved dropping
// that restriction (#107), so transfers carry no character and need no
// officer (Ruleset Version 6). Withdrawals beyond the running treasury still
// need their own reasoned exception.
function transfers(draft: WeeklyDraft, result: UpkeepProjection) {
  for (const transfer of draft.upkeep.treasuryTransfers) {
    if (
      transfer.direction === 'withdraw' &&
      transfer.copper > result.outcome.treasuryCopper
    ) {
      result.warnings.push(`transfer:${transfer.transferId}:funds`);
      if (
        !draft.rulesExceptions.some(
          (exception) =>
            exception.subjectId === transfer.transferId &&
            exception.ruleId === 'upkeep-transfer-funds',
        )
      )
        result.requirements.push(
          `transfer:${transfer.transferId}:funds-exception`,
        );
    }
    treasury(
      result,
      transfer.transferId,
      transfer.direction === 'deposit' ? transfer.copper : -transfer.copper,
    );
    const income = projectTreasuryIncome(
      transfer.copper,
      draft.context.carriedEvents,
      [],
      draft.week,
    );
    const theftId = income.theftEventIds[0];
    if (theftId && transfer.direction === 'deposit') {
      treasury(
        result,
        `theft:${theftId}:${transfer.transferId}`,
        income.retainedCopper - transfer.copper,
      );
    }
  }
}
export function lossMultiplier(draft: WeeklyDraft) {
  // Week of Pain's Twice clause never compounds the same loss multiplier.
  return Math.max(
    1,
    ...draft.context.queuedEffects.flatMap((queued) =>
      queued.startsWeek <= draft.week &&
      queued.endsWeek >= draft.week &&
      queued.effect.kind === 'upkeep_loss_multiplier'
        ? [queued.effect.value]
        : [],
    ),
  );
}
// Always project from the same week-start snapshot. Previewing never writes it.
export function projectUpkeep(
  draft: WeeklyDraft,
  snapshot: UpkeepSnapshot,
): UpkeepProjection {
  const result: UpkeepProjection = {
    skipped: draft.context.firstMilitiaWeek,
    ready: true,
    outcome: {
      ...snapshot,
      roster: {
        people: snapshot.roster.people.map((person) => ({ ...person })),
        officers: snapshot.roster.officers.map((officer) => ({ ...officer })),
        teams: snapshot.roster.teams.map((team) => ({ ...team })),
      },
      characters: snapshot.characters.map((character) => ({ ...character })),
      settlements: snapshot.settlements.map((settlement) => ({
        ...settlement,
      })),
      bonuses: snapshot.bonuses.map((bonus) => ({ ...bonus })),
    },
    plan: [],
    boons: [],
    progression: null,
    requirements: [],
    warnings: [],
    checks: [],
    checkUsage: {
      bonusIds: [],
      helpful: false,
      overseerEventId: null,
      overseerCharacterId: null,
    },
  };
  if (!result.skipped) {
    recoverTeams(draft, snapshot, result);
    attrition(draft, snapshot, result);
    notoriety(draft, snapshot, result);
    shortage(draft, snapshot, result);
    progression(draft, result);
    transfers(draft, result);
  }
  for (const bonusId of result.checkUsage.bonusIds) {
    // Safe cast: `projectChecks` records only bonuses it found in the
    // snapshot, and `result.outcome.bonuses` copies every snapshot bonus.
    const bonus = result.outcome.bonuses.find(
      (bonus) => bonus.bonusId === bonusId,
    )!;
    bonus.consumedWeek = draft.week;
    result.plan.push({ kind: 'consume_bonus', bonusId, week: draft.week });
  }
  result.requirements = [...new Set(result.requirements)];
  result.warnings = [...new Set(result.warnings)];
  result.ready = result.requirements.length === 0;
  return result;
}

// A check's calculated bonus before its die is entered; once entered, the
// projected check itself.
export function previewUpkeepCheck(
  draft: WeeklyDraft,
  snapshot: UpkeepSnapshot,
  projection: UpkeepProjection,
  checkId: string,
  organizationCheck: 'loyalty' | 'security',
) {
  const projected = projection.checks.find(
    (check) => check.checkId === checkId,
  );
  if (projected) return projected;
  const [preview] = projectRulesFoundations({
    ...foundationInput(draft, snapshot),
    checks: [{ checkId, phase: 'upkeep', check: organizationCheck }],
  }).checks;
  if (!preview) throw new Error(`No preview for ${checkId}`);
  return preview;
}

// Input affordances share the rule model; presentation supplies only raw dice.
export function upkeepInputFacts(draft: WeeklyDraft, snapshot: UpkeepSnapshot) {
  const projection = projectUpkeep(draft, snapshot);
  const attritionCheck = projection.checks.find(
    (check) => check.checkId === 'upkeep:attrition',
  );
  const previewCheck = (id: string) =>
    previewUpkeepCheck(draft, snapshot, projection, id, 'loyalty');
  const fields: {
    field: 'check' | 'training' | 'notoriety' | 'loss' | 'notorietyCheck';
    count: number;
    sides: number;
    dc: number | null;
    check: ReturnType<typeof previewCheck> | null;
  }[] = [];
  if (!projection.skipped) {
    fields.push({
      field: 'check',
      count: 1,
      sides: 20,
      dc: UPKEEP_RULES.attritionDc,
      check: previewCheck('upkeep:attrition'),
    });
    if (attritionCheck?.total !== null && attritionCheck?.total !== undefined) {
      const success =
        attritionOutcome(
          attritionCheck.total,
          normalizeRawRoll(draft.upkeep.rolls.check, { count: 1, sides: 20 })
            .naturalValue,
        ) !== 'failure';
      fields.push({
        field: 'training',
        count: success ? 1 : 2,
        sides: success ? 6 : 4,
        dc: null,
        check: null,
      });
    }
    if (snapshot.notoriety >= UPKEEP_RULES.maximumNotoriety)
      fields.push(
        { field: 'notoriety', count: 1, sides: 20, dc: null, check: null },
        {
          field: 'notorietyCheck',
          count: 1,
          sides: 20,
          dc: UPKEEP_RULES.notorietyDc,
          check: previewCheck('upkeep:notoriety'),
        },
      );
    if (
      projection.requirements.some((key) =>
        key.startsWith('upkeep:shortage'),
      ) ||
      projection.plan.some(
        (change) => change.kind === 'training' && change.step === 'shortage',
      )
    )
      fields.push({ field: 'loss', count: 2, sides: 4, dc: null, check: null });
  }
  return {
    projection,
    fields,
    minimumTreasuryCopper: getMinimumTreasuryForRank(snapshot.rank) * 100,
  };
}
