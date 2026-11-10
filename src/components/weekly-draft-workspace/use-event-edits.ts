import { useMemo } from 'react';
import {
  acknowledgementSchema,
  eventOccurrenceSchema,
  eventTreeSchema,
  rawRollModifiersSchema,
  rulesExceptionSchema,
  type RawRoll,
} from '~/lib/weekly-draft-facts';
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import { isCandidateChoice } from '~/lib/event-occurrence-preparation';
import type { EventBlock, EventRetainedField, EventView } from './types';

type Occurrence = EventView['occurrences'][number]['occurrence'];
type TargetCheck = NonNullable<Occurrence['targetChecks']>[number];
type Target = NonNullable<Occurrence['targets']>[number];
export type EventRewardInput = NonNullable<Occurrence['rewards']>[number];
type RulesException = EventView['exceptions'][number];
export type TargetCheckPatch = {
  mitigation?: 'attempted' | 'unattempted';
  // A die, or null to clear it.
  check?: RawRoll | null;
  loss?: RawRoll | null;
};
export type TableModifier = EventBlock['table']['modifiers'][number];
type OfficerCheck = NonNullable<Occurrence['officerCheck']>;
// What clearing retained targets or rolls keeps: the ones the event reads.
export type RetainedKeep = {
  targets?: readonly Target['kind'][];
  rolls?: readonly string[];
};
export type OfficerCheckPatch = {
  characterId?: string;
  skill?: OfficerCheck['skill'];
  // Null clears the field.
  skillBonus?: number | null;
  roll?: RawRoll | null;
};

/**
 * The Event view's edits. Every occurrence edit waits for its occurrence to
 * exist in the accepted draft: a prepared position that is still being saved
 * accepts no child edit. Structural validation happens before sending, with
 * its message returned to the caller instead of a browser popup.
 */
