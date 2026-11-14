import { z } from 'zod';
import {
  identitySchema as id,
  integerSchema as int,
  stagedActionChoiceSchema,
  rawRollSchema,
  upkeepRollsSchema,
  persistentEventSchema,
  orderSchema,
  queuedEffectSchema,
  persistentDecisionSchema,
  actionChoiceEvents,
  eventTreeSchema,
  eventOccurrenceSchema,
  acknowledgementSchema,
  rulesExceptionSchema,
  tableAdjustmentSchema,
} from './weekly-draft-facts';
export { stagedActionChoiceSchema } from './weekly-draft-facts';

// Freezing is recursive: callers cannot mutate historical context through an alias.
type Immutable<T> = T extends object
  ? { readonly [K in keyof T]: Immutable<T[K]> }
  : T;
function immutable<T>(value: T): Immutable<T> {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) immutable(child);
    Object.freeze(value);
  }
  // Safe cast: value and every nested object are frozen above.
  return value as Immutable<T>;
}
export const weekStartFactsSchema = z.strictObject({
  firstMilitiaWeek: z.boolean(),
  startDay: int,
  uneventfulCarry: z.boolean(),
  operatedSettlementIds: z.array(id).optional(),
  carriedEvents: z.array(persistentEventSchema),
  queuedEffects: z.array(queuedEffectSchema),
  orders: z.array(orderSchema),
  lastBuyoffWeek: int.nullable(),
});
const contextSchema = weekStartFactsSchema
  .extend({ persistentPhaseEligible: z.boolean() })
  .refine(
    (context) =>
      context.persistentPhaseEligible === context.carriedEvents.length > 0,
    'Inconsistent persistent eligibility',
  )
  .transform(immutable);
