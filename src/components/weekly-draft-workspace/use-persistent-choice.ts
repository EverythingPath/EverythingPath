'use client';
import { useState } from 'react';
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import {
  decisionEdit,
  endingEdit,
  endingExceptionEdit,
  type PersistentCard,
} from './persistent-sections';
import type { PersistentView } from './types';
import { endingFormBasis, endingFormId } from './persistent-ending-guard';
import type { LocalFormGuard } from './use-summary-forms';

type Event = PersistentView['events'][number];
type Exception = Event['exceptions'][number];
export type PersistentEdit = (
  edit: WeeklyDraftEdit,
) => Promise<'accepted' | 'failed'>;

// One carried event's decision cards. Every card but Ended at the table
// writes at once through the shared store. Ended at the table is only local
// intent until a nonempty outcome is saved: the saved decision keeps
// applying meanwhile, and a failed save keeps the form open to retry.
// An ending kept by this device's Confirm guard (typed, then Persistent was
// left) comes back as the chosen card; another card abandons it.
export function usePersistentChoice(
  event: Event,
  edit: PersistentEdit,
  guard?: LocalFormGuard,
) {
  const formId = endingFormId(event.eventId);
  const saved: PersistentCard = event.decision?.kind ?? 'unattempted';
  const basis = endingFormBasis(event.decision);
  // The saved decision the ending was chosen against, or null for none.
  const [endingIntent, setEndingIntent] = useState<string | null>(() =>
    saved !== 'end' && guard?.read(formId) !== undefined ? basis : null,
  );
  // Once an ending is saved, or another player saves a different decision,
  // the intent is spent (the store drops its held form the same way).
  if (endingIntent !== null && (saved === 'end' || endingIntent !== basis))
    setEndingIntent(null);
  const endingUnsaved =
    endingIntent !== null && endingIntent === basis && saved !== 'end';
  return {
    saved,
    selected: endingUnsaved ? 'end' : saved,
    endingUnsaved,
    choose: (card: PersistentCard) => {
      if (card === 'end') {
        if (saved !== 'end') setEndingIntent(basis);
        return;
      }
      setEndingIntent(null);
      guard?.set(formId, null);
      const next = decisionEdit(event, card);
      if (next) void edit(next);
    },
    // The outcome is saved first; its reason, when given, only after the
    // ending was accepted. 'reason-failed' means the ending is saved and its
    // Rules Exception still needs its reason.
    saveEnding: async (
      outcome: string,
      reason?: string,
    ): Promise<'accepted' | 'failed' | 'reason-failed'> => {
      const result = await edit(endingEdit(event, outcome));
      if (result !== 'accepted') return result;
      setEndingIntent(null);
      if (!reason?.trim()) return result;
      const recorded = await edit(endingExceptionEdit(event, reason));
      return recorded === 'accepted' ? recorded : 'reason-failed';
    },
    saveException: (exception: Exception, reason: string) =>
      edit({
        kind: 'rules_exception',
        exception: {
          exceptionId: exception.exceptionId,
          subjectId: exception.subjectId,
          ruleId: exception.ruleId,
          reason: reason.trim(),
        },
      }),
    removeException: (exception: Exception) =>
      edit({
        kind: 'clear_rules_exception',
        exceptionId: exception.exceptionId,
      }),
  };
}
