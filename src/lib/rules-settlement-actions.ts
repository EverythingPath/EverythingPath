import { REPUTATION_LEVELS, type TEAM_IDS } from './militia-domain';
import type { ActivityProjection } from './rules-activity';
import type { ActivityHelpers } from './rules-economy';
import type { WeeklyDraft } from './weekly-draft-contract';
import type { StagedActionChoice } from './weekly-draft-facts';
import { projectSettlements } from './rules-settlements';

type Settlement = ActivityProjection['outcome']['settlements'][number];
type Choice = Extract<
  StagedActionChoice,
  { actionId: 'activate_refuge' | 'reduce_danger' | 'spread_propaganda' }
>;
export type SettlementChange =
  | {
      kind: 'settlement';
      choiceId: string;
      before: Settlement;
      after: Settlement;
    }
  | {
      kind: 'settlement_benefit';
      choiceId: string;
      settlementId: string;
      benefit: 'refuge' | 'open_movement';
      expiresWeek: number;
    }
  | {
      kind: 'propaganda_attempt';
      choiceId: string;
      settlementId: string;
      acknowledgement: WeeklyDraft['acknowledgements'][number];
    };
export const settlementActionTeams: Record<
  Choice['actionId'],
  readonly (typeof TEAM_IDS)[number][]
> = {
  activate_refuge: ['conspirators', 'scholars', 'spellcasters'],
  reduce_danger: ['defenders', 'guardians', 'infiltrators', 'specialists'],
  spread_propaganda: ['propagandists', 'saboteurs', 'spies'],
};
/**
 * Whether a refuge may be activated in the settlement: its reputation, with
 * every current shift but without an active refuge's own step, is Hostile or
 * Unfriendly. False while the reputation is unknown.
 */
