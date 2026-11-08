import type { WeeklyDraft, WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import type { RawRoll } from '~/lib/weekly-draft-facts';
import type { PersistentRetainedField, RivalrySkill } from './types';

// The semantic edits behind a carried event's check fields. Each changes one
// field of the saved check decision and keeps every other recorded value,
// including Overseer support and fields this check does not use.
// Nothing here rebuilds a decision from the visible fields alone.

type Decision = WeeklyDraft['persistent']['decisions'][number];
export type Mitigation = Extract<Decision, { kind: 'mitigate' }>;
type OfficerCheck = NonNullable<Mitigation['officerCheck']>;
export type RollModifier = RawRoll['modifiers'][number];
export type CheckRoll = 'theft' | 'rivalry';

const send = (decision: Mitigation): WeeklyDraftEdit => ({
  kind: 'persistent_decision',
  decision,
});

/** Theft's Loyalty roll; null clears it with the modifiers it records. */
export function theftRollEdit(
  decision: Mitigation,
  roll: RawRoll | null,
): WeeklyDraftEdit {
  const next = structuredClone(decision);
  const rolls = { ...next.rolls };
  if (roll) rolls.check = roll;
  else delete rolls.check;
  if (Object.keys(rolls).length) next.rolls = rolls;
  else delete next.rolls;
  return send(next);
}

type OfficerField =
  | { field: 'characterId'; value: string }
  | { field: 'skill'; value: RivalrySkill }
  | { field: 'skillBonus'; value: number | null }
  | { field: 'roll'; value: RawRoll | null };

/**
 * One Rivalry officer-check field. The stored check needs its character and
 * skill, so until both are known the edit waits (null) and `pending` holds
 * the one chosen so far; a blank skill bonus or roll is cleared, not zeroed.
 */
export function officerCheckEdit(
  decision: Mitigation,
  change: OfficerField,
  pending: { characterId?: string; skill?: RivalrySkill } = {},
): WeeklyDraftEdit | null {
  const next = structuredClone(decision);
  const current: Partial<OfficerCheck> = next.officerCheck ?? {
    ...(pending.characterId ? { characterId: pending.characterId } : {}),
    ...(pending.skill ? { skill: pending.skill } : {}),
  };
  if (change.value === null) delete current[change.field];
  else Object.assign(current, { [change.field]: change.value });
  const { characterId, skill } = current;
  if (!characterId || !skill) return null;
  next.officerCheck = { ...current, characterId, skill };
  return send(next);
}

function checkRoll(decision: Mitigation, check: CheckRoll) {
  return check === 'theft'
    ? decision.rolls?.check
    : decision.officerCheck?.roll;
}

/**
 * The modifiers recorded on a check's roll, replaced as a list. A modifier
 * belongs to its roll, so there is nothing to edit (null) before the roll.
 */
export function checkModifiersEdit(
  decision: Mitigation,
  check: CheckRoll,
  modifiers: RollModifier[],
): WeeklyDraftEdit | null {
  const next = structuredClone(decision);
  if (check === 'theft') {
    const roll = next.rolls?.check;
    if (!roll) return null;
    next.rolls = { ...next.rolls, check: { ...roll, modifiers } };
  } else {
    const officer = next.officerCheck;
    if (!officer?.roll) return null;
    next.officerCheck = { ...officer, roll: { ...officer.roll, modifiers } };
  }
  return send(next);
}

export const newModifierSource = () => `custom:${crypto.randomUUID()}`;

// A recorded modifier as the player saw it: its position then, and its
// source, amount and reason.
export type ShownModifier = RollModifier & { index: number };
const sameModifier = (entry: RollModifier, shown: ShownModifier) =>
  entry.sourceId === shown.sourceId &&
  entry.value === shown.value &&
  entry.reason === shown.reason;

// Where the shown modifier is now: its old position if it is still there,
// else wherever that same entry moved; -1 once it is gone or changed.
function locate(current: RollModifier[], shown: ShownModifier) {
  const there = current[shown.index];
  if (there && sameModifier(there, shown)) return shown.index;
  return current.findIndex((entry) => sameModifier(entry, shown));
}

export type ModifierChange =
  | { kind: 'add'; modifier: RollModifier }
  | { kind: 'edit'; shown: ShownModifier; value: number; reason: string }
  | { kind: 'remove'; shown: ShownModifier };

/**
 * One check's modifier list after adding, editing or removing an entry. An
 * edit or removal finds the entry the player saw in the newest list, so a
 * peer's earlier change never redirects it; null when it no longer exists.
 */
export function modifierList(
  decision: Mitigation,
  check: CheckRoll,
  change: ModifierChange,
): RollModifier[] | null {
  const current = checkRoll(decision, check)?.modifiers;
  if (!current) return null;
  if (change.kind === 'add') return [...current, change.modifier];
  const at = locate(current, change.shown);
  if (at < 0) return null;
  if (change.kind === 'remove')
    return current.filter((_, index) => index !== at);
  // The entry keeps its source identity; only the amount and reason change.
  return current.map((entry, index) =>
    index === at
      ? { ...entry, value: change.value, reason: change.reason }
      : entry,
  );
}

/** Removes one recorded field this event's check does not use. */
export function clearRetainedEdit(
  decision: Mitigation,
  field: PersistentRetainedField,
): WeeklyDraftEdit {
  const next = structuredClone(decision);
  delete next[field];
  return send(next);
}
