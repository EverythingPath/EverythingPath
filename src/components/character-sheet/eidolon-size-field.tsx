'use client';
import { useId } from 'react';
import { FormControl, FormField, FormItem } from '~/components/ui/form';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import { fieldLabel } from './sheet-parts';
import {
  eidolonSizeChoices,
  type EidolonProgressionForm,
} from './use-eidolon-progression-form';

/**
 * The base form's size, Medium or Small, as two cards. The Large and Huge
 * evolutions change the calculated size on their own.
 */
export function EidolonSizeField({
  form,
  disabled,
}: {
  form: EidolonProgressionForm;
  disabled: boolean;
}) {
  const labelId = useId();
  return (
    <FormField
      control={form.control}
      name="size"
      render={({ field }) => (
        <FormItem className="gap-1">
          <span id={labelId} className={fieldLabel}>
            Base size
          </span>
          <FormControl>
            <RadioGroup
              aria-labelledby={labelId}
              name={field.name}
              value={field.value}
              disabled={disabled}
              onBlur={field.onBlur}
              onValueChange={field.onChange}
              className="grid-cols-2 gap-1 sm:max-w-sm"
            >
              {eidolonSizeChoices.map((option) => (
                <RadioGroupItem
                  key={option.value}
                  value={option.value}
                  className="font-sans"
                >
                  {option.label}
                </RadioGroupItem>
              ))}
            </RadioGroup>
          </FormControl>
          <p className="text-muted-foreground text-xs">
            A Small eidolon takes Strength −4, Dexterity +2 and Constitution
            −2.
          </p>
        </FormItem>
      )}
    />
  );
}
