import { actionChoiceEvents } from './weekly-draft-facts';
import {
  weeklyDraftSchema,
  weeklyDraftEditSchema,
  type WeeklyDraft,
  type WeeklyDraftEdit,
  type WeekStartFacts,
} from './weekly-draft-contract';

export function createWeeklyDraft(input: {
  draftId: string;
  week: number;
  context: WeekStartFacts;
  slotIds: string[];
}): WeeklyDraft {
  return weeklyDraftSchema.parse({
    draftId: input.draftId,
    week: input.week,
    context: {
      ...input.context,
      persistentPhaseEligible: input.context.carriedEvents.length > 0,
    },
    revision: 0,
    activity: {
      slots: input.slotIds.map((slotId) => ({ slotId, choice: null })),
    },
  });
}
export function editWeeklyDraft(
  draft: WeeklyDraft,
  input: WeeklyDraftEdit,
): { ok: true; draft: WeeklyDraft } | { ok: false; error: string } {
  const parsed = weeklyDraftEditSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_edit' };
  const edit = parsed.data;
  const source = weeklyDraftSchema.safeParse(draft);
  if (!source.success) return { ok: false, error: 'invalid_draft' };
  const next = source.data;
  const error = applyDraftEdit(next, edit);
  if (error) return { ok: false, error };
  next.revision++;
  const result = weeklyDraftSchema.safeParse(next);
  return result.success
    ? { ok: true, draft: result.data }
    : { ok: false, error: 'invalid_draft' };
}

type DraftEditByKind = {
  [Kind in WeeklyDraftEdit['kind']]: Extract<WeeklyDraftEdit, { kind: Kind }>;
};
const draftEditHandlers: {
  [Kind in keyof DraftEditByKind]: (
    next: WeeklyDraft,
    edit: DraftEditByKind[Kind],
  ) => string | void;
} = {
  add_slot: (next, edit) => {
    next.activity.slots.push({ slotId: edit.slotId, choice: null });
  },
  remove_slot: (next, edit) => {
    const index = next.activity.slots.findIndex(
      (slot) => slot.slotId === edit.slotId,
    );
    const slot = next.activity.slots[index];
    if (!slot) return 'unknown_slot';
    if (slot.choice) return 'occupied_slot';
    next.activity.slots.splice(index, 1);
  },
  upkeep_roll: (next, edit) => {
    if (edit.field === 'notorietyCheck') {
      if (edit.roll === null) delete next.upkeep.notorietyCheck;
      else next.upkeep.notorietyCheck = edit.roll;
    } else if (edit.roll === null) delete next.upkeep.rolls[edit.field];
    else next.upkeep.rolls[edit.field] = edit.roll;
  },
  upkeep_settlement: (next, edit) => {
    if (edit.settlementId === null) delete next.upkeep.nearestSettlementId;
    else next.upkeep.nearestSettlementId = edit.settlementId;
  },
  upkeep_team: (next, edit) => {
    if (edit.decision && edit.decision.teamId !== edit.teamId)
      return 'invalid_team';
    next.upkeep.teamDecisions = next.upkeep.teamDecisions.filter(
      (item) => item.teamId !== edit.teamId,
    );
    if (edit.decision) next.upkeep.teamDecisions.push(edit.decision);
    const adjustmentId = `upkeep-recovery:${edit.teamId}`;
    if (
      edit.recoveryAdjustment !== undefined ||
      edit.decision?.decision !== 'recover'
    ) {
      const index = next.tableAdjustments.findIndex(
        (item) => item.adjustmentId === adjustmentId,
      );
      const adjustment =
        edit.decision?.decision === 'recover' && edit.recoveryAdjustment
          ? {
              kind: 'militia_value' as const,
              adjustmentId,
              field: 'treasuryCopper' as const,
              operation: 'add' as const,
              value: edit.recoveryAdjustment.deltaCopper,
              reason: edit.recoveryAdjustment.reason,
            }
          : null;
      if (index >= 0) {
        if (adjustment) next.tableAdjustments[index] = adjustment;
        else next.tableAdjustments.splice(index, 1);
      } else if (adjustment) next.tableAdjustments.push(adjustment);
    }
  },
  upkeep_transfer: (next, edit) => {
    const index = next.upkeep.treasuryTransfers.findIndex(
      (item) => item.transferId === edit.transfer.transferId,
    );
    if (index < 0) next.upkeep.treasuryTransfers.push(edit.transfer);
    else next.upkeep.treasuryTransfers[index] = edit.transfer;
  },
  clear_upkeep_transfer: (next, edit) => {
    next.upkeep.treasuryTransfers = next.upkeep.treasuryTransfers.filter(
      (item) => item.transferId !== edit.transferId,
    );
  },
  upkeep: (next, edit) => {
    next.upkeep = edit.inputs;
  },
  operating_settlement: (next, edit) => {
    if (edit.settlementId === null) delete next.activity.operatingSettlementId;
    else next.activity.operatingSettlementId = edit.settlementId;
  },
  consumables: (next, edit) => {
    next.activity.consumableIds = edit.consumableIds;
  },
  event_chance: (next, edit) => {
    if (edit.roll === null) delete next.event.chanceRoll;
    else next.event.chanceRoll = edit.roll;
  },
  event_occurrence: (next, edit) => {
    const event = currentEvent(next, edit.occurrence.eventId);
    if (
      !event ||
      JSON.stringify(event.origin) !== JSON.stringify(edit.occurrence.origin)
    )
      return 'obsolete_event';
    for (const key of Object.keys(event)) Reflect.deleteProperty(event, key);
    Object.assign(event, edit.occurrence);
    delete event.reviewRequired;
  },
  event_tree: (next, edit) => {
    next.event.occurrences = edit.occurrences.map(
      ({ reviewRequired: _review, ...event }) => event,
    );
  },
  persistent_decision: (next, edit) => {
    if (
      next.context.carriedEvents.some(
        (event) =>
          event.eventId === edit.decision.eventId && event.reviewRequired,
      )
    )
      next.context = {
        ...next.context,
        carriedEvents: next.context.carriedEvents.map((event) => {
          if (event.eventId !== edit.decision.eventId) return event;
          const { reviewRequired: _review, ...reviewed } = event;
          return reviewed;
        }),
      };
    const decision = { ...edit.decision };
    if (decision.kind === 'mitigate') delete decision.reviewRequired;
    const event = currentEvent(next, edit.decision.eventId);
    if (event) {
      event.persistentDecision = decision;
      return;
    }
    next.persistent.decisions = next.persistent.decisions
      .filter((value) => value.eventId !== edit.decision.eventId)
      .concat(decision);
  },
  clear_persistent_decision: (next, edit) => {
    const event = currentEvent(next, edit.eventId);
    if (event) delete event.persistentDecision;
    next.persistent.decisions = next.persistent.decisions.filter(
      (value) => value.eventId !== edit.eventId,
    );
  },
  acknowledge: (next, edit) => {
    next.acknowledgements = next.acknowledgements
      .filter(
        (value) =>
          value.acknowledgementId !== edit.acknowledgement.acknowledgementId,
      )
      .concat(edit.acknowledgement);
  },
  clear_acknowledgement: (next, edit) => {
    next.acknowledgements = next.acknowledgements.filter(
      (value) => value.acknowledgementId !== edit.acknowledgementId,
    );
  },
  rules_exception: (next, edit) => {
    next.rulesExceptions = next.rulesExceptions
      .filter((value) => value.exceptionId !== edit.exception.exceptionId)
      .concat(edit.exception);
  },
  clear_rules_exception: (next, edit) => {
    next.rulesExceptions = next.rulesExceptions.filter(
      (value) => value.exceptionId !== edit.exceptionId,
    );
  },
  table_adjustments: (next, edit) => {
    next.tableAdjustments = edit.adjustments;
  },
  receive_order: (next, edit) => {
    if (next.orderReceipts.some((receipt) => receipt.orderId === edit.orderId))
      return 'already_received';
    next.orderReceipts.push({
      orderId: edit.orderId,
      receivedDay: edit.receivedDay,
      acknowledgementId: edit.acknowledgementId,
    });
  },
  clear_receipt: (next, edit) => {
    next.orderReceipts = next.orderReceipts.filter(
      (receipt) => receipt.orderId !== edit.orderId,
    );
  },
  stage: editActionSlot,
  replace: editActionSlot,
  detail: editActionSlot,
  clear: editActionSlot,
  move: editActionSlot,
  swap: editActionSlot,
};

