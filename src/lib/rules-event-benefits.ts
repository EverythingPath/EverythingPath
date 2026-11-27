import { z } from 'zod';
import {
  identitySchema as id,
  integerSchema as int,
} from './weekly-draft-facts';
import { getPurchaseCostCopper, projectSettlements } from './rules-settlements';
import type { UpkeepSnapshot } from './rules-upkeep';

export const eventBenefitsSchema = z.strictObject({
  skills: z.array(
    z.strictObject({
      benefitId: id,
      sourceEventIds: z.array(id),
      characterIds: z.array(id),
      skills: z.array(
        z.enum([
          'knowledge_local',
          'bluff',
          'diplomacy',
          'intimidate',
          'stealth',
        ]),
      ),
      bonusType: z.enum(['untyped', 'morale', 'circumstance']),
      value: int,
      settlementId: id.nullable(),
      afterDark: z.boolean(),
      startsWeek: int,
      endsWeek: int,
    }),
  ),
  markets: z.array(
    z.strictObject({
      benefitId: id,
      sourceEventIds: z.array(id),
      settlementIds: z.array(id),
      discountPercent: z.literal(5),
      startsWeek: int,
      endsWeek: int,
    }),
  ),
});
export type EventBenefits = z.infer<typeof eventBenefitsSchema>;

// Town-wide benefits cover items and services, whether or not a marketplace
// record exists. Reputation and Market Day remain separate price factors.
export function projectEventPurchaseCost(
  snapshot: UpkeepSnapshot,
  week: number,
  settlementId: string,
  priceCopper: number,
) {
  const settlement = projectSettlements(
    snapshot.settlements,
    week,
  ).settlements.find((town) => town.settlementId === settlementId);
  if (settlement?.pricePercent == null) return null;
  const marketDay =
    snapshot.eventBenefits?.markets.some(
      (benefit) =>
        benefit.startsWeek <= week &&
        benefit.endsWeek >= week &&
        benefit.settlementIds.includes(settlementId),
    ) ?? false;
  return getPurchaseCostCopper(priceCopper, settlement.pricePercent, marketDay);
}
