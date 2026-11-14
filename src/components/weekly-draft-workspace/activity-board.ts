import teamTable from '~/lib/militia-team-table';
import { actionTeamTypes } from '~/lib/rules-action-teams';
import {
  actionChoiceRolls,
  stagedActionChoiceSchema,
  type RawRoll,
  type StagedActionChoice,
} from '~/lib/weekly-draft-facts';
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import type { ActivityTeamFact, ActivityView } from './types';

type Slot = ActivityView['slots'][number];
type ActionId = StagedActionChoice['actionId'];
export type PickerGroupId = 'ready-team' | 'no-team' | 'needs-exception';
export type PickerCard = {
  actionId: ActionId;
  name: string;
  // Guidance under the card name: which teams can take it now, or why the
  // rules would need an exception. Groups guide; they never filter.
  note: string | null;
};
export type PickerGroup = {
  id: PickerGroupId;
  title: string;
  cards: PickerCard[];
};
export type TeamOption = {
  teamId: string;
  name: string;
  // Type and tier, then Free / Acts in Action Slot N / Disabled / Missing.
  detail: string;
  eligible: boolean;
};
export type MoveTarget = {
  slotId: string;
  kind: 'move' | 'swap';
  label: string;
};

const groupTitles: Record<PickerGroupId, string> = {
  'ready-team': 'A ready team can take these',
  'no-team': 'No team needed',
  'needs-exception': 'No ready team (needs a Rules Exception)',
};

