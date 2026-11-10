'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRef } from 'react';
import { useForm, useFormState } from 'react-hook-form';
import { z } from 'zod';

const schema = z.object({
  level: z.string().superRefine((value, context) => {
    if (!value.trim())
      context.addIssue({ code: 'custom', message: 'Spell level is required' });
    else if (
      !/^\d+$/.test(value.trim()) ||
      !Number.isSafeInteger(Number(value))
    )
      context.addIssue({
        code: 'custom',
        message: 'Spell level must be a whole number of 0 or more',
      });
  }),
});

/** The row owns the draft; casting allowances remain advisory warnings. */
export function useOffListSpellLevelForm({
  level,
  save: write,
}: {
  level?: number | null;
  save: (level: number) => Promise<boolean>;
}) {
  const form = useForm<z.infer<typeof schema>>({
    defaultValues: { level: level == null ? '' : String(level) },
    resolver: zodResolver(schema),
  });
  const { errors } = useFormState({ control: form.control, name: 'level' });
  const busy = useRef(false);
  async function save() {
    if (busy.current) return false;
    busy.current = true;
    let saved = false;
    try {
      await form.handleSubmit(async (values) => {
        saved = await write(Number(values.level));
      })();
      return saved;
    } finally {
      busy.current = false;
    }
  }
  return { form, save, error: errors.level?.message };
}
