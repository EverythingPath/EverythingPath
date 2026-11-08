import { z } from 'zod';
import { weeklyDraftDataSchema } from './weekly-draft-contract';
import { editWeeklyDraft } from './weekly-draft';
import {
  stagedActionChoiceSchema,
  actionChoiceEvents,
} from './weekly-draft-facts';
import { weeklySourceKey } from './canonical-weekly-source';
import {
  DraftRejected,
  type DraftOperation,
  type DraftTargetRevision,
} from './weekly-draft-persistence-contract';
import type { WeeklyDraft, WeeklyDraftEdit } from './weekly-draft-contract';
import type { UpkeepSnapshot } from './rules-upkeep';
import {
  slotRemovalRejection,
  type SlotRemovalRejection,
} from './activity-slot-removal';

type Path = string[];
type Fields = Record<string, unknown>;
const fields = (value: unknown): Fields =>
  z.record(z.string(), z.unknown()).parse(value ?? {});
function changedFields(base: Fields, next: Fields): [string, ...string[]][] {
  return [...new Set([...Object.keys(base), ...Object.keys(next)])].flatMap(
    (key): [string, ...string[]][] => {
      if (key === 'rolls')
        return changedFields(fields(base.rolls), fields(next.rolls)).map(
          (path) => [key, ...path],
        );
      return weeklySourceKey(base[key]) === weeklySourceKey(next[key])
        ? []
        : [[key]];
    },
  );
}
function mergeFields(current: Fields, base: Fields, next: Fields) {
  const merged = structuredClone(current);
  for (const [key] of changedFields(base, next)) {
    if (key === 'rolls') {
      merged.rolls = mergeFields(
        fields(current.rolls),
        fields(base.rolls),
        fields(next.rolls),
      );
    } else if (next[key] === undefined) delete merged[key];
    else merged[key] = structuredClone(next[key]);
  }
  return merged;
}
function slotChoice(draft: WeeklyDraft, slotId: string) {
  const choice = draft.activity.slots.find(
    (slot) => slot.slotId === slotId,
  )?.choice;
  if (!choice) throw new DraftRejected('Obsolete choice');
  return choice;
}