export function refugeReputationAllows(settlement: Settlement, week: number) {
  // Safe cast: `projectSettlements` maps each settlement to one fact, and one
  // settlement is passed.
  const { reputation } = projectSettlements(
    [{ ...settlement, refugeActivatedWeek: null, refugeActiveUntilWeek: null }],
    week,
  ).settlements[0]!;
  return reputation === 'Hostile' || reputation === 'Unfriendly';
}
/** Spread Propaganda's Loyalty DC: 20, or 25 where enemies occupy the settlement. */
export function propagandaDc(occupied: boolean) {
  return 20 + (occupied ? 5 : 0);
}
function change(
  result: ActivityProjection,
  choice: Choice,
  settlement: Settlement,
  after: Settlement,
) {
  result.plan.push({
    kind: 'settlement',
    choiceId: choice.choiceId,
    before: { ...settlement },
    after: { ...after },
  });
  Object.assign(settlement, after);
}
export function resolveSettlementChoice(
  draft: WeeklyDraft,
  result: ActivityProjection,
  staged: StagedActionChoice,
  helpers: Pick<
    ActivityHelpers,
    'check' | 'dice' | 'value' | 'exception' | 'spend'
  >,
) {
  if (!(staged.actionId in settlementActionTeams)) return false;
  // Safe cast: settlementActionTeams holds the action id (checked above), so it
  // is a settlement action choice.
  const choice = staged as Choice;
  const required = (key: string) =>
    result.requirements.push(`${choice.choiceId}:${key}`);
  const team = result.outcome.roster.teams.find(
    (entry) => entry.teamId === choice.teamId,
  );
  const settlement = result.outcome.settlements.find(
    (entry) => entry.settlementId === choice.settlementId,
  );
  if (!team) required('team');
  if (!settlement) required('settlement');
  if (!team || !settlement) return true;
  if (
    !settlementActionTeams[choice.actionId].includes(team.teamType) &&
    !helpers.exception(draft, result, choice, 'team-action')
  )
    return true;
  if (
    settlement.reputation === null ||
    settlement.temporaryReputationShift === null ||
    (settlement.reduceDangerReputationShift === undefined) !==
      (settlement.reduceDangerUntilWeek === undefined)
  ) {
    required('settlement-reputation');
    return true;
  }
  if (choice.actionId === 'activate_refuge') {
    if (
      !refugeReputationAllows(settlement, draft.week) &&
      !helpers.exception(draft, result, choice, 'refuge-reputation')
    )
      return true;
    change(result, choice, settlement, {
      ...settlement,
      refugeActivatedWeek: draft.week,
      refugeActiveUntilWeek: draft.week,
    });
    result.plan.push({
      kind: 'settlement_benefit',
      choiceId: choice.choiceId,
      settlementId: settlement.settlementId,
      benefit: 'refuge',
      expiresWeek: draft.week,
    });
    return true;
  }
  if (choice.actionId === 'reduce_danger') {
    if (settlement.secured === null) {
      required('settlement-secured');
      return true;
    }
    if (
      !settlement.secured &&
      !helpers.exception(draft, result, choice, 'settlement-secured')
    )
      return true;
    const total = helpers.check(draft, result, choice, 'security', 15);
    if (total === null) return true;
    if (total < 15) {
      const gain = helpers.dice(result, choice, 'notoriety');
      if (gain !== null) helpers.value(result, choice, 'notoriety', gain);
      return true;
    }
    const previous =
      settlement.reduceDangerUntilWeek !== undefined &&
      settlement.reduceDangerUntilWeek >= draft.week
        ? (settlement.reduceDangerReputationShift ?? 0)
        : 0;
    change(result, choice, settlement, {
      ...settlement,
      reduceDangerReputationShift: previous + 1,
      reduceDangerUntilWeek: draft.week,
    });
    result.plan.push({
      kind: 'settlement_benefit',
      choiceId: choice.choiceId,
      settlementId: settlement.settlementId,
      benefit: 'open_movement',
      expiresWeek: draft.week,
    });
    for (const event of draft.context.carriedEvents) {
      if (
        event.eventType !== 'theft' ||
        result.endedEventIds.includes(event.eventId)
      )
        continue;
      result.endedEventIds.push(event.eventId);
      result.plan.push({
        kind: 'end_persistent_event',
        choiceId: choice.choiceId,
        eventId: event.eventId,
      });
    }
    return true;
  }
  // The GM is assumed to allow propaganda from Ruleset Version 9; an older
  // choice's stored `possible` answer, even `false`, is ignored.
  if (settlement.occupied === null) required('settlement-occupied');
  const acknowledgement = [
    ...draft.acknowledgements,
    ...(choice.acknowledgements ?? []),
  ].find(
    (entry) =>
      entry.subjectId === `propaganda:${choice.choiceId}` &&
      entry.outcome.trim(),
  );
  if (!acknowledgement)
    required(`acknowledgement:propaganda:${choice.choiceId}`);
  if (settlement.occupied === null || !acknowledgement) return true;
  if (choice.occupied !== undefined && choice.occupied !== settlement.occupied)
    result.warnings.push(`${choice.choiceId}:settlement-occupied`);
  if (
    result.plan.some(
      (entry) =>
        entry.kind === 'propaganda_attempt' &&
        entry.settlementId === settlement.settlementId,
    ) &&
    !helpers.exception(draft, result, choice, 'propaganda-limit')
  )
    return true;
  if (!helpers.spend(draft, result, choice, 10000)) return true;
  result.plan.push({
    kind: 'propaganda_attempt',
    choiceId: choice.choiceId,
    settlementId: settlement.settlementId,
    acknowledgement: { ...acknowledgement },
  });
  const dc = propagandaDc(settlement.occupied);
  const total = helpers.check(draft, result, choice, 'loyalty', dc);
  if (total !== null && total >= dc)
    change(result, choice, settlement, {
      ...settlement,
      reputation:
        // Safe cast: `indexOf` is at least -1, so the clamped index stays
        // within the five reputation levels.
        REPUTATION_LEVELS[
          Math.min(4, REPUTATION_LEVELS.indexOf(settlement.reputation) + 1)
        ]!,
    });
  return true;
}
