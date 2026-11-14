'use client';
import type { Control, FieldPathByValue, FieldValues } from 'react-hook-form';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import { cn } from '~/lib/utils';
import { fieldLabel, noteText } from './sheet-parts';

/**
 * One typed value of a cohort editor (#417): its label, a text input (never
 * a browser number field), an optional description and its own message,
 * which grows inside the field so the controls beside it stay aligned. A
 * whole number gets the numeric keyboard; a signed one keeps the plain
 * keyboard so the minus sign stays reachable.
 */
export function CohortTextField<TValues extends FieldValues>({
  control,
  name,
  label,
  description,
  disabled,
  keyboard = 'text',
  maxLength,
  className,
}: {
  control: Control<TValues>;
  name: FieldPathByValue<TValues, string>;
  label: string;
  description?: string;
  disabled: boolean;
  keyboard?: 'text' | 'numeric';
  maxLength?: number;
  className?: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem className={cn('min-w-0 content-start gap-1', className)}>
          <FormLabel className={fieldLabel}>{label}</FormLabel>
          <FormControl>
            <Input
              {...field}
              disabled={disabled}
              type="text"
              inputMode={keyboard === 'numeric' ? 'numeric' : undefined}
              autoComplete="off"
              maxLength={maxLength}
              className={cn(
                'h-11 text-sm md:h-8',
                keyboard === 'numeric' && 'font-mono tabular-nums',
              )}
            />
          </FormControl>
          {description ? (
            <FormDescription className={noteText}>
              {description}
            </FormDescription>
          ) : null}
          <FormMessage
            role={fieldState.error ? 'alert' : undefined}
            className="text-xs [overflow-wrap:anywhere]"
          />
        </FormItem>
      )}
    />
  );
}
