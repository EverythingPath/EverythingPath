import { z } from 'zod';
import { REPUTATION_LEVELS } from './militia-domain';
import {
  identitySchema as id,
  integerSchema as int,
} from './weekly-draft-facts';

const text = z.string().trim().min(1, 'A value is required').max(500);
export const contextSettlementSchema = z
  .strictObject({
    settlementId: id,
    name: text,
    reputation: z.enum(REPUTATION_LEVELS).nullable(),
    secured: z.boolean().nullable(),
    occupied: z.boolean().nullable(),
    temporaryReputationShift: z.number().int().nullable(),
    reduceDangerReputationShift: z.number().int().optional(),
    reduceDangerUntilWeek: int.optional(),
    refugeActivatedWeek: int.nullable(),
    refugeActiveUntilWeek: int.nullable(),
  })
  .superRefine((settlement, ctx) => {
    if (
      (settlement.reduceDangerReputationShift === undefined) !==
      (settlement.reduceDangerUntilWeek === undefined)
    )
      ctx.addIssue({
        code: 'custom',
        path: ['reduceDangerUntilWeek'],
        message:
          'A Reduce Danger benefit requires both its shift and expiry week',
      });
  });
export const contextBonusSchema = z.strictObject({
  bonusId: id,
  source: text,
  check: z.enum(['loyalty', 'security', 'secrecy', 'event_chance', 'any']),
  teamId: id.optional(),
  phase: z.enum(['upkeep', 'activity', 'event', 'persistent']).optional(),
  value: z.number().int(),
  availableWeek: int.nullable(),
  consumedWeek: int.nullable(),
});
export type ContextSettlement = z.infer<typeof contextSettlementSchema>;
export type ContextBonus = z.infer<typeof contextBonusSchema>;