const upkeepSchema = z.strictObject({
  // check/training: attrition; notoriety: maximum-Notoriety loss; loss: treasury shortage.
  notorietyCheck: rawRollSchema.optional(),
  nearestSettlementId: id.optional(),
  rolls: upkeepRollsSchema.default({}),
  // Transfers are characterless (#158).
  treasuryTransfers: z
    .array(
      z.strictObject({
        transferId: id,
        direction: z.enum(['deposit', 'withdraw']),
        copper: int,
      }),
    )
    .default([]),
  teamDecisions: z
    .array(
      z.strictObject({
        teamId: id,
        decision: z.enum(['recover', 'leave']),
        costCopper: int.optional(),
        roll: rawRollSchema.optional(),
      }),
    )
    .default([]),
});
const slotSchema = z.strictObject({
  slotId: id,
  choice: stagedActionChoiceSchema.nullable(),
});
export const weeklyDraftSchema = z
  .strictObject({
    draftId: id,
    revision: int.nonnegative(),
    week: int,
    context: contextSchema,
    upkeep: upkeepSchema.default({
      rolls: {},
      treasuryTransfers: [],
      teamDecisions: [],
    }),
    activity: z.strictObject({
      slots: z.array(slotSchema),
      operatingSettlementId: id.optional(),
      consumableIds: z.array(id).default([]),
    }),
    event: z
      .strictObject({
        chanceRoll: rawRollSchema.optional(),
        occurrences: eventTreeSchema.default([]),
      })
      .default({ occurrences: [] }),
    persistent: z
      .strictObject({ decisions: z.array(persistentDecisionSchema) })
      .default({ decisions: [] }),
    acknowledgements: z.array(acknowledgementSchema).default([]),
    rulesExceptions: z.array(rulesExceptionSchema).default([]),
    tableAdjustments: z.array(tableAdjustmentSchema).default([]),
    orderReceipts: z
      .array(
        z.strictObject({
          orderId: id,
          receivedDay: int,
          acknowledgementId: id,
        }),
      )
      .default([]),
  })
  .superRefine((draft, ctx) => {
    function unique(values: string[], label: string) {
      if (new Set(values).size !== values.length)
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate ${label} identity`,
        });
    }
    unique(
      draft.upkeep.treasuryTransfers.map((value) => value.transferId),
      'transfer',
    );
    unique(
      draft.upkeep.teamDecisions.map((value) => value.teamId),
      'team decision',
    );
    unique(
      draft.context.queuedEffects.map((value) => value.effectId),
      'queued effect',
    );
    const currentEvents = draft.event.occurrences.concat(
      draft.activity.slots.flatMap((slot) => actionChoiceEvents(slot.choice)),
    );
    unique(
      draft.activity.slots.map((slot) => slot.slotId),
      'slot',
    );
    unique(
      draft.activity.slots
        .flatMap((slot) => (slot.choice ? [slot.choice.choiceId] : []))
        .concat(
          currentEvents.flatMap((event) =>
            event.sabotage ? [event.sabotage.choiceId] : [],
          ),
        ),
      'choice',
    );
    unique(
      [...draft.context.carriedEvents, ...currentEvents].map(
        (event) => event.eventId,
      ),
      'event',
    );
    unique(
      draft.persistent.decisions.map((decision) => decision.eventId),
      'persistent decision',
    );
    unique(
      draft.acknowledgements.map((value) => value.acknowledgementId),
      'acknowledgement',
    );
    unique(
      draft.rulesExceptions.map((value) => value.exceptionId),
      'exception',
    );
    unique(
      draft.tableAdjustments.map((value) => value.adjustmentId),
      'adjustment',
    );
    unique(
      draft.context.orders
        .map((value) => value.orderId)
        .concat(
          draft.activity.slots.flatMap((slot) =>
            slot.choice?.actionId === 'special_order' && slot.choice.orderId
              ? [slot.choice.orderId]
              : [],
          ),
        ),
      'order',
    );
    unique(
      draft.orderReceipts.map((value) => value.orderId),
      'receipt',
    );
    for (const decision of draft.persistent.decisions) {
      if (
        !draft.context.carriedEvents.some(
          (event) => event.eventId === decision.eventId,
        )
      )
        ctx.addIssue({ code: 'custom', message: 'Unknown persistent event' });
    }
    for (const receipt of draft.orderReceipts) {
      const order = draft.context.orders.find(
        (order) => order.orderId === receipt.orderId,
      );
      if (!order || order.receipt)
        ctx.addIssue({
          code: 'custom',
          message: 'Unknown or already received order',
        });
    }
  });
// Storage omits the in-memory freeze transform, retaining all structural checks.
export const weeklyDraftDataSchema = weeklyDraftSchema.safeExtend({
  context: contextSchema.in,
});
export type WeeklyDraft = z.infer<typeof weeklyDraftSchema>;
export const weeklyDraftEditSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('stage'),
    slotId: id,
    choice: stagedActionChoiceSchema,
  }),
  z.strictObject({
    kind: z.literal('replace'),
    slotId: id,
    choiceId: id,
    choice: stagedActionChoiceSchema,
  }),
  // Detail carries the complete typed contents, with absence explicitly clearing a value.
  z.strictObject({
    kind: z.literal('detail'),
    slotId: id,
    choiceId: id,
    choice: stagedActionChoiceSchema,
  }),
  z.strictObject({ kind: z.literal('clear'), slotId: id, choiceId: id }),
  z.strictObject({
    kind: z.literal('move'),
    fromSlotId: id,
    toSlotId: id,
    choiceId: id,
  }),
  z.strictObject({
    kind: z.literal('swap'),
    fromSlotId: id,
    toSlotId: id,
    choiceId: id,
    otherChoiceId: id,
  }),
  z.strictObject({ kind: z.literal('add_slot'), slotId: id }),
  // Only an empty slot beyond the authoritative allowance; the persistence
  // authority checks the allowance, the reducer only its identity and emptiness.
  z.strictObject({ kind: z.literal('remove_slot'), slotId: id }),
  z.strictObject({ kind: z.literal('upkeep'), inputs: upkeepSchema }),
  z.strictObject({
    kind: z.literal('upkeep_roll'),
    field: z.enum(['check', 'training', 'notoriety', 'loss', 'notorietyCheck']),
    roll: rawRollSchema.nullable(),
  }),
  z.strictObject({
    kind: z.literal('upkeep_settlement'),
    settlementId: id.nullable(),
  }),
  z.strictObject({
    kind: z.literal('upkeep_team'),
    teamId: id,
    decision: upkeepSchema.shape.teamDecisions.unwrap().element.nullable(),
    recoveryAdjustment: z
      .strictObject({
        deltaCopper: z.number().int(),
        reason: z.string().trim().min(1),
      })
      .nullable()
      .optional(),
  }),
  z.strictObject({
    kind: z.literal('upkeep_transfer'),
    transfer: upkeepSchema.shape.treasuryTransfers.unwrap().element,
  }),
  z.strictObject({ kind: z.literal('clear_upkeep_transfer'), transferId: id }),
  z.strictObject({
    kind: z.literal('operating_settlement'),
    settlementId: id.nullable(),
  }),
  z.strictObject({
    kind: z.literal('consumables'),
    consumableIds: z.array(id),
  }),
  z.strictObject({
    kind: z.literal('event_chance'),
    roll: rawRollSchema.nullable(),
  }),
  z.strictObject({
    kind: z.literal('event_occurrence'),
    occurrence: eventOccurrenceSchema,
  }),
  z.strictObject({
    kind: z.literal('event_tree'),
    occurrences: eventTreeSchema,
  }),
  z.strictObject({
    kind: z.literal('persistent_decision'),
    decision: persistentDecisionSchema,
  }),
  z.strictObject({ kind: z.literal('clear_persistent_decision'), eventId: id }),
  z.strictObject({
    kind: z.literal('acknowledge'),
    acknowledgement: acknowledgementSchema,
  }),
  z.strictObject({
    kind: z.literal('clear_acknowledgement'),
    acknowledgementId: id,
  }),
  z.strictObject({
    kind: z.literal('rules_exception'),
    exception: rulesExceptionSchema,
  }),
  z.strictObject({ kind: z.literal('clear_rules_exception'), exceptionId: id }),
  z.strictObject({
    kind: z.literal('table_adjustments'),
    adjustments: z.array(tableAdjustmentSchema),
  }),
  z.strictObject({
    kind: z.literal('receive_order'),
    orderId: id,
    receivedDay: int,
    acknowledgementId: id,
  }),
  z.strictObject({ kind: z.literal('clear_receipt'), orderId: id }),
]);
export type WeeklyDraftEdit = z.infer<typeof weeklyDraftEditSchema>;
export type WeekStartFacts = z.infer<typeof weekStartFactsSchema>;
