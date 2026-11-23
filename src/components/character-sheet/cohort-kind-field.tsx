'use client';
import { useId } from 'react';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '~/components/ui/form';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import { cn } from '~/lib/utils';
import type { CohortController } from './companion-props';
import { fieldLabel } from './sheet-parts';

// A playing card: lifts on hover, settles when chosen, stays put for reduced motion.
const card =
  'justify-start text-left font-sans text-sm transition-all hover:-translate-y-0.5 hover:border-foreground motion-reduce:transition-none motion-reduce:hover:translate-y-0';

const kinds = [
  { value: 'ordinary', label: 'Ordinary cohort (Class Levels)' },
  { value: 'published', label: 'Published monster cohort' },
  { value: 'entered', label: 'Unlisted creature' },
] as const;

/** What the cohort's equivalence is based on (#417), as three cards. */
export function CohortKindField({
  form,
  disabled,
}: {
  form: CohortController['equivalenceForm'];
  disabled: boolean;
}) {
  const labelId = useId();
  return (
    <FormField
      control={form.control}
      name="kind"
      render={({ field, fieldState }) => (
        <FormItem className="gap-1">
          <span
            id={labelId}
            className={cn(fieldLabel, fieldState.error && 'text-destructive')}
          >
            Basis
          </span>
          <FormControl>
            <RadioGroup
              aria-labelledby={labelId}
              name={field.name}
              value={field.value}
              disabled={disabled}
              onBlur={field.onBlur}
              onValueChange={field.onChange}
              className="grid-cols-1 gap-1 sm:grid-cols-3"
            >
              {kinds.map((kind) => (
                <RadioGroupItem
                  key={kind.value}
                  value={kind.value}
                  className={card}
                >
                  <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                    {kind.label}
                  </span>
                </RadioGroupItem>
              ))}
            </RadioGroup>
          </FormControl>
          <FormMessage role={fieldState.error ? 'alert' : undefined} />
        </FormItem>
      )}
    />
  );
}