function applyDraftEdit<Kind extends keyof DraftEditByKind>(
  next: WeeklyDraft,
  edit: DraftEditByKind[Kind],
) {
  return draftEditHandlers[edit.kind](next, edit);
}

type ActionSlotEdit = Extract<
  WeeklyDraftEdit,
  { kind: 'stage' | 'replace' | 'detail' | 'clear' | 'move' | 'swap' }
>;
function editActionSlot(
  next: WeeklyDraft,
  edit: ActionSlotEdit,
): string | undefined {
  const slot = next.activity.slots.find(
    (slot) =>
      slot.slotId === ('slotId' in edit ? edit.slotId : edit.fromSlotId),
  );
  if (!slot) return 'unknown_slot';
  if (edit.kind === 'stage') {
    if (slot.choice) return 'occupied_slot';
  } else if (slot.choice?.choiceId !== edit.choiceId) {
    return 'obsolete_choice';
  }
  return applySlotEdit(next, slot, edit);
}

type ActionSlot = WeeklyDraft['activity']['slots'][number];
function applySlotEdit(
  next: WeeklyDraft,
  slot: ActionSlot,
  edit: ActionSlotEdit,
) {
  switch (edit.kind) {
    case 'stage':
    case 'replace':
      if (
        next.activity.slots.some(
          (s) => s.choice?.choiceId === edit.choice.choiceId,
        )
      )
        return 'duplicate_choice';
      slot.choice = edit.choice;
      break;
    case 'detail':
      return updateChoiceDetails(slot, edit);
    case 'clear':
      slot.choice = null;
      break;
    case 'move':
    case 'swap':
      return transferChoice(next, slot, edit);
  }
}

function updateChoiceDetails(
  slot: ActionSlot,
  edit: Extract<ActionSlotEdit, { kind: 'detail' }>,
) {
  if (
    edit.choice.choiceId !== edit.choiceId ||
    edit.choice.actionId !== slot.choice?.actionId
  )
    return 'choice_mismatch';
  const { reviewRequired: _review, ...reviewedChoice } = edit.choice;
  slot.choice = reviewedChoice;
}

function transferChoice(
  next: WeeklyDraft,
  slot: ActionSlot,
  edit: Extract<ActionSlotEdit, { kind: 'move' | 'swap' }>,
) {
  const target = next.activity.slots.find((s) => s.slotId === edit.toSlotId);
  if (!target) return 'unknown_slot';
  if (target === slot) return 'same_slot';
  if (edit.kind === 'move' && target.choice) return 'occupied_slot';
  if (edit.kind === 'swap' && target.choice?.choiceId !== edit.otherChoiceId)
    return 'obsolete_choice';
  [slot.choice, target.choice] = [target.choice, slot.choice];
}

function currentEvent(draft: WeeklyDraft, eventId: string) {
  return draft.event.occurrences
    .concat(
      draft.activity.slots.flatMap((slot) => actionChoiceEvents(slot.choice)),
    )
    .find((event) => event.eventId === eventId);
}
