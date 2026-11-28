'use client';

import { useRef, useState } from 'react';
import type { FieldValues, Resolver } from 'react-hook-form';
import { classifyWriteFailure, refusalReason } from '~/lib/write-outcome';
import type { SaveStatus } from './save-status';
import { useSheetFormState } from './use-sheet-form-state';

/** Acknowledges the submitted values without discarding a newer draft. */
export function useSheetValueForm<Values extends FieldValues>({
  incoming,
  resolver,
  normalize,
  write,
}: {
  incoming: Values;
  resolver: Resolver<Values>;
  normalize: (values: Values) => Values | null;
  write: (values: Values) => Promise<unknown>;
}) {
  const state = useSheetFormState({
    incoming,
    resolver,
    draftPolicy: 'fields',
  });
  const { form, source, expected, latest } = state;
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const busy = useRef(false);

  async function save(): Promise<'saved' | 'failed'> {
    if (busy.current) return 'failed';
    busy.current = true;
    let outcome: 'saved' | 'failed' = 'failed';
    try {
      await form.handleSubmit(async (values) => {
        const submitted = normalize(values);
        if (!submitted) return;
        expected.current = JSON.stringify(submitted);
        setStatus({ kind: 'saving' });
        try {
          await write(submitted);
          const current = form.getValues();
          const next =
            latest.current.source === source
              ? submitted
              : latest.current.source;
          form.reset(next, { keepDirtyValues: false });
          form.reset(
            JSON.stringify(normalize(current)) === JSON.stringify(submitted)
              ? submitted
              : current,
            { keepDefaultValues: true, keepDirtyValues: false },
          );
          setStatus({ kind: 'saved' });
          outcome = 'saved';
        } catch (error) {
          expected.current = null;
          const failure = classifyWriteFailure(error);
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
      busy.current = false;
    }
  }

  return {
    form,
    status,
    save,
    hasRemoteChange: state.hasRemoteChange,
    dismissRemoteChange: state.dismissRemoteChange,
  };
}
