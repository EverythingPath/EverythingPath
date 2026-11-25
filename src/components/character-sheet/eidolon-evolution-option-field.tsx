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
import { fieldLabel } from './sheet-parts';
import type {
  EidolonEvolutionPickerForm,
  EvolutionCatalogEntry,
} from './use-eidolon-evolution-picker-form';

const optionCard =
  'justify-start px-2 py-1 text-left font-sans text-xs md:min-h-8';

/** The chosen evolution's option, such as the attack or energy type it applies to, with any extra cost. */
export function EidolonEvolutionOptionField({
  form,
  evolution,
  isLocked,
}: {
  form: EidolonEvolutionPickerForm;
  evolution: EvolutionCatalogEntry;
  isLocked: boolean;
}) {
  const labelId = useId();
  return (
    <FormField
      control={form.control}
      name="choice"
      render={({ field, fieldState }) => (
        <FormItem className="gap-1">
          <span
            id={labelId}
            className={cn(fieldLabel, fieldState.error && 'text-destructive')}
          >
            {evolution.name} option
          </span>
          <FormControl>
            <RadioGroup
              aria-labelledby={labelId}
              name={field.name}
              value={field.value}
              disabled={isLocked}
              onBlur={field.onBlur}
              onValueChange={field.onChange}
              className="grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4"
            >
              {evolution.choiceOptions.map((option) => (
                <RadioGroupItem
                  key={option.value}
                  value={option.value}
                  className={optionCard}
                >
                  {option.label}
                  {option.extraCost > 0 ? ` (+${option.extraCost})` : ''}
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
