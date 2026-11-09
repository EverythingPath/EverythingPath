import type { ActivityProjection } from './rules-activity';
import type { WeeklyDraft } from './weekly-draft-contract';

// A tracked town is not evidence that the militia operated there. Historical
// operations are explicit context; this week's actual operation and markets
// provide additional evidence without inventing past activity.
export function operatedSettlementIds(
  draft: WeeklyDraft,
  activity: Pick<ActivityProjection, 'outcome' | 'teamUse'>,
) {
  return [
    ...new Set([
      ...(draft.context.operatedSettlementIds ?? []),
      ...(draft.activity.operatingSettlementId
        ? [draft.activity.operatingSettlementId]
        : []),
      ...draft.activity.slots.flatMap(({ choice }) =>
        choice &&
        'settlementId' in choice &&
        choice.settlementId &&
        choice.teamId &&
        activity.teamUse.usedTeamIds.includes(choice.teamId)
          ? [choice.settlementId]
          : [],
      ),
      ...(activity.outcome.economy?.markets ?? [])
        .filter(
          (market) =>
            market.availableWeek <= draft.week &&
            market.expiresWeek >= draft.week,
        )
        .map((market) => market.settlementId),
    ]),
  ];
}