export function useEventEdits(
  view: EventView,
  edit: (edit: WeeklyDraftEdit) => unknown,
) {
  return useMemo(() => {
    const blocks = new Map<string, EventBlock>();
    const collect = (block: EventBlock) => {
      blocks.set(block.eventId, block);
      for (const child of [...block.children, ...block.hidden]) collect(child);
    };
    for (const block of [
      ...(view.automatic?.blocks ?? []),
      ...view.rolled.blocks,
      ...view.candidates.flatMap((set) => set.blocks),
      ...view.inactive,
    ])
      collect(block);
    // The occurrence's own tree, in parent-before-child order.
    function tree(eventId: string) {
      const owner = view.occurrences.find(
        (item) => item.occurrence.eventId === eventId,
      )?.owner;
      return view.occurrences
        .filter(
          (item) => item.owner?.choice.choiceId === owner?.choice.choiceId,
        )
        .map((item) => item.occurrence);
    }
    function saveOccurrence(occurrence: Occurrence): string | null {
      const block = blocks.get(occurrence.eventId);
      if (!block?.saved) return 'This event is not ready for its roll yet.';
      const parsed = eventOccurrenceSchema.safeParse(occurrence);
      const checked = eventTreeSchema.safeParse(
        tree(occurrence.eventId).map((entry) =>
          entry.eventId === occurrence.eventId ? occurrence : entry,
        ),
      );
      // Safe cast: zod's failed safeParse of the occurrence lists at least one
      // issue.
      if (!parsed.success) return parsed.error.issues[0]!.message;
      // Safe cast: the event tree failed eventTreeSchema, so its error holds
      // the failing issue.
      if (!checked.success) return checked.error.issues[0]!.message;
      edit({ kind: 'event_occurrence', occurrence: parsed.data });
      return null;
    }
    function current(eventId: string) {
      return blocks.get(eventId)?.item.occurrence ?? null;
    }
    // One named die of the occurrence, set or cleared; other rolls stay.
    function setRoll(
      eventId: string,
      name: 'check' | 'loss',
      roll: RawRoll | null,
    ) {
      const occurrence = current(eventId);
      if (!occurrence) return 'This event is not ready for its roll yet.';
      const { rolls, ...rest } = occurrence;
      const { [name]: _previous, ...others } = rolls ?? {};
      const next = roll ? { ...others, [name]: roll } : others;
      return saveOccurrence(
        Object.keys(next).length ? { ...rest, rolls: next } : rest,
      );
    }
    // One target's recorded check on the occurrence, patched in place; an
    // entry left naming only its target is removed.
    function patchTargetCheck(
      eventId: string,
      target: TargetCheck['target'],
      patch: TargetCheckPatch,
    ) {
      const occurrence = current(eventId);
      if (!occurrence) return 'This event is not ready for its roll yet.';
      const entries = occurrence.targetChecks ?? [];
      const index = entries.findIndex((entry) =>
        sameTarget(entry.target, target),
      );
      const next = applyTargetPatch(entries[index] ?? { target }, patch);
      const targetChecks =
        index >= 0
          ? entries.flatMap((entry, position) =>
              position === index ? (next ? [next] : []) : [entry],
            )
          : next
            ? [...entries, next]
            : entries;
      const { targetChecks: _previous, ...rest } = occurrence;
      return saveOccurrence(
        targetChecks.length ? { ...rest, targetChecks } : rest,
      );
    }
    return {
      saveOccurrence,
      /**
       * Replaces the occurrence's targets of one kind (High Morale's ended
       * carried events are `event` targets); other kinds stay.
       */
      setTargets(
        eventId: string,
        kind: 'team' | 'settlement' | 'event' | 'item' | 'cache',
        ids: readonly string[],
      ) {
        const occurrence = current(eventId);
        if (!occurrence) return 'This event is not ready for its roll yet.';
        const targets: Target[] = [
          ...(occurrence.targets ?? []).filter(
            (target) => target.kind !== kind,
          ),
          ...ids.map((id): Target => {
            if (kind === 'team') return { kind, teamId: id };
            if (kind === 'settlement') return { kind, settlementId: id };
            if (kind === 'item') return { kind, itemId: id };
            if (kind === 'cache') return { kind, cacheId: id };
            return { kind, eventId: id };
          }),
        ];
        const { targets: _previous, ...rest } = occurrence;
        return saveOccurrence(targets.length ? { ...rest, targets } : rest);
      },
      /** Invasion's Average Party Level, or null to clear it. */
      setAveragePartyLevel(eventId: string, level: number | null) {
        const occurrence = current(eventId);
        if (!occurrence) return 'This event is not ready for its roll yet.';
        const { averagePartyLevel: _previous, ...rest } = occurrence;
        return saveOccurrence(
          level === null ? rest : { ...rest, averagePartyLevel: level },
        );
      },
      /**
       * Clears a recorded input the resolved event does not use. Clearing
       * `targets` or `rolls` keeps the target kinds and named rolls the
       * event reads (High Morale's ended events, Theft's check).
       */
      clearRetained(
        eventId: string,
        field: EventRetainedField['field'],
        keep: RetainedKeep = {},
      ) {
        const occurrence = current(eventId);
        if (!occurrence) return 'This event is not ready for its roll yet.';
        const { [field]: _previous, ...rest } = occurrence;
        const kept =
          field === 'targets'
            ? (occurrence.targets ?? []).filter((target) =>
                (keep.targets ?? []).includes(target.kind),
              )
            : [];
        const rolls =
          field === 'rolls'
            ? Object.fromEntries(
                Object.entries(occurrence.rolls ?? {}).filter(([name]) =>
                  (keep.rolls ?? []).includes(name),
                ),
              )
            : {};
        return saveOccurrence({
          ...rest,
          ...(kept.length ? { targets: kept } : {}),
          ...(Object.keys(rolls).length ? { rolls } : {}),
        });
      },
      /** The occurrence's own check die (for example Sickness's save). */
      setCheckRoll(eventId: string, roll: RawRoll | null) {
        return setRoll(eventId, 'check', roll);
      },
      /** Turncoat's raw training loss die. */
      setLossRoll(eventId: string, roll: RawRoll | null) {
        return setRoll(eventId, 'loss', roll);
      },
      /** The occurrence's own Attempt it / Let it happen (Theft). */
      setMitigation(eventId: string, mitigation: 'attempted' | 'unattempted') {
        const occurrence = current(eventId);
        if (!occurrence) return 'This event is not ready for its roll yet.';
        return saveOccurrence({ ...occurrence, mitigation });
      },
      /**
       * One or more officer-check fields (Rivalry and Turncoat Twice). The
       * stored check names its character and skill, so the first write
       * carries both; a null skill bonus or roll is cleared, never zeroed.
       */
      patchOfficerCheck(eventId: string, patch: OfficerCheckPatch) {
        const occurrence = current(eventId);
        if (!occurrence) return 'This event is not ready for its roll yet.';
        const next: Partial<OfficerCheck> = { ...occurrence.officerCheck };
        // Safe cast: patch is an OfficerCheckPatch, so its own keys are its
        // fields.
        for (const [key, value] of Object.entries(patch) as [
          keyof OfficerCheckPatch,
          unknown,
        ][])
          if (value === null) delete next[key];
          else if (value !== undefined) Object.assign(next, { [key]: value });
        const { characterId, skill } = next;
        if (!characterId || !skill)
          return 'Choose the character and skill first.';
        return saveOccurrence({
          ...occurrence,
          officerCheck: { ...next, characterId, skill },
        });
      },
      /** Attempt it / Let it happen, or a die, for one target's check. */
      setTargetCheck: patchTargetCheck,
      /** Removes one recorded target check, by its position. */
      removeTargetCheck(eventId: string, index: number) {
        const occurrence = current(eventId);
        if (!occurrence?.targetChecks?.[index])
          return 'This check is no longer recorded.';
        const targetChecks = occurrence.targetChecks.filter(
          (_entry, position) => position !== index,
        );
        const { targetChecks: _previous, ...rest } = occurrence;
        return saveOccurrence(
          targetChecks.length ? { ...rest, targetChecks } : rest,
        );
      },
      /**
       * One Found Fire reward, added last or replaced in place by its item
       * identity. The rest of the occurrence is the latest this device
       * knows, so an edit built on an older one is refused, never merged.
       */
      saveReward(eventId: string, reward: EventRewardInput) {
        const occurrence = current(eventId);
        if (!occurrence) return 'This event is not ready for its roll yet.';
        const rewards = occurrence.rewards ?? [];
        return saveOccurrence({
          ...occurrence,
          rewards: rewards.some((entry) => entry.itemId === reward.itemId)
            ? rewards.map((entry) =>
                entry.itemId === reward.itemId ? reward : entry,
              )
            : [...rewards, reward],
        });
      },
      /**
       * Removes one reward. Its Rules Exception is cleared first, so a
       * failed removal leaves the reward asking for one again rather than an
       * exception nobody can see.
       */
      removeReward(eventId: string, itemId: string) {
        const occurrence = current(eventId);
        if (!occurrence?.rewards?.some((entry) => entry.itemId === itemId))
          return 'This reward is no longer recorded.';
        for (const exception of view.exceptions)
          if (exception.subjectId === itemId)
            edit({
              kind: 'clear_rules_exception',
              exceptionId: exception.exceptionId,
            });
        const rewards = occurrence.rewards.filter(
          (entry) => entry.itemId !== itemId,
        );
        const { rewards: _previous, ...rest } = occurrence;
        return saveOccurrence(rewards.length ? { ...rest, rewards } : rest);
      },
      /** A Rules Exception reason beside its subject (a reward). */
      saveException(exception: RulesException) {
        const parsed = rulesExceptionSchema.safeParse(exception);
        if (!parsed.success) {
          // Safe cast: rulesExceptionSchema rejected the exception, so zod
          // lists at least one issue.
          const issue = parsed.error.issues[0]!;
          return issue.path[0] === 'reason'
            ? 'A reason is required.'
            : issue.message;
        }
        edit({ kind: 'rules_exception', exception: parsed.data });
        return null;
      },
      clearException(exceptionId: string) {
        edit({ kind: 'clear_rules_exception', exceptionId });
      },
      /** What happened: the occurrence's acknowledgement, saved or cleared. */
      saveWhatHappened(eventId: string, outcome: string) {
        const block = blocks.get(eventId);
        if (!block?.saved) return 'This event is not ready for its roll yet.';
        const subjectId = `event:${eventId}`;
        const existing = view.acknowledgements.find(
          (entry) => entry.subjectId === subjectId,
        );
        const parsed = acknowledgementSchema.safeParse({
          acknowledgementId: existing?.acknowledgementId ?? subjectId,
          subjectId,
          outcome,
        });
        // Safe cast: acknowledgementSchema rejected the outcome, and a zod
        // failure always names its issue.
        if (!parsed.success) return parsed.error.issues[0]!.message;
        edit({ kind: 'acknowledge', acknowledgement: parsed.data });
        return null;
      },
      clearWhatHappened(eventId: string) {
        const existing = view.acknowledgements.find(
          (entry) => entry.subjectId === `event:${eventId}`,
        );
        if (!blocks.get(eventId)?.saved || !existing) return;
        edit({
          kind: 'clear_acknowledgement',
          acknowledgementId: existing.acknowledgementId,
        });
      },
      setChanceRoll(roll: RawRoll | null) {
        edit({ kind: 'event_chance', roll });
      },
      /** A new die, or null to clear; clearing a surplus position removes it. */
      setTableRoll(eventId: string, roll: RawRoll | null) {
        const block = blocks.get(eventId);
        const occurrence = current(eventId);
        if (!block?.saved || !occurrence) return;
        if (roll === null && block.removal) {
          edit(block.removal);
          return;
        }
        const { tableRoll: _previous, ...rest } = occurrence;
        saveOccurrence(roll ? { ...rest, tableRoll: roll } : rest);
      },
      /** Replaces the table roll's extra modifiers; provenance and dice stay. */
      setTableModifiers(eventId: string, modifiers: TableModifier[]) {
        const occurrence = current(eventId);
        if (!occurrence?.tableRoll) return 'Enter the table roll first.';
        const parsed = rawRollModifiersSchema.safeParse(
          modifiers.map(({ sourceId, value, reason }) => ({
            sourceId,
            value,
            reason,
          })),
        );
        // Safe cast: the modifiers failed rawRollModifiersSchema, whose zod
        // error carries the first failing issue.
        if (!parsed.success) return parsed.error.issues[0]!.message;
        return saveOccurrence({
          ...occurrence,
          tableRoll: { ...occurrence.tableRoll, modifiers: parsed.data },
        });
      },
      /** Marks this candidate as the event that happens for its Activity choice. */
      chooseCandidate(eventId: string) {
        const block = blocks.get(eventId);
        const owner = block?.item.owner;
        if (!block?.saved || !isCandidateChoice(owner?.choice)) return;
        edit({
          kind: 'detail',
          slotId: owner.slotId,
          choiceId: owner.choice.choiceId,
          choice: { ...owner.choice, selectedEventId: eventId },
        });
      },
    };
  }, [view, edit]);
}

