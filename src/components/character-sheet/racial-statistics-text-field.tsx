'use client';
import type { ReactNode } from 'react';
import type { FieldPathByValue, UseFormReturn } from 'react-hook-form';
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
import type { useRacialStatisticsForm } from './use-racial-statistics-form';

type Form = ReturnType<typeof useRacialStatisticsForm>['form'];
type Values = Form extends UseFormReturn<infer V> ? V : never;

export const racialInput = 'h-10 font-mono text-sm md:h-8';

/**
 * One typed field of the racial Hit Dice editor: its small label above, the
 * input, an optional note, and its own styled message that grows inside the
 * field so the fields beside it stay aligned.
 */
export function RacialStatisticsTextField({
  form,
  name,
  label,
  placeholder,
  isNumeric = false,
  prefix,
  disabled,
  note,
  className,
}: {
  form: Form;
  name: FieldPathByValue<Values, string>;
  label: string;
  placeholder?: string;
  isNumeric?: boolean;
  /** A fixed mark before the value, such as the "d" of a Hit Die. */
  prefix?: string;
  disabled: boolean;
  note?: ReactNode;
  className?: string;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem className={cn('min-w-0 content-start gap-1', className)}>
          <FormLabel className={fieldLabel}>{label}</FormLabel>
          <div className="flex items-center gap-1">
            {prefix ? (
              <span aria-hidden className="text-muted-foreground font-mono">
                {prefix}
              </span>
            ) : null}
            <FormControl>
              <Input
                {...field}
                disabled={disabled}
                type="text"
                inputMode={isNumeric ? 'numeric' : undefined}
                autoComplete="off"
                placeholder={placeholder}
                className={cn(racialInput, isNumeric && 'tabular-nums')}
              />
            </FormControl>
          </div>
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
