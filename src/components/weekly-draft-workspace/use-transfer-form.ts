'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { parseGpInput } from '~/lib/gp-money';
import type { UpkeepEdit } from './upkeep-edits';
import { addTransfer } from './upkeep-transfer-edits';

// The amount is entered in gp and stored as exact copper; empty and
// malformed input have their own messages. Zero is a valid amount.
export const transferFormSchema = z.object({
  direction: z.enum(['deposit', 'withdraw']),
  amount: z.string().transform((text, context) => {
    const parsed = parseGpInput(text);
    if (parsed.kind === 'valid') return parsed.copper;
    context.addIssue({
      code: 'custom',
      message:
        parsed.kind === 'empty' ? 'An amount is required.' : parsed.message,
    });
    return z.NEVER;
  }),
});
type Values = z.input<typeof transferFormSchema>;

// The new-transfer form: Deposit / Withdraw, an amount in gp and Add. Adding
// stages one Weekly Draft edit and clears only the amount; an invalid amount
// stays in the field with its error and sends nothing.
export function useTransferForm(edit: UpkeepEdit) {
  const form = useForm<Values, unknown, z.output<typeof transferFormSchema>>({
    defaultValues: { direction: 'deposit', amount: '' },
    resolver: zodResolver(transferFormSchema),
  });
  const submit = form.handleSubmit((values) => {
    edit(addTransfer(values.direction, values.amount));
    form.reset({ direction: values.direction, amount: '' });
  });
  return { form, submit };
}
