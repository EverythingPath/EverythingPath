'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { endingFormId } from './persistent-ending-guard';
import { localFormElementId } from './source-anchors';
import {
  useGuardRegistration,
  useRestoredInput,
  type LocalFormGuard,
} from './use-summary-forms';

// One carried event's Ended at the table form. Typed input is this device's
// local form: while the ending is unsaved, or the saved outcome is edited,
// it registers with the Workspace's Confirm guard, which keeps the raw input
// when the player leaves Persistent and holds Confirm (with a Go to form
// link in Review & confirm) until it is saved or abandoned with another card.

export type EndingResult = 'accepted' | 'failed' | 'reason-failed';
type Values = { outcome: string; reason: string };

const outcomeSchema = z.string().trim().min(1, 'Describe how it ended.');
const endingSchema = z.object({ outcome: outcomeSchema, reason: z.string() });
const reasonedEndingSchema = z.object({
  outcome: outcomeSchema,
  reason: z.string().trim().min(1, 'A reason is required.'),
});
const parseKept = (kept: unknown) =>
  z.object({ outcome: z.string(), reason: z.string() }).safeParse(kept).data ??
  null;

/** The Confirm guard's message for an ending form, or null when settled. */
export function endingFormMessage({
  subject,
  values,
  saved,
  isNew,
  needsReason,
}: {
  subject: string;
  values: Values;
  saved: string;
  isNew: boolean;
  needsReason: boolean;
}) {
  const missing = [
    ...(values.outcome.trim() ? [] : ['how it ended']),
    ...(needsReason && !values.reason.trim() ? ['a reason'] : []),
  ];
  if (missing.length)
    return `${subject} ending needs ${missing.join(' and ')}. Save how it ended, or choose another decision.`;
  if (isNew)
    return `${subject} ending: save how it ended, or choose another decision.`;
  return values.outcome === saved
    ? null
    : `${subject} ending: save your change to how it ended.`;
}

export function useEndingForm({
  eventId,
  subject,
  saved,
  isNew,
  needsReason,
  basis,
  guard,
  onSave,
}: {
  eventId: string;
  /** The saved decision this ending is typed against (endingFormBasis). */
  basis: string;
  /** The event's name in the player's words, e.g. "Theft · Event 1". */
  subject: string;
  /** The saved outcome; empty while no ending is saved. */
  saved: string;
  /** The ending is only local intent: no ending is saved yet. */
  isNew: boolean;
  needsReason: boolean;
  guard?: LocalFormGuard;
  onSave: (outcome: string, reason?: string) => Promise<EndingResult>;
}) {
  const [alert, setAlert] = useState<EndingResult>('accepted');
  const form = useForm<Values>({
    values: { outcome: saved, reason: '' },
    resolver: zodResolver(needsReason ? reasonedEndingSchema : endingSchema),
  });
  const formId = endingFormId(eventId);
  const { isRestoring } = useRestoredInput(guard, formId, form, parseKept);
  const message = endingFormMessage({
    subject,
    values: form.watch(),
    saved,
    isNew,
    needsReason,
  });
  useGuardRegistration(guard, formId, message, form, isRestoring, {
    phase: 'persistent',
    basis,
  });
  const submit = form.handleSubmit(async (values) => {
    setAlert('accepted');
    const result = needsReason
      ? await onSave(values.outcome, values.reason)
      : await onSave(values.outcome);
    setAlert(result);
  });
  return {
    form,
    elementId: localFormElementId(formId),
    submit,
    alert,
    isSaving: form.formState.isSubmitting,
    needsReason,
  };
}
