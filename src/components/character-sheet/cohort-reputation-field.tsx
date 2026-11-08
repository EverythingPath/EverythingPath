'use client';
import { useId } from 'react';
import { Checkbox } from '~/components/ui/checkbox';
import { FormField, FormItem, FormMessage } from '~/components/ui/form';
import { cn } from '~/lib/utils';
import type { CohortController } from './companion-props';
import { chip, fieldLabel } from './sheet-parts';

// A playing card that can be chosen alongside the others: a native checkbox
// for the keyboard and the screen reader, the card around it for the eye.
const card =
  'border-foreground/40 bg-card has-checked:border-primary has-checked:text-primary has-focus-visible:ring-ring/50 flex min-h-11 cursor-pointer items-center justify-between gap-2 border px-3 py-1.5 text-left font-sans text-sm transition-all hover:-translate-y-0.5 hover:border-foreground has-checked:shadow-xs has-focus-visible:ring-[3px] has-disabled:cursor-not-allowed has-disabled:opacity-50 motion-reduce:transition-none motion-reduce:hover:translate-y-0 md:min-h-9';

/**
 * The leader's reputation from this cohort's point of view (#417): the
 * Leadership table's reputation modifiers as cards, any number chosen,
 * each wearing its modifier.
 */
export function CohortReputationField({
  form,
  choices,
  disabled,
}: {
  form: CohortController['leadershipForm'];
  choices: CohortController['reputationChoices'];
  disabled: boolean;
}) {
  const labelId = useId();
  return (
    <FormField
      control={form.control}
      name="reputation"
      render={({ field, fieldState }) => {
        const chosen: readonly string[] = field.value;
        return (
          <FormItem className="min-w-0 gap-1">
            <span
              id={labelId}
              className={cn(fieldLabel, fieldState.error && 'text-destructive')}
            >
              Reputation
            </span>
            <div
              role="group"
              aria-labelledby={labelId}
              className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3"
            >
              {choices.map((choice) => (
                <label key={choice.value} className={card}>
                  <Checkbox
                    className="sr-only"
                    name={field.name}
                    value={choice.value}
                    checked={chosen.includes(choice.value)}
                    disabled={disabled}
                    onBlur={field.onBlur}
                    onCheckedChange={(isChecked) =>
                      field.onChange(
                        isChecked
                          ? [...chosen, choice.value]
                          : chosen.filter((value) => value !== choice.value),
                      )
                    }
                  />
                  <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                    {choice.label}
                  </span>{' '}
                  <span className={cn(chip, 'tabular-nums')}>
                    {choice.modifier}
                  </span>
                </label>
              ))}
            </div>
            <FormMessage
              role={fieldState.error ? 'alert' : undefined}
              className="text-xs [overflow-wrap:anywhere]"
            />
          </FormItem>
        );
      }}
    />
  );
}
