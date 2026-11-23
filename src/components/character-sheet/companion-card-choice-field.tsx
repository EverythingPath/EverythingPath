'use client';
import { useId, type ReactNode } from 'react';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '~/components/ui/form';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import { cn } from '~/lib/utils';
import type { CompanionFieldProps } from './companion-props';
import { fieldLabel } from './sheet-parts';

export type CompanionCardOption = {
  value: string;
  label: string;
  aside?: ReactNode;
};

// A playing card: lifts on hover, settles when chosen, stays put for reduced motion.
const card =
  'justify-start gap-2 text-left font-sans text-sm transition-all hover:-translate-y-0.5 hover:border-foreground motion-reduce:transition-none motion-reduce:hover:translate-y-0';

/**
 * One choice among cards (the application's card picker): native radios
 * for the keyboard and the screen reader, the card around each for the
 * eye. The error and any note expand inside the field's own container.
 */
export function CompanionCardChoiceField({
  controller,
  isDisabled,
  name,
  label,
  options,
  note,
  onValueChange,
}: CompanionFieldProps & {
  name: 'kind' | 'companionCharacterId' | 'sourceKey';
  label: string;
  options: CompanionCardOption[];
  note?: ReactNode;
  onValueChange?: (value: string) => void;
}) {
  const labelId = useId();
  return (
    <FormField
      control={controller.form.control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem className="gap-0.5">
          <span
            id={labelId}
            className={cn(fieldLabel, fieldState.error && 'text-destructive')}
          >
            {label}
          </span>
          {options.length > 0 ? (
            <FormControl>
              <RadioGroup
                aria-labelledby={labelId}
                name={field.name}
                value={field.value}
                disabled={isDisabled}
                onBlur={field.onBlur}
                onValueChange={onValueChange ?? field.onChange}
                className="grid-cols-1 gap-1 sm:grid-cols-2"
              >
                {options.map((option) => (
                  <RadioGroupItem
                    key={option.value}
                    value={option.value}
                    className={card}
                  >
                    <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                      {option.label}
                    </span>
                    {option.aside}
                  </RadioGroupItem>
                ))}
              </RadioGroup>
            </FormControl>
          ) : null}
          {note}
          <FormMessage role={fieldState.error ? 'alert' : undefined} />
        </FormItem>
      )}
    />
  );
}
