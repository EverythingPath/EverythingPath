import { z } from 'zod';
import {
  EVENT_TYPES,
  REPUTATION_LEVELS,
  TEAM_IDS,
  TEAM_STATUSES,
} from './militia-domain';

// Domain identities are allocated by callers, never Convex document IDs or positions.
export const identitySchema = z.string().trim().min(1);
export const integerSchema = z.number().int().nonnegative();
const signedInteger = z.number().int();
const id = identitySchema;
const int = integerSchema;
const reason = z.string().trim().min(1);
export const rawRollProvenanceSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('table') }),
  z.strictObject({ kind: z.literal('generated'), sourceId: id }),
]);
export const rawRollModifiersSchema = z.array(
  z.strictObject({ sourceId: id, value: signedInteger, reason }),
);
// A roll is recorded as the total of its dice, never as individual dice.
export const rawRollSchema = z.strictObject({
  sides: int.min(2),
  provenance: rawRollProvenanceSchema,
  modifiers: rawRollModifiersSchema,
  diceTotal: int,
  diceCount: int.positive(),
});
export type RawRoll = z.infer<typeof rawRollSchema>;

export const upkeepRollsSchema = z.partialRecord(
  z.enum(['check', 'training', 'notoriety', 'loss']),
  rawRollSchema,
);
const checkRolls = z.partialRecord(z.enum(['check']), rawRollSchema);
const checkNotorietyRolls = z.partialRecord(
  z.enum(['check', 'notoriety']),
  rawRollSchema,
);
const eventRolls = z.partialRecord(z.enum(['check', 'loss']), rawRollSchema);
export const acknowledgementSchema = z.strictObject({
  acknowledgementId: id,
  subjectId: id,
  outcome: reason,
});
export const rulesExceptionSchema = z.strictObject({
  exceptionId: id,
  subjectId: id,
  ruleId: id,
  reason,
});
export const tableAdjustmentSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('militia_value'),
    adjustmentId: id,
    field: z.enum(['training', 'treasuryCopper', 'notoriety', 'rank']),
    operation: z.enum(['add', 'set']),
    value: signedInteger,
    reason,
  }),
  z.strictObject({
    kind: z.literal('settlement_reputation'),
    adjustmentId: id,
    settlementId: id,
    reputation: z.enum(REPUTATION_LEVELS),
    reason,
  }),
  z.strictObject({
    kind: z.literal('team_status'),
    adjustmentId: id,
    teamId: id,
    status: z.enum(TEAM_STATUSES),
    reason,
  }),
  z.strictObject({
    kind: z.literal('event_end'),
    adjustmentId: id,
    eventId: id,
    reason,
  }),
]);

export const eventTargetSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('event'), eventId: id }),
  z.strictObject({ kind: z.literal('item'), itemId: id }),
  z.strictObject({ kind: z.literal('team'), teamId: id }),
  z.strictObject({ kind: z.literal('settlement'), settlementId: id }),
  z.strictObject({ kind: z.literal('character'), characterId: id }),
  z.strictObject({ kind: z.literal('cache'), cacheId: id }),
]);
export const officerCheckSchema = z.strictObject({
  characterId: id,
  skill: z.enum(['diplomacy', 'bluff', 'intimidate']),
  skillBonus: signedInteger.optional(),
  roll: rawRollSchema.optional(),
});
export const persistentEventSchema = z.strictObject({
  reviewRequired: z.literal(true).optional(),
  eventId: id,
  eventType: z.enum(EVENT_TYPES),
  startedWeek: int,
  order: int.nonnegative(),
  targets: z.array(eventTargetSchema),
  sourceEventIds: z.array(id).optional(),
  mitigation: z
    .strictObject({ week: int, retainedIncomePercent: z.literal(90) })
    .optional(),
});
export const orderSchema = z.strictObject({
  orderId: id,
  itemId: id,
  settlementId: id,
  orderedDay: int,
  dueDay: z.number().nonnegative(),
  priceCopper: int,
  receipt: z
    .strictObject({ receivedDay: int, acknowledgementId: id })
    .nullable(),
});
export const queuedEffectSchema = z.strictObject({
  eventType: z.enum(EVENT_TYPES).optional(),
  effectId: id,
  sourceId: id,
  startsWeek: int,
  endsWeek: int,
  effect: z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('check_modifier'),
      check: z.enum(['loyalty', 'secrecy', 'security']),
      phase: z.enum(['upkeep', 'activity', 'event', 'persistent']).optional(),
      value: signedInteger,
    }),
    z.strictObject({
      kind: z.literal('upkeep_loss_multiplier'),
      value: int.min(1),
    }),
    z.strictObject({
      kind: z.literal('activity_training_multiplier'),
      value: int.min(1),
    }),
    z.strictObject({ kind: z.literal('event_chance'), value: signedInteger }),
    z.strictObject({ kind: z.literal('all_is_calm') }),
    z.strictObject({
      kind: z.literal('automatic_events'),
      count: int.min(1).max(2),
    }),
    z.strictObject({ kind: z.literal('block_action'), actionId: id }),
    z.strictObject({
      kind: z.literal('team_unavailable'),
      teamId: id,
      phase: z.literal('activity').optional(),
    }),
    z.strictObject({
      kind: z.literal('team_return'),
      teamId: id,
      status: z.enum(['active', 'disabled']),
    }),
    z.strictObject({ kind: z.literal('narrative'), instruction: reason }),
  ]),
});
export type QueuedEffect = z.infer<typeof queuedEffectSchema>;

