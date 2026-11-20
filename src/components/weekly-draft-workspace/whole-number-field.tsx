'use client';
import { useRef, type ReactNode } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '~/components/ui/input';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from '~/components/ui/form';
const digits = z
  .string()
  .regex(/^[0-9]*$/, 'Use digits only.')
  .refine(
    (value) => value === '' || Number.isSafeInteger(Number(value)),
    'Enter a smaller whole number.',
  );
// A signed whole number, such as a skill bonus. A lone minus sign is typing
// in progress: it is kept locally and never sent as a value.
const SIGNED = 'Use a whole number such as 4 or -3.';
const signedDigits = z
  .string()
  .regex(/^-?[0-9]*$/, SIGNED)
  .refine(
    (value) =>
      value === '-' || value === '' || Number.isSafeInteger(Number(value)),
    'Enter a smaller whole number.',
  );
export function WholeNumberField({
  label,
  value,
  required = false,
  disabled = false,
  onValue,
  onInvalid,
  description,
  signed = false,
}: {
  label: string;
  value: number | null;
  required?: boolean;
  disabled?: boolean;
  // Accept a leading minus sign (a bonus, not a dice total).
  signed?: boolean;
  onValue: (value: number | null) => void;
  // Reports rejected local text so an enclosing form can refuse to save.
  onInvalid?: (message: string | null) => void;
  // Read with the input (for example a roll's dice notation), placed directly
  // under it and before the reserved error slot.
  description?: ReactNode;
}) {
  // Rejected text never enters the form value, so react-hook-form's focus-loss
  // validation would see the retained valid number and clear the error while
  // the enclosing form still refuses to save. Remember the rejection so leaving
  // the field keeps that error until valid input replaces it.
  const rejected = useRef<string | null>(null);
  const schema = signed ? signedDigits : digits;
  const form = useForm({
    values: { value: value === null ? '' : String(value) },
    mode: 'onBlur',
    resolver: zodResolver(
      z.object({
        value: schema
          .refine((value) => value !== '-', SIGNED)
          .refine((value) => !required || value !== '', 'A value is required.'),
      }),
    ),
    resetOptions: { keepErrors: true },
  });
  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="value"
        render={({ field }) => (
          <FormItem className="min-w-0 space-y-1">
            <FormLabel className="text-xs">{label}</FormLabel>
            <FormControl>
              <Input
                {...field}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                disabled={disabled}
                className="font-mono"
                onBlur={() => {
                  if (rejected.current === null) field.onBlur();
                  else form.setError('value', { message: rejected.current });
                }}
                onChange={(event) => {
                  const entered = event.target.value;
                  const parsed = schema.safeParse(entered);
                  if (!parsed.success) {
                    // Safe cast: parsed.success is false here, and a failed zod parse
                    // always lists the issue that failed it.
                    const message = parsed.error.issues[0]!.message;
                    rejected.current = message;
                    form.setError('value', { message });
                    onInvalid?.(message);
                    return;
                  }
                  rejected.current = null;
                  form.clearErrors('value');
                  onInvalid?.(null);
                  field.onChange(entered);
                  if (entered === '-') return;
                  // "-0" would otherwise record a negative zero.
                  onValue(entered === '' ? null : Number(entered) || 0);
                }}
              />
            </FormControl>
            {description && <FormDescription>{description}</FormDescription>}
            <div className="min-h-5">
              <FormMessage role="alert" />
            </div>
          </FormItem>
        )}
      />
    </Form>
  );
}
