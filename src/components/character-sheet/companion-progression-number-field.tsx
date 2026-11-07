'use client';
import type { ReactNode } from 'react';
import type { FieldPathByValue } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import { cn } from '~/lib/utils';
import { fieldLabel } from './sheet-parts';
import {
  useProgressionChoiceForm,
  type ProgressionChoiceFormValues,
} from './use-companion-progression-form';

export const progressionInput = 'h-11 font-mono text-sm tabular-nums md:h-8';

/**
 * One typed number of the progression editor: its label, the text input
 * (never a browser number field), an optional note, and its own message
 * growing inside the field so the fields beside it stay aligned.
 */
export function CompanionProgressionNumberField({
  name,
  label,
  visibleLabel,
  placeholder,
  disabled,
  note,
  className,
}: {
  name: FieldPathByValue<ProgressionChoiceFormValues, string>;
  label: string;
  /** A shorter label to show; `label` still names the field. */
  visibleLabel?: string;
  placeholder?: string;
  disabled: boolean;
  note?: ReactNode;
  className?: string;
}) {
  const form = useProgressionChoiceForm();
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem className={cn('min-w-0 content-start gap-1', className)}>
          <FormLabel className={fieldLabel}>{visibleLabel ?? label}</FormLabel>
          <FormControl>
            <Input
              {...field}
              aria-label={visibleLabel ? label : undefined}
              disabled={disabled}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder={placeholder}
              className={progressionInput}
            />
          </FormControl>
          {note}
          <FormMessage
            role={fieldState.error ? 'alert' : undefined}
            className="text-xs [overflow-wrap:anywhere]"
          />
        </FormItem>
      )}
    />
  );
}
