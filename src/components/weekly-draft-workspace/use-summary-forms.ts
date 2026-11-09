'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStableByKey } from '~/components/use-stable-by-key';
import {
  useForm,
  type FieldValues,
  type Resolver,
  type UseFormReturn,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import type { ReviewException } from '~/components/week-review/review-facts';
import type { LocalFormRegistration } from './types';
import { moveAdjustmentById } from './adjustment-order';
import { focusTargetWithin, localFormElementId } from './source-anchors';
import {
  adjustmentChoices,
  adjustmentFormSchema,
  adjustmentFormValues,
  adjustmentFormValuesSchema,
  appendAdjustment,
  kindLabel,
  removeAdjustment,
  replaceAdjustment,
  type AdjustmentFormValues,
  type AdjustmentKind,
  type AdjustmentTargets,
  type TableAdjustment,
} from './summary-adjustment-form';

// The live Summary's local forms: Table Adjustments and Rules Exception
// reasons. Raw input stays on this device until a valid Save; the accepted
// value is kept meanwhile. Every open or invalid form registers with the
// Workspace's Confirm guard so this device cannot confirm the old accepted
// value by accident, and its raw input is kept there so it survives leaving
// Review & confirm. Saves send one existing semantic edit built from the
// latest known state, never a list captured when the form opened.

export type Edit = (edit: WeeklyDraftEdit) => Promise<'accepted' | 'failed'>;

/**
 * The Workspace's Confirm guard for this device's local forms: `set`
 * registers a form (null withdraws it and its kept input); `keep` and `read`
 * hold its raw input for the open draft without publishing anything. A form
 * outside Review & confirm names its `phase`, so Go to form shows it there.
 */
export type { LocalFormRegistration };
export type LocalFormGuard = {
  set: (id: string, form: LocalFormRegistration | null) => void;
  keep: (id: string, values: unknown) => void;
  read: (id: string) => unknown;
};

/** Focuses a registered local form: its first invalid field, else its first control. */
export function focusLocalForm(id: string) {
  const form = document.getElementById(localFormElementId(id));
  if (form) focusTargetWithin(form).focus();
}

/**
 * Registers a form with the guard while it has a message and keeps its raw
 * input there. Unmounting (leaving the phase that shows it) keeps both; only
 * a clean form, Save, Cancel or removal withdraws them.
 */
export function useGuardRegistration<Values extends FieldValues>(
  guard: LocalFormGuard | undefined,
  formId: string,
  message: string | null,
  form: UseFormReturn<Values, unknown, unknown>,
  isRestoring: boolean,
  where: Omit<LocalFormRegistration, 'message'> = {},
) {
  const { phase, basis } = where;
  useEffect(() => {
    if (isRestoring || !guard) return;
    if (message === null) {
      guard.set(formId, null);
      return;
    }
    guard.set(formId, {
      message,
      ...(phase ? { phase } : {}),
      ...(basis !== undefined ? { basis } : {}),
    });
    // Input that was never typed is kept too, so the form comes back.
    guard.keep(formId, form.getValues());
  }, [guard, formId, message, isRestoring, phase, basis, form]);
  useEffect(() => {
    if (!guard) return;
    const subscription = form.watch((values) => guard.keep(formId, values));
    return () => subscription.unsubscribe();
  }, [guard, formId, form]);
}

/**
 * Input kept for this form by the guard, applied once over the accepted
 * values so the form comes back dirty exactly as it was left.
 */
export function useRestoredInput<Values extends FieldValues>(
  guard: LocalFormGuard | undefined,
  formId: string,
  form: UseFormReturn<Values, unknown, unknown>,
  parse: (kept: unknown) => Values | null,
) {
  const [kept] = useState(() => parse(guard?.read(formId)));
  const [isRestoring, setRestoring] = useState(kept !== null);
  const isApplied = useRef(false);
  useEffect(() => {
    if (!kept || isApplied.current) return;
    isApplied.current = true;
    form.reset(kept, { keepDefaultValues: true });
    // Its errors come back with it.
    void form.trigger();
    guard?.keep(formId, kept);
    setRestoring(false);
  }, [kept, form, guard, formId]);
  return { kept, isRestoring };
}

/**
 * This device's own Save moves the optimistic forecast, and a failed Save
 * moves it back; neither is another player's change to the accepted value.
 */
function createOwnSaveTracking() {
  let isSaving = false;
  let settledTo: string | null | undefined;
  return {
    async save(
      before: string | null,
      run: () => Promise<'accepted' | 'failed'>,
    ) {
      isSaving = true;
      let result: 'accepted' | 'failed' = 'failed';
      try {
        result = await run();
        return result;
      } finally {
        isSaving = false;
        // A failed Save rolls the forecast back to the earlier value,
        // possibly only after this point.
        settledTo = result === 'failed' ? before : undefined;
      }
    },
    /** Whether an accepted value change came from this device's Save. */
    explains(next: string | null) {
      if (isSaving) return true;
      if (settledTo === undefined) return false;
      const isRollback = next === settledTo;
      settledTo = undefined;
      return isRollback;
    },
  };
}

/**
 * The accepted-value side of a local form shared by adjustments and
 * reasons: saving state, failure text, and whether another player changed
 * the accepted value while this form held input. An untouched form follows
 * accepted changes; a touched one keeps its input and says so.
 */
function useAcceptedValue(
  acceptedKey: string | null,
  isDirty: boolean,
  followAccepted: () => void,
) {
  const [isSaving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [hasRemoteChange, setRemoteChange] = useState(false);
  const [own] = useState(createOwnSaveTracking);
  const base = useRef(acceptedKey);
  const latest = useRef({ isDirty, followAccepted });
  latest.current = { isDirty, followAccepted };
  useEffect(() => {
    if (acceptedKey === base.current) return;
    base.current = acceptedKey;
    if (acceptedKey === null || own.explains(acceptedKey)) return;
    if (latest.current.isDirty) setRemoteChange(true);
    else latest.current.followAccepted();
  }, [acceptedKey, own]);
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);
  return {
    isSaving,
    failure,
    hasRemoteChange,
    setFailure,
    /** Runs one Save; true once accepted (and still mounted). */
    async save(run: () => Promise<'accepted' | 'failed'>, failed: string) {
      setSaving(true);
      setFailure(null);
      const result = await own.save(base.current, run);
      if (!isMounted.current) return false;
      setSaving(false);
      if (result === 'accepted') setRemoteChange(false);
      else setFailure(failed);
      return result === 'accepted';
    },
    settle() {
      setFailure(null);
      setRemoteChange(false);
    },
  };
}

const parseAdjustmentValues = (kept: unknown) =>
  adjustmentFormValuesSchema.safeParse(kept).data ?? null;

/** The Confirm guard's message for an adjustment form, or null when clean. */
function adjustmentMessage(
  subject: string,
  isNew: boolean,
  isDirty: boolean,
  errors: readonly string[],
) {
  if (!isNew && !isDirty) return null;
  if (errors.length === 1 && errors[0] === 'reason')
    return `${subject} needs a reason.`;
  if (errors.length)
    return `${subject}: fix the highlighted fields, then save or cancel.`;
  if (isNew) return `${subject}: save or cancel it.`;
  return `${subject}: save or cancel your changes.`;
}

/**
 * One Table Adjustment form: an existing adjustment (inline reason plus the
 * full editor) or a new one of a chosen kind.
 */
export function useAdjustmentForm({
  adjustmentId,
  accepted,
  kind,
  initialValues,
  number,
  effect,
  targets,
  latest,
  edit,
  guard,
  onSaved,
  onCancelled,
}: {
  adjustmentId: string;
  /** The accepted adjustment; null for a new one. */
  accepted: TableAdjustment | null;
  kind: AdjustmentKind;
  /** Raw values a new form starts from (re-adding a removed adjustment). */
  initialValues?: AdjustmentFormValues;
  /** 1-based position and effect text of an existing adjustment, for messages. */
  number?: number;
  effect?: string;
  targets: AdjustmentTargets;
  /** The latest ordered list this device knows, read at Save time. */
  latest: () => readonly TableAdjustment[];
  edit: Edit;
  guard?: LocalFormGuard;
  onSaved?: () => void;
  onCancelled?: () => void;
}) {
  const isNew = accepted === null;
  const acceptedKey = accepted ? JSON.stringify(accepted) : null;
  // The accepted adjustment is a fresh copy on every publication.
  const stableAccepted = useStableByKey(accepted, acceptedKey);
  const acceptedValues = useMemo(
    () => (stableAccepted ? adjustmentFormValues(stableAccepted) : null),
    [stableAccepted],
  );
  const [initial] = useState(
    () => acceptedValues ?? initialValues ?? adjustmentFormValues({ kind }),
  );
  const choices = useMemo(
    () => adjustmentChoices(targets, acceptedValues ?? initial),
    [targets, acceptedValues, initial],
  );
  const choicesRef = useRef(choices);
  choicesRef.current = choices;
  const resolver = useMemo<
    Resolver<AdjustmentFormValues, unknown, TableAdjustment>
  >(
    () => (values, context, options) =>
      zodResolver(adjustmentFormSchema(choicesRef.current, adjustmentId))(
        values,
        context,
        options,
      ),
    [adjustmentId],
  );
  const form = useForm<AdjustmentFormValues, unknown, TableAdjustment>({
    defaultValues: initial,
    resolver,
    mode: 'onChange',
  });
  const formId = `${isNew ? 'new-adjustment' : 'adjustment'}:${adjustmentId}`;
  const { isRestoring } = useRestoredInput(
    guard,
    formId,
    form,
    parseAdjustmentValues,
  );
  const { isDirty, errors } = form.formState;
  const acceptedState = useAcceptedValue(acceptedKey, isDirty, () => {
    if (acceptedValues) form.reset(acceptedValues);
  });
  // An existing adjustment is checked at once, so a target that has left
  // the week shows its error before anyone edits the row.
  useEffect(() => {
    if (!isNew) void form.trigger();
  }, [isNew, acceptedKey, form]);
  const subject = isNew
    ? `New ${kindLabel(kind)} adjustment`
    : `Table Adjustment ${number ?? ''} “${effect ?? kindLabel(kind)}”`;
  const message = adjustmentMessage(
    subject,
    isNew,
    isDirty,
    Object.keys(errors),
  );
  useGuardRegistration(guard, formId, message, form, isRestoring);
  const release = () => guard?.set(formId, null);

  const submit = form.handleSubmit(async (adjustment) => {
    const next = isNew
      ? appendAdjustment(latest(), adjustment)
      : replaceAdjustment(latest(), adjustment);
    if (!next) {
      acceptedState.setFailure(
        'Another player removed this adjustment. Cancel, or add it again as a new adjustment.',
      );
      return;
    }
    const submitted = form.getValues();
    const isAccepted = await acceptedState.save(
      () => edit({ kind: 'table_adjustments', adjustments: next }),
      'The adjustment could not be saved. Your change is kept here; check the current adjustments, then save again or cancel.',
    );
    if (!isAccepted) return;
    // Input typed while saving stays as a further unsaved change.
    form.reset(submitted, { keepValues: true });
    if (isNew) release();
    onSaved?.();
  });
  function cancel() {
    form.reset(acceptedValues ?? adjustmentFormValues({ kind }));
    acceptedState.settle();
    release();
    onCancelled?.();
  }
  return {
    form,
    formId,
    elementId: localFormElementId(formId),
    choices,
    submit,
    cancel,
    /** Withdraws this form's guard and input, e.g. before removing it. */
    release,
    /** Local input differs from the accepted adjustment (always true when new). */
    isDirty: isNew || isDirty,
    isSaving: acceptedState.isSaving,
    failure: acceptedState.failure,
    /** Another player changed this adjustment while this form held input. */
    hasRemoteChange: acceptedState.hasRemoteChange,
  };
}
export type AdjustmentForm = ReturnType<typeof useAdjustmentForm>;

/** Ordering and removal of the accepted list, always from the latest list. */
export function useAdjustmentListEdits({
  latest,
  edit,
}: {
  latest: () => readonly TableAdjustment[];
  edit: Edit;
}) {
  return {
    move: (adjustmentId: string, offset: -1 | 1) => {
      const next = moveAdjustmentById(latest(), adjustmentId, offset);
      return next
        ? edit({ kind: 'table_adjustments', adjustments: next })
        : Promise.resolve('failed' as const);
    },
    remove: (adjustmentId: string) =>
      edit({
        kind: 'table_adjustments',
        adjustments: removeAdjustment(latest(), adjustmentId),
      }),
  };
}

/**
 * Local input kept for an adjustment that is no longer in the list: another
 * player removed it while this device held unsaved changes to it.
 */
export type RemovedAdjustmentDraft = {
  formId: string;
  values: AdjustmentFormValues;
};

/** The kept input of registered adjustment forms whose adjustment has gone. */
export function removedAdjustmentDrafts(
  guard: LocalFormGuard | undefined,
  localForms: readonly { id: string }[],
  adjustments: readonly TableAdjustment[],
): RemovedAdjustmentDraft[] {
  if (!guard) return [];
  const present = new Set(adjustments.map((item) => item.adjustmentId));
  return localForms.flatMap(({ id }) => {
    const [prefix, adjustmentId] = id.split(/:(.*)/s);
    if (prefix !== 'adjustment' || !adjustmentId || present.has(adjustmentId))
      return [];
    const values = parseAdjustmentValues(guard.read(id));
    return values ? [{ formId: id, values }] : [];
  });
}

/** The new-adjustment form this device left open, if any. */
export function keptNewAdjustment(
  guard: LocalFormGuard | undefined,
  localForms: readonly { id: string }[],
) {
  for (const { id } of localForms) {
    const [prefix, adjustmentId] = id.split(/:(.*)/s);
    if (prefix !== 'new-adjustment' || !adjustmentId) continue;
    const values = parseAdjustmentValues(guard?.read(id));
    if (values) return { id: adjustmentId, kind: values.kind };
  }
  return null;
}

/** Registers one kept removed-adjustment draft under its original form. */
export function useRemovedDraftRegistration(
  guard: LocalFormGuard | undefined,
  draft: RemovedAdjustmentDraft,
) {
  const message = `${kindLabel(draft.values.kind)} adjustment “${draft.values.reason.trim() || 'without a reason'}” was removed by another player. Add your version again or discard it.`;
  useEffect(() => {
    guard?.set(draft.formId, { message });
  }, [guard, draft.formId, message]);
  return {
    elementId: localFormElementId(draft.formId),
    discard: () => guard?.set(draft.formId, null),
  };
}

/**
 * Withdraws kept reason input for exceptions that are no longer part of the
 * week (another player cleared them): there is nothing left to save it to.
 */
export function useForgetGoneExceptions(
  guard: LocalFormGuard | undefined,
  localForms: readonly { id: string }[],
  exceptions: readonly { exceptionId: string }[],
) {
  const gone = localForms
    .map(({ id }) => id)
    .filter(
      (id) =>
        id.startsWith('exception:') &&
        !exceptions.some(
          (exception) => `exception:${exception.exceptionId}` === id,
        ),
    )
    .join('\n');
  useEffect(() => {
    for (const id of gone ? gone.split('\n') : []) guard?.set(id, null);
  }, [guard, gone]);
}

const reasonSchema = z.object({
  reason: z.string().trim().min(1, 'A reason is required.'),
});
const parseReasonValues = (kept: unknown) =>
  z.object({ reason: z.string() }).safeParse(kept).data ?? null;

/**
 * A Rules Exception's reason: edited locally, saved with `rules_exception`
 * (identity, subject and rule preserved) or cleared with
 * `clear_rules_exception`, which revokes the permission. A blank reason is
 * never saved.
 */
export function useExceptionReasonForm({
  note,
  subject,
  edit,
  guard,
  onSaved,
}: {
  note: ReviewException;
  /** Readable subject of the exception, e.g. "Activity 2: Earn Gold". */
  subject: string;
  edit: Edit;
  guard?: LocalFormGuard;
  onSaved?: () => void;
}) {
  const form = useForm<{ reason: string }, unknown, { reason: string }>({
    defaultValues: { reason: note.reason },
    resolver: zodResolver(reasonSchema),
    mode: 'onChange',
  });
  const formId = `exception:${note.exceptionId}`;
  const { isRestoring } = useRestoredInput(
    guard,
    formId,
    form,
    parseReasonValues,
  );
  const { isDirty, isValid } = form.formState;
  const acceptedState = useAcceptedValue(note.reason, isDirty, () =>
    form.reset({ reason: note.reason }),
  );
  const label = `${subject} · ${note.rule}`;
  useGuardRegistration(
    guard,
    formId,
    !isDirty
      ? null
      : isValid
        ? `${label}: save or cancel the new reason.`
        : `${label} exception needs a reason. Save one, cancel, or clear the exception.`,
    form,
    isRestoring,
  );
  const release = () => guard?.set(formId, null);
  const submit = form.handleSubmit(async ({ reason }) => {
    const submitted = form.getValues();
    const isAccepted = await acceptedState.save(
      () =>
        edit({
          kind: 'rules_exception',
          exception: {
            exceptionId: note.exceptionId,
            subjectId: note.subjectId,
            ruleId: note.ruleId,
            reason,
          },
        }),
      'The reason could not be saved. Your text is kept here; save again or cancel.',
    );
    if (!isAccepted) return;
    form.reset(submitted, { keepValues: true });
    onSaved?.();
  });
  function cancel() {
    form.reset({ reason: note.reason });
    acceptedState.settle();
    release();
  }
  function clear() {
    release();
    return edit({
      kind: 'clear_rules_exception',
      exceptionId: note.exceptionId,
    });
  }
  return {
    form,
    formId,
    elementId: localFormElementId(formId),
    submit,
    cancel,
    clear,
    isDirty,
    isSaving: acceptedState.isSaving,
    failure: acceptedState.failure,
    hasRemoteChange: acceptedState.hasRemoteChange,
  };
}
