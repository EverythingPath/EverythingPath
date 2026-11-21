'use client';
import { useRef, useState } from 'react';
import type { WeeklyDraft, WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import type { RawRoll } from '~/lib/weekly-draft-facts';
import {
  checkModifiersEdit,
  clearRetainedEdit,
  modifierList,
  officerCheckEdit,
  theftRollEdit,
  type CheckRoll,
  type Mitigation,
  type ModifierChange,
  type RollModifier,
} from './persistent-check-edits';
import type {
  PersistentRetainedField,
  PersistentView,
  RivalrySkill,
} from './types';
import type { PersistentEdit } from './use-persistent-choice';

type Event = PersistentView['events'][number];
type Decision = WeeklyDraft['persistent']['decisions'][number];
type Result = 'accepted' | 'failed';
export type { ModifierChange };
// The newest decision for an event, null when it has none, or undefined
// when newer facts are not available and the rendered one stands in.
export type LatestPersistentDecision = (
  eventId: string,
) => Decision | null | undefined;

// The saved Theft or Rivalry check of one carried event. Every field writes
// its own semantic edit through the shared store, built from the newest
// accepted-and-pending decision (not the one rendered before an earlier
// await), so an edit never undoes a support move or a peer's other field.
// A Rivalry character or skill chosen before the other stays local until
// the stored check can name both. A refused field edit is reported under
// the check until the next accepted one.
export function usePersistentCheck(
  event: Event,
  edit: PersistentEdit,
  latest?: LatestPersistentDecision,
) {
  const [pending, setPending] = useState<{
    characterId?: string;
    skill?: RivalrySkill;
  }>({});
  const [failed, setFailed] = useState(false);
  // Modifiers of a roll blanked while retyping it: the retyped roll gets
  // them back instead of starting without them.
  const blanked = useRef<Partial<Record<CheckRoll, RollModifier[]>>>({});
  const current = (): Mitigation | null => {
    const found = latest?.(event.eventId);
    const decision = found === undefined ? event.decision : found;
    return decision?.kind === 'mitigate' ? decision : null;
  };
  // `report: false` for an editor that shows its own failure.
  const send = async (
    next: WeeklyDraftEdit | null,
    report = true,
  ): Promise<Result> => {
    const result = next ? await edit(next) : 'failed';
    if (report) setFailed(result === 'failed');
    return result;
  };
  const write = (
    build: (decision: Mitigation) => WeeklyDraftEdit | null,
    report = true,
  ) => {
    const decision = current();
    return send(decision ? build(decision) : null, report);
  };
  // A blanked roll's modifiers wait for the roll typed in its place.
  function retyped(check: CheckRoll, roll: RawRoll | null) {
    const decision = current();
    const previous =
      check === 'theft' ? decision?.rolls?.check : decision?.officerCheck?.roll;
    if (!roll) {
      if (previous?.modifiers.length)
        blanked.current[check] = previous.modifiers;
      return null;
    }
    const kept = blanked.current[check];
    delete blanked.current[check];
    return kept && roll.modifiers.length === 0
      ? { ...roll, modifiers: kept }
      : roll;
  }
  async function writeOfficer(
    change: Parameters<typeof officerCheckEdit>[1],
  ): Promise<Result> {
    const decision = current();
    if (!decision) return send(null);
    const next = officerCheckEdit(decision, change, pending);
    if (next) {
      const result = await send(next);
      if (result === 'accepted') setPending({});
      return result;
    }
    if (change.field === 'characterId' || change.field === 'skill')
      setPending((before) => ({ ...before, [change.field]: change.value }));
    return 'accepted';
  }
  const saved = event.rivalryCheck;
  return {
    failed,
    setTheftRoll: (roll: RawRoll | null) => {
      const next = retyped('theft', roll);
      return write((decision) => theftRollEdit(decision, next));
    },
    // What the Rivalry selects show: the saved check, else the local choice.
    characterId: saved?.characterId ?? pending.characterId ?? null,
    skill: saved?.skill ?? pending.skill ?? null,
    setCharacter: (characterId: string) =>
      writeOfficer({ field: 'characterId', value: characterId }),
    setSkill: (skill: RivalrySkill) =>
      writeOfficer({ field: 'skill', value: skill }),
    setSkillBonus: (value: number | null) =>
      writeOfficer({ field: 'skillBonus', value }),
    setOfficerRoll: (roll: RawRoll | null) =>
      writeOfficer({ field: 'roll', value: retyped('rivalry', roll) }),
    changeModifier: (check: CheckRoll, change: ModifierChange) =>
      write((decision) => {
        const list = modifierList(decision, check, change);
        return list ? checkModifiersEdit(decision, check, list) : null;
      }, false),
    clearRetained: (field: PersistentRetainedField) =>
      write((decision) => clearRetainedEdit(decision, field)),
  };
}
export type PersistentCheck = ReturnType<typeof usePersistentCheck>;