export const persistentDecisionSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('unattempted'), eventId: id }),
  z.strictObject({
    kind: z.literal('mitigate'),
    eventId: id,
    reviewRequired: z.literal(true).optional(),
    officerCheck: officerCheckSchema.optional(),
    overseerCharacterId: id.optional(),
    rolls: checkRolls.optional(),
  }),
  z.strictObject({ kind: z.literal('buyoff'), eventId: id }),
  z.strictObject({
    kind: z.literal('end'),
    eventId: id,
    acknowledgement: acknowledgementSchema,
  }),
]);
export const eventOccurrenceSchema = z.strictObject({
  reviewRequired: z.literal(true).optional(),
  eventId: id,
  origin: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('rolled') }),
    z.strictObject({ kind: z.literal('automatic'), sourceId: id }),
    z.strictObject({ kind: z.literal('roll_twice'), parentEventId: id }),
    z.strictObject({ kind: z.literal('replacement'), parentEventId: id }),
  ]),
  eventType: z.enum(EVENT_TYPES).optional(),
  mitigation: z.enum(['unattempted', 'attempted']).optional(),
  averagePartyLevel: int.optional(),
  officerCheck: officerCheckSchema.optional(),
  tableRoll: rawRollSchema.optional(),
  rolls: eventRolls.optional(),
  targets: z.array(eventTargetSchema).optional(),
  persistent: z.boolean().optional(),
  persistentDecision: persistentDecisionSchema.optional(),
  overseerCharacterId: id.optional(),
  targetChecks: z
    .array(
      z.strictObject({
        target: eventTargetSchema,
        mitigation: z.enum(['unattempted', 'attempted']).optional(),
        rolls: eventRolls.optional(),
      }),
    )
    .optional(),
  rewards: z
    .array(
      z.strictObject({
        itemId: id,
        characterId: id,
        name: reason,
        valueCopper: int,
        weight: z.number().nonnegative(),
        alchemical: z.boolean(),
        poison: z.boolean(),
      }),
    )
    .optional(),
  sabotage: z
    .strictObject({
      choiceId: id,
      teamId: id.optional(),
      check: z.enum(['loyalty', 'secrecy', 'security']).optional(),
      rolls: checkNotorietyRolls.optional(),
    })
    .optional(),
});
export const eventTreeSchema = z
  .array(eventOccurrenceSchema)
  .superRefine((events, ctx) => {
    const seen = new Set<string>();
    for (const event of events) {
      if (seen.has(event.eventId))
        ctx.addIssue({ code: 'custom', message: 'Duplicate event identity' });
      if (
        'parentEventId' in event.origin &&
        !seen.has(event.origin.parentEventId)
      ) {
        ctx.addIssue({
          code: 'custom',
          message: 'Event parent must precede its child',
        });
      }
      if (
        event.persistentDecision &&
        (!event.persistent ||
          event.persistentDecision.eventId !== event.eventId)
      )
        ctx.addIssue({
          code: 'custom',
          message: 'Persistent decision must belong to its event',
        });
      seen.add(event.eventId);
    }
  });

