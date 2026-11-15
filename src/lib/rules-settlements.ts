import type { ContextSettlement } from './canonical-campaign-context';
import { REPUTATION_LEVELS } from './militia-domain';

export type FoundationPurchase = {
  purchaseId: string;
  settlementId: string;
  priceCopper: number;
  marketDay?: boolean;
};
const reputationEffects = {
  Hostile: {
    socialDcModifier: 5,
    pricePercent: 5,
    eventChanceModifier: 0,
    sightingDays: [1, 4],
  },
  Unfriendly: {
    socialDcModifier: 2,
    pricePercent: 0,
    eventChanceModifier: 5,
    sightingDays: null,
  },
  Indifferent: {
    socialDcModifier: 0,
    pricePercent: 0,
    eventChanceModifier: 0,
    sightingDays: null,
  },
  Friendly: {
    socialDcModifier: -2,
    pricePercent: 0,
    eventChanceModifier: -5,
    sightingDays: null,
  },
  Helpful: {
    socialDcModifier: 0,
    pricePercent: -5,
    eventChanceModifier: 0,
    sightingDays: null,
  },
};
export function projectSettlements(
  settlements: ContextSettlement[],
  week: number,
) {
  const requirements: string[] = [];
  const facts = settlements.map((settlement) => {
    if (
      settlement.reputation === null ||
      settlement.temporaryReputationShift === null ||
      (settlement.reduceDangerReputationShift === undefined) !==
        (settlement.reduceDangerUntilWeek === undefined)
    ) {
      requirements.push(`settlement:${settlement.settlementId}:reputation`);
      return {
        ...settlement,
        reputation: null,
        socialDcModifier: null,
        pricePercent: null,
        eventChanceModifier: null,
        sightingDays: null,
      };
    }
    const shiftedIndex = Math.max(
      0,
      Math.min(
        4,
        REPUTATION_LEVELS.indexOf(settlement.reputation) +
          settlement.temporaryReputationShift +
          (settlement.reduceDangerUntilWeek !== undefined &&
          settlement.reduceDangerUntilWeek >= week
            ? (settlement.reduceDangerReputationShift ?? 0)
            : 0),
      ),
    );
    // Safe cast: `shiftedIndex` is clamped to 0..4, the five reputation levels.
    let reputation = REPUTATION_LEVELS[shiftedIndex]!;
    const refuge = isRefugeActive(settlement, week);
    if (refuge && (reputation === 'Hostile' || reputation === 'Unfriendly'))
      // Safe cast: Hostile and Unfriendly sit at indexes 0 and 1, so one step
      // up is still a reputation level.
      reputation = REPUTATION_LEVELS[shiftedIndex + 1]!;
    return { ...settlement, reputation, ...reputationEffects[reputation] };
  });
  return { settlements: facts, requirements };
}
/** Whether a settlement's refuge is active in the given week. */
export function isRefugeActive(
  town: {
    refugeActivatedWeek: number | null;
    refugeActiveUntilWeek: number | null;
  },
  week: number,
) {
  return (
    town.refugeActivatedWeek !== null &&
    town.refugeActiveUntilWeek !== null &&
    town.refugeActivatedWeek <= week &&
    town.refugeActiveUntilWeek >= week
  );
}
export function getPurchaseCostCopper(
  priceCopper: number,
  reputationPercent: number,
  marketDay: boolean,
  discountPercent = 0,
) {
  return Math.round(
    (priceCopper *
      (100 + reputationPercent) *
      (marketDay ? 95 : 100) *
      (100 - discountPercent)) /
      1000000,
  );
}
export function projectPurchases(
  purchases: FoundationPurchase[],
  settlements: ReturnType<typeof projectSettlements>['settlements'],
) {
  return purchases.map((purchase) => {
    const settlement = settlements.find(
      (x) => x.settlementId === purchase.settlementId,
    );
    const percent = settlement?.pricePercent;
    // Compound discounts before rounding once to the nearest copper.
    const costCopper =
      percent === null || percent === undefined
        ? null
        : getPurchaseCostCopper(
            purchase.priceCopper,
            percent,
            purchase.marketDay ?? false,
          );
    return { ...purchase, costCopper };
  });
}
