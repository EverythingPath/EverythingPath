'use client';
import { useWatch } from 'react-hook-form';
import { Checkbox } from '~/components/ui/checkbox';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '~/components/ui/form';
import { CompanionProgressionNumberField } from './companion-progression-number-field';
import { useProgressionChoiceForm } from './use-companion-progression-form';

/**
 * The hit points the Companion's progression Hit Dice gave, one plain
 * number with no roll, average or prefill. Leaving it unrecorded is a box
 * to tick, so an empty field always asks for a number.
 */
export function CompanionProgressionHpField({
  disabled,
}: {
  disabled: boolean;
}) {
  const form = useProgressionChoiceForm();
  const isUnrecorded = useWatch({
    control: form.control,
    name: 'hp.isUnrecorded',
  });
  return (
    <div className="flex flex-col gap-1.5">
      <CompanionProgressionNumberField
        name="hp.value"
        label="Hit points gained"
        placeholder={isUnrecorded ? 'Not recorded' : 'Enter hit points'}
        disabled={disabled || isUnrecorded}
        className="max-w-48"
      />
      <FormField
        control={form.control}
        name="hp.isUnrecorded"
        render={({ field }) => (
          <FormItem className="flex min-h-11 flex-row items-center gap-2 md:min-h-8">
            <FormControl>
              <Checkbox
                ref={field.ref}
                name={field.name}
                checked={field.value}
                disabled={disabled}
                onBlur={field.onBlur}
                onCheckedChange={(checked) => {
                  field.onChange(checked);
                  if (checked) form.clearErrors('hp.value');
                }}
              />
            </FormControl>
            <FormLabel className="text-sm font-normal">
              Leave hit points unrecorded for now
            </FormLabel>
          </FormItem>
        )}
      />
    </div>
  );
}