/** A fresh stable identity for a table modifier the table adds. */
export function newTableModifierSource() {
  return `table-modifier:${crypto.randomUUID()}`;
}

function targetIdentity(target: TargetCheck['target']) {
  switch (target.kind) {
    case 'event':
      return target.eventId;
    case 'item':
      return target.itemId;
    case 'team':
      return target.teamId;
    case 'settlement':
      return target.settlementId;
    case 'character':
      return target.characterId;
    case 'cache':
      return target.cacheId;
  }
}

function sameTarget(a: TargetCheck['target'], b: TargetCheck['target']) {
  return a.kind === b.kind && targetIdentity(a) === targetIdentity(b);
}

// A target check with the patch applied, or null once only its target is left.
function applyTargetPatch(
  entry: TargetCheck,
  patch: TargetCheckPatch,
): TargetCheck | null {
  const next: TargetCheck = { ...entry };
  if (patch.mitigation) next.mitigation = patch.mitigation;
  const rolls = { ...entry.rolls };
  for (const field of ['check', 'loss'] as const) {
    const roll = patch[field];
    if (roll === null) delete rolls[field];
    else if (roll) rolls[field] = roll;
  }
  if (Object.keys(rolls).length) next.rolls = rolls;
  else delete next.rolls;
  return Object.keys(next).length > 1 ? next : null;
}