// Both server and client use the same semantic field intent. The server obtains
// base from its own retained revision, never from caller-supplied targets/values.
export function rebaseDraftEdit(
  base: WeeklyDraft,
  current: WeeklyDraft,
  edit: WeeklyDraftEdit,
): WeeklyDraftEdit {
  if (edit.kind === 'detail') {
    const before = slotChoice(base, edit.slotId);
    const now = slotChoice(current, edit.slotId);
    if (
      now.choiceId !== edit.choiceId ||
      before.choiceId !== edit.choiceId ||
      now.actionId !== before.actionId
    )
      throw new DraftRejected('Obsolete choice');
    return {
      ...edit,
      choice: stagedActionChoiceSchema.parse(
        mergeFields(now, before, edit.choice),
      ),
    };
  }
  if (edit.kind === 'upkeep')
    return {
      kind: 'upkeep',
      inputs: weeklyDraftDataSchema.shape.upkeep.parse(
        mergeFields(current.upkeep, base.upkeep, edit.inputs),
      ),
    };
  return edit;
}
function persistentTarget(base: WeeklyDraft, eventId: string): Path {
  if (base.event.occurrences.some((event) => event.eventId === eventId))
    return ['event', 'tree', eventId, 'persistentDecision'];
  const slot = base.activity.slots.find((slot) =>
    actionChoiceEvents(slot.choice).some((event) => event.eventId === eventId),
  );
  return slot
    ? [
        'slot',
        slot.slotId,
        'choice',
        'candidates',
        eventId,
        'persistentDecision',
      ]
    : ['persistent', eventId];
}
function editTargets(base: WeeklyDraft, edit: WeeklyDraftEdit): Path[] {
  switch (edit.kind) {
    case 'stage':
    case 'replace':
    case 'clear':
    case 'add_slot':
    case 'remove_slot':
      return [['slot', edit.slotId]];
    case 'move':
    case 'swap':
      return [
        ['slot', edit.fromSlotId],
        ['slot', edit.toSlotId],
      ];
    case 'detail': {
      const paths = changedFields(slotChoice(base, edit.slotId), edit.choice);
      return (paths.length ? paths : [['noop']]).map((path) => [
        'slot',
        edit.slotId,
        'choice',
        ...path,
      ]);
    }
    case 'upkeep': {
      const paths = changedFields(base.upkeep, edit.inputs);
      return (paths.length ? paths : [['noop']]).map((path) => [
        'upkeep',
        ...path,
      ]);
    }
    case 'upkeep_roll':
      return [
        edit.field === 'notorietyCheck'
          ? ['upkeep', 'notorietyCheck']
          : ['upkeep', 'rolls', edit.field],
      ];
    case 'upkeep_settlement':
      return [['upkeep', 'nearestSettlementId']];
    case 'upkeep_team':
      return [
        ['upkeep', 'teamDecisions', edit.teamId],
        ['tableAdjustments', `upkeep-recovery:${edit.teamId}`],
      ];
    case 'upkeep_transfer':
      return [['upkeep', 'treasuryTransfers', edit.transfer.transferId]];
    case 'clear_upkeep_transfer':
      return [['upkeep', 'treasuryTransfers', edit.transferId]];
    case 'operating_settlement':
      return [['activity', 'operatingSettlementId']];
    case 'consumables':
      return [['activity', 'consumableIds']];
    case 'event_chance':
      return [['event', 'chanceRoll']];
    case 'event_occurrence':
      return [persistentTarget(base, edit.occurrence.eventId).slice(0, -1)];
    case 'event_tree':
      return [['event', 'tree']];
    case 'persistent_decision':
      return [
        persistentTarget(base, edit.decision.eventId),
        ...base.context.carriedEvents
          .filter((event) => event.eventId === edit.decision.eventId)
          .map((event) => ['context', 'carriedEvents', event.eventId]),
      ];
    case 'clear_persistent_decision':
      return [persistentTarget(base, edit.eventId)];
    case 'acknowledge':
      return [['acknowledgement', edit.acknowledgement.acknowledgementId]];
    case 'clear_acknowledgement':
      return [['acknowledgement', edit.acknowledgementId]];
    case 'rules_exception':
      return [['exception', edit.exception.exceptionId]];
    case 'clear_rules_exception':
      return [['exception', edit.exceptionId]];
    case 'table_adjustments':
      return [['tableAdjustments']];
    case 'receive_order':
    case 'clear_receipt':
      return [['receipt', edit.orderId]];
  }
}
function overlaps(first: Path, second: Path) {
  return first
    .slice(0, Math.min(first.length, second.length))
    .every((part, index) => part === second[index]);
}
export function requireUnchangedTargets(
  base: WeeklyDraft,
  targetRevisions: DraftTargetRevision[],
  operation: DraftOperation,
  ownRevisions: ReadonlySet<number> = new Set(),
) {
  const targets = editTargets(base, operation.edit);
  for (const changed of targetRevisions) {
    if (
      changed.revision <= operation.baseRevision ||
      ownRevisions.has(changed.revision)
    )
      continue;
    const path = z.array(z.string()).parse(JSON.parse(changed.target));
    if (targets.some((target) => overlaps(target, path)))
      throw new DraftRejected('Target changed');
  }
  return targets;
}
const slotRemovalMessages: Record<SlotRemovalRejection, string> = {
  unknown_slot: 'Unknown slot',
  occupied_slot: 'Slot is occupied',
  within_allowance: 'Slot is within the action allowance',
  allowance_unknown: 'Action allowance is not final',
};
// `source` is the authoritative week-start militia snapshot. Removal checks
// the latest accepted draft, never only the operation's retained base.
export function acceptDraftOperation(
  current: WeeklyDraft,
  base: WeeklyDraft,
  targetRevisions: DraftTargetRevision[],
  operation: DraftOperation,
  source: UpkeepSnapshot,
) {
  if (
    operation.draftId !== current.draftId ||
    base.draftId !== current.draftId ||
    base.revision !== operation.baseRevision ||
    base.revision > current.revision
  )
    throw new DraftRejected('Invalid draft revision');
  const requested = editWeeklyDraft(base, operation.edit);
  if (!requested.ok) throw new DraftRejected(requested.error);
  const targets = requireUnchangedTargets(base, targetRevisions, operation);
  if (operation.edit.kind === 'remove_slot') {
    const rejection = slotRemovalRejection(
      current,
      source,
      operation.edit.slotId,
    );
    if (rejection) throw new DraftRejected(slotRemovalMessages[rejection]);
  }
  const result = editWeeklyDraft(
    current,
    rebaseDraftEdit(base, current, operation.edit),
  );
  if (!result.ok) throw new DraftRejected(result.error);
  const metadata = new Map(
    targetRevisions.map((entry) => [entry.target, entry.revision]),
  );
  for (const target of targets)
    metadata.set(JSON.stringify(target), result.draft.revision);
  return {
    draft: result.draft,
    targets: targets.map((target) => JSON.stringify(target)),
    targetRevisions: [...metadata].map(([target, revision]) => ({
      target,
      revision,
    })),
  };
}
