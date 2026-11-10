'use client';
import { Check } from 'lucide-react';
import { FormField, FormItem, FormMessage } from '~/components/ui/form';
import { cn } from '~/lib/utils';
import type { CohortController } from './companion-props';
import { chip } from './sheet-parts';

const switchButton =
  'inline-flex min-h-11 w-full items-center gap-1.5 border px-2 text-left font-mono text-xs disabled:opacity-50 md:min-h-7 md:w-auto';

/**
 * One of the Leadership table's yes-or-no modifiers (#417) as a switch
 * with its modifier beside it, bound to the leader's draft.
 */
export function CohortSwitchField({
  form,
  name,
  choice,
  disabled,
  reasonId,
}: {
  form: CohortController['leadershipForm'];
  name: 'hasCompanion' | 'differentAlignment';
  choice: { label: string; modifier: string };
  disabled: boolean;
  reasonId: string | undefined;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem className="min-w-0 gap-1">
          <button
            type="button"
            role="switch"
            aria-checked={field.value}
            aria-describedby={reasonId}
            disabled={disabled}
            onBlur={field.onBlur}
            onClick={() => field.onChange(!field.value)}
            className={cn(
              switchButton,
              field.value
                ? 'border-primary'
                : 'border-foreground/40 text-muted-foreground',
            )}
          >
            <Check
              aria-hidden
              className={cn('size-3.5 shrink-0', !field.value && 'invisible')}
            />
            <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
              {choice.label}
            </span>{' '}
            <span className={cn(chip, 'tabular-nums')}>{choice.modifier}</span>
          </button>
          <FormMessage
            role={fieldState.error ? 'alert' : undefined}
            className="text-xs"
          />
        </FormItem>
      )}
    />
  );
}
