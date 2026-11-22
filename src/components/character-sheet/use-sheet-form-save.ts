'use client';

import { useRef, useState } from 'react';
import type { FieldValues } from 'react-hook-form';
import { classifyWriteFailure, refusalReason } from '~/lib/write-outcome';
import type { SaveStatus } from './save-status';
import type { useSheetFormState } from './use-sheet-form-state';

export type SheetFormSaveOutcome = 'saved' | 'failed' | 'remote-conflict';

/** Saves a validated draft while preserving newer edits and recognizing its query echo. */
export function useSheetFormSave<Values extends FieldValues, Input>({
  state,
  normalize,
  normalizeDraft,
  write,
}: {
  state: ReturnType<typeof useSheetFormState<Values>>;
  normalize: (values: Values) => { values: Values; input: Input };
  normalizeDraft: (values: Values) => Values | undefined;
  write: (input: Input) => Promise<unknown>;
}) {
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const isBusy = useRef(false);
  const { form, source, baseline, expected, latest, setBaseline } = state;

  async function saveDraft(forceWrite: boolean): Promise<SheetFormSaveOutcome> {
    if (isBusy.current) return 'failed';
    isBusy.current = true;
    let outcome: SheetFormSaveOutcome = 'failed';
    try {
      await form.handleSubmit(async (values) => {
        const { values: submitted, input } = normalize(values);
        const signature = JSON.stringify(submitted);
        if (!forceWrite && signature === JSON.stringify(baseline)) {
          form.reset(baseline, { keepDirtyValues: false });
          setStatus({ kind: 'idle' });
          outcome = 'saved';
          return;
        }
        expected.current = signature;
        setStatus({ kind: 'saving' });
        function acceptSavedDraft(): SheetFormSaveOutcome {
          const current = form.getValues();
          const next =
            latest.current.source === source
              ? submitted
              : latest.current.baseline;
          const retained =
            JSON.stringify(normalizeDraft(current)) === JSON.stringify(next)
              ? next
              : current;
          form.reset(next, { keepDirtyValues: false });
          form.reset(retained, {
            keepDefaultValues: true,
            keepDirtyValues: false,
          });
          setBaseline(next);
          setStatus({ kind: 'saved' });
          return JSON.stringify(next) === signature
            ? 'saved'
            : 'remote-conflict';
        }
        try {
          await write(input);
          outcome = acceptSavedDraft();
        } catch (error) {
          const failure = classifyWriteFailure(error);
          if (failure.kind === 'unknown' && expected.current === null) {
            outcome = acceptSavedDraft();
            return;
          }
          expected.current = null;
          setStatus({
            kind: 'error',
            message:
              failure.kind === 'rejected'
                ? `Changes weren't saved${refusalReason(failure.message)} Your edits are kept. Save to try again.`
                : 'Changes may not have been saved. Your edits are kept. Check them, then Save to try again.',
          });
        }
      })();
      return outcome;
    } finally {
      isBusy.current = false;
    }
  }

  return {
    status,
    save: () => saveDraft(false),
    saveAdditionalChanges: () => saveDraft(true),
  };
}