function typeName(teamType: string) {
  return teamTable.find((entry) => entry.id === teamType)?.name ?? teamType;
}
function list(names: string[]) {
  return names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} or ${names.at(-1)}`;
}

// Where a team already acts this Activity, other than in `slotId`: acting,
// being upgraded or being dismissed all use it up.
function teamUse(view: ActivityView, teamId: string, slotId: string) {
  return view.slots.find(
    (slot) =>
      slot.slotId !== slotId &&
      slot.choice &&
      (slot.choice.teamId === teamId ||
        ('targetTeamId' in slot.choice && slot.choice.targetTeamId === teamId)),
  );
}

function isTeamReady(
  view: ActivityView,
  team: ActivityTeamFact,
  slot: Slot,
): boolean {
  return (
    team.condition === 'active' &&
    !team.unavailable &&
    (team.recruitedInSlot === null || team.recruitedInSlot < slot.number) &&
    !teamUse(view, team.teamId, slot.slotId)
  );
}

// Every Activity action, grouped by whether a ready team at this slot's
// position could take it. A group is guidance: every card stays selectable.
export function activityPickerGroups(
  view: ActivityView,
  slotId: string,
): PickerGroup[] {
  const slot = view.slots.find((entry) => entry.slotId === slotId);
  const groups: Record<PickerGroupId, PickerCard[]> = {
    'ready-team': [],
    'no-team': [],
    'needs-exception': [],
  };
  for (const action of view.actions) {
    const types = actionTeamTypes(action.actionId);
    const drill =
      action.actionId === 'drill_militia'
        ? view.slots.find(
            (entry) =>
              entry.slotId !== slotId &&
              entry.choice?.actionId === 'drill_militia',
          )
        : undefined;
    const blocked = view.blockedActions.includes(action.actionId)
      ? 'An event blocks this action this Activity.'
      : drill
        ? `Already chosen in Action Slot ${drill.number} (once per Activity).`
        : null;
    if (!types) {
      groups['no-team'].push({ ...action, note: blocked });
      continue;
    }
    const ready = slot
      ? view.teamRoster.filter(
          (team) =>
            team.teamType !== null &&
            // Safe cast: includes only compares; a team type outside types
            // yields false.
            types.includes(team.teamType as (typeof types)[number]) &&
            isTeamReady(view, team, slot),
        )
      : [];
    groups[ready.length ? 'ready-team' : 'needs-exception'].push({
      ...action,
      note:
        blocked ??
        (ready.length
          ? `Ready: ${list(ready.map((team) => team.name))}`
          : `Needs a ready ${list(types.map(typeName))} team`),
    });
  }
  return (['ready-team', 'no-team', 'needs-exception'] as const).map((id) => ({
    id,
    title: groupTitles[id],
    cards: groups[id],
  }));
}

// Teams for the slot's choice: rules-eligible ready teams first, then every
// other team with its warning state. Nothing is disabled; the rules warn.
export function activityTeamOptions(
  view: ActivityView,
  slotId: string,
): { eligible: TeamOption[]; other: TeamOption[] } {
  const slot = view.slots.find((entry) => entry.slotId === slotId);
  const types = slot?.choice ? actionTeamTypes(slot.choice.actionId) : null;
  // Special accepts an optional team of any type.
  const anyType = slot?.choice?.actionId === 'special';
  const options = view.teamRoster.flatMap((team) => {
    if (!slot) return [];
    if (team.recruitedInSlot === slot.number) return [];
    const use = teamUse(view, team.teamId, slotId);
    const kind = [team.typeName, team.tier].filter(Boolean).join(' ');
    const state =
      team.recruitedInSlot !== null
        ? team.recruitedInSlot < slot.number
          ? `Recruited in Action Slot ${team.recruitedInSlot}`
          : `Recruited later, in Action Slot ${team.recruitedInSlot}`
        : team.condition === 'disabled'
          ? 'Disabled'
          : team.condition === 'missing'
            ? 'Missing'
            : team.condition !== 'active'
              ? 'Unavailable'
              : team.unavailable
                ? 'Unavailable this Activity'
                : use
                  ? `Acts in Action Slot ${use.number}`
                  : 'Free';
    return [
      {
        teamId: team.teamId,
        name: team.name,
        detail: [kind, state].filter(Boolean).join(' · '),
        eligible:
          (anyType ||
            (types !== null &&
              team.teamType !== null &&
              // Safe cast: includes only compares; a team type outside types
              // yields false.
              types.includes(team.teamType as (typeof types)[number]))) &&
          isTeamReady(view, team, slot),
      },
    ];
  });
  return {
    eligible: options.filter((option) => option.eligible),
    other: options.filter((option) => !option.eligible),
  };
}

export function activityMoveTargets(
  view: ActivityView,
  slotId: string,
): MoveTarget[] {
  return view.slots.flatMap((slot) =>
    slot.slotId === slotId
      ? []
      : [
          slot.choice
            ? {
                slotId: slot.slotId,
                kind: 'swap' as const,
                label: `Swap with Action Slot ${slot.number} · ${slot.actionName}`,
              }
            : {
                slotId: slot.slotId,
                kind: 'move' as const,
                label: `Action Slot ${slot.number} (empty)`,
              },
        ],
  );
}

// A new choice gets its identities once, when it is created.
export function newChoice(
  actionId: ActionId,
  startDay: number,
): StagedActionChoice {
  return stagedActionChoiceSchema.parse({
    choiceId: crypto.randomUUID(),
    actionId,
    ...(actionId === 'special_order'
      ? { orderId: crypto.randomUUID(), orderedDay: startDay }
      : {}),
  });
}

export function placeEdit(
  slot: Slot,
  actionId: ActionId,
  startDay: number,
): WeeklyDraftEdit {
  const choice = newChoice(actionId, startDay);
  return slot.choice
    ? {
        kind: 'replace',
        slotId: slot.slotId,
        choiceId: slot.choice.choiceId,
        choice,
      }
    : { kind: 'stage', slotId: slot.slotId, choice };
}

export function moveEdit(from: Slot, to: Slot): WeeklyDraftEdit | null {
  if (!from.choice || from.slotId === to.slotId) return null;
  return to.choice
    ? {
        kind: 'swap',
        fromSlotId: from.slotId,
        toSlotId: to.slotId,
        choiceId: from.choice.choiceId,
        otherChoiceId: to.choice.choiceId,
      }
    : {
        kind: 'move',
        fromSlotId: from.slotId,
        toSlotId: to.slotId,
        choiceId: from.choice.choiceId,
      };
}

// A detail edit carries the complete choice; omitting a field clears it.
function detailEdit(
  slot: Slot,
  change: (choice: Record<string, unknown>) => void,
): WeeklyDraftEdit | null {
  if (!slot.choice) return null;
  const next: Record<string, unknown> = structuredClone(slot.choice);
  change(next);
  const parsed = stagedActionChoiceSchema.safeParse(next);
  return parsed.success
    ? {
        kind: 'detail',
        slotId: slot.slotId,
        choiceId: slot.choice.choiceId,
        choice: parsed.data,
      }
    : null;
}

export function teamEdit(slot: Slot, teamId: string | null) {
  return detailEdit(slot, (choice) => {
    if (teamId === null) delete choice.teamId;
    else choice.teamId = teamId;
  });
}

// Writes or clears the check roll within the choice's own rolls.
export function checkRollEdit(slot: Slot, roll: RawRoll | null) {
  return detailEdit(slot, (choice) => {
    // Safe cast: rolls is a plain object of named rolls; only its own entries
    // are copied.
    const rolls = { ...(choice.rolls as Record<string, unknown>) };
    if (roll) rolls.check = roll;
    else delete rolls.check;
    if (Object.keys(rolls).length) choice.rolls = rolls;
    else delete choice.rolls;
  });
}

type Modifier = RawRoll['modifiers'][number];
function modifiersEdit(
  slot: Slot,
  change: (modifiers: Modifier[]) => Modifier[],
) {
  const roll = slot.choice ? actionChoiceRolls(slot.choice).check : undefined;
  if (!roll) return null;
  return checkRollEdit(slot, { ...roll, modifiers: change(roll.modifiers) });
}

export function addModifierEdit(slot: Slot, modifier: Modifier) {
  return modifiersEdit(slot, (modifiers) => [...modifiers, modifier]);
}

// Removes exactly the recorded entry at `index`, including retained legacy
// or duplicate entries, leaving every other modifier untouched.
export function removeModifierEdit(slot: Slot, index: number) {
  return modifiersEdit(slot, (modifiers) =>
    modifiers.filter((_, position) => position !== index),
  );
}

export function helpfulModifier(settlementName: string): Modifier {
  return {
    sourceId: 'helpful',
    value: 2,
    reason: `Helpful settlement support (${settlementName})`,
  };
}

// Moving Helpful uses ordered existing edits: first clear it from every other
// check, then assign it here. The caller sends each clear and stops at the
// first failure; the assignment is built afterwards from fresh facts.
export function helpfulClearEdits(view: ActivityView, targetSlotId: string) {
  return view.slots.flatMap((slot) => {
    if (slot.slotId === targetSlotId) return [];
    const edit = slot.modifiers.some((entry) => entry.kind === 'helpful')
      ? modifiersEdit(slot, (modifiers) =>
          modifiers.filter((modifier) => modifier.sourceId !== 'helpful'),
        )
      : null;
    return edit ? [{ slotNumber: slot.number, edit }] : [];
  });
}

export function helpfulAssignEdit(view: ActivityView, slotId: string) {
  const slot = view.slots.find((entry) => entry.slotId === slotId);
  const helpful = view.helpful;
  if (!slot || !helpful) return null;
  // Already here: nothing to add. Several entries on this one check are
  // reduced to one instead of adding another.
  return modifiersEdit(slot, (modifiers) => {
    const first = modifiers.findIndex((entry) => entry.sourceId === 'helpful');
    return first < 0
      ? [...modifiers, helpfulModifier(helpful.settlementName)]
      : modifiers.filter(
          (entry, index) => entry.sourceId !== 'helpful' || index === first,
        );
  });
}
