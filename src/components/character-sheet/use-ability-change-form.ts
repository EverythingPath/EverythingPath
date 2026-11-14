'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState } from 'react';
import { z } from 'zod';
import { abilityKeys } from '~/lib/character-sheet';
import { classifyWriteFailure, refusalReason } from '~/lib/write-outcome';
import type { AbilityChangeInput } from './use-character-sheet-entries';
import type { SaveStatus } from './save-status';
import { useSheetFormState } from './use-sheet-form-state';

const schema = z.object({
  kind: z.enum(['abilityDamage', 'abilityDrain']),
  ability: z.enum(abilityKeys),
  points: z.string().superRefine((value, ctx) => {
    if (!value.trim())
      ctx.addIssue({ code: 'custom', message: 'Points are required' });
    else if (
      !/^\d+$/.test(value.trim()) ||
      !Number.isSafeInteger(Number(value))
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Points must be a whole number of 0 or more',
      });
  }),
});
export function useAbilityChangeForm({
  value,
  save: write,
}: {
  value?: AbilityChangeInput;
  save: (input: AbilityChangeInput) => Promise<unknown>;
}) {
  const incoming = value
    ? { ...value, points: String(value.points) }
    : {
        kind: 'abilityDamage' as const,
        ability: 'strength' as const,
        points: '',
      };
  const state = useSheetFormState({
    incoming,
    resolver: zodResolver(schema),
    draftPolicy: 'fields',
  });
  const { form, source, expected, latest } = state;
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const busy = useRef(false);
  void form.formState.errors;
  void form.formState.dirtyFields;
  async function save(): Promise<'saved' | 'failed'> {
    if (busy.current) return 'failed';
    busy.current = true;
    let outcome: 'saved' | 'failed' = 'failed';
    try {
      await form.handleSubmit(async (values) => {
        const input = { ...values, points: Number(values.points) };
        expected.current = JSON.stringify({
          ...input,
          points: String(input.points),
        });
        setStatus({ kind: 'saving' });
        try {
          await write(input);
          const current = form.getValues();
          const next =
            latest.current.source === source ? values : latest.current.source;
          form.reset(next);
          form.reset(current, { keepDefaultValues: true });
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
    hasRemoteChange: state.hasRemoteChange,
    dismissRemoteChange: state.dismissRemoteChange,
    save,
  };
}
