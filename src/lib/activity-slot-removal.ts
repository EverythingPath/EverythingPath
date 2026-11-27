import { projectActivity, type ActivityProjection } from './rules-activity';
import { projectUpkeep, type UpkeepSnapshot } from './rules-upkeep';
import type { WeeklyDraft } from './weekly-draft-contract';

export type SlotRemovalRejection =
  | 'unknown_slot'
  | 'occupied_slot'
  | 'within_allowance'
  | 'allowance_unknown';

// The one predicate for removing an Action Slot, shared by presentation and
// the persistence authorities. Only an empty slot whose position lies beyond
// the rules-derived allowance qualifies. While Upkeep is incomplete the rank
// (and so the allowance) can still change, and an unapplied earlier officer
// change can still move the Strategist's action: removal then never guesses
// that a slot is extra.
export function slotRemovalRejectionFrom(
  draft: WeeklyDraft,
  upkeep: Pick<ReturnType<typeof projectUpkeep>, 'skipped' | 'ready'>,
  activity: Pick<ActivityProjection, 'slots'>,
  slotId: string,
): SlotRemovalRejection | null {
  const index = draft.activity.slots.findIndex(
    (slot) => slot.slotId === slotId,
  );
  const slot = draft.activity.slots[index];
  if (!slot) return 'unknown_slot';
  if (slot.choice) return 'occupied_slot';
  const position = activity.slots[index];
  if (
    (!upkeep.skipped && !upkeep.ready) ||
    position?.slotId !== slotId ||
    !position.allowanceKnown
  )
    return 'allowance_unknown';
  return position.beyondAllowance ? null : 'within_allowance';
}

// Authoritative form: projects the given draft (the latest accepted revision
// before the edit) from the week-start militia snapshot.
export function slotRemovalRejection(
  draft: WeeklyDraft,
  snapshot: UpkeepSnapshot,
  slotId: string,
): SlotRemovalRejection | null {
  const upkeep = projectUpkeep(draft, snapshot);
  return slotRemovalRejectionFrom(
    draft,
    upkeep,
    projectActivity(draft, upkeep.outcome),
    slotId,
  );
}
