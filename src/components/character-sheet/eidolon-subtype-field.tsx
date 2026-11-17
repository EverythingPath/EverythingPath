'use client';
import { useId } from 'react';
import { FormControl, FormField, FormItem } from '~/components/ui/form';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import type { UnchainedSubtypeChoice } from './eidolon-subtype-card';
import { fieldLabel } from './sheet-parts';
import type { EidolonProgressionForm } from './use-eidolon-progression-form';

const note = 'text-muted-foreground text-xs [overflow-wrap:anywhere]';
// A playing card: lifts on hover, settles when chosen, stays put for reduced motion.
const card =
  'flex-col items-start justify-start gap-0.5 px-3 py-2 text-left font-sans text-sm transition-all hover:-translate-y-0.5 hover:border-foreground motion-reduce:transition-none motion-reduce:hover:translate-y-0';

/**
 * The editor's subtype change for an Unchained eidolon: the twelve subtypes
 * as compact cards, each with its alignment. Choosing another keeps the
 * former subtype's choices recorded without counting.
 */
export function EidolonSubtypeField({
  form,
  subtypes,
  disabled,
  reasonId,
}: {
  form: EidolonProgressionForm;
  subtypes: readonly UnchainedSubtypeChoice[];
  disabled: boolean;
  reasonId: string | undefined;
}) {
  const labelId = useId();
  return (
    <FormField
      control={form.control}
      name="subtype"
      render={({ field }) => (
        <FormItem className="gap-1">
          <span id={labelId} className={fieldLabel}>
            Subtype
          </span>
          <FormControl>
            <RadioGroup
              aria-labelledby={labelId}
              name={field.name}
              value={field.value}
              disabled={disabled}
              onBlur={field.onBlur}
              onValueChange={field.onChange}
              className="grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4"
            >
              {subtypes.map((subtype) => (
                <RadioGroupItem
                  key={subtype.value}
                  value={subtype.value}
                  className={card}
                  aria-describedby={reasonId}
                >
                  <span className="leading-tight">{subtype.label}</span>
                  <span className={note}>{subtype.alignment}</span>
                </RadioGroupItem>
              ))}
            </RadioGroup>
          </FormControl>
          <p className={note}>
            A former subtype’s choices stay recorded under Not counting now.
          </p>
        </FormItem>
      )}
    />
  );
}
