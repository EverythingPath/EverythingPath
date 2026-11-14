'use client';
import { useRef, useState } from 'react';
import type { RawRoll, StagedActionChoice } from '~/lib/weekly-draft-facts';
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import {
  activityMoveTargets,
  activityPickerGroups,
  activityTeamOptions,
  addModifierEdit,
  checkRollEdit,
  helpfulAssignEdit,
  helpfulClearEdits,
  moveEdit,
  placeEdit,
  removeModifierEdit,
  teamEdit,
} from './activity-board';
import type { ActivityView } from './types';

type EditResult = 'accepted' | 'failed';
export type ActivityEdit = (edit: WeeklyDraftEdit) => Promise<EditResult>;
type Picker = {
  slotId: string;
  // Replace targets the choice seen when the picker opened; stage an empty slot.
  choiceId: string | null;
};
export type HelpfulStatus =
  | { state: 'idle' }
  | { state: 'moving'; slotId: string }
  | { state: 'failed'; slotId: string; message: string };

// Local Activity presentation state: the selected slot, the open picker, the
// Helpful move and focus return. Nothing here is shared; every change goes
// through the Workspace's ordinary edits, and the frame reports saving.
// `latest` reads the Workspace's current Activity facts after an awaited
// edit, so a follow-up edit starts from the newest accepted and pending
// choice instead of the facts captured when the player tapped.
export function useActivityBoard({
  view,
  edit,
  disabled,
  latest,
}: {
  view: ActivityView;
  edit: ActivityEdit;
  disabled: boolean;
  latest?: () => ActivityView | null;
}) {
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [picker, setPicker] = useState<Picker | null>(null);
  const [helpful, setHelpful] = useState<HelpfulStatus>({ state: 'idle' });
  const slotNodes = useRef(new Map<string, HTMLElement>());
  // The slot whose picker is open; closing returns focus to it (ACT-02).
  const pickerOrigin = useRef<string | null>(null);
  const current = () => latest?.() ?? view;
  const slotById = (slotId: string | null) =>
    view.slots.find((slot) => slot.slotId === slotId);

  // A selection or picker whose slot changed elsewhere (removed, emptied,
  // refilled, replaced) is closed rather than redirected to another choice.
  const selected = slotById(selectedSlotId);
  const selectedSlot = selected?.choice ? selected : null;
  const pickerSlot = picker ? slotById(picker.slotId) : undefined;
  const pickerOpen =
    picker !== null &&
    pickerSlot !== undefined &&
    (picker.choiceId === null
      ? pickerSlot.choice === null
      : pickerSlot.choice?.choiceId === picker.choiceId);
  const pickerNotice =
    picker !== null && !pickerOpen
      ? `${pickerSlot ? `Action Slot ${pickerSlot.number}` : 'That Action Slot'} changed on another device, so the action picker closed. Nothing was placed.`
      : null;

  function focusSlot(slotId: string | undefined) {
    if (slotId) slotNodes.current.get(slotId)?.focus();
  }
  function send(next: WeeklyDraftEdit | null) {
    if (disabled || !next) return Promise.resolve<EditResult>('failed');
    return edit(next);
  }

  return {
    selectedSlot,
    picker: pickerOpen
      ? {
          slot: pickerSlot,
          mode: picker.choiceId ? ('replace' as const) : ('stage' as const),
          groups: activityPickerGroups(view, picker.slotId),
        }
      : null,
    pickerNotice,
    helpful,
    registerSlot(slotId: string, node: HTMLElement | null) {
      if (node) slotNodes.current.set(slotId, node);
      else slotNodes.current.delete(slotId);
    },
    // Tapping an empty slot opens the picker for it; an occupied slot shows
    // its details below the board.
    activateSlot(slotId: string) {
      const slot = slotById(slotId);
      if (!slot) return;
      if (slot.choice) {
        setPicker(null);
        setSelectedSlotId(slotId);
      } else {
        setSelectedSlotId(null);
        if (disabled) return;
        pickerOrigin.current = slotId;
        setPicker({ slotId, choiceId: null });
      }
    },
    changeAction(slotId: string) {
      const slot = slotById(slotId);
      if (!slot?.choice || disabled) return;
      pickerOrigin.current = slotId;
      setPicker({ slotId, choiceId: slot.choice.choiceId });
    },
    // The sheet has no trigger of its own, so however it closes (Escape,
    // a pick, or a change elsewhere) focus goes back to the slot card.
    returnPickerFocus() {
      focusSlot(pickerOrigin.current ?? undefined);
      pickerOrigin.current = null;
    },
    // Closing or Escape cancels without editing.
    closePicker() {
      setPicker(null);
    },
    pick(actionId: StagedActionChoice['actionId']) {
      if (!pickerOpen || !pickerSlot || disabled) return;
      void send(placeEdit(pickerSlot, actionId, view.startDay));
      setPicker(null);
      setSelectedSlotId(pickerSlot.slotId);
    },
    moveTargets: (slotId: string) => activityMoveTargets(view, slotId),
    moveTo(fromSlotId: string, toSlotId: string) {
      const from = slotById(fromSlotId);
      const to = slotById(toSlotId);
      if (!from || !to) return;
      void send(moveEdit(from, to));
      // The details follow the moved choice.
      setSelectedSlotId(toSlotId);
    },
    reviewChoice(this: void, slotId: string) {
      const slot = current().slots.find((item) => item.slotId === slotId);
      const choice = slot?.choice;
      if (!choice?.reviewRequired) return Promise.resolve<EditResult>('failed');
      return send({
        kind: 'detail',
        slotId,
        choiceId: choice.choiceId,
        choice: { ...choice },
      });
    },
    clear(slotId: string) {
      const slot = slotById(slotId);
      if (!slot?.choice) return;
      void send({
        kind: 'clear',
        slotId,
        choiceId: slot.choice.choiceId,
      });
      setSelectedSlotId(null);
      focusSlot(slotId);
    },
    addSlot() {
      void send({ kind: 'add_slot', slotId: crypto.randomUUID() });
    },
    // Removing a slot is distinct from clearing its choice; focus moves to the
    // nearest surviving slot.
    removeSlot(slotId: string) {
      const index = view.slots.findIndex((slot) => slot.slotId === slotId);
      const slot = view.slots[index];
      if (!slot?.removable) return;
      const neighbour = view.slots[index - 1] ?? view.slots[index + 1];
      void send({ kind: 'remove_slot', slotId });
      if (selectedSlotId === slotId) setSelectedSlotId(null);
      focusSlot(neighbour?.slotId);
    },
    setOperatingSettlement(settlementId: string | null) {
      void send({ kind: 'operating_settlement', settlementId });
    },
    teamOptions: (slotId: string) => activityTeamOptions(view, slotId),
    setTeam(slotId: string, teamId: string | null) {
      const slot = slotById(slotId);
      if (slot) void send(teamEdit(slot, teamId));
    },
    setCheckRoll(slotId: string, roll: RawRoll | null) {
      const slot = slotById(slotId);
      if (slot) void send(checkRollEdit(slot, roll));
    },
    addModifier(slotId: string, modifier: RawRoll['modifiers'][number]) {
      const slot = slotById(slotId);
      return slot ? send(addModifierEdit(slot, modifier)) : null;
    },
    removeModifier(slotId: string, index: number) {
      const slot = slotById(slotId);
      if (slot) void send(removeModifierEdit(slot, index));
    },
    // Helpful moves through ordered existing edits: clear it from every other
    // check first, then assign it here. Nothing claims success before the
    // edits are accepted; a failure leaves the accepted state and a retry.
    async applyHelpful(slotId: string) {
      if (disabled || helpful.state === 'moving') return;
      const start = current();
      const choiceId = start.slots.find((slot) => slot.slotId === slotId)
        ?.choice?.choiceId;
      if (!choiceId) return;
      setHelpful({ state: 'moving', slotId });
      let cleared: number | null = null;
      for (const { slotNumber, edit: clear } of helpfulClearEdits(
        start,
        slotId,
      )) {
        if ((await send(clear)) !== 'accepted') {
          setHelpful({
            state: 'failed',
            slotId,
            message: `Helpful could not be moved and still applies to Action Slot ${slotNumber}. Try again.`,
          });
          return;
        }
        cleared = slotNumber;
      }
      const fresh = current();
      const target = fresh.slots.find((slot) => slot.slotId === slotId);
      const assign =
        target?.choice?.choiceId === choiceId
          ? helpfulAssignEdit(fresh, slotId)
          : null;
      if (!assign || (await send(assign)) !== 'accepted') {
        setHelpful({
          state: 'failed',
          slotId,
          message:
            (cleared === null
              ? 'Helpful could not be added to this check.'
              : `Helpful was removed from Action Slot ${cleared} but could not be added to this check.`) +
            ' Try again.',
        });
        return;
      }
      setHelpful({ state: 'idle' });
    },
    removeHelpful(slotId: string) {
      const slot = slotById(slotId);
      const index = slot?.modifiers.find(
        (modifier) => modifier.kind === 'helpful',
      )?.index;
      if (slot && index !== undefined)
        void send(removeModifierEdit(slot, index));
    },
  };
}
export type ActivityBoard = ReturnType<typeof useActivityBoard>;
