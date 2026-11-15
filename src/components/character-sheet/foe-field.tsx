'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import { cn } from '~/lib/utils';
import { maxItemPartText } from './equipment-form-schema';
import { fieldLabel, missingChoice } from './sheet-parts';

const foeSchema = z.object({
  foe: z.string().refine((value) => value.trim().length <= maxItemPartText, {
    message: `Name the foe in ${maxItemPartText} characters or fewer`,
  }),
});
type FoeValues = z.infer<typeof foeSchema>;

/**
 * Bane's designated foe: free text, saved trimmed when the field is left or
 * Enter is pressed, once it fits in 64 characters. Empty, it wears the
 * sheet's blue outline with the words that say what it is waiting for; this
 * is a choice still to make, never a warning. A foe being typed survives
 * another player's change to the list.
 */
export function FoeField({
  choice,
  isDisabled,
  describedBy,
  onSave,
}: {
  choice: string | null;
  isDisabled: boolean;
  describedBy?: string;
  onSave: (foe: string) => void;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const missingId = `${id}-missing`;
  const form = useForm<FoeValues>({
    values: { foe: choice ?? '' },
    resetOptions: { keepDirtyValues: true },
    resolver: zodResolver(foeSchema),
    mode: 'onChange',
  });
  const isMissing = form.watch('foe').trim() === '';
  function commit() {
    const parsed = foeSchema.safeParse(form.getValues());
    if (!parsed.success) {
      form.setError('foe', {
        message: parsed.error.issues[0]?.message ?? 'Enter a valid foe',
      });
      return;
    }
    const next = parsed.data.foe.trim();
    form.setValue('foe', next);
    if (next !== (choice ?? '')) onSave(next);
  }
  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="foe"
        render={({ field, fieldState }) => (
          <FormItem className="gap-1 pl-3">
            <FormLabel className={fieldLabel}>Foe</FormLabel>
            <FormControl
              aria-describedby={
                cn(
                  describedBy,
                  fieldState.error && errorId,
                  isMissing && !isDisabled && missingId,
                ) || undefined
              }
            >
              <Input
                {...field}
                type="text"
                autoComplete="off"
                placeholder="e.g. undead"
                disabled={isDisabled}
                className={cn(
                  'h-11 w-full max-w-56 md:h-8',
                  isMissing && !isDisabled && missingChoice,
                )}
                onBlur={() => {
                  field.onBlur();
                  commit();
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  commit();
                }}
              />
            </FormControl>
            <FormMessage
              id={errorId}
              role={fieldState.error ? 'alert' : undefined}
              className={fieldState.error ? undefined : 'hidden'}
            />
            {isMissing && !isDisabled ? (
              <p id={missingId} className="text-xs text-sky-300">
                Choose a foe; bane adds nothing until then.
              </p>
            ) : null}
          </FormItem>
        )}
      />
    </Form>
  );
}