const commonChoice = {
  reviewRequired: z.literal(true).optional(),
  choiceId: id,
  teamId: id.optional(),
  costCopper: int.optional(),
  consumableIds: z.array(id).optional(),
  acknowledgements: z.array(acknowledgementSchema).optional(),
};
const settlement = { settlementId: id.optional() };
const purchase = z.strictObject({
  itemId: id,
  priceCopper: int,
  name: reason.optional(),
  weight: z.number().nonnegative().optional(),
});
const marketplace = {
  ...settlement,
  purchases: z.array(purchase).optional(),
  sales: z.array(id).optional(),
};
const character = {
  characterId: id.optional(),
  characterLevel: int.optional(),
};
const officerRole = z.enum([
  'ambassador',
  'commandant',
  'marshal',
  'overseer',
  'spymaster',
  'strategist',
]);
function action<const Name extends string, Shape extends z.ZodRawShape>(
  name: Name,
  shape: Shape,
) {
  return z.strictObject({
    ...commonChoice,
    actionId: z.literal(name),
    ...shape,
  });
}
export const stagedActionChoiceSchema = z
  .discriminatedUnion('actionId', [
    action('activate_black_market', {
      ...marketplace,
      rolls: checkNotorietyRolls.optional(),
    }),
    action('activate_refuge', settlement),
    action('broker_market', marketplace),
    action('change_officer_role', {
      characterId: id.optional(),
      fromRole: officerRole.optional(),
      toRole: officerRole.optional(),
    }),
    action('covert_action', {
      mode: z.enum(['augment', 'contact', 'cache']).optional(),
      followingChoiceId: id.optional(),
      location: reason.optional(),
    }),
    action('dismiss_team', {
      targetTeamId: id.optional(),
      rolls: checkNotorietyRolls.optional(),
    }),
    action('drill_militia', {
      rolls: z
        .partialRecord(
          z.enum(['check', 'notoriety', 'training']),
          rawRollSchema,
        )
        .optional(),
    }),
    action('earn_gold', { rolls: checkNotorietyRolls.optional() }),
    action('gather_information', {
      rolls: checkNotorietyRolls.optional(),
      subject: reason.optional(),
    }),
    action('guarantee_event', {
      rolls: z.partialRecord(z.enum(['notoriety']), rawRollSchema).optional(),
      candidates: eventTreeSchema.optional(),
      selectedEventId: id.optional(),
    }),
    action('knowledge_check', {
      rolls: checkRolls.optional(),
      subject: reason.optional(),
    }),
    action('lie_low', {}),
    action('manipulate_events', {
      candidates: eventTreeSchema.optional(),
      selectedEventId: id.optional(),
    }),
    action('recruit_team', {
      rolls: checkNotorietyRolls.optional(),
      teamType: z.enum(TEAM_IDS).optional(),
      // Required only when an exception permits a team without recruitment rules.
      recruitmentCheck: z
        .strictObject({
          check: z.enum(['loyalty', 'secrecy', 'security']),
          dc: int,
        })
        .optional(),
    }),
    action('reduce_danger', {
      ...settlement,
      rolls: checkNotorietyRolls.optional(),
    }),
    action('rescue_character', {
      rolls: checkRolls.optional(),
      ...character,
      destination: z
        .discriminatedUnion('kind', [
          z.strictObject({ kind: z.literal('headquarters') }),
          z.strictObject({ kind: z.literal('refuge'), settlementId: id }),
        ])
        .optional(),
    }),
    action('restore_character', {
      ...character,
      mode: z
        .enum([
          'ability_damage',
          'hit_points',
          'restorative_effect',
          'break_enchantment',
          'raise_dead',
          'restoration',
          'stone_to_flesh',
        ])
        .optional(),
      effect: reason.optional(),
      effectLevel: int.optional(),
      targetPresent: z.boolean().optional(),
    }),
    action('secure_cache', {
      rolls: checkRolls.optional(),
      mode: z.enum(['place', 'retrieve']).optional(),
      cacheId: id.optional(),
      cacheClass: z.enum(['minor', 'intermediate', 'major']).optional(),
      itemIds: z.array(id).optional(),
      purchases: z.array(purchase).optional(),
      settlementId: id.optional(),
      extradimensional: z.boolean().optional(),
      location: reason.optional(),
      secure: z.boolean().optional(),
    }),
    action('special', { instruction: reason.optional() }),
    action('special_order', {
      rolls: z.partialRecord(z.enum(['delivery']), rawRollSchema).optional(),
      name: reason.optional(),
      weight: z.number().nonnegative().optional(),
      orderId: id.optional(),
      receipt: z
        .strictObject({ receivedDay: int, acknowledgementId: id })
        .optional(),
      ...settlement,
      itemId: id.optional(),
      mode: z.enum(['purchase', 'enchantment']).optional(),
      priceCopper: int.optional(),
      expedited: z.boolean().optional(),
      orderedDay: int.optional(),
    }),
    action('spread_propaganda', {
      rolls: checkRolls.optional(),
      ...settlement,
      // Retired GM-permission answer: older drafts and records still parse,
      // but the rules assume approval and nothing writes it any more.
      possible: z.boolean().optional(),
      occupied: z.boolean().optional(),
    }),
    action('strike_team', {
      mode: z.enum(['support', 'extraction']).optional(),
      location: reason.optional(),
    }),
    action('upgrade_team', {
      targetTeamId: id.optional(),
      toTeamType: z.enum(TEAM_IDS).optional(),
    }),
  ])
  .superRefine((choice, ctx) => {
    if (
      'selectedEventId' in choice &&
      choice.selectedEventId &&
      !choice.candidates?.some(
        (event) => event.eventId === choice.selectedEventId,
      )
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Unknown selected event candidate',
      });
    }
  });
export type StagedActionChoice = z.infer<typeof stagedActionChoiceSchema>;

export function actionChoiceEvents(choice: StagedActionChoice | null) {
  return choice && 'candidates' in choice ? (choice.candidates ?? []) : [];
}

export type ActivityRollField = 'check' | 'notoriety' | 'training' | 'delivery';

export function actionChoiceRolls(
  choice: StagedActionChoice | null,
): Partial<Record<ActivityRollField, RawRoll>> {
  return choice && 'rolls' in choice ? (choice.rolls ?? {}) : {};
}
